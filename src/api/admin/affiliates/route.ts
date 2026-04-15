import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../../modules/affiliate"
import type AffiliateModuleService from "../../../modules/affiliate/service"

/**
 * Affiliate partner management. Each partner has:
 *   - name, email, commission_pct, notes
 *   - a unique Medusa Promotion `code` they share with their audience
 *
 * Partner rows live in the `affiliate_partner` table (custom module); the
 * actual discount logic lives in the associated Medusa Promotion. Orders
 * are attributed to a partner by the promotion code they used at checkout,
 * so revenue/commission is derived by joining orders → promotions → partner.
 */

type AffiliateStats = {
  id: string
  code: string
  name: string
  email: string
  commission_pct: number
  notes: string | null
  order_count: number
  revenue_total: number
  commission_earned: number
  currency_code: string | null
  created_at: string
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const affiliateService = req.scope.resolve<AffiliateModuleService>(
      AFFILIATE_MODULE
    )
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // 1. Load every partner.
    const partners = await affiliateService.listAffiliatePartners({})
    if (partners.length === 0) {
      res.json({ affiliates: [] })
      return
    }

    // 2. Pull every order + its applied promotions (by code).
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "total", "currency_code", "promotions.code"],
    })

    // 3. Bucket orders by promotion code, summing totals.
    const byCode = new Map<
      string,
      { count: number; revenue: number; currency: string | null }
    >()
    for (const o of orders) {
      const promos = (o.promotions as Array<{ code: string }>) ?? []
      const total = Number(o.total ?? 0)
      const currency = (o.currency_code as string) ?? null
      for (const p of promos) {
        if (!p?.code) continue
        const key = p.code.toUpperCase()
        const entry = byCode.get(key) ?? { count: 0, revenue: 0, currency }
        entry.count += 1
        entry.revenue += total
        if (!entry.currency) entry.currency = currency
        byCode.set(key, entry)
      }
    }

    // 4. Combine partner rows with stats.
    const affiliates: AffiliateStats[] = partners.map((p) => {
      const code = (p.promotion_code as string).toUpperCase()
      const stats = byCode.get(code) ?? { count: 0, revenue: 0, currency: null }
      return {
        id: p.id as string,
        code,
        name: p.name as string,
        email: p.email as string,
        commission_pct: Number(p.commission_pct ?? 0),
        notes: (p.notes as string) ?? null,
        order_count: stats.count,
        revenue_total: stats.revenue / 100,
        commission_earned:
          (stats.revenue * Number(p.commission_pct ?? 0)) / 100 / 100,
        currency_code: stats.currency,
        created_at: (p.created_at as Date)?.toISOString?.() ?? "",
      }
    })

    res.json({ affiliates })
  } catch (e) {
    logger.error(
      "[affiliates] list failed: " + (e instanceof Error ? e.message : String(e))
    )
    res.status(500).json({ error: "Failed to list affiliates" })
  }
}

type CreateAffiliateBody = {
  name: string
  email: string
  code: string
  commission_pct: number
  discount_type?: "percentage" | "fixed"
  discount_value?: number
  notes?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as CreateAffiliateBody
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  if (!body?.name || !body.code || !body.email) {
    res.status(400).json({ error: "name, email, and code are required" })
    return
  }

  const code = body.code.trim().toUpperCase()
  const discountType = body.discount_type ?? "percentage"
  const discountValue = Number(body.discount_value ?? 10)

  try {
    // 1. Create the Medusa promotion that carries the actual discount logic.
    await createPromotionsWorkflow(req.scope).run({
      input: {
        promotionsData: [
          {
            code,
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: {
              type: discountType,
              target_type: "order",
              allocation: "across",
              value: discountValue,
              currency_code: "usd",
            },
            rules: [],
          },
        ],
      },
    })

    // 2. Create the partner row pointing at that promotion code.
    const affiliateService = req.scope.resolve<AffiliateModuleService>(
      AFFILIATE_MODULE
    )
    const [partner] = await affiliateService.createAffiliatePartners([
      {
        name: body.name.trim(),
        email: body.email.trim(),
        promotion_code: code,
        commission_pct: Number(body.commission_pct) || 0,
        notes: body.notes ?? null,
      },
    ])

    res.status(201).json({
      affiliate: {
        id: partner.id,
        code,
        name: partner.name,
        email: partner.email,
        commission_pct: partner.commission_pct,
      },
    })
  } catch (e) {
    logger.error(
      "[affiliates] create failed: " + (e instanceof Error ? e.message : String(e))
    )
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Failed to create affiliate" })
  }
}
