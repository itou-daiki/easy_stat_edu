/**
 * @fileoverview 二元配置分散分析（独立測度デザイン）モジュール
 * 独立した2要因の分散分析を実行し、結果を表示する
 * @module anova_two_way/independent
 */

import {
    renderDataOverview,
    createVariableSelector,
    createAnalysisButton,
    renderSampleSizeInfo,
    createPlotlyConfig,
    createVisualizationControls,
    getTategakiAnnotation,
    getBottomTitleAnnotation,
    generateAPATableHtml
} from '../../utils.js';

import {
    getLevels,
    runWelchTTest,
    performSimpleMainEffectTests,
    generateBracketsForGroupedPlot
} from './helpers.js';

// ======================================================================
// 独立測度ANOVAの主要分析関数
// ======================================================================

/**
 * 独立測度の二元配置分散分析を実行
 * @param {Object[]} currentData - 分析対象データ配列
 * @returns {Object[]} 分析結果の配列
 */
export function runTwoWayIndependentANOVA(currentData) {
    const factor1 = document.getElementById('factor1-var').value;
    const factor2 = document.getElementById('factor2-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factor1 || !factor2 || factor1 === factor2 || dependentVars.length === 0) {
        alert('異なる2つの要因と、1つ以上の従属変数を選択してください。');
        return [];
    }

    // Clear results and display the section
    const resultsContainer = document.getElementById('analysis-results');

    // Ensure the results structure exists
    if (!document.getElementById('test-results-section')) {
        resultsContainer.innerHTML = `
            <div id="summary-stats-section"></div>
            <div id="test-results-section"></div>
            <div id="interpretation-section"></div>
            <div id="visualization-section"></div>
        `;
    } else {
        // Clear previous results content
        const sections = ['summary-stats-section', 'test-results-section', 'interpretation-section', 'visualization-section'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    const testResults = [];
    dependentVars.forEach(depVar => {
        const validData = currentData.filter(d => d[factor1] != null && d[factor2] != null && d[depVar] != null && !isNaN(d[depVar]));
        const n = validData.length;
        const levels1 = getLevels(validData, factor1);
        const levels2 = getLevels(validData, factor2);

        if (levels1.length < 2 || levels2.length < 2) return;

        const grandMean = jStat.mean(validData.map(d => d[depVar]));
        const ssTotal = jStat.sum(validData.map(d => Math.pow(d[depVar] - grandMean, 2)));

        const cellStats = {};
        let ssCells = 0;
        levels1.forEach(l1 => {
            cellStats[l1] = {};
            levels2.forEach(l2 => {
                const cellData = validData.filter(d => d[factor1] === l1 && d[factor2] === l2).map(d => d[depVar]);
                const mean = cellData.length > 0 ? jStat.mean(cellData) : 0;
                const std = cellData.length > 1 ? jStat.stdev(cellData, true) : 0;
                cellStats[l1][l2] = { mean, std, n: cellData.length };
                ssCells += cellData.length * Math.pow(mean - grandMean, 2);
            });
        });

        const ssA = levels1.reduce((sum, l1) => {
            const marginalData = validData.filter(d => d[factor1] === l1).map(d => d[depVar]);
            return sum + (marginalData.length * Math.pow(jStat.mean(marginalData) - grandMean, 2));
        }, 0);

        const ssB = levels2.reduce((sum, l2) => {
            const marginalData = validData.filter(d => d[factor2] === l2).map(d => d[depVar]);
            return sum + (marginalData.length * Math.pow(jStat.mean(marginalData) - grandMean, 2));
        }, 0);

        // 注意: 本モジュールは Type I（逐次）平方和（周辺平均の加重）を使用しています。
        // 非等サンプル時に Type III 風の結果が必要な場合は、メインの anova_two_way.js が未加重平均（unweighted-means）による分析を提供しています。
        const ssAxB = ssCells - ssA - ssB;
        const ssError = ssTotal - ssCells;
        const dfA = levels1.length - 1;
        const dfB = levels2.length - 1;
        const dfAxB = dfA * dfB;
        const dfError = n - (levels1.length * levels2.length);

        if (dfA <= 0 || dfB <= 0 || dfError <= 0) {
            console.warn(`Insufficient degrees of freedom for ${depVar}. Skipping.`);
            return;
        }

        const msA = ssA / dfA;
        const msB = ssB / dfB;
        const msAxB = dfAxB > 0 ? ssAxB / dfAxB : 0;
        const msError = ssError / dfError;

        const fA = msA / msError;
        const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);

        const fB = msB / msError;
        const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);

        const fAxB = dfAxB > 0 ? msAxB / msError : 0;
        const pAxB = dfAxB > 0 ? 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError) : 1;

        const etaA = ssA / (ssA + ssError);
        const etaB = ssB / (ssB + ssError);
        const etaAxB = dfAxB > 0 ? ssAxB / (ssAxB + ssError) : 0;

        // Perform Simple Main Effect Tests
        const resultSigPairs = performSimpleMainEffectTests(validData, factor1, factor2, depVar, 'independent');

        testResults.push({
            depVar, factor1, factor2, levels1, levels2,
            cellStats,
            pA, pB, pAxB,
            etaA, etaB, etaAxB,
            ssA, dfA, msA, fA,
            ssB, dfB, msB, fB,
            ssAxB, dfAxB, msAxB, fAxB,
            ssError, dfError, msError,
            sigPairs: resultSigPairs
        });
    });

    // Populate the sections
    renderTwoWayANOVATable(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'independent');
    renderTwoWayANOVAVisualization(testResults);

    document.getElementById('analysis-results').style.display = 'block';

    return testResults;
}

// ======================================================================
// 結果表示関数
// ======================================================================

/**
 * 二元配置ANOVAの解釈を表示
 * @param {Object[]} results - 分析結果配列
 * @param {string} designType - デザイン種別 ('independent' | 'mixed')
 */
export function displayTwoWayANOVAInterpretation(results, designType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> 解釈の補助
            </h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>`;

    const contentContainer = document.getElementById('interpretation-content');
    let html = '';

    results.forEach(res => {
        let factorA, factorB, pA, pB, pAxB, etaA, etaB, etaAxB, varName;

        if (designType === 'independent') {
            factorA = res.factor1;
            factorB = res.factor2;
            pA = res.pA;
            pB = res.pB;
            pAxB = res.pAxB;
            etaA = res.etaA;
            etaB = res.etaB;
            etaAxB = res.etaAxB;
            varName = res.depVar;
        } else {
            factorA = res.factorBetween;
            factorB = res.factorWithin;
            const srcA = res.sources.find(s => s.name.includes(factorA));
            const srcB = res.sources.find(s => s.name.includes(factorB) || s.name.includes('条件'));
            const srcAxB = res.sources.find(s => s.name.includes('×'));
            pA = srcA ? srcA.p : 1;
            pB = srcB ? srcB.p : 1;
            pAxB = srcAxB ? srcAxB.p : 1;
            etaA = srcA ? srcA.eta : 0;
            etaB = srcB ? srcB.eta : 0;
            etaAxB = srcAxB ? srcAxB.eta : 0;
            varName = '測定値';
        }

        const getSigText = (p) => p < 0.05 ? '有意な差（効果）が見られました。' : '有意な差（効果）は見られませんでした。';
        const getStars = (p) => p < 0.01 ? '**' : p < 0.05 ? '*' : p < 0.1 ? '†' : 'n.s.';

        html += `
            <div style="margin-bottom: 1.5rem; border-left: 4px solid #1e90ff; padding-left: 1rem;">
                <h5 style="font-weight: bold; color: #2d3748; margin-bottom: 0.5rem;">${varName} の分析結果:</h5>
                
                <p style="margin: 0.5rem 0;">
                    <strong>1. 交互作用 (${factorA} × ${factorB}):</strong> <br>
                    p = ${pAxB.toFixed(3)} (${getStars(pAxB)}), 偏η² = ${etaAxB.toFixed(2)}。<br>
                    ${getSigText(pAxB)}
                    ${pAxB < 0.05 ? '<br><span style="color: #d97706; font-size: 0.9em;"><i class="fas fa-exclamation-triangle"></i> 交互作用が有意であるため、主効果の解釈には注意が必要です（単純主効果の検定を推奨）。要因の組み合わせによって結果が異なる可能性があります。</span>' : '<br><span style="color: #059669; font-size: 0.9em;">交互作用は有意ではないため、それぞれの主効果（要因単独の影響）に着目します。</span>'}
                </p>

                <p style="margin: 0.5rem 0;">
                    <strong>2. ${factorA} の主効果:</strong> <br>
                    p = ${pA.toFixed(3)} (${getStars(pA)}), 偏η² = ${etaA.toFixed(2)}。<br>
                    ${getSigText(pA)}
                </p>

                <p style="margin: 0.5rem 0;">
                    <strong>3. ${factorB} の主効果:</strong> <br>
                    p = ${pB.toFixed(3)} (${getStars(pB)}), 偏η² = ${etaB.toFixed(2)}。<br>
                    ${getSigText(pB)}
                </p>
            </div>
        `;
    });

    contentContainer.innerHTML = html;
}

/**
 * 二元配置ANOVAの結果テーブルを描画
 * @param {Object[]} results - 分析結果配列
 */
export function renderTwoWayANOVATable(results) {
    if (results.length === 0) return;

    const container = document.getElementById('test-results-section');
    let finalHtml = '';

    results.forEach((res, index) => {
        const sources = [
            { name: res.factor1, ss: res.ssA, df: res.dfA, ms: res.msA, f: res.fA, p: res.pA, eta: res.etaA },
            { name: res.factor2, ss: res.ssB, df: res.dfB, ms: res.msB, f: res.fB, p: res.pB, eta: res.etaB },
            { name: `${res.factor1} × ${res.factor2}`, ss: res.ssAxB, df: res.dfAxB, ms: res.msAxB, f: res.fAxB, p: res.pAxB, eta: res.etaAxB },
            { name: '誤差 (Error)', ss: res.ssError, df: res.dfError, ms: res.msError, f: null, p: null, eta: null }
        ];

        finalHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 分散分析表: ${res.depVar}
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

        sources.forEach(src => {
            const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
            const pStr = src.p !== null ? `${src.p.toFixed(3)} ${sig}` : '-';
            const fStr = src.f !== null ? src.f.toFixed(2) : '-';
            const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';

            finalHtml += `
                <tr>
                    <td style="text-align: left; font-weight: 500;">${src.name}</td>
                    <td>${src.ss.toFixed(2)}</td>
                    <td>${src.df}</td>
                    <td>${src.ms.toFixed(2)}</td>
                    <td>${fStr}</td>
                    <td style="${src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
                    <td>${etaStr}</td>
                </tr>
            `;
        });

        finalHtml += `</tbody></table>
            <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
            </div></div>`;

        // Descriptive Stats Table
        finalHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
                記述統計量: ${res.depVar}
            </h4>
            <div class="table-container">
                <table class="table">
                     <thead>
                        <tr>
                            <th>${res.factor1}</th>
                            <th>${res.factor2}</th>
                            <th>平均値 (M)</th>
                            <th>標準偏差 (SD)</th>
                            <th>サンプル数 (N)</th>
                        </tr>
                    </thead>
                    <tbody>`;

        res.levels1.forEach(l1 => {
            res.levels2.forEach(l2 => {
                const stat = res.cellStats[l1][l2];
                finalHtml += `
                    <tr>
                        <td>${l1}</td>
                        <td>${l2}</td>
                        <td>${stat.mean.toFixed(2)}</td>
                        <td>${stat.std.toFixed(2)}</td>
                        <td>${stat.n}</td>
                    </tr>
                `;
            });
        });

        finalHtml += `</tbody></table></div></div>`;

        // Generate APA Source Table
        const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
        const rowsAPA = sources.map(src => {
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

        finalHtml += `
            <div style="margin-bottom: 2rem;">
                 <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                 <div>${generateAPATableHtml(`anova-ind-apa-${index || 0}`, `Table 1. Two-Way ANOVA Source Table for ${res.depVar}`, headersAPA, rowsAPA, `<em>Note</em>. Effect size is partial eta-squared.`)}</div>
            </div>
        `;
    });

    container.innerHTML = finalHtml;
}

/**
 * 二元配置ANOVAの可視化を描画
 * @param {Object[]} results - 分析結果配列
 */
export function renderTwoWayANOVAVisualization(results) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;"><i class="fas fa-chart-bar"></i> 可視化</h4>
            <!-- 軸ラベル表示オプション -->
            <div id="viz-controls-container"></div>
            <div id="visualization-plots"></div>
        </div>`;

    // コントロールの追加
    const { axisControl, titleControl } = createVisualizationControls('viz-controls-container');

    const plotsContainer = document.getElementById('visualization-plots');
    plotsContainer.innerHTML = '';

    results.forEach((res, index) => {
        const plotId = `anova-plot-${index}`;
        plotsContainer.innerHTML += `<div id="${plotId}" class="plot-container" style="margin-top: 1rem;"></div>`;

        setTimeout(() => {
            const plotDiv = document.getElementById(plotId);
            if (plotDiv) {
                const traces = [];
                res.levels1.forEach(l1 => {
                    const yData = res.levels2.map(l2 => res.cellStats[l1][l2].mean);
                    const errorData = res.levels2.map(l2 => {
                        const n = res.cellStats[l1][l2].n;
                        return n > 0 ? res.cellStats[l1][l2].std / Math.sqrt(n) : 0;
                    });
                    traces.push({
                        x: res.levels2,
                        y: yData,
                        name: l1,
                        type: 'bar',
                        error_y: {
                            type: 'data',
                            array: errorData,
                            visible: true,
                            color: 'black'
                        }
                    });
                });

                const { shapes, annotations, recommendedMaxY } = generateBracketsForGroupedPlot(res.sigPairs || [], res.levels1, res.levels2, res.cellStats);

                const tategakiTitle = getTategakiAnnotation(res.depVar);
                if (tategakiTitle) {
                    annotations.push(tategakiTitle);
                }

                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;
                const bottomTitle = getBottomTitleAnnotation(graphTitleText);
                if (bottomTitle) {
                    annotations.push(bottomTitle);
                }

                const yaxisConfig = { title: '', rangemode: 'tozero' };
                if (recommendedMaxY) {
                    yaxisConfig.range = [0, recommendedMaxY];
                }

                const layout = {
                    title: '',
                    xaxis: { title: res.factor2 },
                    yaxis: yaxisConfig,
                    legend: { title: { text: res.factor1 } },
                    barmode: 'group',
                    shapes: shapes,
                    annotations: annotations,
                    margin: { l: 100, b: 100 }
                };

                const showAxisLabels = axisControl?.checked ?? true;
                const showBottomTitle = titleControl?.checked ?? true;

                if (!showAxisLabels) {
                    layout.xaxis.title = '';
                    layout.annotations = layout.annotations.filter(a => a !== tategakiTitle);
                }
                if (!showBottomTitle) {
                    layout.annotations = layout.annotations.filter(a => a !== bottomTitle);
                }

                Plotly.newPlot(plotDiv, traces, layout, createPlotlyConfig('二要因分散分析', res.depVar));
            }
        }, 100);
    });

    // Attach listeners once outside the loop
    const updateAllPlots = () => {
        const showAxis = axisControl?.checked ?? true;
        const showTitle = titleControl?.checked ?? true;

        results.forEach((res, index) => {
            const plotId = `anova-plot-${index}`;
            const plotDiv = document.getElementById(plotId);
            if (plotDiv && plotDiv.data) {
                const currentLayout = plotDiv.layout;
                const graphTitleText = `平均値の棒グラフ: ${res.depVar}`;

                let newAnnotations = (currentLayout.annotations || []).filter(a => a._annotationType !== 'tategaki' && a._annotationType !== 'bottomTitle');

                if (showAxis) {
                    const ann = getTategakiAnnotation(res.depVar);
                    if (ann) newAnnotations.push(ann);
                }
                if (showTitle) {
                    const titleAnn = getBottomTitleAnnotation(graphTitleText);
                    if (titleAnn) newAnnotations.push(titleAnn);
                }

                Plotly.relayout(plotDiv, {
                    'xaxis.title.text': showAxis ? res.factor2 : '',
                    annotations: newAnnotations
                });
            }
        });
    };

    axisControl.addEventListener('change', updateAllPlots);
    titleControl.addEventListener('change', updateAllPlots);
}
