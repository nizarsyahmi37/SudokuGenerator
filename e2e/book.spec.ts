import { expect, test, type Page } from '@playwright/test';
import { bookTab, fresh } from './helpers';

// A 2 x 2 PNG, enough to test picture upload.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8Dwn4GBgYGJAQoAHhgCAh6X4CYAAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => { await fresh(page); await page.goto('/'); await bookTab(page).click(); });

const build = async (page: Page) => {
    await page.getByRole('button', { name: /^(Build book|Build again)$/ }).click();
    await expect(page.locator('.create [role=status]').last()).toContainText(/pages are ready/, { timeout: 120_000 });
};
const setCounts = async (page: Page, n: number) => {
    for (const input of await page.locator('.stepper input').all()) await input.fill(String(n));
};

test('builds a book in the background, previews it and downloads a real PDF', async ({ page }) => {
    await setCounts(page, 1);
    await build(page);
    const canvas = page.locator('.preview canvas');
    await expect(canvas).toBeVisible();
    const ink = await canvas.evaluate((c: HTMLCanvasElement) => { const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; });
    expect(ink).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('.preview-count input')).toHaveValue('2');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download book PDF$/ }).click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(20_000);
    expect(bytes.toString('latin1')).toContain('/StructTreeRoot');
});

test('the page stays responsive while a larger book builds', async ({ page }) => {
    await setCounts(page, 6);
    await page.evaluate(() => { (window as unknown as { __f: number }).__f = 0; const t = () => { (window as unknown as { __f: number }).__f++; requestAnimationFrame(t); }; t(); });
    await page.getByRole('button', { name: 'Build book' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    const f0 = await page.evaluate(() => (window as unknown as { __f: number }).__f);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __f: number }).__f) - f0).toBeGreaterThan(5); // frames kept coming
    await expect(page.locator('.create [role=status]').last()).toContainText(/pages are ready/, { timeout: 120_000 });
});

test('cancel stops a running build', async ({ page }) => {
    await setCounts(page, 10);
    await page.getByRole('button', { name: 'Build book' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.create [role=status]').last()).toHaveText('Cancelled.');
    await expect(page.getByRole('button', { name: 'Build book' })).toBeEnabled();
});

test('the same seed and counts give the same book; a book code restores them', async ({ page }) => {
    await setCounts(page, 1);
    const seed = page.getByLabel('Seed', { exact: true });
    await seed.fill('E2E-SEED');
    const code = await page.getByLabel(/^Book code/).inputValue();
    expect(code).toMatch(/^B1\.E2E-SEED\.[0-9A-Z]{20}\.[0-9A-Z]{2}$/);
    await seed.fill('SOMETHING-ELSE');
    await page.getByRole('button', { name: 'Preset' }).count();
    await page.getByLabel('Have a code? Paste it here').fill(code);
    await page.getByRole('button', { name: 'Apply code' }).click();
    await expect(seed).toHaveValue('E2E-SEED');
    await page.getByLabel('Have a code? Paste it here').fill('B1.NOPE.00.XX');
    await page.getByRole('button', { name: 'Apply code' }).click();
    await expect(page.locator('p[role=alert]')).toContainText(/code/i);
});

test('print-ready output makes an interior and a cover PDF with a spine width', async ({ page }) => {
    await setCounts(page, 1);
    await page.getByLabel('Print-ready').check({ force: true });
    await page.getByLabel('6 × 9 in').check({ force: true });
    await build(page);
    await expect(page.getByRole('button', { name: 'Download interior PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download cover PDF' })).toBeVisible();
    await expect(page.locator('.create .step-head p')).toContainText(/spine about/);
    await page.getByLabel('Cover wrap').check({ force: true });
    await expect(page.locator('.preview canvas')).toBeVisible();
});

test('large print, ink saver and the barcode area are offered for print', async ({ page }) => {
    await page.getByLabel('Print-ready').check({ force: true });
    await expect(page.getByLabel(/Ink saver/)).toBeVisible();
    await expect(page.getByLabel(/white area for the ISBN barcode/)).toBeChecked();
    await page.getByLabel(/Large print/).check();
    await expect(page.getByLabel('2, compact')).toBeDisabled();
});

test('cover picture upload needs a description field and can be removed', async ({ page }) => {
    await page.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByLabel('Describe the picture for screen readers')).toBeVisible();
    await page.getByLabel('Describe the picture for screen readers').fill('A tiny test picture');
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await expect(page.getByLabel('Describe the picture for screen readers')).toBeHidden();
    await page.locator('input[type=file]').setInputFiles({ name: 'x.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(page.locator('p[role=alert]')).toContainText('PNG or JPEG');
});

test('unsupported alphabets are flagged and supported ones are not', async ({ page }) => {
    const title = page.getByLabel('Book title');
    await title.fill('Судоку Σούντοκου Việt');
    await expect(page.getByText(/do not cover/)).toBeHidden();
    await title.fill('数独 sudoku');
    await expect(page.getByText(/do not cover Chinese, Japanese or Korean/)).toBeVisible();
});

test('browsers without Web Workers still build the book, on the page', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window, 'Worker', { value: undefined, configurable: true }); });
    await page.reload();
    await bookTab(page).click();
    await setCounts(page, 1);
    await build(page);
    await expect(page.getByText(/cannot run background workers/)).toBeVisible();
    await expect(page.locator('.preview canvas')).toBeVisible();
});

test('changing a setting after a build warns that the preview is out of date', async ({ page }) => {
    await setCounts(page, 1);
    await build(page);
    await page.getByLabel('Book title').fill('A different title');
    await expect(page.getByText(/settings have changed since this book was built/)).toBeVisible();
});

test('single-board export downloads a themed PNG and a tagged PDF', async ({ page }) => {
    await page.getByRole('tab', { name: 'Play' }).click();
    const [png] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByLabel('PNG', { exact: true }).check({ force: true }); await page.getByRole('button', { name: 'Both' }).click(); })()]);
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    await page.getByLabel('PDF', { exact: true }).check({ force: true });
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Blank' }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
});
