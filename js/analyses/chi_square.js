import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview } from '../utils.js';

// カイ二乗検定の実行
function runChiSquareTest() {
    const var1 = document.getElementById('var1-select').value;
    const var2 = document.getElementById('var2-select').value;

    if (!var1 || !var2) {
        alert('2つの変数を選択してください');
        return;
    }

    if (var1 === var2) {
        alert('異なる変数を選択してください');
        return;
    }

    // 欠損値を除いたデータ
    const validData = currentData.filter(row => row[var1] != null && row[var2] != null);

    if (validData.length === 0) {
        alert('有効なデータがありません');
        return;
    }

    // カテゴリの抽出
    const var1Categories = [...new Set(validData.map(row => row[var1]))].sort();
    const var2Categories = [...new Set(validData.map(row => row[var2]))].sort();

    // クロス表（観測度数）の作成
    const observed = {};
    var1Categories.forEach(cat1 => {
        observed[cat1] = {};
        var2Categories.forEach(cat2 => {
            observed[cat1][cat2] = 0;
        });
    });

    validData.forEach(row => {
        observed[row[var1]][row[var2]]++;
    });

    // 行・列の合計を計算
    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    var1Categories.forEach(cat1 => {
        rowTotals[cat1] = 0;
        var2Categories.forEach(cat2 => {
            rowTotals[cat1] += observed[cat1][cat2];
        });
        grandTotal += rowTotals[cat1];
    });

    var2Categories.forEach(cat2 => {
        colTotals[cat2] = 0;
        var1Categories.forEach(cat1 => {
            colTotals[cat2] += observed[cat1][cat2];
        });
    });

    // 期待度数の計算
    const expected = {};
    var1Categories.forEach(cat1 => {
        expected[cat1] = {};
        var2Categories.forEach(cat2 => {
            expected[cat1][cat2] = (rowTotals[cat1] * colTotals[cat2]) / grandTotal;
        });
    });

    // カイ二乗値の計算
    const chiSquareValues = {};
    let chiSquareStat = 0;

    var1Categories.forEach(cat1 => {
        chiSquareValues[cat1] = {};
        var2Categories.forEach(cat2 => {
            const obs = observed[cat1][cat2];
            const exp = expected[cat1][cat2];
            const chiVal = ((obs - exp) ** 2) / exp;
            chiSquareValues[cat1][cat2] = chiVal;
            chiSquareStat += chiVal;
        });
    });

    // 自由度
    const df = (var1Categories.length - 1) * (var2Categories.length - 1);

    // p値の計算
    const pValue = 1 - jStat.chisquare.cdf(chiSquareStat, df);

    // 残差の計算（有意差の判定用）
    const residuals = {};
    const threshold = jStat.normal.inv(1 - 0.05 / 2, 0, 1); // z値の閾値（両側検定、α=0.05）

    var1Categories.forEach(cat1 => {
        residuals[cat1] = {};
        var2Categories.forEach(cat2 => {
            const obs = observed[cat1][cat2];
            const exp = expected[cat1][cat2];
            residuals[cat1][cat2] = (obs - exp) / Math.sqrt(exp);
        });
    });

    // 度数分布の棒グラフを表示
    displayFrequencyBarChart(observed, var1, var2, var1Categories, var2Categories);

    // クロス表を表示
    displayCrossTables(observed, expected, chiSquareValues, residuals, threshold, var1, var2, var1Categories, var2Categories, rowTotals, colTotals, grandTotal);

    // 検定結果を表示
    displayTestResults(chiSquareStat, pValue, df, var1, var2);

    // ヒートマップを表示
    displayHeatmap(observed, var1, var2, var1Categories, var2Categories);

    // 結果セクションを表示
    document.getElementById('results-section').style.display = 'block';
}

// 度数分布の棒グラフ
function displayFrequencyBarChart(observed, var1, var2, var1Categories, var2Categories) {
    const container = document.getElementById('frequency-chart-section');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 【${var1}】 と 【${var2}】 の度数分布
            </h4>
            <div id="frequency-chart"></div>
        </div>
    `;

    // Plotlyのデータを準備
    const traces = var1Categories.map(cat1 => ({
        x: var2Categories,
        y: var2Categories.map(cat2 => observed[cat1][cat2]),
        name: cat1,
        type: 'bar'
    }));

    const layout = {
        barmode: 'group',
        xaxis: { title: var2 },
        yaxis: { title: '度数' },
        title: `【${var1}】 と 【${var2}】 の度数分布`,
        showlegend: true
    };

    Plotly.newPlot('frequency-chart', traces, layout);
}

// クロス表の表示
function displayCrossTables(observed, expected, chiSquareValues, residuals, threshold, var1, var2, var1Categories, var2Categories, rowTotals, colTotals, grandTotal) {
    const container = document.getElementById('crosstab-section');

    let html = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> データフレームの表示
            </h4>
    `;

    // 観測度数
    html += `
        <h5 style="color: #2d3748; margin-top: 1.5rem; margin-bottom: 0.75rem;">＜観測度数＞</h5>
        <div class="table-container" style="overflow-x: auto; margin-bottom: 2rem;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">${var1} \\ ${var2}</th>
    `;

    var2Categories.forEach(cat2 => {
        html += `<th style="text-align: center;">${cat2}</th>`;
    });
    html += `<th style="text-align: center; font-weight: bold;">合計</th></tr></thead><tbody>`;

    var1Categories.forEach(cat1 => {
        html += `<tr><td style="font-weight: bold; color: #1e90ff;">${cat1}</td>`;
        var2Categories.forEach(cat2 => {
            const isSignificant = Math.abs(residuals[cat1][cat2]) > threshold;
            const bgColor = isSignificant ? 'background-color: #fef08a;' : '';
            html += `<td style="text-align: center; ${bgColor}">${observed[cat1][cat2]}</td>`;
        });
        html += `<td style="text-align: center; font-weight: bold;">${rowTotals[cat1]}</td></tr>`;
    });

    html += `<tr><td style="font-weight: bold;">合計</td>`;
    var2Categories.forEach(cat2 => {
        html += `<td style="text-align: center; font-weight: bold;">${colTotals[cat2]}</td>`;
    });
    html += `<td style="text-align: center; font-weight: bold;">${grandTotal}</td></tr>`;
    html += `</tbody></table></div>`;

    // 期待度数
    html += `
        <h5 style="color: #2d3748; margin-top: 1.5rem; margin-bottom: 0.75rem;">＜期待度数＞</h5>
        <div class="table-container" style="overflow-x: auto; margin-bottom: 2rem;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">${var1} \\ ${var2}</th>
    `;

    var2Categories.forEach(cat2 => {
        html += `<th style="text-align: center;">${cat2}</th>`;
    });
    html += `</tr></thead><tbody>`;

    var1Categories.forEach(cat1 => {
        html += `<tr><td style="font-weight: bold; color: #1e90ff;">${cat1}</td>`;
        var2Categories.forEach(cat2 => {
            const isSignificant = Math.abs(residuals[cat1][cat2]) > threshold;
            const bgColor = isSignificant ? 'background-color: #fef08a;' : '';
            html += `<td style="text-align: center; ${bgColor}">${expected[cat1][cat2].toFixed(2)}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    // カイ二乗値
    html += `
        <h5 style="color: #2d3748; margin-top: 1.5rem; margin-bottom: 0.75rem;">＜カイ二乗値＞</h5>
        <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 0.5rem;">(観測度数 - 期待度数)^2 / 期待度数</p>
        <div class="table-container" style="overflow-x: auto; margin-bottom: 1rem;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">${var1} \\ ${var2}</th>
    `;

    var2Categories.forEach(cat2 => {
        html += `<th style="text-align: center;">${cat2}</th>`;
    });
    html += `</tr></thead><tbody>`;

    var1Categories.forEach(cat1 => {
        html += `<tr><td style="font-weight: bold; color: #1e90ff;">${cat1}</td>`;
        var2Categories.forEach(cat2 => {
            const isSignificant = Math.abs(residuals[cat1][cat2]) > threshold;
            const bgColor = isSignificant ? 'background-color: #fef08a;' : '';
            html += `<td style="text-align: center; ${bgColor}">${chiSquareValues[cat1][cat2].toFixed(2)}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<p style="color: #6b7280; font-size: 0.9rem;"><span style="background-color: #fef08a; padding: 0.25rem 0.5rem; border-radius: 4px;">有意に差が出ているセル</span>は黄色で表示されます</p>`;

    html += `</div>`;

    container.innerHTML = html;
}

// 検定結果の表示
function displayTestResults(chiSquareStat, pValue, df, var1, var2) {
    const container = document.getElementById('test-results-section');

    const interpretation = pValue < 0.05
        ? `【${var1}】と【${var2}】には<strong style="color: #1e90ff;">統計的に有意な関連がある</strong>と判断されます（p < 0.05）`
        : `【${var1}】と【${var2}】には統計的に有意な関連は認められませんでした（p ≥ 0.05）`;

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> カイ二乗検定の結果
            </h4>
            <div class="table-container" style="overflow-x: auto; margin-bottom: 1.5rem;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">項目</th>
                            <th>値</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold;">カイ二乗統計量</td>
                            <td>${chiSquareStat.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">P値</td>
                            <td>${pValue.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">自由度</td>
                            <td>${df}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="padding: 1rem; background: #f0f8ff; border-left: 4px solid #1e90ff; border-radius: 4px;">
                <h5 style="color: #0c4a6e; margin: 0 0 0.5rem 0;">結果の解釈</h5>
                <p style="margin: 0; color: #0c4a6e;">${interpretation}</p>
            </div>
        </div>
    `;
}

// ヒートマップの表示
function displayHeatmap(observed, var1, var2, var1Categories, var2Categories) {
    const container = document.getElementById('heatmap-section');

    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-th"></i> 【${var1}】 と 【${var2}】 の観測度数ヒートマップ
            </h4>
            <div id="heatmap-chart"></div>
        </div>
    `;

    // ヒートマップ用のデータ準備
    const zValues = var1Categories.map(cat1 =>
        var2Categories.map(cat2 => observed[cat1][cat2])
    );

    // アノテーション（セルに観測度数を表示）
    const annotations = [];
    var1Categories.forEach((cat1, i) => {
        var2Categories.forEach((cat2, j) => {
            annotations.push({
                x: cat2,
                y: cat1,
                text: observed[cat1][cat2].toString(),
                showarrow: false,
                font: {
                    color: 'black',
                    size: 14
                }
            });
        });
    });

    const data = [{
        x: var2Categories,
        y: var1Categories,
        z: zValues,
        type: 'heatmap',
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
            title: '観測度数'
        }
    }];

    const layout = {
        title: `【${var1}】 と 【${var2}】 の観測度数ヒートマップ`,
        xaxis: { title: var2, side: 'bottom' },
        yaxis: { title: var1 },
        annotations: annotations
    };

    Plotly.newPlot('heatmap-chart', data, layout);
}

export function render(container, characteristics) {
    container.innerHTML = `
        <div class="chi-square-container">
            <!-- データプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="chi-square-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 変数選択 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-chart-pie"></i> カイ２乗検定
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">２つのカテゴリ変数からクロス表やヒートマップを出力し、度数の偏りを解釈します</p>
                </div>

                <div style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-tag"></i> 変数1を選択:
                    </label>
                    <select id="var1-select" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem;"></select>
                </div>

                <div style="padding: 1rem; background: #fafbfc; border-radius: 8px;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-tag"></i> 変数2を選択:
                    </label>
                    <select id="var2-select" style="width: 100%; padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem;"></select>
                </div>

                <button id="run-chi-square-btn" class="btn-analysis" style="margin-top: 1.5rem; width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                    <i class="fas fa-play"></i> カイ二乗検定を実行
                </button>
            </div>

            <!-- 結果セクション -->
            <div id="results-section" style="display: none;">
                <div id="frequency-chart-section"></div>
                <div id="crosstab-section"></div>
                <div id="test-results-section"></div>
                <div id="heatmap-section"></div>
            </div>
        </div>
    `;

    // 共通のデータプレビューと要約統計量を表示（折りたたみ可能）
    renderDataOverview('#chi-square-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    const { categoricalColumns } = characteristics;

    // 変数選択のセレクトボックス
    const var1Select = document.getElementById('var1-select');
    const var2Select = document.getElementById('var2-select');

    if (categoricalColumns.length === 0) {
        var1Select.innerHTML = '<option value="">カテゴリ変数が見つかりません</option>';
        var2Select.innerHTML = '<option value="">カテゴリ変数が見つかりません</option>';
        var1Select.disabled = true;
        var2Select.disabled = true;
        document.getElementById('run-chi-square-btn').disabled = true;
    } else if (categoricalColumns.length < 2) {
        var1Select.innerHTML = '<option value="">選択してください...</option>' +
            categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
        var2Select.innerHTML = '<option value="">カテゴリ変数が1つしかありません</option>';
        var2Select.disabled = true;
        document.getElementById('run-chi-square-btn').disabled = true;
    } else {
        const options = '<option value="">選択してください...</option>' +
            categoricalColumns.map(col => `<option value="${col}">${col}</option>`).join('');
        var1Select.innerHTML = options;
        var2Select.innerHTML = options;
    }

    // イベントリスナー
    document.getElementById('run-chi-square-btn').addEventListener('click', runChiSquareTest);
}
