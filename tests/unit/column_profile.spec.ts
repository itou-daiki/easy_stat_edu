import { test, expect } from '@playwright/test';

test.describe('column profile (beginner mode helpers)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('excludes ID-like and constant columns but keeps short score columns', async ({ page }) => {
        const profile = await page.evaluate(async () => {
            const { profileColumns } = await import('/js/guided/column_profile.js');
            const data = Array.from({ length: 12 }, (_, i) => ({
                出席番号: i + 1,
                No: i + 101,
                定数: 5,
                クラス: ['A', 'B', 'C'][i % 3],
                点数: [5, 7, 6, 9, 8, 10, 4, 6, 7, 8, 9, 5][i]
            }));
            const characteristics = {
                numericColumns: ['出席番号', 'No', '定数', '点数'],
                categoricalColumns: ['定数', 'クラス', '点数'],
                textColumns: []
            };
            const small = profileColumns([{ 値: 5 }, { 値: 6 }, { 値: 7 }, { 値: 8 }, { 値: 9 }, { 値: 10 }],
                { numericColumns: ['値'], categoricalColumns: ['値'], textColumns: [] });
            const result = profileColumns(data, characteristics);
            return {
                numeric: result.numeric.map((c: any) => c.name),
                groups: result.groupCandidates.map((c: any) => c.name),
                excluded: result.excluded,
                smallNumeric: small.numeric.map((c: any) => c.name)
            };
        });
        expect(profile.numeric).toEqual(['点数']);
        expect(profile.groups).toEqual(['クラス', '点数']);
        expect(profile.excluded).toEqual(expect.arrayContaining([
            { name: '出席番号', reason: 'id' },
            { name: 'No', reason: 'id' },
            { name: '定数', reason: 'constant' }
        ]));
        expect(profile.smallNumeric).toEqual(['値']);
    });

    test('suggests paired vs independent from the data shape', async ({ page }) => {
        const hints = await page.evaluate(async () => {
            const { profileColumns, suggestDesign } = await import('/js/guided/column_profile.js');
            const wide = Array.from({ length: 10 }, (_, i) => ({ 事前テスト: 50 + i, 事後テスト: 55 + i }));
            const long = Array.from({ length: 10 }, (_, i) => ({ 性別: i % 2 ? '男' : '女', 点数: 50 + (i * 7) % 13 }));
            const p1 = profileColumns(wide, { numericColumns: ['事前テスト', '事後テスト'], categoricalColumns: [], textColumns: [] });
            const p2 = profileColumns(long, { numericColumns: ['点数'], categoricalColumns: ['性別'], textColumns: [] });
            return [suggestDesign(p1), suggestDesign(p2)];
        });
        expect(hints[0]).toMatchObject({ suggested: 'paired', pairedColumns: ['事前テスト', '事後テスト'] });
        expect(hints[1]).toMatchObject({ suggested: 'independent', groupColumns: ['性別'] });
    });

    test('warns when paired columns are on different scales', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { profileColumns, pairedScaleWarning } = await import('/js/guided/column_profile.js');
            const data = Array.from({ length: 20 }, (_, i) => ({ 事前: 60 + (i % 7), 事後: 63 + (i % 5), 学習時間: 2 + (i % 3) }));
            const profile = profileColumns(data, { numericColumns: ['事前', '事後', '学習時間'], categoricalColumns: [], textColumns: [] });
            return [pairedScaleWarning(profile, ['事前', '事後']), pairedScaleWarning(profile, ['事前', '学習時間'])];
        });
        expect(result).toEqual([false, true]);
    });

    test('group levels are sorted naturally and can count only rows with values', async ({ page }) => {
        const levels = await page.evaluate(async () => {
            const { groupLevels, groupWarnings } = await import('/js/guided/column_profile.js');
            const data = [
                { g: '10組', v: 1 }, { g: '2組', v: 2 }, { g: '1組', v: 3 }, { g: '2組', v: null }, { g: '1組', v: 4 }, { g: '10組', v: '' }
            ];
            const counted = groupLevels(data, 'g', 'v');
            return { all: groupLevels(data, 'g'), counted, warnings: groupWarnings(counted) };
        });
        expect(levels.all).toEqual([{ name: '1組', n: 2 }, { name: '2組', n: 2 }, { name: '10組', n: 2 }]);
        expect(levels.counted).toEqual([{ name: '1組', n: 2 }, { name: '2組', n: 1 }, { name: '10組', n: 1 }]);
        expect(levels.warnings.tooSmall.map((l: any) => l.name)).toEqual(['2組', '10組']);
    });
});
