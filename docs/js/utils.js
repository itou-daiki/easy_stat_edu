// グローバル変数
let currentData = null;
let currentAnalysis = null;

// ローディング画面を非表示にしてメインアプリを表示
window.addEventListener('load', function() {
    // PyScriptの読み込み完了を待つ
    setTimeout(function() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
    }, 3000);
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

    // 基本的なファイルアップロードUIを表示
    const uploadHTML = `
        <div class="upload-section mb-3">
            <h3>データファイルをアップロード</h3>
            <input type="file" id="data-file" accept=".xlsx,.xls,.csv" class="mb-2">
            <p class="text-muted">Excel (.xlsx, .xls) または CSV ファイルをアップロードしてください</p>
        </div>
        <div id="analysis-controls" style="display: none;"></div>
        <div id="analysis-results"></div>
    `;

    contentArea.innerHTML = uploadHTML;

    // ファイルアップロードイベントを設定
    document.getElementById('data-file').addEventListener('change', handleFileUpload);
}

// ファイルアップロード処理
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // ファイル読み込み
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // PyScriptのload_data関数を呼び出す
            const data = await pyscript.interpreter.globals.get('load_file_data')(
                e.target.result,
                file.name
            );

            currentData = data;

            // 分析コントロールを表示
            showAnalysisControls();
        } catch (error) {
            alert('ファイルの読み込みに失敗しました: ' + error.message);
        }
    };

    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
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
        // その他の分析タイプを追加
        default:
            controlsArea.innerHTML = '<p>この分析機能は準備中です。以下の機能は既に利用可能です:<br>- 相関分析<br>- EDA<br>- t検定<br>- カイ二乗検定<br>- 一要因分散分析<br>- 単回帰分析<br>- 主成分分析</p>';
    }
}

// 相関分析のコントロール
function showCorrelationControls() {
    const controlsHTML = `
        <div class="mb-3">
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
        const columns = await pyscript.interpreter.globals.get('get_column_names')();

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
        const result = await pyscript.interpreter.globals.get('run_correlation_analysis')(var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// EDA分析を実行
async function runEDAAnalysis() {
    const variable = document.getElementById('eda-var').value;

    try {
        const result = await pyscript.interpreter.globals.get('run_eda_analysis')(variable);
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
        const result = await pyscript.interpreter.globals.get('run_ttest_analysis')(testType, var1, var2);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// カイ二乗検定のコントロール
function showChiSquareControls() {
    const controlsHTML = `
        <div class="mb-3">
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
        const result = await pyscript.interpreter.globals.get('run_chi_square_analysis')(var1, var2);
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
        const result = await pyscript.interpreter.globals.get('run_anova_analysis')(selectedVars);
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
        const result = await pyscript.interpreter.globals.get('run_simple_regression_analysis')(xVar, yVar);
        displayResults(result);
    } catch (error) {
        alert('分析の実行に失敗しました: ' + error.message);
    }
}

// 主成分分析を実行
async function runPCAAnalysis() {
    const nComponents = parseInt(document.getElementById('pca-components').value);

    try {
        const result = await pyscript.interpreter.globals.get('run_pca_analysis')(nComponents);
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
