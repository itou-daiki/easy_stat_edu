/**
 * @fileoverview クラスカル・ウォリス検定
 * @module kruskal_wallis
 * @description 3群以上のノンパラメトリック検定（一元配置分散分析の順位版）
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml, addSignificanceBrackets } from '../utils.js';

// `displaySummaryStatistics` is no longer needed as we use an integrated table.

/**
 * ランク付け（同順位は平均ランク）
 * @param {Array<{val: number, group: any, idx: number}>} allData - 全データ
 * @returns {Array} ランク付きデータ
 */
function assignRanks(allData) {
    const sorted = [...allData].sort((a, b) => a.val - b.val);
    let i = 0;
    while (i < sorted.length) {
        let j = i + 1;
        while (j < sorted.length && sorted[j].val === sorted[i].val) {
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
 * タイ補正係数の計算
 * @param {Array} rankedData - ランク付きデータ
 * @returns {number} タイ補正項
 */
function computeTieCorrection(rankedData) {
    const ties = {};
    rankedData.forEach(d => {
        ties[d.val] = (ties[d.val] || 0) + 1;
    });
    let correction = 0;
    for (const val in ties) {
        const t = ties[val];
        if (t > 1) {
            correction += (t * t * t - t);
        }
    }
    return correction;
}

/**
 * クラスカル・ウォリス検定の実行
 * @param {Array<Object>} currentData - 分析対象データ
 */
function runKruskalWallisTest(currentData) {
    const groupVar = document.getElementById('group-var').value;
    const depVarSelect = document.getElementById('dep-var-multiselect-hidden');
    const selectedVars = depVarSelect ? Array.from(depVarSelect.selectedOptions).map(o => o.value) : [];

    if (!groupVar) {
        alert('グループ変数を選択してください');
        return;
    }
    if (selectedVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[groupVar]).filter(v => v != null))];
    if (groups.length < 3) {
        alert(`クラスカル・ウォリス検定は3群以上が必要です（現在: ${groups.length}群）。\n2群の場合はマン・ホイットニーのU検定を使用してください。`);
        return;
    }

    // 統合テーブルの実装に寄せるため、要約統計量の個別表示は削除
    // displaySummaryStatistics(groupVar, selectedVars, currentData);

    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = '';
    document.getElementById('summary-stats-section').innerHTML = ''; // 統合したのでサマリー領域は空にする

    const groupDataMap = {};
    groups.forEach(g => {
        groupDataMap[g] = currentData.filter(row => row[groupVar] === g);
    });

    let resultsTableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> Kruskal-Wallis検定表
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数</th>
                            <th>全体N</th>
                            <th>全体Mdn</th>
                            <th>全体IQR</th>
                            ${groups.map(g => `<th>${g}<br>Mdn</th><th>${g}<br>IQR</th><th>${g}<br>平均順位</th>`).join('')}
                            <th>H</th>
                            <th>df</th>
                            <th>p</th>
                            <th>sign</th>
                            <th>η²<sub>H</sub></th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    const testResults = [];
    const skippedVars = [];

    selectedVars.forEach(varName => {
        // 各群のデータを取得
        const groupValues = {};
        const groupStats = {};
        let validGroups = 0;
        let allValidValuesForVar = [];

        groups.forEach(g => {
            const vals = groupDataMap[g].map(row => Number(row[varName])).filter(v => !isNaN(v));
            groupValues[g] = vals;
            allValidValuesForVar = allValidValuesForVar.concat(vals);
            if (vals.length >= 2) validGroups++;

            // 各群の中央値とIQRを計算
            if (vals.length > 0) {
                const jstatG = jStat(vals);
                const qG = jstatG.quartiles();
                groupStats[g] = {
                    n: vals.length,
                    median: jstatG.median(),
                    iqr: qG[2] - qG[0]
                };
            } else {
                groupStats[g] = { n: 0, median: NaN, iqr: NaN };
            }
        });

        if (validGroups < 3) {
            skippedVars.push(varName);
            return;
        }

        // 全体の中央値とIQR
        const jstatAll = jStat(allValidValuesForVar);
        const qAll = jstatAll.quartiles();
        const overallN = allValidValuesForVar.length;
        const overallMedian = jstatAll.median();
        const overallIqr = qAll[2] - qAll[0];

        // 全データを結合してランク付け
        const allData = [];
        groups.forEach(g => {
            groupValues[g].forEach(v => {
                allData.push({ val: v, group: g });
            });
        });

        const rankedData = assignRanks(allData);
        const N = rankedData.length;

        // 各群の順位和と平均順位
        const rankSums = {};
        const meanRanks = {};
        const groupNs = {};
        groups.forEach(g => {
            const groupRanks = rankedData.filter(d => d.group === g);
            groupNs[g] = groupRanks.length;
            rankSums[g] = groupRanks.reduce((sum, d) => sum + d.rank, 0);
            meanRanks[g] = groupNs[g] > 0 ? rankSums[g] / groupNs[g] : 0;
        });

        // H統計量の計算
        let sumTerm = 0;
        groups.forEach(g => {
            if (groupNs[g] > 0) {
                sumTerm += (rankSums[g] * rankSums[g]) / groupNs[g];
            }
        });
        let H = (12 / (N * (N + 1))) * sumTerm - 3 * (N + 1);

        // タイ補正
        const tieCorrection = computeTieCorrection(rankedData);
        if (tieCorrection > 0) {
            const tieFactor = 1 - tieCorrection / (N * N * N - N);
            if (tieFactor > 0) {
                H = H / tieFactor;
            }
        }

        const df = groups.length - 1;
        const pValue = 1 - jStat.chisquare.cdf(H, df);

        // 効果量 η²H = (H - k + 1) / (N - k)
        const k = groups.length;
        const eta2H = Math.max(0, (H - k + 1) / (N - k));

        const significance = pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : pValue < 0.1 ? '†' : 'n.s.';
        const pText = pValue < 0.001 ? '< .001' : pValue.toFixed(3);

        resultsTableHtml += `
            <tr>
                <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                <td>${overallN}</td>
                <td>${overallMedian.toFixed(2)}</td>
                <td>${overallIqr.toFixed(2)}</td>
                ${groups.map(g => {
            const st = groupStats[g];
            return `<td>${st.n > 0 ? st.median.toFixed(2) : '-'}</td><td>${st.n > 0 ? st.iqr.toFixed(2) : '-'}</td><td>${meanRanks[g].toFixed(2)}</td>`;
        }).join('')}
                <td>${H.toFixed(2)}</td>
                <td>${df}</td>
                <td>${pText}</td>
                <td><strong>${significance}</strong></td>
                <td>${eta2H.toFixed(3)}</td>
            </tr>
        `;

        testResults.push({
            varName, groups, groupValues, meanRanks, rankSums, groupNs,
            H, df, pValue, eta2H, significance, N
        });
    });

    resultsTableHtml += `</tbody></table></div>
        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
            <i class="fas fa-info-circle"></i> <strong>解説</strong>: クラスカル・ウォリス検定は中央値や順位に注目するノンパラメトリック検定です。
        </div>
        <p style="color: #6b7280; text-align: right; margin-top: 0.5rem; font-size: 0.9rem;">
            sign: p&lt;0.01** p&lt;0.05* p&lt;0.1† n.s.<br>
            η²<sub>H</sub>: クラスカル・ウォリスのイータ二乗 = (H − k + 1) / (N − k)
        </p></div>`;

    if (skippedVars.length > 0) {
        resultsTableHtml += `<div class="warning-message" style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
            <strong>注意:</strong> 次の変数は、有効な群が3未満だったため分析から除外されました: ${skippedVars.join(', ')}
        </div>`;
    }

    resultsTableHtml += `
        <div style="margin-top: 1.5rem;">
           <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
           <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">以下のHTMLをコピーしてWord等に貼り付けると、論文作成に役立ちます。</p>
           <div id="reporting-table-container"></div>
        </div>
        <div id="posthoc-results-container" style="margin-top: 1.5rem;"></div>
    `;

    resultsContainer.innerHTML = resultsTableHtml;

    // APA報告用テーブル
    generateReportingTable(testResults, groups);

    // 事後検定（Dunn検定）
    if (testResults.some(r => r.pValue < 0.05)) {
        runPosthocDunnTest(testResults);
    }

    // サンプルサイズ情報
    const groupColors = ['#11b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];
    renderSampleSizeInfo(resultsContainer, currentData.length,
        groups.map((g, i) => ({
            label: g,
            count: groupDataMap[g].length,
            color: groupColors[i % groupColors.length]
        }))
    );

    displayInterpretation(testResults);
    displayVisualization(testResults, groupVar);
    document.getElementById('results-section').style.display = 'block';
}

/**
 * APA報告用テーブルの生成
 */
function generateReportingTable(testResults, groups) {
    const tableDiv = document.getElementById('reporting-table-container');

    const headers = [
        "変数",
        ...groups.map(g => {
            const n = testResults[0]?.groupNs[g] ?? '';
            return `${g} (n=${n})<br>Mean Rank`;
        }),
        "<em>H</em>", "<em>df</em>", "<em>p</em>", "<em>η²<sub>H</sub></em>"
    ];

    const rows = testResults.map(res => {
        let pText = res.pValue.toFixed(3);
        if (res.pValue < 0.001) pText = '< .001';
        return [
            res.varName,
            ...groups.map(g => res.meanRanks[g].toFixed(2)),
            res.H.toFixed(2),
            String(res.df),
            pText,
            res.eta2H.toFixed(3)
        ];
    });

    tableDiv.innerHTML = generateAPATableHtml(
        'kw-apa-table',
        'Table 1. Results of Kruskal-Wallis Test',
        headers, rows,
        'Kruskal-Wallis test with tie correction.'
    );
}

/**
 * Dunn検定（事後多重比較）
 * Bonferroni補正による多重比較
 * @param {Array} testResults - 検定結果配列
 */
function runPosthocDunnTest(testResults) {
    const container = document.getElementById('posthoc-results-container');
    let html = `
        <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;">
            <i class="fas fa-exchange-alt"></i> 事後検定（Dunn検定・Bonferroni補正）
        </h5>
        <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 1rem;">
            全体検定が有意 (p &lt; .05) だった変数について、ペアワイズ比較を実施しました。
        </p>
    `;

    testResults.forEach(result => {
        if (result.pValue >= 0.05) return;

        const { groups, meanRanks, groupNs, N, varName } = result;
        const numComparisons = groups.length * (groups.length - 1) / 2;

        html += `
            <div style="margin-bottom: 1rem;">
                <h6 style="font-weight: bold; color: #1e90ff; margin-bottom: 0.5rem;">${varName}</h6>
                <div class="table-container" style="overflow-x: auto;">
                    <table class="table">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th>比較ペア</th>
                                <th>平均順位差</th>
                                <th>|Z|</th>
                                <th>p値 (調整済)</th>
                                <th>有意差</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // タイ補正項を再計算
        const allData = [];
        groups.forEach(g => {
            result.groupValues[g].forEach(v => {
                allData.push({ val: v, group: g });
            });
        });
        const tieCorrection = computeTieCorrection(assignRanks(allData));

        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const g1 = groups[i];
                const g2 = groups[j];
                const rankDiff = meanRanks[g1] - meanRanks[g2];

                // Dunn検定のZ統計量
                // Z = (Ri_bar - Rj_bar) / SE
                // SE = sqrt( (N(N+1)/12 - tieCorrection/(12*(N-1))) * (1/ni + 1/nj) )
                const baseTerm = (N * (N + 1)) / 12;
                const tieTerm = tieCorrection / (12 * (N - 1));
                const SE = Math.sqrt((baseTerm - tieTerm) * (1 / groupNs[g1] + 1 / groupNs[g2]));

                let z = 0;
                if (SE > 0) {
                    z = Math.abs(rankDiff) / SE;
                }

                // Bonferroni補正
                const pRaw = 2 * (1 - jStat.normal.cdf(z, 0, 1));
                const pAdj = Math.min(1, pRaw * numComparisons);

                const sigPH = pAdj < 0.01 ? '**' : pAdj < 0.05 ? '*' : pAdj < 0.1 ? '†' : 'n.s.';
                const pText = pAdj < 0.001 ? '< .001' : pAdj.toFixed(3);

                html += `
                    <tr>
                        <td>${g1} vs ${g2}</td>
                        <td>${rankDiff.toFixed(2)}</td>
                        <td>${z.toFixed(2)}</td>
                        <td>${pText}</td>
                        <td><strong>${sigPH}</strong></td>
                    </tr>
                `;
            }
        }

        html += `</tbody></table></div></div>`;
    });

    html += `<p style="color: #6b7280; font-size: 0.9rem;">
        <strong>有意差</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1† n.s.（Bonferroni補正適用済み）
    </p>`;

    container.innerHTML = html;
}

/**
 * 結果の解釈を表示
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
    let interpretationHtml = '<ul style="list-style-type: disc; padding-left: 1.5rem; line-height: 1.6;">';

    testResults.forEach(result => {
        const pEval = InterpretationHelper.evaluatePValue(result.pValue);

        // 効果量の判定
        let eta2Text = '';
        if (result.eta2H < 0.01) eta2Text = 'ごくわずか';
        else if (result.eta2H < 0.06) eta2Text = '小';
        else if (result.eta2H < 0.14) eta2Text = '中程度';
        else eta2Text = '大';

        // 最高・最低順位の群を特定
        let maxGroup = result.groups[0], minGroup = result.groups[0];
        result.groups.forEach(g => {
            if (result.meanRanks[g] > result.meanRanks[maxGroup]) maxGroup = g;
            if (result.meanRanks[g] < result.meanRanks[minGroup]) minGroup = g;
        });

        let text = `<strong>${result.varName}</strong>: `;
        if (pEval.isSignificant) {
            text += `群間に統計的に<strong>有意な差が認められました</strong> (H(${result.df}) = ${result.H.toFixed(2)}, ${pEval.text})。`;
            text += `<br>平均順位が最も高いのは「<strong>${maxGroup}</strong>」、最も低いのは「<strong>${minGroup}</strong>」です。`;
            text += `<br>効果量 η²<sub>H</sub> = ${result.eta2H.toFixed(3)} [${eta2Text}]`;
            text += `<br>どの群間に差があるかは、事後検定（Dunn検定）の結果を参照してください。`;
        } else {
            text += `群間に統計的に有意な差は認められませんでした (H(${result.df}) = ${result.H.toFixed(2)}, <em>p</em> = ${result.pValue.toFixed(3)})。`;
            text += `<br>効果量 η²<sub>H</sub> = ${result.eta2H.toFixed(3)} [${eta2Text}]`;
        }

        interpretationHtml += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });

    interpretationHtml += '</ul>';
    contentContainer.innerHTML = interpretationHtml;
}

/**
 * 箱ひげ図の描画
 */
function displayVisualization(testResults, groupVar) {
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

    const groupColors = ['#11b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'];

    testResults.forEach((result, index) => {
        const plotId = `plot-${index}`;
        const plotDiv = document.createElement('div');
        plotDiv.id = plotId;
        plotDiv.className = 'plot-container';
        plotsContainer.appendChild(plotDiv);

        const data = result.groups.map((g, gi) => ({
            y: result.groupValues[g],
            type: 'box',
            name: g,
            marker: { color: groupColors[gi % groupColors.length] },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        }));

        const title = titleControl.checked ? `分布の比較: ${result.varName}` : '';

        // 全データのY範囲
        const allValues = result.groups.flatMap(g => result.groupValues[g]);
        const yMax = Math.max(...allValues);
        const yMin = Math.min(...allValues);
        const yRange = yMax - yMin;

        const layout = {
            title: getBottomTitleAnnotation(title),
            yaxis: {
                title: axisControl.checked ? result.varName : '',
                zeroline: false
            },
            xaxis: {
                title: axisControl.checked ? groupVar : ''
            },
            showlegend: false,
            margin: { t: 60, b: 80, l: 60, r: 20 },
            boxmode: 'group',
            shapes: [],
            annotations: []
        };

        // 有意なペアにブラケットを追加
        if (result.pValue < 0.05) {
            // Dunn検定の結果から有意なペアを取得
            const pairs = [];
            const N = result.N;
            const allData = [];
            result.groups.forEach(g => {
                result.groupValues[g].forEach(v => {
                    allData.push({ val: v, group: g });
                });
            });
            const tieCorrection = computeTieCorrection(assignRanks(allData));
            const numComparisons = result.groups.length * (result.groups.length - 1) / 2;

            for (let i = 0; i < result.groups.length; i++) {
                for (let j = i + 1; j < result.groups.length; j++) {
                    const g1 = result.groups[i];
                    const g2 = result.groups[j];
                    const rankDiff = result.meanRanks[g1] - result.meanRanks[g2];
                    const baseTerm = (N * (N + 1)) / 12;
                    const tieTerm = tieCorrection / (12 * (N - 1));
                    const SE = Math.sqrt((baseTerm - tieTerm) * (1 / result.groupNs[g1] + 1 / result.groupNs[g2]));
                    const z = SE > 0 ? Math.abs(rankDiff) / SE : 0;
                    const pRaw = 2 * (1 - jStat.normal.cdf(z, 0, 1));
                    const pAdj = Math.min(1, pRaw * numComparisons);
                    const sig = pAdj < 0.01 ? '**' : pAdj < 0.05 ? '*' : pAdj < 0.1 ? '†' : 'n.s.';

                    if (pAdj < 0.1) {
                        pairs.push({ g1, g2, significance: sig, p: pAdj });
                    }
                }
            }

            if (pairs.length > 0) {
                addSignificanceBrackets(layout, pairs, result.groups, yMax, yRange);
            }
        }

        const config = createPlotlyConfig('Kruskal-Wallis', result.varName);
        Plotly.newPlot(plotId, data, layout, config);
    });

    const updateAllPlots = () => {
        testResults.forEach((result, index) => {
            const plotId = `plot-${index}`;
            const title = titleControl.checked ? `分布の比較: ${result.varName}` : '';
            Plotly.relayout(plotId, {
                title: getBottomTitleAnnotation(title),
                'yaxis.title': axisControl.checked ? result.varName : '',
                'xaxis.title': axisControl.checked ? groupVar : ''
            });
        });
    };

    axisControl.addEventListener('change', updateAllPlots);
    titleControl.addEventListener('change', updateAllPlots);
}

/**
 * メインのrender関数
 * @param {HTMLElement} container - 描画先コンテナ
 * @param {Array<Object>} currentData - 分析対象データ
 * @param {Object} characteristics - データの特性
 */
export function render(container, currentData, characteristics) {
    container.innerHTML = `
        <div class="kruskal-wallis-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sort-amount-up"></i> クラスカル・ウォリス検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3つ以上の独立したグループ間の順位に基づいた差の検定を行います（ノンパラメトリック検定）</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> クラスカル・ウォリス検定とは？</strong>
                        <p>3つ以上のグループに差があるかを調べるノンパラメトリック検定です。一元配置分散分析（ANOVA）の「順位版」で、データの正規性を仮定しません。平均値ではなく、順位（ランキング）を使って比較します。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> <strong>正規性が仮定できない:</strong> データが正規分布に従っていないとき（外れ値や歪みが大きい場合）</li>
                        <li><i class="fas fa-check"></i> <strong>順位データ:</strong> リッカート尺度（例: 5段階評定）など順序データを比較したいとき</li>
                        <li><i class="fas fa-check"></i> <strong>サンプルサイズが小さい:</strong> 各群の人数が少ないとき</li>
                        <li><i class="fas fa-check"></i> <strong>3群以上:</strong> マン・ホイットニーU検定の多群版として使用</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>H値:</strong> クラスカル・ウォリスの検定統計量です。群間の順位の違いが大きいほどH値は大きくなります。</li>
                        <li><strong>p値:</strong> 0.05より小さければ、少なくとも1つのグループペアに「差がある」と判断できます。</li>
                        <li><strong>事後検定:</strong> 全体検定が有意な場合、どのグループ間に差があるかをDunn検定で確認します。</li>
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
                        <p>クラスカル・ウォリス検定 (Kruskal-Wallis H Test) を使用しています。</p>
                        <ul>
                            <li><strong>検定統計量 (H):</strong> \\( H = \\frac{12}{N(N+1)} \\sum_{i=1}^{k} \\frac{R_i^2}{n_i} - 3(N+1) \\)</li>
                            <li><strong>タイ補正:</strong> 同順位がある場合、\\( H_{corrected} = H / (1 - \\sum(t^3 - t) / (N^3 - N)) \\)</li>
                            <li><strong>p値:</strong> カイ二乗分布 (df = k-1) を使用した近似</li>
                            <li><strong>効果量 (η²<sub>H</sub>):</strong> \\( \\eta^2_H = (H - k + 1) / (N - k) \\)</li>
                            <li><strong>事後検定:</strong> Dunn検定（Bonferroni補正）</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="kw-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="group-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
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

    renderDataOverview('#kw-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    const { numericColumns, categoricalColumns } = characteristics;

    createVariableSelector('group-var-container', categoricalColumns, 'group-var', {
        label: '<i class="fas fa-layer-group"></i> グループ変数（カテゴリ変数、3群以上）を選択:',
        multiple: false, placeholder: '選択してください...'
    });

    createVariableSelector('dep-var-multiselect', numericColumns, 'dep-var-multiselect-hidden', {
        label: '<i class="fas fa-check-square"></i> 検定変数を複数選択:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('run-btn-container', '分析を実行', () => runKruskalWallisTest(currentData), { id: 'run-kw-test-btn' });
}
