# Contributing

Thanks for helping. This is a small project, so the rules are short.

## Set up

Requires Node.js 20.19 or newer and [Yarn 1](https://classic.yarnpkg.com/).

```bash
yarn install
yarn dev            # http://localhost:3000
```

Read the README's **Getting started** and **Project layout** sections first. This project uses a recent Next.js whose
conventions differ from older versions, so check `node_modules/next/dist/docs/` before changing routing, caching or headers.

## Before you open a pull request

Run all of these. CI runs them too.

```bash
yarn lint
yarn typecheck
yarn test
PW_CHANNEL=chrome yarn test:e2e     # browser tests; leave PW_CHANNEL out to use Playwright's own Chromium
```

- Add or update tests with the change. Logic goes in `tests/` (Vitest); anything a person sees or does goes in `e2e/` (Playwright).
- If you change colours, themes or CSS, run `yarn audit:contrast` while `yarn dev` is running. Text must stay at 4.5:1 or better in every theme and mode.
- Keep the interface usable by keyboard and screen reader (the target is WCAG 2.2 AA). Run the axe tests in `e2e/a11y.spec.ts` for new views.
- New visible text goes in `lib/i18n/en.ts` and in every other language file. The type checker fails if a language is missing a key.
- Do not add analytics, trackers or third-party scripts. The privacy page says there are none; changing that needs a change to the policy too.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with a scope, one feature or fix per commit:

```
feat(book): add optional puzzle names and notes pages
fix(game): keep the timer stopped while paused
docs(readme): describe the offline mode
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `ci`, `chore`, `build`. Common scopes: `game`, `book`, `pdf`,
`i18n`, `a11y`, `theme`, `pwa`, `security`, `ci`, `deps`. Describe what changed and why in the body when it is not obvious.
User-visible changes also get a line in [CHANGELOG.md](CHANGELOG.md) under **Unreleased**.

## Pull requests

- Keep each pull request to one change. Small ones are reviewed faster.
- Say what you changed, why, and how you checked it. Add a screenshot for visual changes, in light and dark mode.
- Be kind. Assume good faith.

## Reporting bugs and ideas

Use the issue templates. For a puzzle problem, include the puzzle code shown under the board (for example `Puzzle ABCD-1234`) and the
level. For a book problem, include the **book code** (`B1.…`) and the settings you used, so the exact book can be rebuilt.
Report security problems privately, as described in [SECURITY.md](SECURITY.md).
