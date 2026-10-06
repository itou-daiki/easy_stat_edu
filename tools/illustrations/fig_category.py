"""人数・割合を比べる分析の説明イラスト（クロス集計・カイ二乗検定・フィッシャー・マクネマー）

表の中の人数は「1つの点＝1人」でも示す。図のデータは verify.py で実際に検定する。
"""
from __future__ import annotations

from svgkit import (BLUE, BLUE_WEAK, GRAY, INK, MUTED, ORANGE, ORANGE_WEAK, RULE, TINT, Canvas, Panel,
                    panels)

NOT_SAME = '（「同じ」とわかったわけではありません）'

# ---------------------------------------------------------------------------
# 図のデータ（verify.py からも使う）
# ---------------------------------------------------------------------------
CLUB_LABELS = ['運動部', '文化部', '入っていない']
CHI_SQUARE_TABLES = [
    [[20, 6, 4], [8, 16, 6]],      # 男子・女子 × 部活。割合が大きくちがう
    [[14, 11, 5], [13, 11, 6]],    # 割合がほぼ同じ
]
FISHER_TABLES = [
    [[7, 1], [1, 7]],              # 部活あり・なし × 合格・不合格（人数が少ない）
    [[5, 3], [4, 4]],
]
# マクネマー：行＝授業の前（わかる・わからない）、列＝授業の後（わかる・わからない）
MCNEMAR_TABLES = [
    [[12, 1], [11, 6]],
    [[12, 5], [6, 7]],
]
CROSS_TAB = [[22, 10, 8], [16, 12, 7], [8, 9, 8]]   # 1年・2年・3年 × 部活
GRADES = ['1年', '2年', '3年']
SEGMENT_COLORS = [(BLUE, '#ffffff'), (ORANGE, '#ffffff'), (GRAY, '#ffffff')]


def stacked_bar(c: Canvas, x: float, y: float, width: float, height: float, counts: list[int], *,
                show_percent: bool = True) -> None:
    """100%の帯グラフ。区切りごとに人数（と割合）を書く"""
    total = sum(counts)
    left = x
    for count, (color, text_color) in zip(counts, SEGMENT_COLORS):
        w = width * count / total
        c.rect(left, y, w, height, fill=color, stroke='#ffffff', width=2)
        if w > 46:
            label = f'{count}人'
            c.text(left + w / 2, y + height / 2 + (-2 if show_percent else 9), label, 24, weight=700, fill=text_color)
            if show_percent:
                c.text(left + w / 2, y + height / 2 + 26, f'{count / total * 100:.0f}%', 20, fill=text_color)
        left += w


def bar_legend(c: Canvas, x: float, y: float, labels: list[str]) -> None:
    for label, (color, _) in zip(labels, SEGMENT_COLORS):
        c.rect(x, y - 18, 22, 22, fill=color, stroke=None)
        c.text(x + 30, y, label, 22, anchor='start')
        x += 40 + 24 * len(label)


def dot_cell(c: Canvas, x: float, y: float, w: float, h: float, count: int, color: str, *,
             fill: str = '#ffffff', per_row: int = 6) -> None:
    """表の1マス。人数を数字と点（1つ＝1人）で示す"""
    c.rect(x, y, w, h, fill=fill, stroke=RULE, width=2)
    c.text(x + 16, y + 38, f'{count}人', 30, weight=700, anchor='start')
    r = 7
    for i in range(count):
        row, col = divmod(i, per_row)
        c.circle(x + w - 22 - col * (2 * r + 6), y + 30 + row * (2 * r + 6), r, fill=color)


# ---------------------------------------------------------------------------
# クロス集計
# ---------------------------------------------------------------------------
def cross_tabulation() -> str:
    c = Canvas('クロス集計：学年によって部活の入り方はちがうか')
    c.question('学年によって、部活の入り方はちがう？', '100人の例　学年と部活の2つの項目を組み合わせて、人数を数えます')
    left, right = panels(2, top=170, height=470)
    c.frame(left, '① 人数の表（クロス集計表）')
    col_x = [left.x0 + 150 + i * 135 for i in range(4)]
    header_y = left.y0 + 120
    for x, label in zip(col_x, CLUB_LABELS + ['合計']):
        c.text(x + 60, header_y, label, 24, weight=700)
    for row, (grade, counts) in enumerate(zip(GRADES, CROSS_TAB)):
        y = header_y + 30 + row * 80
        c.text(left.x0 + 60, y + 50, grade, 28, weight=700)
        for x, value in zip(col_x, counts + [sum(counts)]):
            c.rect(x, y, 120, 70, fill=TINT if value == sum(counts) else '#ffffff', stroke=RULE, width=2)
            c.text(x + 60, y + 48, f'{value}人', 28, weight=700)
    c.text(left.cx, left.bottom - 30, '学年ごとに人数がちがうので、このままでは比べにくい', 24, fill=MUTED)

    c.frame(right, '② 割合（％）にした帯グラフ')
    bar_x, bar_w = right.x0 + 110, right.w - 150
    for row, (grade, counts) in enumerate(zip(GRADES, CROSS_TAB)):
        y = right.y0 + 110 + row * 95
        c.text(right.x0 + 60, y + 44, grade, 28, weight=700)
        stacked_bar(c, bar_x, y, bar_w, 66, counts)
    bar_legend(c, right.x0 + 110, right.bottom - 70, CLUB_LABELS)
    c.text(right.cx, right.bottom - 22, '全体を100%にそろえると、学年どうしを比べやすい', 24, fill=MUTED)
    c.text(left.cx, left.bottom + 60, '3年生は「入っていない」の割合が大きい', 30, weight=700)
    c.text(right.cx, right.bottom + 60, '1年生は運動部の割合が大きい', 30, weight=700)
    c.summary('クロス集計は、2つの項目の組み合わせごとに人数を数えて表にまとめ、割合で比べやすくする方法です', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# カイ二乗検定
# ---------------------------------------------------------------------------
def chi_square() -> str:
    c = Canvas('カイ二乗検定：男子と女子で部活の選び方のちがいは、たしかなちがいといえるか')
    c.question('男子と女子で、部活の選び方のちがいは「たしかなちがい」といえる？',
               '左右は別の例です。どちらも男子30人・女子30人',
               '帯は全体を100%にした割合。中の数字は人数')
    headings = ('男子と女子で割合が大きくちがう', '男子と女子で割合がほぼ同じ')
    conclusions = [('性別と部活の選び方に関係があるといえる', None),
                   ('今回のデータでは、関係があるとまではいえない', NOT_SAME)]
    for panel, table, heading, (main, extra) in zip(panels(2, top=180, height=450), CHI_SQUARE_TABLES, headings, conclusions):
        c.frame(panel, heading)
        bar_x, bar_w = panel.x0 + 120, panel.w - 160
        for row, (label, counts) in enumerate(zip(('男子', '女子'), table)):
            y = panel.y0 + 100 + row * 120
            c.text(panel.x0 + 64, y + 50, label, 30, weight=700)
            stacked_bar(c, bar_x, y, bar_w, 80, counts)
        bar_legend(c, bar_x, panel.y0 + 360, CLUB_LABELS)
        c.text(panel.cx, panel.bottom - 24, '関係がない場合に予想される人数とのずれを計算します', 22, fill=MUTED)
        c.conclude(panel, 'カイ二乗検定', main, extra)
    c.summary('カイ二乗検定は、実際の人数が「関係がない場合に予想される人数」からどれだけずれているかで判断します', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 2×2の表を点で示す（フィッシャー・マクネマー共通）
# ---------------------------------------------------------------------------
def two_by_two(c: Canvas, panel: Panel, row_labels: list[str], col_labels: list[str], table: list[list[int]],
               colors: list[list[str]], fills: list[list[str]], *, row_title: str, col_title: str) -> None:
    cell_w, cell_h = 230, 120
    x0 = panel.cx - cell_w + 60
    y0 = panel.y0 + 135
    c.text(x0 + cell_w, y0 - 52, col_title, 24, weight=700, fill=MUTED)
    for j, label in enumerate(col_labels):
        c.text(x0 + j * cell_w + cell_w / 2, y0 - 14, label, 26, weight=700)
    c.text(x0 - 118, y0 - 14, row_title, 22, weight=700, fill=MUTED)
    for i, label in enumerate(row_labels):
        c.text(x0 - 16, y0 + i * cell_h + cell_h / 2 + 10, label, 26, weight=700, anchor='end')
        for j in range(2):
            dot_cell(c, x0 + j * cell_w, y0 + i * cell_h, cell_w, cell_h, table[i][j], colors[i][j], fill=fills[i][j])


def fisher_exact() -> str:
    c = Canvas('フィッシャーの正確確率検定：人数が少ないとき、部活の有無と合格のちがいはたしかなちがいといえるか')
    c.question('部活の有無と合格・不合格に、「たしかな関係」はある？',
               '左右は別の例です。どちらも16人（部活あり8人・部活なし8人）。点1つが1人',
               '人数が少ない（5人未満のマスがある）ときは、カイ二乗検定より正確なこの方法を使います')
    headings = ('合格の割合が大きくちがう', '合格の割合があまりちがわない')
    conclusions = [('部活の有無と合否に関係があるといえる', None),
                   ('今回のデータでは、関係があるとまではいえない', NOT_SAME)]
    colors = [[BLUE, ORANGE], [BLUE, ORANGE]]
    fills = [['#ffffff', '#ffffff'], ['#ffffff', '#ffffff']]
    for panel, table, heading, (main, extra) in zip(panels(2, top=180, height=450), FISHER_TABLES, headings, conclusions):
        c.frame(panel, heading)
        two_by_two(c, panel, ['部活あり', '部活なし'], ['合格', '不合格'], table, colors, fills,
                   row_title='', col_title='補習テストの結果')
        c.text(panel.cx, panel.bottom - 26, 'ありうる人数の分かれ方をすべて数えて、正確に計算します', 22, fill=MUTED)
        c.conclude(panel, 'フィッシャーの正確確率検定', main, extra)
    c.summary('フィッシャーの正確確率検定は、人数が少ない表でも正確に、2つの項目に関係があるかを調べる方法です', y=850)
    return c.to_svg()


def mcnemar() -> str:
    c = Canvas('マクネマー検定：授業の前と後で、わかると答えた人が増えたのはたしかな変化といえるか')
    c.question('授業の後に「わかる」が増えたのは、「たしかな変化」といえる？',
               '左右は別の例です。どちらも同じ30人に、授業の前と後で同じ質問をしました。点1つが1人',
               '注目するのは、答えが変わった人（色のついた2つのマス）だけです')
    headings = ('「わかる」に変わった人がずっと多い', '変わった人の数が同じくらい')
    conclusions = [('「わかる」が増えたといえる', None),
                   ('今回のデータでは、変化があるとまではいえない', NOT_SAME)]
    colors = [[GRAY, ORANGE], [BLUE, GRAY]]
    fills = [['#ffffff', ORANGE_WEAK], [BLUE_WEAK, '#ffffff']]
    for panel, table, heading, (main, extra) in zip(panels(2, top=180, height=450), MCNEMAR_TABLES, headings, conclusions):
        c.frame(panel, heading)
        two_by_two(c, panel, ['わかる', 'わからない'], ['わかる', 'わからない'], table, colors, fills,
                   row_title='授業の前', col_title='授業の後')
        to_yes, to_no = table[1][0], table[0][1]
        c.text(panel.cx, panel.bottom - 26, f'わかるに変わった {to_yes}人　と　わからないに変わった {to_no}人 を比べる', 22,
               weight=700, fill=INK)
        c.conclude(panel, 'マクネマー検定', main, extra)
    c.summary('マクネマー検定は、同じ人の前と後で答えが変わった人だけに注目して、変化の向きにかたよりがあるかを調べます', y=850)
    return c.to_svg()


FIGURES = {
    'cross_tabulation': cross_tabulation,
    'chi_square': chi_square,
    'fisher_exact': fisher_exact,
    'mcnemar': mcnemar,
}

