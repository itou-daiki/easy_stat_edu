import { currentData, dataCharacteristics, analyzeDataCharacteristics, updateFeatureCards } from '../main.js';

function runDataCleansing() {
    const resultsContainer = document.getElementById('cleansing-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '<h4>データ品質情報</h4>';

    if (!currentData) {
        resultsContainer.innerHTML = '<p>データがありません。</p>';
        return;
    }

    const nRows = currentData.length;
    const nCols = Object.keys(currentData[0] || {}).length;

    const missingInfo = Object.keys(currentData[0] || {}).map(col => {
        const missingCount = currentData.filter(row => row[col] == null).length;
        return { col, count: missingCount, rate: ((missingCount / nRows) * 100).toFixed(2) };
    });

    const stringifiedRows = currentData.map(row => JSON.stringify(row));
    const uniqueRows = new Set(stringifiedRows);
    const nDuplicates = nRows - uniqueRows.size;

    const dtypes = Object.keys(dataCharacteristics).flatMap(key => 
        dataCharacteristics[key].map(col => ({ col, type: key.replace('Columns', '') }))
    );

    resultsContainer.innerHTML = `
        <h5>データ概要</h5>
        <table class="table">
            <tr><td>総行数</td><td>${nRows}</td></tr>
            <tr><td>総列数</td><td>${nCols}</td></tr>
            <tr><td>重複行数</td><td>${nDuplicates}</td></tr>
        </table>
        <h5>欠損値情報</h5>
        <table class="table">
            <tr><th>変数名</th><th>欠損値数</th><th>欠損率 (%)</th></tr>
            ${missingInfo.map(m => `<tr><td>${m.col}</td><td>${m.count}</td><td>${m.rate}</td></tr>`).join('')}
        </table>
        <h5>データ型</h5>
        <table class="table">
             <tr><th>変数名</th><th>推測される型</th></tr>
             ${dtypes.map(d => `<tr><td>${d.col}</td><td>${d.type}</td></tr>`).join('')}
        </table>`;
}

function removeMissingRows() {
    const originalCount = currentData.length;
    window.currentData = currentData.filter(row => Object.values(row).every(val => val != null));
    const removedCount = originalCount - window.currentData.length;
    alert(`${removedCount}行の欠損値を含む行を削除しました。`);
    
    window.dataCharacteristics = analyzeDataCharacteristics(window.currentData);
    runDataCleansing();
    updateFeatureCards();
}

function removeDuplicates() {
    const originalCount = currentData.length;
    const stringifiedRows = new Set();
    window.currentData = currentData.filter(row => {
        const s = JSON.stringify(row);
        if (stringifiedRows.has(s)) return false;
        stringifiedRows.add(s);
        return true;
    });
    const removedCount = originalCount - window.currentData.length;
    alert(`${removedCount}行の重複行を削除しました。`);

    window.dataCharacteristics = analyzeDataCharacteristics(window.currentData);
    runDataCleansing();
    updateFeatureCards();
}

function fillMissingMean() {
    const { numericColumns } = dataCharacteristics;
    numericColumns.forEach(col => {
        const mean = jStat.mean(currentData.map(r => r[col]).filter(v => v != null));
        currentData.forEach(row => {
            if (row[col] == null) row[col] = mean;
        });
    });
    alert('数値列の欠損値を平均値で補完しました。');

    window.dataCharacteristics = analyzeDataCharacteristics(currentData);
    runDataCleansing();
    updateFeatureCards();
}

export function render(container) {
    container.innerHTML = `
        <div id="cleansing-actions" class="analysis-controls">
            <h5>クレンジング操作</h5>
            <button id="remove-missing-btn" class="btn-action">欠損値を含む行を削除</button>
            <button id="remove-duplicates-btn" class="btn-action">重複行を削除</button>
            <button id="fill-missing-mean-btn" class="btn-action">欠損値を平均値で補完 (数値列)</button>
        </div>
        <div id="cleansing-results" class="analysis-results"></div>
    `;

    document.getElementById('remove-missing-btn').addEventListener('click', removeMissingRows);
    document.getElementById('remove-duplicates-btn').addEventListener('click', removeDuplicates);
    document.getElementById('fill-missing-mean-btn').addEventListener('click', fillMissingMean);

    runDataCleansing();
}
