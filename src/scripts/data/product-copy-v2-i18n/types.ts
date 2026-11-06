/**
 * Shared type for the per-locale product copy (copy v2). Every locale module must
 * export a `ProductCopyLocale`; a missing or extra key fails tsc.
 *
 * Translator rules:
 *  - Translate every string value. Keep the `{placeholder}` tokens exactly as they are
 *    (the script refuses a locale whose tokens differ from English).
 *  - Do NOT translate brand names (Wolf Biotech, FourNines Research, Supreme Biologics,
 *    Calyssee), product/compound names (BPC-157, Monera, Rittera …), CAS numbers,
 *    molecular formulas, receptor/gene symbols (GLP-1, KISS1R, VEGFR2 …) or units.
 *  - Keep `**` bold markers where English has them. A heading must not start with the
 *    local word for "Preparation" (the storefront replaces such sections).
 *  - No dosing, routes, protocols, schedules, combinations or outcome verbs
 *    (heals/repairs/restores/treats/improves …) in any language.
 *  - Storage rule: never "28 days"; reconstituted/opened = 2–8°C, use within 30 days.
 */

export const LOCALES = ["en", "th", "de", "es", "fr", "it", "sv", "no", "da", "nl", "ar"] as const
export type Locale = (typeof LOCALES)[number]

export type CompoundKey =
  | "bpc-157"
  | "aod-9604"
  | "cjc-1295-no-dac"
  | "cjc-1295"
  | "dsip"
  | "epithalon"
  | "ghk-cu"
  | "ipamorelin"
  | "kisspeptin-10"
  | "kpv"
  | "tirzepatide"
  | "retatrutide"
  | "mots-c"
  | "nad-plus"
  | "pt-141"
  | "selank"
  | "semax"
  | "ss-31"
  | "tesamorelin"
  | "thymosin-beta-4"
  | "bacteriostatic-water"
  | "acetic-acid-water"
  | "dual-chamber-device"

export type DiluentKey = "bacteriostatic-water" | "acetic-acid-water"

export type Kind = "vial" | "pen" | "multidose" | "dual" | "spray" | "diluent" | "device"

export type ResearchPoint = { label: string; text: string }

export type CompoundText = {
  /** Short identity phrase used in the short description. */
  identity: string
  /** "What it is" paragraph. `{name}` = product display name (untranslated). */
  whatItIs: string
  /** Research-context bullets: bold label + text. */
  research: ResearchPoint[]
}

export type ProductCopyLocale = {
  compounds: Record<CompoundKey, CompoundText>
  /** Generic item names: `title` at the start of sentences/titles, `noun` inside sentences. */
  diluentNames: Record<DiluentKey, { title: string; noun: string }>
  headings: {
    whatItIs: string
    researchContext: string
    laboratoryUse: string
    compatibility: string
    quality: string
    storage: string
    inTheBox: string
    manufacturer: string
  }
  /** Format names used in "other formats" lists. */
  formats: Record<Kind, string>
  list: { separator: string; lastSeparator: string }
  /** "{name} {size}" — order of name and amount. */
  sized: string
  quality: {
    purity: string
    purityUnknown: string
    cas: string
    formula: string
    coaRef: string
    deviceNoCoa: string
    deviceInspect: string
    compositionBac: string
    compositionAa: string
    checkLot: string
    checkSolution: string
  }
  storage: {
    powder: string[]
    dualDry: string[]
    dualWithDiluent: string[]
    liquid: string[]
    device: string[]
    aceticAcid: string[]
    bacRoomTemp: string[]
    bacLabel: string[]
  }
  box: {
    vial: string[]
    pen: string[]
    multidose: string[]
    dualOptions: string
    dualWithDiluentIntro: string
    dualWithDiluentNote: string
    dualDryIntro: string
    dualDryNote: string
    deviceSoldSeparately: string
    defaultCartridgeCount: string
    spray: string[]
    diluent: string
    diluentNoSize: string
    device: string[]
  }
  manufacturer: {
    vial: string
    pen: string
    multidose: string
    dual: string
    dualCustom: string
    spray: string
    diluent: string
    diluentNoSize: string
    device: string
    otherFormats: string
    alsoAvailable: string
    sizedFormat: string
    delivery: string
    researchUse: string
  }
  short: {
    lead: string
    vial: string
    pen: string
    multidose: string
    dual: string
    spray: string
    diluent: string
    device: string
    /** Must be the last words of every short description. */
    suffix: string
  }
}
