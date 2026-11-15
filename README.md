# Sudoku

Play sudoku at ten difficulty levels, export puzzles, and turn them into a printable or digital puzzle book with a cover, solutions and an answer key. Everything runs in the browser: there are no accounts and no server-side storage.

## Features

- **Ten levels.** Every puzzle has exactly one solution. Levels run from 46 clues (Beginner) down to 22 (Master).
- **Play.** Keyboard and screen-reader friendly board, number pad that shows how many of each digit are left, hints, check, timer and automatic win detection.
- **Themes.** Ten themes, each in light and dark mode (or match your device), with a 3D Three.js backdrop and Phaser particle effects that you can turn off.
- **Book builder.** Choose how many puzzles of each level, page size, one or two puzzles per page, theme and paper. Solutions go at the back, four to a page.
  - **Print-ready.** Standard print-on-demand trim sizes, bleed (outer edges or all sides), optional crop marks, a separate cover wrap with a spine sized from the page count, and a copyright page.
  - **Large print.** Bigger type, one puzzle per page, two solutions per page.
  - **Repeatable.** The same seed, counts and settings always produce the same book. The seed is printed on the copyright page.
  - **Preview.** Check the book page by page before downloading.
  - **Fast.** Books are built in a Web Worker, so the page never freezes.
- **Single-board export.** PDF, PNG or JPG of the blank board, the solved board or both, in the current theme or plain black and white.
- **Accessible output.** PDFs are tagged, have a title, language, bookmarks, embedded fonts and a text description of every grid.

## Getting started

Requires Node.js 20.19 or newer and [Yarn 1](https://classic.yarnpkg.com/).

```bash
yarn install
yarn dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `yarn dev` | Start the development server |
| `yarn build` | Production build |
| `yarn start` | Serve the production build |
| `yarn lint` | ESLint (Next.js, React Hooks and TypeScript rules) |
| `yarn typecheck` | Type-check with TypeScript 7 |
| `yarn test` | Run the Vitest suite |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and a production build on every push to `main` and on every pull request.

> **TypeScript note.** `typescript` is aliased to `@typescript/typescript6` because typescript-eslint and Next.js still use the TypeScript 6 JavaScript API. TypeScript 7 is installed as `@typescript/native`, and `tsc` runs it.

## Configuration

Copy `.env.example` to `.env.local`. Every variable is optional, and `.env.local` is gitignored.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_OPERATOR_NAME` | Names shown in the footer and the policies |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address in the privacy policy and accessibility statement |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | AdSense publisher id (`ca-pub-…`). Leave empty for no ads |
| `NEXT_PUBLIC_ADSENSE_SLOT`, `_SLOT_PLAY`, `_SLOT_BOOK` | Ad unit ids |

### Ads and consent

With no AdSense id, no ad code is loaded and nothing about ads is shown. With one:

1. Visitors see a consent banner. **No ad script is loaded until they choose** "Allow ads" or "Non-personalised ads only". "No ads" loads nothing.
2. An ad slot stays collapsed until AdSense reports it as filled. If it is unfilled, blocked or fails to load, the slot is removed, so there is never an empty box.
3. **Privacy choices** in the footer re-opens the choice. Withdrawing consent reloads the page so no further ad requests are made.
4. `/ads.txt` is served from the publisher id.

For visitors in the EEA, the UK and Switzerland, personalised ads need a Google-certified consent platform. Turn on Google's consent message under **Privacy & messaging** in your AdSense account. It works alongside this banner.

### Before you go live

- Set `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL`, then read `/privacy` and `/accessibility`. They are written for this app as it is; have them reviewed for your jurisdiction.
- Add your site to AdSense and complete its verification.

## Project layout

```
app/              App Router: layout, page, /privacy, /accessibility, /ads.txt
components/       Game, book builder, preview, theme, consent and ad components
lib/sudoku.ts     Generator and solver (seedable)
lib/rng.ts        Seeded random numbers
lib/themes.ts     Ten themes in light and dark, built to meet WCAG AA
lib/uiTheme.ts    CSS variables for the UI, plus the contrast audit
lib/pdf/          Tagged PDF toolkit, book generator and board PDFs
lib/book.worker.ts, lib/bookClient.ts   Book generation off the main thread
lib/export.ts     PNG, JPG and PDF export of single boards
public/fonts/     Inter and Source Serif 4 (SIL Open Font License) embedded in PDFs
tests/            Vitest suite
```

## Accessibility

The target is WCAG 2.2 AA. Text colours are generated so that they meet 4.5:1 against every surface they sit on, in every theme and in both modes, and `yarn test` fails if any colour pair drops below it. See the in-app accessibility statement for what has and has not been verified.

## Fonts and licences

The code is MIT licensed. Inter and Source Serif 4 are used under the SIL Open Font License; their licences are in `public/fonts/`.
