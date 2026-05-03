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

const GEMINI_API_KEY_STORAGE = 'easyStat.geminiApiKey';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

let currentAnalysisType = null;
let currentAnalysisTitle = '';
let aiState = {
    apiKey: localStorage.getItem(GEMINI_API_KEY_STORAGE) || '',
    lastOutput: '',
    isGenerating: false,
    chatHistory: []
};

const aiConfigSection = document.getElementById('ai-config-section');
const aiConfigToggle = document.getElementById('ai-config-toggle');
const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
const saveGeminiKeyBtn = document.getElementById('save-gemini-key-btn');
const clearGeminiKeyBtn = document.getElementById('clear-gemini-key-btn');
const aiStatusBadge = document.getElementById('ai-status-badge');
const aiAssistWidget = document.getElementById('ai-assist-widget');
const aiAssistToggle = document.getElementById('ai-assist-toggle');
const aiAssistClose = document.getElementById('ai-assist-close');
const aiAssistStatus = document.getElementById('ai-assist-status');
const aiAssistOutput = document.getElementById('ai-assist-output');
const aiChatInput = document.getElementById('ai-chat-input');
const aiChatSendBtn = document.getElementById('ai-chat-send-btn');
const aiGenerateBtn = document.getElementById('ai-generate-interpretation-btn');
const aiCopyBtn = document.getElementById('ai-copy-interpretation-btn');

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
    setupAISupport();
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
    demoBtn.addEventListener('click', () => {
        document.getElementById('demo-modal').style.display = 'block';
    });

    // Close Modal logic
    const demoModal = document.getElementById('demo-modal');
    const closeDemoModal = document.getElementById('close-demo-modal');

    closeDemoModal.addEventListener('click', () => {
        demoModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === demoModal) {
            demoModal.style.display = 'none';
        }
    });

    // Handle Demo Option Clicks
    document.querySelectorAll('.demo-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fileName = btn.dataset.demo;
            demoModal.style.display = 'none';
            loadDemoData(fileName);
        });
    });

    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => toggleCollapsible(header));
    });

    // 分析カードクリック時のデータ未ロードチェック
    featureGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.feature-card');
        if (!card) return;

        // data-requires="none" のカードはデータ未ロードでも遷移可能
        const requires = card.dataset.requires;
        if (requires === 'none') {
            // enableCard の onclick と二重発火しないよう、onclick が未設定の場合のみ実行
            if (!card.onclick) {
                showAnalysisView(card.dataset.analysis);
            }
            return;
        }

        // データがロードされていない場合はエラー表示
        if (!currentData) {
            showError('分析を開始するには、データをアップロードするかデモデータを試してください。');
            return;
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

            // Use the now-numeric values to check for uniqueness
            const numericValues = data.map(row => row[col]).filter(val => val != null);
            const uniqueValues = new Set(numericValues);

            // If a numeric column has a small number of unique values (e.g., <= 10),
            // it's likely a categorical variable coded with numbers. Treat it as categorical as well.
            if (uniqueValues.size <= 10) {
                characteristics.categoricalColumns.push(col);
            }
        } else {
            const uniqueValues = new Set(values);
            // Heuristic for string columns: if it has few unique values, or a low unique ratio, it's categorical.
            if (uniqueValues.size <= 10 || (uniqueValues.size / values.length < 0.5 && values.length > 5)) {
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

        // data-requires="none" is special: works even without data (handled above in the click listener for no-data case, but here we just enable it)
        if (req === 'none') {
            enableCard(card);
            return;
        }

        // If there are no specific requirements (but it needs data, which is guaranteed here because dataCharacteristics exists)
        if (!req) {
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
    if (currentAnalysisType !== analysisType) {
        resetAIConversation();
    }
    currentAnalysisType = analysisType;
    currentAnalysisTitle = getAnalysisTitle(analysisType);
    document.getElementById('navigation-section').style.display = 'none';
    document.getElementById('upload-section-main').style.display = 'none';

    const analysisHeader = document.getElementById('analysis-header');
    const analysisArea = document.getElementById('analysis-area');
    const analysisContent = document.getElementById('analysis-content');


    analysisContent.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 分析モジュールを読み込み中...</div>`;

    analysisHeader.style.display = 'flex';
    analysisArea.style.display = 'block';

    try {
        const cacheBuster = Date.now();
        const modulePath = `./analyses/${analysisType}.js?v=${cacheBuster}`;
        const analysisModule = await import(modulePath);
        analysisModule.render(analysisContent, currentData, dataCharacteristics);
        updateAIAssistVisibility();
    } catch (error) {
        console.error(error);
        analysisContent.innerHTML = `<p class="error-message">分析機能の読み込みに失敗しました。(${analysisType}.js)<br>エラー詳細: ${error.message}<br><pre>${error.stack}</pre></p>`;
        updateAIAssistVisibility();
    }
}

window.backToHome = () => {
    currentAnalysisType = null;
    currentAnalysisTitle = '';
    resetAIConversation();
    document.getElementById('analysis-header').style.display = 'none';
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('navigation-section').style.display = 'block';
    document.getElementById('upload-section-main').style.display = 'block';
    updateAIAssistVisibility();
};

// ==========================================
// Gemini AI Interpretation Support
// ==========================================
function setupAISupport() {
    if (!aiConfigSection || !aiAssistWidget) return;

    aiConfigToggle?.addEventListener('click', () => {
        const expanded = aiConfigToggle.getAttribute('aria-expanded') === 'true';
        aiConfigSection.classList.toggle('collapsed', expanded);
        aiConfigToggle.setAttribute('aria-expanded', String(!expanded));
    });

    if (aiState.apiKey && geminiApiKeyInput) {
        geminiApiKeyInput.placeholder = '保存済みのAPIキーがあります（変更する場合は再入力）';
    }
    updateAIConfigStatus();
    updateAIAssistVisibility();

    saveGeminiKeyBtn?.addEventListener('click', () => {
        const key = geminiApiKeyInput.value.trim();
        if (!key) {
            showError('Gemini APIキーを入力してください。');
            return;
        }
        aiState.apiKey = key;
        localStorage.setItem(GEMINI_API_KEY_STORAGE, key);
        geminiApiKeyInput.value = '';
        geminiApiKeyInput.placeholder = '保存済みのAPIキーがあります（変更する場合は再入力）';
        setAIOutput('生成AI支援を有効化しました。分析結果ページで解釈補助と追加質問を利用できます。', 'system');
        updateAIConfigStatus();
        updateAIAssistVisibility();
    });

    clearGeminiKeyBtn?.addEventListener('click', () => {
        aiState.apiKey = '';
        aiState.lastOutput = '';
        aiState.chatHistory = [];
        localStorage.removeItem(GEMINI_API_KEY_STORAGE);
        if (geminiApiKeyInput) {
            geminiApiKeyInput.value = '';
            geminiApiKeyInput.placeholder = 'Gemini APIキーを入力';
        }
        setAIOutput('Gemini APIキーを削除しました。生成AI支援は無効です。', 'system');
        updateAIConfigStatus();
        updateAIAssistVisibility();
    });

    aiAssistToggle?.addEventListener('click', () => {
        aiAssistWidget.classList.remove('collapsed');
        aiAssistToggle.setAttribute('aria-expanded', 'true');
    });

    aiAssistClose?.addEventListener('click', () => {
        aiAssistWidget.classList.add('collapsed');
        aiAssistToggle.setAttribute('aria-expanded', 'false');
    });

    aiGenerateBtn?.addEventListener('click', generateAIInterpretation);
    aiChatSendBtn?.addEventListener('click', sendAIChatMessage);
    aiChatInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendAIChatMessage();
        }
    });

    aiCopyBtn?.addEventListener('click', async () => {
        if (!aiState.lastOutput) return;
        try {
            await navigator.clipboard.writeText(aiState.lastOutput);
            aiAssistStatus.textContent = '解釈文をコピーしました。';
        } catch (error) {
            console.error(error);
            aiAssistStatus.textContent = 'コピーに失敗しました。ブラウザの権限を確認してください。';
        }
    });

    const analysisContent = document.getElementById('analysis-content');
    if (analysisContent) {
        const observer = new MutationObserver(() => updateAIAssistStatus());
        observer.observe(analysisContent, { childList: true, subtree: true, characterData: true });
    }
}

function updateAIConfigStatus() {
    if (!aiStatusBadge) return;
    const active = Boolean(aiState.apiKey);
    aiStatusBadge.textContent = active ? '有効' : '無効';
    aiStatusBadge.classList.toggle('active', active);
    aiStatusBadge.classList.toggle('inactive', !active);
}

function updateAIAssistVisibility() {
    if (!aiAssistWidget) return;
    const analysisVisible = document.getElementById('analysis-area')?.style.display !== 'none';
    const shouldShow = Boolean(aiState.apiKey && analysisVisible && currentAnalysisType);
    aiAssistWidget.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) updateAIAssistStatus();
}

function updateAIAssistStatus() {
    if (!aiAssistStatus || !aiGenerateBtn) return;
    const hasResults = hasAnalysisResults();
    aiAssistStatus.textContent = hasResults
        ? `${currentAnalysisTitle || '分析結果'}をもとに、解釈の生成や追加質問ができます。`
        : '分析を実行すると、結果の読み取りや追加質問ができます。';
    aiGenerateBtn.disabled = aiState.isGenerating || !aiState.apiKey;
    if (aiChatSendBtn) aiChatSendBtn.disabled = aiState.isGenerating || !aiState.apiKey;
    if (aiChatInput) aiChatInput.disabled = aiState.isGenerating || !aiState.apiKey;
}

function hasAnalysisResults() {
    const content = document.getElementById('analysis-content');
    if (!content) return false;
    const resultSelectors = [
        '#results-section',
        '#test-results-section',
        '#interpretation-section',
        '#visualization-section',
        '[id*="result"]',
        '[id*="output"]'
    ];
    return resultSelectors.some(selector => {
        const element = content.querySelector(selector);
        return element && getVisibleText(element).length > 80;
    });
}

async function generateAIInterpretation() {
    if (!aiState.apiKey) {
        showError('Gemini APIキーを保存してから利用してください。');
        return;
    }
    if (aiState.isGenerating) return;

    aiState.isGenerating = true;
    updateAIAssistStatus();
    aiGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
    aiCopyBtn.disabled = true;
    aiAssistOutput.className = 'ai-assist-output loading';
    setAIOutput('データプレビュー、要約統計量、分析手法、分析結果を整理してGeminiに送信しています...', 'system');

    try {
        const context = buildAIInterpretationContext();
        const prompt = buildAIInterpretationPrompt(context);
        const text = await requestGemini(prompt, 1400);

        aiState.lastOutput = text;
        aiState.chatHistory = [{ role: 'assistant', text }];
        aiAssistOutput.className = 'ai-assist-output';
        setAIOutput(text, 'assistant');
        aiCopyBtn.disabled = false;
        aiAssistStatus.textContent = '解釈の補助を生成しました。続けて質問できます。';
    } catch (error) {
        console.error(error);
        aiAssistOutput.className = 'ai-assist-output error';
        setAIOutput(`生成に失敗しました。\n${error.message}\n\nAPIキー、ネットワーク接続、Gemini APIの利用設定を確認してください。`, 'error');
        aiAssistStatus.textContent = '生成に失敗しました。';
    } finally {
        aiState.isGenerating = false;
        aiGenerateBtn.innerHTML = '<i class="fas fa-sparkles"></i> 解釈を生成';
        updateAIAssistStatus();
    }
}

async function sendAIChatMessage() {
    if (!aiState.apiKey) {
        showError('Gemini APIキーを保存してから利用してください。');
        return;
    }
    const question = aiChatInput?.value.trim();
    if (!question || aiState.isGenerating) return;

    aiState.isGenerating = true;
    aiAssistOutput.className = 'ai-assist-output';
    updateAIAssistStatus();
    aiChatInput.value = '';
    appendAIMessage(question, 'user');
    appendAIMessage('分析結果とこれまでの会話を確認しています...', 'system');

    try {
        const context = buildAIInterpretationContext();
        const prompt = buildAIChatPrompt(context, question);
        const answer = await requestGemini(prompt, 1200);
        removeLastSystemAIMessage();
        aiState.lastOutput = answer;
        aiState.chatHistory.push({ role: 'user', text: question }, { role: 'assistant', text: answer });
        aiState.chatHistory = aiState.chatHistory.slice(-10);
        appendAIMessage(answer, 'assistant');
        aiCopyBtn.disabled = false;
        aiAssistStatus.textContent = '回答しました。続けて質問できます。';
    } catch (error) {
        console.error(error);
        removeLastSystemAIMessage();
        appendAIMessage(`回答に失敗しました。\n${error.message}`, 'error');
        aiAssistStatus.textContent = '回答に失敗しました。';
    } finally {
        aiState.isGenerating = false;
        updateAIAssistStatus();
    }
}

async function requestGemini(prompt, maxOutputTokens) {
    const response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': aiState.apiKey
        },
        body: JSON.stringify({
            system_instruction: {
                parts: [{
                    text: 'あなたは統計教育のチューターです。提供された分析結果だけを根拠に、日本語で初学者にもわかるように説明してください。因果関係は研究デザインから明らかな場合以外は断定しないでください。p値だけでなく、効果量、方向、データ上の注意点も扱ってください。'
                }]
            },
            contents: [{
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                maxOutputTokens
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const result = await response.json();
    const text = extractGeminiText(result);
    if (!text) throw new Error('Gemini APIから回答を取得できませんでした。');
    return text;
}

function buildAIInterpretationContext() {
    return {
        analysis: {
            type: currentAnalysisType || 'unknown',
            title: currentAnalysisTitle || getAnalysisTitle(currentAnalysisType)
        },
        dataPreview: (currentData || []).slice(0, 10),
        dataStructure: {
            rows: currentData?.length || 0,
            columns: Object.keys(currentData?.[0] || {}),
            numericColumns: dataCharacteristics?.numericColumns || [],
            categoricalColumns: dataCharacteristics?.categoricalColumns || [],
            textColumns: dataCharacteristics?.textColumns || []
        },
        summaryStatistics: createAISummaryStatistics(currentData || [], dataCharacteristics),
        analysisResultTables: extractAnalysisResultTables(),
        analysisResults: extractAnalysisResultText()
    };
}

function buildAIInterpretationPrompt(context) {
    return `
以下はeasyStatの分析結果ページから収集した情報です。ユーザーが結果を理解するための解釈補助を作成してください。

出力形式（見出しはこの5つだけ）:
1. 結果から言えること
2. 注目すべき数値
3. 解釈で注意すること
4. レポート例
5. 次に確認すること

制約:
- 1文目から、分析結果表にある具体的な変数名・統計量・p値・効果量・相関係数などに基づいて説明する
- 「この分析は何を調べるものです」のような分析手法の一般説明で始めない
- 表から読み取れる最も重要な結果を優先し、数値を必ず含める
- 「相関係数の解釈」などの凡例・目安は、今回の結果そのものではないので主な根拠にしない
- 与えられた情報にない数値や結論を作らない
- 分析結果表や抽出テキストに具体的な統計量がない場合は、一般論で埋めず「結果表を十分に読み取れませんでした」と明記する
- 有意でない結果を「差がある」と言わない
- 相関や回帰だけで因果関係を断定しない
- 初学者にわかる自然な日本語で、実務的に役立つ短めの箇条書きにする
- Markdownの大見出し（##など）は使わない

悪い出力例:
「この分析は、いくつかの数値データの間にどのような関係があるかを調べたものです。」

良い出力例:
「数学と英語の相関は r = 0.989, p < .01 で、強い正の相関が見られます。」

分析手法:
${JSON.stringify(context.analysis, null, 2)}

データ構造:
${JSON.stringify(context.dataStructure, null, 2)}

データプレビュー（先頭10件）:
${JSON.stringify(context.dataPreview, null, 2)}

要約統計量:
${JSON.stringify(context.summaryStatistics, null, 2)}

分析結果表（表構造を保持）:
${JSON.stringify(context.analysisResultTables, null, 2)}

分析結果ページから抽出したテキスト:
${context.analysisResults || 'まだ分析結果のテキストを十分に取得できませんでした。'}
`.trim();
}

function buildAIChatPrompt(context, question) {
    const history = aiState.chatHistory
        .slice(-8)
        .map(item => `${item.role === 'user' ? 'ユーザー' : 'AI'}: ${item.text}`)
        .join('\n\n');

    return `
以下はeasyStatの分析結果ページから収集した情報と、これまでの会話です。
ユーザーの追加質問に、分析結果に基づいて具体的に答えてください。

回答ルール:
- まず質問に直接答える
- 具体的な変数名・統計量・p値・効果量・相関係数など、結果表から読める数値を優先して使う
- 分析結果にない情報は推測せず、「この画面の結果だけでは判断できません」と言う
- 相関や回帰だけで因果関係を断定しない
- 長くなりすぎないように、必要なら箇条書きで答える
- Markdownの大見出し（##など）は使わない

分析手法:
${JSON.stringify(context.analysis, null, 2)}

データ構造:
${JSON.stringify(context.dataStructure, null, 2)}

データプレビュー（先頭10件）:
${JSON.stringify(context.dataPreview, null, 2)}

要約統計量:
${JSON.stringify(context.summaryStatistics, null, 2)}

分析結果表（表構造を保持）:
${JSON.stringify(context.analysisResultTables, null, 2)}

分析結果ページから抽出したテキスト:
${context.analysisResults || 'まだ分析結果のテキストを十分に取得できませんでした。'}

これまでの会話:
${history || 'まだ会話はありません。'}

ユーザーの追加質問:
${question}
`.trim();
}

function createAISummaryStatistics(data, characteristics) {
    if (!Array.isArray(data) || data.length === 0 || !characteristics) {
        return { note: 'データが読み込まれていません。' };
    }

    const numeric = (characteristics.numericColumns || []).map(col => {
        const values = data.map(row => Number(row[col])).filter(Number.isFinite);
        return {
            variable: col,
            n: values.length,
            missing: data.length - values.length,
            mean: roundStat(mean(values)),
            sd: roundStat(sampleSd(values)),
            min: roundStat(Math.min(...values)),
            median: roundStat(median(values)),
            max: roundStat(Math.max(...values))
        };
    });

    const categorical = (characteristics.categoricalColumns || []).map(col => {
        const values = data.map(row => row[col]).filter(v => v != null && String(v).trim() !== '');
        return {
            variable: col,
            n: values.length,
            missing: data.length - values.length,
            unique: new Set(values.map(String)).size,
            topLevels: topCounts(values, 6)
        };
    });

    const text = (characteristics.textColumns || []).map(col => {
        const values = data.map(row => row[col]).filter(v => v != null && String(v).trim() !== '').map(String);
        return {
            variable: col,
            n: values.length,
            missing: data.length - values.length,
            averageLength: roundStat(mean(values.map(v => v.length))),
            samples: values.slice(0, 3)
        };
    });

    return { numeric, categorical, text };
}

function extractAnalysisResultText() {
    const content = document.getElementById('analysis-content');
    if (!content) return '';

    const clone = content.cloneNode(true);
    clone.querySelectorAll('script, style, button, input, select, textarea, canvas, svg, img, .plot-container, .js-plotly-plot, [id*="data_overview"], [id*="data-overview"], [id*="dataframe"]').forEach(el => el.remove());
    const resultContainers = clone.querySelectorAll('#results-section, #summary-stats-section, #test-results-section, #interpretation-section, [id*="result"], [id*="interpretation"]');
    const text = resultContainers.length > 0
        ? Array.from(resultContainers).map(getReadableText).join('\n\n')
        : getReadableText(clone);
    return truncateText(text, 12000);
}

function extractAnalysisResultTables() {
    const content = document.getElementById('analysis-content');
    if (!content) return [];

    const resultRoot = content.querySelector('#analysis-results, #results-section') || content;
    return Array.from(resultRoot.querySelectorAll('table'))
        .slice(0, 8)
        .map((table, index) => {
            const caption = getNearestHeading(table) || `結果表${index + 1}`;
            const headers = Array.from(table.querySelectorAll('thead th'))
                .map(cell => getReadableText(cell))
                .filter(Boolean);
            const rows = Array.from(table.querySelectorAll('tbody tr'))
                .slice(0, 40)
                .map(row => Array.from(row.children).map(cell => getReadableText(cell)));
            return { caption, headers, rows };
        })
        .filter(table => table.rows.length > 0);
}

function getNearestHeading(element) {
    let current = element;
    for (let depth = 0; current && depth < 4; depth++) {
        let sibling = current.previousElementSibling;
        while (sibling) {
            if (/^H[1-6]$/.test(sibling.tagName)) return getReadableText(sibling);
            const nestedHeading = sibling.querySelector?.('h1, h2, h3, h4, h5, h6');
            if (nestedHeading) return getReadableText(nestedHeading);
            sibling = sibling.previousElementSibling;
        }
        current = current.parentElement;
    }
    return '';
}

function extractGeminiText(result) {
    return (result?.candidates || [])
        .flatMap(candidate => candidate?.content?.parts || [])
        .map(part => part.text || '')
        .filter(Boolean)
        .join('\n')
        .trim();
}

function getAnalysisTitle(analysisType) {
    if (!analysisType) return '';
    const card = document.querySelector(`.feature-card[data-analysis="${analysisType}"]`);
    const title = card?.querySelector('.feature-card-title')?.textContent || analysisType;
    return normalizeText(title);
}

function getVisibleText(element) {
    return normalizeText(element?.textContent || '');
}

function getReadableText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return normalizeText(clone.textContent || '');
}

function setAIOutput(text, role = 'assistant') {
    if (!aiAssistOutput) return;
    aiAssistOutput.innerHTML = '';
    appendAIMessage(text, role);
}

function appendAIMessage(text, role = 'assistant') {
    if (!aiAssistOutput) return;
    const message = document.createElement('div');
    message.className = `ai-chat-message ${role}`;
    message.textContent = text;
    aiAssistOutput.appendChild(message);
    aiAssistOutput.scrollTop = aiAssistOutput.scrollHeight;
}

function removeLastSystemAIMessage() {
    if (!aiAssistOutput) return;
    const messages = Array.from(aiAssistOutput.querySelectorAll('.ai-chat-message.system'));
    messages.at(-1)?.remove();
}

function resetAIConversation() {
    aiState.chatHistory = [];
    aiState.lastOutput = '';
    setAIOutput('「解釈を生成」を押すと、Geminiが結果の読み方、注意点、レポート例を日本語で整理します。その後、この欄で追加質問もできます。');
    if (aiCopyBtn) aiCopyBtn.disabled = true;
    if (aiChatInput) aiChatInput.value = '';
}

function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncateText(text, maxLength) {
    const normalized = normalizeText(text);
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength)}\n...（長いため省略）`;
}

function mean(values) {
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values) {
    if (values.length < 2) return NaN;
    const avg = mean(values);
    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function median(values) {
    if (!values.length) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function roundStat(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function topCounts(values, limit) {
    const counts = new Map();
    values.forEach(value => {
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
        .slice(0, limit)
        .map(([value, count]) => ({ value, count }));
}
