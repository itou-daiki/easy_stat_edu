
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('ANOVA One-Way Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'anova_one_way');
    });

    test('should run ANOVA One-Way successfully', async ({ page }) => {
        // Wait for analysis to render
        await page.waitForSelector('.anova-container', { state: 'visible', timeout: 10000 });
        // Check element visibility to avoid crash
        await expect(page.locator('#factor-var')).toBeVisible();

        // Factor: クラス (Single Select), Dependent: 数学 (Multi Select)

        // Use robust selector for Factor (Single)
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');

        // Use selectVariables for Dependent (Multi - Custom)
        await selectVariables(page, ['数学']);
        // Note: selectVariables handles standard or custom multiselects by searching for input/option.
        // The ID of the select is 'dependent-var', but selectVariables takes variable names.

        await page.click('#run-ind-anova-btn');

        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });
        const textContent = await page.locator('#analysis-results').textContent();
        expect(textContent).toContain('平均値の差の検定');
        expect(textContent).toContain('F値');

        // Check plots
        const plot = page.locator('#anova-plot-0');
        await expect(plot).toBeVisible();
        const editor = plot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(editor).toBeVisible({ timeout: 10000 });
        await editor.locator('summary').click();
        await editor.locator(
            '[data-visualization-input="chart-view"]'
        ).selectOption('box');
        await expect(plot).toHaveAttribute('data-visualization-view', 'box');
        const boxData = await plot.evaluate(element => ({
            types: (element as any).data.map((trace: any) => trace.type),
            observations: (element as any).data.reduce(
                (sum: number, trace: any) => sum + (trace.y?.length || 0),
                0
            )
        }));
        expect(boxData.types.every((type: string) => type === 'box')).toBe(true);
        expect(boxData.observations).toBeGreaterThan(10);
    });
});
