import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS, PEPTIDES, composeLongDescription, upsertProduct } from "./seed-products-shared"

/**
 * Seed all 12 Supreme Biologics branded products.
 * Idempotent — existing products are updated in place (including the 3 renamed
 * in seed-rename-existing.ts: bpc-157, ipamorelin, mots-c).
 *
 *   npx medusa exec ./src/scripts/seed-products-supreme-biologics.ts
 */

type SBProduct = {
  peptideKey: string
  size: string
  form: "Vial" | "Spray"
  skuSuffix: string
  categoryHandles: string[]
  usd: number
  thb: number
  eur: number
}

const PRODUCTS: SBProduct[] = [
  { peptideKey: "bpc-157", size: "5mg", form: "Vial", skuSuffix: "BPC-5MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 54, thb: 1800, eur: 50 },
  { peptideKey: "thymosin-beta-4", size: "10mg", form: "Vial", skuSuffix: "TB4-10MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 58, thb: 2000, eur: 53 },
  { peptideKey: "pt-141", size: "10mg", form: "Vial", skuSuffix: "PT141-10MG", categoryHandles: ["beauty"], usd: 65, thb: 2300, eur: 60 },
  { peptideKey: "cjc-1295-no-dac", size: "5mg", form: "Vial", skuSuffix: "CJC-5MG", categoryHandles: ["growth-hormone"], usd: 45, thb: 1600, eur: 41 },
  { peptideKey: "ipamorelin", size: "5mg", form: "Vial", skuSuffix: "IPA-5MG", categoryHandles: ["growth-hormone"], usd: 42, thb: 1500, eur: 39 },
  { peptideKey: "mots-c", size: "10mg", form: "Vial", skuSuffix: "MOTSC-10MG", categoryHandles: ["cellular-repair"], usd: 89, thb: 3100, eur: 82 },
  { peptideKey: "selank", size: "5mg", form: "Vial", skuSuffix: "SEL-5MG", categoryHandles: ["cognitive"], usd: 42, thb: 1500, eur: 39 },
  { peptideKey: "semax", size: "5mg", form: "Vial", skuSuffix: "SEM-5MG", categoryHandles: ["cognitive"], usd: 45, thb: 1600, eur: 41 },
  { peptideKey: "retatrutide", size: "5mg", form: "Vial", skuSuffix: "RETA-5MG", categoryHandles: ["glp-1-agonists"], usd: 189, thb: 6600, eur: 174 },
  { peptideKey: "nad-plus", size: "100mg", form: "Vial", skuSuffix: "NAD-100MG", categoryHandles: ["cellular-repair"], usd: 65, thb: 2300, eur: 60 },
  { peptideKey: "pt-141", size: "150mg", form: "Spray", skuSuffix: "PT141-150SPRAY", categoryHandles: ["beauty"], usd: 79, thb: 2800, eur: 73 },
  { peptideKey: "semax", size: "45mg", form: "Spray", skuSuffix: "SEM-45SPRAY", categoryHandles: ["cognitive"], usd: 69, thb: 2400, eur: 63 },
]

function buildHandle(peptideKey: string, size: string, form: "Vial" | "Spray"): string {
  const suffix = form === "Spray" ? `-${size.toLowerCase()}-nasal-spray` : `-${size.toLowerCase()}`
  return `${peptideKey}${suffix}-${BRANDS.supreme.slug}`
}

function buildTitle(peptideName: string, size: string, form: "Vial" | "Spray"): string {
  const formLabel = form === "Spray" ? " Spray" : ""
  return `${peptideName} ${size}${formLabel} — ${BRANDS.supreme.name}`
}

export default async function seedSupremeBiologics({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  for (const p of PRODUCTS) {
    const kb = PEPTIDES[p.peptideKey]
    if (!kb) {
      logger.error(`[sb-seed] no peptide KB for ${p.peptideKey}`)
      continue
    }
    const handle = buildHandle(p.peptideKey, p.size, p.form)
    const title = buildTitle(kb.displayName, p.size, p.form)
    const sku = `${BRANDS.supreme.skuPrefix}-${p.skuSuffix}`

    const metadata: Record<string, unknown> = {
      producent: BRANDS.supreme.name,
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
    logger.info(`[sb-seed] ok: ${handle}`)
  }
  logger.info(`[sb-seed] seeded ${PRODUCTS.length} Supreme Biologics products`)
}
