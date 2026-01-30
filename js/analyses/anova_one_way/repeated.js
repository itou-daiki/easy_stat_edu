/**
 * @fileoverview 一元配置分散分析（反復測定/対応あり）モジュール
 * 被験者内デザインのANOVA分析を実行
 * @module anova_one_way/repeated
 */

import { renderSampleSizeInfo, generateAPATableHtml } from '../../utils.js';
import { performRepeatedPostHocTests, displayANOVASummaryStatistics, displayANOVAInterpretation, displayANOVAVisualization } from './helpers.js';

// ======================================================================
// 反復測定の一元配置分散分析
// ======================================================================

/**
 * 反復測定の一元配置分散分析を実行
 * @param {Object[]} currentData - データ配列
 */
export function runOneWayRepeatedANOVA(currentData) {
    const dependentVarSelect = document.getElementById('rep-dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (dependentVars.length < 3) {
        alert('対応あり分散分析には3つ以上の変数（条件）が必要です');
        return;
    }

    document.getElementById('analysis-results').style.display = 'none';

    // 1. Summary Statistics
    displayANOVASummaryStatistics(dependentVars, currentData);

    const validData = currentData.map(row => dependentVars.map(v => row[v])).filter(vals => vals.every(v => v != null && !isNaN(v)));
    const N = validData.length;
    const k = dependentVars.length;

    if (N < 2) {
        alert('有効なデータ（全条件が揃っている行）が不足しています');
        return;
    }

    const grandMean = jStat.mean(validData.flat());
    const ssTotal = jStat.sum(validData.flat().map(v => Math.pow(v - grandMean, 2)));
    const ssSubjects = k * jStat.sum(validData.map(row => Math.pow(jStat.mean(row) - grandMean, 2)));

    const conditionMeans = Array.from({ length: k }, (_, i) => jStat.mean(validData.map(row => row[i])));
    const ssConditions = N * jStat.sum(conditionMeans.map(mean => Math.pow(mean - grandMean, 2)));

    const ssError = ssTotal - ssSubjects - ssConditions;
    const dfConditions = k - 1;
    const dfError = (N - 1) * (k - 1);
    if (dfError <= 0) { alert('誤差の自由度が0以下です。'); return; }

    const msConditions = ssConditions / dfConditions;
    const msError = ssError / dfError;
    const fValue = msConditions / msError;
    const pValue = 1 - jStat.centralF.cdf(fValue, dfConditions, dfError);

    const etaSquaredPartial = ssConditions / (ssConditions + ssError);
    const omegaSquared = (ssConditions - (dfConditions * msError)) / (ssTotal + msError);
    let significance = pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : pValue < 0.1 ? '†' : 'n.s.';

    // 2. Main Test Results Table
    const resultsContainer = document.getElementById('test-results-section');
    const headers = ['要因', '全体M', '全体S.D', ...dependentVars.map(v => `${v} M`), ...dependentVars.map(v => `${v} S.D`), '条件<br>自由度', '誤差<br>自由度', 'F', 'p', 'sign', 'ηp²', 'ω²'];
    const conditionStds = dependentVars.map((v, i) => jStat.stdev(validData.map(row => row[i]), true));
    const rowData = [dependentVars.join(' vs '), grandMean, jStat.stdev(validData.flat(), true), ...conditionMeans, ...conditionStds, dfConditions, dfError, fValue, pValue, significance, etaSquaredPartial, omegaSquared];

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応あり）
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody><tr>${rowData.map((d, i) => (i === 0 || i === headers.indexOf('sign')) ? `<td>${d}</td>` : `<td>${d.toFixed(2)}</td>`).join('')}</tr></tbody>
                </table>
            </div>
            <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p>
            
            <div style="margin-top: 2rem;">
                 <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                 <div id="reporting-table-container-anova-rep"></div>
            </div>
        </div>`;
    resultsContainer.innerHTML = tableHtml;

    // Generate APA Source Table for Repeated Measures
    const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
    const rowsAPA = [
        ["Conditions", ssConditions.toFixed(2), dfConditions, msConditions.toFixed(2), fValue.toFixed(2), (pValue < 0.001 ? '< .001' : pValue.toFixed(3)), etaSquaredPartial.toFixed(2)],
        ["Error", ssError.toFixed(2), dfError, msError.toFixed(2), "-", "-", "-"],
        ["Total (excl. subj)", (ssConditions + ssError).toFixed(2), dfConditions + dfError, "-", "-", "-", "-"]
    ];

    setTimeout(() => {
        const container = document.getElementById('reporting-table-container-anova-rep');
        if (container)
            container.innerHTML = generateAPATableHtml('anova-rep-apa', 'Table 1. One-Way Repeated Measures ANOVA', headersAPA, rowsAPA, `<em>Note</em>. Sphericity assumed.`);
    }, 0);

    // 3. Sample Size
    renderSampleSizeInfo(resultsContainer, N);

    const conditionSEs = dependentVars.map((v, i) => jStat.stdev(validData.map(row => row[i]), true) / Math.sqrt(N));
    const sigPairs = performRepeatedPostHocTests(dependentVars, currentData);

    const testResults = [{
        varName: `条件 (${dependentVars.join(', ')})`,
        groups: dependentVars, groupMeans: conditionMeans, groupSEs: conditionSEs,
        ssBetween: ssConditions, df1: dfConditions, msBetween: msConditions,
        ssWithin: ssError, df2: dfError, msWithin: msError,
        ssTotal: ssConditions + ssError,
        fValue, pValue, significance, etaSquared: etaSquaredPartial,
        sigPairs: sigPairs.map(p => ({
            ...p,
            significance: p.p < 0.01 ? '**' : p.p < 0.05 ? '*' : p.p < 0.1 ? '†' : 'n.s.'
        }))
    }];

    // 4. Interpretation
    displayANOVAInterpretation(testResults, null, 'repeated');

    // 5. Visualization
    displayANOVAVisualization(testResults, 'repeated');

    document.getElementById('analysis-results').style.display = 'block';
}
