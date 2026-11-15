# Sudoku

Play sudoku at ten difficulty levels, get hints that explain why, and turn puzzles into a printable or digital puzzle book with a cover, solutions and an answer key. Everything runs in the browser: there are no accounts and no server-side storage.

## Features

### Play
- **Ten levels graded by technique, not clue count.** A human-style solver (naked and hidden singles, locked candidates, pairs, triples, X-Wing, XY-Wing, XYZ-Wing, Swordfish, then trial and error) scores every puzzle. Every puzzle has exactly one solution.
- **Hints that explain why.** "Hidden single: in box 5, the digit 8 fits in only one cell, r5c6", with the cells highlighted and a button to place it. A wrong digit is pointed out instead of hinted on top of.
- **Undo, redo and pencil notes** (Ctrl+Z, Ctrl+Y, N), with notes cleaned up automatically.
- **Save and resume.** Your game survives a refresh. The clock starts only when you first touch the board.
- **Daily puzzle** (the same for everyone, level set by the weekday), **statistics** (solved counts, best and average times, daily streak) and **share links** that reopen the exact puzzle.
- **Themes.** Ten themes, each in light and dark mode (or match your device), with a Three.js backdrop and Phaser particle effects you can turn off.
- **Export** the current board as PDF, PNG or JPG, blank, solved or both, in the current theme or plain black and white.

### Make a book
- **Contents:** choose how many puzzles of each level, page size, one or two puzzles per page, theme and light or dark paper. Solutions go at the back, four to a page.
- **Cover options:** custom subtitle, colours (text colours adjust so they stay readable), an optional PNG or JPEG picture with a text description, and the large background grid.
- **Print-ready output:** standard print-on-demand trim sizes, bleed (outer edges for KDP, all sides for IngramSpark and Lulu), optional crop marks, paper stock, a separate cover wrap whose spine is sized from the page count, an optional white area for an ISBN barcode, and a copyright page.
- **Ink saver:** black and white only, no fills or pictures.
- **Large print:** bigger type, one puzzle per page, two solutions per page.
- **Repeatable:** the same seed, counts and settings always make the same book. A short **book code** (`B1.…`) captures the seed and all ten counts so a book can be rebuilt later.
- **Multilingual titles:** Latin, Latin Extended, Vietnamese, Cyrillic and Greek. Other alphabets (Arabic, Hebrew, Indic, Thai, Chinese, Japanese, Korean) are not supported yet and the builder says so.
- **Fast and safe to use:** books are built in a Web Worker (with a main-thread fallback for old browsers), with progress, cancel and a page-by-page preview before you download.
- **Accessible PDFs:** tagged, with a title, language, bookmarks, embedded fonts and a text description of every grid.

## Getting started

Requires Node.js 20.19 or newer and [Yarn 1](https://classic.yarnpkg.com/).

```bash
yarn install
yarn dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `yarn dev` | Start the development server |
| `yarn build` / `yarn start` | Production build and server |
| `yarn lint` | ESLint (Next.js, React Hooks and TypeScript rules) |
| `yarn typecheck` | Type-check with TypeScript 7 |
| `yarn test` | Unit tests (Vitest) |
| `yarn test:e2e` | Browser tests (Playwright) against production builds |
| `yarn audit:contrast` | Check text contrast on every theme and mode in a real browser (needs `yarn dev` and Chrome) |

> **TypeScript note.** `typescript` is aliased to `@typescript/typescript6` because typescript-eslint and Next.js still use the TypeScript 6 JavaScript API. TypeScript 7 is installed as `@typescript/native`, and `tsc` runs it.

## Testing

- **Unit tests** cover the solver and grading, seeding, the game state, statistics, colour contrast for all 20 theme and mode combinations, book codes, scripts, and the book generator (page counts, tagging, bleed, cover width, fallbacks).
- **Browser tests** (`e2e/`) run against production builds, so the real Content-Security-Policy applies: keyboard use, the consent flow (with the AdSense network blocked), game features, axe-core scans of every view in several themes, reflow at 320 px, 200% zoom, text spacing, reduced motion, and the book builder end to end (build in the worker, preview, download, print mode, no-Worker fallback).
  Run `PW_CHANNEL=chrome yarn test:e2e` to use your installed Chrome; CI installs Playwright's Chromium.
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and build, and the browser tests.
- **PDF/UA:** `WRITE_SAMPLE_PDFS=1 yarn test tests/validation-pdfs.test.ts` writes sample PDFs to `artifacts/pdfs/` to open in veraPDF or PAC.
- **Manual checks** that need a person (VoiceOver, NVDA, zoom, mobile, Acrobat, PAC, a proof print) are listed in [docs/manual-testing.md](docs/manual-testing.md).

## Configuration

Copy `.env.example` to `.env.local`. Every variable is optional, and `.env.local` is gitignored. `NEXT_PUBLIC_*` values are baked in at build time.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public address (no trailing slash). Used for canonical links, the sitemap, `robots.txt` and social cards |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_OPERATOR_NAME` | Names shown in the footer, metadata and policies |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address in the privacy policy and accessibility statement |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | AdSense publisher id (`ca-pub-…`). Leave empty for no ads |
| `NEXT_PUBLIC_ADSENSE_SLOT`, `_SLOT_PLAY`, `_SLOT_BOOK` | Ad unit ids |

### Ads and consent

With no AdSense id, no ad code is loaded and nothing about ads is shown. With one:

1. Visitors see a consent banner. **No ad script is loaded until they choose** "Allow ads" or "Non-personalised ads only". "No ads" loads nothing.
2. An ad slot stays collapsed until AdSense reports it as filled. If it is unfilled, blocked or fails to load, the slot is removed, so there is never an empty box.
3. **Privacy choices** in the footer re-opens the choice. Withdrawing consent reloads the page so no further ad requests are made.
4. `/ads.txt` is served from the publisher id, and the Content-Security-Policy gains the Google domains AdSense needs.

For visitors in the EEA, the UK and Switzerland, personalised ads need a Google-certified consent platform. Turn on Google's consent message under **Privacy & messaging** in your AdSense account. It works alongside this banner.

## Deployment (Vercel)

The site is deployed to [Vercel](https://vercel.com). It needs no special configuration: Vercel detects Next.js, uses Yarn from `yarn.lock` and picks the Node version from `engines` in `package.json`.

1. Import the GitHub repository in Vercel.
2. Under **Settings > Environment Variables**, add the values from `.env.example` for Production (and Preview if you want ads off there):
   `NEXT_PUBLIC_SITE_URL` (your real address, no trailing slash), `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, and, when you use AdSense, `NEXT_PUBLIC_ADSENSE_CLIENT` and the slot ids.
3. Deploy. These variables are baked in at build time, so **redeploy after changing any of them**.
4. Add your domain under **Settings > Domains** and set `NEXT_PUBLIC_SITE_URL` to it.

What ships with the app, with nothing to set up on Vercel: security headers including a Content-Security-Policy (which allows only this site, plus the Google domains when ads are configured), Open Graph and Twitter cards, a favicon, a web manifest, `robots.txt`, `sitemap.xml`, JSON-LD, `/ads.txt` (from the publisher id) and `/api/health`.

### Before you go live
- Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL`, then read `/privacy` and `/accessibility`. They describe this app as it is; have them reviewed for your jurisdiction.
- Add your site to AdSense, finish its verification, and turn on Google's consent message.
- Work through [docs/manual-testing.md](docs/manual-testing.md).

## Project layout

```
app/              App Router: layout, page, policies, metadata files, error pages, /ads.txt, /api/health
components/       Game, book builder, preview, theme, consent and ad components
e2e/              Playwright browser tests
lib/sudoku.ts     Generator (level-targeted, seedable) and solver
lib/logic.ts      Human-style solver: grading and hints
lib/game.ts       Game state, undo, notes, saving, daily puzzle, share links
lib/stats.ts      Statistics and streaks
lib/rng.ts        Seeded random numbers
lib/bookCode.ts   Book codes (seed and counts)
lib/themes.ts     Ten themes in light and dark, built to meet WCAG AA
lib/uiTheme.ts    CSS variables for the UI, plus the contrast audit
lib/pdf/          Tagged PDF toolkit, book generator, scripts and board PDFs
lib/book.worker.ts, lib/bookClient.ts   Book generation off the main thread, with fallback
lib/export.ts     PNG, JPG and PDF export of single boards
public/fonts/     Inter and Source Serif 4 (SIL Open Font License), embedded in PDFs
tests/            Vitest suite
docs/             Manual testing guide
```

## Accessibility

The target is WCAG 2.2 AA. Text colours are generated so that they meet 4.5:1 against every surface they sit on, in every theme and in both modes, and `yarn test` and `yarn audit:contrast` fail if any pair drops below it. See the in-app accessibility statement for what has and has not been verified.

## Fonts and licences

The code is MIT licensed. Inter and Source Serif 4 are used under the SIL Open Font License; their licences are in `public/fonts/`.
