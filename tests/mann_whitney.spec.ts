import { test, expect } from '@playwright/test';
import { selectVariables, selectStandardOption } from './utils/test-helpers';

test.describe('Mann-Whitney U Test Feature', () => {
    test.beforeEach(async ({ page }) => {
        // ローカルサーバーのポートに合わせて調整してください (default: 8081)
        await page.goto('http://127.0.0.1:8081/');
        // ページ読み込み完了を待機
        await page.waitForSelector('#load-demo-btn', { state: 'visible' });
    });

    test('should run Mann-Whitney U Test and display Reporting Table', async ({ page }) => {
        // 1. デモデータをロード (これによりUIが有効化される)
        await page.click('#load-demo-btn');
        await page.waitForSelector('#demo-modal', { state: 'visible' });
        await page.click('.demo-option-btn[data-demo="demo_all_analysis.csv"]');

        // データロード完了トーストまたはUIの活性化を待つ
        // ここでは "summary-stats-container" が表示されるのを待つなどが確実
        await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });

        // 2. マン・ホイットニーのU検定カードを探してクリック
        // カードは data-analysis="mann_whitney" を持つ
        const uTestCard = page.locator('.feature-card[data-analysis="mann_whitney"]');
        await expect(uTestCard).toBeVisible();
        await uTestCard.click();

        // 3. 分析画面への遷移確認
        await expect(page.locator('#analysis-area')).toBeVisible();
        await expect(page.locator('#analysis-area h3').filter({ hasText: 'マン・ホイットニーのU検定' })).toBeVisible();

        // 4. 変数選択
        // グループ変数: 性別 (カテゴリカル, 2群)
        await selectStandardOption(page, '#group-var', '性別', 'value');

        // 従属変数: 数学 (数値)
        await selectVariables(page, ['数学']);

        // 5. 分析実行
        await page.click('#run-u-test-btn', { force: true });

        // 6. 結果表示の検証
        const resultsSection = page.locator('#results-section');
        await expect(resultsSection).toBeVisible();

        // 結果テーブルが表示されているか
        await expect(page.locator('#test-results-table')).toBeVisible();

        // 7. [新機能] 論文報告用テーブル (Hyoun) の検証
        const reportingTable = page.locator('#reporting-table-container table');
        await expect(reportingTable).toBeVisible();
        await expect(reportingTable).toContainText('男性');
        await expect(reportingTable).toContainText('女性');
        await expect(reportingTable).toContainText('U');
        await expect(reportingTable).toContainText('r');

        // 8. [新機能] 可視化 (Plotly) の検証
        const plotContainer = page.locator('#plots-container .plot-container').first();
        await expect(plotContainer).toBeVisible();
        // Plotlyのグラフが描画されたことを確認（class="js-plotly-plot"などが付与される）
        await expect(page.locator('.js-plotly-plot')).toBeVisible();

        // 9. [新機能] 解釈文の検証
        const interpretation = page.locator('#interpretation-content');
        await expect(interpretation).toContainText('効果量 r =');
        // "小さい" "中程度" "大きい" "ほとんどない" のいずれかを含むはず
        await expect(interpretation).toHaveText(/(小さい|中程度|大きい|ほとんどない)/);
    });
});
