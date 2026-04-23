import { model } from "@medusajs/framework/utils"

const LoyaltyLedger = model.define("loyalty_ledger", {
  id: model.id().primaryKey(),
  customer_id: model.text().index(),
  delta: model.number(),
  reason: model.text(),
  order_id: model.text().nullable(),
  currency: model.text().nullable(),
  note: model.text().nullable(),
})

export default LoyaltyLedger
