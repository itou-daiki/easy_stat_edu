import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, getEffectSizeInterpretation, createVariableSelector, renderSampleSizeInfo, createAnalysisButton } from '../utils.js';

// 要約統計量の計算と表示
function displaySummaryStatistics(variables) {
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
                            <th>分散</th>
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
                variance: jstat.variance(true),
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
                    <td>${stats.variance.toFixed(2)}</td>
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

// 対応なしt検定の実行
function runIndependentTTest() {
    const groupVar = document.getElementById('group-var').value;
    const depVarSelect = document.getElementById('dep-var');
    const selectedVars = Array.from(depVarSelect.selectedOptions).map(opt => opt.value);

    if (!groupVar) {
        alert('グループ変数を選択してください');
        return;
    }

    if (selectedVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    // グループの抽出
    const groups = [...new Set(currentData.map(row => row[groupVar]).filter(v => v != null))];

    if (groups.length !== 2) {
        alert(`グループ変数は2群である必要があります（現在: ${groups.length}群）`);
        return;
    }

    // 要約統計量の表示
    displaySummaryStatistics(selectedVars);

    // 結果セクションの表示
    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応なし）
            </h4>
            <div id="test-results-table"></div>
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
                        <th>全体M</th>
                        <th>全体S.D</th>
                        <th>${groups[0]}M</th>
                        <th>${groups[0]}S.D</th>
                        <th>${groups[1]}M</th>
                        <th>${groups[1]}S.D</th>
                        <th>df</th>
                        <th>t</th>
                        <th>p</th>
                        <th>sign</th>
                        <th>d</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const testResults = [];

    selectedVars.forEach(varName => {
        const allValues = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        const group0Values = group0Data.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        const group1Values = group1Data.map(row => row[varName]).filter(v => v != null && !isNaN(v));

        if (group0Values.length < 2 || group1Values.length < 2) {
            return;
        }

        const n1 = group0Values.length;
        const n2 = group1Values.length;
        const mean1 = jStat.mean(group0Values);
        const mean2 = jStat.mean(group1Values);
        const std1 = jStat.stdev(group0Values, true);
        const std2 = jStat.stdev(group1Values, true);
        const var1 = std1 * std1;
        const var2 = std2 * std2;

        // Welchのt検定
        const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
        const t_stat = (mean1 - mean2) / se_welch;

        // Welch-Satterthwaiteの自由度
        const df_numerator = (var1 / n1 + var2 / n2) ** 2;
        const df_denominator = (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1);
        const df_welch = df_numerator / df_denominator;

        // p値
        const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df_welch) * 2;

        // 効果量d
        const pooled_std = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
        const cohens_d = Math.abs((mean1 - mean2) / pooled_std);

        // 有意性
        let significance;
        if (p_value < 0.01) significance = '**';
        else if (p_value < 0.05) significance = '*';
        else if (p_value < 0.1) significance = '†';
        else significance = 'n.s.';

        const allMean = jStat.mean(allValues);
        const allStd = jStat.stdev(allValues, true);

        resultsTableHtml += `
            <tr>
                <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                <td>${allMean.toFixed(2)}</td>
                <td>${allStd.toFixed(2)}</td>
                <td>${mean1.toFixed(2)}</td>
                <td>${std1.toFixed(2)}</td>
                <td>${mean2.toFixed(2)}</td>
                <td>${std2.toFixed(2)}</td>
                <td>${df_welch.toFixed(2)}</td>
                <td>${Math.abs(t_stat).toFixed(2)}</td>
                <td>${p_value.toFixed(2)}</td>
                <td><strong>${significance}</strong></td>
                <td>${cohens_d.toFixed(2)}</td>
            </tr>
        `;

        testResults.push({
            varName,
            groups,
            mean1,
            mean2,
            std1,
            std2,
            n1,
            n2,
            t_stat,
            p_value,
            cohens_d,
            significance,
            group0Values,
            group1Values
        });
    });

    resultsTableHtml += `
                </tbody>
            </table>
        </div>
        <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;">
            <strong>sign</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1†
        </p>
    `;

    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    // サンプルサイズ
    renderSampleSizeInfo(resultsContainer, currentData.length, [
        { label: groups[0], count: group0Data.length, color: '#11b981' },
        { label: groups[1], count: group1Data.length, color: '#f59e0b' }
    ]);

    displayInterpretation(testResults, groupVar, 'independent');
    displayVisualization(testResults, 'independent');
    document.getElementById('results-section').style.display = 'block';
}

function runPairedTTest() {
    const preVar = document.getElementById('pre-var').value;
    const postVar = document.getElementById('post-var').value;

    if (!preVar || !postVar) {
        alert('観測変数と測定変数を選択してください');
        return;
    }
    if (preVar === postVar) {
        alert('異なる変数を選択してください');
        return;
    }
    displaySummaryStatistics([preVar, postVar]);
    const pairs = currentData
        .map(row => ({ pre: row[preVar], post: row[postVar] }))
        .filter(p => p.pre != null && !isNaN(p.pre) && p.post != null && !isNaN(p.post));
    if (pairs.length < 2) {
        alert('有効なペアデータが不足しています（最低2ペア必要）');
        return;
    }
    const preValues = pairs.map(p => p.pre);
    const postValues = pairs.map(p => p.post);
    const n = preValues.length;
    const mean1 = jStat.mean(preValues);
    const mean2 = jStat.mean(postValues);
    const std1 = jStat.stdev(preValues, true);
    const std2 = jStat.stdev(postValues, true);
    const diff = preValues.map((val, i) => val - postValues[i]);
    const diffMean = jStat.mean(diff);
    const diffStd = jStat.stdev(diff, true);
    const se = diffStd / Math.sqrt(n);
    const t_stat = diffMean / se;
    const df = n - 1;
    const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
    const cohens_d = Math.abs(diffMean / diffStd);
    let significance;
    if (p_value < 0.01) significance = '**';
    else if (p_value < 0.05) significance = '*';
    else if (p_value < 0.1) significance = '†';
    else significance = 'n.s.';
    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応あり）
            </h4>
            <div class="table-container" style="overflow-x: auto;">
                <table class="table">
                    <thead style="background: #f8f9fa;">
                        <tr>
                            <th style="font-weight: bold; color: #495057;">変数ペア</th>
                            <th>観測値M</th>
                            <th>観測値S.D</th>
                            <th>測定値M</th>
                            <th>測定値S.D</th>
                            <th>df</th>
                            <th>t</th>
                            <th>p</th>
                            <th>sign</th>
                            <th>d</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold; color: #1e90ff;">${preVar} → ${postVar}</td>
                            <td>${mean1.toFixed(2)}</td>
                            <td>${std1.toFixed(2)}</td>
                            <td>${mean2.toFixed(2)}</td>
                            <td>${std2.toFixed(2)}</td>
                            <td>${df.toFixed(2)}</td>
                            <td>${t_stat.toFixed(2)}</td>
                            <td>${p_value.toFixed(2)}</td>
                            <td><strong>${significance}</strong></td>
                            <td>${cohens_d.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;">
                <strong>sign</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1†
            </p>
        </div>
    renderSampleSizeInfo(resultsContainer, n);
    `;
    const testResults = [{
        varName: `${preVar} → ${postVar}`,
        groups: [preVar, postVar],
        mean1, mean2, std1, std2, n1: n, n2: n,
        t_stat, p_value, cohens_d, significance,
        group0Values: preValues, group1Values: postValues
    }];
    displayInterpretation(testResults, null, 'paired');
    displayVisualization(testResults, 'paired');
    document.getElementById('results-section').style.display = 'block';
}

function displayInterpretation(testResults, groupVar, testType) {
    const container = document.getElementById('interpretation-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> 解釈の補助
            </h4>
            <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
        </div>
    `;
    const contentContainer = document.getElementById('interpretation-content');
    let interpretationHtml = '';
    testResults.forEach(result => {
        const comparison = result.mean1 > result.mean2 ? '＞' : '＜';
        let significanceText;
        if (result.significance === '**' || result.significance === '*') significanceText = '有意な差が生まれる';
        else if (result.significance === '†') significanceText = '有意な差が生まれる傾向にある';
        else significanceText = '有意な差が生まれない';
        let description = `<p style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #1e90ff; border-radius: 4px;">`;
        if (testType === 'independent') {
            description += `<strong style="color: #1e90ff;">${groupVar}</strong>によって、<strong>${result.varName}</strong>には${significanceText}`;
            description += `（${result.groups[0]} ${comparison} ${result.groups[1]}）`;
        } else {
            description += `<strong style="color: #1e90ff;">${result.varName}</strong>には${significanceText}`;
            description += `（観測値 ${comparison} 測定値）`;
        }
        description += ` <span style="color: #6b7280;">(p= ${result.p_value.toFixed(2)})</span>`;
        description += '</p>';
        interpretationHtml += description;
    });
    contentContainer.innerHTML = interpretationHtml;
}

function displayVisualization(testResults, testType) {
    const container = document.getElementById('visualization-section');
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-chart-bar"></i> 可視化
            </h4>
            <div id="visualization-plots"></div>
        </div>
    `;
    const plotsContainer = document.getElementById('visualization-plots');
    let plotsHtml = '';
    testResults.forEach((result, index) => {
        const plotId = `ttest-plot-${index}`;
        plotsHtml += `
            <div style="margin-bottom: 2rem;">
                <div id="${plotId}" class="plot-container"></div>
                <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem; text-align: center;">
                    【${result.groups[0]}】 平均値 (S.D): ${result.mean1.toFixed(2)} (${result.std1.toFixed(2)}),
                    【${result.groups[1]}】 平均値 (S.D): ${result.mean2.toFixed(2)} (${result.std2.toFixed(2)}),
                    【危険率】p値: ${result.p_value.toFixed(3)}, 【効果量】d値: ${result.cohens_d.toFixed(2)}
                </p>
            </div>
        `;
    });
    plotsContainer.innerHTML = plotsHtml;
    testResults.forEach((result, index) => {
        const plotId = `ttest-plot-${index}`;
        const se1 = result.std1 / Math.sqrt(result.n1);
        const se2 = result.std2 / Math.sqrt(result.n2);
        const trace = {
            x: result.groups,
            y: [result.mean1, result.mean2],
            error_y: { type: 'data', array: [se1, se2], visible: true },
            type: 'bar', marker: { color: 'rgba(30, 144, 255, 0.7)' }
        };
        const annotations = [];
        const shapes = [];
        // Always show bracket
        const yMax = Math.max(result.mean1 + se1, result.mean2 + se2);
        const yRange = yMax * 0.15;
        const bracketY = yMax + yRange * 0.5;
        const annotationY = bracketY + yRange * 0.3;

        let significanceText;
        if (result.p_value < 0.01) significanceText = 'p < 0.01 **';
        else if (result.p_value < 0.05) significanceText = 'p < 0.05 *';
        else if (result.p_value < 0.1) significanceText = 'p < 0.1 †';
        else significanceText = 'n.s.';

        shapes.push({ type: 'line', x0: 0, y0: bracketY, x1: 1, y1: bracketY, line: { color: 'black', width: 2 } });
        shapes.push({ type: 'line', x0: 0, y0: yMax + yRange * 0.3, x1: 0, y1: bracketY, line: { color: 'black', width: 2 } });
        shapes.push({ type: 'line', x0: 1, y0: yMax + yRange * 0.3, x1: 1, y1: bracketY, line: { color: 'black', width: 2 } });
        annotations.push({ x: 0.5, y: annotationY, text: significanceText, showarrow: false, font: { size: 14, color: 'black', weight: 'bold' } });
        const layout = {
            title: testType === 'paired' ? `平均値の比較：${result.varName}` : `平均値の比較：${result.varName} by グループ`,
            xaxis: { title: '' }, yaxis: { title: '値' }, showlegend: false, annotations: annotations, shapes: shapes
        };
        Plotly.newPlot(plotId, [trace], layout);
    });
}

function switchTestType(testType) {
    const independentControls = document.getElementById('independent-controls');
    const pairedControls = document.getElementById('paired-controls');
    if (testType === 'independent') {
        independentControls.style.display = 'block';
        pairedControls.style.display = 'none';
    } else {
        independentControls.style.display = 'none';
        pairedControls.style.display = 'block';
    }
    document.getElementById('results-section').style.display = 'none';
}

export function render(container, characteristics) {
    container.innerHTML = `
        <div class="ttest-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-vial"></i> t検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">検定タイプを選択して分析を実行します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> t検定とは？</strong>
                        <p>2つのグループ（群）の平均値に「統計的に意味のある差（有意差）」があるかどうかを調べる手法です。</p>
                        <img src="image/t検定.jpg" alt="t検定のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>新薬を投与したグループと投与していないグループで治癒期間に差があるか知りたい</li>
                        <li>新しい教育メソッドを実施したクラスと従来のクラスでテストの点数に差があるか知りたい</li>
                        <li>同じ人がダイエット前後で体重が変わったか知りたい（対応あり）</li>
                    </ul>
                    <h4>主な用語</h4>
                    <ul>
                        <li><strong>p値 (p-value):</strong> 偶然そのような差が生じる確率。「0.05 (5%)」より小さければ「有意差あり（偶然ではない）」と判断するのが一般的です。</li>
                        <li><strong>効果量 (Cohen's d):</strong> 差の大きさ（インパクト）を表す指標。サンプル数に依存せず、実質的な差の大きさを評価できます。</li>
                    </ul>
                </div>
            </div>

            <!-- データプレビューと要約統計量 -->
            <div id="ttest-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 検定タイプ選択 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem;">
                        <label style="flex: 1; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="test-type" value="independent" checked style="margin-right: 0.5rem;">
                            <strong>対応なしt検定</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">2つの独立したグループ間の平均値を比較</p>
                        </label>
                        <label style="flex: 1; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="test-type" value="paired" style="margin-right: 0.5rem;">
                            <strong>対応ありt検定</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">同じ対象の2つの測定値を比較（前後比較など）</p>
                        </label>
                    </div>
                </div>

                <!-- 対応なしt検定の設定 -->
                <div id="independent-controls" style="display: block;">
                    <div id="group-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="dep-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="independent-btn-container"></div>
                </div>

                <!-- 対応ありt検定の設定 -->
                <div id="paired-controls" style="display: none;">
                    <div id="pre-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="post-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="paired-btn-container"></div>
                </div>
            </div>

            <!-- 結果セクション -->
            <div id="results-section" style="display: none;">
                <div id="summary-stats-section"></div>
                <div id="test-results-section"></div>
                <div id="interpretation-section"></div>
                <div id="visualization-section"></div>
            </div>
        </div>
    `;

    renderDataOverview('#ttest-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    const { numericColumns, categoricalColumns } = characteristics;

    // グループ変数 (Single Select)
    createVariableSelector('group-var-container', categoricalColumns, 'group-var', {
        label: '<i class="fas fa-layer-group"></i> グループ変数（カテゴリ変数、2群）を選択:',
        multiple: false,
        placeholder: '選択してください...'
    });

    // 従属変数 (Multi Select with click-toggle)
    createVariableSelector('dep-var-container', numericColumns, 'dep-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数選択可）:',
        multiple: true
    });

    // 対応あり観測変数 (Single Select)
    createVariableSelector('pre-var-container', numericColumns, 'pre-var', {
        label: '<i class="fas fa-circle" style="color: #1e90ff;"></i> 観測変数を選択:',
        multiple: false
    });

    // 対応あり測定変数 (Single Select)
    createVariableSelector('post-var-container', numericColumns, 'post-var', {
        label: '<i class="fas fa-circle" style="color: #1e90ff;"></i> 測定変数を選択:',
        multiple: false
    });

    document.querySelectorAll('input[name="test-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
        });
    });

    createAnalysisButton('independent-btn-container', '対応なしt検定を実行', runIndependentTTest, { id: 'run-independent-btn' });
    createAnalysisButton('paired-btn-container', '対応ありt検定を実行', runPairedTTest, { id: 'run-paired-btn' });
}
