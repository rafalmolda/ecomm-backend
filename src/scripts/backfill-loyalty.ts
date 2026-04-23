import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  recordEarnForOrder,
  recomputeTierForCustomer,
} from "../modules/loyalty/helpers"

/**
 * Retroactive loyalty backfill.
 *
 * Walks every completed, non-cancelled order and emits an earn ledger row
 * dated at the order's completed_at — so the rolling-12-month window is
 * honest (orders older than 12 months won't count toward tier).
 * Idempotent: skips orders that already have an earn row.
 *
 *   npx medusa exec ./src/scripts/backfill-loyalty.ts
 */
export default async function backfillLoyalty({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: rawOrders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "currency_code",
      "item_total",
      "item_tax_total",
      "completed_at",
      "canceled_at",
      "status",
    ],
    pagination: { take: 10000 },
  })
  const orders = rawOrders as unknown as Array<{
    id: string
    customer_id: string | null
    currency_code: string | null
    item_total: unknown
    item_tax_total: unknown
    completed_at: string | Date | null
    canceled_at: string | Date | null
    status: string | null
  }>

  logger.info(`[backfill-loyalty] scanning ${orders.length} orders`)

  let earned = 0
  let skipped = 0
  const touchedCustomers = new Set<string>()

  for (const o of orders) {
    if (!o.customer_id) {
      skipped++
      continue
    }
    if (o.canceled_at) {
      skipped++
      continue
    }
    const completedAt = o.completed_at
      ? new Date(o.completed_at as Date | string)
      : null
    if (!completedAt) {
      skipped++
      continue
    }
    try {
      await recordEarnForOrder(
        container,
        {
          id: o.id as string,
          customer_id: o.customer_id as string,
          currency_code: o.currency_code as string,
          item_total: o.item_total,
          item_tax_total: o.item_tax_total,
          completed_at: completedAt,
        },
        { overrideCreatedAt: completedAt },
      )
      earned++
      touchedCustomers.add(o.customer_id as string)
    } catch (e) {
      logger.warn(
        `[backfill-loyalty] failed for order ${o.id}: ${(e as Error).message}`,
      )
    }
  }

  // Final pass: recompute every touched customer once more to ensure metadata
  // + group membership reflects the full ledger state.
  for (const id of touchedCustomers) {
    try {
      await recomputeTierForCustomer(container, id)
    } catch (e) {
      logger.warn(
        `[backfill-loyalty] recompute failed for ${id}: ${(e as Error).message}`,
      )
    }
  }

  logger.info(
    `[backfill-loyalty] done — processed ${earned}, skipped ${skipped}, recomputed ${touchedCustomers.size} customers`,
  )
}
