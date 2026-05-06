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
        diagram: 'flow',
        diagramTitle: '目的 → 変数 → 分析候補',
        tags: ['目的', '変数の型', 'おすすめ', '次に実行'],
        points: ['迷った時の入口', '候補分析を比較', '前提条件を確認']
    },
    {
        key: 'data_processing',
        title: 'データ加工・整形',
        subtitle: '分析前にデータをきれいに整える',
        accent: '#2563eb',
        diagram: 'cleaning',
        diagramTitle: '乱れた表を分析できる表へ',
        tags: ['欠損', '表記ゆれ', '外れ値', '新しい変数'],
        points: ['値の意味を保つ', '処理前後を比較', 'ルールを記録']
    },
    {
        key: 'data_merge',
        title: 'データ結合',
        subtitle: '共通IDで2つの表を1つにまとめる',
        accent: '#0f766e',
        diagram: 'merge',
        diagramTitle: '共通IDで行を対応づける',
        tags: ['ファイルA', '共通ID', 'ファイルB', '結合後'],
        points: ['重複キーを確認', '未結合行を確認', '行数の変化を見る']
    },
    {
        key: 'factor_score',
        title: '因子得点算出',
        subtitle: '複数の質問項目を尺度得点にまとめる',
        accent: '#d97706',
        diagram: 'score',
        diagramTitle: '項目を足して尺度得点にする',
        tags: ['質問項目', '逆転項目', '合計点', '平均点'],
        points: ['尺度ごとに集計', '欠損を確認', '分布を可視化']
    },
    {
        key: 'eda',
        title: '探索的データ分析',
        subtitle: '分布・外れ値・欠損から全体像を見る',
        accent: '#0284c7',
        diagram: 'eda',
        diagramTitle: '分布・外れ値・関係をざっと見る',
        tags: ['平均', '分布', '外れ値', '欠損'],
        points: ['最初にデータの顔を見る', '次の分析を決める', 'グラフで傾向確認']
    },
    {
        key: 'cross_tabulation',
        title: 'クロス集計',
        subtitle: '2つのカテゴリの内訳と割合を比べる',
        accent: '#0891b2',
        diagram: 'table',
        diagramTitle: 'カテゴリ×カテゴリの人数表',
        tags: ['度数', '行％', '列％', '偏り'],
        points: ['人数の内訳を確認', '母数を意識する', '検定前の整理に使う']
    },
    {
        key: 'correlation',
        title: '相関分析',
        subtitle: '2つの数値が一緒に増減するかを見る',
        accent: '#16a34a',
        diagram: 'scatter',
        diagramTitle: '散布図の傾きで関係を見る',
        tags: ['散布図', '相関係数', '向き', '強さ'],
        points: ['直線的な関係を見る', '外れ値に注意', '因果は断定しない']
    },
    {
        key: 'ttest',
        title: 't検定',
        subtitle: '2つの平均に違いがあるか調べる',
        accent: '#ea580c',
        diagram: 'twoMeans',
        diagramTitle: '2群の平均差を検定',
        tags: ['2群', '平均差', 't値', 'p値'],
        points: ['平均とSDを確認', '効果量も見る', 'Welch検定を基本に']
    },
    {
        key: 'anova_one_way',
        title: '一要因分散分析',
        subtitle: '3つ以上の平均をまとめて比較する',
        accent: '#dc2626',
        diagram: 'threeMeans',
        diagramTitle: '3群以上の平均を一度に比較',
        tags: ['3群以上', 'F値', '主効果', '多重比較'],
        points: ['まず全体差を見る', '有意なら事後比較', '効果量を確認']
    },
    {
        key: 'anova_two_way',
        title: '二要因分散分析',
        subtitle: '2つの要因と交互作用を調べる',
        accent: '#e11d48',
        diagram: 'interaction',
        diagramTitle: '2本の線で交互作用を見る',
        tags: ['要因A', '要因B', '主効果', '交互作用'],
        points: ['線の交差に注目', '単純主効果を確認', '組み合わせで解釈']
    },
    {
        key: 'mann_whitney',
        title: 'マン・ホイットニーU検定',
        subtitle: '2つの独立群を順位で比べる',
        accent: '#16a34a',
        diagram: 'rankTwo',
        diagramTitle: '値を順位に並べ替えて2群比較',
        tags: ['2群', '順位', 'U値', '効果量'],
        points: ['平均ではなく順位', '分布の違いを見る', '少人数にも使いやすい']
    },
    {
        key: 'kruskal_wallis',
        title: 'クラスカル・ウォリス検定',
        subtitle: '3群以上を順位で比較する',
        accent: '#0d9488',
        diagram: 'rankThree',
        diagramTitle: '3群以上を順位で比較',
        tags: ['3群以上', '順位', 'H値', '事後比較'],
        points: ['ANOVAの順位版', '正規性を仮定しない', '有意なら群間比較']
    },
    {
        key: 'wilcoxon_signed_rank',
        title: 'ウィルコクソン符号付順位検定',
        subtitle: '同じ人の事前・事後の変化を順位で見る',
        accent: '#0891b2',
        diagram: 'paired',
        diagramTitle: '同じ人の変化量を順位化',
        tags: ['対応あり', '差分', '符号', '順位'],
        points: ['ペアの変化を確認', '差の方向を見る', '正規性を仮定しない']
    },
    {
        key: 'mcnemar',
        title: 'マクネマー検定',
        subtitle: '対応のあるカテゴリの変化を調べる',
        accent: '#dc2626',
        diagram: 'mcnemar',
        diagramTitle: '変化した2セルだけに注目',
        tags: ['事前', '事後', '不一致セル', '変化方向'],
        points: ['同じ人の変化を見る', '2値カテゴリに使う', '不一致セルが重要']
    },
    {
        key: 'chi_square',
        title: 'カイ二乗検定',
        subtitle: '2つのカテゴリに関連があるか調べる',
        accent: '#9333ea',
        diagram: 'chiSquare',
        diagramTitle: '期待度数との差で偏りを見る',
        tags: ['クロス表', '期待度数', 'χ²', '残差'],
        points: ['期待度数を確認', '偏りのセルを見る', '関連は因果ではない']
    },
    {
        key: 'fisher_exact',
        title: 'フィッシャー正確検定',
        subtitle: '少人数の2×2表を正確に検定する',
        accent: '#7c3aed',
        diagram: 'fisher',
        diagramTitle: '小さい2×2表を正確に判定',
        tags: ['2×2表', '小標本', 'p値', 'オッズ比'],
        points: ['期待度数が小さい時', '正確な確率を計算', 'セル度数も報告']
    },
    {
        key: 'regression_simple',
        title: '単回帰分析',
        subtitle: '1つの要因から結果を予測する',
        accent: '#2563eb',
        diagram: 'regression',
        diagramTitle: '散布図に予測直線を引く',
        tags: ['説明変数', '目的変数', '回帰直線', 'R²'],
        points: ['係数の向きを見る', '残差を確認', '予測式を作る']
    },
    {
        key: 'regression_multiple',
        title: '重回帰分析',
        subtitle: '複数の要因から結果を予測する',
        accent: '#d97706',
        diagram: 'multipleRegression',
        diagramTitle: '複数要因の独自効果を見る',
        tags: ['複数要因', '係数', 'VIF', 'R²'],
        points: ['独自の影響を比較', '共線性に注意', '標準化係数も確認']
    },
    {
        key: 'logistic_regression',
        title: 'ロジスティック回帰',
        subtitle: '起こる・起こらないの確率を予測する',
        accent: '#e11d48',
        diagram: 'logistic',
        diagramTitle: 'S字曲線で確率を予測',
        tags: ['2値結果', '確率', 'オッズ比', '分類'],
        points: ['オッズ比で解釈', '混同行列を確認', 'イベント数に注意']
    },
    {
        key: 'factor_analysis',
        title: '因子分析',
        subtitle: '質問項目の背後にある共通テーマを探す',
        accent: '#7c3aed',
        diagram: 'factor',
        diagramTitle: '質問項目が因子にまとまる',
        tags: ['因子', '負荷量', '回転', '因子名'],
        points: ['項目のまとまりを見る', '因子数を検討', '信頼性も確認']
    },
    {
        key: 'pca',
        title: '主成分分析',
        subtitle: '多くの変数を少数の総合指標へ圧縮する',
        accent: '#0891b2',
        diagram: 'pca',
        diagramTitle: '新しい軸で情報を圧縮',
        tags: ['主成分', '寄与率', '負荷量', 'スコア'],
        points: ['情報を要約する', '新しい軸を解釈', '因子分析とは別物']
    },
    {
        key: 'time_series',
        title: '時系列データ分析',
        subtitle: '時間に沿った傾向・周期・変化を見る',
        accent: '#0284c7',
        diagram: 'timeSeries',
        diagramTitle: '時間順にトレンドと周期を見る',
        tags: ['時間順', 'トレンド', '周期', '異常値'],
        points: ['順番を崩さない', '変化点を確認', '自己相関を見る']
    },
    {
        key: 'text_mining',
        title: 'テキストマイニング',
        subtitle: '自由記述から頻出語と共起を見つける',
        accent: '#16a34a',
        diagram: 'textMining',
        diagramTitle: '言葉の頻度とつながりを見る',
        tags: ['頻出語', '共起', '文脈', 'カテゴリ差'],
        points: ['言葉の傾向を見る', '文脈も確認', '代表例と合わせる']
    }
];

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function chipList(items, accent) {
    return items.map(item => `<span style="--accent:${accent}">${esc(item)}</span>`).join('');
}

function bulletList(items) {
    return items.map(item => `<li>${esc(item)}</li>`).join('');
}

function axes() {
    return `
        <line x1="78" y1="305" x2="625" y2="305" class="axis"/>
        <line x1="78" y1="305" x2="78" y2="78" class="axis"/>`;
}

function bar(x, y, w, h, color, label) {
    return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${color}" opacity="0.88"/>
        <text x="${x + w / 2}" y="344" class="axisText" text-anchor="middle">${esc(label)}</text>`;
}

function dot(x, y, color, r = 9) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.88"/>`;
}

function tableCells(rows, cols, values, accent) {
    const x0 = 120;
    const y0 = 92;
    const cw = 150;
    const ch = 70;
    let out = '';
    for (let r = 0; r <= rows.length; r++) {
        for (let c = 0; c <= cols.length; c++) {
            const isHeader = r === 0 || c === 0;
            const value = r === 0 ? (cols[c - 1] || '') : (c === 0 ? rows[r - 1] : values[r - 1][c - 1]);
            const hot = !isHeader && (value.includes('多') || value.includes('変化') || value.includes('8') || value.includes('42'));
            out += `<rect x="${x0 + c * cw}" y="${y0 + r * ch}" width="${cw}" height="${ch}" rx="10" fill="${hot ? accent : (isHeader ? '#eef2ff' : '#ffffff')}" opacity="${hot ? '0.20' : '1'}" stroke="#cbd5e1" stroke-width="2"/>`;
            out += `<text x="${x0 + c * cw + cw / 2}" y="${y0 + r * ch + 44}" class="${isHeader ? 'smallBold' : 'cellText'}" text-anchor="middle">${esc(value)}</text>`;
        }
    }
    return out;
}

function renderDiagram(item) {
    const a = item.accent;
    const blue = '#2563eb';
    const orange = '#f97316';
    const green = '#16a34a';
    const violet = '#7c3aed';
    switch (item.diagram) {
        case 'flow':
            return `
                ${['研究目的', '変数の型', '分析候補', '実行'].map((label, i) => `
                    <rect x="${70 + i * 150}" y="145" width="125" height="92" rx="18" class="softBox"/>
                    <text x="${132 + i * 150}" y="198" class="boxText" text-anchor="middle">${label}</text>
                    ${i < 3 ? `<path d="M ${197 + i * 150} 191 L ${216 + i * 150} 191" class="arrow"/>` : ''}
                `).join('')}
                <text x="350" y="300" class="caption" text-anchor="middle">データの特徴に合う分析を選ぶ</text>`;
        case 'cleaning':
            return `
                <rect x="84" y="86" width="190" height="210" rx="18" class="tableBox"/>
                ${[0, 1, 2, 3].map(i => `<line x1="110" y1="${130 + i * 38}" x2="248" y2="${130 + i * 38}" class="gridLine"/>`).join('')}
                <circle cx="142" cy="168" r="12" fill="#ef4444"/><circle cx="214" cy="244" r="12" fill="#f59e0b"/>
                <path d="M 300 190 L 405 190" class="arrow"/>
                <path d="M 358 125 L 410 190 L 358 255 Z" fill="${a}" opacity="0.18" stroke="${a}" stroke-width="4"/>
                <rect x="455" y="86" width="190" height="210" rx="18" class="tableBox"/>
                ${[0, 1, 2, 3].map(i => `<line x1="481" y1="${130 + i * 38}" x2="619" y2="${130 + i * 38}" class="gridLine"/>`).join('')}
                <path d="M 500 166 L 530 196 L 600 136" fill="none" stroke="${green}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
                <text x="180" y="335" class="axisText" text-anchor="middle">元データ</text>
                <text x="550" y="335" class="axisText" text-anchor="middle">分析用データ</text>`;
        case 'merge':
            return `
                <rect x="70" y="90" width="190" height="170" rx="18" class="tableBox"/><text x="165" y="145" class="boxText" text-anchor="middle">表A</text><text x="165" y="200" class="cellText" text-anchor="middle">ID</text>
                <rect x="460" y="90" width="190" height="170" rx="18" class="tableBox"/><text x="555" y="145" class="boxText" text-anchor="middle">表B</text><text x="555" y="200" class="cellText" text-anchor="middle">ID</text>
                <rect x="270" y="245" width="180" height="92" rx="18" fill="${a}" opacity="0.16" stroke="${a}" stroke-width="4"/><text x="360" y="302" class="boxText" text-anchor="middle">結合後</text>
                <path d="M 260 175 C 315 185, 320 235, 350 245" class="arrow"/>
                <path d="M 460 175 C 405 185, 400 235, 370 245" class="arrow"/>
                <text x="360" y="74" class="caption" text-anchor="middle">共通キーで同じ人・同じIDをそろえる</text>`;
        case 'score':
            return `
                ${['Q1','Q2','Q3','Q4'].map((label, i) => `<rect x="${80 + i * 90}" y="${120 + i * 8}" width="66" height="130" rx="14" fill="#fff7ed" stroke="${a}" stroke-width="3"/><text x="${113 + i * 90}" y="${192 + i * 8}" class="cellText" text-anchor="middle">${label}</text>`).join('')}
                <path d="M 455 190 L 535 190" class="arrow"/>
                <rect x="545" y="118" width="110" height="150" rx="20" fill="${a}" opacity="0.16" stroke="${a}" stroke-width="4"/>
                <text x="600" y="176" class="boxText" text-anchor="middle">尺度</text><text x="600" y="218" class="boxText" text-anchor="middle">得点</text>
                <text x="352" y="330" class="caption" text-anchor="middle">質問項目を合計・平均して新しい得点にする</text>`;
        case 'eda':
            return `
                ${axes()}
                ${[50, 82, 135, 180, 122, 75, 42].map((h, i) => `<rect x="${130 + i * 55}" y="${305 - h}" width="36" height="${h}" rx="8" fill="${blue}" opacity="${i === 3 ? '0.92' : '0.55'}"/>`).join('')}
                <circle cx="560" cy="116" r="16" fill="#ef4444"/><text x="590" y="124" class="smallBold">外れ値</text>
                <rect x="440" y="182" width="120" height="82" rx="15" fill="#fff" stroke="#cbd5e1" stroke-width="3"/>
                <line x1="460" y1="230" x2="540" y2="230" stroke="${a}" stroke-width="8"/><circle cx="500" cy="230" r="22" fill="${a}" opacity="0.20" stroke="${a}" stroke-width="3"/>
                <text x="350" y="355" class="caption" text-anchor="middle">分布、外れ値、欠損を最初に確認</text>`;
        case 'table':
            return `${tableCells(['男性', '女性'], ['賛成', '反対'], [['42%', '58%'], ['65%', '35%']], a)}<text x="350" y="334" class="caption" text-anchor="middle">行や列の割合で内訳の偏りを見る</text>`;
        case 'scatter':
            return `
                ${axes()}
                ${[[130,270],[180,252],[220,235],[270,210],[320,198],[370,170],[430,150],[480,125],[545,108],[600,88]].map(([x,y]) => dot(x, y, a, 10)).join('')}
                <line x1="122" y1="274" x2="610" y2="86" stroke="#0f172a" stroke-width="6" stroke-dasharray="13 10"/>
                <text x="505" y="75" class="smallBold">正の相関</text>
                <text x="350" y="354" class="caption" text-anchor="middle">点が右上がりなら一緒に増える関係</text>`;
        case 'twoMeans':
            return `
                ${axes()}
                ${bar(180, 180, 95, 125, blue, 'A群')}
                ${bar(425, 118, 95, 187, a, 'B群')}
                <line x1="140" y1="180" x2="315" y2="180" class="meanLine"/>
                <line x1="385" y1="118" x2="560" y2="118" class="meanLine"/>
                <path d="M 275 138 C 320 98, 380 98, 425 138" fill="none" stroke="#0f172a" stroke-width="5"/>
                <text x="350" y="88" class="smallBold" text-anchor="middle">平均差</text>`;
        case 'threeMeans':
            return `
                ${axes()}
                ${bar(130, 200, 80, 105, blue, 'A')}
                ${bar(310, 130, 80, 175, a, 'B')}
                ${bar(490, 168, 80, 137, orange, 'C')}
                <path d="M 170 95 L 530 95" class="meanLine"/><path d="M 170 95 L 170 116 M 530 95 L 530 116" class="meanLine"/>
                <text x="350" y="78" class="smallBold" text-anchor="middle">全体として平均が違うか</text>`;
        case 'interaction':
            return `
                ${axes()}
                <path d="M 145 240 L 300 178 L 455 145 L 610 108" fill="none" stroke="${blue}" stroke-width="8" stroke-linecap="round"/>
                <path d="M 145 126 L 300 150 L 455 210 L 610 270" fill="none" stroke="${a}" stroke-width="8" stroke-linecap="round"/>
                ${[145,300,455,610].map(x => `${dot(x, x < 300 ? 240 : x < 455 ? 178 : x < 610 ? 145 : 108, blue, 9)}${dot(x, x < 300 ? 126 : x < 455 ? 150 : x < 610 ? 210 : 270, a, 9)}`).join('')}
                <text x="495" y="78" class="smallBold">線が開く・交差する</text>
                <text x="350" y="354" class="caption" text-anchor="middle">片方の要因の効果が、もう片方で変わる</text>`;
        case 'rankTwo':
            return rankDiagram(['A群', 'B群'], [blue, a], '順位に並べて2群の位置を比較');
        case 'rankThree':
            return rankDiagram(['A群', 'B群', 'C群'], [blue, a, orange], '順位に並べて3群以上を比較');
        case 'paired':
            return `
                ${axes()}
                ${[[160,250,440,170],[200,220,480,160],[240,260,520,230],[280,205,560,140],[320,238,600,190]].map(([x1,y1,x2,y2], i) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i === 2 ? '#ef4444' : '#94a3b8'}" stroke-width="5"/><circle cx="${x1}" cy="${y1}" r="10" fill="${blue}"/><circle cx="${x2}" cy="${y2}" r="10" fill="${a}"/>`).join('')}
                <text x="235" y="344" class="axisText" text-anchor="middle">事前</text><text x="520" y="344" class="axisText" text-anchor="middle">事後</text>
                <text x="350" y="78" class="caption" text-anchor="middle">同じ人を線で結び、変化量を見る</text>`;
        case 'mcnemar':
            return `${tableCells(['事前:はい', '事前:いいえ'], ['事後:はい', '事後:いいえ'], [['変化なし', '変化'], ['変化', '変化なし']], a)}<path d="M 430 160 L 532 242" class="arrow"/><path d="M 430 242 L 532 160" class="arrow"/><text x="350" y="334" class="caption" text-anchor="middle">はい→いいえ、いいえ→はいの人数差を見る</text>`;
        case 'chiSquare':
            return `${tableCells(['男性', '女性'], ['選択A', '選択B'], [['多い', '少ない'], ['少ない', '多い']], a)}<text x="350" y="334" class="caption" text-anchor="middle">観測度数と期待度数のズレを見る</text>`;
        case 'fisher':
            return `${tableCells(['群1', '群2'], ['あり', 'なし'], [['3', '9'], ['8', '2']], a)}<circle cx="565" cy="124" r="54" fill="none" stroke="${a}" stroke-width="8"/><line x1="604" y1="163" x2="650" y2="209" stroke="${a}" stroke-width="10" stroke-linecap="round"/><text x="350" y="334" class="caption" text-anchor="middle">小さい表でも正確な確率で判定</text>`;
        case 'regression':
            return `
                ${axes()}
                ${[[140,260],[190,242],[240,225],[290,210],[340,180],[390,170],[440,145],[495,122],[560,104]].map(([x,y]) => dot(x, y, blue, 9)).join('')}
                <line x1="130" y1="270" x2="585" y2="94" stroke="${a}" stroke-width="8"/>
                ${[[240,225,194],[390,170,160],[495,122,128]].map(([x,y,yp]) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${yp}" stroke="#ef4444" stroke-width="4" stroke-dasharray="7 7"/>`).join('')}
                <text x="482" y="78" class="smallBold">予測直線</text>`;
        case 'multipleRegression':
            return `
                ${['勉強', '出席', '睡眠'].map((label, i) => `<rect x="82" y="${90 + i * 78}" width="145" height="54" rx="16" class="softBox"/><text x="154" y="${125 + i * 78}" class="boxText" text-anchor="middle">${label}</text><path d="M 228 ${117 + i * 78} L 405 180" stroke="${[blue,a,green][i]}" stroke-width="${[9,5,7][i]}" stroke-linecap="round" marker-end="url(#arrowHead)"/>`).join('')}
                <rect x="420" y="122" width="190" height="118" rx="20" fill="${a}" opacity="0.14" stroke="${a}" stroke-width="4"/><text x="515" y="174" class="boxText" text-anchor="middle">結果を予測</text><text x="515" y="212" class="smallBold" text-anchor="middle">太い矢印 = 強い影響</text>`;
        case 'logistic':
            return `
                ${axes()}
                <path d="M 120 285 C 260 285, 280 250, 350 190 C 420 128, 455 92, 610 92" fill="none" stroke="${a}" stroke-width="10" stroke-linecap="round"/>
                ${[[150,282],[260,268],[350,190],[450,112],[575,94]].map(([x,y]) => dot(x, y, blue, 9)).join('')}
                <text x="560" y="76" class="smallBold">確率が高い</text><text x="155" y="276" class="smallBold">低い</text>
                <text x="350" y="354" class="caption" text-anchor="middle">結果が起こる確率を0〜1で予測</text>`;
        case 'factor':
            return `
                ${['Q1','Q2','Q3','Q4','Q5','Q6'].map((label, i) => {
                    const x = 120 + (i % 3) * 75 + (i > 2 ? 350 : 0);
                    const y = 135 + (i % 3) * 55;
                    const cx = i > 2 ? 505 : 205;
                    return `<line x1="${x}" y1="${y}" x2="${cx}" y2="255" stroke="#94a3b8" stroke-width="4"/><circle cx="${x}" cy="${y}" r="26" fill="#fff" stroke="${a}" stroke-width="4"/><text x="${x}" y="${y + 8}" class="smallBold" text-anchor="middle">${label}</text>`;
                }).join('')}
                <ellipse cx="205" cy="255" rx="86" ry="48" fill="${a}" opacity="0.16" stroke="${a}" stroke-width="4"/><text x="205" y="264" class="boxText" text-anchor="middle">因子1</text>
                <ellipse cx="505" cy="255" rx="86" ry="48" fill="${orange}" opacity="0.16" stroke="${orange}" stroke-width="4"/><text x="505" y="264" class="boxText" text-anchor="middle">因子2</text>`;
        case 'pca':
            return `
                <line x1="110" y1="292" x2="604" y2="118" stroke="#cbd5e1" stroke-width="5"/>
                <line x1="190" y1="78" x2="548" y2="315" stroke="#cbd5e1" stroke-width="5"/>
                <line x1="120" y1="286" x2="610" y2="110" stroke="${a}" stroke-width="10" marker-end="url(#arrowHead)"/>
                <line x1="230" y1="95" x2="510" y2="314" stroke="${orange}" stroke-width="8" marker-end="url(#arrowHeadOrange)"/>
                ${[[210,232],[260,215],[315,190],[370,180],[430,155],[485,140]].map(([x,y]) => dot(x, y, blue, 9)).join('')}
                <text x="512" y="97" class="smallBold">主成分1</text><text x="474" y="338" class="smallBold">主成分2</text>`;
        case 'timeSeries':
            return `
                ${axes()}
                <path d="M 118 250 C 180 190, 220 245, 280 184 S 395 140, 460 178 S 545 130, 620 92" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/>
                <line x1="115" y1="262" x2="620" y2="104" stroke="#0f172a" stroke-width="5" stroke-dasharray="15 12"/>
                <circle cx="455" cy="180" r="15" fill="#ef4444"/><text x="484" y="188" class="smallBold">変化点</text>
                <text x="350" y="354" class="caption" text-anchor="middle">時間の順番に沿って傾きと波を見る</text>`;
        case 'textMining':
            return `
                ${wordNode(185,150,52,a,'学習')}${wordNode(330,105,45,blue,'楽しい')}${wordNode(455,205,48,orange,'難しい')}${wordNode(545,135,42,green,'授業')}${wordNode(312,270,36,violet,'質問')}
                <line x1="235" y1="150" x2="290" y2="115" class="link"/><line x1="370" y1="125" x2="420" y2="178" class="link"/><line x1="495" y1="190" x2="522" y2="158" class="link"/><line x1="214" y1="190" x2="288" y2="250" class="link"/>
                <text x="350" y="354" class="caption" text-anchor="middle">よく出る言葉と一緒に出る言葉を可視化</text>`;
        default:
            return '';
    }
}

function rankDiagram(labels, colors, caption) {
    const count = labels.length;
    const xStart = count === 2 ? 215 : 145;
    const gap = count === 2 ? 240 : 180;
    const dots = labels.map((label, gi) => {
        const x = xStart + gi * gap;
        return [0, 1, 2, 3, 4].map(i => dot(x + (i - 2) * 22, 280 - i * 35 - gi * 8, colors[gi], 9)).join('') +
            `<text x="${x}" y="344" class="axisText" text-anchor="middle">${esc(label)}</text>`;
    }).join('');
    return `${axes()}<text x="100" y="82" class="smallBold">順位</text>${dots}<text x="350" y="66" class="caption" text-anchor="middle">${esc(caption)}</text>`;
}

function wordNode(x, y, r, color, label) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.88"/><text x="${x}" y="${y + 8}" class="wordText" text-anchor="middle">${esc(label)}</text>`;
}

function pageHtml(item, baseUrl) {
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
        filter: saturate(0.78) contrast(0.85) brightness(1.16);
        opacity: 0.22;
    }
    .wash {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(248,250,252,0.96), rgba(255,255,255,0.90));
    }
    .top {
        position: absolute;
        left: 54px;
        right: 54px;
        top: 42px;
        height: 114px;
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 26px;
    }
    .accent {
        width: 92px;
        height: 9px;
        border-radius: 999px;
        background: ${item.accent};
        margin-bottom: 13px;
    }
    h1 {
        margin: 0 0 8px;
        color: #0f172a;
        font-size: 43px;
        font-weight: 900;
        line-height: 1.08;
        letter-spacing: 0;
    }
    .subtitle {
        margin: 0;
        color: #334155;
        font-size: 24px;
        font-weight: 750;
        line-height: 1.34;
    }
    .chips {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 9px;
        max-width: 470px;
        padding-top: 22px;
    }
    .chips span {
        min-height: 38px;
        padding: 6px 13px 7px;
        border-radius: 999px;
        color: var(--accent);
        border: 2px solid color-mix(in srgb, var(--accent) 34%, white);
        background: color-mix(in srgb, var(--accent) 10%, white);
        font-size: 18px;
        font-weight: 850;
        white-space: nowrap;
    }
    .diagram-card {
        position: absolute;
        left: 54px;
        top: 174px;
        width: 742px;
        height: 448px;
        border-radius: 26px;
        background: rgba(255,255,255,0.96);
        border: 1px solid #dbe3ee;
        box-shadow: 0 24px 54px rgba(15,23,42,0.16);
        padding: 26px 28px 22px;
    }
    .diagram-title {
        margin: 0 0 12px;
        color: #0f172a;
        font-size: 29px;
        font-weight: 900;
        letter-spacing: 0;
    }
    .diagram-svg {
        width: 100%;
        height: 360px;
        display: block;
        border-radius: 22px;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        border: 1px solid #e2e8f0;
    }
    .point-card {
        position: absolute;
        right: 54px;
        top: 174px;
        width: 326px;
        height: 448px;
        border-radius: 26px;
        background: rgba(255,255,255,0.95);
        border: 1px solid #dbe3ee;
        box-shadow: 0 24px 54px rgba(15,23,42,0.14);
        padding: 30px 28px;
    }
    .point-card h2 {
        margin: 0 0 24px;
        color: #0f172a;
        font-size: 29px;
        font-weight: 900;
        letter-spacing: 0;
    }
    .point-card ul {
        display: grid;
        gap: 18px;
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .point-card li {
        position: relative;
        padding-left: 31px;
        color: #1e293b;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.36;
    }
    .point-card li::before {
        content: "";
        position: absolute;
        left: 0;
        top: 12px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: ${item.accent};
        box-shadow: 0 0 0 6px color-mix(in srgb, ${item.accent} 15%, transparent);
    }
    svg text {
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif;
        letter-spacing: 0;
    }
    .axis { stroke: #94a3b8; stroke-width: 4; stroke-linecap: round; }
    .gridLine { stroke: #cbd5e1; stroke-width: 3; stroke-linecap: round; }
    .arrow { stroke: ${item.accent}; stroke-width: 7; stroke-linecap: round; marker-end: url(#arrowHead); fill: none; }
    .link { stroke: #94a3b8; stroke-width: 6; stroke-linecap: round; }
    .meanLine { stroke: #0f172a; stroke-width: 5; stroke-linecap: round; }
    .softBox, .tableBox { fill: #ffffff; stroke: #cbd5e1; stroke-width: 3; }
    .boxText { font-size: 24px; font-weight: 850; fill: #0f172a; }
    .smallBold { font-size: 21px; font-weight: 850; fill: #0f172a; }
    .cellText { font-size: 24px; font-weight: 850; fill: #1e293b; }
    .axisText { font-size: 22px; font-weight: 800; fill: #475569; }
    .caption { font-size: 23px; font-weight: 850; fill: #334155; }
    .wordText { font-size: 21px; font-weight: 900; fill: #ffffff; }
</style>
</head>
<body>
    <main class="canvas">
        <img class="base" src="${baseUrl}" alt="">
        <div class="wash"></div>
        <header class="top">
            <div>
                <div class="accent"></div>
                <h1>${esc(item.title)}</h1>
                <p class="subtitle">${esc(item.subtitle)}</p>
            </div>
            <div class="chips">${chipList(item.tags, item.accent)}</div>
        </header>
        <section class="diagram-card">
            <h2 class="diagram-title">${esc(item.diagramTitle)}</h2>
            <svg class="diagram-svg" viewBox="0 0 700 390" role="img" aria-label="${esc(item.diagramTitle)}">
                <defs>
                    <marker id="arrowHead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M0 0 L12 6 L0 12 Z" fill="${item.accent}"/>
                    </marker>
                    <marker id="arrowHeadOrange" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M0 0 L12 6 L0 12 Z" fill="#f97316"/>
                    </marker>
                </defs>
                ${renderDiagram(item)}
            </svg>
        </section>
        <aside class="point-card">
            <h2>ここを見る</h2>
            <ul>${bulletList(item.points)}</ul>
        </aside>
    </main>
</body>
</html>`;
}

mkdirSync(baseDir, { recursive: true });

for (const item of analyses) {
    copyFileSync(join(imageDir, `${item.key}.png`), join(baseDir, `${item.key}.png`));
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
