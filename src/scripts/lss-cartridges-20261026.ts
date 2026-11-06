import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { ensureInventoryLevelsForProduct } from "./seed-products-shared"

/**
 * Lifespan, 26 Oct 2026 (approved by Chakrit):
 *  A. NAD+ vial prices: Supreme Biologics 10,000 -> 4,000 THB; FourNines 12,000 -> 4,800 THB (all currencies scaled x0.4)
 *  B. Supreme Biologics dual-chamber cartridge products (website = 2x LINE price), created as DRAFT
 *  C. Dual-chamber injector (LINE 800 -> website 1,600 THB), DRAFT
 * PREVIEW by default. APPLY=1 to make changes.
 */

const STATIC = "https://api.lifespansupply.com/static"
const IMG_BOX = `${STATIC}/2026-10-26-sb-dual-chamber-box-slide0-84196463a2.webp`
const IMG_INJ = `${STATIC}/2026-10-26-sb-dual-chamber-injector-slide0-e522629690.webp`

// Per-currency factor vs THB, taken from the existing price ladder (NAD+ SB 10,000 THB).
const RATE: Record<string, number> = { usd: 1 / 33, eur: 1 / 36, gbp: 0.0244, cad: 0.0429, aud: 0.0469, chf: 0.0274, dkk: 0.2189, nok: 0.335, sek: 0.335, myr: 0.1399, idr: 501.6, vnd: 749.1 }
function roundUp(v: number, c: string) {
  if (c === "idr" || c === "vnd") return Math.ceil(v / 500) * 500
  return Math.ceil(v)
}
function pricesFromThb(thb: number) {
  return [{ currency_code: "thb", amount: thb }, ...Object.entries(RATE).map(([c, r]) => ({ currency_code: c, amount: roundUp(thb * r, c) }))]
}

// LINE price list (THB). Website = 2x.
const CARTRIDGES: { pep: string; ref: string; slug: string; boxes: [string, number][] }[] = [
  { pep: "AOD-9604", ref: "AOD-9604 5mg — Supreme Biologics", slug: "aod-9604", boxes: [["150 mcg × 8", 2000], ["250 mcg × 8", 2500], ["300 mcg × 8", 3000], ["500 mcg × 8", 3500]] },
  { pep: "BPC-157", ref: "BPC-157 5mg — Supreme Biologics", slug: "bpc-157", boxes: [["250 mcg × 8", 1600], ["500 mcg × 8", 2000], ["1 mg × 8", 2500]] },
  { pep: "CJC-1295 (no DAC)", ref: "CJC-1295 (no DAC) 5mg — Supreme Biologics", slug: "cjc-1295-no-dac", boxes: [["200 mcg × 8", 2000], ["300 mcg × 8", 2500]] },
  { pep: "DSIP", ref: "DSIP 5mg — FourNines", slug: "dsip", boxes: [["200 mcg × 8", 1500], ["300 mcg × 8", 1900]] },
  { pep: "Epithalon", ref: "Epithalon 50mg — FourNines", slug: "epithalon", boxes: [["5 mg × 8", 3200], ["10 mg × 8", 4800]] },
  { pep: "Ipamorelin", ref: "Ipamorelin 5mg — Supreme Biologics", slug: "ipamorelin", boxes: [["200 mcg × 8", 2000], ["300 mcg × 8", 2500]] },
  { pep: "KPV", ref: "KPV 5mg — Supreme Biologics", slug: "kpv", boxes: [["250 mcg × 8", 1600], ["500 mcg × 8", 2000], ["1 mg × 8", 2500]] },
  { pep: "Kisspeptin-10", ref: "KissPeptin-10 5mg — Wolf", slug: "kisspeptin-10", boxes: [["100 mcg × 8", 1500], ["200 mcg × 8", 1900], ["500 mcg × 8", 3800]] },
  { pep: "MOTS-c", ref: "MOTS-c 10mg — Supreme Biologics", slug: "mots-c", boxes: [["2.5 mg × 8", 3200], ["5 mg × 8", 4800]] },
  { pep: "NAD+", ref: "NAD+ 100mg — Supreme Biologics", slug: "nad-plus", boxes: [["25 mg × 4", 2400], ["25 mg × 8", 4800], ["50 mg × 8", 7700], ["100 mg × 8", 10000]] },
  { pep: "PT-141", ref: "PT-141 10mg — Supreme Biologics", slug: "pt-141", boxes: [["500 mcg × 8", 1500], ["1 mg × 8", 2200]] },
  { pep: "SS-31", ref: "SS-31 10mg — Supreme Biologics", slug: "ss-31", boxes: [["1 mg × 8", 2500], ["2 mg × 8", 3000], ["5 mg × 8", 4800], ["10 mg × 8", 7800]] },
  { pep: "Semax", ref: "Semax 5mg — Supreme Biologics", slug: "semax", boxes: [["200 mcg × 8", 2000], ["400 mcg × 8", 2500]] },
  { pep: "Tesamorelin", ref: "Tesamorelin 5mg — Supreme Biologics", slug: "tesamorelin", boxes: [["1 mg × 8", 3500], ["2 mg × 8", 5500]] },
  { pep: "Thymosin Beta-4", ref: "Thymosin Beta-4 10mg — Supreme Biologics", slug: "thymosin-beta-4", boxes: [["2.5 mg × 4", 2400], ["2.5 mg × 8", 3200], ["5 mg × 8", 4800]] },
]

const NOTE = "\n\nFormat: Supreme Biologics dual-chamber cartridges (glass, no needle), for use with the Supreme Biologics dual-chamber injector (sold separately). Ships dry: the diluent chamber is empty, add bacteriostatic water (not included) before use. Custom box combinations are available on request via LINE. For research use only."

export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-cart] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY" : "MODE: PREVIEW (nothing will be changed)")

  const { data: all } = (await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "description", "metadata", "categories.id", "variants.id", "variants.prices.id", "variants.prices.currency_code", "variants.prices.amount"],
  })) as any
  const byTitle = (t: string) => all.find((p: any) => p.title === t)

  // A. NAD+ vials
  log("")
  log("A. NAD+ VIAL PRICES")
  for (const [title, factor] of [["NAD+ 100mg — Supreme Biologics", 0.4], ["NAD+ 100mg — FourNines", 0.4]] as [string, number][]) {
    const p = byTitle(title)
    if (!p) { log(`  !! not found: ${title}`); continue }
    const v = p.variants[0]
    const thb = v.prices.find((x: any) => x.currency_code === "thb")
    const newPrices = v.prices.map((x: any) => ({ id: x.id, currency_code: x.currency_code, amount: x.currency_code === "usd" ? Math.ceil(thb.amount * factor / 33) : x.currency_code === "eur" ? Math.ceil(thb.amount * factor / 36) : roundUp(x.amount * factor, x.currency_code) }))
    log(`  -> ${title}: THB ${thb.amount} -> ${Math.round(thb.amount * factor)}; USD ${v.prices.find((x: any) => x.currency_code === "usd")?.amount} -> ${newPrices.find((x: any) => x.currency_code === "usd")?.amount}; EUR -> ${newPrices.find((x: any) => x.currency_code === "eur")?.amount}`)
    if (APPLY) await updateProductVariantsWorkflow(container).run({ input: { selector: { id: v.id }, update: { prices: newPrices } } })
  }

  // B + C. New products (draft)
  const sc = await container.resolve(Modules.SALES_CHANNEL).listSalesChannels({ name: "Default Sales Channel" })
  const sp = await container.resolve(Modules.FULFILLMENT).listShippingProfiles({ type: "default" })
  log("")
  log("B. CARTRIDGE PRODUCTS (DRAFT, website = 2x LINE)")
  const toCreate: any[] = []
  for (const c of CARTRIDGES) {
    const handle = `${c.slug}-dual-chamber-supreme-biologics`
    if (all.find((p: any) => p.handle === handle)) { log(`  ok exists already: ${handle}`); continue }
    const ref = byTitle(c.ref)
    if (!ref) { log(`  !! reference vial not found (${c.ref}), skipped ${c.pep}`); continue }
    const meta: Record<string, unknown> = { ...(ref.metadata || {}) }
    for (const k of Object.keys(meta)) if (/^ui_image_|^sku|^size|legacy_handles/.test(k)) delete meta[k]
    Object.assign(meta, { producent: "Supreme Biologics", form: "Dual Chamber Cartridge", ui_image_0: IMG_BOX, ui_image_1: IMG_INJ, ships_dry: true })
    if (typeof meta.long_description === "string") meta.long_description = meta.long_description + NOTE
    const variants = c.boxes.map(([box, line], i) => ({
      title: box, sku: `SB-DC-${c.slug.toUpperCase()}-${i + 1}`, options: { Size: box }, manage_inventory: true, prices: pricesFromThb(line * 2),
    }))
    log(`  -> ${c.pep} Dual Chamber Cartridges: ${c.boxes.map(([b, l]) => `${b} ฿${l * 2}`).join(" | ")}  (copy text/categories from: ${c.ref})`)
    toCreate.push({
      title: `${c.pep} Dual Chamber Cartridges — Supreme Biologics`, handle, status: ProductStatus.DRAFT,
      description: (ref.description || "") + NOTE, thumbnail: IMG_BOX,
      category_ids: (ref.categories || []).map((x: any) => x.id), shipping_profile_id: sp[0].id, metadata: meta, weight: 150,
      options: [{ title: "Size", values: c.boxes.map(([b]) => b) }], variants, sales_channels: [{ id: sc[0].id }],
    })
  }
  log("")
  log("C. INJECTOR (DRAFT)")
  const injHandle = "dual-chamber-injector-supreme-biologics"
  if (all.find((p: any) => p.handle === injHandle)) { log("  ok exists already") } else {
    log("  -> Dual Chamber Injector — Supreme Biologics: ฿1600")
    toCreate.push({
      title: "Dual Chamber Injector — Supreme Biologics", handle: injHandle, status: ProductStatus.DRAFT,
      description: "Reusable precision injector for Supreme Biologics dual-chamber cartridges. No needle included. Cartridges sold separately.",
      thumbnail: IMG_INJ, shipping_profile_id: sp[0].id, weight: 120,
      metadata: { producent: "Supreme Biologics", form: "Injector", ui_image_0: IMG_INJ, ui_image_1: IMG_BOX },
      options: [{ title: "Size", values: ["1 piece"] }],
      variants: [{ title: "1 piece", sku: "SB-DC-INJECTOR", options: { Size: "1 piece" }, manage_inventory: true, prices: pricesFromThb(1600) }],
      sales_channels: [{ id: sc[0].id }],
    })
  }
  if (APPLY && toCreate.length) {
    await createProductsWorkflow(container).run({ input: { products: toCreate } })
    for (const p of toCreate) await ensureInventoryLevelsForProduct({ container, handle: p.handle })
    log(`  -> created ${toCreate.length} draft products`)
  }
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
