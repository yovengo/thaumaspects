import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { buildPlans, itemSimplicity, planFromLines, prepareItems } from '../lib/essentiaPlanner'
import type { ItemAspect, PlanLine, Requirement } from '../lib/essentiaPlanner'

type Catalog = { aspects: string[]; items: ItemAspect[]; iconSource?: { counts: Record<string, number> } }
type Row = { id: number; aspect: string; amount: number }
type CatalogFilter = 'allSelected' | 'anySelected' | 'allItems'
type CatalogSort = 'practical' | 'quantity' | 'name'

const textures: Record<string, string> = {
  Coal: 'coal', Charcoal: 'charcoal', 'Block of Coal': 'coal_block', Bone: 'bone', Book: 'book_normal',
  Flint: 'flint', 'Glowstone Dust': 'glowstone_dust', Gunpowder: 'gunpowder', Paper: 'paper',
  Redstone: 'redstone_dust', 'Rotten Flesh': 'rotten_flesh', Stick: 'stick', Sugar: 'sugar',
}
const aliases: Record<string, string> = {
  coal: 'уголь', charcoal: 'древесный уголь', 'coal coke': 'кокс', redstone: 'редстоун красная пыль',
  bone: 'кость', paper: 'бумага', book: 'книга', sugar: 'сахар', flint: 'кремень',
}
const displayItemName = (name: string) => name.replace(/§[0-9a-fk-or]/gi, '')
const aspectWord = (count: number) => count % 10 === 1 && count % 100 !== 11 ? 'аспект' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'аспекта' : 'аспектов'
const aspectLabel = (aspect: string) => aspect.replace(/^./, (letter) => letter.toUpperCase())
const itemKey = (item: ItemAspect) => `${item.name}|${Object.entries(item.aspects).sort(([a], [b]) => a.localeCompare(b)).map(([a, n]) => `${a}:${n}`).join(',')}`

function AspectIcon({ name }: { name: string }) {
  return <img className="ess-aspect-icon" src={`/aspects/color/${name === 'strontio' ? 'stronito' : name}.png`} alt="" />
}

function AspectTag({ name, amount }: { name: string; amount?: number }) {
  return <span className="ess-aspect-tag"><AspectIcon name={name} /><span>{aspectLabel(name)}</span>{amount !== undefined && <b>{amount}</b>}</span>
}

function ItemIcon({ item, large = false }: { item: ItemAspect; large?: boolean }) {
  const { name, icon } = item
  const texture = textures[name]
  const cleanName = displayItemName(name)
  const title = icon?.quality === 'ambiguous' ? 'В справочнике несколько предметов с этим названием: показана одна из игровых иконок'
    : icon?.quality === 'related' ? 'Показана иконка близкого предмета'
      : icon?.quality === 'generic' ? 'Точная иконка не найдена: показан игровой значок этого типа предметов'
        : undefined
  return <span className={`ess-item-icon ${large ? 'is-large' : ''} ${icon || texture ? 'has-texture' : ''} ${icon && icon.quality !== 'exact' ? 'is-approximate' : ''}`} title={title} aria-hidden="true">
    {icon?.kind === 'atlas' ? <span className="ess-atlas-sprite" style={{ backgroundPosition: `${-(icon.id % 256) * 32}px ${-Math.floor(icon.id / 256) * 32}px` }} />
      : icon?.kind === 'rendered' ? <img src={`/gt-icons/rendered/${icon.file}`} alt="" />
        : texture ? <img src={`/item-icons/${texture}.png`} alt="" /> : <span>{cleanName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>}
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
  const aspects = Object.keys(required)
  if (aspects.length === 0 || aspects.some((aspect) => !(item.aspects[aspect] > 0))) return null
  return Math.max(...aspects.map((aspect) => Math.ceil(required[aspect] / item.aspects[aspect])))
}

export default function EssentiaPlanner() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [rows, setRows] = useState<Row[]>([{ id: 1, aspect: 'ignis', amount: 16 }, { id: 2, aspect: 'potentia', amount: 16 }])
  const [nextId, setNextId] = useState(3)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customLines, setCustomLines] = useState<PlanLine[]>([])
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('allSelected')
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('practical')
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(30)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set())
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/item-aspects-gtnh.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json() as Promise<Catalog> })
      .then((data) => setCatalog({ aspects: data.aspects, items: prepareItems(data.items), iconSource: data.iconSource }))
      .catch((error: unknown) => { if (error instanceof Error && error.name !== 'AbortError') setLoadError(true) })
    return () => controller.abort()
  }, [])

  const required = useMemo(() => rows.reduce<Requirement>((result, row) => {
    if (row.aspect && row.amount > 0) result[row.aspect] = (result[row.aspect] ?? 0) + row.amount
    return result
  }, {}), [rows])
  const requestedAspects = Object.keys(required)
  const plans = useMemo(() => catalog ? buildPlans(catalog.items, required) : [], [catalog, required])
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
      if (normalized && !`${displayItemName(item.name)} ${aliases[displayItemName(item.name).toLocaleLowerCase()] ?? ''}`.toLocaleLowerCase().includes(normalized)) return false
      if (catalogFilter === 'allItems' || requestedAspects.length === 0) return true
      return catalogFilter === 'allSelected'
        ? requestedAspects.every((aspect) => (item.aspects[aspect] ?? 0) > 0)
        : requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0)
    }).sort((a, b) => {
      if (catalogSort === 'name') return displayItemName(a.name).localeCompare(displayItemName(b.name))
      const aCount = countForItem(a, required) ?? Infinity
      const bCount = countForItem(b, required) ?? Infinity
      if (catalogSort === 'quantity') return aCount - bCount || itemSimplicity(a) - itemSimplicity(b) || a.name.localeCompare(b.name)
      return itemSimplicity(a) - itemSimplicity(b) || aCount - bCount || a.name.localeCompare(b.name)
    })
  }, [catalog, query, catalogFilter, catalogSort, required])

  const updateRow = (id: number, change: Partial<Row>) => setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...change } : row))
  const addRow = () => {
    const aspect = availableAspects.find((candidate) => !usedAspects.has(candidate))
    if (!aspect) return
    setRows((previous) => [...previous, { id: nextId, aspect, amount: 1 }])
    setNextId((value) => value + 1)
  }
  const chooseItem = (item: ItemAspect) => {
    const count = countForItem(item, required)
    setCustomLines((previous) => {
      if (count !== null) return [{ item, count }]
      const current = selectedId === 'custom' ? previous : []
      const found = current.find((line) => itemKey(line.item) === itemKey(item))
      return found ? current.map((line) => line === found ? { ...line, count: line.count + 1 } : line) : [...current, { item, count: 1 }]
    })
    setSelectedId('custom')
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const updateCustomCount = (item: ItemAspect, count: number) => {
    if (count <= 0 && customLines.length === 1) setSelectedId(null)
    setCustomLines((previous) => previous.map((line) => itemKey(line.item) === itemKey(item) ? { ...line, count } : line).filter((line) => line.count > 0))
  }
  const selectPlan = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const toggleExpanded = (key: string) => setExpandedItems((previous) => {
    const next = new Set(previous)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const matchesShown = filteredItems.slice(0, visibleCount)

  return <div className="ess-page">
    <div className="ess-intro"><div><p className="eyebrow">Алхимическая печь · GTNH</p><h2>Планировщик эссенции</h2><p>Задайте нужные аспекты. Сначала покажем простой набор, затем вы сможете выбрать другой предмет или собрать свой.</p></div><span className="ess-dataset-count">{catalog ? catalog.items.length.toLocaleString('ru-RU') : '—'}<small>предметов с иконками</small></span></div>

    <section className="ess-main" aria-label="Расчёт эссенции">
      <div className="panel ess-requirements"><div className="ess-section-head"><span className="step-number">1</span><div><h3>Сколько нужно?</h3><p>Добавьте все аспекты из рецепта инфузии.</p></div></div>
        <div className="ess-rows">{rows.map((row) => <div className="ess-row" key={row.id}><AspectPicker value={row.aspect} aspects={availableAspects} excluded={usedAspects} onChange={(aspect) => updateRow(row.id, { aspect })} /><label className="ess-amount"><span>Количество</span><input type="number" min="0" max="1000" step="1" value={row.amount} onChange={(event) => updateRow(row.id, { amount: Math.min(1000, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /></label><button className="ess-remove" type="button" disabled={rows.length === 1} aria-label={`Убрать ${aspectLabel(row.aspect)}`} onClick={() => setRows((previous) => previous.filter((entry) => entry.id !== row.id))}>×</button></div>)}</div>
        <button className="ess-add" type="button" disabled={rows.length >= availableAspects.length} onClick={addRow}>＋ Добавить аспект</button>
        <div className="ess-request-summary"><strong>Нужно</strong><div>{requestedAspects.map((aspect) => <AspectTag key={aspect} name={aspect} amount={required[aspect]} />)}</div></div>
      </div>

      <div className="panel ess-result" aria-live="polite" ref={resultRef}><div className="ess-section-head"><span className="step-number">2</span><div><h3>Что положить в печь</h3><p>{selectedId === 'custom' ? 'Выбранный вами набор' : 'Рекомендуемый набор и варианты замены'}</p></div>{selectedId === 'custom' && <button className="ess-reset-plan" type="button" onClick={() => setSelectedId(null)}>Вернуть рекомендацию</button>}</div>
        {!catalog && !loadError && <div className="ess-state">Загружаем каталог предметов…</div>}
        {loadError && <div className="ess-state">Не удалось загрузить каталог. Обновите страницу.</div>}
        {catalog && requestedAspects.length === 0 && <div className="ess-state">Укажите количество хотя бы одного аспекта.</div>}
        {catalog && requestedAspects.length > 0 && !selected && <div className="ess-state">Подходящий набор не найден. Попробуйте другие аспекты.</div>}
        {selected && <><div className="ess-picked-head"><span className="ess-pick-label">{selectedId === 'custom' ? 'Ваш выбор' : selected.title}</span><strong>{selected.itemCount.toLocaleString('ru-RU')} <small>шт.</small></strong></div>
          <div className="ess-picked-items">{selected.lines.map(({ item, count }) => <div className="ess-picked-item" key={itemKey(item)}><ItemIcon item={item} large /><div><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong><span>{Object.entries(item.aspects).map(([aspect, amount]) => `${aspectLabel(aspect)} ${amount}`).join(' · ')} за 1 шт.</span></div>{selectedId === 'custom' ? <div className="ess-count-stepper"><button type="button" aria-label={`Уменьшить ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count - 1)}>−</button><b>{count}</b><button type="button" aria-label={`Увеличить ${displayItemName(item.name)}`} onClick={() => updateCustomCount(item, count + 1)}>+</button></div> : <b className="ess-item-count">× {count}</b>}</div>)}</div>
          <div className="ess-progress-list">{requestedAspects.map((aspect) => { const amount = selected.produced[aspect] ?? 0; const target = required[aspect]; return <div className="ess-progress" key={aspect}><AspectIcon name={aspect} /><span>{aspectLabel(aspect)}</span><b className={amount < target ? 'is-short' : ''}>{amount} / {target}</b><div className="ess-progress-track"><span style={{ width: `${Math.min(100, amount / target * 100)}%` }} /></div></div> })}</div>
          {shortage.length > 0 && <div className="ess-shortage"><strong>Эссенции пока не хватает</strong><span>{shortage.map(([aspect, amount]) => `${aspectLabel(aspect)}: ещё ${amount}`).join(' · ')}</span><small>Добавьте предметы из каталога или увеличьте их количество.</small></div>}
          <div className="ess-result-meta"><span>{selected.extra === 0 ? 'Без лишней эссенции' : `Лишняя эссенция: ${selected.extra}`}</span><span>{selected.lines.length} {selected.lines.length === 1 ? 'вид предмета' : 'вида предметов'}</span></div>
          {Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).length > 0 && <div className="ess-other-aspects"><span>Побочные аспекты</span>{Object.entries(selected.produced).filter(([aspect]) => !required[aspect]).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}</div>}
        </>}
      </div>
    </section>

    {plans.length > 1 && <section className="panel ess-alternatives" aria-label="Альтернативные наборы"><div className="ess-section-head"><span className="step-number">3</span><div><h3>Выберите другой вариант</h3><p>Каждая карточка заменяет весь текущий набор. Нажмите, чтобы увидеть подробный расчёт выше.</p></div></div><div className="ess-alternative-grid">{plans.map((plan) => <button type="button" className={`ess-alternative ${selected?.id === plan.id ? 'is-active' : ''}`} key={plan.id} onClick={() => selectPlan(plan.id)}><ItemIcon item={plan.lines[0].item} /><span><strong>{plan.lines.length === 1 ? displayItemName(plan.lines[0].item.name) : plan.title}</strong><small>{plan.lines.length === 1 ? `${plan.lines[0].count} шт. для всего запроса` : `${plan.itemCount} шт. · ${plan.lines.length} вида`}</small></span><em>{plan.extra === 0 ? 'без избытка' : `+${plan.extra} избытка`}</em></button>)}</div></section>}

    <section className="panel ess-catalog" aria-label="Полный каталог предметов"><div className="ess-catalog-header"><div className="ess-section-head"><span className="step-number">4</span><div><h3>Весь датасет предметов</h3><p>Поиск по полному справочнику аспектов. Выберите предмет или добавьте частичный источник в свой набор.</p></div></div><span className="ess-catalog-total">{catalog?.items.length.toLocaleString('ru-RU') ?? '—'} записей</span></div>
      <div className="ess-catalog-toolbar"><label className="ess-catalog-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Поиск предмета: Coal, уголь, Redstone…" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(30) }} aria-label="Поиск по предметам" />{query && <button type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); setVisibleCount(30) }}>×</button>}</label><label className="ess-sort"><span>Сортировка</span><select value={catalogSort} onChange={(event) => { setCatalogSort(event.target.value as CatalogSort); setVisibleCount(30) }}><option value="practical">Простые сначала</option><option value="quantity">Меньше предметов</option><option value="name">По названию</option></select></label></div>
      <div className="ess-filter-tabs" role="group" aria-label="Фильтр предметов"><button type="button" className={catalogFilter === 'allSelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allSelected'); setVisibleCount(30) }}>Все нужные аспекты</button><button type="button" className={catalogFilter === 'anySelected' ? 'is-active' : ''} onClick={() => { setCatalogFilter('anySelected'); setVisibleCount(30) }}>Хотя бы один</button><button type="button" className={catalogFilter === 'allItems' ? 'is-active' : ''} onClick={() => { setCatalogFilter('allItems'); setVisibleCount(30) }}>Весь каталог</button></div>
      <div className="ess-catalog-summary"><strong>{filteredItems.length.toLocaleString('ru-RU')} записей</strong><span>{catalogFilter === 'allSelected' ? 'содержат каждый выбранный аспект' : catalogFilter === 'anySelected' ? 'содержат один или несколько выбранных аспектов' : 'во всём датасете'}</span></div>
      {catalog && <div className="ess-icon-legend"><span className="ess-icon-legend-mark">?</span><span>Значок с вопросом: несколько предметов с таким названием или показана похожая иконка. Без вопроса — название совпало с источником.</span></div>}
      <div className="ess-catalog-list">{matchesShown.map((item) => { const count = countForItem(item, required); const overlap = requestedAspects.some((aspect) => (item.aspects[aspect] ?? 0) > 0); const aspectEntries = Object.entries(item.aspects).sort(([a], [b]) => Number(Boolean(required[b])) - Number(Boolean(required[a])) || a.localeCompare(b)); const key = itemKey(item); const expanded = expandedItems.has(key); return <div className="ess-catalog-item" key={key}><ItemIcon item={item} /><div className="ess-catalog-item-body"><div className="ess-catalog-name"><strong title={displayItemName(item.name)}>{displayItemName(item.name)}</strong>{variantLabels.has(key) && <small>{variantLabels.get(key)}</small>}</div><div className="ess-catalog-aspects">{(expanded ? aspectEntries : aspectEntries.slice(0, 6)).map(([aspect, amount]) => <AspectTag key={aspect} name={aspect} amount={amount} />)}{aspectEntries.length > 6 && <button className="ess-more-aspects" type="button" aria-expanded={expanded} onClick={() => toggleExpanded(key)}>{expanded ? 'Свернуть' : `+${aspectEntries.length - 6} ${aspectWord(aspectEntries.length - 6)}`}</button>}</div></div><div className="ess-catalog-action"><span>{!overlap ? 'Нет нужных аспектов' : count === null ? 'Частичный источник' : `${count} шт. для цели`}</span><button type="button" disabled={!overlap} onClick={() => chooseItem(item)}>{!overlap ? 'Не подходит' : count === null ? 'Добавить +1' : 'Выбрать'}</button></div></div> })}{catalog && filteredItems.length === 0 && <p className="ess-no-results">Ничего не найдено. Попробуйте другое название или фильтр «Весь каталог».</p>}</div>
      {visibleCount < filteredItems.length && <button className="ess-show-more" type="button" onClick={() => setVisibleCount((count) => count + 30)}>Показать ещё 30 <span>↓</span></button>}
      <div className="ess-data-note"><strong>О данных и иконках</strong><p>Аспекты взяты из <a href="https://github.com/axcou/thaumcraft-gtnh-solver" target="_blank" rel="noreferrer">публичного справочника GTNH</a>. Иконки найдены в атласах <a href="https://github.com/ShadowTheAge/gtnh-2.7.4" target="_blank" rel="noreferrer">GTNH 2.7.4</a> и <a href="https://github.com/Milky-way-Galaxy/gtnhnei" target="_blank" rel="noreferrer">GTNH 2.8</a>, а также в <a href="https://github.com/Samiracle64/gtnh-factory-flow" target="_blank" rel="noreferrer">каталоге GTNH 2.9</a>. {catalog?.iconSource && <>{(catalog.iconSource.counts.exact ?? 0).toLocaleString('ru-RU')} записей совпали с уникальным названием, {(catalog.iconSource.counts.ambiguous ?? 0).toLocaleString('ru-RU')} — с неоднозначным, для {((catalog.iconSource.counts.related ?? 0) + (catalog.iconSource.counts.generic ?? 0)).toLocaleString('ru-RU')} показан похожий игровой значок. </>}В справочнике аспектов нет ID предметов и номера сборки; не все совпадения можно проверить однозначно. Сверяйте незнакомые предметы в NEI вашей сборки.</p></div>
    </section>
  </div>
}
