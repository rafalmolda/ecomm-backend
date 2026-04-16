import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import {
  Container,
  Heading,
  Input,
  Textarea,
  Button,
  Text,
  Label,
  IconButton,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useEffect, useRef, useState } from "react"

/**
 * LifeSpanSupply unified product editor. Primary editing surface for every
 * field the business uses, with English-only content inputs and a variants
 * table supporting tri-currency USD + THB + EUR pricing. Product translations
 * are handled automatically via DeepL.
 *
 * Layout top to bottom:
 *   1. Featured image (thumbnail) — preview + URL + upload button
 *   2. Title:              [EN input]
 *   3. Short description:  [EN textarea]
 *   4. Long description:   [EN textarea]
 *   5. Variants table      (title, SKU, USD price, THB price, EUR price, delete button)
 *      + "Add variant" button
 *   6. Single Save button
 *
 * Save path:
 *   A) DELETE /admin/products/:id/variants/:variant_id   (for removed variants)
 *   B) POST   /admin/products/:id                        (all edits + new)
 *
 * The product update payload includes:
 *   - Core fields: title, description, thumbnail
 *   - metadata:    long_description, cas_number, molecular_formula, etc.
 *   - variants:    full array — existing variants with their id + prices,
 *                  new variants without an id (Medusa creates them).
 *                  Each variant's `prices` array always carries ALL THREE
 *                  currency codes so unset values don't silently persist the
 *                  old price.
 */

type Props = DetailWidgetProps<AdminProduct>

type Money = { amount: number; id?: string }
type StockLevel = {
  inventory_item_id: string
  location_id: string
  // The current stocked quantity we loaded from Medusa. Used to detect which
  // levels actually changed so we don't issue a PATCH per variant on every save.
  original: number
}
type VariantRow = {
  // Present if the variant already exists in Medusa; absent for newly-added ones.
  id?: string
  title: string
  sku: string
  usd: Money // major units (dollars)
  thb: Money // major units (baht)
  eur: Money // major units (euros)
  stock: number // total across all location levels
  stockLevels: StockLevel[]
}

// Medusa stores amounts in the currency minor unit (cents, satangs) — same
// convention used by the storefront's mapProduct. Divide by 100 on read,
// multiply by 100 on write.
const fromMinor = (n: number | null | undefined): number =>
  n == null ? 0 : Number(n) / 100
const toMinor = (n: number): number => Math.round(n * 100)

/**
 * Long description is stored in metadata as a single markdown blob BUT the
 * storefront (src/app/[locale]/product/[slug]/page.tsx) parses it into three
 * sections at render time, looking for **Heading** or ## Heading markers:
 *
 *   {intro / Product Description}
 *
 *   **Research Applications**
 *   {bullets}
 *
 *   **Preparation**
 *   {instructions}
 *
 * The admin widget shows these as three separate textareas so the operator
 * can edit each section in isolation. parseLong() splits on load, composeLong()
 * joins back on save, preserving the **Heading** convention the parser expects.
 */
type LongSections = {
  product: string
  applications: string
  preparation: string
}

function classifyHeading(
  raw: string
): "product" | "applications" | "preparation" | null {
  const h = raw.toLowerCase()
  if (
    h.includes("research") ||
    h.includes("application") ||
    h.includes("การประยุกต์") ||
    h.includes("การวิจัย")
  )
    return "applications"
  if (
    h.includes("preparation") ||
    h.includes("administration") ||
    h.includes("การเตรียม")
  )
    return "preparation"
  if (
    h.includes("product description") ||
    h.includes("description") ||
    h.includes("คำอธิบาย")
  )
    return "product"
  return null
}

function parseLong(text: string | null | undefined): LongSections {
  if (!text) return { product: "", applications: "", preparation: "" }

  const buckets: Record<"product" | "applications" | "preparation", string[]> = {
    product: [],
    applications: [],
    preparation: [],
  }
  let current: "product" | "applications" | "preparation" = "product"

  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trim()

    // Standalone bold heading:  **Heading**  or **Heading:**
    const standaloneMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/)
    // Inline bold heading:      **Heading:** content on same line
    const inlineMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s+(.+)$/)
    // Markdown H1-H3:           ## Heading
    const hashMatch = trimmed.match(/^#{1,3}\s+(.+?):?\s*$/)

    let matchedHeading: string | undefined
    let inlineContent: string | undefined
    if (standaloneMatch) matchedHeading = standaloneMatch[1]
    else if (inlineMatch) {
      matchedHeading = inlineMatch[1]
      inlineContent = inlineMatch[2]
    } else if (hashMatch) matchedHeading = hashMatch[1]

    if (matchedHeading) {
      const target = classifyHeading(matchedHeading)
      if (target) {
        current = target
        if (inlineContent) buckets[current].push(inlineContent)
        continue
      }
      // Unknown heading — leave as literal content in the current bucket
    }

    buckets[current].push(rawLine)
  }

  return {
    product: buckets.product.join("\n").trim(),
    applications: buckets.applications.join("\n").trim(),
    preparation: buckets.preparation.join("\n").trim(),
  }
}

function composeLong(s: LongSections): string {
  const parts: string[] = []
  if (s.product.trim()) parts.push(s.product.trim())
  if (s.applications.trim())
    parts.push(`**Research Applications**\n${s.applications.trim()}`)
  if (s.preparation.trim())
    parts.push(`**Preparation**\n${s.preparation.trim()}`)
  return parts.join("\n\n")
}

type AdminVariantLike = {
  id: string
  title?: string | null
  sku?: string | null
  prices?: { id: string; amount: number; currency_code: string }[]
  inventory_items?: {
    inventory_item_id?: string
    inventory?: {
      id?: string
      location_levels?: {
        id?: string
        location_id?: string
        stocked_quantity?: number
      }[]
    }
  }[]
}

function readVariantRow(v: AdminVariantLike): VariantRow {
  const prices = v.prices ?? []
  const usd = prices.find((p) => p.currency_code === "usd")
  const thb = prices.find((p) => p.currency_code === "thb")
  const eur = prices.find((p) => p.currency_code === "eur")

  // Flatten inventory_items → location_levels into a single list. We sum
  // stocked_quantity across every level so the operator sees one "total
  // stock" number per variant. On save, we proportionally update the first
  // level (single-location stores are the common case here).
  const stockLevels: StockLevel[] = []
  for (const ii of v.inventory_items ?? []) {
    const inv = ii.inventory
    const itemId = ii.inventory_item_id ?? inv?.id
    if (!itemId) continue
    for (const lvl of inv?.location_levels ?? []) {
      if (!lvl.location_id) continue
      stockLevels.push({
        inventory_item_id: itemId,
        location_id: lvl.location_id,
        original: Number(lvl.stocked_quantity ?? 0),
      })
    }
  }
  const totalStock = stockLevels.reduce((sum, l) => sum + l.original, 0)

  return {
    id: v.id,
    title: v.title ?? "",
    sku: v.sku ?? "",
    usd: { amount: fromMinor(usd?.amount), id: usd?.id },
    thb: { amount: fromMinor(thb?.amount), id: thb?.id },
    eur: { amount: fromMinor(eur?.amount), id: eur?.id },
    stock: totalStock,
    stockLevels,
  }
}

function newVariantRow(): VariantRow {
  return {
    title: "",
    sku: "",
    usd: { amount: 0 },
    thb: { amount: 0 },
    eur: { amount: 0 },
    stock: 0,
    stockLevels: [],
  }
}

const ProductEditorWidget = ({ data }: Props) => {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>

  const [titleEn, setTitleEn] = useState(data.title ?? "")
  const [descEn, setDescEn] = useState(data.description ?? "")
  const [longEn, setLongEn] = useState<LongSections>(() =>
    parseLong((metadata.long_description as string) ?? "")
  )
  const [thumbnail, setThumbnail] = useState(data.thumbnail ?? "")

  // Specifications — mirrored 1:1 with the storefront's Specifications panel.
  //
  //  - CAS, Molecular Formula, Purity:  metadata.{cas_number,
  //    molecular_formula, purity_percentage}
  //  - Form, Storage:  metadata.form / metadata.storage. Empty falls back to
  //    the static i18n strings (specFormValue / specStorageValue). Setting
  //    them on a product overrides those defaults for that product only.
  //  - SKU, Size:  come from the first variant. Editing them here writes
  //    back to variant[0] on save (also syncs with the Variants table below).
  const [casNumber, setCasNumber] = useState(
    (metadata.cas_number as string) ?? ""
  )
  const [molecularFormula, setMolecularFormula] = useState(
    (metadata.molecular_formula as string) ?? ""
  )
  const [purityPercentage, setPurityPercentage] = useState(
    (metadata.purity_percentage as string) ?? ""
  )
  const [formOverride, setFormOverride] = useState(
    (metadata.form as string) ?? ""
  )
  const [storageOverride, setStorageOverride] = useState(
    (metadata.storage as string) ?? ""
  )

  // Medusa's admin widget `data` prop does NOT eagerly expand variants.prices
  // (it's a lazy relation on the AdminProduct query). So we fetch the full
  // product ourselves on mount with *variants.prices in the fields query.
  // Without this, existing USD prices show as 0 and operators have to re-type
  // them — which is what they reported after the initial rollout.
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [variantsLoading, setVariantsLoading] = useState(true)
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadVariants() {
      try {
        // Expand prices + inventory items + per-location stock levels in one
        // call. The inventory_items link comes back under `variants.inventory`
        // (through the product_variant_inventory_item link table).
        const fields = [
          "*variants",
          "*variants.prices",
          "*variants.inventory_items.inventory",
          "*variants.inventory_items.inventory.location_levels",
        ].join(",")
        const res = await fetch(
          `/admin/products/${data.id}?fields=${encodeURIComponent(fields)}`,
          { credentials: "include" }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as {
          product?: { variants?: AdminVariantLike[] }
        }
        const fresh = body.product?.variants ?? []
        if (!cancelled) setVariants(fresh.map(readVariantRow))
      } catch {
        // Fall back to the widget prop if the fetch fails (offline, etc).
        if (!cancelled)
          setVariants(
            ((data.variants ?? []) as AdminVariantLike[]).map(readVariantRow)
          )
      } finally {
        if (!cancelled) setVariantsLoading(false)
      }
    }
    loadVariants()
    return () => {
      cancelled = true
    }
  }, [data.id, data.variants])

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<
    | { kind: "ok"; text: string }
    | { kind: "err"; text: string }
    | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updateVariant(idx: number, patch: Partial<VariantRow>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    )
  }

  function updateVariantPrice(
    idx: number,
    currency: "usd" | "thb" | "eur",
    amount: number
  ) {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === idx ? { ...v, [currency]: { ...v[currency], amount } } : v
      )
    )
  }

  function updateVariantStock(idx: number, stock: number) {
    setVariants((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, stock } : v))
    )
  }

  function removeVariant(idx: number) {
    setVariants((prev) => {
      const v = prev[idx]
      if (v.id) setDeletedVariantIds((d) => [...d, v.id!])
      return prev.filter((_, i) => i !== idx)
    })
  }

  function addVariant() {
    setVariants((prev) => [...prev, newVariantRow()])
  }

  async function uploadFile(file: File) {
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append("files", file)
      const res = await fetch(`/admin/uploads`, {
        method: "POST",
        credentials: "include",
        body: form,
      })
      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`)
      const body = await res.json()
      const url = body?.files?.[0]?.url
      if (!url) throw new Error("Upload succeeded but no URL returned")
      setThumbnail(url)
      setMessage({ kind: "ok", text: "Image uploaded — click Save to persist" })
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      // Step 1: delete removed variants
      for (const vid of deletedVariantIds) {
        const res = await fetch(`/admin/products/${data.id}/variants/${vid}`, {
          method: "DELETE",
          credentials: "include",
        })
        if (!res.ok && res.status !== 404) {
          const body = await res.text()
          throw new Error(
            `DELETE variant ${vid} failed: HTTP ${res.status}: ${body.slice(0, 150)}`
          )
        }
      }

      // Step 2: update core product + upsert variants
      const payload: Record<string, unknown> = {
        title: titleEn,
        description: descEn,
        thumbnail: thumbnail || null,
        metadata: {
          ...metadata,
          long_description: composeLong(longEn),
          cas_number: casNumber,
          molecular_formula: molecularFormula,
          purity_percentage: purityPercentage,
          form: formOverride,
          storage: storageOverride,
        },
        variants: variants.map((v) => {
          const prices = [
            { currency_code: "usd", amount: toMinor(v.usd.amount) },
            { currency_code: "thb", amount: toMinor(v.thb.amount) },
            { currency_code: "eur", amount: toMinor(v.eur.amount) },
          ]
          if (v.id) {
            return {
              id: v.id,
              title: v.title,
              sku: v.sku,
              prices,
            }
          }
          return {
            title: v.title,
            sku: v.sku,
            prices,
            // New variants need an options map — use a placeholder so Medusa
            // doesn't reject. If the product has option groups, operator must
            // set options via the default Medusa UI below.
            options: { default: v.title || "Default" },
          }
        }),
      }

      const res = await fetch(`/admin/products/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`)
      }

      // Step 3: update inventory stock levels for variants whose stock
      // changed. We put the entire delta on the FIRST level of each variant
      // (single-location assumption — matches this store's setup). If a
      // variant has multiple levels, the remaining levels are left alone.
      for (const v of variants) {
        const totalOriginal = v.stockLevels.reduce((s, l) => s + l.original, 0)
        if (v.stock === totalOriginal) continue
        const target = v.stockLevels[0]
        if (!target) continue
        // Put the new total on the first level; zero out the rest so the
        // resulting total matches what the operator typed.
        const levelsPayload = v.stockLevels.map((lvl, i) => ({
          inventory_item_id: lvl.inventory_item_id,
          location_id: lvl.location_id,
          stocked_quantity: i === 0 ? v.stock : 0,
        }))
        for (const lp of levelsPayload) {
          const invRes = await fetch(
            `/admin/inventory-items/${lp.inventory_item_id}/location-levels/${lp.location_id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                stocked_quantity: lp.stocked_quantity,
              }),
            }
          )
          if (!invRes.ok && invRes.status !== 404) {
            const body = await invRes.text()
            throw new Error(
              `Stock update failed for ${lp.inventory_item_id}@${lp.location_id}: HTTP ${invRes.status}: ${body.slice(0, 150)}`
            )
          }
        }
      }

      setDeletedVariantIds([])
      setMessage({ kind: "ok", text: "Saved — reload the page to see variant IDs and refreshed stock" })
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container id="lss-product-editor" className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Product editor</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          English product content + tri-currency pricing. Product translations handled automatically via DeepL.
        </Text>
      </div>

      {/* Featured image */}
      <div className="flex flex-col gap-4 px-6 py-5 md:flex-row">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          {thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnail}
              alt="Featured image"
              className="h-full w-full object-cover"
            />
          ) : (
            <Text size="small" className="text-ui-fg-muted">
              no image
            </Text>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <Label size="xsmall" className="text-ui-fg-subtle">
              Featured image URL
            </Label>
            <Input
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://… or upload below"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) uploadFile(f)
                e.target.value = ""
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              isLoading={uploading}
              disabled={uploading}
            >
              Upload image
            </Button>
            {thumbnail && (
              <Button
                variant="transparent"
                onClick={() => setThumbnail("")}
                disabled={uploading || saving}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-1 gap-4 px-6 py-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Title (English)
          </Label>
          <Input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="BPC-157"
          />
        </div>
      </div>

      {/* Short description */}
      <div className="grid grid-cols-1 gap-4 px-6 py-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Short description (English)
          </Label>
          <Textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            rows={4}
            placeholder="One-sentence summary"
          />
        </div>
      </div>

      {/* Long description — three sections, each bilingual */}
      <div className="px-6 py-5">
        <Heading level="h3">Long description</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Three sections shown on the product page. Bullets with <code>-</code>
          or <code>•</code> render as a list.
        </Text>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Product description (English)
          </Label>
          <Textarea
            value={longEn.product}
            onChange={(e) =>
              setLongEn((s) => ({ ...s, product: e.target.value }))
            }
            rows={6}
            placeholder="Intro paragraph — what is it, purity, sourcing…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Research Applications (English)
          </Label>
          <Textarea
            value={longEn.applications}
            onChange={(e) =>
              setLongEn((s) => ({ ...s, applications: e.target.value }))
            }
            rows={6}
            placeholder="- Wound healing pathway studies&#10;- …"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Preparation (English)
          </Label>
          <Textarea
            value={longEn.preparation}
            onChange={(e) =>
              setLongEn((s) => ({ ...s, preparation: e.target.value }))
            }
            rows={4}
            placeholder="Reconstitute with bacteriostatic water…"
          />
        </div>
      </div>

      {/* Specifications — matches the storefront's Specifications panel 1:1 */}
      <div className="px-6 py-5">
        <Heading level="h3">Specifications</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Same 7 rows shown on the storefront product page.
          <strong> SKU</strong> and <strong>Size</strong> come from the first
          variant (edit them in the Variants table below).{" "}
          <strong>Form</strong> and <strong>Storage</strong> are fixed strings
          in the i18n messages file (src/messages/en.json &amp; th.json).
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-5 md:grid-cols-2 md:gap-x-6">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            SKU
          </Label>
          <Input
            value={variants[0]?.sku ?? ""}
            onChange={(e) => updateVariant(0, { sku: e.target.value })}
            placeholder="BPC-5MG"
            disabled={variants.length === 0}
          />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Size
          </Label>
          <Input
            value={variants[0]?.title ?? ""}
            onChange={(e) => updateVariant(0, { title: e.target.value })}
            placeholder="5mg"
            disabled={variants.length === 0}
          />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Purity %
          </Label>
          <Input
            value={purityPercentage}
            onChange={(e) => setPurityPercentage(e.target.value)}
            placeholder="99"
          />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Molecular Formula
          </Label>
          <Input
            value={molecularFormula}
            onChange={(e) => setMolecularFormula(e.target.value)}
            placeholder="C62H98N16O22"
          />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            CAS Number
          </Label>
          <Input
            value={casNumber}
            onChange={(e) => setCasNumber(e.target.value)}
            placeholder="137525-51-0"
          />
        </div>
        <div className="md:col-span-1" />
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Form (blank = default &ldquo;Lyophilized Powder&rdquo;)
          </Label>
          <Input
            value={formOverride}
            onChange={(e) => setFormOverride(e.target.value)}
            placeholder="Lyophilized Powder"
          />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">
            Storage (blank = default &ldquo;2-8°C (refrigerated)&rdquo;)
          </Label>
          <Input
            value={storageOverride}
            onChange={(e) => setStorageOverride(e.target.value)}
            placeholder="2-8°C (refrigerated)"
          />
        </div>
      </div>

      {/* Variants */}
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h3">Variants &amp; pricing</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Each variant is a size (e.g. 5mg, 10mg). Prices are in major
              units — 54 means $54.00 or ฿54.
            </Text>
          </div>
          <Button variant="secondary" onClick={addVariant} disabled={saving}>
            <Plus />
            Add variant
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-ui-fg-subtle">
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  Size / Title
                </th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  SKU
                </th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  USD
                </th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  THB
                </th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  EUR
                </th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">
                  Stock
                </th>
                <th className="w-10 border-b border-ui-border-base px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variantsLoading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-2 py-4 text-center text-ui-fg-muted"
                  >
                    Loading variants…
                  </td>
                </tr>
              )}
              {!variantsLoading && variants.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-2 py-4 text-center text-ui-fg-muted"
                  >
                    No variants — click <strong>Add variant</strong> to create
                    one.
                  </td>
                </tr>
              )}
              {variants.map((v, idx) => (
                <tr key={v.id ?? `new-${idx}`}>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      value={v.title}
                      onChange={(e) =>
                        updateVariant(idx, { title: e.target.value })
                      }
                      placeholder="5mg"
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      value={v.sku}
                      onChange={(e) =>
                        updateVariant(idx, { sku: e.target.value })
                      }
                      placeholder="BPC-5MG"
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={v.usd.amount || ""}
                      onChange={(e) =>
                        updateVariantPrice(
                          idx,
                          "usd",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="54.00"
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      value={v.thb.amount || ""}
                      onChange={(e) =>
                        updateVariantPrice(
                          idx,
                          "thb",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="1800"
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={v.eur.amount || ""}
                      onChange={(e) =>
                        updateVariantPrice(
                          idx,
                          "eur",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="49.00"
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={v.stock || 0}
                      onChange={(e) =>
                        updateVariantStock(idx, parseInt(e.target.value, 10) || 0)
                      }
                      disabled={!v.id || v.stockLevels.length === 0}
                      placeholder={
                        v.id && v.stockLevels.length === 0
                          ? "no inventory item"
                          : "0"
                      }
                    />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <IconButton
                      variant="transparent"
                      onClick={() => removeVariant(idx)}
                      disabled={saving}
                      aria-label="Remove variant"
                    >
                      <Trash />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <Text
          size="small"
          className={
            message?.kind === "err"
              ? "text-ui-fg-error"
              : message?.kind === "ok"
                ? "text-ui-fg-interactive"
                : "text-ui-fg-subtle"
          }
        >
          {message?.text ?? ""}
        </Text>
        <Button
          variant="primary"
          onClick={save}
          isLoading={saving}
          disabled={saving || uploading}
        >
          Save
        </Button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductEditorWidget
