# Progress Log

## Session Start
- Date: 2026-02-10
- Task: アノテーション・ブラケット描画の詳細検証

## Log
- [Start] タスク計画作成
- [Phase 1] コード解析: utils.js のアノテーション/ブラケットユーティリティ関数を読解
- [Phase 1] コード解析: addSignificanceBrackets (skylineアルゴリズム) の詳細分析
- [Phase 1] コード解析: generateBracketsForGroupedPlot (二要因ANOVA用) の詳細分析
- [Phase 1] 全呼び出し元の調査: 7ファイルでのアノテーション/ブラケット使用を確認
- [Discovery] Bug 1発見: フィルタ条件 `a.x !== -0.15` が旧座標のまま
- [Discovery] Bug 2発見: addSignificanceBracketsがauto-range時にyaxis.range未設定
- [Discovery] Bug 3発見: generateBracketsForGroupedPlotがrecommendedMaxY未返却
- [Fix] utils.js: getTategakiAnnotation/getBottomTitleAnnotationに_annotationType追加
- [Fix] utils.js: addSignificanceBracketsのauto-range修正 + annotation _annotationType追加
- [Fix] 7箇所のフィルタ条件を_annotationType方式に更新
- [Fix] anova_two_way/helpers.js: recommendedMaxY返却
- [Fix] anova_two_way.js: ローカル版も同様修正 + 呼び出し側でyaxis.range設定
- [Fix] anova_two_way/independent.js: 呼び出し側でyaxis.range設定
- [Verify] lint検証: 全修正ファイルでエラーなし
- [Complete] 全修正完了

## Modified Files
1. `js/utils.js` - getTategakiAnnotation, getBottomTitleAnnotation, addSignificanceBrackets
2. `js/analyses/anova_one_way.js` - フィルタ条件
3. `js/analyses/anova_one_way/helpers.js` - フィルタ条件
4. `js/analyses/anova_two_way.js` - フィルタ条件 + ローカルgenerateBrackets + yaxis.range
5. `js/analyses/anova_two_way/independent.js` - フィルタ条件 + yaxis.range
6. `js/analyses/anova_two_way/helpers.js` - recommendedMaxY返却 + _annotationType
7. `js/analyses/eda.js` - 3箇所のフィルタ条件
