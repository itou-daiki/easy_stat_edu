// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Manual data input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    });

    test('loads an Excel-style tabular paste into the shared analysis data flow', async ({ page }) => {
        await page.locator('#data-source-paste-tab').click();
        await expect(page.locator('#paste-input-panel')).toBeVisible();

        const excelPaste = [
            '群\t得点\t自由記述',
            'A\t10\tデータ分析が楽しい',
            'B\t20\tグラフが分かりやすい',
            'A\t15\tデータから発見できた',
            'B\t25\t実習が楽しい'
        ].join('\n');
        await page.locator('#tabular-data-input').fill(excelPaste);
        await expect(page.locator('#table-input-status')).toContainText('タブ区切り');
        await page.locator('#load-pasted-data-btn').click();

        await expect(page.locator('#main-file-info')).toBeVisible();
        await expect(page.locator('#main-file-info')).toContainText('貼り付けデータ');
        await expect(page.locator('#table-input-status')).toHaveText('4行 × 3列を読み込みました');
        await expect(page.locator('#dataframe-container')).toContainText('データ分析が楽しい');
        await expect(page.locator('.feature-card[data-analysis="ttest"]')).not.toHaveClass(/disabled/);

        await page.locator('.feature-card[data-analysis="text_mining"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();
        await expect(page.locator('#tm-input-column')).toHaveClass(/active/);
        await expect(page.locator('#text-var option[value="自由記述"]')).toHaveCount(1);
        await expect(page.locator('#category-var option[value="群"]')).toHaveCount(1);
        await expect(page.locator('#category-var option[value="自由記述"]')).toHaveCount(0);
    });

    test('preserves quoted commas and supplies names for blank or duplicate headers', async ({ page }) => {
        const parsed = await page.evaluate(() => {
            return window.parseTabularText([
                '名前,得点,得点,',
                'A,10,11,"説明, 補足"',
                'B,20,21,確認'
            ].join('\n'));
        });

        expect(parsed.headers).toEqual(['名前', '得点', '得点_2', '列4']);
        expect(parsed.data).toHaveLength(2);
        expect(parsed.data[0]['列4']).toBe('説明, 補足');
        expect(parsed.data[1]['得点_2']).toBe('21');

        const multilineCell = await page.evaluate(() => {
            return window.parseTabularText('ID\t自由記述\n1\t"一行目\n二行目"\n2\t通常回答');
        });
        expect(multilineCell.data).toHaveLength(2);
        expect(multilineCell.data[0]['自由記述']).toBe('一行目\n二行目');
    });

    test('runs text mining from direct text input without loading a file', async ({ page }) => {
        test.setTimeout(120000);
        const dialogs = [];
        page.on('dialog', async dialog => {
            dialogs.push(dialog.message());
            await dialog.accept();
        });

        await page.locator('.feature-card[data-analysis="text_mining"]').click();
        await expect(page.locator('#analysis-area')).toBeVisible();
        await expect(page.locator('#tm-input-direct')).toHaveClass(/active/);
        await expect(page.locator('#tm-input-column')).toBeDisabled();
        await expect(page.locator('#tm-direct-input-panel')).toBeVisible();

        await page.locator('#tm-direct-text').fill([
            'データ分析の授業が楽しい',
            'データを使う実習が分かりやすい',
            'グラフからデータの傾向を発見できた',
            '実習でグラフを作ることが楽しい'
        ].join('\n'));
        await expect(page.locator('#tm-direct-text-status')).toContainText('4文書');
        await page.locator('.tm-advanced-settings summary').click();
        await page.locator('#tm-min-frequency').fill('1');
        await page.locator('#run-text-btn').click();

        await expect(page.locator('#tm-overall .tm-section-title')).toContainText('N=4', { timeout: 60000 });
        await expect(page.locator('#overall-wordcloud')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#overall-network canvas')).toBeVisible();
        await expect(page.locator('#tm-cat-tab-btn')).toBeHidden();
        expect(dialogs).toEqual([]);

        await page.setViewportSize({ width: 390, height: 844 });
        const overflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1);
    });
});
