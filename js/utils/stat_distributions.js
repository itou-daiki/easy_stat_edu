
/**
 * Statistical Distribution Utilities
 * 
 * Provides approximation functions for statistical distributions not covered by jStat.
 * Primarily focusing on the Studentized Range Distribution for Tukey-Kramer test.
 */

// import { jStat } from 'jstat'; // Removed to avoid browser module resolution error. Assume global jStat.

// Normal PDF
function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Global jStat fallback helper (if import fails or behaves unexpectedly)
const getJStat = () => {
    if (typeof jStat !== 'undefined') return jStat;
    try {
        // eslint-disable-next-line
        return require('jstat').jStat;
    } catch (e) {
        return null;
    }
};

// Log Gamma approximation (Lanczos approximation) if jStat is missing
function lanczosGammaLn(z) {
    const p = [
        0.99999999999980993, 676.5203681218851, -1259.1392167224028,
        771.32342877765313, -176.61502916214059, 12.507343278686905,
        -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    let x = p[0];
    for (let i = 1; i < 9; i++) x += p[i] / (z + i - 1);
    const t = z + 7.5;
    return Math.log(Math.sqrt(2 * Math.PI)) + (z - 0.5) * Math.log(t) - t + Math.log(x);
}

function getGammaLn(n) {
    if (!isFinite(n) || n <= 0) return NaN;
    // Try imported jStat first
    if (typeof jStat !== 'undefined' && typeof jStat.gammaln === 'function') {
        return jStat.gammaln(n);
    }
    // Try global jStat (window.jStat)
    // @ts-ignore
    if (typeof window !== 'undefined' && window.jStat && typeof window.jStat.gammaln === 'function') {
        // @ts-ignore
        return window.jStat.gammaln(n);
    }

    // Fallback
    const js = getJStat();
    if (js && typeof js.gammaln === 'function') return js.gammaln(n);

    return lanczosGammaLn(n);
}

// Normal CDF (using jStat if available, or approximation)
function normalCDF(x) {
    if (typeof jStat !== 'undefined' && jStat.normal) {
        return jStat.normal.cdf(x, 0, 1);
    }
    // Constants for approximation (Abramowitz & Stegun 26.2.17)
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014337 * Math.exp(-x * x / 2);
    const prob = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - prob : prob;
}

/**
 * Calculates the probability that the Studentized Range Statistic Q
 * is less than or equal to q.
 * Pr(Q <= q | k, df)
 * 
 * @param {number} q - The studentized range statistic
 * @param {number} k - The number of groups
 * @param {number} df - The degrees of freedom (for error)
 */
export function studentizedRangeCDF(q, k, df) {
    if (!isFinite(q) || !isFinite(k) || !isFinite(df)) return NaN;
    if (k < 2) return NaN;
    if (q <= 0) return 0;
    if (df <= 0) return 0;

    // Numerical integration parameters
    // Inner integral: -8 to 8 is better for extreme tail accuracy.
    const innerIntegral = (w, k) => {
        const zMin = -8;
        const zMax = 8;
        const steps = 120; // Increased precision
        const dz = (zMax - zMin) / steps;

        let sum = 0;

        for (let i = 0; i <= steps; i++) {
            const z = zMin + i * dz;
            const pz = normalPDF(z);
            const Pz = normalCDF(z);
            const Pzw = normalCDF(z + w);

            let term = pz;
            const diff = Pzw - Pz;
            if (diff > 1e-15) {
                term *= Math.pow(diff, k - 1);
            } else {
                term = 0;
            }

            const weight = (i === 0 || i === steps) ? 1 : (i % 2 === 0 ? 2 : 4);
            sum += weight * term;
        }

        return k * (dz / 3) * sum;
    };

    const outerPDF = (x, df) => {
        if (x <= 0) return 0;
        // f(x) for x = chi / sqrt(df)
        // Log calculation to avoid overflow/underflow
        const logC = Math.log(2) + (df / 2) * Math.log(df / 2) - getGammaLn(df / 2);
        const logVal = logC + (df - 1) * Math.log(x) - (df * x * x / 2);
        return Math.exp(logVal);
    };

    // Range for Chi/sqrt(df)
    // For small df, tail is heavy. For large df, it concentrates at 1.
    const xMin = 0.01;
    const xMax = 5.0;
    const steps = 200; // Increased precision significantly
    const dx = (xMax - xMin) / steps;

    let sum = 0;
    for (let i = 0; i <= steps; i++) {
        const x = xMin + i * dx;
        const pdf = outerPDF(x, df);
        if (pdf < 1e-15) continue;

        const w = q * x;
        const Hw = innerIntegral(w, k);

        const weight = (i === 0 || i === steps) ? 1 : (i % 2 === 0 ? 2 : 4);
        sum += weight * pdf * Hw;
    }

    return (dx / 3) * sum;
}

/**
 * Calculates p-value for Tukey-Kramer test.
 * p = 1 - CDF(q)
 * 
 * @param {number} q - Studentized Range Statistic
 * @param {number} k - Number of groups
 * @param {number} df - Degrees of freedom
 */
export function calculateTukeyP(q, k, df) {
    if (k < 2) return 1.0;
    const cdf = studentizedRangeCDF(Math.abs(q), k, df);
    // CDF is P(Q < q). we want P(Q > q) for p-value.
    const p = 1 - cdf;
    return Math.max(0, Math.min(1, p));
}

/**
 * Holm-Bonferroni Correction
 * Sorts p-values and applies step-down correction.
 * 
 * @param {Array<Object>} comparisons - Array of comparison objects, must contain 'p' property.
 * @returns {Array<Object>} - Array with added 'p_holm' property.
 */
export function performHolmCorrection(comparisons) {
    const sorted = [...comparisons].map((c, i) => ({ ...c, originalIndex: i }));
    sorted.sort((a, b) => a.p - b.p);

    const m = sorted.length;
    let previousAdjP = 0;

    for (let i = 0; i < m; i++) {
        const item = sorted[i];
        const rank = i + 1;
        const factor = m - rank + 1;
        let adjP = item.p * factor;

        // Enforce monotonicity
        if (i > 0) {
            adjP = Math.max(adjP, previousAdjP);
        }

        adjP = Math.min(1, adjP);
        previousAdjP = adjP;

        item.p_holm = adjP;
    }

    // Clean up and restore order? 
    // Usually sorted order is fine for display, but let's keep array items enriched.
    // If logical order matters, caller should sort.
    // But we enriched `sorted` array.

    // Return in original order
    const result = new Array(m);
    for (let i = 0; i < m; i++) {
        const { originalIndex, ...rest } = sorted[i];
        result[originalIndex] = rest;
    }
    return result;
}
