// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://127.0.0.1:8081',
        trace: 'on-first-retry',
        // 既存テストは「すべての手法から選ぶ」表示を前提にする（初学者モードは tests/guided_mode.spec.ts で検証）
        storageState: 'tests/fixtures/all-methods-mode.json',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npx http-server . -p 8081',
        url: 'http://127.0.0.1:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
