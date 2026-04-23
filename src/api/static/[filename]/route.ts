import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createReadStream, existsSync, statSync } from "fs"
import { extname, join, normalize } from "path"

// Serves files from the persistent upload_dir. Needed because Medusa's
// built-in `/static` express.static mount points at `${baseDir}/static`
// (i.e. `.medusa/server/static`), which gets wiped on every `npx medusa
// build`. Our file-local upload_dir lives outside that tree so uploads
// survive builds — this route bridges the URL space back to those files.
const UPLOAD_DIR = "/opt/apps/lifespansupply/backend/uploads"

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const filename = (req.params as { filename: string }).filename

  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    res.status(400).send("invalid filename")
    return
  }

  const full = normalize(join(UPLOAD_DIR, filename))
  if (!full.startsWith(UPLOAD_DIR) || !existsSync(full)) {
    res.status(404).send("not found")
    return
  }

  const stat = statSync(full)
  const ext = extname(filename).toLowerCase()
  const type = MIME[ext] || "application/octet-stream"
  res.setHeader("Content-Type", type)
  res.setHeader("Content-Length", stat.size.toString())
  res.setHeader("Cache-Control", "public, max-age=2592000, immutable")
  createReadStream(full).pipe(res)
}
