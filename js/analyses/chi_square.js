/**
 * @fileoverview カイ二乗検定（独立性の検定）
 * @module chi_square
 * @description クロス集計表を用いた変数間の関連性検定
 */

import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, createVisualizationControls, getTategakiAnnotation, getBottomTitleAnnotation, InterpretationHelper, generateAPATableHtml, getAcademicLayout, academicColors, buildContingencyTable, calculateResidualPValues, formatPValue, getSignificanceSymbol } from '../utils.js';

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

    const {
        rowKeys,
        colKeys,
        observed,
        rowTotals,
        colTotals,
        expected,
        total,
        excludedRows
    } = buildContingencyTable(currentData, rowVar, colVar);

    if (rowKeys.length < 2 || colKeys.length < 2) {
        alert('カイ二乗検定には、両方の変数で2つ以上の有効なカテゴリが必要です。欠損値とカテゴリを確認してください。');
        return;
    }

    // Pearsonのカイ二乗統計量。2×2では効果量と補正なし参考値に用いる。
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
    const residualPValues = calculateResidualPValues(adjResiduals);

    // Assumption Check: Expected Frequency < 5
    const expectedValues = expected.flat();
    const cellsCount = expectedValues.length;
    const smallExpCount = expectedValues.filter(exp => exp < 5).length;
    const smallExpRate = (smallExpCount / cellsCount) * 100;
    const minExpected = Math.min(...expectedValues);

    // Yates' Continuity Correction (Only for 2x2) and Odds Ratio
    let yatesChiSquare = null;
    let yatesPValue = null;
    let oddsRatio = null;

    if (rowKeys.length === 2 && colKeys.length === 2) {
        let yatesSum = 0;
        expected.forEach((row, i) => {
            row.forEach((exp, j) => {
                if (exp > 0) {
                    const correctedDifference = Math.max(0, Math.abs(observed[i][j] - exp) - 0.5);
                    yatesSum += Math.pow(correctedDifference, 2) / exp;
                }
            });
        });
        yatesChiSquare = yatesSum;
        yatesPValue = 1 - jStat.chisquare.cdf(yatesChiSquare, df);

        // オッズ比の計算 (O11 * O22) / (O12 * O21)
        const a = observed[0][0];
        const b = observed[0][1];
        const c = observed[1][0];
        const d = observed[1][1];

        if (b * c !== 0) {
            oddsRatio = (a * d) / (b * c);
        }
    }

    const is2x2 = rowKeys.length === 2 && colKeys.length === 2;
    const reportedChiSquare = is2x2 ? yatesChiSquare : chiSquare;
    const reportedPValue = is2x2 ? yatesPValue : pValue;

    displayChiSquareResult(
        reportedChiSquare,
        df,
        reportedPValue,
        cramersV,
        rowKeys,
        colKeys,
        observed,
        expected,
        adjResiduals,
        residualPValues,
        rowVar,
        colVar,
        smallExpRate,
        minExpected,
        chiSquare,
        pValue,
        is2x2,
        oddsRatio,
        excludedRows
    );

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

    const pText = formatPValue(reportedPValue, { includeP: false, html: true });
    const methodText = is2x2
        ? `Yates continuity-corrected &chi;<sup>2</sup>(1, <em>N</em> = ${total}) = ${reportedChiSquare.toFixed(2)}, <em>p</em> ${pText}; uncorrected Pearson &chi;<sup>2</sup> = ${chiSquare.toFixed(2)}`
        : `&chi;<sup>2</sup>(${df}, <em>N</em> = ${total}) = ${reportedChiSquare.toFixed(2)}, <em>p</em> ${pText}`;
    const noteAPA = `<em>Note</em>. Values are N (Row %). ${methodText}, Cramer's <em>V</em> = ${cramersV.toFixed(2)}.`;

    setTimeout(() => {
        const container = document.getElementById('reporting-table-container-chi');
        if (container) {
            container.innerHTML = generateAPATableHtml('chi-apa-table', `Table 1. Crosstabulation of ${rowVar} by ${colVar}`, headersAPA, rowsAPA, noteAPA);
        }
    }, 0);
}

function displayChiSquareResult(chi2, df, p, v, rowKeys, colKeys, observed, expected, adjResiduals, residualPValues, rowVar, colVar, smallExpRate, minExpected, pearsonChi, pearsonP, isYatesPrimary, oddsRatio, excludedRows) {
    const container = document.getElementById('chi-results');
    const omnibusSignificant = p < 0.05;

    // Warning for Assumption
    let warningHtml = '';
    if (minExpected < 1 || smallExpRate > 20) {
        const assumptionDetails = [
            minExpected < 1 ? `最小期待度数が1未満です（${minExpected.toFixed(2)}）` : '',
            smallExpRate > 20 ? `期待度数5未満のセルが${smallExpRate.toFixed(1)}%あります` : ''
        ].filter(Boolean).join('。');
        warningHtml = `
            <div style="background-color: #fffbe6; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; color: #92400e;">
                <strong><i class="fas fa-exclamation-triangle"></i> カイ二乗近似の前提を確認してください。</strong><br>
                ${assumptionDetails}。一般的な目安（期待度数1未満のセルなし、5未満のセルが20%以下）を満たしていません。<br>
                サンプルサイズを増やすか、「フィッシャーの正確確率検定」の使用を検討してください。
            </div>`;
    }
    if (excludedRows > 0) {
        warningHtml += `
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 0.8rem 1rem; border-radius: 8px; margin-bottom: 1rem; color: #1e3a8a;">
                2変数のどちらかが欠損している ${excludedRows} 行を除外し、有効ケースで分析しました。
            </div>`;
    }

    // 1. 記述統計（クロス集計表と残差分析）
    let html = warningHtml + `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-table"></i> クロス集計表と残差分析
            </h4>
            <div class="table-container">
                <table class="table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="text-align: left;">${rowVar} \\ ${colVar}</th>
                            ${colKeys.map(c => `<th style="text-align: center;">${c}</th>`).join('')}
                            <th style="text-align: center;">合計</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // テーブル本体
    rowKeys.forEach((r, i) => {
        html += `<tr><td style="text-align: left;"><strong>${r}</strong></td>`;
        let rowSum = 0;
        colKeys.forEach((c, j) => {
            const obs = observed[i][j];
            const exp = expected[i][j];
            const res = adjResiduals[i][j];
            const residualP = residualPValues[i][j];
            rowSum += obs;

            // 全体検定とセルごとの多重性を踏まえて色付けする。
            let style = '';
            if (omnibusSignificant && residualP.adjusted < 0.05 && res > 0) style = 'background: #dbeafe; color: #1e40af; font-weight: bold;';
            else if (omnibusSignificant && residualP.adjusted < 0.05 && res < 0) style = 'background: #fee2e2; color: #991b1b; font-weight: bold;';
            else if (residualP.raw < 0.05) style = 'background: #fef3c7; color: #92400e; font-weight: bold;';

            html += `
                <td style="${style}">
                    <div>${obs} <span style="font-size:0.8em; color:#666;">(${exp.toFixed(1)})</span></div>
                    <div style="font-size:0.8em;">z=${res.toFixed(1)}</div>
                    <div style="font-size:0.72em; color:#64748b;">${residualP.method === 'holm' ? 'p<sub>Holm</sub>' : 'p<sub>cell</sub>'}${formatPValue(residualP.adjusted, { includeP: false, html: true })}</div>
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
                上段: 観測度数 (期待度数), 下段: 調整済み標準化残差 (z) とセルp値。<br>
                ${omnibusSignificant
                    ? (isYatesPrimary
                        ? '2×2表のセルp値が .05 未満の多い組み合わせを青、少ない組み合わせを赤で示します。'
                        : 'Holm補正後のセルp値が .05 未満の多い組み合わせを青、少ない組み合わせを赤で示します。未補正でのみ .05 未満のセルは黄色です。')
                    : '全体検定が5%水準で有意でないため、セルの未補正p値が .05 未満でも有意な偏りとは断定しません。該当セルは黄色で探索的な目安として示します。'}
            </p>
        </div>
    `;

    // 2. 検定結果の統合テーブル・統計量一覧
    let referenceHtml = '';
    let orHtml = '';
    if (isYatesPrimary) {
        referenceHtml = `
            <div class="data-stat-card" style="background: #f8fafc; border: 1px solid #cbd5e1; text-align: center;">
                <div class="stat-label">Pearson χ²（補正なし・参考）</div>
                <div class="stat-value">${pearsonChi.toFixed(2)}</div>
                <div class="stat-sub" style="font-size: 0.8rem; color: #666;">${formatPValue(pearsonP, { html: true, digits: 4 })} ${getSignificanceSymbol(pearsonP)}</div>
            </div>
        `;
        if (oddsRatio !== null) {
            orHtml = `
                <div class="data-stat-card" style="text-align: center;">
                    <div class="stat-label">オッズ比 (OR)</div>
                    <div class="stat-value">${oddsRatio.toFixed(3)}</div>
                </div>
            `;
        }
    }

    html += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                <i class="fas fa-clipboard-check"></i> 検定結果
            </h4>
            <div class="data-stats-grid" style="justify-items: center;">
                <div class="data-stat-card" style="text-align: center;${isYatesPrimary ? ' background: #f0f9ff; border: 2px solid #7dd3fc;' : ''}">
                    <div class="stat-label">カイ二乗値 (χ²)${isYatesPrimary ? '・Yates補正' : ''}</div>
                    <div class="stat-value">${chi2.toFixed(2)}</div>
                    ${isYatesPrimary ? '<div class="stat-sub" style="font-size: 0.8rem; color: #475569;">2×2の主結果</div>' : ''}
                </div>
                <div class="data-stat-card" style="text-align: center;">
                    <div class="stat-label">自由度 (df)</div>
                    <div class="stat-value">${df}</div>
                </div>
                <div class="data-stat-card" style="text-align: center;">
                    <div class="stat-label">p値</div>
                    <div class="stat-value" style="${p < 0.05 ? 'color: #ef4444;' : ''}">${p < 0.001 ? '&lt; .001' : p.toFixed(4)} ${getSignificanceSymbol(p)}</div>
                </div>
                <div class="data-stat-card" style="text-align: center;">
                    <div class="stat-label">${rowKeys.length === 2 && colKeys.length === 2 ? 'ファイ係数 (φ) / CramerのV' : 'クラメールのV'}</div>
                    <div class="stat-value">${v.toFixed(3)}</div>
                </div>
                ${orHtml}
                ${referenceHtml}
            </div>
            ${isYatesPrimary ? '<p style="margin: 1rem 0 0; color: #64748b; font-size: 0.85rem;">2×2表ではYatesの連続性補正を主結果として表示します。補正なしPearson値は比較用です。効果量φ / CramerのVは補正なしχ²から算出します。</p>' : ''}
        </div>
    `;

    // 3. 解釈のアシスト
    html += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-comment-dots"></i> 結果の解釈
            </h4>
            <div style="line-height: 1.6;">
                ${(() => { try { return InterpretationHelper.interpretChiSquare(p, v, rowVar, colVar); } catch (e) { console.error('Interpretation Error:', e); return '結果の解釈中にエラーが発生しました。'; } })()}
            </div>
        </div>
    `;

    // 4. 詳細な図表
    html += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-file-alt"></i> 結果の詳細テーブル・図
            </h4>
            <div style="margin-top: 1.5rem;">
               <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
               <div id="reporting-table-container-chi"></div>
            </div>
            
            <div id="heatmap-plot" style="margin-top: 2rem;"></div>
        </div>
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
        colorscale: academicColors.heatmapScale
    }];

    const layout = getAcademicLayout({
        title: '',
        xaxis: { title: colVar },
        yaxis: { title: '' },
        margin: { l: 100, b: 150 },
        annotations: []
    });

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

    container.innerHTML = String.raw`
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
                        <li><strong>残差分析:</strong> 全体検定で関連が見られた場合に、「思ったより多かった（または少なかった）」組み合わせを確認します。全体検定が非有意の場合は、参考情報として扱います。</li>
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
                            <li><strong>残差分析:</strong> 調整済み標準化残差 (Adjusted Standardized Residuals) を算出。全体検定が有意な場合に、絶対値が1.96を超えるセルを偏りの大きい組み合わせとして確認します。全体検定が非有意の場合は探索的な目安として扱います。</li>
                            <li>※ 2×2分割表の場合、イェーツの連続性補正を適用しています。</li>
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
