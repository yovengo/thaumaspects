import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const runtime = 'nodejs'

const columns = 256
const rows = 170
const tileSize = 32
const atlasPath = path.join(process.cwd(), 'public', 'gt-icons', 'atlas-2.7.4.webp')
const atlasPixels = readFile(atlasPath).then((source) => sharp(source).raw().toBuffer({ resolveWithObject: true }))

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const index = Number(id)
  if (!Number.isInteger(index) || index < 0 || index >= columns * rows || String(index) !== id) {
    return new Response(null, { status: 404 })
  }

  const { data, info } = await atlasPixels
  const icon = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .extract({ left: (index % columns) * tileSize, top: Math.floor(index / columns) * tileSize, width: tileSize, height: tileSize })
    .png()
    .toBuffer()

  return new Response(new Uint8Array(icon), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
