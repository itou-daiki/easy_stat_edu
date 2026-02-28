
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
        // Row 1. T is col 6, P is col 8
        const tText = await page.locator('#test-results-table table tbody tr:first-child td:nth-child(6)').innerText();
        const pText = await page.locator('#test-results-table table tbody tr:first-child td:nth-child(8)').innerText();

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

        await expect(page.locator('#analysis-results')).toBeVisible();

        // F and p are in result table
        const resultTable = page.locator('#analysis-results h4', { hasText: '対応あり' }).locator('~ .table-container table').first();
        const fText = await resultTable.locator('tbody tr:first-child td:nth-last-child(5)').innerText();
        const pText = await resultTable.locator('tbody tr:first-child td:nth-last-child(4)').innerText();

        const fVal = parseFloat(fText);
        const pVal = parseFloat(pText.replace(/[^\d.-]/g, ''));

        assertClose(fVal, groundTruth.anova_oneway_repeated.F, 1.0, 'RM ANOVA F-value');
        assertClose(pVal, groundTruth.anova_oneway_repeated.p, 0.001, 'RM ANOVA p-value');
    });

    // 9. Mixed ANOVA (2x2: 性別 x {数学, 英語})
    test('Mixed ANOVA Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        // Click Mixed radio button
        await page.click('input[name="anova-2-type"][value="mixed"]');
        await page.waitForTimeout(500);

        // Between factor: 性別
        await selectStandardOption(page, '#mixed-between-var', '性別', 'label');
        await page.waitForTimeout(300);

        // Within factor: use pair selector (pre=数学, post=英語)
        // The first pair row should already exist
        const pairRow = page.locator('.pair-row').first();
        await pairRow.locator('.pre-select').selectOption({ label: '数学' });
        await pairRow.locator('.post-select').selectOption({ label: '英語' });
        await page.waitForTimeout(300);

        await page.click('#run-mixed-anova-btn', { force: true });

        await expect(page.locator('#test-results-section')).toBeVisible({ timeout: 10000 });

        // Table rows: Between, Within (条件), Interaction (交互作用)
        const getRowVal = async (pattern: string) => {
            const rows = page.locator('#test-results-section table tbody tr');
            const count = await rows.count();
            for (let i = 0; i < count; ++i) {
                const text = await rows.nth(i).locator('td:first-child').innerText();
                if (text.includes(pattern)) {
                    // Find column with F value (skip Error rows which have "-")
                    const cells = rows.nth(i).locator('td');
                    const cellCount = await cells.count();
                    // ANOVA table: Source, SS, df, MS, F, p, ηp²
                    const fText = await cells.nth(4).innerText();
                    const pText = await cells.nth(5).innerText();
                    return {
                        f: parseFloat(fText),
                        p: parseFloat(pText.replace(/[^\d.e-]/g, ''))
                    };
                }
            }
            throw new Error(`Row "${pattern}" not found`);
        };

        const resBetween = await getRowVal('性別');
        const resWithin = await getRowVal('条件');
        const resInter = await getRowVal('交互作用');

        assertClose(resBetween.f, groundTruth.anova_mixed.between.F, 0.5, 'Mixed Between F');
        assertClose(resWithin.f, groundTruth.anova_mixed.within.F, 2.0, 'Mixed Within F');
        assertClose(resInter.f, groundTruth.anova_mixed.interaction.F, 0.5, 'Mixed Interaction F');
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

        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        // Select numeric variables: 数学, 英語, 理科, 学習時間
        await selectVariables(page, ['数学', '英語', '理科', '学習時間'], '#factor-vars-container');
        // Default factors = 2, Rotation is promax by default so change to Varimax
        await page.selectOption('#rotation-method', 'varimax');
        await page.click('#run-factor-btn');

        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        const htmlDump = await page.locator('#fa-analysis-results').innerHTML();
        console.log('FA RESULTS HTML:', htmlDump);

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
        const loadTable = page.locator('#loadings-table table tbody');

        // Get loadings for first variable (Math)
        const mathRow = loadTable.locator('tr').filter({ hasText: '数学' }).first();
        const mathL1Text = await mathRow.locator('td').nth(1).innerText();
        const mathL2Text = await mathRow.locator('td').nth(2).innerText();
        const l1 = parseFloat(mathL1Text);
        const l2 = parseFloat(mathL2Text);

        console.log(`Math Loadings: L1=${l1}, L2=${l2}`);

        // Math should have high loading on factor 1, low on factor 2
        // Based on current data, Math is actually 0.829 on F1, -0.556 on F2
        expect(Math.abs(l1)).toBeGreaterThan(0.7);

        // Get loadings for Science
        const sciRow = loadTable.locator('tr').filter({ hasText: '理科' }).first();
        const sciL1Text = await sciRow.locator('td').nth(1).innerText();
        const sciL2Text = await sciRow.locator('td').nth(2).innerText();
        const sl1 = parseFloat(sciL1Text);
        const sl2 = parseFloat(sciL2Text);
        console.log(`Science Loadings: L1=${sl1}, L2=${sl2}`);

        // Ground truth for first variable (Math)
        const gtLoadings = groundTruth.factor_analysis.varimax_loadings[0]; // [F1, F2]

        // Method to check if {l1, l2} is close to {gt1, gt2} allowing for sign flips and order swap
        // Calculate max similarity score?
        // Or simpler: check if (|l1| close to |gt1| AND |l2| close to |gt2|) OR (|l1| close to |gt2| AND |l2| close to |gt1|)
        const matchDirect = (Math.abs(Math.abs(l1) - Math.abs(gtLoadings[0])) < 0.1) && (Math.abs(Math.abs(l2) - Math.abs(gtLoadings[1])) < 0.1);
        const matchSwapped = (Math.abs(Math.abs(l1) - Math.abs(gtLoadings[1])) < 0.1) && (Math.abs(Math.abs(l2) - Math.abs(gtLoadings[0])) < 0.1);

        expect(matchDirect || matchSwapped, 'FA Varimax Loadings match (abs/swap)').toBeTruthy();
    });

    // 12. Mann-Whitney U Test
    test('Mann-Whitney U Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'mann_whitney');
        await selectStandardOption(page, '#group-var', '性別', 'value');
        await selectVariables(page, ['数学']);
        await page.click('#run-u-test-btn', { force: true });

        await expect(page.locator('#results-section')).toBeVisible();

        // Reporting table has U and |Z| values
        const reportingTable = page.locator('#reporting-table-container table');
        await expect(reportingTable).toBeVisible();

        // Get U from the reporting table row
        const uText = await reportingTable.locator('tbody tr:first-child').innerText();
        // Extract numeric U value from the row (look for the U column)
        const allCells = reportingTable.locator('tbody tr:first-child td');
        const cellCount = await allCells.count();
        // Table has: Variable, Group1 stats, Group2 stats, U, |Z|, r, sig
        // U is typically in the results table
        const resultTable = page.locator('#test-results-table table');
        await expect(resultTable).toBeVisible();
        // Result table: varName, g1-mean, g1-sd, g1-median, g2-mean, g2-sd, g2-median, U+sig, r
        const uCell = await resultTable.locator('tbody tr:first-child td:nth-last-child(2)').innerText();
        const uVal = parseFloat(uCell.replace(/[*†]/g, ''));

        // easyStat reports min(U1,U2), SciPy reports the larger U
        // U1 + U2 = n1 * n2, so min(U) = n1*n2 - max(U)
        const n1 = groundTruth.mann_whitney.n1;
        const n2 = groundTruth.mann_whitney.n2;
        const expectedU = Math.min(groundTruth.mann_whitney.U, n1 * n2 - groundTruth.mann_whitney.U);
        assertClose(uVal, expectedU, 5.0, 'Mann-Whitney U');
    });

    // 13. Kruskal-Wallis H Test
    test('Kruskal-Wallis H Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'kruskal_wallis');
        await selectStandardOption(page, '#group-var', 'クラス', 'value');
        await selectVariables(page, ['数学']);
        await page.click('#run-kw-test-btn', { force: true });

        await expect(page.locator('#results-section')).toBeVisible();

        // Get H from main results table (first table, not APA table)
        const resultTable = page.locator('#test-results-section table').first();
        await expect(resultTable).toBeVisible();
        // Columns end with: H, df, p, sign, ε²
        const hText = await resultTable.locator('tbody tr:first-child td:nth-last-child(5)').innerText();
        const pText = await resultTable.locator('tbody tr:first-child td:nth-last-child(3)').innerText();

        const hVal = parseFloat(hText);
        const pVal = parseFloat(pText.replace(/[^\d.e-]/g, ''));

        assertClose(hVal, groundTruth.kruskal_wallis.H, 0.5, 'Kruskal-Wallis H');
        assertClose(pVal, groundTruth.kruskal_wallis.p, 0.05, 'Kruskal-Wallis p');
    });

    // 14. Paired T-Test
    test('Paired T-Test Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        // Switch to paired mode via radio button label
        await page.locator('label', { hasText: '対応ありt検定' }).click();
        await page.waitForTimeout(500);

        // Paired t-test uses pair selector: pre and post variables
        await selectStandardOption(page, '#paired-var-pre', '数学', 'value');
        await selectStandardOption(page, '#paired-var-post', '英語', 'value');
        await page.click('#add-pair-btn');
        await page.waitForTimeout(300);

        await page.click('#run-paired-btn', { force: true });
        await expect(page.locator('#test-results-section')).toBeVisible();

        // Get t and p from paired results table
        const resultTable = page.locator('#test-results-table table');
        await expect(resultTable).toBeVisible();
        // Paired table columns: pair, pre-M, pre-SD, post-M, post-SD, |t|, df, p, sig, d_z
        const tText = await resultTable.locator('tbody tr:first-child td:nth-child(6)').innerText();
        const pText = await resultTable.locator('tbody tr:first-child td:nth-child(8)').innerText();

        const tVal = parseFloat(tText);
        const pVal = parseFloat(pText.replace(/[^\d.e-]/g, ''));

        assertClose(tVal, Math.abs(groundTruth.ttest_paired.t), 0.1, 'Paired T-Test |t|');
        assertClose(pVal, groundTruth.ttest_paired.p, 0.001, 'Paired T-Test p');
    });

    // 15. One-Sample T-Test
    test('One-Sample T-Test Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        // Switch to one-sample mode via radio button label
        await page.locator('label', { hasText: '1サンプルのt検定' }).click();
        await page.waitForTimeout(500);

        await selectStandardOption(page, '#one-sample-var', '数学', 'value');
        // Set test value (mu=70)
        const muInput = page.locator('#one-sample-mu');
        await muInput.fill('70');
        await page.click('#run-one-sample-btn', { force: true });

        await expect(page.locator('#test-results-section')).toBeVisible();

        const resultTable = page.locator('#test-results-section table').first();
        await expect(resultTable).toBeVisible();
        // One-sample table columns: var(1), M(2), SD(3), mu(4), t(5), df(6), p(7), d(8), CI(9)
        const tText = await resultTable.locator('tbody tr:first-child td:nth-child(5)').innerText();
        const pText = await resultTable.locator('tbody tr:first-child td:nth-child(7)').innerText();

        const tVal = parseFloat(tText);
        const pVal = parseFloat(pText.replace(/[^\d.e-]/g, ''));

        assertClose(tVal, Math.abs(groundTruth.ttest_onesample.t), 0.1, 'One-Sample T-Test |t|');
        assertClose(pVal, groundTruth.ttest_onesample.p, 0.05, 'One-Sample T-Test p');
    });

    // 16. Spearman Correlation Accuracy
    test('Spearman Correlation Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'correlation');
        await selectVariables(page, ['数学', '理科']);

        // Run analysis first (method selector appears after results render)
        await page.click('#run-correlation-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();

        // Now switch to Spearman method (radio buttons are created dynamically)
        await page.locator('input[name="correlation-method"][value="spearman"]').click();
        await page.waitForTimeout(500);

        // Correlation matrix table: first row, third column (理科 col for 数学 row)
        const matrixTable = page.locator('#analysis-results table').first();
        const cellText = await matrixTable.locator('tbody tr:nth-child(1) td:nth-child(3)').innerText();

        // Parse rho from cell text (format: "0.992**\n95%CI[...]")
        const rhoVal = parseFloat(cellText.split(/[\n(]/)[0].replace(/[*†]/g, '').trim());
        assertClose(rhoVal, groundTruth.spearman.rho, 0.01, 'Spearman rho');
    });

    // 16b. Wilcoxon Signed-Rank Accuracy
    test('Wilcoxon Signed-Rank Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'wilcoxon_signed_rank');
        await selectVariables(page, ['数学', '英語']);
        await page.click('#run-wilcoxon-test-btn', { force: true });

        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // Result table columns: 比較ペア, N(ペア), Var1 Mdn, Var2 Mdn, T+, T−, T, |Z|, p値, 有意差, 効果量 r
        const resultTable = page.locator('#test-results-section table').first();
        await expect(resultTable).toBeVisible();

        // T is column 7 (index), |Z| is column 8, p is column 9
        const tText = await resultTable.locator('tbody tr:first-child td:nth-child(7)').innerText();
        const pText = await resultTable.locator('tbody tr:first-child td:nth-child(9)').innerText();

        const tVal = parseFloat(tText);
        const pVal = parseFloat(pText.replace(/[^\d.e-]/g, ''));

        assertClose(tVal, groundTruth.wilcoxon.T, 5.0, 'Wilcoxon T');
        // p-value is very small; UI displays "< .001" which parses to 0.001
        // Just verify it's shown as very small (≤ 0.001)
        expect(pVal, 'Wilcoxon p should be ≤ 0.001').toBeLessThanOrEqual(0.001);
    });

    // 17. Text Mining (Integration Check)
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

// McNemar test uses a different dataset (mcnemar_test.csv)
test.describe('McNemar Accuracy Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/mcnemar_test.csv');
    });

    test('McNemar Test Accuracy', async ({ page }) => {
        await navigateToFeature(page, 'mcnemar');

        // Select variables: 授業前理解 and 授業後理解
        await selectStandardOption(page, '#mcnemar-var1', '授業前理解', 'label');
        await selectStandardOption(page, '#mcnemar-var2', '授業後理解', 'label');
        await page.click('#run-mcnemar-btn', { force: true });

        // Wait for results
        await expect(page.locator('#mcnemar-analysis-results')).toBeVisible({ timeout: 10000 });

        // Check stat cards
        const getCardValue = async (label: string) => {
            const card = page.locator('.data-stat-card', { hasText: label });
            return await card.locator('.stat-value').innerText();
        };

        const chi2Text = await getCardValue('χ²値');
        const chi2Val = parseFloat(chi2Text);
        assertClose(chi2Val, groundTruth.mcnemar.chi2, 0.1, 'McNemar chi2');

        // Check detail table for OR (second table - first is contingency table)
        const detailTable = page.locator('#mcnemar-analysis-results table').nth(1);
        const orRow = detailTable.locator('tbody tr', { hasText: 'オッズ比' });
        const orText = await orRow.locator('td:nth-child(2)').innerText();
        const orVal = parseFloat(orText);
        assertClose(orVal, groundTruth.mcnemar.OR, 0.05, 'McNemar OR');

        // Check p-value (bc=17 < 25, so exact binomial is used)
        const pText = await getCardValue('p値');
        const pVal = parseFloat(pText.replace(/[^\d.e-]/g, ''));
        // Exact p ≈ 0.0127, should be significant
        expect(pVal, 'McNemar p should be < 0.05').toBeLessThan(0.05);
        assertClose(pVal, groundTruth.mcnemar.exact_p, 0.005, 'McNemar exact p');
    });
});
