# EDA & Correlation Module Review Report

**Project:** Easy Stat Edu  
**Scope:** EDA module (eda.js, descriptive.js, visualization.js) and Correlation module (correlation.js, correlation/visualization.js)  
**Focus:** Statistical accuracy, visualization correctness, table output

---

## CRITICAL (wrong formula / results)

### 1. Skewness — division by zero for n = 2

**Files:** `js/analyses/eda.js` (lines 8–16), `js/analyses/eda/descriptive.js` (lines 19–27)

**Description:** The skewness formula uses the factor `n / ((n - 1) * (n - 2))`. For **n = 2** the denominator is 0, so the result is **Infinity** or **NaN**.

**Expected:** Return a sentinel (e.g. `NaN` or `0`) or skip skewness when `n < 3`, and document that sample skewness is undefined for n &lt; 3.

**Actual:** No check on `n`; only `stdev === 0` is handled. With n = 2 and non-zero variance, the code divides by zero.

**Suggested fix:**

```javascript
if (n < 3 || stdev === 0) return NaN; // or 0, and document
```

---

### 2. Kurtosis — division by zero for n ≤ 3

**Files:** `js/analyses/eda.js` (lines 18–29), `js/analyses/eda/descriptive.js` (lines 39–49)

**Description:** The kurtosis formula uses denominators `(n - 1)(n - 2)(n - 3)` and `(n - 2)(n - 3)`. For **n = 3** both are 0; for **n = 2** they are 0 or negative. This yields **NaN** or **Infinity**.

**Expected:** Return a sentinel or skip kurtosis when `n < 4`, and document that sample excess kurtosis is not defined for n &lt; 4.

**Actual:** No guard on `n`; only `stdev === 0` is checked.

**Suggested fix:**

```javascript
if (n < 4 || stdev === 0) return NaN; // or 0, and document
```

---

## WARNING (edge cases / potential bugs)

### 3. Summary table standard deviation — population vs sample

**Files:** `js/analyses/eda.js` (lines 83–84, 322–323), `js/analyses/eda/descriptive.js` (lines 111–112), `js/analyses/eda/visualization.js` (lines 172–173, 179–180)

**Description:** The **displayed** standard deviation in the summary table and in the numeric-viz stats box uses `jstat.stdev()` with **no** second argument. In jStat, `stdev(arr, flag)` uses **flag = true** for **sample** (n−1) and **false** for **population** (n). Calling `.stdev()` with no argument passes `undefined` → treated as false → **population** SD is shown.

**Expected:** For sample data, the table and viz should show **sample** standard deviation (n−1) for consistency with skewness/kurtosis and with typical textbook “標準偏差” in the sample context.

**Actual:** Table and numeric-viz box show **population** SD; skewness/kurtosis internally use **sample** SD via `jStat.stdev(data, true)`.

**Suggested fix:** Use sample SD everywhere for display, e.g. `jstat.stdev(true)` (and equivalent in visualization.js), and add a short comment or tooltip that “標準偏差” is the sample SD.

---

### 4. Scatter matrix — diagonal histogram includes missing values

**File:** `js/analyses/correlation.js` (lines 395–404)

**Description:** For the diagonal (histogram) cells, data is built as `plotData.map(row => row[varRow])` with **no** filtering of `null`, `undefined`, or `NaN`. Rows with missing values for that variable are still included (as NaN), which can distort the histogram or cause Plotly to drop/coerce values in an opaque way.

**Expected:** Use only valid numeric values for the histogram, e.g.  
`.filter(v => v != null && !isNaN(v))` (or filter at the row level so lengths match).

**Actual:** Raw `row[varRow]` values are passed to the histogram trace.

**Suggested fix:**

```javascript
const histValues = plotData.map(row => row[varRow]).filter(v => v != null && !isNaN(v));
traces.push({
    x: histValues,
    type: 'histogram',
    ...
});
```

---

### 5. Spearman rank correlation not implemented

**File:** `js/analyses/correlation.js` (and correlation/visualization.js)

**Description:** The correlation module computes only **Pearson** r (`jStat.corrcoeff`). There is no option for **Spearman** rank correlation, and no UI or table column for it. jStat provides `jStat.spearmancoeff(arr1, arr2)`.

**Expected:** Either implement Spearman (and optionally show both Pearson and Spearman in the table/heatmap) or clearly document that only Pearson is used.

**Actual:** Only Pearson is computed and shown.

**Suggestion:** Add an option (e.g. “Pearson / Spearman”) and, when Spearman is selected, use rank data and `jStat.spearmancoeff`; p-values for Spearman would need a different (permutation or tabulated) approach for small n.

---

### 6. No confidence interval for correlation

**File:** `js/analyses/correlation.js`

**Description:** The report shows r and p-value but **no confidence interval** for the correlation (e.g. 95% CI using Fisher z-transformation).

**Expected:** Optionally show e.g. “r = 0.72, 95% CI [0.58, 0.82], p &lt; .001” for better interpretation.

**Actual:** Only r and p-value (and significance stars) are shown.

**Suggestion:** Add a helper that computes Fisher z, SE(z), and back-transforms to get CI for r, and display it in the table or in the “結果の解釈” section.

---

### 7. Correlation p-value when |r| = 1

**File:** `js/analyses/correlation.js` (lines 41–48)

**Description:** When `Math.abs(r) === 1`, the code sets `pValues[i][j] = 0`. The t-statistic `t = r * sqrt((n-2)/(1-r^2))` is undefined (division by zero), so setting p = 0 is a convention but could be documented (perfect correlation → p “effectively” 0).

**Expected:** Either keep p = 0 and document, or set p to a small constant / “&lt; .001” to avoid implying an exact zero.

**Actual:** p = 0 is set; no comment in code or UI.

**Suggestion:** Add a one-line comment that for |r| = 1 the test is degenerate and p is set to 0 by convention.

---

## INFO (minor improvements)

### 8. Categorical mode — only first mode shown

**Files:** `js/analyses/eda.js` (lines 154–155), `js/analyses/eda/descriptive.js` (lines 182–184)

**Description:** Mode is taken as `Object.keys(valueCounts).find(key => valueCounts[key] === maxCount)`, which returns only the **first** key with the maximum count. If several categories tie for the maximum frequency, only one is shown.

**Expected:** Either list all modes (e.g. “A, B”) or state “最頻値（1つを表示）” so users know ties exist.

**Actual:** Single value shown; no indication of ties.

---

### 9. Quartile definition

**Files:** `js/analyses/eda.js`, `js/analyses/eda/descriptive.js`, `js/analyses/eda/visualization.js`

**Description:** Q1/Q3 come from `jStat.quartiles()` which uses  
`_arr[Math.round(arrlen/4)-1]` and `_arr[Math.round(arrlen*3/4)-1]`. This is one of several valid quartile definitions (similar to a “Type 3” style). Not wrong, but different from “min, median of lower half” (Type 2) or linear interpolation (Type 7).

**Expected:** No change required; optionally document in the “分析の概要” that quartiles are computed with jStat’s default (round-based) method.

**Actual:** No mention of quartile method.

---

### 10. Skewness and kurtosis formulas — correct

**Files:** `js/analyses/eda.js`, `js/analyses/eda/descriptive.js`

**Description:**  
- **Skewness:** Uses sample SD and the adjusted factor `n / ((n - 1)(n - 2)) * sum(((x - mean)/s)^3)`, which matches the usual **Fisher–Pearson** sample skewness.  
- **Kurtosis:** Uses sample SD, the standard fourth-moment term, and subtracts the correction so that the result is **excess kurtosis** (0 for normal).  
So aside from the small-n guards above, the formulas are correct.

---

### 11. Pearson r and p-value in correlation module — correct

**File:** `js/analyses/correlation.js` (lines 36–48)

**Description:**  
- Pearson r is computed with `jStat.corrcoeff(x, y)`, which uses sample covariance and sample SDs (flag=1) → correct sample r.  
- p-value uses `t = r * sqrt((n-2)/(1-r^2))`, df = n−2, and two-tailed `2 * P(T <= -|t|)` → standard test for H0: ρ = 0.  
Listwise deletion for missing values is applied when building pairs. Logic is correct.

---

### 12. Heatmap color scale — appropriate

**Files:** `js/analyses/correlation.js` (lines 239–256), `js/analyses/correlation/visualization.js` (lines 19–34)

**Description:** Heatmap uses `colorscale: 'RdBu'` with `zmin: -1`, `zmax: 1`, which is appropriate for correlation (symmetric, bounded). Colorbar title “相関係数” is clear.

---

### 13. Scatter matrix layout — correct

**File:** `js/analyses/correlation.js` (lines 328–392)

**Description:**  
- Diagonal: histogram of `variables[i]`.  
- Upper triangle: correlation text for (variables[i], variables[j]) with matrix[i][j].  
- Lower triangle: scatter of x = variables[j], y = variables[i].  
Variable indexing and placement match the correlation matrix. Layout and domains are consistent.

---

### 14. EDA two-variable scatter (numeric×numeric) — correlation label

**Files:** `js/analyses/eda.js` (lines 406–416), `js/analyses/eda/visualization.js` (lines 306–316)

**Description:** Scatter plot shows “相関係数” using `jStat.corrcoeff(x, y)` (Pearson). No p-value or CI is shown here; adding them (or a tooltip) would improve interpretability but is optional.

---

## Summary table

| Severity  | Count | Topics |
|-----------|-------|--------|
| CRITICAL  | 2     | Skewness/kurtosis for n = 2 or n ≤ 3 (division by zero) |
| WARNING   | 5     | Table/viz SD population vs sample; scatter-matrix histogram missing filter; no Spearman; no CI for r; p when \|r\|=1 |
| INFO      | 7     | Mode ties; quartile definition; skew/kurtosis formulas correct; Pearson/p-value correct; heatmap; scatter matrix layout; EDA scatter correlation label |

---

**Recommendation:** Fix the two CRITICAL items (small-n guards for skewness and kurtosis) first. Then align the displayed standard deviation with sample SD and filter diagonal histogram data in the scatter matrix. Adding Spearman and a correlation CI would improve the correlation module from both a statistical and an educational perspective.
