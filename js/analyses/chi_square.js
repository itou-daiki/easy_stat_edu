/**
 * @fileoverview カイ二乗検定（独立性の検定）
 * @module chi_square
 * @description クロス集計表を用いた変数間の関連性検定
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml } from '../utils.js';

/**
 * カイ二乗検定を実行
 * @param {Array<Object>} currentData - 分析対象データ
 */
function runChiSquare(currentData) {
    const rowVar = document.getElementById('row-var').value;
    const colVar = document.getElementById('col-var').value;

    if (!rowVar || !colVar) {
        alert('行変数と列変数を選択してください');
        return;
    }
    if (rowVar === colVar) {
        alert('異なる変数を選択してください');
        return;
    }

    // クロス集計表の作成
    const rowValues = currentData.map(d => d[rowVar]);
    const colValues = currentData.map(d => d[colVar]);
    // ユニークな値を取得（ソート）
    const rowKeys = [...new Set(rowValues)].filter(v => v != null).sort();
    const colKeys = [...new Set(colValues)].filter(v => v != null).sort();

    const observed = rowKeys.map(r => {
        return colKeys.map(c => {
            return currentData.filter(d => d[rowVar] === r && d[colVar] === c).length;
        });
    });

    // カイ二乗検定計算
    const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = colKeys.map((_, i) => observed.reduce((sum, row) => sum + row[i], 0));
    const total = rowTotals.reduce((a, b) => a + b, 0);

    const expected = rowKeys.map((_, i) => {
        return colKeys.map((_, j) => (rowTotals[i] * colTotals[j]) / total);
    });

    let chiSquare = 0;
    expected.forEach((row, i) => {
        row.forEach((exp, j) => {
            if (exp > 0) {
                chiSquare += Math.pow(observed[i][j] - exp, 2) / exp;
            }
        });
    });

    const df = (rowKeys.length - 1) * (colKeys.length - 1);
    const pValue = 1 - jStat.chisquare.cdf(chiSquare, df);

    // Cramer's V
    const minDim = Math.min(rowKeys.length, colKeys.length);
    const cramersV = Math.sqrt(chiSquare / (total * (minDim - 1)));

    // 残差分析（調整済み残差）
    const adjResiduals = [];
    expected.forEach((row, i) => {
        const rowRes = [];
        row.forEach((exp, j) => {
            const obs = observed[i][j];
            // Simple approximation for adjusted residual if not needing exact formula with marginal probabilities here
            // Using: (O - E) / sqrt(E * (1 - rowProp) * (1 - colProp))
            const rowProp = rowTotals[i] / total;
            const colProp = colTotals[j] / total;
            const resid = (obs - exp) / Math.sqrt(exp * (1 - rowProp) * (1 - colProp));
            rowRes.push(resid);
        });
        adjResiduals.push(rowRes);
    });

    // Assumption Check: Expected Frequency < 5
    let cellsCount = 0;
    let smallExpCount = 0;
    expected.forEach(row => {
        row.forEach(exp => {
            cellsCount++;
            if (exp < 5) smallExpCount++;
        });
    });
    const smallExpRate = (smallExpCount / cellsCount) * 100;

    // Yates' Continuity Correction (Only for 2x2)
    let yatesChiSquare = null;
    let yatesPValue = null;
    if (rowKeys.length === 2 && colKeys.length === 2) {
        let yatesSum = 0;
        expected.forEach((row, i) => {
            row.forEach((exp, j) => {
                if (exp > 0) {
                    yatesSum += Math.pow(Math.abs(observed[i][j] - exp) - 0.5, 2) / exp;
                }
            });
        });
        yatesChiSquare = yatesSum;
        yatesPValue = 1 - jStat.chisquare.cdf(yatesChiSquare, df);
    }

    displayChiSquareResult(chiSquare, df, pValue, cramersV, rowKeys, colKeys, observed, expected, adjResiduals, rowVar, colVar, smallExpRate, yatesChiSquare, yatesPValue);

    // Generate APA Table (Crosstab with Counts and %)
    // Header: [RowVar, ...ColKeys, Total]
    const headersAPA = [rowVar, ...colKeys.map(c => String(c)), "Total"];
    const rowsAPA = rowKeys.map((r, i) => {
        const row = [String(r)];
        colKeys.forEach((c, j) => {
            const count = observed[i][j];
            const pct = ((count / rowTotals[i]) * 100).toFixed(1);
            row.push(`${count} (${pct}%)`);
        });
        row.push(`${rowTotals[i]} (100.0%)`);
        return row;
    });

    const pText = pValue < 0.001 ? '< .001' : `= ${pValue.toFixed(3)}`;
    const noteAPA = `<em>Note</em>. Values are N (Row %). &chi;<sup>2</sup>(${df}, <em>N</em> = ${total}) = ${chiSquare.toFixed(2)}, <em>p</em> ${pText}, Cramer's <em>V</em> = ${cramersV.toFixed(2)}.`;

    setTimeout(() => {
        const container = document.getElementById('reporting-table-container-chi');
        if (container) {
            container.innerHTML = generateAPATableHtml('chi-apa-table', `Table 1. Crosstabulation of ${rowVar} by ${colVar}`, headersAPA, rowsAPA, noteAPA);
        }
    }, 0);
}

function displayChiSquareResult(chi2, df, p, v, rowKeys, colKeys, observed, expected, adjResiduals, rowVar, colVar, smallExpRate, yatesChi, yatesP) {
    const container = document.getElementById('chi-results');

    // Warning for Assumption
    let warningHtml = '';
    if (smallExpRate > 20) {
        warningHtml = `
            <div style="background-color: #fffbe6; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; color: #92400e;">
                <strong><i class="fas fa-exclamation-triangle"></i> 注意: 期待度数が5未満のセルが ${smallExpRate.toFixed(1)}% あります。</strong><br>
                カイ二乗検定の前提条件（全体の20%以下）を満たしていません。結果の信頼性が低い可能性があります。<br>
                サンプルサイズを増やすか、Fisherの正確確率検定（本ツール未実装）を検討してください。
            </div>`;
    }

    // Yates Result HTML
    let yatesHtml = '';
    if (yatesChi !== null) {
        yatesHtml = `
            <div class="data-stat-card" style="background: #f0f9ff; border: 1px solid #bae6fd;">
                <div class="stat-label">Yates補正 χ² (2x2)</div>
                <div class="stat-value">${yatesChi.toFixed(2)}</div>
                <div class="stat-sub" style="font-size: 0.8rem; color: #666;">p = ${yatesP.toFixed(4)} ${yatesP < 0.05 ? '*' : ''}</div>
            </div>
        `;
    }
    let html = warningHtml + `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-clipboard-check"></i> 検定結果
            </h4>
            <div class="data-stats-grid">
                <div class="data-stat-card">
                    <div class="stat-label">カイ二乗値 (χ²)</div>
                    <div class="stat-value">${chi2.toFixed(2)}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">自由度 (df)</div>
                    <div class="stat-value">${df}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">p値</div>
                    <div class="stat-value" style="${p < 0.05 ? 'color: #ef4444;' : ''}">${p.toFixed(4)} ${p < 0.05 ? '*' : ''}</div>
                </div>
                <div class="data-stat-card">
                    <div class="stat-label">クラメールのV</div>
                    <div class="stat-value">${v.toFixed(3)}</div>
                </div>
                ${yatesHtml}
            </div>
            
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> 結果の解釈
                </h4>
                <div style="line-height: 1.6;">
                    ${(() => { try { return InterpretationHelper.interpretChiSquare(p, v, rowVar, colVar); } catch (e) { console.error('Interpretation Error:', e); return '結果の解釈中にエラーが発生しました。'; } })()}
                </div>
            </div>

            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <div id="reporting-table-container-chi"></div>
            </div>
        </div>

        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-table"></i> クロス集計表と残差分析
            </h4>
            <div class="table-container">
                <table class="table">
                        <tr>
                            <th>${rowVar} \\ ${colVar}</th>
                            ${colKeys.map(c => `<th>${c}</th>`).join('')}
                            <th>合計</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // テーブル本体
    rowKeys.forEach((r, i) => {
        html += `<tr><td><strong>${r}</strong></td>`;
        let rowSum = 0;
        colKeys.forEach((c, j) => {
            const obs = observed[i][j];
            const exp = expected[i][j];
            const res = adjResiduals[i][j];
            rowSum += obs;

            // 残差による色付け
            let style = '';
            if (res > 1.96) style = 'background: #dbeafe; color: #1e40af; font-weight: bold;'; // 有意に多い
            else if (res < -1.96) style = 'background: #fee2e2; color: #991b1b;'; // 有意に少ない

            html += `
                <td style="${style}">
                    <div>${obs} <span style="font-size:0.8em; color:#666;">(${exp.toFixed(1)})</span></div>
                    <div style="font-size:0.8em;">z=${res.toFixed(1)}</div>
                </td>
            `;
        });
        html += `<td>${rowSum}</td></tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <p style="margin-top: 0.5rem; color: #666; font-size: 0.8rem;">
                上段: 観測度数 (期待度数), 下段: 調整済み標準化残差 (z)。<br>
                z > 1.96 (青) は有意に多い、z < -1.96 (赤) は有意に少ない組み合わせを示します。
            </p>
        </div>

        <div id="heatmap-plot"></div>
    `;

    container.innerHTML = html;

    // ヒートマップ
    plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar);

    document.getElementById('analysis-results').style.display = 'block';

    // 可視化コントロールの追加
    const { axisControl, titleControl } = createVisualizationControls('visualization-controls-container');

    if (axisControl && titleControl) {
        const updatePlot = () => {
            plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar);
        };
        axisControl.addEventListener('change', updatePlot);
        titleControl.addEventListener('change', updatePlot);
    }
}

function plotHeatmap(observed, colKeys, rowKeys, rowVar, colVar) {
    const data = [{
        z: observed,
        x: colKeys,
        y: rowKeys,
        type: 'heatmap',
        colorscale: 'Blues'
    }];

    const layout = {
        title: '',
        xaxis: { title: colVar },
        yaxis: { title: '' },
        margin: { l: 100, b: 150 },
        annotations: []
    };

    // 軸ラベルとタイトルの表示切り替え
    const axisControl = document.getElementById('show-axis-labels');
    const titleControl = document.getElementById('show-graph-title');
    const showAxisLabels = axisControl?.checked ?? true;
    const showGraphTitle = titleControl?.checked ?? true;

    if (showAxisLabels) {
        const tategakiTitle = getTategakiAnnotation(rowVar);
        if (tategakiTitle) layout.annotations.push(tategakiTitle);
    } else {
        layout.xaxis.title = '';
    }

    if (showGraphTitle) {
        const bottomTitle = getBottomTitleAnnotation('観測度数のヒートマップ');
        if (bottomTitle) layout.annotations.push(bottomTitle);
    }

    Plotly.newPlot('heatmap-plot', data, layout, createPlotlyConfig('カイ二乗検定_ヒートマップ', [rowVar, colVar]));
}

export function render(container, currentData, characteristics) {
    const { categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="chisquare-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-border-all"></i> カイ二乗検定
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つのカテゴリ変数の独立性を検定します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> カイ二乗検定 (Chi-Square Test) とは？</strong>
                        <p>「性別（男女）」や「好みの色（赤・青・黄）」のようなカテゴリーデータ同士に関係があるかを調べる分析です。「クロス集計表」を使って分析します。</p>
                        <img src="image/chi_square.png" alt="カイ二乗分析のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>どういう時に使うの？</h4>
                    <ul>
                        <li><i class="fas fa-check"></i> 「男女（性別）」によって「理系・文系（コース選択）」に偏りがあるか調べたいとき</li>
                        <li><i class="fas fa-check"></i> 「喫煙（する・しない）」と「病気（あり・なし）」に関連があるか調べたいとき</li>
                    </ul>
                    <h4>結果の読み方</h4>
                    <ul>
                        <li><strong>p値 < 0.05:</strong> 2つのデータには「関連がある（独立ではない）」と言えます。</li>
                        <li><strong>残差分析:</strong> 「思ったより多かった（または少なかった）」組み合わせが分かります。調整済み残差が1.96以上だと「有意に多い」です。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
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
                            <li><strong>検定手法:</strong> ピアソンのカイ二乗検定 (Pearson's Chi-square test)</li>
                            <li><strong>統計量:</strong> \( \chi^2 = \sum \frac{(O_{ij} - E_{ij})^2}{E_{ij}} \) （O:観測度数, E:期待度数）</li>
                            <li><strong>効果量 (Cramer's V):</strong> \( V = \sqrt{\frac{\chi^2}{N \times \min(r-1, c-1)}} \)</li>
                            <li><strong>残差分析:</strong> 調整済み標準化残差 (Adjusted Standardized Residuals) を算出。絶対値が1.96を超える場合、有意な偏りとみなします。</li>
                            <li>※ イェーツの補正は適用していません（標準的な実装）。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div id="chi-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div id="row-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="col-var-container" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                </div>



                <div id="run-chi-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <!-- 可視化コントロール -->
                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: flex-end;">
                     <div id="visualization-controls-container"></div>
                </div>
                <div id="chi-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#chi-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Selects
    createVariableSelector('row-var-container', categoricalColumns, 'row-var', {
        label: '<i class="fas fa-bars"></i> 行変数 (Group 1):',
        multiple: false
    });
    createVariableSelector('col-var-container', categoricalColumns, 'col-var', {
        label: '<i class="fas fa-columns"></i> 列変数 (Group 2):',
        multiple: false
    });

    createAnalysisButton('run-chi-btn-container', '検定を実行', () => runChiSquare(currentData), { id: 'run-chi-btn' });
}
