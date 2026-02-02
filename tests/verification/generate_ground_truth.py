
import pandas as pd
import numpy as np
import scipy.stats as stats
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.anova import anova_lm
import json
import os

# Paths
DATA_DIR = "datasets" 
OUTPUT_FILE = "tests/verification/ground_truth.json"

results = {}

def load_data(filename):
    return pd.read_csv(os.path.join(DATA_DIR, filename))

# 1. T-Test (Independent)
def verify_ttest_ind():
    df = load_data("demo_all_analysis.csv")
    # Group: 性別 (男性, 女性), Var: 数学
    g1 = df[df['性別'] == '男性']['数学'].dropna()
    g2 = df[df['性別'] == '女性']['数学'].dropna()
    
    # Student's t
    t, p = stats.ttest_ind(g1, g2, equal_var=True)
    results['ttest_ind_student'] = {'t': t, 'p': p}
    
    # Welch's t
    t_w, p_w = stats.ttest_ind(g1, g2, equal_var=False)
    results['ttest_ind_welch'] = {'t': t_w, 'p': p_w}

# 2. ANOVA One-Way
def verify_anova_oneway():
    df = load_data("demo_all_analysis.csv")
    # Factor: クラス, Var: 数学
    # Note: stats.f_oneway expects arrays
    groups = [df[df['クラス'] == c]['数学'].dropna() for c in df['クラス'].unique() if not pd.isna(c)]
    f, p = stats.f_oneway(*groups)
    results['anova_oneway'] = {'f': f, 'p': p}

# 3. Two-Way ANOVA Input
# Using demo_all_analysis has Factor1=クラス, Factor2=性別, Dep=数学
def verify_anova_twoway_ind():
    df = load_data("demo_all_analysis.csv")
    df = df.rename(columns={'クラス': 'FactorC', '性別': 'FactorS', '数学': 'OutcomeM'})
    # Type 2 (Standard for unbalanced if no interaction)
    model = ols('OutcomeM ~ FactorC + FactorS + FactorC:FactorS', data=df).fit()
    model = ols('OutcomeM ~ FactorC + FactorS + FactorC:FactorS', data=df).fit()
    table2 = sm.stats.anova_lm(model, typ=2)
    
    # Type 3 (Unweighted / Marginal - requires Sum contrasts)
    model3 = ols('OutcomeM ~ C(FactorC, Sum) + C(FactorS, Sum) + C(FactorC, Sum):C(FactorS, Sum)', data=df).fit()
    table3 = sm.stats.anova_lm(model3, typ=3)

    results['anova_twoway_ind'] = {
        'C': {'f': table3.loc['C(FactorC, Sum)', 'F'], 'p': table3.loc['C(FactorC, Sum)', 'PR(>F)']},
        'S': {'f': table3.loc['C(FactorS, Sum)', 'F'], 'p': table3.loc['C(FactorS, Sum)', 'PR(>F)']},
        'C:S': {'f': table3.loc['C(FactorC, Sum):C(FactorS, Sum)', 'F'], 'p': table3.loc['C(FactorC, Sum):C(FactorS, Sum)', 'PR(>F)']},
        'type2_C': table2.loc['FactorC', 'F'], # Just for debug/checking
        'type2_S': table2.loc['FactorS', 'F']
    }

# 4. Correlation
def verify_correlation():
    df = load_data("demo_all_analysis.csv")
    r, p = stats.pearsonr(df['数学'].dropna(), df['理科'].dropna())
    results['correlation'] = {'r': r, 'p': p}

# 5. Chi-Square
def verify_chisquare():
    df = load_data("demo_all_analysis.csv")
    contingency = pd.crosstab(df['性別'], df['クラス'])
    chi2, p, dof, expected = stats.chi2_contingency(contingency)
    results['chisquare'] = {'chi2': chi2, 'p': p}

# Run All
if __name__ == "__main__":
    try:
        verify_ttest_ind()
        verify_anova_oneway()
        verify_anova_twoway_ind()
        verify_correlation()
        verify_chisquare()
        
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=4)
        print("Ground truth generated successfully.")
    except Exception as e:
        print(f"Error: {e}")
