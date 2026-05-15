// ============================================================
// GENERADOR DE CREATIVOS - Gemini AI
// ============================================================

// --- Estado global ---
const state = {
    apiKey: '',
    creatives: [],
    generatedImages: [],
    isGenerating: false,
    currentBatch: 0,
    totalBatches: 0,
};

// --- DOM Elements ---
const $apiKey = document.getElementById('api-key');
const $toggleKey = document.getElementById('toggle-key');
const $saveKey = document.getElementById('save-key');
const $keyStatus = document.getElementById('key-status');
const $modelSelect = document.getElementById('model-select');
const $aspectSelect = document.getElementById('aspect-select');
const $qualitySelect = document.getElementById('quality-select');
const $mdInput = document.getElementById('md-input');
const $creativeCount = document.getElementById('creative-count');
const $btnGenerate = document.getElementById('btn-generate');
const $progressPanel = document.getElementById('progress-panel');
const $progressBar = document.getElementById('progress-bar');
const $progressText = document.getElementById('progress-text');
const $batchLog = document.getElementById('batch-log');
const $galleryPanel = document.getElementById('gallery-panel');
const $galleryGrid = document.getElementById('gallery-grid');
const $btnDownloadApproved = document.getElementById('btn-download-approved');
const $btnNewBatch = document.getElementById('btn-new-batch');

// --- Init ---
function init() {
    loadApiKey();
    setupEventListeners();
}

function loadApiKey() {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
        state.apiKey = saved;
        $apiKey.value = saved;
        $keyStatus.textContent = '✓ Guardada en localStorage';
        $keyStatus.classList.add('saved');
        updateGenerateButton();
    }
}

function setupEventListeners() {
    $toggleKey.addEventListener('click', () => {
        $apiKey.type = $apiKey.type === 'password' ? 'text' : 'password';
    });

    $saveKey.addEventListener('click', () => {
        const key = $apiKey.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            state.apiKey = key;
            $keyStatus.textContent = '✓ Guardada en localStorage';
            $keyStatus.classList.add('saved');
            updateGenerateButton();
        }
    });

    $mdInput.addEventListener('input', () => {
        parseCreatives();
        updateGenerateButton();
    });

    $btnGenerate.addEventListener('click', startGeneration);
    $btnDownloadApproved.addEventListener('click', downloadApproved);
    $btnNewBatch.addEventListener('click', resetForNewBatch);
}

// --- Parser ---
function parseCreatives() {
    const text = $mdInput.value;
    const creatives = [];

    // Split by "## Creative" headers
    const blocks = text.split(/^## Creative/gm);

    for (let i = 1; i < blocks.length; i++) {
        const block = '## Creative' + blocks[i];
        const creative = parseCreativeBlock(block);
        if (creative) {
            creatives.push(creative);
        }
    }

    state.creatives = creatives;
    $creativeCount.textContent = `${creatives.length} creativo${creatives.length !== 1 ? 's' : ''} detectado${creatives.length !== 1 ? 's' : ''}`;
    return creatives;
}

function parseCreativeBlock(block) {
    // Extraer título
    const titleMatch = block.match(/^## Creative\s+(\d+):\s*(.+)$/m);
    if (!titleMatch) return null;

    const number = titleMatch[1];
    const title = titleMatch[2].trim();

    // Extraer todo desde "Visual idea:" o "**Visual idea:**" hasta el final del bloque
    // Esto incluye Visual idea + Text overlays + Color Palette + Overall mood
    const promptMatch = block.match(/\*\*Visual idea:\*\*\s*([\s\S]*?)(?=^---|\Z)/m);

    let prompt = '';
    if (promptMatch) {
        // Tomamos todo desde "**Visual idea:**" hasta "---" o fin del bloque
        const startIdx = block.indexOf('**Visual idea:**');
        if (startIdx !== -1) {
            // Buscar el separador "---" que cierra el creative
            const endIdx = block.indexOf('\n---', startIdx);
            if (endIdx !== -1) {
                prompt = block.substring(startIdx, endIdx).trim();
            } else {
                prompt = block.substring(startIdx).trim();
            }
        }
    }

    if (!prompt) return null;

    return {
        number,
        title,
        prompt,
    };
}

// --- Generación ---
function updateGenerateButton() {
    $btnGenerate.disabled = !(state.apiKey && state.creatives.length > 0);
}

async function startGeneration() {
    if (state.isGenerating) return;
    state.isGenerating = true;
    state.generatedImages = [];

    const model = $modelSelect.value;
    const aspect = $aspectSelect.value;
    const quality = $qualitySelect.value;

    $progressPanel.style.display = 'block';
    $galleryPanel.style.display = 'none';
    $btnGenerate.disabled = true;
    $batchLog.innerHTML = '';

    const totalImages = state.creatives.length * 2;
    let completed = 0;
    let failed = [];

    // Procesar en batches de 5 creatives (10 imágenes)
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < state.creatives.length; i += batchSize) {
        batches.push(state.creatives.slice(i, i + batchSize));
    }

    state.totalBatches = batches.length;

    for (let b = 0; b < batches.length; b++) {
        state.currentBatch = b + 1;
        logEntry(`--- Batch ${b + 1}/${batches.length} ---`, 'info');

        const batch = batches[b];

        // Generar 2 imágenes por creative, de forma secuencial por API limits
        for (const creative of batch) {
            for (let variant = 1; variant <= 2; variant++) {
                updateProgress(completed, totalImages, `Generando: Creative ${creative.number} - Variante ${variant}`);

                const result = await generateImage(creative, variant, model, aspect, quality);

                if (result.success) {
                    state.generatedImages.push({
                        creative: creative,
                        variant,
                        imageData: result.imageData,
                        mimeType: result.mimeType,
                        status: 'pending', // pending, approved, rejected
                    });
                    logEntry(`✓ Creative ${creative.number} v${variant} generada`, 'success');
                    completed++;
                } else {
                    logEntry(`✗ Creative ${creative.number} v${variant}: ${result.error}`, 'error');
                    failed.push({ creative, variant, error: result.error });
                }

                updateProgress(completed, totalImages, '');
                // Pequeña pausa entre requests
                await sleep(500);
            }
        }
    }

    // Reintentos para fallidos
    if (failed.length > 0) {
        logEntry(`\n--- Reintentando ${failed.length} fallidos ---`, 'info');
        const retryFailed = [...failed];
        failed = [];

        for (const item of retryFailed) {
            updateProgress(completed, totalImages, `Reintentando: Creative ${item.creative.number} v${item.variant}`);
            await sleep(2000); // Esperar más antes de reintentar

            const result = await generateImage(item.creative, item.variant, model, aspect, quality);

            if (result.success) {
                state.generatedImages.push({
                    creative: item.creative,
                    variant: item.variant,
                    imageData: result.imageData,
                    mimeType: result.mimeType,
                    status: 'pending',
                });
                logEntry(`✓ Reintento exitoso: Creative ${item.creative.number} v${item.variant}`, 'success');
                completed++;
            } else {
                logEntry(`✗ Reintento fallido: Creative ${item.creative.number} v${item.variant}: ${result.error}`, 'error');
            }
            updateProgress(completed, totalImages, '');
        }
    }

    // Finalizar
    updateProgress(completed, totalImages, `Completado: ${completed}/${totalImages} imágenes`);
    logEntry(`\n=== Generación finalizada: ${completed}/${totalImages} exitosas ===`, 'info');

    state.isGenerating = false;
    $btnGenerate.disabled = false;

    // Mostrar galería
    if (state.generatedImages.length > 0) {
        renderGallery();
    }
}

async function generateImage(creative, variant, model, aspect, quality) {
    const qualityPrompt = quality === '2k' ? 'Generate this image in high resolution 2K quality. ' : '';
    const aspectPrompt = `The image aspect ratio must be ${aspect}. `;

    const fullPrompt = `${qualityPrompt}${aspectPrompt}${creative.prompt}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

    const body = {
        contents: [{
            parts: [{
                text: fullPrompt
            }]
        }],
        generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP ${response.status}`;
            return { success: false, error: errMsg };
        }

        const data = await response.json();

        // Buscar la imagen en la respuesta
        if (data.candidates && data.candidates[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData) {
                    return {
                        success: true,
                        imageData: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'image/png',
                    };
                }
            }
        }

        return { success: false, error: 'No se encontró imagen en la respuesta' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// --- Progreso ---
function updateProgress(completed, total, message) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    $progressBar.style.width = `${pct}%`;
    $progressText.textContent = message || `${completed}/${total} imágenes (${pct}%)`;
}

function logEntry(text, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = text;
    $batchLog.appendChild(entry);
    $batchLog.scrollTop = $batchLog.scrollHeight;
}

// --- Galería ---
function renderGallery() {
    $galleryPanel.style.display = 'block';
    $galleryGrid.innerHTML = '';

    state.generatedImages.forEach((img, idx) => {
        const card = document.createElement('div');
        card.className = `gallery-card ${img.status !== 'pending' ? img.status : ''}`;
        card.id = `card-${idx}`;

        const imgSrc = `data:${img.mimeType};base64,${img.imageData}`;

        card.innerHTML = `
            <img src="${imgSrc}" alt="Creative ${img.creative.number} v${img.variant}" loading="lazy">
            <div class="gallery-card-info">
                <div class="creative-name">Creative ${img.creative.number}: ${img.creative.title}</div>
                <div class="variant-label">Variante ${img.variant}</div>
            </div>
            <div class="gallery-card-actions">
                <button class="btn-approve ${img.status === 'approved' ? 'active' : ''}" onclick="approveImage(${idx})">✓ Aprobar</button>
                <button class="btn-reject ${img.status === 'rejected' ? 'active' : ''}" onclick="rejectImage(${idx})">✗ Descartar</button>
            </div>
        `;

        $galleryGrid.appendChild(card);
    });
}

function approveImage(idx) {
    state.generatedImages[idx].status = 'approved';
    updateCardStatus(idx);
}

function rejectImage(idx) {
    state.generatedImages[idx].status = 'rejected';
    updateCardStatus(idx);
}

function updateCardStatus(idx) {
    const card = document.getElementById(`card-${idx}`);
    const img = state.generatedImages[idx];
    card.className = `gallery-card ${img.status}`;

    const approveBtn = card.querySelector('.btn-approve');
    const rejectBtn = card.querySelector('.btn-reject');
    approveBtn.className = `btn-approve ${img.status === 'approved' ? 'active' : ''}`;
    rejectBtn.className = `btn-reject ${img.status === 'rejected' ? 'active' : ''}`;
}

// --- Descargar aprobados ---
async function downloadApproved() {
    const approved = state.generatedImages.filter(img => img.status === 'approved');
    if (approved.length === 0) {
        alert('No hay imágenes aprobadas para descargar.');
        return;
    }

    for (const img of approved) {
        const link = document.createElement('a');
        link.href = `data:${img.mimeType};base64,${img.imageData}`;
        link.download = `creative-${img.creative.number}-v${img.variant}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await sleep(200);
    }
}

// --- Reset ---
function resetForNewBatch() {
    state.generatedImages = [];
    $progressPanel.style.display = 'none';
    $galleryPanel.style.display = 'none';
    $mdInput.value = '';
    $creativeCount.textContent = '0 creativos detectados';
    state.creatives = [];
    updateGenerateButton();
}

// --- Utils ---
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Start ---
init();
