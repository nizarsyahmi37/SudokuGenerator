import type { Page } from '@playwright/test';

/** Starts every test with a clean browser state and effects off (the 3D backdrop is slow in CI). */
export async function fresh(page: Page, prefs: Record<string, string> = {}) {
    await page.addInitScript((p) => {
        if (!sessionStorage.getItem('__seeded')) {
            localStorage.clear();
            localStorage.setItem('sudoku-effects', 'off');
            for (const [k, v] of Object.entries(p)) localStorage.setItem(k, v);
            sessionStorage.setItem('__seeded', '1');
        }
    }, prefs);
}

export const cells = (page: Page) => page.getByRole('gridcell');
export const emptyCellIndex = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[role=gridcell]')].findIndex((c) => (c.getAttribute('aria-label') ?? '').includes('empty')));
export const playTab = (page: Page) => page.getByRole('tab', { name: 'Play' });
export const bookTab = (page: Page) => page.getByRole('tab', { name: 'Make a book' });
