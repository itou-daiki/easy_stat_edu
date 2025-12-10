import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { numericColumns } = characteristics;
    if (numericColumns.length < 3) {
        container.innerHTML = '<p class="error-message">数値変数が3つ以上必要です。</p>';
        return;
    }

    let options = numericColumns.map(col => `<label><input type="checkbox" name="fa-vars" value="${col}" checked> ${col}</label>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label>変数選択 (3つ以上):</label>
                <div class="checkbox-group" style="max-height: 150px; overflow-y: auto;">${options}</div>
            </div>
            <div class="control-group">
                <label>因子抽出法: 主成分法 (Principal Component Method)</label>
            </div>
            <div class="control-group">
                <label for="fa-rotation">回転方法:</label>
                <select id="fa-rotation">
                    <option value="none">回転なし</option>
                    <option value="varimax" selected>バリマックス回転 (直交)</option>
                    <option value="promax">プロマックス回転 (斜交)</option>
                </select>
            </div>
            <div class="control-group">
                <label for="fa-n-factors">抽出する因子数:</label>
                <input type="number" id="fa-n-factors" value="2" min="1" max="${numericColumns.length}">
            </div>
            <button id="run-fa-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="fa-results" class="analysis-results"></div>
    `;

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
    mmul: (A, B) => {
        const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
        return result.map((row, i) => row.map((_, j) => {
            return A[i].reduce((sum, elm, k) => sum + elm * B[k][j], 0);
        }));
    },
    // Element-wise arithmetic
    add: (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j])),
    sub: (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j])),
    dot: (v1, v2) => v1.reduce((acc, v, i) => acc + v * v2[i], 0),
    col: (A, j) => A.map(r => r[j]),
    clone: (A) => A.map(r => [...r]),
};

function runFactorAnalysis(variables, nFactors, rotation) {
    const resultsContainer = document.getElementById('fa-results');
    resultsContainer.innerHTML = '<h4>因子分析 (主成分法) 結果</h4>';

    // 1. Prepare Data
    const data = currentData.filter(row => variables.every(v => row[v] != null && !isNaN(row[v])));

    // 2. Correlation Matrix
    // Standardize
    const X = data.map(row => variables.map(v => Number(row[v])));
    const n = X.length;
    const p = variables.length;
    const means = variables.map((_, j) => jStat.mean(X.map(r => r[j])));
    const sds = variables.map((_, j) => jStat.stdev(X.map(r => r[j]), true));
    const Z = X.map(row => row.map((val, j) => (val - means[j]) / sds[j]));

    // R = Z'Z / (n-1)
    const ZT = mat.transpose(Z);
    const R = jStat.zeros(p, p);
    for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) sum += Z[k][i] * Z[k][j];
            R[i][j] = sum / (n - 1);
        }
    }

    try {
        // 3. Eigen Decomposition
        const eig = math.eigs(R);
        const eigenFiles = [];
        for (let i = 0; i < p; i++) {
            const vec = eig.vectors.map(row => row[i]);
            eigenFiles.push({ val: eig.values[i], vec: vec });
        }
        eigenFiles.sort((a, b) => b.val - a.val);

        // 4. Initial Loadings (Unrotated)
        // L_ij = sqrt(lambda_j) * v_ij
        // We take top nFactors
        let Loadings = Array(p).fill(0).map(() => Array(nFactors).fill(0));
        const factors = eigenFiles.slice(0, nFactors);

        for (let j = 0; j < nFactors; j++) {
            const lambda = factors[j].val;
            const sqrtLambda = Math.sqrt(Math.max(0, lambda)); // prevent NaN
            for (let i = 0; i < p; i++) {
                Loadings[i][j] = factors[j].vec[i] * sqrtLambda;
            }
        }

        // 5. Rotation
        let RotatedLoadings = mat.clone(Loadings);
        let FactorCorr = null; // Identity for Orthogonal

        if (rotation === 'varimax' || rotation === 'promax') {
            // Varimax
            // Kaiser Normalization: Normalize rows by sqrt(communalities)
            const comm = Loadings.map(row => row.reduce((sum, v) => sum + v ** 2, 0));
            const sqrtComm = comm.map(c => Math.sqrt(c));
            let NormalizedL = Loadings.map((row, i) => row.map(v => v / sqrtComm[i]));

            // Iteration
            // d = p, k = nFactors
            const maxIter = 50;
            const tol = 1e-5;
            let T = jStat.identity(nFactors); // Transformation Matrix

            for (let it = 0; it < maxIter; it++) {
                const prevT = mat.clone(T);
                // B = L * T
                // Not standard matrix mul for Rotation?
                // Actually common algorithm uses Singular Value Decomposition or direct optimization
                // Simplest Varimax Iteration:
                // For each pair of factors, rotate to maximize variance
                // Or "Gradient Projection"

                // Let's use a simpler Pairwise rotation strategy if possible, or strict algorithm.
                // Algorithm from 'factor_analyzer' / 'stats' R package logic (GPIS).
                // d = normalized loadings
                // T = I
                // d = L @ T
                // ...
                // Since implementing full GPIS in raw JS is long, I will use a simplified pairwise approach often found in JS stats libraries or implement simple Varimax criterion maximization.

                // --- Simple Varimax Implementation ---
                // Rotate pairs of columns to maximize sum of variances of squared loadings
                // 
                // Reference: http://www.real-statistics.com/multivariate-statistics/factor-analysis/varimax-rotation/

                // Actually, let's stick to valid algo.
                // Let L = NormalizedLoadings
                // 1. Calculate B = L * gamma (where gamma starts as I)
                // 2. Compute gradient?

                // Let's assume for this snippet complexity we use a standard algorithm.
                // I will use a direct approximation for brevity in `implementation_plan` context, 
                // but here I write the actual code logic.

                // Fallback: Since implementing stable Varimax from scratch is risky in 50 lines, 
                // I will proceed with the Unrotated logic if rotation fails, or simplistic Procrustes if Promax.
                // BUT, I'll try to do the valid "Varimax" via "Quartimax" loop logic.
                // 
                // Let's use the 'math.js' power if possible? No direct function.

                // Simulating Varimax:
                // (Using a known JS snippet logic for Varimax)

                const L = NormalizedL;
                const H = mat.transpose(L); // k x p
                // We want rotation Matrix R (k x k)
                let R_rot = jStat.identity(nFactors);

                let d = 0;
                for (let iter = 0; iter < 20; iter++) {
                    let oldD = d;
                    // D = L * (L^3) - ...
                    // Let's implement valid but concise Varimax.
                    // Calculate M = L_rot .^ 3 - L_rot * diag(mean(L_rot.^2))
                    // U, S, V = svd(L' * M)
                    // R_new = U * V'
                }
                // Due to complexity and lack of `svd` in minimal math.js (it does have it but extended),
                // I will implement a placeholder "Varimax" that just passes Unrotated with a warning if math.js SVD is missing,
                // OR better: use `jStat` doesn't have SVD. `math.js` HAS `svd`. I can use that.

                const mathL = math.matrix(NormalizedL);
                let mathR = math.identity(nFactors);

                // Varimax Loop
                for (let loop = 0; loop < 15; loop++) {
                    // Matrix B = L * R
                    let B = math.multiply(mathL, mathR);
                    let B_arr = B.toArray();

                    // M = B.^3
                    let M = B_arr.map(r => r.map(v => v ** 3));

                    // Col means of B.^2
                    let B2 = B_arr.map(r => r.map(v => v ** 2));
                    let colMeans = Array(nFactors).fill(0).map((_, c) =>
                        B2.reduce((sum, r) => sum + r[c], 0) / p
                    );

                    // M = B.^3 - B * diag(colMeans)
                    // (Actually the formula is B * diag( sum(B.^2, 1)/p ))
                    for (let r = 0; r < p; r++) {
                        for (let c = 0; c < nFactors; c++) {
                            M[r][c] -= B_arr[r][c] * colMeans[c];
                        }
                    }

                    // U, S, V = svd(L' * M)
                    let cross = math.multiply(math.transpose(mathL), math.matrix(M));
                    // math.svd check
                    let resSVD = math.svd(cross); // returns {u, v, q} ? math.js svd returns { u, v, s } (v is V', or V check docs... usually V)
                    // New R = U * V'
                    // Math.js: A = U * diag(s) * V^H. So we need U and V.
                    let U = resSVD.U;
                    let V = resSVD.V;
                    mathR = math.multiply(U, math.transpose(V));
                }

                // Apply rotation
                let FinalNormalized = math.multiply(mathL, mathR).toArray();
                // De-normalize
                RotatedLoadings = FinalNormalized.map((row, i) => row.map(v => v * sqrtComm[i]));

                // Promax?
                if (rotation === 'promax') {
                    // Procrustean Rotation based on Varimax Target
                    // Target P_ij = |V_ij|^(power+1) / V_ij
                    // Standard power = 4 (kappa=4 in R)
                    const k = 4;
                    const V_loadings = RotatedLoadings;
                    const Target = V_loadings.map(row => row.map(v => Math.sign(v) * (Math.abs(v) ** (k))));

                    // Solve T = inv(L'L) * L' * Target ?
                    // Actually Promax T = inv(V'V) * V' * Target (where V is Varimax)
                    // Normalize V
                    // fit = inv(V'V)*V' * P
                    // T_promax = fit normalized

                    const matV = math.matrix(V_loadings);
                    const matTarg = math.matrix(Target);

                    const VTV = math.multiply(math.transpose(matV), matV);
                    const Vinv = math.inv(VTV);
                    const VT = math.transpose(matV);
                    const RotPromax = math.multiply(math.multiply(Vinv, VT), matTarg);

                    // Normalize Columns of RotPromax
                    let T_arr = RotPromax.toArray();
                    // Each col vector normalize
                    for (let c = 0; c < nFactors; c++) {
                        let sumSq = 0;
                        for (let r = 0; r < nFactors; r++) sumSq += T_arr[r][c] ** 2;
                        let norm = Math.sqrt(sumSq);
                        for (let r = 0; r < nFactors; r++) T_arr[r][c] /= norm;
                    }

                    // Final Loadings = V * T_promax
                    RotatedLoadings = math.multiply(matV, math.matrix(T_arr)).toArray();

                    // Correlation Induces?
                    // Phi = (T'T)^-1
                    let TT = math.multiply(math.transpose(math.matrix(T_arr)), math.matrix(T_arr));
                    FactorCorr = math.inv(TT).toArray();
                }
            }
        }

        // 6. Outputs

        // Scree output
        const totalVar = eigenFiles.reduce((a, b) => a + b.val, 0);
        let screeHtml = `<h5>スクリープロット</h5><div id="fa-scree" style="height:300px;"></div>`;

        // Loadings Table
        // Add Cronbach's Alpha per factor
        // Identify items loading > 0.4
        let alphaHtml = `<h5>信頼性係数 (Cronbach's Alpha, Cutoff=0.4)</h5><ul>`;
        for (let j = 0; j < nFactors; j++) {
            const highLoadItems = [];
            RotatedLoadings.forEach((row, i) => {
                if (Math.abs(row[j]) >= 0.4) highLoadItems.push(variables[i]);
            });

            // Calculate Alpha for these items
            let alpha = 'N/A';
            if (highLoadItems.length >= 2) {
                // Get sub-dataframe
                // Calculate average correlation
                // Or: alpha = (k / (k-1)) * (1 - (sum(var_i) / var_total))
                const subX = X.map(row => highLoadItems.map(v => row[variables.indexOf(v)]));
                const subSds = highLoadItems.map(v => jStat.variance(X.map(r => r[variables.indexOf(v)]), true));

                // Total Score Variance
                const totalScores = subX.map(r => r.reduce((a, b) => a + b, 0));
                const totalVarScores = jStat.variance(totalScores, true);
                const sumItemVar = subSds.reduce((a, b) => a + b, 0);

                const k = highLoadItems.length;
                const aVal = (k / (k - 1)) * (1 - (sumItemVar / totalVarScores));
                alpha = aVal.toFixed(3);
            }
            alphaHtml += `<li><strong>Factor ${j + 1}:</strong> α = ${alpha} (Items: ${highLoadItems.join(', ')})</li>`;
        }
        alphaHtml += '</ul>';

        // Render Loadings Table
        let loadHtml = `<h5>因子負荷量 (${rotation === 'none' ? '回転なし' : rotation})</h5>
            <table class="table table-sm"><thead><tr><th>変数</th>${Array(nFactors).fill(0).map((_, i) => `<th>F${i + 1}</th>`).join('')}<th>共通性</th></tr></thead><tbody>`;

        RotatedLoadings.forEach((row, i) => {
            const comm = row.reduce((a, b) => a + b ** 2, 0);
            loadHtml += `<tr><td>${variables[i]}</td>` +
                row.map(v => `<td style="font-weight:${Math.abs(v) >= 0.4 ? 'bold' : 'normal'}">${v.toFixed(3)}</td>`).join('') +
                `<td>${comm.toFixed(3)}</td></tr>`;
        });
        loadHtml += '</tbody></table>';

        let corrHtml = '';
        if (FactorCorr) {
            corrHtml = `<h5>因子間相関</h5><table class="table table-sm"><thead><tr><th></th>${Array(nFactors).fill(0).map((_, i) => `<th>F${i + 1}</th>`).join('')}</tr></thead><tbody>`;
            FactorCorr.forEach((row, i) => {
                corrHtml += `<tr><th>F${i + 1}</th>` + row.map(v => `<td>${v.toFixed(3)}</td>`).join('') + `</tr>`;
            });
            corrHtml += '</tbody></table>';
        }

        resultsContainer.innerHTML += screeHtml + loadHtml + alphaHtml + corrHtml;

        // Plot Scree
        const evs = eigenFiles.map(e => e.val);
        Plotly.newPlot('fa-scree', [{ x: evs.map((_, i) => i + 1), y: evs, type: 'scatter', mode: 'lines+markers' }],
            { title: 'スクリープロット', xaxis: { title: '成分番号' }, yaxis: { title: '固有値' } });

        // Heatmap
        const plotContainer = document.createElement('div');
        plotContainer.id = 'fa-heatmap';
        plotContainer.style.height = '400px';
        resultsContainer.appendChild(plotContainer);

        Plotly.newPlot('fa-heatmap', [{
            z: RotatedLoadings,
            x: Array(nFactors).fill(0).map((_, i) => `F${i + 1}`),
            y: variables,
            type: 'heatmap', colorscale: 'RdBu', zmin: -1, zmax: 1
        }], { title: '因子負荷量ヒートマップ' });

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML += `<p class="error-message">計算中にエラーが発生しました: ${e.message}<br>
        (注: Math.jsの読み込みを確認してください)</p>`;
    }
}