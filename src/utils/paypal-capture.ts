// Record a settled PayPal capture on the Medusa side (added 2026-11-06).
//
// pp_system_default only AUTHORISES, so every PayPal order used to sit as
// "authorized" in admin forever and nothing linked a Medusa order to its
// PayPal transaction. recordPaypalCapture():
//   1. finds the order (by order id, or by cart id via the order↔cart link),
//   2. runs capturePaymentWorkflow for every payment not yet captured
//      (captured_at set → skipped, so it is idempotent),
//   3. merges paypal_order_id / paypal_capture_id into order.metadata.
//
// Callers: the PayPal webhook, the internal route
// /store/lss-paypal-capture (storefront capture-order), and backfill scripts
// (`medusa exec`) for old orders — pass orderId + the PayPal ids from the
// PayPal dashboard. ONLY call it for orders whose PayPal capture you have
// verified as COMPLETED with the right amount.

import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"

export interface RecordPaypalCaptureInput {
  orderId?: string
  cartId?: string
  paypalOrderId?: string | null
  paypalCaptureId?: string | null
}

export interface RecordPaypalCaptureResult {
  orderId: string
  captured: string[] // payment ids captured by this call
  alreadyCaptured: string[] // payment ids that were captured before
  metadataUpdated: boolean
}

type GraphQuery = {
  graph: (args: Record<string, unknown>) => Promise<{ data: Array<Record<string, any>> }>
}

async function resolveOrderId(query: GraphQuery, input: RecordPaypalCaptureInput): Promise<string> {
  if (input.orderId) return input.orderId
  if (!input.cartId) throw new Error("recordPaypalCapture: orderId or cartId required")
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "order.id"],
    filters: { id: input.cartId },
  })
  const orderId = data?.[0]?.order?.id
  if (!orderId) throw new Error(`recordPaypalCapture: cart ${input.cartId} has no order`)
  return String(orderId)
}

async function loadOrder(query: GraphQuery, orderId: string) {
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "metadata",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.canceled_at",
    ],
    filters: { id: orderId },
  })
  const order = data?.[0]
  if (!order) throw new Error(`recordPaypalCapture: order ${orderId} not found`)
  return order
}

function paypalMetadata(
  existing: Record<string, unknown> | null | undefined,
  input: RecordPaypalCaptureInput
): Record<string, unknown> | null {
  const base = existing ?? {}
  const additions: Record<string, unknown> = {}
  if (input.paypalOrderId && base.paypal_order_id !== input.paypalOrderId) {
    additions.paypal_order_id = input.paypalOrderId
  }
  if (input.paypalCaptureId && base.paypal_capture_id !== input.paypalCaptureId) {
    additions.paypal_capture_id = input.paypalCaptureId
  }
  if (Object.keys(additions).length === 0) return null
  return { ...base, ...additions }
}

export async function recordPaypalCapture(
  container: MedusaContainer,
  input: RecordPaypalCaptureInput
): Promise<RecordPaypalCaptureResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as GraphQuery
  const orderId = await resolveOrderId(query, input)
  const order = await loadOrder(query, orderId)

  const payments: Array<Record<string, any>> = (order.payment_collections ?? []).flatMap(
    (pc: Record<string, any>) => pc?.payments ?? []
  )
  const alreadyCaptured = payments.filter((p) => p.captured_at).map((p) => String(p.id))
  const toCapture = payments.filter((p) => !p.captured_at && !p.canceled_at)

  const captured: string[] = []
  for (const p of toCapture) {
    // Full amount (no `amount`) — the order total is what PayPal captured.
    await capturePaymentWorkflow(container).run({
      input: { payment_id: String(p.id), captured_by: "paypal" },
    })
    captured.push(String(p.id))
  }

  const metadata = paypalMetadata(order.metadata, input)
  if (metadata) {
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderModule.updateOrders([{ id: orderId, metadata }])
  }

  return { orderId, captured, alreadyCaptured, metadataUpdated: Boolean(metadata) }
}
