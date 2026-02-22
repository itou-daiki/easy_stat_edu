/**
 * Table & Notation Validation Tests
 *
 * TDD tests for verifying tables, labels, and notation consistency.
 * Covers: significance symbols, rotation labels, PCA terminology,
 * Plotly config usage, |Z| headers, p-value formatting.
 */

import { test, expect } from '@playwright/test';

test.describe('Table & Notation Validation', () => {

    // ============================================================
    // CRITICAL: time_series.js createPlotlyConfig() misuse
    // ============================================================
    test.describe('Time Series - Plotly Config', () => {
        test('should not use createPlotlyConfig().layout or createPlotlyConfig().config', async ({ page }) => {
            const response = await page.goto('/js/analyses/time_series.js');
            const src = await response!.text();

            // After fix: should NOT access .layout or .config properties
            expect(src).not.toContain('createPlotlyConfig().layout');
            expect(src).not.toContain('createPlotlyConfig().config');
        });
    });

    // ============================================================
    // MAJOR: Significance symbol chain consistency
    // ============================================================
    test.describe('Significance Symbol Consistency', () => {
        test('regression_simple.js should use full significance chain in result table', async ({ page }) => {
            const response = await page.goto('/js/analyses/regression_simple.js');
            const src = await response!.text();

            // After fix: both intercept and slope should use dagger/n.s.
            // Should not have bare `? '*' : '')}` pattern (missing dagger)
            const bareStarEnd = (src.match(/\? '\*' : ''\)/g) || []).length;
            expect(bareStarEnd).toBe(0);
        });

        test('regression_multiple.js intercept should use full significance chain', async ({ page }) => {
            const response = await page.goto('/js/analyses/regression_multiple.js');
            const src = await response!.text();

            // Find the intercept significance line (定数項 section)
            const constSection = src.substring(
                src.indexOf('(定数項)'),
                src.indexOf('(定数項)') + 400
            );
            // Should distinguish ** from *
            expect(constSection).toContain("< 0.01 ? '**'");
        });

        test('chi_square.js main p-value should use full significance chain', async ({ page }) => {
            const response = await page.goto('/js/analyses/chi_square.js');
            const src = await response!.text();

            // The stat card p-value display (around displayChiSquareResult)
            // Should NOT have only a single `< 0.05 ? '*' : ''` pattern
            const displayFn = src.substring(
                src.indexOf('function displayChiSquareResult'),
                src.indexOf('function displayChiSquareResult') + 5000
            );
            // Should use ** for p < 0.01
            expect(displayFn).toMatch(/< 0\.01 \? '\*\*'/);
        });

        test('chi_square.js Yates p-value should use full significance chain', async ({ page }) => {
            const response = await page.goto('/js/analyses/chi_square.js');
            const src = await response!.text();

            // Yates section
            const yatesSection = src.substring(
                src.indexOf('Yates補正'),
                src.indexOf('Yates補正') + 1000
            );
            // Should have ** for p < 0.01
            expect(yatesSection).toMatch(/< 0\.01 \? '\*\*'/);
        });
    });

    // ============================================================
    // MAJOR: Correlation APA table dagger
    // ============================================================
    test.describe('Correlation APA Table', () => {
        test('APA table note should include dagger explanation', async ({ page }) => {
            const response = await page.goto('/js/analyses/correlation.js');
            const src = await response!.text();

            // Both Pearson and Spearman APA notes should mention dagger
            const notes = src.match(/noteAPA\s*=\s*`[^`]+`/g) || [];
            for (const note of notes) {
                expect(note).toContain('.10');
            }
        });

        test('APA table data cells should include dagger for p < 0.1', async ({ page }) => {
            const response = await page.goto('/js/analyses/correlation.js');
            const src = await response!.text();

            // APA data cell generation should include p < 0.1 tier
            // Look for the rText += pattern in APA generation sections
            const apaBlocks = src.split('headersAPA');
            for (let i = 1; i < apaBlocks.length; i++) {
                const block = apaBlocks[i].substring(0, 800);
                if (block.includes('rText')) {
                    expect(block).toContain("< 0.1");
                }
            }
        });
    });

    // ============================================================
    // MAJOR: Factor analysis rotation labels
    // ============================================================
    test.describe('Factor Analysis - Rotation Labels', () => {
        test('should handle promax, oblimin, geomin rotation labels', async ({ page }) => {
            const response = await page.goto('/js/analyses/factor_analysis/visualization.js');
            const src = await response!.text();

            // After fix: should have labels for all rotation methods
            expect(src).toContain('promax');
            expect(src).toContain('oblimin');
            expect(src).toContain('geomin');
            // Should NOT have only varimax/none binary
            expect(src).not.toMatch(/rotationText\s*=\s*rotation\s*===\s*'varimax'\s*\?\s*'[^']*'\s*:\s*'[^']*';/);
        });
    });

    // ============================================================
    // MAJOR: PCA terminology
    // ============================================================
    test.describe('PCA - Terminology', () => {
        test('PCA section should use "主成分負荷量" not "因子負荷量"', async ({ page }) => {
            const response = await page.goto('/js/analyses/pca.js');
            const src = await response!.text();

            // Should NOT use factor analysis terminology for PCA
            expect(src).not.toContain('因子負荷量');
            expect(src).toContain('主成分負荷量');
        });
    });

    // ============================================================
    // MINOR: Mann-Whitney |Z| header
    // ============================================================
    test.describe('Mann-Whitney - Z Header', () => {
        test('column header should indicate absolute value |Z|', async ({ page }) => {
            const response = await page.goto('/js/analyses/mann_whitney.js');
            const src = await response!.text();

            // Main table header should use |Z|
            expect(src).toContain('|Z|');
        });
    });

    // ============================================================
    // MINOR: Regression negative intercept display
    // ============================================================
    test.describe('Regression - Negative Intercept', () => {
        test('regression equation should handle negative intercept gracefully', async ({ page }) => {
            const response = await page.goto('/js/analyses/regression_simple.js');
            const src = await response!.text();

            // Should use conditional sign for intercept display
            // Pattern: b0 >= 0 ? '+' : '-'  or similar
            expect(src).toMatch(/b0\s*>=?\s*0/);
        });
    });
});
