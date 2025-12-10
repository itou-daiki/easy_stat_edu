import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, renderSampleSizeInfo } from '../utils.js';

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
// One-Way ANOVA (Between-Subjects)
// ----------------------------------------------------------------------
function runOneWayIndependentANOVA(currentData) {
    const factorVar = document.getElementById('factor-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factorVar) {
        alert('要因（グループ変数）を選択してください');
        return;
    }
    if (dependentVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null).sort();
    if (groups.length < 3) {
        alert(`一要因分散分析（対応なし）には3群以上必要です（現在: ${groups.length} 群）`);
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    dependentVars.forEach(depVar => {
        // データ抽出
        const groupData = {};
        let totalN = 0;
        groups.forEach(g => {
            groupData[g] = currentData
                .filter(row => row[factorVar] === g)
                .map(row => row[depVar])
                .filter(v => v != null && !isNaN(v));
            totalN += groupData[g].length;
        });

        // ANOVA計算
        const allValues = currentData.map(r => r[depVar]).filter(v => v != null && !isNaN(v));
        const grandMean = jStat.mean(allValues);

        let ssBetween = 0;
        let ssWithin = 0;
        let dfBetween = groups.length - 1;
        let dfWithin = totalN - groups.length;

        groups.forEach(g => {
            const vals = groupData[g];
            const n = vals.length;
            const mean = jStat.mean(vals);
            if (n > 0) {
                ssBetween += n * Math.pow(mean - grandMean, 2);
                ssWithin += vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
            }
        });

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fValue = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);
        const etaSquared = ssBetween / (ssBetween + ssWithin);

        // UI Generation
        const sectionId = `anova-ind-${depVar}`;
        const varResultDiv = document.createElement('div');
        varResultDiv.className = 'anova-result-block';

        let html = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                    変数: ${depVar}
                </h4>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>変動要因</th>
                                <th>平方和 (SS)</th>
                                <th>自由度 (df)</th>
                                <th>平均平方 (MS)</th>
                                <th>F値</th>
                                <th>p値</th>
                                <th>効果量 (η²)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>要因間 (Between)</td>
                                <td>${ssBetween.toFixed(2)}</td>
                                <td>${dfBetween}</td>
                                <td>${msBetween.toFixed(2)}</td>
                                <td>${fValue.toFixed(2)}</td>
                                <td style="${pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pValue.toFixed(3)} ${pValue < 0.01 ? '**' : (pValue < 0.05 ? '*' : '')}</td>
                                <td>${etaSquared.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>要因内 (Error)</td>
                                <td>${ssWithin.toFixed(2)}</td>
                                <td>${dfWithin}</td>
                                <td>${msWithin.toFixed(2)}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td>合計 (Total)</td>
                                <td>${(ssBetween + ssWithin).toFixed(2)}</td>
                                <td>${dfBetween + dfWithin}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="sample-size-${sectionId}"></div>
                <div id="plot-${sectionId}" style="margin-top: 1.5rem;"></div>
            </div>
        `;
        varResultDiv.innerHTML = html;
        outputContainer.appendChild(varResultDiv);

        // Sample Size Info
        const groupSampleSizes = groups.map((g, i) => {
            const colors = ['#11b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
            return {
                label: g,
                count: groupData[g].length,
                color: colors[i % colors.length]
            };
        });
        renderSampleSizeInfo(document.getElementById(`sample-size-${sectionId}`), totalN, groupSampleSizes);

        // Plotly Visualization (Async)
        setTimeout(() => {
            const plotDiv = document.getElementById(`plot-${sectionId}`);
            if (plotDiv) {
                const currentGroupData = {};
                groups.forEach(g => {
                    currentGroupData[g] = currentData
                        .filter(row => row[factorVar] === g)
                        .map(row => row[depVar])
                        .filter(v => v != null && !isNaN(v));
                });

                const sigPairs = performPostHocTests(groups, currentGroupData);

                // Determine Y range for brackets
                let globalMaxY = -Infinity;
                Object.values(currentGroupData).flat().forEach(v => { if (v > globalMaxY) globalMaxY = v; });
                const yRange = globalMaxY - jStat.min(Object.values(currentGroupData).flat());
                const step = (yRange || 1) * 0.1;
                let currentLevelY = globalMaxY + step * 0.5;

                const levels = [];
                const shapesFinal = [];
                const annotationsFinal = [];

                sigPairs.forEach(pair => {
                    if (pair.p >= 0.1) return;

                    const idx1 = groups.indexOf(pair.g1);
                    const idx2 = groups.indexOf(pair.g2);
                    const start = Math.min(idx1, idx2);
                    const end = Math.max(idx1, idx2);

                    let levelIndex = 0;
                    while (true) {
                        if (!levels[levelIndex]) levels[levelIndex] = [];
                        const overlap = levels[levelIndex].some(interval => (start < interval.end + 0.1) && (end > interval.start - 0.1));
                        if (!overlap) break;
                        levelIndex++;
                    }
                    levels[levelIndex].push({ start, end });

                    const bracketY = currentLevelY + (levelIndex * step);
                    let text = 'n.s.';
                    if (pair.p < 0.01) text = '**';
                    else if (pair.p < 0.05) text = '*';
                    else if (pair.p < 0.1) text = '†';

                    // Bracket Lines
                    shapesFinal.push({ type: 'line', x0: idx1, y0: bracketY - step * 0.1, x1: idx1, y1: bracketY, line: { color: 'black', width: 1 } });
                    shapesFinal.push({ type: 'line', x0: idx1, y0: bracketY, x1: idx2, y1: bracketY, line: { color: 'black', width: 1 } });
                    shapesFinal.push({ type: 'line', x0: idx2, y0: bracketY, x1: idx2, y1: bracketY - step * 0.1, line: { color: 'black', width: 1 } });

                    annotationsFinal.push({
                        x: (idx1 + idx2) / 2,
                        y: bracketY + step * 0.2,
                        text: text,
                        showarrow: false,
                        font: { size: 12, color: 'black' }
                    });
                });

                const traces = groups.map((g, i) => ({
                    y: currentGroupData[g],
                    type: 'box',
                    name: g,
                    boxpoints: 'outliers',
                    marker: { color: '#1e90ff' },
                    x: currentGroupData[g].map(() => i), // Force numeric X for easy bracket placement
                    showlegend: false
                }));

                const topMargin = 50 + (levels.length * 30);

                Plotly.newPlot(plotDiv, traces, {
                    title: `${depVar} のグループ別箱ひげ図`,
                    yaxis: { title: depVar },
                    xaxis: {
                        tickvals: groups.map((_, i) => i),
                        ticktext: groups
                    },
                    showlegend: false,
                    shapes: shapesFinal,
                    annotations: annotationsFinal,
                    margin: { t: topMargin }
                }, createPlotlyConfig('一要因分散分析', depVar));
            }
        }, 100);
    });

    document.getElementById('analysis-results').style.display = 'block';
}


// ----------------------------------------------------------------------
// One-Way Repeated Measures ANOVA (Within-Subjects)
// ----------------------------------------------------------------------
function runOneWayRepeatedANOVA(currentData) {
    const dependentVarSelect = document.getElementById('rep-dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (dependentVars.length < 3) {
        alert('対応あり分散分析には3つ以上の変数（条件）が必要です');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    // Calculate ANOVA for the selected set of variables
    // Data preparation: extract valid rows where all selected vars are present (complete cases)
    const validData = currentData
        .map(row => dependentVars.map(v => row[v]))
        .filter(vals => vals.every(v => v != null && !isNaN(v)));

    const N = validData.length;
    const k = dependentVars.length;

    if (N < 2) {
        alert('有効なデータ（全条件が揃っている行）が不足しています');
        return;
    }

    // Calculations
    const grandMean = jStat.mean(validData.flat());

    // SS_Total
    let ssTotal = 0;
    validData.flat().forEach(v => ssTotal += Math.pow(v - grandMean, 2));

    // SS_Subjects (Between Subjects)
    let ssSubjects = 0;
    validData.forEach(subjectVals => {
        const subjectMean = jStat.mean(subjectVals);
        ssSubjects += k * Math.pow(subjectMean - grandMean, 2);
    });

    // SS_Conditions (Between Treatments / Time)
    let ssConditions = 0;
    const conditionMeans = [];
    for (let i = 0; i < k; i++) {
        const colVals = validData.map(row => row[i]);
        const colMean = jStat.mean(colVals);
        conditionMeans.push(colMean);
        ssConditions += N * Math.pow(colMean - grandMean, 2);
    }

    // SS_Error (Residual)
    // SS_Total = SS_Subjects + SS_Conditions + SS_Error
    const ssError = ssTotal - ssSubjects - ssConditions;

    // Degrees of Freedom
    const dfSubjects = N - 1;
    const dfConditions = k - 1;
    const dfError = (N - 1) * (k - 1);
    const dfTotal = (N * k) - 1;

    // Mean Squares
    const msConditions = ssConditions / dfConditions;
    const msError = ssError / dfError;

    // F-statistic
    const fValue = msConditions / msError;

    // P-value
    const pValue = 1 - jStat.centralF.cdf(fValue, dfConditions, dfError);

    // Effect Size (Partial Eta Squared)
    // For Repeated Measures, eta_partial = SS_Conditions / (SS_Conditions + SS_Error)
    const etaSquared = ssConditions / (ssConditions + ssError);

    // UI Generation
    const resultDiv = document.createElement('div');
    resultDiv.className = 'anova-result-block';

    let html = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                要因: ${dependentVars.join(', ')}
            </h4>
            
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>変動要因</th>
                            <th>平方和 (SS)</th>
                            <th>自由度 (df)</th>
                            <th>平均平方 (MS)</th>
                            <th>F値</th>
                            <th>p値</th>
                            <th>効果量 (ηp²)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>条件間 (Time)</td>
                            <td>${ssConditions.toFixed(2)}</td>
                            <td>${dfConditions}</td>
                            <td>${msConditions.toFixed(2)}</td>
                            <td>${fValue.toFixed(2)}</td>
                            <td style="${pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pValue.toFixed(3)} ${pValue < 0.01 ? '**' : (pValue < 0.05 ? '*' : '')}</td>
                            <td>${etaSquared.toFixed(3)}</td>
                        </tr>
                        <tr>
                            <td>誤差 (Error)</td>
                            <td>${ssError.toFixed(2)}</td>
                            <td>${dfError}</td>
                            <td>${msError.toFixed(2)}</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                        <tr>
                            <td>被験者間 (Subjects)</td>
                            <td>${ssSubjects.toFixed(2)}</td>
                            <td>${dfSubjects}</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                        <tr style="background: #f8f9fa; font-weight: bold;">
                            <td>合計 (Total)</td>
                            <td>${ssTotal.toFixed(2)}</td>
                            <td>${dfTotal}</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div id="sample-size-rep"></div>
            <div id="plot-rep" style="margin-top: 1.5rem;"></div>
        </div>
    `;
    resultDiv.innerHTML = html;
    outputContainer.appendChild(resultDiv);

    // Sample Size Info
    renderSampleSizeInfo(document.getElementById('sample-size-rep'), N);

    // Visualization
    setTimeout(() => {
        const plotDiv = document.getElementById('plot-rep');
        if (plotDiv) {
            // Post-hoc Tests
            const sigPairs = performRepeatedPostHocTests(dependentVars, currentData);

            // Brackets Logic (Generic Reuse)
            // Use numeric X axis for categories
            const xLabels = dependentVars;

            // Plot Traces (Bar chart often used for repeated measures means, but box plot shows distribution better)
            // Let's use Box Plot for consistency and info density.
            const traces = dependentVars.map((v, i) => {
                const vals = validData.map(row => row[i]);
                return {
                    y: vals,
                    type: 'box',
                    name: v,
                    boxpoints: 'outliers',
                    marker: { color: '#1e90ff' },
                    x: vals.map(() => i),
                    showlegend: false
                };
            });

            // Calculate Brackets
            let globalMaxY = -Infinity;
            validData.flat().forEach(v => { if (v > globalMaxY) globalMaxY = v; });
            const yRange = globalMaxY - jStat.min(validData.flat());
            const step = (yRange || 1) * 0.1;
            let currentLevelY = globalMaxY + step * 0.5;

            const levels = [];
            const shapesFinal = [];
            const annotationsFinal = [];

            sigPairs.forEach(pair => {
                if (pair.p >= 0.1) return;

                const idx1 = dependentVars.indexOf(pair.g1);
                const idx2 = dependentVars.indexOf(pair.g2);
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);

                let levelIndex = 0;
                while (true) {
                    if (!levels[levelIndex]) levels[levelIndex] = [];
                    const overlap = levels[levelIndex].some(interval => (start < interval.end + 0.1) && (end > interval.start - 0.1));
                    if (!overlap) break;
                    levelIndex++;
                }
                levels[levelIndex].push({ start, end });

                const bracketY = currentLevelY + (levelIndex * step);
                let text = 'n.s.';
                if (pair.p < 0.01) text = '**';
                else if (pair.p < 0.05) text = '*';
                else if (pair.p < 0.1) text = '†';

                shapesFinal.push({ type: 'line', x0: idx1, y0: bracketY - step * 0.1, x1: idx1, y1: bracketY, line: { color: 'black', width: 1 } });
                shapesFinal.push({ type: 'line', x0: idx1, y0: bracketY, x1: idx2, y1: bracketY, line: { color: 'black', width: 1 } });
                shapesFinal.push({ type: 'line', x0: idx2, y0: bracketY, x1: idx2, y1: bracketY - step * 0.1, line: { color: 'black', width: 1 } });

                annotationsFinal.push({
                    x: (idx1 + idx2) / 2,
                    y: bracketY + step * 0.2,
                    text: text,
                    showarrow: false,
                    font: { size: 12, color: 'black' }
                });
            });

            const topMargin = 50 + (levels.length * 30);

            Plotly.newPlot(plotDiv, traces, {
                title: '条件ごとの比較（対応あり）',
                yaxis: { title: '値' },
                xaxis: {
                    tickvals: dependentVars.map((_, i) => i),
                    ticktext: dependentVars
                },
                showlegend: false,
                shapes: shapesFinal,
                annotations: annotationsFinal,
                margin: { t: topMargin }
            }, createPlotlyConfig('一要因分散分析（対応あり）', 'Repeated'));
        }
    }, 100);

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

            <!-- 分析の概要 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 一要因分散分析とは？</strong>
                        <p>3つ以上のグループ（群）または条件間で平均値に差があるかを調べます。</p>
                    </div>
                </div>
            </div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 設定エリア -->
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

                <!-- 対応なし用の設定 -->
                <div id="independent-controls" style="display: block;">
                    <div id="factor-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-ind-btn-container"></div>
                </div>

                <!-- 対応あり用の設定 -->
                <div id="repeated-controls" style="display: none;">
                    <div id="rep-dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-rep-btn-container"></div>
                </div>
            </div>

            <div id="analysis-results" style="display: none;">
                <div id="anova-results"></div>
            </div>
    </div>
    `;

    renderDataOverview('#anova-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Independent Selectors
    createVariableSelector('factor-var-container', categoricalColumns, 'factor-var', {
        label: '<i class="fas fa-layer-group"></i> 要因（グループ変数・3群以上）:',
        multiple: false
    });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数可）:',
        multiple: true
    });
    createAnalysisButton('run-ind-btn-container', '分析を実行（対応なし）', () => runOneWayIndependentANOVA(currentData), { id: 'run-ind-anova-btn' });

    // Repeated Selectors
    createVariableSelector('rep-dependent-var-container', numericColumns, 'rep-dependent-var', {
        label: '<i class="fas fa-list-ol"></i> 比較する変数（条件）を選択（3つ以上）:',
        multiple: true
    });
    createAnalysisButton('run-rep-btn-container', '分析を実行（対応あり）', () => runOneWayRepeatedANOVA(currentData), { id: 'run-rep-anova-btn' });

    // Toggle Logic
    document.querySelectorAll('input[name="anova-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            // Visual toggle of active state style
            document.querySelectorAll('input[name="anova-type"]').forEach(r => {
                r.closest('label').style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                r.closest('label').style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
        });
    });
}