import { renderDataOverview, createVariableSelector, createAnalysisButton } from '../utils.js';
import { performPCA } from './pca/helpers.js';
import {
    displayEigenvalues,
    plotScree,
    displayLoadings,
    plotBiplot
} from './pca/visualization.js';

function runPCA(currentData) {
    const varsSelect = document.getElementById('pca-vars');
    const variables = Array.from(varsSelect.selectedOptions).map(o => o.value);

    if (variables.length < 2) {
        alert('変数を2つ以上選択してください');
        return;
    }

    try {
        const { eigenvalues, vectors, scores } = performPCA(variables, currentData);

        displayEigenvalues(eigenvalues);
        plotScree(eigenvalues);
        displayLoadings(variables, vectors, eigenvalues);
        plotBiplot(scores, vectors, variables);

        document.getElementById('analysis-results').style.display = 'block';

    } catch (e) {
        console.error(e);
        alert(e.message || '計算エラーが発生しました。');
    }
}


export function render(container, currentData, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="pca-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-compress-arrows-alt"></i> 主成分分析 (PCA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">多次元データを要約して可視化します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 主成分分析 (PCA) とは？</strong>
                        <p>たくさんのデータを、特徴を損なわずに「ギュッと要約」する手法です。例えば「5教科の点数」を「総合的な学力」という1つの指標にまとめるイメージです。</p>
                        <img src="image/pca.png" alt="主成分分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 5教科（国数英理社）の点数を、「文系能力」と「理系能力」のように要約したいとき</li>
                        <li><i class="fas fa-check"></i> 多数のアンケート結果をまとめて、傾向マップを作りたいとき</li>
                    </ul>
                    <h4>因子分析との違い</h4>
                    <ul>
                        <li><strong>PCA:</strong> データの「情報（分散）」を要約・圧縮するのが目的。</li>
                        <li><strong>因子分析:</strong> データの背後にある「原因（因子）」を探るのが目的。</li>
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
                            <li><strong>手法:</strong> 相関行列の固有値分解 (Eigenvalue Decomposition of Correlation Matrix)</li>
                            <li>※ データは自動的に標準化（Zスコア化）されます。</li>
                            <li><strong>アルゴリズム:</strong> <code>math.eigs</code> (ヤコビ法またはQR法等の近似解) を使用。</li>
                            <li><strong>主成分スコア:</strong> \( Z \times V \) （標準化データ行列と固有ベクトルの積）</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="pca-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="pca-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                
                <div id="run-pca-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-list-ol"></i> 固有値リスト</h4>
                        <div id="eigenvalues-table"></div>
                    </div>
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-bar"></i> スクリープロット</h4>
                        <div id="scree-plot"></div>
                    </div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-table"></i> 主成分負荷量</h4>
                    <div id="loadings-table"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-bullseye"></i> バイプロット</h4>
                    <div id="biplot"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#pca-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Multi Select
    createVariableSelector('pca-vars-container', numericColumns, 'pca-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する変数を選択（複数選択可、2つ以上）:',
        multiple: true
    });

    createAnalysisButton('run-pca-btn-container', '主成分分析を実行', () => runPCA(currentData), { id: 'run-pca-btn' });
}