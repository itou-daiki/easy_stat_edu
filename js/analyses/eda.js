import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview, createVariableSelector } from '../utils.js';

// ヒストグラムの描画
function plotHistograms(variables) {
    const container = document.getElementById('histograms-container');
    container.innerHTML = '';

    variables.forEach((varName, i) => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        const plotId = `hist-${i}`;
        const div = document.createElement('div');
        div.id = plotId;
        div.className = 'plot-container';
        div.style.marginBottom = '2rem';
        container.appendChild(div);

        const trace = {
            x: values,
            type: 'histogram',
            marker: { color: '#1e90ff' },
            opacity: 0.7
        };

        const layout = {
            title: `ヒストグラム: ${varName}`,
            xaxis: { title: varName },
            yaxis: { title: '度数' }
        };

        Plotly.newPlot(plotId, [trace], layout);
    });
}

// 箱ひげ図の描画 (数値変数)
function plotBoxPlots(variables) {
    const container = document.getElementById('boxplots-container');
    container.innerHTML = '';

    // 一括表示用の箱ひげ図
    const traces = variables.map(varName => {
        const values = currentData.map(row => row[varName]).filter(v => v != null && !isNaN(v));
        return {
            y: values,
            type: 'box',
            name: varName,
            boxpoints: 'outliers',
            marker: { color: '#1e90ff' }
        };
    });

    const plotId = 'boxplots-all';
    const div = document.createElement('div');
    div.id = plotId;
    div.className = 'plot-container';
    container.appendChild(div);

    const layout = {
        title: '数値変数の比較（標準化前）',
        yaxis: { title: '値' },
        showlegend: false
    };

    Plotly.newPlot(plotId, traces, layout);
}

// 棒グラフの描画 (カテゴリ変数)
function plotBarCharts(variables) {
    const container = document.getElementById('barcharts-container');
    container.innerHTML = '';

    variables.forEach((varName, i) => {
        const values = currentData.map(row => row[varName]);
        const counts = {};
        values.forEach(v => {
            const key = v == null ? '欠損' : v;
            counts[key] = (counts[key] || 0) + 1;
        });

        // ソート（度数順）
        const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        const sortedCounts = sortedKeys.map(k => counts[k]);

        const plotId = `bar-${i}`;
        const div = document.createElement('div');
        div.id = plotId;
        div.className = 'plot-container';
        div.style.marginBottom = '2rem';
        container.appendChild(div);

        const trace = {
            x: sortedKeys,
            y: sortedCounts,
            type: 'bar',
            marker: { color: '#1e90ff' }
        };

        const layout = {
            title: `度数分布: ${varName}`,
            xaxis: { title: varName, type: 'category' },
            yaxis: { title: '度数' }
        };

        Plotly.newPlot(plotId, [trace], layout);
    });
}

// 散布図の描画 (2変数)
function plotScatter(xVar, yVar, colorVar) {
    const container = document.getElementById('scatter-container');
    container.innerHTML = '';
    const plotId = 'scatter-plot';
    const div = document.createElement('div');
    div.id = plotId;
    div.className = 'plot-container';
    container.appendChild(div);

    const trace = {
        x: currentData.map(row => row[xVar]),
        y: currentData.map(row => row[yVar]),
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 8,
            color: colorVar ? currentData.map(row => row[colorVar]) : '#1e90ff',
            opacity: 0.6,
            colorscale: 'Viridis',
            showscale: !!colorVar
        },
        text: colorVar ? currentData.map(row => `${colorVar}: ${row[colorVar]}`) : null
    };

    const layout = {
        title: `散布図: ${xVar} vs ${yVar}`,
        xaxis: { title: xVar },
        yaxis: { title: yVar },
        hovermode: 'closest'
    };

    Plotly.newPlot(plotId, [trace], layout);
}

// クロス集計とヒートマップ
function plotCrosstab(rowVar, colVar) {
    const container = document.getElementById('crosstab-container');
    container.innerHTML = ''; // Clear previous

    const rowValues = currentData.map(row => row[rowVar]);
    const colValues = currentData.map(row => row[colVar]);

    // ユニークな値を取得
    const rowUnique = [...new Set(rowValues)].filter(v => v != null).sort();
    const colUnique = [...new Set(colValues)].filter(v => v != null).sort();

    const z = rowUnique.map(r => {
        return colUnique.map(c => {
            return currentData.filter(row => row[rowVar] == r && row[colVar] == c).length;
        });
    });

    const plotId = 'crosstab-heatmap';
    const div = document.createElement('div');
    div.id = plotId;
    div.className = 'plot-container';
    container.appendChild(div);

    const data = [{
        z: z,
        x: colUnique,
        y: rowUnique,
        type: 'heatmap',
        colorscale: 'Blues'
    }];

    const layout = {
        title: `クロス集計: ${rowVar} x ${colVar}`,
        xaxis: { title: colVar, type: 'category' },
        yaxis: { title: rowVar, type: 'category' }
    };

    Plotly.newPlot(plotId, data, layout);
}

// 3変数（層別散布図など）
function plotGroupedScatter(xVar, yVar, groupVar) {
    const container = document.getElementById('grouped-scatter-container');
    container.innerHTML = '';
    const plotId = 'grouped-scatter';
    const div = document.createElement('div');
    div.id = plotId;
    div.className = 'plot-container';
    container.appendChild(div);

    const groups = [...new Set(currentData.map(row => row[groupVar]))].filter(v => v != null);
    const traces = groups.map(group => {
        const groupData = currentData.filter(row => row[groupVar] == group);
        return {
            x: groupData.map(row => row[xVar]),
            y: groupData.map(row => row[yVar]),
            mode: 'markers',
            type: 'scatter',
            name: group,
            marker: { size: 8, opacity: 0.7 }
        };
    });

    const layout = {
        title: `層別散布図: ${xVar} vs ${yVar} by ${groupVar}`,
        xaxis: { title: xVar },
        yaxis: { title: yVar },
        hovermode: 'closest'
    };

    Plotly.newPlot(plotId, traces, layout);
}


export function render(container, characteristics) {
    const { numericColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="eda-container">
            <!-- データ概要 -->
            <div id="eda-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- タブナビゲーション -->
            <div class="tabs">
                <button class="tab-btn active" data-tab="basic-stats">基本統計・分布</button>
                <button class="tab-btn" data-tab="num-compare">数値変数の比較</button>
                <button class="tab-btn" data-tab="two-vars">２変数の関係</button>
                <button class="tab-btn" data-tab="three-vars">３変数の関係</button>
            </div>

            <!-- コンテンツエリア -->
            <div id="basic-stats" class="tab-content active">
                <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-chart-bar"></i> 分布の確認</h4>
                    
                    <div id="hist-vars-container" style="margin-bottom: 1rem;"></div>
                    <button id="plot-hist-btn" class="btn-analysis">ヒストグラムを描画</button>
                    <div id="histograms-container" style="margin-top: 2rem;"></div>

                    <hr style="margin: 2rem 0; border-top: 1px solid #eee;">

                    <div id="bar-vars-container" style="margin-bottom: 1rem;"></div>
                    <button id="plot-bar-btn" class="btn-analysis">棒グラフを描画</button>
                    <div id="barcharts-container" style="margin-top: 2rem;"></div>
                </div>
            </div>

            <div id="num-compare" class="tab-content">
                <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-box"></i> 箱ひげ図で比較</h4>
                    <div id="box-vars-container" style="margin-bottom: 1rem;"></div>
                    <button id="plot-box-btn" class="btn-analysis">箱ひげ図を描画</button>
                    <div id="boxplots-container" style="margin-top: 2rem;"></div>
                </div>
            </div>

            <div id="two-vars" class="tab-content">
                <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> 散布図（数値 x 数値）</h4>
                    <div class="grid-2-cols">
                        <div id="scatter-x-container"></div>
                        <div id="scatter-y-container"></div>
                    </div>
                    <div id="scatter-color-container" style="margin-top: 1rem;"></div>
                    <button id="plot-scatter-btn" class="btn-analysis" style="margin-top: 1rem;">散布図を描画</button>
                    <div id="scatter-container" style="margin-top: 2rem;"></div>
                </div>

                <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-th"></i> クロス集計（カテゴリ x カテゴリ）</h4>
                    <div class="grid-2-cols">
                        <div id="cross-row-container"></div>
                        <div id="cross-col-container"></div>
                     </div>
                    <button id="plot-cross-btn" class="btn-analysis" style="margin-top: 1rem;">ヒートマップを描画</button>
                    <div id="crosstab-container" style="margin-top: 2rem;"></div>
                </div>
            </div>

            <div id="three-vars" class="tab-content">
                <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-layer-group"></i> 層別散布図</h4>
                    <div class="grid-3-cols">
                        <div id="grouped-x-container"></div>
                        <div id="grouped-y-container"></div>
                        <div id="grouped-g-container"></div>
                     </div>
                    <button id="plot-grouped-btn" class="btn-analysis" style="margin-top: 1rem;">層別散布図を描画</button>
                    <div id="grouped-scatter-container" style="margin-top: 2rem;"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#eda-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // --- Tab Handling ---
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // --- Selectors ---

    // Basic Stats
    createVariableSelector('hist-vars-container', numericColumns, 'hist-vars', { label: 'ヒストグラム（数値変数） - 複数選択可', multiple: true });
    createVariableSelector('bar-vars-container', categoricalColumns, 'bar-vars', { label: '棒グラフ（カテゴリ変数） - 複数選択可', multiple: true });

    // Num Compare
    createVariableSelector('box-vars-container', numericColumns, 'box-vars', { label: '箱ひげ図（数値変数） - 複数選択可', multiple: true });

    // Two Vars
    createVariableSelector('scatter-x-container', numericColumns, 'scatter-x', { label: 'X軸（数値）', multiple: false });
    createVariableSelector('scatter-y-container', numericColumns, 'scatter-y', { label: 'Y軸（数値）', multiple: false });
    createVariableSelector('scatter-color-container', categoricalColumns, 'scatter-color', { label: '色分け（カテゴリ・任意）', multiple: false, placeholder: 'なし' });

    createVariableSelector('cross-row-container', categoricalColumns, 'cross-row', { label: '行（カテゴリ）', multiple: false });
    createVariableSelector('cross-col-container', categoricalColumns, 'cross-col', { label: '列（カテゴリ）', multiple: false });

    // Three Vars
    createVariableSelector('grouped-x-container', numericColumns, 'grouped-x', { label: 'X軸（数値）', multiple: false });
    createVariableSelector('grouped-y-container', numericColumns, 'grouped-y', { label: 'Y軸（数値）', multiple: false });
    createVariableSelector('grouped-g-container', categoricalColumns, 'grouped-g', { label: 'グループ（カテゴリ）', multiple: false });

    // --- Event Listeners ---
    document.getElementById('plot-hist-btn').addEventListener('click', () => {
        const selected = Array.from(document.getElementById('hist-vars').selectedOptions).map(o => o.value);
        if (selected.length) plotHistograms(selected);
        else alert('変数を1つ以上選択してください');
    });

    document.getElementById('plot-bar-btn').addEventListener('click', () => {
        const selected = Array.from(document.getElementById('bar-vars').selectedOptions).map(o => o.value);
        if (selected.length) plotBarCharts(selected);
        else alert('変数を1つ以上選択してください');
    });

    document.getElementById('plot-box-btn').addEventListener('click', () => {
        const selected = Array.from(document.getElementById('box-vars').selectedOptions).map(o => o.value);
        if (selected.length) plotBoxPlots(selected);
        else alert('変数を1つ以上選択してください');
    });

    document.getElementById('plot-scatter-btn').addEventListener('click', () => {
        const x = document.getElementById('scatter-x').value;
        const y = document.getElementById('scatter-y').value;
        const c = document.getElementById('scatter-color').value;
        if (x && y) plotScatter(x, y, c);
        else alert('X軸とY軸を選択してください');
    });

    document.getElementById('plot-cross-btn').addEventListener('click', () => {
        const r = document.getElementById('cross-row').value;
        const c = document.getElementById('cross-col').value;
        if (r && c) plotCrosstab(r, c);
        else alert('行と列を選択してください');
    });

    document.getElementById('plot-grouped-btn').addEventListener('click', () => {
        const x = document.getElementById('grouped-x').value;
        const y = document.getElementById('grouped-y').value;
        const g = document.getElementById('grouped-g').value;
        if (x && y && g) plotGroupedScatter(x, y, g);
        else alert('全ての変数を選択してください');
    });
}
