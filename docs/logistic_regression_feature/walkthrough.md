# ウォークスルー：ロジスティック回帰分析

## 変更サマリー

2値の結果を予測するロジスティック回帰分析機能を「関連性の検定・予測」カテゴリに追加。

### 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| [logistic_regression.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/logistic_regression.js) | **[NEW]** ロジスティック回帰モジュール（約450行） |
| [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html) | カード追加 |
| [logistic_regression.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/logistic_regression.spec.ts) | **[NEW]** E2Eテスト2件 |
| [logistic_demo.csv](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/datasets/logistic_demo.csv) | **[NEW]** テスト用データ |

### 実装した統計手法

- **推定法:** 反復重み付き最小二乗法 (IRLS)
- **検定:** Wald検定 (z = β/SE)
- **適合度:** Nagelkerke R², 尤度比χ²検定
- **評価:** 混同行列、正解率、適合率、再現率、F1スコア
- **可視化:** 予測確率プロット、混同行列ヒートマップ

---

## テスト結果

```
Running 2 tests using 2 workers
  2 passed (2.9s)
```
