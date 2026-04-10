import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { installNavHider } from "../lib/hide-nav-items"

const HideNavItemsCustomerList = () => {
  useEffect(installNavHider, [])
  return null
}

export const config = defineWidgetConfig({
  zone: "customer.list.before",
})

export default HideNavItemsCustomerList
