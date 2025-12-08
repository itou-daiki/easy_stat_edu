import { currentData, dataCharacteristics } from '../main.js';

function runEdaAnalysis(variable) {
    const resultsContainer = document.getElementById('eda-results');
    resultsContainer.innerHTML = '<h4>分析結果</h4>';

    const dataVector = currentData.map(row => row[variable]).filter(v => v !== null && v !== undefined);

    if (dataCharacteristics.numericColumns.includes(variable)) {
        // --- Numeric Variable ---
        const jstat = jStat(dataVector);
        const stats = {
            mean: jstat.mean(),
            median: jstat.median(),
            stdev: jstat.stdev(),
            min: jstat.min(),
            max: jstat.max(),
            q1: jstat.quartiles()[0],
            q3: jstat.quartiles()[2],
            count: dataVector.length
        };

        // Display stats table
        let tableHtml = `
            <h5>記述統計量: ${variable}</h5>
            <table class="table">
                <tr><th>統計量</th><th>値</th></tr>
                <tr><td>サンプルサイズ</td><td>${stats.count}</td></tr>
                <tr><td>平均値</td><td>${stats.mean.toFixed(4)}</td></tr>
                <tr><td>中央値</td><td>${stats.median.toFixed(4)}</td></tr>
                <tr><td>標準偏差</td><td>${stats.stdev.toFixed(4)}</td></tr>
                <tr><td>最小値</td><td>${stats.min.toFixed(4)}</td></tr>
                <tr><td>第1四分位数 (Q1)</td><td>${stats.q1.toFixed(4)}</td></tr>
                <tr><td>第3四分位数 (Q3)</td><td>${stats.q3.toFixed(4)}</td></tr>
                <tr><td>最大値</td><td>${stats.max.toFixed(4)}</td></tr>
            </table>
        `;
        resultsContainer.innerHTML += tableHtml;

        // Add plot divs
        const histId = 'eda-hist-plot';
        const boxId = 'eda-box-plot';
        resultsContainer.innerHTML += `<div id="${histId}" class="plot-container"></div>`;
        resultsContainer.innerHTML += `<div id="${boxId}" class="plot-container"></div>`;

        // Histogram
        const histTrace = {
            x: dataVector,
            type: 'histogram',
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const histLayout = {
            title: `【${variable}】 のヒストグラム`,
            xaxis: { title: variable },
            yaxis: { title: '度数' },
            bargap: 0.05
        };
        Plotly.newPlot(histId, [histTrace], histLayout);

        // Box plot
        const boxTrace = {
            y: dataVector,
            type: 'box',
            name: variable,
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const boxLayout = {
            title: `【${variable}】 の箱ひげ図`,
            yaxis: { title: variable }
        };
        Plotly.newPlot(boxId, [boxTrace], boxLayout);

    } else {
        // --- Categorical Variable ---
        const valueCounts = dataVector.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
        
        const labels = Object.keys(valueCounts);
        const values = Object.values(valueCounts);

        // Display frequency table
        let tableHtml = `
            <h5>度数分布: ${variable}</h5>
            <table class="table">
                <tr><th>カテゴリ</th><th>度数</th></tr>
                ${labels.map((label, i) => `<tr><td>${label}</td><td>${values[i]}</td></tr>`).join('')}
            </table>
        `;
        resultsContainer.innerHTML += tableHtml;
        
        // Add plot div
        const barId = 'eda-bar-plot';
        resultsContainer.innerHTML += `<div id="${barId}" class="plot-container"></div>`;

        // Bar chart
        const barTrace = {
            x: labels,
            y: values,
            type: 'bar',
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const barLayout = {
            title: `【${variable}】 の棒グラフ`,
            xaxis: { title: variable },
            yaxis: { title: '度数' }
        };
        Plotly.newPlot(barId, [barTrace], barLayout);
    }
}


export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;
    const allColumns = [...numericColumns, ...categoricalColumns];
    let edaOptions = allColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="eda-variable">変数を選択:</label>
                <select id="eda-variable">${edaOptions}</select>
            </div>
            <button id="run-eda-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="eda-results" class="analysis-results"></div>
    `;

    document.getElementById('run-eda-btn').addEventListener('click', () => {
        const selectedVar = document.getElementById('eda-variable').value;
        runEdaAnalysis(selectedVar);
    });
}