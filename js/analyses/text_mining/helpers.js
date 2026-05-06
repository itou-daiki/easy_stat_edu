/**
 * @fileoverview テキストマイニングのヘルパー関数モジュール
 * ストップワード、トークナイザー初期化、画像ダウンロード機能を提供
 * @module text_mining/helpers
 */

// ======================================================================
// ストップワードリスト
// ======================================================================

/**
 * 日本語ストップワードセット
 * 助詞、助動詞、記号、一般的すぎる語を除外
 * @type {Set<string>}
 */
export const STOP_WORDS = new Set([
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
    'とき', 'ところ', 'ほう', 'ほど', 'まま', 'よる', 'なか', 'うち',
    // TinySegmenterで出やすい機能語・接尾的な断片
    'たけど', 'だけど', 'やすいけど', 'しやすい', 'にくい', 'がつい',
    'やすい', 'づらい', 'られる', 'くれる', 'される', 'できる'
]);

// ======================================================================
// トークナイザー
// ======================================================================

/** @type {Object|null} トークナイザーインスタンス */
let tokenizer = null;

/**
 * トークナイザーインスタンスを取得
 * @returns {Object|null} トークナイザー
 */
export function getTokenizer() {
    return tokenizer;
}

/**
 * トークナイザーを初期化
 * @param {Function} [statusCallback] - ステータス更新コールバック
 * @returns {Promise<void>}
 */
export async function initTokenizer(statusCallback) {
    return new Promise((resolve, reject) => {
        try {
            if (statusCallback) statusCallback('解析エンジンを初期化中...');

            if (typeof TinySegmenter === 'undefined') {
                reject(new Error('TinySegmenter ライブラリが読み込まれていません'));
                return;
            }

            tokenizer = new TinySegmenter();
            if (statusCallback) statusCallback('解析エンジンの準備完了！');
            resolve();
        } catch (err) {
            console.error('TinySegmenter Init Error:', err);
            if (statusCallback) statusCallback('解析エンジンの初期化に失敗しました。');
            reject(new Error('形態素解析エンジンの初期化に失敗しました: ' + err.message));
        }
    });
}

// ======================================================================
// テキスト前処理・計算ロジック
// ======================================================================

const EDGE_PUNCTUATION = /^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+|[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+$/g;
const SYMBOLS_ONLY = /^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+$/;

/**
 * 表記ゆれを少し抑えるため、単語を正規化する。
 * @param {string} token - トークン
 * @returns {string}
 */
export function normalizeToken(token) {
    if (token == null) return '';
    return String(token)
        .normalize('NFKC')
        .toLowerCase()
        .trim()
        .replace(EDGE_PUNCTUATION, '');
}

/**
 * 分析対象にするトークンかどうかを判定する。
 * @param {string} token - 正規化済みトークン
 * @returns {boolean}
 */
export function isContentToken(token) {
    if (!token || token.length <= 1) return false;
    if (STOP_WORDS.has(token)) return false;
    if (/^[ぁ-ん]+$/.test(token) && token.length <= 2) return false;
    if (/[っッ]$/.test(token)) return false;
    if (/^[0-9.,]+$/.test(token)) return false;
    if (/^[a-z]$/.test(token)) return false;
    if (SYMBOLS_ONLY.test(token)) return false;
    return true;
}

/**
 * TinySegmenterは品詞タグを返さないため、語形から大まかな品詞を推定する。
 * @param {string} token - 正規化済みトークン
 * @returns {'noun'|'verb'|'adjective'|'alnum'|'other'}
 */
export function inferPartOfSpeech(token) {
    const word = normalizeToken(token);
    if (!word) return 'other';
    if (/^[a-z][a-z0-9+.#-]*$/i.test(word) || /[0-9]/.test(word)) return 'alnum';

    const adjectiveWords = new Set([
        '良い', '悪い', '楽しい', '難しい', '面白い', '面白', '便利', '簡単',
        '大変', '嬉しい', '軽い', '重い', '遅い', '早い', '高い', '低い',
        '必要', '重要', '安全', '活発'
    ]);
    if (adjectiveWords.has(word) || /(しい|ない|たい|やすい|づらい)$/.test(word)) {
        return 'adjective';
    }

    const verbWords = new Set([
        '分かる', '動かす', '疲れる', '困る', '思う', '思い', '感じる', '感じ',
        '増える', '増え', '高まる', '調べる', '調べ', '慣れる', '慣れ',
        '学ぶ', '学ん', '作る', '作り', '作れる', '聞ける', '見直す', '見直し',
        '見直せる', '返れる', '使う', '活用', '導入', '共有', '検索', '交流',
        '発表', '理解', '指導', '研修', '勉強', '集中', '操作'
    ]);
    if (verbWords.has(word) || /(する|した|して|できる|される|られる|える|ける|れる|める|ます)$/.test(word)) {
        return 'verb';
    }

    if (/^[\u3040-\u30ffー]+$/.test(word)) return 'noun';
    if (/[\u3400-\u9fff]/.test(word)) return 'noun';
    return 'other';
}

/**
 * 1行を1文書としてトークン配列を返す（ストップワード等を除外）。
 * @param {string} text - 文書テキスト
 * @param {Object} tokenizer - TinySegmenter インスタンス
 * @returns {string[]}
 */
export function tokenizeDocument(text, tokenizer) {
    if (!text || typeof text !== 'string' || !tokenizer) return [];
    return tokenizer.segment(text)
        .map(normalizeToken)
        .filter(isContentToken);
}

/**
 * 共起分析・KWIC用にテキストを文単位へ分割する。
 * @param {string} text - 文書テキスト
 * @returns {string[]}
 */
export function splitTextIntoSentences(text) {
    if (!text || typeof text !== 'string') return [];
    return text
        .split(/[。！？!?．.\n\r]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * 文書集合に対して語の頻度、文書頻度、TF-IDFを計算する。
 * TF は文書長で正規化し、IDF は log((1 + N) / (1 + df)) を使う。
 * カテゴリ別分析では options.idfLookup に全体コーパスの IDF を渡すことで、
 * カテゴリ内だけで過度に重みが変わる問題を抑える。
 * @param {Array<string[]>} documents - 各文書のトークン配列（1行＝1文書）
 * @param {{idfLookup?: Object<string, number>}} [options]
 * @returns {{ termTfIdf: Array<[string, number]>, termDf: Object<string, number>, termFreq: Object<string, number>, termIdf: Object<string, number>, documentCount: number }}
 */
export function computeTermMetrics(documents, options = {}) {
    const docs = Array.isArray(documents) ? documents : [];
    const N = docs.length;
    if (N === 0) {
        return { termTfIdf: [], termDf: {}, termFreq: {}, termIdf: {}, documentCount: 0 };
    }

    const termFreq = {};
    const docFreq = {};
    const tfPerDoc = docs.map(() => ({}));

    docs.forEach((tokens, dIdx) => {
        const counts = {};
        (Array.isArray(tokens) ? tokens : []).forEach(t => {
            counts[t] = (counts[t] || 0) + 1;
            termFreq[t] = (termFreq[t] || 0) + 1;
        });

        Object.entries(counts).forEach(([t, count]) => {
            docFreq[t] = (docFreq[t] || 0) + 1;
            tfPerDoc[dIdx][t] = count / Math.max(tokens.length, 1);
        });
    });

    const termIdf = {};
    Object.keys(termFreq).forEach(t => {
        termIdf[t] = options.idfLookup?.[t] ?? Math.log((1 + N) / (1 + (docFreq[t] || 0)));
    });

    const tfIdfByTerm = {};
    tfPerDoc.forEach(docTf => {
        Object.entries(docTf).forEach(([t, tf]) => {
            tfIdfByTerm[t] = (tfIdfByTerm[t] || 0) + tf * termIdf[t];
        });
    });

    const termTfIdf = Object.entries(tfIdfByTerm)
        .sort((a, b) => b[1] - a[1] || (termFreq[b[0]] || 0) - (termFreq[a[0]] || 0) || a[0].localeCompare(b[0], 'ja'));

    return { termTfIdf, termDf: docFreq, termFreq, termIdf, documentCount: N };
}

/**
 * 文単位の語出現から共起エッジを作成する。
 * 重みは「同じ文に出現した文集合」の Jaccard 係数。
 * @param {Array<string[]>} sentences - 文ごとのトークン配列
 * @param {string[]} topWords - 対象語
 * @param {{threshold?: number, maxEdges?: number}} [options]
 * @returns {Array<{from: string, to: string, weight: number, intersection: number}>}
 */
export function buildCooccurrenceEdges(sentences, topWords, options = {}) {
    const threshold = options.threshold ?? 0.1;
    const maxEdges = options.maxEdges ?? 80;
    const words = Array.isArray(topWords) ? topWords : [];
    const edges = [];
    const wordPresence = {};

    words.forEach(w => { wordPresence[w] = new Set(); });

    (Array.isArray(sentences) ? sentences : []).forEach((tokens, sIdx) => {
        new Set(tokens || []).forEach(w => {
            if (wordPresence[w]) wordPresence[w].add(sIdx);
        });
    });

    for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
            const w1 = words[i];
            const w2 = words[j];
            const set1 = wordPresence[w1];
            const set2 = wordPresence[w2];
            let intersection = 0;
            set1.forEach(id => { if (set2.has(id)) intersection++; });

            if (intersection === 0) continue;
            const union = new Set([...set1, ...set2]).size;
            const weight = union > 0 ? intersection / union : 0;
            if (weight > threshold) edges.push({ from: w1, to: w2, weight, intersection });
        }
    }

    return edges
        .sort((a, b) => b.weight - a.weight || b.intersection - a.intersection || a.from.localeCompare(b.from, 'ja'))
        .slice(0, maxEdges);
}

// ======================================================================
// 画像ダウンロード
// ======================================================================

/**
 * Canvas要素を画像としてダウンロード
 * @param {string} targetId - ダウンロード対象のCanvas要素ID
 */
export function downloadCanvasAsImage(targetId) {
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
        tempCanvas.width = Math.max(canvas.width, 1);
        tempCanvas.height = Math.max(canvas.height, 1);
        const ctx = tempCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 白背景で塗りつぶし
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 元の画像を重ねる
        ctx.drawImage(canvas, 0, 0);

        // ダウンロード処理
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        let prefix = 'text_mining';
        if (targetId.includes('wordcloud-tfidf')) prefix = 'wordcloud_tfidf';
        else if (targetId.includes('wordcloud')) prefix = 'wordcloud_frequency';
        else if (targetId.includes('network')) prefix = 'cooccurrence_network';
        const filename = `${prefix}_${timestamp}.png`;

        link.download = filename;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        alert('画像のダウンロードに失敗しました。');
    }
}
