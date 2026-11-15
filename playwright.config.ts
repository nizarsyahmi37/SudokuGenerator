import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against production builds (so the real Content-Security-Policy applies):
 *   - port 3101: no ads configured
 *   - port 3102: AdSense configured with a placeholder id, to test the consent flow (the AdSense network is always blocked)
 * Locally, set PW_CHANNEL=chrome to use your installed Chrome instead of downloading Playwright's browser.
 */
const channel = process.env.PW_CHANNEL || undefined;
const NOADS = 'http://localhost:3101';
const ADS = 'http://localhost:3102';

export default defineConfig({
    testDir: 'e2e',
    outputDir: 'test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 90_000,
    expect: { timeout: 15_000 },
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: { channel, trace: 'on-first-retry', screenshot: 'only-on-failure' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, baseURL: NOADS }, testIgnore: /ads\.spec/ },
        { name: 'mobile', use: { ...devices['Pixel 7'], channel, baseURL: NOADS }, testMatch: /(smoke|a11y|game)\.spec/ },
        { name: 'ads', use: { ...devices['Desktop Chrome'], channel, baseURL: ADS }, testMatch: /ads\.spec/ },
    ],
    webServer: [
        {
            command: 'NEXT_DIST_DIR=.next-e2e-noads yarn build && NEXT_DIST_DIR=.next-e2e-noads yarn start -p 3101',
            url: `${NOADS}/api/health`, timeout: 300_000, reuseExistingServer: !process.env.CI,
        },
        {
            command: 'NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-0000000000000000 NEXT_PUBLIC_ADSENSE_SLOT=0000000000 NEXT_PUBLIC_CONTACT_EMAIL=privacy@example.test NEXT_DIST_DIR=.next-e2e-ads yarn build && NEXT_DIST_DIR=.next-e2e-ads yarn start -p 3102',
            url: `${ADS}/api/health`, timeout: 300_000, reuseExistingServer: !process.env.CI,
        },
    ],
});
