const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Data Processing - Bulk Recode', () => {
    test('Verify Bulk Recode Functionality', async ({ page }) => {
        // 1. Load Application
        await page.goto('http://127.0.0.1:8080/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data (Using eda_demo.xlsx)
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/eda_demo.xlsx');

        // Wait for preview
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        // The data processing section is inside a collapsible, we might need to open it?
        // Actually, based on previous file reads, it seems to be part of the analysis flow or a separate section?
        // Looking at index.html (implied), there might be a "Data Processing" button or section.
        // Let's assume there is a way to access it. 
        // Wait, the data processing logic is in `js/analyses/data_processing.js`.
        // It seems to be rendered in a specific container.
        // Let's check `processData` function usage. It likely renders into an existing container or modal.
        // In `eda_demo.xlsx`, let's assume we are on the main page.
        // Is there a "Data Processing" tab or button? 
        // I need to find how to trigger the data processing view.
        // Let's look for a button with ID `process-data-btn` or similar in the main page source if possible, 
        // or just assume standard navigation if I knew it.
        // Since I don't see the navigation logic, I'll assume standard flow:
        // Load data -> Data Processing Section is available (maybe scrolling down?)

        // Let's check if `render` in `data_processing.js` is called. 
        // It is usually called when a specific tab/card is selected?
        // Or maybe it is always there?
        // Let's try to find the "Data Processing" card or section.
        // Based on `render(container, ...)` signature, it's likely a module.
        // In `index.html` (which I haven't seen fully but can guess), there might be a button to open it.

        // Let's assume there is a card for "Data Processing" or it's a step.
        // Actually, looking at `js/analyses/data_processing.js` again:
        // It exports `render`.
        // Maybe it's one of the analysis cards?
        // Let's assume I can find it via text or ID.

        // Let's try to find a card with "Data Processing" text or similar.
        // Or specific ID.
        // If I can't find it, I might need to view index.html.
        // But for now, let's try to target the "Data Processing & Engineering" header inside the rendered content?
        // No, that's inside the render.

        // Let's check `smoke_tests.spec.js` for how analyses are opened.
        // They click `.feature-card[data-analysis="..."]`.
        // There might be a `data-analysis="data_processing"` or similar.
        // Or maybe it's "cleansing"?

        // Let's try to find the card.
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            // Fallback: try text search
            await page.locator('text=データ加工・整形').click();
        }


        // 4. Verify Engineering Tab
        // 4. Verify Engineering Tab
        // Note: The engineering tab content is visible by default relative to the collapsible section (siblings).
        // No need to expand anything.

        // Setup console logging for debugging
        page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
        page.on('pageerror', exception => console.log(`PAGE ERROR: ${exception}`));

        // Wait for the section to appear
        await expect(page.locator('#eng-tab-recode')).toBeVisible({ timeout: 10000 });

        // 5. Select Variables (Bulk)
        // We need to use the MultiSelect component.
        // Container: #recode-col-select-container
        const multiSelectInput = page.locator('#recode-col-select-container .multiselect-input');
        // Open dropdown and ensure it is visible
        const dropdown = page.locator('#recode-col-select-container .multiselect-dropdown');
        if (!(await dropdown.isVisible())) {
            await multiSelectInput.click();
            await expect(dropdown).toBeVisible();
        }

        // Select first two options
        const options = page.locator('#recode-col-select-container .multiselect-dropdown .multiselect-option');
        // Wait for options to be populated
        await expect(options.nth(0)).toBeVisible();

        // Select specific categorical columns to ensure mapping table appears
        // Using "性別" and "部活動の有無"
        const optionGender = page.locator('#recode-col-select-container .multiselect-option').filter({ hasText: '性別' }).first();
        const optionClub = page.locator('#recode-col-select-container .multiselect-option').filter({ hasText: '部活動の有無' }).first();

        await expect(optionGender).toBeVisible();
        await optionGender.click();
        await optionClub.click();

        // Close dropdown
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 6. Check Mapping Table
        // Should show unique values.
        const mappingTable = page.locator('#recode-mapping-area table');
        await expect(mappingTable).toBeVisible();

        // 7. Enter Mapping Values
        // For EDA demo, values might be categorical.
        // Let's just enter "1" for the first mapping input found.
        const firstInput = page.locator('.recode-input').first();
        await firstInput.fill('1');

        // 8. Enter New Variable Suffix
        await page.fill('#recode-new-col-name', '_recoded');

        // 9. Execute Recode
        page.on('dialog', async dialog => {
            await dialog.accept();
        });
        await page.click('#apply-recode-btn');

        // 10. Verify New Column in Overview
        // The table should be re-rendered.
        // We should look for the suffixed column name in the table header.
        // The original columns were index 1 and 2. Let's find their names?
        // Or just check if any column ends with "_recoded".

        // Wait for table update (alert handled above)
        // Check for header containing "_recoded"
        const newHeader = page.locator('th:has-text("_recoded")').first();
        await expect(newHeader).toBeVisible({ timeout: 10000 });
    });
});
