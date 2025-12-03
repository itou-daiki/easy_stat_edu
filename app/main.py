"""
easyStat - Main PyScript execution file (DEBUGGING VERSION)
This script is a minimal version to test if main.py is being executed at all.
"""
import js
from js import console

console.log("="*50)
console.log(">>> DEBUG: app/main.py execution started.")

try:
    js.window.pyScriptFullyReady = True
    console.log(">>> DEBUG: Set window.pyScriptFullyReady = True")
except Exception as e:
    console.error(">>> DEBUG: Failed to set window.pyScriptFullyReady")
    console.error(str(e))

console.log(">>> DEBUG: app/main.py execution finished.")
console.log("="*50)