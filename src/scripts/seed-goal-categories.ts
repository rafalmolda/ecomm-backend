import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Idempotent seed: goal-based "sub" categories alongside the mechanism-based
 * mains (weight-loss / muscle-growth / recovery / skin-health).
 *
 *   npx medusa exec ./src/scripts/seed-goal-categories.ts
 *
 * Products stay in their existing primary category and are ADDITIONALLY
 * linked into one or more of these goal categories when their handle
 * matches a peptide-kb entry that carries the matching goal tag.
 *
 * This keeps the main IA untouched while adding discoverable landing pages
 * for goal-based search intent (longevity peptides, sleep peptides, etc.).
 */

// The 4 goal cats. `cognitive` is already seeded by seed-categories.ts — we
// upsert-style here so re-running this script doesn't double-create it.
const GOAL_CATEGORIES: Array<{
  handle: string
  name: string
  description: string
}> = [
  {
    handle: "longevity",
    name: "Longevity",
    description:
      "Research peptides targeting aging hallmarks — telomere attrition, mitochondrial function, cellular senescence. Epitalon, MOTS-c, NAD+, Thymosin Alpha-1.",
  },
  {
    handle: "sleep",
    name: "Sleep",
    description:
      "Sleep-architecture and slow-wave research peptides. DSIP and related compounds studied for delta-wave modulation and restorative-sleep biology.",
  },
  {
    handle: "cognitive",
    name: "Cognitive",
    description:
      "Nootropic and neuropeptide research compounds — Semax, Selank — studied for memory, focus, BDNF/NGF signaling and anxiolytic research without sedation.",
  },
  {
    handle: "libido",
    name: "Libido",
    description:
      "Melanocortin-pathway and HPG-axis research peptides — PT-141 (Bremelanotide), Kisspeptin-10 — for sexual-health and reproductive-biology research.",
  },
]

// Product-handle substring → goal categories to add. Matched in lowercase.
// Keep this tight: only handles we explicitly want in a goal cat. Order
// doesn't matter; each product receives the union of all matched goals.
const HANDLE_TO_GOALS: Array<{ match: string; goals: string[] }> = [
  // Longevity
  { match: "epithalon", goals: ["longevity"] },
  { match: "mots-c", goals: ["longevity"] },
  { match: "nad-plus", goals: ["longevity"] },
  { match: "thymosin-alpha", goals: ["longevity"] },
  // Sleep
  { match: "dsip", goals: ["sleep"] },
  // Cognitive
  { match: "selank", goals: ["cognitive"] },
  { match: "semax", goals: ["cognitive"] },
  // Libido
  { match: "pt-141", goals: ["libido"] },
  { match: "kisspeptin", goals: ["libido"] },
]

export default async function seedGoalCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ── Step 1: upsert the 4 goal categories ──────────────────────────────
  const catIdByHandle: Record<string, string> = {}
  for (const cat of GOAL_CATEGORIES) {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "handle"],
      filters: { handle: cat.handle },
    })
    if (data.length > 0) {
      catIdByHandle[cat.handle] = data[0].id as string
      logger.info(
        `[seed-goal-categories] "${cat.handle}" exists (${data[0].id})`,
      )
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
    catIdByHandle[cat.handle] = result[0].id
    logger.info(
      `[seed-goal-categories] created "${cat.handle}" (${result[0].id})`,
    )
  }

  // ── Step 2: fetch every product with its current category links ───────
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "categories.id", "categories.handle"],
  })

  let linkedCount = 0
  for (const p of products) {
    const handleLower = (p.handle || "").toLowerCase()
    const goalsToAdd = new Set<string>()
    for (const rule of HANDLE_TO_GOALS) {
      if (handleLower.includes(rule.match)) {
        for (const g of rule.goals) goalsToAdd.add(g)
      }
    }
    if (goalsToAdd.size === 0) continue

    const currentCatIds: string[] = (p.categories ?? [])
      .map((c: { id?: string }) => c?.id)
      .filter((id: string | undefined): id is string => typeof id === "string")
    const newCatIds = [...goalsToAdd]
      .map((g) => catIdByHandle[g])
      .filter((id): id is string => Boolean(id))
    const combined = Array.from(new Set([...currentCatIds, ...newCatIds]))

    // Skip if every goal cat is already linked.
    const alreadyLinked = newCatIds.every((id) => currentCatIds.includes(id))
    if (alreadyLinked) continue

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: p.id },
        update: { categories: combined.map((id) => ({ id })) },
      },
    })
    linkedCount++
    logger.info(
      `[seed-goal-categories] linked ${p.handle} → ${[...goalsToAdd].join(", ")}`,
    )
  }

  logger.info(
    `[seed-goal-categories] done — ${linkedCount} product(s) received new goal-category links`,
  )
}
