import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Enable THB as a store currency so variants can carry dual USD + THB prices.
 * Idempotent — re-running is a no-op if THB is already in the store's currency
 * list.
 *
 *   npx medusa exec ./src/scripts/add-thb-currency.ts
 */

export default async function addThbCurrency({ container }: ExecArgs) {
  const storeModuleService = container.resolve(Modules.STORE)

  const stores = await storeModuleService.listStores({}, {
    relations: ["supported_currencies"],
  })

  if (stores.length === 0) {
    console.log("[add-thb] no store found — aborting")
    return
  }

  const store = stores[0]
  const current = (store.supported_currencies ?? []).map(
    (c: { currency_code: string }) => c.currency_code
  )
  console.log(`[add-thb] current currencies: ${current.join(", ")}`)

  if (current.includes("thb")) {
    console.log("[add-thb] thb already present — no-op")
    return
  }

  const supported_currencies = [
    ...(store.supported_currencies ?? []).map(
      (c: { currency_code: string; is_default?: boolean }) => ({
        currency_code: c.currency_code,
        is_default: !!c.is_default,
      })
    ),
    { currency_code: "thb", is_default: false },
  ]

  await storeModuleService.updateStores(store.id, {
    supported_currencies,
  })

  console.log(
    `[add-thb] updated ${store.id} — currencies now: ${supported_currencies.map((c) => c.currency_code).join(", ")}`
  )
}
