"""
Exploratory Data Analysis (EDA) functions for PyScript.
"""
import pandas as pd
import plotly.express as px
from py.common import current_df, get_numeric_columns, get_categorical_columns

def get_eda_summary():
    """
    Generates a summary of the dataframe for EDA.
    """
    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    # Basic info
    n_rows, n_cols = current_df.shape

    # Summary statistics
    summary_df = current_df.describe(include='all').transpose()

    html = f"""
    <div class="data-summary">
        <h3>データ概要</h3>
        <p>行数: {n_rows}</p>
        <p>列数: {n_cols}</p>
        <h4>データプレビュー</h4>
        {current_df.head(10).to_html(classes='table table-striped table-hover')}
        <h4>要約統計量</h4>
        {summary_df.to_html(classes='table table-striped table-hover')}
    </div>
    """
    return html

def get_variable_plots():
    """
    Generates plots for each variable.
    """
    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    html = "<h3>各変数の可視化</h3>"
    
    categorical_cols = get_categorical_columns()
    numerical_cols = get_numeric_columns()

    # Categorical variables
    for col in categorical_cols:
        value_counts = current_df[col].value_counts()
        fig = px.bar(
            x=value_counts.index,
            y=value_counts.values,
            labels={'x': col, 'y': 'Count'},
            title=f'【{col}】 の可視化'
        )
        fig.update_layout(bargap=0.2)
        html += fig.to_html(full_html=False, include_plotlyjs='cdn')

    # Numerical variables
    for col in numerical_cols:
        fig = px.histogram(current_df, x=col, title=f'【{col}】 の可視化（ヒストグラム）')
        fig.update_layout(bargap=0.2)
        html += fig.to_html(full_html=False, include_plotlyjs='cdn')
        
        fig = px.box(current_df, y=col, title=f'【{col}】 の可視化（箱ひげ図）')
        html += fig.to_html(full_html=False, include_plotlyjs='cdn')

    return html

def get_two_variable_plot(var1, var2):
    """
    Generates a plot for two variables.
    """
    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    categorical_cols = get_categorical_columns()
    numerical_cols = get_numeric_columns()

    # カテゴリ×カテゴリ
    if var1 in categorical_cols and var2 in categorical_cols:
        cross_tab = pd.crosstab(current_df[var1], current_df[var2])
        fig = px.imshow(
            cross_tab,
            labels=dict(color='Count'),
            title=f'度数： 【{var1}】 × 【{var2}】'
        )
    # 数値×数値
    elif var1 in numerical_cols and var2 in numerical_cols:
        fig = px.scatter(current_df, x=var1, y=var2, title=f'散布図： 【{var1}】 × 【{var2}】')
    # カテゴリ×数値
    else:
        if var1 in categorical_cols:
            cat_var, num_var = var1, var2
        else:
            cat_var, num_var = var2, var1
        
        fig = px.box(current_df, x=cat_var, y=num_var, title=f'箱ひげ図： 【{cat_var}】 × 【{num_var}】')
    
    return fig.to_html(full_html=False, include_plotlyjs='cdn')

def get_three_variable_plot(cat_var1, cat_var2, num_var):
    """
    Generates a plot for two categorical variables and one numerical variable.
    """
    if current_df is None:
        return "<p>データが読み込まれていません</p>"

    # データの準備
    grouped_df = current_df.groupby([cat_var1, cat_var2])[num_var].mean().reset_index()

    # 棒グラフの作成
    fig = px.bar(
        grouped_df,
        x=cat_var1,
        y=num_var,
        color=cat_var2,
        facet_col=cat_var2,
        labels={num_var: 'AVE: ' + num_var, cat_var1: cat_var1, cat_var2: cat_var2},
        title=f'【{cat_var1}】 と 【{cat_var2}】 による 【{num_var}】 の比較'
    )
    # グラフのレイアウトを更新
    fig.update_layout(
        xaxis_title=cat_var1,
        yaxis_title=f'AVE:  {num_var}',
        margin=dict(l=0, r=0, t=60, b=0),
    )

    return fig.to_html(full_html=False, include_plotlyjs='cdn')