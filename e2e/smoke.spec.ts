import { expect, test } from '@playwright/test';
import { bookTab, fresh, playTab } from './helpers';

test.beforeEach(async ({ page }) => { await fresh(page); });

test('home page loads with a title, landmarks and a playable board', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sudoku/);
    await expect(page.getByRole('heading', { level: 1, name: 'SUDOKU' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('grid')).toBeVisible();
    await expect(page.getByRole('gridcell')).toHaveCount(81);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('tabs switch between play and the book builder', async ({ page }) => {
    await page.goto('/');
    await bookTab(page).click();
    await expect(page.getByRole('heading', { name: 'Choose your puzzles' })).toBeVisible();
    await expect(page.getByRole('grid')).toBeHidden();
    await playTab(page).click();
    await expect(page.getByRole('grid')).toBeVisible();
});

test('footer links open the policy pages, each with one heading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Privacy and cookies' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByText('no advertising is currently shown')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the game' }).click();
    await page.getByRole('link', { name: 'Accessibility' }).click();
    await expect(page).toHaveURL(/\/accessibility$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Accessibility statement' })).toBeVisible();
});

test('unknown pages get the styled 404', async ({ page }) => {
    const res = await page.goto('/definitely-not-here');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the game' })).toBeVisible();
});

test('search and social metadata are in place', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /sudoku/i);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    expect((await request.get('/robots.txt')).ok()).toBe(true);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/privacy');
    expect((await request.get('/manifest.webmanifest')).ok()).toBe(true);
    const og = await request.get('/opengraph-image');
    expect(og.headers()['content-type']).toContain('image/png');
    expect((await request.get('/api/health')).ok()).toBe(true);
});

test('security headers are sent and ads.txt is absent without ads', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['content-security-policy']).not.toContain('googlesyndication');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['strict-transport-security']).toContain('max-age');
    expect(h['x-powered-by']).toBeUndefined();
    expect((await request.get('/ads.txt')).status()).toBe(404);
});

test('no console errors or CSP violations while loading and playing', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', (e) => problems.push(String(e)));
    await page.goto('/');
    await page.getByRole('gridcell').first().click();
    await page.keyboard.press('5');
    await page.getByRole('tab', { name: 'Make a book' }).click();
    expect(problems).toEqual([]);
});

test('the app opens again without a connection after a first visit', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('gridcell')).toHaveCount(81);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // The worker saves what the page loaded a moment after it settles: wait until every script the page used is in the cache.
    await expect.poll(() => page.evaluate(async () => {
        const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin) && /\/_next\/static\/.*\.(js|css)/.test(u));
        const cache = await caches.open('sudoku-offline-v1');
        const hits = await Promise.all(urls.map((u) => cache.match(u)));
        return urls.length > 3 && hits.every(Boolean);
    }), { timeout: 30_000 }).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('gridcell')).toHaveCount(81);
    await expect(page.getByRole('heading', { name: 'SUDOKU' })).toBeVisible();
    await context.setOffline(false);
});

test('the interface can be switched to Arabic: right to left, with the board still read left to right', async ({ page }) => {
    await page.goto('/');
    await page.locator('summary', { hasText: 'Display settings' }).click();
    await page.getByLabel('Language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('tab', { name: 'العب' })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('button', { name: 'تلميح', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); // remembered
    await expect(page.getByRole('tab', { name: 'العب' })).toBeVisible();
});

test.describe('first visit follows the browser language', () => {
    test.use({ locale: 'ms-MY' });
    test('Malay', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('tab', { name: 'Main' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'ms');
        await expect(page.getByRole('button', { name: 'Permainan baharu', exact: true })).toBeVisible();
    });
});
