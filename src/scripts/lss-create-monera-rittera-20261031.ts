import { readFileSync, writeFileSync } from "node:fs"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { ensureInventoryLevelsForProduct } from "./seed-products-shared"

const DIR = "/tmp/lss-monera-rittera-dual-20261031"
const payload = JSON.parse(readFileSync(`${DIR}/payload.json`, "utf8"))

export default async function run({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apply = process.env.APPLY === "1"
  const publish = process.env.PUBLISH === "1"
  const handles = payload.products.map((p: any) => p.handle)
  const references = payload.products.map((p: any) => p.reference_handle)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "description", "metadata", "categories.id", "variants.id", "variants.title", "variants.manage_inventory", "variants.allow_backorder"],
    filters: { handle: [...handles, ...references, "nad-plus-dual-chamber-supreme-biologics"] },
  }) as any
  const existing = products.filter((p: any) => handles.includes(p.handle))
  for (const p of existing) {
    if (p.metadata?.creation_batch !== payload.batch) throw new Error(`Unexpected existing product: ${p.handle}`)
  }
  const [channel] = await container.resolve(Modules.SALES_CHANNEL).listSalesChannels({ name: "Default Sales Channel" })
  const [shipping] = await container.resolve(Modules.FULFILLMENT).listShippingProfiles({ type: "default" })
  if (!channel || !shipping) throw new Error("Default channel/shipping profile missing")
  const inputs: any[] = []
  for (const spec of payload.products) {
    const ref = products.find((p: any) => p.handle === spec.reference_handle)
    if (!ref || !ref.categories?.length) throw new Error(`Reference/category missing for ${spec.name}`)
    const metadata: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(ref.metadata ?? {})) {
      if (/^(cas_number|molecular_formula|purity_percentage|purity|benefit_.+)$/.test(k)) metadata[k] = v
    }
    const description = `${spec.name} dual-chamber cartridges from Supreme Biologics. Each box contains four cartridges. Select the amount per cartridge; the price is for one complete box. Compatible injector sold separately.`
    const longDescription = `### Box contents\nFour dual-chamber cartridges. The selected amount is per cartridge; all listed prices are per complete box.\n\n### Cartridge format\nPeptide powder and clear diluent are held in separate chambers until mixing. A compatible Supreme Biologics dual-chamber injector is sold separately.`
    Object.assign(metadata, {
      producent: "Supreme Biologics", form: "Dual Chamber Cartridge", ships_dry: false,
      diluent_included: true, cartridges_per_box: 4, price_unit: "box",
      foreign_price_multiplier: payload.foreign_multiplier, creation_batch: payload.batch,
      ui_image_0: spec.image_url, ui_image_1: spec.image_url,
      long_description: longDescription,
      description_th: `${spec.name} คาร์ทริดจ์แบบสองห้องจาก Supreme Biologics กล่องละ 4 คาร์ทริดจ์ เลือกปริมาณต่อคาร์ทริดจ์ ราคาที่แสดงเป็นราคาต่อกล่อง อุปกรณ์ฉีดจำหน่ายแยกต่างหาก`,
      long_description_th: `### จำนวนต่อกล่อง\n4 คาร์ทริดจ์ต่อกล่อง ตัวเลือกแสดงปริมาณต่อคาร์ทริดจ์ ราคาทั้งหมดเป็นราคาต่อกล่อง\n\n### รูปแบบผลิตภัณฑ์\nผงเปปไทด์และตัวทำละลายใสแยกอยู่คนละห้องก่อนผสม อุปกรณ์สำหรับคาร์ทริดจ์แบบสองห้องของ Supreme Biologics จำหน่ายแยกต่างหาก`,
    })
    if (ref.metadata?.ui_image_3) metadata.ui_image_3 = ref.metadata.ui_image_3
    const input = {
      title: `${spec.name} Dual Chamber Cartridges — Supreme Biologics`, handle: spec.handle,
      status: ProductStatus.DRAFT, description, thumbnail: spec.image_url, weight: 150,
      category_ids: ref.categories.map((c: any) => c.id), shipping_profile_id: shipping.id,
      metadata, options: [{ title: "Size", values: spec.options.map((v: any) => v.title) }],
      variants: spec.options.map((v: any, index: number) => ({
        title: v.title, sku: v.sku, variant_rank: index,
        options: { Size: v.title }, manage_inventory: true, prices: v.prices,
      })),
      sales_channels: [{ id: channel.id }],
    }
    if (!existing.some((p: any) => p.handle === spec.handle)) inputs.push(input)
  }
  const preview = { mode: apply ? "apply" : "preview", publish, existing, inputs, referenceInventory: products.find((p: any) => p.handle === "nad-plus-dual-chamber-supreme-biologics")?.variants }
  writeFileSync(`${DIR}/preview.json`, JSON.stringify(preview, null, 2))
  console.log(`[dual-new] ${apply ? "APPLY" : "PREVIEW"}: ${inputs.length} products to create; ${existing.length} already created by this batch`)
  if (!apply) return
  if (inputs.length) await createProductsWorkflow(container).run({ input: { products: inputs } })
  for (const handle of handles) await ensureInventoryLevelsForProduct({ container, handle })
  const { data: verified } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "thumbnail", "metadata", "options.id", "options.title", "options.values.value", "sales_channels.id", "categories.id", "variants.id", "variants.title", "variants.sku", "variants.variant_rank", "variants.prices.currency_code", "variants.prices.amount", "variants.inventory_items.inventory.id", "variants.inventory_items.inventory.location_levels.id", "variants.inventory_items.inventory.location_levels.stocked_quantity"],
    filters: { handle: handles },
  }) as any
  if (verified.length !== 2) throw new Error("Expected two newly created products")
  for (const p of verified) {
    const spec = payload.products.find((x: any) => x.handle === p.handle)
    if (p.metadata?.creation_batch !== payload.batch || p.thumbnail !== spec.image_url || p.metadata?.ui_image_1 !== spec.image_url) throw new Error(`Product/media mismatch: ${p.handle}`)
    if (p.variants.length !== spec.options.length) throw new Error(`Variant count mismatch: ${p.handle}`)
    for (const v of p.variants) {
      const wanted = spec.options.find((x: any) => x.sku === v.sku)
      if (!wanted || v.title !== wanted.title) throw new Error(`Variant mismatch: ${v.sku}`)
      if (v.prices.length !== 13) throw new Error(`Currency count mismatch: ${v.sku}`)
      for (const price of wanted.prices) {
        const actual = v.prices.filter((x: any) => x.currency_code === price.currency_code)
        if (actual.length !== 1 || Number(actual[0].amount) !== price.amount) throw new Error(`Price mismatch: ${v.sku}/${price.currency_code}`)
      }
      if (!v.inventory_items?.some((x: any) => x.inventory?.location_levels?.length)) throw new Error(`Stock link missing: ${v.sku}`)
    }
  }
  if (publish) {
    await updateProductsWorkflow(container).run({ input: { products: verified.map((p: any) => ({ id: p.id, status: ProductStatus.PUBLISHED })) } })
  }
  writeFileSync(`${DIR}/${publish ? "published" : "created-drafts"}.json`, JSON.stringify({ published: publish, products: verified }, null, 2))
  console.log(`[dual-new] VERIFIED: 2 products, 14 box options, 182 currency prices; ${publish ? "PUBLISHED" : "DRAFT"}`)
}
