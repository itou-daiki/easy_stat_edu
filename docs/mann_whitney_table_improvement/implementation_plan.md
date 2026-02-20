# U検定結果テーブルの学術論文形式への改善

## 概要

現在のU検定結果テーブルを、ユーザー提示の学術論文形式に変更する。

### 現在の形式
```
| 変数 | 群0 平均順位 | 群1 平均順位 | U値 | |Z| | p値 | 有意差 | 効果量 r |
```
→ 要約統計量は別テーブルに分離されている

### 目標の形式
```
|          | 群0 (n=xx)              | 群1 (n=yy)              | 群間の差の検定       |
| 変数     | 平均   SD   中央値      | 平均   SD   中央値      | 統計量(U)  効果量(r) |
```
→ 統計量Uに有意マーカー（`***`等）を付与、脚注に`N=xx ***p<.001`

## 変更ファイル

### [MODIFY] [mann_whitney.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/mann_whitney.js)

#### 1. `runMannWhitneyTest()` — 結果テーブルを統合形式に変更
- 既存の要約統計量テーブル（`displaySummaryStatistics`呼び出し）を削除
- テストループ内で各変数の群別記述統計量（平均/SD/中央値）を算出
- テーブルヘッダーを2段構成に変更:
  - 1段目: `| | 群0 (n=xx) | 群1 (n=yy) | 群間の差の検定 |`（colspan使用）
  - 2段目: `| | 平均 | SD | 中央値 | 平均 | SD | 中央値 | 統計量(U) | 効果量(r) |`
- U値に`***`/`**`/`*`の有意マーカーを付与（数値の直後に表示）
- テーブル脚注: `N=xx ***p<.001 **p<.01 *p<.05`

#### 2. `generateReportingTable()` — APA論文報告テーブルも同形式に更新

#### 3. `displaySummaryStatistics()` — 不要になるため呼び出し削除（関数自体は残してもよい）

## 検証

```bash
npx playwright test tests/mann_whitney_table.spec.ts
```

### E2Eテスト内容
1. U検定実行後、結果テーブルに群別の「平均」「SD」「中央値」列が存在すること
2. U統計量に有意マーカー（`***`等）が付与されていること
3. 効果量(r)列が存在すること
