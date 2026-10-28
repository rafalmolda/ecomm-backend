// Discount-code rules for Lifespan Supply (added 2026-10-28).
//
// 1. One code per order: a cart may hold at most one (non-automatic) code.
// 2. First-order codes (WELCOME5 and personal WELCOME-xxxx codes) only work
//    for an email that has no earlier PAID order.
//
// Why here and in /store/promo-check: PayPal captures the money BEFORE the
// cart is completed, so these rules must be checked when a code is added
// and again right before the PayPal payment is created — never at /complete.

import type { MedusaContainer } from "@medusajs/framework/types"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHmac } from "crypto"

export const FIRST_ORDER_CODES = ["WELCOME5"]
export const FIRST_ORDER_PREFIX = "WELCOME-"

export function isFirstOrderCode(code: string): boolean {
  const c = code.trim().toUpperCase()
  return FIRST_ORDER_CODES.includes(c) || c.startsWith(FIRST_ORDER_PREFIX)
}

export const PROMO_MSG = {
  one_code_only: "Only one discount code can be used per order.",
  first_order_only: "This code is for first orders only.",
  code_email_mismatch: "This code belongs to a different email address.",
  circle_member_no_codes: "LifeSpan Circle members already get their discount automatically, so codes can't be combined with it.",
} as const

// ── Personal welcome codes (WELCOME-XXXXXX) ──────────────────────────────
// The code is a fingerprint of the email: HMAC(LSS_INTERNAL_KEY, email).
// Same email → same code, and we can check "does this code belong to this
// email?" without storing anything. NEVER change LSS_INTERNAL_KEY once codes
// are out, or every issued code stops matching its email.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : ""
}

export function isPersonalCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(FIRST_ORDER_PREFIX)
}

export function personalCodeFor(email: string): string | null {
  const key = process.env.LSS_INTERNAL_KEY || ""
  const e = normalizeEmail(email)
  if (!key || !e) return null
  const digest = createHmac("sha256", key).update(e).digest()
  let out = ""
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length]
  return FIRST_ORDER_PREFIX + out
}

// true = code is a personal code that does NOT belong to this email.
// Unknown (no key configured) → false, i.e. allow.
function personalMismatch(code: string, email: string | null): boolean {
  if (!isPersonalCode(code)) return false
  if (!process.env.LSS_INTERNAL_KEY) return false
  if (!email) return true
  return personalCodeFor(email) !== code.trim().toUpperCase()
}

export type PromoCheck =
  | { ok: true }
  | { ok: false; code: keyof typeof PROMO_MSG; message: string }

type GraphQuery = {
  graph: (args: Record<string, unknown>) => Promise<{ data: Array<Record<string, any>> }>
}

function queryOf(container: MedusaContainer): GraphQuery {
  return container.resolve(ContainerRegistrationKeys.QUERY) as unknown as GraphQuery
}

export async function cartCodes(
  container: MedusaContainer,
  cartId: string
): Promise<{ codes: string[]; email: string | null; circleAuto: boolean }> {
  const { data } = await queryOf(container).graph({
    entity: "cart",
    fields: ["id", "email", "promotions.code", "promotions.is_automatic"],
    filters: { id: cartId },
  })
  const cart = data?.[0]
  const codes = ((cart?.promotions ?? []) as Array<Record<string, any>>)
    .filter((p) => p && p.code && !p.is_automatic)
    .map((p) => String(p.code).toUpperCase())
  // Circle member discount = automatic promotion whose code starts CIRCLE-
  const circleAuto = ((cart?.promotions ?? []) as Array<Record<string, any>>).some(
    (p) => p && p.is_automatic && String(p.code ?? "").toUpperCase().startsWith("CIRCLE-")
  )
  return { codes: Array.from(new Set(codes)), email: (cart?.email as string) || null, circleAuto }
}

// A "paid order" = not canceled and at least one payment collection with
// money captured. Unpaid/abandoned orders (e.g. the old orphaned PayPal
// orders) do not count, so those customers can still use WELCOME5.
export async function hasPaidOrder(container: MedusaContainer, email: string): Promise<boolean> {
  const e = email.trim()
  if (!e) return false
  const { data } = await queryOf(container).graph({
    entity: "order",
    fields: ["id", "status", "payment_collections.status", "payment_collections.captured_amount"],
    filters: { email: Array.from(new Set([e, e.toLowerCase()])) },
  })
  return (data ?? []).some(
    (o) =>
      o.status !== "canceled" &&
      ((o.payment_collections ?? []) as Array<Record<string, any>>).some(
        (pc) =>
          pc &&
          (pc.status === "completed" ||
            pc.status === "partially_captured" ||
            Number(pc.captured_amount ?? 0) > 0)
      )
  )
}

export async function checkCart(container: MedusaContainer, cartId: string): Promise<PromoCheck> {
  const { codes, email, circleAuto } = await cartCodes(container, cartId)
  if (codes.length > 0 && circleAuto) {
    return { ok: false, code: "circle_member_no_codes", message: PROMO_MSG.circle_member_no_codes }
  }
  if (codes.length > 1) {
    return { ok: false, code: "one_code_only", message: PROMO_MSG.one_code_only }
  }
  if (codes.length === 1 && personalMismatch(codes[0], email)) {
    return { ok: false, code: "code_email_mismatch", message: PROMO_MSG.code_email_mismatch }
  }
  if (codes.length === 1 && isFirstOrderCode(codes[0]) && email && (await hasPaidOrder(container, email))) {
    return { ok: false, code: "first_order_only", message: PROMO_MSG.first_order_only }
  }
  return { ok: true }
}

function incomingCodes(body: unknown): string[] | null {
  const raw = (body as { promo_codes?: unknown } | undefined)?.promo_codes
  if (!Array.isArray(raw)) return null
  return Array.from(
    new Set(
      raw
        .filter((c): c is string => typeof c === "string" && c.trim() !== "")
        .map((c) => c.trim().toUpperCase())
    )
  )
}

// POST /store/carts/:id/promotions — adds codes to the cart.
export async function guardAddPromotion(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): Promise<void> {
  try {
    const incoming = incomingCodes(req.body)
    if (!incoming || incoming.length === 0) {
      next()
      return
    }
    if (incoming.length > 1) {
      res.status(400).json({ type: "not_allowed", code: "one_code_only", message: PROMO_MSG.one_code_only })
      return
    }
    const cartId = (req.params as Record<string, string>).id
    const { codes, email, circleAuto } = await cartCodes(req.scope, cartId)
    if (circleAuto && !incoming[0].startsWith("CIRCLE-")) {
      res.status(400).json({ type: "not_allowed", code: "circle_member_no_codes", message: PROMO_MSG.circle_member_no_codes })
      return
    }
    const others = codes.filter((c) => c !== incoming[0])
    if (others.length > 0) {
      res.status(400).json({
        type: "not_allowed",
        code: "one_code_only",
        message: `${PROMO_MSG.one_code_only} Remove ${others[0]} first.`,
      })
      return
    }
    // At this point the cart may not have an email yet (code typed in the
    // cart before checkout) — then the binding is checked before payment.
    if (email && personalMismatch(incoming[0], email)) {
      res.status(400).json({ type: "not_allowed", code: "code_email_mismatch", message: PROMO_MSG.code_email_mismatch })
      return
    }
    if (isFirstOrderCode(incoming[0]) && email && (await hasPaidOrder(req.scope, email))) {
      res.status(400).json({ type: "not_allowed", code: "first_order_only", message: PROMO_MSG.first_order_only })
      return
    }
  } catch (e) {
    console.error("[promo-rules] guardAddPromotion check failed, allowing", e)
  }
  next()
}

// POST /store/carts/:id — a cart update may also carry promo_codes.
export async function guardCartUpdate(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): Promise<void> {
  const incoming = incomingCodes(req.body)
  if (incoming && incoming.length > 1) {
    res.status(400).json({ type: "not_allowed", code: "one_code_only", message: PROMO_MSG.one_code_only })
    return
  }
  next()
}
