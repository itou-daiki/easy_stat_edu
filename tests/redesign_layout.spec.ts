import { test, expect } from '@playwright/test';
import { navigateToFeature, uploadFile, selectStandardOption, selectVariables } from './utils/test-helpers';

/**
 * デザイン刷新（docs/redesign/DESIGN.md）のレイアウト上の約束を確認する。
 * - ヒーローの青い面は PC で 180〜240px、スマホではコンパクトに
 * - 375px 幅でページ全体が横スクロールしない
 * - キーボード操作時にフォーカス輪郭が見える
 */

async function boot(page) {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
}

test.describe('Redesign layout', () => {
    // 2026-10 v3: 青いヒーロー面は PC で 180〜240px 程度、スマホでは操作より上を占めすぎないこと
    test('hero band is confident on desktop and compact on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await boot(page);
        const desktop = await page.locator('.app-bar').evaluate(el => el.getBoundingClientRect().height);
        expect(desktop).toBeGreaterThanOrEqual(180);
        expect(desktop).toBeLessThanOrEqual(240);

        await page.setViewportSize({ width: 375, height: 812 });
        const mobile = await page.locator('.app-bar').evaluate(el => el.getBoundingClientRect().height);
        expect(mobile).toBeLessThanOrEqual(220);
    });

    test('no horizontal page scroll at 375px (home and t-test result)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await boot(page);
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await expect(page.locator('#main-file-info')).toBeVisible();
        const overflowHome = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowHome).toBeLessThanOrEqual(1);

        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.click('#independent-btn-container button');
        await expect(page.locator('#results-section')).toBeVisible();
        const overflowResult = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflowResult).toBeLessThanOrEqual(1);
    });

    test('keyboard focus shows a visible outline', async ({ page }) => {
        await boot(page);
        await page.locator('[data-language-switcher] button[data-locale="ja"]').focus();
        await page.keyboard.press('Tab');
        const outline = await page.evaluate(() => {
            const style = getComputedStyle(document.activeElement as Element);
            return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe('none');
        expect(outline.width).toBeGreaterThanOrEqual(2);
    });
});

test('method cards can be opened with the keyboard', async ({ page }) => {
    await page.goto('/');
    await page.click('#load-demo-btn');
    await page.click('.demo-option-btn[data-demo="demo_all_analysis.csv"]');
    await page.waitForSelector('#dataframe-container', { state: 'visible' });
    const card = page.locator('.feature-card[data-analysis="correlation"]');
    await expect(card).toHaveAttribute('role', 'button');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#run-correlation-btn')).toBeVisible();
});
