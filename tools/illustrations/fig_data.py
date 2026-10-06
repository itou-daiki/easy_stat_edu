"""データの全体像・下準備・まとめる分析の説明イラスト
（探索的データ分析・データ加工・データ結合・因子得点・因子分析・テキストマイニング・分析サポーター）
"""
from __future__ import annotations

from svgkit import (BLUE, BLUE_TEXT, BLUE_WEAK, GRAY, INK, MUTED, ORANGE, ORANGE_TEXT, ORANGE_WEAK, RULE, TINT,
                    Canvas, Panel, Scale, dot_strip, integer_scores, panels)

# ---------------------------------------------------------------------------
# 図のデータ（verify.py からも使う）
# ---------------------------------------------------------------------------
EDA_SCORES = sorted(integer_scores(64, 11, 29) + [12])   # 1人だけ極端に低い（外れ値）

FACTOR_SCORE_ROWS = [('Aさん', [5, 4, 1]), ('Bさん', [3, 3, 3]), ('Cさん', [2, 1, 4])]
SCALE_MAX = 5

FACTOR_QUESTIONS = ['Q1 授業が楽しい', 'Q2 もっと知りたい', 'Q3 自分で調べる',
                    'Q4 テストが不安', 'Q5 失敗がこわい', 'Q6 発表が苦手']
FACTOR_NAMES = ['学ぶ意欲', '不安']
FACTOR_LOADINGS = [[0.82, 0.05], [0.76, -0.08], [0.71, 0.10], [0.03, 0.80], [-0.06, 0.74], [0.12, 0.66]]

WORD_COUNTS = [('楽しい', 12), ('わかりやすい', 9), ('タブレット', 8), ('調べる', 6), ('むずかしい', 5)]


def quartiles(values: list[float]) -> tuple[float, float, float]:
    """第1四分位・中央値・第3四分位（線形補間。表計算ソフトの QUARTILE.INC と同じ）"""
    data = sorted(values)

    def q(p: float) -> float:
        pos = (len(data) - 1) * p
        low = int(pos)
        frac = pos - low
        return data[low] + (data[min(low + 1, len(data) - 1)] - data[low]) * frac
    return q(0.25), q(0.5), q(0.75)


def table(c: Canvas, x: float, y: float, headers: list[str], rows: list[list[str]], widths: list[float], *,
          height: float = 56, marks: dict[tuple[int, int], str] | None = None, size: int = 24,
          header_size: int | None = None) -> None:
    """簡単な表。marks に (行, 列) と背景色を渡すとそのマスを色づけする"""
    marks = marks or {}
    cx = x
    for header, w in zip(headers, widths):
        c.rect(cx, y, w, height, fill=TINT, stroke=RULE, width=2)
        c.text(cx + w / 2, y + height / 2 + 9, header, header_size or size, weight=700)
        cx += w
    for i, row in enumerate(rows):
        cx = x
        for j, (cell, w) in enumerate(zip(row, widths)):
            c.rect(cx, y + (i + 1) * height, w, height, fill=marks.get((i, j), '#ffffff'), stroke=RULE, width=2)
            c.text(cx + w / 2, y + (i + 1) * height + height / 2 + 9, cell, size)
            cx += w


# ---------------------------------------------------------------------------
# 探索的データ分析（EDA）
# ---------------------------------------------------------------------------
def eda() -> str:
    c = Canvas('探索的データ分析：クラスの数学の点数はどんなふうに散らばっているか')
    c.question('クラスの数学の点数は、どんなふうに散らばっている？', '30人の例。左右は同じデータを2つのグラフで表しています')
    left, right = panels(2, top=170, height=470)
    mean = sum(EDA_SCORES) / len(EDA_SCORES)
    q1, median, q3 = quartiles(EDA_SCORES)
    iqr = q3 - q1
    low_fence = q1 - 1.5 * iqr
    outliers = [v for v in EDA_SCORES if v < low_fence or v > q3 + 1.5 * iqr]
    inside = [v for v in EDA_SCORES if v not in outliers]

    c.frame(left, '点1つが1人のグラフ（ドットプロット）')
    scale = Scale(0, 100, left.x0 + 60, left.right - 40)
    axis_y = left.bottom - 90
    dot_strip(c, EDA_SCORES, scale, axis_y - 6, BLUE, bin_width=3, dot=14)
    c.line(scale(mean), left.y0 + 120, scale(mean), axis_y, stroke=ORANGE, width=3, dash='8 6')
    c.text(scale(mean) - 8, left.y0 + 112, f'平均 {mean:.1f}点', 24, weight=700, fill=ORANGE_TEXT, anchor='end')
    c.line(scale(median), left.y0 + 150, scale(median), axis_y, stroke=INK, width=3, dash='3 5')
    c.text(scale(median) + 8, left.y0 + 142, f'中央値 {median:g}点', 24, weight=700, anchor='start')
    c.text(scale(outliers[0]), axis_y - 40, '外れ値？', 22, weight=700, fill=ORANGE_TEXT)
    c.x_axis(scale, axis_y, list(range(0, 101, 10)), '点数（点）')

    c.frame(right, '箱ひげ図')
    scale_r = Scale(0, 100, right.x0 + 60, right.right - 40)
    axis_r = right.bottom - 90
    box_y, box_h = right.y0 + 200, 90
    mid = box_y + box_h / 2
    c.line(scale_r(min(inside)), mid, scale_r(q1), mid, width=3)
    c.line(scale_r(q3), mid, scale_r(max(inside)), mid, width=3)
    for v in (min(inside), max(inside)):
        c.line(scale_r(v), mid - 24, scale_r(v), mid + 24, width=3)
    c.rect(scale_r(q1), box_y, scale_r(q3) - scale_r(q1), box_h, fill=BLUE_WEAK, stroke=BLUE, width=3)
    c.line(scale_r(median), box_y, scale_r(median), box_y + box_h, stroke=INK, width=4)
    for v in outliers:
        c.circle(scale_r(v), mid, 8, fill='#ffffff', stroke=ORANGE, width=3)
    labels = [(min(inside), '最小値', 'below', 'middle'), (q1, '第1四分位', 'above', 'end'),
              (median, '中央値', 'below', 'middle'), (q3, '第3四分位', 'above', 'start'), (max(inside), '最大値', 'below', 'middle')]
    for v, label, place, anchor in labels:
        y = box_y - 18 if place == 'above' else box_y + box_h + 38
        x = scale_r(v) + (-4 if anchor == 'end' else 4 if anchor == 'start' else 0)
        c.text(x, y, f'{label} {v:g}', 20, weight=700, anchor=anchor)
    c.text(scale_r(outliers[0]), box_y - 18, '外れ値', 20, weight=700, fill=ORANGE_TEXT)
    c.text(right.cx, right.y0 + 120, '真ん中の半分（15人）が箱の中に入る', 24, fill=MUTED)
    c.x_axis(scale_r, axis_r, list(range(0, 101, 10)), '点数（点）')

    c.text(left.cx, left.bottom + 54, '山の形・平均・中央値・外れ値がわかる', 30, weight=700)
    c.text(right.cx, right.bottom + 54, 'ばらつきと外れ値を、コンパクトに比べられる', 30, weight=700)
    c.summary('分析の前に、平均・中央値・ばらつき・外れ値をグラフで確かめておくと、あとの分析を正しく読めます', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# データ加工・整形
# ---------------------------------------------------------------------------
def data_processing() -> str:
    c = Canvas('データ加工・整形：このデータはそのまま分析して大丈夫か')
    c.question('このデータ、そのまま分析して大丈夫？', 'アンケートを入力した表の例')
    left, right = panels(2, top=170, height=470)
    headers = ['番号', '性別', '数学（点）']
    widths = [130, 200, 230]
    messy = [['1', '男', '72'], ['2', '男性', '６５'], ['3', '女', ''], ['4', 'じょし', '81'], ['5', '女', '999']]
    clean = [['1', '男', '72'], ['2', '男', '65'], ['3', '女', '（空欄）'], ['4', '女', '81'], ['5', '女', '要確認']]
    marks = {(1, 1): ORANGE_WEAK, (1, 2): ORANGE_WEAK, (2, 2): ORANGE_WEAK, (3, 1): ORANGE_WEAK, (4, 2): ORANGE_WEAK}
    fixed = {k: BLUE_WEAK for k in marks}
    c.frame(left, '入力したままの表')
    table(c, left.x0 + 40, left.y0 + 74, headers, messy, widths, height=50)
    c.text(left.cx, left.bottom - 50, '「男性」「じょし」は表記がばらばら　「６５」は全角', 22, fill=ORANGE_TEXT, weight=700)
    c.text(left.cx, left.bottom - 18, '空欄は答えていない人　「999」はありえない値', 22, fill=ORANGE_TEXT, weight=700)

    c.frame(right, '整えた表')
    table(c, right.x0 + 40, right.y0 + 74, headers, clean, widths, marks=fixed, height=50)
    c.text(right.cx, right.bottom - 50, '表記をそろえ、数字を半角に。空欄は「欠損値」として扱う', 22, fill=BLUE_TEXT, weight=700)
    c.text(right.cx, right.bottom - 18, 'ありえない値は、元のアンケートを見て確かめる', 22, fill=BLUE_TEXT, weight=700)
    c.arrow(left.right + 4, left.y0 + 230, right.x0 - 4, left.y0 + 230, width=4, head=14)
    c.text(left.cx, left.bottom + 54, 'このままだと、男・男性が別のグループになる', 30, weight=700)
    c.text(right.cx, right.bottom + 54, '正しく集計・分析できる', 30, weight=700)
    c.summary('分析の前に、表記のゆれ・全角の数字・空欄・ありえない値を整えておくと、結果が正しくなります', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# データ結合
# ---------------------------------------------------------------------------
def data_merge() -> str:
    c = Canvas('データ結合：別々のファイルの点数を1つの表にまとめる')
    c.question('別々のファイルの点数を、1つの表にまとめたい', '出席番号のように「同じ人を表す列」を目印にして、横につなげます')
    left, right = panels(2, top=170, height=470)
    c.frame(left, '2つのファイル')
    file_a = [['3', '58'], ['1', '72'], ['2', '65']]
    file_b = [['1', '80'], ['2', '61'], ['3', '77']]
    ax, bx, ty = left.x0 + 40, left.x0 + 420, left.y0 + 120
    c.text(ax + 140, ty - 18, 'ファイルA', 24, weight=700, fill=BLUE_TEXT)
    c.text(bx + 140, ty - 18, 'ファイルB', 24, weight=700, fill=ORANGE_TEXT)
    table(c, ax, ty, ['番号', '数学'], file_a, [120, 160])
    table(c, bx, ty, ['番号', '英語'], file_b, [120, 160])
    h = 56
    for i, (number, _) in enumerate(file_a):
        j = [row[0] for row in file_b].index(number)
        c.line(ax + 280, ty + (i + 1.5) * h, bx, ty + (j + 1.5) * h, stroke=GRAY, width=3)
    c.text(left.cx, left.bottom - 30, '並び順がちがっても、番号が同じ行どうしをつなぐ', 22, fill=MUTED)

    c.frame(right, 'まとめた表')
    merged = [['1', '72', '80'], ['2', '65', '61'], ['3', '58', '77']]
    table(c, right.x0 + 120, ty, ['番号', '数学', '英語'], merged, [140, 160, 160],
          marks={(i, 1): BLUE_WEAK for i in range(3)} | {(i, 2): ORANGE_WEAK for i in range(3)})
    c.arrow(left.right + 4, ty + 140, right.x0 - 4, ty + 140, width=4, head=14)
    c.text(right.cx, right.bottom - 30, '1人1行になったので、数学と英語の関係なども分析できる', 22, fill=MUTED)
    c.text(left.cx, left.bottom + 54, '同じ人を表す「番号」が目印', 30, weight=700)
    c.text(right.cx, right.bottom + 54, '1人の情報が1行にそろう', 30, weight=700)
    c.summary('データ結合は、「同じ人を表す列」を目印にして、別々のファイルを1つの表にまとめる機能です', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 因子得点算出
# ---------------------------------------------------------------------------
def factor_score() -> str:
    c = Canvas('因子得点算出：似た質問の答えをまとめて1人1つの得点にする')
    c.question('似た質問の答えをまとめて、1人1つの得点にしたい', '「学ぶ意欲」をたずねる3つの質問（5段階：1 まったくちがう 〜 5 とてもそう思う）')
    panel = Panel(40, 170, 1520, 590)
    c.frame(panel)
    headers = ['', 'Q1 楽しい', 'Q2 知りたい', 'Q3 興味がない']
    rows = [[name] + [str(v) for v in values] for name, values in FACTOR_SCORE_ROWS]
    x0, y0 = panel.x0 + 30, panel.y0 + 140
    c.text(x0 + 290, y0 - 30, '① 答えの表', 28, weight=700, anchor='middle')
    table(c, x0, y0, headers, rows, [100, 150, 150, 180], height=70, size=26, header_size=21,
          marks={(i, 3): ORANGE_WEAK for i in range(3)})
    c.text(x0 + 290, y0 + 330, 'Q3 は反対向きの質問（そう思うほど意欲が低い）', 22, fill=ORANGE_TEXT, weight=700)

    x1 = panel.x0 + 690
    c.arrow(x0 + 590, y0 + 160, x1 - 10, y0 + 160, width=4, head=14)
    c.text(x1 + 165, y0 - 30, '② 向きをそろえる', 28, weight=700)
    reversed_rows = [[name, str(v[0]), str(v[1]), str(SCALE_MAX + 1 - v[2])] for name, v in FACTOR_SCORE_ROWS]
    table(c, x1, y0, ['', 'Q1', 'Q2', 'Q3（逆転）'], reversed_rows, [100, 70, 70, 140], height=70, size=26,
          header_size=21, marks={(i, 3): BLUE_WEAK for i in range(3)})
    c.text(x1 + 180, y0 + 330, f'Q3 は「{SCALE_MAX + 1} − 答え」に直す', 22, fill=BLUE_TEXT, weight=700)

    x2 = panel.x0 + 1140
    c.arrow(x1 + 390, y0 + 160, x2 - 10, y0 + 160, width=4, head=14)
    c.text(x2 + 160, y0 - 30, '③ 平均して1つの得点に', 28, weight=700)
    score_rows = []
    for name, values in FACTOR_SCORE_ROWS:
        adjusted = [values[0], values[1], SCALE_MAX + 1 - values[2]]
        score_rows.append([name, f'{sum(adjusted) / 3:.2f}'])
    table(c, x2, y0, ['', '学ぶ意欲の得点'], score_rows, [100, 220], height=70, size=26,
          marks={(i, 1): BLUE_WEAK for i in range(3)})
    c.text(x2 + 160, y0 + 330, 't検定などの分析に使える', 22, fill=MUTED, weight=700)
    c.summary('因子得点算出は、同じことをたずねる質問の向きをそろえてから平均し、1人1つの得点をつくる機能です', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 因子分析
# ---------------------------------------------------------------------------
def factor_analysis() -> str:
    c = Canvas('因子分析：アンケートの質問の裏に共通するテーマはあるか')
    c.question('6つの質問の裏に、共通する「テーマ」はある？',
               '線の太さ＝つながりの強さ（因子負荷量）。数値は説明のための例です')
    panel = Panel(40, 170, 1520, 570)
    c.frame(panel)
    qx, fx = panel.x0 + 200, panel.x0 + 1100
    q_y = [panel.y0 + 70 + i * 72 for i in range(6)]
    f_y = [panel.y0 + 160, panel.y0 + 380]
    colors = [(BLUE, BLUE_TEXT, BLUE_WEAK), (ORANGE, ORANGE_TEXT, ORANGE_WEAK)]
    for i, (question, loadings) in enumerate(zip(FACTOR_QUESTIONS, FACTOR_LOADINGS)):
        for k, loading in enumerate(loadings):
            if abs(loading) < 0.3:
                continue
            color = colors[k][0]
            c.line(qx + 230, q_y[i], fx - 110, f_y[k], stroke=color, width=2 + abs(loading) * 12)
            t = 0.12   # 線の始まり近く（線どうしが離れている所）に数値を置く
            lx = qx + 230 + (fx - 110 - qx - 230) * t
            ly = q_y[i] + (f_y[k] - q_y[i]) * t
            c.text(lx + 6, ly - 14, f'{loading:.2f}', 22, weight=700, fill=colors[k][1], anchor='start')
    for i, question in enumerate(FACTOR_QUESTIONS):
        c.rect(qx - 30, q_y[i] - 30, 260, 60, fill='#ffffff', stroke=INK, width=2, radius=4)
        c.text(qx + 100, q_y[i] + 9, question, 24, weight=700)
    for k, name in enumerate(FACTOR_NAMES):
        c.body.append(f'<ellipse cx="{fx + 30}" cy="{f_y[k]}" rx="140" ry="62" fill="{colors[k][2]}" '
                      f'stroke="{colors[k][0]}" stroke-width="4"/>')
        c.text(fx + 30, f_y[k] + 12, name, 34, weight=700, fill=colors[k][1])
    c.text(fx + 30, panel.bottom - 30, '因子（共通するテーマ）', 24, weight=700, fill=MUTED)
    c.text(qx + 100, panel.bottom - 30, '質問（アンケート項目）', 24, weight=700, fill=MUTED)
    c.summary('因子分析は、答え方が似ている質問をまとめて、その裏にある共通のテーマ（因子）を見つける方法です', y=820)
    return c.to_svg()


# ---------------------------------------------------------------------------
# テキストマイニング
# ---------------------------------------------------------------------------
def text_mining() -> str:
    c = Canvas('テキストマイニング：アンケートの感想にはどんな言葉が多いか')
    c.question('アンケートの感想には、どんな言葉が多い？', '30人の自由記述の例')
    left, right = panels(2, top=170, height=470)
    c.frame(left, '① 文章を単語に分ける')
    sentences = [('タブレットで調べるのが', '楽しい'), ('説明が', 'わかりやすい'), ('タブレットの操作が', 'むずかしい')]
    for i, (body, word) in enumerate(sentences):
        y = left.y0 + 110 + i * 110
        c.rect(left.x0 + 40, y, left.w - 80, 80, fill=TINT, stroke=RULE, width=2, radius=6)
        c.text(left.x0 + 70, y + 50, f'「{body}{word}」', 28, anchor='start')
    c.text(left.cx, left.bottom - 30, '「タブレット」「調べる」「楽しい」…のように単語を取り出して数える', 22, fill=MUTED)

    c.frame(right, '② よく出る言葉のランキング')
    scale = Scale(0, 14, right.x0 + 230, right.right - 70)
    for i, (word, count) in enumerate(WORD_COUNTS):
        y = right.y0 + 95 + i * 66
        c.text(right.x0 + 210, y + 32, word, 26, weight=700, anchor='end')
        c.rect(scale(0), y, scale(count) - scale(0), 44, fill=BLUE if i < 3 else '#9fc9f3', stroke=None)
        c.text(scale(count) + 10, y + 32, f'{count}回', 24, weight=700, anchor='start')
    c.arrow(left.right + 4, left.y0 + 230, right.x0 - 4, left.y0 + 230, width=4, head=14)
    c.text(left.cx, left.bottom + 54, '1つずつ読むだけでは全体がつかみにくい', 30, weight=700)
    c.text(right.cx, right.bottom + 54, '多くの人が感じていることが見えてくる', 30, weight=700)
    c.summary('テキストマイニングは、文章を単語に分けて数え、よく出る言葉や一緒に出る言葉から傾向を読み取る方法です', y=850)
    return c.to_svg()


# ---------------------------------------------------------------------------
# 分析サポーター
# ---------------------------------------------------------------------------
def analysis_support() -> str:
    c = Canvas('分析サポーター：どの分析を使えばいいかを選ぶ')
    c.question('どの分析を使えばいいか、わからない…', 'まず「何を調べたいか」を決めると、使う分析が決まってきます')
    panel = Panel(40, 170, 1520, 560)
    c.frame(panel)
    root = (panel.x0 + 170, panel.y0 + 280)
    c.rect(root[0] - 130, root[1] - 50, 260, 100, fill=BLUE_WEAK, stroke=BLUE, width=3, radius=6)
    c.text(root[0], root[1] + 12, '何を調べたい？', 32, weight=700)
    branches = [
        ('平均を比べたい', '例：1組と2組の平均点', 't検定・分散分析など'),
        ('関係を見たい', '例：勉強時間と点数', '相関分析・回帰分析など'),
        ('人数の割合を比べたい', '例：男女と部活の種類', 'カイ二乗検定など'),
        ('全体の様子を見たい', '例：点数の散らばり', '探索的データ分析など'),
    ]
    for i, (goal, example, method) in enumerate(branches):
        y = panel.y0 + 80 + i * 132
        c.line(root[0] + 130, root[1], 480, y, stroke=GRAY, width=3)
        c.rect(480, y - 46, 380, 92, fill='#ffffff', stroke=INK, width=2, radius=6)
        c.text(670, y - 4, goal, 28, weight=700)
        c.text(670, y + 30, example, 20, fill=MUTED)
        c.arrow(866, y, 1010, y, stroke=GRAY, width=3, head=12)
        c.rect(1015, y - 40, 470, 80, fill=TINT, stroke=RULE, width=2, radius=6)
        c.text(1250, y + 10, method, 28, weight=700, fill=BLUE_TEXT)
    c.summary('初学者モードでは、質問に答えるだけで、データの前提（正規分布かなど）も確かめて分析を選びます', y=800)
    return c.to_svg()


FIGURES = {
    'eda': eda,
    'data_processing': data_processing,
    'data_merge': data_merge,
    'factor_score': factor_score,
    'factor_analysis': factor_analysis,
    'text_mining': text_mining,
    'analysis_support': analysis_support,
}
