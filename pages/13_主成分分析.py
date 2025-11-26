import io

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from PIL import Image
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

import common


common.set_font()

# ページ設定
st.set_page_config(page_title="主成分分析", layout="wide")

# AI解釈機能の設定
gemini_api_key, enable_ai_interpretation = common.AIStatisticalInterpreter.setup_ai_sidebar()
st.title("主成分分析")
common.display_header()
st.write("")
st.subheader("ブラウザで検定 → 表 → 解釈まで出力できるウェブアプリです。")
st.write("iPad等でも分析を行うことができます")
st.write("")

# --- ファイルアップロード・デモデータの読み込み ---
uploaded_file = st.file_uploader("CSVまたはExcelファイルを選択してください", type=["csv", "xlsx"])
use_demo_data = st.checkbox("デモデータを使用")

@st.cache_data
def load_data(file):
    """
    アップロードされたファイルを読み込み、DataFrameとして返す関数
    ExcelまたはCSV形式に対応
    """
    try:
        if file.type == "text/csv":
            return pd.read_csv(file)
        elif file.type in [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        ]:
            return pd.read_excel(file, engine='openpyxl')
        else:
            st.error("対応していないファイル形式です。")
            return None
    except Exception as e:
        st.error(f"データの読み込み中にエラーが発生しました: {e}")
        return None

df = None
if use_demo_data:
    try:
        # ※ デモデータのファイルパスは適宜変更してください
        df = pd.read_excel("datasets/factor_analysis_demo.xlsx", sheet_name=0, engine='openpyxl')
    except Exception as e:
        st.error(f"デモデータの読み込みに失敗しました: {e}")
elif uploaded_file is not None:
    df = load_data(uploaded_file)

if df is not None:
    st.write("【入力データ】")
    st.dataframe(df.head())

    # --- 数値変数の抽出 ---
    numerical_cols = df.select_dtypes(include=['float64', 'int64']).columns.tolist()
    if len(numerical_cols) == 0:
        st.error("データ内に数値変数が見つかりません。")
    else:
        # --- 主成分分析用の変数選択（デフォルトで全数値変数を選択） ---
        st.subheader("主成分分析の設定")
        selected_vars = st.multiselect('分析対象の変数を選択してください', numerical_cols, default=numerical_cols)
        if len(selected_vars) == 0:
            st.error("少なくとも1つの数値変数を選択してください。")
        else:
            # 選択された変数のみを使用
            df_selected = df[selected_vars]
            st.write("【分析に使用するデータ】")
            st.dataframe(df_selected.head())

            # --- PCAの実行 ---
            scaler = StandardScaler()
            df_scaled = scaler.fit_transform(df_selected)
            
            # 主成分の数は選択可能（上限は選択変数数と8のうち小さい方）
            n_components = st.slider("主成分の数を選択してください", 1, min(len(selected_vars), 8))
            pca = PCA(n_components=n_components)
            components = pca.fit_transform(df_scaled)
            
            # --- 説明分散比率の表示 ---
            explained_df = pd.DataFrame({
                "主成分": [f"PC{i+1}" for i in range(n_components)],
                "説明分散比率": pca.explained_variance_ratio_
            })
            st.subheader("【各主成分の説明分散比率】")
            st.dataframe(explained_df.style.format({"説明分散比率": "{:.3f}"}))
            
            # --- 主成分得点の表示 ---
            pc_df = pd.DataFrame(components, columns=[f"PC{i+1}" for i in range(n_components)])
            st.subheader("【各サンプルの主成分得点】")
            st.dataframe(pc_df.style.format("{:.3f}"))
            
            # --- 主成分のロードings（係数）の表示 ---
            loading_df = pd.DataFrame(pca.components_.T,
                                      index=selected_vars,
                                      columns=[f"PC{i+1}" for i in range(n_components)])
            st.write("【各主成分のロードings（係数）】")
            st.dataframe(loading_df.style.format("{:.3f}"))
            
            # === 追加機能：縮約された（＝主成分に強く寄与している）項目の表示 ===
            st.subheader("主成分への寄与が大きい元の変数の表示")
            # 寄与度の閾値をユーザーが設定（絶対値）
            threshold = st.slider("寄与度の閾値を設定してください（絶対値）", 0.0, 1.0, 0.5, step=0.05)
            pc_contributions = {}
            for pc in loading_df.columns:
                # 各主成分で絶対値が閾値以上の変数を抽出
                significant_vars = loading_df[pc].abs() >= threshold
                variables = loading_df.index[significant_vars].tolist()
                pc_contributions[pc] = ", ".join(variables) if variables else "なし"
            st.write(pd.DataFrame(list(pc_contributions.items()), columns=["主成分", "寄与が大きい変数"]))
            
            # === 追加機能：バイプロットの表示（主成分が2つ以上の場合） ===
            if n_components >= 2:
                st.subheader("バイプロット (PC1 vs PC2)")

                # 主成分得点の散布図
                scatter = go.Scatter(
                    x=components[:, 0],
                    y=components[:, 1],
                    mode='markers',
                    marker=dict(size=8, opacity=0.5, color='blue'),
                    name='サンプル',
                    hovertemplate='PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>'
                )

                # スケール調整のため、主成分得点の最大値を取得
                scale_x = max(abs(components[:, 0]))
                scale_y = max(abs(components[:, 1]))

                # 各変数のベクトル（矢印とラベル）を作成
                annotations = []
                arrow_traces = []

                for var in selected_vars:
                    x = loading_df.loc[var, "PC1"]
                    y = loading_df.loc[var, "PC2"]

                    # ベクトルの矢印（線）
                    arrow_trace = go.Scatter(
                        x=[0, x * scale_x],
                        y=[0, y * scale_y],
                        mode='lines',
                        line=dict(color='red', width=2),
                        showlegend=False,
                        hoverinfo='skip'
                    )
                    arrow_traces.append(arrow_trace)

                    # 矢印の先端（アノテーション）
                    annotations.append(
                        dict(
                            x=x * scale_x,
                            y=y * scale_y,
                            ax=0,
                            ay=0,
                            xref='x',
                            yref='y',
                            axref='x',
                            ayref='y',
                            showarrow=True,
                            arrowhead=2,
                            arrowsize=1.5,
                            arrowwidth=2,
                            arrowcolor='red'
                        )
                    )

                    # 変数名のラベル
                    annotations.append(
                        dict(
                            x=x * scale_x * 1.1,
                            y=y * scale_y * 1.1,
                            text=var,
                            showarrow=False,
                            font=dict(color='red', size=12)
                        )
                    )

                # 図の作成
                fig = go.Figure(data=[scatter] + arrow_traces)

                fig.update_layout(
                    title="バイプロット (PC1 vs PC2)",
                    xaxis_title="PC1",
                    yaxis_title="PC2",
                    annotations=annotations,
                    hovermode='closest',
                    showlegend=True,
                    height=600,
                    width=800
                )

                st.plotly_chart(fig, use_container_width=True)
            
            # --- AI解釈機能 ---
            if enable_ai_interpretation and gemini_api_key:
                try:
                    # 寄与率をパーセント表記に変換
                    variance_explained = (pca.explained_variance_ratio_ * 100).tolist()
                    cumulative_variance = [sum(variance_explained[:i+1]) for i in range(n_components)]
                    
                    pca_results = {
                        'n_components': n_components,
                        'variance_explained': variance_explained,
                        'cumulative_variance': cumulative_variance
                    }
                    
                    common.AIStatisticalInterpreter.display_ai_interpretation(
                        api_key=gemini_api_key,
                        enabled=enable_ai_interpretation,
                        results=pca_results,
                        analysis_type='pca',
                        key_prefix='pca'
                    )
                except Exception as e:
                    st.warning(f"AI解釈の生成中にエラーが発生しました: {str(e)}")

            # --- Excelファイルへのダウンロード ---
            def convert_df_to_excel(df):
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
                    df.to_excel(writer, index=False)
                return output.getvalue()
            
            st.download_button(
                label="主成分得点のみのExcelファイルをダウンロード",
                data=convert_df_to_excel(pc_df),
                file_name="pca_scores.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )

# --- フッター表示 ---
common.display_copyright()
common.display_special_thanks()
