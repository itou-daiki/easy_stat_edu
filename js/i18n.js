const LOCALE_STORAGE_KEY = 'easyStat.locale';
const SUPPORTED_LOCALES = new Set(['ja', 'en']);

const ENGLISH_TEXT = new Map([
    ['easyStat を読み込み中...', 'Loading easyStat...'],
    ['easyStat - ブラウザ統計分析アプリ', 'easyStat - Browser-based statistical analysis'],
    ['easyStat - 初学者のためのやさしいマニュアル', 'easyStat - User Guide'],
    ['分析エンジンの初期化をしています', 'Initializing the analysis engine'],
    ['数秒で起動します', 'This should take only a few seconds'],
    ['使い方マニュアル', 'User Guide'],
    ['表示言語', 'Display language'],
    ['可視化ライブラリを読み込み中...', 'Loading visualization libraries...'],
    ['ブラウザ上で簡単かつ高速に統計分析　-データ駆動型探究を促進-', 'Fast, browser-based statistical analysis for data-driven inquiry'],
    ['生成AIによる解釈支援', 'Generative AI interpretation support'],
    ['未設定', 'Not configured'],
    ['設定済み', 'Configured'],
    ['結果表と注意点を整理したAI用テキストを作成します。ローカル実行では成人の教員・研究者がGeminiへ直接接続することもできます。', 'Create AI-ready text that organizes result tables and cautions. Adult educators and researchers can also connect directly to Gemini when running easyStat locally.'],
    ['Gemini APIキーの取得方法（18歳以上の教員・研究者向け）', 'Getting a Gemini API key (educators and researchers aged 18+)'],
    ['APIキーの安全な管理', 'Secure API key management'],
    ['利用条件とデータの扱い', 'Terms and data handling'],
    ['18歳以上で、APIの利用条件と送信データの扱いを確認しました', 'I am aged 18 or older and have reviewed the API terms and data handling'],
    ['利用条件を確認', 'Review terms'],
    ['コピーのみ', 'Copy only'],
    ['このページで使用中', 'Active on this page'],
    ['Gemini APIの規約では利用者は18歳以上である必要があります。高校生の授業では生徒にAPIキーを入力させず、「AI用テキストをコピー」して学校が承認したサービスを利用してください。', 'Gemini API users must be aged 18 or older. In secondary-school classes, students should not enter API keys; use Copy AI prompt with a school-approved service instead.'],
    ['無料枠では入力と回答がGoogleの製品改善に使われる場合があります。個人情報、成績原票、自由記述などの機密データは送信しないでください。', 'Free-tier inputs and outputs may be used by Google for product improvement. Do not submit personal information, student records, free text, or other confidential data.'],
    ['ファイル', 'File'],
    ['表を入力', 'Paste table'],
    ['ここにファイルをドラッグ＆ドロップ', 'Drag and drop a file here'],
    ['ファイルを選択', 'Choose file'],
    ['デモデータを試す', 'Try demo data'],
    ['デモデータを選択', 'Choose a demo dataset'],
    ['分析目的に合わせたデータセットを選択してください。', 'Choose a dataset that matches your analysis goal.'],
    ['クリックするとデータが読み込まれます。', 'Select a dataset to load it.'],
    ['総合デモデータ (推奨)', 'Comprehensive demo (recommended)'],
    ['ICT教育調査データ・全機能対応', 'ICT education survey data for all analysis features'],
    ['t検定用データ', 't-test demo'],
    ['DigComp群別の学習成果比較', 'Compare learning outcomes across DigComp groups'],
    ['分散分析用データ (ANOVA)', 'ANOVA demo'],
    ['ICT指導法×学校種の比較実験', 'Compare ICT teaching methods across school types'],
    ['重回帰分析用データ', 'Multiple-regression demo'],
    ['オンライン学習成果の予測モデル', 'Predict online-learning outcomes'],
    ['因子分析・PCA用データ', 'Factor-analysis and PCA demo'],
    ['ICT教育態度尺度（3因子15項目）', 'ICT education attitude scale (3 factors, 15 items)'],
    ['テキストマイニング用', 'Text-mining demo'],
    ['ICT教育の自由記述アンケート', 'Open-ended responses about ICT education'],
    ['時系列分析用データ', 'Time-series demo'],
    ['ICT教育導入の3年間経時変化', 'Three-year change after introducing ICT education'],
    ['ロジスティック回帰用データ', 'Logistic-regression demo'],
    ['ICT活用能力認定の合否予測', 'Predict pass/fail outcomes for ICT competency certification'],
    ['分析機能を選択', 'Choose an analysis'],
    ['分析サポーター', 'Analysis guide'],
    ['データ加工', 'Data preparation'],
    ['データ結合', 'Merge data'],
    ['探索的データ分析', 'Exploratory data analysis'],
    ['クロス集計', 'Cross-tabulation'],
    ['相関分析', 'Correlation analysis'],
    ['t検定', 't Tests'],
    ['一元配置分散分析', 'One-way ANOVA'],
    ['二元配置分散分析', 'Two-way ANOVA'],
    ['マン・ホイットニーのU検定', 'Mann–Whitney U test'],
    ['クラスカル・ウォリス検定', 'Kruskal–Wallis test'],
    ['ウィルコクソンの符号付順位検定', 'Wilcoxon signed-rank test'],
    ['マクネマー検定', 'McNemar test'],
    ['カイ二乗検定', 'Chi-square test'],
    ['フィッシャーの正確確率検定', "Fisher's exact test"],
    ['単回帰分析', 'Simple linear regression'],
    ['重回帰分析', 'Multiple regression'],
    ['ロジスティック回帰分析', 'Logistic regression'],
    ['因子分析', 'Factor analysis'],
    ['主成分分析', 'Principal component analysis'],
    ['時系列分析', 'Time-series analysis'],
    ['テキストマイニング', 'Text mining'],
    ['因子得点の算出', 'Factor score calculation'],
    ['検定タイプを選択して分析を実行します', 'Choose a test type and run the analysis'],
    ['分析の概要・方法', 'Overview and method'],
    ['分析ロジック・計算式詳説 (専門家向け)', 'Statistical logic and formulas'],
    ['分析ロジック・計算式詳説（専門家向け）', 'Statistical logic and formulas'],
    ['検定タイプを選択:', 'Choose a test type:'],
    ['対応なしt検定', 'Independent-samples t test'],
    ['対応ありt検定', 'Paired-samples t test'],
    ['1サンプルのt検定', 'One-sample t test'],
    ['2つの独立したグループ間の平均値を比較', 'Compare means from two independent groups'],
    ['同じ対象の2つの測定値を比較（前後比較など）', 'Compare two measurements from the same cases'],
    ['標本の平均値を特定の値と比較', 'Compare a sample mean with a reference value'],
    ['グループ変数（カテゴリ変数、2群）を選択:', 'Select a grouping variable (two categories):'],
    ['従属変数を選択（複数選択可）:', 'Select outcome variables (multiple allowed):'],
    ['変数を選択...', 'Select variables...'],
    ['選択してください...', 'Select...'],
    ['対応なしt検定を実行', 'Run independent-samples t test'],
    ['対応ありt検定を実行', 'Run paired-samples t test'],
    ['1サンプルのt検定を実行', 'Run one-sample t test'],
    ['要約統計量', 'Descriptive statistics'],
    ['変数名', 'Variable'],
    ['変数', 'Variable'],
    ['有効N', 'Valid N'],
    ['平均値', 'Mean'],
    ['平均', 'Mean'],
    ['中央値', 'Median'],
    ['標準偏差', 'Standard deviation'],
    ['分散', 'Variance'],
    ['最小値', 'Minimum'],
    ['最大値', 'Maximum'],
    ['平均値の差の検定（対応なし）', 'Independent-samples t test'],
    ['平均値の差の検定（対応あり）', 'Paired-samples t test'],
    ['差の検定', 'Test of difference'],
    ['効果量(d)', 'Effect size (d)'],
    ['効果量(dz)', 'Effect size (dz)'],
    ['平均差の', 'Mean difference'],
    ['論文報告用テーブル (APAスタイル風)', 'Publication-ready table (APA style)'],
    ['結果の解釈', 'Interpretation'],
    ['可視化', 'Visualization'],
    ['サンプルサイズ', 'Sample size'],
    ['全体', 'Total'],
    ['図の表示設定', 'Figure settings'],
    ['画像保存', 'Save image'],
    ['表をコピー', 'Copy table'],
    ['平均値の比較', 'Mean comparison'],
    ['値', 'Value'],
    ['棒グラフ（平均 ± SE）', 'Bar chart (mean ± SE)'],
    ['箱ひげ図（生データ）', 'Box plot (raw data)'],
    ['サンプル平均', 'Sample mean'],
    ['今回の結果を簡単に説明すると', 'In plain language'],
    ['結果のポイント、指標の意味と見方、注意点を確認', 'Review the main finding, what each statistic means, and common cautions'],
    ['結果のポイント', 'Main finding'],
    ['この指標が何を示すか', 'What each statistic means'],
    ['見方:', 'How to read it:'],
    ['読み違えに注意', 'Avoid these common misreadings'],
    ['分析トップへ戻る', 'Back to easyStat'],
    ['機能選択に戻る', 'Back to analyses'],
    ['AI解釈補助を開く', 'Open the AI interpretation assistant'],
    ['AI解釈補助を閉じる', 'Close the AI interpretation assistant'],
    ['easyStat 失敗しないマニュアル', 'easyStat User Guide'],
    ['0. まずここから', '0. Start here'],
    ['3分で始める手順', 'Get started in 3 minutes'],
    ['分析選択早見表', 'Analysis selection guide'],
    ['結果の書き方', 'How to report results'],
    ['よくあるトラブル・FAQ', 'Troubleshooting and FAQ']
    ,['この分析を簡単に説明すると', 'In plain language']
    ,['高校生向けに、見る順番と注意点を確認', 'A clear guide to what to check and how to avoid common mistakes']
    ,['データプレビュー', 'Data preview']
    ,['表タイトル', 'Table title']
    ,['表タイトルを表示', 'Show table title']
    ,['初期値に戻す', 'Reset to defaults']
    ,['型', 'Type']
    ,['数値', 'Numeric']
    ,['カテゴリ', 'Categorical']
    ,['テキスト', 'Text']
    ,['欠損値(%)', 'Missing (%)']
    ,['ユニーク数', 'Unique values']
    ,['分析を実行', 'Run analysis']
    ,['検定を実行', 'Run test']
    ,['読み込んだデータと知りたい目的から、使うべき分析・選ぶ変数・結果で見る指標を案内します。', 'Use your data and research goal to choose an analysis, select variables, and identify the results to inspect.']
    ,['データの状態', 'Data status']
    ,['何を知りたいですか？', 'What do you want to find out?']
    ,['全体像をつかむ', 'Explore the data']
    ,['差を比べる', 'Compare groups']
    ,['関係を見る', 'Examine relationships']
    ,['予測する', 'Make predictions']
    ,['割合を見る', 'Compare proportions']
    ,['項目をまとめる', 'Reduce variables']
    ,['下準備する', 'Prepare data']
    ,['関心のある変数', 'Variables of interest']
    ,['おすすめの分析手法', 'Suggested analyses']
    ,['探索的データ分析（EDA）', 'Exploratory data analysis (EDA)']
    ,['平均・中央値・ばらつき・分布・外れ値を確認します。', 'Inspect means, medians, variability, distributions, and outliers.']
    ,['この分析を開く', 'Open this analysis']
    ,['カテゴリ同士の人数・割合の内訳を見ます。', 'Compare counts and percentages across categories.']
    ,['数値同士が一緒に増減するかを調べます。', 'Examine whether numeric variables change together.']
    ,['自由記述の頻出語・共起・ワードクラウドを確認します。', 'Explore frequent terms, co-occurrence, and word clouds in open-ended responses.']
    ,['複数の説明変数から数値の結果を予測します。', 'Predict a numeric outcome from multiple explanatory variables.']
    ,['主成分分析（PCA）', 'Principal component analysis (PCA)']
    ,['多くの数値変数を少数の総合指標に圧縮します。', 'Summarize many numeric variables with a smaller set of composite dimensions.']
    ,['複数項目の背後にある共通因子を探します。', 'Explore common factors underlying multiple items.']
    ,['2つのファイルをIDなどのキーで横に結合します。', 'Join two files side by side using an ID or another key.']
    ,['データ加工・整形について', 'About data preparation']
    ,['分析を行う前にデータを整える重要なステップです。「値の変換」や「変数の作成」などのエンジニアリング機能と、「欠損値・外れ値処理」などのクレンジング機能を含みます。', 'Prepare data before analysis by transforming values, creating variables, and handling missing values or outliers.']
    ,['何ができるの？', 'What can you do here?']
    ,['データ品質情報', 'Data quality information']
    ,['データ概要', 'Data overview']
    ,['欠損値情報', 'Missing-value information']
    ,['欠損値数', 'Missing values']
    ,['欠損率 (%)', 'Missing (%)']
    ,['データ型', 'Data type']
    ,['推測される型', 'Inferred type']
    ,['データ加工・変数作成 (Engineering)', 'Transform data and create variables']
    ,['データの絞り込み (条件抽出)', 'Filter rows']
    ,['逆転項目の処理 (自動反転)', 'Reverse-score items']
    ,['数値のグループ化 (2値化)', 'Group numeric values (binary recoding)']
    ,['標準化 (Zスコア)', 'Standardize (z scores)']
    ,['値の変換 (個別入力など)', 'Recode values']
    ,['変数の手動計算 (合計・平均等)', 'Calculate a variable (sum, mean, and more)']
    ,['文字列の整形 (全角半角・空白除去)', 'Clean text width and whitespace']
    ,['変数に対して条件（「~に等しい」「~より大きい」など）を指定し、条件に一致するデータ（行）のみを残してプレビューします。', 'Set a condition for a variable and preview only the rows that match it.']
    ,['条件を指定する変数:', 'Variable to filter:']
    ,['条件式:', 'Condition:']
    ,['値 (数値 または テキスト):', 'Value (number or text):']
    ,['条件を適用して絞り込む', 'Apply filter']
    ,['処理オプション', 'Processing options']
    ,['外れ値の処理（IQR法：範囲外の値はその列のみ欠損（NaN）にし、行は残す）', 'Handle outliers with the IQR rule (set outlying cells to missing and keep their rows)']
    ,['欠損値の削除（欠損値を含む行を削除し、文字列の前後の空白を削除）', 'Remove rows with missing values and trim surrounding whitespace']
    ,['値が入っていないカラム（列）の削除', 'Remove empty columns']
    ,['データ処理を実行', 'Process data']
    ,['データ結合（マージ）について', 'About merging data']
    ,['2つのExcel/CSVファイルを、共通のカラム（列）をキーにして1つのデータセットにまとめる機能です。', 'Combine two Excel or CSV files into one dataset using a shared key column.']
    ,['例：「生徒IDと数学の成績」のファイルと「生徒IDと英語の成績」のファイルを、生徒IDで結合できます。', 'Example: join a file of student IDs and mathematics scores with a file of student IDs and English scores.']
    ,['使い方', 'How to use it']
    ,['1つ目のファイル', 'First file']
    ,['2つ目のファイル', 'Second file']
    ,['ファイルをドラッグ＆ドロップまたはクリックして選択', 'Drag and drop a file, or click to choose one']
    ,['ファイルをドラッグ＆ドロップ', 'Drag and drop a file']
    ,['またはクリックして選択', 'or click to choose one']
    ,['因子得点算出について', 'About factor score calculation']
    ,['アンケートや心理尺度の各因子（下位尺度）に属する設問の回答を平均化した得点です。反転項目は自動で処理されます。', 'Calculate each factor or subscale score by averaging its items. Reverse-coded items are handled automatically.']
    ,['尺度情報ファイルの形式', 'Scale information file format']
    ,['設問名', 'Item name']
    ,['因子名', 'Factor name']
    ,['反転', 'Reverse-coded']
    ,['※「反転」列は反転項目の場合に1を入力します。', 'Enter 1 in the Reverse-coded column for items that require reverse scoring.']
    ,['尺度情報ファイル', 'Scale information file']
    ,['クリックまたはドラッグ＆ドロップ', 'Click or drag and drop']
    ,['テンプレートをダウンロード', 'Download template']
    ,['データファイル', 'Data file']
    ,['探索的データ分析 (EDA)', 'Exploratory data analysis (EDA)']
    ,['データの分布や変数の関係を探索的に分析します', 'Explore distributions and relationships among variables']
    ,['軸ラベルを表示', 'Show axis labels']
    ,['グラフタイトルを表示', 'Show chart titles']
    ,['すべての図をまとめて設定', 'Apply settings to all figures']
    ,['数値変数の統計量', 'Numeric-variable statistics']
    ,['歪度', 'Skewness']
    ,['尖度', 'Kurtosis']
    ,['カテゴリ変数の統計量', 'Categorical-variable statistics']
    ,['最頻値', 'Mode']
    ,['最頻値の度数', 'Mode frequency']
    ,['基本統計・分布', 'Summary statistics and distributions']
    ,['数値変数の比較', 'Compare numeric variables']
    ,['２変数の関係', 'Two-variable relationships']
    ,['３変数の関係', 'Three-variable relationships']
    ,['各変数の個別分析を行います', 'Inspect each variable separately']
    ,['カテゴリ変数の可視化', 'Categorical-variable plots']
    ,['並び替え順:', 'Sort order:']
    ,['数値変数の個別可視化', 'Numeric-variable plots']
    ,['2つのカテゴリ変数の度数分布を集計し、関連を視覚的に確認します', 'Summarize two categorical variables and inspect their relationship visually']
    ,['行変数:', 'Row variable:']
    ,['列変数:', 'Column variable:']
    ,['集計を実行', 'Create cross-tabulation']
    ,['変数間の関係の強さを分析します', 'Measure the strength of relationships among variables']
    ,['分析する変数を選択:', 'Select variables to analyze:']
    ,['相関分析を実行', 'Run correlation analysis']
    ,['一要因分散分析 (One-way ANOVA)', 'One-way ANOVA']
    ,['3群以上の平均値の差を検定します', 'Compare means across three or more groups']
    ,['対応なし（独立測度）', 'Independent measures']
    ,['異なる被験者グループ間を比較', 'Compare different groups of participants']
    ,['対応あり（反復測度）', 'Repeated measures']
    ,['同じ被験者の異なる条件間を比較', 'Compare conditions measured on the same participants']
    ,['多重比較の手法:', 'Multiple-comparison method:']
    ,['※ TukeyはANOVAの前提（等分散）に基づき検出力が高い手法です。 HolmやBonferroniは、Welchの検定を使用し等分散性が疑われる場合に頑健です。', 'Tukey has good power when the standard ANOVA assumptions hold. Holm or Bonferroni with Welch tests is more robust when equal variances are doubtful.']
    ,['要因（グループ変数・3群以上）:', 'Factor (grouping variable with 3 or more levels):']
    ,['従属変数を選択（複数可）:', 'Select outcome variables (multiple allowed):']
    ,['分析を実行（対応なし）', 'Run independent-measures ANOVA']
    ,['はANOVAの前提（等分散）に基づき検出力が高い手法です。', ' has good power when the standard ANOVA equal-variance assumption holds.']
    ,['は、Welchの検定を使用し等分散性が疑われる場合に頑健です。', ' are more robust when Welch tests are used because equal variances are doubtful.']
    ,['二要因分散分析 (Two-way ANOVA)', 'Two-way ANOVA']
    ,['2つの要因による平均の違いと、その交互作用を検定します', 'Test two main effects and their interaction']
    ,['2つの要因ともに被験者間因子（例：性別 × 学年）', 'Both factors are between-subjects (for example, gender × grade)']
    ,['2つの要因ともに被験者間因子', 'Both factors are between-subjects']
    ,['（例：性別 × 学年）', '(for example, gender × grade)']
    ,['混合計画（Mixed）', 'Mixed design']
    ,['被験者間因子 × 被験者内因子（例：群 × 分割測定）', 'Between-subjects factor × within-subjects factor']
    ,['被験者間因子 × 被験者内因子', 'Between-subjects factor × within-subjects factor']
    ,['（例：群 × 分割測定）', '(for example, group × repeated measurement)']
    ,['反復測定（対応あり）', 'Repeated-measures design']
    ,['2つの要因ともに被験者内因子（例：条件A × 条件B）', 'Both factors are within-subjects (for example, condition A × condition B)']
    ,['2つの要因ともに被験者内因子', 'Both factors are within-subjects']
    ,['（例：条件A × 条件B）', '(for example, condition A × condition B)']
    ,['多重比較の手法 (単純主効果の検定):', 'Multiple-comparison method for simple effects:']
    ,['要因1（行・Legend）:', 'Factor 1 (rows / legend):']
    ,['要因2（列・X軸）:', 'Factor 2 (columns / x-axis):']
    ,['二要因分散分析を実行（対応なし）', 'Run independent two-way ANOVA']
    ,['2つの独立したグループ間の順位に基づいた差の検定を行います（ノンパラメトリック検定）', 'Compare rank distributions between two independent groups']
    ,['3つ以上の独立したグループ間の順位に基づいた差の検定を行います（ノンパラメトリック検定）', 'Compare rank distributions across three or more independent groups']
    ,['対応のある2群以上の順位に基づいた差の検定を行います（ノンパラメトリック検定）', 'Compare two or more paired measurements using ranks']
    ,['検定変数を複数選択:', 'Select test variables:']
    ,['グループ変数（カテゴリ変数、3群以上）を選択:', 'Select a grouping variable (3 or more categories):']
    ,['比較する変数を選択（対応のあるデータ、2つ以上）:', 'Select paired variables to compare (2 or more):']
    ,['対応のある2値データの比率変化を検定します（前後比較など）', 'Test changes in paired binary responses']
    ,['変数1（例: 授業前）:', 'Variable 1 (for example, before):']
    ,['変数2（例: 授業後）:', 'Variable 2 (for example, after):']
    ,['2つのカテゴリ変数の独立性を検定します', 'Test the association between two categorical variables']
    ,['小標本にも対応した条件付き確率でカテゴリ変数間の関連を検定します', 'Test association between categorical variables using exact conditional probabilities']
    ,['行変数 (Group 1):', 'Row variable:']
    ,['列変数 (Group 2):', 'Column variable:']
    ,['1つの変数から別の変数を予測します', 'Predict one numeric variable from another']
    ,['説明変数 (X):', 'Explanatory variable (X):']
    ,['目的変数 (Y):', 'Outcome variable (Y):']
    ,['複数の変数から目的変数を予測します', 'Predict an outcome from multiple variables']
    ,['目的変数（予測したい変数）を選択（複数可）:', 'Select outcome variables to predict (multiple allowed):']
    ,['説明変数（予測に使う変数）を選択（複数可）:', 'Select explanatory variables (multiple allowed):']
    ,['2値の結果（合否、有無など）を説明変数から予測します', 'Predict a binary outcome from explanatory variables']
    ,['目的変数 (Y: 2値変数):', 'Outcome variable (binary Y):']
    ,['説明変数 (X: 数値変数):', 'Explanatory variables (numeric X):']
    ,['因子分析 (Factor Analysis)', 'Factor analysis']
    ,['多数の変数の背後にある共通因子を探索します', 'Explore common factors underlying many variables']
    ,['分析する変数を選択（複数選択可、3つ以上）:', 'Select variables to analyze (3 or more):']
    ,['抽出する因子数:', 'Number of factors:']
    ,['回転方法:', 'Rotation method:']
    ,['因子分析を実行', 'Run factor analysis']
    ,['主成分分析 (PCA)', 'Principal component analysis (PCA)']
    ,['多次元データを要約して可視化します', 'Summarize and visualize multivariate data']
    ,['分析する変数を選択（複数選択可、2つ以上）:', 'Select variables to analyze (2 or more):']
    ,['主成分分析を実行', 'Run principal component analysis']
    ,['時系列データ分析', 'Time-series analysis']
    ,['時間の経過とともに変化するデータを分析します', 'Analyze values observed over time']
    ,['時間変数 (任意):', 'Time variable (optional):']
    ,['値変数 (必須):', 'Value variable (required):']
    ,['設定:', 'Settings:']
    ,['移動平均区間 (Window):', 'Moving-average window:']
    ,['分かち書き・文書頻度・特徴語・共起関係をブラウザ内で高速に分析します', 'Analyze token frequencies, distinctive terms, and co-occurrence entirely in the browser']
    ,['データ列', 'Data column']
    ,['直接入力', 'Direct text input']
    ,['分析するテキスト変数（必須）:', 'Text variable to analyze (required):']
    ,['カテゴリ変数（任意・比較用）:', 'Category variable for comparison (optional):']
    ,['抽出・共起の詳細設定', 'Term extraction and co-occurrence settings']
    ,['変数名:', 'Variable:']
    ,['統計量:', 'Statistics:']
    ,['平均:', 'Mean:']
    ,['中央値:', 'Median:']
    ,['標準偏差:', 'Standard deviation:']
    ,['歪度:', 'Skewness:']
    ,['尖度:', 'Kurtosis:']
    ,['まず見るところ', 'What to check first']
    ,['この説明だけで結論は決めません。結果表とグラフを確認し、計算方法が表示される分析では「分析ロジック・計算式詳説」も確認できます。', 'Do not draw a conclusion from this guide alone. Check the result tables and graphs, and review Statistical logic and formulas when it is available.']
    ,['気をつけること', 'What to keep in mind']
    ,['詳しい数値は、すぐ下の結果表やグラフで確認できます。', 'Check the tables and graphs below for the detailed values.']
    ,['今回の要約では、個別に説明する統計指標は表示されていません。', 'No individual statistic requiring an explanation appears in this summary.']
    ,['相関行列', 'Correlation matrix']
    ,['相関の種類:', 'Correlation method:']
    ,['ピアソン（積率相関）', 'Pearson (product-moment correlation)']
    ,['スピアマン（順位相関）', 'Spearman (rank correlation)']
    ,['相関係数の解釈', 'Correlation benchmarks']
    ,['0.7 〜 1.0: 強い正の相関', '0.7 to 1.0: strong positive correlation']
    ,['0.4 〜 0.7: 中程度の正の相関', '0.4 to 0.7: moderate positive correlation']
    ,['0.2 〜 0.4: 弱い正の相関', '0.2 to 0.4: weak positive correlation']
    ,['-0.2 〜 0.2: ほとんど相関なし', '-0.2 to 0.2: little correlation']
    ,['-0.4 〜 -0.2: 弱い負の相関', '-0.4 to -0.2: weak negative correlation']
    ,['-0.7 〜 -0.4: 中程度の負の相関', '-0.7 to -0.4: moderate negative correlation']
    ,['-1.0 〜 -0.7: 強い負の相関', '-1.0 to -0.7: strong negative correlation']
    ,['「*」「**」などの記号は統計的有意性を示します。', 'Symbols such as * and ** indicate statistical significance.']
    ,['**: 1%水準で有意 (p < 0.01)', '**: significant at the 1% level (p < .01)']
    ,['*: 5%水準で有意 (p < 0.05)', '*: significant at the 5% level (p < .05)']
    ,['†: 10%水準で有意傾向 (p < 0.1)', '†: suggestive at the 10% level (p < .10)']
    ,['ヒートマップ', 'Heatmap']
    ,['散布図行列', 'Scatterplot matrix']
    ,['クロス集計表と残差分析', 'Cross-tabulation and residual analysis']
    ,['合計', 'Total']
    ,['上段: 観測度数 (期待度数), 下段: 調整済み標準化残差 (z) とセルp値。', 'Top: observed count (expected count). Bottom: adjusted standardized residual (z) and cell p value.']
    ,['全体検定が5%水準で有意でないため、セルの未補正p値が .05 未満でも有意な偏りとは断定しません。該当セルは黄色で探索的な目安として示します。', 'Because the overall test is not significant at the 5% level, an unadjusted cell p value below .05 is not treated as a significant cell imbalance. Yellow cells are exploratory guides only.']
    ,['検定結果', 'Test results']
    ,['結果の詳細テーブル・図', 'Detailed result tables and figures']
    ,['選択した従属変数に関する要約統計量', 'Descriptive statistics for the selected outcomes']
    ,['全体M', 'Overall M']
    ,['全体S.D', 'Overall SD']
    ,['Levene p(等分散性)', 'Levene p (equal variances)']
    ,['複数項目の検定:', 'Multiple-outcome testing:']
    ,['複数ペアの検定:', 'Multiple-pair testing:']
    ,['（記号と解釈はHolm補正後のp値）', ' (symbols and interpretations use Holm-adjusted p values)']
    ,['群間自由度', 'Between-groups df']
    ,['群内自由度', 'Within-groups df']
    ,['変動要因', 'Source']
    ,['平方和 (SS)', 'Sum of squares (SS)']
    ,['自由度 (df)', 'Degrees of freedom (df)']
    ,['平均平方 (MS)', 'Mean square (MS)']
    ,['F値', 'F statistic']
    ,['p値', 'p value']
    ,['対比', 'Comparison']
    ,['差', 'Difference']
    ,['統計量', 'Statistic']
    ,['有意', 'Significant']
    ,['分析結果', 'Analysis results']
    ,['係数', 'Coefficient']
    ,['推定値', 'Estimate']
    ,['標準誤差', 'Standard error']
    ,['t値', 't statistic']
    ,['固有値と寄与率', 'Eigenvalues and explained variance']
    ,['因子 (成分)', 'Factor (component)']
    ,['初期固有値 (Initial Eigenvalues)', 'Initial eigenvalues']
    ,['回転後の負荷量二乗和 (Rotation Sums of Squared Loadings)', 'Rotation sums of squared loadings']
    ,['寄与率 (%)', 'Explained variance (%)']
    ,['累積 (%)', 'Cumulative (%)']
    ,['※ 回転を行うと、因子の分散（固有値に相当）が再配分されます。直交回転では累積寄与率の合計は変わりませんが、斜交回転（Promax, Oblimin, Geomin）では因子間の相関により寄与率の解釈が異なります。', 'Rotation redistributes factor variance. Total cumulative variance is unchanged under orthogonal rotation, while correlated factors require more care when interpreting variance after oblique rotation (Promax, Oblimin, or Geomin).']
    ,['因子負荷量', 'Factor loadings']
    ,['適合度指標', 'Adequacy and fit indices']
    ,['質問項目', 'Item']
    ,['共通性', 'Communality']
    ,['因子の解釈 (Factor Interpretation)', 'Factor interpretation']
    ,['負荷量の絶対値が高い項目 (≧ 0.4) をリストアップしました。', 'Items with absolute loadings of at least .40 are listed below.']
    ,['解釈のヒント: これらの変数の共通点は何でしょうか？', 'Interpretation prompt: What do these variables have in common?']
    ,['カテゴリ別分析', 'Analysis by category']
    ,['文書', 'Documents']
    ,['文', 'Sentences']
    ,['抽出語', 'Term occurrences']
    ,['異なり語', 'Unique terms']
    ,['解析器', 'Tokenizer']
    ,['抽出語リスト（出現回数順）', 'Extracted terms by frequency']
    ,['TF＝出現回数、DF＝その語を含む文書数。語を押すとKWICを表示します。', 'TF is the number of occurrences; DF is the number of documents containing the term. Select a term to open KWIC.']
    ,['語', 'Term']
    ,['品詞', 'Part of speech']
    ,['文書率', 'Document rate']
    ,['TF-IDF合計', 'Total TF-IDF']
    ,['品詞別ランキング（推定）', 'Ranking by estimated part of speech']
    ,['品詞別ランキング', 'Ranking by part of speech']
    ,['高速分かち書きの語形から、大まかな品詞を推定しています。', 'Parts of speech are approximate estimates based on the fast tokenizer output.']
    ,['形態素解析の基本形と品詞タグを使用しています。', 'The ranking uses dictionary forms and part-of-speech tags from morphological analysis.']
    ,['ワードクラウド（出現回数）', 'Word cloud (term frequency)']
    ,['大きい語ほど、分析対象内で多く使われています。', 'Larger terms occur more often in the analyzed text.']
    ,['ワードクラウド（TF-IDF）', 'Word cloud (TF-IDF)']
    ,['大きい語ほど、文書内で重要かつ全体では比較的珍しい語です。', 'Larger terms have higher TF-IDF and are relatively distinctive across documents.']
    ,['共起ネットワーク', 'Co-occurrence network']
    ,['文単位のJaccard係数が強い関係を表示します。ノードを押すとKWICを表示します。', 'Strong Jaccard relationships based on sentences are shown. Select a node to open KWIC.']
    ,['文書単位のJaccard係数が強い関係を表示します。ノードを押すとKWICを表示します。', 'Strong Jaccard relationships based on documents are shown. Select a node to open KWIC.']
    ,['全体分析', 'Overall analysis']
    ,['結果を読む', 'Reading the results']
    ,['名詞', 'Noun']
    ,['固有名詞', 'Proper noun']
    ,['サ変名詞', 'Verbal noun']
    ,['形容動詞', 'Adjectival noun']
    ,['動詞', 'Verb']
    ,['形容詞', 'Adjective']
    ,['副詞', 'Adverb']
    ,['連体詞', 'Adnominal']
    ,['感動詞', 'Interjection']
    ,['英数字・略語', 'Alphanumeric / abbreviation']
    ,['大きさ:', 'Size:']
    ,['出現回数が多い語ほど大きく表示', 'Larger terms have higher term frequency']
    ,['調整済み標準化残差 z が大きい語ほど大きく表示', 'Larger terms have higher adjusted residual z values']
    ,['TF-IDF合計が大きい語ほど大きく表示', 'Larger terms have higher total TF-IDF']
    ,['値が大きい語ほど大きく表示', 'Larger terms have higher values']
    ,['色と大きさの意味', 'Meaning of color and size']
    ,['色分けの意味:', 'Meaning of the colors:']
    ,['群間比較', 'Comparison across groups']
    ,['現在の抽出条件では、群間で比較できる語がありません。', 'No terms can be compared across groups under the current extraction settings.']
    ,['同じ語を全群で横に並べています。語を押すと全群のKWICを表示します。', 'The same terms are aligned across all groups. Select a term to open KWIC for every group.']
    ,['特徴度 z', 'Distinctiveness z']
    ,['青い帯が長いほど、その語を含む文書の割合が高い群です。', 'A longer blue bar indicates a group with a higher proportion of documents containing the term.']
    ,['期待より多い', 'More than expected']
    ,['期待より少ない', 'Less than expected']
    ,['語・品詞', 'Term / part of speech']
    ,['文書率は語を1回以上含む文書の割合です。zとqは各群をその他すべての群と比較し、群ごとにFDR補正しています。', 'Document rate is the proportion of documents containing the term at least once. z and q compare each group with all other groups, with FDR correction applied within each group.']
    ,['カテゴリ比較:', 'Category comparison:']
    ,['最初に全群を横断比較し、その下に群ごとの抽出語・特徴語・ワードクラウド・共起ネットワークを連続表示します。', 'First compare all groups side by side, then review each group\'s extracted terms, distinctive terms, word clouds, and co-occurrence network in sequence.']
    ,['文書への出現有無を他カテゴリと比較した調整済み標準化残差です。zが大きいほど、このカテゴリに特徴的です。', 'Adjusted standardized residuals compare whether a term appears in this category versus the others. A larger z value indicates a more distinctive term.']
    ,['カテゴリ内', 'Within category']
    ,['その他', 'Other']
    ,['qはBenjamini-Hochberg法で多重比較を補正。q < .05の行を強調しています。', 'q values use the Benjamini-Hochberg multiple-testing correction. Rows with q < .05 are highlighted.']
    ,['比較可能な特徴語がありません。', 'No comparable distinctive terms were found.']
    ,['最小出現数を満たす語がありません。', 'No terms meet the minimum-frequency setting.']
    ,['表示できる語がありません。', 'No terms are available to display.']
    ,['実測値', 'Observed values']
    ,['時間 / 順序', 'Time / order']
    ,['自己相関', 'Autocorrelation']
    ,['自己相関関数 (ACF) - 周期性の確認', 'Autocorrelation function (ACF) - check for recurring patterns']
    ,['ラグ (Lag)', 'Lag']
    ,['自己相関係数', 'Autocorrelation coefficient']
    ,['※ 因子負荷量（バリマックス回転後）', 'Factor loadings (after Varimax rotation)']
    ,['※ 因子負荷量（プロマックス回転後）', 'Factor loadings (after Promax rotation)']
    ,['※ 因子負荷量（オブリミン回転後）', 'Factor loadings (after Oblimin rotation)']
    ,['※ 因子負荷量（ジオミン回転後）', 'Factor loadings (after Geomin rotation)']
    ,['※ 因子負荷量（回転なし）', 'Factor loadings (unrotated)']
    ,['バリマックス回転後', 'after Varimax rotation']
    ,['プロマックス回転後', 'after Promax rotation']
    ,['オブリミン回転後', 'after Oblimin rotation']
    ,['ジオミン回転後', 'after Geomin rotation']
    ,['回転なし', 'unrotated']
    ,['Bartlett検定', "Bartlett's test"]
    ,['非常に良い', 'Excellent']
    ,['良い', 'Good']
    ,['普通', 'Adequate']
    ,['やや低い', 'Somewhat low']
    ,['低い', 'Low']
    ,['不適', 'Unsuitable']
    ,['SS負荷量', 'SS loadings']
    ,['累積寄与率 (%)', 'Cumulative variance (%)']
    ,['因子間相関', 'Factor correlations']
    ,['※ 因子の相関が高い場合、斜交回転が適しています。', 'When factor correlations are high, an oblique rotation is more appropriate.']
    ,['因子間相関行列 (Factor Correlations)', 'Factor correlation matrix']
    ,['※ 因子の相関が高い場合、プロマックスなどの斜交回転が適しています。', 'When factor correlations are high, an oblique rotation such as Promax is more appropriate.']
    ,['スクリープロット', 'Scree plot']
    ,['固有値', 'Eigenvalue']
    ,['因子番号', 'Factor number']
    ,['因子負荷量ヒートマップ', 'Factor-loading heatmap']
    ,['(等分散性)', '(equal variances)']
    ,['群間', 'Between groups']
    ,['群内', 'Within groups']
    ,['自由度', 'df']
    ,[': 強い正の相関', ': strong positive correlation']
    ,[': 中程度の正の相関', ': moderate positive correlation']
    ,[': 弱い正の相関', ': weak positive correlation']
    ,[': ほとんど相関なし', ': little correlation']
    ,[': 弱い負の相関', ': weak negative correlation']
    ,[': 中程度の負の相関', ': moderate negative correlation']
    ,[': 強い負の相関', ': strong negative correlation']
    ,[': 1%水準で有意 (p < 0.01)', ': significant at the 1% level (p < .01)']
    ,[': 5%水準で有意 (p < 0.05)', ': significant at the 5% level (p < .05)']
    ,[': 10%水準で有意傾向 (p < 0.1)', ': suggestive at the 10% level (p < .10)']
    ,['負荷量:', 'Loading:']
    ,['解釈のヒント:', 'Interpretation prompt:']
    ,['これらの変数の共通点は何でしょうか？', 'What do these variables have in common?']
    ,['この因子に主に負荷する変数は見つかりませんでした。', 'No variable had its primary loading on this factor.']
    ,['HolmやBonferroni', 'Holm and Bonferroni']
    ,['２要因分散分析 一括表（対応なし）', 'Two-way ANOVA summary (independent measures)']
    ,['交互作用', 'Interaction']
    ,['偏η²', 'Partial η²']
    ,['変動要因 (Source)', 'Source']
    ,['平均値 (M)', 'Mean (M)']
    ,['標準偏差 (SD)', 'Standard deviation (SD)']
    ,['サンプル数 (N)', 'Sample size (N)']
    ,['度数', 'Count']
    ,['度<br>数', 'Count']
    ,['行%', 'Row %']
    ,['列%', 'Column %']
    ,['全体%', 'Total %']
    ,['フィッシャーの正確確率検定の結果', "Fisher's exact test results"]
    ,['R×C分割表: 全パターン列挙による正確計算', 'R×C contingency table: exact enumeration of all possible tables']
    ,['Kruskal-Wallis検定表', 'Kruskal-Wallis test table']
    ,['全体N', 'Total N']
    ,['全体Mdn', 'Overall Mdn']
    ,['全体IQR', 'Overall IQR']
    ,['以下のHTMLをコピーしてWord等に貼り付けると、論文作成に役立ちます。', 'Copy the table below and paste it into a document for reporting.']
    ,['群間の差の検定', 'Test of between-group differences']
    ,['統計量（U）', 'Statistic (U)']
    ,['効果量（r）', 'Effect size (r)']
    ,['ウィルコクソンの符号付順位検定の結果', 'Wilcoxon signed-rank test results']
    ,['比較ペア', 'Paired comparison']
    ,['N(ペア)', 'N (pairs)']
    ,['有意差', 'Significance']
    ,['効果量 r', 'Effect size r']
    ,['比較', 'Comparison']
    ,['固有値リスト', 'Eigenvalue table']
    ,['主成分', 'Principal component']
    ,['主成分負荷量', 'Principal component loadings']
    ,['※表の値は主成分負荷量（固有ベクトル × √固有値）を表示しています。', 'The table reports principal component loadings (eigenvectors × √eigenvalues).']
    ,['バイプロット', 'Biplot']
    ,['説明変数', 'Predictor']
    ,['非標準化係数 (B)', 'Unstandardized coefficient (B)']
    ,['標準誤差 (SE)', 'Standard error (SE)']
    ,['標準化係数 (β)', 'Standardized coefficient (β)']
    ,['判定', 'Decision']
    ,['回帰係数', 'Regression coefficients']
    ,['係数 (B)', 'Coefficient (B)']
    ,['オッズ比 (exp(B))', 'Odds ratio (exp(B))']
    ,['混同行列', 'Confusion matrix']
    ,['予測値', 'Predicted value']
    ,['平均順位', 'Mean rank']
    ,['目的変数:', 'Outcome:']
    ,['統計量（', 'Statistic (']
    ,['効果量（', 'Effect size (']
    ,['括弧内: 偏η²', 'Parentheses: partial η²']
    ,['ε²: イプシロン二乗 = H / (N − 1)', 'ε²: epsilon squared = H / (N − 1)']
    ,['効果量 r = |Z| / √n', 'effect size r = |Z| / √n']
    ,['観測度数のヒートマップ', 'Observed-count heatmap']
    ,['相関ヒートマップ', 'Correlation heatmap']
    ,['散布図行列（対角:ヒストグラム, 右上:相関係数, 左下:散布図）', 'Scatterplot matrix (diagonal: histograms; upper: correlations; lower: scatterplots)']
    ,['成分番号', 'Component number']
    ,['予測確率', 'Predicted probability']
    ,['予測確率 P(Y=1)', 'Predicted probability P(Y=1)']
    ,['混同行列ヒートマップ', 'Confusion-matrix heatmap']
    ,['スクリープロット（固有値の推移）', 'Scree plot']
    ,['固有値（推移）', 'Eigenvalue']
    ,['第一主成分', 'First principal component']
    ,['第二主成分', 'Second principal component']
    ,['観測データ', 'Observations']
    ,['残差プロット (Residuals vs Fitted)', 'Residuals vs fitted values']
    ,['予測値 (Fitted values)', 'Fitted values']
    ,['残差 (Residuals)', 'Residuals']
    ,['残差', 'Residual']
    ,['データ', 'Data']
    ,['回帰直線', 'Regression line']
    ,['差分布', 'Difference distribution']
    ,['データファイルをアップロード', 'Upload a data file']
    ,['または', 'or']
    ,['データ情報', 'Data information']
    ,['データソース', 'Data source']
    ,['目的に合ったカテゴリから分析手法を選んでください', 'Choose an analysis from the category that matches your goal']
    ,['ユーティリティ', 'Utilities']
    ,['分析前のデータ整形や特別な計算を行います', 'Prepare, combine, or score data before analysis']
    ,['どの分析を使えばいいか迷った時は、ここから始めてください', 'Start here when you are unsure which analysis to use']
    ,['データ加工・整形', 'Prepare and transform data']
    ,['新しいデータを作ったり、分析の前にデータを整えたりします', 'Create variables and clean data before analysis']
    ,['2つのファイル（Excel/CSV）を、出席番号（ID）などを目印にして1つにまとめます', 'Combine two Excel or CSV files using an ID or another key']
    ,['因子得点算出', 'Calculate scale scores']
    ,['複数の質問回答をまとめて、新しい合計点や平均点のデータを作ります', 'Combine questionnaire items into sum or mean scores']
    ,['データの探索・要約', 'Explore and summarize data']
    ,['データの傾向を把握し、要約統計量を計算します', 'Inspect patterns and calculate descriptive statistics']
    ,['平均値やグラフを作成し、データの全体像や傾向を把握します', 'Use statistics and graphs to understand the shape and pattern of your data']
    ,['「男女別×回答別」のように、人数の偏りや内訳を表にまとめます', 'Summarize counts and percentages across two categorical variables']
    ,['「身長と体重」のように、2つのデータが連動して変化するか調べます', 'Examine whether two numeric variables change together']
    ,['平均値の比較（パラメトリック検定）', 'Mean comparisons (parametric tests)']
    ,['グループ間の平均の違いが、統計上はっきりしているか調べます', 'Test whether group mean differences are statistically significant']
    ,['「クラスAとB」など、2つのグループの平均点に違いがあるか調べます', 'Compare the means of two groups']
    ,['一要因分散分析 (ANOVA)', 'One-way ANOVA']
    ,['「3つのクラス」など、3つ以上のグループの平均点に違いがあるか調べます', 'Compare means across three or more groups']
    ,['「薬の有無」×「性別」のように、2つの要因が合わさった時の効果を調べます', 'Examine two factors and whether their effects interact']
    ,['順位の比較（ノンパラメトリック検定）', 'Rank comparisons (nonparametric tests)']
    ,['データに偏りがある場合や、点数ではなく「順位」でグループを比べたい時に使います', 'Compare groups using ranks when distributional assumptions are doubtful']
    ,['データの偏りが大きい時に、2つのグループに違いがあるか（順位で）調べます', 'Compare two independent groups using ranks']
    ,['データの偏りが大きい時に、3つ以上のグループに違いがあるか調べます', 'Compare three or more independent groups using ranks']
    ,['データの偏りが大きい時に、同じ人の「事前・事後」に変化があったか調べます', 'Compare two paired measurements using signed ranks']
    ,['比率・関連性の検定', 'Tests of proportions and association']
    ,['「合格/不合格」のようなカテゴリ分けの割合に違いがあるか確かめます', 'Test differences and associations in categorical outcomes']
    ,['同じ人の「事前・事後」で、賛成・反対などの割合がどう変化したか調べます', 'Test change in paired binary responses']
    ,['「性別」と「きのこ/たけのこ派」のように、2つのアンケート項目に偏り（関連性）があるか調べます', 'Test association between two categorical variables']
    ,['アンケートの回答数が少ない（数十人など）時に、項目間の偏りを調べます', 'Test categorical association exactly when expected counts are small']
    ,['回帰分析・予測モデル', 'Regression and prediction']
    ,['結果と説明変数の関連を数式で表し、条件に応じた値や確率を予測します', 'Model an outcome using one or more predictors']
    ,['「勉強時間」から「テストの点数」を予測する数式を作ります', 'Predict a numeric outcome from one predictor']
    ,['複数の説明変数から結果を予測し、他の変数を一定とした関連を調べます', 'Predict a numeric outcome and estimate adjusted associations']
    ,['「合格・不合格」などの確率を、複数の要因から予測します', 'Predict the probability of a binary outcome']
    ,['多変量解析・その他', 'Multivariate and other analyses']
    ,['アンケートの質問項目をまとめたり、複雑なデータを整理する分析手法です', 'Summarize many variables and explore more complex data']
    ,['たくさんの質問項目から、背後に隠れた共通のテーマ（因子）を見つけ出します', 'Explore latent factors underlying many questionnaire items']
    ,['たくさんの変数を少数の総合指標にまとめ、データを分かりやすくします', 'Reduce many numeric variables to a smaller set of components']
    ,['売上や気温など、時間とともに変化するデータの傾向や周期を調べます', 'Explore trends and recurring patterns in ordered data']
    ,['自由記述のアンケートなど、文章の中でよく使われる単語や傾向を調べます', 'Explore frequent, distinctive, and co-occurring terms in text']
    ,['このアプリケーションについて', 'About this application']
    ,['使い方・操作方法', 'How to use easyStat']
    ,['更新履歴', 'Release notes']
    ,['フィードバック', 'Feedback']
    ,['Gemini APIキーの取得方法', 'How to get a Gemini API key']
    ,['Google AI StudioのAPIキー管理ページを開きます。', 'Open the API key page in Google AI Studio.']
    ,['「APIキーを作成」または「Create API key」を選びます。', 'Choose Create API key.']
    ,['表示されたキーをコピーして、下の入力欄に貼り付けます。', 'Copy the key and paste it into the field below.']
    ,['Google AI StudioでAPIキーを取得', 'Get an API key in Google AI Studio']
    ,['設定', 'Save']
    ,['削除', 'Remove']
    ,['生成AIによる解釈の補助', 'Generative AI interpretation assistant']
    ,['他の生成AIに貼り付けるためのテキストをコピーしました。', 'Copied text that you can paste into another AI service.']
    ,['AIに渡す内容と説明設定', 'AI content and explanation settings']
    ,['説明レベル', 'Explanation level']
    ,['高校生向け（やさしく）', 'For high school students']
    ,['標準', 'Standard']
    ,['研究・論文向け（詳しく）', 'Research and publication']
    ,['機微情報候補を自動マスクした原データ先頭10件を含める', 'Include the first 10 raw rows after automatically masking likely sensitive information']
    ,['原データを含めなくても、AI用テキストには分析対象列の要約統計量と画面の結果表が入ります。Geminiへ直接接続する場合や、コピー後に外部サービスへ貼り付ける場合は、その内容が送信対象です。自動マスクには見落としがあるため、個人情報や機密情報を含むデータでは原データを含めないでください。この設定は分析を切り替えるとオフに戻ります。', 'Even without raw rows, the AI-ready text contains summary statistics and on-screen result tables for the analyzed variables. That content is transmitted only when you connect directly to Gemini or paste the copied text into an external service. Automatic masking can miss sensitive information, so never include raw rows from personal or confidential data. This setting turns off when you switch analyses.']
    ,['AIに渡す内容を確認', 'Preview AI content']
    ,['AIへ渡す内容', 'Content provided to AI']
    ,['Geminiまたはコピー先のAIへ渡す内容を確認します', 'Preview exactly what will be provided to Gemini or another AI service']
    ,['高校生向け', 'Plain-language explanation']
    ,['200字で要約', 'Short report summary']
    ,['前提を確認', 'Check assumptions']
    ,['次の分析', 'Next analysis']
    ,['質問', 'Question']
    ,['AI用テキストをコピー', 'Copy text for AI']
    ,['分析結果を他の生成AIへ貼り付けるためのテキストとしてコピーします', 'Copy the analysis context to paste into another generative AI service']
    ,['解釈を生成', 'Generate interpretation']
    ,['コピー', 'Copy']
    ,['Gemini APIキーを入力', 'Enter a Gemini API key']
    ,['Gemini APIキー', 'Gemini API key']
    ,['変数を選択して分析結果が表示されるとコピーできます', 'Available after you select variables and display results']
    ,['例: この結果をレポート用に短く書くと？ / 有意でない結果はどう説明する？', 'Example: Summarize this result for a report. / How should I explain a nonsignificant result?']
    ,['2×2 分割表（クロス集計表）', '2×2 contingency table']
    ,['分割表ヒートマップ', 'Contingency-table heatmap']
    ,['χ²値', 'χ² statistic']
    ,['p値（正確確率）', 'p value (exact)']
    ,['効果量 φ', 'Effect size φ']
    ,['不一致ペア (b+c)', 'Discordant pairs (b+c)']
    ,['指標', 'Measure']
    ,['χ²（補正なし）', 'χ² (uncorrected)']
    ,['χ²（イェーツ補正）', 'χ² (Yates correction)']
    ,['正確二項検定', 'Exact binomial test']
    ,['オッズ比 (b/c)', 'Odds ratio (b/c)']
    ,['N（有効ペア数）', 'N (valid pairs)']
    ,['マクネマー検定の結果', 'McNemar test results']
    ,['実行時', 'How to run it']
    ,['結果', 'Output']
    ,['注意', 'Caution']
    ,['気になる数値列を選び、平均・分布・外れ値を見ます。', 'Select numeric columns of interest and inspect their center, distribution, and possible outliers.']
    ,['平均、中央値、標準偏差、ヒストグラム、箱ひげ図', 'Mean, median, standard deviation, histogram, and box plot']
    ,['本格的な検定の前に、必ず最初に見ておくと安心です。', 'Use this first to understand the data before running a formal test.']
    ,['行に1つ、列に1つカテゴリ変数を選びます。', 'Select one categorical variable for rows and one for columns.']
    ,['度数、行割合、列割合、帯グラフ', 'Counts, row percentages, column percentages, and 100% stacked chart']
    ,['検定の前に、まず人数の偏りを目で確認します。', 'Inspect imbalanced counts before running a test.']
    ,['2つ以上の数値列を選び、散布図と相関係数を確認します。', 'Select at least two numeric columns and inspect scatter plots and correlations.']
    ,['相関係数 r、p値、散布図、相関行列', 'Correlation r, p value, scatter plots, and correlation matrix']
    ,['相関は因果関係を証明しません。外れ値にも注意します。', 'Correlation does not prove causation; also inspect possible outliers.']
    ,['文章が入った列を選びます。', 'Select a column containing text responses.']
    ,['頻出語、ワードクラウド、共起ネットワーク', 'Frequent terms, word clouds, and co-occurrence networks']
    ,['個人情報や表記ゆれを事前に確認します。', 'Check personal information and inconsistent spelling before analysis.']
    ,['目的変数を1つ、説明変数を複数選びます。', 'Select one outcome and multiple explanatory variables.']
    ,['標準化β、R²、自由度調整済みR²、VIF', 'Standardized beta, R-squared, adjusted R-squared, and VIF']
    ,['説明変数同士が似すぎていないか、VIFを確認します。', 'Use VIF to check whether predictors overlap too strongly.']
    ,['まとめたい数値列を3つ以上選びます。', 'Select at least three numeric columns to summarize.']
    ,['寄与率、累積寄与率、主成分負荷量、主成分得点', 'Explained variance, cumulative variance, component loadings, and component scores']
    ,['予測よりも、要約・可視化・総合指標作りに向いています。', 'This is mainly for summarization, visualization, and composite dimensions rather than prediction.']
    ,['同じ尺度の項目を3つ以上選びます。', 'Select at least three items intended to measure related constructs.']
    ,['因子負荷量、因子数、回転後の構造', 'Factor loadings, factor count, and rotated structure']
    ,['アンケート項目など、同じ構成概念を測る列に向いています。', 'This is suited to questionnaire items designed to measure related constructs.']
    ,['共通IDをキーにして2つのファイルを横に結合します。', 'Join two files side by side using a shared ID.']
    ,['結合キー、結合方法、重複ID、未結合行', 'Join key, join method, duplicate IDs, and unmatched rows']
    ,['同じIDが複数行ある場合は、結合結果を慎重に確認します。', 'When an ID appears more than once, inspect the merged rows carefully.']
    ,['アンケートの逆転項目などを対象に、指定した最大値・最小値を使ってスコアを反転させます。（例：1〜5段階の場合、1→5, 2→4, 3→3 に変換） 計算式: (最大値 + 最小値) - 現在の値', 'Reverse-score questionnaire items using the specified minimum and maximum. For a 1-to-5 scale, 1 becomes 5, 2 becomes 4, and 3 remains 3. Formula: (maximum + minimum) - current value.']
    ,['アンケートの逆転項目などを対象に、指定した最大値・最小値を使ってスコアを反転させます。（例：1〜5段階の場合、1→5, 2→4, 3→3 に変換）', 'Reverse-score questionnaire items using the specified minimum and maximum. For a 1-to-5 scale, 1 becomes 5, 2 becomes 4, and 3 remains 3.']
    ,['計算式:', 'Formula:']
    ,['反転させる変数を選択 (複数選択可/Multiple Selection):', 'Select variables to reverse-score (multiple allowed):']
    ,['尺度の最小値 (Min):', 'Scale minimum:']
    ,['尺度の最大値 (Max):', 'Scale maximum:']
    ,['新しい変数名 (接尾辞/Suffix):', 'New-variable suffix:']
    ,['※空欄の場合は上書き、入力した場合は「元の変数名 + 接尾辞」で作成されます', 'Leave blank to overwrite the original column, or enter a suffix to create a new column.']
    ,['逆転処理を実行', 'Reverse-score variables']
    ,['テストの点数などを基準値（閾値）で区切り、「合格／不合格」「高群／低群」といった2つのグループ（カテゴリデータ）に変換します。', 'Split a numeric value at a threshold to create two categories, such as pass/fail or high/low.']
    ,['グループ化する変数（数値）:', 'Numeric variable to group:']
    ,['基準値（閾値）:', 'Threshold:']
    ,['※この値「以上」が高群に含まれます。', 'Values at or above the threshold enter the upper category.']
    ,['基準値以上のラベル:', 'Label at or above the threshold:']
    ,['基準値未満のラベル:', 'Label below the threshold:']
    ,['※入力した場合は「元の変数名 + 接尾辞」で作成されます', 'When entered, the new name is the original column name plus this suffix.']
    ,['グループ変数を作成', 'Create grouped variable']
    ,['単位や満点の異なる変数を比較したり足し合わせたりするために、平均を0、標準偏差を1に揃える「標準化（Zスコア変換）」を行います。', 'Standardize variables to mean 0 and standard deviation 1 so values with different units or ranges can be compared.']
    ,['標準化する変数を選択 (複数選択可/Multiple Selection):', 'Select variables to standardize (multiple allowed):']
    ,['標準化（Zスコア）を実行', 'Create z scores']
    ,['テキストデータを数値に変換したり（例：「とてもそう思う」→ 5）、逆転項目の処理を行います。', 'Recode text as numbers, such as converting a response label to 5, or apply a custom reverse-scoring rule.']
    ,['変換する変数を選択 (複数選択可/Multiple Selection):', 'Select variables to recode (multiple allowed):']
    ,['※空欄の場合は上書き、入力した場合は「元の変数名 + 接尾辞」で作成されます (例: _num)', 'Leave blank to overwrite, or enter a suffix to create a new column, such as _num.']
    ,['変換を実行', 'Apply recoding']
    ,['複数の変数を手動でまとめて、新しい変数（合計点や平均点）を作成します。', 'Combine selected variables to create a sum, mean, or another calculated column.']
    ,['計算に使用する変数 (複数選択可):', 'Variables to use in the calculation (multiple allowed):']
    ,['計算方法:', 'Calculation:']
    ,['※引き算と割り算は、選択した順番（1つ目から2つ目を引く/割る）で2変数のみ計算します。', 'Subtraction and division use exactly two variables in selection order.']
    ,['新しい変数名 (必須):', 'New variable name (required):']
    ,['変数を作成', 'Create variable']
    ,['選択した変数の「全角英数字・記号」を半角に変換し、前後の余分な空白（スペース）を削除します。', 'Normalize full-width letters, numbers, and symbols to half-width forms and remove surrounding whitespace.']
    ,['整形する変数 (複数選択可):', 'Variables to clean (multiple allowed):']
    ,['文字列を整形する', 'Clean text values']
    ,['ダウンロード', 'Download']
    ,['ファイル形式:', 'File format:']
    ,['処理済みデータをダウンロード', 'Download processed data']
    ,['結合結果', 'Merge result']
    ,['結合データをダウンロード', 'Download merged data']
    ,['計算設定', 'Calculation settings']
    ,['何件法？', 'Response scale maximum']
    ,['例: 5件法→5, 7件法→7', 'Example: enter 5 for a 5-point scale or 7 for a 7-point scale']
    ,['因子得点を計算', 'Calculate scale scores']
    ,['計算結果', 'Calculation result']
    ,['結果をダウンロード', 'Download results']
    ,['全ての数値変数を一括で比較します', 'Compare all numeric variables together']
    ,['数値変数の一括箱ひげ図', 'Combined box plots for numeric variables']
    ,['2つの変数間の関係性を可視化します', 'Visualize the relationship between two variables']
    ,['変数1を選択:', 'Select variable 1:']
    ,['変数2を選択:', 'Select variable 2:']
    ,['可視化を実行', 'Create visualization']
    ,['3つの変数間の関係性を可視化します', 'Visualize the relationship among three variables']
    ,['カテゴリ変数1を選択:', 'Select categorical variable 1:']
    ,['カテゴリ変数2を選択:', 'Select categorical variable 2:']
    ,['数値変数を選択:', 'Select a numeric variable:']
    ,['比較グラフを表示', 'Show comparison graph']
    ,['変数ペアを選択:', 'Choose variable pairs:']
    ,['観測変数（変更前など）:', 'First measurement (such as before):']
    ,['測定変数（変更後など）:', 'Second measurement (such as after):']
    ,['ペアを追加', 'Add pair']
    ,['選択された変数ペア', 'Selected variable pairs']
    ,['ここに追加されたペアが表示されます', 'Added pairs appear here']
    ,['検定する変数を選択:', 'Select variables to test:']
    ,['検定値 (比較したい値):', 'Reference value:']
    ,['分析セット', 'Analysis set']
    ,['変数を選択（3つ以上）:', 'Select at least three variables:']
    ,['分析セットを追加 (変数3つ以上)', 'Add an analysis set (at least three variables)']
    ,['分析を実行（対応あり）', 'Run repeated-measures analysis']
    ,['被験者間因子（グループ）:', 'Between-subjects factor (group):']
    ,['分析を実行（混合）', 'Run mixed-design analysis']
    ,['要因1 (Legend)', 'Factor 1 (legend)']
    ,['要因2 (X軸)', 'Factor 2 (x-axis)']
    ,['グリッドを生成', 'Create condition grid']
    ,['分析するテキスト', 'Text to analyze']
    ,['1行を1文書として集計', 'Treat each line as one document']
    ,['最小出現数', 'Minimum frequency']
    ,['共起の単位', 'Co-occurrence unit']
    ,['文書（1行）', 'Document (one line)']
    ,['ネットワークの語数', 'Terms in network']
    ,['表示する線の上限', 'Maximum edges']
    ,['線の絞り込み', 'Edge filter']
    ,['Jaccard係数が強い順', 'Strongest Jaccard coefficients']
    ,['Jaccard係数の下限を指定', 'Set a minimum Jaccard coefficient']
    ,['最小Jaccard係数', 'Minimum Jaccard coefficient']
    ,['最小共起回数', 'Minimum co-occurrence count']
    ,['共起ネットワークは、同じ文または文書に現れた語のJaccard係数を表示します。「強い順」か「係数の下限」で線を絞れます。線があるだけで意味的・因果的な関係があるとは限りません。', 'The co-occurrence network uses Jaccard coefficients for terms appearing in the same sentence or document. Filter edges by strongest coefficients or by a minimum coefficient. An edge alone does not establish a semantic or causal relationship.']
    ,['除外語（改行・読点区切り）', 'Excluded terms (separate with line breaks or commas)']
    ,['強制抽出語（改行・読点区切り）', 'Forced terms (separate with line breaks or commas)']
    ,[': 等分散性の検定（Levene検定）のp値です。p < .05 の場合、等分散ではない（分散が異なる）可能性が高いため、Welchのt検定（本分析のデフォルト）の結果がより信頼できます。', ': p value from Levene\'s test of equal variances. When p < .05, the variances may differ, so the Welch t-test result used by default here is more reliable.']
    ,['表タイトルを編集', 'Edit table title']
    ,['初期表示に戻す', 'Reset view']
    ,['分析セットを削除', 'Remove analysis set']
    ,['ペア行を削除', 'Remove pair']
    ,['データ準備度', 'Data readiness']
    ,['すぐ分析できます', 'Ready to analyze']
    ,['日付候補', 'Possible date columns']
    ,['欠損セル', 'Missing cells']
    ,['任意。選ぶと候補を絞り込みます', 'Optional; select variables to narrow the suggestions']
    ,['複数選択できます', 'Multiple selections allowed']
    ,['変数を選択してください...', 'Select variables...']
    ,['データ全体からの初期提案', 'Initial suggestions based on the full dataset']
    ,['最初におすすめ', 'Recommended first']
    ,['数値列があるため、まず分布と外れ値を確認できます。', 'Numeric columns are available, so start by inspecting distributions and possible outliers.']
    ,['カテゴリ列が複数あるため、人数と割合の内訳を確認できます。', 'Multiple categorical columns are available, so counts and percentages can be compared.']
    ,['数値列が複数あるため、関係性の探索ができます。', 'Multiple numeric columns are available, so relationships can be explored.']
    ,['テキスト列があるため、自由記述の傾向を確認できます。', 'A text column is available, so patterns in open-ended responses can be explored.']
    ,['数値列が3つ以上あるため、予測モデルを作れます。', 'At least three numeric columns are available, so a predictive model can be considered.']
    ,['数値列が多いため、総合指標への要約を検討できます。', 'Several numeric columns are available, so reducing them to summary dimensions can be considered.']
    ,['アンケート項目のような数値列が多い場合、因子構造を探索できます。', 'When the numeric columns are related questionnaire items, their factor structure can be explored.']
    ,['別ファイルの事前・事後データがある場合は、先に結合できます。', 'If before and after measurements are in separate files, merge them first.']
    ,['変数を選択', 'Select variables']
    ,['列名で検索', 'Search column names']
    ,['Pre/Post（事前・事後）のペアを指定してください。複数ペアの分析も可能です。', 'Specify before/after variable pairs. You can analyze multiple pairs.']
    ,['反復測定デザインの設定：', 'Repeated-measures design settings:']
    ,['1. 2つの要因名とそれぞれの水準数・水準名を入力してください。', '1. Enter the two factor names and their levels.']
    ,['2. 「グリッドを生成」を押すと、要因の組み合わせ表が表示されます。', '2. Select Create condition grid to display all factor combinations.']
    ,['3. 各セルに対応するデータの列（変数）を割り当ててください。', '3. Assign the data column corresponding to each cell.']
    ,['例: 時間', 'Example: Time']
    ,['水準 (カンマ区切り) 例: Pre,Post', 'Levels (comma-separated), for example: Pre, Post']
    ,['例: 条件', 'Example: Condition']
    ,['水準 (カンマ区切り) 例: A,B', 'Levels (comma-separated), for example: A, B']
    ,['例: 1 または 男', 'Example: 1 or Male']
    ,['例: 1', 'Example: 1']
    ,['例: 5', 'Example: 5']
    ,['例: _rev', 'Example: _rev']
    ,['例: 50', 'Example: 50']
    ,['例: 合格', 'Example: Pass']
    ,['例: 不合格', 'Example: Fail']
    ,['例: _cat', 'Example: _cat']
    ,['例: _z', 'Example: _z']
    ,['例: _recoded', 'Example: _recoded']
    ,['例: Factor1_Score', 'Example: Factor1_Score']
    ,['入力方法', 'Input method']
    ,['テキストの入力方法', 'Text input method']
    ,['授業が分かりやすかった\nデータ分析の実習が楽しかった\nグラフから傾向を発見できた', 'The lesson was easy to understand\nI enjoyed the data-analysis exercise\nI found a pattern in the graph']
    ,['例：今回、回答', 'Example: this, response']
    ,['例：データサイエンス、生成AI', 'Example: data science, generative AI']
    ,['ピアソン相関係数', 'Pearson correlation coefficient']
    ,['スピアマン相関係数', 'Spearman rank correlation coefficient']
    ,['カイ二乗近似の前提を確認してください。', 'Check the assumptions for the chi-square approximation.']
    ,['2×2表なら「フィッシャーの正確確率検定」を使います。それ以外の表では、カテゴリのまとめ方やデータ数を見直します。', 'For a 2 x 2 table, use Fisher\'s exact test. For a larger table, reconsider the category grouping or collect more data.']
    ,['カイ二乗値 (χ²)', 'Chi-square statistic (χ²)']
    ,['クラメールのV', "Cramer's V"]
    ,['2群の分散が異なるとは判断されませんでした。', 'The data did not indicate unequal variances between the two groups.']
    ,['群の分散が異なるとは判断されませんでした。', 'The data did not indicate unequal variances across groups.']
    ,[': 群の分散が同じとみなせるかを調べます。p < .05なら、通常のANOVAだけで結論を出さず、Welchの検定なども確認します。', ': checks whether group variances can be treated as equal. When p < .05, do not rely on ordinary ANOVA alone; also inspect a robust method such as Welch ANOVA.']
    ,['要因間 (Between)', 'Between groups']
    ,['要因内 (Error)', 'Within groups (error)']
    ,['誤差 (Error)', 'Error']
    ,['合計 (Total)', 'Total']
    ,['解説', 'Explanation']
    ,[': クラスカル・ウォリス検定は中央値や順位に注目するノンパラメトリック検定です。', ': the Kruskal-Wallis test is a nonparametric method based on ranks and distribution location.']
    ,['カイ二乗近似が不正確な可能性があるため、この分析では正確確率によるp値を参照してください。', 'Because the chi-square approximation may be inaccurate, use the exact-probability p value in this analysis.']
    ,['p値 (両側)', 'p value (two-sided)']
    ,['χ² (参考)', 'χ² (reference)']
    ,['回帰式', 'Regression equation']
    ,['決定係数 (R²)', 'Coefficient of determination (R²)']
    ,['調整済み R²', 'Adjusted R²']
    ,['相関係数 (r)', 'Correlation coefficient (r)']
    ,['切片 (Intercept)', 'Intercept']
    ,['(定数項)', '(Intercept)']
    ,['モデルχ²', 'Model χ²']
    ,['標本内正解率', 'In-sample accuracy']
    ,['多数派のみの基準正解率', 'Majority-class baseline accuracy']
    ,['対数尤度', 'Log likelihood']
    ,['適合率 (Precision)', 'Precision']
    ,['再現率 (Recall)', 'Recall']
    ,['F1スコア', 'F1 score']
    ,['(良い)', '(Good)']
    ,['ブラウザ内蔵（高速分かち書き）', 'Built-in browser tokenizer (fast)']
    ,['品詞は語形から推定し、活用形は原則として別の語として集計します。', 'Part of speech is estimated from surface forms, and inflected forms are generally counted separately.']
    ,['テキストマイニング結果', 'Text-mining results']
    ,['ワードクラウド（出現回数）', 'Word cloud (term frequency)']
    ,['ワードクラウド（TF-IDF）', 'Word cloud (TF-IDF)']
    ,['共起ネットワーク', 'Co-occurrence network']
    ,['PNG画像を保存', 'Save PNG image']
    ,['Save ワードクラウド（出現回数） as a PNG image', 'Save Word cloud (term frequency) as a PNG image']
    ,['Save ワードクラウド（TF-IDF） as a PNG image', 'Save Word cloud (TF-IDF) as a PNG image']
    ,['Save 共起ネットワーク as a PNG image', 'Save Co-occurrence network as a PNG image']
    ,['データの入力方法', 'Data input method']
    ,['照合して利用:', 'Verify before use:']
    ,['AIの説明は誤ることがあります。主要な数値・p値・効果量は画面の結果表で確認してください。', 'AI explanations can be wrong. Verify the main values, p values, and effect sizes against the result tables on this page.']
    ,['Geminiへ直接接続する場合、初期設定では分析対象列の要約統計量・結果表・妥当性チェックだけが送信対象となり、原データ行や自由記述例は含めません。 使用モデルはGemini 3.7 Flashで、利用できない場合は3.6 Flash、3.5 Flash-Liteの順に切り替えます。 Geminiへの直接接続にはInteractions APIを使用し、API側の会話保存を無効にします。ただし、無料枠に送った内容のデータ利用条件は別に適用されます。', 'By default, direct Gemini access sends summary statistics, result tables, and validity checks for the analyzed variables; raw rows and free-text examples are excluded. easyStat uses Gemini 3.7 Flash, then 3.6 Flash and 3.5 Flash-Lite as fallbacks. Direct access uses the Interactions API with API-side conversation storage disabled, but the free-tier data-use terms still apply.']
    ,['Gemini APIは18歳未満が利用し得るAPIクライアントでは使用できません。また、公開WebページではAPIキーを安全に保管できません。このため公開版は「AI用テキストをコピー」だけを提供し、直接接続はローカル実行時の成人利用に限定しています。 無料枠では入力と回答がGoogleの製品改善に使われる場合があります。個人情報、成績原票、自由記述などの機密データは送信しないでください。', 'The Gemini API may not be used in an API client likely to be accessed by anyone under 18, and a public web page cannot securely store an API key. The public version therefore provides Copy text for AI only; direct access is limited to local use by adults. Free-tier inputs and outputs may be used by Google for product improvement. Do not submit personal information, student records, identifiable free text, or confidential data.']
    ,['AIとの会話を消去', 'Clear AI conversation']
    ,['会話を消去', 'Clear conversation']
    ,['閉じる', 'Close']
    ,['よく使う質問', 'Suggested questions']
    ,['任意の生成AI支援:', 'Optional generative-AI support:']
    ,['公開版では分析結果を外部へ送信せず、確認してから外部AIへ貼り付けられるテキストを作成します。成人の教員・研究者がローカル実行する場合だけGeminiへ直接接続できます', 'On the public site, easyStat does not send results externally; it creates text that you can review before pasting into an external AI. Direct Gemini access is available only to adult educators and researchers running easyStat locally.']
    ,['外部AIへ貼り付ける前に「AIに渡す内容を確認」を開き、個人情報・成績原票・自由記述が含まれていないか確認してください', 'Before pasting into an external AI, open Preview AI content and check that it contains no personal information, student records, or identifiable free text.']
    ,['Gemini Interactions APIへ更新し、API側の会話保存を無効化', 'Updated to the Gemini Interactions API with API-side conversation storage disabled']
    ,['結論・レポート例を含む全数値と、T1形式の結果表参照を画面の結果と自動照合', 'Automatically validates all generated numbers, including conclusions and report examples, plus T1-style result-table references']
    ,['公開版はコピー専用、ローカル直接接続はキーをメモリだけに保持し、一時障害は上限付きで再試行', 'Public deployments are copy-only; local direct access keeps the key only in memory and retries transient failures within a fixed limit']
    ,['APIキーは保存領域へ書き込まず、このページのメモリ内だけで使用します。再読み込みまたはページを閉じると削除されます。', 'The API key is not written to browser storage. It remains only in page memory and is removed when you reload or close the page.']
    ,['この公開版からGeminiへ直接送信することはありません。分析後に「AI用テキストをコピー」を使い、学校や組織が承認したサービスで内容を確認してから利用してください。', 'This public version never sends results directly to Gemini. After running an analysis, use Copy text for AI, review the content, and paste it only into a service approved by your school or organization.']
    ,['「AI用テキストをコピー」はAPIキーなしで使えます。成人の教員・研究者がローカル実行している場合は、キーを設定すると「解釈を生成」と追加質問も利用できます。', 'Copy text for AI works without an API key. Adult educators and researchers running easyStat locally can set a key to generate an interpretation and ask follow-up questions.']
    ,['「AI用テキストをコピー」すると、結果表・見るべき数値・注意点をまとめた依頼文を作れます。内容を確認してから、学校や組織が承認したAIサービスへ貼り付けてください。', 'Copy text for AI creates a prompt containing the result tables, key values, and cautions. Review it before pasting it into a service approved by your school or organization.']
    ,['自己相関関数 (ACF)', 'Autocorrelation function (ACF)']
    ,['- 周期性の確認', '- check for recurring patterns']
]);

const ENGLISH_PATTERNS = [
    [/^(\d+)行\s*\/\s*(\d+)列$/u, '$1 rows / $2 columns'],
    [/^適合度\s*(\d+)$/u, 'Match score $1'],
    [/^(\d+)文書・(\d+)文字$/u, '$1 documents, $2 characters'],
    [/^IDのように値がほぼ全員で異なる列があります:\s*(.+)。分析対象ではなく識別用の可能性があります。$/u, 'Some columns have a different value for almost every case, like an ID: $1. They may be identifiers rather than analysis variables.'],
    [/^【(.+)】の度数分布（度数順）$/u, 'Frequency distribution of $1 (sorted by count)'],
    [/^【(.+)】の度数分布（名前順）$/u, 'Frequency distribution of $1 (sorted by label)'],
    [/^【(.+)】のヒストグラム$/u, 'Histogram of $1'],
    [/^全数値変数の箱ひげ図による比較$/u, 'Box-plot comparison of all numeric variables'],
    [/^未補正p値と、同時に選んだ(\d+)項目に対するHolm補正p値を表示しています。判定・記号・グラフは補正後p値にそろえています。$/u, 'Raw p values and Holm-adjusted p values across the $1 outcomes selected together are shown. Decisions, symbols, and graphs use the adjusted values.'],
    [/^未補正p値と、同時に選んだ(\d+)ペアに対するHolm補正p値を表示しています。判定・記号・グラフは補正後p値にそろえています。$/u, 'Raw p values and Holm-adjusted p values across the $1 pairs selected together are shown. Decisions, symbols, and graphs use the adjusted values.'],
    [/^Table 1\. ピアソン Correlation Matrix$/u, 'Table 1. Pearson Correlation Matrix'],
    [/^Table 1\. スピアマン Correlation Matrix$/u, 'Table 1. Spearman Correlation Matrix'],
    [/^期待度数5未満のセルが([\d.]+)%あります。一般的な目安（期待度数1未満のセルなし、5未満のセルが20%以下）を満たしていません。$/u, '$1% of cells have expected counts below 5. This does not meet the common guideline of no expected count below 1 and no more than 20% below 5.'],
    [/^期待度数が5未満のセルが\s*([\d.]+)%\s*あります。$/u, '$1% of cells have expected counts below 5.'],
    [/^多重比較結果 \(Tukey-Kramer法 \(等分散仮定\)\)$/u, 'Multiple comparisons (Tukey-Kramer, equal variances assumed)'],
    [/^Table\. Two-Way ANOVA Summary \(対応なし\)$/u, 'Table. Two-Way ANOVA Summary (independent measures)'],
    [/^Table\. Two-Way ANOVA Summary \(対応あり\)$/u, 'Table. Two-Way ANOVA Summary (repeated measures)'],
    [/^Table\. Two-Way ANOVA Summary \(混合\)$/u, 'Table. Two-Way ANOVA Summary (mixed design)'],
    [/^傾き \((.+)\)$/u, 'Slope ($1)'],
    [/^第(\d+)因子（α\s*=\s*([\d.]+)）$/u, 'Factor $1 (α = $2)'],
    [/^<b>(.+)\s+の推移と傾向<\/b>$/u, '<b>$1 over time and its trend</b>'],
    [/^<b>自己相関関数 \(ACF\)<\/b>\s*-\s*周期性の確認$/u, '<b>Autocorrelation function (ACF)</b> - check for recurring patterns'],
    [/^平均値の比較:\s*(.+)$/u, 'Mean comparison: $1'],
    [/^平均値の比較：\s*(.+)\s+by\s+グループ$/u, 'Mean comparison: $1 by group'],
    [/^平均値の棒グラフ:\s*(.+)$/u, 'Mean bar chart: $1'],
    [/^予測確率の分布$/u, 'Predicted probability distribution'],
    [/^分布の比較:\s*(.+)$/u, 'Distribution comparison: $1'],
    [/^因子負荷量ヒートマップ\s*\((.+)\)$/u, 'Factor-loading heatmap ($1)'],
    [/^実測:\s*(.+)$/u, 'Observed: $1'],
    [/^バイプロット\s*\((.+)\)$/u, 'Biplot ($1)'],
    [/^パス図（標準化偏回帰係数:\s*\|β\|\s*>=\s*([\d.]+)\s*のみ表示）$/u, 'Path diagram (standardized coefficients with |β| >= $1)'],
    [/^単回帰分析:\s*(.+)$/u, 'Simple regression: $1'],
    [/^差の分布:\s*(.+)$/u, 'Distribution of differences: $1'],
    [/^差\s*\((.+)\)$/u, 'Difference ($1)'],
    [/^データプレビュー\s*\((\d+)行\s*×\s*(\d+)列\)$/u, 'Data preview ($1 rows × $2 columns)'],
    [/^変数名:\s*(.+)$/u, 'Variable: $1'],
    [/^統計量:\s*平均:\s*([^,]+),\s*中央値:\s*([^,]+),\s*標準偏差:\s*([^\s]+)\s*歪度:\s*([^,]+),\s*尖度:\s*(.+)$/u, 'Statistics: mean $1, median $2, SD $3, skewness $4, kurtosis $5'],
    [/^,\s*中央値:$/u, ', median:'],
    [/^,\s*標準偏差:$/u, ', standard deviation:'],
    [/^,\s*尖度:$/u, ', kurtosis:'],
    [/^(.+)\s*の平均値$/u, 'Mean of $1'],
    [/^(.+)\s*の分布$/u, 'Distribution of $1'],
    [/^(.+)\s*の箱ひげ図$/u, 'Box plot of $1'],
    [/^ピアソン\s*相関係数・95%信頼区間（Fisher z変換）。p<0\.1† p<0\.05\* p<0\.01\*\*$/u, 'Pearson correlation coefficients with 95% confidence intervals (Fisher z transformation). † p < .10, * p < .05, ** p < .01'],
    [/^スピアマン\s*相関係数・95%信頼区間（Fisher z変換）。p<0\.1† p<0\.05\* p<0\.01\*\*$/u, 'Spearman correlation coefficients with 95% confidence intervals (Fisher z transformation). † p < .10, * p < .05, ** p < .01'],
    [/^(.+)\s+相関係数・95%信頼区間（Fisher z変換）。p<0\.1† p<0\.05\* p<0\.01\*\*$/u, '$1 correlation coefficients with 95% confidence intervals (Fisher z transformation). † p < .10, * p < .05, ** p < .01'],
    [/^第(\d+)因子$/u, 'Factor $1'],
    [/^第(\d+)成分$/u, 'Component $1'],
    [/^(.+)\s+負荷量:\s*([+-]?[\d.]+)$/u, '$1 loading: $2'],
    [/^負荷量:\s*([+-]?[\d.]+)$/u, 'Loading: $1'],
    [/^※\s*因子負荷量（(.+)）$/u, 'Factor loadings ($1)'],
    [/^(\d+)語表示$/u, '$1 terms shown'],
    [/^FDR 5%:\s*(\d+)語$/u, 'FDR 5%: $1 terms'],
    [/^ワードクラウド（「(.+)」の特徴度）$/u, 'Word cloud (distinctive terms for "$1")'],
    [/^(.+)をPNG画像で保存$/u, 'Save $1 as a PNG image'],
    [/^コミュニティ(\d+)$/u, 'Community $1'],
    [/^差の大きい上位(\d+)語$/u, 'Top $1 terms with the largest differences'],
    [/^「(.+)」の特徴語$/u, 'Distinctive terms for "$1"'],
    [/^(\d+)項移動平均$/u, '$1-point moving average'],
    [/^(.+)\s+の推移と傾向$/u, '$1 over time and its trend'],
    [/^２要因分散分析 一括表（(.+)）$/u, 'Two-way ANOVA summary ($1)'],
    [/^(.+)の主効果$/u, 'Main effect of $1'],
    [/^分散分析表:\s*(.+)$/u, 'ANOVA table: $1'],
    [/^記述統計量:\s*(.+)$/u, 'Descriptive statistics: $1'],
    [/^(.+)\s+の分析結果$/u, 'Results for $1'],
    [/^N\s*=\s*(\d+)\s*行:\s*(\d+)カテゴリ\s*列:\s*(\d+)カテゴリ$/u, 'N = $1; rows: $2 categories; columns: $3 categories'],
    [/^N=(\d+)\s*行:\s*(\d+)カテゴリ\s*列:\s*(\d+)カテゴリ$/u, 'N = $1; rows: $2 categories; columns: $3 categories'],
    [/^=(\d+)\s*行:\s*(\d+)カテゴリ\s*列:\s*(\d+)カテゴリ$/u, '=$1; rows: $2 categories; columns: $3 categories'],
    [/^クロス集計表:\s*(.+)$/u, 'Cross-tabulation: $1'],
    [/^R×C分割表:\s*モンテカルロ法による近似\s*\((.+)回シミュレーション\)$/u, 'R×C contingency table: Monte Carlo approximation ($1 simulations)'],
    [/^(.+)平均順位$/u, '$1 mean rank'],
    [/^PC(\d+)\s*\(主成分負荷量\)$/u, 'PC$1 (principal component loadings)'],
    [/^目的変数:\s*(.+)$/u, 'Outcome: $1'],
    [/^診断プロット:\s*(.+)$/u, 'Diagnostic plots: $1'],
    [/^p<0\.1† p<0\.05\* p<0\.01\*\*\s*\|\s*括弧内:\s*偏η²$/u, '† p < .10, * p < .05, ** p < .01 | Parentheses: partial η²'],
    [/^:\s*効果量 r = \|Z\| \/ √n$/u, ': effect size r = |Z| / √n'],
    [/^行数$/u, 'Rows'],
    [/^列数$/u, 'Columns'],
    [/^N\s*=\s*(.+)$/u, 'N = $1']
];

const ATTRIBUTE_NAMES = ['title', 'placeholder', 'aria-label', 'alt'];
const USER_DATA_CONTEXT_SELECTOR = [
    'option',
    'td',
    'th',
    '[data-value]',
    '[data-column]',
    '.multiselect-option',
    '.multiselect-tag',
    '.pairs-current-value',
    '.pairs-select-option',
    '.js-plotly-plot'
].join(',');
const textSources = new WeakMap();
const attributeSources = new WeakMap();
const plotSources = new WeakMap();
const plotLocalizationTimers = new WeakMap();
const bilingualHtmlSources = new WeakMap();
const bilingualAppliedLocales = new WeakMap();
const protectedTerms = new Set();
let locale = readStoredLocale();
let observer = null;
let observerRoot = null;
let localizationScheduled = false;
const pendingLocalizationRoots = new Set();

function readStoredLocale() {
    try {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
        return SUPPORTED_LOCALES.has(stored) ? stored : 'ja';
    } catch (_error) {
        return 'ja';
    }
}

function preserveOuterWhitespace(source, translated) {
    const leading = source.match(/^\s*/u)?.[0] || '';
    const trailing = source.match(/\s*$/u)?.[0] || '';
    return `${leading}${translated}${trailing}`;
}

function isProtectedTerm(source) {
    return typeof source === 'string' && protectedTerms.has(source.trim());
}

export function setProtectedTerms(terms = []) {
    protectedTerms.clear();
    addProtectedTerms(terms);
}

export function addProtectedTerms(terms = []) {
    for (const term of terms) {
        if (term === null || term === undefined) continue;
        const normalized = String(term).trim();
        if (normalized) protectedTerms.add(normalized);
    }
}

export function getSourceText(element) {
    if (!(element instanceof Element)) return '';
    if (element.matches('[data-i18n-html]')) {
        const registered = bilingualHtmlSources.get(element);
        const template = document.createElement('template');
        template.innerHTML = registered?.ja ?? element.dataset.i18nJa ?? '';
        return (template.content.textContent || '').replace(/\s+/gu, ' ').trim();
    }

    const fragments = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        fragments.push(textSources.get(node) ?? node.nodeValue ?? '');
        node = walker.nextNode();
    }
    return fragments.join('').replace(/\s+/gu, ' ').trim();
}

export function translateText(source, targetLocale = locale, options = {}) {
    if (targetLocale !== 'en' || typeof source !== 'string' || !source.trim()) return source;

    const trimmed = source.trim();
    const normalized = trimmed.replace(/\s+/gu, ' ');
    if (options.preserveUserTerms && isProtectedTerm(trimmed)) return source;
    const exact = ENGLISH_TEXT.get(trimmed) || ENGLISH_TEXT.get(normalized);
    if (exact) return preserveOuterWhitespace(source, exact);

    for (const [pattern, replacement] of ENGLISH_PATTERNS) {
        if (pattern.test(normalized)) {
            pattern.lastIndex = 0;
            const translated = normalized.replace(pattern, replacement);
            return preserveOuterWhitespace(source, ENGLISH_TEXT.get(translated) || translated);
        }
    }
    return source;
}

export function getLocale() {
    return locale;
}

export function isEnglish() {
    return locale === 'en';
}

function shouldSkipNode(node) {
    const parent = node.parentElement;
    return !parent || Boolean(parent.closest('script, style, code, pre, textarea, [data-i18n-ignore], [data-i18n-html]'));
}

function localizeTextNode(node) {
    if (shouldSkipNode(node)) return;
    if (!textSources.has(node)) textSources.set(node, node.nodeValue || '');
    const source = textSources.get(node);
    const preserveUserTerms = Boolean(node.parentElement?.closest(USER_DATA_CONTEXT_SELECTOR));
    const nextValue = locale === 'en'
        ? translateText(source, 'en', { preserveUserTerms })
        : source;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
}

function getAttributeSourceMap(element) {
    if (!attributeSources.has(element)) attributeSources.set(element, new Map());
    return attributeSources.get(element);
}

function localizeAttributes(element) {
    if (!(element instanceof Element) || element.closest('[data-i18n-ignore]')) return;
    const sources = getAttributeSourceMap(element);
    ATTRIBUTE_NAMES.forEach(name => {
        if (!element.hasAttribute(name)) return;
        if (!sources.has(name)) sources.set(name, element.getAttribute(name) || '');
        const source = sources.get(name);
        const nextValue = locale === 'en' ? translateText(source, 'en') : source;
        if (element.getAttribute(name) !== nextValue) element.setAttribute(name, nextValue);
    });
}

function captureDynamicAttributeSource(element, name) {
    if (!(element instanceof Element) || !name || !element.hasAttribute(name)) return;
    const sources = getAttributeSourceMap(element);
    const current = element.getAttribute(name) || '';
    if (!sources.has(name)) {
        sources.set(name, current);
        return;
    }
    const source = sources.get(name);
    const expected = locale === 'en' ? translateText(source, 'en') : source;
    if (current !== expected) sources.set(name, current);
}

function localizeBilingualElement(element) {
    if (!(element instanceof Element) || !element.matches('[data-i18n-html]')) return;
    if (bilingualAppliedLocales.get(element) === locale) return;
    const registered = bilingualHtmlSources.get(element);
    const nextHtml = registered
        ? (locale === 'en' ? registered.en : registered.ja)
        : (locale === 'en' ? element.dataset.i18nEn : element.dataset.i18nJa);
    if (typeof nextHtml !== 'string') return;

    // Browsers serialize text such as "p < .001" as "p &lt; .001" in
    // innerHTML. Compare canonical HTML so localization does not repeatedly
    // rewrite the same bilingual result and trigger observer loops.
    const template = document.createElement('template');
    template.innerHTML = nextHtml;
    const canonicalHtml = template.innerHTML;
    if (element.innerHTML !== canonicalHtml) element.innerHTML = canonicalHtml;
    bilingualAppliedLocales.set(element, locale);
}

function localizeElement(element) {
    if (!(element instanceof Element)) return;
    if (element.matches('[data-i18n-html]')) {
        localizeBilingualElement(element);
        return;
    }
    localizeAttributes(element);
    element.querySelectorAll('[data-i18n-html]').forEach(localizeBilingualElement);
    element.querySelectorAll('*').forEach(localizeAttributes);

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        localizeTextNode(node);
        node = walker.nextNode();
    }
}

function normalizePlotTitle(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value.text === 'string') return value.text;
    return '';
}

function capturePlotSource(plot) {
    const layout = plot.layout || {};
    const traces = Array.from(plot.data || []);
    const current = {
        title: normalizePlotTitle(layout.title),
        xTitle: normalizePlotTitle(layout.xaxis?.title),
        yTitle: normalizePlotTitle(layout.yaxis?.title),
        legendTitle: normalizePlotTitle(layout.legend?.title),
        annotationTexts: Array.from(layout.annotations || [], annotation => annotation.text || ''),
        traceNames: traces.map(trace => trace.name || ''),
        colorbarTitles: traces.map(trace => normalizePlotTitle(trace.colorbar?.title)),
        traceXLabels: traces.map(trace => Array.from(trace.x || [], value => (
            typeof value === 'string' ? value : null
        ))),
        traceYLabels: traces.map(trace => Array.from(trace.y || [], value => (
            typeof value === 'string' ? value : null
        )))
    };
    if (!plotSources.has(plot)) {
        plotSources.set(plot, current);
        return current;
    }

    const source = plotSources.get(plot);
    ['title', 'xTitle', 'yTitle', 'legendTitle'].forEach(key => {
        const displayed = current[key];
        const previous = source[key];
        const previousEnglish = translateText(previous, 'en');
        if (displayed && (!previous || (displayed !== previous && displayed !== previousEnglish))) {
            source[key] = displayed;
        }
    });
    current.traceNames.forEach((displayed, index) => {
        const previous = source.traceNames[index] || '';
        const previousEnglish = translateText(previous, 'en');
        if (displayed && (!previous || (displayed !== previous && displayed !== previousEnglish))) {
            source.traceNames[index] = displayed;
        }
    });
    current.colorbarTitles.forEach((displayed, index) => {
        const previous = source.colorbarTitles[index] || '';
        const previousEnglish = translateText(previous, 'en');
        if (displayed && (!previous || (displayed !== previous && displayed !== previousEnglish))) {
            source.colorbarTitles[index] = displayed;
        }
    });
    ['traceXLabels', 'traceYLabels'].forEach(key => {
        current[key].forEach((displayedLabels, traceIndex) => {
            if (!source[key][traceIndex]) source[key][traceIndex] = [];
            displayedLabels.forEach((displayed, valueIndex) => {
                if (!displayed) return;
                const previous = source[key][traceIndex][valueIndex] || '';
                const previousEnglish = translateText(previous, 'en', { preserveUserTerms: true });
                if (!previous || (displayed !== previous && displayed !== previousEnglish)) {
                    source[key][traceIndex][valueIndex] = displayed;
                }
            });
        });
    });
    current.annotationTexts.forEach((displayed, index) => {
        const previous = source.annotationTexts[index] || '';
        const previousEnglish = translateText(previous, 'en');
        if (displayed && (!previous || (displayed !== previous && displayed !== previousEnglish))) {
            source.annotationTexts[index] = displayed;
        }
    });
    return source;
}

function schedulePlotLocalization(plot) {
    if (!(plot instanceof Element) || locale !== 'en') return;
    window.clearTimeout(plotLocalizationTimers.get(plot));
    const timer = window.setTimeout(() => {
        plotLocalizationTimers.delete(plot);
        if (plot.isConnected) localizePlot(plot);
    }, 0);
    plotLocalizationTimers.set(plot, timer);
}

function bindPlotLocalization(plot) {
    if (plot.dataset.i18nPlotBound === 'true' || typeof plot.on !== 'function') return;
    plot.dataset.i18nPlotBound = 'true';
    plot.on('plotly_afterplot', () => schedulePlotLocalization(plot));
}

function localizePlot(plot) {
    if (!(plot instanceof Element) || !plot.classList.contains('js-plotly-plot') || !window.Plotly) return;
    bindPlotLocalization(plot);
    const source = capturePlotSource(plot);
    const target = value => locale === 'en'
        ? translateText(value, 'en', { preserveUserTerms: true })
        : value;
    const layoutUpdate = {};
    if (source.title && normalizePlotTitle(plot.layout?.title) !== target(source.title)) layoutUpdate['title.text'] = target(source.title);
    if (source.xTitle && normalizePlotTitle(plot.layout?.xaxis?.title) !== target(source.xTitle)) layoutUpdate['xaxis.title.text'] = target(source.xTitle);
    if (source.yTitle && normalizePlotTitle(plot.layout?.yaxis?.title) !== target(source.yTitle)) layoutUpdate['yaxis.title.text'] = target(source.yTitle);
    if (source.legendTitle && normalizePlotTitle(plot.layout?.legend?.title) !== target(source.legendTitle)) layoutUpdate['legend.title.text'] = target(source.legendTitle);
    source.annotationTexts.forEach((text, index) => {
        const current = plot.layout?.annotations?.[index]?.text || '';
        if (text && current !== target(text)) layoutUpdate[`annotations[${index}].text`] = target(text);
    });
    if (Object.keys(layoutUpdate).length > 0) window.Plotly.relayout(plot, layoutUpdate);

    source.traceNames.forEach((name, index) => {
        const trace = plot.data?.[index];
        if (!trace) return;
        const traceUpdate = {};
        if (name && trace.name !== target(name)) traceUpdate.name = target(name);

        const colorbarTitle = source.colorbarTitles[index] || '';
        if (colorbarTitle && normalizePlotTitle(trace.colorbar?.title) !== target(colorbarTitle)) {
            traceUpdate['colorbar.title.text'] = target(colorbarTitle);
        }

        [['x', 'traceXLabels'], ['y', 'traceYLabels']].forEach(([axis, sourceKey]) => {
            const labels = source[sourceKey][index] || [];
            const values = Array.from(trace[axis] || []);
            let changed = false;
            const translated = values.map((value, valueIndex) => {
                const sourceLabel = labels[valueIndex];
                if (!sourceLabel) return value;
                const nextValue = target(sourceLabel);
                if (value !== nextValue) changed = true;
                return nextValue;
            });
            if (changed) traceUpdate[axis] = [translated];
        });

        if (Object.keys(traceUpdate).length > 0) {
            window.Plotly.restyle(plot, traceUpdate, [index]);
        }
    });
}

function localizePlots(root) {
    if (!window.Plotly) return;
    const plots = [];
    if (root instanceof Element && root.matches('.js-plotly-plot')) plots.push(root);
    if (root?.querySelectorAll) plots.push(...root.querySelectorAll('.js-plotly-plot'));
    plots.forEach(localizePlot);
}

function updateLanguageSwitchers(root = document) {
    root.querySelectorAll?.('[data-language-switcher]').forEach(switcher => {
        switcher.querySelectorAll('[data-locale]').forEach(button => {
            const active = button.dataset.locale === locale;
            button.classList.toggle('active', active);
            button.setAttribute('aria-checked', String(active));
            button.setAttribute('tabindex', active ? '0' : '-1');
        });
    });
}

export function applyLocale(root = document) {
    document.documentElement.lang = locale;
    if (root === document) {
        const sourceTitle = document.documentElement.dataset.i18nTitleJa || document.title;
        document.documentElement.dataset.i18nTitleJa = sourceTitle;
        document.title = locale === 'en' ? translateText(sourceTitle, 'en') : sourceTitle;
        localizeElement(document.body);
    } else if (root instanceof Element) {
        localizeElement(root);
    }
    updateLanguageSwitchers(root === document ? document : root.ownerDocument || document);
    queueMicrotask(() => localizePlots(root));
}

function scheduleLocalization(nodes = []) {
    nodes.forEach(node => {
        const element = node instanceof Element
            ? node
            : node.parentElement;
        if (element?.isConnected) pendingLocalizationRoots.add(element);
    });
    if (localizationScheduled) return;
    localizationScheduled = true;
    queueMicrotask(() => {
        localizationScheduled = false;
        const roots = Array.from(pendingLocalizationRoots);
        pendingLocalizationRoots.clear();
        const topLevelRoots = roots.filter(root => !roots.some(other => (
            other !== root && other.contains(root)
        )));
        topLevelRoots.forEach(root => {
            if (!root.isConnected) return;
            localizeElement(root);
            updateLanguageSwitchers(root);
            queueMicrotask(() => localizePlots(root));
        });
    });
}

function startObserver(root = document.body) {
    observer?.disconnect();
    observerRoot = root;
    observer = new MutationObserver(mutations => {
        const addedNodes = [];
        mutations.forEach(mutation => {
            const target = mutation.target;
            if (mutation.type === 'attributes') {
                if (target instanceof Element) {
                    captureDynamicAttributeSource(target, mutation.attributeName);
                    addedNodes.push(target);
                }
                return;
            }
            if (mutation.addedNodes.length === 0) return;
            // Plotly rebuilds a large SVG subtree on every relayout. Plot text
            // is handled by plotly_afterplot, so a full-page pass here would
            // compete with interactive figure controls.
            if (target instanceof Element && target.closest('.js-plotly-plot')) {
                schedulePlotLocalization(target.closest('.js-plotly-plot'));
                return;
            }
            addedNodes.push(...mutation.addedNodes);
        });
        if (addedNodes.length > 0) scheduleLocalization(addedNodes);
    });
    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ATTRIBUTE_NAMES
    });
}

function bindLanguageSwitchers(root = document) {
    root.querySelectorAll('[data-language-switcher]').forEach(switcher => {
        if (switcher.dataset.languageBound === 'true') return;
        switcher.dataset.languageBound = 'true';
        switcher.addEventListener('click', event => {
            const button = event.target.closest('[data-locale]');
            if (button) setLocale(button.dataset.locale);
        });
        switcher.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(switcher.querySelectorAll('[data-locale]'));
            const currentIndex = Math.max(0, buttons.indexOf(event.target.closest('[data-locale]')));
            const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
            const nextButton = buttons[(currentIndex + direction + buttons.length) % buttons.length];
            setLocale(nextButton.dataset.locale);
            nextButton.focus();
        });
    });
}

export function setLocale(nextLocale) {
    if (!SUPPORTED_LOCALES.has(nextLocale) || nextLocale === locale) return;
    locale = nextLocale;
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch (_error) {
        // The mode still works for this page when storage is unavailable.
    }
    applyLocale(document);
    document.dispatchEvent(new CustomEvent('easystat:localechange', { detail: { locale } }));
}

function escapeAttribute(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function bilingualHtml(japaneseHtml, englishHtml) {
    const current = locale === 'en' ? englishHtml : japaneseHtml;
    return `<span data-i18n-html style="display: contents;" data-i18n-ja="${escapeAttribute(japaneseHtml)}" data-i18n-en="${escapeAttribute(englishHtml)}">${current}</span>`;
}

export function registerBilingualHtml(element, englishHtml, japaneseHtml = null) {
    if (!(element instanceof Element) || typeof englishHtml !== 'string') return;
    const existing = bilingualHtmlSources.get(element);
    const japaneseSource = existing?.ja ?? (typeof japaneseHtml === 'string' ? japaneseHtml : element.innerHTML);
    bilingualHtmlSources.set(element, { ja: japaneseSource, en: englishHtml });
    bilingualAppliedLocales.delete(element);
    element.setAttribute('data-i18n-html', '');
    localizeBilingualElement(element);
}

export function initializeI18n(root = document) {
    locale = readStoredLocale();
    bindLanguageSwitchers(root);
    applyLocale(root);
    if (root === document && document.body) startObserver(document.body);
    return locale;
}

export const i18nStorageKey = LOCALE_STORAGE_KEY;
