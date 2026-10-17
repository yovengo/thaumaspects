import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { recognizeResearchScreenshot, type RecognitionResult } from './screenshotRecognizer'

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

export function ScreenshotImporter({ aspects, onRecognized }: {
  aspects: string[]
  onRecognized: (result: RecognitionResult) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [processing, setProcessing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RecognitionResult | null>(null)

  const processImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('The clipboard item is not an image.')
      return
    }

    setProcessing(true)
    setError('')
    setResult(null)
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })

    try {
      const recognized = await recognizeResearchScreenshot(file, aspects)
      setResult(recognized)
      onRecognized(recognized)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The screenshot could not be recognized.')
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const imageItem = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (!file) return
      event.preventDefault()
      void processImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return <div
    className={`screenshot-importer ${dragging ? 'is-dragging' : ''}`}
    onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }}
    onDrop={(event) => {
      event.preventDefault()
      setDragging(false)
      const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'))
      if (file) void processImage(file)
    }}
  >
    <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => {
      const file = event.target.files?.[0]
      if (file) void processImage(file)
      event.target.value = ''
    }} />
    {previewUrl ? <Image className="screenshot-preview" src={previewUrl} width={160} height={120} unoptimized alt="Pasted research screenshot" /> : <span className="paste-glyph" aria-hidden="true">⌘V</span>}
    <div className="screenshot-copy">
      <strong>{processing ? 'Reading the research note…' : result ? 'Screenshot imported' : 'Paste a research screenshot'}</strong>
      {!processing && !result && <span>Press Ctrl/Cmd+V anywhere on this page, drop an image here, or choose a file.</span>}
      {processing && <span>Finding the parchment, hex grid, blocked cells, and aspect glyphs.</span>}
      {result && <span>Grid diameter {result.boardSize} · {Object.keys(result.board).length} aspects · {result.obstacles.size} obstacles · confidence {percentage(result.confidence)}</span>}
      {result?.diagnostics.map((message) => <small key={message}>{message}</small>)}
      {error && <small className="screenshot-error">{error}</small>}
    </div>
    <button type="button" disabled={processing} onClick={() => inputRef.current?.click()}>{result ? 'Scan another' : 'Choose image'}</button>
  </div>
}
