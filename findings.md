# Findings: アノテーション・ブラケット描画検証（最終）

## 修正済みの問題

### Bug 1: アノテーション切り替えトグルでの重複発生
- **原因**: 前回セッションでgetTategakiAnnotationのx座標を-0.15→-0.08に変更した際、
  トグル時のフィルタ条件(`a.x !== -0.15`)が旧値のままだった
- **症状**: 軸ラベルチェックボックスのOFF→ONで縦書きラベルが重複蓄積
- **修正**: 全アノテーション関数に`_annotationType`プロパティを追加し、
  座標ではなく型識別子でフィルタリングするよう7箇所を修正
- **修正ファイル**:
  - `js/utils.js`: getTategakiAnnotation → `_annotationType: 'tategaki'`
  - `js/utils.js`: getBottomTitleAnnotation → `_annotationType: 'bottomTitle'`
  - `js/utils.js`: addSignificanceBrackets内annotation → `_annotationType: 'bracket'`
  - `js/analyses/anova_one_way.js`: フィルタ修正
  - `js/analyses/anova_one_way/helpers.js`: フィルタ修正
  - `js/analyses/anova_two_way.js`: フィルタ修正
  - `js/analyses/anova_two_way/independent.js`: フィルタ修正
  - `js/analyses/eda.js`: 3箇所のフィルタ修正

### Bug 2: 有意差ブラケットのテキストが画面外に切れる
- **原因**: Plotly autorangeがshapes(data座標)は含むがannotationsは含まない仕様
  addSignificanceBrackets内でyaxis.rangeが未設定時に何もしなかった
- **症状**: ブラケット上の「*」「**」テキストがグラフ上端で切れる可能性
- **修正**: `js/utils.js`のaddSignificanceBracketsで、auto-range時にyaxis.rangeを
  `[0, recommendedMaxY]`と明示設定するよう変更

### Bug 3: 二要因ANOVAブラケットのyaxis range未設定
- **原因**: generateBracketsForGroupedPlotがyaxis rangeに関する情報を返さなかった
- **症状**: ブラケットの「**」「*」テキストが切れる可能性
- **修正**: 
  - `js/analyses/anova_two_way/helpers.js`: recommendedMaxYを返却するよう修正
  - `js/analyses/anova_two_way.js`: ローカル版も同様に修正、呼び出し側でyaxis.range設定
  - `js/analyses/anova_two_way/independent.js`: 呼び出し側でyaxis.range設定

## 問題なしの検証結果

### PCA バイプロット — OK
- 変数矢印(shapes)とラベル(annotations)はデータ座標で正しく配置
- scaleの2倍スケーリングが適用、label位置も矢印先端と一致

### 重回帰 パス図 — OK
- xaxis/yaxis rangeが明示的に設定 (range: [0, 1.2] / [0, 1])
- 矢印(ax/ay)と係数ラベル(x/y中間点)は正しく配置

### カイ二乗 ヒートマップ — OK
- セル値アノテーションはPlotly heatmapトレースのtextが担当
- getTategakiAnnotation/getBottomTitleAnnotation使用、_annotationType修正済み

### 単回帰分析 — OK
- getTategakiAnnotation/getBottomTitleAnnotation使用、_annotationType修正済み
- 回帰式のテキストはPlotlyトレースのname属性で凡例表示

### 残差プロット（重回帰） — OK
- shapes配列にzero-lineを含む、annotation使用なし
