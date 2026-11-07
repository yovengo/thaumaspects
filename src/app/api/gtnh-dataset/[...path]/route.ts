import { GTNH_DATASET_BASE_URL } from '@/features/essentia/dataset/gtnhDataset'

const allowed = new Set([
  'prepared/package-manifest.json',
  'prepared/aspect-catalog.json.gz',
  'raw/item-types-00001.jsonl.gz',
])

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 })
  if (!GTNH_DATASET_BASE_URL) return new Response(null, { status: 503 })
  const path = (await params).path.join('/')
  if (!allowed.has(path)) return new Response(null, { status: 404 })
  const response = await fetch(`${GTNH_DATASET_BASE_URL.replace(/\/+$/, '')}/${path}`)
  if (!response.ok) return new Response(null, { status: 502 })
  return new Response(response.body, {
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/octet-stream' },
  })
}
