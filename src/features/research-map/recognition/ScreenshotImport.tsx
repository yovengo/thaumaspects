'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { ResearchBoardInput } from '@/features/research-map/board/boardInput'
import { AspectIcon, CloseIcon, MinusIcon, PlusIcon } from '@/features/research-map/icons'
import { aspectLabel } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'
import { AspectSelect } from '@/features/research-map/quick-search/AspectSelect'
import {
  type AspectTemplate,
  loadAspectTemplates,
} from '@/features/research-map/recognition/templates'
import { recognizedMapToBoardInput } from '@/features/research-map/recognition/toBoardInput'
import type {
  ImageRaster,
  RecognitionResult,
  RecognizedCell,
} from '@/features/research-map/recognition/types'

type ImportResult = { ok: true } | { ok: false; error: string }

function isSupportedScreenshot(file: File) {
  return (
    ['image/png', 'image/jpeg'].includes(file.type) ||
    (file.type === '' && /\.(png|jpe?g)$/i.test(file.name))
  )
}

async function readScreenshot(file: File): Promise<ImageData> {
  if (!isSupportedScreenshot(file)) {
    throw new Error('Choose a PNG or JPEG screenshot.')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('The screenshot must be smaller than 20 MB.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('The image could not be opened. Choose another PNG or JPEG screenshot.')
  }
  try {
    if (bitmap.width < 200 || bitmap.height < 200) {
      throw new Error('The screenshot is too small. Use an image at least 200 pixels per side.')
    }
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('The screenshot is too large. Crop it around the research page.')
    }
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Image processing is unavailable in this browser.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return context.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
}

function analyzeInWorker(
  worker: Worker,
  image: ImageRaster,
  templates: AspectTemplate[],
  radius?: number,
  onProgress?: (stage: string) => void,
) {
  let rejectPending: (error: Error) => void = () => {}
  let timer: ReturnType<typeof setTimeout>
  const cleanup = () => {
    clearTimeout(timer)
    worker.onmessage = null
    worker.onerror = null
  }
  const promise = new Promise<RecognitionResult>((resolve, reject) => {
    rejectPending = reject
    timer = setTimeout(() => {
      cleanup()
      reject(new Error('Recognition timed out. Try a smaller screenshot.'))
    }, 60000)
    worker.onmessage = (
      event: MessageEvent<{ result?: RecognitionResult; error?: string; stage?: string }>,
    ) => {
      if (event.data.stage) {
        onProgress?.(event.data.stage)
        return
      }
      cleanup()
      if (event.data.result) resolve(event.data.result)
      else reject(new Error(event.data.error ?? 'Recognition failed.'))
    }
    worker.onerror = () => {
      cleanup()
      reject(new Error('The image processor could not start.'))
    }
    worker.postMessage({ image, templates, radius })
  })
  return {
    promise,
    cancel: () => {
      cleanup()
      rejectPending(new Error('Recognition cancelled.'))
    },
  }
}

function DebugRasterView({ raster, label }: { raster: ImageRaster; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = raster.width
    canvas.height = raster.height
    canvas
      .getContext('2d')
      ?.putImageData(
        new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height),
        0,
        0,
      )
  }, [raster])
  return (
    <figure>
      <canvas ref={canvasRef} aria-label={label} role="img" />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

export function ScreenshotImport({
  catalog,
  onClose,
  onImport,
}: {
  catalog: Catalog
  onClose: () => void
  onImport: (input: ResearchBoardInput) => ImportResult
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageUrlRef = useRef<string | null>(null)
  const runRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<ReturnType<typeof analyzeInWorker> | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [image, setImage] = useState<ImageData | null>(null)
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [cells, setCells] = useState<RecognizedCell[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('Analyzing screenshot')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
    return () => {
      runRef.current += 1
      pendingRef.current?.cancel()
      workerRef.current?.terminate()
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    }
  }, [])

  const runRecognition = async (screenshot: ImageData, radius?: number) => {
    const run = ++runRef.current
    setBusy(true)
    setStage('Loading aspect icons')
    setError(null)
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    try {
      const templates = await loadAspectTemplates(catalog.aspects)
      if (run !== runRef.current) return
      setStage('Starting image processor')
      const worker =
        workerRef.current ??
        new Worker(new URL('./recognition.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      const task = analyzeInWorker(worker, screenshot, templates, radius, setStage)
      pendingRef.current = task
      const recognized = await task.promise
      if (run !== runRef.current) return
      setResult(recognized)
      setCells(recognized.cells)
      const firstUncertain = recognized.cells.find((cell) => cell.type === 'unknown')
      const firstAspect = recognized.cells.find((cell) => cell.type === 'aspect')
      const first = firstUncertain ?? firstAspect ?? recognized.cells[0]
      setSelectedId(first ? `${first.row}-${first.column}` : null)
    } catch (cause) {
      if (run === runRef.current) {
        workerRef.current?.terminate()
        workerRef.current = null
        setError((cause as Error).message)
      }
    } finally {
      if (run === runRef.current) {
        pendingRef.current = null
        setBusy(false)
      }
    }
  }

  const chooseFile = async (file?: File) => {
    if (!file) return
    if (!isSupportedScreenshot(file) || file.size > 20 * 1024 * 1024) {
      setError('Choose a PNG or JPEG screenshot smaller than 20 MB.')
      return
    }
    runRef.current += 1
    if (pendingRef.current) {
      pendingRef.current.cancel()
      pendingRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
    }
    setBusy(true)
    setResult(null)
    setCells([])
    setError(null)
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current)
    imageUrlRef.current = URL.createObjectURL(file)
    setImageUrl(imageUrlRef.current)
    try {
      const screenshot = await readScreenshot(file)
      setImage(screenshot)
      await runRecognition(screenshot)
    } catch (cause) {
      setBusy(false)
      setError((cause as Error).message)
    }
  }

  const selected = cells.find((cell) => `${cell.row}-${cell.column}` === selectedId)
  const uncertainCount = cells.filter((cell) => cell.type === 'unknown').length
  const aspectCount = cells.filter((cell) => cell.type === 'aspect').length
  const obstacleCount = cells.filter((cell) => cell.type === 'obstacle').length

  const updateCell = (change: Partial<RecognizedCell>) => {
    if (!selected) return
    setCells((previous) =>
      previous.map((cell) =>
        cell.row === selected.row && cell.column === selected.column
          ? { ...cell, ...change }
          : cell,
      ),
    )
  }

  const confirmImport = () => {
    if (!result || busy || error) return
    try {
      const imported = recognizedMapToBoardInput(result.geometry.radius, cells)
      const applied = onImport(imported)
      if (!applied.ok) throw new Error(applied.error)
      dialogRef.current?.close()
    } catch (cause) {
      setError((cause as Error).message)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="screenshot-dialog"
      aria-labelledby="screenshot-dialog-title"
      onClose={onClose}
    >
      <div className="screenshot-dialog-content">
        <header className="screenshot-header">
          <div>
            <h2 id="screenshot-dialog-title">Import research screenshot</h2>
            {result && (
              <p>
                {aspectCount} aspects · {obstacleCount} obstacles
                {uncertainCount > 0 && ` · ${uncertainCount} to review`}
              </p>
            )}
          </div>
          <button
            className="quiet-button screenshot-close"
            type="button"
            aria-label="Close screenshot import"
            onClick={() => dialogRef.current?.close()}
          >
            <CloseIcon />
          </button>
        </header>

        <input
          ref={fileRef}
          className="screenshot-file-input"
          type="file"
          accept="image/png,image/jpeg"
          aria-label="Choose research screenshot"
          onChange={(event) => {
            void chooseFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        {!imageUrl && (
          <button
            className="screenshot-dropzone"
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void chooseFile(event.dataTransfer.files[0])
            }}
          >
            <strong>Choose a screenshot</strong>
            <span>PNG or JPEG · drag and drop also works</span>
          </button>
        )}

        {imageUrl && (
          <div className="screenshot-workspace">
            <div className="screenshot-preview-column">
              <div className="screenshot-image-frame">
                <Image
                  src={imageUrl}
                  alt="Uploaded research screenshot"
                  width={image?.width ?? 1}
                  height={image?.height ?? 1}
                  unoptimized
                />
                {result && (
                  <div className="screenshot-cell-overlay">
                    {cells.map((cell) => {
                      const id = `${cell.row}-${cell.column}`
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`screenshot-cell is-${cell.type}${selectedId === id ? ' is-selected' : ''}`}
                          style={{
                            left: `${(cell.center.x / result.width) * 100}%`,
                            top: `${(cell.center.y / result.height) * 100}%`,
                            width: `${(result.geometry.stepX / result.width) * 78}%`,
                          }}
                          aria-label={`Row ${cell.row}, column ${cell.column}: ${cell.type}${cell.aspect ? ` ${aspectLabel(cell.aspect)}` : ''}`}
                          aria-pressed={selectedId === id}
                          onClick={() => setSelectedId(id)}
                        >
                          {cell.type === 'aspect' && cell.aspect ? (
                            <AspectIcon aspect={cell.aspect} />
                          ) : cell.type === 'unknown' ? (
                            '?'
                          ) : cell.type === 'obstacle' ? (
                            '×'
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {busy && (
                <p className="screenshot-status" role="status">
                  {stage}…
                </p>
              )}
              <div className="screenshot-image-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                >
                  Change image
                </button>
                {result && (
                  <span>Grid confidence {Math.round(result.geometry.confidence * 100)}%</span>
                )}
              </div>
            </div>

            {result && (
              <aside className="screenshot-inspector">
                <div className="screenshot-radius-row">
                  <span>Radius</span>
                  <div className="screenshot-radius-buttons">
                    <button
                      type="button"
                      aria-label="Decrease detected radius"
                      disabled={busy || result.geometry.radius <= 2}
                      onClick={() =>
                        image && void runRecognition(image, result.geometry.radius - 1)
                      }
                    >
                      <MinusIcon />
                    </button>
                    <strong>{result.geometry.radius}</strong>
                    <button
                      type="button"
                      aria-label="Increase detected radius"
                      disabled={busy || result.geometry.radius >= 7}
                      onClick={() =>
                        image && void runRecognition(image, result.geometry.radius + 1)
                      }
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
                {(result.geometry.radiusConfidence < 0.65 || result.geometry.confidence < 0.65) && (
                  <p className="screenshot-caution">Check grid alignment and radius.</p>
                )}

                {selected && (
                  <div className="screenshot-cell-inspector">
                    <div className="screenshot-cell-heading">
                      <strong>
                        Cell {selected.row}, {selected.column}
                      </strong>
                      <span>
                        {selected.type === 'unknown'
                          ? 'Needs review'
                          : `${Math.round(selected.confidence * 100)}% confidence`}
                      </span>
                    </div>
                    <fieldset className="screenshot-type-options">
                      <legend className="sr-only">Cell state</legend>
                      {(['empty', 'obstacle', 'aspect'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={selected.type === type ? 'is-active' : ''}
                          aria-pressed={selected.type === type}
                          onClick={() =>
                            updateCell({
                              type,
                              aspect:
                                type === 'aspect'
                                  ? (selected.aspect ??
                                    selected.candidates[0]?.aspect ??
                                    catalog.aspects[0])
                                  : undefined,
                              confidence: 1,
                            })
                          }
                        >
                          {type[0].toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </fieldset>
                    {selected.type === 'aspect' && selected.aspect && (
                      <AspectSelect
                        caption="Aspect"
                        value={selected.aspect}
                        aspects={catalog.aspects}
                        onChange={(aspect) => updateCell({ aspect, confidence: 1 })}
                      />
                    )}
                    {selected.candidates.length > 0 && (
                      <div className="screenshot-candidates">
                        <span>Possible matches</span>
                        {selected.candidates.map((candidate) => (
                          <button
                            type="button"
                            key={candidate.aspect}
                            onClick={() =>
                              updateCell({
                                type: 'aspect',
                                aspect: candidate.aspect,
                                confidence: 1,
                              })
                            }
                          >
                            <AspectIcon aspect={candidate.aspect} />
                            <span>{aspectLabel(candidate.aspect)}</span>
                            <small>{Math.round(candidate.score * 100)}%</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {uncertainCount > 0 && (
                  <button
                    className="screenshot-dismiss-uncertain"
                    type="button"
                    onClick={() =>
                      setCells((previous) =>
                        previous.map((cell) =>
                          cell.type === 'unknown'
                            ? { ...cell, type: 'empty' as const, aspect: undefined, confidence: 1 }
                            : cell,
                        ),
                      )
                    }
                  >
                    Mark all uncertain cells empty
                  </button>
                )}
              </aside>
            )}
          </div>
        )}

        {result && (
          <details className="screenshot-debug">
            <summary>Recognition details</summary>
            <div className="screenshot-debug-grid">
              <DebugRasterView raster={result.debug.grayscale} label="Grayscale" />
              <DebugRasterView raster={result.debug.edges} label="Edges" />
              <figure>
                <div className="screenshot-contour-image">
                  <Image
                    src={imageUrl ?? ''}
                    alt=""
                    width={result.width}
                    height={result.height}
                    unoptimized
                  />
                  <svg
                    viewBox={`0 0 ${result.width} ${result.height}`}
                    aria-label="Detected hexagon contours"
                    role="img"
                  >
                    {result.debug.contours.map((contour) => (
                      <circle
                        key={`${contour.x}-${contour.y}-${contour.width}-${contour.height}`}
                        cx={contour.x}
                        cy={contour.y}
                        r="3"
                      />
                    ))}
                  </svg>
                </div>
                <figcaption>Detected contours</figcaption>
              </figure>
            </div>
          </details>
        )}

        {error && (
          <p className="screenshot-error" role="alert">
            {error}
          </p>
        )}
        <footer className="screenshot-footer">
          <button className="quiet-button" type="button" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!result || busy || Boolean(error) || uncertainCount > 0}
            onClick={confirmImport}
          >
            Import map
          </button>
        </footer>
      </div>
    </dialog>
  )
}
