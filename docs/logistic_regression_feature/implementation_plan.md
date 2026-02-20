# ロジスティック回帰分析

## 概要

2値の目的変数（0/1）を複数の説明変数で予測するロジスティック回帰分析。「関連性の検定・予測」カテゴリに追加。

## 変更ファイル

### [NEW] [logistic_regression.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/logistic_regression.js)

- `render()`: 変数選択UI（目的変数=カテゴリカル2値、説明変数=数値複数選択）
- `runLogisticRegression()`: 勾配降下法による係数推定
- 結果: 係数、標準誤差、Wald検定、オッズ比、正解率、混同行列
- 可視化: 予測確率プロット（Plotly）

### [MODIFY] [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html)

「関連性の検定・予測」カテゴリにカードを追加（`data-requires="numeric:1,categorical:1"`）

### [NEW] テスト用データ・E2Eテスト

- `datasets/logistic_demo.csv` — 2値目的変数＋数値説明変数
- `tests/logistic_regression.spec.ts` — E2Eテスト

## 計算ロジック

```
シグモイド関数: σ(z) = 1 / (1 + exp(-z))
推定法: 反復重み付き最小二乗法 (IRLS) or 勾配降下法
Wald検定: z = β / SE(β), p = 2 * (1 - Φ(|z|))
オッズ比: exp(β)
```

## 検証

```bash
npx playwright test tests/logistic_regression.spec.ts
```
