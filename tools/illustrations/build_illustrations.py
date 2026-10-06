"""easyStat の説明イラストを、計算どおりの正確な図（SVG）として生成する。

画像生成AIでは数値と図の位置がずれるため、図はすべて計算で描く。
構成は全図共通：上に生徒の問い → 比べる場合を並べた図 → それぞれの読み方 → 1行のまとめ。

使い方: python3 tools/illustrations/build_illustrations.py [名前 ...]
出力:   image/illustrations/<名前>.svg
確認:   python3 tools/illustrations/verify.py（図のデータで実際に検定し、説明と合うか確かめる）
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fig_category  # noqa: E402
import fig_compare  # noqa: E402
import fig_data  # noqa: E402
import fig_relation  # noqa: E402

OUT_DIR = Path(__file__).resolve().parents[2] / 'image' / 'illustrations'

FIGURES = {
    **fig_compare.FIGURES,
    **fig_relation.FIGURES,
    **fig_category.FIGURES,
    **fig_data.FIGURES,
}


def main(names: list[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in names or FIGURES:
        path = OUT_DIR / f'{name}.svg'
        path.write_text(FIGURES[name](), encoding='utf-8')
        print(f'wrote image/illustrations/{path.name}')


if __name__ == '__main__':
    main(sys.argv[1:])
