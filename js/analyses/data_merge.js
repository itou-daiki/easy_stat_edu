// ==========================================
// Data Merge Module
// ==========================================
// Merges two uploaded Excel/CSV files on a common key column.
// This module works independently of the main data upload (data-requires="none").

let mergeData1 = null;
let mergeData2 = null;
let mergedResult = null;

// ==========================================
// File Reading Helpers
// ==========================================
function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                let jsonData;
                if (file.name.endsWith('.csv')) {
                    const workbook = XLSX.read(data, { type: 'string', raw: true });
                    jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                } else {
                    const workbook = XLSX.read(data, { type: 'array' });
                    jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                }
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

// ==========================================
// Data Preview Helper
// ==========================================
function renderPreviewTable(containerId, data, maxRows = 10) {
    const container = document.getElementById(containerId);
    if (!container || !data || data.length === 0) {
        if (container) container.innerHTML = '<p style="color: #64748b;">データなし</p>';
        return;
    }

    const columns = Object.keys(data[0]);
    const displayData = data.slice(0, maxRows);

    let html = `
        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem;">
            ${data.length}行 × ${columns.length}列
        </div>
        <div class="table-container" style="max-height: 300px; overflow: auto;">
        <table class="table" style="font-size: 0.85rem;">
            <thead>
                <tr>
                    ${columns.map(c => `<th>${c}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${displayData.map(row => `
                    <tr>
                        ${columns.map(c => `<td>${row[c] !== undefined && row[c] !== null ? row[c] : ''}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;

    if (data.length > maxRows) {
        html += `<p style="color: #64748b; font-size: 0.8rem; margin-top: 0.5rem;">※ 先頭${maxRows}行を表示中（全${data.length}行）</p>`;
    }

    container.innerHTML = html;
}

// ==========================================
// Common Column Detection
// ==========================================
function findCommonColumns(data1, data2) {
    if (!data1 || !data2 || data1.length === 0 || data2.length === 0) return [];
    const cols1 = Object.keys(data1[0]);
    const cols2 = Object.keys(data2[0]);
    return cols1.filter(c => cols2.includes(c));
}

// ==========================================
// Merge Logic
// ==========================================
function mergeDatasets(data1, data2, keyColumn, joinType) {
    if (!data1 || !data2 || !keyColumn) return [];

    const cols1 = Object.keys(data1[0]);
    const cols2 = Object.keys(data2[0]);

    // Columns unique to each dataset (excluding key)
    const uniqueCols2 = cols2.filter(c => c !== keyColumn && !cols1.includes(c));
    // Overlapping non-key columns get suffixed
    const overlapCols = cols2.filter(c => c !== keyColumn && cols1.includes(c));

    // Build lookup for data2 by key
    const data2Map = new Map();
    data2.forEach(row => {
        const key = String(row[keyColumn]);
        if (!data2Map.has(key)) {
            data2Map.set(key, []);
        }
        data2Map.get(key).push(row);
    });

    // Build lookup for data1 by key (needed for right-only in outer join)
    const data1Keys = new Set(data1.map(row => String(row[keyColumn])));

    const result = [];

    // Process all rows from data1
    data1.forEach(row1 => {
        const key = String(row1[keyColumn]);
        const matches = data2Map.get(key);

        if (matches && matches.length > 0) {
            // Key exists in both
            matches.forEach(row2 => {
                const merged = { ...row1 };
                uniqueCols2.forEach(c => { merged[c] = row2[c]; });
                overlapCols.forEach(c => {
                    merged[c + '_1'] = row1[c];
                    merged[c + '_2'] = row2[c];
                    delete merged[c]; // Remove original overlap column
                });
                result.push(merged);
            });
        } else if (joinType === 'outer' || joinType === 'left') {
            // Key only in data1
            const merged = { ...row1 };
            uniqueCols2.forEach(c => { merged[c] = null; });
            overlapCols.forEach(c => {
                merged[c + '_1'] = row1[c];
                merged[c + '_2'] = null;
                delete merged[c];
            });
            result.push(merged);
        }
        // inner: skip rows without match
    });

    // For outer join: add rows from data2 that have no match in data1
    if (joinType === 'outer') {
        data2.forEach(row2 => {
            const key = String(row2[keyColumn]);
            if (!data1Keys.has(key)) {
                const merged = {};
                merged[keyColumn] = row2[keyColumn];
                cols1.filter(c => c !== keyColumn).forEach(c => {
                    if (overlapCols.includes(c)) {
                        merged[c + '_1'] = null;
                        merged[c + '_2'] = row2[c];
                    } else {
                        merged[c] = null;
                    }
                });
                uniqueCols2.forEach(c => { merged[c] = row2[c]; });
                result.push(merged);
            }
        });
    }

    return result;
}

// ==========================================
// Download Helpers
// ==========================================
function downloadMergedCSV(data, fileName) {
    if (!data || data.length === 0) return;
    const columns = Object.keys(data[0]);
    const csvRows = [columns.join(',')];

    data.forEach(row => {
        const values = columns.map(col => {
            const val = row[col];
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
    link.href = URL.createObjectURL(blob);
    link.download = fileName || 'merged_data.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadMergedExcel(data, fileName) {
    if (!data || data.length === 0) return;
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'MergedData');
        XLSX.writeFile(wb, fileName || 'merged_data.xlsx');
    } catch (error) {
        console.error('Excel download error:', error);
        alert('Excelファイルのダウンロードに失敗しました。CSVダウンロードをお試しください。');
    }
}

// ==========================================
// UI Update Helpers
// ==========================================
function updateMergeControls() {
    const controlsSection = document.getElementById('merge-controls-section');
    const commonColumns = findCommonColumns(mergeData1, mergeData2);

    if (!mergeData1 || !mergeData2 || commonColumns.length === 0) {
        if (controlsSection) {
            if (mergeData1 && mergeData2 && commonColumns.length === 0) {
                controlsSection.style.display = 'block';
                controlsSection.innerHTML = `
                    <div style="padding: 1rem; background: #fff5f5; border-left: 4px solid #e53e3e; border-radius: 4px;">
                        <p style="color: #c53030; margin: 0;">
                            <i class="fas fa-exclamation-triangle"></i>
                            共通するカラムが存在しません。結合するには両ファイルに同じ名前のカラムが必要です。
                        </p>
                    </div>
                `;
            } else {
                controlsSection.style.display = 'none';
            }
        }
        return;
    }

    controlsSection.style.display = 'block';
    controlsSection.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                <i class="fas fa-cogs"></i> 結合設定
            </h4>
            <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-end;">
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-key"></i> キーカラム（結合に使用する列）
                    </label>
                    <select id="merge-key-column" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem;">
                        ${commonColumns.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
                        <i class="fas fa-code-branch"></i> 結合の種類
                    </label>
                    <select id="merge-join-type" style="width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem;">
                        <option value="inner">内部結合（inner）: 両方に共通するデータのみ</option>
                        <option value="left">左結合（left）: 1つ目のファイルを基準</option>
                        <option value="outer">外部結合（outer）: 全データを保持</option>
                    </select>
                </div>
                <div>
                    <button id="run-merge-btn" class="btn-analysis" style="padding: 0.75rem 2rem; font-size: 1rem; font-weight: bold;">
                        <i class="fas fa-object-group"></i> 結合を実行
                    </button>
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 6px;">
                <p style="margin: 0; font-size: 0.85rem; color: #2d3748;">
                    <i class="fas fa-info-circle" style="color: #1e90ff;"></i>
                    <strong>内部結合</strong>: 両ファイルにキーが存在する行のみ結果に含まれます。
                    <strong>左結合</strong>: 1つ目のファイルの全行を保持します。
                    <strong>外部結合</strong>: 両ファイルの全行を保持し、欠損はnullになります。
                </p>
            </div>
        </div>
    `;

    // Add merge button event listener
    document.getElementById('run-merge-btn').addEventListener('click', executeMerge);
}

function executeMerge() {
    const keyColumn = document.getElementById('merge-key-column').value;
    const joinType = document.getElementById('merge-join-type').value;

    if (!keyColumn) {
        alert('キーカラムを選択してください');
        return;
    }

    mergedResult = mergeDatasets(mergeData1, mergeData2, keyColumn, joinType);

    // Display result
    const resultSection = document.getElementById('merge-result-section');
    resultSection.style.display = 'block';

    // Summary
    const summaryHtml = `
        <div style="margin-bottom: 1rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #16a34a;">
                <i class="fas fa-check-circle"></i> 結合完了
            </p>
            <p style="margin: 0.5rem 0 0 0; color: #2d3748;">
                ファイル1: ${mergeData1.length}行 × ファイル2: ${mergeData2.length}行 → 結合結果: ${mergedResult.length}行
                （キー: ${keyColumn} / 方法: ${joinType}）
            </p>
        </div>
    `;
    document.getElementById('merge-summary').innerHTML = summaryHtml;

    // Render result table
    renderPreviewTable('merge-result', mergedResult, 50);

    // Show download section
    document.getElementById('merge-download-section').style.display = 'block';
}

// ==========================================
// Render (Module Entry Point)
// ==========================================
export function render(container, currentData, dataCharacteristics) {
    // Reset state
    mergeData1 = null;
    mergeData2 = null;
    mergedResult = null;

    container.innerHTML = `
        <div class="merge-container">
            <!-- 機能説明 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header" style="background: linear-gradient(135deg, #e6f3ff 0%, #f0f9ff 100%); border-left: 5px solid #1e90ff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <h3 style="margin: 0; color: #1e90ff; font-size: 1.5rem; font-weight: bold; display: flex; align-items: center; gap: 1rem;">
                        <span style="background: #1e90ff; color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem;">
                            <i class="fas fa-object-group"></i>
                        </span>
                        データ結合（マージ）について
                    </h3>
                    <i class="fas fa-chevron-down toggle-icon" style="color: #1e90ff;"></i>
                </div>
                <div class="collapsible-content" style="background: white; border-radius: 0 0 12px 12px; padding: 2rem; border: 1px solid #e2e8f0; border-top: none; margin-top: -5px;">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> データ結合とは？</strong>
                        <p>2つのExcel/CSVファイルを、共通のカラム（列）をキーにして1つのデータセットにまとめる機能です。</p>
                        <p>例：「生徒IDと数学の成績」のファイルと「生徒IDと英語の成績」のファイルを、生徒IDで結合できます。</p>
                    </div>
                    <h4>使い方</h4>
                    <ol>
                        <li>結合したい2つのファイルをアップロードします</li>
                        <li>結合に使用するキーカラム（共通の列）を選択します</li>
                        <li>結合の種類（内部結合/左結合/外部結合）を選びます</li>
                        <li>結合を実行し、結果をダウンロードします</li>
                    </ol>
                </div>
            </div>

            <!-- ファイルアップロード -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- ファイル1 -->
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #3182ce;">
                    <h4 style="color: #3182ce; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-file-excel"></i> 1つ目のファイル
                    </h4>
                    <div id="merge-upload1" class="merge-upload-area" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #3182ce; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; color: #64748b;">ファイルをドラッグ＆ドロップ<br>またはクリックして選択</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #94a3b8;">.xlsx, .xls, .csv</p>
                        <input type="file" id="merge-file1-input" accept=".xlsx,.xls,.csv" style="display: none;">
                    </div>
                    <div id="merge-file1-info" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: #f0fdf4; border-radius: 6px;">
                        <span id="merge-file1-name" style="color: #16a34a; font-weight: 500;"></span>
                    </div>
                    <div id="merge-preview1" style="margin-top: 1rem;"></div>
                </div>

                <!-- ファイル2 -->
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #dd6b20;">
                    <h4 style="color: #dd6b20; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-file-excel"></i> 2つ目のファイル
                    </h4>
                    <div id="merge-upload2" class="merge-upload-area" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #dd6b20; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; color: #64748b;">ファイルをドラッグ＆ドロップ<br>またはクリックして選択</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #94a3b8;">.xlsx, .xls, .csv</p>
                        <input type="file" id="merge-file2-input" accept=".xlsx,.xls,.csv" style="display: none;">
                    </div>
                    <div id="merge-file2-info" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: #fff7ed; border-radius: 6px;">
                        <span id="merge-file2-name" style="color: #c2410c; font-weight: 500;"></span>
                    </div>
                    <div id="merge-preview2" style="margin-top: 1rem;"></div>
                </div>
            </div>

            <!-- 結合設定 (hidden until both files are uploaded) -->
            <div id="merge-controls-section" style="display: none; margin-bottom: 2rem;"></div>

            <!-- 結果セクション -->
            <div id="merge-result-section" style="display: none; margin-bottom: 2rem;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                        <i class="fas fa-table"></i> 結合結果
                    </h4>
                    <div id="merge-summary"></div>
                    <div id="merge-result"></div>
                </div>
            </div>

            <!-- ダウンロード -->
            <div id="merge-download-section" style="display: none; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                    <i class="fas fa-download"></i> ダウンロード
                </h4>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <label for="merge-format-select" style="font-weight: 500;">ファイル形式:</label>
                    <select id="merge-format-select" style="padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 1rem;">
                        <option value="excel">Excel (.xlsx)</option>
                        <option value="csv">CSV (.csv)</option>
                    </select>
                    <button id="merge-download-btn" class="btn-analysis" style="font-weight: bold;">
                        <i class="fas fa-file-export"></i> 結合データをダウンロード
                    </button>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // Event Listeners Setup
    // ==========================================

    // File upload areas - click handler
    const upload1 = document.getElementById('merge-upload1');
    const upload2 = document.getElementById('merge-upload2');
    const fileInput1 = document.getElementById('merge-file1-input');
    const fileInput2 = document.getElementById('merge-file2-input');

    upload1.addEventListener('click', () => fileInput1.click());
    upload2.addEventListener('click', () => fileInput2.click());

    // Drag & Drop for file 1
    upload1.addEventListener('dragover', (e) => {
        e.preventDefault();
        upload1.style.borderColor = '#3182ce';
        upload1.style.background = 'rgba(49, 130, 206, 0.05)';
    });
    upload1.addEventListener('dragleave', () => {
        upload1.style.borderColor = '#cbd5e1';
        upload1.style.background = '';
    });
    upload1.addEventListener('drop', (e) => {
        e.preventDefault();
        upload1.style.borderColor = '#cbd5e1';
        upload1.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file, 1);
    });

    // Drag & Drop for file 2
    upload2.addEventListener('dragover', (e) => {
        e.preventDefault();
        upload2.style.borderColor = '#dd6b20';
        upload2.style.background = 'rgba(221, 107, 32, 0.05)';
    });
    upload2.addEventListener('dragleave', () => {
        upload2.style.borderColor = '#cbd5e1';
        upload2.style.background = '';
    });
    upload2.addEventListener('drop', (e) => {
        e.preventDefault();
        upload2.style.borderColor = '#cbd5e1';
        upload2.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file, 2);
    });

    // File input change handlers
    fileInput1.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file, 1);
    });
    fileInput2.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file, 2);
    });

    // Download button
    document.getElementById('merge-download-btn').addEventListener('click', () => {
        if (!mergedResult || mergedResult.length === 0) {
            alert('結合データがありません');
            return;
        }
        const format = document.getElementById('merge-format-select').value;
        if (format === 'csv') {
            downloadMergedCSV(mergedResult, 'merged_data.csv');
        } else {
            downloadMergedExcel(mergedResult, 'merged_data.xlsx');
        }
    });

    // Collapsible header
    container.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
    });
}

// ==========================================
// File Upload Handler
// ==========================================
async function handleFileUpload(file, fileNumber) {
    try {
        const data = await readUploadedFile(file);

        if (data.length === 0) {
            alert('ファイルにデータが含まれていません。');
            return;
        }

        if (fileNumber === 1) {
            mergeData1 = data;
            document.getElementById('merge-file1-info').style.display = 'block';
            document.getElementById('merge-file1-name').textContent = `✓ ${file.name}`;
            renderPreviewTable('merge-preview1', data);
        } else {
            mergeData2 = data;
            document.getElementById('merge-file2-info').style.display = 'block';
            document.getElementById('merge-file2-name').textContent = `✓ ${file.name}`;
            renderPreviewTable('merge-preview2', data);
        }

        // Update controls when both files are loaded
        if (mergeData1 && mergeData2) {
            updateMergeControls();
        }
    } catch (error) {
        console.error('File upload error:', error);
        alert(`ファイルの読み込みに失敗しました: ${error.message}`);
    }
}
