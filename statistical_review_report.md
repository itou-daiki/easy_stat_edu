# Statistical Utility Files — Review Report

**Project:** Easy Stat Edu  
**Files reviewed:** `js/utils/stat_distributions.js`, `js/utils.js`, `js/analyses/constants.js`  
**Scope:** Statistical accuracy, edge cases, documentation, numerical stability.

---

## CRITICAL

*None.* The core statistical formulas (Normal PDF/CDF, Studentized Range CDF, Holm correction, Levene’s test, constants) match standard definitions. No incorrect formulas or systematically wrong results were found.

---

## WARNING

### js/utils/stat_distributions.js

**[WARNING] js/utils/stat_distributions.js:79–81 — No validation for `k` (number of groups) in `studentizedRangeCDF`**  
  - **Expected:** For \(k < 2\) the studentized range is degenerate (no “range” of one group). Either return a defined value (e.g. 0 or 1) or document/validate so callers do not pass \(k < 2\).  
  - **Actual:** Only `q <= 0` and `df <= 0` are handled; \(k = 1\) or \(k < 2\) is not checked. `calculateTukeyP` does guard `k < 2` and returns 1.0, but `studentizedRangeCDF(0.5, 1, 10)` would still run the double integral with \(k = 1\).  
  - **Suggestion:** At the top of `studentizedRangeCDF`, add `if (k < 2) return (q <= 0) ? 1 : 0;` (or equivalent) and document that \(k \geq 2\) is required.

**[WARNING] js/utils/stat_distributions.js:79–81 — No handling of non-finite or NaN inputs**  
  - **Expected:** NaN/Infinity in `q`, `k`, or `df` should not produce silent NaN propagation (e.g. in p-values).  
  - **Actual:** If any argument is NaN or Infinity, the function runs and can return NaN; `calculateTukeyP` then does `Math.max(0, Math.min(1, p))` which leaves `p` as NaN.  
  - **Suggestion:** At the start of `studentizedRangeCDF` and `calculateTukeyP`, return a safe value (e.g. NaN or 0/1 as appropriate) when `!Number.isFinite(q) || !Number.isFinite(k) || !Number.isFinite(df)` (and similarly for other exported functions that take numeric args).

**[WARNING] js/utils/stat_distributions.js:39–56 — `getGammaLn` / `lanczosGammaLn` undefined for non-positive or zero argument**  
  - **Expected:** \(\Gamma(z)\) (and thus \(\ln\Gamma(z)\)) is not defined for \(z \leq 0\) (or has poles). Callers (e.g. `outerPDF` with small or invalid `df`) could pass `df/2 <= 0`.  
  - **Actual:** No check for `n <= 0` or non-finite `n`; `lanczosGammaLn` can produce nonsensical or NaN values for \(z \leq 0\).  
  - **Suggestion:** In `getGammaLn(n)` (and optionally in `lanczosGammaLn`), return NaN (or throw) when `n <= 0` or `!Number.isFinite(n)`.

**[WARNING] js/utils/stat_distributions.js:172–174 — `performHolmCorrection` does not validate p-values**  
  - **Expected:** Adjusted p-values should be in \([0,1]\); invalid inputs (e.g. NaN, negative, > 1) should be handled or rejected.  
  - **Actual:** Uses `item.p` directly. If any `p` is NaN, negative, or > 1, `adjP` can be NaN or outside \([0,1]\); sorting by `a.p - b.p` with NaN can give unstable order.  
  - **Suggestion:** Filter or clamp invalid p-values (e.g. treat NaN as 1, clamp to \([0,1]\)), or document that callers must pass valid p-values and add a guard that returns a copy with `p_holm: NaN` or skips invalid entries.

---

### js/utils.js

**[WARNING] js/utils.js:84–127 — `calculateLeveneTest`: division by zero when \(df_w = 0\) or \(MS_w = 0\)**  
  - **Expected:** When there is no within-group variance (e.g. one observation per group, or all values equal within each group), the F-statistic is undefined; the function should not return F = Infinity or p = 0 without signaling.  
  - **Actual:** `dfw = N - k`; if each group has one observation, \(N = k\) so \(dfw = 0\), and `MSw = SSw / dfw` is NaN (or Infinity if SSw > 0). Then `F = MSb / MSw` and `p = 1 - jStat.centralF.cdf(F, dfb, dfw)` can be NaN or invalid.  
  - **Suggestion:** After computing `dfw` and `MSw`, if `dfw <= 0` or `MSw === 0` (or very small, e.g. `< 1e-15`), return a dedicated result, e.g. `{ F: NaN, p: NaN, significant: false }` or an object with a flag like `degenerate: true`, and document this in JSDoc.

**[WARNING] js/utils.js:84–92 — `calculateLeveneTest`: empty or single-element groups produce NaN**  
  - **Expected:** Empty groups should be rejected or handled explicitly (e.g. skip or return invalid result).  
  - **Actual:** If any `g` is empty, `jStat.mean(g)` is NaN; then `groupMeans`, `deviations`, `grandMeanDev`, SSb, SSw, F, and p can all be NaN. No check for empty or too-small groups.  
  - **Suggestion:** At the start, filter out groups with length \(< 2\) (or require at least 2 per group for Levene), or return a clear invalid/error result when any group has fewer than 2 observations.

**[WARNING] js/utils.js:619–436 — `createPairSelector`: duplicate DOM appends**  
  - **Expected:** `inputArea` and `dropdown` should be appended to `wrapper` once; then `wrapper` appended to `container` once.  
  - **Actual:** The block `wrapper.appendChild(inputArea); wrapper.appendChild(dropdown); container.appendChild(wrapper);` appears twice (lines 434–436 and 437–439), so the same nodes are appended twice and the second pair of appends moves the nodes (duplicate UI or wrong structure).  
  - **Suggestion:** Remove the duplicate block (keep a single append sequence).

**[WARNING] js/utils.js:769–772 — `InterpretationHelper.evaluatePValue`: NaN/negative p not distinguished**  
  - **Expected:** Invalid p (NaN or negative) should not be reported as “n.s.” as if it were a valid non-significant result.  
  - **Actual:** For NaN or negative p, all conditions are false and the function returns the last branch (`text: "n.s.", isSignificant: false`).  
  - **Suggestion:** Add an initial check: if `typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1`, return a dedicated result (e.g. `{ text: '—', isSignificant: false, stars: '', invalid: true }`) so callers or UI can handle invalid p.

---

### js/analyses/constants.js

**[WARNING] js/analyses/constants.js:43–48 — `getSignificanceSymbol(p)` treats negative p as strong significance**  
  - **Expected:** p-values are in \([0,1]\). Negative or invalid p should not be mapped to a significance symbol.  
  - **Actual:** For \(p < 0\) (e.g. -0.5), the condition `p < SIGNIFICANCE_LEVELS.STRONG` is true, so the function returns `'***'`.  
  - **Suggestion:** At the start, if `typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1`, return `SIGNIFICANCE_SYMBOLS.NONE` or a sentinel value, and document the valid range.

---

## INFO

### js/utils/stat_distributions.js

**[INFO] js/utils/stat_distributions.js:11–14 — Normal PDF: formula correct**  
  - \(\phi(x) = \frac{1}{\sqrt{2\pi}} e^{-x^2/2}\). Code uses `Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI)`. Correct.

**[INFO] js/utils/stat_distributions.js:58–68 — Normal CDF approximation**  
  - Abramowitz & Stegun 26.2.17 style rational approximation is used; sign handling for \(x \leq 0\) (return `prob`) and \(x > 0\) (return `1 - prob`) is correct for the standard normal CDF.

**[INFO] js/utils/stat_distributions.js:70–77 — Studentized Range CDF**  
  - Double integral structure (inner over \(z\), outer over \(s = \chi/\sqrt{\nu}\)) and the chi distribution density in log-space match the standard formulation (e.g. Wikipedia / scipy). Simpson weights (1, 4, 2, …) are applied correctly.

**[INFO] js/utils/stat_distributions.js:166–175 — Holm–Bonferroni**  
  - Adjusted p-value \(\tilde{p}_j = \min(1, p_j \cdot (m - j + 1))\) and monotonicity \(\tilde{p}_j \geq \tilde{p}_{j-1}\) are implemented correctly. Original order is restored via `originalIndex`.

**[INFO] js/utils/stat_distributions.js:26–37 — Lanczos coefficients**  
  - Coefficients match a standard Lanczos approximation for \(\ln\Gamma\); suitable for positive real arguments (with the WARNING above for \(z \leq 0\)).

**[INFO] js/utils/stat_distributions.js:57–68 — `normalCDF` at x = 0**  
  - For \(x = 0\), code returns `prob`; the approximation gives tail \(\approx 0.5\), so \(\Phi(0) \approx 0.5\). Correct.

**[INFO] Style / docs**  
  - JSDoc on `studentizedRangeCDF`, `calculateTukeyP`, and `performHolmCorrection` is clear. Adding `@throws` or `@returns` for edge cases (e.g. NaN, \(k < 2\)) would make the contract clearer.

---

### js/utils.js

**[INFO] js/utils.js:106–122 — Levene’s test (formula)**  
  - Uses group means (not median), so this is classic Levene. SSb / SSw and dfb / dfw for one-way ANOVA on absolute deviations are correct. Using `jStat.centralF.cdf` for the p-value is correct.

**[INFO] js/utils.js:52–62 — `toHtmlTable`**  
  - Uses `d.toFixed ? d.toFixed(2) : d` so non-numbers are not forced to `.toFixed(2)`. Safe. If desired, you could explicitly handle NaN/Infinity for display (e.g. show "—" or "NaN").

**[INFO] js/utils.js:70–76 — `getEffectSizeInterpretation(d)`**  
  - Cohen’s d cutoffs (0.2, 0.5, 0.8) are standard. If `d` is NaN, the result is "効果はほとんどない (|d| = NaN)"; consider validating `d` and returning a dedicated message for invalid/NaN.

**[INFO] js/utils.js:301–306 — `renderSummaryStatistics`**  
  - Uses `jStat.stdev(..., true)` for sample standard deviation; correct for sample stats. Single-value columns will have stdev 0; acceptable.

**[INFO] js/utils.js:534–536 — `createPairSelector`**  
  - Duplicate append block is a logic/style bug (already in WARNING). No statistical content.

---

### js/analyses/constants.js

**[INFO] js/analyses/constants.js:14–23, 29–36 — Significance levels and symbols**  
  - Standard choices (0.001, 0.01, 0.05, 0.10 and ***, **, *, †, n.s.).

**[INFO] js/analyses/constants.js:58–72 — MIN_SAMPLE_SIZE**  
  - T_TEST: 3, ANOVA: 2 are minimal; in practice larger samples are preferred. Document that these are minimums for “runnable” analyses, not necessarily sufficient for power or assumptions.

**[INFO] js/analyses/constants.js:81–124 — Effect size thresholds**  
  - Cohen’s d (0.2, 0.5, 0.8), η² (0.01, 0.06, 0.14), ω², correlation (0.1, 0.3, 0.5), Cramer’s V (df-dependent) match common conventions.

**[INFO] js/analyses/constants.js:158–164 — Z_CRITICAL**  
  - 1.645, 1.96, 2.576, 3.291 for two-sided α = 0.10, 0.05, 0.01, 0.001 are correct (3.291 ≈ 3.2905).

**[INFO] js/analyses/constants.js:143–148 — `getEffectSizeLabel`**  
  - If `value` is NaN, all thresholds fail and returns '無視可能'. Consider returning a distinct label for NaN/invalid so callers can handle it.

---

## Summary

| Severity | Count |
|----------|--------|
| CRITICAL | 0 |
| WARNING  | 8 |
| INFO     | 16+ |

**Recommended next steps:**  
1. Fix **division by zero / degenerate Levene** (dfw ≤ 0, MSw = 0) and **empty/small groups** in `calculateLeveneTest`.  
2. Add **input validation** (non-finite, NaN, \(k < 2\), p not in [0,1]) in `stat_distributions.js` and `constants.js`.  
3. Remove **duplicate append** in `createPairSelector`.  
4. Optionally add **explicit handling of NaN/invalid p** in `evaluatePValue` and `getSignificanceSymbol` so the UI can show “invalid” instead of “n.s.”.
