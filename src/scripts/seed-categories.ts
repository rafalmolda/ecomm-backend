import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Idempotent seed for the two new categories the 2026-04-18 catalog rebrand needs.
 *
 *   npx medusa exec ./src/scripts/seed-categories.ts
 *
 * Note: no `sexual-wellness` category — SEO / ad-policy risk. PT-141 products
 * go under `beauty` (melanocortin / MSH-pathway framing).
 */

const CATEGORIES = [
  {
    name: "Cognitive",
    handle: "cognitive",
    description:
      "Nootropic and neuropeptide research compounds studied for memory, focus, mood, and stress resilience — Selank, Semax, DSIP.",
  },
  {
    name: "Beauty",
    handle: "beauty",
    description:
      "Peptides studied for skin quality, pigmentation, collagen synthesis, and aesthetic applications — GHK-Cu, BPC-157, TB-500, PT-141, melanocortin analogues.",
  },
] as const

export default async function seedCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  for (const cat of CATEGORIES) {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "handle"],
      filters: { handle: cat.handle },
    })
    if (data.length > 0) {
      logger.info(`[seed-categories] category "${cat.handle}" already exists (${data[0].id})`)
      continue
    }
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [
          {
            name: cat.name,
            handle: cat.handle,
            description: cat.description,
            is_active: true,
          },
        ],
      },
    })
    logger.info(`[seed-categories] created "${cat.handle}" (${result[0].id})`)
  }
}
