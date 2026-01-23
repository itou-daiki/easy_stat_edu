import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper } from '../utils.js';
// import { MultiSelect } from '../components/MultiSelect.js'; // REMOVED

// let multiSelectInstance = null; // REMOVED

// 相関マトリックスの計算
export function calculateCorrelationMatrix(variables, currentData) {
    const n = variables.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    const pValues = Array(n).fill(0).map(() => Array(n).fill(0));
    const nValues = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                matrix[i][j] = 1;
                pValues[i][j] = 0;
                const validData = currentData.map(r => r[variables[i]]).filter(v => v != null && !isNaN(v));
                nValues[i][j] = validData.length;
                continue;
            }

            const var1 = variables[i];
            const var2 = variables[j];

            const pairs = currentData
                .map(r => ({ x: r[var1], y: r[var2] }))
                .filter(p => p.x != null && !isNaN(p.x) && p.y != null && !isNaN(p.y));

            const numPairs = pairs.length;
            nValues[i][j] = nValues[j][i] = numPairs;

            if (numPairs < 3) {
                matrix[i][j] = matrix[j][i] = NaN;
                pValues[i][j] = pValues[j][i] = NaN;
            } else {
                const x = pairs.map(p => p.x);
                const y = pairs.map(p => p.y);
                const r = jStat.corrcoeff(x, y);
                matrix[i][j] = matrix[j][i] = r;

                // p-value calculation
                if (Math.abs(r) === 1) {
                    pValues[i][j] = pValues[j][i] = 0;
                } else {
                    const t = r * Math.sqrt((numPairs - 2) / (1 - r * r));
                    const df = numPairs - 2;
                    const p = jStat.studentt.cdf(-Math.abs(t), df) * 2;
                    pValues[i][j] = pValues[j][i] = p;
                }
            }
        }
    }
    return { matrix, pValues, nValues };
}

// 相関分析の実行
function runCorrelationAnalysis(currentData) {
    const varsSelect = document.getElementById('corr-vars-select');
    const selectedVars = varsSelect ? Array.from(varsSelect.selectedOptions).map(o => o.value) : [];

    if (selectedVars.length < 2) {
        alert('少なくとも2つの変数を選択してください。');
        return;
    }

    const { matrix, pValues, nValues } = calculateCorrelationMatrix(selectedVars, currentData);

    const corrTableHtml = createCorrelationTable(selectedVars, matrix, pValues, nValues);
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

    renderCorrelationHeatmap(selectedVars, matrix);
    renderScatterMatrix(selectedVars, currentData);

    const controlsContainer = document.getElementById('visualization-controls-container');
    controlsContainer.innerHTML = '';
    const { axisControl, titleControl } = createVisualizationControls(controlsContainer);

    if (axisControl && titleControl) {
        const updatePlots = () => {
            plotHeatmap(selectedVars, matrix);
            plotScatterMatrix(selectedVars, currentData, matrixData);
        };
        axisControl.addEventListener('change', updatePlots);
        titleControl.addEventListener('change', updatePlots);
    }
}

function displayResults(variables, matrix, pValues) {
    const container = document.getElementById('correlation-table');
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
            let style = '';
            if (!isNaN(r)) {
                if (Math.abs(r) > 0.7) style = 'background: rgba(30, 144, 255, 0.2); font-weight: bold;';
                else if (Math.abs(r) > 0.4) style = 'background: rgba(30, 144, 255, 0.1);';
            }

            let sig = '';
            if (p < 0.01) sig = '**';
            else if (p < 0.05) sig = '*';
            else if (p < 0.1) sig = '†';

            html += `<td style="${style}">${isNaN(r) ? '-' : r.toFixed(3)}${sig}</td>`;
        });
        html += '</tr>';
    });

    html += `</tbody></table></div>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
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

    container.innerHTML = html;
}

function plotHeatmap(variables, matrix) {
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
            title: '相関係数',
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
    const layout = {
        title: '',
        height: Math.max(600, 250 * n), // 最小サイズ600px、変数ごと250px確保
        width: Math.max(600, 250 * n),
        showlegend: false,
        plot_bgcolor: '#f8fafc',
        margin: { l: 60, r: 60, t: 80, b: 150 }, // Increased bottom margin for bottom title
        annotations: []
    };

    // ドメイン計算 (余白 gap を考慮)
    const gap = 0.05;
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

            layout[`xaxis${i * n + j + 1}`] = {
                domain: [xDomainStart, xDomainEnd],
                showgrid: false,
                zeroline: false,
                showticklabels: i === n - 1, // 一番下の行だけラベル表示
                automargin: true,
                side: 'bottom',
                title: { text: '' }
            };

            layout[`yaxis${i * n + j + 1}`] = {
                domain: [yDomainStart, yDomainEnd],
                showgrid: false,
                zeroline: false,
                showticklabels: j === 0, // 一番左の列だけラベル表示
                automargin: true,
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
                layout[`xaxis${i * n + j + 1}`].range = [0, 1];
                layout[`xaxis${i * n + j + 1}`].showticklabels = false;
                layout[`yaxis${i * n + j + 1}`].range = [0, 1];
                layout[`yaxis${i * n + j + 1}`].showticklabels = false;

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

        // X-axis Label (Bottom)
        layout.annotations.push({
            text: variables[k],
            xref: 'paper', yref: 'paper',
            x: xCenter, y: -0.06,
            xanchor: 'center', yanchor: 'top',
            showarrow: false,
            font: { size: 14, weight: 'bold' }
        });

        // Y-axis Label (Left)
        layout.annotations.push({
            text: variables[k],
            xref: 'paper', yref: 'paper',
            x: -0.07, y: yCenter,
            xanchor: 'right', yanchor: 'middle',
            showarrow: false,
            font: { size: 14, weight: 'bold' }
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
                        <p>2つの変数の間に「一方が増えればもう一方も増える（または減る）」という直線的な関係があるかを調べる手法です。「身長と体重」「気温とビール販売量」などの関係を見ます。</p>
                        <img src="image/correlation.png" alt="相関分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>「身長」と「体重」に関係があるか知りたい</li>
                        <li>「勉強時間」と「テストの点数」に関係があるか調べたい</li>
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

            <div id="corr-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <div style="padding: 1rem; background: #fafbfc; border-radius: 8px; margin-bottom: 1.5rem;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-check-square"></i> 分析する数値変数を選択（複数選択可、2つ以上）:
                    </label>
                    <div id="corr-vars-container"></div>
                </div>

                <div id="run-correlation-btn-container"></div>
            </div>

            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-table"></i> 相関行列
                    </h4>
                    <div id="correlation-table"></div>
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

    renderDataOverview('#corr-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('corr-vars-container', numericColumns, 'corr-vars-select', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択（複数選択可）:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('run-correlation-btn-container', '相関分析を実行', () => runCorrelationAnalysis(currentData), { id: 'run-correlation-btn' });
}