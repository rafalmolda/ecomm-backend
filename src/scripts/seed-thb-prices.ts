import { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * One-shot seed: for every product variant that already has a USD price but
 * no THB price, compute THB as `ceil(usd * 34 / 100) * 100` (the same formula
 * the legacy storefront used in lib/price.ts) and write it to the variant's
 * price_set alongside the existing USD price.
 *
 * This mirrors the pre-migration behaviour so lifespansupply.com/th renders
 * identical Thai prices to the old Plesk deployment without forcing the
 * operator to hand-enter all 12. They can still override any price later via
 * the admin product-editor widget.
 *
 *   npx medusa exec ./src/scripts/seed-thb-prices.ts
 *
 * Idempotent — variants that already have a THB price are left untouched.
 */

const USD_TO_THB = 34

function computeThbMinor(usdMinor: number): number {
  // usdMinor is in cents (Medusa's minor-unit convention). Convert to dollars,
  // multiply by rate, round UP to the nearest whole 100 THB, then back to
  // satangs (THB minor units).
  const usdMajor = usdMinor / 100
  const thbMajor = Math.ceil((usdMajor * USD_TO_THB) / 100) * 100
  return thbMajor * 100
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

export default async function seedThbPrices({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // query.graph's generic parameter is the entity NAME, not the result shape.
  // So we type the returned data ourselves via a cast on the destructured value.
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
      const thb = prices.find((p) => p.currency_code === "thb")

      if (!usd || !usd.amount || usd.amount <= 0) {
        skipped++
        continue
      }
      if (thb && thb.amount && thb.amount > 0) {
        // Already has a THB price — don't overwrite the operator's work
        skipped++
        continue
      }

      const thbAmount = computeThbMinor(Number(usd.amount))

      // Send the full prices array for this variant so Medusa upserts both
      // currencies in one shot. Omitting USD would drop it.
      variantUpdates.push({
        id: variant.id,
        prices: [
          { currency_code: "usd", amount: Number(usd.amount) },
          { currency_code: "thb", amount: thbAmount },
        ],
      })
      updated++
      console.log(
        `[seed-thb] ${product.handle ?? product.id} / ${variant.title ?? variant.id}: usd=${Number(usd.amount) / 100} -> thb=${thbAmount / 100}`
      )
    }

    if (variantUpdates.length > 0) {
      productUpdates.push({ id: product.id, variants: variantUpdates })
    }
  }

  if (productUpdates.length === 0) {
    console.log(`[seed-thb] nothing to update. skipped=${skipped}`)
    return
  }

  const { result } = await updateProductsWorkflow(container).run({
    input: { products: productUpdates },
  })

  console.log("")
  console.log(`[seed-thb] updated ${updated} variant price(s) across ${productUpdates.length} product(s)`)
  console.log(`[seed-thb] skipped ${skipped} variant(s)`)
  console.log(`[seed-thb] workflow returned ${Array.isArray(result) ? result.length : 0} product(s)`)
}
