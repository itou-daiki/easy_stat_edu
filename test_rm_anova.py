import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import ols

df = pd.read_csv('datasets/demo_all_analysis.csv')
subset = df[['ID', '数学', '英語', '理科']]
long_df = pd.melt(subset, id_vars=['ID'], value_vars=['数学', '英語', '理科'], var_name='Subject', value_name='Score')

# One-way repeated ANOVA using statsmodels AnovaRM
from statsmodels.stats.anova import AnovaRM
res = AnovaRM(long_df, 'Score', 'ID', within=['Subject']).fit()
print(res)
