import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('複数選択のキーボード操作', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
    });

    test('候補を矢印・Space・Escapeで選択し、タグをキーボードで外せる', async ({ page }) => {
        const container = page.locator('#dep-var-multiselect');
        const trigger = container.locator('.multiselect-trigger');
        const listbox = container.locator('[role="listbox"]');

        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await trigger.focus();
        await page.keyboard.press('ArrowDown');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(listbox.locator('[role="option"]').first()).toBeFocused();

        await page.keyboard.press('Space');
        await expect(listbox.locator('[role="option"]').first()).toHaveAttribute('aria-selected', 'true');
        await expect(container.locator('.multiselect-tag')).toHaveCount(1);

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await expect(container.locator('.multiselect-tag')).toHaveCount(2);

        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        const remove = container.locator('.multiselect-remove').first();
        await expect(remove).toHaveAttribute('aria-label', /選択から外す/);
        await remove.focus();
        await page.keyboard.press('Enter');
        await expect(container.locator('.multiselect-tag')).toHaveCount(1);
    });

    test('英語モードでは動的な操作名も英語になる', async ({ page }) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        const container = page.locator('#dep-var-multiselect');
        const trigger = container.locator('.multiselect-trigger');
        await expect(trigger).toHaveAttribute('aria-label', /Select/);

        await trigger.click();
        await container.locator('[role="option"]').first().click();
        await expect(container.locator('.multiselect-remove').first()).toHaveAttribute(
            'aria-label',
            /Remove .* from selection/
        );
    });

    test('マウスでも候補を閉じずに複数項目を連続選択できる', async ({ page }) => {
        const container = page.locator('#dep-var-multiselect');
        const trigger = container.locator('.multiselect-trigger');
        const options = container.locator('[role="option"]');

        await trigger.click();
        await options.nth(0).click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await options.nth(1).click();

        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(container.locator('.multiselect-tag')).toHaveCount(2);
        await expect(container.locator('.multiselect-dropdown')).toBeVisible();
    });
});
