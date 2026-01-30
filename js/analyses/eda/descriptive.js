/**
 * @fileoverview 探索的データ分析（EDA）の記述統計モジュール
 * 歪度、尖度、要約統計量の計算・表示を担当
 * @module eda/descriptive
 */

// ======================================================================
// 統計量計算関数
// ======================================================================

/**
 * 歪度（Skewness）を計算する
 * サンプル歪度を使用（Fisher's skewness）
 * @param {number[]} data - 数値データ配列
 * @returns {number} 歪度の値（正: 右に裾が長い、負: 左に裾が長い）
 * @example
 * const skew = calculateSkewness([1, 2, 3, 4, 10]);
 * console.log(skew); // 正の値（右に裾が長い分布）
 */
export function calculateSkewness(data) {
    const n = data.length;
    const mean = jStat.mean(data);
    const stdev = jStat.stdev(data, true); // sample standard deviation

    if (stdev === 0) return 0;

    const sumCubed = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sumCubed;
}

/**
 * 尖度（Kurtosis）を計算する
 * 過剰尖度（Excess Kurtosis）を返す（正規分布 = 0）
 * @param {number[]} data - 数値データ配列
 * @returns {number} 尖度の値（正: 尖った分布、負: 平らな分布）
 * @example
 * const kurt = calculateKurtosis([1, 2, 3, 4, 5]);
 * console.log(kurt); // 正規分布に近い場合は0に近い値
 */
export function calculateKurtosis(data) {
    const n = data.length;
    const mean = jStat.mean(data);
    const stdev = jStat.stdev(data, true);

    if (stdev === 0) return 0;

    const sumFourth = data.reduce((sum, x) => sum + Math.pow((x - mean) / stdev, 4), 0);
    const kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumFourth;
    const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    return kurtosis - correction; // excess kurtosis
}

// ======================================================================
// 要約統計量表示関数
// ======================================================================

/**
 * 要約統計量を計算し表示する
 * 数値変数とカテゴリ変数それぞれに適した統計量を計算
 * @param {Object[]} currentData - 分析対象データ配列
 * @param {Object} characteristics - データ特性（numericColumns, categoricalColumnsを含む）
 */
export function displaySummaryStatistics(currentData, characteristics) {
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
    const { numericColumns, categoricalColumns } = characteristics;

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
