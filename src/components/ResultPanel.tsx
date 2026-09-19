import { aspectLabel } from '../lib/catalog'
import { AspectIcon } from './AspectIcon'

export function ResultPanel({ result, searched }: { result: string[] | null; searched: boolean }) {
  const used = result ? result.slice(1, -1).reduce<Record<string, number>>(
    (total, aspect) => ({ ...total, [aspect]: (total[aspect] ?? 0) + 1 }),
    {},
  ) : {}

  return <aside className="panel result-panel" aria-live="polite">
    <div className="panel-heading"><span className="step-number">2</span><div><h2>Chain</h2><p>{searched ? (result ? 'Done — transfer the aspects to your note.' : 'No suitable chain was found.') : 'Your solution will appear here.'}</p></div></div>
    {result && <>
      <ol className="path-list">{result.map((aspect, index) => <li key={`${aspect}-${index}`}><div className="path-aspect"><AspectIcon aspect={aspect} /><span>{aspectLabel(aspect)}</span><small>{aspect}</small></div>{index < result.length - 1 && <span className="path-arrow">↓</span>}</li>)}</ol>
      <div className="used-aspects"><span>Used: {result.length - 2} steps</span><div>{Object.entries(used).map(([aspect, count]) => <span className="used-icon" key={aspect} title={`${aspectLabel(aspect)}: ${count}`}><AspectIcon aspect={aspect} />{count}</span>)}</div></div>
    </>}
    {searched && !result && <div className="empty-result">Enable more aspects or reduce the number of empty spaces.</div>}
    {!searched && <div className="empty-result">Select start and end aspects, then click “Find connection”.</div>}
  </aside>
}
