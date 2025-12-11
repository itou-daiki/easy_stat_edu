import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';

// ======================================================================
// Helper Functions
// ======================================================================

function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

function displayTwoWayANOVASummaryStatistics(variables, currentData) {
    const container = document.getElementById('summary-stats-section');
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 選択した従属変数に関する要約統計量
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr><th>変数名</th><th>有効N</th><th>平均値</th><th>中央値</th><th>標準偏差</th></tr>
                    </thead>
                    <tbody>`;
    variables.forEach(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            tableHtml += `
                <tr>
                    <td style="font-weight: bold;">${varName}</td>
                    <td>${values.length}</td>
                    <td>${jstat.mean().toFixed(2)}</td>
                    <td>${jstat.median().toFixed(2)}</td>
                    <td>${jstat.stdev(true).toFixed(2)}</td>
                </tr>`;
        }
    });
    tableHtml += `</tbody></table></div></div>`;
    container.innerHTML = tableHtml;
}

function displayTwoWayANOVAInterpretation(results) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-lightbulb"></i> 解釈の補助</h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>`;
    const contentContainer = document.getElementById('interpretation-content');
    let interpretationHtml = '';
    results.forEach(res => {
        interpretationHtml += `<div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
            <strong style="color: #1e90ff; font-size: 1.1em;">${res.depVar}</strong><br>
            <ul style="margin: 0.5rem 0 0 1rem; padding: 0; list-style-type: none;">
                <li style="margin-bottom: 0.25rem;"><strong>交互作用 (${res.factor1} × ${res.factor2}):</strong> ${res.pAxB < 0.05 ? `<span style="color: red; font-weight: bold;">有意な差が見られました (p=${res.pAxB.toFixed(3)})。</span>` : `有意な差は見られませんでした (p=${res.pAxB.toFixed(3)})。`}</li>
                <li style="margin-bottom: 0.25rem;"><strong>主効果 (${res.factor1}):</strong> ${res.pA < 0.05 ? `有意な差が見られました (p=${res.pA.toFixed(3)})。` : `有意な差は見られませんでした (p=${res.pA.toFixed(3)})。`}</li>
                <li style="margin-bottom: 0.25rem;"><strong>主効果 (${res.factor2}):</strong> ${res.pB < 0.05 ? `有意な差が見られました (p=${res.pB.toFixed(3)})。` : `有意な差は見られませんでした (p=${res.pB.toFixed(3)})。`}</li>
            </ul>
        </div>`;
    });
    contentContainer.innerHTML = interpretationHtml;
}

function displayTwoWayANOVAVisualization(results) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-chart-bar"></i> 可視化</h4>
            <div id="visualization-plots"></div>
        </div>`;
    const plotsContainer = document.getElementById('visualization-plots');
    plotsContainer.innerHTML = ''; // Clear previous plots
    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        let plotHtml = `
            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #eee;">
                <h5 style="color: #2d3748;">${res.depVar}</h5>
                <div class="table-container" style="margin-bottom: 1rem;">
                    <table class="table">
                        <thead><tr><th>要因</th><th>平方和(SS)</th><th>自由度(df)</th><th>平均平方(MS)</th><th>F値</th><th>p値</th><th>ηp²</th></tr></thead>
                        <tbody>
                            <tr><td>${res.factor1}</td><td>${res.ssA.toFixed(2)}</td><td>${res.dfA}</td><td>${res.msA.toFixed(2)}</td><td>${res.fA.toFixed(2)}</td><td ${res.pA < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pA.toFixed(3)}</td><td>${res.etaA.toFixed(3)}</td></tr>
                            <tr><td>${res.factor2}</td><td>${res.ssB.toFixed(2)}</td><td>${res.dfB}</td><td>${res.msB.toFixed(2)}</td><td>${res.fB.toFixed(2)}</td><td ${res.pB < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pB.toFixed(3)}</td><td>${res.etaB.toFixed(3)}</td></tr>
                            <tr><td>${res.factor1} × ${res.factor2}</td><td>${res.ssAxB.toFixed(2)}</td><td>${res.dfAxB}</td><td>${res.msAxB.toFixed(2)}</td><td>${res.fAxB.toFixed(2)}</td><td ${res.pAxB < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pAxB.toFixed(3)}</td><td>${res.etaAxB.toFixed(3)}</td></tr>
                            <tr><td>誤差</td><td>${res.ssError.toFixed(2)}</td><td>${res.dfError}</td><td>${res.msError.toFixed(2)}</td><td>-</td><td>-</td><td>-</td></tr>
                        </tbody>
                    </table>
                </div>
                <div id="${plotId}" class="plot-container"></div>
            </div>`;
        plotsContainer.innerHTML += plotHtml;
        
        setTimeout(() => {
            const plotDiv = document.getElementById(plotId);
            if(plotDiv) {
                const traces = [];
                res.levels2.forEach((l2, i) => {
                    const x = res.levels1;
                    const y = x.map(l1 => res.cellMeans[l1][l2].mean);
                    traces.push({
                        x: x,
                        y: y,
                        mode: 'lines+markers',
                        name: l2,
                        type: 'scatter'
                    });
                });
                Plotly.newPlot(plotDiv, traces, {
                    title: `交互作用プロット: ${res.depVar}`,
                    xaxis: { title: res.factor1 },
                    yaxis: { title: res.depVar, rangemode: 'tozero' },
                    legend: { title: { text: res.factor2 } }
                }, createPlotlyConfig('二要因分散分析', res.depVar));
            }
        }, 100);
    });
}

// ======================================================================
// Main Analysis Functions
// ======================================================================

function runTwoWayIndependentANOVA(currentData) {
    const factor1 = document.getElementById('factor1-var').value;
    const factor2 = document.getElementById('factor2-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factor1 || !factor2 || factor1 === factor2 || dependentVars.length === 0) {
        alert('異なる2つの要因と、1つ以上の従属変数を選択してください。');
        return;
    }
    
    document.getElementById('analysis-results').style.display = 'none';
    displayTwoWayANOVASummaryStatistics(dependentVars, currentData);

    const testResults = [];
    const mainResultsTable = [];

    dependentVars.forEach(depVar => {
        const validData = currentData.filter(d => d[factor1] != null && d[factor2] != null && d[depVar] != null && !isNaN(d[depVar]));
        const n = validData.length;
        const levels1 = getLevels(validData, factor1);
        const levels2 = getLevels(validData, factor2);
        if (levels1.length < 2 || levels2.length < 2) return;

        const grandMean = jStat.mean(validData.map(d => d[depVar]));
        const ssTotal = jStat.sum(validData.map(d => Math.pow(d[depVar] - grandMean, 2)));
        
        const cellMeans = {};
        let ssCells = 0;
        levels1.forEach(l1 => {
            cellMeans[l1] = {};
            levels2.forEach(l2 => {
                const cellData = validData.filter(d => d[factor1] === l1 && d[factor2] === l2).map(d => d[depVar]);
                const mean = cellData.length > 0 ? jStat.mean(cellData) : 0;
                cellMeans[l1][l2] = { mean, n: cellData.length };
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

        if (dfA <= 0 || dfB <= 0 || dfAxB < 0 || dfError <= 0) return;

        const msA = ssA / dfA;
        const msB = ssB / dfB;
        const msAxB = ssAxB / dfAxB;
        const msError = ssError / dfError;

        const fA = msA / msError;
        const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);
        const etaA = ssA / (ssA + ssError);

        const fB = msB / msError;
        const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);
        const etaB = ssB / (ssB + ssError);

        const fAxB = msAxB / msError;
        const pAxB = 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError);
        const etaAxB = ssAxB / (ssAxB + ssError);
        
        const result = {
            depVar, factor1, factor2, levels1, levels2,
            pA, pB, pAxB, fA, fB, fAxB,
            ssA, dfA, msA, etaA,
            ssB, dfB, msB, etaB,
            ssAxB, dfAxB, msAxB, etaAxB,
            ssError, dfError, msError,
            cellMeans
        };
        testResults.push(result);
        mainResultsTable.push(result);
    });

    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['変数', `F(${factor1})`, `p(${factor1})`, `F(${factor2})`, `p(${factor2})`, `F(交互作用)`, `p(交互作用)`];
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-calculator"></i> 検定結果の要約</h4>
            <div class="table-container"><table class="table">
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>`;
    mainResultsTable.forEach(res => {
        tableHtml += `<tr>
            <td style="font-weight: bold;">${res.depVar}</td>
            <td>${res.fA.toFixed(2)}</td><td ${res.pA < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pA.toFixed(3)}</td>
            <td>${res.fB.toFixed(2)}</td><td ${res.pB < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pB.toFixed(3)}</td>
            <td>${res.fAxB.toFixed(2)}</td><td ${res.pAxB < 0.05 ? 'style="color:red; font-weight:bold;"' : ''}>${res.pAxB.toFixed(3)}</td>
        </tr>`;
    });
    tableHtml += '</tbody></table></div></div>';
    resultsContainer.innerHTML = tableHtml;

    displayTwoWayANOVAInterpretation(testResults);
    displayTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
}


function runTwoWayMixedANOVA(currentData) {
    // This is a placeholder for the more complex mixed ANOVA logic.
    // For now, we will alert the user that it's not fully implemented.
    alert('二要因混合計画分散分析は現在開発中です。');
}


// ======================================================================
// UI Logic
// ======================================================================

function switchTestType(testType) {
    const indControls = document.getElementById('independent-controls');
    const mixedControls = document.getElementById('mixed-controls');
    
    indControls.style.display = 'none';
    mixedControls.style.display = 'none';

    if (testType === 'independent') indControls.style.display = 'block';
    else if (testType === 'mixed') mixedControls.style.display = 'block';

    document.getElementById('analysis-results').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;"><i class="fas fa-th-large"></i> 二要因分散分析</h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因とその交互作用を分析します</p>
            </div>
            
            <div id="anova2-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                 <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova2-type" value="independent" checked>
                            <strong>対応なし (被験者間)</strong>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; opacity: 0.6;">
                            <input type="radio" name="anova2-type" value="mixed" disabled>
                            <strong>混合計画 (Mixed)</strong>
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
                    <p>現在開発中です。</p>
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

    renderDataOverview('#anova2-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('factor1-var-container', categoricalColumns, 'factor1-var', { label: '要因1（被験者間）:', multiple: false });
    createVariableSelector('factor2-var-container', categoricalColumns, 'factor2-var', { label: '要因2（被験者間）:', multiple: false });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', { label: '従属変数:', multiple: true });
    createAnalysisButton('run-ind-btn', '実行（対応なし）', () => runTwoWayIndependentANOVA(currentData));

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