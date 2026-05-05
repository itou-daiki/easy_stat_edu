// ==========================================
// Logistic Regression Module
// ==========================================
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml, getAcademicLayout, academicColors } from '../utils.js';

// ==========================================
// Logistic Regression Core (IRLS)
// ==========================================

function sigmoid(z) {
    // Clamp to avoid overflow
    z = Math.max(-500, Math.min(500, z));
    return 1.0 / (1.0 + Math.exp(-z));
}

/**
 * Fit logistic regression using IRLS (Iteratively Reweighted Least Squares).
 * y: array of 0/1
 * X: array of arrays (each row = [1, x1, x2, ...]) with intercept column
 * Returns: { coefficients, standardErrors, zValues, pValues, logLikelihood, iterations }
 */
function fitLogisticRegression(y, X, maxIter = 100, tol = 1e-8) {
    const n = y.length;
    const p = X[0].length;
    let beta = new Array(p).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
        // Compute predicted probabilities
        const mu = X.map(xi => {
            const z = xi.reduce((sum, xij, j) => sum + xij * beta[j], 0);
            return sigmoid(z);
        });

        // Weight matrix W = diag(mu * (1 - mu))
        const W = mu.map(m => m * (1 - m) + 1e-10); // add small value for stability

        // Compute X^T W X (p x p matrix)
        const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
        for (let j = 0; j < p; j++) {
            for (let k = 0; k < p; k++) {
                for (let i = 0; i < n; i++) {
                    XtWX[j][k] += X[i][j] * W[i] * X[i][k];
                }
            }
        }

        // Compute X^T (y - mu) (gradient)
        const grad = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            for (let i = 0; i < n; i++) {
                grad[j] += X[i][j] * (y[i] - mu[i]);
            }
        }

        // Solve XtWX * delta = grad using Gaussian elimination
        const delta = solveLinearSystem(XtWX, grad);
        if (!delta) break;

        // Update beta
        let maxChange = 0;
        for (let j = 0; j < p; j++) {
            beta[j] += delta[j];
            maxChange = Math.max(maxChange, Math.abs(delta[j]));
        }

        // Check convergence
        if (maxChange < tol) break;
    }

    // Final predictions
    const mu = X.map(xi => {
        const z = xi.reduce((sum, xij, j) => sum + xij * beta[j], 0);
        return sigmoid(z);
    });

    // Log-likelihood
    let logLik = 0;
    for (let i = 0; i < n; i++) {
        const p_i = Math.max(1e-15, Math.min(1 - 1e-15, mu[i]));
        logLik += y[i] * Math.log(p_i) + (1 - y[i]) * Math.log(1 - p_i);
    }

    // Standard errors from inverse of Fisher information (XtWX)
    const W_final = mu.map(m => m * (1 - m) + 1e-10);
    const fisher = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
            for (let i = 0; i < n; i++) {
                fisher[j][k] += X[i][j] * W_final[i] * X[i][k];
            }
        }
    }

    const fisherInv = invertMatrix(fisher);
    const se = fisherInv ? fisherInv.map((row, i) => Math.sqrt(Math.max(0, row[i]))) : new Array(p).fill(NaN);

    const zValues = beta.map((b, i) => se[i] > 0 ? b / se[i] : 0);
    const pValues = zValues.map(z => {
        const absZ = Math.abs(z);
        return 2 * (1 - jStat.normal.cdf(absZ, 0, 1));
    });

    return { coefficients: beta, standardErrors: se, zValues, pValues, logLikelihood: logLik, predictions: mu };
}

// ==========================================
// Matrix Utilities
// ==========================================

function solveLinearSystem(A, b) {
    const n = A.length;
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        // Find pivot
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

        if (Math.abs(aug[col][col]) < 1e-15) return null;

        // Eliminate
        for (let row = col + 1; row < n; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= n; j++) {
                aug[row][j] -= factor * aug[col][j];
            }
        }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++) {
            x[i] -= aug[i][j] * x[j];
        }
        x[i] /= aug[i][i];
    }
    return x;
}

function invertMatrix(A) {
    const n = A.length;
    const aug = A.map((row, i) => {
        const identity = new Array(n).fill(0);
        identity[i] = 1;
        return [...row, ...identity];
    });

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-15) return null;

        const pivot = aug[col][col];
        for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = aug[row][col];
            for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
        }
    }

    return aug.map(row => row.slice(n));
}

// ==========================================
// Model Evaluation
// ==========================================

function computeConfusionMatrix(yTrue, yPred, threshold = 0.5) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < yTrue.length; i++) {
        const pred = yPred[i] >= threshold ? 1 : 0;
        if (yTrue[i] === 1 && pred === 1) tp++;
        else if (yTrue[i] === 0 && pred === 1) fp++;
        else if (yTrue[i] === 0 && pred === 0) tn++;
        else fn++;
    }
    const accuracy = (tp + tn) / (tp + fp + tn + fn);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { tp, fp, tn, fn, accuracy, precision, recall, f1 };
}

function computeNagelkerkeR2(logLik, nullLogLik, n) {
    // Use log-space computation to avoid exp underflow for large n
    const coxSnell = 1 - Math.exp((2 / n) * (nullLogLik - logLik));
    const maxCoxSnell = 1 - Math.exp((2 / n) * nullLogLik);
    return maxCoxSnell > 0 ? coxSnell / maxCoxSnell : 0;
}

// ==========================================
// Main Analysis Function
// ==========================================

function runLogisticRegression(currentData, characteristics) {
    const depVar = document.getElementById('logistic-dep-var').value;
    const indepSelect = document.getElementById('logistic-indep-var-multiselect');
    const indepVars = Array.from(indepSelect.selectedOptions).map(o => o.value);

    if (!depVar) { alert('目的変数を選択してください'); return; }
    if (indepVars.length === 0) { alert('説明変数を1つ以上選択してください'); return; }

    // Get unique values of dependent variable
    const uniqueValues = [...new Set(currentData.map(row => row[depVar]).filter(v => v != null))];
    if (uniqueValues.length !== 2) {
        alert(`目的変数は2値（0/1など）である必要があります。現在のユニーク値: ${uniqueValues.join(', ')}`);
        return;
    }

    // Encode: sort values, first = 0, second = 1
    const sortedValues = uniqueValues.sort();
    const label0 = sortedValues[0];
    const label1 = sortedValues[1];

    // Prepare data
    const validData = currentData.filter(row => {
        if (row[depVar] == null) return false;
        return indepVars.every(v => row[v] != null && !isNaN(Number(row[v])));
    });

    if (validData.length < indepVars.length + 2) {
        alert('有効なデータ数が不足しています');
        return;
    }

    const y = validData.map(row => row[depVar] == label1 ? 1 : 0);
    const X = validData.map(row => [1, ...indepVars.map(v => Number(row[v]))]);

    // Fit model
    const result = fitLogisticRegression(y, X);

    // Null model (intercept only)
    const X_null = validData.map(() => [1]);
    const nullResult = fitLogisticRegression(y, X_null);
    const nagelkerkeR2 = computeNagelkerkeR2(result.logLikelihood, nullResult.logLikelihood, y.length);

    // Model chi-square test (likelihood ratio)
    const chi2 = -2 * (nullResult.logLikelihood - result.logLikelihood);
    const df = indepVars.length;
    const modelP = 1 - jStat.chisquare.cdf(chi2, df);

    // Confusion matrix
    const cm = computeConfusionMatrix(y, result.predictions);

    // Odds ratios
    const oddsRatios = result.coefficients.map(b => Math.exp(b));

    // Variable names for display
    const varNames = ['切片 (Intercept)', ...indepVars];

    // Render results
    const outputContainer = document.getElementById('logistic-results');
    outputContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 分析結果
            </h4>
            
            <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                <div class="data-stat-card">
                    <div class="stat-label">Nagelkerke R²</div>
                    <div class="stat-value">${nagelkerkeR2.toFixed(3)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">モデルχ²</div>
                    <div class="stat-value">${chi2.toFixed(3)} (df=${df}, ${modelP < 0.001 ? 'p &lt; .001' : 'p=' + modelP.toFixed(3)})</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">正解率</div>
                    <div class="stat-value">${(cm.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">対数尤度</div>
                    <div class="stat-value">${result.logLikelihood.toFixed(3)}</div>
                </div>
            </div>

            <h5 style="color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-table"></i> 回帰係数</h5>
            <div class="table-container" style="margin-bottom: 1.5rem;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>変数</th>
                            <th>係数 (B)</th>
                            <th>標準誤差</th>
                            <th>Wald z</th>
                            <th>p値</th>
                            <th>オッズ比 (exp(B))</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${varNames.map((name, i) => `
                            <tr>
                                <td>${name}</td>
                                <td>${result.coefficients[i].toFixed(4)}</td>
                                <td>${result.standardErrors[i].toFixed(4)}</td>
                                <td>${result.zValues[i].toFixed(3)}</td>
                                <td style="${result.pValues[i] < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">
                                    ${result.pValues[i] < 0.001 ? '&lt; .001' : result.pValues[i].toFixed(4)}
                                    ${result.pValues[i] < 0.01 ? '**' : (result.pValues[i] < 0.05 ? '*' : (result.pValues[i] < 0.1 ? '†' : 'n.s.'))}
                                </td>
                                <td>${oddsRatios[i].toFixed(4)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <h5 style="color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-th"></i> 混同行列</h5>
            <div class="table-container" style="margin-bottom: 1.5rem; max-width: 400px;">
                <table class="table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th></th>
                            <th colspan="2">予測値</th>
                        </tr>
                        <tr>
                            <th>実測値</th>
                            <th>${label0}</th>
                            <th>${label1}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${label0}</strong></td>
                            <td style="background: #f0fdf4;">${cm.tn}</td>
                            <td style="background: #fef2f2;">${cm.fp}</td>
                        </tr>
                        <tr>
                            <td><strong>${label1}</strong></td>
                            <td style="background: #fef2f2;">${cm.fn}</td>
                            <td style="background: #f0fdf4;">${cm.tp}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                <div class="data-stat-card">
                    <div class="stat-label">適合率 (Precision)</div>
                    <div class="stat-value">${(cm.precision * 100).toFixed(1)}%</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">再現率 (Recall)</div>
                    <div class="stat-value">${(cm.recall * 100).toFixed(1)}%</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">F1スコア</div>
                    <div class="stat-value">${cm.f1.toFixed(3)}</div>
                </div>
            </div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> 結果の解釈
                </h4>
                <div style="line-height: 1.6;">
                    ${interpretLogistic(result, varNames, oddsRatios, cm, nagelkerkeR2, modelP, label0, label1)}
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
                <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                <div id="reporting-table-container-logistic"></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
                <div id="logistic-prob-plot"></div>
                <div id="logistic-confusion-plot"></div>
            </div>
        </div>
    `;

    // APA Table
    const headersAPA = ["Variable", "<em>B</em>", "<em>SE</em>", "<em>z</em>", "<em>p</em>", "Odds Ratio"];
    const rowsAPA = varNames.map((name, i) => [
        name,
        result.coefficients[i].toFixed(3),
        result.standardErrors[i].toFixed(3),
        result.zValues[i].toFixed(3),
        result.pValues[i] < 0.001 ? '< .001' : result.pValues[i].toFixed(3),
        oddsRatios[i].toFixed(3)
    ]);
    const noteAPA = `Nagelkerke <em>R</em><sup>2</sup> = ${nagelkerkeR2.toFixed(3)}, χ<sup>2</sup>(${df}) = ${chi2.toFixed(2)}, <em>p</em> ${modelP < 0.001 ? '< .001' : '= ' + modelP.toFixed(3)}. 正解率 = ${(cm.accuracy * 100).toFixed(1)}%.`;

    setTimeout(() => {
        const container = document.getElementById('reporting-table-container-logistic');
        if (container) {
            container.innerHTML = generateAPATableHtml('logistic-apa', 'Table 1. Logistic Regression Results', headersAPA, rowsAPA, noteAPA);
        }
    }, 0);

    // Plots
    if (indepVars.length === 1) {
        plotPredictedProbabilities(validData, indepVars[0], y, result.predictions, label0, label1);
    } else {
        plotPredictedProbabilitiesMulti(y, result.predictions, label0, label1);
    }
    plotConfusionMatrixHeatmap(cm, label0, label1);

    document.getElementById('logistic-analysis-results').style.display = 'block';

    // Visualization controls
    const { axisControl, titleControl } = createVisualizationControls('logistic-vis-controls');
    if (axisControl && titleControl) {
        const updatePlots = () => {
            if (indepVars.length === 1) {
                plotPredictedProbabilities(validData, indepVars[0], y, result.predictions, label0, label1);
            } else {
                plotPredictedProbabilitiesMulti(y, result.predictions, label0, label1);
            }
            plotConfusionMatrixHeatmap(cm, label0, label1);
        };
        axisControl.addEventListener('change', updatePlots);
        titleControl.addEventListener('change', updatePlots);
    }
}

// ==========================================
// Interpretation
// ==========================================

function interpretLogistic(result, varNames, oddsRatios, cm, r2, modelP, label0, label1) {
    let html = '';

    // Model fit
    if (modelP < 0.05) {
        html += `<p>✅ <strong>モデルは統計的に有意</strong>です（p ${modelP < 0.001 ? '< .001' : '= ' + modelP.toFixed(3)}）。説明変数は「${label1}」の予測に寄与しています。</p>`;
    } else {
        html += `<p>⚠️ モデルは統計的に有意ではありません（p = ${modelP.toFixed(3)}）。説明変数では「${label1}」を十分に予測できていない可能性があります。</p>`;
    }

    html += `<p>📊 <strong>Nagelkerke R² = ${r2.toFixed(3)}</strong>: `;
    if (r2 >= 0.5) html += '高い説明力を持つモデルです。';
    else if (r2 >= 0.25) html += '中程度の説明力があります。';
    else html += '説明力はやや低いです。';
    html += '</p>';

    html += `<p>🎯 <strong>正解率 ${(cm.accuracy * 100).toFixed(1)}%</strong>: `;
    if (cm.accuracy >= 0.9) html += '非常に高い予測精度です。';
    else if (cm.accuracy >= 0.7) html += '良好な予測精度です。';
    else html += '予測精度の改善が望まれます。';
    html += '</p>';

    // Significant predictors
    const sigVars = varNames.slice(1).filter((_, i) => result.pValues[i + 1] < 0.05);
    if (sigVars.length > 0) {
        html += '<p>📌 <strong>有意な説明変数：</strong></p><ul>';
        sigVars.forEach((name, idx) => {
            const realIdx = varNames.indexOf(name);
            const or = oddsRatios[realIdx];
            html += `<li><strong>${name}</strong>: `;
            if (or > 1) {
                html += `この変数が1単位増加すると、「${label1}」になるオッズが<strong>${or.toFixed(3)}倍</strong>になります（オッズ比 = ${or.toFixed(3)}）。`;
            } else {
                html += `この変数が1単位増加すると、「${label1}」になるオッズが<strong>${or.toFixed(3)}倍</strong>に減少します（オッズ比 = ${or.toFixed(3)}）。`;
            }
            html += '</li>';
        });
        html += '</ul>';
    }

    return html;
}

// ==========================================
// Visualization
// ==========================================

function plotPredictedProbabilities(data, xVar, y, predictions, label0, label1) {
    const xValues = data.map(row => Number(row[xVar]));

    // Sort by x for line
    const pairs = xValues.map((x, i) => ({ x, pred: predictions[i], actual: y[i] }));
    pairs.sort((a, b) => a.x - b.x);

    const traceActual0 = {
        x: pairs.filter(p => p.actual === 0).map(p => p.x),
        y: pairs.filter(p => p.actual === 0).map(p => p.actual),
        mode: 'markers',
        type: 'scatter',
        name: label0,
        marker: { color: academicColors.primary, size: 8, opacity: 0.7 }
    };

    const traceActual1 = {
        x: pairs.filter(p => p.actual === 1).map(p => p.x),
        y: pairs.filter(p => p.actual === 1).map(p => p.actual),
        mode: 'markers',
        type: 'scatter',
        name: label1,
        marker: { color: academicColors.accent, size: 8, opacity: 0.7 }
    };

    const traceCurve = {
        x: pairs.map(p => p.x),
        y: pairs.map(p => p.pred),
        mode: 'lines',
        type: 'scatter',
        name: '予測確率',
        line: { color: academicColors.palette[3], width: 3 }
    };

    const layout = getAcademicLayout({
        title: '',
        xaxis: { title: xVar },
        yaxis: { title: '', range: [-0.05, 1.05] },
        showlegend: true,
        margin: { l: 60, b: 80, r: 20, t: 40 },
        annotations: []
    });

    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (showAxisLabels) {
        const tategaki = getTategakiAnnotation('予測確率 P(Y=1)');
        if (tategaki) layout.annotations.push(tategaki);
    } else {
        layout.xaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation(`ロジスティック回帰: 予測確率曲線`);
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('logistic-prob-plot', [traceActual0, traceActual1, traceCurve], layout, createPlotlyConfig('ロジスティック回帰', [xVar, '予測確率']));
}

function plotPredictedProbabilitiesMulti(y, predictions, label0, label1) {
    // Box plot of predicted probabilities by actual class
    const prob0 = predictions.filter((_, i) => y[i] === 0);
    const prob1 = predictions.filter((_, i) => y[i] === 1);

    const trace0 = {
        y: prob0,
        type: 'box',
        name: `実測: ${label0}`,
        marker: { color: academicColors.primary }
    };

    const trace1 = {
        y: prob1,
        type: 'box',
        name: `実測: ${label1}`,
        marker: { color: academicColors.accent }
    };

    const layout = getAcademicLayout({
        title: '',
        yaxis: { title: '予測確率 P(Y=1)', range: [-0.05, 1.05] },
        showlegend: true,
        margin: { l: 60, b: 60, r: 20, t: 40 },
        annotations: []
    });

    const titleControl = document.getElementById('show-graph-title');
    if (titleControl?.checked ?? true) {
        layout.title = { text: '予測確率の分布', font: { size: 14 } };
    }

    Plotly.newPlot('logistic-prob-plot', [trace0, trace1], layout, createPlotlyConfig('予測確率分布', ['予測確率']));
}

function plotConfusionMatrixHeatmap(cm, label0, label1) {
    const z = [[cm.tn, cm.fp], [cm.fn, cm.tp]];
    const text = z.map(row => row.map(v => String(v)));

    const trace = {
        z: z,
        x: [label0, label1],
        y: [label0, label1],
        type: 'heatmap',
        colorscale: [[0, '#f0fdf4'], [1, '#22c55e']],
        showscale: false,
        text: text,
        texttemplate: '%{text}',
        hoverinfo: 'none'
    };

    const layout = getAcademicLayout({
        title: '',
        xaxis: { title: '予測値', side: 'bottom' },
        yaxis: { title: '実測値', autorange: 'reversed' },
        margin: { l: 80, b: 80, r: 20, t: 40 },
        annotations: []
    });

    const titleControl = document.getElementById('show-graph-title');
    if (titleControl?.checked ?? true) {
        layout.title = { text: '混同行列ヒートマップ', font: { size: 14 } };
    }

    // Add value annotations
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            layout.annotations.push({
                x: [label0, label1][j],
                y: [label0, label1][i],
                text: String(z[i][j]),
                showarrow: false,
                font: { size: 20, color: z[i][j] > 0 ? '#166534' : '#64748b' }
            });
        }
    }

    Plotly.newPlot('logistic-confusion-plot', [trace], layout, createPlotlyConfig('混同行列', ['予測値', '実測値']));
}

// ==========================================
// Render (Module Entry Point)
// ==========================================

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    // Filter categorical columns with exactly 2 unique values (binary)
    const binaryColumns = categoricalColumns.filter(col => {
        const unique = [...new Set(currentData.map(row => row[col]).filter(v => v != null))];
        return unique.length === 2;
    });
    // Also include numeric columns that might be 0/1
    const binaryNumeric = numericColumns.filter(col => {
        const unique = [...new Set(currentData.map(row => row[col]).filter(v => v != null))];
        return unique.length === 2;
    });
    const allBinaryColumns = [...binaryColumns, ...binaryNumeric];

    container.innerHTML = `
        <div class="logistic-container">
            <div style="background: #7c3aed; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sign-in-alt"></i> ロジスティック回帰分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2値の結果（合否、有無など）を説明変数から予測します</p>
            </div>

            <!-- 分析の概要 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> ロジスティック回帰分析とは？</strong>
                        <p>「あるイベントが起こるかどうか」を予測する分析です。結果が2値（合格/不合格、購入する/しないなど）の場合に使います。</p>
                        <img src="image/logistic_regression.png" alt="ロジスティック回帰分析の説明" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> テスト得点から「合格/不合格」を予測したいとき</li>
                        <li><i class="fas fa-check"></i> 年齢や行動パターンから「購入する/しない」を予測したいとき</li>
                        <li><i class="fas fa-check"></i> どの要因が結果に影響するか（オッズ比）を知りたいとき</li>
                    </ul>
                    <h4>主な指標</h4>
                    <ul>
                        <li><strong>オッズ比 (OR):</strong> 説明変数が1増えると結果が起こる確率が何倍になるかを表します。</li>
                        <li><strong>Nagelkerke R²:</strong> モデルの説明力（0〜1）。大きいほど良いモデルです。</li>
                        <li><strong>正解率:</strong> モデルが正しく分類できた割合です。</li>
                        <li><strong>混同行列:</strong> 正しい予測と誤った予測の内訳を示します。</li>
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
                            <li><strong>モデル:</strong> P(Y=1|X) = σ(β₀ + β₁X₁ + ... + βₚXₚ)</li>
                            <li><strong>推定法:</strong> 反復重み付き最小二乗法 (IRLS)</li>
                            <li><strong>検定:</strong> Wald検定 (z = β / SE(β))</li>
                            <li><strong>適合度:</strong> Nagelkerke R², 対数尤度, 尤度比χ²検定</li>
                            <li><strong>標準誤差:</strong> Fisher情報行列の逆行列から算出</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="logistic-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="logistic-dep-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="logistic-indep-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="logistic-run-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="logistic-analysis-results" style="display: none;">
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                    <div id="logistic-vis-controls"></div>
                </div>
                <div id="logistic-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#logistic-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Dependent variable: binary categorical or numeric
    createVariableSelector('logistic-dep-container', allBinaryColumns, 'logistic-dep-var', {
        label: '<i class="fas fa-bullseye"></i> 目的変数 (Y: 2値変数):',
        multiple: false
    });

    // Independent variables: numeric (multi-select)
    createVariableSelector('logistic-indep-container', numericColumns, 'logistic-indep-var-multiselect', {
        label: '<i class="fas fa-arrow-right"></i> 説明変数 (X: 数値変数):',
        multiple: true
    });

    createAnalysisButton('logistic-run-container', '分析を実行', () => runLogisticRegression(currentData, characteristics), { id: 'run-logistic-btn' });
}
