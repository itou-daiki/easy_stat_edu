# Findings: 全分析ロジック検証結果（最終版）

## Critical Issues (要修正: 8件)

### C1. Tukey-Kramer SE が全箇所で √2 倍小さい（ANOVA 4箇所）
- **場所**: `anova_one_way.js:38-39`(独立), `anova_one_way.js:141`(反復), `anova_two_way.js:61`(独立単純主効果), `anova_two_way.js:154`(混合単純主効果)
- **問題**: SE計算で `msWithin / 2` としているが、正しくは `msWithin`（/2 不要）
- **影響**: q値が√2倍大きくなり、p値過小 → 有意判定が甘くなる
- **修正**: `/2` を削除

### C2. Mann-Whitney 両側p値が Z>0 のとき 1 超え
- **場所**: `mann_whitney.js`
- **問題**: `cdf(z) * 2` → z>0 で p>1
- **状態**: ✅ エージェントにより修正済み

### C3. EDA 歪度で n=2 のとき 0 除算
- **場所**: `eda/descriptive.js`
- **問題**: 分母 `(n-1)(n-2)` → n=2 で 0
- **修正**: n < 3 のとき NaN 返却またはスキップ

### C4. EDA 尖度で n≤3 のとき 0 除算
- **場所**: `eda/descriptive.js`
- **問題**: 分母 `(n-1)(n-2)(n-3)` → n=2,3 で 0
- **修正**: n < 4 のとき NaN 返却またはスキップ

### C5. math.eigs 返り値の形式不一致（因子分析・PCA）
- **場所**: `factor_analysis/helpers.js`, `pca/helpers.js`
- **問題**: `{ values, vectors }` を期待するが math.js は `{ values, eigenvectors }` を返す可能性
- **影響**: vectors が undefined → エラー
- **修正**: ブラウザで確認し、返り値キーを正しく参照

### C6. 因子分析の寄与率計算で totalVariance が不正
- **場所**: `factor_analysis/visualization.js:15-16`
- **問題**: `totalVariance = eigenvalues.length` としているが `sum(eigenvalues)` が正しい
- **影響**: 相関行列のフル固有値なら一致するが、k 個だけ渡すと壊れる
- **修正**: `eigenvalues.reduce((a, b) => a + b, 0)` に変更

### C7. data_processing.js で dataCharacteristics が未定義
- **場所**: `data_processing.js:244-252`
- **問題**: `displayDataQualityInfo()` が `dataCharacteristics` を参照するが render() スコープにない
- **状態**: ✅ エージェントにより修正済み

### C8. テキストマイニングで TF-IDF 未実装
- **場所**: `text_mining.js`
- **問題**: 頻度のみ使用、TF-IDF 計算が存在しない
- **影響**: 重要語の抽出精度が低い

---

## Warning Issues (要確認: 14件)

### W1. EDA 要約表で母標準偏差を使用
- `jStat.stdev()` デフォルト=母SD(n)。`jStat.stdev(data, true)` で標本SD(n-1) に

### W2. 相関分析にスピアマン順位相関がない
- ピアソンrのみ。jStat.spearmancoeff で追加可能

### W3. 相関係数の信頼区間がない
- Fisher z 変換による 95% CI

### W4. t検定で平均差の信頼区間がない
- CI = (M1 - M2) ± t_crit * SE

### W5. ANOVA 反復測定で球面性検定・補正なし
- Mauchly 検定なし、GG/HF 補正なし → 球面性違反時に F が過大

### W6. 二要因 ANOVA (independent.js) で Type I SS 使用
- 不均等デザインで順序依存。メインの anova_two_way.js は Type III 的

### W7. Levene 検定で群内自由度 0 → NaN
- 各群1観測の場合に除算エラー

### W8. stat_distributions.js で入力バリデーション不足
- studentizedRangeCDF で k<2、NaN/Infinity 未チェック

### W9. 単回帰で定数X（分散0）のとき 0 除算
- 全x同値のとき分母=0

### W10. 重回帰の beta/seBeta が math.js Matrix のまま使用
- `beta[i]` ではなく `.get()` or `.toArray()` が必要な場合あり

### W11. 因子分析の相関行列でペアワイズ除去
- FA/PCA はリストワイズ除去が前提。非正定値行列になる可能性

### W12. Direct Oblimin の勾配公式の検証不足
- R psych パッケージ等と照合が必要

### W13. テキストマイニングのヘルパー/可視化ファイルが未使用
- `text_mining/helpers.js` と `text_mining/visualization.js` がメインから import されていない

### W14. データ処理の外れ値除去が行全体を削除
- IQR 範囲外の列があると行ごと削除。列単位のNaN化が適切な場合も

---

## Info (軽微/改善提案: 20件以上)

- I1. `getSignificanceSymbol(p)` で負のpが`***`を返す
- I2. `createPairSelector` でDOM要素の二重追加
- I3. EDA のモードで最頻値が複数ある場合に1つだけ表示
- I4. カイ二乗のドキュメントが Yates「未実装」と記載するが実際は 2x2 で適用
- I5. Fisher 正確検定は未実装
- I6. t検定 paired の testResults に重複キー
- I7. ANOVA ω² が負の場合にクリッピングなし
- I8. jStat.stdev のデフォルト挙動が各モジュールで不統一
- I9. 単回帰で切片の SE/t/p が表示されない
- I10. 単回帰で CI/PI バンドの表示なし
- I11. 重回帰で AIC/BIC 未実装
- I12. 重回帰で Q-Q プロットなし
- I13. PCA バイプロットの変数矢印がアドホックなスケール
- I14. PCA で成分が1つの場合のガード不足
- I15. Geomin 回転の因子相関が表示されない（条件分岐漏れ）
- I16. KMO・Bartlett 検定が未実装（因子分析）
- I17. 時系列の移動平均が後方移動平均（中心移動平均でない）
- I18. 時系列の ACF に信頼帯がない
- I19. データ処理で欠損値判定が厳密（空白文字列のみ）
- I20. analysis_support.js は推奨ロジックのみで共通計算エクスポートなし

---

## Module-by-Module Summary

| # | Module | CRITICAL | WARNING | INFO | Status |
|---|--------|----------|---------|------|--------|
| 1 | EDA | 2 | 1 | 2 | ⚠️ |
| 2 | 相関分析 | 0 | 2 | 0 | ✅(要改善) |
| 3 | カイ二乗検定 | 0 | 0 | 2 | ✅ |
| 4 | t検定 | 0 | 1 | 2 | ✅(要改善) |
| 5 | Mann-Whitney | ~~1~~ 0(修正済) | 0 | 0 | ✅ |
| 6 | 一要因ANOVA | 2 | 2 | 2 | ❌ |
| 7 | 二要因ANOVA | 2 | 2 | 0 | ❌ |
| 8 | 単回帰 | 0 | 1 | 2 | ✅(要改善) |
| 9 | 重回帰 | 0 | 1 | 2 | ✅(要改善) |
| 10 | 因子分析 | 2 | 2 | 2 | ❌ |
| 11 | PCA | 1 | 1 | 2 | ⚠️ |
| 12 | テキストマイニング | 1 | 2 | 0 | ⚠️ |
| 13 | 時系列 | 0 | 0 | 2 | ✅ |
| 14 | データ処理 | ~~1~~ 0(修正済) | 1 | 1 | ✅ |
| - | ユーティリティ | 0 | 2 | 2 | ✅(要改善) |
