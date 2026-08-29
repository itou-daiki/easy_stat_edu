export const MANUAL_SIDEBAR_EN = `
    <div class="sidebar-group">
        <div class="sidebar-group-title">0. START HERE</div>
        <a href="#quick-start" class="sidebar-link"><i class="fas fa-route"></i> 3-minute workflow</a>
        <a href="#choose-analysis" class="sidebar-link"><i class="fas fa-compass"></i> Analysis guide</a>
        <a href="#reporting" class="sidebar-link"><i class="fas fa-pen-nib"></i> Reporting results</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">1. PREPARE YOUR DATA</div>
        <a href="#prep-data" class="sidebar-link"><i class="fas fa-file-excel"></i> Spreadsheet format</a>
        <a href="#input-output" class="sidebar-link"><i class="fas fa-keyboard"></i> Input, figures, and export</a>
        <a href="#prep-types" class="sidebar-link"><i class="fas fa-shapes"></i> Numeric vs categorical</a>
        <a href="#prep-pvalue" class="sidebar-link"><i class="fas fa-lightbulb"></i> Understanding p values</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">2. UTILITIES</div>
        <a href="#util-support" class="sidebar-link"><i class="fas fa-magic"></i> Analysis guide</a>
        <a href="#util-process" class="sidebar-link"><i class="fas fa-filter"></i> Data preparation</a>
        <a href="#util-merge" class="sidebar-link"><i class="fas fa-object-group"></i> Merge data</a>
        <a href="#util-score" class="sidebar-link"><i class="fas fa-calculator"></i> Scale scores</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">3. EXPLORE</div>
        <a href="#goal-eda" class="sidebar-link"><i class="fas fa-search"></i> EDA and graphs</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">4. COMPARE GROUPS</div>
        <a href="#goal-compare-2" class="sidebar-link"><i class="fas fa-vial"></i> t and rank tests</a>
        <a href="#goal-compare-3" class="sidebar-link"><i class="fas fa-chart-bar"></i> ANOVA and Kruskal-Wallis</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">5. CATEGORICAL DATA</div>
        <a href="#goal-prop" class="sidebar-link"><i class="fas fa-table"></i> Counts and proportions</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">6. RELATIONSHIPS</div>
        <a href="#goal-relate" class="sidebar-link"><i class="fas fa-project-diagram"></i> Correlation</a>
        <a href="#goal-predict" class="sidebar-link"><i class="fas fa-chart-line"></i> Regression</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">7. SUMMARIZE</div>
        <a href="#goal-multi" class="sidebar-link"><i class="fas fa-compress-arrows-alt"></i> Factor analysis and PCA</a>
        <a href="#goal-other" class="sidebar-link"><i class="fas fa-font"></i> Time series and text</a>
    </div>
    <div class="sidebar-group">
        <div class="sidebar-group-title">8. HELP</div>
        <a href="#faq" class="sidebar-link"><i class="fas fa-question-circle"></i> Troubleshooting</a>
    </div>
`;

export const MANUAL_CONTENT_EN = `
    <div class="alert-box info" style="margin-top: 0;">
        <i class="fas fa-info-circle"></i> <strong>New to statistics?</strong><br>
        easyStat is designed to help you get from a question to a defensible analysis without getting lost in software terminology.
        Before running an analysis, open <strong>In plain language</strong> to review its purpose and what to inspect.
        Afterward, open the result explanation to see the main finding, the meaning of each displayed statistic, and common mistakes to avoid.
    </div>

    <section id="quick-start" class="content-section">
        <h2><i class="fas fa-route"></i> Start in 3 minutes</h2>
        <p>Use this order when you are unsure. Statistical calculations, text mining, and figure generation run in your browser. easyStat does not upload your dataset to an easyStat analysis server.</p>
        <div class="step-list">
            <div class="step-item"><strong>Load or enter data</strong><br>Choose an Excel or CSV file, paste a rectangular table, type directly into the grid, or use a demo dataset.</div>
            <div class="step-item"><strong>Check the data overview</strong><br>Confirm column names, inferred numeric or categorical types, row counts, and missing values.</div>
            <div class="step-item"><strong>Choose an analysis for your question</strong><br>Use the Analysis guide or the selection table below. Decide whether you are comparing groups, examining a relationship, or predicting an outcome.</div>
            <div class="step-item"><strong>Select variables and run</strong><br>Choose the outcome, predictors, grouping variables, or paired measures shown on the analysis screen.</div>
            <div class="step-item"><strong>Read the result in order</strong><br>Check sample size and descriptive statistics, then the estimate and confidence interval, the p value, the effect size, and the graph.</div>
            <div class="step-item"><strong>State only what the design supports</strong><br>A nonsignificant result does not prove equality, and an association by itself does not establish causation.</div>
        </div>
        <div class="alert-box">
            <strong>Optional Gemini assistance:</strong> Direct API use is for people aged 18 or older who have reviewed the Gemini API terms and data handling. Data is sent only when you configure a key and request an interpretation or ask a follow-up question. Raw rows and free-text examples are excluded by default, and the payload can be previewed. Automatic masking can miss sensitive content, and free-tier inputs and outputs may be used by Google for product improvement. Do not submit personal, student-record, or confidential data. For secondary-school classes, students should not enter API keys; use the copy prompt with a school-approved service instead. A static web app cannot securely conceal a key, so use a dedicated restricted key temporarily and delete it afterward. Always verify generated numbers against the on-screen results.
        </div>
        <div class="alert-box info">
            <strong>Recommended AI review order:</strong> research question and variables, main result, effect size and confidence interval, assumptions, limits on interpretation, and next checks. Do not explain a nonsignificant result only by sample size, and do not collect more data merely to obtain significance.
        </div>
    </section>

    <section id="input-output" class="content-section">
        <h2><i class="fas fa-keyboard"></i> Input, figure editing, and export</h2>
        <h3>When you do not have a file</h3>
        <ul>
            <li>Use <strong>Paste table</strong> to type headers and values into cells.</li>
            <li>Copy a range from Excel or another spreadsheet and paste it into the upper-left cell; rows and columns are preserved.</li>
            <li>Move with the arrow keys, Enter, and Tab. Put variable names in row 1 and one case per row below it.</li>
            <li>For text mining only, paste one document per line into <strong>Direct text input</strong>.</li>
        </ul>
        <h3>Edit figures and tables</h3>
        <ul>
            <li>Open <strong>Figure settings</strong> to show or edit the title, axis labels, legend, width, height, and aspect ratio.</li>
            <li>Turn off automatic axis limits to enter a minimum or maximum. Figures with brackets or significance labels protect enough upper space to keep annotations inside the plotting area.</li>
            <li>Use <strong>Apply settings to all figures</strong> for shared titles, axis labels, limits, width, height, and aspect ratio. Blank labels and unchanged limits preserve each figure's current value.</li>
            <li>Mean comparisons with raw observations can switch between a bar chart with mean and standard error and a box plot with quartiles and observed values.</li>
            <li>Narrow manual axis ranges can hide data or exaggerate differences. Prefer automatic limits for analysis, and disclose manual limits in exported figures.</li>
            <li>Before saving, check titles, labels, legends, color keys, clipping, and overlapping text.</li>
            <li>To keep the full result, use the browser's print command and save as PDF. Input fields and action buttons are omitted so that result tables, interpretations, and figures remain. Check page breaks and clipped text in print preview before saving.</li>
        </ul>
    </section>

    <section id="choose-analysis" class="content-section">
        <h2><i class="fas fa-compass"></i> Analysis selection guide</h2>
        <p>Start from the question you want to answer, then confirm that your data have the required structure.</p>
        <table class="manual-table">
            <thead><tr><th>Question</th><th>Analysis</th><th>Data needed</th><th>Inspect</th></tr></thead>
            <tbody>
                <tr><td>What does the dataset look like?</td><td>Exploratory data analysis</td><td><span class="data-badge numeric">1+ numeric variables</span></td><td>Mean, median, SD, distribution, outliers, missingness</td></tr>
                <tr><td>Do two groups differ?</td><td>Independent t test or Mann-Whitney U; paired t test or Wilcoxon for paired data</td><td><span class="data-badge numeric">Numeric outcome</span><span class="data-badge category">Two groups or two measures</span></td><td>Design, estimate, confidence interval, p value, effect size</td></tr>
                <tr><td>Do three or more groups differ?</td><td>One-way or two-way ANOVA; Kruskal-Wallis</td><td><span class="data-badge numeric">Numeric outcome</span><span class="data-badge category">Group factors</span></td><td>Main effects, interaction, post-hoc comparisons</td></tr>
                <tr><td>Are categorical variables associated?</td><td>Cross-tabulation, chi-square, Fisher exact, or McNemar</td><td><span class="data-badge category">Two categorical variables</span></td><td>Counts, percentages, expected counts, residuals, p value</td></tr>
                <tr><td>Do numeric variables move together?</td><td>Correlation</td><td><span class="data-badge numeric">2+ numeric variables</span></td><td>Scatterplot, r, confidence interval, outliers</td></tr>
                <tr><td>Can a numeric outcome be predicted?</td><td>Simple or multiple regression</td><td><span class="data-badge numeric">Numeric outcome and predictors</span></td><td>Coefficients, confidence intervals, R-squared, residuals, VIF</td></tr>
                <tr><td>Can a binary outcome be predicted?</td><td>Logistic regression</td><td><span class="data-badge category">Binary outcome</span><span class="data-badge numeric">Predictors</span></td><td>Odds ratios, intervals, model fit, confusion matrix</td></tr>
                <tr><td>Can many variables be summarized?</td><td>Factor analysis or PCA</td><td><span class="data-badge numeric">3+ numeric variables</span></td><td>Adequacy, loadings, explained variance, interpretability</td></tr>
                <tr><td>What changes over order or time?</td><td>Time-series analysis</td><td><span class="data-badge numeric">Ordered numeric values</span></td><td>Trend, moving average, autocorrelation</td></tr>
                <tr><td>What patterns appear in open text?</td><td>Text mining</td><td><span class="data-badge text">One text column</span></td><td>Frequency, document frequency, TF-IDF, KWIC, co-occurrence</td></tr>
            </tbody>
        </table>
    </section>

    <section id="reporting" class="content-section">
        <h2><i class="fas fa-pen-nib"></i> Report results clearly</h2>
        <p>Report more than whether p crossed a threshold. Include the sample, direction and size of the estimate, uncertainty, statistical test, and limits of the design.</p>
        <div class="mini-checklist">
            <strong>Before writing</strong>
            <ul>
                <li>Confirm the analyzed N and how missing values were handled.</li>
                <li>Inspect raw distributions, extreme values, and the relevant assumptions.</li>
                <li>Read the estimate, confidence interval, and effect size together with p.</li>
                <li>Distinguish a difference, an association, a prediction, and a causal claim.</li>
            </ul>
        </div>
        <h3>Example structure</h3>
        <div class="result-template">In this sample, [group or variable] had [estimate and direction]. The [test name] gave [statistic, df, p], with [effect size and confidence interval]. These data [support / do not provide clear evidence for] the stated difference or association. This result does not by itself establish [equality / causality / out-of-sample prediction].</div>
    </section>

    <section id="prep-data" class="content-section">
        <h2><i class="fas fa-file-excel"></i> Spreadsheet format</h2>
        <p>Statistical software needs a simple rectangular table. Decorative spreadsheet layouts, merged cells, and extra title rows are difficult to interpret reliably.</p>
        <div class="good-bad-grid">
            <div class="bad-box"><h4>Do not use</h4><ul><li>Titles above the header row</li><li>Merged cells</li><li>Several people in one row</li><li>Units such as "kg" inside numeric cells</li><li>Different missing-value codes in the same column</li></ul></div>
            <div class="good-box"><h4>Use this structure</h4><ul><li>One variable name per column in row 1</li><li>One case or participant per row</li><li>One meaning and data type per column</li><li>Numbers only in numeric columns</li><li>Consistent category labels and missing values</li></ul></div>
        </div>
        <table class="demo-table"><thead><tr><th>ID</th><th>Group</th><th>Score</th><th>Comment</th></tr></thead><tbody><tr><td>1</td><td>A</td><td>82</td><td>Clear lesson</td></tr><tr><td>2</td><td>B</td><td>74</td><td>More practice needed</td></tr></tbody></table>
    </section>

    <section id="prep-types" class="content-section">
        <h2><i class="fas fa-shapes"></i> Numeric and categorical variables</h2>
        <div class="good-bad-grid">
            <div class="good-box"><h4>Numeric</h4><p>Arithmetic, distances, and averages are meaningful.</p><ul><li>Height, time, score, temperature</li><li>A rating scale when treated as an approximately numeric measure and justified</li></ul></div>
            <div class="bad-box"><h4>Categorical</h4><p>Values identify groups or labels; their numeric codes are not quantities.</p><ul><li>Class, sex, treatment condition</li><li>Codes such as 1 = yes and 2 = no</li></ul></div>
        </div>
        <p>If a variable appears in the wrong selector, inspect that entire column for units, stray text, inconsistent blanks, or numeric category codes.</p>
    </section>

    <section id="prep-pvalue" class="content-section">
        <h2><i class="fas fa-lightbulb"></i> What a p value means</h2>
        <p>A p value is the probability of obtaining a result at least as extreme as the observed one, assuming the null hypothesis and the model assumptions are true. It is not the probability that the result happened by chance, and it is not the probability that the null hypothesis is true.</p>
        <div class="alert-box"><strong>At a 5% threshold:</strong> p &lt; .05 is evidence against the specified null hypothesis under the analysis assumptions. It does not tell you whether an effect is large, useful, or causal. p &ge; .05 does not prove that groups are equal or that no association exists.</div>
        <p>Always read p alongside the estimate, confidence interval, effect size, sample size, graph, assumptions, and study design.</p>
    </section>

    <section id="util-support" class="content-section">
        <h2><i class="fas fa-magic"></i> Analysis guide</h2>
        <p>The guide uses your research goal and inferred variable types to suggest candidate analyses. It does not send your data to an external AI service. Treat its suggestions as a checklist: confirm the design, required variables, assumptions, and reason for the recommendation.</p>
    </section>

    <section id="util-process" class="content-section">
        <h2><i class="fas fa-filter"></i> Prepare and transform data</h2>
        <p>Filter rows, reverse-score items, group numeric values, standardize variables, recode values, calculate new columns, clean text, and handle missing or outlying cells. Record every transformation and compare row counts and distributions before and after processing.</p>
        <table class="manual-table"><thead><tr><th>Task</th><th>Check afterward</th></tr></thead><tbody><tr><td>Filter rows</td><td>Condition, retained N, and excluded cases</td></tr><tr><td>Reverse score</td><td>Scale endpoints and item direction</td></tr><tr><td>Recode or group</td><td>Meaning of every new category and missing code</td></tr><tr><td>Handle outliers</td><td>Rule, affected cells, and sensitivity of conclusions</td></tr><tr><td>Remove missing rows</td><td>Final N and whether missingness may be systematic</td></tr></tbody></table>
    </section>

    <section id="util-merge" class="content-section">
        <h2><i class="fas fa-object-group"></i> Merge data</h2>
        <p>Join two Excel or CSV files using a shared key such as student ID. Before analysis, verify key uniqueness, unmatched rows, duplicate keys, row counts, and missing values introduced by the join.</p>
    </section>

    <section id="util-score" class="content-section">
        <h2><i class="fas fa-calculator"></i> Calculate scale scores</h2>
        <p>Combine questionnaire items into factor or subscale scores, with reverse-coded items handled from the scale definition file. Combine only items intended to measure the same construct, verify the reverse-coding endpoints, and decide in advance whether the score is a sum or mean.</p>
    </section>

    <section id="goal-eda" class="content-section">
        <h2><i class="fas fa-search"></i> Exploratory data analysis and graphs</h2>
        <p>Use EDA before formal testing to inspect data quality and shape. Compare means with medians, check variability and missingness, look for impossible values and outliers, and inspect distributions rather than assuming normality from a single summary statistic.</p>
    </section>

    <section id="goal-compare-2" class="content-section">
        <h2><i class="fas fa-vial"></i> Compare two groups or measurements</h2>
        <ul>
            <li><strong>Independent t test:</strong> compare means from two separate groups. easyStat reports Welch's test by default.</li>
            <li><strong>Paired t test:</strong> compare two measurements from the same cases; inspect the distribution of within-case differences.</li>
            <li><strong>Mann-Whitney U:</strong> compare rank distributions for two independent groups. It is not automatically a test of medians when distribution shapes differ.</li>
            <li><strong>Wilcoxon signed-rank:</strong> compare paired differences using signed ranks; its symmetry assumption and zero differences still matter.</li>
        </ul>
        <p>The t-test confidence interval shown by easyStat is for the mean difference, not for Cohen's d or d<sub>z</sub>. Check whether it crosses zero and how wide it is.</p>
        <p>When several outcomes or pairs are tested in one run, easyStat reports both raw and Holm-adjusted p values. Decisions, interpretations, and graph symbols use the adjusted values; report which tests formed the family.</p>
    </section>

    <section id="goal-compare-3" class="content-section">
        <h2><i class="fas fa-chart-bar"></i> Compare three or more groups</h2>
        <ul><li><strong>One-way ANOVA:</strong> compare means across levels of one factor.</li><li><strong>Two-way ANOVA:</strong> estimate two main effects and their interaction. Interpret a clear interaction before averaging it away in main effects.</li><li><strong>Kruskal-Wallis:</strong> compare rank distributions across independent groups.</li></ul>
        <p>An omnibus p value tells you whether the data show some overall difference; use the corrected post-hoc table to identify supported pairwise differences. Do not interpret individual pairs as confirmed when the workflow labels them exploratory.</p>
    </section>

    <section id="goal-prop" class="content-section">
        <h2><i class="fas fa-table"></i> Counts, proportions, and categorical association</h2>
        <ul><li><strong>Cross-tabulation:</strong> inspect counts and row, column, or total percentages.</li><li><strong>Chi-square:</strong> compare observed with expected counts; check expected-count conditions and adjusted residuals.</li><li><strong>Fisher exact:</strong> use an exact or Monte Carlo calculation when expected counts are small.</li><li><strong>McNemar:</strong> test paired binary change using discordant pairs.</li></ul>
        <p>For a nonsignificant overall chi-square test, unadjusted cell p values below .05 are not standalone evidence of a confirmed cell imbalance.</p>
    </section>

    <section id="goal-relate" class="content-section">
        <h2><i class="fas fa-project-diagram"></i> Correlation</h2>
        <p>A correlation coefficient ranges from -1 to 1 and describes the direction and strength of a bivariate association. Inspect the scatterplot for nonlinearity, clusters, and influential values. Correlation does not establish causation and can be distorted by range restriction or confounding.</p>
    </section>

    <section id="goal-predict" class="content-section">
        <h2><i class="fas fa-chart-line"></i> Regression and prediction</h2>
        <ul><li><strong>Simple regression:</strong> model one numeric outcome from one predictor.</li><li><strong>Multiple regression:</strong> estimate each predictor's adjusted association while holding the others constant; inspect residuals and VIF.</li><li><strong>Logistic regression:</strong> model a binary outcome; odds ratios are not direct multipliers of probability.</li></ul>
        <div class="alert-box">Training-data accuracy can be optimistic. Use cross-validation or new data to evaluate prediction. Observational regression coefficients do not establish cause and effect.</div>
    </section>

    <section id="goal-multi" class="content-section">
        <h2><i class="fas fa-compress-arrows-alt"></i> Factor analysis and PCA</h2>
        <p><strong>Factor analysis</strong> explores latent constructs that may account for correlations among items. Check KMO, Bartlett's test, communalities, factor count, rotation, loadings, cross-loadings, and substantive interpretability.</p>
        <p><strong>PCA</strong> forms components that summarize variance in observed numeric variables. Check eigenvalues, explained variance, loadings, and score plots. Component loadings are not factor loadings, and signs can reverse without changing the solution.</p>
    </section>

    <section id="goal-other" class="content-section">
        <h2><i class="fas fa-font"></i> Time series and text mining</h2>
        <p><strong>Time series:</strong> ensure observations are correctly ordered, then inspect the raw series, moving average, and autocorrelation. A visible trend or recurring pattern is descriptive and does not by itself identify a cause.</p>
        <p><strong>Text mining:</strong> select a text column or enter one document per line. Review term frequency, document frequency, TF-IDF, estimated part-of-speech rankings, KWIC, word clouds, and co-occurrence.</p>
        <ul><li>Word-cloud size represents frequency, TF-IDF, or group distinctiveness according to the legend; color represents part of speech.</li><li>A co-occurrence edge represents Jaccard similarity within the selected unit. It is not proof of semantic or causal connection.</li><li>When a category is selected, compare all groups first, then review each group's tables, word clouds, and network in sequence.</li><li>Unequal document counts can distort raw frequencies. Compare document rates and TF-IDF, and read the original context in KWIC.</li><li>Fast tokenization and part-of-speech labels are approximations. Confirm important terms in context.</li></ul>
    </section>

    <section id="faq" class="content-section">
        <h2><i class="fas fa-question-circle"></i> Troubleshooting</h2>
        <div class="faq-item"><div class="faq-q"><i class="fas fa-q"></i> My file does not load.</div><div class="faq-a">Remove title rows and merged cells. Put one variable name in each first-row cell and one case per row below it. Check the file extension and empty columns.</div></div>
        <div class="faq-item"><div class="faq-q"><i class="fas fa-q"></i> The Run button is disabled.</div><div class="faq-a">Select every required variable. If a column is missing from a selector, check whether it was inferred as the wrong type.</div></div>
        <div class="faq-item"><div class="faq-q"><i class="fas fa-q"></i> A numeric column is not listed.</div><div class="faq-a">Look for units, spaces, words such as "about," or inconsistent missing-value markers. Numeric columns should contain numbers only.</div></div>
        <div class="faq-item"><div class="faq-q"><i class="fas fa-q"></i> Should I always use a nonparametric test?</div><div class="faq-a">No. Nonparametric methods make different assumptions and answer rank-based questions; they are not universally safer or more powerful. Match the method to the study design, estimand, and data shape.</div></div>
        <div class="faq-item"><div class="faq-q"><i class="fas fa-q"></i> Can I conclude there is no difference when p is above .05?</div><div class="faq-a">No. State that the sample did not provide sufficiently clear evidence at the chosen threshold, then report the estimate, interval, effect size, and precision.</div></div>
    </section>
`;
