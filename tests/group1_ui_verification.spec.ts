import { test, expect } from '@playwright/test';
import { selectVariables, selectStandardOption, navigateToFeature, uploadFile } from './utils/test-helpers';

// Helper: check for JS errors
function setupErrorCollector(page: any) {
    const errors: string[] = [];
    page.on('pageerror', (err: any) => errors.push(err.message));
    return errors;
}

// Helper: click all collapsible sections
async function clickCollapsibles(page: any) {
    const collapsibles = page.locator('.collapsible-header, .collapse-toggle, [data-toggle="collapse"], details summary');
    const count = await collapsibles.count();
    for (let i = 0; i < count; i++) {
        try {
            await collapsibles.nth(i).click({ timeout: 2000 });
            await page.waitForTimeout(300);
        } catch (e) { /* ignore non-clickable */ }
    }
}

// ============= T-TEST MODULE =============
test.describe('T-Test UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('Independent t-test: all UI elements', async ({ page }) => {
        await navigateToFeature(page, 'ttest');

        // 1. Check radio buttons exist and independent is default
        const indRadio = page.locator('input[name="test-type"][value="independent"]');
        const pairedRadio = page.locator('input[name="test-type"][value="paired"]');
        const oneSampleRadio = page.locator('input[name="test-type"][value="one-sample"]');
        await expect(indRadio).toBeChecked();
        await expect(page.locator('#independent-controls')).toBeVisible();

        // 2. Select group var and dep var
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);

        // 3. Run analysis
        await page.click('#independent-btn-container button', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // 4. Check results content
        const results = page.locator('#results-section');
        await expect(results).toContainText('t');
        await expect(results).toContainText('p');
        await expect(results).toContainText('効果量');

        // 5. Check tables exist
        const tables = results.locator('table');
        expect(await tables.count()).toBeGreaterThan(0);

        // 6. Check plots exist
        const plots = results.locator('.js-plotly-plot');
        expect(await plots.count()).toBeGreaterThan(0);

        // 7. Click collapsible sections
        await clickCollapsibles(page);

        // 8. No JS errors
        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });

    test('Paired t-test: radio switch and paired controls', async ({ page }) => {
        await navigateToFeature(page, 'ttest');

        // Switch to paired
        await page.click('input[name="test-type"][value="paired"]');
        await page.waitForTimeout(500);
        await expect(page.locator('#paired-controls')).toBeVisible();
        await expect(page.locator('#independent-controls')).not.toBeVisible();

        // Select variables
        await selectStandardOption(page, '#paired-var-pre', '数学', 'label');
        await selectStandardOption(page, '#paired-var-post', '英語', 'label');

        // Add pair button
        await page.click('#add-pair-btn', { force: true });
        await page.waitForTimeout(500);

        // Verify pair was added to the list
        const pairsList = page.locator('#selected-pairs-list');
        await expect(pairsList).toContainText('数学');

        // Run paired t-test
        await page.click('#run-paired-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        const results = page.locator('#results-section');
        await expect(results).toContainText('t');

        // Click collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });

    test('One-sample t-test: controls and mu input', async ({ page }) => {
        await navigateToFeature(page, 'ttest');

        // Switch to one-sample
        await page.click('input[name="test-type"][value="one-sample"]');
        await page.waitForTimeout(500);
        await expect(page.locator('#one-sample-controls')).toBeVisible();
        await expect(page.locator('#paired-controls')).not.toBeVisible();

        // Select variable
        await selectStandardOption(page, '#one-sample-var', '数学', 'label');

        // Change mu value
        const muInput = page.locator('#one-sample-mu');
        await muInput.fill('60');
        expect(await muInput.inputValue()).toBe('60');

        // Run one-sample t-test
        await page.click('#run-one-sample-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // Click collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});

// ============= MANN-WHITNEY MODULE =============
test.describe('Mann-Whitney UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('All UI elements and analysis execution', async ({ page }) => {
        await navigateToFeature(page, 'mann_whitney');

        // Select variables
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);

        // Run analysis
        await page.click('#run-btn-container button', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // Check results
        const results = page.locator('#results-section');
        await expect(results).toContainText('U');
        await expect(results).toContainText('p');

        // Tables and plots
        expect(await results.locator('table').count()).toBeGreaterThan(0);
        expect(await results.locator('.js-plotly-plot').count()).toBeGreaterThan(0);

        // Collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});

// ============= WILCOXON SIGNED-RANK MODULE =============
test.describe('Wilcoxon Signed-Rank UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('All UI elements and analysis execution', async ({ page }) => {
        await navigateToFeature(page, 'wilcoxon_signed_rank');

        // Select paired variables via MultiSelect
        await selectVariables(page, ['数学', '英語']);

        // Run analysis
        await page.click('#run-wilcoxon-test-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });

        // Check results
        const results = page.locator('#results-section');
        const text = await results.textContent();
        expect(text).toContain('W');
        expect(text).toContain('p');

        // Tables
        expect(await results.locator('table').count()).toBeGreaterThan(0);

        // Collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});

// ============= CHI-SQUARE MODULE =============
test.describe('Chi-Square UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('All UI elements and analysis execution', async ({ page }) => {
        await navigateToFeature(page, 'chi_square');

        // Select variables
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');

        // Run analysis
        await page.click('#run-chi-btn-container button', { force: true });
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });

        // Check results
        const results = page.locator('#analysis-results');
        const text = await results.textContent();
        expect(text).toContain('カイ二乗');
        expect(text).toContain('p');

        // Tables exist
        expect(await results.locator('table').count()).toBeGreaterThan(0);

        // Collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});

// ============= FISHER EXACT MODULE =============
test.describe('Fisher Exact UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('All UI elements and analysis execution', async ({ page }) => {
        await navigateToFeature(page, 'fisher_exact');

        // Select variables
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');

        // Run analysis
        await page.click('#run-fisher-btn-container button', { force: true });
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 10000 });

        // Check for results
        const results = page.locator('#analysis-results');
        const text = await results.textContent();
        expect(text?.length).toBeGreaterThan(50);

        // Tables exist
        expect(await results.locator('table').count()).toBeGreaterThan(0);

        // Collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});

// ============= MCNEMAR MODULE =============
test.describe('McNemar UI Verification', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = [];
        page.on('pageerror', (err: any) => errors.push(err.message));
        page.on('dialog', async (d: any) => await d.accept());
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        // McNemar needs a different dataset with binary columns
        await uploadFile(page, 'datasets/mcnemar_test.csv');
    });

    test('All UI elements and analysis execution', async ({ page }) => {
        await navigateToFeature(page, 'mcnemar');

        // Select variables
        await selectStandardOption(page, '#mcnemar-var1', '授業前理解', 'label');
        await selectStandardOption(page, '#mcnemar-var2', '授業後理解', 'label');

        // Run analysis
        await page.click('#run-mcnemar-btn', { force: true });
        await expect(page.locator('#mcnemar-analysis-results')).toBeVisible({ timeout: 10000 });

        // Check for results
        const results = page.locator('#mcnemar-analysis-results');
        const text = await results.textContent();
        expect(text?.length).toBeGreaterThan(50);

        // Collapsible sections
        await clickCollapsibles(page);

        expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
    });
});
