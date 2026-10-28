import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/medusa/core-flows"
/**
 * Lifespan, 28 Oct 2026: prepares the new LifeSpan Circle, switched OFF.
 *  A. Customer groups "Tier Bronze/Silver/Gold" -> "Circle Bronze/Silver/Gold"
 *     (metadata.circle_tier), and empties them (old points system members).
 *  B. Creates 4 AUTOMATIC promotions with status DRAFT (= not applied):
 *     CIRCLE-BRONZE 5%, CIRCLE-SILVER 8%, CIRCLE-GOLD 12% on all products
 *     except GLP-1 products; CIRCLE-FREESHIP = free shipping for members
 *     paying in any currency other than THB.
 *  C. Read-out: how many orders are linked to real accounts.
 * PREVIEW by default; APPLY=1 to make the changes. Safe to run twice.
 */
const GLP = /(retatrutide|tirzepatide|semaglutide|monera|rittera|glp)/i
const TIERS = [
  { t: "bronze", old: "Tier Bronze", name: "Circle Bronze", code: "CIRCLE-BRONZE", pct: 5 },
  { t: "silver", old: "Tier Silver", name: "Circle Silver", code: "CIRCLE-SILVER", pct: 8 },
  { t: "gold", old: "Tier Gold", name: "Circle Gold", code: "CIRCLE-GOLD", pct: 12 },
]
const NON_THB = ["usd", "eur", "gbp", "chf", "cad", "aud", "nok", "sek", "dkk", "idr", "myr", "vnd"]

export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-circle] ${m}`)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const customers: any = container.resolve(Modules.CUSTOMER)
  log(APPLY ? "MODE: APPLY (changes WILL be made)" : "MODE: PREVIEW (nothing will be changed)")

  // A. groups
  const { data: groups } = await query.graph({ entity: "customer_group", fields: ["id", "name", "metadata", "customers.id", "customers.email"] })
  const gid: Record<string, string> = {}
  log("A. Customer groups")
  for (const T of TIERS) {
    const g = groups.find((x: any) => x.metadata?.circle_tier === T.t) || groups.find((x: any) => x.name === T.old || x.name === T.name)
    if (!g) {
      log(`  !! no group found for ${T.t}${APPLY ? ", creating" : ", would create"} "${T.name}"`)
      if (APPLY) {
        const [created] = await customers.createCustomerGroups([{ name: T.name, metadata: { circle_tier: T.t } }])
        gid[T.t] = created.id
      }
      continue
    }
    gid[T.t] = g.id
    const members = (g.customers ?? []).filter(Boolean)
    log(`  ${g.name} (${g.id}) -> "${T.name}", members now: ${members.length ? members.map((c: any) => c.email).join(", ") : "none"}`)
    if (APPLY) {
      await customers.updateCustomerGroups(g.id, { name: T.name, metadata: { ...(g.metadata ?? {}), circle_tier: T.t } })
      for (const c of members) await customers.removeCustomerFromGroup({ customer_id: c.id, customer_group_id: g.id })
      if (members.length) log(`     removed ${members.length} old member(s); the Circle sync re-adds whoever qualifies`)
    }
  }

  // B. promotions
  const { data: products } = await query.graph({ entity: "product", fields: ["id", "title", "handle", "subtitle", "status", "categories.name"] })
  const isGlp = (p: any) =>
    GLP.test(p.title ?? "") || GLP.test(p.handle ?? "") || GLP.test(p.subtitle ?? "") || (p.categories ?? []).some((c: any) => GLP.test(c?.name ?? ""))
  const eligible = products.filter((p: any) => !isGlp(p))
  const excluded = products.filter((p: any) => isGlp(p))
  log("")
  log(`B. Circle product list: ${eligible.length} products get the Circle discount; ${excluded.length} excluded (GLP-1):`)
  excluded.forEach((p: any) => log(`     excluded: ${p.title}`))
  const ids = eligible.map((p: any) => p.id)

  const { data: existing } = await query.graph({ entity: "promotion", fields: ["id", "code", "status"], filters: { code: [...TIERS.map((t) => t.code), "CIRCLE-FREESHIP"] } })
  const has = (c: string) => existing.find((p: any) => p.code === c)
  const data: any[] = []
  for (const T of TIERS) {
    if (has(T.code)) { log(`  ok ${T.code} already exists (${has(T.code).status}), not created again`); continue }
    log(`  ${APPLY ? "creating" : "would create"} ${T.code}: automatic, ${T.pct}% on ${ids.length} products, for group ${T.name}, status DRAFT`)
    data.push({
      code: T.code, type: "standard", status: "draft", is_automatic: true,
      application_method: {
        type: "percentage", target_type: "items", allocation: "across", value: T.pct,
        target_rules: [{ attribute: "items.product.id", operator: "in", values: ids }],
      },
      rules: [{ attribute: "customer.groups.id", operator: "in", values: [gid[T.t] ?? "PENDING"] }],
    })
  }
  if (has("CIRCLE-FREESHIP")) log(`  ok CIRCLE-FREESHIP already exists (${has("CIRCLE-FREESHIP").status})`)
  else {
    log(`  ${APPLY ? "creating" : "would create"} CIRCLE-FREESHIP: automatic, 100% off shipping for all 3 Circle groups, currencies ${NON_THB.join("/")} (not THB), status DRAFT`)
    data.push({
      code: "CIRCLE-FREESHIP", type: "standard", status: "draft", is_automatic: true,
      application_method: { type: "percentage", target_type: "shipping_methods", allocation: "across", value: 100 },
      rules: [
        { attribute: "customer.groups.id", operator: "in", values: TIERS.map((T) => gid[T.t] ?? "PENDING") },
        { attribute: "currency_code", operator: "in", values: NON_THB },
      ],
    })
  }
  if (APPLY && data.length) {
    await createPromotionsWorkflow(container).run({ input: { promotionsData: data } })
    log(`  -> created ${data.length} promotion(s), all DRAFT (customers see no change)`)
  }

  // C. read-out
  const { data: orders } = await query.graph({ entity: "order", fields: ["id", "display_id", "customer.has_account"] })
  const linked = orders.filter((o: any) => o.customer?.has_account).length
  const { data: accts } = await query.graph({ entity: "customer", fields: ["id"], filters: { has_account: true } })
  log("")
  log(`C. Orders linked to a real account: ${linked} of ${orders.length}. Accounts registered: ${accts.length}.`)
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
