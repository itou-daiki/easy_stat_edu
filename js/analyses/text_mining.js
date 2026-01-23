import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

let tokenizer = null;

async function initTokenizer(statusCallback) {
    return new Promise((resolve, reject) => {
        if (statusCallback) statusCallback('辞書データをダウンロード中...（初回のみ数秒かかります）');

        // Use jsDelivr CDN for reliable dictionary loading
        kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict" }).build((err, _tokenizer) => {
            if (err) {
                console.error('Kuromoji initialization failed:', err);
                reject(new Error('形態素解析エンジンの初期化に失敗しました。ネットワーク接続を確認してください。'));
                return;
            }
            tokenizer = _tokenizer;
            if (statusCallback) statusCallback('解析中...');
            resolve();
        });
    });
}

async function runTextMining(currentData) {
    const textVar = document.getElementById('text-var').value;
    const catVar = document.getElementById('category-var').value;
    alert('DEBUG: catVar=' + catVar);
    console.log('DEBUG runTextMining: textVar=', textVar, 'catVar=', catVar);

    if (!textVar) {
        alert('テキスト変数を選択してください');
        return;
    }

    // UI Loading state
    const btn = document.getElementById('run-text-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    // Status callback for loading UI
    const updateStatus = (message) => {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    };
    updateStatus('解析エンジンを準備中...');


    // Clear previous results
    document.getElementById('analysis-results').style.display = 'block';
    const resultsArea = document.getElementById('analysis-results');
    resultsArea.innerHTML = ''; // Reset content

    // Create Tab Container
    resultsArea.innerHTML = `
        <div class="tab-container">
            <button class="tab-btn active" onclick="switchTab('tm-overall')">全体分析</button>
            <button class="tab-btn" id="tm-cat-tab-btn" onclick="switchTab('tm-category')" style="display: none;">カテゴリ別分析</button>
        </div>
        
        <div id="tm-overall" class="tab-content active">
            <div id="overall-results"></div>
        </div>
        
        <div id="tm-category" class="tab-content">
            <div id="category-controls" style="margin-bottom: 1rem;"></div>
            <div id="category-results"></div>
        </div>

        <!-- KWIC Panel -->
        <div class="kwic-overlay" id="kwic-overlay" onclick="closeKwicPanel()"></div>
        <div class="kwic-panel" id="kwic-panel">
            <div class="kwic-header">
                <div class="kwic-title">文脈検索 (KWIC)</div>
                <button class="kwic-close" onclick="closeKwicPanel()">&times;</button>
            </div>
            <div id="kwic-content"></div>
        </div>
    `;

    // Expose helpers globally
    window.switchTab = (tabId) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const btn = document.querySelector(`button[onclick="switchTab('${tabId}')"]`);
        if (btn) btn.classList.add('active');

        document.getElementById(tabId).classList.add('active');
    };

    window.closeKwicPanel = () => {
        document.getElementById('kwic-panel').classList.remove('open');
        document.getElementById('kwic-overlay').classList.remove('open');
    };

    try {
        if (!tokenizer) await initTokenizer(updateStatus);

        const allTextsWithId = currentData.map((d, i) => ({
            text: d[textVar],
            id: i,
            cat: catVar ? d[catVar] : null
        })).filter(d => d.text != null && d.text !== '');

        if (allTextsWithId.length === 0) throw new Error('有効なテキストデータがありません');
        updateStatus('テキストを解析中...');

        // 1. Overall Analysis
        const overallContainer = document.getElementById('overall-results');
        overallContainer.innerHTML = `<h4 style="color: #2d3748; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">全体分析 (N=${allTextsWithId.length})</h4>`;
        await analyzeAndRender(allTextsWithId, overallContainer, 'overall');

        // 2. Category Analysis (if selected)
        if (catVar) {
            document.getElementById('tm-cat-tab-btn').style.display = 'block';

            const categories = [...new Set(currentData.map(d => d[catVar]))].filter(v => v != null).sort();
            const catControls = document.getElementById('category-controls');

            // Category Selector
            const selectId = 'tm-cat-select';
            catControls.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <label for="${selectId}" style="font-weight: bold; color: #4a5568;">表示カテゴリ:</label>
                    <select id="${selectId}" style="max-width: 300px; padding: 0.5rem; border-radius: 6px; border: 1px solid #cbd5e0;">
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            `;

            const catResults = document.getElementById('category-results');

            // Function to render specific category
            const renderCategory = async (cat) => {
                catResults.innerHTML = '<div style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color: #1e90ff;"></i></div>';

                const catData = allTextsWithId.filter(d => d.cat === cat);

                if (catData.length > 0) {
                    catResults.innerHTML = ''; // Clear spinner
                    const sectionId = `cat-results-${cat}`;
                    const section = document.createElement('div');
                    section.id = sectionId;
                    section.innerHTML = `<h5 style="color: #1e90ff; font-weight: bold; margin-bottom: 1rem;">＜${cat}＞ (N=${catData.length})</h5>`;
                    catResults.appendChild(section);
                    await analyzeAndRender(catData, section, `cat-${cat.replace(/\s+/g, '_')}`);
                } else {
                    catResults.innerHTML = '<p class="text-muted">データがありません</p>';
                }
            };

            // Initial Render
            await renderCategory(categories[0]);

            // Change Event
            document.getElementById(selectId).addEventListener('change', (e) => {
                renderCategory(e.target.value);
            });
        }

    } catch (e) {
        console.error(e);
        alert('解析中にエラーが発生しました: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function analyzeAndRender(dataItems, container, prefix) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const allWords = [];
            const sentences = [];
            // Keep track of original text for KWIC
            const sentenceMap = []; // { tokens: [], original: text, id: rowIndex }

            dataItems.forEach(item => {
                const text = item.text;
                // Simple sentence splitting by punctuation
                const rawSentences = text.split(/[。！？\n]+/).filter(s => s.trim().length > 0);

                rawSentences.forEach(sent => {
                    const tokens = tokenizer.tokenize(sent);
                    const wordsInSentence = [];
                    tokens.forEach(token => {
                        if (['名詞', '動詞', '形容詞'].includes(token.pos) && token.surface_form.length > 1) {
                            const word = token.basic_form === '*' ? token.surface_form : token.basic_form;
                            allWords.push(word);
                            wordsInSentence.push(word);
                        }
                    });

                    if (wordsInSentence.length > 0) {
                        sentences.push(wordsInSentence);
                        sentenceMap.push({
                            original: sent,
                            words: new Set(wordsInSentence),
                            sourceId: item.id
                        });
                    }
                });
            });

            // Word Frequency
            const counts = {};
            allWords.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
            const sortedWords = Object.entries(counts).sort((a, b) => b[1] - a[1]);

            // Layout
            const wrapper = document.createElement('div');
            wrapper.className = 'grid-2-cols';
            wrapper.style.display = 'grid';
            wrapper.style.gridTemplateColumns = '1fr 1fr';
            wrapper.style.gap = '1.5rem';
            wrapper.style.marginBottom = '1.5rem';

            // WordCloud
            const wcId = `${prefix}-wordcloud`;
            const wcContainer = document.createElement('div');
            wcContainer.style.background = 'white';
            wcContainer.style.padding = '1rem';
            wcContainer.style.borderRadius = '8px';
            wcContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            wcContainer.innerHTML = `<h6 style="color: #4a5568; margin-bottom: 0.5rem; font-weight: bold;">ワードクラウド <small style="font-weight: normal; color: #718096;">(クリックで文脈表示)</small></h6><div style="position: relative;"><canvas id="${wcId}" style="width: 100%; height: 350px; cursor: pointer;"></canvas></div>`;

            // Network
            const netId = `${prefix}-network`;
            const netContainer = document.createElement('div');
            netContainer.style.background = 'white';
            netContainer.style.padding = '1rem';
            netContainer.style.borderRadius = '8px';
            netContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            netContainer.innerHTML = `<h6 style="color: #4a5568; margin-bottom: 0.5rem; font-weight: bold;">共起ネットワーク <small style="font-weight: normal; color: #718096;">(グループ別色分け)</small></h6><div id="${netId}" style="width: 100%; height: 350px; border: 1px solid #f0f0f0; border-radius: 4px;"></div>`;

            wrapper.appendChild(wcContainer);
            wrapper.appendChild(netContainer);
            container.appendChild(wrapper);

            // KWIC Handler
            const showKwic = (word) => {
                const results = sentenceMap.filter(s => s.words.has(word));
                const panel = document.getElementById('kwic-panel');
                const content = document.getElementById('kwic-content');

                content.innerHTML = `
                    <div style="margin-bottom: 1rem; color: #4a5568;">
                        「<span style="font-weight: bold; color: #1e90ff;">${word}</span>」を含む文 (${results.length}件)
                    </div>
                    <ul class="kwic-list">
                        ${results.slice(0, 100).map(r => `
                            <li class="kwic-item">
                                ${r.original.replace(word, `<span class="kwic-keyword">${word}</span>`)}
                            </li>
                        `).join('')}
                    </ul>
                    ${results.length > 100 ? '<p style="text-align: center; color: #718096; font-size: 0.8rem;">(上位100件を表示)</p>' : ''}
                `;

                panel.classList.add('open');
                document.getElementById('kwic-overlay').classList.add('open');
            };

            // 1. Render Word Cloud
            displayWordCloud(wcId, sortedWords, showKwic);

            // 2. Render Network
            const topWordsForNet = sortedWords.slice(0, 50).map(x => x[0]);
            plotCooccurrenceNetwork(netId, sentences, topWordsForNet, showKwic);

            resolve();
        }, 10);
    });
}

function displayWordCloud(canvasId, wordCounts, onClick) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = canvas.parentElement.offsetWidth || 500;
    canvas.height = 350;

    const list = wordCounts.slice(0, 70).map(([w, c]) => [w, c]);

    WordCloud(canvas, {
        list: list,
        gridSize: 8,
        weightFactor: size => Math.pow(size, 0.7) * 12,
        fontFamily: 'sans-serif',
        color: 'random-dark',
        backgroundColor: '#fafbfc',
        rotateRatio: 0,
        shuffle: false,
        click: (item) => {
            if (item && item[0]) onClick(item[0]);
        },
        hover: window.drawBox ? window.drawBox : undefined // Optional hover effect
    });
}

function plotCooccurrenceNetwork(containerId, sentences, topWords, onClick) {
    // 1. Jaccard & Edge Construction
    const edges = [];
    const wordPresence = {};
    topWords.forEach(w => { wordPresence[w] = new Set(); });

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

            let intersection = 0;
            set1.forEach(id => { if (set2.has(id)) intersection++; });

            if (intersection > 0) {
                const union = new Set([...set1, ...set2]).size;
                const jaccard = intersection / union;
                if (jaccard > 0.1) { // Threshold
                    edges.push({ from: w1, to: w2, weight: jaccard });
                }
            }
        }
    }

    // Sort edges
    edges.sort((a, b) => b.weight - a.weight);
    const topEdges = edges.slice(0, 80); // Keep reasonable number

    // Identify active nodes
    const activeWords = new Set();
    topEdges.forEach(e => { activeWords.add(e.from); activeWords.add(e.to); });
    const nodesList = Array.from(activeWords);

    // --- Community Detection (Simple Connected Components Logic or modularity-like) ---
    // For simplicity and dependency-free, let's use a simple label propagation-like approach or greedly assign classes
    // Here we use a predefined color palette
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98FB98', '#DDA0DD', '#F0E68C'];
    const nodeGroups = {};

    // Initialize groups
    nodesList.forEach((n, i) => nodeGroups[n] = i);

    // Simple propagation (merge groups connected by strong edges)
    // Run a few passes
    for (let pass = 0; pass < 3; pass++) {
        topEdges.forEach(e => {
            const g1 = nodeGroups[e.from];
            const g2 = nodeGroups[e.to];
            if (g1 !== g2) {
                // Merge to smaller group id usually, or just min
                const minG = Math.min(g1, g2);
                nodeGroups[e.from] = minG;
                nodeGroups[e.to] = minG;
            }
        });
    }

    // Remap groups to 0..N for coloring
    const uniqueGroups = [...new Set(Object.values(nodeGroups))];
    const groupMap = {};
    uniqueGroups.forEach((g, i) => groupMap[g] = i % colors.length);

    const nodes = nodesList.map(id => ({
        id,
        label: id,
        value: topEdges.filter(e => e.from === id || e.to === id).length * 5 + 5,
        color: {
            background: colors[groupMap[nodeGroups[id]]],
            border: '#ffffff',
            highlight: { background: colors[groupMap[nodeGroups[id]]], border: '#1e90ff' }
        },
        font: { size: 16, color: '#333', strokeWidth: 2, strokeColor: '#fff' }
    }));

    // Render
    const container = document.getElementById(containerId);
    if (!container) return;

    const navData = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(topEdges.map(e => ({
            from: e.from, to: e.to, value: e.weight,
            title: `Jaccard: ${e.weight.toFixed(3)}`,
            color: { color: '#cbd5e0', highlight: '#1e90ff' }
        })))
    };

    const options = {
        nodes: { shape: 'dot', scaling: { min: 10, max: 40 } },
        edges: { smooth: { type: 'continuous' } },
        physics: {
            forceAtlas2Based: { gravitationalConstant: -100, centralGravity: 0.01, springConstant: 0.08, springLength: 100, damping: 0.4 },
            minVelocity: 0.75,
            solver: 'forceAtlas2Based',
            stabilization: { enabled: true, iterations: 1000 }
        },
        interaction: { hover: true }
    };

    const network = new vis.Network(container, navData, options);

    network.on("click", function (params) {
        if (params.nodes.length > 0) {
            onClick(params.nodes[0]);
        }
    });
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

            <div class="collapsible-section info-sections" style="margin-bottom: 2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> テキストマイニングとは？</strong>
                        <p>大量のテキストデータから有用な情報やパターンを抽出する分析手法です。自然言語処理技術を用いて、テキストに含まれる単語の頻度や関係性を可視化します。</p>
                    </div>
                    <h4>分析結果の見方</h4>
                    <ul>
                        <li><strong>ワードクラウド:</strong> 頻出する単語を大きく表示します。<strong>単語をクリックすると、その単語を含む元の文が表示されます（KWIC）。</strong></li>
                        <li><strong>共起ネットワーク:</strong> 関連性の強い単語を線で結びます。<strong>同じ色のノードは、似た文脈で使われる「グループ（コミュニティ）」を表します。</strong></li>
                    </ul>
                    <h4>対象となる品詞</h4>
                    <p>分析では<strong>名詞・動詞・形容詞</strong>を抽出します。助詞や記号などは自動的に除外されます。</p>
                </div>
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
            <div id="analysis-results" style="display: none;"></div>
            
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
    createVariableSelector('category-var-container', categoricalColumns, 'category-var', {
        label: '<i class="fas fa-layer-group"></i> カテゴリ変数（任意・比較用）:',
        multiple: false,
        placeholder: '選択なし（全体分析のみ）'
    });

    createAnalysisButton('run-text-btn-container', '分析を実行', () => runTextMining(currentData), { id: 'run-text-btn' });
}
