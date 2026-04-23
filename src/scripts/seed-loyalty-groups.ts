import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  PromotionType,
  PromotionStatus,
  PromotionRuleOperator,
  ApplicationMethodType,
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
} from "@medusajs/framework/utils"
import {
  createCustomerGroupsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Idempotent seed: 4 loyalty tier customer groups + 3 automatic percentage
 * promotions bound to the non-basic tier groups. Re-run safely.
 *
 *   npx medusa exec ./src/scripts/seed-loyalty-groups.ts
 */

const TIER_GROUPS = [
  { name: "Tier Basic", handle: "tier-basic", discountPct: 0 },
  { name: "Tier Bronze", handle: "tier-bronze", discountPct: 5 },
  { name: "Tier Silver", handle: "tier-silver", discountPct: 10 },
  { name: "Tier Gold", handle: "tier-gold", discountPct: 20 },
]

export default async function seedLoyaltyGroups({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const groupIdByHandle: Record<string, string> = {}

  for (const g of TIER_GROUPS) {
    const { data } = await query.graph({
      entity: "customer_group",
      fields: ["id", "name"],
      filters: { name: g.name },
    })
    if (data.length > 0) {
      groupIdByHandle[g.handle] = data[0].id as string
      logger.info(`[seed-loyalty-groups] group "${g.name}" exists (${data[0].id})`)
      continue
    }
    const { result } = await createCustomerGroupsWorkflow(container).run({
      input: {
        customersData: [
          {
            name: g.name,
            metadata: { handle: g.handle, tier: g.handle.replace("tier-", "") },
          },
        ],
      },
    })
    groupIdByHandle[g.handle] = result[0].id
    logger.info(`[seed-loyalty-groups] created group "${g.name}" (${result[0].id})`)
  }

  for (const g of TIER_GROUPS) {
    if (g.discountPct === 0) continue

    const promoCode = `AUTO_${g.handle.toUpperCase().replace("-", "_")}`

    const { data: existing } = await query.graph({
      entity: "promotion",
      fields: ["id", "code"],
      filters: { code: promoCode },
    })
    if (existing.length > 0) {
      logger.info(`[seed-loyalty-groups] promotion "${promoCode}" exists`)
      continue
    }

    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            code: promoCode,
            type: PromotionType.STANDARD,
            is_automatic: true,
            status: PromotionStatus.ACTIVE,
            rules: [
              {
                attribute: "customer.groups.id",
                operator: PromotionRuleOperator.IN,
                values: [groupIdByHandle[g.handle]],
              },
            ],
            application_method: {
              type: ApplicationMethodType.PERCENTAGE,
              value: g.discountPct,
              currency_code: "usd",
              allocation: ApplicationMethodAllocation.ACROSS,
              target_type: ApplicationMethodTargetType.ITEMS,
            },
          },
        ],
      },
    })
    logger.info(
      `[seed-loyalty-groups] created auto-promotion "${promoCode}" (${g.discountPct}%)`,
    )
  }

  logger.info("[seed-loyalty-groups] done")
}
