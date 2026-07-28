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
    'とき', 'ところ', 'ほう', 'ほど', 'まま', 'よる', 'なか', 'うち', 'つもり',
    'そのため', 'そのために', 'ために', 'ことに', 'ものに', 'ながら', 'かって',
    'について', 'に対して', 'において',
    // TinySegmenterで出やすい機能語・接尾的な断片
    'たけど', 'だけど', 'やすいけど', 'しやすい', 'にくい', 'がつい',
    'やすい', 'づらい', 'られる', 'くれる', 'される', 'できる'
]);

// ======================================================================
// トークナイザー
// ======================================================================

/** @type {Object|null} 正規化済みトークナイザー */
let tokenizer = null;

let tokenizerInfo = {
    engine: 'none',
    label: '未初期化',
    hasMorphology: false,
    warning: ''
};

/**
 * トークナイザーインスタンスを取得
 * @returns {Object|null} トークナイザー
 */
export function getTokenizer() {
    return tokenizer;
}

export function getTokenizerInfo() {
    return { ...tokenizerInfo };
}

/**
 * ブラウザ内蔵の単語分割器を、アプリ共通のトークン形式へ変換する。
 * 外部辞書を読み込まないため、静的ホスティングでもすぐに利用できる。
 * @param {Function} [SegmenterConstructor]
 * @returns {Object|null}
 */
export function createIntlSegmenterTokenizer(
    SegmenterConstructor = globalThis.Intl?.Segmenter
) {
    if (typeof SegmenterConstructor !== 'function') return null;

    try {
        const segmenter = new SegmenterConstructor('ja', { granularity: 'word' });
        return {
            engine: 'intl-segmenter',
            analyze(text) {
                return [...segmenter.segment(String(text || ''))]
                    .filter(part => part.isWordLike !== false && /\S/u.test(part.segment))
                    .map(part => ({
                        surface_form: part.segment,
                        basic_form: part.segment,
                        pos: '',
                        pos_detail_1: ''
                    }));
            }
        };
    } catch (error) {
        console.warn('Intl.Segmenter initialization failed. Falling back locally.', error);
        return null;
    }
}

/**
 * トークナイザーを初期化
 * @param {Function} [statusCallback] - ステータス更新コールバック
 * @returns {Promise<void>}
 */
export async function initTokenizer(statusCallback) {
    if (tokenizer) return;

    if (statusCallback) statusCallback('日本語テキスト解析を準備中...');

    const intlTokenizer = createIntlSegmenterTokenizer();
    if (intlTokenizer) {
        tokenizer = intlTokenizer;
        tokenizerInfo = {
            engine: 'intl-segmenter',
            label: 'ブラウザ内蔵（高速分かち書き）',
            hasMorphology: false,
            warning: '品詞は語形から推定し、活用形は原則として別の語として集計します。'
        };
        if (statusCallback) statusCallback('高速解析エンジンの準備完了');
        return;
    }

    if (typeof TinySegmenter === 'undefined') {
        throw new Error('日本語テキスト解析機能を読み込めませんでした');
    }

    const tinySegmenter = new TinySegmenter();
    tokenizer = {
        engine: 'tiny-segmenter',
        analyze(text) {
            return tinySegmenter.segment(String(text || '')).map(surface => ({
                surface_form: surface,
                basic_form: surface,
                pos: '',
                pos_detail_1: ''
            }));
        }
    };
    tokenizerInfo = {
        engine: 'tiny-segmenter',
        label: 'TinySegmenter（ローカル分かち書き）',
        hasMorphology: false,
        warning: '品詞は語形から推定し、活用形は原則として別の語として集計します。'
    };
    if (statusCallback) statusCallback('ローカル解析エンジンの準備完了');
}

// ======================================================================
// テキスト前処理・計算ロジック
// ======================================================================

const EDGE_PUNCTUATION = /^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+|[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+$/g;
const SYMBOLS_ONLY = /^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~、。！？「」『』（）［］【】〈〉《》・…ー〜￥]+$/;
const EXCLUDED_MORPH_POS = new Set(['助詞', '助動詞', '記号', 'フィラー', '接続詞']);

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
 * Kuromojiの品詞を画面表示用の大分類に変換する。
 * @param {string} rawPos - 形態素解析器の品詞
 * @param {string} token - 基本形
 * @param {string} [posDetail] - 品詞細分類
 * @returns {'noun'|'proper_noun'|'verbal_noun'|'adjectival_noun'|'verb'|'adjective'|'adverb'|'adnominal'|'interjection'|'alnum'|'other'}
 */
export function mapPartOfSpeech(rawPos, token, posDetail = '') {
    const word = normalizeToken(token);
    if (/^[a-z][a-z0-9+.#-]*$/i.test(word) || /[0-9]/.test(word)) return 'alnum';
    if (rawPos === '名詞' && posDetail === '固有名詞') return 'proper_noun';
    if (rawPos === '名詞' && posDetail === 'サ変接続') return 'verbal_noun';
    if (rawPos === '名詞' && posDetail === '形容動詞語幹') return 'adjectival_noun';

    const map = {
        '名詞': 'noun',
        '動詞': 'verb',
        '形容詞': 'adjective',
        '副詞': 'adverb',
        '連体詞': 'adnominal',
        '感動詞': 'interjection'
    };
    return map[rawPos] || 'other';
}

/**
 * TinySegmenter利用時に、語形から大まかな品詞を推定する。
 * @param {string} token - 正規化済みトークン
 * @returns {'noun'|'verb'|'adjective'|'adverb'|'adnominal'|'interjection'|'alnum'|'other'}
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

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitByForcedTerms(text, forcedTerms) {
    const normalizedText = String(text || '').normalize('NFKC');
    const terms = [...new Set((forcedTerms || [])
        .map(normalizeToken)
        .filter(Boolean))]
        .sort((a, b) => b.length - a.length);

    if (terms.length === 0) return [{ text: normalizedText, forced: false }];

    const forcedSet = new Set(terms);
    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
    return normalizedText
        .split(pattern)
        .filter(Boolean)
        .map(part => ({
            text: part,
            forced: forcedSet.has(normalizeToken(part))
        }));
}

/**
 * 文書を基本形・品詞付きで解析する。
 * @param {string} text - 文書テキスト
 * @param {Object} tokenizerInstance - initTokenizerで生成したトークナイザー
 * @param {{forceTerms?: string[], stopWords?: Set<string>}} [options]
 * @returns {Array<{term: string, surface: string, pos: string, rawPos: string, posDetail: string, forced: boolean}>}
 */
export function analyzeDocument(text, tokenizerInstance, options = {}) {
    if (!text || typeof text !== 'string' || !tokenizerInstance?.analyze) return [];

    const customStopWords = new Set(
        [...(options.stopWords || [])].map(normalizeToken).filter(Boolean)
    );
    const analyzed = [];

    splitByForcedTerms(text, options.forceTerms).forEach(part => {
        if (part.forced) {
            const term = normalizeToken(part.text);
            if (term && !customStopWords.has(term)) {
                analyzed.push({
                    term,
                    surface: part.text,
                    pos: 'noun',
                    rawPos: '強制抽出語',
                    posDetail: '',
                    forced: true
                });
            }
            return;
        }

        tokenizerInstance.analyze(part.text).forEach(rawToken => {
            const surface = String(rawToken.surface_form ?? rawToken.word ?? '');
            const basic = rawToken.basic_form && rawToken.basic_form !== '*'
                ? rawToken.basic_form
                : surface;
            const term = normalizeToken(basic);
            const surfaceNormalized = normalizeToken(surface);
            const rawPos = String(rawToken.pos || '');
            const posDetail = String(rawToken.pos_detail_1 || '');

            if (EXCLUDED_MORPH_POS.has(rawPos)) return;
            if (customStopWords.has(term) || customStopWords.has(surfaceNormalized)) return;
            if (!isContentToken(term)) return;

            analyzed.push({
                term,
                surface,
                pos: tokenizerInstance.engine === 'kuromoji'
                    ? mapPartOfSpeech(rawPos, term, posDetail)
                    : inferPartOfSpeech(term),
                rawPos,
                posDetail,
                forced: false
            });
        });
    });

    return analyzed;
}

/**
 * 1行を1文書としてトークン配列を返す（ストップワード等を除外）。
 * @param {string} text - 文書テキスト
 * @param {Object} tokenizer - TinySegmenter インスタンス
 * @param {{forceTerms?: string[], stopWords?: Set<string>}} [options]
 * @returns {string[]}
 */
export function tokenizeDocument(text, tokenizer, options = {}) {
    return analyzeDocument(text, tokenizer, options).map(token => token.term);
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
 * @returns {{ termTfIdf: Array<[string, number]>, termDf: Object<string, number>, termDocumentRate: Object<string, number>, termFreq: Object<string, number>, termIdf: Object<string, number>, documentCount: number }}
 */
export function computeTermMetrics(documents, options = {}) {
    const docs = Array.isArray(documents) ? documents : [];
    const N = docs.length;
    if (N === 0) {
        return {
            termTfIdf: [],
            termDf: {},
            termDocumentRate: {},
            termFreq: {},
            termIdf: {},
            documentCount: 0
        };
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
    const termDocumentRate = {};
    Object.keys(termFreq).forEach(t => {
        termIdf[t] = options.idfLookup?.[t] ?? Math.log((1 + N) / (1 + (docFreq[t] || 0)));
        termDocumentRate[t] = (docFreq[t] || 0) / N;
    });

    const tfIdfByTerm = {};
    tfPerDoc.forEach(docTf => {
        Object.entries(docTf).forEach(([t, tf]) => {
            tfIdfByTerm[t] = (tfIdfByTerm[t] || 0) + tf * termIdf[t];
        });
    });

    const termTfIdf = Object.entries(tfIdfByTerm)
        .sort((a, b) => b[1] - a[1] || (termFreq[b[0]] || 0) - (termFreq[a[0]] || 0) || a[0].localeCompare(b[0], 'ja'));

    return {
        termTfIdf,
        termDf: docFreq,
        termDocumentRate,
        termFreq,
        termIdf,
        documentCount: N
    };
}

function standardNormalCdf(value) {
    const x = Math.abs(value) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * x);
    const polynomial = (((((1.061405429 * t - 1.453152027) * t)
        + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - polynomial * Math.exp(-x * x);
    return value >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

function benjaminiHochberg(entries) {
    const sorted = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => a.entry.p - b.entry.p);
    let previous = 1;

    for (let rank = sorted.length; rank >= 1; rank--) {
        const item = sorted[rank - 1];
        const adjusted = Math.min(previous, item.entry.p * sorted.length / rank, 1);
        item.entry.q = adjusted;
        previous = adjusted;
    }
    return entries;
}

/**
 * カテゴリごとの特徴語を文書出現の2×2表から算出する。
 * z は調整済み標準化残差、q はカテゴリ内でのBenjamini-Hochberg補正値。
 * @param {Array<{category: *, tokens: string[]}>} records
 * @param {{minDocumentFrequency?: number}} [options]
 * @returns {Object<string, Array<{term: string, z: number, p: number, q: number, logOdds: number, inCategory: number, outsideCategory: number, categoryRate: number, outsideRate: number}>>}
 */
export function computeCategorySpecificity(records, options = {}) {
    const validRecords = (Array.isArray(records) ? records : [])
        .filter(record => record && record.category != null && Array.isArray(record.tokens));
    const totalDocuments = validRecords.length;
    const minDf = Math.max(1, Number(options.minDocumentFrequency) || 1);
    if (totalDocuments === 0) return {};

    const categories = [...new Set(validRecords.map(record => String(record.category)))];
    const documentTerms = validRecords.map(record => new Set(record.tokens));
    const globalDf = {};
    documentTerms.forEach(terms => {
        terms.forEach(term => {
            globalDf[term] = (globalDf[term] || 0) + 1;
        });
    });

    const result = {};
    categories.forEach(category => {
        const categoryIndexes = [];
        validRecords.forEach((record, index) => {
            if (String(record.category) === category) categoryIndexes.push(index);
        });

        const categorySet = new Set(categoryIndexes);
        const categoryDocuments = categoryIndexes.length;
        const outsideDocuments = totalDocuments - categoryDocuments;
        if (categoryDocuments === 0 || outsideDocuments === 0) {
            result[category] = [];
            return;
        }

        const rows = [];
        Object.entries(globalDf).forEach(([term, totalWithTerm]) => {
            if (totalWithTerm < minDf || totalWithTerm >= totalDocuments) return;

            let inCategory = 0;
            categorySet.forEach(index => {
                if (documentTerms[index].has(term)) inCategory++;
            });
            const outsideCategory = totalWithTerm - inCategory;
            const expected = categoryDocuments * totalWithTerm / totalDocuments;
            const rowShare = categoryDocuments / totalDocuments;
            const termShare = totalWithTerm / totalDocuments;
            const denominator = Math.sqrt(expected * (1 - rowShare) * (1 - termShare));
            if (!(denominator > 0)) return;

            const z = (inCategory - expected) / denominator;
            const p = Math.min(1, 2 * (1 - standardNormalCdf(Math.abs(z))));
            const b = categoryDocuments - inCategory;
            const d = outsideDocuments - outsideCategory;
            const logOdds = Math.log((inCategory + 0.5) / (b + 0.5))
                - Math.log((outsideCategory + 0.5) / (d + 0.5));

            rows.push({
                term,
                z,
                p,
                q: 1,
                logOdds,
                inCategory,
                outsideCategory,
                categoryDocuments,
                outsideDocuments,
                totalWithTerm,
                categoryRate: inCategory / categoryDocuments,
                outsideRate: outsideCategory / outsideDocuments
            });
        });

        benjaminiHochberg(rows);
        result[category] = rows.sort((a, b) =>
            b.z - a.z
            || b.inCategory - a.inCategory
            || a.term.localeCompare(b.term, 'ja')
        );
    });

    return result;
}

/**
 * カテゴリ別の特徴度を、同じ語について全群を横並びに比較できる行へ変換する。
 * @param {Object<string, Array<Object>>} categorySpecificity - computeCategorySpecificityの結果
 * @param {Array<string|number>} categories - 表示順のカテゴリ
 * @param {{termFrequency?: Object<string, number>, groupSizes?: Object<string, number>, minFrequency?: number, limit?: number}} [options]
 * @returns {Array<{term: string, groups: Object<string, Object>, maxAbsZ: number, rateSpread: number, minQ: number, globalFrequency: number}>}
 */
export function buildGroupComparisonRows(categorySpecificity, categories, options = {}) {
    const categoryNames = [...new Set((categories || []).map(category => String(category)))];
    if (categoryNames.length < 2) return [];

    const frequency = options.termFrequency || {};
    const groupSizes = options.groupSizes || {};
    const minFrequency = Math.max(1, Number(options.minFrequency) || 1);
    const limit = Math.max(1, Number(options.limit) || 30);
    const maps = Object.fromEntries(categoryNames.map(category => [
        category,
        new Map((categorySpecificity?.[category] || []).map(row => [row.term, row]))
    ]));
    const terms = new Set();
    categoryNames.forEach(category => {
        maps[category].forEach((_row, term) => terms.add(term));
    });

    return [...terms].map(term => {
        const groups = {};
        categoryNames.forEach(category => {
            const source = maps[category].get(term);
            const configuredSize = Number(groupSizes[category]);
            const documentCount = source?.categoryDocuments
                ?? (Number.isFinite(configuredSize) ? configuredSize : 0);
            groups[category] = {
                count: source?.inCategory || 0,
                documentCount,
                rate: source?.categoryRate || 0,
                z: source?.z || 0,
                q: Number.isFinite(source?.q) ? source.q : 1
            };
        });

        const values = Object.values(groups);
        const rates = values.map(group => group.rate);
        const maxAbsZ = Math.max(...values.map(group => Math.abs(group.z)), 0);
        const rateSpread = Math.max(...rates) - Math.min(...rates);
        const minQ = Math.min(...values.map(group => group.q), 1);
        const fallbackFrequency = values.reduce((sum, group) => sum + group.count, 0);
        return {
            term,
            groups,
            maxAbsZ,
            rateSpread,
            minQ,
            globalFrequency: frequency[term] ?? fallbackFrequency
        };
    }).filter(row =>
        row.globalFrequency >= minFrequency
        && (row.maxAbsZ > 0 || row.rateSpread > 0)
    ).sort((a, b) =>
        Number(b.minQ < 0.05) - Number(a.minQ < 0.05)
        || b.maxAbsZ - a.maxAbsZ
        || b.rateSpread - a.rateSpread
        || b.globalFrequency - a.globalFrequency
        || a.term.localeCompare(b.term, 'ja')
    ).slice(0, limit);
}

/**
 * 文単位の語出現から共起エッジを作成する。
 * 重みは「同じ文に出現した文集合」の Jaccard 係数。
 * @param {Array<string[]>} sentences - 文ごとのトークン配列
 * @param {string[]} topWords - 対象語
 * @param {{threshold?: number, maxEdges?: number, minCooccurrence?: number, filterMode?: 'top'|'threshold'}} [options]
 * @returns {Array<{from: string, to: string, weight: number, intersection: number, fromCount: number, toCount: number}>}
 */
export function buildCooccurrenceEdges(sentences, topWords, options = {}) {
    const threshold = options.threshold ?? 0;
    const maxEdges = options.maxEdges ?? 80;
    const minCooccurrence = Math.max(1, options.minCooccurrence ?? 1);
    const filterMode = options.filterMode || 'top';
    const words = [...new Set(Array.isArray(topWords) ? topWords : [])];
    const edges = [];
    const wordIndexes = new Map(words.map((word, index) => [word, index]));
    const presenceCounts = Object.fromEntries(words.map(word => [word, 0]));
    const pairCounts = new Map();

    (Array.isArray(sentences) ? sentences : []).forEach(tokens => {
        const activeIndexes = [...new Set((tokens || [])
            .map(token => wordIndexes.get(token))
            .filter(index => index !== undefined))]
            .sort((a, b) => a - b);

        activeIndexes.forEach(index => {
            presenceCounts[words[index]]++;
        });
        for (let i = 0; i < activeIndexes.length; i++) {
            for (let j = i + 1; j < activeIndexes.length; j++) {
                const key = `${activeIndexes[i]}:${activeIndexes[j]}`;
                pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
            }
        }
    });

    pairCounts.forEach((intersection, key) => {
        if (intersection < minCooccurrence) return;
        const [fromIndex, toIndex] = key.split(':').map(Number);
        const from = words[fromIndex];
        const to = words[toIndex];
        const fromCount = presenceCounts[from];
        const toCount = presenceCounts[to];
        const union = fromCount + toCount - intersection;
        const weight = union > 0 ? intersection / union : 0;
        if (filterMode === 'threshold' && weight < threshold) return;
        edges.push({
            from,
            to,
            weight,
            intersection,
            fromCount,
            toCount
        });
    });

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
        const displayWidth = canvas.getBoundingClientRect().width || canvas.width;
        const scale = Math.max(1, canvas.width / Math.max(displayWidth, 1));
        let legendItems = [];
        try {
            legendItems = JSON.parse(canvas.dataset.legendItems || '[]');
        } catch {
            legendItems = [];
        }
        const legendMetric = canvas.dataset.legendMetric || '';
        const visualTitle = canvas.dataset.visualTitle || '';
        const titleHeight = visualTitle ? Math.round(72 * scale) : 0;
        const showLegend = canvas.dataset.visualLegendVisible !== 'false';
        const legendHeight = showLegend && (legendMetric || legendItems.length > 0)
            ? Math.round((120 + Math.ceil(legendItems.length / 3) * 42) * scale)
            : 0;

        // 画面上のタイトル・凡例設定を含むCanvasを作成して合成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(canvas.width, 1);
        tempCanvas.height = Math.max(titleHeight + canvas.height + legendHeight, 1);
        const ctx = tempCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 白背景で塗りつぶし
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        if (titleHeight > 0) {
            let titleFontSize = 22 * scale;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#1f2937';
            ctx.font = `bold ${titleFontSize}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            while (titleFontSize > 12 * scale
                && ctx.measureText(visualTitle).width > tempCanvas.width - 48 * scale) {
                titleFontSize -= scale;
                ctx.font = `bold ${titleFontSize}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            }
            ctx.fillText(visualTitle, tempCanvas.width / 2, titleHeight / 2);
            ctx.textAlign = 'left';
        }

        // 元の画像を重ねる
        ctx.drawImage(canvas, 0, titleHeight);

        if (legendHeight > 0) {
            const top = titleHeight + canvas.height;
            const padding = 24 * scale;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, top, tempCanvas.width, legendHeight);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = Math.max(1, scale);
            ctx.beginPath();
            ctx.moveTo(0, top);
            ctx.lineTo(tempCanvas.width, top);
            ctx.stroke();

            ctx.textBaseline = 'top';
            ctx.fillStyle = '#334155';
            ctx.font = `bold ${18 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            ctx.fillText('色と大きさの意味', padding, top + padding);
            ctx.font = `${14 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
            ctx.fillStyle = '#475569';
            ctx.fillText(legendMetric, padding, top + padding + 30 * scale);

            legendItems.forEach((item, index) => {
                const column = index % 3;
                const row = Math.floor(index / 3);
                const itemX = padding + column * ((tempCanvas.width - padding * 2) / 3);
                const itemY = top + padding + (66 + row * 42) * scale;
                ctx.fillStyle = item.color || '#64748b';
                ctx.beginPath();
                ctx.arc(itemX + 8 * scale, itemY + 8 * scale, 7 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#334155';
                ctx.font = `${13 * scale}px "Helvetica Neue", "Yu Gothic", sans-serif`;
                ctx.fillText(String(item.label || ''), itemX + 22 * scale, itemY);
            });
        }

        // ダウンロード処理
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        let prefix = 'text_mining';
        if (targetId.includes('wordcloud-feature')) prefix = 'wordcloud_category_feature';
        else if (targetId.includes('wordcloud-tfidf')) prefix = 'wordcloud_tfidf';
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
