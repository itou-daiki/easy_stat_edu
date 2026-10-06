/**
 * 正規性の検定（Shapiro-Wilk検定）
 * Royston (1995) Algorithm AS R94 に基づく実装。R の shapiro.test / scipy.stats.shapiro と同じ方式。
 * 外部ライブラリに依存しない純粋関数のみで構成する。
 */

export const SHAPIRO_MIN_N = 3;
export const SHAPIRO_MAX_N = 5000;

/**
 * 標準正規分布の累積分布関数
 * erfc の Chebyshev 近似（相対誤差 1.2e-7 未満）を使用
 */
export function normalCdf(z) {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.5 * x);
    const erfc = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
        t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/**
 * 標準正規分布の分位点関数（Acklam の有理関数近似 + Newton 法で1回補正）
 */
export function normalQuantile(p) {
    if (!(p > 0 && p < 1)) {
        if (p === 0) return -Infinity;
        if (p === 1) return Infinity;
        return NaN;
    }
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
        1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
        6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
        -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
        3.754408661907416e+00];
    const pLow = 0.02425;

    let x;
    if (p < pLow) {
        const q = Math.sqrt(-2 * Math.log(p));
        x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pLow) {
        const q = p - 0.5;
        const r = q * q;
        x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
        const q = Math.sqrt(-2 * Math.log(1 - p));
        x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    // Newton-Raphson 補正（Halley 法）
    const e = normalCdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
}

/** AS R94 で使う多項式評価 cc[0] + cc[1]x + cc[2]x^2 + ... */
function poly(cc, x) {
    let result = 0;
    for (let i = cc.length - 1; i >= 0; i--) {
        result = result * x + cc[i];
    }
    return result;
}

function computeCoefficients(n) {
    const half = Math.floor(n / 2);
    if (n === 3) return [Math.SQRT1_2];

    const m = [];
    let summ2 = 0;
    for (let i = 1; i <= half; i++) {
        const value = normalQuantile((i - 0.375) / (n + 0.25));
        m.push(value);
        summ2 += value * value;
    }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(n);
    const a1 = poly([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[0] / ssumm2;

    const coefficients = new Array(half);
    coefficients[0] = a1;
    let start;
    let fac;
    if (n > 5) {
        const a2 = -m[1] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0] - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
        coefficients[1] = a2;
        start = 2;
    } else {
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0]) / (1 - 2 * a1 * a1));
        start = 1;
    }
    for (let i = start; i < half; i++) {
        coefficients[i] = -m[i] / fac;
    }
    return coefficients;
}

function shapiroPValue(w, n) {
    if (n === 3) {
        const pw = (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3);
        return Math.min(1, Math.max(0, pw));
    }
    const y = Math.log(1 - w);
    let mean;
    let sd;
    let z;
    if (n <= 11) {
        const gamma = poly([-2.273, 0.459], n);
        if (y >= gamma) return 1e-99;
        z = -Math.log(gamma - y);
        mean = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
        sd = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
        const logN = Math.log(n);
        z = y;
        mean = poly([-1.5861, -0.31082, -0.083751, 0.0038915], logN);
        sd = Math.exp(poly([-0.4803, -0.082676, 0.0030302], logN));
    }
    return 1 - normalCdf((z - mean) / sd);
}

/**
 * Shapiro-Wilk 検定
 * @param {number[]} values - 数値データ（欠損値は事前に除外しておくこと。NaN等はここでも除外する）
 * @returns {{ok: boolean, n: number, w: number|null, p: number|null, reason?: string}}
 *   ok=false の場合は reason に 'too_few' | 'too_many' | 'constant' が入る
 */
export function shapiroWilk(values) {
    const x = (values || [])
        .filter(value => typeof value === 'number' && Number.isFinite(value))
        .sort((a, b) => a - b);
    const n = x.length;

    if (n < SHAPIRO_MIN_N) return { ok: false, n, w: null, p: null, reason: 'too_few' };
    if (n > SHAPIRO_MAX_N) return { ok: false, n, w: null, p: null, reason: 'too_many' };

    const range = x[n - 1] - x[0];
    if (range === 0) return { ok: false, n, w: null, p: null, reason: 'constant' };

    const coefficients = computeCoefficients(n);
    const mean = x.reduce((sum, value) => sum + value, 0) / n;
    const ss = x.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    let b = 0;
    for (let i = 0; i < coefficients.length; i++) {
        b += coefficients[i] * (x[n - 1 - i] - x[i]);
    }
    const w = Math.min(1, (b * b) / ss);
    const p = shapiroPValue(w, n);
    return { ok: true, n, w, p };
}
