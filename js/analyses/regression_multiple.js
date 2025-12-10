import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

// 重回帰分析の実行
function runMultipleRegression() {
    const dependentVar = document.getElementById('dependent-var').value;
    const independentVarsSelect = document.getElementById('independent-vars');
    const independentVars = Array.from(independentVarsSelect.selectedOptions).map(option => option.value);

    if (!dependentVar) {
        alert('目的変数を選択してください');
        return;
    }

    if (independentVars.length === 0) {
        alert('説明変数を少なくとも1つ選択してください');
        return;
    }

    if (independentVars.includes(dependentVar)) {
        alert('目的変数と説明変数は異なるものを選択してください');
        return;
    }

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
        alert('有効なデータが不足しています');
        return;
    }

    const n = cleanData.length;
    const k = independentVars.length;
    const yClean = cleanData.map(d => d.y);
    const XClean = cleanData.map(d => [1, ...d.x]); // 定数項の追加

    // 行列計算の実装 (OLS)
    // beta = (X'X)^-1 X'y
    try {
        const XT = math.transpose(XClean);
        const XTX = math.multiply(XT, XClean);
        const XTy = math.multiply(XT, yClean);
        const XTX_inv = math.inv(XTX);
        const beta = math.multiply(XTX_inv, XTy);

        // 予測値と残差
        const yPred = math.multiply(XClean, beta);
        const residuals = math.subtract(yClean, yPred);

        // 統計量の計算
        const rss = math.sum(residuals.map(r => r * r)); // 残差平方和
        const yMean = math.mean(yClean);
        const tss = math.sum(yClean.map(yi => (yi - yMean) ** 2)); // 全変動
        const r2 = 1 - (rss / tss); // 決定係数

        // 自由度調整済み決定係数
        const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k - 1);

        // 標準誤差とt値、p値
        const mse = rss / (n - k - 1);
        const seBeta = math.sqrt(math.diag(math.multiply(mse, XTX_inv)));

        // F値の計算
        const msm = (tss - rss) / k; // 回帰の平均平方
        const fValue = msm / mse;

        // F分布のp値 (自由度 k, n-k-1)
        const fDist = jStat.centralF;
        const pValueModel = 1 - fDist.cdf(fValue, k, n - k - 1);

        // 結果の表示構築
        const resultsContainer = document.getElementById('regression-results');
        resultsContainer.innerHTML = '';

        // モデルの適合度表示
        let summaryHtml = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-check-circle"></i> モデルの適合度
                </h4>
                <div class="data-stats-grid">
                    <div class="data-stat-card">
                        <div class="stat-label">決定係数 (R²)</div>
                        <div class="stat-value">${r2.toFixed(3)}</div>
                    </div>
                    <div class="data-stat-card">
                        <div class="stat-label">自由度調整済み R²</div>
                        <div class="stat-value">${adjR2.toFixed(3)}</div>
                    </div>
                    <div class="data-stat-card">
                        <div class="stat-label">F値</div>
                        <div class="stat-value">${fValue.toFixed(2)}</div>
                    </div>
                    <div class="data-stat-card">
                        <div class="stat-label">モデル有意確率 (p)</div>
                        <div class="stat-value">${pValueModel < 0.001 ? '< 0.001' : pValueModel.toFixed(3)}</div>
                    </div>
                </div>
            </div>
        `;
        resultsContainer.innerHTML += summaryHtml;

        // 偏回帰係数のテーブル
        // 標準化係数の計算
        const yStd = jStat.stdev(yClean, true);
        const xStds = independentVars.map((_, i) => jStat.stdev(cleanData.map(d => d.x[i]), true));
        const standardizedBeta = beta.slice(1).map((b, i) => b * (xStds[i] / yStd));

        let coefTableHtml = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-table"></i> 偏回帰係数
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th>変数</th>
                                <th>非標準化係数 (B)</th>
                                <th>標準誤差 (SE)</th>
                                <th>標準化係数 (β)</th>
                                <th>t値</th>
                                <th>p値</th>
                                <th>有意判定</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // 定数項
        const tValConst = beta[0] / seBeta[0];
        const pValConst = (1 - jStat.studentt.cdf(Math.abs(tValConst), n - k - 1)) * 2;

        coefTableHtml += `
            <tr>
                <td style="font-weight: bold;">(定数項)</td>
                <td>${beta[0].toFixed(3)}</td>
                <td>${seBeta[0].toFixed(3)}</td>
                <td>-</td>
                <td>${tValConst.toFixed(3)}</td>
                <td>${pValConst.toFixed(3)}</td>
                <td>${pValConst < 0.05 ? '<strong style="color: #ef4444;">*</strong>' : ''}</td>
            </tr>
        `;

        // 説明変数
        independentVars.forEach((v, i) => {
            const b = beta[i + 1];
            const se = seBeta[i + 1];
            const betaStd = standardizedBeta[i];
            const t = b / se;
            const p = (1 - jStat.studentt.cdf(Math.abs(t), n - k - 1)) * 2;
            const sig = p < 0.01 ? '**' : (p < 0.05 ? '*' : (p < 0.1 ? '†' : ''));

            coefTableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${v}</td>
                    <td>${b.toFixed(3)}</td>
                    <td>${se.toFixed(3)}</td>
                    <td>${betaStd.toFixed(3)}</td>
                    <td>${t.toFixed(3)}</td>
                    <td>${p.toFixed(3)}</td>
                    <td><strong>${sig}</strong></td>
                </tr>
            `;
        });

        coefTableHtml += `
                        </tbody>
                    </table>
                </div>
                <p style="text-align: right; color: #666; font-size: 0.9rem;">
                    **: p < 0.01, *: p < 0.05, †: p < 0.1
                </p>
            </div>
        `;
        resultsContainer.innerHTML += coefTableHtml;

        // パス図（可視化）
        plotPathDiagram(dependentVar, independentVars, standardizedBeta, r2);

    } catch (e) {
        console.error(e);
        alert('計算エラーが発生しました。データの共線性を確認してください。');
    }

    document.getElementById('analysis-results').style.display = 'block';
}

// パス図の描画 (Plotly)
function plotPathDiagram(dependentVar, independentVars, standardizedCoefs, r2) {
    const container = document.getElementById('plot-area');
    container.innerHTML = '';
    container.style.height = '600px';

    // ノードの座標計算
    // 目的変数を右中央、説明変数を左側に円弧状または垂直に配置
    const xNodes = [];
    const yNodes = [];
    const labels = [];
    const sizes = [];
    const colors = [];

    // 目的変数
    const depX = 1;
    const depY = 0.5;

    independentVars.forEach((v, i) => {
        const yPos = (i + 1) / (independentVars.length + 1);
        xNodes.push(0.2); // 左側
        yNodes.push(1 - yPos); // 上から順に
        labels.push(v);
        sizes.push(40);
        colors.push('#e0f2fe'); // 薄い青
    });

    // 目的変数の追加
    xNodes.push(depX);
    yNodes.push(depY);
    labels.push(dependentVar);
    sizes.push(50);
    colors.push('#1e90ff'); // 濃い青

    // エッジ（矢印）の作成
    const annotations = [];

    independentVars.forEach((v, i) => {
        const coef = standardizedCoefs[i];
        const width = Math.max(1, Math.abs(coef) * 5); // 太さを係数の絶対値に比例
        const color = coef >= 0 ? '#1e90ff' : '#ef4444'; // 正は青、負は赤

        annotations.push({
            x: depX, y: depY,
            xref: 'x', yref: 'y',
            ax: 0.2, ay: 1 - (i + 1) / (independentVars.length + 1),
            axref: 'x', ayref: 'y',
            showarrow: true,
            arrowhead: 2,
            arrowsize: 1.5,
            arrowwidth: width,
            arrowcolor: color
        });

        // 係数の数値をエッジ上に表示
        annotations.push({
            x: (0.2 + depX) / 2,
            y: (1 - (i + 1) / (independentVars.length + 1) + depY) / 2,
            xref: 'x', yref: 'y',
            text: coef.toFixed(2),
            font: { size: 12, color: color, weight: 'bold' },
            showarrow: false,
            bgcolor: 'white',
            bordercolor: color,
            borderwidth: 1,
            borderpad: 2,
            opacity: 0.9
        });
    });

    // R2の表示（誤差項として）
    const eY = depY + 0.2;
    annotations.push({
        x: depX, y: depY,
        ax: depX, ay: eY,
        showarrow: true,
        arrowhead: 2,
        arrowcolor: '#64748b',
        text: `Error`
    });

    annotations.push({
        x: depX, y: eY + 0.05,
        text: `R² = ${r2.toFixed(3)}`,
        showarrow: false,
        font: { size: 14, color: '#64748b' }
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
        hoverinfo: 'text'
    }];

    const layout = {
        title: 'パス図（標準化偏回帰係数）',
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1.2] },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [0, 1] },
        annotations: annotations,
        height: 600,
        margin: { l: 20, r: 20, t: 50, b: 20 },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white'
    };

    Plotly.newPlot('plot-area', data, layout);
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="regression-container">
            <!-- データプレビュー -->
            <div id="regression-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-layer-group"></i> 重回帰分析
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">複数の説明変数を用いて目的変数を予測・分析します</p>
                </div>

                <div class="settings-form">
                    <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="independent-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                    <div id="run-regression-btn-container"></div>
                </div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div id="regression-results"></div>
                <div id="plot-area" style="width: 100%; height: 600px; margin-top: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"></div>
            </div>
        </div>
    `;

    renderDataOverview('#regression-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 目的変数 (Single Select)
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-bullseye"></i> 目的変数（予測したい変数）を選択:',
        multiple: false
    });

    // 説明変数 (Multi Select) - using the utility with toggle
    createVariableSelector('independent-vars-container', numericColumns, 'independent-vars', {
        label: '<i class="fas fa-list"></i> 説明変数（予測に使う変数）を選択（複数選択可）:',
        multiple: true
    });

    createAnalysisButton('run-regression-btn-container', '重回帰分析を実行', runMultipleRegression, { id: 'run-regression-btn' });
}