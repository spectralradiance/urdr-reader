import { useQuery } from '@tanstack/react-query'
import type { BookManifest, Catalog } from './types.ts'

/** Hosted library root. Served with the app in dev and prod; override to point at R2 later. */
export const LIBRARY_URL = (import.meta.env.VITE_LIBRARY_URL ?? '/library').replace(/\/$/, '')

export const bookUrl = (id: string, file = '') => `${LIBRARY_URL}/books/${id}/${file}`

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} loading ${url}`)
  return res.json() as Promise<T>
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} loading ${url}`)
  return res.text()
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => getJson<Catalog>(`${LIBRARY_URL}/catalog.json`),
    staleTime: Infinity,
  })
}

export function useManifest(id: string | undefined) {
  return useQuery({
    queryKey: ['manifest', id],
    queryFn: () => getJson<BookManifest>(bookUrl(id!, 'manifest.json')),
    enabled: Boolean(id),
    staleTime: Infinity,
  })
}

export function fetchChapter(id: string, file: string) {
  return getText(bookUrl(id, file))
}

export function useChapterHtml(id: string | undefined, file: string | undefined) {
  return useQuery({
    queryKey: ['chapter', id, file],
    queryFn: () => fetchChapter(id!, file!),
    enabled: Boolean(id && file),
    staleTime: Infinity,
  })
}

export function useLicense(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['license', id],
    queryFn: () => getText(bookUrl(id, 'license.html')),
    enabled,
    staleTime: Infinity,
  })
}
