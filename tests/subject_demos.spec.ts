import { test, expect, Page } from '@playwright/test';
import { selectVariables, selectStandardOption } from './utils/test-helpers';

// 分析ごとのデモデータ（高校生に身近な題材）で、各分析が結果まで出ることを確かめる
// （データは tools/demo_data/generate_subject_demos.py で作っている）

async function loadDemo(page: Page, file: string) {
    await page.goto('/');
    await page.click('#load-demo-btn');
    await page.waitForSelector('#demo-modal', { state: 'visible' });
    await page.click(`.demo-option-btn[data-demo="${file}"]`);
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });
}

async function openAnalysis(page: Page, analysis: string) {
    await page.click(`.feature-card[data-analysis="${analysis}"]`);
    await expect(page.locator('#analysis-area')).toBeVisible();
}

function trackErrors(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    return errors;
}

test.describe('Subject demos (high school themes)', () => {
    test('t-test: morning reading groups differ on the post-test', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_ttest_demo.csv');
        await openAnalysis(page, 'ttest');
        await selectStandardOption(page, '#group-var', '朝読書', 'label');
        await selectVariables(page, ['読解テスト_事後']);
        await page.click('#run-independent-btn');
        const results = page.locator('#results-section');
        await expect(results).toBeVisible({ timeout: 10000 });
        await expect(results).toContainText('読解テスト_事後');
        await expect(results).toContainText('*');
        expect(errors).toEqual([]);
    });

    test('one-way ANOVA: study methods differ on the third word test', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_anova_demo.csv');
        await openAnalysis(page, 'anova_one_way');
        await selectStandardOption(page, '#factor-var', '勉強法', 'label');
        await selectVariables(page, ['単語テスト_3回目']);
        await page.click('#run-ind-anova-btn');
        const results = page.locator('#analysis-results');
        await expect(results).toBeVisible({ timeout: 10000 });
        await expect(results).toContainText('F値');
        await expect(results).toContainText('友達と教え合う');
        expect(errors).toEqual([]);
    });

    test('factor analysis: 15 school-life items give three clear factors', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_factor_demo.csv');
        await openAnalysis(page, 'factor_analysis');
        const input = page.locator('#factor-vars-container .multiselect-input');
        await input.click();
        const options = page.locator('#factor-vars-container .multiselect-option');
        const count = await options.count();
        for (let i = 0; i < count; i++) await options.nth(i).click();
        await page.keyboard.press('Escape');
        await page.click('#run-factor-btn');
        await expect(page.locator('#eigenvalues-table')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#loadings-table')).toContainText('Q13_文化祭が楽しみ');
        expect(errors).toEqual([]);
    });

    test('text mining: school festival comments count 文化祭 as one word', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_text_demo.csv');
        await openAnalysis(page, 'text_mining');
        await page.selectOption('#text-var', { label: '感想' });

        // おすすめの強制抽出語を取り込むと、文化祭などの複合語が欄に入る
        await page.locator('.tm-advanced-settings > summary').click();
        await page.click('#tm-suggest-force-terms');
        await expect(page.locator('#tm-suggest-status')).toContainText('語を追加しました');
        await expect(page.locator('#tm-force-terms')).toHaveValue(/文化祭/);
        await expect(page.locator('#tm-force-terms')).toHaveValue(/模擬店/);

        await page.click('#run-text-btn');
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#tm-overall', { hasText: '品詞別ランキング' })).toBeVisible({ timeout: 60000 });
        const firstTerm = page.locator('#tm-overall table tbody tr').first();
        await expect(firstTerm).toContainText('文化祭');
        expect(errors).toEqual([]);
    });

    test('text mining: compound terms are joined even without forced terms', async ({ page }) => {
        await loadDemo(page, 'hs_text_demo.csv');
        await openAnalysis(page, 'text_mining');
        await page.selectOption('#text-var', { label: '感想' });
        await page.click('#run-text-btn');
        await expect(page.locator('#tm-overall', { hasText: '品詞別ランキング' })).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#tm-overall table tbody tr').first()).toContainText('文化祭');
    });

    test('time series: monthly library loans', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_timeseries_demo.csv');
        await openAnalysis(page, 'time_series');
        if (await page.locator('#time-var').count()) {
            await page.selectOption('#time-var', { label: '年月' });
        }
        await page.selectOption('#value-var', { label: '図書貸出冊数' });
        await page.click('#run-ts-btn');
        await expect(page.locator('#ts-results-section')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#ts-interpretation')).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('logistic regression: English test pass/fail', async ({ page }) => {
        const errors = trackErrors(page);
        await loadDemo(page, 'hs_logistic_demo.csv');
        await openAnalysis(page, 'logistic_regression');
        await page.locator('#logistic-dep-var').selectOption('合否');
        await page.locator('#logistic-indep-var-multiselect-wrapper .multiselect-input, .multiselect-wrapper .multiselect-input').first().click();
        for (const name of ['英語の家庭学習時間', '英単語テスト', '模試の英語']) {
            await page.locator('.multiselect-option').filter({ hasText: name }).first().click();
        }
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.click('#run-logistic-btn');
        const results = page.locator('#logistic-results');
        await expect(results).toBeVisible({ timeout: 10000 });
        await expect(results).toContainText('オッズ比');
        await expect(results).toContainText('英単語テスト');
        expect(errors).toEqual([]);
    });
});
