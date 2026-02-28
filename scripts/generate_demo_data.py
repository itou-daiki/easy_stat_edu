#!/usr/bin/env python3
"""
ICT教育テーマのデモデータ生成スクリプト
統計的パターンを制御して、easyStat の各分析機能で美しい結果が得られるデータを生成する。
"""

import csv
import os
import numpy as np
from pathlib import Path

np.random.seed(42)

DATASETS_DIR = Path(__file__).parent.parent / "datasets"


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def round_list(arr, decimals=1):
    return [round(float(x), decimals) for x in arr]


def int_list(arr):
    return [int(round(float(x))) for x in arr]


def likert_clamp(arr):
    return [clamp(int(round(float(x))), 1, 5) for x in arr]


# ============================================================
# 1. demo_all_analysis.csv — 感想カラムのみ変更
# ============================================================
def generate_demo_all_analysis():
    filepath = DATASETS_DIR / "demo_all_analysis.csv"
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    ict_comments = [
        "タブレットを使った授業がとても分かりやすかった。",
        "オンライン教材で英語のリスニング力が上がった気がする。",
        "プログラミングの授業が楽しくて、もっとやりたい。",
        "デジタル教材は自分のペースで進められるのが良い。",
        "ICTを使ったグループワークで発表が上手くなった。",
        "タブレットの操作に慣れるまで少し時間がかかった。",
        "動画教材のおかげで実験の手順がよく理解できた。",
        "オンラインでの協働学習は意見交換がしやすかった。",
        "デジタルドリルで苦手な計算を繰り返し練習できた。",
        "情報モラルについてもっと学びたいと思った。",
        "電子黒板を使った先生の授業が印象に残っている。",
        "プレゼンテーション作成を通じて表現力が身についた。",
        "タブレットで調べ学習をするのが楽しかった。",
        "ICTの授業でプログラミング的思考が身についた。",
        "オンライン授業は通学時間がなくて効率的だった。",
        "デジタルポートフォリオで自分の成長を振り返れた。",
        "タイピング練習のおかげでレポート作成が速くなった。",
        "ICT活用で友達との情報共有がスムーズになった。",
        "ネットリテラシーの大切さを実感した。",
        "シミュレーション教材で理科の実験が面白くなった。",
        "クラウドでファイル共有できるのが便利だった。",
        "AIドリルの個別最適化された問題が役に立った。",
        "オンラインテストで即座に結果が分かるのが良い。",
        "デジタル教科書は重い荷物が減って助かる。",
        "Scratchでゲームを作る授業が一番楽しかった。",
        "情報セキュリティの授業は将来にも役立つと思う。",
        "遠隔授業で他校の生徒と交流できたのが良い経験だった。",
        "Wi-Fiが不安定な時は授業が中断して困った。",
        "データ分析の授業で統計の面白さに気づいた。",
        "ICTスキルは将来の仕事にも活かせると思う。",
    ]

    for i, row in enumerate(rows):
        row[-1] = ict_comments[i]

    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [1/8] demo_all_analysis.csv: 感想カラム更新完了 ({len(rows)}行)")


# ============================================================
# 2. ttest_demo.csv — DigComp尺度と学習成果
# ============================================================
def generate_ttest_demo():
    n_per_group = 20
    n = n_per_group * 2
    rows = []

    for i in range(n):
        group = "高群" if i < n_per_group else "低群"
        is_high = i < n_per_group

        # 事前テスト: 両群同程度
        info_lit_pre = clamp(round(np.random.normal(50, 8), 1), 25, 75)
        ct_pre = clamp(round(np.random.normal(45, 7), 1), 20, 70)

        # 事後テスト: 高群が大きく伸びる (対応ありt検定で有意)
        if is_high:
            info_lit_post = clamp(round(info_lit_pre + np.random.normal(18, 5), 1), 40, 95)
            ct_post = clamp(round(ct_pre + np.random.normal(15, 4), 1), 35, 85)
        else:
            info_lit_post = clamp(round(info_lit_pre + np.random.normal(5, 4), 1), 30, 80)
            ct_post = clamp(round(ct_pre + np.random.normal(3, 3), 1), 25, 75)

        # 独立t検定で有意差が出る変数
        if is_high:
            motivation = clamp(round(np.random.normal(4.2, 0.6), 1), 1, 5)
            ict_freq = clamp(round(np.random.normal(4.0, 0.7), 1), 1, 5)
            submission = clamp(round(np.random.normal(92, 5), 1), 60, 100)
            collab = clamp(round(np.random.normal(78, 8), 1), 40, 100)
            efficacy = clamp(round(np.random.normal(4.1, 0.5), 1), 1, 5)
            understanding = clamp(round(np.random.normal(82, 7), 1), 50, 100)
        else:
            motivation = clamp(round(np.random.normal(3.0, 0.8), 1), 1, 5)
            ict_freq = clamp(round(np.random.normal(2.5, 0.9), 1), 1, 5)
            submission = clamp(round(np.random.normal(78, 10), 1), 40, 100)
            collab = clamp(round(np.random.normal(60, 10), 1), 30, 95)
            efficacy = clamp(round(np.random.normal(3.0, 0.7), 1), 1, 5)
            understanding = clamp(round(np.random.normal(68, 10), 1), 35, 95)

        # 差が小さい変数(Mann-Whitney用)
        attendance = clamp(round(np.random.normal(88 if is_high else 82, 8), 1), 50, 100)
        typing = clamp(int(np.random.normal(220 if is_high else 180, 30)), 80, 350)
        presentation = clamp(round(np.random.normal(75 if is_high else 65, 10), 1), 30, 100)
        grade = np.random.choice([1, 2, 3])

        rows.append([
            i + 1, group, info_lit_pre, info_lit_post, ct_pre, ct_post,
            motivation, ict_freq, submission, collab, efficacy,
            understanding, attendance, typing, presentation, grade
        ])

    header = [
        "ID", "DigComp群", "情報リテラシー_事前", "情報リテラシー_事後",
        "CT得点_事前", "CT得点_事後", "学習意欲", "ICT活用頻度",
        "課題提出率", "協働学習スコア", "自己効力感", "授業理解度",
        "出席率", "タイピング速度", "プレゼン評価", "学年"
    ]

    filepath = DATASETS_DIR / "ttest_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [2/8] ttest_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 3. anova_demo.csv — ICT指導法比較実験
# ============================================================
def generate_anova_demo():
    methods = ["タブレット", "PC", "従来型"]
    school_types = ["公立", "私立"]
    n_per_cell = 8  # 3 x 2 x 8 = 48
    rows = []

    # 主効果と交互作用を制御（効果量を大きめに設定）
    method_effects = {"タブレット": 14, "PC": 7, "従来型": 0}
    school_effects = {"公立": 0, "私立": 5}
    # 交互作用: 私立×タブレットで特に高い
    interaction = {("タブレット", "私立"): 8, ("PC", "私立"): 0, ("従来型", "私立"): -3}

    idx = 1
    for method in methods:
        for school in school_types:
            for _ in range(n_per_cell):
                me = method_effects[method]
                se = school_effects[school]
                ie = interaction.get((method, school), 0)
                base = 55

                # 事前テスト（ほぼ同じ）
                test1_pre = clamp(round(np.random.normal(50, 6), 1), 30, 70)
                test2_pre = clamp(round(np.random.normal(48, 7), 1), 28, 68)

                # 事後テスト（主効果+交互作用）
                test1_post = clamp(round(np.random.normal(test1_pre + me + se + ie + 10, 5), 1), 35, 100)
                test2_post = clamp(round(np.random.normal(test2_pre + me + se + ie + 8, 6), 1), 30, 100)

                # ANOVA用従属変数（SD小さめで効果量確保）
                interest = clamp(round(np.random.normal(base + me * 1.0 + se * 0.5 + ie * 0.5, 6), 1), 20, 100)
                ict_skill = clamp(round(np.random.normal(base + me * 1.2 + se * 0.4 + ie * 0.6, 5), 1), 20, 100)
                collaboration = clamp(round(np.random.normal(base + me * 0.8 + se * 0.5 + ie * 0.4, 7), 1), 20, 100)
                autonomy = clamp(round(np.random.normal(base + me * 0.7 + se * 0.4 + ie * 0.3, 6), 1), 20, 100)
                satisfaction = clamp(round(np.random.normal(3.5 + me * 0.10 + se * 0.08 + ie * 0.08, 0.5), 1), 1, 5)

                rows.append([
                    idx, method, school, test1_pre, test1_post, test2_pre, test2_post,
                    interest, ict_skill, collaboration, autonomy, satisfaction
                ])
                idx += 1

    header = [
        "ID", "指導法", "学校種", "テスト1_事前", "テスト1_事後",
        "テスト2_事前", "テスト2_事後", "関心意欲", "ICT活用スキル",
        "協働性", "主体性", "満足度"
    ]

    filepath = DATASETS_DIR / "anova_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [3/8] anova_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 4. multiple_regression_demo.csv — オンライン学習成果の予測
# ============================================================
def generate_multiple_regression_demo():
    n = 50
    rows = []

    # 潜在変数から相関構造を生成
    for i in range(n):
        latent = np.random.normal(0, 1)

        ict_hours = clamp(round(np.random.normal(3.0 + latent * 0.8, 1.0), 1), 0.5, 8.0)
        digital_material = clamp(round(np.random.normal(55 + latent * 12, 10), 1), 15, 95)
        online_collab = clamp(int(np.random.normal(12 + latent * 4, 3)), 1, 30)
        self_regulated = clamp(round(np.random.normal(60 + latent * 10, 8), 1), 25, 95)
        teacher_support = clamp(round(np.random.normal(3.5 + latent * 0.4, 0.7), 1), 1, 5)
        parent_ict = clamp(round(np.random.normal(3.0 + latent * 0.3, 0.8), 1), 1, 5)
        network_quality = clamp(round(np.random.normal(3.5 + latent * 0.3, 0.8), 1), 1, 5)
        motivation = clamp(round(np.random.normal(3.5 + latent * 0.5, 0.6), 1), 1, 5)
        programming_exp = clamp(round(np.random.normal(2.0 + latent * 0.6, 1.0), 1), 0, 5)
        info_moral = clamp(round(np.random.normal(65 + latent * 8, 10), 1), 25, 100)

        # 学習達成度（重回帰 R²~0.75 を目指す）
        achievement = (
            0.18 * ict_hours * 10
            + 0.22 * digital_material
            + 0.12 * online_collab * 3
            + 0.28 * self_regulated
            + 0.10 * teacher_support * 15
            + 0.06 * parent_ict * 10
            + 0.08 * network_quality * 10
            + 0.12 * motivation * 15
            + np.random.normal(0, 4)
        )
        achievement = clamp(round(achievement, 1), 20, 100)

        # 合格判定（ロジスティック回帰用）
        logit = -3 + 0.04 * achievement + 0.01 * self_regulated + 0.3 * motivation
        prob = 1 / (1 + np.exp(-logit))
        passed = "合格" if np.random.random() < prob else "不合格"

        rows.append([
            i + 1, achievement, ict_hours, digital_material, online_collab,
            self_regulated, teacher_support, parent_ict, network_quality,
            motivation, programming_exp, info_moral, passed
        ])

    header = [
        "ID", "学習達成度", "ICT利用時間", "デジタル教材活用度", "オンライン協働回数",
        "自己調整学習スコア", "教師ICTサポート", "保護者ICT理解", "通信環境品質",
        "学習動機", "プログラミング経験", "情報モラル理解度", "合格判定"
    ]

    filepath = DATASETS_DIR / "multiple_regression_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [4/8] multiple_regression_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 5. factor_analysis_demo.csv — ICT教育態度尺度（3因子15項目）
# ============================================================
def generate_factor_analysis_demo():
    n = 60
    rows = []

    for i in range(n):
        # 3因子の潜在変数
        f1 = np.random.normal(0, 1)  # ICT有用性認知
        f2 = np.random.normal(0, 1)  # ICT不安（逆転）
        f3 = np.random.normal(0, 1)  # 協働学習志向

        # F1: ICT有用性認知 (Q1-Q5) — 高負荷 >.60
        q1 = likert_clamp([3.5 + f1 * 0.9 + np.random.normal(0, 0.4)])[0]  # ICT有用性
        q2 = likert_clamp([3.3 + f1 * 0.85 + np.random.normal(0, 0.45)])[0]  # 効率向上
        q3 = likert_clamp([3.4 + f1 * 0.8 + np.random.normal(0, 0.5)])[0]  # 理解深化
        q4 = likert_clamp([3.2 + f1 * 0.75 + np.random.normal(0, 0.5)])[0]  # 教材充実
        q5 = likert_clamp([3.3 + f1 * 0.7 + np.random.normal(0, 0.55)])[0]  # 情報収集

        # F2: ICT不安 (Q6-Q9) — 逆転項目、高負荷
        q6 = likert_clamp([3.0 + f2 * 0.85 + np.random.normal(0, 0.45)])[0]  # 操作不安(R)
        q7 = likert_clamp([3.1 + f2 * 0.80 + np.random.normal(0, 0.5)])[0]  # トラブル不安(R)
        q8 = likert_clamp([2.9 + f2 * 0.75 + np.random.normal(0, 0.5)])[0]  # ついていけない(R)
        q9 = likert_clamp([2.8 + f2 * 0.70 + np.random.normal(0, 0.55)])[0]  # 情報漏洩不安(R)

        # F3: 協働学習志向 (Q10-Q14) — 高負荷
        q10 = likert_clamp([3.5 + f3 * 0.85 + np.random.normal(0, 0.45)])[0]  # 協働楽しさ
        q11 = likert_clamp([3.3 + f3 * 0.80 + np.random.normal(0, 0.5)])[0]  # 意見交換
        q12 = likert_clamp([3.4 + f3 * 0.75 + np.random.normal(0, 0.5)])[0]  # チーム作業
        q13 = likert_clamp([3.2 + f3 * 0.70 + np.random.normal(0, 0.55)])[0]  # 発表機会
        q14 = likert_clamp([3.3 + f3 * 0.80 + np.random.normal(0, 0.5)])[0]  # 多様な視点

        # Q15: クロスローディング (F1とF3に中程度負荷)
        q15 = likert_clamp([3.2 + f1 * 0.5 + f3 * 0.45 + np.random.normal(0, 0.5)])[0]  # 探究促進

        rows.append([i + 1, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15])

    header = [
        "ID", "Q1_ICT有用性", "Q2_効率向上", "Q3_理解深化", "Q4_教材充実", "Q5_情報収集",
        "Q6_操作不安R", "Q7_トラブル不安R", "Q8_ついていけないR", "Q9_情報漏洩不安R",
        "Q10_協働楽しさ", "Q11_意見交換", "Q12_チーム作業", "Q13_発表機会", "Q14_多様な視点",
        "Q15_探究促進"
    ]

    filepath = DATASETS_DIR / "factor_analysis_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [5/8] factor_analysis_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 6. textmining_demo.csv — ICT教育の自由記述アンケート
# ============================================================
def generate_textmining_demo():
    comments_student = [
        "タブレットを使った授業は楽しいです。特にプログラミングの時間が好きです。",
        "デジタル教材は分かりやすいけど、目が疲れることがあります。",
        "オンライン授業で友達と協働学習できるのが良いと思います。チャットで気軽に質問できます。",
        "プログラミングは最初は難しかったけど、Scratchで慣れてきました。楽しいです。",
        "タブレットでの調べ学習が便利です。図書館に行かなくても色々調べられます。",
        "デジタル教材の動画はとても分かりやすいです。何度も見直せるのが良いです。",
        "Wi-Fiが遅い時があって困ります。もっと通信環境を良くしてほしいです。",
        "協働学習でスライドを一緒に作るのが楽しいです。友達の意見も聞けます。",
        "タブレットの操作は簡単ですが、タイピングはもっと練習が必要です。",
        "プログラミング授業でロボットを動かすのがとても面白かったです。",
        "オンラインテストはすぐに結果が分かるので好きです。",
        "デジタルポートフォリオで自分の作品を振り返れるのが嬉しいです。",
        "情報モラルの授業はためになりました。SNSの使い方を見直しました。",
        "ICTを使ったグループワークで発表力がついたと思います。",
        "タブレットが重くて持ち運びが大変です。もっと軽いものがいいです。",
        "プログラミングでゲームを作れるようになりたいです。もっと時間が欲しいです。",
        "オンライン授業は家でも勉強できるので便利ですが、集中しにくい時もあります。",
        "デジタル教材は紙の教科書より検索しやすいです。便利だと思います。",
        "協働学習で他のクラスの生徒と交流できたのが良い経験でした。",
        "情報セキュリティについてもっと詳しく学びたいです。パスワード管理が大事だと分かりました。",
    ]

    comments_teacher = [
        "タブレット導入により生徒の学習意欲が向上しています。個別最適化された指導が可能になりました。",
        "デジタル教材の作成に時間がかかりますが、一度作れば繰り返し使えるので効率的です。",
        "プログラミング教育の研修をもっと充実させてほしいです。教員のICTスキル向上が必要です。",
        "オンラインと対面のハイブリッド授業の進め方に悩んでいます。効果的な方法を模索中です。",
        "協働学習ツールを活用することで、生徒間のコミュニケーションが活発になりました。",
        "ICT機器のトラブル対応に時間を取られることがあります。サポート体制の強化を希望します。",
        "デジタル教材を活用した授業では生徒の理解度が高まっている印象です。",
        "保護者からのICT教育への関心が高まっています。家庭との連携が重要です。",
        "プログラミング的思考は他教科にも活かせると実感しています。教科横断的な指導を心がけています。",
        "オンライン上での生徒の安全を守るため、情報モラル教育の充実が不可欠です。",
        "ICTを活用した授業評価により、生徒一人ひとりの理解度を把握しやすくなりました。",
        "デジタル教科書の導入で授業準備の効率が大幅に改善されました。",
        "タブレット活用により探究学習の幅が広がりました。生徒が主体的に学ぶ姿が増えています。",
        "ICT研修で学んだことを校内で共有する仕組みを作りたいです。",
        "通信環境の安定化が最優先課題です。授業中の接続不良が学習効果を下げています。",
        "協働学習ではリーダーシップを発揮する生徒が増え、社会性の向上にもつながっています。",
        "デジタル教材と従来の教材を組み合わせた指導法が最も効果的だと感じています。",
        "プログラミング教育を通じて論理的思考力が養われていることを実感します。",
        "オンラインでの保護者面談も始まり、ICTの活用範囲が広がっています。",
        "AIドリルの導入で個別の学力に応じた課題を出せるようになりました。効果を感じています。",
    ]

    positions = (["生徒"] * 20) + (["教員"] * 20)
    school_types = ["小学校", "中学校", "高校"]
    genders = ["男性", "女性"]
    frequencies = ["毎日", "週数回", "週1回", "月数回"]
    base_date = "2025-"
    months = ["04", "05", "06", "07", "09", "10", "11", "12"]
    time_slots = ["午前", "午後", "夕方"]

    rows = []
    for i in range(40):
        position = positions[i]
        comment = comments_student[i] if i < 20 else comments_teacher[i - 20]
        school = np.random.choice(school_types)
        gender = np.random.choice(genders)

        if position == "教員":
            ict_exp = np.random.choice([3, 4, 5, 6, 7, 8, 10, 12, 15])
            satisfaction = np.random.choice([3, 4, 4, 5, 5])
            recommendation = np.random.choice([6, 7, 7, 8, 8, 9, 10])
            freq = np.random.choice(["毎日", "毎日", "週数回", "週数回"])
        else:
            ict_exp = np.random.choice([1, 2, 2, 3, 3, 4, 5])
            satisfaction = np.random.choice([3, 3, 4, 4, 5, 5])
            recommendation = np.random.choice([5, 6, 7, 7, 8, 8, 9])
            freq = np.random.choice(frequencies)

        month = months[i % len(months)]
        day = str(np.random.randint(1, 28)).zfill(2)
        date = f"{base_date}{month}-{day}"
        time_slot = np.random.choice(time_slots)

        rows.append([
            i + 1, date, time_slot, position, school, gender,
            ict_exp, satisfaction, recommendation, freq, comment
        ])

    header = [
        "ID", "回答日", "時間帯", "立場", "学校種", "性別",
        "ICT経験年数", "満足度", "推奨度", "利用頻度", "コメント"
    ]

    filepath = DATASETS_DIR / "textmining_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [6/8] textmining_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 7. time_series_demo.csv — ICT教育導入の経時変化（36ヶ月）
# ============================================================
def generate_time_series_demo():
    rows = []
    base_year = 2023
    base_month = 4  # 4月始まり

    for i in range(36):
        year = base_year + (base_month + i - 1) // 12
        month = ((base_month + i - 1) % 12) + 1
        date_str = f"{year}-{str(month).zfill(2)}"

        t = i / 35  # 正規化時間 [0, 1]

        # ICT活用率: 上昇トレンド + 4月に低下（年度初め効果）
        april_dip = -8 if month == 4 else (-4 if month == 5 else 0)
        summer_dip = -3 if month in [7, 8] else 0
        ict_usage = clamp(
            round(30 + 45 * t + april_dip + summer_dip + np.random.normal(0, 3), 1),
            15, 90
        )

        # 平均テスト得点: ゆるやかな上昇 + ノイズ
        test_score = clamp(
            round(62 + 15 * t + april_dip * 0.3 + np.random.normal(0, 2.5), 1),
            50, 85
        )

        # デジタル教材利用数: 増加トレンド
        digital_materials = clamp(
            int(round(15 + 80 * t + april_dip * 2 + summer_dip * 3 + np.random.normal(0, 5))),
            5, 120
        )

        # 教員研修時間: 段階的増加
        training_hours = clamp(
            round(5 + 20 * t + (3 if month in [4, 8] else 0) + np.random.normal(0, 2), 1),
            2, 30
        )

        rows.append([i + 1, date_str, ict_usage, test_score, digital_materials, training_hours])

    header = ["ID", "年月", "ICT活用率", "平均テスト得点", "デジタル教材利用数", "教員研修時間"]

    filepath = DATASETS_DIR / "time_series_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [7/8] time_series_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# 8. logistic_demo.csv — ICT活用能力認定試験の合否予測
# ============================================================
def generate_logistic_demo():
    n = 50
    rows = []

    for i in range(n):
        latent = np.random.normal(0, 1)

        ict_class_hours = clamp(round(np.random.normal(30 + latent * 10, 8), 1), 5, 60)
        pretest = clamp(round(np.random.normal(55 + latent * 10, 10), 1), 20, 90)
        self_study = clamp(round(np.random.normal(10 + latent * 5, 4), 1), 0, 30)
        prog_exp = np.random.choice(["あり", "なし"], p=[0.4 + latent * 0.1 if latent > -3 else 0.1,
                                                          1 - (0.4 + latent * 0.1) if latent > -3 else 0.9])
        teacher_eval = clamp(round(np.random.normal(3.5 + latent * 0.5, 0.7), 1), 1, 5)
        online_use = clamp(round(np.random.normal(3.0 + latent * 0.6, 0.8), 1), 1, 5)

        # 合否判定（ロジスティック回帰で予測可能なパターン）
        logit = (
            -6
            + 0.05 * ict_class_hours
            + 0.06 * pretest
            + 0.08 * self_study
            + (0.8 if prog_exp == "あり" else 0)
            + 0.4 * teacher_eval
            + 0.3 * online_use
        )
        prob = 1 / (1 + np.exp(-logit))
        result = "合格" if np.random.random() < prob else "不合格"

        rows.append([
            i + 1, ict_class_hours, pretest, self_study,
            prog_exp, teacher_eval, online_use, result
        ])

    header = [
        "ID", "ICT授業参加時間", "事前テスト得点", "自学自習時間",
        "プログラミング経験", "教師評価", "オンライン学習利用", "合否"
    ]

    filepath = DATASETS_DIR / "logistic_demo.csv"
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"  [8/8] logistic_demo.csv: {len(rows)}行 x {len(header)}列")


# ============================================================
# メイン実行
# ============================================================
if __name__ == "__main__":
    print("=== ICT教育テーマ デモデータ生成 ===\n")
    generate_demo_all_analysis()
    generate_ttest_demo()
    generate_anova_demo()
    generate_multiple_regression_demo()
    generate_factor_analysis_demo()
    generate_textmining_demo()
    generate_time_series_demo()
    generate_logistic_demo()
    print("\n=== 全データセット生成完了 ===")
