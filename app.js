// ============================================================
// GENERADOR DE CREATIVOS - Gemini AI
// ============================================================

// --- Estado global ---
const state = {
    apiKey: '',
    cloudinaryCloudName: '',
    cloudinaryUploadPreset: '',
    creatives: [],
    generatedImages: [],
    approvedImages: JSON.parse(localStorage.getItem('approved_images') || '[]'),
    isGenerating: false,
    isUploading: false,
    // Concurrency pool
    activeWorkers: 0,
    maxConcurrency: 3,
    taskQueue: [],
    completed: 0,
    failed: [],
    totalImages: 0,
    // Regenerator
    regenResult: null,
    // Stop control
    stopRequested: false,
};

// --- DOM Elements ---
let $apiKey, $toggleKey, $saveKey, $keyStatus, $modelSelect, $aspectSelect,
    $qualitySelect, $concurrencySelect, $mdInput, $creativeCount, $btnGenerate,
    $btnStop, $progressPanel, $progressBar, $progressText, $batchLog, $galleryPanel,
    $galleryGrid, $btnApproveAll, $btnNewBatch, $approvedGrid, $approvedEmpty,
    $btnDownloadAll, $btnClearApproved, $approvedCountBadge,
    $regenPrompt, $regenModel, $regenAspect, $regenQuality, $btnRegen,
    $regenStatus, $regenResult, $regenImage, $btnRegenApprove, $btnRegenDownload,
    $btnRegenAgain, $statCompleted, $statActive, $statFailed,
    $cloudinaryCloudName, $cloudinaryUploadPreset, $saveCloudinary, $cloudinaryStatus,
    $btnUploadCloudinary, $uploadOverlay, $uploadProgressBar, $uploadProgressText, $uploadResults;

function cacheDom() {
    $apiKey = document.getElementById('api-key');
    $toggleKey = document.getElementById('toggle-key');
    $saveKey = document.getElementById('save-key');
    $keyStatus = document.getElementById('key-status');
    $modelSelect = document.getElementById('model-select');
    $aspectSelect = document.getElementById('aspect-select');
    $qualitySelect = document.getElementById('quality-select');
    $concurrencySelect = document.getElementById('concurrency-select');
    $mdInput = document.getElementById('md-input');
    $creativeCount = document.getElementById('creative-count');
    $btnGenerate = document.getElementById('btn-generate');
    $btnStop = document.getElementById('btn-stop');
    $progressPanel = document.getElementById('progress-panel');
    $progressBar = document.getElementById('progress-bar');
    $progressText = document.getElementById('progress-text');
    $batchLog = document.getElementById('batch-log');
    $galleryPanel = document.getElementById('gallery-panel');
    $galleryGrid = document.getElementById('gallery-grid');
    $btnApproveAll = document.getElementById('btn-approve-all');
    $btnNewBatch = document.getElementById('btn-new-batch');
    $approvedGrid = document.getElementById('approved-grid');
    $approvedEmpty = document.getElementById('approved-empty');
    $btnDownloadAll = document.getElementById('btn-download-all');
    $btnClearApproved = document.getElementById('btn-clear-approved');
    $approvedCountBadge = document.getElementById('approved-count-badge');
    $regenPrompt = document.getElementById('regen-prompt');
    $regenModel = document.getElementById('regen-model');
    $regenAspect = document.getElementById('regen-aspect');
    $regenQuality = document.getElementById('regen-quality');
    $btnRegen = document.getElementById('btn-regen');
    $regenStatus = document.getElementById('regen-status');
    $regenResult = document.getElementById('regen-result');
    $regenImage = document.getElementById('regen-image');
    $btnRegenApprove = document.getElementById('btn-regen-approve');
    $btnRegenDownload = document.getElementById('btn-regen-download');
    $btnRegenAgain = document.getElementById('btn-regen-again');
    $statCompleted = document.getElementById('stat-completed');
    $statActive = document.getElementById('stat-active');
    $statFailed = document.getElementById('stat-failed');
    $cloudinaryCloudName = document.getElementById('cloudinary-cloud-name');
    $cloudinaryUploadPreset = document.getElementById('cloudinary-upload-preset');
    $saveCloudinary = document.getElementById('save-cloudinary');
    $cloudinaryStatus = document.getElementById('cloudinary-status');
    $btnUploadCloudinary = document.getElementById('btn-upload-cloudinary');
    $uploadOverlay = document.getElementById('upload-overlay');
    $uploadProgressBar = document.getElementById('upload-progress-bar');
    $uploadProgressText = document.getElementById('upload-progress-text');
    $uploadResults = document.getElementById('upload-results');
}

// --- Init ---
function init() {
    cacheDom();
    loadApiKey();
    loadCloudinaryConfig();
    setupEventListeners();
    setupTabs();
    renderApprovedGallery();
}

function loadApiKey() {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
        state.apiKey = saved;
        $apiKey.value = saved;
        $keyStatus.textContent = '✓ Guardada';
        $keyStatus.classList.add('saved');
        updateGenerateButton();
    }
}

function loadCloudinaryConfig() {
    const cloudName = localStorage.getItem('cloudinary_cloud_name');
    const uploadPreset = localStorage.getItem('cloudinary_upload_preset');
    if (cloudName && uploadPreset) {
        state.cloudinaryCloudName = cloudName;
        state.cloudinaryUploadPreset = uploadPreset;
        if ($cloudinaryCloudName) $cloudinaryCloudName.value = cloudName;
        if ($cloudinaryUploadPreset) $cloudinaryUploadPreset.value = uploadPreset;
        if ($cloudinaryStatus) {
            $cloudinaryStatus.textContent = '✓ Configurado';
            $cloudinaryStatus.classList.add('saved');
        }
    }
}

function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
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
            $keyStatus.textContent = '✓ Guardada';
            $keyStatus.classList.add('saved');
            updateGenerateButton();
            updateRegenButton();
        }
    });

    $mdInput.addEventListener('input', () => {
        parseCreatives();
        updateGenerateButton();
    });

    $btnGenerate.addEventListener('click', startGeneration);
    $btnStop.addEventListener('click', stopGeneration);
    $btnApproveAll.addEventListener('click', approveAll);
    $btnNewBatch.addEventListener('click', resetForNewBatch);
    $btnDownloadAll.addEventListener('click', downloadAllApproved);
    $btnClearApproved.addEventListener('click', clearApproved);

    // Regenerator
    $regenPrompt.addEventListener('input', updateRegenButton);
    $btnRegen.addEventListener('click', regenerateSingle);
    $btnRegenApprove.addEventListener('click', approveRegenerated);
    $btnRegenDownload.addEventListener('click', downloadRegenerated);
    $btnRegenAgain.addEventListener('click', regenerateSingle);

    // Cloudinary
    $saveCloudinary.addEventListener('click', () => {
        const cloudName = $cloudinaryCloudName.value.trim();
        const uploadPreset = $cloudinaryUploadPreset.value.trim();
        if (cloudName && uploadPreset) {
            localStorage.setItem('cloudinary_cloud_name', cloudName);
            localStorage.setItem('cloudinary_upload_preset', uploadPreset);
            state.cloudinaryCloudName = cloudName;
            state.cloudinaryUploadPreset = uploadPreset;
            $cloudinaryStatus.textContent = '✓ Configurado';
            $cloudinaryStatus.classList.add('saved');
        } else {
            $cloudinaryStatus.textContent = 'Completá ambos campos';
            $cloudinaryStatus.classList.remove('saved');
        }
    });

    $btnUploadCloudinary.addEventListener('click', uploadToCloudinary);
}

// --- Parser ---
function parseCreatives() {
    const text = $mdInput.value;
    const creatives = [];
    const blocks = text.split(/^## Creative/gm);

    for (let i = 1; i < blocks.length; i++) {
        const block = '## Creative' + blocks[i];
        const creative = parseCreativeBlock(block);
        if (creative) creatives.push(creative);
    }

    state.creatives = creatives;
    $creativeCount.textContent = `${creatives.length} creativo${creatives.length !== 1 ? 's' : ''} detectado${creatives.length !== 1 ? 's' : ''}`;
    return creatives;
}

function parseCreativeBlock(block) {
    const titleMatch = block.match(/^## Creative\s+(\d+):\s*(.+)$/m);
    if (!titleMatch) return null;

    const number = titleMatch[1];
    const title = titleMatch[2].trim();

    let prompt = '';
    const startIdx = block.indexOf('**Visual idea:**');
    if (startIdx !== -1) {
        const endIdx = block.indexOf('\n---', startIdx);
        if (endIdx !== -1) {
            prompt = block.substring(startIdx, endIdx).trim();
        } else {
            prompt = block.substring(startIdx).trim();
        }
    }

    if (!prompt) return null;
    return { number, title, prompt };
}

// --- Generación con Pool de Concurrencia ---
function updateGenerateButton() {
    $btnGenerate.disabled = !(state.apiKey && state.creatives.length > 0 && !state.isGenerating);
}

function updateRegenButton() {
    $btnRegen.disabled = !(state.apiKey && $regenPrompt.value.trim().length > 0);
}

async function startGeneration() {
    if (state.isGenerating) return;
    state.isGenerating = true;
    state.stopRequested = false;
    state.generatedImages = [];
    state.completed = 0;
    state.failed = [];
    state.activeWorkers = 0;
    state.maxConcurrency = parseInt($concurrencySelect.value);

    const model = $modelSelect.value;
    const aspect = $aspectSelect.value;
    const quality = $qualitySelect.value;

    $progressPanel.style.display = 'block';
    $galleryPanel.style.display = 'none';
    $btnGenerate.disabled = true;
    $btnStop.style.display = 'inline-block';
    $batchLog.innerHTML = '';

    // Crear cola de tareas: cada creative x 2 variantes
    state.taskQueue = [];
    for (const creative of state.creatives) {
        for (let variant = 1; variant <= 2; variant++) {
            state.taskQueue.push({ creative, variant, model, aspect, quality, retries: 0 });
        }
    }
    state.totalImages = state.taskQueue.length;

    logEntry(`Iniciando generación: ${state.totalImages} imágenes, concurrencia: ${state.maxConcurrency}`, 'info');
    updateStats();

    // Lanzar pool
    await runPool();

    // Reintentos (solo si no se detuvo)
    if (state.failed.length > 0 && !state.stopRequested) {
        logEntry(`\n--- Reintentando ${state.failed.length} fallidos ---`, 'info');
        const retryTasks = state.failed.map(f => ({ ...f, retries: f.retries + 1 }));
        state.failed = [];
        state.taskQueue = retryTasks;
        await runPool();
    }

    // Finalizar
    const successCount = state.generatedImages.length;
    const stopMsg = state.stopRequested ? ' (DETENIDO)' : '';
    logEntry(`\n=== Finalizado${stopMsg}: ${successCount}/${state.totalImages} exitosas, ${state.failed.length} fallidas ===`, 'info');
    updateProgress(state.completed, state.totalImages, `Completado: ${successCount}/${state.totalImages}${stopMsg}`);

    state.isGenerating = false;
    state.stopRequested = false;
    $btnStop.style.display = 'none';
    $btnStop.disabled = false;
    $btnStop.textContent = '⛔ Detener';
    updateGenerateButton();

    if (state.generatedImages.length > 0) {
        renderGallery();
    }
}

function stopGeneration() {
    state.stopRequested = true;
    state.taskQueue = []; // Vaciar la cola
    logEntry('⛔ Deteniendo generación... esperando workers activos...', 'error');
    $btnStop.disabled = true;
    $btnStop.textContent = 'Deteniendo...';
}

function runPool() {
    return new Promise((resolve) => {
        const checkDone = () => {
            if ((state.taskQueue.length === 0 && state.activeWorkers === 0) || (state.stopRequested && state.activeWorkers === 0)) {
                resolve();
                return;
            }
            while (state.activeWorkers < state.maxConcurrency && state.taskQueue.length > 0 && !state.stopRequested) {
                const task = state.taskQueue.shift();
                state.activeWorkers++;
                updateStats();
                runTask(task).then(() => {
                    state.activeWorkers--;
                    updateStats();
                    checkDone();
                });
            }
        };
        checkDone();
    });
}

async function runTask(task) {
    const { creative, variant, model, aspect, quality, retries } = task;
    const label = `Creative ${creative.number} v${variant}`;

    updateProgress(state.completed, state.totalImages, `Generando: ${label}...`);

    const result = await generateImage(creative, variant, model, aspect, quality);

    if (result.success) {
        state.generatedImages.push({
            creative,
            variant,
            imageData: result.imageData,
            mimeType: result.mimeType,
            status: 'pending',
        });
        state.completed++;
        logEntry(`✓ ${label} generada`, 'success');
    } else {
        logEntry(`✗ ${label}: ${result.error}`, 'error');
        if (retries < 1) {
            state.failed.push(task);
        } else {
            state.completed++;
            logEntry(`✗ ${label}: descartada tras ${retries + 1} intentos`, 'error');
        }
    }
    updateProgress(state.completed, state.totalImages, '');
}

function updateStats() {
    if ($statCompleted) $statCompleted.textContent = `${state.completed} completadas`;
    if ($statActive) $statActive.textContent = `${state.activeWorkers} en curso`;
    if ($statFailed) $statFailed.textContent = `${state.failed.length} fallidas`;
}


async function generateImage(creative, variant, model, aspect, quality) {
    const qualityPrompt = quality === '2k' ? 'Generate this image in high resolution 2K quality. ' : '';
    const aspectPrompt = `The image aspect ratio must be ${aspect}. `;
    const fullPrompt = `${qualityPrompt}${aspectPrompt}${creative.prompt}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

    const body = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return { success: false, error: errData?.error?.message || `HTTP ${response.status}` };
        }

        const data = await response.json();

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

// --- Galería de Revisión ---
function renderGallery() {
    $galleryPanel.style.display = 'block';
    $galleryGrid.innerHTML = '';

    state.generatedImages.forEach((img, idx) => {
        const card = createImageCard(img, idx, 'review');
        $galleryGrid.appendChild(card);
    });
}

function createImageCard(img, idx, mode) {
    const card = document.createElement('div');
    card.className = `gallery-card ${img.status !== 'pending' ? img.status : ''}`;
    card.id = mode === 'review' ? `card-${idx}` : `approved-card-${idx}`;

    const imgSrc = `data:${img.mimeType};base64,${img.imageData}`;

    if (mode === 'review') {
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
    } else {
        card.innerHTML = `
            <img src="${imgSrc}" alt="Creative ${img.creative.number} v${img.variant}" loading="lazy">
            <div class="gallery-card-info">
                <div class="creative-name">Creative ${img.creative.number}: ${img.creative.title}</div>
                <div class="variant-label">Variante ${img.variant}</div>
            </div>
            <div class="gallery-card-actions">
                <button class="btn-extract" onclick="extractPrompt(${idx})">📋 Extraer Prompt</button>
                <button class="btn-download-single" onclick="downloadSingle(${idx})">⬇ Descargar</button>
                <button class="btn-reject-small" onclick="removeApproved(${idx})">✗</button>
            </div>
        `;
    }
    return card;
}

function approveImage(idx) {
    const img = state.generatedImages[idx];
    img.status = 'approved';
    updateCardStatus(idx);
    addToApproved(img);
}

function rejectImage(idx) {
    state.generatedImages[idx].status = 'rejected';
    updateCardStatus(idx);
}

function approveAll() {
    state.generatedImages.forEach((img, idx) => {
        if (img.status === 'pending') {
            img.status = 'approved';
            updateCardStatus(idx);
            addToApproved(img);
        }
    });
}

function updateCardStatus(idx) {
    const card = document.getElementById(`card-${idx}`);
    if (!card) return;
    const img = state.generatedImages[idx];
    card.className = `gallery-card ${img.status}`;
    const approveBtn = card.querySelector('.btn-approve');
    const rejectBtn = card.querySelector('.btn-reject');
    if (approveBtn) approveBtn.className = `btn-approve ${img.status === 'approved' ? 'active' : ''}`;
    if (rejectBtn) rejectBtn.className = `btn-reject ${img.status === 'rejected' ? 'active' : ''}`;
}

// --- Galería de Aprobados ---
function addToApproved(img) {
    // Evitar duplicados
    const exists = state.approvedImages.find(a =>
        a.creative.number === img.creative.number && a.variant === img.variant && a.imageData === img.imageData
    );
    if (exists) return;

    state.approvedImages.push({
        creative: img.creative,
        variant: img.variant,
        imageData: img.imageData,
        mimeType: img.mimeType,
    });
    saveApproved();
    renderApprovedGallery();
}

function removeApproved(idx) {
    state.approvedImages.splice(idx, 1);
    saveApproved();
    renderApprovedGallery();
}

function clearApproved() {
    if (!confirm('¿Seguro que querés limpiar toda la galería de aprobados?')) return;
    state.approvedImages = [];
    saveApproved();
    renderApprovedGallery();
}

function saveApproved() {
    // Guardar en localStorage (ojo: puede haber límite de ~5-10MB)
    try {
        localStorage.setItem('approved_images', JSON.stringify(state.approvedImages));
    } catch (e) {
        logEntry('⚠ localStorage lleno, no se pueden guardar más aprobados', 'error');
    }
    updateApprovedBadge();
}

function updateApprovedBadge() {
    if ($approvedCountBadge) {
        $approvedCountBadge.textContent = state.approvedImages.length;
    }
}

function renderApprovedGallery() {
    if (!$approvedGrid) return;
    $approvedGrid.innerHTML = '';
    updateApprovedBadge();

    if (state.approvedImages.length === 0) {
        $approvedEmpty.style.display = 'block';
        return;
    }
    $approvedEmpty.style.display = 'none';

    state.approvedImages.forEach((img, idx) => {
        const card = createImageCard({ ...img, status: 'approved' }, idx, 'approved');
        $approvedGrid.appendChild(card);
    });
}

function extractPrompt(idx) {
    const img = state.approvedImages[idx];
    if (!img) return;

    // Cambiar a tab regenerador
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="regenerator"]').classList.add('active');
    document.getElementById('tab-regenerator').classList.add('active');

    // Poner el prompt
    $regenPrompt.value = img.creative.prompt;
    updateRegenButton();
}

function downloadSingle(idx) {
    const img = state.approvedImages[idx];
    if (!img) return;
    const link = document.createElement('a');
    link.href = `data:${img.mimeType};base64,${img.imageData}`;
    link.download = `creative-${img.creative.number}-v${img.variant}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function downloadAllApproved() {
    if (state.approvedImages.length === 0) {
        alert('No hay imágenes aprobadas.');
        return;
    }
    for (const img of state.approvedImages) {
        const link = document.createElement('a');
        link.href = `data:${img.mimeType};base64,${img.imageData}`;
        link.download = `creative-${img.creative.number}-v${img.variant}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await sleep(200);
    }
}


// --- Regenerador Individual ---
async function regenerateSingle() {
    const prompt = $regenPrompt.value.trim();
    if (!prompt || !state.apiKey) return;

    $btnRegen.disabled = true;
    $regenStatus.textContent = 'Generando...';
    $regenResult.style.display = 'none';

    const model = $regenModel.value;
    const aspect = $regenAspect.value;
    const quality = $regenQuality.value;

    const qualityPrompt = quality === '2k' ? 'Generate this image in high resolution 2K quality. ' : '';
    const aspectPrompt = `The image aspect ratio must be ${aspect}. `;
    const fullPrompt = `${qualityPrompt}${aspectPrompt}${prompt}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

    const body = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            $regenStatus.textContent = `Error: ${errData?.error?.message || response.status}`;
            $btnRegen.disabled = false;
            return;
        }

        const data = await response.json();
        let imageData = null, mimeType = 'image/png';

        if (data.candidates && data.candidates[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData) {
                    imageData = part.inlineData.data;
                    mimeType = part.inlineData.mimeType || 'image/png';
                    break;
                }
            }
        }

        if (imageData) {
            state.regenResult = { imageData, mimeType, prompt };
            $regenImage.src = `data:${mimeType};base64,${imageData}`;
            $regenResult.style.display = 'block';
            $regenStatus.textContent = '✓ Generada exitosamente';
        } else {
            $regenStatus.textContent = 'Error: No se encontró imagen en la respuesta';
        }
    } catch (err) {
        $regenStatus.textContent = `Error: ${err.message}`;
    }

    $btnRegen.disabled = false;
    updateRegenButton();
}

function approveRegenerated() {
    if (!state.regenResult) return;
    state.approvedImages.push({
        creative: { number: 'R', title: 'Regenerada' },
        variant: state.approvedImages.filter(a => a.creative.number === 'R').length + 1,
        imageData: state.regenResult.imageData,
        mimeType: state.regenResult.mimeType,
    });
    saveApproved();
    renderApprovedGallery();
    $regenStatus.textContent = '✓ Agregada a aprobados';
}

function downloadRegenerated() {
    if (!state.regenResult) return;
    const link = document.createElement('a');
    link.href = `data:${state.regenResult.mimeType};base64,${state.regenResult.imageData}`;
    link.download = `regenerada-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

// --- Cloudinary Upload ---
async function uploadToCloudinary() {
    if (state.isUploading) return;

    if (!state.cloudinaryCloudName || !state.cloudinaryUploadPreset) {
        alert('Configurá tu Cloud Name y Upload Preset de Cloudinary primero (en la pestaña Generador).');
        return;
    }

    if (state.approvedImages.length === 0) {
        alert('No hay imágenes aprobadas para subir.');
        return;
    }

    state.isUploading = true;
    $btnUploadCloudinary.disabled = true;
    $uploadOverlay.style.display = 'flex';
    $uploadResults.innerHTML = '';

    const total = state.approvedImages.length;
    let completed = 0;
    let successCount = 0;

    for (const img of state.approvedImages) {
        updateUploadProgress(completed, total, `Subiendo: Creative ${img.creative.number} v${img.variant}...`);

        const result = await uploadSingleImage(img);

        if (result.success) {
            successCount++;
            addUploadResult(`✓ Creative ${img.creative.number} v${img.variant}`, 'success', result.url);
        } else {
            addUploadResult(`✗ Creative ${img.creative.number} v${img.variant}: ${result.error}`, 'error');
        }

        completed++;
        updateUploadProgress(completed, total, '');
        await sleep(300);
    }

    updateUploadProgress(total, total, `Completado: ${successCount}/${total} subidas exitosas`);

    state.isUploading = false;
    $btnUploadCloudinary.disabled = false;
}

async function uploadSingleImage(img) {
    const url = `https://api.cloudinary.com/v1_1/${state.cloudinaryCloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', `data:${img.mimeType};base64,${img.imageData}`);
    formData.append('upload_preset', state.cloudinaryUploadPreset);
    formData.append('folder', 'generador-creativos');
    formData.append('public_id', `creative-${img.creative.number}-v${img.variant}-${Date.now()}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            return { success: false, error: errData?.error?.message || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return { success: true, url: data.secure_url };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function updateUploadProgress(completed, total, message) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    $uploadProgressBar.style.width = `${pct}%`;
    $uploadProgressText.textContent = message || `${completed}/${total} imágenes (${pct}%)`;
}

function addUploadResult(text, type, url) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    if (url) {
        entry.innerHTML = `${text} → <a href="${url}" target="_blank" style="color:#7a9b7e;">ver imagen</a>`;
    } else {
        entry.textContent = text;
    }
    $uploadResults.appendChild(entry);
    $uploadResults.scrollTop = $uploadResults.scrollHeight;
}

// --- Start ---
init();
