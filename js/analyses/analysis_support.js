import { createVariableSelector, createAnalysisButton, showError, showLoadingMessage, hideLoadingMessage } from '../utils.js';

export function render(container, data, characteristics) {
    container.innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 1.5rem; color: #2d3748;">
                <i class="fas fa-magic" style="color: #805ad5; margin-right: 0.5rem;"></i>
                分析サポーター（β版）
            </h3>
            <p style="color: #4a5568; margin-bottom: 1.5rem;">
                どの分析手法を選べばよいか迷っていますか？<br>
                関心のある変数を選択してください。データの種類と数に基づいて、最適な統計手法を提案します。
            </p>

            <div class="row">
                <div class="col-md-12" style="margin-bottom: 1rem;">
                    <div id="support-var-container" style="background: #f8fafc; padding: 1rem; border-radius: 8px;"></div>
                </div>
            </div>

            <div id="recommendation-area" style="display: none; margin-top: 1.5rem; padding: 1rem; border: 2px dashed #805ad5; border-radius: 8px; background: #faf5ff;">
                <h4 style="color: #6b46c1; margin-bottom: 1rem;"><i class="fas fa-lightbulb"></i> おすすめの分析手法</h4>
                <div id="recommendation-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
            </div>
        </div>
    `;

    const allColumns = [
        ...characteristics.numericColumns.map(c => ({ label: `[数値] ${c}`, value: c, type: 'numeric' })),
        ...characteristics.categoricalColumns.map(c => ({ label: `[カテゴリ] ${c}`, value: c, type: 'categorical' })),
        ...characteristics.textColumns.map(c => ({ label: `[テキスト] ${c}`, value: c, type: 'text' }))
    ];

    // Create a custom multi-select
    const varContainer = document.getElementById('support-var-container');
    varContainer.innerHTML = `
        <label style="font-weight: bold; color: #2d3748; display: block; margin-bottom: 0.5rem;">
            <i class="fas fa-check-square"></i> 関心のある変数を選択（複数可）:
        </label>
        <div class="multiselect-container" id="support-multiselect" style="position: relative;">
            <div class="multiselect-input" style="padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 0.375rem; background: white; cursor: pointer; min-height: 38px;">
                <span class="placeholder" style="color: #a0aec0;">変数を選択してください...</span>
            </div>
            <div class="multiselect-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e0; border-radius: 0.375rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10; max-height: 200px; overflow-y: auto;">
                ${allColumns.map(col => `
                    <div class="multiselect-option" data-value="${col.value}" data-type="${col.type}" style="padding: 0.5rem 1rem; cursor: pointer; transition: background 0.2s;">
                        ${col.label}
                    </div>
                `).join('')}
            </div>
        </div>
        <div id="selected-tags" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;"></div>
    `;

    setupInteraction(data, characteristics);
}

function setupInteraction(data, characteristics) {
    const input = document.querySelector('#support-multiselect .multiselect-input');
    const dropdown = document.querySelector('#support-multiselect .multiselect-dropdown');
    const options = document.querySelectorAll('#support-multiselect .multiselect-option');
    const tagsContainer = document.getElementById('selected-tags');
    const placeholder = document.querySelector('#support-multiselect .placeholder');

    let selectedVars = [];

    // Toggle Dropdown
    input.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        // Hide other open dropdowns if any (not implemented globally yet, but good practice)
    });

    document.addEventListener('click', () => {
        dropdown.style.display = 'none';
    });

    dropdown.addEventListener('click', e => e.stopPropagation());

    // Option Click
    options.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const type = option.dataset.type;

            if (selectedVars.find(v => v.value === value)) {
                // Deselect
                selectedVars = selectedVars.filter(v => v.value !== value);
                option.classList.remove('selected');
                option.style.background = 'transparent';
                option.style.color = 'inherit';
            } else {
                // Select
                selectedVars.push({ value, type });
                option.classList.add('selected');
                option.style.background = '#ebf8ff';
                option.style.color = '#2b6cb0';
            }

            renderTags();
            updateRecommendations(selectedVars, data, characteristics);
        });

        // Hover effect
        option.addEventListener('mouseenter', () => {
            if (!option.classList.contains('selected')) option.style.background = '#f7fafc';
        });
        option.addEventListener('mouseleave', () => {
            if (!option.classList.contains('selected')) option.style.background = 'transparent';
        });
    });

    function renderTags() {
        tagsContainer.innerHTML = selectedVars.map(v => `
            <span style="background: #e2e8f0; color: #2d3748; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;">
                ${v.value} <i class="fas fa-times remove-tag" data-value="${v.value}" style="cursor: pointer; color: #a0aec0;"></i>
            </span>
        `).join('');

        // Re-attach event listeners for removal
        tagsContainer.querySelectorAll('.remove-tag').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const valToRemove = e.target.dataset.value;
                selectedVars = selectedVars.filter(v => v.value !== valToRemove);

                // Update dropdown visual state
                const opt = Array.from(options).find(o => o.dataset.value === valToRemove);
                if (opt) {
                    opt.classList.remove('selected');
                    opt.style.background = 'transparent';
                    opt.style.color = 'inherit';
                }

                renderTags();
                updateRecommendations(selectedVars, data, characteristics);
            });
        });

        if (selectedVars.length > 0) {
            placeholder.style.display = 'none';
        } else {
            placeholder.style.display = 'block';
        }
    }
}

function updateRecommendations(selectedVars, data, characteristics) {
    const recArea = document.getElementById('recommendation-area');
    const recList = document.getElementById('recommendation-list');

    if (selectedVars.length === 0) {
        recArea.style.display = 'none';
        return;
    }

    recArea.style.display = 'block';

    // Logic Engine
    const numerics = selectedVars.filter(v => v.type === 'numeric');
    const categoricals = selectedVars.filter(v => v.type === 'categorical');
    const texts = selectedVars.filter(v => v.type === 'text');

    let recommendations = [];

    // Rule 1: Text Data
    if (texts.length > 0) {
        recommendations.push(createRecItem('text_mining', 'テキストマイニング', 'テキストデータの頻出語やワードクラウドを作成します。',
            `現在の選択: ${texts.length}個のテキスト変数`));
    }

    // Rule 2: Numeric EDA (Independent)
    if (numerics.length === 1) {
        recommendations.push(createRecItem('eda', '探索的データ分析 (EDA)', 'ヒストグラムや箱ひげ図でデータの分布を確認します。', '数値変数が選択されています'));
        recommendations.push(createRecItem('time_series', '時系列データ分析', 'データの時間的な推移やトレンドを確認します。', '数値変数が選択されています'));
    }

    // Rule 3: Multiple Numerics
    if (numerics.length === 2 && categoricals.length === 0) {
        recommendations.push(createRecItem('correlation', '相関分析', '2つの変数間の関係性（相関係数）を調べます。', '数値変数が2つ選択されています'));
        recommendations.push(createRecItem('regression_simple', '単回帰分析', '一方の変数からもう一方の変数を予測するモデルを作ります。', '数値変数が2つ選択されています'));
        recommendations.push(createRecItem('ttest', '対応のあるt検定', '2つの変数の差（変化）を検定します。（例：Pre/Post）', '※対応のあるデータの場合に有効です'));
        recommendations.push(createRecItem('wilcoxon_signed_rank', 'ウィルコクソンの符号付順位検定', '対応のある2変数の差（順位）を検定します。', '※正規分布に従わない場合に適しています'));
    }

    if (numerics.length >= 3 && categoricals.length === 0) {
        recommendations.push(createRecItem('correlation', '相関分析 (相関行列)', '多数の変数間の関係を一括で確認します。', '3つ以上の数値変数が選択されています'));
        recommendations.push(createRecItem('regression_multiple', '重回帰分析', '複数の変数でターゲット変数を予測・説明します。', '3つ以上の数値変数が選択されています'));
        recommendations.push(createRecItem('pca', '主成分分析', '変数を合成して、データの次元（特徴）を要約します。', '多変量データの可視化に適しています'));
        recommendations.push(createRecItem('factor_analysis', '因子分析', '背後に潜む共通因子（構成概念）を抽出します。', 'アンケート分析などに適しています'));
    }

    // Rule 4: Numerics + Categoricals
    if (numerics.length === 1 && categoricals.length === 1) {
        const catVar = categoricals[0].value;
        const uniqueCount = getUniqueCount(data, catVar);

        if (uniqueCount === 2) {
            recommendations.push(createRecItem('ttest', 't検定 (独立2群)', '2つのグループ間の平均値の差を検定します。', `カテゴリ変数「${catVar}」は2グループです`));
            recommendations.push(createRecItem('mann_whitney', 'マン・ホイットニーのU検定', '2つのグループ間の分布（順位）の差を検定します。', `正規分布に従わない場合に適しています`));
            recommendations.push(createRecItem('logistic_regression', 'ロジスティック回帰分析', '事象の発生確率（2値カテゴリ）を予測します。', `目的変数が2値の場合に適しています`));
        } else if (uniqueCount >= 3) {
            recommendations.push(createRecItem('anova_one_way', '一要因分散分析', '3つ以上のグループ間の平均値の差を検定します。', `カテゴリ変数「${catVar}」は${uniqueCount}グループです`));
            recommendations.push(createRecItem('kruskal_wallis', 'クラスカル・ウォリス検定', '3つ以上のグループ間の分布（順位）の差を検定します。', `正規分布に従わない場合に適しています`));
        }
    }

    if (numerics.length === 1 && categoricals.length === 2) {
        recommendations.push(createRecItem('anova_two_way', '二要因分散分析', '2つの要因（カテゴリ）が数値に与える影響と、交互作用を分析します。', '2つのカテゴリ変数と1つの数値変数が選択されています'));
    }

    // Rule 5: Pure Categoricals
    if (categoricals.length >= 2 && numerics.length === 0) {
        recommendations.push(createRecItem('cross_tabulation', 'クロス集計表', 'カテゴリ変数同士の度数分布を表にまとめます。', 'カテゴリ変数の分布確認に基本です'));
        recommendations.push(createRecItem('chi_square', 'カイ二乗検定', '2つのカテゴリ変数に関連（連関）があるかを検定します。', 'クロス集計表の分析に適しています'));
        recommendations.push(createRecItem('fisher_exact', 'フィッシャーの正確確率検定', 'サンプルサイズが小さい（期待度数5未満）場合の関連を検定します。', '小標本データに適しています'));
        recommendations.push(createRecItem('mcnemar', 'マクネマー検定', '対応のある2つのカテゴリ変数の比率の差を検定します。（例:Pre/Post）', '※対応のあるデータの場合に有効です'));
    }

    // Deduplicate recommendations just in case
    const uniqueRecsMap = new Map();
    recommendations.forEach(rec => {
        // Extract analysisKey from the onclick string roughly
        const html = rec.outerHTML;
        uniqueRecsMap.set(html, rec);
    });
    recommendations = Array.from(uniqueRecsMap.values());

    // Fallback
    if (recommendations.length === 0) {
        recList.innerHTML = `<div style="color: #718096;">現在選択されている組み合わせ（数値:${numerics.length}, カテゴリ:${categoricals.length}, テキスト:${texts.length}）に特定の分析手法がマッチしませんでしたが、データ形式を確認してください。</div>`;
    } else {
        recList.innerHTML = '';
        recommendations.forEach(elem => recList.appendChild(elem));
    }
}

function createRecItem(analysisKey, title, description, reason) {
    const item = document.createElement('div');
    item.className = 'rec-item';
    item.style.cssText = `
        background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;
        cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; display: flex; align-items: flex-start; gap: 1rem;
    `;
    item.innerHTML = `
        <div style="background: #e9d8fd; color: #805ad5; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fas fa-arrow-right"></i>
        </div>
        <div>
            <h5 style="margin: 0 0 0.25rem 0; color: #2d3748; font-weight: bold;">${title}</h5>
            <p style="margin: 0 0 0.5rem 0; color: #4a5568; font-size: 0.9rem;">${description}</p>
            <span style="font-size: 0.8rem; color: #718096; background: #edf2f7; padding: 0.1rem 0.5rem; border-radius: 4px;">
                <i class="fas fa-info-circle"></i> ${reason}
            </span>
        </div>
    `;

    item.onmouseenter = () => { item.style.transform = 'translateY(-2px)'; item.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; };
    item.onmouseleave = () => { item.style.transform = 'translateY(0)'; item.style.boxShadow = 'none'; };

    item.onclick = () => {
        // Find the card in the main menu and trigger click
        const card = document.querySelector(`.feature-card[data-analysis="${analysisKey}"]`);
        if (card) {
            card.click();
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showError(`分析モジュール (${analysisKey}) が見つかりませんでした。`);
        }
    };

    return item;
}

function getUniqueCount(data, colName) {
    const values = data.map(d => d[colName]).filter(v => v != null);
    return new Set(values).size;
}
