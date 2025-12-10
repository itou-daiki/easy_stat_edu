import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    if (categoricalColumns.length < 2) {
        container.innerHTML = '<p class="error-message">カテゴリカル変数が2つ以上必要です。</p>';
        return;
    }
    if (numericColumns.length === 0) {
        container.innerHTML = '<p class="error-message">数値変数が必要です。</p>';
        return;
    }

    const catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    // Multiple dependent variables support
    const numOptions = numericColumns.map(col => `
        <label>
            <input type="checkbox" name="anova2-num-vars" value="${col}" checked>
            ${col}
        </label>
    `).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>要因1 (カテゴリ変数):</label>
                <select id="anova2-factor1">${catOptions}</select>
            </div>
            <div class="control-group">
                <label>要因2 (カテゴリ変数):</label>
                <select id="anova2-factor2">${catOptions}</select>
            </div>
            <div class="control-group">
                <label>従属変数 (数値変数):</label>
                <div class="checkbox-group">${numOptions}</div>
            </div>
            <button id="run-anova2-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="anova2-results" class="analysis-results"></div>
    `;

    document.getElementById('run-anova2-btn').addEventListener('click', () => {
        const factor1 = document.getElementById('anova2-factor1').value;
        const factor2 = document.getElementById('anova2-factor2').value;
        const numVars = Array.from(document.querySelectorAll('input[name="anova2-num-vars"]:checked')).map(cb => cb.value);

        if (factor1 === factor2) {
            showError('要因1と要因2には異なる変数を選択してください。');
            return;
        }
        if (numVars.length === 0) {
            showError('従属変数を少なくとも1つ選択してください。');
            return;
        }

        runTwoWayAnovaAnalysis(factor1, factor2, numVars);
    });
}

function runTwoWayAnovaAnalysis(factor1, factor2, numVars) {
    const resultsContainer = document.getElementById('anova2-results');
    resultsContainer.innerHTML = '';

    // Check Levels
    const levels1 = [...new Set(currentData.map(d => d[factor1]))].filter(v => v != null).sort();
    const levels2 = [...new Set(currentData.map(d => d[factor2]))].filter(v => v != null).sort();

    if (levels1.length < 2 || levels2.length < 2) {
        resultsContainer.innerHTML = '<p class="error-message">各要因は少なくとも2つのレベル（グループ）を持っている必要があります。</p>';
        return;
    }

    resultsContainer.innerHTML += `<h3>【分析前の確認】</h3>
        <p>独立変数1: <strong>${factor1}</strong> (レベル: ${levels1.join(', ')})</p>
        <p>独立変数2: <strong>${factor2}</strong> (レベル: ${levels2.join(', ')})</p>
        <p>従属変数: <strong>${numVars.join(', ')}</strong></p>
        <hr>`;

    numVars.forEach(dv => {
        resultsContainer.innerHTML += `<h4>従属変数: ${dv}</h4>`;

        // Data Preparation & Cell Stats
        const validData = currentData.filter(d => d[factor1] != null && d[factor2] != null && d[dv] != null && !isNaN(d[dv]));

        const cellStats = {}; // key: "lev1|lev2"
        const factor1Stats = {};
        const factor2Stats = {};

        validData.forEach(d => {
            const key = `${d[factor1]}|${d[factor2]}`;
            if (!cellStats[key]) cellStats[key] = [];
            cellStats[key].push(Number(d[dv]));

            if (!factor1Stats[d[factor1]]) factor1Stats[d[factor1]] = [];
            factor1Stats[d[factor1]].push(Number(d[dv]));

            if (!factor2Stats[d[factor2]]) factor2Stats[d[factor2]] = [];
            factor2Stats[d[factor2]].push(Number(d[dv]));
        });

        const cells = Object.keys(cellStats);
        const nTotal = validData.length;
        const grandMean = jStat.mean(validData.map(d => Number(d[dv])));

        // Sum of Squares
        const ssTotal = validData.reduce((sum, d) => sum + Math.pow(Number(d[dv]) - grandMean, 2), 0);

        // SS_A (Factor1)
        let ssA = 0;
        Object.keys(factor1Stats).forEach(lev => {
            const n = factor1Stats[lev].length;
            const mean = jStat.mean(factor1Stats[lev]);
            ssA += n * Math.pow(mean - grandMean, 2);
        });

        // SS_B (Factor2)
        let ssB = 0;
        Object.keys(factor2Stats).forEach(lev => {
            const n = factor2Stats[lev].length;
            const mean = jStat.mean(factor2Stats[lev]);
            ssB += n * Math.pow(mean - grandMean, 2);
        });

        // SS_Cells (Between Cells)
        let ssCells = 0;
        cells.forEach(key => {
            const n = cellStats[key].length;
            const mean = jStat.mean(cellStats[key]);
            ssCells += n * Math.pow(mean - grandMean, 2);
        });

        // SS_AxB = SS_Cells - SS_A - SS_B
        // Note: This matches Type I/II SS for balanced data exactly. 
        // For unbalanced data, Type III (GLM) is preferred but this "ssCells" logic corresponds to Interaction SS in simple partitioning.
        // Given "vanilla JS" constraint, this approximation for interaction is the standard textbook formula (Weighted Means).
        let ssAxB = ssCells - ssA - ssB;
        if (ssAxB < 0) ssAxB = 0; // Floating point safety

        // SS_Error (Within)
        let ssError = 0;
        cells.forEach(key => {
            const mean = jStat.mean(cellStats[key]);
            ssError += cellStats[key].reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
        });

        // Degrees of Freedom
        const dfA = levels1.length - 1;
        const dfB = levels2.length - 1;
        const dfAxB = dfA * dfB;
        const dfError = nTotal - (levels1.length * levels2.length); // Correct for balanced? Or n - Cells count? 
        // Standard: N - ab. If some cells missing, it's N - (num_non_empty_cells).
        const numCells = cells.length;
        const dfErrorCorrect = nTotal - numCells;

        // Mean Squares
        const msA = dfA > 0 ? ssA / dfA : 0;
        const msB = dfB > 0 ? ssB / dfB : 0;
        const msAxB = dfAxB > 0 ? ssAxB / dfAxB : 0;
        const msError = dfErrorCorrect > 0 ? ssError / dfErrorCorrect : 0;

        // F-stats
        const fA = msError > 0 ? msA / msError : 0;
        const fB = msError > 0 ? msB / msError : 0;
        const fAxB = msError > 0 ? msAxB / msError : 0;

        // p-values
        const pA = (dfA > 0 && msError > 0) ? (1.0 - jStat.centralF.cdf(fA, dfA, dfErrorCorrect)) : 1.0;
        const pB = (dfB > 0 && msError > 0) ? (1.0 - jStat.centralF.cdf(fB, dfB, dfErrorCorrect)) : 1.0;
        const pAxB = (dfAxB > 0 && msError > 0) ? (1.0 - jStat.centralF.cdf(fAxB, dfAxB, dfErrorCorrect)) : 1.0;

        // Effect Sizes (Eta2)
        const eta2A = ssTotal > 0 ? ssA / ssTotal : 0;
        const eta2B = ssTotal > 0 ? ssB / ssTotal : 0;
        const eta2AxB = ssTotal > 0 ? ssAxB / ssTotal : 0;

        // Helper for p-value sign
        const getSig = (p) => {
            if (p < 0.01) return '**';
            if (p < 0.05) return '*';
            if (p < 0.1) return '†';
            return 'n.s.';
        };

        // Output Table
        resultsContainer.innerHTML += `
         <h5>分散分析表</h5>
         <table class="table table-sm">
             <tr><th>要因</th><th>平方和</th><th>自由度</th><th>平均平方</th><th>F</th><th>p</th><th>η²</th></tr>
             <tr><td>${factor1} (主効果)</td><td>${ssA.toFixed(2)}</td><td>${dfA}</td><td>${msA.toFixed(2)}</td><td>${fA.toFixed(2)}</td><td>${pA.toFixed(3)}${getSig(pA)}</td><td>${eta2A.toFixed(2)}</td></tr>
             <tr><td>${factor2} (主効果)</td><td>${ssB.toFixed(2)}</td><td>${dfB}</td><td>${msB.toFixed(2)}</td><td>${fB.toFixed(2)}</td><td>${pB.toFixed(3)}${getSig(pB)}</td><td>${eta2B.toFixed(2)}</td></tr>
             <tr><td>交互作用</td><td>${ssAxB.toFixed(2)}</td><td>${dfAxB}</td><td>${msAxB.toFixed(2)}</td><td>${fAxB.toFixed(2)}</td><td>${pAxB.toFixed(3)}${getSig(pAxB)}</td><td>${eta2AxB.toFixed(2)}</td></tr>
             <tr><td>誤差</td><td>${ssError.toFixed(2)}</td><td>${dfErrorCorrect}</td><td>${msError.toFixed(2)}</td><td></td><td></td><td></td></tr>
         </table>`;

        // Output Cell Means Table
        resultsContainer.innerHTML += `<h5>セルごとの要約統計量 (Mean ± SD)</h5>`;
        const pivotTable = [];
        levels1.forEach(l1 => {
            const row = { [factor1]: l1 };
            levels2.forEach(l2 => {
                const k = `${l1}|${l2}`;
                if (cellStats[k]) {
                    const m = jStat.mean(cellStats[k]);
                    const sd = jStat.stdev(cellStats[k], true);
                    row[l2] = `${m.toFixed(2)} (${sd.toFixed(2)})`;
                } else {
                    row[l2] = '-';
                }
            });
            pivotTable.push(row);
        });

        let tableHtml = `<table class="table table-sm"><thead><tr><th>${factor1} \\ ${factor2}</th>${levels2.map(l => `<th>${l}</th>`).join('')}</tr></thead><tbody>`;
        pivotTable.forEach(r => {
            tableHtml += `<tr><td><strong>${r[factor1]}</strong></td>${levels2.map(l => `<td>${r[l]}</td>`).join('')}</tr>`;
        });
        tableHtml += `</tbody></table>`;
        resultsContainer.innerHTML += tableHtml;

        // --- Post-Hoc Analysis for Interaction (Treating cells as groups) ---
        // If Interaction is significant (p < 0.1 for strict, often < 0.05), or requested.
        // Let's do it if p < 0.1 for visibility.

        // Flatten groups for post-hoc
        const groupKeys = cells.sort(); // "A1|B1", "A1|B2", etc.
        let significantPairs = [];

        if (pAxB < 0.1) {
            resultsContainer.innerHTML += `<h5>交互作用の多重比較 (Bonferroni)</h5>
             <p class="text-muted"><small>交互作用が有意(p<0.1)なため、すべてのセルの組み合わせで多重比較を行います。</small></p>`;

            let postHocHtml = `<table class="table table-sm" style="max-height: 300px; overflow-y: scroll; display: block;"><thead><tr><th>比較</th><th>p(adj)</th><th>判定</th></tr></thead><tbody>`;

            const comparisons = [];
            for (let i = 0; i < groupKeys.length; i++) {
                for (let j = i + 1; j < groupKeys.length; j++) {
                    const k1 = groupKeys[i];
                    const k2 = groupKeys[j];
                    const d1 = cellStats[k1];
                    const d2 = cellStats[k2];

                    const m1 = jStat.mean(d1);
                    const m2 = jStat.mean(d2);
                    const n1 = d1.length;
                    const n2 = d2.length;

                    const se = Math.sqrt(msError * (1 / n1 + 1 / n2)); // Use MS_Error from ANOVA
                    const t = se > 0 ? (m1 - m2) / se : 0;
                    let pRaw = (dfErrorCorrect > 0) ? (1.0 - jStat.studentt.cdf(Math.abs(t), dfErrorCorrect)) * 2.0 : 1.0;

                    comparisons.push({ k1, k2, pRaw });
                }
            }

            const nComp = comparisons.length;
            comparisons.forEach(c => {
                const pAdj = Math.min(1.0, c.pRaw * nComp);
                if (pAdj < 0.1) {
                    const s = getSig(pAdj);
                    postHocHtml += `<tr><td>${c.k1.replace('|', '-')} vs ${c.k2.replace('|', '-')}</td><td>${pAdj.toFixed(4)}</td><td>${s}</td></tr>`;
                    significantPairs.push({ g1: c.k1, g2: c.k2, p: pAdj, sign: s });
                }
            });
            postHocHtml += `</tbody></table>`;
            // Only show table if many rows? Or maybe just significant ones? 
            // We showed significant ones above logic-wise but code block iterates all. 
            // Updated loop to only append HTML for significant for cleaner UI.
            // (Code above logic: I appended rows inside forEach. Wait, I filtered pAdj < 0.1 manually in loop. Correct.)
            if (significantPairs.length === 0) {
                postHocHtml = `<p>有意な差は検出されませんでした。</p>`;
            }
            resultsContainer.innerHTML += postHocHtml;
        }

        // Visualization
        const plotId = `plot2-${dv.replace(/[^a-zA-Z0-9]/g, '-')}`;
        resultsContainer.innerHTML += `<div id="${plotId}" class="plot-container" style="height: 500px;"></div>`;

        setTimeout(() => {
            // Bar Chart: x = Interaction Groups "Fac1-Fac2"
            // To match Python/Reference style: 
            // x = Factor1, grouped by Factor2 (Cluster Bar) OR x = Interaction labels.
            // Interaction labels allow for easier bracket drawing.

            // Let's use x = Group Strings (k1)
            const xLabels = groupKeys.map(k => k.replace('|', '\n')); // Multiline label
            const means = groupKeys.map(k => jStat.mean(cellStats[k]));
            const errors = groupKeys.map(k => jStat.stdev(cellStats[k], true) / Math.sqrt(cellStats[k].length));

            // Trace: Single series if treating as interaction groups
            const trace = {
                x: xLabels,
                y: means,
                type: 'bar',
                error_y: { type: 'data', array: errors, visible: true },
                marker: { color: 'skyblue' }
                // If we want cluster, we need multiple traces. But for brackets, single trace with interaction-x is easier.
                // Python reference output often is "Interaction" on X if brackets are used.
            };

            const layout = {
                title: `${dv} by Interaction`,
                xaxis: { title: '条件 (Factor1 x Factor2)' },
                yaxis: { title: dv },
                showlegend: false,
                font: { family: "Inter, sans-serif" }
            };

            if (significantPairs.length > 0) {
                const annotations = [];
                const shapes = [];
                const step = (Math.max(...means) + Math.max(...errors)) * 0.15;
                let topY = Math.max(...means.map((m, i) => m + errors[i]));

                // Sort significant pairs by distance (simple heuristic)
                significantPairs.forEach((pair, idx) => {
                    const i1 = groupKeys.indexOf(pair.g1);
                    const i2 = groupKeys.indexOf(pair.g2);

                    const levelY = topY + step * (idx + 1);
                    const textY = levelY + step * 0.2;

                    // Lines
                    shapes.push({
                        type: 'path',
                        path: `M ${i1},${means[i1] + errors[i1]} L ${i1},${levelY} L ${i2},${levelY} L ${i2},${means[i2] + errors[i2]}`,
                        line: { color: 'black' }
                    });

                    annotations.push({
                        x: (i1 + i2) / 2,
                        y: textY,
                        text: `p < ${pair.p.toFixed(3)} ${pair.sign}`,
                        showarrow: false
                    });
                });

                layout.shapes = shapes;
                layout.annotations = annotations;
                layout.yaxis.range = [0, topY + step * (significantPairs.length + 2)];
            }

            Plotly.newPlot(plotId, [trace], layout);
        }, 0);
    });
}