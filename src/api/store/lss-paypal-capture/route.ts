import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "crypto"
import { getPaidMarker } from "../../../utils/paypal-paid"
import { recordPaypalCapture } from "../../../utils/paypal-capture"

// POST /store/lss-paypal-capture  (header x-lss-key required — internal only)
// Body: { cart_id, paypal_order_id, capture_id }
// Called by the storefront's /api/paypal/capture-order after the cart became
// an order. Marks the Medusa payment CAPTURED and stores the PayPal ids on
// order.metadata. Requires the paid marker for the cart, and the PayPal
// order id must equal the one in the marker. Idempotent.

function keyOk(given: unknown): boolean {
  const key = process.env.LSS_INTERNAL_KEY || ""
  const g = typeof given === "string" ? given : ""
  if (!key || g.length !== key.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(key))
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!keyOk(req.headers["x-lss-key"])) {
    res.status(401).json({ message: "unauthorized" })
    return
  }
  const body = (req.body ?? {}) as Record<string, unknown>
  const cartId = String(body.cart_id ?? "")
  const paypalOrderId = String(body.paypal_order_id ?? "")
  const captureId = body.capture_id == null ? null : String(body.capture_id)
  if (!ID_RE.test(cartId) || !ID_RE.test(paypalOrderId) || (captureId && !ID_RE.test(captureId))) {
    res.status(400).json({ message: "cart_id and paypal_order_id required" })
    return
  }
  try {
    const marker = await getPaidMarker(cartId)
    if (!marker || marker.paypal_order_id !== paypalOrderId) {
      res.status(409).json({ message: "no matching paid marker" })
      return
    }
    const result = await recordPaypalCapture(req.scope, {
      cartId,
      paypalOrderId,
      paypalCaptureId: captureId ?? marker.capture_id,
    })
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error(`[lss-paypal-capture] failed cart=${cartId}: ${(e as Error).message}`)
    res.status(500).json({ message: "capture record failed" })
  }
}
