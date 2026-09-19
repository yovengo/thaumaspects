import { useState } from 'react'
import { versions } from '../lib/catalog'

export function VersionSelect({ value, onChange }: { value: string; onChange: (version: string) => void }) {
  const [open, setOpen] = useState(false)
  const chooseVersion = (nextVersion: string) => {
    onChange(nextVersion)
    setOpen(false)
  }

  return <div className="field-label version-picker"><span>Thaumcraft version</span>
    <button className="version-picker-trigger" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{value}</span><b aria-hidden="true">⌄</b></button>
    {open && <div className="version-picker-menu" role="listbox">{versions.map((item) => <button type="button" role="option" aria-selected={item === value} key={item} onClick={() => chooseVersion(item)}>{item}</button>)}</div>}
  </div>
}
