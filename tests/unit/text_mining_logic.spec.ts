import { test, expect } from '@playwright/test';
import {
    normalizeToken,
    isContentToken,
    inferPartOfSpeech,
    mapPartOfSpeech,
    createIntlSegmenterTokenizer,
    analyzeDocument,
    computeTermMetrics,
    computeCategorySpecificity,
    buildGroupComparisonRows,
    buildCooccurrenceEdges,
    splitTextIntoSentences
} from '../../js/analyses/text_mining/helpers.js';
import { detectCommunities } from '../../js/analyses/text_mining/visualization.js';

test.describe('Text mining logic', () => {
    test('keeps the static app free from a remote morphology dictionary dependency', async ({ request }) => {
        const indexResponse = await request.get('/');
        const helperResponse = await request.get('/js/analyses/text_mining/helpers.js');
        const source = `${await indexResponse.text()}\n${await helperResponse.text()}`;

        expect(source.toLowerCase()).not.toContain('kuromoji@');
        expect(source).not.toContain('builder({');
        expect(source).not.toContain('dicPath');
    });

    test('normalizes tokens and filters non-content tokens', () => {
        expect(normalizeToken(' ＩＣＴ! ')).toBe('ict');
        expect(normalizeToken('タブレット。')).toBe('タブレット');

        expect(isContentToken('タブレット')).toBe(true);
        expect(isContentToken('です')).toBe(false);
        expect(isContentToken('12')).toBe(false);
        expect(isContentToken('の')).toBe(false);
        expect(isContentToken('やすいけど')).toBe(false);
        expect(isContentToken('難しかっ')).toBe(false);
        expect(isContentToken('使っ')).toBe(false);
    });

    test('computes document-length adjusted TF-IDF and supports global IDF reuse', () => {
        const global = computeTermMetrics([
            ['共通', '数学'],
            ['共通', '英語'],
            ['共通', '英語']
        ]);

        expect(global.termFreq).toEqual({ '共通': 3, '数学': 1, '英語': 2 });
        expect(global.termDf).toEqual({ '共通': 3, '数学': 1, '英語': 2 });
        expect(global.termIdf['共通']).toBeCloseTo(0, 6);
        expect(global.termIdf['数学']).toBeCloseTo(Math.log(4 / 2), 6);
        expect(global.termIdf['英語']).toBeCloseTo(Math.log(4 / 3), 6);

        const category = computeTermMetrics([
            ['共通', '英語'],
            ['共通', '英語']
        ], { idfLookup: global.termIdf });

        const categoryScores = Object.fromEntries(category.termTfIdf);
        expect(categoryScores['共通']).toBeCloseTo(0, 6);
        expect(categoryScores['英語']).toBeCloseTo(Math.log(4 / 3), 6);
    });

    test('infers broad part-of-speech groups for ranking', () => {
        expect(inferPartOfSpeech('授業')).toBe('noun');
        expect(inferPartOfSpeech('分かる')).toBe('verb');
        expect(inferPartOfSpeech('楽しい')).toBe('adjective');
        expect(inferPartOfSpeech('ICT')).toBe('alnum');
        expect(mapPartOfSpeech('副詞', 'とても')).toBe('adverb');
        expect(mapPartOfSpeech('名詞', '大切', '形容動詞語幹')).toBe('adjectival_noun');
        expect(mapPartOfSpeech('名詞', '東京', '固有名詞')).toBe('proper_noun');
    });

    test('uses base forms and real POS tags while excluding function words', () => {
        const fakeKuromoji = {
            engine: 'kuromoji',
            analyze: () => [
                { surface_form: '読み', basic_form: '読む', pos: '動詞', pos_detail_1: '自立' },
                { surface_form: '楽しい', basic_form: '楽しい', pos: '形容詞', pos_detail_1: '自立' },
                { surface_form: 'を', basic_form: 'を', pos: '助詞', pos_detail_1: '格助詞' },
                { surface_form: 'まずは', basic_form: '*', pos: '接続詞', pos_detail_1: '*' },
                { surface_form: 'ICT', basic_form: 'ICT', pos: '名詞', pos_detail_1: '一般' }
            ]
        };

        expect(analyzeDocument('本を読みやすいICT教材', fakeKuromoji)).toEqual([
            expect.objectContaining({ term: '読む', surface: '読み', pos: 'verb' }),
            expect.objectContaining({ term: '楽しい', pos: 'adjective' }),
            expect.objectContaining({ term: 'ict', pos: 'alnum' })
        ]);
    });

    test('segments Japanese locally without downloading a morphology dictionary', () => {
        const localTokenizer = createIntlSegmenterTokenizer(Intl.Segmenter);
        expect(localTokenizer?.engine).toBe('intl-segmenter');

        const terms = analyzeDocument(
            'データ分析の授業が楽しい。ICTも活用した。',
            localTokenizer
        ).map(token => token.term);
        expect(terms).toEqual(expect.arrayContaining([
            'データ',
            '分析',
            '授業',
            '楽しい',
            'ict',
            '活用'
        ]));
        expect(terms).not.toContain('の');
        expect(terms).not.toContain('が');
    });

    test('builds sentence-level Jaccard co-occurrence edges', () => {
        const edges = buildCooccurrenceEdges([
            ['数学', '楽しい'],
            ['数学', '難しい'],
            ['英語', '楽しい']
        ], ['数学', '楽しい', '難しい', '英語'], { threshold: 0, maxEdges: 10 });

        const mathFun = edges.find(e => e.from === '数学' && e.to === '楽しい');
        expect(mathFun).toBeTruthy();
        expect(mathFun?.intersection).toBe(1);
        expect(mathFun?.weight).toBeCloseTo(1 / 3, 6);

        const mathHard = edges.find(e => e.from === '数学' && e.to === '難しい');
        expect(mathHard?.weight).toBeCloseTo(1 / 2, 6);
    });

    test('filters one-off co-occurrences and keeps the strongest Jaccard edges', () => {
        const edges = buildCooccurrenceEdges([
            ['数学', '理解', '授業'],
            ['数学', '理解'],
            ['英語', '授業']
        ], ['数学', '理解', '授業', '英語'], {
            minCooccurrence: 2,
            maxEdges: 1,
            filterMode: 'top'
        });

        expect(edges).toHaveLength(1);
        expect(edges[0]).toMatchObject({
            from: '数学',
            to: '理解',
            intersection: 2,
            weight: 1
        });
    });

    test('computes category characteristic words with adjusted residuals and FDR', () => {
        const result = computeCategorySpecificity([
            { category: 'A', tokens: ['数学', '共通'] },
            { category: 'A', tokens: ['数学'] },
            { category: 'A', tokens: ['数学'] },
            { category: 'B', tokens: ['英語', '共通'] },
            { category: 'B', tokens: ['英語'] },
            { category: 'B', tokens: ['英語'] }
        ]);

        const mathInA = result.A.find(row => row.term === '数学');
        expect(mathInA?.z).toBeCloseTo(Math.sqrt(6), 6);
        expect(mathInA?.categoryRate).toBe(1);
        expect(mathInA?.outsideRate).toBe(0);
        expect(mathInA?.q).toBeLessThan(0.05);
    });

    test('builds a cross-group comparison matrix without losing group denominators', () => {
        const rows = buildGroupComparisonRows({
            A: [
                {
                    term: '数学',
                    z: 2.4,
                    q: 0.03,
                    inCategory: 8,
                    categoryDocuments: 10,
                    categoryRate: 0.8
                },
                {
                    term: '英語',
                    z: -0.8,
                    q: 0.7,
                    inCategory: 2,
                    categoryDocuments: 10,
                    categoryRate: 0.2
                }
            ],
            B: [
                {
                    term: '数学',
                    z: -2.4,
                    q: 0.03,
                    inCategory: 2,
                    categoryDocuments: 12,
                    categoryRate: 2 / 12
                },
                {
                    term: '英語',
                    z: 0.8,
                    q: 0.7,
                    inCategory: 5,
                    categoryDocuments: 12,
                    categoryRate: 5 / 12
                }
            ]
        }, ['A', 'B'], {
            termFrequency: { 数学: 14, 英語: 9 },
            minFrequency: 2,
            limit: 10
        });

        expect(rows.map(row => row.term)).toEqual(['数学', '英語']);
        expect(rows[0].groups.A).toMatchObject({
            count: 8,
            documentCount: 10,
            rate: 0.8,
            z: 2.4,
            q: 0.03
        });
        expect(rows[0].groups.B.documentCount).toBe(12);
        expect(rows[0].rateSpread).toBeCloseTo(0.8 - 2 / 12, 8);
    });

    test('detects separate dense communities across a weak bridge', () => {
        const communities = detectCommunities(
            ['数学', '計算', '英語', '読解'],
            [
                { from: '数学', to: '計算', weight: 1 },
                { from: '英語', to: '読解', weight: 1 },
                { from: '計算', to: '英語', weight: 0.05 }
            ]
        );

        expect(communities['数学']).toBe(communities['計算']);
        expect(communities['英語']).toBe(communities['読解']);
        expect(communities['数学']).not.toBe(communities['英語']);
    });

    test('renders network tooltips as safe multi-line DOM content', async ({ page }) => {
        await page.goto('/');
        const tooltip = await page.evaluate(async () => {
            const { createNetworkTooltip } = await import(
                '/js/analyses/text_mining/visualization.js?tooltip-test'
            );
            const element = createNetworkTooltip([
                '教材',
                '出現回数: 7',
                '媒介中心性: 0.000'
            ]);
            return {
                role: element.getAttribute('role'),
                lines: Array.from(element.children).map(child => child.textContent),
                text: element.textContent,
                html: element.innerHTML
            };
        });

        expect(tooltip.role).toBe('tooltip');
        expect(tooltip.lines).toEqual([
            '教材',
            '出現回数: 7',
            '媒介中心性: 0.000'
        ]);
        expect(tooltip.text).not.toContain('<br>');
        expect(tooltip.html).not.toContain('<br>');
    });

    test('splits Japanese and ASCII sentence punctuation', () => {
        expect(splitTextIntoSentences('楽しいです。難しいです!でも便利です\n質問できます。')).toEqual([
            '楽しいです',
            '難しいです',
            'でも便利です',
            '質問できます'
        ]);
    });
});
