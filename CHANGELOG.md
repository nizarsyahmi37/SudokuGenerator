# Changelog

All notable changes to this project are recorded here. Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) in the form `type(scope): summary`, and this file follows the grouping of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project has not been tagged yet, so everything is under Unreleased.

## Scopes

| Scope | Covers |
| --- | --- |
| `generator` | Sudoku generator, solver, grading and levels |
| `rng` | Seeded random numbers and repeatable output |
| `book` | Puzzle book configuration, generator, worker, preview, builder UI, covers and codes |
| `pdf` | Tagged PDF toolkit, embedded fonts and alphabets |
| `export` | Single-board PDF, PNG and JPG export |
| `theme` | Palettes, light and dark mode, theme settings |
| `effects` | Three.js backgrounds and Phaser particles |
| `game` | The playable board, hints, notes, saving, daily puzzle, sharing and statistics |
| `ui` | Global styling |
| `app` | Next.js App Router structure, error pages and health check |
| `ads` | AdSense slot |
| `consent` | Consent banner and ad loading rules |
| `legal` | Privacy policy, accessibility statement and footer |
| `seo` | Metadata, social cards, icons, manifest, robots and sitemap |
| `security` | Security headers and Content-Security-Policy |
| `a11y` | Accessibility audits |
| `e2e` | Playwright browser tests |
| `core` | Unit tests across modules |
| `lint`, `ci`, `git`, `deps`, `project`, `repo` | Tooling, workflow and repository housekeeping |
| `readme`, `changelog`, `testing` | Documentation |

## [Unreleased]

### Features

- **app:** add styled 404 and error pages and a health check ([`9b62c75`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/9b62c7562841bafd4155021fcef8eb102e5b76d6))
- **security:** add security headers and a Content-Security-Policy for AdSense ([`27f4954`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/27f495412c2da7dbf9a5eaa396938384e4855b43))
- **seo:** add metadata, social cards, icons, manifest, robots and sitemap ([`30fa957`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/30fa9579c1ff8214872abc3ef9fa2fd713160ac0))
- **book:** fall back to the main thread when Web Workers are unavailable ([`2961474`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/2961474cbc07c3d6c9d6e82ce14ed78e7853d3db))
- **pdf:** set text in Cyrillic, Greek, Vietnamese and Latin Extended ([`bb0f327`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/bb0f32799d78e90fa56f0a8b298787b2ba7bb69d))
- **book:** add shareable book codes that capture the seed and puzzle counts ([`dc0d8d5`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/dc0d8d56dbf160df69022ac68bf6dd83bc2b77b6))
- **book:** make the back cover barcode area optional ([`5dd3302`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/5dd3302b55263a5882454ef8af8d00c824ccad33))
- **book:** add a black-and-white ink-saving mode for print ([`07ed23d`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/07ed23d383f662367c11f90268e7dbf5b3c2c9c7))
- **book:** add cover options for subtitle, colours, picture and grid ([`b6add79`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/b6add7990e1c2aef7b18180e15e6406af329b25b))
- **game:** add save and resume, undo, notes, explained hints, daily puzzle, sharing and statistics ([`5453214`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/545321466264d7c25ce9cadff1ebd51715001c7b))
- **game:** add saveable game state with undo, redo, notes, daily puzzle and share links ([`5335924`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/5335924575ef2ae34a96c01496d7022c8aa3e0ce))
- **generator:** grade puzzles by solving technique, not clue count ([`567ee42`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/567ee427fa30e8ff367ec64f0b39750d03d8d9dc))
- **legal:** add privacy and cookie policy, accessibility statement and footer ([`470f08f`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/470f08f5e33e61576c70e3c808611c2f135a82ce))
- **consent:** ask before loading ads and respect the choice ([`102fa6b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/102fa6b9c6e88504f667a150a946a0c16eb91678))
- **export:** theme single-board PNG, JPG and PDF exports ([`3d42192`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/3d4219257b922371887b49a1eeef8cd0cd3ddeac))
- **book:** add print, large print, seed and copyright options to the builder ([`9e8dfe4`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/9e8dfe4503323a6ca0e97c01d6129a25eb34af23))
- **book:** preview books page by page before downloading ([`0b860a6`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/0b860a631606f50f89300fdbcc1d0a9ea1a627f8))
- **book:** build books in a web worker ([`cc04208`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/cc0420806132b90950bf8ba4bc8b741140d6ac41))
- **book:** add print-ready, large print and seeded book generator ([`e1451bf`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/e1451bf89b79f85f53db2e2ea19a7b8e00f41087))
- **pdf:** add tagged PDF toolkit with embedded fonts ([`126f6d0`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/126f6d054fbec4efa31c5d92d8d496710e771e72))
- **book:** add book configuration for trim sizes, bleed and spine width ([`3803faa`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/3803faadbb34e9ddf93aba014b2e68960b9e65cd))
- **rng:** add seeded random generation for repeatable puzzles ([`75b987c`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/75b987cb9d122d7f37d218327e2cc73ca40a35c8))
- **game:** add playable board with keyboard and screen reader support ([`9de32e1`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/9de32e1d44462dd8d62a22eecf47452c851842db))
- **ads:** add AdSense slot that only renders when an ad is filled ([`8130656`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/8130656973146a32907b685592d48fc7333c3b86))
- **book:** add book builder interface ([`f4c3e5e`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/f4c3e5e39230d6b8a82ffa21305538798809acd0))
- **effects:** add themed Three.js backgrounds and Phaser particles ([`b116bf5`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/b116bf57878e90c1b5b660f62c89df1bd693b480))
- **theme:** add theme provider and display settings ([`dae00c4`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/dae00c467e0cef363709a9fd5ef83b94a59f221f))
- **book:** add themed puzzle book PDF generator ([`521317c`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/521317c618a755cf689032d82931c2a2b7c59f72))
- **theme:** add WCAG-checked palette engine with light and dark modes ([`338c97b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/338c97b740334d7a722e6e043a57b1b6497d8f23))
- **export:** add PDF, PNG and JPG export for single boards ([`810d52b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/810d52b079423c1c06994dbd07e1a956c85ac541))
- **generator:** add sudoku generator, solver and ten difficulty levels ([`a7dbaaf`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/a7dbaaf3928dda2390598217beb68574d8d1b300))

### Bug fixes

- **effects:** mount the particle layer only while effects are on ([`db65fb9`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/db65fb9c5d54edf5cbe9ef454d429aac793c75ff))
- **ui:** use two columns for the tool buttons on narrow screens ([`fa5d048`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/fa5d048cb1ff838a0d90f61c3d067beefbd3b3d1))
- **theme:** pick the better of black or white when nudging colours on mid-tones ([`c3278a0`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/c3278a0c2cc8ddb1c20ac9fda1ce57dda101cfde))
- **effects:** stop overlapping sun layers from z-fighting ([`2e5a4f6`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/2e5a4f6b069cb59497b79f4ac823f479a1a9a344))
- **ui:** put the footer on an opaque panel ([`b60ed39`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/b60ed39cfb8360612031881aeb8eb20f444cbd41))
- **game:** start the timer on the first board interaction ([`ab15c60`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/ab15c60989d7c59d533ae3a3ef268a3b709ad955))

### Refactoring

- **lint:** resolve React Hooks and typing violations ([`0417d7f`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/0417d7faedd67c0406eb8ae93bedff4951efabcc))
- **app:** migrate from Pages Router to App Router ([`3b5d034`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/3b5d034690e879979bfb31c7298c1f40c6619647))

### Styling

- **ui:** add responsive light and dark styling ([`43d3f7c`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/43d3f7c13c2c267a4fae19a44f54f23947d4cfb5))

### Tests

- **e2e:** add Playwright browser tests that run against production builds ([`e32a4a2`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/e32a4a2ebf720702b0e79827f6db73dd2705f340))
- **a11y:** add a browser contrast audit for every theme and mode ([`c9de0f4`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/c9de0f4514f6f74ec238361327272955ef3d27c9))
- **core:** add Vitest suite for generator, seeding, contrast and books ([`36e6d5e`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/36e6d5e098a069c6232823dcf6b0ac2ed64945e3))

### Continuous integration

- **github:** add a weekly canary run on Ubuntu 26.04 ([`bc85228`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/bc852281aa4c1491f10c1322528061e96c15ef09))
- **github:** pin the runners to Ubuntu 24.04 ([`fee8610`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/fee8610fbb64fad598a0a7b1f29f285ae985f332))
- **github:** also run on ci branches and allow manual runs ([`ff3db66`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/ff3db66c5a826ed9e023310e2e0eef0865ec15c9))
- **github:** add a browser test job ([`37f8a1e`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/37f8a1ee44f3a8a17784b43ca55eb6dd13146370))
- **github:** run lint, typecheck, tests and build on every push ([`bc57bcd`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/bc57bcdf4ae66d63c642f0089ec9b91aaa32d985))

### Chores

- **git:** ignore env files, normalise line endings and mark the package private ([`beec339`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/beec339b98ac9406d7d00daf88147a087c535303))
- **lint:** add ESLint flat config and replace the removed next lint ([`7ccdfc9`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/7ccdfc98514231004425a580f3b706969a40e56b))
- **deps:** upgrade Next.js, React and TypeScript to latest ([`4edfc38`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/4edfc3836fb87a2f3b159d5d289c3317db77d5cd))

### Documentation

- **legal:** state the WCAG, ATAG and UAAG scope in the accessibility statement ([`3cc9f50`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/3cc9f50313287a4d96512648fef09df9d8cfc1b4))
- **readme:** document the new play and book features, testing and deployment ([`a3d3718`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/a3d3718b5db837417d22417be97cbbe0563c9105))
- **testing:** add a guide for the checks that need a person ([`d41bd5f`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/d41bd5f569a7d3fc829f45372432b14c7075ed1f))
- **legal:** describe the saved game and statistics in the policies ([`75b848a`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/75b848a8954b7aebeb7dc34c03aeb4f577965c66))
- **changelog:** add structured changelog ([`995af2e`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/995af2eaecc8770b13c8fdc44b263a45c3c65734))
- **readme:** document features, scripts, configuration and ads ([`e16ca8b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/e16ca8b70cea30ddd758ee0f17a37d71bc397c3c))

## Initial scaffolding (April 2023)

- 2023-04-12 **chore(repo):** initial commit ([`d0a3f96`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/d0a3f966c56d6a4efaff130644fc6210ee6dffdf))
- 2023-04-12 **chore(project):** scaffold Next.js TypeScript base project ([`db715e2`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/db715e259232de6156bd967f10e778459c94cb96))
- 2023-04-13 **chore(project):** update package metadata and tsconfig formatting ([`1d63743`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/1d637432316e87a33e379b53a6c95aa7d2d18392))
