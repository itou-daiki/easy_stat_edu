import {
    renderDataOverview,
    createVariableSelector,
    createAnalysisButton
} from '../utils.js';
import {
    initTokenizer,
    downloadCanvasAsImage,
    getTokenizer,
    getTokenizerInfo,
    analyzeDocument,
    splitTextIntoSentences,
    computeTermMetrics,
    computeCategorySpecificity,
    buildGroupComparisonRows
} from './text_mining/helpers.js?v=tm-fast-20260729a';
import {
    displayWordCloud,
    plotCooccurrenceNetwork,
    POS_STYLES
} from './text_mining/visualization.js?v=tm-fast-20260729a';

const POS_ORDER = [
    'noun',
    'proper_noun',
    'verbal_noun',
    'adjectival_noun',
    'verb',
    'adjective',
    'adverb',
    'adnominal',
    'interjection',
    'alnum',
    'other'
];

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function sanitizeId(value) {
    return String(value)
        .normalize('NFKC')
        .replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'category';
}

function parseTermList(value) {
    return [...new Set(
        String(value || '')
            .split(/[\n\r,、;；]+/)
            .map(term => term.normalize('NFKC').trim())
            .filter(Boolean)
    )];
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function readAnalysisSettings() {
    return {
        minFrequency: clampInteger(document.getElementById('tm-min-frequency')?.value, 2, 1, 1000),
        networkTermLimit: clampInteger(document.getElementById('tm-network-term-limit')?.value, 35, 10, 80),
        networkEdgeLimit: clampInteger(document.getElementById('tm-network-edge-limit')?.value, 50, 10, 200),
        minCooccurrence: clampInteger(document.getElementById('tm-min-cooccurrence')?.value, 2, 1, 100),
        cooccurrenceUnit: document.getElementById('tm-cooccurrence-unit')?.value === 'document'
            ? 'document'
            : 'sentence',
        stopWords: new Set(parseTermList(document.getElementById('tm-stop-words')?.value)),
        forceTerms: parseTermList(document.getElementById('tm-force-terms')?.value)
    };
}

function buildAnalyzedItem(item, tokenizer, extractionOptions) {
    const rawSentences = splitTextIntoSentences(item.text);
    const sentenceTexts = rawSentences.length > 0 ? rawSentences : [item.text];
    const sentences = sentenceTexts.map(original => {
        const tokens = analyzeDocument(original, tokenizer, extractionOptions);
        return {
            original,
            tokens,
            terms: tokens.map(token => token.term),
            sourceId: item.id
        };
    });

    return {
        ...item,
        sentences,
        tokens: sentences.flatMap(sentence => sentence.tokens),
        terms: sentences.flatMap(sentence => sentence.terms)
    };
}

function yieldToBrowser() {
    return new Promise(resolve => window.setTimeout(resolve, 0));
}

async function analyzeItemsInChunks(rawItems, tokenizer, extractionOptions, updateStatus) {
    const items = [];
    const total = rawItems.length;
    let batchStartedAt = performance.now();

    await yieldToBrowser();
    for (let index = 0; index < total; index++) {
        items.push(buildAnalyzedItem(rawItems[index], tokenizer, extractionOptions));

        const processed = index + 1;
        const shouldYield = processed === total
            || processed % 24 === 0
            || performance.now() - batchStartedAt >= 12;
        if (!shouldYield) continue;

        const progress = Math.round(processed / total * 100);
        updateStatus?.(`テキストを解析中... ${progress}%`);
        if (processed < total) {
            await yieldToBrowser();
            batchStartedAt = performance.now();
        }
    }

    return items;
}

function buildPartOfSpeechLookup(items) {
    const counts = {};
    items.forEach(item => {
        item.tokens.forEach(token => {
            if (!counts[token.term]) counts[token.term] = {};
            counts[token.term][token.pos] = (counts[token.term][token.pos] || 0) + 1;
        });
    });

    return Object.fromEntries(Object.entries(counts).map(([term, posCounts]) => {
        const pos = Object.entries(posCounts)
            .sort((a, b) => b[1] - a[1] || POS_ORDER.indexOf(a[0]) - POS_ORDER.indexOf(b[0]))[0]?.[0]
            || 'other';
        return [term, pos];
    }));
}

function formatPValue(value) {
    if (!Number.isFinite(value)) return '-';
    if (value < 0.001) return '&lt; .001';
    return value.toFixed(3).replace(/^0/, '');
}

function highlightKwicText(text, surfaces) {
    const uniqueSurfaces = [...new Set((surfaces || []).filter(Boolean))]
        .sort((a, b) => b.length - a.length);
    if (uniqueSurfaces.length === 0) return escapeHtml(text);

    const escapedPattern = uniqueSurfaces
        .map(surface => surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    const regex = new RegExp(`(${escapedPattern})`, 'giu');
    return String(text).split(regex).map(part => {
        const isKeyword = uniqueSurfaces.some(surface =>
            surface.normalize('NFKC').toLowerCase() === part.normalize('NFKC').toLowerCase()
        );
        return isKeyword
            ? `<mark class="kwic-keyword">${escapeHtml(part)}</mark>`
            : escapeHtml(part);
    }).join('');
}

function openKwicPanel(word, items) {
    const matches = [];
    items.forEach(item => {
        item.sentences.forEach(sentence => {
            const matchingTokens = sentence.tokens.filter(token => token.term === word);
            if (matchingTokens.length === 0) return;
            matches.push({
                sourceId: item.id,
                original: sentence.original,
                surfaces: matchingTokens.map(token => token.surface)
            });
        });
    });

    const panel = document.getElementById('kwic-panel');
    const overlay = document.getElementById('kwic-overlay');
    const content = document.getElementById('kwic-content');
    if (!panel || !overlay || !content) return;

    const documentCount = new Set(matches.map(match => match.sourceId)).size;
    content.innerHTML = `
        <div class="kwic-summary">
            <strong>「${escapeHtml(word)}」</strong>
            <span>${matches.length}文・${documentCount}文書</span>
        </div>
        <ol class="kwic-list">
            ${matches.slice(0, 200).map(match => `
                <li class="kwic-item">
                    <span class="kwic-source">文書 ${match.sourceId + 1}</span>
                    ${highlightKwicText(match.original, match.surfaces)}
                </li>
            `).join('')}
        </ol>
        ${matches.length > 200
            ? '<p class="tm-muted">表示は先頭200文までです。</p>'
            : ''}
    `;
    panel.classList.add('open');
    overlay.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
}

function closeKwicPanel() {
    const panel = document.getElementById('kwic-panel');
    const overlay = document.getElementById('kwic-overlay');
    panel?.classList.remove('open');
    overlay?.classList.remove('open');
    panel?.setAttribute('aria-hidden', 'true');
}

function renderSummary(items, metrics, tokenizerInfo) {
    const sentenceCount = items.reduce((sum, item) => sum + item.sentences.length, 0);
    const totalTerms = Object.values(metrics.termFreq).reduce((sum, value) => sum + value, 0);
    const zeroTermDocuments = items.filter(item => item.terms.length === 0).length;
    const warning = tokenizerInfo.warning
        ? `<div class="tm-engine-warning">${escapeHtml(tokenizerInfo.warning)}</div>`
        : '';

    return `
        <div class="tm-summary-strip">
            <div><span>文書</span><strong>${items.length}</strong></div>
            <div><span>文</span><strong>${sentenceCount}</strong></div>
            <div><span>抽出語</span><strong>${totalTerms}</strong></div>
            <div><span>異なり語</span><strong>${Object.keys(metrics.termFreq).length}</strong></div>
            <div><span>解析器</span><strong class="tm-engine-name">${escapeHtml(tokenizerInfo.label)}</strong></div>
        </div>
        ${zeroTermDocuments > 0
            ? `<div class="tm-method-note">${zeroTermDocuments}文書は、抽出条件を満たす語が0件でした。</div>`
            : ''}
        ${warning}
    `;
}

function renderTermTable(metrics, posByWord, minFrequency, prefix) {
    const tfidfMap = new Map(metrics.termTfIdf);
    const rows = Object.entries(metrics.termFreq)
        .filter(([, frequency]) => frequency >= minFrequency)
        .sort((a, b) =>
            b[1] - a[1]
            || (metrics.termDf[b[0]] || 0) - (metrics.termDf[a[0]] || 0)
            || a[0].localeCompare(b[0], 'ja')
        )
        .slice(0, 150);

    return `
        <section class="tm-result-panel">
            <div class="tm-panel-heading">
                <div>
                    <h6>抽出語リスト（出現回数順）</h6>
                    <p>TF＝出現回数、DF＝その語を含む文書数。語を押すとKWICを表示します。</p>
                </div>
                <span class="tm-count-badge">${rows.length}語表示</span>
            </div>
            <div class="tm-table-scroll">
                <table class="data-table tm-term-table">
                    <thead>
                        <tr>
                            <th>語</th>
                            <th>品詞</th>
                            <th>TF</th>
                            <th>DF</th>
                            <th>文書率</th>
                            <th>TF-IDF合計</th>
                        </tr>
                    </thead>
                    <tbody id="${prefix}-term-table-body">
                        ${rows.length > 0 ? rows.map(([word, frequency]) => {
                            const pos = posByWord[word] || 'other';
                            const posStyle = POS_STYLES[pos] || POS_STYLES.other;
                            return `
                                <tr>
                                    <td>
                                        <button type="button" class="tm-term-link" data-term="${escapeHtml(word)}">
                                            ${escapeHtml(word)}
                                        </button>
                                    </td>
                                    <td>
                                        <span class="tm-pos-label">
                                            <i style="background:${posStyle.color};"></i>${posStyle.label}
                                        </span>
                                    </td>
                                    <td>${frequency}</td>
                                    <td>${metrics.termDf[word] || 0}</td>
                                    <td>${((metrics.termDocumentRate[word] || 0) * 100).toFixed(1)}%</td>
                                    <td>${(tfidfMap.get(word) || 0).toFixed(4)}</td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr><td colspan="6">最小出現数を満たす語がありません。</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function renderCategoryFeatureTable(rows, category, minFrequency, termFreq) {
    const visibleRows = (rows || [])
        .filter(row => row.z > 0 && (termFreq[row.term] || 0) >= minFrequency)
        .slice(0, 40);
    const significantCount = visibleRows.filter(row => row.q < 0.05).length;

    return `
        <section class="tm-result-panel tm-feature-panel">
            <div class="tm-panel-heading">
                <div>
                    <h6>「${escapeHtml(category)}」の特徴語</h6>
                    <p>文書への出現有無を他カテゴリと比較した調整済み標準化残差です。zが大きいほど、このカテゴリに特徴的です。</p>
                </div>
                <span class="tm-count-badge">FDR 5%: ${significantCount}語</span>
            </div>
            <div class="tm-table-scroll">
                <table class="data-table tm-feature-table">
                    <thead>
                        <tr>
                            <th>語</th>
                            <th>カテゴリ内</th>
                            <th>その他</th>
                            <th>z</th>
                            <th>q</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleRows.length > 0 ? visibleRows.map(row => `
                            <tr class="${row.q < 0.05 ? 'tm-significant-row' : ''}">
                                <td><button type="button" class="tm-term-link" data-term="${escapeHtml(row.term)}">${escapeHtml(row.term)}</button></td>
                                <td>${(row.categoryRate * 100).toFixed(1)}%</td>
                                <td>${(row.outsideRate * 100).toFixed(1)}%</td>
                                <td>${row.z.toFixed(2)}</td>
                                <td>${formatPValue(row.q)}</td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="5">比較可能な特徴語がありません。</td></tr>
                        `}
                    </tbody>
                </table>
            </div>
            <div class="tm-table-footnote">
                qはBenjamini-Hochberg法で多重比較を補正。q &lt; .05の行を強調しています。
            </div>
        </section>
    `;
}

function formatComparisonQ(value) {
    if (!Number.isFinite(value)) return 'q=-';
    if (value < 0.001) return 'q<.001';
    return `q=${value.toFixed(3).replace(/^0/, '')}`;
}

function renderGroupComparison(rows, categories, groupSizes, posByWord) {
    if (!rows.length) {
        return `
            <section class="tm-result-panel tm-group-comparison-panel">
                <div class="tm-panel-heading">
                    <div>
                        <h6>群間比較</h6>
                        <p>現在の抽出条件では、群間で比較できる語がありません。</p>
                    </div>
                </div>
            </section>
        `;
    }

    const categoryNames = categories.map(category => String(category));
    return `
        <section class="tm-result-panel tm-group-comparison-panel" data-comparison-mode="rate">
            <div class="tm-panel-heading">
                <div>
                    <h6>群間比較</h6>
                    <p>同じ語を全群で横に並べています。語を押すと全群のKWICを表示します。</p>
                </div>
                <span class="tm-count-badge">差の大きい上位${rows.length}語</span>
            </div>
            <div class="tm-comparison-toolbar">
                <div class="tm-segmented-control" role="group" aria-label="群間比較の表示指標">
                    <button type="button" class="active" data-comparison-mode="rate" aria-pressed="true">文書率</button>
                    <button type="button" data-comparison-mode="z" aria-pressed="false">特徴度 z</button>
                </div>
                <div class="tm-comparison-legend tm-comparison-rate-legend">
                    青い帯が長いほど、その語を含む文書の割合が高い群です。
                </div>
                <div class="tm-comparison-legend tm-comparison-z-legend" hidden>
                    <span><i class="tm-z-positive-swatch"></i>期待より多い</span>
                    <span><i class="tm-z-negative-swatch"></i>期待より少ない</span>
                    <span>* q &lt; .05</span>
                </div>
            </div>
            <div class="tm-table-scroll tm-comparison-scroll">
                <table class="data-table tm-comparison-table">
                    <thead>
                        <tr>
                            <th class="tm-comparison-term-column">語・品詞</th>
                            ${categoryNames.map(category => `
                                <th class="tm-comparison-group-header">
                                    ${escapeHtml(category)}
                                    <small>N=${groupSizes[category] || 0}</small>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => {
                            const pos = posByWord[row.term] || 'other';
                            const posStyle = POS_STYLES[pos] || POS_STYLES.other;
                            return `
                                <tr>
                                    <th class="tm-comparison-term-column" scope="row">
                                        <button type="button" class="tm-term-link" data-term="${escapeHtml(row.term)}">
                                            ${escapeHtml(row.term)}
                                        </button>
                                        <span class="tm-pos-label">
                                            <i style="background:${posStyle.color};"></i>${posStyle.label}
                                        </span>
                                    </th>
                                    ${categoryNames.map(category => {
                                        const group = row.groups[category];
                                        const rate = Math.max(0, Math.min(1, group?.rate || 0));
                                        const z = Number(group?.z) || 0;
                                        const q = Number.isFinite(group?.q) ? group.q : 1;
                                        const count = group?.count || 0;
                                        const documents = group?.documentCount || groupSizes[category] || 0;
                                        return `
                                            <td class="tm-group-comparison-cell tm-rate-cell"
                                                data-rate="${rate}"
                                                data-z="${z}"
                                                data-q="${q}"
                                                data-count="${count}"
                                                data-documents="${documents}"
                                                style="--tm-rate-width:${(rate * 100).toFixed(1)}%;">
                                                <strong class="tm-group-value">${(rate * 100).toFixed(1)}%</strong>
                                                <small class="tm-group-detail">${count}/${documents}</small>
                                            </td>
                                        `;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="tm-table-footnote">
                文書率は語を1回以上含む文書の割合です。zとqは各群をその他すべての群と比較し、群ごとにFDR補正しています。
            </div>
        </section>
    `;
}

function setGroupComparisonMode(panel, mode) {
    const selectedMode = mode === 'z' ? 'z' : 'rate';
    panel.dataset.comparisonMode = selectedMode;
    panel.querySelectorAll('[data-comparison-mode]').forEach(button => {
        const active = button.dataset.comparisonMode === selectedMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    panel.querySelector('.tm-comparison-rate-legend')?.toggleAttribute('hidden', selectedMode !== 'rate');
    panel.querySelector('.tm-comparison-z-legend')?.toggleAttribute('hidden', selectedMode !== 'z');

    panel.querySelectorAll('.tm-group-comparison-cell').forEach(cell => {
        const rate = Number(cell.dataset.rate) || 0;
        const z = Number(cell.dataset.z) || 0;
        const q = Number(cell.dataset.q);
        const count = Number(cell.dataset.count) || 0;
        const documents = Number(cell.dataset.documents) || 0;
        const value = cell.querySelector('.tm-group-value');
        const detail = cell.querySelector('.tm-group-detail');

        cell.classList.remove('tm-rate-cell', 'tm-z-positive', 'tm-z-negative', 'tm-z-neutral');
        if (selectedMode === 'rate') {
            cell.classList.add('tm-rate-cell');
            cell.style.setProperty('--tm-rate-width', `${Math.max(0, Math.min(100, rate * 100)).toFixed(1)}%`);
            value.textContent = `${(rate * 100).toFixed(1)}%`;
            detail.textContent = `${count}/${documents}`;
            return;
        }

        const zClass = z > 0.05 ? 'tm-z-positive' : z < -0.05 ? 'tm-z-negative' : 'tm-z-neutral';
        cell.classList.add(zClass);
        cell.style.setProperty('--tm-z-opacity', String(Math.min(0.72, 0.12 + Math.abs(z) / 5)));
        value.textContent = `${z > 0 ? '+' : ''}${z.toFixed(2)}${q < 0.05 ? ' *' : ''}`;
        detail.textContent = formatComparisonQ(q);
    });
}

function bindGroupComparison(panel, items) {
    if (!panel) return;
    panel.querySelectorAll('.tm-segmented-control [data-comparison-mode]').forEach(button => {
        button.addEventListener('click', () => {
            setGroupComparisonMode(panel, button.dataset.comparisonMode);
        });
    });
    bindTermLinks(panel, items);
}

function renderPartOfSpeechRanking(termFreq, posByWord, tokenizerInfo, minFrequency) {
    const grouped = Object.fromEntries(POS_ORDER.map(pos => [pos, []]));
    Object.entries(termFreq).forEach(([word, frequency]) => {
        if (frequency < minFrequency) return;
        const pos = posByWord[word] || 'other';
        grouped[pos].push({ word, frequency });
    });

    const columns = POS_ORDER
        .filter(pos => grouped[pos].length > 0)
        .map(pos => {
            const style = POS_STYLES[pos] || POS_STYLES.other;
            const rows = grouped[pos]
                .sort((a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word, 'ja'))
                .slice(0, 10);
            return `
                <div class="tm-pos-column">
                    <div class="tm-pos-column-title">
                        <i style="background:${style.color};"></i>${style.label}
                    </div>
                    <ol>
                        ${rows.map(item => `
                            <li>
                                <button type="button" class="tm-term-link" data-term="${escapeHtml(item.word)}">${escapeHtml(item.word)}</button>
                                <span>${item.frequency}</span>
                            </li>
                        `).join('')}
                    </ol>
                </div>
            `;
        }).join('');

    return `
        <section class="tm-result-panel">
            <div class="tm-panel-heading">
                <div>
                    <h6>品詞別ランキング${tokenizerInfo.hasMorphology ? '' : '（推定）'}</h6>
                    <p>${tokenizerInfo.hasMorphology
                        ? '形態素解析の基本形と品詞タグを使用しています。'
                        : '高速分かち書きの語形から、大まかな品詞を推定しています。'}</p>
                </div>
            </div>
            <div class="tm-pos-grid">${columns || '<p>表示できる語がありません。</p>'}</div>
        </section>
    `;
}

function renderWordCloudPanel(id, title, subtitle) {
    return `
        <section class="tm-result-panel tm-visual-panel">
            <div class="tm-panel-heading tm-visual-heading">
                <div>
                    <h6>${escapeHtml(title)}</h6>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
                <button type="button" class="download-btn" data-target="${id}" title="PNG画像を保存" aria-label="${escapeHtml(title)}をPNG画像で保存">
                    <i class="fas fa-download"></i><span>画像保存</span>
                </button>
            </div>
            <canvas id="${id}" class="tm-wordcloud-canvas"></canvas>
            <div id="${id}-legend"></div>
        </section>
    `;
}

function renderNetworkPanel(id, settings) {
    const unitLabel = settings.cooccurrenceUnit === 'document' ? '文書' : '文';
    return `
        <section class="tm-result-panel tm-network-panel">
            <div class="tm-panel-heading tm-visual-heading">
                <div>
                    <h6>共起ネットワーク</h6>
                    <p>${unitLabel}単位のJaccard係数が強い関係を表示します。ノードを押すとKWICを表示します。</p>
                </div>
                <button type="button" class="download-btn" data-target="${id}" title="PNG画像を保存" aria-label="共起ネットワークをPNG画像で保存">
                    <i class="fas fa-download"></i><span>画像保存</span>
                </button>
            </div>
            <div id="${id}" class="tm-network-canvas"></div>
            <div id="${id}-legend"></div>
        </section>
    `;
}

function bindTermLinks(container, items) {
    container.querySelectorAll('.tm-term-link').forEach(button => {
        button.addEventListener('click', () => openKwicPanel(button.dataset.term, items));
    });
}

async function analyzeAndRender(items, container, prefix, context) {
    const documents = items.map(item => item.terms);
    const metrics = computeTermMetrics(documents, {
        idfLookup: context.globalMetrics?.termIdf
    });
    const minFrequency = context.settings.minFrequency;
    const frequencyWords = Object.entries(metrics.termFreq)
        .filter(([, frequency]) => frequency >= minFrequency)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
    const tfidfWords = metrics.termTfIdf
        .filter(([word, value]) => value > 0 && (metrics.termFreq[word] || 0) >= minFrequency);
    const featureRows = context.categorySpecificity || [];
    const positiveFeatureWords = featureRows
        .filter(row => row.z > 0 && (metrics.termFreq[row.term] || 0) >= minFrequency)
        .map(row => [row.term, row.z]);
    const secondCloudIsFeature = Boolean(context.categoryName && positiveFeatureWords.length > 0);

    const frequencyCloudId = `${prefix}-wordcloud`;
    const secondCloudId = secondCloudIsFeature
        ? `${prefix}-wordcloud-feature`
        : `${prefix}-wordcloud-tfidf`;
    const networkId = `${prefix}-network`;

    container.insertAdjacentHTML('beforeend', `
        ${renderSummary(items, metrics, context.tokenizerInfo)}
        ${renderTermTable(metrics, context.posByWord, minFrequency, prefix)}
        ${context.categoryName
            ? renderCategoryFeatureTable(featureRows, context.categoryName, minFrequency, metrics.termFreq)
            : ''}
        ${renderPartOfSpeechRanking(metrics.termFreq, context.posByWord, context.tokenizerInfo, minFrequency)}
        <div class="tm-visual-grid">
            ${renderWordCloudPanel(
                frequencyCloudId,
                'ワードクラウド（出現回数）',
                '大きい語ほど、分析対象内で多く使われています。'
            )}
            ${renderWordCloudPanel(
                secondCloudId,
                secondCloudIsFeature
                    ? `ワードクラウド（「${context.categoryName}」の特徴度）`
                    : 'ワードクラウド（TF-IDF）',
                secondCloudIsFeature
                    ? '大きい語ほど、他カテゴリより相対的に多く出現します。有意性は特徴語表のq値で確認します。'
                    : '大きい語ほど、文書内で重要かつ全体では比較的珍しい語です。'
            )}
        </div>
        ${renderNetworkPanel(networkId, context.settings)}
    `);

    const showKwic = word => openKwicPanel(word, items);
    context.updateStatus?.('頻度ワードクラウドを描画中...');
    await yieldToBrowser();
    await displayWordCloud(frequencyCloudId, frequencyWords, showKwic, {
        posByWord: context.posByWord,
        metricLabel: '出現回数が多い語ほど大きく表示'
    });

    context.updateStatus?.('重要語ワードクラウドを描画中...');
    await yieldToBrowser();
    await displayWordCloud(
        secondCloudId,
        secondCloudIsFeature ? positiveFeatureWords : tfidfWords,
        showKwic,
        {
            posByWord: context.posByWord,
            metricLabel: secondCloudIsFeature
                ? '調整済み標準化残差 z が大きい語ほど大きく表示'
                : 'TF-IDF合計が大きい語ほど大きく表示'
        }
    );

    container.querySelectorAll(
        `.download-btn[data-target="${frequencyCloudId}"], .download-btn[data-target="${secondCloudId}"]`
    ).forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            downloadCanvasAsImage(button.dataset.target);
        });
    });

    const cooccurrenceUnits = context.settings.cooccurrenceUnit === 'document'
        ? documents
        : items.flatMap(item => item.sentences.map(sentence => sentence.terms));
    const networkTerms = frequencyWords
        .slice(0, context.settings.networkTermLimit)
        .map(([word]) => word);
    context.updateStatus?.('共起ネットワークを描画中...');
    await yieldToBrowser();
    plotCooccurrenceNetwork(
        networkId,
        cooccurrenceUnits,
        networkTerms,
        metrics.termFreq,
        showKwic,
        {
            maxEdges: context.settings.networkEdgeLimit,
            minCooccurrence: context.settings.minCooccurrence,
            unitLabel: context.settings.cooccurrenceUnit === 'document' ? '文書' : '文'
        }
    );

    bindTermLinks(container, items);
    await yieldToBrowser();
}

function activateTab(tabId, renderCategorySections) {
    document.querySelectorAll('#analysis-results .tab-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.tabTarget === tabId);
        button.setAttribute('aria-selected', button.dataset.tabTarget === tabId ? 'true' : 'false');
    });
    document.querySelectorAll('#analysis-results .tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    if (tabId === 'tm-category') renderCategorySections?.();
}

async function runTextMining(currentData) {
    const inputMode = document.querySelector('[data-tm-input-mode].active')?.dataset.tmInputMode || 'column';
    const useDirectInput = inputMode === 'direct';
    const textVar = document.getElementById('text-var')?.value;
    const categoryVar = useDirectInput ? '' : document.getElementById('category-var')?.value;
    const directDocuments = useDirectInput
        ? String(document.getElementById('tm-direct-text')?.value || '')
            .split(/\r\n|\r|\n/)
            .map(text => text.trim())
            .filter(Boolean)
        : [];

    if (!useDirectInput && !textVar) {
        alert('テキスト変数を選択してください');
        return;
    }
    if (useDirectInput && directDocuments.length === 0) {
        alert('分析するテキストを入力してください');
        return;
    }

    const settings = readAnalysisSettings();
    const button = document.getElementById('run-text-btn');
    const originalButtonHtml = button.innerHTML;
    const updateStatus = message => {
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(message)}`;
    };
    button.disabled = true;

    const resultsArea = document.getElementById('analysis-results');
    resultsArea.style.display = 'block';
    resultsArea.innerHTML = `
        <div class="tab-container" role="tablist" aria-label="テキストマイニング結果">
            <button type="button" class="tab-btn active" data-tab-target="tm-overall" role="tab" aria-selected="true">全体分析</button>
            <button type="button" class="tab-btn" id="tm-cat-tab-btn" data-tab-target="tm-category" role="tab" aria-selected="false" style="display:none;">カテゴリ別分析</button>
        </div>
        <div id="tm-overall" class="tab-content active" role="tabpanel">
            <div id="overall-results"></div>
        </div>
        <div id="tm-category" class="tab-content" role="tabpanel">
            <div id="category-results"></div>
        </div>
        <div class="kwic-overlay" id="kwic-overlay"></div>
        <aside class="kwic-panel" id="kwic-panel" aria-hidden="true" aria-label="文脈検索">
            <div class="kwic-header">
                <div class="kwic-title">文脈検索（KWIC）</div>
                <button type="button" class="kwic-close" id="kwic-close" aria-label="文脈検索を閉じる">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="kwic-content"></div>
        </aside>
    `;
    document.getElementById('kwic-close')?.addEventListener('click', closeKwicPanel);
    document.getElementById('kwic-overlay')?.addEventListener('click', closeKwicPanel);

    let renderCategorySections = null;
    resultsArea.querySelectorAll('.tab-btn').forEach(tabButton => {
        tabButton.addEventListener('click', () => {
            activateTab(tabButton.dataset.tabTarget, renderCategorySections);
        });
    });

    try {
        updateStatus('日本語テキスト解析を準備中...');
        if (!getTokenizer()) await initTokenizer(updateStatus);
        const tokenizer = getTokenizer();
        const tokenizerInfo = getTokenizerInfo();

        const rawItems = useDirectInput
            ? directDocuments.map((text, index) => ({
                text,
                id: index,
                category: null
            }))
            : (currentData || []).map((row, index) => ({
                text: row[textVar] == null ? '' : String(row[textVar]).trim(),
                id: index,
                category: categoryVar ? row[categoryVar] : null
            })).filter(item => item.text.length > 0);
        if (rawItems.length === 0) throw new Error('有効なテキストデータがありません');

        updateStatus('テキストを解析中... 0%');
        const extractionOptions = {
            forceTerms: settings.forceTerms,
            stopWords: settings.stopWords
        };
        const items = await analyzeItemsInChunks(
            rawItems,
            tokenizer,
            extractionOptions,
            updateStatus
        );
        const posByWord = buildPartOfSpeechLookup(items);
        const globalMetrics = computeTermMetrics(items.map(item => item.terms));
        const categorySpecificity = categoryVar
            ? computeCategorySpecificity(
                items
                    .filter(item => item.category != null && String(item.category).trim() !== '')
                    .map(item => ({ category: String(item.category), tokens: item.terms })),
                { minDocumentFrequency: Math.max(2, settings.minFrequency) }
            )
            : {};

        updateStatus('全体分析を描画中...');
        const overallContainer = document.getElementById('overall-results');
        overallContainer.innerHTML = `
            <div class="tm-section-title">
                <h4>全体分析</h4>
                <span>N=${items.length}</span>
            </div>
        `;
        await analyzeAndRender(items, overallContainer, 'overall', {
            settings,
            tokenizerInfo,
            posByWord,
            globalMetrics,
            updateStatus
        });

        if (categoryVar) {
            const categories = [...new Set(items
                .map(item => item.category)
                .filter(value => value != null && String(value).trim() !== ''))]
                .sort((a, b) => String(a).localeCompare(String(b), 'ja', { numeric: true }));
            const categoryTab = document.getElementById('tm-cat-tab-btn');
            categoryTab.style.display = categories.length > 0 ? '' : 'none';
            const categoryResults = document.getElementById('category-results');
            let categoryRenderPromise = null;

            renderCategorySections = () => {
                if (categoryRenderPromise) return categoryRenderPromise;
                categoryRenderPromise = (async () => {
                    const categoryNames = categories.map(category => String(category));
                    const groupSizes = Object.fromEntries(categoryNames.map(category => [
                        category,
                        items.filter(item => String(item.category) === category).length
                    ]));
                    const comparisonRows = buildGroupComparisonRows(
                        categorySpecificity,
                        categoryNames,
                        {
                            termFrequency: globalMetrics.termFreq,
                            groupSizes,
                            minFrequency: settings.minFrequency,
                            limit: 30
                        }
                    );
                    categoryResults.innerHTML = `
                        <div class="tm-category-method">
                            <strong>カテゴリ比較:</strong>
                            最初に全群を横断比較し、その下に群ごとの抽出語・特徴語・ワードクラウド・共起ネットワークを連続表示します。
                        </div>
                        ${renderGroupComparison(comparisonRows, categories, groupSizes, posByWord)}
                        <div class="tm-category-stack"></div>
                    `;
                    bindGroupComparison(
                        categoryResults.querySelector('.tm-group-comparison-panel'),
                        items
                    );
                    const stack = categoryResults.querySelector('.tm-category-stack');

                    for (const [index, category] of categories.entries()) {
                        const categoryItems = items.filter(item => item.category === category);
                        const section = document.createElement('section');
                        section.className = 'tm-category-section';
                        section.id = `cat-results-${index}-${sanitizeId(category)}`;
                        section.innerHTML = `
                            <div class="tm-section-title">
                                <h4>${escapeHtml(category)}</h4>
                                <span>N=${categoryItems.length}</span>
                            </div>
                        `;
                        stack.appendChild(section);
                        await analyzeAndRender(categoryItems, section, `cat-${index}-${sanitizeId(category)}`, {
                            settings,
                            tokenizerInfo,
                            posByWord,
                            globalMetrics,
                            categoryName: String(category),
                            categorySpecificity: categorySpecificity[String(category)] || []
                        });
                    }
                })().catch(error => {
                    console.error(error);
                    categoryResults.innerHTML = `
                        <div class="error-message">カテゴリ別分析の描画中にエラーが発生しました: ${escapeHtml(error.message)}</div>
                    `;
                });
                return categoryRenderPromise;
            };

            categoryResults.innerHTML = `
                <div class="tm-method-note">
                    「${escapeHtml(categoryVar)}」の${categories.length}カテゴリを、タブを開いたときに連続表示します。
                </div>
            `;
        }
    } catch (error) {
        console.error(error);
        alert(`解析中にエラーが発生しました: ${error.message}`);
    } finally {
        button.innerHTML = originalButtonHtml;
        button.disabled = false;
    }
}

export function render(container, currentData, characteristics) {
    const data = Array.isArray(currentData) ? currentData : [];
    const safeCharacteristics = characteristics || {
        numericColumns: [],
        categoricalColumns: [],
        textColumns: []
    };
    const {
        numericColumns = [],
        categoricalColumns = [],
        textColumns = []
    } = safeCharacteristics;
    const numericSet = new Set(numericColumns);
    const availableTextColumns = [
        ...textColumns,
        ...categoricalColumns.filter(column => !numericSet.has(column) && !textColumns.includes(column))
    ];
    const hasColumnInput = data.length > 0 && availableTextColumns.length > 0;
    const initialInputMode = hasColumnInput ? 'column' : 'direct';

    container.innerHTML = `
        <div class="text-mining-container">
            <div class="analysis-title-banner">
                <h3><i class="fas fa-comment-dots"></i> テキストマイニング</h3>
                <p>分かち書き・文書頻度・特徴語・共起関係をブラウザ内で高速に分析します</p>
            </div>

            <div class="collapsible-section info-sections" style="margin-bottom:2rem;">
                <div class="collapsible-header collapsed" onclick="this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
                    <h3><i class="fas fa-info-circle"></i> 分析の概要・方法</h3>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="collapsible-content collapsed">
                    <div class="note">
                        <strong><i class="fas fa-lightbulb"></i> KH Coder型の探索手順</strong>
                        <p>頻度や特徴度で注目語を見つけ、KWICで原文を確認し、共起ネットワークで語同士の文脈を探索します。</p>
                        <p>外部の大容量辞書は読み込まず、ブラウザ内蔵の日本語分割機能を使用します。品詞は語形からの推定です。</p>
                    </div>
                    <h4>集計単位と指標</h4>
                    <ul>
                        <li><strong>TF / DF:</strong> 語の出現回数と、その語を含む文書数です。</li>
                        <li><strong>TF-IDF:</strong> 文書長で調整した語頻度と、全体での珍しさを組み合わせます。</li>
                        <li><strong>カテゴリ特徴度:</strong> 文書出現率の調整済み標準化残差を用い、q値を多重比較補正します。</li>
                        <li><strong>共起:</strong> 文または文書に一緒に現れた語のJaccard係数を使います。</li>
                    </ul>
                </div>
            </div>

            <section class="tm-settings-panel">
                <div class="tm-input-toolbar">
                    <span>入力方法</span>
                    <div class="tm-segmented-control" role="group" aria-label="テキストの入力方法">
                        <button type="button" id="tm-input-column" data-tm-input-mode="column"
                            ${hasColumnInput ? '' : 'disabled'}
                            aria-pressed="${initialInputMode === 'column'}">
                            <i class="fas fa-columns"></i> データ列
                        </button>
                        <button type="button" id="tm-input-direct" data-tm-input-mode="direct"
                            aria-pressed="${initialInputMode === 'direct'}">
                            <i class="fas fa-align-left"></i> 直接入力
                        </button>
                    </div>
                </div>

                <div id="tm-column-input-panel" class="tm-input-panel">
                    <div class="grid-2-cols tm-variable-grid">
                        <div id="text-var-container"></div>
                        <div id="category-var-container"></div>
                    </div>
                </div>

                <div id="tm-direct-input-panel" class="tm-input-panel" hidden>
                    <label for="tm-direct-text">
                        <span><i class="fas fa-font"></i> 分析するテキスト</span>
                        <small>1行を1文書として集計</small>
                    </label>
                    <textarea id="tm-direct-text" rows="9"
                        placeholder="授業が分かりやすかった&#10;データ分析の実習が楽しかった&#10;グラフから傾向を発見できた"></textarea>
                    <div id="tm-direct-text-status" class="tm-input-status" role="status" aria-live="polite">0文書・0文字</div>
                </div>

                <details class="tm-advanced-settings">
                    <summary><i class="fas fa-sliders-h"></i> 抽出・共起の詳細設定</summary>
                    <div class="tm-settings-grid">
                        <label>
                            <span>最小出現数</span>
                            <input type="number" id="tm-min-frequency" value="2" min="1" max="1000">
                        </label>
                        <label>
                            <span>共起の単位</span>
                            <select id="tm-cooccurrence-unit">
                                <option value="sentence" selected>文</option>
                                <option value="document">文書（1行）</option>
                            </select>
                        </label>
                        <label>
                            <span>ネットワークの語数</span>
                            <input type="number" id="tm-network-term-limit" value="35" min="10" max="80">
                        </label>
                        <label>
                            <span>表示する線の上限</span>
                            <input type="number" id="tm-network-edge-limit" value="50" min="10" max="200">
                        </label>
                        <label>
                            <span>最小共起回数</span>
                            <input type="number" id="tm-min-cooccurrence" value="2" min="1" max="100">
                        </label>
                        <label class="tm-wide-setting">
                            <span>除外語（改行・読点区切り）</span>
                            <textarea id="tm-stop-words" rows="2" placeholder="例：今回、回答"></textarea>
                        </label>
                        <label class="tm-wide-setting">
                            <span>強制抽出語（改行・読点区切り）</span>
                            <textarea id="tm-force-terms" rows="2" placeholder="例：データサイエンス、生成AI"></textarea>
                        </label>
                    </div>
                </details>

                <div id="run-text-btn-container"></div>
            </section>

            <div id="tm-data-overview" class="info-sections" style="margin-bottom:2rem;"></div>
            <div id="analysis-results" style="display:none;"></div>
        </div>
    `;

    if (data.length > 0) {
        renderDataOverview('#tm-data-overview', data, safeCharacteristics, {
            initiallyCollapsed: true
        });
    }
    createVariableSelector('text-var-container', availableTextColumns, 'text-var', {
        label: '<i class="fas fa-font"></i> 分析するテキスト変数（必須）:',
        multiple: false
    });
    createVariableSelector('category-var-container', categoricalColumns, 'category-var', {
        label: '<i class="fas fa-layer-group"></i> カテゴリ変数（任意・比較用）:',
        multiple: false,
        placeholder: '選択なし（全体分析のみ）'
    });
    createAnalysisButton(
        'run-text-btn-container',
        '分析を実行',
        () => runTextMining(data),
        { id: 'run-text-btn' }
    );

    const columnInputPanel = document.getElementById('tm-column-input-panel');
    const directInputPanel = document.getElementById('tm-direct-input-panel');
    const dataOverview = document.getElementById('tm-data-overview');
    const results = document.getElementById('analysis-results');
    const directInput = document.getElementById('tm-direct-text');
    const directStatus = document.getElementById('tm-direct-text-status');
    const inputModeButtons = [...document.querySelectorAll('[data-tm-input-mode]')];

    const updateDirectStatus = () => {
        const documents = String(directInput?.value || '')
            .split(/\r\n|\r|\n/)
            .map(text => text.trim())
            .filter(Boolean);
        const characterCount = documents.reduce((sum, text) => sum + text.length, 0);
        directStatus.textContent = `${documents.length.toLocaleString()}文書・${characterCount.toLocaleString()}文字`;
    };

    const setInputMode = mode => {
        if (mode === 'column' && !hasColumnInput) return;
        inputModeButtons.forEach(button => {
            const isActive = button.dataset.tmInputMode === mode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        columnInputPanel.hidden = mode !== 'column';
        directInputPanel.hidden = mode !== 'direct';
        dataOverview.hidden = mode !== 'column' || data.length === 0;
        results.style.display = 'none';
        results.innerHTML = '';
        if (mode === 'direct') directInput.focus();
    };

    inputModeButtons.forEach(button => {
        button.addEventListener('click', () => setInputMode(button.dataset.tmInputMode));
    });
    directInput?.addEventListener('input', updateDirectStatus);
    updateDirectStatus();
    setInputMode(initialInputMode);
}
