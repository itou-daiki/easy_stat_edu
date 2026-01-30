/**
 * @fileoverview 主成分分析ヘルパー関数
 * @module pca/helpers
 */

import { calculateCorrelationMatrix } from '../correlation.js';

/**
 * 主成分分析を実行
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Object>} currentData - データ配列
 * @returns {Object} { eigenvalues, vectors, scores }
 */
export function performPCA(variables, currentData) {
    if (variables.length < 2) {
        throw new Error('変数を2つ以上選択してください');
    }

    // データの標準化（Zスコア）
    const means = [];
    const stds = [];

    variables.forEach(v => {
        const vals = currentData.map(r => r[v]);
        means.push(jStat.mean(vals));
        stds.push(jStat.stdev(vals, true));
    });

    // 行列データの作成 (標準化)
    const matrix = currentData.map(row => {
        return variables.map((v, i) => (row[v] - means[i]) / stds[i]);
    });

    // 相関行列の計算
    const { matrix: corrMatrix } = calculateCorrelationMatrix(variables, currentData);

    // 固有値分解
    const { values, vectors } = math.eigs(corrMatrix);

    // ソート
    const indices = Array.from(values.keys()).sort((a, b) => values[b] - values[a]);
    const sortedValues = indices.map(i => values[i]);

    // math.column returns a Matrix or Array depending on input. 
    // We want to ensure we have a usable vector for dot product.
    // Assuming vectors is Matrix or Array of Arrays.
    const sortedVectors = indices.map(i => {
        const col = math.column(vectors, i);
        // If it's a matrix object, flatten it to array
        return Array.isArray(col) ? col : (col.toArray ? col.toArray().flat() : col);
    });

    // 主成分スコアの計算
    const pcScores = matrix.map(row => {
        return sortedVectors.map(vec => math.dot(row, vec));
    });

    return {
        eigenvalues: sortedValues,
        vectors: sortedVectors,
        scores: pcScores
    };
}
