// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Correlation Analysis Heatmap Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('http://127.0.0.1:8080/');

    // Wait for loading screen to disappear
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    // Wait for upload button to be enabled (initialization complete)
    const uploadBtn = page.locator('#main-upload-btn');
    await expect(uploadBtn).toBeEnabled({ timeout: 30000 });

    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/correlation_demo.xlsx');

    // Create a promise to wait for file processing (preview container visible)
    const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });

    await fileInput.setInputFiles(filePath);

    // Wait until processing is done
    await previewVisiblePromise;

    // 3. Navigate to Correlation Analysis
    const correlationCard = page.locator('.feature-card[data-analysis="correlation"]');
    await correlationCard.click();

    // Wait for analysis area to be visible
    await expect(page.locator('#analysis-area')).toBeVisible();

    // 4. Select variables
    // Wait for Variable MultiSelect to appear
    const multiSelectInput = page.locator('#correlation-vars-container .multiselect-input');
    await expect(multiSelectInput).toBeVisible();

    // Open dropdown
    await multiSelectInput.click();

    // Select two variables (assuming "数学" and "理科" exist in correlation_demo.xlsx or similar numeric columns)
    // We'll just pick the first two options available in the dropdown
    // Select two variables
    // Select two variables
    const options = page.locator('#correlation-vars-container .multiselect-dropdown .multiselect-option');

    // Select first variable
    await options.first().click();

    // Ensure dropdown is still open or re-open it for the second variable
    const optionsContainer = page.locator('#correlation-vars-container .multiselect-dropdown');
    if (!(await optionsContainer.isVisible())) {
        await multiSelectInput.click();
        await expect(optionsContainer).toBeVisible();
    }

    // Select second variable
    await options.nth(1).click();

    // Close dropdown by clicking outside
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // 5. Run Analysis
    const runBtn = page.locator('#run-correlation-btn');
    await runBtn.click();

    // Verify Heatmap is visible
    const heatmapContainer = page.locator('#correlation-heatmap');
    await expect(heatmapContainer).toBeVisible();
    await expect(heatmapContainer.locator('.main-svg').first()).toBeVisible({ timeout: 10000 });

    // 7. Verify Scatter Scatter Matrix Visibility & Labels
    const scatterMatrix = page.locator('#scatter-matrix');
    await expect(scatterMatrix).toBeVisible();
    await expect(scatterMatrix.locator('.main-svg').first()).toBeVisible({ timeout: 10000 });

    // Verify axis labels (selected variables) are present in the scatter matrix
    // We captured the variable names earlier? No, let's capture them now or assume they are displayed.
    // The previous steps selected the first two options. Let's find out what they are.
    // However, it's safer to just check if *any* text is visible, but better to check for the specific var names.
    // Since we didn't capture them in variables, let's look for text that matches what we expect from the demo file or just generic check.

    // Better approach: Capture the text of the selected options during selection
    // But since we can't easily modify the logic above without replacing more code, let's just checking for generic SVG text elements isn't quite enough.
    // Let's rely on the screenshot for manual verification if exact text matching is hard without knowing var names.
    // BUT, we can inspect the DOM of the multiselect to see what is selected.

    // Let's try to capture the text from the chip elements in the multiselect input
    const selectedChips = page.locator('#correlation-vars-container .multiselect-tag');
    const var1Config = await selectedChips.nth(0).innerText();
    const var2Config = await selectedChips.nth(1).innerText();

    // Clean up text (remove '×' if it exists in innerText)
    const var1 = var1Config.replace('×', '').trim();
    const var2 = var2Config.replace('×', '').trim();

    // Check if these texts exists in the scatter matrix container
    await expect(scatterMatrix.getByText(var1).first()).toBeVisible();
    await expect(scatterMatrix.getByText(var2).first()).toBeVisible();

    // Screenshot for proof
    await page.screenshot({ path: 'correlation_verification.png', fullPage: true });
});
