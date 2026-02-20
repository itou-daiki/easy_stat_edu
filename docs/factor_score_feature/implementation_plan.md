# 因子得点計算機能（Factor Score Calculator）

## 概要

[factor_score_calculator](https://github.com/itou-daiki/factor_score_calculator) の機能をeasyStatに統合。
アンケートデータから因子得点を自動算出するユーティリティ。

### ワークフロー

1. **尺度情報ファイル**をアップロード（設問名 / 因子名 / 反転 の3列）
2. **データファイル**をアップロード（アンケート回答データ）
3. **n件法**を指定（例: 4件法、5件法）
4. 反転項目を自動処理 → 因子ごとの平均得点を算出
5. 結果をプレビュー・ダウンロード

---

## 変更ファイル

### [NEW] [factor_score.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/factor_score.js)

分析モジュール本体。以下の機能を含む:
- 尺度情報ファイル・データファイルのアップロードUI
- 尺度情報テンプレートのダウンロード機能
- 反転項目処理ロジック: `n件法 + 1 - 値`
- 因子得点算出: 各因子に属する設問の平均値
- 結果プレビュー・Excel/CSVダウンロード

### [MODIFY] [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html)

ユーティリティカテゴリに「因子得点算出」カードを追加（`data-requires="none"`）

### [NEW] [factor_score.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/factor_score.spec.ts)

E2Eテスト

### [NEW] テスト用データファイル

- `datasets/scale_info_test.csv` — 尺度情報（設問名, 因子名, 反転）
- `datasets/factor_data_test.csv` — テスト用アンケートデータ

---

## 計算ロジック仕様

```
反転処理: data[設問名] = n件法 + 1 - data[設問名]  (反転=1の場合)
因子得点: 因子Xに属する設問の平均値 → 列名: "因子名_因子得点"
```

---

## 検証計画

```bash
npx playwright test tests/factor_score.spec.ts
```

テストケース:
1. データ未アップロードでもカードから遷移可能
2. 尺度情報・データファイルのアップロードとプレビュー
3. 因子得点計算の実行と結果検証（反転処理を含む）
