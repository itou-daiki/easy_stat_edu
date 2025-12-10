import { currentData } from '../main.js';
import { showError, renderDataPreview, renderSummaryStatistics } from '../utils.js';

export function render(container, characteristics) {
    const { textColumns, categoricalColumns } = characteristics;

    if (!textColumns || textColumns.length === 0) {
        container.innerHTML = '<p class="error-message">分析対象となるテキストデータ（文字列型の列）が見つかりません。</p>';
        return;
    }

    const textOptions = textColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    const catOptions = ['<option value="">(なし) 全体のみ分析</option>']
        .concat(categoricalColumns.map(col => `<option value="${col}">${col}</option>`))
        .join('');

    container.innerHTML = `
        <div class="analysis-controls">
            <div class="control-group">
                <label for="tm-text-col">分析対象のテキスト列:</label>
                <select id="tm-text-col">${textOptions}</select>
            </div>
            <div class="control-group">
                <label for="tm-cat-col">カテゴリ変数 (任意):</label>
                <select id="tm-cat-col">${catOptions}</select>
            </div>
            <div class="control-group">
                <label>設定:</label>
                <label><input type="checkbox" id="tm-use-sample" checked> 名詞・動詞・形容詞のみ抽出</label>
            </div>
            <button id="run-tm-btn" class="btn-analysis">分析を実行</button>
        </div>
        <div id="tm-results" class="analysis-results"></div>
    `;

    document.getElementById('run-tm-btn').addEventListener('click', () => {
        const textCol = document.getElementById('tm-text-col').value;
        const catCol = document.getElementById('tm-cat-col').value;
        runTextMining(textCol, catCol);
    });
}

// Global Tokenizer Cache
let tokenizerInstance = null;
const getTokenizer = () => new Promise((resolve, reject) => {
    if (tokenizerInstance) return resolve(tokenizerInstance);
    kuromoji.builder({ dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' }).build((err, tokenizer) => {
        if (err) return reject(err);
        tokenizerInstance = tokenizer;
        resolve(tokenizer);
    });
});

async function runTextMining(textColumn, catColumn) {
    const resultsContainer = document.getElementById('tm-results');
    const btn = document.getElementById('run-tm-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    resultsContainer.innerHTML = '<div class="loading-message"><i class="fas fa-cog fa-spin"></i> 解析エンジンを起動中...</div>';

    try {
        const tokenizer = await getTokenizer();
        resultsContainer.innerHTML = '<div class="loading-message"><i class="fas fa-tasks"></i> テキスト解析中...</div>';

        // Helper: Extract words from text (returns array of words)
        const processText = (text) => {
            if (!text || typeof text !== 'string') return [];
            const tokens = tokenizer.tokenize(text);
            return tokens
                .filter(t => ['名詞', '動詞', '形容詞'].includes(t.pos) && t.pos_detail_1 !== '非自立') // Exclude non-independent
                .map(t => t.basic_form); // Use basic form
        };

        // 1. Process All Data
        const allDocs = []; // Array of word arrays
        const categories = {}; // Map catValue -> [docIndices]

        currentData.forEach((row, idx) => {
            const words = processText(row[textColumn]);
            if (words.length > 0) {
                allDocs.push({ idx, words, cat: catColumn ? row[catColumn] : 'All' });
                const catVal = catColumn ? row[catColumn] : 'All';
                if (!categories[catVal]) categories[catVal] = [];
                categories[catVal].push(words);
            }
        });

        resultsContainer.innerHTML = '<h4>テキストマイニング結果</h4>';

        // 2. Overall Analysis
        resultsContainer.innerHTML += '<h5>全体分析</h5>';
        const allWordsFlat = allDocs.flatMap(d => d.words);
        await renderAnalysisSection(resultsContainer, 'tm-overall', allWordsFlat, allDocs.map(d => d.words));

        // 3. Category Analysis
        if (catColumn) {
            for (const [catVal, docs] of Object.entries(categories)) {
                resultsContainer.innerHTML += `<hr><h5>カテゴリ: ${catVal}</h5>`;
                const catWordsFlat = docs.flat();
                await renderAnalysisSection(resultsContainer, `tm-cat-${catVal.replace(/\s+/g, '-')}`, catWordsFlat, docs);
            }
        }

    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML = `<p class="error-message">エラーが発生しました: ${e.message}</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '分析を実行';
    }
}

async function renderAnalysisSection(container, idPrefix, allWords, docs) {
    // A. Word Frequencies
    const freqMap = {};
    allWords.forEach(w => freqMap[w] = (freqMap[w] || 0) + 1);
    const sortedFreq = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
    const topWords = sortedFreq.slice(0, 60).map(e => e[0]); // Top 60 for Network

    // UI Structure
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'tm-section row';
    sectionDiv.innerHTML = `
        <div class="col-md-6">
            <h6>ワードクラウド</h6>
            <div id="${idPrefix}-wc" style="width:100%; height:300px; border:1px solid #ddd;"></div>
            <h6 class="mt-3">頻度トップ10</h6>
            <table class="table table-sm text-sm">
                <thead><tr><th>単語</th><th>頻度</th></tr></thead>
                <tbody>${sortedFreq.slice(0, 10).map(([w, c]) => `<tr><td>${w}</td><td>${c}</td></tr>`).join('')}</tbody>
            </table>
        </div>
        <div class="col-md-6">
            <h6>共起ネットワーク (Top 60語)</h6>
            <div id="${idPrefix}-net" style="width:100%; height:450px; border:1px solid #ddd;"></div>
        </div>
    `;
    container.appendChild(sectionDiv);

    // B. Render Word Cloud
    const wcCanvas = document.createElement('canvas');
    wcCanvas.width = 500;
    wcCanvas.height = 300;
    document.getElementById(`${idPrefix}-wc`).appendChild(wcCanvas);

    WordCloud(wcCanvas, {
        list: sortedFreq.slice(0, 100), // Top 100 for WC
        gridSize: 8,
        weightFactor: (size) => Math.pow(size, 0.8) * 8,
        fontFamily: 'Inter, sans-serif',
        color: 'random-dark',
        rotateRatio: 0.5,
        backgroundColor: '#fff'
    });

    // C. Co-occurrence Network
    // Calculate Jaccard or Counts between Top 60 words
    const nodes = topWords.map(w => ({ id: w, count: freqMap[w] }));
    const edges = [];

    // Simple co-occurrence count in documents
    // Jaccard(A,B) = |A n B| / |A u B|
    // A = set of docs containing word A
    const docSets = {};
    topWords.forEach(w => docSets[w] = new Set());

    docs.forEach((docWords, docId) => {
        const uniqueWords = new Set(docWords);
        uniqueWords.forEach(w => {
            if (docSets[w]) docSets[w].add(docId);
        });
    });

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const w1 = nodes[i].id;
            const w2 = nodes[j].id;
            const set1 = docSets[w1];
            const set2 = docSets[w2];

            // Intersection
            let intersection = 0;
            set1.forEach(id => { if (set2.has(id)) intersection++; });

            // Union
            const union = set1.size + set2.size - intersection;
            const jaccard = union === 0 ? 0 : intersection / union;

            if (jaccard > 0.05) { // Threshold
                edges.push({ source: i, target: j, weight: jaccard });
            }
        }
    }

    // Force Layout Simulation (Manual)
    const pos = simulateForceLayout(nodes, edges, 400, 400);

    // Render Plotly
    const edgeX = [];
    const edgeY = [];
    edges.forEach(e => {
        edgeX.push(pos[e.source].x, pos[e.target].x, null);
        edgeY.push(pos[e.source].y, pos[e.target].y, null);
    });

    const nodeX = pos.map(p => p.x);
    const nodeY = pos.map(p => p.y);
    const nodeSizes = nodes.map(n => Math.sqrt(n.count) * 3 + 5);
    const nodeTexts = nodes.map(n => `${n.id} (${n.count})`);

    Plotly.newPlot(`${idPrefix}-net`, [
        {
            x: edgeX, y: edgeY,
            mode: 'lines',
            line: { color: '#ccc', width: 1 },
            hoverinfo: 'none',
            type: 'scatter'
        },
        {
            x: nodeX, y: nodeY,
            mode: 'markers+text',
            text: nodes.map(n => n.id),
            textposition: 'top center',
            marker: { size: nodeSizes, color: '#1e90ff' },
            hovertemplate: '%{text}<extra></extra>',
            texttemplate: '%{text}', // Show labels always
            customdata: nodeTexts, // passed to hover? no, simple text
            type: 'scatter'
        }
    ], {
        margin: { t: 20, l: 20, r: 20, b: 20 },
        showlegend: false,
        xaxis: { showgrid: false, zeroline: false, showticklabels: false },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false }
    }, { displayModeBar: false });
}

// Simple Force-Directed Layout Implementation
function simulateForceLayout(nodes, edges, width, height) {
    // Init positions
    const k = Math.sqrt((width * height) / nodes.length);
    const pos = nodes.map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0, vy: 0
    }));

    const iterations = 100;
    const center = { x: width / 2, y: height / 2 };

    for (let it = 0; it < iterations; it++) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                const dx = pos[i].x - pos[j].x;
                const dy = pos[i].y - pos[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const force = (k * k) / dist;
                pos[i].vx += (dx / dist) * force;
                pos[i].vy += (dy / dist) * force;
            }
        }

        // Attraction
        edges.forEach(e => {
            const u = e.source;
            const v = e.target;
            const dx = pos[v].x - pos[u].x;
            const dy = pos[v].y - pos[u].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            const force = (dist * dist) / k;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            pos[u].vx += fx;
            pos[u].vy += fy;
            pos[v].vx -= fx;
            pos[v].vy -= fy;
        });

        // Center Gravity & Update
        const t = 1 - (it / iterations); // Temperature
        pos.forEach(p => {
            // Gravity to center
            p.vx += (center.x - p.x) * 0.05 * t;
            p.vy += (center.y - p.y) * 0.05 * t;

            // Limit velocity
            const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (vel > k * t) {
                p.vx = (p.vx / vel) * k * t;
                p.vy = (p.vy / vel) * k * t;
            }

            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.5; // Friction
            p.vy *= 0.5;
        });
    }
    return pos;
}
