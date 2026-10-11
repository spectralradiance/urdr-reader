// Shared between the library build script (Node) and the app (browser).

export type TocEntry = {
  title: string
  level: number
  chapterIndex: number
  anchor?: string
}

export type ChapterInfo = {
  index: number
  title: string
  file: string
  words: number
}

export type BookSource = {
  name: 'Project Gutenberg'
  ebookNo: number
  url: string
  processed: string
}

export type BookManifest = {
  id: string
  title: string
  authors: string[]
  language: string
  subjects: string[]
  collections: string[]
  description?: string
  cover?: string
  source: BookSource
  toc: TocEntry[]
  chapters: ChapterInfo[]
  /** Link targets inside the book (`#id`) mapped to the chapter that contains them. */
  anchors: Record<string, number>
  totalWords: number
  hasLicense: boolean
}

export type CatalogEntry = Pick<
  BookManifest,
  'id' | 'title' | 'authors' | 'language' | 'subjects' | 'collections' | 'cover' | 'totalWords'
> & { ebookNo: number }

export type Catalog = {
  generated: string
  collections: { id: string; title: string; description: string }[]
  books: CatalogEntry[]
}
