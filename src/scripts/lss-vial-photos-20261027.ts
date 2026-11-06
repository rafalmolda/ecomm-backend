import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
/** Lifespan, 27 Oct 2026: new main photo (slot 1 + thumbnail) for 13 Supreme Biologics vials. Slots 2-4 unchanged. PREVIEW by default, APPLY=1 to write. */
const STATIC = "https://api.lifespansupply.com/static"
const MAP: Record<string, string> = {
  "aod-9604-5mg-supreme-biologics": "2026-10-27-aod-9604-5mg-supreme-biologics-slide0-ccfea95dee.webp",
  "bpc-157-5mg-supreme-biologics": "2026-10-27-bpc-157-5mg-supreme-biologics-slide0-5bd4f2ed83.webp",
  "cjc-1295-no-dac-5mg-supreme-biologics": "2026-10-27-cjc-1295-no-dac-5mg-supreme-biologics-slide0-9cdfc53dee.webp",
  "ipamorelin-5mg-supreme-biologics": "2026-10-27-ipamorelin-5mg-supreme-biologics-slide0-5b6910825d.webp",
  "kpv-5mg-supreme-biologics": "2026-10-27-kpv-5mg-supreme-biologics-slide0-a470062217.webp",
  "mots-c-10mg-supreme-biologics": "2026-10-27-mots-c-10mg-supreme-biologics-slide0-b29161553f.webp",
  "nad-plus-100mg-supreme-biologics": "2026-10-27-nad-plus-100mg-supreme-biologics-slide0-c2fd13ae8e.webp",
  "pt-141-10mg-supreme-biologics": "2026-10-27-pt-141-10mg-supreme-biologics-slide0-b8749c9d56.webp",
  "selank-5mg-supreme-biologics": "2026-10-27-selank-5mg-supreme-biologics-slide0-ff4221fdda.webp",
  "semax-5mg-supreme-biologics": "2026-10-27-semax-5mg-supreme-biologics-slide0-9b9b472527.webp",
  "ss-31-10mg-supreme-biologics": "2026-10-27-ss-31-10mg-supreme-biologics-slide0-f6d2405926.webp",
  "tesamorelin-5mg-supreme-biologics": "2026-10-27-tesamorelin-5mg-supreme-biologics-slide0-4e00ae1e12.webp",
  "thymosin-beta-4-10mg-supreme-biologics": "2026-10-27-thymosin-beta-4-10mg-supreme-biologics-slide0-f5444dd1a6.webp"
}
export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-vial] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY" : "MODE: PREVIEW (nothing will be changed)")
  const { data } = (await query.graph({ entity: "product", fields: ["id", "handle", "title", "metadata"], filters: { handle: Object.keys(MAP) } })) as any
  for (const [handle, file] of Object.entries(MAP)) {
    const p = data.find((x: any) => x.handle === handle)
    if (!p) { log(`  !! not found: ${handle}`); continue }
    const meta: Record<string, unknown> = { ...(p.metadata || {}), ui_image_0: `${STATIC}/${file}` }
    log(`  -> ${p.title}: slot 1 = ${file}`)
    if (APPLY) await updateProductsWorkflow(container).run({ input: { products: [{ id: p.id, thumbnail: `${STATIC}/${file}`, metadata: meta }] } })
  }
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
