# Review Report: Text Mining, Time Series, Data Processing, Analysis Support

**Project:** Easy Stat Edu  
**Scope:** `js/analyses/text_mining.js`, `js/analyses/text_mining/helpers.js`, `js/analyses/text_mining/visualization.js`, `js/analyses/time_series.js`, `js/analyses/data_processing.js`, `js/analyses/analysis_support.js`

---

## Text Mining

### 1. `js/analyses/text_mining.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **CRITICAL** | text_mining.js:— | **TF-IDF not implemented.** Only raw word frequency is used for the word cloud and for selecting “top” words. No TF-IDF formula (e.g. tf(t,d) * log(N/df(t))) is computed or displayed. |
|  |  | **Expected:** Option or view using TF-IDF (e.g. tf(t,d) * log(N/df(t)) or a common variant) for term importance. |
|  |  | **Actual:** Word cloud and network are driven solely by raw counts (`counts[w]` from `allWords`). |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **WARNING** | text_mining.js:356–383 | **Co-occurrence is sentence-based (Jaccard on sentence presence), not window-based.** Two words are linked only if they appear in the same sentence; proximity within the sentence is ignored. |
|  |  | **Expected:** If “co-occurrence” is intended as window-based (e.g. within k words), the implementation does not match. |
|  |  | **Actual:** `sentences` are split by `。[！？\n]+`; for each sentence, word presence is recorded; edges use Jaccard on sentence IDs (same sentence ⇒ co-occurrence). |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **WARNING** | text_mining.js:1 | **Main entry does not use `text_mining/helpers.js` or `text_mining/visualization.js`.** Tokenization, STOP_WORDS, `displayWordCloud`, and `plotCooccurrenceNetwork` are duplicated inline. |
|  |  | **Expected:** Single implementation: either import from helpers/visualization or remove/repurpose those files. |
|  |  | **Actual:** Only `../utils.js` is imported; helpers and visualization are unused by this entry (dead or alternate entry). |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | text_mining.js:67–88, 249–264 | **Tokenization and stopword handling.** TinySegmenter is used for Japanese; filtering: length > 1, not in STOP_WORDS, not only short hiragana (≤2), not only symbols. |
|  |  | **Expected:** Japanese tokenization (e.g. TinySegmenter) and stopword handling. |
|  |  | **Actual:** Matches: `tokenizer.segment(sent)` per sentence; STOP_WORDS and regex filters applied. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | text_mining.js:356–383 | **Network: nodes = words, edges = co-occurrence strength.** Edges use Jaccard (sentence co-occurrence); threshold 0.1; vis-network with force-directed layout. |
|  |  | **Expected:** Nodes as words, edges as co-occurrence strength. |
|  |  | **Actual:** Implemented as described; strength is Jaccard index. |

---

### 2. `js/analyses/text_mining/helpers.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | helpers.js:— | **No TF-IDF or co-occurrence logic.** Module exports STOP_WORDS, getTokenizer, initTokenizer, downloadCanvasAsImage. Tokenization and TF-IDF/co-occurrence live only in the main file (and main does not import this). |
|  |  | **Expected:** If “helpers” should own tokenization/TF-IDF/co-occurrence, they are missing here. |
|  |  | **Actual:** Helpers are limited to stopwords, tokenizer lifecycle, and canvas download. |

---

### 3. `js/analyses/text_mining/visualization.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **WARNING** | visualization.js:62–89 | **Same sentence-based Jaccard co-occurrence** as main file; threshold 0.05 here vs 0.1 in main. Edge property is `value` (main uses `weight` then maps to `value` for vis). |
|  |  | **Expected:** Consistency with main if this module were used. |
|  |  | **Actual:** Logic aligned but threshold and property name differ; this file is not imported by `text_mining.js`. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | visualization.js:17–49 | **Word cloud:** Takes `wordCounts` (pairs [word, count]), uses WordCloud with weightFactor and minSize. No TF-IDF. |
|  |  | **Expected:** Word cloud from frequency (or TF-IDF if added). |
|  |  | **Actual:** Frequency-based only; implementation is consistent. |

---

## Time Series

### 4. `js/analyses/time_series.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | time_series.js:179–191 | **Moving average is simple trailing (backward-looking), not centered.** SMA at index i uses `data[i-window+1 .. i]`. |
|  |  | **Expected:** Documented as “Simple Moving Average”; formula \( \frac{1}{k}\sum_{i=0}^{k-1} x_{t-i} \) is trailing. |
|  |  | **Actual:** Matches: trailing window, first (window−1) values are null. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | time_series.js:193–206 | **ACF formula:** \( r_k = \frac{\sum (x_t - \bar{x})(x_{t+k} - \bar{x})}{\sum (x_t - \bar{x})^2} \). Implementation uses cov = sum over (n−lag) terms, variance = sum of squared deviations / n; ACF = (cov/n)/variance = cov/sum_sq. Correct. |
|  |  | **Expected:** Standard ACF definition. |
|  |  | **Actual:** Correct. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | time_series.js:— | **No trend decomposition (e.g. additive/multiplicative) or explicit seasonality detection.** Only SMA and ACF are implemented; interpretation text mentions periodicity. |
|  |  | **Expected:** Per task: “Trend decomposition if present”, “Seasonality detection”. |
|  |  | **Actual:** Not present; ACF is the only periodicity cue. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | time_series.js:234–258 | **ACF plot has no confidence band.** Comment notes “approx 95% = 1.96/sqrt(N)” but no shapes/lines are drawn for it. |
|  |  | **Expected:** Optional but useful: ±1.96/√N (or similar) for visual reference. |
|  |  | **Actual:** Only zero line; no band. |

---

## Data Processing

### 5. `js/analyses/data_processing.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **CRITICAL** | data_processing.js:244–252 | **`displayDataQualityInfo()` uses `dataCharacteristics`, which is not in scope.** Render stores the third argument in `originalCharacteristics` only; `dataCharacteristics` is undefined inside `displayDataQualityInfo()`, causing ReferenceError when the “データ型” section is built. |
|  |  | **Expected:** Use the stored characteristics (e.g. `originalCharacteristics`) for numeric/categorical columns. |
|  |  | **Actual:** Uses `dataCharacteristics.numericColumns` and `dataCharacteristics.categoricalColumns`, which are undefined. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **WARNING** | data_processing.js:31–39 | **Outlier removal drops entire row if any selected numeric column is out of range.** One extreme value in one column removes the row. |
|  |  | **Expected:** Documented behavior or option (e.g. “remove row if any selected column is outlier” vs “impute or cap”). |
|  |  | **Actual:** Row-wise deletion; correct for “remove rows with outliers” but strict. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **WARNING** | data_processing.js:46–62 | **Missing value definition: null, undefined, or exactly `''`.** Whitespace-only strings (`"  "`) are not treated as missing; they pass the filter and are then trimmed, leaving possible `''` in the trimmed data. |
|  |  | **Expected:** Consistent missingness (e.g. treat whitespace-only as missing or trim-before-filter). |
|  |  | **Actual:** Only exact `''` triggers row removal; trim is applied after filter. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | data_processing.js:10–43 | **IQR outlier bounds:** Q1 − 1.5×IQR, Q3 + 1.5×IQR; jStat quartiles [0] and [2]. Standard and correct. |
|  |  | **Expected:** Standard IQR method. |
|  |  | **Actual:** Correct. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | data_processing.js:446–453, 464–469 | **Recode/Compute mutate `originalData` in place.** Project rules prefer immutability; here the design treats “current dataset” as mutable. |
|  |  | **Expected:** Per coding-style: avoid mutation. |
|  |  | **Actual:** Direct mutation of `row[newColName]`; consider returning new array/rows. |

---

## Analysis Support

### 6. `js/analyses/analysis_support.js`

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | analysis_support.js:— | **No shared computation exports.** Module is a recommendation UI (variable selection → suggested analyses); it does not export helpers or common stats for other analysis modules. |
|  |  | **Expected:** “Helper functions for analysis modules” / “Common computations shared across modules”. |
|  |  | **Actual:** Self-contained recommendation logic; `getUniqueCount` is internal only. |

| [SEVERITY] | file:line | Description |
|------------|-----------|-------------|
| **INFO** | analysis_support.js:258–261 | **`getUniqueCount(data, colName)`** correctly counts distinct non-null values. |
|  |  | **Expected:** Correct unique count for recommendation rules. |
|  |  | **Actual:** Correct. |

---

## Summary

| Severity  | Count |
|-----------|-------|
| CRITICAL  | 2     |
| WARNING   | 5     |
| INFO      | 11    |

**Critical fixes:**  
1. **data_processing.js:** In `displayDataQualityInfo()`, use `originalCharacteristics` instead of `dataCharacteristics` (or pass characteristics as an argument).  
2. **text_mining:** Either implement TF-IDF (e.g. tf(t,d)*log(N/df(t))) and use it for word cloud/top words, or clearly document that only raw frequency is used.

**Recommended next steps:**  
- Unify text mining entry with `text_mining/helpers.js` and `text_mining/visualization.js` (import and use, or remove duplicates).  
- Optionally: ACF confidence band in time_series; trim-before-missing filter or treat whitespace-only as missing in data_processing; consider immutable updates in recode/compute.
