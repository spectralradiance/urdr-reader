import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { FONTS, type ReaderSettings, type Theme } from './settings.ts'

const THEMES: { id: Theme; label: string; bg: string; fg: string }[] = [
  { id: 'system', label: 'Auto', bg: 'linear-gradient(135deg,#fbfaf7 50%,#15171a 50%)', fg: '#888' },
  { id: 'light', label: 'Light', bg: '#fbfaf7', fg: '#1d1b18' },
  { id: 'sepia', label: 'Sepia', bg: '#f4ecd8', fg: '#3b2f20' },
  { id: 'dark', label: 'Dark', bg: '#15171a', fg: '#e6e2da' },
  { id: 'black', label: 'Black', bg: '#000', fg: '#d8d4cc' },
]

export function SettingsPanel({
  settings,
  update,
  canSpread,
}: {
  settings: ReaderSettings
  update: (patch: Partial<ReaderSettings>) => void
  canSpread: boolean
}) {
  return (
    <div className="space-y-6 p-2 text-sm">
      <Row label="Layout">
        <Segmented
          value={settings.mode}
          options={[{ value: 'scroll', label: 'Scroll' }, { value: 'paged', label: 'Pages' }]}
          onChange={(mode) => update({ mode })}
        />
      </Row>

      <Row label="Theme">
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => update({ theme: t.id })}
              aria-pressed={settings.theme === t.id}
              className={`flex size-11 items-center justify-center rounded-full border-2 text-[10px] ${settings.theme === t.id ? 'border-accent' : 'border-border'}`}
              style={{ background: t.bg, color: t.fg }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Font">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(FONTS).map(([id, f]) => (
            <button
              key={id}
              type="button"
              onClick={() => update({ font: id as ReaderSettings['font'] })}
              aria-pressed={settings.font === id}
              className={`rounded-md border px-3 py-2 text-base ${settings.font === id ? 'border-accent text-accent' : 'border-border'}`}
              style={{ fontFamily: f.stack }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      <Stepper label="Text size" value={`${settings.size}px`} onDec={() => update({ size: Math.max(14, settings.size - 1) })} onInc={() => update({ size: Math.min(32, settings.size + 1) })} />
      <Stepper label="Line spacing" value={settings.leading.toFixed(2)} onDec={() => update({ leading: Math.max(1.2, +(settings.leading - 0.1).toFixed(2)) })} onInc={() => update({ leading: Math.min(2.2, +(settings.leading + 0.1).toFixed(2)) })} />
      <Stepper label="Line width" value={`${settings.width} em`} onDec={() => update({ width: Math.max(24, settings.width - 2) })} onInc={() => update({ width: Math.min(60, settings.width + 2) })} />

      <Toggle label="Justify and hyphenate" checked={settings.justify} onChange={(justify) => update({ justify })} />
      {canSpread && settings.mode === 'paged' && (
        <Toggle label="Two-page spread" checked={settings.spread} onChange={(spread) => update({ spread })} />
      )}

      <p className="text-xs text-muted">
        Keys: <kbd>←</kbd> <kbd>→</kbd> turn pages · <kbd>[</kbd> <kbd>]</kbd> chapters · <kbd>t</kbd> contents
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-full py-1.5 ${value === o.value ? 'bg-bg font-medium shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onDec} className="grid size-8 place-items-center rounded-full border border-border hover:bg-surface-2" aria-label={`Decrease ${label.toLowerCase()}`}>
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="w-16 text-center text-muted tabular-nums">{value}</span>
        <button type="button" onClick={onInc} className="grid size-8 place-items-center rounded-full border border-border hover:bg-surface-2" aria-label={`Increase ${label.toLowerCase()}`}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--accent)]" />
    </label>
  )
}
