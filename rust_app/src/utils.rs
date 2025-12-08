use std::error::Error;
use csv::ReaderBuilder;

pub fn parse_csv_to_columns(content: &str) -> Result<(Vec<String>, Vec<Vec<Option<f64>>>), Box<dyn Error>> {
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers: Vec<String> = reader.headers()?.iter().map(|s| s.to_string()).collect();
    let site = headers.len();
    let mut data: Vec<Vec<Option<f64>>> = vec![vec![]; site];

    for result in reader.records() {
        let record = result?;
        for (i, field) in record.iter().enumerate() {
            if let Ok(val) = field.parse::<f64>() {
                data[i].push(Some(val));
            } else {
                data[i].push(None); 
            }
        }
    }
    Ok((headers, data))
}
