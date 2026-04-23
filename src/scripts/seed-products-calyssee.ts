import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS, PEPTIDES, composeLongDescription, upsertProduct } from "./seed-products-shared"

/**
 * Seed the 4 Calyssee single-peptide products.
 * ghk-cu-50mg-calyssee already exists (renamed in seed-rename-existing.ts).
 * Stacks (Wolverine + GLOW) are seeded separately via seed-stack-wolverine.ts
 * and seed-stack-glow.ts.
 *
 *   npx medusa exec ./src/scripts/seed-products-calyssee.ts
 */

type CalysseeProduct = {
  peptideKey: string
  size: string
  form: "Vial" | "Spray"
  skuSuffix: string
  categoryHandles: string[]
  usd: number
  thb: number
  eur: number
}

const PRODUCTS: CalysseeProduct[] = [
  { peptideKey: "ghk-cu", size: "50mg", form: "Vial", skuSuffix: "GHKCU-50MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 62, thb: 2200, eur: 57 },
  { peptideKey: "pt-141", size: "10mg", form: "Vial", skuSuffix: "PT141-10MG", categoryHandles: ["beauty"], usd: 75, thb: 2600, eur: 69 },
  { peptideKey: "retatrutide", size: "5mg", form: "Vial", skuSuffix: "RETA-5MG", categoryHandles: ["glp-1-agonists"], usd: 219, thb: 7700, eur: 201 },
  { peptideKey: "pt-141", size: "150mg", form: "Spray", skuSuffix: "PT141-150SPRAY", categoryHandles: ["beauty"], usd: 89, thb: 3100, eur: 82 },
]

function buildHandle(peptideKey: string, size: string, form: "Vial" | "Spray"): string {
  const suffix = form === "Spray" ? `-${size.toLowerCase()}-nasal-spray` : `-${size.toLowerCase()}`
  return `${peptideKey}${suffix}-${BRANDS.calyssee.slug}`
}

function buildTitle(peptideName: string, size: string, form: "Vial" | "Spray"): string {
  const formLabel = form === "Spray" ? " Spray" : ""
  return `${peptideName} ${size}${formLabel} — ${BRANDS.calyssee.name}`
}

export default async function seedCalyssee({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  for (const p of PRODUCTS) {
    const kb = PEPTIDES[p.peptideKey]
    if (!kb) {
      logger.error(`[c-seed] no peptide KB for ${p.peptideKey}`)
      continue
    }
    const handle = buildHandle(p.peptideKey, p.size, p.form)
    const title = buildTitle(kb.displayName, p.size, p.form)
    const sku = `${BRANDS.calyssee.skuPrefix}-${p.skuSuffix}`

    const metadata: Record<string, unknown> = {
      producent: BRANDS.calyssee.name,
      purity_percentage: "99",
      molecular_formula: kb.molecularFormula,
      cas_number: kb.casNumber,
      form: p.form === "Spray" ? "Spray" : "Lyophilized Powder",
      storage: kb.storage,
      size: p.size,
    }
    for (const [k, v] of Object.entries(kb.benefits)) {
      metadata[`benefit_${k}`] = String(v)
    }

    await upsertProduct({
      container,
      handle,
      title,
      description: kb.shortDescription,
      longDescription: composeLongDescription(kb),
      categoryHandles: p.categoryHandles,
      optionTitle: "Size",
      variants: [
        {
          title: p.size,
          sku,
          optionValue: p.size,
          usd: p.usd,
          thb: p.thb,
          eur: p.eur,
        },
      ],
      metadata,
    })
    logger.info(`[c-seed] ok: ${handle}`)
  }
  logger.info(`[c-seed] seeded ${PRODUCTS.length} Calyssee single products`)
}
