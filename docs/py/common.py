"""
easyStat - PyScript共通関数
ブラウザ上で動作する統計分析用の共通関数
"""

import io
import base64
import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
from js import document, FileReader, Uint8Array, console
from pyodide.ffi import create_proxy
import json

# グローバル変数
current_df = None


def load_file_data(file_content, filename):
    """
    ファイルデータを読み込んでDataFrameに変換

    Parameters:
    -----------
    file_content : ArrayBuffer or str
        ファイルの内容
    filename : str
        ファイル名

    Returns:
    --------
    bool
        読み込み成功ならTrue
    """
    global current_df

    try:
        console.log(f"ファイル読み込み開始: {filename}")

        if filename.endswith('.csv'):
            # CSVファイルの場合
            console.log("CSV形式として読み込み中...")
            try:
                # UTF-8で試行
                current_df = pd.read_csv(io.StringIO(file_content))
                console.log("UTF-8で読み込み成功")
            except (UnicodeDecodeError, Exception) as e:
                console.log(f"UTF-8失敗、Shift-JISで試行: {str(e)}")
                try:
                    # Shift-JISで試行
                    current_df = pd.read_csv(io.StringIO(file_content), encoding='shift_jis')
                    console.log("Shift-JISで読み込み成功")
                except Exception as e2:
                    console.log(f"Shift-JISも失敗: {str(e2)}")
                    # ISO-8859-1で最終試行
                    current_df = pd.read_csv(io.StringIO(file_content), encoding='latin1')
                    console.log("Latin1で読み込み成功")

        elif filename.endswith(('.xlsx', '.xls')):
            # Excelファイルの場合
            console.log("Excel形式として読み込み中...")

            # ArrayBufferをbytesに変換
            if isinstance(file_content, str):
                # 文字列の場合はエンコード
                bytes_data = file_content.encode('latin1')
            else:
                # ArrayBufferの場合
                try:
                    # PyodideのArrayBufferをbytesに変換
                    bytes_data = file_content.to_bytes()
                except:
                    # 別の方法で変換
                    bytes_data = bytes(file_content)

            current_df = pd.read_excel(io.BytesIO(bytes_data))
            console.log("Excel読み込み成功")

        else:
            raise ValueError(f"対応していないファイル形式です: {filename}")

        # データの検証
        if current_df is None or current_df.empty:
            raise ValueError("データが空です")

        # 基本情報をコンソールに出力
        n_rows, n_cols = current_df.shape
        console.log(f"✅ データ読み込み成功: {n_rows}行, {n_cols}列")
        console.log(f"列名: {list(current_df.columns)}")

        return True

    except Exception as e:
        console.error(f"❌ ファイル読み込みエラー: {str(e)}")
        import traceback
        console.error(traceback.format_exc())
        return False


def get_column_names():
    """
    DataFrameの列名リストを取得

    Returns:
    --------
    list
        列名のリスト
    """
    global current_df

    if current_df is None:
        return []

    return current_df.columns.tolist()


def get_data_characteristics():
    """
    データの特性を分析して利用可能な分析手法を判定

    Returns:
    --------
    dict
        データ特性の辞書（数値変数数、カテゴリカル変数数、テキスト変数数など）
    """
    global current_df

    if current_df is None:
        return {
            'numeric_columns': 0,
            'categorical_columns': 0,
            'text_columns': 0,
            'total_columns': 0,
            'row_count': 0
        }

    # 数値型の列を特定
    numeric_cols = current_df.select_dtypes(include=[np.number]).columns.tolist()

    # カテゴリカル型の列を特定（オブジェクト型でユニーク値が少ない列）
    categorical_cols = []
    text_cols = []

    for col in current_df.select_dtypes(include=['object']).columns:
        unique_ratio = current_df[col].nunique() / len(current_df)
        # ユニーク値の比率が30%未満ならカテゴリカル、それ以外はテキスト
        if unique_ratio < 0.3:
            categorical_cols.append(col)
        else:
            text_cols.append(col)

    characteristics = {
        'numeric_columns': len(numeric_cols),
        'categorical_columns': len(categorical_cols),
        'text_columns': len(text_cols),
        'total_columns': len(current_df.columns),
        'row_count': len(current_df),
        'numeric_column_names': numeric_cols,
        'categorical_column_names': categorical_cols,
        'text_column_names': text_cols
    }

    console.log(f"データ特性: {json.dumps(characteristics)}")
    return characteristics


def get_numeric_columns():
    """
    数値型の列名リストを取得

    Returns:
    --------
    list
        数値型の列名リスト
    """
    global current_df

    if current_df is None:
        return []

    return current_df.select_dtypes(include=[np.number]).columns.tolist()


def get_data_summary():
    """
    データの基本統計量を取得

    Returns:
    --------
    str
        HTML形式の統計量サマリー
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    # 基本情報
    n_rows, n_cols = current_df.shape

    html = f"""
    <div class="data-summary">
        <h3>データ概要</h3>
        <p>行数: {n_rows}</p>
        <p>列数: {n_cols}</p>
        <h4>データプレビュー</h4>
        {current_df.head(10).to_html(classes='table')}
        <h4>基本統計量</h4>
        {current_df.describe().to_html(classes='table')}
    </div>
    """

    return html


# ==========================================
# 相関分析
# ==========================================

def run_correlation_analysis(var1, var2):
    """
    相関分析を実行

    Parameters:
    -----------
    var1 : str
        変数1の列名
    var2 : str
        変数2の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # データ抽出
        x = current_df[var1].dropna()
        y = current_df[var2].dropna()

        # 共通のインデックスで抽出
        common_idx = x.index.intersection(y.index)
        x = x.loc[common_idx]
        y = y.loc[common_idx]

        if len(x) < 3:
            return "<p>データが不足しています（最低3件必要）</p>"

        # 相関係数を計算
        r, p_value = stats.pearsonr(x, y)

        # 散布図を作成（matplotlib使用）
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.scatter(x, y, alpha=0.6)
        ax.set_xlabel(var1)
        ax.set_ylabel(var2)
        ax.set_title(f'{var1} vs {var2} の散布図')
        ax.grid(True, alpha=0.3)

        # 回帰直線を追加
        z = np.polyfit(x, y, 1)
        p = np.poly1d(z)
        ax.plot(x, p(x), "r--", alpha=0.8, label=f'y = {z[0]:.3f}x + {z[1]:.3f}')
        ax.legend()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>相関分析結果</h3>
            <div class="results-summary">
                <h4>統計量</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>サンプルサイズ</td><td>{len(x)}</td></tr>
                    <tr><td>相関係数 (r)</td><td>{r:.4f}</td></tr>
                    <tr><td>p値</td><td>{p_value:.4f}</td></tr>
                    <tr><td>統計的有意性</td><td>{'有意 (p < 0.05)' if p_value < 0.05 else '有意ではない (p ≥ 0.05)'}</td></tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>相関の強さ:</strong> {get_correlation_strength(r)}</p>
                <p><strong>相関の方向:</strong> {'正の相関' if r > 0 else '負の相関'}</p>
                <p><strong>統計的有意性:</strong>
                    {'2つの変数には統計的に有意な相関があります' if p_value < 0.05 else '統計的に有意な相関は認められませんでした'}
                </p>
            </div>

            <div class="results-plot">
                <h4>散布図</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


def get_correlation_strength(r):
    """
    相関係数から相関の強さを判定

    Parameters:
    -----------
    r : float
        相関係数

    Returns:
    --------
    str
        相関の強さの説明
    """
    abs_r = abs(r)

    if abs_r >= 0.7:
        return f"強い相関 (|r| = {abs_r:.3f})"
    elif abs_r >= 0.3:
        return f"中程度の相関 (|r| = {abs_r:.3f})"
    else:
        return f"弱い相関 (|r| = {abs_r:.3f})"


# ==========================================
# 探索的データ分析（EDA）
# ==========================================

def run_eda_analysis(variable):
    """
    探索的データ分析を実行

    Parameters:
    -----------
    variable : str
        分析する変数の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        data = current_df[variable].dropna()

        if len(data) < 1:
            return "<p>データが不足しています</p>"

        # 記述統計量を計算
        mean_val = data.mean()
        median_val = data.median()
        std_val = data.std()
        min_val = data.min()
        max_val = data.max()
        q1 = data.quantile(0.25)
        q3 = data.quantile(0.75)

        # ヒストグラムを作成
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

        # ヒストグラム
        ax1.hist(data, bins=30, edgecolor='black', alpha=0.7)
        ax1.axvline(mean_val, color='red', linestyle='--', label=f'平均: {mean_val:.2f}')
        ax1.axvline(median_val, color='green', linestyle='--', label=f'中央値: {median_val:.2f}')
        ax1.set_xlabel(variable)
        ax1.set_ylabel('度数')
        ax1.set_title('ヒストグラム')
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        # 箱ひげ図
        ax2.boxplot(data, vert=True)
        ax2.set_ylabel(variable)
        ax2.set_title('箱ひげ図')
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>探索的データ分析結果: {variable}</h3>

            <div class="results-summary">
                <h4>記述統計量</h4>
                <table class="table">
                    <tr><th>統計量</th><th>値</th></tr>
                    <tr><td>サンプルサイズ</td><td>{len(data)}</td></tr>
                    <tr><td>平均値</td><td>{mean_val:.4f}</td></tr>
                    <tr><td>中央値</td><td>{median_val:.4f}</td></tr>
                    <tr><td>標準偏差</td><td>{std_val:.4f}</td></tr>
                    <tr><td>最小値</td><td>{min_val:.4f}</td></tr>
                    <tr><td>第1四分位数 (Q1)</td><td>{q1:.4f}</td></tr>
                    <tr><td>第3四分位数 (Q3)</td><td>{q3:.4f}</td></tr>
                    <tr><td>最大値</td><td>{max_val:.4f}</td></tr>
                </table>
            </div>

            <div class="results-plot">
                <h4>グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# t検定
# ==========================================

def run_ttest_analysis(test_type, var1, var2):
    """
    t検定を実行

    Parameters:
    -----------
    test_type : str
        検定タイプ ('independent' or 'paired')
    var1 : str
        変数1の列名
    var2 : str
        変数2の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # データ抽出
        data1 = current_df[var1].dropna()
        data2 = current_df[var2].dropna()

        if test_type == 'paired':
            # 対応あり: 共通のインデックスで抽出
            common_idx = data1.index.intersection(data2.index)
            data1 = data1.loc[common_idx]
            data2 = data2.loc[common_idx]

            if len(data1) < 3:
                return "<p>データが不足しています（最低3件必要）</p>"

            # 対応ありt検定
            t_stat, p_value = stats.ttest_rel(data1, data2)
            test_name = "対応ありt検定"
        else:
            # 対応なしt検定
            if len(data1) < 2 or len(data2) < 2:
                return "<p>各グループに最低2件のデータが必要です</p>"

            t_stat, p_value = stats.ttest_ind(data1, data2)
            test_name = "対応なしt検定"

        # 効果量（Cohen's d）を計算
        pooled_std = np.sqrt((data1.std()**2 + data2.std()**2) / 2)
        cohens_d = (data1.mean() - data2.mean()) / pooled_std if pooled_std != 0 else 0

        # 箱ひげ図を作成
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.boxplot([data1, data2], labels=[var1, var2])
        ax.set_ylabel('値')
        ax.set_title(f'{test_name}: {var1} vs {var2}')
        ax.grid(True, alpha=0.3)

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>{test_name}結果</h3>

            <div class="results-summary">
                <h4>記述統計量</h4>
                <table class="table">
                    <tr><th>グループ</th><th>サンプルサイズ</th><th>平均値</th><th>標準偏差</th></tr>
                    <tr><td>{var1}</td><td>{len(data1)}</td><td>{data1.mean():.4f}</td><td>{data1.std():.4f}</td></tr>
                    <tr><td>{var2}</td><td>{len(data2)}</td><td>{data2.mean():.4f}</td><td>{data2.std():.4f}</td></tr>
                </table>

                <h4>検定結果</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>t統計量</td><td>{t_stat:.4f}</td></tr>
                    <tr><td>p値</td><td>{p_value:.4f}</td></tr>
                    <tr><td>効果量 (Cohen's d)</td><td>{cohens_d:.4f}</td></tr>
                    <tr><td>統計的有意性</td><td>{'有意 (p < 0.05)' if p_value < 0.05 else '有意ではない (p ≥ 0.05)'}</td></tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>効果量の大きさ:</strong> {get_effect_size_interpretation(cohens_d)}</p>
                <p><strong>統計的有意性:</strong>
                    {'2つのグループ間に統計的に有意な差があります' if p_value < 0.05 else '統計的に有意な差は認められませんでした'}
                </p>
            </div>

            <div class="results-plot">
                <h4>箱ひげ図</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


def get_effect_size_interpretation(d):
    """
    効果量の解釈を返す

    Parameters:
    -----------
    d : float
        Cohen's d

    Returns:
    --------
    str
        効果量の解釈
    """
    abs_d = abs(d)

    if abs_d >= 0.8:
        return f"大きい効果 (|d| = {abs_d:.3f})"
    elif abs_d >= 0.5:
        return f"中程度の効果 (|d| = {abs_d:.3f})"
    elif abs_d >= 0.2:
        return f"小さい効果 (|d| = {abs_d:.3f})"
    else:
        return f"効果はほとんどない (|d| = {abs_d:.3f})"


# ==========================================
# カイ二乗検定
# ==========================================

def run_chi_square_analysis(var1, var2):
    """
    カイ二乗検定を実行

    Parameters:
    -----------
    var1 : str
        変数1の列名
    var2 : str
        変数2の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # クロス集計表を作成
        crosstab = pd.crosstab(current_df[var1], current_df[var2])

        # カイ二乗検定を実行
        chi2, p_value, dof, expected = stats.chi2_contingency(crosstab)

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>カイ二乗検定結果</h3>

            <div class="results-summary">
                <h4>クロス集計表</h4>
                {crosstab.to_html(classes='table')}

                <h4>検定結果</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>カイ二乗統計量</td><td>{chi2:.4f}</td></tr>
                    <tr><td>自由度</td><td>{dof}</td></tr>
                    <tr><td>p値</td><td>{p_value:.4f}</td></tr>
                    <tr><td>統計的有意性</td><td>{'有意 (p < 0.05)' if p_value < 0.05 else '有意ではない (p ≥ 0.05)'}</td></tr>
                </table>

                <h4>期待度数</h4>
                {pd.DataFrame(expected, index=crosstab.index, columns=crosstab.columns).to_html(classes='table')}
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>統計的有意性:</strong>
                    {'2つの変数には統計的に有意な関連があります' if p_value < 0.05 else '統計的に有意な関連は認められませんでした'}
                </p>
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# 一要因分散分析（ANOVA）
# ==========================================

def run_anova_analysis(groups):
    """
    一要因分散分析を実行

    Parameters:
    -----------
    groups : list
        分析する変数の列名リスト

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # データ抽出
        group_data = [current_df[col].dropna() for col in groups]

        if len(group_data) < 2:
            return "<p>最低2つのグループが必要です</p>"

        # 一要因分散分析を実行
        f_stat, p_value = stats.f_oneway(*group_data)

        # 記述統計量を計算
        stats_data = []
        for i, col in enumerate(groups):
            data = group_data[i]
            stats_data.append({
                'グループ': col,
                'サンプルサイズ': len(data),
                '平均値': data.mean(),
                '標準偏差': data.std()
            })

        stats_df = pd.DataFrame(stats_data)

        # 箱ひげ図を作成
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.boxplot(group_data, labels=groups)
        ax.set_ylabel('値')
        ax.set_title('一要因分散分析')
        ax.grid(True, alpha=0.3)

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>一要因分散分析結果</h3>

            <div class="results-summary">
                <h4>記述統計量</h4>
                {stats_df.to_html(classes='table', index=False)}

                <h4>検定結果</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>F統計量</td><td>{f_stat:.4f}</td></tr>
                    <tr><td>p値</td><td>{p_value:.4f}</td></tr>
                    <tr><td>統計的有意性</td><td>{'有意 (p < 0.05)' if p_value < 0.05 else '有意ではない (p ≥ 0.05)'}</td></tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>統計的有意性:</strong>
                    {'グループ間に統計的に有意な差があります' if p_value < 0.05 else 'グループ間に統計的に有意な差は認められませんでした'}
                </p>
            </div>

            <div class="results-plot">
                <h4>箱ひげ図</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# 単回帰分析
# ==========================================

def run_simple_regression_analysis(x_var, y_var):
    """
    単回帰分析を実行

    Parameters:
    -----------
    x_var : str
        説明変数の列名
    y_var : str
        目的変数の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # データ抽出
        x = current_df[x_var].dropna()
        y = current_df[y_var].dropna()

        # 共通のインデックスで抽出
        common_idx = x.index.intersection(y.index)
        x = x.loc[common_idx]
        y = y.loc[common_idx]

        if len(x) < 3:
            return "<p>データが不足しています（最低3件必要）</p>"

        # 回帰分析を実行
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        r_squared = r_value ** 2

        # 予測値を計算
        y_pred = slope * x + intercept
        residuals = y - y_pred

        # グラフを作成
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # 散布図と回帰直線
        ax1.scatter(x, y, alpha=0.6, label='実測値')
        ax1.plot(x, y_pred, 'r-', label=f'回帰直線: y = {slope:.3f}x + {intercept:.3f}')
        ax1.set_xlabel(x_var)
        ax1.set_ylabel(y_var)
        ax1.set_title('単回帰分析')
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        # 残差プロット
        ax2.scatter(y_pred, residuals, alpha=0.6)
        ax2.axhline(y=0, color='r', linestyle='--')
        ax2.set_xlabel('予測値')
        ax2.set_ylabel('残差')
        ax2.set_title('残差プロット')
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>単回帰分析結果</h3>

            <div class="results-summary">
                <h4>回帰係数</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>切片</td><td>{intercept:.4f}</td></tr>
                    <tr><td>傾き（{x_var}の係数）</td><td>{slope:.4f}</td></tr>
                    <tr><td>標準誤差</td><td>{std_err:.4f}</td></tr>
                </table>

                <h4>モデルの適合度</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>決定係数 (R²)</td><td>{r_squared:.4f}</td></tr>
                    <tr><td>相関係数 (r)</td><td>{r_value:.4f}</td></tr>
                    <tr><td>p値</td><td>{p_value:.4f}</td></tr>
                    <tr><td>サンプルサイズ</td><td>{len(x)}</td></tr>
                </table>

                <h4>回帰式</h4>
                <p><strong>{y_var} = {slope:.4f} × {x_var} + {intercept:.4f}</strong></p>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>決定係数 (R²):</strong> モデルは{y_var}の変動の{r_squared*100:.1f}%を説明しています</p>
                <p><strong>統計的有意性:</strong>
                    {'回帰モデルは統計的に有意です' if p_value < 0.05 else '回帰モデルは統計的に有意ではありません'}
                </p>
            </div>

            <div class="results-plot">
                <h4>グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# 主成分分析（PCA）
# ==========================================

def run_pca_analysis(n_components=2):
    """
    主成分分析を実行

    Parameters:
    -----------
    n_components : int
        抽出する主成分の数

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        # 数値列のみを抽出
        numeric_cols = get_numeric_columns()

        if len(numeric_cols) < 2:
            return "<p>数値型の変数が2つ以上必要です</p>"

        # データ抽出と欠損値除去
        data = current_df[numeric_cols].dropna()

        if len(data) < n_components:
            return f"<p>データが不足しています（最低{n_components}件必要）</p>"

        # データを標準化
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data)

        # PCA実行
        pca = PCA(n_components=min(n_components, len(numeric_cols)))
        pca_result = pca.fit_transform(data_scaled)

        # 寄与率と累積寄与率
        explained_variance = pca.explained_variance_ratio_ * 100
        cumulative_variance = np.cumsum(explained_variance)

        # グラフを作成
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # 寄与率の棒グラフ
        ax1.bar(range(1, len(explained_variance) + 1), explained_variance)
        ax1.set_xlabel('主成分')
        ax1.set_ylabel('寄与率 (%)')
        ax1.set_title('主成分の寄与率')
        ax1.grid(True, alpha=0.3)

        # 散布図（第1・第2主成分）
        if pca_result.shape[1] >= 2:
            ax2.scatter(pca_result[:, 0], pca_result[:, 1], alpha=0.6)
            ax2.set_xlabel(f'第1主成分 ({explained_variance[0]:.1f}%)')
            ax2.set_ylabel(f'第2主成分 ({explained_variance[1]:.1f}%)')
            ax2.set_title('主成分散布図')
            ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 寄与率テーブル作成
        variance_df = pd.DataFrame({
            '主成分': [f'第{i+1}主成分' for i in range(len(explained_variance))],
            '寄与率 (%)': explained_variance,
            '累積寄与率 (%)': cumulative_variance
        })

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>主成分分析結果</h3>

            <div class="results-summary">
                <h4>寄与率</h4>
                {variance_df.to_html(classes='table', index=False)}

                <h4>分析情報</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>使用変数数</td><td>{len(numeric_cols)}</td></tr>
                    <tr><td>サンプルサイズ</td><td>{len(data)}</td></tr>
                    <tr><td>抽出主成分数</td><td>{pca_result.shape[1]}</td></tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>累積寄与率:</strong> 第{pca_result.shape[1]}主成分までで全体の{cumulative_variance[-1]:.1f}%の情報を保持しています</p>
            </div>

            <div class="results-plot">
                <h4>グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# データクレンジング
# ==========================================

def run_data_cleansing():
    """
    データクレンジング機能のUI生成と処理

    Returns:
    --------
    str
        HTML形式のクレンジング結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # 欠損値情報
        missing_info = current_df.isnull().sum()
        missing_df = pd.DataFrame({
            '変数名': missing_info.index,
            '欠損値数': missing_info.values,
            '欠損率 (%)': (missing_info.values / len(current_df) * 100).round(2)
        })

        # 重複行情報
        n_duplicates = current_df.duplicated().sum()

        # データ型情報
        dtypes_df = pd.DataFrame({
            '変数名': current_df.columns,
            'データ型': [str(dtype) for dtype in current_df.dtypes]
        })

        # 基本統計量
        numeric_cols = get_numeric_columns()
        if len(numeric_cols) > 0:
            stats_html = current_df[numeric_cols].describe().to_html(classes='table')
        else:
            stats_html = "<p>数値型の変数がありません</p>"

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>データクレンジング情報</h3>

            <div class="results-summary">
                <h4>データ概要</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>総行数</td><td>{len(current_df)}</td></tr>
                    <tr><td>総列数</td><td>{len(current_df.columns)}</td></tr>
                    <tr><td>重複行数</td><td>{n_duplicates}</td></tr>
                </table>

                <h4>欠損値情報</h4>
                {missing_df.to_html(classes='table', index=False)}

                <h4>データ型</h4>
                {dtypes_df.to_html(classes='table', index=False)}

                <h4>基本統計量（数値変数）</h4>
                {stats_html}
            </div>

            <div class="cleansing-actions">
                <h4>クレンジング操作</h4>
                <p>以下の操作をJavaScript側で実装してください:</p>
                <ul>
                    <li>欠損値の除去（行単位または列単位）</li>
                    <li>欠損値の補完（平均値、中央値、最頻値）</li>
                    <li>重複行の除去</li>
                    <li>外れ値の検出と除去</li>
                </ul>
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


def remove_missing_rows():
    """欠損値を含む行を削除"""
    global current_df
    if current_df is not None:
        original_len = len(current_df)
        current_df = current_df.dropna()
        removed = original_len - len(current_df)
        return f"✅ {removed}行を削除しました（残り: {len(current_df)}行）"
    return "❌ データが読み込まれていません"


def remove_duplicates():
    """重複行を削除"""
    global current_df
    if current_df is not None:
        original_len = len(current_df)
        current_df = current_df.drop_duplicates()
        removed = original_len - len(current_df)
        return f"✅ {removed}行の重複を削除しました（残り: {len(current_df)}行）"
    return "❌ データが読み込まれていません"


def fill_missing_mean():
    """欠損値を平均値で補完（数値列のみ）"""
    global current_df
    if current_df is not None:
        numeric_cols = get_numeric_columns()
        for col in numeric_cols:
            current_df[col].fillna(current_df[col].mean(), inplace=True)
        return f"✅ 数値列の欠損値を平均値で補完しました"
    return "❌ データが読み込まれていません"


# ==========================================
# 二要因分散分析
# ==========================================

def run_two_way_anova(factor1, factor2, dependent_var):
    """
    二要因分散分析を実行

    Parameters:
    -----------
    factor1 : str
        第1要因の列名
    factor2 : str
        第2要因の列名
    dependent_var : str
        従属変数の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # データ抽出
        data = current_df[[factor1, factor2, dependent_var]].dropna()

        if len(data) < 3:
            return "<p>データが不足しています（最低3件必要）</p>"

        # グループごとの記述統計量
        grouped = data.groupby([factor1, factor2])[dependent_var].agg(['mean', 'std', 'count'])

        # 簡易的な二要因分散分析（statsmodelsがない場合の代替）
        # 主効果と交互作用を個別に検定

        # 第1要因の主効果
        groups_f1 = [group[dependent_var].values for name, group in data.groupby(factor1)]
        f1_stat, f1_pvalue = stats.f_oneway(*groups_f1)

        # 第2要因の主効果
        groups_f2 = [group[dependent_var].values for name, group in data.groupby(factor2)]
        f2_stat, f2_pvalue = stats.f_oneway(*groups_f2)

        # 箱ひげ図を作成
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        # 第1要因の箱ひげ図
        data.boxplot(column=dependent_var, by=factor1, ax=axes[0])
        axes[0].set_title(f'{factor1}の主効果')
        axes[0].set_xlabel(factor1)
        axes[0].set_ylabel(dependent_var)

        # 第2要因の箱ひげ図
        data.boxplot(column=dependent_var, by=factor2, ax=axes[1])
        axes[1].set_title(f'{factor2}の主効果')
        axes[1].set_xlabel(factor2)
        axes[1].set_ylabel(dependent_var)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>二要因分散分析結果</h3>

            <div class="results-summary">
                <h4>記述統計量</h4>
                {grouped.to_html(classes='table')}

                <h4>主効果の検定</h4>
                <table class="table">
                    <tr><th>要因</th><th>F統計量</th><th>p値</th><th>統計的有意性</th></tr>
                    <tr>
                        <td>{factor1}</td>
                        <td>{f1_stat:.4f}</td>
                        <td>{f1_pvalue:.4f}</td>
                        <td>{'有意 (p < 0.05)' if f1_pvalue < 0.05 else '有意ではない'}</td>
                    </tr>
                    <tr>
                        <td>{factor2}</td>
                        <td>{f2_stat:.4f}</td>
                        <td>{f2_pvalue:.4f}</td>
                        <td>{'有意 (p < 0.05)' if f2_pvalue < 0.05 else '有意ではない'}</td>
                    </tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>{factor1}の主効果:</strong>
                    {'統計的に有意な効果があります' if f1_pvalue < 0.05 else '統計的に有意な効果は認められませんでした'}
                </p>
                <p><strong>{factor2}の主効果:</strong>
                    {'統計的に有意な効果があります' if f2_pvalue < 0.05 else '統計的に有意な効果は認められませんでした'}
                </p>
                <p class="text-muted">注: この実装では交互作用の検定は含まれていません</p>
            </div>

            <div class="results-plot">
                <h4>箱ひげ図</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# 重回帰分析
# ==========================================

def run_multiple_regression(x_vars, y_var):
    """
    重回帰分析を実行

    Parameters:
    -----------
    x_vars : list
        説明変数の列名リスト
    y_var : str
        目的変数の列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        from sklearn.linear_model import LinearRegression
        from sklearn.metrics import r2_score, mean_squared_error

        # データ抽出
        all_vars = x_vars + [y_var]
        data = current_df[all_vars].dropna()

        if len(data) < len(x_vars) + 2:
            return f"<p>データが不足しています（最低{len(x_vars) + 2}件必要）</p>"

        X = data[x_vars].values
        y = data[y_var].values

        # 重回帰分析を実行
        model = LinearRegression()
        model.fit(X, y)

        # 予測値
        y_pred = model.predict(X)

        # 決定係数
        r_squared = r2_score(y, y_pred)

        # 調整済み決定係数
        n = len(data)
        p = len(x_vars)
        adj_r_squared = 1 - (1 - r_squared) * (n - 1) / (n - p - 1)

        # RMSE
        rmse = np.sqrt(mean_squared_error(y, y_pred))

        # 回帰係数のDataFrame
        coef_df = pd.DataFrame({
            '変数': ['切片'] + x_vars,
            '係数': [model.intercept_] + list(model.coef_)
        })

        # グラフを作成
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # 予測値vs実測値
        ax1.scatter(y, y_pred, alpha=0.6)
        ax1.plot([y.min(), y.max()], [y.min(), y.max()], 'r--', lw=2)
        ax1.set_xlabel('実測値')
        ax1.set_ylabel('予測値')
        ax1.set_title('予測値 vs 実測値')
        ax1.grid(True, alpha=0.3)

        # 残差プロット
        residuals = y - y_pred
        ax2.scatter(y_pred, residuals, alpha=0.6)
        ax2.axhline(y=0, color='r', linestyle='--')
        ax2.set_xlabel('予測値')
        ax2.set_ylabel('残差')
        ax2.set_title('残差プロット')
        ax2.grid(True, alpha=0.3)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 回帰式を作成
        equation_parts = [f"{model.intercept_:.4f}"]
        for var, coef in zip(x_vars, model.coef_):
            sign = '+' if coef >= 0 else ''
            equation_parts.append(f"{sign}{coef:.4f}×{var}")
        equation = f"{y_var} = " + " ".join(equation_parts)

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>重回帰分析結果</h3>

            <div class="results-summary">
                <h4>モデルの適合度</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>決定係数 (R²)</td><td>{r_squared:.4f}</td></tr>
                    <tr><td>調整済みR²</td><td>{adj_r_squared:.4f}</td></tr>
                    <tr><td>RMSE</td><td>{rmse:.4f}</td></tr>
                    <tr><td>サンプルサイズ</td><td>{n}</td></tr>
                    <tr><td>説明変数数</td><td>{p}</td></tr>
                </table>

                <h4>回帰係数</h4>
                {coef_df.to_html(classes='table', index=False)}

                <h4>回帰式</h4>
                <p><strong>{equation}</strong></p>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>モデルの説明力:</strong>
                    このモデルは{y_var}の変動の{r_squared*100:.1f}%を説明しています
                </p>
                <p><strong>調整済みR²:</strong>
                    変数の数を考慮した説明力は{adj_r_squared*100:.1f}%です
                </p>
            </div>

            <div class="results-plot">
                <h4>グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# 因子分析
# ==========================================

def run_factor_analysis(n_factors=2):
    """
    因子分析を実行

    Parameters:
    -----------
    n_factors : int
        抽出する因子数

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        # 数値列のみを抽出
        numeric_cols = get_numeric_columns()

        if len(numeric_cols) < 3:
            return "<p>因子分析には最低3つの数値変数が必要です</p>"

        # データ抽出と欠損値除去
        data = current_df[numeric_cols].dropna()

        if len(data) < n_factors * 3:
            return f"<p>データが不足しています（最低{n_factors * 3}件推奨）</p>"

        # PCAで代替（本格的な因子分析はfactor_analyzerが必要）
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        # データを標準化
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data)

        # PCA実行
        pca = PCA(n_components=min(n_factors, len(numeric_cols)))
        pca_result = pca.fit_transform(data_scaled)

        # 因子負荷量（主成分負荷量）
        loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
        loadings_df = pd.DataFrame(
            loadings,
            columns=[f'因子{i+1}' for i in range(loadings.shape[1])],
            index=numeric_cols
        )

        # 寄与率
        explained_variance = pca.explained_variance_ratio_ * 100
        cumulative_variance = np.cumsum(explained_variance)

        # グラフを作成
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        # スクリープロット
        ax1.bar(range(1, len(explained_variance) + 1), explained_variance)
        ax1.set_xlabel('因子')
        ax1.set_ylabel('寄与率 (%)')
        ax1.set_title('スクリープロット')
        ax1.grid(True, alpha=0.3)

        # 因子負荷量のヒートマップ
        im = ax2.imshow(loadings, cmap='RdBu_r', aspect='auto', vmin=-1, vmax=1)
        ax2.set_xticks(range(loadings.shape[1]))
        ax2.set_xticklabels([f'因子{i+1}' for i in range(loadings.shape[1])])
        ax2.set_yticks(range(len(numeric_cols)))
        ax2.set_yticklabels(numeric_cols)
        ax2.set_title('因子負荷量')
        plt.colorbar(im, ax=ax2)

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 寄与率テーブル
        variance_df = pd.DataFrame({
            '因子': [f'因子{i+1}' for i in range(len(explained_variance))],
            '寄与率 (%)': explained_variance,
            '累積寄与率 (%)': cumulative_variance
        })

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>因子分析結果</h3>
            <p class="text-muted">注: この実装はPCAベースの簡易版です</p>

            <div class="results-summary">
                <h4>寄与率</h4>
                {variance_df.to_html(classes='table', index=False)}

                <h4>因子負荷量</h4>
                {loadings_df.to_html(classes='table')}

                <h4>分析情報</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>使用変数数</td><td>{len(numeric_cols)}</td></tr>
                    <tr><td>サンプルサイズ</td><td>{len(data)}</td></tr>
                    <tr><td>抽出因子数</td><td>{pca_result.shape[1]}</td></tr>
                    <tr><td>累積寄与率</td><td>{cumulative_variance[-1]:.2f}%</td></tr>
                </table>
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p><strong>因子数:</strong> {pca_result.shape[1]}個の因子を抽出しました</p>
                <p><strong>累積寄与率:</strong> {cumulative_variance[-1]:.1f}%の情報を保持しています</p>
                <p><strong>因子負荷量:</strong> 絶対値が大きいほど、その因子との関連が強いことを示します</p>
            </div>

            <div class="results-plot">
                <h4>グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# ==========================================
# テキストマイニング（簡易版）
# ==========================================

def run_text_mining(text_column):
    """
    テキストマイニングを実行（簡易版）

    Parameters:
    -----------
    text_column : str
        テキストデータの列名

    Returns:
    --------
    str
        HTML形式の分析結果
    """
    global current_df

    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    try:
        import re
        from collections import Counter

        # テキストデータを抽出
        texts = current_df[text_column].dropna()

        if len(texts) == 0:
            return "<p>テキストデータがありません</p>"

        # 全テキストを結合
        all_text = ' '.join(texts.astype(str))

        # 簡易的な単語分割（日本語と英語の両方に対応）
        # 日本語: 1-3文字の連続
        # 英語: アルファベットの連続
        japanese_words = re.findall(r'[ぁ-んァ-ヶー一-龯]{1,3}', all_text)
        english_words = re.findall(r'[a-zA-Z]{2,}', all_text.lower())

        # 数字を除外
        words = [w for w in japanese_words + english_words if not w.isdigit()]

        # ストップワード（除外する一般的な単語）
        stopwords = set(['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
                         'ある', 'いる', 'も', 'する', 'から', 'な', 'こ', 'として', 'い', 'や',
                         'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう',
                         'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か',
                         'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず',
                         'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                         'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during'])

        # ストップワードを除外
        filtered_words = [w for w in words if w not in stopwords and len(w) > 1]

        # 単語の頻度をカウント
        word_counts = Counter(filtered_words)
        top_words = word_counts.most_common(30)

        # 頻出単語のDataFrame
        word_df = pd.DataFrame(top_words, columns=['単語', '出現回数'])

        # 棒グラフを作成
        fig, ax = plt.subplots(figsize=(12, 8))
        words_list = [w[0] for w in top_words[:20]]
        counts_list = [w[1] for w in top_words[:20]]

        ax.barh(range(len(words_list)), counts_list)
        ax.set_yticks(range(len(words_list)))
        ax.set_yticklabels(words_list)
        ax.invert_yaxis()
        ax.set_xlabel('出現回数')
        ax.set_title('頻出単語 TOP 20')
        ax.grid(True, alpha=0.3, axis='x')

        plt.tight_layout()

        # グラフをbase64エンコード
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()

        # 結果をHTML形式で返す
        result_html = f"""
        <div class="analysis-results">
            <h3>テキストマイニング結果（簡易版）</h3>
            <p class="text-muted">注: この実装は簡易的な単語分割を使用しています</p>

            <div class="results-summary">
                <h4>分析情報</h4>
                <table class="table">
                    <tr><th>項目</th><th>値</th></tr>
                    <tr><td>文書数</td><td>{len(texts)}</td></tr>
                    <tr><td>総単語数</td><td>{len(words)}</td></tr>
                    <tr><td>ユニーク単語数</td><td>{len(set(words))}</td></tr>
                    <tr><td>フィルタ後単語数</td><td>{len(filtered_words)}</td></tr>
                </table>

                <h4>頻出単語 TOP 30</h4>
                {word_df.to_html(classes='table', index=False)}
            </div>

            <div class="results-interpretation">
                <h4>結果の解釈</h4>
                <p>最も頻出する単語: <strong>{top_words[0][0]}</strong> ({top_words[0][1]}回)</p>
                <p>上位の単語から、テキスト全体のテーマや傾向を読み取ることができます</p>
            </div>

            <div class="results-plot">
                <h4>頻出単語グラフ</h4>
                <img src="data:image/png;base64,{img_base64}" style="max-width: 100%; height: auto;">
            </div>
        </div>
        """

        return result_html

    except Exception as e:
        return f"<p>エラーが発生しました: {str(e)}</p>"


# 初期化メッセージ
console.log("easyStat PyScript共通関数が読み込まれました")
