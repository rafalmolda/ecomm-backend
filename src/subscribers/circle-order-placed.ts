import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { circleNoteForOrder, syncCustomerTier } from "../utils/circle"

// On every new order: write the Circle gift note on the order (shown on the
// admin order page) and refresh the customer's tier.
export default async function circleOrderPlaced({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = event.data?.id
  if (!orderId) return
  try {
    const note = await circleNoteForOrder(container, orderId)
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "order", fields: ["id", "customer_id", "metadata"], filters: { id: orderId } })
    const order = data?.[0]
    if (note && order) {
      const orders: any = container.resolve(Modules.ORDER)
      await orders.updateOrders([{ id: orderId, metadata: { ...(order.metadata ?? {}), circle: note } }])
    }
    if (order?.customer_id) await syncCustomerTier(container, order.customer_id)
  } catch (e) {
    logger.error("[circle] order.placed failed: " + (e instanceof Error ? e.message : String(e)))
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
