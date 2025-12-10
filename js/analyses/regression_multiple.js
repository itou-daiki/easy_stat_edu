import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

// --- Matrix Helper Functions (Minimal for OLS) ---
const mat = {
    transpose: (A) => A[0].map((_, c) => A.map(r => r[c])),
    mmul: (A, B) => {
        const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
        return result.map((row, i) => row.map((_, j) => {
            return A[i].reduce((sum, elm, k) => sum + elm * B[k][j], 0);
        }));
    },
    // Gaia jStat or custom inverse. Using jStat.inv if available, else Gaussian elimination
    inv: (A) => jStat.inv(A),
    identity: (n) => Array(n).fill(0).map((_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0))
};

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    let numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    let xOptions = numericColumns.map(col => `
        <label>
            <input type="checkbox" name="mreg-vars" value="${col}"> ${col}
        </label>
    `).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>目的変数 (Y):</label>
                <select id="mreg-y-var">${numOptions}</select>
            </div>
            <div class="control-group">
                <label>説明変数 (X):</label>
                <div class="checkbox-group" id="mreg-x-group">${xOptions}</div>
            </div>
            <div class="control-group">
                <label>
                    <input type="checkbox" id="mreg-interactions"> 交互作用項を含める (2変数の積)
                </label>
            </div>
            <div id="interaction-selector" style="display:none; margin-top: 10px; border: 1px solid #ddd; padding: 10px;">
                <label>交互作用ペアを選択:</label>
                <div id="interaction-pairs" class="checkbox-group"></div>
            </div>
            <button id="run-mreg-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="mreg-results" class="analysis-results"></div>
    `;

    // Interaction UI logic
    const xGroup = document.getElementById('mreg-x-group');
    const interactionCheck = document.getElementById('mreg-interactions');
    const interactionSelector = document.getElementById('interaction-selector');
    const interactionPairsDiv = document.getElementById('interaction-pairs');

    const updateInteractions = () => {
        if (!interactionCheck.checked) {
            interactionSelector.style.display = 'none';
            return;
        }
        const selectedX = Array.from(document.querySelectorAll('input[name="mreg-vars"]:checked')).map(cb => cb.value);
        if (selectedX.length < 2) {
            interactionPairsDiv.innerHTML = '<small>説明変数を2つ以上選択してください。</small>';
            interactionSelector.style.display = 'block';
            return;
        }

        interactionSelector.style.display = 'block';
        let html = '';
        for (let i = 0; i < selectedX.length; i++) {
            for (let j = i + 1; j < selectedX.length; j++) {
                const pair = `${selectedX[i]} × ${selectedX[j]}`;
                const val = `${selectedX[i]}|${selectedX[j]}`;
                html += `<label><input type="checkbox" name="mreg-int-pair" value="${val}"> ${pair}</label>`;
            }
        }
        interactionPairsDiv.innerHTML = html;
    };

    xGroup.addEventListener('change', updateInteractions);
    interactionCheck.addEventListener('change', updateInteractions);

    document.getElementById('run-mreg-btn').addEventListener('click', () => {
        const yVar = document.getElementById('mreg-y-var').value;
        const xVars = Array.from(document.querySelectorAll('input[name="mreg-vars"]:checked')).map(cb => cb.value);
        const intPairs = Array.from(document.querySelectorAll('input[name="mreg-int-pair"]:checked')).map(cb => cb.value);

        if (xVars.length < 1) {
            showError('説明変数を1つ以上選択してください。');
            return;
        }
        if (xVars.includes(yVar)) {
            showError('目的変数と説明変数が重複しています。');
            return;
        }

        runMultipleRegression(xVars, yVar, intPairs);
    });
}

function runMultipleRegression(xVars, yVar, intPairs) {
    const resultsContainer = document.getElementById('mreg-results');
    resultsContainer.innerHTML = '<h4>重回帰分析 結果</h4>';

    // Prepare Data
    // Filter valid rows
    const validData = currentData.filter(row =>
        row[yVar] != null && !isNaN(row[yVar]) &&
        xVars.every(v => row[v] != null && !isNaN(row[v]))
    );

    const n = validData.length;
    // Basic p = num predictors + intercept (will be added below)
    const numX = xVars.length + (intPairs ? intPairs.length : 0);

    if (n < numX + 2) {
        resultsContainer.innerHTML = `<p class="error-message">データが不足しています（データ数 ${n} < 必要数 ${numX + 2}）。</p>`;
        return;
    }

    // Build X Matrix and Y Vector
    // Y: nx1 matrix
    const Y = validData.map(r => [Number(r[yVar])]);

    // X: nx(p+1) matrix (with intercept)
    const X = validData.map(r => {
        const row = [1]; // Intercept
        xVars.forEach(v => row.push(Number(r[v])));
        if (intPairs) {
            intPairs.forEach(pair => {
                const [v1, v2] = pair.split('|');
                row.push(Number(r[v1]) * Number(r[v2]));
            });
        }
        return row;
    });

    // Column Names for display
    const xNames = ['(定数項)', ...xVars, ...(intPairs || []).map(p => p.replace('|', '×'))];

    // --- Statistics Calculations ---

    // Beta = (X'X)^-1 X'Y
    try {
        const XT = mat.transpose(X);
        const XTX = mat.mmul(XT, X);
        const XTX_inv = mat.inv(XTX); // Might fail if singular
        const XTY = mat.mmul(XT, Y);
        const Beta = mat.mmul(XTX_inv, XTY); // (p+1)x1

        const coeffs = Beta.map(r => r[0]);

        // Predicted & Residuals
        const Y_pred = mat.mmul(X, Beta);
        const residuals = Y.map((y, i) => y[0] - Y_pred[i][0]);

        // SS
        const yMean = jStat.mean(Y.map(r => r[0]));
        const ssTotal = Y.reduce((acc, y) => acc + (y[0] - yMean) ** 2, 0);
        const ssRes = residuals.reduce((acc, r) => acc + r ** 2, 0);
        const ssReg = ssTotal - ssRes;

        // Stats
        const p = numX; // number of predictors excluding intercept
        const dfReg = p;
        const dfRes = n - p - 1;
        const msReg = ssReg / dfReg;
        const msRes = dfRes > 0 ? ssRes / dfRes : 0;

        const fStat = msRes > 0 ? msReg / msRes : 0;
        const pMod = msRes > 0 ? (1.0 - jStat.centralF.cdf(fStat, dfReg, dfRes)) : 1.0;

        const rSquared = ssTotal > 0 ? ssReg / ssTotal : 0;
        const adjR2 = 1 - (1 - rSquared) * (n - 1) / (dfRes);
        const rmse = Math.sqrt(msRes);

        // Standard Errors of Coefficients
        // Var(Beta) = sigma^2 * (X'X)^-1, where sigma^2 = MS_Res
        const varBeta = XTX_inv.map(row => row.map(val => val * msRes));
        const seBeta = varBeta.map((row, i) => Math.sqrt(row[i]));

        // t-values & p-values for coefficients
        const tStat = coeffs.map((b, i) => seBeta[i] > 0 ? b / seBeta[i] : 0);
        const pValues = tStat.map(t => dfRes > 0 ? (1.0 - jStat.studentt.cdf(Math.abs(t), dfRes)) * 2.0 : 1.0);

        // Standardized Coefficients (Beta*)
        // Beta*_j = Beta_j * (SD_Xj / SD_Y)
        const sdY = jStat.stdev(Y.map(r => r[0]), true);
        const stdCoefs = coeffs.map((b, i) => {
            if (i === 0) return 0; // Intercept doesn't have std coef
            const xVals = X.map(r => r[i]);
            const sdX = jStat.stdev(xVals, true);
            return b * (sdX / sdY);
        });

        const getSig = (pv) => {
            if (pv < 0.01) return '**';
            if (pv < 0.05) return '*';
            if (pv < 0.1) return '†';
            return 'n.s.';
        };

        // --- Render Output ---

        let statsHtml = `
            <h5>モデルの適合度</h5>
            <table class="table table-sm">
                <tr><th>項目</th><th>値</th><th>備考</th></tr>
                <tr><td>決定係数 (R²)</td><td>${rSquared.toFixed(4)}</td><td>1に近いほど説明力が高い</td></tr>
                <tr><td>調整済み R²</td><td>${adjR2.toFixed(4)}</td><td>説明変数の数を考慮した適合度</td></tr>
                <tr><td>RMSE</td><td>${rmse.toFixed(4)}</td><td>予測誤差の標準偏差</td></tr>
                <tr><td>F値</td><td>${fStat.toFixed(4)}</td><td>(p = ${pMod.toExponential(4)} ${getSig(pMod)})</td></tr>
            </table>

            <h5>偏回帰係数</h5>
            <table class="table table-sm">
                <thead><tr>
                    <th>変数</th>
                    <th>係数(B)</th>
                    <th>標準化係数(β)</th>
                    <th>標準誤差(SE)</th>
                    <th>t値</th>
                    <th>p値</th>
                    <th>判定</th>
                </tr></thead>
                <tbody>
        `;

        xNames.forEach((name, i) => {
            statsHtml += `<tr>
                <td>${name}</td>
                <td>${coeffs[i].toFixed(4)}</td>
                <td>${i === 0 ? '-' : stdCoefs[i].toFixed(4)}</td>
                <td>${seBeta[i].toFixed(4)}</td>
                <td>${tStat[i].toFixed(4)}</td>
                <td>${pValues[i].toExponential(4)}</td>
                <td>${getSig(pValues[i])}</td>
            </tr>`;
        });
        statsHtml += '</tbody></table>';

        // Equation
        let eq = `${yVar} = ${coeffs[0].toFixed(4)}`;
        for (let i = 1; i < coeffs.length; i++) {
            const op = coeffs[i] >= 0 ? '+' : '-';
            eq += ` ${op} ${Math.abs(coeffs[i]).toFixed(4)} × ${xNames[i]}`;
        }
        statsHtml += `<div class="result-card"><p><strong>モデル式:</strong> ${eq}</p></div>`;

        resultsContainer.innerHTML += statsHtml;

        // Plots
        const plotContainer = document.createElement('div');
        plotContainer.className = 'd-flex';
        plotContainer.innerHTML = `
            <div id="mreg-plot-influence" style="width: 33%; height:300px;"></div>
            <div id="mreg-plot-pred" style="width: 33%; height:300px;"></div>
            <div id="mreg-plot-res" style="width: 33%; height:300px;"></div>
        `;
        resultsContainer.appendChild(plotContainer);

        // 1. Influence Plot (Standardized Coefficients)
        const infX = xNames.slice(1);
        const infY = stdCoefs.slice(1);
        // Sort
        const infData = infX.map((n, i) => ({ n, v: Math.abs(infY[i]), original: infY[i] })).sort((a, b) => b.v - a.v);

        Plotly.newPlot('mreg-plot-influence', [{
            x: infData.map(d => d.n),
            y: infData.map(d => d.original),
            type: 'bar', marker: { color: 'skyblue' }
        }], { title: '変数の影響度 (標準化係数)', font: { size: 10 } });

        // 2. Pred vs Actual
        Plotly.newPlot('mreg-plot-pred', [{
            x: Y_pred.map(r => r[0]),
            y: Y.map(r => r[0]),
            mode: 'markers', marker: { color: 'steelblue', size: 6, opacity: 0.6 }
        }, {
            x: [Math.min(...Y_pred), Math.max(...Y_pred)],
            y: [Math.min(...Y_pred), Math.max(...Y_pred)],
            mode: 'lines', line: { color: 'gray', dash: 'dash' }
        }], { title: '予測値 vs 実測値', xaxis: { title: '予測' }, yaxis: { title: '実測' }, showlegend: false, font: { size: 10 } });

        // 3. Residuals
        Plotly.newPlot('mreg-plot-res', [{
            x: Y_pred.map(r => r[0]),
            y: residuals,
            mode: 'markers', marker: { color: 'gray', size: 6, opacity: 0.6 }
        }, {
            x: [Math.min(...Y_pred), Math.max(...Y_pred)],
            y: [0, 0],
            mode: 'lines', line: { color: 'black' }
        }], { title: '残差プロット', xaxis: { title: '予測' }, yaxis: { title: '残差' }, showlegend: false, font: { size: 10 } });

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<p class="error-message">計算中にエラーが発生しました。多重共線性が疑われるか、データが不適切です。</p>`;
    }
}