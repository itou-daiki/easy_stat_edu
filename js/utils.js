// ==========================================
// UI Helpers
// ==========================================
import { MultiSelect } from './components/MultiSelect.js';
import { getSignificanceSymbol } from './analyses/constants.js';
import { performHolmCorrection } from './utils/stat_distributions.js';

export { getSignificanceSymbol };

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
 * 空欄として扱うセルかを判定する。0 や false は有効値として保持する。
 * @param {*} value - セル値
 * @returns {boolean}
 */
export function isMissingCell(value) {
    return value == null || (typeof value === 'string' && value.trim() === '');
}

function compareCategoryValues(a, b) {
    return String(a).localeCompare(String(b), 'ja', {
        numeric: true,
        sensitivity: 'base'
    });
}

/**
 * 2つのカテゴリ変数から、リストワイズ除外済みの分割表を作成する。
 * @param {Array<Object>} data - 行データ
 * @param {string} rowVar - 行変数
 * @param {string} colVar - 列変数
 * @returns {object}
 */
export function buildContingencyTable(data, rowVar, colVar) {
    const sourceRows = Array.isArray(data) ? data : [];
    const validRows = sourceRows.filter(row => (
        row
        && !isMissingCell(row[rowVar])
        && !isMissingCell(row[colVar])
    ));
    const rowKeys = [...new Set(validRows.map(row => row[rowVar]))].sort(compareCategoryValues);
    const colKeys = [...new Set(validRows.map(row => row[colVar]))].sort(compareCategoryValues);
    const rowIndex = new Map(rowKeys.map((value, index) => [value, index]));
    const colIndex = new Map(colKeys.map((value, index) => [value, index]));
    const observed = Array.from({ length: rowKeys.length }, () => new Array(colKeys.length).fill(0));

    validRows.forEach(row => {
        observed[rowIndex.get(row[rowVar])][colIndex.get(row[colVar])]++;
    });

    const rowTotals = observed.map(row => row.reduce((sum, value) => sum + value, 0));
    const colTotals = colKeys.map((_, col) => (
        observed.reduce((sum, row) => sum + row[col], 0)
    ));
    const total = validRows.length;
    const expected = rowKeys.map((_, row) => (
        colKeys.map((__, col) => (
            total > 0 ? (rowTotals[row] * colTotals[col]) / total : 0
        ))
    ));

    return {
        rowKeys,
        colKeys,
        observed,
        rowTotals,
        colTotals,
        expected,
        total,
        validRows,
        excludedRows: sourceRows.length - validRows.length
    };
}

/**
 * 調整済み標準化残差からセルごとの両側p値を求める。
 * 2×2表は独立な対比が1つなので補正せず、R×C表は全セルを1族としてHolm補正する。
 * @param {number[][]} residuals - 調整済み標準化残差
 * @returns {Array<Array<{raw: number, adjusted: number, method: string}>>}
 */
export function calculateResidualPValues(residuals) {
    const rowCount = residuals.length;
    const colCount = residuals[0]?.length || 0;
    const cells = residuals.flatMap((row, rowIndex) => (
        row.map((z, colIndex) => {
            const raw = Number.isFinite(z)
                ? Math.min(1, Math.max(0, 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1))))
                : NaN;
            return { rowIndex, colIndex, p: raw };
        })
    ));
    const is2x2 = rowCount === 2 && colCount === 2;
    const adjustedCells = is2x2
        ? cells.map(cell => ({ ...cell, p_holm: cell.p }))
        : performHolmCorrection(cells);
    const result = Array.from({ length: rowCount }, () => new Array(colCount));

    adjustedCells.forEach(cell => {
        result[cell.rowIndex][cell.colIndex] = {
            raw: cell.p,
            adjusted: cell.p_holm,
            method: is2x2 ? 'none-2x2' : 'holm'
        };
    });
    return result;
}

/**
 * p値を画面・報告表で共通利用できる形式へ整形する。
 * @param {number} p - p値
 * @param {object} options - 表示オプション
 * @returns {string}
 */
export function formatPValue(p, options = {}) {
    const { digits = 3, includeP = true, html = false } = options;
    const value = Number(p);
    const prefix = includeP ? (html ? '<em>p</em> ' : 'p ') : '';
    if (!Number.isFinite(value) || value < 0 || value > 1) return `${prefix}= -`;
    if (value < 0.001) return `${prefix}${html ? '&lt;' : '<'} .001`;
    return `${prefix}= ${value.toFixed(digits)}`;
}

let mathJaxPromise = null;

/**
 * TeX区切りを含む要素だけMathJaxで整形する。
 * 読み込みに失敗した場合は元の式を残し、分析画面の表示を継続する。
 * @param {HTMLElement} root - 数式を含む可能性があるルート要素
 * @returns {Promise<boolean>}
 */
export async function typesetMathIn(root) {
    if (!root || !/\\[\(\[]/.test(root.textContent || '')) return false;

    if (!mathJaxPromise) {
        if (window.MathJax?.typesetPromise) {
            mathJaxPromise = Promise.resolve(window.MathJax);
        } else {
            window.MathJax = {
                tex: {
                    inlineMath: [['\\(', '\\)']],
                    displayMath: [['\\[', '\\]']]
                },
                startup: { typeset: false }
            };
            mathJaxPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
                script.async = true;
                script.onload = () => resolve(window.MathJax);
                script.onerror = () => reject(new Error('MathJaxを読み込めませんでした。'));
                document.head.appendChild(script);
            }).catch(error => {
                console.warn(error.message);
                mathJaxPromise = null;
                return null;
            });
        }
    }

    const mathJax = await mathJaxPromise;
    if (!mathJax?.typesetPromise || !root.isConnected) return false;
    try {
        await mathJax.typesetPromise([root]);
        return true;
    } catch (error) {
        console.warn('数式を整形できませんでした。', error);
        return false;
    }
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
    if (!Number.isFinite(d)) return '効果量を計算できません';
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
    // Brown-Forsythe variant: deviations are computed from jStat.median below.
    let groupArrays = [];
    if (arguments.length > 1) {
        groupArrays = Array.from(arguments);
    } else if (Array.isArray(groups) && Array.isArray(groups[0])) {
        groupArrays = groups;
    } else {
        return { F: 0, p: 1, significant: false };
    }

    groupArrays = groupArrays
        .map(g => Array.isArray(g) ? g.filter(v => v != null && Number.isFinite(Number(v))).map(Number) : [])
        .filter(g => g.length > 0);

    if (groupArrays.length < 2 || groupArrays.some(g => g.length < 2)) {
        return { F: NaN, p: NaN, significant: false };
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
    if (N <= k) {
        return { F: NaN, p: NaN, significant: false };
    }

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
    if (!Number.isFinite(F) || !Number.isFinite(p)) {
        return { F: NaN, p: NaN, significant: false };
    }

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
        removeBtn.setAttribute('aria-label', 'ペア行を削除');
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
        removeBtn.title = '分析セットを削除';
        removeBtn.setAttribute('aria-label', '分析セットを削除');
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
 * 学術論文スタイルのPlotlyレイアウト設定を返す。
 * 森山(2023)の図表スタイルに準拠: セリフフォント、白背景、控えめなグリッド線。
 * 返り値はPlotly.newPlot()のlayout引数にスプレッド構文でマージして使用する。
 * @param {Object} overrides - 上書きしたいレイアウトプロパティ
 * @returns {Object} 学術的Plotlyレイアウト設定
 */
export function getAcademicLayout(overrides = {}) {
    const baseFont = {
        family: "'Times New Roman', 'Noto Serif JP', 'Yu Mincho', '游明朝', serif",
        size: 13,
        color: '#1a1a1a'
    };
    const base = {
        font: baseFont,
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        xaxis: {
            linecolor: '#333',
            linewidth: 1,
            mirror: true,
            gridcolor: '#e0e0e0',
            gridwidth: 1,
            zeroline: false,
            tickfont: { ...baseFont, size: 12 },
            title: { font: { ...baseFont, size: 13 } }
        },
        yaxis: {
            linecolor: '#333',
            linewidth: 1,
            mirror: true,
            gridcolor: '#e0e0e0',
            gridwidth: 1,
            zeroline: false,
            tickfont: { ...baseFont, size: 12 },
            title: { font: { ...baseFont, size: 13 } }
        },
        margin: { t: 50, b: 80, l: 70, r: 30 }
    };
    return deepMergeLayout(base, overrides);
}

function deepMergeLayout(base, overrides) {
    const result = { ...base };
    for (const key of Object.keys(overrides)) {
        if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && base[key] && typeof base[key] === 'object') {
            result[key] = deepMergeLayout(base[key], overrides[key]);
        } else {
            result[key] = overrides[key];
        }
    }
    return result;
}

/**
 * 学術論文向け配色パレット（森山スタイル準拠）。
 * 控えめでモノクロ印刷にも対応しやすいカラーセット。
 */
export const academicColors = {
    primary: '#2c5f8a',
    secondary: '#6b9bc3',
    tertiary: '#a3c4dc',
    accent: '#d4544a',
    neutral: '#7f8c8d',
    palette: ['#2c5f8a', '#d4544a', '#6b9bc3', '#e8a838', '#7f8c8d', '#5b8c5a', '#9b6b9b', '#c97c5e'],
    barFill: 'rgba(44, 95, 138, 0.7)',
    barLine: 'rgba(44, 95, 138, 1.0)',
    boxFill: 'rgba(107, 155, 195, 0.5)',
    boxLine: 'rgba(44, 95, 138, 1.0)',
    heatmapScale: [[0, '#f7fbff'], [0.25, '#c6dbef'], [0.5, '#6baed6'], [0.75, '#2171b5'], [1, '#08306b']],
    divergingScale: [[0, '#b2182b'], [0.25, '#ef8a62'], [0.5, '#f7f7f7'], [0.75, '#67a9cf'], [1, '#2166ac']]
};

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
        varStr = variables.slice(0, 3).join('_');
        if (variables.length > 3) varStr += '_etc';
    } else {
        varStr = variables;
    }

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
            scale: 2
        },
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };
}

const visualizationEditorInstallations = new WeakMap();
const capturedPlotSpecs = new WeakMap();
const plotEditorStates = new WeakMap();
const VISUALIZATION_ASPECT_RATIOS = Object.freeze({
    '16:9': 16 / 9,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    '1:1': 1
});
const DEFAULT_CUSTOM_ASPECT_RATIO = Object.freeze({
    width: 16,
    height: 9
});
const RATIO_VISUALIZATION_HEIGHT_LIMITS = Object.freeze({
    minimum: 120,
    maximum: 2000
});
let visualizationEditorSequence = 0;

function installPlotlySpecCapture() {
    if (!window.Plotly || window.Plotly.__easyStatSpecCaptureInstalled) return;

    const originalNewPlot = window.Plotly.newPlot;
    window.Plotly.newPlot = function easyStatNewPlot(graphDiv, data, layout, config) {
        const target = typeof graphDiv === 'string'
            ? document.getElementById(graphDiv)
            : graphDiv;
        const spec = { data, layout: layout || {}, config };
        const existingState = target ? plotEditorStates.get(target) : null;
        const reapplyEditorState = Boolean(existingState && !existingState.isEditorRedraw);
        const result = originalNewPlot.apply(this, arguments);
        if (target) {
            target.__easyStatPlotSpec = spec;
            capturedPlotSpecs.set(target, spec);
            if (existingState) existingState.plotSpec = spec;
        }
        if (result?.then) {
            result.then(resolvedTarget => {
                if (resolvedTarget) {
                    resolvedTarget.__easyStatPlotSpec = spec;
                    capturedPlotSpecs.set(resolvedTarget, spec);
                    if (existingState) {
                        existingState.target = resolvedTarget;
                        existingState.plotSpec = spec;
                        plotEditorStates.set(resolvedTarget, existingState);
                    }
                }
                if (reapplyEditorState && existingState) {
                    queueMicrotask(() => applyPlotEditorState(existingState));
                }
            }).catch(() => {
                // The original Plotly promise remains authoritative for error handling.
            });
        }
        return result;
    };
    window.Plotly.__easyStatSpecCaptureInstalled = true;
}

function getTitleText(title) {
    const text = typeof title === 'string'
        ? title
        : (title && typeof title.text === 'string' ? title.text : '');
    return /^Click to enter (?:X axis|Y axis|plot) title$/i.test(text.trim()) ? '' : text;
}

function toEditableLabel(value, joinBreaks = ' ') {
    return String(value || '')
        .replace(/<br\s*\/?>/gi, joinBreaks)
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, joinBreaks ? ' ' : '')
        .trim();
}

function findNearbyHeadingText(element, root) {
    const labelledBy = element.getAttribute?.('aria-labelledby');
    if (labelledBy) {
        const labelledElement = document.getElementById(labelledBy);
        const labelledText = labelledElement?.textContent?.trim();
        if (labelledText) return labelledText;
    }

    let current = element;
    while (current && current !== root) {
        let sibling = current.previousElementSibling;
        while (sibling) {
            const heading = sibling.matches?.('h2, h3, h4, h5, h6')
                ? sibling
                : sibling.querySelector?.('h2, h3, h4, h5, h6');
            const text = heading?.textContent?.trim();
            if (text) return text;
            sibling = sibling.previousElementSibling;
        }
        current = current.parentElement;
    }

    const panelHeading = element.closest?.('section, article, .result-section, .analysis-section')
        ?.querySelector('h2, h3, h4, h5, h6')
        ?.textContent
        ?.trim();
    return panelHeading || '';
}

function createVisualizationEditorShell(kind, summaryText) {
    const details = document.createElement('details');
    details.className = 'visualization-item-editor';
    details.dataset.editorKind = kind;

    const summary = document.createElement('summary');
    const icon = document.createElement('i');
    icon.className = kind === 'table' ? 'fas fa-table' : 'fas fa-sliders-h';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = summaryText;
    summary.append(icon, label);

    const body = document.createElement('div');
    body.className = 'visualization-item-editor-body';
    const fields = document.createElement('div');
    fields.className = 'visualization-item-editor-fields';
    body.appendChild(fields);
    details.append(summary, body);

    return { details, body, fields };
}

function appendVisualizationTextField(fields, options) {
    const idPrefix = `visualization-editor-${++visualizationEditorSequence}`;
    const field = document.createElement('div');
    field.className = 'visualization-item-editor-field';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'visualization-item-editor-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${idPrefix}-visible`;
    checkbox.checked = options.checked;
    checkbox.dataset.visualizationControl = options.key;
    const toggleText = document.createElement('span');
    toggleText.textContent = options.label;
    toggleLabel.htmlFor = checkbox.id;
    toggleLabel.append(checkbox, toggleText);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `${idPrefix}-text`;
    input.className = 'visualization-item-editor-input';
    input.value = options.value;
    input.placeholder = options.placeholder || '';
    const editableName = options.inputLabel || options.label.replace(/を表示$/, '');
    input.setAttribute('aria-label', `${editableName}を編集`);
    input.dataset.visualizationInput = options.key;

    field.append(toggleLabel, input);
    fields.appendChild(field);
    return { checkbox, input };
}

function appendVisualizationToggle(fields, options) {
    const id = `visualization-editor-${++visualizationEditorSequence}-visible`;
    const field = document.createElement('div');
    field.className = 'visualization-item-editor-field visualization-item-editor-field-compact';

    const label = document.createElement('label');
    label.className = 'visualization-item-editor-toggle';
    label.htmlFor = id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = options.checked;
    checkbox.dataset.visualizationControl = options.key;
    const text = document.createElement('span');
    text.textContent = options.label;
    label.append(checkbox, text);
    field.appendChild(label);
    fields.appendChild(field);
    return checkbox;
}

function appendVisualizationSizeFields(fields, options) {
    const idPrefix = `visualization-editor-${++visualizationEditorSequence}-size`;
    const group = document.createElement('fieldset');
    group.className = 'visualization-item-editor-size';
    const legend = document.createElement('legend');
    legend.textContent = '大きさ・縦横比';
    const controls = document.createElement('div');
    controls.className = 'visualization-size-controls';

    const widthControl = document.createElement('div');
    widthControl.className = 'visualization-size-control';
    const widthLabel = document.createElement('label');
    widthLabel.htmlFor = `${idPrefix}-width`;
    widthLabel.textContent = '表示幅';
    const widthRow = document.createElement('div');
    widthRow.className = 'visualization-size-range';
    const widthInput = document.createElement('input');
    widthInput.type = 'range';
    widthInput.id = `${idPrefix}-width`;
    widthInput.min = '50';
    widthInput.max = '100';
    widthInput.step = '5';
    widthInput.value = String(options.widthPercent);
    widthInput.dataset.visualizationInput = 'width';
    const widthOutput = document.createElement('output');
    widthOutput.htmlFor = widthInput.id;
    widthOutput.textContent = `${options.widthPercent}%`;
    widthRow.append(widthInput, widthOutput);
    widthControl.append(widthLabel, widthRow);

    const ratioControl = document.createElement('div');
    ratioControl.className = 'visualization-size-control';
    const ratioLabel = document.createElement('label');
    ratioLabel.htmlFor = `${idPrefix}-ratio`;
    ratioLabel.textContent = '縦横比';
    const ratioSelect = document.createElement('select');
    ratioSelect.id = `${idPrefix}-ratio`;
    ratioSelect.className = 'visualization-item-editor-input';
    ratioSelect.dataset.visualizationInput = 'aspect-ratio';
    [
        ['auto', '自動（元の比率）'],
        ['16:9', '16:9（横長）'],
        ['4:3', '4:3（標準）'],
        ['3:2', '3:2'],
        ['1:1', '1:1（正方形）'],
        ['custom-ratio', '任意比率を入力'],
        ['custom', '高さを直接指定']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        ratioSelect.appendChild(option);
    });
    ratioSelect.value = options.aspectRatio || 'auto';

    const ratioInputs = document.createElement('div');
    ratioInputs.className = 'visualization-ratio-inputs';
    ratioInputs.hidden = ratioSelect.value !== 'custom-ratio';

    const ratioWidthLabel = document.createElement('label');
    ratioWidthLabel.className = 'visualization-ratio-part';
    ratioWidthLabel.htmlFor = `${idPrefix}-ratio-width`;
    const ratioWidthText = document.createElement('span');
    ratioWidthText.textContent = '横';
    const ratioWidthInput = document.createElement('input');
    ratioWidthInput.type = 'number';
    ratioWidthInput.id = `${idPrefix}-ratio-width`;
    ratioWidthInput.className = 'visualization-item-editor-input';
    ratioWidthInput.min = '0.1';
    ratioWidthInput.max = '100';
    ratioWidthInput.step = 'any';
    ratioWidthInput.inputMode = 'decimal';
    ratioWidthInput.value = formatVisualizationRatioPart(
        options.customRatioWidth ?? DEFAULT_CUSTOM_ASPECT_RATIO.width
    );
    ratioWidthInput.disabled = ratioInputs.hidden;
    ratioWidthInput.dataset.visualizationInput = 'ratio-width';
    ratioWidthInput.setAttribute('aria-label', '横の比率');
    ratioWidthLabel.append(ratioWidthText, ratioWidthInput);

    const ratioSeparator = document.createElement('span');
    ratioSeparator.className = 'visualization-ratio-separator';
    ratioSeparator.textContent = ':';
    ratioSeparator.setAttribute('aria-hidden', 'true');

    const ratioHeightLabel = document.createElement('label');
    ratioHeightLabel.className = 'visualization-ratio-part';
    ratioHeightLabel.htmlFor = `${idPrefix}-ratio-height`;
    const ratioHeightText = document.createElement('span');
    ratioHeightText.textContent = '縦';
    const ratioHeightInput = document.createElement('input');
    ratioHeightInput.type = 'number';
    ratioHeightInput.id = `${idPrefix}-ratio-height`;
    ratioHeightInput.className = 'visualization-item-editor-input';
    ratioHeightInput.min = '0.1';
    ratioHeightInput.max = '100';
    ratioHeightInput.step = 'any';
    ratioHeightInput.inputMode = 'decimal';
    ratioHeightInput.value = formatVisualizationRatioPart(
        options.customRatioHeight ?? DEFAULT_CUSTOM_ASPECT_RATIO.height
    );
    ratioHeightInput.disabled = ratioInputs.hidden;
    ratioHeightInput.dataset.visualizationInput = 'ratio-height';
    ratioHeightInput.setAttribute('aria-label', '縦の比率');
    ratioHeightLabel.append(ratioHeightText, ratioHeightInput);

    ratioInputs.append(ratioWidthLabel, ratioSeparator, ratioHeightLabel);
    ratioControl.append(ratioLabel, ratioSelect, ratioInputs);

    const heightControl = document.createElement('div');
    heightControl.className = 'visualization-size-control';
    const heightLabel = document.createElement('label');
    heightLabel.htmlFor = `${idPrefix}-height`;
    heightLabel.textContent = '高さ（px）';
    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.id = `${idPrefix}-height`;
    heightInput.className = 'visualization-item-editor-input';
    heightInput.min = '240';
    heightInput.max = '1000';
    heightInput.step = '10';
    heightInput.value = String(options.height);
    heightInput.disabled = ratioSelect.value !== 'custom';
    heightInput.dataset.visualizationInput = 'height';
    heightControl.append(heightLabel, heightInput);

    controls.append(widthControl, ratioControl, heightControl);
    group.append(legend, controls);
    fields.appendChild(group);
    return {
        widthInput,
        widthOutput,
        ratioSelect,
        ratioInputs,
        ratioWidthInput,
        ratioHeightInput,
        heightInput
    };
}

function clampVisualizationValue(value, minimum, maximum, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
}

function normalizeVisualizationRatioPart(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.round(Math.min(100, Math.max(0.1, numeric)) * 1000) / 1000;
}

function formatVisualizationRatioPart(value) {
    return String(Number(normalizeVisualizationRatioPart(value, 1).toFixed(3)));
}

function getVisualizationParentWidth(target) {
    const parent = target?.parentElement;
    if (!parent) return Math.max(target?.getBoundingClientRect().width || 0, 1);
    const style = window.getComputedStyle(parent);
    const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0)
        + (Number.parseFloat(style.paddingRight) || 0);
    const clientWidth = parent.clientWidth || parent.getBoundingClientRect().width;
    return Math.max(clientWidth - horizontalPadding, 1);
}

function getVisualizationSizeDefaults(target, fallbackHeight = 420) {
    const rect = target.getBoundingClientRect();
    const availableWidth = getVisualizationParentWidth(target);
    const width = Math.max(rect.width || availableWidth, 1);
    const height = clampVisualizationValue(
        Math.round(rect.height || fallbackHeight),
        240,
        1000,
        fallbackHeight
    );
    const widthPercent = clampVisualizationValue(
        Math.round((width / availableWidth) * 100 / 5) * 5,
        50,
        100,
        100
    );
    return {
        widthPercent,
        height,
        aspectRatio: width / Math.max(height, 1)
    };
}

function resolveVisualizationDimensions(target, controls, defaults) {
    const availableWidth = getVisualizationParentWidth(target);
    const widthPercent = clampVisualizationValue(
        controls.widthInput.value,
        50,
        100,
        defaults.widthPercent
    );
    const minimumWidth = Math.min(280, availableWidth);
    const width = Math.round(Math.max(
        minimumWidth,
        availableWidth * widthPercent / 100
    ));
    const ratioKey = controls.ratioSelect.value;
    const usesCustomRatio = ratioKey === 'custom-ratio';
    const ratioWidth = normalizeVisualizationRatioPart(
        controls.ratioWidthInput.value,
        DEFAULT_CUSTOM_ASPECT_RATIO.width
    );
    const ratioHeight = normalizeVisualizationRatioPart(
        controls.ratioHeightInput.value,
        DEFAULT_CUSTOM_ASPECT_RATIO.height
    );
    const ratio = ratioKey === 'auto'
        ? defaults.aspectRatio
        : (usesCustomRatio
            ? ratioWidth / ratioHeight
            : VISUALIZATION_ASPECT_RATIOS[ratioKey]);
    let height;
    if (ratioKey === 'custom') {
        height = clampVisualizationValue(controls.heightInput.value, 240, 1000, defaults.height);
    } else {
        const heightLimits = ratioKey === 'auto'
            ? { minimum: 240, maximum: 1000 }
            : RATIO_VISUALIZATION_HEIGHT_LIMITS;
        height = clampVisualizationValue(
            Math.round(width / Math.max(ratio || defaults.aspectRatio, 0.1)),
            heightLimits.minimum,
            heightLimits.maximum,
            defaults.height
        );
    }

    controls.widthInput.value = String(widthPercent);
    controls.widthOutput.textContent = `${widthPercent}%`;
    controls.heightInput.disabled = ratioKey !== 'custom';
    controls.ratioInputs.hidden = !usesCustomRatio;
    controls.ratioWidthInput.disabled = !usesCustomRatio;
    controls.ratioHeightInput.disabled = !usesCustomRatio;
    controls.ratioWidthInput.value = formatVisualizationRatioPart(ratioWidth);
    controls.ratioHeightInput.value = formatVisualizationRatioPart(ratioHeight);
    if (ratioKey !== 'custom') controls.heightInput.value = String(Math.round(height));

    return {
        widthPercent,
        width,
        height: Math.round(height),
        aspectRatio: usesCustomRatio
            ? `${formatVisualizationRatioPart(ratioWidth)}:${formatVisualizationRatioPart(ratioHeight)}`
            : ratioKey
    };
}

function applyVisualizationBox(target, dimensions) {
    target.style.boxSizing = 'border-box';
    target.style.width = `${dimensions.width}px`;
    target.style.maxWidth = '100%';
    target.style.height = `${dimensions.height}px`;
    target.style.marginLeft = 'auto';
    target.style.marginRight = 'auto';
    target.dataset.visualWidthPercent = String(dimensions.widthPercent);
    target.dataset.visualAspectRatio = dimensions.aspectRatio;
    target.dataset.visualHeight = String(dimensions.height);
}

function bindVisualizationSizeControls(controls, apply) {
    let timer = null;
    const scheduleApply = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(apply, 80);
    };

    controls.widthInput.addEventListener('input', () => {
        controls.widthOutput.textContent = `${controls.widthInput.value}%`;
        scheduleApply();
    });
    controls.widthInput.addEventListener('change', apply);
    controls.ratioSelect.addEventListener('change', apply);
    controls.ratioWidthInput.addEventListener('input', scheduleApply);
    controls.ratioWidthInput.addEventListener('change', apply);
    controls.ratioHeightInput.addEventListener('input', scheduleApply);
    controls.ratioHeightInput.addEventListener('change', apply);
    controls.heightInput.addEventListener('input', scheduleApply);
    controls.heightInput.addEventListener('change', apply);
}

function appendVisualizationResetButton(body, onReset) {
    const actions = document.createElement('div');
    actions.className = 'visualization-item-editor-actions';
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'visualization-item-editor-reset';
    resetButton.title = '初期表示に戻す';
    const icon = document.createElement('i');
    icon.className = 'fas fa-undo';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = '初期値に戻す';
    resetButton.append(icon, text);
    resetButton.addEventListener('click', onReset);
    actions.appendChild(resetButton);
    body.appendChild(actions);
}

function insertVisualizationEditor(target, editor) {
    if (!target?.parentNode) return false;
    target.parentNode.insertBefore(editor, target);
    return true;
}

function getTypedAnnotation(layout, type) {
    return (layout?.annotations || []).find(annotation => annotation?._annotationType === type) || null;
}

function getRenderedPlotLabels(plot) {
    const plotRect = plot.getBoundingClientRect();
    const annotationCandidates = Array.from(plot.querySelectorAll('.annotation-text'))
        .map(element => ({
            text: element.textContent?.trim() || '',
            rect: element.getBoundingClientRect()
        }))
        .filter(item => item.text);
    const bottomCandidate = annotationCandidates
        .filter(item => {
            if (!plotRect.height) return false;
            const centerY = item.rect.top + item.rect.height / 2;
            return centerY > plotRect.top + plotRect.height * 0.7
                && !/^(?:\*+|†|n\.s\.)$/i.test(item.text);
        })
        .sort((a, b) => b.rect.top - a.rect.top || b.text.length - a.text.length)[0];
    const verticalCandidate = annotationCandidates
        .filter(item => {
            if (!plotRect.width || item === bottomCandidate) return false;
            const centerX = item.rect.left + item.rect.width / 2;
            const centerY = item.rect.top + item.rect.height / 2;
            return centerX < plotRect.left + plotRect.width * 0.2
                && centerY > plotRect.top + plotRect.height * 0.15
                && centerY < plotRect.top + plotRect.height * 0.85;
        })
        .sort((a, b) => a.rect.left - b.rect.left)[0];
    const graphTitle = plot.querySelector('.gtitle')?.textContent?.trim() || '';
    const xTitle = plot.querySelector('.xtitle')?.textContent?.trim() || '';
    const yTitle = plot.querySelector('.ytitle')?.textContent?.trim() || '';

    return {
        title: graphTitle || bottomCandidate?.text || '',
        titleUsesAnnotation: !graphTitle && Boolean(bottomCandidate),
        x: xTitle,
        y: yTitle || verticalCandidate?.text || '',
        yUsesAnnotation: !yTitle && Boolean(verticalCandidate)
    };
}

function setTypedAnnotation(annotations, type, template, text, visible) {
    const next = Array.isArray(annotations) ? annotations.map(annotation => ({ ...annotation })) : [];
    const index = next.findIndex(annotation => annotation?._annotationType === type);
    if (index >= 0) {
        next[index] = { ...next[index], ...(template || {}), text, visible };
    } else if (template) {
        next.push({ ...template, text, visible, _annotationType: type });
    }
    return next;
}

function mergePlotlyLayoutUpdate(layout, update) {
    const next = { ...(layout || {}) };
    if (Object.prototype.hasOwnProperty.call(update, 'title.text')) {
        next.title = typeof next.title === 'object' && next.title !== null
            ? { ...next.title, text: update['title.text'] }
            : { text: update['title.text'] };
    }
    if (Object.prototype.hasOwnProperty.call(update, 'xaxis.title.text')) {
        const xaxis = { ...(next.xaxis || {}) };
        xaxis.title = typeof xaxis.title === 'object' && xaxis.title !== null
            ? { ...xaxis.title, text: update['xaxis.title.text'] }
            : { text: update['xaxis.title.text'] };
        next.xaxis = xaxis;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'yaxis.title.text')) {
        const yaxis = { ...(next.yaxis || {}) };
        yaxis.title = typeof yaxis.title === 'object' && yaxis.title !== null
            ? { ...yaxis.title, text: update['yaxis.title.text'] }
            : { text: update['yaxis.title.text'] };
        next.yaxis = yaxis;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'annotations')) {
        next.annotations = update.annotations;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'showlegend')) {
        next.showlegend = update.showlegend;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'height')) {
        next.height = update.height;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'width')) {
        next.width = update.width;
    }
    if (Object.prototype.hasOwnProperty.call(update, 'margin.b')) {
        next.margin = { ...(next.margin || {}), b: update['margin.b'] };
    }
    return next;
}

function updatePlotlyExportDimensions(state, dimensions) {
    const targets = [
        state.plotSpec?.config,
        capturedPlotSpecs.get(state.target)?.config,
        state.target?._context
    ].filter(Boolean);
    targets.forEach(config => {
        const current = config.toImageButtonOptions || {};
        config.toImageButtonOptions = {
            ...current,
            width: dimensions.width,
            height: dimensions.height
        };
    });
}

function resizePlotlyTarget(plot) {
    window.requestAnimationFrame(() => {
        try {
            const result = window.Plotly?.Plots?.resize?.(plot);
            if (result?.catch) {
                result.catch(error => console.warn('図の大きさを更新できませんでした。', error));
            }
        } catch (error) {
            console.warn('図の大きさを更新できませんでした。', error);
        }
    });
}

function applyPlotEditorState(state) {
    const plot = state.target;
    if (!plot?.isConnected || !window.Plotly) return;

    const update = {};
    const dimensions = resolveVisualizationDimensions(
        plot,
        state.sizeControls,
        state.sizeDefaults
    );
    applyVisualizationBox(plot, dimensions);
    update.width = dimensions.width;
    update.height = dimensions.height;
    updatePlotlyExportDimensions(state, dimensions);
    let annotations = Array.isArray(plot.layout?.annotations)
        ? plot.layout.annotations
        : (Array.isArray(state.plotSpec?.layout?.annotations)
            ? state.plotSpec.layout.annotations
            : []);
    let annotationsChanged = false;

    if (state.titleSource === 'annotation') {
        annotations = setTypedAnnotation(
            annotations,
            'bottomTitle',
            state.titleAnnotation,
            state.titleInput.value,
            state.titleCheckbox.checked
        );
        annotationsChanged = true;
        update['margin.b'] = state.titleCheckbox.checked
            ? Math.max(
                state.defaultBottomMargin,
                120,
                Math.round(dimensions.height * 0.22)
            )
            : state.defaultBottomMargin;
    } else {
        update['title.text'] = state.titleCheckbox.checked ? state.titleInput.value : '';
    }

    update['xaxis.title.text'] = state.xCheckbox.checked ? state.xInput.value : '';

    if (state.ySource === 'annotation') {
        annotations = setTypedAnnotation(
            annotations,
            'tategaki',
            state.yAnnotation,
            state.yInput.value.split('').join('<br>'),
            state.yCheckbox.checked
        );
        annotationsChanged = true;
        update['yaxis.title.text'] = '';
    } else {
        update['yaxis.title.text'] = state.yCheckbox.checked ? state.yInput.value : '';
    }

    if (state.legendCheckbox) {
        update.showlegend = state.legendCheckbox.checked;
    }
    if (annotationsChanged) update.annotations = annotations;

    try {
        if (plot.data && plot._fullLayout) {
            const relayoutResult = window.Plotly.relayout(plot, update);
            if (relayoutResult?.catch) {
                relayoutResult.catch(error => console.warn('図の表示設定を更新できませんでした。', error));
            }
            if (relayoutResult?.then) {
                relayoutResult.then(
                    () => resizePlotlyTarget(plot),
                    () => {}
                );
            } else {
                resizePlotlyTarget(plot);
            }
            return;
        }

        const spec = state.plotSpec || capturedPlotSpecs.get(plot) || plot.__easyStatPlotSpec;
        if (!spec) return;
        const nextLayout = mergePlotlyLayoutUpdate(spec.layout, update);
        state.plotSpec = { ...spec, layout: nextLayout };
        plot.__easyStatPlotSpec = state.plotSpec;
        capturedPlotSpecs.set(plot, state.plotSpec);
        state.isEditorRedraw = true;
        let redrawResult;
        try {
            redrawResult = window.Plotly.newPlot(
                plot,
                state.plotSpec.data,
                nextLayout,
                state.plotSpec.config
            );
        } catch (error) {
            state.isEditorRedraw = false;
            throw error;
        }
        if (redrawResult?.then) {
            redrawResult.then(
                () => {
                    state.isEditorRedraw = false;
                    resizePlotlyTarget(plot);
                },
                error => {
                    state.isEditorRedraw = false;
                    console.warn('図の表示設定を更新できませんでした。', error);
                }
            );
        } else {
            state.isEditorRedraw = false;
            resizePlotlyTarget(plot);
        }
    } catch (error) {
        console.warn('図の表示設定を更新できませんでした。', error);
    }
}

function enhancePlotlyFigure(plot, root, installation) {
    if (!plot || plot.dataset.visualizationEditorAttached) return true;
    if (!plot.querySelector('.main-svg')) return false;
    const readyAt = Number(plot.dataset.visualizationEditorReadyAt || 0);
    if (!readyAt) {
        plot.dataset.visualizationEditorReadyAt = String(Date.now());
        return false;
    }
    if (Date.now() - readyAt < 500) return false;
    delete plot.dataset.visualizationEditorReadyAt;
    plot.dataset.visualizationEditorAttached = 'plotly';

    const layout = plot.layout || {};
    const fullLayout = plot._fullLayout || {};
    const capturedSpec = capturedPlotSpecs.get(plot) || plot.__easyStatPlotSpec || null;
    plot.dataset.visualizationSpecCaptured = String(Boolean(capturedSpec));
    const capturedLayout = capturedSpec?.layout || {};
    const renderedLabels = getRenderedPlotLabels(plot);
    const storedBottomTitle = getTypedAnnotation(layout, 'bottomTitle')
        || getTypedAnnotation(capturedLayout, 'bottomTitle')
        || getTypedAnnotation(fullLayout, 'bottomTitle');
    const storedVerticalTitle = getTypedAnnotation(layout, 'tategaki')
        || getTypedAnnotation(capturedLayout, 'tategaki')
        || getTypedAnnotation(fullLayout, 'tategaki');
    const layoutTitle = getTitleText(layout.title)
        || getTitleText(capturedLayout.title)
        || getTitleText(fullLayout.title)
        || (!renderedLabels.titleUsesAnnotation ? renderedLabels.title : '');
    const xTitle = getTitleText(layout.xaxis?.title)
        || getTitleText(capturedLayout.xaxis?.title)
        || getTitleText(fullLayout.xaxis?.title)
        || renderedLabels.x;
    const yAxisTitle = getTitleText(layout.yaxis?.title)
        || getTitleText(capturedLayout.yaxis?.title)
        || getTitleText(fullLayout.yaxis?.title)
        || (!renderedLabels.yUsesAnnotation ? renderedLabels.y : '');
    const bottomTitle = storedBottomTitle
        || (renderedLabels.titleUsesAnnotation
            ? getBottomTitleAnnotation(renderedLabels.title)
            : null);
    const verticalTitle = storedVerticalTitle
        || (renderedLabels.yUsesAnnotation
            ? getTategakiAnnotation(renderedLabels.y)
            : null);
    const titleSource = layoutTitle ? 'layout' : (bottomTitle ? 'annotation' : 'layout');
    const ySource = yAxisTitle ? 'axis' : (verticalTitle ? 'annotation' : 'axis');
    const nearbyHeading = findNearbyHeadingText(plot, root);
    const defaultTitle = toEditableLabel(
        layoutTitle || bottomTitle?.text || nearbyHeading || 'グラフ'
    );
    const defaultXTitle = toEditableLabel(xTitle);
    const defaultYTitle = toEditableLabel(
        yAxisTitle || verticalTitle?.text,
        ySource === 'annotation' ? '' : ' '
    );
    const masterAxis = root.querySelector('#show-axis-labels');
    const masterTitle = root.querySelector('#show-graph-title');
    const hasMeaningfulLegend = Array.isArray(plot.data)
        && plot.data.some(trace => trace?.showlegend !== false && String(trace?.name || '').trim());

    const sizeDefaults = getVisualizationSizeDefaults(
        plot,
        Number(fullLayout.height || layout.height) || 420
    );
    const defaultBottomMargin = Number(
        layout.margin?.b
        || capturedLayout.margin?.b
        || fullLayout.margin?.b
    ) || 80;
    const editor = createVisualizationEditorShell('plotly', '図の表示設定');
    const titleField = appendVisualizationTextField(editor.fields, {
        key: 'title',
        label: 'この図のタイトルを表示',
        checked: masterTitle?.checked ?? true,
        value: defaultTitle,
        placeholder: 'グラフタイトル'
    });
    const xField = appendVisualizationTextField(editor.fields, {
        key: 'x-axis',
        label: 'X軸ラベルを表示',
        checked: masterAxis?.checked ?? true,
        value: defaultXTitle,
        placeholder: 'X軸ラベル'
    });
    const yField = appendVisualizationTextField(editor.fields, {
        key: 'y-axis',
        label: 'Y軸ラベルを表示',
        checked: masterAxis?.checked ?? true,
        value: defaultYTitle,
        placeholder: 'Y軸ラベル'
    });
    const legendCheckbox = hasMeaningfulLegend
        ? appendVisualizationToggle(editor.fields, {
            key: 'legend',
            label: '凡例を表示',
            checked: fullLayout.showlegend ?? layout.showlegend ?? true
        })
        : null;
    const sizeControls = appendVisualizationSizeFields(editor.fields, {
        widthPercent: sizeDefaults.widthPercent,
        aspectRatio: 'auto',
        height: sizeDefaults.height
    });

    const state = {
        target: plot,
        editor: editor.details,
        titleSource,
        ySource,
        titleAnnotation: bottomTitle ? { ...bottomTitle } : null,
        yAnnotation: verticalTitle ? { ...verticalTitle } : null,
        defaultBottomMargin,
        titleCheckbox: titleField.checkbox,
        titleInput: titleField.input,
        xCheckbox: xField.checkbox,
        xInput: xField.input,
        yCheckbox: yField.checkbox,
        yInput: yField.input,
        legendCheckbox,
        sizeControls,
        sizeDefaults,
        plotSpec: capturedSpec,
        isEditorRedraw: false,
        defaults: {
            title: defaultTitle,
            x: defaultXTitle,
            y: defaultYTitle,
            titleVisible: masterTitle?.checked ?? true,
            axesVisible: masterAxis?.checked ?? true,
            legendVisible: legendCheckbox?.checked ?? false,
            widthPercent: sizeDefaults.widthPercent,
            aspectRatio: 'auto',
            customRatioWidth: DEFAULT_CUSTOM_ASPECT_RATIO.width,
            customRatioHeight: DEFAULT_CUSTOM_ASPECT_RATIO.height,
            height: sizeDefaults.height
        }
    };

    const apply = () => applyPlotEditorState(state);
    [
        state.titleCheckbox,
        state.xCheckbox,
        state.yCheckbox,
        state.legendCheckbox
    ].filter(Boolean).forEach(control => control.addEventListener('change', apply));

    let inputTimer = null;
    [state.titleInput, state.xInput, state.yInput].forEach(input => {
        input.addEventListener('input', () => {
            window.clearTimeout(inputTimer);
            inputTimer = window.setTimeout(apply, 120);
        });
        input.addEventListener('change', apply);
    });
    bindVisualizationSizeControls(sizeControls, apply);

    appendVisualizationResetButton(editor.body, () => {
        state.titleInput.value = state.defaults.title;
        state.xInput.value = state.defaults.x;
        state.yInput.value = state.defaults.y;
        state.titleCheckbox.checked = state.defaults.titleVisible;
        state.xCheckbox.checked = state.defaults.axesVisible;
        state.yCheckbox.checked = state.defaults.axesVisible;
        if (state.legendCheckbox) {
            state.legendCheckbox.checked = state.defaults.legendVisible;
        }
        state.sizeControls.widthInput.value = String(state.defaults.widthPercent);
        state.sizeControls.ratioSelect.value = state.defaults.aspectRatio;
        state.sizeControls.ratioWidthInput.value = String(state.defaults.customRatioWidth);
        state.sizeControls.ratioHeightInput.value = String(state.defaults.customRatioHeight);
        state.sizeControls.heightInput.value = String(state.defaults.height);
        apply();
    });

    if (!insertVisualizationEditor(plot, editor.details)) {
        delete plot.dataset.visualizationEditorAttached;
        return false;
    }
    installation.plotStates.add(state);
    installation.sizeStates.add({ target: plot, applySize: apply });
    plotEditorStates.set(plot, state);
    apply();
    return true;
}

function enhanceHtmlTable(table, root) {
    if (!table || table.dataset.visualizationEditorAttached) return;
    if (table.closest('.visualization-item-editor')) return;
    table.dataset.visualizationEditorAttached = 'table';

    let caption = table.querySelector(':scope > caption');
    const hadCaption = Boolean(caption);
    if (!caption) {
        caption = document.createElement('caption');
        caption.className = 'editable-table-caption';
        table.prepend(caption);
    }

    const defaultTitle = (
        caption.textContent?.trim()
        || table.getAttribute('aria-label')?.trim()
        || findNearbyHeadingText(table, root)
        || '分析結果表'
    );
    const editor = createVisualizationEditorShell('table', '表タイトル');
    const titleField = appendVisualizationTextField(editor.fields, {
        key: 'table-title',
        label: '表タイトルを表示',
        checked: !caption.hidden,
        value: defaultTitle,
        placeholder: '表タイトル'
    });

    const apply = () => {
        caption.textContent = titleField.input.value;
        caption.hidden = !titleField.checkbox.checked;
        table.dataset.tableTitle = titleField.input.value;
    };
    titleField.checkbox.addEventListener('change', apply);
    titleField.input.addEventListener('input', apply);
    appendVisualizationResetButton(editor.body, () => {
        titleField.input.value = defaultTitle;
        titleField.checkbox.checked = true;
        apply();
    });

    if (!insertVisualizationEditor(table, editor.details)) {
        delete table.dataset.visualizationEditorAttached;
        if (!hadCaption) caption.remove();
        return;
    }
    apply();
}

function enhanceCanvasFigure(target, root, installation) {
    if (!target || target.dataset.visualizationEditorAttached) return;
    target.dataset.visualizationEditorAttached = 'canvas';

    const panel = target.closest('.tm-result-panel') || target.parentElement;
    const heading = panel?.querySelector('.tm-visual-heading h6, h5, h4');
    const defaultTitle = heading?.textContent?.trim()
        || findNearbyHeadingText(target, root)
        || '可視化';
    const legend = target.id ? document.getElementById(`${target.id}-legend`) : null;
    const downloadButton = panel?.querySelector(`.download-btn[data-target="${target.id}"]`);
    const sizeDefaults = getVisualizationSizeDefaults(target, 420);
    const editor = createVisualizationEditorShell('canvas', '図の表示設定');
    const titleField = appendVisualizationTextField(editor.fields, {
        key: 'title',
        label: 'この図のタイトルを表示',
        checked: !heading?.hidden,
        value: defaultTitle,
        placeholder: 'グラフタイトル'
    });
    const legendCheckbox = legend
        ? appendVisualizationToggle(editor.fields, {
            key: 'legend',
            label: '凡例を表示',
            checked: !legend.hidden
        })
        : null;
    const sizeControls = appendVisualizationSizeFields(editor.fields, {
        widthPercent: sizeDefaults.widthPercent,
        aspectRatio: 'auto',
        height: sizeDefaults.height
    });
    let lastDimensions = null;

    const apply = () => {
        if (heading) {
            heading.textContent = titleField.input.value;
            heading.hidden = !titleField.checkbox.checked;
        }
        const visibleTitle = titleField.checkbox.checked ? titleField.input.value : '';
        target.dataset.visualTitle = visibleTitle;
        const dimensions = resolveVisualizationDimensions(target, sizeControls, sizeDefaults);
        const sizeChanged = !lastDimensions
            || lastDimensions.width !== dimensions.width
            || lastDimensions.height !== dimensions.height;
        if (sizeChanged && typeof target.__easyStatResizeFigure === 'function') {
            target.__easyStatResizeFigure(dimensions);
        }
        lastDimensions = dimensions;
        applyVisualizationBox(target, dimensions);
        const canvas = target.tagName === 'CANVAS' ? target : target.querySelector('canvas');
        if (canvas) {
            canvas.dataset.visualTitle = visibleTitle;
            canvas.dataset.visualLegendVisible = String(legendCheckbox?.checked ?? true);
            canvas.dataset.visualWidthPercent = String(dimensions.widthPercent);
            canvas.dataset.visualAspectRatio = dimensions.aspectRatio;
            canvas.dataset.visualHeight = String(dimensions.height);
        }
        target.dataset.visualLegendVisible = String(legendCheckbox?.checked ?? true);
        if (legend && legendCheckbox) legend.hidden = !legendCheckbox.checked;
        if (downloadButton) {
            downloadButton.setAttribute(
                'aria-label',
                `${titleField.input.value || '図'}をPNG画像で保存`
            );
        }
    };
    titleField.checkbox.addEventListener('change', apply);
    titleField.input.addEventListener('input', apply);
    legendCheckbox?.addEventListener('change', apply);
    bindVisualizationSizeControls(sizeControls, apply);
    appendVisualizationResetButton(editor.body, () => {
        titleField.input.value = defaultTitle;
        titleField.checkbox.checked = true;
        if (legendCheckbox) legendCheckbox.checked = true;
        sizeControls.widthInput.value = String(sizeDefaults.widthPercent);
        sizeControls.ratioSelect.value = 'auto';
        sizeControls.ratioWidthInput.value = String(DEFAULT_CUSTOM_ASPECT_RATIO.width);
        sizeControls.ratioHeightInput.value = String(DEFAULT_CUSTOM_ASPECT_RATIO.height);
        sizeControls.heightInput.value = String(sizeDefaults.height);
        apply();
    });

    if (!insertVisualizationEditor(target, editor.details)) {
        delete target.dataset.visualizationEditorAttached;
        return;
    }
    installation.sizeStates.add({ target, applySize: apply });
    apply();
}

/**
 * Adds editable title, axis, legend, size, aspect-ratio, and table-caption controls.
 * A MutationObserver covers figures and tables created after the analysis button is pressed.
 * @param {HTMLElement|string} root - Analysis result root element or ID.
 * @returns {{refresh: Function, disconnect: Function}|null}
 */
export function installVisualizationEditors(root) {
    const target = typeof root === 'string' ? document.getElementById(root) : root;
    if (!target) return null;
    installPlotlySpecCapture();

    const existing = visualizationEditorInstallations.get(target);
    if (existing) {
        existing.refresh();
        return existing.api;
    }

    const installation = {
        plotStates: new Set(),
        sizeStates: new Set(),
        scheduled: false,
        observer: null,
        resizeObserver: null,
        resizeTimer: null,
        lastWidth: target.getBoundingClientRect().width,
        refresh: null,
        masterListener: null,
        api: null
    };

    const refresh = () => {
        installation.scheduled = false;
        let waitingForPlot = false;
        installation.plotStates.forEach(state => {
            if (!state.target.isConnected) installation.plotStates.delete(state);
        });
        installation.sizeStates.forEach(state => {
            if (!state.target.isConnected) installation.sizeStates.delete(state);
        });

        target.querySelectorAll('.js-plotly-plot').forEach(plot => {
            if (!enhancePlotlyFigure(plot, target, installation)) waitingForPlot = true;
        });
        target.querySelectorAll('table').forEach(table => {
            enhanceHtmlTable(table, target);
        });
        target.querySelectorAll('canvas.tm-wordcloud-canvas, .tm-network-canvas').forEach(figure => {
            if (figure.tagName === 'CANVAS' && figure.closest('.tm-network-canvas')) return;
            enhanceCanvasFigure(figure, target, installation);
        });
        if (waitingForPlot) window.setTimeout(scheduleRefresh, 50);
    };
    installation.refresh = refresh;

    const scheduleRefresh = () => {
        if (installation.scheduled) return;
        installation.scheduled = true;
        queueMicrotask(refresh);
    };

    installation.observer = new MutationObserver(scheduleRefresh);
    installation.observer.observe(target, { childList: true, subtree: true });
    if (window.ResizeObserver) {
        installation.resizeObserver = new ResizeObserver(() => {
            const width = target.getBoundingClientRect().width;
            if (Math.abs(width - installation.lastWidth) < 1) return;
            installation.lastWidth = width;
            window.clearTimeout(installation.resizeTimer);
            installation.resizeTimer = window.setTimeout(() => {
                installation.sizeStates.forEach(state => {
                    if (state.target.isConnected) state.applySize();
                });
            }, 100);
        });
        installation.resizeObserver.observe(target);
    }

    installation.masterListener = event => {
        if (event.target?.id !== 'show-axis-labels' && event.target?.id !== 'show-graph-title') {
            return;
        }
        window.setTimeout(() => {
            const axisVisible = target.querySelector('#show-axis-labels')?.checked;
            const titleVisible = target.querySelector('#show-graph-title')?.checked;
            installation.plotStates.forEach(state => {
                if (!state.target.isConnected) return;
                if (typeof axisVisible === 'boolean') {
                    state.xCheckbox.checked = axisVisible;
                    state.yCheckbox.checked = axisVisible;
                }
                if (typeof titleVisible === 'boolean') {
                    state.titleCheckbox.checked = titleVisible;
                }
                applyPlotEditorState(state);
            });
        }, 100);
    };
    target.addEventListener('change', installation.masterListener, true);

    const api = {
        refresh,
        disconnect: () => {
            installation.observer?.disconnect();
            installation.resizeObserver?.disconnect();
            window.clearTimeout(installation.resizeTimer);
            target.removeEventListener('change', installation.masterListener, true);
            visualizationEditorInstallations.delete(target);
        }
    };
    installation.api = api;
    visualizationEditorInstallations.set(target, installation);
    refresh();
    return api;
}

/**
 * Creates visualization controls (Axis Labels and Graph Title toggles).
 * @param {HTMLElement|string} container - The container element or ID.
 * @returns {Object} An object containing the checkbox elements { axisControl, titleControl }.
 */
export function createVisualizationControls(container) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return null;

    const previousAxisChecked = (
        target.querySelector('#show-axis-labels')
        || document.querySelector('#show-axis-labels')
    )?.checked;
    const previousTitleChecked = (
        target.querySelector('#show-graph-title')
        || document.querySelector('#show-graph-title')
    )?.checked;

    // These IDs are intentionally shared by every analysis, so only one
    // visualization-control set may exist in the active analysis view.
    const staleWrappers = new Set();
    document.querySelectorAll('#show-axis-labels, #show-graph-title').forEach(control => {
        if (target.contains(control)) return;
        const wrapper = control.closest('.visualization-controls')
            || control.parentElement?.parentElement;
        if (wrapper && wrapper !== target) staleWrappers.add(wrapper);
    });
    staleWrappers.forEach(wrapper => wrapper.remove());

    const wrapper = document.createElement('div');
    wrapper.className = 'visualization-controls';
    wrapper.dataset.visualizationControls = 'true';
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
    axisCheckbox.checked = previousAxisChecked ?? true;
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
    titleCheckbox.checked = previousTitleChecked ?? true;
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
    target.replaceChildren(wrapper);

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
    const tableStyle = "border-collapse: collapse; width: 100%; font-family: 'Times New Roman', 'Noto Serif JP', 'Yu Mincho', '游明朝', serif; color: #000; margin-bottom: 0.5rem; font-size: 0.95rem; line-height: 1.5;";
    const captionStyle = "text-align: center; font-weight: normal; margin-bottom: 0.6em; font-size: 1.05em; font-style: normal;";
    const theadStyle = "border-top: 2px solid #000; border-bottom: 1px solid #000;";
    const thStyle = "padding: 0.4em 0.6em; text-align: center; font-weight: normal; white-space: nowrap;";
    const tbodyStyle = "border-bottom: 2px solid #000;";
    const tdStyle = "padding: 0.35em 0.6em; text-align: center;";
    const firstColStyle = "padding: 0.35em 0.6em; text-align: left;";

    let html = `<div id="${tableId}_container" class="apa-table-wrapper" style="background:white; padding:1rem 1.2rem; border: 1px solid #e2e8f0; border-radius: 4px; overflow-x: auto;">
        <table id="${tableId}" style="${tableStyle}">
            <caption style="${captionStyle}">${title}</caption>
            <thead style="${theadStyle}">
                <tr>`;

    headerRow.forEach((h, i) => {
        html += `<th style="${i === 0 ? firstColStyle + ' font-weight: normal;' : thStyle}">${h}</th>`;
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
        html += `<div style="font-size: 0.85em; margin-top: 0.4em; font-family: 'Times New Roman', 'Noto Serif JP', serif; color: #333;">${note}</div>`;
    }

    html += `
        <button onclick="copyAPATable('${tableId}')" class="btn btn-sm btn-outline-secondary" style="margin-top: 0.5rem; font-family: sans-serif; font-size: 0.8rem;">
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
        if (p == null || !Number.isFinite(Number(p)) || p < 0 || p > 1) return { text: "-", isSignificant: false, stars: "", invalid: true };
        p = Number(p);
        const symbol = getSignificanceSymbol(p);
        return {
            text: formatPValue(p),
            isSignificant: p < 0.05,
            stars: symbol === 'n.s.' ? '' : symbol
        };
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
            text += '<br>相関だけでは因果関係は判断できません。';
        } else {
            text += `5%水準で有意な相関を示す十分な証拠は得られませんでした (<em>r</em> = ${r.toFixed(2)}, ${formatPValue(p, { html: true })})。`;
            text += '<br>これは、相関がないことや2変数が無関係であることを証明するものではありません。';
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
                '差の実質的な大きさは、効果量や信頼区間とあわせて判断してください。';
        } else {
            return `${varText}「<strong>${g1}</strong>」と「<strong>${g2}</strong>」の平均差について、5%水準で有意差を示す十分な証拠は得られませんでした (${formatPValue(p, { html: true })}${dText})。<br>` +
                '2群の平均が等しいことを証明する結果ではありません。';
        }
    },

    /**
     * 分散分析 (ANOVA) の解釈
     * @param {number} p - P値
     * @param {number} eta2 - 効果量 (Eta-squared or Partial Eta-squared)
     * @param {string} factorName - 要因名
     * @param {string} varName - 従属変数名 (Optional)
     * @param {object} options - オプション { isPartial: false }
     * @returns {string} 解釈文
     */
    interpretANOVA(p, eta2, factorName, varName = "", options = {}) {
        const pEval = this.evaluatePValue(p);
        const varText = varName ? `「<strong>${varName}</strong>」に対して、` : "";
        const etaSymbol = options.isPartial ? 'η<sub>p</sub>²' : 'η²';

        let etaText = "";
        if (eta2 !== undefined && eta2 !== null) {
            let size = "";
            if (eta2 < 0.01) size = "ごくわずか";
            else if (eta2 < 0.06) size = "小";
            else if (eta2 < 0.14) size = "中程度";
            else size = "大";
            etaText = `, <em>${etaSymbol}</em> = ${eta2.toFixed(2)} [${size}]`;
        }

        if (pEval.isSignificant) {
            return `${varText}要因「<strong>${factorName}</strong>」による<strong>主効果は有意</strong>でした (${pEval.text}${etaText})。<br>` +
                '少なくとも1群の平均が異なる可能性があります。どの群間に差があるかは多重比較で確認し、実質的な大きさは効果量とあわせて判断してください。';
        } else {
            return `${varText}要因「<strong>${factorName}</strong>」による主効果について、5%水準で有意差を示す十分な証拠は得られませんでした (${formatPValue(p, { html: true })}${etaText})。<br>` +
                '各群の平均が等しいことを証明する結果ではありません。';
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
        const pNumber = Number(p);
        const exactPText = Number.isFinite(pNumber)
            ? (pNumber < 0.001 ? "<em>p</em> &lt; .001" : `<em>p</em> = ${pNumber.toFixed(3)}`)
            : "<em>p</em> = -";

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
            const trendText = pNumber < 0.1
                ? `5%水準では有意とは言えませんが、10%水準では関連の傾向があります。<br>`
                : "";
            return `${varsText}5%水準で有意な関連は確認されませんでした (${exactPText}${vText})。<br>` +
                trendText +
                `これは「独立であること」や「偏りがないこと」を証明するものではありません。<br>` +
                `サンプルサイズや期待度数を確認し、必要に応じて残差分析や追加データで傾向を検討してください。`;
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
            text += `標本内では、説明変数が「<strong>${depVar}</strong>」の変動の約<strong>${(r2 * 100).toFixed(1)}%</strong>を説明しています (R²=${r2.toFixed(2)})。<br>`;

            const sigCoeffs = coeffs.filter(c => c.p < 0.05);
            if (sigCoeffs.length > 0) {
                text += `他の説明変数を一定としたとき、以下の変数が有意な関連を示しています：<ul style='margin-top:0.5rem; margin-bottom: 0;'>`;
                sigCoeffs.forEach(c => {
                    const dir = c.beta > 0 ? "正の関連" : "負の関連";
                    const standardizedInfo = c.stdBeta !== undefined ? `標準化係数 β=${c.stdBeta.toFixed(2)}` : `係数 B=${c.beta.toFixed(2)}`;
                    text += `<li><strong>${c.name}</strong>：${dir} (${standardizedInfo})</li>`;
                });
                text += `</ul>`;
            } else {
                text += `ただし、個々の説明変数で単独に有意な関連を示したものはありませんでした（多重共線性なども確認してください）。`;
            }
        } else {
            text += `回帰モデルについて、5%水準で有意な関連を示す十分な証拠は得られませんでした (${formatPValue(p, { html: true })})。<br>`;
            text += `予測性能がないことを証明する結果ではありません。検証用データでの評価も必要です。`;
        }
        text += '<br>回帰係数は、研究計画や交絡の検討なしに因果効果とは解釈できません。';
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
