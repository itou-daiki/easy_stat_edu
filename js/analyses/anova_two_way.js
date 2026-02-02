import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, generateAPATableHtml, createPairSelector, addSignificanceBrackets } from '../utils.js';
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
            font: { size: 14, color: 'black', weight: 'bold' }
        });
    });

    return { shapes, annotations };
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

        const ssA = levels1.reduce((sum, l1) => {
            const marginalData = validData.filter(d => d[factor1] === l1).map(d => d[depVar]);
            return sum + (marginalData.length * Math.pow(jStat.mean(marginalData) - grandMean, 2));
        }, 0);

        const ssB = levels2.reduce((sum, l2) => {
            const marginalData = validData.filter(d => d[factor2] === l2).map(d => d[depVar]);
            return sum + (marginalData.length * Math.pow(jStat.mean(marginalData) - grandMean, 2));
        }, 0);

        const ssAxB = ssCells - ssA - ssB;
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

    renderTwoWayANOVATable(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'independent');
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
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
            const pStr = src.p !== null ? `${src.p.toFixed(3)} ${sig}` : '-';
            const fStr = src.f !== null ? src.f.toFixed(2) : '-';
            const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';

            finalHtml += `
                <tr>
                    <td style="text-align: left; font-weight: 500;">${src.name}</td>
                    <td>${src.ss.toFixed(2)}</td>
                    <td>${src.df}</td>
                    <td>${src.ms.toFixed(2)}</td>
                    <td>${fStr}</td>
                    <td style="${src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
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

                const { shapes, annotations } = generateBracketsForGroupedPlot(res.sigPairs || [], res.levels1, res.levels2, res.cellStats);

                const tategakiTitle = getTategakiAnnotation(res.depVar);
                if (tategakiTitle) {
                    annotations.push(tategakiTitle);
                }

                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;
                const bottomTitle = getBottomTitleAnnotation(graphTitleText);
                if (bottomTitle) {
                    annotations.push(bottomTitle);
                }

                const layout = {
                    title: '',
                    xaxis: { title: res.factor2 },
                    yaxis: { title: '', rangemode: 'tozero' },
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
                let newAnnotations = (currentLayout.annotations || []).filter(a => a.x !== -0.15 && a.y !== -0.25);

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

    renderTwoWayMixedResults(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'mixed');
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
}

function renderTwoWayMixedResults(testResults) {
    const container = document.getElementById('test-results-section');
    let html = '';

    testResults.forEach((res, index) => {
        html += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 混合要因分散分析表
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
                    <td>${src.f ? src.f.toFixed(2) : '-'}</td>
                    <td style="${src.p && src.p < 0.05 ? 'color:#e11d48;font-weight:bold;' : ''}">${src.p ? src.p.toFixed(3) + sig : '-'}</td>
                     <td>${src.eta ? src.eta.toFixed(2) : '-'}</td>
                </tr>`;
        });

        html += `</tbody></table></div></div>`;
    });

    container.innerHTML = html;
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

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
               <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem;">
                        <label style="flex: 1; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-2-type" value="independent" checked>
                            <strong>対応なし（独立測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">2つの要因ともに被験者間因子（例：性別 × 学年）</p>
                        </label>
                        <label style="flex: 1; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-2-type" value="mixed">
                            <strong>混合計画（Mixed）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">被験者間因子 × 被験者内因子（例：群 × 時点）</p>
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

                <div id="independent-controls">
                    <!-- Factor 1 & 2 -->
                    <div id="factor1-container" style="margin-bottom: 1rem;"></div>
                    <div id="factor2-container" style="margin-bottom: 1rem;"></div>
                    <div id="dependent-var-container" style="margin-bottom: 1rem;"></div>
                    <div id="run-ind-btn-container"></div>
                </div>

                <div id="mixed-controls" style="display: none;">
                    <div id="mixed-between-container" style="margin-bottom: 1rem;"></div>
                    <div id="pair-selector-container" style="margin-bottom: 1rem;"></div>
                    <div id="run-mixed-btn-container"></div>
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
    createPairSelector('pair-selector-container', numericColumns, 'mixed-within-pairs');
    createAnalysisButton('run-mixed-btn-container', '分析を実行（混合）', () => {
        const pairs = [];
        document.querySelectorAll('.pair-row').forEach(row => {
            const pre = row.querySelector('.pre-select').value;
            const post = row.querySelector('.post-select').value;
            if (pre && post) pairs.push({ pre, post });
        });
        runTwoWayMixedANOVA(currentData, pairs);
    }, { id: 'run-mixed-anova-btn' });


    document.querySelectorAll('input[name="anova-2-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isInd = e.target.value === 'independent';
            document.getElementById('independent-controls').style.display = isInd ? 'block' : 'none';
            document.getElementById('mixed-controls').style.display = !isInd ? 'block' : 'none';
            document.querySelectorAll('input[name="anova-2-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
            document.getElementById('analysis-results').style.display = 'none';
        });
    });
}