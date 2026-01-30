/**
 * @fileoverview 重回帰分析の可視化関数
 * @module regression_multiple/visualization
 */

import { createPlotlyConfig, getBottomTitleAnnotation } from '../../utils.js';

/**
 * パス図を描画
 * @param {Array<string>} independentVars - 説明変数配列
 * @param {Array<Object>} allResults - 全分析結果
 */
export function plotCombinedPathDiagram(independentVars, allResults) {
    const container = document.getElementById('plot-area');
    const totalVars = independentVars.length + allResults.length;
    const height = Math.max(600, totalVars * 50);
    container.style.height = `${height}px`;

    const xNodes = [];
    const yNodes = [];
    const labels = [];
    const sizes = [];
    const colors = [];
    const annotations = [];

    // 説明変数（左側）
    independentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (independentVars.length + 1);
        xNodes.push(0.2);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(40);
        colors.push('#e0f2fe');
    });

    // 目的変数（右側）
    const dependentVars = allResults.map(r => r.dependentVar);
    dependentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (dependentVars.length + 1);
        xNodes.push(0.8);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(50);
        colors.push('#1e90ff');

        // 統計量ラベル
        const res = allResults[i];
        const k = independentVars.length;
        const df1 = k;
        const df2 = res.n - k - 1;
        let pText = res.pValueModel < 0.001 ? 'p<.001' : `p=${res.pValueModel.toFixed(3)}`;

        annotations.push({
            x: 0.8,
            y: yPos - 0.06,
            text: `R²=${res.r2.toFixed(2)}<br>F(${df1},${df2})=${res.fValue.toFixed(2)}<br>${pText}`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 10, color: '#64748b' },
            align: 'center'
        });
    });

    // 矢印（エッジ）
    independentVars.forEach((indName, i) => {
        const indY = 1 - (i + 1) / (independentVars.length + 1);

        dependentVars.forEach((depName, j) => {
            const depY = 1 - (j + 1) / (dependentVars.length + 1);
            const result = allResults[j];
            const betaStd = result.standardizedBeta[i];
            const absBeta = Math.abs(betaStd);
            if (absBeta < 0.1) return;

            const width = Math.max(1, absBeta * 4);
            const color = betaStd >= 0 ? '#3182ce' : '#e53e3e';

            // 矢印
            annotations.push({
                x: 0.76, y: depY,
                xref: 'x', yref: 'y',
                ax: 0.24, ay: indY,
                axref: 'x', ayref: 'y',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: width,
                arrowcolor: color,
                opacity: 0.8
            });

            // 係数ラベル
            annotations.push({
                x: (0.24 + 0.76) / 2,
                y: (indY + depY) / 2,
                text: betaStd.toFixed(2),
                font: { size: 10, color: color, weight: 'bold' },
                showarrow: false,
                bgcolor: 'white',
                opacity: 0.9
            });
        });
    });

    const data = [{
        x: xNodes,
        y: yNodes,
        mode: 'text+markers',
        text: labels,
        textposition: 'middle center',
        marker: {
            size: sizes,
            color: colors,
            line: { color: 'white', width: 2 }
        },
        type: 'scatter',
        hoverinfo: 'none'
    }];

    const layout = {
        title: '',
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1.2] },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1] },
        annotations: annotations,
        height: height,
        margin: { l: 20, r: 20, t: 50, b: 150 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };

    // グラフタイトル
    const titleControl = document.getElementById('show-graph-title');
    const showGraphTitle = titleControl?.checked ?? true;
    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation('パス図（標準化偏回帰係数: |β| >= 0.1 のみ表示）');
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('plot-area', data, layout, createPlotlyConfig('重回帰分析_パス図', independentVars.concat(dependentVars)));
}

/**
 * 残差プロットを描画
 * @param {string} containerId - コンテナID
 * @param {Array<number>} fitted - 予測値
 * @param {Array<number>} residuals - 残差
 */
export function plotResidualsVsFitted(containerId, fitted, residuals) {
    const trace = {
        x: fitted,
        y: residuals,
        mode: 'markers',
        type: 'scatter',
        marker: { color: '#ef4444', size: 8, opacity: 0.7 },
        name: '残差'
    };

    const layout = {
        title: { text: '残差プロット (Residuals vs Fitted)', font: { size: 14 } },
        xaxis: { title: '予測値 (Fitted values)', zeroline: false },
        yaxis: { title: '残差 (Residuals)', zeroline: true, zerolinecolor: '#9ca3af', zerolinewidth: 2 },
        margin: { l: 80, r: 20, b: 60, t: 40 },
        hovermode: 'closest',
        shapes: [{
            type: 'line',
            x0: Math.min(...fitted),
            y0: 0,
            x1: Math.max(...fitted),
            y1: 0,
            line: { color: 'gray', width: 2, dash: 'dashdot' }
        }]
    };

    Plotly.newPlot(containerId, [trace], layout, { displayModeBar: false, responsive: true });
}
