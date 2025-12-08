import { currentData, dataCharacteristics } from '../main.js';

function runAnovaAnalysis(groups) {
    const resultsContainer = document.getElementById('anova-results');
    resultsContainer.innerHTML = '<h4>一要因分散分析 結果</h4>';
    
    const groupData = groups.map(group => 
        currentData.map(row => row[group]).filter(v => v != null)
    );

    const k = groupData.length;
    const allData = [].concat(...groupData);
    const n = allData.length;
    const grandMean = jStat.mean(allData);
    
    let ssBetween = 0;
    for(let i=0; i<k; i++) {
        ssBetween += groupData[i].length * (jStat.mean(groupData[i]) - grandMean)**2;
    }
    const dfBetween = k - 1;
    const msBetween = ssBetween / dfBetween;

    let ssWithin = 0;
    for(let i=0; i<k; i++) {
        const mean = jStat.mean(groupData[i]);
        ssWithin += groupData[i].reduce((acc, val) => acc + (val - mean)**2, 0);
    }
    const dfWithin = n - k;
    const msWithin = ssWithin / dfWithin;

    const f_stat = msBetween / msWithin;
    const p_value = 1 - jStat.centralF.cdf(f_stat, dfBetween, dfWithin);

    const ssTotal = ssBetween + ssWithin;
    const eta_squared = ssBetween / ssTotal;

    const interpretEffectSize = (eta_sq) => {
        if (eta_sq >= 0.14) return "大きい";
        if (eta_sq >= 0.06) return "中程度";
        if (eta_sq >= 0.01) return "小さい";
        return "ほとんどない";
    };

    let statsHtml = '<h5>記述統計量</h5><table class="table"><tr><th>グループ</th><th>N</th><th>平均</th><th>標準偏差</th></tr>';
    groups.forEach((group, i) => {
        const jstat = jStat(groupData[i]);
        statsHtml += `<tr>
            <td>${group}</td>
            <td>${groupData[i].length}</td>
            <td>${jstat.mean().toFixed(4)}</td>
            <td>${jstat.stdev(true).toFixed(4)}</td>
        </tr>`;
    });
    statsHtml += '</table>';

    let anovaHtml = `
        <h5>分散分析表</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>F統計量</td><td>${f_stat.toFixed(4)}</td></tr>
            <tr><td>p値</td><td>${p_value.toFixed(4)}</td></tr>
            <tr><td>η² (イータ二乗)</td><td>${eta_squared.toFixed(4)}</td></tr>
            <tr><td>効果量の大きさ</td><td>${interpretEffectSize(eta_squared)}</td></tr>
        </table>
        <h5>結果の解釈</h5>
        <p><strong>統計的有意性:</strong> ${p_value < 0.05 ? 'グループ間に統計的に有意な差があります。' : 'グループ間に統計的に有意な差は認められませんでした。'}</p>
        <p><strong>効果量:</strong> η² = ${eta_squared.toFixed(4)}で、効果量は${interpretEffectSize(eta_squared)}です。</p>
    `;

    resultsContainer.innerHTML += statsHtml + anovaHtml;

    const plotId = 'anova-plot';
    resultsContainer.innerHTML += `<div id="${plotId}" class="plot-container"></div>`;
    
    const traces = groupData.map((data, i) => ({ y: data, type: 'box', name: groups[i] }));
    Plotly.newPlot(plotId, traces, { title: '各グループの箱ひげ図' });
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let options = numericColumns.map(col => `
        <label>
            <input type="checkbox" name="anova-vars" value="${col}">
            ${col}
        </label>
    `).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>比較するグループ (数値変数) を2つ以上選択:</label>
                <div class="checkbox-group">${options}</div>
            </div>
            <button id="run-anova-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="anova-results" class="analysis-results"></div>
    `;

    document.getElementById('run-anova-btn').addEventListener('click', () => {
        const selectedVars = Array.from(document.querySelectorAll('input[name="anova-vars"]:checked')).map(cb => cb.value);
        if (selectedVars.length < 2) {
            alert('比較するグループを2つ以上選択してください。');
            return;
        }
        runAnovaAnalysis(selectedVars);
    });
}
