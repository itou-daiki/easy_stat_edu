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
    const totalVariance = eigenvalues.reduce((a, b) => a + b, 0);

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
 * 因子負荷量テーブルを表示（因子別グループ化・適合度指標付き）
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {string} rotation - 回転方法
 * @param {Object} extras - 追加統計量
 */
export function displayLoadings(variables, loadings, rotation, extras = {}) {
    const container = document.getElementById('loadings-table');
    const numFactors = loadings[0].length;
    const { communalities, alphas, rotatedStats, factorCorrelations, fitIndices } = extras;

    const rotationLabels = {
        'varimax': 'バリマックス回転後',
        'promax': 'プロマックス回転後',
        'oblimin': 'オブリミン回転後',
        'geomin': 'ジオミン回転後',
        'none': '回転なし'
    };
    const rotationText = rotationLabels[rotation] || rotation;

    // 負荷量フォーマット: APA式 (先頭ゼロ省略)
    const fmtL = (v) => {
        const s = v.toFixed(3);
        return s.replace(/^(-?)0\./, '$1.');
    };

    // 項目を主因子に割り当て（絶対値最大の因子）
    const itemFactors = variables.map((_, i) => {
        let maxAbs = -1, factor = 0;
        loadings[i].forEach((l, f) => {
            if (Math.abs(l) > maxAbs) { maxAbs = Math.abs(l); factor = f; }
        });
        return factor;
    });

    // 因子ごとにグループ化し、主負荷量の絶対値で降順ソート
    const factorGroups = [];
    for (let f = 0; f < numFactors; f++) {
        const items = [];
        variables.forEach((v, i) => {
            if (itemFactors[i] === f) {
                items.push({ name: v, index: i, absLoading: Math.abs(loadings[i][f]) });
            }
        });
        items.sort((a, b) => b.absLoading - a.absLoading);
        factorGroups.push(items);
    }

    const factorHeaders = Array.from({ length: numFactors }, (_, i) => `Factor${i + 1}`);
    const tdC = 'text-align: center; padding: 0.4rem 0.5rem;';

    // === 適合度指標セクション ===
    let fitHtml = '';
    if (fitIndices) {
        const { kmo, bartlett, rmsr, n } = fitIndices;
        const kmoLabel = kmo != null ? (kmo >= 0.9 ? '非常に良い' : kmo >= 0.8 ? '良い' : kmo >= 0.7 ? '普通' : kmo >= 0.6 ? 'やや低い' : kmo >= 0.5 ? '低い' : '不適') : '';

        fitHtml = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.2rem; margin-bottom: 1.2rem;">
            <h5 style="margin: 0 0 0.6rem 0; color: #2d3748; font-size: 1rem;">
                <i class="fas fa-check-circle" style="color: #38a169;"></i> 適合度指標
            </h5>
            <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; font-size: 0.95rem;">
                ${kmo != null ? `<div><strong>KMO</strong> = ${kmo.toFixed(3)} <span style="color: #718096; font-size: 0.85em;">(${kmoLabel})</span></div>` : ''}
                ${bartlett ? `<div><strong>Bartlett検定</strong>: χ²(${bartlett.df}) = ${bartlett.chi2.toFixed(2)}, <em>p</em> ${bartlett.p < 0.001 ? '&lt; .001' : '= ' + bartlett.p.toFixed(3)}</div>` : ''}
                ${rmsr != null ? `<div><strong>RMSR</strong> = ${rmsr.toFixed(4)}</div>` : ''}
                <div><strong>N</strong> = ${n || '-'}</div>
            </div>
        </div>`;
    }

    // === メインテーブル ===
    let tableHtml = `
        <div class="table-container" style="overflow-x: auto;">
            <p style="margin-bottom: 0.5rem; color: #4a5568; font-size: 0.9rem;">※ 因子負荷量（${rotationText}）</p>
            <table class="table" style="border-collapse: collapse; min-width: 500px;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="text-align: left; min-width: 200px; padding: 0.5rem 0.8rem;">質問項目</th>
                        ${factorHeaders.map(h => `<th style="${tdC} min-width: 70px;">${h}</th>`).join('')}
                        <th style="${tdC} min-width: 55px;">共通性</th>
                    </tr>
                </thead>
                <tbody>`;

    // --- 因子ごとのグループ ---
    factorGroups.forEach((items, f) => {
        const alpha = alphas && alphas[f] != null ? alphas[f] : null;
        const alphaStr = alpha != null ? `α = ${alpha.toFixed(3)}` : '';

        // 因子ヘッダー行
        tableHtml += `
                <tr style="background: #edf2f7;">
                    <td colspan="${numFactors + 2}" style="font-weight: bold; color: #2d3748; padding: 0.6rem 0.8rem; border-top: 2px solid #cbd5e0;">
                        第${f + 1}因子${alphaStr ? `（${alphaStr}）` : ''}
                    </td>
                </tr>`;

        // 各項目行
        items.forEach(item => {
            tableHtml += '<tr>';
            tableHtml += `<td style="padding-left: 2rem; padding-right: 0.5rem; color: #4a5568;">　　${item.name}</td>`;

            loadings[item.index].forEach((l, fIdx) => {
                const isHigh = Math.abs(l) >= 0.4;
                let style = tdC;
                if (isHigh) style += ' font-weight: bold;';
                if (fIdx === f) style += ' color: #1a365d;';
                tableHtml += `<td style="${style}">${fmtL(l)}</td>`;
            });

            // 共通性
            const h2 = communalities ? communalities[item.index] : loadings[item.index].reduce((s, l) => s + l * l, 0);
            tableHtml += `<td style="${tdC}">${h2.toFixed(3)}</td>`;
            tableHtml += '</tr>';
        });
    });

    // --- 統計量行（SS負荷量・寄与率・累積寄与率） ---
    if (rotatedStats) {
        tableHtml += `
                <tr style="border-top: 2px solid #cbd5e0;">
                    <td style="font-weight: bold; color: #2d3748; padding: 0.5rem 0.8rem;">SS負荷量</td>
                    ${rotatedStats.map(s => `<td style="${tdC} font-weight: bold;">${s.eigenvalue.toFixed(3)}</td>`).join('')}
                    <td></td>
                </tr>
                <tr>
                    <td style="font-weight: bold; color: #2d3748; padding: 0.5rem 0.8rem;">寄与率 (%)</td>
                    ${rotatedStats.map(s => `<td style="${tdC}">${s.contribution.toFixed(2)}</td>`).join('')}
                    <td></td>
                </tr>
                <tr>
                    <td style="font-weight: bold; color: #2d3748; padding: 0.5rem 0.8rem;">累積寄与率 (%)</td>
                    ${rotatedStats.map(s => `<td style="${tdC}">${s.cumulative.toFixed(2)}</td>`).join('')}
                    <td></td>
                </tr>`;
    }

    tableHtml += '</tbody></table></div>';

    // === 因子間相関行列（斜交回転時のみ） ===
    let corrHtml = '';
    if (factorCorrelations && factorCorrelations.length > 0) {
        corrHtml = `
        <div style="margin-top: 1.5rem;">
            <div class="table-container" style="overflow-x: auto;">
                <table class="table" style="border-collapse: collapse; max-width: 500px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="text-align: left; padding: 0.5rem 0.8rem;">因子間相関</th>
                            ${factorHeaders.map(h => `<th style="${tdC}">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>`;

        factorCorrelations.forEach((row, i) => {
            corrHtml += `<tr><td style="font-weight: bold; padding: 0.4rem 0.8rem;">${factorHeaders[i]}</td>`;
            row.forEach((val, j) => {
                let style = tdC;
                if (i !== j && Math.abs(val) > 0.3) {
                    style += ' font-weight: bold; background: rgba(236, 201, 75, 0.15);';
                }
                corrHtml += `<td style="${style}">${val.toFixed(3)}</td>`;
            });
            corrHtml += '</tr>';
        });

        corrHtml += `</tbody></table></div>
            <p style="font-size: 0.85rem; color: #4a5568; margin-top: 0.5rem;">※ 因子の相関が高い場合、斜交回転が適しています。</p>
        </div>`;
    }

    container.innerHTML = fitHtml + tableHtml + corrHtml;
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
    const heatmapRotationLabels = {
        'varimax': 'Varimax',
        'promax': 'Promax',
        'oblimin': 'Oblimin',
        'geomin': 'Geomin',
        'none': 'None'
    };
    const rotationText = ` (${heatmapRotationLabels[rotation] || rotation})`;
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
