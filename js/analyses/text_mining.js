import { renderDataOverview, createVariableSelector, createAnalysisButton } from '../utils.js';
import {
    initTokenizer as initTokenizerHelper,
    downloadCanvasAsImage,
    getTokenizer,
    tokenizeDocument,
    splitTextIntoSentences,
    computeTermMetrics,
    buildCooccurrenceEdges
} from './text_mining/helpers.js';
import { displayWordCloud } from './text_mining/visualization.js';

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
        if (!getTokenizer()) await initTokenizerHelper(updateStatus);

        const allTextsWithId = currentData.map((d, i) => ({
            text: d[textVar],
            id: i,
            cat: catVar ? d[catVar] : null
        })).filter(d => d.text != null && d.text !== '');

        if (allTextsWithId.length === 0) throw new Error('有効なテキストデータがありません');
        updateStatus('テキストを解析中...');

        const tokenizer = getTokenizer();
        const globalDocuments = allTextsWithId.map(item => tokenizeDocument(item.text, tokenizer));
        const globalTermMetrics = computeTermMetrics(globalDocuments);

        // 1. Overall Analysis
        const overallContainer = document.getElementById('overall-results');
        overallContainer.innerHTML = `<h4 style="color: #2d3748; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">全体分析 (N=${allTextsWithId.length})</h4>`;
        await analyzeAndRender(allTextsWithId, overallContainer, 'overall', { globalTermMetrics });

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
                        ${categories.map(c => `<option value="${escapeAttribute(c)}">${escapeHtml(c)}</option>`).join('')}
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
                    const sectionId = `cat-results-${sanitizeId(cat)}`;
                    const section = document.createElement('div');
                    section.id = sectionId;
                    section.innerHTML = `<h5 style="color: #1e90ff; font-weight: bold; margin-bottom: 1rem;">＜${escapeHtml(cat)}＞ (N=${catData.length})</h5>`;
                    catResults.appendChild(section);
                    await analyzeAndRender(catData, section, `cat-${sanitizeId(cat)}`, { globalTermMetrics });
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

async function analyzeAndRender(dataItems, container, prefix, options = {}) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const tokenizer = getTokenizer();
            if (!tokenizer) {
                resolve();
                return;
            }

            const allWords = [];
            const sentences = [];
            const sentenceMap = [];

            // 1行＝1文書としてトークン配列を構築（TF-IDF用）
            const documents = dataItems.map(item => tokenizeDocument(item.text, tokenizer));
            const globalIdf = options.globalTermMetrics?.termIdf || null;

            dataItems.forEach(item => {
                const text = item.text;
                const rawSentences = splitTextIntoSentences(text);

                rawSentences.forEach(sent => {
                    const wordsInSentence = tokenizeDocument(sent, tokenizer);
                    allWords.push(...wordsInSentence);

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

            const counts = {};
            allWords.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
            const sortedWords = Object.entries(counts).sort((a, b) => b[1] - a[1]);

            const { termTfIdf, termDf, termFreq } = computeTermMetrics(documents, { idfLookup: globalIdf });
            const tfidfMap = new Map(termTfIdf);

            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '1.5rem';
            wrapper.style.marginBottom = '1.5rem';

            // 単語重要度テーブル（出現回数 + TF-IDF）
            const tableId = `${prefix}-term-table`;
            const tableContainer = document.createElement('div');
            tableContainer.style.background = 'white';
            tableContainer.style.padding = '1rem';
            tableContainer.style.borderRadius = '8px';
            tableContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            tableContainer.innerHTML = `
                <h6 style="color: #4a5568; margin: 0 0 0.5rem 0; font-weight: bold;">単語の重要度（出現回数・TF-IDF）</h6>
                <div style="max-height: 220px; overflow-y: auto;">
                    <table class="data-table" style="width: 100%; font-size: 0.9rem;">
                        <thead><tr><th>単語</th><th>出現回数</th><th>出現文書数</th><th>TF-IDF重み</th></tr></thead>
                        <tbody id="${tableId}-body"></tbody>
                    </table>
                </div>
            `;
            const tableBody = tableContainer.querySelector(`#${tableId}-body`);
            const termsForTable = termTfIdf.length > 0 ? termTfIdf : sortedWords.map(([w]) => [w, 0]);
            tableBody.innerHTML = termsForTable.slice(0, 100).map(([w]) => {
                const freq = termFreq[w] != null ? termFreq[w] : (counts[w] || 0);
                const df = termDf[w] != null ? termDf[w] : '-';
                const tfidfVal = tfidfMap.has(w) ? tfidfMap.get(w).toFixed(4) : '-';
                return `<tr><td>${escapeHtml(w)}</td><td>${freq}</td><td>${df}</td><td>${tfidfVal}</td></tr>`;
            }).join('');

            wrapper.appendChild(tableContainer);

            const wcId = `${prefix}-wordcloud`;
            const wcContainer = document.createElement('div');
            wcContainer.style.background = 'white';
            wcContainer.style.padding = '1rem';
            wcContainer.style.borderRadius = '8px';
            wcContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            wcContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h6 style="color: #4a5568; margin: 0; font-weight: bold;">ワードクラウド（出現回数） <small style="font-weight: normal; color: #718096;">(クリックで文脈表示)</small></h6>
                    <button class="download-btn" data-target="${wcId}" style="background: #4299e1; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-download"></i> 画像保存
                    </button>
                </div>
                <div style="position: relative;">
                    <canvas id="${wcId}" style="width: 100%; height: 400px; cursor: pointer;"></canvas>
                </div>`;

            const wcTfIdfId = `${prefix}-wordcloud-tfidf`;
            const wcTfIdfContainer = document.createElement('div');
            wcTfIdfContainer.style.background = 'white';
            wcTfIdfContainer.style.padding = '1rem';
            wcTfIdfContainer.style.borderRadius = '8px';
            wcTfIdfContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            wcTfIdfContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h6 style="color: #4a5568; margin: 0; font-weight: bold;">ワードクラウド（TF-IDF重み） <small style="font-weight: normal; color: #718096;">(クリックで文脈表示)</small></h6>
                    <button class="download-btn" data-target="${wcTfIdfId}" style="background: #4299e1; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-download"></i> 画像保存
                    </button>
                </div>
                <div style="position: relative;">
                    <canvas id="${wcTfIdfId}" style="width: 100%; height: 400px; cursor: pointer;"></canvas>
                </div>`;

            const netId = `${prefix}-network`;
            const netContainer = document.createElement('div');
            netContainer.style.background = 'white';
            netContainer.style.padding = '1rem';
            netContainer.style.borderRadius = '8px';
            netContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            netContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h6 style="color: #4a5568; margin: 0; font-weight: bold;">共起ネットワーク <small style="font-weight: normal; color: #718096;">(グループ別色分け)</small></h6>
                    <button class="download-btn" data-target="${netId}" style="background: #4299e1; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-download"></i> 画像保存
                    </button>
                </div>
                <div id="${netId}" style="width: 100%; height: 450px; border: 1px solid #f0f0f0; border-radius: 4px;"></div>`;

            wrapper.appendChild(wcContainer);
            wrapper.appendChild(wcTfIdfContainer);
            wrapper.appendChild(netContainer);
            container.appendChild(wrapper);

            wrapper.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    downloadCanvasAsImage(btn.dataset.target);
                });
            });

            const showKwic = (word) => {
                const results = sentenceMap.filter(s => s.words.has(word));
                const panel = document.getElementById('kwic-panel');
                const content = document.getElementById('kwic-content');

                const safeWord = escapeHtml(word);
                content.innerHTML = `
                    <div style="margin-bottom: 1rem; color: #4a5568;">
                        「<span style="font-weight: bold; color: #1e90ff;">${safeWord}</span>」を含む文 (${results.length}件)
                    </div>
                    <ul class="kwic-list">
                        ${results.slice(0, 100).map(r => {
                            const safeOriginal = escapeHtml(r.original);
                            return `<li class="kwic-item">${safeOriginal.replace(safeWord, '<span class="kwic-keyword">' + safeWord + '</span>')}</li>`;
                        }).join('')}
                    </ul>
                    ${results.length > 100 ? '<p style="text-align: center; color: #718096; font-size: 0.8rem;">(上位100件を表示)</p>' : ''}
                `;

                panel.classList.add('open');
                document.getElementById('kwic-overlay').classList.add('open');
            };

            displayWordCloud(wcId, sortedWords, showKwic);

            const positiveTfIdfTerms = termTfIdf.filter(([, v]) => v > 0);
            if (positiveTfIdfTerms.length > 0) {
                displayWordCloud(wcTfIdfId, positiveTfIdfTerms.map(([w, v]) => [w, v]), showKwic);
            } else {
                const canvas = document.getElementById(wcTfIdfId);
                if (canvas) {
                    const scale = 3;
                    const width = Math.max(420, Math.round(canvas.parentElement?.clientWidth || canvas.parentElement?.getBoundingClientRect().width || 720));
                    const height = 400;
                    const ctx = canvas.getContext('2d');
                    canvas.width = width * scale;
                    canvas.height = height * scale;
                    canvas.style.width = `${width}px`;
                    canvas.style.height = `${height}px`;
                    ctx.fillStyle = '#fafbfc';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#718096';
                    ctx.font = `${14 * scale}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('TF-IDFで特徴的な語はありません', canvas.width / 2, canvas.height / 2);
                }
            }

            const topWordsForNet = sortedWords.slice(0, 50).map(x => x[0]);
            plotCooccurrenceNetwork(netId, sentences, topWordsForNet, showKwic);

            resolve();
        }, 10);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttribute(str) {
    return escapeHtml(String(str)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeId(value) {
    return String(value)
        .normalize('NFKC')
        .replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'category';
}

function renderEmptyNetworkCanvas(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const scale = 3;
    const width = Math.max(420, Math.round(container.clientWidth || container.getBoundingClientRect().width || 720));
    const height = 450;
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = `${14 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('表示できる共起関係がありません', canvas.width / 2, canvas.height / 2);
}

function plotCooccurrenceNetwork(containerId, sentences, topWords, onClick) {
    const topEdges = buildCooccurrenceEdges(sentences, topWords, { threshold: 0.1, maxEdges: 80 });

    if (topEdges.length === 0) {
        renderEmptyNetworkCanvas(containerId);
        return;
    }

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

    const weightedDegrees = {};
    nodesList.forEach(id => { weightedDegrees[id] = 0; });
    topEdges.forEach(e => {
        weightedDegrees[e.from] = (weightedDegrees[e.from] || 0) + e.weight;
        weightedDegrees[e.to] = (weightedDegrees[e.to] || 0) + e.weight;
    });
    const maxWeightedDegree = Math.max(...Object.values(weightedDegrees), 1);

    const nodes = nodesList.map(id => ({
        id,
        label: id,
        value: (weightedDegrees[id] / maxWeightedDegree) * 50 + 10,
        color: {
            background: colors[groupMap[nodeGroups[id]]],
            border: '#ffffff',
            highlight: { background: colors[groupMap[nodeGroups[id]]], border: '#1e90ff' }
        },
        font: { size: 24, color: '#333', strokeWidth: 4, strokeColor: '#fff' }
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
        layout: { randomSeed: 42, improvedLayout: true },
        nodes: { shape: 'dot', scaling: { min: 15, max: 60 } },
        edges: { smooth: { type: 'continuous' }, scaling: { min: 1, max: 8 } },
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

    // 高画質ダウンロードの実装（隠しコンテナでの再レンダリング）
    const downloadBtn = document.querySelector(`.download-btn[data-target="${containerId}"]`);
    if (downloadBtn) {
        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `network_${timestamp}.png`;

            // 隠しコンテナ作成 (3倍サイズ)
            const hiddenContainer = document.createElement('div');
            hiddenContainer.style.position = 'fixed';
            hiddenContainer.style.left = '-9999px';
            hiddenContainer.style.top = '-9999px';
            hiddenContainer.style.width = '2400px';
            hiddenContainer.style.height = '1350px';
            document.body.appendChild(hiddenContainer);

            // オプションのスケーリング (x3)
            const SCALE = 3;
            const highResOptions = JSON.parse(JSON.stringify(options));
            // デフォルトラベルを非表示（カスタム描画するため）
            if (!highResOptions.nodes.font) highResOptions.nodes.font = {};
            highResOptions.nodes.font.size = 0;
            highResOptions.nodes.font.color = 'rgba(0,0,0,0)';

            if (highResOptions.nodes.font) {
                highResOptions.nodes.font.size = (highResOptions.nodes.font.size || 14) * SCALE;
                highResOptions.nodes.font.strokeWidth = (highResOptions.nodes.font.strokeWidth || 0) * SCALE;
            }
            if (highResOptions.nodes.scaling) {
                highResOptions.nodes.scaling.min *= SCALE;
                highResOptions.nodes.scaling.max *= SCALE;
            }

            // 物理演算パラメータのスケーリング (重要: ノード間の距離を広げる)
            if (highResOptions.physics && highResOptions.physics.forceAtlas2Based) {
                const fa = highResOptions.physics.forceAtlas2Based;

                // バネの長さを広げる
                fa.springLength = (fa.springLength || 300) * SCALE;

                // 反発力(gravitationalConstant)も強めて、より広がりやすくする
                fa.gravitationalConstant = (fa.gravitationalConstant || -2500) * SCALE;

                highResOptions.physics.stabilization = { enabled: true, iterations: 2000, fit: true };
            }
            // ラベル重複描画を防ぐため、描画用データセットのラベルを空にする
            // (vis-networkのデフォルト描画を完全に無効化)
            const hdNavData = {
                nodes: new vis.DataSet(navData.nodes.map(n => ({ ...n, label: " " }))), // 空文字だとIDが出る場合があるのでスペース
                edges: new vis.DataSet(navData.edges.get())
            };

            // 高画質ネットワーク生成
            const hdNetwork = new vis.Network(hiddenContainer, hdNavData, highResOptions);

            // 安定化計算（物理演算）完了を待つ
            hdNetwork.once("stabilizationIterationsDone", () => {
                hdNetwork.fit({ animation: false });

                hdNetwork.once("afterDrawing", (ctx) => {
                    // 1. 白背景合成
                    const tempCanvas = document.createElement('canvas');
                    const width = ctx.canvas.width;
                    const height = ctx.canvas.height;

                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const tempCtx = tempCanvas.getContext('2d');

                    tempCtx.fillStyle = '#ffffff';
                    tempCtx.fillRect(0, 0, width, height);

                    // ネットワーク描画 (等倍コピー)
                    tempCtx.drawImage(ctx.canvas, 0, 0);

                    // 2. ラベルをノード中央にカスタム描画
                    // 元のデータ(navData)からラベル情報を取得して描画する

                    // Retina Display 対応 (pixelRatioによるスケーリング補正)
                    // hiddenContainerの論理サイズを取得し、Canvasの物理サイズとの比率を計算
                    const domWidth = parseFloat(hiddenContainer.style.width) || 2400; // 2400px指定済み
                    const pixelRatio = width / domWidth;

                    tempCtx.save();
                    // 座標系を論理ピクセルに合わせる (getPositions()の戻り値は論理座標)
                    tempCtx.scale(pixelRatio, pixelRatio);

                    const positions = hdNetwork.getPositions();
                    tempCtx.textAlign = 'center';
                    tempCtx.textBaseline = 'middle';
                    tempCtx.lineJoin = 'round';

                    navData.nodes.forEach(node => {
                        const pos = positions[node.id];
                        if (!pos) return;

                        // 重要: シミュレーション座標(pos)をDOM座標(画面上のピクセル位置)に変換する
                        // fit()によるズームやパンを反映させるために必須
                        const domPos = hdNetwork.canvasToDOM(pos);

                        // ノードのサイズからフォントサイズを決定
                        const box = hdNetwork.getBoundingBox(node.id);
                        const width = box.right - box.left;

                        // 直径の40%程度を基本とするが、最低サイズを大きく確保
                        const minSize = 16 * SCALE;
                        let fontSize = Math.max(minSize, width * 0.25);

                        // フォント設定
                        tempCtx.font = `bold ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
                        tempCtx.lineWidth = fontSize * 0.15; // 縁取りの太さ

                        // 白縁取り + 黒文字
                        tempCtx.strokeStyle = '#ffffff';
                        tempCtx.fillStyle = '#333333';

                        tempCtx.strokeText(node.label, domPos.x, domPos.y);
                        tempCtx.fillText(node.label, domPos.x, domPos.y);
                    });

                    tempCtx.restore(); // スケーリング解除

                    const dataUrl = tempCanvas.toDataURL("image/png");

                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = dataUrl;
                    link.click();

                    setTimeout(() => {
                        hdNetwork.destroy();
                        if (document.body.contains(hiddenContainer)) {
                            document.body.removeChild(hiddenContainer);
                        }
                    }, 1000);
                });
            });
        });
    }
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
                        <li><strong>単語の重要度テーブル:</strong> 各単語の出現回数・出現文書数・TF-IDF重みを表示します。TF-IDFは文書長で調整した出現割合に、全体データでの珍しさ（IDF）を掛けた値です。カテゴリ別分析でも全体データのIDFを使うため、カテゴリ間で特徴語を比較しやすくしています。</li>
                        <li><strong>ワードクラウド（出現回数 / TF-IDF）:</strong> 単語を大きく表示します。出現回数版とTF-IDF重み版の2種類があります。<strong>単語をクリックすると、その単語を含む元の文が表示されます（KWIC）。</strong></li>
                        <li><strong>共起ネットワーク:</strong> 同じ文に一緒に出た単語を、文集合の重なり（Jaccard係数）で線として結びます。<strong>同じ色のノードは、似た文脈で使われる「グループ（コミュニティ）」を表します。</strong></li>
                    </ul>
                    <h4>対象となる単語</h4>
                    <p>分析では表記を正規化したうえで、<strong>2文字以上の主要な単語</strong>を抽出します（一般的なストップワード、数字のみの語、記号は自動的に除外されます）。</p>
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

            <!-- データ概要 -->
            <div id="tm-data-overview" class="info-sections" style="margin-bottom: 2rem;"></div>

            <!-- 結果エリア -->
            <div id="analysis-results" style="display: none;"></div>
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
