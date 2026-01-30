/**
 * @fileoverview t検定のヘルパー関数モジュール
 * 要約統計量の計算・表示と結果の解釈を提供
 * @module ttest/helpers
 */

import { InterpretationHelper } from '../../utils.js';

// ======================================================================
// 要約統計量
// ======================================================================

/**
 * 要約統計量を計算して表示
 * @param {string[]} variables - 変数名配列
 * @param {Object[]} currentData - データ配列
 */
export function displaySummaryStatistics(variables, currentData) {
    const container = document.getElementById('summary-stats-section');

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 要約統計量
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数名</th>
                            <th>有効N</th>
                            <th>平均値</th>
                            <th>中央値</th>
                            <th>標準偏差</th>
                            <th>分散</th>
                            <th>最小値</th>
                            <th>最大値</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    variables.forEach(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            const stats = {
                n: values.length,
                mean: jstat.mean(),
                median: jstat.median(),
                std: jstat.stdev(true),
                variance: jstat.variance(true),
                min: jstat.min(),
                max: jstat.max()
            };

            tableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                    <td>${stats.n}</td>
                    <td>${stats.mean.toFixed(2)}</td>
                    <td>${stats.median.toFixed(2)}</td>
                    <td>${stats.std.toFixed(2)}</td>
                    <td>${stats.variance.toFixed(2)}</td>
                    <td>${stats.min.toFixed(2)}</td>
                    <td>${stats.max.toFixed(2)}</td>
                </tr>
            `;
        }
    });

    tableHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = tableHtml;
}

// ======================================================================
// 解釈表示
// ======================================================================

/**
 * t検定結果の解釈を表示
 * @param {Object[]} testResults - 検定結果配列
 * @param {string|null} groupVar - グループ変数名（独立t検定の場合）
 * @param {string} testType - 検定タイプ ('independent'|'paired'|'one-sample')
 */
export function displayInterpretation(testResults, groupVar, testType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div id="interpretation-content"></div>
        </div>
    `;
    const contentContainer = document.getElementById('interpretation-content');

    let interpretationHtml = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';

    testResults.forEach(result => {
        let text = "";
        if (testType === 'independent') {
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mean2, result.groups, result.cohens_d);
        } else if (testType === 'paired') {
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mean2, result.groups, result.cohens_d);
        } else if (testType === 'one-sample') {
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mu, [result.varName, `検定値(μ=${result.mu})`], result.cohens_d);
        }

        interpretationHtml += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });
    interpretationHtml += '</ul>';

    contentContainer.innerHTML = interpretationHtml;
}

/**
 * 検定タイプのUI切り替え
 * @param {string} testType - 検定タイプ
 */
export function switchTestType(testType) {
    document.querySelectorAll('.test-type-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.test-type-tab').forEach(el => el.classList.remove('is-active'));

    document.getElementById(`${testType}-content`).style.display = 'block';
    document.querySelector(`.test-type-tab[data-test="${testType}"]`).classList.add('is-active');
}
