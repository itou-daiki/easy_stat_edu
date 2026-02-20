// ==========================================
// Factor Score Calculator Module
// ==========================================
// Calculates factor scores from questionnaire data using scale information.
// This module works independently of the main data upload (data-requires="none").

let scaleInfoData = null;
let questionnaireData = null;
let factorResult = null;

// ==========================================
// File Reading Helper
// ==========================================
function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                let jsonData;
                if (file.name.endsWith('.csv')) {
                    const workbook = XLSX.read(data, { type: 'string', raw: false });
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
// Factor Score Calculation Logic
// ==========================================
function calculateFactorScores(scaleInfo, data, nScale) {
    // Validate that all questions exist in data
    const dataColumns = Object.keys(data[0]);
    const missingQuestions = scaleInfo
        .map(row => row['設問名'])
        .filter(q => !dataColumns.includes(q));

    if (missingQuestions.length > 0) {
        return { error: `次の設問がデータに存在しません: ${missingQuestions.join(', ')}` };
    }

    // Deep copy data
    const result = data.map(row => ({ ...row }));

    // Reverse scoring for reversed items
    scaleInfo.forEach(info => {
        if (Number(info['反転']) === 1) {
            const qName = info['設問名'];
            result.forEach(row => {
                if (row[qName] !== undefined && row[qName] !== null) {
                    row[qName] = nScale + 1 - Number(row[qName]);
                }
            });
        }
    });

    // Get unique factor names
    const factors = [...new Set(scaleInfo.map(row => row['因子名']))];

    // Calculate factor scores (mean of relevant questions)
    factors.forEach(factor => {
        const relevantQuestions = scaleInfo
            .filter(row => row['因子名'] === factor)
            .map(row => row['設問名']);

        result.forEach(row => {
            const values = relevantQuestions
                .map(q => Number(row[q]))
                .filter(v => !isNaN(v));

            if (values.length > 0) {
                const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
                row[factor + '_因子得点'] = Math.round(mean * 100) / 100;
            } else {
                row[factor + '_因子得点'] = null;
            }
        });

        // Remove original question columns
        relevantQuestions.forEach(q => {
            result.forEach(row => {
                delete row[q];
            });
        });
    });

    return { data: result, factors };
}

// ==========================================
// Template Download
// ==========================================
function downloadScaleTemplate() {
    const templateData = [
        { '設問名': 'Q1', '因子名': '因子A', '反転': 0 },
        { '設問名': 'Q2', '因子名': '因子A', '反転': 0 },
        { '設問名': 'Q3', '因子名': '因子A', '反転': 1 },
        { '設問名': 'Q4', '因子名': '因子B', '反転': 0 },
        { '設問名': 'Q5', '因子名': '因子B', '反転': 0 },
    ];
    try {
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '尺度情報');
        XLSX.writeFile(wb, '尺度情報テンプレート.xlsx');
    } catch (error) {
        console.error('Template download error:', error);
    }
}

// ==========================================
// Download Helpers
// ==========================================
function downloadResultCSV(data, fileName) {
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
    link.download = fileName || '因子得点算出結果.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadResultExcel(data, fileName) {
    if (!data || data.length === 0) return;
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '因子得点');
        XLSX.writeFile(wb, fileName || '因子得点算出結果.xlsx');
    } catch (error) {
        console.error('Excel download error:', error);
        alert('Excelファイルのダウンロードに失敗しました。');
    }
}

// ==========================================
// Render (Module Entry Point)
// ==========================================
export function render(container, currentData, dataCharacteristics) {
    // Reset state
    scaleInfoData = null;
    questionnaireData = null;
    factorResult = null;

    container.innerHTML = `
        <div class="factor-score-container">
            <!-- 機能説明 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header" style="background: linear-gradient(135deg, #fef3e2 0%, #fffbf0 100%); border-left: 5px solid #dd6b20; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <h3 style="margin: 0; color: #dd6b20; font-size: 1.5rem; font-weight: bold; display: flex; align-items: center; gap: 1rem;">
                        <span style="background: #dd6b20; color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem;">
                            <i class="fas fa-calculator"></i>
                        </span>
                        因子得点算出について
                    </h3>
                    <i class="fas fa-chevron-down toggle-icon" style="color: #dd6b20;"></i>
                </div>
                <div class="collapsible-content" style="background: white; border-radius: 0 0 12px 12px; padding: 2rem; border: 1px solid #e2e8f0; border-top: none; margin-top: -5px;">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> 因子得点とは？</strong>
                        <p>アンケートや心理尺度の各因子（下位尺度）に属する設問の回答を平均化した得点です。反転項目は自動で処理されます。</p>
                    </div>
                    <h4>使い方</h4>
                    <ol>
                        <li><strong>尺度情報ファイル</strong>をアップロード（設問名・因子名・反転の3列）</li>
                        <li><strong>データファイル</strong>をアップロード（アンケート回答データ）</li>
                        <li><strong>n件法</strong>を設定（例: 5件法なら「5」）</li>
                        <li>「因子得点を計算」ボタンを押して結果をダウンロード</li>
                    </ol>
                    <h4>尺度情報ファイルの形式</h4>
                    <table class="table" style="font-size: 0.85rem; max-width: 400px;">
                        <thead><tr><th>設問名</th><th>因子名</th><th>反転</th></tr></thead>
                        <tbody>
                            <tr><td>Q1</td><td>因子A</td><td>0</td></tr>
                            <tr><td>Q2</td><td>因子A</td><td>0</td></tr>
                            <tr><td>Q3</td><td>因子A</td><td>1</td></tr>
                            <tr><td>Q4</td><td>因子B</td><td>0</td></tr>
                        </tbody>
                    </table>
                    <p style="font-size: 0.85rem; color: #64748b;">※「反転」列は反転項目の場合に1を入力します。</p>
                </div>
            </div>

            <!-- ファイルアップロード -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <!-- 尺度情報ファイル -->
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #dd6b20;">
                    <h4 style="color: #dd6b20; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-list-alt"></i> 尺度情報ファイル
                    </h4>
                    <div id="fs-upload-scale" class="merge-upload-area" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #dd6b20; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; color: #64748b;">クリックまたはドラッグ＆ドロップ</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #94a3b8;">.xlsx, .xls, .csv</p>
                        <input type="file" id="fs-scale-file-input" accept=".xlsx,.xls,.csv" style="display: none;">
                    </div>
                    <div style="margin-top: 0.75rem; text-align: center;">
                        <button id="fs-template-btn" style="background: none; border: 1px solid #dd6b20; color: #dd6b20; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                            <i class="fas fa-download"></i> テンプレートをダウンロード
                        </button>
                    </div>
                    <div id="fs-scale-file-info" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: #fff7ed; border-radius: 6px;">
                        <span id="fs-scale-file-name" style="color: #c2410c; font-weight: 500;"></span>
                    </div>
                    <div id="fs-scale-preview" style="margin-top: 1rem;"></div>
                </div>

                <!-- データファイル -->
                <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #3182ce;">
                    <h4 style="color: #3182ce; margin-bottom: 1rem; font-size: 1.1rem;">
                        <i class="fas fa-file-excel"></i> データファイル
                    </h4>
                    <div id="fs-upload-data" class="merge-upload-area" style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-cloud-upload-alt" style="font-size: 2rem; color: #3182ce; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; color: #64748b;">クリックまたはドラッグ＆ドロップ</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #94a3b8;">.xlsx, .xls, .csv</p>
                        <input type="file" id="fs-data-file-input" accept=".xlsx,.xls,.csv" style="display: none;">
                    </div>
                    <div id="fs-data-file-info" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: #f0fdf4; border-radius: 6px;">
                        <span id="fs-data-file-name" style="color: #16a34a; font-weight: 500;"></span>
                    </div>
                    <div id="fs-data-preview" style="margin-top: 1rem;"></div>
                </div>
            </div>

            <!-- 計算設定 -->
            <div id="fs-controls-section" style="display: none; margin-bottom: 2rem;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #dd6b20; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                        <i class="fas fa-cogs"></i> 計算設定
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-end;">
                        <div style="min-width: 200px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
                                <i class="fas fa-sort-numeric-up"></i> 何件法？
                            </label>
                            <input type="number" id="fs-n-scale" value="5" min="2" max="10" step="1" style="width: 120px; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem;">
                            <p style="font-size: 0.75rem; color: #94a3b8; margin: 0.25rem 0 0 0;">例: 5件法→5, 7件法→7</p>
                        </div>
                        <div>
                            <button id="fs-calculate-btn" class="btn-analysis" style="padding: 0.75rem 2rem; font-size: 1rem; font-weight: bold;">
                                <i class="fas fa-calculator"></i> 因子得点を計算
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 結果セクション -->
            <div id="fs-result-section" style="display: none; margin-bottom: 2rem;">
                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #dd6b20; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                        <i class="fas fa-table"></i> 計算結果
                    </h4>
                    <div id="fs-summary"></div>
                    <div id="fs-result"></div>
                </div>
            </div>

            <!-- ダウンロード -->
            <div id="fs-download-section" style="display: none; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #dd6b20; margin-bottom: 1rem; font-size: 1.2rem; font-weight: bold;">
                    <i class="fas fa-download"></i> ダウンロード
                </h4>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <label for="fs-format-select" style="font-weight: 500;">ファイル形式:</label>
                    <select id="fs-format-select" style="padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 1rem;">
                        <option value="excel">Excel (.xlsx)</option>
                        <option value="csv">CSV (.csv)</option>
                    </select>
                    <button id="fs-download-btn" class="btn-analysis" style="font-weight: bold;">
                        <i class="fas fa-file-export"></i> 結果をダウンロード
                    </button>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // Event Listeners
    // ==========================================
    const uploadScale = document.getElementById('fs-upload-scale');
    const uploadData = document.getElementById('fs-upload-data');
    const scaleInput = document.getElementById('fs-scale-file-input');
    const dataInput = document.getElementById('fs-data-file-input');

    uploadScale.addEventListener('click', () => scaleInput.click());
    uploadData.addEventListener('click', () => dataInput.click());

    // Drag & Drop for scale file
    uploadScale.addEventListener('dragover', (e) => { e.preventDefault(); uploadScale.style.borderColor = '#dd6b20'; });
    uploadScale.addEventListener('dragleave', () => { uploadScale.style.borderColor = '#cbd5e1'; });
    uploadScale.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadScale.style.borderColor = '#cbd5e1';
        const file = e.dataTransfer.files[0];
        if (file) handleScaleUpload(file);
    });

    // Drag & Drop for data file
    uploadData.addEventListener('dragover', (e) => { e.preventDefault(); uploadData.style.borderColor = '#3182ce'; });
    uploadData.addEventListener('dragleave', () => { uploadData.style.borderColor = '#cbd5e1'; });
    uploadData.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadData.style.borderColor = '#cbd5e1';
        const file = e.dataTransfer.files[0];
        if (file) handleDataUpload(file);
    });

    // File inputs
    scaleInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleScaleUpload(file);
    });
    dataInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleDataUpload(file);
    });

    // Template download
    document.getElementById('fs-template-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadScaleTemplate();
    });

    // Calculate button
    document.getElementById('fs-calculate-btn').addEventListener('click', executeCalculation);

    // Download button
    document.getElementById('fs-download-btn').addEventListener('click', () => {
        if (!factorResult || factorResult.length === 0) {
            alert('計算結果がありません');
            return;
        }
        const format = document.getElementById('fs-format-select').value;
        if (format === 'csv') {
            downloadResultCSV(factorResult, '因子得点算出結果.csv');
        } else {
            downloadResultExcel(factorResult, '因子得点算出結果.xlsx');
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
// File Upload Handlers
// ==========================================
async function handleScaleUpload(file) {
    try {
        const data = await readUploadedFile(file);
        if (data.length === 0) { alert('ファイルにデータが含まれていません。'); return; }

        // Validate required columns
        const cols = Object.keys(data[0]);
        const required = ['設問名', '因子名', '反転'];
        const missing = required.filter(c => !cols.includes(c));
        if (missing.length > 0) {
            alert(`尺度情報ファイルに必要な列が不足しています: ${missing.join(', ')}\n必要な列: 設問名, 因子名, 反転`);
            return;
        }

        scaleInfoData = data;
        document.getElementById('fs-scale-file-info').style.display = 'block';
        document.getElementById('fs-scale-file-name').textContent = `✓ ${file.name}`;
        renderPreviewTable('fs-scale-preview', data);

        updateControls();
    } catch (error) {
        console.error('Scale file upload error:', error);
        alert(`ファイルの読み込みに失敗しました: ${error.message}`);
    }
}

async function handleDataUpload(file) {
    try {
        const data = await readUploadedFile(file);
        if (data.length === 0) { alert('ファイルにデータが含まれていません。'); return; }

        questionnaireData = data;
        document.getElementById('fs-data-file-info').style.display = 'block';
        document.getElementById('fs-data-file-name').textContent = `✓ ${file.name}`;
        renderPreviewTable('fs-data-preview', data);

        updateControls();
    } catch (error) {
        console.error('Data file upload error:', error);
        alert(`ファイルの読み込みに失敗しました: ${error.message}`);
    }
}

function updateControls() {
    const controls = document.getElementById('fs-controls-section');
    if (scaleInfoData && questionnaireData) {
        controls.style.display = 'block';
    }
}

function executeCalculation() {
    const nScale = parseInt(document.getElementById('fs-n-scale').value, 10);
    if (isNaN(nScale) || nScale < 2) {
        alert('有効な件法を入力してください（2以上の整数）');
        return;
    }

    if (!scaleInfoData || !questionnaireData) {
        alert('尺度情報ファイルとデータファイルの両方をアップロードしてください。');
        return;
    }

    const result = calculateFactorScores(scaleInfoData, questionnaireData, nScale);

    if (result.error) {
        alert(result.error);
        return;
    }

    factorResult = result.data;

    // Display result
    const resultSection = document.getElementById('fs-result-section');
    resultSection.style.display = 'block';

    const factorList = result.factors.map(f => `<span style="background: #fff7ed; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500;">${f}</span>`).join(' ');

    const summaryHtml = `
        <div style="margin-bottom: 1rem; padding: 1rem; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #16a34a;">
                <i class="fas fa-check-circle"></i> 因子得点の計算が完了しました
            </p>
            <p style="margin: 0.5rem 0 0 0; color: #2d3748;">
                算出された因子: ${factorList}<br>
                データ: ${factorResult.length}行 × ${Object.keys(factorResult[0]).length}列
            </p>
        </div>
    `;
    document.getElementById('fs-summary').innerHTML = summaryHtml;

    renderPreviewTable('fs-result', factorResult, 50);

    document.getElementById('fs-download-section').style.display = 'block';
}
