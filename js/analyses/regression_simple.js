import { currentData } from '../main.js';
import { showError, renderDataOverview } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    // データ概要の表示（共通関数）
    const overviewContainerId = 'reg-data-overview';
    container.innerHTML = `
        <div id="${overviewContainerId}" class="info-sections" style="margin-bottom: 2rem;"></div>
        
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background: #1e90ff; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-cog"></i> 分析設定
                </h3>
            </div>
            
            <div class="analysis-controls">
                <div class="control-group" style="margin-bottom: 1.5rem;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-arrow-right" style="color: #1e90ff;"></i> 説明変数 (X):
                    </label>
                    <select id="reg-x-var" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e0; border-radius: 6px;">
                        ${numericColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                </div>
                
                <div class="control-group" style="margin-bottom: 1.5rem;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-bullseye" style="color: #1e90ff;"></i> 目的変数 (Y):
                    </label>
                    <select id="reg-y-var" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e0; border-radius: 6px;">
                        ${numericColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                </div>
                
                <button id="run-reg-btn" class="btn-analysis" style="width: 100%; padding: 1rem; background: #1e90ff; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: background 0.2s;">
                    <i class="fas fa-calculator"></i> 分析を実行
                </button>
            </div>
        </div>
        
        <div id="reg-results" class="analysis-results" style="margin-top: 2rem;"></div>
    `;

    renderDataOverview(`#${overviewContainerId}`, currentData, characteristics, { initiallyCollapsed: true });

    document.getElementById('run-reg-btn').addEventListener('click', () => {
        const xVar = document.getElementById('reg-x-var').value;
        const yVar = document.getElementById('reg-y-var').value;
        if (xVar === yVar) {
            showError('説明変数と目的変数は異なるものを選択してください。');
            return;
        }
        runSimpleRegressionAnalysis(xVar, yVar);
    });
}

function runSimpleRegressionAnalysis(xVar, yVar) {
    const resultsContainer = document.getElementById('reg-results');
    resultsContainer.innerHTML = `
        <div style="background: #1e90ff; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; font-size: 1.25rem;">
                <i class="fas fa-chart-line"></i> 分析結果: ${xVar} → ${yVar}
            </h3>
        </div>
    `;

    // Filter valid data
    const validData = currentData.filter(row =>
        row[xVar] != null && row[yVar] != null && !isNaN(row[xVar]) && !isNaN(row[yVar])
    );

    if (validData.length < 3) {
        resultsContainer.innerHTML += '<div class="error-message">分析に必要なデータが不足しています（最低3件必要）。</div>';
        return;
    }

    const xVector = validData.map(d => Number(d[xVar]));
    const yVector = validData.map(d => Number(d[yVar]));
    const n = validData.length;

    // --- Calculations ---
    const meanX = jStat.mean(xVector);
    const meanY = jStat.mean(yVector);

    // Calculate Slope and Intercept
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (xVector[i] - meanX) * (yVector[i] - meanY);
        denominator += (xVector[i] - meanX) ** 2;
    }

    // Check for zero variance
    if (denominator === 0) {
        resultsContainer.innerHTML += '<div class="error-message">説明変数の値が全て同じため、分析を実行できません。</div>';
        return;
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Predicted & Residuals
    const yPred = xVector.map(x => slope * x + intercept);
    const residuals = yVector.map((y, i) => y - yPred[i]);

    // Sum of Squares
    const ssTotal = yVector.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
    const ssRes = residuals.reduce((acc, r) => acc + r ** 2, 0);
    const ssReg = ssTotal - ssRes;

    // R2
    const rSquared = ssTotal > 0 ? ssReg / ssTotal : 0;
    const r = Math.sqrt(rSquared) * (slope >= 0 ? 1 : -1);

    // ANOVA for Regression
    const dfReg = 1;
    const dfRes = n - 2;
    const msReg = ssReg / dfReg;
    const msRes = dfRes > 0 ? ssRes / dfRes : 0;
    const fStat = msRes > 0 ? msReg / msRes : 0;
    const pValue = msRes > 0 ? (1.0 - jStat.centralF.cdf(fStat, dfReg, dfRes)) : 1.0;

    // Standard Errors for Coefficients
    // SE_slope = sqrt(MS_res / sum((x-meanX)^2))
    const seSlope = Math.sqrt(msRes / denominator);
    // SE_intercept = sqrt(MS_res * (1/n + meanX^2 / sum((x-meanX)^2)))
    const seIntercept = Math.sqrt(msRes * (1 / n + (meanX ** 2) / denominator));

    // t-values
    const tSlope = seSlope > 0 ? slope / seSlope : 0;
    const tIntercept = seIntercept > 0 ? intercept / seIntercept : 0;

    // p-values for coefficients (2-tailed)
    const pSlope = dfRes > 0 ? (1.0 - jStat.studentt.cdf(Math.abs(tSlope), dfRes)) * 2.0 : 1.0;
    const pIntercept = dfRes > 0 ? (1.0 - jStat.studentt.cdf(Math.abs(tIntercept), dfRes)) * 2.0 : 1.0;

    // Significance Sign Helper
    const getSig = (p) => {
        if (p < 0.01) return '**';
        if (p < 0.05) return '*';
        if (p < 0.1) return '†';
        return 'n.s.';
    };
    const sign = getSig(pValue);

    // --- Render Output ---

    // 1. Model Equation Card
    resultsContainer.innerHTML += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                <i class="fas fa-square-root-alt"></i> 数理モデル
            </h4>
            <div style="padding: 1rem; background: #f0f9ff; border-left: 4px solid #1e90ff; border-radius: 4px;">
                <p style="margin: 0; font-family: monospace; font-size: 1.25em; color: #0c4a6e; font-weight: bold;">
                    ${yVar} = ${slope.toFixed(4)} × ${xVar} ${intercept >= 0 ? '+' : '-'} ${Math.abs(intercept).toFixed(4)}
                </p>
                <p style="margin: 0.5rem 0 0 0; color: #64748b; font-size: 0.9em;">
                    (目的変数 = 傾き × 説明変数 + 切片)
                </p>
            </div>
        </div>
    `;

    // 2. Statistics Tables
    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Model Summary -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-check-circle"></i> モデルの適合度
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>指標</th><th>値</th><th>備考</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>決定係数 (R²)</td><td><strong>${rSquared.toFixed(4)}</strong></td><td>モデルの当てはまりの良さ</td></tr>
                            <tr><td>相関係数 (r)</td><td>${r.toFixed(4)}</td><td>${Math.abs(r) > 0.7 ? '強い相関' : (Math.abs(r) > 0.4 ? '中程度の相関' : '弱い相関')}</td></tr>
                            <tr><td>F値</td><td>${fStat.toFixed(4)}</td><td>自由度 (${dfReg}, ${dfRes})</td></tr>
                            <tr><td>p値</td><td>${pValue.toExponential(4)}</td><td><span class="badge ${sign === 'n.s.' ? 'badge-secondary' : 'badge-primary'}">${sign}</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Coefficients -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-list-ol"></i> 回帰係数
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>変数</th><th>係数</th><th>標準誤差</th><th>t値</th><th>p値</th><th>判定</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>(切片)</td>
                                <td>${intercept.toFixed(4)}</td>
                                <td>${seIntercept.toFixed(4)}</td>
                                <td>${tIntercept.toFixed(4)}</td>
                                <td>${pIntercept.toExponential(4)}</td>
                                <td><span class="badge ${getSig(pIntercept) === 'n.s.' ? 'badge-secondary' : 'badge-primary'}">${getSig(pIntercept)}</span></td>
                            </tr>
                            <tr>
                                <td style="font-weight: 500;">${xVar}</td>
                                <td>${slope.toFixed(4)}</td>
                                <td>${seSlope.toFixed(4)}</td>
                                <td>${tSlope.toFixed(4)}</td>
                                <td>${pSlope.toExponential(4)}</td>
                                <td><span class="badge ${getSig(pSlope) === 'n.s.' ? 'badge-secondary' : 'badge-primary'}">${getSig(pSlope)}</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    resultsContainer.innerHTML += html;

    // 3. Plots
    const plotContainer = document.createElement('div');
    plotContainer.style.display = 'grid';
    plotContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
    plotContainer.style.gap = '1.5rem';
    resultsContainer.appendChild(plotContainer);

    // Scatter Plot
    const scatterDiv = document.createElement('div');
    const plot1Id = 'reg-plot1';
    scatterDiv.id = plot1Id;
    scatterDiv.style.background = 'white';
    scatterDiv.style.padding = '1.5rem';
    scatterDiv.style.borderRadius = '8px';
    scatterDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    plotContainer.appendChild(scatterDiv);

    // Residual Plot
    const residualDiv = document.createElement('div');
    const plot2Id = 'reg-plot2';
    residualDiv.id = plot2Id;
    residualDiv.style.background = 'white';
    residualDiv.style.padding = '1.5rem';
    residualDiv.style.borderRadius = '8px';
    residualDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    plotContainer.appendChild(residualDiv);

    // Sort for line plot
    const sortedIndices = xVector.map((x, i) => i).sort((a, b) => xVector[a] - xVector[b]);
    const sortedX = sortedIndices.map(i => xVector[i]);
    const sortedYPred = sortedIndices.map(i => yPred[i]);

    Plotly.newPlot(plot1Id, [
        {
            x: xVector, y: yVector, mode: 'markers', name: '実測値',
            marker: { color: '#1e90ff', size: 9, opacity: 0.7, line: { color: 'white', width: 1 } }
        },
        {
            x: sortedX, y: sortedYPred, mode: 'lines', name: '回帰直線',
            line: { color: '#2d3748', width: 3 }
        }
    ], {
        title: { text: `回帰直線: ${xVar} vs ${yVar}`, font: { size: 16 } },
        xaxis: { title: xVar },
        yaxis: { title: yVar },
        font: { family: "Inter, sans-serif" },
        margin: { t: 50, l: 50, r: 20, b: 50 },
        legend: { x: 0.05, y: 1 }
    });

    Plotly.newPlot(plot2Id, [
        {
            x: yPred, y: residuals, mode: 'markers',
            marker: { color: '#64748b', size: 8, opacity: 0.7 }
        },
        {
            x: [Math.min(...yPred), Math.max(...yPred)], y: [0, 0],
            mode: 'lines', line: { color: '#000000', dash: 'dash', width: 1 }
        }
    ], {
        title: { text: '残差プロット (等分散性の確認)', font: { size: 16 } },
        xaxis: { title: '予測値 (Fitted Values)' },
        yaxis: { title: '残差 (Residuals)' },
        font: { family: "Inter, sans-serif" },
        margin: { t: 50, l: 50, r: 20, b: 50 }
    });
}