import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';
import {
    exactFactors,
    calculateVarimax,
    calculatePromax,
    calculateDirectOblimin,
    calculateGeomin
} from './factor_analysis/helpers.js';
import {
    displayEigenvalues,
    displayLoadings,
    displayFactorInterpretation,
    plotScree,
    plotLoadingsHeatmap,
    displayFactorCorrelations
} from './factor_analysis/visualization.js';

function runFactorAnalysis(currentData) {
    const varsSelect = document.getElementById('factor-vars');
    const variables = Array.from(varsSelect.selectedOptions).map(o => o.value);
    const numFactors = parseInt(document.getElementById('num-factors').value, 10);
    const rotationMethod = document.getElementById('rotation-method').value;

    if (variables.length < 3) {
        alert('変数を3つ以上選択してください');
        return;
    }
    if (isNaN(numFactors) || numFactors < 1) {
        alert('因子数を正しく指定してください');
        return;
    }

    try {
        const result = exactFactors(variables, numFactors, currentData);
        let loadings = result.loadings;
        const eigenvalues = result.eigenvalues;
        let factorCorrelations = null;

        // 回転の適用
        let rotatedStats = null;

        if (rotationMethod === 'varimax') {
            loadings = calculateVarimax(loadings);
        } else if (rotationMethod === 'promax') {
            const res = calculatePromax(loadings, 4); // kappa=4
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'oblimin') {
            const res = calculateDirectOblimin(loadings, 0); // gamma=0
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'geomin') {
            const res = calculateGeomin(loadings, 0.01); // epsilon=0.01
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        }

        // 回転後の負荷量二乗和 (SS Loadings)
        const numVars = variables.length;
        const colSS = Array(numFactors).fill(0);

        for (let i = 0; i < numVars; i++) {
            for (let j = 0; j < numFactors; j++) {
                colSS[j] += loadings[i][j] ** 2;
            }
        }

        let cumulative = 0;
        rotatedStats = colSS.map(val => {
            const contribution = (val / numVars) * 100;
            cumulative += contribution;
            return {
                eigenvalue: val,
                contribution: contribution,
                cumulative: cumulative
            };
        });

        displayEigenvalues(eigenvalues, rotatedStats);
        displayLoadings(variables, loadings, rotationMethod);

        // 因子間相関行列の表示 (斜交回転のみ: promax, oblimin, geomin)
        if (['promax', 'oblimin', 'geomin'].includes(rotationMethod) && factorCorrelations) {
            displayFactorCorrelations(factorCorrelations);
        } else {
            const container = document.getElementById('factor-correlations');
            if (container) container.innerHTML = '';
            const wrapper = document.getElementById('factor-correlations-container');
            if (wrapper) wrapper.style.display = 'none';
        }

        displayFactorInterpretation(variables, loadings);
        plotScree(eigenvalues);
        plotLoadingsHeatmap(variables, loadings, rotationMethod);

        document.getElementById('analysis-results').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert('計算中にエラーが発生しました。データを確認してください。');
    }
}

export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="factor-analysis-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 因子分析 (Factor Analysis)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">多数の変数の背後にある共通因子を探索します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 因子分析とは？</strong>
                        <p>観測された変数（テストの点数など）の背後に、それらを支配する潜在的な要因（数学的能力、言語能力など）があると仮定し、その構造を明らかにします。</p>
                    </div>
                    <h4>回転 (Rotation) について</h4>
                    <ul>
                        <li><strong>なし (None):</strong> 初期解のまま。解釈しにくいことが多いです。</li>
                        <li><strong>バリマックス (Varimax):</strong> 直交回転の一種。因子ごとの負荷量の分散を最大化し、「単純構造」を目指します。各因子が明確に一部の変数と強く関係するようになります。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="fa-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="factor-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                
                <div style="display: flex; gap: 2rem; margin-bottom: 1.5rem;">
                    <div style="flex: 1; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                         <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                             <i class="fas fa-sort-numeric-up"></i> 抽出する因子数:
                         </label>
                         <input type="number" id="num-factors" value="2" min="1" max="10" style="padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; width: 100%;">
                    </div>
                    
                    <div style="flex: 1; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                         <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
                             <i class="fas fa-sync-alt"></i> 回転方法:
                         </label>
                         <select id="rotation-method" style="padding: 0.75rem; border: 2px solid #cbd5e0; border-radius: 8px; font-size: 1rem; width: 100%;">
                             <option value="none">なし (None)</option>
                             <option value="varimax" selected>バリマックス回転 (Varimax)</option>
                             <option value="promax">プロマックス回転 (Promax)</option>
                             <option value="oblimin">ダイレクト・オブリミン回転 (Direct Oblimin)</option>
                             <option value="geomin">ジェオミン回転 (Geomin)</option>
                         </select>
                    </div>
                </div>

                <div id="run-factor-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-line"></i> 固有値と寄与率</h4>
                    <div id="eigenvalues-table"></div>
                    <div id="scree-plot" style="margin-top: 1.5rem;"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-th"></i> 因子負荷量</h4>
                     <div id="loadings-table"></div>
                     <div id="loadings-heatmap" style="margin-top: 1.5rem;"></div>
                 </div>

                 <!-- 因子間相関行列 (斜交回転時のみ表示) -->
                 <div id="factor-correlations-container">
                    <div id="factor-correlations" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;"></div>
                 </div>

                 <!-- 因子解釈のサマリーエリア -->
                 <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                     <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-lightbulb"></i> 因子の解釈 (Factor Interpretation)</h4>
                     <p style="color: #4a5568; margin-bottom: 1rem;">負荷量の絶対値が高い項目 (≧ 0.4) をリストアップしました。</p>
                     <div id="factor-interpretation"></div>
                 </div>

             </div>
         </div>
     `;

    renderDataOverview('#fa-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Multi Select
    createVariableSelector('factor-vars-container', numericColumns, 'factor-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択（複数選択可、3つ以上）:',
        multiple: true
    });

    createAnalysisButton('run-factor-btn-container', '因子分析を実行', () => runFactorAnalysis(currentData), { id: 'run-factor-btn' });
}
