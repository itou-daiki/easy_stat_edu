/**
 * Layout Consistency Validation Tests
 *
 * Verifies that all analysis modules follow the standard layout pattern:
 * 1. Blue title banner (#1e90ff)
 * 2. Collapsible info section ("分析の概要・方法")
 * 3. Collapsible logic section ("分析ロジック・計算式詳説")
 * 4. Data overview (renderDataOverview with initiallyCollapsed: true)
 * 5. Settings panel (white card)
 * 6. Results section (display: none)
 */

import { test, expect } from '@playwright/test';

const analysisModules = [
    { file: 'eda.js', name: 'EDA' },
    { file: 'ttest.js', name: 't-test' },
    { file: 'anova_one_way.js', name: 'ANOVA One-Way' },
    { file: 'anova_two_way.js', name: 'ANOVA Two-Way' },
    { file: 'correlation.js', name: 'Correlation' },
    { file: 'regression_simple.js', name: 'Simple Regression' },
    { file: 'regression_multiple.js', name: 'Multiple Regression' },
    { file: 'chi_square.js', name: 'Chi-Square' },
    { file: 'mann_whitney.js', name: 'Mann-Whitney' },
    { file: 'factor_analysis.js', name: 'Factor Analysis' },
    { file: 'time_series.js', name: 'Time Series' },
];

test.describe('Layout Consistency - Blue Title Banner', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} should have blue title banner`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            // All modules should have the standard blue (#1e90ff) title banner
            expect(src).toContain('background: #1e90ff');
        });
    }
});

test.describe('Layout Consistency - Info Section', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} should have collapsible info section`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            expect(src).toContain('分析の概要・方法');
            expect(src).toContain('collapsible-section info-sections');
        });
    }
});

test.describe('Layout Consistency - Logic Section', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} should have collapsible logic section`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            expect(src).toContain('分析ロジック・計算式詳説');
        });
    }
});

test.describe('Layout Consistency - Logic Section Ordering', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} logic section should come after info section and before data overview`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            const infoPos = src.indexOf('分析の概要・方法');
            const logicPos = src.indexOf('分析ロジック・計算式詳説');
            const dataOverviewPos = src.indexOf('data-overview');

            // Info -> Logic -> Data Overview
            expect(infoPos).toBeLessThan(logicPos);
            expect(logicPos).toBeLessThan(dataOverviewPos);
        });
    }
});

test.describe('Layout Consistency - Data Overview', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} should call renderDataOverview with initiallyCollapsed`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            // All modules should have a data overview div
            expect(src).toMatch(/id="[^"]*data-overview"/);

            // All modules should call renderDataOverview with initiallyCollapsed: true
            expect(src).toContain('initiallyCollapsed: true');
        });
    }
});

test.describe('Layout Consistency - Data Overview has info-sections class', () => {
    for (const mod of analysisModules) {
        test(`${mod.name} data overview div should have class="info-sections"`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            // Data overview div should have class="info-sections" for consistent styling
            const dataOverviewMatch = src.match(/id="[^"]*data-overview"[^>]*/);
            expect(dataOverviewMatch).not.toBeNull();
            expect(dataOverviewMatch![0]).toContain('class="info-sections"');
        });
    }
});

test.describe('Layout Consistency - Element Ordering', () => {
    // Verify the standard order: banner -> info section -> data overview -> settings
    for (const mod of analysisModules) {
        test(`${mod.name} should have info section before data overview`, async ({ page }) => {
            const response = await page.goto(`/js/analyses/${mod.file}`);
            const src = await response!.text();

            const infoSectionPos = src.indexOf('分析の概要・方法');
            const dataOverviewPos = src.indexOf('data-overview');

            expect(infoSectionPos).toBeGreaterThan(-1);
            expect(dataOverviewPos).toBeGreaterThan(-1);
            // Info section should come before data overview
            expect(infoSectionPos).toBeLessThan(dataOverviewPos);
        });
    }
});

test.describe('Layout Consistency - Time Series Specific', () => {
    test('time_series.js should NOT wrap everything in a single white card', async ({ page }) => {
        const response = await page.goto('/js/analyses/time_series.js');
        const src = await response!.text();

        // The blue banner should come directly after the container div, not inside a white card
        const containerStart = src.indexOf('time-series-container');
        const firstBlueBanner = src.indexOf('background: #1e90ff', containerStart);
        const firstWhiteCard = src.indexOf("background: white", containerStart);

        // Blue banner should come before any white card
        expect(firstBlueBanner).toBeLessThan(firstWhiteCard);
    });
});
