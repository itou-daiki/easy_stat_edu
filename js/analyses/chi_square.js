import { currentData, dataCharacteristics } from '../main.js';
import { toHtmlTable } from '../utils.js';

function runChiSquareAnalysis(var1, var2) {
    const resultsContainer = document.getElementById('chi-results');
    resultsContainer.innerHTML = '<h4>カイ二乗検定 結果</h4>';

    const data = currentData.filter(row => row[var1] != null && row[var2] != null);
    
    const rowLabels = [...new Set(data.map(r => r[var1]))].sort();
    const colLabels = [...new Set(data.map(r => r[var2]))].sort();
    
    const observed = rowLabels.map(() => colLabels.map(() => 0));
    const rowTotals = rowLabels.map(() => 0);
    const colTotals = colLabels.map(() => 0);
    let total = 0;

    data.forEach(row => {
        const r_idx = rowLabels.indexOf(row[var1]);
        const c_idx = colLabels.indexOf(row[var2]);
        if(r_idx > -1 && c_idx > -1) {
            observed[r_idx][c_idx]++;
        }
    });

    for(let i=0; i<rowLabels.length; i++) {
        for(let j=0; j<colLabels.length; j++) {
            rowTotals[i] += observed[i][j];
            colTotals[j] += observed[i][j];
        }
        total += rowTotals[i];
    }

    const expected = rowLabels.map((r, i) => 
        colLabels.map((c, j) => (rowTotals[i] * colTotals[j]) / total)
    );

    let chi2_stat = 0;
    for(let i=0; i<rowLabels.length; i++) {
        for(let j=0; j<colLabels.length; j++) {
            if (expected[i][j] > 0) {
                chi2_stat += (observed[i][j] - expected[i][j])**2 / expected[i][j];
            }
        }
    }

    const df = (rowLabels.length - 1) * (colLabels.length - 1);
    const p_value = 1 - jStat.chisquare.cdf(chi2_stat, df);

    let resultHtml = `
        <h5>クロス集計表 (観測度数)</h5>
        ${toHtmlTable(colLabels, rowLabels, observed)}
        <h5>期待度数</h5>
        ${toHtmlTable(colLabels, rowLabels, expected)}
        <h5>検定結果</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>カイ二乗統計量</td><td>${chi2_stat.toFixed(4)}</td></tr>
            <tr><td>自由度</td><td>${df}</td></tr>
            <tr><td>p値</td><td>${p_value.toFixed(4)}</td></tr>
            <tr><td>統計的有意性</td><td>${p_value < 0.05 ? '有意 (p < 0.05)' : '有意ではない (p ≥ 0.05)'}</td></tr>
        </table>
        <h5>結果の解釈</h5>
        <p><strong>統計的有意性:</strong> ${p_value < 0.05 ? '2つの変数には統計的に有意な関連があります' : '統計的に有意な関連は認められませんでした'}</p>
    `;
    resultsContainer.innerHTML += resultHtml;
}

export function render(container, characteristics) {
    const { categoricalColumns } = characteristics;
    let options = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="chi-var1">変数1 (行):</label>
                <select id="chi-var1">${options}</select>
            </div>
            <div class="control-group">
                <label for="chi-var2">変数2 (列):</label>
                <select id="chi-var2">${options}</select>
            </div>
            <button id="run-chi-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="chi-results" class="analysis-results"></div>
    `;

    document.getElementById('run-chi-btn').addEventListener('click', () => {
        const var1 = document.getElementById('chi-var1').value;
        const var2 = document.getElementById('chi-var2').value;
        if (var1 === var2) {
            alert('2つの異なる変数を選択してください。');
            return;
        }
        runChiSquareAnalysis(var1, var2);
    });
}