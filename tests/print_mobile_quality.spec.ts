import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
    navigateToFeature,
    selectStandardOption,
    selectVariables,
    uploadFile
} from './utils/test-helpers';

async function runTTest(page) {
    await uploadFile(page, 'datasets/demo_all_analysis.csv');
    await navigateToFeature(page, 'ttest');
    await selectStandardOption(page, '#group-var', '性別', 'label');
    await selectVariables(page, ['数学', '英語']);
    await page.locator('#run-independent-btn').click();
    await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
}

test.describe('Mobile reflow and print output', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30000 });
    });

    test('keeps page content within a 320px viewport and confines wide tables', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await runTTest(page);
        await expect.poll(async () => page.locator('#plot-0').evaluate(element => {
            const svg = element.querySelector('.main-svg');
            return Boolean(
                svg
                && element.scrollWidth <= element.clientWidth + 1
                && Math.abs(svg.getBoundingClientRect().width - element.clientWidth) <= 1
            );
        })).toBe(true);
        await expect.poll(async () => page.locator('#plot-0').evaluate(element => {
            const title = element.querySelector('.gtitle')?.getBoundingClientRect();
            const modebar = element.querySelector('.modebar')?.getBoundingClientRect();
            const visibleButtons = Array.from(element.querySelectorAll<HTMLElement>('.modebar-btn'))
                .filter(button => getComputedStyle(button).display !== 'none').length;
            const overlapArea = title && modebar
                ? Math.max(0, Math.min(title.right, modebar.right) - Math.max(title.left, modebar.left))
                    * Math.max(0, Math.min(title.bottom, modebar.bottom) - Math.max(title.top, modebar.top))
                : 0;
            return { visibleButtons, overlapArea: Math.round(overlapArea) };
        })).toEqual({ visibleButtons: 2, overlapArea: 0 });

        const reflow = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth;
            const wideTables = Array.from(document.querySelectorAll<HTMLElement>('.table-container'))
                .filter(container => container.scrollWidth > container.clientWidth + 1)
                .map(container => getComputedStyle(container).overflowX);
            return {
                pageOverflow: document.documentElement.scrollWidth - viewportWidth,
                wideTables,
                editorOverflows: Array.from(document.querySelectorAll<HTMLElement>('.visualization-item-editor'))
                    .filter(editor => editor.scrollWidth > editor.clientWidth + 1)
                    .length
            };
        });

        expect(reflow.pageOverflow).toBeLessThanOrEqual(1);
        expect(reflow.wideTables.length).toBeGreaterThan(0);
        expect(reflow.wideTables.every(value => value === 'auto' || value === 'scroll')).toBe(true);
        expect(reflow.editorOverflows).toBe(0);
    });

    test('prints analysis output without app controls and preserves graph dimensions', async ({ page }) => {
        await runTTest(page);
        const plotHeightBefore = await page.locator('#plot-0').evaluate(element => (
            Math.round(element.getBoundingClientRect().height)
        ));

        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.hero-section')).toBeHidden();
        await expect(page.locator('#ai-assist-widget')).toBeHidden();
        await expect(page.locator('.visualization-item-editor').first()).toBeHidden();
        await expect(page.locator('#results-section')).toBeVisible();

        const printState = await page.evaluate(() => ({
            tableOverflow: getComputedStyle(document.querySelector('.table-container')!).overflow,
            plotWidth: Math.round(document.querySelector<HTMLElement>('#plot-0')!.getBoundingClientRect().width),
            analysisWidth: Math.round(document.querySelector<HTMLElement>('#analysis-content')!.getBoundingClientRect().width),
            plotHeight: Math.round(document.querySelector<HTMLElement>('#plot-0')!.getBoundingClientRect().height)
        }));
        expect(printState.tableOverflow).toBe('visible');
        expect(printState.plotWidth).toBeLessThanOrEqual(printState.analysisWidth + 1);
        expect(printState.plotHeight).toBe(plotHeightBefore);

        const artifactDir = path.join(process.cwd(), 'output/playwright/print');
        await fs.mkdir(artifactDir, { recursive: true });
        const previewPath = path.join(artifactDir, 'ttest-print-preview.png');
        await page.screenshot({ path: previewPath, fullPage: true });
        expect((await fs.stat(previewPath)).size).toBeGreaterThan(20_000);
    });
});
