/**
 * @fileoverview 二元配置分散分析（被験者内デザイン・2x2）モジュール
 * 全因子が反復測定の分散分析を実行
 * @module anova_two_way/within
 */

import { generateAPATableHtml } from '../../utils.js';

// ======================================================================
// 被験者内ANOVAの主要分析関数
// ======================================================================

/**
 * 被験者内デザインの二元配置分散分析を実行（2x2固定）
 * @param {Object[]} data - 分析対象データ配列
 * @returns {Object} 分析結果
 */
export async function runTwoWayWithinANOVA(data) {
    const factorAName = document.getElementById('within-factor-a-name').value || 'FactorA';
    const factorBName = document.getElementById('within-factor-b-name').value || 'FactorB';
    const a1 = document.getElementById('within-level-a1').value || 'A1';
    const a2 = document.getElementById('within-level-a2').value || 'A2';
    const b1 = document.getElementById('within-level-b1').value || 'B1';
    const b2 = document.getElementById('within-level-b2').value || 'B2';

    const varA1B1 = document.getElementById('within-var-a1b1').value;
    const varA1B2 = document.getElementById('within-var-a1b2').value;
    const varA2B1 = document.getElementById('within-var-a2b1').value;
    const varA2B2 = document.getElementById('within-var-a2b2').value;

    if (!varA1B1 || !varA1B2 || !varA2B1 || !varA2B2) {
        alert('全てのセルに変数を割り当ててください。');
        return null;
    }

    // Listwise Deletion
    const cleanData = data.filter(row => {
        return [varA1B1, varA1B2, varA2B1, varA2B2].every(v => row[v] !== "" && row[v] !== null && row[v] !== undefined);
    });

    if (cleanData.length < 2) {
        alert('有効なデータが不足しています。');
        return null;
    }

    const n = cleanData.length;
    const a = 2;
    const b = 2;

    // Extract values
    const Y11 = cleanData.map(r => parseFloat(r[varA1B1]));
    const Y12 = cleanData.map(r => parseFloat(r[varA1B2]));
    const Y21 = cleanData.map(r => parseFloat(r[varA2B1]));
    const Y22 = cleanData.map(r => parseFloat(r[varA2B2]));

    // Helper functions
    const sumSq = (arr) => arr.reduce((s, x) => s + x * x, 0);
    const sum = (arr) => arr.reduce((s, x) => s + x, 0);

    // Totals
    const T = sum(Y11) + sum(Y12) + sum(Y21) + sum(Y22);
    const N = n * a * b;
    const CF = (T * T) / N;

    const SS_Total = sumSq(Y11) + sumSq(Y12) + sumSq(Y21) + sumSq(Y22) - CF;

    // Subjects Totals
    const S = cleanData.map((_, i) => Y11[i] + Y12[i] + Y21[i] + Y22[i]);
    const SS_S = sumSq(S) / (a * b) - CF;

    // Factor A Totals
    const A1_total = sum(Y11) + sum(Y12);
    const A2_total = sum(Y21) + sum(Y22);
    const SS_A = (A1_total * A1_total + A2_total * A2_total) / (b * n) - CF;

    // Factor B Totals
    const B1_total = sum(Y11) + sum(Y21);
    const B2_total = sum(Y12) + sum(Y22);
    const SS_B = (B1_total * B1_total + B2_total * B2_total) / (a * n) - CF;

    // Cell Totals for AB Interaction
    const T11 = sum(Y11);
    const T12 = sum(Y12);
    const T21 = sum(Y21);
    const T22 = sum(Y22);
    const SS_Cells = (T11 ** 2 + T12 ** 2 + T21 ** 2 + T22 ** 2) / n - CF;
    const SS_AxB = SS_Cells - SS_A - SS_B;

    // Interaction with Subjects (Error terms)
    const AS1 = cleanData.map((_, i) => Y11[i] + Y12[i]);
    const AS2 = cleanData.map((_, i) => Y21[i] + Y22[i]);
    const SS_AS_Cell = (sumSq(AS1) + sumSq(AS2)) / b - CF;
    const SS_AxS = SS_AS_Cell - SS_S - SS_A;

    const BS1 = cleanData.map((_, i) => Y11[i] + Y21[i]);
    const BS2 = cleanData.map((_, i) => Y12[i] + Y22[i]);
    const SS_BS_Cell = (sumSq(BS1) + sumSq(BS2)) / a - CF;
    const SS_BxS = SS_BS_Cell - SS_S - SS_B;

    const SS_AxBxS = SS_Total - (SS_S + SS_A + SS_B + SS_AxB + SS_AxS + SS_BxS);

    // Degrees of Freedom
    const df_A = a - 1;
    const df_B = b - 1;
    const df_AxB = (a - 1) * (b - 1);
    const df_S = n - 1;
    const df_AxS = (a - 1) * (n - 1);
    const df_BxS = (b - 1) * (n - 1);
    const df_AxBxS = (a - 1) * (b - 1) * (n - 1);

    // MS & F
    const MS_A = SS_A / df_A;
    const MS_AxS = SS_AxS / df_AxS;
    const F_A = MS_A / MS_AxS;
    const p_A = 1 - jStat.centralF.cdf(F_A, df_A, df_AxS);

    const MS_B = SS_B / df_B;
    const MS_BxS = SS_BxS / df_BxS;
    const F_B = MS_B / MS_BxS;
    const p_B = 1 - jStat.centralF.cdf(F_B, df_B, df_BxS);

    const MS_AxB = SS_AxB / df_AxB;
    const MS_AxBxS = SS_AxBxS / df_AxBxS;
    const F_AxB = MS_AxB / MS_AxBxS;
    const p_AxB = 1 - jStat.centralF.cdf(F_AxB, df_AxB, df_AxBxS);

    // Partial Eta Squared
    const eta_A = SS_A / (SS_A + SS_AxS);
    const eta_B = SS_B / (SS_B + SS_BxS);
    const eta_AxB = SS_AxB / (SS_AxB + SS_AxBxS);

    // Structure Results
    const results = {
        factorA: factorAName,
        factorB: factorBName,
        levelsA: [a1, a2],
        levelsB: [b1, b2],
        sources: [
            { name: factorAName, ss: SS_A, df: df_A, ms: MS_A, f: F_A, p: p_A, eta: eta_A },
            { name: `${factorAName} × Subject (Error)`, ss: SS_AxS, df: df_AxS, ms: MS_AxS, f: null, p: null, eta: null },
            { name: factorBName, ss: SS_B, df: df_B, ms: MS_B, f: F_B, p: p_B, eta: eta_B },
            { name: `${factorBName} × Subject (Error)`, ss: SS_BxS, df: df_BxS, ms: MS_BxS, f: null, p: null, eta: null },
            { name: `${factorAName} × ${factorBName}`, ss: SS_AxB, df: df_AxB, ms: MS_AxB, f: F_AxB, p: p_AxB, eta: eta_AxB },
            { name: `${factorAName} × ${factorBName} × Subject (Error)`, ss: SS_AxBxS, df: df_AxBxS, ms: MS_AxBxS, f: null, p: null, eta: null }
        ],
        cellStats: {
            [a1]: { [b1]: { mean: T11 / n, std: jStat.stdev(Y11) }, [b2]: { mean: T12 / n, std: jStat.stdev(Y12) } },
            [a2]: { [b1]: { mean: T21 / n, std: jStat.stdev(Y21) }, [b2]: { mean: T22 / n, std: jStat.stdev(Y22) } }
        }
    };

    renderTwoWayWithinANOVATable(results);

    return results;
}

// ======================================================================
// 結果テーブル描画
// ======================================================================

/**
 * 被験者内ANOVAの結果テーブルを描画
 * @param {Object} res - 分析結果
 */
export function renderTwoWayWithinANOVATable(res) {
    const container = document.getElementById('analysis-results');
    const tableContainer = document.getElementById('test-results-section');
    const summaryContainer = document.getElementById('summary-stats-section');
    const vizContainer = document.getElementById('visualization-section');

    container.style.display = 'block';

    // Clear previous
    tableContainer.innerHTML = '';
    summaryContainer.innerHTML = '';
    vizContainer.innerHTML = '';

    // ANOVA Table
    let tableHtml = `
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
        <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
            分散分析表 (Within-Subjects Design)
        </h4>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変動要因 (Source)</th>
                        <th>平方和 (SS)</th>
                        <th>自由度 (df)</th>
                        <th>平均平方 (MS)</th>
                        <th>F値</th>
                        <th>p値</th>
                        <th>偏η²</th>
                    </tr>
                </thead>
                <tbody>`;

    res.sources.forEach(src => {
        const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
        const pStr = src.p !== null ? src.p.toFixed(3) + sig : '-';
        const fStr = src.f !== null ? src.f.toFixed(2) : '-';
        const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';
        const msStr = src.ms.toFixed(2);

        tableHtml += `
        <tr>
            <td style="text-align: left; font-weight: 500;">${src.name}</td>
            <td>${src.ss.toFixed(2)}</td>
            <td>${src.df}</td>
            <td>${msStr}</td>
            <td>${fStr}</td>
            <td style="${src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
            <td>${etaStr}</td>
        </tr>
    `;
    });

    tableHtml += `</tbody></table>
    <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
    </div></div>`;

    tableContainer.innerHTML = tableHtml;

    // Descriptive Stats Table
    let summaryHtml = `
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
            平均値と標準偏差
        </h4>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>${res.factorA}</th>
                        ${res.levelsB.map(l => `<th>${l} (${res.factorB})</th>`).join('')}
                    </tr>
                </thead>
                <tbody>`;

    res.levelsA.forEach(l1 => {
        summaryHtml += `<tr>
        <td style="font-weight: bold;">${l1}</td>`;
        res.levelsB.forEach(l2 => {
            const s = res.cellStats[l1][l2];
            summaryHtml += `<td>${s.mean.toFixed(2)} (SD: ${s.std.toFixed(2)})</td>`;
        });
        summaryHtml += `</tr>`;
    });

    summaryHtml += `</tbody></table></div></div>`;
    summaryContainer.innerHTML = summaryHtml;

    // Generate APA Source Table
    const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
    const rowsAPA = res.sources.map(src => {
        const sig = src.p !== null ? (src.p < 0.001 ? '< .001' : src.p.toFixed(3)) : '-';
        return [
            src.name,
            src.ss.toFixed(2),
            src.df,
            src.ms.toFixed(2),
            src.f !== null ? src.f.toFixed(2) : '-',
            sig,
            src.eta !== null ? src.eta.toFixed(2) : '-'
        ];
    });

    tableContainer.innerHTML += `
    <div style="margin-bottom: 2rem;">
            <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
            <div>${generateAPATableHtml('anova-within-apa', 'Table 1. Two-Way Within-Subjects ANOVA Source Table', headersAPA, rowsAPA, '<em>Note</em>. Effect size is partial eta-squared.')}</div>
    </div>
    `;

    // Visualization (Interaction Plot)
    const trace1 = {
        x: res.levelsA,
        y: res.levelsA.map(a => res.cellStats[a][res.levelsB[0]].mean),
        name: res.levelsB[0],
        type: 'scatter',
        mode: 'lines+markers'
    };

    const trace2 = {
        x: res.levelsA,
        y: res.levelsA.map(a => res.cellStats[a][res.levelsB[1]].mean),
        name: res.levelsB[1],
        type: 'scatter',
        mode: 'lines+markers'
    };

    const layout = {
        title: `Interaction Plot: ${res.factorA} x ${res.factorB}`,
        xaxis: { title: res.factorA },
        yaxis: { title: 'Mean Value' },
        margin: { l: 50, r: 50, b: 50, t: 50 },
        height: 400
    };

    vizContainer.innerHTML = '<div id="within-interaction-plot"></div>';

    setTimeout(() => {
        const plotDiv = document.getElementById('within-interaction-plot');
        if (plotDiv) {
            Plotly.newPlot(plotDiv, [trace1, trace2], layout);
        }
    }, 0);
}
