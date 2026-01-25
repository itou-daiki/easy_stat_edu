import { test, expect } from '@playwright/test';

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
        // select要素を選択
        await page.selectOption('#group-var', { label: '性別' });

        // 従属変数: 数学 (数値)
        // カスタムマルチセレクトコンポーネントの操作
        // 1. ドロップダウンを開く
        await page.locator('#dep-var-multiselect .multiselect-input').click();
        // 2. オプションを選択
        await page.locator('.multiselect-option').filter({ hasText: '数学' }).click();
        // 3. ドロップダウンを閉じる (外側をクリック)
        await page.locator('body').click();

        // 5. 分析実行
        await page.click('#run-u-test-btn');

        // 6. 結果表示の検証
        const resultsSection = page.locator('#test-results-section');
        await expect(resultsSection).toBeVisible();

        // 結果テーブルが表示されているか
        await expect(page.locator('#test-results-table table')).toBeVisible();

        // 7. [新機能] 論文報告用テーブル (Hyoun) の検証
        const reportingTable = page.locator('#reporting-table-container table');
        await expect(reportingTable).toBeVisible();
        await expect(reportingTable).toContainText('Table 1. 結果の比較');
        await expect(reportingTable).toContainText('Mean Rank');
        await expect(reportingTable).toContainText('Effect size r');

        // 8. [新機能] 可視化 (Plotly) の検証
        const plotContainer = page.locator('#plots-container .plot-container');
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
