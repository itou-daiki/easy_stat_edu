import os
from collections import Counter

import japanize_matplotlib
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import networkx as nx
import nlplot
import numpy as np
import pandas as pd
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
                                                  top_n_edges=60, node_to_word=None):
    """
    KH Coderのアルゴリズムに基づいた共起ネットワーク描画（Matplotlib使用）
    コミュニティ検出でグループ化し、グループごとに色分け

    Parameters:
    -----------
    graph : networkx.Graph
        共起ネットワークグラフ（ノードは数値インデックス）
    title : str
        グラフのタイトル
    top_n_edges : int
        表示する上位エッジ数（KH Coderのデフォルトは60）
    node_to_word : dict or None
        ノード番号から単語へのマッピング辞書
        Noneの場合はノード番号をそのまま使用
    """

    # ノード番号から単語へのマッピングを作成（ない場合はノード番号を使用）
    if node_to_word is None:
        node_to_word = {node: str(node) for node in graph.nodes()}

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

    # レイアウト計算（KH CoderはFruchterman-Reingoldを使用）
    try:
        # Fruchterman-Reingoldアルゴリズム（KH Coderの標準）
        # k値でノード間の理想的な距離を調整
        pos = nx.spring_layout(subgraph, k=2.0, iterations=100, seed=42)
    except:
        # フォールバック: Kamada-Kawai layout
        pos = nx.kamada_kawai_layout(subgraph, scale=2.0)

    # ノードの次数を計算（ノードサイズ用、KH Coder準拠）
    # KH Coderでは共起ネットワーク内での接続数（次数）に基づいてサイズを決定
    try:
        node_degrees = dict(subgraph.degree())
        # 正規化（0-1の範囲に）
        max_degree = max(node_degrees.values()) if node_degrees else 1
        degree_normalized = {node: deg / max_degree for node, deg in node_degrees.items()}
    except:
        degree_normalized = {node: 0.5 for node in subgraph.nodes()}

    # matplotlibで描画
    fig_net, ax = plt.subplots(figsize=(16, 12))

    # コミュニティごとに色を設定
    num_communities = len(set(node_to_community.values()))
    cmap = plt.cm.get_cmap('Set3', num_communities)
    node_colors = [cmap(node_to_community[node]) for node in subgraph.nodes()]

    # ノードサイズを次数に基づいて設定（KH Coder準拠）
    node_sizes = [400 + degree_normalized[node] * 2500 for node in subgraph.nodes()]

    # エッジの太さを重みに基づいて設定
    edge_weights = [subgraph[u][v].get('weight', 1) for u, v in subgraph.edges()]
    max_weight = max(edge_weights) if edge_weights else 1
    edge_widths = [1.0 + (w / max_weight) * 4.0 for w in edge_weights]

    # 描画
    nx.draw_networkx_edges(subgraph, pos, width=edge_widths, alpha=0.5, ax=ax, edge_color='#888888')
    nx.draw_networkx_nodes(subgraph, pos, node_color=node_colors,
                          node_size=node_sizes, alpha=0.9, ax=ax, linewidths=2, edgecolors='white')
    
    # ノード番号を単語に変換したラベルを作成
    labels = {node: node_to_word.get(node, str(node)) for node in subgraph.nodes()}
    nx.draw_networkx_labels(subgraph, pos, labels=labels, 
                           font_size=10, font_weight='bold', ax=ax)

    ax.set_title(title, fontsize=16, pad=20, fontweight='bold')
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
            
            
            # nlplotオブジェクトの属性を確認
            npt_attrs = [attr for attr in dir(npt) if not attr.startswith("_")]
            graph_related = [a for a in npt_attrs if "graph" in a.lower() or a in ["G", "nwx", "node_df", "node_edge_df"]]
            
            # node_dfの有無を確認
            if hasattr(npt, "node_df"):
                st.write(f"npt.node_df is None: {npt.node_df is None}")
                if npt.node_df is not None:
                    st.write("node_dfの最初の5行:")

            
            # nlplotのグラフオブジェクトを取得（バージョンによって属性名が異なる）
            # nlplotのグラフオブジェクトを取得（バージョンや実装によって属性名が異なる）
            graph_obj = getattr(npt, 'nwx', None) or getattr(npt, 'G', None) or getattr(npt, 'graph', None)
            
            if graph_obj is None:
                st.error("共起ネットワークのグラフオブジェクトを取得できませんでした。")
                raise AttributeError("NLPlot object has no valid graph attribute (tried: nwx, G, graph)")

            # nlplotのnode_dfからノード番号と単語のマッピングを作成
            node_to_word_mapping = None
            if hasattr(npt, "node_df"):
                try:
                    node_df = npt.node_df
                    if node_df is not None:

                        # マッピングを作成（nlplotではid_code -> idのマッピング）
                        if "id_code" in node_df.columns and "id" in node_df.columns:
                            # id_code（ノード番号）をキー、id（単語）を値とする
                            node_to_word_mapping = dict(zip(node_df["id_code"], node_df["id"]))
                            st.write(f"  - ✅ マッピング作成成功！")
                            st.write(f"  - マッピング例: {dict(list(node_to_word_mapping.items())[:5])}")
                        elif "word" in node_df.columns:
                            # 古いバージョン対応
                            if "node" in node_df.columns:
                                node_to_word_mapping = dict(zip(node_df["node"], node_df["word"]))
                            else:
                                node_to_word_mapping = node_df["word"].to_dict()
                            st.write(f"  - マッピング例: {dict(list(node_to_word_mapping.items())[:5])}")
                        elif "words" in node_df.columns:
                            if "node" in node_df.columns:
                                node_to_word_mapping = dict(zip(node_df["node"], node_df["words"]))
                            else:
                                node_to_word_mapping = node_df["words"].to_dict()
                        else:
                            st.warning("⚠️ node_dfに単語情報の列が見つかりません")
                except Exception as e:
                    st.error(f"ノードと単語のマッピング作成でエラー: {e}")
                    import traceback
                    st.code(traceback.format_exc())

            fig_net = create_cooccurrence_network_with_communities(
                graph_obj,
                title='全体の共起ネットワーク（グループ化）',
                top_n_edges=60,
                node_to_word=node_to_word_mapping
            )

            if fig_net is not None:
                st.plotly_chart(fig_net, use_container_width=True)
        except Exception as e:
            st.error(f"共起ネットワークの生成中にエラーが発生しました: {e}")

        # 単語度数バー
        from plotly import express as px
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

                # nlplotのnode_dfからノード番号と単語のマッピングを作成
                node_to_word_mapping_cat = None
                if hasattr(npt_cat, "node_df"):
                    try:
                        node_df_cat = npt_cat.node_df
                        if node_df_cat is not None:
                            # マッピングを作成
                            if "word" in node_df_cat.columns:
                                # node列がある場合はそれを使用、なければindexを使用
                                if "node" in node_df_cat.columns:
                                    node_to_word_mapping_cat = dict(zip(node_df_cat["node"], node_df_cat["word"]))
                                else:
                                    node_to_word_mapping_cat = node_df_cat["word"].to_dict()
                            elif "words" in node_df_cat.columns:
                                if "node" in node_df_cat.columns:
                                    node_to_word_mapping_cat = dict(zip(node_df_cat["node"], node_df_cat["words"]))
                                else:
                                    node_to_word_mapping_cat = node_df_cat["words"].to_dict()
                    except Exception as e:
                        st.error(f"カテゴリ「{cat}」のノード-単語マッピング作成でエラー: {e}")
                        import traceback
                        st.code(traceback.format_exc())

                fig_cat = create_cooccurrence_network_with_communities(
                    graph_obj_cat,
                    title=f'{cat}の共起ネットワーク（グループ化）',
                    top_n_edges=60,
                    node_to_word=node_to_word_mapping_cat
                )

                if fig_cat is not None:
                    st.plotly_chart(fig_cat, use_container_width=True)
            except Exception as e:
                st.warning(f"カテゴリ別共起ネットワークの生成中にエラー: {e}")

# フッター
common.display_copyright()
common.display_special_thanks()
