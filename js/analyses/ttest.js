import { currentData, dataCharacteristics } from '../main.js';
import { getEffectSizeInterpretation } from '../utils.js';

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
    const std2 = jstat2.stdev(true);

    let t_stat, p_value, df;

    if (type === 'paired') {
        const diff = jStat.subtract(data1, data2);
        const diffJstat = jStat(diff);
        const se = diffJstat.stdev(true) / Math.sqrt(n1);
        t_stat = diffJstat.mean() / se;
        df = n1 - 1;
        p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
    } else {
        const sp_squared = ((n1 - 1) * std1**2 + (n2 - 1) * std2**2) / (n1 + n2 - 2);
        const se = Math.sqrt(sp_squared * (1/n1 + 1/n2));
        t_stat = (mean1 - mean2) / se;
        df = n1 + n2 - 2;
        p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
    }
    
    const pooled_std = Math.sqrt((std1**2 + std2**2) / 2);
    const cohens_d = (mean1 - mean2) / pooled_std;

    let tableHtml = `
        <h5>記述統計量</h5>
        <table class="table">
            <tr><th>グループ</th><th>N</th><th>平均値</th><th>標準偏差</th></tr>
            <tr><td>${var1}</td><td>${n1}</td><td>${mean1.toFixed(4)}</td><td>${std1.toFixed(4)}</td></tr>
            <tr><td>${var2}</td><td>${n2}</td><td>${mean2.toFixed(4)}</td><td>${std2.toFixed(4)}</td></tr>
        </table>
        <h5>検定結果</h5>
        <table class="table">
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>t統計量</td><td>${t_stat.toFixed(4)}</td></tr>
            <tr><td>自由度</td><td>${df}</td></tr>
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

    // グラフ描画用のレイアウト設定
    const layout = { 
        title: `箱ひげ図: ${var1} vs ${var2}`,
        showlegend: false,
        xaxis: {
            categoryorder: 'array',
            categoryarray: [var1, var2]
        }
    };

    // p値が有意水準未満の場合のみアノテーションを追加
    if (p_value < 0.05) {
        const y_max = Math.max(...data1, ...data2);
        const y_range = jStat.range(data1.concat(data2));
        const bracket_y = y_max + y_range * 0.15;
        const annotation_y = bracket_y + y_range * 0.05;

        let significance_text = '';
        if (p_value < 0.001) significance_text = '***';
        else if (p_value < 0.01) significance_text = '**';
        else if (p_value < 0.05) significance_text = '*';
        
        layout.annotations = [{
            x: 0.5,
            y: annotation_y,
            xref: 'x',
            yref: 'y',
            text: significance_text,
            showarrow: false,
            font: { size: 16, color: 'black' }
        }];

        layout.shapes = [{
            type: 'line',
            x0: 0, y0: bracket_y,
            x1: 1, y1: bracket_y,
            xref: 'x', yref: 'y',
            line: { color: 'black', width: 2 }
        }, {
            type: 'line',
            x0: 0, y0: bracket_y,
            x1: 0, y1: bracket_y - y_range * 0.04,
            xref: 'x', yref: 'y',
            line: { color: 'black', width: 2 }
        }, {
            type: 'line',
            x0: 1, y0: bracket_y,
            x1: 1, y1: bracket_y - y_range * 0.04,
            xref: 'x', yref: 'y',
            line: { color: 'black', width: 2 }
        }];
    }
    
    Plotly.newPlot(plotId, [
        { y: data1, type: 'box', name: var1 }, 
        { y: data2, type: 'box', name: var2 }
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