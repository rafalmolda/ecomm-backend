import { MedusaService } from "@medusajs/framework/utils"
import { randomBytes } from "node:crypto"
import StockNotifySubscription from "./models/stock-notify-subscription"

class StockNotifyModuleService extends MedusaService({
  StockNotifySubscription,
}) {
  async subscribe(input: {
    email: string
    product_id: string
    locale: string
  }): Promise<{ created: boolean }> {
    const email = input.email.trim().toLowerCase()

    const existing = await this.listStockNotifySubscriptions({
      email,
      product_id: input.product_id,
      notified_at: null,
    })
    if (existing.length > 0) return { created: false }

    await this.createStockNotifySubscriptions([
      {
        email,
        product_id: input.product_id,
        locale: input.locale,
        notified_at: null,
        unsubscribe_token: randomBytes(32).toString("hex"),
      },
    ])
    return { created: true }
  }

  async listPending(product_id: string) {
    return this.listStockNotifySubscriptions({
      product_id,
      notified_at: null,
    })
  }

  async markNotified(ids: string[]) {
    if (ids.length === 0) return
    const now = new Date()
    await this.updateStockNotifySubscriptions(
      ids.map((id) => ({ id, notified_at: now }))
    )
  }

  async countPending(product_id: string) {
    const rows = await this.listStockNotifySubscriptions({
      product_id,
      notified_at: null,
    })
    return rows.length
  }

  async unsubscribeByToken(token: string): Promise<boolean> {
    const rows = await this.listStockNotifySubscriptions({
      unsubscribe_token: token,
    })
    if (rows.length === 0) return false
    await this.deleteStockNotifySubscriptions(rows.map((r: any) => r.id))
    return true
  }
}

export default StockNotifyModuleService
