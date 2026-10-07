"""
高校生の生活と学習（総合デモデータ）を作る

- 高校2年生 3クラス×20人＝60人の架空の調査データ
- 初学者モードの5つの目的（平均の比較・2つの数値の関係・人数の偏り・予測・全体像）を
  このファイル1つで試せるように、列と効果の大きさを決めている
- 乱数の種を固定しているので、何度実行しても同じデータになる

実行: python3 tools/demo_data/generate_highschool_demo.py
出力: datasets/highschool_life_demo.csv
"""
import csv
from pathlib import Path

import numpy as np

SEED = 20261127
N_PER_CLASS = 20
OUT = Path(__file__).resolve().parents[2] / "datasets" / "highschool_life_demo.csv"

COLUMNS = [
    "ID", "クラス", "性別", "部活動",
    "通学時間", "睡眠時間", "スマホ時間", "家庭学習時間",
    "国語", "数学", "英語",
    "小テスト_事前", "小テスト_事後",
    "授業の満足度", "感想",
]

# 満足度ごとの感想（同じ言葉がくり返し出るよう、授業・部活・スマホ・睡眠などの話題をそろえる）
# 条件つきの感想は、その生徒の数値と食い違わないときだけ使う（例：部活に入っていない人に「部活で疲れて」は付けない）
IN_CLUB = lambda s: s["club"] != "入っていない"
COMMENTS = {
    "high": [
        ("数学の授業はグラフを使った説明が分かりやすかった。", lambda s: s["math"] >= 60),
        ("友達と教え合う時間があって、授業がとても楽しかった。", None),
        ("小テストで点数が上がったので、家庭学習を続けたい。", lambda s: s["post"] - s["pre"] >= 2),
        ("英語の授業で発表する機会が増えて自信がついた。", lambda s: s["english"] >= 60),
        ("部活と勉強を両立できるように、時間の使い方を工夫している。", lambda s: IN_CLUB(s) and s["study"] >= 60),
        ("先生の説明がていねいで、苦手な数学が少し好きになった。", None),
        ("授業で自分の考えを話せるのがうれしい。", None),
        ("グループ活動で友達の意見を聞けて、考えが広がった。", None),
        ("毎日少しずつ家庭学習をしたら、テストの点数が上がった。", lambda s: s["study"] >= 60 and s["post"] > s["pre"]),
        ("国語の授業で文章を読むのが楽しくなった。", lambda s: s["japanese"] >= 60),
    ],
    "mid": [
        ("授業は分かりやすいが、進むのが少し速いと感じる。", None),
        ("部活で疲れて、家で勉強する時間があまり取れない。", lambda s: IN_CLUB(s) and s["study"] <= 55),
        ("スマホを見る時間が長くて、寝るのが遅くなってしまう。", lambda s: s["phone"] >= 3.3),
        ("数学は難しいけれど、友達に聞くと分かることが多い。", lambda s: s["math"] < 65),
        ("テスト前だけ勉強しているので、毎日続けたい。", lambda s: s["study"] <= 50),
        ("通学時間が長いので、電車の中で英単語を覚えている。", lambda s: s["commute"] >= 45),
        ("授業の内容は分かるが、問題を解く時間がもっと欲しい。", None),
        ("睡眠時間が短い日は、授業に集中しにくい。", lambda s: s["sleep"] <= 6.3),
        ("英語の授業は好きだが、文法が少し難しい。", None),
        ("小テストがあると、復習するきっかけになる。", None),
    ],
    "low": [
        ("授業が速くてついていけないことがある。", None),
        ("スマホを見ていると、勉強を始めるのが遅くなる。", lambda s: s["phone"] >= 3.0),
        ("寝不足で、朝の授業は眠くなってしまう。", lambda s: s["sleep"] <= 6.3),
        ("数学の問題が難しくて、何を聞けばよいか分からない。", lambda s: s["math"] < 60),
        ("部活が忙しく、家庭学習の時間がほとんどない。", lambda s: IN_CLUB(s) and s["study"] <= 40),
        ("テストの点数が上がらず、勉強のやり方に悩んでいる。", lambda s: s["post"] <= s["pre"]),
        ("通学時間が長くて、家に帰ると疲れている。", lambda s: s["commute"] >= 45),
        ("授業でもっと質問できる時間が欲しい。", None),
    ],
}


def clip_round(values: np.ndarray, low: float, high: float, digits: int = 0) -> np.ndarray:
    return np.round(np.clip(values, low, high), digits)


def generate(seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    n = N_PER_CLASS * 3

    classes = np.repeat(["1組", "2組", "3組"], N_PER_CLASS)
    gender = np.array(rng.permutation(["男子"] * 30 + ["女子"] * 30))

    # 部活動：男子は運動部、女子は文化部がやや多い（人数の偏りの例）
    club = np.where(
        gender == "男子",
        rng.choice(["運動部", "文化部", "入っていない"], n, p=[0.62, 0.18, 0.20]),
        rng.choice(["運動部", "文化部", "入っていない"], n, p=[0.30, 0.48, 0.22]),
    )

    # 通学時間（分）：右にすそが長い分布（正規分布でない例）
    commute = clip_round(rng.lognormal(mean=np.log(30), sigma=0.55, size=n), 5, 100)
    commute = np.round(commute / 5) * 5

    # スマホ時間（時間/日）と睡眠時間（時間）：スマホが長い人ほど睡眠が短い
    phone = clip_round(rng.normal(3.0, 1.2, n), 0.5, 7, 1)
    sleep = clip_round(7.6 - 0.35 * phone + rng.normal(0, 0.55, n), 4.5, 9, 1)

    # 家庭学習時間（分/日）：部活に入っていない人がやや長い
    study_base = np.where(club == "入っていない", 75, np.where(club == "文化部", 65, 50))
    study = clip_round(study_base + rng.normal(0, 25, n), 0, 180)
    study = np.round(study / 5) * 5

    # 学力の共通部分（教科間の相関を中程度にする）
    ability = rng.normal(0, 1, n)
    z_study = (study - study.mean()) / study.std()
    z_sleep = (sleep - sleep.mean()) / sleep.std()
    class_shift = np.select([classes == "1組", classes == "2組"], [4, 0], -4)

    math = clip_round(60 + 9 * ability + 7 * z_study + 2 * z_sleep + class_shift + rng.normal(0, 8, n), 10, 100)
    japanese = clip_round(64 + 7 * ability + 4 * z_study + np.where(gender == "女子", 4, 0) + rng.normal(0, 9, n), 10, 100)
    english = clip_round(62 + 8 * ability + 5 * z_study + rng.normal(0, 9, n), 10, 100)

    # 小テスト（20点満点）：同じ生徒の授業前と授業後（対応ありの例）
    pre = clip_round(10 + 2.2 * ability + rng.normal(0, 2.2, n), 0, 20)
    post = clip_round(pre + 2.0 + 0.6 * z_study + rng.normal(0, 2.0, n), 0, 20)

    # 授業の満足度（1〜5）：数学の点数が高い人ほどやや高い
    z_math = (math - math.mean()) / math.std()
    satisfaction = clip_round(3.4 + 0.6 * z_math + rng.normal(0, 0.8, n), 1, 5).astype(int)

    order = {key: rng.permutation(len(items)) for key, items in COMMENTS.items()}
    used = {}

    def comment_for(student: dict) -> str:
        level = student["satisfaction"]
        key = "high" if level >= 4 else "mid" if level == 3 else "low"
        items = [COMMENTS[key][i] for i in order[key]]
        eligible = [text for text, cond in items if cond is None or cond(student)]
        # 使われた回数が少ない感想から順に使い、同じ文ばかりにならないようにする
        text = min(eligible, key=lambda t: used.get(t, 0))
        used[text] = used.get(text, 0) + 1
        return text

    rows = []
    for i in range(n):
        rows.append({
            "ID": i + 1,
            "クラス": classes[i],
            "性別": gender[i],
            "部活動": club[i],
            "通学時間": int(commute[i]),
            "睡眠時間": float(sleep[i]),
            "スマホ時間": float(phone[i]),
            "家庭学習時間": int(study[i]),
            "国語": int(japanese[i]),
            "数学": int(math[i]),
            "英語": int(english[i]),
            "小テスト_事前": int(pre[i]),
            "小テスト_事後": int(post[i]),
            "授業の満足度": int(satisfaction[i]),
            "感想": comment_for({
                "satisfaction": int(satisfaction[i]), "club": club[i], "commute": commute[i],
                "sleep": sleep[i], "phone": phone[i], "study": study[i], "math": math[i],
                "english": english[i], "japanese": japanese[i], "pre": pre[i], "post": post[i],
            }),
        })

    return rows


def main() -> None:
    rows = generate(SEED)
    n = len(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {OUT} ({n} rows)")


if __name__ == "__main__":
    main()
