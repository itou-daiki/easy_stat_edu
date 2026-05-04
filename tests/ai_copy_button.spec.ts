// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

async function loadDemoData(page) {
    await page.goto('http://127.0.0.1:8081/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    await page.locator('#main-data-file').setInputFiles(path.join(__dirname, '../datasets/demo_all_analysis.csv'));
    await expect(page.locator('#dataframe-container')).toBeVisible({ timeout: 30000 });
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
});
