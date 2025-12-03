"""
easyStat - PyScript メインエントリポイント
このファイルは PyScript によって最初に読み込まれ、
common.py モジュールをインポートして、すべての Python 関数を
JavaScript に公開します。
"""

from js import console

console.log("=" * 60)
console.log("easyStat - PyScript Main Module Loading...")
console.log("=" * 60)

# common モジュールをインポート
# これにより、common.py の最後にあるエクスポートコードが実行され、
# すべての関数が JavaScript の window オブジェクトに公開されます
try:
    console.log("Importing common module...")
    from app import common
    console.log("✓ common module imported successfully")
    console.log("✓ All statistical functions are now available")
except Exception as e:
    console.error(f"❌ Failed to import common module: {str(e)}")
    import traceback
    console.error(traceback.format_exc())
    raise

console.log("=" * 60)
console.log("✓ PyScript Main Module Loaded Successfully")
console.log("=" * 60)
