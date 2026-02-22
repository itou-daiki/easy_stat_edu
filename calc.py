import csv

def calc_rm_anova(filename, cols):
    data = []
    with open(filename, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append([float(row[c]) for c in cols])
    
    N = len(data)
    k = len(cols)
    
    grand_mean = sum(sum(row) for row in data) / (N * k)
    
    ss_total = sum(sum((val - grand_mean)**2 for val in row) for row in data)
    
    ss_subjects = k * sum(((sum(row)/k) - grand_mean)**2 for row in data)
    
    condition_means = [sum(data[i][j] for i in range(N))/N for j in range(k)]
    ss_conditions = N * sum((mean - grand_mean)**2 for mean in condition_means)
    
    ss_error = ss_total - ss_subjects - ss_conditions
    
    df_conditions = k - 1
    df_error = (N - 1) * (k - 1)
    
    ms_conditions = ss_conditions / df_conditions
    ms_error = ss_error / df_error
    
    F = ms_conditions / ms_error
    print(f"Cols {cols}: F = {F}")

calc_rm_anova('datasets/demo_all_analysis.csv', ['数学', '英語', '国語'])
calc_rm_anova('datasets/demo_all_analysis.csv', ['数学', '英語', '理科'])
