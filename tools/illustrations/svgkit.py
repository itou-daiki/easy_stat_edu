"""説明イラスト用の小さな描画道具（SVG）と、図に使う例データの作り方。

全図共通のレイアウト：
  上：生徒の問い（大きく）
  中：1〜3つの枠に、比べる場合を並べた図
  枠の下：それぞれの読み方（2行）
  下：その分析の1行まとめ
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from xml.sax.saxutils import escape

# 色（アプリのデザインと同じ）
BLUE = '#1e90ff'
BLUE_TEXT = '#1670c9'      # 小さな文字用の濃いめの青
BLUE_WEAK = '#eaf4ff'
ORANGE = '#e8710a'
ORANGE_TEXT = '#c25e05'
ORANGE_WEAK = '#fdf0e4'
GRAY = '#8b94a1'           # 3つ目のグループ用
GRAY_TEXT = '#556070'
INK = '#17202c'
MUTED = '#556070'
RULE = '#d9dde3'
TINT = '#f4f6f9'

GROUP_COLORS = [(BLUE, BLUE_TEXT), (ORANGE, ORANGE_TEXT), (GRAY, GRAY_TEXT)]

FONT = ("'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Noto Sans CJK JP',"
        "'Yu Gothic',Meiryo,sans-serif")

WIDTH, HEIGHT = 1600, 900


@dataclass(frozen=True)
class Panel:
    """図を描く枠。x0, y0 は左上、w, h は大きさ（px）。"""
    x0: float
    y0: float
    w: float
    h: float

    @property
    def cx(self) -> float:
        return self.x0 + self.w / 2

    @property
    def right(self) -> float:
        return self.x0 + self.w

    @property
    def bottom(self) -> float:
        return self.y0 + self.h


@dataclass(frozen=True)
class Scale:
    """データの値（domain）を画面の座標（range）に変換する"""
    d0: float
    d1: float
    r0: float
    r1: float

    def __call__(self, value: float) -> float:
        return self.r0 + (value - self.d0) / (self.d1 - self.d0) * (self.r1 - self.r0)


@dataclass
class Canvas:
    title: str
    body: list[str] = field(default_factory=list)

    # ---- 基本図形 -------------------------------------------------------
    def text(self, x: float, y: float, content: str, size: int = 28, *, weight: int = 400,
             fill: str = INK, anchor: str = 'middle') -> None:
        self.body.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}">{escape(content)}</text>')

    def line(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str = INK,
             width: float = 3, dash: str | None = None) -> None:
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ''
        self.body.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" '
            f'stroke-width="{width}" stroke-linecap="round"{dash_attr}/>')

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str = 'none',
             stroke: str | None = RULE, width: float = 3, radius: float = 0) -> None:
        stroke_attr = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ''
        self.body.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{radius}" '
            f'fill="{fill}"{stroke_attr}/>')

    def circle(self, cx: float, cy: float, r: float, *, fill: str = INK,
               stroke: str | None = None, width: float = 2) -> None:
        stroke_attr = f' stroke="{stroke}" stroke-width="{width}"' if stroke else ''
        self.body.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}"{stroke_attr}/>')

    def polyline(self, points: list[tuple[float, float]], *, stroke: str = INK, width: float = 5,
                 dash: str | None = None) -> None:
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ''
        coords = ' '.join(f'{x:.1f},{y:.1f}' for x, y in points)
        self.body.append(
            f'<polyline points="{coords}" fill="none" stroke="{stroke}" stroke-width="{width}" '
            f'stroke-linejoin="round" stroke-linecap="round"{dash_attr}/>')

    def arrow(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str = INK,
              width: float = 3, both: bool = False, head: float = 12) -> None:
        self.line(x1, y1, x2, y2, stroke=stroke, width=width)
        ends = [(x2, y2, x1, y1)] + ([(x1, y1, x2, y2)] if both else [])
        for tip_x, tip_y, from_x, from_y in ends:
            angle = math.atan2(tip_y - from_y, tip_x - from_x)
            left = (tip_x - head * math.cos(angle - 0.45), tip_y - head * math.sin(angle - 0.45))
            right = (tip_x - head * math.cos(angle + 0.45), tip_y - head * math.sin(angle + 0.45))
            self.body.append(
                f'<path d="M{tip_x:.1f},{tip_y:.1f} L{left[0]:.1f},{left[1]:.1f} '
                f'L{right[0]:.1f},{right[1]:.1f} Z" fill="{stroke}"/>')

    # ---- 共通レイアウト -----------------------------------------------
    def question(self, content: str, note: str | None = None, note2: str | None = None) -> None:
        # 全角1文字 ≒ 文字サイズ分の幅として、はみ出す長さなら文字を小さくする
        size = min(50, int((WIDTH - 120) / max(1, len(content))))
        self.text(WIDTH / 2, 80, content, size, weight=700)
        if note:
            self.text(WIDTH / 2, 124, note, 26, fill=INK)
        if note2:
            self.text(WIDTH / 2, 156, note2, 24, fill=MUTED)

    def summary(self, content: str, y: float = 860) -> None:
        self.text(WIDTH / 2, y, content, 28, weight=700, fill=INK)

    def conclude(self, panel: Panel, method: str, main: str, extra: str | None = None) -> None:
        """枠の下に「○○で計算すると…」と結論を書く"""
        self.text(panel.cx, panel.bottom + 40, f'{method}で計算すると…', 24, fill=MUTED)
        self.text(panel.cx, panel.bottom + 82, main, 32 if len(main) <= 24 else 28, weight=700)
        if extra:
            self.text(panel.cx, panel.bottom + 118, extra, 24, fill=INK)

    def frame(self, panel: Panel, heading: str | None = None) -> None:
        self.rect(panel.x0, panel.y0, panel.w, panel.h)
        if heading:
            self.text(panel.x0 + 26, panel.y0 + 48, heading, 30, weight=700, anchor='start')

    def caption(self, panel: Panel, line1: str, line2: str | None = None, *, size: int = 32) -> None:
        self.text(panel.cx, panel.bottom + 54, line1, size, weight=700)
        if line2:
            self.text(panel.cx, panel.bottom + 54 + size + 12, line2, size, weight=700)

    def x_axis(self, scale: Scale, y: float, ticks: list[float], label: str | None = None, *,
               tick_labels: list[str] | None = None, size: int = 24) -> None:
        self.line(scale.r0, y, scale.r1, y, width=3)
        labels = tick_labels or [f'{tick:g}' for tick in ticks]
        for tick, tick_label in zip(ticks, labels):
            self.line(scale(tick), y, scale(tick), y + 9, width=2)
            self.text(scale(tick), y + 38, tick_label, size, fill=MUTED)
        if label:
            self.text(scale.r1, y + 72, label, size, weight=700, fill=MUTED, anchor='end')

    def y_axis(self, scale: Scale, x: float, ticks: list[float], label: str | None = None, *,
               tick_labels: list[str] | None = None, size: int = 24) -> None:
        self.line(x, scale.r0, x, scale.r1, width=3)
        labels = tick_labels or [f'{tick:g}' for tick in ticks]
        for tick, tick_label in zip(ticks, labels):
            self.line(x - 9, scale(tick), x, scale(tick), width=2)
            self.text(x - 16, scale(tick) + 8, tick_label, size, fill=MUTED, anchor='end')
        if label:
            # 軸のいちばん上の右横に置く（枠の見出しと重ならないように）
            self.text(x + 12, scale.r1 + 8, label, size, weight=700, fill=MUTED, anchor='start')

    def legend_dot(self, x: float, y: float, color: str, label: str, *, size: int = 26) -> float:
        """●ラベル を描き、次の項目を置く x を返す"""
        self.circle(x + 9, y - 9, 9, fill=color)
        self.text(x + 26, y, label, size, fill=INK, anchor='start')
        return x + 26 + size * len(label) + 30

    def to_svg(self) -> str:
        return '\n'.join([
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" '
            f'width="{WIDTH}" height="{HEIGHT}" role="img" font-family="{FONT}">',
            f'<title>{escape(self.title)}</title>',
            f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#ffffff"/>',
            *self.body,
            '</svg>',
        ])


def panels(count: int, *, top: float = 160, height: float = 470) -> list[Panel]:
    """横に count 個並べた枠"""
    margin, gap = 40, 40
    width = (WIDTH - 2 * margin - (count - 1) * gap) / count
    return [Panel(margin + i * (width + gap), top, width, height) for i in range(count)]


# ---- 例データの作り方（乱数を使わず、毎回同じデータになる） -------------
def normal_quantile(p: float) -> float:
    """標準正規分布の分位点（二分法。図のデータ作成用なので精度は十分）"""
    lo, hi = -8.0, 8.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if 0.5 * (1 + math.erf(mid / math.sqrt(2))) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def normal_scores(n: int) -> list[float]:
    """平均0・標準偏差1にそろえた、なめらかな正規分布の n 個の値（小さい順）"""
    raw = [normal_quantile((i + 0.5) / n) for i in range(n)]
    mean = sum(raw) / n
    sd = math.sqrt(sum((v - mean) ** 2 for v in raw) / (n - 1))
    return [(v - mean) / sd for v in raw]


def integer_scores(mean: int, sd: float, n: int = 30, *, low: int = 0, high: int = 100) -> list[int]:
    """平均がちょうど mean、ばらつきがほぼ sd になる n 人分の整数の点数"""
    scores = [round(mean + sd * z) for z in normal_scores(n)]
    diff = mean * n - sum(scores)
    order = sorted(range(n), key=lambda i: abs(i - n / 2))
    for k in range(abs(diff)):
        scores[order[k % n]] += 1 if diff > 0 else -1
    return sorted(min(high, max(low, score)) for score in scores)


def shuffled_order(n: int, seed: int) -> list[int]:
    """0..n-1 を決まった手順で並べかえる（乱数の代わり。毎回同じ結果）"""
    order = list(range(n))
    state = seed
    for i in range(n - 1, 0, -1):
        state = (state * 1103515245 + 12345) % (2 ** 31)
        j = state % (i + 1)
        order[i], order[j] = order[j], order[i]
    return order


def correlated_pairs(n: int, r: float, seed: int) -> list[tuple[float, float]]:
    """相関係数がちょうど r になる (x, y) の組（どちらも平均0・標準偏差1）"""
    x = normal_scores(n)
    noise_source = normal_scores(n)
    w = [noise_source[i] for i in shuffled_order(n, seed)]
    # w から x の成分を取り除き、x と無相関にしてから混ぜる
    beta = sum(a * b for a, b in zip(x, w)) / sum(a * a for a in x)
    resid = [b - beta * a for a, b in zip(x, w)]
    sd = math.sqrt(sum(v * v for v in resid) / (n - 1))
    resid = [v / sd for v in resid]
    y = [r * a + math.sqrt(1 - r * r) * b for a, b in zip(x, resid)]
    return list(zip(x, y))


def pearson_r(pairs: list[tuple[float, float]]) -> float:
    n = len(pairs)
    mx = sum(p[0] for p in pairs) / n
    my = sum(p[1] for p in pairs) / n
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pairs)
    sxx = sum((p[0] - mx) ** 2 for p in pairs)
    syy = sum((p[1] - my) ** 2 for p in pairs)
    return sxy / math.sqrt(sxx * syy)


def dot_strip(canvas: Canvas, values: list[float], scale: Scale, baseline: float, color: str, *,
              bin_width: float, dot: float = 11, labels: list[str] | None = None) -> None:
    """値を bin_width ごとの列にまとめ、1人＝1つの点として下から積み上げる"""
    columns: dict[float, int] = {}
    last_label_x, stagger = -1e9, 0
    for index in sorted(range(len(values)), key=lambda i: values[i]):
        value = values[index]
        column = math.floor(value / bin_width) * bin_width
        level = columns.get(column, 0)
        columns[column] = level + 1
        cx = scale(column + bin_width / 2)
        cy = baseline - dot / 2 - level * (dot + 2)
        canvas.circle(cx, cy, dot / 2, fill=color)
        if labels:
            # 近い点どうしは、数字を上下2段に互い違いに置いて重ならないようにする
            stagger = 1 - stagger if cx - last_label_x < 30 else 0
            last_label_x = cx
            canvas.text(cx, cy - dot - stagger * 24, labels[index], 20, weight=700, fill=INK)
