import init, { calculate_eda, calculate_correlation } from '../pkg/easy_stat_edu_rust.js';

let currentFileContent = null;
let currentMode = 'eda';

async function run() {
    await init();
    console.log("Wasm initialized");

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const tabs = document.querySelectorAll('button[data-target]');

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('tab-active');
                t.classList.add('text-slate-500');
            });
            tab.classList.add('tab-active');
            tab.classList.remove('text-slate-500');

            currentMode = tab.dataset.target;

            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${currentMode}`).classList.remove('hidden');

            if (currentFileContent) {
                runAnalysis();
            }
        });
    });

    // File Upload Handlers (Drag & Drop)
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentFileContent = event.target.result;
            runAnalysis();
        };
        reader.readAsText(file);
    }

    function runAnalysis() {
        if (!currentFileContent) return;

        try {
            if (currentMode === 'eda') {
                const json = calculate_eda(currentFileContent);
                renderEDA(JSON.parse(json));
            } else if (currentMode === 'correlation') {
                const json = calculate_correlation(currentFileContent);
                renderCorrelation(JSON.parse(json));
            }
        } catch (e) {
            console.error(e);
            alert("Analysis failed");
        }
    }

    function renderEDA(stats) {
        const tbody = document.getElementById('eda-table-body');
        tbody.innerHTML = '';
        if (stats.error) { alert(stats.error); return; }

        stats.forEach(col => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 font-medium text-slate-900">${col.name}</td>
                <td class="px-6 py-4 text-slate-600">${formatNum(col.mean)}</td>
                <td class="px-6 py-4 text-slate-600">${formatNum(col.median)}</td>
                <td class="px-6 py-4 text-slate-600">${formatNum(col.std)}</td>
                <td class="px-6 py-4 text-slate-600">${formatNum(col.min)}</td>
                <td class="px-6 py-4 text-slate-600">${formatNum(col.max)}</td>
            `;
            tbody.appendChild(tr);
        });

        const chartSection = document.getElementById('eda-charts');
        chartSection.innerHTML = '';

        const validStats = stats.filter(s => s.mean !== null);
        if (validStats.length > 0) {
            const container = document.createElement('div');
            container.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-200";
            chartSection.appendChild(container);

            Plotly.newPlot(container, [{
                x: validStats.map(s => s.name),
                y: validStats.map(s => s.mean),
                type: 'bar',
                marker: { color: '#6366f1' }
            }], {
                title: 'Average Values',
                margin: { t: 40, r: 20, l: 40, b: 40 }
            });
        }
    }

    function renderCorrelation(data) {
        const container = document.getElementById('correlation-results');
        container.innerHTML = `<pre class="text-left bg-slate-50 p-4 rounded">${JSON.stringify(data, null, 2)}</pre>`;
    }

    function formatNum(val) {
        return (val === null || val === undefined) ? "-" : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
}

run();
