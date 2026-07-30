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
            automargin: true,
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
            automargin: true,
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

function withAlpha(color, alpha) {
    const value = String(color || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
        const red = Number.parseInt(value.slice(1, 3), 16);
        const green = Number.parseInt(value.slice(3, 5), 16);
        const blue = Number.parseInt(value.slice(5, 7), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
    return value || academicColors.boxFill;
}

/**
 * Creates Plotly box traces from raw observations while preserving grouped
 * category and legend semantics.
 *
 * @param {Array<{name?: string, color?: string, groups: Array<{label: string, values: number[]}>}>} series
 * @param {{showLegend?: boolean, pointLimit?: number}} options
 * @returns {{traces: Object[], minimum: number|null, maximum: number|null, count: number}}
 */
export function createBoxPlotView(series, options = {}) {
    let minimum = Infinity;
    let maximum = -Infinity;
    let count = 0;
    const pointLimit = Number.isFinite(Number(options.pointLimit))
        ? Math.max(0, Number(options.pointLimit))
        : 120;

    const traces = (Array.isArray(series) ? series : []).map((item, seriesIndex) => {
        const x = [];
        const y = [];
        (Array.isArray(item?.groups) ? item.groups : []).forEach(group => {
            (Array.isArray(group?.values) ? group.values : []).forEach(value => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) return;
                x.push(String(group.label));
                y.push(numeric);
                minimum = Math.min(minimum, numeric);
                maximum = Math.max(maximum, numeric);
                count++;
            });
        });

        const color = item?.color
            || academicColors.palette[seriesIndex % academicColors.palette.length];
        return {
            x,
            y,
            type: 'box',
            name: String(item?.name || ''),
            showlegend: options.showLegend ?? Boolean(item?.name),
            boxpoints: y.length <= pointLimit ? 'all' : 'outliers',
            jitter: 0.24,
            pointpos: 0,
            marker: {
                color,
                opacity: 0.72,
                size: 5,
                line: { color, width: 0.6 }
            },
            fillcolor: withAlpha(color, 0.28),
            line: { color, width: 1.5 },
            hovertemplate: '%{x}<br>%{y}<extra>%{fullData.name}</extra>'
        };
    }).filter(trace => trace.y.length > 0);

    return {
        traces,
        minimum: Number.isFinite(minimum) ? minimum : null,
        maximum: Number.isFinite(maximum) ? maximum : null,
        count
    };
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
const plotViewRegistrations = new WeakMap();
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

function clonePlotlyViewValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // Plotly specifications used here are plain objects; fall through.
        }
    }
    if (Array.isArray(value)) return value.map(clonePlotlyViewValue);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, clonePlotlyViewValue(child)])
        );
    }
    return value;
}

function normalizePlotlyViewRegistration(options) {
    const views = (Array.isArray(options?.views) ? options.views : [])
        .filter(view => (
            view
            && String(view.key || '').trim()
            && Array.isArray(view.data)
            && view.layout
        ))
        .map(view => ({
            key: String(view.key),
            label: String(view.label || view.key),
            data: view.data,
            layout: view.layout,
            config: view.config || {},
            labels: {
                title: String(view.labels?.title || ''),
                x: String(view.labels?.x || ''),
                y: String(view.labels?.y || '')
            }
        }));
    if (views.length < 2) return null;

    const requestedDefault = String(options?.defaultView || '');
    const defaultView = views.some(view => view.key === requestedDefault)
        ? requestedDefault
        : views[0].key;
    return { views, defaultView };
}

/**
 * Registers semantically valid alternative representations for one Plotly
 * figure. The common figure editor renders the selector and keeps label,
 * range, and size edits while switching views.
 *
 * @param {HTMLElement|string} target
 * @param {{defaultView?: string, views: Object[]}} options
 * @returns {boolean}
 */
export function registerPlotlyViewOptions(target, options) {
    const plot = typeof target === 'string' ? document.getElementById(target) : target;
    const registration = normalizePlotlyViewRegistration(options);
    if (!plot || !registration) return false;

    plotViewRegistrations.set(plot, registration);
    plot.dataset.visualizationView = registration.defaultView;
    const state = plotEditorStates.get(plot);
    if (state) attachPlotlyViewControls(state, registration);
    return true;
}

function getTraceYBounds(data) {
    let minimum = Infinity;
    let maximum = -Infinity;

    (Array.isArray(data) ? data : []).forEach(trace => {
        const values = Array.isArray(trace?.y) ? trace.y : [];
        const errors = Array.isArray(trace?.error_y?.array) ? trace.error_y.array : [];
        const errorsMinus = Array.isArray(trace?.error_y?.arrayminus)
            ? trace.error_y.arrayminus
            : errors;

        values.forEach((value, index) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return;
            const errorPlus = Number(errors[index]);
            const errorMinus = Number(errorsMinus[index]);
            minimum = Math.min(
                minimum,
                numeric - (Number.isFinite(errorMinus) ? Math.abs(errorMinus) : 0)
            );
            maximum = Math.max(
                maximum,
                numeric + (Number.isFinite(errorPlus) ? Math.abs(errorPlus) : 0)
            );
        });

        if (trace?.type === 'bar') {
            minimum = Math.min(minimum, 0);
            maximum = Math.max(maximum, 0);
        }
    });

    return {
        minimum: Number.isFinite(minimum) ? minimum : null,
        maximum: Number.isFinite(maximum) ? maximum : null
    };
}

function ensurePlotlyAnnotationSpace(layout, data) {
    const nextLayout = layout || {};
    const annotations = Array.isArray(nextLayout.annotations) ? nextLayout.annotations : [];
    const hasBottomTitle = annotations.some(annotation =>
        annotation?._annotationType === 'bottomTitle' && annotation.visible !== false
    );
    const hasVerticalTitle = annotations.some(annotation =>
        annotation?._annotationType === 'tategaki' && annotation.visible !== false
    );

    if (hasBottomTitle || hasVerticalTitle) {
        nextLayout.margin = { ...(nextLayout.margin || {}) };
        if (hasBottomTitle) {
            nextLayout.margin.b = Math.max(Number(nextLayout.margin.b) || 0, 120);
        }
        if (hasVerticalTitle) {
            nextLayout.margin.l = Math.max(Number(nextLayout.margin.l) || 0, 90);
        }
    }

    const bracketYValues = annotations
        .filter(annotation =>
            annotation?._annotationType === 'bracket'
            && annotation.visible !== false
            && (!annotation.yref || annotation.yref === 'y')
        )
        .map(annotation => Number(annotation.y))
        .filter(Number.isFinite);
    if (bracketYValues.length === 0) return nextLayout;

    const dataBounds = getTraceYBounds(data);
    const bracketMaximum = Math.max(...bracketYValues);
    const referenceMinimum = dataBounds.minimum ?? Math.min(0, bracketMaximum);
    const referenceMaximum = Math.max(dataBounds.maximum ?? bracketMaximum, bracketMaximum);
    const magnitude = Math.max(
        Math.abs(referenceMinimum),
        Math.abs(referenceMaximum),
        Number.EPSILON
    );
    const dataSpan = Math.max(referenceMaximum - referenceMinimum, magnitude * 0.1);
    const recommendedMaximum = bracketMaximum + dataSpan * 0.12;
    const existingRange = Array.isArray(nextLayout.yaxis?.range)
        ? nextLayout.yaxis.range.map(Number)
        : null;
    const existingMinimum = existingRange && Number.isFinite(existingRange[0])
        ? existingRange[0]
        : (referenceMinimum >= 0
            ? 0
            : referenceMinimum - dataSpan * 0.08);
    const existingMaximum = existingRange && Number.isFinite(existingRange[1])
        ? existingRange[1]
        : referenceMaximum;

    nextLayout.yaxis = {
        ...(nextLayout.yaxis || {}),
        autorange: false,
        range: [existingMinimum, Math.max(existingMaximum, recommendedMaximum)]
    };
    nextLayout._recommendedMaxY = Math.max(
        Number(nextLayout._recommendedMaxY) || -Infinity,
        recommendedMaximum
    );
    return nextLayout;
}

function installPlotlySpecCapture() {
    if (!window.Plotly || window.Plotly.__easyStatSpecCaptureInstalled) return;

    const originalNewPlot = window.Plotly.newPlot;
    window.Plotly.newPlot = function easyStatNewPlot(graphDiv, data, layout, config) {
        const target = typeof graphDiv === 'string'
            ? document.getElementById(graphDiv)
            : graphDiv;
        const normalizedLayout = ensurePlotlyAnnotationSpace(layout || {}, data);
        const spec = { data, layout: normalizedLayout, config };
        const existingState = target ? plotEditorStates.get(target) : null;
        const reapplyEditorState = Boolean(existingState && !existingState.isEditorRedraw);
        const args = Array.from(arguments);
        args[2] = normalizedLayout;
        const result = originalNewPlot.apply(this, args);
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

function appendVisualizationSelectField(fields, options) {
    const id = `visualization-editor-${++visualizationEditorSequence}-select`;
    const field = document.createElement('div');
    field.className = 'visualization-item-editor-field';
    field.dataset.visualizationSelectField = options.key;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.className = 'visualization-item-editor-label';
    label.textContent = options.label;

    const select = document.createElement('select');
    select.id = id;
    select.className = 'visualization-item-editor-input';
    select.dataset.visualizationInput = options.key;
    (options.options || []).forEach(option => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.appendChild(element);
    });
    select.value = options.value;

    field.append(label, select);
    fields.appendChild(field);
    return { field, select };
}

function appendVisualizationAxisRangeFields(fields, descriptors) {
    const editableDescriptors = descriptors.filter(Boolean);
    if (editableDescriptors.length === 0) return null;

    const idPrefix = `visualization-editor-${++visualizationEditorSequence}-axis-range`;
    const group = document.createElement('fieldset');
    group.className = 'visualization-item-editor-axis-range';
    const legend = document.createElement('legend');
    legend.textContent = '軸の表示範囲';
    const controls = document.createElement('div');
    controls.className = 'visualization-axis-range-controls';
    const rows = new Map();

    editableDescriptors.forEach(descriptor => {
        const row = document.createElement('div');
        row.className = 'visualization-axis-range-row';
        row.dataset.axisKey = descriptor.key;

        const axisLabel = document.createElement('span');
        axisLabel.className = 'visualization-axis-range-name';
        axisLabel.textContent = descriptor.label;

        const autoLabel = document.createElement('label');
        autoLabel.className = 'visualization-item-editor-toggle visualization-axis-range-auto';
        const autoCheckbox = document.createElement('input');
        autoCheckbox.type = 'checkbox';
        autoCheckbox.id = `${idPrefix}-${descriptor.key}-auto`;
        autoCheckbox.checked = descriptor.initialAuto;
        autoCheckbox.dataset.visualizationInput = `${descriptor.key}-range-auto`;
        const autoText = document.createElement('span');
        autoText.textContent = '自動';
        autoLabel.htmlFor = autoCheckbox.id;
        autoLabel.append(autoCheckbox, autoText);

        const createRangePart = (kind, labelText, value) => {
            const label = document.createElement('label');
            label.className = 'visualization-axis-range-part';
            label.htmlFor = `${idPrefix}-${descriptor.key}-${kind}`;
            const text = document.createElement('span');
            text.textContent = labelText;
            const input = document.createElement('input');
            input.type = descriptor.inputType;
            input.id = `${idPrefix}-${descriptor.key}-${kind}`;
            input.className = 'visualization-item-editor-input';
            input.value = value;
            input.disabled = descriptor.initialAuto;
            input.dataset.visualizationInput = `${descriptor.key}-range-${kind}`;
            input.setAttribute('aria-label', `${descriptor.label}の${labelText}`);
            if (descriptor.inputType === 'number') {
                input.step = 'any';
                input.inputMode = 'decimal';
            } else {
                input.placeholder = '例: 2026-07-29';
            }
            label.append(text, input);
            return { label, input };
        };

        const minimumPart = createRangePart(
            'min',
            '最小値',
            descriptor.initialDisplayRange[0]
        );
        const maximumPart = createRangePart(
            'max',
            '最大値',
            descriptor.initialDisplayRange[1]
        );
        const error = document.createElement('output');
        error.className = 'visualization-axis-range-error';
        error.id = `${idPrefix}-${descriptor.key}-error`;
        error.hidden = true;
        error.setAttribute('aria-live', 'polite');
        minimumPart.input.setAttribute('aria-describedby', error.id);
        maximumPart.input.setAttribute('aria-describedby', error.id);

        row.append(
            axisLabel,
            autoLabel,
            minimumPart.label,
            maximumPart.label,
            error
        );
        controls.appendChild(row);
        rows.set(descriptor.key, {
            descriptor,
            autoCheckbox,
            minimumInput: minimumPart.input,
            maximumInput: maximumPart.input,
            error
        });
    });

    group.append(legend, controls);
    fields.appendChild(group);
    return { group, rows };
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
        const responsiveAutoMinimum = width < 360
            ? 320
            : (width < 560 ? 300 : 240);
        const heightLimits = ratioKey === 'auto'
            ? { minimum: responsiveAutoMinimum, maximum: 1000 }
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

function appendBulkTextField(fields, key, labelText, placeholder) {
    const id = `visualization-editor-${++visualizationEditorSequence}-${key}`;
    const field = document.createElement('div');
    field.className = 'visualization-item-editor-field';
    const label = document.createElement('label');
    label.className = 'visualization-item-editor-label';
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'visualization-item-editor-input';
    input.dataset.visualizationInput = key;
    input.placeholder = placeholder;
    field.append(label, input);
    fields.appendChild(field);
    return input;
}

function appendBulkAxisRangeRow(container, orientation) {
    const idPrefix = `visualization-editor-${++visualizationEditorSequence}-bulk-${orientation}`;
    const row = document.createElement('div');
    row.className = 'visualization-axis-range-row visualization-bulk-axis-range-row';

    const axisName = document.createElement('span');
    axisName.className = 'visualization-axis-range-name';
    axisName.textContent = `${orientation.toUpperCase()}軸`;

    const mode = document.createElement('select');
    mode.id = `${idPrefix}-mode`;
    mode.className = 'visualization-item-editor-input';
    mode.dataset.visualizationInput = `bulk-${orientation}-range-mode`;
    mode.setAttribute('aria-label', `${orientation.toUpperCase()}軸範囲の一括設定`);
    [
        ['keep', '変更しない'],
        ['auto', '自動'],
        ['manual', '範囲を指定']
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        mode.appendChild(option);
    });

    const createInput = (kind, labelText) => {
        const label = document.createElement('label');
        label.className = 'visualization-axis-range-part';
        label.htmlFor = `${idPrefix}-${kind}`;
        const text = document.createElement('span');
        text.textContent = labelText;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `${idPrefix}-${kind}`;
        input.className = 'visualization-item-editor-input';
        input.dataset.visualizationInput = `bulk-${orientation}-range-${kind}`;
        input.disabled = true;
        input.placeholder = kind === 'min' ? '最小値' : '最大値';
        input.setAttribute('aria-label', `${orientation.toUpperCase()}軸の${labelText}`);
        label.append(text, input);
        return { label, input };
    };
    const minimum = createInput('min', '最小値');
    const maximum = createInput('max', '最大値');
    mode.addEventListener('change', () => {
        const enabled = mode.value === 'manual';
        minimum.input.disabled = !enabled;
        maximum.input.disabled = !enabled;
    });

    row.append(axisName, mode, minimum.label, maximum.label);
    container.appendChild(row);
    return {
        orientation,
        mode,
        minimumInput: minimum.input,
        maximumInput: maximum.input
    };
}

function copyVisualizationSizeControls(source, destination) {
    destination.widthInput.value = source.widthInput.value;
    destination.ratioSelect.value = source.ratioSelect.value;
    destination.ratioWidthInput.value = source.ratioWidthInput.value;
    destination.ratioHeightInput.value = source.ratioHeightInput.value;
    destination.heightInput.value = source.heightInput.value;
}

function findAxisRangeRow(state, orientation) {
    if (!state.axisRangeControls) return null;
    return Array.from(state.axisRangeControls.rows.values()).find(row =>
        String(row.descriptor?.key || '').startsWith(orientation)
    ) || null;
}

function applyBulkAxisRange(state, bulkRow) {
    if (bulkRow.mode.value === 'keep') return false;
    const row = findAxisRangeRow(state, bulkRow.orientation);
    if (!row) return false;

    if (bulkRow.mode.value === 'auto') {
        row.autoCheckbox.checked = true;
        row.minimumInput.disabled = true;
        row.maximumInput.disabled = true;
        return true;
    }

    row.autoCheckbox.checked = false;
    row.minimumInput.disabled = false;
    row.maximumInput.disabled = false;
    row.minimumInput.value = bulkRow.minimumInput.value.trim();
    row.maximumInput.value = bulkRow.maximumInput.value.trim();
    return true;
}

function validateBulkControls(controls) {
    for (const row of controls.axisRows) {
        if (row.mode.value !== 'manual') continue;
        if (!row.minimumInput.value.trim() || !row.maximumInput.value.trim()) {
            return `${row.orientation.toUpperCase()}軸は最小値と最大値の両方を入力してください。`;
        }
    }
    return '';
}

function applyVisualizationBulkSettings(installation, controls) {
    const validationMessage = validateBulkControls(controls);
    if (validationMessage) {
        controls.status.textContent = validationMessage;
        controls.status.dataset.status = 'error';
        return;
    }

    const title = controls.titleInput.value.trim();
    const xLabel = controls.xLabelInput.value.trim();
    const yLabel = controls.yLabelInput.value.trim();
    let changedPlots = 0;
    let changedCanvases = 0;

    installation.plotStates.forEach(state => {
        if (!state.target.isConnected) return;
        let changed = false;
        if (title) {
            state.titleInput.value = title;
            changed = true;
        }
        if (xLabel) {
            state.xInput.value = xLabel;
            changed = true;
        }
        if (yLabel) {
            state.yInput.value = yLabel;
            changed = true;
        }
        controls.axisRows.forEach(row => {
            changed = applyBulkAxisRange(state, row) || changed;
        });
        if (controls.sizeEnabled.checked) {
            copyVisualizationSizeControls(controls.sizeControls, state.sizeControls);
            changed = true;
        }
        if (!changed) return;
        applyPlotEditorState(state);
        changedPlots++;
    });

    installation.sizeStates.forEach(state => {
        if (!state.target.isConnected || state.kind !== 'canvas') return;
        let changed = false;
        if (title && state.titleInput) {
            state.titleInput.value = title;
            changed = true;
        }
        if (controls.sizeEnabled.checked) {
            copyVisualizationSizeControls(controls.sizeControls, state.sizeControls);
            changed = true;
        }
        if (!changed) return;
        state.applySize();
        changedCanvases++;
    });

    const invalidRanges = Array.from(installation.plotStates).filter(state =>
        state.target.isConnected
        && state.axisRangeControls
        && Array.from(state.axisRangeControls.rows.values()).some(row => !row.error.hidden)
    ).length;
    const changedTotal = changedPlots + changedCanvases;
    controls.status.dataset.status = invalidRanges ? 'warning' : 'success';
    controls.status.textContent = invalidRanges
        ? `${changedTotal}件へ反映しました。${invalidRanges}件の軸範囲は各図の注意を確認してください。`
        : (changedTotal
            ? `${changedTotal}件の図へ反映しました。`
            : '変更する項目を入力または選択してください。');
}

function createVisualizationBulkEditor(installation) {
    const editor = createVisualizationEditorShell('bulk', 'すべての図をまとめて設定');
    editor.details.classList.add('visualization-bulk-editor');
    editor.details.dataset.editorKind = 'bulk';

    const note = document.createElement('p');
    note.className = 'visualization-bulk-note';
    note.textContent = '空欄のラベルと「変更しない」の軸は、各図の設定を保ちます。';
    editor.fields.appendChild(note);

    const titleInput = appendBulkTextField(
        editor.fields,
        'bulk-title',
        '共通のグラフタイトル',
        '空欄なら変更しない'
    );
    const xLabelInput = appendBulkTextField(
        editor.fields,
        'bulk-x-label',
        '共通のX軸ラベル',
        '空欄なら変更しない'
    );
    const yLabelInput = appendBulkTextField(
        editor.fields,
        'bulk-y-label',
        '共通のY軸ラベル',
        '空欄なら変更しない'
    );

    const axisGroup = document.createElement('fieldset');
    axisGroup.className = 'visualization-item-editor-axis-range';
    const axisLegend = document.createElement('legend');
    axisLegend.textContent = '軸の表示範囲';
    const axisContainer = document.createElement('div');
    axisContainer.className = 'visualization-axis-range-controls';
    const axisRows = [
        appendBulkAxisRangeRow(axisContainer, 'x'),
        appendBulkAxisRangeRow(axisContainer, 'y')
    ];
    axisGroup.append(axisLegend, axisContainer);
    editor.fields.appendChild(axisGroup);

    const sizeEnabledLabel = document.createElement('label');
    sizeEnabledLabel.className = 'visualization-item-editor-toggle visualization-bulk-size-toggle';
    const sizeEnabled = document.createElement('input');
    sizeEnabled.type = 'checkbox';
    sizeEnabled.dataset.visualizationControl = 'bulk-size-enabled';
    const sizeEnabledText = document.createElement('span');
    sizeEnabledText.textContent = '大きさ・縦横比・高さを一括変更';
    sizeEnabledLabel.append(sizeEnabled, sizeEnabledText);
    editor.fields.appendChild(sizeEnabledLabel);

    const sizeControls = appendVisualizationSizeFields(editor.fields, {
        widthPercent: 100,
        aspectRatio: 'auto',
        height: 420,
        customRatioWidth: DEFAULT_CUSTOM_ASPECT_RATIO.width,
        customRatioHeight: DEFAULT_CUSTOM_ASPECT_RATIO.height
    });
    const updateBulkSizeFields = () => {
        const customRatio = sizeControls.ratioSelect.value === 'custom-ratio';
        sizeControls.ratioInputs.hidden = !customRatio;
        sizeControls.ratioWidthInput.disabled = !customRatio;
        sizeControls.ratioHeightInput.disabled = !customRatio;
        sizeControls.heightInput.disabled = sizeControls.ratioSelect.value !== 'custom';
        sizeControls.widthOutput.textContent = `${sizeControls.widthInput.value}%`;
    };
    bindVisualizationSizeControls(sizeControls, updateBulkSizeFields);
    updateBulkSizeFields();

    const actions = document.createElement('div');
    actions.className = 'visualization-item-editor-actions visualization-bulk-actions';
    const status = document.createElement('output');
    status.className = 'visualization-bulk-status';
    status.setAttribute('aria-live', 'polite');
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'visualization-bulk-apply';
    applyButton.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i><span>すべての図に適用</span>';
    actions.append(status, applyButton);
    editor.body.appendChild(actions);

    const controls = {
        titleInput,
        xLabelInput,
        yLabelInput,
        axisRows,
        sizeEnabled,
        sizeControls,
        status,
        applyButton
    };
    applyButton.addEventListener('click', () => {
        applyVisualizationBulkSettings(installation, controls);
    });
    return { editor: editor.details, controls };
}

function ensureVisualizationBulkEditor(target, installation) {
    const hasFigures = installation.plotStates.size > 0 || installation.sizeStates.size > 0;
    if (!hasFigures) return;
    if (!installation.bulkEditor?.isConnected) {
        const created = createVisualizationBulkEditor(installation);
        installation.bulkEditor = created.editor;
        installation.bulkControls = created.controls;
    }

    const preferredHost = target.querySelector('[data-visualization-controls="true"]');
    if (preferredHost) {
        if (installation.bulkEditor.parentElement !== preferredHost) {
            preferredHost.appendChild(installation.bulkEditor);
        }
        return;
    }

    const firstItemEditor = target.querySelector(
        '.visualization-item-editor:not(.visualization-bulk-editor)'
    );
    if (
        firstItemEditor?.parentNode
        && installation.bulkEditor.nextElementSibling !== firstItemEditor
    ) {
        firstItemEditor.parentNode.insertBefore(installation.bulkEditor, firstItemEditor);
    }
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

function getPlotlyAxisKeys(layout, orientation) {
    const pattern = new RegExp(`^${orientation}axis\\d*$`);
    return Object.keys(layout || {}).filter(key => pattern.test(key));
}

function formatPlotlyRangeNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    if (numeric === 0) return '0';
    const absolute = Math.abs(numeric);
    if (absolute >= 1e7 || absolute < 1e-5) {
        return numeric.toExponential(6).replace(/\.?0+e/, 'e');
    }
    return String(Number(numeric.toPrecision(10)));
}

function rangeValueToDisplay(value, type) {
    if (type === 'date') return String(value ?? '');
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return formatPlotlyRangeNumber(type === 'log' ? 10 ** numeric : numeric);
}

function resolvePlotlyAxisRangeDescriptor(plot, capturedLayout, orientation) {
    const layout = plot.layout || {};
    const fullLayout = plot._fullLayout || {};
    const axisKeys = Array.from(new Set([
        ...getPlotlyAxisKeys(layout, orientation),
        ...getPlotlyAxisKeys(capturedLayout, orientation),
        ...getPlotlyAxisKeys(fullLayout, orientation)
    ])).filter(key => fullLayout[key] || layout[key] || capturedLayout?.[key]);
    if (axisKeys.length !== 1) return null;

    const key = axisKeys[0];
    const fullAxis = fullLayout[key] || {};
    const liveAxis = layout[key] || {};
    const capturedAxis = capturedLayout?.[key] || {};
    const type = fullAxis.type || liveAxis.type || capturedAxis.type || 'linear';
    if (!['linear', 'log', 'date'].includes(type)) return null;

    const title = getTitleText(liveAxis.title)
        || getTitleText(capturedAxis.title)
        || getTitleText(fullAxis.title);
    if (fullAxis.visible === false || (fullAxis.showticklabels === false && !title)) {
        return null;
    }

    const inputAxis = [liveAxis, capturedAxis].find(axis =>
        axis && (Array.isArray(axis.range) || axis.autorange !== undefined)
    ) || {};
    const autorange = inputAxis.autorange;
    const inputRange = Array.isArray(inputAxis.range) && inputAxis.range.length >= 2
        ? inputAxis.range.slice(0, 2)
        : null;
    const rangeIsActive = Boolean(
        inputRange
        && autorange !== true
        && autorange !== 'reversed'
    );
    const displayedRange = rangeIsActive
        ? inputRange
        : (Array.isArray(fullAxis.range) ? fullAxis.range.slice(0, 2) : null);
    if (!displayedRange || displayedRange.length < 2) return null;

    const reversed = autorange === 'reversed'
        || (
            type !== 'date'
            && Number(displayedRange[0]) > Number(displayedRange[1])
        );
    const orderedRange = reversed
        ? [displayedRange[1], displayedRange[0]]
        : displayedRange;
    const recommendedMaximum = orientation === 'y'
        ? Math.max(
            Number(layout._recommendedMaxY) || -Infinity,
            Number(capturedLayout?._recommendedMaxY) || -Infinity
        )
        : null;
    const managedAutoRange = (
        Number.isFinite(recommendedMaximum)
        && inputRange
        && type !== 'date'
    )
        ? inputRange.slice(0, 2)
        : null;

    return {
        key,
        label: `${orientation.toUpperCase()}軸`,
        type,
        inputType: type === 'date' ? 'text' : 'number',
        initialAuto: Boolean(managedAutoRange) || !rangeIsActive,
        initialDisplayRange: orderedRange.map(value => rangeValueToDisplay(value, type)),
        reversed,
        autoMode: managedAutoRange
            ? false
            : (autorange === 'reversed' ? 'reversed' : true),
        managedAutoRange,
        recommendedMaximum: Number.isFinite(recommendedMaximum)
            ? recommendedMaximum
            : null
    };
}

function setAxisRangeError(row, message = '') {
    row.error.textContent = message;
    row.error.hidden = !message;
    [row.minimumInput, row.maximumInput].forEach(input => {
        input.setCustomValidity(message);
        input.setAttribute('aria-invalid', String(Boolean(message)));
    });
}

function parseAxisRangeValue(value, type) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (type === 'date') {
        const timestamp = Date.parse(raw);
        return Number.isFinite(timestamp)
            ? { comparable: timestamp, plotValue: raw }
            : null;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || (type === 'log' && numeric <= 0)) return null;
    return {
        comparable: numeric,
        plotValue: type === 'log' ? Math.log10(numeric) : numeric
    };
}

function appendPlotlyAxisRangeUpdates(update, controls) {
    if (!controls) return;

    controls.rows.forEach(row => {
        const { descriptor } = row;
        const key = descriptor.key;
        row.minimumInput.disabled = row.autoCheckbox.checked;
        row.maximumInput.disabled = row.autoCheckbox.checked;

        if (row.autoCheckbox.checked) {
            setAxisRangeError(row);
            update[`${key}.range`] = descriptor.managedAutoRange
                ? descriptor.managedAutoRange.slice()
                : null;
            update[`${key}.autorange`] = descriptor.autoMode;
            return;
        }

        const minimum = parseAxisRangeValue(row.minimumInput.value, descriptor.type);
        const maximum = parseAxisRangeValue(row.maximumInput.value, descriptor.type);
        if (!minimum || !maximum) {
            setAxisRangeError(
                row,
                descriptor.type === 'date'
                    ? '最小値と最大値を日付として入力してください。'
                    : '最小値と最大値を数値で入力してください。'
            );
            return;
        }
        if (minimum.comparable >= maximum.comparable) {
            setAxisRangeError(row, '最大値は最小値より大きくしてください。');
            return;
        }
        if (
            descriptor.recommendedMaximum !== null
            && descriptor.type !== 'date'
            && maximum.comparable < descriptor.recommendedMaximum
        ) {
            setAxisRangeError(
                row,
                `ブラケットと注釈を表示するため、最大値は${formatPlotlyRangeNumber(descriptor.recommendedMaximum)}以上にしてください。`
            );
            return;
        }

        setAxisRangeError(row);
        update[`${key}.autorange`] = false;
        update[`${key}.range`] = descriptor.reversed
            ? [maximum.plotValue, minimum.plotValue]
            : [minimum.plotValue, maximum.plotValue];
    });
}

function bindVisualizationAxisRangeControls(controls, apply) {
    if (!controls) return;
    let timer = null;
    const scheduleApply = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(apply, 100);
    };

    controls.rows.forEach(row => {
        row.autoCheckbox.addEventListener('change', () => {
            row.minimumInput.disabled = row.autoCheckbox.checked;
            row.maximumInput.disabled = row.autoCheckbox.checked;
            apply();
        });
        [row.minimumInput, row.maximumInput].forEach(input => {
            input.addEventListener('input', scheduleApply);
            input.addEventListener('change', apply);
        });
    });
}

function resetVisualizationAxisRangeControls(controls) {
    if (!controls) return;
    controls.rows.forEach(row => {
        row.autoCheckbox.checked = row.descriptor.initialAuto;
        row.minimumInput.value = row.descriptor.initialDisplayRange[0];
        row.maximumInput.value = row.descriptor.initialDisplayRange[1];
        row.minimumInput.disabled = row.descriptor.initialAuto;
        row.maximumInput.disabled = row.descriptor.initialAuto;
        setAxisRangeError(row);
    });
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
    Object.entries(update).forEach(([path, value]) => {
        const match = path.match(/^([xy]axis\d*)\.(range|autorange)$/);
        if (!match) return;
        const [, axisKey, property] = match;
        next[axisKey] = { ...(next[axisKey] || {}), [property]: value };
    });
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

function wrapVisualizationTitle(text, figureWidth) {
    const sourceLines = String(text ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .split('\n');
    if (figureWidth >= 520) return sourceLines.join('<br>');

    const maximumCharacters = Math.max(8, Math.floor((figureWidth - 32) / 16));
    return sourceLines
        .flatMap(line => {
            const characters = Array.from(line);
            if (characters.length <= maximumCharacters) return [line];
            const chunks = [];
            for (let index = 0; index < characters.length; index += maximumCharacters) {
                chunks.push(characters.slice(index, index + maximumCharacters).join(''));
            }
            return chunks;
        })
        .join('<br>');
}

function positionBottomTitleAnnotations(annotations, dimensions, layout) {
    const margins = layout?.margin || {};
    const left = Math.max(Number(margins.l) || 0, 0);
    const right = Math.max(Number(margins.r) || 0, 0);
    const paperWidth = Math.max(dimensions.width - left - right, 1);
    const figureCenterInPaper = (dimensions.width / 2 - left) / paperWidth;
    const titleWidth = Math.max(dimensions.width - 32, 80);

    return annotations.map(annotation => (
        annotation?._annotationType === 'bottomTitle'
            ? {
                ...annotation,
                x: figureCenterInPaper,
                width: titleWidth,
                align: 'center'
            }
            : annotation
    ));
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
        const displayTitle = wrapVisualizationTitle(
            state.titleInput.value,
            dimensions.width
        );
        annotations = setTypedAnnotation(
            annotations,
            'bottomTitle',
            state.titleAnnotation,
            displayTitle,
            state.titleCheckbox.checked
        );
        annotations = positionBottomTitleAnnotations(
            annotations,
            dimensions,
            plot.layout || state.plotSpec?.layout
        );
        annotationsChanged = true;
        const titleLineCount = Math.max(displayTitle.split('<br>').length, 1);
        update['margin.b'] = state.titleCheckbox.checked
            ? Math.max(
                state.defaultBottomMargin,
                120,
                96 + titleLineCount * 20,
                Math.round(dimensions.height * 0.22)
            )
            : state.defaultBottomMargin;
    } else {
        update['title.text'] = state.titleCheckbox.checked
            ? wrapVisualizationTitle(state.titleInput.value, dimensions.width)
            : '';
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
    appendPlotlyAxisRangeUpdates(update, state.axisRangeControls);
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

function synchronizePlotlyAxisRangeDescriptors(state) {
    if (!state.axisRangeControls) return;
    const capturedLayout = state.plotSpec?.layout || {};

    state.axisRangeControls.rows.forEach(row => {
        const orientation = String(row.descriptor?.key || '').startsWith('x') ? 'x' : 'y';
        const nextDescriptor = resolvePlotlyAxisRangeDescriptor(
            state.target,
            capturedLayout,
            orientation
        );
        if (!nextDescriptor) return;

        const wasAuto = row.autoCheckbox.checked;
        row.descriptor = nextDescriptor;
        row.minimumInput.type = nextDescriptor.inputType;
        row.maximumInput.type = nextDescriptor.inputType;
        if (wasAuto) {
            row.autoCheckbox.checked = true;
            row.minimumInput.value = nextDescriptor.initialDisplayRange[0];
            row.maximumInput.value = nextDescriptor.initialDisplayRange[1];
            row.minimumInput.disabled = true;
            row.maximumInput.disabled = true;
            setAxisRangeError(row);
        }
    });
}

function updateViewDefaultLabel(input, previousValue, nextValue) {
    if (input.value === previousValue) input.value = nextValue;
}

async function switchPlotlyView(state, requestedKey) {
    const registration = state.viewRegistration;
    const nextView = registration?.views.find(view => view.key === requestedKey);
    if (!nextView || !state.target?.isConnected || !window.Plotly) return;

    const previousKey = state.activeViewKey || registration.defaultView;
    const previousLabels = state.currentViewLabels || state.defaults;
    const nextLabels = nextView.labels || {};
    updateViewDefaultLabel(state.titleInput, previousLabels.title || '', nextLabels.title || '');
    updateViewDefaultLabel(state.xInput, previousLabels.x || '', nextLabels.x || '');
    updateViewDefaultLabel(state.yInput, previousLabels.y || '', nextLabels.y || '');

    state.defaults.title = nextLabels.title || '';
    state.defaults.x = nextLabels.x || '';
    state.defaults.y = nextLabels.y || '';
    state.currentViewLabels = { ...nextLabels };
    state.activeViewKey = nextView.key;
    state.viewControl.select.disabled = true;

    const data = clonePlotlyViewValue(nextView.data);
    const layout = ensurePlotlyAnnotationSpace(
        clonePlotlyViewValue(nextView.layout),
        data
    );
    const config = clonePlotlyViewValue(nextView.config);
    const nextSpec = { data, layout, config };

    const nextBottomTitle = getTypedAnnotation(layout, 'bottomTitle');
    const nextVerticalTitle = getTypedAnnotation(layout, 'tategaki');
    const nextLayoutTitle = getTitleText(layout.title);
    const nextYAxisTitle = getTitleText(layout.yaxis?.title);
    state.titleSource = nextLayoutTitle
        ? 'layout'
        : (nextBottomTitle ? 'annotation' : state.titleSource);
    state.ySource = nextYAxisTitle
        ? 'axis'
        : (nextVerticalTitle ? 'annotation' : state.ySource);
    state.titleAnnotation = nextBottomTitle ? { ...nextBottomTitle } : state.titleAnnotation;
    state.yAnnotation = nextVerticalTitle ? { ...nextVerticalTitle } : state.yAnnotation;
    state.defaultBottomMargin = Number(layout.margin?.b) || state.defaultBottomMargin;
    state.plotSpec = nextSpec;
    state.target.__easyStatPlotSpec = nextSpec;
    capturedPlotSpecs.set(state.target, nextSpec);
    state.isEditorRedraw = true;

    try {
        await window.Plotly.react(state.target, data, layout, config);
        state.target.dataset.visualizationView = nextView.key;
        synchronizePlotlyAxisRangeDescriptors(state);
        state.isEditorRedraw = false;
        applyPlotEditorState(state);
    } catch (error) {
        state.activeViewKey = previousKey;
        state.viewControl.select.value = previousKey;
        state.isEditorRedraw = false;
        console.warn('グラフの表示形式を切り替えられませんでした。', error);
    } finally {
        state.viewControl.select.disabled = false;
    }
}

function attachPlotlyViewControls(state, registration) {
    if (!state?.editor || !registration) return;
    state.viewControl?.field?.remove();

    const fields = state.editor.querySelector('.visualization-item-editor-fields');
    if (!fields) return;
    const activeViewKey = registration.views.some(view =>
        view.key === state.target.dataset.visualizationView
    )
        ? state.target.dataset.visualizationView
        : registration.defaultView;
    const control = appendVisualizationSelectField(fields, {
        key: 'chart-view',
        label: '表示形式',
        value: activeViewKey,
        options: registration.views.map(view => ({
            value: view.key,
            label: view.label
        }))
    });
    fields.prepend(control.field);

    state.viewRegistration = registration;
    state.viewControl = control;
    state.activeViewKey = activeViewKey;
    state.currentViewLabels = {
        ...(registration.views.find(view => view.key === activeViewKey)?.labels || {})
    };
    control.select.addEventListener('change', () => {
        void switchPlotlyView(state, control.select.value);
    });
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
    const axisRangeControls = appendVisualizationAxisRangeFields(editor.fields, [
        resolvePlotlyAxisRangeDescriptor(plot, capturedLayout, 'x'),
        resolvePlotlyAxisRangeDescriptor(plot, capturedLayout, 'y')
    ]);
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
        axisRangeControls,
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
    bindVisualizationAxisRangeControls(axisRangeControls, apply);
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
        resetVisualizationAxisRangeControls(state.axisRangeControls);
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
    installation.sizeStates.add({
        target: plot,
        applySize: apply,
        sizeControls,
        sizeDefaults,
        titleInput: state.titleInput,
        kind: 'plotly'
    });
    plotEditorStates.set(plot, state);
    const viewRegistration = plotViewRegistrations.get(plot);
    if (viewRegistration) attachPlotlyViewControls(state, viewRegistration);
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
    installation.sizeStates.add({
        target,
        applySize: apply,
        sizeControls,
        sizeDefaults,
        titleInput: titleField.input,
        kind: 'canvas'
    });
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
        bulkEditor: null,
        bulkControls: null,
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
        ensureVisualizationBulkEditor(target, installation);
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
 * @param {Object} options - yMin and baselineZero options for the visible range.
 */
export function addSignificanceBrackets(layout, pairs, xMap, yMax, yRange, options = {}) {
    if (!pairs || pairs.length === 0) return;

    const significantPairs = pairs
        .filter(p => p.significance && p.significance !== 'n.s.')
        .map(pair => ({
            ...pair,
            x1: Array.isArray(xMap) ? xMap.indexOf(pair.g1) : xMap[pair.g1],
            x2: Array.isArray(xMap) ? xMap.indexOf(pair.g2) : xMap[pair.g2]
        }))
        .filter(pair => (
            Number.isFinite(pair.x1)
            && Number.isFinite(pair.x2)
            && pair.x1 !== pair.x2
        ));
    if (significantPairs.length === 0) return;

    // Sort pairs by span (distance between groups) ascending
    // This ensures smaller brackets are drawn first (lower), and larger ones stack above.
    significantPairs.sort((a, b) => {
        const spanA = Math.abs(a.x1 - a.x2);
        const spanB = Math.abs(b.x1 - b.x2);
        return spanA - spanB;
    });

    // Initialize shapes and annotations if not present
    if (!layout.shapes) layout.shapes = [];
    if (!layout.annotations) layout.annotations = [];

    // Configuration for spacing
    const numericMax = Number(yMax);
    const numericMin = Number(options.yMin);
    const lowerDataBound = Number.isFinite(numericMin)
        ? numericMin
        : Math.min(0, Number.isFinite(numericMax) ? numericMax : 0);
    const upperDataBound = options.baselineZero !== false
        ? Math.max(0, Number.isFinite(numericMax) ? numericMax : 0)
        : (Number.isFinite(numericMax) ? numericMax : 0);
    const magnitude = Math.max(
        Math.abs(lowerDataBound),
        Math.abs(upperDataBound),
        1
    );
    const scaleRange = Number.isFinite(Number(yRange)) && Number(yRange) > 0
        ? Number(yRange)
        : magnitude * 0.1;
    const bracketHeight = scaleRange * 0.03;
    const textOffset = scaleRange * 0.02;
    const stackStep = scaleRange * 0.08;

    // Track the "skyline" (current max height) for each x-position
    // Assuming x-coordinates are integers 0, 1, 2... for groups
    const numGroups = Array.isArray(xMap) ? xMap.length : Object.keys(xMap).length;
    const columnHeights = new Array(numGroups).fill(upperDataBound);

    // Track max occupied height for layout range update
    let maxOccupiedY = upperDataBound;

    significantPairs.forEach(pair => {
        const { x1, x2 } = pair;
        const start = Math.min(x1, x2);
        const end = Math.max(x1, x2);

        // Find the current max height in the span [start, end]
        let currentLevelHeight = -Infinity;
        for (let i = start; i <= end; i++) {
            if (columnHeights[i] > currentLevelHeight) {
                currentLevelHeight = columnHeights[i];
            }
        }

        // Determine drawing position (add step)
        const drawY = (
            Number.isFinite(currentLevelHeight)
                ? currentLevelHeight
                : maxOccupiedY
        ) + stackStep;
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
            xref: 'x',
            yref: 'y',
            xanchor: 'center',
            yanchor: 'bottom',
            _annotationType: 'bracket'
        });

        // Update column heights for the spanned range
        // The text occupies some space, so we reserve up to textY + limits
        const nextBaseline = textY + (scaleRange * 0.02);
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
    const recommendedMaxY = maxOccupiedY + (scaleRange * 0.12);
    const paddedMinimum = options.baselineZero !== false
        ? (
            lowerDataBound < 0
                ? lowerDataBound - (scaleRange * 0.06)
                : 0
        )
        : lowerDataBound - (scaleRange * 0.08);

    layout.yaxis = layout.yaxis || {};
    if (!Array.isArray(layout.yaxis.range)) {
        layout.yaxis.range = [paddedMinimum, recommendedMaxY];
    } else {
        layout.yaxis.range[0] = Math.min(layout.yaxis.range[0], paddedMinimum);
        layout.yaxis.range[1] = Math.max(layout.yaxis.range[1], recommendedMaxY);
    }

    layout._recommendedMaxY = recommendedMaxY;
    layout._recommendedMinY = paddedMinimum;
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
