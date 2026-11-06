import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Sends the customer password-reset email. Medusa emits auth.password_reset
// with { entity_id: <email>, actor_type, token } after
// POST /auth/customer/emailpass/reset-password. The storefront route builds
// the reset link from a fixed base URL + token (never from caller input).
const STOREFRONT_INTERNAL_URL = process.env.STOREFRONT_INTERNAL_URL || "http://127.0.0.1:3004"
const REQUEST_TIMEOUT_MS = 10_000

type PasswordResetEvent = { entity_id: string; actor_type: string; token: string }

export default async function passwordReset({ event, container }: SubscriberArgs<PasswordResetEvent>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { entity_id: email, actor_type: actorType, token } = event.data ?? ({} as PasswordResetEvent)
  if (actorType !== "customer" || !email || !token) return

  const key = process.env.LSS_INTERNAL_KEY
  if (!key) {
    logger.error("[password-reset] LSS_INTERNAL_KEY is not set — reset email not sent")
    return
  }
  try {
    const res = await fetch(`${STOREFRONT_INTERNAL_URL}/api/emails/password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lss-key": key },
      body: JSON.stringify({ email, token }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) logger.error(`[password-reset] storefront email route returned ${res.status}`)
  } catch (e) {
    logger.error("[password-reset] send failed: " + (e instanceof Error ? e.message : String(e)))
  }
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
