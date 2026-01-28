const { test, expect } = require('@playwright/test');
const path = require('path');

test('Two-Way Within-Subjects ANOVA Verification', async ({ page }) => {
    // Enable console logs
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));

    // 1. Load the application
    await page.goto('http://127.0.0.1:8080/');
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
    const withinLabel = page.locator('label').filter({ hasText: '対応あり (Within)' });
    await withinLabel.click();

    // Verify controls visible
    await expect(page.locator('#within-controls')).toBeVisible();

    // 5. Configure Design (Time x Skill)
    await page.fill('#within-factor-a-name', 'Time');
    await page.locator('#within-factor-a-name').blur();

    await page.fill('#within-factor-b-name', 'Skill');
    await page.locator('#within-factor-b-name').blur();

    await page.fill('#within-level-a1', 'Pre');
    await page.fill('#within-level-a2', 'Post');

    await page.fill('#within-level-b1', 'Reading');
    await page.fill('#within-level-b2', 'Listening');

    // 6. Map Variables
    await page.selectOption('#within-cell-a1b1-container select', { label: 'リーディング力（前）' });
    await page.selectOption('#within-cell-a1b2-container select', { label: 'リスニング力（前）' });
    await page.selectOption('#within-cell-a2b1-container select', { label: 'リーディング力（後）' });
    await page.selectOption('#within-cell-a2b2-container select', { label: 'リスニング力（後）' });

    // 7. Run Analysis
    await page.click('#run-within-anova');

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

    // Check for Interaction Plot
    await expect(page.locator('#visualization-section .js-plotly-plot')).toBeVisible();
});
