/**
 * ==============================================================================
 * script.js - PART 1: CONSTANTS & UTILITIES
 * ==============================================================================
 */

// --- 1. グローバル設定とAPI定義 ---
let apiKey = localStorage.getItem('kotonoha_api_key') || "";

// デフォルトモデル設定
const GEMINI_MODEL = "gemini-2.5-flash"; 
const IMAGEN_MODEL = "imagen-3-pro"; 

// 45種類の最新モデルレジストリ
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

// ジャンルと三題噺用ワード
const GENRE_DEFINITIONS = {
    "ファンタジー": ["王道", "異世界転生", "ダーク", "現代異能", "魔法少女", "冒険者"],
    "SF": ["スペースオペラ", "サイバーパンク", "タイムリープ", "近未来", "AI・ロボット"],
    "ミステリー": ["本格推理", "サスペンス", "ハードボイルド", "日常の謎", "刑事"],
    "恋愛": ["学園ラブコメ", "大人の恋愛", "悲恋", "幼馴染", "オフィスラブ"],
    "ホラー": ["心霊", "サイコホラー", "都市伝説", "怪談", "クトゥルフ神話"],
    "純文学": ["私小説", "青春", "家族・人間ドラマ", "歴史・時代", "哲学・思想"]
};

const RANDOM_WORDS = ["雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車"];

// --- 2. 共通ユーティリティ関数 ---

// ID生成
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 画像圧縮 (Base64 -> JPEG)
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

// PCM音声をWAVに変換
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

    const blob = new Blob([view, bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};
/**
 * ==============================================================================
 * script.js - PART 2: API WRAPPERS (TEXT, IMAGE, TTS)
 * ==============================================================================
 */

// --- 1. API基本通信 (apiCall) ---
const apiCall = async (url, payload) => {
    if (!apiKey) throw new Error("APIキーが設定されていません。設定画面から入力してください。");
    
    const response = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `APIエラー: ${response.status}`);
    }
    return response.json();
};

// --- 2. テキスト生成 (generateText) ---
const generateText = async (prompt, systemPrompt = "") => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// --- 3. 画像生成 (generateImage) - エラー修正済み完全版 ---
const generateImage = async (prompt) => {
    // 画像生成専用の設定
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ["IMAGE"],
            candidateCount: 1
        }
    };

    try {
        // 第一選択: Imagen 3 Pro (または定数で指定されたモデル)
        const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent`, payload);
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (imagePart && imagePart.inlineData) {
            return `data:image/png;base64,${imagePart.inlineData.data}`;
        }
        
        // 失敗時のバックアップ: 2.0 Flashの画像生成
        const fallbackModel = "gemini-2.0-flash-exp-image-generation";
        const fbData = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent`, payload);
        const fbPart = fbData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (fbPart && fbPart.inlineData) {
            return `data:image/png;base64,${fbPart.inlineData.data}`;
        }

        throw new Error("画像データの取得に失敗しました。");
    } catch (e) {
        console.error("Image Generation Detail Error:", e);
        throw new Error("画像生成エラー: お使いのAPIキーが画像モデルに対応していないか、プロンプトが制限に抵触しました。");
    }
};

// --- 4. 音声読み上げ生成 (generateSpeech) ---
const generateSpeech = async (text) => {
    const payload = {
        contents: [{ parts: [{ text: "以下のテキストを朗読してください:\n" + text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { 
                voiceConfig: { 
                    prebuiltVoiceConfig: { voiceName: "Kore" } 
                } 
            }
        }
    };
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    
    if (audioPart && audioPart.inlineData) {
        return audioPart.inlineData.data;
    }
    throw new Error("音声データの生成に失敗しました。");
};
/**
 * ==============================================================================
 * script.js - PART 3: STATE MANAGEMENT & LIBRARY LOGIC
 * ==============================================================================
 */

// --- 1. 状態管理変数 ---
let books = [];
let activeBookId = null;
let activeBook = null;
let currentView = 'library'; 
let backgroundImage = localStorage.getItem('kotonoha_bg') || null;
let audioPlayer = document.getElementById('audio-player');
let isPlayingTTS = false;

// 画面要素のキャッシュ
const views = {
    library: document.getElementById('view-library'),
    writing: document.getElementById('view-writing'),
    reader: document.getElementById('view-reader')
};

// --- 2. 初期化とデータ保存 ---

// アプリの起動
function init() {
    loadData();
    applyBackground();
    renderLibrary();
    setupEventListeners(); // ※Part 5で定義します
    lucide.createIcons();
    document.getElementById('input-api-key').value = apiKey;
}

// ローカルストレージから読み込み
function loadData() {
    const saved = localStorage.getItem('kotonoha_books');
    if (saved) {
        try {
            books = JSON.parse(saved);
        } catch (e) {
            console.error("データ読み込み失敗", e);
            books = [];
        }
    }
}

// ローカルストレージへ保存
function saveData() {
    localStorage.setItem('kotonoha_books', JSON.stringify(books));
}

// 背景画像の適用
function applyBackground() {
    const bg = document.getElementById('bg-layer');
    if (backgroundImage) {
        bg.style.backgroundImage = `url(${backgroundImage})`;
        bg.style.opacity = '1';
    } else {
        bg.style.backgroundImage = 'none';
    }
}

// --- 3. 画面切り替え ---

function switchView(viewName) {
    // 全ての画面を隠す
    Object.values(views).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });
    
    // 対象の画面を表示
    const target = views[viewName];
    target.classList.remove('hidden');
    if (viewName !== 'library') {
        target.classList.add('flex');
    }

    currentView = viewName;
    window.scrollTo(0, 0);
}

// --- 4. 書庫（ライブラリ）の操作 ---

// 本を一覧表示する
function renderLibrary() {
    const grid = document.getElementById('book-grid');
    const newBookBtn = document.getElementById('btn-new-book');
    grid.innerHTML = '';
    grid.appendChild(newBookBtn);

    books.forEach(book => {
        const div = document.createElement('div');
        div.className = "relative group animate-fade-in";
        div.onclick = () => openReader(book.id); // ※Part 4で定義

        // カバー画像がない場合はタイトルを縦書きで表示
        const coverHtml = book.cover 
            ? `<img src="${book.cover}" class="w-full h-full object-cover book-cover-hover">`
            : `<div class="w-full h-full bg-indigo-50 flex items-center justify-center p-4 text-center book-cover-hover">
                 <span class="font-serif text-xl text-gray-700 writing-vertical-rl">${book.title}</span>
               </div>`;

        div.innerHTML = `
            <div class="aspect-[2/3] bg-white rounded-r-lg rounded-l-sm shadow-md transition-all cursor-pointer overflow-hidden border-l-4 border-l-gray-800 relative active:scale-95">
                ${coverHtml}
                <div class="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-white text-[10px] truncate">
                    ${book.title}
                </div>
            </div>
        `;
        grid.appendChild(div);
    });
    lucide.createIcons();
}

// 新しい本を作成する
function createNewBook(title = "無題の物語", content = "", genre = "ファンタジー") {
    const newBook = {
        id: generateId(),
        title: title,
        content: content,
        genre: genre,
        cover: null,
        illustrations: [],
        synopsis: "",
        updatedAt: Date.now()
    };
    books.unshift(newBook);
    saveData();
    openWriter(newBook.id); // ※Part 4で定義
}
/**
 * ==============================================================================
 * script.js - PART 4: WRITER & READER LOGIC
 * ==============================================================================
 */

// --- 1. 執筆画面 (Writer) の制御 ---

function openWriter(id) {
    activeBookId = id;
    activeBook = books.find(b => b.id === id);
    if (!activeBook) return;

    document.getElementById('input-book-title').value = activeBook.title;
    document.getElementById('textarea-content').value = activeBook.content || "";
    document.getElementById('input-roadmap').value = activeBook.roadmap || "";
    
    // ジャンル選択の初期化
    const gSelect = document.getElementById('select-genre-main');
    gSelect.innerHTML = Object.keys(GENRE_DEFINITIONS).map(k => `<option value="${k}">${k}</option>`).join('');
    gSelect.value = activeBook.genre || "ファンタジー";
    updateSubGenre(gSelect.value);

    switchWriterTab('write');
    switchView('writing');
}

function saveCurrentBook() {
    if (!activeBook) return;
    activeBook.title = document.getElementById('input-book-title').value;
    activeBook.content = document.getElementById('textarea-content').value;
    activeBook.roadmap = document.getElementById('input-roadmap').value;
    activeBook.updatedAt = Date.now();
    saveData();
}

function switchWriterTab(tab) {
    ['write', 'preview', 'tools'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        if (t === tab) {
            content.classList.remove('hidden');
            btn.classList.replace('text-gray-400', 'text-indigo-600');
        } else {
            content.classList.add('hidden');
            btn.classList.replace('text-indigo-600', 'text-gray-400');
        }
    });

    if (tab === 'preview') {
        saveCurrentBook();
        renderVerticalText(document.getElementById('preview-vertical-text'), activeBook.content, activeBook.illustrations);
    }
}

function updateSubGenre(main) {
    const sSelect = document.getElementById('select-genre-sub');
    const subs = GENRE_DEFINITIONS[main] || [];
    sSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
}

// AI執筆実行
async function handleAIWrite(type) {
    saveCurrentBook();
    const prompt = document.getElementById('input-ai-prompt').value.trim();
    const target = parseInt(document.getElementById('select-pages').value);
    showLoading(true);
    try {
        let system = `あなたはプロの作家です。余計な挨拶はせず、小説の本文のみ出力してください。`;
        let user = "";
        
        if (type === 'new') {
            user = `テーマ: ${prompt}\n以下の構成で物語の冒頭を執筆してください。\n1.【タイトル】\n2.【あらすじ】\n3.【目次】（第1話〜第5話の予定を「・第1話 タイトル」形式で）\n4.【第1話 本文】（約${target}文字）`;
        } else {
            user = `前回の続きから書いてください。設計図: ${activeBook.roadmap}\n本文のみ出力。約${target}文字。`;
        }

        const text = await generateText(user, system);
        if (type === 'new') {
            const m = text.match(/【タイトル】[:：]?\s*(.+)/);
            if (m) {
                activeBook.title = m[1].trim();
                document.getElementById('input-book-title').value = activeBook.title;
            }
            activeBook.content = text;
        } else {
            activeBook.content += "\n\n" + text;
        }
        document.getElementById('textarea-content').value = activeBook.content;
        saveData();
        switchWriterTab('write');
    } catch (e) { alert(e.message); }
    finally { showLoading(false); }
}

// --- 2. 読書画面 (Reader) の制御 ---

function openReader(id) {
    activeBookId = id;
    activeBook = books.find(b => b.id === id);
    if (!activeBook) return;

    renderVerticalText(document.getElementById('reader-content-area'), activeBook.content, activeBook.illustrations);
    switchView('reader');
}

// 縦書き描画エンジン（段落・あらすじ・目次リンク判別）
function renderVerticalText(container, content, illustrations) {
    if (!content) { container.innerHTML = '<p class="p-4 text-gray-400">白紙です</p>'; return; }
    container.innerHTML = '';
    const lines = content.split('\n');
    let html = '';
    let area = 'body'; // body, toc, synopsis

    lines.forEach(line => {
        const text = line.trim();
        // 空行の処理
        if (!text) { html += '<div style="height:100%; width:1.5em; min-width:1.5em;"></div>'; return; }

        // 特殊タグ（挿絵）の処理
        const imgMatch = text.match(/\[挿絵:(.+?)\]/);
        if (imgMatch) {
            const imgId = imgMatch[1];
            const imgData = illustrations?.find(img => img.id === imgId);
            if (imgData) html += `<div class="vertical-image-container"><img src="${imgData.data}"></div>`;
            return;
        }

        // セクション判定
        if (text.includes('【あらすじ】')) { area = 'synopsis'; html += `<h3 class="font-bold text-lg mb-4 mt-8">【あらすじ】</h3>`; return; }
        if (text.includes('【目次】')) { area = 'toc'; html += `<h3 class="font-bold text-lg mb-4 mt-8">【目次】</h3>`; return; }
        
        // 章タイトル判定
        const isHeader = text.length < 40 && (text.match(/^第[0-9０-９]+[話章]/) || text.match(/^タイトル/) || text.match(/^[0-9]+[話章.]/));
        if (isHeader) {
            area = 'body';
            const id = "ch-" + text.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-');
            html += `<p id="${id}" class="chapter-title">${text}</p>`;
            return;
        }

        // エリアごとの描画分け
        if (area === 'toc') {
            const tid = "ch-" + text.replace(/^[・●\s]+/, '').replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-');
            html += `<p class="mb-2"><a onclick="document.getElementById('${tid}')?.scrollIntoView({behavior:'smooth', inline:'start'})" class="toc-link">${text}</a></p>`;
        } else if (area === 'synopsis') {
            html += `<p class="synopsis-text">${text}</p>`;
        } else {
            // 本文：会話文以外を1文字下げる
            const style = text.match(/^[「『（【]/) ? 'style="text-indent: 0;"' : '';
            html += `<p class="novel-paragraph" ${style}>${text}</p>`;
        }
    });
    container.innerHTML = html;
}
/**
 * ==============================================================================
 * script.js - PART 5: EVENT LISTENERS, TTS, CHAT & INITIALIZATION
 * ==============================================================================
 */

// --- 1. 音声読み上げ (TTS) 制御 ---
async function handleTTS() {
    if (isPlayingTTS) {
        audioPlayer.pause();
        isPlayingTTS = false;
        document.getElementById('btn-reader-tts').classList.remove('text-indigo-600');
        return;
    }

    showLoading(true);
    try {
        // 本文から特殊タグを除去して読み上げ
        const cleanText = activeBook.content.replace(/\[挿絵:.+?\]/g, "").slice(0, 2000);
        const wavUrl = pcmToWav(await generateSpeech(cleanText));
        
        audioPlayer.src = wavUrl;
        audioPlayer.play();
        isPlayingTTS = true;
        document.getElementById('btn-reader-tts').classList.add('text-indigo-600');
        
        audioPlayer.onended = () => {
            isPlayingTTS = false;
            document.getElementById('btn-reader-tts').classList.remove('text-indigo-600');
        };
    } catch (e) { alert(e.message); }
    finally { showLoading(false); }
}

// --- 2. 読者チャット (Chat) 制御 ---
async function handleChatSend() {
    const input = document.getElementById('input-chat-message');
    const text = input.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    input.value = '';

    try {
        const context = `あなたは作品「${activeBook.title}」の作者です。読者の感想に答えてください。`;
        const response = await generateText(text, context);
        appendChatMessage('model', response);
    } catch (e) { alert("チャットエラー: " + e.message); }
}

function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `p-2 rounded max-w-[80%] ${role === 'user' ? 'bg-indigo-100 ml-auto' : 'bg-gray-100'}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// --- 3. UIヘルパー ---
function showLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

function showImagePreview(src) {
    document.getElementById('preview-modal-img').src = src;
    document.getElementById('image-preview-modal').classList.remove('hidden');
}

// --- 4. 全てのイベントリスナーの登録 ---
function setupEventListeners() {
    const getEl = (id) => document.getElementById(id);

    // ライブラリ画面
    getEl('btn-new-book').onclick = () => createNewBook();
    getEl('btn-three-words').onclick = () => {
        const shuffled = [...RANDOM_WORDS].sort(() => 0.5 - Math.random()).slice(0, 3);
        if (confirm(`お題: 「${shuffled.join('」「')}」\nこのお題で物語を書きますか？`)) {
            createNewBook("三題噺の物語", `お題: ${shuffled.join('、')}\n\n`, "三題噺");
        }
    };
    getEl('btn-global-bg').onclick = async () => {
        showLoading(true);
        try {
            const b64 = await generateImage("A cozy, warm magical library, detailed anime style, 4k");
            backgroundImage = await compressImage(b64, 800, 0.6);
            localStorage.setItem('kotonoha_bg', backgroundImage);
            applyBackground();
        } catch(e) { alert(e.message); } finally { showLoading(false); }
    };
    getEl('btn-settings').onclick = () => getEl('settings-modal').classList.remove('hidden');
    getEl('btn-close-settings').onclick = () => getEl('settings-modal').classList.add('hidden');
    getEl('input-api-key').onchange = (e) => {
        apiKey = e.target.value;
        localStorage.setItem('kotonoha_api_key', apiKey);
    };
    getEl('btn-reset-app').onclick = () => {
        if(confirm("全データを消去して初期化しますか？")) { localStorage.clear(); location.reload(); }
    };

    // 執筆画面
    getEl('btn-writer-back').onclick = () => { saveCurrentBook(); switchView('library'); renderLibrary(); };
    getEl('btn-writer-finish').onclick = () => { saveCurrentBook(); switchView('library'); renderLibrary(); };
    getEl('btn-open-toc').onclick = () => alert("構成案:\n" + (activeBook.roadmap || "まだありません"));
    getEl('tab-btn-write').onclick = () => switchWriterTab('write');
    getEl('tab-btn-preview').onclick = () => switchWriterTab('preview');
    getEl('tab-btn-tools').onclick = () => switchWriterTab('tools');

    // AIツール
    getEl('btn-ai-write-new').onclick = () => handleAIWrite('new');
    getEl('btn-ai-write-continue').onclick = () => handleAIWrite('continue');
    getEl('btn-gen-cover').onclick = async () => {
        showLoading(true);
        try {
            const b64 = await generateImage(`Book cover for ${activeBook.title}, elegant fantasy style`);
            activeBook.cover = await compressImage(b64, 400, 0.7);
            saveData(); renderLibrary();
        } catch(e) { alert(e.message); } finally { showLoading(false); }
    };
    getEl('btn-show-illus-input').onclick = () => getEl('illus-input-container').classList.toggle('hidden');
    getEl('btn-gen-illus').onclick = async () => {
        const prompt = getEl('input-illus-prompt').value;
        showLoading(true);
        try {
            const b64 = await generateImage(prompt);
            const imgId = generateId();
            activeBook.illustrations.push({ id: imgId, data: b64 });
            activeBook.content += `\n\n[挿絵:${imgId}]\n\n`;
            getEl('textarea-content').value = activeBook.content;
            saveData();
        } catch(e) { alert(e.message); } finally { showLoading(false); }
    };

    // 読書画面
    getEl('btn-reader-library').onclick = () => { audioPlayer.pause(); switchView('library'); renderLibrary(); };
    getEl('btn-reader-tts').onclick = handleTTS;
    getEl('btn-reader-chat').onclick = () => getEl('reader-chat-overlay').classList.remove('hidden');
    getEl('btn-close-chat').onclick = () => getEl('reader-chat-overlay').classList.add('hidden');
    getEl('btn-send-chat').onclick = handleChatSend;
    getEl('btn-close-preview').onclick = () => getEl('image-preview-modal').classList.add('hidden');
}

// --- 5. 最終起動処理 ---
window.addEventListener('DOMContentLoaded', init);
