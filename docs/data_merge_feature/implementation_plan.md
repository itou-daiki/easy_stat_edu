# Excelファイル結合機能（データマージ）の実装計画

## 概要

[easy_xl_merge](https://github.com/itou-daiki/easy_xl_merge)の機能をeasyStatに統合する。  
2つのExcel/CSVファイルをアップロードし、共通カラムをキーにデータを結合し、結果をダウンロードできるようにする。

> [!IMPORTANT]
> **この機能はデータアップロード不要で使用可能**にする（`data-requires="none"`）。  
> 機能専用の2ファイルアップローダーを画面内に設置する。

---

## TDD開発フロー

```mermaid
graph LR
    A[テスト作成] --> B[テスト実行<br>RED] --> C[実装] --> D[テスト実行<br>GREEN] --> E[リファクタリング]
```

1. **Phase 1**: E2Eテストを先にスケルトンで作成（Playwright）
2. **Phase 2**: ロジックのユニットテスト作成
3. **Phase 3**: UIとロジックを実装してテストを通す
4. **Phase 4**: ブラウザでの目視確認

---

## 変更ファイル

### [NEW] [data_merge.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/analyses/data_merge.js)

新しい分析モジュール。`export function render(container, currentData, dataCharacteristics)` を実装。

**主要機能:**
- 2つのファイルアップロードUI（ドラッグ&ドロップ対応）
- 各ファイルのデータプレビュー（テーブル表示）
- 共通カラムの自動検出と選択UI
- 結合タイプ選択（内部結合 / 外部結合）
- 結合実行と結果プレビュー
- Excel/CSVダウンロード

**特記事項:**
- `currentData`が`null`でも動作する設計（トップのデータ未アップロード時も使用可能）
- XLSX ライブラリはグローバルスコープに読み込み済み

---

### [MODIFY] [index.html](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/index.html)

ユーティリティカテゴリに「データ結合」カードを追加：

```html
<div class="feature-card" data-analysis="data_merge" data-requires="none">
    <h3 class="feature-card-title">
        <i class="fas fa-object-group feature-card-icon"></i>
        データ結合（マージ）
    </h3>
    <p class="feature-card-description">2つのファイルを共通キーで結合</p>
</div>
```

---

### [MODIFY] [main.js](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/js/main.js)

- `showAnalysisView()`の先頭で `data-requires="none"` のカードはデータ未ロードでも遷移可能にする
- 現在のコードでは `featureGrid.addEventListener('click', ...)` がトップで `!currentData` ならエラーを出すが、`data-requires="none"` の場合はスキップさせる

---

### [NEW] [data_merge.spec.ts](file:///Users/itoudaiki/Library/CloudStorage/GoogleDrive-itou-daiki@oen.ed.jp/マイドライブ/07　Program/easy_stat_edu/tests/data_merge.spec.ts)

E2Eテスト（Playwright）：
1. ページ読み込み → データ結合カードをクリック（データ未アップロード状態で遷移できること）
2. 2つのファイルをアップロード → プレビュー表示確認
3. 共通カラム選択 → 結合タイプ選択 → 結合実行
4. 結果テーブルの表示確認
5. ダウンロードボタンの存在確認

---

### [NEW] テスト用データ

| ファイル | 内容 |
|---|---|
| `datasets/merge_test_1.csv` | ID, 名前, 点数A |
| `datasets/merge_test_2.csv` | ID, 名前, 点数B |

---

## 結合ロジック仕様

```javascript
// inner join: 両方に存在するキーのみ
// outer join: いずれかに存在するキーをすべて保持（欠損はnull）
function mergeData(data1, data2, keyColumn, joinType) { ... }
```

| 結合タイプ | 日本語名 | 説明 |
|---|---|---|
| `inner` | 内部結合 | 両ファイルに共通するデータのみ |
| `left` | 左結合 | 1つ目のファイルを基準に結合 |
| `outer` | 外部結合 | 全データを保持（欠損はnull） |

---

## 検証計画

### 自動テスト
```bash
npx playwright test tests/data_merge.spec.ts
```

### ブラウザ目視確認
- データ未アップロード状態でカードクリック → 正常に遷移
- 2ファイルのアップロード → プレビュー表示
- 結合実行 → 結果確認
- ダウンロード動作確認
