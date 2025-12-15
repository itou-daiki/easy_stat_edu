import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls } from '../utils.js';

// 重回帰分析の実行
function runMultipleRegression(currentData) {
    const dependentVarsSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarsSelect.selectedOptions).map(option => option.value);

    const independentVarsSelect = document.getElementById('independent-vars');
    const independentVars = Array.from(independentVarsSelect.selectedOptions).map(option => option.value);

    if (dependentVars.length === 0) {
        alert('目的変数を少なくとも1つ選択してください');
        return;
    }

    if (independentVars.length === 0) {
        alert('説明変数を少なくとも1つ選択してください');
        return;
    }

    // Check for overlap
    const overlap = dependentVars.filter(v => independentVars.includes(v));
    if (overlap.length > 0) {
        alert(`変数 "${overlap.join(', ')}" が目的変数と説明変数の両方に含まれています。異なるものを選択してください。`);
        return;
    }

    const resultsContainer = document.getElementById('regression-results');
    resultsContainer.innerHTML = '';

    // Plot area container (combined)
    const plotAreaId = 'plot-area';
    const plotContainer = document.getElementById(plotAreaId);
    if (plotContainer) plotContainer.innerHTML = ''; // Clear previous

    const methodOverview = document.querySelector('.collapsible-section');
    if (methodOverview && methodOverview.classList.contains('collapsed')) {
        // Keep it collapsed or maybe don't touch it.
    }

    const allResults = []; // To store data for combined path diagram

    let hasError = false;

    // Iterate through each dependent variable
    dependentVars.forEach((dependentVar, idx) => {
        try {
            // データの準備
            const y = currentData.map(row => row[dependentVar]);
            const X = currentData.map(row => independentVars.map(v => row[v]));

            // 欠損値の除去
            const cleanData = [];
            for (let i = 0; i < y.length; i++) {
                const rowX = X[i];
                if (y[i] != null && !isNaN(y[i]) && rowX.every(v => v != null && !isNaN(v))) {
                    cleanData.push({ y: y[i], x: rowX });
                }
            }

            if (cleanData.length < independentVars.length + 2) {
                resultsContainer.innerHTML += `<div class="error-box">変数 <strong>${dependentVar}</strong>: 有効なデータが不足しています</div>`;
                hasError = true;
                return;
            }

            const n = cleanData.length;
            const k = independentVars.length;
            const yClean = cleanData.map(d => d.y);
            const XClean = cleanData.map(d => [1, ...d.x]); // 定数項の追加

            // 行列計算 (OLS)
            const XT = math.transpose(XClean);
            const XTX = math.multiply(XT, XClean);
            const XTy = math.multiply(XT, yClean);
            const XTX_inv = math.inv(XTX);
            const beta = math.multiply(XTX_inv, XTy);

            // 統計量
            const yPred = math.multiply(XClean, beta);
            const residuals = math.subtract(yClean, yPred);
            const rss = math.sum(residuals.map(r => r * r));
            const yMean = math.mean(yClean);
            const tss = math.sum(yClean.map(yi => (yi - yMean) ** 2));
            const r2 = 1 - (rss / tss);
            const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k - 1);
            const mse = rss / (n - k - 1);
            const seBeta = math.map(math.diag(math.multiply(mse, XTX_inv)), math.sqrt);
            const msm = (tss - rss) / k;
            const fValue = msm / mse;
            const pValueModel = 1 - jStat.centralF.cdf(fValue, k, n - k - 1);

            // 標準化係数の計算
            const yStd = jStat.stdev(yClean, true);
            const xStds = independentVars.map((_, i) => jStat.stdev(cleanData.map(d => d.x[i]), true));
            const standardizedBeta = beta.slice(1).map((b, i) => b * (xStds[i] / yStd));

            // Store result
            allResults.push({
                dependentVar,
                r2,
                adjR2,
                fValue,
                pValueModel,
                beta,
                standardizedBeta,
                n
            });

            // HTML Output Construction
            let sectionHtml = `
                <div style="margin-bottom: 3rem; border-top: 4px solid #1e90ff; padding-top: 1rem;">
                    <h3 style="color: #2d3748; margin-bottom: 1rem;">
                        <i class="fas fa-bullseye"></i> 目的変数: <span style="color: #1e90ff;">${dependentVar}</span>
                    </h3>
                    
                    <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                         <div class="data-stat-card">
                            <div class="stat-label">決定係数 (R²)</div>
                            <div class="stat-value">${r2.toFixed(3)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">調整済み R²</div>
                            <div class="stat-value">${adjR2.toFixed(3)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">F値</div>
                            <div class="stat-value">${fValue.toFixed(2)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">有意確率 (p)</div>
                            <div class="stat-value">${pValueModel < 0.001 ? '< 0.001' : pValueModel.toFixed(3)}</div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead style="background: #f8f9fa;">
                                <tr>
                                    <th>説明変数</th>
                                    <th>非標準化係数 (B)</th>
                                    <th>標準誤差 (SE)</th>
                                    <th>標準化係数 (β)</th>
                                    <th>t値</th>
                                    <th>p値</th>
                                    <th>判定</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Const Row
            const tValConst = beta[0] / seBeta[0];
            const pValConst = (1 - jStat.studentt.cdf(Math.abs(tValConst), n - k - 1)) * 2;
            sectionHtml += `
                <tr>
                    <td style="color:#666;">(定数項)</td>
                    <td>${beta[0].toFixed(3)}</td>
                    <td>${seBeta[0].toFixed(3)}</td>
                    <td>-</td>
                    <td>${tValConst.toFixed(3)}</td>
                    <td>${pValConst.toFixed(3)}</td>
                    <td>${pValConst < 0.05 ? '*' : ''}</td>
                </tr>
            `;

            // Vars Rows
            independentVars.forEach((v, i) => {
                const b = beta[i + 1];
                const se = seBeta[i + 1];
                const betaStd = standardizedBeta[i];
                const t = b / se;
                const p = (1 - jStat.studentt.cdf(Math.abs(t), n - k - 1)) * 2;
                const sig = p < 0.01 ? '**' : (p < 0.05 ? '*' : (p < 0.1 ? '†' : ''));

                sectionHtml += `
                    <tr>
                        <td style="font-weight: bold; color: #2d3748;">${v}</td>
                        <td>${b.toFixed(3)}</td>
                        <td>${se.toFixed(3)}</td>
                        <td>${betaStd.toFixed(3)}</td>
                        <td>${t.toFixed(3)}</td>
                        <td>${p.toFixed(3)}</td>
                        <td><strong style="color: ${p < 0.05 ? '#e53e3e' : '#718096'}">${sig}</strong></td>
                    </tr>
                `;
            });

            sectionHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            resultsContainer.innerHTML += sectionHtml;

        } catch (e) {
            console.error(e);
            resultsContainer.innerHTML += `<div class="error-box">変数 <strong>${dependentVar}</strong> の計算中にエラーが発生しました。</div>`;
            hasError = true;
        }
    });

    // Combined Path Diagram
    if (allResults.length > 0 && !hasError) {
        plotCombinedPathDiagram(independentVars, allResults);
    }

    document.getElementById('analysis-results').style.display = 'block';

    // 軸ラベルの動的切り替え (再描画)
    createVisualizationControls('axis-label-control-container');
    const axisControl = document.getElementById('show-axis-labels');
    if (axisControl) {
        axisControl.onchange = () => {
            if (allResults.length > 0 && !hasError) {
                plotCombinedPathDiagram(independentVars, allResults);
            }
        };
    }
}

// Combined Path Diagram (Plotly)
function plotCombinedPathDiagram(independentVars, allResults) {
    const container = document.getElementById('plot-area');
    // Adjust height based on number of varibles
    const totalVars = independentVars.length + allResults.length;
    const height = Math.max(600, totalVars * 50);
    container.style.height = `${height}px`;

    const xNodes = [];
    const yNodes = [];
    const labels = [];
    const sizes = [];
    const colors = [];
    const annotations = [];

    // Layout: Independent on Left (x=0.2), Dependent on Right (x=0.8)

    // Independent Vars (Left)
    independentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (independentVars.length + 1);
        xNodes.push(0.2);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(40);
        colors.push('#e0f2fe'); // Light Blue
    });

    // Dependent Vars (Right)
    const dependentVars = allResults.map(r => r.dependentVar);
    dependentVars.forEach((v, i) => {
        const yPos = 1 - (i + 1) / (dependentVars.length + 1);
        xNodes.push(0.8);
        yNodes.push(yPos);
        labels.push(v);
        sizes.push(50);
        colors.push('#1e90ff'); // Dark Blue

        // Stats Annotation near Dependent Var
        const res = allResults[i];
        const r2 = res.r2;
        const fVal = res.fValue;
        const pVal = res.pValueModel;
        const n = res.n;
        const k = independentVars.length;
        const df1 = k;
        const df2 = n - k - 1;

        let pText = pVal < 0.001 ? 'p<.001' : `p=${pVal.toFixed(3)}`;

        annotations.push({
            x: 0.8,
            y: yPos - 0.06,
            text: `R²=${r2.toFixed(2)}<br>F(${df1},${df2})=${fVal.toFixed(2)}<br>${pText}`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 10, color: '#64748b' },
            align: 'center'
        });
    });

    // Edges (Arrows)
    // Draw arrows from each Indep to each Dep using standardized beta
    independentVars.forEach((indName, i) => {
        const indY = 1 - (i + 1) / (independentVars.length + 1);

        dependentVars.forEach((depName, j) => {
            const depY = 1 - (j + 1) / (dependentVars.length + 1);
            const result = allResults[j];
            const betaStd = result.standardizedBeta[i];

            // Only draw lines for meaningful relationships? Or all?
            // Let's draw all but change opacity/width based on magnitude
            const absBeta = Math.abs(betaStd);
            if (absBeta < 0.1) return; // Skip very weak links to reduce clutter

            const width = Math.max(1, absBeta * 4);
            const color = betaStd >= 0 ? '#3182ce' : '#e53e3e'; // Blue / Red

            // Arrow
            annotations.push({
                x: 0.76, y: depY, // End slightly before node
                xref: 'x', yref: 'y',
                ax: 0.24, ay: indY, // Start slightly after node
                axref: 'x', ayref: 'y',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: width,
                arrowcolor: color,
                opacity: 0.8
            });

            // Label on line (midpoint)
            annotations.push({
                x: (0.24 + 0.76) / 2,
                y: (indY + depY) / 2,
                text: betaStd.toFixed(2),
                font: { size: 10, color: color, weight: 'bold' },
                showarrow: false,
                bgcolor: 'white',
                opacity: 0.9
            });
        });
    });

    const data = [{
        x: xNodes,
        y: yNodes,
        mode: 'text+markers',
        text: labels,
        textposition: 'middle center',
        marker: {
            size: sizes,
            color: colors,
            line: { color: 'white', width: 2 }
        },
        type: 'scatter',
        hoverinfo: 'none'
    }];

    const layout = {
        title: 'パス図（標準化偏回帰係数: |β| >= 0.1 のみ表示）',
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1.2] },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1] },
        annotations: annotations,
        height: height,
        margin: { l: 20, r: 20, t: 50, b: 20 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };

    // 軸ラベルの表示切り替え（パス図では元々ラベル非表示だが、一貫性のためにトグル状態をチェック）
    const showAxisLabels = document.getElementById('show-axis-labels').checked;
    if (!showAxisLabels) {
        // もしタイトルが設定されていたらクリアする（この図では設定されていないが）
        if (layout.xaxis.title) layout.xaxis.title = '';
        if (layout.yaxis.title) layout.yaxis.title = '';
    }

    Plotly.newPlot('plot-area', data, layout, createPlotlyConfig('重回帰分析_パス図', independentVars.concat(dependentVars)));
}

export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="regression-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-layer-group"></i> 重回帰分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">複数の変数から目的変数を予測します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 重回帰分析とパス図</strong>
                        <p>複数の説明変数を使って、1つまたは複数の目的変数を予測します。パス図では、変動への影響度（標準化係数）を矢印の太さや数値で可視化します。</p>
                        <p>※ パス図には、影響がある程度強い関係（|β| ≥ 0.1）のみが表示されます。</p>
                    </div>
                </div>
            </div>

            <!-- データプレビュー -->
            <div id="regression-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="settings-form">
                
                    <!-- 軸ラベル表示オプション (Moved) -->
                    <!-- <div id="axis-label-control-container"></div> -->

                    <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="independent-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-regression-btn-container"></div>
                </div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <!-- 軸ラベル表示オプション -->
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="axis-label-control-container"></div>
                </div>

                <div id="regression-results"></div>
                <!-- Combined Plot Area -->
                <div id="plot-area" style="width: 100%; height: 600px; margin-top: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); background: white;"></div>
            </div>
        </div>
    `;

    renderDataOverview('#regression-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 軸ラベル表示オプションの追加 (Moved logic to runMultipleRegression)
    // createAxisLabelControl('axis-label-control-container');

    // 目的変数 (Multiple Select)
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-bullseye"></i> 目的変数（予測したい変数）を選択（複数可）:',
        multiple: true
    });

    // 説明変数 (Multi Select)
    createVariableSelector('independent-vars-container', numericColumns, 'independent-vars', {
        label: '<i class="fas fa-list"></i> 説明変数（予測に使う変数）を選択（複数可）:',
        multiple: true
    });

    createAnalysisButton('run-regression-btn-container', '分析を実行', () => runMultipleRegression(currentData), { id: 'run-regression-btn' });
}