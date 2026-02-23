const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Within-Subjects ANOVA Verification', async ({ page }) => {
    // Enable console logs
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

    // 1. Load the application
    await page.goto('http://127.0.0.1:8081/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });

    // 2. Upload Data
    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/2way_anova_demo_mix.xlsx');

    // Create a promise to wait for file processing
    const previewVisiblePromise = page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 30000 });

    await fileInput.setInputFiles(filePath);
    await previewVisiblePromise;

    // 3. Navigate to Two-Way ANOVA Analysis
    const card = page.locator('.feature-card[data-analysis="anova_two_way"]');
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('#analysis-area')).toBeVisible();

    // 4. Select Within Design
    const withinLabel = page.locator('label').filter({ hasText: '反復測定（対応あり）' });
    await withinLabel.click();

    // Verify controls visible
    await expect(page.locator('#repeated-controls')).toBeVisible();

    // 5. Configure Design (Time x Skill)
    await page.fill('#rm-f1-name', 'Time');
    await page.fill('#rm-f1-levels', 'Pre,Post');

    await page.fill('#rm-f2-name', 'Skill');
    await page.fill('#rm-f2-levels', 'Reading,Listening');

    // 6. Generate Grid and Map Variables
    await page.click('#rm-generate-grid-btn');
    await expect(page.locator('#rm-grid-area')).toBeVisible();

    await page.selectOption('#rm-select-Pre-Reading', { label: 'リーディング力（前）' });
    await page.selectOption('#rm-select-Pre-Listening', { label: 'リスニング力（前）' });
    await page.selectOption('#rm-select-Post-Reading', { label: 'リーディング力（後）' });
    await page.selectOption('#rm-select-Post-Listening', { label: 'リスニング力（後）' });

    // 7. Run Analysis
    await page.click('#run-rm-btn');

    // 8. Verify Results
    await expect(page.locator('#analysis-results')).toBeVisible();

    // Check tables
    // Table 1: Descriptive Stats (Should feature "Time" in header)
    const summaryTable = page.locator('#summary-stats-section .table');
    const summaryText = await summaryTable.innerText();
    console.log('Summary Table Text:', summaryText);
    await expect(summaryTable).toContainText('Time');
    await expect(summaryTable).toContainText('Skill');

    // Table 2: ANOVA Source Table (Should feature "Time" in rows)
    const anovaTable = page.locator('#test-results-section .table');
    const anovaText = await anovaTable.innerText();
    console.log('ANOVA Table Text:', anovaText);
    await expect(anovaTable).toContainText('Time');
    await expect(anovaTable).toContainText('Time × Skill'); // Note: The x might be times symbol or x

    // Check Data Preview Visibility
    const dataPreview = page.locator('#anova-data-overview');
    await expect(dataPreview).toBeVisible();

    // Check for Interaction Plot
    await expect(page.locator('#visualization-section .js-plotly-plot')).toBeVisible();
});
