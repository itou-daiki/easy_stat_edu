import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, generateAPATableHtml } from '../utils.js';

// ======================================================================
// Helper Functions
// ======================================================================

function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

function performSimpleMainEffectTests(validData, factor1, factor2, depVar, designType, withinVars = []) {
    // Tests differences in Factor 1 (Legend) at each level of Factor 2 (X-axis)
    // If Independent: Factor 1 and Factor 2 are columns.
    // If Mixed: Factor 1 is Between (col), Factor 2 is Within (col names).

    // We assume Factor 1 is the grouping variable (Legend) and Factor 2 is the X-axis.
    // We want to see if Factor 1 groups differ at specific Factor 2 levels.

    const sigPairs = [];
    let levels2;

    if (designType === 'independent') {
        levels2 = getLevels(validData, factor2);

        levels2.forEach((l2, i) => {
            const dataAtL2 = validData.filter(d => d[factor2] === l2);
            const groups = getLevels(dataAtL2, factor1);
            if (groups.length < 2) return;

            const numComparisons = (groups.length * (groups.length - 1)) / 2; // Bonferroni per level

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];

                    const valsA = dataAtL2.filter(d => d[factor1] === groupA).map(d => d[depVar]);
                    const valsB = dataAtL2.filter(d => d[factor1] === groupB).map(d => d[depVar]);

                    if (valsA.length < 2 || valsB.length < 2) continue;

                    // Welch's t-test
                    const tRes = runWelchTTest(valsA, valsB);
                    const pAdj = Math.min(1, tRes.p * numComparisons);

                    if (pAdj < 0.1) {
                        sigPairs.push({
                            xIndex: i, // Index of Factor 2 level (X-axis position)
                            g1: groupA,
                            g2: groupB,
                            p: pAdj
                        });
                    }
                }
            }
        });

    } else if (designType === 'mixed') {
        // Factor 1 is Between (Group), Factor 2 is Within (e.g., 'Condition') which corresponds to column names in withinVars
        // validData contains all rows.
        levels2 = withinVars; // These are the column names

        levels2.forEach((l2, i) => {
            // Compare Groups (Factor 1) at this specific condition (l2)
            const groups = getLevels(validData, factor1);
            if (groups.length < 2) return;

            const numComparisons = (groups.length * (groups.length - 1)) / 2;

            for (let gA = 0; gA < groups.length; gA++) {
                for (let gB = gA + 1; gB < groups.length; gB++) {
                    const groupA = groups[gA];
                    const groupB = groups[gB];

                    const valsA = validData.filter(d => d[factor1] === groupA).map(d => d[l2]); // l2 is column name
                    const valsB = validData.filter(d => d[factor1] === groupB).map(d => d[l2]);

                    if (valsA.length < 2 || valsB.length < 2) continue;

                    // Welch's t-test (Between-subjects comparison at fixed within-level)
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

function runWelchTTest(vals1, vals2) {
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
    // levels1: Legend groups (e.g., Male, Female)
    // levels2: X-axis groups (e.g., Year 1, Year 2)
    // cellStats: { [l1]: { [l2]: { mean, std, n } } }

    // Bars are grouped by X (levels2). Within each X, we have bars for levels1.
    // X coordinates in Plotly for grouped bars are adjusted.
    // However, we can approximate or use shape coordinates relative to the "category" on X.
    // Since we are comparing levels1 (legend items) AT a specific levels2 (X category), logic is distinct.

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

    const stackHeight = []; // To track height of brackets at each X position

    sigPairs.forEach(pair => {
        // pair: { xIndex, g1, g2, p }
        // xIndex correponds to levels2 index.

        const xIdx = pair.xIndex;
        const currentMaxY = maxValsAtX[xIdx];

        // For Grouped bars, finding exact X position is tricky in layout.shapes without "xref: 'x'".
        // But "x" is categorical. 
        // Plotly places groups at integer indices 0, 1, 2...
        // Within a group, bars are shifted.
        // If we only compare Level A vs Level B at X=0, we can draw a bracket centered at X=0.
        // Since we typically only have 2-3 subgroups, we can just center the bracket on the category.

        if (!stackHeight[xIdx]) stackHeight[xIdx] = 0;
        stackHeight[xIdx]++;

        const yOffset = currentMaxY * 0.1 + (stackHeight[xIdx] * currentMaxY * 0.15);
        const bracketY = currentMaxY + yOffset;
        const legHeight = currentMaxY * 0.05;

        let text;
        if (pair.p < 0.01) text = 'p < 0.01 **';
        else if (pair.p < 0.05) text = 'p < 0.05 *';
        else text = 'p < 0.1 †';

        // We draw the bracket covering the width of the group at X
        // A safe width is +/- 0.2 around the integer xIdx
        const xCenter = xIdx; // Because x-axis is categorical, mapped to 0, 1, 2...
        const halfWidth = 0.2;

        // Horizontal line
        shapes.push({
            type: 'line',
            x0: xCenter - halfWidth, y0: bracketY,
            x1: xCenter + halfWidth, y1: bracketY,
            line: { color: 'black', width: 2 }
        });

        // Legs
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

        const etaA = ssA / (ssA + ssError);
        const etaB = ssB / (ssB + ssError);
        const etaAxB = dfAxB > 0 ? ssAxB / (ssAxB + ssError) : 0;

        // Perform Simple Main Effect Tests
        const resultSigPairs = performSimpleMainEffectTests(validData, factor1, factor2, depVar, 'independent');

        testResults.push({
            depVar, factor1, factor2, levels1, levels2,
            cellStats,
            pA, pB, pAxB,
            etaA, etaB, etaAxB,
            ssA, dfA, msA, fA,
            ssB, dfB, msB, fB,
            ssAxB, dfAxB, msAxB, fAxB,
            ssError, dfError, msError,
            sigPairs: resultSigPairs
        });
    });

    // Populate the sections
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
            </div>
        `;
    });

    contentContainer.innerHTML = html;
}


function renderTwoWayANOVATable(results) {
    if (results.length === 0) return;

    const container = document.getElementById('test-results-section');
    let finalHtml = '';

    results.forEach(res => {
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
        // Remove Null/Error rows if strict APA? No, Error is needed.

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
            <!-- 軸ラベル表示オプション -->
            <div id="viz-controls-container"></div>
            <div id="visualization-plots"></div>
        </div>`;

    // コントロールの追加
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

                // Add brackets if any
                const { shapes, annotations } = generateBracketsForGroupedPlot(res.sigPairs || [], res.levels1, res.levels2, res.cellStats);

                // Vertical Axis Title using Annotation
                const tategakiTitle = getTategakiAnnotation(res.depVar);
                if (tategakiTitle) {
                    annotations.push(tategakiTitle);
                }

                // Bottom Graph Title
                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;
                const bottomTitle = getBottomTitleAnnotation(graphTitleText);
                if (bottomTitle) {
                    annotations.push(bottomTitle);
                }

                const layout = {
                    title: '', // Disable standard title
                    xaxis: { title: res.factor2 },
                    yaxis: { title: '', rangemode: 'tozero' },
                    legend: { title: { text: res.factor1 } },
                    barmode: 'group', // This creates clustered bars
                    shapes: shapes,
                    annotations: annotations,
                    margin: { l: 100, b: 100 } // Add left and bottom margin
                };

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

                Plotly.newPlot(plotDiv, traces, layout, createPlotlyConfig('二要因分散分析', res.depVar));

                // Helper to update plots
                // Add listeners (ensure not adding duplicates if re-rendering but here we just re-create)
                // Actually, since these are inside the loop and dependent on `res` and `plotDiv`, 
                // we should add them once.

                // However, axisControl/titleControl are shared across all plots if we have multiple results (rare but possible).
                // It's better to add the listener OUTSIDE the loop if possible, OR
                // make sure we don't leak listeners.

                // Since this function destroys/re-creates HTML, listeners are attached to new DOM elements.
                // But `axisControl` is created once per function call.
                // Inside the loop? No, this loop creates closures.
                // We should attach listener to `axisControl` once, and inside that listener loop through results.
            }
        }, 100);
    });

    // Attach listeners once outside the loop
    const updateAllPlots = () => {
        const showAxis = axisControl?.checked ?? true;
        const showTitle = titleControl?.checked ?? true;

        results.forEach((res, index) => {
            const plotId = `anova-plot-${index}`;
            const plotDiv = document.getElementById(plotId);
            if (plotDiv && plotDiv.data) { // Check plotDiv existence
                const currentLayout = plotDiv.layout;
                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;

                let newAnnotations = (currentLayout.annotations || []).filter(a => a.x !== -0.15 && a.y !== -0.25);

                if (showAxis) {
                    const ann = getTategakiAnnotation(res.depVar);
                    if (ann) newAnnotations.push(ann);
                }
                if (showTitle) {
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

    if (!betweenVar) {
        alert('被験者間因子（グループ）を選択してください。');
        return;
    }
    if (!pairs || pairs.length === 0) {
        alert('分析する変数ペア（観測変数・測定変数）を1つ以上追加してください。');
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

    const testResults = [];
    const resultSigPairsList = [];

    pairs.forEach((pair, index) => {
        const withinVars = [pair.pre, pair.post];


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
            // alert('被験者間因子のグループは2つ以上必要です。'); // Suppress alert in loop, maybe log warning
            console.warn(`Skipping pair ${pair.pre}-${pair.post}: Not enough groups.`);
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

        // Perform Simple Main Effect Tests
        // For Mixed: Factor 1 is Between (betweenVar), Factor 2 is Within (conditions/columns)
        const resultSigPairs = performSimpleMainEffectTests(validData, betweenVar, 'conditions', 'value', 'mixed', withinVars);

        testResults.push({
            pairName: `${pair.pre} - ${pair.post}`,
            factorBetween: betweenVar,
            factorWithin: '条件(Time)',
            levelsBetween: groups,
            levelsWithin: withinVars, // [pre, post]
            cellStats,
            sources: [
                { name: `被験者間: ${betweenVar}`, ss: ssBetween, df: dfBetween, ms: msBetween, f: fBetween, p: pBetween, eta: etaBetween },
                { name: '誤差(間)', ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null, eta: null },
                { name: `被験者内: 条件`, ss: ssWithin, df: dfWithin, ms: msWithin, f: fWithin, p: pWithin, eta: etaWithin },
                { name: `交互作用: ${betweenVar}×条件`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
                { name: '誤差(内)', ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null, eta: null }
            ],
            sigPairs: resultSigPairs
        });
    }); // End pair loop

    if (testResults.length === 0) return;

    renderTwoWayMixedANOVATable(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'mixed');

    // Reuse visualization logic
    const vizResults = testResults.map(res => ({
        depVar: res.pairName, // Use pair name as 'depVar' for title
        factor1: res.factorBetween,
        factor2: '条件',
        levels1: res.levelsBetween,
        levels2: res.levelsWithin,
        cellStats: res.cellStats,
        sigPairs: res.sigPairs
    }));
    renderTwoWayANOVAVisualization(vizResults);

    document.getElementById('analysis-results').style.display = 'block';
}

function renderTwoWayMixedANOVATable(results) {
    if (!results || results.length === 0) return;
    const container = document.getElementById('test-results-section');
    let tableHtml = '';

    results.forEach((res, index) => {
        tableHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 混合計画分散分析の結果 (${res.pairName})
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

        // Generate APA Source Table
        const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
        const rowsAPA = res.sources.map(src => {
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

        tableHtml += `
        <div style="margin-bottom: 2rem;">
                <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                <div>${generateAPATableHtml(`anova-mixed-apa-${index}`, `Table 1. Mixed Design ANOVA Source Table (${res.pairName})`, headersAPA, rowsAPA, `<em>Note</em>. Effect size is partial eta-squared.`)}</div>
        </div>
    `;
    }); // End results loop

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
                        <strong><i class="fas fa-lightbulb"></i> 二元配置分散分析 (Two-way ANOVA) とは？</strong>
                        <p>2つの要因（原因）が結果にどう影響するか、またその組み合わせに特別な効果（交互作用）があるかを調べる分析です。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 「性別（男・女）」と「指導法（A・B）」の違いによって、テストの点数がどう変わるか調べたいとき</li>
                        <li><i class="fas fa-check"></i> 「薬の種類」と「投与量」の組み合わせで効果が変わるか知りたいとき</li>
                    </ul>
                    <h4>交互作用（こうごさよう）とは？</h4>
                    <p>「組み合わせによる効果」のことです。例えば「指導法Aは、男性には効果があるが、女性には効果が薄い」といった場合、性別と指導法の間に「交互作用がある」といいます。</p>
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
                            <li><strong>検定手法:</strong> 二元配置分散分析 (Two-way ANOVA) - Type II または Type III 平方和 (※現在はType I/Sequentialの挙動に近い実装のため、各群のサンプルサイズが等しい(Balanced design)ことを推奨)</li>
                            <li><strong>モデル:</strong> \( Y_{ijk} = \mu + \alpha_i + \beta_j + (\alpha\beta)_{ij} + \epsilon_{ijk} \)</li>
                            <li><strong>交互作用:</strong> 有意な場合、単純主効果の検定を行うことが一般的です（本ツールでは交互作用プロットで視覚的に確認）。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="anova2-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <!-- 軸ラベル表示オプション (Moved) -->
                <!-- <div id="axis-label-control-container"></div> -->
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
                    
                    <!-- Pair Selection UI -->
                    <div style="padding: 1rem; background: #fafbfc; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h5 style="color: #2d3748; margin-bottom: 1rem;"><i class="fas fa-list-ol"></i> 被験者内因子のペア選択:</h5>
                        <p style="margin: -0.5rem 0 1rem 0; color: #6b7280; font-size: 0.9rem;">観測変数（前測）と測定変数（後測）のペアを追加してください。</p>
                        
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
                            <div id="mixed-var-pre-container" style="flex: 1; min-width: 200px;"></div>
                            <span style="font-weight: bold; color: #1e90ff; font-size: 1.5rem;">→</span>
                            <div id="mixed-var-post-container" style="flex: 1; min-width: 200px;"></div>
                            <button id="add-mixed-pair-btn" class="analysis-button" style="background-color: #28a745; min-width: 120px; margin-top: 1.5rem;">
                                <i class="fas fa-plus"></i> ペアを追加
                            </button>
                        </div>
                        
                        <h5 style="color: #2d3748; margin-bottom: 1rem;">
                            <i class="fas fa-list-ul"></i> 選択された変数ペア
                        </h5>
                        <div id="selected-mixed-pairs-list" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; min-height: 50px; background: white;">
                            <p id="no-mixed-pairs-text" style="color: #6b7280;">ここに追加されたペアが表示されます</p>
                        </div>
                    </div>

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

    renderDataOverview('#anova-2way-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 軸ラベル表示オプションの追加 (Moved)
    // createAxisLabelControl('axis-label-control-container');

    // Independent Selectors
    createVariableSelector('factor1-var-container', categoricalColumns, 'factor1-var', { label: '要因1（間）:', multiple: false });
    createVariableSelector('factor2-var-container', categoricalColumns, 'factor2-var', { label: '要因2（間）:', multiple: false });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', { label: '従属変数:', multiple: true });
    createAnalysisButton('run-ind-btn', '実行（対応なし）', () => runTwoWayIndependentANOVA(currentData), { id: 'run-ind-anova' });

    // Mixed Selectors
    createVariableSelector('mixed-between-container', categoricalColumns, 'mixed-between-var', { label: '被験者間因子（グループ）:', multiple: false });
    // Pairs logic replaces 'mixed-within-vars'
    createVariableSelector('mixed-var-pre-container', numericColumns, 'mixed-var-pre', { label: '観測変数（前測）:', multiple: false });
    createVariableSelector('mixed-var-post-container', numericColumns, 'mixed-var-post', { label: '測定変数（後測）:', multiple: false });

    // Internal state for selected pairs
    let selectedMixedPairs = [];

    const renderSelectedMixedPairs = () => {
        const listContainer = document.getElementById('selected-mixed-pairs-list');
        const noPairsText = document.getElementById('no-mixed-pairs-text');
        listContainer.innerHTML = '';
        if (selectedMixedPairs.length === 0) {
            listContainer.appendChild(noPairsText);
            noPairsText.style.display = 'block';
        } else {
            noPairsText.style.display = 'none';
            selectedMixedPairs.forEach((pair, index) => {
                const pairEl = document.createElement('div');
                pairEl.className = 'selected-pair-item';
                pairEl.innerHTML = `
                    <span>${pair.pre} → ${pair.post}</span>
                    <button class="remove-pair-btn" data-index="${index}"><i class="fas fa-times"></i></button>
                `;
                listContainer.appendChild(pairEl);
            });
        }
    };

    const updateMixedPairSelectors = () => {
        const preSelect = document.getElementById('mixed-var-pre');
        const postSelect = document.getElementById('mixed-var-post');
        if (!preSelect || !postSelect) return;

        const selectedPre = preSelect.value;
        const selectedPost = postSelect.value;

        // Reset
        Array.from(preSelect.options).forEach(opt => opt.disabled = false);
        Array.from(postSelect.options).forEach(opt => opt.disabled = false);

        // Disable selected
        if (selectedPre) {
            const postOption = postSelect.querySelector(`option[value="${selectedPre}"]`);
            if (postOption) postOption.disabled = true;
        }
        if (selectedPost) {
            const preOption = preSelect.querySelector(`option[value="${selectedPost}"]`);
            if (preOption) preOption.disabled = true;
        }
    };

    document.getElementById('mixed-var-pre').addEventListener('change', updateMixedPairSelectors);
    document.getElementById('mixed-var-post').addEventListener('change', updateMixedPairSelectors);

    document.getElementById('add-mixed-pair-btn').addEventListener('click', () => {
        const preVar = document.getElementById('mixed-var-pre').value;
        const postVar = document.getElementById('mixed-var-post').value;

        if (!preVar || !postVar) {
            alert('観測変数と測定変数の両方を選択してください。');
            return;
        }
        if (preVar === postVar) {
            alert('観測変数と測定変数に同じ変数は選べません。');
            return;
        }
        if (selectedMixedPairs.some(p => p.pre === preVar && p.post === postVar)) {
            alert('この変数の組み合わせは既に追加されています。');
            return;
        }

        selectedMixedPairs.push({ pre: preVar, post: postVar });
        renderSelectedMixedPairs();
    });

    document.getElementById('selected-mixed-pairs-list').addEventListener('click', (e) => {
        if (e.target.closest('.remove-pair-btn')) {
            const index = e.target.closest('.remove-pair-btn').dataset.index;
            selectedMixedPairs.splice(index, 1);
            renderSelectedMixedPairs();
        }
    });

    createAnalysisButton('run-mixed-btn', '実行（混合計画）', () => runTwoWayMixedANOVA(currentData, selectedMixedPairs), { id: 'run-mixed-anova' });

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