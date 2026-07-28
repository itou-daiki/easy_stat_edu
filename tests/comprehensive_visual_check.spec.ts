/**
 * 包括的ビジュアルチェック: 全機能の動作確認と図表サイズ検証
 * スクリーンショットを撮影し、グラフサイズ・テーブル幅を数値検証
 */
import { test, expect, Page } from '@playwright/test';
import { navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

// ビューポートを固定して図表サイズを一貫して検証
test.use({ viewport: { width: 1280, height: 900 } });

const SCREENSHOT_DIR = 'test-results/comprehensive_visual';

/** Plotlyグラフのサイズを取得 */
async function getPlotlyDimensions(page: Page, selector: string = '.js-plotly-plot') {
    return await page.evaluate((sel) => {
        const plots = document.querySelectorAll(sel);
        return Array.from(plots).map((plot, i) => {
            const rect = plot.getBoundingClientRect();
            return { index: i, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
        });
    }, selector);
}

/** テーブルのサイズを取得 */
async function getTableDimensions(page: Page) {
    return await page.evaluate(() => {
        const tables = document.querySelectorAll('table');
        return Array.from(tables).map((table, i) => {
            const rect = table.getBoundingClientRect();
            const container = table.closest('.table-container, [style*="overflow"]');
            const containerRect = container ? container.getBoundingClientRect() : null;
            const isOverflowing = container ? table.scrollWidth > container.clientWidth : false;
            return {
                index: i,
                width: rect.width,
                height: rect.height,
                containerWidth: containerRect?.width ?? null,
                isOverflowing,
                visible: rect.width > 0 && rect.height > 0
            };
        });
    });
}

/** コンソールエラーを収集 */
function setupConsoleLogs(page: Page) {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('404') && !text.includes('favicon') && !text.includes('net::ERR')) {
                errors.push(text);
            }
        }
    });
    page.on('pageerror', err => {
        errors.push(`PageError: ${err.message}`);
    });
    return errors;
}

/** 実運用目線のUI表面監査: 結果画面に出た表・グラフ・画像・ボタン・テキストの破綻を拾う */
async function auditRenderedSurface(page: Page, label: string) {
    const audit = await page.evaluate(() => {
        const isVisible = (el: Element) => {
            const style = window.getComputedStyle(el);
            const rect = (el as HTMLElement).getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const badTextPattern = /\b(?:undefined|NaN|Infinity)\b|\[object Object\]/;
        const visibleText = document.body.innerText || '';
        const badTextMatches = Array.from(new Set(visibleText.match(badTextPattern) || []));

        const buttons = Array.from(document.querySelectorAll('button')).filter(isVisible).map((button, index) => {
            const rect = button.getBoundingClientRect();
            return {
                index,
                text: (button.textContent || '').replace(/\s+/g, ' ').trim(),
                ariaLabel: button.getAttribute('aria-label') || '',
                title: button.getAttribute('title') || '',
                disabled: (button as HTMLButtonElement).disabled,
                width: rect.width,
                height: rect.height
            };
        });
        const unlabeledButtons = buttons.filter(button => !button.text && !button.ariaLabel && !button.title);

        const tables = Array.from(document.querySelectorAll('table')).filter(isVisible).map((table, index) => {
            const rect = table.getBoundingClientRect();
            const headers = Array.from(table.querySelectorAll('th')).map(th => (th.textContent || '').replace(/\s+/g, ' ').trim());
            const cells = Array.from(table.querySelectorAll('td, th')).map(cell => (cell.textContent || '').replace(/\s+/g, ' ').trim());
            return {
                index,
                width: rect.width,
                height: rect.height,
                headerCount: headers.length,
                rowCount: table.querySelectorAll('tbody tr, tr').length,
                emptyHeaders: headers.filter(header => header.length === 0).length,
                badCells: cells.filter(cell => badTextPattern.test(cell)).slice(0, 5)
            };
        });

        const plots = Array.from(document.querySelectorAll('.js-plotly-plot')).filter(isVisible).map((plot, index) => {
            const rect = plot.getBoundingClientRect();
            return { index, width: rect.width, height: rect.height };
        });

        const images = Array.from(document.querySelectorAll('img')).filter(isVisible).map((img, index) => {
            const image = img as HTMLImageElement;
            const rect = image.getBoundingClientRect();
            return {
                index,
                alt: image.alt,
                src: image.getAttribute('src') || '',
                width: rect.width,
                height: rect.height,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                complete: image.complete
            };
        });

        const canvases = Array.from(document.querySelectorAll('canvas')).filter(isVisible).map((canvas, index) => {
            const c = canvas as HTMLCanvasElement;
            const rect = c.getBoundingClientRect();
            let nonBlank = true;
            try {
                const ctx = c.getContext('2d');
                const sampleSize = 16;
                const points: Array<[number, number]> = [];
                for (let y = 0; y <= 4; y++) {
                    for (let x = 0; x <= 4; x++) {
                        points.push([
                            Math.min(Math.max(Math.floor((c.width * x) / 4), 0), Math.max(c.width - sampleSize, 0)),
                            Math.min(Math.max(Math.floor((c.height * y) / 4), 0), Math.max(c.height - sampleSize, 0))
                        ]);
                    }
                }
                nonBlank = !!ctx && points.some(([x, y]) => {
                    const data = ctx.getImageData(x, y, Math.min(sampleSize, c.width), Math.min(sampleSize, c.height)).data;
                    return Array.from(data).some(value => value !== 0);
                });
            } catch {
                nonBlank = true;
            }
            return { index, width: rect.width, height: rect.height, pixelWidth: c.width, pixelHeight: c.height, nonBlank };
        });

        const analysisRoot = document.getElementById('analysis-content');
        const plotTargets = analysisRoot?.querySelectorAll('.js-plotly-plot').length || 0;
        const canvasTargets = analysisRoot?.querySelectorAll('canvas.tm-wordcloud-canvas, .tm-network-canvas').length || 0;
        const tableTargets = analysisRoot?.querySelectorAll('table').length || 0;
        const editorCoverage = {
            targets: plotTargets + canvasTargets + tableTargets,
            plotDelta: (analysisRoot?.querySelectorAll('[data-editor-kind="plotly"]').length || 0) - plotTargets,
            canvasDelta: (analysisRoot?.querySelectorAll('[data-editor-kind="canvas"]').length || 0) - canvasTargets,
            tableDelta: (analysisRoot?.querySelectorAll('[data-editor-kind="table"]').length || 0) - tableTargets
        };

        return { badTextMatches, buttons, unlabeledButtons, tables, plots, images, canvases, editorCoverage };
    });

    expect(audit.badTextMatches, `${label}: visible text should not contain broken placeholders`).toEqual([]);
    expect(audit.unlabeledButtons, `${label}: visible buttons should have text, aria-label, or title`).toEqual([]);
    if (audit.editorCoverage.targets > 0) {
        expect(audit.editorCoverage.plotDelta, `${label}: every Plotly graph should have one editor`).toBe(0);
        expect(audit.editorCoverage.canvasDelta, `${label}: every Canvas graph should have one editor`).toBe(0);
        expect(audit.editorCoverage.tableDelta, `${label}: every table should have one editor`).toBe(0);
    }
    for (const table of audit.tables) {
        expect(table.width, `${label}: table ${table.index} width`).toBeGreaterThan(20);
        expect(table.height, `${label}: table ${table.index} height`).toBeGreaterThan(20);
        expect(table.rowCount, `${label}: table ${table.index} should have rows`).toBeGreaterThan(0);
        expect(table.badCells, `${label}: table ${table.index} should not contain broken values`).toEqual([]);
    }
    for (const plot of audit.plots) {
        expect(plot.width, `${label}: plot ${plot.index} width`).toBeGreaterThan(200);
        expect(plot.height, `${label}: plot ${plot.index} height`).toBeGreaterThan(120);
    }
    for (const image of audit.images) {
        expect(image.complete, `${label}: image ${image.index} should finish loading`).toBe(true);
        expect(image.naturalWidth, `${label}: image ${image.index} natural width`).toBeGreaterThan(0);
        expect(image.naturalHeight, `${label}: image ${image.index} natural height`).toBeGreaterThan(0);
    }
    for (const canvas of audit.canvases) {
        expect(canvas.width, `${label}: canvas ${canvas.index} CSS width`).toBeGreaterThan(120);
        expect(canvas.height, `${label}: canvas ${canvas.index} CSS height`).toBeGreaterThan(80);
        expect(canvas.pixelWidth, `${label}: canvas ${canvas.index} pixel width`).toBeGreaterThan(120);
        expect(canvas.pixelHeight, `${label}: canvas ${canvas.index} pixel height`).toBeGreaterThan(80);
        expect(canvas.nonBlank, `${label}: canvas ${canvas.index} should not be blank`).toBe(true);
    }
}

test.afterEach(async ({ page }, testInfo) => {
    await auditRenderedSurface(page, testInfo.title);
});

// =============================================
// Group 1: 基本統計・EDA・相関
// =============================================
test.describe('Visual Check Group 1: 基本統計', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('EDA - 一変量', async ({ page }) => {
        await navigateToFeature(page, 'eda');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01_eda_initial.png`, fullPage: true });

        // 一変量タブはデフォルト
        const plots = await getPlotlyDimensions(page);
        // Check for reasonably sized plots (if any)
        for (const plot of plots) {
            if (plot.visible) {
                expect(plot.width, `EDA plot ${plot.index} width`).toBeGreaterThan(200);
                expect(plot.height, `EDA plot ${plot.index} height`).toBeGreaterThan(100);
            }
        }
        expect(errors).toHaveLength(0);
    });

    test('EDA - 二変量散布図', async ({ page }) => {
        await navigateToFeature(page, 'eda');
        await page.click('button.tab-button[data-tab="two-vars"]');
        await selectStandardOption(page, '#two-var-1', '数学', 'label');
        await selectStandardOption(page, '#two-var-2', '英語', 'label');
        await page.click('#plot-two-vars-btn');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/02_eda_scatter.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        const visiblePlots = plots.filter(p => p.visible);
        expect(visiblePlots.length, 'EDA scatter should have visible plot').toBeGreaterThan(0);
        for (const plot of visiblePlots) {
            expect(plot.width, 'EDA scatter width too small').toBeGreaterThan(300);
            expect(plot.height, 'EDA scatter height too small').toBeGreaterThan(200);
            expect(plot.width, 'EDA scatter width too large').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('相関分析', async ({ page }) => {
        await navigateToFeature(page, 'correlation');
        await selectVariables(page, ['数学', '英語', '理科']);
        await page.click('#run-correlation-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/03_correlation.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        const visiblePlots = plots.filter(p => p.visible);
        expect(visiblePlots.length, 'Correlation should have plots').toBeGreaterThan(0);
        for (const plot of visiblePlots) {
            expect(plot.width, `Correlation plot ${plot.index} width`).toBeGreaterThan(200);
            expect(plot.width, `Correlation plot ${plot.index} too wide`).toBeLessThan(1300);
        }
        const tables = await getTableDimensions(page);
        for (const t of tables.filter(t => t.visible)) {
            expect(t.isOverflowing, `Table ${t.index} overflows container`).toBe(false);
        }
        expect(errors).toHaveLength(0);
    });

    test('クロス集計表', async ({ page }) => {
        await navigateToFeature(page, 'cross_tabulation');
        await selectStandardOption(page, '#crosstab-row-var', '性別', 'label');
        await selectStandardOption(page, '#crosstab-col-var', 'クラス', 'label');
        await page.click('#run-crosstab-btn', { force: true });
        await expect(page.locator('#crosstab-analysis-results')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/04_cross_tabulation.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 2: t検定・ノンパラ検定
// =============================================
test.describe('Visual Check Group 2: t検定・ノンパラ', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('独立サンプルt検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#independent-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/05_ttest_independent.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'T-test plot width').toBeGreaterThan(300);
            expect(plot.height, 'T-test plot height').toBeGreaterThan(150);
            expect(plot.width, 'T-test plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('対応ありt検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await page.click('input[name="test-type"][value="paired"]');
        await page.waitForTimeout(500);
        // Paired t-test uses pair selector: select pre/post then add pair
        await selectStandardOption(page, '#paired-var-pre', '数学', 'label');
        await selectStandardOption(page, '#paired-var-post', '英語', 'label');
        await page.click('#add-pair-btn', { force: true });
        await page.waitForTimeout(300);
        await page.click('#run-paired-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/06_ttest_paired.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('1標本t検定', async ({ page }) => {
        await navigateToFeature(page, 'ttest');
        await page.click('input[name="test-type"][value="one-sample"]');
        await page.waitForTimeout(500);
        await selectStandardOption(page, '#one-sample-var', '数学', 'label');
        await page.fill('#one-sample-mu', '60');
        await page.click('#run-one-sample-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/07_ttest_one_sample.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Mann-Whitney U検定', async ({ page }) => {
        await navigateToFeature(page, 'mann_whitney');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/08_mann_whitney.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Mann-Whitney plot width').toBeGreaterThan(300);
            expect(plot.width, 'Mann-Whitney plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('Wilcoxon符号付順位検定', async ({ page }) => {
        await navigateToFeature(page, 'wilcoxon_signed_rank');
        await selectVariables(page, ['数学', '英語']);
        await page.click('#run-wilcoxon-test-btn', { force: true });
        await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/09_wilcoxon.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Kruskal-Wallis検定', async ({ page }) => {
        await navigateToFeature(page, 'kruskal_wallis');
        await selectStandardOption(page, '#group-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/10_kruskal_wallis.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 3: ANOVA系
// =============================================
test.describe('Visual Check Group 3: ANOVA', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('一元配置ANOVA（独立）', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await selectStandardOption(page, '#factor-var', 'クラス', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/11_anova_one_way_ind.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'ANOVA plot width').toBeGreaterThan(300);
            expect(plot.width, 'ANOVA plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('一元配置ANOVA（反復測定）', async ({ page }) => {
        await navigateToFeature(page, 'anova_one_way');
        await page.click('input[name="anova-type"][value="repeated"]');
        await page.waitForTimeout(300);
        await selectVariables(page, ['数学', '英語', '理科']);
        await page.click('#run-rep-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/12_anova_one_way_rep.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('二元配置ANOVA（独立）', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
        await selectStandardOption(page, '#factor2-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#run-ind-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/13_anova_two_way_ind.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('二元配置ANOVA（混合）', async ({ page }) => {
        await navigateToFeature(page, 'anova_two_way');
        await page.click('input[name="anova-2-type"][value="mixed"]');
        await page.waitForTimeout(500);
        await selectStandardOption(page, '#mixed-between-var', '性別', 'label');
        const pairRow = page.locator('.pair-row').first();
        await pairRow.locator('.pre-select').selectOption({ label: '数学' });
        await pairRow.locator('.post-select').selectOption({ label: '英語' });
        await page.click('#run-mixed-anova-btn', { force: true });
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/14_anova_two_way_mixed.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 4: カテゴリカル分析
// =============================================
test.describe('Visual Check Group 4: カテゴリカル', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('カイ二乗検定', async ({ page }) => {
        await navigateToFeature(page, 'chi_square');
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.click('#run-chi-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/15_chi_square.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('Fisher正確検定', async ({ page }) => {
        await navigateToFeature(page, 'fisher_exact');
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.click('#run-fisher-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/16_fisher_exact.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('McNemar検定', async ({ page }) => {
        // McNemar needs different dataset
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/mcnemar_test.csv');
        await navigateToFeature(page, 'mcnemar');
        await selectStandardOption(page, '#mcnemar-var1', '授業前理解', 'label');
        await selectStandardOption(page, '#mcnemar-var2', '授業後理解', 'label');
        await page.click('#run-mcnemar-btn', { force: true });
        await expect(page.locator('#mcnemar-analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/17_mcnemar.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});

// =============================================
// Group 5: 回帰・多変量・テキスト
// =============================================
test.describe('Visual Check Group 5: 回帰・多変量', () => {
    let errors: string[];

    test.beforeEach(async ({ page }) => {
        errors = setupConsoleLogs(page);
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
    });

    test('単回帰分析', async ({ page }) => {
        await navigateToFeature(page, 'regression_simple');
        await selectStandardOption(page, '#independent-var', '数学', 'label');
        await selectStandardOption(page, '#dependent-var', '理科', 'label');
        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/18_regression_simple.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Regression plot width').toBeGreaterThan(300);
            expect(plot.width, 'Regression plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('重回帰分析', async ({ page }) => {
        await navigateToFeature(page, 'regression_multiple');
        await selectStandardOption(page, '#dependent-vars', '理科', 'label');
        await selectStandardOption(page, '#independent-vars', '数学', 'label');
        await selectStandardOption(page, '#independent-vars', '英語', 'label');
        await page.click('#run-regression-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/19_regression_multiple.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('ロジスティック回帰', async ({ page }) => {
        test.setTimeout(60000);
        await navigateToFeature(page, 'logistic_regression');
        await page.waitForTimeout(1000);
        // outcome: binary variable
        await selectStandardOption(page, '#logistic-dep-var', '性別', 'label');
        await page.waitForTimeout(300);
        await selectVariables(page, ['数学', '英語']);
        await page.waitForTimeout(300);
        await page.click('#run-logistic-btn', { force: true });
        await expect(page.locator('#logistic-analysis-results')).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/20_logistic_regression.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('主成分分析 (PCA)', async ({ page }) => {
        await navigateToFeature(page, 'pca');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-pca-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/21_pca.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'PCA plot width').toBeGreaterThan(200);
            expect(plot.width, 'PCA plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('因子分析', async ({ page }) => {
        await navigateToFeature(page, 'factor_analysis');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.click('#run-factor-btn-container button');
        await expect(page.locator('#fa-analysis-results')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/22_factor_analysis.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });

    test('時系列分析', async ({ page }) => {
        await navigateToFeature(page, 'time_series');
        await selectStandardOption(page, '#time-var', 'ID', 'label');
        await selectStandardOption(page, '#value-var', '数学', 'label');
        await page.click('#run-btn-container button');
        await expect(page.locator('#ts-results-section')).toBeVisible();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/23_time_series.png`, fullPage: true });

        const plots = await getPlotlyDimensions(page);
        for (const plot of plots.filter(p => p.visible)) {
            expect(plot.width, 'Time series plot width').toBeGreaterThan(300);
            expect(plot.width, 'Time series plot too wide').toBeLessThan(1300);
        }
        expect(errors).toHaveLength(0);
    });

    test('テキストマイニング', async ({ page }) => {
        await navigateToFeature(page, 'text_mining');
        const count = await page.locator('#text-var option').count();
        expect(count, 'Text mining should expose at least one text variable').toBeGreaterThan(1);
        await page.selectOption('#text-var', { label: '感想' });
        await page.selectOption('#category-var', { label: 'クラス' });
        await page.click('#run-text-btn-container button');
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60000 });
        const posRankings = page.locator('h6', { hasText: '品詞別ランキング' });
        const networkLegends = page.locator('text=色分けの意味');
        await expect(posRankings.first()).toBeVisible({ timeout: 60000 });
        await expect(networkLegends.first()).toBeVisible({ timeout: 60000 });
        await page.waitForFunction(() => {
            const isVisible = (el: Element) => {
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
            };
            const canvases = Array.from(document.querySelectorAll('canvas')).filter(isVisible) as HTMLCanvasElement[];
            if (canvases.length === 0) return false;
            return canvases.every(canvas => {
                if (canvas.width <= 120 || canvas.height <= 80) return false;
                const ctx = canvas.getContext('2d');
                if (!ctx) return false;
                const sampleSize = 16;
                const points: Array<[number, number]> = [];
                for (let y = 0; y <= 4; y++) {
                    for (let x = 0; x <= 4; x++) {
                        points.push([
                            Math.min(Math.max(Math.floor((canvas.width * x) / 4), 0), Math.max(canvas.width - sampleSize, 0)),
                            Math.min(Math.max(Math.floor((canvas.height * y) / 4), 0), Math.max(canvas.height - sampleSize, 0))
                        ]);
                    }
                }
                return points.some(([x, y]) => {
                    const data = ctx.getImageData(x, y, Math.min(sampleSize, canvas.width), Math.min(sampleSize, canvas.height)).data;
                    return Array.from(data).some(value => value !== 0);
                });
            });
        }, null, { timeout: 60000 });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/24_text_mining.png`, fullPage: true });
        expect(errors).toHaveLength(0);
    });
});
