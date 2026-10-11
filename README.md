# Echtra

A reader for public-domain books from Project Gutenberg, starting with mythology and epics.
It has scroll and paged reading, a real table of contents, and a "Reading Room" built from
public Bluesky feeds. See [docs/PLAN.md](docs/PLAN.md) for the plan.

## Getting started

```bash
npm install
npm run library   # downloads + processes the books in scripts/build-library/collections/*.json
npm run dev
```

`npm run library` caches EPUBs in `.cache/epub/` and waits 2 s between downloads, following
Gutenberg's [robot policy](https://www.gutenberg.org/policy/robot_access.html). Re-runs reuse
the cache. Useful flags:

- `-- --only 2199,1727`: rebuild specific ebooks.
- `-- --refresh`: re-download.
- `GUTENBERG_MIRROR=https://...`: use a mirror.

Output goes to `public/library/`, which is git-ignored: `catalog.json` plus
`books/pg{n}/{manifest.json, ch-N.html, images/, cover, license.html}`. Books whose table of
contents looks wrong are listed in `.cache/library-report.md`.

## Adding books

Add entries to a file in `scripts/build-library/collections/`, or add a new collection file,
then run `npm run library`. Only add titles that Gutenberg marks as not copyrighted (Gutendex
shows this as `copyright: false`).

## Deploying (Cloudflare)

One Worker serves the built app and the library as static assets. It also serves an
allowlisted, cached `/proxy/*` route (`worker/index.ts`) for on-demand Gutenberg imports later.

```bash
npx wrangler login
npm run deploy    # vite build (copies public/library into dist) + wrangler deploy
```

Deploy from a machine that has run `npm run library`. Don't fetch from Gutenberg in CI on
every deploy. When the library outgrows Workers static assets (20k files, 25 MiB per file),
move it to R2 and set `VITE_LIBRARY_URL`.

## Layout

```
scripts/build-library/   EPUB → static library (Node)
src/books/               shared types, EPUB parser + serializer (Node and browser), hosted-library hooks
src/db/                  Dexie (IndexedDB): positions, shelf, follows, settings
src/social/              Bluesky public-API adapter, merged timeline, post→book matching
src/features/            discover, library, reader, social (Reading Room)
worker/                  Cloudflare Worker (assets + allowlisted proxy)
```

## Attribution

Books come from [Project Gutenberg](https://www.gutenberg.org). They are public domain in the
USA. Each book page cites its Gutenberg ebook number and links to the original and its license.
