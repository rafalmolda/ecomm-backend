import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deletePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../../../modules/affiliate"
import type AffiliateModuleService from "../../../../modules/affiliate/service"

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const affiliateService = req.scope.resolve<AffiliateModuleService>(
    AFFILIATE_MODULE
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // 1. Load the partner so we can find its promotion code.
    const [partner] = await affiliateService.listAffiliatePartners({ id })
    if (!partner) {
      res.status(404).json({ error: "Affiliate not found" })
      return
    }

    // 2. Find the Medusa promotion that carries this code and delete it.
    const { data: promos } = await query.graph({
      entity: "promotion",
      fields: ["id", "code"],
    })
    const promo = promos.find(
      (p: Record<string, unknown>) =>
        (p.code as string)?.toUpperCase() ===
        (partner.promotion_code as string).toUpperCase()
    )
    if (promo?.id) {
      await deletePromotionsWorkflow(req.scope).run({
        input: { ids: [promo.id as string] },
      })
    }

    // 3. Delete the partner row.
    await affiliateService.deleteAffiliatePartners([id])

    res.status(200).json({ id, deleted: true })
  } catch (e) {
    logger.error(
      "[affiliates] delete failed: " + (e instanceof Error ? e.message : String(e))
    )
    res.status(500).json({ error: "Failed to delete affiliate" })
  }
}
