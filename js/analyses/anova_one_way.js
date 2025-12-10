import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, getEffectSizeInterpretation, createVariableSelector, renderSampleSizeInfo, createAnalysisButton } from '../utils.js';

// Pairwise t-test helper
function performPostHocTests(groups, groupData) {
    const pairs = [];
    const numGroups = groups.length;
    // Number of comparisons for Bonferroni
    const numComparisons = (numGroups * (numGroups - 1)) / 2;

    for (let i = 0; i < numGroups; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            const g1 = groups[i];
            const g2 = groups[j];
            const d1 = groupData[g1];
            const d2 = groupData[g2];

            if (d1.length < 2 || d2.length < 2) continue;

            const n1 = d1.length;
            const n2 = d2.length;
            const mean1 = jStat.mean(d1);
            const mean2 = jStat.mean(d2);
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);
            const var1 = std1 * std1;
            const var2 = std2 * std2;

            // Welch's t-test
            const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
            const t_stat = (mean1 - mean2) / se_welch;

            // Welch-Satterthwaite df
            const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
            const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
            const df = df_num / df_den;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

            // Bonferroni correction
            let p_adj = Math.min(1, p_raw * numComparisons);

            if (p_adj < 0.1) { // Keep if at least trendy
                pairs.push({
                    g1, g2,
                    p: p_adj,
                    mean1, mean2,
                    std1, std2,
                    n1, n2
                });
            }
        }
    }
    return pairs;
}

function runOneWayANOVA() {
    const factorVar = document.getElementById('factor-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factorVar) {
        alert('要因（グループ変数）を選択してください');
        return;
    }
    if (dependentVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null);
    if (groups.length < 3) {
        alert(`一要因分散分析には3群以上必要です（現在: ${groups.length}群）`);
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    dependentVars.forEach(depVar => {
        // データ抽出
        const groupData = {};
        let totalN = 0;
        groups.forEach(g => {
            groupData[g] = currentData
                .filter(row => row[factorVar] === g)
                .map(row => row[depVar])
                .filter(v => v != null && !isNaN(v));
            totalN += groupData[g].length;
        });

        // ANOVA計算
        // 全体平均
        const allValues = currentData.map(r => r[depVar]).filter(v => v != null && !isNaN(v));
        const grandMean = jStat.mean(allValues);

        // 平方和の計算
        let ssBetween = 0;
        let ssWithin = 0;
        let dfBetween = groups.length - 1;
        let dfWithin = totalN - groups.length;

        groups.forEach(g => {
            const vals = groupData[g];
            const n = vals.length;
            const mean = jStat.mean(vals);

            ssBetween += n * Math.pow(mean - grandMean, 2);
            ssWithin += vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
        });

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fValue = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);

        // 効果量 (eta squared)
        const etaSquared = ssBetween / (ssBetween + ssWithin);

        // 結果表示 HTML構築
        const sectionId = `anova-${depVar}`;

        let html = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                    変数: ${depVar}
                </h4>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>変動要因</th>
                                <th>平方和 (SS)</th>
                                <th>自由度 (df)</th>
                                <th>平均平方 (MS)</th>
                                <th>F値</th>
                                <th>p値</th>
                                <th>効果量 (η²)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>要因間 (Between)</td>
                                <td>${ssBetween.toFixed(2)}</td>
                                <td>${dfBetween}</td>
                                <td>${msBetween.toFixed(2)}</td>
                                <td>${fValue.toFixed(2)}</td>
                                <td style="${pValue < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pValue.toFixed(3)} ${pValue < 0.01 ? '**' : (pValue < 0.05 ? '*' : '')}</td>
                                <td>${etaSquared.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>要因内 (Within)</td>
                                <td>${ssWithin.toFixed(2)}</td>
                                <td>${dfWithin}</td>
                                <td>${msWithin.toFixed(2)}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td>合計 (Total)</td>
                                <td>${(ssBetween + ssWithin).toFixed(2)}</td>
                                <td>${dfBetween + dfWithin}</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p style="color: #666; font-size: 0.9rem; margin-top: 0.5rem;">
                    注: p < 0.05 で有意、η² は0.01(小), 0.06(中), 0.14(大)が目安
                </p>

                <div id="plot-${sectionId}" style="margin-top: 1.5rem;"></div>
            </div>
        `;

        outputContainer.innerHTML += html;

        // サンプルサイズ (renderSampleSizeInfo will append to result container div inside the loop issue - wait, outputContainer is cleared at start)
        // Need to target specific section. The loop creates a `sectionId` div? No, just dumps html.
        // Let's modify the html structure. `html` is a huge block.
        // I should probably inject it AFTER the table inside the white box or create a new box.
        // The current loop appends `html` string to `outputContainer`. 
        // I should append sample size info to the specific div created for this variable.
        // But `renderSampleSizeInfo` appends to a DOM element.
        // Solution: Create a placeholder div in `html`, then after `outputContainer.innerHTML += html`, find that div and render sample size.

        // Wait, using `innerHTML +=` destroys event listeners and references.
        // Better approach:

        // 1. Create a wrapper div for this variable's results
        const varResultDiv = document.createElement('div');
        varResultDiv.className = 'anova-result-block';
        varResultDiv.innerHTML = html;
        outputContainer.appendChild(varResultDiv);

        // 2. Render sample size inside this wrapper
        const sampleSizeContainer = document.createElement('div');
        varResultDiv.firstElementChild.appendChild(sampleSizeContainer); // Append to the white box (firstElementChild of varResultDiv which is the white box in `html`)

        // Generate group data for sample size
        const groupSampleSizes = groups.map((g, i) => {
            // Generate colors cyclically or randomly if many groups
            const colors = ['#11b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
            return {
                label: g,
                count: groupData[g].length,
                color: colors[i % colors.length]
            };
        });

        renderSampleSizeInfo(sampleSizeContainer, totalN, groupSampleSizes);

        // 箱ひげ図の描画 (Plotly)
        // 非同期でないとDOM描画後にplotできないが、innerHTML += だと都度再描画される
        // ここではループ内でHTML文字列を連結してから一括挿入の方が良いが、
        // 簡易実装として、setTimeoutで描画を遅らせる
    });

    // Plotly描画 (ループ終了後に実行)
    setTimeout(() => {
        dependentVars.forEach(depVar => {
            const sectionId = `anova-${depVar}`;
            const plotDiv = document.getElementById(`plot-${sectionId}`);
            if (plotDiv) {
                // Determine group data for this variable again (or could have stored it)
                const currentGroupData = {};
                groups.forEach(g => {
                    currentGroupData[g] = currentData
                        .filter(row => row[factorVar] === g)
                        .map(row => row[depVar])
                        .filter(v => v != null && !isNaN(v));
                });

                // Calculate significant pairs
                const sigPairs = performPostHocTests(groups, currentGroupData);

                // --- Calculate Layout for Brackets ---
                // We need to know the Y range to place brackets above the plot.
                // Find global max y (+ buffer for box plot whiskers typically 1.5IQR, but max data point is safer proxy for simple view)
                let globalMaxY = -Infinity;
                groups.forEach(g => {
                    const maxVal = jStat.max(currentGroupData[g]);
                    if (maxVal > globalMaxY) globalMaxY = maxVal;
                });

                // Define bracket step size
                const yRange = globalMaxY - jStat.min(currentData.map(r => r[depVar]).filter(v => typeof v === 'number')); // rough range
                const step = (yRange || 1) * 0.1; // 10% of range as step
                let currentLevelY = globalMaxY + step * 0.5;

                const shapes = [];
                const annotations = [];

                // Sort pairs by distance (shorter brackets first usually looks better or vice versa? 
                // overlapping logic matters more. Let's just iterate and stack.)
                // Actually, standard is to put wider brackets higher up.
                // Let's sort comparison pairs by index distance in `groups` array to roughly approximate 'width'.
                sigPairs.sort((a, b) => {
                    const distA = Math.abs(groups.indexOf(a.g1) - groups.indexOf(a.g2));
                    const distB = Math.abs(groups.indexOf(b.g1) - groups.indexOf(b.g2));
                    return distA - distB; // Shorter first? Or verify overlap logic.
                });

                // Simple overlap detection: store occupied intervals at each level
                // levels[levelIndex] = [{start, end}, ...]
                const levels = [];

                sigPairs.forEach(pair => {
                    if (pair.p >= 0.1) return; // Ignore non-significant for plot

                    const idx1 = groups.indexOf(pair.g1);
                    const idx2 = groups.indexOf(pair.g2);
                    const start = Math.min(idx1, idx2);
                    const end = Math.max(idx1, idx2);

                    // Find first level where this interval [start, end] doesn't overlap
                    let levelIndex = 0;
                    while (true) {
                        if (!levels[levelIndex]) {
                            levels[levelIndex] = [];
                            break;
                        }
                        // Check overlap with existing brackets at this level
                        const overlap = levels[levelIndex].some(interval => {
                            // Interval overlap: (StartA < EndB) and (EndA > StartB)
                            // We add a tiny buffer to avoid touching
                            return (start < interval.end + 0.1) && (end > interval.start - 0.1);
                        });
                        if (!overlap) {
                            break;
                        }
                        levelIndex++;
                    }

                    // Assign to this level
                    levels[levelIndex].push({ start, end });

                    // Add bracket shape
                    // y-position for this level
                    const bracketY = currentLevelY + (levelIndex * step);
                    const textY = bracketY + step * 0.2;

                    // Significance symbol
                    let text = 'n.s.';
                    if (pair.p < 0.01) text = '**';
                    else if (pair.p < 0.05) text = '*';
                    else if (pair.p < 0.1) text = '†';

                    // Color
                    const color = 'rgba(0,0,0,0.8)';

                    // Draw bracket (line down, line across, line down)
                    // x coordinates are group indices.

                    shapes.push({
                        type: 'line',
                        x0: pair.g1, y0: bracketY - step * 0.2,
                        x1: pair.g1, y1: bracketY,
                        line: { color: color, width: 1.5 }
                    });
                    shapes.push({
                        type: 'line',
                        x0: pair.g1, y0: bracketY,
                        x1: pair.g2, y1: bracketY,
                        line: { color: color, width: 1.5 }
                    });
                    shapes.push({
                        type: 'line',
                        x0: pair.g2, y0: bracketY,
                        x1: pair.g2, y1: bracketY - step * 0.2, // Small tick down
                        line: { color: color, width: 1.5 }
                    });

                    annotations.push({
                        x: (idx1 + idx2) / 2, // Midpoint based on index? No, usually x matches category name in Plotly categorical axes if x is data.
                        // Wait, for categorical x-axis, x coordinates can be the category names directly?
                        // Plotly places categories at integer indices 0, 1, 2... internally but we should use the string values for x0/x1?
                        // Yes, for categorical axes, x0/x1 can be category names.
                        // BUT, to calculate midpoint for annotation, we can't easily average strings.
                        // We might need to supply index if we used 'array' mapping but simple box plot uses names.
                        // WORKAROUND: Plotly usually maps categories to 0,1,2... 
                        // Let's try specifying x as indices? No, mixed types might fail.
                        // Let's try assuming x is category name.
                        // Midpoint for annotation: we can't set x = (name1 + name2)/2.
                        // We likely need to reference x by the category name, but for the text annotation, how to center it?
                        // Maybe simpler to just not support complex midpoint logic and hope 'x' works?
                        // Actually, looking closer at Plotly docs, for categorical axes, you can often use numeric indices for shapes if you reference the underlying scale, but it's tricky.
                        // Safer approach: Calculate x position relative to the axis range if possible, OR
                        // Just use the category names for lines, but for the TEXT annotation, we need one specific x.
                        // Ideally we pick one of the categories and offset? No.
                        // Let's try using the category name of the one on the "left" + offset? Hard to know order.
                        // OK, let's rely on the order in `groups` array.
                        // If we use `groups` array order, we know indices.
                        // Can we just map "Group A" to index 0?
                        // If we provide specific x values to traces, we can control it.
                        // Let's render the detailed trace as we do below using `groups.map`.
                    });

                    // Re-do annotation: using paper coordinates or trying to interpolate?
                    // Actually, let's keep it simple.
                    // If we use numeric indices for x-axis, we have full control.
                    // Instead of automatic categorical mapping, let's force x to be 0, 1, 2... and provide tickvals/ticktext.

                });

                const traces = groups.map((g, i) => ({
                    y: currentGroupData[g],
                    type: 'box',
                    name: g,
                    boxpoints: 'outliers',
                    marker: { color: '#1e90ff' },
                    // Force x position to be integer index to allow easy bracket drawing
                    x: currentGroupData[g].map(() => i),
                    showlegend: false
                }));

                // Re-generate shapes with numeric x
                const shapesFinal = [];
                const annotationsFinal = [];

                // Recalculate loop with numeric indices
                levels.forEach((lvl, lvlIdx) => {
                    // level info is sparse array structure from before?
                    // Wait, `levels` array contains arrays of intervals. I need to iterate the pairs again or store the shapes earlier.
                });
                // Let's just re-run the logic cleanly now that we decided on numeric X.

                const finalLevels = [];

                sigPairs.forEach(pair => {
                    const idx1 = groups.indexOf(pair.g1);
                    const idx2 = groups.indexOf(pair.g2);
                    const start = Math.min(idx1, idx2);
                    const end = Math.max(idx1, idx2);

                    let levelIndex = 0;
                    while (true) {
                        if (!finalLevels[levelIndex]) finalLevels[levelIndex] = [];
                        const overlap = finalLevels[levelIndex].some(interval => (start < interval.end + 0.1) && (end > interval.start - 0.1));
                        if (!overlap) break;
                        levelIndex++;
                    }
                    finalLevels[levelIndex].push({ start, end });

                    const bracketY = currentLevelY + (levelIndex * step);
                    let text = 'n.s.';
                    if (pair.p < 0.01) text = '**';
                    else if (pair.p < 0.05) text = '*';

                    // Lines
                    shapesFinal.push({
                        type: 'line', x0: idx1, y0: bracketY - step * 0.1, x1: idx1, y1: bracketY,
                        line: { color: 'black', width: 1 }
                    });
                    shapesFinal.push({
                        type: 'line', x0: idx1, y0: bracketY, x1: idx2, y1: bracketY,
                        line: { color: 'black', width: 1 }
                    });
                    shapesFinal.push({
                        type: 'line', x0: idx2, y0: bracketY, x1: idx2, y1: bracketY - step * 0.1,
                        line: { color: 'black', width: 1 }
                    });

                    // Text
                    annotationsFinal.push({
                        x: (idx1 + idx2) / 2,
                        y: bracketY + step * 0.2, // slightly above
                        text: text,
                        showarrow: false,
                        font: { size: 12, color: 'black' }
                    });
                });

                // Adjust margin to fit brackets
                const topMargin = 50 + (finalLevels.length * 30); // Dynamic margin

                Plotly.newPlot(plotDiv, traces, {
                    title: `${depVar} のグループ別箱ひげ図`,
                    yaxis: { title: depVar },
                    xaxis: {
                        tickvals: groups.map((_, i) => i),
                        ticktext: groups
                    },
                    showlegend: false,
                    shapes: shapesFinal,
                    annotations: annotationsFinal,
                    margin: { t: topMargin }
                });
            }
        });
    }, 100);

    document.getElementById('analysis-results').style.display = 'block';
}

export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 一要因分散分析 (One-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3群以上の平均値の差を検定します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 一要因分散分析 (One-way ANOVA) とは？</strong>
                        <p>3つ以上のグループ（群）間で平均値に差があるかどうかを一度に調べる手法です。t検定を繰り返すと誤りが増えるため、この手法が使われます。</p>
                        <img src="image/分散分析.png" alt="分散分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>3種類以上の薬の効果に違いがあるか比較したい（薬A、薬B、プラセボ）</li>
                        <li>年代別（20代、30代、40代...）に商品満足度に差があるか調べたい</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>全体的な検定 (F検定):</strong> 少なくとも1つのグループ間に差があるかどうかを判定します（p < 0.05なら差あり）。</li>
                        <li><strong>多重比較 (Tukey法など):</strong> 全体で「差がある」となった場合、具体的に「どのグループとどのグループの間」に差があるかを特定します。</li>
                        <li><strong>効果量 (Eta-squared):</strong> 要因がデータの変動をどれくらい説明できているか（影響力の強さ）を表します。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="factor-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-anova-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div id="anova-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#anova-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Select
    createVariableSelector('factor-var-container', categoricalColumns, 'factor-var', {
        label: '<i class="fas fa-layer-group"></i> 要因（グループ変数・3群以上）を選択:',
        multiple: false
    });

    // Multi Select for batch analysis
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数選択可）:',
        multiple: true
    });

    createAnalysisButton('run-anova-btn-container', '分散分析を実行', runOneWayANOVA, { id: 'run-anova-btn' });
}