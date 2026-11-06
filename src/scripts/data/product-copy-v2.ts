/**
 * Product copy v2 — NON-TRANSLATABLE data (names, flags, handle map, brands).
 * All translatable text lives in ./product-copy-v2-i18n/<locale>.ts (type ProductCopyLocale).
 * The script product-copy-v2-20261106.ts composes both with product metadata.
 */
import type { CompoundKey } from "./product-copy-v2-i18n/types"

export type ResearchHeadingKey = "researchContext" | "laboratoryUse" | "compatibility"

export type CompoundMeta = {
  /** Display name (product/compound name — never translated). */
  name: string
  /** Heading key for the research section. */
  researchHeading: ResearchHeadingKey
  /** True when CAS / formula from sibling products of this compound may be shown. */
  shareIdentityData: boolean
}

const peptide = (name: string, shareIdentityData = true): CompoundMeta => ({ name, researchHeading: "researchContext", shareIdentityData })

export const COMPOUND_META: Record<CompoundKey, CompoundMeta> = {
  "bpc-157": peptide("BPC-157"),
  "aod-9604": peptide("AOD-9604"),
  "cjc-1295-no-dac": peptide("CJC-1295 (no DAC)"),
  "cjc-1295": peptide("CJC-1295", false),
  dsip: peptide("DSIP"),
  epithalon: peptide("Epithalon"),
  "ghk-cu": peptide("GHK-Cu"),
  ipamorelin: peptide("Ipamorelin"),
  "kisspeptin-10": peptide("Kisspeptin-10"),
  kpv: peptide("KPV"),
  tirzepatide: peptide("Tirzepatide"),
  retatrutide: peptide("Retatrutide"),
  "mots-c": peptide("MOTS-c"),
  "nad-plus": peptide("NAD+"),
  "pt-141": peptide("PT-141"),
  selank: peptide("Selank"),
  semax: peptide("Semax"),
  "ss-31": peptide("SS-31"),
  tesamorelin: peptide("Tesamorelin"),
  "thymosin-beta-4": peptide("Thymosin Beta-4"),
  "bacteriostatic-water": { name: "Bacteriostatic Water", researchHeading: "laboratoryUse", shareIdentityData: false },
  "acetic-acid-water": { name: "Acetic Acid Water", researchHeading: "laboratoryUse", shareIdentityData: false },
  "dual-chamber-device": { name: "Dual Chamber Cartridge Device", researchHeading: "compatibility", shareIdentityData: false },
}

/** handle -> compound key, plus a display name where the brand uses a trade name. */
export type ProductCopyRef = { compound: CompoundKey; displayName?: string }

export const PRODUCT_COMPOUND: Record<string, ProductCopyRef> = {
  "acetic-acid-water-3ml-wolf": { compound: "acetic-acid-water" },
  "aod-9604-5mg-multi-dose-pen-supreme-biologics": { compound: "aod-9604" },
  "aod-9604-5mg-supreme-biologics": { compound: "aod-9604" },
  "aod-9604-5mg-wolf": { compound: "aod-9604" },
  "aod-9604-dual-chamber-supreme-biologics": { compound: "aod-9604" },
  "bacteriostatic-water-10ml-supreme-biologics": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-10ml-wolf": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-3ml-supreme-biologics": { compound: "bacteriostatic-water" },
  "bacteriostatic-water-3ml-wolf": { compound: "bacteriostatic-water" },
  "bpc-157-5mg-fournines": { compound: "bpc-157" },
  "bpc-157-5mg-multi-dose-pen-supreme-biologics": { compound: "bpc-157" },
  "bpc-157-5mg-supreme-biologics": { compound: "bpc-157" },
  "bpc-157-5mg-wolf": { compound: "bpc-157" },
  "bpc-157-dual-chamber-supreme-biologics": { compound: "bpc-157" },
  "cjc-1295-5mg-multi-dose-pen-supreme-biologics": { compound: "cjc-1295" },
  "cjc-1295-no-dac-5mg-fournines": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-5mg-supreme-biologics": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-5mg-wolf": { compound: "cjc-1295-no-dac" },
  "cjc-1295-no-dac-dual-chamber-supreme-biologics": { compound: "cjc-1295-no-dac" },
  "dsip-5mg-fournines": { compound: "dsip" },
  "dsip-5mg-supreme-biologics": { compound: "dsip" },
  "dsip-5mg-wolf": { compound: "dsip" },
  "dsip-dual-chamber-supreme-biologics": { compound: "dsip" },
  "dual-chamber-injector-supreme-biologics": { compound: "dual-chamber-device" },
  "epithalon-50mg-fournines": { compound: "epithalon" },
  "epithalon-50mg-multi-dose-pen-supreme-biologics": { compound: "epithalon" },
  "epithalon-50mg-supreme-biologics": { compound: "epithalon" },
  "epithalon-50mg-wolf": { compound: "epithalon" },
  "epithalon-dual-chamber-supreme-biologics": { compound: "epithalon" },
  "ghk-cu-50mg-calyssee": { compound: "ghk-cu" },
  "ghk-cu-50mg-fournines": { compound: "ghk-cu" },
  "ghk-cu-50mg-multi-dose-pen-supreme-biologics": { compound: "ghk-cu" },
  "ghk-cu-50mg-supreme-biologics": { compound: "ghk-cu" },
  "ghk-cu-50mg-wolf": { compound: "ghk-cu" },
  "ipamorelin-5mg-fournines": { compound: "ipamorelin" },
  "ipamorelin-5mg-multi-dose-pen-supreme-biologics": { compound: "ipamorelin" },
  "ipamorelin-5mg-supreme-biologics": { compound: "ipamorelin" },
  "ipamorelin-5mg-wolf": { compound: "ipamorelin" },
  "ipamorelin-dual-chamber-supreme-biologics": { compound: "ipamorelin" },
  "kisspeptin-10-5mg-supreme-biologics": { compound: "kisspeptin-10" },
  "kisspeptin-10-5mg-wolf": { compound: "kisspeptin-10" },
  "kisspeptin-10-dual-chamber-supreme-biologics": { compound: "kisspeptin-10" },
  "kpv-5mg-multi-dose-pen-supreme-biologics": { compound: "kpv" },
  "kpv-5mg-supreme-biologics": { compound: "kpv" },
  "kpv-5mg-wolf": { compound: "kpv" },
  "kpv-dual-chamber-supreme-biologics": { compound: "kpv" },
  "monera-20mg-multi-dose-pen-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "monera-5mg-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "monera-dual-chamber-supreme-biologics": { compound: "tirzepatide", displayName: "Monera" },
  "mots-c-10mg-fournines": { compound: "mots-c" },
  "mots-c-10mg-supreme-biologics": { compound: "mots-c" },
  "mots-c-10mg-wolf": { compound: "mots-c" },
  "mots-c-dual-chamber-supreme-biologics": { compound: "mots-c" },
  "nad-plus-100mg-fournines": { compound: "nad-plus" },
  "nad-plus-100mg-supreme-biologics": { compound: "nad-plus" },
  "nad-plus-100mg-wolf": { compound: "nad-plus" },
  "nad-plus-dual-chamber-supreme-biologics": { compound: "nad-plus" },
  "pt-141-10mg-calyssee": { compound: "pt-141" },
  "pt-141-10mg-multi-dose-pen-supreme-biologics": { compound: "pt-141" },
  "pt-141-10mg-supreme-biologics": { compound: "pt-141" },
  "pt-141-10mg-wolf": { compound: "pt-141" },
  "pt-141-150mg-nasal-spray-calyssee": { compound: "pt-141" },
  "pt-141-150mg-nasal-spray-supreme-biologics": { compound: "pt-141" },
  "pt-141-dual-chamber-supreme-biologics": { compound: "pt-141" },
  "retatrutide-5mg-calyssee": { compound: "retatrutide" },
  "retatrutide-5mg-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "retatrutide-5mg-wolf": { compound: "retatrutide" },
  "retatrutide-dual-chamber-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "rittera-5mg-multi-dose-pen-supreme-biologics": { compound: "retatrutide", displayName: "Rittera" },
  "selank-45mg-nasal-spray-fournines": { compound: "selank" },
  "selank-5mg-multi-dose-pen-supreme-biologics": { compound: "selank" },
  "selank-5mg-supreme-biologics": { compound: "selank" },
  "selank-5mg-wolf": { compound: "selank" },
  "semax-45mg-nasal-spray-supreme-biologics": { compound: "semax" },
  "semax-5mg-multi-dose-pen-supreme-biologics": { compound: "semax" },
  "semax-5mg-supreme-biologics": { compound: "semax" },
  "semax-5mg-wolf": { compound: "semax" },
  "semax-dual-chamber-supreme-biologics": { compound: "semax" },
  "ss-31-10mg-fournines": { compound: "ss-31" },
  "ss-31-10mg-multi-dose-pen-supreme-biologics": { compound: "ss-31" },
  "ss-31-10mg-supreme-biologics": { compound: "ss-31" },
  "ss-31-10mg-wolf": { compound: "ss-31" },
  "ss-31-dual-chamber-supreme-biologics": { compound: "ss-31" },
  "tesamorelin-5mg-fournines": { compound: "tesamorelin" },
  "tesamorelin-5mg-supreme-biologics": { compound: "tesamorelin" },
  "tesamorelin-5mg-wolf": { compound: "tesamorelin" },
  "tesamorelin-dual-chamber-supreme-biologics": { compound: "tesamorelin" },
  "thymosin-beta-4-10mg-fournines": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-10mg-supreme-biologics": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-10mg-wolf": { compound: "thymosin-beta-4" },
  "thymosin-beta-4-dual-chamber-supreme-biologics": { compound: "thymosin-beta-4" },
  "tirzepatide-5mg-fournines": { compound: "tirzepatide" },
  "tirzepatide-5mg-wolf": { compound: "tirzepatide" },
}


/** metadata.producent -> full brand name shown in copy (never translated). */
export const BRANDS: Record<string, string> = {
  Wolf: "Wolf Biotech",
  FourNines: "FourNines Research",
  "Supreme Biologics": "Supreme Biologics",
  Calyssee: "Calyssee",
}
