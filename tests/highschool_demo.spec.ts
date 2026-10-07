import { test, expect, Page } from '@playwright/test';

// 推奨デモ「高校生の生活と学習」で、初学者モードの目的がすべて試せることを確かめる
// （データの性質は tools/demo_data/generate_highschool_demo.py で決めている）

async function loadHighschoolDemo(page: Page) {
    await page.click('#load-demo-btn');
    await page.waitForSelector('#demo-modal', { state: 'visible' });
    await page.click('.demo-option-btn[data-demo="highschool_life_demo.csv"]');
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });
}

async function pickColumn(page: Page, key: string, value: string) {
    await page.locator(`#guided-panel [data-guided-multi="${key}"][value="${value}"]`).check();
}

async function choose(page: Page, name: string, value: string) {
    await page.locator(`#guided-panel input[name="${name}"][value="${value}"]`).check();
}

test.describe('Recommended demo: high school life and learning', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#load-demo-btn', { state: 'visible' });
    });

    test('is listed first as the recommended demo', async ({ page }) => {
        await page.click('#load-demo-btn');
        const first = page.locator('.demo-option-btn').first();
        await expect(first).toHaveAttribute('data-demo', 'highschool_life_demo.csv');
        await expect(first).toHaveClass(/primary/);
        await expect(first).toContainText('高校生の生活と学習');
    });

    test('every beginner-mode purpose runs with a suitable method', async ({ page }) => {
        await loadHighschoolDemo(page);
        await expect(page.locator('#guided-panel')).toBeVisible();

        const scenarios: Array<{ label: string; setup: () => Promise<void>; methods: string[] }> = [
            {
                label: 'クラスで数学の平均を比べる',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'compare');
                    await choose(page, 'guided-design', 'independent');
                    await page.selectOption('#guided-groupVar', 'クラス');
                    await pickColumn(page, 'valueVars', '数学');
                },
                methods: ['anova']
            },
            {
                label: '通学時間（右にすそが長い）を男女で比べる',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'compare');
                    await choose(page, 'guided-design', 'independent');
                    await page.selectOption('#guided-groupVar', '性別');
                    // 前のシナリオで選んだ「数学」が残るので外す
                    await page.locator('#guided-panel [data-guided-multi="valueVars"][value="数学"]').uncheck();
                    await pickColumn(page, 'valueVars', '通学時間');
                },
                methods: ['mann_whitney']
            },
            {
                label: '同じ生徒の小テストを授業の前後で比べる',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'compare');
                    await choose(page, 'guided-design', 'paired');
                    await page.locator('[data-guided-paired="小テスト_事前"]').check();
                    await page.locator('[data-guided-paired="小テスト_事後"]').check();
                },
                methods: ['paired_t']
            },
            {
                label: 'スマホ時間と睡眠時間の関係',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'relation');
                    await pickColumn(page, 'relationVars', 'スマホ時間');
                    await pickColumn(page, 'relationVars', '睡眠時間');
                },
                methods: ['pearson']
            },
            {
                label: '性別と部活動の人数の偏り',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'proportion');
                    await page.selectOption('#guided-rowVar', '性別');
                    await page.selectOption('#guided-colVar', '部活動');
                },
                methods: ['chi_square']
            },
            {
                label: '家庭学習時間から数学の点数を予測する',
                setup: async () => {
                    await choose(page, 'guided-purpose', 'predict');
                    await page.selectOption('#guided-y', '数学');
                    await pickColumn(page, 'predictors', '家庭学習時間');
                },
                methods: ['regression']
            }
        ];

        for (const scenario of scenarios) {
            await page.evaluate(() => (window as any).backToHome());
            await scenario.setup();
            await page.click('#guided-run-btn');
            const decision = page.locator('.guided-decision');
            await expect(decision, scenario.label).toBeVisible();
            expect(scenario.methods, scenario.label).toContain(await decision.getAttribute('data-guided-method'));
            await expect(page.locator('.guided-decision-warning'), scenario.label).toHaveCount(0);
            await expect(page.locator('#analysis-results, #results-section').first(), scenario.label).not.toBeEmpty();
        }
    });

    test('ID column is excluded automatically', async ({ page }) => {
        await loadHighschoolDemo(page);
        await choose(page, 'guided-purpose', 'relation');
        await expect(page.locator('#guided-panel [data-guided-multi="relationVars"][value="ID"]')).toHaveCount(0);
    });
});
