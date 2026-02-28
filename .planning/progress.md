# easyStat 自律改善ログ

## ベースライン (2026-02-28)
- テスト: 224 passed / 1 skipped / 0 failed
- 分析モジュール: 24個
- Ground Truth検証: 12種の統計テスト

## Iteration 1: 統計ロジック監査 + バグ修正
- **変更**: 4並列エージェントで全24モジュールの統計ロジックを監査。7件のMEDIUM問題を修正。
- **修正内容**:
  1. McNemar phi: sqrt(chi2/N) → sqrt(chi2/(b+c)) (不一致ペアのみ使用)
  2. ロジスティック回帰: 「確率が増加」→「オッズがX倍」(統計的に正確な表現)
  3. Kruskal-Wallis効果量: η²_H → ε² (公式: (H-k+1)/(N-1))
  4. 反復測定ω²: 被験者間公式 → partial omega-squared
  5. PCA負荷量ヘッダー: 「固有ベクトル」→「主成分負荷量」
  6. Fisher正確検定: デッドコード削除
  7. 二元配置反復Tukey: Bonferronフォールバック明記
- **結果**: テスト 224 passed / 0 failed
- **判定**: 採用 (全テスト通過)

## Iteration 2: Ground Truth精度テスト拡張
- **変更**: scipy.statsで6種の新規ground truth生成、4つの新規精度テスト追加
- **追加テスト**: Mann-Whitney U, Kruskal-Wallis H, 対応ありt検定, 1標本t検定
- **結果**: テスト 228 passed (+4) / 1 skipped / 0 failed
- **判定**: 採用 (全テスト通過、カバレッジ向上)
- **Ground Truthカバレッジ**: 12 → 18種の統計テスト

## Iteration 3: 精度テスト完全カバレッジ
- **変更**: 3つの新規精度テスト追加 + Mixed ANOVA Ground Truth修正
- **追加テスト**:
  1. Spearman順位相関 (rho=0.992 vs ground truth)
  2. Wilcoxon符号付順位検定 (T=33.0, p<.001 vs ground truth)
  3. 混合ANOVA (2x2設計: 性別×{数学,英語}) - 以前skippedだったテストを修正・有効化
- **修正内容**:
  - Mixed ANOVA Ground Truth: 3条件設計(UI非対応)→2x2設計(UI対応)に変更
  - Spearman: 分析実行後にメソッドセレクタ切り替え（動的UI対応）
  - Wilcoxon: p<.001表示のパース処理を修正
- **結果**: テスト 231 passed (+3, skipped 0) / 0 failed
- **判定**: 採用 (全テスト通過、全Ground Truthに精度テスト完備)

## Iteration 4: McNemar精度テスト追加
- **変更**: McNemar検定のGround TruthとAccuracy Test追加
- **追加内容**:
  1. McNemar Ground Truth (scipy.stats): chi2=7.118, exact_p=0.01273, OR=0.214
  2. McNemar精度テスト: mcnemar_test.csvを使用した独立describe block
  3. 既存Logistic Regressionは完全分離データのため精度テスト非対象（Nagelkerke R²=1.0）
- **結果**: テスト 232 passed (+1) / 0 failed
- **判定**: 採用

## 現在の状態
- テスト: 232 passed / 0 skipped / 0 failed
- CRITICAL/HIGH バグ: 0
- Ground Truth検証: 19種 全てに精度テスト完備
  - t検定3種 (独立, 対応あり, 1サンプル)
  - ANOVA4種 (一元配置, 二元配置独立, 反復測定, 混合)
  - 相関2種 (Pearson, Spearman)
  - カイ二乗1種, McNemar1種
  - 回帰2種 (単回帰, 重回帰)
  - PCA1種, FA1種
  - Mann-Whitney1種, Wilcoxon1種, Kruskal-Wallis1種
  - テキストマイニング1種 (統合テスト)
- 既知の制限:
  - 二元配置ANOVA混合/反復のGG補正は未実装（注記あり）
  - 因子分析はPCA抽出法を使用（iterative PAFではない）
  - TF-IDF集計は文書横断合算方式
  - Fisher正確検定: RxC表のMonte Carlo法は非決定的→精度テスト困難
  - ロジスティック回帰: デモデータが完全分離→精度テスト非対象

## Iteration 5: 説明文と実装ロジックの不一致修正
- **変更**: 4並列エージェントで全モジュールの説明文 vs 実装ロジック監査。HIGH=2, MEDIUM=11の不一致を修正。
- **修正内容**:
  - HIGH-1: Wilcoxon「Steel-Dwass」誤記 → 「ペアワイズWilcoxon検定（Holm補正）」に全12箇所修正
  - HIGH-2: McNemar φ計算式説明修正: √(χ²/N) → √(χ²/(b+c))
  - MEDIUM-1: interpretANOVA η²/ηp² 区別: isPartialフラグ追加、反復測定ANOVAでηp²表記
  - MEDIUM-2: Mann-Whitney有意性記号統一: *** → ** p<.01, * p<.05, † p<.10, n.s.
  - MEDIUM-3: McNemar有意性記号統一: 同上
  - MEDIUM-4: 相関「リストワイズ削除」→「ペアワイズ削除」(実装通り)
  - MEDIUM-5: PCA脚注「因子負荷量」→「主成分負荷量」
  - MEDIUM-6: FA JSDoc「主因子法」→「主成分法ベースの因子抽出」
  - MEDIUM-7: FA概要にPromax, Oblimin, Geomin回転の説明追加
  - MEDIUM-8: 斜交回転累積寄与率の注釈追加（直交回転との違い）
  - MEDIUM-9: テキストマイニング「品詞」→「単語」（TinySegmenterはPOS不使用）
- **結果**: テスト 232 passed / 0 failed
- **判定**: 採用 (全テスト通過)

## 最終状態
- テスト: 232 passed / 0 skipped / 0 failed
- CRITICAL/HIGH バグ: 0
- 説明文-実装ロジック不一致: 0 (HIGH+MEDIUM全修正済み)
- Ground Truth検証: 19種 全てに精度テスト完備

## 収束宣言 (統計ロジック)
- **判定**: 収束 (統計ロジック + 説明文の整合性確認完了)
- **残存改善余地**: デモデータ作成が必要な項目のみ（コード品質問題ではない）

---

## Iteration 6: 森山潤先生の論文スタイルトレース
- **変更**: Playwright MCP browserで森山先生の論文4本からスクリーンショットを取得し、統計表・図のスタイルを分析。全20モジュールの可視化を学術論文スタイルに統一。
- **参照論文**:
  1. DigComp尺度論文 (教育システム情報学会誌, 2023) - CFA パス図、bifactor model、因子負荷量表
  2. デジタル教科書論文 (教育メディア研究, 2021) - 因子分析表、ANOVA表、記述統計量
  3. エンゲージメント尺度論文 (日本産業技術教育学会誌, 2023) - EFA表、Mann-Whitney、Kruskal-Wallis
  4. CT尺度論文 (日本教育工学会論文誌, 2022) - 群比較表、CFA適合度指標
- **特定したスタイルパターン**:
  - 三線表（上2px、ヘッダ下1px、下2px、縦線なし）
  - 表キャプション中央揃え「表N タイトル」形式
  - 有意性表記: *p<.05  **p<.01  ***p<.001（脚注、非イタリック）
  - 因子負荷量は≥.30/.40で太字
  - F値形式: F(df1,df2)=値 + 有意記号
  - η²は独立列
  - Times New Roman / serifフォント
- **実装内容**:
  - `js/utils.js`: `getAcademicLayout()`, `deepMergeLayout()`, `academicColors` 追加、`generateAPATableHtml()` を三線表スタイルに更新
  - 全20分析モジュールの Plotly チャートに学術スタイル適用:
    - academicColors パレットに統一（primary=#2c5f8a, accent=#d4544a等）
    - serifフォント（Times New Roman, Noto Serif JP, 游明朝）
    - 白背景 + グリッド線 + 軸枠線
    - divergingScale（相関）、heatmapScale（カイ二乗等）の統一
  - 更新ファイル: anova_one_way.js, anova_two_way.js, chi_square.js, correlation.js, correlation/visualization.js, cross_tabulation.js, eda.js, eda/visualization.js, factor_analysis/visualization.js, fisher_exact.js, kruskal_wallis.js, logistic_regression.js, mann_whitney.js, mcnemar.js, pca/visualization.js, regression_multiple/visualization.js, regression_simple.js, time_series.js, ttest/visualization.js, wilcoxon_signed_rank.js
- **結果**: テスト 256 passed / 0 failed
- **判定**: 採用 (全テスト通過、可視化スタイル統一完了)
