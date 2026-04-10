import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Create a Thailand region (currency: THB) if one doesn't already exist.
 * Idempotent — re-running prints the existing region ID and exits.
 *
 *   npx medusa exec ./src/scripts/create-thb-region.ts
 *
 * After running, add the printed region ID to the storefront .env as
 * MEDUSA_REGION_ID_TH so the data layer can select the right region per locale.
 */

export default async function createThbRegion({ container }: ExecArgs) {
  const regionModuleService = container.resolve(Modules.REGION)

  const existing = await regionModuleService.listRegions({
    currency_code: "thb",
  })

  if (existing.length > 0) {
    console.log(`[create-thb-region] already exists: ${existing[0].id}`)
    console.log(
      `[create-thb-region] add this to storefront .env: MEDUSA_REGION_ID_TH=${existing[0].id}`
    )
    return
  }

  // Deliberately no countries — the "th" country is already assigned to the
  // default International region, and reassigning it would change checkout
  // routing. This Thailand region is used purely as a THB pricing context
  // that the storefront picks when the locale is Thai.
  const created = await regionModuleService.createRegions({
    name: "Thailand (THB pricing)",
    currency_code: "thb",
  })

  const region = Array.isArray(created) ? created[0] : created

  console.log(`[create-thb-region] created: ${region.id}`)
  console.log(
    `[create-thb-region] add this to storefront .env: MEDUSA_REGION_ID_TH=${region.id}`
  )
}
