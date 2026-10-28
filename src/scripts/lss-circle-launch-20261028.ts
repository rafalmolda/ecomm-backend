import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { syncAllTiers } from "../utils/circle"
/**
 * Lifespan: switch the LifeSpan Circle discounts ON (LIVE=1) or OFF (LIVE=0).
 * ON  = the 4 CIRCLE-* promotions become active + every account is put in
 *       its tier group straight away.
 * OFF = the 4 promotions go back to draft (no member discount at checkout).
 * Without APPLY=1 it only shows what it would do.
 */
const CODES = ["CIRCLE-BRONZE", "CIRCLE-SILVER", "CIRCLE-GOLD", "CIRCLE-FREESHIP"]
export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const LIVE = process.env.LIVE === "1"
  const log = (m: string) => console.log(`[lss-circle-launch] ${m}`)
  const promos: any = container.resolve(Modules.PROMOTION)
  const list = await promos.listPromotions({ code: CODES }, { take: 10 })
  log(`${APPLY ? "APPLY" : "PREVIEW"}: switch Circle ${LIVE ? "ON" : "OFF"}`)
  for (const p of list) log(`  ${p.code}: ${p.status} -> ${LIVE ? "active" : "draft"}`)
  if (list.length !== 4) { log(`!! expected 4 Circle promotions, found ${list.length}. Run the setup first. Stopping.`); return }
  if (!APPLY) { log("DONE (preview only)"); return }
  await promos.updatePromotions(list.map((p: any) => ({ id: p.id, status: LIVE ? "active" : "draft" })))
  const r = await syncAllTiers(container)
  log(`  tier sync: checked ${r.checked} customers, changed ${r.changed}`)
  log("DONE (applied)")
}
