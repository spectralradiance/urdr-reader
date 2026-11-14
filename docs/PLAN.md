# Urdr Reader: Project Plan

Oct 10, 2026 · Matthew Cooper · Updated Nov 13, 2026 to match *The Norn Apps: Feature Boundaries*

Urdr Reader is one of the three Norn apps. **Urdr is where you take things
in.** Verdandi Writer is where you write, and Skuldr Social is where you publish and talk
with people. Urdr hands off to them instead of copying them.

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
- **Social:** Bluesky public feeds (accounts, custom feeds, lists) and Substack publications
  (RSS via the Worker, custom domains included) in the Reading Room, with source filters
  and a per-book "possibly related" panel.
- **Hosting:** a Cloudflare Worker serves the app and library as static assets, with an
  allowlisted `/proxy/*`.

**What changes (Nov 13):** Substack stays, as a feed source. The Bluesky part of the
Reading Room goes to Skuldr; Urdr keeps a small "conversation about this book" panel that
opens there. Rhyza's feed engine moves in.

## Overview

Urdr is the one place to read anything long, with everything shown in-app and nothing
linking out to ad-filled pages. It grows from a Gutenberg reader into a general reader:

- **Books:** a curated Gutenberg library we pre-process and host, on-demand Gutenberg
  import, and your own EPUBs.
- **Reference:** Wikipedia articles, read in the same view as books.
- **Feeds:** RSS, Substack, news sites and YouTube, taken over from rhyza, with full text
  shown in-app.

Around that: offline reading, text-to-speech, reading stats, and highlights you can send
to Verdandi.

- **For:** people who read classics, essays and newsletters and want one calm place to do it.
- **Stack:** React + Tailwind (Vite, TypeScript). The web app is the core; Electron wraps it
  for desktop and Capacitor for Android and iOS.

**Back-burner (not in this plan):** sacred-texts.com.

## Scope

| Urdr owns | Hands off to |
| --- | --- |
| Books (Gutenberg, EPUB), Wikipedia | |
| RSS, Substack, news and YouTube feeds; OPML; tags and filter rules | |
| Full-text extraction (feed content, Readability fallback) | Skuldr may use it for link previews |
| Offline reading, text-to-speech, reading stats | |
| Highlights and notes | **Verdandi:** export as Markdown or a `verdandi://` link |
| Quick word lookup (definition only) | **Verdandi:** vocabulary and deeper dictionary work |
| A small "conversation about this book" panel | **Skuldr:** posting, replies, following people |

Rule of thumb: if it means *staying in a long piece of text*, it's here (or Verdandi's,
for writing). If it means *other people*, it's Skuldr's.

## Goals and non-goals

**Goals**

1. Instant, offline-capable reading of books and articles, on web, desktop and phone.
2. Every book has a clean table of contents and chapter structure.
3. Reading feels good in both **scroll** and **paginated** modes, and your place is kept
   when you switch between them.
4. Every article is read in-app at full text: from the feed when it carries the whole
   article, otherwise extracted from the page.
5. Clear attribution and license compliance for every source. The original is always one
   tap away, but it's never the default.

**Non-goals**

- Copyrighted books, DRM, store integrations.
- Social features: posting, replies, follows, a social timeline. Those are Skuldr's. Urdr
  hands off a link or quote to share.
- Writing and editing, and vocabulary work beyond a quick definition. Those are Verdandi's.
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
  name owes royalties under their license. While Urdr is non-commercial this doesn't
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

**Articles and Wikipedia:** extracted article text is for the reader's own device. Cache it
per user, never republish it from our servers, and always show the source and a link to
the original. Wikipedia text is CC BY-SA: credit Wikipedia and link to the article and its
history.

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

### 3. Your own EPUBs

Open an EPUB file from the device. It goes through the same parser in the Web Worker and is
stored locally (never uploaded), with the same manifest shape. DRM-protected files are
refused with a clear message.

### 4. Wikipedia

Look up an article by title and read it in the book view: sections become the TOC, and
position, highlights and offline saving work the same way. Use the Wikimedia REST API
(it sends CORS headers, so no proxy is needed).

### Shared data shape

```ts
type BookManifest = {
  id: string;                 // "pg1342", "epub-<hash>", "wp-<title>"
  title: string;
  authors: { name: string; birth?: number; death?: number }[];
  language: string;
  subjects: string[];
  coverUrl?: string;
  source: { name: 'Project Gutenberg' | 'EPUB' | 'Wikipedia'; ebookNo?: number; url?: string; released?: string; processed: string };
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

## Feeds and articles

Taken over from rhyza, which built and tested this server-side.

### What moves from rhyza

- Sources: RSS/Atom (Substack, YouTube, news sites), feed auto-discovery, and the
  directory search (bundled verified feeds plus typeahead).
- OPML import and export.
- Tags per source, tag views, and filter rules (contains / does not contain by field,
  scoped to all, a tag, or a source).
- Timeline, grid and magazine layouts.
- The feed worker with ETag/Last-Modified caching, and the SSRF-safe fetch layer.

Not moving: Bluesky accounts and feeds as sources. Bluesky is people, so it's Skuldr's.

### Where fetching runs

Rhyza's worker is a Node process over Postgres, with one shared fetch per feed per
instance. Urdr is a static app with a Cloudflare Worker and Dexie on the device. Decide
before porting:

| Option | How | Trade-off |
| --- | --- | --- |
| **Worker** | Cloudflare Worker fetches feeds on request (and on a Cron Trigger for followed feeds), caching in KV or the Cache API. Subscriptions, tags and items stay in Dexie on the device. | No server to run; fits the current setup. Fetches are per request, so the shared-fetch saving comes from the cache. |
| **Small service** | Run rhyza's worker as-is next to Postgres; Urdr syncs from it. | Reuses tested code; adds a server and an account system. |

The Worker option is the default unless it can't handle feed volume.

### Full text

1. **From the feed:** use `content:encoded` (RSS) or `content` (Atom) when it holds the whole
   article. Treat it as full text when it's well past the summary length and doesn't end in
   a "read more" link.
2. **Readability fallback:** otherwise fetch the page through the Worker and extract the
   article with Mozilla's Readability, as Firefox's reader view does. Sanitize the result.
3. **YouTube:** show the video embed, description and (if available) transcript.

Feed images go through the Worker's image proxy so sources don't see readers' IPs.

### Book conversation panel

The Reading Room shrinks to a panel on each book's page: a few recent posts and Substack
essays that mention the title or author, labelled "possibly related". Bluesky posts open in
Skuldr. Matching stays simple: the exact title plus the author's surname, hashtags
(`#booksky`, `#bookstodon`) and links to `gutenberg.org/ebooks/{n}`.

**Polite fetching:** cache social responses (5 to 15 minutes), poll only while the panel
is open, and route through the allowlisted Worker when CORS blocks the browser.

## Reading experience

This is the heart of the app. It applies to books, Wikipedia articles and feed articles alike.

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

### Listening

Text-to-speech for any chapter or article, following along with a highlight and keeping
the reading position. The Web Speech API on web and desktop; a native TTS plugin on mobile
so audio keeps playing with the screen off.

### Quick lookup

Select or long-press a word for a short definition popover. It's a definition only; a
"More in Verdandi" link opens the word there for etymology, thesaurus and vocabulary.

### Annotations

- Highlights in a few colors, plus notes, anchored to text so they survive reflow.
  The current Quotes feature becomes this.
- A "My highlights" view per book and per article.
- **Export to Verdandi:** Markdown, or a `verdandi://` deep link that lands each highlight
  in a section's notes block with a source link (format below).
- **Share:** a highlight or link opens Skuldr's share URL with the text prefilled. Until
  that exists, keep Bluesky's compose intent.

### Reading stats

Time spent, words or pages read, and streaks, per book and overall. Stored locally.

### Performance and offline

- Load chapter by chapter. Only the current chapter and its neighbors are in the DOM.
- Parse imports in a Web Worker.
- **Web:** a service worker plus IndexedDB keeps saved books and articles readable with no
  connection.
- **Mobile:** native storage (Capacitor Filesystem or SQLite), because iOS can clear browser
  storage.

## Handoffs

| From | To | What moves | How |
| --- | --- | --- | --- |
| Urdr | Verdandi | Highlights, notes, quotes with source | Markdown export or a `verdandi://` deep link |
| Urdr | Skuldr | A link or quote to share | Skuldr's share URL with prefilled text |
| Skuldr | Urdr | A link someone posted | Opens in Urdr's full-text view |

**Highlight export format** (to agree with Verdandi):

```markdown
> The quoted text.

— *Book or article title*, Author · [source](https://…) · chapter or section
Your note, if any.
```

## Feature list

| Tier | Feature | Notes |
| --- | --- | --- |
| Done | Hosted curated library, scroll and paged modes, TOC, settings | |
| Done | Quotes with notes, filters and Markdown export | Becomes highlights |
| Done | Substack feeds via the Worker | Becomes a feed source |
| Next | Feed engine from rhyza | Sources, OPML, tags, filters, layouts |
| Next | Full text from feeds + Readability fallback | |
| Next | Shrink the Reading Room to a book conversation panel | Bluesky opens in Skuldr |
| v1 | EPUB import | Existing parser |
| v1 | Offline reading | Service worker + IndexedDB; native storage on mobile |
| v1 | Text-to-speech | |
| v1 | Reading stats | |
| v1 | Highlights export to Verdandi | Format above |
| v1 | Wikipedia articles | Wikimedia REST API |
| v1 | On-demand Gutenberg import | Gutendex + Worker proxy |
| v1 | In-book search, bookmarks | |
| v1 | Quick word lookup | Definition only |
| Later | Share via Skuldr's share URL | Once it exists |
| Later | Sync across devices | AT Protocol identity from Skuldr (see open questions) |
| Later | LibriVox audiobook pairing | |

## Platforms

| Platform | Shape | Notes |
| --- | --- | --- |
| Web | The Vite app on Cloudflare Workers | Already shipping |
| Desktop | Electron wrapper | Library and positions stay local |
| Mobile | Capacitor for Android and iOS | Offline reading and text-to-speech matter most here |

The Worker proxy serves Substack feeds, Readability fetches and images for all three.

## App structure

```
scripts/
  build-library/      catalog.ts, fetch.ts, epub.ts, html.ts, text.ts, toc.ts, report.ts
src/
  books/              hosted.ts, gutendex.ts, epubImport.ts, wikipedia.ts, parse/ (shared with scripts)
  feeds/              sources, discovery, opml, tags, filters, fulltext (from rhyza)
  social/             bluesky.ts, substack.ts, match.ts (book conversation panel only)
  db/                 dexie.ts (library, progress, highlights, feeds, items, stats, settings)
  features/
    discover/         browse, search, book detail
    library/          shelf, continue reading
    reader/           Reader, ScrollView, PagedView, TocDrawer, Settings, Scrubber, position.ts, tts
    feeds/            timeline, grid, magazine, source manager
    highlights/       highlights view, export
    stats/            reading stats
    social/           ConversationPanel
  ui/                 shared Tailwind components
worker/               Cloudflare Worker (assets, allowlisted proxy, Readability fetch, image proxy)
```

- **Routing:** React Router, with `/`, `/book/:id`, `/read/:id/:chapter`, `/library`,
  `/feeds` and `/highlights`.
- **State:** TanStack Query for remote data, and Dexie live queries for local data.
- **Shared parser:** `src/books/parse` is plain TS used by both the build script (Node) and
  the import worker (browser).

## Milestones

1. **Scaffold** ✅
2. **Library builder** ✅ (18 titles)
3. **Reader (scroll)** ✅
4. **Reader (paginated)** ✅
5. **Discover and library:** hosted catalog, search, shelf, offline. Scale the library up
   to a few hundred titles.
6. **Feed engine:** port rhyza's sources, OPML, tags, filters and layouts; decide Worker
   or service first.
7. **Full text:** feed content detection, then the Readability fallback.
8. **Shrink the Reading Room** to the book conversation panel.
9. **Reading features:** highlights (from Quotes) with Verdandi export, EPUB import,
   offline, text-to-speech, reading stats.
10. **Wikipedia** and **on-demand Gutenberg import**.
11. **Platforms:** Electron and Capacitor shells.

## Risks and open questions

**Risks**

- **Paginated layout edge cases:** images, poetry and long tables in CSS columns. Budget
  real time for this.
- **TOC quality:** EPUB-first plus manual overrides keeps it manageable for the hosted set.
- **Readability quality:** some sites extract badly or block fetches. Always offer
  "open original".
- **Post-to-book matching:** noisy. Label it honestly and let users hide or report bad
  matches.
- **Platform terms change:** each source sits behind its own adapter. Re-check terms
  before launch.

**Open questions**

- [ ] Which titles and collections go in the first hosted batch?
- [ ] Feed fetching: Cloudflare Worker or a small service?
- [ ] Mastodon profiles: feeds here, or people to follow in Skuldr?
- [ ] Sync to the PDS: AT Protocol repos are public, so a shelf and highlights synced there
      reveal what you read. Make it opt-in and labelled public, or sync some other way?
- [ ] Which feeds should be seeded as defaults?
- [ ] Will Urdr ever be commercial? This affects how the PG trademark text is handled.
