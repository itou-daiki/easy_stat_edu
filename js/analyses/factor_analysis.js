import { currentData } from '../main.js';
import { showError, renderDataOverview } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    if (numericColumns.length < 3) {
        container.innerHTML = '<p class="error-message">数値変数が3つ以上必要です。</p>';
        return;
    }

    // データ概要の表示（共通関数）
    const overviewContainerId = 'fa-data-overview';
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
                        <i class="fas fa-layer-group" style="color: #1e90ff;"></i> 変数選択 (3つ以上):
                    </label>
                    <div id="fa-vars-container" class="checkbox-group" style="max-height: 200px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                        ${numericColumns.map(col => `
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" name="fa-vars" value="${col}" checked style="cursor: pointer;"> ${col}
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div class="control-group">
                        <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">因子抽出法:</label>
                        <select disabled style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 6px; background: #f1f5f9; color: #64748b;">
                            <option>主成分法 (Principal Component)</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label for="fa-rotation" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">回転方法:</label>
                        <select id="fa-rotation" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e0; border-radius: 6px;">
                            <option value="none">回転なし</option>
                            <option value="varimax" selected>バリマックス回転 (直交)</option>
                            <option value="promax">プロマックス回転 (斜交)</option>
                        </select>
                    </div>
                </div>
                
                <div class="control-group" style="margin-bottom: 1.5rem;">
                    <label for="fa-n-factors" style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">抽出する因子数:</label>
                    <input type="number" id="fa-n-factors" value="2" min="1" max="${numericColumns.length}" style="width: 100px; padding: 0.75rem; border: 1px solid #cbd5e0; border-radius: 6px;">
                </div>
                
                <button id="run-fa-btn" class="btn-analysis" style="width: 100%; padding: 1rem; background: #1e90ff; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: background 0.2s;">
                    <i class="fas fa-calculator"></i> 分析を実行
                </button>
            </div>
        </div>
        
        <div id="fa-results" class="analysis-results" style="margin-top: 2rem;"></div>
    `;

    renderDataOverview(`#${overviewContainerId}`, currentData, characteristics, { initiallyCollapsed: true });

    document.getElementById('run-fa-btn').addEventListener('click', () => {
        const selectedVars = Array.from(document.querySelectorAll('input[name="fa-vars"]:checked')).map(cb => cb.value);
        const rotation = document.getElementById('fa-rotation').value;
        const nFactors = parseInt(document.getElementById('fa-n-factors').value);

        if (selectedVars.length < 3) {
            showError('変数を3つ以上選択してください。');
            return;
        }
        if (nFactors < 1 || nFactors > selectedVars.length) {
            showError('適切な因子数を指定してください。');
            return;
        }

        runFactorAnalysis(selectedVars, nFactors, rotation);
    });
}

// --- Matrix Math Utils ---
const mat = {
    transpose: (A) => A[0].map((_, c) => A.map(r => r[c])),
    clone: (A) => A.map(r => [...r]),
};

function runFactorAnalysis(variables, nFactors, rotation) {
    const resultsContainer = document.getElementById('fa-results');
    resultsContainer.innerHTML = `
        <div style="background: #1e90ff; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; font-size: 1.25rem;">
                <i class="fas fa-project-diagram"></i> 分析結果 (主成分法)
            </h3>
        </div>
    `;

    // 1. Prepare Data
    const data = currentData.filter(row => variables.every(v => row[v] != null && !isNaN(row[v])));

    // 2. Correlation Matrix
    // Standardize X
    const X = data.map(row => variables.map(v => Number(row[v])));
    const n = X.length;
    const p = variables.length;

    const means = variables.map((_, j) => jStat.mean(X.map(r => r[j])));
    const sds = variables.map((_, j) => jStat.stdev(X.map(r => r[j]), true));
    const Z = X.map(row => row.map((val, j) => (val - means[j]) / sds[j]));

    // R = Z'Z / (n-1)
    const R = Array(p).fill(0).map(() => Array(p).fill(0));
    for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) sum += Z[k][i] * Z[k][j];
            R[i][j] = sum / (n - 1);
        }
    }

    try {
        // 3. Eigen Decomposition using math.js if available, else simplistic
        // Assuming math.js is loaded globally as per project standard
        if (typeof math === 'undefined') {
            throw new Error("Math.js library is not loaded.");
        }

        const eig = math.eigs(R); // Returns values and vectors
        // math.js eigs returns { values: [n], vectors: [[n],[n]...] OR Matrix }
        // We need to parse this carefully as math.js structure depends on version/matrix type
        // Assuming standard behavior: vectors cols are eigenvectors

        // Convert to array if matrix
        const eigVals = eig.values.toArray ? eig.values.toArray() : eig.values;
        const eigVecs = eig.vectors.toArray ? eig.vectors.toArray() : eig.vectors;
        // Check formatting: math.eigs often returns sorted inc, or dec?
        // Usually unsorted or sorted ascending. We need descending.

        const eigenFiles = [];
        for (let i = 0; i < p; i++) {
            // Eigenvector is the i-th column
            const vec = eigVecs.map(row => row[i]);
            eigenFiles.push({ val: eigVals[i], vec: vec });
        }
        eigenFiles.sort((a, b) => b.val - a.val);

        // 4. Initial Loadings (Unrotated)
        let Loadings = Array(p).fill(0).map(() => Array(nFactors).fill(0));
        const factors = eigenFiles.slice(0, nFactors);

        for (let j = 0; j < nFactors; j++) {
            const lambda = factors[j].val;
            const sqrtLambda = Math.sqrt(Math.max(0, lambda));
            for (let i = 0; i < p; i++) {
                Loadings[i][j] = factors[j].vec[i] * sqrtLambda;
            }
        }

        // 5. Rotation
        let RotatedLoadings = mat.clone(Loadings);
        let FactorCorr = null;

        if (rotation === 'varimax' || rotation === 'promax') {
            // Normalize rows
            const comm = Loadings.map(row => row.reduce((sum, v) => sum + v ** 2, 0));
            const sqrtComm = comm.map(c => Math.sqrt(c));
            const NormalizedL = Loadings.map((row, i) => row.map(v => v / (sqrtComm[i] || 1)));

            // Varimax Iteration
            const mathL = math.matrix(NormalizedL);
            let mathR = math.identity(nFactors); // Rotation matrix

            for (let loop = 0; loop < 20; loop++) {
                let B = math.multiply(mathL, mathR);
                let B_arr = B.toArray();

                // M = B.^3 - B * diag(sum(B.^2, axis=0)/p)
                let M = B_arr.map(r => r.map(v => v ** 3));
                let colSumsSq = Array(nFactors).fill(0).map((_, c) =>
                    B_arr.reduce((sum, r) => sum + r[c] ** 2, 0) / p
                );

                for (let r = 0; r < p; r++) {
                    for (let c = 0; c < nFactors; c++) {
                        M[r][c] -= B_arr[r][c] * colSumsSq[c];
                    }
                }

                // SVD of L' * M
                let cross = math.multiply(math.transpose(mathL), math.matrix(M));
                let svdRes = math.svd(cross); // {u, s, v}
                // New R = U * V'
                mathR = math.multiply(svdRes.u, math.transpose(svdRes.v));
            }

            // Apply Varimax
            let FinalNormalized = math.multiply(mathL, mathR).toArray();
            RotatedLoadings = FinalNormalized.map((row, i) => row.map(v => v * sqrtComm[i]));

            if (rotation === 'promax') {
                const k = 4;
                const V_loadings = RotatedLoadings;
                const Target = V_loadings.map(row => row.map(v => Math.sign(v) * (Math.abs(v) ** k)));

                const matV = math.matrix(V_loadings);
                const matTarg = math.matrix(Target);

                // T = (V'V)^-1 V' Target
                const fit = math.multiply(
                    math.multiply(math.inv(math.multiply(math.transpose(matV), matV)), math.transpose(matV)),
                    matTarg
                );

                // Normalize T
                const T_arr = fit.toArray();
                for (let c = 0; c < nFactors; c++) {
                    let ssq = 0;
                    for (let r = 0; r < nFactors; r++) ssq += T_arr[r][c] ** 2;
                    let norm = Math.sqrt(ssq);
                    for (let r = 0; r < nFactors; r++) T_arr[r][c] /= norm;
                }

                RotatedLoadings = math.multiply(matV, math.matrix(T_arr)).toArray();

                let TT = math.multiply(math.transpose(math.matrix(T_arr)), math.matrix(T_arr));
                FactorCorr = math.inv(TT).toArray(); // Phi
            }
        }

        // 6. Outputs

        // A. Scree Plot
        const evs = eigenFiles.map(e => e.val);
        const totalVar = evs.reduce((a, b) => a + b, 0);
        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-area"></i> スクリープロット</h4>
                     <div id="fa-scree" style="height: 300px;"></div>
                </div>
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-th"></i> 因子負荷量ヒートマップ</h4>
                     <div id="fa-heatmap" style="height: 300px;"></div>
                </div>
            </div>
        `;

        // B. Loadings Table & Alpha
        html += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 0.5rem;">
                    <i class="fas fa-list-ol"></i> 因子負荷量と信頼性係数
                </h4>
                <div class="table-container">
                    <table class="table">
                        <thead style="background: #f8fafc;">
                            <tr>
                                <th>変数</th>
                                ${Array(nFactors).fill(0).map((_, i) => `<th style="text-align:center;">Factor ${i + 1}</th>`).join('')}
                                <th style="text-align:center;">共通性</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        RotatedLoadings.forEach((row, i) => {
            const comm = row.reduce((a, b) => a + b ** 2, 0);
            html += `<tr>
                <td style="font-weight: 500;">${variables[i]}</td>
                ${row.map(v => `<td style="text-align:center; ${Math.abs(v) >= 0.4 ? 'font-weight:bold; color:#1e90ff; background:#f0f9ff;' : ''}">${v.toFixed(3)}</td>`).join('')}
                <td style="text-align:center;">${comm.toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;

        // Alpha & Factor Means
        let factorMeans = []; // For each factor, calculate mean of high-loading items
        let alphaList = [];

        html += `<div style="margin-top: 1.5rem;">
                 <h5 style="color: #2d3748; margin-bottom: 0.5rem;">▼ 因子特性 (信頼性係数 α & 因子平均)</h5>
                 <ul style="list-style: none; padding: 0;">`;

        for (let j = 0; j < nFactors; j++) {
            const highLoadIndices = [];
            RotatedLoadings.forEach((row, i) => { if (Math.abs(row[j]) >= 0.4) highLoadIndices.push(i); });
            const highLoadItems = highLoadIndices.map(i => variables[i]);

            // Calculate Alpha
            let alpha = '計算不可 (項目不足)';
            if (highLoadItems.length >= 2) {
                // Std Alpha for simplicity or Cronbach
                // Cronbach: (k / k-1) * (1 - sum(item_var) / total_var)
                // Need variance of sum of items
                const subX = X.map(row => highLoadIndices.map(idx => row[idx])); // Raw standardized data? No, usually raw data for alpha
                // Let's use Raw Data for Alpha as per tradition
                const rawSub = data.map(row => highLoadItems.map(v => Number(row[v])));

                // Item Variances
                const itemVars = highLoadItems.map((_, colIdx) => jStat.variance(rawSub.map(r => r[colIdx]), true));
                // Total Score Variance
                const scores = rawSub.map(r => r.reduce((a, b) => a + b, 0));
                const totalVar = jStat.variance(scores, true);
                const sumItemVar = itemVars.reduce((a, b) => a + b, 0);

                const k = highLoadItems.length;
                const aVal = (k / (k - 1)) * (1 - (sumItemVar / totalVar));
                alpha = aVal.toFixed(3);
            }

            // Calculate Factor Means (Average of raw scores of high loading items)
            let fMean = 'N/A';
            if (highLoadItems.length > 0) {
                const rawSub = data.map(row => highLoadItems.map(v => Number(row[v])));
                const rowMeans = rawSub.map(r => r.reduce((a, b) => a + b, 0) / r.length);
                const grandMean = jStat.mean(rowMeans);
                fMean = grandMean.toFixed(3);
                factorMeans.push({ name: `Factor ${j + 1}`, mean: fMean, items: highLoadItems.join(', ') });
            } else {
                factorMeans.push({ name: `Factor ${j + 1}`, mean: '-', items: 'なし' });
            }

            alphaList.push(alpha);

            html += `<li style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px; border-left: 3px solid #1e90ff;">
                <strong style="color: #1e90ff;">Factor ${j + 1}</strong>: 
                <span style="display:inline-block; margin-left:10px;">α係数 = <strong>${alpha}</strong></span>
                <span style="display:inline-block; margin-left:10px;">因子平均 = <strong>${fMean}</strong></span>
                <br><small style="color: #64748b;">構成項目: ${highLoadItems.join(', ') || 'なし'}</small>
            </li>`;
        }
        html += `</ul></div></div>`;

        // C. Factor Correlations (if Promax)
        if (FactorCorr) {
            html += `
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-exchange-alt"></i> 因子間相関</h4>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr><th></th>${Array(nFactors).fill(0).map((_, i) => `<th>Factor ${i + 1}</th>`).join('')}</tr>
                            </thead>
                            <tbody>
            `;
            FactorCorr.forEach((row, i) => {
                html += `<tr><td style="font-weight:bold;">Factor ${i + 1}</td>` +
                    row.map(v => `<td>${v.toFixed(3)}</td>`).join('') + `</tr>`;
            });
            html += `</tbody></table></div></div>`;
        }

        resultsContainer.innerHTML += html;

        // Plotly Charts
        Plotly.newPlot('fa-scree', [{
            x: eigenFiles.map((_, i) => i + 1),
            y: eigenFiles.map(e => e.val),
            type: 'scatter', mode: 'lines+markers',
            marker: { color: '#1e90ff' },
            line: { color: '#1e90ff' }
        }], {
            title: 'スクリープロット', xaxis: { title: '成分番号' }, yaxis: { title: '固有値' },
            font: { family: 'Inter, sans-serif' },
            margin: { t: 40, l: 40, r: 20, b: 40 }
        });

        Plotly.newPlot('fa-heatmap', [{
            z: RotatedLoadings,
            x: Array(nFactors).fill(0).map((_, i) => `Factor ${i + 1}`),
            y: variables,
            type: 'heatmap', colorscale: 'RdBu', zmin: -1, zmax: 1
        }], {
            title: '因子負荷量',
            font: { family: 'Inter, sans-serif' },
            margin: { t: 40, l: 80, r: 20, b: 40 }
        });

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<div class="error-message">計算中にエラーが発生しました。<br>詳細: ${e.message}</div>`;
    }
}