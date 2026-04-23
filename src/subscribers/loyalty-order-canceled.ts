import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reverseEarnForOrder } from "../modules/loyalty/helpers"

export default async function loyaltyOrderCanceledHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = event.data?.id
  if (!orderId) return

  try {
    await reverseEarnForOrder(container, orderId)
    logger.info(`[loyalty] earn reversed for canceled order ${orderId}`)
  } catch (err) {
    logger.error(`[loyalty] reverse failed for order ${orderId}: ${(err as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["order.canceled", "order.return_received"],
}
