import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig, renderSampleSizeInfo } from '../utils.js';

// Pairwise t-test helper for Between-Subjects (Independent)
function performPostHocTests(groups, groupData) {
    const pairs = [];
    const numGroups = groups.length;
    // Number of comparisons for Bonferroni
    const numComparisons = (numGroups * (numGroups - 1)) / 2;

    for (let i = 0; i < numGroups; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            const g1 = groups[i];
            const g2 = groups[j];
            const d1 = groupData[g1];
            const d2 = groupData[g2];

            if (d1.length < 2 || d2.length < 2) continue;

            const n1 = d1.length;
            const n2 = d2.length;
            const mean1 = jStat.mean(d1);
            const mean2 = jStat.mean(d2);
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);
            const var1 = std1 * std1;
            const var2 = std2 * std2;

            // Welch's t-test
            const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
            const t_stat = (mean1 - mean2) / se_welch;

            // Welch-Satterthwaite df
            const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
            const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
            const df = df_num / df_den;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;

            // Bonferroni correction
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1, g2,
                p: p_adj,
                mean1, mean2,
                std1, std2,
                n1, n2
            });
        }
    }
    return pairs;
}

// Pairwise t-test helper for Within-Subjects (Repeated)
function performRepeatedPostHocTests(dependentVars, currentData) {
    const pairs = [];
    const numVars = dependentVars.length;
    const numComparisons = (numVars * (numVars - 1)) / 2;

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = dependentVars[i];
            const var2 = dependentVars[j];

            // Extract pairs where both are present
            const validPairs = currentData
                .map(row => ({ v1: row[var1], v2: row[var2] }))
                .filter(p => p.v1 != null && !isNaN(p.v1) && p.v2 != null && !isNaN(p.v2));

            if (validPairs.length < 2) continue;

            const n = validPairs.length;
            const values1 = validPairs.map(p => p.v1);
            const values2 = validPairs.map(p => p.v2);
            const mean1 = jStat.mean(values1);
            const mean2 = jStat.mean(values2);

            // Paired t-test calculation
            const diffs = validPairs.map(p => p.v1 - p.v2);
            const diffMean = jStat.mean(diffs);
            const diffStd = jStat.stdev(diffs, true);
            const se = diffStd / Math.sqrt(n);
            const t_stat = diffMean / se;
            const df = n - 1;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1: var1,
                g2: var2,
                p: p_adj,
                mean1, mean2,
                n
            });
        }
    }
    return pairs;
}


// ----------------------------------------------------------------------
// One-Way ANOVA (Between-Subjects)
// ----------------------------------------------------------------------
function runOneWayIndependentANOVA(currentData) {
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

    const groups = [...new Set(currentData.map(row => row[factorVar]))].filter(v => v != null).sort();
    if (groups.length < 2) { // Changed to 2 for consistency, though ANOVA needs 3. Alert is more specific.
        alert(`一要因分散分析には3群以上必要ですが、現在は ${groups.length} 群です。t検定をお勧めします。`);
        if (groups.length < 3) return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    const results = [];
    dependentVars.forEach(depVar => {
        const groupData = {};
        let totalN = 0;
        groups.forEach(g => {
            const dataForGroup = currentData
                .filter(row => row[factorVar] === g)
                .map(row => row[depVar])
                .filter(v => v != null && !isNaN(v));
            groupData[g] = dataForGroup;
            totalN += dataForGroup.length;
        });

        const allValues = Object.values(groupData).flat();
        if (allValues.length === 0) return;

        const grandMean = jStat.mean(allValues);
        let ssBetween = 0;
        let ssWithin = 0;
        groups.forEach(g => {
            const vals = groupData[g];
            const n = vals.length;
            const mean = jStat.mean(vals);
            if (n > 0) {
                ssBetween += n * Math.pow(mean - grandMean, 2);
                ssWithin += vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
            }
        });

        const dfBetween = groups.length - 1;
        const dfWithin = totalN - groups.length;

        if (dfWithin <= 0) return; 

        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        const fValue = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);

        const ssTotal = ssBetween + ssWithin;
        const etaSquared = ssBetween / ssTotal;
        const omegaSquared = (ssBetween - (dfBetween * msWithin)) / (ssTotal + msWithin);

        const overallMean = grandMean;
        const overallStd = jStat.stdev(allValues, true);
        const groupMeans = groups.map(g => jStat.mean(groupData[g]));
        const groupStds = groups.map(g => jStat.stdev(groupData[g], true));

        let sign = 'n.s.';
        if (pValue < 0.01) sign = '**';
        else if (pValue < 0.05) sign = '*';
        else if (pValue < 0.1) sign = '†';

        results.push({
            depVar,
            overallMean,
            overallStd,
            groupMeans,
            groupStds,
            dfBetween,
            dfWithin,
            fValue,
            pValue,
            sign,
            etaSquared,
            omegaSquared
        });
    });

    if (results.length === 0) {
        outputContainer.innerHTML = '<p>分析対象のデータがありませんでした。</p>';
        document.getElementById('analysis-results').style.display = 'block';
        return;
    }

    const headers = ['変数', '全体M', '全体S.D', ...groups.map(g => `${g} M`), ...groups.map(g => `${g} S.D`), '群間<br>自由度', '群内<br>自由度', 'F', 'p', 'sign', 'η²', 'ω²'];
    
    let tableHtml = `<div class="table-container">
        <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">平均値の差の検定（対応なし）</h4>
        <table class="table">
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
    `;

    results.forEach(res => {
        const rowData = [
            res.depVar,
            res.overallMean,
            res.overallStd,
            ...res.groupMeans,
            ...res.groupStds,
            res.dfBetween,
            res.dfWithin,
            res.fValue,
            res.pValue,
            res.sign,
            res.etaSquared,
            res.omegaSquared
        ];
        tableHtml += `<tr>${rowData.map((d, i) => {
            if (i === 0 || i === headers.indexOf('sign')) { // Variable name and sign
                return `<td>${d}</td>`;
            }
            if(typeof d === 'number') {
                return `<td>${d.toFixed(2)}</td>`;
            }
            return `<td>${d || ''}</td>`;
        }).join('')}</tr>`;
    });

    tableHtml += `
            </tbody>
        </table>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p>
    </div>`;

    outputContainer.innerHTML = tableHtml;
    document.getElementById('analysis-results').style.display = 'block';
}

// Helper: Interpretation
function displayANOVADescription(varName, F, df1, df2, p, eta, groups, groupData, targetId) {
    const containerId = targetId || 'interpretation-section';
    const container = document.getElementById(containerId);

    if (!container) return; // safety

    if (containerId === 'interpretation-section' && !container.innerHTML) {
        // Only create header wrapper if using the global section
        container.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-lightbulb"></i> 解釈の補助
                </h4>
                <div id="interpretation-content" style="padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
            </div>
        `;
    }

    let sigText = "";
    if (p < 0.05) sigText = "統計的に有意な差が見られました。";
    else sigText = "統計的に有意な差は見られませんでした。";

    // If using specific target, write directly. If global, append to #interpretation-content.
    if (targetId) {
        container.innerHTML = `
            <div style="padding: 1rem; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                <strong><i class="fas fa-lightbulb" style="color:#1e90ff"></i> 解釈: ${varName}</strong><br>
                F(${df1}, ${df2}) = ${F.toFixed(2)}, p = ${p.toFixed(3)}, η² = ${eta.toFixed(2)}.<br>
                結果：<strong>${sigText}</strong><br>
                ${p < 0.05 ? '<span style="font-size:0.9em; color:#666;">※ どの群間に差があるかは、下のグラフのブラケットや注釈を確認してください。</span>' : ''}
            </div>
        `;
    } else {
        const content = document.getElementById('interpretation-content');
        content.innerHTML += `
            <p style="margin: 0.5rem 0; padding: 0.75rem; background: white; border-left: 4px solid #1e90ff; border-radius: 4px;">
                <strong style="color: #1e90ff;">${varName}</strong>について：<br>
                F(${df1}, ${df2}) = ${F.toFixed(2)}, p = ${p.toFixed(3)}, η² = ${eta.toFixed(2)}.<br>
                結果：<strong>${sigText}</strong><br>
                ${p < 0.05 ? '<span style="font-size:0.9em; color:#666;">※ どの群間に差があるかは、事後検定の結果（グラフのブラケットや注釈）を確認してください。</span>' : ''}
            </p>
        `;
    }
}


// ----------------------------------------------------------------------
// One-Way Repeated Measures ANOVA (Within-Subjects)
// ----------------------------------------------------------------------
function runOneWayRepeatedANOVA(currentData) {
    const dependentVarSelect = document.getElementById('rep-dependent-var');
    const dependentVars = Array.from(dependentVarSelect.selectedOptions).map(o => o.value);

    if (dependentVars.length < 3) {
        alert('対応あり分散分析には3つ以上の変数（条件）が必要です');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    const validData = currentData
        .map(row => dependentVars.map(v => row[v]))
        .filter(vals => vals.every(v => v != null && !isNaN(v)));

    const N = validData.length;
    const k = dependentVars.length;

    if (N < 2) {
        alert('有効なデータ（全条件が揃っている行）が不足しています');
        document.getElementById('analysis-results').style.display = 'block';
        return;
    }

    const grandMean = jStat.mean(validData.flat());
    let ssTotal = 0;
    validData.flat().forEach(v => ssTotal += Math.pow(v - grandMean, 2));
    
    let ssSubjects = 0;
    validData.forEach(subjectVals => {
        ssSubjects += k * Math.pow(jStat.mean(subjectVals) - grandMean, 2);
    });
    
    let ssConditions = 0;
    const conditionMeans = [];
    for (let i = 0; i < k; i++) {
        const colVals = validData.map(row => row[i]);
        const colMean = jStat.mean(colVals);
        conditionMeans.push(colMean);
        ssConditions += N * Math.pow(colMean - grandMean, 2);
    }
    
    const ssError = ssTotal - ssSubjects - ssConditions;
    const dfSubjects = N - 1;
    const dfConditions = k - 1;
    const dfError = (N - 1) * (k - 1);

    if (dfError <= 0) {
        alert('誤差の自由度が0以下です。計算を実行できません。');
        document.getElementById('analysis-results').style.display = 'block';
        return;
    }

    const msConditions = ssConditions / dfConditions;
    const msError = ssError / dfError;
    const fValue = msConditions / msError;
    const pValue = 1 - jStat.centralF.cdf(fValue, dfConditions, dfError);
    
    const etaSquaredPartial = ssConditions / (ssConditions + ssError);
    const omegaSquared = (ssConditions - (dfConditions * msError)) / (ssTotal + msError);

    const overallMean = grandMean;
    const overallStd = jStat.stdev(validData.flat(), true);
    const conditionStds = dependentVars.map((_, i) => jStat.stdev(validData.map(row => row[i]), true));

    let sign = 'n.s.';
    if (pValue < 0.01) sign = '**';
    else if (pValue < 0.05) sign = '*';
    else if (pValue < 0.1) sign = '†';

    const factorName = dependentVars.join(' vs ');
    const headers = ['要因', '全体M', '全体S.D', ...dependentVars.map(v => `${v} M`), ...dependentVars.map(v => `${v} S.D`), '条件<br>自由度', '誤差<br>自由度', 'F', 'p', 'sign', 'ηp²', 'ω²'];
    
    const rowData = [
        factorName,
        overallMean,
        overallStd,
        ...conditionMeans,
        ...conditionStds,
        dfConditions,
        dfError,
        fValue,
        pValue,
        sign,
        etaSquaredPartial,
        omegaSquared
    ];

    let tableHtml = `<div class="table-container">
        <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">平均値の差の検定（対応あり）</h4>
        <table class="table">
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                <tr>${rowData.map((d, i) => {
                    if (i === 0 || i === headers.indexOf('sign')) { // Factor name and sign
                        return `<td>${d}</td>`;
                    }
                    if(typeof d === 'number') {
                        return `<td>${d.toFixed(2)}</td>`;
                    }
                    return `<td>${d || ''}</td>`;
                }).join('')}</tr>
            </tbody>
        </table>
        <p style="font-size: 0.9em; text-align: right; margin-top: 0.5rem;">sign: p<0.01** p<0.05* p<0.1†</p>
    </div>`;

    outputContainer.innerHTML = tableHtml;
    document.getElementById('analysis-results').style.display = 'block';
}


// ----------------------------------------------------------------------
// Main Render
// ----------------------------------------------------------------------
function switchTestType(testType) {
    const indControls = document.getElementById('independent-controls');
    const repControls = document.getElementById('repeated-controls');
    if (testType === 'independent') {
        indControls.style.display = 'block';
        repControls.style.display = 'none';
    } else {
        indControls.style.display = 'none';
        repControls.style.display = 'block';
    }
    document.getElementById('analysis-results').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
    <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-sitemap"></i> 一要因分散分析 (One-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">3群以上の平均値の差を検定します</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <!-- ... existing content ... -->
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 一要因分散分析とは？</strong>
                        <p>3つ以上のグループ（群）または条件間で平均値に差があるかを調べます。</p>
                        <p>例：クラスA、B、Cでテストの平均点に差があるか？</p>
                    </div>
                </div>
            </div>

            <div id="anova-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                
                <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem;">
                        <label style="flex: 1; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-type" value="independent" checked>
                            <strong>対応なし（独立測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">異なる被験者グループ間を比較</p>
                        </label>
                        <label style="flex: 1; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova-type" value="repeated">
                            <strong>対応あり（反復測度）</strong>
                            <p style="margin: 0.5rem 0 0 0; color: #6b7280; font-size: 0.9rem;">同じ被験者の異なる条件間を比較</p>
                        </label>
                    </div>
                </div>

                <div id="independent-controls" style="display: block;">
                    <div id="factor-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-ind-btn-container"></div>
                </div>

                <div id="repeated-controls" style="display: none;">
                    <div id="rep-dependent-var-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                    <div id="run-rep-btn-container"></div>
                </div>
            </div>

            <div id="analysis-results" style="display: none;">
                <!-- 結果エリア -->
                <div id="anova-results"></div>
                
                <!-- 解釈の補助セクション (追加) -->
                <div id="interpretation-section" style="margin-top: 2rem;"></div>
            </div>
    </div>
    `;

    renderDataOverview('#anova-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('factor-var-container', categoricalColumns, 'factor-var', {
        label: '<i class="fas fa-layer-group"></i> 要因（グループ変数・3群以上）:',
        multiple: false
    });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', {
        label: '<i class="fas fa-check-square"></i> 従属変数を選択（複数可）:',
        multiple: true
    });
    createAnalysisButton('run-ind-btn-container', '分析を実行（対応なし）', () => runOneWayIndependentANOVA(currentData), { id: 'run-ind-anova-btn' });

    createVariableSelector('rep-dependent-var-container', numericColumns, 'rep-dependent-var', {
        label: '<i class="fas fa-list-ol"></i> 比較する変数（条件）を選択（3つ以上）:',
        multiple: true
    });
    createAnalysisButton('run-rep-btn-container', '分析を実行（対応あり）', () => runOneWayRepeatedANOVA(currentData), { id: 'run-rep-anova-btn' });

    document.querySelectorAll('input[name="anova-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            document.querySelectorAll('input[name="anova-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
        });
    });
}