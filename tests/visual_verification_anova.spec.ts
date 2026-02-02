
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Visual Verification: ANOVA Multiple Comparisons', () => {
    // Capture console logs
    const consoleLogs = [];

    test.beforeEach(async ({ page }) => {
        consoleLogs.length = 0; // Clear logs
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
                console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
            }
        });

        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('One-Way ANOVA: Tukey vs Holm Visuals', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Setup
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);

        // 1. Run Tukey
        await test.step('Run Tukey Method', async () => {
            await page.selectOption('#comparison-method', 'tukey');
            await page.click('#run-ind-anova-btn');
            await expect(page.locator('#analysis-results')).toBeVisible();
            await page.waitForTimeout(1000); // Wait for plots

            await page.screenshot({ path: 'test-results/visual_verification/one_way_tukey_full.png', fullPage: true });
            console.log('Taken screenshot: one_way_tukey_full.png');

            // Verify Post-hoc table specific text
            await expect(page.locator('body')).toContainText('Tukey-Kramer法');
        });

        // 2. Run Holm
        await test.step('Run Holm Method', async () => {
            await page.selectOption('#comparison-method', 'holm');
            await page.click('#run-ind-anova-btn');
            await page.waitForTimeout(1000);

            await page.screenshot({ path: 'test-results/visual_verification/one_way_holm_full.png', fullPage: true });
            console.log('Taken screenshot: one_way_holm_full.png');

            // Verify Post-hoc specific text
            await expect(page.locator('body')).toContainText('Holm法');
        });

        // Assert No Critical Console Errors (ignoring 404s which might be favicon/missing assets)
        const criticalErrors = consoleLogs.filter(l => {
            const text = l.toLowerCase();
            return text.includes('error') && !text.includes('404') && !text.includes('favicon');
        });
        expect(criticalErrors).toHaveLength(0);
    });

    test('Two-Way ANOVA: Method Switching Visuals', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await page.waitForSelector('.anova-container', { state: 'visible' });

        // Setup
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);

        // 1. Run Tukey
        await test.step('Run Tukey Method', async () => {
            await page.selectOption('#two-way-comparison-method', 'tukey');
            await page.click('#run-ind-anova-btn');
            await expect(page.locator('#analysis-results')).toBeVisible();
            await page.waitForTimeout(1000);

            await page.screenshot({ path: 'test-results/visual_verification/two_way_tukey_full.png', fullPage: true });
            console.log('Taken screenshot: two_way_tukey_full.png');

            // Interpretation should mention Tukey
            await expect(page.locator('#interpretation-section')).toContainText('Tukey-Kramer法');
        });

        // 2. Run Holm
        await test.step('Run Holm Method', async () => {
            await page.selectOption('#two-way-comparison-method', 'holm');
            await page.click('#run-ind-anova-btn');
            await page.waitForTimeout(1000);

            await page.screenshot({ path: 'test-results/visual_verification/two_way_holm_full.png', fullPage: true });
            console.log('Taken screenshot: two_way_holm_full.png');

            // Interpretation should mention Holm
            await expect(page.locator('#interpretation-section')).toContainText('Holm法');
        });

        // Assert No Critical Console Errors
        const criticalErrors = consoleLogs.filter(l => {
            const text = l.toLowerCase();
            return text.includes('error') && !text.includes('404') && !text.includes('favicon');
        });
        expect(criticalErrors).toHaveLength(0);
    });
});
