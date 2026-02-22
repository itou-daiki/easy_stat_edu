const fs = require('fs');
const path = require('path');

const file = fs.readFileSync('datasets/demo_all_analysis.csv', 'utf8');
const lines = file.trim().split('\n');
const headers = lines[0].split(',');

const colsToCalc = ['数学', '英語', '理科'];
const indices = colsToCalc.map(c => headers.indexOf(c));

const data = [];
for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    data.push(indices.map(idx => parseFloat(parts[idx])));
}

const N = data.length;
const k = colsToCalc.length;

let grandSum = 0;
data.forEach(r => r.forEach(v => grandSum += v));
const grandMean = grandSum / (N * k);

let ssTotal = 0;
data.forEach(r => r.forEach(v => ssTotal += Math.pow(v - grandMean, 2)));

let ssSubjects = 0;
data.forEach(r => {
    const subMean = r.reduce((a, b) => a + b, 0) / k;
    ssSubjects += k * Math.pow(subMean - grandMean, 2);
});

let ssConditions = 0;
for (let j = 0; j < k; j++) {
    let condSum = 0;
    for (let i = 0; i < N; i++) {
        condSum += data[i][j];
    }
    const condMean = condSum / N;
    ssConditions += N * Math.pow(condMean - grandMean, 2);
}

const ssError = ssTotal - ssSubjects - ssConditions;
const dfConditions = k - 1;
const dfError = (N - 1) * (k - 1);

const msConditions = ssConditions / dfConditions;
const msError = ssError / dfError;

const F = msConditions / msError;

console.log(`msConditions=${msConditions}, msError=${msError}`);
console.log(`N=${N}, k=${k}`);
console.log(`F = ${F}`);
