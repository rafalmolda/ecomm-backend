import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { chmodSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { COMPOUND_META, PRODUCT_COMPOUND } from "./data/product-copy-v2"
import { LOCALES, Locale } from "./data/product-copy-v2-i18n"
import { buildCtx, checkLocaleModule, composeProduct, kindOf, LocaleCheck, ProductRow, str } from "./lib/product-copy-v2-compose"

/**
 * Product copy v2 (2026-11-06) — writes compliant product copy for every PUBLISHED product.
 * Text: ./data/product-copy-v2-i18n/<locale>.ts (type ProductCopyLocale); names/flags/handle
 * map: ./data/product-copy-v2.ts; composition: ./lib/product-copy-v2-compose.ts.
 *
 * Fields per locale (exactly the keys src/lib/data/products.ts reads):
 *   en        -> product.description          + metadata.long_description
 *   <l> != en -> metadata.description_<l>     + metadata.long_description_<l>
 * Metadata is merged: every other key is kept. Draft products are skipped.
 *
 *   DRY RUN (default, read-only):  npx medusa exec ./src/scripts/product-copy-v2-20261106.ts
 *   APPLY (mode-600 backup in /root/ops first):  APPLY=1 npx medusa exec ...
 *   LOCALES=th,de   locales to compose/write (default: en). LOCALES=all = all 11.
 *   HANDLE=<handle> limits the run; VERBOSE=1 prints the full new text and the untranslated paths.
 *   ALLOW_PARTIAL=1 allows a locale with more than 10 text strings still equal to English.
 *
 * APPLY refuses when: a selected non-en locale module is still identical to en (stub guard) or
 * has more than 10 untranslated text strings (partial guard, ALLOW_PARTIAL=1 overrides),
 * a locale module fails its checks (placeholders, ** markers, headings), or any composed
 * product fails validation.
 */

const BACKUP_DIR = "/root/ops"
const EXCERPT_LEN = 140
/** A non-en locale with more text strings than this still equal to English is refused (ALLOW_PARTIAL=1 overrides). */
const MAX_IDENTICAL_STRINGS = 10

type LocalePlan = { locale: Locale; description: string; longDescription: string; changed: string[]; problems: string[]; warnings: string[] }
type Plan = { product: ProductRow; locales: LocalePlan[] }

const excerpt = (s: unknown): string => {
  const flat = str(s).replace(/\s+/g, " ")
  return flat.length > EXCERPT_LEN ? `${flat.slice(0, EXCERPT_LEN)}…` : flat
}

const descKey = (l: Locale): string => (l === "en" ? "description" : `description_${l}`)
const longKey = (l: Locale): string => (l === "en" ? "long_description" : `long_description_${l}`)
const currentDescription = (p: ProductRow, l: Locale): string => (l === "en" ? str(p.description) : str(p.metadata?.[descKey(l)]))

function parseLocales(raw: string | undefined): Locale[] {
  const value = raw?.trim() || "en"
  if (value === "all") return [...LOCALES]
  const asked = value.split(",").map((s) => s.trim()).filter(Boolean)
  const unknown = asked.filter((l) => !(LOCALES as readonly string[]).includes(l))
  if (unknown.length) throw new Error(`Unknown locale(s) in LOCALES: ${unknown.join(", ")} (valid: ${LOCALES.join(", ")}, all)`)
  return [...new Set(asked)] as Locale[]
}

function planProduct(p: ProductRow, locales: Locale[], ctx: ReturnType<typeof buildCtx>): Plan {
  return {
    product: p,
    locales: locales.map((locale) => {
      const c = composeProduct(p, locale, ctx)
      const changed = [
        ...(currentDescription(p, locale) !== c.description.trim() ? [descKey(locale)] : []),
        ...(str(p.metadata?.[longKey(locale)]) !== c.longDescription.trim() ? [longKey(locale)] : []),
      ]
      return { locale, description: c.description, longDescription: c.longDescription, changed, problems: c.problems, warnings: c.warnings }
    }),
  }
}

function buildUpdate(plan: Plan) {
  const changed = plan.locales.filter((l) => l.changed.length)
  const en = changed.find((l) => l.locale === "en")
  const metaChanges = Object.fromEntries(changed.flatMap((l) => [
    [longKey(l.locale), l.longDescription],
    ...(l.locale === "en" ? [] : [[descKey(l.locale), l.description]]),
  ]))
  return {
    id: plan.product.id,
    ...(en ? { description: en.description } : {}),
    // Full metadata spread: every other key (all other locales included) is kept.
    metadata: { ...(plan.product.metadata ?? {}), ...metaChanges },
  }
}

function writeBackup(plans: Plan[], locales: Locale[]): string {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = join(BACKUP_DIR, `product-copy-v2-${locales.join("-")}-backup-${stamp}.json`)
  const body = JSON.stringify(plans.map(({ product: p }) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    locales,
    before: Object.fromEntries(locales.flatMap((l) => [
      [descKey(l), l === "en" ? p.description : (p.metadata?.[descKey(l)] ?? null)],
      [longKey(l), p.metadata?.[longKey(l)] ?? null],
    ])),
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
  if (!missingCopy.length && !orphanCopy.length) return null
  return `published without copy: [${missingCopy.join(", ")}]; copy without published product: [${orphanCopy.join(", ")}]`
}

function logLocaleChecks(logger: { info: (m: string) => void; warn: (m: string) => void }, checks: LocaleCheck[], verbose: boolean): void {
  for (const c of checks) {
    const state = c.isStub ? "STUB (identical to en — writes refused)" : c.locale === "en" ? "source" : `${c.identicalToEn}/${c.strings} strings still identical to en`
    logger.info(`[copy-v2] locale ${c.locale}: ${c.strings} strings, ${c.words} words — ${state}`)
    c.problems.forEach((pr) => logger.warn(`[copy-v2] locale ${c.locale} module problem: ${pr}`))
    if (verbose && !c.isStub && c.locale !== "en" && c.identicalPaths.length) logger.info(`[copy-v2] locale ${c.locale} untranslated: ${c.identicalPaths.join(", ")}`)
  }
}

function logPlan(logger: { info: (m: string) => void }, plan: Plan, verbose: boolean): void {
  const p = plan.product
  for (const l of plan.locales) {
    const state = l.changed.length ? `CHANGE ${l.changed.join("+")}` : "unchanged"
    const flags = [...(l.problems.length ? [`PROBLEMS: ${l.problems.join("; ")}`] : []), ...(l.warnings.length ? [`warnings: ${l.warnings.join("; ")}`] : [])]
    logger.info(`\n[copy-v2] ${p.handle} [${l.locale}] | kind=${kindOf(p)} | compound=${COMPOUND_META[PRODUCT_COMPOUND[p.handle].compound].name} | ${state}${flags.length ? ` | ${flags.join(" | ")}` : ""}`)
    logger.info(`  title: ${p.title}`)
    logger.info(`  description before: ${excerpt(currentDescription(p, l.locale))}`)
    logger.info(`  description after : ${l.description}`)
    if (verbose) logger.info(`  long_description after:\n${l.longDescription}\n  ── end ──`)
  }
}

export default async function productCopyV2({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const isApply = process.env.APPLY === "1"
  const onlyHandle = process.env.HANDLE?.trim() || null
  const verbose = process.env.VERBOSE === "1" || Boolean(onlyHandle)
  const locales = parseLocales(process.env.LOCALES)

  const checks = locales.map(checkLocaleModule)
  const allowPartial = process.env.ALLOW_PARTIAL === "1"
  logLocaleChecks(logger, checks, verbose)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "status", "description", "metadata", "variants.title", "variants.variant_rank"],
  })
  const all = [...(data as ProductRow[])].sort((a, b) => a.handle.localeCompare(b.handle))
  const published = all
    .filter((p) => p.status === "published")
    .map((p) => ({ ...p, variants: [...(p.variants ?? [])].sort((a, b) => Number(a.variant_rank ?? 0) - Number(b.variant_rank ?? 0)) }))
  const coverageError = checkCoverage(published)
  if (coverageError) {
    logger.error(`[copy-v2] coverage error — ${coverageError}`)
    return
  }
  logger.info(`[copy-v2] locales: ${locales.join(", ")}; published products: ${published.length}; skipped (not published): ${all.filter((p) => p.status !== "published").map((p) => `${p.handle} [${p.status}]`).join(", ") || "none"}`)

  const ctx = buildCtx(published)
  const targets = onlyHandle ? published.filter((p) => p.handle === onlyHandle) : published
  if (!targets.length) {
    logger.warn(`[copy-v2] no published product for handle ${onlyHandle}`)
    return
  }
  const plans = targets.map((p) => planProduct(p, locales, ctx))
  plans.forEach((plan) => logPlan(logger, plan, verbose))

  const localePlans = plans.flatMap((p) => p.locales.map((l) => ({ handle: p.product.handle, ...l })))
  for (const locale of locales) {
    const lp = localePlans.filter((l) => l.locale === locale)
    logger.info(`\n[copy-v2] SUMMARY ${locale}: ${lp.length} planned, ${lp.filter((l) => l.changed.length).length} to change, ${lp.filter((l) => !l.changed.length).length} unchanged, ${lp.filter((l) => l.problems.length).length} with problems, ${lp.filter((l) => l.warnings.length).length} with warnings.`)
  }
  localePlans.filter((l) => l.problems.length).forEach((l) => logger.warn(`[copy-v2] problem ${l.handle} [${l.locale}]: ${l.problems.join("; ")}`))
  localePlans.filter((l) => l.warnings.length).forEach((l) => logger.warn(`[copy-v2] data warning ${l.handle} [${l.locale}]: ${l.warnings.join("; ")}`))

  const refusals = [
    ...checks.filter((c) => c.isStub).map((c) => `locale ${c.locale} is a stub (identical to en)`),
    ...checks.filter((c) => !c.isStub && c.locale !== "en" && !allowPartial && c.identicalToEn > MAX_IDENTICAL_STRINGS)
      .map((c) => `locale ${c.locale} has ${c.identicalToEn} text strings still in English (max ${MAX_IDENTICAL_STRINGS}; ALLOW_PARTIAL=1 overrides)`),
    ...checks.filter((c) => c.problems.length).map((c) => `locale ${c.locale} module has ${c.problems.length} problem(s)`),
    ...(localePlans.some((l) => l.problems.length) ? [`${localePlans.filter((l) => l.problems.length).length} composed text(s) fail validation`] : []),
  ]
  if (!isApply) {
    if (refusals.length) logger.warn(`[copy-v2] APPLY would be refused: ${refusals.join("; ")}`)
    logger.info(`[copy-v2] DRY RUN only — nothing written. Re-run with APPLY=1 to write.`)
    return
  }
  if (refusals.length) {
    logger.error(`[copy-v2] APPLY refused: ${refusals.join("; ")}`)
    return
  }
  const toChange = plans.filter((p) => p.locales.some((l) => l.changed.length))
  if (!toChange.length) {
    logger.info(`[copy-v2] APPLY: nothing to change.`)
    return
  }

  // Backup failure throws and stops the run before any write.
  const backupPath = writeBackup(toChange, locales)
  logger.info(`[copy-v2] backup written: ${backupPath} (mode 600, ${toChange.length} products)`)

  let ok = 0
  let failed = 0
  for (const plan of toChange) {
    const fields = plan.locales.flatMap((l) => l.changed).join("+")
    try {
      await updateProductsWorkflow(container).run({ input: { products: [buildUpdate(plan)] } })
      ok += 1
      logger.info(`[copy-v2] updated ${plan.product.handle} (${fields})`)
    } catch (e) {
      failed += 1
      logger.error(`[copy-v2] FAILED ${plan.product.handle}: ${(e as Error).message}`)
    }
  }
  logger.info(`[copy-v2] APPLY done: ${ok} updated, ${failed} failed. Backup: ${backupPath}`)
}
