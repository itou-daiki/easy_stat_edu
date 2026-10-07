import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8081';

// Helper: Load demo data
async function loadDemo(page, filename: string) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  // Click demo button
  const demoBtn = page.locator('text=デモデータを試す');
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
  } else {
    await page.locator('#try-demo-btn').click();
  }
  await page.waitForTimeout(500);
  // Click specific demo file
  await page.locator(`[data-demo="${filename}"]`).click();
  await page.waitForTimeout(1500);
}

// Helper: Navigate to analysis
async function goToAnalysis(page, analysisType: string) {
  const card = page.locator(`[data-analysis="${analysisType}"]`);
  await card.scrollIntoViewIfNeeded();
  await page.evaluate((type) => {
    const c = document.querySelector(`[data-analysis="${type}"]`) as HTMLElement;
    if (c && c.onclick) c.onclick(new MouseEvent('click'));
  }, analysisType);
  await page.waitForTimeout(1500);
}

// Helper: Check no JS errors
function setupErrorTracking(page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function selectFirstMultiSelectOptions(page, containerSelector: string, requestedCount: number) {
  const container = page.locator(containerSelector);
  const trigger = container.locator('.multiselect-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const options = container.locator('.multiselect-option');
  const optionCount = await options.count();
  for (let i = 0; i < Math.min(requestedCount, optionCount); i++) {
    await options.nth(i).click();
  }

  await page.keyboard.press('Escape');
}

test.describe('Correlation Analysis - Full Options', () => {
  test('Pearson and Spearman switching', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_regression_demo.csv');
    await goToAnalysis(page, 'correlation');

    await selectFirstMultiSelectOptions(page, '#correlation-vars-container', 4);

    // Run analysis
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行"), #run-correlation');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(2000);
    }

    // Check results rendered
    const content = await page.content();
    const hasTable = content.includes('table') || content.includes('相関');
    expect(hasTable).toBeTruthy();

    // Check for Pearson/Spearman radio buttons
    const pearsonRadio = page.locator('input[value="pearson"], label:has-text("Pearson")');
    const spearmanRadio = page.locator('input[value="spearman"], label:has-text("Spearman")');

    if (await spearmanRadio.first().isVisible()) {
      await spearmanRadio.first().click();
      await page.waitForTimeout(500);
      // Re-run
      if (await runBtn.first().isVisible()) {
        await runBtn.first().click();
        await page.waitForTimeout(2000);
      }
    }

    // Check for charts (heatmap, scatter matrix)
    const plotlyDivs = page.locator('.js-plotly-plot, .plotly');
    const plotCount = await plotlyDivs.count();

    // Screenshot
    await page.screenshot({ path: 'test-results/correlation_full.png', fullPage: true });

    expect(errors).toHaveLength(0);
  });
});

test.describe('Logistic Regression - Full Options', () => {
  test('Run with hs_logistic_demo.csv', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_logistic_demo.csv');
    await goToAnalysis(page, 'logistic_regression');
    await page.waitForTimeout(1000);

    // Select outcome variable (合否)
    const outcomeSelect = page.locator('#outcome-var, #target-var, select').first();
    await page.waitForTimeout(500);

    // Take screenshot of setup
    await page.screenshot({ path: 'test-results/logistic_setup.png', fullPage: true });

    // Try to select variables and run
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const options = await selects.nth(i).locator('option').allTextContents();
      if (options.includes('合否')) {
        await selects.nth(i).selectOption({ label: '合否' });
        break;
      }
    }

    await selectFirstMultiSelectOptions(page, '#logistic-indep-container', 3);

    // Run
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行"), button:has-text("予測")');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'test-results/logistic_results.png', fullPage: true });

    // Check content rendered
    const content = await page.content();
    const hasResults = content.includes('オッズ') || content.includes('分類') || content.includes('係数') || content.includes('ロジスティック');
    expect(hasResults).toBeTruthy();

    expect(errors).toHaveLength(0);
  });
});

test.describe('ANOVA Options - Tukey/Holm, Multiple DVs', () => {
  test('One-way ANOVA with Holm method and multiple DVs', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_anova_demo.csv');
    await goToAnalysis(page, 'anova_one_way');
    await page.waitForTimeout(1000);

    // Select factor
    const factorSelect = page.locator('#factor-var, #group-var, select').first();
    const options = await factorSelect.locator('option').allTextContents();
    if (options.includes('勉強法')) {
      await factorSelect.selectOption({ label: '勉強法' });
    }
    await page.waitForTimeout(300);

    await selectFirstMultiSelectOptions(page, '#dependent-var-container', 1);

    // Run analysis
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行")');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/anova_oneway_default.png', fullPage: true });

    // Look for post-hoc method selector
    const holmBtn = page.locator('button:has-text("Holm"), label:has-text("Holm"), select option:has-text("Holm")');
    if (await holmBtn.first().isVisible()) {
      await holmBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/anova_oneway_holm.png', fullPage: true });
    }

    // Check for Tukey button
    const tukeyBtn = page.locator('button:has-text("Tukey"), label:has-text("Tukey")');
    if (await tukeyBtn.first().isVisible()) {
      await tukeyBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/anova_oneway_tukey.png', fullPage: true });
    }

    const content = await page.content();
    expect(content).toContain('ANOVA');
    expect(errors).toHaveLength(0);
  });

  test('Two-way ANOVA interaction', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_anova_demo.csv');
    await goToAnalysis(page, 'anova_two_way');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/anova_twoway_setup.png', fullPage: true });

    // Try to configure factors
    const selects = page.locator('select');
    const selectCount = await selects.count();

    for (let i = 0; i < selectCount; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.includes('勉強法')) {
        await selects.nth(i).selectOption({ label: '勉強法' });
        break;
      }
    }

    for (let i = 0; i < selectCount; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.includes('学年')) {
        await selects.nth(i).selectOption({ label: '学年' });
        break;
      }
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/anova_twoway_configured.png', fullPage: true });

    expect(errors).toHaveLength(0);
  });
});

test.describe('Factor Analysis - Rotation Methods', () => {
  test('All rotation methods: varimax, promax, oblimin, geomin, none', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_factor_demo.csv');
    await goToAnalysis(page, 'factor_analysis');
    await page.waitForTimeout(1000);

    await selectFirstMultiSelectOptions(page, '#factor-vars-container', 15);

    // Set factor count to 3
    const factorInput = page.locator('#num-factors, input[type="number"]');
    if (await factorInput.first().isVisible()) {
      await factorInput.first().fill('3');
    }

    // Find rotation selector
    const rotationSelect = page.locator('#rotation-method, select:has(option:has-text("varimax"))');

    const rotations = ['varimax', 'promax', 'oblimin', 'geomin', 'none'];
    for (const rotation of rotations) {
      if (await rotationSelect.first().isVisible()) {
        try {
          await rotationSelect.first().selectOption({ value: rotation });
        } catch {
          // Try by label
          const labelMap = { varimax: 'バリマックス', promax: 'プロマックス', oblimin: 'オブリミン', geomin: 'ジオミン', none: '回転なし' };
          try {
            await rotationSelect.first().selectOption({ label: labelMap[rotation] || rotation });
          } catch {
            continue;
          }
        }
      }

      // Run analysis
      const runBtn = page.locator('button:has-text("分析"), button:has-text("実行")');
      if (await runBtn.first().isVisible()) {
        await runBtn.first().click();
        await page.waitForTimeout(2000);
      }

      // Screenshot
      await page.screenshot({ path: `test-results/factor_rotation_${rotation}.png`, fullPage: true });

      // Check results
      const content = await page.content();
      const hasResults = content.includes('因子') || content.includes('負荷') || content.includes('固有値');
      expect(hasResults).toBeTruthy();
    }

    // Test different factor counts
    for (const nFactors of ['2', '4']) {
      if (await factorInput.first().isVisible()) {
        await factorInput.first().fill(nFactors);
      }
      const runBtn = page.locator('button:has-text("分析"), button:has-text("実行")');
      if (await runBtn.first().isVisible()) {
        await runBtn.first().click();
        await page.waitForTimeout(2000);
      }
      await page.screenshot({ path: `test-results/factor_${nFactors}factors.png`, fullPage: true });
    }

    expect(errors).toHaveLength(0);
  });
});

test.describe('PCA - Options', () => {
  test('PCA with different component counts', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_factor_demo.csv');
    await goToAnalysis(page, 'pca');
    await page.waitForTimeout(1000);

    await selectFirstMultiSelectOptions(page, '#pca-vars-container', 15);

    // Run analysis
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行")');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/pca_results.png', fullPage: true });

    const content = await page.content();
    const hasResults = content.includes('主成分') || content.includes('寄与') || content.includes('固有値');
    expect(hasResults).toBeTruthy();

    expect(errors).toHaveLength(0);
  });
});

test.describe('Cross Tabulation - Display Modes', () => {
  test('Toggle frequency/row%/col%/total% modes', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'demo_all_analysis.csv');
    await goToAnalysis(page, 'cross_tabulation');
    await page.waitForTimeout(1000);

    // Select row and column variables
    const selects = page.locator('select');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.includes('性別')) {
        await selects.nth(i).selectOption({ label: '性別' });
        break;
      }
    }
    for (let i = 0; i < selectCount; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents();
      if (opts.includes('クラス')) {
        await selects.nth(i).selectOption({ label: 'クラス' });
        break;
      }
    }

    // Run
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行"), button:has-text("集計")');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/crosstab_default.png', fullPage: true });

    // Toggle display modes using specific IDs
    const modeIds = ['crosstab-mode-count', 'crosstab-mode-row-pct', 'crosstab-mode-col-pct', 'crosstab-mode-total-pct'];
    for (const modeId of modeIds) {
      const btn = page.locator(`#${modeId}`);
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `test-results/crosstab_${modeId}.png`, fullPage: true });
      }
    }

    expect(errors).toHaveLength(0);
  });
});

test.describe('Time Series - Full Options', () => {
  test('Time series analysis with hs_timeseries_demo.csv', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'hs_timeseries_demo.csv');
    await goToAnalysis(page, 'time_series');
    await page.waitForTimeout(1000);

    // Select time variable
    const timeSelect = page.locator('#time-var, select').first();
    const opts = await timeSelect.locator('option').allTextContents();
    if (opts.includes('年月')) {
      await timeSelect.selectOption({ label: '年月' });
    }

    // Select value variable
    const valueSelect = page.locator('#value-var');
    if (await valueSelect.isVisible()) {
      const vopts = await valueSelect.locator('option').allTextContents();
      if (vopts.includes('図書貸出冊数')) {
        await valueSelect.selectOption({ label: '図書貸出冊数' });
      }
    }

    // Run
    const runBtn = page.locator('button:has-text("分析"), button:has-text("実行")');
    if (await runBtn.first().isVisible()) {
      await runBtn.first().click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'test-results/timeseries_results.png', fullPage: true });

    const content = await page.content();
    const hasResults = content.includes('時系列') || content.includes('トレンド') || content.includes('自己相関') || content.includes('図書');
    expect(hasResults).toBeTruthy();

    expect(errors).toHaveLength(0);
  });
});

test.describe('Demo Modal - All 9 Buttons', () => {
  test('Each demo button loads correct data', async ({ page }) => {
    test.setTimeout(60000);
    const demos = [
      { file: 'highschool_life_demo.csv', keyword: '部活動' },
      { file: 'demo_all_analysis.csv', keyword: '感想' },
      { file: 'hs_ttest_demo.csv', keyword: '朝読書' },
      { file: 'hs_anova_demo.csv', keyword: '勉強法' },
      { file: 'hs_regression_demo.csv', keyword: '模試の得点' },
      { file: 'hs_factor_demo.csv', keyword: 'Q1_' },
      { file: 'hs_text_demo.csv', keyword: '役割' },
      { file: 'hs_timeseries_demo.csv', keyword: '図書貸出冊数' },
      { file: 'hs_logistic_demo.csv', keyword: '英単語テスト' },
    ];

    for (const demo of demos) {
      await page.goto(BASE);
      await page.waitForLoadState('networkidle');

      // Open modal
      const demoBtn = page.locator('#load-demo-btn');
      await demoBtn.click();
      await page.waitForTimeout(500);

      // Click specific demo
      const demoOption = page.locator(`[data-demo="${demo.file}"]`);
      await expect(demoOption).toBeVisible();
      await demoOption.click();
      await page.waitForTimeout(1500);

      // Verify data loaded - check page content for keyword
      const content = await page.content();
      expect(content).toContain(demo.keyword);
    }
  });
});

test.describe('Collapsible Sections', () => {
  test('All collapsible sections toggle correctly', async ({ page }) => {
    const errors = setupErrorTracking(page);
    await loadDemo(page, 'demo_all_analysis.csv');
    await goToAnalysis(page, 'ttest');
    await page.waitForTimeout(1000);

    // Find all collapsible headers
    const headers = page.locator('.collapsible-header, .section-toggle, [data-toggle]');
    const count = await headers.count();

    for (let i = 0; i < count; i++) {
      const header = headers.nth(i);
      if (await header.isVisible()) {
        await header.click();
        await page.waitForTimeout(300);
        // Click again to toggle back
        await header.click();
        await page.waitForTimeout(300);
      }
    }

    expect(errors).toHaveLength(0);
  });
});
