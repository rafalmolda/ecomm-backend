import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getTierInfoForCustomer } from "../../../../../modules/loyalty/helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = req.auth_context?.actor_id
  if (!customerId || req.auth_context?.actor_type !== "customer") {
    res.status(401).json({ error: "Not authenticated" })
    return
  }
  try {
    const info = await getTierInfoForCustomer(req.scope, customerId)
    res.json({ loyalty: info })
  } catch (e) {
    logger.error(
      "[store/loyalty] failed: " + (e instanceof Error ? e.message : String(e)),
    )
    res.status(500).json({ error: "Failed to load loyalty info" })
  }
}
