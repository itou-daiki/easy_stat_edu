// ==========================================
// クロス集計 (Cross Tabulation)
// ==========================================
import { renderDataOverview, createVariableSelector, createAnalysisButton, createPlotlyConfig } from '../utils.js';

// ==========================================
// Core Calculation
// ==========================================

function buildCrossTable(data, rowVar, colVar) {
    const rowKeys = [...new Set(data.map(r => r[rowVar]).filter(v => v != null))].sort();
    const colKeys = [...new Set(data.map(r => r[colVar]).filter(v => v != null))].sort();

    // Initialize count matrix
    const counts = {};
    rowKeys.forEach(rk => {
        counts[rk] = {};
        colKeys.forEach(ck => { counts[rk][ck] = 0; });
    });

    // Count
    let N = 0;
    data.forEach(row => {
        const rv = row[rowVar];
        const cv = row[colVar];
        if (rv != null && cv != null && counts[rv] !== undefined && counts[rv][cv] !== undefined) {
            counts[rv][cv]++;
            N++;
        }
    });

    // Row totals, col totals
    const rowTotals = {};
    rowKeys.forEach(rk => {
        rowTotals[rk] = colKeys.reduce((sum, ck) => sum + counts[rk][ck], 0);
    });
    const colTotals = {};
    colKeys.forEach(ck => {
        colTotals[ck] = rowKeys.reduce((sum, rk) => sum + counts[rk][ck], 0);
    });

    return { counts, rowKeys, colKeys, rowTotals, colTotals, N };
}

// ==========================================
// Table Rendering
// ==========================================

function renderTable(tableData, mode) {
    const { counts, rowKeys, colKeys, rowTotals, colTotals, N, rowVar, colVar } = tableData;

    const formatCell = (count, rowKey, colKey) => {
        switch (mode) {
            case 'row-pct':
                const rTotal = rowTotals[rowKey];
                return rTotal > 0 ? (count / rTotal * 100).toFixed(1) + '%' : '0.0%';
            case 'col-pct':
                const cTotal = colTotals[colKey];
                return cTotal > 0 ? (count / cTotal * 100).toFixed(1) + '%' : '0.0%';
            case 'total-pct':
                return N > 0 ? (count / N * 100).toFixed(1) + '%' : '0.0%';
            default: // count
                return String(count);
        }
    };

    const formatTotal = (total, grandTotal) => {
        switch (mode) {
            case 'row-pct':
                return '100.0%';
            case 'col-pct':
                return grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) + '%' : '0.0%';
            case 'total-pct':
                return grandTotal > 0 ? (total / grandTotal * 100).toFixed(1) + '%' : '0.0%';
            default:
                return String(total);
        }
    };

    const formatColTotal = (total) => {
        switch (mode) {
            case 'col-pct':
                return '100.0%';
            case 'row-pct':
            case 'total-pct':
                return N > 0 ? (total / N * 100).toFixed(1) + '%' : '0.0%';
            default:
                return String(total);
        }
    };

    let html = `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="border-top: 2px solid #333; border-bottom: 2px solid #333;">
                        <th style="padding: 0.5rem; font-weight: bold; color: #495057;">${rowVar} ＼ ${colVar}</th>
    `;

    colKeys.forEach(ck => {
        html += `<th style="text-align: center; padding: 0.5rem;">${ck}</th>`;
    });
    html += `<th style="text-align: center; padding: 0.5rem; border-left: 2px solid #333; font-weight: bold;">合計</th></tr></thead><tbody>`;

    rowKeys.forEach(rk => {
        html += `<tr style="border-bottom: 1px solid #eee;">`;
        html += `<td style="font-weight: bold; padding: 0.5rem; color: #333;">${rk}</td>`;
        colKeys.forEach(ck => {
            const count = counts[rk][ck];
            const maxInRow = Math.max(...colKeys.map(c => counts[rk][c]));
            const isMax = count === maxInRow && count > 0;
            html += `<td style="text-align: center; padding: 0.5rem;${isMax ? ' font-weight: bold; color: #059669;' : ''}">${formatCell(count, rk, ck)}</td>`;
        });
        html += `<td style="text-align: center; padding: 0.5rem; border-left: 2px solid #333; font-weight: bold;">${formatTotal(rowTotals[rk], N)}</td>`;
        html += `</tr>`;
    });

    // Total row
    html += `<tr style="border-top: 2px solid #333;">`;
    html += `<td style="font-weight: bold; padding: 0.5rem;">合計</td>`;
    colKeys.forEach(ck => {
        html += `<td style="text-align: center; padding: 0.5rem; font-weight: bold;">${formatColTotal(colTotals[ck])}</td>`;
    });
    const grandTotalDisplay = mode === 'count' ? String(N) : mode === 'total-pct' || mode === 'row-pct' || mode === 'col-pct' ? '100.0%' : String(N);
    html += `<td style="text-align: center; padding: 0.5rem; border-left: 2px solid #333; font-weight: bold;">${mode === 'count' ? N : '100.0%'}</td>`;
    html += `</tr></tbody></table></div>`;

    return html;
}

// ==========================================
// CSV Download
// ==========================================

function downloadCSV(tableData) {
    const { counts, rowKeys, colKeys, rowTotals, colTotals, N, rowVar, colVar } = tableData;

    let csv = `${rowVar}\\${colVar}`;
    colKeys.forEach(ck => { csv += `,${ck}`; });
    csv += ',合計\n';

    rowKeys.forEach(rk => {
        csv += rk;
        colKeys.forEach(ck => { csv += `,${counts[rk][ck]}`; });
        csv += `,${rowTotals[rk]}\n`;
    });

    csv += '合計';
    colKeys.forEach(ck => { csv += `,${colTotals[ck]}`; });
    csv += `,${N}\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross_tabulation_${rowVar}_${colVar}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// Visualization
// ==========================================

function plotHeatmap(tableData) {
    const { counts, rowKeys, colKeys, rowVar, colVar } = tableData;

    const z = rowKeys.map(rk => colKeys.map(ck => counts[rk][ck]));

    const annotations = [];
    rowKeys.forEach((rk, i) => {
        colKeys.forEach((ck, j) => {
            annotations.push({
                x: ck, y: rk,
                text: `<b>${counts[rk][ck]}</b>`,
                showarrow: false,
                font: { size: 16, color: '#333' }
            });
        });
    });

    const trace = {
        z: z, x: colKeys, y: rowKeys,
        type: 'heatmap',
        colorscale: [[0, '#f0f9ff'], [1, '#1e90ff']],
        showscale: true,
        colorbar: { title: '度数' },
        hovertemplate: `${rowVar}: %{y}<br>${colVar}: %{x}<br>度数: %{z}<extra></extra>`
    };

    const layout = {
        title: { text: `${rowVar} × ${colVar}`, font: { size: 14 } },
        xaxis: { title: colVar, side: 'bottom' },
        yaxis: { title: rowVar, autorange: 'reversed' },
        margin: { l: 100, b: 80, r: 80, t: 50 },
        annotations: annotations
    };

    Plotly.newPlot('crosstab-heatmap', [trace], layout, createPlotlyConfig('クロス集計', [rowVar, colVar]));
}

// ==========================================
// Main Analysis
// ==========================================

function runCrossTabulation(currentData) {
    const rowVar = document.getElementById('crosstab-row-var').value;
    const colVar = document.getElementById('crosstab-col-var').value;

    if (!rowVar || !colVar) { alert('行変数と列変数を選択してください'); return; }
    if (rowVar === colVar) { alert('異なる変数を選択してください'); return; }

    const table = buildCrossTable(currentData, rowVar, colVar);
    const tableData = { ...table, rowVar, colVar };

    const container = document.getElementById('crosstab-results');

    let currentMode = 'count';

    const renderAll = () => {
        container.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-weight: bold;">
                    <i class="fas fa-th"></i> クロス集計表: ${rowVar} × ${colVar}
                </h4>

                <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button id="crosstab-mode-count" class="btn ${currentMode === 'count' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">度数</button>
                    <button id="crosstab-mode-row-pct" class="btn ${currentMode === 'row-pct' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">行%</button>
                    <button id="crosstab-mode-col-pct" class="btn ${currentMode === 'col-pct' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">列%</button>
                    <button id="crosstab-mode-total-pct" class="btn ${currentMode === 'total-pct' ? 'btn-primary' : 'btn-outline'}" style="padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">全体%</button>
                    <button id="crosstab-download-btn" class="btn btn-outline" style="padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-left: auto;">
                        <i class="fas fa-download"></i> CSV
                    </button>
                </div>

                <div id="crosstab-table-container">
                    ${renderTable(tableData, currentMode)}
                </div>

                <p style="color: #6b7280; margin-top: 0.5rem; font-size: 0.85rem;">
                    <em>N</em>=${table.N}　行: ${table.rowKeys.length}カテゴリ　列: ${table.colKeys.length}カテゴリ
                </p>

                <div id="crosstab-heatmap" style="margin-top: 1.5rem;"></div>
            </div>
        `;

        // Mode buttons
        const modes = ['count', 'row-pct', 'col-pct', 'total-pct'];
        modes.forEach(m => {
            document.getElementById(`crosstab-mode-${m}`).addEventListener('click', () => {
                currentMode = m;
                renderAll();
            });
        });

        // Download
        document.getElementById('crosstab-download-btn').addEventListener('click', () => downloadCSV(tableData));

        // Heatmap
        plotHeatmap(tableData);
    };

    renderAll();
    document.getElementById('crosstab-analysis-results').style.display = 'block';
}

// ==========================================
// Render
// ==========================================

export function render(container, currentData, characteristics) {
    const { categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="crosstab-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-th"></i> クロス集計
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">2つのカテゴリ変数の度数分布を集計し、関連を視覚的に確認します</p>
            </div>

            <!-- 概要 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> クロス集計とは？</strong>
                        <p>2つのカテゴリ変数（例: 学年と部活動）の組合せごとに人数を数えて表にまとめることです。変数間の関係パターンを素早く把握できます。</p>
                    </div>
                    <h4>表示モード</h4>
                    <ul>
                        <li><strong>度数:</strong> 各セルの人数（頻度）を表示</li>
                        <li><strong>行%:</strong> 各行内での割合（行合計=100%）</li>
                        <li><strong>列%:</strong> 各列内での割合（列合計=100%）</li>
                        <li><strong>全体%:</strong> 全データに対する割合（全体=100%）</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="crosstab-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div id="crosstab-row-container" style="margin-bottom: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="crosstab-col-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>
                <div id="crosstab-run-container"></div>
            </div>

            <!-- 結果 -->
            <div id="crosstab-analysis-results" style="display: none;">
                <div id="crosstab-results"></div>
            </div>
        </div>
    `;

    renderDataOverview('#crosstab-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    createVariableSelector('crosstab-row-container', categoricalColumns, 'crosstab-row-var', {
        label: '<i class="fas fa-arrows-alt-v"></i> 行変数:',
        multiple: false
    });

    createVariableSelector('crosstab-col-container', categoricalColumns, 'crosstab-col-var', {
        label: '<i class="fas fa-arrows-alt-h"></i> 列変数:',
        multiple: false
    });

    createAnalysisButton('crosstab-run-container', '集計を実行', () => runCrossTabulation(currentData), { id: 'run-crosstab-btn' });
}
