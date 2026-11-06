// Server-only "this cart is paid" marker + PayPal amount helpers (backend
// side). Added 2026-11-06 to close the "complete a cart without paying" and
// "pay a cheap cart, complete an expensive one" holes.
//
//   Redis key:   lss:paid:<cart_id>   (same Redis as the storefront)
//   Redis value: JSON PaidMarker — shape MUST match
//                src/lib/paypal/paid-marker.ts in the storefront.
//
// Writers: storefront /api/paypal/capture-order (after a matching capture)
//          and the PayPal webhook below (after a matching capture).
// Reader:  requirePaidCart middleware on POST /store/carts/:id/complete.
//
// MIRROR WARNING: resolveChargeCurrency / formatPaypalAmount are copies of
// the storefront's src/lib/paypal.ts (separate package, no shared import).
// Keep ACDC_SUPPORTED, USD_PER_UNIT and ZERO_DECIMAL in sync with it.

import Redis from "ioredis"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const PAID_MARKER_PREFIX = "lss:paid:"
export const PAID_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60
// Cart totals are compared in hundredths (major units, never /100 — this is
// only a rounding tolerance). 0-decimal currencies are whole numbers anyway.
const TOTAL_PRECISION = 100

export interface PaidMarker {
  paypal_order_id: string
  capture_id: string | null
  cart_total: number
  cart_currency: string
  charge_value: string
  charge_currency: string
  source: "capture-order" | "webhook"
  at: string
}

// ── PayPal amount helpers (MIRROR of storefront src/lib/paypal.ts) ───────
const ACDC_SUPPORTED = new Set([
  "AUD", "BRL", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF",
  "ILS", "JPY", "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD",
  "THB", "TWD", "USD",
])
const USD_PER_UNIT: Record<string, number> = {
  VND: 1 / 25000,
  IDR: 1 / 16000,
}
const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"])

export function formatPaypalAmount(amount: number, currency: string): string {
  return amount.toFixed(ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2)
}

export function expectedPaypalAmount(
  cartTotal: number,
  cartCurrency: string
): { currency: string; value: string } {
  const total = Number(cartTotal)
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`Invalid cart total: ${String(cartTotal)}`)
  }
  const up = String(cartCurrency || "").toUpperCase()
  if (ACDC_SUPPORTED.has(up)) return { currency: up, value: formatPaypalAmount(total, up) }
  const rate = USD_PER_UNIT[up]
  if (!rate) throw new Error(`Unsupported currency: ${up}`)
  return { currency: "USD", value: formatPaypalAmount(total * rate, "USD") }
}

// true only when the PayPal amount equals what this cart costs now.
export function paypalAmountMatchesCart(
  amount: { currency_code?: string; value?: string } | null | undefined,
  cartTotal: number,
  cartCurrency: string
): boolean {
  const num = Number(amount?.value)
  const cur = String(amount?.currency_code ?? "").toUpperCase()
  if (!cur || amount?.value == null || !Number.isFinite(num)) return false
  try {
    const exp = expectedPaypalAmount(cartTotal, cartCurrency)
    return exp.currency === cur && exp.value === formatPaypalAmount(num, cur)
  } catch {
    return false
  }
}

export function markerMatchesCart(
  marker: PaidMarker,
  cart: { total: number; currency_code: string }
): boolean {
  if (String(marker.cart_currency).toLowerCase() !== String(cart.currency_code).toLowerCase()) {
    return false
  }
  const a = Math.round(Number(marker.cart_total) * TOTAL_PRECISION)
  const b = Math.round(Number(cart.total) * TOTAL_PRECISION)
  return Number.isFinite(a) && Number.isFinite(b) && a === b
}

// ── Cart lookup ──────────────────────────────────────────────────────────
export interface PaymentCart {
  id: string
  total: number
  currency_code: string
  completed_at: string | null
}

type GraphQuery = {
  graph: (args: Record<string, unknown>) => Promise<{ data: Array<Record<string, any>> }>
}

export async function loadPaymentCart(
  container: MedusaContainer,
  cartId: string
): Promise<PaymentCart | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as unknown as GraphQuery
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "total", "currency_code", "completed_at"],
    filters: { id: cartId },
  })
  const c = data?.[0]
  if (!c) return null
  return {
    id: String(c.id),
    total: Number(c.total),
    currency_code: String(c.currency_code),
    completed_at: c.completed_at ? String(c.completed_at) : null,
  }
}

// ── Redis ────────────────────────────────────────────────────────────────
let client: Redis | null = null

function redis(): Redis {
  const url = process.env.REDIS_URL
  if (!url) throw new Error("REDIS_URL not configured")
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 2000 })
    client.on("error", (e) => console.error("[paypal-paid] redis error:", e.message))
  }
  return client
}

export async function getPaidMarker(cartId: string): Promise<PaidMarker | null> {
  const raw = await redis().get(`${PAID_MARKER_PREFIX}${cartId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PaidMarker
  } catch {
    return null
  }
}

export async function setPaidMarker(cartId: string, marker: PaidMarker): Promise<void> {
  await redis().set(
    `${PAID_MARKER_PREFIX}${cartId}`,
    JSON.stringify(marker),
    "EX",
    PAID_MARKER_TTL_SECONDS
  )
}
