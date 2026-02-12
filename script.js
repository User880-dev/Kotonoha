/**
 * ==============================================================================
 * script.js - PART 1: CONSTANTS & UTILITIES
 * ==============================================================================
 */

// --- 1. グローバル設定 ---
let apiKey = localStorage.getItem('kotonoha_api_key') || "";
const GEMINI_MODEL = "gemini-2.5-flash"; 
const IMAGEN_MODEL = "imagen-3-pro"; 

// 45種類の最新モデルレジストリ（完全版）
const MODEL_REGISTRY = {
    stable: [
        "gemini-3.0-flash", "gemini-3.0-pro", "gemini-2.5-flash", "gemini-2.5-pro",
        "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001", "gemini-2.5-flash-lite",
        "gemini-1.5-pro", "gemini-1.5-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-ultra-latest"
    ],
    specialized: [
        "imagen-3-pro", "imagen-3-fast", "gemini-2.5-flash-image", "gemini-2.5-pro-image",
        "gemini-2.0-flash-exp-image-generation", "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts", "veo-1.0-video-generation", "gemini-3-pro-vision", "nano-banana-pro-preview"
    ],
    preview: [
        "gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-3-ultra-preview",
        "gemini-2.5-flash-preview-09-2025", "gemini-2.5-flash-lite-preview-09-2025",
        "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-exp-1206",
        "gemini-2.5-computer-use-preview-10-2025", "deep-research-pro-preview-12-2025",
        "gemini-robotics-er-1.5-preview", "gemini-3-med-pro", "gemini-3-code-pro",
        "gemini-3-law-pro", "gemini-3-finance-pro"
    ],
    gemma: [
        "gemma-3-1b-it", "gemma-3-4b-it", "gemma-3-12b-it", "gemma-3-27b-it",
        "gemma-3n-e4b-it", "gemma-3n-e2b-it", "gemma-2-27b", "gemma-2-9b"
    ]
};

const GENRE_DEFINITIONS = {
    "ファンタジー": ["王道", "異世界転生", "ダーク", "現代異能", "魔法少女"],
    "SF": ["スペースオペラ", "サイバーパンク", "タイムリープ", "近未来"],
    "ミステリー": ["本格推理", "サスペンス", "ハードボイルド", "日常の謎"],
    "恋愛": ["学園ラブコメ", "大人の恋愛", "悲恋", "幼馴染"],
    "ホラー": ["心霊", "サイコホラー", "怪談", "クトゥルフ神話"],
    "純文学": ["私小説", "青春", "家族・人間ドラマ", "哲学・思想"]
};

const RANDOM_WORDS = ["雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車"];

// --- 2. 共通ユーティリティ ---

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 画像圧縮
const compressImage = (base64Str, maxWidth = 300, quality = 0.7) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scaleSize = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str);
    });
};

// PCM音声 -> WAV
const pcmToWav = (base64PCM) => {
    const binaryString = window.atob(base64PCM);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (v, o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(view, 8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, bytes.length, true);
    return URL.createObjectURL(new Blob([view, bytes], { type: 'audio/wav' }));
};
/**
 * ==============================================================================
 * script.js - PART 2: API WRAPPERS & DATA MANAGEMENT
 * ==============================================================================
 */

// --- 1. API基本通信 ---
const apiCall = async (url, payload) => {
    if (!apiKey) throw new Error("APIキーが未設定です。");
    const response = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `通信エラー: ${response.status}`);
    }
    return response.json();
};

const generateText = async (prompt, systemPrompt = "") => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const generateImage = async (prompt) => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], candidateCount: 1 }
    };
    try {
        const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent`, payload);
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart) return `data:image/png;base64,${imagePart.inlineData.data}`;
        
        // バックアップ用（2.0-flash画像生成）
        const fallbackData = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent`, payload);
        const fbPart = fallbackData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return fbPart ? `data:image/png;base64,${fbPart.inlineData.data}` : null;
    } catch (e) { throw new Error("画像生成エラー: APIキーの権限を確認してください。"); }
};

const generateSpeech = async (text) => {
    const payload = {
        contents: [{ parts: [{ text: "朗読してください:\n" + text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } }
    };
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return audioPart ? audioPart.inlineData.data : null;
};

// --- 2. データ管理ロジック ---
let books = [];
let activeBook = null;
let backgroundImage = localStorage.getItem('kotonoha_bg') || null;

function loadData() {
    const saved = localStorage.getItem('kotonoha_books');
    if (saved) { try { books = JSON.parse(saved); } catch (e) { books = []; } }
}

function saveData() { localStorage.setItem('kotonoha_books', JSON.stringify(books)); }

function applyBackground() {
    const bg = document.getElementById('bg-layer');
    if (backgroundImage) { bg.style.backgroundImage = `url(${backgroundImage})`; bg.style.opacity = '1'; }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    target.classList.remove('hidden');
    if (viewName !== 'library') target.classList.add('flex');
    window.scrollTo(0, 0);
}

// --- 3. 縦書き描画エンジン ---
function renderVerticalText(container, content, illustrations = []) {
    if (!content) { container.innerHTML = '<p class="text-gray-400">白紙です</p>'; return; }
    container.innerHTML = '';
    const lines = content.split('\n');
    let html = '';
    let area = 'body'; 

    lines.forEach(line => {
        const text = line.trim();
        if (!text) { html += '<div style="height:100%; width:1.5em; min-width:1.5em;"></div>'; return; }

        // 特殊タグ[挿絵]の処理
        const imgMatch = text.match(/\[挿絵:(.+?)\]/);
        if (imgMatch) {
            const imgData = illustrations.find(img => img.id === imgMatch[1]);
            if (imgData) html += `<div class="vertical-image-container"><img src="${imgData.data}"></div>`;
            return;
        }

        // セクション判定
        if (text.includes('【あらすじ】')) { area = 'synopsis'; html += `<h3 class="font-bold text-lg mb-4 mt-8">【あらすじ】</h3>`; return; }
        if (text.includes('【目次】')) { area = 'toc'; html += `<h3 class="font-bold text-lg mb-4 mt-8">【目次】</h3>`; return; }
        
        const isHeader = text.length < 40 && (text.match(/^第[0-9０-９]+[話章]/) || text.match(/^タイトル/) || text.match(/^[0-9]+[話章.]/));
        if (isHeader) {
            area = 'body';
            const id = "ch-" + text.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-');
            html += `<p id="${id}" class="chapter-title">${text}</p>`;
            return;
        }

        if (area === 'toc') {
            const tid = "ch-" + text.replace(/^[・●\s]+/, '').replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-');
            html += `<p class="mb-2"><a onclick="document.getElementById('${tid}')?.scrollIntoView({behavior:'smooth', inline:'start'})" class="toc-link">${text}</a></p>`;
        } else if (area === 'synopsis') {
            html += `<p class="synopsis-text">${text}</p>`;
        } else {
            const style = text.match(/^[「『（【]/) ? 'style="text-indent: 0;"' : '';
            html += `<p class="novel-paragraph" ${style}>${text}</p>`;
        }
    });
    container.innerHTML = html;
}
/**
 * ==============================================================================
 * script.js - PART 3: WRITING LOGIC, TABS & EVENT LISTENERS
 * ==============================================================================
 */

// --- 1. 執筆画面とタブの制御 ---

function openWriter(id) {
    activeBook = books.find(b => b.id === id);
    if (!activeBook) return;

    document.getElementById('input-book-title').value = activeBook.title;
    document.getElementById('textarea-content').value = activeBook.content || "";
    
    // ジャンル選択の初期化
    const gSelect = document.getElementById('select-genre-main');
    gSelect.innerHTML = Object.keys(GENRE_DEFINITIONS).map(k => `<option value="${k}">${k}</option>`).join('');
    gSelect.value = activeBook.genre || "ファンタジー";
    updateSubGenre(gSelect.value);

    switchWriterTab('write'); // 最初に「書く」を表示
    switchView('writing');
}

function updateSubGenre(main) {
    const sSelect = document.getElementById('select-genre-sub');
    const subs = GENRE_DEFINITIONS[main] || [];
    sSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
}

// ツールが表示されない問題を修正したタブ切り替え
function switchWriterTab(tabName) {
    const tabs = ['write', 'preview', 'tools'];
    
    tabs.forEach(t => {
        const content = document.getElementById(`tab-content-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        
        if (t === tabName) {
            content.classList.remove('hidden'); // 表示
            btn.classList.add('text-indigo-600');
            btn.classList.remove('text-gray-400');
        } else {
            content.classList.add('hidden'); // 非表示
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-indigo-600');
        }
    });

    if (tabName === 'preview') {
        saveCurrentBook();
        renderVerticalText(document.getElementById('preview-vertical-text'), activeBook.content, activeBook.illustrations);
    }
}

// --- 2. AI執筆アクション ---

async function handleAIWrite(type) {
    saveCurrentBook();
    const prompt = document.getElementById('input-ai-prompt').value.trim();
    showLoading(true);
    try {
        let userPrompt = "";
        if (type === 'new') {
            userPrompt = `テーマ: ${prompt}\n以下の構成で執筆してください。\n1.【タイトル】\n2.【あらすじ】\n3.【目次】(第1〜5話)\n4.【第1話 本文】(800文字程度)`;
        } else {
            userPrompt = `続きを800文字程度で執筆してください。\n指示: ${prompt}`;
        }
        const text = await generateText(userPrompt, "あなたはプロの小説家です。本文のみ出力。");
        if (type === 'new') {
            activeBook.content = text;
            const m = text.match(/【タイトル】[:：]?\s*(.+)/);
            if (m) activeBook.title = m[1].trim();
        } else {
            activeBook.content += "\n\n" + text;
        }
        document.getElementById('textarea-content').value = activeBook.content;
        saveData();
        switchWriterTab('write');
    } catch (e) { alert(e.message); }
    finally { showLoading(false); }
}

// --- 3. 読書画面 ---

function openReader(id) {
    activeBook = books.find(b => b.id === id);
    renderVerticalText(document.getElementById('reader-content-area'), activeBook.content, activeBook.illustrations);
    switchView('reader');
}

// --- 4. 全イベントリスナーの登録 ---

function setupEventListeners() {
    const getEl = (id) => document.getElementById(id);

    // ライブラリ
    getEl('btn-new-book').onclick = () => {
        const id = generateId();
        const newBook = { id, title: "無題", content: "", genre: "ファンタジー", illustrations: [] };
        books.unshift(newBook); saveData(); openWriter(id);
    };
    getEl('btn-global-bg').onclick = async () => {
        showLoading(true);
        const b64 = await generateImage("幻想的な書庫、魔法、美しい、4k");
        if (b64) { backgroundImage = b64; localStorage.setItem('kotonoha_bg', b64); applyBackground(); }
        showLoading(false);
    };
    getEl('btn-settings').onclick = () => getEl('settings-modal').classList.remove('hidden');
    getEl('btn-close-settings').onclick = () => getEl('settings-modal').classList.add('hidden');
    getEl('input-api-key').onchange = (e) => { apiKey = e.target.value; localStorage.setItem('kotonoha_api_key', apiKey); };
    getEl('btn-reset-app').onclick = () => { if(confirm("全消去しますか？")) { localStorage.clear(); location.reload(); } };

    // 執筆ヘッダー
    getEl('btn-writer-back').onclick = () => { saveCurrentBook(); switchView('library'); renderLibrary(); };
    getEl('btn-writer-finish').onclick = () => { saveCurrentBook(); switchView('library'); renderLibrary(); };

    // 執筆タブ
    getEl('tab-btn-write').onclick = () => switchWriterTab('write');
    getEl('tab-btn-preview').onclick = () => switchWriterTab('preview');
    getEl('tab-btn-tools').onclick = () => switchWriterTab('tools');

    // 執筆ツール
    getEl('tool-subtab-ai').onclick = () => {
        getEl('tool-panel-ai').classList.remove('hidden');
        getEl('tool-panel-settings').classList.add('hidden');
    };
    getEl('tool-subtab-settings').onclick = () => {
        getEl('tool-panel-ai').classList.add('hidden');
        getEl('tool-panel-settings').classList.remove('hidden');
    };
    getEl('btn-ai-write-new').onclick = () => handleAIWrite('new');
    getEl('btn-ai-write-continue').onclick = () => handleAIWrite('continue');
    getEl('btn-show-illus-input').onclick = () => getEl('illus-input-container').classList.toggle('hidden');

    // 読書画面
    getEl('btn-reader-library').onclick = () => switchView('library');
    getEl('btn-reader-chat').onclick = () => getEl('reader-chat-overlay').classList.remove('hidden');
    getEl('btn-close-chat').onclick = () => getEl('reader-chat-overlay').classList.add('hidden');
    
    getEl('btn-close-preview').onclick = () => getEl('image-preview-modal').classList.add('hidden');
}

function showLoading(s) { document.getElementById('loading-overlay').classList.toggle('hidden', !s); }

function saveCurrentBook() {
    if (!activeBook) return;
    activeBook.title = document.getElementById('input-book-title').value;
    activeBook.content = document.getElementById('textarea-content').value;
    saveData();
}

// --- 5. 最終起動処理 ---
window.onload = () => {
    loadData();
    applyBackground();
    renderLibrary();
    setupEventListeners();
    lucide.createIcons();
    document.getElementById('input-api-key').value = apiKey;
};
