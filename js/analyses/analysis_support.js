import { showError } from '../utils.js';

const TYPE_LABELS = {
    numeric: { text: '数値', icon: 'fa-hashtag', className: 'as-badge-num' },
    categorical: { text: 'カテゴリ', icon: 'fa-tags', className: 'as-badge-cat' },
    text: { text: 'テキスト', icon: 'fa-align-left', className: 'as-badge-text' },
    date: { text: '日付候補', icon: 'fa-calendar-days', className: 'as-badge-date' }
};

const PURPOSES = [
    { key: 'overview', label: '全体像をつかむ', icon: 'fa-search' },
    { key: 'compare', label: '差を比べる', icon: 'fa-scale-balanced' },
    { key: 'association', label: '関係を見る', icon: 'fa-link' },
    { key: 'prediction', label: '予測する', icon: 'fa-chart-line' },
    { key: 'proportion', label: '割合を見る', icon: 'fa-table-cells' },
    { key: 'dimension', label: '項目をまとめる', icon: 'fa-compress' },
    { key: 'utility', label: '下準備する', icon: 'fa-screwdriver-wrench' }
];

const ANALYSIS_INFO = {
    eda: {
        title: '探索的データ分析（EDA）',
        icon: 'fa-search',
        purpose: ['overview'],
        description: '平均・中央値・ばらつき・分布・外れ値を確認します。',
        resultFocus: '平均、中央値、標準偏差、ヒストグラム、箱ひげ図',
        caution: '本格的な検定の前に、必ず最初に見ておくと安心です。'
    },
    ttest: {
        title: 't検定',
        icon: 'fa-vial',
        purpose: ['compare'],
        description: '2群の平均、同じ人の前後差、または平均との差を検定します。',
        resultFocus: '平均差、t値、p値、効果量 d / d_z',
        caution: '別々の人を比べるのか、同じ人の前後を比べるのかを先に決めます。'
    },
    mann_whitney: {
        title: 'マン・ホイットニーのU検定',
        icon: 'fa-balance-scale',
        purpose: ['compare'],
        description: '2群を順位で比べます。偏りや外れ値が強い時の選択肢です。',
        resultFocus: 'U値、Z値、p値、順位の差',
        caution: '平均値そのものではなく、分布や順位の違いを見る検定です。'
    },
    wilcoxon_signed_rank: {
        title: 'ウィルコクソンの符号付順位検定',
        icon: 'fa-exchange-alt',
        purpose: ['compare'],
        description: '同じ人の事前・事後など、対応のある2変数を順位で比べます。',
        resultFocus: 'W値、Z値、p値、差の向き',
        caution: '対応のない2群には使いません。'
    },
    anova_one_way: {
        title: '一要因分散分析（ANOVA）',
        icon: 'fa-chart-bar',
        purpose: ['compare'],
        description: '3群以上の平均に差があるかを調べます。',
        resultFocus: 'F値、p値、効果量、事後検定',
        caution: '有意な時は、どの群同士が違うかを事後検定で確認します。'
    },
    anova_two_way: {
        title: '二要因分散分析',
        icon: 'fa-th-large',
        purpose: ['compare', 'association'],
        description: '2つの要因による平均の違いと交互作用を調べます。',
        resultFocus: '主効果、交互作用、単純主効果、事後検定',
        caution: '「A要因の効果」「B要因の効果」「組み合わせの効果」を分けて読みます。'
    },
    kruskal_wallis: {
        title: 'クラスカル・ウォリス検定',
        icon: 'fa-sort-amount-up',
        purpose: ['compare'],
        description: '3群以上を順位で比べます。偏りが大きい時のANOVAの代替です。',
        resultFocus: 'H値、p値、順位平均、多重比較',
        caution: '平均値の差ではなく、順位や分布の違いとして解釈します。'
    },
    cross_tabulation: {
        title: 'クロス集計',
        icon: 'fa-border-all',
        purpose: ['proportion', 'overview'],
        description: 'カテゴリ同士の人数・割合の内訳を見ます。',
        resultFocus: '度数、行割合、列割合、帯グラフ',
        caution: '検定の前に、まず人数の偏りを目で確認します。'
    },
    chi_square: {
        title: 'カイ二乗検定',
        icon: 'fa-table',
        purpose: ['proportion', 'association'],
        description: '2つのカテゴリ変数に関連があるかを検定します。',
        resultFocus: 'χ²値、p値、期待度数、残差',
        caution: '期待度数が小さいセルが多い時はフィッシャー検定も検討します。'
    },
    fisher_exact: {
        title: 'フィッシャーの正確確率検定',
        icon: 'fa-bullseye',
        purpose: ['proportion', 'association'],
        description: '小標本のカテゴリ表で関連を検定します。',
        resultFocus: 'p値、オッズ比',
        caution: '人数が少ない2x2表で特に有効です。'
    },
    mcnemar: {
        title: 'マクネマー検定',
        icon: 'fa-sync-alt',
        purpose: ['proportion', 'compare'],
        description: '同じ人の事前・事後など、対応のある2値カテゴリの変化を見ます。',
        resultFocus: '変化した人数、χ²値、p値',
        caution: '同じ対象を2回測っているデータに使います。'
    },
    correlation: {
        title: '相関分析',
        icon: 'fa-project-diagram',
        purpose: ['association'],
        description: '数値同士が一緒に増減するかを調べます。',
        resultFocus: '相関係数 r、p値、散布図、相関行列',
        caution: '相関は因果関係を証明しません。外れ値にも注意します。'
    },
    regression_simple: {
        title: '単回帰分析',
        icon: 'fa-chart-line',
        purpose: ['prediction', 'association'],
        description: '1つの説明変数から1つの数値を予測します。',
        resultFocus: '回帰係数、R²、p値、残差プロット',
        caution: 'XとYの役割を決めてから実行します。'
    },
    regression_multiple: {
        title: '重回帰分析',
        icon: 'fa-layer-group',
        purpose: ['prediction'],
        description: '複数の説明変数から数値の結果を予測します。',
        resultFocus: '標準化β、R²、自由度調整済みR²、VIF',
        caution: '説明変数同士が似すぎていないか、VIFを確認します。'
    },
    logistic_regression: {
        title: 'ロジスティック回帰分析',
        icon: 'fa-sign-in-alt',
        purpose: ['prediction', 'proportion'],
        description: '合格/不合格、有/無など2値の結果を予測します。',
        resultFocus: 'オッズ比、p値、予測確率、疑似R²',
        caution: '目的変数は2値カテゴリ、説明変数は数値です。'
    },
    factor_analysis: {
        title: '因子分析',
        icon: 'fa-diagram-project',
        purpose: ['dimension'],
        description: '複数項目の背後にある共通因子を探します。',
        resultFocus: '因子負荷量、因子数、回転後の構造',
        caution: 'アンケート項目など、同じ構成概念を測る列に向いています。'
    },
    pca: {
        title: '主成分分析（PCA）',
        icon: 'fa-compress-arrows-alt',
        purpose: ['dimension', 'overview'],
        description: '多くの数値変数を少数の総合指標に圧縮します。',
        resultFocus: '寄与率、累積寄与率、主成分負荷量、主成分得点',
        caution: '予測よりも、要約・可視化・総合指標作りに向いています。'
    },
    time_series: {
        title: '時系列データ分析',
        icon: 'fa-chart-area',
        purpose: ['overview', 'prediction'],
        description: '時間順の数値データのトレンドや周期を見ます。',
        resultFocus: '折れ線、移動平均、自己相関',
        caution: '日付や月順に並んでいるかを確認します。'
    },
    text_mining: {
        title: 'テキストマイニング',
        icon: 'fa-font',
        purpose: ['overview'],
        description: '自由記述の頻出語・共起・ワードクラウドを確認します。',
        resultFocus: '頻出語、ワードクラウド、共起ネットワーク',
        caution: '個人情報や表記ゆれを事前に確認します。'
    },
    data_processing: {
        title: 'データ加工・整形',
        icon: 'fa-filter',
        purpose: ['utility'],
        description: '欠損処理、フィルタ、逆転項目、標準化、計算列を作ります。',
        resultFocus: '欠損、外れ値、変数型、作成した新しい列',
        caution: '加工後は必ずデータプレビューで確認します。'
    },
    data_merge: {
        title: 'データ結合',
        icon: 'fa-object-group',
        purpose: ['utility'],
        description: '2つのファイルをIDなどのキーで横に結合します。',
        resultFocus: '結合キー、結合方法、重複ID、未結合行',
        caution: '同じIDが複数行ある場合は、結合結果を慎重に確認します。'
    },
    factor_score: {
        title: '因子得点算出',
        icon: 'fa-calculator',
        purpose: ['utility', 'dimension'],
        description: '複数項目を合計・平均して尺度得点を作ります。',
        resultFocus: '使用項目、逆転項目、合計/平均、新しい得点列',
        caution: '逆転項目がある場合は、先に処理してから得点化します。'
    }
};

let state = {
    selectedVars: [],
    selectedPurposes: new Set()
};

export function render(container, data, characteristics) {
    const profile = buildDataProfile(data, characteristics);
    state = { selectedVars: [], selectedPurposes: new Set() };

    container.innerHTML = `
        <style>${supportStyles()}</style>
        <div class="analysis-support-shell">
            <section class="as-hero">
                <div>
                    <p class="as-eyebrow"><i class="fas fa-magic"></i> Analysis Supporter</p>
                    <h3>分析サポーター</h3>
                    <p>読み込んだデータと知りたい目的から、使うべき分析・選ぶ変数・結果で見る指標を案内します。</p>
                </div>
                <div class="as-score-card">
                    <span>データ準備度</span>
                    <strong>${profile.readiness.score}<small>/100</small></strong>
                    <em>${escapeHtml(profile.readiness.label)}</em>
                </div>
            </section>

            <section class="as-panel">
                <div class="as-panel-title">
                    <h4><i class="fas fa-clipboard-check"></i> データの状態</h4>
                    <span>${profile.rowCount.toLocaleString()}行 / ${profile.columnCount.toLocaleString()}列</span>
                </div>
                <div class="as-metrics">
                    ${metricHtml('数値', profile.counts.numeric, 'fa-hashtag')}
                    ${metricHtml('カテゴリ', profile.counts.categorical, 'fa-tags')}
                    ${metricHtml('テキスト', profile.counts.text, 'fa-align-left')}
                    ${metricHtml('日付候補', profile.counts.date, 'fa-calendar-days')}
                    ${metricHtml('欠損セル', profile.missingCells, 'fa-circle-exclamation')}
                </div>
                <div id="support-data-notes" class="as-notes"></div>
            </section>

            <section class="as-panel">
                <div class="as-panel-title">
                    <h4><i class="fas fa-compass"></i> 何を知りたいですか？</h4>
                    <span>任意。選ぶと候補を絞り込みます</span>
                </div>
                <div class="as-purpose-grid">
                    ${PURPOSES.map(p => `
                        <button type="button" class="as-purpose" data-purpose="${p.key}">
                            <i class="fas ${p.icon}"></i><span>${p.label}</span>
                        </button>
                    `).join('')}
                </div>
            </section>

            <section class="as-panel">
                <div class="as-panel-title">
                    <h4><i class="fas fa-check-square"></i> 関心のある変数</h4>
                    <span>複数選択できます</span>
                </div>
                <div id="support-var-container"></div>
            </section>

            <section id="recommendation-area" class="as-panel as-recommendation-area">
                <div class="as-panel-title">
                    <h4><i class="fas fa-lightbulb"></i> おすすめの分析手法</h4>
                    <span id="recommendation-summary"></span>
                </div>
                <div id="recommendation-list" class="as-rec-list"></div>
            </section>
        </div>
    `;

    renderDataNotes(profile);
    renderVariableSelector(profile);
    setupInteraction(data, profile);
    updateRecommendations(data, profile);
}

function renderVariableSelector(profile) {
    const varContainer = document.getElementById('support-var-container');
    const optionsHtml = profile.columns.map(col => `
        <div class="multiselect-option"
            data-value="${escapeAttribute(col.name)}"
            data-type="${escapeAttribute(col.roles.join(','))}">
            <div>
                <strong>${escapeHtml(col.name)}</strong>
                <small>${col.nonMissing.toLocaleString()}件 / ユニーク${col.uniqueCount.toLocaleString()}件</small>
            </div>
            <div class="as-option-badges">${roleBadgesHtml(col.roles)}</div>
        </div>
    `).join('');

    varContainer.innerHTML = `
        <div class="multiselect-container" id="support-multiselect">
            <div class="multiselect-input" role="button" tabindex="0" aria-label="変数を選択">
                <span class="placeholder">変数を選択してください...</span>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="multiselect-dropdown">
                <div class="as-search-row">
                    <i class="fas fa-search"></i>
                    <input id="support-variable-search" type="search" placeholder="列名で検索">
                </div>
                <div class="as-option-list">${optionsHtml}</div>
            </div>
        </div>
        <div id="selected-tags" class="as-selected-tags"></div>
    `;
}

function setupInteraction(data, profile) {
    const input = document.querySelector('#support-multiselect .multiselect-input');
    const dropdown = document.querySelector('#support-multiselect .multiselect-dropdown');
    const searchInput = document.getElementById('support-variable-search');
    const tagsContainer = document.getElementById('selected-tags');
    const placeholder = document.querySelector('#support-multiselect .placeholder');

    const closeDropdown = () => dropdown.classList.remove('open');
    const toggleDropdown = () => {
        dropdown.classList.toggle('open');
        if (dropdown.classList.contains('open')) searchInput.focus();
    };

    input.addEventListener('click', e => {
        e.stopPropagation();
        toggleDropdown();
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown();
        }
    });
    dropdown.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeDropdown);

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        document.querySelectorAll('#support-multiselect .multiselect-option').forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(query) ? 'flex' : 'none';
        });
    });

    document.querySelectorAll('#support-multiselect .multiselect-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const column = profile.columnsByName.get(value);
            if (!column) return;

            if (state.selectedVars.some(v => v.name === value)) {
                state.selectedVars = state.selectedVars.filter(v => v.name !== value);
                option.classList.remove('selected');
            } else {
                state.selectedVars.push(column);
                option.classList.add('selected');
            }
            renderTags(tagsContainer, placeholder, profile);
            updateRecommendations(data, profile);
        });
    });

    document.querySelectorAll('.as-purpose').forEach(button => {
        button.addEventListener('click', () => {
            const purpose = button.dataset.purpose;
            if (state.selectedPurposes.has(purpose)) {
                state.selectedPurposes.delete(purpose);
                button.classList.remove('selected');
            } else {
                state.selectedPurposes.add(purpose);
                button.classList.add('selected');
            }
            updateRecommendations(data, profile);
        });
    });
}

function renderTags(tagsContainer, placeholder, profile) {
    tagsContainer.innerHTML = state.selectedVars.map(v => `
        <span class="as-tag">
            ${escapeHtml(v.name)}
            <small>${roleShortLabel(v.roles)}</small>
            <button type="button" class="remove-tag" data-value="${escapeAttribute(v.name)}" aria-label="${escapeAttribute(v.name)}を削除">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');

    tagsContainer.querySelectorAll('.remove-tag').forEach(button => {
        button.addEventListener('click', e => {
            e.stopPropagation();
            const value = button.dataset.value;
            state.selectedVars = state.selectedVars.filter(v => v.name !== value);
            const option = Array.from(document.querySelectorAll('#support-multiselect .multiselect-option')).find(o => o.dataset.value === value);
            if (option) option.classList.remove('selected');
            renderTags(tagsContainer, placeholder, profile);
            updateRecommendations(null, profile);
        });
    });

    placeholder.style.display = state.selectedVars.length > 0 ? 'none' : 'inline';
}

function updateRecommendations(data, profile) {
    const recList = document.getElementById('recommendation-list');
    const recArea = document.getElementById('recommendation-area');
    const summary = document.getElementById('recommendation-summary');
    const recommendations = buildRecommendations(profile);

    recArea.style.display = 'block';
    summary.textContent = state.selectedVars.length === 0
        ? 'データ全体からの初期提案'
        : `${state.selectedVars.length}個の変数から判定`;

    if (recommendations.length === 0) {
        recList.innerHTML = `
            <div class="as-empty">
                <i class="fas fa-circle-info"></i>
                <div>
                    <strong>この組み合わせだけでは候補を絞りきれません。</strong>
                    <p>数値を1つ追加する、カテゴリを1つ追加する、または目的ボタンを選ぶと提案が具体的になります。</p>
                </div>
            </div>
        `;
        return;
    }

    recList.innerHTML = '';
    recommendations.slice(0, 8).forEach(rec => recList.appendChild(createRecItem(rec)));
}

function buildRecommendations(profile) {
    const selected = state.selectedVars;
    const selectedPurposes = Array.from(state.selectedPurposes);
    const selectedSet = selected.length > 0 ? selected : profile.columns;
    const numerics = selectedSet.filter(c => c.roles.includes('numeric'));
    const categoricals = selectedSet.filter(c => c.roles.includes('categorical'));
    const texts = selectedSet.filter(c => c.roles.includes('text'));
    const dates = selectedSet.filter(c => c.roles.includes('date'));

    const recs = [];
    const add = (key, score, reason, setup, extra = {}) => {
        const info = ANALYSIS_INFO[key];
        if (!info) return;
        if (selectedPurposes.length > 0 && !info.purpose.some(p => selectedPurposes.includes(p))) {
            score -= 18;
        }
        if (score < 35) return;
        recs.push({ key, score, reason, setup, ...info, ...extra });
    };

    if (profile.readiness.needsCleaning) {
        add('data_processing', 95, '欠損値や型の確認が必要な列があります。', '欠損処理、逆転処理、標準化、計算列の作成を先に行えます。', { badge: 'まず確認' });
    }

    if (selected.length === 0) {
        if (profile.counts.numeric >= 1) add('eda', 92, '数値列があるため、まず分布と外れ値を確認できます。', '気になる数値列を選び、平均・分布・外れ値を見ます。', { badge: '最初におすすめ' });
        if (profile.counts.categorical >= 2) add('cross_tabulation', 82, 'カテゴリ列が複数あるため、人数と割合の内訳を確認できます。', '行に1つ、列に1つカテゴリ変数を選びます。');
        if (profile.counts.numeric >= 2) add('correlation', 80, '数値列が複数あるため、関係性の探索ができます。', '2つ以上の数値列を選び、散布図と相関係数を確認します。');
        if (profile.counts.numeric >= 3) {
            add('regression_multiple', 74, '数値列が3つ以上あるため、予測モデルを作れます。', '目的変数を1つ、説明変数を複数選びます。');
            add('pca', 70, '数値列が多いため、総合指標への要約を検討できます。', 'まとめたい数値列を3つ以上選びます。');
            add('factor_analysis', 68, 'アンケート項目のような数値列が多い場合、因子構造を探索できます。', '同じ尺度の項目を3つ以上選びます。');
        }
        if (profile.counts.text >= 1) add('text_mining', 78, 'テキスト列があるため、自由記述の傾向を確認できます。', '文章が入った列を選びます。');
        if (profile.counts.date >= 1 && profile.counts.numeric >= 1) add('time_series', 76, '日付候補と数値列があるため、時間変化を確認できます。', '時間順に並べた数値列を選びます。');
        add('data_merge', 58, '別ファイルの事前・事後データがある場合は、先に結合できます。', '共通IDをキーにして2つのファイルを横に結合します。');
        return rankRecommendations(recs);
    }

    if (texts.length > 0) {
        add('text_mining', 94, 'テキスト列が選ばれています。', `${texts.map(c => c.name).join('、')} を文章列として選びます。`, { badge: 'テキスト' });
    }

    if (numerics.length >= 1) {
        add('eda', numerics.length === 1 ? 90 : 72, '数値列が選ばれているため、分布・欠損・外れ値の確認ができます。', `${numerics.map(c => c.name).join('、')} を確認します。`);
    }

    if (numerics.length === 1 && categoricals.length === 0) {
        add('time_series', dates.length > 0 ? 84 : 67, '1つの数値列の推移や並び順の変化を確認できます。', '時系列なら、日付順に並べた上で数値列を選びます。');
        add('ttest', 60, '1標本t検定として、基準値との差を確認できます。', '比較したい基準値を入力します。');
    }

    if (numerics.length === 2 && categoricals.length === 0) {
        add('correlation', 94, '2つの数値列が選ばれています。関係の強さを見る基本形です。', `${numerics[0].name} と ${numerics[1].name} を選びます。`, { badge: '最有力' });
        add('regression_simple', 90, '一方の数値からもう一方の数値を予測できます。', '説明・予測に使う側をX、結果・予測したい側をYにします。回帰だけでは因果関係を判断できません。');
        add('ttest', 78, '同じ対象の事前・事後なら、対応のあるt検定が使えます。', '事前列と事後列の2列を選びます。');
        add('wilcoxon_signed_rank', 76, '対応のある2列で差の分布が偏る場合に使えます。', '事前列と事後列を選びます。');
    }

    if (numerics.length >= 3 && categoricals.length === 0) {
        add('correlation', 88, '複数の数値列の関係を相関行列で確認できます。', '関係を見たい数値列をまとめて選びます。');
        add('regression_multiple', 90, '複数の数値から結果を予測できます。', '目的変数を1つ、説明変数を2つ以上選びます。', { badge: '予測向き' });
        add('pca', 84, '多くの数値列を少数の総合指標にまとめられます。', '同じ方向で測られた数値列を3つ以上選びます。');
        add('factor_analysis', 82, '質問項目の背後にある共通因子を探せます。', '同じ尺度のアンケート項目を3つ以上選びます。');
        add('factor_score', 72, '複数項目を合計点・平均点として得点化できます。', '逆転項目を確認してから、尺度に含める項目を選びます。');
    }

    if (numerics.length >= 1 && categoricals.length === 1) {
        const cat = categoricals[0];
        if (cat.uniqueCount === 2) {
            add('ttest', 92, `カテゴリ変数「${cat.name}」が2群です。`, `${numerics[0].name} を数値、${cat.name} をグループとして選びます。`, { badge: '2群比較' });
            add('mann_whitney', 84, '2群比較で、外れ値や偏りが気になる場合の候補です。', `${numerics[0].name} と ${cat.name} を選びます。`);
            add('logistic_regression', 74, '2値カテゴリを結果として、数値から確率を予測できます。', `${cat.name} を目的変数、数値列を説明変数にします。`);
        } else if (cat.uniqueCount >= 3) {
            add('anova_one_way', 92, `カテゴリ変数「${cat.name}」が${cat.uniqueCount}群です。`, `${numerics[0].name} を数値、${cat.name} をグループとして選びます。`, { badge: '3群以上' });
            add('kruskal_wallis', 84, '3群以上で、外れ値や偏りが気になる場合の候補です。', `${numerics[0].name} と ${cat.name} を選びます。`);
        }
    }

    if (numerics.length >= 1 && categoricals.length >= 2) {
        add('anova_two_way', 90, '数値1つとカテゴリ2つ以上が選ばれており、交互作用を検討できます。', '数値を従属変数、2つのカテゴリを要因として選びます。', { badge: '交互作用' });
        add('cross_tabulation', 70, 'カテゴリ同士の人数バランスを確認できます。', '2つのカテゴリ変数でクロス集計します。');
        const binaryCat = categoricals.find(c => c.uniqueCount === 2);
        if (binaryCat && numerics.length >= 1) {
            add('logistic_regression', 78, `2値カテゴリ「${binaryCat.name}」を予測対象にできます。`, `${binaryCat.name} を目的変数、数値列を説明変数にします。`);
        }
    }

    if (categoricals.length >= 2 && numerics.length === 0) {
        add('cross_tabulation', 92, 'カテゴリ変数が2つ以上選ばれています。まず人数と割合を見ます。', `${categoricals[0].name} と ${categoricals[1].name} を選びます。`, { badge: '基本' });
        add('chi_square', 88, 'カテゴリ同士の関連を検定できます。', '2つのカテゴリ変数で検定します。');
        add('fisher_exact', hasSmallGroups(categoricals) ? 86 : 74, '人数が少ないカテゴリがある場合に有効です。', '2x2表や小標本の表で使います。');
        add('mcnemar', 72, '同じ人の事前・事後の2値カテゴリなら使えます。', '事前カテゴリ列と事後カテゴリ列を選びます。');
    }

    return rankRecommendations(recs);
}

function rankRecommendations(recs) {
    const unique = new Map();
    recs.forEach(rec => {
        const existing = unique.get(rec.key);
        if (!existing || rec.score > existing.score) unique.set(rec.key, rec);
    });
    return Array.from(unique.values()).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ja'));
}

function createRecItem(rec) {
    const item = document.createElement('article');
    item.className = 'rec-item';
    item.dataset.analysis = rec.key;
    item.innerHTML = `
        <div class="as-rec-icon"><i class="fas ${rec.icon}"></i></div>
        <div class="as-rec-body">
            <div class="as-rec-head">
                <div>
                    <h5>${escapeHtml(rec.title)}</h5>
                    <p>${escapeHtml(rec.description)}</p>
                </div>
                <span class="as-fit">${rec.badge ? escapeHtml(rec.badge) : `適合度 ${Math.round(rec.score)}`}</span>
            </div>
            <div class="as-rec-reason"><i class="fas fa-circle-check"></i> ${escapeHtml(rec.reason)}</div>
            <dl class="as-rec-details">
                <div><dt>実行時</dt><dd>${escapeHtml(rec.setup)}</dd></div>
                <div><dt>結果</dt><dd>${escapeHtml(rec.resultFocus)}</dd></div>
                <div><dt>注意</dt><dd>${escapeHtml(rec.caution)}</dd></div>
            </dl>
            <button type="button" class="as-run-button">この分析を開く <i class="fas fa-arrow-right"></i></button>
        </div>
    `;

    item.addEventListener('click', () => openAnalysis(rec.key));
    return item;
}

function openAnalysis(analysisKey) {
    const card = document.querySelector(`.feature-card[data-analysis="${analysisKey}"]`);
    if (card) {
        card.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showError(`分析モジュール (${analysisKey}) が見つかりませんでした。`);
    }
}

function buildDataProfile(data, characteristics) {
    const rows = Array.isArray(data) ? data : [];
    const columns = Object.keys(rows[0] || {});
    const numericSet = new Set(characteristics?.numericColumns || []);
    const categoricalSet = new Set(characteristics?.categoricalColumns || []);
    const textSet = new Set(characteristics?.textColumns || []);

    const columnProfiles = columns.map(name => {
        const values = rows.map(row => row[name]);
        const present = values.filter(v => v != null && String(v).trim() !== '');
        const uniqueValues = Array.from(new Set(present.map(v => String(v))));
        const roles = [];
        if (numericSet.has(name)) roles.push('numeric');
        if (categoricalSet.has(name)) roles.push('categorical');
        if (textSet.has(name)) roles.push('text');
        if (looksLikeDateColumn(present)) roles.push('date');
        if (roles.length === 0) roles.push('text');

        return {
            name,
            roles,
            nonMissing: present.length,
            missing: values.length - present.length,
            uniqueCount: uniqueValues.length,
            uniqueValues: uniqueValues.slice(0, 8),
            isPotentialId: present.length > 0 && uniqueValues.length / present.length > 0.9
        };
    });

    const missingCells = columnProfiles.reduce((sum, col) => sum + col.missing, 0);
    const totalCells = Math.max(rows.length * Math.max(columns.length, 1), 1);
    const counts = {
        numeric: columnProfiles.filter(c => c.roles.includes('numeric')).length,
        categorical: columnProfiles.filter(c => c.roles.includes('categorical')).length,
        text: columnProfiles.filter(c => c.roles.includes('text')).length,
        date: columnProfiles.filter(c => c.roles.includes('date')).length
    };

    const notes = [];
    if (missingCells > 0) notes.push(`欠損セルが${missingCells.toLocaleString()}件あります。分析前に欠損処理の方針を確認してください。`);
    const codedCats = columnProfiles.filter(c => c.roles.includes('numeric') && c.roles.includes('categorical'));
    if (codedCats.length > 0) notes.push(`数値にもカテゴリにも見える列があります: ${codedCats.map(c => c.name).slice(0, 4).join('、')}。性別コードや学年コードならカテゴリとして扱います。`);
    const ids = columnProfiles.filter(c => c.isPotentialId && !c.roles.includes('text'));
    if (ids.length > 0) notes.push(`IDのように値がほぼ全員で異なる列があります: ${ids.map(c => c.name).slice(0, 3).join('、')}。分析対象ではなく識別用の可能性があります。`);

    const missingPenalty = Math.min(35, Math.round((missingCells / totalCells) * 100));
    const lowInfoPenalty = columns.length === 0 ? 40 : 0;
    const score = Math.max(30, 100 - missingPenalty - lowInfoPenalty);
    const readiness = {
        score,
        label: score >= 90 ? 'すぐ分析できます' : score >= 75 ? '一部確認が必要' : '先に整形がおすすめ',
        needsCleaning: missingCells > 0 || codedCats.length > 0
    };

    return {
        rowCount: rows.length,
        columnCount: columns.length,
        columns: columnProfiles,
        columnsByName: new Map(columnProfiles.map(c => [c.name, c])),
        counts,
        missingCells,
        notes,
        readiness
    };
}

function renderDataNotes(profile) {
    const notes = document.getElementById('support-data-notes');
    if (!notes) return;
    if (profile.notes.length === 0) {
        notes.innerHTML = `<div class="as-note good"><i class="fas fa-circle-check"></i> データ型と欠損の大きな問題は見つかっていません。まずEDAで全体像を確認しましょう。</div>`;
        return;
    }
    notes.innerHTML = profile.notes.map(note => `<div class="as-note"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(note)}</div>`).join('');
}

function looksLikeDateColumn(values) {
    if (values.length < 3) return false;
    const sample = values.slice(0, 20);
    const validDates = sample.filter(v => {
        if (v instanceof Date && !isNaN(v.getTime())) return true;
        if (typeof v !== 'string' && typeof v !== 'number') return false;
        const s = String(v).trim();
        if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) return true;
        if (/^\d{4}[-/]\d{1,2}$/.test(s)) return true;
        return !Number.isNaN(Date.parse(s)) && /[-/年月日]/.test(s);
    }).length;
    return validDates / sample.length >= 0.7;
}

function hasSmallGroups(columns) {
    return columns.some(col => col.uniqueCount > 0 && col.nonMissing / col.uniqueCount < 8);
}

function metricHtml(label, value, icon) {
    return `
        <div class="as-metric">
            <i class="fas ${icon}"></i>
            <strong>${Number(value).toLocaleString()}</strong>
            <span>${label}</span>
        </div>
    `;
}

function roleBadgesHtml(roles) {
    return roles.map(role => {
        const config = TYPE_LABELS[role] || TYPE_LABELS.text;
        return `<span class="as-type-badge ${config.className}"><i class="fas ${config.icon}"></i>${config.text}</span>`;
    }).join('');
}

function roleShortLabel(roles) {
    return roles.map(role => TYPE_LABELS[role]?.text || role).join('/');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function supportStyles() {
    return `
        .analysis-support-shell {
            display: grid;
            gap: 1rem;
            color: #1e293b;
        }
        .as-hero, .as-panel {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .as-hero {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 180px;
            gap: 1.25rem;
            padding: 1.5rem;
            align-items: center;
            border-top: 4px solid #2563eb;
        }
        .as-eyebrow {
            color: #2563eb;
            font-weight: 700;
            margin: 0 0 0.35rem 0;
            font-size: 0.85rem;
        }
        .as-hero h3 {
            margin: 0 0 0.45rem 0;
            font-size: 1.65rem;
            color: #0f172a;
        }
        .as-hero p {
            margin: 0;
            color: #475569;
        }
        .as-score-card {
            border: 1px solid #bfdbfe;
            background: #eff6ff;
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
        }
        .as-score-card span, .as-score-card em {
            display: block;
            color: #1e40af;
            font-style: normal;
            font-size: 0.85rem;
        }
        .as-score-card strong {
            display: block;
            color: #1d4ed8;
            font-size: 2.1rem;
            line-height: 1.1;
        }
        .as-score-card small {
            font-size: 0.9rem;
        }
        .as-panel {
            padding: 1.25rem;
        }
        .as-panel-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .as-panel-title h4 {
            margin: 0;
            color: #0f172a;
            font-size: 1.08rem;
        }
        .as-panel-title span {
            color: #64748b;
            font-size: 0.85rem;
        }
        .as-metrics {
            display: grid;
            grid-template-columns: repeat(5, minmax(110px, 1fr));
            gap: 0.75rem;
        }
        .as-metric {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 8px;
            padding: 0.8rem;
        }
        .as-metric i {
            color: #2563eb;
            margin-right: 0.35rem;
        }
        .as-metric strong {
            display: block;
            font-size: 1.35rem;
            color: #0f172a;
        }
        .as-metric span {
            color: #64748b;
            font-size: 0.82rem;
        }
        .as-notes {
            display: grid;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .as-note {
            border-left: 4px solid #f59e0b;
            background: #fffbeb;
            color: #92400e;
            padding: 0.75rem 1rem;
            border-radius: 0 8px 8px 0;
            font-size: 0.92rem;
        }
        .as-note.good {
            border-left-color: #22c55e;
            background: #f0fdf4;
            color: #166534;
        }
        .as-purpose-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.6rem;
        }
        .as-purpose {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #334155;
            padding: 0.75rem 0.85rem;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-weight: 700;
        }
        .as-purpose:hover, .as-purpose.selected {
            border-color: #2563eb;
            background: #eff6ff;
            color: #1d4ed8;
        }
        #support-multiselect {
            position: relative;
        }
        .multiselect-input {
            min-height: 46px;
            padding: 0.75rem 0.85rem;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #475569;
        }
        .multiselect-dropdown {
            display: none;
            position: absolute;
            z-index: 20;
            top: calc(100% + 0.35rem);
            left: 0;
            right: 0;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
            overflow: hidden;
        }
        .multiselect-dropdown.open {
            display: block;
        }
        .as-search-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-bottom: 1px solid #e2e8f0;
            padding: 0.65rem 0.85rem;
            color: #64748b;
        }
        .as-search-row input {
            width: 100%;
            border: 0;
            outline: none;
            font-size: 0.95rem;
        }
        .as-option-list {
            max-height: 280px;
            overflow-y: auto;
        }
        .multiselect-option {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.75rem 0.9rem;
            cursor: pointer;
            border-bottom: 1px solid #f1f5f9;
        }
        .multiselect-option:hover, .multiselect-option.selected {
            background: #eff6ff;
        }
        .multiselect-option small {
            display: block;
            color: #64748b;
            font-size: 0.78rem;
            margin-top: 0.1rem;
        }
        .as-option-badges, .as-selected-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }
        .as-type-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 0.15rem 0.5rem;
            font-size: 0.76rem;
            font-weight: 700;
            white-space: nowrap;
        }
        .as-badge-num { background: #e0f2fe; color: #075985; border-color: #bae6fd; }
        .as-badge-cat { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .as-badge-text { background: #fef3c7; color: #92400e; border-color: #fde68a; }
        .as-badge-date { background: #fce7f3; color: #9d174d; border-color: #fbcfe8; }
        .as-selected-tags {
            margin-top: 0.75rem;
        }
        .as-tag {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            background: #f1f5f9;
            color: #1e293b;
            border: 1px solid #cbd5e1;
            border-radius: 999px;
            padding: 0.35rem 0.5rem 0.35rem 0.75rem;
            font-size: 0.9rem;
            font-weight: 700;
        }
        .as-tag small {
            color: #64748b;
            font-weight: 600;
        }
        .remove-tag {
            border: 0;
            background: transparent;
            color: #64748b;
            cursor: pointer;
            padding: 0.1rem 0.25rem;
        }
        .as-rec-list {
            display: grid;
            gap: 0.85rem;
        }
        .rec-item {
            display: grid;
            grid-template-columns: 46px minmax(0, 1fr);
            gap: 0.85rem;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #ffffff;
            padding: 1rem;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .rec-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
            border-color: #93c5fd;
        }
        .as-rec-icon {
            width: 46px;
            height: 46px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            background: #eff6ff;
            color: #2563eb;
        }
        .as-rec-head {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            align-items: flex-start;
        }
        .as-rec-head h5 {
            margin: 0 0 0.2rem 0;
            color: #0f172a;
            font-size: 1.05rem;
        }
        .as-rec-head p {
            margin: 0;
            color: #475569;
            font-size: 0.92rem;
        }
        .as-fit {
            flex: 0 0 auto;
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
            border-radius: 999px;
            padding: 0.25rem 0.55rem;
            font-size: 0.78rem;
            font-weight: 700;
        }
        .as-rec-reason {
            margin: 0.65rem 0;
            color: #1d4ed8;
            background: #eff6ff;
            border-radius: 8px;
            padding: 0.5rem 0.65rem;
            font-size: 0.9rem;
        }
        .as-rec-details {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.6rem;
            margin: 0;
        }
        .as-rec-details div {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 0.65rem;
        }
        .as-rec-details dt {
            color: #334155;
            font-weight: 700;
            font-size: 0.8rem;
            margin-bottom: 0.2rem;
        }
        .as-rec-details dd {
            margin: 0;
            color: #475569;
            font-size: 0.84rem;
        }
        .as-run-button {
            margin-top: 0.75rem;
            border: 1px solid #2563eb;
            background: #2563eb;
            color: #ffffff;
            border-radius: 8px;
            padding: 0.55rem 0.85rem;
            cursor: pointer;
            font-weight: 700;
        }
        .as-empty {
            display: flex;
            gap: 0.75rem;
            align-items: flex-start;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem;
            color: #475569;
        }
        .as-empty p {
            margin: 0.25rem 0 0 0;
        }
        @media (max-width: 860px) {
            .as-hero {
                grid-template-columns: 1fr;
            }
            .as-metrics {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .as-rec-head, .as-panel-title {
                flex-direction: column;
                align-items: flex-start;
            }
            .as-rec-details {
                grid-template-columns: 1fr;
            }
            .rec-item {
                grid-template-columns: 1fr;
            }
            .multiselect-option {
                flex-direction: column;
            }
        }
    `;
}
