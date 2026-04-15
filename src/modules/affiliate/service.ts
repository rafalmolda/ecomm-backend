import { MedusaService } from "@medusajs/framework/utils"
import AffiliatePartner from "./models/affiliate-partner"

class AffiliateModuleService extends MedusaService({
  AffiliatePartner,
}) {}

export default AffiliateModuleService
