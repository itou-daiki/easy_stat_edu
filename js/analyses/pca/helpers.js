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
    const { matrix: corrMatrix } = calculateCorrelationMatrix(variables, currentData, { useListwise: true });

    // 固有値分解
    const eigResult = math.eigs(corrMatrix);
    // math.js >= 11: { values: Array, eigenvectors: [{value, vector}] }
    // math.js < 11:  { values: Array, vectors: Matrix }
    let sortedValues, sortedVectors;
    if (eigResult.eigenvectors) {
        const sorted = [...eigResult.eigenvectors].sort((a, b) => b.value - a.value);
        sortedValues = sorted.map(e => e.value);
        sortedVectors = sorted.map(e => {
            const v = e.vector;
            return Array.isArray(v) ? v : (v.toArray ? v.toArray().flat() : v);
        });
    } else {
        const rawValues = Array.isArray(eigResult.values) ? eigResult.values : eigResult.values.toArray().flat();
        const indices = Array.from(rawValues.keys()).sort((a, b) => rawValues[b] - rawValues[a]);
        sortedValues = indices.map(i => rawValues[i]);
        sortedVectors = indices.map(i => {
            const col = math.column(eigResult.vectors, i);
            return Array.isArray(col) ? col.flat() : (col.toArray ? col.toArray().flat() : col);
        });
    }

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
