import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';
import { calculateCorrelationMatrix } from './correlation.js';

// 因子抽出（主因子法）
function exactFactors(variables, numFactors, currentData) {
    const data = currentData.map(row => variables.map(v => row[v]));
    // 実際には多変量解析ライブラリが必要だが、jStatやmath.jsだけでは困難。
    // ここではPCAをベースにした簡易的なエミュレーションを行う
    // 本来の因子分析は共通性の推定などが必要

    // 1. 相関行列の計算 (共通化された関数を利用)
    const { matrix: corrMatrix } = calculateCorrelationMatrix(variables, currentData);

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




// 行列演算ヘルパー
function matMul(A, B) { return math.multiply(A, B); }
function matTrans(A) { return math.transpose(A); }
function matInv(A) { return math.inv(A); }
function matDiag(A) {
    // math.diag behavior depends on input, handle 2D matrix vs vector if needed
    // Here assuming A is a matrix, returns vector diagonal
    return math.diag(A);
}

// 3. バリマックス回転 (Varimax Rotation)
function calculateVarimax(loadings, maxIter = 50, epsilon = 1e-6) {
    const p = loadings.length;       // 変数数
    const k = loadings[0].length;    // 因子数
    let R = loadings.map(row => row.slice()); // 複製
    let d = 0;

    for (let iter = 0; iter < maxIter; iter++) {
        let dOld = d;
        d = 0;

        for (let i = 0; i < k - 1; i++) {
            for (let j = i + 1; j < k; j++) {
                let sum_d = 0;
                let sum_c = 0;
                let sum_d2_minus_c2 = 0;
                let sum_2dc = 0;

                for (let r = 0; r < p; r++) {
                    const x = R[r][i];
                    const y = R[r][j];
                    const d_val = x * x - y * y;
                    const c_val = 2 * x * y;

                    sum_d += d_val;
                    sum_c += c_val;
                    sum_d2_minus_c2 += (d_val * d_val - c_val * c_val);
                    sum_2dc += (2 * d_val * c_val);
                }

                const numer = 2 * (p * sum_2dc - sum_d * sum_c);
                const denom = p * sum_d2_minus_c2 - (sum_d * sum_d - sum_c * sum_c);
                const theta = Math.atan2(numer, denom) / 4;

                if (Math.abs(theta) > epsilon) {
                    d += Math.abs(theta);
                    const cos = Math.cos(theta);
                    const sin = Math.sin(theta);

                    for (let r = 0; r < p; r++) {
                        const x = R[r][i];
                        const y = R[r][j];
                        R[r][i] = x * cos + y * sin;
                        R[r][j] = -x * sin + y * cos;
                    }
                }
            }
        }
        if (d < epsilon) break;
    }
    return R;
}

// 4. プロマックス回転 (Promax Rotation)
// kappa=4 is standard.
function calculatePromax(loadings, kappa = 4) {
    // 1. まずバリマックス回転を行う
    const varimaxLoadings = calculateVarimax(loadings);

    // 2. ターゲット行列 P の作成: P_ij = |L_ij|^(kappa-1) * L_ij
    // (符号を維持したまま、絶対値をkappa乗) -> 実質 P = |L|^kappa * sgn(L) / |L| = |L|^(k-1) * L ?
    // 定義: H_ij = |v_ij|^(k+1) / v_ij という記述もあるが、通常は H = |V|^k * sgn(V) ?
    // 多くの実装では H_ij = |V_ij|^(kappa) * sgn(V_ij)  (要素ごとの演算)
    // ここでは kappa=4 なので 4乗... ではなく、power parameter k=4 の場合、
    // H = abs(V).^(k) .* sign(V) が一般的 (k=3 or 4)
    // Python factor_analyzer defaults to power=4

    // Varimax行列を V とする
    const V = varimaxLoadings;
    const rows = V.length;
    const cols = V[0].length;

    // Target Matrix H
    const H = [];
    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
            const val = V[i][j];
            // H_ij = |val|^3 * val (if kappa=4 in mathematical sense implies power=4?)
            // factor_analyzer uses: target = np.abs(loadings)**(power-1) * loadings
            // default power=4 -> |L|^3 * L.
            row.push(Math.pow(Math.abs(val), kappa - 1) * val);
        }
        H.push(row);
    }

    // 3. 変換行列 T の計算 (最小二乗法)
    // T = (V'V)^(-1) V' H
    // math.js を使用して計算

    // V_matrix (p x k)
    // H_matrix (p x k)

    const V_mat = math.matrix(V);
    const H_mat = math.matrix(H);
    const V_t = matTrans(V_mat);  // (k x p)

    // V'V (k x k)
    const VtV = matMul(V_t, V_mat);

    // (V'V)^-1
    let VtV_inv;
    try {
        VtV_inv = matInv(VtV);
    } catch (e) {
        console.warn("Promax: Singular matrix, using pseudo-inverse or identify fallback");
        VtV_inv = math.identity(cols); // Fallback
    }

    // M = (V'V)^-1 * V' * H
    // Step 1: temp = V' * H (k x k)
    const VtH = matMul(V_t, H_mat);
    // Step 2: M = VtV_inv * temp
    const M_mat = matMul(VtV_inv, VtH);

    // 4. 正規化: T の各列ベクトルを正規化する
    // T = M * D^(-1), where D = sqrt(diag(M'M)) ? 
    // 通常、T = inv(diag(sqrt(diag(inv(M'M))))) * M ? No.
    // Standard Promax normalize columns of T to have unit length?
    // Or normalize columns of Rotated Loadings?
    // "We normalize the columns of the transformation matrix T."

    const M = M_mat.toArray(); // Array of arrays
    const T = []; // Will construct T manually column by column

    // Transpose M to iterate easier? Or just loop cols
    // M is (k x k)

    for (let j = 0; j < cols; j++) {
        // Extract column j
        let sumSq = 0;
        for (let i = 0; i < cols; i++) {
            sumSq += M[i][j] * M[i][j];
        }
        const norm = Math.sqrt(sumSq);

        // Normalize column
        for (let i = 0; i < cols; i++) {
            if (!T[i]) T[i] = [];
            T[i][j] = M[i][j] / norm;
        }
    }

    // 5. 回転後の負荷量行列 L_promax = V * T
    const T_mat = math.matrix(T);
    const L_promax_mat = matMul(V_mat, T_mat);
    const L_promax = L_promax_mat.toArray();

    // 6. 因子間相関行列 Phi = (T' T)^(-1)
    // Note: If T columns are normalized, T'T has 1 on diagonal? Not necessarily if oblique.
    // Correct formula for factor correlations in Promax is (T'T)^(-1) assuming P = A T.

    const T_t = matTrans(T_mat);
    const TtT = matMul(T_t, T_mat);
    const Phi_mat = matInv(TtT);

    // 正規化して相関行列にする (対角成分を1にする)
    const Phi = Phi_mat.toArray();
    const corrMatrix = [];
    for (let i = 0; i < cols; i++) {
        corrMatrix[i] = [];
        for (let j = 0; j < cols; j++) {
            const val = Phi[i][j];
            const div = Math.sqrt(Phi[i][i] * Phi[j][j]);
            corrMatrix[i][j] = val / div;
        }
    }

    return { loadings: L_promax, correlations: corrMatrix };
}

// 5. ダイレクト・オブリミン回転 (placeholder / simplified)
// 5. 汎用的な勾配射影法 (Gradient Projection Algorithm) for Oblique Rotation
// Reference: Bernaards, C. A., & Jennrich, R. I. (2005). Gradient projection algorithms...
function calculateGradientProjection(loadings, gradientFn, maxIter = 500, epsilon = 1e-5) {
    const p = loadings.length;
    const k = loadings[0].length;

    // 初期負荷量行列 A (直交解)
    const A = math.matrix(loadings);

    // 初期変換行列 T = I
    let T = math.identity(k);
    let T_arr = T.toArray();

    let alpha = 1.0; // 初期ステップサイズ

    for (let iter = 0; iter < maxIter; iter++) {
        const T_mat = math.matrix(T_arr);
        let T_inv;
        try {
            T_inv = math.inv(T_mat);
        } catch (e) {
            console.warn("GP: Singular T matrix, resetting to I");
            T_arr = math.identity(k).toArray();
            T_inv = math.identity(k);
        }

        // 現在の負荷量 L = A * (T')^-1 = A * (T^-1)^T
        const L_mat = matMul(A, matTrans(T_inv));
        const L = L_mat.toArray();

        // 勾配 G = dQ/dL
        const G = gradientFn(L);
        const G_mat = math.matrix(G);

        // Tに関する勾配: dQ/dT = - (L' * G) * T
        // math.js での計算: -(L' * G) * T
        const Lt = matTrans(L_mat);
        const LtG = matMul(Lt, G_mat);
        const negLtG = math.multiply(LtG, -1);
        const GradientT = matMul(negLtG, T_mat);

        // 射影 (Projection onto Normal Oblique Manifold: diag(T'*T) = I を保つための接空間への射影)
        // P(X) = X - T * diag(T' * X)
        const Tt = matTrans(T_mat);
        const TtX = matMul(Tt, GradientT);
        // TtX の対角成分のみ抽出して対角行列にする
        const diagVals = [];
        for (let i = 0; i < k; i++) diagVals.push(TtX.get([i, i]));
        const diagMat = math.diag(diagVals);

        const correction = matMul(T_mat, diagMat);
        const ProjGrad = math.subtract(GradientT, correction);

        // 収束判定 (射影勾配のノルム)
        const PG_arr = ProjGrad.toArray();
        let sumSq = 0;
        for (let i = 0; i < k; i++) {
            for (let j = 0; j < k; j++) sumSq += PG_arr[i][j] ** 2;
        }
        const gradNorm = Math.sqrt(sumSq);

        if (gradNorm < epsilon) break;

        // 更新: T_new = T - alpha * ProjGrad
        // 単純な勾配法 (固定ステップ)。必要に応じてラインサーチを入れるが、今回は簡易実装。
        // 発散を防ぐため、ステップサイズを小さめにするか調整
        const stepMap = math.multiply(ProjGrad, 0.5); // alpha=0.5
        const T_next_mat = math.subtract(T_mat, stepMap);
        let T_next = T_next_mat.toArray();

        // 正規化 (各列のノルムを1にする)
        for (let j = 0; j < k; j++) {
            let colSq = 0;
            for (let i = 0; i < k; i++) colSq += T_next[i][j] ** 2;
            const norm = Math.sqrt(colSq);
            for (let i = 0; i < k; i++) T_next[i][j] /= norm;
        }

        T_arr = T_next;
    }

    // 最終的な L と Phi を計算
    const T_final_mat = math.matrix(T_arr);
    const T_inv_final = math.inv(T_final_mat);
    const L_final_mat = matMul(A, matTrans(T_inv_final));

    // Factor Correlations Phi = T' * T
    const Phi_mat = matMul(matTrans(T_final_mat), T_final_mat);

    return {
        loadings: L_final_mat.toArray(),
        correlations: Phi_mat.toArray()
    };
}

// 6. ダイレクト・オブリミン回転 (Strict Implementation)
function calculateDirectOblimin(loadings, gamma = 0) {
    const p = loadings.length;

    // Gradient Function for Oblimin
    // G_is = L_is * [ sum(L_ik^2 for k!=s) - (gamma/p) * sum( sum(L_rk^2) for r ) ] ?
    // 正確な微分: dQ/dlam_is = 2 * lam_is * sum_{k!=s} ( lam_ik^2 - (gamma/p)*sum_r(lam_rk^2) ) ?
    // Check factor_analyzer logic:
    // G = L * ( theta - gamma/p * sum(...) ) ?
    // Let's use the explicit element-wise derivative derived earlier:
    // G_is = 2 * L_is * [ sum_{k!=s} L_ik^2 - (gamma/p) * sum_{k!=s} (sum_r L_rk^2) ]

    const gradientFn = (L) => {
        const k = L[0].length;
        const G = L.map(row => row.slice().fill(0));

        // 列ごとの二乗和を事前計算 (sum_r L_rk^2)
        const colSumSq = Array(k).fill(0);
        const L2 = L.map(r => r.map(v => v * v));

        for (let j = 0; j < k; j++) {
            for (let i = 0; i < p; i++) colSumSq[j] += L2[i][j];
        }

        for (let i = 0; i < p; i++) {
            for (let s = 0; s < k; s++) {
                let term1 = 0; // sum_{k!=s} L_ik^2
                let term2 = 0; // sum_{k!=s} colSumSq[k]

                for (let factor = 0; factor < k; factor++) {
                    if (factor === s) continue;
                    term1 += L2[i][factor];
                    term2 += colSumSq[factor];
                }

                // Partial derivative
                // The term -gamma/p needs to be applied carefully.
                // Standard Direct Oblimin Criterion: sum_{j<k} ( sum L_ij^2 L_ik^2 - gamma/p * sum L_ij^2 * sum L_ik^2 )
                // Deriv wrt L_is:
                // = sum_{k!=s} [ 2 L_is L_ik^2 - (gamma/p) * ( 2 L_is * colSumSq[k] ) ]
                // = 2 * L_is * sum_{k!=s} [ L_ik^2 - (gamma/p) * colSumSq[k] ]

                G[i][s] = 2 * L[i][s] * (term1 - (gamma / p) * term2);
            }
        }
        return G;
    };

    return calculateGradientProjection(loadings, gradientFn);
}

// 7. ジェオミン回転 (Geomin Rotation)
function calculateGeomin(loadings, epsilon = 0.01) {
    const p = loadings.length;

    const gradientFn = (L) => {
        const k = L[0].length;
        const G = L.map(row => row.slice().fill(0));
        const L2 = L.map(r => r.map(v => v * v + epsilon)); // L^2 + eps

        for (let i = 0; i < p; i++) {
            // product_term P_i = ( prod_j (L_ij^2 + eps) )^(1/k)
            let prod = 1;
            for (let j = 0; j < k; j++) prod *= L2[i][j];
            const Pi = Math.pow(prod, 1 / k);

            for (let s = 0; s < k; s++) {
                // dQ/dL_is = (2/k) * (L_is / (L_is^2 + eps)) * Pi
                G[i][s] = (2.0 / k) * (L[i][s] / L2[i][s]) * Pi;
            }
        }
        return G;
    };

    return calculateGradientProjection(loadings, gradientFn);
}

function runFactorAnalysis(currentData) {
    const varsSelect = document.getElementById('factor-vars');
    const variables = Array.from(varsSelect.selectedOptions).map(o => o.value);
    const numFactors = parseInt(document.getElementById('num-factors').value, 10);
    const rotationMethod = document.getElementById('rotation-method').value;

    if (variables.length < 3) {
        alert('変数を3つ以上選択してください');
        return;
    }
    if (isNaN(numFactors) || numFactors < 1) {
        alert('因子数を正しく指定してください');
        return;
    }

    try {
        const result = exactFactors(variables, numFactors, currentData);
        let loadings = result.loadings;
        const eigenvalues = result.eigenvalues;
        let factorCorrelations = null;

        // 回転の適用
        let rotatedStats = null;

        if (rotationMethod === 'varimax') {
            loadings = calculateVarimax(loadings);
        } else if (rotationMethod === 'promax') {
            const res = calculatePromax(loadings, 4); // kappa=4
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'oblimin') {
            const res = calculateDirectOblimin(loadings, 0); // gamma=0
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'geomin') {
            const res = calculateGeomin(loadings, 0.01); // epsilon=0.01
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        }

        // 回転後の負荷量二乗和 (SS Loadings)
        // 斜交回転の場合、Sum of Squared Loadings は単なる二乗和でいいのか？
        // 通常は Structure Matrix の二乗和を見ることもあるが、Pattern Matrixの二乗和を表示しておく。
        const numVars = variables.length;
        const colSS = Array(numFactors).fill(0);

        for (let i = 0; i < numVars; i++) {
            for (let j = 0; j < numFactors; j++) {
                colSS[j] += loadings[i][j] ** 2;
            }
        }

        let cumulative = 0;
        rotatedStats = colSS.map(val => {
            const contribution = (val / numVars) * 100;
            cumulative += contribution;
            return {
                eigenvalue: val,
                contribution: contribution,
                cumulative: cumulative
            };
        });

        displayEigenvalues(eigenvalues, rotatedStats);
        displayLoadings(variables, loadings, rotationMethod);

        // 因子間相関行列の表示 (斜交回転のみ)
        if (['promax', 'oblimin'].includes(rotationMethod) && factorCorrelations) {
            displayFactorCorrelations(factorCorrelations);
        } else {
            // コンテナを空にする/隠す
            const container = document.getElementById('factor-correlations');
            if (container) container.innerHTML = '';
        }

        displayFactorInterpretation(variables, loadings);
        plotScree(eigenvalues);
        plotLoadingsHeatmap(variables, loadings, rotationMethod);

        document.getElementById('analysis-results').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert('計算中にエラーが発生しました。データを確認してください。');
    }
}

function displayEigenvalues(eigenvalues, rotatedStats) {
    const container = document.getElementById('eigenvalues-table');
    const totalVariance = eigenvalues.length; // Total variance = number of variables (standardized)

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th rowspan="2">因子 (成分)</th>
                        <th colspan="3" style="text-align: center; border-bottom: 2px solid #e2e8f0;">初期固有値 (Initial Eigenvalues)</th>
                        ${rotatedStats ? `<th colspan="3" style="text-align: center; border-bottom: 2px solid #e2e8f0; background: #ebf8ff;">回転後の負荷量二乗和 (Rotation Sums of Squared Loadings)</th>` : ''}
                    </tr>
                    <tr>
                        <th style="font-size: 0.9em;">合計</th>
                        <th style="font-size: 0.9em;">寄与率 (%)</th>
                        <th style="font-size: 0.9em;">累積 (%)</th>
                        ${rotatedStats ? `
                        <th style="font-size: 0.9em; background: #ebf8ff;">合計</th>
                        <th style="font-size: 0.9em; background: #ebf8ff;">寄与率 (%)</th>
                        <th style="font-size: 0.9em; background: #ebf8ff;">累積 (%)</th>` : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    let cumulativeInitial = 0;

    // 表示するのは抽出した因子数分だけにするか、全成分表示するか？
    // 通常、初期固有値は全成分表示するが、回転後は抽出因子のみ。
    // ここではシンプルに「抽出された因子数」分だけを表示する（scree plotで全体は見れるので）
    // いや、初期固有値表は通常すべて見せるのが一般的だが、スペースの都合上、上位のみ + numFactors までを強調がいいか。
    // 今回は `rotatedStats` がある場合は `rotatedStats.length` (つまり numFactors) 分だけ行を作って比較表示するのが親切。

    // しかしeigenvaluesは全変数分ある。
    const numRows = rotatedStats ? rotatedStats.length : eigenvalues.length;

    for (let i = 0; i < numRows; i++) {
        const val = eigenvalues[i];
        const contribution = (val / totalVariance) * 100;
        cumulativeInitial += contribution;

        // 初期固有値の強調
        const style = val >= 1.0 ? 'font-weight: bold;' : '';

        html += `
            <tr>
                <td>第${i + 1}成分</td>
                <td style="${style}">${val.toFixed(3)}</td>
                <td>${contribution.toFixed(2)}</td>
                <td>${cumulativeInitial.toFixed(2)}</td>
                ${rotatedStats && rotatedStats[i] ? `
                <td style="background: #ebf8ff; font-weight: bold;">${rotatedStats[i].eigenvalue.toFixed(3)}</td>
                <td style="background: #ebf8ff;">${rotatedStats[i].contribution.toFixed(2)}</td>
                <td style="background: #ebf8ff;">${rotatedStats[i].cumulative.toFixed(2)}</td>
                ` : (rotatedStats ? '<td colspan="3" style="background: #ebf8ff;">-</td>' : '')}
            </tr>
        `;
    }

    // もし回転なしで、かつ因子数 < 変数数 の場合、残りの成分も表示する？
    // シンプルにするため、回転ありの場合は「抽出された因子」の比較にフォーカスしてリストを止める。
    // 回転なしの場合はすべて表示する。

    if (!rotatedStats && numRows < eigenvalues.length) {
        for (let i = numRows; i < eigenvalues.length; i++) {
            const val = eigenvalues[i];
            const contribution = (val / totalVariance) * 100;
            cumulativeInitial += contribution;
            html += `
                <tr style="color: #a0aec0;">
                    <td>第${i + 1}成分</td>
                    <td>${val.toFixed(3)}</td>
                    <td>${contribution.toFixed(2)}</td>
                    <td>${cumulativeInitial.toFixed(2)}</td>
                </tr>
            `;
        }
    }

    html += '</tbody></table></div>';

    if (rotatedStats) {
        html += `<p style="font-size: 0.85rem; color: #4a5568; margin-top: 0.5rem;">※ 回転を行うと、因子の分散（固有値に相当）が再配分されますが、累積寄与率の合計は変わりません。</p>`;
    }

    container.innerHTML = html;
}

function displayLoadings(variables, loadings, rotation) {
    const container = document.getElementById('loadings-table');
    const numFactors = loadings[0].length;
    const rotationText = rotation === 'varimax' ? ' (バリマックス回転後)' : ' (回転なし)';

    let html = `
        <div class="table-container">
            <p>※ 因子負荷量${rotationText}</p>
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${Array.from({ length: numFactors }, (_, i) => `<th>第${i + 1}因子</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((v, i) => {
        html += `<tr><td><strong>${v}</strong></td>`;
        loadings[i].forEach(l => {
            // 絶対値0.4以上を強調
            const style = Math.abs(l) > 0.4 ? 'background: rgba(30, 144, 255, 0.1); font-weight: bold;' : '';
            html += `<td style="${style}">${l.toFixed(3)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function displayFactorInterpretation(variables, loadings) {
    const container = document.getElementById('factor-interpretation');
    const numFactors = loadings[0].length;
    const threshold = 0.4;

    let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
    `;

    for (let f = 0; f < numFactors; f++) {
        // 各因子の負荷量を取得
        const factorsLoadings = variables.map((v, i) => ({
            name: v,
            loading: loadings[i][f],
            absLoading: Math.abs(loadings[i][f])
        }));

        // 負荷量の絶対値で降順ソート
        factorsLoadings.sort((a, b) => b.absLoading - a.absLoading);

        // 閾値以上の変数を抽出
        const strongVars = factorsLoadings.filter(item => item.absLoading >= threshold);

        html += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <h5 style="color: #2d3748; margin-top: 0; margin-bottom: 1rem; border-bottom: 2px solid #805ad5; padding-bottom: 0.5rem; display: inline-block;">
                    第${f + 1}因子
                </h5>
                ${strongVars.length > 0 ? `
                    <ul style="padding-left: 0; list-style: none;">
                        ${strongVars.map(item => `
                            <li style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: bold; color: ${item.loading > 0 ? '#2b6cb0' : '#c53030'};">
                                    ${item.name}
                                </span>
                                <span style="background: #edf2f7; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                                    負荷量: ${item.loading.toFixed(3)}
                                </span>
                            </li>
                        `).join('')}
                    </ul>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #718096;">
                        <i class="fas fa-search"></i> 
                        <strong>解釈のヒント:</strong> これらの変数の共通点は何でしょうか？
                    </p>
                ` : `
                    <p style="color: #718096;">
                        負荷量が0.4以上の変数は見つかりませんでした。
                    </p>
                `}
            </div>
        `;
    }

    html += '</div>';
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
        xaxis: { title: '成分番号' },
        yaxis: { title: '固有値' },
        shapes: [shape]
    };

    Plotly.newPlot('scree-plot', [trace], layout, createPlotlyConfig('因子分析_スクリープロット', []));
}

function plotLoadingsHeatmap(variables, loadings, rotation) {
    const rotationText = rotation === 'varimax' ? ' (Varimax)' : ' (None)';

    // 転置して (Factor x Variable) にする
    const z = loadings[0].map((_, colIndex) => loadings.map(row => row[colIndex]));
    const components = Array.from({ length: loadings[0].length }, (_, i) => `第${i + 1}因子`);

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
        title: `因子負荷量ヒートマップ${rotationText}`,
        height: 300 + (components.length * 30),
        xaxis: { side: 'bottom' }
    };

    Plotly.newPlot('loadings-heatmap', data, layout, createPlotlyConfig('因子分析_負荷量', variables));
}


export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="factor-analysis-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 因子分析 (Factor Analysis)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">多数の変数の背後にある共通因子を探索します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 因子分析とは？</strong>
                        <p>観測された変数（テストの点数など）の背後に、それらを支配する潜在的な要因（数学的能力、言語能力など）があると仮定し、その構造を明らかにします。</p>
                    </div>
                    <h4>回転 (Rotation) について</h4>
                    <ul>
                        <li><strong>なし (None):</strong> 初期解のまま。解釈しにくいことが多いです。</li>
                        <li><strong>バリマックス (Varimax):</strong> 直交回転の一種。因子ごとの負荷量の分散を最大化し、「単純構造」を目指します。各因子が明確に一部の変数と強く関係するようになります。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="fa-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="factor-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                
                <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">
                    <div style="flex: 1; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                         <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                             <i class="fas fa-sort-numeric-up"></i> 抽出する因子数:
                         </label>
                         <input type="number" id="num-factors" value="2" min="1" max="10" style="padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; width: 100%;">
                    </div>
                    
                    <div style="flex: 1; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                         <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                             <i class="fas fa-sync-alt"></i> 回転方法:
                         </label>
                         <select id="rotation-method" style="padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; width: 100%;">
                             <option value="none">なし (None)</option>
                             <option value="varimax" selected>バリマックス回転 (Varimax)</option>
                             <option value="promax">プロマックス回転 (Promax)</option>
                             <option value="oblimin">ダイレクト・オブリミン回転 (Direct Oblimin)</option>
                             <option value="geomin">ジェオミン回転 (Geomin)</option>
                         </select>
                    </div>
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
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-th"></i> 因子負荷量</h4>
                     <div id="loadings-table"></div>
                     <div id="loadings-heatmap" style="margin-top: 1.5rem;"></div>
                 </div>

                 <!-- 因子間相関行列 (斜交回転時のみ表示) -->
                 <div id="factor-correlations-container">
                    <div id="factor-correlations" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;"></div>
                 </div>

                 <!-- 因子解釈のサマリーエリア -->
                 <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-lightbulb"></i> 因子の解釈 (Factor Interpretation)</h4>
                     <p style="color: #4a5568; margin-bottom: 1rem;">負荷量の絶対値が高い項目 (≧ 0.4) をリストアップしました。</p>
                     <div id="factor-interpretation"></div>
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

    createAnalysisButton('run-factor-btn-container', '因子分析を実行', () => runFactorAnalysis(currentData), { id: 'run-factor-btn' });
}

// Helper to display Factor Correlations
function displayFactorCorrelations(corrMatrix) {
    const container = document.getElementById('factor-correlations');
    if (!corrMatrix || !container) return; // container might be missing if re-rendered? 
    // Wait, the container is inside #analysis-results which is static in render(), but innerHTML runs once.

    // Check if we need to show/hide the whole container div
    const wrapper = document.getElementById('factor-correlations-container');
    if (wrapper) wrapper.style.display = 'block';

    const numFactors = corrMatrix.length;
    let html = `
        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> 因子間相関行列 (Factor Correlations)</h4>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>因子</th>
                        ${Array.from({ length: numFactors }, (_, i) => `<th>第${i + 1}因子</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    for (let i = 0; i < numFactors; i++) {
        html += `<tr><td><strong>第${i + 1}因子</strong></td>`;
        for (let j = 0; j < numFactors; j++) {
            const val = corrMatrix[i][j];
            // Weak < 0.2, Moderate 0.2-0.4, Strong > 0.4 ?
            let bg = '';
            const absVal = Math.abs(val);
            if (i !== j && absVal > 0.3) bg = 'background: rgba(236, 201, 75, 0.2); font-weight: bold;';

            html += `<td style="${bg}">${val.toFixed(3)}</td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    html += `<p style="font-size: 0.85rem; color: #4a5568; margin-top: 0.5rem;">※ 因子の相関が高い場合、プロマックスなどの斜交回転が適しています。</p>`;

    container.innerHTML = html;
}
