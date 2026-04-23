import { model } from "@medusajs/framework/utils"

const StockNotifySubscription = model.define("stock_notify_subscription", {
  id: model.id({ prefix: "snsub" }).primaryKey(),
  email: model.text(),
  product_id: model.text(),
  locale: model.text(),
  notified_at: model.dateTime().nullable(),
  unsubscribe_token: model.text(),
})

export default StockNotifySubscription
