import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Hide Medusa's default product-detail sections that are fully replaced by
 * our custom product-editor widget (title, description, media, variants,
 * metadata, organization, attributes). Pure CSS can't target them because
 * Medusa's core cards have no stable data-testids — so we walk the DOM,
 * match section headings by their text content, and set display:none on the
 * nearest card container.
 *
 * A MutationObserver keeps this working across Medusa admin re-renders
 * (client-side navigation, variant edits, etc.) because the admin SPA can
 * remount cards without re-mounting our widget.
 *
 * To re-show a section: remove its heading text from HIDE_HEADINGS and redeploy.
 */

// Exact heading text strings as rendered by Medusa v2 admin (English locale).
// Our own widget uses headings that are NOT in this list ("Product editor",
// "Long description", "Specifications", "Variants & pricing"), so it stays.
const HIDE_HEADINGS = new Set([
  "General",
  "General information",
  "Media",
  "Organization",
  "Organize",
  "Attributes",
  "Metadata",
  "Sales Channels",
  "Shipping Profile",
  "Variants",
])

function walkUpToCard(start: HTMLElement): HTMLElement | null {
  // Medusa's Container renders each card as a <div> with border/rounded
  // classes. Walk up at most 8 levels until we find something that looks like
  // the card boundary — either a <section>, a <div> with rounded corners, or
  // the main layout grid child. Fall back to the direct parent.
  let node: HTMLElement | null = start
  for (let i = 0; i < 8 && node; i++) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) return node
    const cls = parent.className || ""
    const isCard =
      parent.tagName === "SECTION" ||
      (typeof cls === "string" &&
        (cls.includes("rounded-lg") ||
          cls.includes("rounded-xl") ||
          cls.includes("divide-y")))
    if (isCard) return parent
    node = parent
  }
  return start.parentElement
}

function hideDefaultSections() {
  const headings = document.querySelectorAll<HTMLElement>("h1, h2, h3")
  headings.forEach((h) => {
    const text = (h.textContent || "").trim()
    if (!HIDE_HEADINGS.has(text)) return
    const card = walkUpToCard(h)
    if (card && card.style.display !== "none") {
      card.setAttribute("data-lss-hidden", text)
      card.style.display = "none"
    }
  })
}

const HideDefaultSectionsWidget = () => {
  useEffect(() => {
    hideDefaultSections()
    // Medusa's admin re-renders cards on many events. Watch the whole body
    // and re-hide whenever the DOM changes. Debounce via rAF so we batch
    // mutations instead of firing on every individual mutation record.
    let pending = false
    const run = () => {
      pending = false
      hideDefaultSections()
    }
    const obs = new MutationObserver(() => {
      if (pending) return
      pending = true
      requestAnimationFrame(run)
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])
  return null
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default HideDefaultSectionsWidget
