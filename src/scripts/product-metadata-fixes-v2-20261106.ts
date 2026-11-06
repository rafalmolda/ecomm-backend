import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { chmodSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { kindOf, ProductRow, str } from "./lib/product-copy-v2-compose"

/**
 * 2026-11-06 metadata fixes that go with product copy v2 (PUBLISHED products only):
 *
 *  1. metadata.storage -> house storage rule (EN; no storage_<locale> keys exist — the script
 *     checks and reports if any appear). Only these cases change:
 *       - vial / dual (powder, ships dry): storage says "28 days" or is missing -> POWDER
 *       - pen / multidose / spray (ready-mixed liquid): anything other than PEN -> PEN
 *       - dual with diluent included: anything other than DUAL_WITH_DILUENT -> DUAL_WITH_DILUENT
 *       - bacteriostatic water that says "28 days" -> BAC_ROOM_TEMP
 *     Device: skipped (no compound). Anything else that still says "28 days" is reported.
 *  2. metadata.form on Calyssee pens: "Lyophilized Powder" -> "Ready-Mixed Pen". The value
 *     keeps getProductPresentation() on the `pen` kind (it is not "Multi-Dose Pen"/"Spray").
 *
 * Note: the PDP shows storefront-copy `penStorage` (not metadata.storage) for pen/multidose,
 * so (1) changes the PDP Storage fact only for vial, dual, spray and diluent products.
 *
 *   DRY RUN (default):  npx medusa exec ./src/scripts/product-metadata-fixes-v2-20261106.ts
 *   APPLY (mode-600 backup in /root/ops first):  APPLY=1 npx medusa exec ...
 */

const BACKUP_DIR = "/root/ops"

export const STORAGE_RULE = {
  POWDER: "-20°C long-term (lyophilized) / 2–8°C reconstituted, use within 30 days. Keep dry and protected from light.",
  PEN: "Keep refrigerated at 2–8°C. Use within 30 days of first use. Follow the expiry date on the label.",
  DUAL_WITH_DILUENT: "Store unmixed cartridges at 2–8°C unless the label states otherwise. After mixing, store at 2–8°C and use within 30 days. Keep protected from light.",
  BAC_ROOM_TEMP: "Room temperature sealed. After first puncture: store at 2–8°C and follow the discard date on the label. Keep upright and protected from light.",
} as const

const CALYSSEE_PEN_FORM = "Ready-Mixed Pen"
const TWENTY_EIGHT_DAYS_RE = /28\s*days/i

type Change = { key: "storage" | "form"; from: string; to: string; reason: string }
type Plan = { product: ProductRow; changes: Change[]; notes: string[] }

function storageTarget(p: ProductRow): { to: string; reason: string } | null {
  const kind = kindOf(p)
  const current = str(p.metadata?.storage)
  const says28 = TWENTY_EIGHT_DAYS_RE.test(current)
  if (kind === "pen" || kind === "multidose" || kind === "spray") {
    return current === STORAGE_RULE.PEN ? null : { to: STORAGE_RULE.PEN, reason: `${kind}: ready-mixed liquid rule` }
  }
  if (kind === "dual" && p.metadata?.diluent_included === true) {
    return current === STORAGE_RULE.DUAL_WITH_DILUENT ? null : { to: STORAGE_RULE.DUAL_WITH_DILUENT, reason: "dual cartridge with diluent" }
  }
  if (kind === "vial" || kind === "dual") {
    if (!current) return { to: STORAGE_RULE.POWDER, reason: `${kind}: storage missing` }
    return says28 ? { to: STORAGE_RULE.POWDER, reason: `${kind}: 28 days -> 30 days` } : null
  }
  if (kind === "diluent" && /bacteriostatic/.test(p.handle) && says28) {
    return { to: STORAGE_RULE.BAC_ROOM_TEMP, reason: "bacteriostatic water: no day count, follow label" }
  }
  return null
}

function planProduct(p: ProductRow): Plan {
  const changes: Change[] = []
  const notes: string[] = []
  const storage = storageTarget(p)
  if (storage) changes.push({ key: "storage", from: str(p.metadata?.storage) || "<missing>", ...storage })
  const form = str(p.metadata?.form)
  if (kindOf(p) === "pen" && p.metadata?.producent === "Calyssee" && form === "Lyophilized Powder") {
    changes.push({ key: "form", from: form, to: CALYSSEE_PEN_FORM, reason: "Calyssee pens are ready-mixed liquid (owner-confirmed in product-presentation.ts)" })
  }
  const finalStorage = storage?.to ?? str(p.metadata?.storage)
  if (TWENTY_EIGHT_DAYS_RE.test(finalStorage)) notes.push("storage still says 28 days (no rule covers this product)")
  if (kindOf(p) === "device" && !finalStorage) notes.push("device: no storage value (not a compound; left as is)")
  const localeStorageKeys = Object.keys(p.metadata ?? {}).filter((k) => /^storage_[a-z]{2}$/.test(k))
  if (localeStorageKeys.length) notes.push(`has locale storage keys ${localeStorageKeys.join(", ")} — not handled, review`)
  return { product: p, changes, notes }
}

function writeBackup(plans: Plan[]): string {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = join(BACKUP_DIR, `product-metadata-fixes-v2-backup-${stamp}.json`)
  const body = JSON.stringify(plans.map(({ product: p }) => ({
    id: p.id, handle: p.handle, storage: p.metadata?.storage ?? null, form: p.metadata?.form ?? null, metadata: p.metadata,
  })), null, 2)
  writeFileSync(path, body, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

export default async function productMetadataFixesV2({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const isApply = process.env.APPLY === "1"

  const { data } = await query.graph({ entity: "product", fields: ["id", "handle", "title", "status", "description", "metadata"] })
  const published = [...(data as ProductRow[])].filter((p) => p.status === "published").sort((a, b) => a.handle.localeCompare(b.handle))
  const plans = published.map(planProduct)

  for (const plan of plans.filter((p) => p.changes.length || p.notes.length)) {
    logger.info(`\n[meta-fix] ${plan.product.handle} | kind=${kindOf(plan.product)}`)
    plan.changes.forEach((c) => logger.info(`  ${c.key}: "${c.from}"\n      -> "${c.to}"  (${c.reason})`))
    plan.notes.forEach((n) => logger.warn(`  note: ${n}`))
  }
  const toChange = plans.filter((p) => p.changes.length)
  const count = (key: Change["key"]) => toChange.filter((p) => p.changes.some((c) => c.key === key)).length
  logger.info(`\n[meta-fix] SUMMARY: ${published.length} published, ${toChange.length} to change (storage: ${count("storage")}, form: ${count("form")}), ${plans.filter((p) => p.notes.length).length} with notes.`)

  if (!isApply) {
    logger.info(`[meta-fix] DRY RUN only — nothing written. Re-run with APPLY=1 to write.`)
    return
  }
  if (!toChange.length) {
    logger.info(`[meta-fix] APPLY: nothing to change.`)
    return
  }
  const backupPath = writeBackup(toChange)
  logger.info(`[meta-fix] backup written: ${backupPath} (mode 600, ${toChange.length} products)`)
  let ok = 0
  let failed = 0
  for (const plan of toChange) {
    const metadata = { ...(plan.product.metadata ?? {}), ...Object.fromEntries(plan.changes.map((c) => [c.key, c.to])) }
    try {
      await updateProductsWorkflow(container).run({ input: { products: [{ id: plan.product.id, metadata }] } })
      ok += 1
      logger.info(`[meta-fix] updated ${plan.product.handle} (${plan.changes.map((c) => c.key).join("+")})`)
    } catch (e) {
      failed += 1
      logger.error(`[meta-fix] FAILED ${plan.product.handle}: ${(e as Error).message}`)
    }
  }
  logger.info(`[meta-fix] APPLY done: ${ok} updated, ${failed} failed. Backup: ${backupPath}`)
}
