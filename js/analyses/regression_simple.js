import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml } from '../utils.js';

function runSimpleRegression(currentData) {
    const xVar = document.getElementById('independent-var').value;
    const yVar = document.getElementById('dependent-var').value;

    if (!xVar || !yVar) {
        alert('変数を選択してください');
        return;
    }
    if (xVar === yVar) {
        alert('異なる変数を選択してください');
        return;
    }

    // データの準備
    const data = currentData
        .map(row => ({ x: row[xVar], y: row[yVar] }))
        .filter(d => d.x != null && !isNaN(d.x) && d.y != null && !isNaN(d.y));

    if (data.length < 3) {
        alert('データ数が不足しています');
        return;
    }

    const n = data.length;
    const x = data.map(d => d.x);
    const y = data.map(d => d.y);
    const xMean = jStat.mean(x);
    const yMean = jStat.mean(y);

    // OLS calculation
    // Slope (b1) = sum((xi - xMean)(yi - yMean)) / sum((xi - xMean)^2)
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (x[i] - xMean) * (y[i] - yMean);
        denominator += (x[i] - xMean) ** 2;
    }
    if (denominator === 0) {
        // 説明変数が定数（分散0）の場合、回帰は不可能
        throw new Error('説明変数の分散が0です。すべて同じ値のため回帰分析を実行できません。');
    }
    const b1 = numerator / denominator;
    const b0 = yMean - b1 * xMean;

    // Statistics
    let rss = 0;
    let tss = 0;
    const residuals = [];
    const fittedValues = [];
    for (let i = 0; i < n; i++) {
        const yPred = b0 + b1 * x[i];
        residuals.push(y[i] - yPred);
        fittedValues.push(yPred);
        rss += (y[i] - yPred) ** 2;
        tss += (y[i] - yMean) ** 2;
    }
    const r2 = 1 - (rss / tss);
    const correlation = jStat.corrcoeff(x, y);

    // Standard Error and Tests
    const df = n - 2;
    const seModel = Math.sqrt(rss / df);
    const seB1 = seModel / Math.sqrt(denominator);
    const tStat = b1 / seB1;
    const pValue = (1 - jStat.studentt.cdf(Math.abs(tStat), df)) * 2;

    const outputContainer = document.getElementById('regression-results');
    outputContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 分析結果
            </h4>
            
            <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                <div class="data-stat-card">
                    <div class="stat-label">回帰式</div>
                    <div class="stat-value" style="font-size: 1.2rem;">y = ${b1.toFixed(3)}x + ${b0.toFixed(3)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">決定係数 (R²)</div>
                    <div class="stat-value">${r2.toFixed(3)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">相関係数 (r)</div>
                    <div class="stat-value">${correlation.toFixed(3)}</div>
                </div>
            </div>

            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>係数</th>
                            <th>推定値</th>
                            <th>標準誤差</th>
                            <th>t値</th>
                            <th>p値</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>切片 (Intercept)</td>
                            <td>${b0.toFixed(3)}</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                        </tr>
                        <tr>
                            <td>傾き (${xVar})</td>
                            <td>${b1.toFixed(3)}</td>
                            <td>${seB1.toFixed(3)}</td>
                            <td>${tStat.toFixed(3)}</td>
                            <td style="${pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pValue.toFixed(4)} ${pValue < 0.01 ? '**' : (pValue < 0.05 ? '*' : '')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> 結果の解釈
                </h4>
                <div style="line-height: 1.6;">
                    ${InterpretationHelper.interpretRegression(r2, pValue, yVar, [{ name: xVar, beta: b1, p: pValue, stdBeta: correlation }])}
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <div id="reporting-table-container-simple-reg"></div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                <div id="regression-plot"></div>
                <div id="regression-diagnostic-plot"></div>
            </div>
        </div>
    `;

    // Generate APA Table
    const headersReg = ["Variable", "<em>B</em>", "<em>SE B</em>", "<em>t</em>", "<em>p</em>"];
    const rowsReg = [
        ["Intercept", b0.toFixed(3), "-", "-", "-"],
        [xVar, b1.toFixed(3), seB1.toFixed(3), tStat.toFixed(3), (pValue < 0.001 ? '< .001' : pValue.toFixed(3))]
    ];

    // Using setTimeout to ensure DOM is updated? No, innerHTML is synchronous.
    // Wait, check variable access. b0, b1, seB1, tStat, pValue, xVar are available in scope.
    // R2, F, df also typically reported. APA table for regression often includes these in Note or separate lines.
    // Standard format: Table with Coeffs, and Note: R^2 = .xx, F(df1, df2) = xx, p = .xx.

    const noteReg = `<em>R</em><sup>2</sup> = ${r2.toFixed(3)}, <em>F</em>(1, ${df}) = ${(Math.pow(tStat, 2)).toFixed(2)}, <em>p</em> ${pValue < 0.001 ? '< .001' : '= ' + pValue.toFixed(3)}.`;

    // We need to inject this AFTER innerHTML update.
    // But innerHTML update happens right above.

    setTimeout(() => {
        document.getElementById('reporting-table-container-simple-reg').innerHTML =
            generateAPATableHtml('reg-simple-apa', 'Table 1. Results of Simple Linear Regression', headersReg, rowsReg, noteReg);
    }, 0);

    // Plots
    plotRegression(x, y, b0, b1, xVar, yVar);
    plotResidualsVsFitted(fittedValues, residuals);

    document.getElementById('analysis-results').style.display = 'block';

    // 可視化コントロールの追加
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');

    if (axisControl && titleControl) {
        const updatePlot = () => {
            plotRegression(x, y, b0, b1, xVar, yVar);
            plotResidualsVsFitted(fittedValues, residuals);
        };
        axisControl.addEventListener('change', updatePlot);
        titleControl.addEventListener('change', updatePlot);
    }
}

function plotRegression(x, y, b0, b1, xVar, yVar) {
    const tracePoints = {
        x: x,
        y: y,
        mode: 'markers',
        type: 'scatter',
        name: 'データ',
        marker: { color: 'rgba(30, 144, 255, 0.6)' }
    };

    const xRange = [Math.min(...x), Math.max(...x)];
    const yLine = [b0 + b1 * xRange[0], b0 + b1 * xRange[1]];

    const traceLine = {
        x: xRange,
        y: yLine,
        mode: 'lines',
        type: 'scatter',
        name: '回帰直線',
        line: { color: '#ef4444', width: 2 }
    };

    const layout = {
        title: '',
        xaxis: { title: xVar },
        yaxis: { title: '' },
        showlegend: true,
        margin: { l: 100, b: 150 },
        annotations: []
    };

    // 軸ラベルとタイトルの表示切り替え
    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (showAxisLabels) {
        const tategakiTitle = getTategakiAnnotation(yVar);
        if (tategakiTitle) layout.annotations.push(tategakiTitle);
    } else {
        layout.xaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation(`単回帰分析: ${yVar} vs ${xVar}`);
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('regression-plot', [tracePoints, traceLine], layout, createPlotlyConfig('単回帰分析', [yVar, xVar]));
}

function plotResidualsVsFitted(fitted, residuals) {
    const trace = {
        x: fitted,
        y: residuals,
        mode: 'markers',
        type: 'scatter',
        marker: { color: '#ef4444', size: 8, opacity: 0.7 },
        name: '残差'
    };

    const layout = {
        title: '',
        xaxis: { title: '予測値 (Fitted values)', zeroline: false },
        yaxis: { title: '残差 (Residuals)', zeroline: true, zerolinecolor: '#9ca3af', zerolinewidth: 2 },
        margin: { l: 80, r: 20, b: 60, t: 40 },
        hovermode: 'closest',
        shapes: [
            {
                type: 'line',
                x0: Math.min(...fitted),
                y0: 0,
                x1: Math.max(...fitted),
                y1: 0,
                line: {
                    color: 'gray',
                    width: 2,
                    dash: 'dashdot'
                }
            }
        ],
        annotations: []
    };

    // Visualization Controls
    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (!showAxisLabels) {
        layout.xaxis.title = '';
        layout.yaxis.title = '';
    }

    if (showGraphTitle) {
        layout.title = { text: '残差プロット (Residuals vs Fitted)', font: { size: 14 } };
    }

    Plotly.newPlot('regression-diagnostic-plot', [trace], layout, createPlotlyConfig('残差プロット', ['Residuals', 'Fitted']));
}

export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="regression-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-chart-line"></i> 単回帰分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">1つの変数から別の変数を予測します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 単回帰分析 (Simple Linear Regression) とは？</strong>
                        <p>「あるデータ（説明変数）から、別のデータ（目的変数）を予測する式」を作る分析です。「予測」や「要因の影響度」を知りたいときに使います。</p>
                        <img src="image/regression_simple.png" alt="単回帰分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 「広告費」から、来月の「売上」を予測したいとき</li>
                        <li><i class="fas fa-check"></i> 「駅からの距離」が「家賃」にどれくらい影響するか知りたいとき</li>
                    </ul>
                    <h4>主な指標</h4>
                    <ul>
                        <li><strong>決定係数 (R²):</strong> 予測の「精度」を表します（0から1）。目安として0.5以上あると予測精度が良いとされます。</li>
                        <li><strong>回帰係数:</strong> 「Xが1増えるとYがこれだけ増える」という影響の大きさを表します。</li>
                    </ul>
                    <h4>主な指標</h4>
                    <ul>
                        <li><strong>決定係数 (R²):</strong> モデルの当てはまりの良さ（予測精度）。1に近いほど精度が高いです。</li>
                        <li><strong>回帰係数:</strong> 説明変数が1増えたときに、目的変数がどれくらい増えるかを表します。</li>
                        <li><strong>p値:</strong> その関係が偶然でないかどうかを示します。</li>
                    </ul>
                </div>
            </div>

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
                            <li><strong>推定法:</strong> 最小二乗法 (Ordinary Least Squares: OLS)</li>
                            <li><strong>回帰係数:</strong> \( \hat{\beta} = (X^T X)^{-1} X^T y \) (解析解)</li>
                            <li><strong>決定係数 (R²):</strong> \( 1 - \frac{RSS}{TSS} \) (残差平方和 / 全平方和)</li>
                            <li><strong>検定:</strong> 回帰係数の有意性はt検定を用いています。 (標準誤差 SE を計算)</li>
                            <li><strong>仮定:</strong> 誤差項の正規性と等分散性を仮定しています。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="simple-reg-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="independent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-regression-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <!-- 可視化コントロール -->
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="visualization-controls-container"></div>
                </div>
                <div id="regression-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#simple-reg-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Selects
    createVariableSelector('independent-var-container', numericColumns, 'independent-var', {
        label: '<i class="fas fa-arrow-right"></i> 説明変数 (X):',
        multiple: false
    });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-bullseye"></i> 目的変数 (Y):',
        multiple: false
    });

    createAnalysisButton('run-regression-btn-container', '分析を実行', () => runSimpleRegression(currentData), { id: 'run-simple-regression-btn' });
}