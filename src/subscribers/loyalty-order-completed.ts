import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recordEarnForOrder } from "../modules/loyalty/helpers"

export default async function loyaltyOrderCompletedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const orderId = event.data?.id
  if (!orderId) return

  try {
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "customer_id",
        "currency_code",
        "item_total",
        "item_tax_total",
        "completed_at",
      ],
      filters: { id: orderId },
    })
    const order = data[0]
    if (!order) return

    await recordEarnForOrder(container, order as Parameters<typeof recordEarnForOrder>[1])
    logger.info(`[loyalty] earn recorded for order ${orderId}`)
  } catch (err) {
    logger.error(`[loyalty] earn failed for order ${orderId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.completed",
}
