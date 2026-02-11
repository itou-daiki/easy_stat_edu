# Task Plan: アノテーション・ブラケット描画の詳細検証

## Goal
全分析モジュールで使用されているアノテーション（軸ラベル、タイトル、統計値注記）と
有意差ブラケット（significance brackets）が適切に描画されているか詳細に検証する。

## 検証対象
| # | 対象 | 関連ファイル | 検証ポイント | Status |
|---|------|-------------|-------------|--------|
| 1 | getTategakiAnnotation (縦書きy軸) | utils.js | 位置・可視性 | `complete` |
| 2 | getBottomTitleAnnotation (下部タイトル) | utils.js | 位置・可視性 | `complete` |
| 3 | addSignificanceBrackets (有意差ブラケット) | utils.js | 正確な位置・重なり | `complete` |
| 4 | 一要因ANOVA ブラケット | anova_one_way.js, helpers.js | 多重比較結果の描画 | `complete` |
| 5 | 二要因ANOVA ブラケット | anova_two_way/, helpers.js | 単純主効果の描画 | `complete` |
| 6 | t検定 ブラケット | ttest/visualization.js | 有意差表示 | `complete` |
| 7 | Mann-Whitney ブラケット | mann_whitney.js | 有意差表示 | `complete` |
| 8 | PCA バイプロット注釈 | pca/visualization.js | 変数矢印・ラベル | `complete` |
| 9 | 回帰分析 注釈 | regression_simple/multiple | 回帰式・パス図 | `complete` |
| 10 | カイ二乗 注釈 | chi_square.js | ヒートマップ注釈 | `complete` |

## Phases
1. **Phase 1**: コード解析 — 全アノテーション/ブラケット関数の実装を読み解く `complete`
2. **Phase 2**: 問題特定 — コード解析から3つの重大な問題を発見 `complete`
3. **Phase 3**: 問題修正 — 全ての問題を修正 `complete`
4. **Phase 4**: lint検証 — エラーなし確認済み `complete`

## 発見・修正した問題

### Bug 1 (Critical): アノテーション切り替えフィルタの座標不整合
- **修正**: 7箇所のフィルタ条件を `_annotationType` プロパティベースに変更
- **影響ファイル**: anova_one_way.js, anova_one_way/helpers.js, anova_two_way.js, anova_two_way/independent.js, eda.js(3箇所)

### Bug 2 (Important): addSignificanceBrackets yaxis auto-range未対応
- **修正**: auto-range時にyaxis.rangeを明示設定 (utils.js)
- **影響**: t検定、一要因ANOVA、Mann-Whitney全てのブラケットが確実に表示

### Bug 3 (Important): generateBracketsForGroupedPlot yaxis range未設定
- **修正**: recommendedMaxYを返却し、呼び出し側でyaxis.rangeを設定
- **影響ファイル**: anova_two_way/helpers.js, anova_two_way.js, anova_two_way/independent.js

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Playwright MCP Chrome競合 | 1 | cursor-ide-browser使用に切替 |
| cursor-ide-browser stale refs | 1 | コード解析ベースの検証に切替 |
