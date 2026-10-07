import { test, expect } from '@playwright/test';

// データプレビューの表は、横にはみ出したら横スクロールできること。
// 以前は外側の枠もスクロールする二重構造で、内側の横スクロールバーが外側の枠に隠れて操作できなかった。
test('data preview scrolls horizontally with a reachable scrollbar', async ({ page }) => {
    await page.setViewportSize({ width: 520, height: 860 });
    await page.goto('/');
    await page.click('#load-demo-btn');
    await page.click('.demo-option-btn[data-demo="highschool_life_demo.csv"]');
    await page.waitForSelector('#dataframe-container table', { state: 'attached', timeout: 5000 });

    const section = page.locator('#dataframe-container').locator('xpath=ancestor::*[contains(@class,"collapsible-section")][1]');
    const content = section.locator('.collapsible-content');
    if (await content.evaluate(element => element.classList.contains('collapsed'))) {
        await section.locator('.collapsible-header').click();
    }

    const metrics = await page.locator('#dataframe-container').evaluate(outer => {
        const inner = outer.querySelector('.table-container') as HTMLElement;
        inner.scrollIntoView({ block: 'end' });
        inner.scrollLeft = 300;
        const rect = inner.getBoundingClientRect();
        return {
            outerClipsInner: outer.scrollHeight > outer.clientHeight,
            innerOverflows: inner.scrollWidth > inner.clientWidth,
            scrolledLeft: inner.scrollLeft,
            innerBottomVisible: rect.bottom <= window.innerHeight + 1
        };
    });

    expect(metrics.outerClipsInner).toBe(false);
    expect(metrics.innerOverflows).toBe(true);
    expect(metrics.scrolledLeft).toBeGreaterThan(0);
    expect(metrics.innerBottomVisible).toBe(true);
});
