/**
 * @fileoverview 統計分析で使用する定数の定義
 * @module constants
 */

// ======================================================================
// 有意水準 (Significance Levels)
// ======================================================================

/**
 * 有意水準の定義
 * @constant
 */
export const SIGNIFICANCE_LEVELS = {
    /** 強い有意 (p < 0.001) */
    STRONG: 0.001,
    /** 中程度の有意 (p < 0.01) */
    MODERATE: 0.01,
    /** 弱い有意 (p < 0.05) */
    WEAK: 0.05,
    /** 傾向 (p < 0.10) */
    MARGINAL: 0.10
};

/**
 * 有意水準に対応する記号
 * @constant
 */
export const SIGNIFICANCE_SYMBOLS = {
    STRONG: '***',
    MODERATE: '**',
    WEAK: '*',
    MARGINAL: '†',
    NONE: 'n.s.'
};

/**
 * p値から有意性記号を取得
 * @param {number} p - p値
 * @returns {string} 有意性記号
 */
export function getSignificanceSymbol(p) {
    if (p < SIGNIFICANCE_LEVELS.STRONG) return SIGNIFICANCE_SYMBOLS.STRONG;
    if (p < SIGNIFICANCE_LEVELS.MODERATE) return SIGNIFICANCE_SYMBOLS.MODERATE;
    if (p < SIGNIFICANCE_LEVELS.WEAK) return SIGNIFICANCE_SYMBOLS.WEAK;
    if (p < SIGNIFICANCE_LEVELS.MARGINAL) return SIGNIFICANCE_SYMBOLS.MARGINAL;
    return SIGNIFICANCE_SYMBOLS.NONE;
}

// ======================================================================
// 最小サンプルサイズ (Minimum Sample Size)
// ======================================================================

/**
 * 各分析手法の最小サンプルサイズ
 * @constant
 */
export const MIN_SAMPLE_SIZE = {
    /** t検定の最小サンプル数 */
    T_TEST: 3,
    /** 相関分析の最小ペア数 */
    CORRELATION: 3,
    /** ANOVAの最小グループサイズ */
    ANOVA: 2,
    /** 回帰分析の最小サンプル数 */
    REGRESSION: 10,
    /** カイ二乗検定の最小期待度数 */
    CHI_SQUARE_EXPECTED: 5,
    /** 因子分析の最小サンプル数（変数あたり） */
    FACTOR_PER_VARIABLE: 5
};

// ======================================================================
// 効果量の閾値 (Effect Size Thresholds)
// ======================================================================

/**
 * Cohen's d の効果量基準
 * @constant
 */
export const COHENS_D_THRESHOLDS = {
    /** 小さい効果量 */
    SMALL: 0.2,
    /** 中程度の効果量 */
    MEDIUM: 0.5,
    /** 大きい効果量 */
    LARGE: 0.8
};

/**
 * η² (Eta-squared) の効果量基準
 * @constant
 */
export const ETA_SQUARED_THRESHOLDS = {
    /** 小さい効果量 */
    SMALL: 0.01,
    /** 中程度の効果量 */
    MEDIUM: 0.06,
    /** 大きい効果量 */
    LARGE: 0.14
};

/**
 * ω² (Omega-squared) の効果量基準
 * @constant
 */
export const OMEGA_SQUARED_THRESHOLDS = {
    SMALL: 0.01,
    MEDIUM: 0.06,
    LARGE: 0.14
};

/**
 * 相関係数 (r) の効果量基準
 * @constant
 */
export const CORRELATION_THRESHOLDS = {
    /** 弱い相関 */
    WEAK: 0.1,
    /** 中程度の相関 */
    MODERATE: 0.3,
    /** 強い相関 */
    STRONG: 0.5
};

/**
 * Cramer's V の効果量基準（自由度により異なる）
 * @constant
 */
export const CRAMERS_V_THRESHOLDS = {
    DF1: { SMALL: 0.1, MEDIUM: 0.3, LARGE: 0.5 },
    DF2: { SMALL: 0.07, MEDIUM: 0.21, LARGE: 0.35 },
    DF3: { SMALL: 0.06, MEDIUM: 0.17, LARGE: 0.29 }
};

/**
 * 効果量の大きさを判定
 * @param {number} value - 効果量の値
 * @param {Object} thresholds - 閾値オブジェクト
 * @returns {string} 'small' | 'medium' | 'large'
 */
export function getEffectSizeLabel(value, thresholds) {
    const absValue = Math.abs(value);
    if (absValue >= thresholds.LARGE) return '大';
    if (absValue >= thresholds.MEDIUM) return '中';
    if (absValue >= thresholds.SMALL) return '小';
    return '無視可能';
}

// ======================================================================
// その他の統計定数
// ======================================================================

/**
 * 正規分布のZ値（両側検定）
 * @constant
 */
export const Z_CRITICAL = {
    ALPHA_10: 1.645,
    ALPHA_05: 1.96,
    ALPHA_01: 2.576,
    ALPHA_001: 3.291
};

/**
 * 外れ値検出の閾値（IQR法）
 * @constant
 */
export const OUTLIER_IQR_MULTIPLIER = 1.5;
export const EXTREME_OUTLIER_IQR_MULTIPLIER = 3.0;

/**
 * 小数点以下の桁数
 * @constant
 */
export const DECIMAL_PLACES = {
    /** 統計量（t, F, χ²） */
    STATISTICS: 2,
    /** p値 */
    P_VALUE: 3,
    /** 効果量 */
    EFFECT_SIZE: 2,
    /** 相関係数 */
    CORRELATION: 2,
    /** パーセンタイル */
    PERCENTILE: 1
};
