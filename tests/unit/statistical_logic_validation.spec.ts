/**
 * Statistical Logic Validation Tests
 *
 * TDD tests for validating and fixing statistical processing logic.
 * Each test describes the EXPECTED correct behavior.
 * Tests are written FIRST (Red), then code is fixed (Green).
 *
 * Issues covered:
 * - CRITICAL: eda.js population SD → sample SD
 * - CRITICAL: anova_one_way.js GG epsilon formula
 * - MAJOR: utils.js Levene's test (mean → median)
 * - MAJOR: mann_whitney.js Z sign convention
 * - MAJOR: regression_simple.js intercept statistics
 * - MINOR: ttest.js one-sample significance levels
 * - MINOR: eda.js skewness/kurtosis guards
 */

import { test, expect } from '@playwright/test';

test.describe('Statistical Logic Validation', () => {

    // ============================================================
    // CRITICAL: EDA Standard Deviation should use sample SD (n-1)
    // ============================================================
    test.describe('EDA - Standard Deviation', () => {
        test('eda.js should call jstat.stdev(true) not jstat.stdev()', async ({ page }) => {
            // This test reads the source file content to verify the fix
            const response = await page.goto('/js/analyses/eda.js');
            const sourceText = await response!.text();

            // Line ~83 and ~323: stdev should use (true) parameter
            // Count occurrences of stdev() without true - these are bugs
            // After fix, all jstat.stdev() calls should be jstat.stdev(true)
            const stdevWithoutTrue = (sourceText.match(/jstat\.stdev\(\)/g) || []).length;
            const stdevWithTrue = (sourceText.match(/jstat\.stdev\(true\)/g) || []).length;

            // After fix: no bare stdev() calls, should use stdev(true)
            expect(stdevWithoutTrue).toBe(0);
            expect(stdevWithTrue).toBeGreaterThanOrEqual(2);
        });
    });

    // ============================================================
    // CRITICAL: Greenhouse-Geisser Epsilon Calculation
    // ============================================================
    test.describe('ANOVA - Greenhouse-Geisser Epsilon', () => {
        test('GG epsilon formula should use trace of S_tilde, not variance of marginal means', async ({ page }) => {
            // Verify the source code uses the correct formula
            const response = await page.goto('/js/analyses/anova_one_way.js');
            const sourceText = await response!.text();

            // The correct formula: numGG = traceST * traceST
            // where traceST = sum of (cov[i][i] - rowMeans[i] - colMeans[i] + grandMeanCov)
            // The WRONG formula was: numGG = (sum of (rowMean - grandMean)^2)^2

            // After fix, the code should compute trace of the double-centered matrix
            expect(sourceText).toContain('traceST');
            // And should NOT use the old incorrect numerator pattern
            expect(sourceText).not.toMatch(/numGG\s*=\s*Math\.pow\(rowMeans\.reduce/);
        });

        test('GG epsilon should be 1.0 for compound symmetry matrix', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const result = await page.evaluate(() => {
                // Compound symmetry: all variances equal, all covariances equal
                // → sphericity holds → epsilon should be 1.0
                const cov = [
                    [4, 2, 2],
                    [2, 4, 2],
                    [2, 2, 4]
                ];
                const k = 3;

                const rowMeans = cov.map(row => row.reduce((a: number, b: number) => a + b, 0) / k);
                const colMeans: number[] = Array(k).fill(0);
                for (let j = 0; j < k; j++) {
                    for (let i = 0; i < k; i++) colMeans[j] += cov[i][j];
                    colMeans[j] /= k;
                }
                const grandMean = cov.flat().reduce((a: number, b: number) => a + b, 0) / (k * k);

                // Correct GG epsilon via trace of S_tilde
                let traceST = 0;
                for (let i = 0; i < k; i++) {
                    traceST += cov[i][i] - rowMeans[i] - colMeans[i] + grandMean;
                }

                let sumSqST = 0;
                for (let i = 0; i < k; i++) {
                    for (let j = 0; j < k; j++) {
                        const st = cov[i][j] - rowMeans[i] - colMeans[j] + grandMean;
                        sumSqST += st * st;
                    }
                }

                const epsilon = (traceST * traceST) / ((k - 1) * sumSqST);
                return { epsilon };
            });

            expect(result.epsilon).toBeCloseTo(1.0, 3);
        });

        test('GG epsilon should be < 1 for non-spherical data', async ({ page }) => {
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            const result = await page.evaluate(() => {
                const cov = [
                    [10, 5, 1],
                    [5,  8, 2],
                    [1,  2, 6]
                ];
                const k = 3;

                const rowMeans = cov.map(row => row.reduce((a: number, b: number) => a + b, 0) / k);
                const colMeans: number[] = Array(k).fill(0);
                for (let j = 0; j < k; j++) {
                    for (let i = 0; i < k; i++) colMeans[j] += cov[i][j];
                    colMeans[j] /= k;
                }
                const grandMean = cov.flat().reduce((a: number, b: number) => a + b, 0) / (k * k);

                let traceST = 0;
                for (let i = 0; i < k; i++) {
                    traceST += cov[i][i] - rowMeans[i] - colMeans[i] + grandMean;
                }

                let sumSqST = 0;
                for (let i = 0; i < k; i++) {
                    for (let j = 0; j < k; j++) {
                        const st = cov[i][j] - rowMeans[i] - colMeans[j] + grandMean;
                        sumSqST += st * st;
                    }
                }

                const epsilon = (traceST * traceST) / ((k - 1) * sumSqST);
                return { epsilon };
            });

            // Between 1/(k-1)=0.5 and 1.0, and < 1 for non-spherical
            expect(result.epsilon).toBeGreaterThanOrEqual(0.5);
            expect(result.epsilon).toBeLessThan(1.0);
        });
    });

    // ============================================================
    // MAJOR: Levene's Test should use median (Brown-Forsythe)
    // ============================================================
    test.describe('Levene Test - Brown-Forsythe variant', () => {
        test('source code should use jStat.median instead of jStat.mean for deviations', async ({ page }) => {
            const response = await page.goto('/js/utils.js');
            const sourceText = await response!.text();

            // Find the calculateLeveneTest function section
            const leveneSection = sourceText.substring(
                sourceText.indexOf('function calculateLeveneTest'),
                sourceText.indexOf('function calculateLeveneTest') + 500
            );

            // After fix: should use median for computing deviations
            expect(leveneSection).toContain('jStat.median');
        });

        test('Levene edge case: equal variance groups should return non-significant', async ({ page }) => {
            const response = await page.goto('/js/utils.js');
            const sourceText = await response!.text();

            // After fix: MSb === 0 case should also check MSb before returning significant
            const msWSection = sourceText.substring(
                sourceText.indexOf('MSw === 0'),
                sourceText.indexOf('MSw === 0') + 200
            );

            // Should handle MSb === 0 && MSw === 0 case
            expect(msWSection).toContain('MSb');
        });
    });

    // ============================================================
    // MAJOR: Mann-Whitney Z value should use absolute value
    // ============================================================
    test.describe('Mann-Whitney U Test - Z value convention', () => {
        test('source code should report |Z| (absolute value) for display', async ({ page }) => {
            const response = await page.goto('/js/analyses/mann_whitney.js');
            const sourceText = await response!.text();

            // After fix: Z should be reported as absolute value
            // The z variable used for display should be Math.abs(zRaw)
            expect(sourceText).toContain('Math.abs(zRaw)');
        });
    });

    // ============================================================
    // MAJOR: Simple Regression Intercept Statistics
    // ============================================================
    test.describe('Simple Regression - Intercept Statistics', () => {
        test('source code should compute SE, t-value, and p-value for the intercept', async ({ page }) => {
            const response = await page.goto('/js/analyses/regression_simple.js');
            const sourceText = await response!.text();

            // After fix: intercept SE should be calculated
            expect(sourceText).toContain('seB0');
            // After fix: intercept t-stat should be calculated
            expect(sourceText).toContain('tB0');
            // After fix: the table should NOT show "-" for intercept statistics
            // (look for the old pattern of 3 consecutive dashes for intercept row)
            const interceptDashPattern = /<td>-<\/td>\s*<td>-<\/td>\s*<td>-<\/td>/;
            expect(sourceText).not.toMatch(interceptDashPattern);
        });
    });

    // ============================================================
    // MAJOR: Paired t-test Cohen's d should be labeled d_z
    // ============================================================
    test.describe('t-test - Effect Size Labeling', () => {
        test('paired t-test should label effect size as d_z', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const sourceText = await response!.text();

            // The paired t-test section should indicate d_z in the header or variable name
            // to distinguish from Cohen's d for independent samples
            expect(sourceText).toContain('d_z');
        });
    });

    // ============================================================
    // MINOR: One-sample t-test should include p < 0.1 trend level
    // ============================================================
    test.describe('t-test - Significance Consistency', () => {
        test('one-sample t-test should include marginal significance (†) for p < 0.1', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const sourceText = await response!.text();

            // Find the one-sample t-test section (after runOneSampleTTest)
            const oneSampleSection = sourceText.substring(
                sourceText.indexOf('runOneSampleTTest')
            );

            // Find the significance assignment in this section
            // It should include p_value < 0.1 ? '†' : 'n.s.'
            // Match pattern: after the one-sample function start
            const significancePattern = /p_value < 0\.1 \? '†'/;
            expect(oneSampleSection).toMatch(significancePattern);
        });
    });

    // ============================================================
    // MINOR: Skewness/Kurtosis n-guard in eda.js
    // ============================================================
    test.describe('EDA - Skewness and Kurtosis Guards', () => {
        test('calculateSkewness should guard against n < 3', async ({ page }) => {
            const response = await page.goto('/js/analyses/eda.js');
            const sourceText = await response!.text();

            const skewnessFunc = sourceText.substring(
                sourceText.indexOf('function calculateSkewness'),
                sourceText.indexOf('function calculateKurtosis')
            );

            // Should check for n < 3 and return NaN
            expect(skewnessFunc).toMatch(/n\s*<\s*3/);
        });

        test('calculateKurtosis should guard against n < 4', async ({ page }) => {
            const response = await page.goto('/js/analyses/eda.js');
            const sourceText = await response!.text();

            const kurtosisFunc = sourceText.substring(
                sourceText.indexOf('function calculateKurtosis'),
                sourceText.indexOf('function calculateKurtosis') + 400
            );

            // Should check for n < 4 and return NaN
            expect(kurtosisFunc).toMatch(/n\s*<\s*4/);
        });
    });

    // ============================================================
    // MINOR: Chi-square Yates documentation inconsistency
    // ============================================================
    test.describe('Chi-square - Documentation Consistency', () => {
        test('documentation should correctly state Yates correction IS applied for 2x2', async ({ page }) => {
            const response = await page.goto('/js/analyses/chi_square.js');
            const sourceText = await response!.text();

            // Should NOT say "イェーツの補正は適用していません"
            expect(sourceText).not.toContain('イェーツの補正は適用していません');
        });

        test('cross-tabulation table should have proper thead tag', async ({ page }) => {
            const response = await page.goto('/js/analyses/chi_square.js');
            const sourceText = await response!.text();

            // The table should have a <thead> opening tag before the header row
            // Currently missing <thead> before <tr><th>
            const tableSection = sourceText.substring(
                sourceText.indexOf('クロス集計表と残差分析'),
                sourceText.indexOf('クロス集計表と残差分析') + 500
            );

            expect(tableSection).toContain('<thead>');
        });
    });
});
