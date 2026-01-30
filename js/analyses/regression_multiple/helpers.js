/**
 * @fileoverview 重回帰分析ヘルパー関数
 * @module regression_multiple/helpers
 */

/**
 * VIF計算用のR²算出
 * @param {Array<number>} y - 目的変数
 * @param {Array<Array<number>>} X - デザイン行列
 * @returns {number} R²値
 */
export function calculateR2(y, X) {
    const n = y.length;
    const XT = math.transpose(X);
    const XTX = math.multiply(XT, X);
    const XTy = math.multiply(XT, y);
    const XTX_inv = math.inv(XTX);
    const beta = math.multiply(XTX_inv, XTy);

    const yPred = math.multiply(X, beta);
    const residuals = math.subtract(y, yPred);
    const residArr = Array.isArray(residuals) ? residuals : residuals.toArray();
    const rss = math.sum(residArr.map(r => r * r));

    const yMean = math.mean(y);
    const tss = math.sum(y.map(yi => (yi - yMean) ** 2));

    return 1 - (rss / tss);
}

/**
 * 重回帰分析を実行
 * @param {string} dependentVar - 目的変数名
 * @param {Array<string>} independentVars - 説明変数名配列
 * @param {Array<Object>} currentData - データ配列
 * @returns {Object} 分析結果
 */
export function performRegression(dependentVar, independentVars, currentData) {
    const y = currentData.map(row => row[dependentVar]);
    const X = currentData.map(row => independentVars.map(v => row[v]));

    // 欠損値除去
    const cleanData = [];
    for (let i = 0; i < y.length; i++) {
        const rowX = X[i];
        if (y[i] != null && !isNaN(y[i]) && rowX.every(v => v != null && !isNaN(v))) {
            cleanData.push({ y: y[i], x: rowX });
        }
    }

    if (cleanData.length < independentVars.length + 2) {
        throw new Error('有効なデータが不足しています');
    }

    const n = cleanData.length;
    const k = independentVars.length;
    const yClean = cleanData.map(d => d.y);
    const XClean = cleanData.map(d => [1, ...d.x]);

    // OLS計算
    const XT = math.transpose(XClean);
    const XTX = math.multiply(XT, XClean);
    const XTy = math.multiply(XT, yClean);
    const XTX_inv = math.inv(XTX);
    const beta = math.multiply(XTX_inv, XTy);

    // 統計量
    const yPred = math.multiply(XClean, beta);
    const residuals = math.subtract(yClean, yPred);
    const rss = math.sum(residuals.map(r => r * r));
    const yMean = math.mean(yClean);
    const tss = math.sum(yClean.map(yi => (yi - yMean) ** 2));
    const r2 = 1 - (rss / tss);
    const adjR2 = 1 - (1 - r2) * (n - 1) / (n - k - 1);
    const mse = rss / (n - k - 1);
    const seBeta = math.map(math.diag(math.multiply(mse, XTX_inv)), math.sqrt);
    const msm = (tss - rss) / k;
    const fValue = msm / mse;
    const pValueModel = 1 - jStat.centralF.cdf(fValue, k, n - k - 1);

    // 標準化係数
    const yStd = jStat.stdev(yClean, true);
    const xStds = independentVars.map((_, i) => jStat.stdev(cleanData.map(d => d.x[i]), true));
    const standardizedBeta = beta.slice(1).map((b, i) => b * (xStds[i] / yStd));

    // VIF計算
    const vifs = independentVars.map((targetVar, targetIdx) => {
        const yVif = cleanData.map(d => d.x[targetIdx]);
        const XVif = cleanData.map(d => {
            const row = [1];
            d.x.forEach((val, xIdx) => {
                if (xIdx !== targetIdx) row.push(val);
            });
            return row;
        });

        try {
            const r2_k = calculateR2(yVif, XVif);
            return 1 / (1 - r2_k);
        } catch (e) {
            return Infinity;
        }
    });

    return {
        dependentVar,
        n,
        k,
        r2,
        adjR2,
        fValue,
        pValueModel,
        beta,
        seBeta,
        standardizedBeta,
        vifs,
        yPred,
        residuals,
        cleanData
    };
}

/**
 * 係数のt値とp値を計算
 * @param {number} beta - 係数
 * @param {number} se - 標準誤差
 * @param {number} df - 自由度
 * @returns {{t: number, p: number}} t値とp値
 */
export function calculateCoefStats(beta, se, df) {
    const t = beta / se;
    const p = (1 - jStat.studentt.cdf(Math.abs(t), df)) * 2;
    return { t, p };
}
