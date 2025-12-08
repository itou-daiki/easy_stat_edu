use wasm_bindgen::prelude::*;
use serde::Serialize;
use crate::utils;

#[derive(Serialize)]
pub struct ColumnStats {
    pub name: String,
    pub count: usize,
    pub mean: Option<f64>,
    pub median: Option<f64>,
    pub std: Option<f64>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub q1: Option<f64>,
    pub q3: Option<f64>,
    pub skewness: Option<f64>,
    pub kurtosis: Option<f64>,
}

#[wasm_bindgen]
pub fn calculate_eda(csv_content: &str) -> String {
    match perform_eda(csv_content) {
        Ok(stats) => serde_json::to_string(&stats).unwrap_or_else(|_| "[]".to_string()),
        Err(e) => format!("{{\"error\": \"{}\"}}", e),
    }
}

fn perform_eda(content: &str) -> Result<Vec<ColumnStats>, Box<dyn std::error::Error>> {
    let (headers, data) = utils::parse_csv_to_columns(content)?;
    let mut results = Vec::new();

    for (i, col_data) in data.iter().enumerate() {
        let text_name = &headers[i];
        let valid_values: Vec<f64> = col_data.iter().filter_map(|&x| x).collect();

        if valid_values.is_empty() {
            continue;
        }

        results.push(calculate_vector_stats(text_name, &valid_values));
    }

    Ok(results)
}

fn calculate_vector_stats(name: &str, values: &[f64]) -> ColumnStats {
    let count = values.len();
    let mean = values.iter().sum::<f64>() / count as f64;
    
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let min = sorted.first().cloned();
    let max = sorted.last().cloned();

    let median = get_quantile(&sorted, 0.5);
    let q1 = get_quantile(&sorted, 0.25);
    let q3 = get_quantile(&sorted, 0.75);

    let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (count - 1) as f64;
    let std = Some(variance.sqrt());

    let n = count as f64;
    
    let m3: f64 = values.iter().map(|x| (x - mean).powi(3)).sum::<f64>() / n;
    let m4: f64 = values.iter().map(|x| (x - mean).powi(4)).sum::<f64>() / n;
    
    let skewness = if variance > 0.0 { Some(m3 / variance.powf(1.5)) } else { Some(0.0) };
    let kurtosis = if variance > 0.0 { Some(m4 / variance.powi(2) - 3.0) } else { Some(0.0) };

    ColumnStats {
        name: name.to_string(),
        count,
        mean: Some(mean),
        median,
        std,
        min,
        max,
        q1,
        q3,
        skewness,
        kurtosis,
    }
}

fn get_quantile(sorted: &[f64], q: f64) -> Option<f64> {
    if sorted.is_empty() { return None; }
    let pos = (sorted.len() - 1) as f64 * q;
    let base = pos.floor() as usize;
    let rest = pos - base as f64;

    if (base + 1) < sorted.len() {
        Some(sorted[base] + rest * (sorted[base + 1] - sorted[base]))
    } else {
        Some(sorted[base])
    }
}
