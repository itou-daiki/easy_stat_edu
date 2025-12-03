// グローバル変数
let currentData = null;
let currentAnalysis = null;
let pyScriptReady = false;

// PyScriptの初期化完了を検知（複数のイベントをリッスン）
function markPyScriptReady() {
    if (!pyScriptReady) {
        console.log('✓ PyScript initialized successfully');
        pyScriptReady = true;

        // Python関数がwindowスコープにエクスポートされているか確認
        // PyScript 2024.1.1では、関数は直接window.function_nameとして利用可能
        try {
            if (typeof window.load_file_data === 'function') {
                console.log('✓ Python functions are available in window scope');
            } else {
                console.warn('⚠ PyScript ready but load_file_data function not found yet');
                console.warn('   window.load_file_data type:', typeof window.load_file_data);
            }
        } catch (e) {
            console.warn('⚠ PyScript ready but check failed:', e);
        }
    }
}

// 複数のイベントをリッスン（PyScriptバージョンによって異なる）
document.addEventListener('py-ready', () => {
    console.log('Event: py-ready fired');
    markPyScriptReady();
});
document.addEventListener('py:ready', () => {
    console.log('Event: py:ready fired');
    markPyScriptReady();
});
document.addEventListener('pyscript:ready', () => {
    console.log('Event: pyscript:ready fired');
    markPyScriptReady();
});

// Python側からの明示的な準備完了通知を待機（最も確実）
document.addEventListener('pyscript-ready', () => {
    console.log('Event: pyscript-ready fired (from Python)');
    markPyScriptReady();
});

// DOMContentLoadedでもチェック（PyScript 2024.x系の場合）
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - checking for PyScript');
    setTimeout(checkPyScriptInitialization, 100);
});

// Pyodideランタイムが利用可能になったことを検知
if (typeof pyodide !== 'undefined' || window.pyodide) {
    console.log('Pyodide runtime detected on page load');
}

// PyScript関数を安全に取得するヘルパー関数
// PyScript 2024.1.1では、Python関数は直接window.function_nameとしてエクスポートされる
function getPyScriptFunction(functionName) {
    const func = window[functionName];

    if (typeof func === 'undefined') {
        console.error(`❌ Function '${functionName}' not found in window scope`);
        console.error('Debug: Available Python functions:',
            Object.keys(window).filter(key =>
                typeof window[key] === 'function' &&
                (key.startsWith('load_') || key.startsWith('run_') || key.startsWith('get_') || key.startsWith('remove_') || key.startsWith('fill_'))
            )
        );
        throw new Error(`関数 ${functionName} が見つかりません。PyScriptの初期化を確認してください。`);
    }

    if (typeof func !== 'function') {
        console.error(`❌ '${functionName}' is not a function, it is: ${typeof func}`);
        throw new Error(`${functionName} は関数ではありません。`);
    }

    console.log(`✓ Retrieved function: ${functionName}`);
    return func;
}

// PyScriptの初期化を積極的にチェック（ポーリング）
function checkPyScriptInitialization() {
    if (!pyScriptReady) {
        try {
            // まず、Python側からのフラグをチェック（最も確実）
            if (window.pyScriptFullyReady === true) {
                console.log('✓ PyScript detected via window.pyScriptFullyReady flag');
                markPyScriptReady();
                return true;
            }

            // Python関数が直接windowにエクスポートされているかチェック
            // PyScript 2024.1.1では、Python関数はwindow.function_nameとして利用可能
            if (typeof window.load_file_data === 'function') {
                console.log('✓ PyScript detected via exported functions');
                markPyScriptReady();
                return true;
            }
        } catch (e) {
            // まだ準備できていない
            console.debug('PyScript not ready yet:', e.message);
        }
    }
    return pyScriptReady;
}

// ローディング画面を非表示にしてメインアプリを表示
window.addEventListener('load', function() {
    console.log('Page loaded, waiting for PyScript...');

    // PyScriptの読み込み完了を待つ（最大60秒、より頻繁にチェック）
    let checkCount = 0;
    const maxChecks = 600; // 60秒 (100ms * 600)

    const checkInterval = setInterval(function() {
        checkCount++;

        // アクティブにPyScriptの準備をチェック
        checkPyScriptInitialization();

        // 進捗をログ出力（5秒ごと）
        if (checkCount % 50 === 0) {
            console.log(`Waiting for PyScript... ${checkCount / 10}s elapsed`);
        }

        // PyScriptが初期化されているか、またはタイムアウト
        if (pyScriptReady || checkCount > maxChecks) {
            clearInterval(checkInterval);
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';

            if (!pyScriptReady) {
                console.error('❌ PyScript initialization timeout after 60 seconds');
                console.error('Please check browser console for PyScript errors');
                console.error('Debug: window.pyodide =', window.pyodide);
                console.error('Debug: window.pyScriptFullyReady =', window.pyScriptFullyReady);
                console.error('Debug: pyScriptReady flag =', pyScriptReady);

                // 診断情報を収集
                let diagnostics = [];
                diagnostics.push(`PyScript ready: ${pyScriptReady ? 'Yes' : 'No'}`);
                diagnostics.push(`window.pyScriptFullyReady: ${window.pyScriptFullyReady ? 'Yes' : 'No'}`);
                diagnostics.push(`window.load_file_data: ${typeof window.load_file_data === 'function' ? 'Function' : 'Undefined (type: ' + typeof window.load_file_data + ')'}`);

                // エクスポートされたPython関数をリストアップ
                const exportedFunctions = Object.keys(window).filter(key =>
                    typeof window[key] === 'function' &&
                    (key.startsWith('load_') || key.startsWith('run_') || key.startsWith('get_') || key.startsWith('remove_') || key.startsWith('fill_'))
                );
                diagnostics.push(`Exported Python functions: ${exportedFunctions.length > 0 ? exportedFunctions.join(', ') : 'None'}`);

                // アップロードエリアにエラーメッセージを表示
                showInitializationError(diagnostics);
            } else {
                console.log(`✓ App ready (initialized in ${checkCount / 10}s)`);

                // メインアップロードの初期化（PyScript準備完了時のみ）
                setupMainUpload();
            }
        }
    }, 100);
});

// 初期化エラーを表示
function showInitializationError(diagnostics = []) {
    const uploadArea = document.getElementById('main-upload-area');
    const uploadSection = document.getElementById('upload-section-main');

    const diagnosticsHtml = diagnostics.length > 0 ? `
        <details style="text-align: left; max-width: 500px; margin: 1rem auto; background: #f8f9fa; padding: 1rem; border-radius: 4px;">
            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">診断情報（クリックで表示）</summary>
            <ul style="margin: 0.5rem 0 0 1.5rem; font-family: monospace; font-size: 0.875rem;">
                ${diagnostics.map(d => `<li>${d}</li>`).join('')}
            </ul>
        </details>
    ` : '';

    if (uploadArea && uploadSection) {
        uploadArea.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--danger-color); margin-bottom: 1rem;">統計エンジンの初期化に失敗しました</h3>
                <p style="margin-bottom: 1.5rem; line-height: 1.6;">
                    PyScriptライブラリの読み込みに問題が発生しました。<br>
                    以下の対処方法をお試しください：
                </p>
                ${diagnosticsHtml}
                <ol style="text-align: left; max-width: 500px; margin: 0 auto 1.5rem; line-height: 1.8;">
                    <li>ブラウザのキャッシュをクリア（Ctrl+Shift+Del）</li>
                    <li>ページを完全に再読み込み（Ctrl+F5 または Cmd+Shift+R）</li>
                    <li>別のブラウザで試す（Chrome、Edge、Firefoxを推奨）</li>
                    <li>ブラウザの拡張機能（広告ブロッカー等）を一時的に無効化</li>
                    <li>インターネット接続を確認</li>
                </ol>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">
                    <i class="fas fa-sync-alt"></i> ページを再読み込み
                </button>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 1.5rem;">
                    問題が解決しない場合は、ブラウザのコンソール（F12キー）でエラー内容を確認してください。
                </p>
            </div>
        `;
    }

    // 分析カードもすべて無効化
    disableAllFeatureCards();
}

// メインアップロード機能の初期化
function setupMainUpload() {
    // 初期状態ですべての分析カードを無効化
    disableAllFeatureCards();

    // アップロードのイベントリスナーを設定
    setupMainUploadListeners();

    // アップロードエリアを有効化
    enableUploadArea();

    console.log('Main upload setup completed');
}

// アップロードエリアを有効化
function enableUploadArea() {
    const uploadArea = document.getElementById('main-upload-area');
    const uploadBtn = document.getElementById('main-upload-btn');
    const fileInput = document.getElementById('main-data-file');
    const uploadText = uploadArea?.querySelector('.upload-text');
    const uploadHint = uploadArea?.querySelector('.upload-hint');

    if (uploadArea) {
        uploadArea.style.opacity = '1';
        uploadArea.style.pointerEvents = 'auto';
        uploadArea.style.cursor = 'pointer';
    }
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-file-upload"></i> ファイルを選択';
    }
    if (fileInput) {
        fileInput.disabled = false;
    }
    if (uploadText) {
        uploadText.textContent = 'ファイルをドラッグ&ドロップ または クリックして選択';
    }
    if (uploadHint) {
        uploadHint.textContent = '対応形式: Excel (.xlsx, .xls), CSV';
    }

    console.log('✓ Upload area enabled');
}

// アップロードのイベントリスナーを設定
function setupMainUploadListeners() {
    const fileInput = document.getElementById('main-data-file');
    const uploadArea = document.getElementById('main-upload-area');
    const uploadBtn = document.getElementById('main-upload-btn');
    const loadDemoBtn = document.getElementById('load-demo-btn');

    if (!fileInput || !uploadArea || !uploadBtn || !loadDemoBtn) {
        console.error('Upload elements not found');
        return;
    }

    // ファイル選択イベント
    fileInput.addEventListener('change', handleMainFileUpload);

    // ボタンクリックイベント
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // デモデータ読み込みボタンクリックイベント
    loadDemoBtn.addEventListener('click', useDemoData);

    // ドラッグ&ドロップ
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleMainFileUpload({ target: fileInput });
        }
    });

    // アップロードエリアクリックでファイル選択
    uploadArea.addEventListener('click', (e) => {
        // ボタンをクリックした場合は無視（ボタンが処理する）
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        fileInput.click();
    });

    console.log('Upload listeners set up successfully');
}

// デモデータを使用
async function useDemoData() {
    const fileInfo = document.getElementById('main-file-info');
    fileInfo.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>デモデータを読み込んでいます...</p>
            <p class="file-name">eda_demo.xlsx</p>
        </div>
    `;
    fileInfo.style.display = 'block';

    try {
        const loadDemoDataFunc = getPyScriptFunction('load_demo_data');
        const success = await loadDemoDataFunc('eda_demo.xlsx');

        if (success) {
            currentData = true;
            fileInfo.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <p><strong>デモデータの読み込み成功！</strong></p>
                    <p class="file-name">eda_demo.xlsx</p>
                </div>
            `;

            // データ特性を取得して分析機能を有効化
            await updateAnalysisAvailability();

            // データ概要を表示
            await displayDataOverview();
        } else {
            throw new Error('デモデータの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Demo data loading error:', error);
        fileInfo.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p><strong>エラーが発生しました</strong></p>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn-retry">
                    <i class="fas fa-redo"></i> 再試行
                </button>
            </div>
        `;
    }
}


// メインファイルアップロード処理
async function handleMainFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileInfo = document.getElementById('main-file-info');
    fileInfo.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>ファイルを読み込んでいます...</p>
            <p class="file-name">${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>
        </div>
    `;
    fileInfo.style.display = 'block';

    try {
        // PyScriptが初期化されるまで待機（最大3分）
        if (!pyScriptReady) {
            console.log('PyScript not ready, waiting for initialization...');

            fileInfo.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p style="font-size: 1.1rem; font-weight: 500;">統計エンジンを初期化しています...</p>
                    <p class="file-name">${file.name}</p>
                    <p id="init-message" style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem; line-height: 1.6;">
                        初回起動時は必要なライブラリ（NumPy, Pandas, Matplotlib等）を<br>
                        ダウンロードするため1〜2分程度お待ちください。<br>
                        <strong>2回目以降は高速に起動します。</strong>
                    </p>
                    <div class="loading-spinner" style="margin-top: 1rem;"></div>
                </div>
            `;

            let waited = 0;
            const maxWait = 180000; // 3分
            const checkInterval = 500; // 500msごとにチェック

            while (waited < maxWait) {
                // アクティブにPyScriptの準備をチェック
                checkPyScriptInitialization();

                if (pyScriptReady) {
                    console.log('✓ PyScript ready, proceeding with file upload');
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waited += checkInterval;

                // 進捗を表示（1秒ごと）
                if (waited % 1000 === 0) {
                    const seconds = Math.floor(waited / 1000);
                    const progress = Math.min(Math.floor((waited / maxWait) * 100), 99);
                    const messageEl = fileInfo.querySelector('#init-message');
                    if (messageEl) {
                        messageEl.innerHTML = `
                            初回起動時は必要なライブラリ（NumPy, Pandas, Matplotlib等）を<br>
                            ダウンロードするため1〜2分程度お待ちください。<br>
                            <strong>2回目以降は高速に起動します。</strong><br>
                            <span style="color: var(--primary-color); font-weight: 600; margin-top: 0.5rem; display: inline-block;">
                                経過時間: ${seconds}秒 (推定進捗: ${progress}%) 
                            </span>
                        `;
                    }
                }
            }

            if (!pyScriptReady) {
                console.error('❌ PyScript initialization timeout');
                console.error('Debug info:');
                console.error('- pyscript object exists:', typeof pyscript !== 'undefined');
                console.error('- pyscript.interpreter exists:', typeof pyscript !== 'undefined' && pyscript.interpreter);

                throw new Error(`統計エンジンの初期化に時間がかかりすぎています。

考えられる原因：
- ネットワーク接続が不安定
- ブラウザのキャッシュが破損

対処方法：
1. ブラウザのキャッシュをクリア（Ctrl+Shift+Del）
2. ページを再読み込み（Ctrl+F5）
3. 別のブラウザで試す（Chrome推奨）`);
            }

            console.log('✓ PyScript ready after waiting, proceeding with file processing');

            fileInfo.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>ファイルを読み込んでいます...</p>
                    <p class="file-name">${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>
                </div>
            `;
        }

        const fileContent = await readFileContent(file);
        console.log('✓ File content read, loading into Python...');

        // 最終確認: Python関数が利用可能か再チェック（リトライあり）
        // PyScript 2024.1.1では、Python関数はwindow.function_nameとして直接エクスポートされる
        let retryCount = 0;
        const maxRetries = 10;
        const retryDelay = 300; // 300ms

        while (retryCount < maxRetries) {
            // Python側からのフラグとload_file_data関数の両方をチェック
            if (window.pyScriptFullyReady === true && typeof window.load_file_data === 'function') {
                console.log('✓ PyScript fully ready confirmed via flag and function check');
                break;
            }

            // load_file_data関数が直接利用可能かチェック
            if (typeof window.load_file_data === 'function') {
                console.log('✓ Python functions available in window scope');
                break;
            }

            console.log(`⚠ Python functions not ready, retry ${retryCount + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
        }

        // 最終確認
        if (typeof window.load_file_data !== 'function') {
            console.error('❌ Python functions still not available after retries');
            console.error('Debug: window.pyScriptFullyReady =', window.pyScriptFullyReady);
            console.error('Debug: pyScriptReady flag =', pyScriptReady);
            console.error('Debug: window.load_file_data type =', typeof window.load_file_data);

            // より詳細な診断情報
            let diagnostics = [];
            diagnostics.push(`- PyScript ready flag: ${pyScriptReady ? '✓' : '✗'}`);
            diagnostics.push(`- window.pyScriptFullyReady: ${window.pyScriptFullyReady ? '✓' : '✗'}`);
            diagnostics.push(`- window.load_file_data: ${typeof window.load_file_data === 'function' ? '✓' : '✗ (type: ' + typeof window.load_file_data + ')'}`);

            // エクスポートされたPython関数をリストアップ
            const exportedFunctions = Object.keys(window).filter(key =>
                typeof window[key] === 'function' &&
                (key.startsWith('load_') || key.startsWith('run_') || key.startsWith('get_') || key.startsWith('remove_') || key.startsWith('fill_'))
            );
            diagnostics.push(`- Exported Python functions: ${exportedFunctions.length > 0 ? exportedFunctions.join(', ') : 'None'}`);

            console.error('Diagnostics:\n' + diagnostics.join('\n'));

            throw new Error(`統計エンジンが正しく初期化されていません。

診断情報:
${diagnostics.join('\n')}

ページを完全に再読み込み（Ctrl+F5）してください。
それでも解決しない場合は、ブラウザのコンソール（F12）でエラー詳細を確認してください。`);
        }

        console.log('✓ Python functions confirmed available, proceeding with file load');
        const loadFileData = getPyScriptFunction('load_file_data');
        const success = await loadFileData(fileContent, file.name);

        if (success) {
            currentData = true;
            fileInfo.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <p><strong>読み込み成功！</strong></p>
                    <p class="file-name">${file.name}</p>
                </div>
            `;

            // データ特性を取得して分析機能を有効化
            await updateAnalysisAvailability();

            // データ概要を表示
            await displayDataOverview();
        } else {
            throw new Error('データの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('File upload error:', error);
        fileInfo.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p><strong>エラーが発生しました</strong></p>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn-retry">
                    <i class="fas fa-redo"></i> 再試行
                </button>
            </div>
        `;
    }
}

// データ特性に基づいて利用可能な分析機能を更新
async function updateAnalysisAvailability() {
    try {
        const getDataCharacteristics = getPyScriptFunction('get_data_characteristics');
        const characteristics = await getDataCharacteristics();

        console.log('Data characteristics:', characteristics);

        // 各機能カードの有効/無効を設定
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            const requires = card.getAttribute('data-requires');
            const analysisType = card.getAttribute('data-analysis');

            if (requires === 'none') {
                // 常に利用可能
                enableFeatureCard(card, analysisType);
            } else if (requires) {
                // 要件をチェック
                const isAvailable = checkRequirements(requires, characteristics);
                if (isAvailable) {
                    enableFeatureCard(card, analysisType);
                } else {
                    disableFeatureCard(card);
                }
            }
        });
    } catch (error) {
        console.error('Failed to update analysis availability:', error);
    }
}

// 要件をチェック
function checkRequirements(requiresStr, characteristics) {
    const requirements = requiresStr.split(',');

    for (const req of requirements) {
        const [type, countStr] = req.trim().split(':');
        const requiredCount = parseInt(countStr);

        if (type === 'numeric' && characteristics.numeric_columns < requiredCount) {
            return false;
        }
        if (type === 'categorical' && characteristics.categorical_columns < requiredCount) {
            return false;
        }
        if (type === 'text' && characteristics.text_columns < requiredCount) {
            return false;
        }
    }

    return true;
}

// 機能カードを有効化
function enableFeatureCard(card, analysisType) {
    card.classList.remove('disabled');
    card.onclick = () => loadAnalysis(analysisType);
    const requirement = card.querySelector('.feature-card-requirement');
    if (requirement) requirement.style.display = 'none';
}

// 機能カードを無効化
function disableFeatureCard(card) {
    card.classList.add('disabled');
    card.onclick = null;
    const requirement = card.querySelector('.feature-card-requirement');
    if (requirement) requirement.style.display = 'block';
}

// すべての機能カードを無効化
function disableAllFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        disableFeatureCard(card);
    });
}

// 分析機能を読み込む
function loadAnalysis(analysisType) {
    currentAnalysis = analysisType;

    // アップロードセクションとナビゲーションを非表示、分析エリアを表示
    document.getElementById('upload-section-main').style.display = 'none';
    document.querySelector('.navigation-section').style.display = 'none';
    document.getElementById('analysis-area').style.display = 'block';

    // 分析タイトルを設定
    const titles = {
        'cleansing': 'データクレンジング',
        'eda': '探索的データ分析（EDA）',
        'correlation': '相関分析',
        'chi_square': 'カイ二乗検定',
        'ttest': 't検定',
        'anova_one_way': '一要因分散分析',
        'anova_two_way': '二要因分散分析',
        'regression_simple': '単回帰分析',
        'regression_multiple': '重回帰分析',
        'factor_analysis': '因子分析',
        'pca': '主成分分析',
        'text_mining': 'テキストマイニング'
    };

    document.getElementById('analysis-title').textContent = titles[analysisType] || '分析';

    // 分析コンテンツを読み込み
    loadAnalysisContent(analysisType);
}

// ホームに戻る
function backToHome() {
    document.getElementById('upload-section-main').style.display = 'block';
    document.querySelector('.navigation-section').style.display = 'block';
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('analysis-content').innerHTML = '';
    currentAnalysis = null;
}

// 分析コンテンツを読み込む
function loadAnalysisContent(analysisType) {
    const contentArea = document.getElementById('analysis-content');

    // データが既にロードされている場合は直接分析コントロールを表示
    if (currentData) {
        contentArea.innerHTML = `
            <div id="analysis-controls"></div>
            <div id="analysis-results"></div>
        `;
        showAnalysisControls();
        return;
    }

    // データ未ロード時のメッセージ
    const initMessage = `
        <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
            <i class="fas fa-info-circle" style="color: #f59e0b; margin-right: 0.5rem;"></i>
            <strong>トップページからデータをアップロードしてください</strong>
        </div>
    `;

    // モダンなファイルアップロードUIを表示（非推奨）
    const uploadHTML = `
        <div class="upload-section">
            ${initMessage}
            <div class="upload-area" id="upload-area" ${!pyScriptReady ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
                <div class="upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <h3>データファイルをアップロード</h3>
                <p class="upload-text">ファイルをドラッグ&ドロップ または クリックして選択</p>
                <input type="file" id="data-file" accept=".xlsx,.xls,.csv" style="display: none;" ${!pyScriptReady ? 'disabled' : ''}>
                <button onclick="document.getElementById('data-file').click()" class="btn-upload" id="upload-btn" ${!pyScriptReady ? 'disabled' : ''}>
                    <i class="fas fa-file-upload"></i> ファイルを選択
                </button>
                <p class="upload-hint">対応形式: Excel (.xlsx, .xls), CSV</p>
            </div>
            <div id="file-info" class="file-info" style="display: none;"></div>
        </div>
        <div id="analysis-controls" style="display: none;"></div>
        <div id="analysis-results"></div>
    `;

    contentArea.innerHTML = uploadHTML;

    // PyScript初期化完了を待つ
    if (!pyScriptReady) {
        const checkReady = setInterval(() => {
            if (pyScriptReady) {
                clearInterval(checkReady);
                // アップロードエリアを有効化
                const uploadArea = document.getElementById('upload-area');
                const fileInput = document.getElementById('data-file');
                const uploadBtn = document.getElementById('upload-btn');

                if (uploadArea) {
                    uploadArea.style.opacity = '1';
                    uploadArea.style.pointerEvents = 'auto';
                }
                if (fileInput) fileInput.disabled = false;
                if (uploadBtn) uploadBtn.disabled = false;

                // 初期化メッセージを削除
                const initMsg = contentArea.querySelector('[style*="background: #fef3c7"]');
                if (initMsg) initMsg.remove();

                // イベントリスナーを再設定
                setupUploadListeners();
            }
        }, 100);
    } else {
        // すでに初期化済みの場合はすぐにイベントリスナーを設定
        setupUploadListeners();
    }
}

// アップロードイベントリスナーを設定
function setupUploadListeners() {

    // ファイルアップロードイベントを設定
    const fileInput = document.getElementById('data-file');
    const uploadArea = document.getElementById('upload-area');

    fileInput.addEventListener('change', handleFileUpload);

    // ドラッグ&ドロップイベント
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileUpload({ target: fileInput });
        }
    });

    // クリックでファイル選択
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            fileInput.click();
        }
    });
}

// ファイルアップロード処理
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // PyScript初期化チェック
    if (!pyScriptReady) {
        const fileInfo = document.getElementById('file-info');
        fileInfo.innerHTML = `
            <div class="error-message">
                <i class="fas fa-hourglass-half"></i>
                <p><strong>PyScriptがまだ初期化されていません</strong></p>
                <p>数秒お待ちいただき、「PyScriptを初期化中...」のメッセージが消えてから再度お試しください。</p>
            </div>
        `;
        fileInfo.style.display = 'block';
        return;
    }

    // ファイル情報を表示
    const fileInfo = document.getElementById('file-info');
    fileInfo.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>ファイルを読み込んでいます...</p>
            <p class="file-name">${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>
        </div>
    `;
    fileInfo.style.display = 'block';

    try {
        // ファイルを読み込み
        const fileContent = await readFileContent(file);

        // PyScriptのload_file_data関数を呼び出す
        const loadFileData = getPyScriptFunction('load_file_data');
        const success = await loadFileData(fileContent, file.name);

        if (success) {
            currentData = true;

            // 成功メッセージ
            fileInfo.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <p><strong>読み込み成功！</strong></p>
                    <p class="file-name">${file.name}</p>
                </div>
            `;

            // 分析コントロールを表示
            setTimeout(() => {
                showAnalysisControls();
            }, 500);
        } else {
            throw new Error('データの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('File upload error:', error);
        fileInfo.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p><strong>エラーが発生しました</strong></p>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn-retry">
                    <i class="fas fa-redo"></i> 再試行
                </button>
            </div>
        `;
    }
}

// データ概要を表示
async function displayDataOverview() {
    try {
        const getDataSummary = getPyScriptFunction('get_data_summary');
        const summaryHtml = await getDataSummary();

        // データ概要セクションを作成または更新
        let overviewSection = document.getElementById('data-overview-section');
        if (!overviewSection) {
            overviewSection = document.createElement('div');
            overviewSection.id = 'data-overview-section';
            overviewSection.className = 'data-overview';

            // navigationセクションの前に挿入
            const navSection = document.getElementById('navigation-section');
            navSection.parentNode.insertBefore(overviewSection, navSection);
        }

        // 折りたたみ可能なセクションとして表示
        overviewSection.innerHTML = `
            <div class="collapsible-section">
                <div class="collapsible-header" onclick="toggleCollapsible(this)">
                    <h3>
                        <i class="fas fa-table"></i>
                        データ概要
                    </h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content">
                    ${summaryHtml}
                </div>
            </div>
        `;

        console.log('Data overview displayed');
    } catch (error) {
        console.error('Failed to display data overview:', error);
    }
}

// 分析エリアにデータ概要を表示
async function displayDataOverviewInAnalysis() {
    try {
        const getDataSummary = getPyScriptFunction('get_data_summary');
        const summaryHtml = await getDataSummary();

        const controlsArea = document.getElementById('analysis-controls');

        // 既存のデータ概要セクションを削除
        const existingOverview = controlsArea.querySelector('.data-overview-in-analysis');
        if (existingOverview) {
            existingOverview.remove();
        }

        // 新しいデータ概要セクションを作成
        const overviewDiv = document.createElement('div');
        overviewDiv.className = 'data-overview-in-analysis';
        overviewDiv.innerHTML = `
            <div class="collapsible-section">
                <div class="collapsible-header collapsed" onclick="toggleCollapsible(this)">
                    <h3>
                        <i class="fas fa-table"></i>
                        データ概要
                    </h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    ${summaryHtml}
                </div>
            </div>
        `;

        // コントロールエリアの最初に挿入
        controlsArea.insertBefore(overviewDiv, controlsArea.firstChild);

        console.log('Data overview displayed in analysis area');
    } catch (error) {
        console.error('Failed to display data overview in analysis:', error);
    }
}

// 折りたたみセクションのトグル
function toggleCollapsible(header) {
    header.classList.toggle('collapsed');
    const content = header.nextElementSibling;
    content.classList.toggle('collapsed');
}

// ファイル内容を読み込む補助関数
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            resolve(e.target.result);
        };

        reader.onerror = function(e) {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

// 変数セレクトボックスに変数リストを設定
async function populateVariableSelects(selectConfigs) { // Expects an array of objects: [{id: 'varId', type: 'numeric'}]
    try {
        // Get all column types in one go to be efficient
        const get_numeric_columns = getPyScriptFunction('get_numeric_columns');
        const get_categorical_columns = getPyScriptFunction('get_categorical_columns');
        const get_text_columns = getPyScriptFunction('get_text_columns');
        const get_column_names = getPyScriptFunction('get_column_names');

        const [numeric_cols, categorical_cols, text_cols, all_cols] = await Promise.all([
            get_numeric_columns(),
            get_categorical_columns(),
            get_text_columns(),
            get_column_names()
        ]);

        const columnMap = {
            numeric: numeric_cols,
            categorical: categorical_cols,
            text: text_cols,
            all: all_cols
        };

        for (const config of selectConfigs) {
            const select = document.getElementById(config.id);
            if (!select) {
                console.error(`Select element not found: ${config.id}`);
                continue; // Skip to the next config if element not found
            }

            const columns = columnMap[config.type] || all_cols; // Fallback to all_cols if type is unknown

            // Clear existing options
            select.innerHTML = '';
            // Add a default empty option for better UX
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "選択してください";
            select.appendChild(defaultOption);

            columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('変数リストの取得に失敗:', error);
    }
}

// 分析コントロールを表示
async function showAnalysisControls() {
    const controlsArea = document.getElementById('analysis-controls');
    controlsArea.style.display = 'block';

    // データ概要を分析エリアに表示
    await displayDataOverviewInAnalysis();

    // 各分析タイプに応じたコントロールを表示
    switch(currentAnalysis) {
        case 'correlation':
            showCorrelationControls();
            break;
        case 'eda':
            showEDAControls();
            break;
        case 'ttest':
            showTTestControls();
            break;
        case 'chi_square':
            showChiSquareControls();
            break;
        case 'anova_one_way':
            showAnovaControls();
            break;
        case 'regression_simple':
            showSimpleRegressionControls();
            break;
        case 'pca':
            showPCAControls();
            break;
        case 'cleansing':
            showCleansingControls();
            break;
        case 'anova_two_way':
            showTwoWayAnovaControls();
            break;
        case 'regression_multiple':
            showMultipleRegressionControls();
            break;
        case 'factor_analysis':
            showFactorAnalysisControls();
            break;
        case 'text_mining':
            showTextMiningControls();
            break;
        default:
            controlsArea.innerHTML = '<p>すべての機能が実装されました！</p>';
    }
}

// 相関分析のコントロール
function showCorrelationControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📊 相関分析とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    2つの変数間の関係性の強さと方向性を数値化します。
                    相関係数は-1から1の範囲で、1に近いほど正の相関（一方が増えると他方も増える）、
                    -1に近いほど負の相関（一方が増えると他方が減る）を示します。
                    <strong>p値 &lt; 0.05</strong>の場合、統計的に有意な相関があると判断できます。
                </p>
            </div>
            <h3>変数を選択</h3>
            <div class="mb-2">
                <label>変数1:</label>
                <select id="var1" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>変数2:</label>
                <select id="var2" class="mb-1"></select>
            </div>
            <button onclick="runCorrelationAnalysis()">相関分析を実行</button>
        </div>
    `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;

    populateVariableSelects([{id: 'var1', type: 'numeric'}, {id: 'var2', type: 'numeric'}]);
}

// EDAのコントロール
function showEDAControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📈 探索的データ分析（EDA）とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    データの基本的な特性を理解するための分析手法です。
                    平均値、中央値、標準偏差などの記述統計量を算出し、
                    ヒストグラムや箱ひげ図でデータの分布や外れ値を視覚的に確認できます。
                    データ分析の最初のステップとして重要です。
                </p>
            </div>

            <!-- サマリー -->
            <div class="mb-3">
                <button onclick="runEDASummary()">要約統計量を表示</button>
            </div>

            <!-- 単一変数プロット -->
            <div class="mb-3">
                <button onclick="runVariablePlots()">各変数のプロットを表示</button>
            </div>

            <!-- 2変数プロット -->
            <div class="mb-3">
                <h3>2変数プロット</h3>
                <div class="mb-2">
                    <label>変数1:</label>
                    <select id="eda-var1" class="mb-1"></select>
                </div>
                <div class="mb-2">
                    <label>変数2:</label>
                    <select id="eda-var2" class="mb-1"></select>
                </div>
                <button onclick="runTwoVariablePlot()">2変数プロットを表示</button>
            </div>

            <!-- 3変数プロット -->
            <div class="mb-3">
                <h3>3変数プロット</h3>
                <div class="mb-2">
                    <label>カテゴリカル変数1:</label>
                    <select id="eda-cat-var1" class="mb-1"></select>
                </div>
                <div class="mb-2">
                    <label>カテゴリカル変数2:</label>
                    <select id="eda-cat-var2" class="mb-1"></select>
                </div>
                <div class="mb-2">
                    <label>数値変数:</label>
                    <select id="eda-num-var" class="mb-1"></select>
                </div>
                <button onclick="runThreeVariablePlot()">3変数プロットを表示</button>
            </div>
        </div>
    `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects([{id: 'eda-var1', type: 'all'}, {id: 'eda-var2', type: 'all'}]);
    populateVariableSelects([{id: 'eda-cat-var1', type: 'categorical'}, {id: 'eda-cat-var2', type: 'categorical'}]);
    populateVariableSelects([{id: 'eda-num-var', type: 'numeric'}]);
}

// EDA サマリーを実行
async function runEDASummary() {
    try {
        const get_eda_summaryFunc = getPyScriptFunction('get_eda_summary');
        const result = await get_eda_summaryFunc();
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// EDA 変数プロットを実行
async function runVariablePlots() {
    try {
        const get_variable_plotsFunc = getPyScriptFunction('get_variable_plots');
        const result = await get_variable_plotsFunc();
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// EDA 2変数プロットを実行
async function runTwoVariablePlot() {
    const var1 = document.getElementById('eda-var1').value;
    const var2 = document.getElementById('eda-var2').value;
    if (!var1 || !var2) {
        alert('変数を2つ選択してください。');
        return;
    }

    try {
        const get_two_variable_plotFunc = getPyScriptFunction('get_two_variable_plot');
        const result = await get_two_variable_plotFunc(var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// EDA 3変数プロットを実行
async function runThreeVariablePlot() {
    const catVar1 = document.getElementById('eda-cat-var1').value;
    const catVar2 = document.getElementById('eda-cat-var2').value;
    const numVar = document.getElementById('eda-num-var').value;
    if (!catVar1 || !catVar2 || !numVar) {
        alert('すべての変数を選択してください。');
        return;
    }

    try {
        const get_three_variable_plotFunc = getPyScriptFunction('get_three_variable_plot');
        const result = await get_three_variable_plotFunc(catVar1, catVar2, numVar);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}


// t検定のコントロール
function showTTestControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">🧪 t検定とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    2つのグループの平均値に統計的な差があるかを検定します。対応なし（独立した2群）と対応あり（同じ対象の前後比較）の2種類があります。<strong>p値 &lt; 0.05</strong>で有意差ありと判断します。効果量（Cohen's d）で差の大きさも評価できます。
                </p>
            </div>
            <h3>検定タイプを選択</h3>
            <select id="ttest-type" class="mb-2">
                <option value="independent">対応なし</option>
                <option value="paired">対応あり</option>
            </select>
            <div class="mb-2">
                <label>変数1:</label>
                <select id="ttest-var1" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>変数2:</label>
                <select id="ttest-var2" class="mb-1"></select>
            </div>
            <button onclick="runTTestAnalysis()">t検定を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects([{id: 'ttest-var1', type: 'numeric'}, {id: 'ttest-var2', type: 'numeric'}]);
}