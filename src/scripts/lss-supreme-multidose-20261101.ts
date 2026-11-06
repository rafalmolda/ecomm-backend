import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"

const DIR = "/tmp/lss-supreme-multidose-20261101"
const text = readFileSync(`${DIR}/payload.json`, "utf8")
const payload = JSON.parse(text)
const digest = createHash("sha256").update(text).digest("hex")

export default async function run({ container }: ExecArgs) {
  const apply = process.env.APPLY === "1"
  const publish = process.env.PUBLISH === "1"
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (payload.products.length !== 13 || payload.foreign_multiplier !== 2) throw new Error("Unexpected product or pricing scope")
  const handles = payload.products.map((p: any) => p.handle)
  if (new Set(handles).size !== 13) throw new Error("Duplicate handles")
  const { data: found } = await query.graph({ entity: "product", fields: ["id", "handle", "metadata", "categories.id"], filters: { handle: [...handles, ...payload.products.map((p: any) => p.reference_handle)] } }) as any
  const existing = found.filter((p: any) => handles.includes(p.handle))
  for (const p of existing) {
    if (p.metadata?.creation_batch !== payload.batch || p.metadata?.creation_payload_sha256 !== digest) throw new Error(`Unexpected existing product ${p.handle}`)
  }
  const [channel] = await container.resolve(Modules.SALES_CHANNEL).listSalesChannels({ name: "Default Sales Channel" })
  const [shipping] = await container.resolve(Modules.FULFILLMENT).listShippingProfiles({ type: "default" })
  if (!channel || !shipping) throw new Error("Default sales channel or shipping profile missing")
  const inputs: any[] = []
  for (const spec of payload.products) {
    const ref = found.find((p: any) => p.handle === spec.reference_handle)
    if (!ref?.categories?.length) throw new Error(`Reference/category missing: ${spec.handle}`)
    if (spec.options.length !== 2 || spec.options.some((v: any) => v.prices.length !== 13)) throw new Error("Unexpected option/currency count")
    const description = `${spec.name} ${spec.amount} for the Supreme Biologics reusable multidose pen. Choose first purchase, including the pen and matching refill, or refill only. The stated amount is the total per single-chamber cartridge.`
    const longDescription = `### Purchase options\n**First purchase — includes pen:** reusable Supreme Biologics pen and a matching ${spec.name} ${spec.amount} refill.\n\n**Refill only:** one ${spec.name} ${spec.amount} single-chamber cartridge for an existing compatible pen.\n\n### Product format\nA single-chamber refill for the reusable multidose pen. The amount on the label is the total per cartridge; it is not an amount per click. This format is separate from the Supreme Biologics dual-chamber system.`
    const metadata: Record<string, unknown> = {
      producent: "Supreme Biologics", form: "Multi-Dose Pen", size: spec.amount,
      presentation: "Multi-Dose Pen", cartridge_type: "Single Chamber", ships_dry: false,
      foreign_price_multiplier: 2, creation_batch: payload.batch, creation_payload_sha256: digest,
      ui_image_0: spec.cover_url, ui_image_1: spec.box_url, long_description: longDescription,
      description_th: `${spec.name} ${spec.amount} สำหรับปากกาหลายโดสแบบใช้ซ้ำ Supreme Biologics เลือกซื้อครั้งแรกพร้อมปากกาและตลับรีฟิล หรือซื้อเฉพาะตลับรีฟิล ปริมาณที่ระบุคือปริมาณรวมต่อตลับแบบห้องเดียว`,
      long_description_th: `### ตัวเลือกการซื้อ\n**ซื้อครั้งแรก — รวมปากกา:** ปากกา Supreme Biologics แบบใช้ซ้ำ พร้อมตลับรีฟิล ${spec.name} ${spec.amount}\n\n**รีฟิลเท่านั้น:** ตลับแบบห้องเดียว ${spec.name} ${spec.amount} จำนวน 1 ตลับ สำหรับปากกาที่รองรับ\n\n### รูปแบบผลิตภัณฑ์\nปริมาณบนฉลากคือปริมาณรวมต่อตลับ ไม่ใช่ปริมาณต่อคลิก รุ่นนี้ใช้ตลับแบบห้องเดียว แยกจากระบบตลับแบบสองห้องของ Supreme Biologics`,
    }
    const input = {
      title: `${spec.name} ${spec.amount} Multi-Dose Pen — Supreme Biologics`, handle: spec.handle,
      status: ProductStatus.DRAFT, description, thumbnail: spec.cover_url,
      images: [{ url: spec.cover_url }, { url: spec.box_url }],
      category_ids: ref.categories.map((c: any) => c.id), shipping_profile_id: shipping.id,
      metadata, options: [{ title: "Purchase option", values: spec.options.map((v: any) => v.title) }],
      variants: spec.options.map((v: any, index: number) => ({
        title: v.title, sku: v.sku, variant_rank: index, options: { "Purchase option": v.title },
        manage_inventory: false, allow_backorder: false, prices: v.prices,
      })),
      sales_channels: [{ id: channel.id }],
    }
    if (!existing.some((p: any) => p.handle === spec.handle)) inputs.push(input)
  }
  writeFileSync(`${DIR}/preview.json`, JSON.stringify({ mode: apply ? "apply" : "preview", publish, digest, existing, inputs }, null, 2))
  console.log(`[supreme-pen] ${apply ? "APPLY" : "PREVIEW"}: ${inputs.length} new products; ${existing.length} already created by this batch`)
  if (!apply) return
  if (inputs.length) await createProductsWorkflow(container).run({ input: { products: inputs } })
  const { data: verified } = await query.graph({
    entity: "product", filters: { handle: handles },
    fields: ["id", "handle", "title", "status", "thumbnail", "metadata", "images.url", "options.title", "options.values.value", "sales_channels.id", "categories.id", "variants.id", "variants.title", "variants.sku", "variants.variant_rank", "variants.manage_inventory", "variants.prices.currency_code", "variants.prices.amount"],
  }) as any
  if (verified.length !== 13) throw new Error(`Expected 13 products, got ${verified.length}`)
  for (const p of verified) {
    const spec = payload.products.find((x: any) => x.handle === p.handle)
    if (p.metadata?.creation_batch !== payload.batch || p.metadata?.creation_payload_sha256 !== digest || p.metadata?.producent !== "Supreme Biologics" || p.metadata?.foreign_price_multiplier !== 2) throw new Error(`Metadata mismatch ${p.handle}`)
    if (p.thumbnail !== spec.cover_url || p.metadata?.ui_image_0 !== spec.cover_url || p.metadata?.ui_image_1 !== spec.box_url || p.images?.length !== 2) throw new Error(`Media mismatch ${p.handle}`)
    if (!p.sales_channels?.some((c: any) => c.id === channel.id) || !p.categories?.length || p.variants.length !== 2) throw new Error(`Listing links/options mismatch ${p.handle}`)
    for (const v of p.variants) {
      const wanted = spec.options.find((x: any) => x.sku === v.sku)
      if (!wanted || v.title !== wanted.title || v.manage_inventory !== false || v.prices.length !== 13) throw new Error(`Variant mismatch ${v.sku}`)
      for (const price of wanted.prices) {
        const actual = v.prices.filter((x: any) => x.currency_code === price.currency_code)
        if (actual.length !== 1 || Number(actual[0].amount) !== price.amount) throw new Error(`Price mismatch ${v.sku}/${price.currency_code}`)
      }
    }
  }
  if (publish) await updateProductsWorkflow(container).run({ input: { products: verified.filter((p: any) => p.status !== ProductStatus.PUBLISHED).map((p: any) => ({ id: p.id, status: ProductStatus.PUBLISHED })) } })
  writeFileSync(`${DIR}/${publish ? "published" : "created-drafts"}.json`, JSON.stringify({ published: publish, products: verified }, null, 2))
  console.log(`[supreme-pen] VERIFIED 13 products, 26 purchase options, 338 currency prices; ${publish ? "PUBLISHED" : "DRAFT"}`)
}
