import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateCustomersWorkflow,
  linkCustomersToCustomerGroupWorkflow,
} from "@medusajs/medusa/core-flows"
import { LOYALTY_MODULE } from "./index"
import LoyaltyModuleService, {
  tierForPoints,
  thresholdFor,
  POINTS_DIVISOR_BY_CURRENCY,
  ROLLING_WINDOW_DAYS,
  TIER_DOWNGRADE_GRACE,
  TIER_GROUP_HANDLE,
  TIER_THRESHOLDS,
  TIER_DISCOUNT_PCT,
  nextTier,
  Tier,
} from "./service"

const TIER_RANK: Record<Tier, number> = { basic: 0, bronze: 1, silver: 2, gold: 3 }

function tierGroupName(tier: Tier): string {
  return `Tier ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`
}

type MinimalOrder = {
  id: string
  customer_id?: string | null
  currency_code?: string | null
  item_total?: unknown
  item_tax_total?: unknown
  completed_at?: Date | string | null
}

function toNumber(v: unknown): number {
  if (v == null) return 0
  const n = typeof v === "number" ? v : Number(v as string)
  return Number.isFinite(n) ? n : 0
}

export async function recordEarnForOrder(
  container: MedusaContainer,
  order: MinimalOrder,
  opts: { overrideCreatedAt?: Date } = {},
): Promise<void> {
  const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
  const customerId = order.customer_id
  if (!customerId) return

  const existing = await loyalty.listLoyaltyLedgers({
    order_id: order.id,
    reason: "order_earn",
  })
  if (existing.length > 0) return

  const currency = (order.currency_code || "").toLowerCase()
  const divisor = POINTS_DIVISOR_BY_CURRENCY[currency] ?? 1
  const itemTotal = toNumber(order.item_total)
  const itemTax = toNumber(order.item_tax_total)
  const itemNet = Math.max(0, itemTotal - itemTax)
  const points = Math.floor(itemNet / divisor)
  if (points <= 0) return

  const row: Record<string, unknown> = {
    customer_id: customerId,
    delta: points,
    reason: "order_earn",
    order_id: order.id,
    currency,
  }
  if (opts.overrideCreatedAt) {
    row.created_at = opts.overrideCreatedAt
  }
  await loyalty.createLoyaltyLedgers(row)

  await recomputeTierForCustomer(container, customerId)
}

export async function reverseEarnForOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<void> {
  const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
  const earnRows = await loyalty.listLoyaltyLedgers({
    order_id: orderId,
    reason: "order_earn",
  })
  if (earnRows.length === 0) return

  const alreadyReversed = await loyalty.listLoyaltyLedgers({
    order_id: orderId,
    reason: "refund_reverse",
  })
  if (alreadyReversed.length > 0) return

  const customerId = earnRows[0].customer_id
  const totalEarned = earnRows.reduce((s, r) => s + (r.delta || 0), 0)
  if (totalEarned <= 0) return

  await loyalty.createLoyaltyLedgers({
    customer_id: customerId,
    delta: -totalEarned,
    reason: "refund_reverse",
    order_id: orderId,
  })

  await recomputeTierForCustomer(container, customerId)
}

export type TierInfo = {
  tier: Tier
  balance: number
  lifetimeRolling: number
  nextTier: Tier | null
  pointsToNext: number
  progressPct: number
  discountPct: number
}

export function computeTierInfo(
  rollingSum: number,
  balanceSum: number,
  currentTier: Tier,
): TierInfo {
  const nxt = nextTier(currentTier)
  let pointsToNext = 0
  let progressPct = 100
  if (nxt) {
    const currentThreshold = thresholdFor(currentTier)
    const nextThreshold = TIER_THRESHOLDS[nxt]
    pointsToNext = Math.max(0, nextThreshold - Math.max(0, rollingSum))
    const span = nextThreshold - currentThreshold
    progressPct = span <= 0
      ? 100
      : Math.max(0, Math.min(100, Math.round(((Math.max(0, rollingSum) - currentThreshold) / span) * 100)))
  }
  return {
    tier: currentTier,
    balance: balanceSum,
    lifetimeRolling: Math.max(0, rollingSum),
    nextTier: nxt,
    pointsToNext,
    progressPct,
    discountPct: TIER_DISCOUNT_PCT[currentTier],
  }
}

export async function recomputeTierForCustomer(
  container: MedusaContainer,
  customerId: string,
): Promise<void> {
  const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
  const customerModule = container.resolve(Modules.CUSTOMER)

  const allRows = await loyalty.listLoyaltyLedgers({ customer_id: customerId })
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const rollingSum = allRows
    .filter((r) => {
      const ts = r.created_at instanceof Date ? r.created_at : new Date(r.created_at as unknown as string)
      return ts >= windowStart
    })
    .reduce((s, r) => s + (r.delta || 0), 0)
  const balanceSum = allRows.reduce((s, r) => s + (r.delta || 0), 0)

  let newTier = tierForPoints(Math.max(0, rollingSum))

  const customer = await customerModule.retrieveCustomer(customerId).catch(() => null)
  const existingMeta = (customer?.metadata || {}) as Record<string, unknown>
  const currentTier = ((existingMeta.loyalty_tier as Tier) || "basic") as Tier

  // Sticky downgrade: if within TIER_DOWNGRADE_GRACE of current threshold, hold.
  if (TIER_RANK[newTier] < TIER_RANK[currentTier]) {
    const currentThreshold = thresholdFor(currentTier)
    if (rollingSum >= currentThreshold - TIER_DOWNGRADE_GRACE) {
      newTier = currentTier
    }
  }

  const nowIso = new Date().toISOString()
  const tierChanged = newTier !== currentTier

  await updateCustomersWorkflow(container).run({
    input: {
      selector: { id: customerId },
      update: {
        metadata: {
          ...existingMeta,
          loyalty_tier: newTier,
          loyalty_lifetime_rolling: Math.max(0, rollingSum),
          loyalty_balance: balanceSum,
          loyalty_tier_since: tierChanged
            ? nowIso
            : (existingMeta.loyalty_tier_since as string | undefined) ?? nowIso,
        },
      },
    },
  })

  if (tierChanged) {
    await moveCustomerBetweenTierGroups(container, customerId, currentTier, newTier)
  } else {
    // Ensure customer is in the correct group even if tier didn't change
    // (covers fresh customers with no group yet).
    await ensureCustomerInTierGroup(container, customerId, newTier)
  }
}

async function findTierGroupIdsByName(
  container: MedusaContainer,
): Promise<Map<string, string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const names = (["basic", "bronze", "silver", "gold"] as Tier[]).map(tierGroupName)
  const { data } = await query.graph({
    entity: "customer_group",
    fields: ["id", "name"],
    filters: { name: names },
  })
  return new Map<string, string>(data.map((g: { id: string; name: string }) => [g.name, g.id]))
}

async function moveCustomerBetweenTierGroups(
  container: MedusaContainer,
  customerId: string,
  oldTier: Tier,
  newTier: Tier,
): Promise<void> {
  const idsByName = await findTierGroupIdsByName(container)
  const oldId = idsByName.get(tierGroupName(oldTier))
  const newId = idsByName.get(tierGroupName(newTier))

  if (oldId && oldId !== newId) {
    await linkCustomersToCustomerGroupWorkflow(container).run({
      input: { id: oldId, remove: [customerId], add: [] },
    }).catch((err) => {
      // Non-fatal: customer may not have been in old group yet.
      console.warn("[loyalty] remove from old group failed:", err?.message)
    })
  }
  if (newId) {
    await linkCustomersToCustomerGroupWorkflow(container).run({
      input: { id: newId, add: [customerId], remove: [] },
    })
  }
}

async function ensureCustomerInTierGroup(
  container: MedusaContainer,
  customerId: string,
  tier: Tier,
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "customer",
    fields: ["id", "groups.id", "groups.name"],
    filters: { id: customerId },
  })
  const groups = (links[0]?.groups ?? []) as Array<{ id: string; name: string }>
  const targetName = tierGroupName(tier)
  if (groups.some((g) => g?.name === targetName)) return

  const idsByName = await findTierGroupIdsByName(container)
  const targetId = idsByName.get(targetName)
  if (!targetId) return

  // Remove from any OTHER tier groups first (stale membership hygiene).
  const otherTierGroups = groups.filter((g) =>
    g?.name && g.name.startsWith("Tier ") && g.name !== targetName
  )
  for (const g of otherTierGroups) {
    await linkCustomersToCustomerGroupWorkflow(container).run({
      input: { id: g.id, remove: [customerId], add: [] },
    }).catch(() => {})
  }

  await linkCustomersToCustomerGroupWorkflow(container).run({
    input: { id: targetId, add: [customerId], remove: [] },
  })
}

export async function getTierInfoForCustomer(
  container: MedusaContainer,
  customerId: string,
): Promise<TierInfo & { recent: Array<Record<string, unknown>> }> {
  const loyalty = container.resolve(LOYALTY_MODULE) as LoyaltyModuleService
  const customerModule = container.resolve(Modules.CUSTOMER)

  const allRows = await loyalty.listLoyaltyLedgers(
    { customer_id: customerId },
    { order: { created_at: "DESC" }, take: 100 },
  )
  const windowStart = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const rollingSum = allRows
    .filter((r) => {
      const ts = r.created_at instanceof Date ? r.created_at : new Date(r.created_at as unknown as string)
      return ts >= windowStart
    })
    .reduce((s, r) => s + (r.delta || 0), 0)
  const balanceSum = allRows.reduce((s, r) => s + (r.delta || 0), 0)

  const customer = await customerModule.retrieveCustomer(customerId).catch(() => null)
  const tier = (((customer?.metadata || {}) as Record<string, unknown>).loyalty_tier as Tier) || "basic"

  const info = computeTierInfo(rollingSum, balanceSum, tier)
  const recent = allRows.slice(0, 10).map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    order_id: r.order_id,
    currency: r.currency,
    created_at: r.created_at,
  }))
  return { ...info, recent }
}

export { TIER_GROUP_HANDLE, TIER_DISCOUNT_PCT }
