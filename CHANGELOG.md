# Changelog

All notable changes to this project are recorded here. Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) in the form `type(scope): summary`, and this file follows the grouping of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project has not been tagged yet, so everything is under Unreleased.

## Scopes

| Scope | Covers |
| --- | --- |
| `generator` | Sudoku generator, solver and difficulty levels |
| `rng` | Seeded random numbers and repeatable output |
| `book` | Puzzle book configuration, generator, worker, preview and builder UI |
| `pdf` | Tagged PDF toolkit and embedded fonts |
| `export` | Single-board PDF, PNG and JPG export |
| `theme` | Palettes, light and dark mode, theme settings |
| `effects` | Three.js backgrounds and Phaser particles |
| `game` | The playable board and its controls |
| `ui` | Global styling |
| `app` | Next.js App Router structure |
| `ads` | AdSense slot |
| `consent` | Consent banner and ad loading rules |
| `legal` | Privacy policy, accessibility statement and footer |
| `lint`, `ci`, `git`, `deps`, `project`, `repo` | Tooling, workflow and repository housekeeping |
| `core` | Test suite across modules |
| `readme`, `changelog` | Documentation |

## [Unreleased]

### Features

- **legal:** add privacy and cookie policy, accessibility statement and footer ([`ee4889b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/ee4889bf4c706f2ae3141560da9538e0125c3c7c))
- **consent:** ask before loading ads and respect the choice ([`2981c3f`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/2981c3f136d69aa022ead99e01ba3cf0e6fd657f))
- **export:** theme single-board PNG, JPG and PDF exports ([`85f9f55`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/85f9f55caf7646663b03aa0e0cd3c57d6c427c4c))
- **book:** add print, large print, seed and copyright options to the builder ([`7392378`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/7392378faf1adde5c5939e21b85848b8530a460f))
- **book:** preview books page by page before downloading ([`6d16ab5`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/6d16ab50b58518959af1035b14b5eb02df4b0b15))
- **book:** build books in a web worker ([`8b7350b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/8b7350b9602a5f2fff908f43836ca1b31e4ed137))
- **book:** add print-ready, large print and seeded book generator ([`6d58822`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/6d58822096df7e1b08c261d6884733214a2ba409))
- **pdf:** add tagged PDF toolkit with embedded fonts ([`52d6ca9`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/52d6ca9cc0ca773f14cf0e4cd3583c93b73333c0))
- **book:** add book configuration for trim sizes, bleed and spine width ([`8efb907`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/8efb907d363ab9a19ece11f1eada3a2a7bbaddeb))
- **rng:** add seeded random generation for repeatable puzzles ([`ed06a1e`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/ed06a1e2c448070733a96f7a3a43cb525afb7527))
- **game:** add playable board with keyboard and screen reader support ([`02987b5`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/02987b5e831382ae7f8509ec040307d6e5dc685d))
- **ads:** add AdSense slot that only renders when an ad is filled ([`76b2944`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/76b2944d2c23af7971df4967355e5046f2447606))
- **book:** add book builder interface ([`866b943`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/866b943e59fb1587a9304017c3a121acd26017d0))
- **effects:** add themed Three.js backgrounds and Phaser particles ([`edede48`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/edede481d326b85efbe55b09b30ba0ec5fecd86a))
- **theme:** add theme provider and display settings ([`bd4ff74`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/bd4ff7442cb4c2d3bc1e8139caca75f3b8d5786d))
- **book:** add themed puzzle book PDF generator ([`d3fdb70`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/d3fdb706b0e01b2a9c8be6dc01a3fa137c3c91b7))
- **theme:** add WCAG-checked palette engine with light and dark modes ([`b5397c0`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/b5397c06a972588c9b4fdb1f697e8b698875837d))
- **export:** add PDF, PNG and JPG export for single boards ([`810d52b`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/810d52b079423c1c06994dbd07e1a956c85ac541))
- **generator:** add sudoku generator, solver and ten difficulty levels ([`a7dbaaf`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/a7dbaaf3928dda2390598217beb68574d8d1b300))

### Refactoring

- **lint:** resolve React Hooks and typing violations ([`f4a077c`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/f4a077c9e4c98fce56ec15da71d720b241358b3a))
- **app:** migrate from Pages Router to App Router ([`879eef4`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/879eef427e38d113c459b40bbf3e698456140938))

### Styling

- **ui:** add responsive light and dark styling ([`43420e1`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/43420e1b540cd4eb7421fbeac94eb88eb8487f72))

### Tests

- **core:** add Vitest suite for generator, seeding, contrast and books ([`f6cacb1`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/f6cacb1ff6ccf3b5542ceaf858709a4b320748f7))

### Continuous integration

- **github:** run lint, typecheck, tests and build on every push ([`5e8bc53`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/5e8bc531c963228fdc992bd502982f14840019e4))

### Chores

- **git:** ignore env files, normalise line endings and mark the package private ([`4f527cc`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/4f527cc9d37952981b14336ba41db1f590f2fb84))
- **lint:** add ESLint flat config and replace the removed next lint ([`22cc7fc`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/22cc7fc2dccf0bae584685b244016d48c270d707))
- **deps:** upgrade Next.js, React and TypeScript to latest ([`4edfc38`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/4edfc3836fb87a2f3b159d5d289c3317db77d5cd))

### Documentation

- **readme:** document features, scripts, configuration and ads ([`e19e383`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/e19e3830fb4d20f82d6b09e6d0d780cfaf22cec0))

## Initial scaffolding (April 2023)

- 2023-04-12 **chore(repo):** initial commit ([`d0a3f96`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/d0a3f966c56d6a4efaff130644fc6210ee6dffdf))
- 2023-04-12 **chore(project):** scaffold Next.js TypeScript base project ([`db715e2`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/db715e259232de6156bd967f10e778459c94cb96))
- 2023-04-13 **chore(project):** update package metadata and tsconfig formatting ([`1d63743`](https://github.com/nizarsyahmi37/SudokuGenerator/commit/1d637432316e87a33e379b53a6c95aa7d2d18392))
