import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * 2026-11-06: owner confirmed monera-5mg-supreme-biologics is 5 mg.
 * Title said "Monera 20mg" and the variant title said 20 mg; metadata.size
 * already says 5mg. SKU is left unchanged (external references).
 * DRY RUN unless APPLY=1.
 */
const HANDLE = "monera-5mg-supreme-biologics"
const fix = (s: string) => s.replace(/20\s?mg/gi, (m) => m.replace(/20/, "5"))

export default async function fixMoneraSize({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  const productService = container.resolve(Modules.PRODUCT)
  const [product] = await productService.listProducts({ handle: HANDLE }, { relations: ["variants"] })
  if (!product) throw new Error(`product ${HANDLE} not found`)
  const apply = process.env.APPLY === "1"
  const newTitle = fix(product.title)
  logger.info(`[monera] title: "${product.title}" -> "${newTitle}"`)
  for (const v of product.variants ?? []) {
    logger.info(`[monera] variant ${v.id}: "${v.title}" -> "${fix(v.title ?? "")}" (sku ${v.sku} unchanged)`)
  }
  if (!apply) return logger.info("[monera] DRY RUN — nothing written")
  await productService.updateProducts(product.id, { title: newTitle })
  for (const v of product.variants ?? []) {
    if (v.title && fix(v.title) !== v.title) await productService.updateProductVariants(v.id, { title: fix(v.title) })
  }
  logger.info("[monera] APPLY done")
}
