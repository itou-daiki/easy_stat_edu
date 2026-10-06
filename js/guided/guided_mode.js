/**
 * 初学者モード（おまかせ分析）
 * 「やりたいこと」→「データの形」→「列の選択」→「分析する」の順に進み、
 * 前提チェックの結果から適切な手法を選んで既存の分析画面で自動実行する。
 */
import {
    selectCategoricalAssociation, selectCorrelationMulti, selectGroupComparisonMulti, selectPairedComparison,
    selectPredictionMulti
} from '../utils/method_selector.js';
import {
    escapeHtml, getDesignExplanation, getDesigns, getErrorMessage, getPurposes, getSelectionGuide, getTermExplanations, pick
} from './guided_copy.js';
import { analysisTypeFor, buildPreset, renderDecisionPanel, runGuidedPreset } from './guided_runner.js';
import { groupLevels, groupWarnings, pairedScaleWarning, profileColumns, suggestDesign } from './column_profile.js';

const MODE_STORAGE_KEY = 'easyStat.uiMode';
export const UI_MODES = { beginner: 'beginner', all: 'all' };

const state = {
    purpose: null,
    design: null,
    groupVar: '',
    valueVars: [],
    pairedVars: [],
    relationVars: [],
    predictors: [],
    x: '',
    y: '',
    rowVar: '',
    colVar: '',
    error: ''
};

let deps = null;
let panel = null;
let modeSwitch = null;

function readMode() {
    try {
        return localStorage.getItem(MODE_STORAGE_KEY) === UI_MODES.all ? UI_MODES.all : UI_MODES.beginner;
    } catch {
        return UI_MODES.beginner;
    }
}

function saveMode(mode) {
    try {
        localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
        // 保存できない環境（プライベートモード等）では毎回初学者モードで始まる
    }
}

export function getUiMode() {
    return document.getElementById('navigation-section')?.dataset.uiMode || readMode();
}

export function setUiMode(mode) {
    const navigation = document.getElementById('navigation-section');
    if (!navigation) return;
    const nextMode = mode === UI_MODES.all ? UI_MODES.all : UI_MODES.beginner;
    navigation.dataset.uiMode = nextMode;
    navigation.classList.toggle('is-beginner-mode', nextMode === UI_MODES.beginner);
    saveMode(nextMode);
    renderModeSwitch();
}

let profileCache = { data: null, characteristics: null, profile: null };

/** 初学者モードで選べる列（ID・番号の列や、全員同じ値の列は外す） */
function getProfile() {
    const data = deps.getData();
    const characteristics = deps.getCharacteristics();
    if (profileCache.data !== data || profileCache.characteristics !== characteristics || !profileCache.profile) {
        profileCache = { data, characteristics, profile: profileColumns(data, characteristics) };
    }
    return profileCache.profile;
}

function columns() {
    const profile = getProfile();
    return {
        numeric: profile.numeric.map(column => column.name),
        categorical: profile.groupCandidates.map(column => column.name)
    };
}

function hasData() {
    const data = deps.getData();
    return Array.isArray(data) && data.length > 0;
}

function renderModeSwitch() {
    if (!modeSwitch) return;
    const mode = getUiMode();
    modeSwitch.innerHTML = `
        <div class="ui-mode-tabs" role="group" aria-label="${pick('分析の選び方', 'How to choose an analysis')}">
            <button type="button" class="ui-mode-tab" data-ui-mode="beginner" aria-pressed="${mode === UI_MODES.beginner}">
                ${pick('初学者モード', 'Beginner mode')}
                <span>${pick('目的から選ぶ', 'Choose by goal')}</span>
            </button>
            <button type="button" class="ui-mode-tab" data-ui-mode="all" aria-pressed="${mode === UI_MODES.all}">
                ${pick('すべての手法から選ぶ', 'All methods')}
                <span>${pick('手法名から選ぶ', 'Choose by method name')}</span>
            </button>
        </div>`;
}

function optionList(options, selected, placeholder) {
    return `<option value="">${escapeHtml(placeholder)}</option>` + options
        .map(({ value, label }) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('');
}

/**
 * @param {string} field - state のキー
 * @param {string} label - ラベル
 * @param {Array<string|{value: string, label: string}>} names - 選択肢
 * @param {string} [help] - 補足
 */
function selectField(field, label, names, help) {
    const id = `guided-${field}`;
    const options = names.map(name => (typeof name === 'string' ? { value: name, label: name } : name));
    return `
        <div class="guided-field">
            <label for="${id}">${label}</label>
            <select id="${id}" data-guided-field="${field}" ${options.length ? '' : 'disabled'}>
                ${optionList(options, state[field], options.length ? pick('選択してください', 'Select…') : pick('使える列がありません', 'No suitable columns'))}
            </select>
            ${help ? `<p class="guided-field-help">${help}</p>` : ''}
        </div>`;
}

function groupOptions() {
    return getProfile().groupCandidates.map(column => ({
        value: column.name,
        label: pick(`${column.name}（${column.levels.length}グループ）`, `${column.name} (${column.levels.length} groups)`)
    }));
}

/** グループの人数が足りない列（値が入っている人で数える）。{ 列名: [人数が足りないグループ] } */
function smallGroupsByColumn() {
    const result = {};
    for (const valueVar of state.valueVars) {
        const { tooSmall } = groupWarnings(groupLevels(deps.getData(), state.groupVar, valueVar));
        if (tooSmall.length) result[valueVar] = tooSmall;
    }
    return result;
}

function groupPreview() {
    if (!state.groupVar || !hasData()) return '';
    const levels = groupLevels(deps.getData(), state.groupVar);
    const { tooSmall, tooMany } = groupWarnings(levels);
    const smallByColumn = smallGroupsByColumn();
    const items = levels
        .map(level => `<li class="${level.n < 2 ? 'is-warning' : ''}">${escapeHtml(level.name)} <small>${pick(`${level.n}人`, `n = ${level.n}`)}</small></li>`)
        .join('');
    const warnings = [];
    const names = list => list.map(level => escapeHtml(level.name));
    if (tooSmall.length) {
        warnings.push(pick(
            `「${names(tooSmall).join('」「')}」は1人しかいないため比べられません。データを確認するか、別の列を選んでください。`,
            `${names(tooSmall).join(', ')} has only one person, so it cannot be compared. Check the data or choose another column.`
        ));
    }
    Object.entries(smallByColumn).forEach(([column, small]) => {
        if (tooSmall.length && small.every(level => tooSmall.some(t => t.name === level.name))) return;
        warnings.push(pick(
            `「${escapeHtml(column)}」は、「${names(small).join('」「')}」のグループに値が入っている人が1人以下のため比べられません。この列を外すか、データを確認してください。`,
            `${escapeHtml(column)}: ${names(small).join(', ')} has fewer than two people with values. Remove this column or check the data.`
        ));
    });
    if (tooMany) {
        warnings.push(pick(
            `グループが${levels.length}個あります。「クラス」「性別」のようにグループを表す列か確認しましょう。点数などの数値の列を選んでいないか注意してください。`,
            `There are ${levels.length} groups. Make sure this column really represents groups (like class or gender), not scores.`
        ));
    }
    return `
        <div class="guided-group-preview">
            <p>${pick(`${levels.length}グループ`, `${levels.length} groups`)}${levels.length === 2 ? pick('（2群の比較）', ' (two-group comparison)') : levels.length >= 3 ? pick('（3群以上の比較）', ' (three or more groups)') : ''}</p>
            <ul>${items}</ul>
            ${warnings.map(text => `<p class="guided-inline-warning">${text}</p>`).join('')}
        </div>`;
}

/** 列をチェックボックスで複数選ぶ欄（選んだ順を覚える） */
function multiField(key, label, help, names, { minimum = 1 } = {}) {
    const labelId = `guided-${key}-label`;
    const selected = state[key];
    const items = names.map(name => {
        const checked = selected.includes(name);
        return `
            <label class="guided-check-item ${checked ? 'is-checked' : ''}">
                <input type="checkbox" data-guided-multi="${key}" value="${escapeHtml(name)}" ${checked ? 'checked' : ''}>
                ${escapeHtml(name)}
            </label>`;
    }).join('');
    return `
        <div class="guided-field">
            <span class="guided-field-label" id="${labelId}">${label}</span>
            ${help ? `<p class="guided-field-help">${help}</p>` : ''}
            <div class="guided-check-grid" role="group" aria-labelledby="${labelId}">${items || `<p>${pick('使える列がありません', 'No suitable columns')}</p>`}</div>
            ${selected.length >= minimum ? `<p class="guided-field-help">${pick('選んだ列', 'Selected')}: ${selected.map(escapeHtml).join('、')}（${selected.length}${pick('列', '')}）</p>` : ''}
        </div>`;
}

function pairedField(numeric) {
    const items = numeric.map(name => {
        const order = state.pairedVars.indexOf(name);
        const checked = order >= 0;
        return `
            <label class="guided-check-item ${checked ? 'is-checked' : ''}">
                <input type="checkbox" data-guided-paired="${escapeHtml(name)}" ${checked ? 'checked' : ''}>
                ${escapeHtml(name)}
                ${checked ? `<span class="guided-check-order">${pick(`${order + 1}回目`, `#${order + 1}`)}</span>` : ''}
            </label>`;
    }).join('');
    const scaleWarning = state.pairedVars.length >= 2 && pairedScaleWarning(getProfile(), state.pairedVars)
        ? `<p class="guided-inline-warning">${pick(
            '選んだ列は、値の大きさがかなり違います。同じものを同じ単位で測った列（例：事前テストと事後テスト）か確認しましょう。別々のものを比べているなら「2つの数値の関係を調べる」が合っているかもしれません。',
            'The selected columns have very different values. Check that they measure the same thing in the same unit (e.g. pre- and post-test). If they measure different things, "Relationship between two numbers" may fit better.'
        )}</p>`
        : '';
    return `
        <div class="guided-field">
            <span class="guided-field-label" id="guided-paired-label">${pick('比べたい数値の列（測った順に2つ以上選ぶ）', 'Numeric columns to compare (select 2+ in measurement order)')}</span>
            <p class="guided-field-help">${pick('同じものを同じ単位で測った列を選びます（例：事前と事後、1学期・2学期・3学期）', 'Choose columns that measure the same thing in the same unit (e.g. pre/post, term 1/2/3)')}</p>
            <div class="guided-check-grid" role="group" aria-labelledby="guided-paired-label">${items || `<p>${pick('使える列がありません', 'No suitable columns')}</p>`}</div>
            ${state.pairedVars.length ? `<p class="guided-field-help">${pick('比べる順', 'Order')}: ${state.pairedVars.map(escapeHtml).join(' → ')}</p>` : ''}
            ${scaleWarning}
        </div>`;
}

function noGroupColumnNotice() {
    return `<p class="guided-inline-warning">${pick(
        'このデータには、グループを表す列（「性別」「クラス」のように、いくつかの種類に分かれる列）が見つかりません。同じ人を2回以上測ったデータなら、Q2で「対応あり」を選んでください。',
        'No group column (such as gender or class) was found in this data. If the same people were measured more than once, choose "paired" in Q2.'
    )}</p>`;
}

function excludedNote() {
    const { excluded } = getProfile();
    if (!excluded.length) return '';
    const ids = excluded.filter(item => item.reason === 'id').map(item => escapeHtml(item.name));
    const constants = excluded.filter(item => item.reason === 'constant').map(item => escapeHtml(item.name));
    const parts = [];
    if (ids.length) parts.push(pick(`ID・番号の列（${ids.join('、')}）`, `ID / number columns (${ids.join(', ')})`));
    if (constants.length) parts.push(pick(`全員が同じ値の列（${constants.join('、')}）`, `columns where every value is the same (${constants.join(', ')})`));
    return `<p class="guided-field-help guided-excluded-note">${pick(
        `${parts.join('と')}は分析に使えないため、選択肢から外しています。`,
        `${parts.join(' and ')} cannot be analyzed, so they are not listed.`
    )}</p>`;
}

function variableFields() {
    const { numeric, categorical } = columns();
    switch (state.purpose) {
        case 'compare':
            if (state.design === 'independent') {
                if (!categorical.length) return noGroupColumnNotice();
                return selectField('groupVar', pick('グループを表す列', 'Group column'), groupOptions(),
                    pick('例：性別、クラス', 'e.g. gender, class')) + groupPreview()
                    + multiField('valueVars', pick('比べたい数値の列（いくつでも選べます）', 'Numeric columns to compare (choose any number)'),
                        pick('例：数学・英語・理科。列ごとに正規性を確かめて、手法を選びます', 'e.g. math, English, science. Each column is checked separately'),
                        numeric.filter(name => name !== state.groupVar));
            }
            if (state.design === 'paired') return pairedField(numeric);
            return '';
        case 'relation':
            return multiField('relationVars', pick('関係を調べたい数値の列（2つ以上）', 'Numeric columns (choose 2 or more)'),
                pick('3つ以上選ぶと、すべての組み合わせの相関を1つの表（相関行列）で見られます', 'With 3 or more columns you get a table of all pairwise correlations'),
                numeric, { minimum: 2 });
        case 'proportion':
            return selectField('rowVar', pick('1つ目のカテゴリの列', 'First category column'), groupOptions(), pick('例：性別', 'e.g. gender'))
                + selectField('colVar', pick('2つ目のカテゴリの列', 'Second category column'), groupOptions(), pick('例：部活動', 'e.g. club'));
        case 'predict':
            return selectField('y', pick('予測したい列（結果）', 'Column to predict (outcome)'), numeric, pick('例：テストの点数', 'e.g. test score'))
                + multiField('predictors', pick('予測に使う列（原因・手がかり。いくつでも選べます）', 'Predictor columns (cause / clue; choose any number)'),
                    pick('1つなら単回帰分析、2つ以上なら重回帰分析になります', 'One column gives simple regression; two or more give multiple regression'),
                    numeric.filter(name => name !== state.y));
        default:
            return '';
    }
}

/** まだ足りない入力を、次にやることとして文章で返す。そろっていれば null */
function pendingStep() {
    const sameColumn = pick('同じ列が2回選ばれています。別々の列を選んでください。', 'The same column is selected twice. Choose two different columns.');
    switch (state.purpose) {
        case 'compare':
            if (state.design === 'independent') {
                if (!columns().categorical.length) return pick('グループを表す列がないため、この方法では分析できません。', 'There is no group column, so this comparison is not possible.');
                if (!state.groupVar) return pick('「グループを表す列」を選んでください。', 'Choose the group column.');
                if (groupWarnings(groupLevels(deps.getData(), state.groupVar)).tooSmall.length
                    || Object.keys(smallGroupsByColumn()).length) {
                    return pick('人数が足りないグループがあるため分析できません（上の注意を確認してください）。', 'A group has too few people, so it cannot be analyzed (see the note above).');
                }
                if (!state.valueVars.length) return pick('「比べたい数値の列」を1つ以上選んでください。', 'Choose at least one numeric column to compare.');
                return null;
            }
            if (state.pairedVars.length < 2) {
                return pick(`比べたい列をあと${2 - state.pairedVars.length}つ選んでください。`, `Choose ${2 - state.pairedVars.length} more column(s).`);
            }
            return null;
        case 'relation':
            if (state.relationVars.length < 2) {
                return pick(`数値の列をあと${2 - state.relationVars.length}つ選んでください。`, `Choose ${2 - state.relationVars.length} more numeric column(s).`);
            }
            return null;
        case 'predict':
            if (!state.y) return pick('「予測したい列」を選んでください。', 'Choose the column to predict.');
            if (!state.predictors.length) return pick('「予測に使う列」を1つ以上選んでください。', 'Choose at least one predictor column.');
            return null;
        case 'proportion':
            if (!state.rowVar || !state.colVar) return pick('カテゴリの列を2つ選んでください。', 'Choose two category columns.');
            if (state.rowVar === state.colVar) return sameColumn;
            return null;
        default:
            return null;
    }
}

function designHint() {
    if (!hasData()) return '';
    const hint = suggestDesign(getProfile());
    if (!hint.suggested) return '';
    const name = list => list.slice(0, 4)
        .map(item => pick(`「${escapeHtml(item)}」`, `"${escapeHtml(item)}"`))
        .join(pick('', ', '));
    const reasons = [];
    if (hint.groupColumns.length) {
        reasons.push(pick(`グループを表す列${name(hint.groupColumns)}があります`, `it has group columns ${name(hint.groupColumns)}`));
    } else {
        reasons.push(pick('グループを表す列が見つかりません', 'no group column was found'));
    }
    if (hint.pairedColumns.length >= 2) {
        reasons.push(pick(`同じ人を繰り返し測ったように見える列${name(hint.pairedColumns)}があります`, `columns that look like repeated measurements ${name(hint.pairedColumns)}`));
    }
    const suggestion = hint.suggested === 'paired'
        ? pick('「対応あり」', '"paired"')
        : pick('「対応なし」', '"independent"');
    return `<p class="guided-design-hint">${pick(
        `このデータのヒント：${reasons.join('。')}。${suggestion}の可能性が高そうです。最後は、何を比べたいかで決めましょう。`,
        `Hint for this data: ${reasons.join('; ')}. ${suggestion} seems likely, but decide by what you want to compare.`
    )}</p>`;
}

function choiceList(name, items, selectedKey) {
    return items.map(item => `
        <label class="guided-choice ${selectedKey === item.key ? 'is-selected' : ''}">
            <input type="radio" name="${name}" value="${item.key}" ${selectedKey === item.key ? 'checked' : ''}>
            <span class="guided-choice-text">
                <strong>${item.title}</strong>
                <span>${item.description}</span>
                ${item.example ? `<small>${item.example}</small>` : ''}
                ${item.sample ? sampleTable(item.sample) : ''}
            </span>
        </label>`).join('');
}

function sampleTable(sample) {
    return `
        <span class="guided-sample">
            <span class="guided-sample-caption">${sample.caption}</span>
            <table class="guided-sample-table" aria-hidden="true">
                <thead><tr>${sample.headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
                <tbody>${sample.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </span>`;
}

function designExplanation() {
    const explanation = getDesignExplanation();
    return `
        <details class="guided-explain" ${state.design ? '' : 'open'}>
            <summary>${explanation.summary}</summary>
            <div class="guided-explain-body">
                ${explanation.paragraphs.map(text => `<p>${text}</p>`).join('')}
                <p class="guided-explain-tips-title">${pick('見分け方', 'How to tell')}</p>
                <ul>${explanation.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
            </div>
        </details>`;
}

function termExplanations() {
    const terms = getTermExplanations(state.purpose);
    if (!terms.length) return '';
    return `
        <details class="guided-terms">
            <summary>${pick('用語の説明', 'Glossary')}</summary>
            <dl>${terms.map(({ term, text }) => `<dt>${term}</dt><dd>${text}</dd>`).join('')}</dl>
        </details>`;
}

function selectionGuide() {
    const guide = getSelectionGuide(state.purpose, state.design);
    if (!guide) return '';
    return `
        <aside class="guided-guide" aria-label="${pick('手法の選び方', 'How the method is chosen')}">
            <p class="guided-guide-title">${pick('手法の選び方', 'How the method is chosen')}</p>
            <p class="guided-guide-check">${guide.check}</p>
            <table class="guided-guide-table">
                <thead><tr>${guide.headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead>
                <tbody>${guide.rows.map(([label, ...cells]) => `
                    <tr><th scope="row">${label}</th>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
            ${termExplanations()}
        </aside>`;
}

function question(number, title, body, extraClass = '') {
    return `
        <fieldset class="guided-question ${extraClass}">
            <legend><span class="guided-q-num">Q${number}</span>${title}</legend>
            ${body}
        </fieldset>`;
}

function render() {
    if (!panel) return;
    renderModeSwitch();
    let number = 1;
    const needsDesign = state.purpose === 'compare';
    const showVariables = state.purpose && state.purpose !== 'overview' && (!needsDesign || state.design);
    const isOverview = state.purpose === 'overview';
    const dataLoaded = hasData();
    const pending = dataLoaded && showVariables ? pendingStep() : null;

    const purposeQuestion = question(number++, pick('何を調べたいですか？', 'What do you want to find out?'),
        `<div class="guided-choices">${choiceList('guided-purpose', getPurposes(), state.purpose)}</div>`);
    const designQuestion = needsDesign
        ? question(number++, pick('どんなデータを比べますか？', 'What kind of data are you comparing?'),
            `${designHint()}<div class="guided-choices guided-choices-two">${choiceList('guided-design', getDesigns(), state.design)}</div>${designExplanation()}`)
        : '';
    const variableQuestion = showVariables
        ? question(number++, pick('使う列を選んでください', 'Choose the columns'), `
            <div class="guided-variable-layout">
                <div class="guided-fields">${dataLoaded ? variableFields() + excludedNote() : `<p class="guided-field-help">${getErrorMessage('no_data')}</p>`}</div>
                ${selectionGuide()}
            </div>`)
        : '';

    panel.innerHTML = `
        <p class="guided-lead">${pick(
            '質問に答えて「分析する」を押すと、データが前提（正規分布かどうかなど）を満たしているかを確かめてから、ふさわしい手法で分析します。',
            'Answer the questions and press Analyze. easyStat checks the assumptions (such as normality) and then runs a suitable method.'
        )}</p>
        ${dataLoaded ? '' : `<p class="guided-no-data">${getErrorMessage('no_data')}</p>`}
        ${purposeQuestion}
        ${designQuestion}
        ${variableQuestion}
        ${showVariables || isOverview ? `
            <div class="guided-actions">
                <button type="button" id="guided-run-btn" class="guided-run-btn" ${dataLoaded && !pending ? '' : 'disabled'}
                    ${pending ? 'aria-describedby="guided-run-status"' : ''}>
                    ${isOverview ? pick('データの全体像を見る', 'View the overview') : pick('分析する', 'Analyze')}
                </button>
                ${pending ? `<p id="guided-run-status" class="guided-run-status">${pending}</p>` : ''}
                <p class="guided-error" role="alert">${state.error ? escapeHtml(state.error) : ''}</p>
            </div>` : ''}
    `;
}

function purposeLabel() {
    const purpose = getPurposes().find(item => item.key === state.purpose);
    const design = state.purpose === 'compare' ? getDesigns().find(item => item.key === state.design) : null;
    return [purpose?.title, design?.title].filter(Boolean).join(' / ');
}

/** 現在の選択から手法を決める。失敗時は { error } */
function decide() {
    const data = deps.getData();
    switch (state.purpose) {
        case 'compare':
            if (state.design === 'independent') {
                if (!state.groupVar || !state.valueVars.length) return { error: 'need_vars' };
                const multi = selectGroupComparisonMulti(data, state.groupVar, state.valueVars);
                if (multi.error) return multi;
                const groups = multi.groups.map(group => ({
                    ...group,
                    context: { groupVar: state.groupVar, valueVars: group.vars }
                }));
                return { ...groups[0], groups, groupIndex: 0 };
            }
            if (state.pairedVars.length < 2) return { error: 'too_few_vars' };
            return { ...selectPairedComparison(data, state.pairedVars), context: { vars: [...state.pairedVars] } };
        case 'relation':
            if (state.relationVars.length < 2) return { error: 'need_vars' };
            return { ...selectCorrelationMulti(data, state.relationVars), context: { vars: [...state.relationVars] } };
        case 'proportion':
            if (!state.rowVar || !state.colVar) return { error: 'need_vars' };
            return { ...selectCategoricalAssociation(data, state.rowVar, state.colVar), context: { rowVar: state.rowVar, colVar: state.colVar } };
        case 'predict':
            if (!state.y || !state.predictors.length) return { error: 'need_vars' };
            return { ...selectPredictionMulti(data, state.predictors, state.y), context: { predictors: [...state.predictors], y: state.y } };
        default:
            return { error: 'need_vars' };
    }
}

function runGuidedAnalysis() {
    if (!hasData()) {
        state.error = getErrorMessage('no_data');
        render();
        return;
    }
    if (state.purpose === 'overview') {
        deps.openAnalysis('eda');
        return;
    }
    const decision = decide();
    if (decision.error) {
        const smallGroups = (decision.groups || []).filter(group => group.n < 2);
        const column = decision.column ? pick(`「${decision.column}」：`, `${decision.column}: `) : '';
        state.error = decision.error === 'group_too_small' && smallGroups.length
            ? column + pick(
                `「${smallGroups.map(group => group.name).join('」「')}」のグループは、数値がそろっている人が${smallGroups.map(group => group.n).join('・')}人しかいないため比べられません。`,
                `${smallGroups.map(group => group.name).join(', ')} has too few people with values (${smallGroups.map(group => group.n).join(', ')}), so it cannot be compared.`
            )
            : column + getErrorMessage(decision.error);
        render();
        return;
    }
    state.error = '';
    const guided = {
        methodKey: decision.methodKey,
        normal: decision.normal,
        checks: decision.checks,
        context: decision.context,
        purposeLabel: purposeLabel(),
        preset: buildPreset(decision.methodKey, decision.context),
        groups: decision.groups || null,
        groupIndex: decision.groupIndex ?? null
    };
    deps.openAnalysis(decision.analysisType, { guided });
}

function resetSelectionsFor(purpose) {
    Object.assign(state, {
        purpose,
        design: purpose === state.purpose ? state.design : null,
        groupVar: '', valueVars: [], pairedVars: [], relationVars: [], predictors: [], y: '', rowVar: '', colVar: '', error: ''
    });
}

function handleClick(event) {
    if (event.target.closest('#guided-run-btn')) runGuidedAnalysis();
}

function refocus(selector) {
    panel.querySelector(selector)?.focus();
}

function handleChange(event) {
    const { target } = event;
    if (target.name === 'guided-purpose') {
        resetSelectionsFor(target.value);
        render();
        refocus(`input[name="guided-purpose"][value="${target.value}"]`);
        return;
    }
    if (target.name === 'guided-design') {
        state.design = target.value;
        state.error = '';
        render();
        refocus(`input[name="guided-design"][value="${target.value}"]`);
        return;
    }
    const field = target.dataset.guidedField;
    if (field) {
        state[field] = target.value;
        if (field === 'y') state.predictors = state.predictors.filter(name => name !== target.value);
        if (field === 'groupVar') state.valueVars = state.valueVars.filter(name => name !== target.value);
        state.error = '';
        render();
        refocus(`#guided-${field}`);
        return;
    }
    const multiKey = target.dataset.guidedMulti;
    if (multiKey) {
        const value = target.value;
        state[multiKey] = target.checked
            ? [...state[multiKey].filter(name => name !== value), value]
            : state[multiKey].filter(name => name !== value);
        state.error = '';
        render();
        refocus(`[data-guided-multi="${multiKey}"][value="${CSS.escape(value)}"]`);
        return;
    }
    const paired = target.dataset.guidedPaired;
    if (paired !== undefined) {
        state.pairedVars = target.checked
            ? [...state.pairedVars.filter(name => name !== paired), paired]
            : state.pairedVars.filter(name => name !== paired);
        state.error = '';
        render();
        refocus(`[data-guided-paired="${CSS.escape(paired)}"]`);
    }
}

/** データ読み込み後などに呼ぶ。存在しない列の選択は外す */
export function refreshGuidedMode() {
    if (!deps) return;
    const { numeric, categorical } = columns();
    const keepIf = (value, list) => (list.includes(value) ? value : '');
    Object.assign(state, {
        groupVar: keepIf(state.groupVar, categorical),
        valueVars: state.valueVars.filter(name => numeric.includes(name)),
        pairedVars: state.pairedVars.filter(name => numeric.includes(name)),
        relationVars: state.relationVars.filter(name => numeric.includes(name)),
        predictors: state.predictors.filter(name => numeric.includes(name)),
        y: keepIf(state.y, numeric),
        rowVar: keepIf(state.rowVar, categorical),
        colVar: keepIf(state.colVar, categorical),
        error: ''
    });
    render();
}

/**
 * 分析画面の描画後に呼ぶ。変数を設定して自動実行し、判断理由パネルを表示する。
 */
let decisionLocaleHandler = null;

export async function applyGuidedAnalysis(container, guided) {
    const { ok, messages } = await runGuidedPreset(guided.methodKey, guided.preset);
    // 複数の列で合う手法が分かれたときは、ほかの列のまとまりを判断パネルで案内する
    const otherIndexes = (guided.groups || []).map((_, index) => index).filter(index => index !== guided.groupIndex);
    const panelState = {
        ...guided,
        autoRunFailed: !ok,
        runMessages: messages,
        otherGroups: guided.isAlternative ? [] : otherIndexes.map(index => guided.groups[index])
    };
    const openOtherGroup = position => {
        const index = otherIndexes[position];
        const group = guided.groups[index];
        deps.openAnalysis(group.analysisType, {
            guided: {
                ...guided,
                methodKey: group.methodKey,
                normal: group.normal,
                checks: group.checks,
                context: group.context,
                preset: buildPreset(group.methodKey, group.context),
                groupIndex: index
            }
        });
    };
    const openAlternative = alternativeKey => {
        deps.openAnalysis(analysisTypeFor(alternativeKey), {
            guided: {
                ...guided,
                methodKey: alternativeKey,
                preset: buildPreset(alternativeKey, guided.context),
                isAlternative: true,
                originalMethodKey: guided.isAlternative ? guided.originalMethodKey : guided.methodKey
            }
        });
    };
    const panelElement = renderDecisionPanel(container, panelState, openAlternative, openOtherGroup);
    panelElement.scrollIntoView({ block: 'start' });

    // 言語を切り替えたら、表示中の判断理由パネルも描き直す
    if (decisionLocaleHandler) document.removeEventListener('easystat:localechange', decisionLocaleHandler);
    decisionLocaleHandler = () => {
        if (!container.querySelector('.guided-decision')) {
            document.removeEventListener('easystat:localechange', decisionLocaleHandler);
            decisionLocaleHandler = null;
            return;
        }
        renderDecisionPanel(container, panelState, openAlternative, openOtherGroup);
    };
    document.addEventListener('easystat:localechange', decisionLocaleHandler);
    return ok;
}

/**
 * @param {{ getData: () => object[], getCharacteristics: () => object, openAnalysis: (type: string, options?: object) => void }} dependencies
 */
export function initGuidedMode(dependencies) {
    deps = dependencies;
    const navigation = document.getElementById('navigation-section');
    const featureGrid = navigation?.querySelector('.feature-grid');
    if (!navigation || !featureGrid) return;

    modeSwitch = document.createElement('div');
    modeSwitch.id = 'ui-mode-switch';
    modeSwitch.className = 'ui-mode-switch';
    modeSwitch.dataset.i18nIgnore = '';
    modeSwitch.addEventListener('click', event => {
        const button = event.target.closest('[data-ui-mode]');
        if (!button) return;
        setUiMode(button.dataset.uiMode);
        modeSwitch.querySelector(`[data-ui-mode="${button.dataset.uiMode}"]`)?.focus();
    });

    panel = document.createElement('div');
    panel.id = 'guided-panel';
    panel.className = 'guided-panel';
    panel.dataset.i18nIgnore = '';
    panel.addEventListener('click', handleClick);
    panel.addEventListener('change', handleChange);

    navigation.insertBefore(modeSwitch, featureGrid);
    navigation.insertBefore(panel, featureGrid);

    setUiMode(readMode());
    render();
    document.addEventListener('easystat:localechange', render);
}
