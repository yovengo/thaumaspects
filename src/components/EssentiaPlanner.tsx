import Image from 'next/image'
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import { key as itemKey, planFromLines, prepareItems } from '../lib/essentiaPlanner'
import type { ItemAspect, Plan, PlanLine, Requirement } from '../lib/essentiaPlanner'
import renderedIconBounds from '../data/renderedIconBounds.json'

type UnprofiledItem = { name: string; registryId: string }
type Catalog = { aspects: string[]; items: ItemAspect[]; unprofiledItems?: UnprofiledItem[]; aspectSource?: { version: string; count: number; fallbackCounts?: Record<string, number> }; iconSource?: { counts: Record<string, number> }; acquisitionSource?: { version: string; recipeCount: number } }
type Row = { id: number; aspect: string; amount: string }
type CatalogFilter = 'allSelected' | 'anySelected' | 'allItems'
type CatalogSort = 'practical' | 'quantity' | 'name'
type Availability = { preferred: string[]; excluded: string[]; stage: string }
type PlanJob = { type: 'calculate'; request: string; required: Requirement; preferences: Availability }
const availabilityStorageKey = 'thaumaspects:availability:v2'
const availabilityChangedEvent = 'thaumaspects:availability-changed'
const defaultAvailability: Availability = { preferred: [], excluded: [], stage: 'NONE' }
const stages = [
  ['NONE', 'No machines'], ['LV', 'LV'], ['MV', 'MV'], ['HV', 'HV'],
  ['IV', 'IV'], ['UV', 'UV'], ['MAX', 'All tiers'],
]

function parseAvailability(raw: string): Availability {
  try {
    const stored = JSON.parse(raw || '{}') as Partial<Availability>
    return {
      preferred: Array.isArray(stored.preferred) ? stored.preferred.filter((value): value is string => typeof value === 'string') : [],
      excluded: Array.isArray(stored.excluded) ? stored.excluded.filter((value): value is string => typeof value === 'string') : [],
      stage: stages.some(([value]) => value === stored.stage) ? stored.stage! : 'NONE',
    }
  } catch {
    return defaultAvailability
  }
}

function availabilitySnapshot() {
  try { return window.localStorage.getItem(availabilityStorageKey) ?? '' } catch { return '' }
}

function subscribeAvailability(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(availabilityChangedEvent, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(availabilityChangedEvent, onChange)
  }
}

const displayItemName = (name: string) => name.replace(/§[0-9a-fk-or]/gi, '')
const aspectWord = (count: number) => count === 1 ? 'aspect' : 'aspects'
const aspectLabel = (aspect: string) => aspect.replace(/^./, (letter) => letter.toUpperCase())
const itemWord = (count: number) => count === 1 ? 'item' : 'items'
const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

function Chevron() {
  return <svg className="field-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function StarIcon({ filled }: { filled: boolean }) {
  return <svg className="favorite-icon" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true"><path d="m12 2.8 2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 16.85l-5.5 2.89 1.05-6.13L3.1 9.27l6.15-.9L12 2.8Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" /></svg>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex(([option]) => option === value))

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const choose = (next: string) => { onChange(next); setOpen(false); triggerRef.current?.focus() }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    if (event.key === 'Tab' && open) setOpen(false)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setHighlight(selectedIndex); setOpen(true) }
      else setHighlight((index) => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
    }
    if (open && event.key === 'Home') { event.preventDefault(); setHighlight(0) }
    if (open && event.key === 'End') { event.preventDefault(); setHighlight(options.length - 1) }
    if (open && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(options[highlight][0]) }
  }

  return <div className="custom-select" ref={rootRef} onKeyDown={onKeyDown}>
    <button ref={triggerRef} className="custom-select-trigger" type="button" aria-label={`${label}, ${options[selectedIndex][1]}`} aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} onClick={() => { setHighlight(selectedIndex); setOpen((current) => !current) }}><span>{options[selectedIndex][1]}</span><Chevron /></button>
    {open && <div className="custom-select-menu" id={listId} role="listbox" aria-label={label}>{options.map(([option, text], index) => <button type="button" role="option" id={`${listId}-${index}`} aria-selected={value === option} className={index === highlight ? 'is-highlighted' : ''} key={option} onMouseEnter={() => setHighlight(index)} onClick={() => choose(option)}><span>{text}</span>{value === option && <span className="custom-select-check" aria-hidden="true">✓</span>}</button>)}</div>}
  </div>
}

function AspectIcon({ name }: { name: string }) {
  const [missing, setMissing] = useState(false)
  return missing ? <span className="ess-aspect-icon ess-aspect-fallback" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
    : <Image className="ess-aspect-icon" src={`/aspects/color/${name === 'strontio' ? 'stronito' : name}.png`} width={25} height={25} onError={() => setMissing(true)} alt="" />
}

function AspectTag({ name, amount }: { name: string; amount?: number }) {
  return <span className="ess-aspect-tag"><AspectIcon name={name} /><span>{aspectLabel(name)}</span>{amount !== undefined && <b>{amount}</b>}</span>
}

function ItemIcon({ item, large = false }: { item: ItemAspect; large?: boolean }) {
  const { name, icon } = item
  const cleanName = displayItemName(name)
  const bounds = icon?.kind === 'rendered'
    ? (renderedIconBounds.overrides as Record<string, number[]>)[icon.file] ?? renderedIconBounds.default
    : undefined
  const frameSize = large ? 40 : 32
  const [sourceWidth, sourceHeight, x, y, width, height] = bounds ?? [256, 256, 0, 0, 256, 256]
  const scale = (large ? 38 : 30) / Math.max(width, height)
  const renderedStyle = {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    left: frameSize / 2 - (x + width / 2) * scale,
    top: frameSize / 2 - (y + height / 2) * scale,
  }
  const title = icon?.quality === 'ambiguous' ? 'Several items share this name; one matching game icon is shown'
    : icon?.quality === 'related' ? 'Icon from a related item'
      : icon?.quality === 'generic' ? 'Exact icon unavailable; a game icon of this item type is shown'
        : undefined
  return <span className={`ess-item-icon ${large ? 'is-large' : ''} ${icon ? 'has-texture' : ''} ${icon && icon.quality !== 'exact' ? 'is-approximate' : ''}`} title={title} aria-hidden="true">
    {icon?.kind === 'atlas' ? <Image className="ess-atlas-sprite" src={`/api/atlas-icons/${icon.id}`} width={32} height={32} alt="" />
      : icon?.kind === 'rendered' ? <span className="ess-rendered-frame" style={{ width: frameSize, height: frameSize }}><Image src={`/gt-icons/rendered/${icon.file}`} width={sourceWidth} height={sourceHeight} style={renderedStyle} alt="" /></span>
        : <span>{cleanName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>}
  </span>
}

function AspectPicker({ value, aspects, excluded, onChange }: { value: string; aspects: string[]; excluded: Set<string>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const options = aspects.filter((aspect) => (aspect === value || !excluded.has(aspect)) && aspect.toLocaleLowerCase().includes(query.toLocaleLowerCase()))

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const closeOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const choose = (aspect: string) => { onChange(aspect); setOpen(false); setQuery(''); setHighlight(0) }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((index) => Math.min(Math.max(0, options.length - 1), index + 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((index) => Math.max(0, index - 1)) }
    if (event.key === 'Enter' && options[highlight]) { event.preventDefault(); choose(options[highlight]) }
  }

  return <div className="ess-picker" ref={rootRef}>
    <button className="ess-picker-trigger" type="button" aria-label={`Choose aspect, currently ${aspectLabel(value)}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><AspectIcon name={value} /><span>{aspectLabel(value)}</span><Chevron /></button>
    {open && <div className="ess-picker-popover"><label className="ess-picker-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setHighlight(0) }} onKeyDown={onKeyDown} placeholder="Search aspects…" aria-label="Search aspects" /></label>
      <div className="ess-picker-list" role="listbox" aria-label="Aspects">{options.map((aspect, index) => <button type="button" role="option" aria-selected={aspect === value} className={index === highlight ? 'is-highlighted' : ''} key={aspect} onMouseEnter={() => setHighlight(index)} onClick={() => choose(aspect)}><AspectIcon name={aspect} /><span>{aspectLabel(aspect)}</span>{aspect === value && <b>✓</b>}</button>)}{options.length === 0 && <p>No aspects found</p>}</div>
    </div>}
  </div>
}

function countForItem(item: ItemAspect, required: Requirement) {
  const aspects = Object.keys(required).filter((aspect) => required[aspect] > 0 && (item.aspects[aspect] ?? 0) > 0)
  if (aspects.length === 0) return null
  return Math.max(...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])))
}

export default function EssentiaPlanner() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [planResult, setPlanResult] = useState<{ request: string; plans: Plan[]; error?: boolean; partial?: boolean } | null>(null)
  const [catalogResult, setCatalogResult] = useState<{ request: string; indices: number[] } | null>(null)
  const [sourceResult, setSourceResult] = useState<{ request: string; indices: number[] } | null>(null)
  const [workerFailed, setWorkerFailed] = useState(false)
  const plannerWorker = useRef<Worker | null>(null)
  const activePlanJob = useRef<string | null>(null)
  const pendingPlanJob = useRef<PlanJob | null>(null)
  const [rows, setRows] = useState<Row[]>([{ id: 1, aspect: 'ignis', amount: '16' }, { id: 2, aspect: 'potentia', amount: '16' }])
  const [nextId, setNextId] = useState(3)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customLines, setCustomLines] = useState<PlanLine[]>([])
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('anySelected')
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('practical')
  const [query, setQuery] = useState('')
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [sourceVisibleCount, setSourceVisibleCount] = useState(12)
  const [visibleCount, setVisibleCount] = useState(30)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [sourcesQuery, setSourcesQuery] = useState('')
  const [sourcesVisibleCount, setSourcesVisibleCount] = useState(30)
  const [alternativesOpen, setAlternativesOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set())
  const storedAvailability = useSyncExternalStore(subscribeAvailability, availabilitySnapshot, () => '')
  const savedAvailability = useMemo(() => parseAvailability(storedAvailability), [storedAvailability])
  const [volatileAvailability, setVolatileAvailability] = useState<Availability | null>(null)
  const availability = volatileAvailability ?? savedAvailability
  const resultRef = useRef<HTMLDivElement>(null)
  const sourceSearchRef = useRef<HTMLInputElement>(null)
  const catalogSearchRef = useRef<HTMLInputElement>(null)
  const catalogRef = useRef<HTMLElement>(null)

  const setAvailability = (update: Availability | ((current: Availability) => Availability)) => {
    const next = typeof update === 'function' ? update(availability) : update
    try {
      window.localStorage.setItem(availabilityStorageKey, JSON.stringify(next))
      setVolatileAvailability(null)
      window.dispatchEvent(new Event(availabilityChangedEvent))
    } catch { setVolatileAvailability(next) }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch('/item-aspects-gtnh.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json() as Promise<Catalog> })
      .then((data) => setCatalog({ aspects: data.aspects, items: prepareItems(data.items), unprofiledItems: data.unprofiledItems, aspectSource: data.aspectSource, iconSource: data.iconSource, acquisitionSource: data.acquisitionSource }))
      .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setLoadError(true) })
    return () => controller.abort()
  }, [])

  const required = useMemo(() => rows.reduce<Requirement>((result, row) => {
    const amount = Number(row.amount)
    if (row.aspect && amount > 0) result[row.aspect] = (result[row.aspect] ?? 0) + amount
    return result
  }, {}), [rows])
  const requestedAspects = useMemo(() => Object.keys(required), [required])
  const requestedTotal = Object.values(required).reduce((sum, amount) => sum + amount, 0)
  const preferences = useMemo(() => ({ preferred: new Set(availability.preferred), excluded: new Set(availability.excluded), stage: availability.stage }), [availability])
  const availabilityItems = useMemo(() => new Map(catalog?.items.map((item) => [itemKey(item), item]) ?? []), [catalog])
  const managedSources = useMemo(() => {
    if (!sourcesOpen) return []
    const normalized = sourcesQuery.trim().toLocaleLowerCase()
    return [
      ...availability.preferred.map((id) => ({ id, kind: 'favorite' as const })),
      ...availability.excluded.map((id) => ({ id, kind: 'excluded' as const })),
    ].map((source) => {
      const item = availabilityItems.get(source.id)
      return { ...source, item, name: item ? displayItemName(item.name) : source.id.split('|')[0] }
    }).filter((source) => !normalized || `${source.name} ${source.item?.registryId ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [sourcesOpen, sourcesQuery, availability, availabilityItems])
  const planRequest = JSON.stringify([required, availability.stage, availability.preferred, availability.excluded])
  useEffect(() => {
    if (!catalog) return
    const worker = new Worker(new URL('../workers/essentiaPlanner.worker.ts', import.meta.url), { type: 'module' })
    plannerWorker.current = worker
    worker.onmessage = (event: MessageEvent<
      | { type: 'calculate'; request: string; plans: Plan[]; error?: boolean; partial?: boolean }
      | { type: 'catalog' | 'sources'; request: string; indices: number[] }
    >) => {
      const result = event.data
      if (result.type === 'calculate') {
        setPlanResult(result)
        if (result.partial) return
        activePlanJob.current = null
        const next = pendingPlanJob.current
        if (next && next.request !== result.request) {
          pendingPlanJob.current = null
          activePlanJob.current = next.request
          worker.postMessage(next)
        } else pendingPlanJob.current = null
      }
      else if (result.type === 'catalog') setCatalogResult(result)
      else setSourceResult(result)
    }
    worker.onerror = () => setWorkerFailed(true)
    worker.postMessage({ type: 'init', items: catalog.items })
    return () => {
      plannerWorker.current = null
      activePlanJob.current = null
      pendingPlanJob.current = null
      worker.terminate()
    }
  }, [catalog])
  useEffect(() => {
    if (!catalog || requestedTotal <= 0) {
      pendingPlanJob.current = null
      return
    }
    pendingPlanJob.current = {
      type: 'calculate', request: planRequest, required,
      preferences: { preferred: availability.preferred, excluded: availability.excluded, stage: availability.stage },
    }
    const timer = window.setTimeout(() => {
      if (activePlanJob.current || !pendingPlanJob.current) return
      const next = pendingPlanJob.current
      pendingPlanJob.current = null
      activePlanJob.current = next.request
      plannerWorker.current?.postMessage(next)
    }, 90)
    return () => window.clearTimeout(timer)
  }, [catalog, planRequest, required, requestedTotal, availability])
  const calculating = Boolean(catalog && requestedTotal > 0 && !workerFailed && planResult?.request !== planRequest)
  const refining = planResult?.request === planRequest && planResult.partial
  const plans = requestedTotal <= 0 || calculating || workerFailed ? [] : planResult?.plans ?? []
  const catalogRequest = JSON.stringify([query, catalogFilter, catalogSort, required, availability])
  const sourceRequest = JSON.stringify([sourceQuery, requestedAspects, availability])
  useEffect(() => {
    if (!catalog || !catalogOpen) return
    const timer = window.setTimeout(() => plannerWorker.current?.postMessage({
      type: 'catalog', request: catalogRequest, required, query,
      filter: catalogFilter, sort: catalogSort, preferences: availability,
    }), 60)
    return () => window.clearTimeout(timer)
  }, [catalog, catalogOpen, catalogRequest, required, query, catalogFilter, catalogSort, availability])
  useEffect(() => {
    if (!catalog || !sourcePickerOpen || requestedAspects.length === 0) return
    const timer = window.setTimeout(() => plannerWorker.current?.postMessage({
      type: 'sources', request: sourceRequest, aspects: requestedAspects,
      query: sourceQuery, preferences: availability,
    }), 60)
    return () => window.clearTimeout(timer)
  }, [catalog, sourcePickerOpen, sourceRequest, sourceQuery, requestedAspects, availability])
  const customPlan = useMemo(() => planFromLines(customLines, required), [customLines, required])
  const selected = selectedId === 'custom' && customLines.length ? customPlan : plans.find((plan) => plan.id === selectedId) ?? plans[0]
  const shortage = selected ? Object.entries(selected.remaining).filter(([, amount]) => amount > 0) : []
  const availableAspects = catalog?.aspects.filter((aspect) => !/^custom\d+$/i.test(aspect)) ?? ['ignis', 'potentia']
  const usedAspects = new Set(rows.map((row) => row.aspect))
  const variantLabels = useMemo(() => {
    const counts = new Map<string, number>()
    const positions = new Map<string, number>()
    const labels = new Map<string, string>()
    catalog?.items.forEach((item) => { const name = displayItemName(item.name); counts.set(name, (counts.get(name) ?? 0) + 1) })
    catalog?.items.forEach((item) => {
      const name = displayItemName(item.name)
      const count = counts.get(name) ?? 0
      if (count < 2) return
      const position = (positions.get(name) ?? 0) + 1
      positions.set(name, position)
      labels.set(itemKey(item), `Variant ${position} of ${count}`)
    })
    return labels
  }, [catalog])

  const catalogSearching = catalogOpen && !workerFailed && catalogResult?.request !== catalogRequest
  const sourceSearching = sourcePickerOpen && !workerFailed && sourceResult?.request !== sourceRequest
  const filteredItems = useMemo(() => catalog && !catalogSearching
    ? catalogResult?.indices.map((index) => catalog.items[index]) ?? [] : [], [catalog, catalogSearching, catalogResult])
  const sourceMatches = useMemo(() => catalog && !sourceSearching
    ? sourceResult?.indices.map((index) => catalog.items[index]) ?? [] : [], [catalog, sourceSearching, sourceResult])
  const unprofiledMatches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!catalog?.unprofiledItems || normalized.length < 2) return []
    return catalog.unprofiledItems.filter((item) =>
      `${displayItemName(item.name)} ${item.registryId}`.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => Number(displayItemName(b.name).toLocaleLowerCase() === normalized)
        - Number(displayItemName(a.name).toLocaleLowerCase() === normalized)
        || a.name.localeCompare(b.name))
  }, [catalog, query])

  const preferItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({
      stage: previous.stage,
      preferred: previous.preferred.includes(id) ? previous.preferred.filter((value) => value !== id) : [...previous.preferred, id],
      excluded: previous.excluded.filter((value) => value !== id),
    }))
  }
  const excludeItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({
      stage: previous.stage,
      preferred: previous.preferred.filter((value) => value !== id),
      excluded: previous.excluded.includes(id) ? previous.excluded : [...previous.excluded, id],
    }))
  }
  const restoreItem = (item: ItemAspect) => {
    const id = itemKey(item)
    setAvailability((previous) => ({ ...previous, excluded: previous.excluded.filter((value) => value !== id) }))
  }
  const removeManagedSource = (id: string, kind: 'favorite' | 'excluded') => {
    setAvailability((previous) => kind === 'favorite'
      ? { ...previous, preferred: previous.preferred.filter((value) => value !== id) }
      : { ...previous, excluded: previous.excluded.filter((value) => value !== id) })
  }

  const updateRow = (id: number, change: Partial<Row>) => setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...change } : row))
  const changeAmount = (id: number, value: string) => {
    if (!/^\d{0,4}$/.test(value)) return
    updateRow(id, { amount: value && Number(value) > 1000 ? '1000' : value })
  }
  const stepAmount = (row: Row, direction: number) => updateRow(row.id, { amount: String(Math.max(0, Math.min(1000, (Number(row.amount) || 0) + direction))) })
  const addRow = () => {
    const aspect = availableAspects.find((candidate) => !usedAspects.has(candidate))
    if (!aspect) return
    setRows((previous) => [...previous, { id: nextId, aspect, amount: '1' }])
    setNextId((value) => value + 1)
  }
  const chooseItem = (item: ItemAspect) => {
    const coversAll = requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
    const current = selectedId === 'custom' ? customLines : []
    const needed = coversAll ? required : planFromLines(current, required).remaining
    const count = countForItem(item, needed)
    if (count === null) return
    const found = current.find((line) => itemKey(line.item) === itemKey(item))
    const next = coversAll ? [{ item, count }]
      : found ? current.map((line) => line === found ? { ...line, count: line.count + count } : line)
        : [...current, { item, count }]
    setCustomLines(next)
    setSelectedId('custom')
    if (Object.values(planFromLines(next, required).remaining).every((amount) => amount === 0)) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }))
    }
  }
  const updateCustomCount = (item: ItemAspect, count: number) => {
    if (count <= 0 && customLines.length === 1) setSelectedId(null)
    setCustomLines((previous) => previous.map((line) => itemKey(line.item) === itemKey(item) ? { ...line, count } : line).filter((line) => line.count > 0))
  }
  const selectPlan = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }))
  }
  const openSourcePicker = () => {
    setSourcePickerOpen(true)
    requestAnimationFrame(() => sourceSearchRef.current?.focus())
  }
  const openCatalogSearch = () => {
    setCatalogOpen(true)
    setQuery(sourceQuery)
    setCatalogFilter('anySelected')
    setVisibleCount(30)
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
      catalogSearchRef.current?.focus({ preventScroll: true })
    })
  }
  const toggleExpanded = (key: string) => setExpandedItems((previous) => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const matchesShown = filteredItems.slice(0, visibleCount)
  const catalogNeeded = selectedId === 'custom' && customLines.length > 0 ? customPlan.remaining : required
  const visiblePlans = alternativesOpen ? plans : [...plans.slice(0, 3), ...plans.slice(3).filter((plan) => plan.id === selectedId)]

  return <div className="ess-page">
    <h1 className="sr-only">Essentia Planner</h1>

    <section className={`ess-main${sourcePickerOpen ? ' has-open-source' : ''}`} aria-label="Essentia calculation">
      <div className="panel ess-requirements"><div className="ess-section-head"><h3>Target</h3></div>
        <div className="ess-compose"><div className="ess-compose-aspects"><div className="ess-rows">{rows.map((row) => <div className="ess-row" key={row.id}><div className="ess-aspect-field"><AspectPicker value={row.aspect} aspects={availableAspects} excluded={usedAspects} onChange={(aspect) => updateRow(row.id, { aspect })} /></div><div className="ess-amount"><label className="sr-only" htmlFor={`amount-${row.id}`}>{`${aspectLabel(row.aspect)} amount`}</label><div className="ess-amount-control"><button type="button" disabled={Number(row.amount) <= 0} aria-label={`Decrease ${aspectLabel(row.aspect)} amount`} onClick={() => stepAmount(row, -1)}>−</button><input id={`amount-${row.id}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} value={row.amount} onFocus={(event) => event.target.select()} onChange={(event) => changeAmount(row.id, event.target.value)} onBlur={() => updateRow(row.id, { amount: String(Math.min(1000, Number(row.amount) || 0)) })} onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); stepAmount(row, event.key === 'ArrowUp' ? 1 : -1) } }} /><button type="button" disabled={Number(row.amount) >= 1000} aria-label={`Increase ${aspectLabel(row.aspect)} amount`} onClick={() => stepAmount(row, 1)}>+</button></div></div><button className="ess-remove" type="button" disabled={rows.length === 1} aria-label={`Remove ${aspectLabel(row.aspect)}`} title={`Remove ${aspectLabel(row.aspect)}`} onClick={() => setRows((previous) => previous.filter((entry) => entry.id !== row.id))}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M7 6V4h6v2m-7 0 .7 10h6.6L14 6M8.5 9v4.5m3-4.5v4.5" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>)}</div><button className="ess-add" type="button" disabled={rows.length >= availableAspects.length} onClick={addRow}><span aria-hidden="true">＋</span> Add aspect</button></div>
          <details className="ess-advanced"><summary><span>Availability</span><span className={availability.stage !== 'NONE' ? 'is-active' : ''}>{availability.stage === 'NONE' ? 'Basic' : stages.find(([value]) => value === availability.stage)?.[1]} <Chevron /></span></summary><div className="ess-stage-control"><SelectField label="Progression tier" value={availability.stage} options={stages} onChange={(stage) => setAvailability((previous) => ({ ...previous, stage }))} /></div></details>
        </div>
      </div>

      <div className="panel ess-result" aria-live="polite" ref={resultRef}><div className="ess-section-head"><h3>Furnace</h3>{refining && selectedId !== 'custom' && <small className="ess-refining" role="status">Refining…</small>}{selectedId === 'custom' && <button className="ess-reset-plan" type="button" onClick={() => setSelectedId(null)}>Restore recommendation</button>}</div>
        {!catalog && !loadError && <div className="ess-state">Loading item catalog…</div>}
        {loadError && <div className="ess-state">Could not load the catalog. Please refresh the page.</div>}
        {workerFailed && <div className="ess-state">Calculation unavailable. Please refresh the page.</div>}
        {catalog && requestedAspects.length === 0 && <div className="ess-state">Enter an amount for at least one aspect.</div>}
        {catalog && requestedAspects.length > 0 && calculating && selectedId !== 'custom' && <div className="ess-state">Calculating a practical mix…</div>}
        {catalog && requestedAspects.length > 0 && !calculating && !workerFailed && !planResult?.error && !selected && <div className="ess-state">No suitable item mix found. Try different aspects.</div>}
        {catalog && planResult?.request === planRequest && planResult.error && <div className="ess-state">Could not calculate a mix. Try changing the target.</div>}
        {selected && <div className="ess-result-body"><div className="ess-result-items"><div className="ess-picked-head"><span className="ess-pick-label">{selectedId === 'custom' ? 'Your selection' : selected.title}</span><strong>{selected.itemCount.toLocaleString('en-US')} <small>{itemWord(selected.itemCount)}</small></strong></div>
          <div className="ess-picked-items">{selected.lines.map(({ item, count }) => {
            const id = itemKey(item)
            const aspectEntries = Object.entries(item.aspects).sort(([a], [b]) => Number(Boolean(required[b])) - Number(Boolean(required[a])) || a.localeCompare(b))
            const expanded = expandedItems.has(id)
            return <div className="ess-picked-item" key={id}><ItemIcon item={item} large /><div className="ess-picked-item-details"><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>{item.aspectVersion && <small className="ess-aspect-source" title="Aspect profile comes from an earlier GTNH release and is unverified in 2.9">GTNH {item.aspectVersion}</small>}<div className="ess-picked-aspects">{(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}{aspectEntries.length > 6 && <button className="ess-more-aspects" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(id)}>{expanded ? 'Collapse' : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}</button>}</div></div>{selectedId === 'custom' ? <div className="ess-count-stepper"><button type="button" aria-label={`Decrease ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count - 1)}>−</button><b>{count}</b><button type="button" aria-label={`Increase ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count + 1)}>+</button></div> : <div className="ess-item-tools"><b className="ess-item-count">× {count}</b><button type="button" onClick={() => excludeItem(item)}>Not available</button></div>}</div>
          })}</div>
          {selected.lines.some(({ item }) => item.aspectVersion) && <p className="ess-source-note">GTNH 2.8 aspect values · unverified in 2.9</p>}
          </div><div className="ess-result-analysis">
          <div className="ess-progress-list">{requestedAspects.map((aspect) => { const amount = selected.produced[aspect] ?? 0; const target = required[aspect]; return <div className="ess-progress" key={aspect}><AspectIcon name={aspect} /><span>{aspectLabel(aspect)}</span><b className={amount < target ? 'is-short' : ''}>{amount} / {target}</b><div className="ess-progress-track"><span style={{ width: `${Math.min(100, amount / target * 100)}%` }} /></div></div> })}</div>
          {shortage.length > 0 && <div className="ess-shortage"><strong>Missing</strong><span>{shortage.map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')}</span></div>}
          {selected.extra > 0 && <div className="ess-result-meta"><span>+{selected.extra} excess</span></div>}
          {Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).length > 0 && <div className="ess-other-aspects"><span>Byproducts</span>{Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}</div>}
        </div></div>}
        {catalog && requestedAspects.length > 0 && <div className="ess-source-browser">
          <button className="ess-source-toggle" type="button" aria-expanded={sourcePickerOpen} onClick={() => sourcePickerOpen ? setSourcePickerOpen(false) : openSourcePicker()}>
            <span>Build your own mix</span><span aria-hidden="true">{sourcePickerOpen ? '−' : '+'}</span>
          </button>
          {sourcePickerOpen && <div className="ess-source-content">
            <label className="ess-catalog-search"><span aria-hidden="true">⌕</span><input ref={sourceSearchRef} type="search" value={sourceQuery} onChange={(event) => { setSourceQuery(event.target.value); setSourceVisibleCount(12) }} placeholder="Item name or ID" aria-label="Search essentia sources" />{sourceQuery && <button type="button" aria-label="Clear source search" onClick={() => { setSourceQuery(''); setSourceVisibleCount(12); sourceSearchRef.current?.focus() }}>×</button>}</label>
            {sourceQuery && <p>{sourceSearching ? 'Searching…' : `${sourceMatches.length.toLocaleString('en-US')} found`}</p>}
            <div className="ess-source-list">{sourceMatches.slice(0, sourceVisibleCount).map((item) => <div className="ess-source-row" key={itemKey(item)}><ItemIcon item={item} /><div><strong>{displayItemName(item.name)}</strong><small>{Object.entries(item.aspects).filter(([aspect]) => required[aspect]).map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')}{item.aspectVersion ? ` · GTNH ${item.aspectVersion}` : ''}</small></div><button type="button" disabled={preferences.excluded.has(itemKey(item))} onClick={() => chooseItem(item)}>{countForItem(item, required)} {itemWord(countForItem(item, required) ?? 0)} →</button></div>)}</div>
            {sourceSearching && <p>Searching sources…</p>}
            {!sourceSearching && sourceMatches.length === 0 && <p>No matches. Try another name or ID.</p>}
            <div className="ess-source-footer">{sourceVisibleCount < sourceMatches.length && <button type="button" onClick={() => setSourceVisibleCount((count) => count + 12)}>Show 12 more</button>}<button type="button" onClick={openCatalogSearch}>Open full catalog ↓</button></div>
          </div>}
        </div>}
      </div>
    </section>

    {plans.length > 1 && <section className="panel ess-alternatives" aria-label="Alternative item mixes"><div className="ess-section-head"><h3>Alternatives</h3></div><div className="ess-alternative-grid">{visiblePlans.map((plan) => <button type="button" className={`ess-alternative ${selected?.id === plan.id ? 'is-active' : ''}`} key={plan.id} onClick={() => selectPlan(plan.id)}><span className="ess-alternative-icons">{plan.lines.slice(0, 2).map(({ item }) => <ItemIcon key={itemKey(item)} item={item} />)}</span><span className="ess-alternative-copy"><strong>{plan.title}</strong><small>{plan.lines.map(({ item, count }) => `${count}× ${displayItemName(item.name)}${item.aspectVersion ? ` [${item.aspectVersion}]` : ''}`).join(' + ')}</small></span>{plan.extra > 0 && <em>+{plan.extra} excess</em>}</button>)}</div>{plans.length > 3 && <button className="ess-more-alternatives" type="button" aria-expanded={alternativesOpen} onClick={() => setAlternativesOpen((open) => !open)}>{alternativesOpen ? 'Show fewer mixes ↑' : `Show all ${plans.length} mixes ↓`}</button>}</section>}

    <section className={`panel ess-catalog ${catalogOpen ? 'is-open' : ''}`} aria-label="Full item catalog" ref={catalogRef}><div className="ess-catalog-header"><div className="ess-section-head"><h3>Catalog</h3></div><button className="ess-catalog-toggle" type="button" aria-expanded={catalogOpen} onClick={() => setCatalogOpen((current) => !current)}>{catalogOpen ? 'Hide catalog −' : 'Browse catalog +'}</button></div>
      {(availability.preferred.length > 0 || availability.excluded.length > 0) && <div className="ess-availability-panel">
        <button className="ess-source-manager-toggle" type="button" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((open) => !open)}><strong>My sources</strong><span>{availability.preferred.length} favorites · {availability.excluded.length} unavailable</span><Chevron /></button>
        {sourcesOpen && <div className="ess-source-manager-body">
          <label className="ess-source-manager-search"><span aria-hidden="true">⌕</span><input type="search" value={sourcesQuery} onChange={(event) => { setSourcesQuery(event.target.value); setSourcesVisibleCount(30) }} placeholder="Find a source" aria-label="Search saved sources" /></label>
          <div className="ess-source-manager-list">{managedSources.slice(0, sourcesVisibleCount).map(({ id, kind, item, name }) => <div className="ess-source-manager-row" key={`${kind}-${id}`}>
            {item ? <ItemIcon item={item} /> : <span className="ess-item-icon" aria-hidden="true">?</span>}
            <div><strong title={name}>{name}</strong><small>{kind === 'favorite' ? 'Favorite' : 'Unavailable'}</small></div>
            <button type="button" onClick={() => removeManagedSource(id, kind)} aria-label={kind === 'favorite' ? `Remove ${name} from favorites` : `Restore ${name} to recommendations`}>{kind === 'favorite' ? 'Remove' : 'Restore'}</button>
          </div>)}</div>
          {managedSources.length === 0 && <p className="ess-source-manager-empty">No saved sources found.</p>}
          {sourcesVisibleCount < managedSources.length && <button className="ess-source-manager-more" type="button" onClick={() => setSourcesVisibleCount((count) => count + 30)}>Show 30 more ↓</button>}
        </div>}
      </div>}
      <div className="ess-catalog-toolbar"><div className="ess-catalog-search-field"><label className="ess-catalog-search"><span aria-hidden="true">⌕</span><input ref={catalogSearchRef} type="search" placeholder="Item name or ID" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(30) }} aria-label="Search items" />{query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); setVisibleCount(30) }}>×</button>}</label></div><div className="ess-sort"><SelectField label="Sort by" value={catalogSort} options={[["practical", "Easiest to get"], ["quantity", "Fewest items"], ["name", "Name"]]} onChange={(sort) => { setCatalogSort(sort as CatalogSort); setVisibleCount(30) }} /></div></div>
      <div className="ess-filter-tabs" role="group" aria-label="Item filter"><button type="button" className={catalogFilter === 'allSelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allSelected'); setVisibleCount(30) }}>All aspects</button><button type="button" className={catalogFilter === 'anySelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('anySelected'); setVisibleCount(30) }}>Any aspect</button><button type="button" className={catalogFilter === 'allItems' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allItems'); setVisibleCount(30) }}>All items</button></div>
      <div className="ess-catalog-summary"><strong>{catalogSearching ? '…' : filteredItems.length.toLocaleString('en-US')}</strong><span>{catalogSearching ? 'Searching' : 'items'}</span></div>
      <div className="ess-catalog-list">{matchesShown.map((item) => {
        const overlap = requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
        const coversAll = requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
        const count = countForItem(item, coversAll ? required : catalogNeeded)
        const aspectEntries = Object.entries(item.aspects).sort(([a], [b]) => Number(Boolean(required[b])) - Number(Boolean(required[a])) || a.localeCompare(b))
        const key = itemKey(item)
        const expanded = expandedItems.has(key)
        const isPreferred = preferences.preferred.has(key)
        const isExcluded = preferences.excluded.has(key)
        return <div className={`ess-catalog-item ${isExcluded ? 'is-excluded' : ''}`} key={key}>
          <ItemIcon item={item} />
          <div className="ess-catalog-item-body">
            <div className="ess-catalog-name"><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>{variantLabels.has(key) && <small>{variantLabels.get(key)}</small>}{item.aspectVersion && <small className="ess-aspect-source" title="Aspect profile comes from an earlier GTNH release and is unverified in 2.9">GTNH {item.aspectVersion}</small>}{item.registryId && <small title={item.registryId}>{item.registryId.split(':')[0]}</small>}</div>
            <div className="ess-catalog-aspects">{(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}{aspectEntries.length > 6 && <button className="ess-more-aspects" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(key)}>{expanded ? 'Collapse' : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}</button>}</div>
          </div>
          <div className="ess-catalog-action">
            <button type="button" disabled={!overlap || count === null || isExcluded} onClick={() => chooseItem(item)}>{isExcluded ? 'Excluded' : !overlap ? 'Not suitable' : count === null ? 'Covered' : coversAll ? 'Choose mix' : `Add ${count} ${itemWord(count)}`}</button>
          </div>
          <button className={`ess-availability-button ${isPreferred ? 'is-preferred' : ''}`} type="button" aria-label={isExcluded ? `Restore ${displayItemName(item.name)} to recommendations` : isPreferred ? `Remove preference for ${displayItemName(item.name)}` : `Prefer ${displayItemName(item.name)}`} aria-pressed={isPreferred} title={isExcluded ? 'Restore to recommendations' : isPreferred ? 'Remove abundant item mark' : 'Have plenty — prefer in recommendations'} onClick={() => isExcluded ? restoreItem(item) : preferItem(item)}>{isExcluded ? <span aria-hidden="true">↶</span> : <StarIcon filled={isPreferred} />}</button>
        </div>
      })}{catalog && !catalogSearching && filteredItems.length === 0 && unprofiledMatches.length === 0 && <p className="ess-no-results">Nothing found. Try another name or the Entire catalog filter.</p>}</div>
      {visibleCount < filteredItems.length && <button className="ess-show-more" type="button" onClick={() => setVisibleCount((count) => count + 30)}>Show 30 more <span>↓</span></button>}
      {unprofiledMatches.length > 0 && <details className="ess-unprofiled" open={filteredItems.length === 0}><summary>{unprofiledMatches.length.toLocaleString('en-US')} items found in GTNH 2.9 without aspect profiles</summary><p>These items exist in the pack, but the current export does not include their furnace aspects. They are excluded from calculations.</p><div>{unprofiledMatches.slice(0, 24).map((item) => <div className="ess-unprofiled-row" key={item.registryId}><strong>{displayItemName(item.name)}</strong><small>{item.registryId}</small></div>)}</div>{unprofiledMatches.length > 24 && <small>Showing the first 24 matches. Refine your search for more.</small>}</details>}
      <details className="ess-data-note"><summary>About data and icons</summary><p>The catalog contains {catalog?.aspectSource?.count.toLocaleString('en-US') ?? '—'} profiles from GTNH {catalog?.aspectSource?.version ?? ''} and {(catalog?.aspectSource?.fallbackCounts?.['2.8.0'] ?? 0).toLocaleString('en-US')} additional profiles from GTNH 2.8.0. Matches were checked by ID, mod, and name; GTNH 2.9 data takes priority. Earlier profiles are labeled and can be used in calculations, but their 2.9 furnace behavior is unverified. Items without profiles appear only in search. Effort is estimated from {catalog?.acquisitionSource?.recipeCount.toLocaleString('en-US') ?? '—'} GTNH 2.9 machine and farm recipes; crafting table recipes are absent from this export. Icons come from <a href="https://github.com/ShadowTheAge/gtnh-2.7.4" target="_blank" rel="noreferrer">the GTNH atlas</a> and <a href="https://github.com/Samiracle64/gtnh-factory-flow" target="_blank" rel="noreferrer">the GTNH 2.9 resource index</a>.</p></details>
    </section>
  </div>
}
