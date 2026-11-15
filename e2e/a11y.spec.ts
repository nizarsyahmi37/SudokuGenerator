import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bookTab, cells, fresh } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const COMBOS: Array<[string, string]> = [['cosmos', 'dark'], ['forest', 'light'], ['desert', 'dark'], ['sakura', 'light'], ['classic', 'light'], ['cyber', 'dark'], ['candy', 'light'], ['arctic', 'dark']];

async function scan(page: Page) {
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    return r.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.html.slice(0, 120)}`);
}

for (const [theme, mode] of COMBOS) {
    test(`axe: no WCAG 2.2 AA violations (${theme}, ${mode})`, async ({ page }) => {
        await fresh(page, { 'sudoku-theme': theme, 'sudoku-mode': mode });
        await page.goto('/');
        await expect(cells(page)).toHaveCount(81);
        expect(await scan(page), 'play tab').toEqual([]);
        await page.getByText('Display settings').click();
        await page.getByText('Your statistics').click();
        expect(await scan(page), 'play tab with panels open').toEqual([]);
        await bookTab(page).click();
        await expect(page.getByRole('heading', { name: 'Choose your puzzles' })).toBeVisible();
        expect(await scan(page), 'book tab').toEqual([]);
        for (const path of ['/privacy', '/accessibility']) {
            await page.goto(path);
            expect(await scan(page), path).toEqual([]);
        }
    });
}

test('axe: hint card and notes in the board are accessible', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await cells(page).first().click();
    await page.keyboard.press('n');
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('.hint-card')).toBeVisible();
    expect(await scan(page)).toEqual([]);
});

test('the board is exposed as a grid of rows and cells with names', async ({ page }) => {
    await fresh(page);
    await page.goto('/');
    await expect(page.getByRole('grid')).toHaveAccessibleName(/Sudoku board/);
    await expect(page.getByRole('row')).toHaveCount(9);
    const labels = await cells(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels.every((l) => /^Row \d, column \d, (empty|\d)/.test(l ?? ''))).toBe(true);
});

test('reflow: no horizontal scrolling at 320 CSS pixels (400% zoom) on every view', async ({ page }) => {
    await fresh(page);
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/', '/privacy', '/accessibility']) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await page.goto('/');
    await bookTab(page).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('200% zoom: the main controls stay visible and usable', async ({ page }) => {
    await fresh(page);
    await page.setViewportSize({ width: 640, height: 450 }); // a 1280 x 900 window at 200%
    await page.goto('/');
    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('.hint-card')).toBeVisible();
});

test('text spacing overrides (WCAG 1.4.12) do not clip or hide content', async ({ page }) => {
    await fresh(page);
    await page.goto('/privacy');
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.goto('/');
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }' });
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
});

test('reduced motion and the effects switch stop animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-effects', 'off');
    await expect(page.locator('canvas')).toHaveCount(0);
});

test('light, dark and match-device modes apply to the page', async ({ page }) => {
    await fresh(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.getByText('Display settings').click();
    await page.getByLabel('Light', { exact: true }).check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await page.getByLabel('Match device').check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
});
