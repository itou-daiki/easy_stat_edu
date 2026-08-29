import { expect, test } from '@playwright/test';
import path from 'path';

test('テキストマイニング専用ライブラリを初期画面では読み込まない', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });

    expect(requests.some(url => /wordcloud2|vis-network\.min\.js|tiny-segmenter/u.test(url))).toBe(false);

    await page.locator('#main-data-file').setInputFiles(
        path.join(__dirname, '../datasets/textmining_demo.csv')
    );
    await page.locator('.feature-card[data-analysis="text_mining"]').click();
    await expect(page.locator('#run-text-btn')).toBeVisible();
    await page.locator('#text-var').selectOption({ index: 1 });
    await page.locator('#run-text-btn').click();
    await expect(page.locator('#overall-wordcloud')).toBeVisible({ timeout: 60_000 });

    expect(requests.some(url => /wordcloud2/u.test(url))).toBe(true);
    expect(requests.some(url => /vis-network\.min\.js/u.test(url))).toBe(true);
    expect(requests.some(url => /tiny-segmenter/u.test(url))).toBe(false);
});

test('動的リソースの失敗をタイムアウト後に再試行できる', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
    const result = await page.evaluate(async () => {
        const { loadScriptOnce } = await import('/js/resource_loader.js');
        const url = '/missing-library-for-test.js';
        const attempts = [];
        for (let index = 0; index < 2; index++) {
            try {
                await loadScriptOnce(url, { timeoutMs: 500 });
            } catch (error) {
                attempts.push(error.message);
            }
        }
        return {
            attempts,
            remainingScripts: document.querySelectorAll(`script[src$="${url}"]`).length
        };
    });

    expect(result.attempts).toHaveLength(2);
    expect(result.remainingScripts).toBe(0);
});
