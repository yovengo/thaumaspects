'use client'

import { Controller } from 'react-hook-form'
import { ArrowDownIcon, ArrowRightIcon, AspectIcon, SwapIcon } from '@/features/research-map/icons'
import { aspectLabel as label } from '@/features/research-map/model/catalog'
import type { Catalog } from '@/features/research-map/model/types'
import { AspectSelect } from '@/features/research-map/quick-search/AspectSelect'
import type { useQuickSearch } from '@/features/research-map/quick-search/useQuickSearch'

export function QuickSearch({
  catalog,
  controller,
}: {
  catalog: Catalog
  controller: ReturnType<typeof useQuickSearch>
}) {
  const { quickForm, swapAspects, runSearch, result, used, searched } = controller
  return (
    <section className="quick-layout" aria-label="Quick aspect search">
      <form className="panel quick-form" onSubmit={quickForm.handleSubmit(runSearch)}>
        <div className="section-heading">
          <h2>Connection</h2>
        </div>
        <div className="aspect-selects">
          <Controller
            name="from"
            control={quickForm.control}
            render={({ field }) => (
              <AspectSelect
                caption="From"
                value={field.value}
                aspects={catalog.aspects}
                onChange={field.onChange}
              />
            )}
          />
          <button
            className="swap-aspects"
            type="button"
            onClick={swapAspects}
            aria-label="Swap aspects"
            title="Swap aspects"
          >
            <SwapIcon />
          </button>
          <Controller
            name="to"
            control={quickForm.control}
            render={({ field }) => (
              <AspectSelect
                caption="To"
                value={field.value}
                aspects={catalog.aspects}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <Controller
          name="minSpaces"
          control={quickForm.control}
          render={({ field }) => (
            <label className="field-label">
              Empty spaces <strong>{field.value}</strong>
              <input
                type="range"
                min="1"
                max="10"
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(Number(event.target.value))}
                ref={field.ref}
              />
            </label>
          )}
        />
        <button className="primary-button" type="submit">
          Find connection <ArrowRightIcon />
        </button>
      </form>
      <aside className="panel quick-result" aria-live="polite">
        <div className="section-heading">
          <h2>Chain</h2>
        </div>
        {result && (
          <>
            <ol className="path-list">
              {result.map((aspect, index) => (
                <li key={result.slice(0, index + 1).join('>')}>
                  <div className="path-aspect">
                    <AspectIcon aspect={aspect} />
                    <span>{label(aspect)}</span>
                    <small>{aspect}</small>
                  </div>
                  {index < result.length - 1 && <ArrowDownIcon className="path-arrow" />}
                </li>
              ))}
            </ol>
            <div className="used-aspects">
              <span>
                {result.length - 2} intermediate {result.length === 3 ? 'aspect' : 'aspects'}
              </span>
              <div>
                {Object.entries(used).map(([aspect, count]) => (
                  <span className="used-icon" key={aspect} title={`${label(aspect)}: ${count}`}>
                    <AspectIcon aspect={aspect} />
                    <span className="used-count">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        {!result && (
          <div className="empty-result">{searched ? 'No chain found.' : 'No chain yet.'}</div>
        )}
      </aside>
    </section>
  )
}
