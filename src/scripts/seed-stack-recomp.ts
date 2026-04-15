import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * One-shot seed: creates the "Stacks" product category (if missing) and a
 * flagship stack product — "Recomp Stack (CJC-1295 + Ipamorelin + AOD 9604)".
 *
 * Modeled as a single product entity (per the 2026-04-10 design decision for
 * Recommended Stacks — no composite bundle plumbing), with rich bilingual
 * metadata, specifications, benefit ratings, and dual-currency USD/THB pricing.
 * The storefront /shop/stacks page reads this via getProductsByCategory("stacks").
 *
 *   npx medusa exec ./src/scripts/seed-stack-recomp.ts
 *
 * Idempotent — if the category or product handle already exists it's skipped.
 */

const STACK_HANDLE = "recomp-stack-cjc-ipamorelin-aod"
const STACK_CATEGORY_NAME = "Stacks"

const STACK_DESCRIPTION =
  "Research stack pairing a long-acting GHRH analog (CJC-1295), a selective ghrelin receptor agonist (Ipamorelin), and a lipolytic hGH fragment (AOD 9604) — for studies of growth hormone pulsatility and adipose tissue metabolism. All three compounds ≥99% HPLC verified."

const STACK_METADATA = {
  title_th: "Recomp Stack: CJC-1295 + Ipamorelin + AOD 9604",
  description_th:
    "ชุดวิจัยที่รวม GHRH analog ออกฤทธิ์นาน (CJC-1295), selective ghrelin receptor agonist (Ipamorelin) และ lipolytic hGH fragment (AOD 9604) — สำหรับการศึกษา GH pulsatility และการเผาผลาญเนื้อเยื่อไขมัน สารประกอบทั้งสาม HPLC ≥99%",
  // NOTE: LONG_DESCRIPTION_EN/TH assigned below at bottom of metadata block.
  // Stacks intentionally omit molecular_formula / cas_number — the frontend
  // hides spec tiles that don't have a real value.
  purity_percentage: "99",
  molecular_formula: "",
  cas_number: "",
  form: "Lyophilized Powder (3 vials)",
  storage: "-20°C long-term / 2–8°C reconstituted",
  size: "3 × 5mg",
  stack_composition: "CJC-1295 5mg, Ipamorelin 5mg, AOD 9604 5mg",
  // Scale 0-5. Stacks lean heavy across the board — three synergistic
  // compounds should visibly outperform single-peptide products.
  benefit_fat_loss: "5",
  benefit_muscle: "5",
  benefit_recovery: "5",
  benefit_anti_aging: "4",
  benefit_performance: "5",
  benefit_sleep: "3",
} as const

const LONG_DESCRIPTION_EN = `The Recomp Stack is our flagship body-composition research protocol: three synergistic peptides engineered to hit growth-hormone pulsatility, IGF-1 signaling, and adipose-tissue lipolysis in a single coordinated program. Each vial is independently HPLC-verified at ≥99% purity, ships with a full Certificate of Analysis, and is synthesized under GMP-certified conditions — CJC-1295 5mg, Ipamorelin 5mg, and AOD 9604 5mg, with matched reconstitution protocols.

Stacked protocols are the gold standard in peptide research because complementary mechanisms produce effects that no single compound can replicate. GH-axis stimulation alone plateaus quickly; lipolytic agents alone miss the anabolic window. The Recomp Stack bridges both pathways in one research toolkit — this is the same combination used across published protocols studying pulsatile GH secretion and body-composition markers in research models.

**Research Applications:**
• **Growth Hormone Pulsatility** — CJC-1295 extends the half-life of endogenous GHRH signaling while Ipamorelin selectively stimulates GH release through the GHSR (ghrelin receptor) pathway without affecting cortisol, prolactin, or ACTH.
• **Lipolytic Pathways** — AOD 9604 is a modified 16-amino-acid fragment of the C-terminus of hGH (residues 177–191) that retains lipolytic activity without the growth-promoting or insulin-resistance side effects of the parent hormone.
• **Synergistic Research** — Paired studies investigate whether combining GH-axis stimulation with a selective lipolytic agent produces additive or synergistic effects on body-composition markers.
• **IGF-1 Signaling Studies** — Protocols use the CJC-1295/Ipamorelin combination as a standard tool for elevating IGF-1 pulses in research models.
• **Adipocyte Metabolism** — AOD 9604 targets beta-3 adrenergic receptor signaling, a key pathway in adipocyte research.

**Preparation:** Reconstitute each vial with bacteriostatic water (2mL recommended for 5mg vials → 2.5mg/mL working concentration) by slowly dispensing water along the interior vial wall — never inject directly into the powder. Gently swirl; do not shake. Store reconstituted solutions at 2–8°C and use within 30 days. Lyophilized (unreconstituted) vials should be stored at -20°C for long-term storage.`

const LONG_DESCRIPTION_TH = `Recomp Stack คือโปรโตคอลการวิจัย body composition เรือธงของเรา — เปปไทด์ 3 ชนิดที่เสริมฤทธิ์กันเพื่อโจมตี growth hormone pulsatility, IGF-1 signaling และ adipose lipolysis ในโปรแกรมเดียวที่ประสานกัน ทุกขวดได้รับการตรวจสอบ HPLC อิสระที่ความบริสุทธิ์ ≥99% พร้อมใบรับรองการวิเคราะห์ฉบับเต็ม และสังเคราะห์ภายใต้เงื่อนไข GMP — CJC-1295 5mg, Ipamorelin 5mg และ AOD 9604 5mg พร้อมโปรโตคอลการผสมที่เข้าคู่กัน

โปรโตคอลแบบ Stack เป็นมาตรฐานทองคำในการวิจัยเปปไทด์ เพราะกลไกที่เสริมกันให้ผลที่สารประกอบเดี่ยวไม่สามารถทำได้ การกระตุ้น GH-axis เพียงอย่างเดียวจะถึงจุดอิ่มตัวอย่างรวดเร็ว ส่วน lipolytic agent เพียงอย่างเดียวก็พลาดหน้าต่าง anabolic Recomp Stack เชื่อมโยงทั้งสอง pathway ในชุดเครื่องมือวิจัยเดียว

**การใช้งานในการวิจัย:**
• **GH Pulsatility** — CJC-1295 ยืดอายุสัญญาณ GHRH ภายในร่างกาย ขณะที่ Ipamorelin กระตุ้นการหลั่ง GH ผ่าน GHSR (ghrelin receptor) แบบเจาะจง โดยไม่กระทบต่อ cortisol, prolactin หรือ ACTH
• **Lipolytic Pathways** — AOD 9604 เป็น fragment 16 กรดอะมิโนที่ดัดแปลงจากปลาย C-terminus ของ hGH (residues 177–191) ที่คงกิจกรรม lipolytic ของฮอร์โมนต้นฉบับโดยไม่มีผลข้างเคียงต่อการเจริญเติบโตหรือการดื้อ insulin
• **การวิจัยแบบเสริมกัน** — การศึกษาแบบคู่ตรวจสอบว่าการรวมการกระตุ้น GH-axis กับ selective lipolytic agent ให้ผลเสริมกันหรือ synergistic ต่อ body-composition markers
• **IGF-1 Signaling** — โปรโตคอลใช้การรวม CJC-1295/Ipamorelin เป็นเครื่องมือมาตรฐานสำหรับเพิ่ม IGF-1 pulses ในโมเดลการวิจัย
• **Adipocyte Metabolism** — AOD 9604 มุ่งเป้า beta-3 adrenergic receptor signaling ซึ่งเป็น pathway สำคัญในการวิจัย adipocyte

**การเตรียม:** ผสมแต่ละขวดด้วย bacteriostatic water (แนะนำ 2mL สำหรับขวด 5mg → ความเข้มข้น 2.5mg/mL) โดยค่อยๆ หยดน้ำตามผนังขวดด้านใน — ห้ามฉีดตรงเข้าผง หมุนเบาๆ ห้ามเขย่า เก็บสารละลายที่ผสมแล้วที่ 2–8°C และใช้ภายใน 30 วัน ขวดแบบผงแห้งควรเก็บที่ -20°C สำหรับระยะยาว`

async function ensureStackInventoryLevels({
  container,
}: {
  container: ExecArgs["container"]
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  // Get the stack product's variant with its linked inventory_item
  const { data: stackProducts } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.manage_inventory",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
    ],
    filters: { handle: STACK_HANDLE },
  })

  if (stackProducts.length === 0) return
  const product = stackProducts[0] as unknown as {
    variants: {
      id: string
      manage_inventory: boolean
      inventory_items: { inventory: { id: string; location_levels: { id: string }[] } }[]
    }[]
  }

  const [stockLocation] = await stockLocationService.listStockLocations({})
  if (!stockLocation) {
    logger.warn("[seed-stack] no stock location found, skipping inventory level seed")
    return
  }

  const inventoryLevels: CreateInventoryLevelInput[] = []
  for (const variant of product.variants) {
    for (const ii of variant.inventory_items ?? []) {
      const hasLevel = (ii.inventory.location_levels ?? []).length > 0
      if (hasLevel) continue
      inventoryLevels.push({
        location_id: stockLocation.id,
        inventory_item_id: ii.inventory.id,
        stocked_quantity: 1000000,
      })
    }
  }

  if (inventoryLevels.length === 0) {
    logger.info(`[seed-stack] inventory levels already present for stack variant`)
    return
  }

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })
  logger.info(
    `[seed-stack] seeded ${inventoryLevels.length} inventory level(s) for stack variant`
  )
}

export default async function seedStackRecomp({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  // --- 1. Ensure Stacks category exists --------------------------------------
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: STACK_CATEGORY_NAME },
  })

  let stackCategoryId: string
  if (existingCategories.length > 0) {
    stackCategoryId = existingCategories[0].id as string
    logger.info(`[seed-stack] category "${STACK_CATEGORY_NAME}" already exists (${stackCategoryId})`)
  } else {
    const { result: categoryResult } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: STACK_CATEGORY_NAME,
            handle: "stacks",
            description: "Curated peptide stacks built around published research protocols — for body recomposition, recovery, longevity, and tissue repair.",
            is_active: true,
          },
        ],
      },
    })
    stackCategoryId = categoryResult[0].id
    logger.info(`[seed-stack] created category "${STACK_CATEGORY_NAME}" (${stackCategoryId})`)
  }

  // --- 2. Skip if product already exists -------------------------------------
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: STACK_HANDLE },
  })
  if (existingProducts.length > 0) {
    const existingId = existingProducts[0].id as string
    logger.info(`[seed-stack] product "${STACK_HANDLE}" already exists (${existingId}), refreshing metadata + inventory`)
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: existingId,
            title: "Recomp Stack: CJC-1295 + Ipamorelin + AOD 9604",
            description: STACK_DESCRIPTION,
            metadata: {
              ...STACK_METADATA,
              long_description: LONG_DESCRIPTION_EN,
              long_description_th: LONG_DESCRIPTION_TH,
            },
          },
        ],
      },
    })
    logger.info(`[seed-stack] refreshed product metadata + long_description`)
    await ensureStackInventoryLevels({ container })
    return
  }

  // --- 3. Look up sales channel + shipping profile ---------------------------
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    logger.error("[seed-stack] no default sales channel found — run the main seed first")
    return
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[seed-stack] no default shipping profile found — run the main seed first")
    return
  }

  // --- 4. Create the stack product ------------------------------------------
  logger.info(`[seed-stack] creating product "${STACK_HANDLE}"...`)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Recomp Stack: CJC-1295 + Ipamorelin + AOD 9604",
          handle: STACK_HANDLE,
          category_ids: [stackCategoryId],
          description: STACK_DESCRIPTION,
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            ...STACK_METADATA,
            long_description: LONG_DESCRIPTION_EN,
            long_description_th: LONG_DESCRIPTION_TH,
          },
          options: [{ title: "Size", values: ["3 × 5mg Stack"] }],
          variants: [
            {
              title: "3 × 5mg Stack",
              sku: "STACK-RECOMP-CIA",
              options: { Size: "3 × 5mg Stack" },
              manage_inventory: true,
              prices: [
                { amount: 24900, currency_code: "usd" }, // $249
                { amount: 850000, currency_code: "thb" }, // ฿8,500
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  logger.info(`[seed-stack] created stack product successfully`)

  // Seed inventory level so add-to-cart works (variant has manage_inventory=true)
  await ensureStackInventoryLevels({ container })

  logger.info(`[seed-stack] storefront URL: /shop/stacks`)
}
