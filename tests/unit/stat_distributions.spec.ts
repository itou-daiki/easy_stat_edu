
import { test, expect } from '@playwright/test';
import { jStat } from 'jstat';

// Setup global jStat for the module under test (which expects global jStat in browser)
// @ts-ignore
if (typeof global !== 'undefined') {
    // @ts-ignore
    global.jStat = jStat;
}

import { calculateTukeyP, performHolmCorrection } from '../../js/utils/stat_distributions.js';

// NOTE: We injected jStat globally above because stat_distributions.js assumes it exists.

test.describe('Statistical Distributions Utils', () => {

    test.describe('calculateTukeyP (Studentized Range CDF Approximation)', () => {
        // Reference values from Studentized Range Q Table (alpha = 0.05)
        // p should be approx 0.05 for these Q values.

        test('should return p ~ 0.05 for k=3, df=10, q=3.88', () => {
            const p = calculateTukeyP(3.877, 3, 10);
            console.log(`k=3, df=10, q=3.877 -> p=${p}`);
            expect(p).toBeGreaterThan(0.04);
            expect(p).toBeLessThan(0.06);
        });

        test('should return p ~ 0.05 for k=5, df=20, q=4.23', () => {
            const p = calculateTukeyP(4.232, 5, 20);
            console.log(`k=5, df=20, q=4.232 -> p=${p}`);
            expect(p).toBeGreaterThan(0.04);
            expect(p).toBeLessThan(0.06);
        });

        test('should return p ~ 0.01 for k=4, df=60, q=5.00', () => {
            // k=4, df=60, alpha=0.01 => q table says ~ 4.999
            const p = calculateTukeyP(4.999, 4, 60);
            console.log(`k=4, df=60, q=4.999 -> p=${p}`);
            expect(p).toBeGreaterThan(0.004);
            expect(p).toBeLessThan(0.015);
        });

        test('should behave correctly for extreme values', () => {
            expect(calculateTukeyP(0, 3, 10)).toBe(1.0); // No difference
            expect(calculateTukeyP(100, 3, 10)).toBeLessThan(0.00001); // Huge difference
        });
    });

    test.describe('performHolmCorrection', () => {
        test('should correctly adjust p-values', () => {
            // Example: p = [0.01, 0.04, 0.03]
            // Sorted: 0.01 (rank 1), 0.03 (rank 2), 0.04 (rank 3)
            // m = 3
            // adj[0] (0.01) = 0.01 * (3 - 1 + 1) = 0.03
            // adj[1] (0.03) = 0.03 * (3 - 2 + 1) = 0.06
            // adj[2] (0.04) = 0.04 * (3 - 3 + 1) = 0.04 -> Monotonicity check -> max(0.06, 0.04) = 0.06

            const inputs = [
                { id: 1, p: 0.01 },
                { id: 2, p: 0.04 },
                { id: 3, p: 0.03 }
            ];

            const results = performHolmCorrection(inputs);

            // Check ID 1 (p=0.01) -> 0.03
            const r1 = results.find(r => r.id === 1);
            expect(r1.p_holm).toBeCloseTo(0.03, 3);

            // Check ID 3 (p=0.03) -> 0.06
            const r3 = results.find(r => r.id === 3);
            expect(r3.p_holm).toBeCloseTo(0.06, 3);

            // Check ID 2 (p=0.04) -> 0.06
            const r2 = results.find(r => r.id === 2);
            expect(r2.p_holm).toBeCloseTo(0.06, 3); // Enforced monotonicity
        });

        test('should cap at 1.0', () => {
            const inputs = [{ p: 0.5 }, { p: 0.6 }];
            // m=2
            // sorted: 0.5, 0.6
            // 0.5 * 2 = 1.0
            // 0.6 * 1 = 0.6 -> max(1.0, 0.6) = 1.0
            const results = performHolmCorrection(inputs);
            expect(results[0].p_holm).toBe(1.0);
            expect(results[1].p_holm).toBe(1.0);
        });
    });

});
