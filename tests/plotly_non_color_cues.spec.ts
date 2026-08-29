import { expect, test } from '@playwright/test';

test('複数系列のPlotly図を模様・線種・記号でも区別できる', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });

    const styles = await page.evaluate(async () => {
        const { ensureAccessiblePlotlyStyles } = await import('/js/utils.js');
        const data = ensureAccessiblePlotlyStyles([
            { type: 'bar', name: 'A', x: ['x'], y: [1], marker: { color: '#2c5f8a' } },
            { type: 'bar', name: 'B', x: ['x'], y: [2], marker: { color: '#d4544a' } },
            { type: 'scatter', mode: 'lines+markers', name: 'C', x: [0, 1], y: [0, 1] },
            { type: 'scatter', mode: 'lines+markers', name: 'D', x: [0, 1], y: [1, 0] }
        ]);
        return data.map(trace => ({
            pattern: trace.marker?.pattern?.shape,
            outline: trace.marker?.line?.width,
            symbol: trace.marker?.symbol,
            dash: trace.line?.dash
        }));
    });

    expect(styles[0].outline).toBeGreaterThanOrEqual(1);
    expect(styles[1].outline).toBeGreaterThanOrEqual(1);
    expect(styles[0].pattern).not.toBe(styles[1].pattern);
    expect(styles[2].symbol).not.toBe(styles[3].symbol);
    expect(styles[2].dash).not.toBe(styles[3].dash);
});

test('一つの系列内で色分けした棒にも異なる模様を付ける', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 30_000 });

    const patterns = await page.evaluate(async () => {
        const { ensureAccessiblePlotlyStyles } = await import('/js/utils.js');
        const data = ensureAccessiblePlotlyStyles([{
            type: 'bar',
            x: ['A', 'B'],
            y: [1, 2],
            marker: { color: ['#2c5f8a', '#d4544a'] }
        }]);
        return data[0].marker.pattern.shape;
    });

    expect(patterns).toHaveLength(2);
    expect(patterns[0]).not.toBe(patterns[1]);
});
