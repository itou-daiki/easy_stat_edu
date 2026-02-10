import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml, calculateLeveneTest, addSignificanceBrackets } from '../utils.js';
import { calculateTukeyP, performHolmCorrection } from '../utils/stat_distributions.js';

// Pairwise t-test helper for Between-Subjects (Independent)
function performPostHocTests(groups, groupData, msWithin, dfWithin, method = 'tukey') {
    const pairs = [];
    const numGroups = groups.length;

    // Collect all raw comparisons
    const comparisons = [];

    for (let i = 0; i < numGroups; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            const g1 = groups[i];
            const g2 = groups[j];
            const d1 = groupData[g1];
            const d2 = groupData[g2];

            if (d1.length < 2 || d2.length < 2) continue;

            const n1 = d1.length;
            const n2 = d2.length;
            const mean1 = jStat.mean(d1);
            const mean2 = jStat.mean(d2);

            // For report
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);

            let p_raw;
            let t_val; // or q_val

            if (method === 'tukey') {
                // Tukey-Kramer: Uses MS_within (Error variance from ANOVA)
                // Standard Error for difference: sqrt(MSW/2 * (1/n1 + 1/n2))
                // Studentized Range Statistic q = |m1 - m2| / sqrt(MSW * (1/n1 + 1/n2) / 2) ?
                // Standard definition: q = |m1 - m2| / sqrt(MSW/n) for equal n.
                // Tukey-Kramer: q = |m1 - m2| / sqrt( MSW * (1/n1 + 1/n2) / 2 )
                // SE for Tukey-Kramer with unequal n: sqrt(MSW/2 * (1/n1 + 1/n2))
                // Note: The /2 is part of the Tukey q formula, applied to the harmonic mean
                const se_diff = Math.sqrt(msWithin * (1 / n1 + 1 / n2) / 2);
                const q_stat = Math.abs(mean1 - mean2) / se_diff;

                // Tukey P-value
                p_raw = calculateTukeyP(q_stat, numGroups, dfWithin);

                pairs.push({
                    g1, g2,
                    p: p_raw,
                    mean1, mean2,
                    std1, std2,
                    n1, n2,
                    stat: q_stat,
                    measure: 'q'
                });

            } else {
                // Welch's t-test for Bonferroni/Holm (Robust to unequal variances)
                const var1 = std1 * std1;
                const var2 = std2 * std2;
                const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
                const t_stat = (mean1 - mean2) / se_welch;

                // Welch-Satterthwaite df
                const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
                const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
                const df = df_num / df_den;

                p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

                comparisons.push({
                    g1, g2,
                    p: p_raw,
                    mean1, mean2,
                    std1, std2,
                    n1, n2,
                    stat: t_stat,
                    measure: 't'
                });
            }
        }
    }

    if (method === 'tukey') {
        return pairs; // Tukey p-values are already adjusted/calculated directly
    }

    // Apply adjustments for Bonferroni / Holm
    const numComparisons = comparisons.length; // Or theoretical max? Standard is number of specific planned comparisons, here all pairs.

    if (method === 'bonferroni') {
        return comparisons.map(c => ({
            ...c,
            p: Math.min(1, c.p * numComparisons)
        }));
    } else if (method === 'holm') {
        const adjustedInfo = performHolmCorrection(comparisons);
        return adjustedInfo.map(c => ({
            ...c,
            p: c.p_holm // Use the adjusted p
        }));
    }

    return comparisons; // Default raw (none)
}

// Pairwise t-test helper for Within-Subjects (Repeated)
function performRepeatedPostHocTests(dependentVars, currentData, msError, dfError, nTotal, method = 'tukey') {
    const pairs = [];
    const numVars = dependentVars.length;
    const comparisons = [];

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = dependentVars[i];
            const var2 = dependentVars[j];

            // Valid pairs
            const validPairs = currentData
                .map(row => ({ v1: row[var1], v2: row[var2] }))
                .filter(p => p.v1 != null && !isNaN(p.v1) && p.v2 != null && !isNaN(p.v2));

            if (validPairs.length < 2) continue;

            const n = validPairs.length;
            const values1 = validPairs.map(p => p.v1);
            const values2 = validPairs.map(p => p.v2);
            const mean1 = jStat.mean(values1);
            const mean2 = jStat.mean(values2);

            let p_raw;

            if (method === 'tukey') {
                // Repeated Measures Tukey
                // q = |m1 - m2| / sqrt(MSE / n)
                // Note: This assumes sphericity / equal covariance.
                // Using msError from the ANOVA table.
                // Note: n here should be nTotal if no missing data, but robustly n.
                // If checking within-sub, n is the number of subjects.

                // Tukey for repeated measures: SE = sqrt(2 * MSE / n)
                // q = |m1 - m2| / sqrt(MSE / n) but SE for the q formula = sqrt(2*MSE/n)/sqrt(2) = sqrt(MSE/n)
                // Actually: q = (m1-m2) / SE where SE = sqrt(MSE/n) for equal-n repeated measures
                // This is correct because MSE already accounts for subject variability
                const se_diff = Math.sqrt(msError / n);
                const q_stat = Math.abs(mean1 - mean2) / se_diff;

                p_raw = calculateTukeyP(q_stat, numVars, dfError);

                pairs.push({
                    g1: var1, g2: var2,
                    p: p_raw,
                    mean1, mean2, n,
                    stat: q_stat,
                    measure: 'q'
                });

            } else {
                // Paired t-test
                const diffs = validPairs.map(p => p.v1 - p.v2);
                const diffMean = jStat.mean(diffs);
                const diffStd = jStat.stdev(diffs, true);
                const se = diffStd / Math.sqrt(n);
                const t_stat = diffMean / se;
                const df = n - 1;

                p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

                comparisons.push({
                    g1: var1, g2: var2,
                    p: p_raw,
                    mean1, mean2, n,
                    stat: t_stat,
                    measure: 't'
                });
            }
        }
    }

    if (method === 'tukey') return pairs;

    const numComparisons = comparisons.length;

    if (method === 'bonferroni') {
        return comparisons.map(c => ({
            ...c,
            p: Math.min(1, c.p * numComparisons)
        }));
    } else if (method === 'holm') {
        return performHolmCorrection(comparisons).map(c => ({
            ...c,
            p: c.p_holm
        }));
    }

    return comparisons;
}

// ----------------------------------------------------------------------
// New Helper Functions (modeled after ttest.js)
// ----------------------------------------------------------------------

function displayANOVASummaryStatistics(variables, currentData) {
    const container = document.getElementById('summary-stats-section');
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 選択した従属変数に関する要約統計量
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数名</th>
                            <th>有効N</th>
                            <th>平均値</th>
                            <th>中央値</th>
                            <th>標準偏差</th>
                            <th>分散</th>
                            <th>最小値</th>
                            <th>最大値</th>
                        </tr>
                    </thead>
                    <tbody>`;

    variables.forEach(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            tableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                    <td>${values.length}</td>
                    <td>${jstat.mean().toFixed(2)}</td>
                    <td>${jstat.median().toFixed(2)}</td>
                    <td>${jstat.stdev(true).toFixed(2)}</td>
                    <td>${jstat.variance(true).toFixed(2)}</td>
                    <td>${jstat.min().toFixed(2)}</td>
                    <td>${jstat.max().toFixed(2)}</td>
                </tr>`;
        }
    });

    tableHtml += `</tbody></table></div></div>`;
    container.innerHTML = tableHtml;
}

function displayANOVAInterpretation(results, factorVar, testType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div id="interpretation-content"></div>
        </div>`;
    const contentContainer = document.getElementById('interpretation-content');

    let interpretationHtml = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';

    results.forEach(res => {
        let factor = testType === 'independent' ? factorVar : '条件（試行）';
        // Check if etaSquared or partialEtaSquared exists
        let effectSize = res.etaSquared !== undefined ? res.etaSquared : res.partialEtaSquared;

        let text = InterpretationHelper.interpretANOVA(res.pValue, effectSize, factor, res.varName);

        interpretationHtml += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });
    interpretationHtml += '</ul>';

    contentContainer.innerHTML = interpretationHtml;
}

function displayANOVAVisualization(results, testType) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <!-- 軸ラベル表示オプション -->
            <div id="visualization-controls-container"></div>
            <div id="visualization-plots"></div>
        </div>`;

    // コントロールの追加
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');

    const plotsContainer = document.getElementById('visualization-plots');
    let plotsHtml = '';
    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        plotsHtml += `
            <div style="margin-bottom: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                <h5 style="color: #2d3748; margin-bottom: 1rem;">${res.varName}</h5>
                <div class="table-container" style="margin-bottom: 1rem;">
                    <table class="table">
                        <thead>
                            <tr><th>変動要因</th><th>平方和 (SS)</th><th>自由度 (df)</th><th>平均平方 (MS)</th><th>F値</th><th>p値</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${testType === 'independent' ? '要因間 (Between)' : '条件間 (Time)'}</td>
                                <td>${res.ssBetween.toFixed(2)}</td>
                                <td>${res.df1}</td>
                                <td>${res.msBetween.toFixed(2)}</td>
                                <td>${res.fValue.toFixed(2)}</td>
                                <td style="${res.pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${res.pValue.toFixed(3)} ${res.significance}</td>
                            </tr>
                             <tr>
                                <td>${testType === 'independent' ? '要因内 (Error)' : '誤差 (Error)'}</td>
                                <td>${res.ssWithin.toFixed(2)}</td>
                                <td>${res.df2}</td>
                                <td>${res.msWithin.toFixed(2)}</td>
                                <td>-</td><td>-</td>
                            </tr>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td>合計 (Total)</td>
                                <td>${res.ssTotal.toFixed(2)}</td>
                                <td>${res.df1 + res.df2}</td>
                                <td>-</td><td>-</td><td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- 多重比較の結果テーブル -->
                ${renderPostHocTable(res.sigPairs, res.method)}
                
                <div id="${plotId}" class="plot-container"></div>
            </div>`;
    });
    plotsContainer.innerHTML = plotsHtml;

    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        const trace = {
            x: res.groups,
            y: res.groupMeans,
            error_y: {
                type: 'data',
                array: res.groupSEs,
                visible: true,
                color: 'black'
            },
            type: 'bar',
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };

        const plotAnnotations = [...(res.plotAnnotations || [])]; // Start with existing annotations (brackets)
        const tategakiTitle = getTategakiAnnotation(res.varName);
        const graphTitleText = `平均値の比較：${res.varName} by グループ`;
        const bottomTitle = getBottomTitleAnnotation(graphTitleText);

        if (tategakiTitle) plotAnnotations.push(tategakiTitle);
        if (bottomTitle) plotAnnotations.push(bottomTitle);

        const layout = {
            title: '', // Disable default title
            xaxis: { title: 'Group' },
            yaxis: { title: '' }, // Disable standard title
            shapes: [],
            annotations: plotAnnotations,
            margin: { t: 60, l: 100, b: 100 } // Add left and bottom margin, initial top margin
        };

        // Add significance brackets using the standardized helper
        // We need to calculate yMax and yRange for the helper
        const yMax = Math.max(...res.groupMeans.map((m, i) => m + res.groupSEs[i]));
        const yMin = 0; // Bar plots usually start at 0
        const yRange = yMax - yMin; // Simplified for bar chart

        // Group name to index map (or just pass array if helper supports it)
        // Helper supports array of names for index lookup
        addSignificanceBrackets(layout, res.sigPairs, res.groups, yMax, yRange);

        // Initial toggle state
        const showAxisLabels = axisControl?.checked ?? true;
        const showBottomTitle = titleControl?.checked ?? true;

        if (!showAxisLabels) {
            layout.xaxis.title = '';
            layout.annotations = layout.annotations.filter(a => a !== tategakiTitle);
        }
        if (!showBottomTitle) {
            layout.annotations = layout.annotations.filter(a => a !== bottomTitle);
        }

        Plotly.newPlot(plotId, [trace], layout, createPlotlyConfig(`一要因分散分析: ${res.varName}`, res.varName));

        // Helper to update plots
        const updatePlots = () => {
            const plotDiv = document.getElementById(plotId);
            if (plotDiv && plotDiv.data) {
                const showAxis = axisControl?.checked ?? true;
                const showTitle = titleControl?.checked ?? true;

                const currentLayout = plotDiv.layout;
                // Filter out existing dynamic annotations (tategaki and bottom title)
                let newAnnotations = (currentLayout.annotations || []).filter(a => a.x !== -0.15 && a.y !== -0.25);

                if (showAxis) {
                    const ann = getTategakiAnnotation(res.varName);
                    if (ann) newAnnotations.push(ann);
                }
                if (showTitle) {
                    const titleAnn = getBottomTitleAnnotation(graphTitleText);
                    if (titleAnn) newAnnotations.push(titleAnn);
                }

                Plotly.relayout(plotDiv, {
                    'xaxis.title.text': showAxis ? 'Group' : '',
                    annotations: newAnnotations
                });
            }
        };

        axisControl.addEventListener('change', updatePlots);
        titleControl.addEventListener('change', updatePlots);
    });
}

function renderPostHocTable(pairs, method) {
    if (!pairs || pairs.length === 0) return '';

    let methodName = '';
    if (method === 'tukey') methodName = 'Tukey-Kramer法 (等分散仮定)';
    else if (method === 'holm') methodName = 'Holm法 (Welchのt検定)';
    else if (method === 'bonferroni') methodName = 'Bonferroni法 (Welchのt検定)';

    let html = `
    <div style="margin-bottom: 1rem; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #f3f4f6; padding: 0.5rem 1rem; font-weight: bold; font-size: 0.9rem; color: #374151;">
             多重比較結果 (${methodName})
        </div>
        <div style="max-height: 200px; overflow-y: auto;">
            <table class="table table-sm" style="margin: 0; font-size: 0.85rem;">
                <thead style="position: sticky; top: 0; background: white;">
                    <tr><th>対比</th><th>差</th><th>統計量</th><th>p値</th><th>有意</th></tr>
                </thead>
                <tbody>`;

    pairs.forEach(p => {
        const sig = p.p < 0.01 ? '**' : p.p < 0.05 ? '*' : p.p < 0.1 ? '†' : 'n.s.';
        const diff = p.mean1 - p.mean2;
        const statLabel = p.measure === 'q' ? 'q' : 't';

        html += `<tr>
            <td>${p.g1} vs ${p.g2}</td>
            <td>${diff.toFixed(2)}</td>
            <td>${statLabel}=${Math.abs(p.stat).toFixed(2)}</td>
            <td>${p.p < 0.001 ? '< .001' : p.p.toFixed(3)}</td>
            <td style="${p.p < 0.05 ? 'color: #ef4444; font-weight: bold;' : 'color: #9ca3af;'}">${sig}</td>
        </tr>`;
    });

    html += `</tbody></table></div></div>`;
    return html;
}

// ----------------------------------------------------------------------
// Main Analysis Functions
// ----------------------------------------------------------------------

function runOneWayIndependentANOVA(currentData) {
    const factorVar = document.getElementById('factor-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);
    const methodSelect = document.getElementById('comparison-method');
    const method = methodSelect ? methodSelect.value : 'tukey';

    if (!factorVar || dependentVars.length === 0) {
        alert('要因（グループ変数）と従属変数を1つ以上選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null).sort();
    if (groups.length < 2) {
        alert(`一要因分散分析（対応なし）には2群以上必要です（現在: ${groups.length} 群）`);
        return;
    }

    document.getElementById('analysis-results').style.display = 'none';

    // 1. Summary Statistics
    displayANOVASummaryStatistics(dependentVars, currentData);

    const testResults = [];
    const mainResultsTable = [];

    dependentVars.forEach(depVar => {
        const groupData = {};
        let totalN = 0;
        groups.forEach(g => {
            groupData[g] = currentData
                .filter(row => row[factorVar] === g)
                .map(row => row[depVar])
                .filter(v => v != null && !isNaN(v));
            totalN += groupData[g].length;
        });

        const allValues = Object.values(groupData).flat();
        if (allValues.length < groups.length) return;

        const grandMean = jStat.mean(allValues);
        let ssBetween = 0;
        let ssWithin = 0;
        groups.forEach(g => {
            const vals = groupData[g];
            if (vals.length > 0) {
                const mean = jStat.mean(vals);
                ssBetween += vals.length * Math.pow(mean - grandMean, 2);
                ssWithin += vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
            }
        });

        const dfBetween = groups.length - 1;
        const dfWithin = totalN - groups.length;
        if (dfBetween <= 0 || dfWithin <= 0) return;

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fValue = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);

        const ssTotal = ssBetween + ssWithin;
        const etaSquared = ssBetween / ssTotal;
        let omegaSquared = (ssBetween - (dfBetween * msWithin)) / (ssTotal + msWithin);
        const omegaSquaredNegative = omegaSquared < 0;
        if (omegaSquared < 0) omegaSquared = 0;

        let significance = 'n.s.';
        if (pValue < 0.01) significance = '**';
        else if (pValue < 0.05) significance = '*';
        else if (pValue < 0.1) significance = '†';

        const groupMeans = groups.map(g => jStat.mean(groupData[g]));
        const groupStds = groups.map(g => jStat.stdev(groupData[g], true));
        const groupSEs = groups.map(g => jStat.stdev(groupData[g], true) / Math.sqrt(groupData[g].length));

        // Post-hoc for plot
        const sigPairs = performPostHocTests(groups, groupData, msWithin, dfWithin, method);

        const levenes = calculateLeveneTest(Object.values(groupData));

        mainResultsTable.push({
            depVar,
            overallMean: jStat.mean(allValues),
            overallStd: jStat.stdev(allValues, true),
            groupMeans,
            groupStds,
            dfBetween,
            dfWithin,
            fValue,
            pValue,
            sign: significance,
            etaSquared,
            omegaSquared,
            omegaSquaredNegative,
            levenes // Store Levene's result
        });

        testResults.push({
            varName: depVar,
            groups: groups,
            groupMeans: groupMeans,
            groupSEs: groupSEs,
            ssBetween, df1: dfBetween, msBetween,
            ssWithin, df2: dfWithin, msWithin,
            ssTotal, fValue, pValue, significance, etaSquared,
            sigPairs: sigPairs.map(p => ({
                ...p,
                significance: p.p < 0.01 ? '**' : p.p < 0.05 ? '*' : p.p < 0.1 ? '†' : 'n.s.'
            })),
            method
        });
    });

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['変数', '全体M', '全体S.D', ...groups.map(g => `${g} M`), ...groups.map(g => `${g} S.D`), 'Levene p<br><small>(等分散性)</small>', '群間<br>自由度', '群内<br>自由度', 'F', 'p', 'sign', 'η²', 'ω²'];
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応なし）
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>`;

    mainResultsTable.forEach(res => {
        const levenesPStr = res.levenes.p < 0.001 ? '< .001' : res.levenes.p.toFixed(3);
        const levenesSign = res.levenes.p < 0.05 ? '<i class="fas fa-exclamation-triangle" style="color: #d97706;" title="等分散性が棄却されました。平均値の差の検定には慎重な解釈が必要です（Welchの検定などを検討してください）。"></i>' : '<i class="fas fa-check" style="color: #10b981;" title="等分散性は棄却されませんでした。"></i>';
        const levenesCell = `<td style="background-color: ${res.levenes.p < 0.05 ? '#fff3cd' : 'transparent'}; font-size: 0.9rem;">${levenesPStr} ${levenesSign}</td>`;

        const pValueStr = res.pValue < 0.001 ? '< .001' : res.pValue.toFixed(3);

        const rowData = [res.depVar, res.overallMean, res.overallStd, ...res.groupMeans, ...res.groupStds];
        // Note: We handle Levene's cell specially, then append the rest
        const statsData = [res.dfBetween, res.dfWithin, res.fValue];

        let rowHtml = '<tr>';
        rowHtml += `<td><strong>${res.depVar}</strong></td>`;
        rowHtml += `<td>${res.overallMean.toFixed(2)}</td>`;
        rowHtml += `<td>${res.overallStd.toFixed(2)}</td>`;
        res.groupMeans.forEach(m => rowHtml += `<td>${m.toFixed(2)}</td>`);
        res.groupStds.forEach(s => rowHtml += `<td>${s.toFixed(2)}</td>`);

        rowHtml += levenesCell;

        rowHtml += `<td>${res.dfBetween}</td>`;
        rowHtml += `<td>${res.dfWithin}</td>`;
        rowHtml += `<td>${res.fValue.toFixed(2)}</td>`;
        rowHtml += `<td>${pValueStr}</td>`;
        rowHtml += `<td><strong>${res.sign}</strong></td>`;
        rowHtml += `<td>${res.etaSquared.toFixed(2)}</td>`;
        rowHtml += `<td>${res.omegaSquared.toFixed(3)}${res.omegaSquaredNegative ? ' <small title="算出値が負のため0にクリップしました">※</small>' : ''}</td>`;
        rowHtml += '</tr>';

        tableHtml += rowHtml;
    });
    tableHtml += `</tbody></table></div>
    <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
        <i class="fas fa-info-circle"></i> <strong>Levene p</strong>: 等分散性の検定。p < .05 の場合、この通常のANOVAの結果は信頼性が低い可能性があります（分散が異なるため）。
        ${mainResultsTable.some(r => r.omegaSquaredNegative) ? '<br><strong>ω²</strong>: 算出値が負の場合は0にクリップし、表に※を表示しています。' : ''}
    </div>
    <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p></div>`;
    resultsContainer.innerHTML = tableHtml;

    // 3. Sample Size
    const groupSampleSizes = groups.map((g, i) => {
        const colors = ['#11b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
        return { label: g, count: currentData.filter(row => row[factorVar] === g).length, color: colors[i % colors.length] };
    });
    renderSampleSizeInfo(resultsContainer, currentData.length, groupSampleSizes);

    // 4. Interpretation
    displayANOVAInterpretation(testResults, factorVar, 'independent');

    // 5. Visualization (Detailed tables + plots)
    displayANOVAVisualization(testResults, 'independent');

    document.getElementById('analysis-results').style.display = 'block';
}

function runOneWayRepeatedANOVA(currentData) {
    const dependentVarSelect = document.getElementById('rep-dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);
    const methodSelect = document.getElementById('comparison-method');
    const method = methodSelect ? methodSelect.value : 'tukey';

    if (dependentVars.length < 3) {
        alert('対応あり分散分析には3つ以上の変数（条件）が必要です');
        return;
    }

    document.getElementById('analysis-results').style.display = 'none';

    // 1. Summary Statistics
    displayANOVASummaryStatistics(dependentVars, currentData);

    const validData = currentData.map(row => dependentVars.map(v => row[v])).filter(vals => vals.every(v => v != null && !isNaN(v)));
    const N = validData.length;
    const k = dependentVars.length;

    if (N < 2) {
        alert('有効なデータ（全条件が揃っている行）が不足しています');
        return;
    }

    const grandMean = jStat.mean(validData.flat());
    const ssTotal = jStat.sum(validData.flat().map(v => Math.pow(v - grandMean, 2)));
    const ssSubjects = k * jStat.sum(validData.map(row => Math.pow(jStat.mean(row) - grandMean, 2)));

    const conditionMeans = Array.from({ length: k }, (_, i) => jStat.mean(validData.map(row => row[i])));
    const ssConditions = N * jStat.sum(conditionMeans.map(mean => Math.pow(mean - grandMean, 2)));

    const ssError = ssTotal - ssSubjects - ssConditions;
    const dfConditions = k - 1;
    const dfError = (N - 1) * (k - 1);
    if (dfError <= 0) { alert('誤差の自由度が0以下です。'); return; }

    const msConditions = ssConditions / dfConditions;
    const msError = ssError / dfError;
    const fValue = msConditions / msError;
    const pValue = 1 - jStat.centralF.cdf(fValue, dfConditions, dfError);

    // Greenhouse-Geisser epsilon from covariance matrix (k×k of conditions)
    let ggEpsilon = 1;
    let pValueGG = pValue;
    let dfConditionsGG = dfConditions;
    let dfErrorGG = dfError;
    if (k >= 3 && N >= 2) {
        const cov = Array(k).fill(0).map(() => Array(k).fill(0));
        for (let i = 0; i < k; i++) {
            for (let j = i; j < k; j++) {
                let sum = 0;
                for (let s = 0; s < N; s++) {
                    sum += (validData[s][i] - conditionMeans[i]) * (validData[s][j] - conditionMeans[j]);
                }
                const sij = sum / (N - 1);
                cov[i][j] = sij;
                cov[j][i] = sij;
            }
        }
        const rowMeans = cov.map(row => jStat.mean(row));
        const colMeans = Array(k).fill(0);
        for (let j = 0; j < k; j++) {
            for (let i = 0; i < k; i++) colMeans[j] += cov[i][j];
            colMeans[j] /= k;
        }
        const grandMeanCov = cov.flat().reduce((a, b) => a + b, 0) / (k * k);
        const numGG = Math.pow(rowMeans.reduce((s, m) => s + Math.pow(m - grandMeanCov, 2), 0), 2);
        let denomGG = 0;
        for (let i = 0; i < k; i++) {
            for (let j = 0; j < k; j++) {
                const dev = cov[i][j] - rowMeans[i] - colMeans[j] + grandMeanCov;
                denomGG += dev * dev;
            }
        }
        denomGG *= (k - 1);
        if (denomGG > 0) {
            ggEpsilon = Math.max(1 / (k - 1), Math.min(1, numGG / denomGG));
            dfConditionsGG = ggEpsilon * dfConditions;
            dfErrorGG = ggEpsilon * dfError;
            pValueGG = 1 - jStat.centralF.cdf(fValue, dfConditionsGG, dfErrorGG);
        }
    }

    const etaSquaredPartial = ssConditions / (ssConditions + ssError);
    let omegaSquared = (ssConditions - (dfConditions * msError)) / (ssTotal + msError);
    const omegaSquaredNegativeRep = omegaSquared < 0;
    if (omegaSquared < 0) omegaSquared = 0;
    let significance = pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : pValue < 0.1 ? '†' : 'n.s.';

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['要因', '全体M', '全体S.D', ...dependentVars.map(v => `${v} M`), ...dependentVars.map(v => `${v} S.D`), '条件 df', '誤差 df', 'F', 'p', 'sign', 'ηp²', 'ω²'];
    const conditionStds = dependentVars.map((v, i) => jStat.stdev(validData.map(row => row[i]), true));
    const rowData = [dependentVars.join(' vs '), grandMean, jStat.stdev(validData.flat(), true), ...conditionMeans, ...conditionStds, dfConditions, dfError, fValue, pValue, significance, etaSquaredPartial, omegaSquared];

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応あり）
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody><tr>${rowData.map((d, i) => (i === 0 || i === headers.indexOf('sign')) ? `<td>${d}</td>` : `<td>${typeof d === 'number' ? d.toFixed(2) : d}</td>`).join('')}</tr></tbody>
                </table>
            </div>
            <div style="margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 6px; font-size: 0.9rem;">
                <strong><i class="fas fa-info-circle"></i> Greenhouse–Geisser 補正（球面性が満たされない場合）:</strong><br>
                ε = ${ggEpsilon.toFixed(3)}, 補正後 df（条件）= ${dfConditionsGG.toFixed(2)}, 補正後 df（誤差）= ${dfErrorGG.toFixed(2)}, p（GG補正）= ${pValueGG < 0.001 ? '< .001' : pValueGG.toFixed(3)}.
                ${omegaSquaredNegativeRep ? '<br><strong>ω²</strong>: 算出値が負のため0にクリップして表示しています。' : ''}
            </div>
            <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p>
            
            <div style="margin-top: 2rem;">
                 <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                 <div id="reporting-table-container-anova-rep"></div>
            </div>
        </div>`;
    resultsContainer.innerHTML = tableHtml;

    // Generate APA Source Table for Repeated Measures
    const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
    const rowsAPA = [
        ["Conditions", ssConditions.toFixed(2), dfConditions, msConditions.toFixed(2), fValue.toFixed(2), (pValue < 0.001 ? '< .001' : pValue.toFixed(3)), etaSquaredPartial.toFixed(2)],
        ["Error", ssError.toFixed(2), dfError, msError.toFixed(2), "-", "-", "-"],
        ["Total (excl. subj)", (ssConditions + ssError).toFixed(2), dfConditions + dfError, "-", "-", "-", "-"]
    ];

    const noteAPA = `<em>Note</em>. 上段は球面性仮定下的な結果。Greenhouse–Geisser ε = ${ggEpsilon.toFixed(3)}; 補正後 p = ${pValueGG < 0.001 ? '< .001' : pValueGG.toFixed(3)}.`;

    setTimeout(() => {
        const container = document.getElementById('reporting-table-container-anova-rep');
        if (container)
            container.innerHTML = generateAPATableHtml('anova-rep-apa', 'Table 1. One-Way Repeated Measures ANOVA', headersAPA, rowsAPA, noteAPA);
    }, 0);

    // 3. Sample Size
    renderSampleSizeInfo(resultsContainer, N);

    const conditionSEs = dependentVars.map((v, i) => jStat.stdev(validData.map(row => row[i]), true) / Math.sqrt(N));
    const sigPairs = performRepeatedPostHocTests(dependentVars, currentData, msError, dfError, N, method);

    const testResults = [{
        varName: `条件 (${dependentVars.join(', ')})`,
        groups: dependentVars, groupMeans: conditionMeans, groupSEs: conditionSEs,
        ssBetween: ssConditions, df1: dfConditions, msBetween: msConditions,
        ssWithin: ssError, df2: dfError, msWithin: msError,
        ssTotal: ssConditions + ssError, // Note: This is not the grand total SS
        fValue, pValue, significance, etaSquared: etaSquaredPartial,
        sigPairs: sigPairs.map(p => ({
            ...p,
            significance: p.p < 0.01 ? '**' : p.p < 0.05 ? '*' : p.p < 0.1 ? '†' : 'n.s.'
        })),
        method
    }];

    // 4. Interpretation
    displayANOVAInterpretation(testResults, null, 'repeated');

    // 5. Visualization
    displayANOVAVisualization(testResults, 'repeated');

    document.getElementById('analysis-results').style.display = 'block';
}

function createComparisonMethodSelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return; // Should create container in render if not exists

    // Actually, we inject this into existing UI dynamically or structure it in render.
}

// ----------------------------------------------------------------------
// Main Render
// ----------------------------------------------------------------------
function switchTestType(testType) {
    const indControls = document.getElementById('independent-controls');
    const repControls = document.getElementById('repeated-controls');
    if (testType === 'independent') {
        indControls.style.display = 'block';
        repControls.style.display = 'none';
    } else {
        indControls.style.display = 'none';
        repControls.style.display = 'block';
    }
    document.getElementById('analysis-results').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
    <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 一要因分散分析 (One-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3群以上の平均値の差を検定します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <!-- ... existing content ... -->
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 一元配置分散分析 (One-way ANOVA) とは？</strong>
                        <p>3つ以上のグループがあるときに、その平均値に違いがあるかを一度に調べる方法です。「t検定の3グループ以上版」と考えると分かりやすいです。</p>
                        <img src="image/anova_one.png" alt="分散分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 「1組、2組、3組」のテストの点数を比較したいとき（3グループ）</li>
                        <li><i class="fas fa-check"></i> 「薬A、薬B、薬C、偽薬」の効果を比較したいとき（4グループ）</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>p値 < 0.05:</strong> 「少なくともどれか1つのペアの間には差がある」ことを意味します。</li>
                        <li><strong>多重比較:</strong> 具体的に「どのグループとどのグループが違うのか」は、その後の分析（多重比較）で確認します。</li>
                    </ul>
                </div>
            </div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem;">
                        <label style="flex: 1; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-type" value="independent" checked>
                            <strong>対応なし（独立測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">異なる被験者グループ間を比較</p>
                        </label>
                        <label style="flex: 1; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-type" value="repeated">
                            <strong>対応あり（反復測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">同じ被験者の異なる条件間を比較</p>
                        </label>
                    </div>
                </div>

                <div id="posthoc-method-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <label style="display: block; font-weight: bold; margin-bottom: 0.5rem; color: #4b5563;">
                        <i class="fas fa-tasks"></i> 多重比較の手法:
                    </label>
                    <select id="comparison-method" class="form-select" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #d1d5db;">
                        <option value="tukey" selected>Tukey-Kramer法 (推奨・等分散仮定)</option>
                        <option value="holm">Holm法 (Welch t検定ベース・ロバスト)</option>
                        <option value="bonferroni">Bonferroni法 (Welch t検定ベース)</option>
                    </select>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #6b7280;">
                        ※ <strong>Tukey</strong>はANOVAの前提（等分散）に基づき検出力が高い手法です。
                        <strong>Holm</strong>や<strong>Bonferroni</strong>は、Welchの検定を使用し等分散性が疑われる場合に頑健です。
                    </p>
                </div>

                <div id="independent-controls" style="display: block;">
                    <div id="factor-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-ind-btn-container"></div>
                </div>

                <div id="repeated-controls" style="display: none;">
                    <div id="rep-dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-rep-btn-container"></div>
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

    createVariableSelector('factor-var-container', categoricalColumns, 'factor-var', {
        label: '<i class="fas fa-layer-group"></i> 要因（グループ変数・3群以上）:',
        multiple: false
    });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数可）:',
        multiple: true
    });
    createAnalysisButton('run-ind-btn-container', '分析を実行（対応なし）', () => runOneWayIndependentANOVA(currentData), { id: 'run-ind-anova-btn' });

    createVariableSelector('rep-dependent-var-container', numericColumns, 'rep-dependent-var', {
        label: '<i class="fas fa-list-ol"></i> 比較する変数（条件）を選択（3つ以上）:',
        multiple: true
    });
    createAnalysisButton('run-rep-btn-container', '分析を実行（対応あり）', () => runOneWayRepeatedANOVA(currentData), { id: 'run-rep-anova-btn' });

    document.querySelectorAll('input[name="anova-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            document.querySelectorAll('input[name="anova-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
        });
    });
}