import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

function runSimpleRegression() {
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
    const b1 = numerator / denominator;
    const b0 = yMean - b1 * xMean;

    // Statistics
    let rss = 0;
    let tss = 0;
    for (let i = 0; i < n; i++) {
        const yPred = b0 + b1 * x[i];
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
            
            <div id="regression-plot" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    // Plot
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

    Plotly.newPlot('regression-plot', [tracePoints, traceLine], {
        title: `単回帰分析: ${yVar} vs ${xVar}`,
        xaxis: { title: xVar },
        yaxis: { title: yVar },
        showlegend: true
    });

    document.getElementById('analysis-results').style.display = 'block';
}

export function render(container, characteristics) {
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
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 単回帰分析 (Simple Linear Regression) とは？</strong>
                        <p>1つの「原因（説明変数）」から「結果（目的変数）」を予測する直線を引く分析です。2つの変数の間にどのような直線的な関係があるかを数式（y = ax + b）でモデル化します。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>「広告費」から「売上」を予測したい</li>
                        <li>「気温」から「アイスクリームの販売数」を予測したい</li>
                    </ul>
                    <h4>主な指標</h4>
                    <ul>
                        <li><strong>決定係数 (R²):</strong> モデルの当てはまりの良さ（予測精度）。1に近いほど精度が高いです。</li>
                        <li><strong>回帰係数:</strong> 説明変数が1増えたときに、目的変数がどれくらい増えるかを表します。</li>
                        <li><strong>p値:</strong> その関係が偶然でないかどうかを示します。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="reg-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="independent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-regression-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
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

    createAnalysisButton('run-regression-btn-container', '単回帰分析を実行', runSimpleRegression, { id: 'run-regression-btn' });
}