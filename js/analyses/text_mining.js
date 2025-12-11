import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

let tokenizer = null;

async function initTokenizer() {
    return new Promise((resolve, reject) => {
        // Use a more reliable dictionary path (official demo path or local if available)
        // Here we use the github io demo path which is generally reliable for demos
        kuromoji.builder({ dicPath: "https://takuyaa.github.io/kuromoji.js/demo/dict/" }).build((err, _tokenizer) => {
            if (err) reject(err);
            tokenizer = _tokenizer;
            resolve();
        });
    });
}

async function runTextMining(currentData) {
    const textVar = document.getElementById('text-var').value;
    const catVar = document.getElementById('category-var').value;

    if (!textVar) {
        alert('テキスト変数を選択してください');
        return;
    }

    // UI Loading state
    const btn = document.getElementById('run-text-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 解析中...';
    btn.disabled = true;

    // Clear previous results
    document.getElementById('analysis-results').style.display = 'block';

    const overallContainer = document.getElementById('overall-results');
    overallContainer.innerHTML = '';
    const categoryContainer = document.getElementById('category-results');
    categoryContainer.innerHTML = '';


    try {
        if (!tokenizer) await initTokenizer();

        // 1. Overall Analysis
        const allTexts = currentData.map(d => d[textVar]).filter(v => v != null && v !== '');
        if (allTexts.length === 0) throw new Error('有効なテキストデータがありません');

        overallContainer.innerHTML = `<h4 style="color: #2d3748; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">全体分析 (N=${allTexts.length})</h4>`;
        await analyzeAndRender(allTexts, overallContainer, 'overall');

        // 2. Category Analysis (if selected)
        if (catVar) {
            const categories = [...new Set(currentData.map(d => d[catVar]))].filter(v => v != null).sort();

            categoryContainer.innerHTML = `<h4 style="color: #2d3748; margin-top: 3rem; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">カテゴリ別分析: ${catVar}</h4>`;

            for (const cat of categories) {
                const catData = currentData.filter(d => d[catVar] === cat);
                const catTexts = catData.map(d => d[textVar]).filter(v => v != null && v !== '');

                if (catTexts.length > 0) {
                    const sectionId = `cat-results-${cat}`;
                    const section = document.createElement('div');
                    section.id = sectionId;
                    section.className = 'category-section';
                    section.style.marginBottom = '2rem';
                    section.innerHTML = `<h5 style="color: #1e90ff; font-weight: bold; margin-bottom: 1rem;">＜${cat}＞ (N=${catTexts.length})</h5>`;
                    categoryContainer.appendChild(section);

                    await analyzeAndRender(catTexts, section, `cat-${cat}`);
                }
            }
        }

    } catch (e) {
        console.error(e);
        alert('解析中にエラーが発生しました: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function analyzeAndRender(texts, container, prefix) {
    return new Promise((resolve) => {
        // Use setTimeout to allow UI update
        setTimeout(() => {
            const allWords = [];
            const sentences = [];

            texts.forEach(text => {
                const tokens = tokenizer.tokenize(text);
                const wordsInSentence = [];
                tokens.forEach(token => {
                    // Filter parts of speech: Noun, Verb, Adjective
                    if (['名詞', '動詞', '形容詞'].includes(token.pos) && token.surface_form.length > 1) {
                        // Use basic form if available, else surface form
                        const word = token.basic_form === '*' ? token.surface_form : token.basic_form;
                        allWords.push(word);
                        wordsInSentence.push(word);
                    }
                });
                if (wordsInSentence.length > 0) sentences.push(wordsInSentence);
            });

            // Word Frequency
            const counts = {};
            allWords.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
            const sortedWords = Object.entries(counts).sort((a, b) => b[1] - a[1]);

            // Layout Calculation
            const wrapper = document.createElement('div');
            wrapper.className = 'grid-2-cols';
            wrapper.style.display = 'grid';
            wrapper.style.gridTemplateColumns = '1fr 1fr';
            wrapper.style.gap = '1.5rem';
            wrapper.style.marginBottom = '1.5rem';

            // WordCloud Container
            const wcId = `${prefix}-wordcloud`;
            const wcContainer = document.createElement('div');
            wcContainer.style.background = 'white';
            wcContainer.style.padding = '1rem';
            wcContainer.style.borderRadius = '8px';
            wcContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            wcContainer.innerHTML = `<h6 style="color: #4a5568; margin-bottom: 0.5rem; font-weight: bold;">ワードクラウド</h6><canvas id="${wcId}" style="width: 100%; height: 300px;"></canvas>`;

            // Network Container
            const netId = `${prefix}-network`;
            const netContainer = document.createElement('div');
            netContainer.style.background = 'white';
            netContainer.style.padding = '1rem';
            netContainer.style.borderRadius = '8px';
            netContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            netContainer.innerHTML = `<h6 style="color: #4a5568; margin-bottom: 0.5rem; font-weight: bold;">共起ネットワーク</h6><div id="${netId}" style="width: 100%; height: 300px;"></div>`;

            wrapper.appendChild(wcContainer);
            wrapper.appendChild(netContainer);
            container.appendChild(wrapper);

            // Render Charts
            // 1. Word Cloud
            displayWordCloud(wcId, sortedWords);

            // 2. Network
            // Use top 50 words for network to avoid clutter
            const topWordsForNet = sortedWords.slice(0, 50).map(x => x[0]);
            plotCooccurrenceNetwork(netId, sentences, topWordsForNet);

            resolve();
        }, 10);
    });
}

function displayWordCloud(canvasId, wordCounts) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = canvas.parentElement.offsetWidth || 500;
    canvas.height = 300;

    const list = wordCounts.slice(0, 70).map(([w, c]) => [w, c]);

    WordCloud(canvas, {
        list: list,
        gridSize: 8,
        weightFactor: size => Math.pow(size, 0.7) * 12, // Adjusted scaling
        fontFamily: 'sans-serif',
        color: 'random-dark',
        backgroundColor: '#fafbfc',
        rotateRatio: 0,
        shuffle: false
    });
}

function plotCooccurrenceNetwork(containerId, sentences, topWords) {
    // 1. Calculate Jaccard Coefficients for all pairs
    const edges = [];

    // Pre-calculate word presence in sentences for speed
    const wordPresence = {};
    topWords.forEach(w => {
        wordPresence[w] = new Set();
    });

    sentences.forEach((s, sIdx) => {
        s.forEach(w => {
            if (wordPresence[w]) wordPresence[w].add(sIdx);
        });
    });

    for (let i = 0; i < topWords.length; i++) {
        for (let j = i + 1; j < topWords.length; j++) {
            const w1 = topWords[i];
            const w2 = topWords[j];

            const set1 = wordPresence[w1];
            const set2 = wordPresence[w2];

            // Intersection size
            let intersection = 0;
            set1.forEach(id => {
                if (set2.has(id)) intersection++;
            });

            if (intersection > 0) {
                // Union size
                const union = new Set([...set1, ...set2]).size;
                const jaccard = intersection / union;

                edges.push({ from: w1, to: w2, weight: jaccard });
            }
        }
    }

    // 2. Keep Top N edges (Top 60 roughly)
    edges.sort((a, b) => b.weight - a.weight);
    const topEdges = edges.slice(0, 60);

    // 3. Identify Nodes involved in top edges
    const activeNodes = new Set();
    topEdges.forEach(e => {
        activeNodes.add(e.from);
        activeNodes.add(e.to);
    });

    const nodes = Array.from(activeNodes).map(id => ({
        id,
        label: id,
        value: topEdges.filter(e => e.from === id || e.to === id).length * 5 // Rough sizing by degree
    }));

    // 4. Render
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(topEdges.map(e => ({
            from: e.from,
            to: e.to,
            value: e.weight,
            title: `Jaccard: ${e.weight.toFixed(3)}`
        })))
    };

    const options = {
        nodes: {
            shape: 'dot',
            scaling: { min: 10, max: 30 },
            font: { size: 14 }
        },
        edges: {
            color: { color: '#848484', highlight: '#1e90ff' },
            smooth: false
        },
        physics: {
            stabilization: false,
            barnesHut: {
                gravitationalConstant: -3000,
                springConstant: 0.04,
                springLength: 95
            }
        },
        interaction: { tooltipDelay: 200 }
    };

    new vis.Network(container, data, options);
}


export function render(container, currentData, characteristics) {
    const { textColumns, categoricalColumns } = characteristics;

    container.innerHTML = `
        <div class="text-mining-container">
            <div style="background: #1e90ff; color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; font-size: 1.5rem; font-weight: bold;">
                    <i class="fas fa-comment-dots"></i> テキストマイニング
                </h3>
                <p style="margin: 0.5rem 0 0 0; opacity: 0.9;">テキストデータの構造を可視化します（日本語対応）</p>
            </div>

            <!-- 分析設定 -->
            <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 2rem;">
                <div class="grid-2-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div id="text-var-container"></div>
                    <div id="category-var-container"></div>
                </div>
                <div id="run-text-btn-container"></div>
            </div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;">
                <div id="overall-results"></div>
                <div id="category-results"></div>
            </div>
            
             <!-- データ概要 -->
            <div id="tm-data-overview" class="info-sections" style="margin-top: 3rem;"></div>
        </div>
    `;

    renderDataOverview('#tm-data-overview', currentData, characteristics, { initiallyCollapsed: true });

    // Text Variable Select
    createVariableSelector('text-var-container', textColumns, 'text-var', {
        label: '<i class="fas fa-font"></i> 分析するテキスト変数（必須）:',
        multiple: false
    });

    // Category Variable Select
    // Allow empty selection (optional)
    createVariableSelector('category-var-container', categoricalColumns, 'category-var', {
        label: '<i class="fas fa-layer-group"></i> カテゴリ変数（任意・比較用）:',
        multiple: false,
        placeholder: '選択なし（全体分析のみ）'
    });

    createAnalysisButton('run-text-btn-container', '分析を実行', () => runTextMining(currentData), { id: 'run-text-btn' });
}
