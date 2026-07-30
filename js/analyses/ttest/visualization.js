/**
 * @fileoverview t検定の可視化モジュール
 * 棒グラフ、エラーバー、有意差ブラケット表示
 * @module ttest/visualization
 */

import {
    createPlotlyConfig,
    createVisualizationControls,
    addSignificanceBrackets,
    getAcademicLayout,
    academicColors,
    createBoxPlotView,
    registerPlotlyViewOptions
} from '../../utils.js';

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

        let data, layout, config, title, viewOptions;

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
                marker: { color: [academicColors.palette[0], academicColors.palette[1]] }
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
            const yMin = Math.min(
                0,
                ...meanValues.map((m, i) => m - errorValues[i])
            );
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

            layout = getAcademicLayout({
                title,
                xaxis: { title: xAxisTitle },
                yaxis: { title: yAxisTitle },
                shapes: shapes,
                annotations: annotations,
                margin: { t: 60, b: 80, l: 60, r: 20 }
            });

            addSignificanceBrackets(
                layout,
                pairs,
                groupNames,
                yMax,
                yRange,
                { yMin }
            );
            config = createPlotlyConfig('t-test_bar', result.varName);

            const boxView = createBoxPlotView(
                groupNames.map((group, groupIndex) => ({
                    name: group,
                    color: academicColors.palette[groupIndex % academicColors.palette.length],
                    groups: [{
                        label: group,
                        values: groupIndex === 0 ? result.group0Values : result.group1Values
                    }]
                })),
                { showLegend: false }
            );
            const boxTitle = titleControl.checked ? `分布の比較: ${result.varName}` : '';
            const boxLayout = getAcademicLayout({
                title: boxTitle,
                xaxis: { title: xAxisTitle },
                yaxis: { title: yAxisTitle },
                boxmode: 'group',
                shapes: [],
                annotations: [],
                margin: { t: 60, b: 80, l: 60, r: 20 }
            });
            const boxMinimum = boxView.minimum ?? 0;
            const boxMaximum = boxView.maximum ?? 0;
            addSignificanceBrackets(
                boxLayout,
                pairs,
                groupNames,
                boxMaximum,
                Math.max(boxMaximum - boxMinimum, 1),
                { yMin: boxMinimum, baselineZero: false }
            );
            const boxConfig = createPlotlyConfig('t-test_box', result.varName);
            viewOptions = {
                defaultView: 'bar',
                views: [
                    {
                        key: 'bar',
                        label: '棒グラフ（平均 ± SE）',
                        data,
                        layout,
                        config,
                        labels: { title, x: xAxisTitle, y: yAxisTitle }
                    },
                    {
                        key: 'box',
                        label: '箱ひげ図（観測値）',
                        data: boxView.traces,
                        layout: boxLayout,
                        config: boxConfig,
                        labels: { title: boxTitle, x: xAxisTitle, y: yAxisTitle }
                    }
                ]
            };

        } else if (testType === 'one-sample') {
            // 1サンプルt検定の可視化
            data = [{
                x: [result.varName],
                y: [result.mean1],
                error_y: { type: 'data', array: [result.std1 / Math.sqrt(result.n1)], visible: true },
                type: 'bar',
                marker: { color: academicColors.primary },
                name: 'サンプル平均'
            }, {
                x: [result.varName],
                y: [result.mu],
                type: 'scatter',
                mode: 'lines',
                line: { color: academicColors.accent, dash: 'dash', width: 2 },
                name: `検定値 (μ=${result.mu})`
            }];

            title = titleControl.checked ? `1サンプルt検定: ${result.varName}` : '';

            layout = getAcademicLayout({
                title,
                xaxis: { title: result.varName },
                yaxis: { title: '値' },
                showlegend: true,
                margin: { t: 60, b: 80, l: 60, r: 20 }
            });

            config = createPlotlyConfig('t-test_one-sample', result.varName);
            const boxView = createBoxPlotView([{
                name: result.varName,
                color: academicColors.primary,
                groups: [{ label: result.varName, values: result.group0Values }]
            }], { showLegend: false });
            const boxTitle = titleControl.checked ? `1サンプルt検定（分布）: ${result.varName}` : '';
            const boxMinimum = Math.min(boxView.minimum ?? result.mu, result.mu);
            const boxMaximum = Math.max(boxView.maximum ?? result.mu, result.mu);
            const boxRange = Math.max(boxMaximum - boxMinimum, Math.abs(boxMaximum) * 0.1, 1);
            const boxRecommendedMaximum = boxMaximum + boxRange * 0.12;
            const boxLayout = getAcademicLayout({
                title: boxTitle,
                xaxis: { title: result.varName },
                yaxis: {
                    title: '値',
                    range: [boxMinimum - boxRange * 0.08, boxRecommendedMaximum]
                },
                showlegend: false,
                boxmode: 'group',
                shapes: [{
                    type: 'line',
                    xref: 'paper',
                    x0: 0,
                    x1: 1,
                    yref: 'y',
                    y0: result.mu,
                    y1: result.mu,
                    line: { color: academicColors.accent, dash: 'dash', width: 2 }
                }],
                annotations: [{
                    xref: 'paper',
                    x: 1,
                    xanchor: 'right',
                    yref: 'y',
                    y: result.mu,
                    yanchor: 'bottom',
                    text: `検定値 μ=${result.mu}`,
                    showarrow: false,
                    font: { color: academicColors.accent, size: 12 }
                }],
                margin: { t: 60, b: 80, l: 60, r: 20 }
            });
            boxLayout._recommendedMaxY = boxRecommendedMaximum;
            const boxConfig = createPlotlyConfig('t-test_one-sample_box', result.varName);
            viewOptions = {
                defaultView: 'bar',
                views: [
                    {
                        key: 'bar',
                        label: '棒グラフ（平均 ± SE）',
                        data,
                        layout,
                        config,
                        labels: {
                            title,
                            x: result.varName,
                            y: '値'
                        }
                    },
                    {
                        key: 'box',
                        label: '箱ひげ図（観測値）',
                        data: boxView.traces,
                        layout: boxLayout,
                        config: boxConfig,
                        labels: {
                            title: boxTitle,
                            x: result.varName,
                            y: '値'
                        }
                    }
                ]
            };
        }

        if (data && layout && config) {
            if (viewOptions) registerPlotlyViewOptions(plotId, viewOptions);
            Plotly.newPlot(plotId, data, layout, config);
        }
    });

    const updateAllPlots = () => {
        testResults.forEach((result, index) => {
            const plotId = `plot-${index}`;
            const title = titleControl.checked
                ? (testType === 'one-sample'
                    ? `1サンプルt検定: ${result.varName}`
                    : `平均値の比較: ${result.varName}`)
                : '';
            Plotly.relayout(plotId, { 'title.text': title });
        });
    };

    titleControl.addEventListener('change', updateAllPlots);
}
