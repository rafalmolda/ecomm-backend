import { defineMiddlewares } from "@medusajs/medusa"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { guardAddPromotion, guardCartUpdate } from "../utils/promo-rules"

const STORE_URL = process.env.STORE_URL || "https://lifespansupply.com"

function googleCallbackRedirect(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Intercept the JSON response and redirect to storefront with token
  const originalJson = res.json.bind(res)
  res.json = (body: Record<string, unknown>) => {
    if (body?.token && req.path.includes("/callback")) {
      res.redirect(`${STORE_URL}/auth/google/callback?token=${body.token}`)
      return res
    }
    return originalJson(body)
  }
  next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/auth/customer/google/callback",
      middlewares: [googleCallbackRedirect],
    },
    {
      // One code per order + first-order-only codes (see utils/promo-rules.ts)
      matcher: "/store/carts/:id/promotions",
      method: ["POST"],
      middlewares: [guardAddPromotion],
    },
    {
      matcher: "/store/carts/:id",
      method: ["POST"],
      middlewares: [guardCartUpdate],
    },
  ],
})
