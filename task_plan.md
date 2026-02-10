# Task Plan: 全分析モジュールの可視化品質チェック

## Goal
相関分析以外のすべての分析モジュールの可視化が適切に行われているか確認し、問題があれば修正する。

## Analysis Modules to Check
| # | Module | File | Status |
|---|--------|------|--------|
| 1 | 探索的データ分析 (EDA) | eda.js | `pending` |
| 2 | t検定 | ttest.js | `pending` |
| 3 | 一元配置分散分析 | anova_one_way.js | `pending` |
| 4 | 二元配置分散分析 | anova_two_way.js | `pending` |
| 5 | 単回帰分析 | regression_simple.js | `pending` |
| 6 | 重回帰分析 | regression_multiple.js | `pending` |
| 7 | カイ二乗検定 | chi_square.js | `pending` |
| 8 | マン・ホイットニーU検定 | mann_whitney.js | `pending` |
| 9 | 主成分分析 (PCA) | pca.js | `pending` |
| 10 | 因子分析 | factor_analysis.js | `pending` |
| 11 | テキストマイニング | text_mining.js | `pending` |
| 12 | 時系列分析 | time_series.js | `pending` |

## Check Points
- [ ] Plotlyの軸設定（showticklabels, anchor, domain）
- [ ] 散布図の軸ラベル表示
- [ ] グラフのマージン設定
- [ ] テキストの表示・被り
- [ ] レスポンシブ性
- [ ] 全般的な可視化の品質

## Phases
1. **Phase 1**: コード解析 - 各モジュールのPlotly呼び出しを確認 `in_progress`
2. **Phase 2**: ブラウザ確認 - 実際に可視化を表示して問題を特定 `pending`
3. **Phase 3**: 修正 - 問題のある可視化を修正 `pending`
4. **Phase 4**: 最終確認 - 修正結果をブラウザで検証 `pending`

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
