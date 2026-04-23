import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"
import type LoyaltyModuleService from "../../../../modules/loyalty/service"
import type { Tier } from "../../../../modules/loyalty/service"

/**
 * Admin loyalty roster — returns every customer who has any loyalty ledger
 * activity (or is in a tier group), with their current tier/balance snapshot.
 * Used by /app/loyalty admin page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const service = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const ledgerRows = await service.listLoyaltyLedgers({}, { take: 10000 })
    const customerIds = Array.from(
      new Set(ledgerRows.map((r) => r.customer_id).filter(Boolean)),
    ) as string[]

    if (customerIds.length === 0) {
      res.json({ customers: [] })
      return
    }

    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "metadata"],
      filters: { id: customerIds },
    })

    const result = customers.map((c: {
      id: string
      email: string | null
      first_name: string | null
      last_name: string | null
      metadata: Record<string, unknown> | null
    }) => {
      const meta = (c.metadata || {}) as Record<string, unknown>
      return {
        id: c.id,
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
        tier: ((meta.loyalty_tier as Tier) || "basic") as Tier,
        balance: Number(meta.loyalty_balance ?? 0),
        rolling: Number(meta.loyalty_lifetime_rolling ?? 0),
        tier_since: (meta.loyalty_tier_since as string | null) ?? null,
      }
    })

    // Sort gold → silver → bronze → basic, then rolling desc.
    const RANK: Record<Tier, number> = { gold: 3, silver: 2, bronze: 1, basic: 0 }
    result.sort((a: typeof result[number], b: typeof result[number]) => {
      const r = RANK[b.tier] - RANK[a.tier]
      if (r !== 0) return r
      return (b.rolling || 0) - (a.rolling || 0)
    })

    res.json({ customers: result })
  } catch (e) {
    logger.error(
      "[admin/loyalty] roster failed: " + (e instanceof Error ? e.message : String(e)),
    )
    res.status(500).json({ error: "Failed to list loyalty customers" })
  }
}
