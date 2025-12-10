import { currentData } from '../main.js';
import { showError, renderDataOverview } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    // データ概要の表示（共通関数）
    const overviewContainerId = 'pca-data-overview';
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
                        <i class="fas fa-layer-group" style="color: #1e90ff;"></i> 分析に使用する変数 (2つ以上):
                    </label>
                    <div class="checkbox-group" style="max-height: 200px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                        ${numericColumns.map(col => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" name="pca-vars" value="${col}" checked style="cursor: pointer;"> ${col}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <button id="run-pca-btn" class="btn-analysis" style="width: 100%; padding: 1rem; background: #1e90ff; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: background 0.2s;">
                    <i class="fas fa-calculator"></i> 分析を実行
                </button>
            </div>
        </div>
        
        <div id="pca-results" class="analysis-results" style="margin-top: 2rem;"></div>
    `;

    renderDataOverview(`#${overviewContainerId}`, currentData, characteristics, { initiallyCollapsed: true });

    document.getElementById('run-pca-btn').addEventListener('click', () => {
        const selectedVars = Array.from(document.querySelectorAll('input[name="pca-vars"]:checked')).map(cb => cb.value);
        if (selectedVars.length < 2) {
            showError('変数を2つ以上選択してください。');
            return;
        }
        runPcaAnalysis(selectedVars);
    });
}

function runPcaAnalysis(variables) {
    const resultsContainer = document.getElementById('pca-results');
    resultsContainer.innerHTML = `
        <div style="background: #1e90ff; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; font-size: 1.25rem;">
                <i class="fas fa-chart-pie"></i> 分析結果
            </h3>
        </div>
    `;

    // 1. Prepare Data
    const data = currentData.filter(row => variables.every(v => row[v] != null && !isNaN(row[v])));

    if (data.length < variables.length) {
        resultsContainer.innerHTML += '<div class="error-message">データ数が変数の数より少ないため、分析できません。</div>';
        return;
    }

    // 2. Standardize
    const X = data.map(row => variables.map(v => Number(row[v])));
    const n = X.length;
    const p = variables.length;

    // Calculate Means and SDs
    const means = variables.map((_, j) => jStat.mean(X.map(r => r[j])));
    const sds = variables.map((_, j) => jStat.stdev(X.map(r => r[j]), true));

    // Z Score Matrix
    const Z = X.map(row => row.map((val, j) => (val - means[j]) / sds[j]));

    // 3. Correlation Matrix (R = Z'Z / (n-1))
    const R = jStat.zeros(p, p);
    for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) sum += Z[k][i] * Z[k][j];
            R[i][j] = sum / (n - 1);
        }
    }

    try {
        // 4. Eigen Decomposition (math.js)
        if (typeof math === 'undefined') throw new Error("Math.js is not loaded.");
        const eig = math.eigs(R);

        let eigenFiles = [];
        const eigVals = eig.values.toArray ? eig.values.toArray() : eig.values;
        const eigVecs = eig.vectors.toArray ? eig.vectors.toArray() : eig.vectors; // matrix where cols are eigenvectors

        for (let i = 0; i < p; i++) {
            // Eigenvector is i-th column
            const vec = eigVecs.map(row => row[i]);
            eigenFiles.push({ val: eigVals[i], vec: vec });
        }
        eigenFiles.sort((a, b) => b.val - a.val);

        const totalVar = eigenFiles.reduce((acc, f) => acc + f.val, 0);

        // 5. Outputs

        // A. Variance Table
        let html = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-list"></i> 寄与率 (Variance Explained)
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>主成分</th><th>固有値</th><th>寄与率 (%)</th><th>累積寄与率 (%)</th></tr>
                        </thead>
                        <tbody>
        `;
        let cumSum = 0;
        const contribs = [];
        eigenFiles.forEach((f, i) => {
            const contrib = (f.val / totalVar) * 100;
            contribs.push(contrib);
            cumSum += contrib;
            html += `<tr>
                <td style="font-weight: 500;">PC${i + 1}</td>
                <td>${f.val.toFixed(4)}</td>
                <td>${contrib.toFixed(2)}</td>
                <td>${cumSum.toFixed(2)}</td>
            </tr>`;
        });
        html += '</tbody></table></div></div>';

        // B. Loadings Table
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-project-diagram"></i> 主成分負荷量 (Eigenvectors)
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>変数</th>${eigenFiles.map((_, i) => `<th>PC${i + 1}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
        `;
        variables.forEach((v, r_idx) => {
            html += `<tr><td style="font-weight: 500;">${v}</td>`;
            eigenFiles.forEach(f => {
                const val = f.vec[r_idx];
                const style = Math.abs(val) >= 0.5 ? 'color:#1e90ff; font-weight:bold; background:#f0f9ff;' : '';
                html += `<td style="${style}">${val.toFixed(4)}</td>`;
            });
            html += `</tr>`;
        });
        html += '</tbody></table></div>';

        // High Contribution List
        html += `<div style="margin-top: 1.5rem;">
                 <h5 style="color: #2d3748; margin-bottom: 0.5rem;">▼ 主成分への寄与が大きい変数 (|係数| ≥ 0.5)</h5>
                 <ul style="list-style: none; padding: 0;">`;
        eigenFiles.forEach((f, i) => {
            const sigVars = variables.filter((_, idx) => Math.abs(f.vec[idx]) >= 0.5);
            html += `<li style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px; border-left: 3px solid #1e90ff;">
                <strong style="color: #1e90ff;">PC${i + 1}</strong>: ${sigVars.length > 0 ? sigVars.join(', ') : 'なし'}
            </li>`;
        });
        html += '</ul></div></div>';

        // C. Scores (Top 5 rows preview)
        // Calculate Scores = Z * V
        const scores = Z.map(row => {
            return eigenFiles.map(f => {
                return row.reduce((sum, val, idx) => sum + val * f.vec[idx], 0);
            });
        });

        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-table"></i> 主成分スコア (上位5件)
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr><th>No.</th>${eigenFiles.map((_, i) => `<th>PC${i + 1}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
        `;
        // Show first 5 rows
        scores.slice(0, 5).forEach((row, i) => {
            html += `<tr><td>${i + 1}</td>${row.map(v => `<td>${v.toFixed(4)}</td>`).join('')}</tr>`;
        });
        html += `</tbody></table></div>
                 <p style="margin-top:0.5rem; color:#64748b; font-size:0.9em;">※ 全データのスコアはダウンロード機能で取得可能です（将来実装予定）</p>
                 </div>`;

        resultsContainer.innerHTML += html;

        // 6. Plots
        const plotContainer = document.createElement('div');
        plotContainer.style.display = 'grid';
        plotContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
        plotContainer.style.gap = '1.5rem';
        resultsContainer.appendChild(plotContainer);

        const screeDiv = document.createElement('div');
        screeDiv.id = 'pca-scree';
        screeDiv.style.background = 'white';
        screeDiv.style.padding = '1.5rem';
        screeDiv.style.borderRadius = '8px';
        screeDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        plotContainer.appendChild(screeDiv);

        const biplotDiv = document.createElement('div');
        biplotDiv.id = 'pca-biplot';
        biplotDiv.style.background = 'white';
        biplotDiv.style.padding = '1.5rem';
        biplotDiv.style.borderRadius = '8px';
        biplotDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        plotContainer.appendChild(biplotDiv);

        // Scree Plot
        Plotly.newPlot('pca-scree', [{
            x: eigenFiles.map((_, i) => `PC${i + 1}`),
            y: eigenFiles.map(f => f.val),
            type: 'bar', marker: { color: '#1e90ff' }
        }, {
            x: eigenFiles.map((_, i) => `PC${i + 1}`),
            y: eigenFiles.map(f => f.val),
            type: 'scatter', mode: 'lines+markers', marker: { color: '#f59e0b' }
        }], {
            title: 'スクリープロット',
            yaxis: { title: '固有値' },
            showlegend: false,
            font: { family: 'Inter, sans-serif' },
            margin: { t: 40, l: 40, r: 20, b: 40 }
        });

        // Biplot (PC1 vs PC2)
        if (variables.length >= 2) {
            const pc1 = scores.map(s => s[0]);
            const pc2 = scores.map(s => s[1]);
            const traces = [];

            // Samples
            traces.push({
                x: pc1, y: pc2, mode: 'markers', type: 'scatter',
                name: 'サンプル', marker: { color: 'rgba(30, 144, 255, 0.6)', size: 7 }
            });

            // Loading Vectors
            const maxScore = Math.max(...pc1.map(Math.abs), ...pc2.map(Math.abs));
            const scalingFactor = maxScore * 0.8;

            eigenFiles[0].vec.forEach((v1, i) => {
                const v2 = eigenFiles[1].vec[i];
                traces.push({
                    x: [0, v1 * scalingFactor],
                    y: [0, v2 * scalingFactor],
                    mode: 'lines+text',
                    text: [null, variables[i]],
                    textposition: 'top right',
                    line: { color: '#ef4444', width: 2 },
                    showlegend: false,
                    type: 'scatter'
                });
            });

            Plotly.newPlot('pca-biplot', traces, {
                title: `バイプロット (PC1: ${contribs[0].toFixed(1)}%, PC2: ${contribs[1].toFixed(1)}%)`,
                xaxis: { title: 'PC1' },
                yaxis: { title: 'PC2', scaleanchor: 'x' },
                showlegend: false,
                font: { family: 'Inter, sans-serif' },
                margin: { t: 40, l: 40, r: 20, b: 40 }
            });
        }

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<div class="error-message">計算中にエラーが発生しました。<br>詳細: ${e.message}</div>`;
    }
}