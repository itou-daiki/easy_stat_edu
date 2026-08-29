import { expect, test } from '@playwright/test';
import path from 'path';
import { selectStandardOption, selectVariables } from './utils/test-helpers';

test('図の題名・軸・系列概要を代替説明として同期する', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
    await page.locator('#main-data-file').setInputFiles(
        path.join(__dirname, '../datasets/demo_all_analysis.csv')
    );
    await page.locator('.feature-card[data-analysis="ttest"]').click();
    await expect(page.locator('#run-independent-btn')).toBeVisible();
    await selectStandardOption(page, '#group-var', '性別', 'label');
    await selectVariables(page, ['数学']);
    await page.locator('#run-independent-btn').click();

    const plot = page.locator('#visualization-section .js-plotly-plot').first();
    await expect(plot).toHaveAttribute('role', 'figure', { timeout: 10_000 });
    const descriptionId = await plot.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    await expect(page.locator(`#${descriptionId}`)).toContainText(/棒グラフ|箱ひげ図/);
    await expect(plot.locator('.main-svg').first()).toHaveAttribute('role', 'img');

    const editor = plot.locator('xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]');
    await editor.locator('summary').click();
    await editor.locator('[data-visualization-input="title"]').fill('数学得点の男女比較');
    await expect(plot).toHaveAccessibleName(/数学得点の男女比較/);
    await expect(page.locator(`#${descriptionId}`)).toContainText('数学得点の男女比較');
});

test('表の列見出し・行見出し・非表示タイトルを読み上げ可能に保つ', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
    await page.locator('#main-data-file').setInputFiles(
        path.join(__dirname, '../datasets/demo_all_analysis.csv')
    );
    await page.locator('.feature-card[data-analysis="ttest"]').click();
    await expect(page.locator('#run-independent-btn')).toBeVisible();

    await page.locator('#analysis-content').evaluate(root => {
        root.insertAdjacentHTML('beforeend', `
            <table id="accessibility-test-table">
                <thead><tr><th colspan="2">得点</th></tr><tr><th>科目</th><th>平均</th></tr></thead>
                <tbody><tr><th>数学</th><td>75</td></tr></tbody>
            </table>
        `);
    });

    const table = page.locator('#accessibility-test-table');
    await expect(table.locator('caption')).toBeVisible({ timeout: 10_000 });
    await expect(table.locator('thead tr').first().locator('th')).toHaveAttribute('scope', 'colgroup');
    await expect(table.locator('thead tr').nth(1).locator('th').first()).toHaveAttribute('scope', 'col');
    await expect(table.locator('tbody th')).toHaveAttribute('scope', 'row');

    const editor = table.locator('xpath=preceding-sibling::details[@data-editor-kind="table"][1]');
    await editor.locator('summary').click();
    await editor.locator('[data-visualization-control="table-title"]').uncheck();
    await expect(table.locator('caption')).toHaveClass(/sr-only/);
    await expect(table.locator('caption')).toHaveText(/分析結果表|得点|t検定/);
});
