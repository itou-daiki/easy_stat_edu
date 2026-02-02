
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

# 6. Simple Regression
# Dependent: 数学 (OutcomeM), Indep: 学習時間 (Time)
def verify_regression_simple():
    df = load_data("demo_all_analysis.csv")
    df = df.rename(columns={'数学': 'OutcomeM', '学習時間': 'Time'})
    model = ols('OutcomeM ~ Time', data=df).fit()
    
    results['regression_simple'] = {
        'R2': model.rsquared,
        'intercept': model.params['Intercept'],
        'coef_time': model.params['Time'],
        'p_time': model.pvalues['Time']
    }

# 7. Multiple Regression
# Dependent: 数学 (OutcomeM), Indep: 学習時間 (Time) + 英語 (Eng)
def verify_regression_multiple():
    df = load_data("demo_all_analysis.csv")
    df = df.rename(columns={'数学': 'OutcomeM', '学習時間': 'Time', '英語': 'Eng'})
    model = ols('OutcomeM ~ Time + Eng', data=df).fit()
    
    results['regression_multiple'] = {
        'R2': model.rsquared,
        'adj_R2': model.rsquared_adj,
        'intercept': model.params['Intercept'],
        'coef_time': model.params['Time'],
        'coef_eng': model.params['Eng'],
        'p_time': model.pvalues['Time'],
        'p_eng': model.pvalues['Eng']
    }

# 8. One-Way Repeated Measures ANOVA
# Uses wide-format: 数学, 英語, 理科 as 3 conditions for each subject (row)
def verify_anova_oneway_repeated():
    df = load_data("demo_all_analysis.csv")
    # Need pingouin for repeated measures
    try:
        import pingouin as pg
    except ImportError:
        print("pingouin not installed, skipping repeated measures verification")
        return
    
    # Convert wide to long format for pingouin
    df_long = df[['ID', '数学', '英語', '理科']].melt(
        id_vars=['ID'], 
        value_vars=['数学', '英語', '理科'],
        var_name='Subject', 
        value_name='Score'
    )
    df_long = df_long.dropna()
    
    # rm_anova returns a DataFrame with columns: Source, SS, DF, MS, F, p-unc, ...
    # Row 0 is the within-subject factor (Subject)
    aov = pg.rm_anova(data=df_long, dv='Score', within='Subject', subject='ID', detailed=True)
    
    # For One-Way RM ANOVA, DF for the factor is k-1, and we need error DF
    df_factor = int(aov.loc[0, 'DF'])
    df_error = int(aov.loc[1, 'DF']) if len(aov) > 1 else (len(df_long['ID'].unique()) - 1) * df_factor
    
    results['anova_oneway_repeated'] = {
        'F': float(aov.loc[0, 'F']),
        'p': float(aov.loc[0, 'p-unc']),
        'ddof1': df_factor,
        'ddof2': df_error
    }

# 9. Mixed ANOVA (Between: 性別, Within: 数学/英語/理科)
def verify_anova_mixed():
    df = load_data("demo_all_analysis.csv")
    try:
        import pingouin as pg
    except ImportError:
        print("pingouin not installed, skipping mixed ANOVA verification")
        return
    
    # Convert to long format
    df_long = df[['ID', '性別', '数学', '英語', '理科']].melt(
        id_vars=['ID', '性別'],
        value_vars=['数学', '英語', '理科'],
        var_name='Subject',
        value_name='Score'
    )
    df_long = df_long.dropna()
    
    aov = pg.mixed_anova(data=df_long, dv='Score', within='Subject', between='性別', subject='ID')
    
    # Results has 3 rows with Source: 性別, Subject, Interaction
    row_between = aov[aov['Source'] == '性別'].iloc[0]
    row_within = aov[aov['Source'] == 'Subject'].iloc[0]
    row_inter = aov[aov['Source'] == 'Interaction'].iloc[0]
    
    results['anova_mixed'] = {
        'between': {'F': float(row_between['F']), 'p': float(row_between['p-unc'])},
        'within': {'F': float(row_within['F']), 'p': float(row_within['p-unc'])},
        'interaction': {'F': float(row_inter['F']), 'p': float(row_inter['p-unc'])}
    }

# 10. PCA - Principal Component Analysis
def verify_pca():
    df = load_data("demo_all_analysis.csv")
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler
    
    # Use numeric columns: 数学, 英語, 理科, 学習時間
    cols = ['数学', '英語', '理科', '学習時間']
    X = df[cols].dropna()
    
    # Standardize (the JS uses correlation matrix, equivalent to standardized data PCA)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    pca = PCA()
    pca.fit(X_scaled)
    
    # Eigenvalues (variance explained by each PC)
    eigenvalues = pca.explained_variance_.tolist()
    # Explained variance ratio (cumulative)
    explained_ratio = pca.explained_variance_ratio_.tolist()
    # Loadings (components_ = eigenvectors, transpose for variables x components)
    loadings = pca.components_.T.tolist()  # Shape: (n_vars, n_components)
    
    results['pca'] = {
        'eigenvalues': eigenvalues,
        'explained_ratio': explained_ratio,
        'n_components': len(eigenvalues),
        # First PC loadings for verification
        'pc1_loadings': [row[0] for row in loadings]
    }


def varimax(Phi, gamma=1.0, q=20, tol=1e-6):
    from numpy import eye, asarray, dot, sum, diag
    from numpy.linalg import svd
    p, k = Phi.shape
    R = eye(k)
    d = 0
    for i in range(q):
        d_old = d
        Lambda = dot(Phi, R)
        u, s, vh = svd(dot(Phi.T, asarray(Lambda)**3 - (gamma/p) * dot(Lambda, diag(sum(Lambda**2, axis=0)))))
        R = dot(u, vh)
        d = sum(s)
        if d_old != 0 and d/d_old < 1 + tol: break
    return dot(Phi, R)

def varimax_classic(loadings, max_iter=50, epsilon=1e-6):
    """
    Classic iterative pair-wise Varimax with Kaiser normalization,
    matching the JavaScript implementation logic more closely.
    """
    import numpy as np
    X = np.array(loadings)
    n_rows, n_cols = X.shape
    
    # Kaiser Normalization
    h = np.sqrt(np.sum(X**2, axis=1))
    # Handle zero rows
    h[h < 1e-9] = 1.0 
    X_rel = X / h[:, None]
    
    # Varimax Rotation (Wikipedia / Kaiser 1958)
    curr = X_rel.copy()
    d = 0
    
    for _ in range(max_iter):
        d_old = d
        d = 0
        
        for i in range(n_cols):
            for j in range(i + 1, n_cols):
                x = curr[:, i].copy()
                y = curr[:, j].copy()
                
                # u = x^2 - y^2, v = 2xy
                u = x**2 - y**2
                v = 2 * x * y
                
                sum_d = np.sum(u)
                sum_c = np.sum(v)
                sum_d2_minus_c2 = np.sum(u**2 - v**2)
                sum_2dc = np.sum(2 * u * v)
                
                # JS Formula:
                # numer = 2 * (p * sum_2dc - sum_d * sum_c);
                # denom = p * sum_d2_minus_c2 - (sum_d * sum_d - sum_c * sum_c);
                
                p = n_rows
                numer = 2 * (p * sum_2dc - sum_d * sum_c)
                denom = p * sum_d2_minus_c2 - (sum_d**2 - sum_c**2)
                
                phi = np.arctan2(numer, denom) / 4.0
                
                if np.abs(phi) > epsilon:
                    d += np.abs(phi)
                    c = np.cos(phi)
                    s = np.sin(phi)
                    curr[:, i] = c * x + s * y
                    curr[:, j] = -s * x + c * y
        
        if d < epsilon:
            break
            
    # Kaiser De-normalization
    # Restore h where it was zero? No, h was 1 where it was zero, so div by 1 is safe.
    # But for de-normalization, multiply by original h.
    # Re-calculate h from original X or use saved h?
    # Original h has 0s.
    # If h[i] was < 1e-9, we set it to 1. But for de-norm we should multiply by 0 (original Norm).
    # So we need original h.
    
    h_orig = np.sqrt(np.sum(X**2, axis=1))
    X_final = curr * h_orig[:, None]
    
    return X_final.tolist()

# 11. Factor Analysis
def verify_factor_analysis():
    df = load_data("demo_all_analysis.csv")
    import numpy as np
    from sklearn.preprocessing import StandardScaler
    
    # Use numeric columns: 数学, 英語, 理科, 学習時間
    cols = ['数学', '英語', '理科', '学習時間']
    X = df[cols].dropna()
    
    # 1. Unrotated: PCA on Correlation Matrix (Manual)
    # Calculate Correlation Matrix (Pearson)
    corr_matrix = X.corr(method='pearson').values
    
    # Eigen decomposition (eigh for symmetric)
    # Returns eigenvalues in ascending order
    evals, evecs = np.linalg.eigh(corr_matrix)
    
    # Sort descending
    idx = np.argsort(evals)[::-1]
    evals = evals[idx]
    evecs = evecs[:, idx]
    
    # Keep top 2 factors
    n_factors = 2
    evals_top = evals[:n_factors]
    evecs_top = evecs[:, :n_factors]
    
    # Loadings = eigenvector * sqrt(eigenvalue)
    # evecs columns are eigenvectors corresponding to eigenvalues
    # But wait, eigenvectors from eigh are normalized to length 1.
    # Loadings L = V * D^(1/2)
    loadings_unrotated = evecs_top * np.sqrt(evals_top)
    
    # Enforce deterministic sign: make the first element of each column positive
    for col in range(n_factors):
        if loadings_unrotated[0, col] < 0:
            loadings_unrotated[:, col] *= -1
    
    # 2. Varimax Rotation (Manual with Kaiser, to match JS)
    loadings_varimax = varimax_classic(loadings_unrotated.tolist())
    
    # 3. Promax (Skip)
    loadings_promax = [[0]*2 for _ in range(4)]
    
    results['factor_analysis'] = {
        'eigenvalues': evals.tolist(), 
        'unrotated_loadings': loadings_unrotated.tolist(),
        'varimax_loadings': loadings_varimax,
        'promax_loadings': loadings_promax
    }

# Run All
if __name__ == "__main__":
    try:
        verify_ttest_ind()
        verify_anova_oneway()
        verify_anova_twoway_ind()
        verify_correlation()
        verify_chisquare()
        verify_regression_simple()
        verify_regression_multiple()
        verify_anova_oneway_repeated()
        verify_anova_mixed()
        verify_pca()
        verify_factor_analysis()
        
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=4)
        print("Ground truth generated successfully.")
    except Exception as e:
        print(f"Error: {e}")
