/**
 * @fileoverview 一元配置分散分析のヘルパー関数モジュール
 * Post-hocテスト、要約統計量表示、解釈、可視化関数を提供
 * @module anova_one_way/helpers
 */

import { createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, createPlotlyConfig, addSignificanceBrackets } from '../../utils.js';

// ======================================================================
// Post-hoc テスト
// ======================================================================

/**
 * 対応なしのペアワイズt検定（Bonferroni補正付き）
 * @param {string[]} groups - グループ名の配列
 * @param {Object} groupData - グループごとのデータ {グループ名: 数値配列}
 * @returns {Object[]} ペアワイズ比較結果の配列
 */
export function performPostHocTests(groups, groupData) {
    const pairs = [];
    const numGroups = groups.length;
    // Number of comparisons for Bonferroni
    const numComparisons = (numGroups * (numGroups - 1)) / 2;

    for (let i = 0; i < numGroups; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            const g1 = groups[i];
            const g2 = groups[j];
            const d1 = groupData[g1];
            const d2 = groupData[g2];

            if (d1.length < 2 || d2.length < 2) continue;

            const n1 = d1.length;
            const n2 = d2.length;
            const mean1 = jStat.mean(d1);
            const mean2 = jStat.mean(d2);
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);
            const var1 = std1 * std1;
            const var2 = std2 * std2;

            // Welch's t-test
            const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
            const t_stat = (mean1 - mean2) / se_welch;

            // Welch-Satterthwaite df
            const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
            const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
            const df = df_num / df_den;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

            // Bonferroni correction
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1, g2,
                p: p_adj,
                mean1, mean2,
                std1, std2,
                n1, n2
            });
        }
    }
    return pairs;
}

/**
 * 対応ありのペアワイズt検定（Bonferroni補正付き）
 * @param {string[]} dependentVars - 従属変数名の配列
 * @param {Object[]} currentData - データ配列
 * @returns {Object[]} ペアワイズ比較結果の配列
 */
export function performRepeatedPostHocTests(dependentVars, currentData) {
    const pairs = [];
    const numVars = dependentVars.length;
    const numComparisons = (numVars * (numVars - 1)) / 2;

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = dependentVars[i];
            const var2 = dependentVars[j];

            // Extract pairs where both are present
            const validPairs = currentData
                .map(row => ({ v1: row[var1], v2: row[var2] }))
                .filter(p => p.v1 != null && !isNaN(p.v1) && p.v2 != null && !isNaN(p.v2));

            if (validPairs.length < 2) continue;

            const n = validPairs.length;
            const values1 = validPairs.map(p => p.v1);
            const values2 = validPairs.map(p => p.v2);
            const mean1 = jStat.mean(values1);
            const mean2 = jStat.mean(values2);

            // Paired t-test calculation
            const diffs = validPairs.map(p => p.v1 - p.v2);
            const diffMean = jStat.mean(diffs);
            const diffStd = jStat.stdev(diffs, true);
            const se = diffStd / Math.sqrt(n);
            const t_stat = diffMean / se;
            const df = n - 1;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1: var1,
                g2: var2,
                p: p_adj,
                mean1, mean2,
                n
            });
        }
    }
    return pairs;
}

// ======================================================================
// 表示ヘルパー関数
// ======================================================================

/**
 * ANOVAの要約統計量を表示
 * @param {string[]} variables - 変数名の配列
 * @param {Object[]} currentData - データ配列
 */
export function displayANOVASummaryStatistics(variables, currentData) {
    const container = document.getElementById('summary-stats-section');
    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 選択した従属変数に関する要約統計量
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
                    <tbody>`;

    variables.forEach(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            tableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                    <td>${values.length}</td>
                    <td>${jstat.mean().toFixed(2)}</td>
                    <td>${jstat.median().toFixed(2)}</td>
                    <td>${jstat.stdev(true).toFixed(2)}</td>
                    <td>${jstat.variance(true).toFixed(2)}</td>
                    <td>${jstat.min().toFixed(2)}</td>
                    <td>${jstat.max().toFixed(2)}</td>
                </tr>`;
        }
    });

    tableHtml += `</tbody></table></div></div>`;
    container.innerHTML = tableHtml;
}

/**
 * ANOVA結果の解釈を表示
 * @param {Object[]} results - 分析結果の配列
 * @param {string} factorVar - 要因変数名
 * @param {string} testType - テストタイプ（'independent' | 'repeated'）
 */
export function displayANOVAInterpretation(results, factorVar, testType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div id="interpretation-content"></div>
        </div>`;
    const contentContainer = document.getElementById('interpretation-content');

    let interpretationHtml = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';

    results.forEach(res => {
        let factor = testType === 'independent' ? factorVar : '条件（試行）';
        // Check if etaSquared or partialEtaSquared exists
        let effectSize = res.etaSquared !== undefined ? res.etaSquared : res.partialEtaSquared;

        let text = InterpretationHelper.interpretANOVA(res.pValue, effectSize, factor);

        interpretationHtml += `<li style="margin-bottom: 0.5rem;"><strong>${res.varName}:</strong> ${text}</li>`;
    });
    interpretationHtml += '</ul>';

    contentContainer.innerHTML = interpretationHtml;
}

/**
 * ANOVA結果の可視化（棒グラフ＋誤差バー）
 * @param {Object[]} results - 分析結果の配列
 * @param {string} testType - テストタイプ（'independent' | 'repeated'）
 */
export function displayANOVAVisualization(results, testType) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <!-- 軸ラベル表示オプション -->
            <div id="visualization-controls-container"></div>
            <div id="visualization-plots"></div>
        </div>`;

    // コントロールの追加
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');

    const plotsContainer = document.getElementById('visualization-plots');
    let plotsHtml = '';
    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        plotsHtml += `
            <div style="margin-bottom: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                <h5 style="color: #2d3748; margin-bottom: 1rem;">${res.varName}</h5>
                <div class="table-container" style="margin-bottom: 1rem;">
                    <table class="table">
                        <thead>
                            <tr><th>変動要因</th><th>平方和 (SS)</th><th>自由度 (df)</th><th>平均平方 (MS)</th><th>F値</th><th>p値</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${testType === 'independent' ? '要因間 (Between)' : '条件間 (Time)'}</td>
                                <td>${res.ssBetween.toFixed(2)}</td>
                                <td>${res.df1}</td>
                                <td>${res.msBetween.toFixed(2)}</td>
                                <td>${res.fValue.toFixed(2)}</td>
                                <td style="${res.pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${res.pValue.toFixed(3)} ${res.significance}</td>
                            </tr>
                             <tr>
                                <td>${testType === 'independent' ? '要因内 (Error)' : '誤差 (Error)'}</td>
                                <td>${res.ssWithin.toFixed(2)}</td>
                                <td>${res.df2}</td>
                                <td>${res.msWithin.toFixed(2)}</td>
                                <td>-</td><td>-</td>
                            </tr>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td>合計 (Total)</td>
                                <td>${res.ssTotal.toFixed(2)}</td>
                                <td>${res.df1 + res.df2}</td>
                                <td>-</td><td>-</td><td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="${plotId}" class="plot-container"></div>
            </div>`;
    });
    plotsContainer.innerHTML = plotsHtml;

    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        const trace = {
            x: res.groups,
            y: res.groupMeans,
            error_y: {
                type: 'data',
                array: res.groupSEs,
                visible: true,
                color: 'black'
            },
            type: 'bar',
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };

        const plotAnnotations = [...(res.plotAnnotations || [])]; // Start with existing annotations (brackets)
        const tategakiTitle = getTategakiAnnotation(res.varName);
        const graphTitleText = `平均値の比較：${res.varName} by グループ`;
        const bottomTitle = getBottomTitleAnnotation(graphTitleText);

        if (tategakiTitle) plotAnnotations.push(tategakiTitle);
        if (bottomTitle) plotAnnotations.push(bottomTitle);

        const layout = {
            title: '', // Disable default title
            xaxis: { title: 'Group' },
            yaxis: { title: '' }, // Disable standard title
            shapes: [],
            annotations: plotAnnotations,
            margin: { t: 60, l: 100, b: 100 } // Add left and bottom margin, initial top margin
        };

        // Add significance brackets using the standardized helper
        const yMax = Math.max(...res.groupMeans.map((m, i) => m + res.groupSEs[i]));
        const yMin = 0;
        const yRange = yMax - yMin;

        addSignificanceBrackets(layout, res.sigPairs, res.groups, yMax, yRange);

        // Initial toggle state
        const showAxisLabels = axisControl?.checked ?? true;
        const showBottomTitle = titleControl?.checked ?? true;

        if (!showAxisLabels) {
            layout.xaxis.title = '';
            layout.annotations = layout.annotations.filter(a => a !== tategakiTitle);
        }
        if (!showBottomTitle) {
            layout.annotations = layout.annotations.filter(a => a !== bottomTitle);
        }

        Plotly.newPlot(plotId, [trace], layout, createPlotlyConfig(`一要因分散分析: ${res.varName}`, res.varName));

        // Helper to update plots
        const updatePlots = () => {
            const plotDiv = document.getElementById(plotId);
            if (plotDiv && plotDiv.data) {
                const showAxis = axisControl?.checked ?? true;
                const showTitle = titleControl?.checked ?? true;

                const currentLayout = plotDiv.layout;
                let newAnnotations = (currentLayout.annotations || []).filter(a => a._annotationType !== 'tategaki' && a._annotationType !== 'bottomTitle');

                if (showAxis) {
                    const ann = getTategakiAnnotation(res.varName);
                    if (ann) newAnnotations.push(ann);
                }
                if (showTitle) {
                    const titleAnn = getBottomTitleAnnotation(graphTitleText);
                    if (titleAnn) newAnnotations.push(titleAnn);
                }

                Plotly.relayout(plotDiv, {
                    'xaxis.title.text': showAxis ? 'Group' : '',
                    annotations: newAnnotations
                });
            }
        };

        axisControl.addEventListener('change', updatePlots);
        titleControl.addEventListener('change', updatePlots);
    });
}
