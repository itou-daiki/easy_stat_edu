# マクネマー検定

## 概要

対応のある2つの2値変数（前後比較など）の比率変化を検定するノンパラメトリック手法。例：授業前後で「理解した/しなかった」の比率が有意に変化したかを検定。

## 変更ファイル

### [NEW] [mcnemar.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/mcnemar.js)

- `render()`: 変数選択UI（2つのカテゴリカル2値変数をペア選択）
- `runMcNemarTest()`: 2×2クロス集計→χ²統計量算出
- 結果表示: 2×2分割表、χ²値、p値、オッズ比、効果量φ
- 可視化: 分割表ヒートマップ

### [MODIFY] [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html)

「ノンパラメトリック検定」カテゴリにカード追加（`data-requires="categorical:2"`）

### [NEW] テスト用データ・E2Eテスト

- `datasets/mcnemar_test.csv` — 対応のある2値変数のペアデータ
- `tests/mcnemar.spec.ts` — E2Eテスト

## 計算ロジック

```
2×2分割表:
           変数2=Yes  変数2=No
変数1=Yes    a          b
変数1=No     c          d

χ² = (b - c)² / (b + c)  ← 不一致セルのみ使用
df = 1
p = 1 - χ²分布CDF(χ², 1)

※ b+c < 25 の場合は二項検定（正確確率）も実施
効果量: φ = √(χ² / N)
```

## 検証

```bash
npx playwright test tests/mcnemar.spec.ts
```
