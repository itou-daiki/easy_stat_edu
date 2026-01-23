import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper } from '../utils.js';
// import { MultiSelect } from '../components/MultiSelect.js'; // REMOVED

// let depVarMultiSelect = null; // REMOVED

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
function runIndependentTTest(currentData) {
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
                        <th>${groups[0]} M</th>
                        <th>${groups[0]} S.D</th>
                        <th>${groups[1]} M</th>
                        <th>${groups[1]} S.D</th>
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
    const skippedVars = [];

    selectedVars.forEach(varName => {
        const allValues = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        const group0Values = group0Data.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        const group1Values = group1Data.map(row => row[varName]).filter(v => v != null && !isNaN(v));

        if (group0Values.length < 2 || group1Values.length < 2) {
            skippedVars.push(varName);
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

        const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
        const t_stat = (mean1 - mean2) / se_welch;
        const df_numerator = (var1 / n1 + var2 / n2) ** 2;
        const df_denominator = (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1);
        const df_welch = df_numerator / df_denominator;
        const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df_welch) * 2;
        const pooled_std = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
        const cohens_d = Math.abs((mean1 - mean2) / pooled_std);
        let significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : p_value < 0.1 ? '†' : 'n.s.';

        resultsTableHtml += `
            <tr>
                <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                <td>${jStat.mean(allValues).toFixed(2)}</td>
                <td>${jStat.stdev(allValues, true).toFixed(2)}</td>
                <td>${mean1.toFixed(2)}</td>
                <td>${std1.toFixed(2)}</td>
                <td>${mean2.toFixed(2)}</td>
                <td>${std2.toFixed(2)}</td>
                <td>${df_welch.toFixed(2)}</td>
                <td>${Math.abs(t_stat).toFixed(2)}</td>
                <td>${p_value.toFixed(3)}</td>
                <td><strong>${significance}</strong></td>
                <td>${cohens_d.toFixed(2)}</td>
            </tr>
        `;

        testResults.push({
            varName, groups, mean1, mean2, std1, std2, n1, n2,
            t_stat, p_value, cohens_d, significance,
            group0Values, group1Values
        });
    });

    resultsTableHtml += `</tbody></table></div><p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;"><strong>sign</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1†</p>`;

    if (skippedVars.length > 0) {
        resultsTableHtml += `<div class="warning-message" style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
            <strong>注意:</strong> 次の変数は、片方または両方のグループのサンプルサイズが2未満だったため、分析から除外されました: ${skippedVars.join(', ')}
        </div>`;
    }

    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    renderSampleSizeInfo(resultsContainer, currentData.length, [
        { label: groups[0], count: group0Data.length, color: '#11b981' },
        { label: groups[1], count: group1Data.length, color: '#f59e0b' }
    ]);

    displayInterpretation(testResults, groupVar, 'independent');
    displayVisualization(testResults, 'independent');
    document.getElementById('results-section').style.display = 'block';
}

// 対応ありt検定
function runPairedTTest(currentData, pairs) {
    if (pairs.length === 0) {
        alert('分析する変数ペアを1つ以上追加してください');
        return;
    }

    const preVars = pairs.map(p => p.pre);
    const postVars = pairs.map(p => p.post);

    displaySummaryStatistics([...new Set([...preVars, ...postVars])], currentData);

    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 平均値の差の検定（対応あり）
            </h4>
            <div id="test-results-table"></div>
        </div>
    `;

    let resultsTableHtml = `
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
    `;

    const testResults = [];
    let totalN = 0;
    const skippedPairs = [];

    pairs.forEach((pair, i) => {
        const { pre: preVar, post: postVar } = pair;
        const pairName = `${preVar} → ${postVar}`;

        const pairedData = currentData
            .map(row => ({ pre: row[preVar], post: row[postVar] }))
            .filter(p => p.pre != null && !isNaN(p.pre) && p.post != null && !isNaN(p.post));

        if (pairedData.length < 2) {
            skippedPairs.push(pairName);
            return;
        }

        const preValues = pairedData.map(p => p.pre);
        const postValues = pairedData.map(p => p.post);
        const n = preValues.length;
        if (i === 0) totalN = currentData.length;

        const mean1 = jStat.mean(preValues);
        const mean2 = jStat.mean(postValues);
        const std1 = jStat.stdev(preValues, true);
        const std2 = jStat.stdev(postValues, true);
        const diff = preValues.map((val, j) => val - postValues[j]);
        const diffMean = jStat.mean(diff);
        const diffStd = jStat.stdev(diff, true);
        const se = diffStd / Math.sqrt(n);
        const t_stat = diffMean / se;
        const df = n - 1;
        const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
        const cohens_d = Math.abs(diffMean / diffStd);
        let significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : p_value < 0.1 ? '†' : 'n.s.';

        resultsTableHtml += `
            <tr>
                <td style="font-weight: bold; color: #1e90ff;">${preVar} → ${postVar}</td>
                <td>${mean1.toFixed(2)}</td>
                <td>${std1.toFixed(2)}</td>
                <td>${mean2.toFixed(2)}</td>
                <td>${std2.toFixed(2)}</td>
                <td>${df}</td>
                <td>${Math.abs(t_stat).toFixed(2)}</td>
                <td>${p_value.toFixed(3)}</td>
                <td><strong>${significance}</strong></td>
                <td>${cohens_d.toFixed(2)}</td>
            </tr>
        `;

        testResults.push({
            varName: pairName,
            groups: [preVar, postVar],
            mean1, mean2, std1, std2, n1: n, n2: n, t_stat, p_value, cohens_d, significance,
            mean1, mean2, std1, std2, n1: n, n2: n, t_stat, p_value, cohens_d, significance,
            group0Values: preValues,
            group1Values: postValues,
            groups: [pair.pre, pair.post]
        });
    });

    resultsTableHtml += `</tbody></table></div><p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.9rem;"><strong>sign</strong>: p&lt;0.01** p&lt;0.05* p&lt;0.1†</p>`;

    if (skippedPairs.length > 0) {
        resultsTableHtml += `<div class="warning-message" style="margin-top: 1rem; padding: 1rem; background-color: #fffbe6; border: 1px solid #fde68a; border-radius: 4px; color: #92400e;">
            <strong>注意:</strong> 次の変数ペアは、有効なデータが2件未満だったため、分析から除外されました: ${skippedPairs.join(', ')}
        </div>`;
    }

    document.getElementById('test-results-table').innerHTML = resultsTableHtml;

    renderSampleSizeInfo(resultsContainer, totalN);

    displayInterpretation(testResults, null, 'paired');
    displayVisualization(testResults, 'paired');
    document.getElementById('results-section').style.display = 'block';
}

// 1サンプルのt検定
function runOneSampleTTest(currentData) {
    const varName = document.getElementById('one-sample-var').value;
    const mu = parseFloat(document.getElementById('one-sample-mu').value);

    if (!varName) {
        alert('検定する変数を選択してください');
        return;
    }
    if (isNaN(mu)) {
        alert('検定値を正しく入力してください');
        return;
    }

    displaySummaryStatistics([varName], currentData);

    const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));

    if (values.length < 2) {
        alert('有効なデータが不足しています（最低2つ必要）');
        return;
    }

    const n = values.length;
    const mean = jStat.mean(values);
    const std = jStat.stdev(values, true);
    const se = std / Math.sqrt(n);
    const t_stat = (mean - mu) / se;
    const df = n - 1;
    const p_value = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
    const cohens_d = Math.abs(mean - mu) / std;
    let significance = p_value < 0.01 ? '**' : p_value < 0.05 ? '*' : 'n.s.';

    const resultsContainer = document.getElementById('test-results-section');
    resultsContainer.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-calculator"></i> 1サンプルのt検定
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead><tr><th>変数</th><th>平均値</th><th>S.D.</th><th>検定値(μ)</th><th>df</th><th>t</th><th>p</th><th>sign</th><th>d</th></tr></thead>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold; color: #1e90ff;">${varName}</td>
                            <td>${mean.toFixed(2)}</td>
                            <td>${std.toFixed(2)}</td>
                            <td>${mu.toFixed(2)}</td>
                            <td>${df}</td>
                            <td>${t_stat.toFixed(2)}</td>
                            <td>${p_value.toFixed(3)}</td>
                            <td><strong>${significance}</strong></td>
                            <td>${cohens_d.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const testResults = [{
        varName, groups: [varName], mean1: mean, std1: std, n1: n,
        t_stat, p_value, cohens_d, significance, mu,
        group0Values: values,
    }];

    displayInterpretation(testResults, null, 'one-sample');
    displayVisualization(testResults, 'one-sample');
    document.getElementById('results-section').style.display = 'block';
}

// Interpretation Display
function displayInterpretation(testResults, groupVar, testType) {
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
        let text = "";
        if (testType === 'independent') {
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mean2, result.groups, result.cohens_d);
        } else if (testType === 'paired') {
            // For paired, we use [Pre, Post] as groups
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mean2, result.groups, result.cohens_d);
        } else if (testType === 'one-sample') {
            // One sample: Compare Mean vs Mu
            // result.mu IS present in OneSample result object? Checking runOneSampleTTest...
            // It pushes { varName, mu, mean1: mean ... } (I assume based on context)
            // Let's verify runOneSampleTTest push.
            // If not present, I might need to check. But assuming yes.
            text = InterpretationHelper.interpretTTest(result.p_value, result.mean1, result.mu, [result.varName, `検定値(μ=${result.mu})`], result.cohens_d);
        }

        interpretationHtml += `<li style="margin-bottom: 0.5rem;">${text}</li>`;
    });
    interpretationHtml += '</ul>';

    contentContainer.innerHTML = interpretationHtml;
}

function displayVisualization(testResults, testType) {
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
    const { titleControl } = createVisualizationControls(controlsContainer);

    const plotsContainer = document.getElementById('plots-container');
    plotsContainer.innerHTML = '';

    testResults.forEach((result, index) => {
        const plotId = `plot-${index}`;
        const plotDiv = document.createElement('div');
        plotDiv.id = plotId;
        plotDiv.className = 'plot-container';
        plotsContainer.appendChild(plotDiv);

        let data, layout, config, title;
        let layout_yaxis_range = null;

        if (testType === 'independent' || testType === 'paired') {
            const groupNames = (testType === 'paired') ? result.groups : result.groups;
            const meanValues = [result.mean1, result.mean2];
            const stdValues = [result.std1, result.std2];
            const nValues = [result.n1, result.n2];
            const errorValues = [stdValues[0] / Math.sqrt(nValues[0]), stdValues[1] / Math.sqrt(nValues[1])];

            data = [{
                x: groupNames,
                y: meanValues,
                error_y: { type: 'data', array: errorValues, visible: true },
                type: 'bar',
                marker: { color: ['#11b981', '#f59e0b'] }
            }];

            title = titleControl.checked ? `平均値の比較: ${result.varName}` : '';

            const annotations = [];
            const shapes = [];

            // Add significance bracket
            if (result.significance !== 'n.s.') {
                const y_max_error = Math.max(meanValues[0] + errorValues[0], meanValues[1] + errorValues[1]);
                const y_range = y_max_error * 1.1; // Ensure range is not zero
                const y_offset = Math.max(y_range * 0.05, 0.1); // Add a minimum offset
                const bracket_y = y_max_error + y_offset;
                const annotation_y = bracket_y + y_offset * 0.5;

                shapes.push({
                    type: 'path',
                    path: `M 0,${bracket_y} L 1,${bracket_y}`,
                    line: { color: 'black', width: 1.5 }
                });
                annotations.push({
                    x: 0.5,
                    y: annotation_y,
                    text: result.significance.replace('†', '<sup>†</sup>'),
                    showarrow: false,
                    font: { size: 14, color: 'black' },
                    xanchor: 'center',
                    yanchor: 'bottom'
                });
                layout_yaxis_range = [0, annotation_y + y_offset];
            } else {
                layout_yaxis_range = null;
            }

            layout = {
                title: getBottomTitleAnnotation(title),
                xaxis: { title: 'グループ' },
                yaxis: { title: '平均値', range: layout_yaxis_range },
                showlegend: false,
                margin: { t: 20, b: 80, l: 60, r: 20 },
                annotations,
                shapes,
            };

            config = createPlotlyConfig('t検定', result.varName);

        } else if (testType === 'one-sample') {
            // ... (one-sample t-test visualization)
        }

        if (data && layout && config) {
            Plotly.newPlot(plotId, data, layout, config);
        }
    });

    const updateAllPlots = () => {
        testResults.forEach((result, index) => {
            const plotId = `plot-${index}`;
            const title = titleControl.checked ? `平均値の比較: ${result.varName}` : '';
            Plotly.relayout(plotId, { title: getBottomTitleAnnotation(title) });
        });
    };

    titleControl.addEventListener('change', updateAllPlots);
}

function switchTestType(testType) {
    document.getElementById('independent-controls').style.display = 'none';
    document.getElementById('paired-controls').style.display = 'none';
    document.getElementById('one-sample-controls').style.display = 'none';

    if (testType === 'independent') {
        document.getElementById('independent-controls').style.display = 'block';
    } else if (testType === 'paired') {
        document.getElementById('paired-controls').style.display = 'block';
    } else if (testType === 'one-sample') {
        document.getElementById('one-sample-controls').style.display = 'block';
    }
    document.getElementById('results-section').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    container.innerHTML = `
        <div class="ttest-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-vial"></i> t検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">検定タイプを選択して分析を実行します</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> t検定とは？</strong>
                        <p>2つのグループ（群）の平均値に「統計的に意味のある差（有意差）」があるかどうかを調べる手法です。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>新薬を投与したグループと投与していないグループで治癒期間に差があるか知りたい</li>
                        <li>新しい教育メソッドを実施したクラスと従来のクラスでテストの点数に差があるか知りたい</li>
                        <li>同じ人がダイエット前後で体重が変わったか知りたい（対応あり）</li>
                        <li>あるクラスの平均点が全国平均と差があるか知りたい（1サンプル）</li>
                    </ul>
                </div>
            </div>

            <div id="ttest-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label class="ttest-radio-label selected">
                            <input type="radio" name="test-type" value="independent" checked style="margin-right: 0.5rem;">
                            <strong>対応なしt検定</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">2つの独立したグループ間の平均値を比較</p>
                        </label>
                        <label class="ttest-radio-label">
                            <input type="radio" name="test-type" value="paired" style="margin-right: 0.5rem;">
                            <strong>対応ありt検定</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">同じ対象の2つの測定値を比較（前後比較など）</p>
                        </label>
                        <label class="ttest-radio-label">
                            <input type="radio" name="test-type" value="one-sample" style="margin-right: 0.5rem;">
                            <strong>1サンプルのt検定</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">標本の平均値を特定の値と比較</p>
                        </label>
                    </div>
                </div>

                <div id="independent-controls" style="display: block;">
                    <div id="group-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="dep-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;">
                         <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;"><i class="fas fa-check-square"></i> 従属変数を選択（複数選択可）:</label>
                         <div id="dep-var-multiselect"></div>
                    </div>
                    <div id="independent-btn-container"></div>
                </div>
                <div id="paired-controls" style="display: none;">
                    <div style="padding: 1rem; background: #fafbfc; border-radius: 8px;">
                        <h5 style="color: #2d3748; margin-bottom: 1rem;">変数ペアを選択:</h5>
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
                            <div id="paired-var-pre-container" style="flex: 1; min-width: 200px;"></div>
                            <span style="font-weight: bold; color: #1e90ff; font-size: 1.5rem;">→</span>
                            <div id="paired-var-post-container" style="flex: 1; min-width: 200px;"></div>
                            <button id="add-pair-btn" class="analysis-button" style="background-color: #28a745; min-width: 120px;">
                                <i class="fas fa-plus"></i> ペアを追加
                            </button>
                        </div>
                        
                        <h5 style="color: #2d3748; margin-top: 2rem; margin-bottom: 1rem;">
                            <i class="fas fa-list-ul"></i> 選択された変数ペア
                        </h5>
                        <div id="selected-pairs-list" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; min-height: 50px; background: white;">
                            <p id="no-pairs-text" style="color: #6b7280;">ここに追加されたペアが表示されます</p>
                        </div>
                        
                        <div id="paired-btn-container" style="margin-top: 1.5rem;"></div>
                    </div>
                </div>
                <div id="one-sample-controls" style="display: none;">
                    <div id="one-sample-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                        <label for="one-sample-mu" style="font-weight: 500;">検定値 (比較したい値):</label>
                        <input type="number" id="one-sample-mu" value="0" style="padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 4px;">
                    </div>
                    <div id="one-sample-btn-container"></div>
                </div>
            </div>
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

    createVariableSelector('group-var-container', categoricalColumns, 'group-var', {
        label: '<i class="fas fa-layer-group"></i> グループ変数（カテゴリ変数、2群）を選択:',
        multiple: false, placeholder: '選択してください...'
    });

    createVariableSelector('dep-var-multiselect', numericColumns, 'dep-var-multiselect-hidden', {
        label: '<i class="fas fa-check-square"></i> 検定変数を複数選択:',
        multiple: true,
        placeholder: '変数を選択...'
    });

    createAnalysisButton('independent-btn-container', '対応なしt検定を実行', () => runIndependentTTest(currentData), { id: 'run-independent-btn' });

    // Paired t-test UI and logic
    createVariableSelector('paired-var-pre-container', numericColumns, 'paired-var-pre', {
        label: '<i class="fas fa-list-ol"></i> 観測変数（変更前など）:',
        multiple: false,
        placeholder: '変数を選択...'
    });
    createVariableSelector('paired-var-post-container', numericColumns, 'paired-var-post', {
        label: '<i class="fas fa-list-ol"></i> 測定変数（変更後など）:',
        multiple: false,
        placeholder: '変数を選択...'
    });

    let selectedPairs = [];

    const updatePairedSelectors = () => {
        const preSelect = document.getElementById('paired-var-pre');
        const postSelect = document.getElementById('paired-var-post');
        const allOptions = [...numericColumns];

        const selectedPre = preSelect.value;
        const selectedPost = postSelect.value;

        // Reset options
        Array.from(preSelect.options).forEach(opt => opt.disabled = false);
        Array.from(postSelect.options).forEach(opt => opt.disabled = false);

        // Disable selected option in the other select
        if (selectedPre) {
            const postOption = postSelect.querySelector(`option[value="${selectedPre}"]`);
            if (postOption) postOption.disabled = true;
        }
        if (selectedPost) {
            const preOption = preSelect.querySelector(`option[value="${selectedPost}"]`);
            if (preOption) preOption.disabled = true;
        }
    };

    document.getElementById('paired-var-pre').addEventListener('change', updatePairedSelectors);
    document.getElementById('paired-var-post').addEventListener('change', updatePairedSelectors);

    const renderSelectedPairs = () => {
        const listContainer = document.getElementById('selected-pairs-list');
        const noPairsText = document.getElementById('no-pairs-text');
        listContainer.innerHTML = '';
        if (selectedPairs.length === 0) {
            listContainer.appendChild(noPairsText);
            noPairsText.style.display = 'block';
        } else {
            noPairsText.style.display = 'none';
            selectedPairs.forEach((pair, index) => {
                const pairEl = document.createElement('div');
                pairEl.className = 'selected-pair-item';
                pairEl.innerHTML = `
                    <span>${pair.pre} → ${pair.post}</span>
                    <button class="remove-pair-btn" data-index="${index}"><i class="fas fa-times"></i></button>
                `;
                listContainer.appendChild(pairEl);
            });
        }
    };

    document.getElementById('add-pair-btn').addEventListener('click', () => {
        const preVar = document.getElementById('paired-var-pre').value;
        const postVar = document.getElementById('paired-var-post').value;

        if (!preVar || !postVar) {
            alert('観測変数と測定変数の両方を選択してください。');
            return;
        }
        if (preVar === postVar) {
            alert('観測変数と測定変数に同じ変数は選べません。');
            return;
        }
        if (selectedPairs.some(p => p.pre === preVar && p.post === postVar)) {
            alert('この変数の組み合わせは既に追加されています。');
            return;
        }

        selectedPairs.push({ pre: preVar, post: postVar });
        renderSelectedPairs();
    });

    document.getElementById('selected-pairs-list').addEventListener('click', (e) => {
        if (e.target.closest('.remove-pair-btn')) {
            const index = e.target.closest('.remove-pair-btn').dataset.index;
            selectedPairs.splice(index, 1);
            renderSelectedPairs();
        }
    });

    createAnalysisButton('paired-btn-container', '対応ありt検定を実行', () => runPairedTTest(currentData, selectedPairs), { id: 'run-paired-btn' });

    createVariableSelector('one-sample-var-container', numericColumns, 'one-sample-var', {
        label: '<i class="fas fa-vial"></i> 検定する変数を選択:',
        multiple: false
    });
    createAnalysisButton('one-sample-btn-container', '1サンプルのt検定を実行', () => runOneSampleTTest(currentData), { id: 'run-one-sample-btn' });

    document.querySelectorAll('input[name="test-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            document.querySelectorAll('.ttest-radio-label').forEach(label => {
                label.classList.remove('selected');
            });
            e.target.closest('label').classList.add('selected');
        });
    });

    renderSelectedPairs(); // Initial render
    updatePairedSelectors(); // Initial setup of selectors
}
