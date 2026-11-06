import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  PromotionType,
  PromotionStatus,
  PromotionRuleOperator,
  ApplicationMethodType,
  ApplicationMethodAllocation,
  ApplicationMethodTargetType,
} from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
  createPromotionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"

/**
 * Lifespan fixes, 26 Oct 2026 (approved by Chakrit):
 *  A. Liquids (bacteriostatic/acetic water + sprays) sellable in THB only
 *  B. Every product gets the Default Shipping Profile (needed to mark orders shipped)
 *  D. Shipping: Thailand EMS 100 THB (free from 2,000 THB); elsewhere ~US$9,
 *     free from ~US$600 in each currency; add Indonesia, Malaysia, Vietnam
 *  C. WELCOMEBACK code: buy 1 vial, get 1 vial of equal/lower value free
 *     (vials only; excludes liquids, stacks and GLP-1 products; 9 uses; ends 30 Nov 2026)
 *
 * PREVIEW (default): prints the plan, changes nothing.
 * APPLY:   APPLY=1 npx medusa exec ./src/scripts/lss-fixes-20261026.ts
 */

const DEFAULT_PROFILE = "sp_01KNS3KS7120DZ49X4AVZR5XXJ"
const LIQUID = /(water|spray)/i
const STACK = /stack/i
const EXCLUDED_FROM_PROMO = /(retatrutide|tirzepatide|semaglutide)/i
const PROMO_CODE = "WELCOMEBACK"

export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-fixes] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY (changes WILL be made)" : "MODE: PREVIEW (nothing will be changed)")

  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id", "title", "handle", "status", "shipping_profile.id",
      "variants.id", "variants.title",
      "variants.prices.id", "variants.prices.currency_code", "variants.prices.amount",
    ],
  })) as any

  // ---------- A. Liquids: THB only ----------
  log("")
  log("A. LIQUIDS -> sellable in Thailand (THB) only")
  for (const p of products.filter((p: any) => LIQUID.test(p.title))) {
    for (const v of p.variants) {
      const thb = v.prices.find((x: any) => x.currency_code === "thb")
      const others = v.prices.filter((x: any) => x.currency_code !== "thb")
      if (!thb) { log(`  !! ${p.title}: has NO THB price, skipped`); continue }
      if (!others.length) { log(`  ok ${p.title}: already THB only (${thb.amount} THB)`); continue }
      log(`  -> ${p.title}: keep ${thb.amount} THB, remove ${others.length} other currencies`)
      if (APPLY) {
        await updateProductVariantsWorkflow(container).run({
          input: { selector: { id: v.id }, update: { prices: [{ id: thb.id, currency_code: "thb", amount: thb.amount }] } },
        })
      }
    }
  }

  // ---------- B. Shipping profile ----------
  log("")
  const missing = products.filter((p: any) => p.shipping_profile?.id !== DEFAULT_PROFILE)
  log(`B. SHIPPING PROFILE -> ${missing.length} of ${products.length} products need the Default Shipping Profile`)
  if (APPLY) {
    for (const p of missing) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: p.id }, update: { shipping_profile_id: DEFAULT_PROFILE } as any },
      })
    }
  }

  // ---------- D. Shipping prices + countries ----------
  log("")
  log("D. SHIPPING")
  const FEE: Record<string, number> = { thb: 100, usd: 9, eur: 9, gbp: 8, chf: 9, cad: 13, aud: 14, nok: 100, sek: 100, dkk: 65, idr: 148500, myr: 42, vnd: 222000 }
  const FREE_FROM: Record<string, number> = { thb: 2000, usd: 600, eur: 550, gbp: 480, chf: 540, cad: 840, aud: 930, nok: 6600, sek: 6600, dkk: 4320, idr: 9900000, myr: 2760, vnd: 15000000 }
  const { data: opts } = (await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "service_zone.id", "service_zone.geo_zones.country_code"],
    filters: { name: "Standard Shipping" },
  })) as any
  if (opts.length !== 1) { log(`  !! expected exactly 1 "Standard Shipping" option, found ${opts.length}; section D skipped`) } else {
    const opt = opts[0]
    const have = new Set((opt.service_zone.geo_zones || []).map((g: any) => g.country_code))
    const add = ["id", "my", "vn"].filter((c) => !have.has(c))
    log(`  countries: ${have.size} now, adding: ${add.length ? add.join(", ") : "none needed"}`)
    for (const c of Object.keys(FEE)) log(`  ${c.toUpperCase()}: fee ${FEE[c]}, free from ${FREE_FROM[c]}`)
    if (APPLY) {
      if (add.length) {
        const fulfillment: any = container.resolve(Modules.FULFILLMENT)
        await fulfillment.createGeoZones(add.map((c) => ({ service_zone_id: opt.service_zone.id, type: "country", country_code: c })))
      }
      const prices: any[] = []
      for (const c of Object.keys(FEE)) {
        prices.push({ currency_code: c, amount: FEE[c] })
        prices.push({ currency_code: c, amount: 0, rules: [{ attribute: "item_total", operator: "gte", value: FREE_FROM[c] }] })
      }
      await updateShippingOptionsWorkflow(container).run({ input: [{ id: opt.id, prices }] as any })
      log("  -> shipping updated")
    }
  }

  // ---------- C. WELCOMEBACK ----------
  log("")
  const eligible = products.filter((p: any) =>
    p.status === "published" && !LIQUID.test(p.title) && !STACK.test(p.title) && !EXCLUDED_FROM_PROMO.test(p.title))
  log(`C. PROMO ${PROMO_CODE} -> ${eligible.length} eligible vials:`)
  eligible.forEach((p: any) => log(`     - ${p.title}`))
  const { data: existing } = await query.graph({ entity: "promotion", fields: ["id"], filters: { code: PROMO_CODE } })
  if (existing.length) {
    log(`  ok ${PROMO_CODE} already exists, not created again`)
  } else if (APPLY) {
    const ids = eligible.map((p: any) => p.id)
    await createPromotionsWorkflow(container).run({
      input: {
        promotionsData: [{
          code: PROMO_CODE,
          type: PromotionType.BUYGET,
          is_automatic: false,
          status: PromotionStatus.ACTIVE,
          campaign: {
            name: "Welcome back (recovery emails Oct 2026)",
            campaign_identifier: "welcomeback-2026",
            starts_at: new Date(),
            ends_at: new Date("2026-11-30T16:59:59Z"), // 23:59 Bangkok
            budget: { type: "usage", limit: 9 },
          } as any,
          application_method: {
            type: ApplicationMethodType.PERCENTAGE,
            value: 100,
            target_type: ApplicationMethodTargetType.ITEMS,
            allocation: ApplicationMethodAllocation.EACH,
            max_quantity: 1,
            apply_to_quantity: 1,
            buy_rules_min_quantity: 2,
            buy_rules: [{ attribute: "items.product.id", operator: PromotionRuleOperator.IN, values: ids }],
            target_rules: [{ attribute: "items.product.id", operator: PromotionRuleOperator.IN, values: ids }],
          } as any,
        }],
      },
    })
    log(`  -> created ${PROMO_CODE}`)
  } else {
    log(`  -> would create ${PROMO_CODE}: 100% off 1 vial when 2+ eligible vials in cart, 9 uses total, ends 30 Nov 2026 23:59 Bangkok`)
  }

  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
