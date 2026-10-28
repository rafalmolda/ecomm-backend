import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { timingSafeEqual } from "crypto"
import { circleNoteForOrder } from "../../../utils/circle"

// GET /store/circle-note?order_id=…  (header x-lss-key required)
// Used by the storefront's new-order email to the owner, so staff see the
// Circle gift to pack. Internal only.
function keyOk(given: string): boolean {
  const key = process.env.LSS_INTERNAL_KEY || ""
  if (!key || given.length !== key.length) return false
  return timingSafeEqual(Buffer.from(given), Buffer.from(key))
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!keyOk(String(req.headers["x-lss-key"] ?? ""))) {
    res.status(401).json({ message: "unauthorized" })
    return
  }
  const orderId = String((req.query as Record<string, unknown>)?.order_id ?? "")
  if (!orderId) {
    res.status(400).json({ message: "order_id required" })
    return
  }
  try {
    res.json({ circle: await circleNoteForOrder(req.scope, orderId) })
  } catch (e) {
    console.error("[circle-note] failed", e)
    res.json({ circle: null })
  }
}
