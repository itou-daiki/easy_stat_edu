"""説明イラストに使ったデータで実際に検定し、図の説明と結果が合っているか確かめる（要 scipy）。

使い方: python3 tools/illustrations/verify.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fig_category as fcat  # noqa: E402
import fig_compare as fc  # noqa: E402
import fig_data as fd  # noqa: E402
import fig_relation as fr  # noqa: E402
from svgkit import integer_scores  # noqa: E402

RESULTS: list[bool] = []


def check(label: str, condition: bool, detail: str) -> None:
    print(f"{'OK' if condition else 'NG'}  {label}: {detail}")
    RESULTS.append(condition)


def significance(p: float, expect: bool) -> bool:
    return (p < 0.05) == expect


def verify_ttest() -> None:
    for sd, expect in zip(fc.TTEST_SDS, (True, False)):
        g1, g2 = integer_scores(fc.TTEST_MEANS[0], sd), integer_scores(fc.TTEST_MEANS[1], sd)
        p = stats.ttest_ind(g1, g2, equal_var=False).pvalue
        means_ok = sum(g1) / 30 == fc.TTEST_MEANS[0] and sum(g2) / 30 == fc.TTEST_MEANS[1]
        check(f't検定 SD{sd:g}', means_ok and significance(p, expect),
              f'平均 {sum(g1) / 30:g}, {sum(g2) / 30:g}  SD {stats.tstd(g1):.2f}  p={p:.4f}')


def verify_anova() -> None:
    for sd, expect in zip(fc.ANOVA_SDS, (True, False)):
        groups = [integer_scores(m, sd, fc.ANOVA_N) for m in fc.ANOVA_MEANS]
        p = stats.f_oneway(*groups).pvalue
        means = [sum(g) / len(g) for g in groups]
        check(f'分散分析 SD{sd:g}', significance(p, expect) and means == list(fc.ANOVA_MEANS), f'平均{means} p={p:.4f}')


def verify_two_way() -> None:
    import pandas as pd
    import statsmodels.formula.api as smf
    from statsmodels.stats.anova import anova_lm
    for (club, no_club), expect in zip(fc.TWO_WAY_CASES, (False, True)):
        rows = [(g, c, v) for g in range(3) for c, m in (('あり', club[g]), ('なし', no_club[g]))
                for v in integer_scores(m, fc.TWO_WAY_SD, fc.TWO_WAY_N, high=200)]
        df = pd.DataFrame(rows, columns=['grade', 'club', 'y'])
        p = anova_lm(smf.ols('y ~ C(grade) * C(club)', df).fit(), typ=2).loc['C(grade):C(club)', 'PR(>F)']
        check('二要因分散分析 交互作用', significance(p, expect), f'p={p:.4f}')


def verify_rank_tests() -> None:
    for (g1, g2), expect in zip(fc.MANN_WHITNEY_CASES, (True, False)):
        p = stats.mannwhitneyu(g1, g2, alternative='two-sided').pvalue
        check('U検定', significance(p, expect), f'p={p:.4f}')
    for groups, expect in zip(fc.KRUSKAL_CASES, (True, False)):
        p = stats.kruskal(*groups).pvalue
        check('クラスカル・ウォリス', significance(p, expect), f'p={p:.4f}')
    for diffs, expect in zip(fc.WILCOXON_DIFFS, (True, False)):
        p = stats.wilcoxon(diffs).pvalue
        check('ウィルコクソン', significance(p, expect), f'p={p:.4f}')


def verify_relations() -> None:
    for index, r in enumerate(fr.CORRELATION_RS):
        data = fr.study_and_score(r, seed=5 + index)
        result = stats.pearsonr([d[0] for d in data], [d[1] for d in data])
        expect = r != 0
        check(f'相関 目標r={r:+.1f}', abs(result.statistic - r) < 0.08 and significance(result.pvalue, expect),
              f'r={result.statistic:.2f} p={result.pvalue:.4f}')
    data = fr.study_and_score(0.75, seed=3)
    reg = stats.linregress([d[0] for d in data], [d[1] for d in data])
    slope, intercept = fr.ols([d[0] for d in data], [d[1] for d in data])
    check('単回帰', abs(reg.slope - slope) < 1e-9 and reg.pvalue < 0.05,
          f'点数 = {slope:.2f}×時間 + {intercept:.1f}  p={reg.pvalue:.4f}')
    xs, y = fr.multiple_regression_data()
    betas = fr.standardized_betas(xs, y)
    check('重回帰 β の向き', betas[0] > 0 and betas[1] > 0 and betas[2] < 0, f'β={[round(b, 2) for b in betas]}')
    data = fr.logistic_data()
    b0, b1 = fr.fit_logistic(data)
    check('ロジスティック回帰', b1 > 0, f'切片={b0:.2f} 傾き={b1:.2f} 50%の時間={-b0 / b1:.2f}  合格{sum(d[1] for d in data)}/{len(data)}人')
    points = fr.pca_data()
    _, axes = fr.pca_axes(points)
    total = sum(v for v, _ in axes)
    import numpy as np
    eig = np.linalg.eigvalsh(np.cov(np.array(points).T))[::-1]
    check('主成分分析', abs(axes[0][0] - eig[0]) < 1e-6, f'第1主成分 {axes[0][0] / total * 100:.1f}%  numpy {eig[0] / eig.sum() * 100:.1f}%')
    values = fr.library_visitors()
    smooth = [v for v in fr.moving_average(values) if v is not None]
    check('時系列 移動平均は増加傾向', smooth[-1] > smooth[0], f'最初 {smooth[0]:.0f} → 最後 {smooth[-1]:.0f}')


def verify_categories() -> None:
    from statsmodels.stats.contingency_tables import mcnemar
    for table, expect in zip(fcat.CHI_SQUARE_TABLES, (True, False)):
        result = stats.chi2_contingency(table)
        check('カイ二乗', significance(result.pvalue, expect) and result.expected_freq.min() >= 5,
              f'p={result.pvalue:.4f} 最小期待度数={result.expected_freq.min():.1f}')
    for table, expect in zip(fcat.FISHER_TABLES, (True, False)):
        p = stats.fisher_exact(table).pvalue
        small = stats.contingency.expected_freq(table).min() < 5
        check('フィッシャー', significance(p, expect) and small, f'p={p:.4f} 期待度数5未満のマスあり={small}')
    for table, expect in zip(fcat.MCNEMAR_TABLES, (True, False)):
        p = mcnemar(table, exact=True).pvalue
        check('マクネマー', significance(p, expect) and sum(map(sum, table)) == 30, f'p={p:.4f}')


def verify_data() -> None:
    import numpy as np
    q1, median, q3 = fd.quartiles(fd.EDA_SCORES)
    ref = np.percentile(fd.EDA_SCORES, [25, 50, 75])
    outliers = [v for v in fd.EDA_SCORES if v < q1 - 1.5 * (q3 - q1) or v > q3 + 1.5 * (q3 - q1)]
    check('EDA 四分位と外れ値', np.allclose([q1, median, q3], ref) and outliers == [12],
          f'Q1={q1} 中央値={median} Q3={q3} 平均={np.mean(fd.EDA_SCORES):.1f} 外れ値={outliers}')
    scores = [sum([v[0], v[1], fd.SCALE_MAX + 1 - v[2]]) / 3 for _, v in fd.FACTOR_SCORE_ROWS]
    check('因子得点（逆転項目つき平均）', [round(s, 2) for s in scores] == [4.67, 3.0, 1.67], f'{scores}')


if __name__ == '__main__':
    verify_data()
    verify_categories()
    verify_ttest()
    verify_relations()
    verify_anova()
    verify_rank_tests()
    verify_two_way()
    print(f'{sum(RESULTS)}/{len(RESULTS)} OK')
    sys.exit(0 if all(RESULTS) else 1)
