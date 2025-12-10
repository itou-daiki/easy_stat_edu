// ==========================================
// Imports
// ==========================================
import { getAnalysisTitle, showError, showLoadingMessage, hideLoadingMessage, toggleCollapsible } from './utils.js';

// ==========================================
// Global Variables & Exports for Modules
// ==========================================
export let currentData = null;
export let dataCharacteristics = null;
let originalData = null; // 元のデータを保持
let sortState = { column: null, direction: 'asc' }; // ソート状態を管理

// ==========================================
// DOM Elements
// ==========================================
const loadingScreen = document.getElementById('loading-screen');
const mainApp = document.getElementById('main-app');
const uploadArea = document.getElementById('main-upload-area');
const uploadBtn = document.getElementById('main-upload-btn');
const fileInput = document.getElementById('main-data-file');
const fileInfo = document.getElementById('main-file-info');
const demoBtn = document.getElementById('load-demo-btn');
const featureGrid = document.querySelector('.feature-grid');

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadingScreen.style.display = 'none';
    mainApp.style.display = 'block';

    uploadArea.style.opacity = 1;
    uploadArea.style.pointerEvents = 'auto';
    uploadBtn.innerHTML = '<i class="fas fa-file-import"></i> ファイルを選択';
    uploadBtn.disabled = false;
    fileInput.disabled = false;
    document.querySelector('.upload-text').textContent = 'ここにファイルをドラッグ＆ドロップ';

    setupEventListeners();
});

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) handleFile(file);
    });
    uploadArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (event) => {
        event.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = event.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    demoBtn.addEventListener('click', () => loadDemoData('eda_demo.xlsx'));

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => toggleCollapsible(header));
    });

    // ソート用のイベントリスナー (イベント委任)
    document.getElementById('dataframe-container').addEventListener('click', (event) => {
        const th = event.target.closest('th');
        if (th && th.dataset.column) {
            handleSort(th.dataset.column);
        }
    });
}

// ==========================================
// File Handling & Data Processing
// ==========================================
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            if (jsonData.length === 0) {
                showError('ファイルにデータが含まれていません。');
                return;
            }
            processData(file.name, jsonData);
        } catch (error) {
            showError('ファイルの読み込みに失敗しました。');
        }
    };
    reader.onerror = () => showError('ファイルの読み取り中にエラーが発生しました。');
    reader.readAsArrayBuffer(file);
}

async function loadDemoData(fileName) {
    showLoadingMessage(`デモデータ (${fileName}) を読み込み中...`);
    try {
        const response = await fetch(`./datasets/${fileName}`);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        processData(fileName, jsonData);
    } catch (error) {
        showError(`デモデータ (${fileName}) の読み込みに失敗しました。`);
    }
}

function processData(fileName, jsonData) {
    originalData = jsonData; // 元データを保存
    currentData = [...originalData]; // 表示・ソート用のコピーを作成

    sortState = { column: null, direction: 'asc' };
    
    const characteristics = analyzeDataCharacteristics(jsonData);
    window.dataCharacteristics = characteristics;
    dataCharacteristics = characteristics;
    
    updateFileInfo(fileName, jsonData);
    
    renderDataFrame();
    renderSummaryStatistics(jsonData, characteristics);
    
    const dataPreviewSection = document.getElementById('data-preview-section');
    dataPreviewSection.style.display = 'block';
    
    dataPreviewSection.querySelectorAll('.collapsible-header').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        newHeader.addEventListener('click', () => toggleCollapsible(newHeader));
    });

    updateFeatureCards();
    hideLoadingMessage();
}

function analyzeDataCharacteristics(data) {
    if (!data || data.length === 0) return null;
    const characteristics = { numericColumns: [], categoricalColumns: [], textColumns: [] };
    const columns = Object.keys(data[0]);
    
    columns.forEach(col => {
        const values = data.map(row => row[col]).filter(val => val != null);
        if (values.length === 0) return;

        const isNumeric = values.every(val => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))));
        if (isNumeric) {
            characteristics.numericColumns.push(col);
            data.forEach(row => { 
                if(row[col] != null) row[col] = Number(row[col]);
            });
        } else {
            const uniqueRatio = new Set(values).size / values.length;
            if (uniqueRatio < 0.5 && values.length > 5) {
                characteristics.categoricalColumns.push(col);
            } else {
                characteristics.textColumns.push(col);
            }
        }
    });
    return characteristics;
}
window.analyzeDataCharacteristics = analyzeDataCharacteristics;

// ==========================================
// Sorting Logic
// ==========================================
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

    renderDataFrame();
}

// ==========================================
// UI Updates & View Management
// ==========================================
function updateFileInfo(fileName, data) {
    const nRows = data.length;
    const nCols = Object.keys(data[0] || {}).length;
    fileInfo.innerHTML = `<p><strong>ファイル名:</strong> ${fileName}</p><p><strong>行数:</strong> ${nRows}</p><p><strong>列数:</strong> ${nCols}</p>`;
    fileInfo.style.display = 'block';
}

function updateFeatureCards() {
    if (!dataCharacteristics) return;
    const counts = { 
        numeric: dataCharacteristics.numericColumns.length, 
        categorical: dataCharacteristics.categoricalColumns.length, 
        text: dataCharacteristics.textColumns.length 
    };

    featureGrid.querySelectorAll('.feature-card').forEach(card => {
        const req = card.dataset.requires;
        if (!req || req === 'none') {
            enableCard(card);
            return;
        }
        const meetsRequirements = req.split(',').every(r => {
            const [type, count] = r.split(':');
            return counts[type] >= parseInt(count, 10);
        });
        meetsRequirements ? enableCard(card) : disableCard(card);
    });
}
window.updateFeatureCards = updateFeatureCards;

function enableCard(card) {
    card.classList.remove('disabled');
    const requirementText = card.querySelector('.feature-card-requirement');
    if (requirementText) requirementText.style.display = 'none';
    card.onclick = () => showAnalysisView(card.dataset.analysis);
}

function disableCard(card) {
    card.classList.add('disabled');
    const requirementText = card.querySelector('.feature-card-requirement');
    if (requirementText) requirementText.style.display = 'block';
    card.onclick = null;
}

async function showAnalysisView(analysisType) {
    document.getElementById('navigation-section').style.display = 'none';
    document.getElementById('upload-section-main').style.display = 'none';
    
    const analysisHeader = document.getElementById('analysis-header');
    const analysisArea = document.getElementById('analysis-area');
    const analysisTitle = document.getElementById('analysis-title');
    const analysisContent = document.getElementById('analysis-content');
    
    analysisTitle.textContent = getAnalysisTitle(analysisType);
    analysisContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 分析モジュールを読み込み中...</div>`;

    analysisHeader.style.display = 'flex';
    analysisArea.style.display = 'block';

    try {
        const modulePath = `./analyses/${analysisType}.js`;
        const analysisModule = await import(modulePath);
        analysisModule.render(analysisContent, dataCharacteristics);
    } catch (error) {
        analysisContent.innerHTML = `<p class="error-message">分析機能の読み込みに失敗しました。(${analysisType}.js)<br>この機能はまだ実装されていない可能性があります。</p>`;
    }
}

function renderDataFrame() {
    const container = document.getElementById('dataframe-container');
    const data = currentData;

    if (!data || data.length === 0) {
        container.innerHTML = '<p>表示するデータがありません。</p>';
        return;
    }

    const columns = Object.keys(data[0]);
    let tableHtml = '<table class="table">';
    
    tableHtml += '<thead><tr>';
    columns.forEach(col => {
        let indicator = '';
        if (sortState.column === col) {
            indicator = sortState.direction === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
        }
        tableHtml += `<th data-column="${col}" style="cursor: pointer;">${col}${indicator}</th>`;
    });
    tableHtml += '</tr></thead>';

    tableHtml += '<tbody>';
    data.forEach(row => {
        tableHtml += '<tr>';
        columns.forEach(col => {
            const value = row[col];
            tableHtml += `<td>${value != null ? value : ''}</td>`;
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    container.innerHTML = tableHtml;
}

function renderSummaryStatistics(data, characteristics) {
    const container = document.getElementById('summary-stats-container');
    if (!data || data.length === 0) {
        container.innerHTML = '<p>統計量を計算するデータがありません。</p>';
        return;
    }
    
    const { numericColumns, categoricalColumns, textColumns } = characteristics;
    const allColumns = Object.keys(data[0]);

    let tableHtml = '<table class="table"><thead><tr>' +
                    '<th>変数名</th><th>型</th><th>欠損値(%)</th><th>平均</th><th>標準偏差</th>' + 
                    '<th>最小値</th><th>中央値</th><th>最大値</th><th>ユニーク数</th>' +
                    '</tr></thead><tbody>';

    allColumns.forEach(col => {
        const values = data.map(row => row[col]).filter(v => v != null);
        const missingRate = (( (data.length - values.length) / data.length) * 100).toFixed(1);

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
            if(categoricalColumns.includes(col)) type = 'カテゴリ';
            else if(textColumns.includes(col)) type = 'テキスト';
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

    tableHtml += '</tbody></table>';
    container.innerHTML = tableHtml;
}

window.backToHome = () => {
    document.getElementById('analysis-header').style.display = 'none';
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('navigation-section').style.display = 'block';
    document.getElementById('upload-section-main').style.display = 'block';
};
