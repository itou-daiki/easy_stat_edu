/**
 * AI解釈補助に渡す「研究の目的」と「分析の選び方（何のために、どの分析を、なぜ選んだか）」
 */
import { getLocale } from './i18n.js';
import { ALPHA } from './utils/method_selector.js';
import { getMethodCopy, ALTERNATIVE_METHOD } from './guided/guided_copy.js';

const RESEARCH_PURPOSE_STORAGE = 'easyStat.researchPurpose';
export const RESEARCH_PURPOSE_MAX_LENGTH = 600;

const pick = (ja, en) => (getLocale() === 'en' ? en : ja);

export function readResearchPurpose() {
    try {
        return sessionStorage.getItem(RESEARCH_PURPOSE_STORAGE) || '';
    } catch {
        return '';
    }
}

function saveResearchPurpose(value) {
    try {
        if (value) sessionStorage.setItem(RESEARCH_PURPOSE_STORAGE, value);
        else sessionStorage.removeItem(RESEARCH_PURPOSE_STORAGE);
    } catch {
        // 保存できない環境では入力中の値だけを使う
    }
}

let researchPurpose = readResearchPurpose();

export function getResearchPurpose() {
    return researchPurpose.trim();
}

/**
 * AIパネルに「研究の目的・問い」の入力欄を設置する
 * @param {HTMLElement} anchor - この要素の直前に挿入する
 * @param {() => void} onChange - 入力内容が変わったときの処理（文脈の再計算など）
 */
export function installResearchPurposeField(anchor, onChange) {
    if (!anchor || document.getElementById('ai-research-purpose-field')) return;
    const field = document.createElement('div');
    field.id = 'ai-research-purpose-field';
    field.className = 'ai-research-purpose';
    field.dataset.i18nIgnore = '';

    const render = () => {
        field.innerHTML = `
            <label for="ai-research-purpose">${pick('研究の目的・問い（任意）', 'Research purpose or question (optional)')}</label>
            <textarea id="ai-research-purpose" rows="3" maxlength="${RESEARCH_PURPOSE_MAX_LENGTH}"
                aria-describedby="ai-research-purpose-help"
                placeholder="${pick('例：タブレットを使った授業で、生徒の数学の理解度が上がるかを調べたい', 'e.g. Does using tablets in class improve students\' math understanding?')}"></textarea>
            <p id="ai-research-purpose-help">${pick(
                '書いておくと、AIが結果をこの目的に照らして説明し、次に何をすべきかを提案します。名前などの個人情報は書かないでください。',
                'If provided, the AI explains the results in light of this purpose and suggests what to do next. Do not include personal information such as names.'
            )}</p>`;
        const textarea = field.querySelector('textarea');
        textarea.value = researchPurpose;
        textarea.addEventListener('input', () => {
            researchPurpose = textarea.value.slice(0, RESEARCH_PURPOSE_MAX_LENGTH);
            saveResearchPurpose(researchPurpose.trim());
            onChange?.();
        });
    };
    render();
    anchor.parentNode.insertBefore(field, anchor);
    document.addEventListener('easystat:localechange', render);
}

function summarizeCheck(check) {
    if (check.kind === 'normality') {
        const { result } = check;
        let target = check.label;
        if (check.isResidual) target = pick('残差', 'residuals');
        if (check.isDifference) target = pick(`差（${check.label}）`, `difference (${check.label})`);
        return {
            test: 'Shapiro-Wilk',
            target,
            n: result.n,
            W: result.ok ? Number(result.w.toFixed(3)) : null,
            p: result.ok ? Number(result.p.toPrecision(3)) : null,
            judgement: !result.ok
                ? (result.reason === 'too_many' ? 'normal_approximation' : `untestable_${result.reason}`)
                : (result.p < ALPHA ? 'not_normal' : 'normal')
        };
    }
    if (check.kind === 'levene') {
        return {
            test: 'Levene (Brown-Forsythe)',
            F: Number(check.f.toFixed(3)),
            df: [check.df1, check.df2],
            p: Number(check.p.toPrecision(3)),
            judgement: check.p < ALPHA ? 'unequal_variance' : 'equal_variance'
        };
    }
    if (check.kind === 'expected') {
        return {
            test: 'expected_counts',
            table: `${check.rows}x${check.cols}`,
            total: check.total,
            cellsBelow5: `${check.smallCells}/${check.cells}`,
            minExpected: Number(check.minExpected.toFixed(2))
        };
    }
    return null;
}

/**
 * 「何のために、どの分析を、なぜ選んだか」をAI用にまとめる
 * @param {object|null} guided - 初学者モードから来た場合の判断情報
 * @param {string} analysisTitle - 表示中の分析名
 */
export function buildAnalysisRationale(guided, analysisTitle) {
    if (!guided) {
        return {
            selectionMode: 'manual',
            note: pick(
                '利用者が手法の一覧から自分で選んだ分析です。手法の選択が研究の目的とデータに合っているかも確認してください。',
                'The user chose this analysis from the method list. Also check whether the choice fits the research purpose and the data.'
            ),
            method: analysisTitle
        };
    }
    const method = getMethodCopy(guided.methodKey);
    const alternativeKey = ALTERNATIVE_METHOD[guided.methodKey];
    return {
        selectionMode: guided.isAlternative ? 'beginner_mode_alternative' : 'beginner_mode_automatic',
        goal: guided.purposeLabel,
        variables: guided.context,
        method: method?.name || analysisTitle,
        reason: guided.isAlternative
            ? pick(
                `初学者モードは「${getMethodCopy(guided.originalMethodKey).name}」を選びましたが、比較のためにこの手法でも分析しています。`,
                `Beginner mode chose ${getMethodCopy(guided.originalMethodKey).name}; this method is run for comparison.`
            )
            : method?.reason,
        decisionRule: pick(
            'Shapiro-Wilk検定で p < .05 の群・変数があれば順位に基づく手法、なければ平均値に基づく手法を選ぶ。カテゴリの表は期待度数でカイ二乗検定とFisherの正確確率検定を選ぶ。',
            'If any group or variable has Shapiro-Wilk p < .05, a rank-based method is used; otherwise a mean-based method. For category tables, expected counts decide between chi-square and Fisher\'s exact test.'
        ),
        assumptionChecks: (guided.checks || []).map(summarizeCheck).filter(Boolean),
        alternativeMethod: alternativeKey ? getMethodCopy(alternativeKey).name : null
    };
}
