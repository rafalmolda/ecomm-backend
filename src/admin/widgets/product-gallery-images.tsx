import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { Container, Heading, Button, Text, toast } from '@medusajs/ui'
import { useState, useRef } from 'react'
import type { AdminProduct } from '@medusajs/framework/types'

const SLOTS = [
  { idx: 0, label: 'Vial (slide 1)', key: 'ui_image_0' },
  { idx: 1, label: 'Package (slide 2)', key: 'ui_image_1' },
  { idx: 2, label: 'Features (slide 3)', key: 'ui_image_2' },
  { idx: 3, label: 'Guarantee (slide 4)', key: 'ui_image_3' },
] as const

const MAX_DIMENSION = 1200
const WEBP_QUALITY = 0.88

type Props = { data: AdminProduct }

// Resize + re-encode a File to WebP in the browser via canvas.
async function fileToWebpBlob(file: File): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('image decode failed'))
    el.src = dataUrl
  })

  // Fit into MAX_DIMENSION x MAX_DIMENSION preserving aspect ratio.
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(img, 0, 0, w, h)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/webp',
      WEBP_QUALITY,
    )
  })
  return blob
}

const ProductGalleryImagesWidget = ({ data }: Props) => {
  const [saving, setSaving] = useState<number | null>(null)
  const fileInputs = useRef<Array<HTMLInputElement | null>>([])
  const product = data
  const metadata = (product.metadata ?? {}) as Record<string, string>

  async function handleFilePick(slotIdx: number, file: File) {
    setSaving(slotIdx)
    try {
      const webpBlob = await fileToWebpBlob(file)
      const stem = (product.handle ?? product.id).replace(/[^a-z0-9-]/gi, '-')
      const fileName = `${stem}-slide${slotIdx}-${Date.now()}.webp`

      const form = new FormData()
      form.append('files', webpBlob, fileName)

      const uploadRes = await fetch('/admin/uploads', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => '')
        throw new Error(`upload failed: ${uploadRes.status} ${txt}`)
      }
      const uploadJson = (await uploadRes.json()) as { files?: Array<{ url: string }>; uploads?: Array<{ url: string }> }
      const uploadedUrl = uploadJson.files?.[0]?.url ?? uploadJson.uploads?.[0]?.url
      if (!uploadedUrl) throw new Error('upload response missing URL')

      const slotKey = SLOTS[slotIdx].key
      const nextMeta = { ...metadata, [slotKey]: uploadedUrl }
      const patchRes = await fetch(`/admin/products/${product.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: nextMeta }),
      })
      if (!patchRes.ok) {
        const txt = await patchRes.text().catch(() => '')
        throw new Error(`product update failed: ${patchRes.status} ${txt}`)
      }

      toast.success(`Uploaded ${SLOTS[slotIdx].label}`)
      // Force a Medusa admin refresh so the product data reflects the new metadata.
      window.location.reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'upload failed'
      toast.error(msg)
      console.error('[product-gallery-images]', err)
    } finally {
      setSaving(null)
    }
  }

  async function handleRemove(slotIdx: number) {
    setSaving(slotIdx)
    try {
      const slotKey = SLOTS[slotIdx].key
      const nextMeta = { ...metadata }
      delete nextMeta[slotKey]
      const patchRes = await fetch(`/admin/products/${product.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: nextMeta }),
      })
      if (!patchRes.ok) throw new Error(`product update failed: ${patchRes.status}`)
      toast.success(`Cleared ${SLOTS[slotIdx].label}`)
      window.location.reload()
    } catch (err) {
      toast.error('remove failed')
      console.error('[product-gallery-images]', err)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Gallery images</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Upload a custom image for each of the 4 product gallery slides. Images are automatically converted to WebP and resized to 1200px max. When a slot is empty, the default SVG illustration is rendered on the storefront.
        </Text>
      </div>
      <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
        {SLOTS.map((slot) => {
          const currentUrl = metadata[slot.key]
          const isSaving = saving === slot.idx
          return (
            <div key={slot.key} className="flex flex-col gap-2">
              <div className="aspect-square w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                {currentUrl ? (
                  <img src={currentUrl} alt={slot.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-ui-fg-muted">
                    SVG default
                  </div>
                )}
              </div>
              <Text size="xsmall" weight="plus">{slot.label}</Text>
              <input
                ref={(el) => { fileInputs.current[slot.idx] = el }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFilePick(slot.idx, f)
                  e.target.value = ''
                }}
              />
              <div className="flex gap-1.5">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={isSaving}
                  onClick={() => fileInputs.current[slot.idx]?.click()}
                  className="flex-1"
                >
                  {isSaving ? '...' : currentUrl ? 'Replace' : 'Upload'}
                </Button>
                {currentUrl && (
                  <Button
                    size="small"
                    variant="danger"
                    disabled={isSaving}
                    onClick={() => void handleRemove(slot.idx)}
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.after',
})

export default ProductGalleryImagesWidget
