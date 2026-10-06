import { test, expect } from '@playwright/test';

// 正規分布に近い値と、強く右に偏った値（指数分布的）
const NORMALISH = [48, 52, 50, 47, 53, 49, 51, 50, 46, 54, 50, 52, 48, 51, 49];
const SKEWED = [1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 3, 1, 2, 40, 90];

function rows(groups: Record<string, number[]>) {
    return Object.entries(groups).flatMap(([group, values]) => values.map(score => ({ group, score })));
}

test.describe('method selector (beginner mode)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('two independent groups: normal -> Welch t, non-normal -> Mann-Whitney', async ({ page }) => {
        const result = await page.evaluate(async ({ normal, skewed }) => {
            const { selectGroupComparison } = await import('/js/utils/method_selector.js');
            return {
                normal: selectGroupComparison(normal, 'group', 'score'),
                skewed: selectGroupComparison(skewed, 'group', 'score')
            };
        }, {
            normal: rows({ A: NORMALISH, B: NORMALISH.map(v => v + 3) }),
            skewed: rows({ A: NORMALISH, B: SKEWED })
        });

        expect(result.normal).toMatchObject({ methodKey: 'welch_t', analysisType: 'ttest', normal: true });
        expect(result.normal.checks.some((c: any) => c.kind === 'levene')).toBe(true);
        expect(result.skewed).toMatchObject({ methodKey: 'mann_whitney', analysisType: 'mann_whitney', normal: false });
    });

    test('three or more groups: ANOVA or Kruskal-Wallis', async ({ page }) => {
        const result = await page.evaluate(async ({ normal, skewed }) => {
            const { selectGroupComparison } = await import('/js/utils/method_selector.js');
            return [selectGroupComparison(normal, 'group', 'score').methodKey, selectGroupComparison(skewed, 'group', 'score').methodKey];
        }, {
            normal: rows({ A: NORMALISH, B: NORMALISH.map(v => v + 2), C: NORMALISH.map(v => v - 2) }),
            skewed: rows({ A: NORMALISH, B: SKEWED, C: NORMALISH })
        });
        expect(result).toEqual(['anova', 'kruskal']);
    });

    test('groups that cannot be tested fall back to rank-based methods, and invalid input is rejected', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { selectGroupComparison } = await import('/js/utils/method_selector.js');
            return {
                tiny: selectGroupComparison([
                    { g: 'A', v: 1 }, { g: 'A', v: 2 }, { g: 'B', v: 3 }, { g: 'B', v: 4 }, { g: 'B', v: 6 }
                ], 'g', 'v').methodKey,
                oneGroup: selectGroupComparison([{ g: 'A', v: 1 }, { g: 'A', v: 2 }], 'g', 'v').error,
                singleton: selectGroupComparison([{ g: 'A', v: 1 }, { g: 'B', v: 2 }, { g: 'B', v: 3 }], 'g', 'v').error,
                // 値がすべて欠損のグループも「グループ」として数える（分析モジュールと同じ数え方）
                allMissing: selectGroupComparison([
                    { g: 'A', v: 1 }, { g: 'A', v: 2 }, { g: 'A', v: 4 },
                    { g: 'B', v: 3 }, { g: 'B', v: 5 }, { g: 'B', v: 6 },
                    { g: 'C', v: null }, { g: 'C', v: '' }
                ], 'g', 'v').error
            };
        });
        expect(result).toEqual({ tiny: 'mann_whitney', oneGroup: 'too_few_groups', singleton: 'group_too_small', allMissing: 'group_too_small' });
    });

    test('paired data uses differences for two measurements and each measurement for three or more', async ({ page }) => {
        const result = await page.evaluate(async ({ normal, skewed }) => {
            const { selectPairedComparison } = await import('/js/utils/method_selector.js');
            // 差が正規分布に近くなるよう、別の並びの NORMALISH を差として加える
            const pairedNormal = normal.map((v: number, i: number) => ({ pre: v, post: v + 3 + (normal[(i + 7) % normal.length] - 50) }));
            const pairedSkewed = normal.map((v: number, i: number) => ({ pre: v, post: v + skewed[i] }));
            const three = normal.map((v: number, i: number) => ({ t1: v, t2: v + 1 + (i % 4), t3: v + 2 + (i % 5) }));
            const r1 = selectPairedComparison(pairedNormal, ['pre', 'post']);
            const r2 = selectPairedComparison(pairedSkewed, ['pre', 'post']);
            const r3 = selectPairedComparison(three, ['t1', 't2', 't3']);
            return {
                r1: [r1.methodKey, r1.checks.length, r1.checks[0].isDifference, r1.preset],
                r2: r2.methodKey,
                r3: [r3.methodKey, r3.checks.length, r3.preset]
            };
        }, { normal: NORMALISH, skewed: SKEWED });

        expect(result.r1).toEqual(['paired_t', 1, true, { mode: 'paired', pairs: [['pre', 'post']] }]);
        expect(result.r2).toBe('wilcoxon');
        expect(result.r3).toEqual(['rm_anova', 3, { mode: 'repeated', vars: ['t1', 't2', 't3'] }]);
    });

    test('correlation chooses Pearson or Spearman', async ({ page }) => {
        const result = await page.evaluate(async ({ normal, skewed }) => {
            const { selectCorrelation } = await import('/js/utils/method_selector.js');
            const a = normal.map((v: number, i: number) => ({ x: v, y: v * 2 + (i % 3), z: skewed[i] }));
            return [selectCorrelation(a, 'x', 'y').methodKey, selectCorrelation(a, 'x', 'z').methodKey, selectCorrelation(a, 'x', 'x').error];
        }, { normal: NORMALISH, skewed: SKEWED });
        expect(result).toEqual(['pearson', 'spearman', 'need_two_vars']);
    });

    test('categorical association follows the expected-count rule', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { selectCategoricalAssociation, expectedFrequencyCheck } = await import('/js/utils/method_selector.js');
            const make = (counts: number[][]) => counts.flatMap((row, r) => row.flatMap((n, c) =>
                Array.from({ length: n }, () => ({ a: `r${r}`, b: `c${c}` }))));
            const large = make([[20, 15], [12, 25]]);
            const small2x2 = make([[8, 2], [1, 9]]);
            return {
                large: selectCategoricalAssociation(large, 'a', 'b').methodKey,
                small2x2: selectCategoricalAssociation(small2x2, 'a', 'b').methodKey,
                expected: expectedFrequencyCheck(make([[10, 10], [10, 10]]), 'a', 'b')
            };
        });
        expect(result.large).toBe('chi_square');
        expect(result.small2x2).toBe('fisher');
        expect(result.expected).toMatchObject({ rows: 2, cols: 2, cells: 4, smallCells: 0, minExpected: 10, is2x2: true });
    });

    test('prediction checks residual normality', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { selectPrediction } = await import('/js/utils/method_selector.js');
            const data = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 3 * i + Math.sin(i) * 2 }));
            const r = selectPrediction(data, 'x', 'y');
            return [r.methodKey, r.analysisType, r.checks[0].isResidual, selectPrediction([{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }], 'x', 'y').error];
        });
        expect(result).toEqual(['regression', 'regression_simple', true, 'constant_x']);
    });

    test('missing cells are not converted to 0', async ({ page }) => {
        const values = await page.evaluate(async () => {
            const { toNumericCell } = await import('/js/utils.js');
            return [null, undefined, '', '  ', 0, '3.5', 'abc'].map(v => {
                const n = toNumericCell(v);
                return Number.isNaN(n) ? 'NaN' : n;
            });
        });
        expect(values).toEqual(['NaN', 'NaN', 'NaN', 'NaN', 0, 3.5, 'NaN']);
    });

    test('setVariableSelectorValue keeps the chosen order for multi-selects', async ({ page }) => {
        const order = await page.evaluate(async () => {
            const { createVariableSelector, setVariableSelectorValue } = await import('/js/utils.js');
            const host = document.createElement('div');
            document.body.appendChild(host);
            const select = createVariableSelector(host, ['A', 'B', 'C', 'D'], 'order-test-select', { multiple: true });
            setVariableSelectorValue(select, ['C', 'A']);
            const result = Array.from(select.selectedOptions).map(option => option.value);
            host.remove();
            return result;
        });
        expect(order).toEqual(['C', 'A']);
    });
});
