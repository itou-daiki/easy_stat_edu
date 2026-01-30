/**
 * @fileoverview 因子分析ヘルパー関数（回転アルゴリズム）
 * @module factor_analysis/helpers
 */

import { calculateCorrelationMatrix } from '../correlation.js';

/**
 * 行列乗算
 * @param {math.Matrix} A - 行列A
 * @param {math.Matrix} B - 行列B
 * @returns {math.Matrix} 積の行列
 */
export function matMul(A, B) { return math.multiply(A, B); }

/**
 * 行列転置
 * @param {math.Matrix} A - 行列
 * @returns {math.Matrix} 転置行列
 */
export function matTrans(A) { return math.transpose(A); }

/**
 * 逆行列
 * @param {math.Matrix} A - 行列
 * @returns {math.Matrix} 逆行列
 */
export function matInv(A) { return math.inv(A); }

/**
 * 対角成分抽出
 * @param {math.Matrix} A - 行列
 * @returns {Array} 対角成分
 */
export function matDiag(A) { return math.diag(A); }

/**
 * 因子抽出（主因子法）
 * @param {Array<string>} variables - 変数名配列
 * @param {number} numFactors - 抽出因子数
 * @param {Array<Object>} currentData - データ配列
 * @returns {{loadings: Array, eigenvalues: Array}} 因子負荷量と固有値
 */
export function exactFactors(variables, numFactors, currentData) {
    const data = currentData.map(row => variables.map(v => row[v]));
    const { matrix: corrMatrix } = calculateCorrelationMatrix(variables, currentData);
    const { values, vectors } = math.eigs(corrMatrix);

    const indices = Array.from(values.keys()).sort((a, b) => values[b] - values[a]);
    const sortedValues = indices.map(i => values[i]);
    const sortedVectors = indices.map(i => math.column(vectors, i));

    const loadings = [];
    for (let i = 0; i < variables.length; i++) {
        const row = [];
        for (let f = 0; f < numFactors; f++) {
            const eigVal = sortedValues[f];
            const eigVec = sortedVectors[f][i];
            row.push(eigVec * Math.sqrt(eigVal));
        }
        loadings.push(row);
    }

    return { loadings, eigenvalues: sortedValues };
}

/**
 * バリマックス回転
 * @param {Array<Array<number>>} loadings - 因子負荷量行列
 * @param {number} maxIter - 最大反復回数
 * @param {number} epsilon - 収束判定閾値
 * @returns {Array<Array<number>>} 回転後の因子負荷量
 */
export function calculateVarimax(loadings, maxIter = 50, epsilon = 1e-6) {
    const p = loadings.length;
    const k = loadings[0].length;
    let R = loadings.map(row => row.slice());
    let d = 0;

    for (let iter = 0; iter < maxIter; iter++) {
        let dOld = d;
        d = 0;

        for (let i = 0; i < k - 1; i++) {
            for (let j = i + 1; j < k; j++) {
                let sum_d = 0, sum_c = 0, sum_d2_minus_c2 = 0, sum_2dc = 0;

                for (let r = 0; r < p; r++) {
                    const x = R[r][i], y = R[r][j];
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
                    const cos = Math.cos(theta), sin = Math.sin(theta);
                    for (let r = 0; r < p; r++) {
                        const x = R[r][i], y = R[r][j];
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

/**
 * プロマックス回転
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {number} kappa - 回転強度パラメータ
 * @returns {{loadings: Array, correlations: Array}} 回転後負荷量と因子間相関
 */
export function calculatePromax(loadings, kappa = 4) {
    const varimaxLoadings = calculateVarimax(loadings);
    const V = varimaxLoadings;
    const rows = V.length;
    const cols = V[0].length;

    const H = [];
    for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
            const val = V[i][j];
            row.push(Math.pow(Math.abs(val), kappa - 1) * val);
        }
        H.push(row);
    }

    const V_mat = math.matrix(V);
    const H_mat = math.matrix(H);
    const V_t = matTrans(V_mat);
    const VtV = matMul(V_t, V_mat);

    let VtV_inv;
    try {
        VtV_inv = matInv(VtV);
    } catch (e) {
        console.warn("Promax: Singular matrix, using identity fallback");
        VtV_inv = math.identity(cols);
    }

    const VtH = matMul(V_t, H_mat);
    const M_mat = matMul(VtV_inv, VtH);
    const M = M_mat.toArray();
    const T = [];

    for (let j = 0; j < cols; j++) {
        let sumSq = 0;
        for (let i = 0; i < cols; i++) sumSq += M[i][j] * M[i][j];
        const norm = Math.sqrt(sumSq);
        for (let i = 0; i < cols; i++) {
            if (!T[i]) T[i] = [];
            T[i][j] = M[i][j] / norm;
        }
    }

    const T_mat = math.matrix(T);
    const L_promax_mat = matMul(V_mat, T_mat);
    const L_promax = L_promax_mat.toArray();

    const T_t = matTrans(T_mat);
    const TtT = matMul(T_t, T_mat);
    const Phi_mat = matInv(TtT);
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

/**
 * 勾配射影法（斜交回転用汎用アルゴリズム）
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {Function} gradientFn - 勾配関数
 * @param {number} maxIter - 最大反復回数
 * @param {number} epsilon - 収束判定閾値
 * @returns {{loadings: Array, correlations: Array}} 回転後負荷量と因子間相関
 */
export function calculateGradientProjection(loadings, gradientFn, maxIter = 500, epsilon = 1e-5) {
    const p = loadings.length;
    const k = loadings[0].length;
    const A = math.matrix(loadings);
    let T_arr = math.identity(k).toArray();

    for (let iter = 0; iter < maxIter; iter++) {
        const T_mat = math.matrix(T_arr);
        let T_inv;
        try {
            T_inv = math.inv(T_mat);
        } catch (e) {
            T_arr = math.identity(k).toArray();
            T_inv = math.identity(k);
        }

        const L_mat = matMul(A, matTrans(T_inv));
        const L = L_mat.toArray();
        const G = gradientFn(L);
        const G_mat = math.matrix(G);

        const Lt = matTrans(L_mat);
        const LtG = matMul(Lt, G_mat);
        const negLtG = math.multiply(LtG, -1);
        const GradientT = matMul(negLtG, T_mat);

        const Tt = matTrans(T_mat);
        const TtX = matMul(Tt, GradientT);
        const diagVals = [];
        for (let i = 0; i < k; i++) diagVals.push(TtX.get([i, i]));
        const diagMat = math.diag(diagVals);
        const correction = matMul(T_mat, diagMat);
        const ProjGrad = math.subtract(GradientT, correction);

        const PG_arr = ProjGrad.toArray();
        let sumSq = 0;
        for (let i = 0; i < k; i++) {
            for (let j = 0; j < k; j++) sumSq += PG_arr[i][j] ** 2;
        }
        if (Math.sqrt(sumSq) < epsilon) break;

        const stepMap = math.multiply(ProjGrad, 0.5);
        const T_next_mat = math.subtract(T_mat, stepMap);
        let T_next = T_next_mat.toArray();

        for (let j = 0; j < k; j++) {
            let colSq = 0;
            for (let i = 0; i < k; i++) colSq += T_next[i][j] ** 2;
            const norm = Math.sqrt(colSq);
            for (let i = 0; i < k; i++) T_next[i][j] /= norm;
        }
        T_arr = T_next;
    }

    const T_final_mat = math.matrix(T_arr);
    const T_inv_final = math.inv(T_final_mat);
    const L_final_mat = matMul(A, matTrans(T_inv_final));
    const Phi_mat = matMul(matTrans(T_final_mat), T_final_mat);

    return { loadings: L_final_mat.toArray(), correlations: Phi_mat.toArray() };
}

/**
 * ダイレクト・オブリミン回転
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {number} gamma - ガンマパラメータ
 * @returns {{loadings: Array, correlations: Array}} 回転後負荷量と因子間相関
 */
export function calculateDirectOblimin(loadings, gamma = 0) {
    const p = loadings.length;

    const gradientFn = (L) => {
        const k = L[0].length;
        const G = L.map(row => row.slice().fill(0));
        const colSumSq = Array(k).fill(0);
        const L2 = L.map(r => r.map(v => v * v));

        for (let j = 0; j < k; j++) {
            for (let i = 0; i < p; i++) colSumSq[j] += L2[i][j];
        }

        for (let i = 0; i < p; i++) {
            for (let s = 0; s < k; s++) {
                let term1 = 0, term2 = 0;
                for (let factor = 0; factor < k; factor++) {
                    if (factor === s) continue;
                    term1 += L2[i][factor];
                    term2 += colSumSq[factor];
                }
                G[i][s] = 2 * L[i][s] * (term1 - (gamma / p) * term2);
            }
        }
        return G;
    };

    return calculateGradientProjection(loadings, gradientFn);
}

/**
 * ジェオミン回転
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {number} epsilon - 正則化パラメータ
 * @returns {{loadings: Array, correlations: Array}} 回転後負荷量と因子間相関
 */
export function calculateGeomin(loadings, epsilon = 0.01) {
    const p = loadings.length;

    const gradientFn = (L) => {
        const k = L[0].length;
        const G = L.map(row => row.slice().fill(0));
        const L2 = L.map(r => r.map(v => v * v + epsilon));

        for (let i = 0; i < p; i++) {
            let prod = 1;
            for (let j = 0; j < k; j++) prod *= L2[i][j];
            const Pi = Math.pow(prod, 1 / k);

            for (let s = 0; s < k; s++) {
                G[i][s] = (2.0 / k) * (L[i][s] / L2[i][s]) * Pi;
            }
        }
        return G;
    };

    return calculateGradientProjection(loadings, gradientFn);
}
