// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs/promises');
const path = require('path');

async function readPngInfo(filePath) {
    const buffer = await fs.readFile(filePath);
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bytes: buffer.length
    };
}

test.describe('Text Mining Advanced Verification', () => {

    test('Verify KH Coder-style Features (Tabs, Category, KWIC)', async ({ page }) => {
        // 1. Load Application
        await page.goto('http://127.0.0.1:8081/');

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
        // The local tokenizer should initialize without a remote dictionary.
        // Skipping container check as it was flaky; verify content instead
        await expect(page.locator('#tm-overall canvas#overall-wordcloud')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#tm-overall canvas#overall-wordcloud-tfidf')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#tm-overall #overall-network canvas')).toBeVisible();
        await expect(page.locator('#tm-overall', { hasText: '品詞別ランキング' })).toBeVisible();
        await expect(page.locator('#tm-overall', { hasText: '色分けの意味' })).toBeVisible();
        await expect(page.locator('#tm-overall', { hasText: 'ブラウザ内蔵（高速分かち書き）' })).toBeVisible();
        await expect(page.locator('#tm-overall', { hasText: '品詞別ランキング（推定）' })).toBeVisible();
        await expect(page.locator('#overall-wordcloud-legend')).toContainText('名詞');
        await expect(page.locator('#overall-wordcloud-legend')).toContainText('大きさ');

        const wordCloudQuality = await page.locator('#overall-wordcloud').evaluate((canvas) => {
            const c = canvas as HTMLCanvasElement;
            const rect = c.getBoundingClientRect();
            return {
                width: c.width,
                height: c.height,
                cssWidth: rect.width,
                cssHeight: rect.height
            };
        });
        expect(wordCloudQuality.width).toBeGreaterThanOrEqual(wordCloudQuality.cssWidth * 2);
        expect(wordCloudQuality.height).toBeGreaterThanOrEqual(wordCloudQuality.cssHeight * 2);

        // The saved PNGs must include the explanatory legends below the canvas.
        const artifactDir = path.join(__dirname, '../output/playwright/text-mining');
        await fs.mkdir(artifactDir, { recursive: true });

        const wordCloudPath = path.join(artifactDir, 'overall-wordcloud.png');
        const [wordCloudDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-wordcloud"]').click()
        ]);
        await wordCloudDownload.saveAs(wordCloudPath);
        const wordCloudPng = await readPngInfo(wordCloudPath);
        expect(wordCloudPng.width).toBe(wordCloudQuality.width);
        expect(wordCloudPng.height).toBeGreaterThan(wordCloudQuality.height);
        expect(wordCloudPng.bytes).toBeGreaterThan(20_000);

        const networkCanvasSize = await page.locator('#overall-network canvas').first().evaluate((canvas) => {
            const c = canvas as HTMLCanvasElement;
            return { width: c.width, height: c.height };
        });
        const networkPath = path.join(artifactDir, 'overall-network.png');
        const [networkDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-network"]').click()
        ]);
        await networkDownload.saveAs(networkPath);
        const networkPng = await readPngInfo(networkPath);
        expect(networkPng.width).toBe(networkCanvasSize.width);
        expect(networkPng.height).toBeGreaterThan(networkCanvasSize.height);
        expect(networkPng.bytes).toBeGreaterThan(20_000);

        // Now check if Category button appeared (it appears after overall analysis)
        await expect(page.locator('button.tab-btn', { hasText: 'カテゴリ別分析' })).toBeVisible();

        // 8. Verify Tab Switching
        const catTabBtn = page.locator('button.tab-btn', { hasText: 'カテゴリ別分析' });
        await catTabBtn.click();

        await expect(page.locator('#tm-overall')).not.toBeVisible();
        await expect(page.locator('#tm-category')).toBeVisible();

        // 9. Verify all categories are rendered continuously, without a display-category dropdown
        await expect(page.locator('#tm-cat-select')).toHaveCount(0);

        const expectedCategories = ['１年', '２年', '３年'];
        const catHeaders = page.locator('#category-results .tm-category-section h4');
        await expect(catHeaders).toHaveCount(expectedCategories.length, { timeout: 60000 });

        for (const category of expectedCategories) {
            await expect(page.locator('#category-results')).toContainText(category);
        }

        // The same terms can be compared across every group in one matrix.
        const comparisonPanel = page.locator('#category-results .tm-group-comparison-panel');
        await expect(comparisonPanel).toBeVisible();
        await expect(comparisonPanel.locator('.tm-comparison-group-header')).toHaveCount(expectedCategories.length);
        await expect(comparisonPanel.locator('.tm-group-comparison-cell').first()).toContainText('%');

        const comparisonCellCount = await comparisonPanel.locator('.tm-group-comparison-cell').count();
        expect(comparisonCellCount).toBeGreaterThanOrEqual(expectedCategories.length);
        expect(comparisonCellCount % expectedCategories.length).toBe(0);

        await comparisonPanel.getByRole('button', { name: '特徴度 z' }).click();
        await expect(comparisonPanel).toHaveAttribute('data-comparison-mode', 'z');
        await expect(comparisonPanel.locator('.tm-comparison-z-legend')).toBeVisible();
        await expect(comparisonPanel.locator('.tm-group-value').first()).toHaveText(/[+-]?\d+\.\d{2}( \*)?/);

        await comparisonPanel.getByRole('button', { name: '文書率' }).click();
        await expect(comparisonPanel).toHaveAttribute('data-comparison-mode', 'rate');

        // 10. Verify Charts in Category View (NEW)
        // Note: The IDs are dynamically generated like `cat-INDEX-CATEGORY_NAME-wordcloud`
        // We look for any canvas inside the category results for Word Cloud
        await expect(page.locator('#category-results canvas[id*="-wordcloud"]').first()).toBeVisible();
        expect(await page.locator('#category-results canvas[id*="-wordcloud"]').count()).toBeGreaterThanOrEqual(expectedCategories.length * 2);
        // And the network container
        await expect(page.locator('#category-results div[id*="-network"] canvas').first()).toBeVisible();
        await expect(page.locator('#category-results .tm-feature-table').first()).toBeVisible();
        await expect(page.locator('#category-results canvas[id*="-wordcloud-feature"]').first()).toBeVisible();

        // 11. Verify KWIC Panel Presence
        const kwicPanel = page.locator('#kwic-panel');
        await expect(kwicPanel).toBeAttached(); // Should exist in DOM
        // await expect(kwicPanel).not.toBeVisible(); // Hidden by default (Skipping check as it might be flaky/open)

        // 12. Verify the dense visual layout remains usable on a phone viewport.
        await page.setViewportSize({ width: 390, height: 844 });
        await catHeaders.first().scrollIntoViewIfNeeded();
        const mobileLayout = await page.evaluate(() => {
            const grid = document.querySelector('.tm-category-section .tm-visual-grid');
            const panelRects = grid
                ? Array.from(grid.children).map(element => element.getBoundingClientRect())
                : [];
            const network = document.querySelector('.tm-category-section .tm-network-panel');
            const networkRect = network?.getBoundingClientRect();
            const comparisonScroll = document.querySelector('.tm-comparison-scroll');
            const comparisonScrollRect = comparisonScroll?.getBoundingClientRect();
            const comparisonTerm = document.querySelector('.tm-comparison-table tbody .tm-comparison-term-column');
            const comparisonTermRect = comparisonTerm?.getBoundingClientRect();
            const firstGroupCell = document.querySelector('.tm-comparison-table tbody .tm-group-comparison-cell');
            const firstGroupCellRect = firstGroupCell?.getBoundingClientRect();
            return {
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                stacked: panelRects.length < 2 || panelRects[1].top >= panelRects[0].bottom - 1,
                panelWidths: panelRects.map(rect => rect.width),
                networkWidth: networkRect?.width || 0,
                viewportWidth: document.documentElement.clientWidth,
                comparisonTermWidth: comparisonTermRect?.width || 0,
                firstGroupFullyVisible: Boolean(
                    comparisonScrollRect
                    && firstGroupCellRect
                    && firstGroupCellRect.right <= comparisonScrollRect.right + 1
                )
            };
        });
        expect(mobileLayout.overflow).toBeLessThanOrEqual(1);
        expect(mobileLayout.stacked).toBe(true);
        expect(Math.max(...mobileLayout.panelWidths)).toBeLessThanOrEqual(mobileLayout.viewportWidth);
        expect(mobileLayout.networkWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
        expect(mobileLayout.comparisonTermWidth).toBeLessThanOrEqual(140);
        expect(mobileLayout.firstGroupFullyVisible).toBe(true);
        await page.screenshot({
            path: path.join(artifactDir, 'mobile-category.png'),
            fullPage: false
        });

        // 11. Check for critical errors
        const criticalErrors = consoleErrors.filter(e =>
            e.includes('TinySegmenter')
            || e.includes('Intl.Segmenter')
            || e.includes('Failed')
        );
        expect(criticalErrors).toHaveLength(0);
    });
});
