import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';
import { calculateCorrelationMatrix } from './correlation.js';

// 因子抽出（主因子法）
function exactFactors(variables, numFactors, currentData) {
    const data = currentData.map(row => variables.map(v => row[v]));
    // 実際には多変量解析ライブラリが必要だが、jStatやmath.jsだけでは困難。
    // ここではPCAをベースにした簡易的なエミュレーションを行う
    // 本来の因子分析は共通性の推定などが必要

    // 1. 相関行列の計算 (共通化された関数を利用)
    const corrMatrix = calculateCorrelationMatrix(variables, currentData);

    // 2. 固有値分解 (math.eigs)
    const { values, vectors } = math.eigs(corrMatrix);

    // 固有値の降順ソート
    const indices = Array.from(values.keys()).sort((a, b) => values[b] - values[a]);
    const sortedValues = indices.map(i => values[i]);
    const sortedVectors = indices.map(i => math.column(vectors, i)); // vectors in math.js are col-wise

    // 抽出された因子数分だけ取得
    // 因子負荷量 = 固有ベクトル * sqrt(固有値)
    const loadings = [];
    for (let i = 0; i < variables.length; i++) {
        const row = [];
        for (let f = 0; f < numFactors; f++) {
            const eigVal = sortedValues[f];
            const eigVec = sortedVectors[f][i]; // i-th variable, f-th factor
            row.push(eigVec * Math.sqrt(eigVal));
        }
        loadings.push(row);
    }

    return { loadings, eigenvalues: sortedValues };
}

function runFactorAnalysis(currentData) {
    const varsSelect = document.getElementById('factor-vars');
    const variables = Array.from(varsSelect.selectedOptions).map(o => o.value);
    const numFactors = parseInt(document.getElementById('num-factors').value, 10);

    if (variables.length < 3) {
        alert('変数を3つ以上選択してください');
        return;
    }
    if (isNaN(numFactors) || numFactors < 1) {
        alert('因子数を正しく指定してください');
        return;
    }

    try {
        const { loadings, eigenvalues } = exactFactors(variables, numFactors, currentData);

        displayEigenvalues(eigenvalues);
        displayLoadings(variables, loadings);
        plotScree(eigenvalues);
        plotLoadingsHeatmap(variables, loadings);

        document.getElementById('analysis-results').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert('計算中にエラーが発生しました。データを確認してください。');
    }
}

function displayEigenvalues(eigenvalues) {
    const container = document.getElementById('eigenvalues-table');
    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>主成分</th>
                        <th>固有値</th>
                        <th>寄与率 (%)</th>
                        <th>累積寄与率 (%)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const total = eigenvalues.length; // In PCA of a correlation matrix, total variance is number of variables
    let cumulative = 0;

    eigenvalues.forEach((val, i) => {
        const contribution = (val / total) * 100;
        cumulative += contribution;

        // 1以上を強調 (カイザー基準)
        const style = val >= 1.0 ? 'font-weight: bold; color: #1e90ff;' : '';

        html += `
            <tr style="${style}">
                <td>第${i + 1}主成分</td>
                <td>${val.toFixed(3)}</td>
                <td>${contribution.toFixed(2)}</td>
                <td>${cumulative.toFixed(2)}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function displayLoadings(variables, loadings) {
    const container = document.getElementById('loadings-table');
    const numFactors = loadings[0].length;

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${Array.from({ length: numFactors }, (_, i) => `<th>第${i + 1}主成分</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((v, i) => {
        html += `<tr><td><strong>${v}</strong></td>`;
        loadings[i].forEach(l => {
            const style = Math.abs(l) > 0.4 ? 'background: rgba(30, 144, 255, 0.1); font-weight: bold;' : '';
            html += `<td style="${style}">${l.toFixed(3)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function plotScree(eigenvalues) {
    const trace = {
        x: eigenvalues.map((_, i) => i + 1),
        y: eigenvalues,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#1e90ff', width: 2 },
        marker: { size: 8 }
    };

    // 基準線 (Eigenvalue = 1)
    const shape = {
        type: 'line',
        x0: 1, y0: 1,
        x1: eigenvalues.length, y1: 1,
        line: { color: '#ef4444', width: 2, dash: 'dash' }
    };

    const layout = {
        title: 'スクリープロット',
        xaxis: { title: '主成分番号' },
        yaxis: { title: '固有値' },
        shapes: [shape]
    };

    Plotly.newPlot('scree-plot', [trace], layout, createPlotlyConfig('主成分分析_スクリープロット', []));
}

function plotLoadingsHeatmap(variables, loadings) {
    // 転置して (Component x Variable) にする
    const z = loadings[0].map((_, colIndex) => loadings.map(row => row[colIndex]));
    const components = Array.from({ length: loadings[0].length }, (_, i) => `第${i + 1}主成分`);

    const data = [{
        z: z,
        x: variables,
        y: components,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmin: -1,
        zmax: 1
    }];

    const layout = {
        title: '主成分負荷量ヒートマップ',
        height: 300 + (components.length * 30),
        xaxis: { side: 'bottom' }
    };

    Plotly.newPlot('loadings-heatmap', data, layout, createPlotlyConfig('主成分分析_負荷量', variables));
}


export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="factor-analysis-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 主成分分析 (PCA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">多数の変数を、より少数の合成変数（主成分）に要約します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 主成分分析 (Principal Component Analysis) とは？</strong>
                        <p>多数の変数間の相関関係を利用して、情報をできるだけ失わずに変数をより少数の「主成分」に要約する手法です。データの次元削減や、変数群の構造を大まかに把握するために用いられます。</p>
                        <img src="image/pca.png" alt="主成分分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>多数のアンケート項目を、少数の指標（例：「顧客満足度」「デザイン評価」）にまとめたい</li>
                        <li>多変量データの情報を二次元に圧縮して可視化したい</li>
                    </ul>
                    <h4>主な用語</h4>
                    <ul>
                        <li><strong>主成分負荷量:</strong> 各変数がその主成分とどれくらい強く関係しているかを示す値。主成分の解釈に用います。</li>
                        <li><strong>固有値:</strong> 各主成分がどれだけの情報（分散）を説明しているかを示す値。</li>
                        <li><strong>スクリープロット:</strong> 採用する主成分の数を決めるためのグラフ（固有値が1以上、または「肘」のように急に落ち込む前までを採用することが多い）。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="fa-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="factor-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                     <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                         <i class="fas fa-sort-numeric-up"></i> 抽出する主成分の数:
                     </label>
                     <input type="number" id="num-factors" value="2" min="1" max="10" style="padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; width: 100px;">
                </div>

                <div id="run-factor-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-line"></i> 固有値と寄与率</h4>
                    <div id="eigenvalues-table"></div>
                    <div id="scree-plot" style="margin-top: 1.5rem;"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-th"></i> 主成分負荷量</h4>
                    <div id="loadings-table"></div>
                    <div id="loadings-heatmap" style="margin-top: 1.5rem;"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#fa-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Multi Select
    createVariableSelector('factor-vars-container', numericColumns, 'factor-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択（複数選択可、3つ以上）:',
        multiple: true
    });

    createAnalysisButton('run-factor-btn-container', '主成分分析を実行', () => runFactorAnalysis(currentData), { id: 'run-factor-btn' });
}