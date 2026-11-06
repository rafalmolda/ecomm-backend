// Middleware for POST /store/carts/:id/complete (added 2026-11-06).
//
// pp_system_default authorises every payment session, so without this guard
// anyone with the public publishable key could create a payment session and
// complete a cart into an order WITHOUT paying. This guard only lets the
// request through when:
//   - the cart is already completed (Medusa then returns the existing order
//     — keeps the storefront's follow-up /complete idempotent), or
//   - a paid marker (utils/paypal-paid.ts) exists and matches the cart's
//     CURRENT total + currency, or
//   - the request carries a valid x-lss-key (LSS_INTERNAL_KEY) header —
//     for manual recovery of a paid orphan cart only. Never from a browser.
//
// The PayPal webhook calls completeCartWorkflow directly (not over HTTP), so
// it does its own amount check and is not affected by this middleware.

import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "crypto"
import { getPaidMarker, loadPaymentCart, markerMatchesCart } from "./paypal-paid"

function internalKeyOk(given: unknown): boolean {
  const key = process.env.LSS_INTERNAL_KEY || ""
  const g = typeof given === "string" ? given : ""
  if (!key || g.length !== key.length) return false
  return timingSafeEqual(Buffer.from(g), Buffer.from(key))
}

export async function requirePaidCart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const cartId = String((req.params as Record<string, string>)?.id ?? "")
  try {
    if (internalKeyOk(req.headers["x-lss-key"])) {
      console.warn(`[require-paid-cart] internal-key bypass for cart=${cartId}`)
      return next()
    }
    const cart = cartId ? await loadPaymentCart(req.scope, cartId) : null
    // Unknown cart: let Medusa return its own 404.
    if (!cart || cart.completed_at) return next()

    const marker = await getPaidMarker(cartId)
    if (!marker) {
      res.status(402).json({ type: "payment_required", message: "Payment is required to complete this order." })
      return
    }
    if (!markerMatchesCart(marker, cart)) {
      console.error(
        `[require-paid-cart] PAID MARKER MISMATCH cart=${cartId} paypal_order=${marker.paypal_order_id} ` +
          `paid=${marker.cart_total} ${marker.cart_currency} cart=${cart.total} ${cart.currency_code}`
      )
      res.status(402).json({ type: "cart_changed", message: "Your cart changed after payment. Please contact support." })
      return
    }
    return next()
  } catch (e) {
    // Fail closed: if Redis/DB is down we must not mint unpaid orders.
    console.error(`[require-paid-cart] check failed cart=${cartId}: ${(e as Error).message}`)
    res.status(503).json({ type: "unavailable", message: "Payment check unavailable, please retry." })
  }
}
