import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'image';
mkdirSync(outDir, { recursive: true });

const palette = {
    navy: '#17324d',
    blue: '#2563eb',
    sky: '#0ea5e9',
    cyan: '#0891b2',
    green: '#16a34a',
    mint: '#14b8a6',
    amber: '#d97706',
    orange: '#f97316',
    red: '#dc2626',
    rose: '#e11d48',
    violet: '#7c3aed',
    purple: '#9333ea',
    slate: '#475569',
    pale: '#f8fafc',
    line: '#cbd5e1'
};

const analyses = [
    {
        key: 'analysis_support',
        title: '分析サポーター',
        subtitle: '目的とデータ型から、使う分析を選ぶ',
        accent: palette.violet,
        type: 'flow',
        nodes: ['研究の目的', '変数の型', 'おすすめ分析', '次に実行']
    },
    {
        key: 'data_processing',
        title: 'データ加工・整形',
        subtitle: '欠損・表記ゆれ・新しい変数を整える',
        accent: palette.blue,
        type: 'flow',
        nodes: ['元データ', '欠損確認', '再コード化', '分析用データ']
    },
    {
        key: 'data_merge',
        title: 'データ結合',
        subtitle: '共通IDを目印に、2つの表を1つにまとめる',
        accent: palette.mint,
        type: 'merge'
    },
    {
        key: 'factor_score',
        title: '因子得点算出',
        subtitle: '複数項目を合計・平均し、尺度得点にする',
        accent: palette.amber,
        type: 'score'
    },
    {
        key: 'eda',
        title: '探索的データ分析（EDA）',
        subtitle: '分布・外れ値・欠損をまず見る',
        accent: palette.sky,
        type: 'histogram'
    },
    {
        key: 'cross_tabulation',
        title: 'クロス集計',
        subtitle: '2つのカテゴリの内訳を表で比べる',
        accent: palette.cyan,
        type: 'table'
    },
    {
        key: 'correlation',
        title: '相関分析',
        subtitle: '2つの数値が一緒に増減するかを見る',
        accent: palette.green,
        type: 'scatter'
    },
    {
        key: 'ttest',
        title: 't検定',
        subtitle: '2つの平均に違いがあるか調べる',
        accent: palette.orange,
        type: 'twoBars'
    },
    {
        key: 'anova_one_way',
        title: '一要因分散分析（ANOVA）',
        subtitle: '3つ以上の平均をまとめて比較する',
        accent: palette.red,
        type: 'threeBars'
    },
    {
        key: 'anova_two_way',
        title: '二要因分散分析',
        subtitle: '2つの要因と交互作用を調べる',
        accent: palette.rose,
        type: 'interaction'
    },
    {
        key: 'mann_whitney',
        title: 'マン・ホイットニーのU検定',
        subtitle: '2群を順位に置き換えて比べる',
        accent: palette.green,
        type: 'rankTwo'
    },
    {
        key: 'kruskal_wallis',
        title: 'クラスカル・ウォリス検定',
        subtitle: '3群以上を順位で比較する',
        accent: palette.mint,
        type: 'rankThree'
    },
    {
        key: 'wilcoxon',
        title: 'ウィルコクソン符号付順位検定',
        subtitle: '同じ人の事前・事後の変化を順位で見る',
        accent: palette.cyan,
        type: 'paired'
    },
    {
        key: 'mcnemar',
        title: 'マクネマー検定',
        subtitle: '対応のあるカテゴリの変化を見る',
        accent: palette.red,
        type: 'switchTable'
    },
    {
        key: 'chi_square',
        title: 'カイ二乗検定',
        subtitle: 'カテゴリ同士に関連があるか調べる',
        accent: palette.purple,
        type: 'residualTable'
    },
    {
        key: 'fisher_exact',
        title: 'フィッシャーの正確確率検定',
        subtitle: '少人数の2×2表を正確に検定する',
        accent: palette.violet,
        type: 'exactTable'
    },
    {
        key: 'regression_simple',
        title: '単回帰分析',
        subtitle: '1つの要因から結果を予測する',
        accent: palette.blue,
        type: 'lineScatter'
    },
    {
        key: 'regression_multiple',
        title: '重回帰分析',
        subtitle: '複数の要因の独自の影響を見る',
        accent: palette.amber,
        type: 'multiPredictor'
    },
    {
        key: 'logistic_regression',
        title: 'ロジスティック回帰分析',
        subtitle: '合格・不合格などの確率を予測する',
        accent: palette.rose,
        type: 'sigmoid'
    },
    {
        key: 'factor_analysis',
        title: '因子分析',
        subtitle: '多くの質問の背後にある共通テーマを探す',
        accent: palette.violet,
        type: 'latent'
    },
    {
        key: 'pca',
        title: '主成分分析（PCA）',
        subtitle: '多くの変数を少数の総合指標へまとめる',
        accent: palette.cyan,
        type: 'pcaAxes'
    },
    {
        key: 'time_series',
        title: '時系列データ分析',
        subtitle: '時間に沿った傾向・周期・変化を見る',
        accent: palette.sky,
        type: 'timeLine'
    },
    {
        key: 'text_mining',
        title: 'テキストマイニング',
        subtitle: '自由記述から頻出語と共起を見つける',
        accent: palette.green,
        type: 'wordNetwork'
    }
];

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shadow(id) {
    return `
        <filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.12"/>
        </filter>`;
}

function header(a) {
    return `
        <rect width="1200" height="675" rx="34" fill="#f8fafc"/>
        <circle cx="1060" cy="95" r="96" fill="${a.accent}" opacity="0.08"/>
        <circle cx="108" cy="570" r="118" fill="#0ea5e9" opacity="0.07"/>
        <rect x="54" y="54" width="1092" height="567" rx="28" fill="#ffffff" filter="url(#cardShadow)"/>
        <rect x="54" y="54" width="1092" height="10" rx="5" fill="${a.accent}"/>
        <text x="96" y="128" class="title">${esc(a.title)}</text>
        <text x="96" y="174" class="subtitle">${esc(a.subtitle)}</text>`;
}

function panel(x, y, w, h, label, color = '#ffffff') {
    return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" stroke="${palette.line}" stroke-width="2"/>
        <text x="${x + w / 2}" y="${y + 38}" class="panelLabel" text-anchor="middle">${esc(label)}</text>`;
}

function arrow(x1, y1, x2, y2, color) {
    return `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${color}" stroke-width="7" stroke-linecap="round" marker-end="url(#arrow)"/>`;
}

function axes() {
    return `
        <line x1="185" y1="525" x2="1025" y2="525" stroke="#94a3b8" stroke-width="3"/>
        <line x1="185" y1="525" x2="185" y2="260" stroke="#94a3b8" stroke-width="3"/>`;
}

function bars(items, accent, baseY = 525) {
    return items.map((item, i) => {
        const x = 275 + i * 220;
        const h = item.h;
        return `
            <rect x="${x}" y="${baseY - h}" width="118" height="${h}" rx="12" fill="${item.c || accent}" opacity="${item.o || 0.9}"/>
            <line x1="${x - 20}" y1="${baseY - h - 24}" x2="${x + 138}" y2="${baseY - h - 24}" stroke="#334155" stroke-width="4"/>
            <text x="${x + 59}" y="${baseY + 42}" class="axisLabel" text-anchor="middle">${esc(item.label)}</text>`;
    }).join('');
}

function draw(type, a) {
    switch (type) {
        case 'flow':
            return `
                ${a.nodes.map((node, i) => panel(110 + i * 260, 305, 195, 135, node, i === 2 ? '#eff6ff' : '#ffffff')).join('')}
                ${[0, 1, 2].map(i => arrow(305 + i * 260, 372, 360 + i * 260, 372, a.accent)).join('')}
                <text x="600" y="548" class="note" text-anchor="middle">迷ったら、目的 → 変数 → 分析手法の順に確認</text>`;
        case 'merge':
            return `
                ${panel(120, 285, 270, 185, 'ファイルA', '#ecfeff')}
                ${panel(120, 315, 270, 185, 'ID・得点・性別', '#ffffff')}
                ${panel(810, 285, 270, 185, '結合後データ', '#f0fdf4')}
                ${panel(465, 250, 270, 110, '共通IDで照合', '#fff7ed')}
                ${panel(465, 390, 270, 110, 'ファイルB', '#ffffff')}
                ${arrow(390, 375, 465, 320, a.accent)}
                ${arrow(735, 320, 810, 375, a.accent)}
                ${arrow(600, 390, 600, 360, a.accent)}
                <text x="600" y="548" class="note" text-anchor="middle">行数・重複・結合できなかったIDを確認</text>`;
        case 'score':
            return `
                ${['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => `<rect x="${155 + i * 95}" y="${310 + i * 8}" width="70" height="150" rx="14" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/><text x="${190 + i * 95}" y="${395 + i * 8}" class="bigNum" text-anchor="middle">${q}</text>`).join('')}
                ${arrow(560, 395, 700, 395, a.accent)}
                <rect x="725" y="300" width="305" height="190" rx="22" fill="#fffbeb" stroke="${a.accent}" stroke-width="3"/>
                <text x="877" y="372" class="panelLabel" text-anchor="middle">合計点・平均点</text>
                <text x="877" y="440" class="formula" text-anchor="middle">(Q1+Q2+Q3+Q4) / 4</text>
                <text x="600" y="548" class="note" text-anchor="middle">逆転項目を処理してから尺度得点を作成</text>`;
        case 'histogram':
            return `
                ${axes()}
                ${[70, 116, 184, 238, 168, 94, 52].map((h, i) => `<rect x="${245 + i * 92}" y="${525 - h}" width="68" height="${h}" rx="8" fill="${i === 3 ? a.accent : '#60a5fa'}" opacity="${i === 3 ? 0.95 : 0.72}"/>`).join('')}
                <circle cx="825" cy="310" r="18" fill="#ef4444"/>
                <text x="855" y="318" class="callout">外れ値</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">分布・中心・ばらつきを確認</text>`;
        case 'table':
            return gridTable(['', '賛成', '反対'], ['男性', '女性'], [['42%', '58%'], ['65%', '35%']], a, '行・列の割合で偏りを見る');
        case 'scatter':
            return `
                ${axes()}
                ${[[260,475],[330,455],[385,430],[455,398],[525,392],[585,360],[660,335],[730,300],[810,276],[885,248],[945,232]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="13" fill="${a.accent}" opacity="0.76"/>`).join('')}
                <line x1="245" y1="480" x2="965" y2="230" stroke="#334155" stroke-width="5" stroke-dasharray="14 12"/>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">右上がりなら正の相関</text>`;
        case 'twoBars':
            return `
                ${axes()}
                ${bars([{ label: 'A組', h: 150, c: '#60a5fa' }, { label: 'B組', h: 235, c: a.accent }], a.accent)}
                <path d="M 335 250 C 430 210, 565 210, 660 250" fill="none" stroke="#334155" stroke-width="5"/>
                <text x="498" y="220" class="callout" text-anchor="middle">平均差</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">2つの平均を比較</text>`;
        case 'threeBars':
            return `
                ${axes()}
                ${bars([{ label: 'A組', h: 132, c: '#93c5fd' }, { label: 'B組', h: 214, c: '#fb7185' }, { label: 'C組', h: 174, c: '#fbbf24' }], a.accent)}
                <text x="600" y="586" class="axisLabel" text-anchor="middle">有意なら多重比較で「どこが違うか」を確認</text>`;
        case 'interaction':
            return `
                ${axes()}
                <path d="M 300 455 L 505 355 L 710 330 L 915 275" fill="none" stroke="#2563eb" stroke-width="8" stroke-linecap="round"/>
                <path d="M 300 315 L 505 335 L 710 400 L 915 470" fill="none" stroke="${a.accent}" stroke-width="8" stroke-linecap="round"/>
                ${[300,505,710,915].map(x => `<circle cx="${x}" cy="455" r="10" fill="#2563eb"/><circle cx="${x}" cy="315" r="10" fill="${a.accent}"/>`).join('')}
                <text x="810" y="250" class="callout">線が交差 → 交互作用</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">要因A × 要因B の組み合わせを確認</text>`;
        case 'rankTwo':
            return rankDots(['A群', 'B群'], [330, 710], a, '値を順位に変換して2群を比べる');
        case 'rankThree':
            return rankDots(['A群', 'B群', 'C群'], [260, 545, 830], a, '3群以上の順位の偏りを検定');
        case 'paired':
            return `
                ${axes()}
                ${[[300,455,620,360],[340,430,660,350],[380,470,700,410],[420,420,740,330],[460,445,780,370]].map(([x1,y1,x2,y2], i) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i === 2 ? '#ef4444' : '#94a3b8'}" stroke-width="5"/><circle cx="${x1}" cy="${y1}" r="11" fill="#60a5fa"/><circle cx="${x2}" cy="${y2}" r="11" fill="${a.accent}"/>`).join('')}
                <text x="375" y="565" class="axisLabel" text-anchor="middle">事前</text>
                <text x="705" y="565" class="axisLabel" text-anchor="middle">事後</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">同じ人の変化量を順位で見る</text>`;
        case 'switchTable':
            return gridTable(['事後', '賛成', '反対'], ['事前 賛成', '事前 反対'], [['変化なし', '反対へ'], ['賛成へ', '変化なし']], a, '不一致セルの人数差を検定');
        case 'residualTable':
            return gridTable(['', '選択A', '選択B'], ['男性', '女性'], [['多い', '少ない'], ['少ない', '多い']], a, '期待度数との差を見る');
        case 'exactTable':
            return gridTable(['', 'あり', 'なし'], ['群1', '群2'], [['3', '9'], ['8', '2']], a, '小さい2×2表でも正確にp値を計算');
        case 'lineScatter':
            return `
                ${axes()}
                ${[[270,472],[340,438],[410,420],[480,386],[550,362],[620,342],[690,298],[760,280],[830,246],[900,230]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#60a5fa" opacity="0.8"/>`).join('')}
                <line x1="250" y1="478" x2="930" y2="220" stroke="${a.accent}" stroke-width="7"/>
                <text x="720" y="210" class="callout">予測線</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">Xが増えるとYがどれだけ変わるか</text>`;
        case 'multiPredictor':
            return `
                ${['勉強時間', '出席率', '睡眠'].map((label, i) => panel(120, 270 + i * 105, 250, 76, label, '#fff7ed')).join('')}
                ${arrow(370, 308, 705, 392, a.accent)}
                ${arrow(370, 413, 705, 413, a.accent)}
                ${arrow(370, 518, 705, 434, a.accent)}
                <rect x="720" y="310" width="315" height="180" rx="24" fill="#fffbeb" stroke="${a.accent}" stroke-width="3"/>
                <text x="878" y="390" class="panelLabel" text-anchor="middle">テスト得点を予測</text>
                <text x="878" y="442" class="formula" text-anchor="middle">それぞれの独自効果</text>`;
        case 'sigmoid':
            return `
                ${axes()}
                <path d="M 230 505 C 390 500, 470 470, 555 395 C 650 305, 735 260, 965 250" fill="none" stroke="${a.accent}" stroke-width="9" stroke-linecap="round"/>
                ${[[300,494],[455,455],[585,370],[720,294],[875,258]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#60a5fa"/>`).join('')}
                <text x="850" y="220" class="callout">確率 0〜1</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">結果が起こる確率をS字曲線で予測</text>`;
        case 'latent':
            return `
                ${['Q1','Q2','Q3','Q4','Q5','Q6'].map((q, i) => {
                    const x = 210 + (i % 3) * 110 + (i > 2 ? 500 : 0);
                    const y = 330 + (i % 3) * 55;
                    return `<circle cx="${x}" cy="${y}" r="36" fill="#ede9fe" stroke="${a.accent}" stroke-width="3"/><text x="${x}" y="${y + 9}" class="smallNode" text-anchor="middle">${q}</text>`;
                }).join('')}
                <ellipse cx="360" cy="405" rx="95" ry="62" fill="#fff7ed" stroke="#f59e0b" stroke-width="3"/>
                <ellipse cx="860" cy="405" rx="95" ry="62" fill="#ecfeff" stroke="#06b6d4" stroke-width="3"/>
                <text x="360" y="413" class="panelLabel" text-anchor="middle">因子1</text>
                <text x="860" y="413" class="panelLabel" text-anchor="middle">因子2</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">質問のまとまりから共通テーマを命名</text>`;
        case 'pcaAxes':
            return `
                <line x1="260" y1="520" x2="940" y2="270" stroke="#94a3b8" stroke-width="4"/>
                <line x1="325" y1="250" x2="880" y2="555" stroke="#94a3b8" stroke-width="4"/>
                <line x1="240" y1="505" x2="955" y2="245" stroke="${a.accent}" stroke-width="9" marker-end="url(#arrow)"/>
                <line x1="440" y1="250" x2="740" y2="570" stroke="#f59e0b" stroke-width="7" marker-end="url(#arrow2)"/>
                ${[[365,420],[430,390],[498,360],[560,342],[625,312],[695,292],[750,276],[805,260]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#60a5fa" opacity="0.85"/>`).join('')}
                <text x="840" y="240" class="callout">主成分1</text>
                <text x="735" y="570" class="callout">主成分2</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">情報をよく表す新しい軸へ圧縮</text>`;
        case 'timeLine':
            return `
                ${axes()}
                <path d="M 240 450 C 330 390, 400 435, 480 360 S 655 310, 740 350 S 870 300, 970 245" fill="none" stroke="${a.accent}" stroke-width="8" stroke-linecap="round"/>
                <path d="M 240 500 L 970 265" stroke="#334155" stroke-width="5" stroke-dasharray="18 14"/>
                <text x="760" y="235" class="callout">トレンド</text>
                <text x="600" y="586" class="axisLabel" text-anchor="middle">時間順に並べて変化と周期を確認</text>`;
        case 'wordNetwork':
            return `
                ${arrow(398, 350, 500, 305, '#94a3b8')}
                ${arrow(595, 320, 780, 350, '#94a3b8')}
                ${arrow(600, 420, 390, 380, '#94a3b8')}
                ${arrow(545, 465, 610, 445, '#94a3b8')}
                ${word('学習', 340, 360, 58, a.accent)}
                ${word('楽しい', 545, 290, 46, '#0ea5e9')}
                ${word('難しい', 630, 430, 44, '#f97316')}
                ${word('授業', 820, 350, 48, '#16a34a')}
                ${word('質問', 510, 500, 36, '#9333ea')}
                <text x="600" y="586" class="axisLabel" text-anchor="middle">頻出語と共起のつながりを見る</text>`;
        default:
            return '';
    }
}

function word(text, x, y, r, color) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.88"/><text x="${x}" y="${y + 9}" class="word" text-anchor="middle">${esc(text)}</text>`;
}

function rankDots(labels, xs, a, note) {
    const dots = xs.map((x, groupIndex) => {
        return [0, 1, 2, 3, 4].map(i => {
            const cx = x + (i - 2) * 24;
            const cy = 475 - (i * 34 + groupIndex * 18);
            return `<circle cx="${cx}" cy="${cy}" r="12" fill="${groupIndex % 2 ? a.accent : '#60a5fa'}" opacity="0.82"/>`;
        }).join('') + `<text x="${x}" y="555" class="axisLabel" text-anchor="middle">${esc(labels[groupIndex])}</text>`;
    }).join('');
    return `
        ${axes()}
        <text x="205" y="250" class="callout">順位</text>
        ${dots}
        <text x="600" y="586" class="axisLabel" text-anchor="middle">${esc(note)}</text>`;
}

function gridTable(cols, rows, cells, a, note) {
    const x0 = 250;
    const y0 = 265;
    const cw = 230;
    const ch = 86;
    const colCount = cols.length;
    const rowCount = rows.length + 1;
    let out = '';
    for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
            const isHeader = r === 0 || c === 0;
            const text = r === 0 ? cols[c] : (c === 0 ? rows[r - 1] : cells[r - 1][c - 1]);
            const fill = isHeader ? '#eef2ff' : (text.includes('多') || text.includes('賛成へ') || text === '8' ? '#fef3c7' : '#ffffff');
            out += `<rect x="${x0 + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" fill="${fill}" stroke="${palette.line}" stroke-width="2"/>`;
            out += `<text x="${x0 + c * cw + cw / 2}" y="${y0 + r * ch + 53}" class="${isHeader ? 'panelLabel' : 'cellText'}" text-anchor="middle">${esc(text)}</text>`;
        }
    }
    return `${out}<text x="600" y="586" class="axisLabel" text-anchor="middle">${esc(note)}</text>`;
}

function svg(a) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
    <title id="title">${esc(a.title)}</title>
    <desc id="desc">${esc(a.subtitle)}</desc>
    <defs>
        ${shadow('cardShadow')}
        <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
            <path d="M 0 0 L 12 6 L 0 12 z" fill="${a.accent}"/>
        </marker>
        <marker id="arrow2" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
            <path d="M 0 0 L 12 6 L 0 12 z" fill="#f59e0b"/>
        </marker>
        <style>
            .title { font: 700 42px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .subtitle { font: 500 25px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.slate}; }
            .panelLabel { font: 700 26px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .axisLabel { font: 600 25px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.slate}; }
            .cellText { font: 700 27px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .callout { font: 700 26px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .note { font: 600 25px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.slate}; }
            .formula { font: 700 26px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.amber}; }
            .bigNum { font: 800 28px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .smallNode { font: 800 23px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: ${palette.navy}; }
            .word { font: 800 28px "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif; fill: white; }
        </style>
    </defs>
    ${header(a)}
    ${draw(a.type, a)}
</svg>
`;
}

for (const analysis of analyses) {
    writeFileSync(join(outDir, `${analysis.key}.svg`), svg(analysis), 'utf8');
}

const aliases = {
    wilcoxon_signed_rank: 'wilcoxon'
};

for (const [alias, source] of Object.entries(aliases)) {
    const analysis = analyses.find(item => item.key === source);
    writeFileSync(join(outDir, `${alias}.svg`), svg({ ...analysis, key: alias }), 'utf8');
}
