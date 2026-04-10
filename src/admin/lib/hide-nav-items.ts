/**
 * Shared helper: inject a <style> into document.head that hides Medusa core
 * sidebar nav items LifeSpanSupply doesn't use. Called from multiple widget
 * entry points (order/product/customer list zones) so that whatever page the
 * operator lands on first, the style is installed before they see the nav.
 *
 * Idempotent — subsequent calls are no-ops thanks to the style element id.
 */

const STYLE_ID = "lss-hide-nav-items"

const HIDDEN_HREFS = [
  "/inventory",
  "/price-lists",
  "/campaigns",
]

export function installNavHider() {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID)) return
  const css =
    HIDDEN_HREFS.map(
      (h) => `nav a[href="${h}"], nav a[href^="${h}/"]`
    ).join(",\n") + ` { display: none !important; }`
  const el = document.createElement("style")
  el.id = STYLE_ID
  el.textContent = css
  document.head.appendChild(el)
}
