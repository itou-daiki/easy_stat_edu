# Walkthrough: Annotation & Bracket Fixes Verification

## Goal
Verify the rendering and positioning of **significance brackets** and **annotations** (vertical axis labels, bottom titles) in the statistical analysis charts, specifically for T-test and One-way ANOVA.

## Changes Verified
- **Annotation Filtering**: Fixed a bug where annotations were not filtering correctly based on visibility toggles (replaced hardcoded coordinate checks with `_annotationType` property).
- **Auto-Range for Brackets**: Enhanced `addSignificanceBrackets` to ensure `yaxis.range` is automatically expanded so high-positioned brackets are not cut off.
- **Grouped Plot Support**: Fixed bracket generation for independent variables in Two-way ANOVA.

## Verification Results

### 1. T-test Analysis
- **Test**: Independent T-test on demo data (`スマホ使用傾向` vs `数学(点)`).
- **Observation**:
    - Significance bracket with p-value (`**`) appears correctly above the bars.
    - Y-axis automatically scales to accommodate the bracket.
    - No overlap with the chart title or axis labels.

### 2. One-way ANOVA Analysis
- **Test**: One-way ANOVA on demo data (`BGM環境` vs `暗記(点)`).
- **Observation**:
    - Multiple pairwise comparison brackets (Tukey-Kramer) are displayed.
    - Brackets are stacked correctly to avoid overlapping each other.
    - Significance markers (`**`, `*`, `n.s.`) are clearly legible.

## Visual Proof
The following recording demonstrates the verification process in the browser, including the successful rendering of plots for both analysis types.

![Verification Session](/Users/itoudaiki/.gemini/antigravity/brain/cef3733f-1cf3-4df5-be3c-07e5dba0d34f/verify_restored_app_1771176116633.webp)

## Conclusion

## 3. Two-way Mixed ANOVA Fix
- **Issue**: The UI previously allowed only a single pair of variables (Pre/Post) to be selected, despite the backend supporting multiple pairs.
- **Fix**: Implemented a dynamic "Add Pair" interface in `js/utils.js` and updated `js/analyses/anova_two_way.js` to utilize it.
- **Verification**:
    - Confirmed that users can now add multiple Pre/Post variable pairs.
    - Verified that the analysis runs correctly for all selected pairs, generating tables and interaction plots.

### Visual Proof (Mixed ANOVA)
The following screenshot shows the loaded demo data and the successful execution of the Mixed ANOVA with two pairs of variables (Reading and Listening scores).

![Mixed ANOVA Results](/Users/itoudaiki/.gemini/antigravity/brain/cef3733f-1cf3-4df5-be3c-07e5dba0d34f/mixed_anova_results_1771191220411.png)

Session Recording:
![Mixed ANOVA Verification](/Users/itoudaiki/.gemini/antigravity/brain/cef3733f-1cf3-4df5-be3c-07e5dba0d34f/mixed_anova_verification_1771191068211.webp)
