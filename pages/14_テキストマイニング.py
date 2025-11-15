import os
from collections import Counter

import japanize_matplotlib
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import networkx as nx
import nlplot
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from PIL import Image
from janome.tokenizer import Tokenizer
from wordcloud import WordCloud
try:
    from networkx.algorithms import community
except ImportError:
    community = None

import common


common.set_font()

# ワードクラウド用の日本語フォントパスを取得（matplotlibの設定を活用）
def get_japanese_font_path():
    """matplotlibで設定されている日本語フォントのパスを取得"""
    try:
        # IPAexGothicフォントを検索
        japanese_fonts = [f for f in fm.fontManager.ttflist
                         if 'IPA' in f.name or 'Noto Sans CJK' in f.name
                         or 'Takao' in f.name]

        if japanese_fonts:
            # 最初に見つかった日本語フォントを使用
            return japanese_fonts[0].fname

        # フォールバック: システムフォントを検索
        font_candidates = [
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
            '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
            '/usr/share/fonts/truetype/takao-gothic/TakaoGothic.ttf',
        ]

        for candidate in font_candidates:
            if os.path.exists(candidate):
                return candidate

        return None
    except Exception as e:
        st.warning(f"フォント検索中にエラーが発生しました: {e}")
        return None

font_path = get_japanese_font_path()
if font_path is None:
    st.warning("⚠️ 日本語フォントが見つかりません。ワードクラウドで文字化けが発生する可能性があります。")

st.set_page_config(page_title="テキストマイニング", layout="wide")

# AI解釈機能の設定
gemini_api_key, enable_ai_interpretation = common.AIStatisticalInterpreter.setup_ai_sidebar()

st.title("テキストマイニング")
common.display_header()
st.write(
    "記述変数からワードクラウドや共起ネットワークを抽出します。"
    "KH Coderのアルゴリズムに基づいて、共起ネットワークはグループ化（コミュニティ検出）されて表示されます。"
)

# 画像の表示
try:
    image = Image.open('images/textmining.png')
    st.image(image)
except FileNotFoundError:
    pass

# ファイルアップロードとデモデータ選択
uploaded_file = st.file_uploader("CSVまたはExcelファイルを選択してください", type=["csv", "xlsx"])
use_demo_data = st.checkbox('デモデータを使用')

df = None
if use_demo_data:
    try:
        df = pd.read_excel('datasets/textmining_demo.xlsx', sheet_name=0)
        st.write("デモデータ:")
        st.write(df.head())
    except FileNotFoundError:
        st.error("デモデータファイル 'textmining_demo.xlsx' が見つかりません。")
else:
    if uploaded_file is not None:
        try:
            if uploaded_file.type == 'text/csv':
                df = pd.read_csv(uploaded_file)
            else:
                df = pd.read_excel(uploaded_file)
            st.write("アップロードデータ:")
            st.write(df.head())
        except Exception as e:
            st.error(f"ファイル読み込みエラー: {e}")


def create_cooccurrence_network_with_communities(graph, title='共起ネットワーク',
                                                  top_n_edges=60, use_plotly=True):
    """
    KH Coderのアルゴリズムに基づいた共起ネットワーク描画
    コミュニティ検出でグループ化し、グループごとに色分け

    Parameters:
    -----------
    graph : networkx.Graph
        共起ネットワークグラフ
    title : str
        グラフのタイトル
    top_n_edges : int
        表示する上位エッジ数（KH Coderのデフォルトは60）
    use_plotly : bool
        Plotlyを使用するかどうか（Falseの場合はmatplotlib）
    """
    if graph is None or len(graph.edges()) == 0:
        st.warning("共起ネットワークを作成するための十分なデータがありません。")
        return None

    # KH Coderアルゴリズム: Top N エッジを抽出
    edges_sorted = sorted(graph.edges(data=True),
                         key=lambda x: x[2].get('weight', 1),
                         reverse=True)[:top_n_edges]

    # サブグラフを作成
    subgraph = nx.Graph()
    for u, v, data in edges_sorted:
        subgraph.add_edge(u, v, weight=data.get('weight', 1))

    if len(subgraph.nodes()) == 0:
        st.warning("表示可能なノードがありません。")
        return None

    # コミュニティ検出（KH Coderスタイル）
    if community is not None:
        try:
            # Louvainアルゴリズムでコミュニティを検出
            communities = community.greedy_modularity_communities(subgraph)

            # ノードにコミュニティIDを割り当て
            node_to_community = {}
            for idx, comm in enumerate(communities):
                for node in comm:
                    node_to_community[node] = idx
        except Exception as e:
            st.warning(f"コミュニティ検出でエラーが発生しました: {e}")
            # フォールバック: すべて同じコミュニティ
            node_to_community = {node: 0 for node in subgraph.nodes()}
    else:
        # networkx.communityが利用できない場合
        node_to_community = {node: 0 for node in subgraph.nodes()}

    # レイアウト計算（KH CoderはKamada-Kawaiを使用）
    try:
        pos = nx.kamada_kawai_layout(subgraph)
    except:
        # フォールバック: spring layout
        pos = nx.spring_layout(subgraph, k=1, iterations=50)

    # ノードの中心性を計算（ノードサイズ用）
    try:
        degree_centrality = nx.degree_centrality(subgraph)
    except:
        degree_centrality = {node: 1 for node in subgraph.nodes()}

    if use_plotly:
        # Plotlyで描画
        edge_trace = []

        # エッジを描画
        for edge in subgraph.edges(data=True):
            x0, y0 = pos[edge[0]]
            x1, y1 = pos[edge[1]]
            weight = edge[2].get('weight', 1)

            edge_trace.append(
                go.Scatter(
                    x=[x0, x1, None],
                    y=[y0, y1, None],
                    mode='lines',
                    line=dict(width=0.5 + weight * 0.5, color='#888'),
                    hoverinfo='none',
                    showlegend=False
                )
            )

        # コミュニティごとに色を設定
        num_communities = len(set(node_to_community.values()))
        colors = px.colors.qualitative.Set3[:num_communities] if num_communities <= len(px.colors.qualitative.Set3) else px.colors.sample_colorscale("turbo", [n/(num_communities-1) for n in range(num_communities)])

        # ノードをコミュニティごとに描画
        node_traces = []
        for comm_id in set(node_to_community.values()):
            nodes_in_comm = [node for node, c in node_to_community.items() if c == comm_id]

            node_x = []
            node_y = []
            node_text = []
            node_size = []

            for node in nodes_in_comm:
                x, y = pos[node]
                node_x.append(x)
                node_y.append(y)
                node_text.append(f"{node}<br>グループ: {comm_id + 1}<br>中心性: {degree_centrality[node]:.3f}")
                node_size.append(20 + degree_centrality[node] * 100)

            node_trace = go.Scatter(
                x=node_x,
                y=node_y,
                mode='markers+text',
                text=[node for node in nodes_in_comm],
                textposition='top center',
                textfont=dict(size=10, family='IPAexGothic, Arial, sans-serif'),
                hovertext=node_text,
                hoverinfo='text',
                marker=dict(
                    size=node_size,
                    color=colors[comm_id % len(colors)],
                    line=dict(width=2, color='white')
                ),
                name=f'グループ {comm_id + 1}',
                showlegend=True
            )
            node_traces.append(node_trace)

        # 図を作成
        fig = go.Figure(data=edge_trace + node_traces)

        fig.update_layout(
            title=dict(text=title, x=0.5, xanchor='center'),
            showlegend=True,
            hovermode='closest',
            margin=dict(b=0, l=0, r=0, t=40),
            xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
            plot_bgcolor='white',
            width=1000,
            height=600
        )

        return fig
    else:
        # matplotlibで描画
        fig_net, ax = plt.subplots(figsize=(12, 8))

        # コミュニティごとに色を設定
        num_communities = len(set(node_to_community.values()))
        cmap = plt.cm.get_cmap('Set3', num_communities)
        node_colors = [cmap(node_to_community[node]) for node in subgraph.nodes()]

        # ノードサイズを中心性に基づいて設定
        node_sizes = [300 + degree_centrality[node] * 2000 for node in subgraph.nodes()]

        # エッジの太さを重みに基づいて設定
        edge_weights = [subgraph[u][v].get('weight', 1) for u, v in subgraph.edges()]
        edge_widths = [0.5 + w * 0.5 for w in edge_weights]

        # 描画
        nx.draw_networkx_edges(subgraph, pos, width=edge_widths, alpha=0.5, ax=ax)
        nx.draw_networkx_nodes(subgraph, pos, node_color=node_colors,
                              node_size=node_sizes, alpha=0.9, ax=ax)
        nx.draw_networkx_labels(subgraph, pos, font_family='IPAexGothic',
                               font_size=10, ax=ax)

        ax.set_title(title, fontsize=14, pad=20)
        ax.axis('off')
        plt.tight_layout()

        return fig_net


# データフレームが有効な場合のみ解析開始
if df is not None and not df.empty:
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    text_cols = df.select_dtypes(include=['object']).columns.tolist()

    if not categorical_cols:
        st.error('カテゴリ変数が見つかりません。')
    elif not text_cols:
        st.error('記述変数が見つかりません。')
    else:
        st.subheader("カテゴリ変数の選択")
        selected_category = st.selectbox('カテゴリ変数を選択してください', categorical_cols)
        if selected_category in text_cols:
            text_cols.remove(selected_category)

        default_index = len(text_cols) - 1 if text_cols else 0
        selected_text = st.selectbox('記述変数を選択してください', text_cols, index=default_index)

        st.subheader('全体の分析')
        tokenizer = Tokenizer()

        def extract_words(text):
            if pd.isnull(text):
                return ""
            tokens = tokenizer.tokenize(text)
            return ' '.join(
                token.base_form
                for token in tokens
                if token.part_of_speech.split(',')[0] in ["名詞", "動詞", "形容詞", "副詞"]
            )

        df['tokenized_text'] = df[selected_text].apply(extract_words)
        total_tokens = df['tokenized_text'].str.split().apply(len).sum()
        st.write(f"トークン化後の総単語数: {total_tokens}")

        # 共起が発生しない場合のテスト行追加
        if not df['tokenized_text'].str.strip().any():
            df = pd.concat([
                df,
                pd.DataFrame({
                    selected_category: ["テストカテゴリ"],
                    selected_text: ["テスト テスト テキスト テキスト データ データ 分析 分析"]
                })
            ], ignore_index=True)
            df['tokenized_text'] = df[selected_text].apply(extract_words)

        # NLPlot 初期化
        npt = nlplot.NLPlot(df, target_col='tokenized_text')
        stopwords_list = npt.get_stopword()
        words = ' '.join(df['tokenized_text'])

        # ワードクラウド（KH Coderスタイル）
        st.subheader('【ワードクラウド】')
        max_words = st.slider(
            '最大単語数', 10, max(len(set(words.split())), 10), 50
        )
        if words and font_path:
            try:
                wc = WordCloud(
                    width=800,
                    height=400,
                    max_words=max_words,
                    background_color='white',
                    font_path=font_path,
                    collocations=False,
                    stopwords=set(stopwords_list),
                    relative_scaling=0.5,  # KH Coderスタイル
                    min_font_size=10
                ).generate(words)

                fig_wc, ax_wc = plt.subplots(figsize=(10, 5))
                ax_wc.imshow(wc, interpolation='bilinear')
                ax_wc.axis('off')
                st.pyplot(fig_wc)
                plt.close(fig_wc)
            except Exception as e:
                st.error(f"ワードクラウドの生成中にエラーが発生しました: {e}")
        elif not font_path:
            st.error("⚠️ 日本語フォントが見つからないため、ワードクラウドを表示できません。")
        else:
            st.warning("テキストデータが不足しています。")

        # 全体の共起ネットワーク（KH Coderスタイル）
        st.subheader('【共起ネットワーク（全体）】')
        st.write("💡 グループごとに色分けされています（KH Coderアルゴリズム）")

        try:
            npt.build_graph(stopwords=stopwords_list, min_edge_frequency=1)
            
            # nlplotのグラフオブジェクトを取得（バージョンによって属性名が異なる）
            # nlplotのグラフオブジェクトを取得（バージョンや実装によって属性名が異なる）
            graph_obj = getattr(npt, 'nwx', None) or getattr(npt, 'G', None) or getattr(npt, 'graph', None)
            
            if graph_obj is None:
                st.error("共起ネットワークのグラフオブジェクトを取得できませんでした。")
                raise AttributeError("NLPlot object has no valid graph attribute (tried: nwx, G, graph)")

            # Plotlyバージョンを試行
            fig_net = create_cooccurrence_network_with_communities(
                graph_obj,
                title='全体の共起ネットワーク（グループ化）',
                top_n_edges=60,
                use_plotly=True
            )

            if fig_net is not None:
                st.plotly_chart(fig_net, use_container_width=True)
            else:
                # matplotlibバージョンにフォールバック
                fig_net_mpl = create_cooccurrence_network_with_communities(
                    graph_obj,
                    title='全体の共起ネットワーク（グループ化）',
                    top_n_edges=60,
                    use_plotly=False
                )
                if fig_net_mpl is not None:
                    st.pyplot(fig_net_mpl)
                    plt.close(fig_net_mpl)
        except Exception as e:
            st.error(f"共起ネットワークの生成中にエラーが発生しました: {e}")

        # 単語度数バー
        freq = Counter(words.split())
        df_freq = pd.DataFrame(
            freq.items(), columns=['単語','度数']
        ).sort_values(by='度数', ascending=False)
        if not df_freq.empty:
            fig_bar = px.bar(
                df_freq.head(20), x='単語', y='度数',
                title='出現度数トップ20'
            )
            st.plotly_chart(fig_bar)

        # --- AI解釈機能 ---
        if enable_ai_interpretation and gemini_api_key:
            try:
                # top_wordsをリスト形式で取得
                top_words = [(row["単語"], row["度数"]) for _, row in df_freq.head(30).iterrows()]
                n_documents = len(df)
                n_unique_words = len(freq)

                text_results = {
                    'top_words': top_words,
                    'n_documents': n_documents,
                    'n_unique_words': n_unique_words
                }

                common.AIStatisticalInterpreter.display_ai_interpretation(
                    api_key=gemini_api_key,
                    enabled=enable_ai_interpretation,
                    results=text_results,
                    analysis_type='text_mining',
                    key_prefix='text_mining'
                )
            except Exception as e:
                st.warning(f"AI解釈の生成中にエラーが発生しました: {str(e)}")

        # カテゴリ別分析と描画
        for cat, grp in df.groupby(selected_category):
            st.subheader(f'＜カテゴリ：{cat}＞')
            grp = grp.copy()
            grp['tokenized_text'] = grp[selected_text].apply(extract_words)
            words_cat = ' '.join(grp['tokenized_text'])

            # カテゴリ別ワードクラウド
            if words_cat and font_path:
                try:
                    wc_cat = WordCloud(
                        width=600,
                        height=300,
                        max_words=50,
                        background_color='white',
                        font_path=font_path,
                        collocations=False,
                        stopwords=set(stopwords_list),
                        relative_scaling=0.5,
                        min_font_size=10
                    ).generate(words_cat)

                    fig_c, ax_c = plt.subplots(figsize=(8, 4))
                    ax_c.imshow(wc_cat, interpolation='bilinear')
                    ax_c.axis('off')
                    st.pyplot(fig_c)
                    plt.close(fig_c)
                except Exception as e:
                    st.warning(f"カテゴリ別ワードクラウドの生成中にエラー: {e}")

            # カテゴリ別共起ネットワーク（KH Coderスタイル）
            try:
                npt_cat = nlplot.NLPlot(grp, target_col='tokenized_text')
                npt_cat.build_graph(stopwords=stopwords_list, min_edge_frequency=1)
                
                # nlplotのグラフオブジェクトを取得（バージョンによって属性名が異なる）
                # nlplotのグラフオブジェクトを取得（バージョンや実装によって属性名が異なる）
                graph_obj_cat = getattr(npt_cat, 'nwx', None) or getattr(npt_cat, 'G', None) or getattr(npt_cat, 'graph', None)
                
                if graph_obj_cat is None:
                    st.warning(f"カテゴリ「{cat}」の共起ネットワークのグラフオブジェクトを取得できませんでした。")
                    continue

                fig_cat = create_cooccurrence_network_with_communities(
                    graph_obj_cat,
                    title=f'{cat}の共起ネットワーク（グループ化）',
                    top_n_edges=60,
                    use_plotly=True
                )

                if fig_cat is not None:
                    st.plotly_chart(fig_cat, use_container_width=True)
                else:
                    # matplotlibにフォールバック
                    fig_cat_mpl = create_cooccurrence_network_with_communities(
                        graph_obj_cat,
                        title=f'{cat}の共起ネットワーク（グループ化）',
                        top_n_edges=60,
                        use_plotly=False
                    )
                    if fig_cat_mpl is not None:
                        st.pyplot(fig_cat_mpl)
                        plt.close(fig_cat_mpl)
            except Exception as e:
                st.warning(f"カテゴリ別共起ネットワークの生成中にエラー: {e}")

# フッター
common.display_copyright()
common.display_special_thanks()
