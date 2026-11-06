import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { recordPaypalCapture } from "../../../utils/paypal-capture"
import {
  loadPaymentCart,
  paypalAmountMatchesCart,
  setPaidMarker,
} from "../../../utils/paypal-paid"

/**
 * PayPal webhook — third and final line of defence against paid-but-orphaned
 * orders (see also the storefront's server-side completion in
 * /api/paypal/capture-order). If the capture route itself crashes AFTER
 * PayPal has settled funds, this webhook still guarantees a Medusa order gets
 * created for the paid cart.
 *
 * Flow: PayPal fires PAYMENT.CAPTURE.COMPLETED → we verify the signature →
 * read the cart id (we mirror it into the order's `custom_id` in
 * create-order) → if that cart isn't already an order, check that the
 * captured amount equals the cart's CURRENT total (same conversion as the
 * storefront) → write the paid marker (utils/paypal-paid.ts) → complete it.
 * A mismatch is logged and NOT completed (cheap-cart → expensive-cart swap).
 *
 * Setup (one-time, PayPal dashboard):
 *   1. Developer Dashboard → your live app → Webhooks → Add webhook
 *      URL: https://api.lifespansupply.com/webhooks/paypal
 *      Event: "Payment capture completed" (PAYMENT.CAPTURE.COMPLETED)
 *   2. Copy the generated Webhook ID into backend .env as PAYPAL_WEBHOOK_ID
 *   3. Restart: systemctl restart medusa-backend
 */

const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com"

async function paypalToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID/SECRET not set")
  const basic = Buffer.from(`${id}:${secret}`).toString("base64")
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  if (!res.ok) throw new Error(`PayPal OAuth ${res.status}`)
  return (await res.json()).access_token
}

// Verify the notification really came from PayPal. Unlike Stripe, PayPal's
// verification is a server-side API call that takes the parsed event, so we
// don't need the raw request body.
async function verifySignature(
  req: MedusaRequest,
  webhookId: string,
): Promise<boolean> {
  const h = (name: string) =>
    (req.headers[name] as string | undefined) ?? ""
  const token = await paypalToken()
  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: req.body,
      }),
    },
  )
  if (!res.ok) return false
  const out = (await res.json()) as { verification_status?: string }
  return out.verification_status === "SUCCESS"
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const webhookId = process.env.PAYPAL_WEBHOOK_ID

  // Never act on an unverifiable notification — a forged
  // PAYMENT.CAPTURE.COMPLETED would otherwise let anyone mint free orders.
  if (!webhookId) {
    logger.warn("[paypal-webhook] PAYPAL_WEBHOOK_ID not set — ignoring event")
    return res.status(503).json({ error: "webhook not configured" })
  }

  const event = req.body as {
    event_type?: string
    resource?: {
      id?: string
      status?: string
      amount?: { currency_code?: string; value?: string }
      custom_id?: string
      supplementary_data?: { related_ids?: { order_id?: string } }
    }
  }

  try {
    const verified = await verifySignature(req, webhookId)
    if (!verified) {
      logger.warn("[paypal-webhook] signature verification FAILED")
      return res.status(401).json({ error: "invalid signature" })
    }
  } catch (e) {
    logger.error(`[paypal-webhook] verify error: ${(e as Error).message}`)
    // 500 → PayPal retries later, which is what we want on a transient error.
    return res.status(500).json({ error: "verify failed" })
  }

  // We only care about settled captures. Ack everything else so PayPal stops
  // retrying.
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return res.status(200).json({ ok: true, ignored: event.event_type })
  }

  const cartId =
    event.resource?.custom_id ||
    // Older orders (pre-custom_id) won't carry it; fall back to fetching the
    // order behind the capture to read reference_id.
    (await cartIdFromOrder(
      event.resource?.supplementary_data?.related_ids?.order_id,
    ))

  if (!cartId) {
    logger.warn(
      `[paypal-webhook] capture ${event.resource?.id} has no cart id — skipping`,
    )
    return res.status(200).json({ ok: true, note: "no cart id" })
  }

  const paypalOrderId =
    event.resource?.supplementary_data?.related_ids?.order_id ?? null
  const captureId = event.resource?.id ?? null

  try {
    const cart = await loadPaymentCart(req.scope, cartId)
    if (!cart) {
      logger.warn(`[paypal-webhook] cart ${cartId} not found — skipping`)
      return res.status(200).json({ ok: true, note: "cart not found" })
    }

    // The captured amount must equal what the cart costs. A retry can't fix
    // a mismatch, so ack with 200 and leave it for a human (refund).
    if (
      event.resource?.status !== "COMPLETED" ||
      !paypalAmountMatchesCart(event.resource?.amount, cart.total, cart.currency_code)
    ) {
      logger.error(
        `[paypal-webhook] PAID AMOUNT MISMATCH — NOT COMPLETING cart=${cartId} ` +
          `capture=${captureId} status=${event.resource?.status} ` +
          `captured=${JSON.stringify(event.resource?.amount)} ` +
          `cart=${cart.total} ${cart.currency_code}`
      )
      return res.status(200).json({ ok: true, note: "amount mismatch" })
    }

    // Not yet an order (the capture route crashed / lost the race) → write
    // the paid marker and complete. Already an order → only record capture.
    if (!cart.completed_at) {
      await setPaidMarker(cartId, {
        paypal_order_id: paypalOrderId ?? "",
        capture_id: captureId,
        cart_total: cart.total,
        cart_currency: cart.currency_code.toLowerCase(),
        charge_value: String(event.resource?.amount?.value ?? ""),
        charge_currency: String(event.resource?.amount?.currency_code ?? ""),
        source: "webhook",
        at: new Date().toISOString(),
      })
      await completeCartWorkflow(req.scope).run({ input: { id: cartId } })
      logger.info(`[paypal-webhook] RECOVERED order for cart ${cartId}`)
    }

    // Mark the Medusa payment CAPTURED + store PayPal ids (idempotent). A
    // failure returns 500 → PayPal retries → this branch runs again.
    const rec = await recordPaypalCapture(req.scope, {
      cartId,
      paypalOrderId,
      paypalCaptureId: captureId,
    })
    logger.info(
      `[paypal-webhook] capture recorded cart=${cartId} order=${rec.orderId} ` +
        `captured=${rec.captured.length} already=${rec.alreadyCaptured.length}`
    )
    return res.status(200).json({ ok: true, order_id: rec.orderId })
  } catch (e) {
    logger.error(
      `[paypal-webhook] completion/capture failed cart=${cartId}: ${(e as Error).message}`,
    )
    // 500 so PayPal retries — a transient DB/Redis blip shouldn't drop the order.
    return res.status(500).json({ error: "completion failed" })
  }
}

// Fallback for captures without custom_id: fetch the PayPal order to read the
// reference_id we set on the purchase unit.
async function cartIdFromOrder(
  orderId: string | undefined,
): Promise<string | null> {
  if (!orderId) return null
  try {
    const token = await paypalToken()
    const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const o = (await res.json()) as {
      purchase_units?: Array<{ reference_id?: string; custom_id?: string }>
    }
    const u = o.purchase_units?.[0]
    return u?.custom_id || u?.reference_id || null
  } catch {
    return null
  }
}
