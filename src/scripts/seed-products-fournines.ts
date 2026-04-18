import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS, PEPTIDES, composeLongDescription, upsertProduct } from "./seed-products-shared"

/**
 * Seed all 10 FourNines branded products.
 * thymosin-beta-4-10mg-fournines already exists (renamed in seed-rename-existing.ts).
 *
 *   npx medusa exec ./src/scripts/seed-products-fournines.ts
 */

type FNProduct = {
  peptideKey: string
  size: string
  form: "Vial" | "Nasal Spray"
  skuSuffix: string
  categoryHandles: string[]
  usd: number
  thb: number
  eur: number
}

const PRODUCTS: FNProduct[] = [
  { peptideKey: "bpc-157", size: "5mg", form: "Vial", skuSuffix: "BPC-5MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 65, thb: 2300, eur: 60 },
  { peptideKey: "thymosin-beta-4", size: "10mg", form: "Vial", skuSuffix: "TB4-10MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 70, thb: 2450, eur: 64 },
  { peptideKey: "ghk-cu", size: "50mg", form: "Vial", skuSuffix: "GHKCU-50MG", categoryHandles: ["skin-&-tissue", "beauty"], usd: 74, thb: 2600, eur: 68 },
  { peptideKey: "cjc-1295-no-dac", size: "5mg", form: "Vial", skuSuffix: "CJC-5MG", categoryHandles: ["growth-hormone"], usd: 54, thb: 1900, eur: 50 },
  { peptideKey: "ipamorelin", size: "5mg", form: "Vial", skuSuffix: "IPA-5MG", categoryHandles: ["growth-hormone"], usd: 50, thb: 1750, eur: 46 },
  { peptideKey: "dsip", size: "5mg", form: "Vial", skuSuffix: "DSIP-5MG", categoryHandles: ["cellular-repair", "cognitive"], usd: 54, thb: 1900, eur: 50 },
  { peptideKey: "epithalon", size: "50mg", form: "Vial", skuSuffix: "EPITH-50MG", categoryHandles: ["cellular-repair"], usd: 199, thb: 7000, eur: 183 },
  { peptideKey: "mots-c", size: "10mg", form: "Vial", skuSuffix: "MOTSC-10MG", categoryHandles: ["cellular-repair"], usd: 107, thb: 3750, eur: 98 },
  { peptideKey: "nad-plus", size: "100mg", form: "Vial", skuSuffix: "NAD-100MG", categoryHandles: ["cellular-repair"], usd: 78, thb: 2700, eur: 72 },
  { peptideKey: "selank", size: "45mg", form: "Nasal Spray", skuSuffix: "SEL-45SPRAY", categoryHandles: ["cognitive"], usd: 69, thb: 2400, eur: 63 },
]

function buildHandle(peptideKey: string, size: string, form: "Vial" | "Nasal Spray"): string {
  const suffix = form === "Nasal Spray" ? `-${size.toLowerCase()}-nasal-spray` : `-${size.toLowerCase()}`
  return `${peptideKey}${suffix}-${BRANDS.fournines.slug}`
}

function buildTitle(peptideName: string, size: string, form: "Vial" | "Nasal Spray"): string {
  const formLabel = form === "Nasal Spray" ? " Nasal Spray" : ""
  return `${peptideName} ${size}${formLabel} — ${BRANDS.fournines.name}`
}

export default async function seedFourNines({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  for (const p of PRODUCTS) {
    const kb = PEPTIDES[p.peptideKey]
    if (!kb) {
      logger.error(`[4n-seed] no peptide KB for ${p.peptideKey}`)
      continue
    }
    const handle = buildHandle(p.peptideKey, p.size, p.form)
    const title = buildTitle(kb.displayName, p.size, p.form)
    const sku = `${BRANDS.fournines.skuPrefix}-${p.skuSuffix}`

    const metadata: Record<string, unknown> = {
      producent: BRANDS.fournines.name,
      purity_percentage: "99",
      molecular_formula: kb.molecularFormula,
      cas_number: kb.casNumber,
      form: p.form === "Nasal Spray" ? "Nasal Spray" : "Lyophilized Powder",
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
    logger.info(`[4n-seed] ok: ${handle}`)
  }
  logger.info(`[4n-seed] seeded ${PRODUCTS.length} FourNines products`)
}
