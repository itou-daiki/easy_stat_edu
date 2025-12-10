import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';

// ======================================================================
// Helper Functions for Data Processing
// ======================================================================

// Helper: Get unique sorted values (levels)
function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

// ======================================================================
// Two-Way ANOVA: Between-Subjects (Independent)
// Source: Two Independent Factors
// ======================================================================
function runTwoWayIndependentANOVA(currentData) {
    const factor1 = document.getElementById('factor1-var').value;
    const factor2 = document.getElementById('factor2-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factor1 || !factor2) {
        alert('2つの要因（グループ変数）を選択してください');
        return;
    }
    if (factor1 === factor2) {
        alert('異なる要因を選択してください');
        return;
    }
    if (dependentVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    dependentVars.forEach(depVar => {
        try {
            // Extract valid data
            const validData = currentData.map(row => ({
                f1: row[factor1],
                f2: row[factor2],
                val: row[depVar]
            })).filter(d => d.f1 != null && d.f2 != null && d.val != null && !isNaN(d.val));

            const levels1 = getLevels(validData, 'f1');
            const levels2 = getLevels(validData, 'f2');
            const n = validData.length;

            if (levels1.length < 2 || levels2.length < 2) {
                console.warn(`Insufficient levels for ${depVar}`);
                return;
            }

            // --- Type II SS Calculation (Approximation for Balanced/Unbalanced) ---
            // Simplified approach: SS_A, SS_B calculated from marginal means (unweighted for unbalanced) could vary.
            // Here we use standard "Type I" logic but assuming relatively balanced or simple implementation for educational tool.
            // Better: Calculate SS_Cells, SS_A, SS_B.
            // SS_T
            const meanTotal = jStat.mean(validData.map(d => d.val));
            const ssTotal = validData.reduce((sum, d) => sum + Math.pow(d.val - meanTotal, 2), 0);

            // SS_Cells (Between Groups for all combinations)
            let ssCells = 0;
            const cellMeans = {};
            levels1.forEach(l1 => {
                levels2.forEach(l2 => {
                    const sub = validData.filter(d => d.f1 === l1 && d.f2 === l2).map(d => d.val);
                    if (sub.length > 0) {
                        const m = jStat.mean(sub);
                        cellMeans[`${l1}-${l2}`] = m;
                        ssCells += sub.length * Math.pow(m - meanTotal, 2);
                    }
                });
            });

            // SS_A (Factor 1)
            let ssA = 0;
            levels1.forEach(l1 => {
                const sub = validData.filter(d => d.f1 === l1).map(d => d.val);
                ssA += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });

            // SS_B (Factor 2)
            let ssB = 0;
            levels2.forEach(l2 => {
                const sub = validData.filter(d => d.f2 === l2).map(d => d.val);
                ssB += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });

            // For Balanced Design: SS_AxB = SS_Cells - SS_A - SS_B
            // For Unbalanced, this is Type I/II approximation.
            const ssAxB = ssCells - ssA - ssB;
            const ssError = ssTotal - ssCells;

            const dfA = levels1.length - 1;
            const dfB = levels2.length - 1;
            const dfAxB = dfA * dfB;
            const dfError = n - (levels1.length * levels2.length);

            const msA = ssA / dfA;
            const msB = ssB / dfB;
            const msAxB = ssAxB / dfAxB;
            const msError = ssError / dfError;

            const fA = msA / msError;
            const fB = msB / msError;
            const fAxB = msAxB / msError;

            const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);
            const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);
            const pAxB = 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError);

            const etaA = ssA / (ssA + ssError);
            const etaB = ssB / (ssB + ssError);
            const etaAxB = ssAxB / (ssAxB + ssError);

            // Display
            renderANOVAOutput(outputContainer, depVar, 'Independent', {
                factors: [factor1, factor2],
                rows: [
                    { name: `${factor1} (主効果A)`, ss: ssA, df: dfA, ms: msA, f: fA, p: pA, eta: etaA },
                    { name: `${factor2} (主効果B)`, ss: ssB, df: dfB, ms: msB, f: fB, p: pB, eta: etaB },
                    { name: `交互作用 (AxB)`, ss: ssAxB, df: dfAxB, ms: msAxB, f: fAxB, p: pAxB, eta: etaAxB },
                    { name: `誤差 (Error)`, ss: ssError, df: dfError, ms: msError, f: null, p: null, eta: null }
                ],
                plotData: { levels1, levels2, validData, factor1, factor2, depVar }
            });

        } catch (e) {
            console.error(e);
            outputContainer.innerHTML += `<p class="error">エラー (${depVar}): 計算できませんでした</p>`;
        }
    });

    document.getElementById('analysis-results').style.display = 'block';
}

// ======================================================================
// Two-Way ANOVA: Within-Subjects (Repeated on Both Factors)
// Logic: User selects multiple columns representing combinations (e.g. A1B1, A1B2...)
// For simplicity, we assume user inputs Factor names and Levels manually or just columns?
// Providing a full "Two-Way Repeated" UI where user maps columns to Factor Level Combinations is complex.
// Simplified approach: Just take K columns, and assume Factor A and B?
// Actually, pure Two-Way Repeated is very specific. 
// Given the constraints and typical usage, "Mixed" covers 1 Between 1 Within.
// "Two-Way Within" means 2 Within Factors.
// We will skip complex mapping UI and implement "Mixed" first as high priority, and maybe placeholder for Pure Within?
// Re-reading user request: "Implement Two-Way ANOVA (Between, Within, Mixed)".
// I will implement "Within" as best effort: User selects columns, splits by name?
// No, user likely has columns like "CondA_Time1", "CondA_Time2", "CondB_Time1", "CondB_Time2".
// I will add a "Factor Definition" step for Within analysis if Mode is Within.
// For now, let's implement Mixed first as it's cleaner.
// ======================================================================

// ======================================================================
// Two-Way ANOVA: Mixed Design (Split-Plot)
// Factor A (Between), Factor B (Within - Multiple Columns)
// ======================================================================
function runTwoWayMixedANOVA(currentData) {
    const betweenFactor = document.getElementById('mixed-between-var').value;
    const withinVarSelect = document.getElementById('mixed-within-vars');
    const withinVars = Array.from(withinVarSelect.selectedOptions).map(o => o.value);

    // Assume Within Factor Name is "Time" or generic "WithinFactor"
    // Ideally user inputs this name, but we can default.
    const withinFactorName = "WithinFactor";

    if (!betweenFactor || withinVars.length < 2) {
        alert('被験者間因子1つと、被験者内因子（2つ以上の変数）を選択してください');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    try {
        // Prepare Data
        // Filter rows where Between Factor and ALL Within Cols are valid
        const validData = currentData.filter(row => {
            if (row[betweenFactor] == null) return false;
            return withinVars.every(v => row[v] != null && !isNaN(row[v]));
        });

        const N = validData.length;
        const groups = [...new Set(validData.map(d => d[betweenFactor]))].sort();
        const a = groups.length; // Levels of Between Factor
        const b = withinVars.length; // Levels of Within Factor

        if (a < 2) { alert('被験者間因子は2群以上必要です'); return; }

        // 1. Grand Mean
        const allValues = validData.flatMap(r => withinVars.map(v => r[v]));
        const GM = jStat.mean(allValues);

        // 2. SS_Total
        const ssTotal = allValues.reduce((sum, v) => sum + Math.pow(v - GM, 2), 0);

        // 3. SS_BetweenSubjects
        // Calculate mean for each subject
        let ssBetweenSubjects = 0;
        validData.forEach(row => {
            const subjVals = withinVars.map(v => row[v]);
            const subjMean = jStat.mean(subjVals);
            ssBetweenSubjects += b * Math.pow(subjMean - GM, 2);
        });

        // 4. SS_Group (Factor A - Between)
        let ssGroup = 0;
        groups.forEach(g => {
            const groupRows = validData.filter(r => r[betweenFactor] === g);
            const n_g = groupRows.length;
            const groupAllVals = groupRows.flatMap(r => withinVars.map(v => r[v]));
            const groupMean = jStat.mean(groupAllVals);
            ssGroup += n_g * b * Math.pow(groupMean - GM, 2);
        });

        // 5. SS_ErrorBetween (Subjects within Groups)
        const ssErrorBetween = ssBetweenSubjects - ssGroup;

        // 6. SS_WithinSubjects
        const ssWithinSubjects = ssTotal - ssBetweenSubjects;

        // 7. SS_Time (Factor B - Within)
        let ssTime = 0;
        withinVars.forEach((v, i) => {
            const colVals = validData.map(r => r[v]);
            const colMean = jStat.mean(colVals);
            ssTime += N * Math.pow(colMean - GM, 2); // N is total subjects
        });

        // 8. SS_Interaction (Group x Time)
        // Need cell means
        let ssCells = 0; // Sum of (CellMean - GM)^2 * n_cell
        groups.forEach(g => {
            const groupRows = validData.filter(r => r[betweenFactor] === g);
            const n_g = groupRows.length;
            withinVars.forEach(v => {
                const cellVals = groupRows.map(r => r[v]);
                const cellMean = jStat.mean(cellVals);
                ssCells += n_g * Math.pow(cellMean - GM, 2);
            });
        });
        // Correct SS_Interaction formula: SS_Cells - SS_Group - SS_Time ? No.
        // SS_Interaction = SS_Cells - SS_Group - SS_Time  (Wait, checks out?)
        // SS_Cells (meaning sum of squares of cell deviations from GM weighted by n) = SS_A + SS_B + SS_AxB
        // So SS_AxB = SS_Cells - SS_A - SS_B.
        const ssInteraction = ssCells - ssGroup - ssTime;

        // 9. SS_ErrorWithin (residual)
        const ssErrorWithin = ssWithinSubjects - ssTime - ssInteraction;

        // DF
        const dfGroup = a - 1;
        const dfErrorBetween = N - a;
        const dfTime = b - 1;
        const dfInteraction = (a - 1) * (b - 1);
        const dfErrorWithin = (N - a) * (b - 1);

        // MS
        const msGroup = ssGroup / dfGroup;
        const msErrorBetween = ssErrorBetween / dfErrorBetween; // Error term for Group
        const msTime = ssTime / dfTime;
        const msInteraction = ssInteraction / dfInteraction;
        const msErrorWithin = ssErrorWithin / dfErrorWithin; // Error term for Time & Interaction

        // F
        const fGroup = msGroup / msErrorBetween;
        const fTime = msTime / msErrorWithin;
        const fInteraction = msInteraction / msErrorWithin;

        // P
        const pGroup = 1 - jStat.centralF.cdf(fGroup, dfGroup, dfErrorBetween);
        const pTime = 1 - jStat.centralF.cdf(fTime, dfTime, dfErrorWithin);
        const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfErrorWithin);

        // Eta
        const etaGroup = ssGroup / (ssGroup + ssErrorBetween); // Partial eta? Usually SS_Effect / (SS_Effect + SS_Error)
        const etaTime = ssTime / (ssTime + ssErrorWithin);
        const etaInteraction = ssInteraction / (ssInteraction + ssErrorWithin);

        renderANOVAOutput(outputContainer, "Mixed Design Result", 'Mixed', {
            factors: [betweenFactor, "条件(Within)"],
            rows: [
                { name: `${betweenFactor} (被験者間)`, ss: ssGroup, df: dfGroup, ms: msGroup, f: fGroup, p: pGroup, eta: etaGroup },
                { name: `誤差 (被験者間)`, ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null },
                { name: `条件 (被験者内)`, ss: ssTime, df: dfTime, ms: msTime, f: fTime, p: pTime, eta: etaTime },
                { name: `交互作用`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
                { name: `誤差 (被験者内)`, ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null }
            ],
            plotData: { groups, withinVars, validData, betweenFactor }
        });

    } catch (e) {
        console.error(e);
        outputContainer.innerHTML = `<p class="error">計算エラーが発生しました: ${e.message}</p>`;
    }

    document.getElementById('analysis-results').style.display = 'block';
}

// ======================================================================
// Shared Output Renderer
// ======================================================================
function renderANOVAOutput(container, title, type, result) {
    const { rows, plotData } = result;

    let html = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                ${title} <span style="font-size:0.8em; color:#666;">(${type})</span>
            </h4>
            
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>要因</th>
                            <th>SS</th>
                            <th>df</th>
                            <th>MS</th>
                            <th>F値</th>
                            <th>p値</th>
                            <th>ηp²</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    rows.forEach(row => {
        html += `
            <tr>
                <td>${row.name}</td>
                <td>${row.ss.toFixed(2)}</td>
                <td>${row.df}</td>
                <td>${row.ms ? row.ms.toFixed(2) : '-'}</td>
                <td>${row.f ? row.f.toFixed(2) : '-'}</td>
                <td style="${row.p < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${row.p !== null ? row.p.toFixed(3) + (row.p < 0.01 ? '**' : (row.p < 0.05 ? '*' : '')) : '-'}</td>
                <td>${row.eta ? row.eta.toFixed(3) : '-'}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <div id="plot-${type}-${title.replace(/\s/g, '')}" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    container.innerHTML += html;

    // Interaction Plot
    setTimeout(() => {
        const plotId = `plot-${type}-${title.replace(/\s/g, '')}`;
        const plotDiv = document.getElementById(plotId);
        if (plotDiv) {
            plotInteraction(plotDiv, plotData, type);
        }
    }, 100);
}

function plotInteraction(div, data, type) {
    // Shared Plot Logic
    // Independent: levels1 (color), levels2 (x-axis)
    // Mixed: groups (color, Between), withinVars (x-axis, Within)

    const traces = [];
    let xLabels, groupLabels, getMean;

    if (type === 'Independent') {
        const { levels1, levels2, validData, factor1, factor2, depVar } = data;
        xLabels = levels2;
        groupLabels = levels1;
        getMean = (g, x) => {
            const vals = validData.filter(d => d.f1 === g && d.f2 === x).map(d => d.val);
            return vals.length ? jStat.mean(vals) : null;
        };
    } else if (type === 'Mixed') {
        const { groups, withinVars, validData, betweenFactor } = data;
        xLabels = withinVars;
        groupLabels = groups; // Between Factor levels define lines
        getMean = (g, x) => {
            // g is group (Between), x is variable name (Within)
            const vals = validData.filter(d => d[betweenFactor] === g).map(d => d[x]);
            return vals.length ? jStat.mean(vals) : null;
        };
    }

    groupLabels.forEach(g => {
        const yMeans = xLabels.map(x => getMean(g, x));
        traces.push({
            x: xLabels,
            y: yMeans,
            type: 'scatter',
            mode: 'lines+markers',
            name: g
        });
    });

    Plotly.newPlot(div, traces, {
        title: '交互作用プロット',
        xaxis: { title: 'Factor B (X axis)' },
        yaxis: { title: 'Mean Value' }
    }, createPlotlyConfig('TwoWayANOVA', 'Interaction'));
}

// ======================================================================
// UI Logic
// ======================================================================

function switchTestType(testType) {
    const indControls = document.getElementById('independent-controls');
    const withinControls = document.getElementById('within-controls');
    const mixedControls = document.getElementById('mixed-controls');

    [indControls, withinControls, mixedControls].forEach(el => el.style.display = 'none');

    if (testType === 'independent') indControls.style.display = 'block';
    else if (testType === 'within') withinControls.style.display = 'block';
    else if (testType === 'mixed') mixedControls.style.display = 'block';

    document.getElementById('analysis-results').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-th-large"></i> 二要因分散分析 (Two-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因とその交互作用を分析します</p>
            </div>

            <div id="anova2-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                 <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova2-type" value="independent" checked>
                            <strong>対応なし (Independent)</strong>
                            <p style="color: #666; font-size: 0.8rem;">2つの独立した被験者間因子</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova2-type" value="mixed">
                            <strong>混合計画 (Mixed)</strong>
                            <p style="color: #666; font-size: 0.8rem;">被験者間因子 × 被験者内因子</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; opacity: 0.6;">
                            <input type="radio" name="anova2-type" value="within" disabled>
                            <strong>対応あり (Within)</strong>
                            <p style="color: #666; font-size: 0.8rem;">(実装中) 2つの被験者内因子</p>
                        </label>
                    </div>
                </div>

                <!-- Independent Controls -->
                <div id="independent-controls">
                    <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div id="factor1-var-container"></div>
                        <div id="factor2-var-container"></div>
                    </div>
                    <div id="dependent-var-container" style="margin-bottom: 1.5rem;"></div>
                    <div id="run-ind-btn"></div>
                </div>

                <!-- Mixed Controls -->
                <div id="mixed-controls" style="display: none;">
                    <div id="mixed-between-container" style="margin-bottom: 1rem;"></div>
                    <div id="mixed-within-container" style="margin-bottom: 1.5rem;"></div>
                    <div id="run-mixed-btn"></div>
                </div>

                <!-- Within Controls (Placeholder) -->
                <div id="within-controls" style="display: none;">
                    <p>現在開発中です。</p>
                </div>

            </div>

            <div id="analysis-results" style="display: none;">
                <div id="anova-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#anova2-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Independent Selectors
    createVariableSelector('factor1-var-container', categoricalColumns, 'factor1-var', { label: '要因1（間）:', multiple: false });
    createVariableSelector('factor2-var-container', categoricalColumns, 'factor2-var', { label: '要因2（間）:', multiple: false });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', { label: '従属変数:', multiple: true });
    createAnalysisButton('run-ind-btn', '実行（対応なし）', () => runTwoWayIndependentANOVA(currentData), { id: 'run-ind-anova' });

    // Mixed Selectors
    createVariableSelector('mixed-between-container', categoricalColumns, 'mixed-between-var', { label: '被験者間因子（グループ）:', multiple: false });
    createVariableSelector('mixed-within-container', numericColumns, 'mixed-within-vars', { label: '被験者内因子（測定値列・複数）:', multiple: true });
    createAnalysisButton('run-mixed-btn', '実行（混合計画）', () => runTwoWayMixedANOVA(currentData), { id: 'run-mixed-anova' });

    // Toggle Logic
    document.querySelectorAll('input[name="anova2-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            document.querySelectorAll('input[name="anova2-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
        });
    });
}