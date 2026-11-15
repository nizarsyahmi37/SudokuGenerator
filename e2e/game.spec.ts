import { expect, test } from '@playwright/test';
import { cells, emptyCellIndex, fresh } from './helpers';

test.beforeEach(async ({ page }) => { await fresh(page); await page.goto('/'); await expect(cells(page)).toHaveCount(81); });

const timer = (page: import('@playwright/test').Page) => page.locator('[role=timer]');
const code = (page: import('@playwright/test').Page) => page.locator('.code b');

test('the timer only starts when the board is first touched', async ({ page }) => {
    await page.waitForTimeout(2500);
    await expect(timer(page)).toHaveText('00:00');
    await cells(page).first().click();
    await expect(timer(page)).not.toHaveText('00:00', { timeout: 5000 });
});

test('progress is saved and the same puzzle comes back after a reload', async ({ page }) => {
    const seed = await code(page).textContent();
    const i = await emptyCellIndex(page);
    await cells(page).nth(i).focus();
    await page.keyboard.press('6');
    await page.reload();
    await expect(code(page)).toHaveText(seed!);
    await expect(cells(page).nth(i)).toHaveAttribute('aria-label', /, 6(,|$)/);
    await expect(page.locator('.board-panel [role=status]')).toContainText('restored');
});

test('a share link reopens exactly the same puzzle', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
    const clues = () => page.evaluate(() => [...document.querySelectorAll('[role=gridcell]')].map((c) => ((c.getAttribute('aria-label') ?? '').includes('clue') ? c.textContent?.trim() : '.')).join(''));
    const before = await clues();
    const seed = await code(page).textContent();
    const level = await page.locator('.lvl-pill').textContent();
    await page.getByRole('button', { name: 'Share puzzle' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    const url = link || `/?seed=${seed}&level=${/Level (\d+)/.exec(level ?? '')![1]}`;
    await page.evaluate(() => localStorage.removeItem('sudoku-game-v1'));
    await page.goto(url.replace(/^https?:\/\/[^/]+/, ''));
    await expect(code(page)).toHaveText(seed!);
    expect(await clues()).toBe(before);
    await expect(page.locator('.board-panel [role=status]')).toContainText('shared puzzle');
    await expect(page).toHaveURL(/\/$/); // the query is cleaned up so a refresh resumes instead of reloading the link
});

test('invalid share links are ignored', async ({ page }) => {
    await page.goto('/?seed=%3Cscript%3E&level=99');
    await expect(cells(page)).toHaveCount(81);
    await expect(page.locator('.board-panel [role=status]')).not.toContainText('shared');
});

test('the daily puzzle is the same for everyone', async ({ page, browser }) => {
    await page.getByRole('button', { name: /^Daily puzzle/ }).click();
    await expect(code(page)).toContainText('DAILY-');
    const first = await page.evaluate(() => [...document.querySelectorAll('[role=gridcell]')].map((c) => c.getAttribute('aria-label')).join('|'));
    const other = await browser.newPage();
    await fresh(other);
    await other.goto(page.url());
    await other.getByRole('button', { name: /^Daily puzzle/ }).click();
    expect(await other.evaluate(() => [...document.querySelectorAll('[role=gridcell]')].map((c) => c.getAttribute('aria-label')).join('|'))).toBe(first);
    await other.close();
});

test('hints explain the technique in words, highlight cells and can be applied', async ({ page }) => {
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    const card = page.locator('.hint-card');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toContainText(/Hint:/);
    await expect(card).toContainText(/can only be|fits in only one cell|can only go|can only hold|only fit/);
    await expect(page.locator('.cell.hint-target')).toHaveCount(1);
    await card.getByRole('button', { name: /^Place \d in r\dc\d$/ }).click();
    await expect(card).toBeHidden();
    await expect(page.locator('.board-panel [role=status]')).toContainText(/^Placed \d in/);
});

test('a hint points at a wrong digit instead of building on it', async ({ page }) => {
    const i = await emptyCellIndex(page);
    await cells(page).nth(i).focus();
    // Try digits until one is wrong (the mistakes counter goes up).
    for (let d = 1; d <= 9; d++) {
        await page.keyboard.press(String(d));
        if (/1 mistake/.test((await page.locator('.code').textContent()) ?? '')) break;
    }
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('.board-panel [role=status]')).toContainText(/first: the digit there is not right/);
    await expect(page.locator('.cell.wrong')).toHaveCount(1);
});

test('solving a puzzle shows the win, records statistics and stops the clock', async ({ page }) => {
    await page.getByRole('button', { name: /^Level 1,/ }).click();
    await cells(page).first().click();
    for (let n = 0; n < 90; n++) {
        const status = await page.locator('.board-panel [role=status]').textContent();
        if (status?.includes('Solved')) break;
        await page.getByRole('button', { name: 'Hint', exact: true }).click();
        await page.locator('.hint-card').getByRole('button', { name: /^Place/ }).click();
    }
    await expect(page.locator('.board-panel [role=status]')).toContainText('Solved! Well done.');
    await page.getByText('Your statistics').click();
    await expect(page.locator('details p.hint').first()).toContainText('1 of 1 started games solved');
    const t = await timer(page).textContent();
    await page.waitForTimeout(2200);
    await expect(timer(page)).toHaveText(t!);
});

test('statistics can be reset', async ({ page }) => {
    await page.getByText('Your statistics').click();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reset statistics' }).click();
    await expect(page.locator('details p.hint').first()).toContainText('0 of 0 started games solved');
});

test('level choices describe the technique they need', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Level 1, Beginner, Naked singles only/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Level 7, Hard, XY-Wing/ })).toBeVisible();
});

test('pausing stops the clock, hides the board and resumes where it left off', async ({ page }) => {
    const pause = page.getByRole('button', { name: 'Pause' });
    await expect(pause).toBeDisabled(); // nothing to pause before the first touch
    await cells(page).first().click();
    await expect(timer(page)).not.toHaveText('00:00', { timeout: 5000 });
    await pause.click();
    await expect(page.getByRole('region', { name: 'Game paused' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Game paused' }).getByRole('button', { name: 'Resume' })).toBeFocused();
    const frozen = await timer(page).textContent();
    await page.waitForTimeout(2200);
    await expect(timer(page)).toHaveText(frozen!);
    await page.getByRole('region', { name: 'Game paused' }).getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('region', { name: 'Game paused' })).toHaveCount(0);
    await expect(timer(page)).not.toHaveText(frozen!, { timeout: 5000 });
});

test('a hidden tab pauses the game', async ({ page }) => {
    await cells(page).first().click();
    await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('region', { name: 'Game paused' })).toBeVisible();
});

test('progress can be saved to a file and opened in another browser', async ({ page, browser }) => {
    const seed = await code(page).textContent();
    const i = await emptyCellIndex(page);
    await cells(page).nth(i).focus();
    await page.keyboard.press('4');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save to file' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^sudoku-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();

    const other = await browser.newPage();
    await fresh(other);
    await other.goto('/');
    await expect(cells(other)).toHaveCount(81);
    await other.locator('.file-btn input').setInputFiles(path);
    await expect(other.locator('.board-panel [role=status]')).toContainText('Progress imported');
    await expect(other.locator('.code b')).toHaveText(seed!);
    await expect(cells(other).nth(i)).toHaveAttribute('aria-label', /, 4(,|$)/);
    await other.close();
});

test('a file that is not a backup is refused', async ({ page }) => {
    await page.locator('.file-btn input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await expect(page.locator('.board-panel [role=status]')).toContainText('not a backup');
});
