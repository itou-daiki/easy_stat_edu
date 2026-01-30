/**
 * @fileoverview 因子分析の可視化・表示関数
 * @module factor_analysis/visualization
 */

import { createPlotlyConfig } from '../../utils.js';

/**
 * 固有値と寄与率テーブルを表示
 * @param {Array<number>} eigenvalues - 固有値配列
 * @param {Array<Object>} rotatedStats - 回転後統計量（オプション）
 */
export function displayEigenvalues(eigenvalues, rotatedStats) {
    const container = document.getElementById('eigenvalues-table');
    const totalVariance = eigenvalues.length;

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th rowspan="2">因子 (成分)</th>
                        <th colspan="3" style="text-align: center; border-bottom: 2px solid #e2e8f0;">初期固有値 (Initial Eigenvalues)</th>
                        ${rotatedStats ? `<th colspan="3" style="text-align: center; border-bottom: 2px solid #e2e8f0; background: #ebf8ff;">回転後の負荷量二乗和 (Rotation Sums of Squared Loadings)</th>` : ''}
                    </tr>
                    <tr>
                        <th style="font-size: 0.9em;">合計</th>
                        <th style="font-size: 0.9em;">寄与率 (%)</th>
                        <th style="font-size: 0.9em;">累積 (%)</th>
                        ${rotatedStats ? `
                        <th style="font-size: 0.9em; background: #ebf8ff;">合計</th>
                        <th style="font-size: 0.9em; background: #ebf8ff;">寄与率 (%)</th>
                        <th style="font-size: 0.9em; background: #ebf8ff;">累積 (%)</th>` : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    let cumulativeInitial = 0;
    const numRows = rotatedStats ? rotatedStats.length : eigenvalues.length;

    for (let i = 0; i < numRows; i++) {
        const val = eigenvalues[i];
        const contribution = (val / totalVariance) * 100;
        cumulativeInitial += contribution;
        const style = val >= 1.0 ? 'font-weight: bold;' : '';

        html += `
            <tr>
                <td>第${i + 1}成分</td>
                <td style="${style}">${val.toFixed(3)}</td>
                <td>${contribution.toFixed(2)}</td>
                <td>${cumulativeInitial.toFixed(2)}</td>
                ${rotatedStats && rotatedStats[i] ? `
                <td style="background: #ebf8ff; font-weight: bold;">${rotatedStats[i].eigenvalue.toFixed(3)}</td>
                <td style="background: #ebf8ff;">${rotatedStats[i].contribution.toFixed(2)}</td>
                <td style="background: #ebf8ff;">${rotatedStats[i].cumulative.toFixed(2)}</td>
                ` : (rotatedStats ? '<td colspan="3" style="background: #ebf8ff;">-</td>' : '')}
            </tr>
        `;
    }

    if (!rotatedStats && numRows < eigenvalues.length) {
        for (let i = numRows; i < eigenvalues.length; i++) {
            const val = eigenvalues[i];
            const contribution = (val / totalVariance) * 100;
            cumulativeInitial += contribution;
            html += `
                <tr style="color: #a0aec0;">
                    <td>第${i + 1}成分</td>
                    <td>${val.toFixed(3)}</td>
                    <td>${contribution.toFixed(2)}</td>
                    <td>${cumulativeInitial.toFixed(2)}</td>
                </tr>
            `;
        }
    }

    html += '</tbody></table></div>';
    if (rotatedStats) {
        html += `<p style="font-size: 0.85rem; color: #4a5568; margin-top: 0.5rem;">※ 回転を行うと、因子の分散（固有値に相当）が再配分されますが、累積寄与率の合計は変わりません。</p>`;
    }
    container.innerHTML = html;
}

/**
 * 因子負荷量テーブルを表示
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {string} rotation - 回転方法
 */
export function displayLoadings(variables, loadings, rotation) {
    const container = document.getElementById('loadings-table');
    const numFactors = loadings[0].length;
    const rotationText = rotation === 'varimax' ? ' (バリマックス回転後)' : ' (回転なし)';

    let html = `
        <div class="table-container">
            <p>※ 因子負荷量${rotationText}</p>
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${Array.from({ length: numFactors }, (_, i) => `<th>第${i + 1}因子</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((v, i) => {
        html += `<tr><td><strong>${v}</strong></td>`;
        loadings[i].forEach(l => {
            const style = Math.abs(l) > 0.4 ? 'background: rgba(30, 144, 255, 0.1); font-weight: bold;' : '';
            html += `<td style="${style}">${l.toFixed(3)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * 因子解釈を表示
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Array<number>>} loadings - 因子負荷量
 */
export function displayFactorInterpretation(variables, loadings) {
    const container = document.getElementById('factor-interpretation');
    const numFactors = loadings[0].length;
    const threshold = 0.4;

    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">`;

    for (let f = 0; f < numFactors; f++) {
        const factorsLoadings = variables.map((v, i) => ({
            name: v,
            loading: loadings[i][f],
            absLoading: Math.abs(loadings[i][f])
        }));
        factorsLoadings.sort((a, b) => b.absLoading - a.absLoading);
        const strongVars = factorsLoadings.filter(item => item.absLoading >= threshold);

        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h5 style="color: #2d3748; margin-top: 0; margin-bottom: 1rem; border-bottom: 2px solid #805ad5; padding-bottom: 0.5rem; display: inline-block;">
                    第${f + 1}因子
                </h5>
                ${strongVars.length > 0 ? `
                    <ul style="padding-left: 0; list-style: none;">
                        ${strongVars.map(item => `
                            <li style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: bold; color: ${item.loading > 0 ? '#2b6cb0' : '#c53030'};">
                                    ${item.name}
                                </span>
                                <span style="background: #edf2f7; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                                    負荷量: ${item.loading.toFixed(3)}
                                </span>
                            </li>
                        `).join('')}
                    </ul>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #718096;">
                        <i class="fas fa-search"></i> 
                        <strong>解釈のヒント:</strong> これらの変数の共通点は何でしょうか？
                    </p>
                ` : `
                    <p style="color: #718096;">
                        負荷量が0.4以上の変数は見つかりませんでした。
                    </p>
                `}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

/**
 * スクリープロットを描画
 * @param {Array<number>} eigenvalues - 固有値配列
 */
export function plotScree(eigenvalues) {
    const trace = {
        x: eigenvalues.map((_, i) => i + 1),
        y: eigenvalues,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1e90ff', width: 2 },
        marker: { size: 8 }
    };

    const shape = {
        type: 'line',
        x0: 1, y0: 1,
        x1: eigenvalues.length, y1: 1,
        line: { color: '#ef4444', width: 2, dash: 'dash' }
    };

    const layout = {
        title: 'スクリープロット',
        xaxis: { title: '成分番号' },
        yaxis: { title: '固有値' },
        shapes: [shape]
    };

    Plotly.newPlot('scree-plot', [trace], layout, createPlotlyConfig('因子分析_スクリープロット', []));
}

/**
 * 因子負荷量ヒートマップを描画
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {string} rotation - 回転方法
 */
export function plotLoadingsHeatmap(variables, loadings, rotation) {
    const rotationText = rotation === 'varimax' ? ' (Varimax)' : ' (None)';
    const z = loadings[0].map((_, colIndex) => loadings.map(row => row[colIndex]));
    const components = Array.from({ length: loadings[0].length }, (_, i) => `第${i + 1}因子`);

    const data = [{
        z: z,
        x: variables,
        y: components,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmin: -1,
        zmax: 1
    }];

    const layout = {
        title: `因子負荷量ヒートマップ${rotationText}`,
        height: 300 + (components.length * 30),
        xaxis: { side: 'bottom' }
    };

    Plotly.newPlot('loadings-heatmap', data, layout, createPlotlyConfig('因子分析_負荷量', variables));
}

/**
 * 因子間相関行列を表示
 * @param {Array<Array<number>>} corrMatrix - 因子間相関行列
 */
export function displayFactorCorrelations(corrMatrix) {
    const container = document.getElementById('factor-correlations');
    if (!corrMatrix || !container) return;

    const wrapper = document.getElementById('factor-correlations-container');
    if (wrapper) wrapper.style.display = 'block';

    const numFactors = corrMatrix.length;
    let html = `
        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> 因子間相関行列 (Factor Correlations)</h4>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>因子</th>
                        ${Array.from({ length: numFactors }, (_, i) => `<th>第${i + 1}因子</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    for (let i = 0; i < numFactors; i++) {
        html += `<tr><td><strong>第${i + 1}因子</strong></td>`;
        for (let j = 0; j < numFactors; j++) {
            const val = corrMatrix[i][j];
            let bg = '';
            const absVal = Math.abs(val);
            if (i !== j && absVal > 0.3) bg = 'background: rgba(236, 201, 75, 0.2); font-weight: bold;';
            html += `<td style="${bg}">${val.toFixed(3)}</td>`;
        }
        html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    html += `<p style="font-size: 0.85rem; color: #4a5568; margin-top: 0.5rem;">※ 因子の相関が高い場合、プロマックスなどの斜交回転が適しています。</p>`;
    container.innerHTML = html;
}
