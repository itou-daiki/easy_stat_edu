import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';

function runPCA() {
    const varsSelect = document.getElementById('pca-vars');
    const variables = Array.from(varsSelect.selectedOptions).map(o => o.value);

    if (variables.length < 2) {
        alert('変数を2つ以上選択してください');
        return;
    }

    try {
        // データの標準化（Zスコア）
        const standardizedData = [];
        const means = [];
        const stds = [];

        variables.forEach(v => {
            const vals = currentData.map(r => r[v]);
            means.push(jStat.mean(vals));
            stds.push(jStat.stdev(vals, true));
        });

        // 行列データの作成
        const matrix = currentData.map(row => {
            return variables.map((v, i) => (row[v] - means[i]) / stds[i]);
        });

        // 共分散行列（相関行列）
        const corrMatrix = [];
        for (let i = 0; i < variables.length; i++) {
            const row = [];
            for (let j = 0; j < variables.length; j++) {
                // standardized data covariance is correlation
                const col1 = matrix.map(r => r[i]);
                const col2 = matrix.map(r => r[j]);
                row.push(jStat.covariance(col1, col2));
            }
            corrMatrix.push(row);
        }

        // 固有値分解
        const { values, vectors } = math.eigs(corrMatrix);

        // ソート
        const indices = Array.from(values.keys()).sort((a, b) => values[b] - values[a]);
        const sortedValues = indices.map(i => values[i]);
        const sortedVectors = indices.map(i => math.column(vectors, i));

        // 主成分スコアの計算
        const pcScores = matrix.map(row => {
            return sortedVectors.map(vec => math.dot(row, vec));
        });

        displayEigenvalues(sortedValues);
        plotScree(sortedValues);
        displayLoadings(variables, sortedVectors, sortedValues);
        plotBiplot(pcScores, sortedVectors, variables);

        // 結果テーブルの表示（寄与率など）
        // 既に displayEigenvalues で表示しているため、詳細なスコアテーブルなどを追加可能

        document.getElementById('analysis-results').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert('計算エラーが発生しました。');
    }
}

function displayEigenvalues(eigenvalues) {
    const container = document.getElementById('eigenvalues-table');
    const total = eigenvalues.reduce((a, b) => a + b, 0);
    let cumulative = 0;

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

    eigenvalues.forEach((val, i) => {
        const contribution = (val / total) * 100;
        cumulative += contribution;
        const style = val >= 1.0 ? 'font-weight: bold; color: #1e90ff;' : '';

        html += `
            <tr style="${style}">
                <td>PC${i + 1}</td>
                <td>${val.toFixed(3)}</td>
                <td>${contribution.toFixed(2)}</td>
                <td>${cumulative.toFixed(2)}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function plotScree(eigenvalues) {
    const trace = {
        x: eigenvalues.map((_, i) => `PC${i + 1}`),
        y: eigenvalues,
        type: 'bar',
        marker: { color: '#1e90ff' }
    };

    const traceLine = {
        x: eigenvalues.map((_, i) => `PC${i + 1}`),
        y: eigenvalues,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#2d3748' }
    };

    const layout = {
        title: 'スクリープロット（固有値の推移）',
        yaxis: { title: '固有値' }
    };

    Plotly.newPlot('scree-plot', [trace, traceLine], layout, createPlotlyConfig('主成分分析_スクリープロット', []));
}

function displayLoadings(variables, vectors, values) {
    const container = document.getElementById('loadings-table');
    const nComp = Math.min(vectors.length, 5); // Display top 5 components max

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${Array.from({ length: nComp }, (_, i) => `<th>PC${i + 1} (固有ベクトル)</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((v, i) => {
        html += `<tr><td><strong>${v}</strong></td>`;
        for (let j = 0; j < nComp; j++) {
            const val = vectors[j][i]; // j-th vector, i-th variable
            // 因子負荷量 (loading) = eigenvector * sqrt(eigenvalue)
            const loading = val * Math.sqrt(values[j]);

            // 重要度（絶対値が大きい）を強調
            const style = Math.abs(loading) > 0.4 ? 'background: rgba(30, 144, 255, 0.1); font-weight: bold;' : '';
            html += `<td style="${style}">${loading.toFixed(3)}</td>`;
        }
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p style="color: #666; font-size: 0.9rem; margin-top: 5px;">※表の値は因子負荷量（固有ベクトル × √固有値）を表示しています。</p>';
    container.innerHTML = html;
}

function plotBiplot(scores, vectors, variables) {
    // PC1 vs PC2
    const pc1 = scores.map(row => row[0]);
    const pc2 = scores.map(row => row[1]);

    const tracePoints = {
        x: pc1,
        y: pc2,
        mode: 'markers',
        type: 'scatter',
        name: '観測データ',
        marker: { color: 'rgba(30, 144, 255, 0.5)', size: 8 }
    };

    // 変数ベクトル（負荷量）
    const annotations = [];
    const shapes = [];

    // スケーリング係数（グラフを見やすくするため）
    const scale = Math.max(...pc1.map(Math.abs), ...pc2.map(Math.abs)) * 0.8;

    variables.forEach((v, i) => {
        const x = vectors[0][i] * scale * 2; // Expand for visibility
        const y = vectors[1][i] * scale * 2;

        shapes.push({
            type: 'line',
            x0: 0, y0: 0,
            x1: x, y1: y,
            line: { color: '#ef4444', width: 2 }
        });

        annotations.push({
            x: x, y: y,
            text: v,
            showarrow: false,
            font: { color: '#ef4444', weight: 'bold' },
            bgcolor: 'rgba(255,255,255,0.7)'
        });
    });

    const layout = {
        title: 'バイプロット (PC1 vs PC2)',
        xaxis: { title: '第一主成分' },
        yaxis: { title: '第二主成分' },
        shapes: shapes,
        annotations: annotations,
        hovermode: 'closest',
        height: 600
    };

    Plotly.newPlot('biplot', [tracePoints], layout, createPlotlyConfig('主成分分析_バイプロット', variables));
}


export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="pca-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-compress-arrows-alt"></i> 主成分分析 (PCA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">多次元データを要約して可視化します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 主成分分析 (PCA) とは？</strong>
                        <p>たくさんの変数（データ）の情報をできるだけ損なわずに、少数の新しい指標（主成分）に要約する手法です。多次元のデータを2次元や3次元に圧縮して可視化する際によく使われます。</p>
                        <img src="image/pca.png" alt="主成分分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>5教科の点数を「総合学力」という1つの指標にまとめたい</li>
                        <li>10個の体力測定の結果を「パワー」「スピード」のような少ない指標に要約してマップ化したい</li>
                    </ul>
                    <h4>因子分析との違い</h4>
                    <ul>
                        <li><strong>PCA:</strong> データの「情報（分散）」を要約・圧縮するのが目的。</li>
                        <li><strong>因子分析:</strong> データの背後にある「原因（因子）」を探るのが目的。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="pca-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="pca-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                
                <div id="run-pca-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-list-ol"></i> 固有値リスト</h4>
                        <div id="eigenvalues-table"></div>
                    </div>
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-bar"></i> スクリープロット</h4>
                        <div id="scree-plot"></div>
                    </div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-table"></i> 因子負荷量</h4>
                    <div id="loadings-table"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-bullseye"></i> バイプロット</h4>
                    <div id="biplot"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#pca-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Multi Select
    createVariableSelector('pca-vars-container', numericColumns, 'pca-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択（複数選択可、2つ以上）:',
        multiple: true
    });

    createAnalysisButton('run-pca-btn-container', '主成分分析を実行', runPCA, { id: 'run-pca-btn' });
}