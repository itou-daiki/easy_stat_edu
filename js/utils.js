// ==========================================
// UI Helpers
// ==========================================

/**
 * Toggles the visibility of a collapsible section.
 * @param {HTMLElement} header - The header element of the collapsible section.
 */
export function toggleCollapsible(header) {
    header.classList.toggle('collapsed');
    const content = header.nextElementSibling;
    content.classList.toggle('collapsed');
}

/**
 * Displays a loading message in the upload area.
 * @param {string} message - The message to display.
 */
export function showLoadingMessage(message) {
    const uploadText = document.querySelector('.upload-text');
    if (uploadText) {
        uploadText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    }
}

/**
 * Hides the loading message in the upload area.
 */
export function hideLoadingMessage() {
    const uploadText = document.querySelector('.upload-text');
    if (uploadText) {
        uploadText.textContent = 'ここにファイルをドラッグ＆ドロップ';
    }
}

/**
 * Shows an error message using a simple alert.
 * @param {string} message - The error message to show.
 */
export function showError(message) {
    alert(`エラー: ${message}`);
    hideLoadingMessage();
}

/**
 * Creates and returns an HTML table from data.
 * @param {string[]} headers - The table headers.
 * @param {string[]} rowLabels - The labels for each row.
 * @param {Array<Array<number|string>>} data - The 2D array of table data.
 * @returns {string} The generated HTML table string.
 */
export function toHtmlTable(headers, rowLabels, data) {
    let table = '<table class="table"><thead><tr><th></th>';
    headers.forEach(h => table += `<th>${h}</th>`);
    table += '</tr></thead><tbody>';
    rowLabels.forEach((r, i) => {
        table += `<tr><th>${r}</th>`;
        data[i].forEach(d => table += `<td>${d.toFixed ? d.toFixed(2) : d}</td>`);
        table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
};

/**
 * Gets the interpretation of Cohen's d effect size.
 * @param {number} d - Cohen's d value.
 * @returns {string} The interpretation text.
 */
export function getEffectSizeInterpretation(d) {
    const absD = Math.abs(d);
    if (absD >= 0.8) return `大きい効果 (|d| = ${absD.toFixed(3)})`;
    if (absD >= 0.5) return `中程度の効果 (|d| = ${absD.toFixed(3)})`;
    if (absD >= 0.2) return `小さい効果 (|d| = ${absD.toFixed(3)})`;
    return `効果はほとんどない (|d| = ${absD.toFixed(3)})`;
};

// ==========================================
// Data Preview and Summary Statistics
// ==========================================

/**
 * Renders a sortable data preview table with all rows displayed.
 * @param {string} containerId - The ID of the container element.
 * @param {Array<Object>} data - The data array to display.
 * @param {string} title - The title for the data preview section.
 * @returns {Object} An object with methods to control the data preview.
 */
export function renderDataPreview(containerId, data, title = 'データプレビュー') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found`);
        return null;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>表示するデータがありません。</p>';
        return null;
    }

    // 内部状態
    let currentData = [...data];
    let originalData = [...data];
    let sortState = { column: null, direction: 'asc' };

    // ソート処理
    function handleSort(column) {
        if (sortState.column === column) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.column = column;
            sortState.direction = 'asc';
        }

        currentData.sort((a, b) => {
            const valA = a[column];
            const valB = b[column];
            const direction = sortState.direction === 'asc' ? 1 : -1;

            if (valA === null || valA === undefined) return 1 * direction;
            if (valB === null || valB === undefined) return -1 * direction;

            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * direction;
            }

            return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * direction;
        });

        renderTable();
    }

    // テーブルのレンダリング
    function renderTable() {
        const columns = Object.keys(currentData[0]);
        let tableHtml = `
            <h5>${title} (${currentData.length}行 × ${columns.length}列)</h5>
            <div class="table-container" style="overflow-x: auto; max-height: 600px; overflow-y: auto;">
            <table class="table">
                <thead>
                    <tr style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
        `;

        columns.forEach(col => {
            let indicator = '';
            if (sortState.column === col) {
                indicator = sortState.direction === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
            }
            tableHtml += `<th data-column="${col}" style="cursor: pointer;">${col}${indicator}</th>`;
        });

        tableHtml += `
                    </tr>
                </thead>
                <tbody>
        `;

        currentData.forEach(row => {
            tableHtml += '<tr>';
            columns.forEach(col => {
                const value = row[col];
                tableHtml += `<td>${value != null ? value : ''}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += `
                </tbody>
            </table>
            </div>
        `;

        container.innerHTML = tableHtml;

        // ソートイベントリスナーを再設定
        container.querySelectorAll('th[data-column]').forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.column));
        });
    }

    // 初期レンダリング
    renderTable();

    // 外部からアクセス可能なメソッド
    return {
        updateData: (newData) => {
            currentData = [...newData];
            originalData = [...newData];
            sortState = { column: null, direction: 'asc' };
            renderTable();
        },
        refresh: () => renderTable()
    };
}

/**
 * Renders summary statistics for the given data.
 * @param {string} containerId - The ID of the container element.
 * @param {Array<Object>} data - The data array to analyze.
 * @param {Object} characteristics - The data characteristics object with numericColumns, categoricalColumns, textColumns.
 * @param {string} title - The title for the summary statistics section.
 */
export function renderSummaryStatistics(containerId, data, characteristics, title = '要約統計量') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with ID "${containerId}" not found`);
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p>統計量を計算するデータがありません。</p>';
        return;
    }

    const { numericColumns, categoricalColumns, textColumns } = characteristics;
    const allColumns = Object.keys(data[0]);

    let tableHtml = `
        <h5>${title}</h5>
        <div class="table-container" style="overflow-x: auto; max-height: 600px; overflow-y: auto;">
        <table class="table">
            <thead>
                <tr style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                    <th>変数名</th>
                    <th>型</th>
                    <th>欠損値(%)</th>
                    <th>平均</th>
                    <th>標準偏差</th>
                    <th>最小値</th>
                    <th>中央値</th>
                    <th>最大値</th>
                    <th>ユニーク数</th>
                </tr>
            </thead>
            <tbody>
    `;

    allColumns.forEach(col => {
        const values = data.map(row => row[col]).filter(v => v != null);
        const missingRate = (((data.length - values.length) / data.length) * 100).toFixed(1);

        let type = '不明';
        let stats = { mean: '-', std: '-', min: '-', median: '-', max: '-', unique: '-' };

        if (numericColumns.includes(col)) {
            type = '数値';
            if (values.length > 0) {
                const jstat = jStat(values);
                stats.mean = jstat.mean().toFixed(3);
                stats.std = jstat.stdev(true).toFixed(3);
                stats.min = jstat.min().toFixed(3);
                stats.median = jstat.median().toFixed(3);
                stats.max = jstat.max().toFixed(3);
            }
            stats.unique = new Set(values).size;
        } else {
            if (categoricalColumns.includes(col)) type = 'カテゴリ';
            else if (textColumns.includes(col)) type = 'テキスト';
            stats.unique = new Set(values).size;
        }

        tableHtml += `
            <tr>
                <td><strong>${col}</strong></td>
                <td>${type}</td>
                <td>${missingRate}%</td>
                <td>${stats.mean}</td>
                <td>${stats.std}</td>
                <td>${stats.min}</td>
                <td>${stats.median}</td>
                <td>${stats.max}</td>
                <td>${stats.unique}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}

/**
 * Renders a collapsible data overview section with data preview and summary statistics (like the top page).
 * @param {string} containerSelector - The CSS selector for the container element.
 * @param {Array<Object>} data - The data array to display.
 * @param {Object} characteristics - The data characteristics object.
 * @param {Object} options - Options for customization.
 * @param {boolean} options.initiallyCollapsed - Whether sections should start collapsed (default: true).
 */
export function renderDataOverview(containerSelector, data, characteristics, options = {}) {
    const { initiallyCollapsed = true } = options;
    const container = document.querySelector(containerSelector);

    if (!container) {
        console.error(`Container with selector "${containerSelector}" not found`);
        return;
    }

    const collapsedClass = initiallyCollapsed ? 'collapsed' : '';

    // 折りたたみ可能なセクションのHTML構造を作成
    container.innerHTML = `
        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedClass}">
                <h3><i class="fas fa-table"></i> データプレビュー</h3>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </div>
            <div class="collapsible-content ${collapsedClass}">
                <div id="${containerSelector.replace(/[^a-zA-Z0-9]/g, '_')}_dataframe" class="table-container"></div>
            </div>
        </div>

        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedClass}">
                <h3><i class="fas fa-chart-bar"></i> 要約統計量</h3>
                <i class="fas fa-chevron-down toggle-icon"></i>
            </div>
            <div class="collapsible-content ${collapsedClass}">
                <div id="${containerSelector.replace(/[^a-zA-Z0-9]/g, '_')}_summary" class="table-container"></div>
            </div>
        </div>
    `;

    // データプレビューと要約統計量をレンダリング
    const dataframeId = `${containerSelector.replace(/[^a-zA-Z0-9]/g, '_')}_dataframe`;
    const summaryId = `${containerSelector.replace(/[^a-zA-Z0-9]/g, '_')}_summary`;

    renderDataPreview(dataframeId, data, 'データプレビュー');
    renderSummaryStatistics(summaryId, data, characteristics, '要約統計量');

    // 折りたたみイベントリスナーを追加
    container.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => toggleCollapsible(header));
    });
}
// ==========================================
// UI Generators
// ==========================================

/**
 * Creates a standard variable selector (select element).
 * Supports single and multiple selection (with click-to-toggle for multiple).
 * @param {HTMLElement|string} container - The container element or ID.
 * @param {string[]} columns - The list of column names to display as options.
 * @param {string} id - The ID for the select element.
 * @param {Object} options - Configuration options.
 * @param {boolean} options.multiple - Whether to allow multiple selection.
 * @param {string} options.label - Optional label text to display before the select.
 * @param {string} options.placeholder - Placeholder text for the first option (for single select).
 * @param {boolean} options.disabled - Whether the select should be disabled initially.
 * @returns {HTMLSelectElement} The created select element.
 */
export function createVariableSelector(container, columns, id, options = {}) {
    const {
        multiple = false,
        label = null,
        placeholder = '選択してください...',
        disabled = false
    } = options;

    const targetContainer = typeof container === 'string' ? document.getElementById(container) : container;

    // Clear container content explicitly if needed, but usually we append or overwrite.
    if (targetContainer) {
        targetContainer.innerHTML = '';

        if (label) {
            const labelEl = document.createElement('label');
            labelEl.style.fontWeight = 'bold';
            labelEl.style.color = '#2d3748';
            labelEl.style.display = 'block';
            labelEl.style.marginBottom = '0.5rem';
            labelEl.innerHTML = label;
            targetContainer.appendChild(labelEl);
        }
    }

    const select = document.createElement('select');
    select.id = id;
    select.style.width = '100%';
    select.style.padding = '0.75rem';
    select.style.border = '2px solid #cbd5e0';
    select.style.borderRadius = '8px';
    select.style.fontSize = '1rem';

    if (multiple) {
        select.multiple = true;
        select.style.minHeight = '150px';
    }

    if (disabled || !columns || columns.length === 0) {
        select.disabled = true;
        select.innerHTML = `<option value="">${placeholder}</option>`;
    } else {
        let html = '';
        if (!multiple) {
            html += `<option value="">${placeholder}</option>`;
        }
        html += columns.map(col => `<option value="${col}">${col}</option>`).join('');
        select.innerHTML = html;

        // Click-to-toggle logic for multiple select
        if (multiple) {
            select.addEventListener('mousedown', function (e) {
                if (e.target.tagName === 'OPTION') {
                    e.preventDefault();
                    const originalScrollTop = this.scrollTop;
                    e.target.selected = !e.target.selected;
                    setTimeout(() => {
                        this.scrollTop = originalScrollTop;
                    }, 0);
                    this.focus();
                }
            });
        }
    }

    if (targetContainer) {
        targetContainer.appendChild(select);
    }
    return select;
}

/**
 * サンプルサイズ情報（全体N、グループ別N）のHTMLを生成して表示する
 * @param {HTMLElement|string} container - 表示先のコンテナ要素またはID
 * @param {number} totalN - 全体サンプルサイズ
 * @param {Array} groups - グループ情報の配列 [{ label: "Group A", count: 10, color: "#11b981", icon: "fas fa-user-tag" }, ...]
 */
export function renderSampleSizeInfo(container, totalN, groups = []) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return;

    // グループカードの生成
    const groupCards = groups.map(g => {
        const color = g.color || '#64748b'; // default grey
        const icon = g.icon || 'fas fa-user-tag';
        return `
        <div style="flex: 1; min-width: 150px; background: white; padding: 1rem; border-radius: 8px; border-left: 5px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.25rem;">
                <i class="${icon}" style="margin-right: 0.5rem; color: ${color};"></i>${g.label}
            </div>
            <div style="font-weight: bold; color: #1e293b; font-size: 1.5rem;">
               ${g.count}
            </div>
        </div>
    `;
    }).join('');

    const html = `
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 2rem;">
        <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
            <i class="fas fa-users"></i> サンプルサイズ
        </h4>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <div style="flex: 1; min-width: 150px; background: white; padding: 1rem; border-radius: 8px; border-left: 5px solid #1e90ff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-globe" style="margin-right: 0.5rem; color: #1e90ff;"></i>全体
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 1.5rem;">
                   N = ${totalN}
                </div>
            </div>
            ${groupCards}
        </div>
    </div>
`;

    // 既存のコンテンツに追加するか、置き換えるか。
    // ここでは新しいdivを作成して追加する安全な方法をとる
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    target.appendChild(wrapper.firstElementChild);
}

/**
 * 分析実行ボタンを生成して表示する
 * @param {HTMLElement|string} container - 表示先のコンテナ要素またはID
 * @param {string} text - ボタンのテキスト
 * @param {Function} onClick - クリック時のコールバック関数
 * @param {Object} options - オプション { icon: "fas fa-play", id: "btn-id", color: "#1e90ff" }
 */
export function createAnalysisButton(container, text, onClick, options = {}) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return;

    const iconClass = options.icon || 'fas fa-play';
    const btnId = options.id || `run-analysis-btn-${Date.now()}`;
    const btnColor = options.color || '#1e90ff';

    // 既存のボタンがあれば削除（再描画時など）
    if (options.id) {
        const existingBtn = document.getElementById(options.id);
        if (existingBtn) existingBtn.remove();
    }

    const button = document.createElement('button');
    button.id = btnId;
    button.className = 'btn-analysis'; // Use the CSS class

    // Only set the dynamic background color with inline style
    button.style.backgroundColor = btnColor;

    button.innerHTML = `<i class="${iconClass}"></i> ${text}`;

    button.addEventListener('click', onClick);

    target.appendChild(button);
    return button;
}

/**
 * Creates a standardized configuration object for Plotly charts.
 * Enables PNG download with a custom filename based on analysis name, variables, and timestamp.
 * 
 * @param {string} analysisName - The name of the analysis (e.g., 't検定', '相関分析').
 * @param {string|string[]} variables - Variable name(s) involved in the plot.
 * @returns {Object} The Plotly configuration object.
 */
export function createPlotlyConfig(analysisName, variables) {
    const now = new Date();
    const dateStr = now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) + '-' +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2);

    let varStr = '';
    if (Array.isArray(variables)) {
        // Use first 3 variables to keep filename reasonable
        varStr = variables.slice(0, 3).join('_');
        if (variables.length > 3) varStr += '_etc';
    } else {
        varStr = variables;
    }

    // Sanitize filename (remove special chars if any, but usually var names are safe enough or we keep simple)
    // Replace non-alphanumeric chars (except _ and -) could be good but let's trust variable names for now
    const filename = `${analysisName}_${varStr}_${dateStr}`;

    return {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png',
            filename: filename,
            height: 800,
            width: 1200,
            scale: 2 // High resolution
        },
        modeBarButtonsToRemove: ['lasso2d', 'select2d'] // Optional
    };
}

/**
 * Creates visualization controls (Axis Labels and Graph Title toggles).
 * @param {HTMLElement|string} container - The container element or ID.
 * @returns {Object} An object containing the checkbox elements { axisControl, titleControl }.
 */
export function createVisualizationControls(container) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return null;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '1rem';
    wrapper.style.padding = '0.75rem';
    wrapper.style.background = '#f0f9ff';
    wrapper.style.border = '1px solid #bae6fd';
    wrapper.style.borderRadius = '8px';
    wrapper.style.display = 'flex';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '1rem';
    wrapper.style.alignItems = 'center';

    // Axis Label Control
    const axisWrapper = document.createElement('div');
    axisWrapper.style.display = 'flex';
    axisWrapper.style.alignItems = 'center';

    const axisCheckbox = document.createElement('input');
    axisCheckbox.type = 'checkbox';
    axisCheckbox.id = 'show-axis-labels';
    axisCheckbox.checked = true;
    axisCheckbox.style.marginRight = '0.5rem';
    axisCheckbox.style.transform = 'scale(1.2)';
    axisCheckbox.style.cursor = 'pointer';

    const axisLabel = document.createElement('label');
    axisLabel.htmlFor = 'show-axis-labels';
    axisLabel.textContent = '軸ラベルを表示';
    axisLabel.style.fontWeight = 'bold';
    axisLabel.style.color = '#0c4a6e';
    axisLabel.style.cursor = 'pointer';
    axisLabel.style.userSelect = 'none';

    axisWrapper.appendChild(axisCheckbox);
    axisWrapper.appendChild(axisLabel);

    // Graph Title Control
    const titleWrapper = document.createElement('div');
    titleWrapper.style.display = 'flex';
    titleWrapper.style.alignItems = 'center';

    const titleCheckbox = document.createElement('input');
    titleCheckbox.type = 'checkbox';
    titleCheckbox.id = 'show-graph-title';
    titleCheckbox.checked = true;
    titleCheckbox.style.marginRight = '0.5rem';
    titleCheckbox.style.transform = 'scale(1.2)';
    titleCheckbox.style.cursor = 'pointer';

    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'show-graph-title';
    titleLabel.textContent = 'グラフタイトルを表示';
    titleLabel.style.fontWeight = 'bold';
    titleLabel.style.color = '#0c4a6e';
    titleLabel.style.cursor = 'pointer';
    titleLabel.style.userSelect = 'none';

    titleWrapper.appendChild(titleCheckbox);
    titleWrapper.appendChild(titleLabel);

    wrapper.appendChild(axisWrapper);
    wrapper.appendChild(titleWrapper);
    target.appendChild(wrapper);

    return { axisControl: axisCheckbox, titleControl: titleCheckbox };
}

// Keep this for backward compatibility if needed, or remove if all usages are updated.
// For now, I'll remove it as I plan to update all usages.
// export function createAxisLabelControl... REMOVED

// 縦書き（Tategaki）文字列への変換
export function toTategaki(text) {
    if (!text) return '';
    return text.split('').join('<br>');
}

// 縦書きタイトルの注釈オブジェクト生成
export function getTategakiAnnotation(text, x = -0.15, y = 0.5) {
    if (!text) return null;
    return {
        text: toTategaki(text),
        xref: 'paper',
        yref: 'paper',
        x: x,
        y: y,
        showarrow: false,
        xanchor: 'right',
        yanchor: 'middle',
        font: { size: 14, color: '#444' }
    };
}

// グラフ下部のタイトル注釈オブジェクト生成
export function getBottomTitleAnnotation(text) {
    if (!text) return null;
    return {
        text: text,
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: -0.25, // Bottom position
        xanchor: 'center',
        yanchor: 'top',
        showarrow: false,
        font: { size: 16, color: '#2c3e50', weight: 'bold' } // Slightly larger and bold
    };
}
