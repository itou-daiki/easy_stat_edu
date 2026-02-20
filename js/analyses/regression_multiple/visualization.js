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
    const numInd = independentVars.length;
    const numDep = allResults.length;
    const maxSide = Math.max(numInd, numDep);

    // --- サイズ計算 ---
    // 変数ノード1つあたり十分な縦幅を確保
    const pxPerNode = 100;
    const height = Math.max(500, maxSide * pxPerNode + 200);
    container.style.height = `${height}px`;

    const xNodes = [];
    const yNodes = [];
    const labels = [];
    const sizes = [];
    const colors = [];
    const annotations = [];

    // --- ノード配置 ---
    const xLeft = 0.15;
    const xRight = 0.85;

    // 説明変数（左側）
    const indYPositions = [];
    independentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (numInd + 1);
        indYPositions.push(yPos);
        xNodes.push(xLeft);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(40);
        colors.push('#e0f2fe');
    });

    // 目的変数（右側）
    const dependentVars = allResults.map(r => r.dependentVar);
    const depYPositions = [];
    dependentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (numDep + 1);
        depYPositions.push(yPos);
        xNodes.push(xRight);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(50);
        colors.push('#1e90ff');

        // 統計量ラベル（右側にオフセット）
        const res = allResults[i];
        const k = numInd;
        const df1 = k;
        const df2 = res.n - k - 1;
        let pText = res.pValueModel < 0.001 ? 'p&lt;.001' : `p=${res.pValueModel.toFixed(3)}`;

        annotations.push({
            x: xRight + 0.13,
            y: yPos,
            text: `R²=${res.r2.toFixed(2)}<br>F(${df1},${df2})=${res.fValue.toFixed(2)}<br>${pText}`,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'middle',
            font: { size: 10, color: '#64748b' },
            align: 'left'
        });
    });

    // --- 矢印＋係数ラベル ---
    // ラベルの重なりを避けるため、矢印ごとに配置位置を分散させる
    const arrowStartX = xLeft + 0.04;
    const arrowEndX = xRight - 0.04;

    independentVars.forEach((indName, i) => {
        const indY = indYPositions[i];

        dependentVars.forEach((depName, j) => {
            const depY = depYPositions[j];
            const result = allResults[j];
            const betaStd = result.standardizedBeta[i];
            const absBeta = Math.abs(betaStd);
            if (absBeta < 0.1) return;

            const width = Math.max(1, absBeta * 5);
            const color = betaStd >= 0 ? '#3182ce' : '#e53e3e';

            // 矢印
            annotations.push({
                x: arrowEndX, y: depY,
                xref: 'x', yref: 'y',
                ax: arrowStartX, ay: indY,
                axref: 'x', ayref: 'y',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: width,
                arrowcolor: color,
                opacity: 0.8
            });

            // 係数ラベル - 矢印上の位置を分散させて重なりを防ぐ
            // 説明変数のインデックスに応じて、矢印上の配置比率を変える
            // numInd=1: 0.5, numInd=2: 0.35/0.65, numInd=3: 0.25/0.50/0.75, etc.
            const t = (i + 1) / (numInd + 1);  // 0.x ~ 0.x の範囲に分散
            const labelX = arrowStartX + (arrowEndX - arrowStartX) * t;
            const labelY = indY + (depY - indY) * t;

            annotations.push({
                x: labelX,
                y: labelY,
                text: `<b>${betaStd.toFixed(2)}</b>`,
                font: { size: 11, color: color },
                showarrow: false,
                bgcolor: 'rgba(255,255,255,0.85)',
                borderpad: 2,
                yshift: 8
            });
        });
    });

    // --- ノード描画 ---
    const data = [{
        x: xNodes,
        y: yNodes,
        mode: 'text+markers',
        text: labels,
        textposition: 'middle center',
        textfont: { size: 11, color: '#1a202c' },
        marker: {
            size: sizes,
            color: colors,
            line: { color: '#94a3b8', width: 1.5 }
        },
        type: 'scatter',
        hoverinfo: 'none'
    }];

    // --- レイアウト ---
    const layout = {
        title: '',
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.05, 1.15] },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.05, 1.05] },
        annotations: annotations,
        height: height,
        margin: { l: 10, r: 10, t: 30, b: 80 },
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
