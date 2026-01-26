import { renderDataOverview, createVariableSelector, createAnalysisButton, renderSampleSizeInfo } from '../utils.js';

let tokenizer = null;

// ストップワードリスト（日本語の助詞・助動詞・記号など除外用）
const STOP_WORDS = new Set([
    // 助詞
    'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
    'ある', 'いる', 'も', 'な', 'する', 'から', 'こと', 'として', 'い', 'や',
    'ない', 'この', 'ため', 'その', 'あと', 'よう', 'また', 'もの', 'という',
    'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ', 'によって',
    'により', 'おり', 'ね', 'よ', 'けど', 'でも', 'って', 'ので', 'なら',
    'でした', 'ます', 'です', 'ました', 'ません', 'ですが', 'ですね', 'ですよ',
    // ひらがな1文字（ほとんど助詞）
    'あ', 'い', 'う', 'え', 'お', 'ん',
    // 数字・記号
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // その他一般的すぎる語
    'それ', 'これ', 'あれ', 'どれ', 'なに', 'どう', 'そう', 'ああ',
    'とき', 'ところ', 'ほう', 'ほど', 'まま', 'よる', 'なか', 'うち'
]);

// 画像ダウンロード機能
function downloadCanvasAsImage(targetId) {
    // ワードクラウドの場合はcanvas要素、共起ネットワークの場合はvis-network内のcanvas
    let canvas = document.getElementById(targetId);

    // vis-networkの場合、内部のcanvasを取得
    if (!canvas || canvas.tagName !== 'CANVAS') {
        const container = document.getElementById(targetId);
        if (container) {
            canvas = container.querySelector('canvas');
        }
    }

    if (!canvas) {
        alert('画像の取得に失敗しました。');
        return;
    }

    try {
        // 白背景のCanvasを作成して合成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');

        // 白背景で塗りつぶし
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 元の画像を重ねる
        ctx.drawImage(canvas, 0, 0);

        // ダウンロード処理
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = targetId.includes('wordcloud') ? `wordcloud_${timestamp}.png` : `network_${timestamp}.png`;

        link.download = filename;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        alert('画像のダウンロードに失敗しました。');
    }
}

async function initTokenizer(statusCallback) {
    return new Promise((resolve, reject) => {
        try {
            if (statusCallback) statusCallback('解析エンジンを初期化中...');

            // TinySegmenter は辞書不要で即座に初期化可能
            if (typeof TinySegmenter === 'undefined') {
                reject(new Error('TinySegmenter ライブラリが読み込まれていません'));
                return;
            }

            tokenizer = new TinySegmenter();
            if (statusCallback) statusCallback('解析エンジンの準備完了！');
            console.log('TinySegmenter tokenizer ready');
            resolve();
        } catch (err) {
            console.error('TinySegmenter Init Error:', err);
            if (statusCallback) statusCallback('解析エンジンの初期化に失敗しました。');
            reject(new Error('形態素解析エンジンの初期化に失敗しました: ' + err.message));
        }
    });
}

async function runTextMining(currentData) {
    const textVar = document.getElementById('text-var').value;
    const catVar = document.getElementById('category-var').value;
    // alert('DEBUG: catVar=' + catVar); // Removed debug alert
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
                    // TinySegmenter.segment() returns an array of strings
                    const tokens = tokenizer.segment(sent);
                    const wordsInSentence = [];
                    tokens.forEach(word => {
                        // フィルタリング: 2文字以上、ストップワードでない、ひらがなのみでない
                        const isStopWord = STOP_WORDS.has(word);
                        const isOnlyHiragana = /^[ぁ-ん]+$/.test(word) && word.length <= 2;
                        const isOnlySymbols = /^[、。！？「」『』（）・\s]+$/.test(word);

                        if (word.length > 1 && !isStopWord && !isOnlyHiragana && !isOnlySymbols) {
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

            // Layout - 1列表示に変更
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '1.5rem';
            wrapper.style.marginBottom = '1.5rem';

            // WordCloud Section
            const wcId = `${prefix}-wordcloud`;
            const wcContainer = document.createElement('div');
            wcContainer.style.background = 'white';
            wcContainer.style.padding = '1rem';
            wcContainer.style.borderRadius = '8px';
            wcContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            wcContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h6 style="color: #4a5568; margin: 0; font-weight: bold;">ワードクラウド <small style="font-weight: normal; color: #718096;">(クリックで文脈表示)</small></h6>
                    <button class="download-btn" data-target="${wcId}" style="background: #4299e1; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-download"></i> 画像保存
                    </button>
                </div>
                <div style="position: relative;">
                    <canvas id="${wcId}" style="width: 100%; height: 400px; cursor: pointer;"></canvas>
                </div>`;

            // Network Section
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
            wrapper.appendChild(netContainer);
            container.appendChild(wrapper);

            // ダウンロードボタンのイベントハンドラ
            wrapper.querySelectorAll('.download-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = btn.dataset.target;
                    downloadCanvasAsImage(targetId);
                });
            });

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

    const SCALE = 3; // 高画質化のためのスケール倍率
    const width = canvas.parentElement.offsetWidth || 500;
    const height = 400;

    // 内部解像度を上げる
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;

    // 表示サイズはCSSで制御
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const list = wordCounts.slice(0, 70).map(([w, c]) => [w, c]);

    WordCloud(canvas, {
        list: list,
        gridSize: 8 * SCALE, // グリッドサイズもスケール
        weightFactor: size => Math.pow(size, 0.7) * 18 * SCALE, // 文字サイズもスケール
        minSize: 10 * SCALE, // 最小サイズもスケール
        fontFamily: 'sans-serif',
        color: 'random-dark',
        backgroundColor: '#fafbfc',
        rotateRatio: 0,
        click: (item) => {
            if (item && item[0]) onClick(item[0]);
        },
        hover: window.drawBox ? window.drawBox : undefined
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
        nodes: { shape: 'dot', scaling: { min: 15, max: 60 } },
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
                        <li><strong>ワードクラウド:</strong> 頻出する単語を大きく表示します。<strong>単語をクリックすると、その単語を含む元の文が表示されます（KWIC）。</strong></li>
                        <li><strong>共起ネットワーク:</strong> 関連性の強い単語を線で結びます。<strong>同じ色のノードは、似た文脈で使われる「グループ（コミュニティ）」を表します。</strong></li>
                    </ul>
                    <h4>対象となる品詞</h4>
                    <p>分析では<strong>2文字以上の主要な単語</strong>を抽出します（一般的な助詞や記号は自動的に除外されます）。</p>
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
