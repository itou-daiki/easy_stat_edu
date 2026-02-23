// ==========================================
// UI Helpers
// ==========================================
import { MultiSelect } from './components/MultiSelect.js';

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

/**
 * Performs Levene's Test for Homogeneity of Variance (k groups).
 * Supports both (group1, group2) arguments or ([group1, group2, ...]) argument.
 * @param {Array<number[]>|number[]} groups - Array of arrays, where each inner array is data for a group.
 * @returns {object} { F, p, significant }
 */
export function calculateLeveneTest(groups) {
    let groupArrays = [];
    if (arguments.length > 1) {
        groupArrays = Array.from(arguments);
    } else if (Array.isArray(groups) && Array.isArray(groups[0])) {
        groupArrays = groups;
    } else {
        return { F: 0, p: 1, significant: false };
    }

    // 1. Calculate medians (Brown-Forsythe variant: more robust to non-normality)
    const groupMedians = groupArrays.map(g => jStat.median(g));

    // 2. Calculate absolute deviations from group medians
    const deviations = groupArrays.map((g, i) => g.map(v => Math.abs(v - groupMedians[i])));

    // 3. Perform One-Way ANOVA on deviations
    const allDevs = deviations.flat();
    const grandMeanDev = jStat.mean(allDevs);
    const N = allDevs.length;
    const k = groupArrays.length;

    // Sum of Squares Between
    let SSb = 0;
    deviations.forEach((gDevs, i) => {
        const meanDev = jStat.mean(gDevs);
        SSb += gDevs.length * Math.pow(meanDev - grandMeanDev, 2);
    });
    const dfb = k - 1;
    const MSb = SSb / dfb;

    // Sum of Squares Within
    let SSw = 0;
    deviations.forEach((gDevs, i) => {
        const meanDev = jStat.mean(gDevs);
        SSw += jStat.sum(gDevs.map(d => Math.pow(d - meanDev, 2)));
    });
    const dfw = N - k;
    if (dfw <= 0 || dfb <= 0) {
        return { F: NaN, p: NaN, significant: false };
    }
    const MSw = SSw / dfw;
    if (MSw === 0) {
        // MSw=0 means all within-group deviations are identical
        // If MSb is also 0, groups have equal variance → not significant
        if (MSb === 0) {
            return { F: 0, p: 1, significant: false };
        }
        return { F: Infinity, p: 0, significant: true };
    }

    const F = MSb / MSw;
    const p = 1 - jStat.centralF.cdf(F, dfb, dfw);

    return { F, p, significant: p < 0.05 };
}

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

    // If it's a multi-select, use the custom component
    if (multiple) {
        return createCustomMultiSelect(targetContainer, columns, id, placeholder, disabled);
    }

    const select = document.createElement('select');
    select.id = id;
    select.style.width = '100%';
    select.style.padding = '0.75rem';
    select.style.border = '2px solid #cbd5e0';
    select.style.borderRadius = '8px';
    select.style.fontSize = '1rem';

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
    }

    if (targetContainer) {
        targetContainer.appendChild(select);
    }
    return select;
}

/**
 * Helper to create a custom multi-select component.
 */
function createCustomMultiSelect(container, options, id, placeholder, disabled) {
    // Hidden native select for compatibility (value holding)
    const hiddenSelect = document.createElement('select');
    hiddenSelect.id = id;
    hiddenSelect.multiple = true;
    hiddenSelect.style.display = 'none'; // Hide it

    // Add options to hidden select
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.text = opt;
        hiddenSelect.appendChild(option);
    });
    container.appendChild(hiddenSelect);

    if (disabled || !options || options.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'multiselect-input disabled';
        msg.style.background = '#f1f5f9';
        msg.style.cursor = 'not-allowed';
        msg.innerHTML = '<span class="multiselect-placeholder">選択可能な項目がありません</span>';
        container.appendChild(msg);
        return hiddenSelect;
    }

    const msContainer = document.createElement('div');
    container.appendChild(msContainer);

    // Instantiate MultiSelect with compatibility wrapper
    const ms = new MultiSelect(msContainer, options, {
        placeholder: placeholder,
        defaultSelected: [],
        onChange: (selectedValues) => {
            Array.from(hiddenSelect.options).forEach(opt => {
                opt.selected = selectedValues.includes(opt.value);
            });
            hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    return hiddenSelect;
}

/**
 * Creates a specialized single-select component for pair selection (Pre/Post).
 * Matches the DOM structure expected by the pairs test.
 * @param {string} containerId - Container ID to append to.
 * @param {Array<string>} options - List of variable names.
 * @param {string} id - ID for the hidden select element.
 * @param {string} placeholder - Placeholder text.
 */
export function createPairSelector(containerId, options, id, placeholder) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Hidden select for value holding
    const hiddenSelect = document.createElement('select');
    hiddenSelect.id = id;
    hiddenSelect.style.display = 'none';
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.text = opt;
        hiddenSelect.appendChild(o);
    });
    container.appendChild(hiddenSelect);

    if (!options || options.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'pairs-select-input disabled';
        msg.textContent = '変数なし';
        container.appendChild(msg);
        return;
    }

    // Custom UI Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'pairs-select-wrapper';
    wrapper.style.position = 'relative';

    // Input Area
    const inputArea = document.createElement('div');
    inputArea.className = 'pairs-select-input';
    inputArea.style.border = '1px solid #e2e8f0';
    inputArea.style.padding = '0.5rem';
    inputArea.style.borderRadius = '6px';
    inputArea.style.cursor = 'pointer';
    inputArea.style.background = 'white';
    inputArea.style.display = 'flex';
    inputArea.style.justifyContent = 'space-between';
    inputArea.style.alignItems = 'center';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'pairs-current-value';
    labelSpan.textContent = placeholder;
    labelSpan.style.color = '#64748b';
    inputArea.appendChild(labelSpan);

    const arrow = document.createElement('i');
    arrow.className = 'fas fa-chevron-down';
    arrow.style.color = '#cbd5e1';
    inputArea.appendChild(arrow);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'pairs-select-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.right = '0';
    dropdown.style.background = 'white';
    dropdown.style.border = '1px solid #e2e8f0';
    dropdown.style.borderRadius = '6px';
    dropdown.style.zIndex = '100';
    dropdown.style.marginTop = '4px';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    dropdown.style.display = 'none';

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'pairs-select-option';
        item.style.padding = '0.5rem';
        item.style.cursor = 'pointer';
        item.textContent = opt;
        item.dataset.value = opt;

        item.addEventListener('mouseenter', () => item.style.background = '#f1f5f9');
        item.addEventListener('mouseleave', () => item.style.background = 'white');

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            // Update hidden select
            hiddenSelect.value = opt;
            hiddenSelect.dispatchEvent(new Event('change')); // Trigger change listener

            // Update UI
            labelSpan.textContent = opt;
            labelSpan.style.color = '#334155';
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(item);
    });

    // Toggle Dropdown
    inputArea.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        // Close others
        document.querySelectorAll('.pairs-select-dropdown').forEach(d => d.style.display = 'none');
        dropdown.style.display = isOpen ? 'none' : 'block';
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    wrapper.appendChild(inputArea);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);

    return hiddenSelect;
}

/**
 * Creates a specialized multi-pair selector component.
 * Allows adding/removing rows of Pre/Post variable pairs.
 * @param {string} containerId - Container ID to append to.
 * @param {Array<string>} options - List of variable names.
 */
export function createMultiPairSelector(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '1fr 1fr 40px';
    header.style.gap = '0.5rem';
    header.style.marginBottom = '0.5rem';
    header.style.fontWeight = 'bold';
    header.style.color = '#4b5563';
    header.style.fontSize = '0.9rem';
    header.innerHTML = `
        <div>Pre (Time 1)</div>
        <div>Post (Time 2)</div>
        <div></div>
    `;
    container.appendChild(header);

    // List Container
    const listContainer = document.createElement('div');
    listContainer.id = `${containerId}-list`;
    listContainer.style.marginBottom = '0.5rem';
    container.appendChild(listContainer);

    // Add Button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary';
    addBtn.style.fontSize = '0.85rem';
    addBtn.style.padding = '0.25rem 0.75rem';
    addBtn.innerHTML = '<i class="fas fa-plus"></i> ペアを追加';
    addBtn.onclick = () => addPairRow(listContainer, options);
    container.appendChild(addBtn);

    // Helper to add a row
    function addPairRow(parent, opts) {
        const row = document.createElement('div');
        row.className = 'pair-row';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr 40px';
        row.style.gap = '0.5rem';
        row.style.marginBottom = '0.5rem';

        const createSelect = (cls) => {
            const sel = document.createElement('select');
            sel.className = `form-select ${cls}`;
            sel.style.width = '100%';
            sel.style.fontSize = '0.9rem';
            sel.style.padding = '0.4rem';

            let html = '<option value="">選択...</option>';
            opts.forEach(o => html += `<option value="${o}">${o}</option>`);
            sel.innerHTML = html;
            return sel;
        };

        const preSelect = createSelect('pre-select');
        const postSelect = createSelect('post-select');

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-icon';
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.border = 'none';
        removeBtn.style.background = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.title = '削除';
        removeBtn.onclick = () => row.remove();

        row.appendChild(preSelect);
        row.appendChild(postSelect);
        row.appendChild(removeBtn);
        parent.appendChild(row);
    }

    // Add initial empty row
    addPairRow(listContainer, options);
}

/**
 * Creates a selector for multiple sets of variables (for One-Way Repeated ANOVA).
 * Each set can have multiple variables (min 3).
 * @param {string} containerId - Container ID.
 * @param {Array<string>} options - List of variable names.
 */
export function createMultiSetSelector(containerId, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // List Container
    const listContainer = document.createElement('div');
    listContainer.id = `${containerId}-list`;
    listContainer.style.marginBottom = '1rem';
    container.appendChild(listContainer);

    // Add Set Button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary';
    addBtn.style.fontSize = '0.9rem';
    addBtn.style.padding = '0.5rem 1rem';
    addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> 分析セットを追加 (変数3つ以上)';
    addBtn.onclick = () => addSetRow(listContainer, options);
    container.appendChild(addBtn);

    // Helper to add a set row
    function addSetRow(parent, opts) {
        const row = document.createElement('div');
        row.className = 'set-row';
        row.style.background = '#f8fafc';
        row.style.border = '1px solid #e2e8f0';
        row.style.borderRadius = '8px';
        row.style.padding = '1rem';
        row.style.marginBottom = '1rem';
        row.style.position = 'relative';

        // Remove Button (Top Right)
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-icon';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '0.5rem';
        removeBtn.style.right = '0.5rem';
        removeBtn.style.color = '#94a3b8';
        removeBtn.style.border = 'none';
        removeBtn.style.background = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = () => row.remove();
        row.appendChild(removeBtn);

        // Title
        const title = document.createElement('h5');
        title.style.margin = '0 0 0.5rem 0';
        title.style.fontSize = '0.95rem';
        title.style.color = '#475569';
        title.innerHTML = '<i class="fas fa-layer-group"></i> 分析セット';
        row.appendChild(title);

        // Variable Selector Area
        const varSelectorContainer = document.createElement('div');
        varSelectorContainer.className = 'multi-set-vars'; // Added class for querying
        // Use a unique ID for the internal selector
        const uniqueId = `set-selector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        varSelectorContainer.id = uniqueId;
        row.appendChild(varSelectorContainer);

        // Append to parent first so it's in the DOM
        parent.appendChild(row);

        // Create the selector using the standard helper
        createVariableSelector(uniqueId, opts, uniqueId + '-select', {
            label: '変数を選択（3つ以上）:',
            multiple: true
        });
    }

    // Add initial empty set
    addSetRow(listContainer, options);
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

/**
 * Adds significance brackets and annotations to a Plotly layout.
 * Automatically handles vertical stacking to prevent overlaps.
 * 
 * @param {Object} layout - The Plotly layout object to modify (in-place).
 * @param {Array} pairs - Array of comparison objects: { g1: string, g2: string, significance: string, p: number }
 * @param {Object|Array} xMap - Mapping of group names to x-coordinates (or array of group names in order).
 * @param {number} yMax - The maximum y-value of the data (baseline for brackets).
 * @param {number} yRange - The total range of the y-axis (used for scaling offsets).
 */
export function addSignificanceBrackets(layout, pairs, xMap, yMax, yRange) {
    if (!pairs || pairs.length === 0) return;

    // Filter significant pairs
    const significantPairs = pairs.filter(p => p.significance && p.significance !== 'n.s.');
    if (significantPairs.length === 0) return;

    // x-coordinate helper
    const getX = (groupName) => {
        if (Array.isArray(xMap)) {
            return xMap.indexOf(groupName);
        }
        return xMap[groupName];
    };

    // Sort pairs by span (distance between groups) ascending
    // This ensures smaller brackets are drawn first (lower), and larger ones stack above.
    significantPairs.sort((a, b) => {
        const spanA = Math.abs(getX(a.g1) - getX(a.g2));
        const spanB = Math.abs(getX(b.g1) - getX(b.g2));
        return spanA - spanB;
    });

    // Initialize shapes and annotations if not present
    if (!layout.shapes) layout.shapes = [];
    if (!layout.annotations) layout.annotations = [];

    // Configuration for spacing
    const bracketHeight = yRange * 0.03; // Height of the bracket "legs"
    const textOffset = yRange * 0.02;   // Distance text is above the bracket
    const stackStep = yRange * 0.08;    // Vertical space reserved for each level of brackets

    // Track the "skyline" (current max height) for each x-position
    // Assuming x-coordinates are integers 0, 1, 2... for groups
    const numGroups = Array.isArray(xMap) ? xMap.length : Object.keys(xMap).length;
    const columnHeights = new Array(numGroups).fill(yMax);

    // Track max occupied height for layout range update
    let maxOccupiedY = yMax;

    significantPairs.forEach(pair => {
        const x1 = getX(pair.g1);
        const x2 = getX(pair.g2);
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);

        // Find the current max height in the span [start, end]
        let currentLevelHeight = 0;
        for (let i = start; i <= end; i++) {
            if (columnHeights[i] > currentLevelHeight) {
                currentLevelHeight = columnHeights[i];
            }
        }

        // Determine drawing position (add step)
        const drawY = currentLevelHeight + stackStep;
        const textY = drawY + textOffset;

        // Draw bracket line (path)
        // M x1,y L x1,y+h L x2,y+h L x2,y
        const path = `M ${x1},${drawY - bracketHeight} L ${x1},${drawY} L ${x2},${drawY} L ${x2},${drawY - bracketHeight}`;

        layout.shapes.push({
            type: 'path',
            path: path,
            line: { color: 'black', width: 1.5 },
            xref: 'x',
            yref: 'y'
        });

        // Add annotation
        // Use <sup> to simulate superscript for dagger if needed, though simple text usually works better in Plotly
        // Converting special dagger to HTML entity or unicode usually standardizes display
        const text = pair.significance.replace('†', '†'); // Keep unicode or use HTML if supported by config

        layout.annotations.push({
            x: (x1 + x2) / 2,
            y: textY,
            text: text,
            showarrow: false,
            font: { size: 14, color: 'black' },
            xanchor: 'center',
            yanchor: 'bottom',
            _annotationType: 'bracket'
        });

        // Update column heights for the spanned range
        // The text occupies some space, so we reserve up to textY + limits
        const nextBaseline = textY + (yRange * 0.02); // Small buffer above text
        for (let i = start; i <= end; i++) {
            columnHeights[i] = nextBaseline;
        }

        if (nextBaseline > maxOccupiedY) {
            maxOccupiedY = nextBaseline;
        }
    });

    // Update layout yaxis range to accommodate brackets and annotation text.
    // Plotly auto-range includes shapes (data coords) but NOT annotations.
    // We must explicitly set the range to ensure bracket text is visible.
    const recommendedMaxY = maxOccupiedY + (yRange * 0.05);

    if (!layout.yaxis.range) {
        // For bar charts (most common use case), minimum is 0.
        // Set explicit range so bracket annotations are never cut off.
        layout.yaxis.range = [0, recommendedMaxY];
    } else {
        layout.yaxis.range[1] = Math.max(layout.yaxis.range[1], recommendedMaxY);
    }

    // Attach recommended max y to layout for caller usage if needed
    layout._recommendedMaxY = recommendedMaxY;
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
export function getTategakiAnnotation(text, x = -0.08, y = 0.5) {
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
        font: { size: 14, color: '#444' },
        _annotationType: 'tategaki'
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
        font: { size: 16, color: '#2c3e50', weight: 'bold' }, // Slightly larger and bold
        _annotationType: 'bottomTitle'
    };
}

/**
 * Generates an APA-style HTML table string.
 * @param {string} tableId - The ID for the table container (used for copy function if needed, though this returns HTML).
 * @param {string} title - The table caption/title (e.g., "Table 1. Results...").
 * @param {string[]} headerRow - Array of strings for the header columns.
 * @param {Array<Array<string|number>>} dataRows - 2D array of cell data.
 * @param {string} note - text for the "Note." section below the table.
 * @returns {string} The complete HTML string for the table container.
 */
export function generateAPATableHtml(tableId, title, headerRow, dataRows, note) {
    const tableStyle = "border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; color: #000; margin-bottom: 1rem;";
    const captionStyle = "text-align: left; font-style: italic; margin-bottom: 0.5em; font-weight: normal; font-size: 1.1em;";
    const theadStyle = "border-top: 2px solid #000; border-bottom: 1px solid #000;";
    const thStyle = "padding: 0.5em; text-align: center; font-weight: normal;"; // APA headers are often not bold, but can be. standard is normal.
    const tbodyStyle = "border-bottom: 2px solid #000;";
    const tdStyle = "padding: 0.5em; text-align: center;";
    const firstColStyle = "padding: 0.5em; text-align: left;"; // First column often left-aligned

    let html = `<div id="${tableId}_container" class="apa-table-wrapper" style="background:white; padding:1rem; border: 1px solid #e2e8f0; border-radius: 4px;">
        <table id="${tableId}" style="${tableStyle}">
            <caption style="${captionStyle}">${title}</caption>
            <thead style="${theadStyle}">
                <tr>`;

    headerRow.forEach((h, i) => {
        html += `<th style="${i === 0 ? firstColStyle : thStyle}">${h}</th>`;
    });

    html += `   </tr>
            </thead>
            <tbody style="${tbodyStyle}">`;

    dataRows.forEach(row => {
        html += '<tr>';
        row.forEach((cell, i) => {
            html += `<td style="${i === 0 ? firstColStyle : tdStyle}">${cell}</td>`;
        });
        html += '</tr>';
    });

    html += `   </tbody>
        </table>`;

    if (note) {
        html += `<div style="font-size: 0.9em; margin-top: 0.5em; font-style: italic;">Note. ${note}</div>`;
    }

    // Add Copy Button
    html += `
        <button onclick="copyAPATable('${tableId}')" class="btn btn-sm btn-outline-secondary" style="margin-top: 0.5rem; font-family: sans-serif;">
            <i class="fas fa-copy"></i> 表をコピー
        </button>
    </div>
    <script>
        if (typeof copyAPATable === 'undefined') {
            window.copyAPATable = function(id) {
                const table = document.getElementById(id);
                const container = table.closest('.apa-table-wrapper');
                const range = document.createRange();
                range.selectNode(container); 
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
                alert('表をクリップボードにコピーしました (Word/Excelに貼り付けてください)');
            }
        }
    </script>
    `;

    return html;
}

// ==========================================
// Interpretation Helpers
// ==========================================

export const InterpretationHelper = {
    /**
     * P値の判定とフォーマット
     * @param {number} p - P値
     * @returns {object} { text, isSignificant, stars }
     */
    evaluatePValue(p) {
        if (p < 0.001) return { text: "p < .001", isSignificant: true, stars: "**" };
        if (p < 0.01) return { text: "p < .01", isSignificant: true, stars: "**" };
        if (p < 0.05) return { text: "p < .05", isSignificant: true, stars: "*" };
        if (p < 0.1) return { text: "p < .10", isSignificant: false, stars: "†" }; // 傾向
        return { text: "n.s.", isSignificant: false, stars: "" };
    },

    /**
     * 相関係数の解釈
     * @param {number} r - 相関係数
     * @param {number} p - P値
     * @param {string} var1 - 変数1の名前
     * @param {string} var2 - 変数2の名前
     * @returns {string} 解釈文
     */
    interpretCorrelation(r, p, var1, var2) {
        const absR = Math.abs(r);
        const pEval = this.evaluatePValue(p);

        let strength = "";
        if (absR < 0.2) strength = "非常に弱い";
        else if (absR < 0.4) strength = "弱い";
        else if (absR < 0.7) strength = "中程度の";
        else strength = "強い";

        let direction = r > 0 ? "正" : "負";
        if (absR < 0.1) direction = ""; // ほぼ無相関なら方向言及しない

        let text = `「<strong>${var1}</strong>」と「<strong>${var2}</strong>」の間には、`;

        if (pEval.isSignificant) {
            text += `統計的に有意な<strong>${strength}${direction}の相関</strong>が見られました (<em>r</em> = ${r.toFixed(2)}, ${pEval.text})。`;
            if (r > 0) text += `<br>つまり、<strong>${var1}が高いほど、${var2}も高い</strong>傾向があります。`;
            else text += `<br>つまり、<strong>${var1}が高いほど、${var2}は低い</strong>傾向があります。`;
        } else {
            text += `統計的に有意な相関は見られませんでした (<em>r</em> = ${r.toFixed(2)}, <em>p</em> = ${p.toFixed(2)})。`;
            text += `<br>2つの変数の間に関連性があるとは言えません。`;
        }
        return text;
    },

    /**
     * T検定（平均値の差）の解釈
     * @param {number} p - P値
     * @param {number} mean1 - 群1の平均
     * @param {number} mean2 - 群2の平均
     * @param {string[]} groupNames - [群1名, 群2名] Or 変数名ペア
     * @param {number} d - 効果量 (Cohen's d)
     * @param {string} varName - 従属変数名 (Optional)
     * @returns {string} 解釈文
     */
    interpretTTest(p, mean1, mean2, groupNames, d, varName = "") {
        const pEval = this.evaluatePValue(p);
        const g1 = groupNames[0];
        const g2 = groupNames[1];
        const varText = varName ? `「<strong>${varName}</strong>」について、` : "";

        let dText = "";
        if (d !== undefined && d !== null) {
            const absD = Math.abs(d);
            let dSize = "";
            if (absD < 0.2) dSize = "ごくわずか";
            else if (absD < 0.5) dSize = "小";
            else if (absD < 0.8) dSize = "中程度";
            else dSize = "大";
            dText = `, <em>d</em> = ${d.toFixed(2)} [${dSize}]`;
        }

        if (pEval.isSignificant) {
            const high = mean1 > mean2 ? g1 : g2;
            const low = mean1 > mean2 ? g2 : g1;
            return `${varText}<strong>${high}は${low}よりも有意に高い</strong>値を示しました (${pEval.text}${dText})。<br>` +
                `平均値の差は統計的に意味があると言えます。`;
        } else {
            return `${varText}「<strong>${g1}</strong>」と「<strong>${g2}</strong>」の間に、統計的に有意な差は見られませんでした (<em>p</em> = ${p.toFixed(2)}${dText})。<br>` +
                `平均値の違いは偶然の範囲内である可能性があります。`;
        }
    },

    /**
     * 分散分析 (ANOVA) の解釈
     * @param {number} p - P値
     * @param {number} eta2 - 効果量 (Eta-squared)
     * @param {string} factorName - 要因名
     * @param {string} varName - 従属変数名 (Optional)
     * @returns {string} 解釈文
     */
    interpretANOVA(p, eta2, factorName, varName = "") {
        const pEval = this.evaluatePValue(p);
        const varText = varName ? `「<strong>${varName}</strong>」に対して、` : "";

        let etaText = "";
        if (eta2 !== undefined && eta2 !== null) {
            let size = "";
            if (eta2 < 0.01) size = "ごくわずか";
            else if (eta2 < 0.06) size = "小";
            else if (eta2 < 0.14) size = "中程度";
            else size = "大";
            etaText = `, <em>η²</em> = ${eta2.toFixed(2)} [${size}]`;
        }

        if (pEval.isSignificant) {
            return `${varText}要因「<strong>${factorName}</strong>」による<strong>主効果は有意</strong>でした (${pEval.text}${etaText})。<br>` +
                `つまり、グループ間で平均値に統計的な差があると言えます。<br>` +
                `どのグループ間に差があるか確認するには、多重比較の結果を参照してください。`;
        } else {
            return `${varText}要因「<strong>${factorName}</strong>」による有意な主効果は見られませんでした (<em>p</em> = ${p.toFixed(2)}${etaText})。<br>` +
                `グループ間の平均値に統計的な違いがあるとは言えません。`;
        }
    },

    /**
     * カイ二乗検定の解釈
     * @param {number} p - P値
     * @param {number} cramerV - クラメールのV
     * @returns {string} 解釈文
     */
    interpretChiSquare(p, cramerV, rowVar = "", colVar = "") {
        const pEval = this.evaluatePValue(p);
        const varsText = (rowVar && colVar) ? `「<strong>${rowVar}</strong>」と「<strong>${colVar}</strong>」の間には` : "2つの変数の間には";

        let vText = "";
        if (cramerV !== undefined && cramerV !== null) {
            let size = "";
            if (cramerV < 0.1) size = "ごくわずか";
            else if (cramerV < 0.3) size = "小";
            else if (cramerV < 0.5) size = "中程度";
            else size = "大";
            vText = `, <em>V</em> = ${cramerV.toFixed(2)} [${size}]`;
        }

        if (pEval.isSignificant) {
            return `${varsText}<strong>有意な関連（連関）</strong>があります (${pEval.text}${vText})。<br>` +
                `変数の組み合わせによって偏りがある（独立ではない）と言えます。<br>` +
                `具体的な偏りについては、調整済み残差の表を確認してください。`;
        } else {
            return `${varsText}有意な関連は見られませんでした (<em>p</em> = ${p.toFixed(2)}${vText})。<br>` +
                `変数は互いに独立である（偏りがない）と考えられます。`;
        }
    },

    /**
     * 回帰分析の解釈
     * @param {number} r2 - 決定係数
     * @param {number} p - モデルのP値
     * @param {string} depVar - 目的変数名
     * @param {Array} coeffs - 係数情報の配列 [{name, beta, p, stdBeta}]
     * @returns {string} 解釈文
     */
    interpretRegression(r2, p, depVar, coeffs) {
        const pEval = this.evaluatePValue(p);
        let text = "";

        if (pEval.isSignificant) {
            text += `回帰モデルは<strong>統計的に有意</strong>であり (${pEval.text})、`;
            text += `説明変数は「<strong>${depVar}</strong>」の変動の約<strong>${(r2 * 100).toFixed(1)}%</strong>を説明しています (R²=${r2.toFixed(2)})。<br>`;

            const sigCoeffs = coeffs.filter(c => c.p < 0.05);
            if (sigCoeffs.length > 0) {
                text += `特に、以下の変数が有意な影響を与えています：<ul style='margin-top:0.5rem; margin-bottom: 0;'>`;
                sigCoeffs.forEach(c => {
                    const dir = c.beta > 0 ? "正（増加させる）" : "負（減少させる）";
                    const standardizedInfo = c.stdBeta !== undefined ? `標準化係数 β=${c.stdBeta.toFixed(2)}` : `係数 B=${c.beta.toFixed(2)}`;
                    text += `<li><strong>${c.name}</strong>：${dir}影響 (${standardizedInfo})</li>`;
                });
                text += `</ul>`;
            } else {
                text += `ただし、個々の説明変数で単独で有意な影響を示したものはありませんでした（多重共線性などの可能性があります）。`;
            }
        } else {
            text += `回帰モデルは統計的に有意ではありませんでした (${pEval.text})。<br>`;
            text += `選択された説明変数では、「<strong>${depVar}</strong>」を十分に予測できない可能性があります。`;
        }
        return text;
    },

    /**
     * マン・ホイットニーのU検定の解釈
     * @param {number} p - P値
     * @param {number} meanRank1 - 群1の平均順位
     * @param {number} meanRank2 - 群2の平均順位
     * @param {Array} groups - グループ名の配列
     * @param {number} r - 効果量 r
     * @returns {string} 解釈文
     */
    interpretMannWhitney(p, meanRank1, meanRank2, groups, r) {
        const pEval = this.evaluatePValue(p);
        let text = "";

        // 効果量の判定 (Cohen's criteria for r)
        let effectSizeText = "";
        if (Math.abs(r) < 0.1) effectSizeText = "ほとんどない";
        else if (Math.abs(r) < 0.3) effectSizeText = "小さい";
        else if (Math.abs(r) < 0.5) effectSizeText = "中程度";
        else effectSizeText = "大きい";

        const higherGroup = meanRank1 > meanRank2 ? groups[0] : groups[1];

        if (pEval.isSignificant) {
            text += `2つのグループ間（${groups[0]} vs ${groups[1]}）には、統計的に<strong>有意な差が認められました</strong> (${pEval.text})。<br>`;
            text += `平均順位を見ると、<strong>${higherGroup}</strong>の方が順位が高くなっており、値が大きい傾向にあります。<br>`;
            text += `効果量 r = ${r.toFixed(2)} であり、グループ間の差は「<strong>${effectSizeText}</strong>」水準です。`;
        } else {
            text += `2つのグループ間には、統計的に有意な差は認められませんでした (${pEval.text})。<br>`;
            text += `平均順位は ${groups[0]}: ${meanRank1.toFixed(2)}, ${groups[1]}: ${meanRank2.toFixed(2)} です。<br>`;
            text += `効果量 r = ${r.toFixed(2)} (${effectSizeText}) です。`;
        }
        return text;
    },

    /**
     * ウィルコクソンの符号付順位検定の解釈
     * @param {number} p - P値
     * @param {number} r - 効果量 r
     * @param {string} var1 - 変数1の名前
     * @param {string} var2 - 変数2の名前
     * @param {number} median1 - 変数1の中央値
     * @param {number} median2 - 変数2の中央値
     * @returns {string} 解釈文
     */
    interpretWilcoxonSignedRank(p, r, var1, var2, median1, median2) {
        const pEval = this.evaluatePValue(p);
        let text = "";

        let effectSizeText = "";
        if (Math.abs(r) < 0.1) effectSizeText = "ほとんどない";
        else if (Math.abs(r) < 0.3) effectSizeText = "小さい";
        else if (Math.abs(r) < 0.5) effectSizeText = "中程度";
        else effectSizeText = "大きい";

        if (pEval.isSignificant) {
            const higher = median1 > median2 ? var1 : var2;
            const lower = median1 > median2 ? var2 : var1;
            text += `「<strong>${var1}</strong>」と「<strong>${var2}</strong>」の間には、統計的に<strong>有意な差が認められました</strong> (${pEval.text})。<br>`;
            text += `中央値を比較すると、<strong>${higher}</strong>の方が高い値を示しています。<br>`;
            text += `効果量 r = ${r.toFixed(2)} であり、差の大きさは「<strong>${effectSizeText}</strong>」水準です。`;
        } else {
            text += `「<strong>${var1}</strong>」と「<strong>${var2}</strong>」の間には、統計的に有意な差は認められませんでした (${pEval.text})。<br>`;
            text += `中央値: ${var1} = ${median1.toFixed(2)}, ${var2} = ${median2.toFixed(2)}。<br>`;
            text += `効果量 r = ${r.toFixed(2)} (${effectSizeText}) です。`;
        }
        return text;
    }
};
