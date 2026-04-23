import { Module } from "@medusajs/framework/utils"
import StockNotifyModuleService from "./service"

export const STOCK_NOTIFY_MODULE = "stock_notify"

export default Module(STOCK_NOTIFY_MODULE, {
  service: StockNotifyModuleService,
})
