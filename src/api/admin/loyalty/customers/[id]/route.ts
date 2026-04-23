import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getTierInfoForCustomer,
  recomputeTierForCustomer,
} from "../../../../../modules/loyalty/helpers"
import { LOYALTY_MODULE } from "../../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../../modules/loyalty/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = (req.params as { id: string }).id
  try {
    const info = await getTierInfoForCustomer(req.scope, customerId)
    const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
    const ledger = await service.listLoyaltyLedgers(
      { customer_id: customerId },
      { order: { created_at: "DESC" }, take: 200 },
    )
    res.json({ loyalty: info, ledger })
  } catch (e) {
    logger.error(
      "[admin/loyalty] get failed: " + (e instanceof Error ? e.message : String(e)),
    )
    res.status(500).json({ error: "Failed to load loyalty info" })
  }
}

type AdjustBody = {
  delta: number
  reason?: string
  note?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = (req.params as { id: string }).id
  const body = req.body as AdjustBody
  const delta = Number(body?.delta)
  if (!Number.isFinite(delta) || delta === 0) {
    res.status(400).json({ error: "delta must be a non-zero number" })
    return
  }
  try {
    const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
    await service.createLoyaltyLedgers({
      customer_id: customerId,
      delta: Math.round(delta),
      reason: body.reason?.trim() || "manual_adjust",
      order_id: null,
      currency: null,
      note: body.note?.trim() || null,
    })
    await recomputeTierForCustomer(req.scope, customerId)
    const info = await getTierInfoForCustomer(req.scope, customerId)
    res.json({ loyalty: info })
  } catch (e) {
    logger.error(
      "[admin/loyalty] adjust failed: " + (e instanceof Error ? e.message : String(e)),
    )
    res.status(500).json({ error: "Failed to adjust balance" })
  }
}
