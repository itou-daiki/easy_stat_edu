import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

// 相関マトリックスの計算
function calculateCorrelationMatrix(variables) {
    const matrix = [];
    for (let i = 0; i < variables.length; i++) {
        const row = [];
        for (let j = 0; j < variables.length; j++) {
            const var1 = variables[i];
            const var2 = variables[j];

            // ペアごとの欠損除去
            const pairs = currentData
                .map(r => ({ x: r[var1], y: r[var2] }))
                .filter(p =>
                    p.x != null && !isNaN(p.x) &&
                    p.y != null && !isNaN(p.y)
                );

            if (pairs.length < 2) {
                row.push(NaN);
            } else {
                const x = pairs.map(p => p.x);
                const y = pairs.map(p => p.y);
                row.push(jStat.corrcoeff(x, y));
            }
        }
        matrix.push(row);
    }
    return matrix;
}

// 相関分析の実行
function runCorrelationAnalysis() {
    const selector = document.getElementById('correlation-vars');
    const selectedVars = Array.from(selector.selectedOptions).map(opt => opt.value);

    if (selectedVars.length < 2) {
        alert('少なくとも2つの変数を選択してください');
        return;
    }

    const matrix = calculateCorrelationMatrix(selectedVars);
    displayResults(selectedVars, matrix);
    plotHeatmap(selectedVars, matrix);
    plotScatterMatrix(selectedVars);

    document.getElementById('analysis-results').style.display = 'block';
}

function displayResults(variables, matrix) {
    const container = document.getElementById('correlation-table');
    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>変数</th>
                        ${variables.map(v => `<th>${v}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    variables.forEach((rowVar, i) => {
        html += `<tr><td><strong>${rowVar}</strong></td>`;
        variables.forEach((colVar, j) => {
            const val = matrix[i][j];
            let style = '';
            if (!isNaN(val)) {
                if (Math.abs(val) > 0.7) style = 'background: rgba(30, 144, 255, 0.2); font-weight: bold;';
                else if (Math.abs(val) > 0.4) style = 'background: rgba(30, 144, 255, 0.1);';
            }
            html += `<td style="${style}">${isNaN(val) ? '-' : val.toFixed(3)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // 解釈の追加
    html += `
        <div style="margin-top: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
            <h5 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-info-circle"></i> 相関係数の解釈
            </h5>
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;"><strong>0.7 〜 1.0</strong>: 強い正の相関（片方が増えるともう片方も強く増える）</li>
                <li style="margin-bottom: 0.5rem;"><strong>0.4 〜 0.7</strong>: 中程度の正の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>0.2 〜 0.4</strong>: 弱い正の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.2 〜 0.2</strong>: ほとんど相関なし</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.4 〜 -0.2</strong>: 弱い負の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-0.7 〜 -0.4</strong>: 中程度の負の相関</li>
                <li style="margin-bottom: 0.5rem;"><strong>-1.0 〜 -0.7</strong>: 強い負の相関（片方が増えるともう片方は強く減る）</li>
            </ul>
        </div>
    `;

    container.innerHTML = html;
}

function plotHeatmap(variables, matrix) {
    const data = [{
        z: matrix,
        x: variables,
        y: variables,
        type: 'heatmap',
        colorscale: 'RdBu',
        zmin: -1,
        zmax: 1
    }];

    const layout = {
        title: '相関ヒートマップ',
        height: 600,
        margin: { b: 100 }
    };

    Plotly.newPlot('correlation-heatmap', data, layout);
}

function plotScatterMatrix(variables) {
    // データの準備（最大1000件に制限してパフォーマンス確保）
    const plotData = currentData.slice(0, 1000);

    const dimensions = variables.map(v => ({
        label: v,
        values: plotData.map(row => row[v])
    }));

    const data = [{
        type: 'splom',
        dimensions: dimensions,
        marker: {
            color: '#1e90ff',
            size: 5,
            opacity: 0.5
        },
        diagonal: { visible: false } // 対角線はヒストグラム等にした方が良いがsplomは簡易的に
    }];

    const layout = {
        title: '散布図行列（上位1000件）',
        height: 800,
        width: 800,
        hovermode: 'closest',
        dragmode: 'select',
        plot_bgcolor: 'rgba(240,240,240, 0.95)',
        margin: { l: 50, r: 50, t: 50, b: 50 }
    };

    Plotly.newPlot('scatter-matrix', data, layout);
}

export function render(container, characteristics) {
    const { numericColumns } = characteristics;

    container.innerHTML = `
        <div class="correlation-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-project-diagram"></i> 相関分析
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">変数間の関係の強さを分析します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 相関分析 (Correlation Analysis) とは？</strong>
                        <p>2つの変数の間に「どのような関係があるか（相関）」を数値（相関係数）で表す手法です。「片方が増えると、もう片方も増える（正の相関）」などを見つけます。</p>
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li>「身長」と「体重」に関係があるか知りたい</li>
                        <li>「勉強時間」と「テストの点数」に関係があるか調べたい</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>相関係数 (r):</strong> -1から+1の範囲の値をとります。
                            <ul>
                                <li><strong>0.7 〜 1.0:</strong> 強い正の相関（一方が増ともう一方も強く増える）</li>
                                <li><strong>-0.7 〜 -1.0:</strong> 強い負の相関（一方が増えるともう一方は強く減る）</li>
                                <li><strong>0付近:</strong> 相関なし（関係性が見られない）</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- データプレビュー -->
            <div id="corr-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="corr-vars-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-correlation-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-table"></i> 相関行列
                    </h4>
                    <div id="correlation-table"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-th"></i> ヒートマップ
                    </h4>
                    <div id="correlation-heatmap"></div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                        <i class="fas fa-grip-horizontal"></i> 散布図行列
                    </h4>
                    <div id="scatter-matrix"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#corr-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Multi select for correlation variables
    createVariableSelector('corr-vars-container', numericColumns, 'correlation-vars', {
        label: '<i class="fas fa-check-square"></i> 分析する数値変数を選択（複数選択可、2つ以上）:',
        multiple: true
    });

    createAnalysisButton('run-correlation-btn-container', '相関分析を実行', runCorrelationAnalysis, { id: 'run-correlation-btn' });
}
