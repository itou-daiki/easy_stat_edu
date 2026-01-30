/**
 * @fileoverview 一元配置分散分析（独立標本/対応なし）モジュール
 * 被験者間デザインのANOVA分析を実行
 * @module anova_one_way/independent
 */

import { renderSampleSizeInfo, generateAPATableHtml, calculateLeveneTest } from '../../utils.js';
import { performPostHocTests, displayANOVASummaryStatistics, displayANOVAInterpretation, displayANOVAVisualization } from './helpers.js';

// ======================================================================
// 独立標本の一元配置分散分析
// ======================================================================

/**
 * 独立標本の一元配置分散分析を実行
 * @param {Object[]} currentData - データ配列
 */
export function runOneWayIndependentANOVA(currentData) {
    const factorVar = document.getElementById('factor-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factorVar || dependentVars.length === 0) {
        alert('要因（グループ変数）と従属変数を1つ以上選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null).sort();
    if (groups.length < 2) {
        alert(`一要因分散分析（対応なし）には2群以上必要です（現在: ${groups.length} 群）`);
        return;
    }

    document.getElementById('analysis-results').style.display = 'none';

    // 1. Summary Statistics
    displayANOVASummaryStatistics(dependentVars, currentData);

    const testResults = [];
    const mainResultsTable = [];

    dependentVars.forEach(depVar => {
        const groupData = {};
        let totalN = 0;
        groups.forEach(g => {
            groupData[g] = currentData
                .filter(row => row[factorVar] === g)
                .map(row => row[depVar])
                .filter(v => v != null && !isNaN(v));
            totalN += groupData[g].length;
        });

        const allValues = Object.values(groupData).flat();
        if (allValues.length < groups.length) return;

        const grandMean = jStat.mean(allValues);
        let ssBetween = 0;
        let ssWithin = 0;
        groups.forEach(g => {
            const vals = groupData[g];
            if (vals.length > 0) {
                const mean = jStat.mean(vals);
                ssBetween += vals.length * Math.pow(mean - grandMean, 2);
                ssWithin += vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
            }
        });

        const dfBetween = groups.length - 1;
        const dfWithin = totalN - groups.length;
        if (dfBetween <= 0 || dfWithin <= 0) return;

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fValue = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);

        const ssTotal = ssBetween + ssWithin;
        const etaSquared = ssBetween / ssTotal;
        const omegaSquared = (ssBetween - (dfBetween * msWithin)) / (ssTotal + msWithin);

        let significance = 'n.s.';
        if (pValue < 0.01) significance = '**';
        else if (pValue < 0.05) significance = '*';
        else if (pValue < 0.1) significance = '†';

        const groupMeans = groups.map(g => jStat.mean(groupData[g]));
        const groupStds = groups.map(g => jStat.stdev(groupData[g], true));
        const groupSEs = groups.map(g => jStat.stdev(groupData[g], true) / Math.sqrt(groupData[g].length));

        // Post-hoc for plot
        const sigPairs = performPostHocTests(groups, groupData);

        const levenes = calculateLeveneTest(Object.values(groupData));

        mainResultsTable.push({
            depVar,
            overallMean: jStat.mean(allValues),
            overallStd: jStat.stdev(allValues, true),
            groupMeans,
            groupStds,
            dfBetween,
            dfWithin,
            fValue,
            pValue,
            sign: significance,
            etaSquared,
            omegaSquared,
            levenes
        });

        testResults.push({
            varName: depVar,
            groups: groups,
            groupMeans: groupMeans,
            groupSEs: groupSEs,
            ssBetween, df1: dfBetween, msBetween,
            ssWithin, df2: dfWithin, msWithin,
            ssTotal, fValue, pValue, significance, etaSquared,
            sigPairs: sigPairs.map(p => ({
                ...p,
                significance: p.p < 0.01 ? '**' : p.p < 0.05 ? '*' : p.p < 0.1 ? '†' : 'n.s.'
            }))
        });
    });

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['変数', '全体M', '全体S.D', ...groups.map(g => `${g} M`), ...groups.map(g => `${g} S.D`), 'Levene p<br><small>(等分散性)</small>', '群間<br>自由度', '群内<br>自由度', 'F', 'p', 'sign', 'η²', 'ω²'];
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応なし）
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>`;

    mainResultsTable.forEach(res => {
        const levenesPStr = res.levenes.p < 0.001 ? '< .001' : res.levenes.p.toFixed(3);
        const levenesSign = res.levenes.p < 0.05 ? '<i class="fas fa-exclamation-triangle" style="color: #d97706;" title="等分散性が棄却されました。平均値の差の検定には慎重な解釈が必要です（Welchの検定などを検討してください）。"></i>' : '<i class="fas fa-check" style="color: #10b981;" title="等分散性は棄却されませんでした。"></i>';
        const levenesCell = `<td style="background-color: ${res.levenes.p < 0.05 ? '#fff3cd' : 'transparent'}; font-size: 0.9rem;">${levenesPStr} ${levenesSign}</td>`;

        const pValueStr = res.pValue < 0.001 ? '< .001' : res.pValue.toFixed(3);

        let rowHtml = '<tr>';
        rowHtml += `<td><strong>${res.depVar}</strong></td>`;
        rowHtml += `<td>${res.overallMean.toFixed(2)}</td>`;
        rowHtml += `<td>${res.overallStd.toFixed(2)}</td>`;
        res.groupMeans.forEach(m => rowHtml += `<td>${m.toFixed(2)}</td>`);
        res.groupStds.forEach(s => rowHtml += `<td>${s.toFixed(2)}</td>`);

        rowHtml += levenesCell;

        rowHtml += `<td>${res.dfBetween}</td>`;
        rowHtml += `<td>${res.dfWithin}</td>`;
        rowHtml += `<td>${res.fValue.toFixed(2)}</td>`;
        rowHtml += `<td>${pValueStr}</td>`;
        rowHtml += `<td><strong>${res.sign}</strong></td>`;
        rowHtml += `<td>${res.etaSquared.toFixed(2)}</td>`;
        rowHtml += `<td>${res.omegaSquared.toFixed(3)}</td>`;
        rowHtml += '</tr>';

        tableHtml += rowHtml;
    });
    tableHtml += `</tbody></table></div>
    <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
        <i class="fas fa-info-circle"></i> <strong>Levene p</strong>: 等分散性の検定。p < .05 の場合、この通常のANOVAの結果は信頼性が低い可能性があります（分散が異なるため）。
    </div>
    <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p></div>`;
    resultsContainer.innerHTML = tableHtml;

    // 3. Sample Size
    const groupSampleSizes = groups.map((g, i) => {
        const colors = ['#11b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
        return { label: g, count: currentData.filter(row => row[factorVar] === g).length, color: colors[i % colors.length] };
    });
    renderSampleSizeInfo(resultsContainer, currentData.length, groupSampleSizes);

    // 4. Interpretation
    displayANOVAInterpretation(testResults, factorVar, 'independent');

    // 5. Visualization (Detailed tables + plots)
    displayANOVAVisualization(testResults, 'independent');

    document.getElementById('analysis-results').style.display = 'block';
}
