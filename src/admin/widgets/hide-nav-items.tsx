import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { installNavHider } from "../lib/hide-nav-items"

/**
 * Fires on the orders list page (the default admin landing after login).
 * See ../lib/hide-nav-items.ts for what this does and why.
 */
const HideNavItemsOrderList = () => {
  useEffect(installNavHider, [])
  return null
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default HideNavItemsOrderList
