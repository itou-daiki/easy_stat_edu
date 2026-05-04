// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function loadDemoData(page) {
    await page.goto('http://127.0.0.1:8081/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    await page.locator('#main-data-file').setInputFiles(path.join(__dirname, '../datasets/demo_all_analysis.csv'));
    await expect(page.locator('#dataframe-container')).toBeVisible({ timeout: 30000 });
}

async function mockClipboard(page) {
    await page.evaluate(() => {
        window.__copiedText = '';
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: async text => {
                    window.__copiedText = text;
                }
            },
            configurable: true
        });
    });
}

async function selectSupportVariable(page, name) {
    await page.locator('#support-multiselect .multiselect-input').click();
    await page.locator('#support-multiselect .multiselect-option').filter({ hasText: name }).first().click();
    await page.locator('body').click({ position: { x: 0, y: 0 } });
}

async function selectCorrelationVariables(page) {
    const input = page.locator('#correlation-vars-container .multiselect-input');
    const dropdown = page.locator('#correlation-vars-container .multiselect-dropdown');
    const options = page.locator('#correlation-vars-container .multiselect-option');
    await input.click();
    await expect(dropdown).toBeVisible();
    await options.filter({ hasText: '数学' }).first().click();

    if (!(await dropdown.isVisible())) {
        await input.click();
        await expect(dropdown).toBeVisible();
    }
    await options.filter({ hasText: '英語' }).first().click();
    await page.locator('body').click({ position: { x: 0, y: 0 } });
}

test.describe('AI copy text availability', () => {
    test('Gemini requests prefer 3 Flash Preview with a 2.5 Flash fallback', async () => {
        const source = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');

        expect(source).toContain("const GEMINI_PRIMARY_MODEL = 'gemini-3-flash-preview'");
        expect(source).toContain("const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash'");
        expect(source).toContain('shouldTryFallbackGeminiModel');
    });

    test('correlation copy button is disabled until variables are selected and results are shown', async ({ page }) => {
        await loadDemoData(page);
        await page.locator('.feature-card[data-analysis="correlation"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();

        const copyButton = page.locator('#ai-copy-context-btn');
        await expect(copyButton).toBeDisabled();

        await selectCorrelationVariables(page);
        await expect(copyButton).toBeDisabled();

        await page.locator('#run-correlation-btn').click();
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
        await expect(copyButton).toBeEnabled();

        await mockClipboard(page);
        await page.locator('#ai-assist-toggle').click();
        await expect(copyButton).toBeVisible();
        await copyButton.click();
        const copiedText = await page.waitForFunction(() => window.__copiedText, null, { timeout: 10000 })
            .then(handle => handle.jsonValue());
        expect(copiedText).toContain('全体で900〜1400字程度');
        expect(copiedText).toContain('短いレポート文と少し詳しいレポート文');
    });

    test('analysis supporter copy button is disabled until a variable is selected', async ({ page }) => {
        await loadDemoData(page);
        await page.locator('.feature-card[data-analysis="analysis_support"]').click();
        await expect(page.locator('#recommendation-area')).toBeVisible({ timeout: 30000 });

        const copyButton = page.locator('#ai-copy-context-btn');
        await expect(copyButton).toBeDisabled();

        await selectSupportVariable(page, '数学');
        await expect(page.locator('#selected-tags .as-tag')).toHaveCount(1);
        await expect(copyButton).toBeEnabled();
    });

    test('data processing copy button is enabled after a processing operation', async ({ page }) => {
        await loadDemoData(page);
        await page.locator('.feature-card[data-analysis="data_processing"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();

        const copyButton = page.locator('#ai-copy-context-btn');
        await expect(copyButton).toBeDisabled();

        await page.locator('#remove-missing-checkbox').check();
        await page.locator('#process-data-btn').click();
        await expect(page.locator('#processing-summary')).toContainText('処理完了');
        await expect(copyButton).toBeEnabled();
    });

    test('EDA copy button is enabled after automatic summary is shown', async ({ page }) => {
        await loadDemoData(page);
        await page.locator('.feature-card[data-analysis="eda"]').click();
        await expect(page.locator('#eda-summary-stats')).toBeVisible({ timeout: 30000 });

        await expect(page.locator('#ai-copy-context-btn')).toBeEnabled();
    });
});
