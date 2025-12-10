import { currentData, dataCharacteristics } from '../main.js';
import { toHtmlTable } from '../utils.js';

function runCorrelationAnalysis(var1, var2) {
    const resultsContainer = document.getElementById('corr-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '<h4>分析結果</h4>';

    const data = currentData.map(row => ({
        x: row[var1],
        y: row[var2]
    })).filter(d => d.x != null && d.y != null);

    const xVector = data.map(d => d.x);
    const yVector = data.map(d => d.y);
    const n = xVector.length;

    if (n < 3) {
        resultsContainer.innerHTML = '<p>分析に必要なデータが不足しています（最低3件必要）。</p>';
        return;
    }

    const correlation = jStat.corr(xVector, yVector);

    // p値の計算
    const t_stat = correlation * Math.sqrt((n - 2) / (1 - correlation**2));
    const df = n - 2;
    const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

    const xJStat = jStat(xVector);
    const yJStat = jStat(yVector);
    const slope = correlation * (yJStat.stdev() / xJStat.stdev());
    const intercept = yJStat.mean() - slope * xJStat.mean();

    const getCorrelationStrength = (r) => {
        const absR = Math.abs(r);
        if (absR >= 0.7) return `強い相関 (|r| = ${absR.toFixed(3)})`;
        if (absR >= 0.3) return `中程度の相関 (|r| = ${absR.toFixed(3)})`;
        return `弱い相関 (|r| = ${absR.toFixed(3)})`;
    };

    let tableHtml = `
        <h5>相関分析結果: ${var1} vs ${var2}</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>サンプルサイズ</td><td>${n}</td></tr>
            <tr><td>相関係数 (r)</td><td>${correlation.toFixed(4)}</td></tr>
            <tr><td>t統計量</td><td>${t_stat.toFixed(4)}</td></tr>
            <tr><td>自由度 (df)</td><td>${df}</td></tr>
            <tr><td>p値</td><td>${p_value.toExponential(4)}</td></tr>
        </table>
        <h5>結果の解釈</h5>
        <p><strong>統計的有意性:</strong> ${p_value < 0.05 ? `統計的に有意な相関関係があります (p < 0.05)。` : '統計的に有意な相関関係は認められませんでした (p >= 0.05)。'}</p>
        <p><strong>相関の強さ:</strong> ${getCorrelationStrength(correlation)}</p>
        <p><strong>相関の方向:</strong> ${correlation > 0 ? '正の相関' : '負の相関'}</p>
    `;
    resultsContainer.innerHTML += tableHtml;

    const plotId = 'corr-plot';
    resultsContainer.innerHTML += `<div id="${plotId}" class="plot-container"></div>`;

    const scatterTrace = { x: xVector, y: yVector, mode: 'markers', type: 'scatter', name: 'データポイント' };
    const xLine = [xJStat.min(), xJStat.max()];
    const yLine = xLine.map(x => slope * x + intercept);
    const lineTrace = { x: xLine, y: yLine, mode: 'lines', type: 'scatter', name: `回帰直線` };
    const layout = { title: `散布図: ${var1} vs ${var2}`, xaxis: { title: var1 }, yaxis: { title: var2 }, showlegend: true };
    
    Plotly.newPlot(plotId, [scatterTrace, lineTrace], layout);
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let options = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    
    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="corr-var1">変数1 (x軸):</label>
                <select id="corr-var1">${options}</select>
            </div>
            <div class="control-group">
                <label for="corr-var2">変数2 (y軸):</label>
                <select id="corr-var2">${options}</select>
            </div>
            <button id="run-corr-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="corr-results" class="analysis-results"></div>
    `;

    document.getElementById('run-corr-btn').addEventListener('click', () => {
        const var1 = document.getElementById('corr-var1').value;
        const var2 = document.getElementById('corr-var2').value;
        if (var1 === var2) {
            showError('2つの異なる変数を選択してください。');
            return;
        }
        runCorrelationAnalysis(var1, var2);
    });
}