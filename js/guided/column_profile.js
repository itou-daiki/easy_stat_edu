/**
 * 初学者モード用：列の性質を調べ、選択肢の整理や「迷わないためのヒント」に使う
 * DOM に依存しない純粋関数のみ。
 */

const ID_NAME_PATTERN = /^(id|no\.?|番号|出席番号|学籍番号|生徒番号|整理番号|通し番号|回答者id|回答者番号|参加者id|ケース番号|#)$/i;
const ID_SUFFIX_PATTERN = /(^|[_\s-])(id|no)$|番号$/i;
const PAIRED_NAME_PATTERN = /(事前|事後|前期|後期|前半|後半|[0-9０-９一二三]+回目|[0-9０-９一二三]+学期|pre|post|before|after|time ?[0-9]|t[0-9]$|（前）|（後）|\(前\)|\(後\)|_前|_後)/i;
const MAX_GROUP_LEVELS = 10;

function isMissing(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function compareLabels(a, b) {
    return String(a).localeCompare(String(b), 'ja', { numeric: true, sensitivity: 'base' });
}

/** 1, 2, 3, ... のような通し番号（全員ちがう整数）かどうか */
function looksLikeSequence(values) {
    // 少人数の得点（例：5〜10点）を番号と誤認しないよう、10行以上かつ 0 または 1 から始まる場合だけ
    if (values.length < 10) return false;
    if (!values.every(value => Number.isInteger(value))) return false;
    if (new Set(values).size !== values.length) return false;
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[0] === 0 || sorted[0] === 1) && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
}

/**
 * 列ごとの性質をまとめる
 * @returns {{
 *   numeric: Array<{name: string, n: number, unique: number, mean: number, sd: number}>,
 *   groupCandidates: Array<{name: string, levels: Array<{name: string, n: number}>}>,
 *   excluded: Array<{name: string, reason: 'id'|'constant'}>
 * }}
 */
export function profileColumns(data, characteristics) {
    const rows = Array.isArray(data) ? data : [];
    const numericColumns = characteristics?.numericColumns || [];
    const categoricalColumns = characteristics?.categoricalColumns || [];
    const excluded = [];
    const excludedNames = new Set();
    const exclude = (name, reason) => {
        if (excludedNames.has(name)) return;
        excludedNames.add(name);
        excluded.push({ name, reason });
    };

    const allColumns = Array.from(new Set([...numericColumns, ...categoricalColumns]));
    allColumns.forEach(name => {
        const values = rows.map(row => row[name]).filter(value => !isMissing(value));
        if (values.length > 0 && new Set(values.map(String)).size === 1) {
            exclude(name, 'constant');
            return;
        }
        const numbers = values.map(Number).filter(Number.isFinite);
        const allUnique = new Set(values.map(String)).size === values.length && values.length >= 5;
        if (ID_NAME_PATTERN.test(String(name).trim())
            || (ID_SUFFIX_PATTERN.test(String(name).trim()) && allUnique)
            || (numbers.length === values.length && looksLikeSequence(numbers))) {
            exclude(name, 'id');
        }
    });

    const numeric = numericColumns
        .filter(name => !excludedNames.has(name))
        .map(name => {
            const values = rows.map(row => row[name]).filter(value => !isMissing(value)).map(Number).filter(Number.isFinite);
            const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
            const variance = values.length > 1
                ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
                : 0;
            return { name, n: values.length, unique: new Set(values).size, mean, sd: Math.sqrt(variance) };
        });

    const groupCandidates = categoricalColumns
        .filter(name => !excludedNames.has(name))
        .map(name => ({ name, levels: groupLevels(rows, name) }))
        .filter(column => column.levels.length >= 2);

    return { numeric, groupCandidates, excluded };
}

/**
 * グループの水準と人数（自然な順に並べる）
 * valueVar を渡すと、その列に数値が入っている人だけを数える
 */
export function groupLevels(data, groupVar, valueVar = null) {
    const counts = new Map();
    (data || []).forEach(row => {
        const value = row[groupVar];
        if (isMissing(value)) return;
        const key = String(value);
        if (!counts.has(key)) counts.set(key, 0);
        if (valueVar && (isMissing(row[valueVar]) || !Number.isFinite(Number(row[valueVar])))) return;
        counts.set(key, counts.get(key) + 1);
    });
    return Array.from(counts.entries())
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => compareLabels(a.name, b.name));
}

/**
 * グループの列を選んだときの注意
 * @returns {{tooSmall: Array<{name: string, n: number}>, tooMany: boolean}}
 */
export function groupWarnings(levels) {
    return {
        tooSmall: levels.filter(level => level.n < 2),
        tooMany: levels.length > MAX_GROUP_LEVELS
    };
}

/**
 * 「対応あり／なし」を選ぶためのヒント
 * @returns {{suggested: 'independent'|'paired'|null, groupColumns: string[], pairedColumns: string[]}}
 */
export function suggestDesign(profile) {
    const groupColumns = profile.groupCandidates
        .filter(column => column.levels.length <= MAX_GROUP_LEVELS)
        .filter(column => !profile.numeric.some(numeric => numeric.name === column.name && numeric.unique > MAX_GROUP_LEVELS))
        .map(column => column.name);
    const pairedColumns = profile.numeric
        .map(column => column.name)
        .filter(name => PAIRED_NAME_PATTERN.test(name));

    let suggested = null;
    if (pairedColumns.length >= 2 && groupColumns.length === 0) suggested = 'paired';
    else if (groupColumns.length > 0 && pairedColumns.length < 2) suggested = 'independent';
    else if (groupColumns.length === 0 && profile.numeric.length >= 2) suggested = 'paired';
    return { suggested, groupColumns, pairedColumns };
}

/**
 * 対応ありで比べる列の単位・尺度がそろっていそうか
 * 平均の比が大きい、または値の範囲がほとんど重ならない場合に注意を出す
 */
export function pairedScaleWarning(profile, names) {
    const columns = names.map(name => profile.numeric.find(column => column.name === name)).filter(Boolean);
    if (columns.length < 2) return false;
    const means = columns.map(column => Math.abs(column.mean));
    const maxMean = Math.max(...means);
    const minMean = Math.min(...means);
    const ratio = minMean > 0 ? maxMean / minMean : Infinity;
    const separated = columns.some((a, i) => columns.some((b, j) => i !== j
        && Math.abs(a.mean - b.mean) > 4 * Math.max(a.sd, b.sd, 1e-9)));
    return (maxMean > 0 && ratio >= 3) || separated;
}
