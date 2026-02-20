# ウォークスルー：マクネマー検定

## 変更サマリー

対応のある2値変数の比率変化を検定するマクネマー検定を「ノンパラメトリック検定」カテゴリに追加。

### 変更ファイル一覧

| ファイル | 変更 |
|---|---|
| [mcnemar.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/mcnemar.js) | **[NEW]** 本体モジュール |
| [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html) | カード追加 |
| [mcnemar.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/mcnemar.spec.ts) | **[NEW]** E2Eテスト2件 |
| [mcnemar_test.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/mcnemar_test.csv) | **[NEW]** テスト用データ |

### 実装した機能

- **2×2分割表**: 対応のある2値変数のクロス集計
- **χ²検定**: (b-c)²/(b+c)（補正なし＋イェーツ補正）
- **正確二項検定**: b+c < 25 の場合に自動併用
- **効果量φ**: √(χ²/N)
- **可視化**: 分割表ヒートマップ（不一致ペア⚡マーク付き）
- **APA報告テーブル**: コピー可能な論文用テーブル

## テスト結果

```
Running 2 tests using 2 workers
  2 passed (2.4s)
```
