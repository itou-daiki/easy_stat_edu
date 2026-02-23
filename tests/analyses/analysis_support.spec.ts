import { test, expect } from '@playwright/test';

test.describe('Analysis Supporter', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/'); // Adjust URL as needed
        // Upload dummy data to enable features
        const fs = require('fs');
        if (!fs.existsSync('dummy_support.csv')) {
            let csvContent = 'Num1,Num2,Num3,Cat2,Cat3,Cat4,Text1,Text2\n';
            for (let i = 1; i <= 15; i++) {
                csvContent += `${i},${i + 1},${i + 2},${i % 2 === 0 ? 'A' : 'B'},${i % 3 === 0 ? 'X' : (i % 3 === 1 ? 'Y' : 'Z')},${i % 4 === 0 ? 'P' : 'Q'},Test${i},T${i}\n`;
            }
            fs.writeFileSync('dummy_support.csv', csvContent);
        }
        await page.setInputFiles('#main-data-file', 'dummy_support.csv');
        await page.waitForTimeout(1000); // wait for load
        await page.click('div.feature-card[data-analysis="analysis_support"]', { force: true });
        await page.waitForTimeout(500);
    });

    test('Suggests EDA for single numeric', async ({ page }) => {
        // Select Num1
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');

        await expect(page.locator('#recommendation-list')).toContainText('探索的データ分析');
        await expect(page.locator('#recommendation-list')).toContainText('時系列データ分析');
    });

    test('Suggests Correlation and Regression for two numerics', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Num2"]');

        await expect(page.locator('#recommendation-list')).toContainText('相関分析');
        await expect(page.locator('#recommendation-list')).toContainText('単回帰分析');
        await expect(page.locator('#recommendation-list')).toContainText('対応のあるt検定');
        await expect(page.locator('#recommendation-list')).toContainText('ウィルコクソンの符号付順位検定'); // New expectation
    });

    test('Suggests multiple analysis for three numerics', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Num2"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Num3"]');

        await expect(page.locator('#recommendation-list')).toContainText('重回帰分析');
        await expect(page.locator('#recommendation-list')).toContainText('主成分分析');
        await expect(page.locator('#recommendation-list')).toContainText('因子分析');
    });

    test('Suggests T-test, Mann-Whitney and Logistic Regression for 1 numeric + 1 binary categorical', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Cat2"]'); // 2 unique values

        await expect(page.locator('#recommendation-list')).toContainText('t検定');
        await expect(page.locator('#recommendation-list')).toContainText('マン・ホイットニーのU検定');
        await expect(page.locator('#recommendation-list')).toContainText('ロジスティック回帰分析'); // New expectation
    });

    test('Suggests ANOVA and Kruskal-Wallis for 1 numeric + 1 multi-categorical', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Cat3"]'); // 3 unique values

        await expect(page.locator('#recommendation-list')).toContainText('一要因分散分析');
        await expect(page.locator('#recommendation-list')).toContainText('クラスカル・ウォリス検定');
    });

    test('Suggests Chi-square, Fisher, McNemar for 2 categoricals', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Cat2"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Cat3"]');

        await expect(page.locator('#recommendation-list')).toContainText('カイ二乗検定');
        await expect(page.locator('#recommendation-list')).toContainText('フィッシャーの正確確率検定'); // New expectation
        await expect(page.locator('#recommendation-list')).toContainText('マクネマー検定'); // New expectation
    });

    test('Independent suggestions: text and numeric', async ({ page }) => {
        await page.click('#support-multiselect .multiselect-input');
        await page.click('#support-multiselect .multiselect-option[data-value="Text1"]');
        await page.click('#support-multiselect .multiselect-option[data-value="Num1"]');

        // Both text mining and EDA should be suggested
        await expect(page.locator('#recommendation-list')).toContainText('テキストマイニング');
        await expect(page.locator('#recommendation-list')).toContainText('探索的データ分析');
    });
});
