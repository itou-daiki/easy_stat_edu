import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { selectStandardOption, selectVariables } from './utils/test-helpers';

async function collectVisibleJapaneseUi(
    page,
    rootSelector: string,
    excludedSelectors: string[] = [],
    allowedDataText = /$^/gu
) {
    return page.locator(rootSelector).evaluate((root, options) => {
        const excluded = options.excludedSelectors.join(',');
        const allowed = new RegExp(options.allowedDataSource, 'gu');
        const isVisibleUi = element => {
            if (!element || (excluded && element.closest(excluded))) return false;
            const collapsedContent = element.closest('.collapsible-content.collapsed, [hidden]');
            if (collapsedContent) return false;
            const closedDetails = element.closest('details:not([open])');
            if (closedDetails && !element.closest('summary')) return false;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const values = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            if (isVisibleUi(node.parentElement) && !node.parentElement?.matches('tspan.line')) {
                values.push(node.nodeValue || '');
            }
            node = walker.nextNode();
        }
        [root, ...root.querySelectorAll('*')].forEach(element => {
            if (!isVisibleUi(element) || element.matches('canvas')) return;
            for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
                if (element.hasAttribute?.(name)) values.push(element.getAttribute(name) || '');
            }
        });
        return [...new Set(values
            .map(value => value.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .filter(value => /[ぁ-んァ-ン一-龯]/u.test(value.replace(allowed, ''))))];
    }, {
        excludedSelectors,
        allowedDataSource: allowedDataText.source
    });
}

test.describe('JP / English 表示モード', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
    });

    test('英語モードを保存し、ホーム画面とマニュアルへ反映する', async ({ page }) => {
        const switcher = page.locator('[data-language-switcher]');
        await expect(switcher).toBeVisible();
        await expect(switcher).toHaveAttribute('role', 'radiogroup');
        await expect(switcher).toHaveAttribute('aria-label', '表示言語');
        await expect(switcher.locator('[data-locale="ja"]')).toHaveText('JP');
        await expect(switcher.locator('[data-locale="ja"]')).toHaveAttribute('aria-label', '日本語');
        await expect(switcher.locator('[data-locale="ja"]')).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

        await switcher.locator('[data-locale="en"]').click();

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(switcher).toHaveAttribute('aria-label', 'Display language');
        await expect(switcher.locator('[data-locale="en"]')).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('.hero-subtitle')).toContainText('Fast, browser-based statistical analysis');
        await expect(page.locator('a[href^="manual.html"]')).toContainText('User Guide');
        await expect(page.locator('#data-source-file-tab')).toContainText('File');
        await expect(page.locator('#data-source-paste-tab')).toContainText('Paste table');
        await expect(page.locator('.feature-card[data-analysis="ttest"]')).toContainText('t Tests');
        await expect.poll(() => page.evaluate(() => localStorage.getItem('easyStat.locale'))).toBe('en');

        await page.reload();
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('.hero-subtitle')).toContainText('Fast, browser-based statistical analysis');

        const manualPage = await page.context().newPage();
        await manualPage.goto('/manual.html');
        await expect(manualPage.locator('html')).toHaveAttribute('lang', 'en');
        await expect(manualPage.locator('h1')).toContainText('User Guide');
        await expect(manualPage.locator('[data-language-switcher]')).toBeVisible();
        await expect(manualPage.locator('[data-language-switcher] [data-locale="ja"]')).toHaveText('JP');
    });

    test('言語切替を一つのTab位置と上下左右キーで操作できる', async ({ page }) => {
        const switcher = page.locator('[data-language-switcher]');
        const japanese = switcher.locator('[data-locale="ja"]');
        const english = switcher.locator('[data-locale="en"]');

        await japanese.focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(english).toBeFocused();
        await expect(english).toHaveAttribute('tabindex', '0');
        await expect(japanese).toHaveAttribute('tabindex', '-1');

        await page.keyboard.press('ArrowDown');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
        await expect(japanese).toBeFocused();

        await page.keyboard.press('ArrowLeft');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(english).toBeFocused();

        await page.keyboard.press('ArrowUp');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
        await expect(japanese).toBeFocused();
    });

    test('分析設定・結果・図表を英語化し、利用者の列名を保持して日本語へ戻せる', async ({ page }) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );

        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await expect(page.locator('#analysis-content')).toContainText('Independent-samples t test');
        await expect(page.locator('#analysis-content')).toContainText('Select a grouping variable');

        await selectStandardOption(page, '#group-var', '性別', 'label');
        await selectVariables(page, ['数学']);
        await page.locator('#run-independent-btn').click();

        await expect(page.locator('#test-results-section')).toContainText('Independent-samples t test');
        await expect(page.locator('#test-results-section')).toContainText('Mean');
        await expect(page.locator('#test-results-section')).not.toContainText('Mathematics');
        await expect(page.locator('#test-results-section')).toContainText('数学');
        await expect(page.locator('#interpretation-content')).toContainText('was not statistically clear in this sample');

        const explanation = page.locator('[data-result-beginner-explanation="ttest"]');
        await expect(explanation.locator('summary')).toContainText('In plain language');
        await explanation.locator('summary').click();
        await expect(explanation).toContainText('What each statistic means');

        const plot = page.locator('#visualization-section .js-plotly-plot').first();
        await expect(plot).toBeVisible();
        await expect(plot.locator('.gtitle')).toContainText('Mean comparison');

        await page.locator('[data-language-switcher] [data-locale="ja"]').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
        await expect(page.locator('#test-results-section')).toContainText('平均値の差の検定');
        await expect(page.locator('#interpretation-content')).toContainText('今回のデータでは統計上はっきりしませんでした');
        await expect(plot.locator('.gtitle')).toContainText('平均値の比較');
    });

    test('UI用語と同じ列名・カテゴリ名も入力どおりに保持する', async ({ page }) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles({
            name: 'user-terms.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from([
                '平均,合計,区分',
                '10,1,全体',
                '12,2,全体',
                '14,3,全体',
                '20,4,その他',
                '22,5,その他',
                '24,6,その他'
            ].join('\n'))
        });

        await expect(page.locator('#dataframe-container th[data-column="平均"]')).toHaveText('平均');
        await expect(page.locator('#dataframe-container')).toContainText('全体');
        await expect(page.locator('#dataframe-container')).toContainText('その他');

        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await expect(page.locator('#analysis-content > .loading')).toHaveCount(0, { timeout: 15_000 });
        await selectStandardOption(page, '#group-var', '区分', 'label');
        await selectVariables(page, ['平均']);
        await page.locator('#run-independent-btn').click();
        await expect(page.locator('#test-results-section')).toBeVisible();
        await expect(page.locator('#test-results-section')).toContainText('平均');
        await expect(page.locator('#test-results-section')).toContainText('全体');
        await expect(page.locator('#test-results-section')).toContainText('その他');

        const plottedLabels = await page.locator('#visualization-section .js-plotly-plot').first().evaluate(plot => (
            ((plot as any).data || []).flatMap(trace => [
                trace.name,
                ...(Array.isArray(trace.x) ? trace.x : []),
                ...(Array.isArray(trace.y) ? trace.y : [])
            ]).filter(value => typeof value === 'string')
        ));
        expect(plottedLabels).toEqual(expect.arrayContaining(['全体', 'その他']));
    });

    test('狭い画面でも言語切替が操作でき、ヘッダーからはみ出さない', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const switcher = page.locator('[data-language-switcher]');
        await expect(switcher).toBeVisible();

        await switcher.locator('[data-locale="en"]').click();
        const bounds = await switcher.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                viewport: document.documentElement.clientWidth
            };
        });

        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
    });

    test('ホーム画面とマニュアル本文に日本語UIが残らない', async ({ page }, testInfo) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        const homeBeforeUpload = await collectVisibleJapaneseUi(page, '#main-app', [
            '[data-language-switcher]',
            '#demo-options'
        ]);

        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        const homeAfterUpload = await collectVisibleJapaneseUi(page, '#main-app', [
            '[data-language-switcher]',
            '#demo-options',
            '#dataframe-container',
            '.multiselect-dropdown'
        ], /数学|英語|理科|学習時間|性別|クラス|満足度|感想|男性|女性|高|中|低|タブレット|オンライン|授業|ICT/gu);

        const manualPage = await page.context().newPage();
        await manualPage.goto('/manual.html');
        await expect(manualPage.locator('html')).toHaveAttribute('lang', 'en');
        const manual = await collectVisibleJapaneseUi(manualPage, 'body', [
            '[data-language-switcher]'
        ]);

        const diagnostics = { homeBeforeUpload, homeAfterUpload, manual };
        await testInfo.attach('untranslated-pages.json', {
            body: JSON.stringify(diagnostics, null, 2),
            contentType: 'application/json'
        });
        expect(diagnostics).toEqual({ homeBeforeUpload: [], homeAfterUpload: [], manual: [] });
    });

    test('デモ選択と折りたたみ説明を開いても英語表示が一貫する', async ({ page }, testInfo) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();

        await page.locator('#load-demo-btn').click();
        await expect(page.locator('#demo-modal')).toBeVisible();
        await expect(page.locator('#demo-modal')).toContainText('Choose a dataset that matches your analysis goal');
        const demoModal = await collectVisibleJapaneseUi(page, '#demo-modal');
        await page.locator('#close-demo-modal').click();

        for (const key of ['about', 'usage', 'releaseNotes']) {
            const content = page.locator(`[data-home-content="${key}"]`);
            await content.locator('xpath=preceding-sibling::*[contains(@class,"collapsible-header")]').click();
            await expect(content).toBeVisible();
        }
        const homeDetails = await collectVisibleJapaneseUi(page, '#main-app > .info-sections');

        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await page.locator('.feature-card[data-analysis="ttest"]').click();
        await expect(page.locator('#analysis-content > .loading')).toHaveCount(0, { timeout: 15_000 });
        await page.locator('#analysis-content .collapsible-section.info-sections > .collapsible-header').evaluateAll(headers => {
            headers.forEach(header => {
                if (header.classList.contains('collapsed')) (header as HTMLElement).click();
            });
        });
        const analysisDetails = await collectVisibleJapaneseUi(page, '#analysis-content', [
            '#dataframe-container',
            '.multiselect-dropdown'
        ], /数学|英語|理科|学習時間|性別|クラス|満足度|感想/gu);
        await expect(page.locator('#analysis-header .btn-back')).toContainText('Back to analyses');
        await expect(page.locator('#ai-assist-toggle')).toHaveAttribute('aria-label', 'Open the AI interpretation assistant');

        await page.locator('[data-language-switcher] [data-locale="ja"]').click();
        await expect(page.locator('#analysis-content .collapsible-content').first()).toContainText('平均の違い');

        const diagnostics = { demoModal, homeDetails, analysisDetails };
        await testInfo.attach('interactive-language-audit.json', {
            body: JSON.stringify(diagnostics, null, 2),
            contentType: 'application/json'
        });
        expect(diagnostics).toEqual({ demoModal: [], homeDetails: [], analysisDetails: [] });
    });

    test('AI支援の画面・コピープロンプト・Gemini指示を英語化する', async ({ page }, testInfo) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#ai-config-toggle').click();
        await expect(page.locator('#ai-config-content')).toBeVisible();

        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await expect(page.locator('#data-preview-section')).toBeVisible({ timeout: 15000 });
        await page.locator('.feature-card[data-analysis="correlation"]').click();
        await expect(page.locator('#run-correlation-btn')).toBeVisible({ timeout: 15000 });
        await selectVariables(page, ['数学', '英語']);
        await page.locator('#run-correlation-btn').click();
        await expect(page.locator('#analysis-results')).toBeVisible();

        await page.locator('#ai-assist-toggle').click();
        await expect(page.locator('.ai-assist-panel')).toBeVisible();
        await page.locator('.ai-context-settings summary').click();
        await page.evaluate(() => {
            (window as any).__copiedText = '';
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: { writeText: async text => { (window as any).__copiedText = text; } }
            });
        });
        await page.locator('#ai-copy-context-btn').click();

        const japaneseUi = [
            ...await collectVisibleJapaneseUi(page, '#ai-config-section'),
            ...await collectVisibleJapaneseUi(page, '#ai-assist-widget')
        ];
        const values = await page.evaluate(async () => {
            const module = await import('/js/ai_support.js?english-language-test');
            return {
                copied: (window as any).__copiedText,
                instruction: module.createGeminiRequestBody('test', 500, {
                    structured: true,
                    language: 'en'
                }).system_instruction.parts[0].text
            };
        });

        await testInfo.attach('ai-language-audit.json', {
            body: JSON.stringify({ japaneseUi, ...values }, null, 2),
            contentType: 'application/json'
        });
        expect(japaneseUi).toEqual([]);
        expect(values.copied).toContain('Required output');
        expect(values.copied).toContain('Preserve user-provided variable and category names');
        expect(values.copied).not.toContain('結果から言えること');
        expect(values.copied.replaceAll('数学', '').replaceAll('英語', ''))
            .not.toMatch(/[ぁ-んァ-ン一-龯]/u);
        expect(values.instruction).toContain('clear English');
        expect(values.instruction).not.toContain('日本語で');
    });

    test('全分析の初期画面で主要な操作文が英語になる', async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );

        const analysisTypes = await page.locator('.feature-card[data-analysis]').evaluateAll(cards => (
            cards.map(card => (card as HTMLElement).dataset.analysis).filter(Boolean)
        ));
        const untranslated: Record<string, string[]> = {};

        for (const analysisType of analysisTypes) {
            const card = page.locator(`.feature-card[data-analysis="${analysisType}"]`);
            if (await card.evaluate(element => element.classList.contains('disabled'))) continue;
            await card.click();
            await expect(page.locator('#analysis-area')).toBeVisible();
            await expect(page.locator('#analysis-content > .loading')).toHaveCount(0, { timeout: 15_000 });

            const japaneseUi = await page.locator('#analysis-content').evaluate(container => {
                const allowedData = /数学|英語|理科|学習時間|性別|クラス|満足度|感想|男性|女性|高|中|低|A組|B組|C組|タブレット|オンライン|授業|ICT/gu;
                const values = [];
                const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
                let node = walker.nextNode();
                while (node) {
                    if (!node.parentElement?.closest('script, style, tbody, option, .multiselect-option')
                        && !node.parentElement?.matches('tspan.line')) {
                        values.push(node.nodeValue || '');
                    }
                    node = walker.nextNode();
                }
                [container, ...container.querySelectorAll('*')].forEach(element => {
                    if (element.closest('tbody, option, .multiselect-option') || element.matches('canvas')) return;
                    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
                        if (element.hasAttribute?.(name)) values.push(element.getAttribute(name) || '');
                    }
                });
                return [...new Set(values
                    .map(value => value.replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .filter(value => /[ぁ-んァ-ン一-龯]/u.test(value.replace(allowedData, ''))))];
            });
            if (japaneseUi.length > 0) untranslated[analysisType] = japaneseUi;

            await page.evaluate(() => window.backToHome());
        }

        await testInfo.attach('untranslated-ui.json', {
            body: JSON.stringify(untranslated, null, 2),
            contentType: 'application/json'
        });
        expect(untranslated).toEqual({});
    });

    test('代表的な分析を実行した後も、結果・説明・図表設定が英語になる', async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );

        const scenarios = [
            {
                type: 'correlation',
                run: async () => {
                    await selectVariables(page, ['数学', '英語', '理科']);
                    await page.locator('#run-correlation-btn').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'chi_square',
                run: async () => {
                    await selectStandardOption(page, '#row-var', '性別', 'label');
                    await selectStandardOption(page, '#col-var', 'クラス', 'label');
                    await page.locator('#run-chi-btn').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'cross_tabulation',
                run: async () => {
                    await selectStandardOption(page, '#crosstab-row-var', '性別', 'label');
                    await selectStandardOption(page, '#crosstab-col-var', 'クラス', 'label');
                    await page.locator('#run-crosstab-btn').click();
                    await expect(page.locator('#crosstab-analysis-results')).toBeVisible();
                }
            },
            {
                type: 'ttest',
                run: async () => {
                    await selectStandardOption(page, '#group-var', '性別', 'label');
                    await selectVariables(page, ['数学']);
                    await page.locator('#run-independent-btn').click();
                    await expect(page.locator('#results-section')).toBeVisible();
                }
            },
            {
                type: 'anova_one_way',
                run: async () => {
                    await selectStandardOption(page, '#factor-var', 'クラス', 'label');
                    await selectVariables(page, ['数学']);
                    await page.locator('#run-ind-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'anova_two_way',
                run: async () => {
                    await selectStandardOption(page, '#factor1-var', 'クラス', 'label');
                    await selectStandardOption(page, '#factor2-var', '性別', 'label');
                    await selectVariables(page, ['数学']);
                    await page.locator('#run-ind-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'mann_whitney',
                run: async () => {
                    await selectStandardOption(page, '#group-var', '性別', 'value');
                    await selectVariables(page, ['数学']);
                    await page.locator('#run-u-test-btn').click();
                    await expect(page.locator('#results-section')).toBeVisible();
                }
            },
            {
                type: 'kruskal_wallis',
                run: async () => {
                    await selectStandardOption(page, '#group-var', 'クラス', 'label');
                    await selectVariables(page, ['数学']);
                    await page.locator('#run-kw-test-btn').click();
                    await expect(page.locator('#results-section')).toBeVisible();
                }
            },
            {
                type: 'wilcoxon_signed_rank',
                run: async () => {
                    await selectVariables(page, ['数学', '英語']);
                    await page.locator('#run-wilcoxon-test-btn').click();
                    await expect(page.locator('#results-section')).toBeVisible();
                }
            },
            {
                type: 'fisher_exact',
                run: async () => {
                    await selectStandardOption(page, '#row-var', '性別', 'label');
                    await selectStandardOption(page, '#col-var', 'クラス', 'label');
                    await page.locator('#run-fisher-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'regression_simple',
                run: async () => {
                    await selectStandardOption(page, '#independent-var', '数学', 'label');
                    await selectStandardOption(page, '#dependent-var', '理科', 'label');
                    await page.locator('#run-regression-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'regression_multiple',
                run: async () => {
                    await selectStandardOption(page, '#dependent-vars', '理科', 'label');
                    await selectStandardOption(page, '#independent-vars', '数学', 'label');
                    await selectStandardOption(page, '#independent-vars', '英語', 'label');
                    await page.locator('#run-regression-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'logistic_regression',
                run: async () => {
                    await selectStandardOption(page, '#logistic-dep-var', '性別', 'label');
                    await selectVariables(page, ['数学', '英語']);
                    await page.locator('#run-logistic-btn').click();
                    await expect(page.locator('#logistic-analysis-results')).toBeVisible({ timeout: 30_000 });
                }
            },
            {
                type: 'factor_analysis',
                run: async () => {
                    await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
                    await page.locator('#run-factor-btn-container button').click();
                    await expect(page.locator('#fa-analysis-results')).toBeVisible();
                }
            },
            {
                type: 'pca',
                run: async () => {
                    await selectVariables(page, ['数学', '英語', '理科', '学習時間']);
                    await page.locator('#run-pca-btn').click();
                    await expect(page.locator('#analysis-results')).toBeVisible();
                }
            },
            {
                type: 'time_series',
                run: async () => {
                    await selectStandardOption(page, '#time-var', 'ID', 'label');
                    await selectStandardOption(page, '#value-var', '数学', 'label');
                    await page.locator('#run-btn-container button').click();
                    await expect(page.locator('#ts-results-section')).toBeVisible();
                }
            },
            {
                type: 'text_mining',
                run: async () => {
                    await page.locator('#text-var').selectOption({ label: '感想' });
                    await page.locator('#category-var').selectOption({ label: 'クラス' });
                    await page.locator('#run-text-btn-container button').click();
                    await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60_000 });
                }
            }
        ];

        const untranslated: Record<string, string[]> = {};
        for (const scenario of scenarios) {
            await page.locator(`.feature-card[data-analysis="${scenario.type}"]`).click();
            await expect(page.locator('#analysis-content > .loading')).toHaveCount(0, { timeout: 15_000 });
            await scenario.run();

            const resultExplanation = page.locator(
                `[data-result-beginner-explanation="${scenario.type}"]`
            );
            await expect(resultExplanation).toBeVisible({ timeout: 15_000 });
            await resultExplanation.locator('summary').click();
            await page.waitForTimeout(150);

            const excludedSelectors = ['.tm-term-table tbody', '#kwic-panel', '.multiselect-dropdown'];
            if (scenario.type === 'text_mining') {
                excludedSelectors.push('.tm-pos-grid', '.tm-community-list', '.result-beginner-summary-list');
            }
            const japaneseUi = await collectVisibleJapaneseUi(
                page,
                '#analysis-content',
                excludedSelectors,
                /数学|英語|理科|学習時間|性別|クラス|満足度|感想|男性|女性|高|中|低|A組|B組|C組|タブレット|オンライン|授業|ICT/gu
            );
            const japanesePlotLabels = await page.locator('#analysis-content .js-plotly-plot').evaluateAll(plots => {
                const allowedDataText = /数学|英語|理科|学習時間|性別|クラス|満足度|感想|男性|女性|高|中|低|A組|B組|C組|タブレット|オンライン|授業|ICT/gu;
                const text = value => typeof value === 'string' ? value : value?.text || '';
                const labels = plots.flatMap(plot => {
                    const layout = (plot as any).layout || {};
                    return [
                        text(layout.title),
                        text(layout.xaxis?.title),
                        text(layout.yaxis?.title),
                        text(layout.legend?.title),
                        ...(layout.annotations || []).map(annotation => text(annotation.text)),
                        ...((plot as any).data || []).map(trace => text(trace.name))
                    ];
                });
                return [...new Set(labels
                    .map(value => String(value).replace(/<[^>]+>/g, '').trim())
                    .filter(Boolean)
                    .filter(value => /[ぁ-んァ-ン一-龯]/u.test(value.replace(allowedDataText, ''))))];
            });
            japaneseUi.push(...japanesePlotLabels.map(label => `[plot] ${label}`));
            if (japaneseUi.length > 0) untranslated[scenario.type] = japaneseUi;

            await page.evaluate(() => window.backToHome());
        }

        await testInfo.attach('untranslated-result-ui.json', {
            body: JSON.stringify(untranslated, null, 2),
            contentType: 'application/json'
        });
        expect(untranslated).toEqual({});
    });

    test('McNemar検定の結果と解釈も英語になる', async ({ page }, testInfo) => {
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/mcnemar_test.csv')
        );
        await page.locator('.feature-card[data-analysis="mcnemar"]').click();
        await expect(page.locator('#analysis-content > .loading')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.locator('#mcnemar-var1')).toBeVisible();
        await selectStandardOption(page, '#mcnemar-var1', '授業前理解', 'label');
        await selectStandardOption(page, '#mcnemar-var2', '授業後理解', 'label');
        await page.locator('#run-mcnemar-btn').click();
        await expect(page.locator('#mcnemar-analysis-results')).toBeVisible();

        const explanation = page.locator('[data-result-beginner-explanation="mcnemar"]');
        await expect(explanation).toBeVisible();
        await explanation.locator('summary').click();
        const japaneseUi = await collectVisibleJapaneseUi(page, '#analysis-content', [
            '.multiselect-dropdown'
        ], /授業前理解|授業後理解|未理解|理解/gu);
        await testInfo.attach('mcnemar-language-audit.json', {
            body: JSON.stringify(japaneseUi, null, 2),
            contentType: 'application/json'
        });
        expect(japaneseUi).toEqual([]);
    });

    test('保存するテキストマイニング画像の凡例も表示言語に合う', async ({ page }, testInfo) => {
        test.setTimeout(90_000);
        await page.locator('[data-language-switcher] [data-locale="en"]').click();
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await page.locator('.feature-card[data-analysis="text_mining"]').click();
        await page.locator('#text-var').selectOption({ label: '感想' });
        await page.locator('#category-var').selectOption({ label: 'クラス' });
        await page.locator('#run-text-btn-container button').click();
        await expect(page.locator('#analysis-results')).toBeVisible({ timeout: 60_000 });
        await expect(page.locator('.download-btn[data-target="overall-wordcloud"]')).toBeEnabled();

        await page.evaluate(() => {
            const proto = CanvasRenderingContext2D.prototype as any;
            (window as any).__canvasLabels = [];
            (window as any).__canvasTextCalls = [];
            const original = proto.fillText;
            proto.fillText = function (value, ...args) {
                (window as any).__canvasLabels.push(String(value));
                (window as any).__canvasTextCalls.push({
                    value: String(value),
                    x: Number(args[0]),
                    y: Number(args[1]),
                    font: String(this.font)
                });
                return original.call(this, value, ...args);
            };
        });

        const assertPng = async (download, name: string) => {
            const target = testInfo.outputPath(name);
            await download.saveAs(target);
            const bytes = fs.readFileSync(target);
            expect(bytes.subarray(1, 4).toString()).toBe('PNG');
            expect(bytes.readUInt32BE(16)).toBeGreaterThan(300);
            expect(bytes.readUInt32BE(20)).toBeGreaterThan(250);
            expect(bytes.length).toBeGreaterThan(10_000);
            return target;
        };

        const getWordCloudMetrics = () => page.locator('#overall-wordcloud').evaluate(async canvas => {
            if ((canvas as any).__easyStatRenderPromise) {
                await (canvas as any).__easyStatRenderPromise;
            }
            const rect = canvas.getBoundingClientRect();
            const context = (canvas as HTMLCanvasElement).getContext('2d');
            const pixels = context?.getImageData(
                0,
                0,
                (canvas as HTMLCanvasElement).width,
                (canvas as HTMLCanvasElement).height
            ).data || [];
            let inkSamples = 0;
            for (let index = 0; index < pixels.length; index += 64) {
                if (pixels[index] < 235 || pixels[index + 1] < 235 || pixels[index + 2] < 235) {
                    inkSamples += 1;
                }
            }
            return {
                width: (canvas as HTMLCanvasElement).width,
                height: (canvas as HTMLCanvasElement).height,
                rectWidth: rect.width,
                rectHeight: rect.height,
                styleWidth: (canvas as HTMLElement).style.width,
                styleHeight: (canvas as HTMLElement).style.height,
                aspectRatio: (canvas as HTMLElement).dataset.visualAspectRatio,
                visualHeight: (canvas as HTMLElement).dataset.visualHeight,
                inkSamples,
                viewport: document.documentElement.clientWidth,
                ancestors: Array.from(canvas.parentElement?.parentElement?.children || []).map(element => ({
                    className: (element as HTMLElement).className,
                    width: element.getBoundingClientRect().width,
                    display: getComputedStyle(element).display,
                    gridTemplateColumns: getComputedStyle(element).gridTemplateColumns
                })),
                parentWidth: canvas.parentElement?.getBoundingClientRect().width,
                gridWidth: canvas.closest('.tm-visual-grid')?.getBoundingClientRect().width,
                gridTemplateColumns: canvas.closest('.tm-visual-grid')
                    ? getComputedStyle(canvas.closest('.tm-visual-grid') as Element).gridTemplateColumns
                    : ''
            };
        });

        const englishCanvasMetrics = await getWordCloudMetrics();
        expect(englishCanvasMetrics.inkSamples).toBeGreaterThan(100);
        const [wordCloudDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-wordcloud"]').click()
        ]);
        const wordCloudPath = await assertPng(wordCloudDownload, 'wordcloud-en.png');
        let labels = await page.evaluate(() => (window as any).__canvasLabels);
        let textCalls = await page.evaluate(() => (window as any).__canvasTextCalls);
        expect(labels).toContain('Word cloud (term frequency)');
        expect(labels).toContain('Meaning of color and size');
        expect(labels).toContain('Larger terms have higher term frequency');
        const alphanumericCall = textCalls.find(call => call.value === 'Alphanumeric / abbreviation');
        const adjectiveCall = textCalls.find(call => call.value === 'Adjective');
        expect(alphanumericCall).toBeTruthy();
        expect(adjectiveCall).toBeTruthy();
        expect(alphanumericCall.y).not.toBe(adjectiveCall.y);

        await page.evaluate(() => {
            (window as any).__canvasLabels = [];
            (window as any).__canvasTextCalls = [];
        });
        const [networkDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-network"]').click()
        ]);
        const networkPath = await assertPng(networkDownload, 'network-en.png');
        labels = await page.evaluate(() => (window as any).__canvasLabels);
        expect(labels).toContain('How to read the co-occurrence network');

        await page.locator('[data-language-switcher] [data-locale="ja"]').click();
        const japaneseCanvasMetrics = await getWordCloudMetrics();
        expect(japaneseCanvasMetrics.width).toBe(englishCanvasMetrics.width);
        expect(japaneseCanvasMetrics.height).toBe(englishCanvasMetrics.height);
        expect(japaneseCanvasMetrics.inkSamples).toBeGreaterThan(100);
        expect(
            japaneseCanvasMetrics.rectWidth,
            JSON.stringify({ englishCanvasMetrics, japaneseCanvasMetrics })
        ).toBeCloseTo(englishCanvasMetrics.rectWidth, 1);
        expect(japaneseCanvasMetrics.rectHeight).toBeCloseTo(englishCanvasMetrics.rectHeight, 1);
        await page.evaluate(() => {
            (window as any).__canvasLabels = [];
            (window as any).__canvasTextCalls = [];
        });
        const [japaneseDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-wordcloud"]').click()
        ]);
        const japanesePath = await assertPng(japaneseDownload, 'wordcloud-ja.png');
        labels = await page.evaluate(() => (window as any).__canvasLabels);
        expect(labels).toContain('ワードクラウド（出現回数）');
        expect(labels).toContain('色と大きさの意味');
        expect(labels).toContain('出現回数が多い語ほど大きく表示');

        await testInfo.attach('saved-image-paths.json', {
            body: JSON.stringify({
                wordCloudPath,
                networkPath,
                japanesePath,
                englishCanvasMetrics,
                japaneseCanvasMetrics
            }, null, 2),
            contentType: 'application/json'
        });
    });
});
