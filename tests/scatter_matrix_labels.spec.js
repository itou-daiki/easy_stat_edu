// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Scatter Matrix Label Verification', () => {

    test('Verify X-axis labels are at the bottom of the matrix', async ({ page }) => {
        // 1. Load Application
        await page.goto('http://127.0.0.1:8080/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Load Demo Data
        const loadDemoBtn = page.locator('#load-demo-btn');
        await expect(loadDemoBtn).toBeVisible();
        await loadDemoBtn.click();
        await expect(page.locator('#dataframe-container')).toBeVisible({ timeout: 30000 });

        // 3. Navigate to Correlation Analysis
        const card = page.locator('.feature-card[data-analysis="correlation"]');
        await card.click();
        await expect(page.locator('.correlation-container')).toBeVisible();

        // 4. Select Variables (Math, English, Science)
        const multiSelectInput = page.locator('#corr-vars-container .multiselect-input');
        await multiSelectInput.click();

        // Assuming order or searching by text. Let's try text based locator for robustness
        const mathOption = page.locator('#corr-vars-container .multiselect-options li', { hasText: '数学' });
        const engOption = page.locator('#corr-vars-container .multiselect-options li', { hasText: '英語' });
        const sciOption = page.locator('#corr-vars-container .multiselect-options li', { hasText: '理科' });

        await mathOption.click();
        await engOption.click();
        await sciOption.click();

        // Close dropdown
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 5. Run Analysis
        const runBtn = page.locator('#run-correlation-btn');
        await runBtn.click();
        await expect(page.locator('#scatter-matrix')).toBeVisible({ timeout: 60000 });

        // 6. Verify Label Positions
        // We will scroll to the scatter matrix
        const scatterMatrix = page.locator('#scatter-matrix');
        await scatterMatrix.scrollIntoViewIfNeeded();

        // Wait for Plotly to render labels
        await page.waitForTimeout(2000);

        // Get bounding boxes of the LAST row's ticks to establish the "bottom" line
        // The scatter matrix layout:
        // Row 1: Math
        // Row 2: English
        // Row 3: Science
        // We expect X-axis labels for Math, English, Science to be BELOW Row 3.

        // Plotly uses SVG text elements.
        // We want to find text elements "数学", "英語", "理科" that correspond to x-axis labels.
        // There might be y-axis labels too (on the left). Y-axis labels would be vertically distributed.
        // X-axis labels should be horizontally distributed but VERTICALLY aligned near the bottom.

        // Get all text elements in the scatter matrix SVG
        const texts = scatterMatrix.locator('svg text');
        const count = await texts.count();

        // Find the X-axis labels. 
        // Heuristic: They should be the ones with the largest Y coordinates.
        // Or specific text content.

        const targetVariables = ['数学', '英語', '理科'];
        const labelPositions = [];

        for (let i = 0; i < count; i++) {
            const el = texts.nth(i);
            const content = await el.textContent();
            if (targetVariables.includes(content)) {
                const box = await el.boundingBox();
                if (box) {
                    labelPositions.push({ content, ...box });
                }
            }
        }

        // We expect at least 6 labels (3 x-axis, 3 y-axis) ideally.
        // Or if the implementation uses shared labels, maybe just 3+3.
        console.log('Found labels:', labelPositions);

        expect(labelPositions.length).toBeGreaterThanOrEqual(3);

        // Sort by Y coordinate
        labelPositions.sort((a, b) => b.y - a.y);

        // The bottom-most labels should be our X-axis labels.
        // Let's take the bottom 3.
        const bottomLabels = labelPositions.slice(0, 3);
        const topLabels = labelPositions.slice(3); // The rest (likely Y-axis labels)

        // Verify that the bottom labels are indeed "at the bottom"
        // We can check if they are below the plot area. 
        // A simple check is that their Y is significantly larger than the others.
        // But a more robust check involves the container height.
        const matrixBox = await scatterMatrix.boundingBox();
        if (!matrixBox) throw new Error('Scatter matrix bounding box not found');

        const matrixBottom = matrixBox.y + matrixBox.height;

        // Check 1: Are they close to the bottom of the container?
        // (Plotly adds some margin, so they won't be exactly at the edge, but should be close)
        // Let's say within the bottom 15% of the height or at least below the 80% mark.
        for (const label of bottomLabels) {
            const relativeY = (label.y - matrixBox.y) / matrixBox.height;
            console.log(`Label ${label.content} relative Y: ${relativeY}`);
            expect(relativeY).toBeGreaterThan(0.8); // Must be in the bottom 20%
        }

        // Check 2: Are they below the "Science" Y-axis label or ticks?
        // If they are "floating in the middle", their Y would be roughly 0.33 or 0.66.
        // If they are at the bottom, they should be > 0.9 roughly.

    });
});
