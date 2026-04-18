import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Delete the legacy Recomp + Beauty stacks. Run LAST — only after Wolverine
 * + GLOW stacks have been verified live.
 *
 *   npx medusa exec ./src/scripts/seed-delete-old-stacks.ts
 */

const OLD_STACK_HANDLES = [
  "recomp-stack-cjc-ipamorelin-aod",
  "beauty-stack-bpc-tb500-ghk",
]

export default async function seedDeleteOldStacks({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: OLD_STACK_HANDLES },
  })

  if (data.length === 0) {
    logger.info("[delete-old-stacks] no old stacks found, nothing to delete")
    return
  }

  const ids = (data as { id: string; handle: string }[]).map((p) => {
    logger.info(`[delete-old-stacks] will delete ${p.handle} (${p.id})`)
    return p.id
  })

  await deleteProductsWorkflow(container).run({ input: { ids } })
  logger.info(`[delete-old-stacks] deleted ${ids.length} product(s)`)
}
