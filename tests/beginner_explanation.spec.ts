import { expect, test } from '@playwright/test';
import path from 'path';

test.describe('初学者向けの共通説明', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#main-app')).toBeVisible();
    });

    test('各分析で「簡単に説明すると」を必要なときだけ開ける', async ({ page }) => {
        await page.locator('.feature-card[data-analysis="text_mining"]').click();

        const explanation = page.locator('[data-beginner-explanation="text_mining"]');
        await expect(explanation).toHaveCount(1);
        await expect(explanation.locator('summary')).toContainText('簡単に説明すると');
        await expect(explanation.locator('summary')).toContainText('高校生向け');
        await expect(explanation).not.toHaveAttribute('open', '');

        await explanation.locator('summary').press('Enter');
        await expect(explanation).toHaveAttribute('open', '');
        await expect(explanation).toContainText('まず見るところ');
        await expect(explanation).toContainText('読み違えに注意');
        await expect(explanation).toContainText('KWIC');
        await expect(explanation).toContainText('共起は因果関係を表しません');

        await page.getByRole('button', { name: '機能選択に戻る' }).click();
        await page.locator('.feature-card[data-analysis="data_merge"]').click();
        await expect(page.locator('[data-beginner-explanation="data_merge"]')).toHaveCount(1);
        await expect(page.locator('[data-beginner-explanation]')).toHaveCount(1);
    });

    test('AI支援には高校生向けと研究・論文向けの表記がある', async ({ page }) => {
        const levelSelect = page.locator('#ai-explanation-level');
        await expect(levelSelect.locator('option[value="simple"]')).toHaveText('高校生向け（やさしく）');
        await expect(levelSelect.locator('option[value="detailed"]')).toHaveText('研究・論文向け（詳しく）');
        await expect(page.locator('[data-ai-question*="高校生にもわかる言葉"]')).toContainText('高校生向け');
    });

    test('マニュアルにも初学者向け導線とAI説明レベルが記載されている', async ({ page }) => {
        await page.goto('/manual.html');
        const quickStart = page.locator('#quick-start');
        await expect(quickStart).toContainText('2つの「簡単に説明すると」を必要なときだけ開く');
        await expect(quickStart).toContainText('今回の結果を簡単に説明すると');
        await expect(quickStart).toContainText('この説明を開くだけで外部通信は行いません');
        await expect(quickStart).toContainText('高校生向け（やさしく）');
        await expect(quickStart).toContainText('研究・論文向け（詳しく）');
    });

    test('トップ画面の全23機能に専用説明が定義されている', async ({ page }) => {
        const analysisTypes = await page.locator('.feature-card').evaluateAll(cards => {
            return cards.map(card => (card as HTMLElement).dataset.analysis).filter(Boolean) as string[];
        });
        const source = await page.evaluate(async () => (await fetch('/js/main.js')).text());
        const beginnerBlock = source
            .split('const BEGINNER_EXPLANATIONS = {')[1]
            .split('\n};\n\nconst RESULT_METRIC_DEFINITIONS')[0];
        const definedTypes = Array.from(beginnerBlock.matchAll(/^    ([a-z0-9_]+): \{/gm), match => match[1]);

        expect(analysisTypes).toHaveLength(23);
        expect(definedTypes.sort()).toEqual(analysisTypes.sort());
    });

    test('データ読込後に全23機能で説明を1つだけ描画できる', async ({ page }) => {
        test.setTimeout(120_000);
        await page.locator('#main-data-file').setInputFiles(
            path.join(__dirname, '../datasets/demo_all_analysis.csv')
        );
        await expect(page.locator('#main-file-info')).toBeVisible();

        const analysisTypes = await page.locator('.feature-card').evaluateAll(cards => {
            return cards.map(card => (card as HTMLElement).dataset.analysis).filter(Boolean) as string[];
        });

        for (const analysisType of analysisTypes) {
            const card = page.locator(`.feature-card[data-analysis="${analysisType}"]`);
            await expect(card, `${analysisType}が利用可能`).not.toHaveClass(/disabled/);
            await card.click();

            const explanation = page.locator(`[data-beginner-explanation="${analysisType}"]`);
            await expect(explanation, `${analysisType}の説明`).toHaveCount(1);
            await expect(explanation.locator('summary')).toContainText('簡単に説明すると');
            const placement = await explanation.evaluate(element => ({
                parentTag: element.parentElement?.tagName,
                width: element.getBoundingClientRect().width,
                summaryHeight: element.querySelector('summary')?.getBoundingClientRect().height || 0
            }));
            expect(placement.parentTag).not.toBe('STYLE');
            expect(placement.parentTag).not.toBe('SCRIPT');
            expect(placement.width).toBeGreaterThan(200);
            expect(placement.summaryHeight).toBeGreaterThanOrEqual(60);

            await page.getByRole('button', { name: '機能選択に戻る' }).click();
        }
    });

    test('狭い画面でも説明文が横にはみ出さない', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.feature-card[data-analysis="text_mining"]').click();

        const explanation = page.locator('[data-beginner-explanation="text_mining"]');
        await explanation.locator('summary').click();
        const overflow = await explanation.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
                pageWidth: document.documentElement.clientWidth,
                left: rect.left,
                right: rect.right,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth
            };
        });

        expect(overflow.left).toBeGreaterThanOrEqual(0);
        expect(overflow.right).toBeLessThanOrEqual(overflow.pageWidth + 1);
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
        const gridColumns = await explanation.locator('.beginner-explanation-grid').evaluate(element => {
            return getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length;
        });
        expect(gridColumns).toBe(1);
    });
});
