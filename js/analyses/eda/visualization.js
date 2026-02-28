/**
 * @fileoverview 探索的データ分析（EDA）の可視化モジュール
 * 各種プロット（棒グラフ、ヒストグラム、箱ひげ図、散布図等）を担当
 * @module eda/visualization
 */

import { createPlotlyConfig, getTategakiAnnotation, getBottomTitleAnnotation, getAcademicLayout, academicColors } from '../../utils.js';
import { calculateSkewness, calculateKurtosis } from './descriptive.js';

// ======================================================================
// カテゴリ変数の可視化
// ======================================================================

/**
 * カテゴリ変数の可視化（棒グラフ）
 * @param {Object[]} currentData - データ配列
 * @param {Object} characteristics - データ特性
 */
export function visualizeCategoricalVariables(currentData, characteristics) {
    const container = document.getElementById('categorical-viz-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1.5rem; font-size: 1.3rem; font-weight: bold; border-bottom: 3px solid #1e90ff; padding-bottom: 0.5rem;">
                <i class="fas fa-tags"></i> カテゴリ変数の可視化
            </h4>
            <div id="categorical-plots-container"></div>
        </div>
    `;

    const plotsContainer = document.getElementById('categorical-plots-container');
    const { categoricalColumns } = characteristics;

    categoricalColumns.forEach((col, index) => {
        const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined);
        const valueCounts = dataVector.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        const selectId = `sort-select-${index}`;
        const plotId = `cat-plot-${index}`;

        plotsContainer.innerHTML += `
            <div class="categorical-viz-section" style="margin-bottom: 2.5rem; padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                    <i class="fas fa-chart-bar" style="color: #1e90ff;"></i> 変数名: <span style="color: #1e90ff;">${col}</span>
                </h5>
                <div class="control-group" style="margin-bottom: 1rem;">
                    <label for="${selectId}" style="font-weight: 500; margin-right: 0.5rem;">並び替え順:</label>
                    <select id="${selectId}" class="sort-select" data-column="${col}" data-plot-id="${plotId}" style="padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 4px;">
                        <option value="frequency">度数</option>
                        <option value="name">名前順</option>
                    </select>
                </div>
                <div id="${plotId}" class="plot-container"></div>
            </div>
        `;

        renderCategoricalPlot(col, valueCounts, plotId, 'frequency');
    });

    plotsContainer.querySelectorAll('.sort-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const col = e.target.dataset.column;
            const plotId = e.target.dataset.plotId;
            const sortOrder = e.target.value;

            const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined);
            const valueCounts = dataVector.reduce((acc, val) => {
                acc[val] = (acc[val] || 0) + 1;
                return acc;
            }, {});

            renderCategoricalPlot(col, valueCounts, plotId, sortOrder);
        });
    });
}

/**
 * カテゴリ変数のプロット描画
 * @param {string} col - 変数名
 * @param {Object} valueCounts - 値と度数のマップ
 * @param {string} plotId - プロットのDOMID
 * @param {string} sortOrder - 並び替え順（'frequency' | 'name'）
 */
export function renderCategoricalPlot(col, valueCounts, plotId, sortOrder) {
    let labels = Object.keys(valueCounts);
    let values = Object.values(valueCounts);

    if (sortOrder === 'name') {
        const sorted = labels.map((label, i) => ({ label, value: values[i] }))
            .sort((a, b) => a.label.localeCompare(b.label));
        labels = sorted.map(item => item.label);
        values = sorted.map(item => item.value);
    } else {
        const sorted = labels.map((label, i) => ({ label, value: values[i] }))
            .sort((a, b) => b.value - a.value);
        labels = sorted.map(item => item.label);
        values = sorted.map(item => item.value);
    }

    const barTrace = {
        x: labels,
        y: values,
        type: 'bar',
        marker: { color: academicColors.barFill, line: { color: academicColors.barLine, width: 1 } }
    };

    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    const graphTitleText = `【${col}】の度数分布（${sortOrder === 'frequency' ? '度数順' : '名前順'}）`;

    const barLayout = getAcademicLayout({
        title: '',
        xaxis: { title: col },
        yaxis: { title: '' },
        bargap: 0.2,
        annotations: [],
        margin: { l: 100, b: 100 }
    });

    if (showAxisLabels) {
        const tategakiTitle = getTategakiAnnotation('度数');
        if (tategakiTitle) barLayout.annotations.push(tategakiTitle);
    } else {
        barLayout.xaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation(graphTitleText);
        if (bottomTitle) barLayout.annotations.push(bottomTitle);
    }

    Plotly.newPlot(plotId, [barTrace], barLayout);
}

// ======================================================================
// 数値変数の可視化
// ======================================================================

/**
 * 数値変数の可視化（ヒストグラム・箱ひげ図）
 * @param {Object[]} currentData - データ配列
 * @param {Object} characteristics - データ特性
 */
export function visualizeNumericVariables(currentData, characteristics) {
    const container = document.getElementById('numeric-viz-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1.5rem; font-size: 1.3rem; font-weight: bold; border-bottom: 3px solid #1e90ff; padding-bottom: 0.5rem;">
                <i class="fas fa-chart-area"></i> 数値変数の個別可視化
            </h4>
            <div id="numeric-plots-container"></div>
        </div>
    `;

    const plotsContainer = document.getElementById('numeric-plots-container');
    const { numericColumns } = characteristics;

    numericColumns.forEach((col, index) => {
        const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined && !isNaN(v));

        if (dataVector.length === 0) return;

        const jstat = jStat(dataVector);
        const stats = {
            count: dataVector.length,
            mean: jstat.mean(),
            median: jstat.median(),
            stdev: jstat.stdev(),
            min: jstat.min(),
            max: jstat.max(),
            q1: jstat.quartiles()[0],
            q3: jstat.quartiles()[2],
            skewness: calculateSkewness(dataVector),
            kurtosis: calculateKurtosis(dataVector)
        };

        const histId = `num-hist-${index}`;
        const boxId = `num-box-${index}`;

        plotsContainer.innerHTML += `
            <div class="numeric-viz-section" style="margin-bottom: 2.5rem; padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                    <i class="fas fa-chart-line" style="color: #1e90ff;"></i> 変数名: <span style="color: #1e90ff;">${col}</span>
                </h5>
                <div class="stats-summary" style="margin-bottom: 1rem; padding: 1rem; background: #e6f0ff; border-radius: 8px; border: 1px solid #1e90ff;">
                    <p style="margin: 0; color: #2d3748; line-height: 1.6;">
                        <strong style="color: #1e90ff;">統計量:</strong><br>
                        平均: <strong>${stats.mean.toFixed(4)}</strong>,
                        中央値: <strong>${stats.median.toFixed(4)}</strong>,
                        標準偏差: <strong>${stats.stdev.toFixed(4)}</strong><br>
                        歪度: <strong>${stats.skewness.toFixed(4)}</strong>,
                        尖度: <strong>${stats.kurtosis.toFixed(4)}</strong>
                    </p>
                </div>
                <div id="${histId}" class="plot-container" style="margin-bottom: 1rem;"></div>
                <div id="${boxId}" class="plot-container"></div>
            </div>
        `;

        const axisControl = document.getElementById('show-axis-labels');
        const titleControl = document.getElementById('show-graph-title');
        const showAxisLabels = axisControl?.checked ?? true;
        const showGraphTitle = titleControl?.checked ?? true;

        // ヒストグラム
        const histTrace = {
            x: dataVector,
            type: 'histogram',
            marker: { color: academicColors.barFill, line: { color: academicColors.barLine, width: 1 } }
        };

        const histGraphTitle = `【${col}】のヒストグラム`;
        const histLayout = getAcademicLayout({
            title: '',
            xaxis: { title: col },
            yaxis: { title: '' },
            bargap: 0.2,
            annotations: [],
            margin: { l: 100, b: 100 }
        });

        if (showAxisLabels) {
            const tategakiTitle = getTategakiAnnotation('度数');
            if (tategakiTitle) histLayout.annotations.push(tategakiTitle);
        } else {
            histLayout.xaxis.title = '';
        }

        if (showGraphTitle) {
            const bottomTitle = getBottomTitleAnnotation(histGraphTitle);
            if (bottomTitle) histLayout.annotations.push(bottomTitle);
        }

        Plotly.newPlot(histId, [histTrace], histLayout, createPlotlyConfig('EDA_ヒストグラム', col));

        // 箱ひげ図
        const boxTrace = {
            y: dataVector,
            type: 'box',
            name: col,
            marker: { color: academicColors.boxLine },
            fillcolor: academicColors.boxFill,
            line: { color: academicColors.boxLine }
        };
        const boxGraphTitle = `【${col}】の箱ひげ図`;
        const boxLayout = getAcademicLayout({
            title: '',
            yaxis: { title: col },
            margin: { b: 100 },
            annotations: []
        });

        if (!showAxisLabels) {
            if (boxLayout.yaxis) boxLayout.yaxis.title = '';
        }

        if (showGraphTitle) {
            const bottomTitle = getBottomTitleAnnotation(boxGraphTitle);
            if (bottomTitle) boxLayout.annotations.push(bottomTitle);
        }

        Plotly.newPlot(boxId, [boxTrace], boxLayout, createPlotlyConfig('EDA_箱ひげ図', col));
    });
}

/**
 * 複数数値変数の比較（箱ひげ図）
 * @param {Object[]} currentData - データ配列
 * @param {Object} characteristics - データ特性
 */
export function visualizeMultipleNumericVariables(currentData, characteristics) {
    const container = document.getElementById('multiple-numeric-viz-section');
    const { numericColumns } = characteristics;

    if (numericColumns.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1.5rem; font-size: 1.3rem; font-weight: bold; border-bottom: 3px solid #1e90ff; padding-bottom: 0.5rem;">
                <i class="fas fa-layer-group"></i> 数値変数の一括箱ひげ図
            </h4>
            <div id="multiple-numeric-plot" class="plot-container"></div>
        </div>
    `;

    const traces = numericColumns.map(col => {
        const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
        return {
            y: dataVector,
            type: 'box',
            name: col,
            boxpoints: 'outliers',
            jitter: 0.3,
            pointpos: -1.8
        };
    });

    const graphTitleText = '全数値変数の箱ひげ図による比較';
    const layout = getAcademicLayout({
        title: '',
        yaxis: { title: '値' },
        showlegend: true,
        height: 500,
        annotations: [],
        margin: { b: 100 }
    });

    const showAxisLabels = document.getElementById('show-axis-labels')?.checked ?? true;
    const showGraphTitle = document.getElementById('show-graph-title')?.checked ?? true;

    if (!showAxisLabels) {
        if (layout.yaxis) layout.yaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation(graphTitleText);
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('multiple-numeric-plot', traces, layout, createPlotlyConfig('EDA_数値変数一括', numericColumns));
}

// ======================================================================
// 2変数間の関係可視化
// ======================================================================

/**
 * 2変数間の関係を可視化するUIを構築
 * @param {Object[]} currentData - データ配列
 * @param {Object} characteristics - データ特性
 */
export function visualizeTwoVariables(currentData, characteristics) {
    const container = document.getElementById('two-variables-viz-section');
    const { numericColumns, categoricalColumns } = characteristics;
    const allColumns = [...numericColumns, ...categoricalColumns];

    if (allColumns.length < 2) {
        container.innerHTML = '<p style="color: #718096; font-style: italic;">2つ以上の変数が必要です。</p>';
        return;
    }

    const options = allColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div class="control-group" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                <label for="two-var-1" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                    <i class="fas fa-circle" style="color: #1e90ff;"></i> 変数1を選択:
                </label>
                <select id="two-var-1" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; font-weight: 500;">${options}</select>
            </div>
            <div class="control-group" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                <label for="two-var-2" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                    <i class="fas fa-circle" style="color: #1e90ff;"></i> 変数2を選択:
                </label>
                <select id="two-var-2" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; font-weight: 500;">${options.replace(`value="${allColumns[0]}"`, `value="${allColumns[Math.min(1, allColumns.length - 1)]}" selected`)}</select>
            </div>
            <button id="plot-two-vars-btn" class="btn-analysis" style="width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                <i class="fas fa-chart-scatter"></i> 可視化を実行
            </button>
            <div id="two-vars-result" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    document.getElementById('plot-two-vars-btn').addEventListener('click', () => {
        const var1 = document.getElementById('two-var-1').value;
        const var2 = document.getElementById('two-var-2').value;

        if (var1 === var2) {
            alert('異なる変数を選択してください');
            return;
        }

        const resultContainer = document.getElementById('two-vars-result');
        resultContainer.innerHTML = '';

        const isVar1Numeric = numericColumns.includes(var1);
        const isVar2Numeric = numericColumns.includes(var2);

        if (isVar1Numeric && isVar2Numeric) {
            plotNumericVsNumeric(currentData, var1, var2, resultContainer);
        } else if (!isVar1Numeric && !isVar2Numeric) {
            plotCategoricalVsCategorical(currentData, var1, var2, resultContainer);
        } else {
            const catVar = isVar1Numeric ? var2 : var1;
            const numVar = isVar1Numeric ? var1 : var2;
            plotCategoricalVsNumeric(currentData, catVar, numVar, resultContainer);
        }
    });
}

/**
 * 数値×数値の散布図を描画
 * @param {Object[]} currentData - データ配列
 * @param {string} var1 - X軸変数
 * @param {string} var2 - Y軸変数
 * @param {HTMLElement} container - 描画先コンテナ
 */
export function plotNumericVsNumeric(currentData, var1, var2, container) {
    const pairs = currentData
        .map(row => ({ x: row[var1], y: row[var2] }))
        .filter(pair => pair.x !== null && pair.x !== undefined && !isNaN(pair.x) &&
            pair.y !== null && pair.y !== undefined && !isNaN(pair.y));

    const x = pairs.map(p => p.x);
    const y = pairs.map(p => p.y);

    const correlation = jStat.corrcoeff(x, y);

    const plotId = 'two-vars-plot';
    container.innerHTML = `
        <div style="padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                <i class="fas fa-chart-scatter" style="color: #1e90ff;"></i> 散布図: <span style="color: #1e90ff;">${var1}</span> × <span style="color: #1e90ff;">${var2}</span>
            </h5>
            <p style="font-size: 1.2rem; font-weight: bold; color: #1e90ff; background: #e6f0ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <i class="fas fa-link"></i> 相関係数: ${correlation.toFixed(4)}
            </p>
            <div id="${plotId}" class="plot-container"></div>
        </div>
    `;

    const trace = {
        x: x,
        y: y,
        mode: 'markers',
        type: 'scatter',
        marker: {
            color: academicColors.barFill,
            size: 8,
            line: { color: academicColors.barLine, width: 1 }
        }
    };

    const layout = getAcademicLayout({
        title: `散布図：【${var1}】×【${var2}】`,
        xaxis: { title: var1 },
        yaxis: { title: var2 }
    });

    const showAxisLabels = document.getElementById('show-axis-labels')?.checked ?? true;
    if (!showAxisLabels) {
        if (layout.xaxis) layout.xaxis.title = '';
        if (layout.yaxis) layout.yaxis.title = '';
    }

    Plotly.newPlot(plotId, [trace], layout, createPlotlyConfig('EDA_散布図', [var1, var2]));
}

/**
 * カテゴリ×カテゴリのヒートマップを描画
 * @param {Object[]} currentData - データ配列
 * @param {string} var1 - 行変数
 * @param {string} var2 - 列変数
 * @param {HTMLElement} container - 描画先コンテナ
 */
export function plotCategoricalVsCategorical(currentData, var1, var2, container) {
    const crossTab = {};
    const var1Values = new Set();
    const var2Values = new Set();

    currentData.forEach(row => {
        const v1 = row[var1];
        const v2 = row[var2];
        if (v1 !== null && v1 !== undefined && v2 !== null && v2 !== undefined) {
            var1Values.add(v1);
            var2Values.add(v2);

            if (!crossTab[v1]) crossTab[v1] = {};
            crossTab[v1][v2] = (crossTab[v1][v2] || 0) + 1;
        }
    });

    const var1Array = Array.from(var1Values).sort();
    const var2Array = Array.from(var2Values).sort();

    const zData = var1Array.map(v1 =>
        var2Array.map(v2 => crossTab[v1]?.[v2] || 0)
    );

    const plotId = 'two-vars-plot';
    container.innerHTML = `
        <div style="padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                <i class="fas fa-th" style="color: #1e90ff;"></i> クロス集計: <span style="color: #1e90ff;">${var1}</span> × <span style="color: #1e90ff;">${var2}</span>
            </h5>
            <div id="${plotId}" class="plot-container"></div>
        </div>
    `;

    const trace = {
        z: zData,
        x: var2Array,
        y: var1Array,
        type: 'heatmap',
        colorscale: academicColors.heatmapScale,
        showscale: true
    };

    const layout = getAcademicLayout({
        title: `度数：【${var1}】×【${var2}】`,
        xaxis: { title: var2 },
        yaxis: { title: var1 }
    });

    const showAxisLabels = document.getElementById('show-axis-labels')?.checked ?? true;
    if (!showAxisLabels) {
        if (layout.xaxis) layout.xaxis.title = '';
        if (layout.yaxis) layout.yaxis.title = '';
    }

    Plotly.newPlot(plotId, [trace], layout, createPlotlyConfig('EDA_クロス集計', [var1, var2]));
}

/**
 * カテゴリ×数値の箱ひげ図を描画
 * @param {Object[]} currentData - データ配列
 * @param {string} catVar - カテゴリ変数
 * @param {string} numVar - 数値変数
 * @param {HTMLElement} container - 描画先コンテナ
 */
export function plotCategoricalVsNumeric(currentData, catVar, numVar, container) {
    const categoryData = {};

    currentData.forEach(row => {
        const cat = row[catVar];
        const num = row[numVar];
        if (cat !== null && cat !== undefined && num !== null && num !== undefined && !isNaN(num)) {
            if (!categoryData[cat]) categoryData[cat] = [];
            categoryData[cat].push(num);
        }
    });

    const categories = Object.keys(categoryData).sort();
    const traces = categories.map(cat => ({
        y: categoryData[cat],
        type: 'box',
        name: cat,
        boxpoints: 'all',
        jitter: 0.3,
        pointpos: -1.8
    }));

    const plotId = 'two-vars-plot';
    container.innerHTML = `
        <div style="padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                <i class="fas fa-chart-bar" style="color: #1e90ff;"></i> 箱ひげ図: <span style="color: #1e90ff;">${catVar}</span> × <span style="color: #1e90ff;">${numVar}</span>
            </h5>
            <div id="${plotId}" class="plot-container"></div>
        </div>
    `;

    const layout = getAcademicLayout({
        title: `箱ひげ図：【${catVar}】×【${numVar}】`,
        xaxis: { title: catVar },
        yaxis: { title: numVar }
    });

    const showAxisLabels = document.getElementById('show-axis-labels')?.checked ?? true;
    if (!showAxisLabels) {
        if (layout.xaxis) layout.xaxis.title = '';
        if (layout.yaxis) layout.yaxis.title = '';
    }

    Plotly.newPlot(plotId, traces, layout, createPlotlyConfig('EDA_箱ひげ図_層別', [catVar, numVar]));
}

// ======================================================================
// グループ化棒グラフ
// ======================================================================

/**
 * 2つのカテゴリ変数と1つの数値変数による棒グラフUIを構築
 * @param {Object[]} currentData - データ配列
 * @param {Object} characteristics - データ特性
 */
export function visualizeGroupedBarChart(currentData, characteristics) {
    const container = document.getElementById('grouped-bar-viz-section');
    const { numericColumns, categoricalColumns } = characteristics;

    if (categoricalColumns.length < 2 || numericColumns.length < 1) {
        container.innerHTML = '<p style="color: #718096; font-style: italic;">2つ以上のカテゴリ変数と1つ以上の数値変数が必要です。</p>';
        return;
    }

    const catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    const numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1.5rem; font-size: 1.3rem; font-weight: bold; border-bottom: 3px solid #1e90ff; padding-bottom: 0.5rem;">
                <i class="fas fa-chart-bar"></i> グループ化棒グラフ
            </h4>
            <div class="control-group" style="margin-bottom: 1rem;">
                <label style="font-weight: bold;">カテゴリ変数1（X軸）:</label>
                <select id="grouped-cat1">${catOptions}</select>
            </div>
            <div class="control-group" style="margin-bottom: 1rem;">
                <label style="font-weight: bold;">カテゴリ変数2（グループ）:</label>
                <select id="grouped-cat2">${catOptions.replace(`value="${categoricalColumns[0]}"`, `value="${categoricalColumns[Math.min(1, categoricalColumns.length - 1)]}" selected`)}</select>
            </div>
            <div class="control-group" style="margin-bottom: 1rem;">
                <label style="font-weight: bold;">数値変数（Y軸）:</label>
                <select id="grouped-num">${numOptions}</select>
            </div>
            <button id="plot-grouped-btn" class="btn-analysis">グラフ描画</button>
            <div id="grouped-bar-result" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    document.getElementById('plot-grouped-btn').addEventListener('click', () => {
        const cat1 = document.getElementById('grouped-cat1').value;
        const cat2 = document.getElementById('grouped-cat2').value;
        const numVar = document.getElementById('grouped-num').value;

        if (cat1 === cat2) {
            alert('異なるカテゴリ変数を選択してください');
            return;
        }

        plotGroupedBarChart(currentData, cat1, cat2, numVar);
    });
}

/**
 * グループ化された棒グラフを描画
 * @param {Object[]} currentData - データ配列
 * @param {string} cat1 - X軸カテゴリ変数
 * @param {string} cat2 - グループカテゴリ変数
 * @param {string} numVar - Y軸数値変数
 */
export function plotGroupedBarChart(currentData, cat1, cat2, numVar) {
    const groupedData = {};
    const cat1Values = new Set();
    const cat2Values = new Set();

    currentData.forEach(row => {
        const c1 = row[cat1];
        const c2 = row[cat2];
        const num = row[numVar];

        if (c1 != null && c2 != null && num != null && !isNaN(num)) {
            cat1Values.add(c1);
            cat2Values.add(c2);

            const key = `${c1}|${c2}`;
            if (!groupedData[key]) groupedData[key] = [];
            groupedData[key].push(num);
        }
    });

    const cat1Array = Array.from(cat1Values).sort();
    const cat2Array = Array.from(cat2Values).sort();

    const traces = cat2Array.map(c2 => {
        const yValues = cat1Array.map(c1 => {
            const key = `${c1}|${c2}`;
            const values = groupedData[key] || [];
            return values.length > 0 ? jStat.mean(values) : 0;
        });

        return {
            x: cat1Array,
            y: yValues,
            type: 'bar',
            name: c2
        };
    });

    const plotId = 'grouped-bar-plot';
    const resultContainer = document.getElementById('grouped-bar-result');
    resultContainer.innerHTML = `<div id="${plotId}" class="plot-container"></div>`;

    const layout = getAcademicLayout({
        title: `【${numVar}】の平均値: ${cat1} × ${cat2}`,
        xaxis: { title: cat1 },
        yaxis: { title: `${numVar} (平均)` },
        barmode: 'group'
    });

    Plotly.newPlot(plotId, traces, layout, createPlotlyConfig('EDA_グループ化棒グラフ', [cat1, cat2, numVar]));
}
