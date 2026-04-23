import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../modules/loyalty"
import { recomputeTierForCustomer } from "../modules/loyalty/helpers"
import { TIER_THRESHOLDS } from "../modules/loyalty/service"
import type LoyaltyModuleService from "../modules/loyalty/service"

/**
 * One-off: bump a customer's loyalty balance to the threshold for a target
 * tier. Useful for QA / test accounts.
 *
 *   TIER_EMAIL=rafalmolda@gmail.com TIER_TARGET=silver \
 *     npx medusa exec ./src/scripts/set-customer-tier.ts
 */
export default async function setCustomerTier({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const email = process.env.TIER_EMAIL
  const target = (process.env.TIER_TARGET || "silver") as
    | "bronze"
    | "silver"
    | "gold"

  if (!email) {
    logger.error("TIER_EMAIL env var required")
    return
  }
  const threshold = TIER_THRESHOLDS[target]
  if (!threshold) {
    logger.error(`TIER_TARGET must be bronze/silver/gold, got ${target}`)
    return
  }

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { email },
  })
  if (customers.length === 0) {
    logger.error(`No customer with email ${email}`)
    return
  }
  const customer = customers[0] as { id: string; email: string }

  const service = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE)

  // Clear any prior manual_adjust rows for this tier-set op to keep it idempotent.
  const existing = await service.listLoyaltyLedgers({
    customer_id: customer.id,
    reason: "manual_adjust",
  })
  const currentRolling = existing.reduce(
    (s, r) => s + (r.delta || 0),
    0,
  )
  const needed = threshold - currentRolling
  if (needed > 0) {
    await service.createLoyaltyLedgers({
      customer_id: customer.id,
      delta: needed,
      reason: "manual_adjust",
      order_id: null,
      currency: null,
      note: `QA: bump to ${target}`,
    })
    logger.info(
      `[set-tier] inserted +${needed} for ${email} to reach ${target}`,
    )
  } else {
    logger.info(`[set-tier] ${email} already has ${currentRolling} points`)
  }

  await recomputeTierForCustomer(container, customer.id)
  logger.info(`[set-tier] recomputed tier for ${email}`)
}
