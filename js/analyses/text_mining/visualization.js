/**
 * @fileoverview テキストマイニングの可視化モジュール
 * ワードクラウドと共起ネットワーク表示を提供
 * @module text_mining/visualization
 */

import { buildCooccurrenceEdges } from './helpers.js';

// ======================================================================
// ワードクラウド
// ======================================================================

const WORD_CLOUD_PALETTE = [
    '#2563eb',
    '#0f766e',
    '#c2410c',
    '#7c3aed',
    '#be123c',
    '#047857',
    '#b45309',
    '#4338ca'
];

function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function normalizeWordWeights(wordCounts, limit = 70) {
    const cleaned = (Array.isArray(wordCounts) ? wordCounts : [])
        .map(([word, weight]) => [String(word), Number(weight)])
        .filter(([word, weight]) => word.length > 0 && Number.isFinite(weight) && weight > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    if (cleaned.length === 0) return [];

    const weights = cleaned.map(([, weight]) => weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const minFont = 16;
    const maxFont = cleaned.length <= 8 ? 58 : 48;

    return cleaned.map(([word, weight]) => {
        const ratio = maxWeight === minWeight ? 0.65 : (weight - minWeight) / (maxWeight - minWeight);
        const fontSize = minFont + Math.sqrt(ratio) * (maxFont - minFont);
        return [word, fontSize];
    });
}

function drawCanvasMessage(canvas, message, scale, width, height) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, 0, width * scale, height * scale);
    ctx.fillStyle = '#64748b';
    ctx.font = `${14 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, (width * scale) / 2, (height * scale) / 2);
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
    drawCanvasMessage(canvas, '表示できる共起関係がありません', scale, width, height);
}

/**
 * ワードクラウドを描画
 * @param {string} canvasId - Canvas要素のID
 * @param {Array<[string, number]>} wordCounts - 単語と出現回数のペア配列
 * @param {Function} onClick - 単語クリック時のコールバック
 */
export function displayWordCloud(canvasId, wordCounts, onClick) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const SCALE = 3; // 高画質化のためのスケール倍率
    const parentWidth = canvas.parentElement?.clientWidth || canvas.parentElement?.getBoundingClientRect().width || 720;
    const width = Math.max(420, Math.round(parentWidth));
    const height = 400;

    // 内部解像度を上げる
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;

    // 表示サイズはCSSで制御
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const list = normalizeWordWeights(wordCounts);
    if (list.length === 0) {
        drawCanvasMessage(canvas, '表示できる単語がありません', SCALE, width, height);
        return;
    }

    WordCloud(canvas, {
        list: list,
        gridSize: Math.round(10 * SCALE),
        weightFactor: size => size * SCALE,
        minSize: 11 * SCALE,
        fontFamily: 'sans-serif',
        color: (word) => WORD_CLOUD_PALETTE[hashString(String(word)) % WORD_CLOUD_PALETTE.length],
        backgroundColor: '#fafbfc',
        rotateRatio: 0,
        shrinkToFit: true,
        drawOutOfBound: false,
        click: (item) => {
            if (item && item[0]) onClick(item[0]);
        },
        hover: window.drawBox ? window.drawBox : undefined
    });
}

// ======================================================================
// 共起ネットワーク
// ======================================================================

/**
 * 共起ネットワークを描画
 * @param {string} containerId - コンテナ要素のID
 * @param {Array<string[]>} sentences - 文ごとのトークン配列
 * @param {string[]} topWords - 上位単語配列
 * @param {Function} onClick - ノードクリック時のコールバック
 */
export function plotCooccurrenceNetwork(containerId, sentences, topWords, onClick) {
    const edges = buildCooccurrenceEdges(sentences, topWords, { threshold: 0.1, maxEdges: 80 })
        .map(edge => ({ ...edge, value: edge.weight }));

    if (edges.length === 0) {
        renderEmptyNetworkCanvas(containerId);
        return;
    }

    // 2. Node Degrees
    const degrees = {};
    topWords.forEach(w => { degrees[w] = 0; });
    edges.forEach(e => {
        degrees[e.from] = (degrees[e.from] || 0) + e.value;
        degrees[e.to] = (degrees[e.to] || 0) + e.value;
    });

    // 3. Community Detection (Louvain-like: simple greedy modularity optimization)
    const communityMap = {};
    const nodes = topWords.filter(w => degrees[w] > 0);

    // 各ノードに初期コミュニティを割り当て
    nodes.forEach((w, i) => { communityMap[w] = i; });

    // 簡易的なコミュニティ検出（接続されたノードをグループ化）
    const adjList = {};
    nodes.forEach(w => { adjList[w] = []; });
    edges.forEach(e => {
        if (adjList[e.from]) adjList[e.from].push({ to: e.to, weight: e.value });
        if (adjList[e.to]) adjList[e.to].push({ to: e.from, weight: e.value });
    });

    // 反復的にコミュニティを更新
    for (let iter = 0; iter < 10; iter++) {
        let changed = false;
        nodes.forEach(node => {
            const neighbors = adjList[node] || [];
            if (neighbors.length === 0) return;

            // 隣接ノードのコミュニティをカウント
            const commCounts = {};
            neighbors.forEach(n => {
                const c = communityMap[n.to];
                commCounts[c] = (commCounts[c] || 0) + n.weight;
            });

            // 最も接続の強いコミュニティを選択
            let bestComm = communityMap[node];
            let bestWeight = 0;
            for (const c in commCounts) {
                if (commCounts[c] > bestWeight) {
                    bestWeight = commCounts[c];
                    bestComm = parseInt(c);
                }
            }

            if (communityMap[node] !== bestComm) {
                communityMap[node] = bestComm;
                changed = true;
            }
        });
        if (!changed) break;
    }

    // コミュニティIDを連番に正規化
    const uniqueComms = [...new Set(Object.values(communityMap))];
    const commColors = [
        '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
        '#ffff33', '#a65628', '#f781bf', '#999999', '#1b9e77'
    ];

    // 4. Build vis.js Data
    const maxDegree = Math.max(...Object.values(degrees), 1);
    const visNodes = nodes.map(w => ({
        id: w,
        label: w,
        value: degrees[w] / maxDegree * 30 + 5,
        color: {
            background: commColors[uniqueComms.indexOf(communityMap[w]) % commColors.length],
            border: '#333',
            highlight: { background: '#ffc107', border: '#333' }
        },
        font: { size: 14, face: 'sans-serif' }
    }));

    const maxEdge = Math.max(...edges.map(e => e.value), 0.1);
    const visEdges = edges.map(e => ({
        from: e.from,
        to: e.to,
        value: e.value / maxEdge * 5 + 1,
        color: { color: '#888', opacity: 0.6 }
    }));

    // 5. Render
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };

    const options = {
        layout: { randomSeed: 42, improvedLayout: true },
        physics: {
            stabilization: { iterations: 100 },
            barnesHut: { gravitationalConstant: -3000, springLength: 150 }
        },
        interaction: { hover: true, tooltipDelay: 100 },
        nodes: {
            shape: 'dot',
            scaling: { min: 10, max: 40 }
        },
        edges: {
            smooth: { type: 'continuous' },
            scaling: { min: 1, max: 8 }
        }
    };

    const network = new vis.Network(container, data, options);

    network.on('click', params => {
        if (params.nodes.length > 0) {
            onClick(params.nodes[0]);
        }
    });

    // コミュニティ情報を表示
    const commInfo = document.createElement('div');
    commInfo.style.cssText = 'margin-top: 0.5rem; font-size: 0.85rem; color: #666;';
    commInfo.innerHTML = `<i class="fas fa-project-diagram"></i> 検出されたコミュニティ数: ${uniqueComms.length}`;
    container.parentElement.appendChild(commInfo);
}
