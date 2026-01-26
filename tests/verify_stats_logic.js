
const jStat = require('jstat');

// 1. Mock `calculateLeveneTest` from utils.js
// Copying implementation for testing isolation
function calculateLeveneTest(groups) {
    let groupArrays = [];
    if (arguments.length > 1) {
        groupArrays = Array.from(arguments);
    } else if (Array.isArray(groups) && Array.isArray(groups[0])) {
        groupArrays = groups;
    } else {
        return { F: 0, p: 1, significant: false };
    }

    const groupMeans = groupArrays.map(g => jStat.mean(g));
    const deviations = groupArrays.map((g, i) => g.map(v => Math.abs(v - groupMeans[i])));

    const allDevs = deviations.flat();
    const grandMeanDev = jStat.mean(allDevs);
    const N = allDevs.length;
    const k = groupArrays.length;

    let SSb = 0;
    deviations.forEach((gDevs, i) => {
        const meanDev = jStat.mean(gDevs);
        SSb += gDevs.length * Math.pow(meanDev - grandMeanDev, 2);
    });
    const dfb = k - 1;
    const MSb = SSb / dfb;

    let SSw = 0;
    deviations.forEach((gDevs, i) => {
        const meanDev = jStat.mean(gDevs);
        SSw += jStat.sum(gDevs.map(d => Math.pow(d - meanDev, 2)));
    });
    const dfw = N - k;
    const MSw = SSw / dfw;

    const F = MSb / MSw;
    const p = 1 - jStat.centralF.cdf(F, dfb, dfw);

    return { F, p, significant: p < 0.05 };
}

// 2. Mock Yates Logic from chi_square.js
function calculateYates(observed, expected, df) {
    let yatesSum = 0;
    observed.forEach((row, i) => {
        row.forEach((obs, j) => {
            const exp = expected[i][j];
            if (exp > 0) {
                yatesSum += Math.pow(Math.abs(obs - exp) - 0.5, 2) / exp;
            }
        });
    });
    const p = 1 - jStat.chisquare.cdf(yatesSum, df);
    return { chi: yatesSum, p };
}

// ==========================================
// TESTS
// ==========================================

console.log("=== Verification - Statistical Logic ==="); // English for log output but logic is same

// Test 1: Levene's Test
// Group A: Low variance [10, 10, 10, 10]
// Group B: High variance [1, 5, 15, 19]
console.log("\n[Test 1] Levene's Test (Homogeneity)");
const groupA = [10, 10, 10, 10]; // Variance = 0
const groupB = [1, 5, 15, 19];   // Variance High
console.log("Group A (Low Var):", groupA);
console.log("Group B (High Var):", groupB);

const leveneResult = calculateLeveneTest(groupA, groupB);
console.log("Result:", leveneResult);

if (leveneResult.p < 0.05) {
    console.log("✅ PASS: Levene's test correctly identified significant variance difference.");
} else {
    console.error("❌ FAIL: Levene's test failed to identify significant difference (Expected p < 0.05).");
}


// Test 2: Chi-Square Yates Correction (2x2)
// Example with small sample where Yates matters
// Observed: [[8, 7], [4, 11]] (N=30)
console.log("\n[Test 2] Chi-Square Yates Correction (2x2)");
const obs = [[8, 7], [4, 11]];
const rowTotals = [15, 15];
const colTotals = [12, 18];
const total = 30;
const exp = [
    [(15 * 12) / 30, (15 * 18) / 30], // [6, 9]
    [(15 * 12) / 30, (15 * 18) / 30]  // [6, 9]
];
console.log("Observed:", obs);
console.log("Expected:", exp);

const yatesResult = calculateYates(obs, exp, 1);
console.log("Yates Result:", yatesResult);

// Manual Check Calculation
// Cell 0,0: (|8-6|-0.5)^2/6 = 1.5^2/6 = 2.25/6 = 0.375
// Cell 0,1: (|7-9|-0.5)^2/9 = 1.5^2/9 = 2.25/9 = 0.25
// Cell 1,0: (|4-6|-0.5)^2/6 = 1.5^2/6 = 2.25/6 = 0.375
// Cell 1,1: (|11-9|-0.5)^2/9 = 1.5^2/9 = 2.25/9 = 0.25
// Total Yates Chi2 = 0.375 + 0.25 + 0.375 + 0.25 = 1.25

const expectedYatesChi = 1.25;
if (Math.abs(yatesResult.chi - expectedYatesChi) < 0.001) {
    console.log(`✅ PASS: Yates Chi-Square calculated correctly (Got ${yatesResult.chi}, Expected ${expectedYatesChi}).`);
} else {
    console.error(`❌ FAIL: Yates Chi-Square calculation mismatch (Got ${yatesResult.chi}, Expected ${expectedYatesChi}).`);
}


// 3. Mock Varimax Rotation
function calculateVarimax(loadings, maxIter = 50, epsilon = 1e-6) {
    const p = loadings.length;
    const k = loadings[0].length;
    let R = loadings.map(row => row.slice()); // Clone
    let d = 0;

    // Initial rotation matrix (Identity)
    let T = Array.from({ length: k }, (_, i) =>
        Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))
    );

    for (let iter = 0; iter < maxIter; iter++) {
        let dOld = d;
        d = 0;

        for (let i = 0; i < k - 1; i++) {
            for (let j = i + 1; j < k; j++) {
                let u = 0, v = 0, A = 0, B = 0;

                for (let r = 0; r < p; r++) {
                    const x = R[r][i];
                    const y = R[r][j];
                    u += x * x - y * y;
                    v += 2 * x * y;
                    A += x * x - y * y; // Simplified for raw varimax vs normalized
                    B += 2 * x * y;
                }

                // Proper Kaisers Normalization usually happens here, 
                // but for raw varimax we calculate theta directly from sums.
                // However, standard algorithm involves these sums:
                // Numerator = 2 * (p * sum(x*y) - sum(x^2-y^2)*sum(2xy)) ... wait, let's use standard algorithm references.
                // Using a simplified pairwise rotation approach.

                // Re-calculating using sums for angle 4*theta
                let sum_u = 0; // sum(x^2 - y^2)
                let sum_v = 0; // sum(2xy)
                let sum_u2_minus_v2 = 0; // Used for B
                let sum_2uv = 0; // Used for A

                // Actually, let's stick to the specific algorithm math.
                // numer = 2 * (n * sum(u*v) - sum(u) * sum(v))
                // denom = n * sum(u^2 - v^2) - (sum(u)^2 - sum(v)^2)
                // where u = x^2 - y^2, v = 2xy. 

                // Let's implement correct raw varimax step:
                let num = 0;
                let den = 0;
                let sum_x2_y2 = 0;
                let sum_2xy = 0;

                for (let r = 0; r < p; r++) {
                    let x = R[r][i];
                    let y = R[r][j];
                    sum_x2_y2 += (x * x - y * y);
                    sum_2xy += (2 * x * y);
                }

                let top = 0;
                let bot = 0;

                for (let r = 0; r < p; r++) {
                    let x = R[r][i];
                    let y = R[r][j];
                    let u = x * x - y * y;
                    let v = 2 * x * y;
                    top += u * v;
                    bot += u * u - v * v;
                }
                // Adjustment for centering (Kaiser usually normalizes rows, but raw varimax subtracts means of squared loadings?)
                // Actually the standard "Varimax" maximizes variance of squared loadings.
                // Angle tan(4theta) = (2 * (p * sum(u*v) - sum_u * sum_v)) / (p * sum(u^2 - v^2) - (sum_u^2 - sum_v^2))
                // Let u = x^2 - y^2, v = 2xy

                let sum_U = sum_x2_y2;
                let sum_V = sum_2xy;

                // Re-loop for correct sums
                // Let's rely on a simpler optimization if possible, or correct formula.
                // tan(4phi) = (2 * (p*sum(xy) - sum(x)*sum(y))) ... no that's covariance.

                // Correct formula for Varimax (maximize variance of squares):
                // D = p * sum(u) - sum(x^2 - y^2) ... no.

                // Let's use the code structure typically found in JS stats libraries for pairwise rotation.
                // Numerator = 2 * (p * sum( (x^2-y^2)*(2xy) ) - sum(x^2-y^2) * sum(2xy) )
                // Denominator = p * sum( (x^2-y^2)^2 - (2xy)^2 ) - ( sum(x^2-y^2)^2 - sum(2xy)^2 )

                let sum_d = 0; // x^2 - y^2
                let sum_c = 0; // 2xy
                let sum_d2_minus_c2 = 0;
                let sum_2dc = 0;

                for (let r = 0; r < p; r++) {
                    let x = R[r][i];
                    let y = R[r][j];
                    let d_val = x * x - y * y;
                    let c_val = 2 * x * y;

                    sum_d += d_val;
                    sum_c += c_val;
                    sum_d2_minus_c2 += (d_val * d_val - c_val * c_val);
                    sum_2dc += (2 * d_val * c_val);
                }

                const numer = 2 * (p * sum_2dc - sum_d * sum_c);
                const denom = p * sum_d2_minus_c2 - (sum_d * sum_d - sum_c * sum_c);

                const theta = Math.atan2(numer, denom) / 4;

                // Apply rotation if angle is significant
                if (Math.abs(theta) > epsilon) {
                    d += Math.abs(theta); // Track change
                    const cos = Math.cos(theta);
                    const sin = Math.sin(theta);

                    // Rotate loadings
                    for (let r = 0; r < p; r++) {
                        const x = R[r][i];
                        const y = R[r][j];
                        R[r][i] = x * cos + y * sin;
                        R[r][j] = -x * sin + y * cos;
                    }
                }
            }
        }
        if (d < epsilon) break;
    }

    return R; // Rotated loadings
}

console.log("\n[Test 3] Varimax Rotation (Logic)");
// Example Matrix (2 factors, 4 variables)
// Intentionally constructed to have simple structure after rotation
// Suppose Factor 1 loads on V1, V2. Factor 2 loads on V3, V4.
// Unrotated might be mixed.
// Ideally:
// F1': [ High, High, Low, Low ]
// F2': [ Low, Low, High, High ]

// Let's take a nearly perfect unrotated case and rotate it slightly (45 deg) to mix it, then see if Varimax recovers it.
// Original Simple:
// [1, 0]
// [1, 0]
// [0, 1]
// [0, 1]
// Rotate +45 deg:
// x' = x cos - y sin = 1*0.707 - 0 = 0.707
// y' = x sin + y cos = 1*0.707 + 0 = 0.707
// So mixed input:
const mixedLoadings = [
    [0.707, 0.707],
    [0.707, 0.707],
    [-0.707, 0.707], // 0*cos - 1*sin = -0.707; 0*sin + 1*cos = 0.707
    [-0.707, 0.707]
];
console.log("Input Mixed Loadings:", mixedLoadings);

const rotated = calculateVarimax(mixedLoadings);
console.log("Rotated Output:", rotated);

// Check if we recovered simple structure (columns having high/low separation)
// We expect values close to 1 or 0 (or -1). 
// Note: Varimax sign is arbitrary, so 1 or -1 are both 'High'.
const isSimple = rotated.every(row => {
    const absRow = row.map(Math.abs);
    // One should be high (>0.9), one low (<0.1)
    return (absRow[0] > 0.9 && absRow[1] < 0.1) || (absRow[0] < 0.1 && absRow[1] > 0.9);
});

if (isSimple) {
    console.log("✅ PASS: Varimax rotation recovered simple structure.");
} else {
    console.error("❌ FAIL: Varimax rotation did not recover simple structure.");
}

console.log("\n=== Logic Verification Complete ===");

