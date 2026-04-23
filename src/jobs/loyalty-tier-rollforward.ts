import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recomputeTierForCustomer } from "../modules/loyalty/helpers"

/**
 * Daily: re-evaluate tier for every customer with any loyalty ledger history.
 * Handles the rolling-365d window — old earn rows age out and can drop a
 * customer's rolling total below their current tier threshold. The sticky
 * downgrade grace (±50 pts) lives inside recomputeTierForCustomer.
 */
export default async function loyaltyTierRollforwardJob(
  container: MedusaContainer,
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rows } = await query.graph({
    entity: "loyalty_ledger",
    fields: ["customer_id"],
  })
  const uniqueIds = Array.from(
    new Set(rows.map((r: { customer_id: string }) => r.customer_id).filter(Boolean)),
  ) as string[]

  let done = 0
  for (const id of uniqueIds) {
    try {
      await recomputeTierForCustomer(container, id)
      done++
    } catch (err) {
      logger.warn(
        `[loyalty-rollforward] failed for customer ${id}: ${(err as Error).message}`,
      )
    }
  }
  logger.info(`[loyalty-rollforward] processed ${done}/${uniqueIds.length} customers`)
}

export const config = {
  name: "loyalty-tier-rollforward",
  schedule: "0 3 * * *",
}
