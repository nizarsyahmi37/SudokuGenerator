import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

// The AdSense network is never reached: every request to Google is aborted, like an ad blocker would.
test.beforeEach(async ({ page }) => {
    await page.route(/googlesyndication|doubleclick|googleadservices|fundingchoices/, (r) => r.abort());
    await fresh(page);
});

const adScript = (page: Page) => page.locator('script[src*="adsbygoogle"]');
const banner = (page: Page) => page.getByRole('region', { name: 'Ads and your privacy' });

test('first visit asks before loading anything, and the page works while the question is open', async ({ page }) => {
    await page.goto('/');
    await expect(banner(page)).toBeVisible();
    await expect(adScript(page)).toHaveCount(0);
    await expect(page.locator('.ad')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Allow ads' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Non-personalised ads only' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No ads' })).toBeVisible();
    await page.getByRole('gridcell').first().click();
    await page.keyboard.press('3');
});

test('"No ads" loads nothing and is remembered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'No ads' }).click();
    await expect(banner(page)).toBeHidden();
    await expect(adScript(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sudoku-consent'))).toContain('essential');
    await page.reload();
    await expect(banner(page)).toBeHidden();
    await expect(adScript(page)).toHaveCount(0);
});

test('"Non-personalised ads only" loads the script with the non-personalised flag', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Non-personalised ads only' }).click();
    await expect(adScript(page)).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { adsbygoogle: { requestNonPersonalizedAds: number } }).adsbygoogle.requestNonPersonalizedAds)).toBe(1);
});

test('"Allow ads" asks for personalised ads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Allow ads' }).click();
    await expect(adScript(page)).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { adsbygoogle: { requestNonPersonalizedAds: number } }).adsbygoogle.requestNonPersonalizedAds)).toBe(0);
});

test('a slot stays collapsed until an ad is filled, shows when filled and is removed when unfilled', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Allow ads' }).click();
    const slot = page.locator('.ad').first();
    await expect(slot).toHaveAttribute('data-state', 'pending');
    expect((await slot.boundingBox())?.height ?? 0).toBeLessThan(2); // blocked network: nothing to show, no empty box
    // Both placements (play and book) are mounted, so report the status on every slot.
    await page.evaluate(() => document.querySelectorAll('ins.adsbygoogle').forEach((i) => i.setAttribute('data-ad-status', 'filled')));
    await expect(slot).toHaveAttribute('data-state', 'filled');
    await expect(page.getByRole('complementary', { name: 'Advertisement' }).first()).toBeVisible();
    await page.evaluate(() => document.querySelectorAll('ins.adsbygoogle').forEach((i) => i.setAttribute('data-ad-status', 'unfilled')));
    await expect(page.locator('.ad')).toHaveCount(0);
});

test('Privacy choices reopens the banner, and withdrawing consent reloads without ad code', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Allow ads' }).click();
    await expect(adScript(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Privacy choices' }).click();
    await expect(banner(page)).toBeVisible();
    await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: 'No ads' }).click()]);
    await expect(adScript(page)).toHaveCount(0);
});

test('ads.txt is served from the publisher id and the policy describes advertising', async ({ page, request }) => {
    const ads = await request.get('/ads.txt');
    expect(await ads.text()).toContain('pub-0000000000000000, DIRECT');
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Advertising' })).toBeVisible();
    await expect(page.getByText('No ad script is loaded')).toBeVisible();
    await expect(page.getByRole('link', { name: 'privacy@example.test' }).first()).toBeVisible();
    expect(await request.get('/')).toBeTruthy();
});

test('the production CSP allows the AdSense domains when ads are configured', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'];
    expect(csp).toContain('https://pagead2.googlesyndication.com');
    expect(csp).toContain('frame-src https://');
});
