# GitHub Pages デプロイガイド

このガイドでは、easyStatをGitHub Pagesにデプロイする方法を説明します。

## 前提条件

- GitHubアカウント
- GitHubリポジトリへのプッシュ権限
- 基本的なGitの知識

## デプロイ方法

### ステップ1: リポジトリの準備

1. GitHubリポジトリに `docs` フォルダがコミットされていることを確認

```bash
git add docs/
git commit -m "Add GitHub Pages support with PyScript"
git push origin master
```

### ステップ2: GitHub Pagesの設定

1. GitHubリポジトリのページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Pages** をクリック
4. **Source** セクションで:
   - Branch: `master` (または `main`)
   - Folder: `/docs`
   - **Save** ボタンをクリック

### ステップ3: デプロイの確認

数分後、GitHub Pagesのセクションに以下のように表示されます:

```
Your site is live at https://[username].github.io/easy_stat_edu/
```

このURLにアクセスして、アプリケーションが正しく動作することを確認してください。

## デプロイ後の確認事項

### 1. 初回読み込み時間

- PyScriptとPythonパッケージの読み込みに3-5分かかる場合があります
- ローディング画面が表示されている間、お待ちください
- ブラウザコンソール（F12）で読み込み状況を確認できます

### 2. 機能テスト

以下の機能が動作することを確認してください:

1. ファイルアップロード（Excel/CSV）
2. 相関分析
3. t検定
4. その他の分析機能

### 3. エラーが発生した場合

ブラウザコンソール（F12 → Console）でエラーメッセージを確認してください。

よくあるエラー:
- **CORS エラー**: ローカルでテストする場合は、HTTPサーバーを使用してください
- **PyScript読み込みエラー**: インターネット接続を確認してください（CDNから読み込まれます）
- **ファイル読み込みエラー**: ファイルパスが正しいことを確認してください

## カスタムドメインの設定（オプション）

カスタムドメインを使用する場合:

1. `docs` フォルダに `CNAME` ファイルを作成
2. カスタムドメイン名を記載（例: `easystat.example.com`）
3. DNSプロバイダーでCNAMEレコードを設定

## アップデートのデプロイ

コードを更新した場合:

```bash
# 変更をコミット
git add docs/
git commit -m "Update analysis features"

# GitHubにプッシュ
git push origin master
```

数分後、GitHub Pagesが自動的に更新されます。

## トラブルシューティング

### 問題: ページが表示されない

**解決方法:**
1. リポジトリがパブリックになっていることを確認
2. GitHub Pagesの設定を確認
3. `docs/index.html` が存在することを確認

### 問題: PyScriptが読み込まれない

**解決方法:**
1. インターネット接続を確認
2. ブラウザのキャッシュをクリア
3. PyScriptのCDN URLが正しいことを確認（`docs/index.html`）

### 問題: 分析機能が動作しない

**解決方法:**
1. ブラウザコンソールでエラーを確認
2. `docs/py/common.py` と `docs/js/utils.js` が正しく読み込まれているか確認
3. PyScriptが完全に読み込まれるまで待つ

## パフォーマンス最適化

### 1. ファイルサイズの削減

不要なファイルを削除:
```bash
# 不要な画像やデータセットを削除
rm -rf docs/datasets/large_files/*
```

### 2. キャッシング

ブラウザキャッシュを有効にするため、`docs/.htaccess` を追加（Apache使用時）:

```apache
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
</IfModule>
```

### 3. CDNの利用

PyScriptとその他のライブラリは既にCDNから読み込まれていますが、カスタムアセットもCDNを利用できます。

## セキュリティ考慮事項

1. **データのプライバシー**
   - すべてのデータ処理はブラウザ内で完結
   - サーバーにデータは送信されません
   - ただし、GitHub Pagesはアクセスログを記録します

2. **HTTPSの使用**
   - GitHub Pagesは自動的にHTTPSを有効化
   - カスタムドメインでもHTTPSが利用可能

3. **認証・アクセス制限**
   - GitHub Pagesは基本的にパブリック
   - プライベートリポジトリでも、Pagesは公開されます
   - アクセス制限が必要な場合は、他のホスティングサービスを検討

## さらなるカスタマイズ

### GitHub Actionsを使用した自動デプロイ

`.github/workflows/pages.yml`:

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

### アナリティクスの追加

Google Analyticsを追加する場合、`docs/index.html` の `<head>` セクションに追加:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

## サポート

問題が発生した場合:

1. [GitHub Issues](https://github.com/itou-daiki/easy_stat/issues) で報告
2. [フィードバックフォーム](https://forms.gle/G5sMYm7dNpz2FQtU9) で連絡
3. ブラウザコンソールのエラーメッセージをスクリーンショット

---

© 2022-2025 Dit-Lab.(Daiki Ito). All Rights Reserved.
