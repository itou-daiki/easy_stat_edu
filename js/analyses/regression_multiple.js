import { currentData, dataCharacteristics } from '../main.js';

function runMultipleRegression(xVars, yVar) {
    const resultsContainer = document.getElementById('mreg-results');
    resultsContainer.innerHTML = '<h4>重回帰分析 結果</h4>';
    
    const allVars = [...xVars, yVar];
    const data = currentData.filter(row => allVars.every(v => row[v] != null));

    const yVector = data.map(r => r[yVar]);
    const xVectors = xVars.map(v => data.map(r => r[v]));

    if (yVector.length < xVars.length + 2) {
        resultsContainer.innerHTML = `<p>データが不足しています（最低${xVars.length + 2}件必要）。</p>`;
        return;
    }

    const ols = jStat.models.ols(yVector, xVectors);
    const coeffs = ols.coef;
    
    const yPred = jStat.transpose(xVectors).map(row => {
        return coeffs[0] + row.reduce((acc, val, i) => acc + val * coeffs[i + 1], 0);
    });
    
    const n = yVector.length;
    const p = xVars.length;
    const yMean = jStat.mean(yVector);
    const ssTotal = yVector.reduce((acc, y) => acc + (y - yMean)**2, 0);
    const ssRes = yVector.reduce((acc, y, i) => acc + (y - yPred[i])**2, 0);

    const rSquared = 1 - (ssRes / ssTotal);
    const adjRSquared = 1 - (1 - rSquared) * (n - 1) / (n - p - 1);
    const rmse = Math.sqrt(ssRes / n);

    let equation = `${yVar} = ${coeffs[0].toFixed(4)}`;
    xVars.forEach((v, i) => {
        equation += ` ${coeffs[i+1] >= 0 ? '+' : '-'} ${Math.abs(coeffs[i+1]).toFixed(4)}×${v}`;
    });

    resultsContainer.innerHTML += `
        <h5>モデルの適合度</h5>
        <table class="table">
            <tr><td>決定係数 (R²)</td><td>${rSquared.toFixed(4)}</td></tr>
            <tr><td>調整済みR²</td><td>${adjRSquared.toFixed(4)}</td></tr>
            <tr><td>RMSE</td><td>${rmse.toFixed(4)}</td></tr>
        </table>
        <h5>回帰係数</h5>
        <table class="table">
            <tr><th>変数</th><th>係数</th></tr>
            <tr><td>(切片)</td><td>${coeffs[0].toFixed(4)}</td></tr>
            ${xVars.map((v, i) => `<tr><td>${v}</td><td>${coeffs[i+1].toFixed(4)}</td></tr>`).join('')}
        </table>
        <h5>回帰式</h5>
        <p><strong>${equation}</strong></p>`;

    const plotContainer = document.createElement('div');
    plotContainer.className = 'd-flex';
    plotContainer.innerHTML = `<div id="mreg-plot1" style="width: 50%;"></div><div id="mreg-plot2" style="width: 50%;"></div>`;
    resultsContainer.appendChild(plotContainer);

    Plotly.newPlot('mreg-plot1', [{ x: yPred, y: yVector, mode: 'markers' }], { title: '予測値 vs 実測値', xaxis: {title:'予測値'}, yaxis: {title:'実測値'} });
    Plotly.newPlot('mreg-plot2', [{ x: yPred, y: yVector.map((y,i) => y - yPred[i]), mode: 'markers' }], { title: '残差プロット', xaxis: {title:'予測値'}, yaxis: {title:'残差'} });
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    let xOptions = numericColumns.map(col => `<label><input type="checkbox" name="mreg-vars" value="${col}"> ${col}</label>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group"><label>目的変数 (Y):<select id="mreg-y-var">${numOptions}</select></label></div>
            <div class="control-group"><label>説明変数 (X):</label><div class="checkbox-group">${xOptions}</div></div>
            <button id="run-mreg-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="mreg-results" class="analysis-results"></div>
    `;

    document.getElementById('run-mreg-btn').addEventListener('click', () => {
        const yVar = document.getElementById('mreg-y-var').value;
        const xVars = Array.from(document.querySelectorAll('input[name="mreg-vars"]:checked')).map(cb => cb.value);
        if (xVars.length < 1) {
            alert('説明変数を1つ以上選択してください。');
            return;
        }
        if (xVars.includes(yVar)) {
            alert('目的変数と説明変数が重複しています。');
            return;
        }
        runMultipleRegression(xVars, yVar);
    });
}