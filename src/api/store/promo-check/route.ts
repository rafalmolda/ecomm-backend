import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkCart } from "../../../utils/promo-rules"

// GET /store/promo-check?cart_id=... → { ok: true } or
// { ok: false, code, message }. Called by the storefront right before it
// creates the PayPal payment (see src/app/api/paypal/create-order).
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const cartId = String((req.query as Record<string, unknown>)?.cart_id ?? "")
  if (!cartId) {
    res.status(400).json({ ok: false, message: "cart_id required" })
    return
  }
  try {
    res.json(await checkCart(req.scope, cartId))
  } catch (e) {
    console.error("[promo-check] failed, allowing", e)
    res.json({ ok: true, degraded: true })
  }
}
