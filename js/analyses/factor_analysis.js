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

/**
 * Cronbach's α を算出
 * @param {Array<Object>} data - 全データ
 * @param {Array<string>} itemNames - 対象項目名
 * @returns {number|null} α 係数
 */
function computeCronbachAlpha(data, itemNames) {
    if (itemNames.length < 2) return null;
    const k = itemNames.length;
    const validData = data.filter(row => itemNames.every(item => row[item] != null && !isNaN(row[item])));
    if (validData.length < 2) return null;

    let sumItemVar = 0;
    itemNames.forEach(item => {
        const values = validData.map(row => row[item]);
        const sd = jStat.stdev(values, true);
        sumItemVar += sd * sd;
    });

    const totals = validData.map(row => itemNames.reduce((s, item) => s + row[item], 0));
    const totalSD = jStat.stdev(totals, true);
    const totalVar = totalSD * totalSD;

    if (totalVar === 0) return null;
    return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

/**
 * KMO (Kaiser-Meyer-Olkin) を算出
 * @param {Array<Array<number>>} corrMatrix - 相関行列
 * @returns {number} KMO 値
 */
function computeKMO(corrMatrix) {
    try {
        const p = corrMatrix.length;
        const invR = math.inv(corrMatrix);
        let sumR2 = 0, sumA2 = 0;
        for (let i = 0; i < p; i++) {
            for (let j = 0; j < p; j++) {
                if (i === j) continue;
                sumR2 += corrMatrix[i][j] ** 2;
                const partial = -invR[i][j] / Math.sqrt(invR[i][i] * invR[j][j]);
                sumA2 += partial ** 2;
            }
        }
        return sumR2 / (sumR2 + sumA2);
    } catch (e) { return null; }
}

/**
 * Bartlett の球面性検定
 * @param {Array<Array<number>>} corrMatrix - 相関行列
 * @param {number} n - サンプルサイズ
 * @returns {{chi2: number, df: number, p: number}}
 */
function computeBartlettTest(corrMatrix, n) {
    try {
        const p = corrMatrix.length;
        const detR = math.det(corrMatrix);
        if (detR <= 0) return { chi2: Infinity, df: p * (p - 1) / 2, p: 0 };
        const chi2 = -((n - 1) - (2 * p + 5) / 6) * Math.log(detR);
        const df = p * (p - 1) / 2;
        const pValue = 1 - jStat.chisquare.cdf(chi2, df);
        return { chi2, df, p: pValue };
    } catch (e) { return null; }
}

/**
 * RMSR (残差平方平均平方根) を算出
 * @param {Array<Array<number>>} corrMatrix - 観測相関行列
 * @param {Array<Array<number>>} loadings - 因子負荷量
 * @param {Array<Array<number>>|null} factorCorrelations - 因子間相関
 * @returns {number} RMSR 値
 */
function computeRMSR(corrMatrix, loadings, factorCorrelations) {
    try {
        const p = corrMatrix.length;
        const L = math.matrix(loadings);
        let reproduced;
        if (factorCorrelations) {
            const Phi = math.matrix(factorCorrelations);
            reproduced = math.multiply(math.multiply(L, Phi), math.transpose(L));
        } else {
            reproduced = math.multiply(L, math.transpose(L));
        }
        let sumSq = 0, count = 0;
        for (let i = 0; i < p; i++) {
            for (let j = i + 1; j < p; j++) {
                const resid = corrMatrix[i][j] - (reproduced.get ? reproduced.get([i, j]) : reproduced[i][j]);
                sumSq += resid ** 2;
                count++;
            }
        }
        return Math.sqrt(sumSq / count);
    } catch (e) { return null; }
}

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
        const corrMatrix = result.corrMatrix;
        let factorCorrelations = null;

        // 回転の適用
        if (rotationMethod === 'varimax') {
            loadings = calculateVarimax(loadings);
        } else if (rotationMethod === 'promax') {
            const res = calculatePromax(loadings, 4);
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'oblimin') {
            const res = calculateDirectOblimin(loadings, 0);
            loadings = res.loadings;
            factorCorrelations = res.correlations;
        } else if (rotationMethod === 'geomin') {
            const res = calculateGeomin(loadings, 0.01);
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
        const rotatedStats = colSS.map(val => {
            const contribution = (val / numVars) * 100;
            cumulative += contribution;
            return { eigenvalue: val, contribution, cumulative };
        });

        // 共通性 (communalities)
        const communalities = variables.map((_, i) =>
            loadings[i].reduce((s, l) => s + l * l, 0)
        );

        // 項目の因子割り当て → Cronbach's α
        const itemFactors = variables.map((_, i) => {
            let maxAbs = -1, factor = 0;
            loadings[i].forEach((l, f) => {
                if (Math.abs(l) > maxAbs) { maxAbs = Math.abs(l); factor = f; }
            });
            return factor;
        });
        const alphas = [];
        for (let f = 0; f < numFactors; f++) {
            const items = variables.filter((_, i) => itemFactors[i] === f);
            alphas.push(computeCronbachAlpha(currentData, items));
        }

        // 適合度指標
        const validN = currentData.filter(row =>
            variables.every(v => row[v] != null && !isNaN(row[v]))
        ).length;
        const kmo = computeKMO(corrMatrix);
        const bartlett = computeBartlettTest(corrMatrix, validN);
        const rmsr = computeRMSR(corrMatrix, loadings, factorCorrelations);

        // --- 描画 ---
        displayEigenvalues(eigenvalues, rotatedStats);
        displayLoadings(variables, loadings, rotationMethod, {
            communalities, alphas, rotatedStats, factorCorrelations,
            fitIndices: { kmo, bartlett, rmsr, n: validN }
        });

        // 因子間相関は loadings テーブル内に統合 → 個別コンテナは非表示
        const corrContainer = document.getElementById('factor-correlations');
        if (corrContainer) corrContainer.innerHTML = '';
        const corrWrapper = document.getElementById('factor-correlations-container');
        if (corrWrapper) corrWrapper.style.display = 'none';

        displayFactorInterpretation(variables, loadings);
        plotScree(eigenvalues);
        plotLoadingsHeatmap(variables, loadings, rotationMethod);

        document.getElementById('fa-analysis-results').style.display = 'block';

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
                        <li><strong>プロマックス (Promax):</strong> 斜交回転の一種。Varimax解を基に、因子間の相関を許容する斜交解を求めます。心理学でよく使用されます。</li>
                        <li><strong>ダイレクト・オブリミン (Direct Oblimin):</strong> 斜交回転。因子間の相関を直接最小化する方法で、γ=0 (Quartimin) を使用します。</li>
                        <li><strong>ジェオミン (Geomin):</strong> 斜交回転。各項目ができるだけ少数の因子にのみ高い負荷量を持つ解を求めます。</li>
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
                        <ul>
                            <li><strong>因子抽出:</strong> 相関行列の固有値分解 (eigendecomposition) を使用。因子負荷量 = 固有ベクトル × √固有値。<code>math.eigs()</code> で算出。</li>
                            <li><strong>固有値・寄与率:</strong> 各因子の SS Loadings（負荷量の二乗和）、寄与率 = SS / 変数数、累積寄与率を算出。</li>
                            <li><strong>回転方法:</strong>
                                <ul>
                                    <li><strong>バリマックス (Varimax):</strong> 直交回転。Kaiser 正規化後、負荷量の二乗の分散を最大化（最大50反復, ε=10⁻⁶）</li>
                                    <li><strong>プロマックス (Promax):</strong> 斜交回転。Varimax 解を基に、要素を κ=4 乗してターゲットパターンを生成し、斜交変換を適用</li>
                                    <li><strong>ダイレクト・オブリミン (Direct Oblimin):</strong> 斜交回転 (γ=0, Quartimin)。勾配射影法 (Gradient Projection) で最適化</li>
                                    <li><strong>ジェオミン (Geomin):</strong> 斜交回転 (ε=0.01)。勾配射影法で最適化（最大500反復, ε=10⁻⁵）</li>
                                </ul>
                            </li>
                            <li><strong>因子間相関:</strong> 斜交回転の場合、因子間相関行列を算出・表示</li>
                            <li><strong>因子解釈:</strong> 負荷量の絶対値 ≥ 0.4 の項目を各因子にリストアップ</li>
                        </ul>
                    </div>
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
            <div id="fa-analysis-results" style="display: none;">
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
