import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const imageDir = join(root, 'image');
const baseDir = join(root, '.tmp_explainer_bases');

const analyses = [
    {
        key: 'analysis_support',
        title: '分析サポーター',
        subtitle: '目的と変数の型から、使う分析を選ぶ',
        accent: '#7c3aed',
        tags: ['目的', '変数の型', 'おすすめ', '次に実行'],
        bullets: ['迷った時の入口', '分析候補を比較', '前提条件を確認']
    },
    {
        key: 'data_processing',
        title: 'データ加工・整形',
        subtitle: '分析前にデータをきれいに整える',
        accent: '#2563eb',
        tags: ['欠損', '表記ゆれ', '外れ値', '新しい変数'],
        bullets: ['値の意味を保つ', '処理前後を比較', 'ルールを記録']
    },
    {
        key: 'data_merge',
        title: 'データ結合',
        subtitle: '共通IDで2つの表を1つにまとめる',
        accent: '#0f766e',
        tags: ['ファイルA', '共通ID', 'ファイルB', '結合後'],
        bullets: ['重複キーを確認', '未結合行を確認', '行数の変化を見る']
    },
    {
        key: 'factor_score',
        title: '因子得点算出',
        subtitle: '複数の質問項目を尺度得点にまとめる',
        accent: '#d97706',
        tags: ['質問項目', '逆転項目', '合計点', '平均点'],
        bullets: ['尺度ごとに集計', '欠損を確認', '分布を可視化']
    },
    {
        key: 'eda',
        title: '探索的データ分析',
        subtitle: '分布・外れ値・欠損から全体像を見る',
        accent: '#0284c7',
        tags: ['平均', '分布', '外れ値', '欠損'],
        bullets: ['最初にデータの顔を見る', '次の分析を決める', 'グラフで傾向確認']
    },
    {
        key: 'cross_tabulation',
        title: 'クロス集計',
        subtitle: '2つのカテゴリの内訳と割合を比べる',
        accent: '#0891b2',
        tags: ['度数', '行％', '列％', '偏り'],
        bullets: ['人数の内訳を確認', '母数を意識する', '検定前の整理に使う']
    },
    {
        key: 'correlation',
        title: '相関分析',
        subtitle: '2つの数値が一緒に増減するかを見る',
        accent: '#16a34a',
        tags: ['散布図', '相関係数', '向き', '強さ'],
        bullets: ['直線的な関係を見る', '外れ値に注意', '因果は断定しない']
    },
    {
        key: 'ttest',
        title: 't検定',
        subtitle: '2つの平均に違いがあるか調べる',
        accent: '#ea580c',
        tags: ['2群', '平均差', 't値', 'p値'],
        bullets: ['平均とSDを確認', '効果量も見る', 'Welch検定を基本に']
    },
    {
        key: 'anova_one_way',
        title: '一要因分散分析',
        subtitle: '3つ以上の平均をまとめて比較する',
        accent: '#dc2626',
        tags: ['3群以上', 'F値', '主効果', '多重比較'],
        bullets: ['まず全体差を見る', '有意なら事後比較', '効果量を確認']
    },
    {
        key: 'anova_two_way',
        title: '二要因分散分析',
        subtitle: '2つの要因と交互作用を調べる',
        accent: '#e11d48',
        tags: ['要因A', '要因B', '主効果', '交互作用'],
        bullets: ['線の交差に注目', '単純主効果を確認', '組み合わせで解釈']
    },
    {
        key: 'mann_whitney',
        title: 'マン・ホイットニーU検定',
        subtitle: '2つの独立群を順位で比べる',
        accent: '#16a34a',
        tags: ['2群', '順位', 'U値', '効果量'],
        bullets: ['平均ではなく順位', '分布の違いを見る', '少人数にも使いやすい']
    },
    {
        key: 'kruskal_wallis',
        title: 'クラスカル・ウォリス検定',
        subtitle: '3群以上を順位で比較する',
        accent: '#0d9488',
        tags: ['3群以上', '順位', 'H値', '事後比較'],
        bullets: ['ANOVAの順位版', '正規性を仮定しない', '有意なら群間比較']
    },
    {
        key: 'wilcoxon_signed_rank',
        title: 'ウィルコクソン符号付順位検定',
        subtitle: '同じ人の事前・事後の変化を順位で見る',
        accent: '#0891b2',
        tags: ['対応あり', '差分', '符号', '順位'],
        bullets: ['ペアの変化を確認', '差の方向を見る', '正規性を仮定しない']
    },
    {
        key: 'mcnemar',
        title: 'マクネマー検定',
        subtitle: '対応のあるカテゴリの変化を調べる',
        accent: '#dc2626',
        tags: ['事前', '事後', '不一致セル', '変化方向'],
        bullets: ['同じ人の変化を見る', '2値カテゴリに使う', '不一致セルが重要']
    },
    {
        key: 'chi_square',
        title: 'カイ二乗検定',
        subtitle: '2つのカテゴリに関連があるか調べる',
        accent: '#9333ea',
        tags: ['クロス表', '期待度数', 'χ²', '残差'],
        bullets: ['期待度数を確認', '偏りのセルを見る', '関連は因果ではない']
    },
    {
        key: 'fisher_exact',
        title: 'フィッシャー正確検定',
        subtitle: '少人数の2×2表を正確に検定する',
        accent: '#7c3aed',
        tags: ['2×2表', '小標本', 'p値', 'オッズ比'],
        bullets: ['期待度数が小さい時', '正確な確率を計算', 'セル度数も報告']
    },
    {
        key: 'regression_simple',
        title: '単回帰分析',
        subtitle: '1つの要因から結果を予測する',
        accent: '#2563eb',
        tags: ['説明変数', '目的変数', '回帰直線', 'R²'],
        bullets: ['係数の向きを見る', '残差を確認', '予測式を作る']
    },
    {
        key: 'regression_multiple',
        title: '重回帰分析',
        subtitle: '複数の要因から結果を予測する',
        accent: '#d97706',
        tags: ['複数要因', '係数', 'VIF', 'R²'],
        bullets: ['独自の影響を比較', '共線性に注意', '標準化係数も確認']
    },
    {
        key: 'logistic_regression',
        title: 'ロジスティック回帰',
        subtitle: '起こる・起こらないの確率を予測する',
        accent: '#e11d48',
        tags: ['2値結果', '確率', 'オッズ比', '分類'],
        bullets: ['オッズ比で解釈', '混同行列を確認', 'イベント数に注意']
    },
    {
        key: 'factor_analysis',
        title: '因子分析',
        subtitle: '質問項目の背後にある共通テーマを探す',
        accent: '#7c3aed',
        tags: ['因子', '負荷量', '回転', '因子名'],
        bullets: ['項目のまとまりを見る', '因子数を検討', '信頼性も確認']
    },
    {
        key: 'pca',
        title: '主成分分析',
        subtitle: '多くの変数を少数の総合指標へ圧縮する',
        accent: '#0891b2',
        tags: ['主成分', '寄与率', '負荷量', 'スコア'],
        bullets: ['情報を要約する', '新しい軸を解釈', '因子分析とは別物']
    },
    {
        key: 'time_series',
        title: '時系列データ分析',
        subtitle: '時間に沿った傾向・周期・変化を見る',
        accent: '#0284c7',
        tags: ['時間順', 'トレンド', '周期', '異常値'],
        bullets: ['順番を崩さない', '変化点を確認', '自己相関を見る']
    },
    {
        key: 'text_mining',
        title: 'テキストマイニング',
        subtitle: '自由記述から頻出語と共起を見つける',
        accent: '#16a34a',
        tags: ['頻出語', '共起', '文脈', 'カテゴリ差'],
        bullets: ['言葉の傾向を見る', '文脈も確認', '代表例と合わせる']
    }
];

function pageHtml(item, baseUrl) {
    const tags = item.tags.map(tag => `<span>${tag}</span>`).join('');
    const bullets = item.bullets.map(text => `<li>${text}</li>`).join('');
    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
    * { box-sizing: border-box; }
    body {
        margin: 0;
        width: 1200px;
        height: 675px;
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
        background: #f8fafc;
    }
    .canvas {
        position: relative;
        width: 1200px;
        height: 675px;
        overflow: hidden;
        background: #f8fafc;
    }
    .base {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: saturate(0.95) contrast(0.93) brightness(1.04);
    }
    .veil {
        position: absolute;
        inset: 0;
        background:
            linear-gradient(90deg, rgba(248,250,252,0.98) 0%, rgba(248,250,252,0.88) 42%, rgba(248,250,252,0.18) 78%, rgba(248,250,252,0.06) 100%),
            linear-gradient(0deg, rgba(15,23,42,0.10), rgba(15,23,42,0.02) 45%, rgba(255,255,255,0.10));
    }
    .panel {
        position: absolute;
        left: 54px;
        top: 54px;
        width: 520px;
        min-height: 567px;
        padding: 38px 38px 32px;
        border-radius: 26px;
        background: rgba(255,255,255,0.94);
        border: 1px solid rgba(203,213,225,0.92);
        box-shadow: 0 24px 54px rgba(15,23,42,0.18);
    }
    .bar {
        width: 86px;
        height: 9px;
        border-radius: 999px;
        background: ${item.accent};
        margin-bottom: 24px;
    }
    h1 {
        margin: 0 0 16px;
        color: #0f172a;
        font-size: 48px;
        font-weight: 800;
        line-height: 1.08;
        letter-spacing: 0;
    }
    .subtitle {
        margin: 0 0 28px;
        color: #334155;
        font-size: 27px;
        font-weight: 700;
        line-height: 1.36;
    }
    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 30px;
    }
    .tags span {
        display: inline-flex;
        align-items: center;
        min-height: 42px;
        padding: 7px 15px 8px;
        border-radius: 999px;
        color: ${item.accent};
        border: 2px solid color-mix(in srgb, ${item.accent} 35%, white);
        background: color-mix(in srgb, ${item.accent} 10%, white);
        font-size: 20px;
        font-weight: 800;
        white-space: nowrap;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 14px;
    }
    li {
        position: relative;
        padding-left: 32px;
        color: #1e293b;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.32;
    }
    li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 12px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${item.accent};
        box-shadow: 0 0 0 6px color-mix(in srgb, ${item.accent} 14%, transparent);
    }
    .diagram {
        position: absolute;
        right: 54px;
        top: 92px;
        width: 490px;
        min-height: 420px;
        padding: 30px 30px 28px;
        border-radius: 26px;
        background: rgba(255,255,255,0.90);
        border: 1px solid rgba(203,213,225,0.88);
        box-shadow: 0 24px 54px rgba(15,23,42,0.16);
    }
    .diagram h2 {
        margin: 0 0 16px;
        color: #0f172a;
        font-size: 30px;
        font-weight: 850;
        letter-spacing: 0;
    }
    .steps {
        display: grid;
        gap: 10px;
    }
    .step {
        display: grid;
        grid-template-columns: 52px 1fr;
        align-items: center;
        gap: 12px;
        min-height: 52px;
    }
    .step-mark {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: white;
        background: ${item.accent};
        font-size: 25px;
        font-weight: 900;
        box-shadow: 0 10px 20px color-mix(in srgb, ${item.accent} 28%, transparent);
    }
    .step-text {
        min-height: 52px;
        display: flex;
        align-items: center;
        padding: 10px 16px;
        border-radius: 18px;
        color: #1e293b;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.22;
    }
    .connector {
        width: 4px;
        height: 8px;
        margin-left: 24px;
        border-radius: 999px;
        background: color-mix(in srgb, ${item.accent} 60%, #cbd5e1);
    }
    .mini-chart {
        position: relative;
        height: 70px;
        margin-top: 18px;
        border-radius: 20px;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        border: 1px solid #e2e8f0;
        overflow: hidden;
    }
    .mini-chart::before {
        content: "";
        position: absolute;
        left: 26px;
        right: 26px;
        bottom: 18px;
        height: 3px;
        border-radius: 999px;
        background: #cbd5e1;
    }
    .bar-mini {
        position: absolute;
        bottom: 21px;
        width: 34px;
        border-radius: 9px 9px 0 0;
        background: ${item.accent};
        opacity: 0.82;
    }
    .bar-mini:nth-child(1) { left: 58px; height: 22px; opacity: 0.46; }
    .bar-mini:nth-child(2) { left: 124px; height: 34px; opacity: 0.62; }
    .bar-mini:nth-child(3) { left: 190px; height: 48px; opacity: 0.86; }
    .bar-mini:nth-child(4) { left: 256px; height: 30px; opacity: 0.68; }
    .bar-mini:nth-child(5) { left: 322px; height: 40px; opacity: 0.78; }
    .chart-line {
        position: absolute;
        left: 49px;
        right: 54px;
        top: 24px;
        height: 4px;
        border-radius: 999px;
        background: #0f172a;
        transform: rotate(-8deg);
        transform-origin: left center;
        opacity: 0.74;
    }
</style>
</head>
<body>
    <main class="canvas">
        <img class="base" src="${baseUrl}" alt="">
        <div class="veil"></div>
        <section class="panel">
            <div class="bar"></div>
            <h1>${item.title}</h1>
            <p class="subtitle">${item.subtitle}</p>
            <div class="tags">${tags}</div>
            <ul>${bullets}</ul>
        </section>
        <section class="diagram">
            <h2>見るポイント</h2>
            <div class="steps">
                ${item.tags.map((tag, index) => `
                    <div class="step">
                        <div class="step-mark">${index + 1}</div>
                        <div class="step-text">${tag}</div>
                    </div>
                    ${index < item.tags.length - 1 ? '<div class="connector"></div>' : ''}
                `).join('')}
            </div>
            <div class="mini-chart">
                <i class="bar-mini"></i><i class="bar-mini"></i><i class="bar-mini"></i><i class="bar-mini"></i><i class="bar-mini"></i>
                <i class="chart-line"></i>
            </div>
        </section>
    </main>
</body>
</html>`;
}

mkdirSync(baseDir, { recursive: true });

for (const item of analyses) {
    const currentPath = join(imageDir, `${item.key}.png`);
    const basePath = join(baseDir, `${item.key}.png`);
    copyFileSync(currentPath, basePath);
}

if (analyses.some(item => item.key === 'wilcoxon_signed_rank')) {
    copyFileSync(join(imageDir, 'wilcoxon.png'), join(baseDir, 'wilcoxon.png'));
}

const browser = await chromium.launch();
try {
    const page = await browser.newPage({
        viewport: { width: 1200, height: 675 },
        deviceScaleFactor: 1
    });

    for (const item of analyses) {
        const baseUrl = pathToFileURL(join(baseDir, `${item.key}.png`)).href;
        await page.setContent(pageHtml(item, baseUrl), { waitUntil: 'networkidle' });
        await page.locator('.canvas').screenshot({
            path: join(imageDir, `${item.key}.png`),
            type: 'png'
        });
    }

    copyFileSync(join(imageDir, 'wilcoxon_signed_rank.png'), join(imageDir, 'wilcoxon.png'));
} finally {
    await browser.close();
    rmSync(baseDir, { recursive: true, force: true });
}
