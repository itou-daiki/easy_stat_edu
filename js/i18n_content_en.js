export const BEGINNER_EXPLANATIONS_EN = {
    analysis_support: {
        summary: 'This guide helps you match your question and data types with suitable analysis methods.',
        steps: [
            'Describe your question as a comparison, relationship, prediction, or another clear goal.',
            'Check whether the outcome and explanatory variables are numeric or categorical.',
            'Review the requirements of each suggested method before running it.'
        ],
        caution: 'A suggestion is only a starting point. It does not prove that the research question or a later conclusion is correct.'
    },
    data_processing: {
        summary: 'This tool cleans missing values, inconsistent labels, and other issues before analysis.',
        steps: [
            'Check the original values and the number of missing cells before making changes.',
            'Decide and record the rule used for each change.',
            'Compare the row count and distributions before and after processing.'
        ],
        caution: 'Never change values simply to obtain a preferred result. Keep a record so every processing decision can be explained.'
    },
    data_merge: {
        summary: 'This tool combines tables by matching an ID that represents the same person or case.',
        steps: [
            'Confirm that the matching ID has the same meaning in both tables.',
            'Check row counts and duplicate IDs before and after the merge.',
            'Look for new missing cells in the merged table.'
        ],
        caution: 'Repeated IDs can unexpectedly multiply rows. A completed merge is not, by itself, proof that the merged data are correct.'
    },
    factor_score: {
        summary: 'This tool combines responses to several items into a scale or subscale score.',
        steps: [
            'Confirm which items belong to each scale.',
            'Identify items that require reverse scoring.',
            'Check the possible score range and the treatment of missing values.'
        ],
        caution: 'Being able to calculate a score does not establish that the scale measures the intended construct. Reliability and validity require separate evidence.'
    },
    eda: {
        summary: 'Exploratory data analysis examines distributions, variability, unusual values, and relationships before formal testing.',
        steps: [
            'Use the mean, median, minimum, and maximum to get an overview.',
            'Inspect histograms and box plots for skewness and possible outliers.',
            'Use scatter plots to see whether relationships appear linear.'
        ],
        caution: 'A visible difference in a graph does not by itself establish a statistically clear difference or a causal effect.'
    },
    cross_tabulation: {
        summary: 'A cross-tabulation compares counts and percentages for combinations of two categorical variables.',
        steps: [
            'Check the count in every cell first.',
            'Identify whether percentages are based on rows or columns.',
            'Look for combinations with notably high or low counts and percentages.'
        ],
        caution: 'Percentages alone do not account for sampling variation. Also inspect small cell counts and use an appropriate test when needed.'
    },
    correlation: {
        summary: 'Correlation measures whether two numeric variables tend to increase together or move in opposite directions.',
        steps: [
            'Inspect the scatter plot for shape and possible outliers.',
            'Use the sign of r for direction and its absolute value for strength.',
            'Read the p value and confidence interval to assess uncertainty.'
        ],
        caution: 'Correlation does not establish that one variable causes the other. A third variable may be related to both.'
    },
    ttest: {
        summary: 'A t test examines the size and uncertainty of a mean difference between two groups, two measurements, or a sample and a reference value.',
        steps: [
            'Compare the two means and identify the direction of the difference.',
            'Read the 95% confidence interval for the mean difference and the p value.',
            'Use d, or d_z for paired data, to describe the size of the difference.'
        ],
        caution: 'The p value addresses how clearly the data distinguish the difference from zero; the effect size describes its magnitude. A non-significant p value and a moderate effect-size estimate are not contradictory, and p >= .05 does not prove equality. Read the confidence interval as well.'
    },
    anova_one_way: {
        summary: 'One-way ANOVA tests whether the means of three or more groups or conditions differ overall.',
        steps: [
            'Compare group means and box plots.',
            'Use F, the p value, and the effect size to assess the overall difference.',
            'If the overall test is significant, use multiple comparisons to locate the differences.'
        ],
        caution: 'The overall p value does not identify which groups differ. Read the multiple-comparison results and the distributions together.'
    },
    anova_two_way: {
        summary: 'Two-way ANOVA examines two factors and whether their combination changes the outcome.',
        steps: [
            'Check the interaction first to see whether the pattern depends on the factor combination.',
            'Then inspect each main effect.',
            'Use the interaction plot, simple effects, and multiple comparisons to locate specific differences.'
        ],
        caution: 'When an interaction is present, do not reduce the result to a simple statement such as one group being higher overall.'
    },
    mann_whitney: {
        summary: 'The Mann-Whitney U test converts values to ranks and compares the distributions of two independent groups.',
        steps: [
            'Inspect box plots and medians for distribution location and shape.',
            'Use U and the p value to assess the rank difference.',
            'Use effect size r to describe the magnitude of the difference.'
        ],
        caution: 'This is not a test of means. If distribution shapes differ greatly, it cannot be interpreted as only a difference in medians.'
    },
    kruskal_wallis: {
        summary: 'The Kruskal-Wallis test ranks the data and compares distributions across three or more independent groups.',
        steps: [
            'Inspect group box plots and medians.',
            'Use H and the p value to assess the overall difference.',
            'If the overall test is significant, use post-hoc comparisons to locate the differences.'
        ],
        caution: 'A significant overall test does not identify which groups differ; that requires post-hoc comparisons.'
    },
    wilcoxon_signed_rank: {
        summary: 'The Wilcoxon signed-rank test compares two paired measurements, such as before and after scores, by ranking their differences.',
        steps: [
            'Confirm that the two measurements are paired for the same cases.',
            'Compare medians and the direction of the differences.',
            'Use W, the p value, and effect size r to assess the change and its magnitude.'
        ],
        caution: 'Do not use this test for two unrelated groups. Also inspect zero differences and unusually large paired differences.'
    },
    mcnemar: {
        summary: 'McNemar\'s test examines the direction of change in paired binary responses, such as yes/no answers before and after.',
        steps: [
            'Check the two cells containing cases whose responses changed.',
            'Identify which direction of change is more common.',
            'Use the p value to assess whether the two directions are imbalanced.'
        ],
        caution: 'The test is driven by changed responses, not by cases that gave the same response twice. It is not suitable for unpaired data.'
    },
    chi_square: {
        summary: 'A chi-square test asks whether the combinations of two categorical variables show more imbalance than expected under independence.',
        steps: [
            'Inspect counts and percentages in the cross-tabulation.',
            'Check expected counts and the p value to see whether the test conditions are adequate.',
            'Use adjusted residuals and Cramer\'s V to locate and size the association.'
        ],
        caution: 'A p value above .05 does not prove complete independence. A significant association also does not establish cause and effect.'
    },
    fisher_exact: {
        summary: 'Fisher\'s exact test examines association in a contingency table and remains useful when expected cell counts are small.',
        steps: [
            'Inspect every cell count and percentage.',
            'Read the exact or Monte Carlo p value.',
            'Use Cramer\'s V for association strength and, for a 2 x 2 table, inspect the odds ratio.'
        ],
        caution: 'The p value does not describe association strength. With sparse tables, report cell counts and the calculation method because uncertainty can be substantial.'
    },
    regression_simple: {
        summary: 'Simple linear regression represents the relationship between one explanatory variable and a numeric outcome with a straight line.',
        steps: [
            'Inspect the scatter plot to see whether a straight-line model is plausible.',
            'Use the regression coefficient to describe the outcome change for a one-unit increase in X.',
            'Read the p value, R-squared, and residual plots to assess the relationship and model fit.'
        ],
        caution: 'A fitted line does not establish causation. Avoid making predictions beyond the observed range of the data.'
    },
    regression_multiple: {
        summary: 'Multiple regression uses several explanatory variables together to examine or predict a numeric outcome.',
        steps: [
            'Check the model R-squared and overall p value.',
            'Read each coefficient as a relationship after holding the other model variables constant.',
            'Inspect VIF and residuals for unstable coefficients and assumption problems.'
        ],
        caution: 'A significant coefficient is not proof of causation. Strong overlap among explanatory variables can make coefficient signs and sizes unstable.'
    },
    logistic_regression: {
        summary: 'Logistic regression predicts the probability of a binary outcome from one or more explanatory variables.',
        steps: [
            'Confirm which outcome category is treated as the event.',
            'Use odds ratios and confidence intervals to assess the direction and magnitude of each relationship.',
            'Compare the confusion matrix and baseline accuracy to assess prediction performance.'
        ],
        caution: 'An odds ratio is not a direct multiplier of probability. Accuracy on the training data alone does not show how well the model will predict new cases.'
    },
    factor_analysis: {
        summary: 'Factor analysis groups items with similar response patterns to explore shared underlying constructs.',
        steps: [
            'Check whether the number of factors and rotation method fit the purpose.',
            'Use factor loadings to identify the items most strongly related to each factor.',
            'Name factors from the content of the items that cluster together.'
        ],
        caution: 'A factor name is an interpretation based on item content, not an answer produced automatically by the calculation. Replication in other data is important.'
    },
    pca: {
        summary: 'Principal component analysis compresses many numeric variables into a smaller set of summary dimensions while retaining as much variation as possible.',
        steps: [
            'Use explained and cumulative variance to see how much information is retained.',
            'Use component loadings to interpret each summary dimension.',
            'Inspect score plots to compare the positions of cases.'
        ],
        caution: 'A principal component is a mathematical summary axis. It should not automatically be interpreted as an unobserved psychological factor.'
    },
    time_series: {
        summary: 'Time-series analysis looks for trends, cycles, and unusual time points in values ordered over time.',
        steps: [
            'Confirm that time points are in the correct order and use appropriate intervals.',
            'Separate long-term movement from recurring patterns in the line chart.',
            'Inspect autocorrelation and unusual time points.'
        ],
        caution: 'A change beginning at one time point does not prove that an event at that point caused it. Consider seasonality and changes in measurement as well.'
    },
    text_mining: {
        summary: 'Text mining explores frequent terms, terms used together, and differences in term use across groups.',
        steps: [
            'Check the number of usable documents and the extracted terms after preprocessing.',
            'Use rankings, word clouds, and the co-occurrence network to identify possible patterns.',
            'Read KWIC examples to confirm how each term is used in context.'
        ],
        caution: 'A large word is not automatically important, and co-occurrence does not imply causation. Always read the original context and compare document counts across categories.'
    }
};

export const HOME_SECTIONS_EN = {
    about: `
        <h4>easyStat - Browser-based statistical analysis</h4>
        <p><strong>easyStat</strong> is a free web application for statistical analysis. Data loading, preparation, statistical calculations, text mining, and visualization run in your browser.</p>
        <h4>Main features</h4>
        <ul>
            <li><strong>No installation:</strong> use the application in a modern web browser.</li>
            <li><strong>Local analysis:</strong> ordinary statistical analysis and text mining do not send your input data to an analysis server.</li>
            <li><strong>Optional AI support:</strong> only when you request it, selected summaries and results are sent to the Gemini API. Raw rows are excluded by default.</li>
            <li><strong>Twenty-three tools:</strong> prepare data, explore distributions, test differences and associations, build predictive models, reduce variables, analyze time series, and mine text.</li>
            <li><strong>Japanese and English:</strong> the interface, results, figures, explanations, AI instructions, and guide follow the selected language.</li>
            <li><strong>Learning support:</strong> each analysis explains what to inspect, what the statistics mean, and what not to conclude.</li>
        </ul>
        <h4>Ways to enter data</h4>
        <ul>
            <li>Excel workbooks (.xlsx and .xls)</li>
            <li>CSV files (.csv)</li>
            <li>Tables typed directly or pasted from Excel, including tab- or comma-delimited data</li>
            <li>Text typed directly in the Text mining analysis</li>
        </ul>
        <h4>Available tools</h4>
        <p>Analysis guide, data preparation, data merge, scale-score calculation, exploratory data analysis, cross-tabulation, correlation, t tests, one-way and two-way ANOVA, Mann-Whitney, Kruskal-Wallis, Wilcoxon signed-rank, McNemar, chi-square, Fisher's exact test, linear and logistic regression, factor analysis, principal component analysis, time-series analysis, and text mining.</p>
    `,
    usage: `
        <h4>Basic workflow</h4>
        <div class="usage-step">
            <div class="step-number">1</div>
            <div class="step-content"><h5>Enter your data</h5><p>Load an Excel or CSV file from <strong>File</strong>, or type and paste cells in <strong>Paste table</strong>. Text can also be entered directly in Text mining.</p></div>
        </div>
        <div class="usage-step">
            <div class="step-number">2</div>
            <div class="step-content"><h5>Check the data overview</h5><p>After loading, confirm the number of rows and columns, inferred data types, missing values, and summary statistics. Expand the section when you need the details.</p></div>
        </div>
        <div class="usage-step">
            <div class="step-number">3</div>
            <div class="step-content"><h5>Choose an analysis</h5><p>easyStat enables methods that match the available data types. Use the Analysis guide when you are unsure which method fits your question.</p></div>
        </div>
        <div class="usage-step">
            <div class="step-number">4</div>
            <div class="step-content"><h5>Select variables and run</h5><p>Select the variables required by the method, run the analysis, and read the table and graph together. Open <strong>In plain language</strong> before and after running for a guided reading order.</p></div>
        </div>
        <h4>Tips</h4>
        <ul>
            <li>For confidential data, keep generative-AI support off and follow your organization's data-handling policy.</li>
            <li>The first visit requires an internet connection to load libraries and fonts from CDNs.</li>
            <li>A p value at or above .05 means the difference or association was not statistically clear in this sample; it does not prove equality or no relationship.</li>
            <li>Correlation and regression from observational data do not, by themselves, establish causation.</li>
            <li>Before exporting a figure, check its title, axis labels, range, aspect ratio, annotations, and legend.</li>
        </ul>
    `,
    releaseNotes: `
        <div class="changelog">
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.8.0</span><span class="changelog-date">July 2026</span></div><div class="changelog-content"><h5>Stronger AI and visualization support</h5><ul><li>Added evidence-linked AI prompts, validity checks, safer raw-data defaults, explanation levels, and follow-up questions.</li><li>Added shared editing for titles, labels, axis ranges, figure size and aspect ratio, plus safer annotation margins.</li><li>Improved beginner explanations, metric definitions, text-mining comparisons, and Japanese/English display.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.7.0</span><span class="changelog-date">July 2026</span></div><div class="changelog-content"><h5>Input, visualization, and interpretation improvements</h5><ul><li>Added spreadsheet-style direct entry and Excel paste support.</li><li>Expanded editable figure settings and image export.</li><li>Improved text-mining speed, part-of-speech rankings, KWIC, category comparison, word clouds, and co-occurrence networks.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.6.0</span><span class="changelog-date">April 2026</span></div><div class="changelog-content"><h5>Expanded beginner guide</h5><ul><li>Added practical guidance for preparing data, choosing methods, reading output, and avoiding common mistakes.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.5.0</span><span class="changelog-date">February 2026</span></div><div class="changelog-content"><h5>Reliability and feature improvements</h5><ul><li>Strengthened statistical reporting, validation tests, and browser compatibility.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.4.x</span><span class="changelog-date">November 2025 - January 2026</span></div><div class="changelog-content"><h5>Analysis and platform expansion</h5><ul><li>Added and refined multivariate, nonparametric, time-series, and data-preparation features.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.2 - v1.3</span><span class="changelog-date">May - November 2025</span></div><div class="changelog-content"><h5>Learning, AI, and text-analysis support</h5><ul><li>Introduced learning aids, optional AI interpretation, demo datasets, and improved text visualization.</li></ul></div></div>
            <div class="changelog-entry"><div class="changelog-header"><span class="changelog-version">v1.1.0</span><span class="changelog-date">November 2024</span></div><div class="changelog-content"><h5>Initial release</h5><ul><li>Released the first browser-based version of easyStat.</li></ul></div></div>
        </div>
    `
};

export const ANALYSIS_LOGIC_EN = {
    eda: {
        method: 'easyStat calculates descriptive statistics and creates distribution and relationship plots from the valid values in each selected column.',
        rules: [
            'Standard deviation uses the sample formula with an n - 1 divisor.',
            'Skewness and excess kurtosis use bias-adjusted Fisher definitions when the sample size is sufficient.',
            'Box-plot fences use the 1.5 x IQR rule; a flagged point is a possible outlier, not automatically an error.',
            'Pairwise plots use rows with usable values for the variables shown.'
        ],
        checks: ['Compare means with medians when distributions are skewed.', 'Inspect missing values and the raw scale before interpreting apparent outliers.']
    },
    cross_tabulation: {
        method: 'Counts are accumulated for every observed combination of the row and column categories, then converted to row, column, or total percentages.',
        rules: [
            'Observed counts are never replaced by percentages; both should be read together.',
            'Row percentages answer how a row category is distributed across columns.',
            'Column percentages answer how a column category is distributed across rows.'
        ],
        checks: ['Confirm the percentage denominator shown in the table.', 'Use chi-square or Fisher testing when the question concerns statistical association.']
    },
    correlation: {
        method: 'The analysis reports Pearson product-moment correlations or Spearman rank correlations for each selected pair.',
        rules: [
            'Pearson r is covariance divided by the product of the sample standard deviations.',
            'Spearman correlation applies Pearson correlation to ranks, with tied values receiving average ranks.',
            'Two-sided p values use the t reference distribution; 95% confidence intervals use Fisher z transformation.',
            'Each pair uses its available paired observations, so N can differ across cells.'
        ],
        checks: ['Inspect scatter plots for nonlinearity and influential points.', 'Do not interpret correlation as a causal effect.']
    },
    ttest: {
        method: 'The selected design determines whether easyStat uses an independent, paired, or one-sample t test.',
        rules: [
            'Independent groups use Welch\'s t test by default, with Welch-Satterthwaite degrees of freedom; equal variances are not assumed.',
            'Independent-samples Cohen\'s d uses the pooled sample standard deviation.',
            'Paired data are analyzed as one sample of within-case differences, with d_z = mean difference / SD of differences.',
            'The one-sample test compares the sample mean with the entered reference value. All p values are two-sided.'
        ],
        checks: ['Confirm that the groups are independent or that paired rows truly refer to the same cases.', 'Read the mean-difference confidence interval and effect size as well as the p value.']
    },
    anova_one_way: {
        method: 'easyStat compares group or condition means with an F test and reports effect sizes and follow-up comparisons.',
        rules: [
            'Independent-measures ANOVA partitions between-group and within-group sums of squares.',
            'Brown-Forsythe Levene testing checks unequal variance; robust pairwise options use Welch tests with Holm or Bonferroni correction.',
            'Repeated-measures ANOVA partitions participant and condition variation and reports Greenhouse-Geisser corrected degrees of freedom and p values.',
            'Tukey-Kramer, Holm, or Bonferroni procedures control multiplicity in pairwise comparisons.'
        ],
        checks: ['Use post-hoc results only after understanding the overall result.', 'Inspect group distributions, variance balance, and repeated-measures sphericity.']
    },
    anova_two_way: {
        method: 'Two-way ANOVA estimates two main effects and their interaction for independent, within-subject, or mixed designs.',
        rules: [
            'Sums of squares are partitioned into the two factors, their interaction, and the appropriate error terms.',
            'Within-subject terms use Greenhouse-Geisser correction when applicable.',
            'Effect sizes are reported as eta-squared or partial eta-squared according to the design.',
            'Simple effects and multiplicity-adjusted comparisons help locate patterns after an interaction.'
        ],
        checks: ['Interpret the interaction before the main effects.', 'Confirm that factor combinations have adequate observations and that repeated rows identify the same cases.']
    },
    mann_whitney: {
        method: 'All usable values from two independent groups are ranked together and the rank sums are converted to the Mann-Whitney U statistic.',
        rules: [
            'Tied observations receive average ranks and the normal approximation includes tie correction.',
            'The two-sided p value is based on the standardized U statistic.',
            'Effect size r is the absolute standardized statistic divided by the square root of the analyzed N.'
        ],
        checks: ['Use independent groups only.', 'If distribution shapes differ, avoid describing the result as only a median difference.']
    },
    kruskal_wallis: {
        method: 'Values from all independent groups are ranked together and the group rank sums form the Kruskal-Wallis H statistic.',
        rules: [
            'H is corrected for tied ranks and compared with a chi-square reference distribution.',
            'Epsilon-squared summarizes the magnitude of the overall group difference.',
            'Pairwise rank comparisons use a multiple-testing adjustment when post-hoc results are requested.'
        ],
        checks: ['A significant overall result does not identify the differing groups.', 'Compare sample sizes and distribution shapes across groups.']
    },
    wilcoxon_signed_rank: {
        method: 'Within-case differences are ranked by absolute size, then positive and negative rank sums are compared.',
        rules: [
            'Zero differences are excluded from the signed-rank calculation.',
            'Tied absolute differences receive average ranks and the normal approximation includes tie handling.',
            'The two-sided p value and effect size r summarize evidence and magnitude.'
        ],
        checks: ['Rows must contain genuinely paired measurements.', 'Inspect the direction and shape of paired differences, not just the p value.']
    },
    mcnemar: {
        method: 'McNemar\'s test uses only discordant pairs: cases that changed from category 1 to 2 or from 2 to 1.',
        rules: [
            'The asymptotic statistic is based on the difference between discordant counts b and c.',
            'easyStat reports the Yates-corrected result and an exact two-sided binomial result for sparse discordant pairs.',
            'The b/c odds ratio describes the direction of change when both counts are nonzero.'
        ],
        checks: ['The two variables must be paired binary measurements.', 'Large diagonal counts do not drive this test; inspect b and c directly.']
    },
    chi_square: {
        method: 'Observed cell counts are compared with counts expected if the row and column variables were independent.',
        rules: [
            'Expected count = row total x column total / grand total.',
            'For a 2 x 2 table, the Yates continuity-corrected chi-square is the primary result and uncorrected Pearson chi-square is shown for comparison.',
            'Cramer\'s V uses the uncorrected Pearson statistic to describe association strength.',
            'Adjusted standardized residuals locate cells contributing to an overall association, with cellwise p values corrected for multiplicity.'
        ],
        checks: ['Inspect expected-count warnings before trusting the approximation.', 'Use counts, percentages, residuals, and effect size together.']
    },
    fisher_exact: {
        method: 'Fisher testing evaluates contingency-table probabilities while conditioning on the observed margins.',
        rules: [
            'For 2 x 2 tables, the two-sided exact p value sums tables no more probable than the observed table.',
            'For larger tables, easyStat uses a Fisher-Freeman-Halton Monte Carlo estimate with 100,000 samples.',
            'Cramer\'s V and adjusted residuals are descriptive supplements based on the corresponding chi-square quantities.'
        ],
        checks: ['Report whether the result is exact or Monte Carlo.', 'Sparse tables can have wide uncertainty even when an exact p value is available.']
    },
    regression_simple: {
        method: 'Ordinary least squares fits the line that minimizes the sum of squared residuals between observed and fitted outcomes.',
        rules: [
            'The slope is the estimated outcome change for a one-unit increase in X; the intercept is the fitted outcome at X = 0.',
            'Coefficient tests use t statistics and two-sided p values.',
            'R-squared is the proportion of outcome variation explained by the fitted line.',
            'Residual and fitted-value plots support checks of linearity and variance patterns.'
        ],
        checks: ['Do not extrapolate far beyond the observed X range.', 'Inspect influential points and remember that regression does not establish causation.']
    },
    regression_multiple: {
        method: 'Ordinary least squares estimates all regression coefficients simultaneously from complete rows for the selected variables.',
        rules: [
            'Each coefficient describes an adjusted association while holding the other included predictors constant.',
            'Standardized beta coefficients put numeric predictors on comparable standard-deviation scales.',
            'Adjusted R-squared accounts for the number of predictors, and the model F test evaluates the predictors jointly.',
            'Variance inflation factors flag predictors whose overlap can make coefficients unstable.'
        ],
        checks: ['Check residual plots, influential cases, and VIF before interpreting individual coefficients.', 'Avoid causal wording unless the study design supports it.']
    },
    logistic_regression: {
        method: 'Maximum-likelihood logistic regression models the log odds of the selected event category.',
        rules: [
            'A coefficient is a change in log odds; exp(B) is the corresponding odds ratio.',
            'Wald tests and confidence intervals summarize coefficient uncertainty.',
            'Predicted probabilities are converted to classes at the displayed threshold for the confusion matrix.',
            'Training accuracy is compared with the majority-class baseline.'
        ],
        checks: ['Confirm which outcome is the event.', 'Watch for small event counts, separation, unstable odds ratios, and optimistic training accuracy.']
    },
    factor_analysis: {
        method: 'The current implementation extracts loading axes from the complete-case correlation matrix using eigen decomposition, then applies the selected rotation.',
        rules: [
            'Initial loadings are eigenvectors multiplied by the square root of their eigenvalues; this is a principal-component-based extraction.',
            'Varimax is orthogonal; promax, oblimin, and geomin may produce correlated factors.',
            'KMO and Bartlett tests describe whether the correlation matrix is suitable for dimension reduction.',
            'Loading signs are oriented consistently for readability; sign reversal does not change the mathematical solution.'
        ],
        checks: ['State that extraction is principal-component based when reporting the method.', 'Choose factor names from item content and seek reliability, validity, and replication evidence.']
    },
    pca: {
        method: 'Principal component analysis applies eigen decomposition to the correlation matrix of complete numeric rows.',
        rules: [
            'Components are ordered from the largest to the smallest eigenvalue.',
            'Component loadings equal eigenvectors multiplied by the square root of eigenvalues.',
            'Explained variance is each eigenvalue divided by their sum; cumulative variance adds components in order.',
            'Scores place cases on the component axes derived from standardized variables.'
        ],
        checks: ['Inspect the scree plot and cumulative variance before choosing a component count.', 'Do not call components latent factors without substantive evidence.']
    },
    time_series: {
        method: 'Observations are ordered by the selected time variable, then easyStat summarizes movement with a linear trend, moving average, and autocorrelation diagnostics.',
        rules: [
            'The trend line is an ordinary least-squares fit over ordered time.',
            'A moving average smooths neighboring observations using the selected window.',
            'Autocorrelation compares the series with lagged copies of itself.',
            'Only rows with usable time and numeric values enter the calculations.'
        ],
        checks: ['Verify chronological order and interval meaning.', 'Consider seasonality, structural breaks, missing periods, and measurement changes before attributing a trend to an event.']
    },
    text_mining: {
        method: 'easyStat tokenizes each document in the browser, filters terms, and summarizes frequency, distinctiveness, context, and co-occurrence.',
        rules: [
            'TF counts occurrences; DF counts documents containing a term; TF-IDF combines length-adjusted frequency with corpus rarity.',
            'Part of speech is estimated from surface forms by the browser tokenizer and should be treated as approximate.',
            'Category distinctiveness compares document occurrence rates with adjusted standardized residuals and false-discovery-rate correction.',
            'Co-occurrence links terms found in the same sentence or document and weights edges with the Jaccard coefficient.'
        ],
        checks: ['Review tokenization, excluded terms, document counts, and KWIC context.', 'A large word or strong link is an exploratory clue, not proof of importance or causation.']
    }
};

export const RESULT_METRIC_DEFINITIONS_EN = {
    sample_size: {
        label: 'N / count',
        meaning: 'The number of people, rows, documents, or other cases actually used in the analysis.',
        reading: 'Smaller samples often produce wider estimates. Check group sizes, missing or excluded cases, and confidence intervals.'
    },
    missing: {
        label: 'Missing / excluded',
        meaning: 'Data not used because cells were blank or cases did not meet the analysis conditions.',
        reading: 'If many cases are missing, check whether the remaining data represent a selective subset.'
    },
    count: {
        label: 'Count',
        meaning: 'The observed number of cases in a category or category combination.',
        reading: 'Percentages based on small counts are unstable, so read counts and percentages together.'
    },
    mean: {
        label: 'Mean',
        meaning: 'The sum of all values divided by the number of values.',
        reading: 'It describes the center of a group but is affected by extreme values. Also inspect the median and graph.'
    },
    median: {
        label: 'Median',
        meaning: 'The middle value after sorting the observations from smallest to largest.',
        reading: 'It is less affected by extreme values and is useful for describing the center of a skewed distribution.'
    },
    sd: {
        label: 'SD (standard deviation)',
        meaning: 'How widely values are spread around their mean.',
        reading: 'Values near 0 are tightly clustered; larger values indicate more variation. SD uses the original measurement unit.'
    },
    confidence_interval: {
        label: '95% confidence interval',
        meaning: 'A range showing the uncertainty around an estimated difference, coefficient, or other quantity.',
        reading: 'Narrower intervals are more precise. For a difference or coefficient, check whether the interval crosses 0.'
    },
    p_value: {
        label: 'p value',
        meaning: 'Assuming there is no difference or association, the probability of obtaining a result at least as extreme as the observed one.',
        reading: 'A value below .05 is a common evidence threshold. A value at or above .05 does not prove that groups are equal or unrelated.'
    },
    t_value: {
        label: 't statistic',
        meaning: 'The estimated difference or coefficient measured relative to its standard error.',
        reading: 'A larger absolute value is farther from 0. Use the degrees of freedom and p value for inference.'
    },
    f_value: {
        label: 'F statistic',
        meaning: 'A ratio comparing variation explained by the model with unexplained variation.',
        reading: 'Larger values indicate a more prominent effect, but interpretation also requires the degrees of freedom and p value.'
    },
    chi_square: {
        label: 'Chi-square statistic',
        meaning: 'A table-wide summary of differences between observed counts and counts expected under no association.',
        reading: 'Larger values show greater disagreement with independence. Use adjusted residuals to locate cells driving the difference.'
    },
    degrees_freedom: {
        label: 'df (degrees of freedom)',
        meaning: 'The amount of independent information used to determine the reference distribution of a statistic.',
        reading: 'It is not judged as good or bad on its own; it combines with t, F, or chi-square to determine the p value.'
    },
    cohens_d: {
        label: 'd / d_z (effect size)',
        meaning: 'A mean difference expressed in standard-deviation units.',
        reading: 'Absolute values of about .2, .5, and .8 are rough small, medium, and large benchmarks. Use group means for direction.'
    },
    correlation_r: {
        label: 'r / rho (correlation)',
        meaning: 'The direction and strength of how two variables change together, on a scale from -1 to 1.',
        reading: 'Positive values move together, negative values move oppositely, and values near 0 indicate a weak linear or monotonic relationship. Correlation is not causation.'
    },
    rank_effect_r: {
        label: 'r (rank-based effect size)',
        meaning: 'The magnitude of a two-group difference or paired change after converting values to ranks.',
        reading: 'Absolute values near .1, .3, and .5 are rough small, medium, and large benchmarks. Use medians or mean ranks for direction.'
    },
    eta_squared: {
        label: 'eta-squared / partial eta-squared',
        meaning: 'An ANOVA effect size describing how large a group or condition effect is.',
        reading: 'About .01, .06, and .14 are rough small, medium, and large benchmarks. Read magnitude separately from the p value.'
    },
    epsilon_squared: {
        label: 'epsilon-squared',
        meaning: 'An effect-size estimate for the overall group difference in a Kruskal-Wallis test.',
        reading: 'About .01, .06, and .14 are rough small, medium, and large benchmarks. Post-hoc tests are needed to locate differences.'
    },
    cramer_v: {
        label: "Cramer's V",
        meaning: 'The strength of association between two categorical variables, from 0 to 1.',
        reading: 'Values near 0 are weak and values near 1 are strong. Benchmarks depend on the dimensions of the table.'
    },
    adjusted_residual: {
        label: 'Adjusted residual z',
        meaning: 'How much a cell count is above or below the count expected under independence.',
        reading: 'Positive values are higher than expected and negative values are lower. Treat +/-1.96 as a reference and use the displayed multiple-testing adjustment.'
    },
    odds_ratio: {
        label: 'Odds ratio',
        meaning: 'A ratio comparing the odds of an outcome between conditions or for a one-unit predictor change.',
        reading: 'A value of 1 indicates equal odds, above 1 higher odds, and below 1 lower odds. It is not a direct ratio of probabilities.'
    },
    u_value: {
        label: 'U statistic',
        meaning: 'A statistic based on how ranks are distributed between two independent groups.',
        reading: 'Do not interpret U alone. Read it with the p value, effect size r, medians, and distribution plots.'
    },
    h_value: {
        label: 'H statistic',
        meaning: 'A summary of rank differences across three or more independent groups.',
        reading: 'Do not interpret H alone. If the p value is small, use post-hoc comparisons to identify differing groups.'
    },
    w_value: {
        label: 'W / T statistic',
        meaning: 'A rank-based statistic comparing the positive and negative differences in paired measurements.',
        reading: 'Do not interpret the value alone. Read it with the p value, effect size r, and the two medians.'
    },
    phi: {
        label: 'Phi',
        meaning: 'An effect-size measure for association or change involving binary data.',
        reading: 'Values near 0 are small and larger absolute values indicate a stronger result. Use the table to determine direction.'
    },
    r_squared: {
        label: 'R-squared / adjusted R-squared',
        meaning: 'The proportion of outcome variation accounted for by the regression model in this sample.',
        reading: 'R-squared = .40 means 40% of the observed variation is accounted for. A high value does not establish causation or out-of-sample accuracy.'
    },
    coefficient_b: {
        label: 'B (regression coefficient)',
        meaning: 'The expected outcome change for a one-unit increase in a predictor while holding other model variables constant.',
        reading: 'Positive values indicate an increase and negative values a decrease. In logistic regression, use the odds ratio for multiplicative change in odds.'
    },
    standardized_beta: {
        label: 'Beta (standardized coefficient)',
        meaning: 'A regression coefficient after placing variables on comparable standard-deviation scales.',
        reading: 'Within one model, larger absolute values indicate stronger sample relationships. The sign gives direction.'
    },
    standard_error: {
        label: 'SE (standard error)',
        meaning: 'How much an estimated mean or coefficient would be expected to vary across repeated samples.',
        reading: 'For the same statistic, smaller values indicate a more precise estimate and usually a narrower confidence interval.'
    },
    vif: {
        label: 'VIF',
        meaning: 'How strongly overlap among explanatory variables inflates uncertainty in a regression coefficient.',
        reading: 'Values near 1 indicate little overlap; 5 or more is a common warning threshold that deserves inspection.'
    },
    pseudo_r_squared: {
        label: 'Pseudo R-squared',
        meaning: 'An index of how much a logistic model improves over an intercept-only model.',
        reading: 'Larger values indicate better fit, but unlike ordinary R-squared it is not the proportion of outcome variation explained.'
    },
    accuracy: {
        label: 'Accuracy',
        meaning: 'The proportion of cases for which the predicted class matches the observed class.',
        reading: 'Compare it with the majority-class baseline. Performance on data not used for fitting is the more important check.'
    },
    factor_loading: {
        label: 'Factor / component loading',
        meaning: 'The strength and direction of the relationship between an item and a factor or principal component.',
        reading: 'Larger absolute values indicate a stronger connection. Loadings around |.40| or greater are often used as an initial interpretive guide.'
    },
    communality: {
        label: 'Communality',
        meaning: 'The proportion of an item\'s variation represented by the retained factors.',
        reading: 'Values near 1 are represented well; values near 0 are not explained well by the current factor solution.'
    },
    kmo: {
        label: 'KMO',
        meaning: 'An index from 0 to 1 of whether the correlation pattern is suitable for factor analysis.',
        reading: 'Values of .60 or more are often considered usable and .80 or more good. Also inspect item-level KMO values.'
    },
    eigenvalue: {
        label: 'Eigenvalue',
        meaning: 'The amount of total variation represented by each factor or principal component.',
        reading: 'Larger values contain more information. Do not choose the number of dimensions from the greater-than-1 rule alone; inspect the scree plot too.'
    },
    contribution_rate: {
        label: 'Explained / cumulative variance',
        meaning: 'The percentage of original variation represented by each component and by all retained components together.',
        reading: 'Higher cumulative variance retains more information. The required level depends on the purpose of the analysis.'
    },
    acf: {
        label: 'ACF (autocorrelation)',
        meaning: 'The similarity between current values and values a fixed number of time points earlier, from -1 to 1.',
        reading: 'Positive values indicate persistence and negative values alternating movement. Repeated peaks may suggest a cycle, but ACF alone does not establish an upward or downward trend.'
    },
    tf: {
        label: 'TF (term frequency)',
        meaning: 'The total number of times a term appears in the analyzed text.',
        reading: 'A larger value means more uses. Repetition within one document counts each time, so use DF to check how widely the term appears.'
    },
    document_frequency: {
        label: 'DF (document frequency)',
        meaning: 'The number of documents containing the term at least once; repeated uses within one document still count as one document.',
        reading: 'A larger value means the term is used across more documents. High TF with low DF suggests repetition in only a few documents.'
    },
    tfidf: {
        label: 'TF-IDF',
        meaning: 'A weight that highlights terms common in one document or category but less common elsewhere.',
        reading: 'Larger values are more distinctive within this analysis. There is no universal cutoff, so compare terms within the same result.'
    },
    jaccard: {
        label: 'Jaccard coefficient',
        meaning: 'The proportion of occasions on which two terms appear together, from 0 to 1.',
        reading: 'Values near 1 indicate frequent co-occurrence. This does not measure semantic similarity or causation.'
    },
    z_score: {
        label: 'z (distinctiveness)',
        meaning: 'How much more or less often a term appears in a category than expected.',
        reading: 'Positive values indicate more than expected and negative values less. Larger absolute values are more distinctive; use the q value for uncertainty.'
    },
    q_value: {
        label: 'q value',
        meaning: 'A p value adjusted to control false discoveries when many terms are tested together.',
        reading: 'A value below .05 is a common guide for distinctive terms. Read it with z and the original text context.'
    },
    row_percentage: {
        label: 'Row %',
        meaning: 'A percentage calculated with each row of a cross-tabulation as 100%.',
        reading: 'Compare across columns to ask what is common within each row group. Check counts as well.'
    },
    column_percentage: {
        label: 'Column %',
        meaning: 'A percentage calculated with each column of a cross-tabulation as 100%.',
        reading: 'Compare down rows to ask what is common within each column group. Check counts as well.'
    },
    cronbach_alpha: {
        label: 'Cronbach\'s alpha',
        meaning: 'The internal consistency of responses to items combined into one scale.',
        reading: 'A value near .70 or above is a common initial guide. Very high values may indicate redundant items, and alpha is not evidence of validity.'
    },
    skewness: {
        label: 'Skewness',
        meaning: 'The direction and degree to which a distribution has a longer tail on one side.',
        reading: 'Positive values indicate a longer right tail and negative values a longer left tail. Also inspect the histogram.'
    },
    kurtosis: {
        label: 'Kurtosis',
        meaning: 'Relative to a normal distribution set to 0, how heavy the tails are and how readily extreme values occur.',
        reading: 'Positive values suggest heavier tails and negative values a flatter distribution. Do not interpret it without the histogram.'
    }
};

export const RESULT_METRIC_PATTERNS_EN = {
    sample_size: /\bN\s*[=]|valid N|sample size|\b\d+\s*(?:rows?|documents?|cases?)\b/i,
    missing: /missing|excluded|invalid/i,
    count: /count|frequency|number of (?:people|cases|documents)/i,
    mean: /\bmean(?: difference)?\b/i,
    median: /\bmedian\b/i,
    sd: /standard deviation|(?:^|[\s(])SD(?:[\s),]|$)/i,
    confidence_interval: /95\s*%\s*(?:CI|confidence interval)|confidence interval/i,
    p_value: /\bp\s*(?:[=<>]|value)|p value|significance level/i,
    t_value: /\bt\s*[=<>]|t statistic|t test/i,
    f_value: /\bF\s*[=<>]|F statistic/i,
    chi_square: /chi[- ]?square|chi-square statistic|χ\s*[²2]/i,
    degrees_freedom: /\bdf\b|degrees? of freedom/i,
    cohens_d: /Cohen|effect size\s*\(?d|\bd_z?\s*[=]/i,
    correlation_r: /correlation|(?:\br|rho|ρ)\s*[=]/i,
    rank_effect_r: /effect size\s*r|\br\s*[=]/i,
    eta_squared: /eta|η|effect size/i,
    epsilon_squared: /epsilon|ε|effect size/i,
    cramer_v: /Cramer|(?:^|[\s(,])V\s*[=]/i,
    adjusted_residual: /adjusted residual|standardized residual|\bz\s*[=]/i,
    odds_ratio: /odds ratio|\bOR\s*[=]/i,
    u_value: /\bU\s*[=]|U statistic|Mann.?Whitney/i,
    h_value: /\bH\s*[=]|H statistic|Kruskal.?Wallis/i,
    w_value: /\bW\s*[=]|\bT\s*[=]|W statistic|signed-rank/i,
    phi: /\bphi\b|φ/i,
    r_squared: /R\s*[²2]|R-squared|coefficient of determination/i,
    coefficient_b: /regression coefficient|(?:^|[\s(])B\s*[=]/i,
    standardized_beta: /standardized coefficient|beta\s*[=]|β\s*[=]/i,
    standard_error: /standard error|(?:^|[\s(])SE(?:[\s),]|$)/i,
    vif: /\bVIF\b/i,
    pseudo_r_squared: /Nagelkerke|pseudo R/i,
    accuracy: /accuracy/i,
    factor_loading: /factor loading|component loading|loadings?/i,
    communality: /communalit/i,
    kmo: /\bKMO\b/i,
    eigenvalue: /eigenvalue/i,
    contribution_rate: /explained variance|cumulative variance/i,
    acf: /autocorrelation|\bACF\b|Lag\s*=/i,
    tf: /\bTF\s*[=]|term frequency/i,
    document_frequency: /\bDF\s*[=]|document frequency|documents containing/i,
    tfidf: /TF-?IDF/i,
    jaccard: /Jaccard/i,
    z_score: /distinctiveness\s*z|standardized residual|\bz\s*[=]/i,
    q_value: /q value|\bq\s*[=<]/i,
    row_percentage: /row\s*%|row percentage/i,
    column_percentage: /column\s*%|column percentage/i,
    cronbach_alpha: /Cronbach|reliability coefficient|alpha\s*[=]|α\s*[=]/i,
    skewness: /skewness/i,
    kurtosis: /kurtosis/i
};
