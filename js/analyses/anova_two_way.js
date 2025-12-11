import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';

// ======================================================================
// Helper Functions
// ======================================================================

function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

// ======================================================================
// Main Analysis Function
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

    // Clear results and display the section
    const resultsContainer = document.getElementById('analysis-results');

    // Ensure the results structure exists
    if (!document.getElementById('test-results-section')) {
        resultsContainer.innerHTML = `
            <div id="summary-stats-section"></div>
            <div id="test-results-section"></div>
            <div id="interpretation-section"></div>
            <div id="visualization-section"></div>
        `;
    } else {
        // Clear previous results content
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
        const levels1 = getLevels(validData, factor1); // e.g., ['男性', '女性']
        const levels2 = getLevels(validData, factor2); // e.g., ['1年次', '2・3年次']

        if (levels1.length < 2 || levels2.length < 2) return;

        const grandMean = jStat.mean(validData.map(d => d[depVar]));
        const ssTotal = jStat.sum(validData.map(d => Math.pow(d[depVar] - grandMean, 2)));

        const cellStats = {}; // { '男性': { '1年次': {mean, std, n}, '2・3年次': {...} }, '女性': {...} }
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
        const msAxB = dfAxB > 0 ? ssAxB / dfAxB : 0; // Handle dfAxB = 0
        const msError = ssError / dfError;

        const fA = msA / msError;
        const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);

        const fB = msB / msError;
        const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);

        const fAxB = dfAxB > 0 ? msAxB / msError : 0; // Handle dfAxB = 0
        const pAxB = dfAxB > 0 ? 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError) : 1;

        testResults.push({
            depVar, factor1, factor2, levels1, levels2,
            cellStats, // M, SD, N for each cell
            pA, pB, pAxB, // p-values
            ssA, dfA, msA, fA, // For potential ANOVA table
            ssB, dfB, msB, fB,
            ssAxB, dfAxB, msAxB, fAxB,
            ssError, dfError, msError,
        });
    });

    // Populate the sections
    renderTwoWayANOVATable(testResults);
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';
}

function renderTwoWayANOVATable(results) {
    if (results.length === 0) return;

    // Assume all results share the same factors and levels for header generation
    const { factor1, factor2, levels1, levels2 } = results[0];
    const container = document.getElementById('test-results-section'); // This is where the main table goes

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> ${factor1}・${factor2}での分散分析による比較
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th rowspan="2" style="vertical-align: middle; text-align: left;"></th>
                            <th rowspan="2" style="vertical-align: middle; text-align: left;">${factor2}</th>
                            ${levels1.map(l1 => `<th colspan="2" style="text-align: center;">${l1}</th>`).join('')}
                            <th rowspan="2" style="vertical-align: middle; white-space: nowrap;">${factor1}の主効果</th>
                            <th rowspan="2" style="vertical-align: middle; white-space: nowrap;">${factor2}の主効果</th>
                            <th rowspan="2" style="vertical-align: middle; white-space: nowrap;">交互作用</th>
                        </tr>
                        <tr>
                            ${levels1.map(() => `<th>M</th><th>S.D</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>`;

    results.forEach(res => {
        tableHtml += `<tr>
            <td rowspan="`+ (res.levels2.length * 1) + `" style="vertical-align: middle; font-weight: bold;">${res.depVar}</td>`; // Multiply by 1 to ensure it's treated as a number

        res.levels2.forEach((l2, i) => {
            if (i > 0) tableHtml += '<tr>';
            tableHtml += `<td>${l2}</td>`;
            res.levels1.forEach(l1 => {
                const stats = res.cellStats[l1][l2];
                tableHtml += `<td>${stats.mean.toFixed(2)}</td><td>${stats.std.toFixed(2)}</td>`;
            });

            if (i === 0) {
                const sigA = res.pA < 0.01 ? '**' : res.pA < 0.05 ? '*' : res.pA < 0.1 ? '†' : 'n.s.';
                const sigB = res.pB < 0.01 ? '**' : res.pB < 0.05 ? '*' : res.pB < 0.1 ? '†' : 'n.s.';
                const sigAxB = res.pAxB < 0.01 ? '**' : res.pAxB < 0.05 ? '*' : res.pAxB < 0.1 ? '†' : 'n.s.';
                tableHtml += `
                    <td rowspan="`+ (res.levels2.length * 1) + `" style="vertical-align: middle; text-align: center;">${sigA}</td>
                    <td rowspan="`+ (res.levels2.length * 1) + `" style="vertical-align: middle; text-align: center;">${sigB}</td>
                    <td rowspan="`+ (res.levels2.length * 1) + `" style="vertical-align: middle; text-align: center;">${sigAxB}</td>`;
            }
            tableHtml += '</tr>';
        });
    });

    const footerHtml = `</tbody></table>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
        </div></div>`;

    container.innerHTML = tableHtml;
}


function renderTwoWayANOVAVisualization(results) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-chart-bar"></i> 可視化</h4>
            <div id="visualization-plots"></div>
        </div>`;
    const plotsContainer = document.getElementById('visualization-plots');
    plotsContainer.innerHTML = '';

    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        plotsContainer.innerHTML += `<div id="${plotId}" class="plot-container" style="margin-top: 1rem;"></div>`;

        setTimeout(() => {
            const plotDiv = document.getElementById(plotId);
            if (plotDiv) {
                const traces = [];
                // Group by factor1, bars are factor2 levels
                res.levels1.forEach(l1 => {
                    const yData = res.levels2.map(l2 => res.cellStats[l1][l2].mean);
                    const errorData = res.levels2.map(l2 => {
                        const n = res.cellStats[l1][l2].n;
                        return n > 0 ? res.cellStats[l1][l2].std / Math.sqrt(n) : 0;
                    });
                    traces.push({
                        x: res.levels2, // Factor 2 levels on X-axis
                        y: yData,
                        name: l1, // Factor 1 levels for legend/grouping
                        type: 'bar',
                        error_y: {
                            type: 'data',
                            array: errorData,
                            visible: true,
                            color: 'black'
                        }
                    });
                });
                Plotly.newPlot(plotDiv, traces, {
                    title: `平均値の棒グラフ: ${res.depVar}`,
                    xaxis: { title: res.factor2 },
                    yaxis: { title: res.depVar, rangemode: 'tozero' },
                    legend: { title: { text: res.factor1 } },
                    barmode: 'group' // This creates clustered bars
                }, createPlotlyConfig('二要因分散分析', res.depVar));
            }
        }, 100);
    });
}


function runTwoWayMixedANOVA(currentData) {
    const betweenVar = document.getElementById('mixed-between-var').value;
    const withinVarsSelect = document.getElementById('mixed-within-vars');
    const withinVars = Array.from(withinVarsSelect.selectedOptions).map(o => o.value);

    if (!betweenVar || withinVars.length < 2) {
        alert('被験者間因子（グループ）と、2つ以上の被験者内因子（測定値列）を選択してください。');
        return;
    }

    // Clear and prepare results container
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

    // Filter valid data
    const validData = currentData.filter(d =>
        d[betweenVar] != null &&
        withinVars.every(v => d[v] != null && !isNaN(d[v]))
    );

    const nTotal = validData.length;
    const groups = getLevels(validData, betweenVar);
    const conditions = withinVars;
    const nGroups = groups.length;
    const nConditions = conditions.length; // k

    if (nGroups < 2) {
        alert('被験者間因子のグループは2つ以上必要です。');
        return;
    }

    // 1. Calculate Grand Mean
    const allValues = validData.flatMap(d => withinVars.map(v => d[v]));
    const grandMean = jStat.mean(allValues);
    const ssTotal = jStat.sum(allValues.map(v => Math.pow(v - grandMean, 2)));

    // 2. Between-Subjects Calculations
    // SS_Between (Factor A) & SS_Subjects(within groups) (Error A)

    // Calculate Group Means (Factor A means)
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

    let ssBetween = 0; // Factor A
    groups.forEach(g => {
        ssBetween += groupNs[g] * nConditions * Math.pow(groupMeans[g] - grandMean, 2);
    });

    // Subject Means (averaged across within-factors)
    const subjectMeans = validData.map(d => jStat.mean(withinVars.map(v => d[v])));

    // SS_Subjects (Total variability between subjects)
    // = nConditions * sum((subjectMean - grandMean)^2)
    const ssSubjectsTotal = nConditions * jStat.sum(subjectMeans.map(m => Math.pow(m - grandMean, 2)));

    const ssErrorBetween = ssSubjectsTotal - ssBetween; // Error term for Factor A


    // 3. Within-Subjects Calculations
    // SS_Within (Factor B) & SS_Interaction (AxB) & SS_ErrorWithin (Error B)

    // SS_Within (Factor B)
    const conditionMeans = {};
    withinVars.forEach(v => {
        conditionMeans[v] = jStat.mean(validData.map(d => d[v]));
    });

    let ssWithin = 0;
    withinVars.forEach(v => {
        ssWithin += nTotal * Math.pow(conditionMeans[v] - grandMean, 2);
    });

    // SS_Cells (A x B) - to calculate Interaction
    const cellStats = {}; // { 'GroupA': { 'Math': {mean, n}, ... }, ... }
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

    // SS_ErrorWithin (Total Within - Factor B - Interaction)
    // Calculate SS_Total_Within (variability of scores around subject means)
    // Or easier: SS_Total - SS_SubjectsTotal
    const ssBroadWithin = ssTotal - ssSubjectsTotal;
    const ssErrorWithin = ssBroadWithin - ssWithin - ssInteraction;

    // 4. Degrees of Freedom
    const dfBetween = nGroups - 1;
    const dfErrorBetween = nTotal - nGroups;

    const dfWithin = nConditions - 1;
    const dfInteraction = dfBetween * dfWithin;
    const dfErrorWithin = dfErrorBetween * dfWithin;

    // 5. Mean Squares
    const msBetween = ssBetween / dfBetween;
    const msErrorBetween = ssErrorBetween / dfErrorBetween;

    const msWithin = ssWithin / dfWithin;
    const msInteraction = ssInteraction / dfInteraction;
    const msErrorWithin = ssErrorWithin / dfErrorWithin;

    // 6. F-ratios & P-values
    const fBetween = msBetween / msErrorBetween;
    const pBetween = 1 - jStat.centralF.cdf(fBetween, dfBetween, dfErrorBetween);

    const fWithin = msWithin / msErrorWithin;
    const pWithin = 1 - jStat.centralF.cdf(fWithin, dfWithin, dfErrorWithin);

    const fInteraction = msInteraction / msErrorWithin;
    const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfErrorWithin);

    // 7. Effect Sizes (Partial Eta Squared)
    const etaBetween = ssBetween / (ssBetween + ssErrorBetween);
    const etaWithin = ssWithin / (ssWithin + ssErrorWithin);
    const etaInteraction = ssInteraction / (ssInteraction + ssErrorWithin);

    const result = {
        factorBetween: betweenVar,
        factorWithin: '条件(Time)',
        levelsBetween: groups,
        levelsWithin: withinVars,
        cellStats,

        sources: [
            { name: `被験者間: ${betweenVar}`, ss: ssBetween, df: dfBetween, ms: msBetween, f: fBetween, p: pBetween, eta: etaBetween },
            { name: '誤差(間)', ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null, eta: null },
            { name: `被験者内: 条件`, ss: ssWithin, df: dfWithin, ms: msWithin, f: fWithin, p: pWithin, eta: etaWithin },
            { name: `交互作用: ${betweenVar}×条件`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
            { name: '誤差(内)', ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null, eta: null }
        ]
    };

    renderTwoWayMixedANOVATable(result);
    // Reuse visualization logic with slight adaptation
    const vizResult = {
        depVar: '測定値',
        factor1: betweenVar,
        factor2: '条件',
        levels1: groups,
        levels2: withinVars,
        cellStats: cellStats
    };
    renderTwoWayANOVAVisualization([vizResult]);

    document.getElementById('analysis-results').style.display = 'block';
}

function renderTwoWayMixedANOVATable(res) {
    const container = document.getElementById('test-results-section');

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 混合計画分散分析の結果 (${res.factorBetween} × 条件)
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

    res.sources.forEach(src => {
        const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
        const pStr = src.p !== null ? src.p.toFixed(3) + sig : '-';
        const fStr = src.f !== null ? src.f.toFixed(2) : '-';
        const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';
        const msStr = src.ms.toFixed(2);

        tableHtml += `
            <tr>
                <td style="text-align: left; font-weight: 500;">${src.name}</td>
                <td>${src.ss.toFixed(2)}</td>
                <td>${src.df}</td>
                <td>${msStr}</td>
                <td>${fStr}</td>
                <td style="${src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
                <td>${etaStr}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
        </div></div>`;

    // Descriptive Stats Table
    tableHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
                平均値と標準偏差
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${res.factorBetween} (間)</th>
                            ${res.levelsWithin.map(l => `<th>${l} (内)</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>`;

    res.levelsBetween.forEach(l1 => {
        tableHtml += `<tr>
            <td style="font-weight: bold;">${l1}</td>`;
        res.levelsWithin.forEach(l2 => {
            const s = res.cellStats[l1][l2];
            tableHtml += `<td>${s.mean.toFixed(2)} (SD: ${s.std.toFixed(2)})</td>`;
        });
        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table></div></div>`;

    container.innerHTML = tableHtml;
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
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-th-large"></i> 二要因分散分析 (Two-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因とその交互作用を分析します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 二要因分散分析とは？</strong>
                        <p>2つの要因（例：性別 × 条件）が結果に与える影響や、その相互作用（組み合わせによる特殊な効果）を調べます。</p>
                        <ul>
                            <li><strong>主効果:</strong> 各要因単独の影響</li>
                            <li><strong>交互作用:</b> 要因の組み合わせによる影響（例：薬Aは男性には効くが女性には効かない、など）</li>
                        </ul>
                    </div>
                </div>
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
                <div id="summary-stats-section"></div>
                <div id="test-results-section"></div>
                <div id="interpretation-section"></div>
                <div id="visualization-section"></div>
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