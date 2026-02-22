/**
 * T-test & ANOVA Table/Notation Validation Tests
 *
 * TDD tests for verifying table formatting, p-value display,
 * t-stat absolute values, null guards, and significance legends.
 */

import { test, expect } from '@playwright/test';

test.describe('T-test & ANOVA Table Validation', () => {

    // ============================================================
    // CRITICAL: anova_two_way.js null guard for p-value styling
    // ============================================================
    test.describe('Two-Way ANOVA - Null Guard', () => {
        test('p-value style should use null guard to prevent Error row styling', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_two_way.js');
            const src = await response!.text();

            // Find the renderTwoWayANOVATable section (independent design)
            const renderSection = src.substring(
                src.indexOf('function renderTwoWayANOVATable'),
                src.indexOf('function renderTwoWayANOVATable') + 3000
            );

            // The style attribute should check for null before comparing p-value
            // Should NOT have bare `src.p < 0.05` without null check
            expect(renderSection).toMatch(/src\.p\s*!==\s*null\s*&&\s*src\.p\s*</);
        });
    });

    // ============================================================
    // MAJOR: p-value < .001 formatting
    // ============================================================
    test.describe('P-value < .001 Formatting', () => {
        test('paired t-test main table should format p < .001', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const src = await response!.text();

            // Find paired t-test section (runPairedTTest)
            const pairedSection = src.substring(
                src.indexOf('function runPairedTTest'),
                src.indexOf('function runOneSampleTTest')
            );

            // The main results table p-value should use < .001 format
            // Count raw p_value.toFixed(3) in <td> tags (these are bugs)
            // After fix: should use ternary for < .001
            expect(pairedSection).toMatch(/p_value\s*<\s*0\.001\s*\?\s*'<\s*\.001'/);
        });

        test('one-sample t-test main table should format p < .001', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const src = await response!.text();

            const oneSampleSection = src.substring(
                src.indexOf('function runOneSampleTTest')
            );

            // The main results table should use < .001 format
            // Look for the pattern in the HTML table generation (not the APA table)
            const mainTableSection = oneSampleSection.substring(0, 5000);
            expect(mainTableSection).toMatch(/p_value\s*<\s*0\.001\s*\?\s*'<\s*\.001'/);
        });

        test('anova_one_way visualization table should format p < .001', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_one_way.js');
            const src = await response!.text();

            // Find the visualization ANOVA table section (around line 324)
            const vizSection = src.substring(
                src.indexOf('要因間 (Between)'),
                src.indexOf('要因間 (Between)') + 500
            );

            expect(vizSection).toMatch(/pValue\s*<\s*0\.001\s*\?\s*'<\s*\.001'/);
        });

        test('anova_two_way main table should format p < .001', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_two_way.js');
            const src = await response!.text();

            // Find renderTwoWayANOVATable function (independent design)
            const renderSection = src.substring(
                src.indexOf('function renderTwoWayANOVATable'),
                src.indexOf('function renderTwoWayANOVATable') + 3000
            );

            // pStr should use < .001 format
            expect(renderSection).toMatch(/src\.p\s*<\s*0\.001\s*\?\s*'<\s*\.001'/);
        });
    });

    // ============================================================
    // MAJOR: t-stat absolute value for paired/one-sample
    // ============================================================
    test.describe('T-stat Absolute Value', () => {
        test('paired t-test APA table should use Math.abs for t-stat', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const src = await response!.text();

            // Find paired APA table section
            const pairedAPASection = src.substring(
                src.indexOf('headersPaired'),
                src.indexOf('headersPaired') + 1000
            );

            // t-stat in APA rows should use Math.abs
            expect(pairedAPASection).toMatch(/Math\.abs\(res\.t_stat\)/);
        });

        test('one-sample t-test main table should use Math.abs for t-stat', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const src = await response!.text();

            const oneSampleSection = src.substring(
                src.indexOf('function runOneSampleTTest'),
                src.indexOf('function runOneSampleTTest') + 5000
            );

            // Main results table should use Math.abs for t_stat display
            expect(oneSampleSection).toMatch(/Math\.abs\(t_stat\)\.toFixed/);
        });

        test('one-sample t-test APA table should use Math.abs for t-stat', async ({ page }) => {
            const response = await page.goto('/js/analyses/ttest.js');
            const src = await response!.text();

            const oneSampleAPASection = src.substring(
                src.indexOf('headersOneSample'),
                src.indexOf('headersOneSample') + 800
            );

            expect(oneSampleAPASection).toMatch(/Math\.abs\(res\.t_stat\)/);
        });
    });

    // ============================================================
    // MAJOR: HTML escape in significance legends
    // ============================================================
    test.describe('Significance Legend HTML Escaping', () => {
        test('anova_one_way.js legends should use &lt; not raw <', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_one_way.js');
            const src = await response!.text();

            // Find all significance legend lines - they should use &lt; for HTML safety
            // Should NOT contain raw 'p<0.01' pattern in HTML string context (legend lines)
            const legendLines = src.match(/sign:.*p<0\.\d+/g) || [];
            expect(legendLines.length).toBe(0);
        });
    });

    // ============================================================
    // MAJOR: Mixed/repeated ANOVA truthiness and legend
    // ============================================================
    test.describe('Two-Way ANOVA Mixed Path', () => {
        test('mixed path should use !== null checks not truthiness', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_two_way.js');
            const src = await response!.text();

            // Find renderTwoWayMixedResults function
            const mixedSection = src.substring(
                src.indexOf('function renderTwoWayMixedResults'),
                src.length
            );

            // Should NOT use bare truthiness check like `src.f ?` for numeric values
            // After fix: should use `src.f !== null`
            const truthinessPattern = /src\.f\s*\?\s*src\.f\.toFixed/;
            expect(mixedSection).not.toMatch(truthinessPattern);
        });

        test('mixed/repeated paths should include significance legend', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_two_way.js');
            const src = await response!.text();

            const mixedSection = src.substring(
                src.indexOf('function renderTwoWayMixedResults'),
                src.length
            );

            // Both repeated and mixed/generic paths should have legend
            // Count legend appearances in this function
            const legendCount = (mixedSection.match(/p&lt;0\.01\*\*/g) || []).length;
            expect(legendCount).toBeGreaterThanOrEqual(2);
        });
    });

    // ============================================================
    // MINOR: Japanese text correction
    // ============================================================
    test.describe('Text Corrections', () => {
        test('anova_one_way.js should use 的 → の in APA note', async ({ page }) => {
            const response = await page.goto('/js/analyses/anova_one_way.js');
            const src = await response!.text();

            // Should NOT contain Chinese-style "下的な"
            expect(src).not.toContain('仮定下的な');
            // Should contain correct Japanese "仮定下の"
            expect(src).toContain('仮定下の');
        });
    });
});
