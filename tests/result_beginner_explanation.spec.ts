import { expect, test } from '@playwright/test';
import path from 'path';
import { selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('分析結果の非AIかんたん説明', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
    });

    test('t検定の実行後だけ、結果と指標を折りたたみ表示する', async ({ page }) => {
        const geminiRequests: string[] = [];
        page.on('request', request => {
            if (/generativelanguage\.googleapis\.com/i.test(request.url())) {
                geminiRequests.push(request.url());
            }
        });

        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/ttest_demo.xlsx')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await expect(page.locator('[data-result-beginner-explanation]')).toHaveCount(0);

        await selectStandardOption(page, '#group-var', '組', 'label');
        await selectVariables(page, ['数学']);
        await page.locator('#run-independent-btn').click();

        const details = page.locator('[data-result-beginner-explanation="ttest"]');
        await expect(details).toHaveCount(1);
        await expect(details.locator('summary')).toContainText('今回の結果を簡単に説明すると');
        await expect(details.locator('summary')).toContainText('AIを使わず');
        await expect(details).not.toHaveAttribute('open', '');

        await details.locator('summary').press('Enter');
        await expect(details).toHaveAttribute('open', '');
        await expect(details).toContainText('今回わかったこと');
        await expect(details).toContainText('数学');
        await expect(details).toContainText('この指標が何を示すか');
        await expect(details.locator('dt')).toContainText(['平均値', 'SD（標準偏差）', 't値', 'df（自由度）', 'p値']);
        await expect(details).toContainText('「結果が偶然だった確率」ではありません');
        await expect(details).toContainText('差の向きは各群・各時点の平均値で確認します');
        await expect(details).toContainText('APIや外部の生成AIには送信していません');
        expect(geminiRequests).toEqual([]);

        await page.locator('#run-independent-btn').click();
        await expect(page.locator('[data-result-beginner-explanation="ttest"]')).toHaveCount(1);
    });

    test('テキスト直接入力の結果には語の指標と実データの要約を表示する', async ({ page }) => {
        await page.locator('.feature-card[data-analysis="text_mining"]').click();
        await page.locator('#tm-input-direct').click();
        await page.locator('#tm-direct-text').fill([
            'データ分析の授業が楽しい',
            'データから傾向を発見できた',
            '授業でグラフを作るのが楽しい',
            'グラフからデータの特徴を発見した'
        ].join('\n'));
        await page.locator('#run-text-btn').click();

        await expect(page.locator('.tm-summary-strip')).toBeVisible({ timeout: 30_000 });
        const details = page.locator('[data-result-beginner-explanation="text_mining"]');
        await expect(details).toHaveCount(1);
        await details.locator('summary').click();

        await expect(details).toContainText('文書: 4');
        await expect(details).toContainText('出現回数が多い語');
        await expect(details.locator('dt')).toContainText([
            'TF（出現回数）',
            'DF（文書頻度）',
            'TF-IDF',
            'Jaccard係数'
        ]);
        await expect(details).toContainText('共起しやすい関係ですが、意味の近さや因果関係は示しません');
    });

    test('カイ二乗結果では関連の結論とセルを読む指標を説明する', async ({ page }) => {
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await page.locator('.feature-card[data-analysis="chi_square"]').click();
        await selectStandardOption(page, '#row-var', '性別', 'label');
        await selectStandardOption(page, '#col-var', 'クラス', 'label');
        await page.locator('#run-chi-btn').click();

        const details = page.locator('[data-result-beginner-explanation="chi_square"]');
        await expect(details).toHaveCount(1);
        await details.locator('summary').click();
        await expect(details).toContainText('性別');
        await expect(details).toContainText('クラス');
        await expect(details).toContainText('χ²（カイ二乗値）');
        await expect(details).toContainText('p値');
        await expect(details).toContainText('CramerのV');
        await expect(details).toContainText('調整済み残差 z');
        await expect(details).toContainText('全体検定と多重比較補正を確認してから解釈します');
    });

    test('狭い画面でも結果説明と指標が横にはみ出さない', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/ttest_demo.xlsx')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await selectStandardOption(page, '#group-var', '組', 'label');
        await selectVariables(page, ['数学']);
        await page.locator('#run-independent-btn').click();

        const details = page.locator('[data-result-beginner-explanation="ttest"]');
        await details.locator('summary').click();
        const layout = await details.evaluate(element => ({
            pageWidth: document.documentElement.clientWidth,
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            columns: getComputedStyle(element.querySelector('.result-beginner-grid')).gridTemplateColumns
        }));

        expect(layout.left).toBeGreaterThanOrEqual(0);
        expect(layout.right).toBeLessThanOrEqual(layout.pageWidth + 1);
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
        expect(layout.columns.trim().split(/\s+/)).toHaveLength(1);
    });
});
