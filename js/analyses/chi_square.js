import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

function runChiSquare() {
    const rowVar = document.getElementById('row-var').value;
    const colVar = document.getElementById('col-var').value;

    if (!rowVar || !colVar) {
        alert('行変数と列変数を選択してください');
        return;
    }
    if (rowVar === colVar) {
        alert('異なる変数を選択してください');
        return;
    }

    // クロス集計
    const rowValues = currentData.map(d => d[rowVar]);
    const colValues = currentData.map(d => d[colVar]);
    const rowKeys = [...new Set(rowValues)].filter(v => v != null).sort();
    const colKeys = [...new Set(colValues)].filter(v => v != null).sort();

    const observed = rowKeys.map(r => {
        return colKeys.map(c => {
            return currentData.filter(d => d[rowVar] === r && d[colVar] === c).length;
        });
    });

    // カイ二乗検定計算
    const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = colKeys.map((_, i) => observed.reduce((sum, row) => sum + row[i], 0));
    const total = rowTotals.reduce((a, b) => a + b, 0);

    const expected = rowKeys.map((_, i) => {
        return colKeys.map((_, j) => (rowTotals[i] * colTotals[j]) / total);
    });

    let chiSquare = 0;
    expected.forEach((row, i) => {
        row.forEach((exp, j) => {
            if (exp > 0) {
                chiSquare += Math.pow(observed[i][j] - exp, 2) / exp;
            }
        });
    });

    const df = (rowKeys.length - 1) * (colKeys.length - 1);
    const pValue = 1 - jStat.chisquare.cdf(chiSquare, df);

    // Cramer's V
    const minDim = Math.min(rowKeys.length, colKeys.length);
    const cramersV = Math.sqrt(chiSquare / (total * (minDim - 1)));

    // 残差分析 (調整済み標準化残差)
    const adjResiduals = [];
    if (total > 0) {
        for (let i = 0; i < rowKeys.length; i++) {
            const rowRes = [];
            for (let j = 0; j < colKeys.length; j++) {
                const obs = observed[i][j];
                const exp = expected[i][j];
                const rowProp = rowTotals[i] / total;
                const colProp = colTotals[j] / total;
                const stdErr = Math.sqrt(total * rowProp * (1 - rowProp) * colProp * (1 - colProp));
                const res = (obs - exp) / stdErr; // Simplified approximation or formula
                // Better formula: (Obs - Exp) / sqrt(Exp * (1 - rowProp) * (1 - colProp)) 
                // Actually Adjusted Standardized Residual = (O - E) / sqrt( E * (1-Ri/N) * (1-Cj/N) ) ? 
                // Standard formula: z = (O - E) / sqrt(E * (1 - rowMarginal/N) * (1 - colMarginal/N))
                const z = (obs - exp) / Math.sqrt(exp * (1 - rowTotals[i] / total) * (1 - colTotals[j] / total));
                rowRes.push(z);
            }
            adjResiduals.push(rowRes);
        }
    }

    displayResults(rowVar, colVar, rowKeys, colKeys, observed, expected, adjResiduals, chiSquare, df, pValue, cramersV);
}

function displayResults(rowVar, colVar, rowKeys, colKeys, observed, expected, adjResiduals, chi2, df, p, v) {
    const container = document.getElementById('chi-results');

    // 検定結果
    let html = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-clipboard-check"></i> 検定結果
            </h4>
            <div class="data-stats-grid">
                <div class="data-stat-card">
                    <div class="stat-label">カイ二乗値 (χ²)</div>
                    <div class="stat-value">${chi2.toFixed(2)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">自由度 (df)</div>
                    <div class="stat-value">${df}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">p値</div>
                    <div class="stat-value" style="${p < 0.05 ? 'color: #ef4444;' : ''}">${p.toFixed(4)} ${p < 0.05 ? '*' : ''}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">クラメールのV</div>
                    <div class="stat-value">${v.toFixed(3)}</div>
                </div>
            </div>
            <p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">
                有意差がある場合、2つの変数には関連（独立ではない関係）があると言えます。
            </p>
        </div>

        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-table"></i> クロス集計表と残差分析
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${rowVar} \\ ${colVar}</th>
                            ${colKeys.map(c => `<th>${c}</th>`).join('')}
                            <th>合計</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // テーブル本体
    rowKeys.forEach((r, i) => {
        html += `<tr><td><strong>${r}</strong></td>`;
        let rowSum = 0;
        colKeys.forEach((c, j) => {
            const obs = observed[i][j];
            const exp = expected[i][j];
            const res = adjResiduals[i][j];
            rowSum += obs;

            // 残差による色付け
            let style = '';
            if (res > 1.96) style = 'background: #dbeafe; color: #1e40af; font-weight: bold;'; // 有意に多い
            else if (res < -1.96) style = 'background: #fee2e2; color: #991b1b;'; // 有意に少ない

            html += `
                <td style="${style}">
                    <div>${obs} <span style="font-size:0.8em; color:#666;">(${exp.toFixed(1)})</span></div>
                    <div style="font-size:0.8em;">z=${res.toFixed(1)}</div>
                </td>
            `;
        });
        html += `<td>${rowSum}</td></tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <p style="margin-top: 0.5rem; color: #666; font-size: 0.8rem;">
                上段: 観測度数 (期待度数), 下段: 調整済み標準化残差 (z)。<br>
                z > 1.96 (青) は有意に多い、z < -1.96 (赤) は有意に少ない組み合わせを示します。
            </p>
        </div>

        <div id="heatmap-plot"></div>
    `;

    container.innerHTML = html;

    // ヒートマップ
    const data = [{
        z: observed,
        x: colKeys,
        y: rowKeys,
        type: 'heatmap',
        colorscale: 'Blues'
    }];
    Plotly.newPlot('heatmap-plot', data, { title: '観測度数のヒートマップ' });

    document.getElementById('analysis-results').style.display = 'block';
}

export function render(container, characteristics) {
    const { categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="chisquare-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-border-all"></i> カイ二乗検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つのカテゴリ変数の独立性を検定します</p>
            </div>

            <!-- データ概要 -->
            <div id="chi-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div id="row-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="col-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                </div>

                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div id="row-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="col-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                </div>

                <div id="run-chi-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div id="chi-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#chi-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Selects
    createVariableSelector('row-var-container', categoricalColumns, 'row-var', {
        label: '<i class="fas fa-bars"></i> 行変数 (Group 1):',
        multiple: false
    });
    createVariableSelector('col-var-container', categoricalColumns, 'col-var', {
        label: '<i class="fas fa-columns"></i> 列変数 (Group 2):',
        multiple: false
    });

    createAnalysisButton('run-chi-btn-container', '検定を実行', runChiSquare, { id: 'run-chi-btn' });
}
