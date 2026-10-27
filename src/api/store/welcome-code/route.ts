import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { timingSafeEqual } from "crypto"
import { normalizeEmail, personalCodeFor } from "../../../utils/promo-rules"

// POST /store/welcome-code  { email }  (header x-lss-key required)
// Returns this email's personal first-order code (WELCOME-XXXXXX), creating
// it in Medusa the first time. Only the storefront server knows x-lss-key, so
// nobody can mint codes from outside. Settings (percentage, eligible
// products, rules) are copied from the WELCOME5 promotion, which acts as the
// template — keep WELCOME5 in the admin (it may be inactive).
const TEMPLATE_CODE = "WELCOME5"

function keyOk(given: string): boolean {
  const key = process.env.LSS_INTERNAL_KEY || ""
  if (!key || given.length !== key.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(key))
}

function num(v: any): number | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === "number") return v
  const n = Number(v?.numeric ?? v?.value ?? (typeof v?.toString === "function" ? v.toString() : v))
  return Number.isFinite(n) ? n : undefined
}

function mapRule(r: any) {
  return {
    attribute: r.attribute,
    operator: r.operator,
    values: ((r.values ?? []) as any[]).map((v) => (typeof v === "string" ? v : v.value)),
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!keyOk(String(req.headers["x-lss-key"] ?? ""))) {
    res.status(401).json({ message: "unauthorized" })
    return
  }
  const email = normalizeEmail((req.body as any)?.email)
  if (!email || !/.+@.+\..+/.test(email)) {
    res.status(400).json({ message: "valid email required" })
    return
  }
  const code = personalCodeFor(email)
  if (!code) {
    res.status(503).json({ message: "not configured" })
    return
  }
  const promos: any = req.scope.resolve(Modules.PROMOTION)
  try {
    const existing = await promos.listPromotions({ code: [code] }, { take: 1 })
    if (existing?.length) {
      res.json({ code, created: false })
      return
    }
    const [tpl] = await promos.listPromotions(
      { code: [TEMPLATE_CODE] },
      { relations: ["application_method", "application_method.target_rules", "rules"], take: 1 }
    )
    const am = tpl?.application_method
    if (!am) {
      res.status(500).json({ message: "template promotion WELCOME5 not found" })
      return
    }
    const application_method: Record<string, unknown> = {
      type: am.type,
      target_type: am.target_type,
      value: num(am.value),
      target_rules: ((am.target_rules ?? []) as any[]).map(mapRule),
    }
    if (am.allocation) application_method.allocation = am.allocation
    if (am.currency_code) application_method.currency_code = am.currency_code
    if (num(am.max_quantity) !== undefined) application_method.max_quantity = num(am.max_quantity)

    await createPromotionsWorkflow(req.scope).run({
      input: {
        promotionsData: [
          {
            code,
            type: tpl.type,
            status: "active",
            is_automatic: false,
            application_method,
            rules: ((tpl.rules ?? []) as any[]).map(mapRule),
          } as any,
        ],
      },
    })
    res.json({ code, created: true })
  } catch (e) {
    // Two sign-ups at the same moment can race; if the code now exists, fine.
    try {
      const again = await promos.listPromotions({ code: [code] }, { take: 1 })
      if (again?.length) {
        res.json({ code, created: false })
        return
      }
    } catch {
      /* ignore */
    }
    console.error("[welcome-code] failed", e)
    res.status(500).json({ message: "could not create code" })
  }
}
