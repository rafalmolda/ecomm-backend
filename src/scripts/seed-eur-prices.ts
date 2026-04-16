import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * One-shot seed: for every product variant that already has a USD price but
 * no EUR price, compute EUR as `round(usd * 0.92)` and write it to the
 * variant's prices alongside existing USD and THB prices.
 *
 *   npx medusa exec ./src/scripts/seed-eur-prices.ts
 *
 * Idempotent — variants that already have a EUR price are left untouched.
 */

const USD_TO_EUR = 0.92

function computeEurMinor(usdMinor: number): number {
  // usdMinor is in cents (Medusa minor-unit convention). Convert to dollars,
  // multiply by rate, round to nearest cent, back to minor units.
  const usdMajor = usdMinor / 100
  const eurMajor = Math.round(usdMajor * USD_TO_EUR * 100) / 100
  return Math.round(eurMajor * 100)
}

type VariantPrice = {
  id: string
  currency_code: string
  amount: number
}

type VariantWithPrices = {
  id: string
  title?: string | null
  prices?: VariantPrice[]
}

type ProductWithVariants = {
  id: string
  handle?: string
  variants?: VariantWithPrices[]
}

export default async function seedEurPrices({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const graphResult = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "variants.id",
      "variants.title",
      "variants.prices.id",
      "variants.prices.currency_code",
      "variants.prices.amount",
    ],
  })
  const products = graphResult.data as unknown as ProductWithVariants[]

  let updated = 0
  let skipped = 0
  const productUpdates: {
    id: string
    variants: { id: string; prices: { currency_code: string; amount: number }[] }[]
  }[] = []

  for (const product of products) {
    const variantUpdates: {
      id: string
      prices: { currency_code: string; amount: number }[]
    }[] = []

    for (const variant of product.variants ?? []) {
      const prices = variant.prices ?? []
      const usd = prices.find((p) => p.currency_code === "usd")
      const eur = prices.find((p) => p.currency_code === "eur")

      if (!usd || !usd.amount || usd.amount <= 0) {
        skipped++
        continue
      }
      if (eur && eur.amount && eur.amount > 0) {
        skipped++
        continue
      }

      const eurAmount = computeEurMinor(Number(usd.amount))

      // Send the full prices array so Medusa upserts all currencies.
      const thb = prices.find((p) => p.currency_code === "thb")
      const allPrices = [
        { currency_code: "usd", amount: Number(usd.amount) },
        { currency_code: "eur", amount: eurAmount },
      ]
      if (thb && thb.amount > 0) {
        allPrices.push({ currency_code: "thb", amount: Number(thb.amount) })
      }

      variantUpdates.push({ id: variant.id, prices: allPrices })
      updated++
      console.log(
        `[seed-eur] ${product.handle ?? product.id} / ${variant.title ?? variant.id}: usd=${Number(usd.amount) / 100} -> eur=${eurAmount / 100}`
      )
    }

    if (variantUpdates.length > 0) {
      productUpdates.push({ id: product.id, variants: variantUpdates })
    }
  }

  if (productUpdates.length === 0) {
    console.log(`[seed-eur] nothing to update. skipped=${skipped}`)
    return
  }

  const { result } = await updateProductsWorkflow(container).run({
    input: { products: productUpdates },
  })

  console.log("")
  console.log(`[seed-eur] updated ${updated} variant price(s) across ${productUpdates.length} product(s)`)
  console.log(`[seed-eur] skipped ${skipped} variant(s)`)
  console.log(`[seed-eur] workflow returned ${Array.isArray(result) ? result.length : 0} product(s)`)
}
