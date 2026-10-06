// image/illustrations/*.svg を、アプリで表示する PNG（1600×900）に描き出す
// 使い方: node tools/illustrations/render_png.cjs
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
    const dir = path.resolve(__dirname, '../../image/illustrations');
    const files = fs.readdirSync(dir).filter(name => name.endsWith('.svg'));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    for (const file of files) {
        await page.goto('file://' + path.join(dir, file));
        await page.screenshot({ path: path.join(dir, file.replace(/\.svg$/, '.png')) });
        console.log('wrote', file.replace(/\.svg$/, '.png'));
    }
    await browser.close();
})();
