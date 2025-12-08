import { currentData, dataCharacteristics } from '../main.js';

function runPcaAnalysis(variables) {
    const resultsContainer = document.getElementById('pca-results');
    resultsContainer.innerHTML = '<h4>主成分分析 結果</h4>';
    
    const data = currentData.map(row => variables.map(v => row[v])).filter(row => row.every(v => v != null));
    
    if (data.length < variables.length) {
        resultsContainer.innerHTML = '<p>データが不足しています。</p>';
        return;
    }

    const standardizedData = [];
    for (let j = 0; j < variables.length; j++) {
        const col = data.map(row => row[j]);
        const mean = jStat.mean(col);
        const stdev = jStat.stdev(col, true);
        standardizedData.push(col.map(val => (val - mean) / stdev));
    }
    const standardizedMatrix = jStat.transpose(standardizedData);
    const covMatrix = jStat.covariance(standardizedMatrix);
    
    try {
        const eig = math.eigs(covMatrix);
        const sortedIndices = eig.values.map((_, i) => i).sort((a, b) => eig.values[b] - eig.values[a]);
        const sortedEigenvalues = sortedIndices.map(i => eig.values[i]);
        const sortedEigenvectors = jStat.transpose(sortedIndices.map(i => math.column(eig.vectors, i).flat()));

        const totalVariance = sortedEigenvalues.reduce((a, b) => a + b, 0);
        const contributionRates = sortedEigenvalues.map(v => (v / totalVariance) * 100);
        const cumulativeRates = contributionRates.map((_, i) => contributionRates.slice(0, i + 1).reduce((a, b) => a + b));
        const pcScores = math.multiply(standardizedMatrix, sortedEigenvectors);

        let varianceHtml = `
            <h5>寄与率</h5>
            <table class="table">
                <tr><th>主成分</th><th>寄与率 (%)</th><th>累積寄与率 (%)</th></tr>
                ${contributionRates.map((r, i) => `
                    <tr>
                        <td>第${i + 1}主成分</td>
                        <td>${r.toFixed(2)}</td>
                        <td>${cumulativeRates[i].toFixed(2)}</td>
                    </tr>`).join('')}
            </table>`;
        resultsContainer.innerHTML += varianceHtml;

        const plotContainer = document.createElement('div');
        plotContainer.className = 'd-flex';
        plotContainer.innerHTML = `<div id="pca-plot1" style="width: 50%;"></div><div id="pca-plot2" style="width: 50%;"></div>`;
        resultsContainer.appendChild(plotContainer);

        Plotly.newPlot('pca-plot1', [{ x: contributionRates.map((_, i) => `PC${i + 1}`), y: contributionRates, type: 'bar' }], { title: 'スクリープロット' });
        Plotly.newPlot('pca-plot2', [{ x: pcScores.map(row => row[0]), y: pcScores.map(row => row[1]), mode: 'markers' }], { title: '主成分スコア (PC1 vs PC2)', xaxis: { title: `PC1 (${contributionRates[0].toFixed(1)}%)` }, yaxis: { title: `PC2 (${contributionRates[1].toFixed(1)}%)` } });

    } catch (e) {
        resultsContainer.innerHTML += '<p>計算エラーが発生しました。math.jsが正しく読み込まれているか確認してください。</p>';
        console.error(e);
    }
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let options = numericColumns.map(col => `<label><input type="checkbox" name="pca-vars" value="${col}"> ${col}</label>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>分析に使用する変数 (数値) を2つ以上選択:</label>
                <div class="checkbox-group">${options}</div>
            </div>
            <button id="run-pca-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="pca-results" class="analysis-results"></div>
    `;

    document.getElementById('run-pca-btn').addEventListener('click', () => {
        const selectedVars = Array.from(document.querySelectorAll('input[name="pca-vars"]:checked')).map(cb => cb.value);
        if (selectedVars.length < 2) {
            alert('変数を2つ以上選択してください。');
            return;
        }
        runPcaAnalysis(selectedVars);
    });
}