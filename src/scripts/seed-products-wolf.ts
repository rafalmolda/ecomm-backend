import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BRANDS, PEPTIDES, composeLongDescription, upsertProduct } from "./seed-products-shared"

/**
 * Seed all 17 Wolf branded products (producent = "Wolf").
 * Idempotent — existing products are updated in place.
 *
 *   npx medusa exec ./src/scripts/seed-products-wolf.ts
 */

type WolfProduct = {
  peptideKey: string
  size: string
  form: "Vial" | "Spray"
  skuSuffix: string
  categoryHandles: string[]
  usd: number
  thb: number
  eur: number
}

// THB is source of truth. USD = ceil(THB/33), EUR = ceil(THB/36).
const PRODUCTS: WolfProduct[] = [
  { peptideKey: "bpc-157",          size: "5mg",   form: "Vial", skuSuffix: "BPC-5MG",    categoryHandles: ["skin-&-tissue", "beauty"],          usd:  37, thb: 1200, eur:  34 },
  { peptideKey: "thymosin-beta-4",  size: "10mg",  form: "Vial", skuSuffix: "TB4-10MG",   categoryHandles: ["skin-&-tissue", "beauty"],          usd: 122, thb: 4000, eur: 112 },
  { peptideKey: "pt-141",           size: "10mg",  form: "Vial", skuSuffix: "PT141-10MG", categoryHandles: ["beauty"],                           usd:  64, thb: 2100, eur:  59 },
  { peptideKey: "cjc-1295-no-dac",  size: "5mg",   form: "Vial", skuSuffix: "CJC-5MG",    categoryHandles: ["growth-hormone"],                   usd:  76, thb: 2500, eur:  70 },
  { peptideKey: "ipamorelin",       size: "5mg",   form: "Vial", skuSuffix: "IPA-5MG",    categoryHandles: ["growth-hormone"],                   usd:  55, thb: 1800, eur:  50 },
  { peptideKey: "mots-c",           size: "10mg",  form: "Vial", skuSuffix: "MOTSC-10MG", categoryHandles: ["cellular-repair"],                  usd:  55, thb: 1800, eur:  50 },
  { peptideKey: "selank",           size: "5mg",   form: "Vial", skuSuffix: "SEL-5MG",    categoryHandles: ["cognitive"],                        usd:  46, thb: 1500, eur:  42 },
  { peptideKey: "semax",            size: "5mg",   form: "Vial", skuSuffix: "SEM-5MG",    categoryHandles: ["cognitive"],                        usd:  37, thb: 1200, eur:  34 },
  { peptideKey: "retatrutide",      size: "5mg",   form: "Vial", skuSuffix: "RETA-5MG",   categoryHandles: ["glp-1-agonists"],                   usd:  91, thb: 3000, eur:  84 },
  { peptideKey: "nad-plus",         size: "100mg", form: "Vial", skuSuffix: "NAD-100MG",  categoryHandles: ["cellular-repair"],                  usd:  76, thb: 2500, eur:  70 },
  { peptideKey: "ghk-cu",           size: "50mg",  form: "Vial", skuSuffix: "GHK-50MG",   categoryHandles: ["skin-&-tissue", "beauty"],          usd:  46, thb: 1500, eur:  42 },
  { peptideKey: "dsip",             size: "5mg",   form: "Vial", skuSuffix: "DSIP-5MG",   categoryHandles: ["cognitive"],                        usd:  40, thb: 1300, eur:  37 },
  { peptideKey: "epithalon",        size: "50mg",  form: "Vial", skuSuffix: "EPI-50MG",   categoryHandles: ["cellular-repair"],                  usd: 122, thb: 4000, eur: 112 },
  { peptideKey: "kisspeptin-10",    size: "5mg",   form: "Vial", skuSuffix: "KISS-5MG",   categoryHandles: ["growth-hormone", "beauty"],         usd:  76, thb: 2500, eur:  70 },
  { peptideKey: "bac-water",        size: "3ml",   form: "Vial", skuSuffix: "BAC-3ML",    categoryHandles: [],                                   usd:   7, thb:  200, eur:   6 },
  { peptideKey: "kpv",              size: "5mg",   form: "Vial", skuSuffix: "KPV-5MG",    categoryHandles: ["skin-&-tissue", "cellular-repair"], usd:  37, thb: 1200, eur:  34 },
  { peptideKey: "slupp-332",        size: "5mg",   form: "Vial", skuSuffix: "SLUPP-5MG",  categoryHandles: ["cellular-repair"],                  usd: 137, thb: 4500, eur: 125 },
]

function buildHandle(peptideKey: string, size: string, form: "Vial" | "Spray"): string {
  const suffix = form === "Spray" ? `-${size.toLowerCase()}-nasal-spray` : `-${size.toLowerCase()}`
  return `${peptideKey}${suffix}-${BRANDS.wolf.slug}`
}

function buildTitle(peptideName: string, size: string, form: "Vial" | "Spray"): string {
  const formLabel = form === "Spray" ? " Spray" : ""
  return `${peptideName} ${size}${formLabel} — ${BRANDS.wolf.name}`
}

export default async function seedWolf({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  for (const p of PRODUCTS) {
    const kb = PEPTIDES[p.peptideKey]
    if (!kb) {
      logger.error(`[wolf-seed] no peptide KB for ${p.peptideKey}`)
      continue
    }
    const handle = buildHandle(p.peptideKey, p.size, p.form)
    const title = buildTitle(kb.displayName, p.size, p.form)
    const sku = `${BRANDS.wolf.skuPrefix}-${p.skuSuffix}`

    // BAC Water is a preparation aid, not a research compound — skip purity/formula/CAS.
    const isBacWater = p.peptideKey === "bac-water"
    const physicalForm = isBacWater
      ? "Sterile Solution"
      : p.form === "Spray"
        ? "Spray"
        : "Lyophilized Powder"

    const metadata: Record<string, unknown> = {
      producent: BRANDS.wolf.producent,
      form: physicalForm,
      storage: kb.storage,
      size: p.size,
    }
    if (!isBacWater) {
      metadata.purity_percentage = "99"
      metadata.molecular_formula = kb.molecularFormula
      metadata.cas_number = kb.casNumber
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
    logger.info(`[wolf-seed] ok: ${handle}`)
  }
  logger.info(`[wolf-seed] seeded ${PRODUCTS.length} Wolf products`)
}
