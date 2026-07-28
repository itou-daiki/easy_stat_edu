/**
 * @fileoverview テキストマイニングの可視化
 * ワードクラウドとKH Coder準拠のJaccard共起ネットワークを描画する。
 */

import { buildCooccurrenceEdges } from './helpers.js';

export const POS_STYLES = {
    noun: { label: '名詞', color: '#2563eb' },
    proper_noun: { label: '固有名詞', color: '#4338ca' },
    verbal_noun: { label: 'サ変名詞', color: '#0d9488' },
    adjectival_noun: { label: '形容動詞', color: '#ea580c' },
    verb: { label: '動詞', color: '#0f766e' },
    adjective: { label: '形容詞', color: '#c2410c' },
    adverb: { label: '副詞', color: '#7c3aed' },
    adnominal: { label: '連体詞', color: '#be123c' },
    interjection: { label: '感動詞', color: '#047857' },
    alnum: { label: '英数字・略語', color: '#b45309' },
    other: { label: 'その他', color: '#475569' }
};

const COMMUNITY_COLORS = [
    '#2563eb',
    '#dc2626',
    '#059669',
    '#7c3aed',
    '#d97706',
    '#0891b2',
    '#db2777',
    '#4d7c0f',
    '#4338ca',
    '#b45309',
    '#0f766e',
    '#be123c'
];

function normalizeWordWeights(wordCounts, limit = 55) {
    const cleaned = (Array.isArray(wordCounts) ? wordCounts : [])
        .map(([word, weight]) => [String(word), Number(weight)])
        .filter(([word, weight]) => word.length > 0 && Number.isFinite(weight) && weight > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
        .slice(0, limit);

    if (cleaned.length === 0) return [];

    const weights = cleaned.map(([, weight]) => weight);
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const minFont = 15;
    const maxFont = cleaned.length <= 8 ? 58 : 48;

    return cleaned.map(([word, weight]) => {
        const ratio = maxWeight === minWeight ? 0.65 : (weight - minWeight) / (maxWeight - minWeight);
        return [word, minFont + Math.sqrt(ratio) * (maxFont - minFont)];
    });
}

function drawCanvasMessage(canvas, message, scale, width, height) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width * scale, height * scale);
    ctx.fillStyle = '#64748b';
    ctx.font = `${14 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, (width * scale) / 2, (height * scale) / 2);
}

function renderWordCloudLegend(canvas, posByWord, words, metricLabel) {
    const legend = document.getElementById(`${canvas.id}-legend`);
    if (!legend) return;

    const usedPos = [...new Set(words.map(([word]) => posByWord?.[word] || 'other'))]
        .filter(pos => POS_STYLES[pos]);
    const items = usedPos.map(pos => POS_STYLES[pos]);
    canvas.dataset.legendMetric = metricLabel;
    canvas.dataset.legendItems = JSON.stringify(items);

    legend.innerHTML = `
        <div class="tm-visual-legend">
            <div><strong>大きさ:</strong> ${metricLabel}</div>
            <div class="tm-legend-items">
                ${items.map(item => `
                    <span><i style="background:${item.color};"></i>${item.label}</span>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 品詞に意味を持たせたワードクラウドを描画する。
 * @param {string} canvasId
 * @param {Array<[string, number]>} wordCounts
 * @param {Function} onClick
 * @param {{posByWord?: Object<string, string>, metricLabel?: string, limit?: number}} [options]
 */
export function displayWordCloud(canvasId, wordCounts, onClick, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return Promise.resolve();

    const scale = 2;
    const weightedWords = normalizeWordWeights(wordCounts, options.limit || 55);
    const metricLabel = options.metricLabel || '値が大きい語ほど大きく表示';
    const renderAtSize = (dimensions = null) => {
        const parentWidth = canvas.parentElement?.clientWidth
            || canvas.parentElement?.getBoundingClientRect().width
            || 720;
        const width = Math.max(280, Math.round(dimensions?.width || parentWidth));
        const defaultHeight = width < 520 ? 330 : 390;
        const height = Math.max(240, Math.round(dimensions?.height || defaultHeight));

        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.height = `${height}px`;
        canvas.style.marginLeft = 'auto';
        canvas.style.marginRight = 'auto';
        renderWordCloudLegend(canvas, options.posByWord || {}, weightedWords, metricLabel);

        if (weightedWords.length === 0) {
            drawCanvasMessage(canvas, '表示できる単語がありません', scale, width, height);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                window.clearTimeout(timeoutId);
                canvas.removeEventListener('wordcloudstop', finish);
                canvas.removeEventListener('wordcloudabort', finish);
            };
            const finish = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };
            const timeoutId = window.setTimeout(finish, 5000);
            canvas.addEventListener('wordcloudstop', finish);
            canvas.addEventListener('wordcloudabort', finish);

            try {
                WordCloud(canvas, {
                    list: weightedWords,
                    gridSize: Math.round(10 * scale),
                    weightFactor: size => size * scale,
                    minSize: 11 * scale,
                    fontFamily: '"Helvetica Neue", "Yu Gothic", sans-serif',
                    color: word => {
                        const pos = options.posByWord?.[String(word)] || 'other';
                        return POS_STYLES[pos]?.color || POS_STYLES.other.color;
                    },
                    backgroundColor: '#f8fafc',
                    rotateRatio: 0,
                    shrinkToFit: true,
                    drawOutOfBound: false,
                    click: item => {
                        if (item?.[0] && typeof onClick === 'function') onClick(item[0]);
                    },
                    hover: window.drawBox ? window.drawBox : undefined
                });
            } catch (error) {
                settled = true;
                cleanup();
                reject(error);
            }
        });
    };

    canvas.__easyStatResizeFigure = dimensions => {
        void renderAtSize(dimensions);
    };
    return renderAtSize();
}

/**
 * 重み付きネットワークを単一レベルのモジュラリティ最適化で分割する。
 * @param {string[]} nodeIds
 * @param {Array<{from: string, to: string, weight: number}>} edges
 * @returns {Object<string, number>}
 */
export function detectCommunities(nodeIds, edges) {
    const nodes = [...new Set(nodeIds || [])];
    const adjacency = Object.fromEntries(nodes.map(node => [node, []]));
    const degree = Object.fromEntries(nodes.map(node => [node, 0]));

    (edges || []).forEach(edge => {
        if (!adjacency[edge.from] || !adjacency[edge.to]) return;
        const weight = Number(edge.weight) || 0;
        adjacency[edge.from].push({ node: edge.to, weight });
        adjacency[edge.to].push({ node: edge.from, weight });
        degree[edge.from] += weight;
        degree[edge.to] += weight;
    });

    const totalTwice = Object.values(degree).reduce((sum, value) => sum + value, 0);
    if (!(totalTwice > 0)) {
        return Object.fromEntries(nodes.map((node, index) => [node, index]));
    }

    const community = Object.fromEntries(nodes.map((node, index) => [node, index]));
    const totals = Object.fromEntries(nodes.map((node, index) => [index, degree[node]]));
    const order = nodes.slice().sort((a, b) => degree[b] - degree[a] || a.localeCompare(b, 'ja'));

    for (let pass = 0; pass < 30; pass++) {
        let moved = false;

        order.forEach(node => {
            const current = community[node];
            const nodeDegree = degree[node];
            const weightsByCommunity = {};
            adjacency[node].forEach(neighbor => {
                const neighborCommunity = community[neighbor.node];
                weightsByCommunity[neighborCommunity] =
                    (weightsByCommunity[neighborCommunity] || 0) + neighbor.weight;
            });

            totals[current] -= nodeDegree;
            let bestCommunity = current;
            let bestGain = 0;

            Object.entries(weightsByCommunity).forEach(([candidateText, internalWeight]) => {
                const candidate = Number(candidateText);
                const gain = internalWeight - (totals[candidate] || 0) * nodeDegree / totalTwice;
                if (gain > bestGain + 1e-12
                    || (gain > 1e-12
                        && Math.abs(gain - bestGain) <= 1e-12
                        && candidate < bestCommunity)) {
                    bestGain = gain;
                    bestCommunity = candidate;
                }
            });

            totals[bestCommunity] = (totals[bestCommunity] || 0) + nodeDegree;
            if (bestCommunity !== current) {
                community[node] = bestCommunity;
                moved = true;
            }
        });

        if (!moved) break;
    }

    const normalizedIds = {};
    [...new Set(Object.values(community))].sort((a, b) => a - b)
        .forEach((communityId, index) => {
            normalizedIds[communityId] = index;
        });
    return Object.fromEntries(nodes.map(node => [node, normalizedIds[community[node]]]));
}

function computeBetweenness(nodes, edges) {
    const adjacency = Object.fromEntries(nodes.map(node => [node, []]));
    edges.forEach(edge => {
        adjacency[edge.from]?.push(edge.to);
        adjacency[edge.to]?.push(edge.from);
    });
    const centrality = Object.fromEntries(nodes.map(node => [node, 0]));

    nodes.forEach(source => {
        const stack = [];
        const predecessors = Object.fromEntries(nodes.map(node => [node, []]));
        const paths = Object.fromEntries(nodes.map(node => [node, 0]));
        const distance = Object.fromEntries(nodes.map(node => [node, -1]));
        paths[source] = 1;
        distance[source] = 0;
        const queue = [source];

        while (queue.length > 0) {
            const node = queue.shift();
            stack.push(node);
            adjacency[node].forEach(neighbor => {
                if (distance[neighbor] < 0) {
                    queue.push(neighbor);
                    distance[neighbor] = distance[node] + 1;
                }
                if (distance[neighbor] === distance[node] + 1) {
                    paths[neighbor] += paths[node];
                    predecessors[neighbor].push(node);
                }
            });
        }

        const dependency = Object.fromEntries(nodes.map(node => [node, 0]));
        while (stack.length > 0) {
            const node = stack.pop();
            predecessors[node].forEach(predecessor => {
                if (paths[node] > 0) {
                    dependency[predecessor] += (paths[predecessor] / paths[node]) * (1 + dependency[node]);
                }
            });
            if (node !== source) centrality[node] += dependency[node];
        }
    });

    const normalizer = nodes.length > 2 ? (nodes.length - 1) * (nodes.length - 2) : 1;
    nodes.forEach(node => {
        centrality[node] = centrality[node] / normalizer;
    });
    return centrality;
}

function groupCommunities(nodes, communityByNode, termFreq) {
    const groups = {};
    nodes.forEach(node => {
        const id = communityByNode[node];
        if (!groups[id]) groups[id] = [];
        groups[id].push(node);
    });

    return Object.entries(groups)
        .sort(([, wordsA], [, wordsB]) => {
            const frequencyA = wordsA.reduce((sum, word) => sum + (termFreq[word] || 0), 0);
            const frequencyB = wordsB.reduce((sum, word) => sum + (termFreq[word] || 0), 0);
            return frequencyB - frequencyA || wordsB.length - wordsA.length;
        })
        .map(([id, words], index) => ({
            id: Number(id),
            label: `コミュニティ${index + 1}`,
            color: COMMUNITY_COLORS[index % COMMUNITY_COLORS.length],
            words: words.slice()
                .sort((a, b) => (termFreq[b] || 0) - (termFreq[a] || 0) || a.localeCompare(b, 'ja'))
        }));
}

function renderNetworkLegend(containerId, groups, diagnostics) {
    const legend = document.getElementById(`${containerId}-legend`);
    if (!legend) return;

    if (groups.length === 0) {
        legend.innerHTML = `
            <div class="tm-visual-legend">
                共起回数の条件を満たす語の組み合わせがありません。
            </div>
        `;
        return;
    }

    legend.innerHTML = `
        <div class="tm-visual-legend">
            <div>
                <strong>色分けの意味:</strong>
                同じ色はモジュラリティ法で検出した語群です。円の大きさ＝語の出現回数、線の太さ＝Jaccard係数。
                ${diagnostics.unitLabel}単位で、共起${diagnostics.minCooccurrence}回以上の上位${diagnostics.edgeCount}本を表示しています。
                ${diagnostics.omittedCommunityCount > 0
                    ? `可読性のため、出現回数の少ない${diagnostics.omittedCommunityCount}コミュニティは省略しました。`
                    : ''}
            </div>
            <div class="tm-community-list">
                ${groups.map(group => `
                    <div>
                        <i style="background:${group.color};"></i>
                        <span><strong>${group.label}:</strong> ${group.words.slice(0, 10).join('、')}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    let cursorY = y;
    for (const char of text) {
        const candidate = line + char;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            ctx.fillText(line, x, cursorY);
            line = char;
            cursorY += lineHeight;
        } else {
            line = candidate;
        }
    }
    if (line) ctx.fillText(line, x, cursorY);
    return cursorY + lineHeight;
}

function downloadNetworkImage(containerId, groups, diagnostics) {
    const container = document.getElementById(containerId);
    const sourceCanvas = container?.querySelector('canvas');
    if (!sourceCanvas) {
        alert('画像の取得に失敗しました。');
        return;
    }

    const scale = Math.max(1, sourceCanvas.width / Math.max(sourceCanvas.getBoundingClientRect().width, 1));
    const padding = 28 * scale;
    const rowHeight = 34 * scale;
    const visualTitle = container.dataset.visualTitle || sourceCanvas.dataset.visualTitle || '';
    const titleHeight = visualTitle ? Math.round(72 * scale) : 0;
    const showLegend = container.dataset.visualLegendVisible !== 'false';
    const legendHeight = showLegend
        ? Math.max(210 * scale, (130 + groups.length * 34) * scale)
        : 0;
    const output = document.createElement('canvas');
    output.width = sourceCanvas.width;
    output.height = titleHeight + sourceCanvas.height + legendHeight;
    const ctx = output.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, output.width, output.height);

    if (titleHeight > 0) {
        let titleFontSize = 22 * scale;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${titleFontSize}px "Helvetica Neue", "Yu Gothic", sans-serif`;
        while (titleFontSize > 12 * scale
            && ctx.measureText(visualTitle).width > output.width - 48 * scale) {
            titleFontSize -= scale;
            ctx.font = `bold ${titleFontSize}px "Helvetica Neue", "Yu Gothic", sans-serif`;
        }
        ctx.fillText(visualTitle, output.width / 2, titleHeight / 2);
        ctx.textAlign = 'left';
    }

    ctx.drawImage(sourceCanvas, 0, titleHeight);

    if (legendHeight > 0) {
        const top = titleHeight + sourceCanvas.height;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, top, output.width, legendHeight);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = scale;
        ctx.beginPath();
        ctx.moveTo(0, top);
        ctx.lineTo(output.width, top);
        ctx.stroke();

        ctx.textBaseline = 'top';
        ctx.fillStyle = '#334155';
        ctx.font = `bold ${18 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
        ctx.fillText('共起ネットワークの読み方', padding, top + padding);
        ctx.fillStyle = '#475569';
        ctx.font = `${13 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
        const description = `円の大きさ＝語の出現回数、線の太さ＝Jaccard係数、色＝モジュラリティ法で検出した語群。${diagnostics.unitLabel}単位・共起${diagnostics.minCooccurrence}回以上・上位${diagnostics.edgeCount}本。`;
        let cursorY = wrapCanvasText(
            ctx,
            description,
            padding,
            top + padding + 30 * scale,
            output.width - padding * 2,
            22 * scale
        ) + 10 * scale;

        groups.forEach(group => {
            ctx.fillStyle = group.color;
            ctx.beginPath();
            ctx.arc(padding + 7 * scale, cursorY + 8 * scale, 7 * scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#334155';
            ctx.font = `bold ${13 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            ctx.fillText(`${group.label}:`, padding + 22 * scale, cursorY);
            ctx.font = `${13 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            ctx.fillStyle = '#475569';
            ctx.fillText(
                group.words.slice(0, 12).join('、'),
                padding + 22 * scale + ctx.measureText(`${group.label}: `).width,
                cursorY
            );
            cursorY += rowHeight;
        });
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const link = document.createElement('a');
    link.download = `cooccurrence_network_${timestamp}.png`;
    link.href = output.toDataURL('image/png');
    link.click();
}

function renderEmptyNetworkCanvas(containerId, unitLabel, minCooccurrence) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const scale = 2;
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const renderAtSize = (dimensions = null) => {
        const width = Math.max(280, Math.round(dimensions?.width || container.clientWidth || 720));
        const defaultHeight = width < 520 ? 360 : 440;
        const height = Math.max(240, Math.round(dimensions?.height || defaultHeight));
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = '100%';
        canvas.style.height = `${height}px`;
        container.style.height = `${height}px`;
        drawCanvasMessage(
            canvas,
            `${unitLabel}単位で共起${minCooccurrence}回以上の関係がありません`,
            scale,
            width,
            height
        );
        renderNetworkLegend(containerId, [], {
            unitLabel,
            minCooccurrence,
            edgeCount: 0
        });
    };
    container.__easyStatResizeFigure = renderAtSize;
    renderAtSize();
}

/**
 * Jaccard係数上位の共起ネットワークを描画する。
 * @param {string} containerId
 * @param {Array<string[]>} units
 * @param {string[]} topWords
 * @param {Object<string, number>} termFreq
 * @param {Function} onClick
 * @param {{maxEdges?: number, minCooccurrence?: number, unitLabel?: string}} [settings]
 */
export function plotCooccurrenceNetwork(
    containerId,
    units,
    topWords,
    termFreq,
    onClick,
    settings = {}
) {
    const maxEdges = Math.max(10, Number(settings.maxEdges) || 60);
    const minCooccurrence = Math.max(1, Number(settings.minCooccurrence) || 1);
    const unitLabel = settings.unitLabel || '文';
    const edges = buildCooccurrenceEdges(units, topWords, {
        filterMode: 'top',
        maxEdges,
        minCooccurrence
    });

    if (edges.length === 0) {
        renderEmptyNetworkCanvas(containerId, unitLabel, minCooccurrence);
        return { edgeCount: 0, nodeCount: 0, communityCount: 0 };
    }

    const allActiveNodes = [...new Set(edges.flatMap(edge => [edge.from, edge.to]))];
    const communities = detectCommunities(allActiveNodes, edges);
    const allGroups = groupCommunities(allActiveNodes, communities, termFreq);
    const groups = allGroups.slice(0, COMMUNITY_COLORS.length);
    const displayedNodeSet = new Set(groups.flatMap(group => group.words));
    const displayedEdges = edges.filter(edge =>
        displayedNodeSet.has(edge.from) && displayedNodeSet.has(edge.to)
    );
    const activeNodes = [...displayedNodeSet];
    const betweenness = computeBetweenness(activeNodes, displayedEdges);
    const colorByCommunity = Object.fromEntries(groups.map(group => [group.id, group.color]));
    const maxFrequency = Math.max(...activeNodes.map(node => termFreq[node] || 1), 1);

    const nodes = activeNodes.map(id => ({
        id,
        label: id,
        value: Math.sqrt((termFreq[id] || 1) / maxFrequency) * 45 + 8,
        title: `${id}<br>出現回数: ${termFreq[id] || 0}<br>媒介中心性: ${betweenness[id].toFixed(3)}`,
        color: {
            background: colorByCommunity[communities[id]],
            border: '#ffffff',
            highlight: {
                background: colorByCommunity[communities[id]],
                border: '#111827'
            }
        },
        borderWidth: 2,
        font: {
            size: 17,
            color: '#1f2937',
            face: '"Helvetica Neue", "Yu Gothic", sans-serif',
            strokeWidth: 5,
            strokeColor: '#ffffff'
        }
    }));

    const visEdges = displayedEdges.map(edge => ({
        from: edge.from,
        to: edge.to,
        value: edge.weight,
        title: `Jaccard係数: ${edge.weight.toFixed(3)}<br>共起: ${edge.intersection} ${unitLabel}`,
        color: { color: '#94a3b8', highlight: '#2563eb', opacity: 0.72 }
    }));

    const container = document.getElementById(containerId);
    if (!container) return { edgeCount: 0, nodeCount: 0, communityCount: 0 };
    container.innerHTML = '';

    const network = new vis.Network(
        container,
        {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(visEdges)
        },
        {
            layout: { randomSeed: 42, improvedLayout: true },
            nodes: { shape: 'dot', scaling: { min: 14, max: 56 } },
            edges: {
                smooth: { type: 'continuous', roundness: 0.35 },
                scaling: { min: 1, max: 9 }
            },
            physics: {
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -70,
                    centralGravity: 0.012,
                    springConstant: 0.06,
                    springLength: 125,
                    damping: 0.5
                },
                stabilization: {
                    enabled: true,
                    iterations: 280,
                    updateInterval: 40,
                    fit: true
                },
                minVelocity: 0.5
            },
            interaction: {
                hover: true,
                tooltipDelay: 150,
                navigationButtons: true,
                keyboard: false
            }
        }
    );

    network.on('click', params => {
        if (params.nodes.length > 0 && typeof onClick === 'function') {
            onClick(params.nodes[0]);
        }
    });
    let networkSettled = false;
    const finishStabilization = () => {
        if (networkSettled) return;
        networkSettled = true;
        window.clearTimeout(stabilizationTimeout);
        network.stopSimulation();
        network.fit({ animation: false });
        network.setOptions({ physics: false });
    };
    const stabilizationTimeout = window.setTimeout(finishStabilization, 2500);
    network.once('stabilizationIterationsDone', finishStabilization);
    container.__easyStatResizeFigure = dimensions => {
        const width = Math.max(280, Math.round(dimensions?.width || container.clientWidth || 720));
        const height = Math.max(240, Math.round(dimensions?.height || container.clientHeight || 500));
        const style = window.getComputedStyle(container);
        const horizontalInset = (Number.parseFloat(style.borderLeftWidth) || 0)
            + (Number.parseFloat(style.borderRightWidth) || 0)
            + (Number.parseFloat(style.paddingLeft) || 0)
            + (Number.parseFloat(style.paddingRight) || 0);
        const verticalInset = (Number.parseFloat(style.borderTopWidth) || 0)
            + (Number.parseFloat(style.borderBottomWidth) || 0)
            + (Number.parseFloat(style.paddingTop) || 0)
            + (Number.parseFloat(style.paddingBottom) || 0);
        const innerWidth = Math.max(1, Math.round(width - horizontalInset));
        const innerHeight = Math.max(1, Math.round(height - verticalInset));
        container.style.height = `${height}px`;
        network.setSize(`${innerWidth}px`, `${innerHeight}px`);
        network.redraw();
        window.requestAnimationFrame(() => network.fit({ animation: false }));
    };

    const diagnostics = {
        unitLabel,
        minCooccurrence,
        edgeCount: displayedEdges.length,
        omittedCommunityCount: Math.max(0, allGroups.length - groups.length)
    };
    renderNetworkLegend(containerId, groups, diagnostics);

    const downloadButton = document.querySelector(`.download-btn[data-target="${containerId}"]`);
    if (downloadButton) {
        const freshButton = downloadButton.cloneNode(true);
        downloadButton.replaceWith(freshButton);
        freshButton.addEventListener('click', event => {
            event.preventDefault();
            downloadNetworkImage(containerId, groups, diagnostics);
        });
    }

    return {
        edgeCount: displayedEdges.length,
        nodeCount: activeNodes.length,
        communityCount: groups.length,
        edges: displayedEdges,
        communities,
        betweenness
    };
}
