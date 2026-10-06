/**
 * 初学者モード：選ばれた手法の分析画面に変数を設定して自動実行し、
 * 「なぜこの手法を選んだか」を結果の上に表示する
 */
import { setVariableSelectorValue } from '../utils.js';
import { ALPHA } from '../utils/method_selector.js';
import {
    ALTERNATIVE_METHOD, METHOD_ANALYSIS_TYPE, escapeHtml, formatP, getMethodCopy, pick
} from './guided_copy.js';

/** 手法と変数の組み合わせから、分析画面に設定する内容を作る */
export function buildPreset(methodKey, context) {
    switch (methodKey) {
        case 'welch_t':
        case 'mann_whitney':
        case 'anova':
        case 'kruskal':
            return { groupVar: context.groupVar, valueVars: [context.valueVar] };
        case 'paired_t':
            return { pairs: [[context.vars[0], context.vars[1]]] };
        case 'wilcoxon':
        case 'wilcoxon_multi':
        case 'rm_anova':
            return { vars: context.vars };
        case 'pearson':
        case 'spearman':
            return { vars: [context.x, context.y], method: methodKey };
        case 'chi_square':
        case 'fisher':
            return { rowVar: context.rowVar, colVar: context.colVar };
        case 'regression':
            return { x: context.x, y: context.y };
        default:
            return {};
    }
}

function checkRadio(name, value) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (!radio) return false;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function click(id) {
    const button = document.getElementById(id);
    if (!button) throw new Error(`button not found: ${id}`);
    button.click();
}

function setValue(id, value) {
    if (!setVariableSelectorValue(id, value)) {
        throw new Error(`could not set ${id}`);
    }
}

function waitFor(selector, timeout = 4000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);
            if (Date.now() - started > timeout) return reject(new Error(`timeout: ${selector}`));
            setTimeout(tick, 50);
        };
        tick();
    });
}

const RUNNERS = {
    welch_t: ({ groupVar, valueVars }) => {
        checkRadio('test-type', 'independent');
        setValue('group-var', groupVar);
        setValue('dep-var-multiselect-hidden', valueVars);
        click('run-independent-btn');
    },
    mann_whitney: ({ groupVar, valueVars }) => {
        setValue('group-var', groupVar);
        setValue('dep-var-multiselect-hidden', valueVars);
        click('run-u-test-btn');
    },
    kruskal: ({ groupVar, valueVars }) => {
        setValue('group-var', groupVar);
        setValue('dep-var-multiselect-hidden', valueVars);
        click('run-kw-test-btn');
    },
    anova: ({ groupVar, valueVars }) => {
        checkRadio('anova-type', 'independent');
        setValue('factor-var', groupVar);
        setValue('dependent-var', valueVars);
        click('run-ind-anova-btn');
    },
    paired_t: ({ pairs }) => {
        checkRadio('test-type', 'paired');
        pairs.forEach(([pre, post]) => {
            setValue('paired-var-pre', pre);
            setValue('paired-var-post', post);
            click('add-pair-btn');
        });
        click('run-paired-btn');
    },
    wilcoxon: ({ vars }) => {
        setValue('dep-var-multiselect-hidden', vars);
        click('run-wilcoxon-test-btn');
    },
    rm_anova: ({ vars }) => {
        checkRadio('anova-type', 'repeated');
        const select = document.querySelector('#rep-dependent-var-container .multi-set-vars select[multiple]');
        if (!select) throw new Error('repeated-measures selector not found');
        if (!setVariableSelectorValue(select, vars)) throw new Error('could not set repeated-measures variables');
        click('run-rep-anova-btn');
    },
    pearson: async ({ vars, method }) => {
        setValue('correlation-vars', vars);
        click('run-correlation-btn');
        if (method === 'spearman') {
            const radio = await waitFor('input[name="correlation-method"][value="spearman"]');
            if (!radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    },
    chi_square: ({ rowVar, colVar }) => {
        setValue('row-var', rowVar);
        setValue('col-var', colVar);
        click('run-chi-btn');
    },
    fisher: ({ rowVar, colVar }) => {
        setValue('row-var', rowVar);
        setValue('col-var', colVar);
        click('run-fisher-btn');
    },
    regression: ({ x, y }) => {
        setValue('independent-var', x);
        setValue('dependent-var', y);
        click('run-simple-regression-btn');
    }
};
RUNNERS.wilcoxon_multi = RUNNERS.wilcoxon;
RUNNERS.spearman = RUNNERS.pearson;

function hasVisibleResults() {
    const section = document.getElementById('results-section');
    if (section && section.style.display !== 'none' && section.textContent.trim()) return true;
    const results = document.getElementById('analysis-results');
    return Boolean(results && results.offsetParent !== null && results.textContent.trim());
}

async function waitForResults(timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (hasVisibleResults()) return true;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
}

/**
 * 分析画面に変数を設定して実行する。
 * 分析モジュールは入力エラーを alert() で知らせるため、実行中だけ受け取ってパネルに表示する。
 * @returns {Promise<{ok: boolean, messages: string[]}>}
 */
export async function runGuidedPreset(methodKey, preset) {
    const runner = RUNNERS[methodKey];
    if (!runner) return { ok: false, messages: [] };
    const messages = [];
    const originalAlert = window.alert;
    window.alert = message => messages.push(String(message ?? ''));
    try {
        await runner(preset);
        const ok = messages.length === 0 && await waitForResults();
        return { ok, messages };
    } catch (error) {
        console.warn('[guided] auto-run failed:', error);
        return { ok: false, messages };
    } finally {
        window.alert = originalAlert;
    }
}

function renderNormalityRows(checks) {
    return checks
        .filter(check => check.kind === 'normality')
        .map(check => {
            const { result } = check;
            let label = check.label;
            if (check.isResidual) label = pick('予測のずれ（残差）', 'Residuals');
            else if (check.isDifference) label = pick(`差（${check.label}）`, `Difference (${check.label})`);

            let verdict;
            let status;
            if (!result.ok) {
                status = result.reason === 'too_many' ? 'info' : 'fail';
                verdict = {
                    too_few: pick('人数が少なく確認できない', 'Too few to test'),
                    constant: pick('全員同じ値で確認できない', 'All values are equal'),
                    too_many: pick('人数が多いので正規近似を使う', 'Large sample: normal approximation')
                }[result.reason];
            } else if (result.p < ALPHA) {
                status = 'fail';
                verdict = pick('正規分布とはいえない', 'Not normal');
            } else {
                status = 'pass';
                verdict = pick('正規分布とみなせる', 'Looks normal');
            }
            return `
                <tr>
                    <th scope="row">${escapeHtml(label)}</th>
                    <td>${result.n}</td>
                    <td>${result.ok ? result.w.toFixed(3) : '—'}</td>
                    <td>${result.ok ? formatP(result.p) : '—'}</td>
                    <td class="guided-verdict guided-verdict-${status}">${verdict}</td>
                </tr>`;
        })
        .join('');
}

function renderNormalitySection(checks) {
    const rows = renderNormalityRows(checks);
    if (!rows) return '';
    return `
        <section class="guided-check">
            <h4>${pick('正規性の検定（Shapiro-Wilk検定）', 'Normality test (Shapiro-Wilk)')}</h4>
            <p class="guided-check-lead">${pick(
                'データが「正規分布（左右対称の山型）」とみなせるかを確かめます。p が .05 以上なら「正規分布とみなせる」と判断します。',
                'Checks whether the data look like a normal (bell-shaped) distribution. If p is .05 or more, we treat it as normal.'
            )}</p>
            <div class="guided-table-wrap">
                <table class="guided-check-table">
                    <thead><tr>
                        <th scope="col">${pick('対象', 'Target')}</th><th scope="col">n</th><th scope="col">W</th><th scope="col">p</th><th scope="col">${pick('判定', 'Result')}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </section>`;
}

function renderLeveneSection(checks, methodKey) {
    const levene = checks.find(check => check.kind === 'levene');
    if (!levene || !['welch_t', 'anova'].includes(methodKey)) return '';
    const unequal = levene.p < ALPHA;
    let note;
    if (methodKey === 'welch_t') {
        note = pick(
            'Welchのt検定は散らばりが違っていても使えるので、この結果は参考です。',
            "Welch's t-test does not assume equal spread, so this is for reference."
        );
    } else {
        note = unequal
            ? pick('散らばりが等しいとはいえません。結果の読み取りは慎重に行い、クラスカル・ウォリス検定でも確かめると安心です。',
                'Spreads are not equal. Interpret with care and consider checking with the Kruskal-Wallis test.')
            : pick('散らばりが大きく違うとはいえないので、分散分析を使って問題ありません。', 'Spreads are similar enough for ANOVA.');
    }
    return `
        <section class="guided-check">
            <h4>${pick('散らばりの等しさ（Levene検定・参考）', 'Equal spread (Levene test, reference)')}</h4>
            <p>F(${levene.df1}, ${levene.df2}) = ${levene.f.toFixed(2)}, p = ${formatP(levene.p)} —
                <strong>${unequal ? pick('散らばりが等しいとはいえない', 'Spreads differ') : pick('散らばりは等しいとみなせる', 'Spreads look equal')}</strong></p>
            <p class="guided-check-note">${note}</p>
        </section>`;
}

function renderExpectedSection(checks) {
    const check = checks.find(item => item.kind === 'expected');
    if (!check) return '';
    const ratio = Math.round(check.smallCellRatio * 100);
    const rule = check.is2x2
        ? pick('2×2の表では、期待度数が5未満のセルが1つでもあればフィッシャーの正確確率検定を使います。',
            "For a 2×2 table, Fisher's exact test is used if any expected count is below 5.")
        : pick('期待度数が5未満のセルが20%を超える、または1未満のセルがある場合はフィッシャーの正確確率検定を使います。',
            "Fisher's exact test is used if more than 20% of expected counts are below 5 or any is below 1.");
    return `
        <section class="guided-check">
            <h4>${pick('期待度数のチェック', 'Expected count check')}</h4>
            <ul class="guided-check-list">
                <li>${pick('表の大きさ', 'Table size')}: ${check.rows} × ${check.cols}（${pick('合計', 'total')} ${check.total}）</li>
                <li>${pick('期待度数が5未満のセル', 'Cells with expected count < 5')}: ${check.smallCells} / ${check.cells}（${ratio}%）</li>
                <li>${pick('最小の期待度数', 'Smallest expected count')}: ${check.minExpected.toFixed(2)}</li>
            </ul>
            <p class="guided-check-note">${rule}</p>
        </section>`;
}

function checkLabel(check) {
    if (check.isResidual) return pick('残差', 'residuals');
    if (check.isDifference) return pick(`「${check.label}」の差`, `difference (${check.label})`);
    return check.label;
}

/** 前提の確認の結果を1〜2文にまとめる */
function summarizeChecks(guided) {
    const normality = guided.checks.filter(check => check.kind === 'normality');
    const expected = guided.checks.find(check => check.kind === 'expected');
    if (expected) {
        const ratio = Math.round(expected.smallCellRatio * 100);
        return pick(
            `期待度数が5未満のセル：${expected.cells}個中${expected.smallCells}個（${ratio}%）、最小の期待度数：${expected.minExpected.toFixed(2)}`,
            `Cells with expected count < 5: ${expected.smallCells} of ${expected.cells} (${ratio}%); smallest expected count: ${expected.minExpected.toFixed(2)}`
        );
    }
    if (!normality.length) return '';
    const failed = normality.filter(check => !check.result.ok ? check.result.reason !== 'too_many' : check.result.p < ALPHA);
    const prefix = pick('正規性の検定（Shapiro-Wilk）：', 'Shapiro-Wilk: ');
    if (!failed.length) {
        const labels = normality.map(check => escapeHtml(checkLabel(check)));
        const subject = labels.length === 1
            ? pick(`${labels[0]}は`, `${labels[0]} looks`)
            : labels.length === 2
                ? pick(`${labels[0]}と${labels[1]}のどちらも`, `both ${labels[0]} and ${labels[1]} look`)
                : pick(`${labels.join('、')}のすべてで`, `all of ${labels.join(', ')} look`);
        return prefix + pick(`${subject}正規分布とみなせる（p ≥ .05）`, `${subject} normal (p ≥ .05)`);
    }
    const detail = failed.map(check => {
        const label = escapeHtml(checkLabel(check));
        if (!check.result.ok) {
            return check.result.reason === 'too_few'
                ? pick(`${label}は人数が少なく確認できない`, `${label}: too few to test`)
                : pick(`${label}は全員同じ値`, `${label}: all values equal`);
        }
        const pText = check.result.p < 0.001 ? 'p &lt; .001' : `p = ${formatP(check.result.p)}`;
        return `${label}（${pText}）`;
    }).join(pick('、', ', '));
    return prefix + pick(`正規分布とはいえないものがある → ${detail}`, `not normal → ${detail}`);
}

function renderNotes(guided) {
    const notes = [];
    const normalityChecks = guided.checks.filter(check => check.kind === 'normality');
    const smallN = normalityChecks.some(check => check.result.n < 10);
    const largeN = normalityChecks.length > 0 && normalityChecks.every(check => check.result.n >= 30);
    if (guided.methodKey === 'regression' && guided.normal === false) {
        notes.push(pick('予測のずれ（残差）が正規分布とはいえません。p値の解釈は慎重に行いましょう。',
            'Residuals are not normally distributed, so interpret p-values with care.'));
    }
    if (smallN && guided.methodKey !== 'regression') {
        notes.push(pick('人数が少ない（10未満）と、正規性の検定では「正規分布ではない」ことを見つけにくくなります。グラフでも分布の形を確かめましょう。',
            'With fewer than 10 values, normality tests rarely detect non-normality. Also check the shape in the charts.'));
    }
    if (largeN && guided.normal === false) {
        notes.push(pick('人数が多い（30以上）と、わずかなずれでも「正規分布とはいえない」と判定されやすくなります。下のボタンで、もう一方の手法の結果とも見比べてみましょう。',
            'With 30 or more values, even tiny departures can be flagged as non-normal. Compare with the other method using the button below.'));
    }
    if (!notes.length) return '';
    return `<ul class="guided-notes">${notes.map(note => `<li>${note}</li>`).join('')}</ul>`;
}

function scrollToResults(container) {
    const target = container.querySelector('#analysis-results, #results-section');
    (target && target.offsetParent !== null ? target : container.querySelector('.guided-decision'))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 判断理由パネルを分析画面の先頭に挿入する
 * @param {HTMLElement} container - 分析画面のコンテナ
 * @param {object} guided - { methodKey, normal, checks, purposeLabel, isAlternative, originalMethodKey, autoRunFailed }
 * @param {(methodKey: string) => void} onAlternative - 別の手法で確かめるボタンの処理
 */
export function renderDecisionPanel(container, guided, onAlternative) {
    container.querySelector('.guided-decision')?.remove();
    const method = getMethodCopy(guided.methodKey);
    const alternativeKey = ALTERNATIVE_METHOD[guided.methodKey];
    const alternative = alternativeKey ? getMethodCopy(alternativeKey) : null;
    const original = guided.isAlternative ? getMethodCopy(guided.originalMethodKey) : null;

    const panel = document.createElement('section');
    panel.className = 'guided-decision';
    panel.dataset.i18nIgnore = '';
    panel.dataset.guidedMethod = guided.methodKey;
    panel.setAttribute('aria-labelledby', 'guided-decision-title');

    const title = guided.isAlternative
        ? pick(`比較のため「${method.name}」で分析しました`, `Analyzed with ${method.name} for comparison`)
        : pick(`この分析では「${method.name}」を使いました`, `This analysis used ${method.name}`);
    const methodText = guided.isAlternative
        ? pick(`初学者モードの判断では「${original.name}」でした。2つの結論が同じかどうか見比べてみましょう。`,
            `Beginner mode originally chose ${original.name}. Check whether both conclusions agree.`)
        : method.reason;
    const checkSummary = summarizeChecks(guided);

    panel.innerHTML = `
        <p class="guided-decision-eyebrow">${pick('初学者モード：手法の選び方', 'Beginner mode: how the method was chosen')}</p>
        <h3 id="guided-decision-title">${escapeHtml(title)}</h3>
        <ol class="guided-path">
            ${guided.purposeLabel ? `<li><span class="guided-path-label">${pick('やりたいこと', 'Goal')}</span><span>${escapeHtml(guided.purposeLabel)}</span></li>` : ''}
            ${checkSummary ? `<li><span class="guided-path-label">${pick('前提の確認', 'Assumptions')}</span><span>${checkSummary}</span></li>` : ''}
            <li><span class="guided-path-label">${pick('使った手法', 'Method')}</span><span>${methodText}</span></li>
        </ol>
        ${guided.autoRunFailed ? `<div class="guided-decision-warning">
            <p>${pick('自動で実行できませんでした。下の画面で列を確認して、実行ボタンを押してください。', 'Auto-run failed. Check the columns below and press the run button.')}</p>
            ${(guided.runMessages || []).map(message => `<p>${escapeHtml(message)}</p>`).join('')}
        </div>` : ''}
        ${renderNotes(guided)}
        <details class="guided-decision-details">
            <summary>${pick('前提の確認の詳しい結果', 'Detailed assumption checks')}</summary>
            <div class="guided-decision-body">
                ${renderNormalitySection(guided.checks)}
                ${renderLeveneSection(guided.checks, guided.methodKey)}
                ${renderExpectedSection(guided.checks)}
            </div>
        </details>
        <div class="guided-decision-actions">
            ${guided.autoRunFailed ? '' : `<button type="button" class="guided-btn guided-btn-primary" data-guided-scroll>${pick('結果へ移動', 'Go to results')}</button>`}
            ${alternative ? `<button type="button" class="guided-btn" data-guided-alternative="${alternativeKey}">
                ${pick(`「${alternative.name}」でも確かめる`, `Also check with ${alternative.name}`)}</button>` : ''}
        </div>
    `;

    panel.querySelector('[data-guided-alternative]')?.addEventListener('click', event => {
        onAlternative(event.currentTarget.dataset.guidedAlternative);
    });
    panel.querySelector('[data-guided-scroll]')?.addEventListener('click', () => scrollToResults(container));
    container.prepend(panel);
    return panel;
}

export function analysisTypeFor(methodKey) {
    return METHOD_ANALYSIS_TYPE[methodKey];
}
