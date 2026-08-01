import { expect, test } from '@playwright/test';
import path from 'path';
import { selectStandardOption, selectVariables } from './utils/test-helpers';

test.describe('分析結果のかんたん説明', () => {
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
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await expect(page.locator('[data-result-beginner-explanation]')).toHaveCount(0);

        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
        await page.locator('#run-independent-btn').click();

        const details = page.locator('[data-result-beginner-explanation="ttest"]');
        await expect(details).toHaveCount(1);
        await expect(details.locator('summary')).toContainText('今回の結果を簡単に説明すると');
        await expect(details.locator('summary')).toContainText('結果のポイント、指標の意味と見方、注意点を確認');
        await expect(details).not.toHaveAttribute('open', '');

        await details.locator('summary').press('Enter');
        await expect(details).toHaveAttribute('open', '');
        await expect(details).toContainText('結果のポイント');
        await expect(details).toContainText('数学・英語・理科・学習時間');
        await expect(details).toContainText('今回の人数とばらつきを考えると、男性と女性の平均差がはっきりしているとは言えませんでした');
        await expect(details).toContainText('いずれも p ≥ .05');
        await expect(details).toContainText('平均値は4項目すべてで男性の方が高く');
        await expect(details).toContainText('差の大きさはすべて「中程度」でした（d = 0.50〜0.56）');
        await expect(details).toContainText('この指標が何を示すか');
        await expect(details.locator('dt')).toContainText([
            '平均値', 'SD（標準偏差）', 'p値', 'd・d_z（効果量）', '95%信頼区間', 't値', 'df（自由度）'
        ]);
        await expect(details).toContainText('今回以上に極端な結果が出る確率');
        await expect(details).toContainText('.05以上でも「同じ」とは言えません');
        await expect(details).toContainText('絶対値は0.2で小、0.5で中、0.8で大');
        await expect(details.locator('.result-metric-meaning')).toHaveCount(7);
        await expect(details.locator('.result-metric-reading')).toHaveCount(7);
        await expect(details.locator('.result-metric-reading strong')).toHaveText(Array(7).fill('見方:'));
        await expect(details).toContainText('p ≥ .05でも効果量が中程度になることがあり、矛盾ではありません');
        await expect(details).toContainText('「同じ」と証明した結果でもありません');
        await expect(details).not.toContainText('固定ルール');
        await expect(details).not.toContainText('API');
        await expect(details).not.toContainText('生成AI');
        await expect(page.locator('#ai-assist-toggle')).toHaveCSS('width', '48px');
        await expect(page.locator('#ai-assist-toggle span')).toBeHidden();
        const [detailsBox, aiButtonBox] = await Promise.all([
            details.boundingBox(),
            page.locator('#ai-assist-toggle').boundingBox()
        ]);
        expect(detailsBox).not.toBeNull();
        expect(aiButtonBox).not.toBeNull();
        expect(aiButtonBox!.x).toBeGreaterThanOrEqual(detailsBox!.x + detailsBox!.width);
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
        await expect(details).toContainText('1に近いほど一緒に使われやすい語です');
        await expect(details).toContainText('意味の近さや因果関係を示す値ではありません');
    });

    test('対応ありt検定でも変化の向きと差の大きさを短く説明する', async ({ page }) => {
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/ttest_demo.xlsx')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await page.locator('input[name="test-type"][value="paired"]').click();
        await selectStandardOption(page, '#paired-var-pre', '英語', 'label');
        await selectStandardOption(page, '#paired-var-post', '数学', 'label');
        await page.locator('#add-pair-btn').click();
        await page.locator('#run-paired-btn').click();

        const details = page.locator('[data-result-beginner-explanation="ttest"]');
        await details.locator('summary').click();
        await expect(details).toContainText('英語 → 数学');
        await expect(details).toContainText('平均の変化');
        await expect(details).toContainText('差の大きさは');
        await expect(details).toContainText('d_z =');
        await expect(details).not.toContainText('十分な証拠は得られませんでした');
    });

    test('1サンプルt検定でも平均と基準値を自然な文で比べる', async ({ page }) => {
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/ttest_demo.xlsx')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await page.locator('input[name="test-type"][value="one-sample"]').click();
        await selectStandardOption(page, '#one-sample-var', '数学', 'label');
        await page.locator('#one-sample-mu').fill('50');
        await page.locator('#run-one-sample-btn').click();

        const details = page.locator('[data-result-beginner-explanation="ttest"]');
        await details.locator('summary').click();
        await expect(details).toContainText('数学の平均は基準値 50.00');
        await expect(details).toContainText('基準値との違いがはっきりしているとは言えませんでした');
        await expect(details).toContainText('差の大きさは');
        await expect(details).not.toContainText('十分な証拠は得られませんでした');
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
        await expect(details).toContainText('＋は予想より多く、－は少ない方向です');
        await expect(details).toContainText('±1.96は参考値');
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
