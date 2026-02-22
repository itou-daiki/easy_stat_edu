import { renderDataOverview, createVariableSelector } from '../utils.js';

// 元のデータのコピーを保持
let originalData = null;
let processedData = null;
let originalCharacteristics = null;
let processedCharacteristics = null;

// 外れ値の処理（IQR法）：該当する列の値のみNaNにし、行は削除しない
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

    // 行は残し、外れ値のセルだけその列においてNaNに置き換える（イミュータブルに新オブジェクトで返す）
    const result = data.map(row => {
        const newRow = { ...row };
        numericColumns.forEach(col => {
            const stat = stats[col];
            if (!stat) return;
            const val = newRow[col];
            if (val === null || val === undefined || isNaN(val)) return;
            if (val < stat.lower || val > stat.upper) {
                newRow[col] = NaN;
            }
        });
        return newRow;
    });

    return result;
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
        const numericCols = originalCharacteristics.numericColumns;
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
    // 外れ値処理は行削除ではなくNaN置換のため、行数は変わらない（欠損・空列削除のみ行数・列数が変わる）
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

    // データ型情報（保存済みの characteristics を使用）
    const dtypes = [];
    const chars = originalCharacteristics || {};
    if (chars.numericColumns) {
        chars.numericColumns.forEach(col => {
            dtypes.push({ col, type: '数値型' });
        });
    }
    if (chars.categoricalColumns) {
        chars.categoricalColumns.forEach(col => {
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

export function render(container, currentData, dataCharacteristics) {
    // 元のデータを保存
    originalData = JSON.parse(JSON.stringify(currentData));
    originalCharacteristics = JSON.parse(JSON.stringify(dataCharacteristics));
    processedData = null;
    processedCharacteristics = null;

    container.innerHTML = `
        <div class="cleansing-container">
            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section" style="margin-bottom: 2rem;">
                <div class="collapsible-header" style="background: linear-gradient(135deg, #e6f3ff 0%, #f0f9ff 100%); border-left: 5px solid #1e90ff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.3s ease;">
                    <h3 style="margin: 0; color: #1e90ff; font-size: 1.5rem; font-weight: bold; display: flex; align-items: center; gap: 1rem;">
                        <span style="background: #1e90ff; color: white; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem;">
                            <i class="fas fa-broom"></i>
                        </span>
                        データ加工・整形について
                    </h3>
                    <i class="fas fa-chevron-down toggle-icon" style="color: #1e90ff; transition: transform 0.3s ease;"></i>
                </div>
                <div class="collapsible-content" style="background: white; border-radius: 0 0 12px 12px; padding: 2rem; border: 1px solid #e2e8f0; border-top: none; margin-top: -5px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> データ加工・整形 (Data Processing) とは？</strong>
                        <p>分析を行う前にデータを整える重要なステップです。「値の変換」や「変数の作成」などのエンジニアリング機能と、「欠損値・外れ値処理」などのクレンジング機能を含みます。</p>
                        <img src="image/data_processing.png" alt="データ加工のイメージ" style="max-width: 100%; height: auto; margin-top: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin-left: auto; margin-right: auto;">
                    </div>
                    <h4>何ができるの？</h4>
                    <ul>
                        <li><strong>変数作成 (Engineering):</strong> リッカート尺度の数値化や、合計・平均変数の作成</li>
                        <li><strong>欠損値処理 (Cleansing):</strong> 空白データの削除</li>
                        <li><strong>外れ値処理 (Cleansing):</strong> IQR法を用いた極端な値の自動除去</li>
                    </ul>
                </div>
            </div>

            <!-- データ品質情報 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-check-circle"></i> データ品質情報
                </h4>
                <div id="data-quality-info"></div>
            </div>

            <!--元のデータプレビューと要約統計量（トップページと同じ仕様） -->
            <div id="original-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!--処理済みデータプレビューと要約統計量（トップページと同じ仕様） -->
            <!-- Note: Processed data overview is at the bottom, so this placeholder is likely redundant or should be removed. Logic below uses #processed-data-overview-section -->

            <!-- データエンジニアリング（変数変換・作成） -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem; border-left: 5px solid #805ad5;">
                <h4 style="color: #6b46c1; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-magic"></i> データ加工・変数作成 (Engineering)
                </h4>
                
                <div class="tabs" style="display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; overflow-x: auto;">
                    <button class="tab-btn active" onclick="showEngineeringTab('filter')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid #6b46c1; font-weight: bold; color: #6b46c1; cursor: pointer; white-space: nowrap;">
                        データの絞り込み (条件抽出)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('reverse')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        逆転項目の処理 (自動反転)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('categorize')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        数値のグループ化 (2値化)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('standardize')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        標準化 (Zスコア)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('recode')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        値の変換 (個別入力など)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('compute')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        変数の手動計算 (合計・平均等)
                    </button>
                    <button class="tab-btn" onclick="showEngineeringTab('cleansing')" style="padding: 0.5rem 1rem; background: none; border: none; border-bottom: 3px solid transparent; font-weight: bold; color: #718096; cursor: pointer; white-space: nowrap;">
                        文字列の整形 (全角半角・空白除去)
                    </button>
                </div>

                <!-- Tab 1: Filtering (Subset) -->
                <div id="eng-tab-filter" style="display: block;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-filter"></i> 変数に対して条件（「~に等しい」「~より大きい」など）を指定し、条件に一致するデータ（行）のみを残してプレビューします。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">条件を指定する変数:</label>
                            <select id="filter-var-select" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;"></select>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">条件式:</label>
                            <select id="filter-operator-select" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                                <option value="==">に等しい (==)</option>
                                <option value="!=">に等しくない (!=)</option>
                                <option value=">">より大きい (>)</option>
                                <option value=">=">以上 (>=)</option>
                                <option value="<">より小さい (<)</option>
                                <option value="<=">以下 (<=)</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">値 (数値 または テキスト):</label>
                            <input type="text" id="filter-value-input" class="form-control" placeholder="例: 1 または 男" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-filter-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-filter"></i> 条件を適用して絞り込む
                        </button>
                    </div>
                </div>

                <!-- Tab 2: Reverse Scoring -->
                <div id="eng-tab-reverse" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-sync-alt"></i> アンケートの逆転項目などを対象に、指定した最大値・最小値を使ってスコアを反転させます。（例：1〜5段階の場合、1→5, 2→4, 3→3 に変換）<br>
                            計算式: <code>(最大値 + 最小値) - 現在の値</code>
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">反転させる変数を選択 (複数選択可/Multiple Selection):</label>
                            <div id="reverse-col-select-container"></div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group" style="flex: 1;">
                                <label style="font-weight: bold;">尺度の最小値 (Min):</label>
                                <input type="number" id="reverse-min-input" class="form-control" placeholder="例: 1" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label style="font-weight: bold;">尺度の最大値 (Max):</label>
                                <input type="number" id="reverse-max-input" class="form-control" placeholder="例: 5" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">新しい変数名 (接尾辞/Suffix):</label>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※空欄の場合は上書き、入力した場合は「元の変数名 + 接尾辞」で作成されます</p>
                            <input type="text" id="reverse-new-col-name" class="form-control" placeholder="例: _rev" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-reverse-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-sync-alt"></i> 逆転処理を実行
                        </button>
                    </div>
                </div>

                <!-- Tab 3: Categorize -->
                <div id="eng-tab-categorize" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-layer-group"></i> テストの点数などを基準値（閾値）で区切り、「合格／不合格」「高群／低群」といった2つのグループ（カテゴリデータ）に変換します。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">グループ化する変数（数値）:</label>
                            <select id="categorize-var-select" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;"></select>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">基準値（閾値）:</label>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※この値「以上」が高群に含まれます。</p>
                            <input type="number" id="categorize-threshold-input" class="form-control" placeholder="例: 50" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                            <div class="form-group" style="flex: 1;">
                                <label style="font-weight: bold;">基準値以上のラベル:</label>
                                <input type="text" id="categorize-label-high" class="form-control" placeholder="例: 合格" value="高群" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                            </div>
                            <div class="form-group" style="flex: 1;">
                                <label style="font-weight: bold;">基準値未満のラベル:</label>
                                <input type="text" id="categorize-label-low" class="form-control" placeholder="例: 不合格" value="低群" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">新しい変数名 (接尾辞/Suffix):</label>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※入力した場合は「元の変数名 + 接尾辞」で作成されます</p>
                            <input type="text" id="categorize-new-col-name" class="form-control" placeholder="例: _cat" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-categorize-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-layer-group"></i> グループ変数を作成
                        </button>
                    </div>
                </div>

                <!-- Tab 4: Standardize -->
                <div id="eng-tab-standardize" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-arrows-alt-h"></i> 単位や満点の異なる変数を比較したり足し合わせたりするために、平均を0、標準偏差を1に揃える「標準化（Zスコア変換）」を行います。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">標準化する変数を選択 (複数選択可/Multiple Selection):</label>
                            <div id="standardize-col-select-container"></div>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">新しい変数名 (接尾辞/Suffix):</label>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※入力した場合は「元の変数名 + 接尾辞」で作成されます</p>
                            <input type="text" id="standardize-new-col-name" class="form-control" placeholder="例: _z" value="_z" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-standardize-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-arrows-alt-h"></i> 標準化（Zスコア）を実行
                        </button>
                    </div>
                </div>

                <!-- Tab 5: Recoding -->
                <div id="eng-tab-recode" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-info-circle"></i> テキストデータを数値に変換したり（例：「とてもそう思う」→ 5）、逆転項目の処理を行います。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">変換する変数を選択 (複数選択可/Multiple Selection):</label>
                            <div id="recode-col-select-container"></div>
                        </div>
                        <div id="recode-mapping-area" style="margin-bottom: 1rem;"></div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">新しい変数名 (接尾辞/Suffix):</label>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※空欄の場合は上書き、入力した場合は「元の変数名 + 接尾辞」で作成されます (例: _num)</p>
                            <input type="text" id="recode-new-col-name" class="form-control" placeholder="例: _recoded" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-recode-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-exchange-alt"></i> 変換を実行
                        </button>
                    </div>
                </div>

                <!-- Tab 6: Compute -->
                <div id="eng-tab-compute" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-calculator"></i> 複数の変数を手動でまとめて、新しい変数（合計点や平均点）を作成します。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">計算に使用する変数 (複数選択可):</label>
                            <div id="compute-col-select-container"></div>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">計算方法:</label>
                            <select id="compute-method-select" class="form-control" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                                <option value="mean">平均 (Mean)</option>
                                <option value="sum">合計 (Sum)</option>
                                <option value="diff">引き算 (差: A - B)</option>
                                <option value="prod">掛け算 (積: A × B)</option>
                                <option value="div">割り算 (商: A ÷ B)</option>
                            </select>
                            <p style="font-size: 0.8rem; color: #666; margin-top: 0;">※引き算と割り算は、選択した順番（1つ目から2つ目を引く/割る）で2変数のみ計算します。</p>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">新しい変数名 (必須):</label>
                            <input type="text" id="compute-new-col-name" class="form-control" placeholder="例: Factor1_Score" style="width: 100%; padding: 0.5rem; border-radius: 4px; border: 1px solid #cbd5e1;">
                        </div>
                        <button id="apply-compute-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-plus-circle"></i> 変数を作成
                        </button>
                    </div>
                </div>
                    </div>
                </div>
                <!-- Tab 8: Text Cleansing -->
                <div id="eng-tab-cleansing" style="display: none;">
                    <div style="background: #faf5ff; padding: 1rem; border-radius: 8px;">
                        <p style="margin-top: 0; color: #553c9a; font-size: 0.9rem;">
                            <i class="fas fa-magic"></i> 選択した変数の「全角英数字・記号」を半角に変換し、前後の余分な空白（スペース）を削除します。
                        </p>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: bold;">整形する変数 (複数選択可):</label>
                            <div id="cleansing-col-select-container"></div>
                        </div>
                        <button id="apply-cleansing-btn" class="btn-analysis" style="background: #805ad5; width: 100%;">
                            <i class="fas fa-magic"></i> 文字列を整形する
                        </button>
                    </div>
                </div>
            </div>

            <!--処理オプション -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <h4 style="color: #1e90ff; margin-bottom: 1rem; font-size: 1.3rem; font-weight: bold;">
                    <i class="fas fa-cogs"></i> 処理オプション
                </h4>
                <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: #fafbfc; border-radius: 8px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="remove-outliers-checkbox" style="margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;">
                        <span style="font-size: 1rem;">外れ値の処理（IQR法：範囲外の値はその列のみ欠損（NaN）にし、行は残す）</span>
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
        </div>
        `;

    // データ品質情報を表示
    displayDataQualityInfo();

    // 元のデータを表示（折りたたみ可能、トップページと同じ仕様）
    renderDataOverview('#original-data-overview', originalData, originalCharacteristics, { initiallyCollapsed: true });

    // エンジニアリングUIの初期化
    initEngineeringUI();

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

    // ... (既存のイベントリスナー) ...
}

// --- Data Engineering Functions ---

let engMultiSelect = null; // MultiSelect instance for compute
let recodeMultiSelect = null; // MultiSelect instance for recode
let cleansingMultiSelect = null; // MultiSelect instance for text cleansing

function initEngineeringUI() {
    // タブ切り替えロジック
    window.showEngineeringTab = function (tabName) {
        document.getElementById('eng-tab-filter').style.display = tabName === 'filter' ? 'block' : 'none';
        document.getElementById('eng-tab-reverse').style.display = tabName === 'reverse' ? 'block' : 'none';
        document.getElementById('eng-tab-categorize').style.display = tabName === 'categorize' ? 'block' : 'none';
        document.getElementById('eng-tab-standardize').style.display = tabName === 'standardize' ? 'block' : 'none';
        document.getElementById('eng-tab-recode').style.display = tabName === 'recode' ? 'block' : 'none';
        document.getElementById('eng-tab-compute').style.display = tabName === 'compute' ? 'block' : 'none';
        document.getElementById('eng-tab-cleansing').style.display = tabName === 'cleansing' ? 'block' : 'none';

        // ボタンのスタイル更新
        const buttons = document.querySelectorAll('.tab-btn');
        const tabTitleMap = {
            'filter': 'データの絞り込み',
            'reverse': '逆転項目の処理',
            'categorize': '数値のグループ化',
            'standardize': '標準化 (Zスコア)',
            'recode': '値の変換',
            'compute': '変数の手動計算',
            'cleansing': '文字列の整形'
        };
        buttons.forEach(btn => {
            if (btn.textContent.includes(tabTitleMap[tabName])) {
                btn.style.borderBottom = '3px solid #6b46c1';
                btn.style.color = '#6b46c1';
            } else {
                btn.style.borderBottom = '3px solid transparent';
                btn.style.color = '#718096';
            }
        });
    };

    // Filter用変数セレクトボックスの更新
    updateFilterColumnSelect();

    // Reverse用マルチセレクトの更新
    updateReverseColumnSelect();

    // Categorize用変数セレクトボックスの更新
    updateCategorizeColumnSelect();

    // Standardize用マルチセレクトの更新
    updateStandardizeColumnSelect();

    // Recode用変数セレクトボックスの更新
    updateRecodeColumnSelect();

    // Compute用マルチセレクトの更新
    updateComputeColumnSelect();

    // Cleansing用マルチセレクトの更新
    updateCleansingColumnSelect();

    // イベントリスナー
    document.getElementById('apply-filter-btn').onclick = applyFilter;
    document.getElementById('apply-reverse-btn').onclick = applyReverse;
    document.getElementById('apply-categorize-btn').onclick = applyCategorize;
    document.getElementById('apply-standardize-btn').onclick = applyStandardize;
    document.getElementById('apply-recode-btn').onclick = applyRecode;
    document.getElementById('apply-compute-btn').onclick = applyCompute;
    document.getElementById('apply-cleansing-btn').onclick = applyCleansing;
}

function updateFilterColumnSelect() {
    const filterSelect = document.getElementById('filter-var-select');
    if (!filterSelect) return;
    filterSelect.innerHTML = '<option value="">変数を選択...</option>';

    const cols = Object.keys(originalData[0] || {});
    cols.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        filterSelect.appendChild(option);
    });
}

let reverseMultiSelect = null;

function updateReverseColumnSelect() {
    const container = document.getElementById('reverse-col-select-container');
    if (!container) return;
    container.innerHTML = '';

    const cols = Object.keys(originalData[0] || {});

    // Numeric columns only ideally, but we'll list all for now
    reverseMultiSelect = createVariableSelector(container, cols, 'reverse-multi-select', {
        multiple: true,
        placeholder: '選択してください...'
    });
}

function getMultiSelectValues(selectElement) {
    if (!selectElement) return [];
    return Array.from(selectElement.options)
        .filter(opt => opt.selected)
        .map(opt => opt.value);
}

function updateCategorizeColumnSelect() {
    const categorizeSelect = document.getElementById('categorize-var-select');
    if (!categorizeSelect) return;
    categorizeSelect.innerHTML = '<option value="">変数を選択...</option>';

    const cols = Object.keys(originalData[0] || {});
    cols.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        categorizeSelect.appendChild(option);
    });
}

let standardizeMultiSelect = null;

function updateStandardizeColumnSelect() {
    const container = document.getElementById('standardize-col-select-container');
    if (!container) return;
    container.innerHTML = '';

    const cols = Object.keys(originalData[0] || {});

    // Numeric columns only ideally
    standardizeMultiSelect = createVariableSelector(container, cols, 'standardize-multi-select', {
        multiple: true,
        placeholder: '選択してください...'
    });
}

function updateRecodeColumnSelect() {
    const container = document.getElementById('recode-col-select-container');
    if (!container) {
        console.error('Recode container not found');
        return;
    }
    container.innerHTML = '';

    const cols = Object.keys(originalData[0] || {});

    recodeMultiSelect = createVariableSelector(container, cols, 'recode-multi-select', {
        multiple: true,
        placeholder: '選択してください...'
    });
    recodeMultiSelect.addEventListener('change', updateRecodeMappingTable);
}

function updateComputeColumnSelect() {
    const container = document.getElementById('compute-col-select-container');
    if (!container) return;
    container.innerHTML = '';

    // 数値変数を抽出 (文字列でも数値変換可能なものは含めるべきだが、まずは数値のみ)
    // いや、MultiSelectは全ての変数を出してよい
    const cols = Object.keys(originalData[0] || {});

    engMultiSelect = createVariableSelector(container, cols, 'compute-multi-select', {
        multiple: true,
        placeholder: '選択してください...'
    });
}

function updateRecodeMappingTable() {
    if (!recodeMultiSelect) return;
    const selectedCols = getMultiSelectValues(recodeMultiSelect);
    const container = document.getElementById('recode-mapping-area');

    if (selectedCols.length === 0) {
        container.innerHTML = '<p style="color: #666;">変数が選択されていません。</p>';
        return;
    }

    if (!container) return;

    // 全ての選択されたカラムからユニークな値を収集
    let allValues = new Set();
    selectedCols.forEach(col => {
        originalData.forEach(d => {
            const val = d[col];
            if (val !== null && val !== undefined && val !== '') {
                allValues.add(val);
            }
        });
    });

    // ソート（数値として解釈できる場合は数値順、そうでなければ辞書順）
    const uniqueValues = Array.from(allValues).sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return String(a).localeCompare(String(b));
    });

    // 値が多すぎる場合は警告
    if (uniqueValues.length > 50) {
        container.innerHTML = '<p style="color: red;">ユニークな値が多すぎるため（50以上）、マッピングテーブルを表示できません。</p>';
        return;
    }

    let html = `
        <table class="table" style="font-size: 0.9rem;">
            <thead>
                <tr>
                    <th>元の値</th>
                    <th>新しい値 (数値またはテキスト)</th>
                </tr>
            </thead>
            <tbody>
    `;

    uniqueValues.forEach((val, idx) => {
        let defaultVal = val;
        // 簡易的なデフォルト変換ロジック (例: "とてもそう思う" -> 5)
        // ここでは空欄にしてユーザーに入力させる
        html += `
            <tr>
                <td>${val}</td>
                <td><input type="text" class="recode-input" data-original="${val}" value="${val}" style="width: 100%; box-sizing: border-box; padding: 4px;"></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function applyRecode() {
    if (!recodeMultiSelect) return;
    const selectedCols = getMultiSelectValues(recodeMultiSelect);

    if (selectedCols.length === 0) {
        alert('変換する変数を選択してください');
        return;
    }

    const suffix = document.getElementById('recode-new-col-name').value.trim();
    const inputs = document.querySelectorAll('.recode-input');
    const mapping = {};

    inputs.forEach(input => {
        let val = input.value;
        // 数値変換を試みる
        if (input.value !== '' && !isNaN(Number(input.value))) {
            val = Number(input.value);
        }
        mapping[input.dataset.original] = val;
    });

    // データの更新
    // originalDataを直接書き換える（エンジニアリングは分析の前段階として扱い、これが「新しいオリジナルデータ」になる）
    // ただし、元のoriginalData配列の参照先を変更するのではなく、配列の中身（オブジェクト）を変更する

    originalData.forEach(row => {
        selectedCols.forEach(col => {
            const oldVal = row[col];
            // 新しいカラム名を決定 (サフィックスがあれば追加、なければ上書き)
            const newColName = suffix ? `${col}${suffix}` : col;

            // マッピングにない値はそのまま
            if (mapping.hasOwnProperty(oldVal)) {
                row[newColName] = mapping[oldVal];
            } else {
                row[newColName] = oldVal;
            }
        });
    });

    // 列が増えた場合、characteristicsを再分析
    updateDataAndUI('変数変換を実行しました');
}

function applyReverse() {
    if (!reverseMultiSelect) return;
    const selectedCols = getMultiSelectValues(reverseMultiSelect);

    if (selectedCols.length === 0) {
        alert('反転させる変数を選択してください');
        return;
    }

    const minValStr = document.getElementById('reverse-min-input').value;
    const maxValStr = document.getElementById('reverse-max-input').value;

    if (minValStr === '' || maxValStr === '') {
        alert('尺度の最小値と最大値を両方入力してください。');
        return;
    }

    const min = Number(minValStr);
    const max = Number(maxValStr);

    if (isNaN(min) || isNaN(max)) {
        alert('最小値と最大値は数値で入力してください。');
        return;
    }

    const suffix = document.getElementById('reverse-new-col-name').value.trim();

    originalData.forEach(row => {
        selectedCols.forEach(col => {
            const oldVal = row[col];
            const oldNum = Number(oldVal);

            const newColName = suffix ? `${col}${suffix}` : col;

            // 数値に変換可能な場合のみ反転処理
            if (oldVal !== null && oldVal !== '' && !isNaN(oldNum)) {
                row[newColName] = (max + min) - oldNum;
            } else {
                row[newColName] = oldVal; // 欠損値などはそのまま
            }
        });
    });

    updateDataAndUI(`${selectedCols.length}個の変数を反転しました`);
}

function applyCategorize() {
    const varName = document.getElementById('categorize-var-select').value;
    if (!varName) {
        alert('グループ化する変数を選択してください');
        return;
    }

    const thresholdStr = document.getElementById('categorize-threshold-input').value;
    if (thresholdStr === '') {
        alert('基準値（閾値）を入力してください');
        return;
    }

    const threshold = Number(thresholdStr);
    if (isNaN(threshold)) {
        alert('基準値には数値を入力してください');
        return;
    }

    const labelHigh = document.getElementById('categorize-label-high').value || '高群';
    const labelLow = document.getElementById('categorize-label-low').value || '低群';
    const suffix = document.getElementById('categorize-new-col-name').value.trim();
    const newColName = suffix ? `${varName}${suffix}` : varName;

    originalData.forEach(row => {
        const val = row[varName];
        if (val === null || val === undefined || val === '') {
            row[newColName] = val; // 欠損はそのまま
        } else {
            const numVal = Number(val);
            if (!isNaN(numVal)) {
                row[newColName] = numVal >= threshold ? labelHigh : labelLow;
            } else {
                row[newColName] = val; // 数値以外はそのまま
            }
        }
    });

    updateDataAndUI(`変数 ${varName} を ${labelHigh}/${labelLow} にグループ化しました`);
}

function applyStandardize() {
    if (!standardizeMultiSelect) return;
    const selectedCols = getMultiSelectValues(standardizeMultiSelect);

    if (selectedCols.length === 0) {
        alert('標準化する変数を選択してください');
        return;
    }

    const suffix = document.getElementById('standardize-new-col-name').value.trim();

    // 各列の平均と標準偏差を計算する
    const stats = {};
    selectedCols.forEach(col => {
        const values = originalData.map(d => Number(d[col])).filter(v => !isNaN(v));
        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1); // 標本分散（不偏）
            const stdDev = Math.sqrt(variance);
            stats[col] = { mean, stdDev };
        } else {
            stats[col] = { mean: 0, stdDev: 1 }; // fallback
        }
    });

    // Zスコアの適用
    originalData.forEach(row => {
        selectedCols.forEach(col => {
            const oldVal = row[col];
            const newColName = suffix ? `${col}${suffix}` : col;

            const oldNum = Number(oldVal);
            if (oldVal !== null && oldVal !== '' && !isNaN(oldNum) && stats[col].stdDev !== 0) {
                row[newColName] = (oldNum - stats[col].mean) / stats[col].stdDev;
            } else {
                row[newColName] = oldVal; // 計算不能または分散0の場合はそのまま
            }
        });
    });

    updateDataAndUI(`${selectedCols.length}個の変数をZスコアに標準化しました`);
}

function applyCompute() {
    const selectedCols = getMultiSelectValues(engMultiSelect);
    if (selectedCols.length === 0) {
        alert('計算に使用する変数を選択してください');
        return;
    }
    const method = document.getElementById('compute-method-select').value;
    const newColName = document.getElementById('compute-new-col-name').value.trim();

    if (!newColName) {
        alert('新しい変数名を入力してください');
        return;
    }

    if ((method === 'diff' || method === 'div') && selectedCols.length !== 2) {
        alert('引き算および割り算は、変数をちょうど2つ選択してください。');
        return;
    }

    originalData.forEach(row => {
        const values = selectedCols.map(c => Number(row[c])).filter(v => !isNaN(v));
        let result = null;
        if (values.length > 0) {
            if (method === 'sum') {
                result = values.reduce((a, b) => a + b, 0);
            } else if (method === 'mean') {
                result = values.reduce((a, b) => a + b, 0) / values.length;
            } else if (method === 'prod') {
                result = values.reduce((a, b) => a * b, 1);
            } else if (method === 'diff') {
                if (values.length === 2) {
                    result = values[0] - values[1];
                }
            } else if (method === 'div') {
                if (values.length === 2 && values[1] !== 0) {
                    result = values[0] / values[1];
                }
            }
        }
        row[newColName] = result; // null if no valid values
    });

    updateDataAndUI(`${newColName} を作成しました`);
}

function updateCleansingColumnSelect() {
    const container = document.getElementById('cleansing-col-select-container');
    if (!container) return;
    container.innerHTML = '';
    const cols = Object.keys(originalData[0] || {});

    cleansingMultiSelect = createVariableSelector(container, cols, 'cleansing-multi-select', {
        multiple: true,
        placeholder: '選択してください...'
    });
}

function applyCleansing() {
    if (!cleansingMultiSelect) return;
    const selectedCols = getMultiSelectValues(cleansingMultiSelect);

    if (selectedCols.length === 0) {
        alert('整形する変数を選択してください');
        return;
    }

    // 全角英数字を半角にし、全角スペースを半角スペースにする関数
    function toHalfWidth(str) {
        return str.replace(/[！-～]/g, function (s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        }).replace(/　/g, ' ');
    }

    let modifiedCount = 0;

    originalData.forEach(row => {
        selectedCols.forEach(col => {
            const oldVal = row[col];
            if (typeof oldVal === 'string') {
                const newVal = toHalfWidth(oldVal).trim();
                row[col] = newVal;
                modifiedCount++;
            }
        });
    });

    updateDataAndUI(`${selectedCols.length}個の変数の文字列を整形しました`);
}

function updateDataAndUI(message) {
    // データ特性の再分析
    originalCharacteristics = window.analyzeDataCharacteristics(originalData);

    // UI更新 (テーブルの再描画)
    renderDataOverview('#original-data-overview', originalData, originalCharacteristics, { initiallyCollapsed: false });

    renderDataOverview('#original-data-overview', originalData, originalCharacteristics, { initiallyCollapsed: false });

    updateFilterColumnSelect();
    updateReverseColumnSelect();
    updateCategorizeColumnSelect();
    updateStandardizeColumnSelect();
    updateRecodeColumnSelect();
    updateComputeColumnSelect();
    updateMergeBaseColumnSelect();
    updateCleansingColumnSelect();

    // データ品質情報の更新
    displayDataQualityInfo();

    alert(message);
}

function applyFilter() {
    const varName = document.getElementById('filter-var-select').value;
    const operator = document.getElementById('filter-operator-select').value;
    const inputValStr = document.getElementById('filter-value-input').value.trim();

    if (!varName) {
        alert('条件を指定する変数を選択してください');
        return;
    }
    if (inputValStr === '') {
        alert('条件の値を入力してください（空文字の場合はエラーになります）');
        return;
    }

    const numVal = Number(inputValStr);
    const isNumCompare = !isNaN(numVal);

    const filteredData = originalData.filter(row => {
        let val = row[varName];
        if (val === null || val === undefined) return false;

        let compVal = inputValStr;
        if (isNumCompare && !isNaN(Number(val))) {
            val = Number(val);
            compVal = numVal;
        } else {
            val = String(val);
        }

        switch (operator) {
            case '==': return val == compVal; // 意図的ゆるい一致（文字1と数値1）
            case '!=': return val != compVal;
            case '>': return val > compVal;
            case '>=': return val >= compVal;
            case '<': return val < compVal;
            case '<=': return val <= compVal;
            default: return false;
        }
    });

    if (filteredData.length === 0) {
        alert('指定された条件に一致するデータがありません。条件を見直してください。');
        return;
    }

    const removedRows = originalData.length - filteredData.length;
    originalData = filteredData;

    document.getElementById('processing-summary').innerHTML = `
        <div style="margin: 1rem 0; padding: 1rem; background: #f0f9ff; border-left: 4px solid #1e90ff; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #1e90ff;">絞り込み完了</p>
            <p style="margin: 0.5rem 0 0 0; color: #2d3748;">
                条件: <strong>${varName} ${operator} ${inputValStr}</strong><br>
                除外された行数: ${removedRows}行 (残り: ${originalData.length}行)
            </p>
        </div>
    `;

    updateDataAndUI(`絞り込みを実行しました。${originalData.length}行が残りました。`);
}


// End of file
