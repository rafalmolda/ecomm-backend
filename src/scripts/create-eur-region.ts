import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Create a Europe region (currency: EUR) if one doesn't already exist.
 * Idempotent — re-running prints the existing region ID and exits.
 *
 *   npx medusa exec ./src/scripts/create-eur-region.ts
 *
 * After running, add the printed region ID to the storefront .env as
 * MEDUSA_REGION_ID_EUR so the data layer can select the right region per locale.
 */

export default async function createEurRegion({ container }: ExecArgs) {
  const regionModuleService = container.resolve(Modules.REGION)

  const existing = await regionModuleService.listRegions({
    currency_code: "eur",
  })

  if (existing.length > 0) {
    console.log(`[create-eur-region] already exists: ${existing[0].id}`)
    console.log(
      `[create-eur-region] add this to storefront .env: MEDUSA_REGION_ID_EUR=${existing[0].id}`
    )
    return
  }

  const created = await regionModuleService.createRegions({
    name: "Europe (EUR pricing)",
    currency_code: "eur",
  })

  const region = Array.isArray(created) ? created[0] : created

  console.log(`[create-eur-region] created: ${region.id}`)
  console.log(
    `[create-eur-region] add this to storefront .env: MEDUSA_REGION_ID_EUR=${region.id}`
  )
}
