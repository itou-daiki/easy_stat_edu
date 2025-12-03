"""
easyStat - Main PyScript execution file
This file imports all necessary modules and exports functions to JavaScript.
It is intended to be run last by PyScript to ensure all modules are loaded.
"""

import js
from js import console, document
import traceback

try:
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

    # -----------------------------------------------------------------
    # 2. Define the list of all functions to be exported
    # -----------------------------------------------------------------
    exported_functions = {
        # common.py functions
        'load_file_data': load_file_data,
        'load_demo_data': load_demo_data,
        'get_column_names': get_column_names,
        'get_data_characteristics': get_data_characteristics,
        'get_numeric_columns': get_numeric_columns,
        'get_categorical_columns': get_categorical_columns,
        'get_text_columns': get_text_columns,
        'get_data_summary': get_data_summary,
        'run_correlation_analysis': run_correlation_analysis,
        'run_ttest_analysis': run_ttest_analysis,
        'run_chi_square_analysis': run_chi_square_analysis,
        'run_anova_analysis': run_anova_analysis,
        'run_simple_regression_analysis': run_simple_regression_analysis,
        'run_pca_analysis': run_pca_analysis,
        'run_data_cleansing': run_data_cleansing,
        'remove_missing_rows': remove_missing_rows,
        'remove_duplicates': remove_duplicates,
        'fill_missing_mean': fill_missing_mean,
        'run_two_way_anova': run_two_way_anova,
        'run_multiple_regression': run_multiple_regression,
        'run_factor_analysis': run_factor_analysis,
        'run_text_mining': run_text_mining,
        # eda.py functions
        'get_eda_summary': get_eda_summary,
        'get_variable_plots': get_variable_plots,
        'get_two_variable_plot': get_two_variable_plot,
        'get_three_variable_plot': get_three_variable_plot,
    }
    console.log(f"✓ Assembled {len(exported_functions)} functions for export.")

    # -----------------------------------------------------------------
    # 3. Export all functions to the JavaScript window object
    # -----------------------------------------------------------------
    console.log("=" * 50)
    console.log("Exporting Python functions to JavaScript...")
    for func_name, func in exported_functions.items():
        setattr(js.window, func_name, func)
        # console.log(f"  ✓ Exported: {func_name}") # This is too verbose

    console.log("✓ All Python functions exported to JavaScript global scope")
    
    # -----------------------------------------------------------------
    # 4. Signal to JavaScript that PyScript is fully ready
    # -----------------------------------------------------------------
    # Set a global flag
    js.window.pyScriptFullyReady = True
    console.log("✓ Set window.pyScriptFullyReady flag")

    # Dispatch a custom event
    event = document.createEvent('Event')
    event.initEvent('pyscript-ready', True, True)
    document.dispatchEvent(event)
    console.log("✓ Dispatched 'pyscript-ready' event to JavaScript")
    console.log("=" * 50)

except Exception as e:
    console.error("❌ Failed during main.py execution.")
    console.error(f"Error: {e}")
    console.error(traceback.format_exc())

