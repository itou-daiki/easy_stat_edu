import { currentData } from '../main.js';

/**
 * テキストマイニング分析のUIをレンダリングし、イベントハンドラを設定する
 * @param {HTMLElement} container - UIを描画するコンテナ要素
 * @param {object} characteristics - データセットの特性（列の型など）
 */
export function render(container, characteristics) {
    const { textColumns } = characteristics;

    // テキスト列がない場合はエラーメッセージを表示
    if (!textColumns || textColumns.length === 0) {
        container.innerHTML = '<p class="error-message">分析対象となるテキストデータ（文字列型の列）が見つかりません。</p>';
        return;
    }

    // テキスト列を選択するためのドロップダウンメニューのHTMLを生成
    const options = textColumns.map(col => `<option value="${col}">${col}</option>`).join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="text-mining-column">分析対象の列:</label>
                <select id="text-mining-column">${options}</select>
            </div>
            <button id="run-text-mining-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="text-mining-results" class="analysis-results">
            <!-- ここに分析結果が表示される -->
        </div>
    `;

    // "分析を実行"ボタンにイベントリスナーを追加
    document.getElementById('run-text-mining-btn').addEventListener('click', () => {
        const selectedColumn = document.getElementById('text-mining-column').value;
        runTextMining(selectedColumn);
    });
}


/**
 * テキストマイニング分析を実行し、結果を表示する
 * @param {string} column - 分析対象の列名
 */
async function runTextMining(column) {
    const resultsContainer = document.getElementById('text-mining-results');
    const btn = document.getElementById('run-text-mining-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';

    resultsContainer.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-cog fa-spin"></i> 形態素解析エンジンを初期化しています...（初回は時間がかかります）
        </div>
    `;

    try {
        // 1. kuromoji.jsのTokenizerをビルド
        const tokenizer = await new Promise((resolve, reject) => {
            kuromoji.builder({ dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' }).build((err, tokenizer) => {
                if (err) {
                    return reject(err);
                }
                resolve(tokenizer);
            });
        });

        resultsContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-tasks"></i> テキストを解析中...
            </div>
        `;

        // 2. テキストデータを抽出・解析
        const words = currentData
            .map(row => row[column])
            .filter(text => text && typeof text === 'string')
            .flatMap(text => {
                const tokens = tokenizer.tokenize(text);
                return tokens
                    .filter(token => {
                        const pos = token.pos;
                        return pos === '名詞' || pos === '動詞' || pos === '形容詞';
                    })
                    .map(token => token.basic_form);
            });

        if (words.length === 0) {
            resultsContainer.innerHTML = '<p>分析対象の単語が見つかりませんでした。</p>';
            return;
        }

        // 3. 単語頻度を集計
        const wordFrequencies = words.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});

        const sortedFrequencies = Object.entries(wordFrequencies)
            .sort((a, b) => b[1] - a[1]);

        // 4. 結果を表示
        resultsContainer.innerHTML = `
            <h4>分析結果</h4>
            <div class="text-mining-container">
                <div class="word-cloud-container">
                    <h5>ワードクラウド</h5>
                    <canvas id="word-cloud-canvas" width="600" height="400"></canvas>
                </div>
                <div class="frequency-table-container">
                    <h5>単語出現頻度 Top 20</h5>
                    <div id="frequency-table"></div>
                </div>
            </div>
        `;

        // 4a. 頻度テーブルを描画
        const tableContainer = document.getElementById('frequency-table');
        const tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>順位</th>
                        <th>単語</th>
                        <th>出現回数</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedFrequencies.slice(0, 20).map(([word, count], index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${word}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHtml;

        // 4b. ワードクラウドを描画
        const canvas = document.getElementById('word-cloud-canvas');
        const list = sortedFrequencies.map(([word, count]) => [word, count]);
        
        WordCloud(canvas, { 
            list: list,
            gridSize: Math.round(16 * 600 / 1024),
            weightFactor: function (size) {
                // 最大頻度の単語のサイズを基準にフォントサイズを調整
                if (list.length > 0) {
                    const maxFreq = list[0][1];
                    return (size / maxFreq) * 50;
                }
                return size * 10;
            },
            fontFamily: 'sans-serif',
            color: 'random-dark',
            backgroundColor: '#f0f0f0'
        });

    } catch (error) {
        console.error('テキストマイニングエラー:', error);
        resultsContainer.innerHTML = `<p class="error-message">分析中にエラーが発生しました: ${error.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '分析を実行';
    }
}

