import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { buildPlans, itemSimplicity, key as itemKey, planFromLines, prepareItems } from '../lib/essentiaPlanner'
import type { ItemAspect, PlanLine, Requirement } from '../lib/essentiaPlanner'

type UnprofiledItem = { name: string; registryId: string }
type Catalog = { aspects: string[]; items: ItemAspect[]; unprofiledItems?: UnprofiledItem[]; aspectSource?: { version: string; count: number; fallbackCounts?: Record<string, number> }; iconSource?: { counts: Record<string, number> }; acquisitionSource?: { version: string; recipeCount: number } }
type Row = { id: number; aspect: string; amount: number }
type CatalogFilter = 'allSelected' | 'anySelected' | 'allItems'
type CatalogSort = 'practical' | 'quantity' | 'name'
type Availability = { preferred: string[]; excluded: string[]; stage: string }
const availabilityStorageKey = 'thaumaspects:availability:v2'
const stages = [
  ['NONE', 'Без машин'], ['LV', 'LV'], ['MV', 'MV'], ['HV', 'HV'],
  ['IV', 'IV'], ['UV', 'UV'], ['MAX', 'Все уровни'],
]

function readAvailability(): Availability {
  try {
    const stored = JSON.parse(localStorage.getItem(availabilityStorageKey) ?? '{}') as Partial<Availability>
    return {
      preferred: Array.isArray(stored.preferred) ? stored.preferred.filter((value): value is string => typeof value === 'string') : [],
      excluded: Array.isArray(stored.excluded) ? stored.excluded.filter((value): value is string => typeof value === 'string') : [],
      stage: stages.some(([value]) => value === stored.stage) ? stored.stage! : 'NONE',
    }
  } catch {
    return { preferred: [], excluded: [], stage: 'NONE' }
  }
}

const displayItemName = (name: string) => name.replace(/§[0-9a-fk-or]/gi, '')
const searchRank = (name: string, query: string) => {
  const normalized = displayItemName(name).toLocaleLowerCase()
  return normalized === query ? 0 : normalized.startsWith(query) ? 1 : 2
}
const aspectWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'аспект' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'аспекта' : 'аспектов'
const aspectLabel = (aspect: string) => aspect.replace(/^./, (letter) => letter.toUpperCase())

function AspectIcon({ name }: { name: string }) {
  const [missing, setMissing] = useState(false)
  return missing ? <span className="ess-aspect-icon ess-aspect-fallback" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
    : <img className="ess-aspect-icon" src={`/aspects/color/${name === 'strontio' ? 'stronito' : name}.png`} onError={() => setMissing(true)} alt="" />
}

function AspectTag({ name, amount }: { name: string; amount?: number }) {
  return <span className="ess-aspect-tag"><AspectIcon name={name} /><span>{aspectLabel(name)}</span>{amount !== undefined && <b>{amount}</b>}</span>
}

function ItemIcon({ item, large = false }: { item: ItemAspect; large?: boolean }) {
  const { name, icon } = item
  const cleanName = displayItemName(name)
  const title = icon?.quality === 'ambiguous' ? 'В справочнике несколько предметов с этим названием: показана одна из игровых иконок'
    : icon?.quality === 'related' ? 'Показана иконка близкого предмета'
      : icon?.quality === 'generic' ? 'Точная иконка не найдена: показан игровой значок этого типа предметов'
        : undefined
  return <span className={`ess-item-icon ${large ? 'is-large' : ''} ${icon ? 'has-texture' : ''} ${icon && icon.quality !== 'exact' ? 'is-approximate' : ''}`} title={title} aria-hidden="true">
    {icon?.kind === 'atlas' ? <span className="ess-atlas-sprite" style={{ backgroundPosition: `${-(icon.id % 256) * 32}px ${-Math.floor(icon.id / 256) * 32}px` }} />
      : icon?.kind === 'rendered' ? <img src={`/gt-icons/rendered/${icon.file}`} alt="" />
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
    <button className="ess-picker-trigger" type="button" aria-label={`Выбрать аспект, сейчас ${aspectLabel(value)}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><AspectIcon name={value} /><span>{aspectLabel(value)}</span><span className="ess-chevron" aria-hidden="true">⌄</span></button>
    {open && <div className="ess-picker-popover"><label className="ess-picker-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setHighlight(0) }} onKeyDown={onKeyDown} placeholder="Найти аспект…" aria-label="Поиск аспекта" /></label>
      <div className="ess-picker-list" role="listbox" aria-label="Аспекты">{options.map((aspect, index) => <button type="button" role="option" aria-selected={aspect === value} className={index === highlight ? 'is-highlighted' : ''} key={aspect} onMouseEnter={() => setHighlight(index)} onClick={() => choose(aspect)}><AspectIcon name={aspect} /><span>{aspectLabel(aspect)}</span>{aspect === value && <b>✓</b>}</button>)}{options.length === 0 && <p>Аспект не найден</p>}</div>
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
  const [rows, setRows] = useState<Row[]>([{ id: 1, aspect: 'ignis', amount: 16 }, { id: 2, aspect: 'potentia', amount: 16 }])
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set())
  const [availability, setAvailability] = useState<Availability>(readAvailability)
  const resultRef = useRef<HTMLDivElement>(null)
  const sourceSearchRef = useRef<HTMLInputElement>(null)
  const catalogSearchRef = useRef<HTMLInputElement>(null)
  const catalogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try { localStorage.setItem(availabilityStorageKey, JSON.stringify(availability)) } catch { /* Private mode can block storage. */ }
  }, [availability])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/item-aspects-gtnh.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json() as Promise<Catalog> })
      .then((data) => setCatalog({ aspects: data.aspects, items: prepareItems(data.items), unprofiledItems: data.unprofiledItems, aspectSource: data.aspectSource, iconSource: data.iconSource, acquisitionSource: data.acquisitionSource }))
      .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setLoadError(true) })
    return () => controller.abort()
  }, [])

  const required = useMemo(() => rows.reduce<Requirement>((result, row) => {
    if (row.aspect && row.amount > 0) result[row.aspect] = (result[row.aspect] ?? 0) + row.amount
    return result
  }, {}), [rows])
  const requestedAspects = Object.keys(required)
  const preferences = useMemo(() => ({ preferred: new Set(availability.preferred), excluded: new Set(availability.excluded), stage: availability.stage }), [availability])
  const availabilityItems = useMemo(() => new Map(catalog?.items.map((item) => [itemKey(item), item]) ?? []), [catalog])
  const plans = useMemo(() => catalog ? buildPlans(catalog.items, required, preferences) : [], [catalog, required, preferences])
  const customPlan = useMemo(() => planFromLines(customLines, required), [customLines, required])
  const selected = selectedId === 'custom' && customLines.length ? customPlan : plans.find((plan) => plan.id === selectedId) ?? plans[0]
  const shortage = selected ? Object.entries(selected.remaining).filter(([, amount]) => amount > 0) : []
  const availableAspects = catalog?.aspects ?? ['ignis', 'potentia']
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
      labels.set(itemKey(item), `Профиль ${position} из ${count}`)
    })
    return labels
  }, [catalog])

  const filteredItems = useMemo(() => {
    if (!catalog) return []
    const requestedAspects = Object.keys(required)
    const normalized = query.trim().toLocaleLowerCase()
    return catalog.items.filter((item) => {
      if (normalized && !`${displayItemName(item.name)} ${item.registryId ?? ''}`.toLocaleLowerCase().includes(normalized)) return false
      if (catalogFilter === 'allItems' || requestedAspects.length === 0) return true
      return catalogFilter === 'allSelected'
        ? requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
        : requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
    }).sort((a, b) => {
      if (normalized) {
        const relevance = searchRank(a.name, normalized) - searchRank(b.name, normalized)
        if (relevance) return relevance
      }
      const preferredOrder = preferences.preferred.size ? Number(preferences.preferred.has(itemKey(b))) - Number(preferences.preferred.has(itemKey(a))) : 0
      if (preferredOrder) return preferredOrder
      const excludedOrder = preferences.excluded.size ? Number(preferences.excluded.has(itemKey(a))) - Number(preferences.excluded.has(itemKey(b))) : 0
      if (excludedOrder) return excludedOrder
      if (catalogSort === 'name') return displayItemName(a.name).localeCompare(displayItemName(b.name))
      const aCount = requestedAspects.every((aspect) => (a.aspects[aspect] ?? 0) > 0) ? countForItem(a, required) ?? Infinity : Infinity
      const bCount = requestedAspects.every((aspect) => (b.aspects[aspect] ?? 0) > 0) ? countForItem(b, required) ?? Infinity : Infinity
      if (catalogSort === 'quantity') return aCount - bCount || itemSimplicity(a, preferences) - itemSimplicity(b, preferences) || a.name.localeCompare(b.name)
      const aCoverage = requestedAspects.filter((aspect) => (a.aspects[aspect] ?? 0) > 0).length
      const bCoverage = requestedAspects.filter((aspect) => (b.aspects[aspect] ?? 0) > 0).length
      return itemSimplicity(a, preferences) / Math.max(1, aCoverage) - itemSimplicity(b, preferences) / Math.max(1, bCoverage)
        || bCoverage - aCoverage || aCount - bCount || a.name.localeCompare(b.name)
    })
  }, [catalog, query, catalogFilter, catalogSort, required, preferences])
  const sourceMatches = useMemo(() => {
    if (!catalog || Object.keys(required).length === 0) return []
    const normalized = sourceQuery.trim().toLocaleLowerCase()
    return catalog.items.filter((item) =>
      Object.keys(required).some((aspect) => (item.aspects[aspect] ?? 0) > 0) &&
      (!normalized || `${displayItemName(item.name)} ${item.registryId ?? ''}`.toLocaleLowerCase().includes(normalized)))
      .sort((a, b) => {
        if (normalized) {
          const relevance = searchRank(a.name, normalized) - searchRank(b.name, normalized)
          if (relevance) return relevance
        }
        const preferredOrder = preferences.preferred.size ? Number(preferences.preferred.has(itemKey(b))) - Number(preferences.preferred.has(itemKey(a))) : 0
        if (preferredOrder) return preferredOrder
        const excludedOrder = preferences.excluded.size ? Number(preferences.excluded.has(itemKey(a))) - Number(preferences.excluded.has(itemKey(b))) : 0
        if (excludedOrder) return excludedOrder
        return itemSimplicity(a, preferences) - itemSimplicity(b, preferences) || a.name.localeCompare(b.name)
      })
  }, [catalog, required, sourceQuery, preferences])
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

  const updateRow = (id: number, change: Partial<Row>) => setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...change } : row))
  const addRow = () => {
    const aspect = availableAspects.find((candidate) => !usedAspects.has(candidate))
    if (!aspect) return
    setRows((previous) => [...previous, { id: nextId, aspect, amount: 1 }])
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
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }
  const updateCustomCount = (item: ItemAspect, count: number) => {
    if (count <= 0 && customLines.length === 1) setSelectedId(null)
    setCustomLines((previous) => previous.map((line) => itemKey(line.item) === itemKey(item) ? { ...line, count } : line).filter((line) => line.count > 0))
  }
  const selectPlan = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const openSourcePicker = () => {
    setSourcePickerOpen(true)
    requestAnimationFrame(() => sourceSearchRef.current?.focus())
  }
  const openCatalogSearch = () => {
    setQuery(sourceQuery)
    setCatalogFilter('anySelected')
    setVisibleCount(30)
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  return <div className="ess-page">
    <div className="ess-intro"><div><p className="eyebrow">Алхимическая печь · GTNH</p><h2>Планировщик эссенции</h2><p>Задайте нужные аспекты и этап сборки. Подбор сравнит способы получения предметов по рецептам и покажет альтернативы.</p></div><span className="ess-dataset-count">{catalog ? catalog.items.length.toLocaleString('ru-RU') : '—'}<small>профилей предметов</small></span></div>

    <section className="ess-main" aria-label="Расчёт эссенции">
      <div className="panel ess-requirements"><div className="ess-section-head"><span className="step-number">1</span><div><h3>Сколько нужно?</h3><p>Добавьте все аспекты из рецепта инфузии.</p></div></div>
        <div className="ess-rows">{rows.map((row) => <div className="ess-row" key={row.id}><AspectPicker value={row.aspect} aspects={availableAspects} excluded={usedAspects} onChange={(aspect) => updateRow(row.id, { aspect })} /><label className="ess-amount"><span>Количество</span><input type="number" min="0" max="1000" step="1" value={row.amount} onChange={(event) => updateRow(row.id, { amount: Math.min(1000, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /></label><button className="ess-remove" type="button" disabled={rows.length === 1} aria-label={`Убрать ${aspectLabel(row.aspect)}`} onClick={() => setRows((previous) => previous.filter((entry) => entry.id !== row.id))}>×</button></div>)}</div>
        <button className="ess-add" type="button" disabled={rows.length >= availableAspects.length} onClick={addRow}>＋ Добавить аспект</button>
        <label className="ess-stage-control"><span>Доступный этап</span><select value={availability.stage} onChange={(event) => setAvailability((previous) => ({ ...previous, stage: event.target.value }))}>{stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>Рецепты машин выше этого уровня не учитываются.</small></label>
        <div className="ess-request-summary"><strong>Нужно</strong><div>{requestedAspects.map((aspect) => <AspectTag key={aspect} name={aspect} amount={required[aspect]} />)}</div></div>
      </div>

      <div className="panel ess-result" aria-live="polite" ref={resultRef}><div className="ess-section-head"><span className="step-number">2</span><div><h3>Что положить в печь</h3><p>{selectedId === 'custom' ? 'Выбранный вами набор' : 'Рекомендуемый набор и варианты замены'}</p></div>{selectedId === 'custom' && <button className="ess-reset-plan" type="button" onClick={() => setSelectedId(null)}>Вернуть рекомендацию</button>}</div>
        {!catalog && !loadError && <div className="ess-state">Загружаем каталог предметов…</div>}
        {loadError && <div className="ess-state">Не удалось загрузить каталог. Обновите страницу.</div>}
        {catalog && requestedAspects.length === 0 && <div className="ess-state">Укажите количество хотя бы одного аспекта.</div>}
        {catalog && requestedAspects.length > 0 && !selected && <div className="ess-state">Подходящий набор не найден. Попробуйте другие аспекты.</div>}
        {selected && <><div className="ess-picked-head"><span className="ess-pick-label">{selectedId === 'custom' ? 'Ваш выбор' : selected.title}</span><strong>{selected.itemCount.toLocaleString('ru-RU')} <small>шт.</small></strong></div>
          <div className="ess-picked-items">{selected.lines.map(({ item, count }) => <div className="ess-picked-item" key={itemKey(item)}><ItemIcon item={item} large /><div><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>{item.aspectVersion && <small className="ess-aspect-source" title="Профиль взят из более ранней версии GTNH и не подтверждён для 2.9">GTNH {item.aspectVersion}</small>}<span>{Object.entries(item.aspects).map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')} за 1 шт.</span></div>{selectedId === 'custom' ? <div className="ess-count-stepper"><button type="button" aria-label={`Уменьшить ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count - 1)}>−</button><b>{count}</b><button type="button" aria-label={`Увеличить ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count + 1)}>+</button></div> : <div className="ess-item-tools"><b className="ess-item-count">× {count}</b><button type="button" onClick={() => excludeItem(item)}>Нет под рукой</button></div>}</div>)}</div>
          {selected.lines.some(({ item }) => item.aspectVersion) && <p className="ess-source-note">В этом наборе есть профили GTNH 2.8.0. В GTNH 2.9 их значения пока не подтверждены.</p>}
          <div className="ess-progress-list">{requestedAspects.map((aspect) => { const amount = selected.produced[aspect] ?? 0; const target = required[aspect]; return <div className="ess-progress" key={aspect}><AspectIcon name={aspect} /><span>{aspectLabel(aspect)}</span><b className={amount < target ? 'is-short' : ''}>{amount} / {target}</b><div className="ess-progress-track"><span style={{ width: `${Math.min(100, amount / target * 100)}%` }} /></div></div> })}</div>
          {shortage.length > 0 && <div className="ess-shortage"><strong>Эссенции пока не хватает</strong><span>{shortage.map(([aspect, amount]) => `${aspectLabel(aspect)}: ещё ${amount}`).join(' · ')}</span><small>Добавьте предметы из каталога или увеличьте их количество.</small></div>}
          <div className="ess-result-meta"><span>{selected.extra === 0 ? 'Без лишней эссенции' : `Лишняя эссенция: ${selected.extra}`}</span><span>{selected.lines.length} {selected.lines.length === 1 ? 'вид предмета' : 'вида предметов'}</span></div>
          {Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).length > 0 && <div className="ess-other-aspects"><span>Побочные аспекты</span>{Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}</div>}
        </>}
        {catalog && requestedAspects.length > 0 && <div className="ess-source-browser">
          <button className="ess-source-toggle" type="button" aria-expanded={sourcePickerOpen} onClick={() => sourcePickerOpen ? setSourcePickerOpen(false) : openSourcePicker()}>
            <span>Найти другой предмет</span><small>{sourceMatches.length.toLocaleString('ru-RU')} источников по выбранным аспектам</small><span aria-hidden="true">{sourcePickerOpen ? '−' : '+'}</span>
          </button>
          {sourcePickerOpen && <div className="ess-source-content">
            <label className="ess-catalog-search"><span aria-hidden="true">⌕</span><input ref={sourceSearchRef} type="search" value={sourceQuery} onChange={(event) => { setSourceQuery(event.target.value); setSourceVisibleCount(12) }} placeholder="Название или ID предмета" aria-label="Найти источник эссенции" />{sourceQuery && <button type="button" aria-label="Очистить поиск источника" onClick={() => { setSourceQuery(''); setSourceVisibleCount(12); sourceSearchRef.current?.focus() }}>×</button>}</label>
            <p>{sourceQuery ? `Найдено ${sourceMatches.length.toLocaleString('ru-RU')}` : 'Показаны самые доступные источники. Поиск проверяет весь каталог, включая профили GTNH 2.8.0.'}</p>
            <div className="ess-source-list">{sourceMatches.slice(0, sourceVisibleCount).map((item) => <div className="ess-source-row" key={itemKey(item)}><ItemIcon item={item} /><div><strong>{displayItemName(item.name)}</strong><small>{Object.entries(item.aspects).filter(([aspect]) => required[aspect]).map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')}{item.aspectVersion ? ` · GTNH ${item.aspectVersion}` : ''}</small></div><button type="button" disabled={preferences.excluded.has(itemKey(item))} onClick={() => chooseItem(item)}>{countForItem(item, required)} шт. →</button></div>)}</div>
            {sourceMatches.length === 0 && <p>Совпадений нет. Попробуйте другое название или ID.</p>}
            <div className="ess-source-footer">{sourceVisibleCount < sourceMatches.length && <button type="button" onClick={() => setSourceVisibleCount((count) => count + 12)}>Показать ещё 12</button>}<button type="button" onClick={openCatalogSearch}>Открыть полный каталог ↓</button></div>
          </div>}
        </div>}
      </div>
    </section>

    {plans.length > 1 && <section className="panel ess-alternatives" aria-label="Альтернативные наборы"><div className="ess-section-head"><span className="step-number">3</span><div><h3>Выберите другой вариант</h3><p>Каждая карточка заменяет весь текущий набор. Нажмите, чтобы увидеть подробный расчёт выше.</p></div></div><div className="ess-alternative-grid">{plans.map((plan) => <button type="button" className={`ess-alternative ${selected?.id === plan.id ? 'is-active' : ''}`} key={plan.id} onClick={() => selectPlan(plan.id)}><span className="ess-alternative-icons">{plan.lines.slice(0, 2).map(({ item }) => <ItemIcon key={itemKey(item)} item={item} />)}</span><span className="ess-alternative-copy"><strong>{plan.title}</strong><small>{plan.lines.map(({ item, count }) => `${count}× ${displayItemName(item.name)}${item.aspectVersion ? ` [${item.aspectVersion}]` : ''}`).join(' + ')}</small></span><em>{plan.extra === 0 ? 'без избытка' : `+${plan.extra} избытка`}</em></button>)}</div></section>}

    <section className="panel ess-catalog" aria-label="Полный каталог предметов" ref={catalogRef}><div className="ess-catalog-header"><div className="ess-section-head"><span className="step-number">4</span><div><h3>Весь датасет предметов</h3><p>Найдите предмет и отметьте ☆, если он у вас в избытке. Подбор запомнит ваш выбор. Предмет из результата можно исключить кнопкой «Нет под рукой».</p></div></div><span className="ess-catalog-total">{catalog?.items.length.toLocaleString('ru-RU') ?? '—'} записей</span></div>
      {(availability.preferred.length > 0 || availability.excluded.length > 0) && <div className="ess-availability-panel"><strong>Мои источники</strong><div>{availability.preferred.map((id) => { const item = availabilityItems.get(id); return item && <button type="button" key={id} onClick={() => preferItem(item)} aria-label={`Убрать приоритет ${displayItemName(item.name)}`}>★ {displayItemName(item.name)} <span>×</span></button> })}{availability.excluded.map((id) => { const item = availabilityItems.get(id); return item && <button type="button" className="is-excluded" key={id} onClick={() => restoreItem(item)} aria-label={`Вернуть ${displayItemName(item.name)} в подбор`}>↶ {displayItemName(item.name)} <span>вернуть</span></button> })}</div></div>}
      <div className="ess-catalog-toolbar"><label className="ess-catalog-search"><span aria-hidden="true">⌕</span><input ref={catalogSearchRef} type="search" placeholder="Поиск предмета или ID: Coal, minecraft:coal…" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(30) }} aria-label="Поиск по предметам" />{query && <button type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); setVisibleCount(30) }}>×</button>}</label><label className="ess-sort"><span>Сортировка</span><select value={catalogSort} onChange={(event) => { setCatalogSort(event.target.value as CatalogSort); setVisibleCount(30) }}><option value="practical">Проще получить</option><option value="quantity">Меньше предметов</option><option value="name">По названию</option></select></label></div>
      <div className="ess-filter-tabs" role="group" aria-label="Фильтр предметов"><button type="button" className={catalogFilter === 'allSelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allSelected'); setVisibleCount(30) }}>Все нужные аспекты</button><button type="button" className={catalogFilter === 'anySelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('anySelected'); setVisibleCount(30) }}>Хотя бы один</button><button type="button" className={catalogFilter === 'allItems' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allItems'); setVisibleCount(30) }}>Весь каталог</button></div>
      <div className="ess-catalog-summary"><strong>{filteredItems.length.toLocaleString('ru-RU')} записей</strong><span>{catalogFilter === 'allSelected' ? 'содержат каждый выбранный аспект' : catalogFilter === 'anySelected' ? 'содержат один или несколько выбранных аспектов' : 'во всём датасете'}</span></div>
      {catalog && <div className="ess-icon-legend"><span className="ess-icon-legend-mark">Aa</span><span>Для {catalog.iconSource?.counts.missing ?? 0} предметов источник не содержит иконку: вместо неё показаны инициалы. Остальные изображения взяты из игровых данных.</span></div>}
      <div className="ess-catalog-list">{matchesShown.map((item) => {
        const overlap = requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
        const coversAll = requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
        const count = countForItem(item, coversAll ? required : catalogNeeded)
        const coveredAspects = requestedAspects.filter((aspect) => (item.aspects[aspect] ?? 0) > 0 && (coversAll || (catalogNeeded[aspect] ?? 0) > 0))
        const aspectEntries = Object.entries(item.aspects).sort(([a], [b]) => Number(Boolean(required[b])) - Number(Boolean(required[a])) || a.localeCompare(b))
        const key = itemKey(item)
        const expanded = expandedItems.has(key)
        const isPreferred = preferences.preferred.has(key)
        const isExcluded = preferences.excluded.has(key)
        return <div className={`ess-catalog-item ${isExcluded ? 'is-excluded' : ''}`} key={key}>
          <ItemIcon item={item} />
          <div className="ess-catalog-item-body">
            <div className="ess-catalog-name"><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>{variantLabels.has(key) && <small>{variantLabels.get(key)}</small>}{item.aspectVersion && <small className="ess-aspect-source" title="Профиль взят из более ранней версии GTNH и не подтверждён для 2.9">GTNH {item.aspectVersion}</small>}{item.registryId && <small title={item.registryId}>{item.registryId.split(':')[0]}</small>}<button className={`ess-availability-button ${isPreferred ? 'is-preferred' : ''}`} type="button" aria-label={isExcluded ? `Вернуть ${displayItemName(item.name)} в подбор` : isPreferred ? `Убрать приоритет ${displayItemName(item.name)}` : `Предпочитать ${displayItemName(item.name)}`} aria-pressed={isPreferred} title={isExcluded ? 'Вернуть в подбор' : isPreferred ? 'Убрать отметку «Есть много»' : 'Есть много — предпочитать в расчёте'} onClick={() => isExcluded ? restoreItem(item) : preferItem(item)}>{isExcluded ? '↶' : isPreferred ? '★' : '☆'}</button></div>
            <div className="ess-catalog-aspects">{(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}{aspectEntries.length > 6 && <button className="ess-more-aspects" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(key)}>{expanded ? 'Свернуть' : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}</button>}</div>
          </div>
          <div className="ess-catalog-action">
            <span>{!overlap ? 'Нет нужных аспектов' : count === null ? 'Уже покрыто' : `${count} шт. для ${coveredAspects.length === 1 ? aspectLabel(coveredAspects[0]) : `${coveredAspects.length} аспектов`}`}</span>
            <button type="button" disabled={!overlap || count === null || isExcluded} onClick={() => chooseItem(item)}>{isExcluded ? 'Исключён' : !overlap ? 'Не подходит' : count === null ? 'Готово' : coversAll ? 'Выбрать набор' : `Добавить ${count} шт.`}</button>
          </div>
        </div>
      })}{catalog && filteredItems.length === 0 && unprofiledMatches.length === 0 && <p className="ess-no-results">Ничего не найдено. Попробуйте другое название или фильтр «Весь каталог».</p>}</div>
      {visibleCount < filteredItems.length && <button className="ess-show-more" type="button" onClick={() => setVisibleCount((count) => count + 30)}>Показать ещё 30 <span>↓</span></button>}
      {unprofiledMatches.length > 0 && <details className="ess-unprofiled" open={filteredItems.length === 0}><summary>{unprofiledMatches.length.toLocaleString('ru-RU')} предметов найдено в GTNH 2.9 без профиля аспектов</summary><p>Они существуют в сборке, но текущая выгрузка не сообщает, что даст их плавка. Поэтому они не участвуют в расчёте.</p><div>{unprofiledMatches.slice(0, 24).map((item) => <div className="ess-unprofiled-row" key={item.registryId}><strong>{displayItemName(item.name)}</strong><small>{item.registryId}</small></div>)}</div>{unprofiledMatches.length > 24 && <small>Показаны первые 24 совпадения. Уточните название в поиске.</small>}</details>}
      <div className="ess-data-note"><strong>О данных и иконках</strong><p>Каталог содержит {catalog?.aspectSource?.count.toLocaleString('ru-RU') ?? '—'} профилей из GTNH {catalog?.aspectSource?.version ?? ''} и {(catalog?.aspectSource?.fallbackCounts?.['2.8.0'] ?? 0).toLocaleString('ru-RU')} дополнительных профилей из GTNH 2.8.0. Совпадение проверено по ID, моду и названию; данные 2.9 имеют приоритет. Добавленные профили участвуют в расчёте и отмечены версией, но их поведение в печи 2.9 не подтверждено. Предметы без профиля доступны только в поиске. Трудоёмкость оценивается по {catalog?.acquisitionSource?.recipeCount.toLocaleString('ru-RU') ?? '—'} машинным и фермерским рецептам GTNH 2.9; обычные рецепты верстака в этой выгрузке отсутствуют. Иконки взяты из <a href="https://github.com/ShadowTheAge/gtnh-2.7.4" target="_blank" rel="noreferrer">атласа GTNH</a> и <a href="https://github.com/Samiracle64/gtnh-factory-flow" target="_blank" rel="noreferrer">индекса ресурсов GTNH 2.9</a>.</p></div>
    </section>
  </div>
}
