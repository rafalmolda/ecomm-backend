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

/**
 * GLOW Stack — GHK-Cu 50mg + BPC-157 10mg + NAD+ 500mg (in 10ml), Calyssee branded.
 * Premium 3-peptide skin/recovery/cellular-energy protocol. NAD+ 500mg reconstitutes
 * in 10ml, same vial footprint as 100mg presentation.
 *
 *   npx medusa exec ./src/scripts/seed-stack-glow.ts
 */

const STACK_HANDLE = "glow-stack-ghk-bpc-nad-calyssee"
const LEGACY_HANDLES: string[] = []
const STACK_TITLE = "GLOW Stack: GHK-Cu + BPC-157 + NAD+ — Calyssee"
const STACK_SKU = "C-STACK-GLOW"
const STACK_CATEGORY_HANDLES = ["stacks", "beauty"] as const

const STACK_DESCRIPTION =
  "Premium research stack combining three peptides for skin, tissue recovery, and cellular energy metabolism: GHK-Cu 50mg (copper tripeptide driving collagen synthesis), BPC-157 10mg (gastric-derived angiogenic peptide), and NAD+ 500mg in 10ml (mitochondrial coenzyme). ≥99% HPLC verified."

const STACK_METADATA = {
  producent: "Calyssee",
  purity_percentage: "99",
  molecular_formula: "",
  cas_number: "",
  form: "Lyophilized Powder (3 vials)",
  storage: "-20°C long-term / 2–8°C reconstituted, use within 30 days.",
  size: "GHK 50mg + BPC 10mg + NAD 500mg/10ml",
  stack_composition: "GHK-Cu 50mg, BPC-157 10mg, NAD+ 500mg",
  benefit_fat_loss: "2",
  benefit_muscle: "2",
  benefit_recovery: "5",
  benefit_anti_aging: "5",
  benefit_performance: "3",
  benefit_sleep: "3",
  benefit_cognitive: "3",
} as const

const LONG_DESCRIPTION_EN = `The GLOW Stack is Calyssee's premium three-peptide research protocol covering the full dermal remodelling and cellular energy axis: collagen/elastin synthesis (GHK-Cu), vascular and tissue repair (BPC-157), and mitochondrial NAD+ restoration. Each component is independently HPLC-verified at ≥99% purity, with the NAD+ component presented at 500mg reconstituting in 10ml bacteriostatic water — the same vial footprint as standard 100mg presentations, concentrated for cycle efficiency.

The three peptides operate on complementary mechanisms. GHK-Cu delivers copper ions to lysyl oxidase, activating collagen and elastin crosslinking while modulating gene expression through broad transcriptional programs. BPC-157 drives VEGFR2-mediated angiogenesis, supporting the vascular supply that quality dermal remodelling depends on. NAD+ restoration activates sirtuin enzymes (SIRT1/SIRT3), supporting DNA repair and mitochondrial biogenesis — the cellular energy foundation for sustained tissue-remodelling capacity.

**Research Applications**
• **Dermal anti-aging research** — combined collagen synthesis (GHK-Cu) + angiogenic support (BPC-157) + cellular energy (NAD+) for integrated skin-remodelling models.
• **Post-procedure recovery models** — laser, microneedling, chemical peel recovery protocols.
• **Longevity stack research** — three complementary longevity mechanisms in one integrated protocol.
• **Hair follicle biology** — GHK-Cu dermal papilla effects combined with supporting vascular and cellular-energy pathways.

**Preparation**
• **GHK-Cu 50mg**: reconstitute with 5mL bacteriostatic water → 10 mg/mL. Solution will appear blue (copper salt — normal). 10 IU on U-100 = 1 mg. Do NOT freeze reconstituted.
• **BPC-157 10mg**: reconstitute with 2mL bacteriostatic water → 5 mg/mL. 10 IU on U-100 = 500 mcg.
• **NAD+ 500mg**: reconstitute with 10mL bacteriostatic water → 50 mg/mL. 10 IU on U-100 = 5 mg. Slow administration over 10+ minutes to minimize flushing.`

async function ensureStackInventoryLevels({
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
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.location_levels.id",
    ],
    filters: { handle: STACK_HANDLE },
  })

  if (products.length === 0) return
  const product = products[0] as unknown as {
    variants: {
      id: string
      inventory_items: { inventory: { id: string; location_levels: { id: string }[] } }[]
    }[]
  }

  const [stockLocation] = await stockLocationService.listStockLocations({})
  if (!stockLocation) {
    logger.warn("[seed-glow] no stock location, skipping")
    return
  }

  const levels: CreateInventoryLevelInput[] = []
  for (const variant of product.variants) {
    for (const ii of variant.inventory_items ?? []) {
      if ((ii.inventory.location_levels ?? []).length > 0) continue
      levels.push({
        location_id: stockLocation.id,
        inventory_item_id: ii.inventory.id,
        stocked_quantity: 1_000_000,
      })
    }
  }
  if (levels.length === 0) return
  await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } })
  logger.info(`[seed-glow] seeded ${levels.length} inventory level(s)`)
}

export default async function seedStackGlow({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    filters: { handle: STACK_CATEGORY_HANDLES as unknown as string[] },
  })
  const categoryIds = categories.map((c: any) => c.id as string)
  if (categoryIds.length !== STACK_CATEGORY_HANDLES.length) {
    logger.warn(`[seed-glow] expected ${STACK_CATEGORY_HANDLES.length} categories, got ${categoryIds.length}`)
  }

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: [STACK_HANDLE, ...LEGACY_HANDLES] },
  })

  if (existing.length > 0) {
    const productId = (existing[0] as { id: string }).id
    logger.info(`[seed-glow] updating existing ${productId}`)
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: productId,
            title: STACK_TITLE,
            handle: STACK_HANDLE,
            description: STACK_DESCRIPTION,
            category_ids: categoryIds,
            metadata: { ...STACK_METADATA, long_description: LONG_DESCRIPTION_EN, legacy_handles: LEGACY_HANDLES },
          },
        ],
      },
    })
    await ensureStackInventoryLevels({ container })
    return
  }

  const [defaultSalesChannel] = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })
  if (!defaultSalesChannel) {
    logger.error("[seed-glow] no default sales channel")
    return
  }
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[seed-glow] no default shipping profile")
    return
  }

  logger.info(`[seed-glow] creating ${STACK_HANDLE}`)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: STACK_TITLE,
          handle: STACK_HANDLE,
          category_ids: categoryIds,
          description: STACK_DESCRIPTION,
          weight: 180,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: { ...STACK_METADATA, long_description: LONG_DESCRIPTION_EN, legacy_handles: LEGACY_HANDLES },
          options: [{ title: "Size", values: ["GHK 50mg + BPC 10mg + NAD 500mg"] }],
          variants: [
            {
              title: "GHK 50mg + BPC 10mg + NAD 500mg",
              sku: STACK_SKU,
              options: { Size: "GHK 50mg + BPC 10mg + NAD 500mg" },
              manage_inventory: true,
              prices: [
                { amount: 39900, currency_code: "usd" },
                { amount: 1400000, currency_code: "thb" },
                { amount: 36700, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  await ensureStackInventoryLevels({ container })
  logger.info(`[seed-glow] done`)
}
