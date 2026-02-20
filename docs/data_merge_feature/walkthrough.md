# ウォークスルー：データ結合（マージ）機能

## 変更サマリー

[easy_xl_merge](https://github.com/itou-daiki/easy_xl_merge)の機能をeasyStatに統合。2つのExcel/CSVファイルを共通カラムで結合するユーティリティを追加。

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| [data_merge.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/data_merge.js) | **[NEW]** 結合モジュール全体 |
| [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html) | ユーティリティにカード追加 |
| [main.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/main.js) | `data-requires="none"`対応 |
| [data_merge.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/data_merge.spec.ts) | **[NEW]** E2Eテスト4件 |
| [merge_test_1.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/merge_test_1.csv) | **[NEW]** テスト用データ |
| [merge_test_2.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/merge_test_2.csv) | **[NEW]** テスト用データ |

---

## 実装結果

### ユーティリティカテゴリに新カード追加

![ユーティリティセクション](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/utility_section_1771596941667.png)

### ファイルアップロード・結合設定

![プレビューと結合設定](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/merge_previews_controls_1771597044133.png)

### 結合結果・ダウンロード

![結合結果](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/merge_result_final_1771597064265.png)

---

## テスト結果

```
Running 4 tests using 4 workers
  4 passed (2.7s)
```

| テストケース | 結果 |
|---|---|
| データ未アップロードで遷移可能 | ✅ |
| 2ファイルアップロード・プレビュー | ✅ |
| 共通カラム検出 + inner結合 | ✅ |
| outer結合 | ✅ |

## 操作デモ

![操作デモ](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/data_merge_e2e_1771596871686.webp)
