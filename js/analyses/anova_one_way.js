import { currentData } from '../main.js';

// Leveneの等分散性検定（多群版）
function runLeveneTestMultiGroup(groupData) {
    const k = groupData.length;
    if (k < 2) return { p_value: 1 };

    const transformedData = groupData.map(data => {
        if (data.length === 0) return [];
        const median = jStat(data).median();
        return data.map(val => Math.abs(val - median));
    });

    const allTransformedData = [].concat(...transformedData);
    const n = allTransformedData.length;
    if (n === 0) return { p_value: 1 };
    const grandMean = jStat.mean(allTransformedData);

    let ssBetween = 0;
    transformedData.forEach(group => {
        if (group.length > 0) {
            ssBetween += group.length * (jStat.mean(group) - grandMean)**2;
        }
    });
    const dfBetween = k - 1;
    const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;

    let ssWithin = 0;
    transformedData.forEach(group => {
        if (group.length > 0) {
            const mean = jStat.mean(group);
            ssWithin += group.reduce((acc, val) => acc + (val - mean)**2, 0);
        }
    });
    const dfWithin = n - k;
    const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;

    if (msWithin === 0) return { p_value: 1 };
    const f_stat = msBetween / msWithin;
    const p_value = f_stat > 0 ? 1 - jStat.centralF.cdf(f_stat, dfBetween, dfWithin) : 1;

    return { f_stat, p_value };
}

// Studentのt検定ヘルパー
function runStudentTTest(data1, data2) {
    const n1 = data1.length, n2 = data2.length;
    if (n1 < 2 || n2 < 2) return { p_value: 1 };
    const mean1 = jStat(data1).mean(), mean2 = jStat(data2).mean();
    const var1 = jStat(data1).variance(true), var2 = jStat(data2).variance(true);
    
    const sp_squared = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const se = Math.sqrt(sp_squared * (1/n1 + 1/n2));
    if (se === 0) return { p_value: 1 };
    const t_stat = (mean1 - mean2) / se;
    const df = n1 + n2 - 2;
    return { p_value: jStat.studentt.cdf(-Math.abs(t_stat), df) * 2 };
}

// Welchのt検定ヘルパー
function runWelchTTest(data1, data2) {
    const n1 = data1.length, n2 = data2.length;
    if (n1 < 2 || n2 < 2) return { p_value: 1 };
    const mean1 = jStat(data1).mean(), mean2 = jStat(data2).mean();
    const var1 = jStat(data1).variance(true), var2 = jStat(data2).variance(true);

    const se_welch = Math.sqrt((var1 / n1) + (var2 / n2));
    if (se_welch === 0) return { p_value: 1 };
    const t_stat = (mean1 - mean2) / se_welch;

    const num = (var1 / n1 + var2 / n2)**2;
    const den = (var1**2 / (n1**2 * (n1 - 1))) + (var2**2 / (n2**2 * (n2 - 1)));
    const df = den > 0 ? num / den : n1 + n2 - 2;
    
    return { p_value: jStat.studentt.cdf(-Math.abs(t_stat), df) * 2 };
}

// Bonferroni補正付き多重比較
function runBonferroniPostHoc(groupData, groups, equalVariances) {
    const k = groups.length;
    const comparisons = [];
    for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
            comparisons.push([i, j]);
        }
    }

    const m = comparisons.length;
    const results = [];

    comparisons.forEach(([i, j]) => {
        const data1 = groupData[i];
        const data2 = groupData[j];
        
        let p_value_raw;
        if (equalVariances) {
            p_value_raw = runStudentTTest(data1, data2).p_value;
        } else {
            p_value_raw = runWelchTTest(data1, data2).p_value;
        }

        const p_value_bonferroni = Math.min(1.0, p_value_raw * m);
        
        results.push({
            pair: [groups[i], groups[j]],
            indices: [i, j],
            p_value: p_value_bonferroni
        });
    });

    return results;
}

function runAnovaAnalysis(groups) {
    const resultsContainer = document.getElementById('anova-results');
    resultsContainer.innerHTML = '<h4>一要因分散分析 結果</h4>';
    
    const groupData = groups.map(group => 
        currentData.map(row => row[group]).filter(v => v != null)
    );

    const k = groupData.length;
    const allData = [].concat(...groupData);
    const n = allData.length;

    if (n === 0 || k < 2 || groupData.some(g => g.length < 2)) {
        resultsContainer.innerHTML = '<p>分析に必要なデータが不足しています（各グループ最低2件、全体で2グループ以上必要）。</p>';
        return;
    }

    const grandMean = jStat.mean(allData);
    
    let ssBetween = 0;
    for(let i=0; i<k; i++) ssBetween += groupData[i].length * (jStat.mean(groupData[i]) - grandMean)**2;
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
    const ssTotal = ssBetween + ssWithin;
    const eta_squared = ssTotal > 0 ? ssBetween / ssTotal : 0;

    const interpretEffectSize = (eta_sq) => {
        if (eta_sq >= 0.14) return "大きい";
        if (eta_sq >= 0.06) return "中程度";
        if (eta_sq >= 0.01) return "小さい";
        return "ほとんどない";
    };

    const leveneResult = runLeveneTestMultiGroup(groupData);
    const equal_variances = leveneResult.p_value >= 0.05;

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

    statsHtml += `
        <h5>等分散性の検定 (Levene)</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>F統計量</td><td>${leveneResult.f_stat ? leveneResult.f_stat.toFixed(4) : '-'}</td></tr>
            <tr><td>p値</td><td>${leveneResult.p_value.toExponential(4)}</td></tr>
            <tr><td colspan="2" class="text-muted"><small>${!equal_variances ? '等分散性が仮定できません (p < 0.05)' : '等分散性が仮定されます (p ≥ 0.05)'}</small></td></tr>
        </table>`;

    let anovaHtml = `
        <h5>分散分析表</h5>
        <table class="table">
            <tr><th>要因</th><th>平方和</th><th>自由度</th><th>平均平方</th><th>F値</th><th>p値</th></tr>
            <tr><td>群間</td><td>${ssBetween.toFixed(4)}</td><td>${dfBetween}</td><td>${msBetween.toFixed(4)}</td><td rowspan="2">${f_stat.toFixed(4)}</td><td rowspan="2">${p_value.toExponential(4)}</td></tr>
            <tr><td>群内</td><td>${ssWithin.toFixed(4)}</td><td>${dfWithin}</td><td>${msWithin.toFixed(4)}</td></tr>
            <tr><td>合計</td><td>${ssTotal.toFixed(4)}</td><td>${n-1}</td><td></td><td></td><td></td></tr>
        </table>
        <h5>結果の解釈</h5>
        <p><strong>全体の統計的有意性:</strong> ${p_value < 0.05 ? 'グループ間に統計的に有意な差があります (p < 0.05)。' : 'グループ間に統計的に有意な差は認められませんでした (p ≥ 0.05)。'}</p>
        <p><strong>効果量 (η²):</strong> ${eta_squared.toFixed(4)} (効果量: ${interpretEffectSize(eta_squared)})</p>
    `;

    resultsContainer.innerHTML += statsHtml + anovaHtml;

    let postHocHtml = '<h5>多重比較 (Bonferroni補正)</h5>';
    let significantPairs = [];
    if (p_value < 0.05) {
        const postHocResults = runBonferroniPostHoc(groupData, groups, equal_variances);
        significantPairs = postHocResults.filter(r => r.p_value < 0.05);
        
        postHocHtml += `<p class="text-muted"><small>${equal_variances ? '等分散性を仮定し、' : '等分散性を仮定せず、'}Bonferroni法で多重比較を行いました。</small></p>`;
        
        if (postHocResults.length > 0) {
            postHocHtml += `
                <table class="table">
                    <tr><th>比較ペア</th><th>p値 (補正後)</th><th>有意性</th></tr>
                    ${postHocResults.map(res => `
                        <tr ${res.p_value < 0.05 ? 'style="font-weight: bold;"' : ''}>
                            <td>${res.pair[0]} vs ${res.pair[1]}</td>
                            <td>${res.p_value.toExponential(4)}</td>
                            <td>${res.p_value < 0.001 ? '***' : (res.p_value < 0.01 ? '**' : (res.p_value < 0.05 ? '*' : 'ns'))}</td>
                        </tr>
                    `).join('')}
                </table>`;
        } else {
            postHocHtml += `<p>多重比較の結果、Bonferroni補正後には統計的に有意なペアは検出されませんでした。</p>`;
        }
    } else {
        postHocHtml += `<p>全体の検定で有意差がなかったため、多重比較は行いません。</p>`;
    }
    resultsContainer.innerHTML += postHocHtml;

    const plotId = 'anova-plot';
    resultsContainer.innerHTML += `<div id="${plotId}" class="plot-container"></div>`;
    
    const traces = groupData.map((data, i) => ({ y: data, type: 'box', name: groups[i] }));
    
    const layout = { 
        title: '各グループの箱ひげ図', showlegend: false,
        xaxis: { categoryorder: 'array', categoryarray: groups },
        yaxis: { title: '値' }
    };

    if (significantPairs.length > 0) {
        layout.annotations = layout.annotations || [];
        layout.shapes = layout.shapes || [];
        
        const y_all_data = [].concat(...groupData).filter(v => v != null);
        const y_max_overall = Math.max(...y_all_data);
        const y_range_overall = jStat.range(y_all_data);
        const y_step = y_range_overall * 0.1;

        let bracketLevel = 0;
        
        significantPairs.sort((a,b) => (b.indices[1] - b.indices[0]) - (a.indices[1] - a.indices[0]));

        significantPairs.forEach(pair => {
            const x0_index = pair.indices[0];
            const x1_index = pair.indices[1];
            
            const bracket_y = y_max_overall + y_range_overall * 0.15 + (bracketLevel * y_step);
            const annotation_y = bracket_y + y_range_overall * 0.02;

            layout.annotations.push({
                x: (x0_index + x1_index) / 2,
                y: annotation_y,
                text: pair.p_value < 0.001 ? '***' : (pair.p_value < 0.01 ? '**' : '*'),
                showarrow: false, font: { size: 16, color: 'black' }
            });

            layout.shapes.push(
                { type: 'line', x0: x0_index, y0: bracket_y, x1: x1_index, y1: bracket_y, line: { color: 'black', width: 2 } },
                { type: 'line', x0: x0_index, y0: bracket_y, x1: x0_index, y1: bracket_y - y_step * 0.2, line: { color: 'black', width: 2 } },
                { type: 'line', x0: x1_index, y0: bracket_y, x1: x1_index, y1: bracket_y - y_step * 0.2, line: { color: 'black', width: 2 } }
            );
            bracketLevel++;
        });
    }
    
    Plotly.newPlot(plotId, traces, layout);
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