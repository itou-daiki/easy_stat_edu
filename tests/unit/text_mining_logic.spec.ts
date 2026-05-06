import { test, expect } from '@playwright/test';
import {
    normalizeToken,
    isContentToken,
    inferPartOfSpeech,
    computeTermMetrics,
    buildCooccurrenceEdges,
    splitTextIntoSentences
} from '../../js/analyses/text_mining/helpers.js';

test.describe('Text mining logic', () => {
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

    test('splits Japanese and ASCII sentence punctuation', () => {
        expect(splitTextIntoSentences('楽しいです。難しいです!でも便利です\n質問できます。')).toEqual([
            '楽しいです',
            '難しいです',
            'でも便利です',
            '質問できます'
        ]);
    });
});
