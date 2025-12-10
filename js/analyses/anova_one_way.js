import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, getEffectSizeInterpretation, createVariableSelector, renderSampleSizeInfo } from '../utils.js';

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
                const traces = groups.map(g => ({
                    y: currentData.filter(row => row[factorVar] === g).map(row => row[depVar]),
                    type: 'box',
                    name: g,
                    boxpoints: 'outliers',
                    marker: { color: '#1e90ff' }
                }));

                Plotly.newPlot(plotDiv, traces, {
                    title: `${depVar} のグループ別箱ひげ図`,
                    yaxis: { title: depVar },
                    showlegend: false
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
            <!-- データ概要 -->
            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                        <i class="fas fa-sitemap"></i> 一要因分散分析 (One-way ANOVA)
                    </h3>
                    <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3群以上の平均値の差を検定します</p>
                </div>

                <div id="factor-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <button id="run-anova-btn" class="btn-analysis" style="width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                    <i class="fas fa-play"></i> 分散分析を実行
                </button>
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

    document.getElementById('run-anova-btn').addEventListener('click', runOneWayANOVA);
}