# CLAUDE.md - Development Guide for easyStat

## Project Overview

easyStat is a browser-based educational statistical analysis platform written in pure JavaScript (ES6+).
All computation happens client-side. No backend server or external API calls for data processing.

## Quick Start

```bash
npm install
npx http-server . -p 8081   # Start local dev server
npx playwright test          # Run all tests
```

## Architecture

### Module Loading

- Entry point: `index.html` loads `js/main.js` as ES module
- `main.js` dynamically imports analysis modules: `./analyses/${analysisType}.js`
- The `analysisType` comes from `data-analysis` attribute on feature cards in `index.html`
- Each analysis module exports a `render(container, currentData, dataCharacteristics)` function

### File Organization

| Path | Purpose |
|------|---------|
| `js/main.js` | App entry point, file loading, module routing |
| `js/utils.js` | Shared utilities: Levene test, APA tables, data overview, interpretation helpers |
| `js/utils/stat_distributions.js` | Tukey distribution, Holm correction, Gamma function |
| `js/analyses/*.js` | Analysis modules (LIVE code, each exports `render()`) |
| `js/analyses/*/helpers.js` | Computation helpers for each analysis |
| `js/analyses/*/visualization.js` | Chart rendering for each analysis |

### Important: ANOVA Module Structure

The monolithic files are the **LIVE code**:
- `js/analyses/anova_one_way.js` - One-way ANOVA (independent + repeated measures)
- `js/analyses/anova_two_way.js` - Two-way ANOVA (independent, within, mixed)

The subfolder files (`anova_one_way/*.js`, `anova_two_way/*.js`) are **dead code** (never loaded).
Do NOT modify the subfolder versions thinking they are active.

### External Libraries (loaded via CDN in index.html)

- `jStat` - Statistical calculations (global scope)
- `math.js` - Matrix operations (global scope)
- `Plotly.js` - Interactive charts (global scope)
- `SheetJS` - Excel/CSV parsing (global scope)
- `kuromoji.js` - Japanese morphological analysis

## Testing

### Framework
Playwright (E2E + unit tests via browser context)

### Test Categories

```bash
# Unit tests (statistical logic validation)
npx playwright test tests/unit/

# Accuracy verification (known-answer tests)
npx playwright test tests/verification/

# E2E smoke tests
npx playwright test tests/smoke_tests.spec.ts

# Visual verification
npx playwright test tests/visual_verification_all.spec.ts

# Full suite
npx playwright test
```

### Writing Tests

Tests run in Chromium via Playwright. For testing statistical logic:
- Use `page.goto('/js/analyses/filename.js')` to read source and validate patterns
- Use `page.evaluate()` for in-browser computation tests (jStat available after page load)
- See `tests/unit/statistical_logic_validation.spec.ts` for examples

## Statistical Implementation Notes

### Key Formulas and Conventions

| Statistic | Convention Used |
|-----------|----------------|
| Standard deviation | Sample SD (n-1 divisor) via `jStat.stdev(data, true)` |
| Levene's test | Brown-Forsythe variant (median-based, robust to non-normality) |
| Welch t-test | Default for independent samples (unequal variances assumed) |
| Cohen's d (independent) | Pooled SD: `\|mean1-mean2\| / sqrt(((n1-1)*s1^2 + (n2-1)*s2^2)/(n1+n2-2))` |
| Cohen's d_z (paired) | `\|mean_diff\| / SD_diff` (labeled as d_z to distinguish from Cohen's d) |
| GG epsilon | `[trace(S_tilde)]^2 / [(k-1) * trace(S_tilde^2)]` where S_tilde is double-centered cov matrix |
| Skewness | Fisher's adjusted: `n/((n-1)(n-2)) * sum((x-mean)/s)^3`, requires n >= 3 |
| Kurtosis | Excess kurtosis (Fisher's adjusted), requires n >= 4 |
| Significance symbols | `** p<.01`, `* p<.05`, `† p<.10`, `n.s.` (consistent across all tests) |
| Mann-Whitney Z | Reported as \|Z\| (absolute value for two-tailed test) |
| t-stat display | Always report \|t\| (absolute value) for two-tailed tests (paired, one-sample) |
| p-value display | Use `< .001` format when p < 0.001 (never show `0.000`) |
| Regression intercept | Full statistics (SE, t, p) reported for both intercept and slope |
| Yates' correction | Applied for 2x2 chi-square tables |

### Common Pitfalls

1. **jStat.stdev()**: Always pass `true` for sample SD: `jStat.stdev(data, true)`. Without `true`, it computes population SD.
2. **jStat scope**: jStat is loaded via CDN as a global. It is NOT available in Node.js tests without explicit import.
3. **ANOVA modules**: Only modify `anova_one_way.js` and `anova_two_way.js` (not the subfolder versions).
4. **Dynamic imports**: Analysis modules are loaded lazily. Syntax errors are caught at runtime, not build time.
5. **Effect size labeling**: Paired t-test uses d_z (not generic d). Independent t-test uses Cohen's d.
6. **createPlotlyConfig()**: Returns a flat config object (not `{layout, config}`). Pass directly as 4th arg to `Plotly.newPlot()`.
7. **PCA vs Factor Analysis terminology**: PCA uses "主成分負荷量" (component loadings), Factor Analysis uses "因子負荷量" (factor loadings).
8. **Rotation labels**: Factor analysis supports varimax, promax, oblimin, geomin, none. Use lookup tables, not binary ternary.
9. **Negative intercept display**: Use conditional sign `b0 >= 0 ? '+' : '-'` with `Math.abs(b0)` to avoid `+ -1.234`.
10. **Null guards for p-value styling**: In ANOVA tables, always check `src.p !== null &&` before `src.p < 0.05` to avoid Error rows getting styled (JavaScript coerces `null` to `0` in comparisons).
11. **HTML escaping in legends**: Use `&lt;` not `<` in significance legends within HTML template literals.

## Code Style

- Japanese comments and UI labels throughout
- No build step (vanilla JS, no transpilation)
- ES6 module syntax (`import`/`export`)
- HTML generated via template literals in JS
- APA-style tables generated via `generateAPATableHtml()` from utils.js
