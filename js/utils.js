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
 * Gets the title for a given analysis type.
 * @param {string} analysisType - The type of the analysis.
 * @returns {string} The display title.
 */
export function getAnalysisTitle(analysisType) {
    const titles = {
        cleansing: 'データクレンジング',
        eda: '探索的データ分析（EDA）',
        correlation: '相関分析',
        chi_square: 'カイ２乗検定',
        ttest: 't検定',
        anova_one_way: '一要因分散分析',
        anova_two_way: '二要因分散分析',
        regression_simple: '単回帰分析',
        regression_multiple: '重回帰分析',
        factor_analysis: '因子分析',
        pca: '主成分分析',
        text_mining: 'テキストマイニング',
    };
    return titles[analysisType] || '分析';
}

/**
 * Displays a loading message in the upload area.
 * @param {string} message - The message to display.
 */
export function showLoadingMessage(message) {
    const uploadText = document.querySelector('.upload-text');
    if(uploadText) {
        uploadText.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    }
}

/**
 * Hides the loading message in the upload area.
 */
export function hideLoadingMessage() {
    const uploadText = document.querySelector('.upload-text');
    if(uploadText) {
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