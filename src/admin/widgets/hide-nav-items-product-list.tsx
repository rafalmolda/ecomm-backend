import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { installNavHider } from "../lib/hide-nav-items"

const HideNavItemsProductList = () => {
  useEffect(installNavHider, [])
  return null
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default HideNavItemsProductList
