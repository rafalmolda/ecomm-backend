import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Enable EUR as a store currency so variants can carry USD + THB + EUR prices.
 * Idempotent — re-running is a no-op if EUR is already present.
 *
 *   npx medusa exec ./src/scripts/add-eur-currency.ts
 */

export default async function addEurCurrency({ container }: ExecArgs) {
  const storeModuleService = container.resolve(Modules.STORE)

  const stores = await storeModuleService.listStores({}, {
    relations: ["supported_currencies"],
  })

  if (stores.length === 0) {
    console.log("[add-eur] no store found — aborting")
    return
  }

  const store = stores[0]
  const current = (store.supported_currencies ?? []).map(
    (c: { currency_code: string }) => c.currency_code
  )
  console.log(`[add-eur] current currencies: ${current.join(", ")}`)

  if (current.includes("eur")) {
    console.log("[add-eur] eur already present — no-op")
    return
  }

  const supported_currencies = [
    ...(store.supported_currencies ?? []).map(
      (c: { currency_code: string; is_default?: boolean }) => ({
        currency_code: c.currency_code,
        is_default: !!c.is_default,
      })
    ),
    { currency_code: "eur", is_default: false },
  ]

  await storeModuleService.updateStores(store.id, {
    supported_currencies,
  })

  console.log(
    `[add-eur] updated ${store.id} — currencies now: ${supported_currencies.map((c) => c.currency_code).join(", ")}`
  )
}
