import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview } from '../utils.js';

// 相関マトリックスの計算
function calculateCorrelationMatrix(data, columns) {
    const n = columns.length;
    const corrMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j) {
                corrMatrix[i][j] = 1.0;
            } else {
                const col1 = columns[i];
                const col2 = columns[j];

                const pairs = data
                    .map(row => ({ x: row[col1], y: row[col2] }))
                    .filter(d => d.x != null && d.y != null && !isNaN(d.x) && !isNaN(d.y));

                const xVector = pairs.map(p => p.x);
                const yVector = pairs.map(p => p.y);

                if (xVector.length > 0) {
                    corrMatrix[i][j] = jStat.corrcoeff(xVector, yVector);
                } else {
                    corrMatrix[i][j] = 0;
                }
            }
        }
    }

    return corrMatrix;
}

// 相関マトリックス表の表示
function displayCorrelationMatrix(corrMatrix, columns) {
    const container = document.getElementById('correlation-matrix-section');

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 相関マトリックス
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数</th>
    `;

    columns.forEach(col => {
        tableHtml += `<th style="font-weight: bold; color: #1e90ff;">${col}</th>`;
    });

    tableHtml += `
                        </tr>
                    </thead>
                    <tbody>
    `;

    corrMatrix.forEach((row, i) => {
        tableHtml += `<tr><td style="font-weight: bold; color: #1e90ff;">${columns[i]}</td>`;
        row.forEach(val => {
            tableHtml += `<td>${val.toFixed(4)}</td>`;
        });
        tableHtml += '</tr>';
    });

    tableHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = tableHtml;
}

// ヒートマップの表示
function displayHeatmap(corrMatrix, columns) {
    const container = document.getElementById('heatmap-section');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-th"></i> 相関係数のヒートマップ
            </h4>
            <div id="heatmap-plot" class="plot-container"></div>
        </div>
    `;

    // アノテーションの作成
    const annotations = [];
    for (let i = 0; i < corrMatrix.length; i++) {
        for (let j = 0; j < corrMatrix[i].length; j++) {
            const value = corrMatrix[i][j];
            annotations.push({
                x: j,
                y: i,
                text: value.toFixed(2),
                showarrow: false,
                font: {
                    color: (value > -0.5 && value < 0.5) ? 'black' : 'white',
                    size: 12
                }
            });
        }
    }

    const trace = {
        z: corrMatrix,
        x: columns,
        y: columns,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmid: 0,
        colorbar: {
            title: '相関係数'
        }
    };

    const layout = {
        title: '相関係数のヒートマップ',
        annotations: annotations,
        xaxis: { side: 'bottom' },
        yaxis: { autorange: 'reversed' },
        width: Math.max(500, columns.length * 80),
        height: Math.max(500, columns.length * 80)
    };

    Plotly.newPlot('heatmap-plot', [trace], layout);
}

// 散布図行列の表示
function displayScatterMatrix(data, columns, corrMatrix) {
    const container = document.getElementById('scatter-matrix-section');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-scatter"></i> 散布図行列とヒストグラム
            </h4>
            <p style="color: #6b7280; margin-bottom: 1rem;">対角線: ヒストグラム、左下: 散布図、右上: 相関係数</p>
            <div id="scatter-matrix-plot" class="plot-container"></div>
        </div>
    `;

    const n = columns.length;
    const traces = [];
    const annotations = [];

    // 各セルに対してトレースを作成
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const var1 = columns[i];
            const var2 = columns[j];

            if (i === j) {
                // 対角線上: ヒストグラム
                const values = data.map(row => row[var1]).filter(v => v != null && !isNaN(v));
                traces.push({
                    type: 'histogram',
                    x: values,
                    name: var1,
                    showlegend: false,
                    marker: { color: 'rgba(102, 126, 234, 0.7)' },
                    xaxis: `x${i * n + j + 1}`,
                    yaxis: `y${i * n + j + 1}`
                });
            } else if (i > j) {
                // 左下三角: 散布図
                const pairs = data
                    .map(row => ({ x: row[var2], y: row[var1] }))
                    .filter(d => d.x != null && d.y != null && !isNaN(d.x) && !isNaN(d.y));

                traces.push({
                    type: 'scatter',
                    mode: 'markers',
                    x: pairs.map(p => p.x),
                    y: pairs.map(p => p.y),
                    name: `${var1} vs ${var2}`,
                    showlegend: false,
                    marker: { size: 4, color: 'rgba(102, 126, 234, 0.6)' },
                    xaxis: `x${i * n + j + 1}`,
                    yaxis: `y${i * n + j + 1}`
                });
            } else {
                // 右上三角: 相関係数をテキストで表示
                // 空のプロットを作成してアノテーションを追加
                traces.push({
                    type: 'scatter',
                    x: [0],
                    y: [0],
                    mode: 'markers',
                    marker: { size: 0, opacity: 0 },
                    showlegend: false,
                    xaxis: `x${i * n + j + 1}`,
                    yaxis: `y${i * n + j + 1}`
                });

                // 相関係数のアノテーション
                const correlation = corrMatrix[i][j];
                annotations.push({
                    text: `r = ${correlation.toFixed(3)}`,
                    xref: `x${i * n + j + 1}`,
                    yref: `y${i * n + j + 1}`,
                    x: 0,
                    y: 0,
                    showarrow: false,
                    font: {
                        size: 16,
                        color: '#1e90ff',
                        weight: 'bold'
                    },
                    xanchor: 'center',
                    yanchor: 'middle'
                });
            }
        }
    }

    // レイアウトの構築
    const layout = {
        title: '散布図行列とヒストグラム',
        showlegend: false,
        width: Math.max(600, n * 200),
        height: Math.max(600, n * 200),
        grid: {
            rows: n,
            columns: n,
            pattern: 'independent'
        },
        annotations: annotations
    };

    // 各軸のラベルを設定
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const axisNum = i * n + j + 1;
            const xaxis = axisNum === 1 ? 'xaxis' : `xaxis${axisNum}`;
            const yaxis = axisNum === 1 ? 'yaxis' : `yaxis${axisNum}`;

            // 右上三角は軸を非表示
            if (i < j) {
                layout[xaxis] = { visible: false };
                layout[yaxis] = { visible: false };
            } else {
                // 最下行のみx軸ラベルを表示
                if (i === n - 1) {
                    layout[xaxis] = { title: columns[j] };
                } else {
                    layout[xaxis] = { title: '' };
                }

                // 最左列のみy軸ラベルを表示
                if (j === 0) {
                    layout[yaxis] = { title: columns[i] };
                } else {
                    layout[yaxis] = { title: '' };
                }
            }
        }
    }

    Plotly.newPlot('scatter-matrix-plot', traces, layout);
}

// 解釈の補助
function displayInterpretation(corrMatrix, columns) {
    const container = document.getElementById('interpretation-section');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> 解釈の補助
            </h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>
    `;

    const contentContainer = document.getElementById('interpretation-content');
    let interpretationHtml = '';

    for (let i = 0; i < columns.length; i++) {
        for (let j = i + 1; j < columns.length; j++) {
            const col1 = columns[i];
            const col2 = columns[j];
            const correlation = corrMatrix[i][j];

            let description = `<p style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #1e90ff; border-radius: 4px;">`;
            description += `<strong style="color: #1e90ff;">【${col1}】と【${col2}】</strong>には `;

            if (correlation > 0.7) {
                description += `<span style="color: #059669; font-weight: bold;">強い正の相関がある</span> <span style="color: #6b7280;">(r=${correlation.toFixed(2)})</span>`;
            } else if (correlation > 0.3) {
                description += `<span style="color: #10b981; font-weight: bold;">中程度の正の相関がある</span> <span style="color: #6b7280;">(r=${correlation.toFixed(2)})</span>`;
            } else if (correlation > -0.3) {
                description += `<span style="color: #6b7280; font-weight: bold;">ほとんど相関がない</span> <span style="color: #6b7280;">(r=${correlation.toFixed(2)})</span>`;
            } else if (correlation > -0.7) {
                description += `<span style="color: #f59e0b; font-weight: bold;">中程度の負の相関がある</span> <span style="color: #6b7280;">(r=${correlation.toFixed(2)})</span>`;
            } else {
                description += `<span style="color: #dc2626; font-weight: bold;">強い負の相関がある</span> <span style="color: #6b7280;">(r=${correlation.toFixed(2)})</span>`;
            }

            description += '</p>';
            interpretationHtml += description;
        }
    }

    contentContainer.innerHTML = interpretationHtml;
}

// 分析の実行
function runAnalysis() {
    const selectedCols = Array.from(document.querySelectorAll('.variable-checkbox:checked'))
                              .map(cb => cb.value);

    if (selectedCols.length < 2) {
        alert('少なくとも2つの変数を選択してください');
        return;
    }

    // 相関マトリックスの計算
    const corrMatrix = calculateCorrelationMatrix(currentData, selectedCols);

    // 各セクションを表示
    displayCorrelationMatrix(corrMatrix, selectedCols);
    displayHeatmap(corrMatrix, selectedCols);
    displayScatterMatrix(currentData, selectedCols, corrMatrix);
    displayInterpretation(corrMatrix, selectedCols);

    // 結果セクションを表示
    document.getElementById('results-section').style.display = 'block';
}

export function render(container, characteristics) {
    container.innerHTML = `
        <div class="correlation-container">
            <!-- データプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="correlation-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 変数選択セクション -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-check-square"></i> 数値変数の選択
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">相関分析を行う数値変数を選択してください（最低2つ）</p>
                </div>

                <div id="variable-selection" style="display: flex; flex-wrap: wrap; gap: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <button id="run-analysis-btn" class="btn-analysis" style="margin-top: 1.5rem; width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                    <i class="fas fa-play"></i> 分析を実行
                </button>
            </div>

            <!-- 結果セクション -->
            <div id="results-section" style="display: none;">
                <div id="correlation-matrix-section"></div>
                <div id="heatmap-section"></div>
                <div id="scatter-matrix-section"></div>
                <div id="interpretation-section"></div>
            </div>
        </div>
    `;

    // 共通のデータプレビューと要約統計量を表示（折りたたみ可能）
    renderDataOverview('#correlation-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 数値変数の選択チェックボックスを作成
    const { numericColumns } = characteristics;
    const variableSelection = document.getElementById('variable-selection');

    if (numericColumns.length === 0) {
        variableSelection.innerHTML = '<p style="color: #718096;">数値変数が見つかりません。</p>';
        document.getElementById('run-analysis-btn').disabled = true;
        return;
    }

    numericColumns.forEach(col => {
        const checkbox = document.createElement('label');
        checkbox.style.display = 'flex';
        checkbox.style.alignItems = 'center';
        checkbox.style.cursor = 'pointer';
        checkbox.style.padding = '0.75rem';
        checkbox.style.background = 'white';
        checkbox.style.borderRadius = '8px';
        checkbox.style.border = '2px solid #e2e8f0';
        checkbox.style.transition = 'all 0.2s';
        checkbox.innerHTML = `
            <input type="checkbox" value="${col}" class="variable-checkbox" checked style="margin-right: 0.75rem; width: 20px; height: 20px; cursor: pointer;">
            <span style="font-size: 1rem; font-weight: 500; color: #2d3748;">${col}</span>
        `;

        // ホバー効果
        checkbox.addEventListener('mouseenter', () => {
            checkbox.style.borderColor = '#1e90ff';
            checkbox.style.background = '#f0f4ff';
        });
        checkbox.addEventListener('mouseleave', () => {
            checkbox.style.borderColor = '#e2e8f0';
            checkbox.style.background = 'white';
        });

        variableSelection.appendChild(checkbox);
    });

    // 分析実行ボタンのイベントリスナー
    document.getElementById('run-analysis-btn').addEventListener('click', runAnalysis);
}
