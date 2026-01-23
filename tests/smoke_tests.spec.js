// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

// Helper function to handle custom MultiSelect component (used in T-Test dependent var)
/**
 * @param {import('@playwright/test').Page} page
 * @param {string} containerId
 * @param {number} [count=1]
 */
async function selectCustomMultiSelect(page, containerId, count = 1) {
    const containerSelector = `#${containerId}`;
    const multiSelectInput = page.locator(`${containerSelector} .multiselect-input`);
    await expect(multiSelectInput).toBeVisible();

    // Open dropdown
    await multiSelectInput.click();

    const options = page.locator(`${containerSelector} .multiselect-dropdown .multiselect-option`);
    const optionsContainer = page.locator(`${containerSelector} .multiselect-dropdown`);

    for (let i = 0; i < count; i++) {
        // Ensure dropdown is visible
        if (!(await optionsContainer.isVisible())) {
            await multiSelectInput.click();
            await expect(optionsContainer).toBeVisible();
        }
        await options.nth(i).click();
    }

    // Close dropdown
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Verify selection (tags should verify count)
    // Note: If count > 1, checking count is good. If i picked same option twice (unlikely with nth(i)), it might toggle.
    // nth(i) picks different options presumably.
    await expect(page.locator(`${containerSelector} .multiselect-tag`)).toHaveCount(count, { timeout: 5000 });
}

// Helper to select a variable from a standard select element
/**
 * @param {import('@playwright/test').Page} page
 * @param {string} selectId
 * @param {number} [index=1]
 */
async function selectStandardOption(page, selectId, index = 1) {
    const select = page.locator(`#${selectId}`);
    await expect(select).toBeVisible();

    // Check if it has options
    const optionCount = await select.locator('option').count();
    if (optionCount > index) {
        await select.selectOption({ index: index });
    } else if (optionCount > 0) {
        await select.selectOption({ index: 0 });
    }

    // Verify selection is not empty (unless placeholder has empty value)
    const val = await select.inputValue();
    // If index 0 is placeholder "", and we selected it (fallback), then val is "". This happens if options <= index.
    // But we expect valid selection.
    // console.log(`Selected value for #${selectId}: "${val}"`);
    // Ideally we want a non-empty value for the test to proceed
    if (val === "") {
        console.warn(`Warning: Selected empty value for #${selectId}. Analysis might fail.`);
    }
}

/**
 * @typedef {Object} AnalysisConfig
 * @property {string} name
 * @property {string} file
 * @property {string} cardSelector
 * @property {(page: import('@playwright/test').Page) => Promise<void>} setup
 * @property {string} [runBtn]
 * @property {string} [resultSelector]
 */

/** @type {AnalysisConfig[]} */
const analyses = [
    {
        name: 'EDA',
        file: 'eda_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="eda"]',
        setup: async (page) => {
            // EDA runs automatically, no selection needed
        },
        runBtn: '#run-eda-btn', // Note: EDA runs on load, but button might re-run. Smoke test might just check results.
        resultSelector: '#eda-summary-stats' // Checking for summary stats container
    },
    {
        name: 'T-Test',
        file: 'ttest_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="ttest"]',
        setup: async (page) => {
            // Group variable (Standard Select)
            await selectStandardOption(page, 'group-var', 1);
            // Target variable (Custom MultiSelect)
            // Target variable (Custom MultiSelect)
            await selectCustomMultiSelect(page, 'dep-var-multiselect', 1);
        },
        runBtn: '#run-independent-btn',
        resultSelector: '#results-section'
    },
    {
        name: 'ANOVA (One-way)',
        file: 'anova_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="anova_one_way"]',
        setup: async (page) => {
            await selectStandardOption(page, 'factor-var', 1);
            await selectCustomMultiSelect(page, 'dependent-var-container', 1); // Numeric variable (Multi-select)
        },
        runBtn: '#run-ind-anova-btn',
        resultSelector: '#analysis-results'
    },
    {
        name: 'Regression (Multiple)',
        file: 'multiple_regression_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="regression_multiple"]',
        setup: async (page) => {
            await selectCustomMultiSelect(page, 'dependent-var-container', 1); // Target variable (Index 0)
            // Need to ensure we pick a different one for independent var.
            // selectCustomMultiSelect picks first visible options by default.
            // To pick different ones, we need a way to skip or pick specifically.
            // Simplified fix: Just let it pick, but then deselect/reselect? No, that's hard.
            // Better: update selectCustomMultiSelect to accept an offset or index.
            // Or just manually select in the test block here without helper if needed.
            // Actually, helper uses `nth(i)`. So if I call it on index 0, it picks first.
            // I need to update the helper or just manually pick the second one here.

            // Manual selection for independent variable (Index 1) to avoid overlap
            const containerId = 'independent-vars-container';
            const multiSelectInput = page.locator(`#${containerId} .multiselect-input`);
            await multiSelectInput.click();
            const options = page.locator(`#${containerId} .multiselect-dropdown .multiselect-option`);
            await options.nth(1).click(); // Pick the SECOND option
            await page.locator('body').click({ position: { x: 0, y: 0 } });
        },
        runBtn: '#run-regression-btn',
        resultSelector: '#regression-results'
    },
    {
        name: 'PCA',
        file: 'factor_analysis_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="pca"]',
        setup: async (page) => {
            await selectCustomMultiSelect(page, 'pca-vars-container', 2); // Multi-select, pick 2 vars
        },
        runBtn: '#run-pca-btn',
        resultSelector: '#analysis-results'
    },
    {
        name: 'Chi-Square',
        file: 'chi_square_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="chi_square"]',
        setup: async (page) => {
            await selectStandardOption(page, 'row-var', 1);
            await selectStandardOption(page, 'col-var', 2); // Use different variable (Index 0 is placeholder)
        },
        runBtn: '#run-chi-btn',
        resultSelector: '#chi-results'
    },
    {
        name: 'Text Mining',
        file: 'textmining_demo.xlsx',
        cardSelector: '.feature-card[data-analysis="text_mining"]',
        setup: async (page) => {
            await selectStandardOption(page, 'text-var', 1);
            // Category var is optional
        },
        runBtn: '#run-text-btn',
        resultSelector: '#analysis-results'
    }
];

test.describe('Smoke Tests for all Analyses', () => {

    for (const analysis of analyses) {
        test(`Verify ${analysis.name} Analysis`, async ({ page }) => {
            // 1. Load Application
            await page.goto('http://127.0.0.1:8080/');

            // Debug: Log console messages and dialogs
            page.on('console', msg => console.log(`PAGE LOG (${analysis.name}): ${msg.text()}`));
            page.on('dialog', async dialog => {
                console.log(`DIALOG (${analysis.name}): ${dialog.message()}`);
                await dialog.dismiss();
            });

            await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

            // 2. Upload Data
            const uploadBtn = page.locator('#main-upload-btn');
            await expect(uploadBtn).toBeEnabled({ timeout: 30000 });

            const fileInput = page.locator('#main-data-file');
            const filePath = path.join(__dirname, `../datasets/${analysis.file}`);

            // Wait for preview
            const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
            await fileInput.setInputFiles(filePath);
            await previewVisiblePromise;

            // 3. Navigate to Analysis
            const card = page.locator(analysis.cardSelector);
            await card.click();
            await expect(page.locator('#analysis-area')).toBeVisible();

            // 4. Setup Variables
            await analysis.setup(page);

            // 5. Run Analysis
            // For EDA, button might not exist if it runs automatically.
            if (analysis.name !== 'EDA' && analysis.runBtn) {
                const runBtn = page.locator(analysis.runBtn);
                await expect(runBtn).toBeVisible();
                await runBtn.click();
            }

            // 6. Verify Results
            // Check for result container visibility or specific content
            // Using a broader check if specific ID is uncertain
            if (analysis.resultSelector) {
                await expect(page.locator(analysis.resultSelector)).toBeVisible({ timeout: 60000 });
            }
        });
    }
});
