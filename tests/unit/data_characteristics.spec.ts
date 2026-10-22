import { test, expect } from '@playwright/test';

test.describe('data characteristics for survey variable selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => typeof (window as any).analyzeDataCharacteristics === 'function');
    });

    test('keeps repeated choices categorical even when the column name contains reason or opinion', async ({ page }) => {
        const characteristics = await page.evaluate(() => {
            const rows = Array.from({ length: 12 }, (_, i) => ({
                性別理由による制約経験: i % 2 ? 'はい' : 'いいえ',
                意見の一致: i % 2 ? '一致' : '不一致',
                選択理由: ['家庭', '部活動', 'その他'][i % 3]
            }));
            return (window as any).analyzeDataCharacteristics(rows);
        });

        expect(characteristics).toEqual({
            numericColumns: [],
            categoricalColumns: ['性別理由による制約経験', '意見の一致', '選択理由'],
            textColumns: []
        });
    });

    test('keeps a small set of distinct free responses as text', async ({ page }) => {
        const characteristics = await page.evaluate(() => {
            const responses = ['データ分析が楽しい', 'グラフが分かりやすい', 'データから発見できた', '実習が楽しい'];
            const rows = responses.map(response => ({
                自由記述: response,
                選んだ理由: response,
                意見: response
            }));
            return (window as any).analyzeDataCharacteristics(rows);
        });

        expect(characteristics).toEqual({
            numericColumns: [],
            categoricalColumns: [],
            textColumns: ['自由記述', '選んだ理由', '意見']
        });
    });

    test('keeps repeated long responses and short sentences as text', async ({ page }) => {
        const characteristics = await page.evaluate(() => {
            const rows = Array.from({ length: 12 }, (_, i) => ({
                選んだ理由: i % 2 ? '自分でデータを集めて分析できるから' : '身近な問題を調べる方法を学べるから',
                意見: i % 2 ? '楽しい。' : '便利。',
                変更理由: i % 2 ? '好き!\n楽しい' : '便利?'
            }));
            return (window as any).analyzeDataCharacteristics(rows);
        });

        expect(characteristics).toEqual({
            numericColumns: [],
            categoricalColumns: [],
            textColumns: ['選んだ理由', '意見', '変更理由']
        });
    });

    test('preserves explicit free-text columns even when short responses repeat', async ({ page }) => {
        const characteristics = await page.evaluate(() => {
            const rows = Array.from({ length: 12 }, (_, i) => ({
                自由記述: i % 2 ? '楽しい' : '難しい',
                コメント: i % 2 ? '良い' : '普通',
                '理由（自由記述）': i % 2 ? '興味' : '必要'
            }));
            return (window as any).analyzeDataCharacteristics(rows);
        });

        expect(characteristics).toEqual({
            numericColumns: [],
            categoricalColumns: [],
            textColumns: ['自由記述', 'コメント', '理由（自由記述）']
        });
    });

    test('preserves numeric detection, numeric category codes and ordinary categories', async ({ page }) => {
        const result = await page.evaluate(() => {
            const rows = Array.from({ length: 12 }, (_, i) => ({
                理由得点: String(50 + i),
                意見コード: String(1 + i % 3),
                所属: i % 2 ? 'A組' : 'B組'
            }));
            const characteristics = (window as any).analyzeDataCharacteristics(rows);
            return { characteristics, firstRow: rows[0] };
        });

        expect(result.characteristics).toEqual({
            numericColumns: ['理由得点', '意見コード'],
            categoricalColumns: ['意見コード', '所属'],
            textColumns: []
        });
        expect(result.firstRow).toEqual({ 理由得点: 50, 意見コード: 1, 所属: 'B組' });
    });
});
