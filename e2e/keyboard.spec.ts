import { expect, test } from '@playwright/test';
import { cells, emptyCellIndex, fresh } from './helpers';

test.beforeEach(async ({ page }) => { await fresh(page); await page.goto('/'); await expect(cells(page)).toHaveCount(81); });

test('skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
});

test('arrow keys move around the board and focus stays on the grid', async ({ page }) => {
    await cells(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(cells(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cells(page).nth(10)).toBeFocused();
    await page.keyboard.press('End');
    await expect(cells(page).nth(17)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(cells(page).nth(9)).toBeFocused();
    await page.keyboard.press('PageUp');
    await expect(cells(page).nth(0)).toBeFocused();
});

test('typing a digit fills the cell and keeps focus there; Backspace erases', async ({ page }) => {
    const i = await emptyCellIndex(page);
    const cell = cells(page).nth(i);
    await cell.focus();
    await page.keyboard.press('7');
    await expect(cell).toHaveAttribute('aria-label', /, 7(,|$)/);
    await expect(cell).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(cell).toHaveAttribute('aria-label', /empty/);
});

test('N toggles pencil notes; undo and redo with Ctrl+Z and Ctrl+Y', async ({ page }) => {
    const i = await emptyCellIndex(page);
    const cell = cells(page).nth(i);
    await cell.focus();
    await page.keyboard.press('n');
    await expect(page.getByRole('button', { name: /^Notes on$/ })).toBeVisible();
    await page.keyboard.press('3');
    await page.keyboard.press('5');
    await expect(cell).toHaveAttribute('aria-label', /notes 3 5/);
    await page.keyboard.press('Control+z');
    await expect(cell).toHaveAttribute('aria-label', /notes 3(?! 5)/);
    await page.keyboard.press('Control+y');
    await expect(cell).toHaveAttribute('aria-label', /notes 3 5/);
});

test('tabs follow the ARIA pattern: arrows move, only the selected tab is a tab stop', async ({ page }) => {
    const play = page.getByRole('tab', { name: 'Play' });
    const book = page.getByRole('tab', { name: 'Make a book' });
    await play.focus();
    await expect(book).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('ArrowRight');
    await expect(book).toBeFocused();
    await expect(book).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(play).toBeFocused();
});

test('keyboard focus is always visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Hint', exact: true }).focus();
    const outline = await page.getByRole('button', { name: 'Hint', exact: true }).evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
    expect(outline).toMatch(/solid 3px/);
});

test('the number pad can be used without a mouse', async ({ page }) => {
    const i = await emptyCellIndex(page);
    await cells(page).nth(i).focus();
    await page.getByRole('button', { name: /^4, \d+ left to place$/ }).focus();
    await page.keyboard.press('Enter');
    await expect(cells(page).nth(i)).toHaveAttribute('aria-label', /, 4(,|$)/);
});
