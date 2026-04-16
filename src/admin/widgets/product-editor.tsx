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
  Select,
} from "@medusajs/ui"
import { Plus, Trash } from "@medusajs/icons"
import { useEffect, useRef, useState } from "react"

/**
 * LifeSpanSupply unified product editor — single editing surface for content,
 * images, specifications, variants and pricing.
 *
 * Image slots 0-3 map to the storefront gallery slides. Slot 0 also doubles
 * as the product thumbnail / featured image. All image URLs are stored in
 * metadata (ui_image_0 … ui_image_3) and the thumbnail field. Everything is
 * saved atomically via one Save button so metadata never gets out of sync.
 */

type Props = DetailWidgetProps<AdminProduct>

type Money = { amount: number; id?: string }
type StockLevel = {
  inventory_item_id: string
  location_id: string
  original: number
}
type VariantRow = {
  id?: string
  title: string
  sku: string
  usd: Money
  thb: Money
  eur: Money
  stock: number
  stockLevels: StockLevel[]
}

const fromMinor = (n: number | null | undefined): number =>
  n == null ? 0 : Number(n) / 100
const toMinor = (n: number): number => Math.round(n * 100)

// --- Long description parsing ---

type LongSections = { product: string; applications: string; preparation: string }

function classifyHeading(raw: string): "product" | "applications" | "preparation" | null {
  const h = raw.toLowerCase()
  if (h.includes("research") || h.includes("application") || h.includes("การประยุกต์") || h.includes("การวิจัย")) return "applications"
  if (h.includes("preparation") || h.includes("administration") || h.includes("การเตรียม")) return "preparation"
  if (h.includes("product description") || h.includes("description") || h.includes("คำอธิบาย")) return "product"
  return null
}

function parseLong(text: string | null | undefined): LongSections {
  if (!text) return { product: "", applications: "", preparation: "" }
  const buckets: Record<"product" | "applications" | "preparation", string[]> = { product: [], applications: [], preparation: [] }
  let current: "product" | "applications" | "preparation" = "product"
  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trim()
    const standaloneMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/)
    const inlineMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s+(.+)$/)
    const hashMatch = trimmed.match(/^#{1,3}\s+(.+?):?\s*$/)
    let matchedHeading: string | undefined
    let inlineContent: string | undefined
    if (standaloneMatch) matchedHeading = standaloneMatch[1]
    else if (inlineMatch) { matchedHeading = inlineMatch[1]; inlineContent = inlineMatch[2] }
    else if (hashMatch) matchedHeading = hashMatch[1]
    if (matchedHeading) {
      const target = classifyHeading(matchedHeading)
      if (target) { current = target; if (inlineContent) buckets[current].push(inlineContent); continue }
    }
    buckets[current].push(rawLine)
  }
  return { product: buckets.product.join("\n").trim(), applications: buckets.applications.join("\n").trim(), preparation: buckets.preparation.join("\n").trim() }
}

function composeLong(s: LongSections): string {
  const parts: string[] = []
  if (s.product.trim()) parts.push(s.product.trim())
  if (s.applications.trim()) parts.push(`**Research Applications**\n${s.applications.trim()}`)
  if (s.preparation.trim()) parts.push(`**Preparation**\n${s.preparation.trim()}`)
  return parts.join("\n\n")
}

// --- Variant helpers ---

type AdminVariantLike = {
  id: string
  title?: string | null
  sku?: string | null
  prices?: { id: string; amount: number; currency_code: string }[]
  inventory_items?: { inventory_item_id?: string; inventory?: { id?: string; location_levels?: { id?: string; location_id?: string; stocked_quantity?: number }[] } }[]
}

function readVariantRow(v: AdminVariantLike): VariantRow {
  const prices = v.prices ?? []
  const usd = prices.find((p) => p.currency_code === "usd")
  const thb = prices.find((p) => p.currency_code === "thb")
  const eur = prices.find((p) => p.currency_code === "eur")
  const stockLevels: StockLevel[] = []
  for (const ii of v.inventory_items ?? []) {
    const inv = ii.inventory; const itemId = ii.inventory_item_id ?? inv?.id
    if (!itemId) continue
    for (const lvl of inv?.location_levels ?? []) {
      if (!lvl.location_id) continue
      stockLevels.push({ inventory_item_id: itemId, location_id: lvl.location_id, original: Number(lvl.stocked_quantity ?? 0) })
    }
  }
  return { id: v.id, title: v.title ?? "", sku: v.sku ?? "", usd: { amount: fromMinor(usd?.amount), id: usd?.id }, thb: { amount: fromMinor(thb?.amount), id: thb?.id }, eur: { amount: fromMinor(eur?.amount), id: eur?.id }, stock: stockLevels.reduce((s, l) => s + l.original, 0), stockLevels }
}

function newVariantRow(): VariantRow {
  return { title: "", sku: "", usd: { amount: 0 }, thb: { amount: 0 }, eur: { amount: 0 }, stock: 0, stockLevels: [] }
}

// --- Image helpers ---

const PRODUCENTS = ["FourNines", "Supreme Biologics", "Hangzhou Pep", "Calyssee"] as const

const IMAGE_SLOTS = [
  { idx: 0, label: "Vial — Featured image", key: "ui_image_0" },
  { idx: 1, label: "Package (slide 2)", key: "ui_image_1" },
  { idx: 2, label: "Features (slide 3)", key: "ui_image_2" },
  { idx: 3, label: "Guarantee (slide 4)", key: "ui_image_3" },
] as const

const MAX_DIMENSION = 1200
const WEBP_QUALITY = 0.88

async function fileToWebpBlob(file: File): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(new Error("read failed")); reader.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error("image decode failed")); el.src = dataUrl
  })
  let w = img.naturalWidth, h = img.naturalHeight
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) { const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h); w = Math.round(w * scale); h = Math.round(h * scale) }
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas 2d context unavailable"); ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) => { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/webp", WEBP_QUALITY) })
}

// =============================================================================

const ProductEditorWidget = ({ data }: Props) => {
  const metadata = (data.metadata ?? {}) as Record<string, unknown>

  // --- Content state ---
  const [titleEn, setTitleEn] = useState(data.title ?? "")
  const [descEn, setDescEn] = useState(data.description ?? "")
  const [longEn, setLongEn] = useState<LongSections>(() => parseLong((metadata.long_description as string) ?? ""))

  // --- Image state (4 gallery slots, slot 0 = thumbnail) ---
  const [images, setImages] = useState<(string | null)[]>(() =>
    IMAGE_SLOTS.map((s) => (metadata[s.key] as string) || null)
  )
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const imageInputRefs = useRef<Array<HTMLInputElement | null>>([])

  // --- Specifications ---
  const [casNumber, setCasNumber] = useState((metadata.cas_number as string) ?? "")
  const [molecularFormula, setMolecularFormula] = useState((metadata.molecular_formula as string) ?? "")
  const [purityPercentage, setPurityPercentage] = useState((metadata.purity_percentage as string) ?? "")
  const [formOverride, setFormOverride] = useState((metadata.form as string) ?? "")
  const [storageOverride, setStorageOverride] = useState((metadata.storage as string) ?? "")
  const [producent, setProducent] = useState((metadata.producent as string) ?? "")

  // --- Variants ---
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [variantsLoading, setVariantsLoading] = useState(true)
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([])
  const [productOptionTitle, setProductOptionTitle] = useState<string>("default")

  useEffect(() => {
    let cancelled = false
    async function loadProduct() {
      try {
        const fields = ["*variants", "*variants.prices", "*variants.inventory_items.inventory", "*variants.inventory_items.inventory.location_levels", "*options", "*options.values"].join(",")
        const res = await fetch(`/admin/products/${data.id}?fields=${encodeURIComponent(fields)}`, { credentials: "include" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as { product?: { variants?: AdminVariantLike[]; options?: { id: string; title: string; values?: { id: string; value: string }[] }[] } }
        if (!cancelled) {
          setVariants((body.product?.variants ?? []).map(readVariantRow))
          const opts = body.product?.options ?? []
          if (opts.length > 0) setProductOptionTitle(opts[0].title)
        }
      } catch {
        if (!cancelled) setVariants(((data.variants ?? []) as AdminVariantLike[]).map(readVariantRow))
      } finally {
        if (!cancelled) setVariantsLoading(false)
      }
    }
    loadProduct()
    return () => { cancelled = true }
  }, [data.id, data.variants])

  // --- UI state ---
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  // --- Variant helpers ---
  function updateVariant(idx: number, patch: Partial<VariantRow>) { setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))) }
  function updateVariantPrice(idx: number, currency: "usd" | "thb" | "eur", amount: number) { setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, [currency]: { ...v[currency], amount } } : v)) }
  function updateVariantStock(idx: number, stock: number) { setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, stock } : v))) }
  function removeVariant(idx: number) { setVariants((prev) => { const v = prev[idx]; if (v.id) setDeletedVariantIds((d) => [...d, v.id!]); return prev.filter((_, i) => i !== idx) }) }
  function addVariant() { setVariants((prev) => [...prev, newVariantRow()]) }

  // --- Image upload (uploads immediately to get URL, but metadata persisted on Save) ---
  async function uploadImage(slotIdx: number, file: File) {
    setUploadingSlot(slotIdx)
    setMessage(null)
    try {
      const webpBlob = await fileToWebpBlob(file)
      const stem = (data.handle ?? data.id).replace(/[^a-z0-9-]/gi, "-")
      const fileName = `${stem}-slide${slotIdx}-${Date.now()}.webp`
      const form = new FormData(); form.append("files", webpBlob, fileName)
      const res = await fetch("/admin/uploads", { method: "POST", body: form, credentials: "include" })
      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`)
      const body = await res.json()
      const url = body?.files?.[0]?.url ?? body?.uploads?.[0]?.url
      if (!url) throw new Error("Upload succeeded but no URL returned")
      setImages((prev) => { const next = [...prev]; next[slotIdx] = url; return next })
      setMessage({ kind: "ok", text: "Image uploaded — click Save to persist" })
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message })
    } finally {
      setUploadingSlot(null)
    }
  }

  function clearImage(slotIdx: number) {
    setImages((prev) => { const next = [...prev]; next[slotIdx] = null; return next })
  }

  // --- Save ---
  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      // Step 1: delete removed variants
      for (const vid of deletedVariantIds) {
        const res = await fetch(`/admin/products/${data.id}/variants/${vid}`, { method: "DELETE", credentials: "include" })
        if (!res.ok && res.status !== 404) { const body = await res.text(); throw new Error(`DELETE variant ${vid} failed: HTTP ${res.status}: ${body.slice(0, 150)}`) }
      }

      // Step 2: build metadata — merge image slots + content metadata
      const nextMetadata: Record<string, unknown> = { ...metadata }
      nextMetadata.long_description = composeLong(longEn)
      nextMetadata.cas_number = casNumber
      nextMetadata.molecular_formula = molecularFormula
      nextMetadata.purity_percentage = purityPercentage
      nextMetadata.form = formOverride
      nextMetadata.storage = storageOverride
      nextMetadata.producent = producent
      for (const slot of IMAGE_SLOTS) {
        const url = images[slot.idx]
        if (url) { nextMetadata[slot.key] = url } else { delete nextMetadata[slot.key] }
      }

      // Step 3: update core product + upsert variants
      const payload: Record<string, unknown> = {
        title: titleEn,
        description: descEn,
        thumbnail: images[0] || null,
        metadata: nextMetadata,
        variants: variants.map((v) => {
          const prices = [
            { currency_code: "usd", amount: toMinor(v.usd.amount) },
            { currency_code: "thb", amount: toMinor(v.thb.amount) },
            { currency_code: "eur", amount: toMinor(v.eur.amount) },
          ]
          if (v.id) return { id: v.id, title: v.title, sku: v.sku, prices }
          return { title: v.title, sku: v.sku, prices, options: { [productOptionTitle]: v.title || "Default" } }
        }),
      }

      const res = await fetch(`/admin/products/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) })
      if (!res.ok) { const body = await res.text(); throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`) }

      // Step 4: update inventory stock levels
      for (const v of variants) {
        const totalOriginal = v.stockLevels.reduce((s, l) => s + l.original, 0)
        if (v.stock === totalOriginal) continue
        const target = v.stockLevels[0]; if (!target) continue
        const levelsPayload = v.stockLevels.map((lvl, i) => ({ inventory_item_id: lvl.inventory_item_id, location_id: lvl.location_id, stocked_quantity: i === 0 ? v.stock : 0 }))
        for (const lp of levelsPayload) {
          const invRes = await fetch(`/admin/inventory-items/${lp.inventory_item_id}/location-levels/${lp.location_id}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ stocked_quantity: lp.stocked_quantity }) })
          if (!invRes.ok && invRes.status !== 404) { const body = await invRes.text(); throw new Error(`Stock update failed: HTTP ${invRes.status}: ${body.slice(0, 150)}`) }
        }
      }

      setDeletedVariantIds([])
      setMessage({ kind: "ok", text: "Saved ✓" })
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  // --- Save bar (reusable) ---
  const saveBar = (
    <div className="flex items-center justify-between gap-3 px-6 py-4">
      <Text size="small" className={message?.kind === "err" ? "text-ui-fg-error" : message?.kind === "ok" ? "text-ui-fg-interactive" : "text-ui-fg-subtle"}>
        {message?.text ?? ""}
      </Text>
      <Button variant="primary" onClick={save} isLoading={saving} disabled={saving || uploadingSlot !== null}>
        Save
      </Button>
    </div>
  )

  return (
    <Container id="lss-product-editor" className="divide-y p-0">
      {/* Header + top save */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Product editor</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            English content + tri-currency pricing. Translations via DeepL.
          </Text>
        </div>
        <Button variant="primary" onClick={save} isLoading={saving} disabled={saving || uploadingSlot !== null}>
          Save
        </Button>
      </div>

      {/* Product images — 4 gallery slots, slot 1 = featured/thumbnail */}
      <div className="px-6 py-5">
        <Heading level="h3">Product images</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          4 gallery slides. First image is also the featured/thumbnail image.
          Auto-converted to WebP, max 1200px.
        </Text>
      </div>
      <div className="grid grid-cols-2 gap-4 px-6 pb-5 md:grid-cols-4">
        {IMAGE_SLOTS.map((slot) => {
          const url = images[slot.idx]
          const isUploading = uploadingSlot === slot.idx
          return (
            <div key={slot.key} className="flex flex-col gap-2">
              <div className="aspect-square w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                {url ? (
                  <img src={url} alt={slot.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-ui-fg-muted">
                    empty
                  </div>
                )}
              </div>
              <Text size="xsmall" weight="plus">{slot.label}</Text>
              <input
                ref={(el) => { imageInputRefs.current[slot.idx] = el }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(slot.idx, f); e.target.value = "" }}
              />
              <div className="flex gap-1.5">
                <Button size="small" variant="secondary" disabled={isUploading || saving} onClick={() => imageInputRefs.current[slot.idx]?.click()} className="flex-1">
                  {isUploading ? "..." : url ? "Replace" : "Upload"}
                </Button>
                {url && (
                  <Button size="small" variant="danger" disabled={isUploading || saving} onClick={() => clearImage(slot.idx)}>
                    ×
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Title */}
      <div className="grid grid-cols-1 gap-4 px-6 py-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Title (English)</Label>
          <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="BPC-157" />
        </div>
      </div>

      {/* Short description */}
      <div className="grid grid-cols-1 gap-4 px-6 py-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Short description (English)</Label>
          <Textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={4} placeholder="One-sentence summary" />
        </div>
      </div>

      {/* Long description */}
      <div className="px-6 py-5">
        <Heading level="h3">Long description</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Three sections shown on the product page. Bullets with <code>-</code> or <code>•</code> render as a list.
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Product description (English)</Label>
          <Textarea value={longEn.product} onChange={(e) => setLongEn((s) => ({ ...s, product: e.target.value }))} rows={6} placeholder="Intro paragraph…" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Research Applications (English)</Label>
          <Textarea value={longEn.applications} onChange={(e) => setLongEn((s) => ({ ...s, applications: e.target.value }))} rows={6} placeholder="- Wound healing pathway studies&#10;- …" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-5">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Preparation (English)</Label>
          <Textarea value={longEn.preparation} onChange={(e) => setLongEn((s) => ({ ...s, preparation: e.target.value }))} rows={4} placeholder="Reconstitute with bacteriostatic water…" />
        </div>
      </div>

      {/* Specifications */}
      <div className="px-6 py-5">
        <Heading level="h3">Specifications</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Same 7 rows shown on the storefront. <strong>SKU</strong> and <strong>Size</strong> come from the first variant below.
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-4 px-6 pb-5 md:grid-cols-2 md:gap-x-6">
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">SKU</Label>
          <Input value={variants[0]?.sku ?? ""} onChange={(e) => updateVariant(0, { sku: e.target.value })} placeholder="BPC-5MG" disabled={variants.length === 0} />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Size</Label>
          <Input value={variants[0]?.title ?? ""} onChange={(e) => updateVariant(0, { title: e.target.value })} placeholder="5mg" disabled={variants.length === 0} />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Purity %</Label>
          <Input value={purityPercentage} onChange={(e) => setPurityPercentage(e.target.value)} placeholder="99" />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Molecular Formula</Label>
          <Input value={molecularFormula} onChange={(e) => setMolecularFormula(e.target.value)} placeholder="C62H98N16O22" />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">CAS Number</Label>
          <Input value={casNumber} onChange={(e) => setCasNumber(e.target.value)} placeholder="137525-51-0" />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Producent</Label>
          <Select value={producent} onValueChange={setProducent}>
            <Select.Trigger><Select.Value placeholder="Select producent…" /></Select.Trigger>
            <Select.Content>
              {PRODUCENTS.map((p) => (<Select.Item key={p} value={p}>{p}</Select.Item>))}
            </Select.Content>
          </Select>
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Form (blank = default "Lyophilized Powder")</Label>
          <Input value={formOverride} onChange={(e) => setFormOverride(e.target.value)} placeholder="Lyophilized Powder" />
        </div>
        <div>
          <Label size="xsmall" className="text-ui-fg-subtle">Storage (blank = default "2-8°C (refrigerated)")</Label>
          <Input value={storageOverride} onChange={(e) => setStorageOverride(e.target.value)} placeholder="2-8°C (refrigerated)" />
        </div>
      </div>

      {/* Variants & pricing */}
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h3">Variants &amp; pricing</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Each variant is a size (e.g. 5mg, 10mg). Prices in major units — 54 means $54.00 or ฿54.
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
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">Size / Title</th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">SKU</th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">USD</th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">THB</th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">EUR</th>
                <th className="border-b border-ui-border-base px-2 py-2 font-medium">Stock</th>
                <th className="w-10 border-b border-ui-border-base px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {variantsLoading && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-ui-fg-muted">Loading variants…</td></tr>
              )}
              {!variantsLoading && variants.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-ui-fg-muted">No variants — click <strong>Add variant</strong> to create one.</td></tr>
              )}
              {variants.map((v, idx) => (
                <tr key={v.id ?? `new-${idx}`}>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input value={v.title} onChange={(e) => updateVariant(idx, { title: e.target.value })} placeholder="5mg" />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input value={v.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value })} placeholder="BPC-5MG" />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input type="number" inputMode="decimal" step="0.01" min="0" value={v.usd.amount || ""} onChange={(e) => updateVariantPrice(idx, "usd", parseFloat(e.target.value) || 0)} placeholder="54.00" />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input type="number" inputMode="decimal" step="1" min="0" value={v.thb.amount || ""} onChange={(e) => updateVariantPrice(idx, "thb", parseFloat(e.target.value) || 0)} placeholder="1800" />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input type="number" inputMode="decimal" step="0.01" min="0" value={v.eur.amount || ""} onChange={(e) => updateVariantPrice(idx, "eur", parseFloat(e.target.value) || 0)} placeholder="49.00" />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <Input type="number" inputMode="numeric" step="1" min="0" value={v.stock || 0} onChange={(e) => updateVariantStock(idx, parseInt(e.target.value, 10) || 0)} disabled={!v.id} placeholder={!v.id ? "save first" : "0"} />
                  </td>
                  <td className="border-b border-ui-border-base px-2 py-2 align-top">
                    <IconButton variant="transparent" onClick={() => removeVariant(idx)} disabled={saving} aria-label="Remove variant"><Trash /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom save bar */}
      {saveBar}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductEditorWidget
