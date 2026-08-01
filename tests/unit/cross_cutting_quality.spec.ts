import { test, expect } from '@playwright/test';
import { navigateToFeature, selectStandardOption, uploadFile } from '../utils/test-helpers';

test.describe('Cross-cutting quality contracts', () => {
    test('documentation matches the current feature and privacy specification', async ({ page, request }) => {
        await page.goto('/');
        await expect(page.locator('.feature-card')).toHaveCount(23);
        await expect(page.locator('.analysis-methods-grid .method-item')).toHaveCount(23);
        const inAppHelp = await page.locator('.info-sections').filter({
            hasText: 'このアプリケーションについて'
        }).textContent();
        expect(inAppHelp).toContain('JavaScriptでデータの読込');
        expect(inAppHelp).toContain('23機能');
        expect(inAppHelp).toContain('Gemini APIへ送信します');
        expect(inAppHelp).not.toContain('Pythonライブラリの読み込みに数分');
        expect(inAppHelp).not.toContain('高度な多変量解析まで12種類');

        const [readmeResponse, featuresResponse, manualResponse] = await Promise.all([
            request.get('/README.md'),
            request.get('/FEATURES.md'),
            request.get('/manual.html')
        ]);
        const readme = await readmeResponse.text();
        const features = await featuresResponse.text();
        const manual = await manualResponse.text();

        expect(readme).toContain('分析・データ処理モジュール: 23機能');
        expect(readme).toContain('任意のGemini解釈補助');
        expect(readme).toContain('任意入力の縦横比');
        expect(readme).toContain('数値・日付軸の最小値／最大値');
        expect(readme).toContain('完全なオフライン動作は保証されません');
        expect(readme).not.toContain('サーバーへのデータ送信は一切行わず');
        expect(features).toContain('Yatesの連続性補正を主結果');
        expect(features).toContain('カテゴリごとのワードクラウドと共起ネットワークを連続表示');
        expect(features).toContain('必要な上限より小さい最大値を設定できません');
        expect(manual).toContain('入力・図表編集・保存');
        expect(manual).toContain('品詞別ランキング');
        expect(manual).toContain('データの一部が見えなくなったり差が実際より大きく見えたりします');
        expect(manual).not.toContain('AI分析サポーター');
        expect(manual).not.toContain('めちゃくちゃ');
        expect(manual).not.toContain('王道パターン');
    });

    test('contingency tables use pairwise-valid rows before creating category levels', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { buildContingencyTable } = await import('/js/utils.js');
            return buildContingencyTable([
                { row: 'A', col: 'X' },
                { row: 'B', col: null },
                { row: null, col: 'Y' },
                { row: 'B', col: 'Y' },
                { row: '  ', col: 'X' },
            ], 'row', 'col');
        });

        expect(result.rowKeys).toEqual(['A', 'B']);
        expect(result.colKeys).toEqual(['X', 'Y']);
        expect(result.observed).toEqual([[1, 0], [0, 1]]);
        expect(result.total).toBe(2);
        expect(result.excludedRows).toBe(3);
    });

    test('canvas exports preserve a selected ratio after adding a title and legend', async ({ page }) => {
        await page.goto('/');
        const frames = await page.evaluate(async () => {
            const { resolveCanvasExportFrame } = await import('/js/analyses/text_mining/helpers.js');
            return {
                square: resolveCanvasExportFrame(580, 580, 144, 324, '1:1'),
                wide: resolveCanvasExportFrame(960, 540, 72, 210, '16:9'),
                custom: resolveCanvasExportFrame(720, 480, 90, 180, '2.5:2'),
                invalid: resolveCanvasExportFrame(580, 580, 144, 324, '任意'),
                auto: resolveCanvasExportFrame(580, 580, 144, 324, 'auto')
            };
        });

        expect(frames.square.width).toBe(frames.square.height);
        expect(frames.square.contentX).toBeGreaterThan(0);
        expect(frames.wide.width / frames.wide.height).toBeCloseTo(16 / 9, 12);
        expect(frames.custom.width / frames.custom.height).toBeCloseTo(5 / 4, 12);
        expect(frames.invalid).toMatchObject({ width: 580, height: 1048, contentX: 0 });
        expect(frames.auto).toMatchObject({ width: 580, height: 1048, contentX: 0 });
    });

    test('significance brackets reserve space without clipping negative data', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { addSignificanceBrackets } = await import('/js/utils.js');
            const boxLayout = { yaxis: {}, shapes: [], annotations: [] };
            addSignificanceBrackets(
                boxLayout,
                [{ g1: 'A', g2: 'B', significance: '*', p: 0.02 }],
                ['A', 'B'],
                -2,
                4,
                { yMin: -6, baselineZero: false }
            );

            const barLayout = { yaxis: {}, shapes: [], annotations: [] };
            addSignificanceBrackets(
                barLayout,
                [{ g1: 'A', g2: 'B', significance: '**', p: 0.001 }],
                ['A', 'B'],
                -2,
                4,
                { yMin: -6 }
            );

            const constantLayout = { yaxis: {}, shapes: [], annotations: [] };
            addSignificanceBrackets(
                constantLayout,
                [{ g1: 'A', g2: 'B', significance: '†', p: 0.08 }],
                ['A', 'B'],
                0,
                0,
                { yMin: 0 }
            );
            return { boxLayout, barLayout, constantLayout };
        });

        const boxAnnotation = result.boxLayout.annotations[0];
        expect(result.boxLayout.yaxis.range[0]).toBeLessThan(-6);
        expect(result.boxLayout.yaxis.range[1]).toBeGreaterThan(boxAnnotation.y);
        expect(boxAnnotation).toMatchObject({ xref: 'x', yref: 'y', yanchor: 'bottom' });

        const barAnnotation = result.barLayout.annotations[0];
        expect(result.barLayout.yaxis.range[0]).toBeLessThanOrEqual(-6);
        expect(result.barLayout.yaxis.range[1]).toBeGreaterThan(barAnnotation.y);
        expect(result.barLayout.yaxis.range[1]).toBeGreaterThan(0);

        expect(result.constantLayout.yaxis.range.every(Number.isFinite)).toBe(true);
        expect(result.constantLayout.yaxis.range[1]).toBeGreaterThan(
            result.constantLayout.annotations[0].y
        );
    });

    test('grouped ANOVA brackets connect the compared bars with three or more groups', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { generateBracketsForGroupedPlot } = await import('/js/analyses/anova_two_way.js');
            const cellStats = {
                A: { Pre: { mean: 10, std: 1, n: 10 } },
                B: { Pre: { mean: 12, std: 1, n: 10 } },
                C: { Pre: { mean: 14, std: 1, n: 10 } }
            };
            return generateBracketsForGroupedPlot(
                [
                    { xIndex: 0, g1: 'A', g2: 'B', p: 0.01 },
                    { xIndex: 0, g1: 'B', g2: 'C', p: 0.02 }
                ],
                ['A', 'B', 'C'],
                ['Pre'],
                cellStats
            );
        });

        const firstHorizontal = result.shapes[0];
        const secondHorizontal = result.shapes[3];
        expect(firstHorizontal.x0).toBeCloseTo(-0.8 / 3, 8);
        expect(firstHorizontal.x1).toBeCloseTo(0, 8);
        expect(secondHorizontal.x0).toBeCloseTo(0, 8);
        expect(secondHorizontal.x1).toBeCloseTo(0.8 / 3, 8);
        expect(result.recommendedMaxY).toBeGreaterThan(result.annotations[1].y);
    });

    test('residual cell p-values use Holm correction for RxC but not redundant 2x2 cells', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { calculateResidualPValues } = await import('/js/utils.js');
            return {
                twoByTwo: calculateResidualPValues([[2.2, -2.2], [-2.2, 2.2]]),
                threeByThree: calculateResidualPValues([
                    [2.2, -1.1, 0.4],
                    [-1.4, 2.4, -0.8],
                    [0.2, -1.5, 2.1]
                ])
            };
        });

        expect(result.twoByTwo[0][0].method).toBe('none-2x2');
        expect(result.twoByTwo[0][0].adjusted).toBeCloseTo(result.twoByTwo[0][0].raw, 12);
        expect(result.threeByThree[0][0].method).toBe('holm');
        expect(result.threeByThree.flat().every(cell => cell.adjusted >= cell.raw)).toBe(true);
        expect(result.threeByThree.flat().some(cell => cell.adjusted > cell.raw)).toBe(true);
    });

    test('shared interpretation is concise without causal or null-acceptance claims', async ({ page }) => {
        await page.goto('/');
        const interpretations = await page.evaluate(async () => {
            const { InterpretationHelper } = await import('/js/utils.js');
            return {
                correlation: InterpretationHelper.interpretCorrelation(0.2, 0.20, 'X', 'Y'),
                ttest: InterpretationHelper.interpretTTest(0.20, 10, 9, ['A', 'B'], 0.2),
                anova: InterpretationHelper.interpretANOVA(0.20, 0.05, '群', '得点'),
                chiSquare: InterpretationHelper.interpretChiSquare(0.20, 0.10, '学年', '回答'),
                regression: InterpretationHelper.interpretRegression(
                    0.3,
                    0.01,
                    'Y',
                    [{ name: 'X', beta: 0.5, p: 0.01, stdBeta: 0.4 }]
                ),
                mannWhitney: InterpretationHelper.interpretMannWhitney(0.20, 12, 10, ['A', 'B'], 0.15),
                wilcoxon: InterpretationHelper.interpretWilcoxonSignedRank(0.20, 0.15, '前', '後', 10, 11)
            };
        });

        expect(interpretations.correlation).toContain('この結果だけで「無関係」とは決められません');
        expect(interpretations.ttest).toContain('この結果だけで「2群の平均が同じ」とは決められません');
        expect(interpretations.anova).toContain('この結果だけで「すべての平均が同じ」とは決められません');
        expect(interpretations.chiSquare).toContain('この結果だけで「互いに無関係」とは決められません');
        expect(interpretations.regression).toContain('この分析だけで原因と結果は決められません');
        expect(interpretations.mannWhitney).toContain('この結果だけで「同じ分布」とは決められません');
        expect(interpretations.wilcoxon).toContain('この結果だけで「変化がない」とは決められません');
        expect(interpretations.regression).not.toContain('増加させる');
        expect(Object.values(interpretations).join(' ')).not.toMatch(/十分な証拠|認められました|判断してください|検討してください/u);
    });

    test('PCA rejects a zero-variance variable before standardization', async ({ page }) => {
        await page.goto('/');
        const message = await page.evaluate(async () => {
            const { performPCA } = await import('/js/analyses/pca/helpers.js');
            try {
                performPCA(['constant', 'varied'], [
                    { constant: 1, varied: 1 },
                    { constant: 1, varied: 2 },
                    { constant: 1, varied: 3 }
                ]);
                return '';
            } catch (error) {
                return error.message;
            }
        });
        expect(message).toContain('分散が0');
    });

    test('analysis formulas contain no JavaScript control characters and are typeset lazily', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'ttest');

        const logicSection = page.locator('.collapsible-section', {
            hasText: '分析ロジック・計算式詳説'
        }).first();
        const rawText = await logicSection.textContent();
        expect(rawText).not.toMatch(/[\u0008\u000c]/);
        await expect(logicSection.locator('mjx-container').first()).toHaveCount(1, { timeout: 20000 });
    });

    test('all formula-bearing analysis screens keep readable source text', async ({ page }) => {
        const featureIds = [
            'ttest',
            'eda',
            'correlation',
            'chi_square',
            'anova_one_way',
            'anova_two_way',
            'regression_simple',
            'regression_multiple',
            'pca',
            'time_series',
            'mann_whitney'
        ];

        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await uploadFile(page, 'datasets/demo_all_analysis.csv');

        for (const featureId of featureIds) {
            await navigateToFeature(page, featureId);
            const text = await page.locator('#analysis-content').textContent();
            expect(text, featureId).not.toMatch(/[\u0008\u000c]/);
            await page.locator('.btn-back').click();
            await expect(page.locator(`.feature-card[data-analysis="${featureId}"]`)).toBeVisible();
        }
    });

    test('non-significant Fisher result does not claim independence or color residuals as significant', async ({ page }) => {
        const rows = [
            '群,結果',
            'A,あり', 'A,あり', 'A,あり', 'A,なし', 'A,なし',
            'B,あり', 'B,あり', 'B,なし', 'B,なし', 'B,なし'
        ].join('\n');

        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles({
            name: 'fisher_non_significant.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(rows, 'utf8')
        });
        await navigateToFeature(page, 'fisher_exact');
        await selectStandardOption(page, '#row-var', '群', 'label');
        await selectStandardOption(page, '#col-var', '結果', 'label');
        await page.click('#run-fisher-btn');

        const results = page.locator('#fisher-results');
        await expect(results).toContainText('この結果だけで「互いに無関係」とは決められません');
        await expect(results).not.toContainText('互いに独立である');
        const coloredResiduals = await results.locator('table').locator('td').evaluateAll(cells => (
            cells.filter(cell => {
                const color = getComputedStyle(cell).backgroundColor;
                return color === 'rgb(219, 234, 254)' || color === 'rgb(254, 226, 226)';
            }).length
        ));
        expect(coloredResiduals).toBe(0);
    });
});
