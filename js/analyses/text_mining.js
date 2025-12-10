import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

let tokenizer = null;

async function initTokenizer() {
    return new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" }).build((err, _tokenizer) => {
            if (err) reject(err);
            tokenizer = _tokenizer;
            resolve();
        });
    });
}

async function runTextMining(currentData) {
    const textVar = document.getElementById('text-var').value;
    if (!textVar) {
        alert('テキスト変数を選択してください');
        return;
    }

    // UI Loading state
    const btn = document.getElementById('run-text-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 解析中...';
    btn.disabled = true;

    try {
        if (!tokenizer) await initTokenizer();

        const texts = currentData.map(d => d[textVar]).filter(v => v != null && v !== '');

        // 形態素解析と単語抽出
        const allWords = [];
        const sentences = [];

        texts.forEach(text => {
            const tokens = tokenizer.tokenize(text);
            const wordsInSentence = [];
            tokens.forEach(token => {
                // 名詞、動詞、形容詞のみ抽出（不要語除去は簡易的）
                if (['名詞', '動詞', '形容詞'].includes(token.pos) && token.surface_form.length > 1) {
                    // 基本形を使用
                    const word = token.basic_form === '*' ? token.surface_form : token.basic_form;
                    allWords.push(word);
                    wordsInSentence.push(word);
                }
            });
            if (wordsInSentence.length > 0) sentences.push(wordsInSentence);
        });

        // 単語頻度集計
        const counts = {};
        allWords.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
        const sortedWords = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        displayWordCloud(sortedWords);
        plotCooccurrenceNetwork(sentences, sortedWords.slice(0, 50).map(x => x[0])); // Top 50 words
        displayTopWords(sortedWords);

        document.getElementById('analysis-results').style.display = 'block';
    } catch (e) {
        console.error(e);
        alert('解析中にエラーが発生しました');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function displayWordCloud(wordCounts) {
    const canvas = document.getElementById('wordcloud-canvas');
    // リサイズ
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 400;

    // WordCloud2.js format: [[word, weight], ...]
    const list = wordCounts.slice(0, 100).map(([w, c]) => [w, c]); // Top 100

    WordCloud(canvas, {
        list: list,
        gridSize: 8,
        weightFactor: size => Math.pow(size, 0.8) * 10, // Scale adjustment
        fontFamily: 'sans-serif',
        color: 'random-dark',
        backgroundColor: '#f0f9ff',
        rotateRatio: 0
    });
}

function plotCooccurrenceNetwork(sentences, topWords) {
    // 共起行列の作成 (Jaccard係数などでエッジの重みを計算)
    const nodes = topWords.map(id => ({ id, label: id }));
    const edges = [];

    for (let i = 0; i < topWords.length; i++) {
        for (let j = i + 1; j < topWords.length; j++) {
            const w1 = topWords[i];
            const w2 = topWords[j];

            // 共起数
            let intersection = 0;
            let union = 0; // Jaccard denominator

            sentences.forEach(s => {
                const has1 = s.includes(w1);
                const has2 = s.includes(w2);
                if (has1 && has2) intersection++;
                if (has1 || has2) union++;
            });

            if (intersection > 0) {
                const jaccard = intersection / union;
                if (jaccard > 0.1) { // 閾値
                    edges.push({
                        from: w1, to: w2, value: jaccard
                    });
                }
            }
        }
    }

    // vis.js Network
    const container = document.getElementById('network-graph');
    container.innerHTML = '';
    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
    };
    const options = {
        nodes: {
            shape: 'dot',
            size: 20,
            font: { size: 16 }
        },
        physics: {
            stabilization: false,
            barnesHut: { gravitationalConstant: -2000 }
        }
    };
    new vis.Network(container, data, options);
}

function displayTopWords(sortedWords) {
    const list = document.getElementById('top-words-list');
    list.innerHTML = sortedWords.slice(0, 20).map(([w, c], i) => `
        <div style="padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
            <span>${i + 1}. <strong>${w}</strong></span>
            <span style="color: #1e90ff;">${c}</span>
        </div>
    `).join('');
}

export function render(container, currentData, characteristics) {
    const { textColumns } = characteristics;

    container.innerHTML = `
        <div class="text-mining-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> テキストマイニング
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">テキストデータの構造を可視化します（日本語対応）</p>
            </div>

            <!-- 分析の概要・解釈 -->
            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> テキストマイニング (Text Mining) とは？</strong>
                        <p>アンケートの自由記述などの文章データを単語に分解し、出現頻度や単語同士のつながりを分析・可視化する手法です。</p>
                    </div>
                    <h4>主な機能</h4>
                    <ul>
                        <li><strong>ワードクラウド:</strong> 出現頻度の高い単語を大きく表示し、全体像を直感的に把握します。</li>
                        <li><strong>共起ネットワーク:</strong> 一緒に出現することの多い単語同士を線で結び、話題のつながりや文脈を可視化します。</li>
                    </ul>
                </div>
            </div>

            <!-- データ概要 -->
            <div id="tm-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">

                <div id="text-var-container" style="margin-bottom: 1.5rem; padding: 1rem; background: #fafbfc; border-radius: 8px;"></div>

                <div id="run-text-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div class="grid-2-cols" style="display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-cloud"></i> ワードクラウド</h4>
                        <canvas id="wordcloud-canvas" style="width: 100%;"></canvas>
                    </div>
                    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-height: 500px; overflow-y: auto;">
                        <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-list-ol"></i> 頻出単語ランキング</h4>
                        <div id="top-words-list"></div>
                    </div>
                </div>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h4 style="color: #1e90ff; margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> 共起ネットワーク</h4>
                    <div id="network-graph" style="height: 500px;"></div>
                </div>
            </div>
        </div>
    `;

    renderDataOverview('#tm-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Single Select
    createVariableSelector('text-var-container', textColumns, 'text-var', {
        label: '<i class="fas fa-font"></i> 分析するテキスト文字変数:',
        multiple: false
    });

    createAnalysisButton('run-text-btn-container', '分析を実行', () => runTextMining(currentData), { id: 'run-text-btn' });
}
```
