import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createReadStream, existsSync, statSync } from "fs"
import { extname, join, normalize } from "path"

// Serves files from the persistent upload_dir. Needed because Medusa's
// built-in `/static` express.static mount points at `${baseDir}/static`
// (i.e. `.medusa/server/static`), which gets wiped on every `npx medusa
// build`. Our file-local upload_dir lives outside that tree so uploads
// survive builds — this route bridges the URL space back to those files.
const UPLOAD_DIR = "/opt/apps/lifespansupply/backend/uploads"

// Allowlist. Any extension not listed here returns 404, so archives, docs,
// HTML, SVG (script-capable) or anything else dropped into upload_dir is
// never served. Add an extension here only after deciding it is safe to
// serve publicly. Non-public files belong in /root/private-assets/.
const MIME: Readonly<Record<string, string>> = Object.freeze({
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  // Kept for COA / HPLC certificates uploaded through the admin.
  ".pdf": "application/pdf",
})

const PDF_TYPE = "application/pdf"
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const CACHE_CONTROL = "public, max-age=2592000, immutable"
// Defense in depth for images opened directly in a tab. Not sent for PDFs,
// because a restrictive document CSP can stop the browser's PDF viewer.
const IMAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'"

function notFound(res: MedusaResponse): void {
  res.status(404).send("not found")
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const filename = (req.params as { filename?: string }).filename

  if (!filename || !SAFE_FILENAME.test(filename) || filename.includes("..")) {
    res.status(400).send("invalid filename")
    return
  }

  const type = MIME[extname(filename).toLowerCase()]
  if (!type) {
    notFound(res)
    return
  }

  const full = normalize(join(UPLOAD_DIR, filename))
  if (!full.startsWith(UPLOAD_DIR + "/") || !existsSync(full)) {
    notFound(res)
    return
  }

  const stat = statSync(full)
  if (!stat.isFile()) {
    notFound(res)
    return
  }

  res.setHeader("Content-Type", type)
  res.setHeader("Content-Length", stat.size.toString())
  res.setHeader("Cache-Control", CACHE_CONTROL)
  res.setHeader("X-Content-Type-Options", "nosniff")
  if (type !== PDF_TYPE) {
    res.setHeader("Content-Security-Policy", IMAGE_CSP)
  }

  const stream = createReadStream(full)
  stream.on("error", (err) => {
    console.error(`[static] read failed for ${filename}:`, err.message)
    if (!res.headersSent) {
      res.status(500).send("read error")
      return
    }
    res.destroy(err)
  })
  stream.pipe(res)
}
