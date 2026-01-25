import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, showError } from '../utils.js';

// 要約統計量の計算と表示
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

    displaySummaryStatistics(selectedVars, currentData);

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
               <div id="reporting-table-container" style="border: 1px solid #e5e7eb; padding: 1rem; border-radius: 4px; background: #fff;"></div>
               <button id="copy-table-btn" class="btn btn-secondary" style="margin-top: 0.5rem;"><i class="fas fa-copy"></i> 表をコピー</button>
            </div>
        </div>
    `;

    const group0Data = currentData.filter(row => row[groupVar] === groups[0]);
    const group1Data = currentData.filter(row => row[groupVar] === groups[1]);

    let resultsTableHtml = `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="font-weight: bold; color: #495057;">変数</th>
                        <th>${groups[0]} 平均順位</th>
                        <th>${groups[1]} 平均順位</th>
                        <th>U値</th>
                        <th>Z値</th>
                        <th>p値</th>
                        <th>有意差</th>
                        <th>効果量 r</th>
                    </tr>
                </thead>
                <tbody>
    `;

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

        // ランク計算のための準備: 全データを値と元の所属グループで持つ
        const n1 = group0Values.length;
        const n2 = group1Values.length;
        const allData = [
            ...group0Values.map(v => ({ val: v, group: 0 })),
            ...group1Values.map(v => ({ val: v, group: 1 }))
        ];

        // 値でソート (昇順)
        allData.sort((a, b) => a.val - b.val);

        // ランク付け (同順位は平均ランク)
        let i = 0;
        while (i < allData.length) {
            let j = i + 1;
            while (j < allData.length && allData[j].val === allData[i].val) {
                j++;
            }
            // i から j-1 までが同順位
            const rankSum = (i + 1 + j) * (j - i) / 2.0; // i+1は1-based rankの開始、jは終了+1
            const avgRank = rankSum / (j - i);
            for (let k = i; k < j; k++) {
                allData[k].rank = avgRank;
            }
            i = j;
        }

        // ランク和の計算
        let rankSum1 = 0;
        let rankSum2 = 0;
        allData.forEach(d => {
            if (d.group === 0) rankSum1 += d.rank;
            else rankSum2 += d.rank;
        });

        // U値の計算
        const u1 = rankSum1 - (n1 * (n1 + 1)) / 2;
        const u2 = rankSum2 - (n2 * (n2 + 1)) / 2;
        const u = Math.min(u1, u2); // 通常、小さい方のU値を報告

        // Z値の計算 (正規近似)
        const meanU = (n1 * n2) / 2;

        // タイ補正のためのシグマ計算
        // 同順位のグループ(t_k)を見つける
        const ties = {};
        allData.forEach(d => {
            ties[d.val] = (ties[d.val] || 0) + 1;
        });

        let tieCorrection = 0;
        const N = n1 + n2;
        for (const val in ties) {
            const t = ties[val];
            if (t > 1) {
                tieCorrection += (t * t * t - t);
            }
        }

        const varianceU = (n1 * n2 * (N * N * N - N - tieCorrection)) / (12 * N * (N - 1));
        const stdU = Math.sqrt(varianceU);

        // 連続性の補正は行わない（SPSS等のデフォルトに合わせる場合が多いが、細かい実装による）
        // ここでは単純な正規近似 Z = (U - meanU) / stdU

        let z = 0;
        if (stdU > 0) {
            z = (u - meanU) / stdU;
        }

        // P値 (両側検定)
        const p_value = jStat.normal.cdf(z, 0, 1) * 2; // zは通常負になる（U < meanU のため）

        // 効果量 r = Z / sqrt(N)
        const r = Math.abs(z) / Math.sqrt(N);

        // 有意差の判定
        let significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : p_value < 0.1 ? '†' : 'n.s.';

        // 結果表示用
        const meanRank1 = rankSum1 / n1;
        const meanRank2 = rankSum2 / n2;

        resultsTableHtml += `
            <tr>
                <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                <td>${meanRank1.toFixed(2)}</td>
                <td>${meanRank2.toFixed(2)}</td>
                <td>${u.toFixed(2)}</td>
                <td>${z.toFixed(2)}</td>
                <td>${p_value.toFixed(3)}</td>
                <td><strong>${significance}</strong></td>
                <td>${r.toFixed(2)}</td>
            </tr>
        `;

        testResults.push({
            varName, groups, meanRank1, meanRank2, u, z, p_value, r, significance,
            group0Values, group1Values, n1, n2, rankSum1, rankSum2
        });
    });

    resultsTableHtml += `</tbody></table></div><p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;"><strong>有意差</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1†</p>`;

    if (skippedVars.length > 0) {
        resultsTableHtml += `<div class="warning-message" style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
            <strong>注意:</strong> 次の変数は、片方または両方のグループのサンプルサイズが2未満だったため、分析から除外されました: ${skippedVars.join(', ')}
        </div>`;
    }

    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    // Reporting Table (Hyoun) Generation
    generateReportingTable(testResults, groups);

    // サンプルサイズ情報
    renderSampleSizeInfo(resultsContainer, currentData.length, [
        { label: groups[0], count: group0Data.length, color: '#11b981' },
        { label: groups[1], count: group1Data.length, color: '#f59e0b' }
    ]);

    displayInterpretation(testResults);
    displayVisualization(testResults);
    document.getElementById('results-section').style.display = 'block';
}

function generateReportingTable(testResults, groups) {
    const tableDiv = document.getElementById('reporting-table-container');
    const copyBtn = document.getElementById('copy-table-btn');

    let html = `
    <table style="border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; color: #000;">
        <caption style="text-align: left; font-style: italic; margin-bottom: 0.5em;">Table 1. 結果の比較</caption>
        <thead style="border-top: 2px solid #000; border-bottom: 1px solid #000;">
            <tr>
                <th style="padding: 0.5em; text-align: left;">変数</th>
                <th style="padding: 0.5em; text-align: center;">${groups[0]} (n=${testResults[0].n1})<br>Mean Rank</th>
                <th style="padding: 0.5em; text-align: center;">${groups[1]} (n=${testResults[0].n2})<br>Mean Rank</th>
                <th style="padding: 0.5em; text-align: center;"><em>U</em></th>
                <th style="padding: 0.5em; text-align: center;"><em>Z</em></th>
                <th style="padding: 0.5em; text-align: center;"><em>p</em></th>
                <th style="padding: 0.5em; text-align: center;"><em>r</em></th>
            </tr>
        </thead>
        <tbody style="border-bottom: 2px solid #000;">
    `;

    testResults.forEach(res => {
        // p値のフォーマット (APA style: .05などは0を省略するが、ここではわかりやすさ重視でそのまま、または< .001)
        let pText = res.p_value.toFixed(3);
        if (res.p_value < 0.001) pText = '< .001';

        html += `
            <tr>
                <td style="padding: 0.5em; text-align: left;">${res.varName}</td>
                <td style="padding: 0.5em; text-align: center;">${res.meanRank1.toFixed(2)}</td>
                <td style="padding: 0.5em; text-align: center;">${res.meanRank2.toFixed(2)}</td>
                <td style="padding: 0.5em; text-align: center;">${res.u.toFixed(2)}</td>
                <td style="padding: 0.5em; text-align: center;">${res.z.toFixed(2)}</td>
                <td style="padding: 0.5em; text-align: center;">${pText}</td>
                <td style="padding: 0.5em; text-align: center;">${res.r.toFixed(2)}</td>
            </tr>
        `;
    });

    html += `</tbody></table>
    <div style="font-size: 0.9em; margin-top: 0.5em; font-style: italic;">Note. Mann-Whitney U test.</div>`;

    tableDiv.innerHTML = html;

    copyBtn.onclick = () => {
        const range = document.createRange();
        range.selectNode(tableDiv);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        alert('表をコピーしました');
    };
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
            marker: { color: '#11b981' },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const trace1 = {
            y: result.group1Values,
            type: 'box',
            name: result.groups[1],
            marker: { color: '#f59e0b' },
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8
        };

        const data = [trace0, trace1];

        const title = titleControl.checked ? `分布の比較: ${result.varName}` : '';

        const layout = {
            title: getBottomTitleAnnotation(title),
            yaxis: {
                title: axisControl.checked ? result.varName : '',
                zeroline: false
            },
            showlegend: false,
            margin: { t: 40, b: 80, l: 60, r: 20 },
            boxmode: 'group'
        };

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
                        <p>対応のないt検定のノンパラメトリック版です。データが正規分布に従わない場合や、順序尺度の場合に使用します。平均値ではなく「平均順位」を比較します。</p>
                        <p><strong>報告用の表（Hyoun）</strong>: 分析結果セクションの下に、論文やレポートで使用できる形式の表が生成されます。</p>
                    </div>
                </div>
            </div>

            <div id="u-test-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="group-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="dep-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;">
                        <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;"><i class="fas fa-check-square"></i> 検定変数を複数選択:</label>
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
