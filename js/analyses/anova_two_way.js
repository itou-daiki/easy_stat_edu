import { currentData, dataCharacteristics } from '../main.js';

// Helper for one-way anova calculation, returns { f_stat, p_value }
function onewayAnova(groupData) {
    if (groupData.some(g => g.length < 2)) return { f_stat: NaN, p_value: NaN };
    const k = groupData.length;
    if (k < 2) return { f_stat: NaN, p_value: NaN };

    const allData = [].concat(...groupData);
    const n = allData.length;
    const grandMean = jStat.mean(allData);
    
    let ssBetween = 0;
    for(let i=0; i<k; i++) {
        ssBetween += groupData[i].length * (jStat.mean(groupData[i]) - grandMean)**2;
    }
    const dfBetween = k - 1;
    const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;

    let ssWithin = 0;
    for(let i=0; i<k; i++) {
        const mean = jStat.mean(groupData[i]);
        ssWithin += groupData[i].reduce((acc, val) => acc + (val - mean)**2, 0);
    }
    const dfWithin = n - k;
    const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;

    const f_stat = msWithin > 0 ? msBetween / msWithin : 0;
    const p_value = f_stat > 0 ? 1 - jStat.centralF.cdf(f_stat, dfBetween, dfWithin) : 1;
    return { f_stat, p_value };
}

function runTwoWayAnovaAnalysis(factor1, factor2, dependent) {
    const resultsContainer = document.getElementById('anova2-results');
    resultsContainer.innerHTML = '<h4>二要因分散分析 結果</h4>';
    
    const data = currentData.filter(r => r[factor1] != null && r[factor2] != null && r[dependent] != null);

    const groupsF1 = [...new Set(data.map(r => r[factor1]))].map(level => data.filter(r => r[factor1] === level).map(r => r[dependent]));
    const anovaF1 = onewayAnova(groupsF1);

    const groupsF2 = [...new Set(data.map(r => r[factor2]))].map(level => data.filter(r => r[factor2] === level).map(r => r[dependent]));
    const anovaF2 = onewayAnova(groupsF2);

    const interactionMeans = {};
    data.forEach(r => {
        const key = `${r[factor1]}|${r[factor2]}`;
        if (!interactionMeans[key]) interactionMeans[key] = [];
        interactionMeans[key].push(r[dependent]);
    });
    const interactionData = Object.keys(interactionMeans).map(key => {
        const [f1, f2] = key.split('|');
        return { factor1: f1, factor2: f2, mean: jStat.mean(interactionMeans[key]) };
    });

    resultsContainer.innerHTML += `
        <h5>分散分析表 (主効果)</h5>
        <table class="table">
            <tr><th>効果</th><th>F統計量</th><th>p値</th><th>統計的有意性</th></tr>
            <tr>
                <td>${factor1}</td>
                <td>${anovaF1.f_stat.toFixed(4)}</td>
                <td>${anovaF1.p_value.toFixed(4)}</td>
                <td>${anovaF1.p_value < 0.05 ? '有意' : '有意ではない'}</td>
            </tr>
            <tr>
                <td>${factor2}</td>
                <td>${anovaF2.f_stat.toFixed(4)}</td>
                <td>${anovaF2.p_value.toFixed(4)}</td>
                <td>${anovaF2.p_value < 0.05 ? '有意' : '有意ではない'}</td>
            </tr>
             <tr><td colspan="4" class="text-muted"><small>交互作用の統計的検定は現在サポートされていません。</small></td></tr>
        </table>`;
    
    const plotContainer = document.createElement('div');
    plotContainer.className = 'd-flex';
    plotContainer.innerHTML = `<div id="anova2-plot1" style="width: 50%;"></div><div id="anova2-plot2" style="width: 50%;"></div>`;
    resultsContainer.appendChild(plotContainer);

    Plotly.newPlot('anova2-plot1', groupsF1.map((d, i) => ({ y: d, type: 'box', name: [...new Set(data.map(r => r[factor1]))].sort()[i] })), { title: `主効果: ${factor1}` });
    const f1Levels = [...new Set(interactionData.map(d => d.factor1))];
    const interactionTraces = f1Levels.map(level => {
        const levelData = interactionData.filter(d => d.factor1 === level);
        return { x: levelData.map(d => d.factor2), y: levelData.map(d => d.mean), mode: 'lines+markers', name: level };
    });
    Plotly.newPlot('anova2-plot2', interactionTraces, { title: '交互作用プロット', xaxis: { title: factor2 }, yaxis: { title: `平均 ${dependent}` } });
}

export function render(container, characteristics) {
    const { categoricalColumns, numericColumns } = characteristics;
    let catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    let numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    
    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group"><label>要因1 (カテゴリカル):<select id="anova2-factor1">${catOptions}</select></label></div>
            <div class="control-group"><label>要因2 (カテゴリカル):<select id="anova2-factor2">${catOptions}</select></label></div>
            <div class="control-group"><label>従属変数 (数値):<select id="anova2-dependent">${numOptions}</select></label></div>
            <button id="run-anova2-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="anova2-results" class="analysis-results"></div>
    `;

    document.getElementById('run-anova2-btn').addEventListener('click', () => {
        const factor1 = document.getElementById('anova2-factor1').value;
        const factor2 = document.getElementById('anova2-factor2').value;
        const dependent = document.getElementById('anova2-dependent').value;
        if (factor1 === factor2) {
            alert('要因1と要因2に異なる変数を選択してください。');
            return;
        }
        runTwoWayAnovaAnalysis(factor1, factor2, dependent);
    });
}
