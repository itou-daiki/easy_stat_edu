/**
 * 初学者モード（おまかせ分析）の表示文言（日本語 / English）
 */
import { getLocale } from '../i18n.js';

export function pick(ja, en) {
    return getLocale() === 'en' ? en : ja;
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatP(p) {
    if (p === null || p === undefined || !Number.isFinite(p)) return '—';
    if (p < 0.001) return '&lt; .001';
    return p.toFixed(3).replace(/^0/, '');
}

export function getPurposes() {
    return [
        {
            key: 'compare',
            icon: 'fa-scale-balanced',
            title: pick('平均値を比較する', 'Compare averages'),
            description: pick('グループ間や、事前・事後で平均に差があるか調べます', 'Check whether averages differ between groups or before/after'),
            example: pick('例：男女で数学の点数に差がある？ 授業の前後で点数が上がった？', 'e.g. Do math scores differ by gender? Did scores improve after the lesson?')
        },
        {
            key: 'relation',
            icon: 'fa-link',
            title: pick('2つの数値の関係を調べる', 'Relationship between two numbers'),
            description: pick('一方が増えると、もう一方も増える（減る）かを調べます', 'Check whether one value tends to rise or fall with another'),
            example: pick('例：学習時間が長い人ほど点数が高い？', 'e.g. Do students who study longer score higher?')
        },
        {
            key: 'proportion',
            icon: 'fa-table-cells',
            title: pick('人数・割合の偏りを調べる', 'Compare counts and proportions'),
            description: pick('カテゴリ同士の組み合わせで人数に偏りがあるか調べます', 'Check whether counts are unevenly spread across categories'),
            example: pick('例：性別によって部活動の種類に偏りがある？', 'e.g. Does club choice differ by gender?')
        },
        {
            key: 'predict',
            icon: 'fa-chart-line',
            title: pick('数値から数値を予測する', 'Predict a number from another'),
            description: pick('一方の値からもう一方の値を予測する式を作ります', 'Build an equation that predicts one value from another'),
            example: pick('例：学習時間から点数を予測する', 'e.g. Predict test scores from study time')
        },
        {
            key: 'overview',
            icon: 'fa-magnifying-glass-chart',
            title: pick('データの全体像を見る', 'Get an overview of the data'),
            description: pick('平均・ばらつき・グラフでデータの特徴をつかみます', 'Look at averages, spread and charts'),
            example: pick('迷ったら、まずはここから', 'Not sure? Start here')
        }
    ];
}

export function getDesigns() {
    return [
        {
            key: 'independent',
            title: pick('別々の人たちを比べる（対応なし）', 'Different people (independent)'),
            description: pick('比べる値が、それぞれ別の人から取られている', 'Each value comes from a different person'),
            example: pick('例：男子と女子の点数、1組・2組・3組の点数', 'e.g. scores of boys vs girls, class 1/2/3'),
            sample: {
                caption: pick('データの形：「グループを表す列」がある', 'Data shape: there is a group column'),
                headers: [pick('名前', 'Name'), pick('クラス', 'Class'), pick('点数', 'Score')],
                rows: [['Aさん', '1組', '72'], ['Bさん', '2組', '65'], ['Cさん', '1組', '80']]
            }
        },
        {
            key: 'paired',
            title: pick('同じ人を2回以上測って比べる（対応あり）', 'Same people measured twice or more (paired)'),
            description: pick('1人が、比べる値を2つ以上もっている', 'Each person has two or more values'),
            example: pick('例：同じ生徒の事前テストと事後テスト', 'e.g. the same students\' pre-test and post-test'),
            sample: {
                caption: pick('データの形：1人1行で、比べる値が別々の列に並ぶ', 'Data shape: one row per person, values in separate columns'),
                headers: [pick('名前', 'Name'), pick('事前', 'Pre'), pick('事後', 'Post')],
                rows: [['Aさん', '60', '72'], ['Bさん', '55', '65'], ['Cさん', '70', '80']]
            }
        }
    ];
}

/** 「対応あり・なし」の説明 */
export function getDesignExplanation() {
    return {
        summary: pick('「対応あり」「対応なし」とは？ 迷ったときの見分け方', 'What do "paired" and "independent" mean? How to tell'),
        paragraphs: [
            pick(
                '<strong>対応なし</strong>：比べる値が別々の人から取られているデータです。たとえば「男子の点数」と「女子の点数」は、それぞれ違う人の値です。',
                '<strong>Independent</strong>: the values being compared come from different people, e.g. boys\' scores vs girls\' scores.'
            ),
            pick(
                '<strong>対応あり</strong>：同じ人（同じもの）から2回以上取った値を比べるデータです。たとえば「授業前」と「授業後」の点数は、同じ生徒の値どうしがペアになっています。',
                '<strong>Paired</strong>: two or more values are taken from the same person, e.g. each student\'s score before and after a lesson.'
            ),
            pick(
                '<strong>なぜ区別するの？</strong> 対応ありでは、一人ひとりの「変化（差）」を見ることができるので、もともとの得意・不得意といった個人差の影響を取り除いて比べられます。区別を間違えると、正しい結論が出ません。',
                '<strong>Why does it matter?</strong> With paired data you can look at each person\'s change, which removes individual differences. Choosing the wrong one gives misleading results.'
            )
        ],
        tips: [
            pick('同じ人が、比べたい値を2つ以上もっている → 対応あり', 'The same person has two or more values to compare → paired'),
            pick('「クラス」「性別」など、グループを表す列で人を分けて比べる → 対応なし', 'People are split by a group column such as class or gender → independent'),
            pick('2つのグループの人数がちがう → ほぼ確実に対応なし', 'The groups have different numbers of people → almost certainly independent')
        ]
    };
}

/** 選び方の表の下に置く用語の説明 */
export function getTermExplanations(purpose) {
    const normal = {
        term: pick('正規分布', 'Normal distribution'),
        text: pick('平均のあたりに値が最も多く、左右対称になだらかに減っていく「山型」の分布です。t検定や分散分析は、データがこの形に近いことを前提にしています。',
            'A symmetric, bell-shaped distribution with most values near the mean. t-tests and ANOVA assume data close to this shape.')
    };
    const normalityTest = {
        term: pick('正規性の検定', 'Normality test'),
        text: pick('データが正規分布とみなせるかを確かめる検定です。ここでは Shapiro-Wilk 検定を使い、p が .05 未満なら「正規分布とはいえない」と判断して、順位を使う方法（ノンパラメトリック検定）を選びます。',
            'Checks whether data can be treated as normal. Here the Shapiro-Wilk test is used; if p < .05 the data are treated as not normal and a rank-based (non-parametric) method is chosen.')
    };
    const expected = {
        term: pick('期待度数', 'Expected count'),
        text: pick('「2つの項目に関係がまったくない」と仮定したときに、それぞれのマスに入ると予想される人数です。これが小さいマスが多いと、カイ二乗検定の結果が不正確になります。',
            'The count expected in each cell if the two variables were unrelated. When many are small, the chi-square test becomes inaccurate.')
    };
    const residual = {
        term: pick('残差', 'Residual'),
        text: pick('実際の値と、式で予測した値とのずれです。', 'The gap between an actual value and the predicted value.')
    };
    if (purpose === 'proportion') return [expected];
    if (purpose === 'predict') return [residual, normal];
    if (purpose === 'compare' || purpose === 'relation') return [normal, normalityTest];
    return [];
}

/** 各手法の名前と、選ばれた理由 */
export function getMethodCopy(methodKey) {
    const copy = {
        welch_t: {
            name: pick('対応のないt検定（Welch）', "Independent t-test (Welch)"),
            reason: pick(
                'どちらのグループも「正規分布とみなせる」ので、平均値そのものを比べる「t検定」を使います。Welchの方法は2つのグループの散らばりが違っていても使えます。',
                'Both groups look normally distributed, so a t-test compares the means directly. Welch\'s version works even if the spreads differ.'
            )
        },
        mann_whitney: {
            name: pick('マン・ホイットニーのU検定', 'Mann-Whitney U test'),
            reason: pick(
                '「正規分布とはいえない」グループがあるので、平均値ではなく順位で比べる「マン・ホイットニーのU検定」を使います。偏りや外れ値に強い方法です。',
                'At least one group is not normally distributed, so the Mann-Whitney U test compares ranks instead of means. It is robust to skew and outliers.'
            )
        },
        anova: {
            name: pick('一要因分散分析（ANOVA）', 'One-way ANOVA'),
            reason: pick(
                '3つ以上のグループがあり、どのグループも「正規分布とみなせる」ので、「一要因分散分析」を使います。差があった場合は、どのグループ同士が違うかを多重比較で確かめます。',
                'There are three or more groups and all look normally distributed, so one-way ANOVA is used. If significant, post-hoc tests show which groups differ.'
            )
        },
        kruskal: {
            name: pick('クラスカル・ウォリス検定', 'Kruskal-Wallis test'),
            reason: pick(
                '3つ以上のグループがあり、「正規分布とはいえない」グループがあるので、順位で比べる「クラスカル・ウォリス検定」を使います。',
                'There are three or more groups and at least one is not normally distributed, so the rank-based Kruskal-Wallis test is used.'
            )
        },
        paired_t: {
            name: pick('対応のあるt検定', 'Paired t-test'),
            reason: pick(
                '同じ人の2回の測定の「差」が正規分布とみなせるので、「対応のあるt検定」を使います。',
                'The differences between the two measurements look normally distributed, so the paired t-test is used.'
            )
        },
        wilcoxon: {
            name: pick('ウィルコクソンの符号付順位検定', 'Wilcoxon signed-rank test'),
            reason: pick(
                '同じ人の2回の測定の「差」が正規分布とはいえないので、順位で比べる「ウィルコクソンの符号付順位検定」を使います。',
                'The differences are not normally distributed, so the rank-based Wilcoxon signed-rank test is used.'
            )
        },
        rm_anova: {
            name: pick('一要因分散分析（対応あり・反復測定）', 'Repeated-measures ANOVA'),
            reason: pick(
                '同じ人を3回以上測っていて、どの回も「正規分布とみなせる」ので、「対応のある分散分析」を使います。',
                'The same people were measured three or more times and every measurement looks normal, so repeated-measures ANOVA is used.'
            )
        },
        wilcoxon_multi: {
            name: pick('ウィルコクソンの符号付順位検定（多重比較・Holm補正）', 'Wilcoxon signed-rank tests (Holm-corrected)'),
            reason: pick(
                '同じ人を3回以上測っていて、「正規分布とはいえない」回があるので、2回ずつ順位で比べるウィルコクソン検定を行い、Holm法で補正します。',
                'Some measurements are not normally distributed, so each pair of measurements is compared with the Wilcoxon test and corrected with Holm\'s method.'
            )
        },
        pearson: {
            name: pick('ピアソンの相関係数', 'Pearson correlation'),
            reason: pick(
                '2つの数値がどちらも「正規分布とみなせる」ので、「ピアソンの相関係数」を使います。',
                'Both variables look normally distributed, so Pearson correlation is used.'
            )
        },
        spearman: {
            name: pick('スピアマンの順位相関係数', 'Spearman rank correlation'),
            reason: pick(
                '「正規分布とはいえない」数値があるので、順位を使う「スピアマンの順位相関係数」を使います。外れ値の影響を受けにくい方法です。',
                'At least one variable is not normally distributed, so Spearman rank correlation is used. It is less affected by outliers.'
            )
        },
        chi_square: {
            name: pick('カイ二乗検定', 'Chi-square test'),
            reason: pick(
                '期待度数（偏りがない場合に予想される人数）が十分に大きいので、「カイ二乗検定」を使います。',
                'Expected counts are large enough, so the chi-square test is used.'
            )
        },
        fisher: {
            name: pick('フィッシャーの正確確率検定', "Fisher's exact test"),
            reason: pick(
                '期待度数が小さいセルがあり、カイ二乗検定では結果が不正確になるおそれがあるので、「フィッシャーの正確確率検定」を使います。',
                "Some expected counts are small, which makes the chi-square test unreliable, so Fisher's exact test is used."
            )
        },
        regression: {
            name: pick('単回帰分析', 'Simple linear regression'),
            reason: pick(
                '1つの数値からもう1つの数値を予測する式を作るので、「単回帰分析」を使います。',
                'One number is used to predict another, so simple linear regression is used.'
            )
        },
        regression_multiple: {
            name: pick('重回帰分析', 'Multiple regression'),
            reason: pick(
                '2つ以上の数値から1つの数値を予測するので、「重回帰分析」を使います。ほかの列の影響をそろえたうえで、それぞれの列と結果の関係の強さがわかります。',
                'Two or more numbers are used to predict one, so multiple regression is used. It shows how each predictor relates to the outcome while holding the others constant.'
            )
        }
    };
    return copy[methodKey];
}

/** 判断を逆にした場合の手法（「もう一方の方法でも確かめる」用） */
export const ALTERNATIVE_METHOD = {
    welch_t: 'mann_whitney',
    mann_whitney: 'welch_t',
    anova: 'kruskal',
    kruskal: 'anova',
    paired_t: 'wilcoxon',
    wilcoxon: 'paired_t',
    rm_anova: 'wilcoxon_multi',
    wilcoxon_multi: 'rm_anova',
    pearson: 'spearman',
    spearman: 'pearson',
    chi_square: 'fisher',
    fisher: 'chi_square'
};

export const METHOD_ANALYSIS_TYPE = {
    welch_t: 'ttest',
    mann_whitney: 'mann_whitney',
    anova: 'anova_one_way',
    kruskal: 'kruskal_wallis',
    paired_t: 'ttest',
    wilcoxon: 'wilcoxon_signed_rank',
    rm_anova: 'anova_one_way',
    wilcoxon_multi: 'wilcoxon_signed_rank',
    pearson: 'correlation',
    spearman: 'correlation',
    chi_square: 'chi_square',
    fisher: 'fisher_exact',
    regression: 'regression_simple',
    regression_multiple: 'regression_multiple',
    eda: 'eda'
};

export function getErrorMessage(code) {
    const messages = {
        no_data: pick('先に、上の「データを読み込む」からデータを読み込んでください。', 'Load data first using the upload area above.'),
        need_vars: pick('必要な列をすべて選んでください。', 'Please choose all required columns.'),
        too_few_groups: pick('グループが1つしかありません。2つ以上のグループがある列を選んでください。', 'Only one group was found. Choose a column with two or more groups.'),
        group_too_small: pick('人数が1人以下のグループがあります。各グループに2人以上必要です。', 'Some groups have fewer than two people. Each group needs at least two.'),
        too_few_vars: pick('比べる列を2つ以上選んでください。', 'Choose at least two columns to compare.'),
        too_few_rows: pick('すべての列に値がそろっている人（行）が少なすぎます。', 'Too few rows have values in all selected columns.'),
        need_two_vars: pick('異なる2つの列を選んでください。', 'Choose two different columns.'),
        too_few_categories: pick('それぞれの列に2種類以上の値が必要です。', 'Each column needs at least two different values.'),
        constant_x: pick('予測に使う列の値がすべて同じです。', 'The predictor column has the same value in every row.'),
        collinear: pick('予測に使う列どうしがほとんど同じ動きをしているため、式を求められません。列を減らしてください。', 'The predictors move together almost perfectly, so the equation cannot be estimated. Remove a predictor.'),
        constant_var: pick('値がすべて同じ列があるため、関係を調べられません。', 'One column has the same value in every row, so the relationship cannot be examined.')
    };
    return messages[code] || pick('この組み合わせでは分析できませんでした。', 'This combination could not be analyzed.');
}

/**
 * 「選び方の表」：実行前に、どんな条件でどの手法になるかを示す
 * @returns {{check: string, headers: string[], rows: string[][]}|null}
 */
export function getSelectionGuide(purpose, design) {
    const normalHeaders = [
        '',
        pick('正規分布とみなせる', 'Looks normal'),
        pick('正規分布とはいえない', 'Not normal')
    ];
    const normalityCheck = pick('正規性の検定（Shapiro-Wilk検定）', 'Normality test (Shapiro-Wilk)');
    const name = key => getMethodCopy(key).name;

    if (purpose === 'compare' && design === 'independent') {
        return {
            check: pick(`グループごとに${normalityCheck}を行います`, `${normalityCheck} for each group`),
            headers: normalHeaders,
            rows: [
                [pick('2グループ', '2 groups'), name('welch_t'), name('mann_whitney')],
                [pick('3グループ以上', '3+ groups'), name('anova'), name('kruskal')]
            ]
        };
    }
    if (purpose === 'compare' && design === 'paired') {
        return {
            check: pick(`2回の場合は差に、3回以上の場合は各回に${normalityCheck}を行います`,
                `${normalityCheck} on the differences (2 times) or on each time (3+ times)`),
            headers: normalHeaders,
            rows: [
                [pick('2回', '2 times'), name('paired_t'), name('wilcoxon')],
                [pick('3回以上', '3+ times'), name('rm_anova'), name('wilcoxon_multi')]
            ]
        };
    }
    if (purpose === 'relation') {
        return {
            check: pick(`選んだ列それぞれに${normalityCheck}を行います（3列以上なら、すべての組み合わせの相関表になります）`,
                `${normalityCheck} for each selected column (3+ columns give a correlation matrix)`),
            headers: normalHeaders,
            rows: [[pick('数値 × 数値', 'Number × number'), name('pearson'), name('spearman')]]
        };
    }
    if (purpose === 'proportion') {
        return {
            check: pick('期待度数（偏りがない場合に予想される人数）を計算します', 'Expected counts are calculated'),
            headers: ['', pick('期待度数が十分', 'Large enough'), pick('期待度数が小さいセルがある', 'Some are small')],
            rows: [[pick('カテゴリ × カテゴリ', 'Category × category'), name('chi_square'), name('fisher')]]
        };
    }
    if (purpose === 'predict') {
        return {
            check: pick('予測のずれ（残差）の正規性も確認します', 'Normality of residuals is also checked'),
            headers: ['', pick('使う手法', 'Method')],
            rows: [
                [pick('予測に使う列が1つ', 'One predictor'), name('regression')],
                [pick('予測に使う列が2つ以上', 'Two or more predictors'), name('regression_multiple')]
            ]
        };
    }
    return null;
}
