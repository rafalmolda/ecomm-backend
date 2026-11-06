/**
 * Product copy v2 — pure composition + validation (no DB access).
 * Used by ../product-copy-v2-20261106.ts. Text comes from
 * ../data/product-copy-v2-i18n/<locale>.ts; names/flags from ../data/product-copy-v2.ts.
 */
import { BRANDS, COMPOUND_META, PRODUCT_COMPOUND } from "../data/product-copy-v2"
import { COPY_BY_LOCALE, CompoundKey, Kind, Locale, ProductCopyLocale } from "../data/product-copy-v2-i18n"

export type Variant = { title: string | null; variant_rank?: number | null }
export type ProductRow = {
  id: string
  handle: string
  title: string
  status: string
  description: string | null
  metadata: Record<string, unknown> | null
  variants?: Variant[] | null
}

export type Composed = { description: string; longDescription: string; problems: string[]; warnings: string[] }

const WHAT_MIN_WORDS = 60
const WHAT_MAX_WORDS = 90
const SHORT_MIN_WORDS = 20
const SHORT_MAX_WORDS = 30
const OVERVIEW_MAX_CHARS = 549 // productOverview() uses the first paragraph only when < 550 chars

export const FORBIDDEN_RE =
  /inject|subcutaneous|intramuscular|nasal|dose|dosing|protocol|cycle|stack|titrat|heal|repair|reverse|restore|promot|suppress|treat|improv|burn|28 days|weight-loss|fat-loss/gi

/** Heading words of the "Preparation" regex in src/lib/data/products.ts (such sections get replaced). */
const PREPARATION_HEADING_RE =
  /^(?:Preparation|การเตรียม|Vorbereitung|Zubereitung|Rekonstitution|Préparation|Preparaci[oó]n|Preparazione|Förberedelse|Beredning|Tilberedning|Preparering|Forberedelse|Klargøring|Voorbereiding|Bereiding|التحضير)/i

// ─── Small helpers ──────────────────────────────────────────────────────────

export const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim())
export const words = (s: string): number => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const fill = (tpl: string, vars: Record<string, string>): string => tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))
const bullets = (lines: string[]): string => lines.map((l) => `• ${l}`).join("\n")
const section = (heading: string, body: string): string => `**${heading}**\n${body}`
const list = (t: ProductCopyLocale, items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(t.list.separator)}${t.list.lastSeparator}${items[items.length - 1]}`
const isDiluentKey = (k: CompoundKey): k is "bacteriostatic-water" | "acetic-acid-water" =>
  k === "bacteriostatic-water" || k === "acetic-acid-water"

/** Mirrors src/lib/product-presentation.ts getProductPresentation(). */
export function kindOf(p: ProductRow): Kind {
  const meta = p.metadata ?? {}
  const form = str(meta.form)
  const slug = p.handle
  if (form === "Injector" || slug.includes("injector")) return "device"
  if (form === "Spray" || slug.includes("nasal-spray")) return "spray"
  if (form === "Multi-Dose Pen" || slug.includes("multi-dose-pen")) return "multidose"
  if (meta.producent === "Calyssee" || slug.endsWith("-calyssee")) return "pen"
  if (form === "Dual Chamber Cartridge" || slug.includes("dual-chamber")) return "dual"
  if (slug.includes("water") || form === "Solution" || form === "Sterile Solution") return "diluent"
  return "vial"
}

function normalizeSize(raw: string): string | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(mg|ml|mcg)$/i)
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null
}

/** Size from metadata.size (or handle); omitted when a single size-like variant title disagrees. */
export function sizeInfo(p: ProductRow, kind: Kind): { size: string | null; conflict: string | null } {
  if (kind === "dual" || kind === "device") return { size: null, conflict: null }
  const raw = str(p.metadata?.size) || (p.handle.match(/(\d+(?:\.\d+)?)(mg|ml)(?=-)/)?.[0] ?? "")
  const size = normalizeSize(raw)
  const variantSizes = (p.variants ?? []).map((v) => normalizeSize(str(v.title))).filter((s): s is string => Boolean(s))
  if (size && variantSizes.length === 1 && variantSizes[0] !== size) {
    return { size: null, conflict: `metadata.size "${size}" ≠ variant title "${variantSizes[0]}" (size omitted from copy)` }
  }
  return { size, conflict: null }
}

// ─── Context shared between products ────────────────────────────────────────

export type Ctx = { byGroup: Map<string, ProductRow[]>; identityByCompound: Map<string, { cas: string; formula: string }> }

const groupKey = (p: ProductRow): string => `${PRODUCT_COMPOUND[p.handle].compound}|${PRODUCT_COMPOUND[p.handle].displayName ?? ""}`

export function buildCtx(products: ProductRow[]): Ctx {
  const byGroup = new Map<string, ProductRow[]>()
  const identityByCompound = new Map<string, { cas: string; formula: string }>()
  for (const p of products) {
    const ref = PRODUCT_COMPOUND[p.handle]
    if (!ref) continue
    byGroup.set(groupKey(p), [...(byGroup.get(groupKey(p)) ?? []), p])
    const cas = str(p.metadata?.cas_number)
    const formula = str(p.metadata?.molecular_formula)
    if (cas && formula && !identityByCompound.has(ref.compound)) identityByCompound.set(ref.compound, { cas, formula })
  }
  return { byGroup, identityByCompound }
}

// ─── Per-product composition ────────────────────────────────────────────────

type Item = {
  p: ProductRow
  t: ProductCopyLocale
  kind: Kind
  compound: CompoundKey
  name: string
  brand: string
  size: string | null
  sized: string
  noun: string
}

function qualityLines({ p, t, kind, compound }: Item, ctx: Ctx): string[] {
  const q = t.quality
  if (kind === "device") return [q.deviceNoCoa, q.deviceInspect]
  if (compound === "bacteriostatic-water") return [q.compositionBac, q.checkLot, q.checkSolution]
  if (compound === "acetic-acid-water") return [q.compositionAa, q.checkLot, q.checkSolution]
  const purity = str(p.metadata?.purity_percentage)
  const shared = COMPOUND_META[compound].shareIdentityData ? ctx.identityByCompound.get(compound) : undefined
  const cas = str(p.metadata?.cas_number) || shared?.cas || ""
  const formula = str(p.metadata?.molecular_formula) || shared?.formula || ""
  return [
    purity ? fill(q.purity, { purity }) : q.purityUnknown,
    ...(cas ? [fill(q.cas, { cas })] : []),
    ...(formula ? [fill(q.formula, { formula })] : []),
    q.coaRef,
  ]
}

function storageLines({ p, t, kind, compound }: Item): string[] {
  const s = t.storage
  if (kind === "device") return s.device
  if (compound === "acetic-acid-water") return s.aceticAcid
  if (compound === "bacteriostatic-water") return /room temperature/i.test(str(p.metadata?.storage)) ? s.bacRoomTemp : s.bacLabel
  if (kind === "dual") return p.metadata?.diluent_included === true ? s.dualWithDiluent : s.dualDry
  if (kind === "pen" || kind === "multidose" || kind === "spray") return s.liquid
  return s.powder
}

function boxLines({ p, t, kind, brand, size, sized, noun }: Item): string[] {
  const b = t.box
  const vars = { brand, sized, size: size ?? "", noun }
  const options = (p.variants ?? []).map((v) => str(v.title)).filter(Boolean).join(", ")
  const optionLine = options ? [fill(b.dualOptions, { options })] : []
  switch (kind) {
    case "vial": return b.vial.map((l) => fill(l, vars))
    case "pen": return b.pen.map((l) => fill(l, vars))
    case "multidose": return b.multidose.map((l) => fill(l, vars))
    case "spray": return b.spray.map((l) => fill(l, vars))
    case "device": return b.device
    case "diluent": return [fill(size ? b.diluent : b.diluentNoSize, vars)]
    case "dual":
      if (p.metadata?.diluent_included === true) {
        const count = str(p.metadata?.cartridges_per_box) || b.defaultCartridgeCount
        return [fill(b.dualWithDiluentIntro, { count }), ...optionLine, b.dualWithDiluentNote, b.deviceSoldSeparately]
      }
      return [b.dualDryIntro, ...optionLine, b.dualDryNote, b.deviceSoldSeparately]
  }
}

function brandLines({ p, t, kind, name, brand, size, noun }: Item): string[] {
  const m = t.manufacturer
  const vars = { brand, name, size: size ?? "", noun }
  switch (kind) {
    case "dual": return [fill(m.dual, vars), ...(p.metadata?.diluent_included === true ? [] : [m.dualCustom])]
    case "diluent": return [fill(size ? m.diluent : m.diluentNoSize, vars)]
    default: return [fill(m[kind], vars)]
  }
}

function manufacturerLines(item: Item, ctx: Ctx): string[] {
  const { p, t, kind, name, brand } = item
  const lines = brandLines(item)
  const siblings = (ctx.byGroup.get(groupKey(p)) ?? []).filter((s) => s.handle !== p.handle)
  const producent = str(p.metadata?.producent)
  const sameBrand = siblings.filter((s) => str(s.metadata?.producent) === producent)
  if (sameBrand.length) {
    const labels = [...new Set(sameBrand.map((s) => {
      const sKind = kindOf(s)
      const sSize = sizeInfo(s, sKind).size
      const withSize = (sKind === "diluent" || sKind === kind) && sSize
      return withSize ? fill(t.manufacturer.sizedFormat, { size: sSize, format: t.formats[sKind] }) : t.formats[sKind]
    }))]
    lines.push(fill(t.manufacturer.otherFormats, { brand, list: list(t, labels) }))
  }
  const otherBrands = [...new Set(siblings.map((s) => str(s.metadata?.producent)).filter((b) => b && b !== producent))]
    .map((b) => BRANDS[b] ?? b)
    .sort()
  if (otherBrands.length) lines.push(fill(t.manufacturer.alsoAvailable, { name, list: list(t, otherBrands) }))
  return [...lines, t.manufacturer.delivery, t.manufacturer.researchUse]
}

function shortDescription({ t, kind, compound, brand, sized }: Item): string {
  const c = t.compounds[compound]
  const s = t.short
  if (kind === "device") {
    const identityCapitalized = c.identity.charAt(0).toUpperCase() + c.identity.slice(1)
    return fill(s.device, { identityCapitalized, suffix: s.suffix })
  }
  const lead = fill(s.lead, { sized, identity: c.identity })
  return fill(s[kind], { lead, brand, suffix: s.suffix })
}

function validate(locale: Locale, item: Item, whatItIs: string, description: string, longDescription: string): string[] {
  const problems: string[] = []
  const producent = str(item.p.metadata?.producent)
  if (!BRANDS[producent]) problems.push(`unknown producent "${producent}"`)
  if (locale === "en") {
    const ww = words(whatItIs)
    if (ww < WHAT_MIN_WORDS || ww > WHAT_MAX_WORDS) problems.push(`"What it is" has ${ww} words (want ${WHAT_MIN_WORDS}–${WHAT_MAX_WORDS})`)
    if (whatItIs.length > OVERVIEW_MAX_CHARS) problems.push(`"What it is" has ${whatItIs.length} chars (overview needs < 550)`)
    const sw = words(description)
    if (sw < SHORT_MIN_WORDS || sw > SHORT_MAX_WORDS) problems.push(`short description has ${sw} words (want ${SHORT_MIN_WORDS}–${SHORT_MAX_WORDS})`)
  }
  // English forbidden words: on en a real problem; on other locales it catches untranslated leftovers.
  for (const [label, text] of [["description", description], ["long_description", longDescription]] as const) {
    const hits = [...new Set((text.match(FORBIDDEN_RE) ?? []).map((h) => h.toLowerCase()))]
    if (hits.length) problems.push(`forbidden wording in ${label}: ${hits.join(", ")}`)
  }
  if (!description.trim().toLowerCase().endsWith(item.t.short.suffix.trim().toLowerCase())) problems.push("short description does not end with the research-use phrase")
  if (/\{\w+\}/.test(longDescription + description)) problems.push("unreplaced {token}")
  return problems
}

export function composeProduct(p: ProductRow, locale: Locale, ctx: Ctx): Composed {
  const t = COPY_BY_LOCALE[locale]
  const ref = PRODUCT_COMPOUND[p.handle]
  const meta = COMPOUND_META[ref.compound]
  const kind = kindOf(p)
  const producent = str(p.metadata?.producent)
  const diluent = isDiluentKey(ref.compound) ? t.diluentNames[ref.compound] : null
  const name = ref.displayName ?? diluent?.title ?? meta.name
  const noun = diluent?.noun ?? name.toLowerCase()
  const { size, conflict } = sizeInfo(p, kind)
  const item: Item = {
    p, t, kind, compound: ref.compound, name, brand: BRANDS[producent] ?? producent, size, noun,
    sized: size ? fill(t.sized, { name, size }) : name,
  }
  const c = t.compounds[ref.compound]
  const whatItIs = fill(c.whatItIs, { name })
  const longDescription = [
    section(t.headings.whatItIs, whatItIs),
    section(t.headings[meta.researchHeading], bullets(c.research.map((r) => `**${r.label}** — ${r.text}`))),
    section(t.headings.quality, bullets(qualityLines(item, ctx))),
    section(t.headings.storage, bullets(storageLines(item))),
    section(t.headings.inTheBox, bullets(boxLines(item))),
    section(t.headings.manufacturer, manufacturerLines(item, ctx).join("\n")),
  ].join("\n\n")
  const description = shortDescription(item)
  const warnings = conflict ? [conflict] : []
  if (locale !== "en" && whatItIs.length > OVERVIEW_MAX_CHARS) warnings.push(`"What it is" has ${whatItIs.length} chars; PDP overview falls back to the short description`)
  return { description, longDescription, problems: validate(locale, item, whatItIs, description, longDescription), warnings }
}

// ─── Locale-module checks (run once per locale) ─────────────────────────────

const tokens = (s: string): string => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort().join(",")
const boldCount = (s: string): number => (s.match(/\*\*/g) ?? []).length

/** Leaves of a locale object as [path, value] pairs. */
function leaves(v: unknown, path = ""): [string, string][] {
  if (typeof v === "string") return [[path, v]]
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${path}[${i}]`))
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k))
  return []
}

export type LocaleCheck = {
  locale: Locale
  isStub: boolean
  strings: number
  words: number
  /** Text strings (not placeholder-only) still equal to English. */
  identicalToEn: number
  identicalPaths: string[]
  problems: string[]
}

/** True when a string has words outside its {placeholders} ("{name} {size}" has none). */
const hasText = (s: string): boolean => /\p{L}/u.test(s.replace(/\{\w+\}/g, ""))

export function checkLocaleModule(locale: Locale): LocaleCheck {
  const en = new Map(leaves(COPY_BY_LOCALE.en))
  const own = leaves(COPY_BY_LOCALE[locale])
  const ownPaths = new Set(own.map(([k]) => k))
  const problems: string[] = [...en.keys()].filter((k) => !ownPaths.has(k)).map((k) => `missing ${k} (array length differs from en?)`)
  const identicalPaths: string[] = []
  let wordCount = 0
  for (const [k, v] of own) {
    const ref = en.get(k)
    wordCount += words(v)
    if (ref === undefined) { problems.push(`extra ${k} (array length differs from en?)`); continue }
    if (v === ref && hasText(v)) identicalPaths.push(k)
    if (tokens(v) !== tokens(ref)) problems.push(`placeholders differ at ${k}: "${tokens(v)}" vs en "${tokens(ref)}"`)
    if (boldCount(v) !== boldCount(ref)) problems.push(`"**" markers differ at ${k}`)
    if (!v.trim()) problems.push(`empty string at ${k}`)
  }
  for (const [k, h] of Object.entries(COPY_BY_LOCALE[locale].headings)) {
    if (PREPARATION_HEADING_RE.test(h.trim())) problems.push(`heading ${k} "${h}" starts with a "Preparation" word (storefront would replace it)`)
    if (/[*#•]/.test(h)) problems.push(`heading ${k} contains markdown characters`)
  }
  const isStub = locale !== "en" && JSON.stringify(COPY_BY_LOCALE[locale]) === JSON.stringify(COPY_BY_LOCALE.en)
  return { locale, isStub, strings: own.length, words: wordCount, identicalToEn: identicalPaths.length, identicalPaths, problems }
}
