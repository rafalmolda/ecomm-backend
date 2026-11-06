import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Lifespan, 26 Oct 2026: bind photos to the 14 dual-chamber cartridge products
 * (same pattern as Chakrit's Ipamorelin: 1 box packshot, 2 injector lineup, 3 dual-chamber technology).
 * Slot 4 (the injector 7-step guide) is intentionally NOT used: it shows Monera cartridges.
 * Does not change product status. PREVIEW by default, APPLY=1 to write.
 */
const STATIC = "https://api.lifespansupply.com/static"
const INJECTOR_LINEUP = `${STATIC}/1793029713298-ipamorelin-dual-chamber-supreme-biologics-slide1-1793029713046.webp`
const MAP: Record<string, [string, string]> = {
  "aod-9604-dual-chamber-supreme-biologics": ["2026-10-26-aod-9604-dual-chamber-supreme-biologics-slide0-02db006f37.webp", "2026-10-26-aod-9604-dual-chamber-supreme-biologics-slide2-633b680f83.webp"],
  "bpc-157-dual-chamber-supreme-biologics": ["2026-10-26-bpc-157-dual-chamber-supreme-biologics-slide0-68269fbbe7.webp", "2026-10-26-bpc-157-dual-chamber-supreme-biologics-slide2-787723555d.webp"],
  "cjc-1295-no-dac-dual-chamber-supreme-biologics": ["2026-10-26-cjc-1295-no-dac-dual-chamber-supreme-biologics-slide0-87fe8ebf91.webp", "2026-10-26-cjc-1295-no-dac-dual-chamber-supreme-biologics-slide2-0ea4424f5f.webp"],
  "dsip-dual-chamber-supreme-biologics": ["2026-10-26-dsip-dual-chamber-supreme-biologics-slide0-9dc6fe2f12.webp", "2026-10-26-dsip-dual-chamber-supreme-biologics-slide2-1e7e806dd3.webp"],
  "epithalon-dual-chamber-supreme-biologics": ["2026-10-26-epithalon-dual-chamber-supreme-biologics-slide0-a70f1c0ee4.webp", "2026-10-26-epithalon-dual-chamber-supreme-biologics-slide2-9c17011fe1.webp"],
  "kpv-dual-chamber-supreme-biologics": ["2026-10-26-kpv-dual-chamber-supreme-biologics-slide0-631227f805.webp", "2026-10-26-kpv-dual-chamber-supreme-biologics-slide2-8ba8d2fe64.webp"],
  "kisspeptin-10-dual-chamber-supreme-biologics": ["2026-10-26-kisspeptin-10-dual-chamber-supreme-biologics-slide0-a83b0fef86.webp", "2026-10-26-kisspeptin-10-dual-chamber-supreme-biologics-slide2-a8d732601d.webp"],
  "mots-c-dual-chamber-supreme-biologics": ["2026-10-26-mots-c-dual-chamber-supreme-biologics-slide0-95febbe51d.webp", "2026-10-26-mots-c-dual-chamber-supreme-biologics-slide2-c84caee4c3.webp"],
  "nad-plus-dual-chamber-supreme-biologics": ["2026-10-26-nad-plus-dual-chamber-supreme-biologics-slide0-d0b65835f6.webp", "2026-10-26-nad-plus-dual-chamber-supreme-biologics-slide2-1dbfd76b77.webp"],
  "pt-141-dual-chamber-supreme-biologics": ["2026-10-26-pt-141-dual-chamber-supreme-biologics-slide0-e0832036dc.webp", "2026-10-26-pt-141-dual-chamber-supreme-biologics-slide2-52596f78e1.webp"],
  "ss-31-dual-chamber-supreme-biologics": ["2026-10-26-ss-31-dual-chamber-supreme-biologics-slide0-d5f520e9c0.webp", "2026-10-26-ss-31-dual-chamber-supreme-biologics-slide2-9103030eab.webp"],
  "semax-dual-chamber-supreme-biologics": ["2026-10-26-semax-dual-chamber-supreme-biologics-slide0-ff629a7fbe.webp", "2026-10-26-semax-dual-chamber-supreme-biologics-slide2-6bc0a0d324.webp"],
  "tesamorelin-dual-chamber-supreme-biologics": ["2026-10-26-tesamorelin-dual-chamber-supreme-biologics-slide0-e86f6915c0.webp", "2026-10-26-tesamorelin-dual-chamber-supreme-biologics-slide2-e4232bf005.webp"],
  "thymosin-beta-4-dual-chamber-supreme-biologics": ["2026-10-26-thymosin-beta-4-dual-chamber-supreme-biologics-slide0-c8f1db35db.webp", "2026-10-26-thymosin-beta-4-dual-chamber-supreme-biologics-slide2-b983d46cbb.webp"]
}

export default async function run({ container }: ExecArgs) {
  const APPLY = process.env.APPLY === "1"
  const log = (m: string) => console.log(`[lss-img] ${m}`)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  log(APPLY ? "MODE: APPLY" : "MODE: PREVIEW (nothing will be changed)")
  const { data } = (await query.graph({ entity: "product", fields: ["id", "handle", "status", "metadata"], filters: { handle: Object.keys(MAP) } })) as any
  for (const [handle, [pack, tech]] of Object.entries(MAP)) {
    const p = data.find((x: any) => x.handle === handle)
    if (!p) { log(`  !! not found: ${handle}`); continue }
    const meta: Record<string, unknown> = { ...(p.metadata || {}) }
    meta.ui_image_0 = `${STATIC}/${pack}`
    meta.ui_image_1 = INJECTOR_LINEUP
    meta.ui_image_2 = `${STATIC}/${tech}`
    meta.ui_image_3 = null
    log(`  -> ${handle} (${p.status}): 1 ${pack} | 2 injector lineup | 3 ${tech}`)
    if (APPLY) await updateProductsWorkflow(container).run({ input: { products: [{ id: p.id, thumbnail: `${STATIC}/${pack}`, metadata: meta }] } })
  }
  log("")
  log(APPLY ? "DONE (applied)" : "DONE (preview only, nothing changed)")
}
