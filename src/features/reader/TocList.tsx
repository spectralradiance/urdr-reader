import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { BookManifest, TocEntry } from '../../books/types.ts'
import { displayHeading } from '../../lib/format.ts'

type Node = { entry: TocEntry; children: Node[] }

function buildTree(toc: TocEntry[]): Node[] {
  const roots: Node[] = []
  const stack: Node[] = []
  for (const entry of toc) {
    const node = { entry, children: [] }
    while (stack.length && stack[stack.length - 1].entry.level >= entry.level) stack.pop()
    ;(stack.length ? stack[stack.length - 1].children : roots).push(node)
    stack.push(node)
  }
  return roots
}

/** Nested, collapsible table of contents. Branches containing the current chapter start open. */
export function TocList({
  book,
  currentChapter,
  linkTo,
  onNavigate,
}: {
  book: BookManifest
  currentChapter?: number
  linkTo: (entry: TocEntry) => string
  onNavigate?: () => void
}) {
  const tree = buildTree(book.toc)
  return (
    <ol className="text-sm">
      {tree.map((node, i) => (
        <TocNode
          key={i}
          node={node}
          current={currentChapter}
          linkTo={linkTo}
          onNavigate={onNavigate}
        />
      ))}
    </ol>
  )
}

function contains(node: Node, chapter: number | undefined): boolean {
  return (
    chapter !== undefined &&
    (node.entry.chapterIndex === chapter || node.children.some((c) => contains(c, chapter)))
  )
}

function TocNode({
  node,
  current,
  linkTo,
  onNavigate,
}: {
  node: Node
  current?: number
  linkTo: (entry: TocEntry) => string
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(() => contains(node, current) && node.children.length < 40)
  const isCurrent =
    node.entry.chapterIndex === current && !node.children.some((c) => contains(c, current))
  return (
    <li>
      <div className="flex items-center">
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-surface-2"
          >
            <ChevronRight
              className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-7 shrink-0" />
        )}
        <Link
          to={linkTo(node.entry)}
          onClick={onNavigate}
          aria-current={isCurrent ? 'location' : undefined}
          className={`min-w-0 flex-1 rounded px-2 py-1.5 hover:bg-surface-2 ${isCurrent ? 'font-semibold text-accent' : 'text-fg'}`}
        >
          {displayHeading(node.entry.title)}
        </Link>
      </div>
      {open && node.children.length > 0 && (
        <ol className="ml-4 border-l border-border pl-1">
          {node.children.map((child, i) => (
            <TocNode
              key={i}
              node={child}
              current={current}
              linkTo={linkTo}
              onNavigate={onNavigate}
            />
          ))}
        </ol>
      )}
    </li>
  )
}
