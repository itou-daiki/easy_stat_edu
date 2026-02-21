/**
 * @fileoverview フィッシャーの正確確率検定 (Fisher's Exact Test)
 * @module fisher_exact
 * @description カテゴリカル変数間の独立性を正確確率に基づいて検定
 *              2×2分割表: 超幾何分布による正確計算
 *              R×C分割表: 全観測確率の正確計算（中小規模テーブル対応）
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml } from '../utils.js';

// ==========================================
// 数学ユーティリティ
// ==========================================

/**
 * 対数階乗を計算（キャッシュ付き）
 * @param {number} n - 非負整数
 * @returns {number} ln(n!)
 */
const logFactCache = [0, 0]; // ln(0!)=0, ln(1!)=0
function logFact(n) {
    if (n < 0) return 0;
    if (n < logFactCache.length) return logFactCache[n];
    for (let i = logFactCache.length; i <= n; i++) {
        logFactCache[i] = logFactCache[i - 1] + Math.log(i);
    }
    return logFactCache[n];
}

// ==========================================
// 2×2 フィッシャーの正確確率検定
// ==========================================

/**
 * 2×2分割表の超幾何確率を計算
 * P(a) = C(a+b,a) * C(c+d,c) / C(N,a+c)
 *       = (a+b)!(c+d)!(a+c)!(b+d)! / (N! * a! * b! * c! * d!)
 *
 * @param {number} a - セル(0,0)
 * @param {number} b - セル(0,1)
 * @param {number} c - セル(1,0)
 * @param {number} d - セル(1,1)
 * @returns {number} 確率
 */
function hypergeometricProb(a, b, c, d) {
    const logP = logFact(a + b) + logFact(c + d) + logFact(a + c) + logFact(b + d)
        - logFact(a + b + c + d) - logFact(a) - logFact(b) - logFact(c) - logFact(d);
    return Math.exp(logP);
}

/**
 * 2×2分割表のフィッシャーの正確確率検定（両側検定）
 * @param {number[][]} observed - 2×2観測度数
 * @returns {Object} { p_twotail, p_left, p_right, oddsRatio }
 */
function fisherExact2x2(observed) {
    const a = observed[0][0];
    const b = observed[0][1];
    const c = observed[1][0];
    const d = observed[1][1];

    const row0 = a + b;
    const row1 = c + d;
    const col0 = a + c;
    const col1 = b + d;

    // 観測された配置の確率
    const pObserved = hypergeometricProb(a, b, c, d);

    // aの取りうる範囲
    const aMin = Math.max(0, col0 - row1);
    const aMax = Math.min(row0, col0);

    // 全ての可能な配置に対する確率を計算
    let pLeft = 0;
    let pRight = 0;
    let pTwoTail = 0;

    for (let ai = aMin; ai <= aMax; ai++) {
        const bi = row0 - ai;
        const ci = col0 - ai;
        const di = row1 - ci;

        const prob = hypergeometricProb(ai, bi, ci, di);

        // 左側検定: a <= 観測値
        if (ai <= a) pLeft += prob;

        // 右側検定: a >= 観測値
        if (ai >= a) pRight += prob;

        // 両側検定: 確率が観測値以下のもの
        if (prob <= pObserved + 1e-10) {
            pTwoTail += prob;
        }
    }

    // オッズ比
    const oddsRatio = (b === 0 || c === 0) ? Infinity : (a * d) / (b * c);

    return {
        p_twotail: Math.min(1, pTwoTail),
        p_left: Math.min(1, pLeft),
        p_right: Math.min(1, pRight),
        oddsRatio: oddsRatio
    };
}

// ==========================================
// R×C フィッシャーの正確確率検定
// ==========================================

/**
 * R×C分割表のフィッシャーの正確確率検定
 * 行周辺度数・列周辺度数を固定した上で、全パターンの確率を計算
 * テーブルが大きい場合はモンテカルロ近似を使用
 *
 * @param {number[][]} observed - R×C観測度数
 * @param {number[]} rowTotals - 行周辺度数
 * @param {number[]} colTotals - 列周辺度数
 * @param {number} total - 総度数
 * @returns {Object} { p_value, method }
 */
function fisherExactRxC(observed, rowTotals, colTotals, total) {
    const R = observed.length;
    const C = observed[0].length;

    // テーブルサイズが大きすぎる場合はモンテカルロ法
    const maxEnumSize = estimateEnumerationSize(rowTotals, colTotals);
    if (maxEnumSize > 1e7) {
        return fisherExactMonteCarlo(observed, rowTotals, colTotals, total, 100000);
    }

    // 観測テーブルの確率を計算
    const logPObserved = tableLogProb(observed, rowTotals, colTotals, total);

    // 全パターンを列挙して、確率が観測値以下のものを合計
    let pValue = 0;

    // 再帰的に全テーブルを列挙
    enumerateTables(R, C, rowTotals, colTotals, total, logPObserved, (logP) => {
        if (logP <= logPObserved + 1e-10) {
            pValue += Math.exp(logP);
        }
    });

    return {
        p_value: Math.min(1, pValue),
        method: 'exact'
    };
}

/**
 * テーブルの対数確率を計算
 * log P = Σ log(ri!) + Σ log(cj!) - log(N!) - ΣΣ log(nij!)
 */
function tableLogProb(table, rowTotals, colTotals, total) {
    let logP = -logFact(total);
    for (let i = 0; i < rowTotals.length; i++) logP += logFact(rowTotals[i]);
    for (let j = 0; j < colTotals.length; j++) logP += logFact(colTotals[j]);
    for (let i = 0; i < table.length; i++) {
        for (let j = 0; j < table[i].length; j++) {
            logP -= logFact(table[i][j]);
        }
    }
    return logP;
}

/**
 * 列挙サイズの推定（大まかな上界）
 */
function estimateEnumerationSize(rowTotals, colTotals) {
    let size = 1;
    for (let i = 0; i < rowTotals.length - 1; i++) {
        for (let j = 0; j < colTotals.length - 1; j++) {
            size *= Math.min(rowTotals[i], colTotals[j]) + 1;
            if (size > 1e8) return size;
        }
    }
    return size;
}

/**
 * 全テーブル列挙（再帰アルゴリズム）
 * 行ごとに要素を配置し、制約を満たすか確認
 */
function enumerateTables(R, C, rowTotals, colTotals, total, logPObs, callback) {
    const table = Array.from({ length: R }, () => new Array(C).fill(0));
    const colRemaining = [...colTotals];

    function fillRow(row, col, rowRemaining) {
        if (row === R - 1) {
            // 最後の行は自動的に決定
            for (let j = 0; j < C; j++) {
                table[row][j] = colRemaining[j];
                if (table[row][j] < 0) return; // 不正な配置
            }
            // テーブルの確率を計算しコールバック
            const logP = tableLogProb(table, rowTotals, colTotals, total);
            callback(logP);
            return;
        }

        if (col === C - 1) {
            // 行の最後の列は自動的に決定
            const val = rowRemaining;
            if (val < 0 || val > colRemaining[col]) return;
            table[row][col] = val;
            colRemaining[col] -= val;

            fillRow(row + 1, 0, rowTotals[row + 1]);

            colRemaining[col] += val;
            return;
        }

        // col列に配置可能な範囲
        const maxVal = Math.min(rowRemaining, colRemaining[col]);
        for (let val = 0; val <= maxVal; val++) {
            table[row][col] = val;
            colRemaining[col] -= val;

            fillRow(row, col + 1, rowRemaining - val);

            colRemaining[col] += val;
        }
    }

    fillRow(0, 0, rowTotals[0]);
}

/**
 * モンテカルロ法による近似フィッシャー正確検定
 */
function fisherExactMonteCarlo(observed, rowTotals, colTotals, total, nSim) {
    const logPObserved = tableLogProb(observed, rowTotals, colTotals, total);
    const R = rowTotals.length;
    const C = colTotals.length;

    let count = 0;

    for (let sim = 0; sim < nSim; sim++) {
        // ランダムテーブル生成（行・列周辺度数を固定）
        const randomTable = generateRandomTable(R, C, rowTotals, colTotals, total);
        if (!randomTable) continue;

        const logP = tableLogProb(randomTable, rowTotals, colTotals, total);
        if (logP <= logPObserved + 1e-10) {
            count++;
        }
    }

    return {
        p_value: Math.min(1, (count + 1) / (nSim + 1)),
        method: 'monte_carlo',
        nSim: nSim
    };
}

/**
 * 行・列周辺度数を固定したランダムテーブル生成
 * Patefield's algorithm の簡易実装
 */
function generateRandomTable(R, C, rowTotals, colTotals, total) {
    const table = Array.from({ length: R }, () => new Array(C).fill(0));
    const colRem = [...colTotals];
    let totalRem = total;

    for (let i = 0; i < R - 1; i++) {
        let rowRem = rowTotals[i];
        let colTotalRem = totalRem;

        for (let j = 0; j < C - 1; j++) {
            // 超幾何分布からサンプリング
            const val = hypergeometricSample(rowRem, colRem[j], colTotalRem);
            table[i][j] = val;
            rowRem -= val;
            colRem[j] -= val;
            colTotalRem -= colRem[j] + val; // adjust: remaining total minus this column's remaining
            colTotalRem = totalRem - rowTotals[i]; // simpler: remaining rows' total
            // 再計算
            colTotalRem = 0;
            for (let jj = j + 1; jj < C; jj++) colTotalRem += colRem[jj];
            colTotalRem += rowRem; // Actually we need "remaining pool"
            // Simpler approach: use conditional hypergeometric
            colTotalRem = rowRem;
            for (let ii = i + 1; ii < R; ii++) colTotalRem += rowTotals[ii];
            // Adjust: total remaining after fixing previous columns
            break; // Fall through to simpler method
        }

        // Simple sequential method for this row
        rowRem = rowTotals[i];
        let poolSize = totalRem;
        for (let j = 0; j < C - 1; j++) {
            const val = hypergeometricSample(rowRem, colRem[j], poolSize);
            table[i][j] = val;
            rowRem -= val;
            poolSize -= colRem[j];
            colRem[j] -= val;
        }
        table[i][C - 1] = rowRem;
        colRem[C - 1] -= rowRem;
        totalRem -= rowTotals[i];
    }

    // 最後の行
    for (let j = 0; j < C; j++) {
        table[R - 1][j] = colRem[j];
        if (colRem[j] < 0) return null;
    }

    return table;
}

/**
 * 超幾何分布からのサンプリング（逆関数法）
 */
function hypergeometricSample(n, K, N) {
    if (N <= 0 || n <= 0 || K <= 0) return 0;
    if (n > N) n = N;
    if (K > N) K = N;

    const u = Math.random();
    let cumProb = 0;
    const kMin = Math.max(0, n + K - N);
    const kMax = Math.min(n, K);

    for (let k = kMin; k <= kMax; k++) {
        const logP = logFact(K) - logFact(k) - logFact(K - k)
            + logFact(N - K) - logFact(n - k) - logFact(N - K - (n - k))
            - logFact(N) + logFact(n) + logFact(N - n);
        cumProb += Math.exp(logP);
        if (cumProb >= u) return k;
    }
    return kMax;
}

// ==========================================
// メイン分析実行
// ==========================================

/**
 * フィッシャーの正確確率検定を実行
 */
function runFisherExact(currentData) {
    const rowVar = document.getElementById('row-var').value;
    const colVar = document.getElementById('col-var').value;

    if (!rowVar || !colVar) {
        alert('行変数と列変数を選択してください');
        return;
    }
    if (rowVar === colVar) {
        alert('異なる変数を選択してください');
        return;
    }

    // クロス集計表の作成
    const rowKeys = [...new Set(currentData.map(d => d[rowVar]).filter(v => v != null))].sort();
    const colKeys = [...new Set(currentData.map(d => d[colVar]).filter(v => v != null))].sort();

    const observed = rowKeys.map(r => {
        return colKeys.map(c => {
            return currentData.filter(d => d[rowVar] === r && d[colVar] === c).length;
        });
    });

    const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = colKeys.map((_, i) => observed.reduce((sum, row) => sum + row[i], 0));
    const total = rowTotals.reduce((a, b) => a + b, 0);

    // 期待度数
    const expected = rowKeys.map((_, i) => {
        return colKeys.map((_, j) => (rowTotals[i] * colTotals[j]) / total);
    });

    // カイ二乗統計量（参考）
    let chiSquare = 0;
    expected.forEach((row, i) => {
        row.forEach((exp, j) => {
            if (exp > 0) {
                chiSquare += Math.pow(observed[i][j] - exp, 2) / exp;
            }
        });
    });

    const df = (rowKeys.length - 1) * (colKeys.length - 1);

    // Cramer's V
    const minDim = Math.min(rowKeys.length, colKeys.length);
    const cramersV = minDim > 1 ? Math.sqrt(chiSquare / (total * (minDim - 1))) : 0;

    // 残差分析
    const adjResiduals = expected.map((row, i) => {
        return row.map((exp, j) => {
            const obs = observed[i][j];
            const rowProp = rowTotals[i] / total;
            const colProp = colTotals[j] / total;
            const denom = Math.sqrt(exp * (1 - rowProp) * (1 - colProp));
            return denom > 0 ? (obs - exp) / denom : 0;
        });
    });

    // フィッシャーの正確確率検定
    let fisherResult;
    const is2x2 = rowKeys.length === 2 && colKeys.length === 2;

    if (is2x2) {
        fisherResult = fisherExact2x2(observed);
    } else {
        fisherResult = fisherExactRxC(observed, rowTotals, colTotals, total);
    }

    // 期待度数<5のセルの割合
    let cellsCount = 0;
    let smallExpCount = 0;
    expected.forEach(row => {
        row.forEach(exp => {
            cellsCount++;
            if (exp < 5) smallExpCount++;
        });
    });
    const smallExpRate = (smallExpCount / cellsCount) * 100;

    // 結果表示
    displayResults(fisherResult, is2x2, chiSquare, df, cramersV, rowKeys, colKeys, observed, expected, adjResiduals, rowVar, colVar, total, smallExpRate, rowTotals);
}

// ==========================================
// 結果表示
// ==========================================

function displayResults(fisherResult, is2x2, chiSquare, df, cramersV, rowKeys, colKeys, observed, expected, adjResiduals, rowVar, colVar, total, smallExpRate, rowTotals) {
    const container = document.getElementById('fisher-results');

    const pValue = is2x2 ? fisherResult.p_twotail : fisherResult.p_value;
    const pText = pValue < 0.001 ? '< .001' : pValue.toFixed(4);
    const significance = pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : pValue < 0.1 ? '†' : 'n.s.';

    // 前提条件の注意
    let warningHtml = '';
    if (smallExpRate > 20) {
        warningHtml = `
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; color: #166534;">
                <strong><i class="fas fa-check-circle"></i> 期待度数が5未満のセルが ${smallExpRate.toFixed(1)}% あります。</strong><br>
                カイ二乗検定の近似が不正確な可能性がありますが、フィッシャーの正確確率検定は正確なp値を提供するため、こちらの結果を参照してください。
            </div>`;
    }

    // メソッド表記
    let methodNote = '';
    if (is2x2) {
        methodNote = '2×2分割表: 超幾何分布による正確計算';
    } else if (fisherResult.method === 'monte_carlo') {
        methodNote = `R×C分割表: モンテカルロ法による近似 (${fisherResult.nSim.toLocaleString()}回シミュレーション)`;
    } else {
        methodNote = 'R×C分割表: 全パターン列挙による正確計算';
    }

    // 2×2固有の結果（オッズ比、片側p値）
    let oddsHtml = '';
    if (is2x2) {
        const orText = isFinite(fisherResult.oddsRatio) ? fisherResult.oddsRatio.toFixed(3) : '∞';
        const pLeftText = fisherResult.p_left < 0.001 ? '< .001' : fisherResult.p_left.toFixed(4);
        const pRightText = fisherResult.p_right < 0.001 ? '< .001' : fisherResult.p_right.toFixed(4);

        oddsHtml = `
            <div class="data-stat-card">
                <div class="stat-label">オッズ比</div>
                <div class="stat-value">${orText}</div>
            </div>
            <div class="data-stat-card" style="background: #fefce8; border: 1px solid #fde68a;">
                <div class="stat-label">p値 (片側: 左)</div>
                <div class="stat-value" style="font-size: 1.1rem;">${pLeftText}</div>
            </div>
            <div class="data-stat-card" style="background: #fefce8; border: 1px solid #fde68a;">
                <div class="stat-label">p値 (片側: 右)</div>
                <div class="stat-value" style="font-size: 1.1rem;">${pRightText}</div>
            </div>
        `;
    }

    let html = warningHtml + `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-clipboard-check"></i> フィッシャーの正確確率検定の結果
            </h4>
            <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">
                ${methodNote}
            </p>
            <div class="data-stats-grid">
                <div class="data-stat-card" style="background: #eff6ff; border: 2px solid #3b82f6;">
                    <div class="stat-label">p値 (両側)</div>
                    <div class="stat-value" style="${pValue < 0.05 ? 'color: #ef4444;' : ''}">${pText} ${significance}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">クラメールのV</div>
                    <div class="stat-value">${cramersV.toFixed(3)}</div>
                </div>
                <div class="data-stat-card" style="background: #f8f9fa;">
                    <div class="stat-label">χ² (参考)</div>
                    <div class="stat-value" style="font-size: 1.1rem;">${chiSquare.toFixed(2)}</div>
                    <div class="stat-sub" style="font-size: 0.8rem; color: #666;">df = ${df}</div>
                </div>
                ${oddsHtml}
            </div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> 結果の解釈
                </h4>
                <div style="line-height: 1.6;">
                    ${generateInterpretation(pValue, cramersV, rowVar, colVar, is2x2, fisherResult)}
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <div id="reporting-table-container-fisher"></div>
            </div>
        </div>

        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-table"></i> クロス集計表と残差分析
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${rowVar} \\ ${colVar}</th>
                            ${colKeys.map(c => `<th>${c}</th>`).join('')}
                            <th>合計</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // テーブル本体
    rowKeys.forEach((r, i) => {
        html += `<tr><td><strong>${r}</strong></td>`;
        colKeys.forEach((c, j) => {
            const obs = observed[i][j];
            const exp = expected[i][j];
            const res = adjResiduals[i][j];

            let style = '';
            if (res > 1.96) style = 'background: #dbeafe; color: #1e40af; font-weight: bold;';
            else if (res < -1.96) style = 'background: #fee2e2; color: #991b1b;';

            html += `
                <td style="${style}">
                    <div>${obs} <span style="font-size:0.8em; color:#666;">(${exp.toFixed(1)})</span></div>
                    <div style="font-size:0.8em;">z=${res.toFixed(1)}</div>
                </td>
            `;
        });
        html += `<td>${rowTotals[i]}</td></tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <p style="margin-top: 0.5rem; color: #666; font-size: 0.8rem;">
                上段: 観測度数 (期待度数), 下段: 調整済み標準化残差 (z)。<br>
                z &gt; 1.96 (青) は有意に多い、z &lt; -1.96 (赤) は有意に少ない組み合わせを示します。
            </p>
        </div>

        <div id="heatmap-plot"></div>
    `;

    container.innerHTML = html;

    // APA報告用テーブル
    const headersAPA = [rowVar, ...colKeys.map(c => String(c)), "Total"];
    const rowsAPA = rowKeys.map((r, i) => {
        const row = [String(r)];
        colKeys.forEach((c, j) => {
            const count = observed[i][j];
            const pct = ((count / rowTotals[i]) * 100).toFixed(1);
            row.push(`${count} (${pct}%)`);
        });
        row.push(`${rowTotals[i]} (100.0%)`);
        return row;
    });

    const pApaText = pValue < 0.001 ? '< .001' : `= ${pValue.toFixed(3)}`;
    let noteAPA = `<em>Note</em>. Values are N (Row %). Fisher's exact test: <em>p</em> ${pApaText}, Cramer's <em>V</em> = ${cramersV.toFixed(2)}.`;
    if (is2x2 && isFinite(fisherResult.oddsRatio)) {
        noteAPA += ` OR = ${fisherResult.oddsRatio.toFixed(2)}.`;
    }

    setTimeout(() => {
        const tableContainer = document.getElementById('reporting-table-container-fisher');
        if (tableContainer) {
            tableContainer.innerHTML = generateAPATableHtml(
                'fisher-apa-table',
                `Table 1. Crosstabulation of ${rowVar} by ${colVar}`,
                headersAPA, rowsAPA, noteAPA
            );
        }
    }, 0);

    // ヒートマップ
    plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar);

    document.getElementById('analysis-results').style.display = 'block';

    // 可視化コントロール
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');
    if (axisControl && titleControl) {
        const updatePlot = () => plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar);
        axisControl.addEventListener('change', updatePlot);
        titleControl.addEventListener('change', updatePlot);
    }
}

// ==========================================
// 解釈生成
// ==========================================

function generateInterpretation(pValue, cramersV, rowVar, colVar, is2x2, fisherResult) {
    const pEval = InterpretationHelper.evaluatePValue(pValue);

    let vText = '';
    if (cramersV < 0.1) vText = 'ごくわずか';
    else if (cramersV < 0.3) vText = '小';
    else if (cramersV < 0.5) vText = '中程度';
    else vText = '大';

    let text = '';
    if (pEval.isSignificant) {
        text += `「<strong>${rowVar}</strong>」と「<strong>${colVar}</strong>」の間には<strong>有意な関連（連関）</strong>があります (${pEval.text}, <em>V</em> = ${cramersV.toFixed(2)} [${vText}])。<br>`;
        text += `変数の組み合わせによって偏りがある（独立ではない）と言えます。<br>`;
        text += `具体的な偏りについては、調整済み残差の表を確認してください。`;
    } else {
        text += `「<strong>${rowVar}</strong>」と「<strong>${colVar}</strong>」の間に有意な関連は見られませんでした (<em>p</em> = ${pValue.toFixed(3)}, <em>V</em> = ${cramersV.toFixed(2)} [${vText}])。<br>`;
        text += `変数は互いに独立である（偏りがない）と考えられます。`;
    }

    if (is2x2 && isFinite(fisherResult.oddsRatio)) {
        const or = fisherResult.oddsRatio;
        text += `<br><br><strong>オッズ比 = ${or.toFixed(2)}</strong>: `;
        if (Math.abs(or - 1) < 0.01) {
            text += '2つの条件で事象の起こりやすさに差はありません。';
        } else if (or > 1) {
            text += `第1群は第2群に比べて ${or.toFixed(2)} 倍事象が起こりやすいことを示します。`;
        } else {
            text += `第1群は第2群に比べて事象が起こりにくいことを示します（1/${(1 / or).toFixed(2)} 倍）。`;
        }
    }

    return text;
}

// ==========================================
// 可視化
// ==========================================

function plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar) {
    const data = [{
        z: observed,
        x: colKeys,
        y: rowKeys,
        type: 'heatmap',
        colorscale: 'Blues'
    }];

    const layout = {
        title: '',
        xaxis: { title: colVar },
        yaxis: { title: '' },
        margin: { l: 100, b: 150 },
        annotations: []
    };

    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (showAxisLabels) {
        const tategakiTitle = getTategakiAnnotation(rowVar);
        if (tategakiTitle) layout.annotations.push(tategakiTitle);
    } else {
        layout.xaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation('観測度数のヒートマップ');
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('heatmap-plot', data, layout, createPlotlyConfig('Fisher正確確率検定_ヒートマップ', [rowVar, colVar]));
}

// ==========================================
// メインのrender関数
// ==========================================

export function render(container, currentData, characteristics) {
    const { categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="fisher-exact-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-bullseye"></i> フィッシャーの正確確率検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">カテゴリカル変数間の独立性を正確確率に基づいて検定します</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> フィッシャーの正確確率検定とは？</strong>
                        <p>カイ二乗検定と同様に、2つのカテゴリカル変数に関連があるかを調べる方法です。
                        カイ二乗検定が「近似」を使うのに対し、フィッシャーの正確確率検定は「正確な確率」を計算するため、
                        サンプルサイズが小さい場合や期待度数が5未満のセルがある場合に特に適しています。</p>
                        <img src="image/fisher_exact.png" alt="フィッシャーの正確確率検定の説明" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> <strong>小サンプル:</strong> データの総数が少ない（目安: N &lt; 20〜30程度）</li>
                        <li><i class="fas fa-check"></i> <strong>期待度数が小さい:</strong> クロス集計表の期待度数が5未満のセルが20%以上ある</li>
                        <li><i class="fas fa-check"></i> <strong>2×2分割表:</strong> 特に2×2の場合は最も正確な結果が得られます</li>
                        <li><i class="fas fa-check"></i> <strong>正確なp値が必要:</strong> カイ二乗近似では不十分な場合</li>
                    </ul>
                    <h4>カイ二乗検定との違い</h4>
                    <ul>
                        <li><strong>カイ二乗検定:</strong> 大標本近似。期待度数が十分大きい場合に有効。計算が高速。</li>
                        <li><strong>フィッシャー正確検定:</strong> 正確確率。サンプルサイズに依存しない。テーブルが大きいと計算コスト増。</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>p値:</strong> 0.05より小さければ、2つの変数には「関連がある」と判断できます。</li>
                        <li><strong>オッズ比 (2×2のみ):</strong> 1より大きければ正の関連、1より小さければ負の関連を示します。</li>
                        <li><strong>クラメールのV:</strong> 関連の強さを示す効果量（0〜1、大きいほど関連が強い）。</li>
                    </ul>
                </div>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-code"></i> 分析ロジック・計算式詳説 (専門家向け)</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note" style="background: #f1f8ff; border-left: 5px solid #0366d6;">
                        <strong><i class="fas fa-check-circle"></i> 実装ロジックの検証</strong>
                        <ul>
                            <li><strong>2×2分割表:</strong> 超幾何分布に基づく正確計算
                                \\( P = \\frac{\\binom{a+b}{a}\\binom{c+d}{c}}{\\binom{N}{a+c}} = \\frac{(a+b)!(c+d)!(a+c)!(b+d)!}{N! \\cdot a! \\cdot b! \\cdot c! \\cdot d!} \\)</li>
                            <li><strong>両側p値:</strong> 観測確率以下の全配置の確率の合計</li>
                            <li><strong>オッズ比:</strong> \\( OR = \\frac{ad}{bc} \\)</li>
                            <li><strong>R×C分割表:</strong> 全パターン列挙 (小テーブル) またはモンテカルロ法 (大テーブル)</li>
                            <li><strong>テーブル確率:</strong> \\( P = \\frac{\\prod R_i! \\cdot \\prod C_j!}{N! \\cdot \\prod n_{ij}!} \\)</li>
                            <li><strong>効果量:</strong> Cramer's V（カイ二乗統計量を参考として算出）</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="fisher-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div id="row-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="col-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                </div>
                <div id="run-fisher-btn-container"></div>
            </div>

            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="visualization-controls-container"></div>
                </div>
                <div id="fisher-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#fisher-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('row-var-container', categoricalColumns, 'row-var', {
        label: '<i class="fas fa-bars"></i> 行変数 (Group 1):',
        multiple: false
    });
    createVariableSelector('col-var-container', categoricalColumns, 'col-var', {
        label: '<i class="fas fa-columns"></i> 列変数 (Group 2):',
        multiple: false
    });

    createAnalysisButton('run-fisher-btn-container', '検定を実行', () => runFisherExact(currentData), { id: 'run-fisher-btn' });
}
