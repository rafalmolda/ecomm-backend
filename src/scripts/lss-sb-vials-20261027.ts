import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { ensureInventoryLevelsForProduct } from "./seed-products-shared"
/**
 * Lifespan, 27 Oct 2026: 4 new Supreme Biologics vials (website = 2x LINE price), PUBLISHED.
 * Text, translations and categories copied from the existing vial of the same peptide (other brand).
 * Override a price with env, e.g. EPITHALON_THB=5000. PREVIEW by default, APPLY=1 to create.
 */
const STATIC = "https://api.lifespansupply.com/static"
const RATE: Record<string, number> = { usd: 1 / 33, eur: 1 / 36, gbp: 0.0244, cad: 0.0429, aud: 0.0469, chf: 0.0274, dkk: 0.2189, nok: 0.335, sek: 0.335, myr: 0.1399, idr: 501.6, vnd: 749.1 }
const up = (v: number, c: string) => (c === "idr" || c === "vnd" ? Math.ceil(v / 500) * 500 : Math.ceil(v))
const prices = (thb: number) => [{ currency_code: "thb", amount: thb }, ...Object.entries(RATE).map(([c, r]) => ({ currency_code: c, amount: up(thb * r, c) }))]
const P = [
  { handle: "dsip-5mg-supreme-biologics", title: "DSIP 5mg — Supreme Biologics", ref: "DSIP 5mg — FourNines", img: "2026-10-27-dsip-5mg-supreme-biologics-slide0-3ced45f3a2.webp", line: 1700, size: "5mg", sku: "SB-DSIP-5MG" },
  { handle: "epithalon-50mg-supreme-biologics", title: "Epithalon 50mg — Supreme Biologics", ref: "Epithalon 50mg — FourNines", img: "2026-10-27-epithalon-50mg-supreme-biologics-slide0-cf900ea793.webp", line: 2000, size: "50mg", sku: "SB-EPI-50MG" },
  { handle: "ghk-cu-50mg-supreme-biologics", title: "GHK-Cu 50mg — Supreme Biologics", ref: "GHK-Cu 50mg — FourNines", img: "2026-10-27-ghk-cu-50mg-supreme-biologics-slide0-d89ff8372e.webp", line: 1700, size: "50mg", sku: "SB-GHK-50MG" },
  { handle: "kisspeptin-10-5mg-supreme-biologics", title: "Kisspeptin-10 5mg — Supreme Biologics", ref: "KissPeptin-10 5mg — Wolf", img: "2026-10-27-kisspeptin-10-5mg-supreme-biologics-slide0-46777079c2.webp", line: 1500, size: "5mg", sku: "SB-KISS-5MG" }
]
export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-sbvial] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY" : "MODE: PREVIEW (nothing will be changed)")
  const { data: all } = (await query.graph({ entity: "product", fields: ["id", "title", "handle", "description", "weight", "metadata", "categories.id"] })) as any
  const sc = await container.resolve(Modules.SALES_CHANNEL).listSalesChannels({ name: "Default Sales Channel" })
  const sp = await container.resolve(Modules.FULFILLMENT).listShippingProfiles({ type: "default" })
  const toCreate: any[] = []
  for (const p of P) {
    if (all.find((x: any) => x.handle === p.handle)) { log(`  ok exists already: ${p.title}`); continue }
    const ref = all.find((x: any) => x.title === p.ref)
    if (!ref) { log(`  !! reference not found: ${p.ref}`); continue }
    const envKey = p.title.split(" ")[0].replace(/[^A-Za-z]/g, "").toUpperCase() + "_THB"
    const thb = Number(process.env[envKey]) || p.line * 2
    const meta: Record<string, unknown> = { ...(ref.metadata || {}) }
    for (const k of Object.keys(meta)) if (/^ui_image_|legacy_handles/.test(k)) delete meta[k]
    Object.assign(meta, { producent: "Supreme Biologics", ui_image_0: `${STATIC}/${p.img}` })
    const pr = prices(thb)
    log(`  -> ${p.title}: ฿${thb} / $${pr.find((x) => x.currency_code === "usd")!.amount} / €${pr.find((x) => x.currency_code === "eur")!.amount}  (LINE ฿${p.line}; text+categories from ${p.ref})`)
    toCreate.push({
      title: p.title, handle: p.handle, status: ProductStatus.PUBLISHED, description: ref.description, weight: ref.weight || 120,
      thumbnail: `${STATIC}/${p.img}`, category_ids: (ref.categories || []).map((c: any) => c.id), shipping_profile_id: sp[0].id, metadata: meta,
      options: [{ title: "Size", values: [p.size] }],
      variants: [{ title: p.size, sku: p.sku, options: { Size: p.size }, manage_inventory: true, prices: pr }],
      sales_channels: [{ id: sc[0].id }],
    })
  }
  if (APPLY && toCreate.length) {
    await createProductsWorkflow(container).run({ input: { products: toCreate } })
    for (const p of toCreate) await ensureInventoryLevelsForProduct({ container, handle: p.handle })
    log(`  -> created ${toCreate.length} products (published)`)
  }
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
