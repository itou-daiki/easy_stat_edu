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

    // 6. Verify Heatmap Visibility
    const heatmapContainer = page.locator('#correlation-heatmap');
    await expect(heatmapContainer).toBeVisible();

    // Verify that Plotly graph is rendered inside
    // Plotly usually adds a main-svg or user-select-none class
    // Verify that Plotly graph is rendered inside
    // Plotly usually adds a main-svg or user-select-none class
    // Use .first() to avoid strict mode violations if multiple layers exist
    await expect(heatmapContainer.locator('.main-svg').first()).toBeVisible({ timeout: 10000 });

    // Screenshot for proof
    await page.screenshot({ path: 'correlation_heatmap_verification.png', fullPage: true });
});
