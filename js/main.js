// ==========================================
// Imports
// ==========================================
import { showError, showLoadingMessage, hideLoadingMessage, toggleCollapsible, renderDataPreview, renderSummaryStatistics, renderDataOverview } from './utils.js';

// ==========================================
// Global Variables & Exports for Modules
// ==========================================
export let currentData = null;
export let dataCharacteristics = null;

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
    demoBtn.addEventListener('click', () => loadDemoData('demo_all_analysis.csv'));

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => toggleCollapsible(header));
    });
}

// ==========================================
// File Handling & Data Processing
// ==========================================
function handleFile(file) {
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

            if (jsonData.length === 0) {
                showError('ファイルにデータが含まれていません。');
                return;
            }
            processData(file.name, jsonData);
        } catch (error) {
            console.error(error);
            showError('ファイルの読み込みに失敗しました。');
        }
    };
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

async function loadDemoData(fileName) {
    showLoadingMessage(`デモデータ (${fileName}) を読み込み中...`);
    try {
        const response = await fetch(`./datasets/${fileName}`);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        let jsonData;
        if (fileName.endsWith('.csv')) {
            const text = await response.text();
            const workbook = XLSX.read(text, { type: 'string', raw: true });
            jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
            const data = await response.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }

        processData(fileName, jsonData);
    } catch (error) {
        console.error(error);
        showError(`デモデータ (${fileName}) の読み込みに失敗しました。`);
    }
}

function processData(fileName, jsonData) {
    currentData = jsonData;

    const characteristics = analyzeDataCharacteristics(jsonData);
    window.dataCharacteristics = characteristics;
    dataCharacteristics = characteristics;

    updateFileInfo(fileName, jsonData);

    // 共通関数を使用してデータプレビューと要約統計量を表示
    renderDataPreview('dataframe-container', currentData, 'データプレビュー');
    renderSummaryStatistics('summary-stats-container', currentData, characteristics, '要約統計量');

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
                if (row[col] != null) row[col] = Number(row[col]);
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
// UI Updates & View Management
// ==========================================
function updateFileInfo(fileName, data) {
    const nRows = data.length;
    const nCols = Object.keys(data[0] || {}).length;

    fileInfo.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; color: #1e293b;">
            <i class="fas fa-info-circle" style="color: #1e90ff;"></i> データ情報
        </h3>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <div style="flex: 2; min-width: 200px; background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-file-excel" style="margin-right: 0.5rem; color: #1e90ff;"></i>ファイル名
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 1.1rem; word-break: break-all;">
                    ${fileName}
                </div>
            </div>
            
            <div style="flex: 1; min-width: 120px; background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-list-ol" style="margin-right: 0.5rem; color: #1e90ff;"></i>行数
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 1.5rem;">
                    ${nRows.toLocaleString()}
                </div>
            </div>
            
            <div style="flex: 1; min-width: 120px; background: #f8fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-columns" style="margin-right: 0.5rem; color: #1e90ff;"></i>列数
                </div>
                <div style="font-weight: bold; color: #1e293b; font-size: 1.5rem;">
                    ${nCols.toLocaleString()}
                </div>
            </div>
        </div>
    `;
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
    const analysisContent = document.getElementById('analysis-content');


    analysisContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 分析モジュールを読み込み中...</div>`;

    analysisHeader.style.display = 'flex';
    analysisArea.style.display = 'block';

    try {
        const modulePath = `./analyses/${analysisType}.js`;
        const analysisModule = await import(modulePath);
        analysisModule.render(analysisContent, currentData, dataCharacteristics);
    } catch (error) {
        console.error(error);
        analysisContent.innerHTML = `<p class="error-message">分析機能の読み込みに失敗しました。(${analysisType}.js)<br>エラー詳細: ${error.message}<br><pre>${error.stack}</pre></p>`;
    }
}

window.backToHome = () => {
    document.getElementById('analysis-header').style.display = 'none';
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('navigation-section').style.display = 'block';
    document.getElementById('upload-section-main').style.display = 'block';
};
