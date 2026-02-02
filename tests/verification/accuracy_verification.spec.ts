
import { test, expect } from '@playwright/test';
import { navigateToFeature, uploadFile, selectStandardOption, selectVariables } from '../utils/test-helpers';
import fs from 'fs';
import path from 'path';

// Load Ground Truth
const groundTruthPath = path.join(__dirname, 'ground_truth.json');
const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

// Helper for fuzzy comparison
const assertClose = (actual, expected, tolerance = 0.05, label = '') => {
    // Handle very small numbers (p-values) with ratio or absolute diff
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        console.error(`Mismatch [${label}]: Actual=${actual}, Expected=${expected}, Diff=${diff}`);
    }
    expect(diff, `Mismatch [${label}]: Actual=${actual}, Expected=${expected}`).toBeLessThanOrEqual(tolerance);
};

test.describe('Statistical Accuracy Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    // 1. T-Test (Independent)
    test('T-Test Independent Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#independent-btn-container button');

        await expect(page.locator('#test-results-section')).toBeVisible();

        // Table in #test-results-table
        // Row 1. T is col 10, P is col 11
        const tText = await page.locator('#test-results-table table tbody tr:first-child td:nth-child(10)').innerText();
        const pText = await page.locator('#test-results-table table tbody tr:first-child td:nth-child(11)').innerText();

        const tVal = parseFloat(tText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        console.log(`T-Test UI: t=${tVal}, p=${pVal}`);

        // Compare against Welch (default)
        assertClose(tVal, groundTruth.ttest_ind_welch.t, 0.05, 'T-Test t-value (Welch)');
        assertClose(pVal, groundTruth.ttest_ind_welch.p, 0.05, 'T-Test p-value (Welch)');
    });

    // 2. ANOVA One-Way
    test('ANOVA One-Way Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');

        await expect(page.locator('#test-results-section')).toBeVisible();

        // Table columns are dynamic (based on groups). F is 5th from last.
        // Headers: ..., F, p, sign, eta2, omega2
        const fText = await page.locator('#test-results-section table tbody tr:first-child td:nth-last-child(5)').innerText();
        const pText = await page.locator('#test-results-section table tbody tr:first-child td:nth-last-child(4)').innerText();

        const fVal = parseFloat(fText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        assertClose(fVal, groundTruth.anova_oneway.f, 0.05, 'ANOVA One-Way F-value');
        assertClose(pVal, groundTruth.anova_oneway.p, 0.05, 'ANOVA One-Way p-value');
    });

    // 3. Correlation
    test('Correlation Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'correlation');
        await selectVariables(page, ['数学', '理科']);
        await page.click('#run-correlation-btn-container button');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Scope to first table (Correlation Matrix)
        const matrixTable = page.locator('#analysis-results table').first();
        const cellText = await matrixTable.locator('tbody tr:nth-child(1) td:nth-child(3)').innerText();

        const rVal = parseFloat(cellText.split('(')[0]);
        assertClose(rVal, groundTruth.correlation.r, 0.05, 'Correlation r-value');
    });

    // 4. Chi-Square
    test('Chi-Square Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'chi_square');
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.click('#run-chi-btn-container button');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Use Data Cards
        // Card Label: "カイ二乗値 (χ²)", Value: next sibling .stat-value
        // Or cleaner: text match inside card

        const getCardValue = async (label) => {
            const card = page.locator('.data-stat-card', { hasText: label });
            return await card.locator('.stat-value').innerText();
        };

        const chiText = await getCardValue('カイ二乗値');
        const pText = await getCardValue('p値');

        const chiVal = parseFloat(chiText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        assertClose(chiVal, groundTruth.chisquare.chi2, 0.5, 'Chi-Square Value');
        assertClose(pVal, groundTruth.chisquare.p, 0.05, 'Chi-Square p-value');
    });

    // 5. Two-Way ANOVA Accuracy
    test('Two-Way ANOVA Independent Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label'); // Factor 1 (C)
        await selectStandardOption(page, '#factor2-var', '性別', 'label');   // Factor 2 (S)
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');

        await expect(page.locator('#test-results-section')).toBeVisible();

        const getRowVal = async (name) => {
            // Check rows
            const rows = page.locator('#test-results-section table tbody tr');
            const count = await rows.count();
            for (let i = 0; i < count; ++i) {
                const text = await rows.nth(i).locator('td:first-child').innerText();
                if (text.includes(name)) {
                    const fText = await rows.nth(i).locator('td:nth-child(5)').innerText();
                    const pText = await rows.nth(i).locator('td:nth-child(6)').innerText();
                    return {
                        f: parseFloat(fText),
                        p: parseFloat(pText.replace(/[^\d.-]/g, ''))
                    };
                }
            }
            throw new Error(`Row ${name} not found`);
        };

        const resC = await getRowVal('クラス');
        const resS = await getRowVal('性別');
        const resI = await getRowVal('×');

        // Ground Truth (Type 3)
        // C: Factor 1, S: Factor 2
        assertClose(resC.f, groundTruth.anova_twoway_ind.C.f, 0.1, '2-Way Factor1 F');
        assertClose(resS.f, groundTruth.anova_twoway_ind.S.f, 0.1, '2-Way Factor2 F');
        assertClose(resI.f, groundTruth.anova_twoway_ind['C:S'].f, 0.1, '2-Way Interaction F');
    });

});
