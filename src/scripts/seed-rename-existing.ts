import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Rename the 5 existing products with brand-suffixed handles.
 * Idempotent — looks up by either old OR new handle.
 *
 *   npx medusa exec ./src/scripts/seed-rename-existing.ts
 */

type Rename = {
  fromHandles: string[]
  to: string
  newTitle: string
  producent: string
}

const RENAMES: Rename[] = [
  {
    fromHandles: ["bpc-157-5mg", "bpc-157-5mg-supreme-biologics"],
    to: "bpc-157-5mg-supreme-biologics",
    newTitle: "BPC-157 5mg — Supreme Biologics",
    producent: "Supreme Biologics",
  },
  {
    fromHandles: ["ipamorelin-5mg", "ipamorelin-5mg-supreme-biologics"],
    to: "ipamorelin-5mg-supreme-biologics",
    newTitle: "Ipamorelin 5mg — Supreme Biologics",
    producent: "Supreme Biologics",
  },
  {
    fromHandles: ["mots-c-10mg", "mots-c-10mg-supreme-biologics"],
    to: "mots-c-10mg-supreme-biologics",
    newTitle: "MOTS-c 10mg — Supreme Biologics",
    producent: "Supreme Biologics",
  },
  {
    fromHandles: ["thymosin-beta-4-10mg", "thymosin-beta-4-10mg-fournines"],
    to: "thymosin-beta-4-10mg-fournines",
    newTitle: "Thymosin Beta-4 10mg — FourNines",
    producent: "FourNines",
  },
  {
    fromHandles: ["ghk-cu-50mg", "ghk-cu-50mg-calyssee"],
    to: "ghk-cu-50mg-calyssee",
    newTitle: "GHK-Cu 50mg — Calyssee",
    producent: "Calyssee",
  },
]

export default async function seedRenameExisting({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  for (const r of RENAMES) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "metadata"],
      filters: { handle: r.fromHandles },
    })
    if (data.length === 0) {
      logger.warn(`[rename] no product matched any of [${r.fromHandles.join(", ")}]`)
      continue
    }
    const product = data[0] as { id: string; handle: string; metadata: Record<string, unknown> | null }
    const legacyHandles = r.fromHandles.filter((h) => h !== r.to)
    const mergedMetadata = {
      ...(product.metadata ?? {}),
      producent: r.producent,
      legacy_handles: legacyHandles,
    }
    await updateProductsWorkflow(container).run({
      input: {
        products: [
          {
            id: product.id,
            handle: r.to,
            title: r.newTitle,
            metadata: mergedMetadata,
          },
        ],
      },
    })
    logger.info(`[rename] ${product.handle} → ${r.to} (producent=${r.producent})`)
  }
  logger.info(`[rename] done`)
}
