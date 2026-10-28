// LifeSpan Circle (orders-based), built 2026-10-28.
//
// Tier = number of PAID, not-cancelled website orders placed with an
// ACCOUNT (guest orders don't count: matching by email would let anyone
// register with a big customer's email and inherit their tier). Lifetime:
// no expiry; only cancelled / fully refunded orders reduce the count.
//
// How the discount reaches checkout: each tier is a Medusa customer group
// ("Circle Bronze/Silver/Gold", marked with metadata.circle_tier). Automatic
// promotions CIRCLE-BRONZE/SILVER/GOLD (5/8/12%) and CIRCLE-FREESHIP (free
// shipping outside Thailand) target those groups. The Circle is "live" when
// those promotions are active (set by src/scripts/lss-circle-launch.ts).

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export type CircleTier = "basic" | "bronze" | "silver" | "gold"
export type PaidTier = Exclude<CircleTier, "basic">
export const PAID_TIERS: PaidTier[] = ["bronze", "silver", "gold"]

export const CIRCLE_TIERS: Record<PaidTier, { orders: number; pct: number }> = {
  bronze: { orders: 3, pct: 5 },
  silver: { orders: 6, pct: 8 },
  gold: { orders: 12, pct: 12 },
}
export const CIRCLE_PROMO_CODES: Record<PaidTier, string> = {
  bronze: "CIRCLE-BRONZE",
  silver: "CIRCLE-SILVER",
  gold: "CIRCLE-GOLD",
}
export const CIRCLE_FREESHIP_CODE = "CIRCLE-FREESHIP"
export const GOLD_SAMPLE_EVERY = 3
export const SAMPLE_VALUE_CAP = "฿1,500"

type GraphQuery = {
  graph: (args: Record<string, unknown>) => Promise<{ data: Array<Record<string, any>> }>
}
const q = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.QUERY) as unknown as GraphQuery

export function tierForCount(n: number): CircleTier {
  if (n >= CIRCLE_TIERS.gold.orders) return "gold"
  if (n >= CIRCLE_TIERS.silver.orders) return "silver"
  if (n >= CIRCLE_TIERS.bronze.orders) return "bronze"
  return "basic"
}

export function nextTierOf(t: CircleTier): PaidTier | null {
  return t === "basic" ? "bronze" : t === "bronze" ? "silver" : t === "silver" ? "gold" : null
}

export const tierLabel = (t: CircleTier) => t.charAt(0).toUpperCase() + t.slice(1)

// customer_group ids by tier, read from metadata.circle_tier
export async function circleGroups(container: MedusaContainer): Promise<Record<PaidTier, string>> {
  const { data } = await q(container).graph({ entity: "customer_group", fields: ["id", "name", "metadata"] })
  const out: Partial<Record<PaidTier, string>> = {}
  for (const g of data ?? []) {
    const t = g?.metadata?.circle_tier
    if (t === "bronze" || t === "silver" || t === "gold") out[t] = g.id
  }
  if (!out.bronze || !out.silver || !out.gold) {
    throw new Error("Circle customer groups not set up (run lss-circle-setup)")
  }
  return out as Record<PaidTier, string>
}

function isPaid(o: Record<string, any>): boolean {
  if (o.status === "canceled") return false
  const pcs = (o.payment_collections ?? []) as Array<Record<string, any>>
  let captured = 0
  let refunded = 0
  let completed = false
  for (const pc of pcs) {
    if (!pc) continue
    captured += Number(pc.captured_amount ?? 0)
    refunded += Number(pc.refunded_amount ?? 0)
    if (pc.status === "completed" || pc.status === "partially_captured") completed = true
  }
  if (captured > 0 && refunded >= captured) return false // fully refunded
  return completed || captured > 0
}

// Paid orders of an ACCOUNT customer. Guests → 0.
export async function paidOrderCount(
  container: MedusaContainer,
  customerId: string,
  excludeOrderId?: string
): Promise<number> {
  const { data: cust } = await q(container).graph({
    entity: "customer",
    fields: ["id", "has_account"],
    filters: { id: customerId },
  })
  if (!cust?.[0]?.has_account) return 0
  const { data } = await q(container).graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "payment_collections.status",
      "payment_collections.captured_amount",
      "payment_collections.refunded_amount",
    ],
    filters: { customer_id: customerId },
  })
  return (data ?? []).filter((o) => o.id !== excludeOrderId && isPaid(o)).length
}

export async function circleLive(container: MedusaContainer): Promise<boolean> {
  const promos: any = container.resolve(Modules.PROMOTION)
  const list = await promos.listPromotions({ code: Object.values(CIRCLE_PROMO_CODES) }, { take: 10 })
  return (list ?? []).length === 3 && list.every((p: any) => p.status === "active")
}

// Products that get the Circle discount (from the CIRCLE-BRONZE promotion's
// product list, which the admin can edit like WELCOME5's).
export async function circleEligibleProductIds(container: MedusaContainer): Promise<string[]> {
  const promos: any = container.resolve(Modules.PROMOTION)
  const [p] = await promos.listPromotions(
    { code: [CIRCLE_PROMO_CODES.bronze] },
    { relations: ["application_method", "application_method.target_rules", "application_method.target_rules.values"], take: 1 }
  )
  const rule = (p?.application_method?.target_rules ?? []).find((r: any) => r.attribute === "items.product.id")
  return ((rule?.values ?? []) as any[]).map((v) => (typeof v === "string" ? v : v.value))
}

// Current Circle tier from group membership (what checkout actually uses).
export async function groupTierOf(container: MedusaContainer, customerId: string): Promise<CircleTier> {
  const groups = await circleGroups(container)
  const { data } = await q(container).graph({
    entity: "customer",
    fields: ["id", "groups.id"],
    filters: { id: customerId },
  })
  const ids = new Set(((data?.[0]?.groups ?? []) as any[]).map((g) => g.id))
  for (const t of ["gold", "silver", "bronze"] as PaidTier[]) if (ids.has(groups[t])) return t
  return "basic"
}

// Puts the customer in exactly the right Circle group (or none).
export async function syncCustomerTier(container: MedusaContainer, customerId: string): Promise<{ tier: CircleTier; changed: boolean }> {
  const groups = await circleGroups(container)
  const count = await paidOrderCount(container, customerId)
  const tier = tierForCount(count)
  const { data } = await q(container).graph({
    entity: "customer",
    fields: ["id", "groups.id"],
    filters: { id: customerId },
  })
  if (!data?.[0]) return { tier: "basic", changed: false }
  const current = new Set(((data[0].groups ?? []) as any[]).map((g) => g.id))
  const customers: any = container.resolve(Modules.CUSTOMER)
  let changed = false
  for (const t of PAID_TIERS) {
    const gid = groups[t]
    const should = tier === t
    if (should && !current.has(gid)) {
      await customers.addCustomerToGroup({ customer_id: customerId, customer_group_id: gid })
      changed = true
    } else if (!should && current.has(gid)) {
      await customers.removeCustomerFromGroup({ customer_id: customerId, customer_group_id: gid })
      changed = true
    }
  }
  return { tier, changed }
}

// Every customer who has an order or is currently in a Circle group.
export async function syncAllTiers(container: MedusaContainer): Promise<{ checked: number; changed: number }> {
  const groups = await circleGroups(container)
  const ids = new Set<string>()
  const { data: orders } = await q(container).graph({ entity: "order", fields: ["id", "customer_id"] })
  for (const o of orders ?? []) if (o.customer_id) ids.add(o.customer_id)
  const { data: gs } = await q(container).graph({
    entity: "customer_group",
    fields: ["id", "customers.id"],
    filters: { id: Object.values(groups) },
  })
  for (const g of gs ?? []) for (const c of g.customers ?? []) if (c?.id) ids.add(c.id)
  let changed = 0
  for (const id of ids) {
    const r = await syncCustomerTier(container, id)
    if (r.changed) changed++
  }
  return { checked: ids.size, changed }
}

export type CircleNote = { tier: PaidTier; gift: string; sample: boolean; note: string }

// What staff must add to the box for this order. Based on the tier the
// customer had BEFORE this order ("rewards apply from your next order").
export async function circleNoteForOrder(container: MedusaContainer, orderId: string): Promise<CircleNote | null> {
  const { data } = await q(container).graph({
    entity: "order",
    fields: ["id", "customer_id", "shipping_address.country_code"],
    filters: { id: orderId },
  })
  const o = data?.[0]
  if (!o?.customer_id) return null
  const prev = await paidOrderCount(container, o.customer_id, orderId)
  const tier = tierForCount(prev)
  if (tier === "basic") return null
  const thailand = String(o.shipping_address?.country_code ?? "").toLowerCase() === "th"
  const gift = thailand ? (tier === "bronze" ? "BAC water 3ml" : "BAC water 10ml") : "free shipping abroad (no water)"
  // Gold: the 3rd, 6th, 9th … order placed as Gold gets a sample vial.
  const nthAsGold = prev - CIRCLE_TIERS.gold.orders + 1
  const sample = tier === "gold" && nthAsGold > 0 && nthAsGold % GOLD_SAMPLE_EVERY === 0
  let note = `Circle ${tierLabel(tier)}: ${thailand ? "add " : ""}${gift}`
  if (sample) note += ` + add 1 sample vial (staff choice, up to ${SAMPLE_VALUE_CAP})`
  return { tier, gift, sample, note }
}
