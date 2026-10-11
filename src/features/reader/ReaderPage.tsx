import { ArrowLeft, ChevronLeft, ChevronRight, List, Type, Undo2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useChapterHtml, useManifest } from '../../books/hosted.ts'
import type { BookManifest } from '../../books/types.ts'
import { db, type ReadingPosition } from '../../db/db.ts'
import { displayHeading, readingTime, shortTitle } from '../../lib/format.ts'
import { ErrorNote, Spinner } from '../../ui/AppShell.tsx'
import { prepareChapter } from './content.ts'
import {
  countPages,
  pageOfAnchor,
  pageOfElement,
  readPagedAnchor,
  readScrollAnchor,
  scrollToAnchor,
  scrollToElement,
  type Anchor,
} from './position.ts'
import { FONTS, useSettings, type ReaderSettings } from './settings.ts'
import { SettingsPanel } from './SettingsPanel.tsx'
import { TocList } from './TocList.tsx'

const HEADER = 56
const FOOTER = 56
const GAP = 48
const SIDE_PAD = 20

type NavState = { at?: 'end'; restore?: ReadingPosition } | null

/** /read/:id with no chapter → resume where the reader left off. */
export function ReaderPage() {
  const { id, chapter } = useParams()
  const navigate = useNavigate()
  const manifest = useManifest(id)
  // Saved position as of opening the book (null = never read). Loaded once, not live.
  const [saved, setSaved] = useState<{ id: string; position: ReadingPosition | null } | null>(null)

  useEffect(() => {
    if (id) db.positions.get(id).then((p) => setSaved({ id, position: p ?? null }))
  }, [id])

  useEffect(() => {
    if (id && chapter === undefined && saved?.id === id)
      navigate(`/read/${id}/${saved.position?.chapterIndex ?? 0}`, { replace: true })
  }, [id, chapter, saved, navigate])

  if (manifest.isLoading || chapter === undefined || !saved || saved.id !== id) return <Spinner label="Opening book…" />
  if (manifest.error || !manifest.data) return <ErrorNote error={manifest.error ?? 'Book not found'} />
  const index = Math.min(Math.max(0, Number(chapter) || 0), manifest.data.chapters.length - 1)
  return <Reader book={manifest.data} index={index} saved={saved.position} />
}

function Reader({ book, index, saved }: { book: BookManifest; index: number; saved: ReadingPosition | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [settings, updateSettings] = useSettings()
  const chapter = book.chapters[index]
  const raw = useChapterHtml(book.id, chapter.file)
  const html = useMemo(() => (raw.data ? prepareChapter(book.id, raw.data) : ''), [book.id, raw.data])

  const contentRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<Anchor>({ block: 0, offset: 0 })
  const laidOutHtml = useRef('')
  const saveTimer = useRef<number>(undefined)

  const [chrome, setChrome] = useState(true)
  const [panel, setPanel] = useState<'toc' | 'settings' | null>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const [chapterFraction, setChapterFraction] = useState(0)
  const [back, setBack] = useState<{ chapter: number; anchor: Anchor } | null>(null)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const paged = settings.mode === 'paged'
  const layout = pagedLayout(settings, viewport.w, viewport.h)

  // Keep the book on the shelf once opened.
  useEffect(() => {
    db.shelf.get(book.id).then((s) => {
      if (!s) db.shelf.put({ bookId: book.id, title: book.title, authors: book.authors, cover: book.cover, addedAt: Date.now() })
    })
  }, [book])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---- Saving position ---------------------------------------------------------------------

  const pendingSave = useRef<ReadingPosition | null>(null)
  const flushSave = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    if (pendingSave.current) db.positions.put(pendingSave.current)
    pendingSave.current = null
  }, [])

  const wordsBefore = useMemo(() => book.chapters.slice(0, index).reduce((n, c) => n + c.words, 0), [book, index])

  const capture = useCallback(
    (currentPage = page, totalPages = pages) => {
      const content = contentRef.current
      if (!content || !content.firstElementChild) return
      let fraction: number
      if (paged) {
        anchorRef.current = readPagedAnchor(content, currentPage, layout.step, layout.width)
        fraction = totalPages > 1 ? currentPage / (totalPages - 1) : 1
      } else {
        anchorRef.current = readScrollAnchor(content, HEADER)
        const max = document.documentElement.scrollHeight - window.innerHeight
        fraction = max > 0 ? Math.min(1, window.scrollY / max) : 1
      }
      setChapterFraction(fraction)
      pendingSave.current = {
        bookId: book.id,
        chapterIndex: index,
        block: anchorRef.current.block,
        offset: anchorRef.current.offset,
        percent: book.totalWords ? (wordsBefore + fraction * chapter.words) / book.totalWords : 0,
        updatedAt: Date.now(),
      }
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushSave, 400)
    },
    [book, index, chapter.words, wordsBefore, paged, page, pages, layout.step, layout.width],
  )

  // Don't lose the last position when the tab is hidden, closed or the reader unmounts.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushSave()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushSave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushSave)
      flushSave()
    }
  }, [])

  // ---- Layout + restoring position --------------------------------------------------------

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || !html) return

    // New chapter: where should we land? Same chapter re-layout: stay on the current anchor.
    const isNewChapter = laidOutHtml.current !== html
    const isFirstLayout = laidOutHtml.current === ''
    laidOutHtml.current = html
    const state = location.state as NavState
    const hashTarget = isNewChapter && location.hash ? content.querySelector(`[id="${CSS.escape(location.hash.slice(1))}"]`) : null
    // On opening the book (incl. a reload), resume the saved spot if it's in this chapter.
    const restore = state?.restore ?? (isFirstLayout && !state ? saved : null)
    let target: Anchor | Element | 'end' = anchorRef.current
    if (isNewChapter) {
      if (hashTarget) target = hashTarget
      else if (state?.at === 'end') target = 'end'
      else if (restore?.chapterIndex === index) target = { block: restore.block, offset: restore.offset }
      else target = { block: 0, offset: 0 }
    }

    if (paged) {
      const total = countPages(content, layout.columnStep, layout.columns)
      const p =
        target === 'end' ? total - 1
        : target instanceof Element ? pageOfElement(content, target, layout.step)
        : pageOfAnchor(content, target, layout.step)
      const clamped = Math.min(Math.max(0, p), total - 1)
      setPages(total)
      setPage(clamped)
      capture(clamped, total)
    } else {
      if (target === 'end') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
      else if (target instanceof Element) scrollToElement(target, HEADER + 16)
      else scrollToAnchor(content, target, HEADER)
      capture()
    }
    // capture/location intentionally excluded: this runs on content or layout changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, paged, layout.width, layout.height, layout.columns, settings.size, settings.leading, settings.font, settings.justify])

  // Wait for web fonts, then re-anchor (metrics change once they load).
  useEffect(() => {
    document.fonts?.ready.then(() => {
      if (paged && contentRef.current) setPages(countPages(contentRef.current, layout.columnStep, layout.columns))
    })
  }, [html, paged, layout.columnStep, layout.columns])

  // ---- Scroll mode: track position, auto-hide chrome -----------------------------------------

  useEffect(() => {
    if (paged) return
    let lastY = window.scrollY
    let timer: number | undefined
    const onScroll = () => {
      if (timer !== undefined) return
      timer = window.setTimeout(() => {
        timer = undefined
        const y = window.scrollY
        if (y > lastY + 8 && y > 120) setChrome(false)
        else if (y < lastY - 8) setChrome(true)
        lastY = y
        capture()
      }, 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [paged, capture])

  // ---- Navigation --------------------------------------------------------------------------

  const goChapter = useCallback(
    (n: number, at?: 'end') => {
      if (n < 0 || n >= book.chapters.length) return
      navigate(`/read/${book.id}/${n}`, { state: (at ? { at } : null) satisfies NavState })
    },
    [book, navigate],
  )

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (!paged) return goChapter(index + dir, dir < 0 ? 'end' : undefined)
      const next = page + dir
      if (next < 0) return goChapter(index - 1, 'end')
      if (next >= pages) return goChapter(index + 1)
      setPage(next)
      capture(next, pages)
    },
    [paged, page, pages, index, goChapter, capture],
  )

  const jumpTo = useCallback(
    (targetId: string) => {
      setBack({ chapter: index, anchor: anchorRef.current })
      const ch = book.anchors[targetId]
      const content = contentRef.current
      const el = content?.querySelector(`[id="${CSS.escape(targetId)}"]`)
      if ((ch === undefined || ch === index) && el && content) {
        if (paged) {
          const p = pageOfElement(content, el, layout.step)
          setPage(p)
          capture(p, pages)
        } else scrollToElement(el, HEADER + 16)
      } else if (ch !== undefined) navigate(`/read/${book.id}/${ch}#${targetId}`)
    },
    [book, index, paged, layout.step, pages, capture, navigate],
  )

  const goBack = () => {
    if (!back) return
    const restore: ReadingPosition = { bookId: book.id, chapterIndex: back.chapter, ...back.anchor, percent: 0, updatedAt: 0 }
    setBack(null)
    if (back.chapter === index) {
      anchorRef.current = back.anchor
      const content = contentRef.current
      if (!content) return
      if (paged) setPage(pageOfAnchor(content, back.anchor, layout.step))
      else scrollToAnchor(content, back.anchor, HEADER)
    } else navigate(`/read/${book.id}/${back.chapter}`, { state: { restore } satisfies NavState })
  }

  const onContentClick = (e: MouseEvent) => {
    const link = (e.target as Element).closest('a')
    const href = link?.getAttribute('href')
    if (href?.startsWith('#')) {
      e.preventDefault()
      e.stopPropagation()
      jumpTo(href.slice(1))
    }
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return
      if (e.key === 'Escape') setPanel(null)
      else if (e.key === 't') setPanel((p) => (p === 'toc' ? null : 'toc'))
      else if (e.key === ']') goChapter(index + 1)
      else if (e.key === '[') goChapter(index - 1)
      else if (paged && ['ArrowRight', 'PageDown'].includes(e.key)) turn(1)
      else if (paged && ['ArrowLeft', 'PageUp'].includes(e.key)) turn(-1)
      else if (paged && e.key === ' ') turn(e.shiftKey ? -1 : 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paged, turn, goChapter, index])

  // Keep the screen awake while reading.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    const request = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      lock?.release()
    }
  }, [])

  // Paged mode: tap zones and swipes
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      turn(dx < 0 ? 1 : -1)
      suppressClick.current = true
    }
  }
  const suppressClick = useRef(false)
  const onPagedClick = (e: MouseEvent) => {
    if (suppressClick.current) return void (suppressClick.current = false)
    if ((e.target as Element).closest('a') || window.getSelection()?.toString()) return
    const x = e.clientX / window.innerWidth
    if (x < 0.3) turn(-1)
    else if (x > 0.7) turn(1)
    else setChrome((c) => !c)
  }

  // ---- Render ------------------------------------------------------------------------------

  const readerVars = {
    '--reader-font': FONTS[settings.font].stack,
    '--reader-size': `${settings.size}px`,
    '--reader-leading': settings.leading,
    '--reader-align': settings.justify ? 'justify' : 'start',
    '--reader-hyphens': settings.justify ? 'auto' : 'manual',
    '--reader-indent': settings.justify ? '1.5em' : '0',
  } as CSSProperties

  const minutesLeft = readingTime(chapter.words * (1 - chapterFraction))
  const bookPercent = Math.round(((wordsBefore + chapterFraction * chapter.words) / Math.max(1, book.totalWords)) * 100)
  const showChrome = chrome || panel !== null

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Top bar */}
      <header
        className={`fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/95 px-2 backdrop-blur transition-transform duration-200 motion-reduce:transition-none ${showChrome ? '' : '-translate-y-full'}`}
      >
        <Link to={`/book/${book.id}`} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Back to book">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-muted">{shortTitle(book.title)}</p>
          <p className="truncate text-sm font-medium">{displayHeading(chapter.title)}</p>
        </div>
        <button type="button" onClick={() => setPanel(panel === 'toc' ? null : 'toc')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Table of contents (t)">
          <List className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={() => setPanel(panel === 'settings' ? null : 'settings')} className="grid size-10 place-items-center rounded-full hover:bg-surface-2" aria-label="Reading settings">
          <Type className="size-5" aria-hidden />
        </button>
      </header>

      {raw.isLoading ? (
        <Spinner />
      ) : raw.error ? (
        <ErrorNote error={raw.error} />
      ) : paged ? (
        <div
          className="reader-paged fixed select-text"
          style={{ top: HEADER, height: layout.height, left: (viewport.w - layout.width) / 2, width: layout.width }}
          onClick={onPagedClick}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            ref={contentRef}
            lang={book.language}
            className="reader-content transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              ...readerVars,
              width: layout.width,
              columnCount: layout.columns,
              columnGap: GAP,
              transform: `translateX(${-page * layout.step}px)`,
            }}
            onClick={onContentClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <article className="mx-auto px-5 pt-20 pb-36" style={{ maxWidth: `calc(${settings.width} * ${settings.size}px + 40px)` }}>
          <div ref={contentRef} lang={book.language} className="reader-content" style={readerVars} onClick={onContentClick} dangerouslySetInnerHTML={{ __html: html }} />
          <nav className="mt-16 flex items-center justify-between gap-4 border-t border-border pt-6 text-sm">
            {index > 0 ? (
              <button type="button" onClick={() => goChapter(index - 1)} className="flex items-center gap-1 text-muted hover:text-fg">
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </button>
            ) : <span />}
            {index < book.chapters.length - 1 ? (
              <button type="button" onClick={() => goChapter(index + 1)} className="flex items-center gap-1 rounded-full bg-accent px-5 py-2 font-medium text-accent-fg">
                {displayHeading(book.chapters[index + 1].title)} <ChevronRight className="size-4" aria-hidden />
              </button>
            ) : (
              <Link to={`/book/${book.id}`} className="rounded-full bg-accent px-5 py-2 font-medium text-accent-fg">Finished · back to book</Link>
            )}
          </nav>
        </article>
      )}

      {/* Bottom bar */}
      <footer
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur transition-transform duration-200 motion-reduce:transition-none ${showChrome || paged ? '' : 'translate-y-full'}`}
        style={{ height: FOOTER }}
      >
        <div className="mx-auto flex h-full max-w-3xl items-center gap-3 px-3 text-xs text-muted">
          <button type="button" onClick={() => turn(-1)} disabled={index === 0 && (!paged || page === 0)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30" aria-label={paged ? 'Previous page' : 'Previous chapter'}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <ChapterScrubber book={book} index={index} onCommit={goChapter} />
            <div className="mt-1 flex justify-between gap-2">
              <span className="truncate">
                Ch. {index + 1} of {book.chapters.length}
                {paged && ` · page ${page + 1} of ${pages}`}
              </span>
              <span className="shrink-0">{minutesLeft} left in chapter · {bookPercent}%</span>
            </div>
          </div>
          <button type="button" onClick={() => turn(1)} disabled={index === book.chapters.length - 1 && (!paged || page >= pages - 1)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30" aria-label={paged ? 'Next page' : 'Next chapter'}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </footer>

      {back && (
        <button
          type="button"
          onClick={goBack}
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-lg"
        >
          <Undo2 className="size-4" aria-hidden /> Back to where you were
          <span role="button" tabIndex={0} aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); setBack(null) }} className="ml-1 text-muted">
            <X className="size-3.5" aria-hidden />
          </span>
        </button>
      )}

      {panel === 'toc' && (
        <Sheet side="left" title="Contents" onClose={() => setPanel(null)}>
          <TocList
            book={book}
            currentChapter={index}
            linkTo={(e) => `/read/${book.id}/${e.chapterIndex}${e.anchor ? `#${e.anchor}` : ''}`}
            onNavigate={() => {
              setBack({ chapter: index, anchor: anchorRef.current })
              setPanel(null)
            }}
          />
        </Sheet>
      )}
      {panel === 'settings' && (
        <Sheet side="right" title="Reading settings" onClose={() => setPanel(null)}>
          <SettingsPanel settings={settings} update={updateSettings} canSpread={viewport.w >= 1000} />
        </Sheet>
      )}
    </div>
  )
}

function pagedLayout(s: ReaderSettings, vw: number, vh: number) {
  const available = vw - SIDE_PAD * 2
  const column = s.width * s.size
  const columns = s.spread && vw >= 1000 && available >= column * 1.6 + GAP ? 2 : 1
  const width = Math.floor(Math.min(available, columns * column + (columns - 1) * GAP))
  const columnWidth = (width - (columns - 1) * GAP) / columns
  return {
    width,
    height: vh - HEADER - FOOTER - 24,
    columns,
    columnStep: columnWidth + GAP,
    step: width + GAP,
  }
}

function ChapterScrubber({ book, index, onCommit }: { book: BookManifest; index: number; onCommit: (n: number) => void }) {
  const [value, setValue] = useState<number | null>(null)
  const shown = value ?? index
  return (
    <div className="relative">
      {value !== null && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 max-w-[80vw] -translate-x-1/2 truncate rounded bg-fg px-2 py-1 text-xs text-bg">
          {displayHeading(book.chapters[shown].title)}
        </div>
      )}
      <input
        type="range"
        min={0}
        max={book.chapters.length - 1}
        value={shown}
        aria-label="Jump to chapter"
        onChange={(e) => setValue(Number(e.target.value))}
        onPointerUp={() => {
          if (value !== null && value !== index) onCommit(value)
          setValue(null)
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' && value !== null) {
            onCommit(value)
            setValue(null)
          }
        }}
        className="block h-1 w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  )
}

function Sheet({ side, title, onClose, children }: { side: 'left' | 'right'; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label={title}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} flex w-[min(380px,90vw)] flex-col border-border bg-bg shadow-xl ${side === 'left' ? 'border-r' : 'border-l'}`}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">{children}</div>
      </div>
    </div>
  )
}
