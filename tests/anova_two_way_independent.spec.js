// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Independent ANOVA Verification', async ({ page }) => {
    // 1. Load the application
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload sample dataset
    const uploadBtn = page.locator('#main-upload-btn');
    await expect(uploadBtn).toBeEnabled({ timeout: 30000 });

    const fileInput = page.locator('#main-data-file');
    // Using the independent ANOVA demo file
    const filePath = path.join(__dirname, '../datasets/2way_anova_demo.xlsx');

    // Create a promise to wait for file processing
    const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });

    await fileInput.setInputFiles(filePath);
    await previewVisiblePromise;

    // 3. Navigate to Two-Way ANOVA Analysis
    const card = page.locator('.feature-card[data-analysis="anova_two_way"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('#analysis-area')).toBeVisible();

    // Check Data Preview Visibility
    const dataPreview = page.locator('#anova2-data-overview');
    await expect(dataPreview).toBeVisible();
    // Check if the "Data Preview" header exists inside it
    await expect(dataPreview).toContainText('データプレビュー');

    // 4. Ensure "Independent" is selected (default)
    const independentRadio = page.locator('input[name="anova2-type"][value="independent"]');
    await expect(independentRadio).toBeChecked();
    await expect(page.locator('#independent-controls')).toBeVisible();

    // 5. Select Factors and Dependent Variable
    await expect(page.locator('#factor1-var option')).not.toHaveCount(0);

    // Select factors (assuming typical structure in demo file)
    await page.selectOption('#factor1-var', { index: 1 });
    await page.selectOption('#factor2-var', { index: 2 }); // Need 2 different factors

    // Select Dependent Variable
    // Select Dependent Variable (Multiselect)
    // Multiselect container creates a hidden select with the ID 'dependent-var'
    // and a visual interface. We need to interact with the visual interface.
    const depVarContainer = page.locator('#dependent-var-container');
    const multiSelectInput = depVarContainer.locator('.multiselect-input');
    await multiSelectInput.click();

    // Select the first available option in the dropdown
    const firstOption = depVarContainer.locator('.multiselect-option').nth(0);
    await firstOption.click();

    // Click title to close dropdown (clicking body might be ambiguous or intercepted)
    await page.locator('h1').click();

    // Ensure dropdown is closed before proceeding
    const dropdown = depVarContainer.locator('.multiselect-dropdown');
    await expect(dropdown).not.toHaveClass(/open/);

    // 6. Run Analysis
    // The button has ID 'run-ind-anova' attached to it.
    // However, if the element with id 'run-ind-btn' is a div containing the button, 
    // we should target the button inside
    const runBtn = page.locator('#run-ind-anova');
    await runBtn.click();

    // 7. Verify Results
    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#test-results-section')).toBeVisible();

    // Check for specific text indicating independent ANOVA results.
    // Usually tables have headers like "要因間 (Between)"
    await expect(page.locator('#test-results-section')).toContainText('分散分析表');
    await expect(page.locator('#test-results-section')).toContainText('部活動');
    await expect(page.locator('#test-results-section')).toContainText('学年');

    // Also verify no error alerts - if runBtn click causes alert, it stops execution or shows dialog.
    // Playwright handles dialogs automatically by dismissing them usually, unless configured.
    // We can add a handler if we expect success.
});
