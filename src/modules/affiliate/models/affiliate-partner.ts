import { model } from "@medusajs/framework/utils"

// Affiliate/influencer partner record. Each partner is linked to a Medusa
// Promotion by `promotion_code` — that's how orders are attributed back so
// revenue/commission can be aggregated per partner.
const AffiliatePartner = model.define("affiliate_partner", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
  promotion_code: model.text().unique(),
  commission_pct: model.number(),
  notes: model.text().nullable(),
})

export default AffiliatePartner
