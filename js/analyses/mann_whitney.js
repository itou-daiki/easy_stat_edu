/**
 * @fileoverview マン・ホイットニーのU検定
 * @module mann_whitney
 * @description 2群間のノンパラメトリック検定（順序尺度・非正規分布用）
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, getAcademicLayout, academicColors, InterpretationHelper, showError, generateAPATableHtml, addSignificanceBrackets } from '../utils.js';

/**
 * 要約統計量の計算と表示
 * @param {Array<string>} variables - 変数名配列
 * @param {Array<Object>} currentData - 分析対象データ
 */
function displaySummaryStatistics(variables, currentData) {
    const container = document.getElementById('summary-stats-section');

    let tableHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 要約統計量
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数名</th>
                            <th>有効N</th>
                            <th>平均値</th>
                            <th>中央値</th>
                            <th>標準偏差</th>
                            <th>最小値</th>
                            <th>最大値</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    variables.forEach(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            const stats = {
                n: values.length,
                mean: jstat.mean(),
                median: jstat.median(),
                std: jstat.stdev(true),
                min: jstat.min(),
                max: jstat.max()
            };

            tableHtml += `
                <tr>
                    <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                    <td>${stats.n}</td>
                    <td>${stats.mean.toFixed(2)}</td>
                    <td>${stats.median.toFixed(2)}</td>
                    <td>${stats.std.toFixed(2)}</td>
                    <td>${stats.min.toFixed(2)}</td>
                    <td>${stats.max.toFixed(2)}</td>
                </tr>
            `;
        }
    });

    tableHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = tableHtml;
}

// マン・ホイットニーのU検定を実行
function runMannWhitneyTest(currentData) {
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
    if (groups.length !== 2) {
        alert(`グループ変数は2群である必要があります（現在: ${groups.length}群）`);
        return;
    }

    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 分析結果
            </h4>
            <div id="test-results-table"></div>
            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">以下のHTMLをコピーしてWord等に貼り付けると、論文作成に役立ちます。</p>
               <div id="reporting-table-container"></div>
            </div>
        </div>
    `;

    const group0Data = currentData.filter(row => row[groupVar] === groups[0]);
    const group1Data = currentData.filter(row => row[groupVar] === groups[1]);
    const n1Total = group0Data.length;
    const n2Total = group1Data.length;
    const NTotal = n1Total + n2Total;

    const testResults = [];
    const skippedVars = [];

    selectedVars.forEach(varName => {
        // データ抽出
        const group0Values = group0Data.map(row => Number(row[varName])).filter(v => !isNaN(v));
        const group1Values = group1Data.map(row => Number(row[varName])).filter(v => !isNaN(v));

        if (group0Values.length < 2 || group1Values.length < 2) {
            skippedVars.push(varName);
            return;
        }

        // 群別記述統計量
        const stats0 = {
            mean: jStat.mean(group0Values),
            sd: jStat.stdev(group0Values, true),
            median: jStat.median(group0Values)
        };
        const stats1 = {
            mean: jStat.mean(group1Values),
            sd: jStat.stdev(group1Values, true),
            median: jStat.median(group1Values)
        };

        // ランク計算
        const n1 = group0Values.length;
        const n2 = group1Values.length;
        const allData = [
            ...group0Values.map(v => ({ val: v, group: 0 })),
            ...group1Values.map(v => ({ val: v, group: 1 }))
        ];

        allData.sort((a, b) => a.val - b.val);

        // ランク付け (同順位は平均ランク)
        let i = 0;
        while (i < allData.length) {
            let j = i + 1;
            while (j < allData.length && allData[j].val === allData[i].val) j++;
            const rankSum = (i + 1 + j) * (j - i) / 2.0;
            const avgRank = rankSum / (j - i);
            for (let k = i; k < j; k++) allData[k].rank = avgRank;
            i = j;
        }

        let rankSum1 = 0, rankSum2 = 0;
        allData.forEach(d => { if (d.group === 0) rankSum1 += d.rank; else rankSum2 += d.rank; });

        const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
        const u2 = rankSum2 - (n2 * (n2 + 1)) / 2;
        const u = Math.min(u1, u2);

        const meanU = (n1 * n2) / 2;
        const ties = {};
        allData.forEach(d => { ties[d.val] = (ties[d.val] || 0) + 1; });
        let tieCorrection = 0;
        const N = n1 + n2;
        for (const val in ties) { const t = ties[val]; if (t > 1) tieCorrection += (t * t * t - t); }
        const varianceU = (n1 * n2 * (N * N * N - N - tieCorrection)) / (12 * N * (N - 1));
        const stdU = Math.sqrt(varianceU);

        let zRaw = 0;
        if (stdU > 0) zRaw = (u - meanU) / stdU;
        const z = Math.abs(zRaw);
        const pLower = jStat.normal.cdf(zRaw, 0, 1);
        const p_value = 2 * Math.min(pLower, 1 - pLower);
        const r = z / Math.sqrt(N);

        let significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : p_value < 0.10 ? '†' : 'n.s.';

        const meanRank1 = rankSum1 / n1;
        const meanRank2 = rankSum2 / n2;

        testResults.push({
            varName, groups, meanRank1, meanRank2, u, z, p_value, r, significance,
            group0Values, group1Values, n1, n2, rankSum1, rankSum2,
            stats0, stats1
        });
    });

    // === 学術論文形式の統合テーブル ===
    let resultsTableHtml = `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table" style="border-collapse: collapse; width: 100%;">
                <thead style="background: #f8f9fa;">
                    <tr style="border-top: 2px solid #333; border-bottom: 1px solid #999;">
                        <th rowspan="2" style="font-weight: bold; color: #495057; vertical-align: bottom; padding: 0.5rem;"></th>
                        <th colspan="3" style="text-align: center; font-weight: bold; padding: 0.5rem; border-left: 1px solid #dee2e6;">${groups[0]}（<em>n</em>=${n1Total}）</th>
                        <th colspan="3" style="text-align: center; font-weight: bold; padding: 0.5rem; border-left: 1px solid #dee2e6;">${groups[1]}（<em>n</em>=${n2Total}）</th>
                        <th colspan="2" style="text-align: center; font-weight: bold; padding: 0.5rem; border-left: 1px solid #dee2e6;">群間の差の検定</th>
                    </tr>
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="text-align: center; padding: 0.4rem; border-left: 1px solid #dee2e6;">平均</th>
                        <th style="text-align: center; padding: 0.4rem;"><em>SD</em></th>
                        <th style="text-align: center; padding: 0.4rem;">中央値</th>
                        <th style="text-align: center; padding: 0.4rem; border-left: 1px solid #dee2e6;">平均</th>
                        <th style="text-align: center; padding: 0.4rem;"><em>SD</em></th>
                        <th style="text-align: center; padding: 0.4rem;">中央値</th>
                        <th style="text-align: center; padding: 0.4rem; border-left: 1px solid #dee2e6;">統計量（<em>U</em>）</th>
                        <th style="text-align: center; padding: 0.4rem;">効果量（<em>r</em>）</th>
                    </tr>
                </thead>
                <tbody>
    `;

    testResults.forEach(res => {
        const uDisplay = Math.round(res.u);
        resultsTableHtml += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="font-weight: bold; color: #333; padding: 0.5rem; white-space: nowrap;">${res.varName}</td>
                <td style="text-align: center; padding: 0.5rem; border-left: 1px solid #dee2e6;">${res.stats0.mean.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem;">${res.stats0.sd.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem;">${res.stats0.median.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem; border-left: 1px solid #dee2e6;">${res.stats1.mean.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem;">${res.stats1.sd.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem;">${res.stats1.median.toFixed(2)}</td>
                <td style="text-align: center; padding: 0.5rem; border-left: 1px solid #dee2e6; font-weight: ${res.significance ? 'bold' : 'normal'};">${uDisplay}${res.significance}</td>
                <td style="text-align: center; padding: 0.5rem;">${res.r.toFixed(2)}</td>
            </tr>
        `;
    });

    resultsTableHtml += `
                </tbody>
            </table>
        </div>
        <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.85rem;">
            <em>N</em>=${NTotal}　**<em>p</em>&lt;.01　*<em>p</em>&lt;.05　†<em>p</em>&lt;.10
        </p>
    `;

    if (skippedVars.length > 0) {
        resultsTableHtml += `<div class="warning-message" style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
            <strong>注意:</strong> 次の変数は、片方または両方のグループのサンプルサイズが2未満だったため、分析から除外されました: ${skippedVars.join(', ')}
        </div>`;
    }

    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    // APA Reporting Table
    generateReportingTable(testResults, groups, n1Total, n2Total, NTotal);

    // サンプルサイズ情報
    renderSampleSizeInfo(resultsContainer, currentData.length, [
        { label: groups[0], count: group0Data.length, color: '#11b981' },
        { label: groups[1], count: group1Data.length, color: '#f59e0b' }
    ]);

    displayInterpretation(testResults);
    displayVisualization(testResults);
    document.getElementById('results-section').style.display = 'block';
}

function generateReportingTable(testResults, groups, n1Total, n2Total, NTotal) {
    const tableDiv = document.getElementById('reporting-table-container');
    if (!tableDiv || testResults.length === 0) return;

    // APA style table with multi-level headers (rendered as custom HTML)
    let html = `
        <div id="mw-apa-table" style="font-family: 'Times New Roman', serif; margin: 1rem 0;">
            <p style="font-style: italic; margin-bottom: 0.5rem;">Table 1. Results of Mann-Whitney U Test</p>
            <table style="border-collapse: collapse; width: 100%; font-size: 0.9rem;">
                <thead>
                    <tr style="border-top: 2px solid #000; border-bottom: 1px solid #000;">
                        <th rowspan="2" style="text-align: left; padding: 4px 8px; vertical-align: bottom;"></th>
                        <th colspan="3" style="text-align: center; padding: 4px 8px; border-left: 1px solid #ccc;">${groups[0]} (<em>n</em>=${n1Total})</th>
                        <th colspan="3" style="text-align: center; padding: 4px 8px; border-left: 1px solid #ccc;">${groups[1]} (<em>n</em>=${n2Total})</th>
                        <th colspan="2" style="text-align: center; padding: 4px 8px; border-left: 1px solid #ccc;">Test</th>
                    </tr>
                    <tr style="border-bottom: 1px solid #000;">
                        <th style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;"><em>M</em></th>
                        <th style="text-align: center; padding: 4px 6px;"><em>SD</em></th>
                        <th style="text-align: center; padding: 4px 6px;"><em>Mdn</em></th>
                        <th style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;"><em>M</em></th>
                        <th style="text-align: center; padding: 4px 6px;"><em>SD</em></th>
                        <th style="text-align: center; padding: 4px 6px;"><em>Mdn</em></th>
                        <th style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;"><em>U</em></th>
                        <th style="text-align: center; padding: 4px 6px;"><em>r</em></th>
                    </tr>
                </thead>
                <tbody>
    `;

    testResults.forEach(res => {
        const uDisplay = Math.round(res.u);
        html += `
            <tr>
                <td style="text-align: left; padding: 4px 8px;">${res.varName}</td>
                <td style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;">${res.stats0.mean.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px;">${res.stats0.sd.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px;">${res.stats0.median.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;">${res.stats1.mean.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px;">${res.stats1.sd.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px;">${res.stats1.median.toFixed(2)}</td>
                <td style="text-align: center; padding: 4px 6px; border-left: 1px solid #ccc;">${uDisplay}${res.significance}</td>
                <td style="text-align: center; padding: 4px 6px;">${res.r.toFixed(2)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <p style="font-size: 0.8rem; margin-top: 0.25rem;"><em>N</em>=${NTotal}　**<em>p</em>&lt;.01　*<em>p</em>&lt;.05　†<em>p</em>&lt;.10</p>
        </div>
    `;

    tableDiv.innerHTML = html;
}

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
        const text = InterpretationHelper.interpretMannWhitney(result.p_value, result.meanRank1, result.meanRank2, result.groups, result.r);
        interpretationHtml += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });
    interpretationHtml += '</ul>';

    contentContainer.innerHTML = interpretationHtml;
}

function displayVisualization(testResults) {
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

    testResults.forEach((result, index) => {
        const plotId = `plot-${index}`;
        const plotDiv = document.createElement('div');
        plotDiv.id = plotId;
        plotDiv.className = 'plot-container';
        plotsContainer.appendChild(plotDiv);

        // Box plot with jittered points (boxpoints: 'all')
        const trace0 = {
            y: result.group0Values,
            type: 'box',
            name: result.groups[0],
            marker: { color: academicColors.palette[0] },
            fillcolor: academicColors.boxFill,
            line: { color: academicColors.boxLine },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const trace1 = {
            y: result.group1Values,
            type: 'box',
            name: result.groups[1],
            marker: { color: academicColors.palette[1] },
            fillcolor: academicColors.boxFill,
            line: { color: academicColors.palette[1] },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const data = [trace0, trace1];

        const title = titleControl.checked ? `分布の比較: ${result.varName}` : '';

        const layout = getAcademicLayout({
            title: getBottomTitleAnnotation(title),
            yaxis: {
                title: axisControl.checked ? result.varName : '',
                zeroline: false
            },
            showlegend: false,
            margin: { t: 60, b: 80, l: 60, r: 20 },
            boxmode: 'group',
            shapes: [],
            annotations: []
        });

        // Add significance brackets
        // For box plots, yMax is the max of the data (plus some whiskers, outliers)
        const yMax = Math.max(
            ...result.group0Values,
            ...result.group1Values
        );
        const yMin = Math.min(
            ...result.group0Values,
            ...result.group1Values
        );
        const yRange = yMax - yMin;

        const pairs = [{
            g1: result.groups[0],
            g2: result.groups[1],
            significance: result.significance,
            p: result.p_value
        }];

        addSignificanceBrackets(layout, pairs, result.groups, yMax, yRange);

        const config = createPlotlyConfig('Mann-Whitney_U', result.varName);

        Plotly.newPlot(plotId, data, layout, config);
    });

    const updateAllPlots = () => {
        testResults.forEach((result, index) => {
            const plotId = `plot-${index}`;
            const title = titleControl.checked ? `分布の比較: ${result.varName}` : '';

            const updateObj = {
                title: getBottomTitleAnnotation(title),
                'yaxis.title': axisControl.checked ? result.varName : ''
            };

            Plotly.relayout(plotId, updateObj);
        });
    };

    axisControl.addEventListener('change', updateAllPlots);
    titleControl.addEventListener('change', updateAllPlots);
}

export function render(container, currentData, characteristics) {
    container.innerHTML = `
        <div class="mann-whitney-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-balance-scale"></i> マン・ホイットニーのU検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの独立したグループ間の順位に基づいた差の検定を行います（ノンパラメトリック検定）</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> マン・ホイットニーのU検定とは？</strong>
                        <p>2つのグループの間に差があるかを調べる方法ですが、t検定と違って「平均値」ではなく「順位（ランキング）」を使って比較します。データが極端な値を含んでいたり、人数が少ない場合に適しています。</p>
                        <img src="image/mann_whitney.png" alt="U検定のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> <strong>順位データ:</strong> 「徒競走の順位」や「5段階評価」など、明確な数値ではないデータを比較したいとき</li>
                        <li><i class="fas fa-check"></i> <strong>外れ値がある:</strong> 一人だけ極端に点数が高い人がいて、平均値が信用できないとき</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>p値:</strong> 0.05より小さければ、2つのグループに「差がある」といえます。</li>
                        <li><strong>Z値・U値:</strong> 検定のための統計量です。報告するときに使います。</li>
                    </ul>
                </div>
            </div>

            <!-- ロジック詳説 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-code"></i> 分析ロジック・計算式詳説 (専門家向け)</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note" style="background: #f1f8ff; border-left: 5px solid #0366d6;">
                        <strong><i class="fas fa-check-circle"></i> 実装ロジックの検証</strong>
                        <p>マン・ホイットニーのU検定 (Wilcoxon Rank Sum Test) を使用しています。</p>
                        <ul>
                            <li><strong>統計量 (U):</strong> 順位和から算出 (\( U_1 = R_1 - \frac{n_1(n_1+1)}{2} \))</li>
                            <li><strong>p値:</strong> 正規近似 (Z検定) を使用 (タイ/同順位がある場合は分散の補正あり)</li>
                            <li><strong>効果量 (r):</strong> \( r = \frac{|Z|}{\sqrt{N}} \) （Nは総サンプル数）</li>
                            <li>※ N > 20 の場合、正規近似の精度は十分高いとみなされます。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="u-test-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

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

    renderDataOverview('#u-test-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    const { numericColumns, categoricalColumns } = characteristics;

    createVariableSelector('group-var-container', categoricalColumns, 'group-var', {
        label: '<i class="fas fa-layer-group"></i> グループ変数（カテゴリ変数、2群）を選択:',
        multiple: false, placeholder: '選択してください...'
    });

    createVariableSelector('dep-var-multiselect', numericColumns, 'dep-var-multiselect-hidden', {
        label: '<i class="fas fa-check-square"></i> 検定変数を複数選択:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('run-btn-container', '分析を実行', () => runMannWhitneyTest(currentData), { id: 'run-u-test-btn' });
}
