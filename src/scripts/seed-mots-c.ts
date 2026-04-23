import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const PRODUCT_HANDLE = "mots-c-10mg"
const PRODUCT_TITLE = "MOTS-C 10mg"
const PRODUCT_SUBTITLE = "Mitochondrial-derived peptide for metabolic and longevity research"
const PRODUCT_SKU = "MOTSC-10MG"
const CATEGORY_NAME = "Cellular Repair"

const PRODUCT_DESCRIPTION =
  "Mitochondrial-encoded 16-amino-acid peptide that activates AMPK and regulates metabolic homeostasis. A standard tool for insulin sensitivity, exercise biology, and longevity research."

const PRODUCT_METADATA = {
  title_th: "MOTS-C 10mg",
  description_th:
    "เปปไทด์ 16 กรดอะมิโนที่เข้ารหัสจาก mitochondria กระตุ้น AMPK และควบคุม metabolic homeostasis — เครื่องมือมาตรฐานสำหรับการศึกษา insulin sensitivity, exercise biology และ longevity",
  producent: "Supreme Biogenetics",
  purity_percentage: "99",
  molecular_formula: "C80H113N19O24S",
  cas_number: "1627580-64-6",
  form: "Lyophilized Powder",
  storage: "-20°C long-term / 2–8°C reconstituted",
  size: "10mg",
  // Scale 0–5. MOTS-C leans on metabolism, performance, anti-aging, cognitive.
  benefit_fat_loss: "4",
  benefit_muscle: "2",
  benefit_recovery: "3",
  benefit_anti_aging: "4",
  benefit_performance: "4",
  benefit_sleep: "1",
  benefit_cognitive: "3",
  benefit_skin_hair: "1",
  benefit_gut_health: "1",
  benefit_immunity: "2",
} as const

const LONG_DESCRIPTION_EN = `MOTS-C (Mitochondrial Open Reading Frame of the Twelve S rRNA type-C) is a 16-amino-acid peptide encoded within mitochondrial DNA — the first characterized member of a new class of mitochondrial-derived peptides (MDPs). Unlike traditional peptides that originate from nuclear DNA, MOTS-C is transcribed and translated directly from the 12S ribosomal RNA region of the mitochondrial genome, positioning it as a direct biochemical signal from the mitochondria to the nucleus and wider cellular machinery.

Pharmaceutical-grade, HPLC-verified to ≥99% purity, with full Certificate of Analysis. Sequence: MRWQEMGYIFYPRKLR.

**Research Applications**
• **AMPK activation & metabolic homeostasis** — MOTS-C directly activates AMP-activated protein kinase (AMPK), a master regulator of cellular energy balance, making it a standard tool for studying glucose uptake, fatty acid oxidation, and mitochondrial biogenesis.
• **Insulin sensitivity studies** — research models consistently show MOTS-C improves insulin sensitivity and attenuates diet-induced obesity in rodents through AMPK-mediated pathways, independent of body weight change.
• **Exercise mimetic research** — endogenous MOTS-C rises with exercise; exogenous administration mimics several exercise-induced adaptations (enhanced glucose handling, improved mitochondrial function), making it a reference tool for exercise-mimetic studies.
• **Longevity & healthspan** — circulating MOTS-C declines with age in humans, and centenarians carry higher baseline levels. Age-related decline makes it a model peptide for metabolic healthspan and cellular senescence research.
• **Neurometabolic & cognitive studies** — emerging research examines MOTS-C effects on neuronal energy metabolism and neurodegenerative models linked to mitochondrial dysfunction.

**Preparation**
Reconstitute with bacteriostatic water (recommended 2mL for the 10mg vial → 5mg/mL) by slowly dispensing water along the interior vial wall — never inject directly into the powder. Gently swirl; do not shake. Store reconstituted solution at 2–8°C and use within 30 days. Lyophilized (unreconstituted) vial should be stored at -20°C for long-term storage.`

const LONG_DESCRIPTION_TH = `MOTS-C (Mitochondrial Open Reading Frame of the Twelve S rRNA type-C) เป็นเปปไทด์ 16 กรดอะมิโนที่เข้ารหัสภายใน mitochondrial DNA — สมาชิกแรกของกลุ่มใหม่ของ mitochondrial-derived peptides (MDPs) ต่างจากเปปไทด์ทั่วไปที่มีต้นกำเนิดจาก nuclear DNA, MOTS-C ถูก transcribe และ translate โดยตรงจากบริเวณ 12S ribosomal RNA ของ mitochondrial genome ทำให้เป็นสัญญาณชีวเคมีโดยตรงจาก mitochondria ไปยังนิวเคลียสและระบบเซลล์ในวงกว้าง

ระดับเภสัชกรรม ตรวจสอบ HPLC ที่ ≥99% พร้อมใบรับรองการวิเคราะห์ฉบับเต็ม ลำดับ: MRWQEMGYIFYPRKLR

**Research Applications**
- **AMPK activation & metabolic homeostasis** — MOTS-C กระตุ้น AMP-activated protein kinase (AMPK) โดยตรง ซึ่งเป็นผู้ควบคุมหลักของ cellular energy balance ทำให้เป็นเครื่องมือมาตรฐานในการศึกษา glucose uptake, fatty acid oxidation และ mitochondrial biogenesis
- **Insulin sensitivity** — โมเดลการวิจัยแสดงว่า MOTS-C ปรับปรุง insulin sensitivity และลด diet-induced obesity ในหนูผ่าน pathway ของ AMPK โดยไม่ขึ้นกับการเปลี่ยนแปลงน้ำหนัก
- **Exercise mimetic** — MOTS-C ภายในร่างกายเพิ่มขึ้นเมื่อออกกำลังกาย การให้จากภายนอกจำลองการปรับตัวหลายอย่างที่เกิดจากการออกกำลังกาย (glucose handling ที่ดีขึ้น, mitochondrial function ที่ดีขึ้น) ทำให้เป็นเครื่องมืออ้างอิงสำหรับการศึกษา exercise-mimetic
- **Longevity & healthspan** — MOTS-C ในกระแสเลือดลดลงตามอายุในมนุษย์ และผู้ที่อายุ 100 ปีขึ้นไปมีระดับพื้นฐานสูงกว่า การลดลงตามอายุทำให้เป็นเปปไทด์โมเดลสำหรับการวิจัย metabolic healthspan และ cellular senescence
- **Neurometabolic & cognitive** — งานวิจัยใหม่ตรวจสอบผลของ MOTS-C ต่อ neuronal energy metabolism และโมเดล neurodegenerative ที่เชื่อมโยงกับ mitochondrial dysfunction

**การเตรียม**
ผสมด้วย bacteriostatic water (แนะนำ 2mL สำหรับขวด 10mg → 5mg/mL) โดยค่อยๆ หยดน้ำตามผนังขวดด้านใน — ห้ามฉีดตรงเข้าผง หมุนเบาๆ ห้ามเขย่า เก็บสารละลายที่ผสมแล้วที่ 2–8°C และใช้ภายใน 30 วัน ขวดแบบผงแห้งควรเก็บที่ -20°C สำหรับระยะยาว`

async function ensureInventoryLevels({
  container,
}: {
  container: ExecArgs["container"]
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.manage_inventory",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
    ],
    filters: { handle: PRODUCT_HANDLE },
  })

  if (products.length === 0) return
  const product = products[0] as unknown as {
    variants: {
      id: string
      manage_inventory: boolean
      inventory_items: { inventory: { id: string; location_levels: { id: string }[] } }[]
    }[]
  }

  const [stockLocation] = await stockLocationService.listStockLocations({})
  if (!stockLocation) {
    logger.warn("[seed-mots-c] no stock location found, skipping inventory level seed")
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
    logger.info(`[seed-mots-c] inventory levels already present`)
    return
  }

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })
  logger.info(`[seed-mots-c] seeded ${inventoryLevels.length} inventory level(s)`)
}

export default async function seedMotsC({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  // --- 1. Look up target category -------------------------------------------
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
    filters: { name: CATEGORY_NAME },
  })
  if (categories.length === 0) {
    logger.error(`[seed-mots-c] category "${CATEGORY_NAME}" not found — run main seed first`)
    return
  }
  const categoryId = categories[0].id as string

  // --- 2. Refresh if product already exists ---------------------------------
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: PRODUCT_HANDLE },
  })
  if (existingProducts.length > 0) {
    const existingId = existingProducts[0].id as string
    logger.info(`[seed-mots-c] product exists (${existingId}), refreshing metadata + description`)
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: existingId,
            title: PRODUCT_TITLE,
            subtitle: PRODUCT_SUBTITLE,
            description: PRODUCT_DESCRIPTION,
            metadata: {
              ...PRODUCT_METADATA,
              long_description: LONG_DESCRIPTION_EN,
              long_description_th: LONG_DESCRIPTION_TH,
            },
          },
        ],
      },
    })
    await ensureInventoryLevels({ container })
    return
  }

  // --- 3. Look up sales channel + shipping profile --------------------------
  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    logger.error("[seed-mots-c] no default sales channel found — run main seed first")
    return
  }
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[seed-mots-c] no default shipping profile found — run main seed first")
    return
  }

  // --- 4. Create the product ------------------------------------------------
  logger.info(`[seed-mots-c] creating product "${PRODUCT_HANDLE}"...`)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: PRODUCT_TITLE,
          subtitle: PRODUCT_SUBTITLE,
          handle: PRODUCT_HANDLE,
          category_ids: [categoryId],
          description: PRODUCT_DESCRIPTION,
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: {
            ...PRODUCT_METADATA,
            long_description: LONG_DESCRIPTION_EN,
            long_description_th: LONG_DESCRIPTION_TH,
          },
          options: [{ title: "Size", values: ["10mg"] }],
          variants: [
            {
              title: "10mg",
              sku: PRODUCT_SKU,
              options: { Size: "10mg" },
              manage_inventory: true,
              prices: [
                { amount: 8900, currency_code: "usd" },   // $89
                { amount: 310000, currency_code: "thb" }, // ฿3,100
                { amount: 8200, currency_code: "eur" },   // €82
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })
  logger.info(`[seed-mots-c] created product successfully`)

  await ensureInventoryLevels({ container })
  logger.info(`[seed-mots-c] storefront URL: /product/${PRODUCT_HANDLE}`)
}
