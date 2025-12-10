import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    if (numericColumns.length < 2) {
        container.innerHTML = '<p class="error-message">数値変数が2つ以上必要です。</p>';
        return;
    }

    let options = numericColumns.map(col => `<label><input type="checkbox" name="pca-vars" value="${col}" checked> ${col}</label>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>分析に使用する変数 (2つ以上):</label>
                <div class="checkbox-group">${options}</div>
            </div>
            <button id="run-pca-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="pca-results" class="analysis-results"></div>
    `;

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
    resultsContainer.innerHTML = '<h4>主成分分析 結果</h4>';

    // 1. Prepare Data
    const data = currentData.filter(row => variables.every(v => row[v] != null && !isNaN(row[v])));

    if (data.length < variables.length) {
        resultsContainer.innerHTML += '<p class="error-message">データ数が変数の数より少ないため、分析できません。</p>';
        return;
    }

    // 2. Standardize
    const processedData = []; // [row1_array, row2_array...]
    variables.forEach(v => {
        const vals = data.map(row => Number(row[v]));
        const mean = jStat.mean(vals);
        const sd = jStat.stdev(vals, true); // Sample SD
        // Store standardized columns for covariance calculation
        // But for processing we want rows.
    });

    // Create Matrix X (n x p)
    const X = data.map(row => variables.map(v => Number(row[v])));

    // Standardize X
    const n = X.length;
    const p = variables.length;
    const means = variables.map((_, j) => jStat.mean(X.map(r => r[j])));
    const sds = variables.map((_, j) => jStat.stdev(X.map(r => r[j]), true));

    const Z = X.map(row => row.map((val, j) => (val - means[j]) / sds[j]));

    // 3. Covariance (Correlation) Matrix
    // R = (Z'Z) / (n-1)
    const ZT = jStat.transpose(Z);
    const R = jStat.zeros(p, p);
    for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += Z[k][i] * Z[k][j];
            }
            R[i][j] = sum / (n - 1);
        }
    }

    try {
        // 4. Eigen Decomposition
        const eig = math.eigs(R); // math.js eigs
        // math.js returns values: [v1, v2...], vectors: [[x1, y1..], [x2, y2..]] (columns are eigenvectors)

        let eigenFiles = [];
        for (let i = 0; i < p; i++) {
            // Extract column i from vectors
            const vec = eig.vectors.map(row => row[i]);
            eigenFiles.push({ val: eig.values[i], vec: vec });
        }

        // Sort by Eigenvalue descending
        eigenFiles.sort((a, b) => b.val - a.val);

        // 5. Output Tables
        const totalVar = eigenFiles.reduce((acc, f) => acc + f.val, 0);

        // Variance Table
        let varHtml = `
            <h5>寄与率</h5>
            <table class="table table-sm">
                <thead><tr><th>主成分</th><th>固有値</th><th>寄与率 (%)</th><th>累積寄与率 (%)</th></tr></thead>
                <tbody>
        `;
        let cumSum = 0;
        const contribs = [];
        eigenFiles.forEach((f, i) => {
            const contrib = (f.val / totalVar) * 100;
            contribs.push(contrib);
            cumSum += contrib;
            varHtml += `<tr>
                <td>PC${i + 1}</td>
                <td>${f.val.toFixed(4)}</td>
                <td>${contrib.toFixed(2)}</td>
                <td>${cumSum.toFixed(2)}</td>
            </tr>`;
        });
        varHtml += '</tbody></table>';

        // Loadings Table (Eigenvectors)
        // Usually Loadings = Eigenvector * sqrt(Eigenvalue) for Factor Matrix
        // But for simple PCA "Components", sklearn returns eigenvectors.
        // We will show Eigenvectors (Coefficients) as per Python reference "loading_df ~ pca.components_.T"
        let loadHtml = `
            <h5>主成分負荷量 (係数)</h5>
            <table class="table table-sm">
                <thead><tr><th>変数</th>${eigenFiles.map((_, i) => `<th>PC${i + 1}</th>`).join('')}</tr></thead>
                <tbody>
        `;
        variables.forEach((v, r_idx) => {
            loadHtml += `<tr><td>${v}</td>`;
            eigenFiles.forEach(f => {
                loadHtml += `<td>${f.vec[r_idx].toFixed(4)}</td>`;
            });
            loadHtml += `</tr>`;
        });
        loadHtml += '</tbody></table>';

        // High Contribution Variables
        let contHtml = `<h5>主成分への寄与が大きい変数 (閾値=|0.5|)</h5><ul>`;
        eigenFiles.forEach((f, i) => {
            const sigVars = variables.filter((_, idx) => Math.abs(f.vec[idx]) >= 0.5);
            contHtml += `<li><strong>PC${i + 1}:</strong> ${sigVars.length > 0 ? sigVars.join(', ') : 'なし'}</li>`;
        });
        contHtml += `</ul>`;

        resultsContainer.innerHTML += varHtml + '<div class="row"><div class="col-md-6">' + loadHtml + '</div><div class="col-md-6">' + contHtml + '</div></div>';

        // 6. Scores & Plots
        // Scores = Z * V (Use top 2 for Biplot)
        // We calculate all scores
        const scores = Z.map(row => {
            return eigenFiles.map(f => {
                // Dot product row . vec
                return row.reduce((sum, val, idx) => sum + val * f.vec[idx], 0);
            });
        });

        // Visualization
        const plotContainer = document.createElement('div');
        plotContainer.className = 'd-flex';
        // Scree Plot & Biplot
        plotContainer.innerHTML = `<div id="pca-scree" style="width: 50%; height:400px;"></div><div id="pca-biplot" style="width: 50%; height:400px;"></div>`;
        resultsContainer.appendChild(plotContainer);

        // Scree
        Plotly.newPlot('pca-scree', [{
            x: eigenFiles.map((_, i) => `PC${i + 1}`),
            y: eigenFiles.map(f => f.val),
            type: 'bar', marker: { color: '#1e90ff' } // Primary Color
        }, {
            x: eigenFiles.map((_, i) => `PC${i + 1}`),
            y: eigenFiles.map(f => f.val),
            type: 'scatter', mode: 'lines+markers', marker: { color: 'orange' }
        }], { title: 'スクリープロット', yaxis: { title: '固有値' }, showlegend: false });

        // Biplot (PC1 vs PC2)
        if (variables.length >= 2) {
            const pc1 = scores.map(s => s[0]);
            const pc2 = scores.map(s => s[1]);

            const traces = [];
            // Samples
            traces.push({
                x: pc1, y: pc2, mode: 'markers', type: 'scatter',
                name: 'サンプル', marker: { color: 'rgba(30, 144, 255, 0.6)', size: 6 }
            });

            // Loading Vectors (Scaled for visibility)
            // Scale vectors to match score range
            const maxScore = Math.max(...pc1.map(Math.abs), ...pc2.map(Math.abs));
            const scalingFactor = maxScore * 0.8;

            // Vectors
            eigenFiles[0].vec.forEach((v1, i) => {
                const v2 = eigenFiles[1].vec[i];
                traces.push({
                    x: [0, v1 * scalingFactor],
                    y: [0, v2 * scalingFactor],
                    mode: 'lines+text',
                    text: [null, variables[i]],
                    textposition: 'top right',
                    line: { color: 'firebrick', width: 2 },
                    showlegend: false,
                    type: 'scatter'
                });
            });

            Plotly.newPlot('pca-biplot', traces, {
                title: `バイプロット (PC1: ${contribs[0].toFixed(1)}%, PC2: ${contribs[1].toFixed(1)}%)`,
                xaxis: { title: 'PC1' },
                yaxis: { title: 'PC2', scaleanchor: 'x' },
                showlegend: false
            });
        }

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<p class="error-message">計算中にエラーが発生しました。${e.message}</p>`;
    }
}