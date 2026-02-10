import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml } from '../utils.js';
// import { MultiSelect } from '../components/MultiSelect.js'; // REMOVED

// let multiSelectInstance = null; // REMOVED

/** Returns array of ranks (average rank for ties). */
function rankData(arr) {
    const n = arr.length;
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    let r = 0;
    while (r < n) {
        let s = r;
        while (s + 1 < n && indexed[s + 1].v === indexed[s].v) s++;
        const avgRank = 0.5 * (r + s) + 1;
        for (let j = r; j <= s; j++) ranks[indexed[j].i] = avgRank;
        r = s + 1;
    }
    return ranks;
}

/**
 * 95% CI for correlation using Fisher z-transform.
 * z = 0.5*ln((1+r)/(1-r)), SE = 1/sqrt(n-3), CI = tanh(z ± 1.96*SE)
 * Returns { lower, upper } or { lower: NaN, upper: NaN } if n <= 3 or |r| >= 1.
 */
function fisherZCI(r, n) {
    if (n <= 3 || Math.abs(r) >= 1) return { lower: NaN, upper: NaN };
    const rClamp = Math.max(-0.9999, Math.min(0.9999, r));
    const z = 0.5 * Math.log((1 + rClamp) / (1 - rClamp));
    const se = 1 / Math.sqrt(n - 3);
    const margin = 1.96 * se;
    const tanh = (x) => (Math.exp(2 * x) - 1) / (Math.exp(2 * x) + 1);
    return { lower: tanh(z - margin), upper: tanh(z + margin) };
}

// 相関マトリックスの計算（ピアソン・スピアマン両方、95%信頼区間付き）
// options.useListwise === true のときは欠損がある行を除いた上で全変数に同じNで計算（因子分析・PCA用）
export function calculateCorrelationMatrix(variables, currentData, options = {}) {
    const useListwise = options.useListwise === true;
    const data = useListwise
        ? currentData.filter(row => variables.every(v => {
            const val = row[v];
            return val != null && !isNaN(val);
        }))
        : currentData;

    const N = variables.length;
    const matrix = Array(N).fill(0).map(() => Array(N).fill(0));
    const pValues = Array(N).fill(0).map(() => Array(N).fill(0));
    const matrixSpearman = Array(N).fill(0).map(() => Array(N).fill(0));
    const pValuesSpearman = Array(N).fill(0).map(() => Array(N).fill(0));
    const nValues = Array(N).fill(0).map(() => Array(N).fill(0));
    const ciLower = Array(N).fill(0).map(() => Array(N).fill(0));
    const ciUpper = Array(N).fill(0).map(() => Array(N).fill(0));
    const ciLowerSpearman = Array(N).fill(0).map(() => Array(N).fill(0));
    const ciUpperSpearman = Array(N).fill(0).map(() => Array(N).fill(0));

    function setPValue(r, numPairs, pValMatrix, i, j) {
        if (Math.abs(r) === 1) {
            pValMatrix[i][j] = pValMatrix[j][i] = 0;
        } else {
            const t = r * Math.sqrt((numPairs - 2) / (1 - r * r));
            const df = numPairs - 2;
            const p = jStat.studentt.cdf(-Math.abs(t), df) * 2;
            pValMatrix[i][j] = pValMatrix[j][i] = p;
        }
    }

    for (let i = 0; i < N; i++) {
        for (let j = i; j < N; j++) {
            if (i === j) {
                matrix[i][j] = matrixSpearman[i][j] = 1;
                pValues[i][j] = pValuesSpearman[i][j] = 0;
                ciLower[i][j] = ciUpper[i][j] = ciLowerSpearman[i][j] = ciUpperSpearman[i][j] = 1;
                nValues[i][j] = useListwise ? data.length : data.map(r => r[variables[i]]).filter(v => v != null && !isNaN(v)).length;
                continue;
            }

            const var1 = variables[i];
            const var2 = variables[j];

            const pairs = data
                .map(r => ({ x: r[var1], y: r[var2] }))
                .filter(p => p.x != null && !isNaN(p.x) && p.y != null && !isNaN(p.y));

            const numPairs = pairs.length;
            nValues[i][j] = nValues[j][i] = numPairs;

            if (numPairs < 3) {
                matrix[i][j] = matrix[j][i] = NaN;
                pValues[i][j] = pValues[j][i] = NaN;
                matrixSpearman[i][j] = matrixSpearman[j][i] = NaN;
                pValuesSpearman[i][j] = pValuesSpearman[j][i] = NaN;
                ciLower[i][j] = ciUpper[i][j] = ciLower[j][i] = ciUpper[j][i] = NaN;
                ciLowerSpearman[i][j] = ciUpperSpearman[i][j] = ciLowerSpearman[j][i] = ciUpperSpearman[j][i] = NaN;
            } else {
                const x = pairs.map(p => p.x);
                const y = pairs.map(p => p.y);
                const rPearson = jStat.corrcoeff(x, y);
                matrix[i][j] = matrix[j][i] = rPearson;
                setPValue(rPearson, numPairs, pValues, i, j);
                const pearsonCI = fisherZCI(rPearson, numPairs);
                ciLower[i][j] = ciLower[j][i] = pearsonCI.lower;
                ciUpper[i][j] = ciUpper[j][i] = pearsonCI.upper;

                const rx = rankData(x);
                const ry = rankData(y);
                const rSpearman = jStat.corrcoeff(rx, ry);
                matrixSpearman[i][j] = matrixSpearman[j][i] = rSpearman;
                setPValue(rSpearman, numPairs, pValuesSpearman, i, j);
                const spearmanCI = fisherZCI(rSpearman, numPairs);
                ciLowerSpearman[i][j] = ciLowerSpearman[j][i] = spearmanCI.lower;
                ciUpperSpearman[i][j] = ciUpperSpearman[j][i] = spearmanCI.upper;
            }
        }
    }
    return {
        matrix,
        pValues,
        matrixSpearman,
        pValuesSpearman,
        nValues,
        ciLower,
        ciUpper,
        ciLowerSpearman,
        ciUpperSpearman
    };
}

// 現在選択されている相関方法（ピアソン / スピアマン）
let currentCorrelationMethod = 'pearson';
// 直前の分析結果（方法切り替え時に再描画するため）
let lastCorrelationState = null;

function getActiveMatrixAndCI(matrixData) {
    if (currentCorrelationMethod === 'spearman') {
        return {
            matrix: matrixData.matrixSpearman,
            pValues: matrixData.pValuesSpearman,
            ciLower: matrixData.ciLowerSpearman,
            ciUpper: matrixData.ciUpperSpearman
        };
    }
    return {
        matrix: matrixData.matrix,
        pValues: matrixData.pValues,
        ciLower: matrixData.ciLower,
        ciUpper: matrixData.ciUpper
    };
}

function ensureMethodSelector() {
    const container = document.getElementById('correlation-method-selector');
    if (!container) return;
    const isSpearman = currentCorrelationMethod === 'spearman';
    container.innerHTML = `
        <label style="margin-right: 1rem; font-weight: bold;">相関の種類:</label>
        <label style="margin-right: 1rem;"><input type="radio" name="correlation-method" value="pearson" ${!isSpearman ? 'checked' : ''}> ピアソン（積率相関）</label>
        <label><input type="radio" name="correlation-method" value="spearman" ${isSpearman ? 'checked' : ''}> スピアマン（順位相関）</label>
    `;
    container.querySelectorAll('input[name="correlation-method"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            currentCorrelationMethod = radio.value;
            if (lastCorrelationState) {
                renderCorrelationByMethod(lastCorrelationState.selectedVars, lastCorrelationState.currentData, lastCorrelationState.matrixData);
            }
        });
    });
}

function renderCorrelationByMethod(selectedVars, currentData, matrixData) {
    const { matrix, pValues, ciLower, ciUpper } = getActiveMatrixAndCI(matrixData);
    const nValues = matrixData.nValues;
    const methodLabel = currentCorrelationMethod === 'spearman' ? 'スピアマン' : 'ピアソン';

    const corrTableHtml = createCorrelationTable(selectedVars, matrix, pValues, nValues, ciLower, ciUpper, methodLabel);
    document.getElementById('correlation-table').innerHTML = corrTableHtml;

    plotHeatmap(selectedVars, matrix, methodLabel);
    plotScatterMatrix(selectedVars, currentData, { ...matrixData, matrix, pValues });

    const headersAPA = ["Variable", ...selectedVars.map((_, i) => `${i + 1}`)];
    const rowsAPA = selectedVars.map((varName, i) => {
        const row = [`${i + 1}. ${varName}`];
        for (let j = 0; j < selectedVars.length; j++) {
            if (j === i) {
                row.push('-');
            } else {
                let r = matrix[i][j];
                if (isNaN(r)) {
                    row.push('NaN');
                } else {
                    let rText = r.toFixed(2);
                    const p = pValues[i][j];
                    if (p < 0.01) rText += '**';
                    else if (p < 0.05) rText += '*';
                    row.push(rText);
                }
            }
        }
        return row;
    });
    const noteAPA = `*<em>p</em> < .05. **<em>p</em> < .01.`;
    document.getElementById('reporting-table-container-corr').innerHTML =
        generateAPATableHtml('corr-apa-table', `Table 1. ${methodLabel} Correlation Matrix`, headersAPA, rowsAPA, noteAPA);
}

// 相関分析の実行
function runCorrelationAnalysis(currentData) {
    const varsSelect = document.getElementById('correlation-vars');
    const selectedVars = varsSelect ? Array.from(varsSelect.selectedOptions).map(o => o.value) : [];

    if (selectedVars.length < 2) {
        alert('少なくとも2つの変数を選択してください。');
        return;
    }

    const matrixData = calculateCorrelationMatrix(selectedVars, currentData);
    const { matrix, pValues, ciLower, ciUpper } = getActiveMatrixAndCI(matrixData);
    const nValuesArr = matrixData.nValues;

    lastCorrelationState = { matrixData, selectedVars, currentData };
    ensureMethodSelector();

    const methodLabel = currentCorrelationMethod === 'spearman' ? 'スピアマン' : 'ピアソン';
    const corrTableHtml = createCorrelationTable(selectedVars, matrix, pValues, nValuesArr, ciLower, ciUpper, methodLabel);
    document.getElementById('correlation-table').innerHTML = corrTableHtml;

    // Interpretation Section
    let interpretationHtml = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';
    let significantCount = 0;

    for (let i = 0; i < selectedVars.length; i++) {
        for (let j = i + 1; j < selectedVars.length; j++) {
            const r = matrix[i][j];
            const p = pValues[i][j];
            const var1 = selectedVars[i];
            const var2 = selectedVars[j];

            if (!isNaN(r) && !isNaN(p)) {
                // Determine if we should show interpretation (e.g. only significant ones or strong trends)
                if (p < 0.05) {
                    significantCount++;
                    interpretationHtml += `<li style="margin-bottom: 0.5rem;">${InterpretationHelper.interpretCorrelation(r, p, var1, var2)}</li>`;
                }
            }
        }
    }
    interpretationHtml += '</ul>';
    if (significantCount === 0) {
        interpretationHtml = '<p>統計的に有意な相関は見られませんでした。</p>';
    }

    // Add Interpretation Area
    const resultsContainer = document.getElementById('analysis-results');
    let interpSection = document.getElementById('correlation-interpretation');
    if (!interpSection) {
        interpSection = document.createElement('div');
        interpSection.id = 'correlation-interpretation';
        interpSection.style.background = 'white';
        interpSection.style.padding = '1.5rem';
        interpSection.style.borderRadius = '8px';
        interpSection.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        interpSection.style.marginBottom = '2rem';
        interpSection.innerHTML = `
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div id="interpretation-content"></div>
        `;
        // Insert after table container (first element in resultsContainer)
        const firstChild = resultsContainer.firstElementChild;
        if (firstChild) resultsContainer.insertBefore(interpSection, firstChild.nextElementSibling);
        else resultsContainer.appendChild(interpSection);
    }
    document.getElementById('interpretation-content').innerHTML = interpretationHtml;

    document.getElementById('analysis-results').style.display = 'block';

    plotHeatmap(selectedVars, matrix, methodLabel);
    plotScatterMatrix(selectedVars, currentData, { ...matrixData, matrix, pValues });

    const headersAPA = ["Variable", ...selectedVars.map((_, i) => `${i + 1}`)];
    const rowsAPA = selectedVars.map((varName, i) => {
        const row = [`${i + 1}. ${varName}`];
        for (let j = 0; j < selectedVars.length; j++) {
            if (j === i) {
                row.push('-');
            } else {
                let r = matrix[i][j];
                if (isNaN(r)) {
                    row.push('NaN');
                } else {
                    let rText = r.toFixed(2);
                    const p = pValues[i][j];
                    if (p < 0.01) rText += '**';
                    else if (p < 0.05) rText += '*';
                    row.push(rText);
                }
            }
        }
        return row;
    });
    const noteAPA = `*<em>p</em> < .05. **<em>p</em> < .01.`;
    document.getElementById('reporting-table-container-corr').innerHTML =
        generateAPATableHtml('corr-apa-table', `Table 1. ${methodLabel} Correlation Matrix`, headersAPA, rowsAPA, noteAPA);

    const controlsContainer = document.getElementById('visualization-controls-container');
    controlsContainer.innerHTML = '';
    const { axisControl, titleControl } = createVisualizationControls(controlsContainer);

    if (axisControl && titleControl) {
        const updatePlots = () => {
            const active = getActiveMatrixAndCI(matrixData);
            plotHeatmap(selectedVars, active.matrix, currentCorrelationMethod === 'spearman' ? 'スピアマン' : 'ピアソン');
            plotScatterMatrix(selectedVars, currentData, { ...matrixData, matrix: active.matrix, pValues: active.pValues });
        };
        axisControl.addEventListener('change', updatePlots);
        titleControl.addEventListener('change', updatePlots);
    }
}

function createCorrelationTable(variables, matrix, pValues, nValues, ciLower, ciUpper, methodLabel) {
    const ciLowerArr = ciLower || [];
    const ciUpperArr = ciUpper || [];
    const label = methodLabel ? `${methodLabel} ` : '';

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${variables.map(v => `<th>${v}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((rowVar, i) => {
        html += `<tr><td><strong>${rowVar}</strong></td>`;
        variables.forEach((colVar, j) => {
            const r = matrix[i][j];
            const p = pValues[i][j];
            const low = ciLowerArr[i] && ciLowerArr[i][j];
            const high = ciUpperArr[i] && ciUpperArr[i][j];
            const hasCI = typeof low === 'number' && typeof high === 'number' && !isNaN(low) && !isNaN(high);
            let style = '';
            if (!isNaN(r)) {
                if (Math.abs(r) > 0.7) style = 'background: rgba(30, 144, 255, 0.2); font-weight: bold;';
                else if (Math.abs(r) > 0.4) style = 'background: rgba(30, 144, 255, 0.1);';
            }

            let sig = '';
            if (p < 0.01) sig = '**';
            else if (p < 0.05) sig = '*';
            else if (p < 0.1) sig = '†';

            let cell = isNaN(r) ? '-' : `${r.toFixed(3)}${sig}`;
            if (hasCI && i !== j) {
                cell += `<br><span style="font-size: 0.85em; color: #64748b;">95%CI [${low.toFixed(3)}, ${high.toFixed(3)}]</span>`;
            }
            html += `<td style="${style}">${cell}</td>`;
        });
        html += '</tr>';
    });

    html += `</tbody></table></div>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">${label}相関係数・95%信頼区間（Fisher z変換）。p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
    `;

    html += `
        <div style="margin-top: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-info-circle"></i> 相関係数の解釈
            </h5>
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;"><strong>0.7 〜 1.0</strong>: 強い正の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>0.4 〜 0.7</strong>: 中程度の正の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>0.2 〜 0.4</strong>: 弱い正の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.2 〜 0.2</strong>: ほとんど相関なし</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.4 〜 -0.2</strong>: 弱い負の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.7 〜 -0.4</strong>: 中程度の負の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-1.0 〜 -0.7</strong>: 強い負の相関</li>
                <li style="margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                    「*」「**」などの記号は統計的有意性を示します。<br>
                    <strong>**</strong>: 1%水準で有意 (p < 0.01)<br>
                    <strong>*</strong>: 5%水準で有意 (p < 0.05)<br>
                    <strong>†</strong>: 10%水準で有意傾向 (p < 0.1)
                </li>
            </ul>
        </div>
    `;

    return html;
}

function plotHeatmap(variables, matrix, methodLabel) {
    const barTitle = methodLabel ? `${methodLabel}相関係数` : '相関係数';
    const data = [{
        z: matrix,
        x: variables,
        y: variables,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmin: -1,
        zmax: 1,
        showscale: true,
        colorbar: {
            title: barTitle,
            titleside: 'right',
            thickness: 15,
            len: 0.8
        }
    }];

    // 変数の数に応じてサイズを動的に調整
    const n = variables.length;
    const baseCellSize = 80; // 基本セルサイズ
    const minSize = 450;
    const maxSize = 900;
    const calculatedSize = Math.max(minSize, Math.min(maxSize, n * baseCellSize + 200));

    // フォントサイズも変数の数に応じて調整
    const fontSize = Math.max(10, Math.min(16, 18 - n));

    const layout = {
        title: '',
        height: calculatedSize,
        width: calculatedSize + 100, // カラーバー分の余白
        // Adjust margins to prevent long labels from being cut off
        margin: { l: 150, r: 80, b: 150, t: 50 },
        xaxis: {
            tickangle: -45, // Rotate x-axis labels to prevent overlap
            tickfont: { size: Math.max(10, 14 - Math.floor(n / 3)) }
        },
        yaxis: {
            automargin: true, // Automatically adjust margin for y-axis labels
            tickfont: { size: Math.max(10, 14 - Math.floor(n / 3)) }
        },
        annotations: []
    };

    // セル内に相関係数の値をアノテーションとして追加
    for (let i = 0; i < variables.length; i++) {
        for (let j = 0; j < variables.length; j++) {
            const value = matrix[i][j];
            // 背景色が暗い（強い相関）場合は白文字、明るい場合は黒文字
            // RdBuスケール: -1は赤(暗)、0は白(明)、1は青(暗)
            const absValue = Math.abs(value);
            const textColor = absValue > 0.5 ? 'white' : 'black';

            layout.annotations.push({
                xref: 'x',
                yref: 'y',
                x: variables[j],
                y: variables[i],
                text: isNaN(value) ? '-' : value.toFixed(2),
                font: {
                    family: 'Arial',
                    size: fontSize,
                    color: textColor,
                    weight: absValue >= 0.7 ? 'bold' : 'normal'
                },
                showarrow: false
            });
        }
    }

    // 軸ラベルとタイトルの表示切り替え
    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (!showAxisLabels) {
        layout.xaxis.title = '';
        layout.xaxis.showticklabels = false;
        layout.yaxis.title = '';
        layout.yaxis.showticklabels = false;
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation('相関ヒートマップ');
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('correlation-heatmap', data, layout, createPlotlyConfig('相関ヒートマップ', variables));
}

function plotScatterMatrix(variables, currentData, matrixData) {
    // データの準備（最大1000件に制限）
    const plotData = currentData.slice(0, 1000);
    const n = variables.length;

    // 相関行列の計算（テキスト表示用）
    const { matrix, pValues } = matrixData;

    const traces = [];
    const width = Math.max(700, 280 * n);
    const height = Math.max(700, 280 * n);

    const layout = {
        title: '',
        height: height,
        width: width,
        showlegend: false,
        plot_bgcolor: '#f8fafc',
        // 最下行の横軸ラベルと変数名の両方を表示するため下余白を確保
        margin: { l: 100, r: 40, t: 40, b: 120 },
        annotations: []
    };

    // ドメイン計算 (目盛りラベル表示のためギャップ拡大)
    const gap = 0.07;
    const size = (1 - (n - 1) * gap) / n;

    // グリッド作成用のループ
    for (let i = 0; i < n; i++) { // 行 (Y軸に対応)
        for (let j = 0; j < n; j++) { // 列 (X軸に対応)

            // 軸のID生成
            const xaxis = `x${i * n + j + 1}`;
            const yaxis = `y${i * n + j + 1}`;

            const varRow = variables[i]; // Y variable
            const varCol = variables[j]; // X variable

            const xDomainStart = j * (size + gap);
            const xDomainEnd = xDomainStart + size;
            const yDomainStart = 1 - (i + 1) * (size + gap) + gap; // 上から配置
            const yDomainEnd = yDomainStart + size;

            const showXTicks = (i === n - 1); // 最下行のみ横軸目盛り表示
            const showYTicks = (j === 0);    // 最左列のみ縦軸目盛り表示

            // トレースの 'x1' は layout の 'xaxis1' に対応する
            const axisNum = i * n + j + 1;
            const xAxisKey = `xaxis${axisNum}`;
            const yAxisKey = `yaxis${axisNum}`;

            layout[xAxisKey] = {
                domain: [xDomainStart, xDomainEnd],
                anchor: `y${axisNum}`,
                showgrid: false,
                zeroline: false,
                showticklabels: showXTicks,
                tickfont: { size: 9, color: '#555' },
                nticks: 5,
                ticks: showXTicks ? 'outside' : '',
                side: 'bottom',
                title: { text: '' }
            };

            layout[yAxisKey] = {
                domain: [yDomainStart, yDomainEnd],
                anchor: `x${axisNum}`,
                showgrid: false,
                zeroline: false,
                showticklabels: showYTicks,
                tickfont: { size: 9, color: '#555' },
                nticks: 5,
                ticks: showYTicks ? 'outside' : '',
                side: 'left',
                title: { text: '' }
            };

            // トレース追加
            if (i === j) {
                // 対角線：ヒストグラム
                traces.push({
                    x: plotData.map(row => row[varRow]),
                    type: 'histogram',
                    xaxis: xaxis,
                    yaxis: yaxis,
                    marker: { color: '#87CEEB' }, // light blue
                    showlegend: false
                });
            } else if (i < j) {
                // 右上：相関係数テキスト
                const r = matrix[i][j];
                const p = pValues[i][j];
                let sig = '';
                if (p < 0.01) sig = '**';
                else if (p < 0.05) sig = '*';
                else if (p < 0.1) sig = '†';

                const absCorr = Math.abs(r);
                let textColor = 'black';
                let weight = 'normal';
                if (absCorr >= 0.7) { textColor = '#dc2626'; weight = 'bold'; }
                else if (absCorr >= 0.4) { textColor = '#ea580c'; }

                traces.push({
                    x: [0.5],
                    y: [0.5],
                    text: [isNaN(r) ? '-' : `${r.toFixed(3)}${sig}`],
                    mode: 'text',
                    xaxis: xaxis,
                    yaxis: yaxis,
                    type: 'scatter',
                    textfont: {
                        size: 16,
                        color: textColor,
                        weight: weight
                    },
                    hoverinfo: 'none'
                });

                // テキスト表示用の軸設定（範囲固定）
                const txtAxisNum = i * n + j + 1;
                const txtXKey = `xaxis${txtAxisNum}`;
                const txtYKey = `yaxis${txtAxisNum}`;
                layout[txtXKey].range = [0, 1];
                layout[txtXKey].showticklabels = false;
                layout[txtYKey].range = [0, 1];
                layout[txtYKey].showticklabels = false;

            } else {
                // 左下：散布図

                traces.push({
                    x: plotData.map(row => row[varCol]),
                    y: plotData.map(row => row[varRow]),
                    mode: 'markers',
                    type: 'scatter',
                    xaxis: xaxis,
                    yaxis: yaxis,
                    marker: {
                        size: 4,
                        color: '#1e90ff',
                        opacity: 0.6
                    },
                    hoverinfo: 'text',
                    text: plotData.map((_, idx) => `${varCol}: ${plotData[idx][varCol]}<br>${varRow}: ${plotData[idx][varRow]}`)
                });
            }
        }
    }

    // アノテーションによる軸ラベルの追加
    for (let k = 0; k < n; k++) {
        // X col labels (variable[k])
        const xStart = k * (size + gap);
        const xCenter = xStart + size / 2;

        // Y row labels (variable[k])
        const yStart = 1 - (k + 1) * (size + gap) + gap;
        const yCenter = yStart + size / 2;

        // マージンに合わせたラベル位置（tickの下に変数名が来るよう調整）
        const yLabelX = -(60 / width);
        const xLabelY = -(80 / height);

        // X-axis Label (Bottom)
        layout.annotations.push({
            text: variables[k],
            xref: 'paper', yref: 'paper',
            x: xCenter, y: xLabelY,
            xanchor: 'center', yanchor: 'top',
            showarrow: false,
            font: { size: 12, weight: 'bold' }
        });

        // Y-axis Label (Left)
        layout.annotations.push({
            text: variables[k],
            xref: 'paper', yref: 'paper',
            x: yLabelX, y: yCenter,
            xanchor: 'right', yanchor: 'middle',
            showarrow: false,
            font: { size: 12, weight: 'bold' }
        });
    }

    // 軸ラベルとタイトルの表示切り替え
    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (!showAxisLabels) {
        Object.keys(layout).forEach(key => {
            if (key.startsWith('xaxis') || key.startsWith('yaxis')) {
                if (layout[key].title) {
                    layout[key].title.text = '';
                }
            }
        });
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation('散布図行列（対角:ヒストグラム, 右上:相関係数, 左下:散布図）');
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('scatter-matrix', traces, layout, createPlotlyConfig('散布図行列', variables));
}

export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="correlation-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-project-diagram"></i> 相関分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">変数間の関係の強さを分析します</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 相関分析 (Correlation Analysis) とは？</strong>
                        <p>「身長が高いほど体重も重いか？」のように、2つの数値データの間に直線的な関係（一方が増えればもう一方も増える/減る）があるかを調べる分析です。</p>
                        <img src="image/correlation.png" alt="相関分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 「勉強時間」と「テストの点数」に関係があるか調べたいとき</li>
                        <li><i class="fas fa-check"></i> 「最高気温」と「アイスクリームの売上」に関係があるか調べたいとき</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>相関係数 (r):</strong> 関係の「強さ」と「向き」を表します（-1から+1）。
                            <ul>
                                <li>0.7以上: 強い正の相関（かなり関係がある）</li>
                                <li>0付近: 関係がない</li>
                                <li>-0.7以下: 強い負の相関（逆の関係がある）</li>
                            </ul>
                        </li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>相関係数 (r):</strong> -1から+1の範囲の値をとります。
                            <ul>
                                <li><strong>0.7 〜 1.0</strong>: 強い正の相関（一方が増ともう一方も強く増える）</li>
                                <li><strong>-0.7 〜 -1.0</strong>: 強い負の相関（一方が増えるともう一方は強く減る）</li>
                                <li><strong>0付近:</strong> 相関なし（関係性が見られない）</li>
                            </ul>
                        </li>
                    </ul>
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
                            <li><strong>ピアソン:</strong> 積率相関係数 \( r = \frac{\sum(x - \bar{x})(y - \bar{y})}{\sqrt{\sum(x-\bar{x})^2 \sum(y-\bar{y})^2}} \)。無相関検定: \( t = \frac{r\sqrt{n-2}}{\sqrt{1-r^2}} \) (df = n-2)。</li>
                            <li><strong>スピアマン:</strong> 順位相関。データを順位に変換し、順位についてピアソン r を計算。</li>
                            <li><strong>95%信頼区間:</strong> Fisher z 変換。\( z = 0.5\ln\frac{1+r}{1-r} \), \( \mathrm{SE} = 1/\sqrt{n-3} \), CI = \( \tanh(z \pm 1.96\,\mathrm{SE}) \)。</li>
                            <li>※ リストワイズ削除（欠損値がある行は除外）を適用しています。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="corr-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <div id="correlation-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-correlation-btn-container"></div>
            </div>

            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-table"></i> 相関行列
                    </h4>
                    <div id="correlation-method-selector" style="margin-bottom: 1rem;"></div>
                    <div id="correlation-table"></div>
                    <div style="margin-top: 1.5rem;">
                       <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                       <div id="reporting-table-container-corr"></div>
                    </div>
                </div>

                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="visualization-controls-container"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-th"></i> ヒートマップ
                    </h4>
                    <div id="correlation-heatmap"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-grip-horizontal"></i> 散布図行列
                    </h4>
                    <div id="scatter-matrix"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#corr-data-overview', currentData, characteristics, { initiallyCollapsed: true });



    createVariableSelector('correlation-vars-container', numericColumns, 'correlation-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('run-correlation-btn-container', '相関分析を実行', () => runCorrelationAnalysis(currentData), { id: 'run-correlation-btn' });
}