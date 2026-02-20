# ウォークスルー：クロス集計

## 変更サマリー

「データの探索・要約」カテゴリにクロス集計機能を追加。

| ファイル | 変更 |
|---|---|
| [cross_tabulation.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/cross_tabulation.js) | **[NEW]** 本体モジュール |
| [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html) | カード追加 |
| [cross_tabulation.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/cross_tabulation.spec.ts) | **[NEW]** E2Eテスト2件 |
| [cross_tab_test.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/cross_tab_test.csv) | **[NEW]** テスト用データ |

### 実装した機能

- **表示モード切替**: 度数 / 行% / 列% / 全体%（ボタン切替）
- **ヒートマップ**: Plotlyによるインタラクティブ可視化（度数表示）
- **CSVダウンロード**: 集計結果をBOM付きUTF-8 CSVで出力
- **最大値ハイライト**: 各行の最大度数セルを緑色太字表示

## テスト結果

```
Running 2 tests using 2 workers
  2 passed (2.7s)
```
