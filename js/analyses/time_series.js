/**
 * @fileoverview 時系列データ分析
 * @module time_series
 * @description 時系列データの可視化と移動平均計算
 */

import { createVariableSelector, createAnalysisButton, showError, createPlotlyConfig, createVisualizationControls } from '../utils.js';

/**
 * 時系列分析UIをレンダリング
 * @param {HTMLElement} container - レンダリング先コンテナ
 * @param {Array<Object>} data - 分析対象データ
 * @param {Object} characteristics - データ特性
 */
export function render(container, data, characteristics) {
    container.innerHTML = `
        <div class="time-series-container">
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 1.5rem; color: #2d3748;">
                <i class="fas fa-chart-line" style="color: #1e90ff; margin-right: 0.5rem;"></i>
                時系列データ分析
            </h3>
            <p style="color: #4a5568; margin-bottom: 1.5rem;">
                時間の経過とともに変化するデータを分析します。「売上の推移」や「株価の変動」など、流れを見るのに適しています。<br>
                <strong>移動平均</strong>を使ってギザギザしたグラフを滑らかにしたり、<strong>自己相関</strong>を使って「周期性（季節性）」を見つけることができます。
            </p>

            <!-- ロジック詳説 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-code"></i> 分析ロジック・計算式詳説 (専門家向け)</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note" style="background: #f1f8ff; border-left: 5px solid #0366d6;">
                        <strong><i class="fas fa-check-circle"></i> 実装ロジックの検証</strong>
                        <ul>
                            <li><strong>移動平均 (SMA):</strong> 単純移動平均 \( \frac{1}{k} \sum_{i=0}^{k-1} x_{t-i} \)</li>
                            <li><strong>自己相関 (ACF):</strong> 
                                \( r_k = \frac{\sum (x_t - \bar{x})(x_{t+k} - \bar{x})}{\sum (x_t - \bar{x})^2} \)
                            </li>
                            <li>※ 定常性の検定（ADF検定など）は実装されていません。視覚的確認を目的としています。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6" style="margin-bottom: 1rem;">
                    <div id="time-var-container" style="background: #f8fafc; padding: 1rem; border-radius: 8px; height: 100%;"></div>
                </div>
                <div class="col-md-6" style="margin-bottom: 1rem;">
                    <div id="value-var-container" style="background: #f8fafc; padding: 1rem; border-radius: 8px; height: 100%;"></div>
                </div>
            </div>

            <div class="row" style="margin-top: 1rem;">
                <div class="col-12">
                     <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
                        <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                            <i class="fas fa-sliders-h"></i> 設定:
                        </label>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <label>移動平均区間 (Window): <input type="number" id="ma-window" value="5" min="2" max="100" style="padding: 0.25rem; border-radius: 4px; border: 1px solid #ddd; width: 60px;"></label>
                        </div>
                     </div>
                </div>
            </div>

            <div id="run-btn-container" style="margin-top: 1.5rem; text-align: center;"></div>
        </div>

        <div id="ts-results-section" style="display: none; margin-top: 2rem;">
            <div id="ts-plot-section"></div>
            <div id="ts-acf-section" style="margin-top: 2rem;"></div>
            <div id="ts-interpretation" style="margin-top: 2rem; background: white; padding: 1.5rem; border-radius: 8px; border-left: 5px solid #1e90ff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
        </div>
        </div>
    `;

    const { numericColumns, categoricalColumns, textColumns } = characteristics;
    // Time variable can be anything, but usually date/time strings or numbers
    const potentialTimeVars = [...textColumns, ...numericColumns];

    createVariableSelector('time-var-container', potentialTimeVars, 'time-var', {
        label: '<i class="far fa-clock"></i> 時間変数 (任意):',
        placeholder: '選択しない (行番号を使用)',
        multiple: false
    });

    createVariableSelector('value-var-container', numericColumns, 'value-var', {
        label: '<i class="fas fa-chart-bar"></i> 値変数 (必須):',
        placeholder: '分析する数値変数を選択...',
        multiple: false
    });

    createAnalysisButton('run-btn-container', '分析を実行', () => runTimeSeriesAnalysis(data), { id: 'run-ts-btn' });
}

function runTimeSeriesAnalysis(data) {
    const timeVar = document.getElementById('time-var').value;
    const valueVar = document.getElementById('value-var').value;
    const maWindow = parseInt(document.getElementById('ma-window').value, 10);

    if (!valueVar) {
        showError('値変数を指定してください。');
        return;
    }

    if (isNaN(maWindow) || maWindow < 2) {
        showError('移動平均区間は2以上の整数を指定してください。');
        return;
    }

    const resultsSection = document.getElementById('ts-results-section');
    resultsSection.style.display = 'block';

    // Data Preparation
    const seriesData = data.map((row, index) => {
        return {
            t: timeVar ? row[timeVar] : index + 1,
            y: parseFloat(row[valueVar])
        };
    }).filter(d => !isNaN(d.y)); // Remove NaNs

    if (seriesData.length < maWindow) {
        showError(`データの数(${seriesData.length})が移動平均区間(${maWindow})より少ないため計算できません。`);
        return;
    }

    // Calculations
    const yValues = seriesData.map(d => d.y);
    const tValues = seriesData.map(d => d.t);

    // Simple Moving Average
    const sma = calculateSMA(yValues, maWindow);

    // Autocorrelation (ACF)
    const acfLags = Math.min(20, Math.floor(yValues.length / 2));
    const acf = calculateACF(yValues, acfLags);

    // Rendering
    renderTimeSeriesPlot(tValues, yValues, sma, maWindow, valueVar);
    renderACFPlot(acf, acfLags);
    renderInterpretation(acf, maWindow, valueVar);
}

function calculateSMA(data, window) {
    let sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
            sma.push(null); // Not enough data
            continue;
        }
        const slice = data.slice(i - window + 1, i + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / window;
        sma.push(avg);
    }
    return sma;
}

function calculateACF(data, maxLag) {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;

    let acf = [];
    for (let lag = 0; lag <= maxLag; lag++) {
        let cov = 0;
        for (let i = 0; i < n - lag; i++) {
            cov += (data[i] - mean) * (data[i + lag] - mean);
        }
        acf.push((cov / n) / variance);
    }
    return acf;
}

function renderTimeSeriesPlot(t, y, sma, window, label) {
    const traceOriginal = {
        x: t, y: y,
        mode: 'lines+markers',
        name: '実測値',
        line: { color: '#e2e8f0', width: 2 },
        marker: { color: '#94a3b8', size: 4 }
    };

    const traceSMA = {
        x: t, y: sma,
        mode: 'lines',
        name: `${window}項移動平均`,
        line: { color: '#1e90ff', width: 3 }
    };

    const layout = {
        title: { text: `<b>${label} の推移と傾向</b>`, font: { size: 18 } },
        xaxis: { title: '時間 / 順序' },
        yaxis: { title: label },
        ...createPlotlyConfig().layout
    };

    Plotly.newPlot('ts-plot-section', [traceOriginal, traceSMA], layout, createPlotlyConfig().config);
}

function renderACFPlot(acf, maxLag) {
    const lags = Array.from({ length: maxLag + 1 }, (_, i) => i);

    // Confidence Interval (approx 95% = 1.96 / sqrt(N)) - Simplified
    // Note: This is a loose approximation for visual reference

    const trace = {
        x: lags,
        y: acf,
        type: 'bar',
        marker: { color: '#1e90ff' },
        name: '自己相関'
    };

    const layout = {
        title: { text: '<b>自己相関関数 (ACF)</b> - 周期性の確認', font: { size: 18 } },
        xaxis: { title: 'ラグ (Lag)' },
        yaxis: { title: '自己相関係数', range: [-1.1, 1.1] },
        shapes: [
            // Zero line
            { type: 'line', x0: 0, x1: maxLag, y0: 0, y1: 0, line: { color: 'black', width: 1 } }
        ],
        ...createPlotlyConfig().layout
    };

    Plotly.newPlot('ts-acf-section', [trace], layout, createPlotlyConfig().config);
}

function renderInterpretation(acf, window, label) {
    const div = document.getElementById('ts-interpretation');

    // Simple trend analysis based on ACF(1)
    const r1 = acf[1];
    let trendText = "";
    if (r1 > 0.8) trendText = "非常に強い持続的なトレンドまたは慣性が見られます。";
    else if (r1 > 0.5) trendText = "一定のトレンド傾向が見られます。";
    else if (r1 < 0.2 && r1 > -0.2) trendText = "明確なトレンドは見られず、ランダムな変動に近い可能性があります。";
    else trendText = "複雑な変動パターンを含んでいる可能性があります。";

    div.innerHTML = `
        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-lightbulb"></i> 分析結果の解釈</h4>
        <p><strong>トレンドの概要:</strong><br>
        ${window}項移動平均線（青線）を確認することで、短期的な変動を除去した大局的な傾向を把握できます。<br>
        自己相関係数 (Lag=1: ${r1.toFixed(2)}) からは、<strong>${trendText}</strong></p>
        <p><strong>周期性について:</strong><br>
        ACFグラフで特定のラグで高い値が周期的に現れる場合、季節性や周期性があることを示唆します。</p>
    `;
}
