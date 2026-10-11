# Echtra: Project Plan

Oct 10, 2026 · Matthew Cooper

## Status (Oct 10, 2026)

**Scaffolded.** Vite + React 19 + TypeScript + Tailwind v4, React Router, TanStack Query, Dexie.

- **Library:** 18 mythology and epic titles built by `npm run library`, with EPUB TOC
  parsing, PG boilerplate stripped, and long chapters split at the next TOC level, then at
  headings, then by size.
- **Reader:** scroll and paged modes (two-page spread on wide screens) that share a text
  anchor, plus a TOC drawer, scrubber, "back to where you were", themes, fonts, keyboard
  and swipe controls, wake lock, and a saved position.
- **Quotes:** select text in the reader to save a quote (highlighted in place), copy it
  with a citation, or share it to Bluesky via the compose link. The Quotes page adds notes,
  per-book filters and Markdown export.
- **Social:** Bluesky public feeds (accounts, custom feeds, lists) in the Reading Room, plus a
  per-book "possibly related" panel.
- **Hosting:** a Cloudflare Worker serves the app and library as static assets, with an
  allowlisted `/proxy/*`.

**Decisions:** mythology first; Cloudflare for hosting; Bluesky public feeds only (no sign-in
yet). Substack, Mastodon, on-demand import, free-form highlights and in-book search are still to come.

## Overview

Echtra is a reading app for public-domain books from Project Gutenberg. The core promise:
find a book, open it instantly, and read it comfortably, scrolling or turning pages, with a
real table of contents. Around each book, Echtra shows what people are saying about it on the
open web (Bluesky, Substack, Mastodon), read through those platforms' public feeds and APIs.

- **For:** people who read classics, mythology and folklore and want something nicer than a
  raw `.txt` file.
- **Stack:** React + Tailwind (Vite, TypeScript), installable as a PWA.
- **Books:** a curated library we pre-process and host ourselves, plus on-demand import of
  any other Gutenberg title.

**Back-burner (not in this plan):** sacred-texts.com, writing app integration.

## Goals and non-goals

**Goals**

1. Instant, offline-capable reading of a curated Gutenberg library we host ourselves.
2. Every book has a clean table of contents and chapter structure.
3. Reading feels good in both **scroll** and **paginated** modes, and your place is kept
   when you switch between them.
4. A "conversation" panel per book, drawn from public posts and newsletters, always linking
   back to the original.
5. Clear attribution and license compliance for every source.

**Non-goals**

- Copyrighted books, DRM, store integrations.
- Our own social network (posting, followers, hosting user content). We read from existing
  platforms; posting to them comes later, if at all.
- Closed platforms (Goodreads, Instagram, X): no usable public API for this.
- Scraping anything a platform's terms prohibit.

## Licensing and terms

This section is from Gutenberg's [permissions](https://www.gutenberg.org/policy/permission.html)
and [robot access](https://www.gutenberg.org/policy/robot_access.html) pages (checked Oct 10, 2026).
It's a summary, not legal advice. Re-check before launch.

**Rehosting Gutenberg books is allowed**, with these conditions:

- **Public domain (US).** Most Gutenberg books are public domain in the US. Non-commercial
  redistribution needs no permission, "with or without" the Project Gutenberg trademark.
- **Skip copyrighted items.** Some books are still under copyright (Gutendex flags these as
  `copyright: true`). Exclude them from the hosted library and from import.
- **Trademark and commercial use.** Commercial use that trades on the "Project Gutenberg"
  name owes royalties under their license. While Echtra is non-commercial this doesn't
  apply. If it ever makes money, strip the PG license and trademark text from the hosted
  files, but keep crediting Gutenberg as the source. Their permissions page says citing
  Gutenberg as the publication source is always OK.
- **Outside the US.** A book that's public domain in the US may not be elsewhere. Show a
  short notice in the About and license screens.
- **Downloading for the hosted library.** Gutenberg's site is for humans, and automated
  access can get your IP blocked. To build the library, use the public-domain **offline
  catalog** (RDF/CSV) for metadata, and either a **private mirror** or the documented
  `wget` harvest with a 2-second wait for files. Never crawl gutenberg.org pages.
- **Keeping books current.** Gutenberg fixes books over time, so re-sync the hosted
  library periodically.

**Citation on every book:** "Source: Project Gutenberg eBook #1342, https://www.gutenberg.org/ebooks/1342".
Add the release date and the date we processed it. The book detail page also links to the
original and its license.

Social sources have their own rules. See [Social sources](#social-sources).

## Book pipeline

### 1. Hosted library (pre-processed)

An offline Node script (`scripts/build-library`) turns Gutenberg files into a static,
reader-ready format:

```
catalog (RDF/CSV) → select titles → fetch EPUB (from mirror / polite harvest)
  → strip PG boilerplate (keep license text separately) → split chapters
  → build TOC → sanitize HTML → extract metadata + cover
  → write  /books/{id}/manifest.json  +  /books/{id}/ch-{n}.html
  → write  /catalog.json  (search index for the hosted set)
```

- **Hosting:** static files on Cloudflare R2/Pages (or any CDN). No server logic, and no
  CORS problem because we serve them ourselves.
- **Start small:** about 200 to 500 titles (Gutenberg top downloads, plus collections like
  mythology, folklore and epic poetry), then grow.
- **Format preference:** EPUB first, because its `nav.xhtml`/`toc.ncx` gives a real TOC.
  HTML is the fallback, with the TOC built from `<h2>`/`<h3>`. Plain text is the last
  resort and uses heuristics (see below).
- **Human-in-the-loop:** the build writes a report of books whose TOC looks suspicious
  (for example 1 chapter, 300 chapters, or empty titles), so they can be fixed by hand with
  a small per-book override file.

### 2. On-demand import (everything else)

For books not in the hosted set, the app searches [Gutendex](https://gutendex.com) and imports
a single title when the user opens it. This uses the same parsing code, run in a Web Worker
in the browser.

- Gutenberg files don't send CORS headers, so this path needs a small **proxy**: a
  Cloudflare Worker that only allows gutenberg.org and gutendex.com, caches responses,
  and is rate-limited. It must not be an open proxy.
- One fetch per user import, cached on the device. No prefetching.

### Shared data shape

```ts
type BookManifest = {
  id: string;                 // "pg1342"
  title: string;
  authors: { name: string; birth?: number; death?: number }[];
  language: string;
  subjects: string[];
  coverUrl?: string;
  source: { name: 'Project Gutenberg'; ebookNo: number; url: string; released?: string; processed: string };
  toc: TocEntry[];
  chapters: { index: number; title: string; file: string; words: number }[];
  totalWords: number;
};

type TocEntry = { title: string; level: number; chapterIndex: number; anchor?: string };
```

### Plain-text TOC heuristics (fallback)

- Headings like `CHAPTER IV`, `BOOK II`, `CANTO`, `ACT`, `STAVE`, and short all-caps lines
  surrounded by blank lines.
- Parse Gutenberg's own "CONTENTS" block when there is one, and match each entry to a later
  heading.
- If nothing is found, split into roughly 5,000-word parts so the TOC and progress still work.

## Reading experience

This is the heart of the app.

### Two modes, one position

- **Scroll mode:** continuous vertical reading within a chapter, which flows on to the next
  chapter at the end.
- **Paginated mode:** CSS multi-column layout, one column per screen width. Turn pages with
  tap or click zones (left and right thirds), swipe, ←/→, PageUp/PageDown or Space. An
  optional two-page spread on wide screens.
- **Position model:** position is stored as `chapterIndex` plus a **text anchor**: a block
  index and character offset, not pixels or page numbers. On a mode switch, font change or
  window resize, the reader re-finds that anchor, so you never lose your place.

### Navigation

- **TOC drawer:** nested entries, current chapter highlighted, read and unread state.
- **Progress:** book %, chapter %, and "about 12 min left in chapter" based on word count
  and the reader's measured pace.
- **Scrubber:** a bottom slider to jump anywhere in the book, previewing the chapter title.
- **Back stack:** after jumping via the TOC, search or a link, a "← back to where you were"
  chip appears.
- **Bookmarks.**
- **In-book search:** results grouped by chapter, with context snippets.

### Typography and comfort

- **Fonts:** self-hosted serif and sans options (e.g. Literata, EB Garamond, Atkinson
  Hyperlegible).
- **Layout settings:** font size, line height, margins and max line width.
- **Text alignment:** justify or left, with `hyphens: auto` and the `lang` attribute set
  from the book's language.
- **Themes:** light, sepia, dark and true black. These are CSS variables, so user
  settings don't fight Tailwind.
- **Focus mode:** hides all chrome. Tap the center to show it again.
- **Screen and motion:** Screen Wake Lock while reading, and `prefers-reduced-motion`
  respected for page-turn animation.
- **Book content:** footnotes open as popovers instead of jumping, and images and poetry
  line breaks are preserved.

### Annotations (local)

- Highlights in a few colors, plus notes, anchored to text so they survive reflow.
- A "My highlights" view per book, with Markdown export.

### Performance

- Load chapter by chapter. Only the current chapter and its neighbors are in the DOM.
- Parse imports in a Web Worker.
- Use a service worker for offline reading of downloaded and hosted books.

## Social sources

Social sources are read-only in the MVP. Each source is an adapter that returns a normalized
`SocialItem` (`source`, `author`, `text`, `url`, `createdAt`, `bookId?`). Every item links out
to the original.

| Source | How | Notes |
| --- | --- | --- |
| **Bluesky** | AT Protocol public API (`app.bsky.feed.getAuthorFeed`, `getFeed`, `getListFeed`) | Author, list and custom feeds work without login. **Post search** (`searchPosts`) is reported to return 403 when unauthenticated on `public.api.bsky.app`, with cursor paging blocked. Plan for search to need the user signed in via Bluesky OAuth, and use time-based paging with `until`. Verify before building. |
| **Substack** | Each publication's RSS at `{publication}/feed` | RSS is the documented read path. There's no official read or search API, and Substack's terms restrict scraping, so **don't** use the undocumented `/api/v1/*` endpoints. Users add newsletters they like, and we match posts to books by title or author. |
| **Mastodon** | Public hashtag timelines (`/api/v1/timelines/tag/{tag}`) and account RSS | Good for tags like `#bookstodon`. Behavior varies per instance, and some require login. |
| **Optional extras** | Wikipedia REST API (author and book summaries), Open Library (covers, editions), LibriVox (matching audiobooks) | Context around a book, not social, but cheap to add. |

### What social looks like in the app

1. **Book conversation panel:** on a book's page, recent Bluesky posts and Substack essays
   that mention the title or author, with a link-out for each.
2. **Following feed:** a "Reading Room" tab that merges the Bluesky accounts and lists,
   Substack newsletters and Mastodon tags the user follows, in chronological order.
3. **Book links in posts:** if a post links to a Gutenberg or Echtra book, show an "Open
   in Echtra" button.
4. **Later: share out.** Share a highlight to Bluesky via its compose intent URL, which
   needs no API write access. Full posting with OAuth comes much later.

**Matching posts to books** is the hard part. Start simple: a search for the exact title plus
the author's surname. Combine that with hashtags (`#booksky`, `#bookstodon`) and links to
`gutenberg.org/ebooks/{n}`. Show it as "possibly related", not as a definitive match.

**Polite fetching:** cache social responses (5 to 15 minutes), poll only while the panel
is open, and route through the same allowlisted Worker when CORS blocks the browser
(RSS usually needs this; Bluesky's API usually doesn't).

## Feature list

| Tier | Feature | Notes |
| --- | --- | --- |
| MVP | Hosted curated library | Pre-processed, static, instant open |
| MVP | Browse and search (hosted set) | Client-side search over `catalog.json` |
| MVP | Book detail page | Cover, description, TOC preview, citation |
| MVP | TOC drawer and progress | Nested TOC, % and time left |
| MVP | Scroll **and** paginated modes | Shared text-anchor position |
| MVP | Reading settings | Fonts, size, spacing, width, themes |
| MVP | Library and continue reading | IndexedDB (Dexie), offline via service worker |
| MVP | Attribution and license screens | Per book and global About |
| v1 | On-demand Gutenberg import | Gutendex + Worker proxy |
| v1 | Highlights, notes and bookmarks | Local, Markdown export |
| v1 | In-book search and scrubber | |
| v1 | Bluesky book conversation panel | Public feeds first, then search after sign-in |
| v1 | Substack newsletters (RSS) | User-added publications |
| v1 | Reading Room feed | Merged, chronological |
| Later | Mastodon tags and accounts | |
| Later | Share highlight to Bluesky | Compose intent, then OAuth posting |
| Later | Sync across devices | Small backend only if needed |
| Later | Footnote, dictionary and Wikipedia popovers | |
| Later | LibriVox audiobook pairing | |

## App structure

```
scripts/
  build-library/      catalog.ts, fetch.ts, epub.ts, html.ts, text.ts, toc.ts, report.ts
src/
  books/              hostedSource.ts, gutendex.ts, importWorker.ts, parse/ (shared with scripts)
  social/             bluesky.ts, substack.ts, mastodon.ts, match.ts, types.ts
  db/                 dexie.ts (library, progress, annotations, settings, follows, socialCache)
  features/
    discover/         browse, search, book detail
    library/          shelf, continue reading
    reader/           Reader, ScrollView, PagedView, TocDrawer, Settings, Scrubber, position.ts
    social/           ConversationPanel, ReadingRoom, FollowManager
  ui/                 shared Tailwind components
worker/               Cloudflare Worker proxy (allowlist + cache)
```

- **Routing:** React Router, with `/`, `/book/:id`, `/read/:id/:chapter`, `/library` and
  `/room`.
- **State:** TanStack Query for remote data, and Dexie live queries for local data.
- **Shared parser:** `src/books/parse` is plain TS used by both the build script (Node) and
  the import worker (browser).

## From the prototype

Keep the discover grid and header styling. Split them into routes and components, swap
`allorigins` for our hosted files plus the Worker, and render a chapter at a time from the
manifest instead of splitting the whole text into paragraphs.

## Milestones

1. **Scaffold:** Vite + React + TS + Tailwind, routing, Dexie, theme tokens.
2. **Library builder:** process 20 hand-picked EPUBs, plus the TOC report. Iterate until
   the output is clean.
3. **Reader (scroll):** chapter rendering, TOC drawer, settings, saved position.
4. **Reader (paginated):** columns, page turns, the shared position model, mode switching.
5. **Discover and library:** hosted catalog, search, shelf, offline. **This is the MVP.**
   Scale the library up to a few hundred titles.
6. **Annotations and in-book search.**
7. **Social v1:** Bluesky adapter and conversation panel, then Substack RSS, then the
   Reading Room.
8. **On-demand import** via Gutendex and the Worker.

## Risks and open questions

**Risks**

- **Paginated layout edge cases:** images, poetry and long tables in CSS columns. Budget
  real time for this.
- **TOC quality:** EPUB-first plus manual overrides keeps it manageable for the hosted set.
- **Bluesky search access:** may require user login. Design the panel to work with public
  feeds alone.
- **Post-to-book matching:** noisy. Label it honestly and let users hide or report bad
  matches.
- **Platform terms change:** each social source sits behind its own adapter. Re-check
  terms before launch.

**Open questions**

- [ ] Which titles and collections go in the first hosted batch?
- [ ] Bluesky sign-in in v1, or public feeds only at first?
- [ ] Which Substack publications and Bluesky accounts or feeds should be seeded as
      defaults in the Reading Room?
- [ ] Hosting: Cloudflare (R2 + Pages + Worker) for everything?
- [ ] Will Echtra ever be commercial? This affects how the PG trademark text is handled.
