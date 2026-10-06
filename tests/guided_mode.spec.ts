import { test, expect, Page } from '@playwright/test';

async function loadDemo(page: Page) {
    await page.click('#load-demo-btn');
    await page.waitForSelector('#demo-modal', { state: 'visible' });
    await page.click('.demo-option-btn[data-demo="demo_all_analysis.csv"]');
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });
}

async function pickColumn(page: Page, key: string, value: string) {
    await page.locator(`#guided-panel [data-guided-multi="${key}"][value="${value}"]`).check();
}

async function choose(page: Page, name: string, value: string) {
    await page.locator(`#guided-panel input[name="${name}"][value="${value}"]`).check();
}

test.describe('Beginner mode (guided analysis)', () => {
    // 初回訪問（保存されたモードなし）の状態で検証する
    test.use({ storageState: { cookies: [], origins: [] } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#load-demo-btn', { state: 'visible' });
    });

    test('is the default view and hides the full method list', async ({ page }) => {
        await expect(page.locator('#guided-panel')).toBeVisible();
        await expect(page.locator('.ui-mode-tab[data-ui-mode="beginner"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.feature-grid')).toBeHidden();
        await expect(page.locator('#guided-panel')).toContainText('平均値を比較する');
    });

    test('mode choice is remembered across reloads', async ({ page }) => {
        await page.click('.ui-mode-tab[data-ui-mode="all"]');
        await expect(page.locator('.feature-grid')).toBeVisible();
        await expect(page.locator('#guided-panel')).toBeHidden();
        await page.reload();
        await expect(page.locator('.feature-grid')).toBeVisible();
        await page.click('.ui-mode-tab[data-ui-mode="beginner"]');
        await expect(page.locator('#guided-panel')).toBeVisible();
    });

    test('asks the user to load data before analyzing', async ({ page }) => {
        await choose(page, 'guided-purpose', 'relation');
        await expect(page.locator('#guided-run-btn')).toBeDisabled();
        await expect(page.locator('#guided-panel')).toContainText('データを読み込んでください');
    });

    test('compares group means: runs the chosen test automatically and explains why', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'compare');
        await choose(page, 'guided-design', 'independent');
        await expect(page.locator('.guided-guide')).toContainText('マン・ホイットニーのU検定');
        await page.selectOption('#guided-groupVar', 'クラス');
        await pickColumn(page, 'valueVars', '数学');
        await page.click('#guided-run-btn');

        const decision = page.locator('.guided-decision');
        await expect(decision).toBeVisible();
        await expect(decision).toHaveAttribute('data-guided-method', /^(anova|kruskal)$/);
        await expect(decision).toContainText('正規性の検定');
        await expect(page.locator('#analysis-results')).not.toBeEmpty();
        await expect(page.locator('.guided-decision-warning')).toHaveCount(0);
    });

    test('two groups: can re-check with the alternative method', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'compare');
        await choose(page, 'guided-design', 'independent');
        await page.selectOption('#guided-groupVar', '性別');
        await pickColumn(page, 'valueVars', '英語');
        await page.click('#guided-run-btn');

        const decision = page.locator('.guided-decision');
        const first = await decision.getAttribute('data-guided-method');
        expect(['welch_t', 'mann_whitney']).toContain(first);
        await expect(page.locator('#results-section')).toBeVisible();

        await page.click('[data-guided-alternative]');
        await expect(page.locator('.guided-decision')).toHaveAttribute('data-guided-method', first === 'welch_t' ? 'mann_whitney' : 'welch_t');
        await expect(page.locator('.guided-decision h3')).toContainText('比較のため');
        await expect(page.locator('#results-section')).toBeVisible();
    });

    test('paired measurements, correlation, proportions and prediction all auto-run', async ({ page }) => {
        await loadDemo(page);

        const scenarios: Array<{ setup: () => Promise<void>; methods: string[] }> = [
            {
                setup: async () => {
                    await choose(page, 'guided-purpose', 'compare');
                    await choose(page, 'guided-design', 'paired');
                    await page.locator('[data-guided-paired="数学"]').check();
                    await page.locator('[data-guided-paired="英語"]').check();
                },
                methods: ['paired_t', 'wilcoxon']
            },
            {
                setup: async () => {
                    await choose(page, 'guided-purpose', 'relation');
                    await pickColumn(page, 'relationVars', '数学');
                    await pickColumn(page, 'relationVars', '学習時間');
                },
                methods: ['pearson', 'spearman']
            },
            {
                setup: async () => {
                    await choose(page, 'guided-purpose', 'proportion');
                    await page.selectOption('#guided-rowVar', '性別');
                    await page.selectOption('#guided-colVar', '満足度');
                },
                methods: ['chi_square', 'fisher']
            },
            {
                setup: async () => {
                    await choose(page, 'guided-purpose', 'predict');
                    await page.selectOption('#guided-y', '数学');
                    await pickColumn(page, 'predictors', '学習時間');
                },
                methods: ['regression']
            }
        ];

        for (const scenario of scenarios) {
            await page.evaluate(() => (window as any).backToHome());
            await scenario.setup();
            await page.click('#guided-run-btn');
            const decision = page.locator('.guided-decision');
            await expect(decision).toBeVisible();
            const method = await decision.getAttribute('data-guided-method');
            expect(scenario.methods).toContain(method);
            await expect(page.locator('.guided-decision-warning')).toHaveCount(0);
            await expect(page.locator('#analysis-results, #results-section').first()).not.toBeEmpty();
        }
    });

    test('disables the button and says what is missing', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'relation');
        // 足りない入力があるうちはボタンを押せず、次にすることを表示する
        await expect(page.locator('#guided-run-btn')).toBeDisabled();
        await expect(page.locator('#guided-run-status')).toContainText('数値の列をあと2つ選んでください');
        await expect(page.locator('#analysis-area')).toBeHidden();
    });

    test('switches to English', async ({ page }) => {
        await page.click('[data-locale="en"]');
        await expect(page.locator('#guided-panel')).toContainText('Compare averages');
        await expect(page.locator('.ui-mode-tab[data-ui-mode="beginner"]')).toContainText('Beginner mode');
    });

    test('AI context includes the research purpose, why the method was chosen, and the whole dataset', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'compare');
        await choose(page, 'guided-design', 'independent');
        await page.selectOption('#guided-groupVar', '性別');
        await pickColumn(page, 'valueVars', '英語');
        await page.click('#guided-run-btn');
        await expect(page.locator('.guided-decision')).toBeVisible();

        await page.click('#ai-assist-toggle');
        await page.fill('#ai-research-purpose', '男女で英語の得意さに違いがあるかを調べたい');
        await page.locator('.ai-context-settings > summary').click();
        await page.click('#ai-preview-context-btn');

        const previewText = await page.locator('#ai-context-preview-json').textContent();
        const context = JSON.parse(previewText!.slice(previewText!.indexOf('{'), previewText!.lastIndexOf('}') + 1));
        expect(context.researchPurpose).toBe('男女で英語の得意さに違いがあるかを調べたい');
        expect(context.analysis.rationale.selectionMode).toBe('beginner_mode_automatic');
        expect(context.analysis.rationale.assumptionChecks.some((check: any) => check.test === 'Shapiro-Wilk')).toBe(true);
        const columnNames = context.datasetOverview.columns.map((column: any) => column.name);
        expect(columnNames).toEqual(expect.arrayContaining(['数学', '学習時間', 'クラス']));
        expect(context.datasetOverview.columns.find((column: any) => column.name === '数学').usedInThisAnalysis).toBe(false);
        await expect(page.locator('#ai-context-summary')).toContainText('研究の目的: あり');

        // 目的は分析を切り替えても残る
        await page.evaluate(() => (window as any).backToHome());
        await choose(page, 'guided-purpose', 'overview');
        await page.click('#guided-run-btn');
        await expect(page.locator('#analysis-area')).toBeVisible();
        await expect(page.locator('#ai-research-purpose')).toHaveValue('男女で英語の得意さに違いがあるかを調べたい');
    });

    test('decision panel follows the language switch', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'relation');
        await pickColumn(page, 'relationVars', '数学');
        await pickColumn(page, 'relationVars', '英語');
        await page.click('#guided-run-btn');
        await expect(page.locator('.guided-decision h3')).toContainText('この分析では');
        await page.click('[data-locale="en"]');
        await expect(page.locator('.guided-decision h3')).toContainText('This analysis used');
    });

    test('guides the student before running: excluded ID column, readiness message, scale warning, design hint', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'relation');
        await expect(page.locator('#guided-run-btn')).toBeDisabled();
        await expect(page.locator('#guided-run-status')).toContainText('数値の列をあと2つ選んでください');
        await expect(page.locator('[data-guided-multi="relationVars"][value="ID"]')).toHaveCount(0);
        await expect(page.locator('.guided-excluded-note')).toContainText('ID');
        await pickColumn(page, 'relationVars', '数学');
        await expect(page.locator('#guided-run-status')).toContainText('あと1つ');
        await pickColumn(page, 'relationVars', '英語');
        await expect(page.locator('#guided-run-btn')).toBeEnabled();

        await choose(page, 'guided-purpose', 'compare');
        await expect(page.locator('.guided-design-hint')).toContainText('性別');
        await choose(page, 'guided-design', 'paired');
        await page.locator('[data-guided-paired="数学"]').check();
        await page.locator('[data-guided-paired="学習時間"]').check();
        await expect(page.locator('.guided-inline-warning')).toContainText('値の大きさがかなり違います');
        await expect(page.locator('#guided-run-btn')).toBeEnabled();
    });

    test('column names with quotes and angle brackets work end to end', async ({ page }) => {
        const csv = 'グループ<b>,値 "1",値\'2\'\n' + Array.from({ length: 20 }, (_, i) =>
            `${i % 2 ? 'A' : 'B'},${50 + (i * 7) % 11},${52 + (i * 5) % 13}`).join('\n');
        await page.setInputFiles('#main-data-file', { name: 'quotes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await page.waitForSelector('#dataframe-container', { state: 'visible' });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await choose(page, 'guided-purpose', 'compare');
        await choose(page, 'guided-design', 'paired');
        await page.locator('[data-guided-paired="値 \\"1\\""]').check();
        await page.locator(`[data-guided-paired="値'2'"]`).check();
        await page.click('#guided-run-btn');
        await expect(page.locator('.guided-decision')).toBeVisible();
        await expect(page.locator('.guided-decision-warning')).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('several numeric columns: columns are split by the method that fits, and the others can be analyzed next', async ({ page }) => {
        // 数学・英語は正規分布に近く（正規分布の分位点から作成）、スマホ時間は右に大きくかたよる
        const math = [[70, 65, 75, 60, 54, 66, 69, 63, 58, 49, 52, 64, 72, 44, 67, 61, 55, 59, 57, 80],
            [56, 84, 69, 63, 62, 76, 58, 70, 68, 61, 59, 64, 48, 65, 79, 71, 67, 53, 73, 74]];
        const english = [[62, 74, 49, 65, 42, 61, 56, 59, 46, 64, 54, 52, 60, 51, 63, 67, 57, 55, 70, 53],
            [45, 67, 68, 56, 60, 73, 52, 66, 65, 57, 55, 58, 54, 77, 70, 59, 64, 63, 62, 49]];
        const rows = Array.from({ length: 40 }, (_, i) => {
            const g = i % 2;
            const k = Math.floor(i / 2);
            const phone = i % 7 === 0 ? 300 + i : 20 + (i % 5) * 3;
            return `${i + 1},${g ? '男子' : '女子'},${math[g][k]},${english[g][k]},${phone}`;
        });
        const csv = ['番号,性別,数学,英語,スマホ時間', ...rows].join('\n');
        await page.setInputFiles('#main-data-file', { name: 'multi.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await page.waitForSelector('#dataframe-container', { state: 'visible' });
        await choose(page, 'guided-purpose', 'compare');
        await choose(page, 'guided-design', 'independent');
        await page.selectOption('#guided-groupVar', '性別');
        for (const column of ['数学', '英語', 'スマホ時間']) await pickColumn(page, 'valueVars', column);
        await page.click('#guided-run-btn');

        const decision = page.locator('.guided-decision');
        await expect(decision).toHaveAttribute('data-guided-method', 'welch_t');
        await expect(page.locator('.guided-other-groups')).toContainText('スマホ時間');
        await expect(page.locator('#dep-var-multiselect-hidden option:checked')).toHaveText(['数学', '英語']);

        await page.click('[data-guided-other="0"]');
        await expect(page.locator('.guided-decision')).toHaveAttribute('data-guided-method', 'mann_whitney');
        await expect(page.locator('.guided-other-groups')).toContainText('数学');
        await expect(page.locator('#results-section')).toBeVisible();
    });

    test('three or more columns give a correlation matrix, and two or more predictors give multiple regression', async ({ page }) => {
        await loadDemo(page);
        await choose(page, 'guided-purpose', 'relation');
        for (const column of ['数学', '英語', '理科']) await pickColumn(page, 'relationVars', column);
        await page.click('#guided-run-btn');
        await expect(page.locator('.guided-decision')).toHaveAttribute('data-guided-method', /^(pearson|spearman)$/);
        await expect(page.locator('#correlation-vars option:checked')).toHaveCount(3);

        await page.evaluate(() => (window as any).backToHome());
        await choose(page, 'guided-purpose', 'predict');
        await page.selectOption('#guided-y', '数学');
        await pickColumn(page, 'predictors', '学習時間');
        await pickColumn(page, 'predictors', '英語');
        await page.click('#guided-run-btn');
        await expect(page.locator('.guided-decision')).toHaveAttribute('data-guided-method', 'regression_multiple');
        await expect(page.locator('.guided-decision-warning')).toHaveCount(0);
        await expect(page.locator('#analysis-results')).not.toBeEmpty();
    });
});
