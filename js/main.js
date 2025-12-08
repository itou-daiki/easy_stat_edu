// ==========================================
// Imports
// ==========================================
import { getAnalysisTitle, showError, showLoadingMessage, hideLoadingMessage } from './utils.js';

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
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (event) => {
        event.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = event.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    demoBtn.addEventListener('click', () => {
        loadDemoData('eda_demo.xlsx');
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
            console.error('File reading error:', error);
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
        console.error('Demo data loading error:', error);
        showError(`デモデータ (${fileName}) の読み込みに失敗しました。`);
    }
}

function processData(fileName, jsonData) {
    currentData = jsonData;
    // Make dataCharacteristics mutable for cleansing operations
    window.dataCharacteristics = analyzeDataCharacteristics(jsonData);
    dataCharacteristics = window.dataCharacteristics;
    
    console.log('Data processed:', { fileName, dataCharacteristics });
    
    updateFileInfo(fileName, jsonData);
    updateFeatureCards();
    hideLoadingMessage();
}

export function analyzeDataCharacteristics(data) {
    if (!data || data.length === 0) return null;
    const characteristics = { numericColumns: [], categoricalColumns: [], textColumns: [] };
    const columns = Object.keys(data[0]);
    
    columns.forEach(col => {
        const values = data.map(row => row[col]).filter(val => val != null);
        if (values.length === 0) return;

        const isNumeric = values.every(val => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))));
        if (isNumeric) {
            characteristics.numericColumns.push(col);
            // Convert string numbers to actual numbers
            currentData.forEach(row => { row[col] = Number(row[col]); });
        } else {
            const uniqueRatio = new Set(values).size / values.length;
            if (uniqueRatio < 0.5 && values.length > 5) { // Adjusted threshold
                characteristics.categoricalColumns.push(col);
            } else {
                characteristics.textColumns.push(col);
            }
        }
    });
    return characteristics;
}
// For access from cleansing.js
window.analyzeDataCharacteristics = analyzeDataCharacteristics; 


// ==========================================
// UI Updates & View Management
// ==========================================
function updateFileInfo(fileName, data) {
    const nRows = data.length;
    const nCols = Object.keys(data[0] || {}).length;
    fileInfo.innerHTML = `<p><strong>ファイル名:</strong> ${fileName}</p><p><strong>行数:</strong> ${nRows}</p><p><strong>列数:</strong> ${nCols}</p>`;
    fileInfo.style.display = 'block';
}

export function updateFeatureCards() {
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
// For access from cleansing.js
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
    console.log(`Switching to analysis view: ${analysisType}`);
    document.getElementById('navigation-section').style.display = 'none';
    document.getElementById('upload-section-main').style.display = 'none';
    
    const analysisArea = document.getElementById('analysis-area');
    const analysisTitle = document.getElementById('analysis-title');
    const analysisContent = document.getElementById('analysis-content');
    
    analysisTitle.textContent = getAnalysisTitle(analysisType);
    analysisContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 分析モジュールを読み込み中...</div>`;
    analysisArea.style.display = 'block';

    try {
        const modulePath = `./analyses/${analysisType}.js`;
        const analysisModule = await import(modulePath);
        analysisModule.render(analysisContent, dataCharacteristics);
    } catch (error) {
        console.error(`Failed to load analysis module for ${analysisType}:`, error);
        analysisContent.innerHTML = `<p class="error-message">分析機能の読み込みに失敗しました。(${analysisType}.js)<br>この機能はまだ実装されていない可能性があります。</p>`;
    }
}

// Make backToHome globally accessible
window.backToHome = () => {
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('navigation-section').style.display = 'block';
    document.getElementById('upload-section-main').style.display = 'block';
};

// Also expose currentData for modules
window.currentData = currentData;