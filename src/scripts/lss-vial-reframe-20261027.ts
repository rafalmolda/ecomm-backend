import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
/** Lifespan, 27 Oct 2026: re-framed main photos for 17 Supreme Biologics vials (864x1184, vial 59% height, pure white = same as other brands). PREVIEW by default, APPLY=1 to write. */
const STATIC = "https://api.lifespansupply.com/static"
const MAP: Record<string, string> = {
  "aod-9604-5mg-supreme-biologics": "2026-10-27-aod-9604-5mg-supreme-biologics-v3-0c7005c5a2.webp",
  "bpc-157-5mg-supreme-biologics": "2026-10-27-bpc-157-5mg-supreme-biologics-v3-87c76b1a97.webp",
  "cjc-1295-no-dac-5mg-supreme-biologics": "2026-10-27-cjc-1295-no-dac-5mg-supreme-biologics-v3-0244d021af.webp",
  "ipamorelin-5mg-supreme-biologics": "2026-10-27-ipamorelin-5mg-supreme-biologics-v3-2f94f97d97.webp",
  "kpv-5mg-supreme-biologics": "2026-10-27-kpv-5mg-supreme-biologics-v3-258d04d15c.webp",
  "mots-c-10mg-supreme-biologics": "2026-10-27-mots-c-10mg-supreme-biologics-v3-bb94147aea.webp",
  "nad-plus-100mg-supreme-biologics": "2026-10-27-nad-plus-100mg-supreme-biologics-v3-02edd203a4.webp",
  "pt-141-10mg-supreme-biologics": "2026-10-27-pt-141-10mg-supreme-biologics-v3-a0832e7747.webp",
  "selank-5mg-supreme-biologics": "2026-10-27-selank-5mg-supreme-biologics-v3-8a9904faf5.webp",
  "semax-5mg-supreme-biologics": "2026-10-27-semax-5mg-supreme-biologics-v3-de809bcaf3.webp",
  "ss-31-10mg-supreme-biologics": "2026-10-27-ss-31-10mg-supreme-biologics-v3-77dde948a1.webp",
  "tesamorelin-5mg-supreme-biologics": "2026-10-27-tesamorelin-5mg-supreme-biologics-v3-1307890407.webp",
  "thymosin-beta-4-10mg-supreme-biologics": "2026-10-27-thymosin-beta-4-10mg-supreme-biologics-v3-b440f894fa.webp",
  "dsip-5mg-supreme-biologics": "2026-10-27-dsip-5mg-supreme-biologics-v3-1466f50c27.webp",
  "epithalon-50mg-supreme-biologics": "2026-10-27-epithalon-50mg-supreme-biologics-v3-7ff6f41dbf.webp",
  "ghk-cu-50mg-supreme-biologics": "2026-10-27-ghk-cu-50mg-supreme-biologics-v3-a893184ac9.webp",
  "kisspeptin-10-5mg-supreme-biologics": "2026-10-27-kisspeptin-10-5mg-supreme-biologics-v3-8cd901bc55.webp"
}
export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-vial2] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY" : "MODE: PREVIEW (nothing will be changed)")
  const { data } = (await query.graph({ entity: "product", fields: ["id", "handle", "title", "metadata"], filters: { handle: Object.keys(MAP) } })) as any
  for (const [handle, file] of Object.entries(MAP)) {
    const p = data.find((x: any) => x.handle === handle)
    if (!p) { log(`  !! not found: ${handle}`); continue }
    log(`  -> ${p.title}: slot 1 = ${file}`)
    if (APPLY) await updateProductsWorkflow(container).run({ input: { products: [{ id: p.id, thumbnail: `${STATIC}/${file}`, metadata: { ...(p.metadata || {}), ui_image_0: `${STATIC}/${file}` } }] } })
  }
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
