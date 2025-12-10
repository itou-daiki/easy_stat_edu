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
    resultsContainer.innerHTML = '<h4>要約統計量</h4>';

    const { numericColumns, categoricalColumns } = dataCharacteristics;

    // 数値変数の統計量
    if (numericColumns.length > 0) {
        let tableHtml = `
            <h5>数値変数の統計量</h5>
            <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数名</th>
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
                        <td>${col}</td>
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
        `;
        resultsContainer.innerHTML += tableHtml;
    }

    // カテゴリ変数の統計量
    if (categoricalColumns.length > 0) {
        let tableHtml = `
            <h5>カテゴリ変数の統計量</h5>
            <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数名</th>
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
                        <td>${col}</td>
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
        `;
        resultsContainer.innerHTML += tableHtml;
    }
}

// カテゴリ変数の可視化
function visualizeCategoricalVariables() {
    const container = document.getElementById('eda-categorical-viz');
    container.innerHTML = '<h4>カテゴリ変数の可視化</h4>';

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

        container.innerHTML += `
            <div class="categorical-viz-section" style="margin-bottom: 2rem;">
                <h5>【${col}】の可視化</h5>
                <div class="control-group" style="margin-bottom: 1rem;">
                    <label for="${selectId}">並び替え順を選択してください:</label>
                    <select id="${selectId}" class="sort-select" data-column="${col}" data-plot-id="${plotId}">
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
    container.querySelectorAll('.sort-select').forEach(select => {
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
        title: `【${col}】の可視化（${sortOrder === 'frequency' ? '度数' : '名前順'}）`,
        xaxis: { title: col },
        yaxis: { title: '度数' },
        bargap: 0.2
    };

    Plotly.newPlot(plotId, [barTrace], barLayout);
}

// 数値変数の可視化
function visualizeNumericVariables() {
    const container = document.getElementById('eda-numeric-viz');
    container.innerHTML = '<h4>数値変数の可視化</h4>';

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

        container.innerHTML += `
            <div class="numeric-viz-section" style="margin-bottom: 2rem;">
                <h5>【${col}】の可視化</h5>
                <div class="stats-summary" style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                    <p><strong>統計量:</strong>
                        平均: ${stats.mean.toFixed(4)},
                        中央値: ${stats.median.toFixed(4)},
                        標準偏差: ${stats.stdev.toFixed(4)},
                        歪度: ${stats.skewness.toFixed(4)},
                        尖度: ${stats.kurtosis.toFixed(4)}
                    </p>
                </div>
                <div id="${histId}" class="plot-container"></div>
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
            title: `【${col}】の可視化（ヒストグラム）`,
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
            title: `【${col}】の可視化（箱ひげ図）`,
            yaxis: { title: col }
        };
        Plotly.newPlot(boxId, [boxTrace], boxLayout);
    });
}

// 複数の数値変数の箱ひげ図
function visualizeMultipleNumericVariables() {
    const container = document.getElementById('eda-multiple-numeric');
    const { numericColumns } = dataCharacteristics;

    if (numericColumns.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <h4>選択した数値変数の可視化（箱ひげ図）</h4>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label>数値変数を選択してください:</label>
            <div id="numeric-checkboxes" style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
            </div>
        </div>
        <button id="plot-multiple-numeric-btn" class="btn-analysis">箱ひげ図を表示</button>
        <div id="multiple-numeric-plot" class="plot-container"></div>
    `;

    // チェックボックスを追加
    const checkboxContainer = document.getElementById('numeric-checkboxes');
    numericColumns.forEach(col => {
        const checkbox = document.createElement('label');
        checkbox.style.display = 'flex';
        checkbox.style.alignItems = 'center';
        checkbox.style.cursor = 'pointer';
        checkbox.innerHTML = `
            <input type="checkbox" value="${col}" class="numeric-checkbox" checked style="margin-right: 0.5rem;">
            <span>${col}</span>
        `;
        checkboxContainer.appendChild(checkbox);
    });

    // プロットボタンのイベントリスナー
    document.getElementById('plot-multiple-numeric-btn').addEventListener('click', () => {
        const selectedCols = Array.from(document.querySelectorAll('.numeric-checkbox:checked'))
                                  .map(cb => cb.value);

        if (selectedCols.length === 0) {
            alert('少なくとも1つの数値変数を選択してください');
            return;
        }

        const traces = selectedCols.map(col => {
            const dataVector = currentData.map(row => row[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
            return {
                y: dataVector,
                type: 'box',
                name: col,
                boxpoints: 'all',
                jitter: 0.3,
                pointpos: -1.8
            };
        });

        const layout = {
            title: '選択した数値変数の可視化',
            yaxis: { title: '値' },
            showlegend: true
        };

        Plotly.newPlot('multiple-numeric-plot', traces, layout);
    });
}

// 2変数の可視化
function visualizeTwoVariables() {
    const container = document.getElementById('eda-two-variables');
    const { numericColumns, categoricalColumns } = dataCharacteristics;
    const allColumns = [...numericColumns, ...categoricalColumns];

    if (allColumns.length < 2) {
        container.innerHTML = '';
        return;
    }

    const options = allColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <h4>選択した2変数の可視化</h4>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label for="two-var-1">変数1を選択:</label>
            <select id="two-var-1">${options}</select>
        </div>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label for="two-var-2">変数2を選択:</label>
            <select id="two-var-2">${options.replace(`value="${allColumns[0]}"`, `value="${allColumns[Math.min(1, allColumns.length - 1)]}" selected`)}</select>
        </div>
        <button id="plot-two-vars-btn" class="btn-analysis">可視化を実行</button>
        <div id="two-vars-result" style="margin-top: 1rem;"></div>
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
    const data1 = currentData.map(row => row[var1]).filter(v => v !== null && v !== undefined && !isNaN(v));
    const data2 = currentData.map(row => row[var2]).filter(v => v !== null && v !== undefined && !isNaN(v));

    // 対応するデータのみを抽出
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
        <h5>散布図：【${var1}】×【${var2}】</h5>
        <p style="font-size: 1.1rem; font-weight: bold; color: #1e90ff;">相関係数：${correlation.toFixed(4)}</p>
        <div id="${plotId}" class="plot-container"></div>
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
        <h5>度数：【${var1}】×【${var2}】</h5>
        <div id="${plotId}" class="plot-container"></div>
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
        <h5>箱ひげ図：【${catVar}】×【${numVar}】</h5>
        <div id="${plotId}" class="plot-container"></div>
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
    const container = document.getElementById('eda-grouped-bar');
    const { numericColumns, categoricalColumns } = dataCharacteristics;

    if (categoricalColumns.length < 2 || numericColumns.length < 1) {
        container.innerHTML = '';
        return;
    }

    const catOptions = categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    const numOptions = numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <h4>2つのカテゴリ変数と1つの数値変数による棒グラフ</h4>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label for="grouped-cat-1">カテゴリ変数1を選択:</label>
            <select id="grouped-cat-1">${catOptions}</select>
        </div>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label for="grouped-cat-2">カテゴリ変数2を選択:</label>
            <select id="grouped-cat-2">${catOptions.replace(`value="${categoricalColumns[0]}"`, `value="${categoricalColumns[Math.min(1, categoricalColumns.length - 1)]}" selected`)}</select>
        </div>
        <div class="control-group" style="margin-bottom: 1rem;">
            <label for="grouped-num">数値変数を選択:</label>
            <select id="grouped-num">${numOptions}</select>
        </div>
        <button id="plot-grouped-bar-btn" class="btn-analysis">棒グラフを表示</button>
        <div id="grouped-bar-result" style="margin-top: 1rem;"></div>
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
        <h5>【${cat1}】と【${cat2}】による【${numVar}】の比較</h5>
        <div id="${plotId}" class="plot-container"></div>
    `;

    const layout = {
        title: `【${cat1}】と【${cat2}】による【${numVar}】の比較`,
        xaxis: { title: cat1 },
        yaxis: { title: `平均: ${numVar}` },
        barmode: 'group'
    };

    Plotly.newPlot(plotId, traces, layout);
}

export function render(container, characteristics) {
    container.innerHTML = `
        <div class="eda-container">
            <!-- データプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="eda-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div id="eda-summary-stats" class="eda-section"></div>
            <div id="eda-categorical-viz" class="eda-section"></div>
            <div id="eda-numeric-viz" class="eda-section"></div>
            <div id="eda-multiple-numeric" class="eda-section"></div>
            <div id="eda-two-variables" class="eda-section"></div>
            <div id="eda-grouped-bar" class="eda-section"></div>
        </div>
    `;

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
