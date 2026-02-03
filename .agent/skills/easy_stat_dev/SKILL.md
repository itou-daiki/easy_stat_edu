---
name: Easy Stat Edu Developer
description: Expert guidance, MCP workflow, and patterns for the Easy Stat Edu project.
---

# Easy Stat Edu Developer Skill

This skill outlines the architecture, development patterns, testing strategies, and **MCP workflow** for the **Easy Stat Edu** project. Follow these guidelines to ensure consistency and efficiency.

## 1. MCP Workflow & Agentic Behavior

Leverage your specialized MCP tools to act as an autonomous, intelligent partner.

### **0. MANDATORY: Planning with Files**
**Before creating any plan or writing code, you MUST use the `Planning with Files` skill.**
-   **Always** read relevant files (`view_file`, `view_file_outline`) to verify the current state.
-   Do not rely on your memory or assumptions.
-   *Reference*: `planning-with-files/SKILL.md`

### **Sequential Thinking (Complex Logic)**
When facing multi-step analytical problems (e.g., implementing a new ANOVA logic with multiple error terms):
1.  **Call `sequential-thinking`**: Break the problem down.
    *   *Step 1*: Understand the statistical formula (SS, df, MS, F).
    *   *Step 2*: Map formula terms to code variables (`cleanData`, `factors`).
    *   *Step 3*: Plan the data transformation (e.g., "Pivot long to wide?").
    *   *Step 4*: Verification strategy.
2.  **Iterate**: If a test fails, trigger a new thought sequence to hypothesize the root cause (e.g., "Is it a floating-point error or a wrong degree of freedom?").

### **Serena (Codebase Navigation)**
Before editing any file, **understand the context**:
1.  **Exploration**: Use `get_symbols_overview` or `find_symbol` to see available functions in `js/utils.js` or `js/analyses/*.js`.
2.  **References**: If modifying a core utility (e.g., `createVariableSelector`), use `find_referencing_symbols` to check impact on other analyses.
3.  **Search**: Use `search_for_pattern` to find usage of specific HTML IDs or CSS classes across the project.

### **Context7 (Documentation)**
If you are unsure about a library's specific syntax:
1.  **Call `context7`**: "How to calculate non-central F distribution in jStat?" or "Plotly.js grouped bar chart with error bars syntax".
2.  **Don't Guess**: Verify the API before implementing, especially for `jStat` and `Plotly`.

---

## 2. Project Architecture

*   **Type**: Client-side SPA (Vanilla JS + HTML). No build step (no Webpack/Vite).
*   **Entry**: `index.html` loads all libraries and `js/main.js` (module entry).
*   **Libraries (Global Scope)**:
    *   `jStat` (Statistics)
    *   `Plotly` (Visualization)
    *   `XLSX` (Excel import/export)
    *   `math` (Math.js)
    *   `vis` (Network graphs)

### Directory Structure
*   `js/analyses/`: Individual analysis modules (must export `render()`).
*   `js/utils.js`: Core UI/Logic helpers. **Check this file first** for reusable functions.
*   `css/style.css`: Main styling.
*   `tests/`: Playwright end-to-end tests.

---

## 3. Development Patterns

### Common UI Helpers (`js/utils.js`)
*   `showLoadingMessage(msg)` / `hideLoadingMessage()`: Manage global spinner.
*   `toggleCollapsible(header)`: Handle accordion UI.
*   `toHtmlTable(headers, rows, data)`: Quick HTML table generation.
*   `createVariableSelector(...)`: Standardize variable input UI.

### Coding Standards
*   **Japanese UI**: All user-facing text must be Japanese.
*   **English Internals**: Variable names and comments should be English.
*   **Error Handling**: Use `showLoadingMessage` for progress and `alert` (or custom UI) for errors.
*   **Async Rendering**: Use `setTimeout(() => { ... }, 0)` when rendering heavy Plotly charts to allow the DOM to update first.

---

## 4. Testing Strategy (Playwright)

### Test Template
```javascript
const { test, expect } = require('@playwright/test');
const path = require('path');

test('Feature Verification', async ({ page }) => {
    // 0. Console Debugging
    page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));

    // 1. Initial Load & Wait
    await page.goto('http://127.0.0.1:8080/');
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 10000 });

    // 2. Data Upload
    const filePath = path.join(__dirname, '../datasets/demo.xlsx');
    await page.locator('#main-data-file').setInputFiles(filePath);
    await expect(page.locator('#dataframe-container')).toBeVisible({ timeout: 10000 });

    // 3. Navigation
    await page.click('.feature-card[data-analysis="your_analysis"]');
    await expect(page.locator('#analysis-area')).toBeVisible();

    // 4. Interaction (Handle async UI updates)
    await page.selectOption('#var-selector', 'ColumnName');
    
    // 5. Execution
    await page.click('#run-btn');

    // 6. Assertions
    // Check Table
    const table = page.locator('#results-table');
    await expect(table).toContainText('Expected Value');
    
    // Check Plotly
    await expect(page.locator('.js-plotly-plot')).toBeVisible();
});
```

### Debugging Tips
*   **Console Logs**: Always add `page.on('console', ...)` to see browser errors in the terminal.
*   **Screenshots**: If a test fails ("element not visible"), use `await page.screenshot({ path: 'debug.png' })` to see the state.
*   **Timeouts**: Initial load and heavy calcs might take time. Increase timeouts if needed (`{ timeout: 30000 }`).
