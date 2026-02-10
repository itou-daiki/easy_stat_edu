# Task Plan: 全分析ロジック・可視化・統計指標の検証

## Goal
Easy Stat Edu プロジェクト内のすべての統計分析モジュールについて、以下を検証する:
1. **統計ロジックの正確性** — 公式、自由度、検定統計量が教科書レベルで正しいか
2. **可視化の適切性** — グラフ種類、軸ラベル、レイアウトが分析結果を正しく反映しているか
3. **表出力の正確性** — 表の構造、数値の丸め、ラベルが正しいか
4. **エッジケース処理** — 欠損値、小サンプル、等分散でない場合の処理

## Analysis Modules (14+)

| # | Module | Files | Status |
|---|--------|-------|--------|
| 1 | EDA (探索的データ分析) | `eda.js`, `eda/descriptive.js`, `eda/visualization.js` | `pending` |
| 2 | 相関分析 | `correlation.js`, `correlation/visualization.js` | `pending` |
| 3 | カイ二乗検定 | `chi_square.js` | `pending` |
| 4 | t検定 | `ttest.js`, `ttest/helpers.js`, `ttest/visualization.js` | `pending` |
| 5 | Mann-Whitney U検定 | `mann_whitney.js` | `pending` |
| 6 | 一要因分散分析 | `anova_one_way.js`, `anova_one_way/helpers.js`, `independent.js`, `repeated.js` | `pending` |
| 7 | 二要因分散分析 | `anova_two_way.js`, `anova_two_way/helpers.js`, `independent.js`, `mixed.js`, `within.js` | `pending` |
| 8 | 単回帰分析 | `regression_simple.js` | `pending` |
| 9 | 重回帰分析 | `regression_multiple.js`, `regression_multiple/helpers.js`, `visualization.js` | `pending` |
| 10 | 因子分析 | `factor_analysis.js`, `factor_analysis/helpers.js`, `visualization.js` | `pending` |
| 11 | 主成分分析 (PCA) | `pca.js`, `pca/helpers.js`, `visualization.js` | `pending` |
| 12 | テキストマイニング | `text_mining.js`, `text_mining/helpers.js`, `visualization.js` | `pending` |
| 13 | 時系列分析 | `time_series.js` | `pending` |
| 14 | データ処理 | `data_processing.js` | `pending` |

## Shared Utilities
- `utils.js` — Core UI/Logic helpers
- `utils/stat_distributions.js` — 統計分布計算
- `constants.js` — 定数定義
- `analysis_support.js` — 分析サポート機能

## Phases

### Phase 1: Core Statistical Utilities Review `complete`
- `stat_distributions.js` — p値計算、分布関数の正確性
- `utils.js` — 共有ヘルパーの正確性
- `constants.js` — 定数の正確性

### Phase 2: Basic Analyses (EDA, Correlation, Chi-Square) `complete`
- EDA: 記述統計量（平均、中央値、SD、歪度、尖度）
- 相関: ピアソン/スピアマン相関係数、p値、散布図行列
- カイ二乗: 期待度数、検定統計量、残差分析

### Phase 3: Group Comparison (t-test, Mann-Whitney) `complete`
- t検定: 対応なし/対応あり、Welch補正、効果量(Cohen's d)
- Mann-Whitney: U統計量、正規近似

### Phase 4: ANOVA `complete`
- 一要因: 対応なし/対応あり、事後検定(Tukey HSD, Bonferroni)
- 二要因: 対応なし/混合/対応あり、交互作用、単純主効果

### Phase 5: Regression `complete`
- 単回帰: 係数、R², F検定
- 重回帰: VIF、AIC、偏回帰係数、残差分析

### Phase 6: Multivariate (Factor Analysis, PCA) `complete`
- 因子分析: 固有値、回転法、因子負荷量
- PCA: 寄与率、累積寄与率、スクリープロット

### Phase 7: Special Analyses (Text Mining, Time Series) `complete`
- テキストマイニング: 形態素解析、TF-IDF、共起ネットワーク
- 時系列: トレンド分析、移動平均

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
