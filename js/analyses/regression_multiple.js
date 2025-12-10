import { currentData, dataCharacteristics } from '../main.js';
import { showError, renderDataOverview } from '../utils.js';

// --- Matrix Helper Functions ---
const mat = {
    transpose: (A) => A[0].map((_, c) => A.map(r => r[c])),
    mmul: (A, B) => {
        const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
        return result.map((row, i) => row.map((_, j) => {
            return A[i].reduce((sum, elm, k) => sum + elm * B[k][j], 0);
        }));
    },
    // Using jStat.inv for matrix inversion
    inv: (A) => jStat.inv(A),
    identity: (n) => Array(n).fill(0).map((_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0))
};

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    // データ概要の表示（共通関数）
    const overviewContainerId = 'mreg-data-overview';
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
                        <i class="fas fa-bullseye" style="color: #1e90ff;"></i> 目的変数 (Y):
                    </label>
                    <select id="mreg-y-var" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e0; border-radius: 6px;">
                        ${numericColumns.map(col => `<option value="${col}">${col}</option>`).join('')}
                    </select>
                </div>
                
                <div class="control-group" style="margin-bottom: 1.5rem;">
                    <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-layer-group" style="color: #1e90ff;"></i> 説明変数 (X):
                    </label>
                    <div id="mreg-x-group" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                        ${numericColumns.map(col => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" name="mreg-vars" value="${col}" style="cursor: pointer;"> ${col}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div class="control-group" style="margin-bottom: 1.5rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; cursor: pointer;">
                        <input type="checkbox" id="mreg-interactions" style="width: 1.2rem; height: 1.2rem;"> 交互作用項を含める (2変数の積)
                    </label>
                </div>
                
                <div id="interaction-selector" style="display:none; margin-bottom: 1.5rem; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 6px; background: #f8fafc;">
                    <label style="font-weight: bold; color: #4a5568; display: block; margin-bottom: 0.5rem;">交互作用ペアを選択:</label>
                    <div id="interaction-pairs" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;"></div>
                </div>
                
                <button id="run-mreg-btn" class="btn-analysis" style="width: 100%; padding: 1rem; background: #1e90ff; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: background 0.2s;">
                    <i class="fas fa-calculator"></i> 分析を実行
                </button>
            </div>
        </div>
        
        <div id="mreg-results" class="analysis-results" style="margin-top: 2rem;"></div>
    `;

    renderDataOverview(`#${overviewContainerId}`, currentData, characteristics, { initiallyCollapsed: true });

    // Interaction UI logic
    const xGroup = document.getElementById('mreg-x-group');
    const interactionCheck = document.getElementById('mreg-interactions');
    const interactionSelector = document.getElementById('interaction-selector');
    const interactionPairsDiv = document.getElementById('interaction-pairs');

    const updateInteractions = () => {
        if (!interactionCheck.checked) {
            interactionSelector.style.display = 'none';
            return;
        }
        const selectedX = Array.from(document.querySelectorAll('input[name="mreg-vars"]:checked')).map(cb => cb.value);
        if (selectedX.length < 2) {
            interactionPairsDiv.innerHTML = '<small style="color: #64748b;">説明変数を2つ以上選択してください。</small>';
            interactionSelector.style.display = 'block';
            return;
        }

        interactionSelector.style.display = 'block';
        let html = '';
        for (let i = 0; i < selectedX.length; i++) {
            for (let j = i + 1; j < selectedX.length; j++) {
                const pair = `${selectedX[i]} × ${selectedX[j]}`;
                const val = `${selectedX[i]}|${selectedX[j]}`;
                html += `<label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;"><input type="checkbox" name="mreg-int-pair" value="${val}" checked> ${pair}</label>`;
            }
        }
        interactionPairsDiv.innerHTML = html;
    };

    xGroup.addEventListener('change', updateInteractions);
    interactionCheck.addEventListener('change', updateInteractions);

    document.getElementById('run-mreg-btn').addEventListener('click', () => {
        const yVar = document.getElementById('mreg-y-var').value;
        const xVars = Array.from(document.querySelectorAll('input[name="mreg-vars"]:checked')).map(cb => cb.value);
        const intPairs = Array.from(document.querySelectorAll('input[name="mreg-int-pair"]:checked')).map(cb => cb.value);

        if (xVars.length < 1) {
            showError('説明変数を1つ以上選択してください。');
            return;
        }
        if (xVars.includes(yVar)) {
            showError('目的変数と説明変数が重複しています。');
            return;
        }

        runMultipleRegression(xVars, yVar, intPairs);
    });
}

function runMultipleRegression(xVars, yVar, intPairs) {
    const resultsContainer = document.getElementById('mreg-results');
    resultsContainer.innerHTML = `
        <div style="background: #1e90ff; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; font-size: 1.25rem;">
                <i class="fas fa-chart-line"></i> 分析結果: ${yVar}
            </h3>
        </div>
    `;

    // Data Preparation
    const validData = currentData.filter(row =>
        row[yVar] != null && !isNaN(row[yVar]) &&
        xVars.every(v => row[v] != null && !isNaN(row[v]))
    );

    const n = validData.length;
    const numX = xVars.length + (intPairs ? intPairs.length : 0);

    if (n < numX + 2) {
        resultsContainer.innerHTML += `<div class="error-message">データが不足しています（データ数 ${n} < 必要数 ${numX + 2}）。</div>`;
        return;
    }

    // Build Matrices
    const Y = validData.map(r => [Number(r[yVar])]);
    const X = validData.map(r => {
        const row = [1]; // Intercept
        xVars.forEach(v => row.push(Number(r[v])));
        if (intPairs) {
            intPairs.forEach(pair => {
                const [v1, v2] = pair.split('|');
                row.push(Number(r[v1]) * Number(r[v2]));
            });
        }
        return row;
    });

    const xNames = ['(定数項)', ...xVars, ...(intPairs || []).map(p => p.replace('|', '×'))];

    // --- Statistics Calculations ---
    try {
        const XT = mat.transpose(X);
        const XTX = mat.mmul(XT, X);
        const XTX_inv = mat.inv(XTX); // May fail if singular
        const XTY = mat.mmul(XT, Y);
        const Beta = mat.mmul(XTX_inv, XTY); // (p+1)x1

        const coeffs = Beta.map(r => r[0]);

        // Predictions & Residuals
        const Y_pred = mat.mmul(X, Beta);
        const residuals = Y.map((y, i) => y[0] - Y_pred[i][0]);

        // Sum of Squares
        const yMean = jStat.mean(Y.map(r => r[0]));
        const ssTotal = Y.reduce((acc, y) => acc + (y[0] - yMean) ** 2, 0);
        const ssRes = residuals.reduce((acc, r) => acc + r ** 2, 0);
        const ssReg = ssTotal - ssRes;

        // Statistics
        const p = numX;
        const dfReg = p;
        const dfRes = n - p - 1;
        const msReg = ssReg / dfReg;
        const msRes = dfRes > 0 ? ssRes / dfRes : 0;

        const fStat = msRes > 0 ? msReg / msRes : 0;
        const pMod = msRes > 0 ? (1.0 - jStat.centralF.cdf(fStat, dfReg, dfRes)) : 1.0;

        const rSquared = ssTotal > 0 ? ssReg / ssTotal : 0;
        const adjR2 = 1 - (1 - rSquared) * (n - 1) / (dfRes);
        const rmse = Math.sqrt(msRes);

        // Standard Errors & t-tests
        const varBeta = XTX_inv.map(row => row.map(val => val * msRes));
        const seBeta = varBeta.map((row, i) => Math.sqrt(row[i]));
        const tStat = coeffs.map((b, i) => seBeta[i] > 0 ? b / seBeta[i] : 0);
        const pValues = tStat.map(t => dfRes > 0 ? (1.0 - jStat.studentt.cdf(Math.abs(t), dfRes)) * 2.0 : 1.0);

        // Standardized Coefficients
        const sdY = jStat.stdev(Y.map(r => r[0]), true);
        const stdCoefs = coeffs.map((b, i) => {
            if (i === 0) return 0;
            const xVals = X.map(r => r[i]);
            const sdX = jStat.stdev(xVals, true);
            return b * (sdX / sdY);
        });

        const getSig = (pv) => {
            if (pv < 0.01) return '**';
            if (pv < 0.05) return '*';
            if (pv < 0.1) return '†';
            return 'n.s.';
        };

        // --- Render Output ---

        // 1. Model Fit Table
        let html = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-check-circle"></i> モデルの適合度
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>指標</th><th>値</th><th>備考</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>決定係数 (R²)</td><td><strong>${rSquared.toFixed(4)}</strong></td><td>1に近いほど説明力が高い</td></tr>
                            <tr><td>調整済み R²</td><td>${adjR2.toFixed(4)}</td><td>説明変数の数を考慮した適合度</td></tr>
                            <tr><td>RMSE</td><td>${rmse.toFixed(4)}</td><td>予測誤差の標準偏差</td></tr>
                            <tr><td>F値</td><td>${fStat.toFixed(4)}</td><td>(p = ${pMod.toExponential(4)} ${getSig(pMod)})</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // 2. Coefficients Table
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-list-ol"></i> 偏回帰係数
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr>
                                <th>変数</th>
                                <th>係数(B)</th>
                                <th>標準化係数(β)</th>
                                <th>標準誤差(SE)</th>
                                <th>t値</th>
                                <th>p値</th>
                                <th>判定</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        xNames.forEach((name, i) => {
            html += `<tr>
                <td style="font-weight: 500;">${name}</td>
                <td>${coeffs[i].toFixed(4)}</td>
                <td>${i === 0 ? '-' : stdCoefs[i].toFixed(4)}</td>
                <td>${seBeta[i].toFixed(4)}</td>
                <td>${tStat[i].toFixed(4)}</td>
                <td>${pValues[i].toExponential(4)}</td>
                <td><span class="badge ${getSig(pValues[i]) === 'n.s.' ? 'badge-secondary' : 'badge-primary'}">${getSig(pValues[i])}</span></td>
            </tr>`;
        });
        html += '</tbody></table></div>';

        // Model Equation
        let eq = `${yVar} = ${coeffs[0].toFixed(4)}`;
        for (let i = 1; i < coeffs.length; i++) {
            const op = coeffs[i] >= 0 ? '+' : '-';
            eq += ` ${op} ${Math.abs(coeffs[i]).toFixed(4)} × ${xNames[i]}`;
        }
        html += `
            <div style="margin-top: 1rem; padding: 1rem; background: #f0f9ff; border-left: 4px solid #1e90ff; border-radius: 4px;">
                <p style="margin: 0; font-family: monospace; font-size: 1.1em; color: #0c4a6e;"><strong>モデル式:</strong> ${eq}</p>
            </div>
        </div>`;

        resultsContainer.innerHTML += html;

        // Container for Plots
        const gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
        gridContainer.style.gap = '1.5rem';
        resultsContainer.appendChild(gridContainer);

        // 3. Path Diagram (New Feature)
        const pathDiv = document.createElement('div');
        pathDiv.id = 'mreg-path-diagram';
        pathDiv.style.background = 'white';
        pathDiv.style.padding = '1.5rem';
        pathDiv.style.borderRadius = '8px';
        pathDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        pathDiv.innerHTML = '<h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> パス図 (影響度の可視化)</h4><div id="path-plot-content"></div>';
        gridContainer.appendChild(pathDiv);

        plotPathDiagram('path-plot-content', xNames.slice(1), yVar, stdCoefs.slice(1));

        // 4. Influence Plot
        const influenceDiv = document.createElement('div');
        influenceDiv.id = 'mreg-plot-influence';
        influenceDiv.style.background = 'white';
        influenceDiv.style.padding = '1.5rem';
        influenceDiv.style.borderRadius = '8px';
        influenceDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        gridContainer.appendChild(influenceDiv);

        const infX = xNames.slice(1);
        const infY = stdCoefs.slice(1);
        const infData = infX.map((n, i) => ({ n, v: Math.abs(infY[i]), original: infY[i] })).sort((a, b) => b.v - a.v);

        Plotly.newPlot('mreg-plot-influence', [{
            x: infData.map(d => d.n),
            y: infData.map(d => d.original),
            type: 'bar', marker: { color: '#1e90ff' }
        }], {
            title: '変数の影響度 (標準化係数 β)',
            yaxis: { title: '標準化係数' },
            font: { family: 'Inter, sans-serif' },
            margin: { t: 40, l: 50, r: 20, b: 50 }
        });

        // 5. Pred vs Actual
        const predDiv = document.createElement('div');
        predDiv.id = 'mreg-plot-pred';
        predDiv.style.background = 'white';
        predDiv.style.padding = '1.5rem';
        predDiv.style.borderRadius = '8px';
        predDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        gridContainer.appendChild(predDiv);

        Plotly.newPlot('mreg-plot-pred', [{
            x: Y_pred.map(r => r[0]),
            y: Y.map(r => r[0]),
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#1e90ff', size: 8, opacity: 0.6 },
            name: 'データ点'
        }, {
            x: [Math.min(...Y_pred), Math.max(...Y_pred)],
            y: [Math.min(...Y_pred), Math.max(...Y_pred)],
            mode: 'lines',
            type: 'scatter',
            line: { color: '#94a3b8', dash: 'dash' },
            name: '理想線'
        }], {
            title: '予測値 vs 実測値',
            xaxis: { title: '予測値' },
            yaxis: { title: '実測値' },
            showlegend: false
        });

        // 6. Residual Plot
        const resDiv = document.createElement('div');
        resDiv.id = 'mreg-plot-res';
        resDiv.style.background = 'white';
        resDiv.style.padding = '1.5rem';
        resDiv.style.borderRadius = '8px';
        resDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        gridContainer.appendChild(resDiv);

        Plotly.newPlot('mreg-plot-res', [{
            x: Y_pred.map(r => r[0]),
            y: residuals,
            mode: 'markers',
            type: 'scatter',
            marker: { color: '#64748b', size: 8, opacity: 0.6 }
        }, {
            x: [Math.min(...Y_pred), Math.max(...Y_pred)],
            y: [0, 0],
            mode: 'lines', line: { color: '#000000' }
        }], {
            title: '残差プロット',
            xaxis: { title: '予測値' },
            yaxis: { title: '残差' },
            showlegend: false
        });

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<div class="error-message">計算中にエラーが発生しました。多重共線性が疑われるか、データが不適切です。<br>詳細: ${e.message}</div>`;
    }
}

// Function to draw Path Diagram (mimicking networkx style in Python reference)
function plotPathDiagram(containerId, predictors, target, weights) {
    const xNodes = [];
    const yNodes = [];
    const annotations = [];

    // Layout positions
    // Predictors on left (x=0), Target on right (x=1)
    const numPred = predictors.length;
    predictors.forEach((p, i) => {
        // Distribute vertically centered
        const yPos = numPred > 1 ? (i / (numPred - 1)) : 0.5;
        xNodes.push(0.1); // slightly indented
        yNodes.push(1 - yPos); // Top to bottom
    });

    // Target node centered vertically
    const targetX = 0.9;
    const targetY = 0.5;

    // Create Edges (Annotations)
    weights.forEach((w, i) => {
        const weight = Math.abs(w);
        // Only draw if significant enough (threshold like in Python ref 0.1, or all)
        // Python ref uses standardized coefs for width
        const width = Math.max(1, Math.min(weight * 5, 8)); // scale width
        const color = w >= 0 ? '#1e90ff' : '#ef4444'; // Blue for +, Red for -

        annotations.push({
            x: targetX - 0.05, y: targetY, // End point (Target) with offset
            ax: xNodes[i] + 0.05, ay: yNodes[i], // Start point (Predictor) with offset
            xref: 'x', yref: 'y', axref: 'x', ayref: 'y',
            showarrow: true,
            arrowhead: 2,
            arrowsize: 1.5,
            arrowwidth: width,
            arrowcolor: color,
            text: w.toFixed(2),
            font: { color: color, size: 12, weight: 'bold' },
            startstandoff: 5
        });
    });

    // Create Node Traces
    const nodeTrace = {
        x: [...xNodes, targetX],
        y: [...yNodes, targetY],
        text: [...predictors, target],
        mode: 'markers+text',
        textposition: [...xNodes.map(() => 'middle left'), 'middle right'],
        marker: {
            size: 40,
            color: ['#f0f9ff', ...Array(numPred - 1).fill('#f0f9ff'), '#e0f2fe'],
            line: { color: '#1e90ff', width: 2 }
        },
        type: 'scatter',
        hoverinfo: 'text'
    };

    const layout = {
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.2, 1.2] },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.2, 1.2] },
        annotations: annotations,
        margin: { l: 20, r: 20, t: 20, b: 20 },
        height: Math.max(400, numPred * 60) // Dynamic height
    };

    Plotly.newPlot(containerId, [nodeTrace], layout);
}