
import { test, expect } from '@playwright/test';
import { navigateToFeature, selectVariables } from './utils/test-helpers';

test.describe('Scatter Matrix Label Verification', () => {

    test('Verify X-axis labels are at the bottom of the matrix', async ({ page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Load Demo Data
        const loadDemoBtn = page.locator('#load-demo-btn');
        await expect(loadDemoBtn).toBeVisible();
        await loadDemoBtn.click();
        await expect(page.locator('#dataframe-container')).toBeVisible({ timeout: 30000 });

        // 3. Navigate to Correlation Analysis
        await navigateToFeature(page, 'correlation');
        await expect(page.locator('.correlation-container')).toBeVisible();

        // 4. Select Variables (Math, English, Science)
        // Corrected to use helper which handles the custom div-based multiselect
        await selectVariables(page, ['数学', '英語', '理科']);

        // 5. Run Analysis
        const runBtn = page.locator('#run-correlation-btn');
        await runBtn.click();
        await expect(page.locator('#scatter-matrix')).toBeVisible({ timeout: 60000 });

        // 6. Verify Label Positions
        const scatterMatrix = page.locator('#scatter-matrix');
        await scatterMatrix.scrollIntoViewIfNeeded();

        // Wait for Plotly to render labels
        await page.waitForTimeout(2000);

        // Get all text elements in the scatter matrix SVG
        const texts = scatterMatrix.locator('svg text');
        const count = await texts.count();

        const targetVariables = ['数学', '英語', '理科'];
        const labelPositions: any[] = [];

        for (let i = 0; i < count; i++) {
            const el = texts.nth(i);
            const content = await el.textContent();
            if (content && targetVariables.includes(content)) {
                const box = await el.boundingBox();
                if (box) {
                    labelPositions.push({ content, ...box });
                }
            }
        }

        console.log('Found labels:', labelPositions);

        expect(labelPositions.length).toBeGreaterThanOrEqual(3);

        // Sort by Y coordinate (descending Y means lower on screen)
        labelPositions.sort((a, b) => b.y - a.y);

        // The bottom-most labels should be our X-axis labels.
        // Let's take the bottom 3.
        const bottomLabels = labelPositions.slice(0, 3);

        const matrixBox = await scatterMatrix.boundingBox();
        if (!matrixBox) throw new Error('Scatter matrix bounding box not found');

        // Check 1: Are they close to the bottom of the container?
        for (const label of bottomLabels) {
            const relativeY = (label.y - matrixBox.y) / matrixBox.height;
            console.log(`Label ${label.content} relative Y: ${relativeY}`);
            expect(relativeY).toBeGreaterThan(0.8); // Must be in the bottom 20%
        }
    });
});
