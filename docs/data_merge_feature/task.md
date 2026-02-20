# データ結合（マージ）機能の実装

## Phase 1: テスト準備（TDD: RED）
- [x] テスト用CSVデータの作成（`merge_test_1.csv`, `merge_test_2.csv`）
- [x] E2Eテストの作成（`tests/data_merge.spec.ts`）

## Phase 2: カード追加・ナビゲーション修正
- [x] `index.html` にデータ結合カードを追加
- [x] `main.js` のデータ未ロード時のクリック制御を修正

## Phase 3: 機能実装（TDD: GREEN）
- [x] `js/analyses/data_merge.js` の実装
  - [x] render() UIスケルトン
  - [x] ファイルアップロード処理
  - [x] 共通カラム検出・選択UI
  - [x] 結合ロジック（inner/left/outer）
  - [x] 結果プレビュー表示
  - [x] ダウンロード機能

## Phase 4: 検証
- [x] E2Eテスト実行（4/4 GREEN ✅）
- [x] ブラウザ目視確認
