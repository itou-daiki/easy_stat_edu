import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    let options = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="reg-x-var">説明変数 (X):</label>
                <select id="reg-x-var">${options}</select>
            </div>
            <div class="control-group">
                <label for="reg-y-var">目的変数 (Y):</label>
                <select id="reg-y-var">${options}</select>
            </div>
            <button id="run-reg-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="reg-results" class="analysis-results"></div>
    `;

    document.getElementById('run-reg-btn').addEventListener('click', () => {
        const xVar = document.getElementById('reg-x-var').value;
        const yVar = document.getElementById('reg-y-var').value;
        if (xVar === yVar) {
            showError('説明変数と目的変数は異なるものを選択してください。');
            return;
        }
        runSimpleRegressionAnalysis(xVar, yVar);
    });
}

function runSimpleRegressionAnalysis(xVar, yVar) {
    const resultsContainer = document.getElementById('reg-results');
    resultsContainer.innerHTML = '<h4>単回帰分析 結果</h4>';

    const validData = currentData.filter(row =>
        row[xVar] != null && row[yVar] != null && !isNaN(row[xVar]) && !isNaN(row[yVar])
    );

    if (validData.length < 3) {
        resultsContainer.innerHTML = '<p class="error-message">分析に必要なデータが不足しています（最低3件必要）。</p>';
        return;
    }

    const xVector = validData.map(d => Number(d[xVar]));
    const yVector = validData.map(d => Number(d[yVar]));
    const n = validData.length;

    // Calculation using jStat
    const meanX = jStat.mean(xVector);
    const meanY = jStat.mean(yVector);

    // Manual OLS for clear stats
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (xVector[i] - meanX) * (yVector[i] - meanY);
        denominator += (xVector[i] - meanX) ** 2;
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    // Predicted & Residuals
    const yPred = xVector.map(x => slope * x + intercept);
    const residuals = yVector.map((y, i) => y - yPred[i]);

    // SS
    const ssTotal = yVector.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
    const ssRes = residuals.reduce((acc, r) => acc + r ** 2, 0);
    const ssReg = ssTotal - ssRes;

    // R2
    const rSquared = ssTotal > 0 ? ssReg / ssTotal : 0;
    const r = Math.sqrt(rSquared) * (slope >= 0 ? 1 : -1);

    // ANOVA for Regression
    const dfReg = 1;
    const dfRes = n - 2;
    const msReg = ssReg / dfReg;
    const msRes = dfRes > 0 ? ssRes / dfRes : 0;
    const fStat = msRes > 0 ? msReg / msRes : 0;
    const pValue = msRes > 0 ? (1.0 - jStat.centralF.cdf(fStat, dfReg, dfRes)) : 1.0;

    // Significance Sign
    const getSig = (p) => {
        if (p < 0.01) return '**';
        if (p < 0.05) return '*';
        if (p < 0.1) return '†';
        return 'n.s.';
    };
    const sign = getSig(pValue);

    // Display Models
    resultsContainer.innerHTML += `
        <div class="result-card">
            <h5>数理モデル</h5>
            <p class="math-model">${yVar} = ${slope.toFixed(4)} × ${xVar} + ${intercept.toFixed(4)}</p>
            <p><small>${yVar} = 傾き × ${xVar} + 切片</small></p>
        </div>
        
        <h5>統計量</h5>
        <table class="table table-sm">
            <tr><th>項目</th><th>値</th><th>備考</th></tr>
            <tr><td>決定係数 (R²)</td><td>${rSquared.toFixed(4)}</td><td>モデルの当てはまりの良さ</td></tr>
            <tr><td>相関係数 (r)</td><td>${r.toFixed(4)}</td><td>${Math.abs(r) > 0.7 ? '強い相関' : (Math.abs(r) > 0.4 ? '中程度の相関' : '弱い相関')}</td></tr>
            <tr><td>F値</td><td>${fStat.toFixed(4)}</td><td>自由度 (${dfReg}, ${dfRes})</td></tr>
            <tr><td>p値</td><td>${pValue.toExponential(4)} ${sign}</td><td>${sign === '**' || sign === '*' ? '統計的に有意' : '有意ではない'}</td></tr>
        </table>
        
        <h5>回帰係数</h5>
        <table class="table table-sm">
            <tr><th>変数</th><th>係数</th><th>標準誤差(推定)</th><th>t値</th><th>p値</th></tr>
            <tr><td>(切片)</td><td>${intercept.toFixed(4)}</td><td>-</td><td>-</td><td>-</td></tr>
            <tr><td>${xVar}</td><td>${slope.toFixed(4)}</td><td>-</td><td>-</td><td>${pValue.toExponential(4)} ${sign}</td></tr>
        </table>
    `;

    const plotContainer = document.createElement('div');
    plotContainer.className = 'd-flex';
    const plot1Id = 'reg-plot1';
    const plot2Id = 'reg-plot2';
    plotContainer.innerHTML = `<div id="${plot1Id}" style="width: 50%; height: 400px;"></div><div id="${plot2Id}" style="width: 50%; height: 400px;"></div>`;
    resultsContainer.appendChild(plotContainer);

    // Sort for line plot
    const sortedIndices = xVector.map((x, i) => i).sort((a, b) => xVector[a] - xVector[b]);
    const sortedX = sortedIndices.map(i => xVector[i]);
    const sortedYPred = sortedIndices.map(i => yPred[i]);

    Plotly.newPlot(plot1Id, [
        { x: xVector, y: yVector, mode: 'markers', name: '実測値', marker: { color: 'steelblue', size: 8, opacity: 0.7 } },
        { x: sortedX, y: sortedYPred, mode: 'lines', name: '回帰直線', line: { color: 'firebrick', width: 3 } }
    ], {
        title: `現在のデータ (${xVar} vs ${yVar})`,
        xaxis: { title: xVar },
        yaxis: { title: yVar },
        font: { family: "Inter, sans-serif" }
    });

    Plotly.newPlot(plot2Id, [
        { x: yPred, y: residuals, mode: 'markers', marker: { color: 'gray', opacity: 0.7 } },
        { x: [Math.min(...yPred), Math.max(...yPred)], y: [0, 0], mode: 'lines', line: { color: 'black', dash: 'dash' } }
    ], {
        title: '残差プロット (等分散性の確認)',
        xaxis: { title: '予測値' },
        yaxis: { title: '残差' },
        font: { family: "Inter, sans-serif" }
    });
}