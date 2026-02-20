# クロス集計

## 概要

2つのカテゴリカル変数のクロス集計表を作成し、度数・行%・列%を表示する探索的分析機能。検定は行わず、記述統計としてのクロス表に特化。

## 変更ファイル

### [NEW] [cross_tabulation.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/cross_tabulation.js)

- `render()`: 行変数・列変数の選択UI
- `runCrossTabulation()`: クロス集計表の構築
- 表示モード切替: **度数** / **行%** / **列%** / **全体%**
- ヒートマップ可視化 (Plotly)
- CSV形式でのダウンロード機能

### [MODIFY] [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html)

「データの探索・要約」カテゴリにカード追加（`data-requires="categorical:2"`）

### [NEW] テストデータ・E2Eテスト

- `datasets/cross_tab_test.csv`
- `tests/cross_tabulation.spec.ts`

## 検証

```bash
npx playwright test tests/cross_tabulation.spec.ts
```
