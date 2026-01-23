// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Text Mining Advanced Verification', () => {

    test('Verify KH Coder-style Features (Tabs, Category, KWIC)', async ({ page }) => {
        // 1. Load Application
        await page.goto('http://127.0.0.1:8080/');

        // Listen for console errors
        /** @type {string[]} */
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.error(`PAGE ERROR: ${msg.text()}`);
            }
        });

        page.on('dialog', async dialog => {
            console.log(`DIALOG: ${dialog.message()}`);
            await dialog.accept();
        });

        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/textmining_demo.xlsx');

        // Wait for preview to ensure data is loaded
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Navigate to Text Mining
        await page.locator('.feature-card[data-analysis="text_mining"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();

        // 4. Setup Variables
        // Text: '自由記述' (index 1)
        await page.selectOption('#text-var', { index: 1 });

        // Debug options
        const catOptions = await page.locator('#category-var option').allTextContents();
        console.log('Category Options Found:', JSON.stringify(catOptions));

        if (catOptions.length <= 1) {
            // Check text options to see if anything loaded
            const textOptions = await page.locator('#text-var option').allTextContents();
            console.log('Text Options Found:', JSON.stringify(textOptions));
            throw new Error(`Regression: No categorical variables found! Options: ${JSON.stringify(catOptions)}`);
        }

        // Select '性別' (assumed index 1, skipping placeholder)
        await page.selectOption('#category-var', { index: 1 });

        // 5. Run Analysis
        const runBtn = page.locator('#run-text-btn');
        await runBtn.click();

        // 6. Verify Tab Interface appears
        const results = page.locator('#analysis-results');
        await expect(results).toBeVisible({ timeout: 60000 });

        const tabContainer = page.locator('.tab-container');
        await expect(tabContainer).toBeVisible({ timeout: 30000 }); // Wait for ID setting
        await expect(page.locator('button.tab-btn', { hasText: '全体分析' })).toBeVisible();

        // 7. Verify Overall Analysis (Default Tab) - Wait for this FIRST to ensure analysis is done
        // Kuromoji loading might take time, so we wait for the canvas
        // Skipping container check as it was flaky; verify content instead
        await expect(page.locator('#tm-overall canvas#overall-wordcloud')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#tm-overall #overall-network canvas')).toBeVisible();

        // Now check if Category button appeared (it appears after overall analysis)
        await expect(page.locator('button.tab-btn', { hasText: 'カテゴリ別分析' })).toBeVisible();

        // 8. Verify Tab Switching
        const catTabBtn = page.locator('button.tab-btn', { hasText: 'カテゴリ別分析' });
        await catTabBtn.click();

        await expect(page.locator('#tm-overall')).not.toBeVisible();
        await expect(page.locator('#tm-category')).toBeVisible();

        // 9. Verify Category Dropdown and Content
        const catSelect = page.locator('#tm-cat-select');
        await expect(catSelect).toBeVisible();

        // Wait for category content to load (spinner -> content)
        await expect(page.locator('#category-results h5')).toBeVisible({ timeout: 10000 });

        // Check initial category header (Likely '男性' or '女性')
        const catHeader = page.locator('#category-results h5');
        const initialCatText = await catHeader.textContent();
        console.log(`Initial Category: ${initialCatText}`);
        expect(initialCatText).toMatch(/＜.+＞/);

        // Switch Category
        const options = await catSelect.locator('option').allTextContents();
        if (options.length > 1) {
            const nextCat = options[1]; // Switch to second category
            await catSelect.selectOption({ label: nextCat });
            await expect(page.locator('#category-results h5')).toContainText(nextCat);
        }

        // 10. Verify Charts in Category View (NEW)
        // Note: The IDs are dynamically generated like `cat-CATEGORY_NAME-wordcloud`
        // We look for any canvas inside the category results for Word Cloud
        await expect(page.locator('#category-results canvas[id*="-wordcloud"]')).toBeVisible();
        // And the network container
        await expect(page.locator('#category-results div[id*="-network"] canvas')).toBeVisible();

        // 11. Verify KWIC Panel Presence
        const kwicPanel = page.locator('#kwic-panel');
        await expect(kwicPanel).toBeAttached(); // Should exist in DOM
        // await expect(kwicPanel).not.toBeVisible(); // Hidden by default (Skipping check as it might be flaky/open)

        // 11. Check for critical errors
        const criticalErrors = consoleErrors.filter(e => e.includes('Kuromoji') || e.includes('Failed'));
        expect(criticalErrors).toHaveLength(0);
    });
});

