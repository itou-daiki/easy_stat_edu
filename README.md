# easyStat - GitHub Pages版

ブラウザ上で動作する統計分析Webアプリケーション（JavaScript版）

## 概要

easyStatは、統計処理をブラウザ上で実行できるようにしたWebアプリケーションです。サーバー不要で、GitHub Pagesなどの静的ホスティングサービスで動作します。

**特徴:**
- 📊 ブラウザ上でPython統計ライブラリを実行
- 🔒 データはブラウザ内で処理（サーバーに送信されません）
- 💻 サーバー不要（完全な静的サイト）

## 実装済み機能（全14機能）

### ✅ データ読み込み
- Excel (.xlsx, .xls)
- CSV（UTF-8, Shift-JIS自動判定）

### ✅ 統計分析機能

1. **データクレンジング**
   - 欠損値の検出と処理
   - 重複行の削除
   - データ型の確認

2. **探索的データ分析（EDA）**
   - 記述統計量
   - ヒストグラム
   - 箱ひげ図

3. **相関分析**
   - ピアソンの相関係数
   - 散布図
   - 回帰直線

4. **カイ二乗検定**
   - クロス集計表
   - 期待度数
   - 独立性の検定

5. **t検定**
   - 対応なし・対応あり
   - 効果量（Cohen's d）
   - 箱ひげ図

6. **一要因分散分析（ANOVA）**
   - F検定
   - 記述統計量
   - 箱ひげ図

7. **二要因分散分析**
   - 2つの要因の主効果
   - 記述統計量
   - 箱ひげ図（各要因）

8. **単回帰分析**
   - 回帰係数
   - 決定係数（R²）
   - 残差プロット

9. **重回帰分析**
   - 複数の説明変数
   - 調整済みR²
   - 予測値vs実測値

10. **主成分分析（PCA）**
    - 寄与率
    - 主成分散布図
    - 次元削減

11. **因子分析（PCAベース）**
    - 因子負荷量
    - スクリープロット
    - ヒートマップ

12. **テキストマイニング（簡易版）**
    - 頻出単語抽出
    - 単語出現回数
    - 横棒グラフ

**🎉 全ての統計分析機能が実装完了しました！**

## 使い方

### 1. データのアップロード

1. 分析機能を選択
2. Excel または CSV ファイルをアップロード
3. 変数を選択して分析を実行

### ２. 結果の確認

- 統計量の表
- グラフ（PNG形式で表示）
- 結果の解釈

## GitHub Pagesへのデプロイ

### 方法1: docsフォルダを使用

1. GitHubリポジトリの設定 → Pages
2. Source: "Deploy from a branch"
3. Branch: `master` または `main`
4. Folder: `/docs`
5. Save

### 方法2: GitHub Actionsを使用

`.github/workflows/pages.yml` を作成:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Setup Pages
        uses: actions/configure-pages@v3
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: 'docs'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

## 技術スタック

- **PyScript 2024.1.1**: ブラウザでPythonを実行
- **Python ライブラリ**:
  - pandas: データ処理
  - numpy: 数値計算
  - scipy: 統計検定
  - scikit-learn: 機械学習（PCA等）
  - matplotlib: グラフ描画
  - openpyxl: Excel読み込み

- **フロントエンド**:
  - HTML5
  - CSS3（カスタムスタイル）
  - JavaScript（ES6+）

## 注意事項

### パフォーマンス

- **初回読み込み**: PyScriptとPythonパッケージの読み込みに数分かかる場合があります
- **大規模データ**: ブラウザのメモリ制限により、大規模データ（数万行以上）の処理には向きません
- **グラフ描画**: matplotlibを使用しているため、インタラクティブなグラフではありません

### 制限事項

1. **ライブラリの制限**
   - MeCab等のネイティブライブラリは動作しません
   - 一部のPythonパッケージはPyScriptで利用できません

2. **ブラウザ互換性**
   - モダンブラウザ（Chrome, Firefox, Edge, Safari最新版）推奨
   - Internet Explorerは非対応

3. **セキュリティ**
   - ファイルはブラウザ内で処理され、サーバーに送信されません
   - 機密データの処理も可能ですが、ブラウザのセキュリティ設定に依存します

## カスタマイズ

### CSSのカスタマイズ

`docs/css/style.css` を編集してデザインを変更できます。

### 分析機能の追加

1. `docs/py/common.py` に分析関数を追加
2. `docs/js/utils.js` にUI制御関数を追加
3. `docs/index.html` にナビゲーションカードを追加

## ライセンス

© 2022-2025 Dit-Lab.(Daiki Ito). All Rights Reserved.

easyStat: Open Source for Ubiquitous Statistics
Democratizing data, everywhere.

## サポート

- [GitHub Issues](https://github.com/itou-daiki/easy_stat/issues)
- [フィードバックフォーム](https://forms.gle/G5sMYm7dNpz2FQtU9)

## Special Thanks

- Toshiyuki: 回帰分析機能の実装
- easyStatコミュニティの皆様
