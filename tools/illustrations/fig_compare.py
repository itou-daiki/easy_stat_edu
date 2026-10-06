"""グループを比べる分析の説明イラスト（t検定・分散分析・U検定・クラスカル・ウォリス・ウィルコクソン）

どの図も「1つの点＝1人」。図に使うデータはここで定義し、verify.py で実際に検定して説明と合うか確かめる。
"""
from __future__ import annotations

from svgkit import (BLUE, BLUE_TEXT, GROUP_COLORS, INK, MUTED, ORANGE, ORANGE_TEXT, RULE, Canvas,
                    Panel, Scale, dot_strip, integer_scores, panels)

# ---------------------------------------------------------------------------
# 図のデータ（verify.py からも使う）
# ---------------------------------------------------------------------------
TTEST_MEANS = (47, 53)
TTEST_SDS = (3.0, 14.0)            # 左：ばらつき小 → 差あり / 右：ばらつき大 → 差があるとはいえない

ANOVA_MEANS = (50, 55, 60)
ANOVA_SDS = (4.0, 14.0)              # 平均は同じで、ばらつきだけがちがう
ANOVA_N = 20

# 1日のスマホ時間（分）。右にすそが長い（かたよった）データ
MANN_WHITNEY_CASES = [
    ([15, 25, 30, 40, 50, 60, 75, 90], [100, 120, 140, 160, 190, 220, 260, 300]),
    ([15, 30, 50, 75, 120, 160, 220, 300], [25, 40, 60, 90, 100, 140, 190, 260]),
]
KRUSKAL_CASES = [
    ([10, 20, 25, 35, 45, 55], [70, 80, 95, 110, 130, 150], [170, 190, 220, 250, 290, 340]),
    ([10, 35, 80, 130, 190, 290], [20, 45, 95, 150, 220, 340], [25, 55, 70, 110, 170, 250]),
]

# 二要因分散分析：学年（1〜3年）× 部活（あり・なし）の1日の勉強時間（分）の平均。各15人
TWO_WAY_CASES = [
    ([40, 55, 70], [60, 75, 90]),   # 平行：部活の有無による差がどの学年も同じ → 交互作用なし
    ([40, 55, 95], [60, 75, 90]),   # 3年だけ差が消える → 交互作用あり
]
TWO_WAY_N = 15
TWO_WAY_SD = 15

# 授業の前後の点数（同じ10人）
WILCOXON_PRE = [42, 48, 51, 55, 58, 60, 63, 66, 70, 74]
WILCOXON_DIFFS = [
    [8, 5, 12, 3, 9, -2, 7, 10, 6, 4],
    [6, -5, 3, -7, 2, -4, 8, -3, 1, -6],
]


def ranks(values: list[float]) -> list[float]:
    """小さい順の順位（同じ値は平均順位）"""
    order = sorted(range(len(values)), key=lambda i: values[i])
    result = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            result[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return result


def group_strips(c: Canvas, panel: Panel, groups: list[tuple[str, list[float]]], scale: Scale, *,
                 top: float, axis_y: float, bin_width: float, dot: float = 11,
                 mean_label: str | None = '平均{:g}点', rank_labels: list[list[str]] | None = None,
                 side_notes: list[str] | None = None) -> None:
    """グループごとに1本の帯を作り、点を積み上げる。平均の位置に点線を引く"""
    count = len(groups)
    spacing = (axis_y - 18 - top) / count
    for index, (name, values) in enumerate(groups):
        color, text_color = GROUP_COLORS[index]
        baseline = top + spacing * (index + 1)
        c.line(scale.r0, baseline, scale.r1, baseline, stroke=RULE, width=2)
        c.text(panel.x0 + 24, baseline - 4, name, 32, weight=700, fill=text_color, anchor='start')
        dot_strip(c, values, scale, baseline, color, bin_width=bin_width, dot=dot,
                  labels=rank_labels[index] if rank_labels else None)
        if mean_label:
            mean = sum(values) / len(values)
            line_top = baseline - spacing + 36
            c.line(scale(mean), line_top, scale(mean), baseline + 6, width=3, dash='8 6')
            c.text(scale(mean) + 10, line_top + 20, mean_label.format(round(mean, 1)), 24, weight=700,
                   fill=text_color, anchor='start')
        if side_notes:
            c.text(panel.x0 + 24, baseline + 34, side_notes[index], 22, weight=700, fill=text_color,
                   anchor='start')


# ---------------------------------------------------------------------------
# t検定
# ---------------------------------------------------------------------------
def ttest() -> str:
    c = Canvas('t検定：1組と2組の平均点の6点の差は、たしかな差といえるか')
    c.question('平均点の6点の差は、「たしかな差」といえる？',
               '左右は別の例です。どちらも各組30人・平均は47点と53点（差は6点）で、点数の散らばり方だけがちがいます',
               '点1つが1人。横の位置が点数。同じくらいの点数の人は上に積む（上下とも、下の目盛りで読む）')
    headings = ('点数がまとまっている（ばらつきが小さい）', '点数が広く散らばっている（ばらつきが大きい）')
    conclusions = [('平均にちがいがあるといえる', None),
                   ('今回のデータでは、ちがいがあるとまではいえない', '（「同じ」とわかったわけではありません）')]
    for panel, sd, heading, (conclusion, extra) in zip(panels(2, top=180, height=450), TTEST_SDS, headings, conclusions):
        c.frame(panel, heading)
        scale = Scale(0, 100, panel.x0 + 110, panel.right - 40)
        axis_y = panel.bottom - 88
        top = panel.y0 + 56
        groups = [('1組', integer_scores(TTEST_MEANS[0], sd)), ('2組', integer_scores(TTEST_MEANS[1], sd))]
        group_strips(c, panel, groups, scale, top=top, axis_y=axis_y, bin_width=2)
        # 2本の平均の点線を、2段のあいだの両矢印までのばしてつなぐ
        spacing = (axis_y - 18 - top) / 2
        baseline1 = top + spacing
        line_top2 = top + 2 * spacing - spacing + 36
        gap_y = baseline1 + 20
        x1, x2 = scale(TTEST_MEANS[0]), scale(TTEST_MEANS[1])
        c.line(x1, baseline1, x1, gap_y, width=3, dash='8 6')
        c.line(x2, gap_y, x2, line_top2, width=3, dash='8 6')
        c.arrow(x1, gap_y, x2, gap_y, both=True, head=9)
        c.text(x1 - 12, gap_y + 9, '平均の差6点', 24, weight=700, anchor='end')
        c.x_axis(scale, axis_y, list(range(0, 101, 10)), '点数（点）')
        c.text(panel.cx, panel.bottom + 40, 't検定で計算すると…', 24, fill=MUTED)
        c.text(panel.cx, panel.bottom + 82, conclusion, 32, weight=700)
        if extra:
            c.text(panel.cx, panel.bottom + 118, extra, 24, fill=INK)
    c.summary('t検定は「平均の差」「点数の散らばり」「人数」を使って計算し、平均にちがいがあるといえるかを判断します', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 一要因分散分析
# ---------------------------------------------------------------------------
def anova_one_way() -> str:
    c = Canvas('一要因分散分析：3つの組の平均点のちがいは、たしかなちがいといえるか')
    c.question('3つの組の平均点のちがいは、「たしかなちがい」といえる？',
               '左右は別の例です。どちらも各組20人・平均は50点・55点・60点で、点数の散らばり方だけがちがいます',
               '点1つが1人。横の位置が点数。同じくらいの点数の人は上に積む（どの段も、下の目盛りで読む）')
    headings = ('点数がまとまっている（ばらつきが小さい）', '点数が広く散らばっている（ばらつきが大きい）')
    conclusions = [('どこかの組の間にちがいがあるといえる', '（どの組どうしかは「多重比較」で確かめます）'),
                   ('今回のデータでは、ちがいがあるとまではいえない', '（「同じ」とわかったわけではありません）')]
    for panel, sd, heading, (main, extra) in zip(panels(2, top=180, height=450), ANOVA_SDS, headings, conclusions):
        c.frame(panel, heading)
        scale = Scale(0, 100, panel.x0 + 110, panel.right - 40)
        axis_y = panel.bottom - 88
        groups = [(f'{i + 1}組', integer_scores(mean, sd, ANOVA_N)) for i, mean in enumerate(ANOVA_MEANS)]
        group_strips(c, panel, groups, scale, top=panel.y0 + 50, axis_y=axis_y, bin_width=2, dot=10)
        c.x_axis(scale, axis_y, list(range(0, 101, 10)), '点数（点）')
        c.conclude(panel, '分散分析', main, extra)
    c.summary('分散分析は、3つ以上のグループの「平均の差」を「点数の散らばり」と比べて、ちがいがあるといえるかを判断します', y=850)
    return c.to_svg()


def rank_figure(title: str, question: str, note: str, cases: list[list[list[float]]], method: str,
                conclusions: list[tuple[str, str | None]], summary: str, *, axis_max: int, ticks: list[int],
                unit_label: str) -> str:
    """順位で比べる検定（U検定・クラスカル・ウォリス）の共通の図"""
    c = Canvas(title)
    c.question(question, note, '点の上の数字は、全員を少ない順に並べたときの順位。この順位を使って計算します')
    headings = ('グループごとに分かれている', 'グループが入りまじっている')
    for panel, groups, (main, extra), heading in zip(panels(2, top=180, height=450), cases, conclusions, headings):
        c.frame(panel, heading)
        scale = Scale(0, axis_max, panel.x0 + 110, panel.right - 40)
        axis_y = panel.bottom - 88
        all_values = [v for group in groups for v in group]
        all_ranks = ranks(all_values)
        rank_labels, notes, start = [], [], 0
        for group in groups:
            group_ranks = all_ranks[start:start + len(group)]
            rank_labels.append([f'{r:g}' for r in group_ranks])
            notes.append(f'平均順位 {sum(group_ranks) / len(group_ranks):.1f}')
            start += len(group)
        named = [(f'{i + 1}組', group) for i, group in enumerate(groups)]
        group_strips(c, panel, named, scale, top=panel.y0 + 46, axis_y=axis_y - 40, bin_width=axis_max / 70,
                     dot=13, mean_label=None, rank_labels=rank_labels, side_notes=notes)
        c.x_axis(scale, axis_y, ticks, unit_label)
        c.conclude(panel, method, main, extra)
    c.summary(summary, y=850)
    return c.to_svg()


def mann_whitney() -> str:
    return rank_figure(
        'マン・ホイットニーのU検定：1組と2組のスマホ時間のちがいは、たしかなちがいといえるか',
        '1組と2組のスマホ時間のちがいは、「たしかなちがい」といえる？',
        '左右は別の例です（各組8人）。点1つが1人で、横の位置が1日のスマホ時間',
        [list(MANN_WHITNEY_CASES[0]), list(MANN_WHITNEY_CASES[1])],
        'U検定',
        [('ちがいがあるといえる', '（2組の人が大きい順位にかたまっている）'),
         ('今回のデータでは、ちがいがあるとまではいえない', '（「同じ」とわかったわけではありません）')],
        'U検定は、値そのものではなく「順位」で比べるので、極端に大きい値があっても影響を受けにくい方法です',
        axis_max=350, ticks=list(range(0, 351, 50)), unit_label='スマホ時間（分）')


def kruskal_wallis() -> str:
    return rank_figure(
        'クラスカル・ウォリス検定：3つの組のスマホ時間のちがいは、たしかなちがいといえるか',
        '3つの組のスマホ時間のちがいは、「たしかなちがい」といえる？',
        '左右は別の例です（各組6人）。点1つが1人で、横の位置が1日のスマホ時間',
        [list(KRUSKAL_CASES[0]), list(KRUSKAL_CASES[1])],
        'クラスカル・ウォリス検定',
        [('どこかの組の間にちがいがあるといえる', '（組ごとに平均順位が大きくちがう）'),
         ('今回のデータでは、ちがいがあるとまではいえない', '（「同じ」とわかったわけではありません）')],
        'クラスカル・ウォリス検定は、3つ以上のグループを「順位」で比べる方法です（分散分析の順位版）',
        axis_max=350, ticks=list(range(0, 351, 50)), unit_label='スマホ時間（分）')


# ---------------------------------------------------------------------------
# ウィルコクソンの符号付順位検定（同じ人の前後）
# ---------------------------------------------------------------------------
def wilcoxon_signed_rank() -> str:
    c = Canvas('ウィルコクソンの符号付順位検定：授業の前後で同じ生徒の点数は上がったか')
    c.question('授業の前と後の点数の変化は、「たしかな変化」といえる？',
               '左右は別の例です（それぞれ10人の生徒を、授業の前と後に測定）',
               '線1本が1人。左が授業の前、右が授業の後の点数。青：上がった人　オレンジ：下がった人')
    conclusions = [('点数が上がったといえる', None),
                   ('今回のデータでは、変化があるとまではいえない', '（「同じ」とわかったわけではありません）')]
    for panel, diffs, (main, extra) in zip(panels(2, top=180, height=450), WILCOXON_DIFFS, conclusions):
        up = sum(1 for d in diffs if d > 0)
        c.frame(panel, f'上がった人 {up}人　下がった人 {len(diffs) - up}人')
        y_scale = Scale(30, 90, panel.bottom - 60, panel.y0 + 100)
        x_pre, x_post = panel.x0 + 230, panel.right - 170
        c.y_axis(y_scale, panel.x0 + 120, list(range(30, 91, 10)))
        c.text(panel.x0 + 120, y_scale.r1 - 18, '点数（点）', 22, weight=700, fill=MUTED)
        for x, label in ((x_pre, '授業の前'), (x_post, '授業の後')):
            c.line(x, y_scale.r0, x, y_scale.r1, stroke=RULE, width=2)
            c.text(x, panel.bottom - 22, label, 28, weight=700)
        for pre, diff in zip(WILCOXON_PRE, diffs):
            color = BLUE if diff > 0 else ORANGE
            c.line(x_pre, y_scale(pre), x_post, y_scale(pre + diff), stroke=color, width=4)
            c.circle(x_pre, y_scale(pre), 7, fill=color)
            c.circle(x_post, y_scale(pre + diff), 7, fill=color)
        c.conclude(panel, 'ウィルコクソン検定', main, extra)
    c.summary('同じ人の「前と後の変化」の向きと大きさ（順位）で調べます。かたよりや外れ値があるデータに向いています', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 二要因分散分析
# ---------------------------------------------------------------------------
def anova_two_way() -> str:
    c = Canvas('二要因分散分析：学年と部活の有無を組み合わせると、勉強時間はどう変わるか')
    c.question('学年と部活の有無を組み合わせると、勉強時間はどう変わる？',
               '左右は別の例です。各グループ15人。小さい点が1人、大きい点と線がグループの平均',
               '青：部活あり　オレンジ：部活なし')
    headings = ('2本の線が平行', '3年生だけ線が近づく（交差する）')
    conclusions = [('組み合わせの効果（交互作用）があるとまではいえない', '（部活の有無による差は、どの学年でも同じくらい）'),
                   ('組み合わせの効果（交互作用）があるといえる', '（部活の有無による差が、学年によってちがう）')]
    grades = ['1年', '2年', '3年']
    for panel, (club, no_club), heading, (main, extra) in zip(panels(2, top=180, height=450), TWO_WAY_CASES, headings, conclusions):
        c.frame(panel, heading)
        ys = Scale(0, 140, panel.bottom - 70, panel.y0 + 80)
        xs = [panel.x0 + 230 + i * 210 for i in range(3)]
        c.y_axis(ys, panel.x0 + 120, [0, 20, 40, 60, 80, 100, 120, 140], '勉強時間（分）', size=22)
        for x, grade in zip(xs, grades):
            c.text(x, panel.bottom - 28, grade, 28, weight=700)
        for means, color, light, offset in ((club, BLUE, '#a7d1fb', -16), (no_club, ORANGE, '#f6c08e', 16)):
            for i, mean in enumerate(means):
                values = integer_scores(mean, TWO_WAY_SD, TWO_WAY_N, high=200)
                for k, value in enumerate(values):
                    jitter = ((k * 3) % 5 - 2) * 5   # 縦一列に並ばないよう、少し左右にずらす
                    c.circle(xs[i] + offset + jitter, ys(min(value, 140)), 3.5, fill=light)
            c.polyline([(x + offset, ys(m)) for x, m in zip(xs, means)], stroke=color, width=5)
            for x, mean in zip(xs, means):
                c.circle(x + offset, ys(mean), 10, fill=color, stroke='#ffffff', width=3)
        c.conclude(panel, '二要因分散分析', main, extra)
    c.summary('二要因分散分析は、2つの要因それぞれの効果と、「組み合わせたときの効果（交互作用）」を調べる方法です', y=850)
    return c.to_svg()


FIGURES = {
    'ttest': ttest,
    'anova_one_way': anova_one_way,
    'anova_two_way': anova_two_way,
    'mann_whitney': mann_whitney,
    'kruskal_wallis': kruskal_wallis,
    'wilcoxon_signed_rank': wilcoxon_signed_rank,
}
