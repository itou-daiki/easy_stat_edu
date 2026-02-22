import { test, expect, Page, Dialog } from '@playwright/test';
const path = require('path');

test.describe('Data Processing - Bulk Recode', () => {
    test('Verify Bulk Recode Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('http://127.0.0.1:8081/');
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
        page.on('pageerror', (exception: Error) => { console.log(`PAGE ERROR: ${exception}`) });

        // 4. Verify Engineering Tab (Wait for the Recode Tab to be visible after clicking the button)
        const recodeTabBtn = page.locator('button:has-text("値の変換")');
        await expect(recodeTabBtn).toBeVisible({ timeout: 5000 });
        await recodeTabBtn.click();

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
        page.on('dialog', async (dialog: any) => {
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

    test('Verify Data Filter (絞り込み) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data (Using demo_all_analysis.csv)
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/demo_all_analysis.csv');

        // Wait for preview
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }

        // Wait for section to appear
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Filtering Tab
        // Assume we will add a new tab/button for filtering "データの絞り込み"
        const filterTabBtn = page.locator('button:has-text("データの絞り込み")');
        await expect(filterTabBtn).toBeVisible({ timeout: 5000 });
        await filterTabBtn.click();

        // 5. Specify Filter Condition
        // e.g. "クラス" == "A"
        await page.selectOption('#filter-var-select', 'クラス');
        await page.selectOption('#filter-operator-select', '==');
        await page.fill('#filter-value-input', 'A');

        // 6. Execute Filter
        page.on('dialog', async (dialog: any) => {
            // Should say something like "絞り込みを実行しました。XX行が残りました。"
            expect(dialog.message()).toContain('絞り込み');
            await dialog.accept();
        });
        await page.click('#apply-filter-btn');

        // 7. Verify Result
        // Wait for processing summary to appear indicating success
        const summaryLocator = page.locator('#processing-summary');
        await expect(summaryLocator).toBeVisible({ timeout: 10000 });
        const summaryText = await summaryLocator.textContent();
        expect(summaryText).toContain('除外された行数');
    });

    test('Verify Reverse Scoring (自動反転) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/demo_all_analysis.csv');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Reverse Scoring Tab
        const reverseTabBtn = page.locator('button:has-text("逆転項目の処理")');
        await expect(reverseTabBtn).toBeVisible({ timeout: 5000 });
        await reverseTabBtn.click();
        await expect(page.locator('#eng-tab-reverse')).toBeVisible({ timeout: 10000 });

        // 5. Select Variables (using MultiSelect)
        const multiSelectInput = page.locator('#reverse-col-select-container .multiselect-input');
        const dropdown = page.locator('#reverse-col-select-container .multiselect-dropdown');
        await multiSelectInput.click();
        await expect(dropdown).toBeVisible();
        const optionMath = page.locator('#reverse-col-select-container .multiselect-option').filter({ hasText: '数学' }).first();
        await expect(optionMath).toBeVisible();
        await optionMath.click();
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 6. Enter Min, Max and Suffix
        await page.fill('#reverse-min-input', '0');
        await page.fill('#reverse-max-input', '100');
        await page.fill('#reverse-new-col-name', '_rev');

        // 7. Execute Reverse Scoring
        page.on('dialog', async (dialog: any) => {
            await dialog.accept();
        });
        await page.click('#apply-reverse-btn');

        // 8. Verify Result Header
        const newHeader = page.locator('th:has-text("数学_rev")').first();
        await expect(newHeader).toBeVisible({ timeout: 10000 });
    });

    test('Verify Categorization (数値のカテゴリ化) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/demo_all_analysis.csv');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Categorize Tab
        const categorizeTabBtn = page.locator('button:has-text("数値のグループ化")');
        await expect(categorizeTabBtn).toBeVisible({ timeout: 5000 });
        await categorizeTabBtn.click();
        await expect(page.locator('#eng-tab-categorize')).toBeVisible({ timeout: 10000 });

        // 5. Select Variable and Parameters
        await page.selectOption('#categorize-var-select', '数学');
        await page.fill('#categorize-threshold-input', '50');
        await page.fill('#categorize-label-high', '合格');
        await page.fill('#categorize-label-low', '不合格');
        await page.fill('#categorize-new-col-name', '_cat');

        // 6. Execute Categorization
        page.on('dialog', async (dialog: any) => {
            await dialog.accept();
        });
        await page.click('#apply-categorize-btn');

        // 7. Verify Result Header
        const newHeader = page.locator('th:has-text("数学_cat")').first();
        await expect(newHeader).toBeVisible({ timeout: 10000 });
    });

    test('Verify Standardization (Zスコア変換) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/demo_all_analysis.csv');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Standardize Tab
        const standardizeTabBtn = page.locator('button:has-text("標準化 (Zスコア)")');
        await expect(standardizeTabBtn).toBeVisible({ timeout: 5000 });
        await standardizeTabBtn.click();
        await expect(page.locator('#eng-tab-standardize')).toBeVisible({ timeout: 10000 });

        // 5. Select Variables (using MultiSelect)
        const multiSelectInput = page.locator('#standardize-col-select-container .multiselect-input');
        const dropdown = page.locator('#standardize-col-select-container .multiselect-dropdown');
        await multiSelectInput.click();
        await expect(dropdown).toBeVisible();
        const optionMath = page.locator('#standardize-col-select-container .multiselect-option').filter({ hasText: '数学' }).first();
        await expect(optionMath).toBeVisible();
        await optionMath.click();
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 6. Enter Suffix
        await page.fill('#standardize-new-col-name', '_z');

        // 7. Execute Standardization
        page.on('dialog', async (dialog: any) => {
            await dialog.accept();
        });
        await page.click('#apply-standardize-btn');

        // 8. Verify Result Header
        const newHeader = page.locator('th:has-text("数学_z")').first();
        await expect(newHeader).toBeVisible({ timeout: 10000 });
    });

    test('Verify Compute Variables (変数の計算: 合計・引き算等) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/demo_all_analysis.csv');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Compute Tab
        const computeTabBtn = page.locator('button:has-text("変数の計算")');
        await expect(computeTabBtn).toBeVisible({ timeout: 5000 });
        await computeTabBtn.click();
        await expect(page.locator('#eng-tab-compute')).toBeVisible({ timeout: 10000 });

        // 5. Select Variables (Math and Science)
        const multiSelectInput = page.locator('#compute-col-select-container .multiselect-input');
        const dropdown = page.locator('#compute-col-select-container .multiselect-dropdown');
        await multiSelectInput.click();
        await expect(dropdown).toBeVisible();
        const optionMath = page.locator('#compute-col-select-container .multiselect-option').filter({ hasText: '数学' }).first();
        const optionSci = page.locator('#compute-col-select-container .multiselect-option').filter({ hasText: '理科' }).first();

        await expect(optionMath).toBeVisible();
        await optionMath.click();
        await expect(optionSci).toBeVisible();
        await optionSci.click();
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 6. Test 'sum' (合計)
        await page.selectOption('#compute-method-select', 'sum');
        await page.fill('#compute-new-col-name', 'Math_Sci_Sum');

        page.on('dialog', async (dialog: any) => {
            await dialog.accept();
        });
        await page.click('#apply-compute-btn');
        const sumHeader = page.locator('th:has-text("Math_Sci_Sum")').first();
        await expect(sumHeader).toBeVisible({ timeout: 10000 });

        // 7. Test 'diff' (引き算)
        // Note: applyCompute() calls updateDataAndUI() which resets the MultiSelect.
        // Re-select the variables.
        await multiSelectInput.click();
        await expect(dropdown).toBeVisible();
        await optionMath.click();
        await optionSci.click();
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        await page.selectOption('#compute-method-select', 'diff');
        await page.fill('#compute-new-col-name', 'Math_Sci_Diff');
        await page.click('#apply-compute-btn');
        const diffHeader = page.locator('th:has-text("Math_Sci_Diff")').first();
        await expect(diffHeader).toBeVisible({ timeout: 10000 });
    });

    test('Verify Data Merge (データの結合) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Base Data (File 1)
        const fileInput = page.locator('#main-data-file');
        const filePath1 = path.join(__dirname, '../datasets/merge_test_1.csv'); // ID, Math, English
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath1);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }
        await expect(page.locator('.cleansing-container')).toBeVisible({ timeout: 10000 });

        // 4. Switch to Merge Tab
        const mergeTabBtn = page.locator('button:has-text("データの結合")');
        await expect(mergeTabBtn).toBeVisible({ timeout: 5000 });
        await mergeTabBtn.click();
        await expect(page.locator('#eng-tab-merge')).toBeVisible({ timeout: 10000 });

        // 5. Upload Second File
        const fileInput2 = page.locator('#merge-file-input');
        const filePath2 = path.join(__dirname, '../datasets/merge_test_2.csv'); // ID, 名前, 英語

        await fileInput2.setInputFiles(filePath2);

        // Force trigger the change event
        await fileInput2.evaluate(node => node.dispatchEvent(new Event('change', { bubbles: true })));

        await page.waitForTimeout(1000); // Wait explicitly to see if it helps

        // Wait for column selectors to be populated
        await expect(page.locator('#merge-key-base')).toContainText('ID');
        await expect(page.locator('#merge-key-new')).toContainText('ID');

        // 6. Select Keys and Merge
        await page.selectOption('#merge-key-base', 'ID');
        await page.selectOption('#merge-key-new', 'ID');

        page.on('dialog', async (dialog: any) => {
            await dialog.accept();
        });
        await page.click('#apply-merge-btn');

        // 7. Verify Result Header
        const mergedHeader = page.locator('th:has-text("英語")').first();
        await expect(mergedHeader).toBeVisible({ timeout: 10000 });
    });

    test('Verify Text Cleansing (テキストクレンジング) Functionality', async ({ page }: { page: Page }) => {
        // 1. Load Application
        await page.goto('/');

        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

        // 2. Upload Data (cleansing_test.csv)
        const fileInput = page.locator('#main-data-file');
        const filePath = path.join(__dirname, '../datasets/cleansing_test.csv');
        const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });
        await fileInput.setInputFiles(filePath);
        await previewVisiblePromise;

        // 3. Open Data Processing Section
        const processingCard = page.locator('.feature-card[data-analysis="data_processing"]');
        if (await processingCard.count() > 0) {
            await processingCard.click();
        } else {
            await page.locator('text=データ加工・整形').click();
        }

        // Wait for the data processing UI to appear
        await expect(page.locator('#eng-tab-filter')).toBeAttached({ timeout: 10000 });

        // 4. Switch to Cleansing Tab
        const cleansingTabBtn = page.locator('button:has-text("文字列の整形")');
        await expect(cleansingTabBtn).toBeVisible({ timeout: 5000 });
        await cleansingTabBtn.click();
        await expect(page.locator('#eng-tab-cleansing')).toBeVisible({ timeout: 10000 });

        // 5. Select Variable (テキスト)
        const multiSelectInput = page.locator('#cleansing-col-select-container .multiselect-input');
        const dropdown = page.locator('#cleansing-col-select-container .multiselect-dropdown');
        await multiSelectInput.click();
        await expect(dropdown).toBeVisible();
        const optionText = page.locator('#cleansing-col-select-container .multiselect-option').filter({ hasText: 'テキスト' }).first();

        await expect(optionText).toBeVisible();
        await page.waitForTimeout(200);
        await optionText.click();
        await page.waitForTimeout(200);
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        // 6. Execute Cleansing
        page.on('dialog', async (dialog: any) => {
            console.log('DIALOG OPENED:', dialog.message());
            await dialog.accept();
        });
        await page.click('#apply-cleansing-btn');

        // 7. Verify Resulting Data (Check if "１２３ ＡＢＣ " was converted to "123 ABC")
        // Debug to see what is actually in the table
        const allCells = await page.locator('#original-data-overview td').allInnerTexts();
        console.log('TABLE CELLS AFTER CLEANSING:', allCells);

        const cell = page.locator('#original-data-overview td', { hasText: '123' }).first();
        await expect(cell).toBeVisible({ timeout: 10000 });
        const cellText = await cell.innerText();
        expect(cellText.trim()).toBe('123 ABC');

        // Also check trimmed spaces for "田中 太郎"
        const cell2 = page.locator('#original-data-overview td:has-text("田中 太郎")').first();
        await expect(cell2).toBeVisible({ timeout: 10000 });
    });
});
