# Progress Log

## Session: 2026-02-10

### Phase 1: Core Utilities
- [x] `stat_distributions.js` reviewed — WARNING x2 (入力バリデーション不足)
- [x] `utils.js` reviewed — WARNING x1 (Levene dfw=0), INFO x1 (createPairSelector二重追加)
- [x] `constants.js` reviewed — INFO x1 (負のpで***)

### Phase 2: Basic Analyses
- [x] EDA reviewed — CRITICAL x2 (歪度n=2, 尖度n≤3), WARNING x1 (母SD)
- [x] Correlation reviewed — WARNING x2 (スピアマンなし, CIなし), 公式は正確
- [x] Chi-Square reviewed — INFO x2 (ドキュメント不一致, Fisher未実装), 公式は正確

### Phase 3: Group Comparison
- [x] t-test reviewed — WARNING x1 (CIなし), 公式は正確
- [x] Mann-Whitney reviewed — CRITICAL x1 (修正済み: p>1バグ)

### Phase 4: ANOVA
- [x] One-way ANOVA reviewed — CRITICAL x2 (Tukey SE /2エラー), WARNING x2 (球面性, silent return)
- [x] Two-way ANOVA reviewed — CRITICAL x2 (Tukey SE /2エラー), WARNING x2 (球面性, Type I SS)

### Phase 5: Regression
- [x] Simple Regression reviewed — WARNING x1 (定数Xで0除算), INFO x2 (切片, CI/PI)
- [x] Multiple Regression reviewed — WARNING x1 (math.js Matrix型), INFO x2 (AIC/BIC, Q-Q)

### Phase 6: Multivariate
- [x] Factor Analysis reviewed — CRITICAL x2 (math.eigs, 寄与率), WARNING x2 (ペアワイズ, Oblimin)
- [x] PCA reviewed — CRITICAL x1 (math.eigs), WARNING x1 (バイプロット)

### Phase 7: Special Analyses
- [x] Text Mining reviewed — CRITICAL x1 (TF-IDF未実装), WARNING x2 (ヘルパー未使用, 共起)
- [x] Time Series reviewed — INFO x2 (後方SMA, ACF信頼帯)
- [x] Data Processing reviewed — CRITICAL x1 (修正済み: 変数スコープ), WARNING x1 (行削除)
- [x] Analysis Support reviewed — INFO x1 (推奨ロジックのみ)

## Summary of All Phases
- **全モジュールレビュー完了**
- **CRITICAL: 8件** (うち2件修正済み、6件未修正)
- **WARNING: 14件** (すべて未修正)
- **INFO: 20件以上**

## Priority Fix Order
1. 🔴 ANOVA Tukey SE /2 エラー (4箇所) — 検定結果に直接影響
2. 🔴 EDA 歪度/尖度 0除算 (2箇所) — 小サンプルでクラッシュ
3. 🔴 因子分析 math.eigs 返り値 — 環境によりクラッシュ
4. 🔴 因子分析 寄与率計算 — 表示が不正確
5. 🟡 EDA 母SD → 標本SD
6. 🟡 ANOVA 球面性補正
7. 🟡 各種 CI 追加 (相関, t検定)

## Files Modified (by agents)
- `mann_whitney.js` — 両側p値修正
- `data_processing.js` — 変数スコープ修正

## Report Files Created (by agents)
- `statistical_review_report.md`
- `EDA_CORRELATION_REVIEW_REPORT.md`
- `REGRESSION_REVIEW_REPORT.md`
- `FACTOR_ANALYSIS_PCA_STATISTICAL_REVIEW_REPORT.md`
- `TEXT_TIMESERIES_DATAPROC_ANALYSIS_SUPPORT_REVIEW.md`
