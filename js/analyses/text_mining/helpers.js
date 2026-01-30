/**
 * @fileoverview テキストマイニングのヘルパー関数モジュール
 * ストップワード、トークナイザー初期化、画像ダウンロード機能を提供
 * @module text_mining/helpers
 */

// ======================================================================
// ストップワードリスト
// ======================================================================

/**
 * 日本語ストップワードセット
 * 助詞、助動詞、記号、一般的すぎる語を除外
 * @type {Set<string>}
 */
export const STOP_WORDS = new Set([
    // 助詞
    'の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ',
    'ある', 'いる', 'も', 'な', 'する', 'から', 'こと', 'として', 'い', 'や',
    'ない', 'この', 'ため', 'その', 'あと', 'よう', 'また', 'もの', 'という',
    'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ', 'によって',
    'により', 'おり', 'ね', 'よ', 'けど', 'でも', 'って', 'ので', 'なら',
    'でした', 'ます', 'です', 'ました', 'ません', 'ですが', 'ですね', 'ですよ',
    // ひらがな1文字（ほとんど助詞）
    'あ', 'い', 'う', 'え', 'お', 'ん',
    // 数字・記号
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // その他一般的すぎる語
    'それ', 'これ', 'あれ', 'どれ', 'なに', 'どう', 'そう', 'ああ',
    'とき', 'ところ', 'ほう', 'ほど', 'まま', 'よる', 'なか', 'うち'
]);

// ======================================================================
// トークナイザー
// ======================================================================

/** @type {Object|null} トークナイザーインスタンス */
let tokenizer = null;

/**
 * トークナイザーインスタンスを取得
 * @returns {Object|null} トークナイザー
 */
export function getTokenizer() {
    return tokenizer;
}

/**
 * トークナイザーを初期化
 * @param {Function} [statusCallback] - ステータス更新コールバック
 * @returns {Promise<void>}
 */
export async function initTokenizer(statusCallback) {
    return new Promise((resolve, reject) => {
        try {
            if (statusCallback) statusCallback('解析エンジンを初期化中...');

            if (typeof TinySegmenter === 'undefined') {
                reject(new Error('TinySegmenter ライブラリが読み込まれていません'));
                return;
            }

            tokenizer = new TinySegmenter();
            if (statusCallback) statusCallback('解析エンジンの準備完了！');
            resolve();
        } catch (err) {
            console.error('TinySegmenter Init Error:', err);
            if (statusCallback) statusCallback('解析エンジンの初期化に失敗しました。');
            reject(new Error('形態素解析エンジンの初期化に失敗しました: ' + err.message));
        }
    });
}

// ======================================================================
// 画像ダウンロード
// ======================================================================

/**
 * Canvas要素を画像としてダウンロード
 * @param {string} targetId - ダウンロード対象のCanvas要素ID
 */
export function downloadCanvasAsImage(targetId) {
    let canvas = document.getElementById(targetId);

    // vis-networkの場合、内部のcanvasを取得
    if (!canvas || canvas.tagName !== 'CANVAS') {
        const container = document.getElementById(targetId);
        if (container) {
            canvas = container.querySelector('canvas');
        }
    }

    if (!canvas) {
        alert('画像の取得に失敗しました。');
        return;
    }

    try {
        // 白背景のCanvasを作成して合成
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');

        // 白背景で塗りつぶし
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 元の画像を重ねる
        ctx.drawImage(canvas, 0, 0);

        // ダウンロード処理
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const filename = targetId.includes('wordcloud') ? `wordcloud_${timestamp}.png` : `network_${timestamp}.png`;

        link.download = filename;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        alert('画像のダウンロードに失敗しました。');
    }
}
