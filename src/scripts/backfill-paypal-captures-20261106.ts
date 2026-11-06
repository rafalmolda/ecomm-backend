import { ExecArgs } from "@medusajs/framework/types"
import { recordPaypalCapture } from "../utils/paypal-capture"

/**
 * 2026-11-06: mark orders as captured (paid) whose PayPal capture was
 * verified COMPLETED with the matching amount via the PayPal webhook-events
 * API. Only add entries here after that check.
 *   #18  DE  EUR 36.00  capture 286584179N172313N
 *   #19  FR  EUR 27.00  capture 8DV148130U630052H
 * Idempotent: recordPaypalCapture skips payments that are already captured.
 */
const VERIFIED_CAPTURES: { cartId: string; paypalCaptureId: string }[] = [
  { cartId: "cart_01M4DD475HC08XPEMXFHKZGWJF", paypalCaptureId: "286584179N172313N" },
  { cartId: "cart_01M4DPNZM5N2RMQTWXVJTA2TG6", paypalCaptureId: "8DV148130U630052H" },
]

export default async function backfillPaypalCaptures({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  for (const entry of VERIFIED_CAPTURES) {
    try {
      const result = await recordPaypalCapture(container, {
        cartId: entry.cartId,
        paypalOrderId: null,
        paypalCaptureId: entry.paypalCaptureId,
      })
      logger.info(`[backfill-paypal] ${entry.cartId} -> ${JSON.stringify(result)}`)
    } catch (e) {
      logger.error(`[backfill-paypal] ${entry.cartId} failed: ${(e as Error).message}`)
    }
  }
}
