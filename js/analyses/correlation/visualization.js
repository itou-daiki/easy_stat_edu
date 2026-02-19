/**
 * @fileoverview 相関分析の可視化モジュール
 * ヒートマップと散布図行列の表示を提供
 * @module correlation/visualization
 */

import { createPlotlyConfig, getBottomTitleAnnotation } from '../../utils.js';

// ======================================================================
// ヒートマップ
// ======================================================================

/**
 * 相関係数のヒートマップを描画
 * @param {string[]} variables - 変数名配列
 * @param {number[][]} matrix - 相関行列
 */
export function plotHeatmap(variables, matrix) {
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

    const n = variables.length;
    const baseCellSize = 80;
    const minSize = 450;
    const maxSize = 900;
    const calculatedSize = Math.max(minSize, Math.min(maxSize, n * baseCellSize + 200));
    const fontSize = Math.max(10, Math.min(16, 18 - n));

    const layout = {
        title: '',
        height: calculatedSize,
        width: calculatedSize + 100,
        margin: { l: 150, r: 80, b: 150, t: 50 },
        xaxis: {
            tickangle: -45,
            tickfont: { size: Math.max(10, 14 - Math.floor(n / 3)) }
        },
        yaxis: {
            automargin: true,
            tickfont: { size: Math.max(10, 14 - Math.floor(n / 3)) }
        },
        annotations: []
    };

    // セル内に相関係数の値をアノテーションとして追加
    for (let i = 0; i < variables.length; i++) {
        for (let j = 0; j < variables.length; j++) {
            const value = matrix[i][j];
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

// ======================================================================
// 散布図行列
// ======================================================================

/**
 * 散布図行列を描画
 * @param {string[]} variables - 変数名配列
 * @param {Object[]} currentData - データ配列
 * @param {Object} matrixData - 相関行列データ（matrix, pValues）
 */
export function plotScatterMatrix(variables, currentData, matrixData) {
    const sampledData = currentData.length > 1000
        ? currentData.slice(0, 1000)
        : currentData;

    const n = variables.length;
    const cellSize = 150;
    const margin = 50;
    const totalSize = n * cellSize + margin * 2;

    const subplotData = [];
    const annotations = [];

    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            const xVar = variables[col];
            const yVar = variables[row];
            const xaxis = col === 0 && row === 0 ? 'x' : `x${col + row * n + 1}`;
            const yaxis = col === 0 && row === 0 ? 'y' : `y${col + row * n + 1}`;

            if (row === col) {
                // ヒストグラム（対角線）
                const values = sampledData.map(r => r[xVar]).filter(v => v != null && !isNaN(v));
                subplotData.push({
                    type: 'histogram',
                    x: values,
                    xaxis: xaxis,
                    yaxis: yaxis,
                    marker: { color: '#1e90ff', opacity: 0.7 },
                    showlegend: false
                });
            } else {
                // 散布図
                const pairs = sampledData
                    .map(r => ({ x: r[xVar], y: r[yVar] }))
                    .filter(p => p.x != null && !isNaN(p.x) && p.y != null && !isNaN(p.y));

                const r = matrixData.matrix[row][col];
                const p = matrixData.pValues[row][col];
                const color = r > 0 ? '#1e90ff' : '#e41a1c';

                subplotData.push({
                    type: 'scatter',
                    mode: 'markers',
                    x: pairs.map(p => p.x),
                    y: pairs.map(p => p.y),
                    xaxis: xaxis,
                    yaxis: yaxis,
                    marker: { color: color, size: 4, opacity: 0.6 },
                    showlegend: false
                });

                // 相関係数を表示
                const xPos = (col + 0.5) / n;
                const yPos = 1 - (row + 0.2) / n;
                annotations.push({
                    x: xPos,
                    y: yPos,
                    xref: 'paper',
                    yref: 'paper',
                    text: `r=${r.toFixed(2)}${p < 0.05 ? '*' : ''}`,
                    font: { size: 10, color: '#333' },
                    showarrow: false
                });
            }
        }
    }

    const layout = {
        title: '',
        height: Math.min(totalSize, 800),
        width: Math.min(totalSize, 800),
        annotations: annotations,
        showlegend: false
    };

    // グリッドレイアウトを設定
    for (let row = 0; row < n; row++) {
        for (let col = 0; col < n; col++) {
            const axisNum = col + row * n + 1;
            const xKey = col === 0 && row === 0 ? 'xaxis' : `xaxis${axisNum}`;
            const yKey = col === 0 && row === 0 ? 'yaxis' : `yaxis${axisNum}`;

            layout[xKey] = {
                domain: [col / n + 0.02, (col + 1) / n - 0.02],
                anchor: yKey.replace('axis', ''),
                showticklabels: row === n - 1,
                title: row === n - 1 ? variables[col] : ''
            };

            layout[yKey] = {
                domain: [1 - (row + 1) / n + 0.02, 1 - row / n - 0.02],
                anchor: xKey.replace('axis', ''),
                showticklabels: col === 0,
                title: col === 0 ? variables[row] : ''
            };
        }
    }

    Plotly.newPlot('scatter-matrix', subplotData, layout, createPlotlyConfig('散布図行列', variables));
}

// ======================================================================
// 相関テーブル
// ======================================================================

/**
 * 相関係数テーブルを生成
 * @param {string[]} variables - 変数名配列
 * @param {number[][]} matrix - 相関行列
 * @param {number[][]} pValues - p値行列
 * @param {number[][]} nValues - サンプルサイズ行列
 * @returns {string} HTMLテーブル文字列
 */
export function createCorrelationTable(variables, matrix, pValues, nValues) {
    let html = `
        <div style="overflow-x: auto;">
            <table class="table" id="correlation-table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th></th>
                        ${variables.map(v => `<th>${v}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    for (let i = 0; i < variables.length; i++) {
        html += `<tr><th style="background: #f8f9fa;">${variables[i]}</th>`;
        for (let j = 0; j < variables.length; j++) {
            const r = matrix[i][j];
            const p = pValues[i][j];
            const n = nValues[i][j];

            let cellContent = isNaN(r) ? '-' : r.toFixed(3);
            let stars = '';
            if (!isNaN(p)) {
                if (p < 0.01) stars = '**';
                else if (p < 0.05) stars = '*';
                else if (p < 0.1) stars = '†';
            }

            const bgColor = i === j ? '#f8f9fa' :
                (Math.abs(r) > 0.7 ? (r > 0 ? '#cce5ff' : '#f8d7da') : 'white');

            html += `<td style="background: ${bgColor}; text-align: center;">
                ${cellContent}${stars}<br>
                <small style="color: #666;">n=${n}</small>
            </td>`;
        }
        html += '</tr>';
    }

    html += `
                </tbody>
            </table>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
            <em>†p < .10, *p < .05, **p < .01</em>
        </div>
    `;

    return html;
}
