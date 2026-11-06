import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { chmodSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import {
  BRANDS,
  COMPOUNDS,
  CompoundCopy,
  DELIVERY_LINE,
  FORMAT_LABELS,
  Kind,
  PRODUCT_COMPOUND,
  RESEARCH_USE_LINE,
  SHORT_SUFFIX,
  STORAGE,
} from "./data/product-copy-v2"

/**
 * 2026-11-06 product copy v2 — replaces the ENGLISH `description` and
 * `metadata.long_description` of every PUBLISHED product with compliant copy composed
 * from ./data/product-copy-v2.ts plus product metadata. Locale keys
 * (description_<l>, long_description_<l>) and every other metadata key are kept.
 * Draft products are skipped and listed.
 *
 *   DRY RUN (default, read-only):
 *     npx medusa exec ./src/scripts/product-copy-v2-20261106.ts
 *   APPLY (writes a mode-600 JSON backup to /root/ops first):
 *     APPLY=1 npx medusa exec ./src/scripts/product-copy-v2-20261106.ts
 *   Optional: HANDLE=<handle> limits the run; VERBOSE=1 prints the full new text.
 *
 * APPLY refuses to run when a validation check fails (coverage, word counts,
 * overview length, forbidden wording).
 */

const BACKUP_DIR = "/root/ops"
const WHAT_MIN_WORDS = 60
const WHAT_MAX_WORDS = 90
const SHORT_MIN_WORDS = 20
const SHORT_MAX_WORDS = 30
const OVERVIEW_MAX_CHARS = 549 // productOverview() uses the first paragraph only when < 550 chars
const EXCERPT_LEN = 140

const FORBIDDEN_RE =
  /inject|subcutaneous|intramuscular|nasal|dose|dosing|protocol|cycle|stack|titrat|heal|repair|reverse|restore|promot|suppress|treat|improv|burn|28 days|weight-loss|fat-loss/gi

type Variant = { title: string | null; variant_rank?: number | null }
type ProductRow = {
  id: string
  handle: string
  title: string
  status: string
  description: string | null
  metadata: Record<string, unknown> | null
  variants?: Variant[] | null
}

type Plan = {
  product: ProductRow
  kind: Kind
  brand: string
  description: string
  longDescription: string
  changedFields: ("description" | "long_description")[]
  problems: string[]
  /** Data conflicts that do not block APPLY (reported for the owner). */
  warnings: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim())
const words = (s: string): number => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const excerpt = (s: string | null): string => {
  const flat = str(s).replace(/\s+/g, " ")
  return flat.length > EXCERPT_LEN ? `${flat.slice(0, EXCERPT_LEN)}…` : flat
}

/** Mirrors src/lib/product-presentation.ts getProductPresentation(). */
function kindOf(p: ProductRow): Kind {
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

/** "5mg" -> "5 mg", "10ml" -> "10 ml"; null when the text is not a plain amount. */
function normalizeSize(raw: string): string | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(mg|ml|mcg)$/i)
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null
}

/**
 * Size from metadata.size (falls back to the handle; diluents have no size key).
 * When a single size-like variant title disagrees with it, the size is omitted from the
 * copy (returned as conflict) so the copy never contradicts the title, variant or label.
 */
function sizeInfo(p: ProductRow, kind: Kind): { size: string | null; conflict: string | null } {
  if (kind === "dual" || kind === "device") return { size: null, conflict: null }
  const raw = str(p.metadata?.size) || (p.handle.match(/(\d+(?:\.\d+)?)(mg|ml)(?=-)/)?.[0] ?? "")
  const size = normalizeSize(raw)
  const variantSizes = (p.variants ?? []).map((v) => normalizeSize(str(v.title))).filter((s): s is string => Boolean(s))
  if (size && variantSizes.length === 1 && variantSizes[0] !== size) {
    return { size: null, conflict: `metadata.size "${size}" ≠ variant title "${variantSizes[0]}" (size omitted from copy)` }
  }
  return { size, conflict: null }
}
const sizeOf = (p: ProductRow, kind: Kind): string | null => sizeInfo(p, kind).size

const bullets = (lines: string[]): string => lines.map((l) => `• ${l}`).join("\n")
const section = (heading: string, body: string): string => `**${heading}**\n${body}`
const list = (items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
const variantOptions = (p: ProductRow): string => (p.variants ?? []).map((v) => str(v.title)).filter(Boolean).join(", ")

// ─── Context shared between products (siblings, identity data) ──────────────

type Ctx = {
  byGroup: Map<string, ProductRow[]>
  identityByCompound: Map<string, { cas: string; formula: string }>
}

const groupKey = (p: ProductRow): string => {
  const ref = PRODUCT_COMPOUND[p.handle]
  return `${ref.compound}|${ref.displayName ?? ""}`
}

function buildCtx(products: ProductRow[]): Ctx {
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

// ─── Sections ───────────────────────────────────────────────────────────────

function researchSection(c: CompoundCopy): string {
  return section(c.researchHeading ?? "Research context", bullets(c.research.map((r) => `**${r.label}** — ${r.text}`)))
}

function qualitySection(p: ProductRow, kind: Kind, compoundKey: string, c: CompoundCopy, ctx: Ctx): string {
  if (kind === "device") {
    return section("Quality and testing", bullets([
      "The device contains no compound, so no certificate of analysis applies.",
      "Check the device for damage on arrival.",
    ]))
  }
  const labelChecks = [
    "Check the lot number and expiry date on the label.",
    "Do not use the solution if it is cloudy, discoloured or contains particles, or if the seal is damaged.",
  ]
  if (compoundKey === "bacteriostatic-water") {
    return section("Quality and testing", bullets(["Composition: sterile water with 0.9% benzyl alcohol.", ...labelChecks]))
  }
  if (compoundKey === "acetic-acid-water") {
    return section("Quality and testing", bullets([
      "Composition: dilute acetic acid in sterile water. The concentration is as printed on the vial label.",
      ...labelChecks,
    ]))
  }
  const purity = str(p.metadata?.purity_percentage)
  const shared = c.shareIdentityData ? ctx.identityByCompound.get(compoundKey) : undefined
  const cas = str(p.metadata?.cas_number) || shared?.cas || ""
  const formula = str(p.metadata?.molecular_formula) || shared?.formula || ""
  const lines = [
    purity ? `Stated purity: ${purity}%. The batch COA gives the analytical method and results.` : "Purity: see the batch COA.",
    ...(cas ? [`CAS number: ${cas}.`] : []),
    ...(formula ? [`Molecular formula: ${formula}.`] : []),
    "Refer to the batch certificate of analysis (COA) for the batch number and test data.",
  ]
  return section("Quality and testing", bullets(lines))
}

function storageSection(p: ProductRow, kind: Kind, compoundKey: string): string {
  const meta = p.metadata ?? {}
  if (kind === "device") return section("Storage and handling", bullets(STORAGE.device))
  if (compoundKey === "acetic-acid-water") {
    return section("Storage and handling", bullets([
      "Store sealed at room temperature.",
      "Single-use only: discard any remaining volume after first puncture.",
    ]))
  }
  if (compoundKey === "bacteriostatic-water") {
    const roomTemp = /room temperature/i.test(str(meta.storage))
    return section("Storage and handling", bullets(roomTemp
      ? ["Store sealed vials at room temperature, upright and protected from light.", "After first puncture, store at 2–8°C and follow the discard date on the product label."]
      : ["Keep the vial sealed until first use.", "Follow the storage and opened-vial instructions on the product label."]))
  }
  if (kind === "dual") return section("Storage and handling", bullets(meta.diluent_included === true ? STORAGE.dualWithDiluent : STORAGE.dualDry))
  if (kind === "pen" || kind === "multidose" || kind === "spray") return section("Storage and handling", bullets(STORAGE.liquid))
  return section("Storage and handling", bullets(STORAGE.powder))
}

function boxLines(p: ProductRow, kind: Kind, name: string, brand: string, size: string | null): string[] {
  const meta = p.metadata ?? {}
  const sized = size ? `${name} ${size}` : name
  const device = "The compatible Supreme Biologics dual-chamber device is sold separately."
  const options = variantOptions(p)
  const optionLine = options ? [`Options (amount per cartridge × cartridges per box): ${options}.`] : []
  switch (kind) {
    case "vial":
      return [
        `One vial of ${sized} as lyophilized powder. The stated amount is the total in the vial.`,
        "Diluent is not included. Bacteriostatic water and acetic acid water are sold separately.",
      ]
    case "pen":
      return [
        `One ${brand} pen containing ${sized} as ready-mixed liquid.`,
        "The stated amount is the total in the pen, not the amount per click.",
        "No diluent is needed.",
      ]
    case "multidose":
      return [
        `**First purchase** — the Supreme Biologics reusable pen with one matching ${sized} single-chamber refill cartridge.`,
        `**Refill only** — one ${sized} single-chamber refill cartridge for an existing compatible pen.`,
        "The refill contains ready-mixed liquid. The label states the total per cartridge, not the amount per click.",
      ]
    case "dual":
      if (meta.diluent_included === true) {
        return [
          `One box of ${str(meta.cartridges_per_box) || "four"} dual-chamber cartridges. The selected amount is per cartridge, and the price is for one complete box.`,
          ...optionLine,
          "Peptide powder and clear diluent are held in separate chambers until mixing. The diluent is included.",
          device,
        ]
      }
      return [
        "One box of glass dual-chamber cartridges, with no needle.",
        ...optionLine,
        "The peptide chamber holds lyophilized powder. The diluent chamber ships empty, and bacteriostatic water is not included.",
        device,
      ]
    case "spray":
      return [`One spray-format vial with a stated total of ${sized}.`, "See the product label for the concentration and pack contents."]
    case "diluent":
      return [size ? `One ${size} vial of ${name.toLowerCase()}.` : `One vial of ${name.toLowerCase()}.`]
    case "device":
      return ["One reusable dual-chamber cartridge device (1 piece).", "No needle is included.", "Cartridges are sold separately."]
  }
}

function siblingLabel(s: ProductRow, withSize: boolean): string {
  const kind = kindOf(s)
  const size = sizeOf(s, kind)
  return (kind === "diluent" || withSize) && size ? `${size} ${FORMAT_LABELS[kind]}` : FORMAT_LABELS[kind]
}

function brandLines(p: ProductRow, kind: Kind, name: string, brand: string, size: string | null): string[] {
  switch (kind) {
    case "vial": return [`${brand} manufactures this ${name} product and supplies it as one sealed vial of lyophilized powder.`]
    case "pen": return [`${brand} manufactures this ${name} product as a ready-mixed pen.`]
    case "multidose": return [`Supreme Biologics manufactures both the reusable pen and the ${name} single-chamber refill cartridges.`]
    case "dual": return [
      `Supreme Biologics manufactures these ${name} dual-chamber cartridges.`,
      ...(p.metadata?.diluent_included === true ? [] : ["Custom box combinations are available on request via LINE."]),
    ]
    case "spray": return [`${brand} manufactures this ${name} product in a spray-format vial.`]
    case "diluent": return [size ? `${brand} manufactures this ${size} ${name.toLowerCase()} vial.` : `${brand} manufactures this ${name.toLowerCase()} vial.`]
    case "device": return ["Supreme Biologics manufactures this device for its own dual-chamber cartridge system."]
  }
}

function manufacturerSection(p: ProductRow, kind: Kind, name: string, brand: string, size: string | null, ctx: Ctx): string {
  const lines = brandLines(p, kind, name, brand, size)
  const siblings = (ctx.byGroup.get(groupKey(p)) ?? []).filter((s) => s.handle !== p.handle)
  const producent = str(p.metadata?.producent)
  const sameBrand = siblings.filter((s) => str(s.metadata?.producent) === producent)
  if (sameBrand.length) {
    const labels = [...new Set(sameBrand.map((s) => siblingLabel(s, kindOf(s) === kind)))]
    lines.push(`Other ${brand} formats on this site: ${list(labels)}.`)
  }
  const otherBrands = [...new Set(siblings.map((s) => str(s.metadata?.producent)).filter((b) => b && b !== producent))]
    .map((b) => BRANDS[b] ?? b)
    .sort()
  if (otherBrands.length) lines.push(`${name} is also available from ${list(otherBrands)}.`)
  return section("Manufacturer and delivery", [...lines, DELIVERY_LINE, RESEARCH_USE_LINE].join("\n"))
}

function shortDescription(kind: Kind, c: CompoundCopy, name: string, brand: string, size: string | null): string {
  const lead = `${size ? `${name} ${size}` : name} — ${c.identity}.`
  switch (kind) {
    case "vial": return `${lead} Supplied by ${brand} as one vial of lyophilized powder, ${SHORT_SUFFIX}`
    case "pen": return `${lead} Supplied by ${brand} as ready-mixed liquid in a pen, ${SHORT_SUFFIX}`
    case "multidose": return `${lead} Single-chamber refill for the Supreme Biologics reusable pen, ${SHORT_SUFFIX}`
    case "dual": return `${lead} Supreme Biologics dual-chamber cartridges, sold by the box, ${SHORT_SUFFIX}`
    case "spray": return `${lead} Supplied by ${brand} in a spray-format vial, ${SHORT_SUFFIX}`
    case "diluent": return `${lead} Supplied by ${brand}, ${SHORT_SUFFIX}`
    case "device": {
      const id = c.identity.charAt(0).toUpperCase() + c.identity.slice(1)
      return `${id}. Cartridges are sold separately. Supreme Biologics hardware, ${SHORT_SUFFIX}`
    }
  }
}

// ─── Planning ───────────────────────────────────────────────────────────────

function validate(whatItIs: string, description: string, longDescription: string, producent: string): string[] {
  const problems: string[] = []
  if (!BRANDS[producent]) problems.push(`unknown producent "${producent}"`)
  const ww = words(whatItIs)
  if (ww < WHAT_MIN_WORDS || ww > WHAT_MAX_WORDS) problems.push(`"What it is" has ${ww} words (want ${WHAT_MIN_WORDS}–${WHAT_MAX_WORDS})`)
  if (whatItIs.length > OVERVIEW_MAX_CHARS) problems.push(`"What it is" has ${whatItIs.length} chars (overview needs < 550)`)
  const sw = words(description)
  if (sw < SHORT_MIN_WORDS || sw > SHORT_MAX_WORDS) problems.push(`short description has ${sw} words (want ${SHORT_MIN_WORDS}–${SHORT_MAX_WORDS})`)
  if (!description.toLowerCase().endsWith(SHORT_SUFFIX)) problems.push("short description does not end with the research-use phrase")
  for (const [label, text] of [["description", description], ["long_description", longDescription]] as const) {
    const hits = [...new Set((text.match(FORBIDDEN_RE) ?? []).map((h) => h.toLowerCase()))]
    if (hits.length) problems.push(`forbidden wording in ${label}: ${hits.join(", ")}`)
  }
  if (/\{name\}/.test(longDescription)) problems.push("unreplaced {name} token")
  return problems
}

function planProduct(p: ProductRow, ctx: Ctx): Plan {
  const ref = PRODUCT_COMPOUND[p.handle]
  const c = COMPOUNDS[ref.compound]
  const kind = kindOf(p)
  const producent = str(p.metadata?.producent)
  const brand = BRANDS[producent] ?? producent
  const name = ref.displayName ?? c.name
  const { size, conflict } = sizeInfo(p, kind)
  const whatItIs = c.whatItIs.replace(/\{name\}/g, name)

  const longDescription = [
    section("What it is", whatItIs),
    researchSection(c),
    qualitySection(p, kind, ref.compound, c, ctx),
    storageSection(p, kind, ref.compound),
    section("In the box", bullets(boxLines(p, kind, name, brand, size))),
    manufacturerSection(p, kind, name, brand, size, ctx),
  ].join("\n\n")
  const description = shortDescription(kind, c, name, brand, size)

  const changedFields: Plan["changedFields"] = []
  if (str(p.description) !== description.trim()) changedFields.push("description")
  if (str(p.metadata?.long_description) !== longDescription.trim()) changedFields.push("long_description")

  return { product: p, kind, brand, description, longDescription, changedFields, problems: validate(whatItIs, description, longDescription, producent), warnings: conflict ? [conflict] : [] }
}

function buildUpdate(plan: Plan) {
  return {
    id: plan.product.id,
    description: plan.description,
    // Full metadata spread: keeps every locale key and all other keys; only EN long_description changes.
    metadata: { ...(plan.product.metadata ?? {}), long_description: plan.longDescription },
  }
}

function writeBackup(products: ProductRow[]): string {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = join(BACKUP_DIR, `product-copy-v2-backup-${stamp}.json`)
  const body = JSON.stringify(products.map((p) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    long_description: p.metadata?.long_description ?? null,
    metadata: p.metadata,
  })), null, 2)
  writeFileSync(path, body, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

function checkCoverage(published: ProductRow[]): string | null {
  const handles = new Set(published.map((p) => p.handle))
  const missingCopy = published.filter((p) => !PRODUCT_COMPOUND[p.handle]).map((p) => p.handle)
  const orphanCopy = Object.keys(PRODUCT_COMPOUND).filter((h) => !handles.has(h))
  const badCompound = Object.entries(PRODUCT_COMPOUND).filter(([, r]) => !COMPOUNDS[r.compound]).map(([h]) => h)
  if (!missingCopy.length && !orphanCopy.length && !badCompound.length) return null
  return `published without copy: [${missingCopy.join(", ")}]; copy without published product: [${orphanCopy.join(", ")}]; unknown compound key: [${badCompound.join(", ")}]`
}

// ─── Entry point ────────────────────────────────────────────────────────────

export default async function productCopyV2({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const isApply = process.env.APPLY === "1"
  const onlyHandle = process.env.HANDLE?.trim() || null
  const verbose = process.env.VERBOSE === "1" || Boolean(onlyHandle)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "description", "metadata", "variants.title", "variants.variant_rank"],
  })
  const all = [...(data as ProductRow[])].sort((a, b) => a.handle.localeCompare(b.handle))
  const published = all
    .filter((p) => p.status === "published")
    .map((p) => ({ ...p, variants: [...(p.variants ?? [])].sort((a, b) => Number(a.variant_rank ?? 0) - Number(b.variant_rank ?? 0)) }))
  const drafts = all.filter((p) => p.status !== "published")

  const coverageError = checkCoverage(published)
  if (coverageError) {
    logger.error(`[copy-v2] coverage error — ${coverageError}`)
    return
  }
  logger.info(`[copy-v2] published products: ${published.length}; copy entries: ${Object.keys(PRODUCT_COMPOUND).length}; distinct compound blocks: ${new Set(Object.values(PRODUCT_COMPOUND).map((r) => r.compound)).size}`)
  logger.info(`[copy-v2] skipped (not published): ${drafts.map((p) => `${p.handle} [${p.status}]`).join(", ") || "none"}`)

  const ctx = buildCtx(published)
  const targets = onlyHandle ? published.filter((p) => p.handle === onlyHandle) : published
  if (!targets.length) {
    logger.warn(`[copy-v2] no published product for handle ${onlyHandle}`)
    return
  }
  const plans = targets.map((p) => planProduct(p, ctx))

  for (const plan of plans) {
    const p = plan.product
    const state = plan.changedFields.length ? `CHANGE ${plan.changedFields.join("+")}` : "unchanged"
    logger.info(`\n[copy-v2] ${p.handle} | kind=${plan.kind} | brand=${plan.brand} | ${state}${plan.problems.length ? ` | PROBLEMS: ${plan.problems.join("; ")}` : ""}`)
    logger.info(`  title: ${p.title}`)
    logger.info(`  description before: ${excerpt(p.description)}`)
    logger.info(`  description after : ${plan.description}`)
    if (verbose) logger.info(`  long_description after:\n${plan.longDescription}\n  ── end ──`)
    else logger.info(`  long_description before: ${excerpt((p.metadata?.long_description as string) ?? null)}`)
  }

  const withProblems = plans.filter((p) => p.problems.length)
  const toChange = plans.filter((p) => p.changedFields.length)
  logger.info(`\n[copy-v2] SUMMARY: ${plans.length} planned, ${toChange.length} to change, ${plans.length - toChange.length} unchanged, ${withProblems.length} with problems.`)
  withProblems.forEach((p) => logger.warn(`[copy-v2] problem ${p.product.handle}: ${p.problems.join("; ")}`))
  plans.filter((p) => p.warnings.length).forEach((p) => logger.warn(`[copy-v2] data warning ${p.product.handle}: ${p.warnings.join("; ")}`))

  if (!isApply) {
    logger.info(`[copy-v2] DRY RUN only — nothing written. Re-run with APPLY=1 to write.`)
    return
  }
  if (withProblems.length) {
    logger.error(`[copy-v2] APPLY refused: ${withProblems.length} product(s) fail validation.`)
    return
  }
  if (!toChange.length) {
    logger.info(`[copy-v2] APPLY: nothing to change.`)
    return
  }

  // Backup failure throws and stops the run before any write.
  const backupPath = writeBackup(toChange.map((p) => p.product))
  logger.info(`[copy-v2] backup written: ${backupPath} (mode 600, ${toChange.length} products)`)

  let ok = 0
  let failed = 0
  for (const plan of toChange) {
    try {
      await updateProductsWorkflow(container).run({ input: { products: [buildUpdate(plan)] } })
      ok += 1
      logger.info(`[copy-v2] updated ${plan.product.handle} (${plan.changedFields.join("+")})`)
    } catch (e) {
      failed += 1
      logger.error(`[copy-v2] FAILED ${plan.product.handle}: ${(e as Error).message}`)
    }
  }
  logger.info(`[copy-v2] APPLY done: ${ok} updated, ${failed} failed. Backup: ${backupPath}`)
}
