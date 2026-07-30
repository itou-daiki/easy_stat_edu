import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
    navigateToFeature,
    selectStandardOption,
    selectVariables,
    uploadFile
} from './utils/test-helpers';

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

        await editor.locator('[data-visualization-input="aspect-ratio"]').selectOption('custom-ratio');
        await expect(editor.locator('.visualization-ratio-inputs')).toBeVisible();
        await editor.locator('[data-visualization-input="ratio-width"]').fill('5');
        await editor.locator('[data-visualization-input="ratio-height"]').fill('4');
        await expect.poll(async () => {
            const box = await firstPlot.boundingBox();
            return box ? Math.round((box.width / box.height) * 100) / 100 : 0;
        }).toBe(1.25);
        await expect(firstPlot).toHaveAttribute('data-visual-aspect-ratio', '5:4');

        const customPlotPath = path.join(artifactDir, 'eda-custom-5x4-plot.png');
        const [customPlotDownload] = await Promise.all([
            page.waitForEvent('download'),
            firstPlot.locator('.modebar-btn[data-title="Download plot as a png"]').click()
        ]);
        await customPlotDownload.saveAs(customPlotPath);
        const customPlotPng = await readPngInfo(customPlotPath);
        expect(Math.abs(customPlotPng.width / customPlotPng.height - 5 / 4)).toBeLessThan(0.02);

        await editor.locator('[data-visualization-input="aspect-ratio"]').selectOption('custom');
        await expect(editor.locator('.visualization-ratio-inputs')).toBeHidden();
        await expect(editor.locator('[data-visualization-input="height"]')).toBeEnabled();
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

        await editor.locator('[data-visualization-input="aspect-ratio"]').selectOption('custom-ratio');
        await expect(editor.locator('.visualization-ratio-inputs')).toBeVisible();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(editor).toBeVisible();
        expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await expect.poll(async () => {
            const box = await firstPlot.boundingBox();
            return box ? Math.round((box.width / box.height) * 100) / 100 : 0;
        }).toBe(1.25);
    });

    test('edits numeric axis ranges and keeps significance annotations inside the graph', async ({ page }) => {
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'eda');
        const categoryPlot = page.locator('#cat-plot-0');
        await expect(categoryPlot).toBeVisible({ timeout: 15000 });
        const categoryEditor = categoryPlot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(categoryEditor).toBeVisible({ timeout: 10000 });
        await categoryEditor.locator('summary').click();
        await expect(categoryEditor.locator('[data-visualization-input="xaxis-range-auto"]')).toHaveCount(0);
        const categoryYAuto = categoryEditor.locator('[data-visualization-input="yaxis-range-auto"]');
        await expect(categoryYAuto).toBeChecked();
        await categoryYAuto.uncheck();
        await categoryEditor.locator('[data-visualization-input="yaxis-range-min"]').fill('-5');
        await categoryEditor.locator('[data-visualization-input="yaxis-range-max"]').fill('30');
        await expect.poll(async () => categoryPlot.evaluate(plot => (
            (plot as any).layout.yaxis.range.map((value: number) => Math.round(value * 100) / 100)
        ))).toEqual([-5, 30]);

        await page.click('button.tab-button[data-tab="two-vars"]');
        await selectStandardOption(page, '#two-var-1', '数学', 'label');
        await selectStandardOption(page, '#two-var-2', '英語', 'label');
        await page.click('#plot-two-vars-btn');
        const scatterPlot = page.locator('#two-vars-plot');
        await expect(scatterPlot).toBeVisible();
        const scatterEditor = scatterPlot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(scatterEditor).toBeVisible({ timeout: 10000 });
        await scatterEditor.locator('summary').click();
        await expect(scatterEditor.locator('[data-visualization-input="xaxis-range-auto"]')).toBeChecked();
        await expect(scatterEditor.locator('[data-visualization-input="yaxis-range-auto"]')).toBeChecked();
        expect(await scatterEditor.evaluate(element => (
            element.scrollWidth <= element.clientWidth + 1
        ))).toBe(true);

        const negativeRows = [
            '群,得点',
            'A,-24', 'A,-23', 'A,-22', 'A,-21', 'A,-20', 'A,-19',
            'B,-8', 'B,-7', 'B,-6', 'B,-5', 'B,-4', 'B,-3'
        ].join('\n');
        await page.locator('.btn-back').click();
        await page.locator('#main-data-file').setInputFiles({
            name: 'negative_significant.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(negativeRows, 'utf8')
        });
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '群', 'label');
        await selectVariables(page, ['得点']);
        await page.click('#run-independent-btn');

        const bracketPlot = page.locator('#plot-0');
        await expect(bracketPlot).toBeVisible({ timeout: 10000 });
        const bracketEditor = bracketPlot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(bracketEditor).toBeVisible({ timeout: 10000 });
        await bracketEditor.locator('summary').click();
        const bracketYAuto = bracketEditor.locator('[data-visualization-input="yaxis-range-auto"]');
        await expect(bracketYAuto).toBeChecked();

        const placement = await bracketPlot.evaluate(plot => {
            const plotArea = plot.querySelector('.nsewdrag')?.getBoundingClientRect();
            const annotation = Array.from(plot.querySelectorAll('.annotation-text'))
                .find(node => /^[*†]/.test(node.textContent?.trim() || ''))
                ?.getBoundingClientRect();
            const range = (plot as any).layout.yaxis.range;
            const lowerErrorBound = Math.min(
                ...(plot as any).data[0].y.map((value: number, index: number) => (
                    value - (plot as any).data[0].error_y.array[index]
                ))
            );
            return {
                annotationTopGap: plotArea && annotation ? annotation.top - plotArea.top : -1,
                annotationBottomGap: plotArea && annotation ? plotArea.bottom - annotation.bottom : -1,
                lowerErrorBound,
                range
            };
        });
        expect(placement.annotationTopGap).toBeGreaterThanOrEqual(8);
        expect(placement.annotationBottomGap).toBeGreaterThanOrEqual(0);
        expect(placement.range[0]).toBeLessThan(placement.lowerErrorBound);
        expect(placement.range[1]).toBeGreaterThan(0);

        await bracketYAuto.uncheck();
        const safeMaximum = Number(
            await bracketEditor.locator('[data-visualization-input="yaxis-range-max"]').inputValue()
        );
        await bracketEditor.locator('[data-visualization-input="yaxis-range-max"]').fill(
            String(safeMaximum - 1)
        );
        await expect(bracketEditor.locator('.visualization-axis-range-error')).toContainText(
            'ブラケットと注釈を表示するため'
        );
        await bracketEditor.locator('[data-visualization-input="yaxis-range-max"]').fill(
            String(safeMaximum + 5)
        );
        await expect(bracketEditor.locator('.visualization-axis-range-error')).toBeHidden();
        await expect.poll(async () => bracketPlot.evaluate(plot => (
            Math.round((plot as any).layout.yaxis.range[1] * 100) / 100
        ))).toBe(Math.round((safeMaximum + 5) * 100) / 100);

        const artifactDir = path.join(process.cwd(), 'output/playwright/visualization-editors');
        await fs.mkdir(artifactDir, { recursive: true });
        const bracketPlotPath = path.join(artifactDir, 'negative-bar-with-bracket.png');
        const [bracketDownload] = await Promise.all([
            page.waitForEvent('download'),
            bracketPlot.locator('.modebar-btn[data-title="Download plot as a png"]').click()
        ]);
        await bracketDownload.saveAs(bracketPlotPath);
        const bracketPng = await readPngInfo(bracketPlotPath);
        expect(bracketPng.width).toBeGreaterThan(600);
        expect(bracketPng.height).toBeGreaterThan(300);
        expect(bracketPng.bytes).toBeGreaterThan(10_000);

        await bracketYAuto.check();
        await expect.poll(async () => bracketPlot.evaluate(plot => {
            const recommendation = Number((plot as any).__easyStatPlotSpec?.layout?._recommendedMaxY);
            return (plot as any).layout.yaxis.range[1] >= recommendation;
        })).toBe(true);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(async () => bracketPlot.evaluate(plot => {
            const figure = plot.getBoundingClientRect();
            const plotArea = plot.querySelector('.nsewdrag')?.getBoundingClientRect();
            const outsideLabels = Array.from(plot.querySelectorAll(
                '.gtitle,.xtitle,.ytitle,.annotation-text,.xtick text,.ytick text'
            )).filter(node => {
                const rect = node.getBoundingClientRect();
                return (
                    rect.left < figure.left - 2
                    || rect.right > figure.right + 2
                    || rect.top < figure.top - 2
                    || rect.bottom > figure.bottom + 2
                );
            }).length;
            return {
                figureHeight: Math.round(figure.height),
                plotAreaHeight: Math.round(plotArea?.height || 0),
                outsideLabels,
                overflow: plot.scrollWidth - plot.clientWidth
            };
        })).toEqual({
            figureHeight: 320,
            plotAreaHeight: expect.any(Number),
            outsideLabels: 0,
            overflow: 0
        });
        expect(await bracketPlot.evaluate(plot => (
            plot.querySelector('.nsewdrag')?.getBoundingClientRect().height || 0
        ))).toBeGreaterThan(90);
    });

    test('switches mean bars to raw-data box plots without losing figure settings', async ({ page }) => {
        const rows = [
            '群,得点',
            'A,10', 'A,11', 'A,12', 'A,13', 'A,14', 'A,15',
            'B,25', 'B,26', 'B,27', 'B,28', 'B,29', 'B,30'
        ].join('\n');
        await page.locator('#main-data-file').setInputFiles({
            name: 'bar_box_switch.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(rows, 'utf8')
        });
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '群', 'label');
        await selectVariables(page, ['得点']);
        await page.click('#run-independent-btn');

        const plot = page.locator('#plot-0');
        await expect(plot).toBeVisible({ timeout: 10000 });
        const editor = plot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(editor).toBeVisible({ timeout: 10000 });
        await editor.locator('summary').click();
        const viewSelect = editor.locator('[data-visualization-input="chart-view"]');
        await expect(viewSelect).toHaveValue('bar');
        await editor.locator('[data-visualization-input="y-axis"]').fill('共通得点');

        await viewSelect.selectOption('box');
        await expect(plot).toHaveAttribute('data-visualization-view', 'box');
        await expect.poll(async () => plot.evaluate(element => ({
            types: (element as any).data.map((trace: any) => trace.type),
            observations: (element as any).data.reduce(
                (sum: number, trace: any) => sum + (trace.y?.length || 0),
                0
            ),
            yTitle: (element as any).layout.yaxis.title.text
        }))).toEqual({
            types: ['box', 'box'],
            observations: 12,
            yTitle: '共通得点'
        });

        const boxPlacement = await plot.evaluate(element => {
            const figure = element.getBoundingClientRect();
            const plotArea = element.querySelector('.nsewdrag')?.getBoundingClientRect();
            const annotation = Array.from(element.querySelectorAll('.annotation-text'))
                .find(node => /^[*†]/.test(node.textContent?.trim() || ''))
                ?.getBoundingClientRect();
            return {
                annotationInside: Boolean(
                    plotArea
                    && annotation
                    && annotation.top >= plotArea.top
                    && annotation.bottom <= figure.bottom
                ),
                overflow: (element as HTMLElement).scrollWidth
                    - (element as HTMLElement).clientWidth
            };
        });
        expect(boxPlacement).toEqual({ annotationInside: true, overflow: 0 });

        const artifactDir = path.join(process.cwd(), 'output/playwright/visualization-editors');
        await fs.mkdir(artifactDir, { recursive: true });
        const boxPlotPath = path.join(artifactDir, 'ttest-raw-box-plot.png');
        const [boxDownload] = await Promise.all([
            page.waitForEvent('download'),
            plot.locator('.modebar-btn[data-title="Download plot as a png"]').click()
        ]);
        await boxDownload.saveAs(boxPlotPath);
        const boxPng = await readPngInfo(boxPlotPath);
        expect(boxPng.width).toBeGreaterThan(600);
        expect(boxPng.height).toBeGreaterThan(300);
        expect(boxPng.bytes).toBeGreaterThan(10_000);

        await viewSelect.selectOption('bar');
        await expect(plot).toHaveAttribute('data-visualization-view', 'bar');
        await expect.poll(async () => plot.evaluate(element => ({
            type: (element as any).data[0].type,
            yTitle: (element as any).layout.yaxis.title.text
        }))).toEqual({ type: 'bar', yTitle: '共通得点' });
    });

    test('applies labels, ranges, ratio, and height to every graph at once', async ({ page }) => {
        const rows = [
            '群,得点,満足度',
            'A,40,50', 'A,42,52', 'A,44,54', 'A,46,56', 'A,48,58', 'A,50,60',
            'B,65,75', 'B,67,77', 'B,69,79', 'B,71,81', 'B,73,83', 'B,75,85'
        ].join('\n');
        await page.locator('#main-data-file').setInputFiles({
            name: 'bulk_figure_settings.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(rows, 'utf8')
        });
        await navigateToFeature(page, 'ttest');
        await selectStandardOption(page, '#group-var', '群', 'label');
        await selectVariables(page, ['得点', '満足度']);
        await page.click('#run-independent-btn');

        const plots = page.locator('#plots-container .js-plotly-plot');
        await expect(plots).toHaveCount(2);
        const bulkEditor = page.locator(
            '#visualization-controls-container [data-editor-kind="bulk"]'
        );
        await expect(bulkEditor).toHaveCount(1);
        await bulkEditor.locator('summary').click();
        await bulkEditor.locator('[data-visualization-input="bulk-y-label"]').fill('共通尺度');
        await bulkEditor.locator(
            '[data-visualization-input="bulk-y-range-mode"]'
        ).selectOption('manual');
        await bulkEditor.locator(
            '[data-visualization-input="bulk-y-range-min"]'
        ).fill('0');
        await bulkEditor.locator(
            '[data-visualization-input="bulk-y-range-max"]'
        ).fill('120');
        await bulkEditor.locator(
            '[data-visualization-control="bulk-size-enabled"]'
        ).check();
        await bulkEditor.locator(
            '[data-visualization-input="aspect-ratio"]'
        ).selectOption('4:3');
        await bulkEditor.locator('.visualization-bulk-apply').click();
        await expect(bulkEditor.locator('.visualization-bulk-status')).toContainText(
            '2件の図へ反映'
        );

        await expect.poll(async () => plots.evaluateAll(elements =>
            elements.map(element => {
                const rect = element.getBoundingClientRect();
                return {
                    yTitle: (element as any).layout.yaxis.title.text,
                    range: (element as any).layout.yaxis.range,
                    ratio: Math.round((rect.width / rect.height) * 100) / 100
                };
            })
        )).toEqual([
            { yTitle: '共通尺度', range: [0, 120], ratio: 1.33 },
            { yTitle: '共通尺度', range: [0, 120], ratio: 1.33 }
        ]);

        await bulkEditor.locator(
            '[data-visualization-input="aspect-ratio"]'
        ).selectOption('custom-ratio');
        await bulkEditor.locator(
            '[data-visualization-input="ratio-width"]'
        ).fill('7');
        await bulkEditor.locator(
            '[data-visualization-input="ratio-height"]'
        ).fill('4');
        await bulkEditor.locator('.visualization-bulk-apply').click();
        await expect.poll(async () => plots.evaluateAll(elements =>
            elements.map(element => {
                const rect = element.getBoundingClientRect();
                return Math.round((rect.width / rect.height) * 100) / 100;
            })
        )).toEqual([1.75, 1.75]);

        await bulkEditor.locator(
            '[data-visualization-input="aspect-ratio"]'
        ).selectOption('custom');
        await bulkEditor.locator('[data-visualization-input="height"]').fill('360');
        await bulkEditor.locator('.visualization-bulk-apply').click();
        await expect.poll(async () => plots.evaluateAll(elements =>
            elements.map(element => Math.round(element.getBoundingClientRect().height))
        )).toEqual([360, 360]);

        const firstEditor = plots.first().locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await firstEditor.locator('summary').click();
        await firstEditor.locator(
            '[data-visualization-input="chart-view"]'
        ).selectOption('box');
        await expect.poll(async () => plots.first().evaluate(element => ({
            view: (element as HTMLElement).dataset.visualizationView,
            height: Math.round(element.getBoundingClientRect().height),
            yTitle: (element as any).layout.yaxis.title.text,
            range: (element as any).layout.yaxis.range
        }))).toEqual({
            view: 'box',
            height: 360,
            yTitle: '共通尺度',
            range: [0, 120]
        });
    });

    test('offers a raw-data box view for the EDA grouped mean chart', async ({ page }) => {
        await uploadFile(page, 'datasets/demo_all_analysis.csv');
        await navigateToFeature(page, 'eda');
        await page.click('button.tab-button[data-tab="three-vars"]');
        await selectStandardOption(page, '#grouped-cat-1', 'クラス', 'label');
        await selectStandardOption(page, '#grouped-cat-2', '性別', 'label');
        await selectStandardOption(page, '#grouped-num', '数学', 'label');
        await page.click('#plot-grouped-bar-btn');

        const plot = page.locator('#grouped-bar-plot');
        await expect(plot).toBeVisible();
        const editor = plot.locator(
            'xpath=preceding-sibling::details[@data-editor-kind="plotly"][1]'
        );
        await expect(editor).toBeVisible({ timeout: 10000 });
        await editor.locator('summary').click();
        await editor.locator(
            '[data-visualization-input="chart-view"]'
        ).selectOption('box');
        await expect(plot).toHaveAttribute('data-visualization-view', 'box');
        const boxData = await plot.evaluate(element => ({
            types: (element as any).data.map((trace: any) => trace.type),
            observations: (element as any).data.reduce(
                (sum: number, trace: any) => sum + (trace.y?.length || 0),
                0
            )
        }));
        expect(boxData.types.every((type: string) => type === 'box')).toBe(true);
        expect(boxData.observations).toBeGreaterThan(20);
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
        await wordCloudEditor.locator('[data-visualization-input="width"]').evaluate(input => {
            const range = input as HTMLInputElement;
            range.value = '70';
            range.dispatchEvent(new Event('input', { bubbles: true }));
            range.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await wordCloudEditor.locator('[data-visualization-input="aspect-ratio"]').selectOption('1:1');
        await expect.poll(async () => page.locator('#overall-wordcloud').evaluate(canvas => {
            const rect = canvas.getBoundingClientRect();
            return Math.round((rect.width / rect.height) * 100) / 100;
        })).toBe(1);
        await expect(page.locator('#overall-wordcloud-legend')).toBeVisible();

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
        expect(titledWordCloud.width).toBeGreaterThan(wordCloudSize.width);
        expect(titledWordCloud.height).toBeGreaterThan(wordCloudSize.height);
        expect(titledWordCloud.width / titledWordCloud.height).toBe(1);
        expect(titledWordCloud.bytes).toBeGreaterThan(20_000);

        await wordCloudEditor.locator('[data-visualization-control="title"]').uncheck();
        await wordCloudEditor.locator('[data-visualization-control="legend"]').uncheck();
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
        await expect(page.locator('#overall-network-legend')).toBeVisible();
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
        expect(networkPng.width).toBeGreaterThan(networkSize.width);
        expect(networkPng.height).toBeGreaterThan(networkSize.height);
        expect(Math.abs(networkPng.width / networkPng.height - 16 / 9)).toBeLessThan(0.001);

        await networkEditor.locator('[data-visualization-input="aspect-ratio"]').selectOption('custom-ratio');
        await networkEditor.locator('[data-visualization-input="ratio-width"]').fill('5');
        await networkEditor.locator('[data-visualization-input="ratio-height"]').fill('4');
        await expect.poll(async () => page.locator('#overall-network').evaluate(container => {
            const canvas = container.querySelector('canvas');
            const rect = canvas?.getBoundingClientRect();
            return {
                ratio: rect ? Math.round((rect.width / rect.height) * 100) / 100 : 0,
                exportRatio: canvas?.dataset.visualAspectRatio || ''
            };
        })).toEqual({ ratio: 1.25, exportRatio: '5:4' });
        const customNetworkPath = path.join(artifactDir, 'network-custom-5x4.png');
        const [customNetworkDownload] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('.download-btn[data-target="overall-network"]').click()
        ]);
        await customNetworkDownload.saveAs(customNetworkPath);
        const customNetworkPng = await readPngInfo(customNetworkPath);
        expect(Math.abs(customNetworkPng.width / customNetworkPng.height - 5 / 4)).toBeLessThan(0.001);

        await networkEditor.locator('[data-visualization-input="aspect-ratio"]').selectOption('16:9');
        await networkEditor.locator('[data-visualization-control="title"]').uncheck();
        await networkEditor.locator('[data-visualization-control="legend"]').uncheck();
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
