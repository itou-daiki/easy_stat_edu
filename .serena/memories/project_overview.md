# Easy Stat Edu - Project Overview

## Purpose
Client-side statistics education web application. Fully runs in the browser with no server-side processing needed. Provides various statistical analysis tools with visualizations using Plotly.js.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES modules), HTML, CSS
- **Visualization**: Plotly.js
- **Testing**: Playwright
- **Dev Server**: http-server
- **No build system** - direct browser ES modules

## Project Structure
- `index.html` - Main entry point
- `js/main.js` - Main JS entry
- `js/analyses/` - Individual analysis modules:
  - `correlation.js` - Correlation analysis
  - `eda.js` - Exploratory data analysis
  - `ttest.js` - T-test
  - `anova_one_way.js` - One-way ANOVA
  - `anova_two_way.js` - Two-way ANOVA
  - `regression_simple.js` - Simple regression
  - `regression_multiple.js` - Multiple regression
  - `chi_square.js` - Chi-square test
  - `mann_whitney.js` - Mann-Whitney U test
  - `pca.js` - Principal component analysis
  - `factor_analysis.js` - Factor analysis
  - `text_mining.js` - Text mining
  - `time_series.js` - Time series analysis
  - `data_processing.js` - Data processing
  - `analysis_support.js` - Analysis support
- `js/utils/` - Utility functions
- `js/components/` - UI components
- `css/` - Stylesheets
- `datasets/` - Demo datasets
- `tests/` - Playwright tests

## Running
- Dev server: `npx http-server -p 8765` (or similar)
- Tests: `npx playwright test`
