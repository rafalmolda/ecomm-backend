import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { syncAllTiers } from "../utils/circle"

// Hourly: recount paid account orders and fix Circle group membership.
// Catches orders that were marked paid in the admin after they were placed.
export default async function circleTierSync(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const r = await syncAllTiers(container)
    logger.info(`[circle] tier sync: checked ${r.checked}, changed ${r.changed}`)
  } catch (e) {
    logger.error("[circle] tier sync failed: " + (e instanceof Error ? e.message : String(e)))
  }
}

export const config = {
  name: "circle-tier-sync",
  schedule: "7 * * * *",
}
