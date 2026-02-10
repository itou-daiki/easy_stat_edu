# Factor Analysis & PCA — Statistical Accuracy Review Report

**Project:** Easy Stat Edu  
**Scope:** Factor Analysis and PCA modules (client-side Vanilla JS, jStat, Plotly, math.js)  
**Review date:** 2025-02-10

---

## Factor Analysis

### js/analyses/factor_analysis.js

```
[INFO] factor_analysis.js (module) — KMO and Bartlett's test not implemented
  Expected: Optional KMO (Kaiser–Meyer–Olkin) and Bartlett's test of sphericity for factorability.
  Actual: Not computed or displayed.

[INFO] factor_analysis.js (module) — Communalities not displayed
  Expected: Communalities (sum of squared loadings per variable) in output.
  Actual: Not computed or shown.

[WARNING] factor_analysis.js:83 — Geomin factor correlations not shown
  Expected: Show factor correlation matrix for all oblique rotations (promax, oblimin, geomin).
  Actual: if (['promax', 'oblimin'].includes(rotationMethod) && factorCorrelations) — geomin is omitted; correlations are computed but not displayed.
```

### js/analyses/factor_analysis/helpers.js

```
[CRITICAL] factor_analysis/helpers.js:47 — math.eigs return property name
  Expected: math.js eigs() returns { values, eigenvectors } (array of { value, vector }). Use eigenvectors and build matrix or sorted vector list (e.g. matrixFromColumns(...eigenvectors.map(ev => ev.vector)) then sort by values).
  Actual: const { values, vectors } = math.eigs(corrMatrix); math.column(vectors, i). If only eigenvectors exists, vectors is undefined and code throws.

[WARNING] factor_analysis/helpers.js:46 — Correlation matrix uses pairwise deletion
  Expected: For FA, listwise deletion is standard so the correlation matrix is PSD and consistent.
  Actual: calculateCorrelationMatrix uses pairwise deletion (different n per pair); can yield non-PSD or inconsistent matrix.

[INFO] factor_analysis/helpers.js:36–64 — Eigenvalue decomposition
  Expected: Document which algorithm is used (math.eigs uses “traditional” methods, not necessarily Jacobi).
  Actual: math.eigs(corrMatrix); algorithm not specified in code.

[INFO] factor_analysis/helpers.js:72–134 — Varimax rotation
  Expected: Kaiser normalization, pairwise θ = atan2(numer,denom)/4, de-normalization.
  Actual: Implementation matches standard Varimax formulas.

[WARNING] factor_analysis/helpers.js:283–308 — Direct Oblimin gradient
  Expected: Gradient should match published direct oblimin (e.g. Harman, Mplus/psych).
  Actual: G[i][s] = 2*L[i][s]*(term1 - (gamma/p)*term2); verify against reference.

[INFO] factor_analysis/helpers.js:318–338 — Geomin rotation
  Expected: Geomin gradient (l²+ε)^(1/k), derivative (2/k)*(l/(l²+ε))*Π.
  Actual: Matches.

[INFO] factor_analysis/helpers.js:142–206 — Promax rotation
  Expected: Varimax target, H = |V|^(κ−1)*V, T from (V'V)^{-1}V'H, L = V*T, Phi = (T'T)^{-1}, correlation = Phi_ij/sqrt(Phi_ii*Phi_jj).
  Actual: Structure correct for pattern matrix and factor correlation.
```

### js/analyses/factor_analysis/visualization.js

```
[CRITICAL] factor_analysis/visualization.js:15–16, 44–45 — Initial eigenvalue contribution uses count not sum
  Expected: totalVariance = eigenvalues.reduce((a, b) => a + b, 0); contribution = (val / totalVariance) * 100.
  Actual: totalVariance = eigenvalues.length; contribution = (val / totalVariance) * 100. Wrong if only k eigenvalues passed; semantically total variance should be sum(eigenvalues).

[INFO] factor_analysis/visualization.js:183–209 — Scree plot
  Expected: Eigenvalues on y, component index on x, Kaiser line at y = 1.
  Actual: Correct.

[INFO] factor_analysis/visualization.js:92–117 — Loadings display
  Expected: Show loadings; common cutoff (e.g. 0.4) for “strong” loadings.
  Actual: Correct; threshold 0.4.

[INFO] factor_analysis/visualization.js:242–278 — Factor correlations
  Expected: Show factor correlation matrix for oblique rotations.
  Actual: Display logic correct. (Geomin returns factorCorrelations but factor_analysis.js:83 only shows for promax/oblimin; geomin correlations are computed but not displayed — consider adding 'geomin' to the condition.)
```

---

## PCA

### js/analyses/pca.js

```
[INFO] pca.js:85 — Algorithm description in UI
  Expected: “固有値分解 (math.eigs)” — math.js does not guarantee Jacobi/QR.
  Actual: Text says “ヤコビ法またはQR法等の近似解”.
```

### js/analyses/pca/helpers.js

```
[CRITICAL] pca/helpers.js:38 — math.eigs return property name
  Expected: Use eigenvectors (array of { value, vector }), build sorted vectors for loadings and scores.
  Actual: const { values, vectors } = math.eigs(corrMatrix); math.column(vectors, i). Same risk as FA if vectors is undefined.

[INFO] pca/helpers.js:19–31 — Standardization
  Expected: Z-scores (mean 0, sample SD) for correlation-based PCA.
  Actual: (row[v] - means[i]) / stds[i] with jStat.stdev(vals, true). Correct.

[INFO] pca/helpers.js:34–37 — Correlation matrix
  Expected: Correlation matrix for standardized data.
  Actual: calculateCorrelationMatrix(variables, currentData). Correct; pairwise deletion caveat as in FA.

[INFO] pca/helpers.js:52–56 — PC scores
  Expected: Scores = Z * V (standardized data × eigenvectors).
  Actual: matrix.map(row => sortedVectors.map(vec => math.dot(row, vec))). Correct.

[INFO] pca/helpers.js:40–50 — Eigenvalue/vector sorting
  Expected: Sort by eigenvalue descending.
  Actual: indices by values[b]-values[a]; sortedValues, sortedVectors. Correct.
```

### js/analyses/pca/visualization.js

```
[INFO] pca/visualization.js:12–46 — Proportion and cumulative variance
  Expected: total = sum(eigenvalues); contribution = (val/total)*100; cumulative sum.
  Actual: total = eigenvalues.reduce((a,b)=>a+b,0); correct.

[INFO] pca/visualization.js:78–111 — Component loadings
  Expected: Loadings = eigenvector × sqrt(eigenvalue).
  Actual: vectors[j][i] * Math.sqrt(values[j]). Correct (variable i, component j).

[INFO] pca/visualization.js:52–74 — Scree plot
  Expected: Eigenvalues (bars/lines).
  Actual: Correct.

[WARNING] pca/visualization.js:121–167 — Biplot variable arrows
  Expected: Optionally loadings (eigenvector × sqrt(eigenvalue)) for arrow length; or document that length is ad hoc.
  Actual: Raw eigenvector components × (scale*2); direction correct, length ad hoc.

[WARNING] pca/visualization.js:136 — Biplot with one component
  Expected: Guard when < 2 components or < 2 variables (pc2 or vectors[1] may be undefined).
  Actual: No guard; can break with single component.
```

---

## Summary

| Severity  | Count | Items |
|-----------|-------|--------|
| CRITICAL  | 3     | math.eigs `vectors` vs `eigenvectors` (FA helpers:47, PCA helpers:38); FA contribution totalVariance = eigenvalues.length (visualization.js:15–16). |
| WARNING   | 5     | Pairwise deletion (FA/PCA); Oblimin gradient verification; biplot scaling; biplot when &lt;2 components; Geomin factor correlations not displayed (factor_analysis.js:83). |
| INFO      | 12+   | KMO/Bartlett/communalities; algorithm wording; Varimax/Promax/Geomin correct; PCA standardization/loadings/scores; scree; interpretation. |

---

## Recommendations

1. **math.eigs:** Confirm math.js 11.7 return shape. If it returns only `eigenvectors`, update both `factor_analysis/helpers.js` and `pca/helpers.js` to use `eigenvectors` and build sorted vectors (e.g. from `eigenvectors[indices[i]].vector`).
2. **FA contribution:** In `factor_analysis/visualization.js`, use `totalVariance = eigenvalues.reduce((a, b) => a + b, 0)` for initial contribution and cumulative %.
3. **Correlation matrix:** Consider listwise deletion for FA/PCA or document pairwise and handle non-PSD.
4. **Oblimin:** Verify gradient against R `psych` or Mplus; add test if possible.
5. **Biplot:** Optionally use loadings for arrow length; guard when components or variables < 2.
6. **KMO / Bartlett / Communalities:** Add as optional diagnostics and communality column.
