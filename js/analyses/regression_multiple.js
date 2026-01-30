import { renderDataOverview, createVariableSelector, createAnalysisButton, createVisualizationControls, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml } from '../utils.js';
import { performRegression, calculateCoefStats } from './regression_multiple/helpers.js';
import { plotCombinedPathDiagram, plotResidualsVsFitted } from './regression_multiple/visualization.js';

// 重回帰分析の実行
function runMultipleRegression(currentData) {
    const dependentVarsSelect = document.getElementById('dependent-vars');
    const dependentVars = Array.from(dependentVarsSelect.selectedOptions).map(option => option.value);

    const independentVarsSelect = document.getElementById('independent-vars');
    const independentVars = Array.from(independentVarsSelect.selectedOptions).map(option => option.value);

    if (dependentVars.length === 0) {
        alert('目的変数を少なくとも1つ選択してください');
        return;
    }

    if (independentVars.length === 0) {
        alert('説明変数を少なくとも1つ選択してください');
        return;
    }

    // Check for overlap
    const overlap = dependentVars.filter(v => independentVars.includes(v));
    if (overlap.length > 0) {
        alert(`変数 "${overlap.join(', ')}" が目的変数と説明変数の両方に含まれています。異なるものを選択してください。`);
        return;
    }

    const resultsContainer = document.getElementById('regression-results');
    resultsContainer.innerHTML = '';

    // Plot area container (combined)
    const plotAreaId = 'plot-area';
    const plotContainer = document.getElementById(plotAreaId);
    if (plotContainer) plotContainer.innerHTML = ''; // Clear previous

    const allResults = []; // To store data for combined path diagram

    let hasError = false;

    // Iterate through each dependent variable
    dependentVars.forEach((dependentVar, idx) => {
        try {
            // Helper関数を使用して回帰を実行
            const result = performRegression(dependentVar, independentVars, currentData);

            // 結果を保存 (パス図用)
            allResults.push(result);

            const {
                n, k, r2, adjR2, fValue, pValueModel,
                beta, seBeta, standardizedBeta, vifs,
                yPred, residuals
            } = result;

            // HTML Output Construction
            let sectionHtml = `
                <div style="margin-bottom: 3rem; border-top: 4px solid #1e90ff; padding-top: 1rem;">
                    <h3 style="color: #2d3748; margin-bottom: 1rem;">
                        <i class="fas fa-bullseye"></i> 目的変数: <span style="color: #1e90ff;">${dependentVar}</span>
                    </h3>
                    
                    <div class="data-stats-grid" style="margin-bottom: 1.5rem;">
                         <div class="data-stat-card">
                            <div class="stat-label">決定係数 (R²)</div>
                            <div class="stat-value">${r2.toFixed(3)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">調整済み R²</div>
                            <div class="stat-value">${adjR2.toFixed(3)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">F値</div>
                            <div class="stat-value">${fValue.toFixed(2)}</div>
                        </div>
                        <div class="data-stat-card">
                            <div class="stat-label">有意確率 (p)</div>
                            <div class="stat-value">${pValueModel < 0.001 ? '< 0.001' : pValueModel.toFixed(3)}</div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead style="background: #f8f9fa;">
                                <tr>
                                    <th>説明変数</th>
                                    <th>非標準化係数 (B)</th>
                                    <th>標準誤差 (SE)</th>
                                    <th>標準化係数 (β)</th>
                                    <th>t値</th>
                                    <th>p値</th>
                                    <th>VIF</th>
                                    <th>判定</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Const Row
            // beta[0] is intercept
            const { t: tValConst, p: pValConst } = calculateCoefStats(beta[0], seBeta[0], n - k - 1);

            sectionHtml += `
                <tr>
                    <td style="color:#666;">(定数項)</td>
                    <td>${beta[0].toFixed(3)}</td>
                    <td>${seBeta[0].toFixed(3)}</td>
                    <td>-</td>
                    <td>${tValConst.toFixed(3)}</td>
                    <td>${pValConst < 0.001 ? '< 0.001' : pValConst.toFixed(3)}</td>
                    <td>-</td> <!-- Const VIF -->
                    <td>${pValConst < 0.05 ? '*' : ''}</td>
                </tr>
            `;

            const interpretationCoeffs = [];

            // Independent Variables Rows
            independentVars.forEach((v, i) => {
                const b = beta[i + 1];
                const se = seBeta[i + 1];
                const betaStd = standardizedBeta[i];
                const { t, p } = calculateCoefStats(b, se, n - k - 1);

                const sig = p < 0.01 ? '**' : (p < 0.05 ? '*' : (p < 0.1 ? '†' : ''));
                const vif = vifs[i];
                const vifStyle = vif > 10 ? 'color: #ef4444; font-weight: bold;' : (vif > 5 ? 'color: #d97706;' : '');

                interpretationCoeffs.push({ name: v, beta: b, stdBeta: betaStd, p: p });

                sectionHtml += `
                        <tr>
                            <td style="font-weight: bold; color: #2d3748;">${v}</td>
                            <td>${b.toFixed(3)}</td>
                            <td>${se.toFixed(3)}</td>
                            <td>${betaStd.toFixed(3)}</td>
                            <td>${t.toFixed(3)}</td>
                            <td>${p.toFixed(3)}</td>
                            <td style="${vifStyle}">${vif.toFixed(2)}</td>
                            <td><strong style="color: ${p < 0.05 ? '#e53e3e' : '#718096'}">${sig}</strong></td>
                        </tr>
                    `;
            });

            sectionHtml += `
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                            <i class="fas fa-comment-dots"></i> 結果の解釈
                        </h4>
                        <div style="line-height: 1.6;">
                            ${InterpretationHelper.interpretRegression(r2, pValueModel, dependentVar, interpretationCoeffs)}
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem;">
                       <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                       <div id="reporting-table-container-multi-reg-${idx}"></div>
                    </div>

                    <!-- Diagnostic Plots for this Dependent Var -->
                    <div style="margin-top: 2rem; border-top: 1px dashed #cbd5e0; padding-top: 1rem;">
                        <h4 style="color: #4b5563; font-size: 1.1rem; margin-bottom: 1rem;">診断プロット: ${dependentVar}</h4>
                        <div id="diagnostic-plot-${idx}" style="height: 400px;"></div>
                    </div>
                </div>
            `;

            resultsContainer.innerHTML += sectionHtml;

            // Plot Diagnostics (Using imported visualization function)
            setTimeout(() => {
                // Convert math.js matrix/arrays to JS arrays if needed (helpers performRegression handles conversions mostly, but let's be safe)
                const fittedArr = Array.isArray(yPred) ? yPred : yPred.toArray().flat();
                const residArr = Array.isArray(residuals) ? residuals : residuals.toArray().flat();
                plotResidualsVsFitted(`diagnostic-plot-${idx}`, fittedArr, residArr);
            }, 0);

            // Generate APA Table
            const headersReg = ["Variable", "<em>B</em>", "<em>SE B</em>", "<em>β</em>", "<em>t</em>", "<em>p</em>"];
            const rowsReg = [
                ["Intercept", beta[0].toFixed(3), seBeta[0].toFixed(3), "-", tValConst.toFixed(3), (pValConst < 0.001 ? '< .001' : pValConst.toFixed(3))]
            ];

            independentVars.forEach((v, i) => {
                const b = beta[i + 1];
                const se = seBeta[i + 1];
                const betaStd = standardizedBeta[i];
                const { t, p } = calculateCoefStats(b, se, n - k - 1);

                rowsReg.push([
                    v,
                    b.toFixed(3),
                    se.toFixed(3),
                    betaStd.toFixed(3),
                    t.toFixed(3),
                    (p < 0.001 ? '< .001' : p.toFixed(3))
                ]);
            });

            const noteReg = `<em>R</em><sup>2</sup> = ${r2.toFixed(3)}, <em>Adj. R</em><sup>2</sup> = ${adjR2.toFixed(3)}, <em>F</em>(${k}, ${n - k - 1}) = ${fValue.toFixed(2)}, <em>p</em> ${pValueModel < 0.001 ? '< .001' : '= ' + pValueModel.toFixed(3)}.`;

            setTimeout(() => {
                const container = document.getElementById(`reporting-table-container-multi-reg-${idx}`);
                if (container) {
                    container.innerHTML = generateAPATableHtml(`reg-multi-apa-${idx}`, `Table ${idx + 1}. Results of Multiple Regression for ${dependentVar}`, headersReg, rowsReg, noteReg);
                }
            }, 0);

        } catch (e) {
            console.error(e);
            resultsContainer.innerHTML += `<div class="error-box">変数 <strong>${dependentVar}</strong> の計算中にエラーが発生しました。</div>`;
            hasError = true;
        }
    });

    // Combined Path Diagram (Using imported visualization function)
    if (allResults.length > 0 && !hasError) {
        plotCombinedPathDiagram(independentVars, allResults);
    }

    document.getElementById('analysis-results').style.display = 'block';

    // 軸ラベルの動的切り替え
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');

    if (axisControl && titleControl) {
        const updatePlot = () => {
            if (allResults.length > 0 && !hasError) {
                plotCombinedPathDiagram(independentVars, allResults);
            }
        };
        axisControl.addEventListener('change', updatePlot);
        titleControl.addEventListener('change', updatePlot);
    }
}

export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="regression-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-layer-group"></i> 重回帰分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">複数の変数から目的変数を予測します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 重回帰分析 (Multiple Regression Analysis) とは？</strong>
                        <p>「複数の要因（説明変数）」が「1つの結果（目的変数）」にどう影響するかを調べる分析です。「美味しいカレーの味（結果）」は「スパイスの量」と「煮込み時間」（要因）で決まる、というようなイメージです。</p>
                        <p><strong>パス図について:</strong> どの要因の影響が強いかを矢印の太さで図示します（影響が弱いものは表示されません）。</p>
                    </div>
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
                        <ul>
                            <li><strong>推定法:</strong> 最小二乗法 (OLS) - 行列演算による解析解</li>
                            <li><strong>自由度調整済み決定係数 (Adj R²):</strong> \( 1 - (1-R^2)\frac{n-1}{n-p-1} \) (p:説明変数の数)</li>
                            <li><strong>標準化係数 (Standardized Beta):</strong> 変数を標準化(Zスコア化)した場合の回帰係数。比較可能性のため算出。</li>
                            <li><strong>多重共線性:</strong> VIF（分散拡大係数）の算出はhelpers.jsで実装されています。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- データプレビュー -->
            <div id="regression-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="settings-form">
                    <div id="dependent-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="independent-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-regression-btn-container"></div>
                </div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <!-- 軸ラベル表示オプション -->
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="visualization-controls-container"></div>
                </div>

                <div id="regression-results"></div>
                <!-- Combined Plot Area -->
                <div id="plot-area" style="width: 100%; height: 600px; margin-top: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); background: white;"></div>
            </div>
        </div>
    `;

    renderDataOverview('#regression-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // 目的変数 (Multiple Select)
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-vars', {
        label: '<i class="fas fa-bullseye"></i> 目的変数（予測したい変数）を選択（複数可）:',
        multiple: true
    });

    // 説明変数 (Multi Select)
    createVariableSelector('independent-vars-container', numericColumns, 'independent-vars', {
        label: '<i class="fas fa-list"></i> 説明変数（予測に使う変数）を選択（複数可）:',
        multiple: true
    });

    createAnalysisButton('run-regression-btn-container', '分析を実行', () => runMultipleRegression(currentData), { id: 'run-multiple-regression-btn' });
}