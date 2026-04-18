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
 * Wolverine Stack — BPC-157 5mg + Thymosin Beta-4 5mg, Calyssee branded.
 * 2-peptide soft-tissue recovery stack. Premium positioning, heavy on
 * recovery and connective-tissue repair.
 *
 *   npx medusa exec ./src/scripts/seed-stack-wolverine.ts
 */

const STACK_HANDLE = "wolverine-stack-bpc-tb4-calyssee"
const LEGACY_HANDLES: string[] = []
const STACK_TITLE = "Wolverine Stack: BPC-157 + Thymosin Beta-4 — Calyssee"
const STACK_SKU = "C-STACK-WOLV"
const STACK_CATEGORY_HANDLES = ["stacks"] as const

const STACK_DESCRIPTION =
  "Research stack pairing two regenerative peptides: BPC-157 (gastric-derived pentadecapeptide driving angiogenesis) and Thymosin Beta-4 (synthetic fragment promoting cell migration and actin remodelling). Aggressive recovery protocol for soft-tissue injury research. ≥99% HPLC verified."

const STACK_METADATA = {
  producent: "Calyssee",
  purity_percentage: "99",
  molecular_formula: "",
  cas_number: "",
  form: "Lyophilized Powder (2 vials)",
  storage: "-20°C long-term / 2–8°C reconstituted, use within 30 days.",
  size: "BPC 5mg + TB4 5mg",
  stack_composition: "BPC-157 5mg, Thymosin Beta-4 5mg",
  benefit_fat_loss: "2",
  benefit_muscle: "4",
  benefit_recovery: "5",
  benefit_anti_aging: "3",
  benefit_performance: "4",
  benefit_sleep: "3",
} as const

const LONG_DESCRIPTION_EN = `The Wolverine Stack is a two-peptide research protocol designed for aggressive soft-tissue recovery — pairing BPC-157, the 15-amino-acid pentadecapeptide derived from gastric protective protein, with Thymosin Beta-4, the 43-amino-acid actin-sequestering peptide. Each vial is independently HPLC-verified at ≥99% purity and ships with a full Certificate of Analysis.

These two peptides target complementary, non-overlapping pathways in the soft-tissue repair cascade. BPC-157 drives angiogenesis via VEGFR2 signaling and acts locally when injected near the lesion; Thymosin Beta-4 operates systemically, promoting cell migration and endothelial recruitment across multiple tissue compartments. The combination is the most-cited peptide stack in preclinical tendon, ligament, and muscle-belly injury research.

**Research Applications**
• **Tendon & ligament repair** — additive effects across angiogenesis and cell migration axes.
• **Muscle tissue recovery** — post-injury regeneration and reduced scar formation in preclinical models.
• **Mucosal & gut research** — BPC-157 cytoprotection combined with systemic TB4 repair signaling.
• **Surgical recovery models** — investigation of coordinated healing across wound healing phases.

**Preparation**
Reconstitute each vial with 2mL bacteriostatic water along the interior wall (never directly into powder). Yields 2.5 mg/mL per vial. On a U-100 insulin syringe, 10 IU = 0.1 mL = 250 mcg. Standard research protocol: BPC-157 250 mcg SC 1–2× daily local to injury; TB4 2.5 mg SC 2–3× weekly systemic.`

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
    logger.warn("[seed-wolverine] no stock location, skipping")
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
  logger.info(`[seed-wolverine] seeded ${levels.length} inventory level(s)`)
}

export default async function seedStackWolverine({ container }: ExecArgs) {
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
  if (categoryIds.length === 0) {
    logger.warn(`[seed-wolverine] no categories matched [${STACK_CATEGORY_HANDLES.join(", ")}]`)
  }

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: [STACK_HANDLE, ...LEGACY_HANDLES] },
  })

  if (existing.length > 0) {
    const productId = (existing[0] as { id: string }).id
    logger.info(`[seed-wolverine] updating existing ${productId}`)
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
    logger.error("[seed-wolverine] no default sales channel")
    return
  }
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[seed-wolverine] no default shipping profile")
    return
  }

  logger.info(`[seed-wolverine] creating ${STACK_HANDLE}`)
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: STACK_TITLE,
          handle: STACK_HANDLE,
          category_ids: categoryIds,
          description: STACK_DESCRIPTION,
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          metadata: { ...STACK_METADATA, long_description: LONG_DESCRIPTION_EN, legacy_handles: LEGACY_HANDLES },
          options: [{ title: "Size", values: ["BPC 5mg + TB4 5mg"] }],
          variants: [
            {
              title: "BPC 5mg + TB4 5mg",
              sku: STACK_SKU,
              options: { Size: "BPC 5mg + TB4 5mg" },
              manage_inventory: true,
              prices: [
                { amount: 12900, currency_code: "usd" },
                { amount: 450000, currency_code: "thb" },
                { amount: 11900, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })

  await ensureStackInventoryLevels({ container })
  logger.info(`[seed-wolverine] done`)
}
