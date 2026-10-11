import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback } from 'react'
import { db } from '../../db/db.ts'

export type Theme = 'system' | 'light' | 'sepia' | 'dark' | 'black'
export type ReadingMode = 'scroll' | 'paged'

export type ReaderSettings = {
  mode: ReadingMode
  theme: Theme
  font: 'literata' | 'garamond' | 'atkinson' | 'inter'
  size: number
  leading: number
  width: number
  justify: boolean
  spread: boolean
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  mode: 'scroll',
  theme: 'system',
  font: 'literata',
  size: 19,
  leading: 1.65,
  width: 38,
  justify: false,
  spread: true,
}

export const FONTS: Record<ReaderSettings['font'], { label: string; stack: string }> = {
  literata: { label: 'Literata', stack: "'Literata Variable', Georgia, serif" },
  garamond: { label: 'EB Garamond', stack: "'EB Garamond Variable', Garamond, serif" },
  atkinson: { label: 'Atkinson', stack: "'Atkinson Hyperlegible', Verdana, sans-serif" },
  inter: { label: 'Inter', stack: "'Inter Variable', system-ui, sans-serif" },
}

export function useSettings(): [ReaderSettings, (patch: Partial<ReaderSettings>) => void] {
  const stored = useLiveQuery(() => db.settings.get('reader'), [])
  const settings = { ...DEFAULT_SETTINGS, ...(stored?.value as Partial<ReaderSettings> | undefined) }
  const update = useCallback(
    (patch: Partial<ReaderSettings>) =>
      db.transaction('rw', db.settings, async () => {
        const current = (await db.settings.get('reader'))?.value as Partial<ReaderSettings> | undefined
        await db.settings.put({ key: 'reader', value: { ...current, ...patch } })
      }),
    [],
  )
  return [settings, update]
}
