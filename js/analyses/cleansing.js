import { currentData, dataCharacteristics } from '../main.js';
import { renderDataOverview } from '../utils.js';

// 元のデータのコピーを保持
let originalData = null;
let processedData = null;
let originalCharacteristics = null;
let processedCharacteristics = null;

// 外れ値の削除（IQR法）
function removeOutliers(data, numericColumns) {
    if (numericColumns.length === 0) {
        alert('外れ値を削除する数値列がありません');
        return data;
    }

    // 各数値列のQ1, Q3, IQRを計算
    const stats = {};
    numericColumns.forEach(col => {
        const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && !isNaN(v));
        if (values.length > 0) {
            const jstat = jStat(values);
            const q1 = jstat.quartiles()[0];
            const q3 = jstat.quartiles()[2];
            const iqr = q3 - q1;
            stats[col] = {
                lower: q1 - 1.5 * iqr,
                upper: q3 + 1.5 * iqr
            };
        }
    });

    // 外れ値を含む行を除外
    const filtered = data.filter(row => {
        return numericColumns.every(col => {
            const val = row[col];
            if (val === null || val === undefined || isNaN(val)) return true;
            const stat = stats[col];
            if (!stat) return true;
            return val >= stat.lower && val <= stat.upper;
        });
    });

    return filtered;
}

// 欠損値の削除と文字列のtrim
function removeMissing(data) {
    // 欠損値を含む行を削除
    const filtered = data.filter(row => {
        return Object.values(row).every(val => val !== null && val !== undefined && val !== '');
    });

    // 文字列のtrim処理
    const trimmed = filtered.map(row => {
        const newRow = {};
        Object.keys(row).forEach(col => {
            const val = row[col];
            newRow[col] = typeof val === 'string' ? val.trim() : val;
        });
        return newRow;
    });

    return trimmed;
}

// 空のカラム（列）の削除
function removeEmptyColumns(data) {
    if (data.length === 0) return data;

    const columns = Object.keys(data[0]);

    // 各列が全て空かどうかをチェック
    const nonEmptyColumns = columns.filter(col => {
        return data.some(row => {
            const val = row[col];
            return val !== null && val !== undefined && val !== '';
        });
    });

    // 空でない列のみを含む新しいデータを作成
    const filtered = data.map(row => {
        const newRow = {};
        nonEmptyColumns.forEach(col => {
            newRow[col] = row[col];
        });
        return newRow;
    });

    return filtered;
}

// データ処理の実行
function processData() {
    const removeOutliersOption = document.getElementById('remove-outliers-checkbox').checked;
    const removeMissingOption = document.getElementById('remove-missing-checkbox').checked;
    const removeEmptyColsOption = document.getElementById('remove-empty-cols-checkbox').checked;

    if (!removeOutliersOption && !removeMissingOption && !removeEmptyColsOption) {
        alert('少なくとも1つの処理オプションを選択してください');
        return;
    }

    // 元のデータをコピー
    processedData = JSON.parse(JSON.stringify(originalData));

    const originalRowCount = processedData.length;
    const originalColCount = Object.keys(processedData[0] || {}).length;

    // 外れ値の削除
    if (removeOutliersOption) {
        const numericCols = dataCharacteristics.numericColumns;
        processedData = removeOutliers(processedData, numericCols);
    }

    // 欠損値の削除
    if (removeMissingOption) {
        processedData = removeMissing(processedData);
    }

    // 空のカラムの削除
    if (removeEmptyColsOption) {
        processedData = removeEmptyColumns(processedData);
    }

    const processedRowCount = processedData.length;
    const processedColCount = Object.keys(processedData[0] || {}).length;
    const removedRows = originalRowCount - processedRowCount;
    const removedCols = originalColCount - processedColCount;

    // 処理済みデータの特性を分析
    processedCharacteristics = window.analyzeDataCharacteristics(processedData);

    // 処理サマリーを表示
    const summaryHtml = `
        <div style="margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 4px solid #1e90ff; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #1e90ff;">処理完了</p>
            <p style="margin: 0.5rem 0 0 0; color: #2d3748;">
                削除された行数: ${removedRows}行 / 削除された列数: ${removedCols}列
            </p>
        </div>
    `;
    document.getElementById('processing-summary').innerHTML = summaryHtml;

    // 処理済みデータセクションを表示
    document.getElementById('processed-data-overview-section').style.display = 'block';

    // 処理済みデータを表示（折りたたみ可能）
    renderDataOverview('#processed-data-overview', processedData, processedCharacteristics, { initiallyCollapsed: false });

    // ダウンロードセクションを表示
    document.getElementById('download-section').style.display = 'block';
}

// CSVダウンロード
function downloadCSV() {
    if (!processedData || processedData.length === 0) {
        alert('処理済みデータがありません');
        return;
    }

    const columns = Object.keys(processedData[0]);
    const csvRows = [];

    // ヘッダー行
    csvRows.push(columns.join(','));

    // データ行
    processedData.forEach(row => {
        const values = columns.map(col => {
            const val = row[col];
            // カンマや改行を含む値はダブルクォートで囲む
            if (val === null || val === undefined) return '';
            const strVal = String(val);
            if (strVal.includes(',') || strVal.includes('\n') || strVal.includes('"')) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        });
        csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'processed_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Excelダウンロード
function downloadExcel() {
    if (!processedData || processedData.length === 0) {
        alert('処理済みデータがありません');
        return;
    }

    try {
        // SheetJSを使用してExcelファイルを作成
        const ws = XLSX.utils.json_to_sheet(processedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ProcessedData');

        // ファイルをダウンロード
        XLSX.writeFile(wb, 'processed_data.xlsx');
    } catch (error) {
        console.error('Excel download error:', error);
        alert('Excelファイルのダウンロードに失敗しました。CSVダウンロードをお試しください。');
    }
}

// データ品質情報の表示
function displayDataQualityInfo() {
    const data = originalData;
    if (!data || data.length === 0) {
        document.getElementById('data-quality-info').innerHTML = '<p>データがありません。</p>';
        return;
    }

    const nRows = data.length;
    const columns = Object.keys(data[0]);
    const nCols = columns.length;

    // 欠損値情報
    const missingInfo = columns.map(col => {
        const missingCount = data.filter(row => {
            const val = row[col];
            return val === null || val === undefined || val === '';
        }).length;
        return { col, count: missingCount, rate: ((missingCount / nRows) * 100).toFixed(2) };
    });

    // 重複行
    const stringifiedRows = data.map(row => JSON.stringify(row));
    const uniqueRows = new Set(stringifiedRows);
    const nDuplicates = nRows - uniqueRows.size;

    // データ型情報
    const dtypes = [];
    if (dataCharacteristics.numericColumns) {
        dataCharacteristics.numericColumns.forEach(col => {
            dtypes.push({ col, type: '数値型' });
        });
    }
    if (dataCharacteristics.categoricalColumns) {
        dataCharacteristics.categoricalColumns.forEach(col => {
            dtypes.push({ col, type: 'カテゴリ型' });
        });
    }

    const qualityHtml = `
        <h5>データ概要</h5>
        <table class="table">
            <tr><td>総行数</td><td>${nRows}</td></tr>
            <tr><td>総列数</td><td>${nCols}</td></tr>
            <tr><td>重複行数</td><td>${nDuplicates}</td></tr>
        </table>

        <h5>欠損値情報</h5>
        <div class="table-container" style="overflow-x: auto; max-height: 300px;">
        <table class="table">
            <thead>
                <tr>
                    <th>変数名</th>
                    <th>欠損値数</th>
                    <th>欠損率 (%)</th>
                </tr>
            </thead>
            <tbody>
                ${missingInfo.map(m => `
                    <tr>
                        <td>${m.col}</td>
                        <td>${m.count}</td>
                        <td>${m.rate}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>

        <h5>データ型</h5>
        <div class="table-container" style="overflow-x: auto; max-height: 300px;">
        <table class="table">
            <thead>
                <tr>
                    <th>変数名</th>
                    <th>推測される型</th>
                </tr>
            </thead>
            <tbody>
                ${dtypes.map(d => `
                    <tr>
                        <td>${d.col}</td>
                        <td>${d.type}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;

    document.getElementById('data-quality-info').innerHTML = qualityHtml;
}

export function render(container) {
    // 元のデータを保存
    originalData = JSON.parse(JSON.stringify(currentData));
    originalCharacteristics = JSON.parse(JSON.stringify(dataCharacteristics));
    processedData = null;
    processedCharacteristics = null;

    container.innerHTML = `
    container.innerHTML = `
        < div class="cleansing-container" >
            < !--データ品質情報 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-check-circle"></i> データ品質情報
                </h4>
                <div id="data-quality-info"></div>
            </div>

            <!--元のデータプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="original-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!--処理オプション -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-cogs"></i> 処理オプション
                </h4>
                <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="remove-outliers-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1rem;">外れ値の削除（IQR法：Q1-1.5×IQR ～ Q3+1.5×IQR の範囲外を削除）</span>
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="remove-missing-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1rem;">欠損値の削除（欠損値を含む行を削除し、文字列の前後の空白を削除）</span>
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="remove-empty-cols-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1rem;">値が入っていないカラム（列）の削除</span>
                    </label>
                </div>
                <button id="process-data-btn" class="btn-analysis" style="margin-top: 1.5rem; width: 100%; padding: 1rem; font-size: 1.1rem; font-weight: bold;">
                    <i class="fas fa-broom"></i> データ処理を実行
                </button>
            </div>

            <!--処理サマリー -->
            <div id="processing-summary" style="margin-bottom: 2rem;"></div>

            <!--処理済みデータプレビューと要約統計量 -->
            <div id="processed-data-overview-section" class="info-sections" style="display: none; margin-bottom: 2rem;">
                <div id="processed-data-overview"></div>
            </div>

            <!--ダウンロードセクション -->
        <div id="download-section" style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: none; margin-bottom: 2rem;">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                <i class="fas fa-download"></i> ダウンロード
            </h4>
            <div style="display: flex; gap: 1rem; align-items: center;">
                <label for="file-format-select" style="font-weight: 500;">ファイル形式:</label>
                <select id="file-format-select" style="padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 1rem;">
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                </select>
                <button id="download-btn" class="btn-analysis" style="font-weight: bold;">
                    <i class="fas fa-file-export"></i> 処理済みデータをダウンロード
                </button>
            </div>
        </div>
        </div > >
        `;

    // データ品質情報を表示
    displayDataQualityInfo();

    // 元のデータを表示（折りたたみ可能、トップページと同じ仕様）
    renderDataOverview('#original-data-overview', originalData, originalCharacteristics, { initiallyCollapsed: true });

    // イベントリスナーを追加
    document.getElementById('process-data-btn').addEventListener('click', processData);

    document.getElementById('download-btn').addEventListener('click', () => {
        const format = document.getElementById('file-format-select').value;
        if (format === 'csv') {
            downloadCSV();
        } else {
            downloadExcel();
        }
    });
}
