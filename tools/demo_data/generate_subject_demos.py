"""
分析ごとのデモデータ（高校生に身近な題材）を作る

| ファイル | 題材 | 主な分析 |
|---|---|---|
| hs_ttest_demo.csv | 朝の10分間読書と読解テスト（40人） | t検定（対応なし・対応あり）、U検定 |
| hs_anova_demo.csv | 英単語の勉強法 × 学年（48人） | 一元・二元配置分散分析、反復測定 |
| hs_regression_demo.csv | 生活習慣と模試の得点（60人） | 重回帰分析、相関分析 |
| hs_factor_demo.csv | 学校生活アンケート15項目（150人） | 因子分析、主成分分析 |
| hs_text_demo.csv | 文化祭の感想（45人） | テキストマイニング |
| hs_timeseries_demo.csv | 学校図書館の月別貸出冊数（3年間） | 時系列分析 |
| hs_logistic_demo.csv | 英検2級の合否（80人） | ロジスティック回帰 |

すべて架空のデータ。乱数の種を固定しているので、何度実行しても同じデータになる。

実行: python3 tools/demo_data/generate_subject_demos.py
"""
import csv
from pathlib import Path
from typing import Callable

import numpy as np

SEED = 20261008
OUT_DIR = Path(__file__).resolve().parents[2] / "datasets"


def clip_round(values: np.ndarray, low: float, high: float, digits: int = 0) -> np.ndarray:
    return np.round(np.clip(values, low, high), digits)


def to_cell(value: object) -> object:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        number = float(value)
        return int(number) if number.is_integer() else number
    return value


def write_csv(name: str, columns: list[str], rows: list[dict]) -> None:
    path = OUT_DIR / name
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows({key: to_cell(row[key]) for key in columns} for row in rows)
    print(f"wrote {path} ({len(rows)} rows)")


def columns_to_rows(columns: dict[str, np.ndarray]) -> list[dict]:
    n = len(next(iter(columns.values())))
    return [{name: values[i] for name, values in columns.items()} for i in range(n)]


# ---------------------------------------------------------------------------
# t検定：朝の10分間読書を続けたクラスと、続けなかったクラスの読解テスト
# ---------------------------------------------------------------------------
def make_ttest(rng: np.random.Generator) -> None:
    n_per = 20
    group = np.repeat(["あり", "なし"], n_per)
    reading = group == "あり"
    pre = clip_round(60 + rng.normal(0, 10, 2 * n_per), 25, 95)
    # 全員少し伸び、読書ありのクラスはさらに伸びる
    post = clip_round(pre + 3 + np.where(reading, 7, 0) + rng.normal(0, 5, 2 * n_per), 25, 100)
    focus = clip_round(3.2 + np.where(reading, 0.4, 0) + rng.normal(0, 0.7, 2 * n_per), 1, 5, 1)
    sleep = clip_round(6.5 + rng.normal(0, 0.6, 2 * n_per), 5, 8.5, 1)
    # 1か月に読んだ本の冊数：0冊の人が多い、すそが右に長い分布（U検定の例）
    books = rng.poisson(np.where(reading, 3.0, 1.2))
    write_csv("hs_ttest_demo.csv",
              ["ID", "朝読書", "読解テスト_事前", "読解テスト_事後", "授業の集中度", "睡眠時間", "読んだ本の冊数"],
              columns_to_rows({
                  "ID": np.arange(1, 2 * n_per + 1), "朝読書": group,
                  "読解テスト_事前": pre, "読解テスト_事後": post,
                  "授業の集中度": focus, "睡眠時間": sleep, "読んだ本の冊数": books,
              }))


# ---------------------------------------------------------------------------
# 分散分析：英単語の勉強法（3種類）× 学年（2つ）、単語テストを3回実施
# ---------------------------------------------------------------------------
def make_anova(rng: np.random.Generator) -> None:
    methods = ["ノートにまとめる", "問題演習", "友達と教え合う"]
    grades = ["1年", "2年"]
    n_cell = 8
    method = np.repeat(methods, len(grades) * n_cell)
    grade = np.tile(np.repeat(grades, n_cell), len(methods))
    n = len(method)
    gain = np.select([method == "問題演習", method == "友達と教え合う"], [6, 9], 3)
    base = 55 + np.where(grade == "2年", 3, 0) + rng.normal(0, 8, n)
    person = rng.normal(0, 3, n)
    test1 = clip_round(base + rng.normal(0, 4, n), 20, 100)
    test2 = clip_round(base + gain * 0.6 + person + rng.normal(0, 4, n), 20, 100)
    test3 = clip_round(base + gain * 1.2 + person + rng.normal(0, 4, n), 20, 100)
    understanding = clip_round(60 + gain * 1.5 + rng.normal(0, 10, n), 10, 100)
    satisfaction = clip_round(3.0 + (gain - 6) * 0.12 + rng.normal(0, 0.7, n), 1, 5, 1)
    order = rng.permutation(n)
    write_csv("hs_anova_demo.csv",
              ["ID", "勉強法", "学年", "単語テスト_1回目", "単語テスト_2回目", "単語テスト_3回目", "理解度", "満足度"],
              columns_to_rows({
                  "ID": np.arange(1, n + 1), "勉強法": method[order], "学年": grade[order],
                  "単語テスト_1回目": test1[order], "単語テスト_2回目": test2[order],
                  "単語テスト_3回目": test3[order], "理解度": understanding[order], "満足度": satisfaction[order],
              }))


# ---------------------------------------------------------------------------
# 重回帰：生活習慣から模試の得点を予測する
# ---------------------------------------------------------------------------
def make_regression(rng: np.random.Generator) -> None:
    n = 60
    study = clip_round(rng.normal(70, 30, n), 0, 180)
    study = np.round(study / 5) * 5
    phone = clip_round(rng.normal(3.0, 1.2, n), 0.5, 7, 1)
    sleep = clip_round(7.4 - 0.3 * phone + rng.normal(0, 0.5, n), 4.5, 9, 1)
    focus = clip_round(3.2 + 0.25 * (sleep - 6.5) + rng.normal(0, 0.8, n), 1, 5, 1)
    commute = np.round(clip_round(rng.lognormal(np.log(30), 0.5, n), 5, 90) / 5) * 5
    score = clip_round(
        32 + 0.18 * study - 3.0 * phone + 1.5 * (sleep - 6.5) + 4.0 * focus + rng.normal(0, 7, n), 15, 100)
    write_csv("hs_regression_demo.csv",
              ["ID", "模試の得点", "家庭学習時間", "スマホ時間", "睡眠時間", "授業の集中度", "通学時間"],
              columns_to_rows({
                  "ID": np.arange(1, n + 1), "模試の得点": score, "家庭学習時間": study,
                  "スマホ時間": phone, "睡眠時間": sleep, "授業の集中度": focus, "通学時間": commute,
              }))


# ---------------------------------------------------------------------------
# 因子分析：学校生活アンケート（3因子 × 5項目、5段階）
# ---------------------------------------------------------------------------
FACTOR_ITEMS = [
    ["Q1_授業が楽しい", "Q2_もっと知りたいと思う", "Q3_自分から勉強する", "Q4_課題を最後までやる", "Q5_勉強が将来に役立つと思う"],
    ["Q6_友達と話すのが楽しい", "Q7_困ったとき相談できる", "Q8_クラスに居場所がある", "Q9_友達と協力できる", "Q10_休み時間が楽しい"],
    ["Q11_行事に積極的に参加する", "Q12_部活動に打ち込んでいる", "Q13_文化祭が楽しみ", "Q14_体育祭で力を出す", "Q15_学校外の活動にも参加する"],
]


def make_factor(rng: np.random.Generator) -> None:
    n = 150
    # 3つの因子は少し相関する（斜交回転の違いが見える程度）
    corr = np.array([[1.0, 0.3, 0.35], [0.3, 1.0, 0.4], [0.35, 0.4, 1.0]])
    factors = rng.multivariate_normal(np.zeros(3), corr, n)
    thresholds = np.array([-1.6, -0.7, 0.3, 1.2])
    columns: dict[str, np.ndarray] = {"ID": np.arange(1, n + 1)}
    for k, items in enumerate(FACTOR_ITEMS):
        for item in items:
            loading = rng.uniform(0.65, 0.85)
            latent = loading * factors[:, k] + np.sqrt(1 - loading ** 2) * rng.normal(0, 1, n)
            columns[item] = np.searchsorted(thresholds, latent) + 1
    write_csv("hs_factor_demo.csv", list(columns.keys()), columns_to_rows(columns))


# ---------------------------------------------------------------------------
# テキストマイニング：文化祭の感想
# ---------------------------------------------------------------------------
TEXT_ROLES = {
    "クラス企画": [
        "文化祭でクラスのお化け屋敷を作った。", "クラスの劇で照明を担当した。", "文化祭の模擬店でたこ焼きを売った。",
        "クラスの展示で教室の飾り付けをした。", "文化祭のステージでクラスのダンスを発表した。",
    ],
    "部活動": [
        "文化祭で吹奏楽部の演奏をした。", "美術部で作品を展示した。", "軽音楽部のライブで歌った。",
        "文化祭で写真部の一年間の写真を展示した。", "茶道部でお茶をふるまった。",
    ],
    "実行委員": [
        "実行委員として準備と片付けを担当した。", "実行委員で当日の受付をした。",
        "実行委員でポスター作りと宣伝を担当した。", "文化祭の実行委員として全体の進行を手伝った。",
    ],
}
TEXT_FEELINGS = {
    "high": [
        "みんなで協力できて、とても楽しかった。", "来てくれた人が喜んでくれて、うれしかった。",
        "準備は大変だったが、達成感があった。", "お客さんがたくさん来てくれて、やってよかったと思う。",
        "クラスの仲がよくなったと感じた。",
    ],
    "mid": [
        "楽しかったが、準備の時間が足りなかった。", "役割分担をもっと早く決めればよかった。",
        "忙しくて、ほかのクラスを見に行けなかった。", "思ったよりお客さんが少なかったが、楽しめた。",
    ],
    "low": [
        "準備が一部の人にかたよってしまい、大変だった。", "意見がまとまらず、話し合いに時間がかかった。",
        "当日は人が多くて、とても疲れてしまった。", "練習の時間が足りず、うまくいかなかった。",
    ],
}
TEXT_NEXT = [
    "来年の文化祭は、もっと早くから準備を始めたい。", "来年の文化祭では、別の企画にも挑戦したい。", "後輩にもこの経験を伝えたい。",
    "次は友達ともっと協力したい。", "", "",
]


def make_text(rng: np.random.Generator) -> None:
    n = 45
    grade = rng.choice(["1年", "2年", "3年"], n)
    gender = rng.choice(["男子", "女子"], n)
    role = rng.choice(list(TEXT_ROLES.keys()), n, p=[0.5, 0.3, 0.2])
    satisfaction = clip_round(3.8 + np.where(grade == "3年", 0.4, 0) + rng.normal(0, 0.9, n), 1, 5).astype(int)
    used: dict[str, int] = {}

    def least_used(options: list[str]) -> str:
        order = rng.permutation(len(options))
        text = min((options[i] for i in order), key=lambda t: used.get(t, 0))
        used[text] = used.get(text, 0) + 1
        return text

    comments = []
    for i in range(n):
        level = "high" if satisfaction[i] >= 4 else "mid" if satisfaction[i] == 3 else "low"
        parts = [least_used(TEXT_ROLES[role[i]]), least_used(TEXT_FEELINGS[level]), str(rng.choice(TEXT_NEXT))]
        comments.append("".join(parts))
    write_csv("hs_text_demo.csv", ["ID", "学年", "性別", "役割", "満足度", "感想"],
              columns_to_rows({
                  "ID": np.arange(1, n + 1), "学年": grade, "性別": gender, "役割": role,
                  "満足度": satisfaction, "感想": np.array(comments),
              }))


# ---------------------------------------------------------------------------
# 時系列：学校図書館の月別貸出冊数（2023年4月〜2026年3月）
# ---------------------------------------------------------------------------
def make_timeseries(rng: np.random.Generator) -> None:
    months = [(2023 + (3 + i) // 12, (3 + i) % 12 + 1) for i in range(36)]
    # 夏休み（8月）と春休み（3月）は少なく、読書週間のある10〜11月は多い
    season_books = {4: 0, 5: 20, 6: 30, 7: -40, 8: -230, 9: 10, 10: 90, 11: 70, 12: -30, 1: -20, 2: 10, 3: -120}
    season_nurse = {4: 10, 5: 15, 6: 25, 7: 10, 8: -45, 9: 20, 10: 5, 11: 0, 12: 5, 1: 15, 2: 20, 3: -10}
    normal_temp = {1: 5.4, 2: 6.1, 3: 9.4, 4: 14.3, 5: 18.8, 6: 21.9, 7: 25.7, 8: 26.9, 9: 23.3, 10: 18.0, 11: 12.5, 12: 7.7}
    rows = []
    for i, (year, month) in enumerate(months):
        rows.append({
            "ID": i + 1,
            "年月": f"{year}-{month:02d}",
            "図書貸出冊数": int(round(420 + 4 * i + season_books[month] + rng.normal(0, 25))),
            "保健室の利用者数": int(round(max(5, 70 + season_nurse[month] + rng.normal(0, 8)))),
            "平均気温": round(normal_temp[month] + rng.normal(0, 0.8), 1),
        })
    write_csv("hs_timeseries_demo.csv", ["ID", "年月", "図書貸出冊数", "保健室の利用者数", "平均気温"], rows)


# ---------------------------------------------------------------------------
# ロジスティック回帰：英検2級の合否
# ---------------------------------------------------------------------------
def make_logistic(rng: np.random.Generator) -> None:
    n = 80
    study = np.round(clip_round(rng.normal(35, 18, n), 0, 100) / 5) * 5
    vocab = clip_round(28 + 0.15 * study + rng.normal(0, 7, n), 5, 50)
    mock = clip_round(45 + 0.5 * vocab + rng.normal(0, 10, n), 15, 100)
    abroad = rng.choice(["あり", "なし"], n, p=[0.2, 0.8])
    logit = -9.0 + 0.03 * study + 0.12 * vocab + 0.06 * mock + np.where(abroad == "あり", 0.8, 0)
    passed = np.where(rng.random(n) < 1 / (1 + np.exp(-logit)), "合格", "不合格")
    write_csv("hs_logistic_demo.csv", ["ID", "英語の家庭学習時間", "英単語テスト", "模試の英語", "海外経験", "合否"],
              columns_to_rows({
                  "ID": np.arange(1, n + 1), "英語の家庭学習時間": study, "英単語テスト": vocab,
                  "模試の英語": mock, "海外経験": abroad, "合否": passed,
              }))


# (作る関数, 乱数の種) — データごとに乱数の流れを分け、1つを直してもほかのデータが変わらないようにする。
# t検定は「事前テストに差がなく、事後テストに差が出る」種を選んでいる
MAKERS: list[tuple[Callable[[np.random.Generator], None], int]] = [
    (make_ttest, SEED + 1800),
    (make_anova, SEED + 1),
    (make_regression, SEED + 2),
    (make_factor, SEED + 3),
    (make_text, SEED + 4),
    (make_timeseries, SEED + 5),
    (make_logistic, SEED + 6),
]


def main() -> None:
    for maker, seed in MAKERS:
        maker(np.random.default_rng(seed))


if __name__ == "__main__":
    main()
