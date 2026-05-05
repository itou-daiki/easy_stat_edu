// ==========================================
// マクネマー検定 (McNemar's Test)
// ==========================================
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, InterpretationHelper, generateAPATableHtml, getAcademicLayout, academicColors } from '../utils.js';

// ==========================================
// Core Calculation
// ==========================================

/**
 * Build 2x2 contingency table from paired binary data.
 * Returns { a, b, c, d, labels1, labels2, N }
 * a = both Yes, b = var1 Yes & var2 No, c = var1 No & var2 Yes, d = both No
 */
function buildContingencyTable(data, var1, var2) {
    const vals1 = [...new Set(data.map(r => r[var1]).filter(v => v != null))].sort();
    const vals2 = [...new Set(data.map(r => r[var2]).filter(v => v != null))].sort();

    if (vals1.length !== 2 || vals2.length !== 2) {
        return { error: `両変数とも2値である必要があります（${var1}: ${vals1.length}値, ${var2}: ${vals2.length}値）` };
    }

    // Use consistent labeling: first sorted value = row/col 0, second = row/col 1
    const allLabels = [...new Set([...vals1, ...vals2])].sort();
    const label0 = allLabels[0];
    const label1 = allLabels.length > 1 ? allLabels[1] : vals1[1] || vals2[1];

    let a = 0, b = 0, c = 0, d = 0;
    let validN = 0;

    data.forEach(row => {
        const v1 = row[var1];
        const v2 = row[var2];
        if (v1 == null || v2 == null) return;
        validN++;

        const is1First = (v1 === label0);
        const is2First = (v2 === label0);

        if (!is1First && !is2First) a++;      // both label1
        else if (!is1First && is2First) b++;   // var1=label1, var2=label0
        else if (is1First && !is2First) c++;   // var1=label0, var2=label1
        else d++;                               // both label0
    });

    return { a, b, c, d, label0, label1, N: validN };
}

/**
 * Perform McNemar's test.
 */
function mcnemarTest(a, b, c, d) {
    const N = a + b + c + d;
    const bc = b + c;

    // McNemar chi-square (without continuity correction)
    let chi2 = 0;
    let chi2_corrected = 0;
    let p_chi2 = 1;
    let p_corrected = 1;

    if (bc > 0) {
        chi2 = Math.pow(b - c, 2) / bc;
        p_chi2 = 1 - jStat.chisquare.cdf(chi2, 1);

        // With Yates' continuity correction
        chi2_corrected = Math.pow(Math.abs(b - c) - 1, 2) / bc;
        p_corrected = 1 - jStat.chisquare.cdf(chi2_corrected, 1);
    }

    // Exact binomial test (when b + c < 25)
    let p_exact = null;
    if (bc > 0 && bc < 25) {
        // Two-sided binomial test: P(X >= max(b,c)) + P(X <= min(b,c)) under H0: p=0.5
        const minBC = Math.min(b, c);
        let pExact = 0;
        for (let k = 0; k <= minBC; k++) {
            pExact += binomialPMF(bc, k, 0.5);
        }
        p_exact = Math.min(1, 2 * pExact); // two-sided
    }

    // Effect size: phi coefficient
    const phi = N > 0 ? Math.sqrt(chi2 / N) : 0;

    // Odds ratio for discordant pairs
    const oddsRatio = c > 0 ? b / c : (b > 0 ? Infinity : 1);

    // Significance
    const pMain = p_exact !== null ? p_exact : p_chi2;
    const significance = pMain < 0.01 ? '**' : pMain < 0.05 ? '*' : pMain < 0.10 ? '†' : 'n.s.';

    return {
        chi2, p_chi2, chi2_corrected, p_corrected, p_exact,
        phi, oddsRatio, N, bc, significance, pMain
    };
}

function binomialPMF(n, k, p) {
    return binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomialCoeff(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < Math.min(k, n - k); i++) {
        result = result * (n - i) / (i + 1);
    }
    return result;
}

// ==========================================
// Main Analysis
// ==========================================

function runMcNemarTest(currentData) {
    const var1 = document.getElementById('mcnemar-var1').value;
    const var2 = document.getElementById('mcnemar-var2').value;

    if (!var1 || !var2) { alert('2つの変数を選択してください'); return; }
    if (var1 === var2) { alert('異なる変数を選択してください'); return; }

    const table = buildContingencyTable(currentData, var1, var2);
    if (table.error) { alert(table.error); return; }

    const { a, b, c, d, label0, label1, N } = table;
    const result = mcnemarTest(a, b, c, d);

    const outputContainer = document.getElementById('mcnemar-results');
    outputContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 分析結果
            </h4>

            <h5 style="color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-th"></i> 2×2 分割表（クロス集計表）</h5>
            <div class="table-container" style="margin-bottom: 1.5rem; max-width: 500px;">
                <table class="table" style="text-align: center; border-collapse: collapse;">
                    <thead>
                        <tr style="border-top: 2px solid #333; border-bottom: 1px solid #999;">
                            <th rowspan="2" style="vertical-align: bottom; padding: 0.5rem;"></th>
                            <th colspan="2" style="text-align: center; padding: 0.5rem; border-left: 1px solid #dee2e6;">${var2}</th>
                            <th rowspan="2" style="vertical-align: bottom; padding: 0.5rem; border-left: 1px solid #dee2e6;">合計</th>
                        </tr>
                        <tr style="border-bottom: 2px solid #333;">
                            <th style="text-align: center; padding: 0.4rem; border-left: 1px solid #dee2e6;">${label1}</th>
                            <th style="text-align: center; padding: 0.4rem;">${label0}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold; padding: 0.5rem;">${var1} = ${label1}</td>
                            <td style="padding: 0.5rem; background: #f0fdf4; border-left: 1px solid #dee2e6;"><strong>${a}</strong></td>
                            <td style="padding: 0.5rem; background: #fef3c7;"><strong>${b}</strong></td>
                            <td style="padding: 0.5rem; border-left: 1px solid #dee2e6;">${a + b}</td>
                        </tr>
                        <tr style="border-bottom: 2px solid #333;">
                            <td style="font-weight: bold; padding: 0.5rem;">${var1} = ${label0}</td>
                            <td style="padding: 0.5rem; background: #fef3c7; border-left: 1px solid #dee2e6;"><strong>${c}</strong></td>
                            <td style="padding: 0.5rem; background: #f0fdf4;"><strong>${d}</strong></td>
                            <td style="padding: 0.5rem; border-left: 1px solid #dee2e6;">${c + d}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold; padding: 0.5rem;">合計</td>
                            <td style="padding: 0.5rem; border-left: 1px solid #dee2e6;">${a + c}</td>
                            <td style="padding: 0.5rem;">${b + d}</td>
                            <td style="padding: 0.5rem; font-weight: bold; border-left: 1px solid #dee2e6;">${N}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 1.5rem;">
                <i class="fas fa-info-circle"></i>
                黄色セル（<strong>b=${b}, c=${c}</strong>）が不一致ペア（検定に使用される値）です。
            </p>

            <h5 style="color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-chart-bar"></i> 検定結果</h5>
            <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                <div class="data-stat-card">
                    <div class="stat-label">χ²値</div>
                    <div class="stat-value">${result.chi2.toFixed(3)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">p値${result.p_exact !== null ? '（正確確率）' : ''}</div>
                    <div class="stat-value" style="${result.pMain < 0.05 ? 'color: #ef4444; font-weight: bold;' : ''}">${result.pMain < 0.001 ? '&lt; .001' : result.pMain.toFixed(4)}${result.significance}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">効果量 φ</div>
                    <div class="stat-value">${result.phi.toFixed(3)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">不一致ペア (b+c)</div>
                    <div class="stat-value">${result.bc}</div>
                </div>
            </div>

            ${result.p_exact !== null ? `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                <p style="margin: 0; font-size: 0.9rem; color: #92400e;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>注意:</strong> 不一致ペア数(b+c=${result.bc})が25未満のため、正確二項検定の結果を報告しています（${result.p_exact < 0.001 ? 'p &lt; .001' : 'p=' + result.p_exact.toFixed(4)}）。
                </p>
            </div>
            ` : ''}

            <div class="table-container" style="margin-bottom: 1.5rem;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th>指標</th>
                            <th>値</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>χ²（補正なし）</td><td>${result.chi2.toFixed(3)}（${result.p_chi2 < 0.001 ? 'p &lt; .001' : 'p = ' + result.p_chi2.toFixed(4)}）</td></tr>
                        <tr><td>χ²（イェーツ補正）</td><td>${result.chi2_corrected.toFixed(3)}（${result.p_corrected < 0.001 ? 'p &lt; .001' : 'p = ' + result.p_corrected.toFixed(4)}）</td></tr>
                        ${result.p_exact !== null ? `<tr><td>正確二項検定</td><td>${result.p_exact < 0.001 ? 'p &lt; .001' : 'p = ' + result.p_exact.toFixed(4)}</td></tr>` : ''}
                        <tr><td>オッズ比 (b/c)</td><td>${result.oddsRatio === Infinity ? '∞' : result.oddsRatio.toFixed(3)}</td></tr>
                        <tr><td>効果量 φ</td><td>${result.phi.toFixed(3)}</td></tr>
                        <tr><td>N（有効ペア数）</td><td>${N}</td></tr>
                    </tbody>
                </table>
            </div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> 結果の解釈
                </h4>
                <div style="line-height: 1.6;">
                    ${interpretMcNemar(result, var1, var2, a, b, c, d, label0, label1, N)}
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
                <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                <div id="mcnemar-apa-container"></div>
            </div>

            <div style="margin-top: 1.5rem;">
                <div id="mcnemar-heatmap"></div>
            </div>
        </div>
    `;

    // APA table
    setTimeout(() => {
        const container = document.getElementById('mcnemar-apa-container');
        if (container) {
            const headers = ["", `${var2} = ${label1}`, `${var2} = ${label0}`];
            const rows = [
                [`${var1} = ${label1}`, String(a), String(b)],
                [`${var1} = ${label0}`, String(c), String(d)]
            ];
            const pText = result.pMain < 0.001 ? '< .001' : result.pMain.toFixed(3);
            const note = `McNemar's χ<sup>2</sup>(1) = ${result.chi2.toFixed(2)}, <em>p</em> ${pText}, φ = ${result.phi.toFixed(2)}. <em>N</em> = ${N}.`;
            container.innerHTML = generateAPATableHtml('mcnemar-apa', 'Table 1. McNemar Test Contingency Table', headers, rows, note);
        }
    }, 0);

    // Heatmap
    plotContingencyHeatmap(a, b, c, d, var1, var2, label0, label1);

    document.getElementById('mcnemar-analysis-results').style.display = 'block';
}

// ==========================================
// Interpretation
// ==========================================

function interpretMcNemar(result, var1, var2, a, b, c, d, label0, label1, N) {
    let html = '';

    const prop1 = (a + b) / N; // var1 = label1 proportion
    const prop2 = (a + c) / N; // var2 = label1 proportion

    if (result.pMain < 0.05) {
        html += `<p>✅ <strong>マクネマー検定の結果、有意な変化が認められました</strong>（`;
        if (result.p_exact !== null) {
            html += `正確二項検定 ${result.p_exact < 0.001 ? 'p &lt; .001' : 'p = ' + result.p_exact.toFixed(3)}`;
        } else {
            html += `χ²(1) = ${result.chi2.toFixed(2)}, ${result.p_chi2 < 0.001 ? 'p &lt; .001' : 'p = ' + result.p_chi2.toFixed(3)}`;
        }
        html += `）。</p>`;

        if (c > b) {
            html += `<p>📈 「${label0}」から「${label1}」へ変化した人（<strong>${c}人</strong>）が、逆方向の変化（<strong>${b}人</strong>）より有意に多いです。</p>`;
        } else {
            html += `<p>📉 「${label1}」から「${label0}」へ変化した人（<strong>${b}人</strong>）が、逆方向の変化（<strong>${c}人</strong>）より有意に多いです。</p>`;
        }
    } else {
        html += `<p>⚠️ マクネマー検定の結果、<strong>有意な変化は認められませんでした</strong>（p = ${result.pMain.toFixed(3)}）。「${var1}」と「${var2}」で比率に有意な差はありません。</p>`;
    }

    html += `<p>📊 <strong>効果量 φ = ${result.phi.toFixed(3)}</strong>: `;
    if (result.phi >= 0.5) html += '大きな効果です。';
    else if (result.phi >= 0.3) html += '中程度の効果です。';
    else if (result.phi >= 0.1) html += '小さな効果です。';
    else html += 'ほぼ効果なしです。';
    html += '</p>';

    html += `<p>📋 ${var1}で「${label1}」の比率: <strong>${(prop1 * 100).toFixed(1)}%</strong> → ${var2}で「${label1}」の比率: <strong>${(prop2 * 100).toFixed(1)}%</strong></p>`;

    return html;
}

// ==========================================
// Visualization
// ==========================================

function plotContingencyHeatmap(a, b, c, d, var1, var2, label0, label1) {
    const z = [[a, b], [c, d]];
    const labels = [label1, label0];

    const trace = {
        z: z,
        x: labels,
        y: labels,
        type: 'heatmap',
        colorscale: [[0, '#fef3c7'], [1, '#22c55e']],
        showscale: false,
        hoverinfo: 'none'
    };

    const annotations = [];
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            const isDiscordant = (i === 0 && j === 1) || (i === 1 && j === 0);
            annotations.push({
                x: labels[j], y: labels[i],
                text: `<b>${z[i][j]}</b>${isDiscordant ? ' ⚡' : ''}`,
                showarrow: false,
                font: { size: 18, color: '#333' }
            });
        }
    }

    const layout = getAcademicLayout({
        title: { text: '分割表ヒートマップ', font: { size: 14 } },
        xaxis: { title: var2, side: 'bottom' },
        yaxis: { title: var1, autorange: 'reversed' },
        margin: { l: 100, b: 80, r: 20, t: 50 },
        annotations: annotations
    });

    Plotly.newPlot('mcnemar-heatmap', [trace], layout, createPlotlyConfig('マクネマー検定', [var1, var2]));
}

// ==========================================
// Render
// ==========================================

export function render(container, currentData, characteristics) {
    const { categoricalColumns } = characteristics;

    // Filter to binary categorical columns
    const binaryColumns = categoricalColumns.filter(col => {
        const unique = [...new Set(currentData.map(r => r[col]).filter(v => v != null))];
        return unique.length === 2;
    });

    container.innerHTML = `
        <div class="mcnemar-container">
            <div style="background: #059669; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sync-alt"></i> マクネマー検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">対応のある2値データの比率変化を検定します（前後比較など）</p>
            </div>

            <!-- 概要 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> マクネマー検定とは？</strong>
                        <p>同じ対象者の「前」と「後」の2値データ（はい/いいえ、合格/不合格など）を比較して、比率が有意に変化したかを調べる検定です。</p>
                        <img src="image/mcnemar.png" alt="マクネマー検定の説明" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 授業の前後で「理解した/しなかった」の比率が変化したか知りたいとき</li>
                        <li><i class="fas fa-check"></i> 治療の前後で「症状あり/なし」の比率が変化したか知りたいとき</li>
                        <li><i class="fas fa-check"></i> 同一人物に2回質問して回答の変化を調べたいとき</li>
                    </ul>
                    <h4>主な指標</h4>
                    <ul>
                        <li><strong>χ²値:</strong> 不一致ペア（変化した人）の偏りを表す統計量です。</li>
                        <li><strong>p値:</strong> 0.05より小さければ「有意に比率が変化した」といえます。</li>
                        <li><strong>効果量 φ:</strong> 変化の大きさを表します（0.1=小, 0.3=中, 0.5=大）。</li>
                    </ul>
                </div>
            </div>

            <!-- ロジック -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-code"></i> 分析ロジック・計算式詳説 (専門家向け)</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note" style="background: #f1f8ff; border-left: 5px solid #0366d6;">
                        <strong><i class="fas fa-check-circle"></i> 実装ロジックの検証</strong>
                        <ul>
                            <li><strong>検定統計量:</strong> χ² = (b − c)² / (b + c)（df = 1）</li>
                            <li><strong>イェーツ補正:</strong> χ² = (|b − c| − 1)² / (b + c)</li>
                            <li><strong>正確検定:</strong> b + c < 25 の場合、二項検定を併用</li>
                            <li><strong>効果量:</strong> φ = √(χ² / N)（全サンプルサイズを基準）</li>
                            <li><strong>前提:</strong> 対応のあるデータ、各変数が2値</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="mcnemar-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="mcnemar-var1-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="mcnemar-var2-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="mcnemar-run-container"></div>
            </div>

            <!-- 結果 -->
            <div id="mcnemar-analysis-results" style="display: none;">
                <div id="mcnemar-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#mcnemar-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('mcnemar-var1-container', binaryColumns, 'mcnemar-var1', {
        label: '<i class="fas fa-arrow-right"></i> 変数1（例: 授業前）:',
        multiple: false
    });

    createVariableSelector('mcnemar-var2-container', binaryColumns, 'mcnemar-var2', {
        label: '<i class="fas fa-arrow-left"></i> 変数2（例: 授業後）:',
        multiple: false
    });

    createAnalysisButton('mcnemar-run-container', '分析を実行', () => runMcNemarTest(currentData), { id: 'run-mcnemar-btn' });
}
