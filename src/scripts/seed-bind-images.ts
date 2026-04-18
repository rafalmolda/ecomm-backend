import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"

/**
 * Copy the slide images catalogued in seed-image-map-2026-04-18.json into
 * backend/uploads/ and update product metadata (ui_image_0, ui_image_1,
 * thumbnail) to the resulting /static/<filename> URLs.
 *
 * Idempotent — skips copy if the target file already exists, and overwrites
 * metadata on every run.
 *
 *   npx medusa exec ./src/scripts/seed-bind-images.ts
 */

const MAP_PATH = "/root/product-sources/seed-image-map-2026-04-18.json"
const UPLOAD_DIR = "/opt/apps/lifespansupply/backend/uploads"
// Full origin so Next.js <Image> can proxy through /_next/image, matching the
// URL format that the admin product-editor widget emits.
const STATIC_PREFIX = "https://api.lifespansupply.com/static"

type ImageEntry = {
  slide0_path: string | null
  slide1_path: string | null
}

function shortHash(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex").slice(0, 8)
}

function copyIfNeeded(srcPath: string, handle: string, slideIndex: number): string {
  const base = path.basename(srcPath)
  const hash = shortHash(srcPath)
  const ts = "2026-04-18"
  const destName = `${ts}-${handle}-slide${slideIndex}-${hash}${path.extname(base)}`
  const destPath = path.join(UPLOAD_DIR, destName)
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    fs.copyFileSync(srcPath, destPath)
  }
  return `${STATIC_PREFIX}/${destName}`
}

export default async function seedBindImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!fs.existsSync(MAP_PATH)) {
    logger.error(`[bind-images] map not found at ${MAP_PATH}`)
    return
  }

  const raw = JSON.parse(fs.readFileSync(MAP_PATH, "utf-8")) as Record<string, unknown>

  let bound = 0
  let skipped = 0

  for (const [handle, value] of Object.entries(raw)) {
    if (handle.startsWith("_")) continue
    const entry = value as ImageEntry
    if (!entry.slide0_path && !entry.slide1_path) {
      skipped += 1
      continue
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "metadata"],
      filters: { handle },
    })
    if (products.length === 0) {
      logger.warn(`[bind-images] no product found for ${handle}`)
      skipped += 1
      continue
    }
    const product = products[0] as { id: string; handle: string; metadata: Record<string, unknown> | null }

    const mergedMetadata: Record<string, unknown> = { ...(product.metadata ?? {}) }
    let thumbnail: string | undefined

    if (entry.slide0_path && fs.existsSync(entry.slide0_path)) {
      const url = copyIfNeeded(entry.slide0_path, handle, 0)
      mergedMetadata.ui_image_0 = url
      thumbnail = url
    }
    if (entry.slide1_path && fs.existsSync(entry.slide1_path)) {
      mergedMetadata.ui_image_1 = copyIfNeeded(entry.slide1_path, handle, 1)
    }

    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: product.id,
            metadata: mergedMetadata,
            ...(thumbnail ? { thumbnail } : {}),
          },
        ],
      },
    })
    bound += 1
    logger.info(`[bind-images] ok: ${handle}`)
  }

  logger.info(`[bind-images] bound=${bound} skipped=${skipped}`)
}
