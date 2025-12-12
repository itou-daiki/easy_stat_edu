import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, renderSampleSizeInfo, createAxisLabelControl } from '../utils.js';

// Pairwise t-test helper for Between-Subjects (Independent)
function performPostHocTests(groups, groupData) {
    const pairs = [];
    const numGroups = groups.length;
    // Number of comparisons for Bonferroni
    const numComparisons = (numGroups * (numGroups - 1)) / 2;

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
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);
            const var1 = std1 * std1;
            const var2 = std2 * std2;

            // Welch's t-test
            const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
            const t_stat = (mean1 - mean2) / se_welch;

            // Welch-Satterthwaite df
            const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
            const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
            const df = df_num / df_den;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

            // Bonferroni correction
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1, g2,
                p: p_adj,
                mean1, mean2,
                std1, std2,
                n1, n2
            });
        }
    }
    return pairs;
}

// Pairwise t-test helper for Within-Subjects (Repeated)
function performRepeatedPostHocTests(dependentVars, currentData) {
    const pairs = [];
    const numVars = dependentVars.length;
    const numComparisons = (numVars * (numVars - 1)) / 2;

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = dependentVars[i];
            const var2 = dependentVars[j];

            // Extract pairs where both are present
            const validPairs = currentData
                .map(row => ({ v1: row[var1], v2: row[var2] }))
                .filter(p => p.v1 != null && !isNaN(p.v1) && p.v2 != null && !isNaN(p.v2));

            if (validPairs.length < 2) continue;

            const n = validPairs.length;
            const values1 = validPairs.map(p => p.v1);
            const values2 = validPairs.map(p => p.v2);
            const mean1 = jStat.mean(values1);
            const mean2 = jStat.mean(values2);

            // Paired t-test calculation
            const diffs = validPairs.map(p => p.v1 - p.v2);
            const diffMean = jStat.mean(diffs);
            const diffStd = jStat.stdev(diffs, true);
            const se = diffStd / Math.sqrt(n);
            const t_stat = diffMean / se;
            const df = n - 1;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1: var1,
                g2: var2,
                p: p_adj,
                mean1, mean2,
                n
            });
        }
    }
    return pairs;
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
                <i class="fas fa-lightbulb"></i> 解釈の補助
            </h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>`;
    const contentContainer = document.getElementById('interpretation-content');
    let interpretationHtml = '';
    results.forEach(res => {
        let sigText = res.significance === 'n.s.' ? '有意な差が見られませんでした。' : '有意な差が見られました。';
        let factor = testType === 'independent' ? factorVar : '条件';
        interpretationHtml += `
            <p style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #1e90ff; border-radius: 4px;">
                <strong style="color: #1e90ff;">${res.varName}</strong>について、<strong>${factor}</strong>によって${sigText}
                <span style="color: #6b7280;">(F(${res.df1}, ${res.df2}) = ${res.fValue.toFixed(2)}, p = ${res.pValue.toFixed(3)}, η² = ${res.etaSquared.toFixed(2)})</span>
            </p>`;
    });
    contentContainer.innerHTML = interpretationHtml;
}

function displayANOVAVisualization(results, testType) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <div id="visualization-plots"></div>
        </div>`;
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
        const layout = {
            title: `${res.varName} のグループ別平均値 (Bar + SE)`,
            yaxis: { title: res.varName },
            shapes: res.plotShapes,
            annotations: res.plotAnnotations,
            margin: { t: res.plotMarginTop }
        };

        // 軸ラベルの表示切り替え
        const showAxisLabels = document.getElementById('show-axis-labels').checked;
        if (!showAxisLabels) {
            layout.yaxis.title = '';
            // xaxis title is already undefined/empty by default but let's be explicit if needed
            // layout.xaxis.title = ''; 
        }

        Plotly.newPlot(plotId, [trace], layout, createPlotlyConfig(`一要因分散分析: ${res.varName}`, res.varName));
    });
}

function generateBracketsForPlot(sigPairs, groupNames, groupMeans, groupSEs) {
    const shapes = [];
    const annotations = [];
    if (sigPairs.length === 0) return { shapes, annotations, topMargin: 60 };

    const maxVal = Math.max(...groupMeans.map((m, i) => m + groupSEs[i]));
    const yOffset = maxVal * 0.15; // Initial gap above bars
    const step = maxVal * 0.15; // Step size between bracket levels
    let currentLevelY = maxVal + yOffset;

    const levels = [];

    // Sort by distance (shorter brackets first) for better stacking visuals
    sigPairs.sort((a, b) => {
        const distA = Math.abs(groupNames.indexOf(a.g1) - groupNames.indexOf(a.g2));
        const distB = Math.abs(groupNames.indexOf(b.g1) - groupNames.indexOf(b.g2));
        return distA - distB;
    });

    sigPairs.forEach(pair => {
        if (pair.p >= 0.1) return;

        const idx1 = groupNames.indexOf(pair.g1);
        const idx2 = groupNames.indexOf(pair.g2);
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);

        // Find available level
        let levelIndex = 0;
        while (true) {
            if (!levels[levelIndex]) levels[levelIndex] = [];
            const overlap = levels[levelIndex].some(interval => (start < interval.end + 0.5) && (end > interval.start - 0.5));
            if (!overlap) break;
            levelIndex++;
        }
        levels[levelIndex].push({ start, end });

        const bracketY = currentLevelY + (levelIndex * step);
        const legHeight = step * 0.3; // Length of the vertical legs

        let text;
        if (pair.p < 0.01) text = 'p < 0.01 **';
        else if (pair.p < 0.05) text = 'p < 0.05 *';
        else text = 'p < 0.1 †';

        // Draw Bracket
        // Horizontal line
        shapes.push({
            type: 'line',
            x0: idx1, y0: bracketY,
            x1: idx2, y1: bracketY,
            line: { color: 'black', width: 2 }
        });
        // Left leg
        shapes.push({
            type: 'line',
            x0: idx1, y0: bracketY - legHeight,
            x1: idx1, y1: bracketY,
            line: { color: 'black', width: 2 }
        });
        // Right leg
        shapes.push({
            type: 'line',
            x0: idx2, y0: bracketY - legHeight,
            x1: idx2, y1: bracketY,
            line: { color: 'black', width: 2 }
        });

        // Annotation
        annotations.push({
            x: (idx1 + idx2) / 2,
            y: bracketY + step * 0.2, // Slightly above the bracket
            text: text,
            showarrow: false,
            font: { size: 14, color: 'black', weight: 'bold' }
        });
    });

    const topMargin = 60 + (levels.length * 50); // Increase margin for taller stack
    return { shapes, annotations, topMargin };
}

// ----------------------------------------------------------------------
// Main Analysis Functions
// ----------------------------------------------------------------------

function runOneWayIndependentANOVA(currentData) {
    const factorVar = document.getElementById('factor-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factorVar || dependentVars.length === 0) {
        alert('要因（グループ変数）と従属変数を1つ以上選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null).sort();
    if (groups.length < 3) {
        alert(`一要因分散分析（対応なし）には3群以上必要です（現在: ${groups.length} 群）`);
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
        const omegaSquared = (ssBetween - (dfBetween * msWithin)) / (ssTotal + msWithin);

        let significance = 'n.s.';
        if (pValue < 0.01) significance = '**';
        else if (pValue < 0.05) significance = '*';
        else if (pValue < 0.1) significance = '†';

        const groupMeans = groups.map(g => jStat.mean(groupData[g]));
        const groupStds = groups.map(g => jStat.stdev(groupData[g], true));
        const groupSEs = groups.map(g => jStat.stdev(groupData[g], true) / Math.sqrt(groupData[g].length));

        // Post-hoc for plot
        const sigPairs = performPostHocTests(groups, groupData);
        const { shapes, annotations, topMargin } = generateBracketsForPlot(sigPairs, groups, groupMeans, groupSEs);

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
            omegaSquared
        });

        testResults.push({
            varName: depVar,
            groups: groups,
            groupMeans: groupMeans,
            groupSEs: groupSEs,
            ssBetween, df1: dfBetween, msBetween,
            ssWithin, df2: dfWithin, msWithin,
            ssTotal, fValue, pValue, significance, etaSquared,
            plotShapes: shapes,
            plotAnnotations: annotations,
            plotMarginTop: topMargin
        });
    });

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['変数', '全体M', '全体S.D', ...groups.map(g => `${g} M`), ...groups.map(g => `${g} S.D`), '群間<br>自由度', '群内<br>自由度', 'F', 'p', 'sign', 'η²', 'ω²'];
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
        const rowData = [res.depVar, res.overallMean, res.overallStd, ...res.groupMeans, ...res.groupStds, res.dfBetween, res.dfWithin, res.fValue, res.pValue, res.sign, res.etaSquared, res.omegaSquared];
        tableHtml += `<tr>${rowData.map((d, i) => (i === 0 || i === headers.indexOf('sign')) ? `<td>${d}</td>` : `<td>${d.toFixed(2)}</td>`).join('')}</tr>`;
    });
    tableHtml += `</tbody></table></div><p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p></div>`;
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

    const etaSquaredPartial = ssConditions / (ssConditions + ssError);
    const omegaSquared = (ssConditions - (dfConditions * msError)) / (ssTotal + msError);
    let significance = pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : pValue < 0.1 ? '†' : 'n.s.';

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['要因', '全体M', '全体S.D', ...dependentVars.map(v => `${v} M`), ...dependentVars.map(v => `${v} S.D`), '条件<br>自由度', '誤差<br>自由度', 'F', 'p', 'sign', 'ηp²', 'ω²'];
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
                    <tbody><tr>${rowData.map((d, i) => (i === 0 || i === headers.indexOf('sign')) ? `<td>${d}</td>` : `<td>${d.toFixed(2)}</td>`).join('')}</tr></tbody>
                </table>
            </div>
            <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p>
        </div>`;
    resultsContainer.innerHTML = tableHtml;

    // 3. Sample Size
    renderSampleSizeInfo(resultsContainer, N);

    const conditionSEs = dependentVars.map((v, i) => jStat.stdev(validData.map(row => row[i]), true) / Math.sqrt(N));
    const sigPairs = performRepeatedPostHocTests(dependentVars, currentData);
    const { shapes, annotations, topMargin } = generateBracketsForPlot(sigPairs, dependentVars, conditionMeans, conditionSEs);

    const testResults = [{
        varName: `条件 (${dependentVars.join(', ')})`,
        groups: dependentVars, groupMeans: conditionMeans, groupSEs: conditionSEs,
        ssBetween: ssConditions, df1: dfConditions, msBetween: msConditions,
        ssWithin: ssError, df2: dfError, msWithin: msError,
        ssTotal: ssConditions + ssError, // Note: This is not the grand total SS
        fValue, pValue, significance, etaSquared: etaSquaredPartial,
        plotShapes: shapes, plotAnnotations: annotations, plotMarginTop: topMargin
    }];

    // 4. Interpretation
    displayANOVAInterpretation(testResults, null, 'repeated');

    // 5. Visualization
    displayANOVAVisualization(testResults, 'repeated');

    document.getElementById('analysis-results').style.display = 'block';
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
                        <strong><i class="fas fa-lightbulb"></i> 一要因分散分析とは？</strong>
                        <p>3つ以上のグループ（群）または条件間で平均値に差があるかを調べます。</p>
                        <p>例：クラスA、B、Cでテストの平均点に差があるか？</p>
                    </div>
                </div>
            </div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <!-- 軸ラベル表示オプション -->
                <div id="axis-label-control-container"></div>
                
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

    // 軸ラベル表示オプションの追加
    createAxisLabelControl('axis-label-control-container');

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