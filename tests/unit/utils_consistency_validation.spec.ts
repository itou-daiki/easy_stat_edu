/**
 * Utils & Cross-Module Consistency Validation Tests
 *
 * TDD tests for verifying shared utility functions and
 * cross-module consistency issues.
 */

import { test, expect } from '@playwright/test';

test.describe('Utils & Cross-Module Consistency', () => {

    // ============================================================
    // CRITICAL: Duplicate DOM append in createPairSelector
    // ============================================================
    test.describe('createPairSelector - Duplicate DOM Append', () => {
        test('should not have duplicate appendChild calls', async ({ page }) => {
            const response = await page.goto('/js/utils.js');
            const src = await response!.text();

            // Find createPairSelector function
            const funcSection = src.substring(
                src.indexOf('function createPairSelector'),
                src.indexOf('function createPairSelector') + 5000
            );

            // Count wrapper.appendChild(inputArea) calls - should be exactly 1
            const appendInputArea = (funcSection.match(/wrapper\.appendChild\(inputArea\)/g) || []).length;
            expect(appendInputArea).toBe(1);

            // Count wrapper.appendChild(dropdown) calls - should be exactly 1
            const appendDropdown = (funcSection.match(/wrapper\.appendChild\(dropdown\)/g) || []).length;
            expect(appendDropdown).toBe(1);

            // Count container.appendChild(wrapper) calls - should be exactly 1
            const appendWrapper = (funcSection.match(/container\.appendChild\(wrapper\)/g) || []).length;
            expect(appendWrapper).toBe(1);
        });
    });

    // ============================================================
    // MAJOR: evaluatePValue should not use *** (project spec: max is **)
    // ============================================================
    test.describe('evaluatePValue - Significance Symbol Consistency', () => {
        test('evaluatePValue should not return triple-star ***', async ({ page }) => {
            const response = await page.goto('/js/utils.js');
            const src = await response!.text();

            const evalSection = src.substring(
                src.indexOf('evaluatePValue'),
                src.indexOf('evaluatePValue') + 500
            );

            // Should NOT have *** as a return value
            expect(evalSection).not.toContain('"***"');
            // Should use ** as maximum significance level
            expect(evalSection).toContain('"**"');
        });
    });

    // ============================================================
    // MAJOR: Correlation visualization should not use ***
    // ============================================================
    test.describe('Correlation Visualization - Star System', () => {
        test('correlation visualization should not use triple-star ***', async ({ page }) => {
            const response = await page.goto('/js/analyses/correlation/visualization.js');
            const src = await response!.text();

            // Legend should not have ***
            expect(src).not.toContain("*** p < .001");
            // Star assignment should not have ***
            const starAssignments = (src.match(/stars\s*=\s*'\*\*\*'/g) || []).length;
            expect(starAssignments).toBe(0);
        });
    });

    // ============================================================
    // MAJOR: interpretCorrelation broken Japanese
    // ============================================================
    test.describe('interpretCorrelation - Grammar', () => {
        test('weak correlation label should be adjectival form', async ({ page }) => {
            const response = await page.goto('/js/utils.js');
            const src = await response!.text();

            const interpSection = src.substring(
                src.indexOf('interpretCorrelation'),
                src.indexOf('interpretCorrelation') + 800
            );

            // Should NOT use predicate form "ほとんど相関がない" as modifier
            expect(interpSection).not.toContain('ほとんど相関がない');
            // Should use adjectival form like "非常に弱い"
            expect(interpSection).toContain('非常に弱い');
        });
    });
});
