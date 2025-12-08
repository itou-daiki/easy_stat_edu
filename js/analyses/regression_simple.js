import { currentData, dataCharacteristics } from '../main.js';

function runSimpleRegressionAnalysis(xVar, yVar) {
    const resultsContainer = document.getElementById('reg-results');
    resultsContainer.innerHTML = '<h4>単回帰分析 結果</h4>';

    const data = currentData.map(row => ({ x: row[xVar], y: row[yVar] }))
        .filter(d => d.x != null && d.y != null);

    const xVector = data.map(d => d.x);
    const yVector = data.map(d => d.y);

    if (xVector.length < 3) {
        resultsContainer.innerHTML = '<p>分析に必要なデータが不足しています（最低3件必要）。</p>';
        return;
    }

    const ols = jStat.models.ols(yVector, [xVector]);
    const intercept = ols.coef[0];
    const slope = ols.coef[1];
    const r = jStat.corr(xVector, yVector);
    const rSquared = r**2;
    const yPred = xVector.map(x => slope * x + intercept);
    const residuals = yVector.map((y, i) => y - yPred[i]);

    let resultHtml = `
        <h5>回帰係数</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>切片</td><td>${intercept.toFixed(4)}</td></tr>
            <tr><td>傾き (${xVar})</td><td>${slope.toFixed(4)}</td></tr>
        </table>
        <h5>モデルの適合度</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>決定係数 (R²)</td><td>${rSquared.toFixed(4)}</td></tr>
            <tr><td>相関係数 (r)</td><td>${r.toFixed(4)}</td></tr>
        </table>
        <h5>回帰式</h5>
        <p><strong>${yVar} = ${slope.toFixed(4)} × ${xVar} + ${intercept.toFixed(4)}</strong></p>
    `;
    resultsContainer.innerHTML += resultHtml;

    const plotContainer = document.createElement('div');
    plotContainer.className = 'd-flex';
    const plot1Id = 'reg-plot1';
    const plot2Id = 'reg-plot2';
    plotContainer.innerHTML = `<div id="${plot1Id}" style="width: 50%;"></div><div id="${plot2Id}" style="width: 50%;"></div>`;
    resultsContainer.appendChild(plotContainer);

    Plotly.newPlot(plot1Id, [
        { x: xVector, y: yVector, mode: 'markers', name: '実測値' },
        { x: xVector, y: yPred, mode: 'lines', name: '回帰直線' }
    ], { title: '回帰分析', xaxis: { title: xVar }, yaxis: { title: yVar } });
    
    Plotly.newPlot(plot2Id, [
        { x: yPred, y: residuals, mode: 'markers' }
    ], { title: '残差プロット', xaxis: { title: '予測値' }, yaxis: { title: '残差' } });
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
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
            alert('2つの異なる変数を選択してください。');
            return;
        }
        runSimpleRegressionAnalysis(xVar, yVar);
    });
}