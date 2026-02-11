/**
 * @fileoverview 二元配置分散分析のヘルパー関数
 * @module anova_two_way/helpers
 */

/**
 * データから指定変数のユニークなレベルを取得
 * @param {Object[]} data - データ配列
 * @param {string} varName - 変数名
 * @returns {Array} ソートされたユニークなレベルの配列
 */
export function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

/**
 * Welch's t検定を実行
 * @param {number[]} vals1 - グループ1のデータ
 * @param {number[]} vals2 - グループ2のデータ
 * @returns {{t: number, df: number, p: number}} t値、自由度、p値
 */
export function runWelchTTest(vals1, vals2) {
    const n1 = vals1.length;
    const n2 = vals2.length;
    const m1 = jStat.mean(vals1);
    const m2 = jStat.mean(vals2);
    const s1 = jStat.stdev(vals1, true);
    const s2 = jStat.stdev(vals2, true);
    const v1 = s1 * s1;
    const v2 = s2 * s2;

    const se = Math.sqrt(v1 / n1 + v2 / n2);
    const t = (m1 - m2) / se;
    const dfNum = Math.pow(v1 / n1 + v2 / n2, 2);
    const dfDen = Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1);
    const df = dfNum / dfDen;
    const p = jStat.studentt.cdf(-Math.abs(t), df) * 2;
    return { t, df, p };
}

/**
 * 単純主効果検定を実行
 * @param {Object[]} validData - 有効なデータ
 * @param {string} factor1 - 要因1（凡例）
 * @param {string} factor2 - 要因2（X軸）
 * @param {string} depVar - 従属変数
 * @param {string} designType - デザインタイプ ('independent' または 'mixed')
 * @param {string[]} withinVars - 被験者内変数（混合計画の場合）
 * @returns {Object[]} 有意なペアの配列
 */
export function performSimpleMainEffectTests(validData, factor1, factor2, depVar, designType, withinVars = []) {
    const sigPairs = [];
    let levels2;

    if (designType === 'independent') {
        levels2 = getLevels(validData, factor2);

        levels2.forEach((l2, i) => {
            const dataAtL2 = validData.filter(d => d[factor2] === l2);
            const groups = getLevels(dataAtL2, factor1);
            if (groups.length < 2) return;

            const numComparisons = (groups.length * (groups.length - 1)) / 2;

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];

                    const valsA = dataAtL2.filter(d => d[factor1] === groupA).map(d => d[depVar]);
                    const valsB = dataAtL2.filter(d => d[factor1] === groupB).map(d => d[depVar]);

                    if (valsA.length < 2 || valsB.length < 2) continue;

                    const tRes = runWelchTTest(valsA, valsB);
                    const pAdj = Math.min(1, tRes.p * numComparisons);

                    if (pAdj < 0.1) {
                        sigPairs.push({
                            xIndex: i,
                            g1: groupA,
                            g2: groupB,
                            p: pAdj
                        });
                    }
                }
            }
        });

    } else if (designType === 'mixed') {
        levels2 = withinVars;

        levels2.forEach((l2, i) => {
            const groups = getLevels(validData, factor1);
            if (groups.length < 2) return;

            const numComparisons = (groups.length * (groups.length - 1)) / 2;

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];

                    const valsA = validData.filter(d => d[factor1] === groupA).map(d => d[l2]);
                    const valsB = validData.filter(d => d[factor1] === groupB).map(d => d[l2]);

                    if (valsA.length < 2 || valsB.length < 2) continue;

                    const tRes = runWelchTTest(valsA, valsB);
                    const pAdj = Math.min(1, tRes.p * numComparisons);

                    if (pAdj < 0.1) {
                        sigPairs.push({
                            xIndex: i,
                            g1: groupA,
                            g2: groupB,
                            p: pAdj
                        });
                    }
                }
            }
        });
    }

    return sigPairs;
}

/**
 * グループ化プロットの有意差ブラケットを生成
 * @param {Object[]} sigPairs - 有意なペアの配列
 * @param {Array} levels1 - 凡例のレベル
 * @param {Array} levels2 - X軸のレベル
 * @param {Object} cellStats - セル統計量
 * @returns {{shapes: Object[], annotations: Object[]}} Plotly用のshapesとannotations
 */
export function generateBracketsForGroupedPlot(sigPairs, levels1, levels2, cellStats) {
    const shapes = [];
    const annotations = [];

    const maxValsAtX = levels2.map(l2 => {
        const means = levels1.map(l1 => cellStats[l1][l2].mean);
        const ses = levels1.map(l1 => {
            const s = cellStats[l1][l2];
            return s.n > 0 ? s.std / Math.sqrt(s.n) : 0;
        });
        return Math.max(...means.map((m, i) => m + ses[i]));
    });

    const stackHeight = [];

    sigPairs.forEach(pair => {
        const xIdx = pair.xIndex;
        const currentMaxY = maxValsAtX[xIdx];

        if (!stackHeight[xIdx]) stackHeight[xIdx] = 0;
        stackHeight[xIdx]++;

        const yOffset = currentMaxY * 0.1 + (stackHeight[xIdx] * currentMaxY * 0.15);
        const bracketY = currentMaxY + yOffset;
        const legHeight = currentMaxY * 0.05;

        let text;
        if (pair.p < 0.01) text = 'p < 0.01 **';
        else if (pair.p < 0.05) text = 'p < 0.05 *';
        else text = 'p < 0.1 †';

        const xCenter = xIdx;
        const halfWidth = 0.2;

        shapes.push({
            type: 'line',
            x0: xCenter - halfWidth, y0: bracketY,
            x1: xCenter + halfWidth, y1: bracketY,
            line: { color: 'black', width: 2 }
        });

        shapes.push({
            type: 'line',
            x0: xCenter - halfWidth, y0: bracketY - legHeight,
            x1: xCenter - halfWidth, y1: bracketY,
            line: { color: 'black', width: 2 }
        });
        shapes.push({
            type: 'line',
            x0: xCenter + halfWidth, y0: bracketY - legHeight,
            x1: xCenter + halfWidth, y1: bracketY,
            line: { color: 'black', width: 2 }
        });

        annotations.push({
            x: xCenter,
            y: bracketY + legHeight,
            text: text,
            showarrow: false,
            font: { size: 14, color: 'black', weight: 'bold' },
            _annotationType: 'bracket'
        });
    });

    // Calculate recommended max Y for yaxis range
    let recommendedMaxY = Math.max(...maxValsAtX);
    annotations.forEach(a => {
        if (a._annotationType === 'bracket' && a.y > recommendedMaxY) {
            recommendedMaxY = a.y;
        }
    });
    recommendedMaxY *= 1.1; // Add 10% buffer

    return { shapes, annotations, recommendedMaxY };
}
