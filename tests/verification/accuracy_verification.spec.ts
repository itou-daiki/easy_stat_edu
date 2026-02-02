
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

    // 6. Simple Regression Accuracy
    test('Simple Regression Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');
        await selectStandardOption(page, '#independent-var', '学習時間', 'label');
        await selectStandardOption(page, '#dependent-var', '数学', 'label');
        await page.click('#run-regression-btn-container button');

        await expect(page.locator('#regression-results')).toBeVisible();

        // R2 check
        const r2Card = page.locator('.data-stat-card', { hasText: '決定係数 (R²)' });
        const r2Text = await r2Card.locator('.stat-value').innerText();
        const r2Val = parseFloat(r2Text);

        // Coefficient check (Table)
        // Row 2 is Slope (学習時間)
        // Col 2: Coef, Col 5: p
        const resultsContainer = page.locator('#regression-results');
        const tableRow = resultsContainer.locator('.table-container table tbody tr:nth-child(2)');
        const coefText = await tableRow.locator('td:nth-child(2)').innerText();
        const pText = await tableRow.locator('td:nth-child(5)').innerText();

        const coefVal = parseFloat(coefText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        assertClose(r2Val, groundTruth.regression_simple.R2, 0.05, 'Simple Reg R2');
        assertClose(coefVal, groundTruth.regression_simple.coef_time, 0.05, 'Simple Reg Coef');
        assertClose(pVal, groundTruth.regression_simple.p_time, 0.05, 'Simple Reg p-value');
    });

    // 7. Multiple Regression Accuracy
    test('Multiple Regression Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');
        await selectVariables(page, ['数学'], '#dependent-var-container'); // Math
        await selectVariables(page, ['学習時間', '英語'], '#independent-vars-container'); // Time, Eng
        await page.click('#run-regression-btn-container button');

        await expect(page.locator('#regression-results')).toBeVisible();

        // R2 check - scope to first result section
        const resultsSection = page.locator('#regression-results');
        const r2Card = resultsSection.locator('.data-stat-card', { hasText: '決定係数 (R²)' }).first();
        const r2Text = await r2Card.locator('.stat-value').innerText();
        const r2Val = parseFloat(r2Text);

        // Coefficients - scope to first table
        const firstTable = resultsSection.locator('.table-container table').first();
        const getCoef = async (varName: string) => {
            const row = firstTable.locator('tbody tr', { hasText: varName });
            const bText = await row.locator('td:nth-child(2)').innerText();
            const pText = await row.locator('td:nth-child(6)').innerText();
            return {
                b: parseFloat(bText),
                p: parseFloat(pText.replace(/[^\d.-]/g, ''))
            };
        };

        const regTime = await getCoef('学習時間');
        const regEng = await getCoef('英語');

        // Ground Truth
        assertClose(r2Val, groundTruth.regression_multiple.R2, 0.05, 'Multi Reg R2');
        assertClose(regTime.b, groundTruth.regression_multiple.coef_time, 0.1, 'Multi Reg Coef Time');
        assertClose(regEng.b, groundTruth.regression_multiple.coef_eng, 0.1, 'Multi Reg Coef Eng');
        assertClose(regTime.p, groundTruth.regression_multiple.p_time, 0.05, 'Multi Reg p Time');
        assertClose(regEng.p, groundTruth.regression_multiple.p_eng, 0.05, 'Multi Reg p Eng');
    });

    // 8. One-Way Repeated Measures ANOVA
    test('One-Way Repeated ANOVA Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        // Click Repeated radio button (not a tab)
        await page.click('input[name="anova-type"][value="repeated"]');
        await page.waitForTimeout(300);

        // Select 3 within-subject variables: 数学, 英語, 理科
        await selectVariables(page, ['数学', '英語', '理科'], '#rep-dependent-var-container');
        await page.click('#run-rep-btn-container button');

        await expect(page.locator('#test-results-section')).toBeVisible();

        // F and p are in result table (exclude APA table by using first)
        const fText = await page.locator('#test-results-section table tbody tr:first-child td:nth-last-child(5)').first().innerText();
        const pText = await page.locator('#test-results-section table tbody tr:first-child td:nth-last-child(4)').first().innerText();

        const fVal = parseFloat(fText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        assertClose(fVal, groundTruth.anova_oneway_repeated.F, 1.0, 'RM ANOVA F-value');
        assertClose(pVal, groundTruth.anova_oneway_repeated.p, 0.001, 'RM ANOVA p-value');
    });

    // 9. Mixed ANOVA - Skipped: Uses complex pair selector (pre/post pairs) that requires different UI handling
    test.skip('Mixed ANOVA Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        // Click Mixed radio button
        await page.click('input[name="anova-2-type"][value="mixed"]');
        await page.waitForTimeout(300);

        // Between factor select in #mixed-between-container
        await selectStandardOption(page, '#mixed-between-var', '性別', 'label');
        // Within factor (pair selector in #pair-selector-container)
        await selectVariables(page, ['数学', '英語', '理科'], '#pair-selector-container');
        await page.click('#run-mixed-btn-container button');

        await expect(page.locator('#test-results-section')).toBeVisible();

        // Table rows: Between, Within, Interaction
        const getRowF = async (pattern: string) => {
            const rows = page.locator('#test-results-section table tbody tr');
            const count = await rows.count();
            for (let i = 0; i < count; ++i) {
                const text = await rows.nth(i).locator('td:first-child').innerText();
                if (text.includes(pattern)) {
                    const fText = await rows.nth(i).locator('td:nth-child(5)').innerText();
                    return parseFloat(fText);
                }
            }
            throw new Error(`Row "${pattern}" not found`);
        };

        const fBetween = await getRowF('性別');
        const fWithin = await getRowF('条件');
        const fInter = await getRowF('×');

        assertClose(fBetween, groundTruth.anova_mixed.between.F, 0.5, 'Mixed Between F');
        assertClose(fWithin, groundTruth.anova_mixed.within.F, 1.0, 'Mixed Within F');
        assertClose(fInter, groundTruth.anova_mixed.interaction.F, 0.5, 'Mixed Interaction F');
    });

    // 10. PCA - Principal Component Analysis
    test('PCA Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'pca');

        // Select numeric variables: 数学, 英語, 理科, 学習時間
        await selectVariables(page, ['数学', '英語', '理科', '学習時間'], '#pca-vars-container');
        await page.click('#run-pca-btn-container button');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // Eigenvalues table
        const eigenTable = page.locator('#eigenvalues-table table');
        await expect(eigenTable).toBeVisible();

        // First eigenvalue (PC1)
        const eigen1Text = await eigenTable.locator('tbody tr:first-child td:nth-child(2)').innerText();
        const eigen1 = parseFloat(eigen1Text);

        // First explained variance ratio
        const ratio1Text = await eigenTable.locator('tbody tr:first-child td:nth-child(3)').innerText();
        const ratio1 = parseFloat(ratio1Text.replace('%', '')) / 100;

        assertClose(eigen1, groundTruth.pca.eigenvalues[0], 0.5, 'PCA Eigenvalue 1');
        assertClose(ratio1, groundTruth.pca.explained_ratio[0], 0.02, 'PCA Explained Ratio 1');
    });

    // 11. Factor Analysis (Unrotated & Varimax)
    test('Factor Analysis Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'factor_analysis');

        // Select numeric variables: 数学, 英語, 理科, 学習時間
        await selectVariables(page, ['数学', '英語', '理科', '学習時間'], '#factor-vars-container');
        // Default factors = 2, Rotation = Varimax
        await page.click('#run-factor-btn');

        await expect(page.locator('#analysis-results')).toBeVisible();

        // 1. Check Initial Eigenvalues (Unrotated)
        // Table: #eigenvalues-table table
        // Row 1: Factor 1, Col 2: Initial Eigenvalue
        const eigenTable = page.locator('#eigenvalues-table table');
        await expect(eigenTable).toBeVisible();

        const eigen1Text = await eigenTable.locator('tbody tr:first-child td:nth-child(2)').innerText();
        const eigen1 = parseFloat(eigen1Text);

        // Tolerance 0.05 for extraction method differences (though both should cause PC method)
        assertClose(eigen1, groundTruth.factor_analysis.eigenvalues[0], 0.05, 'FA Initial Eigenvalue 1');

        // Check Unrotated Loadings (Factor 1, Variable 1: 数学)
        // Need to find where unrotated loadings are displayed. 
        // The UI shows "Loadings (Varimax)" by default because we clicked Run.
        // But runPCA/runFactor usually displays rotated if rotation is selected.
        // To check unrotated, we might need to select "None" rotation?
        // Or just rely on the fact that if Varimax fails, we suspect extraction.
        // If we want to debug, we can check the internal state or just skip this visual check if UI doesn't show it easily.
        // However, let's keep the focus on Varimax mismatch debug.
        // I'll add a comment that we suspect unrotated difference.

        // 2. Check Varimax Loadings
        // Table: #loadings-table table
        // Row 1: Variable "数学" (first selected)
        // Col 2: Factor 1, Col 3: Factor 2
        const loadTable = page.locator('#loadings-table table');
        await expect(loadTable).toBeVisible();

        // Get loadings for first variable
        const l1Text = await loadTable.locator('tbody tr:first-child td:nth-child(2)').innerText();
        const l2Text = await loadTable.locator('tbody tr:first-child td:nth-child(3)').innerText();
        const l1 = parseFloat(l1Text);
        const l2 = parseFloat(l2Text);

        // Ground truth for first variable
        const gtLoadings = groundTruth.factor_analysis.varimax_loadings[0]; // [F1, F2]

        // Method to check if {l1, l2} is close to {gt1, gt2} allowing for sign flips and order swap
        // Calculate max similarity score?
        // Or simpler: check if (|l1| close to |gt1| AND |l2| close to |gt2|) OR (|l1| close to |gt2| AND |l2| close to |gt1|)
        const matchDirect = (Math.abs(Math.abs(l1) - Math.abs(gtLoadings[0])) < 0.1) && (Math.abs(Math.abs(l2) - Math.abs(gtLoadings[1])) < 0.1);
        const matchSwapped = (Math.abs(Math.abs(l1) - Math.abs(gtLoadings[1])) < 0.1) && (Math.abs(Math.abs(l2) - Math.abs(gtLoadings[0])) < 0.1);

        expect(matchDirect || matchSwapped, 'FA Varimax Loadings match (abs/swap)').toBeTruthy();
    });

    // 12. Text Mining (Integration Check)
    test('Text Mining Integration', async ({ page }) => {
        await navigateToFeature(page, 'text_mining');

        // Select text variable: 感想
        await page.selectOption('#text-var', { label: '感想' });

        // Select category variable: クラス (Optional but good to test)
        await page.selectOption('#category-var', { label: 'クラス' });

        // Run
        await page.click('#run-text-btn');

        // Wait for results
        // It uses setTimeout(..., 10) so it's async but fast.
        // Wait for overall results
        await expect(page.locator('#overall-results')).toBeVisible();
        await expect(page.locator('canvas#overall-wordcloud')).toBeVisible();
        await expect(page.locator('#overall-network')).toBeVisible();

        // Check for specific tokens in wordcloud list? 
        // TinySegmenter output for "数学が楽しかった": "数学" should be there.
        // But checking canvas content is hard.
        // We can check if `WordCloud` function was called or simply checks if canvas has size > 0.
        const canvas = page.locator('#overall-wordcloud');
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        if (!box) return; // TypeScript narrowing
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);

        // Check Category Tab visibility
        await expect(page.locator('#tm-cat-tab-btn')).toBeVisible();
        await page.click('#tm-cat-tab-btn');
        await expect(page.locator('#tm-category')).toBeVisible();
        await expect(page.locator('#category-results')).not.toBeEmpty();
    });

});
