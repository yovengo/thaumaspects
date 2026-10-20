'use client'

import { stages } from '@/features/essentia/availability/stages'
import { aspectLabel } from '@/features/essentia/shared/format'
import { Chevron } from '@/features/essentia/shared/icons'
import { SelectField } from '@/features/essentia/shared/SelectField'
import type { useEssentiaPlanner } from '@/features/essentia/state/useEssentiaPlanner'
import { AspectPicker } from '@/features/essentia/target/AspectPicker'

export function TargetPanel({
  controller,
}: {
  controller: ReturnType<typeof useEssentiaPlanner>['target']
}) {
  const {
    rows,
    availableAspects,
    usedAspects,
    updateRow,
    stepAmount,
    changeAmount,
    removeRow,
    addRow,
    availability,
    setAvailability,
  } = controller
  return (
    <div className="panel ess-requirements">
      <div className="ess-section-head">
        <h3>Target</h3>
      </div>
      <div className="ess-compose">
        <div className="ess-compose-aspects">
          <div className="ess-rows">
            {rows.length === 0 && (
              <button className="ess-empty-target" type="button" onClick={addRow}>
                <span className="ess-empty-target-plus" aria-hidden="true">
                  +
                </span>
                <span>Add aspect</span>
              </button>
            )}
            {rows.map((row) => (
              <div className="ess-row" key={row.id}>
                <div className="ess-aspect-field">
                  <AspectPicker
                    value={row.aspect}
                    aspects={availableAspects}
                    excluded={usedAspects}
                    onChange={(aspect) => updateRow(row.id, { aspect })}
                  />
                </div>
                <div className="ess-amount">
                  <label
                    className="sr-only"
                    htmlFor={`amount-${row.id}`}
                  >{`${aspectLabel(row.aspect)} amount`}</label>
                  <div className="ess-amount-control">
                    <button
                      type="button"
                      disabled={Number(row.amount) <= 0}
                      aria-label={`Decrease ${aspectLabel(row.aspect)} amount`}
                      onClick={() => stepAmount(row, -1)}
                    >
                      −
                    </button>
                    <input
                      id={`amount-${row.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      maxLength={4}
                      value={row.amount}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => changeAmount(row.id, event.target.value)}
                      onBlur={() =>
                        updateRow(row.id, {
                          amount: String(Math.min(1000, Number(row.amount) || 0)),
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                          event.preventDefault()
                          stepAmount(row, event.key === 'ArrowUp' ? 1 : -1)
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={Number(row.amount) >= 1000}
                      aria-label={`Increase ${aspectLabel(row.aspect)} amount`}
                      onClick={() => stepAmount(row, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="ess-remove"
                  type="button"
                  aria-label={`Remove ${aspectLabel(row.aspect)}`}
                  title={`Remove ${aspectLabel(row.aspect)}`}
                  onClick={() => removeRow(row.id)}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 6h12M7 6V4h6v2m-7 0 .7 10h6.6L14 6M8.5 9v4.5m3-4.5v4.5"
                      stroke="currentColor"
                      strokeWidth="1.45"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <button
              className="ess-add"
              type="button"
              disabled={rows.some((row) => !row.aspect) || rows.length >= availableAspects.length}
              onClick={addRow}
            >
              <span aria-hidden="true">＋</span> Add aspect
            </button>
          )}
        </div>
        <details className="ess-advanced">
          <summary>
            <span>Availability</span>
            <span className={availability.stage !== 'NONE' ? 'is-active' : ''}>
              {availability.stage === 'NONE'
                ? 'Basic'
                : stages.find(([value]) => value === availability.stage)?.[1]}{' '}
              <Chevron />
            </span>
          </summary>
          <div className="ess-stage-control">
            <SelectField
              label="Progression tier"
              value={availability.stage}
              options={stages}
              onChange={(stage) => setAvailability((previous) => ({ ...previous, stage }))}
            />
          </div>
        </details>
      </div>
    </div>
  )
}
