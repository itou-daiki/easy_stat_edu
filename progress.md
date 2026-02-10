# Progress Log

## Session: 2026-02-10

### Phase 1: Core Utilities — ✅ Complete
- [x] `stat_distributions.js` — W8: 入力バリデーション追加 (NaN/Infinity/k<2)
- [x] `utils.js` — W7: Levene dfw≤0 ガード追加
- [x] `constants.js` — I1: getSignificanceSymbol 負p対策

### Phase 2: Basic Analyses — ✅ Complete
- [x] EDA — C3/C4: 歪度n<3, 尖度n<4 ガード追加。W1: 母SD→標本SD
- [x] Correlation — W2: スピアマン順位相関追加。W3: Fisher z変換95%CI追加
- [x] Chi-Square — ドキュメントのみ (コードは正確)

### Phase 3: Group Comparison — ✅ Complete
- [x] t-test — W4: 独立/対応あり/1サンプル全てに95%CI追加。I6: 重複キー修正
- [x] Mann-Whitney — C2: 両側p値修正済み (前セッション)

### Phase 4: ANOVA — ✅ Complete
- [x] C1: 精査の結果 Tukey SE は正しかった (誤検知)
- [x] W5: 反復測定に Greenhouse-Geisser ε と補正df/p追加
- [x] W6: independent.js にType I SS の制限事項コメント追加
- [x] I7: ω²が負の場合に0にクリッピング+注釈

### Phase 5: Regression — ✅ Complete
- [x] W9: 単回帰に定数X (分散0) チェック追加
- [x] W10: 重回帰 math.js Matrix→配列変換 (toArray) 追加

### Phase 6: Multivariate — ✅ Complete
- [x] C5: math.eigs の新旧API両対応 (FA, PCA)
- [x] C6: 因子分析 totalVariance を eigenvalues.length → sum に修正
- [x] W11: 因子分析/PCA でリストワイズ削除オプション追加
- [x] I15: Geomin回転で因子間相関表示条件修正

### Phase 7: Special Analyses — ✅ Complete
- [x] C8: テキストマイニングに TF-IDF 実装 + helpers/visualization統合
- [x] W14: データ処理の外れ値を行削除→列単位NaN化に変更

## Summary
- **全7フェーズ完了**
- **CRITICAL 8件**: 6件修正、1件は誤検知、1件は前セッション修正済
- **WARNING 14件**: 全件修正
- **INFO 20件以上**: 主要な項目を修正

## Files Modified
- `js/analyses/eda/descriptive.js` — C3, C4, W1
- `js/analyses/correlation.js` — W2, W3, W11 (listwise option)
- `js/analyses/ttest.js` — W4, I6
- `js/analyses/mann_whitney.js` — C2 (前セッション)
- `js/analyses/anova_one_way.js` — W5, I7
- `js/analyses/anova_two_way.js` — W5 (note)
- `js/analyses/anova_two_way/independent.js` — W6 (comment)
- `js/analyses/regression_simple.js` — W9
- `js/analyses/regression_multiple/helpers.js` — W10
- `js/analyses/factor_analysis/helpers.js` — C5, W11
- `js/analyses/factor_analysis/visualization.js` — C6
- `js/analyses/factor_analysis.js` — I15
- `js/analyses/pca/helpers.js` — C5, W11
- `js/analyses/text_mining.js` — C8, W13
- `js/analyses/data_processing.js` — C7 (前セッション), W14
- `js/analyses/constants.js` — I1
- `js/utils.js` — W7
- `js/utils/stat_distributions.js` — W8
