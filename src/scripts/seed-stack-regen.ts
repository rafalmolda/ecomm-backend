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
 * Beauty Stack: BPC-157 + TB-500 + GHK-Cu.
 *
 * Tissue repair / recovery / skin-health focused complement to the Recomp
 * Stack. Modeled identically as a single product entity with dual USD/THB
 * pricing, bilingual metadata, and benefit ratings that lean heavy on
 * recovery, anti-aging, and skin.
 *
 *   npx medusa exec ./src/scripts/seed-stack-regen.ts
 *
 * Idempotent — if the product exists its metadata + inventory are refreshed.
 * Looks up by either the new Beauty handle or the legacy Regen handle so a
 * rename migrates the existing record in place instead of duplicating.
 */

const STACK_HANDLE = "beauty-stack-bpc-tb500-ghk"
const LEGACY_HANDLES = ["regen-stack-bpc-tb500-ghk"]
const STACK_TITLE = "Beauty Stack: BPC-157 + TB-500 + GHK-Cu"
const STACK_SKU = "STACK-BEAUTY-BTG"
const STACK_CATEGORY_NAME = "Stacks"

const STACK_DESCRIPTION =
  "Research stack pairing three regenerative peptides: BPC-157 (gastric-juice pentadecapeptide), TB-500 (synthetic thymosin-β4 fragment), and GHK-Cu (copper tripeptide) — for studies of skin remodeling, wound healing, and dermal rejuvenation. All three compounds ≥99% HPLC verified."

const STACK_METADATA = {
  title_th: "Beauty Stack: BPC-157 + TB-500 + GHK-Cu",
  description_th:
    "ชุดวิจัยที่รวม BPC-157 (pentadecapeptide จาก gastric juice), TB-500 (synthetic thymosin-β4 fragment) และ GHK-Cu (copper tripeptide) — สำหรับการศึกษาการสมานแผล, การซ่อมแซมเอ็น และการสร้างคอลลาเจน สารประกอบทั้งสาม HPLC ≥99%",
  // Stacks intentionally omit molecular_formula / cas_number — the frontend
  // hides spec tiles that don't have a real value.
  purity_percentage: "99",
  molecular_formula: "",
  cas_number: "",
  form: "Lyophilized Powder (3 vials)",
  storage: "-20°C long-term / 2–8°C reconstituted",
  size: "3 × 5mg",
  stack_composition: "BPC-157 5mg, TB-500 5mg, GHK-Cu 50mg",
  // Scale 0-5. Beauty stack leans heavy on anti-aging/skin/recovery.
  benefit_fat_loss: "2",
  benefit_muscle: "3",
  benefit_recovery: "5",
  benefit_anti_aging: "5",
  benefit_performance: "3",
  benefit_sleep: "4",
} as const

const LONG_DESCRIPTION_EN = `The Beauty Stack is our flagship recovery and tissue-repair research protocol: three complementary peptides engineered to hit the full cycle of healing — cytoprotection, angiogenesis, and collagen remodeling — in a single coordinated program. Each vial is independently HPLC-verified at ≥99% purity, ships with a full Certificate of Analysis, and is synthesized under GMP-certified conditions — BPC-157 5mg, TB-500 5mg, and GHK-Cu 50mg, with matched reconstitution protocols.

Where single-compound repair studies tend to capture only one phase of the healing cascade, the Beauty Stack targets all three in parallel: BPC-157 drives cytoprotection and GI mucosal integrity, TB-500 promotes cell migration and angiogenesis, and GHK-Cu activates copper-dependent collagen and elastin synthesis. This is the same combination researchers reach for when modeling complex soft-tissue injury, post-exercise recovery, and cutaneous remodeling.

**Research Applications:**
• **Wound Healing & Cytoprotection** — BPC-157 demonstrates remarkable stability in gastric conditions and is used across >100 published research papers studying tissue regeneration, mucosal protection, and vascular biology.
• **Cell Migration & Angiogenesis** — TB-500 is a synthetic 17-amino-acid fragment of thymosin-β4 that upregulates actin polymerization, promotes endothelial cell migration, and is a standard research tool for angiogenesis and tendon biology studies.
• **Collagen & Elastin Synthesis** — GHK-Cu is a naturally occurring copper-binding tripeptide (Gly-His-Lys) that activates TGF-β and MMP-2 pathways, driving collagen I, decorin, and elastin gene expression in dermal fibroblast research.
• **Tendon & Ligament Repair** — Paired studies investigate whether combining cytoprotective and angiogenic agents produces additive effects on musculoskeletal recovery markers.
• **Cutaneous Remodeling** — Dermal research models use the stack to study wound contraction, re-epithelialization, and age-related skin barrier function.

**Preparation:** Reconstitute each vial with bacteriostatic water (2mL recommended for 5mg vials → 2.5mg/mL; 3mL for the GHK-Cu 50mg vial → ~16.6mg/mL working concentration) by slowly dispensing water along the interior vial wall — never inject directly into the powder. Gently swirl; do not shake. Store reconstituted solutions at 2–8°C and use within 30 days. Lyophilized (unreconstituted) vials should be stored at -20°C for long-term storage.`

const LONG_DESCRIPTION_TH = `Beauty Stack คือโปรโตคอลการวิจัย recovery และ tissue repair เรือธงของเรา — เปปไทด์ 3 ชนิดที่เสริมฤทธิ์กันเพื่อครอบคลุมวงจรการสมานเนื้อเยื่อทั้งหมด ได้แก่ cytoprotection, angiogenesis และ collagen remodeling ในโปรแกรมเดียวที่ประสานกัน ทุกขวดได้รับการตรวจสอบ HPLC อิสระที่ความบริสุทธิ์ ≥99% พร้อมใบรับรองการวิเคราะห์ฉบับเต็ม และสังเคราะห์ภายใต้เงื่อนไข GMP — BPC-157 5mg, TB-500 5mg และ GHK-Cu 50mg พร้อมโปรโตคอลการผสมที่เข้าคู่กัน

ในขณะที่การศึกษา single-compound มักจับได้เพียงเฟสเดียวของ healing cascade Beauty Stack มุ่งเป้าทั้งสามเฟสพร้อมกัน: BPC-157 ขับเคลื่อน cytoprotection และความสมบูรณ์ของเยื่อเมือก, TB-500 ส่งเสริม cell migration และ angiogenesis, และ GHK-Cu กระตุ้นการสังเคราะห์ collagen และ elastin ที่พึ่งพา copper นี่คือการรวมที่นักวิจัยใช้เมื่อศึกษา soft-tissue injury แบบซับซ้อน, post-exercise recovery และ cutaneous remodeling

**การใช้งานในการวิจัย:**
• **Wound Healing & Cytoprotection** — BPC-157 มีความเสถียรในสภาวะกระเพาะอาหารที่น่าทึ่ง และถูกใช้ในงานวิจัยที่ตีพิมพ์มากกว่า 100 ฉบับในการศึกษาการสร้างเนื้อเยื่อใหม่, การปกป้อง mucosa และ vascular biology
• **Cell Migration & Angiogenesis** — TB-500 เป็น synthetic 17-amino-acid fragment ของ thymosin-β4 ที่กระตุ้น actin polymerization, ส่งเสริม endothelial cell migration และเป็นเครื่องมือมาตรฐานสำหรับการศึกษา angiogenesis และ tendon biology
• **Collagen & Elastin Synthesis** — GHK-Cu เป็น copper-binding tripeptide (Gly-His-Lys) ที่เกิดขึ้นตามธรรมชาติ กระตุ้น pathway TGF-β และ MMP-2 เพิ่มการแสดงออกของยีน collagen I, decorin และ elastin ใน dermal fibroblast
• **Tendon & Ligament Repair** — การศึกษาแบบคู่ตรวจสอบว่าการรวม cytoprotective และ angiogenic agents ให้ผลเสริมกันต่อ musculoskeletal recovery markers หรือไม่
• **Cutaneous Remodeling** — โมเดลการวิจัย dermal ใช้ Stack เพื่อศึกษา wound contraction, re-epithelialization และ age-related skin barrier function

**การเตรียม:** ผสมแต่ละขวดด้วย bacteriostatic water (แนะนำ 2mL สำหรับขวด 5mg → 2.5mg/mL; 3mL สำหรับขวด GHK-Cu 50mg → ~16.6mg/mL) โดยค่อยๆ หยดน้ำตามผนังขวดด้านใน — ห้ามฉีดตรงเข้าผง หมุนเบาๆ ห้ามเขย่า เก็บสารละลายที่ผสมแล้วที่ 2–8°C และใช้ภายใน 30 วัน ขวดแบบผงแห้งควรเก็บที่ -20°C สำหรับระยะยาว`

async function ensureStackInventoryLevels({
  container,
}: {
  container: ExecArgs["container"]
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

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
    logger.warn("[seed-regen] no stock location found, skipping inventory level seed")
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
    logger.info(`[seed-regen] inventory levels already present for stack variant`)
    return
  }

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })
  logger.info(
    `[seed-regen] seeded ${inventoryLevels.length} inventory level(s) for stack variant`
  )
}

export default async function seedStackRegen({ container }: ExecArgs) {
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
    logger.info(`[seed-regen] category "${STACK_CATEGORY_NAME}" already exists (${stackCategoryId})`)
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
    logger.info(`[seed-regen] created category "${STACK_CATEGORY_NAME}" (${stackCategoryId})`)
  }

  // --- 2. Refresh if product already exists ----------------------------------
  // Look up by the new handle OR any legacy handle so renames migrate the
  // existing record instead of creating a duplicate.
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: [STACK_HANDLE, ...LEGACY_HANDLES] },
  })
  if (existingProducts.length > 0) {
    const existingId = existingProducts[0].id as string
    const existingHandle = existingProducts[0].handle as string
    logger.info(
      `[seed-regen] product exists (${existingId}, handle="${existingHandle}"), refreshing title + handle + metadata + inventory`
    )
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: existingId,
            title: STACK_TITLE,
            handle: STACK_HANDLE,
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
    logger.info(`[seed-regen] refreshed product metadata + long_description`)
    await ensureStackInventoryLevels({ container })
    return
  }

  // --- 3. Look up sales channel + shipping profile ---------------------------
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    logger.error("[seed-regen] no default sales channel found — run the main seed first")
    return
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[seed-regen] no default shipping profile found — run the main seed first")
    return
  }

  // --- 4. Create the stack product ------------------------------------------
  logger.info(`[seed-regen] creating product "${STACK_HANDLE}"...`)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: STACK_TITLE,
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
          options: [{ title: "Size", values: ["BPC 5mg + TB 5mg + GHK 50mg"] }],
          variants: [
            {
              title: "BPC 5mg + TB 5mg + GHK 50mg",
              sku: STACK_SKU,
              options: { Size: "BPC 5mg + TB 5mg + GHK 50mg" },
              manage_inventory: true,
              prices: [
                { amount: 21900, currency_code: "usd" }, // $219
                { amount: 750000, currency_code: "thb" }, // ฿7,500
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  logger.info(`[seed-regen] created stack product successfully`)

  await ensureStackInventoryLevels({ container })

  logger.info(`[seed-regen] storefront URL: /shop/stacks`)
}
