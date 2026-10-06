/**
 * 初学者モード用：データの前提チェックを行い、適切な分析手法を自動で選ぶ
 * 表示文言は持たず、判断結果とチェック結果（数値）だけを返す。文言化は guided_mode.js が担当する。
 */
import { shapiroWilk } from './normality.js';

export const ALPHA = 0.05;

function isMissing(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function toNumber(value) {
    if (isMissing(value)) return null;
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * 正規性の判定
 * - 全ての検定で p >= .05 なら正規性あり
 * - n < 3 や全て同じ値で検定できない場合は「正規性を確認できない」としてノンパラメトリックへ
 * - n > 5000 は検定の対象外だが、大標本なので正規近似を用いる
 */
function judgeNormality(tests) {
    const failed = tests.some(test => test.result.ok && test.result.p < ALPHA);
    const untestable = tests.some(test => !test.result.ok && test.result.reason !== 'too_many');
    return !failed && !untestable;
}

function normalityChecks(entries) {
    return entries.map(({ label, values }) => ({ kind: 'normality', label, result: shapiroWilk(values) }));
}

/**
 * Brown-Forsythe 型 Levene 検定（参考表示用）。jStat が無い環境では null を返す。
 */
function leveneTest(groups) {
    const jStatLib = globalThis.jStat;
    if (!jStatLib) return null;
    const median = values => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const deviations = groups.map(values => {
        const center = median(values);
        return values.map(value => Math.abs(value - center));
    });
    const k = deviations.length;
    const n = deviations.reduce((sum, values) => sum + values.length, 0);
    if (k < 2 || n - k <= 0) return null;
    const groupMeans = deviations.map(values => values.reduce((s, v) => s + v, 0) / values.length);
    const grandMean = deviations.flat().reduce((s, v) => s + v, 0) / n;
    const between = deviations.reduce((sum, values, i) => sum + values.length * (groupMeans[i] - grandMean) ** 2, 0);
    const within = deviations.reduce((sum, values, i) => sum + values.reduce((s, v) => s + (v - groupMeans[i]) ** 2, 0), 0);
    if (within === 0) return null;
    const f = (between / (k - 1)) / (within / (n - k));
    const p = 1 - jStatLib.centralF.cdf(f, k - 1, n - k);
    return { kind: 'levene', f, df1: k - 1, df2: n - k, p };
}

/**
 * 別々のグループの平均値を比較する（対応なし）
 * @returns {{error?: string, analysisType, methodKey, preset, checks, normal, groups}}
 */
export function selectGroupComparison(data, groupVar, valueVar) {
    const groupMap = new Map();
    // 値が欠損していてもグループとしては数える（分析モジュール側のグループ数と一致させる）
    (data || []).forEach(row => {
        const group = row[groupVar];
        if (isMissing(group)) return;
        const key = String(group);
        if (!groupMap.has(key)) groupMap.set(key, []);
        const value = toNumber(row[valueVar]);
        if (value !== null) groupMap.get(key).push(value);
    });

    const groups = Array.from(groupMap.entries()).map(([name, values]) => ({ name, n: values.length, values }));
    const summary = groups.map(({ name, n }) => ({ name, n }));
    if (groups.length < 2) return { error: 'too_few_groups', groups: summary };
    if (groups.some(group => group.n < 2)) return { error: 'group_too_small', groups: summary };

    const checks = normalityChecks(groups.map(group => ({ label: group.name, values: group.values })));
    const normal = judgeNormality(checks);
    const levene = leveneTest(groups.map(group => group.values));
    const allChecks = levene ? [...checks, levene] : checks;
    const isTwoGroups = groups.length === 2;

    let methodKey;
    if (isTwoGroups) methodKey = normal ? 'welch_t' : 'mann_whitney';
    else methodKey = normal ? 'anova' : 'kruskal';

    const analysisType = {
        welch_t: 'ttest',
        mann_whitney: 'mann_whitney',
        anova: 'anova_one_way',
        kruskal: 'kruskal_wallis'
    }[methodKey];

    return {
        analysisType,
        methodKey,
        normal,
        groups: groups.map(({ name, n }) => ({ name, n })),
        checks: allChecks,
        preset: { mode: 'independent', groupVar, valueVars: [valueVar] }
    };
}

/**
 * 同じ人を2回以上測った値を比較する（対応あり）
 */
export function selectPairedComparison(data, vars) {
    const uniqueVars = Array.from(new Set(vars || []));
    if (uniqueVars.length < 2) return { error: 'too_few_vars' };

    const rows = (data || [])
        .map(row => uniqueVars.map(name => toNumber(row[name])))
        .filter(values => values.every(value => value !== null));
    if (rows.length < 2) return { error: 'too_few_rows', n: rows.length };

    let checks;
    if (uniqueVars.length === 2) {
        const differences = rows.map(([first, second]) => second - first);
        checks = normalityChecks([{ label: `${uniqueVars[1]} − ${uniqueVars[0]}`, values: differences, isDifference: true }])
            .map(check => ({ ...check, isDifference: true }));
    } else {
        checks = normalityChecks(uniqueVars.map((name, index) => ({ label: name, values: rows.map(values => values[index]) })));
    }
    const normal = judgeNormality(checks);

    let methodKey;
    if (uniqueVars.length === 2) methodKey = normal ? 'paired_t' : 'wilcoxon';
    else methodKey = normal ? 'rm_anova' : 'wilcoxon_multi';

    const analysisType = {
        paired_t: 'ttest',
        wilcoxon: 'wilcoxon_signed_rank',
        rm_anova: 'anova_one_way',
        wilcoxon_multi: 'wilcoxon_signed_rank'
    }[methodKey];

    const preset = methodKey === 'paired_t'
        ? { mode: 'paired', pairs: [[uniqueVars[0], uniqueVars[1]]] }
        : methodKey === 'rm_anova'
            ? { mode: 'repeated', vars: uniqueVars }
            : { vars: uniqueVars };

    return { analysisType, methodKey, normal, n: rows.length, checks, preset };
}

/**
 * 2つの数値の関係（相関）
 */
export function selectCorrelation(data, xVar, yVar) {
    if (!xVar || !yVar || xVar === yVar) return { error: 'need_two_vars' };
    const rows = (data || [])
        .map(row => [toNumber(row[xVar]), toNumber(row[yVar])])
        .filter(([x, y]) => x !== null && y !== null);
    if (rows.length < 3) return { error: 'too_few_rows', n: rows.length };

    const constant = [xVar, yVar].filter((name, index) => new Set(rows.map(values => values[index])).size === 1);
    if (constant.length) return { error: 'constant_var', columns: constant };

    const checks = normalityChecks([
        { label: xVar, values: rows.map(([x]) => x) },
        { label: yVar, values: rows.map(([, y]) => y) }
    ]);
    const normal = judgeNormality(checks);
    const methodKey = normal ? 'pearson' : 'spearman';
    return {
        analysisType: 'correlation',
        methodKey,
        normal,
        n: rows.length,
        checks,
        preset: { vars: [xVar, yVar], method: methodKey }
    };
}

/**
 * 期待度数のチェック（Cochran の基準）
 */
export function expectedFrequencyCheck(data, rowVar, colVar) {
    const counts = new Map();
    const rowTotals = new Map();
    const colTotals = new Map();
    let total = 0;
    (data || []).forEach(row => {
        const r = row[rowVar];
        const c = row[colVar];
        if (isMissing(r) || isMissing(c)) return;
        const rKey = String(r);
        const cKey = String(c);
        const key = `${rKey}\u0000${cKey}`;
        counts.set(key, (counts.get(key) || 0) + 1);
        rowTotals.set(rKey, (rowTotals.get(rKey) || 0) + 1);
        colTotals.set(cKey, (colTotals.get(cKey) || 0) + 1);
        total++;
    });

    const expected = [];
    rowTotals.forEach(rowTotal => {
        colTotals.forEach(colTotal => expected.push((rowTotal * colTotal) / total));
    });
    const cells = expected.length;
    const smallCells = expected.filter(value => value < 5).length;
    const minExpected = cells ? Math.min(...expected) : 0;
    const is2x2 = rowTotals.size === 2 && colTotals.size === 2;
    return {
        kind: 'expected',
        rows: rowTotals.size,
        cols: colTotals.size,
        total,
        cells,
        smallCells,
        smallCellRatio: cells ? smallCells / cells : 0,
        minExpected,
        is2x2
    };
}

/**
 * 人数・割合の偏り（カテゴリ × カテゴリ）
 */
export function selectCategoricalAssociation(data, rowVar, colVar) {
    if (!rowVar || !colVar || rowVar === colVar) return { error: 'need_two_vars' };
    const check = expectedFrequencyCheck(data, rowVar, colVar);
    if (check.rows < 2 || check.cols < 2) return { error: 'too_few_categories', checks: [check] };

    const needsExact = check.is2x2
        ? check.smallCells > 0
        : (check.smallCellRatio > 0.2 || check.minExpected < 1);
    const methodKey = needsExact ? 'fisher' : 'chi_square';
    return {
        analysisType: needsExact ? 'fisher_exact' : 'chi_square',
        methodKey,
        checks: [check],
        preset: { rowVar, colVar }
    };
}

/**
 * 数値から数値を予測する（単回帰）。残差の正規性は参考として示す。
 */
export function selectPrediction(data, xVar, yVar) {
    if (!xVar || !yVar || xVar === yVar) return { error: 'need_two_vars' };
    const rows = (data || [])
        .map(row => [toNumber(row[xVar]), toNumber(row[yVar])])
        .filter(([x, y]) => x !== null && y !== null);
    if (rows.length < 3) return { error: 'too_few_rows', n: rows.length };

    const n = rows.length;
    const meanX = rows.reduce((s, [x]) => s + x, 0) / n;
    const meanY = rows.reduce((s, [, y]) => s + y, 0) / n;
    const sxx = rows.reduce((s, [x]) => s + (x - meanX) ** 2, 0);
    if (sxx === 0) return { error: 'constant_x' };
    const slope = rows.reduce((s, [x, y]) => s + (x - meanX) * (y - meanY), 0) / sxx;
    const residuals = rows.map(([x, y]) => y - (meanY + slope * (x - meanX)));
    const checks = normalityChecks([{ label: 'residual', values: residuals }])
        .map(check => ({ ...check, isResidual: true }));

    return {
        analysisType: 'regression_simple',
        methodKey: 'regression',
        normal: judgeNormality(checks),
        n,
        checks,
        preset: { x: xVar, y: yVar }
    };
}

// ---------------------------------------------------------------------------
// 複数の列を選んだとき（初学者モード）
// ---------------------------------------------------------------------------

/**
 * 別々のグループの平均値を、複数の数値の列について比べる。
 * 列ごとに手法を判断し、同じ手法になった列どうしをまとめる（最初に選んだ列のまとまりが先頭）。
 * @returns {{error?: string, column?: string, groups?: Array<{methodKey, analysisType, normal, vars, checks}>}}
 */
export function selectGroupComparisonMulti(data, groupVar, valueVars) {
    const results = [];
    for (const valueVar of valueVars || []) {
        const result = selectGroupComparison(data, groupVar, valueVar);
        if (result.error) return { ...result, column: valueVar };
        // 列が複数あるときは、どの列の確認結果かわかるように名前を付ける
        const checks = result.checks.map(check => (
            valueVars.length > 1 ? { ...check, label: check.kind === 'levene' ? valueVar : `${valueVar}：${check.label}` } : check
        ));
        results.push({ ...result, valueVar, checks });
    }
    if (!results.length) return { error: 'need_vars' };

    const order = [];
    const byMethod = new Map();
    results.forEach(result => {
        if (!byMethod.has(result.methodKey)) {
            byMethod.set(result.methodKey, []);
            order.push(result.methodKey);
        }
        byMethod.get(result.methodKey).push(result);
    });
    return {
        groups: order.map(methodKey => {
            const items = byMethod.get(methodKey);
            return {
                methodKey,
                analysisType: items[0].analysisType,
                normal: items[0].normal,
                vars: items.map(item => item.valueVar),
                checks: items.flatMap(item => item.checks),
                groupCount: items[0].groups.length
            };
        })
    };
}

/**
 * 2つ以上の数値の列の関係（相関）。3列以上なら相関行列になる。
 * 1列でも正規分布とはいえなければ、すべての組をスピアマンで調べる。
 */
export function selectCorrelationMulti(data, vars) {
    const unique = Array.from(new Set(vars || []));
    if (unique.length < 2) return { error: 'need_two_vars' };
    const columns = unique.map(name => (data || []).map(row => toNumber(row[name])).filter(value => value !== null));
    if (columns.some(values => values.length < 3)) return { error: 'too_few_rows' };
    const constant = unique.filter((_, index) => new Set(columns[index]).size === 1);
    if (constant.length) return { error: 'constant_var', columns: constant };

    const checks = normalityChecks(unique.map((name, index) => ({ label: name, values: columns[index] })));
    const normal = judgeNormality(checks);
    const methodKey = normal ? 'pearson' : 'spearman';
    return {
        analysisType: 'correlation',
        methodKey,
        normal,
        checks,
        preset: { vars: unique, method: methodKey }
    };
}

/** 最小二乗法の係数（切片を含む）。正規方程式をガウスの消去法で解く。解けなければ null */
function leastSquares(xRows, y) {
    const k = xRows[0].length + 1;
    const design = xRows.map(row => [1, ...row]);
    const a = Array.from({ length: k }, (_, i) => [
        ...Array.from({ length: k }, (_, j) => design.reduce((sum, row) => sum + row[i] * row[j], 0)),
        design.reduce((sum, row, index) => sum + row[i] * y[index], 0)
    ]);
    for (let col = 0; col < k; col++) {
        let pivotRow = col;
        for (let row = col + 1; row < k; row++) {
            if (Math.abs(a[row][col]) > Math.abs(a[pivotRow][col])) pivotRow = row;
        }
        if (Math.abs(a[pivotRow][col]) < 1e-10) return null;
        [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
        const pivot = a[col][col];
        a[col] = a[col].map(value => value / pivot);
        for (let row = 0; row < k; row++) {
            if (row === col) continue;
            const factor = a[row][col];
            a[row] = a[row].map((value, index) => value - factor * a[col][index]);
        }
    }
    return a.map(row => row[k]);
}

/**
 * 数値から数値を予測する。予測に使う列が1つなら単回帰、2つ以上なら重回帰。
 * 残差（予測とのずれ）の正規性は参考として示す。
 */
export function selectPredictionMulti(data, predictors, yVar) {
    const xs = Array.from(new Set(predictors || [])).filter(name => name !== yVar);
    if (!yVar || xs.length === 0) return { error: 'need_two_vars' };
    if (xs.length === 1) {
        const single = selectPrediction(data, xs[0], yVar);
        return single.error ? single : { ...single, preset: { x: xs[0], y: yVar, predictors: xs } };
    }
    const rows = (data || [])
        .map(row => [xs.map(name => toNumber(row[name])), toNumber(row[yVar])])
        .filter(([xRow, y]) => y !== null && xRow.every(value => value !== null));
    if (rows.length < xs.length + 3) return { error: 'too_few_rows', n: rows.length };
    const coefficients = leastSquares(rows.map(([xRow]) => xRow), rows.map(([, y]) => y));
    if (!coefficients) return { error: 'collinear' };
    const residuals = rows.map(([xRow, y]) => y - coefficients[0] - xRow.reduce((sum, value, i) => sum + coefficients[i + 1] * value, 0));
    const checks = normalityChecks([{ label: 'residual', values: residuals }])
        .map(check => ({ ...check, isResidual: true }));
    return {
        analysisType: 'regression_multiple',
        methodKey: 'regression_multiple',
        normal: judgeNormality(checks),
        n: rows.length,
        checks,
        preset: { predictors: xs, y: yVar }
    };
}
