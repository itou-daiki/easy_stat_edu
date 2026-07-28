import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { navigateToFeature, uploadFile } from './utils/test-helpers';

async function readPngInfo(filePath: string) {
    const buffer = await fs.readFile(filePath);
    expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bytes: buffer.length
    };
}

async function expectEditorCoverage(page) {
    await expect.poll(async () => page.locator('#analysis-content').evaluate(root => {
        const plots = root.querySelectorAll('.js-plotly-plot').length;
        const canvases = root.querySelectorAll('canvas.tm-wordcloud-canvas, .tm-network-canvas').length;
        const tables = root.querySelectorAll('table').length;
        return {
            plotDelta: root.querySelectorAll('[data-editor-kind="plotly"]').length - plots,
            canvasDelta: root.querySelectorAll('[data-editor-kind="canvas"]').length - canvases,
            tableDelta: root.querySelectorAll('[data-editor-kind="table"]').length - tables,
            hasOutput: plots + canvases + tables > 0
        };
    }), { timeout: 10000 }).toEqual({
        plotDelta: 0,
        canvasDelta: 0,
        tableDelta: 0,
        hasOutput: true
    });
}

test.describe('Editable visualization and table labels', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    });

    test('edits every EDA plot independently and preserves edits through redraws', async ({ page }) => {
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'eda');
        await expect(page.locator('.js-plotly-plot').first()).toBeVisible({ timeout: 15000 });
        await expectEditorCoverage(page);

        const plotCount = await page.locator('.js-plotly-plot').count();
        await expect(page.locator('[data-editor-kind="plotly"]')).toHaveCount(plotCount);

        const editor = page.locator('[data-editor-kind="plotly"]').first();
        await editor.locator('summary').click();
        await expect(editor.locator('[data-visualization-input="title"]')).toHaveValue(/性別/);
        await expect(editor.locator('[data-visualization-input="x-axis"]')).toHaveValue('性別');
        await expect(editor.locator('[data-visualization-input="y-axis"]')).toHaveValue('度数');

        await editor.locator('[data-visualization-input="title"]').fill('性別の回答数');
        await editor.locator('[data-visualization-input="x-axis"]').fill('性別区分');
        await editor.locator('[data-visualization-input="y-axis"]').fill('人数');

        const firstPlot = page.locator('#cat-plot-0');
        await expect(firstPlot.locator('.xtitle')).toHaveText('性別区分');
        await expect(firstPlot.locator('.annotation-text')).toContainText(['人数', '性別の回答数']);

        const initialPlotBox = await firstPlot.boundingBox();
        expect(initialPlotBox).not.toBeNull();
        await editor.locator('[data-visualization-input="width"]').evaluate(input => {
            const range = input as HTMLInputElement;
            range.value = '70';
            range.dispatchEvent(new Event('input', { bubbles: true }));
            range.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await editor.locator('[data-visualization-input="aspect-ratio"]').selectOption('1:1');
        await expect.poll(async () => {
            const box = await firstPlot.boundingBox();
            return box ? {
                narrower: box.width < (initialPlotBox?.width || 0) * 0.8,
                ratio: Math.round((box.width / box.height) * 100) / 100,
                innerFits: await firstPlot.evaluate(plot =>
                    plot.scrollWidth <= plot.clientWidth + 1
                    && Math.abs(
                        (plot.querySelector('.main-svg')?.getBoundingClientRect().width || 0)
                        - plot.getBoundingClientRect().width
                    ) <= 1
                )
            } : null;
        }).toEqual({ narrower: true, ratio: 1, innerFits: true });
        await expect.poll(async () => firstPlot.evaluate(plot => {
            const xTitle = plot.querySelector('.xtitle')?.getBoundingClientRect();
            const bottomTitle = Array.from(plot.querySelectorAll('.annotation-text'))
                .find(node => node.textContent?.includes('性別の回答数'))
                ?.getBoundingClientRect();
            return xTitle && bottomTitle ? Math.round(bottomTitle.top - xTitle.bottom) : -1;
        })).toBeGreaterThanOrEqual(8);

        const artifactDir = path.join(process.cwd(), 'output/playwright/visualization-editors');
        await fs.mkdir(artifactDir, { recursive: true });
        const squarePlotPath = path.join(artifactDir, 'eda-square-plot.png');
        const [squarePlotDownload] = await Promise.all([
            page.waitForEvent('download'),
            firstPlot.locator('.modebar-btn[data-title="Download plot as a png"]').click()
        ]);
        await squarePlotDownload.saveAs(squarePlotPath);
        const squarePlotPng = await readPngInfo(squarePlotPath);
        expect(Math.abs(squarePlotPng.width / squarePlotPng.height - 1)).toBeLessThan(0.02);

        await page.locator('#sort-select-0').selectOption('name');
        await expect(firstPlot.locator('.xtitle')).toHaveText('性別区分');
        await expect(firstPlot.locator('.annotation-text')).toContainText(['人数', '性別の回答数']);
        await expect.poll(async () => {
            const box = await firstPlot.boundingBox();
            return box ? Math.round((box.width / box.height) * 100) / 100 : 0;
        }).toBe(1);

        await editor.locator('[data-visualization-input="aspect-ratio"]').selectOption('custom');
        await editor.locator('[data-visualization-input="height"]').fill('360');
        await expect.poll(async () => Math.round((await firstPlot.boundingBox())?.height || 0)).toBe(360);

        await page.locator('#show-axis-labels').uncheck();
        await page.locator('#show-graph-title').uncheck();
        await expect(firstPlot.locator('.xtitle')).toHaveCount(0);
        await expect(firstPlot.locator('.annotation-text')).toHaveCount(0);

        await page.locator('#show-axis-labels').check();
        await page.locator('#show-graph-title').check();
        await expect(firstPlot.locator('.xtitle')).toHaveText('性別区分');
        await expect(firstPlot.locator('.annotation-text')).toContainText(['人数', '性別の回答数']);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(editor).toBeVisible();
        expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    });

    test('applies canvas title and legend settings to saved text-mining PNGs', async ({ page }) => {
        await uploadFile(page, 'datasets/textmining_demo.xlsx');
        await navigateToFeature(page, 'text_mining');
        await page.locator('#text-var').selectOption({ index: 1 });
        await page.locator('#run-text-btn').click();
        await expect(page.locator('#overall-wordcloud')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('#overall-network canvas')).toBeVisible({ timeout: 30000 });
        await expectEditorCoverage(page);

        const canvasEditors = page.locator('[data-editor-kind="canvas"]');
        await expect(canvasEditors).toHaveCount(3);

        const termTable = page.locator('.tm-term-table').first();
        const tableEditor = termTable.locator('xpath=preceding-sibling::details[@data-editor-kind="table"][1]');
        await tableEditor.locator('summary').click();
        await tableEditor.locator('[data-visualization-input="table-title"]').fill('抽出語ランキング');
        await expect(termTable.locator('caption')).toHaveText('抽出語ランキング');
        await tableEditor.locator('[data-visualization-control="table-title"]').uncheck();
        await expect(termTable.locator('caption')).toBeHidden();

        const wordCloudEditor = canvasEditors.first();
        await wordCloudEditor.locator('summary').click();
        await wordCloudEditor.locator('[data-visualization-input="title"]').fill('自由記述の頻出語');
        await wordCloudEditor.locator('[data-visualization-control="legend"]').uncheck();
        await wordCloudEditor.locator('[data-visualization-input="width"]').evaluate(input => {
            const range = input as HTMLInputElement;
            range.value = '70';
            range.dispatchEvent(new Event('input', { bubbles: true }));
            range.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await wordCloudEditor.locator('[data-visualization-input="aspect-ratio"]').selectOption('1:1');
        await expect(page.locator('#overall-wordcloud-legend')).toBeHidden();
        await expect.poll(async () => page.locator('#overall-wordcloud').evaluate(canvas => {
            const rect = canvas.getBoundingClientRect();
            return Math.round((rect.width / rect.height) * 100) / 100;
        })).toBe(1);

        const wordCloudSize = await page.locator('#overall-wordcloud').evaluate(canvas => {
            const target = canvas as HTMLCanvasElement;
            return { width: target.width, height: target.height };
        });
        const artifactDir = path.join(process.cwd(), 'output/playwright/visualization-editors');
        await fs.mkdir(artifactDir, { recursive: true });
        const titledWordCloudPath = path.join(artifactDir, 'wordcloud-edited-title.png');
        const [titledWordCloudDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-wordcloud"]').click()
        ]);
        await titledWordCloudDownload.saveAs(titledWordCloudPath);
        const titledWordCloud = await readPngInfo(titledWordCloudPath);
        expect(titledWordCloud.width).toBe(wordCloudSize.width);
        expect(titledWordCloud.height).toBeGreaterThan(wordCloudSize.height);
        expect(titledWordCloud.bytes).toBeGreaterThan(20_000);

        await wordCloudEditor.locator('[data-visualization-control="title"]').uncheck();
        const plainWordCloudPath = path.join(artifactDir, 'wordcloud-title-and-legend-hidden.png');
        const [plainWordCloudDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-wordcloud"]').click()
        ]);
        await plainWordCloudDownload.saveAs(plainWordCloudPath);
        const plainWordCloud = await readPngInfo(plainWordCloudPath);
        expect(plainWordCloud.height).toBe(wordCloudSize.height);
        expect(Math.abs(plainWordCloud.width / plainWordCloud.height - 1)).toBeLessThan(0.02);

        const networkEditor = canvasEditors.nth(2);
        await networkEditor.locator('summary').click();
        await networkEditor.locator('[data-visualization-input="title"]').fill('語のつながり');
        await networkEditor.locator('[data-visualization-control="legend"]').uncheck();
        await networkEditor.locator('[data-visualization-input="width"]').evaluate(input => {
            const range = input as HTMLInputElement;
            range.value = '80';
            range.dispatchEvent(new Event('input', { bubbles: true }));
            range.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await networkEditor.locator('[data-visualization-input="aspect-ratio"]').selectOption('16:9');
        await expect.poll(async () => page.locator('#overall-network').evaluate(container => {
            const canvas = container.querySelector('canvas');
            const rect = canvas?.getBoundingClientRect();
            return {
                ratio: rect ? Math.round((rect.width / rect.height) * 100) / 100 : 0,
                fits: container.scrollWidth <= container.clientWidth + 1
            };
        })).toEqual({ ratio: 1.78, fits: true });
        const networkSize = await page.locator('#overall-network canvas').evaluate(canvas => {
            const target = canvas as HTMLCanvasElement;
            return { width: target.width, height: target.height };
        });
        const networkPath = path.join(artifactDir, 'network-edited-title.png');
        const [networkDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-network"]').click()
        ]);
        await networkDownload.saveAs(networkPath);
        const networkPng = await readPngInfo(networkPath);
        expect(networkPng.width).toBe(networkSize.width);
        expect(networkPng.height).toBeGreaterThan(networkSize.height);

        await networkEditor.locator('[data-visualization-control="title"]').uncheck();
        const plainNetworkPath = path.join(artifactDir, 'network-resized-16x9.png');
        const [plainNetworkDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-network"]').click()
        ]);
        await plainNetworkDownload.saveAs(plainNetworkPath);
        const plainNetworkPng = await readPngInfo(plainNetworkPath);
        expect(Math.abs(plainNetworkPng.width / plainNetworkPng.height - 16 / 9)).toBeLessThan(0.03);

        await page.locator('#run-text-btn').click();
        await expect(page.locator('#overall-wordcloud')).toBeVisible({ timeout: 60000 });
        await expectEditorCoverage(page);
        await expect(page.locator('[data-editor-kind="canvas"]')).toHaveCount(3);
    });
});
