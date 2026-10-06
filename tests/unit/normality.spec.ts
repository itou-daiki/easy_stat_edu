import { test, expect } from '@playwright/test';

// scipy.stats.shapiro (scipy 1.17) で計算した参照値
const SCIPY_CASES = [
    { x: [1.0, 2.0, 4.0], w: 0.964286, p: 0.636887 },
    { x: [2.1, 3.3, 1.0, 5.5], w: 0.972343, p: 0.855934 },
    { x: [1.0, 2.0, 3.0, 4.0, 10.0], w: 0.835788, p: 0.153613 },
    { x: [148.0, 154.0, 158.0, 160.0, 161.0, 162.0, 166.0, 170.0, 182.0, 195.0, 236.0], w: 0.788815, p: 0.00670381 },
    { x: [53.46, 58.22, 53.3, 36.97, 59.05, 54.46, 44.63, 55.81, 53.65, 52.94, 50.28, 55.47, 42.64, 48.37, 45.18, 55.99, 50.4, 47.08, 42.18, 47.43], w: 0.955852, p: 0.464652 },
    { x: [13.245, 5.573, 4.494, 14.2, 10.154, 5.829, 1.643, 7.174, 0.789, 42.115, 1.18, 12.391, 9.511, 1.6, 9.006, 0.239, 6.778, 5.983, 0.296, 5.518, 18.78, 4.006, 2.828, 3.031, 5.832, 2.645, 1.342, 5.134, 7.211, 4.052], w: 0.682382, p: 8.73307e-07 },
    { x: [0.1563, 0.3857, 0.0198, 0.0819, 0.2165, 0.4147, 0.4632, 0.8845, 0.3167, 0.0215, 0.8262, 0.0618], w: 0.877116, p: 0.0805069 },
    { x: [0.172, 0.3567, 1.0403, 0.2564, 1.0284, 0.9466, 2.4565, 0.4006], w: 0.808499, p: 0.0352699 }
];

test.describe('Shapiro-Wilk normality test', () => {
    test('matches scipy.stats.shapiro for W and p', async ({ page }) => {
        await page.goto('/');
        const results = await page.evaluate(async (cases) => {
            const { shapiroWilk } = await import('/js/utils/normality.js');
            return cases.map(c => shapiroWilk(c.x));
        }, SCIPY_CASES);

        results.forEach((result, index) => {
            const expected = SCIPY_CASES[index];
            expect(result.ok).toBe(true);
            expect(result.w).toBeCloseTo(expected.w, 5);
            expect(Math.abs(result.p - expected.p) / expected.p).toBeLessThan(1e-3);
        });
    });

    test('reports untestable inputs instead of guessing', async ({ page }) => {
        await page.goto('/');
        const results = await page.evaluate(async () => {
            const { shapiroWilk } = await import('/js/utils/normality.js');
            return [shapiroWilk([1, 2]), shapiroWilk([5, 5, 5, 5]), shapiroWilk([1, null, NaN, 2, 3, 'x'])];
        });
        expect(results[0]).toMatchObject({ ok: false, reason: 'too_few' });
        expect(results[1]).toMatchObject({ ok: false, reason: 'constant' });
        expect(results[2]).toMatchObject({ ok: true, n: 3 });
    });
});
