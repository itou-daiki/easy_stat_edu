import { currentData, dataCharacteristics } from '../main.js';
import { getEffectSizeInterpretation } from '../utils.js';

// Leveneの等分散性検定を実装するヘルパー関数
function runLeveneTest(data1, data2) {
    // 各グループの中央値
    const median1 = jStat(data1).median();
    const median2 = jStat(data2).median();

    // 各データ点から中央値を引いた絶対値のデータセットを作成
    const z1 = data1.map(val => Math.abs(val - median1));
    const z2 = data2.map(val => Math.abs(val - median2));

    // Z1とZ2に対して対応なしt検定を実行
    const n_z1 = z1.length;
    const n_z2 = z2.length;
    const mean_z1 = jStat(z1).mean();
    const mean_z2 = jStat(z2).mean();
    const std_z1 = jStat(z1).stdev(true);
    const std_z2 = jStat(z2).stdev(true);

    const sp_squared_z = ((n_z1 - 1) * std_z1**2 + (n_z2 - 1) * std_z2**2) / (n_z1 + n_z2 - 2);
    const se_z = Math.sqrt(sp_squared_z * (1/n_z1 + 1/n_z2));
    if (se_z === 0) return { p_value: 1 }; // 差がない場合はp=1
    const t_stat_levene = (mean_z1 - mean_z2) / se_z;
    const df_levene = n_z1 + n_z2 - 2;
    const p_value_levene = jStat.studentt.cdf(-Math.abs(t_stat_levene), df_levene) * 2;

    return { p_value: p_value_levene };
}

// Welchのt検定を実装するヘルパー関数
function runWelchTTest(mean1, mean2, var1, var2, n1, n2) {
    const se_welch = Math.sqrt((var1 / n1) + (var2 / n2));
    if (se_welch === 0) return { t_stat: 0, df: n1 + n2 - 2, p_value: 1 };

    const t_stat = (mean1 - mean2) / se_welch;
    
    // Welch–Satterthwaite の自由度
    const num = (var1 / n1 + var2 / n2)**2;
    const den = (var1**2 / (n1**2 * (n1 - 1))) + (var2**2 / (n2**2 * (n2 - 1)));
    const df = den > 0 ? num / den : n1 + n2 - 2;
    
    const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
    return { t_stat, df, p_value };
}

function runTTestAnalysis(type, var1, var2) {
    const resultsContainer = document.getElementById('ttest-results');
    resultsContainer.innerHTML = `<h4>${type === 'paired' ? '対応あり' : '対応なし'}t検定 結果</h4>`;

    let data1, data2;

    if (type === 'paired') {
        const pairedData = currentData.map(row => ({ d1: row[var1], d2: row[var2] }))
            .filter(d => d.d1 != null && d.d2 != null);
        data1 = pairedData.map(d => d.d1);
        data2 = pairedData.map(d => d.d2);
    } else {
        data1 = currentData.map(row => row[var1]).filter(v => v != null);
        data2 = currentData.map(row => row[var2]).filter(v => v != null);
    }
    
    if (data1.length < 2 || data2.length < 2) {
        resultsContainer.innerHTML = '<p>各グループに最低2件のデータが必要です。</p>';
        return;
    }

    const jstat1 = jStat(data1);
    const jstat2 = jStat(data2);
    const n1 = data1.length;
    const n2 = data2.length;
    const mean1 = jstat1.mean();
    const mean2 = jstat2.mean();
    const std1 = jstat1.stdev(true);
    const var_1 = std1**2;
    const std2 = jstat2.stdev(true);
    const var_2 = std2**2;

    let t_stat, p_value, df;
    let levene_p_value = null;

    if (type === 'paired') {
        const diff = jStat.subtract(data1, data2);
        const diffJstat = jStat(diff);
        const se = diffJstat.stdev(true) / Math.sqrt(n1);
        t_stat = se > 0 ? diffJstat.mean() / se : 0;
        df = n1 - 1;
        p_value = se > 0 ? jStat.studentt.cdf(-Math.abs(t_stat), df) * 2 : 1;
    } else {
        const leveneResult = runLeveneTest(data1, data2);
        levene_p_value = leveneResult.p_value;
        const equal_variances = levene_p_value >= 0.05;

        if (equal_variances) {
            const sp_squared = ((n1 - 1) * var_1 + (n2 - 1) * var_2) / (n1 + n2 - 2);
            const se_student = Math.sqrt(sp_squared * (1/n1 + 1/n2));
            t_stat = se_student > 0 ? (mean1 - mean2) / se_student : 0;
            df = n1 + n2 - 2;
            p_value = se_student > 0 ? jStat.studentt.cdf(-Math.abs(t_stat), df) * 2 : 1;
            resultsContainer.innerHTML += `<p class="text-muted"><small>等分散性が仮定されるため (Levene p = ${levene_p_value.toExponential(4)}), Studentのt検定の結果を採用。</small></p>`;
        } else {
            const welchResult = runWelchTTest(mean1, mean2, var_1, var_2, n1, n2);
            t_stat = welchResult.t_stat;
            df = welchResult.df;
            p_value = welchResult.p_value;
            resultsContainer.innerHTML += `<p class="text-muted"><small>等分散性が仮定されないため (Levene p = ${levene_p_value.toExponential(4)}), Welchのt検定の結果を採用。</small></p>`;
        }
    }
    
    const pooled_std = Math.sqrt(((n1 - 1) * var_1 + (n2 - 1) * var_2) / (n1 + n2 - 2));
    const cohens_d = pooled_std > 0 ? (mean1 - mean2) / pooled_std : 0;

    let tableHtml = `
        <h5>記述統計量</h5>
        <table class="table">
            <tr><th>グループ</th><th>N</th><th>平均値</th><th>標準偏差</th></tr>
            <tr><td>${var1}</td><td>${n1}</td><td>${mean1.toFixed(4)}</td><td>${std1.toFixed(4)}</td></tr>
            <tr><td>${var2}</td><td>${n2}</td><td>${mean2.toFixed(4)}</td><td>${std2.toFixed(4)}</td></tr>
        </table>
        ${type === 'independent' ? `
        <h5>等分散性の検定 (Levene)</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>Leveneのp値</td><td>${levene_p_value.toExponential(4)}</td></tr>
            <tr><td colspan="2" class="text-muted"><small>${levene_p_value < 0.05 ? '等分散性が仮定できません (p < 0.05)' : '等分散性が仮定されます (p ≥ 0.05)'}</small></td></tr>
        </table>` : ''}
        <h5>検定結果</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>t統計量</td><td>${t_stat.toFixed(4)}</td></tr>
            <tr><td>自由度</td><td>${df.toFixed(2)}</td></tr>
            <tr><td>p値</td><td>${p_value.toExponential(4)}</td></tr>
            <tr><td>効果量 (Cohen's d)</td><td>${cohens_d.toFixed(4)}</td></tr>
        </table>
        <h5>結果の解釈</h5>
        <p><strong>統計的有意性:</strong> ${p_value < 0.05 ? '2つのグループ間に統計的に有意な差があります (p < 0.05)' : '統計的に有意な差は認められませんでした (p ≥ 0.05)'}</p>
        <p><strong>効果量の大きさ:</strong> ${getEffectSizeInterpretation(cohens_d)}</p>
    `;
    resultsContainer.innerHTML += tableHtml;
    
    const plotId = 'ttest-plot';
    resultsContainer.innerHTML += `<div id="${plotId}" class="plot-container"></div>`;

    const layout = { 
        title: `箱ひげ図: ${var1} vs ${var2}`,
        showlegend: false,
        xaxis: { categoryorder: 'array', categoryarray: [var1, var2] },
        yaxis: { title: '値' }
    };

    if (p_value < 0.05) {
        const all_data = data1.concat(data2);
        if (all_data.length === 0) return;
        const y_max = Math.max(...all_data);
        const y_range = jStat.range(all_data);
        const bracket_y = y_max + y_range * 0.15;
        const annotation_y = bracket_y + y_range * 0.05;

        let significance_text = '';
        if (p_value < 0.001) significance_text = '***';
        else if (p_value < 0.01) significance_text = '**';
        else significance_text = '*';
        
        layout.annotations = [{
            x: 0.5, y: annotation_y, xref: 'x', yref: 'y',
            text: significance_text, showarrow: false, font: { size: 16, color: 'black' }
        }];

        layout.shapes = [{
            type: 'line', x0: 0, y0: bracket_y, x1: 1, y1: bracket_y,
            xref: 'x', yref: 'y', line: { color: 'black', width: 2 }
        }, {
            type: 'line', x0: 0, y0: bracket_y, x1: 0, y1: bracket_y - y_range * 0.04,
            xref: 'x', yref: 'y', line: { color: 'black', width: 2 }
        }, {
            type: 'line', x0: 1, y0: bracket_y, x1: 1, y1: bracket_y - y_range * 0.04,
            xref: 'x', yref: 'y', line: { color: 'black', width: 2 }
        }];
    }
    
    Plotly.newPlot(plotId, [
        { y: data1, type: 'box', name: var1, boxpoints: 'outliers' }, 
        { y: data2, type: 'box', name: var2, boxpoints: 'outliers' }
    ], layout);
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    let options = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>検定タイプ:</label>
                <input type="radio" id="ttest-independent" name="ttest-type" value="independent" checked>
                <label for="ttest-independent">対応なし</label>
                <input type="radio" id="ttest-paired" name="ttest-type" value="paired">
                <label for="ttest-paired">対応あり</label>
            </div>
            <div class="control-group">
                <label for="ttest-var1">変数1:</label>
                <select id="ttest-var1">${options}</select>
            </div>
            <div class="control-group">
                <label for="ttest-var2">変数2:</label>
                <select id="ttest-var2">${options}</select>
            </div>
            <button id="run-ttest-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="ttest-results" class="analysis-results"></div>
    `;

    document.getElementById('run-ttest-btn').addEventListener('click', () => {
        const type = document.querySelector('input[name="ttest-type"]:checked').value;
        const var1 = document.getElementById('ttest-var1').value;
        const var2 = document.getElementById('ttest-var2').value;
        if (var1 === var2) {
            alert('2つの異なる変数を選択してください。');
            return;
        }
        runTTestAnalysis(type, var1, var2);
    });
}