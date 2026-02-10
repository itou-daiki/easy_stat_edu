# Regression Analysis Modules — Statistical Review Report

**Project:** Easy Stat Edu  
**Scope:** Simple regression (`regression_simple.js`), Multiple regression (`regression_multiple.js`, `helpers.js`, `visualization.js`)  
**Reviewed:** Statistical formulas, visualization, table output.

---

## Simple Regression (`js/analyses/regression_simple.js`)

### CRITICAL

*None.*

### WARNING

**[WARNING] js/analyses/regression_simple.js:39 — No guard for constant X (zero denominator)**  
  **Description:** If all x values are identical, `denominator` = Σ(xi−x̄)² = 0, so `b1 = numerator/denominator` yields `Infinity` (or NaN if numerator is 0), and subsequent stats (e.g. `seB1`, `tStat`) break.  
  **Expected:** Check `denominator === 0` (or very small) and show a clear error message (e.g. "説明変数の分散が0です。異なる値を含む変数を選んでください").  
  **Actual:** No check; division is performed unconditionally.

### INFO

**[INFO] js/analyses/regression_simple.js:98–104 — Intercept row omits SE, t, p**  
  **Description:** The coefficient table shows "-" for 切片 (Intercept) for 標準誤差, t値, p値.  
  **Expected:** Report intercept SE(b0) = Se×√(1/n + x̄²/Σ(xi−x̄)²), t = b0/SE(b0), and two-tailed p-value for completeness and APA-style reporting.  
  **Actual:** Only slope has SE, t, p; intercept has "-".

**[INFO] js/analyses/regression_simple.js — No prediction or confidence bands on scatter plot**  
  **Description:** The scatter plot shows the regression line and points but no confidence interval for the mean response or prediction interval for new observations.  
  **Expected:** Optionally show CI (mean response) and/or PI (prediction) bands (e.g. shaded or dashed) for educational clarity.  
  **Actual:** Only regression line and points; no intervals.

**[INFO] js/analyses/regression_simple.js:314–318 — Duplicate "主な指標" section**  
  **Description:** The collapsible "分析の概要・方法" contains two "主な指標" headings with overlapping content (R², 回帰係数, p値).  
  **Expected:** Single "主な指標" block with one clear list.  
  **Actual:** Two consecutive "主な指標" blocks; one is redundant.

---

### Verified correct (simple regression)

- **Slope and intercept (lines 33–40):** b1 = Σ(xi−x̄)(yi−ȳ) / Σ(xi−x̄)², b0 = ȳ − b1·x̄. ✓  
- **R² (lines 43–54):** R² = 1 − (RSS/TSS) = SSR/SST; equivalent to r² in simple regression. ✓  
- **Standard error of estimate (lines 57–59):** Se = √(SSE/(n−2)) = √(rss/df). ✓  
- **F-test (line 154):** APA note uses F(1, df) = t²; for simple regression F = MSR/MSE = t² when df1=1. ✓  
- **t-test for slope (lines 59–61):** SE(b1) = Se/√Σ(xi−x̄)², t = b1/SE(b1); two-tailed p from t CDF. ✓  
- **Residual plot:** Residuals vs fitted is implemented and drawn. ✓  

---

## Multiple Regression (`helpers.js`, `regression_multiple.js`, `visualization.js`)

### CRITICAL

*None.*

### WARNING

**[WARNING] js/analyses/regression_multiple/helpers.js:65,82 — `beta` may be a math.js Matrix; `.slice()` and `beta[i]` may be invalid**  
  **Description:** `beta = math.multiply(XTX_inv, XTy)` can return a math.js Matrix. The code uses `beta.slice(1)` and callers use `beta[0]`, `beta[i+1]`. math.js Matrices use `.get([i,j])` or `.valueOf()`/`.toArray()` for indexing, not `.slice()` or bracket index.  
  **Expected:** Ensure coefficient vector is a plain array before use, e.g. `const betaArr = Array.isArray(beta) ? beta : (beta.valueOf ? beta.valueOf().flat() : beta.toArray().flat());` and use `betaArr` for indexing and for `standardizedBeta = betaArr.slice(1).map(...)`.  
  **Actual:** Direct use of `beta` and `beta.slice(1)` without conversion; may work only if math.js returns an array in this context.

**[WARNING] js/analyses/regression_multiple/helpers.js:76 — `seBeta` may be Matrix; indexing in caller may fail**  
  **Description:** `seBeta = math.map(math.diag(...), math.sqrt)` can return a Matrix. In `regression_multiple.js`, `seBeta[0]` and `seBeta[i+1]` are used.  
  **Expected:** Convert to array before return, e.g. `const seBetaArr = Array.isArray(seBeta) ? seBeta : (seBeta.valueOf ? seBeta.valueOf().flat() : seBeta.toArray().flat());` and return `seBetaArr` (or document that callers must handle Matrix).  
  **Actual:** Returns math object as-is; indexing may be environment-dependent.

**[WARNING] js/analyses/regression_multiple/helpers.js:69–70 — RSS when `residuals` is a Matrix**  
  **Description:** `residuals = math.subtract(yClean, yPred)` can be a Matrix. `residuals.map(r => r * r)` uses math.js element-wise map; `math.sum(...)` of the result should be correct, but if `residuals` were ever a different type, `.map` could behave differently.  
  **Expected:** For robustness, flatten to array before squaring/sum, e.g. `const residArr = Array.isArray(residuals) ? residuals.flat() : residuals.toArray().flat(); const rss = residArr.reduce((s, r) => s + r * r, 0);` (or keep current approach and add a unit test with known data).  
  **Actual:** Relies on math.js `.map` and `math.sum` on matrix; generally correct but type-sensitive.

### INFO

**[INFO] js/analyses/regression_multiple/helpers.js — AIC and BIC not implemented**  
  **Description:** Task requested AIC/BIC.  
  **Expected:** AIC = n·ln(SSE/n) + 2(p+1), BIC = n·ln(SSE/n) + ln(n)·(p+1) (or equivalent parameter count).  
  **Actual:** Not computed or displayed.

**[INFO] js/analyses/regression_multiple — Residual diagnostics limited**  
  **Description:** Only residuals vs fitted is plotted. Normality (e.g. Q–Q plot) and homoscedasticity (e.g. scale–location or residuals vs leverage) are not provided.  
  **Expected:** Optional Q–Q plot of residuals and/or scale–location plot for teaching and diagnostics.  
  **Actual:** Single residual vs fitted plot per dependent variable.

**[INFO] js/analyses/regression_multiple/helpers.js — No condition index / multicollinearity beyond VIF**  
  **Description:** VIF is implemented; condition number (or tolerance = 1/VIF) is not.  
  **Expected:** Optionally report condition index of X (or tolerance) for multicollinearity.  
  **Actual:** Only VIF; sufficient for many uses, but condition index is a common addition.

**[INFO] js/analyses/regression_multiple.js:207 — APA table F df order**  
  **Description:** Note shows `F(k, n−k−1)`. Convention is F(df1, df2) with df1 = regression df, df2 = residual df, which matches (k, n−k−1).  
  **Actual:** Correct; no change needed. Left as INFO for verification only.

---

### Verified correct (multiple regression)

- **OLS (helpers.js 59–64):** β = (X′X)^{-1} X′y with design matrix [1, x1, …, xp]. ✓  
- **R² and adjusted R² (helpers.js 71–73):** R² = 1 − RSS/TSS; Adj R² = 1 − (1−R²)(n−1)/(n−p−1) with p = k. ✓  
- **F-test (helpers.js 75–77):** MSR = (TSS−RSS)/k, MSE = RSS/(n−k−1), F = MSR/MSE; p = 1 − F.cdf(F, k, n−k−1). ✓  
- **t-tests for coefficients (helpers.js 76, 127–131):** SE(β) from √(MSE·diag((X′X)^{-1})), t = β/SE(β), two-tailed p. ✓  
- **VIF (helpers.js 85–101):** For each predictor j, R²_j from regressing x_j on other predictors; VIF_j = 1/(1−R²_j). ✓  
- **Standardized coefficients (helpers.js 79–82):** β_std_j = b_j · (s_xj / s_y). ✓  
- **Residual vs fitted (visualization.js):** Implemented per dependent variable. ✓  
- **Path diagram (visualization.js):** Uses standardized betas; arrows for |β| ≥ 0.1. ✓  

---

## Summary Table

| Severity   | Count | Files |
|-----------|-------|--------|
| CRITICAL  | 0     | — |
| WARNING   | 4     | regression_simple.js (1), helpers.js (3) |
| INFO      | 6     | regression_simple.js (3), helpers.js (2), regression_multiple (1 verified) |

**Recommendations (priority):**

1. **Simple regression:** Add a check for zero (or near-zero) denominator of the slope and show a clear user message.  
2. **Multiple regression:** Normalize `beta` and `seBeta` to plain arrays in `helpers.js` (e.g. after OLS and after `math.map(..., math.sqrt)`) so that `beta[i]`, `beta.slice(1)`, and `seBeta[i]` are reliable across environments.  
3. **Optional:** Add intercept SE/t/p in simple regression; add optional CI/PI bands; add AIC/BIC and extra residual plots (Q–Q, scale–location) for multiple regression; remove duplicate "主な指標" in the simple regression UI.
