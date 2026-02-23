import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, generateAPATableHtml, createPairSelector, createMultiPairSelector, addSignificanceBrackets } from '../utils.js';
import { calculateTukeyP, performHolmCorrection } from '../utils/stat_distributions.js';
// import { jStat } from 'jstat'; // Use global jStat

// ======================================================================
// Helper Functions
// ======================================================================

function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

function performSimpleMainEffectTests(validData, factor1, factor2, depVar, designType, method, msErrorGlobal, dfErrorGlobal, withinVars = []) {
    // method: 'tukey', 'holm', 'bonferroni'
    // msErrorGlobal: Used for Independent Tukey (Using overall error term)

    const sigPairs = [];
    const allComparisons = [];
    let levels2;

    if (designType === 'independent') {
        levels2 = getLevels(validData, factor2);

        levels2.forEach((l2, i) => {
            const dataAtL2 = validData.filter(d => d[factor2] === l2);
            const groups = getLevels(dataAtL2, factor1);
            if (groups.length < 2) return;

            // Simple Main Effect: Compare Factor 1 groups AT Level 2 of Factor 2.

            // For Tukey (Independent), we typically use the GLOBAL MS_Error from the full ANOVA
            // because we assume homogeneity of variance across all cells.
            // If we suspected heterogeneity, we would use local error MS (like one-way ANOVA at this level).
            // Standard approach for Two-Way ANOVA Post-hoc is using Global MS_Error and DF_Error.

            // Calculate means and n for this slice
            const groupStats = {};
            groups.forEach(g => {
                const vals = dataAtL2.filter(d => d[factor1] === g).map(d => d[depVar]);
                groupStats[g] = {
                    mean: jStat.mean(vals),
                    n: vals.length,
                    std: jStat.stdev(vals, true)
                };
            });

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];
                    const sA = groupStats[groupA];
                    const sB = groupStats[groupB];

                    if (sA.n < 2 || sB.n < 2) continue;

                    let p_raw;
                    let stat;
                    let measure;

                    if (method === 'tukey') {
                        // q = |mA - mB| / sqrt( MSE / 2 * (1/nA + 1/nB) )
                        const se_diff = Math.sqrt((msErrorGlobal / 2) * (1 / sA.n + 1 / sB.n));
                        stat = Math.abs(sA.mean - sB.mean) / se_diff;
                        p_raw = calculateTukeyP(stat, groups.length, dfErrorGlobal); // Using global DF
                        measure = 'q';

                        // Tukey p is already adjusted for the number of groups in this family
                        // However, if we do this for EACH level of Factor 2, should we correct for number of levels?
                        // Usually Simple Main Effects treats each level as a separate family or does Bonferroni across all?
                        // Standard software often treats each simple main effect analysis as a separate family (per level).
                        // We will follow that: p-value is processed per level.

                        allComparisons.push({ xIndex: i, g1: groupA, g2: groupB, p: p_raw, stat, measure, method: 'tukey' });

                    } else {
                        // Welch's t-test (Robust) or Student's t using global MSE?
                        // If method is Bonferroni/Holm, usually implying robust tests if selected over Tukey.
                        // But strictly in ANOVA context, often t with pooled SD is used.
                        // Existing implementation used Welch. We stick to Welch for Robustness.

                        const varA = sA.std * sA.std;
                        const varB = sB.std * sB.std;
                        const se_welch = Math.sqrt(varA / sA.n + varB / sB.n);
                        stat = (sA.mean - sB.mean) / se_welch;

                        const df_num = Math.pow(varA / sA.n + varB / sB.n, 2);
                        const df_den = Math.pow(varA / sA.n, 2) / (sA.n - 1) + Math.pow(varB / sB.n, 2) / (sB.n - 1);
                        const df = df_num / df_den;

                        p_raw = jStat.studentt.cdf(-Math.abs(stat), df) * 2;
                        measure = 't';

                        allComparisons.push({ xIndex: i, g1: groupA, g2: groupB, p: p_raw, stat, measure, method });
                    }
                }
            }
        });

    } else if (designType === 'mixed') {
        // Factor 1 is Between (Group), Factor 2 is Within (Time/Condition)
        levels2 = withinVars;

        levels2.forEach((l2, i) => {
            const groups = getLevels(validData, factor1);
            if (groups.length < 2) return;

            // Compare Groups (Between) at specific condition (Within)
            // This is a "Between-subjects" comparison at a fixed repeated level.
            // Using variance approach appropriate for this slice.

            // For Tukey in Mixed design:
            // "The error term for testing difference between groups at level j of B is MS_W (or MS_cell?)"
            // Usually, we construct a pooled error term for this specific condition layer, 
            // OR use the overall MS_Error_Between? No, MS_Error_Between is for main effect.
            // At a specific within-level, valid variance includes both subject var and error var?

            // Conservative approach: One-way ANOVA for this level (pooled variance at this level).

            // Calculate pooled variance at this level
            let ssValid = 0;
            let dfValid = 0;
            const groupStats = {};
            groups.forEach(g => {
                const gRows = validData.filter(d => d[factor1] === g);
                const vals = gRows.map(d => d[l2]);
                const variance = jStat.variance(vals, true);
                groupStats[g] = {
                    mean: jStat.mean(vals),
                    n: vals.length,
                    std: jStat.stdev(vals, true)
                };
                if (vals.length > 1) {
                    ssValid += variance * (vals.length - 1);
                    dfValid += vals.length - 1;
                }
            });
            const msPooled = ssValid / dfValid;

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];
                    const sA = groupStats[groupA];
                    const sB = groupStats[groupB];

                    if (sA.n < 2 || sB.n < 2) continue;

                    let p_raw;
                    let stat;
                    let measure;

                    if (method === 'tukey') {
                        const se_diff = Math.sqrt((msPooled / 2) * (1 / sA.n + 1 / sB.n));
                        stat = Math.abs(sA.mean - sB.mean) / se_diff;
                        p_raw = calculateTukeyP(stat, groups.length, dfValid); // Use df of pooled variance
                        measure = 'q';

                        allComparisons.push({ xIndex: i, g1: groupA, g2: groupB, p: p_raw, stat, measure, method: 'tukey' });
                    } else {
                        // Welch
                        const se_welch = Math.sqrt((sA.std * sA.std) / sA.n + (sB.std * sB.std) / sB.n);
                        stat = (sA.mean - sB.mean) / se_welch;
                        // df Satterthwaite
                        const df_num = Math.pow((sA.std * sA.std) / sA.n + (sB.std * sB.std) / sB.n, 2);
                        const df_den = Math.pow((sA.std * sA.std) / sA.n, 2) / (sA.n - 1) + Math.pow((sB.std * sB.std) / sB.n, 2) / (sB.n - 1);
                        const df = df_num / df_den;

                        p_raw = jStat.studentt.cdf(-Math.abs(stat), df) * 2;
                        measure = 't';
                        allComparisons.push({ xIndex: i, g1: groupA, g2: groupB, p: p_raw, stat, measure, method });
                    }
                }
            }
        });
    }

    // Process adjustments
    // Group comparisons by xIndex (Family = one Simple Main Effect)

    // We filter sigPairs to return.

    const xIndices = [...new Set(allComparisons.map(c => c.xIndex))];

    xIndices.forEach(idx => {
        const family = allComparisons.filter(c => c.xIndex === idx);

        if (method === 'tukey') {
            // Already calculated Tukey p-values
            family.forEach(c => {
                if (c.p < 0.1) sigPairs.push(c); // Threshold for display
            });
        } else if (method === 'bonferroni') {
            const m = family.length;
            family.forEach(c => {
                const pAdj = Math.min(1, c.p * m);
                if (pAdj < 0.1) sigPairs.push({ ...c, p: pAdj });
            });
        } else if (method === 'holm') {
            const adjusted = performHolmCorrection(family);
            adjusted.forEach(c => {
                if (c.p_holm < 0.1) sigPairs.push({ ...c, p: c.p_holm });
            });
        }
    });

    return sigPairs;
}

function runWelchTTest(vals1, vals2) {
    // Legacy helper kept for any other usage, though main logic integrated above
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

function generateBracketsForGroupedPlot(sigPairs, levels1, levels2, cellStats) {
    const shapes = [];
    const annotations = [];

    // Determine max height for each X-category to clear bars
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

        // Simplify significance text
        let text;
        if (pair.p < 0.01) text = '**';
        else if (pair.p < 0.05) text = '*';
        else text = '†';

        const xCenter = xIdx;
        const halfWidth = 0.2;

        // Simple Bracket
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

// ======================================================================
// Main Analysis Function
// ======================================================================

function runTwoWayIndependentANOVA(currentData) {
    const factor1 = document.getElementById('factor1-var').value;
    const factor2 = document.getElementById('factor2-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);
    const methodSelect = document.getElementById('two-way-comparison-method');
    const method = methodSelect ? methodSelect.value : 'tukey';

    if (!factor1 || !factor2 || factor1 === factor2 || dependentVars.length === 0) {
        alert('異なる2つの要因と、1つ以上の従属変数を選択してください。');
        return;
    }

    const resultsContainer = document.getElementById('analysis-results');

    if (!document.getElementById('test-results-section')) {
        resultsContainer.innerHTML = `
            <div id="summary-stats-section"></div>
            <div id="test-results-section"></div>
            <div id="interpretation-section"></div>
            <div id="visualization-section"></div>
        `;
    } else {
        const sections = ['summary-stats-section', 'test-results-section', 'interpretation-section', 'visualization-section'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    const testResults = [];
    dependentVars.forEach(depVar => {
        const validData = currentData.filter(d => d[factor1] != null && d[factor2] != null && d[depVar] != null && !isNaN(d[depVar]));
        const n = validData.length;
        const levels1 = getLevels(validData, factor1);
        const levels2 = getLevels(validData, factor2);

        if (levels1.length < 2 || levels2.length < 2) return;

        const grandMean = jStat.mean(validData.map(d => d[depVar]));
        const ssTotal = jStat.sum(validData.map(d => Math.pow(d[depVar] - grandMean, 2)));

        const cellStats = {};
        let ssCells = 0;
        levels1.forEach(l1 => {
            cellStats[l1] = {};
            levels2.forEach(l2 => {
                const cellData = validData.filter(d => d[factor1] === l1 && d[factor2] === l2).map(d => d[depVar]);
                const mean = cellData.length > 0 ? jStat.mean(cellData) : 0;
                const std = cellData.length > 1 ? jStat.stdev(cellData, true) : 0;
                cellStats[l1][l2] = { mean, std, n: cellData.length };
                ssCells += cellData.length * Math.pow(mean - grandMean, 2);
            });
        });

        // Unweighted Means Analysis (Type III SS approximation for unbalanced data)
        const allCellNs = [];
        let hasEmptyCell = false;
        levels1.forEach(l1 => levels2.forEach(l2 => {
            if (cellStats[l1][l2].n === 0) hasEmptyCell = true;
            allCellNs.push(cellStats[l1][l2].n);
        }));

        if (hasEmptyCell) {
            alert('すべての組み合わせ（セル）にデータが存在する必要があります。');
            return;
        }

        // Harmonic Mean of n
        const k = allCellNs.length;
        const sumInverseN = allCellNs.reduce((sum, n) => sum + (1 / n), 0);
        const harmonicMeanN = k / sumInverseN;

        // Unweighted Marginal Means
        // Row Means (Factor 1)
        const rowMeans = {};
        let grandMeanUnweightedSum = 0;
        levels1.forEach(l1 => {
            let sumMeans = 0;
            levels2.forEach(l2 => sumMeans += cellStats[l1][l2].mean);
            rowMeans[l1] = sumMeans / levels2.length;
            grandMeanUnweightedSum += rowMeans[l1];
        });
        const grandMeanUnweighted = grandMeanUnweightedSum / levels1.length;

        // Col Means (Factor 2)
        const colMeans = {};
        levels2.forEach(l2 => {
            let sumMeans = 0;
            levels1.forEach(l1 => sumMeans += cellStats[l1][l2].mean);
            colMeans[l2] = sumMeans / levels1.length;
        });

        // SS A (Factor 1)
        let ssA = 0;
        levels1.forEach(l1 => {
            ssA += Math.pow(rowMeans[l1] - grandMeanUnweighted, 2);
        });
        ssA *= (levels2.length * harmonicMeanN);

        // SS B (Factor 2)
        let ssB = 0;
        levels2.forEach(l2 => {
            ssB += Math.pow(colMeans[l2] - grandMeanUnweighted, 2);
        });
        ssB *= (levels1.length * harmonicMeanN);

        // SS AxB (Interaction)
        let ssAxB = 0;
        levels1.forEach(l1 => {
            levels2.forEach(l2 => {
                const cellMean = cellStats[l1][l2].mean;
                // Interaction deviation: M_ij - M_i. - M_.j + M_..
                const dev = cellMean - rowMeans[l1] - colMeans[l2] + grandMeanUnweighted;
                ssAxB += Math.pow(dev, 2);
            });
        });
        ssAxB *= harmonicMeanN;

        // SS Error is based on Within-Cell variance (calculated from Raw data)
        // ssTotal - ssCells = SS_Within

        const ssError = ssTotal - ssCells;
        const dfA = levels1.length - 1;
        const dfB = levels2.length - 1;
        const dfAxB = dfA * dfB;
        const dfError = n - (levels1.length * levels2.length);

        if (dfA <= 0 || dfB <= 0 || dfError <= 0) {
            console.warn(`Insufficient degrees of freedom for ${depVar}. Skipping.`);
            return;
        }

        const msA = ssA / dfA;
        const msB = ssB / dfB;
        const msAxB = dfAxB > 0 ? ssAxB / dfAxB : 0;
        const msError = ssError / dfError;

        const fA = msA / msError;
        const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);

        const fB = msB / msError;
        const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);

        const fAxB = dfAxB > 0 ? msAxB / msError : 0;
        const pAxB = dfAxB > 0 ? 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError) : 1;

        const etaA = ssA / (ssA + ssError);
        const etaB = ssB / (ssB + ssError);
        const etaAxB = dfAxB > 0 ? ssAxB / (ssAxB + ssError) : 0;

        // Perform Simple Main Effect Tests (with method & msError)
        const resultSigPairs = performSimpleMainEffectTests(validData, factor1, factor2, depVar, 'independent', method, msError, dfError);

        testResults.push({
            depVar, factor1, factor2, levels1, levels2,
            cellStats,
            pA, pB, pAxB,
            etaA, etaB, etaAxB,
            ssA, dfA, msA, fA,
            ssB, dfB, msB, fB,
            ssAxB, dfAxB, msAxB, fAxB,
            ssError, dfError, msError,
            sigPairs: resultSigPairs,
            method
        });
    });

    renderTwoWayANOVASummaryTable(testResults, 'independent');
    renderTwoWayANOVATable(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'independent');
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
}

// ======================================================================
// 一括表（サマリーテーブル）- 全従属変数の結果を1つの表にまとめる
// ======================================================================

function renderTwoWayANOVASummaryTable(results, designType) {
    const container = document.getElementById('summary-stats-section');
    if (!container || results.length === 0) return;

    const res0 = results[0];

    // --- 要因名の統一的な取得 ---
    let factorA, factorB;
    if (designType === 'independent') {
        factorA = res0.factor1;
        factorB = res0.factor2;
    } else if (designType === 'mixed') {
        factorA = res0.factorBetween;
        factorB = res0.factorWithin || '条件';
    } else {
        factorA = res0.factor1;
        factorB = res0.factor2;
    }

    // Factor1のレベル（列グループ: M, SD）
    const levels1 = res0.levels1;
    const numLevels1 = levels1.length;

    // --- 効果の抽出 ---
    function extractEffects(res) {
        if (designType === 'independent') {
            return {
                pA: res.pA, etaA: res.etaA, fA: res.fA, dfA: res.dfA, dfErrA: res.dfError,
                pB: res.pB, etaB: res.etaB, fB: res.fB, dfB: res.dfB, dfErrB: res.dfError,
                pAxB: res.pAxB, etaAxB: res.etaAxB, fAxB: res.fAxB, dfAxB: res.dfAxB, dfErrAxB: res.dfError
            };
        } else if (designType === 'mixed') {
            const srcA = res.sources.find(s => !s.name.includes('Error') && !s.name.includes('交互') && !s.name.includes('条件'));
            const srcB = res.sources.find(s => s.name.includes('条件'));
            const srcAxB = res.sources.find(s => s.name.includes('交互'));
            const errA = res.sources.find(s => s.name.includes('Error') && s.name.includes('Group'));
            const errB = res.sources.find(s => s.name.includes('Error') && s.name.includes('Time'));
            return {
                pA: srcA?.p, etaA: srcA?.eta, fA: srcA?.f, dfA: srcA?.df, dfErrA: errA?.df,
                pB: srcB?.p, etaB: srcB?.eta, fB: srcB?.f, dfB: srcB?.df, dfErrB: errB?.df,
                pAxB: srcAxB?.p, etaAxB: srcAxB?.eta, fAxB: srcAxB?.f, dfAxB: srcAxB?.df, dfErrAxB: errB?.df
            };
        } else {
            const eff = res.sources.filter(s => !s.name.includes('Error'));
            const err = res.sources.filter(s => s.name.includes('Error'));
            return {
                pA: eff[0]?.p, etaA: eff[0]?.eta, fA: eff[0]?.f, dfA: eff[0]?.df, dfErrA: err[0]?.df,
                pB: eff[1]?.p, etaB: eff[1]?.eta, fB: eff[1]?.f, dfB: eff[1]?.df, dfErrB: err[1]?.df,
                pAxB: eff[2]?.p, etaAxB: eff[2]?.eta, fAxB: eff[2]?.f, dfAxB: eff[2]?.df, dfErrAxB: err[2]?.df
            };
        }
    }

    // --- ヘルパー ---
    const getStars = (p) => {
        if (p == null) return '-';
        return p < 0.01 ? '**' : p < 0.05 ? '*' : p < 0.1 ? '†' : 'n.s.';
    };
    const getSigStyle = (p) => {
        if (p == null) return 'color: #6b7280;';
        if (p < 0.01) return 'color: #e11d48; font-weight: bold; font-size: 1.1em;';
        if (p < 0.05) return 'color: #e11d48; font-weight: bold;';
        if (p < 0.1) return 'color: #d97706; font-weight: bold;';
        return 'color: #6b7280;';
    };
    const formatEta = (eta) => (eta != null ? `(${eta.toFixed(2)})` : '');
    const formatP = (p) => {
        if (p == null) return '-';
        return p < 0.001 ? '< .001' : p.toFixed(3);
    };

    const designLabel = designType === 'independent' ? '対応なし' : designType === 'mixed' ? '混合' : '反復測定';
    const thStyle = 'text-align: center; vertical-align: middle; padding: 0.5rem 0.6rem;';
    const tdCenter = 'text-align: center; padding: 0.4rem 0.5rem;';

    // === ヘッダー行1: Factor1レベルのグループヘッダー ===
    let hRow1 = '';
    let hRow2 = '';

    // 従属変数列 + Factor2レベル列
    hRow1 += `<th rowspan="2" style="${thStyle} text-align: left; font-weight: bold; color: #495057; min-width: 100px;"></th>`;
    hRow1 += `<th rowspan="2" style="${thStyle} text-align: left; font-weight: bold; color: #495057;"></th>`;

    // Factor1の各レベル列グループ
    levels1.forEach((level, idx) => {
        if (idx > 0) {
            hRow1 += `<th rowspan="2" style="width: 6px; padding: 0; background: #f8f9fa; border-left: none; border-right: none;"></th>`;
        }
        hRow1 += `<th colspan="2" style="${thStyle} border-bottom: 2px solid #adb5bd; font-weight: bold;">${level}</th>`;
        hRow2 += `<th style="${thStyle} font-weight: 600;">M</th><th style="${thStyle} font-weight: 600;">S.D</th>`;
    });

    // 主効果・交互作用列
    hRow1 += `<th rowspan="2" style="${thStyle} min-width: 75px; font-size: 0.85rem; background: #f0f7ff;">${factorA}の<br>主効果</th>`;
    hRow1 += `<th rowspan="2" style="${thStyle} min-width: 75px; font-size: 0.85rem; background: #f0f7ff;">${factorB}の<br>主効果</th>`;
    hRow1 += `<th rowspan="2" style="${thStyle} min-width: 75px; font-size: 0.85rem; background: #f0f7ff;">交互作用</th>`;

    // === ボディ: 従属変数ごとにFactor2レベルをサブ行で展開 ===
    let bodyHtml = '';

    results.forEach((res, resIdx) => {
        const eff = extractEffects(res);
        const depVar = res.depVar;
        const levels2 = res.levels2;
        const numLevels2 = levels2.length;
        const needGroupBorder = resIdx < results.length - 1;
        const groupBorder = needGroupBorder ? 'border-bottom: 2px solid #dee2e6;' : '';

        levels2.forEach((l2, l2Idx) => {
            const isFirst = l2Idx === 0;
            const isLast = l2Idx === numLevels2 - 1;
            const cellBorder = (needGroupBorder && isLast) ? groupBorder : '';

            bodyHtml += '<tr>';

            // 従属変数名（最初のサブ行のみ、rowspan）
            if (isFirst) {
                bodyHtml += `<td rowspan="${numLevels2}" style="font-weight: bold; color: #1e90ff; vertical-align: middle; text-align: left; padding: 0.5rem; ${groupBorder}">${depVar}</td>`;
            }

            // Factor2レベル名
            bodyHtml += `<td style="text-align: left; padding: 0.4rem 0.5rem; color: #4a5568; ${cellBorder}">${l2}</td>`;

            // 各Factor1レベルのM, SD
            levels1.forEach((l1, l1Idx) => {
                // スペーサー列（最初のサブ行でrowspan）
                if (l1Idx > 0 && isFirst) {
                    bodyHtml += `<td rowspan="${numLevels2}" style="width: 6px; padding: 0; border-left: none; border-right: none; ${groupBorder}"></td>`;
                }
                const cell = res.cellStats[l1]?.[l2] || { mean: 0, std: 0 };
                bodyHtml += `<td style="${tdCenter} ${cellBorder}">${cell.mean.toFixed(2)}</td>`;
                bodyHtml += `<td style="${tdCenter} ${cellBorder}">${cell.std.toFixed(2)}</td>`;
            });

            // 主効果・交互作用セル（最初のサブ行のみrowspan）
            if (isFirst) {
                const sigBase = `text-align: center; vertical-align: middle; padding: 0.5rem; ${groupBorder} background: #fafbfc;`;
                bodyHtml += `<td rowspan="${numLevels2}" style="${sigBase} ${getSigStyle(eff.pA)}">${getStars(eff.pA)}<br><span style="font-size: 0.8em; color: #6b7280; font-weight: normal;">${formatEta(eff.etaA)}</span></td>`;
                bodyHtml += `<td rowspan="${numLevels2}" style="${sigBase} ${getSigStyle(eff.pB)}">${getStars(eff.pB)}<br><span style="font-size: 0.8em; color: #6b7280; font-weight: normal;">${formatEta(eff.etaB)}</span></td>`;
                bodyHtml += `<td rowspan="${numLevels2}" style="${sigBase} ${getSigStyle(eff.pAxB)}">${getStars(eff.pAxB)}<br><span style="font-size: 0.8em; color: #6b7280; font-weight: normal;">${formatEta(eff.etaAxB)}</span></td>`;
            }

            bodyHtml += '</tr>';
        });
    });

    // === テーブル全体のHTML ===
    let html = `
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
        <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
            <i class="fas fa-list"></i> ２要因分散分析 一括表（${designLabel}）
        </h4>
        <div class="table-container" style="overflow-x: auto;">
            <table class="table" style="min-width: 600px; border-collapse: collapse;">
                <thead style="background: #f8f9fa;">
                    <tr>${hRow1}</tr>
                    <tr>${hRow2}</tr>
                </thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem; color: #6b7280;">
            p&lt;0.1† p&lt;0.05* p&lt;0.01**　|　括弧内: 偏η²
        </p>
    </div>`;

    // === APA スタイル テーブル ===
    const allEffects = results.map((res, idx) => ({ depVar: res.depVar, ...extractEffects(res) }));
    const headersAPA = [
        "Measure",
        `<em>F</em> (${factorA})`, `<em>p</em>`, `η<sub>p</sub><sup>2</sup>`,
        `<em>F</em> (${factorB})`, `<em>p</em>`, `η<sub>p</sub><sup>2</sup>`,
        `<em>F</em> (A×B)`, `<em>p</em>`, `η<sub>p</sub><sup>2</sup>`
    ];
    const rowsAPA = allEffects.map(eff => [
        eff.depVar,
        eff.fA != null ? eff.fA.toFixed(2) : '-',
        formatP(eff.pA),
        eff.etaA != null ? eff.etaA.toFixed(2) : '-',
        eff.fB != null ? eff.fB.toFixed(2) : '-',
        formatP(eff.pB),
        eff.etaB != null ? eff.etaB.toFixed(2) : '-',
        eff.fAxB != null ? eff.fAxB.toFixed(2) : '-',
        formatP(eff.pAxB),
        eff.etaAxB != null ? eff.etaAxB.toFixed(2) : '-'
    ]);

    html += `
        <div style="margin-bottom: 2rem;">
            <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
            <div>${generateAPATableHtml('anova-2way-summary-apa', `Table. Two-Way ANOVA Summary (${designLabel})`, headersAPA, rowsAPA, '<em>Note</em>. Effect size is partial eta-squared (η<sub>p</sub><sup>2</sup>).')}</div>
        </div>`;

    container.innerHTML = html;
}

function displayTwoWayANOVAInterpretation(results, designType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> 解釈の補助
            </h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>`;

    const contentContainer = document.getElementById('interpretation-content');
    let html = '';

    results.forEach(res => {
        let factorA, factorB, pA, pB, pAxB, etaA, etaB, etaAxB, varName;

        if (designType === 'independent') {
            factorA = res.factor1;
            factorB = res.factor2;
            pA = res.pA;
            pB = res.pB;
            pAxB = res.pAxB;
            etaA = res.etaA;
            etaB = res.etaB;
            etaAxB = res.etaAxB;
            varName = res.depVar;
        } else {
            factorA = res.factorBetween;
            factorB = res.factorWithin;
            const srcA = res.sources.find(s => s.name.includes(factorA));
            const srcB = res.sources.find(s => s.name.includes(factorB) || s.name.includes('条件'));
            const srcAxB = res.sources.find(s => s.name.includes('×'));
            pA = srcA ? srcA.p : 1;
            pB = srcB ? srcB.p : 1;
            pAxB = srcAxB ? srcAxB.p : 1;
            etaA = srcA ? srcA.eta : 0;
            etaB = srcB ? srcB.eta : 0;
            etaAxB = srcAxB ? srcAxB.eta : 0;
            varName = '測定値';
        }

        const getSigText = (p) => p < 0.05 ? '有意な差（効果）が見られました。' : '有意な差（効果）は見られませんでした。';
        const getStars = (p) => p < 0.01 ? '**' : p < 0.05 ? '*' : p < 0.1 ? '†' : 'n.s.';

        html += `
            <div style="margin-bottom: 1.5rem; border-left: 4px solid #1e90ff; padding-left: 1rem;">
                <h5 style="font-weight: bold; color: #2d3748; margin-bottom: 0.5rem;">${varName} の分析結果:</h5>
                
                <p style="margin: 0.5rem 0;">
                    <strong>1. 交互作用 (${factorA} × ${factorB}):</strong> <br>
                    p = ${pAxB.toFixed(3)} (${getStars(pAxB)}), 偏η² = ${etaAxB.toFixed(2)}。<br>
                    ${getSigText(pAxB)}
                    ${pAxB < 0.05 ? '<br><span style="color: #d97706; font-size: 0.9em;"><i class="fas fa-exclamation-triangle"></i> 交互作用が有意であるため、主効果の解釈には注意が必要です（単純主効果の検定を推奨）。要因の組み合わせによって結果が異なる可能性があります。</span>' : '<br><span style="color: #059669; font-size: 0.9em;">交互作用は有意ではないため、それぞれの主効果（要因単独の影響）に着目します。</span>'}
                </p>

                <p style="margin: 0.5rem 0;">
                    <strong>2. ${factorA} の主効果:</strong> <br>
                    p = ${pA.toFixed(3)} (${getStars(pA)}), 偏η² = ${etaA.toFixed(2)}。<br>
                    ${getSigText(pA)}
                </p>

                <p style="margin: 0.5rem 0;">
                    <strong>3. ${factorB} の主効果:</strong> <br>
                    p = ${pB.toFixed(3)} (${getStars(pB)}), 偏η² = ${etaB.toFixed(2)}。<br>
                    ${getSigText(pB)}
                </p>
                
                <p style="margin-top: 0.5rem; font-size: 0.9em; color: #666;">
                   ※ 多重比較法: ${res.method === 'tukey' ? 'Tukey-Kramer法' : res.method === 'holm' ? 'Holm法' : 'Bonferroni法'}
                </p>
            </div>
        `;
    });

    contentContainer.innerHTML = html;
}

function renderTwoWayANOVATable(results) {
    if (results.length === 0) return;

    const container = document.getElementById('test-results-section');
    let finalHtml = '';

    results.forEach((res, index) => {
        const sources = [
            { name: res.factor1, ss: res.ssA, df: res.dfA, ms: res.msA, f: res.fA, p: res.pA, eta: res.etaA },
            { name: res.factor2, ss: res.ssB, df: res.dfB, ms: res.msB, f: res.fB, p: res.pB, eta: res.etaB },
            { name: `${res.factor1} × ${res.factor2}`, ss: res.ssAxB, df: res.dfAxB, ms: res.msAxB, f: res.fAxB, p: res.pAxB, eta: res.etaAxB },
            { name: '誤差 (Error)', ss: res.ssError, df: res.dfError, ms: res.msError, f: null, p: null, eta: null }
        ];

        finalHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 分散分析表: ${res.depVar}
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>変動要因 (Source)</th>
                            <th>平方和 (SS)</th>
                            <th>自由度 (df)</th>
                            <th>平均平方 (MS)</th>
                            <th>F値</th>
                            <th>p値</th>
                            <th>偏η²</th>
                        </tr>
                    </thead>
                    <tbody>`;

        sources.forEach(src => {
            const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
            const pStr = src.p !== null ? `${src.p < 0.001 ? '< .001' : src.p.toFixed(3)} ${sig}` : '-';
            const fStr = src.f !== null ? src.f.toFixed(2) : '-';
            const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';

            finalHtml += `
                <tr>
                    <td style="text-align: left; font-weight: 500;">${src.name}</td>
                    <td>${src.ss.toFixed(2)}</td>
                    <td>${src.df}</td>
                    <td>${src.ms.toFixed(2)}</td>
                    <td>${fStr}</td>
                    <td style="${src.p !== null && src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
                    <td>${etaStr}</td>
                </tr>
            `;
        });

        finalHtml += `</tbody></table>
            <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
            </div></div>`;

        // Descriptive Stats Table (Means and SDs)
        finalHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
                記述統計量: ${res.depVar}
            </h4>
            <div class="table-container">
                <table class="table">
                     <thead>
                        <tr>
                            <th>${res.factor1}</th>
                            <th>${res.factor2}</th>
                            <th>平均値 (M)</th>
                            <th>標準偏差 (SD)</th>
                            <th>サンプル数 (N)</th>
                        </tr>
                    </thead>
                    <tbody>`;

        res.levels1.forEach(l1 => {
            res.levels2.forEach(l2 => {
                const stat = res.cellStats[l1][l2];
                finalHtml += `
                    <tr>
                        <td>${l1}</td>
                        <td>${l2}</td>
                        <td>${stat.mean.toFixed(2)}</td>
                        <td>${stat.std.toFixed(2)}</td>
                        <td>${stat.n}</td>
                    </tr>
                `;
            });
        });

        finalHtml += `</tbody></table></div></div>`;

        // Generate APA Source Table
        const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
        const rowsAPA = sources.map(src => {
            const sig = src.p !== null ? (src.p < 0.001 ? '< .001' : src.p.toFixed(3)) : '-';
            return [
                src.name,
                src.ss.toFixed(2),
                src.df,
                src.ms.toFixed(2),
                src.f !== null ? src.f.toFixed(2) : '-',
                sig,
                src.eta !== null ? src.eta.toFixed(2) : '-'
            ];
        });

        finalHtml += `
            <div style="margin-bottom: 2rem;">
                 <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                 <div>${generateAPATableHtml(`anova-ind-apa-${index || 0}`, `Table 1. Two-Way ANOVA Source Table for ${res.depVar}`, headersAPA, rowsAPA, `<em>Note</em>. Effect size is partial eta-squared.`)}</div>
            </div>
        `;
    });

    container.innerHTML = finalHtml;
}


function renderTwoWayANOVAVisualization(results) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-chart-bar"></i> 可視化</h4>
            <div id="viz-controls-container"></div>
            <div id="visualization-plots"></div>
        </div>`;

    const { axisControl, titleControl } = createVisualizationControls('viz-controls-container');

    const plotsContainer = document.getElementById('visualization-plots');
    plotsContainer.innerHTML = '';

    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        plotsContainer.innerHTML += `<div id="${plotId}" class="plot-container" style="margin-top: 1rem;"></div>`;

        setTimeout(() => {
            const plotDiv = document.getElementById(plotId);
            if (plotDiv) {
                const traces = [];
                res.levels1.forEach(l1 => {
                    const yData = res.levels2.map(l2 => res.cellStats[l1][l2].mean);
                    const errorData = res.levels2.map(l2 => {
                        const n = res.cellStats[l1][l2].n;
                        return n > 0 ? res.cellStats[l1][l2].std / Math.sqrt(n) : 0;
                    });
                    traces.push({
                        x: res.levels2,
                        y: yData,
                        name: l1,
                        type: 'bar',
                        error_y: {
                            type: 'data',
                            array: errorData,
                            visible: true,
                            color: 'black'
                        }
                    });
                });

                const { shapes, annotations, recommendedMaxY } = generateBracketsForGroupedPlot(res.sigPairs || [], res.levels1, res.levels2, res.cellStats);

                const tategakiTitle = getTategakiAnnotation(res.depVar);
                if (tategakiTitle) {
                    annotations.push(tategakiTitle);
                }

                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;
                const bottomTitle = getBottomTitleAnnotation(graphTitleText);
                if (bottomTitle) {
                    annotations.push(bottomTitle);
                }

                const yaxisConfig = { title: '', rangemode: 'tozero' };
                if (recommendedMaxY) {
                    yaxisConfig.range = [0, recommendedMaxY];
                }

                const layout = {
                    title: '',
                    xaxis: { title: res.factor2 },
                    yaxis: yaxisConfig,
                    legend: { title: { text: res.factor1 } },
                    barmode: 'group',
                    shapes: shapes,
                    annotations: annotations,
                    margin: { l: 100, b: 100 }
                };

                const showAxisLabels = axisControl?.checked ?? true;
                const showBottomTitle = titleControl?.checked ?? true;

                if (!showAxisLabels) {
                    layout.xaxis.title = '';
                    layout.annotations = layout.annotations.filter(a => a !== tategakiTitle);
                }
                if (!showBottomTitle) {
                    layout.annotations = layout.annotations.filter(a => a !== bottomTitle);
                }

                Plotly.newPlot(plotDiv, traces, layout, createPlotlyConfig('二要因分散分析', res.depVar));
            }
        }, 100);
    });

    const updateAllPlots = () => {
        const showAxis = axisControl?.checked ?? true;
        const showTitle = titleControl?.checked ?? true;

        results.forEach((res, index) => {
            const plotId = `anova-plot-${index}`;
            const plotDiv = document.getElementById(plotId);
            if (plotDiv && plotDiv.data) {
                const currentLayout = plotDiv.layout;
                let newAnnotations = (currentLayout.annotations || []).filter(a => a._annotationType !== 'tategaki' && a._annotationType !== 'bottomTitle');

                if (showAxis) {
                    const ann = getTategakiAnnotation(res.depVar);
                    if (ann) newAnnotations.push(ann);
                }
                if (showTitle) {
                    const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;
                    const titleAnn = getBottomTitleAnnotation(graphTitleText);
                    if (titleAnn) newAnnotations.push(titleAnn);
                }

                Plotly.relayout(plotDiv, {
                    'xaxis.title.text': showAxis ? res.factor2 : '',
                    annotations: newAnnotations
                });
            }
        });
    };

    axisControl.addEventListener('change', updateAllPlots);
    titleControl.addEventListener('change', updateAllPlots);
}


function runTwoWayMixedANOVA(currentData, pairs) {
    const betweenVar = document.getElementById('mixed-between-var').value;
    const methodSelect = document.getElementById('two-way-comparison-method');
    const method = methodSelect ? methodSelect.value : 'holm'; // Default to Holm for Mixed for safety

    if (!betweenVar) {
        alert('被験者間因子（グループ）を選択してください。');
        return;
    }
    if (!pairs || pairs.length === 0) {
        alert('分析する変数ペア（観測変数・測定変数）を1つ以上追加してください。');
        return;
    }

    const resultsContainer = document.getElementById('analysis-results');
    if (!document.getElementById('test-results-section')) {
        resultsContainer.innerHTML = `
            <div id="summary-stats-section"></div>
            <div id="test-results-section"></div>
            <div id="interpretation-section"></div>
            <div id="visualization-section"></div>
        `;
    } else {
        const sections = ['summary-stats-section', 'test-results-section', 'interpretation-section', 'visualization-section'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    const testResults = [];

    pairs.forEach((pair, index) => {
        const withinVars = [pair.pre, pair.post];
        // Note: Currently limited to 2 conditions (pre/post)? 
        // Logic handles list of withinVars.

        const validData = currentData.filter(d =>
            d[betweenVar] != null &&
            withinVars.every(v => d[v] != null && !isNaN(d[v]))
        );

        const nTotal = validData.length;
        const groups = getLevels(validData, betweenVar);
        const conditions = withinVars;
        const nGroups = groups.length;
        const nConditions = conditions.length;

        if (nGroups < 2) {
            console.warn(`Skipping pair ${pair.pre}-${pair.post}: Not enough groups.`);
            return;
        }

        const allValues = validData.flatMap(d => withinVars.map(v => d[v]));
        const grandMean = jStat.mean(allValues);
        const ssTotal = jStat.sum(allValues.map(v => Math.pow(v - grandMean, 2)));

        const groupData = {};
        const groupMeans = {};
        const groupNs = {};

        groups.forEach(g => {
            const gRows = validData.filter(d => d[betweenVar] === g);
            const gValues = gRows.flatMap(d => withinVars.map(v => d[v]));
            groupData[g] = gRows;
            groupMeans[g] = jStat.mean(gValues);
            groupNs[g] = gRows.length;
        });

        let ssBetween = 0;
        groups.forEach(g => {
            ssBetween += groupNs[g] * nConditions * Math.pow(groupMeans[g] - grandMean, 2);
        });

        const subjectMeans = validData.map(d => jStat.mean(withinVars.map(v => d[v])));
        const ssSubjectsTotal = nConditions * jStat.sum(subjectMeans.map(m => Math.pow(m - grandMean, 2)));
        const ssErrorBetween = ssSubjectsTotal - ssBetween;

        const conditionMeans = {};
        withinVars.forEach(v => {
            conditionMeans[v] = jStat.mean(validData.map(d => d[v]));
        });

        let ssWithin = 0;
        withinVars.forEach(v => {
            ssWithin += nTotal * Math.pow(conditionMeans[v] - grandMean, 2);
        });

        const cellStats = {};
        let ssCells = 0;

        groups.forEach(g => {
            cellStats[g] = {};
            withinVars.forEach(v => {
                const cellValues = groupData[g].map(d => d[v]);
                const mean = jStat.mean(cellValues);
                const n = cellValues.length;
                const std = jStat.stdev(cellValues, true);
                cellStats[g][v] = { mean, n, std };

                ssCells += n * Math.pow(mean - grandMean, 2);
            });
        });

        const ssInteraction = ssCells - ssBetween - ssWithin;
        const ssBroadWithin = ssTotal - ssSubjectsTotal;
        const ssErrorWithin = ssBroadWithin - ssWithin - ssInteraction;

        const dfBetween = nGroups - 1;
        const dfErrorBetween = nTotal - nGroups;
        const dfWithin = nConditions - 1;
        const dfInteraction = dfBetween * dfWithin;
        const dfErrorWithin = dfErrorBetween * dfWithin;

        const msBetween = ssBetween / dfBetween;
        const msErrorBetween = ssErrorBetween / dfErrorBetween;
        const fBetween = msBetween / msErrorBetween;
        const pBetween = 1 - jStat.centralF.cdf(fBetween, dfBetween, dfErrorBetween);
        const etaBetween = ssBetween / (ssBetween + ssErrorBetween); // Partial eta

        const msWithinVal = ssWithin / dfWithin;
        const msInteraction = ssInteraction / dfInteraction;
        const msErrorWithin = ssErrorWithin / dfErrorWithin;

        const fWithin = msWithinVal / msErrorWithin;
        const pWithin = 1 - jStat.centralF.cdf(fWithin, dfWithin, dfErrorWithin);
        const etaWithin = ssWithin / (ssWithin + ssErrorWithin);

        const fInteraction = msInteraction / msErrorWithin;
        const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfErrorWithin);
        const etaInteraction = ssInteraction / (ssInteraction + ssErrorWithin);

        const sources = [
            { name: `${betweenVar} (Group)`, ss: ssBetween, df: dfBetween, ms: msBetween, f: fBetween, p: pBetween, eta: etaBetween },
            { name: `Error (Group)`, ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null, eta: null },
            { name: `条件 (Time)`, ss: ssWithin, df: dfWithin, ms: msWithinVal, f: fWithin, p: pWithin, eta: etaWithin },
            { name: `交互作用 (Group x Time)`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
            { name: `Error (Time)`, ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null, eta: null }
        ];

        // Post-hoc / Simple Main Effects
        // Mixed Design: Compare Groups at each Level (Between-subjects test at each time)
        // Passes 'mixed' type.
        // We pass msErrorWithin? No, for Between comparison at fixed time, use local variance.
        const sigPairs = performSimpleMainEffectTests(validData, betweenVar, 'Time', 'Value', 'mixed', method, null, null, withinVars);

        testResults.push({
            designType: 'mixed',
            depVar: `Pair ${index + 1}`,
            factorBetween: betweenVar,
            factorWithin: '条件',
            levels1: groups,
            levels2: withinVars,
            cellStats,
            sources,
            sigPairs,
            method
        });
    });

    renderTwoWayANOVASummaryTable(testResults, 'mixed');
    renderTwoWayMixedResults(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'mixed');
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
}

function renderTwoWayMixedResults(testResults) {
    const container = document.getElementById('test-results-section');
    let html = '';

    testResults.forEach((res, index) => {
        // Repeated Measures Table
        if (res.designType === 'repeated') {
            html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-table"></i> 反復測定分散分析表
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>変動要因 (Source)</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th><th>ηp²</th>
                            </tr>
                        </thead>
                        <tbody>`;

            res.sources.forEach(src => {
                const isSig = src.p !== null && src.p < 0.05;
                const sigMark = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
                const pDisplay = src.p !== null ? src.p.toFixed(3) + sigMark : '-';
                const fDisplay = src.f !== null ? src.f.toFixed(2) : '-';
                const msDisplay = src.ms !== null ? src.ms.toFixed(2) : '-';
                const etaDisplay = src.eta !== null ? src.eta.toFixed(2) : '-';
                const style = isSig ? 'color: #e11d48; font-weight: bold;' : '';

                html += `
                    <tr>
                        <td style="text-align: left;">${src.name}</td>
                        <td>${src.ss.toFixed(2)}</td>
                        <td>${src.df}</td>
                        <td>${msDisplay}</td>
                        <td>${fDisplay}</td>
                        <td style="${style}">${pDisplay}</td>
                        <td>${etaDisplay}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>
                <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.01** p&lt;0.05* p&lt;0.1†</p>
                <p style="font-size: 0.9rem; color: #666; text-align: right;">※ 被験者内要因では球面性の仮定が必要です。満たされない場合は Greenhouse–Geisser 補正の利用を検討してください。本画面では Mauchly の検定・GG補正は未実装です。</p>
             </div>`;

        } else {
            // Existing Mixed/Independent output (Simplified for brevity as we are just appending/modifying logic)
            // But wait, I am replacing the renderTwoWayMixedResults function? No, I am replacing from 900 to 1056.
            // I need to preserve existing Mixed render logic or merge it.

            // ... (This block is handling Mixed primarily in the original code, but 'renderTwoWayMixedResults' name implies Mixed only)
            // I should make a generic render function or add 'repeated' case to 'renderTwoWayMixedResults' 
            // essentially renaming it to renderComplexDesignResults

            // For now, I'll follow the pattern and render based on design type in the loop.

            html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-table"></i> ${res.designType === 'mixed' ? '混合要因分散分析表' : '分散分析表'}
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>変動要因</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th><th>ηp²</th>
                            </tr>
                        </thead>
                        <tbody>`;

            res.sources.forEach(src => {
                const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
                html += `
                    <tr>
                        <td>${src.name}</td>
                        <td>${src.ss.toFixed(2)}</td>
                        <td>${src.df}</td>
                        <td>${src.ms.toFixed(2)}</td>
                        <td>${src.f !== null ? src.f.toFixed(2) : '-'}</td>
                        <td style="${src.p !== null && src.p < 0.05 ? 'color:#e11d48;font-weight:bold;' : ''}">${src.p !== null ? (src.p < 0.001 ? '< .001' : src.p.toFixed(3)) + ' ' + sig : '-'}</td>
                         <td>${src.eta !== null ? src.eta.toFixed(2) : '-'}</td>
                    </tr>`;
            });

            html += `</tbody></table>
                <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.01** p&lt;0.05* p&lt;0.1†</p>
            </div></div>`;
        }
    });

    container.innerHTML = html;
}

// ----------------------------------------------------------------------
// Repeated Measures Logic
// ----------------------------------------------------------------------

function runTwoWayRepeatedANOVA(currentData, factors, mapping) {
    // factors: { f1: { name, levels: [] }, f2: { name, levels: [] } }
    // mapping: { "levelA1-levelB1": colName, ... }

    const methodSelect = document.getElementById('two-way-comparison-method');
    const method = methodSelect ? methodSelect.value : 'bonferroni'; // Default to Bonferroni for RM

    const f1 = factors.f1;
    const f2 = factors.f2;
    const n = currentData.length;
    const a = f1.levels.length;
    const b = f2.levels.length;

    // 1. Gather Data Matrix Y[i][j][k] (Subject i, F1 level j, F2 level k)
    // Structure: [Subject] -> [Factor1] -> [Factor2] -> Value
    const Y = [];

    // Valid data check
    const validRows = currentData.filter(row => {
        // Check all involved columns are numeric and not null
        return f1.levels.every(l1 =>
            f2.levels.every(l2 => {
                const col = mapping[`${l1}-${l2}`];
                const val = row[col];
                return val != null && !isNaN(val);
            })
        );
    });

    const realN = validRows.length;
    if (realN < 2) {
        alert('有効なデータ行が少なすぎます');
        return;
    }

    // Pre-calculate Means
    // Grand Mean
    let grandSum = 0;
    let grandCount = 0;

    // Subject Means (averaged over A and B)
    const subjectMeans = [];

    // Cell Means (A=j, B=k)
    const cellMeans = {}; // key: "j-k"
    f1.levels.forEach(l1 => f2.levels.forEach(l2 => cellMeans[`${l1}-${l2}`] = 0));

    // Factor A Means
    const aMeans = {};
    f1.levels.forEach(l1 => aMeans[l1] = 0);

    // Factor B Means
    const bMeans = {};
    f2.levels.forEach(l2 => bMeans[l2] = 0);

    // Populate Data and Sums
    validRows.forEach((row, i) => {
        let subSum = 0;
        f1.levels.forEach(l1 => {
            f2.levels.forEach(l2 => {
                const col = mapping[`${l1}-${l2}`];
                const val = parseFloat(row[col]);
                grandSum += val;
                grandCount++;
                subSum += val;

                cellMeans[`${l1}-${l2}`] += val;
                aMeans[l1] += val;
                bMeans[l2] += val;
            });
        });
        subjectMeans.push(subSum / (a * b));
    });

    const grandMean = grandSum / grandCount;

    // Convert Sums to Means
    Object.keys(cellMeans).forEach(k => cellMeans[k] /= realN);
    Object.keys(aMeans).forEach(k => aMeans[k] /= (realN * b));
    Object.keys(bMeans).forEach(k => bMeans[k] /= (realN * a));

    // 2. Calculate Sum of Squares

    // SS_Total
    let ssTotal = 0;
    validRows.forEach(row => {
        f1.levels.forEach(l1 => {
            f2.levels.forEach(l2 => {
                const col = mapping[`${l1}-${l2}`];
                const val = parseFloat(row[col]);
                ssTotal += Math.pow(val - grandMean, 2);
            });
        });
    });

    // SS_Subjects (Between Subjects)
    let ssSubjects = 0;
    subjectMeans.forEach(m => {
        ssSubjects += (a * b) * Math.pow(m - grandMean, 2);
    });

    // SS_Within (Total - Subjects)
    const ssWithin = ssTotal - ssSubjects;

    // Partition Within: A, B, AxB and Errors

    // SS_A
    let ssA = 0;
    f1.levels.forEach(l1 => {
        ssA += (realN * b) * Math.pow(aMeans[l1] - grandMean, 2);
    });

    // SS_B
    let ssB = 0;
    f2.levels.forEach(l2 => {
        ssB += (realN * a) * Math.pow(bMeans[l2] - grandMean, 2);
    });

    // SS_AxB
    let ssAxB = 0;
    f1.levels.forEach(l1 => {
        f2.levels.forEach(l2 => {
            const cellMean = cellMeans[`${l1}-${l2}`];
            const effectInteraction = cellMean - aMeans[l1] - bMeans[l2] + grandMean;
            ssAxB += realN * Math.pow(effectInteraction, 2);
        });
    });

    // Error Terms
    // To assume Geisser-Greenhouse requires calculation of matrix sphericity which is complex in vanilla JS.
    // We will compute standard error terms by subtraction.

    // Calculate SS_AxSubjects (Error A)
    // Create Subject x A table (averaged over B)
    let ssAxS_raw = 0; // standard calculation of Interaction(AxS) SS
    // Direct formula: SS_AxS = Sum( (Y_ij. - Y_i.. - Y_.j. + Y_...)^2 ) * b ?? No, we are averaging over B implies /b somewhere?
    // Actually simpler: 
    // SS_ErrorA = SS_WithinA - SS_A ?? Not exactly.
    // Let's use the explicit interaction calculation approach for AxS.
    // SS_AxS = Sum_i Sum_j b * (Mean_ij - Mean_i.. - Mean_.j. + Mean_...)^2

    let ssErrorA = 0;
    validRows.forEach((row, i) => {
        const meanI = subjectMeans[i];
        f1.levels.forEach(l1 => {
            // Mean of subject i at level A=j (across B)
            let sumB = 0;
            f2.levels.forEach(l2 => sumB += parseFloat(row[mapping[`${l1}-${l2}`]]));
            const meanIJ = sumB / b;
            const meanJ = aMeans[l1];

            ssErrorA += b * Math.pow(meanIJ - meanI - meanJ + grandMean, 2);
        });
    });

    // SS_ErrorB (BxS)
    let ssErrorB = 0;
    validRows.forEach((row, i) => {
        const meanI = subjectMeans[i];
        f2.levels.forEach(l2 => {
            // Mean of subject i at level B=k (across A)
            let sumA = 0;
            f1.levels.forEach(l1 => sumA += parseFloat(row[mapping[`${l1}-${l2}`]]));
            const meanIK = sumA / a;
            const meanK = bMeans[l2];

            ssErrorB += a * Math.pow(meanIK - meanI - meanK + grandMean, 2);
        });
    });

    // SS_ErrorAxB (AxBxS)
    // Residual = ssWithin - ssA - ssB - ssAxB - ssErrorA - ssErrorB
    const ssErrorAxB = ssWithin - ssA - ssB - ssAxB - ssErrorA - ssErrorB;

    // 3. Degrees of Freedom
    const dfSubjects = realN - 1;
    const dfA = a - 1;
    const dfB = b - 1;
    const dfAxB = dfA * dfB;
    const dfErrorA = dfA * dfSubjects;
    const dfErrorB = dfB * dfSubjects;
    const dfErrorAxB = dfAxB * dfSubjects;

    // 4. Mean Squares & F
    const msA = ssA / dfA;
    const msErrorA = ssErrorA / dfErrorA;
    const fA = msA / msErrorA;
    const pA = 1 - jStat.centralF.cdf(fA, dfA, dfErrorA);
    const etaA = ssA / (ssA + ssErrorA);

    const msB = ssB / dfB;
    const msErrorB = ssErrorB / dfErrorB;
    const fB = msB / msErrorB;
    const pB = 1 - jStat.centralF.cdf(fB, dfB, dfErrorB);
    const etaB = ssB / (ssB + ssErrorB);

    const msAxB = ssAxB / dfAxB;
    const msErrorAxB = ssErrorAxB / dfErrorAxB;
    const fAxB = msAxB / msErrorAxB;
    const pAxB = 1 - jStat.centralF.cdf(fAxB, dfAxB, dfErrorAxB);
    const etaAxB = ssAxB / (ssAxB + ssErrorAxB);


    // 5. Post Hoc (Simple Main Effects)
    // Strategy: Repeated Measures -> Use Paired T-Tests with Correction for the pairwise comparisons
    const sigPairs = [];
    const allComparisons = [];

    // We treat Factor 1 as the primary grouping axis for the graph (X-axis=Factor2 usually in my code? Let's check render)
    // In Independent: X-axis=Factor2, Legend=Factor1.
    // So we usually compare Levels of F1 at each Level of F2.
    // Or Compare Levels of F2 within F1.
    // Let's support both or stick to standard: "Simple Main Effects of Legend Factor at X-axis Factor"
    // Here: Compare Groups (Factor 1) at each Condition (Factor 2).

    // xIndex corresponds to Factor 2 (X-axis).
    f2.levels.forEach((l2, i) => {
        const groups = f1.levels; // These are the bars clustered at l2

        // Pairwise comparisons between Factor 1 levels AT this Factor 2 level
        for (let gA = 0; gA < groups.length; gA++) {
            for (let gB = gA + 1; gB < groups.length; gB++) {
                const groupA = groups[gA];
                const groupB = groups[gB];

                const colA = mapping[`${groupA}-${l2}`];
                const colB = mapping[`${groupB}-${l2}`];

                const valsA = validRows.map(r => r[colA]);
                const valsB = validRows.map(r => r[colB]);

                // Paired T-Test
                const diffs = valsA.map((v, k) => v - valsB[k]);
                const meanDiff = jStat.mean(diffs);
                const sdDiff = jStat.stdev(diffs, true); // sample SD
                const stderr = sdDiff / Math.sqrt(realN);
                const t = stderr > 0 ? meanDiff / stderr : 0;
                const df = realN - 1;
                const p_raw = jStat.studentt.cdf(-Math.abs(t), df) * 2;

                allComparisons.push({ xIndex: i, g1: groupA, g2: groupB, p: p_raw, method });
            }
        }
    });

    // Corrections
    const xIndices = [...new Set(allComparisons.map(c => c.xIndex))];
    xIndices.forEach(idx => {
        const family = allComparisons.filter(c => c.xIndex === idx);

        if (method === 'bonferroni') {
            const m = family.length;
            family.forEach(c => {
                const pAdj = Math.min(1, c.p * m);
                if (pAdj < 0.1) sigPairs.push({ ...c, p: pAdj });
            });
        } else if (method === 'holm') {
            const adjusted = performHolmCorrection(family); // Assumes generic structure compatibility
            adjusted.forEach(c => {
                // performHolmCorrection returns objects with p_holm
                // Note: utility expects {p: raw} and returns new objects
                if (c.p_holm < 0.1) sigPairs.push({ ...c, p: c.p_holm });
            });
        } else {
            // Tukey not standard for Repeated Measures simple main effect on Paired T?
            // Usually just Bonferroni or Holm. If Tukey selected, fallback to Bonferroni or Raw?
            // Let's use Raw for 'tukey' if forced, or just alias to Bonferroni?
            // Currently UI says 'Tukey (Recommended)'. 
            // Ideally implement Tukey-Kramer for Repeated Measures (requiring q-dist).
            // Fallback to Bonferroni for specific Repeated case simplicity/robustness.
            const m = family.length;
            family.forEach(c => {
                const pAdj = Math.min(1, c.p * m); // Fallback
                if (pAdj < 0.1) sigPairs.push({ ...c, p: pAdj });
            });
        }
    });

    const sources = [
        { name: `${f1.name} (要因1)`, ss: ssA, df: dfA, ms: msA, f: fA, p: pA, eta: etaA },
        { name: `Error (${f1.name})`, ss: ssErrorA, df: dfErrorA, ms: msErrorA, f: null, p: null, eta: null },
        { name: `${f2.name} (要因2)`, ss: ssB, df: dfB, ms: msB, f: fB, p: pB, eta: etaB },
        { name: `Error (${f2.name})`, ss: ssErrorB, df: dfErrorB, ms: msErrorB, f: null, p: null, eta: null },
        { name: `${f1.name} × ${f2.name}`, ss: ssAxB, df: dfAxB, ms: msAxB, f: fAxB, p: pAxB, eta: etaAxB },
        { name: `Error (Interaction)`, ss: ssErrorAxB, df: dfErrorAxB, ms: msErrorAxB, f: null, p: null, eta: null }
    ];

    // Prepare Cell Stats for Visualization
    const cellStats = {};
    f1.levels.forEach(l1 => {
        cellStats[l1] = {};
        f2.levels.forEach(l2 => {
            cellStats[l1][l2] = {
                mean: cellMeans[`${l1}-${l2}`],
                n: realN,
                // For error bars in repeated measures:
                // Standard Error should theoretically remove subject variability? (Morey, 2008)
                // Or just show standard SD/SE?
                // Standard is usually sufficient for simple viz, but specific 'within-subject CI' is better.
                // We'll use standard SE here for consistency with other plots.
                std: jStat.stdev(validRows.map(r => r[mapping[`${l1}-${l2}`]]), true)
            };
        });
    });

    const results = [{
        depVar: '測定値',
        factor1: f1.name,
        factor2: f2.name,
        levels1: f1.levels,
        levels2: f2.levels,
        cellStats,
        sources,
        sigPairs,
        method,
        designType: 'repeated'
    }];

    renderTwoWayANOVASummaryTable(results, 'repeated');
    renderTwoWayMixedResults(results); // Reuse generic renderer
    displayTwoWayANOVAInterpretation(results, 'repeated');
    renderTwoWayANOVAVisualization(results);
    document.getElementById('analysis-results').style.display = 'block';
}


// ----------------------------------------------------------------------
// Main Render
// ----------------------------------------------------------------------

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
    <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-project-diagram"></i> 二要因分散分析 (Two-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因（グループ変数など）が従属変数に与える影響と、その交互作用を検定します</p>
            </div>

            <!-- 分析の概要・方法 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note-section">
                        <h4><i class="fas fa-search"></i> どんな時に使う？</h4>
                        <p>ある結果（売上、テストの点数など）に対して、2つの要因（性別と年齢層、広告媒体と時間帯など）が影響しているかを検証したい場合に使用します。</p>
                        <img src="image/anova_two_way.png" alt="二要因分散分析の説明" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                        <ul>
                            <li><strong>主効果（Main Effect）:</strong> 個々の要因が結果に与える影響</li>
                            <li><strong>交互作用（Interaction）:</strong> 要因の組み合わせによって結果が変化するか（例：特定の薬は特定の年齢層にだけ効く、など）</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- ロジック詳説 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-code"></i> 分析ロジック・計算式詳説 (専門家向け)</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note" style="background: #f1f8ff; border-left: 5px solid #0366d6;">
                        <strong><i class="fas fa-check-circle"></i> 実装ロジックの検証</strong>
                        <ul>
                            <li><strong>対応なし（独立測度）:</strong>
                                <ul>
                                    <li>不均等データの場合、非加重平均法 (Unweighted Means Analysis) による Type III 近似の平方和分解を使用</li>
                                    <li>主効果 (要因A, 要因B) と交互作用 (A×B) の F 検定</li>
                                    <li>効果量: 偏イータ二乗 \( \eta_p^2 = SS_{effect} / (SS_{effect} + SS_{error}) \)</li>
                                </ul>
                            </li>
                            <li><strong>混合計画 (Mixed Design):</strong>
                                <ul>
                                    <li>被験者間因子 × 被験者内因子の分解</li>
                                    <li>被験者間効果: \( F = MS_{between} / MS_{S(between)} \)</li>
                                    <li>被験者内効果・交互作用: \( F = MS_{within} / MS_{error} \)</li>
                                    <li>※ 現在の実装では Mauchly の球面性検定・GG 補正は適用していません</li>
                                </ul>
                            </li>
                            <li><strong>反復測定 (対応あり):</strong>
                                <ul>
                                    <li>被験者・要因A・要因B・交互作用・各誤差項の平方和を算出</li>
                                    <li>\( F_A = MS_A / MS_{ErrorA} \), \( F_B = MS_B / MS_{ErrorB} \), \( F_{A \times B} = MS_{A \times B} / MS_{ErrorAB} \)</li>
                                    <li>効果量: 偏イータ二乗</li>
                                </ul>
                            </li>
                            <li><strong>単純主効果・多重比較:</strong> 交互作用が有意な場合、各水準での単純主効果検定を実施。Tukey-Kramer / Holm / Bonferroni 法を選択可能。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

               <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-2-type" value="independent" checked>
                            <strong>対応なし（独立測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">2つの要因ともに被験者間因子<br>（例：性別 × 学年）</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-2-type" value="mixed">
                            <strong>混合計画（Mixed）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">被験者間因子 × 被験者内因子<br>（例：群 × 分割測定）</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-2-type" value="repeated">
                            <strong>反復測定（対応あり）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">2つの要因ともに被験者内因子<br>（例：条件A × 条件B）</p>
                        </label>
                    </div>
                </div>

                <div id="compare-method-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; color: #4b5563;">
                        <i class="fas fa-tasks"></i> 多重比較の手法 (単純主効果の検定):
                    </label>
                    <select id="two-way-comparison-method" class="form-select" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #d1d5db;">
                        <option value="tukey" selected>Tukey-Kramer法 (推奨)</option>
                        <option value="holm">Holm法</option>
                        <option value="bonferroni">Bonferroni法</option>
                    </select>
                </div>

                <!-- Independent Controls -->
                <div id="independent-controls">
                    <div id="factor1-container" style="margin-bottom: 1rem;"></div>
                    <div id="factor2-container" style="margin-bottom: 1rem;"></div>
                    <div id="dependent-var-container" style="margin-bottom: 1rem;"></div>
                    <div id="run-ind-btn-container"></div>
                </div>

                <!-- Mixed Controls -->
                <div id="mixed-controls" style="display: none;">
                    <div id="mixed-between-container" style="margin-bottom: 1rem;"></div>
                    <div id="pair-selector-container" style="margin-bottom: 1rem;"></div>
                    <div id="run-mixed-btn-container"></div>
                </div>
                
                <!-- Repeated Controls -->
                <div id="repeated-controls" style="display: none;">
                     <div style="margin-bottom: 1.5rem; padding: 1rem; background: #fffacd; border-radius: 8px; font-size: 0.9rem;">
                        <i class="fas fa-info-circle" style="color: #d97706;"></i> 
                        反復測定デザインの設定：<br>
                        1. 2つの要因名とそれぞれの水準数・水準名を入力してください。<br>
                        2. 「グリッドを生成」を押すと、要因の組み合わせ表が表示されます。<br>
                        3. 各セルに対応するデータの列（変数）を割り当ててください。
                     </div>
                     
                     <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="font-weight: bold;">要因1 (Legend)</label>
                            <input type="text" id="rm-f1-name" class="form-input" placeholder="例: 時間" value="時間" style="width:100%; padding:0.5rem; margin-bottom:0.5rem;">
                            <input type="text" id="rm-f1-levels" class="form-input" placeholder="水準 (カンマ区切り) 例: Pre,Post" style="width:100%; padding:0.5rem;">
                        </div>
                        <div>
                            <label style="font-weight: bold;">要因2 (X軸)</label>
                            <input type="text" id="rm-f2-name" class="form-input" placeholder="例: 条件" value="条件" style="width:100%; padding:0.5rem; margin-bottom:0.5rem;">
                            <input type="text" id="rm-f2-levels" class="form-input" placeholder="水準 (カンマ区切り) 例: A,B" style="width:100%; padding:0.5rem;">
                        </div>
                     </div>
                     <button id="rm-generate-grid-btn" class="btn btn-secondary" style="margin-bottom: 1.5rem; width: 100%;">
                        <i class="fas fa-table"></i> グリッドを生成
                     </button>
                     
                     <div id="rm-grid-area" style="margin-bottom: 1.5rem;"></div>
                     <div id="rm-run-btn-area"></div>
                </div>
            </div>

            <div id="analysis-results" style="display: none;">
                <div id="summary-stats-section"></div>
                <div id="test-results-section"></div>
                <div id="interpretation-section"></div>
                <div id="visualization-section"></div>
            </div>
    </div>
    `;

    renderDataOverview('#anova-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Independent UI
    createVariableSelector('factor1-container', categoricalColumns, 'factor1-var', {
        label: '<i class="fas fa-layer-group"></i> 要因1（行・Legend）:',
        multiple: false
    });
    createVariableSelector('factor2-container', categoricalColumns, 'factor2-var', {
        label: '<i class="fas fa-layer-group"></i> 要因2（列・X軸）:',
        multiple: false
    });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数可）:',
        multiple: true
    });
    createAnalysisButton('run-ind-btn-container', '二要因分散分析を実行（対応なし）', () => runTwoWayIndependentANOVA(currentData), { id: 'run-ind-anova-btn' });

    // Mixed UI
    createVariableSelector('mixed-between-container', categoricalColumns, 'mixed-between-var', {
        label: '<i class="fas fa-users"></i> 被験者間因子（グループ）:',
        multiple: false
    });
    createMultiPairSelector('pair-selector-container', numericColumns);
    createAnalysisButton('run-mixed-btn-container', '分析を実行（混合）', () => {
        const pairs = [];
        document.querySelectorAll('.pair-row').forEach(row => {
            const pre = row.querySelector('.pre-select').value;
            const post = row.querySelector('.post-select').value;
            if (pre && post) pairs.push({ pre, post });
        });
        runTwoWayMixedANOVA(currentData, pairs);
    }, { id: 'run-mixed-anova-btn' });

    // Repeated Measures Logic Setup
    const generateGridBtn = document.getElementById('rm-generate-grid-btn');
    const gridArea = document.getElementById('rm-grid-area');
    const runArea = document.getElementById('rm-run-btn-area');

    generateGridBtn.addEventListener('click', () => {
        const f1Name = document.getElementById('rm-f1-name').value || '要因1';
        const f1Levels = document.getElementById('rm-f1-levels').value.split(',').map(s => s.trim()).filter(s => s);
        const f2Name = document.getElementById('rm-f2-name').value || '要因2';
        const f2Levels = document.getElementById('rm-f2-levels').value.split(',').map(s => s.trim()).filter(s => s);

        if (f1Levels.length < 2 || f2Levels.length < 2) {
            alert('各要因には少なくとも2つの水準が必要です');
            return;
        }

        // Generate Grid
        let tableHtml = `<table class="table table-bordered">
            <thead>
                <tr>
                    <th>${f1Name} \\ ${f2Name}</th>
                    ${f2Levels.map(l2 => `<th>${l2}</th>`).join('')}
                </tr>
            </thead>
            <tbody>`;

        f1Levels.forEach(l1 => {
            tableHtml += `<tr><th>${l1}</th>`;
            f2Levels.forEach(l2 => {
                tableHtml += `<td id="cell-container-${l1}-${l2}"></td>`;
            });
            tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table>`;

        gridArea.innerHTML = tableHtml;

        // Inject Selectors into Cells
        f1Levels.forEach(l1 => {
            f2Levels.forEach(l2 => {
                createVariableSelector(`cell-container-${l1}-${l2}`, numericColumns, `rm-select-${l1}-${l2}`, { placeholder: '変数を選択' });
            });
        });

        createAnalysisButton('rm-run-btn-area', '分析を実行（反復測定）', () => {
            const mapping = {};
            let missing = false;
            f1Levels.forEach(l1 => {
                f2Levels.forEach(l2 => {
                    const val = document.getElementById(`rm-select-${l1}-${l2}`).value;
                    if (!val) missing = true;
                    mapping[`${l1}-${l2}`] = val;
                });
            });

            if (missing) {
                alert('すべてのセルに変数を割り当ててください');
                return;
            }

            runTwoWayRepeatedANOVA(currentData,
                { f1: { name: f1Name, levels: f1Levels }, f2: { name: f2Name, levels: f2Levels } },
                mapping
            );
        }, { id: 'run-rm-btn' });
    });


    // Toggle logic
    document.querySelectorAll('input[name="anova-2-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            document.getElementById('independent-controls').style.display = val === 'independent' ? 'block' : 'none';
            document.getElementById('mixed-controls').style.display = val === 'mixed' ? 'block' : 'none';
            document.getElementById('repeated-controls').style.display = val === 'repeated' ? 'block' : 'none';

            document.querySelectorAll('input[name="anova-2-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
            document.getElementById('analysis-results').style.display = 'none';
        });
    });
}