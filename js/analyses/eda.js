import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview } from '../utils.js';

// 歪度（Skewness）の計算
function calculateSkewness(data) {
    const n = data.length;
    const mean = jStat.mean(data);
    const stdev = jStat.stdev(data, true); // sample standard deviation

    if (stdev === 0) return 0;

    const sumCubed = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sumCubed;
}

// 尖度（Kurtosis）の計算（Excess Kurtosis）
function calculateKurtosis(data) {
    const n = data.length;
    const mean = jStat.mean(data);
    const stdev = jStat.stdev(data, true);

    if (stdev === 0) return 0;

    const sumFourth = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdev, 4), 0);
    const kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumFourth;
    const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return kurtosis - correction; // excess kurtosis
}

// 要約統計量の表示
function displaySummaryStatistics() {
    const resultsContainer = document.getElementById('eda-summary-stats');
    resultsContainer.innerHTML = `
        <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                <i class="fas fa-chart-line"></i> 要約統計量
            </h3>
        </div>
        <div id="eda-summary-content"></div>
    `;

    const contentContainer = document.getElementById('eda-summary-content');
    const { numericColumns, categoricalColumns } = dataCharacteristics;

    // 数値変数の統計量
    if (numericColumns.length > 0) {
        let tableHtml = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-hashtag"></i> 数値変数の統計量
                </h4>
                <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数名</th>
                            <th>サンプルサイズ</th>
                            <th>平均値</th>
                            <th>中央値</th>
                            <th>標準偏差</th>
                            <th>最小値</th>
                            <th>Q1</th>
                            <th>Q3</th>
                            <th>最大値</th>
                            <th>歪度</th>
                            <th>尖度</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        numericColumns.forEach(col => {
            const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
            if (dataVector.length > 0) {
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

                tableHtml += `
                    <tr>
                        <td style="font-weight: bold; color: #1e90ff;">${col}</td>
                        <td>${stats.count}</td>
                        <td>${stats.mean.toFixed(4)}</td>
                        <td>${stats.median.toFixed(4)}</td>
                        <td>${stats.stdev.toFixed(4)}</td>
                        <td>${stats.min.toFixed(4)}</td>
                        <td>${stats.q1.toFixed(4)}</td>
                        <td>${stats.q3.toFixed(4)}</td>
                        <td>${stats.max.toFixed(4)}</td>
                        <td>${stats.skewness.toFixed(4)}</td>
                        <td>${stats.kurtosis.toFixed(4)}</td>
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
        contentContainer.innerHTML += tableHtml;
    }

    // カテゴリ変数の統計量
    if (categoricalColumns.length > 0) {
        let tableHtml = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-tag"></i> カテゴリ変数の統計量
                </h4>
                <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数名</th>
                            <th>サンプルサイズ</th>
                            <th>ユニーク数</th>
                            <th>最頻値</th>
                            <th>最頻値の度数</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        categoricalColumns.forEach(col => {
            const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined);
            if (dataVector.length > 0) {
                const valueCounts = dataVector.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {});

                const uniqueCount = Object.keys(valueCounts).length;
                const maxCount = Math.max(...Object.values(valueCounts));
                const mode = Object.keys(valueCounts).find(key => valueCounts[key] === maxCount);

                tableHtml += `
                    <tr>
                        <td style="font-weight: bold; color: #1e90ff;">${col}</td>
                        <td>${dataVector.length}</td>
                        <td>${uniqueCount}</td>
                        <td>${mode}</td>
                        <td>${maxCount}</td>
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
        contentContainer.innerHTML += tableHtml;
    }
}

// カテゴリ変数の可視化
function visualizeCategoricalVariables() {
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
    const { categoricalColumns } = dataCharacteristics;

    categoricalColumns.forEach((col, index) => {
        const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined);
        const valueCounts = dataVector.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        // 並び替えオプションのセレクトボックスを追加
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

        // 初期表示（度数順）
        renderCategoricalPlot(col, valueCounts, plotId, 'frequency');
    });

    // イベントリスナーを追加
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

// カテゴリ変数のプロット描画
function renderCategoricalPlot(col, valueCounts, plotId, sortOrder) {
    let labels = Object.keys(valueCounts);
    let values = Object.values(valueCounts);

    // 並び替え
    if (sortOrder === 'name') {
        // 名前順にソート
        const sorted = labels.map((label, i) => ({ label, value: values[i] }))
            .sort((a, b) => a.label.localeCompare(b.label));
        labels = sorted.map(item => item.label);
        values = sorted.map(item => item.value);
    } else {
        // 度数順にソート（降順）
        const sorted = labels.map((label, i) => ({ label, value: values[i] }))
            .sort((a, b) => b.value - a.value);
        labels = sorted.map(item => item.label);
        values = sorted.map(item => item.value);
    }

    const barTrace = {
        x: labels,
        y: values,
        type: 'bar',
        marker: { color: 'rgba(30, 144, 255, 0.7)' }
    };

    const barLayout = {
        title: `【${col}】の度数分布（${sortOrder === 'frequency' ? '度数順' : '名前順'}）`,
        xaxis: { title: col },
        yaxis: { title: '度数' },
        bargap: 0.2
    };

    Plotly.newPlot(plotId, [barTrace], barLayout);
}

// 数値変数の個別可視化（ヒストグラム＋箱ひげ図）
function visualizeNumericVariables() {
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
    const { numericColumns } = dataCharacteristics;

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

        // ヒストグラム
        const histTrace = {
            x: dataVector,
            type: 'histogram',
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const histLayout = {
            title: `【${col}】のヒストグラム`,
            xaxis: { title: col },
            yaxis: { title: '度数' },
            bargap: 0.2
        };
        Plotly.newPlot(histId, [histTrace], histLayout);

        // 箱ひげ図
        const boxTrace = {
            y: dataVector,
            type: 'box',
            name: col,
            marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const boxLayout = {
            title: `【${col}】の箱ひげ図`,
            yaxis: { title: col }
        };
        Plotly.newPlot(boxId, [boxTrace], boxLayout);
    });
}

// 複数の数値変数の一括箱ひげ図（自動表示）
function visualizeMultipleNumericVariables() {
    const container = document.getElementById('multiple-numeric-viz-section');
    const { numericColumns } = dataCharacteristics;

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

    // 自動的に全ての数値変数の箱ひげ図を表示
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

    const layout = {
        title: '全数値変数の箱ひげ図による比較',
        yaxis: { title: '値' },
        showlegend: true,
        height: 500
    };

    Plotly.newPlot('multiple-numeric-plot', traces, layout);
}

// 2変数の可視化
function visualizeTwoVariables() {
    const container = document.getElementById('two-variables-viz-section');
    const { numericColumns, categoricalColumns } = dataCharacteristics;
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
            // 数値×数値：散布図と相関係数
            plotNumericVsNumeric(var1, var2, resultContainer);
        } else if (!isVar1Numeric && !isVar2Numeric) {
            // カテゴリ×カテゴリ：クロス集計のヒートマップ
            plotCategoricalVsCategorical(var1, var2, resultContainer);
        } else {
            // カテゴリ×数値：箱ひげ図
            const catVar = isVar1Numeric ? var2 : var1;
            const numVar = isVar1Numeric ? var1 : var2;
            plotCategoricalVsNumeric(catVar, numVar, resultContainer);
        }
    });
}

// 数値×数値の可視化
function plotNumericVsNumeric(var1, var2, container) {
    const pairs = currentData
        .map(row => ({ x: row[var1], y: row[var2] }))
        .filter(pair => pair.x !== null && pair.x !== undefined && !isNaN(pair.x) &&
            pair.y !== null && pair.y !== undefined && !isNaN(pair.y));

    const x = pairs.map(p => p.x);
    const y = pairs.map(p => p.y);

    // 相関係数の計算
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
            color: 'rgba(30, 144, 255, 0.6)',
            size: 8
        }
    };

    const layout = {
        title: `散布図：【${var1}】×【${var2}】`,
        xaxis: { title: var1 },
        yaxis: { title: var2 }
    };

    Plotly.newPlot(plotId, [trace], layout);
}

// カテゴリ×カテゴリの可視化
function plotCategoricalVsCategorical(var1, var2, container) {
    // クロス集計の作成
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

    // ヒートマップ用のデータ作成
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
        colorscale: 'Blues',
        showscale: true
    };

    const layout = {
        title: `度数：【${var1}】×【${var2}】`,
        xaxis: { title: var2 },
        yaxis: { title: var1 }
    };

    Plotly.newPlot(plotId, [trace], layout);
}

// カテゴリ×数値の可視化
function plotCategoricalVsNumeric(catVar, numVar, container) {
    // カテゴリごとのデータを集める
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

    const layout = {
        title: `箱ひげ図：【${catVar}】×【${numVar}】`,
        xaxis: { title: catVar },
        yaxis: { title: numVar }
    };

    Plotly.newPlot(plotId, traces, layout);
}

// 2つのカテゴリ変数と1つの数値変数による棒グラフ
function visualizeGroupedBarChart() {
    const container = document.getElementById('grouped-bar-viz-section');
    const { numericColumns, categoricalColumns } = dataCharacteristics;

    if (categoricalColumns.length < 2 || numericColumns.length < 1) {
        container.innerHTML = '<p style="color: #718096; font-style: italic;">2つ以上のカテゴリ変数と1つ以上の数値変数が必要です。</p>';
        return;
    }

    const catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    const numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div class="control-group" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                <label for="grouped-cat-1" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                    <i class="fas fa-tag" style="color: #1e90ff;"></i> カテゴリ変数1を選択:
                </label>
                <select id="grouped-cat-1" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; font-weight: 500;">${catOptions}</select>
            </div>
            <div class="control-group" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                <label for="grouped-cat-2" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                    <i class="fas fa-tag" style="color: #1e90ff;"></i> カテゴリ変数2を選択:
                </label>
                <select id="grouped-cat-2" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; font-weight: 500;">${catOptions.replace(`value="${categoricalColumns[0]}"`, `value="${categoricalColumns[Math.min(1, categoricalColumns.length - 1)]}" selected`)}</select>
            </div>
            <div class="control-group" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                <label for="grouped-num" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                    <i class="fas fa-hashtag" style="color: #1e90ff;"></i> 数値変数を選択:
                </label>
                <select id="grouped-num" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; font-weight: 500;">${numOptions}</select>
            </div>
            <button id="plot-grouped-bar-btn" class="btn-analysis" style="width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 棒グラフを表示
            </button>
            <div id="grouped-bar-result" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    document.getElementById('plot-grouped-bar-btn').addEventListener('click', () => {
        const cat1 = document.getElementById('grouped-cat-1').value;
        const cat2 = document.getElementById('grouped-cat-2').value;
        const numVar = document.getElementById('grouped-num').value;

        if (cat1 === cat2) {
            alert('異なるカテゴリ変数を選択してください');
            return;
        }

        plotGroupedBarChart(cat1, cat2, numVar);
    });
}

// グループ化された棒グラフの描画
function plotGroupedBarChart(cat1, cat2, numVar) {
    const resultContainer = document.getElementById('grouped-bar-result');

    // データの集計
    const groupedData = {};
    currentData.forEach(row => {
        const c1 = row[cat1];
        const c2 = row[cat2];
        const num = row[numVar];

        if (c1 !== null && c1 !== undefined && c2 !== null && c2 !== undefined &&
            num !== null && num !== undefined && !isNaN(num)) {
            const key = `${c1}|${c2}`;
            if (!groupedData[key]) {
                groupedData[key] = { cat1: c1, cat2: c2, values: [] };
            }
            groupedData[key].values.push(num);
        }
    });

    // 平均値を計算
    const aggregated = Object.values(groupedData).map(item => ({
        cat1: item.cat1,
        cat2: item.cat2,
        mean: jStat.mean(item.values)
    }));

    // カテゴリ2の値ごとにトレースを作成
    const cat2Values = [...new Set(aggregated.map(item => item.cat2))].sort();

    const traces = cat2Values.map(c2Val => {
        const filteredData = aggregated.filter(item => item.cat2 === c2Val);
        const cat1Values = filteredData.map(item => item.cat1);
        const meanValues = filteredData.map(item => item.mean);

        return {
            x: cat1Values,
            y: meanValues,
            type: 'bar',
            name: c2Val
        };
    });

    const plotId = 'grouped-bar-plot';
    resultContainer.innerHTML = `
        <div style="padding: 1.5rem; background: #fafbfc; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #2d3748; font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;">
                <i class="fas fa-chart-bar" style="color: #1e90ff;"></i> グループ化棒グラフ: <span style="color: #1e90ff;">${cat1}</span> × <span style="color: #1e90ff;">${cat2}</span> × <span style="color: #1e90ff;">${numVar}</span>
            </h5>
            <div id="${plotId}" class="plot-container"></div>
        </div>
    `;

    const layout = {
        title: `【${cat1}】と【${cat2}】による【${numVar}】の比較`,
        xaxis: { title: cat1 },
        yaxis: { title: `平均: ${numVar}` },
        barmode: 'group'
    };

    Plotly.newPlot(plotId, traces, layout);
}

// タブ切り替え機能
function switchTab(tabName) {
    // 全タブコンテンツを非表示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // 全タブボタンを非アクティブに
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // 選択されたタブを表示
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    // 選択されたタブボタンをアクティブに
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

export function render(container, characteristics) {
    container.innerHTML = `
        <div class="eda-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-search"></i> 探索的データ分析 (EDA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">データの分布や変数の関係を探索的に分析します</p>
            </div>

            <!-- データプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="eda-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 要約統計量セクション -->
            <div id="eda-summary-stats" class="eda-section" style="margin-bottom: 2rem;"></div>

            <!-- タブナビゲーション -->
            <div class="tab-navigation" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 3px solid #e2e8f0;">
                <button class="tab-button active" data-tab="general-eda" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: bold; background: #1e90ff; color: white; border: none; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.3s;">
                    <i class="fas fa-chart-line"></i> 基本統計・分布
                </button>
                <button class="tab-button" data-tab="bulk-boxplot" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: bold; background: #e2e8f0; color: #4a5568; border: none; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.3s;">
                    <i class="fas fa-layer-group"></i> 数値変数の比較
                </button>
                <button class="tab-button" data-tab="two-vars" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: bold; background: #e2e8f0; color: #4a5568; border: none; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.3s;">
                    <i class="fas fa-project-diagram"></i> ２変数の関係
                </button>
                <button class="tab-button" data-tab="three-vars" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: bold; background: #e2e8f0; color: #4a5568; border: none; cursor: pointer; border-radius: 8px 8px 0 0; transition: all 0.3s;">
                    <i class="fas fa-cubes"></i> ３変数の関係
                </button>
            </div>

            <!-- タブ1: 一般EDA -->
            <div id="tab-general-eda" class="tab-content" style="display: block;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-chart-line"></i> 基本統計・分布
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">各変数の個別分析を行います</p>
                </div>
                <div id="categorical-viz-section" class="eda-section" style="margin-bottom: 2rem;"></div>
                <div id="numeric-viz-section" class="eda-section" style="margin-bottom: 2rem;"></div>
            </div>

            <!-- タブ2: 一括箱ひげ図 -->
            <div id="tab-bulk-boxplot" class="tab-content" style="display: none;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-layer-group"></i> 数値変数の比較
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">全ての数値変数を一括で比較します</p>
                </div>
                <div id="multiple-numeric-viz-section" class="eda-section"></div>
            </div>

            <!-- タブ3: ２変数 -->
            <div id="tab-two-vars" class="tab-content" style="display: none;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-project-diagram"></i> ２変数の関係
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの変数間の関係性を可視化します</p>
                </div>
                <div id="two-variables-viz-section" class="eda-section"></div>
            </div>

            <!-- タブ4: ３変数 -->
            <div id="tab-three-vars" class="tab-content" style="display: none;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-cubes"></i> ３変数の関係
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3つの変数間の関係性を可視化します</p>
                </div>
                <div id="grouped-bar-viz-section" class="eda-section"></div>
            </div>
        </div>
    `;

    // タブボタンのイベントリスナーを設定
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });

    // タブボタンのホバー効果を設定
    const style = document.createElement('style');
    style.textContent = `
        .tab-button:not(.active):hover {
            background: #cbd5e0 !important;
        }
        .tab-button.active {
            background: #1e90ff !important;
            color: white !important;
        }
    `;
    document.head.appendChild(style);

    // 共通のデータプレビューと要約統計量を表示（折りたたみ可能）
    renderDataOverview('#eda-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 各セクションをレンダリング
    displaySummaryStatistics();
    visualizeCategoricalVariables();
    visualizeNumericVariables();
    visualizeMultipleNumericVariables();
    visualizeTwoVariables();
    visualizeGroupedBarChart();
}
