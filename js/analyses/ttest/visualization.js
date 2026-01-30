/**
 * @fileoverview t検定の可視化モジュール
 * 棒グラフ、エラーバー、有意差ブラケット表示
 * @module ttest/visualization
 */

import { createPlotlyConfig, createVisualizationControls, getBottomTitleAnnotation, addSignificanceBrackets } from '../../utils.js';

// ======================================================================
// 可視化
// ======================================================================

/**
 * t検定結果の可視化を表示
 * @param {Object[]} testResults - 検定結果配列
 * @param {string} testType - 検定タイプ ('independent'|'paired'|'one-sample')
 */
export function displayVisualization(testResults, testType) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <div id="visualization-controls-container"></div>
            <div id="plots-container"></div>
        </div>
    `;

    const controlsContainer = document.getElementById('visualization-controls-container');
    const { titleControl } = createVisualizationControls(controlsContainer);

    const plotsContainer = document.getElementById('plots-container');
    plotsContainer.innerHTML = '';

    testResults.forEach((result, index) => {
        const plotId = `plot-${index}`;
        const plotDiv = document.createElement('div');
        plotDiv.id = plotId;
        plotDiv.className = 'plot-container';
        plotsContainer.appendChild(plotDiv);

        let data, layout, config, title;

        if (testType === 'independent' || testType === 'paired') {
            const groupNames = result.groups;
            const meanValues = [result.mean1, result.mean2];
            const stdValues = [result.std1, result.std2];
            const nValues = [result.n1, result.n2];
            const errorValues = [stdValues[0] / Math.sqrt(nValues[0]), stdValues[1] / Math.sqrt(nValues[1])];

            data = [{
                x: groupNames,
                y: meanValues,
                error_y: { type: 'data', array: errorValues, visible: true },
                type: 'bar',
                marker: { color: ['#11b981', '#f59e0b'] }
            }];

            title = titleControl.checked ? `平均値の比較: ${result.varName}` : '';

            const annotations = [];
            const shapes = [];

            const pairs = [{
                g1: groupNames[0],
                g2: groupNames[1],
                significance: result.significance,
                p: result.p_value
            }];

            const yMax = Math.max(...meanValues.map((m, i) => m + errorValues[i]));
            const yMin = 0;
            const yRange = yMax - yMin;

            let xAxisTitle = '';
            let yAxisTitle = 'Mean';

            if (testType === 'independent') {
                xAxisTitle = result.groupVar || 'Groups';
                yAxisTitle = result.varName;
            } else if (testType === 'paired') {
                xAxisTitle = '条件';
                yAxisTitle = '平均値';
            } else {
                xAxisTitle = result.varName;
            }

            layout = {
                title: getBottomTitleAnnotation(title),
                xaxis: { title: xAxisTitle },
                yaxis: { title: yAxisTitle },
                shapes: shapes,
                annotations: annotations,
                margin: { t: 60, b: 80, l: 60, r: 20 }
            };

            addSignificanceBrackets(layout, pairs, groupNames, yMax, yRange);
            config = createPlotlyConfig('t-test_bar', result.varName);

        } else if (testType === 'one-sample') {
            // 1サンプルt検定の可視化
            data = [{
                x: [result.varName],
                y: [result.mean1],
                error_y: { type: 'data', array: [result.std1 / Math.sqrt(result.n1)], visible: true },
                type: 'bar',
                marker: { color: '#1e90ff' },
                name: 'サンプル平均'
            }, {
                x: [result.varName],
                y: [result.mu],
                type: 'scatter',
                mode: 'lines',
                line: { color: '#e41a1c', dash: 'dash', width: 2 },
                name: `検定値 (μ=${result.mu})`
            }];

            title = titleControl.checked ? `1サンプルt検定: ${result.varName}` : '';

            layout = {
                title: getBottomTitleAnnotation(title),
                xaxis: { title: result.varName },
                yaxis: { title: 'Value' },
                showlegend: true,
                margin: { t: 60, b: 80, l: 60, r: 20 }
            };

            config = createPlotlyConfig('t-test_one-sample', result.varName);
        }

        if (data && layout && config) {
            Plotly.newPlot(plotId, data, layout, config);
        }
    });

    const updateAllPlots = () => {
        testResults.forEach((result, index) => {
            const plotId = `plot-${index}`;
            const title = titleControl.checked ? `平均値の比較: ${result.varName}` : '';
            Plotly.relayout(plotId, { title: getBottomTitleAnnotation(title) });
        });
    };

    titleControl.addEventListener('change', updateAllPlots);
}
