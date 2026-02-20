import { test, expect } from '@playwright/test';
import * as path from 'path';

test('debug t-test deep', async ({ page }) => {
    // ログ記録用の配列
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.goto('/');

    // JS側で100msごとにDOMを監視するスクリプトを注入
    await page.evaluate(() => {
        window.historyLogs = [];
        setInterval(() => {
            const el = document.getElementById('independent-controls');
            if (el) {
                window.historyLogs.push(new Date().getTime() + ': independent-controls exists! display = ' + el.style.display);
            } else {
                window.historyLogs.push(new Date().getTime() + ': independent-controls DOES NOT EXIST');
            }
        }, 100);
    });

    const fileInput = page.locator('#main-data-file');
    const filePath = path.join(__dirname, '../datasets/ttest_demo.xlsx');
    await fileInput.setInputFiles(filePath);
    await page.waitForSelector('#dataframe-container', { state: 'visible', timeout: 5000 });

    // click card
    const card = page.locator('.feature-card[data-analysis="ttest"]');
    await card.click();

    await page.waitForTimeout(2000);

    // 結果の取得
    const history = await page.evaluate(() => window.historyLogs);
    console.log("HISTORY:");
    console.log(history.join('\n'));
});
