// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Mixed ANOVA Multi-Pair Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('http://127.0.0.1:8081/');
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
    const mixedLabel = page.locator('label').filter({ hasText: '混合計画（Mixed）' });
    await mixedLabel.click();
    await expect(page.locator('#mixed-controls')).toBeVisible();

    // 5. Select Between-Subjects Factor
    // Assuming 'Class' is a suitable factor (index 1)
    await page.selectOption('#mixed-between-var', { index: 1 });

    // 6. Map Variables for First Pair
    const firstRow = page.locator('#pair-selector-container-list .pair-row').first();
    const ops = await firstRow.locator('.pre-select').locator('option').allInnerTexts();
    console.log('[DEBUG] pre-select options:', ops);

    // Select the Pre_Score and Post_Score by label instead of index to be explicit
    await firstRow.locator('.pre-select').selectOption({ label: 'リーディング力（前）' });

    // Check Data Preview Visibility
    const dataPreview = page.locator('#anova-data-overview');
    await expect(dataPreview).toBeVisible();

    await firstRow.locator('.post-select').selectOption({ label: 'リーディング力（後）' });

    // Check first pair added (Assuming results component gets updated, but logic removed to check pairs list explicitly as it doesn't exist anymore)

    // 7. Add Second Pair (Pre_2 -> Post_2) or reuse validation
    // Let's reuse for simplicity if file doesn't have 4 vars, or use other vars if available.
    // The demo file typically has ID, Class, Pre_Score, Post_Score. 
    // If not enough vars, we can reuse. Let's try to add the SAME pair again to trigger "multi-pair" logic event if contents duplicate.
    // Or ideally, the user meant different variables.
    // Let's assume we can add the same pair again for stress testing the loop.

    await page.locator('button:has-text("ペアを追加")').click();
    const secondRow = page.locator('#pair-selector-container-list .pair-row').nth(1);
    await secondRow.locator('.pre-select').selectOption({ label: 'リスニング力（前）' });
    await secondRow.locator('.post-select').selectOption({ label: 'リスニング力（後）' });

    // Check second pair added
    await expect(page.locator('#pair-selector-container-list .pair-row')).toHaveCount(2);

    // 8. Run Analysis
    // Listen for page errors and dialogs
    page.on('pageerror', exception => {
        console.error(`[Page Error]: ${exception}`);
    });
    page.on('dialog', async dialog => {
        console.log(`[Dialog]: ${dialog.message()}`);
        await dialog.dismiss();
    });

    const runBtn = page.locator('#run-mixed-anova-btn');
    await runBtn.click();

    // 9. Verify Results
    // Should see results for BOTH pairs
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    const html = await page.locator('#analysis-results').innerHTML();
    console.log(html);
    // Should have 2 result tables
    await expect(page.locator('h4:has-text("混合要因分散分析表")')).toHaveCount(2);
});
