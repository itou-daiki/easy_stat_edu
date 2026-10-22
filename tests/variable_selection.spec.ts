import { test, expect } from '@playwright/test';

const GROUP_COLUMN = '性別理由による制約経験';
const SURVEY_CSV = [
    `${GROUP_COLUMN},性別,得点,自由記述`,
    ...Array.from({ length: 12 }, (_, i) => [
        i % 2 ? 'はい' : 'いいえ',
        i % 3 ? '女性' : '男性',
        50 + i,
        `回答${i + 1}では自分らしい表現について考えた。`
    ].join(','))
].join('\n');

test.describe('survey group variable selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#main-upload-btn')).toBeEnabled({ timeout: 30000 });
        await page.locator('#main-data-file').setInputFiles({
            name: 'synthetic-survey.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(SURVEY_CSV, 'utf8')
        });
        await expect(page.locator('#main-file-info')).toContainText('synthetic-survey.csv');
    });

    test('offers the survey group in t-test and Mann-Whitney selectors', async ({ page }) => {
        await page.locator('.ui-mode-tab[data-ui-mode="all"]').click();

        for (const analysis of ['ttest', 'mann_whitney']) {
            await page.locator(`.feature-card[data-analysis="${analysis}"]`).click();
            const groupSelector = page.locator('#group-var');
            await expect(groupSelector).toBeVisible();
            await expect(groupSelector.locator(`option[value="${GROUP_COLUMN}"]`)).toHaveCount(1);
            await expect(groupSelector.locator('option[value="性別"]')).toHaveCount(1);
            await expect(groupSelector.locator('option[value="自由記述"]')).toHaveCount(0);
            await groupSelector.selectOption(GROUP_COLUMN);
            await expect(groupSelector).toHaveValue(GROUP_COLUMN);
            await page.locator('.btn-back').click();
        }
    });

    test('offers the survey group in beginner mode', async ({ page }) => {
        await page.locator('.ui-mode-tab[data-ui-mode="beginner"]').click();
        await page.locator('#guided-panel input[name="guided-purpose"][value="compare"]').check();
        await page.locator('#guided-panel input[name="guided-design"][value="independent"]').check();

        const groupSelector = page.locator('#guided-groupVar');
        await expect(groupSelector).toBeVisible();
        await expect(groupSelector.locator(`option[value="${GROUP_COLUMN}"]`)).toHaveCount(1);
        await expect(groupSelector.locator('option[value="性別"]')).toHaveCount(1);
        await expect(groupSelector.locator('option[value="自由記述"]')).toHaveCount(0);
        await groupSelector.selectOption(GROUP_COLUMN);
        await expect(groupSelector).toHaveValue(GROUP_COLUMN);
    });
});
