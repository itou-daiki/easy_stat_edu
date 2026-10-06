"""数値どうしの関係・予測を調べる分析の説明イラスト
（相関・単回帰・重回帰・ロジスティック回帰・主成分分析・時系列）
"""
from __future__ import annotations

import math

from svgkit import (BLUE, BLUE_TEXT, BLUE_WEAK, INK, MUTED, ORANGE, ORANGE_TEXT, RULE, Canvas, Panel, Scale,
                    correlated_pairs, normal_scores, panels, pearson_r, shuffled_order)

# ---------------------------------------------------------------------------
# 図のデータ（verify.py からも使う）
# ---------------------------------------------------------------------------
CORRELATION_RS = (0.8, 0.0, -0.7)


def study_and_score(r: float, seed: int, n: int = 30) -> list[tuple[float, float]]:
    """1週間の勉強時間（時間）とテストの点数の組"""
    return [(max(0.5, min(15.5, 8 + 3 * x)), max(5, min(98, 60 + 15 * y)))
            for x, y in correlated_pairs(n, r, seed)]


def ols(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """最小二乗法の直線 y = slope * x + intercept"""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return slope, my - slope * mx


def multiple_regression_data(n: int = 120) -> tuple[list[list[float]], list[float]]:
    """勉強時間・睡眠時間・スマホ時間 → 点数（標準化した値）"""
    base = normal_scores(n)
    x1 = [base[i] for i in shuffled_order(n, 11)]
    x2 = [base[i] for i in shuffled_order(n, 23)]
    x3 = [base[i] for i in shuffled_order(n, 37)]
    noise = [base[i] for i in shuffled_order(n, 53)]
    y = [0.5 * a + 0.2 * b - 0.35 * c + 0.7 * e for a, b, c, e in zip(x1, x2, x3, noise)]
    return [x1, x2, x3], y


def standardized_betas(xs: list[list[float]], y: list[float]) -> list[float]:
    """標準化偏回帰係数（正規方程式をガウスの消去法で解く）"""
    def standardize(values: list[float]) -> list[float]:
        m = sum(values) / len(values)
        sd = math.sqrt(sum((v - m) ** 2 for v in values) / (len(values) - 1))
        return [(v - m) / sd for v in values]
    zx = [standardize(x) for x in xs]
    zy = standardize(y)
    k = len(zx)
    a = [[sum(p * q for p, q in zip(zx[i], zx[j])) for j in range(k)] + [sum(p * q for p, q in zip(zx[i], zy))]
         for i in range(k)]
    for col in range(k):
        pivot = a[col][col]
        a[col] = [v / pivot for v in a[col]]
        for row in range(k):
            if row != col:
                factor = a[row][col]
                a[row] = [v - factor * w for v, w in zip(a[row], a[col])]
    return [a[i][k] for i in range(k)]


def logistic_data(n: int = 40) -> list[tuple[float, int]]:
    """1日の勉強時間（時間）と合否（1＝合格）。勉強時間が長いほど合格しやすい"""
    hours = [0.2 + 5.6 * i / (n - 1) for i in range(n)]
    thresholds = [(i + 0.5) / n for i in shuffled_order(n, 7)]
    return [(h, 1 if thresholds[i] < 1 / (1 + math.exp(-(1.6 * h - 4.0))) else 0) for i, h in enumerate(hours)]


def fit_logistic(data: list[tuple[float, int]]) -> tuple[float, float]:
    """ロジスティック回帰（ニュートン法）。戻り値は (切片, 傾き)"""
    b0, b1 = 0.0, 0.0
    for _ in range(50):
        g0 = g1 = h00 = h01 = h11 = 0.0
        for x, y in data:
            p = 1 / (1 + math.exp(-(b0 + b1 * x)))
            g0 += y - p
            g1 += (y - p) * x
            w = p * (1 - p)
            h00 += w
            h01 += w * x
            h11 += w * x * x
        det = h00 * h11 - h01 * h01
        b0 += (h11 * g0 - h01 * g1) / det
        b1 += (-h01 * g0 + h00 * g1) / det
    return b0, b1


def pca_data(n: int = 50) -> list[tuple[float, float]]:
    """国語と英語の点数（相関0.8）"""
    return [(62 + 12 * x, 58 + 13 * y) for x, y in correlated_pairs(n, 0.8, 19)]


def pca_axes(points: list[tuple[float, float]]) -> tuple[tuple[float, float], list[tuple[float, tuple[float, float]]]]:
    """平均と、(固有値, 単位ベクトル) を大きい順に返す"""
    n = len(points)
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    sxx = sum((p[0] - mx) ** 2 for p in points) / (n - 1)
    syy = sum((p[1] - my) ** 2 for p in points) / (n - 1)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in points) / (n - 1)
    trace, det = sxx + syy, sxx * syy - sxy * sxy
    root = math.sqrt(trace * trace / 4 - det)
    result = []
    for value in (trace / 2 + root, trace / 2 - root):
        vx, vy = (value - syy, sxy) if abs(sxy) > 1e-12 else ((1.0, 0.0) if sxx >= syy else (0.0, 1.0))
        length = math.hypot(vx, vy)
        result.append((value, (vx / length, vy / length)))
    return (mx, my), result


MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月']


def library_visitors() -> list[float]:
    """図書室の月ごとの利用者数（2年分）。少しずつ増える傾向＋季節の上下＋小さなゆれ"""
    season = [0, 10, 5, -25, -60, 0, 8, 15, -10, 25, 30, -20]
    wobble = [6, -8, 4, -5, 9, -3, -7, 5, -4, 8, -6, 3]
    return [180 + 2.5 * i + season[i % 12] + wobble[(i * 5) % 12] for i in range(24)]


def moving_average(values: list[float], window: int = 3) -> list[float | None]:
    half = window // 2
    return [sum(values[i - half:i + half + 1]) / window if half <= i < len(values) - half else None
            for i in range(len(values))]


# ---------------------------------------------------------------------------
# 相関分析
# ---------------------------------------------------------------------------
def correlation() -> str:
    c = Canvas('相関分析：勉強時間が長い人ほどテストの点数も高いか')
    c.question('勉強時間が長い人ほど、テストの点数も高い？', '●＝1人　30人の例　r は相関係数（−1 から 1）')
    captions = [('右上がり', '→ 正の相関（r はプラス）'), ('決まった形がない', '→ 相関はほとんどない'),
                ('右下がり', '→ 負の相関（r はマイナス）')]
    for index, (panel, r, (line1, line2)) in enumerate(zip(panels(3), CORRELATION_RS, captions)):
        data = study_and_score(r, seed=5 + index)
        r_value = pearson_r(data)
        c.frame(panel, f'r = {0.0 if abs(r_value) < 0.005 else r_value:.2f}')
        xs = Scale(0, 16, panel.x0 + 95, panel.right - 30)
        ys = Scale(0, 100, panel.bottom - 75, panel.y0 + 90)
        c.y_axis(ys, xs.r0, [0, 50, 100], '点数', size=22)
        c.x_axis(xs, ys.r0, [0, 4, 8, 12, 16], '勉強時間（時間/週）', size=22)
        color = (BLUE, MUTED, ORANGE)[index]
        for x, y in data:
            c.circle(xs(x), ys(y), 7, fill=color)
        c.caption(panel, line1, line2, size=28)
    c.summary('相関は、2つの数値が一緒に増えたり減ったりする強さを表します。相関があっても、一方が原因とは限りません')
    return c.to_svg()


# ---------------------------------------------------------------------------
# 単回帰分析
# ---------------------------------------------------------------------------
def regression_simple() -> str:
    c = Canvas('単回帰分析：勉強時間からテストの点数を予測できるか')
    c.question('勉強時間から、テストの点数を予測できる？', '●＝1人　30人の例')
    data = study_and_score(0.75, seed=3)
    xs_data, ys_data = [d[0] for d in data], [d[1] for d in data]
    slope, intercept = ols(xs_data, ys_data)
    panel = Panel(40, 160, 960, 600)
    c.frame(panel)
    xs = Scale(0, 16, panel.x0 + 110, panel.right - 40)
    ys = Scale(0, 100, panel.bottom - 80, panel.y0 + 50)
    c.y_axis(ys, xs.r0, [0, 20, 40, 60, 80, 100], '点数（点）')
    c.x_axis(xs, ys.r0, [0, 2, 4, 6, 8, 10, 12, 14, 16], '勉強時間（時間/週）')
    for x, y in data:
        c.circle(xs(x), ys(y), 7, fill=BLUE)
    c.line(xs(0), ys(intercept), xs(16), ys(intercept + 16 * slope), stroke=INK, width=4)
    # 10時間なら？
    hours = 10
    predicted = intercept + slope * hours
    c.line(xs(hours), ys(0), xs(hours), ys(predicted), stroke=ORANGE, width=3, dash='8 6')
    c.line(xs(0), ys(predicted), xs(hours), ys(predicted), stroke=ORANGE, width=3, dash='8 6')
    c.circle(xs(hours), ys(predicted), 9, fill=ORANGE)
    c.text(xs(0) + 10, ys(predicted) - 12, f'予測 約{predicted:.0f}点', 26, weight=700, fill=ORANGE_TEXT, anchor='start')
    # 予測とのずれ（残差）が大きい人を1人示す
    worst = max(data, key=lambda d: abs(d[1] - (intercept + slope * d[0])))
    fitted = intercept + slope * worst[0]
    c.line(xs(worst[0]), ys(worst[1]), xs(worst[0]), ys(fitted), stroke=MUTED, width=3, dash='4 5')
    c.text(xs(worst[0]) + 12, (ys(worst[1]) + ys(fitted)) / 2 + 8, '予測とのずれ', 22, weight=700, fill=MUTED, anchor='start')

    x0 = 1050
    c.text(x0, 230, '① 点の近くを通る直線を引く', 30, weight=700, anchor='start')
    c.text(x0, 330, '② 直線の式を求める', 30, weight=700, anchor='start')
    c.text(x0 + 30, 380, f'点数 ＝ {slope:.1f} × 勉強時間 ＋ {intercept:.0f}', 28, fill=BLUE_TEXT, weight=700, anchor='start')
    c.text(x0, 480, '③ 勉強時間から点数を予測する', 30, weight=700, anchor='start')
    c.text(x0 + 30, 530, f'例：週{hours}時間 → 約{predicted:.0f}点', 28, fill=ORANGE_TEXT, weight=700, anchor='start')
    c.text(x0, 630, '※ 予測はあくまで平均的な目安。', 24, fill=MUTED, anchor='start')
    c.text(x0, 666, '　 一人ひとりにはずれがあります', 24, fill=MUTED, anchor='start')
    c.summary('単回帰分析は、1つの数値から別の数値を予測する「直線の式」を求める方法です')
    return c.to_svg()


# ---------------------------------------------------------------------------
# 重回帰分析
# ---------------------------------------------------------------------------
def regression_multiple() -> str:
    c = Canvas('重回帰分析：テストの点数に関係しているのはどの要因か')
    c.question('テストの点数に関係しているのは、どの要因？', '120人の例　β（ベータ）＝ほかの要因をそろえたときの関係の強さ')
    xs, y = multiple_regression_data()
    betas = standardized_betas(xs, y)
    names = ['勉強時間', '睡眠時間', 'スマホ時間']
    target = (1180, 470)
    c.rect(1080, 410, 300, 120, fill=BLUE_WEAK, stroke=BLUE, width=3, radius=6)
    c.text(1230, 482, 'テストの点数', 34, weight=700)
    for index, (name, beta) in enumerate(zip(names, betas)):
        y0 = 250 + index * 220
        c.rect(220, y0 - 55, 300, 110, fill='#ffffff', stroke=INK, width=3, radius=6)
        c.text(370, y0 + 12, name, 34, weight=700)
        color, text_color = (BLUE, BLUE_TEXT) if beta > 0 else (ORANGE, ORANGE_TEXT)
        end_y = target[1] + (index - 1) * 30
        c.arrow(520, y0, 1075, end_y, stroke=color, width=4 + abs(beta) * 30, head=22)
        sign = '＋' if beta > 0 else '－'
        label = f'β ＝ {beta:+.2f}　{sign}の関係'
        # 矢印が上向きなら下側、下向き・水平なら上側にラベルを置いて線と重ならないようにする
        c.text(560, y0 + 50 if end_y < y0 else y0 - 24, label, 28, weight=700, fill=text_color, anchor='start')
    c.text(1230, 600, '矢印が太いほど関係が強い', 26, fill=MUTED)
    c.text(1230, 640, '青：増えると点数も上がる', 26, fill=BLUE_TEXT, weight=700)
    c.text(1230, 680, 'オレンジ：増えると点数が下がる', 26, fill=ORANGE_TEXT, weight=700)
    c.summary('重回帰分析は、ほかの要因をそろえたうえで、各要因と結果の関係の強さを調べます。関係＝原因とは限りません')
    return c.to_svg()


# ---------------------------------------------------------------------------
# ロジスティック回帰分析
# ---------------------------------------------------------------------------
def logistic_regression() -> str:
    c = Canvas('ロジスティック回帰分析：勉強時間が長いと合格する確率は上がるか')
    c.question('勉強時間が長いほど、合格する確率は上がる？', '●＝1人　40人の例　上の列：合格　下の列：不合格')
    data = logistic_data()
    b0, b1 = fit_logistic(data)
    panel = Panel(40, 160, 960, 600)
    c.frame(panel)
    xs = Scale(0, 6, panel.x0 + 130, panel.right - 40)
    ys = Scale(0, 1, panel.bottom - 80, panel.y0 + 60)
    c.y_axis(ys, xs.r0, [0, 0.25, 0.5, 0.75, 1], tick_labels=['0%', '25%', '50%', '75%', '100%'])
    c.text(xs.r0, ys.r1 - 26, '合格する確率', 24, weight=700, fill=MUTED)
    c.x_axis(xs, ys.r0, [0, 1, 2, 3, 4, 5, 6], '1日の勉強時間（時間）')
    for x, passed in data:
        c.circle(xs(x), ys(1) + 16 if passed else ys(0) - 16, 8, fill=BLUE if passed else ORANGE)
    curve = [(xs(t / 20), ys(1 / (1 + math.exp(-(b0 + b1 * t / 20))))) for t in range(0, 121)]
    c.polyline(curve, stroke=INK, width=5)
    half = -b0 / b1
    c.line(xs(half), ys(0), xs(half), ys(0.5), stroke=MUTED, width=3, dash='8 6')
    c.line(xs(0), ys(0.5), xs(half), ys(0.5), stroke=MUTED, width=3, dash='8 6')
    c.text(xs(half) + 12, ys(0.5) + 34, f'約{half:.1f}時間で50%', 26, weight=700, anchor='start')

    x0 = 1050
    c.text(x0, 250, '結果が「合格・不合格」のように', 30, weight=700, anchor='start')
    c.text(x0, 292, '2つに分かれるときに使う', 30, weight=700, anchor='start')
    c.text(x0, 390, 'S字のカーブで、勉強時間ごとの', 28, anchor='start')
    c.text(x0, 428, '「合格する確率」を表す', 28, anchor='start')
    for hours in (1, 3, 5):
        prob = 1 / (1 + math.exp(-(b0 + b1 * hours)))
        c.text(x0 + 20, 500 + (hours - 1) * 30, f'{hours}時間 → 約{prob * 100:.0f}%', 28, weight=700, fill=BLUE_TEXT, anchor='start')
    c.summary('ロジスティック回帰分析は、2つに分かれる結果（合格・不合格など）が起こる確率を予測する方法です')
    return c.to_svg()


# ---------------------------------------------------------------------------
# 主成分分析
# ---------------------------------------------------------------------------
def pca() -> str:
    c = Canvas('主成分分析：たくさんの点数を少ない指標にまとめる')
    c.question('たくさんの教科の点数を、少ない数の指標にまとめられる？', '●＝1人　50人の例（わかりやすく2教科で説明します）')
    points = pca_data()
    (mx, my), axes = pca_axes(points)
    total = sum(value for value, _ in axes)
    panel = Panel(40, 160, 960, 600)
    c.frame(panel)
    xs = Scale(20, 100, panel.x0 + 110, panel.right - 40)
    ys = Scale(20, 100, panel.bottom - 80, panel.y0 + 50)
    c.y_axis(ys, xs.r0, [20, 40, 60, 80, 100], '英語（点）')
    c.x_axis(xs, ys.r0, [20, 40, 60, 80, 100], '国語（点）')
    for x, y in points:
        c.circle(xs(x), ys(y), 7, fill='#9fc9f3')
    for (value, (vx, vy)), color, length in zip(axes, (BLUE, ORANGE), (2.6, 2.6)):
        half = length * math.sqrt(value)
        c.arrow(xs(mx - vx * half), ys(my - vy * half), xs(mx + vx * half), ys(my + vy * half),
                stroke=color, width=6, head=20)
    (v1, (ax, ay)), (v2, (bx, by)) = axes
    end1 = (xs(mx + ax * 2.6 * math.sqrt(v1)), ys(my + ay * 2.6 * math.sqrt(v1)))
    c.text(end1[0] - 10, end1[1] - 20, '第1主成分', 28, weight=700, fill=BLUE_TEXT, anchor='end')
    end2 = (xs(mx + bx * 2.6 * math.sqrt(v2)), ys(my + by * 2.6 * math.sqrt(v2)))
    c.text(end2[0] + 14, end2[1] + 10, '第2主成分', 26, weight=700, fill=ORANGE_TEXT, anchor='start')

    x0 = 1050
    c.text(x0, 240, '点がいちばん広がっている向きに', 28, weight=700, anchor='start')
    c.text(x0, 280, '新しい軸（第1主成分）を引く', 28, weight=700, anchor='start')
    c.text(x0 + 20, 360, f'第1主成分：全体の{v1 / total * 100:.0f}%を説明', 28, weight=700, fill=BLUE_TEXT, anchor='start')
    c.text(x0 + 40, 400, '→「ことばの総合力」のような指標', 26, fill=BLUE_TEXT, anchor='start')
    c.text(x0 + 20, 470, f'第2主成分：全体の{v2 / total * 100:.0f}%', 28, weight=700, fill=ORANGE_TEXT, anchor='start')
    c.text(x0, 570, '2つの点数を、1つの指標で', 26, fill=MUTED, anchor='start')
    c.text(x0, 606, 'ほとんど表せることがわかる', 26, fill=MUTED, anchor='start')
    c.summary('主成分分析は、データの広がりが大きい向きを見つけて、多くの変数を少ない指標にまとめる方法です')
    return c.to_svg()


# ---------------------------------------------------------------------------
# 時系列データ分析
# ---------------------------------------------------------------------------
def time_series() -> str:
    c = Canvas('時系列データ分析：図書室の利用者数はどう変わったか')
    c.question('2年間で、図書室の利用者数はどう変わった？', '月ごとの利用者数の例')
    values = library_visitors()
    smooth = moving_average(values)
    captions = [('上がり下がりが多く、傾向が見えにくい', None), ('ならすと、少しずつ増えている傾向が見える', None)]
    for index, (panel, (line1, _)) in enumerate(zip(panels(2), captions)):
        c.frame(panel, '月ごとの人数（そのまま）' if index == 0 else '3か月ごとにならした線（移動平均）')
        xs = Scale(0, 23, panel.x0 + 100, panel.right - 30)
        ys = Scale(100, 300, panel.bottom - 80, panel.y0 + 95)
        c.y_axis(ys, xs.r0 - 10, [100, 150, 200, 250, 300], '利用者数（人）', size=22)
        ticks = [0, 4, 8, 12, 16, 20]
        labels = [('1年目' if t < 12 else '2年目') + MONTHS[t % 12] for t in ticks]
        c.x_axis(xs, ys.r0, ticks, tick_labels=labels, size=20)
        raw = [(xs(i), ys(v)) for i, v in enumerate(values)]
        c.polyline(raw, stroke=BLUE if index == 0 else '#9fc9f3', width=4 if index == 0 else 3)
        if index == 1:
            c.polyline([(xs(i), ys(v)) for i, v in enumerate(smooth) if v is not None], stroke=BLUE_TEXT, width=7)
            aug = 16
            c.text(xs(aug), ys(values[aug]) + 34, '夏休みは毎年少ない', 22, weight=700, fill=MUTED)
        c.caption(panel, line1, size=30)
    c.summary('時系列データ分析は、時間とともに変わるデータから、長い目で見た傾向や季節ごとのくり返しを読み取ります')
    return c.to_svg()


FIGURES = {
    'correlation': correlation,
    'regression_simple': regression_simple,
    'regression_multiple': regression_multiple,
    'logistic_regression': logistic_regression,
    'pca': pca,
    'time_series': time_series,
}
