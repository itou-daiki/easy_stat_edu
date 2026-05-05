/**
 * @fileoverview ウィルコクソンの符号付順位検定
 * @module wilcoxon_signed_rank
 * @description 対応のある2群以上のノンパラメトリック検定（対応ありt検定の順位版）
 *              3群以上の場合はペアワイズWilcoxon検定（Holm補正）による事後検定を実施
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getBottomTitleAnnotation, getAcademicLayout, academicColors, InterpretationHelper, generateAPATableHtml, addSignificanceBrackets } from '../utils.js';
import { performHolmCorrection } from '../utils/stat_distributions.js';

// ==========================================
// ランク付けユーティリティ
// ==========================================

/**
 * 絶対値配列に対して順位を割り当て（同順位は平均ランク）
 * @param {Array<{absVal: number, sign: number}>} data - 絶対値データ
 * @returns {Array} ランク付きデータ
 */
function assignRanks(data) {
    const sorted = [...data].sort((a, b) => a.absVal - b.absVal);
    let i = 0;
    while (i < sorted.length) {
        let j = i + 1;
        while (j < sorted.length && sorted[j].absVal === sorted[i].absVal) {
            j++;
        }
        const avgRank = (i + 1 + j) / 2.0;
        for (let k = i; k < j; k++) {
            sorted[k].rank = avgRank;
        }
        i = j;
    }
    return sorted;
}

/**
 * タイ補正項の計算
 * @param {Array} rankedData - ランク付きデータ
 * @returns {number} タイ補正項 Σ(t³ - t) / 48
 */
function computeTieCorrection(rankedData) {
    const ties = {};
    rankedData.forEach(d => {
        ties[d.absVal] = (ties[d.absVal] || 0) + 1;
    });
    let correction = 0;
    for (const val in ties) {
        const t = ties[val];
        if (t > 1) {
            correction += (t * t * t - t);
        }
    }
    return correction / 48;
}

// ==========================================
// ウィルコクソンの符号付順位検定
// ==========================================

/**
 * ウィルコクソンの符号付順位検定を実行
 * @param {number[]} values1 - 条件1のデータ
 * @param {number[]} values2 - 条件2のデータ
 * @returns {Object} 検定結果
 */
function wilcoxonSignedRankTest(values1, values2) {
    // 対応のあるデータのみ使用
    const pairs = [];
    for (let i = 0; i < Math.min(values1.length, values2.length); i++) {
        if (values1[i] != null && !isNaN(values1[i]) && values2[i] != null && !isNaN(values2[i])) {
            pairs.push({ v1: values1[i], v2: values2[i] });
        }
    }

    const n_total = pairs.length;
    if (n_total < 2) {
        return { error: 'データが不足しています（最低2ペア必要）' };
    }

    // 差の計算
    const diffs = pairs.map(p => p.v1 - p.v2);

    // ゼロ差を除外
    const nonZeroDiffs = diffs.filter(d => d !== 0);
    const n = nonZeroDiffs.length;
    const nZeros = n_total - n;

    if (n < 1) {
        return { error: '差がゼロでないペアが存在しません', n_total, nZeros };
    }

    // 絶対値データの準備
    const absData = nonZeroDiffs.map((d, idx) => ({
        absVal: Math.abs(d),
        sign: d > 0 ? 1 : -1,
        idx: idx
    }));

    // ランク付け
    const rankedData = assignRanks(absData);

    // T+ と T- の計算
    let tPlus = 0;  // 正の差の順位和
    let tMinus = 0; // 負の差の順位和
    rankedData.forEach(d => {
        if (d.sign > 0) tPlus += d.rank;
        else tMinus += d.rank;
    });

    const T = Math.min(tPlus, tMinus);

    // 正規近似（Z検定）
    const meanT = n * (n + 1) / 4;
    const tieCorr = computeTieCorrection(rankedData);
    const varT = n * (n + 1) * (2 * n + 1) / 24 - tieCorr;
    const stdT = Math.sqrt(varT);

    let zRaw = 0;
    if (stdT > 0) {
        // 連続性補正付き
        zRaw = (Math.abs(T - meanT) - 0.5) / stdT;
    }
    const z = Math.abs(zRaw);

    // p値（両側検定）
    const p_value = 2 * (1 - jStat.normal.cdf(z, 0, 1));

    // 効果量 r = |Z| / sqrt(n)
    const r = z / Math.sqrt(n);

    // 有意差の判定
    const significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : p_value < 0.1 ? '†' : 'n.s.';

    // 差の記述統計
    const meanDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const medianDiff = jStat.median(diffs);

    return {
        n_total,
        n,
        nZeros,
        tPlus,
        tMinus,
        T,
        z,
        p_value,
        r,
        significance,
        meanDiff,
        medianDiff,
        diffs
    };
}

// ==========================================
// ペアワイズWilcoxon検定（Holm補正・事後検定）
// ==========================================

/**
 * ペアワイズWilcoxon検定（Holm補正）による事後多重比較
 * 3群以上の対応のある条件間で全ペアワイズ比較を実施し、Holm補正を適用
 * @param {Array<Object>} pairResults - 各ペアの検定結果
 * @returns {Array<Object>} Holm補正済みの事後検定結果
 */
function pairwiseWilcoxonPosthoc(pairResults) {
    const comparisons = pairResults.map(pr => ({
        var1: pr.var1,
        var2: pr.var2,
        n: pr.result.error ? 0 : pr.result.n,
        tPlus: pr.result.error ? 0 : pr.result.tPlus,
        tMinus: pr.result.error ? 0 : pr.result.tMinus,
        T: pr.result.error ? 0 : pr.result.T,
        z: pr.result.error ? 0 : pr.result.z,
        p: pr.result.error ? 1 : pr.result.p_value,
        r: pr.result.error ? 0 : pr.result.r,
        meanDiff: pr.result.error ? 0 : pr.result.meanDiff,
        medianDiff: pr.result.error ? 0 : pr.result.medianDiff,
        error: pr.result.error || null
    }));

    // Holm補正を適用
    const corrected = performHolmCorrection(comparisons);
    corrected.forEach(c => {
        c.p_adjusted = c.p_holm;
        c.significance = c.p_adjusted < 0.01 ? '**' : c.p_adjusted < 0.05 ? '*' : c.p_adjusted < 0.1 ? '†' : 'n.s.';
    });

    return corrected;
}

// ==========================================
// 要約統計量の表示
// ==========================================

// displaySummaryStatistics is no longer needed as we use an integrated table.

// ==========================================
// メインの検定実行
// ==========================================

/**
 * ウィルコクソンの符号付順位検定を実行
 */
function runWilcoxonTest(currentData) {
    const depVarSelect = document.getElementById('dep-var-multiselect-hidden');
    const selectedVars = depVarSelect ? Array.from(depVarSelect.selectedOptions).map(o => o.value) : [];

    if (selectedVars.length < 2) {
        alert('比較する変数を2つ以上選択してください');
        return;
    }

    // 統合テーブルの実装に寄せるため、要約統計量の個別表示は削除
    // displaySummaryStatistics(selectedVars, currentData);
    document.getElementById('summary-stats-section').innerHTML = '';

    const resultsContainer = document.getElementById('test-results-section');

    if (selectedVars.length === 2) {
        runTwoSampleTest(selectedVars, currentData, resultsContainer);
    } else {
        runMultipleSampleTest(selectedVars, currentData, resultsContainer);
    }

    document.getElementById('results-section').style.display = 'block';
}

/**
 * 2変数の符号付順位検定
 */
function runTwoSampleTest(selectedVars, currentData, resultsContainer) {
    const var1 = selectedVars[0];
    const var2 = selectedVars[1];

    const pairs = currentData
        .map(row => ({ v1: Number(row[var1]), v2: Number(row[var2]) }))
        .filter(p => !isNaN(p.v1) && !isNaN(p.v2));

    const values1 = pairs.map(p => p.v1);
    const values2 = pairs.map(p => p.v2);
    const result = wilcoxonSignedRankTest(values1, values2);

    if (result.error) {
        resultsContainer.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="warning-message" style="padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
                    <strong>エラー:</strong> ${result.error}
                </div>
            </div>`;
        return;
    }

    const pText = result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(3);

    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> ウィルコクソンの符号付順位検定の結果
            </h4>
            <div id="test-results-table"></div>
            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">以下のHTMLをコピーしてWord等に貼り付けると、論文作成に役立ちます。</p>
               <div id="reporting-table-container"></div>
            </div>
        </div>
    `;

    // Median を計算
    const median1 = jStat.median(values1);
    const median2 = jStat.median(values2);

    // 結果テーブル
    document.getElementById('test-results-table').innerHTML = `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">比較ペア</th>
                        <th>N(ペア)</th>
                        <th>${var1} Mdn</th>
                        <th>${var2} Mdn</th>
                        <th>T+</th>
                        <th>T−</th>
                        <th>T</th>
                        <th>|Z|</th>
                        <th>p値</th>
                        <th>有意差</th>
                        <th>効果量 r</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight: bold; color: #1e90ff;">${var1} vs ${var2}</td>
                        <td>${result.n}</td>
                        <td>${median1.toFixed(2)}</td>
                        <td>${median2.toFixed(2)}</td>
                        <td>${result.tPlus.toFixed(1)}</td>
                        <td>${result.tMinus.toFixed(1)}</td>
                        <td>${result.T.toFixed(1)}</td>
                        <td>${result.z.toFixed(2)}</td>
                        <td>${pText}</td>
                        <td><strong>${result.significance}</strong></td>
                        <td>${result.r.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;">
            <strong>有意差</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1† n.s.<br>
            <strong>T</strong>: T = min(T+, T−)、<strong>r</strong>: 効果量 r = |Z| / &radic;n
            ${result.nZeros > 0 ? `<br><strong>注意:</strong> 差がゼロのペア ${result.nZeros} 件は分析から除外されました。` : ''}
        </p>
    `;

    // APA報告用テーブル
    const headers = ["比較", "<em>N</em>", "<em>T</em>+", "<em>T</em>&minus;", "<em>T</em>", "<em>|Z|</em>", "<em>p</em>", "<em>r</em>"];
    const rows = [[
        `${var1} vs ${var2}`,
        String(result.n),
        result.tPlus.toFixed(1),
        result.tMinus.toFixed(1),
        result.T.toFixed(1),
        result.z.toFixed(2),
        pText,
        result.r.toFixed(2)
    ]];
    document.getElementById('reporting-table-container').innerHTML = generateAPATableHtml(
        'wilcoxon-apa-table',
        'Table 1. Results of Wilcoxon Signed-Rank Test',
        headers, rows,
        'Wilcoxon signed-rank test with continuity correction.'
    );

    // サンプルサイズ情報
    renderSampleSizeInfo(resultsContainer, pairs.length, [
        { label: var1, count: values1.length, color: '#11b981' },
        { label: var2, count: values2.length, color: '#f59e0b' }
    ]);

    // 解釈
    displayInterpretation([{ var1, var2, result, values1, values2 }]);

    // 可視化
    displayVisualization([{
        var1, var2, values1, values2,
        significance: result.significance,
        p_value: result.p_value
    }]);
}

/**
 * 3変数以上の符号付順位検定 + Steel-Dwass事後検定
 */
function runMultipleSampleTest(selectedVars, currentData, resultsContainer) {
    // 全ペアワイズ比較
    const pairResults = [];
    for (let i = 0; i < selectedVars.length; i++) {
        for (let j = i + 1; j < selectedVars.length; j++) {
            const var1 = selectedVars[i];
            const var2 = selectedVars[j];

            const pairs = currentData
                .map(row => ({ v1: Number(row[var1]), v2: Number(row[var2]) }))
                .filter(p => !isNaN(p.v1) && !isNaN(p.v2));

            const values1 = pairs.map(p => p.v1);
            const values2 = pairs.map(p => p.v2);
            const result = wilcoxonSignedRankTest(values1, values2);

            pairResults.push({ var1, var2, values1, values2, result });
        }
    }

    // ペアワイズWilcoxon検定（Holm補正による事後検定）
    const posthocResults = pairwiseWilcoxonPosthoc(pairResults);

    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> ウィルコクソンの符号付順位検定の結果
            </h4>
            <div id="test-results-table"></div>
            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">以下のHTMLをコピーしてWord等に貼り付けると、論文作成に役立ちます。</p>
               <div id="reporting-table-container"></div>
            </div>
            <div id="posthoc-results-container" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    // 未補正の結果テーブル
    let resultsTableHtml = `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">比較ペア</th>
                        <th>N(ペア)</th>
                        <th>Mdn A</th>
                        <th>Mdn B</th>
                        <th>T+</th>
                        <th>T−</th>
                        <th>T</th>
                        <th>|Z|</th>
                        <th>p値</th>
                        <th>有意差</th>
                        <th>効果量 r</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pairResults.forEach(pr => {
        const r = pr.result;
        if (r.error) {
            resultsTableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${pr.var1} vs ${pr.var2}</td>
                    <td colspan="10" style="color: #92400e;">${r.error}</td>
                </tr>
            `;
        } else {
            const pText = r.p_value < 0.001 ? '< .001' : r.p_value.toFixed(3);
            const median1 = jStat.median(pr.values1);
            const median2 = jStat.median(pr.values2);
            resultsTableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${pr.var1} vs ${pr.var2}</td>
                    <td>${r.n}</td>
                    <td>${median1.toFixed(2)}</td>
                    <td>${median2.toFixed(2)}</td>
                    <td>${r.tPlus.toFixed(1)}</td>
                    <td>${r.tMinus.toFixed(1)}</td>
                    <td>${r.T.toFixed(1)}</td>
                    <td>${r.z.toFixed(2)}</td>
                    <td>${pText}</td>
                    <td><strong>${r.significance}</strong></td>
                    <td>${r.r.toFixed(2)}</td>
                </tr>
            `;
        }
    });

    resultsTableHtml += `
                </tbody>
            </table>
        </div>
        <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;">
            <strong>有意差</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1† n.s.（未補正p値）<br>
            <strong>T</strong>: T = min(T+, T−)、<strong>r</strong>: 効果量 r = |Z| / &radic;n<br>
            ※ 多重比較を行う場合は、下の事後検定（Holm補正）の調整済みp値を参照してください。
        </p>
    `;
    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    // APA報告用テーブル（Holm補正済み）
    generateMultipleReportingTable(posthocResults);

    // ペアワイズ事後検定結果の表示
    displayPosthocResults(posthocResults);

    // サンプルサイズ情報
    const groupColors = ['#11b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];
    renderSampleSizeInfo(resultsContainer, currentData.length,
        selectedVars.map((v, i) => {
            const count = currentData.map(row => Number(row[v])).filter(val => !isNaN(val)).length;
            return { label: v, count, color: groupColors[i % groupColors.length] };
        })
    );

    // 解釈
    const interpretResults = pairResults.filter(pr => !pr.result.error).map(pr => ({
        var1: pr.var1, var2: pr.var2, result: pr.result,
        values1: pr.values1, values2: pr.values2
    }));
    displayInterpretation(interpretResults);

    // 可視化
    const vizResults = pairResults.filter(pr => !pr.result.error).map(pr => ({
        var1: pr.var1, var2: pr.var2,
        values1: pr.values1, values2: pr.values2,
        significance: pr.result.significance,
        p_value: pr.result.p_value
    }));
    displayVisualization(vizResults);
}

// ==========================================
// 事後検定結果の表示
// ==========================================

/**
 * ペアワイズWilcoxon事後検定結果を表示
 */
function displayPosthocResults(posthocResults) {
    const container = document.getElementById('posthoc-results-container');

    let html = `
        <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;">
            <i class="fas fa-exchange-alt"></i> 事後検定（ペアワイズWilcoxon検定・Holm補正）
        </h5>
        <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">
            全ペアワイズ比較に対してHolm法による多重比較補正を適用しました。
        </p>
        <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th>比較ペア</th>
                        <th>N (ペア)</th>
                        <th>平均差</th>
                        <th>中央値差</th>
                        <th>|Z|</th>
                        <th>p値 (未補正)</th>
                        <th>p値 (調整済)</th>
                        <th>有意差</th>
                        <th>効果量 r</th>
                    </tr>
                </thead>
                <tbody>
    `;

    posthocResults.forEach(c => {
        if (c.error) {
            html += `
                <tr>
                    <td>${c.var1} vs ${c.var2}</td>
                    <td colspan="8" style="color: #92400e;">${c.error}</td>
                </tr>
            `;
        } else {
            const pRawText = c.p < 0.001 ? '< .001' : c.p.toFixed(3);
            const pAdjText = c.p_adjusted < 0.001 ? '< .001' : c.p_adjusted.toFixed(3);
            html += `
                <tr>
                    <td>${c.var1} vs ${c.var2}</td>
                    <td>${c.n}</td>
                    <td>${c.meanDiff.toFixed(2)}</td>
                    <td>${c.medianDiff.toFixed(2)}</td>
                    <td>${c.z.toFixed(2)}</td>
                    <td>${pRawText}</td>
                    <td>${pAdjText}</td>
                    <td><strong>${c.significance}</strong></td>
                    <td>${c.r.toFixed(2)}</td>
                </tr>
            `;
        }
    });

    html += `
                </tbody>
            </table>
        </div>
        <p style="color: #6b7280; font-size: 0.9rem; margin-top: 0.5rem;">
            <strong>有意差</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1† n.s.（Holm補正適用済み）<br>
            <strong>r</strong>: 効果量 r = |Z| / &radic;n
        </p>
    `;

    container.innerHTML = html;
}

/**
 * 複数比較のAPA報告用テーブル生成
 */
function generateMultipleReportingTable(posthocResults) {
    const tableDiv = document.getElementById('reporting-table-container');
    const headers = [
        "比較", "<em>N</em>", "<em>|Z|</em>",
        "<em>p</em> (raw)", "<em>p</em> (adj)", "<em>r</em>"
    ];

    const rows = posthocResults.filter(c => !c.error).map(c => {
        const pRawText = c.p < 0.001 ? '< .001' : c.p.toFixed(3);
        const pAdjText = c.p_adjusted < 0.001 ? '< .001' : c.p_adjusted.toFixed(3);
        return [
            `${c.var1} vs ${c.var2}`,
            String(c.n),
            c.z.toFixed(2),
            pRawText,
            pAdjText,
            c.r.toFixed(2)
        ];
    });

    tableDiv.innerHTML = generateAPATableHtml(
        'wilcoxon-multi-apa-table',
        'Table 1. Results of Wilcoxon Signed-Rank Test with Holm Correction',
        headers, rows,
        'Pairwise Wilcoxon signed-rank tests with Holm correction for multiple comparisons.'
    );
}

// ==========================================
// 結果の解釈
// ==========================================

/**
 * 検定結果の解釈を表示
 */
function displayInterpretation(testResults) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div id="interpretation-content"></div>
        </div>
    `;
    const contentContainer = document.getElementById('interpretation-content');

    let html = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';

    testResults.forEach(tr => {
        const r = tr.result;
        const pEval = InterpretationHelper.evaluatePValue(r.p_value);

        // 効果量の判定
        let effectText = '';
        if (r.r < 0.1) effectText = 'ほとんどない';
        else if (r.r < 0.3) effectText = '小さい';
        else if (r.r < 0.5) effectText = '中程度';
        else effectText = '大きい';

        // 中央値の比較で方向性を判定
        const median1 = jStat.median(tr.values1);
        const median2 = jStat.median(tr.values2);

        let text = `<strong>${tr.var1} vs ${tr.var2}</strong>: `;
        if (pEval.isSignificant) {
            const higher = median1 > median2 ? tr.var1 : tr.var2;
            const lower = median1 > median2 ? tr.var2 : tr.var1;
            text += `統計的に<strong>有意な差が認められました</strong> (${pEval.text})。`;
            text += `<br>中央値を比較すると、<strong>${higher}</strong>（${Math.max(median1, median2).toFixed(2)}）の方が<strong>${lower}</strong>（${Math.min(median1, median2).toFixed(2)}）よりも高い値を示しています。`;
            text += `<br>効果量 r = ${r.r.toFixed(2)} [${effectText}]`;
        } else {
            text += `統計的に有意な差は認められませんでした (<em>p</em> = ${r.p_value.toFixed(3)})。`;
            text += `<br>中央値: ${tr.var1} = ${median1.toFixed(2)}, ${tr.var2} = ${median2.toFixed(2)}`;
            text += `<br>効果量 r = ${r.r.toFixed(2)} [${effectText}]`;
        }

        html += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });

    html += '</ul>';
    contentContainer.innerHTML = html;
}

// ==========================================
// 可視化
// ==========================================

/**
 * 箱ひげ図・差の分布の描画
 */
function displayVisualization(vizResults) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <div id="visualization-controls-container"></div>
            <div id="plots-container"></div>
        </div>
    `;

    const controlsContainer = document.getElementById('visualization-controls-container');
    const { axisControl, titleControl } = createVisualizationControls(controlsContainer);

    const plotsContainer = document.getElementById('plots-container');
    plotsContainer.innerHTML = '';

    vizResults.forEach((vr, index) => {
        // 箱ひげ図（2変数の分布比較）
        const plotId = `plot-box-${index}`;
        const plotDiv = document.createElement('div');
        plotDiv.id = plotId;
        plotDiv.className = 'plot-container';
        plotsContainer.appendChild(plotDiv);

        const trace1 = {
            y: vr.values1,
            type: 'box',
            name: vr.var1,
            marker: { color: academicColors.palette[0] },
            fillcolor: academicColors.boxFill,
            line: { color: academicColors.boxLine },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const trace2 = {
            y: vr.values2,
            type: 'box',
            name: vr.var2,
            marker: { color: academicColors.palette[1] },
            fillcolor: academicColors.boxFill,
            line: { color: academicColors.palette[1] },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const allValues = [...vr.values1, ...vr.values2];
        const yMax = Math.max(...allValues);
        const yMin = Math.min(...allValues);
        const yRange = yMax - yMin;

        const title = titleControl.checked ? `分布の比較: ${vr.var1} vs ${vr.var2}` : '';

        const layout = getAcademicLayout({
            title: getBottomTitleAnnotation(title),
            yaxis: {
                title: axisControl.checked ? '値' : '',
                zeroline: false
            },
            showlegend: false,
            margin: { t: 60, b: 80, l: 60, r: 20 },
            boxmode: 'group',
            shapes: [],
            annotations: []
        });

        const pairs = [{
            g1: vr.var1,
            g2: vr.var2,
            significance: vr.significance,
            p: vr.p_value
        }];
        addSignificanceBrackets(layout, pairs, [vr.var1, vr.var2], yMax, yRange);

        const config = createPlotlyConfig('Wilcoxon_Signed_Rank', `${vr.var1}_vs_${vr.var2}`);
        Plotly.newPlot(plotId, [trace1, trace2], layout, config);

        // 差のヒストグラム
        const diffPlotId = `plot-diff-${index}`;
        const diffDiv = document.createElement('div');
        diffDiv.id = diffPlotId;
        diffDiv.className = 'plot-container';
        plotsContainer.appendChild(diffDiv);

        const diffs = vr.values1.map((v, i) => {
            if (i < vr.values2.length && !isNaN(v) && !isNaN(vr.values2[i])) {
                return v - vr.values2[i];
            }
            return null;
        }).filter(d => d !== null);

        const diffTrace = {
            x: diffs,
            type: 'histogram',
            marker: { color: academicColors.barFill, line: { color: academicColors.barLine, width: 1 } },
            name: '差分布'
        };

        const diffTitle = titleControl.checked ? `差の分布: ${vr.var1} - ${vr.var2}` : '';

        const diffLayout = getAcademicLayout({
            title: getBottomTitleAnnotation(diffTitle),
            xaxis: {
                title: axisControl.checked ? `差 (${vr.var1} - ${vr.var2})` : '',
                zeroline: true
            },
            yaxis: {
                title: axisControl.checked ? '度数' : ''
            },
            showlegend: false,
            margin: { t: 60, b: 80, l: 60, r: 20 },
            shapes: [{
                type: 'line',
                x0: 0, x1: 0,
                y0: 0, y1: 1,
                yref: 'paper',
                line: { color: academicColors.accent, width: 2, dash: 'dash' }
            }]
        });

        const diffConfig = createPlotlyConfig('Wilcoxon_Diff', `${vr.var1}_minus_${vr.var2}`);
        Plotly.newPlot(diffPlotId, [diffTrace], diffLayout, diffConfig);
    });

    const updateAllPlots = () => {
        vizResults.forEach((vr, index) => {
            const boxTitle = titleControl.checked ? `分布の比較: ${vr.var1} vs ${vr.var2}` : '';
            Plotly.relayout(`plot-box-${index}`, {
                title: getBottomTitleAnnotation(boxTitle),
                'yaxis.title': axisControl.checked ? '値' : ''
            });

            const diffTitle = titleControl.checked ? `差の分布: ${vr.var1} - ${vr.var2}` : '';
            Plotly.relayout(`plot-diff-${index}`, {
                title: getBottomTitleAnnotation(diffTitle),
                'xaxis.title': axisControl.checked ? `差 (${vr.var1} - ${vr.var2})` : '',
                'yaxis.title': axisControl.checked ? '度数' : ''
            });
        });
    };

    axisControl.addEventListener('change', updateAllPlots);
    titleControl.addEventListener('change', updateAllPlots);
}

// ==========================================
// メインのrender関数
// ==========================================

export function render(container, currentData, characteristics) {
    container.innerHTML = `
        <div class="wilcoxon-signed-rank-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-exchange-alt"></i> ウィルコクソンの符号付順位検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">対応のある2群以上の順位に基づいた差の検定を行います（ノンパラメトリック検定）</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> ウィルコクソンの符号付順位検定とは？</strong>
                        <p>同じ対象に対して2回測定した結果（事前・事後など）に差があるかを調べる方法です。対応ありt検定のノンパラメトリック版であり、データの正規性を仮定しません。差の「大きさ」と「方向」の両方を考慮して順位に基づいて検定します。</p>
                        <img src="image/wilcoxon.png" alt="ウィルコクソンの符号付順位検定の説明" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> <strong>事前・事後比較:</strong> 同じ人への介入前後のスコアを比較したいとき</li>
                        <li><i class="fas fa-check"></i> <strong>正規性が仮定できない:</strong> 差のデータが正規分布に従わないとき（外れ値や歪みがある場合）</li>
                        <li><i class="fas fa-check"></i> <strong>順序データ:</strong> リッカート尺度（5段階評定）などの順序データを比較したいとき</li>
                        <li><i class="fas fa-check"></i> <strong>サンプルサイズが小さい:</strong> ペア数が少ないとき</li>
                    </ul>
                    <h4>3群以上を選択した場合</h4>
                    <p>3つ以上の変数を選択すると、すべてのペアに対してウィルコクソンの符号付順位検定を実施し、<strong>Holm補正</strong>による多重比較補正を行います。</p>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>T値:</strong> 正負の順位和のうち小さい方。T+は正の差の順位和、T−は負の差の順位和です。</li>
                        <li><strong>Z値:</strong> 正規近似による検定統計量です（連続性補正付き）。</li>
                        <li><strong>p値:</strong> 0.05より小さければ、2つの条件間に「差がある」といえます。</li>
                        <li><strong>効果量 r:</strong> 差の大きさを示します（r = |Z| / &radic;n）。</li>
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
                        <p>ウィルコクソンの符号付順位検定 (Wilcoxon Signed-Rank Test) を使用しています。</p>
                        <ul>
                            <li><strong>差の計算:</strong> \\( d_i = x_i - y_i \\)（差がゼロのペアは除外）</li>
                            <li><strong>順位付け:</strong> \\( |d_i| \\) に対して昇順に順位を付与（同順位は平均ランク）</li>
                            <li><strong>T統計量:</strong> \\( T = \\min(T^+, T^-) \\) ここで \\( T^+ = \\sum \\text{(正の差の順位)} \\), \\( T^- = \\sum \\text{(負の差の順位)} \\)</li>
                            <li><strong>正規近似 (Z):</strong> \\( Z = \\frac{|T - \\mu_T| - 0.5}{\\sigma_T} \\)（連続性補正付き）</li>
                            <li><strong>期待値と分散:</strong> \\( \\mu_T = \\frac{n(n+1)}{4} \\), \\( \\sigma^2_T = \\frac{n(n+1)(2n+1)}{24} - \\frac{\\sum(t^3-t)}{48} \\)</li>
                            <li><strong>効果量 (r):</strong> \\( r = \\frac{|Z|}{\\sqrt{n}} \\)</li>
                            <li><strong>事後検定 (3群以上):</strong> 全ペアワイズWilcoxon符号付順位検定 + Holm補正</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="wilcoxon-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="dep-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;">
                    <div id="dep-var-multiselect"></div>
                </div>
                <div id="run-btn-container" style="margin-top: 1.5rem;"></div>
            </div>

            <div id="results-section" style="display: none;">
                <div id="summary-stats-section"></div>
                <div id="test-results-section"></div>
                <div id="interpretation-section"></div>
                <div id="visualization-section"></div>
            </div>
        </div>
    `;

    renderDataOverview('#wilcoxon-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    const { numericColumns } = characteristics;

    createVariableSelector('dep-var-multiselect', numericColumns, 'dep-var-multiselect-hidden', {
        label: '<i class="fas fa-check-square"></i> 比較する変数を選択（対応のあるデータ、2つ以上）:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('run-btn-container', '分析を実行', () => runWilcoxonTest(currentData), { id: 'run-wilcoxon-test-btn' });
}
