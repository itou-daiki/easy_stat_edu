/**
 * @fileoverview 主成分分析の可視化・表示関数
 * @module pca/visualization
 */

import { createPlotlyConfig } from '../../utils.js';

/**
 * 固有値と寄与率テーブルを表示
 * @param {Array<number>} eigenvalues - 固有値配列
 */
export function displayEigenvalues(eigenvalues) {
    const container = document.getElementById('eigenvalues-table');
    const total = eigenvalues.reduce((a, b) => a + b, 0);
    let cumulative = 0;

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>主成分</th>
                        <th>固有値</th>
                        <th>寄与率 (%)</th>
                        <th>累積寄与率 (%)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    eigenvalues.forEach((val, i) => {
        const contribution = (val / total) * 100;
        cumulative += contribution;
        const style = val >= 1.0 ? 'font-weight: bold; color: #1e90ff;' : '';

        html += `
            <tr style="${style}">
                <td>PC${i + 1}</td>
                <td>${val.toFixed(3)}</td>
                <td>${contribution.toFixed(2)}</td>
                <td>${cumulative.toFixed(2)}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * スクリープロットを描画
 * @param {Array<number>} eigenvalues - 固有値配列
 */
export function plotScree(eigenvalues) {
    const trace = {
        x: eigenvalues.map((_, i) => `PC${i + 1}`),
        y: eigenvalues,
        type: 'bar',
        name: '固有値',
        marker: { color: '#1e90ff' }
    };

    const traceLine = {
        x: eigenvalues.map((_, i) => `PC${i + 1}`),
        y: eigenvalues,
        type: 'scatter',
        mode: 'lines+markers',
        name: '固有値（推移）',
        showlegend: false,
        line: { color: '#2d3748' }
    };

    const layout = {
        title: 'スクリープロット（固有値の推移）',
        yaxis: { title: '固有値' },
        showlegend: false
    };

    Plotly.newPlot('scree-plot', [trace, traceLine], layout, createPlotlyConfig('主成分分析_スクリープロット', []));
}

/**
 * 因子負荷量テーブルを表示
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Array<number>>} vectors - 固有ベクトル
 * @param {Array<number>} values - 固有値
 */
export function displayLoadings(variables, vectors, values) {
    const container = document.getElementById('loadings-table');
    const nComp = Math.min(vectors.length, 5);

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${Array.from({ length: nComp }, (_, i) => `<th>PC${i + 1} (固有ベクトル)</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((v, i) => {
        html += `<tr><td><strong>${v}</strong></td>`;
        for (let j = 0; j < nComp; j++) {
            const val = vectors[j][i];
            const loading = val * Math.sqrt(values[j]);
            const style = Math.abs(loading) > 0.4 ? 'background: rgba(30, 144, 255, 0.1); font-weight: bold;' : '';
            html += `<td style="${style}">${loading.toFixed(3)}</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">※表の値は因子負荷量（固有ベクトル × √固有値）を表示しています。</p>';
    container.innerHTML = html;
}

/**
 * バイプロットを描画
 * @param {Array<Array<number>>} scores - 主成分スコア
 * @param {Array<Array<number>>} vectors - 固有ベクトル
 * @param {Array<string>} variables - 変数名配列
 */
export function plotBiplot(scores, vectors, variables) {
    const pc1 = scores.map(row => row[0]);
    const pc2 = scores.map(row => row[1]);

    const tracePoints = {
        x: pc1,
        y: pc2,
        mode: 'markers',
        type: 'scatter',
        name: '観測データ',
        marker: { color: 'rgba(30, 144, 255, 0.5)', size: 8 }
    };

    const annotations = [];
    const shapes = [];
    const scale = Math.max(...pc1.map(Math.abs), ...pc2.map(Math.abs)) * 0.8;

    variables.forEach((v, i) => {
        const x = vectors[0][i] * scale * 2;
        const y = vectors[1][i] * scale * 2;

        shapes.push({
            type: 'line',
            x0: 0, y0: 0,
            x1: x, y1: y,
            line: { color: '#ef4444', width: 2 }
        });

        annotations.push({
            x: x, y: y,
            text: v,
            showarrow: false,
            font: { color: '#ef4444', weight: 'bold' },
            bgcolor: 'rgba(255,255,255,0.7)'
        });
    });

    const layout = {
        title: 'バイプロット (PC1 vs PC2)',
        xaxis: { title: '第一主成分' },
        yaxis: { title: '第二主成分' },
        shapes: shapes,
        annotations: annotations,
        hovermode: 'closest',
        height: 600
    };

    Plotly.newPlot('biplot', [tracePoints], layout, createPlotlyConfig('主成分分析_バイプロット', variables));
}
