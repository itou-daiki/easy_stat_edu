# ウォークスルー：U検定結果テーブルの改善

## 変更サマリー

U検定の結果テーブルを学術論文形式に改善。要約統計量テーブルと検定結果テーブルを統合し、群別の記述統計量＋検定統計量を1つのテーブルで表示。

### 変更内容

| ファイル | 変更内容 |
|---|---|
| [mann_whitney.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/mann_whitney.js) | 結果テーブル・APA報告テーブルを統合学術形式に変更 |
| [mann_whitney_table.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/mann_whitney_table.spec.ts) | **[NEW]** E2Eテスト |

### テーブル形式変更

**Before:**
- 要約統計量テーブル（変数/有効N/平均/中央値/SD/最小/最大）が分離
- 検定結果テーブル（変数/群0平均順位/群1平均順位/U/|Z|/p/有意差/r）

**After (学術論文形式):**

```
|          | 群0 (n=xx)         | 群1 (n=yy)         | 群間の差の検定     |
| 変数     | 平均  SD  中央値   | 平均  SD  中央値   | 統計量(U) 効果量(r)|
| var1     | 4.43 .39  4.40    | 4.33 .41  4.40    | 3417      .13     |
```
- U値に有意マーカー（`***`/`**`/`*`）を直接付与
- 脚注: `N=xx ***p<.001 **p<.01 *p<.05`

## テスト結果

```
Running 1 test using 1 worker
  1 passed (2.8s)
```
