import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  CIRCLE_TIERS,
  circleEligibleProductIds,
  circleLive,
  groupTierOf,
  nextTierOf,
  paidOrderCount,
} from "../../../../../utils/circle"

// GET /store/customers/me/loyalty — the logged-in customer's LifeSpan Circle
// status (orders-based, 2026-10-28). Keeps the old response shape
// ({ loyalty: TierInfo }) so the storefront keeps working; balance and
// lifetimeRolling now hold the number of paid website orders.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = req.auth_context?.actor_id
  if (!customerId || req.auth_context?.actor_type !== "customer") {
    res.status(401).json({ error: "Not authenticated" })
    return
  }
  try {
    const [live, paidOrders] = await Promise.all([circleLive(req.scope), paidOrderCount(req.scope, customerId)])
    const tier = live ? await groupTierOf(req.scope, customerId) : "basic"
    const next = nextTierOf(tier)
    const target = next ? CIRCLE_TIERS[next].orders : null
    const from = tier === "basic" ? 0 : CIRCLE_TIERS[tier].orders
    const ordersToNext = target === null ? 0 : Math.max(0, target - paidOrders)
    const progressPct =
      target === null ? 100 : Math.max(0, Math.min(100, Math.round(((paidOrders - from) / (target - from)) * 100)))
    res.json({
      loyalty: {
        tier,
        balance: paidOrders,
        lifetimeRolling: paidOrders,
        nextTier: next,
        pointsToNext: ordersToNext,
        progressPct,
        discountPct: tier === "basic" ? 0 : CIRCLE_TIERS[tier].pct,
        paidOrders,
        ordersToNext,
        live,
        eligibleProductIds: live && tier !== "basic" ? await circleEligibleProductIds(req.scope) : [],
      },
    })
  } catch (e) {
    logger.error("[store/loyalty] failed: " + (e instanceof Error ? e.message : String(e)))
    res.status(500).json({ error: "Failed to load loyalty info" })
  }
}
