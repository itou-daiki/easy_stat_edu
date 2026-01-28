// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Mixed ANOVA Multi-Pair Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset (Mixed ANOVA demo)
    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/2way_anova_demo_mix.xlsx');

    // Create a promise to wait for file processing
    const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });

    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

    await fileInput.setInputFiles(filePath);
    await previewVisiblePromise;

    // 3. Navigate to Two-Way ANOVA Analysis
    const card = page.locator('.feature-card[data-analysis="anova_two_way"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('#analysis-area')).toBeVisible();

    // 4. Select "Mixed Design"
    const mixedLabel = page.locator('label').filter({ hasText: '混合計画 (Mixed)' });
    await mixedLabel.click();
    await expect(page.locator('#mixed-controls')).toBeVisible();

    // 5. Select Between-Subjects Factor
    // Assuming 'Class' is a suitable factor (index 1)
    await page.selectOption('#mixed-between-var', { index: 1 });

    // 6. Add First Pair (Pre -> Post)
    // Select Pre
    const preContainer = page.locator('#mixed-var-pre-container');
    await preContainer.locator('.pairs-select-input').waitFor({ state: 'visible', timeout: 5000 });
    await preContainer.locator('.pairs-select-input').click();
    await preContainer.locator('.pairs-select-option').nth(2).click(); // e.g. Pre_Score
    await page.locator('h1').click(); // Close dropdown

    // Select Post
    const postContainer = page.locator('#mixed-var-post-container');
    await postContainer.locator('.pairs-select-input').waitFor({ state: 'visible', timeout: 5000 });
    await postContainer.locator('.pairs-select-input').click();
    await postContainer.locator('.pairs-select-option').nth(3).click(); // e.g. Post_Score
    await page.locator('h1').click(); // Close dropdown

    // Click Add Pair
    await page.locator('#add-mixed-pair-btn').click();

    // Check first pair added
    await expect(page.locator('#selected-mixed-pairs-list')).toContainText('リスニング力（前）');

    // 7. Add Second Pair (Pre_2 -> Post_2) or reuse validation
    // Let's reuse for simplicity if file doesn't have 4 vars, or use other vars if available.
    // The demo file typically has ID, Class, Pre_Score, Post_Score. 
    // If not enough vars, we can reuse. Let's try to add the SAME pair again to trigger "multi-pair" logic event if contents duplicate.
    // Or ideally, the user meant different variables.
    // Let's assume we can add the same pair again for stress testing the loop.

    await preContainer.locator('.pairs-select-input').click();
    await preContainer.locator('.pairs-select-option').nth(0).click();
    await page.locator('h1').click();

    await postContainer.locator('.pairs-select-input').click();
    await postContainer.locator('.pairs-select-option').nth(1).click();
    await page.locator('h1').click();

    await page.locator('#add-mixed-pair-btn').click();

    // Check second pair added
    await expect(page.locator('#selected-mixed-pairs-list .selected-pair-item')).toHaveCount(2);

    // 8. Run Analysis
    // Listen for page errors
    page.on('pageerror', exception => {
        console.error(`[Page Error]: ${exception}`);
    });

    const runBtn = page.locator('#run-mixed-anova');
    await runBtn.click();

    // 9. Verify Results
    // Should see results for BOTH pairs
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    // Should have 2 result tables
    await expect(page.locator('h4:has-text("混合計画分散分析の結果")')).toHaveCount(2);
});
