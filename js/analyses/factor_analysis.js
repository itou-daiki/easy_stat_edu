import { currentData, dataCharacteristics } from '../main.js';

function runFactorAnalysis(variables, nFactors) {
    const resultsContainer = document.getElementById('fa-results');
    resultsContainer.innerHTML = `
        <h4>因子分析 結果</h4>
        <p class="text-muted"><small>注: この分析は主成分分析(PCA)を因子分析の代替として使用しています。</small></p>
    `;
    
    const data = currentData.map(row => variables.map(v => row[v]));
    const standardizedData = [];
    for (let j = 0; j < variables.length; j++) {
        const col = data.map(row => row[j]);
        const mean = jStat.mean(col);
        const stdev = jStat.stdev(col, true);
        standardizedData.push(col.map(val => (val - mean) / stdev));
    }
    const standardizedMatrix = jStat.transpose(standardizedData);
    const covMatrix = jStat.covariance(standardizedMatrix);
    const eig = math.eigs(covMatrix);
    
    const sortedIndices = eig.values.map((_, i) => i).sort((a, b) => eig.values[b] - eig.values[a]);
    const sortedEigenvalues = sortedIndices.map(i => eig.values[i]);
    const sortedEigenvectors = jStat.transpose(sortedIndices.map(i => math.column(eig.vectors, i).flat()));

    const loadings = [];
    for(let i=0; i<variables.length; i++) {
        const row = [];
        for (let j=0; j<nFactors; j++) {
            row.push(sortedEigenvectors[i][j] * Math.sqrt(sortedEigenvalues[j]));
        }
        loadings.push(row);
    }
    
    const totalVariance = sortedEigenvalues.reduce((a, b) => a + b, 0);
    const contributionRates = sortedEigenvalues.map(v => (v / totalVariance) * 100);
    const cumulativeRates = contributionRates.map((_, i) => contributionRates.slice(0, i + 1).reduce((a, b) => a + b));

    let loadingsHtml = `
        <h5>因子負荷量</h5>
        <table class="table">
            <thead><tr><th>変数</th>${Array.from({length: nFactors}, (_, i) => `<th>因子${i+1}</th>`).join('')}</tr></thead>
            <tbody>
                ${variables.map((v, i) => `
                    <tr><th>${v}</th>${loadings[i].map(l => `<td>${l.toFixed(4)}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>`;
    
    let varianceHtml = `
        <h5>寄与率</h5>
        <table class="table">
            <tr><th>因子</th><th>寄与率 (%)</th><th>累積寄与率 (%)</th></tr>
            ${contributionRates.slice(0, nFactors).map((r, i) => `
                <tr><td>因子${i + 1}</td><td>${r.toFixed(2)}</td><td>${cumulativeRates[i].toFixed(2)}</td></tr>
            `).join('')}
        </table>`;
    resultsContainer.innerHTML += loadingsHtml + varianceHtml;

    const plotContainer = document.createElement('div');
    plotContainer.className = 'd-flex';
    plotContainer.innerHTML = `<div id="fa-plot1" style="width:50%"></div><div id="fa-plot2" style="width:50%"></div>`;
    resultsContainer.appendChild(plotContainer);

    Plotly.newPlot('fa-plot1', [{ x: contributionRates.map((_,i)=>`F${i+1}`), y: contributionRates, type: 'bar' }], { title: 'スクリープロット' });
    Plotly.newPlot('fa-plot2', [{ z: loadings, x: Array.from({length: nFactors}, (_, i) => `因子${i+1}`), y: variables, type: 'heatmap', colorscale: 'Viridis' }], { title: '因子負荷量のヒートマップ' });
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let options = numericColumns.map(col => `<label><input type="checkbox" name="fa-vars" value="${col}"> ${col}</label>`).join('');
    
    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>分析に使用する変数 (数値) を3つ以上選択:</label>
                <div class="checkbox-group">${options}</div>
            </div>
            <div class="control-group">
                <label for="fa-n-factors">抽出する因子数:</label>
                <input type="number" id="fa-n-factors" value="2" min="1">
            </div>
            <button id="run-fa-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="fa-results" class="analysis-results"></div>
    `;

    document.getElementById('run-fa-btn').addEventListener('click', () => {
        const selectedVars = Array.from(document.querySelectorAll('input[name="fa-vars"]:checked')).map(cb => cb.value);
        const nFactors = parseInt(document.getElementById('fa-n-factors').value, 10);
        if (selectedVars.length < 3) {
            alert('変数を3つ以上選択してください。');
            return;
        }
        if (nFactors < 1 || nFactors > selectedVars.length) {
            alert('因子数は1以上、選択した変数以下にしてください。');
            return;
        }
        runFactorAnalysis(selectedVars, nFactors);
    });
}
