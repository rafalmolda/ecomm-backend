import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Hide Medusa's default product-detail cards that are fully replaced by our
 * unified product-editor widget.
 *
 * Strategy: the product-editor widget marks its outer Container with
 * id="lss-product-editor". We walk up the DOM from that element until we
 * find the "slot" — the direct child of Medusa's main column grid — then:
 *   1. Hide every sibling of the slot that comes AFTER it in the main
 *      column (General info, Media, Options, Variants, Metadata, Attributes).
 *   2. Hide every sibling of the main column in its parent grid (the
 *      right sidebar: Sales Channels, Shipping, Organization, etc.).
 *
 * Text-matching headings was too fragile — Medusa labels its rows with
 * plain <span> elements so there's no stable selector. The structural
 * approach is reliable across admin versions because it only relies on the
 * one marker ID we control.
 *
 * If something important gets hidden and you need it back, the quickest
 * workaround is to delete this widget file and rebuild.
 */

const ANCHOR_ID = "lss-product-editor"

function findSlot(anchor: HTMLElement): HTMLElement | null {
  // Walk up until we hit a parent that has multiple children — that parent
  // is the grid/column, and the current node is the "slot" (Medusa's card
  // wrapper for our widget). Don't walk past <main>/<body>.
  let node: HTMLElement = anchor
  for (let i = 0; i < 12; i++) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) return null
    if (parent.tagName === "MAIN" || parent.tagName === "BODY") return null
    if (parent.children.length > 1) return node
    node = parent
  }
  return null
}

function hideDefaultSections() {
  const anchor = document.getElementById(ANCHOR_ID)
  if (!anchor) return

  const slot = findSlot(anchor)
  if (!slot) return

  const mainColumn = slot.parentElement
  if (!mainColumn) return

  // 1. Hide siblings AFTER our slot in the main column.
  let afterAnchor = false
  for (const child of Array.from(mainColumn.children) as HTMLElement[]) {
    if (child === slot) {
      afterAnchor = true
      continue
    }
    if (!afterAnchor) continue
    if (child.style.display !== "none") {
      child.setAttribute("data-lss-hidden", "below-editor")
      child.style.display = "none"
    }
  }

  // 2. Hide siblings of the main column (the sidebar + any other columns).
  //    Only do this if the grandparent is a grid-like container with exactly
  //    2-3 columns — otherwise we might accidentally hide toolbar/header.
  const gridParent = mainColumn.parentElement
  if (!gridParent) return
  const gridChildrenCount = gridParent.children.length
  if (gridChildrenCount < 2 || gridChildrenCount > 4) return

  const gridClass =
    typeof gridParent.className === "string" ? gridParent.className : ""
  const looksLikeGrid =
    gridClass.includes("grid") ||
    gridClass.includes("flex") ||
    gridClass.includes("cols-")
  if (!looksLikeGrid) return

  for (const sibling of Array.from(gridParent.children) as HTMLElement[]) {
    if (sibling === mainColumn) continue
    if (sibling.style.display !== "none") {
      sibling.setAttribute("data-lss-hidden", "sidebar")
      sibling.style.display = "none"
    }
  }
}

const HideDefaultSectionsWidget = () => {
  useEffect(() => {
    hideDefaultSections()
    // Medusa's admin SPA re-renders cards after mutations (save, toast, etc.).
    // Watch the whole body and re-hide on any DOM change. Debounce via rAF.
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
