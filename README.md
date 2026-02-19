# easyStat - ブラウザで完結する統計分析アプリ

**完全なクライアントサイド実行・インストール不要・高速動作**

## 概要

easyStatは、モダンなブラウザだけで動作する統計分析Webアプリケーションです。
**サーバーへのデータ送信は一切行わず**、すべての計算とグラフ描画をユーザーのデバイス内で完結させます。そのため、機密性の高いデータも安全に扱うことができます。

従来のPyScript版から**完全なJavaScript実装**に移行したことで、以下のメリットが生まれました：
- 🚀 **高速な起動**: Python環境のロード待ち時間がゼロに
- 📱 **オフライン動作**: 一度読み込めばネット環境がなくても動作
- 🔒 **高セキュリティ**: データはブラウザから出ません

## 実装済み機能（全14機能）

### 📊 データ処理
1. **データ読み込み**: Excel (.xlsx, .xls) および CSV (Shift-JIS/UTF-8自動判定)
2. **データクレンジング**: 欠損値処理、外れ値除去、データ型変換
3. **探索的データ分析 (EDA)**: 要約統計量、ヒストグラム、箱ひげ図、散布図

### 📈 統計解析
4. **相関分析**: ピアソンの積率相関係数、相関行列、散布図行列
5. **t検定**: 対応なし（独立）/ 対応あり（関連）、効果量 (Cohen's d)
6. **一要因分散分析 (One-way ANOVA)**: 3群以上の平均値比較、多重比較
7. **二要因分散分析 (Two-way ANOVA)**: 2要因の主効果と交互作用

### 🔮 多変量解析・予測
8. **単回帰分析**: 最小二乗法による単回帰モデル
9. **重回帰分析**: 偏回帰係数、モデル適合度 ($R^2$, 調整済み$R^2$)
10. **主成分分析 (PCA)**: 次元削減、寄与率、バイプロット
11. **因子分析**: 因子負荷量、スクリープロット（主因子法・バリマックス回転近似）
12. **カイ二乗検定**: クロス集計表、独立性の検定 ($χ^2$)

### 📝 テキスト分析
13. **テキストマイニング**: 形態素解析 (`kuromoji.js`)、ワードクラウド
14. **記述統計・可視化**: 基本的なデータの要約とグラフ化

## 使い方

1. **アクセス**: ブラウザでページを開きます（インストール不要）。
2. **機能選択**: ホーム画面から行いたい分析機能カードをクリックします。
3. **データアップロード**: ExcelまたはCSVファイルをドラッグ＆ドロップします。
4. **変数選択**: 分析に使用する変数（列）を選択し「分析実行」をクリックします。
5. **結果確認**: 結果の表とインタラクティブなグラフが表示されます。
6. **保存**: 加工済みデータやグラフ画像をダウンロードできます。

## 技術スタック

本アプリケーションは、外部APIやバックエンドサーバーに依存しない**Pure JavaScript (SPA)** で構築されています。

- **Core**: Vanilla JavaScript (ES6+)
- **UI/CSS**: Custom CSS, Font Awesome
- **Computation**:
    - `jStat`: 統計検定 (t-test, ANOVA, chi-square, etc.)
    - `math.js`: 行列演算、高度な数学計算
- **Visualization**:
    - `Plotly.js`: インタラクティブなグラフ描画
    - `wordcloud2.js`: ワードクラウド生成
- **Data Handling**:
    - `SheetJS (xlsx)`: Excel/CSVファイルの読み書き
- **NLP**:
    - `kuromoji.js`: ブラウザ内日本語形態素解析

## 統計処理ロジックの検証

本プロジェクトの全ての統計処理ロジックは、統計学・データサイエンス・エンジニアリングの3つの専門的視点から包括的に検証されています。

### 検証済み項目

| カテゴリ | 手法 | 検証状態 |
|---------|------|---------|
| 相関分析 | Pearson r, Spearman ρ, Fisher z変換CI, p値 | 検証済み |
| t検定 | Welch t, Welch-Satterthwaite df, 対応ありt, 1標本t | 検証済み |
| 分散分析 | SS計算, F比, η², ω², GG epsilon, 多重比較 (Tukey/Holm/Bonferroni) | 検証済み |
| 回帰分析 | OLS推定, R², 調整済みR², F検定, VIF, 切片の統計量 | 検証済み |
| カイ二乗検定 | χ², Cramér's V, 調整済み残差, Yates補正 | 検証済み |
| Mann-Whitney U | U統計量, タイ補正, Z正規近似, 効果量r | 検証済み |
| PCA | 相関行列の固有値分解, PC得点, 累積寄与率 | 検証済み |
| 因子分析 | 主成分抽出, Varimax/Promax/Oblimin/Geomin回転 | 検証済み |
| EDA | 記述統計, 歪度(Fisher調整), 尖度(過剰尖度) | 検証済み |

### 2026-02-19 統計ロジック修正

以下の問題を特定し修正しました（TDDにて実施）:

- **EDA標準偏差**: 母集団SD(n除算) → 標本SD(n-1除算)に修正
- **GG epsilon**: Greenhouse-Geisser epsilonの分子を正しい`trace(S̃)²`に修正
- **Levene検定**: 平均値ベース → 中央値ベース(Brown-Forsythe変法)に変更
- **対応ありt検定**: 効果量ラベルを`d` → `d_z`に修正（教育的明確化）
- **Mann-Whitney U**: Z値を絶対値で報告するよう修正
- **単回帰分析**: 切片のSE/t値/p値を追加
- **1標本t検定**: p<0.1の傾向有意水準(†)を他の検定と統一
- **カイ二乗検定**: Yates補正に関するドキュメント不整合を修正

### 2026-02-19 表記・表示修正

以下の問題を特定し修正しました（TDDにて実施）:

- **時系列分析**: `createPlotlyConfig()`の誤ったプロパティアクセス(`.layout`/`.config`)を修正
- **有意記号統一**: 全モジュール（単回帰・重回帰・カイ二乗・相関）の有意記号チェインを `** / * / † / n.s.` に統一
- **相関APA表**: 傾向有意(† p<.10)をAPA表データセルと注釈に追加
- **因子分析回転ラベル**: varimax/none のみ → promax/oblimin/geomin にも対応
- **PCA用語**: 「因子負荷量」→「主成分負荷量」に修正（PCA固有の用語を使用）
- **Mann-Whitney表ヘッダ**: 「Z値」→「|Z|」に修正（絶対値表記の統一）
- **単回帰**: 負の切片表示を `+ -1.234` → `- 1.234` に改善

## 開発者向け情報

### プロジェクト構成

```
easy_stat_edu/
├── js/
│   ├── analyses/          # 統計分析モジュール（16エントリ + サブモジュール）
│   │   ├── anova_one_way.js   # 一要因分散分析（LIVE）
│   │   ├── anova_two_way.js   # 二要因分散分析（LIVE）
│   │   ├── correlation.js     # 相関分析
│   │   ├── ttest.js           # t検定
│   │   ├── chi_square.js      # カイ二乗検定
│   │   ├── mann_whitney.js    # Mann-Whitney U検定
│   │   ├── regression_simple.js  # 単回帰分析
│   │   ├── regression_multiple.js # 重回帰分析
│   │   ├── pca.js             # 主成分分析
│   │   ├── factor_analysis.js # 因子分析
│   │   ├── eda.js             # 探索的データ分析
│   │   ├── time_series.js     # 時系列分析
│   │   ├── text_mining.js     # テキストマイニング
│   │   └── */                 # 各モジュールのヘルパー・可視化サブモジュール
│   ├── utils.js               # 共通ユーティリティ（Levene検定、APA表生成等）
│   └── utils/stat_distributions.js  # 統計分布（Tukey, Holm補正, Gamma関数）
├── tests/
│   ├── unit/              # ユニットテスト（統計ロジック検証）
│   ├── verification/      # 精度検証テスト
│   └── *.spec.ts          # E2E / スモークテスト
└── css/                   # スタイルシート
```

### アーキテクチャノート

- **モジュールロード**: `main.js`が`index.html`のdata-analysis属性に基づいて動的にモジュールをインポート
- **ANOVA**: モノリシックファイル(`anova_one_way.js`, `anova_two_way.js`)がLIVEコード。サブフォルダ版はデッドコード
- **統計ライブラリ**: jStat (CDN), math.js (CDN) をグローバルスコープで使用

### テストの実行

```bash
# 全テスト実行
npx playwright test

# 統計ロジック検証テスト
npx playwright test tests/unit/statistical_logic_validation.spec.ts

# 精度検証テスト
npx playwright test tests/verification/

# テストレポート表示
npx playwright show-report
```

### GitHub Pagesへのデプロイ
1. リポジトリの `Settings` -> `Pages` を開く。
2. Sourceを `Deploy from a branch` に設定。
3. Branchを `main` (または `master`) の `/ (root)` または `/docs` に設定してSave。

## ライセンス

© 2022-2026 Dit-Lab.(Daiki Ito). All Rights Reserved.
easyStat: Open Source for Ubiquitous Statistics
 Democratizing data, everywhere.

## サポート

- [GitHub Issues](https://github.com/itou-daiki/easy_stat-edu/issues)
