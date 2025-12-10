import { currentData } from '../main.js';
import { showError, getEffectSizeInterpretation, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    if (categoricalColumns.length === 0) {
        container.innerHTML = '<p class="error-message">カテゴリカル変数がデータに含まれていないため、一要因分散分析を実行できません。</p>';
        return;
    }
    if (numericColumns.length === 0) {
        container.innerHTML = '<p class="error-message">数値変数がデータに含まれていないため、一要因分散分析を実行できません。</p>';
        return;
    }

    const catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    const numOptions = numericColumns.map(col => `
        <label>
            <input type="checkbox" name="anova-num-vars" value="${col}" checked>
            ${col}
        </label>
    `).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>カテゴリ変数（群分けに使用）を選択:</label>
                <select id="anova-cat-var">${catOptions}</select>
            </div>
            <div class="control-group">
                <label>数値変数（分析対象）を選択:</label>
                <div class="checkbox-group">${numOptions}</div>
            </div>
            <button id="run-anova-btn" class="btn-analysis">分散分析を実行</button>
        </div>
        <div id="anova-results" class="analysis-results"></div>
    `;

    document.getElementById('run-anova-btn').addEventListener('click', () => {
        const catVar = document.getElementById('anova-cat-var').value;
        const numVars = Array.from(document.querySelectorAll('input[name="anova-num-vars"]:checked')).map(cb => cb.value);

        if (!catVar) {
            showError('カテゴリ変数を選択してください。');
            return;
        }
        if (numVars.length === 0) {
            showError('数値変数を少なくとも1つ選択してください。');
            return;
        }

        runAnovaAnalysis(catVar, numVars);
    });
}

function runAnovaAnalysis(catVar, numVars) {
    const resultsContainer = document.getElementById('anova-results');
    resultsContainer.innerHTML = '';

    // データ処理: カテゴリごとにデータをグループ化
    const uniqueGroups = [...new Set(currentData.map(row => row[catVar]))].filter(v => v != null).sort();

    // 3群以上かチェック
    if (uniqueGroups.length < 3) {
        resultsContainer.innerHTML = `<p class="error-message">カテゴリ変数「${catVar}」のグループ数が3未満（${uniqueGroups.length}）です。一要因分散分析には3群以上必要です。</p>`;
        return;
    }

    resultsContainer.innerHTML += `<h3>【分析前の確認】</h3>
        <p>${catVar}（${uniqueGroups.join(', ')}）によって、以下の数値変数に有意な差が生まれるか検定します。</p>
        <ul>${numVars.map(v => `<li>${v}</li>`).join('')}</ul>`;

    // グラフタイトルを表示するかのチェックボックス（JS版では常に表示でよいが、Python版に合わせるならオプション化も可。ここではシンプルに実装）

    resultsContainer.innerHTML += `<h3>【分析結果】</h3>`;

    numVars.forEach(numVar => {
        // グループごとのデータを抽出
        const groupDataMap = {};
        uniqueGroups.forEach(g => groupDataMap[g] = []);

        const validData = currentData.filter(row => row[catVar] != null && row[numVar] != null && !isNaN(row[numVar]));
        validData.forEach(row => {
            groupDataMap[row[catVar]].push(Number(row[numVar]));
        });

        // データ数が十分かチェック
        const validGroups = uniqueGroups.filter(g => groupDataMap[g].length > 1);
        if (validGroups.length < 2) {
            resultsContainer.innerHTML += `<div class="result-card error"><p>${numVar}: 分析に必要なデータが不足しています。</p></div>`;
            return;
        }

        const groupDataArray = validGroups.map(g => groupDataMap[g]);
        const k = groupDataArray.length;
        const allValues = [].concat(...groupDataArray);
        const n = allValues.length;
        const grandMean = jStat.mean(allValues);

        // ANOVA計算
        let ssBetween = 0;
        groupDataArray.forEach(g => {
            ssBetween += g.length * Math.pow(jStat.mean(g) - grandMean, 2);
        });

        let ssWithin = 0;
        groupDataArray.forEach(g => {
            const gMean = jStat.mean(g);
            ssWithin += g.reduce((sum, val) => sum + Math.pow(val - gMean, 2), 0);
        });

        const ssTotal = ssBetween + ssWithin;
        const dfBetween = k - 1;
        const dfWithin = n - k;

        const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;
        const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;

        const fStat = msWithin > 0 ? msBetween / msWithin : 0;
        let pValue = 1.0;
        if (msWithin > 0 && dfBetween > 0 && dfWithin > 0) {
            try {
                pValue = 1.0 - jStat.centralF.cdf(fStat, dfBetween, dfWithin);
            } catch (e) {
                console.error("p-value calc error", e);
            }
        }

        // 効果量
        const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;
        const omegaSquared = (ssTotal + msWithin) > 0 ? (ssBetween - (dfBetween * msWithin)) / (ssTotal + msWithin) : 0;

        // 有意性判定
        let sign = 'n.s.';
        if (pValue < 0.01) sign = '**';
        else if (pValue < 0.05) sign = '*';
        else if (pValue < 0.1) sign = '†';

        // UI出力
        let html = `<div class="result-card">
            <h4>${numVar} の分析結果</h4>
            <div class="stats-summary">
                <p><strong>F(${dfBetween}, ${dfWithin}) = ${fStat.toFixed(2)}</strong>, p = ${pValue.toFixed(3)} ${sign}</p>
                <p>η² = ${etaSquared.toFixed(2)}, ω² = ${omegaSquared.toFixed(2)}</p>
                <p class="text-muted"><small>${catVar}によって、${sign === '**' || sign === '*' ? '有意な差が生まれます' : (sign === '†' ? '有意な差が生まれる傾向にあります' : '有意な差は確認できませんでした')}。</small></p>
            </div>`;

        // 分散分析表
        html += `<table class="table table-sm">
            <tr><th>要因</th><th>平方和</th><th>自由度</th><th>平均平方</th><th>F</th><th>p</th></tr>
            <tr><td>群間</td><td>${ssBetween.toFixed(2)}</td><td>${dfBetween}</td><td>${msBetween.toFixed(2)}</td><td>${fStat.toFixed(2)}</td><td>${pValue.toFixed(3)}</td></tr>
            <tr><td>群内</td><td>${ssWithin.toFixed(2)}</td><td>${dfWithin}</td><td>${msWithin.toFixed(2)}</td><td></td><td></td></tr>
            <tr><td>全体</td><td>${ssTotal.toFixed(2)}</td><td>${n - 1}</td><td></td><td></td><td></td></tr>
        </table>`;

        // 多重比較（Bonferroni）
        let significantPairs = [];
        if (pValue < 0.1) {
            html += `<h5>多重比較の結果 (Bonferroni)</h5>`;
            const comparisons = [];

            // 全ペア比較
            for (let i = 0; i < validGroups.length; i++) {
                for (let j = i + 1; j < validGroups.length; j++) {
                    const g1 = validGroups[i];
                    const g2 = validGroups[j];
                    const d1 = groupDataMap[g1];
                    const d2 = groupDataMap[g2];

                    const m1 = jStat.mean(d1);
                    const m2 = jStat.mean(d2);
                    const n1 = d1.length;
                    const n2 = d2.length;

                    // t値の計算 (群内平均平方を使用)
                    const stderr = Math.sqrt(msWithin * (1 / n1 + 1 / n2));
                    const tStat = stderr > 0 ? (m1 - m2) / stderr : 0;
                    const df = dfWithin;

                    let pRaw = 1.0;
                    if (df > 0) {
                        pRaw = (1.0 - jStat.studentt.cdf(Math.abs(tStat), df)) * 2.0;
                    }

                    comparisons.push({ g1, g2, pRaw });
                }
            }

            const numComparisons = comparisons.length;
            const tableRows = comparisons.map(comp => {
                const pAdj = Math.min(1.0, comp.pRaw * numComparisons);
                let s = 'n.s.';
                if (pAdj < 0.01) s = '**';
                else if (pAdj < 0.05) s = '*';
                else if (pAdj < 0.1) s = '†';

                if (pAdj < 0.1) {
                    significantPairs.push({ g1: comp.g1, g2: comp.g2, p: pAdj, sign: s });
                }

                return `<tr><td>${comp.g1} - ${comp.g2}</td><td>${comp.pRaw.toFixed(4)}</td><td>${pAdj.toFixed(4)}</td><td>${s}</td></tr>`;
            }).join('');

            html += `<table class="table table-sm">
                <thead><tr><th>比較</th><th>p(raw)</th><th>p(adj)</th><th>判定</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>`;
        }

        // 可視化（棒グラフ + エラーバー + ブラケット）
        const plotId = `plot-${numVar.replace(/[^a-zA-Z0-9]/g, '-')}`;
        html += `<div id="${plotId}" class="plot-container" style="height: 500px;"></div>`;
        html += `</div>`; // End result-card
        resultsContainer.innerHTML += html;

        // Plotly描画
        setTimeout(() => {
            const xVals = validGroups;
            const yMeans = validGroups.map(g => jStat.mean(groupDataMap[g]));
            const yErrs = validGroups.map(g => {
                const arr = groupDataMap[g];
                return jStat.stdev(arr, true) / Math.sqrt(arr.length); // 標準誤差
            });

            const trace = {
                x: xVals,
                y: yMeans,
                type: 'bar',
                error_y: {
                    type: 'data',
                    array: yErrs,
                    visible: true
                },
                marker: { color: 'skyblue' }
            };

            const layout = {
                title: `${numVar} by ${catVar}`,
                yaxis: { title: numVar },
                xaxis: { title: catVar },
                font: { family: "Inter, sans-serif" },
                showlegend: false
            };

            // ブラケット描画
            if (significantPairs.length > 0) {
                const annotations = [];
                const shapes = [];

                // y軸の最大値を計算してスペース確保
                const maxY = Math.max(...validGroups.map((g, i) => yMeans[i] + yErrs[i]));
                const yRange = maxY - Math.min(...validGroups.map((g, i) => yMeans[i] - yErrs[i])) || 1;
                let topY = maxY;
                const step = yRange * 0.15;

                // ソート: 距離が近いものを下に（重なり防止の簡易ロジック）
                // 実際はPython版のように複雑なレベル管理が必要だが、ここでは簡易的に積み上げ
                significantPairs.forEach((pair, idx) => {
                    const idx1 = xVals.indexOf(pair.g1);
                    const idx2 = xVals.indexOf(pair.g2);
                    const x0 = Math.min(idx1, idx2);
                    const x1 = Math.max(idx1, idx2);

                    const bracketY = topY + step * (idx + 1);

                    // 線
                    shapes.push({
                        type: 'path',
                        path: `M ${x0},${maxY + step * 0.2} L ${x0},${bracketY} L ${x1},${bracketY} L ${x1},${maxY + step * 0.2}`,
                        line: { color: 'black' },
                        xref: 'x', yref: 'y',
                        xsizemode: 'scaled' // x is index in category axis? No, discrete axis relies on index? 
                        // Plotly categorical axis uses values as x. 
                    });
                    // IMPORTANT: For categorical axis, x values are the category strings. 
                    // Shapes with categorical x needs xanchor? Or we need to map to numbers?
                    // Plotly shape x with categorical axis is tricky. 
                    // Use trace x index approach if possible or category names.
                    // Actually Plotly accepts category names for x0/x1 if axis is categorical.

                    shapes.push({
                        type: 'line',
                        x0: pair.g1, y0: bracketY - step * 0.1,
                        x1: pair.g1, y1: bracketY,
                        xref: 'x', yref: 'y', line: { color: 'black' }
                    });
                    shapes.push({
                        type: 'line',
                        x0: pair.g2, y0: bracketY - step * 0.1,
                        x1: pair.g2, y1: bracketY,
                        xref: 'x', yref: 'y', line: { color: 'black' }
                    });
                    shapes.push({
                        type: 'line',
                        x0: pair.g1, y0: bracketY,
                        x1: pair.g2, y1: bracketY,
                        xref: 'x', yref: 'y', line: { color: 'black' }
                    });

                    annotations.push({
                        x: (idx1 + idx2) / 2, // Interpolation logic might fail with strings
                        // For categorical, we might need numeric mapping or rely on Plotly's internal mapping.
                        // Safest: Use layout.xaxis.type = 'category' defaults. 
                        // Actually, x position for annotation on categorical axis: use the category name? No, midpoint.
                        // We assume simple equidistant categories. 
                        // Let's keep it simple: just text at top if brackets are hard.
                        // OR: try to place annotation on one of the bars.
                        // Python code does complex coordinate calc.

                        // Fallback: Just display significant pairs in text if chart is complex. 
                        // Trying to render bracket...
                        // If we can't reliably do brackets in simple JS without heavy logic, maybe valid to skip?
                        // The prompt asked for "compliance". Python has brackets.
                        // Let's attempt to use numeric index for x if we set x as numbers and ticktext as labels.
                    });
                });

                // Re-setup trace to use numeric x for easier shape drawing
                trace.x = xVals.map((_, i) => i);
                layout.xaxis = {
                    tickvals: xVals.map((_, i) => i),
                    ticktext: xVals,
                    title: catVar
                };

                // Now we can use numbers for shapes
                significantPairs.forEach((pair, idx) => {
                    const idx1 = xVals.indexOf(pair.g1);
                    const idx2 = xVals.indexOf(pair.g2);

                    const bracketH = step * 0.5;
                    const levelY = topY + step * (idx + 0.5);
                    const textY = levelY + step * 0.2;

                    shapes.push({
                        type: 'path',
                        path: `M ${idx1},${yMeans[idx1] + yErrs[idx1]} L ${idx1},${levelY} L ${idx2},${levelY} L ${idx2},${yMeans[idx2] + yErrs[idx2]}`,
                        line: { color: 'black' }
                    });

                    annotations.push({
                        x: (idx1 + idx2) / 2,
                        y: textY,
                        text: `p < ${pair.p.toFixed(3)} ${pair.sign}`,
                        showarrow: false,
                        xanchor: 'center',
                        yanchor: 'bottom'
                    });
                });

                layout.shapes = shapes;
                layout.annotations = annotations;
                layout.yaxis.range = [0, topY + step * (significantPairs.length + 1)]; // Extend y axis
            }

            Plotly.newPlot(plotId, [trace], layout);
        }, 0);

    });
}