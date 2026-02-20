# ウォークスルー：因子得点算出機能

## 変更サマリー

[factor_score_calculator](https://github.com/itou-daiki/factor_score_calculator)の機能をeasyStatに統合。アンケートデータから因子得点を自動算出するユーティリティを追加。

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| [factor_score.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/factor_score.js) | **[NEW]** 因子得点計算モジュール |
| [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html) | ユーティリティにカード追加 |
| [factor_score.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/factor_score.spec.ts) | **[NEW]** E2Eテスト3件 |
| [scale_info_test.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/scale_info_test.csv) | **[NEW]** テスト用尺度情報 |
| [factor_data_test.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/factor_data_test.csv) | **[NEW]** テスト用データ |

---

## 実装結果

### ファイルアップロード・計算設定

![プレビューと設定](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/factor_score_previews_controls_1771597776831.png)

### 計算結果

![計算結果](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/factor_score_results_final_1771597806670.png)

---

## テスト結果

```
Running 3 tests using 3 workers
  3 passed (2.8s)
```

| テストケース | 結果 |
|---|---|
| データ未アップロードで遷移可能 | ✅ |
| 尺度情報・データファイルのアップロード・プレビュー | ✅ |
| 因子得点計算（反転処理含む） | ✅ |

## 操作デモ

![操作デモ](/Users/itoudaiki/.gemini/antigravity/brain/bc42511a-fa4d-48f6-ad15-e7f0785bfc6d/factor_score_demo_1771597703106.webp)
