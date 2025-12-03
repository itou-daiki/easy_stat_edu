"""
easyStat - Main PyScript execution file (ADVANCED DEBUGGING)
This script introspects the PyScript environment to solve the ModuleNotFoundError.
"""
import js
from js import console
import sys
import os
import traceback

try:
    console.log("="*50)
    console.log(">>> ADVANCED DEBUG: app/main.py execution started.")
    
    # Print environment details
    console.log(f">>> CWD: {os.getcwd()}")
    console.log(f">>> sys.path: {sys.path}")

    # List files/directories to see what the filesystem looks like
    console.log(">>> Listing files in /:")
    try:
        console.log(str(os.listdir("/")))
    except Exception as e:
        console.error(f"Could not list root dir: {e}")

    console.log(">>> Listing files in current dir (.):")
    try:
        console.log(str(os.listdir(".")))
    except Exception as e:
        console.error(f"Could not list current dir: {e}")

    console.log(">>> Attempting to import modules...")
    
    # -----------------------------------------------------------------
    # 1. Import all functions from the other modules
    # -----------------------------------------------------------------
    from common import (
        load_file_data, load_demo_data, get_column_names, 
        get_data_characteristics, get_numeric_columns, get_categorical_columns,
        get_text_columns, get_data_summary, run_correlation_analysis,
        run_ttest_analysis, run_chi_square_analysis, run_anova_analysis,
        run_simple_regression_analysis, run_pca_analysis, run_data_cleansing,
        remove_missing_rows, remove_duplicates, fill_missing_mean,
        run_two_way_anova, run_multiple_regression, run_factor_analysis,
        run_text_mining
    )
    from eda import (
        get_eda_summary, get_variable_plots, get_two_variable_plot, get_three_variable_plot
    )
    console.log("✓ Successfully imported functions from common.py and eda.py")

    # If imports succeed, proceed with exporting
    # (The rest of the code is omitted for this debug step, as the import is the failing part)

    js.window.pyScriptFullyReady = True
    console.log("✓ Set window.pyScriptFullyReady flag (after successful import)")

    console.log("="*50)

except Exception as e:
    console.error("❌ Failed during main.py execution.")
    console.error(f"Error Type: {type(e).__name__}")
    console.error(f"Error: {e}")
    console.error(traceback.format_exc())