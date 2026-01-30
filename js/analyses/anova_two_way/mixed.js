/**
 * @fileoverview 二元配置分散分析（混合計画デザイン）モジュール
 * 被験者間因子と被験者内因子（反復測定）を含む分散分析を実行
 * @module anova_two_way/mixed
 */

import { generateAPATableHtml } from '../../utils.js';
import { getLevels, performSimpleMainEffectTests } from './helpers.js';
import { displayTwoWayANOVAInterpretation, renderTwoWayANOVAVisualization } from './independent.js';

// ======================================================================
// 混合計画ANOVAの主要分析関数
// ======================================================================

/**
 * 混合計画の二元配置分散分析を実行
 * @param {Object[]} currentData - 分析対象データ配列
 * @param {Array<{pre: string, post: string}>} pairs - 変数ペアの配列（被験者内要因）
 * @returns {Object[]} 分析結果の配列
 */
export function runTwoWayMixedANOVA(currentData, pairs) {
    const betweenVar = document.getElementById('mixed-between-var').value;

    if (!betweenVar) {
        alert('被験者間因子（グループ）を選択してください。');
        return [];
    }
    if (!pairs || pairs.length === 0) {
        alert('分析する変数ペア（観測変数・測定変数）を1つ以上追加してください。');
        return [];
    }

    // Clear and prepare results container
    const resultsContainer = document.getElementById('analysis-results');
    if (!document.getElementById('test-results-section')) {
        resultsContainer.innerHTML = `
            <div id="summary-stats-section"></div>
            <div id="test-results-section"></div>
            <div id="interpretation-section"></div>
            <div id="visualization-section"></div>
        `;
    } else {
        const sections = ['summary-stats-section', 'test-results-section', 'interpretation-section', 'visualization-section'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    const testResults = [];

    pairs.forEach((pair, index) => {
        const withinVars = [pair.pre, pair.post];

        // Filter valid data
        const validData = currentData.filter(d =>
            d[betweenVar] != null &&
            withinVars.every(v => d[v] != null && !isNaN(d[v]))
        );

        const nTotal = validData.length;
        const groups = getLevels(validData, betweenVar);
        const conditions = withinVars;
        const nGroups = groups.length;
        const nConditions = conditions.length;

        if (nGroups < 2) {
            console.warn(`Skipping pair ${pair.pre}-${pair.post}: Not enough groups.`);
            return;
        }

        // 1. Calculate Grand Mean
        const allValues = validData.flatMap(d => withinVars.map(v => d[v]));
        const grandMean = jStat.mean(allValues);
        const ssTotal = jStat.sum(allValues.map(v => Math.pow(v - grandMean, 2)));

        // 2. Between-Subjects Calculations
        const groupData = {};
        const groupMeans = {};
        const groupNs = {};

        groups.forEach(g => {
            const gRows = validData.filter(d => d[betweenVar] === g);
            const gValues = gRows.flatMap(d => withinVars.map(v => d[v]));
            groupData[g] = gRows;
            groupMeans[g] = jStat.mean(gValues);
            groupNs[g] = gRows.length;
        });

        let ssBetween = 0;
        groups.forEach(g => {
            ssBetween += groupNs[g] * nConditions * Math.pow(groupMeans[g] - grandMean, 2);
        });

        const subjectMeans = validData.map(d => jStat.mean(withinVars.map(v => d[v])));
        const ssSubjectsTotal = nConditions * jStat.sum(subjectMeans.map(m => Math.pow(m - grandMean, 2)));
        const ssErrorBetween = ssSubjectsTotal - ssBetween;

        // 3. Within-Subjects Calculations
        const conditionMeans = {};
        withinVars.forEach(v => {
            conditionMeans[v] = jStat.mean(validData.map(d => d[v]));
        });

        let ssWithin = 0;
        withinVars.forEach(v => {
            ssWithin += nTotal * Math.pow(conditionMeans[v] - grandMean, 2);
        });

        const cellStats = {};
        let ssCells = 0;

        groups.forEach(g => {
            cellStats[g] = {};
            withinVars.forEach(v => {
                const cellValues = groupData[g].map(d => d[v]);
                const mean = jStat.mean(cellValues);
                const n = cellValues.length;
                const std = jStat.stdev(cellValues, true);
                cellStats[g][v] = { mean, n, std };
                ssCells += n * Math.pow(mean - grandMean, 2);
            });
        });

        const ssInteraction = ssCells - ssBetween - ssWithin;
        const ssBroadWithin = ssTotal - ssSubjectsTotal;
        const ssErrorWithin = ssBroadWithin - ssWithin - ssInteraction;

        // 4. Degrees of Freedom
        const dfBetween = nGroups - 1;
        const dfErrorBetween = nTotal - nGroups;
        const dfWithin = nConditions - 1;
        const dfInteraction = dfBetween * dfWithin;
        const dfErrorWithin = dfErrorBetween * dfWithin;

        // 5. Mean Squares
        const msBetween = ssBetween / dfBetween;
        const msErrorBetween = ssErrorBetween / dfErrorBetween;
        const msWithin = ssWithin / dfWithin;
        const msInteraction = ssInteraction / dfInteraction;
        const msErrorWithin = ssErrorWithin / dfErrorWithin;

        // 6. F-ratios & P-values
        const fBetween = msBetween / msErrorBetween;
        const pBetween = 1 - jStat.centralF.cdf(fBetween, dfBetween, dfErrorBetween);

        const fWithin = msWithin / msErrorWithin;
        const pWithin = 1 - jStat.centralF.cdf(fWithin, dfWithin, dfErrorWithin);

        const fInteraction = msInteraction / msErrorWithin;
        const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfErrorWithin);

        // 7. Effect Sizes (Partial Eta Squared)
        const etaBetween = ssBetween / (ssBetween + ssErrorBetween);
        const etaWithin = ssWithin / (ssWithin + ssErrorWithin);
        const etaInteraction = ssInteraction / (ssInteraction + ssErrorWithin);

        // Perform Simple Main Effect Tests
        const resultSigPairs = performSimpleMainEffectTests(validData, betweenVar, 'conditions', 'value', 'mixed', withinVars);

        testResults.push({
            pairName: `${pair.pre} - ${pair.post}`,
            factorBetween: betweenVar,
            factorWithin: '条件(Time)',
            levelsBetween: groups,
            levelsWithin: withinVars,
            cellStats,
            sources: [
                { name: `被験者間: ${betweenVar}`, ss: ssBetween, df: dfBetween, ms: msBetween, f: fBetween, p: pBetween, eta: etaBetween },
                { name: '誤差(間)', ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null, eta: null },
                { name: `被験者内: 条件`, ss: ssWithin, df: dfWithin, ms: msWithin, f: fWithin, p: pWithin, eta: etaWithin },
                { name: `交互作用: ${betweenVar}×条件`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
                { name: '誤差(内)', ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null, eta: null }
            ],
            sigPairs: resultSigPairs
        });
    });

    if (testResults.length === 0) return [];

    renderTwoWayMixedANOVATable(testResults);
    displayTwoWayANOVAInterpretation(testResults, 'mixed');

    // Reuse visualization logic
    const vizResults = testResults.map(res => ({
        depVar: res.pairName,
        factor1: res.factorBetween,
        factor2: '条件',
        levels1: res.levelsBetween,
        levels2: res.levelsWithin,
        cellStats: res.cellStats,
        sigPairs: res.sigPairs
    }));
    renderTwoWayANOVAVisualization(vizResults);

    document.getElementById('analysis-results').style.display = 'block';

    return testResults;
}

// ======================================================================
// 結果テーブル描画
// ======================================================================

/**
 * 混合計画ANOVAの結果テーブルを描画
 * @param {Object[]} results - 分析結果配列
 */
export function renderTwoWayMixedANOVATable(results) {
    if (!results || results.length === 0) return;
    const container = document.getElementById('test-results-section');
    let tableHtml = '';

    results.forEach((res, index) => {
        tableHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-table"></i> 混合計画分散分析の結果 (${res.pairName})
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>変動要因 (Source)</th>
                            <th>平方和 (SS)</th>
                            <th>自由度 (df)</th>
                            <th>平均平方 (MS)</th>
                            <th>F値</th>
                            <th>p値</th>
                            <th>偏η²</th>
                        </tr>
                    </thead>
                    <tbody>`;

        res.sources.forEach(src => {
            const sig = src.p !== null ? (src.p < 0.01 ? '**' : src.p < 0.05 ? '*' : src.p < 0.1 ? '†' : '') : '';
            const pStr = src.p !== null ? src.p.toFixed(3) + sig : '-';
            const fStr = src.f !== null ? src.f.toFixed(2) : '-';
            const etaStr = src.eta !== null ? src.eta.toFixed(2) : '-';
            const msStr = src.ms.toFixed(2);

            tableHtml += `
            <tr>
                <td style="text-align: left; font-weight: 500;">${src.name}</td>
                <td>${src.ss.toFixed(2)}</td>
                <td>${src.df}</td>
                <td>${msStr}</td>
                <td>${fStr}</td>
                <td style="${src.p < 0.05 ? 'color: #e11d48; font-weight: bold;' : ''}">${pStr}</td>
                <td>${etaStr}</td>
            </tr>
        `;
        });

        tableHtml += `</tbody></table>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">p&lt;0.1† p&lt;0.05* p&lt;0.01**</p>
        </div></div>`;

        // Descriptive Stats Table
        tableHtml += `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
             <h4 style="color: #475569; margin-bottom: 1rem; font-size: 1.1rem; font-weight: bold;">
                平均値と標準偏差
            </h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>${res.factorBetween} (間)</th>
                            ${res.levelsWithin.map(l => `<th>${l} (内)</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>`;

        res.levelsBetween.forEach(l1 => {
            tableHtml += `<tr>
            <td style="font-weight: bold;">${l1}</td>`;
            res.levelsWithin.forEach(l2 => {
                const s = res.cellStats[l1][l2];
                tableHtml += `<td>${s.mean.toFixed(2)} (SD: ${s.std.toFixed(2)})</td>`;
            });
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table></div></div>`;

        // Generate APA Source Table
        const headersAPA = ["Source", "<em>SS</em>", "<em>df</em>", "<em>MS</em>", "<em>F</em>", "<em>p</em>", "&eta;<sub>p</sub><sup>2</sup>"];
        const rowsAPA = res.sources.map(src => {
            const sig = src.p !== null ? (src.p < 0.001 ? '< .001' : src.p.toFixed(3)) : '-';
            return [
                src.name,
                src.ss.toFixed(2),
                src.df,
                src.ms.toFixed(2),
                src.f !== null ? src.f.toFixed(2) : '-',
                sig,
                src.eta !== null ? src.eta.toFixed(2) : '-'
            ];
        });

        tableHtml += `
        <div style="margin-bottom: 2rem;">
                <h5 style="font-size: 1.1rem; color: #4b5563; margin-bottom: 0.5rem;"><i class="fas fa-file-alt"></i> 論文報告用テーブル (APAスタイル風)</h5>
                <div>${generateAPATableHtml(`anova-mixed-apa-${index}`, `Table 1. Mixed Design ANOVA Source Table (${res.pairName})`, headersAPA, rowsAPA, `<em>Note</em>. Effect size is partial eta-squared.`)}</div>
        </div>
    `;
    });

    container.innerHTML = tableHtml;
}
