import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

function runTwoWayANOVA() {
    const factor1 = document.getElementById('factor1-var').value;
    const factor2 = document.getElementById('factor2-var').value;
    const dependentVarSelect = document.getElementById('dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (!factor1 || !factor2) {
        alert('2つの要因（グループ変数）を選択してください');
        return;
    }
    if (factor1 === factor2) {
        alert('異なる要因を選択してください');
        return;
    }
    if (dependentVars.length === 0) {
        alert('従属変数を少なくとも1つ選択してください');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    dependentVars.forEach(depVar => {
        try {
            // データの抽出と整形
            const data = currentData.map(row => ({
                f1: row[factor1],
                f2: row[factor2],
                val: row[depVar]
            })).filter(d =>
                d.f1 != null &&
                d.f2 != null &&
                d.val != null && !isNaN(d.val)
            );

            // group levels
            const levels1 = [...new Set(data.map(d => d.f1))].sort();
            const levels2 = [...new Set(data.map(d => d.f2))].sort();

            const n = data.length;
            const meanTotal = jStat.mean(data.map(d => d.val));

            // Sum of Squares calculation
            // SS_T (Total)
            const ssTotal = data.reduce((sum, d) => sum + Math.pow(d.val - meanTotal, 2), 0);

            // SS_A (Factor 1)
            let ssA = 0;
            levels1.forEach(l1 => {
                const sub = data.filter(d => d.f1 === l1).map(d => d.val);
                ssA += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });

            // SS_B (Factor 2)
            let ssB = 0;
            levels2.forEach(l2 => {
                const sub = data.filter(d => d.f2 === l2).map(d => d.val);
                ssB += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });

            // SS_AxB (Interaction) + SS_Within (Error) calculation logic is complex for unbalanced data (Type III SS etc)
            // Here we assume balanced data or use simplified calculation (Type I/II approx) for educational purpose
            // Instead, let's calculate SS_Cells (Between Groups for all combinations)

            let ssCells = 0;
            levels1.forEach(l1 => {
                levels2.forEach(l2 => {
                    const sub = data.filter(d => d.f1 === l1 && d.f2 === l2).map(d => d.val);
                    if (sub.length > 0) {
                        ssCells += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
                    }
                });
            });

            const ssAxB = ssCells - ssA - ssB;
            const ssError = ssTotal - ssCells;

            // Degrees of Freedom
            const dfA = levels1.length - 1;
            const dfB = levels2.length - 1;
            const dfAxB = dfA * dfB;
            const dfError = n - (levels1.length * levels2.length); // Assuming all cells have data

            // Mean Squares
            const msA = ssA / dfA;
            const msB = ssB / dfB;
            const msAxB = ssAxB / dfAxB;
            const msError = ssError / dfError;

            // F values
            const fA = msA / msError;
            const fB = msB / msError;
            const fAxB = msAxB / msError;

            // P values
            const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);
            const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);
            const pAxB = 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError);

            // Partial Eta Squared
            const etaA = ssA / (ssA + ssError);
            const etaB = ssB / (ssB + ssError);
            const etaAxB = ssAxB / (ssAxB + ssError);

            // Display Results
            const sectionId = `anova2-${depVar}`;

            let html = `
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                        変数: ${depVar}
                    </h4>
                    
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>要因</th>
                                    <th>SS</th>
                                    <th>df</th>
                                    <th>MS</th>
                                    <th>F値</th>
                                    <th>p値</th>
                                    <th>ηp²</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${factor1} (主効果A)</td>
                                    <td>${ssA.toFixed(2)}</td>
                                    <td>${dfA}</td>
                                    <td>${msA.toFixed(2)}</td>
                                    <td>${fA.toFixed(2)}</td>
                                    <td style="${pA < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pA.toFixed(3)} ${pA < 0.05 ? '*' : ''}</td>
                                    <td>${etaA.toFixed(3)}</td>
                                </tr>
                                <tr>
                                    <td>${factor2} (主効果B)</td>
                                    <td>${ssB.toFixed(2)}</td>
                                    <td>${dfB}</td>
                                    <td>${msB.toFixed(2)}</td>
                                    <td>${fB.toFixed(2)}</td>
                                    <td style="${pB < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pB.toFixed(3)} ${pB < 0.05 ? '*' : ''}</td>
                                    <td>${etaB.toFixed(3)}</td>
                                </tr>
                                <tr>
                                    <td>交互作用 (AxB)</td>
                                    <td>${ssAxB.toFixed(2)}</td>
                                    <td>${dfAxB}</td>
                                    <td>${msAxB.toFixed(2)}</td>
                                    <td>${fAxB.toFixed(2)}</td>
                                    <td style="${pAxB < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${pAxB.toFixed(3)} ${pAxB < 0.05 ? '*' : ''}</td>
                                    <td>${etaAxB.toFixed(3)}</td>
                                </tr>
                                <tr>
                                    <td>誤差 (Error)</td>
                                    <td>${ssError.toFixed(2)}</td>
                                    <td>${dfError}</td>
                                    <td>${msError.toFixed(2)}</td>
                                    <td>-</td>
                                    <td>-</td>
                                    <td>-</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                     <div id="plot-${sectionId}" style="margin-top: 1.5rem;"></div>
                </div>
            `;

            outputContainer.innerHTML += html;

            // Interaction Plot
            setTimeout(() => {
                const plotDiv = document.getElementById(`plot-${sectionId}`);
                if (plotDiv) {
                    const traces = levels1.map(l1 => {
                        const yMeans = levels2.map(l2 => {
                            const sub = data.filter(d => d.f1 === l1 && d.f2 === l2).map(d => d.val);
                            return sub.length > 0 ? jStat.mean(sub) : null;
                        });

                        return {
                            x: levels2, // Factor 2 on X axis
                            y: yMeans,
                            type: 'scatter',
                            mode: 'lines+markers',
                            name: `${factor1}=${l1}` // Factor 1 lines
                        };
                    });

                    Plotly.newPlot(plotDiv, traces, {
                        title: `交互作用プロット: ${depVar}`,
                        xaxis: { title: factor2 },
                        yaxis: { title: `平均値 (${depVar})` }
                    });
                }
            }, 100);

        } catch (e) {
            console.error(e);
            outputContainer.innerHTML += `<p class="error">エラー (${depVar}): 計算できませんでした（データ不足の可能性があります）</p>`;
        }
    });

    document.getElementById('analysis-results').style.display = 'block';
}

export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-th-large"></i> 二要因分散分析 (Two-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因とその交互作用を分析します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 二要因分散分析 (Two-way ANOVA) とは？</strong>
                        <p>2つの要因（カテゴリ変数）が数値データに与える影響を調べる手法です。それぞれの要因の「主効果」だけでなく、要因同士が影響し合う「交互作用効果」も分析できます。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>「性別（男性・女性）」と「指導法（A・B）」がテストの点数にどう影響するか調べたい</li>
                        <li>「温度（高・低）」と「湿度（高・低）」が植物の成長にどう影響するか、組み合わせによる特殊な効果があるか知りたい</li>
                    </ul>
                    <h4>重要な概念：交互作用</h4>
                    <p>ある要因の効果が、もう一方の要因の水準によって変わることです。例えば、「指導法Aは男性には効果的だが、女性には効果が薄い」といった場合、交互作用があると言います。</p>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="anova2-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div id="factor1-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="factor2-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                </div>

                <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="run-anova-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div id="anova-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#anova2-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Selects
    createVariableSelector('factor1-var-container', categoricalColumns, 'factor1-var', {
        label: '<i class="fas fa-tag"></i> 要因1（カテゴリ）:',
        multiple: false
    });
    createVariableSelector('factor2-var-container', categoricalColumns, 'factor2-var', {
        label: '<i class="fas fa-tags"></i> 要因2（カテゴリ）:',
        multiple: false
    });

    // Multi Select
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数選択可）:',
        multiple: true
    });

    createAnalysisButton('run-anova-btn-container', '二要因分散分析を実行', runTwoWayANOVA, { id: 'run-anova-btn' });
}