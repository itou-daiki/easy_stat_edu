import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo, createPlotlyConfig } from '../utils.js';

// ======================================================================
// Helper Functions for Transformations & Stats
// ======================================================================

// Helper: Get unique sorted values (levels)
function getLevels(data, varName) {
    return [...new Set(data.map(d => d[varName]))].filter(v => v != null).sort();
}

// Helper: Perform Post-Hoc Tests (Bonferroni corrected Student's t-test for simplicity, approximating Tukey)
// Real Tukey is complex to implement in pure JS. We use Bonferroni adjusted T-tests as a robust alternative.
// Returns array of { g1, g2, p, ... }
function performPostHocTests(groups, groupData) {
    const pairs = [];
    const numGroups = groups.length;
    const numComparisons = (numGroups * (numGroups - 1)) / 2;

    for (let i = 0; i < numGroups; i++) {
        for (let j = i + 1; j < numGroups; j++) {
            const g1 = groups[i];
            const g2 = groups[j];
            const d1 = groupData[g1];
            const d2 = groupData[g2];

            if (!d1 || !d2 || d1.length < 2 || d2.length < 2) continue;

            const n1 = d1.length;
            const n2 = d2.length;
            const mean1 = jStat.mean(d1);
            const mean2 = jStat.mean(d2);
            const std1 = jStat.stdev(d1, true);
            const std2 = jStat.stdev(d2, true);
            const var1 = std1 * std1;
            const var2 = std2 * std2;

            // Welch's t-test
            // (Reference Python uses Tukey HSD which assumes equal variance, but Welch is safer)
            const se_welch = Math.sqrt(var1 / n1 + var2 / n2);
            const t_stat = (mean1 - mean2) / se_welch;

            const df_num = Math.pow(var1 / n1 + var2 / n2, 2);
            const df_den = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);
            const df = df_num / df_den;

            let p_raw = jStat.studentt.cdf(-Math.abs(t_stat), df) * 2;
            let p_adj = Math.min(1, p_raw * numComparisons);

            pairs.push({
                g1, g2, p: p_adj,
                mean1, mean2,
                std1, std2,
                n1, n2
            });
        }
    }
    return pairs;
}

// Helper: Create Brackets Logic
// logic adapted from reference Python script
function generateBrackets(sigPairs, groups, groupStats, plotRefStep, yOffsetBase) {
    const shapes = [];
    const annotations = [];
    const levels = [];
    const step = plotRefStep;

    // Sort pairs by distance (narrower first)
    sigPairs.sort((a, b) => {
        const distA = Math.abs(groups.indexOf(a.g1) - groups.indexOf(a.g2));
        const distB = Math.abs(groups.indexOf(b.g1) - groups.indexOf(b.g2));
        return distA - distB;
    });

    sigPairs.forEach(pair => {
        if (pair.p >= 0.1) return;

        const idx1 = groups.indexOf(pair.g1);
        const idx2 = groups.indexOf(pair.g2);
        if (idx1 === -1 || idx2 === -1) return;

        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);

        let levelIndex = 0;
        while (true) {
            if (!levels[levelIndex]) levels[levelIndex] = [];
            // Check overlap with margin
            const overlap = levels[levelIndex].some(interval => (start < interval.end + 0.5) && (end > interval.start - 0.5));
            if (!overlap) break;
            levelIndex++;
        }
        levels[levelIndex].push({ start, end });

        // Base Y: max value of relevant bars + stat error
        // Simplified: use provided base offset + level * step
        // To be more precise like Python script: find max Y between the two bars being compared
        const stats1 = groupStats[pair.g1];
        const stats2 = groupStats[pair.g2];
        const yBase1 = stats1.mean + stats1.se;
        const yBase2 = stats2.mean + stats2.se;

        // Dynamic bottom for the bracket
        const yVlineBottom = Math.max(yBase1, yBase2) + yOffsetBase * 0.5; // smaller gap above bar
        const bracketY = yVlineBottom + (levelIndex * step) + yOffsetBase * 0.5;

        // Visual Props
        let text = 'n.s.';
        if (pair.p < 0.01) text = '**';
        else if (pair.p < 0.05) text = '*';
        else if (pair.p < 0.1) text = '†';

        // Draw Bracket
        // Left V-line
        shapes.push({ type: 'line', x0: idx1, y0: yVlineBottom, x1: idx1, y1: bracketY, line: { color: 'black', width: 1 } });
        // Horizontal
        shapes.push({ type: 'line', x0: idx1, y0: bracketY, x1: idx2, y1: bracketY, line: { color: 'black', width: 1 } });
        // Right V-line
        shapes.push({ type: 'line', x0: idx2, y0: bracketY, x1: idx2, y1: yVlineBottom, line: { color: 'black', width: 1 } });

        // Annotation
        annotations.push({
            x: (idx1 + idx2) / 2,
            y: bracketY + step * 0.2, // slightly above
            text: text === 'n.s.' ? '' : `p < ${pair.p.toFixed(3)} ${text}`, // Python script shows "p < 0.01 **", here we simplify
            text: text, // Just star? Python ref: f'p < {p_value:.2f} {significance}'
            text: `p < ${pair.p.toFixed(3)} ${text}`,
            showarrow: false,
            font: { size: 10, color: 'black' }
        });
    });

    return { shapes, annotations, totalLevels: levels.length };
}


// ======================================================================
// Two-Way ANOVA: Between-Subjects (Independent)
// ======================================================================
function runTwoWayIndependentANOVA(currentData) {
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
            // Extract valid data
            const validData = currentData.map(row => ({
                f1: row[factor1],
                f2: row[factor2],
                val: row[depVar]
            })).filter(d => d.f1 != null && d.f2 != null && d.val != null && !isNaN(d.val));

            const levels1 = getLevels(validData, 'f1');
            const levels2 = getLevels(validData, 'f2');
            const n = validData.length;

            if (levels1.length < 2 || levels2.length < 2) {
                console.warn(`Insufficient levels for ${depVar}`);
                return;
            }

            // ANOVA Calculation (Type I/II approx)
            const meanTotal = jStat.mean(validData.map(d => d.val));
            const ssTotal = validData.reduce((sum, d) => sum + Math.pow(d.val - meanTotal, 2), 0);

            // SS_Cells
            let ssCells = 0;
            const interactionGroups = [];
            const groupData = {};

            levels1.forEach(l1 => {
                levels2.forEach(l2 => {
                    const sub = validData.filter(d => d.f1 === l1 && d.f2 === l2).map(d => d.val);
                    if (sub.length > 0) {
                        const m = jStat.mean(sub);
                        ssCells += sub.length * Math.pow(m - meanTotal, 2);

                        const groupKey = `${l1}_${l2}`; // Simplified key
                        interactionGroups.push(groupKey);
                        groupData[groupKey] = sub;
                    }
                });
            });

            // SS_A, SS_B
            let ssA = 0;
            levels1.forEach(l1 => {
                const sub = validData.filter(d => d.f1 === l1).map(d => d.val);
                ssA += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });
            let ssB = 0;
            levels2.forEach(l2 => {
                const sub = validData.filter(d => d.f2 === l2).map(d => d.val);
                ssB += sub.length * Math.pow(jStat.mean(sub) - meanTotal, 2);
            });

            const ssAxB = ssCells - ssA - ssB;
            const ssError = ssTotal - ssCells;

            const dfA = levels1.length - 1;
            const dfB = levels2.length - 1;
            const dfAxB = dfA * dfB;
            const dfError = n - (levels1.length * levels2.length);

            const msA = ssA / dfA;
            const msB = ssB / dfB;
            const msAxB = ssAxB / dfAxB;
            const msError = ssError / dfError;

            const fA = msA / msError;
            const fB = msB / msError;
            const fAxB = msAxB / msError;

            const pA = 1 - jStat.centralF.cdf(fA, dfA, dfError);
            const pB = 1 - jStat.centralF.cdf(fB, dfB, dfError);
            const pAxB = 1 - jStat.centralF.cdf(fAxB, dfAxB, dfError);

            const etaA = ssA / (ssA + ssError);
            const etaB = ssB / (ssB + ssError);
            const etaAxB = ssAxB / (ssAxB + ssError);

            // Output Table
            renderANOVAOutput(outputContainer, depVar, 'Independent', {
                factors: [factor1, factor2],
                rows: [
                    { name: `${factor1}`, ss: ssA, df: dfA, ms: msA, f: fA, p: pA, eta: etaA },
                    { name: `${factor2}`, ss: ssB, df: dfB, ms: msB, f: fB, p: pB, eta: etaB },
                    { name: `交互作用`, ss: ssAxB, df: dfAxB, ms: msAxB, f: fAxB, p: pAxB, eta: etaAxB },
                    { name: `誤差`, ss: ssError, df: dfError, ms: msError, f: null, p: null }
                ],
                // Data for plotting
                plotData: {
                    interactionGroups,
                    groupData,
                    xlabel: "Interaction", // Generic X label logic
                    depVar
                }
            });

        } catch (e) {
            console.error(e);
            outputContainer.innerHTML += `<p class="error">エラー (${depVar}): 計算できませんでした</p>`;
        }
    });

    document.getElementById('analysis-results').style.display = 'block';
}


// ======================================================================
// Two-Way ANOVA: Mixed Design
// ======================================================================
function runTwoWayMixedANOVA(currentData) {
    const betweenFactor = document.getElementById('mixed-between-var').value;
    const withinVarSelect = document.getElementById('mixed-within-vars');
    const withinVars = Array.from(withinVarSelect.selectedOptions).map(o => o.value);
    const withinFactorName = "WithinFactor"; // Placeholder

    if (!betweenFactor || withinVars.length < 2) {
        alert('被験者間因子1つと、被験者内因子（2つ以上の変数）を選択してください');
        return;
    }

    const outputContainer = document.getElementById('anova-results');
    outputContainer.innerHTML = '';

    try {
        const validData = currentData.filter(row => {
            if (row[betweenFactor] == null) return false;
            return withinVars.every(v => row[v] != null && !isNaN(row[v]));
        });

        const N = validData.length;
        const groups = [...new Set(validData.map(d => d[betweenFactor]))].sort();
        const a = groups.length;
        const b = withinVars.length;

        if (a < 2) { alert('被験者間因子は2群以上必要です'); return; }

        // --- ANOVA Calculations (Same as before) ---
        const allValues = validData.flatMap(r => withinVars.map(v => r[v]));
        const GM = jStat.mean(allValues);
        const ssTotal = allValues.reduce((sum, v) => sum + Math.pow(v - GM, 2), 0);

        let ssBetweenSubjects = 0;
        validData.forEach(row => {
            const subjVals = withinVars.map(v => row[v]);
            ssBetweenSubjects += b * Math.pow(jStat.mean(subjVals) - GM, 2);
        });

        let ssGroup = 0;
        groups.forEach(g => {
            const groupRows = validData.filter(r => r[betweenFactor] === g);
            const n_g = groupRows.length;
            const groupAllVals = groupRows.flatMap(r => withinVars.map(v => r[v]));
            ssGroup += n_g * b * Math.pow(jStat.mean(groupAllVals) - GM, 2);
        });

        const ssErrorBetween = ssBetweenSubjects - ssGroup;
        const ssWithinSubjects = ssTotal - ssBetweenSubjects;

        let ssTime = 0;
        withinVars.forEach((v, i) => {
            const colVals = validData.map(r => r[v]);
            ssTime += N * Math.pow(jStat.mean(colVals) - GM, 2);
        });

        let ssCells = 0;
        const groupDataForPlot = {}; // For plotting: { "Time_Group": [vals...] } or structure?
        // Actually, Python ref: Pre-Groups, Post-Groups.
        // We will organize data by Time Point -> Groups
        const timePointData = {}; // { "Time1": { "GroupA": [], "GroupB": [] } }

        withinVars.forEach(v => {
            timePointData[v] = {};
            groups.forEach(g => {
                timePointData[v][g] = [];
            });
        });

        groups.forEach(g => {
            const groupRows = validData.filter(r => r[betweenFactor] === g);
            const n_g = groupRows.length;
            withinVars.forEach(v => {
                const cellVals = groupRows.map(r => r[v]);
                const cellMean = jStat.mean(cellVals);
                ssCells += n_g * Math.pow(cellMean - GM, 2);

                // Store for plotting
                timePointData[v][g] = cellVals;
            });
        });

        const ssInteraction = ssCells - ssGroup - ssTime;
        const ssErrorWithin = ssWithinSubjects - ssTime - ssInteraction;

        const dfGroup = a - 1;
        const dfErrorBetween = N - a;
        const dfTime = b - 1;
        const dfInteraction = (a - 1) * (b - 1);
        const dfErrorWithin = (N - a) * (b - 1);

        const msGroup = ssGroup / dfGroup;
        const msErrorBetween = ssErrorBetween / dfErrorBetween;
        const msTime = ssTime / dfTime;
        const msInteraction = ssInteraction / dfInteraction;
        const msErrorWithin = ssErrorWithin / dfErrorWithin;

        const fGroup = msGroup / msErrorBetween;
        const fTime = msTime / msErrorWithin;
        const fInteraction = msInteraction / msErrorWithin;

        const pGroup = 1 - jStat.centralF.cdf(fGroup, dfGroup, dfErrorBetween);
        const pTime = 1 - jStat.centralF.cdf(fTime, dfTime, dfErrorWithin);
        const pInteraction = 1 - jStat.centralF.cdf(fInteraction, dfInteraction, dfErrorWithin);

        const etaGroup = ssGroup / (ssGroup + ssErrorBetween);
        const etaTime = ssTime / (ssTime + ssErrorWithin);
        const etaInteraction = ssInteraction / (ssInteraction + ssErrorWithin);

        renderANOVAOutput(outputContainer, "Mixed Design Result", 'Mixed', {
            factors: [betweenFactor, "条件(Within)"],
            rows: [
                { name: `${betweenFactor} (被験者間)`, ss: ssGroup, df: dfGroup, ms: msGroup, f: fGroup, p: pGroup, eta: etaGroup },
                { name: `誤差 (被験者間)`, ss: ssErrorBetween, df: dfErrorBetween, ms: msErrorBetween, f: null, p: null },
                { name: `条件 (被験者内)`, ss: ssTime, df: dfTime, ms: msTime, f: fTime, p: pTime, eta: etaTime },
                { name: `交互作用`, ss: ssInteraction, df: dfInteraction, ms: msInteraction, f: fInteraction, p: pInteraction, eta: etaInteraction },
                { name: `誤差 (被験者内)`, ss: ssErrorWithin, df: dfErrorWithin, ms: msErrorWithin, f: null, p: null }
            ],
            plotData: {
                timePointData,
                groups,
                withinVars,
                depVarLabel: "Value"
            }
        });

    } catch (e) {
        console.error(e);
        outputContainer.innerHTML = `<p class="error">計算エラーが発生しました: ${e.message}</p>`;
    }

    document.getElementById('analysis-results').style.display = 'block';
}


// ======================================================================
// Shared Output Renderer
// ======================================================================
function renderANOVAOutput(container, title, type, result) {
    const { rows, plotData } = result;

    let html = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                ${title} <span style="font-size:0.8em; color:#666;">(${type})</span>
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
    `;

    rows.forEach(row => {
        html += `
            <tr>
                <td>${row.name}</td>
                <td>${row.ss.toFixed(2)}</td>
                <td>${row.df}</td>
                <td>${row.ms ? row.ms.toFixed(2) : '-'}</td>
                <td>${row.f ? row.f.toFixed(2) : '-'}</td>
                <td style="${row.p !== null && row.p < 0.05 ? 'font-weight:bold; color:#ef4444;' : ''}">${row.p !== null ? row.p.toFixed(3) + (row.p < 0.01 ? '**' : (row.p < 0.05 ? '*' : '')) : '-'}</td>
                <td>${row.eta ? row.eta.toFixed(3) : '-'}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <div id="plot-${type}-${title.replace(/\s/g, '')}" style="margin-top: 1.5rem;"></div>
        </div>
    `;

    container.innerHTML += html;

    // Async Plot
    setTimeout(() => {
        const plotId = `plot-${type}-${title.replace(/\s/g, '')}`;
        const plotDiv = document.getElementById(plotId);
        if (plotDiv) {
            if (type === 'Independent') plotIndependentBar(plotDiv, plotData);
            else if (type === 'Mixed') plotMixedBar(plotDiv, plotData);
        }
    }, 100);
}

// ----------------------------------------------------------------------
// Plot Logic: Independent (Single Bar Chart with Interaction Groups)
// ----------------------------------------------------------------------
function plotIndependentBar(div, data) {
    const { interactionGroups, groupData, depVar } = data;

    // Calculate Means and SEs
    const means = [];
    const errors = [];
    const groupStats = {};

    interactionGroups.forEach(g => {
        const vals = groupData[g];
        const m = jStat.mean(vals);
        const std = jStat.stdev(vals, true);
        const se = std / Math.sqrt(vals.length);
        means.push(m);
        errors.push(se);
        groupStats[g] = { mean: m, se: se };
    });

    // Run Post-Hoc
    // Note: We run Post-hoc on ALL interaction groups
    const sigPairs = performPostHocTests(interactionGroups, groupData);

    // Layout Refs
    const maxVal = Math.max(...means.map((m, i) => m + errors[i]));
    const yOffset = maxVal * (0.15 / Math.max(1, interactionGroups.length)); // scale by groups
    const step = maxVal * 0.1; // 10% step

    // Brackets
    // We assume interactionGroups indexes map to X axis 0, 1, 2...
    const { shapes, annotations, totalLevels } = generateBrackets(sigPairs, interactionGroups, groupStats, step, yOffset);

    // Dynamic margin
    const topMargin = 50 + (totalLevels * 30);

    const trace = {
        x: interactionGroups,
        y: means,
        type: 'bar',
        marker: { color: 'skyblue' },
        error_y: {
            type: 'data',
            array: errors,
            visible: true,
            color: 'black'
        }
    };

    Plotly.newPlot(div, [trace], {
        title: `${depVar} (各群・条件組み合わせの平均)`,
        yaxis: { title: depVar },
        xaxis: { title: '条件 (Factor1_Factor2)' },
        showlegend: false,
        shapes: shapes,
        annotations: annotations,
        margin: { t: topMargin }
    }, createPlotlyConfig('TwoWayInd', 'Bar'));
}

// ----------------------------------------------------------------------
// Plot Logic: Mixed (Clustered Bar Chart: X=Time, Color=Group)
// Reference script 09 plots: X=Group, Color=Time ??
// Let's re-read Ref 09 Line 281: x=x_pre (shifted), x=x_post (shifted).
// So X axis is Group (Between Factor), and Pre/Post bars are clustered around each group tick.
// Correct. "X axis = Group".
// ----------------------------------------------------------------------
function plotMixedBar(div, data) {
    const { timePointData, groups, withinVars, depVarLabel } = data; // groups = Between levels

    // We only support what the user passed as Within Vars.
    // Usually Pre/Post (2 vars). If 3, we have 3 bars per group.

    // Structure:
    // X Axis: Groups (Between)
    // Traces: One trace per Within Var (e.g. Pre, Post)
    // We need to implement Side-by-Side bars manually or using barmode='group'.
    // `barmode='group'` automatically clusters traces.
    // However, to draw brackets BETWEEN bars of the same cluster (Pre vs Post within Group) or specific comparisons,
    // we need to know exact X coordinates.
    // Plotly `barmode='group'` shifts X coords internally.
    // Ref 09 manually shifts X coords: `x_pre = x - delta`, `x_post = x + delta`.
    // I will use Manual Shift approach to ensure I know where to put brackets.

    const traces = [];
    const numWithin = withinVars.length;
    const delta = 0.2; // shift amount. If >2 vars, maybe scale down.
    const colors = ['skyblue', 'lightgreen', '#FFD700', '#FFA07A']; // simple palette

    // We need stats for brackets
    const groupStats = {}; // Key: "GroupVal_Time" -> { mean, se, x_coord }

    withinVars.forEach((v, i) => {
        // Shift amount: centered around 0.
        // e.g. 2 vars: -0.2, +0.2
        // 3 vars: -0.2, 0, +0.2? 
        // Let's use linspace logic approx.
        const center = (numWithin - 1) / 2;
        const shift = (i - center) * 0.25; // 0.25 spacing

        const xVals = []; // explicit numeric x vals
        const yMeans = [];
        const yErrs = [];

        groups.forEach((g, gIdx) => {
            const vals = timePointData[v][g];
            const m = jStat.mean(vals);
            const se = jStat.stdev(vals, true) / Math.sqrt(vals.length);

            const xCoord = gIdx + shift;
            xVals.push(xCoord);
            yMeans.push(m);
            yErrs.push(se);

            // Store for brackets lookups
            // Key: how to identify? By logical grouping.
            // But `performPostHoc` uses "Group Names".
            // We are comparing Groups AT specific Time.
            // So we will perform Post-hoc for each Time V separately.
            groupStats[`${g}_${v}`] = { mean: m, se: se, x: xCoord };
        });

        traces.push({
            x: xVals,
            y: yMeans,
            type: 'bar',
            width: 0.2, // manual width
            name: v, // Legend entry
            marker: { color: colors[i % colors.length] },
            error_y: { type: 'data', array: yErrs, visible: true, color: 'black' }
        });
    });

    // --- Brackets Logic ---
    // Req: Compare Groups AT each Time point (Ref 09).
    const allShapes = [];
    const allAnnotations = [];
    let currentLevelY = -1; // Track max height

    // Determine global max Y first for setup
    let globalMax = 0;
    Object.values(groupStats).forEach(s => {
        if ((s.mean + s.se) > globalMax) globalMax = s.mean + s.se;
    });
    const step = globalMax * 0.1;

    // We iterate each Time Point validation
    let totalLevelsGlobal = 0;

    withinVars.forEach((v, i) => {
        // 1. Get Group Data for this Time Point
        // groupDataForTest: { g1: [vals], g2: [vals] }
        const dataForTest = {};
        groups.forEach(g => {
            dataForTest[g] = timePointData[v][g];
        });

        // 2. Pairwise Test between Groups
        const sigPairs = performPostHocTests(groups, dataForTest);

        // 3. Generate Brackets
        // We need to map Group Name to X Index.
        // Using `generateBrackets` helper? It expects integer indices matching array.
        // But here X coords are Floats (manually shifted).
        // I'll replicate logic inline or adapt helper.
        // Let's adapt logic: sort pairs, find levels, calculate Y.

        sigPairs.sort((a, b) => {
            const distA = Math.abs(groups.indexOf(a.g1) - groups.indexOf(a.g2));
            const distB = Math.abs(groups.indexOf(b.g1) - groups.indexOf(b.g2));
            return distA - distB;
        });

        const levels = [];
        sigPairs.forEach(pair => {
            if (pair.p >= 0.1) return;

            // Map pair (g1, g2) to actual X coords for this Time Point (v)
            const stat1 = groupStats[`${pair.g1}_${v}`];
            const stat2 = groupStats[`${pair.g2}_${v}`];
            const x1 = stat1.x;
            const x2 = stat2.x;

            const start = Math.min(x1, x2);
            const end = Math.max(x1, x2);

            let levelIndex = 0;
            while (true) {
                if (!levels[levelIndex]) levels[levelIndex] = [];
                // slight margin 0.1
                const overlap = levels[levelIndex].some(interval => (start < interval.end + 0.1) && (end > interval.start - 0.1));
                if (!overlap) break;
                levelIndex++;
            }
            levels[levelIndex].push({ start, end });

            // Y coord
            const yBase1 = stat1.mean + stat1.se;
            const yBase2 = stat2.mean + stat2.se;
            const yVlineBottom = Math.max(yBase1, yBase2) + step * 0.2;

            // Global Level check? 
            // If we have Brackets for Time1 and Time2, they might overlap ideally X wise they are distinct?
            // Yes, adjacent clusters. Unless groups are very close? 
            // Groups are 0, 1, 2... Shifts are +/- 0.2. Margin is sufficient.
            // So we can treat levels independently per time point or shared?
            // If they are independent, brackets might align at different Y heights.
            // Usually fine.

            const bracketY = yVlineBottom + (levelIndex * step) + step * 0.2;

            if (bracketY > currentLevelY) currentLevelY = bracketY;

            let text = 'n.s.';
            if (pair.p < 0.01) text = '**';
            else if (pair.p < 0.05) text = '*';
            else if (pair.p < 0.1) text = '†';

            allShapes.push({ type: 'line', x0: x1, y0: yVlineBottom, x1: x1, y1: bracketY, line: { color: 'black', width: 1 } });
            allShapes.push({ type: 'line', x0: x1, y0: bracketY, x1: x2, y1: bracketY, line: { color: 'black', width: 1 } });
            allShapes.push({ type: 'line', x0: x2, y0: bracketY, x1: x2, y1: yVlineBottom, line: { color: 'black', width: 1 } });

            allAnnotations.push({
                x: (x1 + x2) / 2,
                y: bracketY + step * 0.1,
                text: `p < ${pair.p.toFixed(3)} ${text}`,
                showarrow: false,
                font: { size: 10, color: 'black' }
            });
        });

        // Add to total levels for margin estimation
        if (levels.length > totalLevelsGlobal) totalLevelsGlobal = levels.length;
    });

    const topMargin = 50 + (totalLevelsGlobal * 30);

    Plotly.newPlot(div, traces, {
        title: 'Mixed ANOVA Results (Group Differences at each Time)',
        yaxis: { title: 'Value', range: [0, (currentLevelY > 0 ? currentLevelY : globalMax) * 1.2] },
        xaxis: {
            tickvals: groups.map((_, i) => i),
            ticktext: groups,
            title: 'Subject Group'
        },
        barmode: 'group', // redundant but fine with manual X
        shapes: allShapes,
        annotations: allAnnotations,
        margin: { t: topMargin }
    }, createPlotlyConfig('MixedANOVA', 'Bar'));
}


// ======================================================================
// UI Logic
// ======================================================================

function switchTestType(testType) {
    const indControls = document.getElementById('independent-controls');
    const withinControls = document.getElementById('within-controls');
    const mixedControls = document.getElementById('mixed-controls');

    [indControls, withinControls, mixedControls].forEach(el => el.style.display = 'none');

    if (testType === 'independent') indControls.style.display = 'block';
    else if (testType === 'within') withinControls.style.display = 'block';
    else if (testType === 'mixed') mixedControls.style.display = 'block';

    document.getElementById('analysis-results').style.display = 'none';
}

export function render(container, currentData, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="anova-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-th-large"></i> 二要因分散分析 (Two-way ANOVA)
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つの要因とその交互作用を分析します</p>
            </div>

            <div id="anova2-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                 <div style="margin-bottom: 1.5rem;">
                    <h5 style="color: #2d3748; margin-bottom: 1rem;">検定タイプを選択:</h5>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #f0f8ff; border: 2px solid #1e90ff; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova2-type" value="independent" checked>
                            <strong>対応なし (Independent)</strong>
                            <p style="color: #666; font-size: 0.8rem;">2つの独立した被験者間因子</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer;">
                            <input type="radio" name="anova2-type" value="mixed">
                            <strong>混合計画 (Mixed)</strong>
                            <p style="color: #666; font-size: 0.8rem;">被験者間因子 × 被験者内因子</p>
                        </label>
                        <label style="flex: 1; min-width: 200px; padding: 1rem; background: #fafbfc; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; opacity: 0.6;">
                            <input type="radio" name="anova2-type" value="within" disabled>
                            <strong>対応あり (Within)</strong>
                            <p style="color: #666; font-size: 0.8rem;">(実装中) 2つの被験者内因子</p>
                        </label>
                    </div>
                </div>

                <!-- Independent Controls -->
                <div id="independent-controls">
                    <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div id="factor1-var-container"></div>
                        <div id="factor2-var-container"></div>
                    </div>
                    <div id="dependent-var-container" style="margin-bottom: 1.5rem;"></div>
                    <div id="run-ind-btn"></div>
                </div>

                <!-- Mixed Controls -->
                <div id="mixed-controls" style="display: none;">
                    <div id="mixed-between-container" style="margin-bottom: 1rem;"></div>
                    <div id="mixed-within-container" style="margin-bottom: 1.5rem;"></div>
                    <div id="run-mixed-btn"></div>
                </div>

                <!-- Within Controls (Placeholder) -->
                <div id="within-controls" style="display: none;">
                    <p>現在開発中です。</p>
                </div>

            </div>

            <div id="analysis-results" style="display: none;">
                <div id="anova-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#anova2-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Independent Selectors
    createVariableSelector('factor1-var-container', categoricalColumns, 'factor1-var', { label: '要因1（間）:', multiple: false });
    createVariableSelector('factor2-var-container', categoricalColumns, 'factor2-var', { label: '要因2（間）:', multiple: false });
    createVariableSelector('dependent-var-container', numericColumns, 'dependent-var', { label: '従属変数:', multiple: true });
    createAnalysisButton('run-ind-btn', '実行（対応なし）', () => runTwoWayIndependentANOVA(currentData), { id: 'run-ind-anova' });

    // Mixed Selectors
    createVariableSelector('mixed-between-container', categoricalColumns, 'mixed-between-var', { label: '被験者間因子（グループ）:', multiple: false });
    createVariableSelector('mixed-within-container', numericColumns, 'mixed-within-vars', { label: '被験者内因子（測定値列・複数）:', multiple: true });
    createAnalysisButton('run-mixed-btn', '実行（混合計画）', () => runTwoWayMixedANOVA(currentData), { id: 'run-mixed-anova' });

    // Toggle Logic
    document.querySelectorAll('input[name="anova2-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchTestType(e.target.value);
            document.querySelectorAll('input[name="anova2-type"]').forEach(r => {
                const label = r.closest('label');
                label.style.background = r.checked ? '#f0f8ff' : '#fafbfc';
                label.style.borderColor = r.checked ? '#1e90ff' : '#e2e8f0';
            });
        });
    });
}