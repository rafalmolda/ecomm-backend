import { MedusaService } from "@medusajs/framework/utils"
import LoyaltyLedger from "./models/loyalty-ledger"

export type Tier = "basic" | "bronze" | "silver" | "gold"

export const TIER_THRESHOLDS: Record<Exclude<Tier, "basic">, number> = {
  bronze: 100,
  silver: 500,
  gold: 1000,
}

export const TIER_DISCOUNT_PCT: Record<Tier, number> = {
  basic: 0,
  bronze: 5,
  silver: 10,
  gold: 20,
}

export const TIER_GROUP_HANDLE: Record<Tier, string> = {
  basic: "tier-basic",
  bronze: "tier-bronze",
  silver: "tier-silver",
  gold: "tier-gold",
}

export const POINTS_DIVISOR_BY_CURRENCY: Record<string, number> = {
  usd: 1,
  eur: 1,
  thb: 30,
}

export const ROLLING_WINDOW_DAYS = 365

// Sticky downgrade: tier only drops if rolling total falls below
// threshold minus grace — avoids flickering across boundaries.
export const TIER_DOWNGRADE_GRACE = 50

export function tierForPoints(points: number): Tier {
  if (points >= TIER_THRESHOLDS.gold) return "gold"
  if (points >= TIER_THRESHOLDS.silver) return "silver"
  if (points >= TIER_THRESHOLDS.bronze) return "bronze"
  return "basic"
}

export function nextTier(current: Tier): Tier | null {
  if (current === "basic") return "bronze"
  if (current === "bronze") return "silver"
  if (current === "silver") return "gold"
  return null
}

export function thresholdFor(tier: Tier): number {
  if (tier === "basic") return 0
  return TIER_THRESHOLDS[tier]
}

class LoyaltyModuleService extends MedusaService({
  LoyaltyLedger,
}) {}

export default LoyaltyModuleService
