# Findings: 可視化品質チェック

## Known Issue (Already Fixed)
- **相関分析 (correlation.js)**: Plotly軸のanchorプロパティ未設定 → 修正済み

## Module Analysis Results

### 1. EDA (eda.js)
- Status: ✅ OK
- ヒストグラム、箱ひげ図、棒グラフ、散布図すべて軸ラベル正常

### 2. t検定 (ttest.js)
- Status: ✅ OK
- 棒グラフ - 軸ラベル・目盛り・タイトル正常

### 3. 一元配置分散分析 (anova_one_way.js)
- Status: ✅ OK
- 棒グラフ - 軸ラベル・目盛り・タイトル正常、多重比較マーク表示

### 4. 二元配置分散分析 (anova_two_way.js)
- Status: ⚠️ 要確認
- 棒グラフ - x軸「クラス」、凡例「性別」正常
- y軸のラベル名（変数名）が表示されていない可能性あり

### 5. 単回帰分析 (regression_simple.js)
- Status: ✅ OK
- 散布図+回帰直線、残差プロット - 軸ラベル正常

### 6. 重回帰分析 (regression_multiple.js)
- Status: ✅ OK
- 残差プロット - 軸ラベル正常

### 7. カイ二乗検定 (chi_square.js)
- Status: ✅ OK
- ヒートマップ - 軸ラベル正常

### 8. マン・ホイットニーU検定 (mann_whitney.js)
- Status: ✅ OK
- 箱ひげ図+ジッタープロット - 軸ラベル正常

### 9. 主成分分析 (pca.js)
- Status: ⚠️ 軽微な問題
- スクリープロット凡例が「trace 0」「trace 1」→ 改善の余地あり
- バイプロットは軸ラベル正常

### 10. 因子分析 (factor_analysis.js)
- Status: ✅ OK
- スクリープロット、負荷量ヒートマップ - 軸ラベル正常

### 11. テキストマイニング (text_mining.js)
- Status: ✅ OK
- ワードクラウド（2種類）- Canvas描画で問題なし

### 12. 時系列分析 (time_series.js)
- Status: ⚠️ 要確認
- 時系列プロット - y軸ラベルが不明確な可能性

## Issues to Fix
1. 二元配置分散分析: y軸ラベル未表示 → 要コード確認
2. 時系列分析: y軸ラベル確認 → 要コード確認
3. PCAスクリープロット: 凡例名改善 → 要コード確認
