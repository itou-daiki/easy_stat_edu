// グローバル変数
let currentData = null;
let currentAnalysis = null;
let pyScriptReady = false;

// PyScriptの初期化完了を検知
document.addEventListener('py-ready', function() {
    console.log('PyScript initialized successfully');
    pyScriptReady = true;
});

// PyScript関数を安全に取得するヘルパー関数
function getPyScriptFunction(functionName) {
    if (!pyScriptReady || typeof pyscript === 'undefined') {
        throw new Error('PyScriptがまだ初期化されていません。ページを再読み込みしてください。');
    }
    const func = pyscript.interpreter.globals.get(functionName);
    if (!func) {
        throw new Error(`関数 ${functionName} が見つかりません`);
    }
    return func;
}

// ローディング画面を非表示にしてメインアプリを表示
window.addEventListener('load', function() {
    // PyScriptの読み込み完了を待つ（最大10秒）
    let checkCount = 0;
    const checkInterval = setInterval(function() {
        checkCount++;
        // PyScriptが初期化されているか、またはタイムアウト（10秒）
        if (pyScriptReady || checkCount > 100) {
            clearInterval(checkInterval);
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'block';
            if (!pyScriptReady) {
                console.warn('PyScript initialization timeout, but proceeding anyway');
            }
        }
    }, 100);
});

// 分析機能を読み込む
function loadAnalysis(analysisType) {
    currentAnalysis = analysisType;

    // ナビゲーションを非表示、分析エリアを表示
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
    document.querySelector('.navigation-section').style.display = 'block';
    document.getElementById('analysis-area').style.display = 'none';
    document.getElementById('analysis-content').innerHTML = '';
    currentAnalysis = null;
    currentData = null;
}

// 分析コンテンツを読み込む
function loadAnalysisContent(analysisType) {
    const contentArea = document.getElementById('analysis-content');

    // PyScript初期化状態に応じたメッセージ
    const initMessage = !pyScriptReady ? `
        <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
            <i class="fas fa-hourglass-half" style="color: #f59e0b; margin-right: 0.5rem;"></i>
            <strong>PyScriptを初期化中...</strong> しばらくお待ちください
        </div>
    ` : '';

    // モダンなファイルアップロードUIを表示
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

// 分析コントロールを表示
function showAnalysisControls() {
    const controlsArea = document.getElementById('analysis-controls');
    controlsArea.style.display = 'block';

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

    // 変数リストを取得してセレクトボックスに設定
    populateVariableSelects(['var1', 'var2']);
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
            <h3>分析する変数を選択</h3>
            <select id="eda-var" class="mb-2"></select>
            <button onclick="runEDAAnalysis()">分析を実行</button>
        </div>
    `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['eda-var']);
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
    populateVariableSelects(['ttest-var1', 'ttest-var2']);
}

// 変数セレクトボックスに変数リストを設定
async function populateVariableSelects(selectIds) {
    try {
        const get_column_namesFunc = getPyScriptFunction('get_column_names');
        const columns = await get_column_namesFunc();

        selectIds.forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            columns.forEach(col => {
                const option = document.createElement('option');
                option.value = col;
                option.textContent = col;
                select.appendChild(option);
            });
        });
    } catch (error) {
        console.error('変数リストの取得に失敗:', error);
    }
}

// 相関分析を実行
async function runCorrelationAnalysis() {
    const var1 = document.getElementById('var1').value;
    const var2 = document.getElementById('var2').value;

    try {
        const run_correlation_analysisFunc = getPyScriptFunction('run_correlation_analysis');
        const result = await run_correlation_analysisFunc(var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// EDA分析を実行
async function runEDAAnalysis() {
    const variable = document.getElementById('eda-var').value;

    try {
        const run_eda_analysisFunc = getPyScriptFunction('run_eda_analysis');
        const result = await run_eda_analysisFunc(variable);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// t検定を実行
async function runTTestAnalysis() {
    const testType = document.getElementById('ttest-type').value;
    const var1 = document.getElementById('ttest-var1').value;
    const var2 = document.getElementById('ttest-var2').value;

    try {
        const run_ttest_analysisFunc = getPyScriptFunction('run_ttest_analysis');
        const result = await run_ttest_analysisFunc(testType, var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// カイ二乗検定のコントロール
function showChiSquareControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📋 カイ二乗検定とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    カテゴリカルデータ（質的変数）の独立性を検定します。2つのカテゴリ変数に関連性があるかを、クロス集計表を用いて分析します。<strong>p値 &lt; 0.05</strong>で2変数間に有意な関連性があると判断できます。
                </p>
            </div>
            <h3>変数を選択</h3>
            <div class="mb-2">
                <label>変数1:</label>
                <select id="chi-var1" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>変数2:</label>
                <select id="chi-var2" class="mb-1"></select>
            </div>
            <button onclick="runChiSquareAnalysis()">カイ二乗検定を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['chi-var1', 'chi-var2']);
}

// 分散分析のコントロール
function showAnovaControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📊 一要因分散分析（ANOVA）とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    3つ以上のグループの平均値に差があるかを検定します。t検定の拡張版で、複数グループを同時に比較できます。<strong>p値 &lt; 0.05</strong>で「少なくとも1つのグループに差がある」と判断します。
                </p>
            </div>
            <h3>分析する変数を選択（2つ以上）</h3>
            <p class="text-muted">Ctrlキーを押しながら複数選択してください</p>
            <select id="anova-vars" multiple size="6" class="mb-2"></select>
            <button onclick="runAnovaAnalysis()">分散分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['anova-vars']);
}

// 単回帰分析のコントロール
function showSimpleRegressionControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📉 単回帰分析とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    1つの説明変数（X）から目的変数（Y）を予測する関係式を導きます。決定係数（R²）は予測の精度を示し、1に近いほど高精度です。散布図に回帰直線を引いて関係性を視覚化します。
                </p>
            </div>
            <h3>変数を選択</h3>
            <div class="mb-2">
                <label>説明変数 (X):</label>
                <select id="reg-x" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>目的変数 (Y):</label>
                <select id="reg-y" class="mb-1"></select>
            </div>
            <button onclick="runSimpleRegressionAnalysis()">単回帰分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['reg-x', 'reg-y']);
}

// 主成分分析のコントロール
function showPCAControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">🎯 主成分分析（PCA）とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    多数の変数を少数の合成変数（主成分）に集約する次元削減手法です。データの特徴を保持しながら可視化や解釈を容易にします。寄与率で各主成分がデータの何%を説明しているかがわかります。
                </p>
            </div>
            <h3>主成分数を指定</h3>
            <div class="mb-2">
                <label>主成分数:</label>
                <input type="number" id="pca-components" value="2" min="1" max="10" class="mb-1">
            </div>
            <p class="text-muted">全ての数値型変数を使用して主成分分析を行います</p>
            <button onclick="runPCAAnalysis()">主成分分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
}

// カイ二乗検定を実行
async function runChiSquareAnalysis() {
    const var1 = document.getElementById('chi-var1').value;
    const var2 = document.getElementById('chi-var2').value;

    try {
        const run_chi_square_analysisFunc = getPyScriptFunction('run_chi_square_analysis');
        const result = await run_chi_square_analysisFunc(var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 分散分析を実行
async function runAnovaAnalysis() {
    const select = document.getElementById('anova-vars');
    const selectedVars = Array.from(select.selectedOptions).map(option => option.value);

    if (selectedVars.length < 2) {
        alert('2つ以上の変数を選択してください');
        return;
    }

    try {
        const run_anova_analysisFunc = getPyScriptFunction('run_anova_analysis');
        const result = await run_anova_analysisFunc(selectedVars);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 単回帰分析を実行
async function runSimpleRegressionAnalysis() {
    const xVar = document.getElementById('reg-x').value;
    const yVar = document.getElementById('reg-y').value;

    try {
        const run_simple_regression_analysisFunc = getPyScriptFunction('run_simple_regression_analysis');
        const result = await run_simple_regression_analysisFunc(xVar, yVar);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 主成分分析を実行
async function runPCAAnalysis() {
    const nComponents = parseInt(document.getElementById('pca-components').value);

    try {
        const run_pca_analysisFunc = getPyScriptFunction('run_pca_analysis');
        const result = await run_pca_analysisFunc(nComponents);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// データクレンジングのコントロール
function showCleansingControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">🧹 データクレンジングとは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    データ分析の前準備として、欠損値、重複行、異常値などを検出・処理します。データの品質を高めることで、分析結果の信頼性が向上します。データ分析の成否を左右する重要なプロセスです。
                </p>
            </div>
            <h3>データクレンジング</h3>
            <button onclick="runDataCleansing()" class="mb-2">データの状態を確認</button>
            <div id="cleansing-results" class="mt-2"></div>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
}

// 二要因分散分析のコントロール
function showTwoWayAnovaControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📊 二要因分散分析とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    2つの要因（独立変数）が従属変数に与える影響を同時に分析します。各要因の主効果を検定し、複数の要因が結果に与える影響を理解できます。
                </p>
            </div>
            <h3>変数を選択</h3>
            <div class="mb-2">
                <label>第1要因:</label>
                <select id="anova2-factor1" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>第2要因:</label>
                <select id="anova2-factor2" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>従属変数:</label>
                <select id="anova2-dependent" class="mb-1"></select>
            </div>
            <button onclick="runTwoWayAnova()">二要因分散分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['anova2-factor1', 'anova2-factor2', 'anova2-dependent']);
}

// 重回帰分析のコントロール
function showMultipleRegressionControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📈 重回帰分析とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    複数の説明変数（X1, X2, ...）から目的変数（Y）を予測します。各説明変数の影響力を定量化でき、調整済みR²で予測精度を評価します。ビジネスや研究で最も使われる手法の1つです。
                </p>
            </div>
            <h3>変数を選択</h3>
            <div class="mb-2">
                <label>説明変数（複数選択可）:</label>
                <p class="text-muted">Ctrlキーを押しながら複数選択してください</p>
                <select id="mreg-x-vars" multiple size="6" class="mb-1"></select>
            </div>
            <div class="mb-2">
                <label>目的変数:</label>
                <select id="mreg-y-var" class="mb-1"></select>
            </div>
            <button onclick="runMultipleRegression()">重回帰分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['mreg-x-vars', 'mreg-y-var']);
}

// 因子分析のコントロール
function showFactorAnalysisControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">🔍 因子分析とは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    多数の変数の背後にある潜在的な共通因子を抽出します。変数間の相関パターンから、データを説明する少数の因子を見つけます。因子負荷量で各変数と因子の関係性がわかります。
                </p>
            </div>
            <h3>因子数を指定</h3>
            <div class="mb-2">
                <label>因子数:</label>
                <input type="number" id="factor-n" value="2" min="1" max="10" class="mb-1">
            </div>
            <p class="text-muted">全ての数値型変数を使用して因子分析を行います</p>
            <button onclick="runFactorAnalysis()">因子分析を実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
}

// テキストマイニングのコントロール
function showTextMiningControls() {
    const controlsHTML = `
        <div class="mb-3">
            <div class="analysis-overview mb-3" style="background: #f0f9ff; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e90ff;">
                <h3 style="margin-bottom: 0.5rem;">📝 テキストマイニングとは</h3>
                <p style="margin: 0; color: #475569; line-height: 1.6;">
                    テキストデータから頻出単語を抽出し、内容の特徴を定量的に分析します。アンケートの自由記述やレビューデータなどの分析に有効です。単語の出現回数で重要なキーワードを把握できます。
                </p>
            </div>
            <h3>テキスト列を選択</h3>
            <select id="text-column" class="mb-2"></select>
            <p class="text-muted">簡易的な単語分割を使用します（MeCabは使用していません）</p>
            <button onclick="runTextMining()">テキストマイニングを実行</button>
        </div>
        `;

    document.getElementById('analysis-controls').innerHTML = controlsHTML;
    populateVariableSelects(['text-column']);
}

// データクレンジングを実行
async function runDataCleansing() {
    try {
        const run_data_cleansingFunc = getPyScriptFunction('run_data_cleansing');
        const result = await run_data_cleansingFunc();
        displayResults(result);

        // クレンジング操作ボタンを追加
        const cleansingButtons = `
            <div class="mt-3">
                <h4>クレンジング操作</h4>
                <button onclick="removeMissingRows()" class="mb-1">欠損値を含む行を削除</button>
                <button onclick="removeDuplicates()" class="mb-1">重複行を削除</button>
                <button onclick="fillMissingMean()" class="mb-1">欠損値を平均値で補完</button>
                <div id="cleansing-message" class="mt-2"></div>
            </div>
        `;
        document.getElementById('cleansing-results').innerHTML = cleansingButtons;
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

async function removeMissingRows() {
    try {
        const remove_missing_rowsFunc = getPyScriptFunction('remove_missing_rows');
        const result = await remove_missing_rowsFunc();
        document.getElementById('cleansing-message').innerHTML = `<p>${result}</p>`;
        // データを再読み込み
        runDataCleansing();
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

async function removeDuplicates() {
    try {
        const remove_duplicatesFunc = getPyScriptFunction('remove_duplicates');
        const result = await remove_duplicatesFunc();
        document.getElementById('cleansing-message').innerHTML = `<p>${result}</p>`;
        runDataCleansing();
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

async function fillMissingMean() {
    try {
        const fill_missing_meanFunc = getPyScriptFunction('fill_missing_mean');
        const result = await fill_missing_meanFunc();
        document.getElementById('cleansing-message').innerHTML = `<p>${result}</p>`;
        runDataCleansing();
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

// 二要因分散分析を実行
async function runTwoWayAnova() {
    const factor1 = document.getElementById('anova2-factor1').value;
    const factor2 = document.getElementById('anova2-factor2').value;
    const dependent = document.getElementById('anova2-dependent').value;

    try {
        const run_two_way_anovaFunc = getPyScriptFunction('run_two_way_anova');
        const result = await run_two_way_anovaFunc(factor1, factor2, dependent);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 重回帰分析を実行
async function runMultipleRegression() {
    const select = document.getElementById('mreg-x-vars');
    const xVars = Array.from(select.selectedOptions).map(option => option.value);
    const yVar = document.getElementById('mreg-y-var').value;

    if (xVars.length < 1) {
        alert('最低1つの説明変数を選択してください');
        return;
    }

    try {
        const run_multiple_regressionFunc = getPyScriptFunction('run_multiple_regression');
        const result = await run_multiple_regressionFunc(xVars, yVar);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 因子分析を実行
async function runFactorAnalysis() {
    const nFactors = parseInt(document.getElementById('factor-n').value);

    try {
        const run_factor_analysisFunc = getPyScriptFunction('run_factor_analysis');
        const result = await run_factor_analysisFunc(nFactors);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// テキストマイニングを実行
async function runTextMining() {
    const textColumn = document.getElementById('text-column').value;

    try {
        const run_text_miningFunc = getPyScriptFunction('run_text_mining');
        const result = await run_text_miningFunc(textColumn);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 結果を表示
function displayResults(result) {
    const resultsArea = document.getElementById('analysis-results');
    resultsArea.innerHTML = result;
}
