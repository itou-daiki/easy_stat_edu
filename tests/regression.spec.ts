
import { test, expect } from '@playwright/test';
import { loadParamsFromConfig, navigateToFeature, uploadFile, selectStandardOption } from './utils/test-helpers';

test.describe('Regression Analysis Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('should run Simple Regression successfully', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');

        // Skip visibility check for hidden select, use robust selector
        await selectStandardOption(page, '#dependent-variable-select', '数学', 'label');
        await selectStandardOption(page, '#independent-variable-select', '英語', 'label');

        await page.click('#run-analysis-btn');

        await expect(page.locator('#analysis-result')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#analysis-result').textContent();
        expect(textContent).toContain('回帰式');
        expect(textContent).toContain('決定係数');

        await expect(page.locator('#regression-plot')).toBeVisible();
    });

    test('should run Multiple Regression successfully', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');

        await selectStandardOption(page, '#dependent-variable-select', '数学', 'label');

        // Checking multiple checkboxes for independent variables
        // If these inputs are hidden, our updated selectVariables or manual logic needed.
        // Assuming they are input[type=checkbox] with value="VarName"
        // Let's use robust manual check if needed, or page.check if visible.
        // If hidden, manual usage of robust strategy:
        const checkVar = async (val: string) => {
            const input = page.locator(`input.variable-checkbox[value="${val}"]`);
            if (await input.isVisible()) {
                await input.check();
            } else {
                await input.evaluate((el: HTMLInputElement) => {
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                });
            }
        };

        await checkVar('英語');
        await checkVar('理科');

        await page.click('#run-analysis-btn');

        await expect(page.locator('#analysis-result')).toBeVisible({ timeout: 30000 });
        const textContent = await page.locator('#analysis-result').textContent();
        expect(textContent).toContain('偏回帰係数');
        expect(textContent).toContain('自由度修正済み決定係数');
    });
});
