/**
 * ==============================================================================
 * script.js - PART 1: GLOBAL CONSTANTS & MODEL REGISTRY
 * ==============================================================================
 */

// --- 1. グローバル設定 ---
// APIキーはローカルストレージから取得。初回は空。
let apiKey = localStorage.getItem('kotonoha_api_key') || "";

// デフォルトで使用するモデル（2026年時点の推奨）
const GEMINI_MODEL = "gemini-2.5-flash"; 
const IMAGEN_MODEL = "imagen-3-pro"; 
const TTS_MODEL    = "gemini-2.5-flash-preview-tts"; 

/**
 * 45種類の最新モデルレジストリ
 * 設定画面などで切り替え可能な全リストを網羅
 */
const MODEL_REGISTRY = {
    // 安定版・推奨 (Stable)
    stable: [
        "gemini-3.0-flash", "gemini-3.0-pro", "gemini-2.5-flash", "gemini-2.5-pro",
        "gemini-2.0-flash-001", "gemini-2.0-flash-lite-001", "gemini-2.5-flash-lite",
        "gemini-1.5-pro", "gemini-1.5-flash", "gemini-flash-latest", "gemini-pro-latest", "gemini-ultra-latest"
    ],
    // 特殊機能 (Visual / Audio / Video)
    specialized: [
        "imagen-3-pro", "imagen-3-fast", "gemini-2.5-flash-image", "gemini-2.5-pro-image",
        "gemini-2.0-flash-exp-image-generation", "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts", "veo-1.0-video-generation", "gemini-3-pro-vision", "nano-banana-pro-preview"
    ],
    // 実験的・プレビュー (Preview / Exp)
    preview: [
        "gemini-3-flash-preview", "gemini-3-pro-preview", "gemini-3-ultra-preview",
        "gemini-2.5-flash-preview-09-2025", "gemini-2.5-flash-lite-preview-09-2025",
        "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-exp-1206",
        "gemini-2.5-computer-use-preview-10-2025", "deep-research-pro-preview-12-2025",
        "gemini-robotics-er-1.5-preview", "gemini-3-med-pro", "gemini-3-code-pro",
        "gemini-3-law-pro", "gemini-3-finance-pro"
    ],
    // 軽量・オープン (Gemma)
    gemma: [
        "gemma-3-1b-it", "gemma-3-4b-it", "gemma-3-12b-it", "gemma-3-27b-it",
        "gemma-3n-e4b-it", "gemma-3n-e2b-it", "gemma-2-27b", "gemma-2-9b"
    ]
};

// --- 2. 物語の素材データ ---

const GENRE_DEFINITIONS = {
    "ファンタジー": ["王道", "異世界転生", "ダーク", "現代異能", "魔法少女", "冒険", "和風"],
    "SF": ["スペースオペラ", "サイバーパンク", "タイムリープ", "近未来", "ディストピア"],
    "ミステリー": ["本格推理", "サスペンス", "ハードボイルド", "日常の謎", "特殊設定"],
    "恋愛": ["学園ラブコメ", "大人の恋愛", "悲恋", "幼馴染", "オフィスラブ"],
    "ホラー": ["心霊", "サイコ", "怪談", "クトゥルフ", "デスゲーム"],
    "純文学": ["私小説", "青春", "人間ドラマ", "幻想文学", "哲学・思想"],
    "歴史・時代": ["戦国・幕末", "騎士道", "三国志", "架空戦記"],
    "詩歌・エッセイ": ["現代詩", "短歌・俳句", "随筆", "日記"]
};

const RANDOM_WORDS = [
    "雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車",
    "図書館", "鍵", "ピアノ", "星空", "迷子", "珈琲", "古書店", "鏡", "青", "記憶"
];
/**
 * ==============================================================================
 * script.js - PART 2: UTILITY FUNCTIONS
 * ==============================================================================
 */

// --- 1. ID生成 (一意のキーを作成) ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- 2. 画像圧縮 (ストレージ容量を節約するためにBase64をJPEG圧縮) ---
const compressImage = (base64Str, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scaleSize = maxWidth / img.width;
            if (img.width > maxWidth) {
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
            } else {
                canvas.width = img.width;
                canvas.height = img.height;
            }
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str);
    });
};

// --- 3. 音声変換 (Geminiから届くPCMデータを再生可能なWAV形式に変換) ---
const pcmToWav = (base64PCM) => {
    const binaryString = window.atob(base64PCM);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (v, offset, str) => {
        for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, 24000, true); // Sample Rate
    view.setUint32(28, 48000, true); // Byte Rate
    view.setUint16(32, 2, true); // Block Align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, len, true);

    return URL.createObjectURL(new Blob([view, bytes], { type: 'audio/wav' }));
};

// --- 4. 名文カード生成 (Canvasを使用した縦書き画像合成) ---
const createQuoteCard = (text, title, author, backgroundSrc) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        
        const bg = new Image();
        bg.crossOrigin = "Anonymous";
        bg.src = backgroundSrc || ""; 
        
        const draw = () => {
            // 背景の描画
            if (!backgroundSrc) {
                ctx.fillStyle = "#fdfbf7";
                ctx.fillRect(0, 0, 1200, 1200);
            } else {
                const scale = Math.max(1200 / bg.width, 1200 / bg.height);
                const x = (1200 / 2) - (bg.width / 2) * scale;
                const y = (1200 / 2) - (bg.height / 2) * scale;
                ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
                ctx.fillStyle = "rgba(0,0,0,0.4)"; // 文字を見やすくするために暗くする
                ctx.fillRect(0, 0, 1200, 1200);
            }

            // 装飾枠
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.lineWidth = 8;
            ctx.strokeRect(60, 60, 1080, 1080);

            // テキスト設定 (縦書きシミュレーション)
            ctx.fillStyle = "#ffffff";
            ctx.textBaseline = "top";
            const fontSize = 54;
            ctx.font = `bold ${fontSize}px 'Shippori Mincho', serif`;
            
            let x = 1000;
            let y = 140;
            const lineHeight = 80;

            for (let char of text) {
                if (x < 200) break; // 枠をはみ出す場合は終了
                
                // 句読点の位置微調整
                let adjX = 0, adjY = 0;
                if (['、', '。'].includes(char)) { adjX = fontSize * 0.6; adjY = -fontSize * 0.4; }

                ctx.fillText(char, x + adjX, y + adjY);
                y += fontSize * 1.2;

                if (y > 900 || char === '\n') {
                    y = 140;
                    x -= lineHeight;
                }
            }

            // 作品情報
            ctx.font = `34px 'Shippori Mincho', serif`;
            ctx.fillText(`『${title}』`, 120, 1000);
            ctx.fillText(`${author || "私"} 著`, 120, 1060);

            resolve(canvas.toDataURL('image/png'));
        };

        if (backgroundSrc) {
            bg.onload = draw;
            bg.onerror = () => { backgroundSrc = null; draw(); };
        } else {
            draw();
        }
    });
};
/**
 * ==============================================================================
 * script.js - PART 3: API COMMUNICATION WRAPPERS
 * ==============================================================================
 */

// --- 1. API基本通信 (Fetch Wrapper) ---
// すべてのAPIリクエストの基盤となる共通関数です
const apiCall = async (url, payload) => {
    if (!apiKey) {
        showError("APIキーが未設定です。設定（右上）から入力してください。");
        throw new Error("APIキー未設定");
    }
    
    try {
        const response = await fetch(`${url}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error?.message || `通信エラー: ${response.status}`;
            throw new Error(msg);
        }
        return response.json();
    } catch (error) {
        console.error("API通信に失敗:", error);
        throw error;
    }
};

// --- 2. テキスト生成 (Gemini) ---
// 物語の執筆やチャットに使用します
const generateText = async (prompt, systemPrompt = "") => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };
    
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// --- 3. 画像生成 (Imagen 3 / Fallback) ---
// 表紙や挿絵の生成に使用します
const generateImage = async (prompt) => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ["IMAGE"],
            candidateCount: 1
        }
    };

    try {
        // メインモデル (Imagen 3) での試行
        const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:generateContent`, payload);
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);
        
        if (imagePart && imagePart.inlineData) {
            return `data:image/png;base64,${imagePart.inlineData.data}`;
        }
        
        // 失敗時のバックアップ (2.0 Flashの画像生成機能を試行)
        const fallbackModel = "gemini-2.0-flash-exp-image-generation";
        const fallbackData = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent`, payload);
        const fbPart = fallbackData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return fbPart ? `data:image/png;base64,${fbPart.inlineData.data}` : null;

    } catch (e) {
        console.error("画像生成エラー詳細:", e);
        throw new Error("画像生成に失敗しました。APIの有効期限や権限を確認してください。");
    }
};

// --- 4. 音声合成 (TTS) ---
// 小説の朗読機能に使用します
const generateSpeech = async (text, voiceName = "Kore") => {
    const payload = {
        contents: [{ parts: [{ text: "以下のテキストを朗読してください:\n" + text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
    };
    
    const data = await apiCall(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, payload);
    const parts = data.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData);
    
    if (audioPart && audioPart.inlineData) {
        return audioPart.inlineData.data;
    }
    throw new Error("音声データの生成に失敗しました。モデルが非対応の可能性があります。");
};
/**
 * ==============================================================================
 * script.js - PART 4: STATE MANAGEMENT & DATA PERSISTENCE
 * ==============================================================================
 */

// --- 1. アプリの状態管理 (Global State) ---
let books = [];             // 全物語のリスト
let activeBookId = null;    // 現在開いている物語のID
let activeBook = null;      // 現在開いている物語のオブジェクト参照
let currentView = 'library'; // 現在の表示画面 (library, writing, reader)
let backgroundImage = localStorage.getItem('kotonoha_bg') || null;

// --- 2. DOM要素のキャッシュ (高速化のため) ---
const views = {
    library: document.getElementById('view-library'),
    writing: document.getElementById('view-writing'),
    reader: document.getElementById('view-reader')
};

// --- 3. データの読み込み・保存ロジック ---

// ローカルストレージからデータを復元
function loadData() {
    const savedBooks = localStorage.getItem('kotonoha_books');
    if (savedBooks) {
        try {
            // データの整合性を保つため、足りないプロパティを補完しながら読み込む
            books = JSON.parse(savedBooks).map(b => ({
                ...b,
                characters: b.characters || [],
                worldSettings: b.worldSettings || "",
                illustrations: b.illustrations || [],
                genre: b.genre || "未設定",
                synopsis: b.synopsis || "",
                chatHistory: b.chatHistory || [],
                totalChapters: b.totalChapters || 0,
                currentChapter: b.currentChapter || 0
            }));
        } catch (e) {
            console.error("データの読み込みに失敗しました:", e);
            books = [];
        }
    }
}

// 現在の全データをローカルストレージに保存
function saveData() {
    localStorage.setItem('kotonoha_books', JSON.stringify(books));
}

// アプリ全体の背景を適用
function applyBackground() {
    const bgLayer = document.getElementById('bg-layer');
    if (backgroundImage) {
        bgLayer.style.backgroundImage = `url(${backgroundImage})`;
        bgLayer.style.opacity = '1';
    } else {
        bgLayer.style.backgroundImage = 'none';
    }
}

// --- 4. 画面切り替えエンジン (View Controller) ---

function switchView(viewName) {
    // すべての画面を一度隠す
    Object.keys(views).forEach(key => {
        views[key].classList.add('hidden');
        views[key].classList.remove('flex'); // Flexbox設定を一旦リセット
    });
    
    // 指定された画面を表示
    const target = views[viewName];
    if (!target) return;

    target.classList.remove('hidden');
    
    // 執筆画面と読書画面はレイアウト維持のためFlexを適用
    if (viewName === 'writing' || viewName === 'reader') {
        target.classList.add('flex');
    }

    currentView = viewName;
    
    // 画面移動時に最上部へスクロール
    window.scrollTo(0, 0);
    
    // アイコンの再描画（Lucideアイコンを確実に表示させるため）
    if (window.lucide) {
        lucide.createIcons();
    }
}
/**
 * ==============================================================================
 * script.js - PART 5: LIBRARY RENDERING & BOOK CREATION
 * ==============================================================================
 */

// --- 1. ライブラリ（本棚）の描画 ---
// 保存されている物語をグリッド状に並べます
function renderLibrary() {
    const grid = document.getElementById('book-grid');
    if (!grid) return;

    // 「新しい物語を紡ぐ」ボタン（最初の要素）だけを残してリセット
    const newBookBtn = document.getElementById('btn-new-book');
    grid.innerHTML = '';
    grid.appendChild(newBookBtn);

    // 日付が新しい順に並び替え
    const sortedBooks = [...books].sort((a, b) => b.updatedAt - a.updatedAt);

    sortedBooks.forEach(book => {
        const div = document.createElement('div');
        div.className = "relative group animate-fade-in";
        
        // 本をクリックした時の動作（読書画面へ）
        div.onclick = () => openReader(book.id);

        // 表紙がある場合は画像、ない場合はタイトルのみの装丁
        let coverHtml;
        if (book.cover) {
            coverHtml = `<img src="${book.cover}" alt="${book.title}" class="w-full h-full object-cover book-cover-hover rounded-r-lg rounded-l-sm">`;
        } else {
            coverHtml = `
                <div class="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4 text-center book-cover-hover rounded-r-lg rounded-l-sm border-l-4 border-l-gray-800">
                  <span class="font-serif text-lg text-gray-700 writing-vertical-rl tracking-widest">${book.title}</span>
                </div>`;
        }

        div.innerHTML = `
            <div class="aspect-[2/3] bg-white rounded-r-lg rounded-l-sm shadow-md transition-all cursor-pointer overflow-hidden relative active:scale-95">
                ${coverHtml}
                <div class="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-white backdrop-blur-sm">
                    <h3 class="font-bold text-[10px] md:text-xs truncate">${book.title}</h3>
                    <div class="text-[8px] md:text-[10px] opacity-80">${book.genre?.split('・')[0] || "未設定"}</div>
                </div>
            </div>
        `;
        grid.appendChild(div);
    });

    // Lucideアイコンを適用
    if (window.lucide) lucide.createIcons();
}

// --- 2. 新しい物語の初期化 ---
// 空の物語オブジェクトを作成し、執筆画面を開きます
function createNewBook(title = "無題の物語", initialContent = "", genre = "ファンタジー") {
    const newBook = {
        id: generateId(),
        title: title,
        content: initialContent,
        genre: genre,
        cover: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        chatHistory: [],
        characters: [],
        worldSettings: "",
        illustrations: [],
        synopsis: "",
        totalChapters: 0,
        currentChapter: 0
    };
    
    // リストの先頭に追加
    books.unshift(newBook);
    saveData();
    
    // 執筆画面へ
    openWriter(newBook.id);
}
/**
 * ==============================================================================
 * script.js - PART 6: WRITER EDITOR & TAB CONTROL
 * ==============================================================================
 */

// --- 1. 執筆画面を開く (Editor Initialization) ---
function openWriter(bookId) {
    activeBookId = bookId;
    activeBook = books.find(b => b.id === bookId);
    if (!activeBook) return;

    // UI要素にデータを流し込む
    document.getElementById('input-book-title').value = activeBook.title;
    document.getElementById('textarea-content').value = activeBook.content || "";
    document.getElementById('input-world-settings').value = activeBook.worldSettings || "";
    document.getElementById('input-synopsis').value = activeBook.synopsis || "";
    document.getElementById('input-roadmap').value = activeBook.worldSettings || ""; // 構成案

    // ジャンル選択の初期化
    const genreSelect = document.getElementById('select-genre-main');
    genreSelect.innerHTML = Object.keys(GENRE_DEFINITIONS).map(g => 
        `<option value="${g}">${g}</option>`
    ).join('');
    
    // 現在のジャンルを復元（なければファンタジー）
    const currentGenreKey = Object.keys(GENRE_DEFINITIONS).find(k => 
        activeBook.genre && activeBook.genre.includes(k)
    ) || "ファンタジー";
    
    genreSelect.value = currentGenreKey;
    updateSubGenre(currentGenreKey);

    // 各種サブコンポーネントの描画
    renderCharactersList();
    renderVisualGallery();
    updateContinueButton();

    // デフォルトで「書く」タブを表示
    switchWriterTab('write');
    switchView('writing');
}

// --- 2. データの同期 (UI -> Data Object) ---
function saveCurrentBook() {
    if (!activeBook) return;
    activeBook.title = document.getElementById('input-book-title').value;
    activeBook.content = document.getElementById('textarea-content').value;
    activeBook.worldSettings = document.getElementById('input-world-settings').value;
    activeBook.synopsis = document.getElementById('input-synopsis').value;
    activeBook.updatedAt = Date.now();
    saveData();
}

// --- 3. タブ切り替えロジック (The Fix for "Tools Not Displaying") ---
function switchWriterTab(tabName) {
    const tabs = ['write', 'preview', 'tools'];
    
    tabs.forEach(t => {
        const contentArea = document.getElementById(`tab-content-${t}`);
        const navBtn = document.getElementById(`tab-btn-${t}`);
        
        if (t === tabName) {
            // 対象のタブを表示
            contentArea.classList.remove('hidden');
            if (t === 'write') contentArea.classList.add('flex'); // エディタはFlex
            
            // ボタンをアクティブ色に
            navBtn.classList.add('text-indigo-600');
            navBtn.classList.remove('text-gray-400');
        } else {
            // 他のタブを隠す
            contentArea.classList.add('hidden');
            contentArea.classList.remove('flex');
            
            // ボタンを非アクティブ色に
            navBtn.classList.remove('text-indigo-600');
            navBtn.classList.add('text-gray-400');
        }
    });

    // プレビュータブに切り替えた時は、最新の本文を縦書き描画する
    if (tabName === 'preview') {
        saveCurrentBook();
        const previewArea = document.getElementById('preview-vertical-text');
        renderVerticalText(previewArea, activeBook.content, activeBook.illustrations);
    }
    
    // ツールタブに切り替えた時は、最新のリスト情報を更新する
    if (tabName === 'tools') {
        renderCharactersList();
        renderVisualGallery();
    }
}

// --- 4. ジャンル選択の連動 ---
function updateSubGenre(mainGenre) {
    const subSelect = document.getElementById('select-genre-sub');
    const subs = GENRE_DEFINITIONS[mainGenre] || [];
    subSelect.innerHTML = '<option value="">（詳細なし）</option>' + 
        subs.map(s => `<option value="${s}">${s}</option>`).join('');
    
    // 物語オブジェクトのジャンルを更新
    if (activeBook) {
        activeBook.genre = mainGenre;
        saveData();
    }
}
/**
 * ==============================================================================
 * script.js - PART 7: TOOL PANEL RENDERING (Characters & Visuals)
 * ==============================================================================
 */

// --- 1. 登場人物リストの描画 ---
// 保存されたキャラクター情報を入力欄として一覧表示します
function renderCharactersList() {
    const container = document.getElementById('characters-list');
    if (!container || !activeBook) return;

    container.innerHTML = '';
    
    if (activeBook.characters.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-gray-400 text-center py-2">人物が定義されていません</p>';
    }

    activeBook.characters.forEach((char, index) => {
        const div = document.createElement('div');
        div.className = "flex gap-2 mb-2 animate-fade-in";
        div.innerHTML = `
            <input type="text" class="w-1/3 p-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none" 
                placeholder="名前" value="${char.name || ''}" 
                onchange="updateCharacter(${index}, 'name', this.value)">
            <input type="text" class="flex-1 p-2 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white outline-none" 
                placeholder="役割・特徴" value="${char.desc || ''}" 
                onchange="updateCharacter(${index}, 'desc', this.value)">
            <button onclick="removeCharacter(${index})" class="text-gray-300 hover:text-red-500 transition-colors px-1">
                <i data-lucide="x-circle" class="w-4 h-4"></i>
            </button>
        `;
        container.appendChild(div);
    });
    
    if (window.lucide) lucide.createIcons();
}

// キャラクター情報の更新
window.updateCharacter = (index, field, value) => {
    if (activeBook && activeBook.characters[index]) {
        activeBook.characters[index][field] = value;
        saveData();
    }
};

// キャラクターの削除
window.removeCharacter = (index) => {
    if (activeBook && confirm("この人物設定を削除しますか？")) {
        activeBook.characters.splice(index, 1);
        saveData();
        renderCharactersList();
    }
};

// --- 2. ビジュアルギャラリーの描画 ---
// 表紙と生成された挿絵をグリッドで表示します
function renderVisualGallery() {
    const grid = document.getElementById('visual-gallery-grid');
    if (!grid || !activeBook) return;

    grid.innerHTML = '';
    
    // A. 表紙の表示
    if (activeBook.cover) {
        const coverDiv = document.createElement('div');
        coverDiv.className = "aspect-[2/3] relative cursor-pointer group border border-gray-200 rounded-lg overflow-hidden shadow-sm active:scale-95 transition-transform";
        coverDiv.onclick = () => showImagePreview(activeBook.cover);
        coverDiv.innerHTML = `
            <img src="${activeBook.cover}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <i data-lucide="maximize-2" class="text-white w-5 h-5"></i>
            </div>
            <span class="absolute bottom-0 left-0 bg-indigo-600 text-white text-[8px] px-1 font-bold">表紙</span>
        `;
        grid.appendChild(coverDiv);
    }

    // B. 挿絵（イラスト）の表示
    activeBook.illustrations.forEach((img, idx) => {
        const imgDiv = document.createElement('div');
        imgDiv.className = "aspect-square relative cursor-pointer group border border-gray-200 rounded-lg overflow-hidden shadow-sm active:scale-95 transition-transform";
        imgDiv.onclick = () => showImagePreview(img.data);
        imgDiv.innerHTML = `
            <img src="${img.data}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <i data-lucide="maximize-2" class="text-white w-4 h-4"></i>
            </div>
            <button onclick="event.stopPropagation(); removeIllustration(${idx})" class="absolute top-0 right-0 p-1 bg-black/20 text-white hover:bg-red-500 transition-colors">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
        `;
        grid.appendChild(imgDiv);
    });

    if (window.lucide) lucide.createIcons();
}

// 挿絵の削除
window.removeIllustration = (index) => {
    if (activeBook && confirm("この画像を削除しますか？（本文内の挿絵タグは手動で消してください）")) {
        activeBook.illustrations.splice(index, 1);
        saveData();
        renderVisualGallery();
    }
};
/**
 * ==============================================================================
 * script.js - PART 8: AI WRITING ENGINE (Core Logic)
 * ==============================================================================
 */

// --- 1. AI執筆のメイン処理 ---
async function handleAIWrite(type) {
    saveCurrentBook(); // 現在の状態を保存
    
    const promptInput = document.getElementById('input-ai-prompt').value.trim();
    const targetLength = parseInt(document.getElementById('select-pages').value) || 800;
    const roadmapInput = document.getElementById('input-roadmap').value.trim();
    const scale = document.getElementById('select-scale').value;
    
    // 章の進行状況を初期化（未設定の場合）
    if (activeBook.currentChapter === undefined) activeBook.currentChapter = 0;
    
    showLoading(true);

    try {
        let systemPrompt = `あなたはプロの小説家です。
【重要ルール】
1. 本文のみを出力してください。「はい、書きます」等の挨拶や解説は一切不要です。
2. 読者の心に響く、情景描写豊かな文章を心がけてください。`;
        
        let userPrompt = "";

        // --- A. 新規執筆 (物語のプロットと第1話を作成) ---
        if (type === 'new') {
            // スケールに合わせて目標話数を決定
            let min = 30, max = 60;
            if (scale === 'short') { min = 15; max = 25; }
            if (scale === 'epic') { min = 80; max = 120; }
            const total = Math.floor(Math.random() * (max - min + 1)) + min;
            
            activeBook.totalChapters = total; 
            activeBook.currentChapter = 1;

            // 1. まず構成案（設計図）を作成させる
            const roadmapPrompt = `テーマ: ${promptInput || "王道の物語"}\nジャンル: ${activeBook.genre}\n全${total}話分の物語のリスト（各話の短いあらすじ）を作成してください。`;
            const roadmap = await generateText(roadmapPrompt, "全話の構成案のみを箇条書きで出力してください。");
            
            // 設計図を保存してUIに反映
            document.getElementById('input-roadmap').value = roadmap;
            activeBook.worldSettings = roadmap;

            // 2. 本文執筆のプロンプト
            userPrompt = `テーマ: ${promptInput}\n
以下の形式で出力してください。
1. 【タイトル】（一行目に書く）
2. 【あらすじ】（200文字程度）
3. 【第1話 本文】（約${targetLength}文字。物語の始まりをドラマチックに）

設計図:\n${roadmap}`;
        } 
        
        // --- B. 続きを書く ---
        else {
            activeBook.currentChapter++;
            const remaining = activeBook.totalChapters - activeBook.currentChapter;
            
            systemPrompt += `\n現在の進行: 全${activeBook.totalChapters}話中の第${activeBook.currentChapter}話。\n【全体の設計図】\n${roadmapInput}`;
            
            if (remaining <= 0) {
                systemPrompt += "\n【重要】これが最終話です。物語を完結させてください。";
            }
            
            userPrompt = `前話までの続きとして、設計図に基づいた「第${activeBook.currentChapter}話」を約${targetLength}文字で執筆してください。\n指示: ${promptInput}`;
        }

        // Gemini APIを呼び出し
        const generatedText = await generateText(userPrompt, systemPrompt);
        
        if (type === 'new') {
            // タイトルを抽出して反映
            const titleMatch = generatedText.match(/【?タイトル】?[:：]?\s*(.+)/);
            if (titleMatch) {
                activeBook.title = titleMatch[1].trim();
                document.getElementById('input-book-title').value = activeBook.title;
            }
            activeBook.content = generatedText;
        } else {
            // 本文の末尾に追加
            activeBook.content += "\n\n" + generatedText;
        }
        
        // UIの更新
        document.getElementById('textarea-content').value = activeBook.content;
        document.getElementById('input-ai-prompt').value = ""; // 指示欄をクリア
        updateContinueButton();
        saveData();
        
        // 「書く」タブに切り替えて内容を確認させる
        switchWriterTab('write');

    } catch (e) {
        showError("執筆中に迷子になりました: " + e.message);
    } finally {
        showLoading(false);
    }
}

// --- 2. 続きを書くボタンの表示更新 ---
function updateContinueButton() {
    const btn = document.getElementById('btn-ai-write-continue');
    if (!btn || !activeBook) return;

    if (activeBook.totalChapters > 0) {
        const remaining = activeBook.totalChapters - (activeBook.currentChapter || 0);
        if (remaining > 0) {
            btn.innerHTML = `<i data-lucide="fast-forward" class="w-4 h-4"></i> あと${remaining}話書く`;
            btn.disabled = false;
        } else {
            btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> 完結済み`;
            btn.disabled = true;
        }
        if (window.lucide) lucide.createIcons();
    } else {
        btn.innerHTML = `<i data-lucide="fast-forward" class="w-4 h-4"></i> 続きを書く`;
        btn.disabled = false;
    }
}
/**
 * ==============================================================================
 * script.js - PART 9: VISUAL GENERATION & TEXT REFINEMENT
 * ==============================================================================
 */

// --- 1. 表紙画像の生成 ---
async function handleGenerateCover() {
    if (!activeBook) return;
    
    showLoading(true);
    try {
        // 作品のタイトルとジャンルを反映させたプロンプト
        const prompt = `Book cover art, titled "${activeBook.title}", genre is ${activeBook.genre}, elegant, cinematic lighting, masterpiece, high resolution, no text on image.`;
        
        const b64 = await generateImage(prompt);
        if (b64) {
            // ストレージ容量節約のため圧縮して保存
            const compressed = await compressImage(b64, 600, 0.7);
            activeBook.cover = compressed;
            saveData();
            renderVisualGallery(); // ツール内のギャラリーを更新
            renderLibrary();       // 書庫側の表示も更新
        }
    } catch (e) {
        showError("表紙の描画に失敗しました: " + e.message);
    } finally {
        showLoading(false);
    }
}

// --- 2. 挿絵（イラスト）の生成と挿入 ---
async function handleGenerateIllustration() {
    const promptInput = document.getElementById('input-illus-prompt');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        alert("どのような場面を描くか入力してください。");
        return;
    }
    
    showLoading(true);
    try {
        const fullPrompt = `Anime style illustration, ${prompt}, ${activeBook.genre} atmosphere, highly detailed, soft focus.`;
        const b64 = await generateImage(fullPrompt);
        
        if (b64) {
            const compressed = await compressImage(b64, 500, 0.7);
            const imgId = generateId();
            
            // 物語のデータに挿絵を追加
            activeBook.illustrations.push({ id: imgId, data: compressed });
            
            // 本文のカーソル位置、または末尾に挿絵タグ [挿絵:id] を挿入
            const textarea = document.getElementById('textarea-content');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            
            const tag = `\n\n[挿絵:${imgId}]\n\n`;
            activeBook.content = text.substring(0, start) + tag + text.substring(end);
            textarea.value = activeBook.content;
            
            // 入力欄を閉じてリセット
            promptInput.value = "";
            document.getElementById('illus-input-container').classList.add('hidden');
            
            saveData();
            renderVisualGallery();
        }
    } catch (e) {
        showError("挿絵の描画に失敗しました: " + e.message);
    } finally {
        showLoading(false);
    }
}

// --- 3. 言葉を磨く (AI推敲支援) ---
async function handleRefineText() {
    const textarea = document.getElementById('textarea-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end).trim();
    
    if (!selectedText) {
        alert("磨きたい言葉や文章を範囲選択してから押してください。");
        return;
    }
    
    showLoading(true);
    try {
        const prompt = `以下の文章を、小説の一部としてより情緒的、文学的、あるいは印象的な表現に言い換えてください。
対象の文章: 「${selectedText}」
ジャンル: ${activeBook.genre}

5つの異なる雰囲気の提案を、簡潔な箇条書きで出力してください。解説は不要です。`;

        const suggestions = await generateText(prompt, "あなたは熟練の編集者であり詩人です。");
        
        // 提案をアラート（またはカスタムダイアログ）で表示
        // ※将来的にここをモーダルにするとより使いやすくなります
        alert(`【言の葉の提案】\n\n${suggestions}`);
        
    } catch (e) {
        showError("推敲中に言葉を失いました: " + e.message);
    } finally {
        showLoading(false);
    }
}
/**
 * ==============================================================================
 * script.js - PART 10: VERTICAL TEXT RENDERING ENGINE
 * ==============================================================================
 */

/**
 * テキストを解析し、縦書き用のHTML構造に変換して表示します
 * @param {HTMLElement} container - 表示先の要素
 * @param {string} content - 表示する本文テキスト
 * @param {Array} illustrations - 物語に紐づく画像データの配列
 */
function renderVerticalText(container, content, illustrations = []) {
    if (!container) return;
    
    // 本文が空の場合の表示
    if (!content || content.trim() === "") {
        container.innerHTML = '<div class="text-gray-400 p-8 flex items-center h-full">まだ白紙のようです。物語を書き始めましょう。</div>';
        return;
    }

    container.innerHTML = ''; // コンテナをリセット
    
    const lines = content.split('\n');
    let htmlContent = '';
    
    // 現在どのセクションを解析しているかのフラグ
    let inSynopsis = false;
    let inToc = false;

    lines.forEach(line => {
        const text = line.trim();

        // 1. 空行の処理（縦書きでの行間・余白として扱う）
        if (!text) {
            htmlContent += '<div style="height: 100%; width: 1.5em; min-width: 1.5em;"></div>';
            return;
        }

        // 2. 特殊タグ [挿絵:id] の解析と置換
        const imgMatch = text.match(/\[挿絵:(.+?)\]/);
        if (imgMatch) {
            const imgId = imgMatch[1];
            const imgData = illustrations.find(img => img.id === imgId);
            if (imgData) {
                htmlContent += `
                    <div class="vertical-image-container animate-fade-in" onclick="showImagePreview('${imgData.data}')">
                        <img src="${imgData.data}" alt="挿絵">
                    </div>`;
            }
            return;
        }

        // 3. セクションヘッダーの判定
        if (text.includes('【あらすじ】')) {
            inSynopsis = true; inToc = false;
            htmlContent += `<h3 class="font-bold text-lg mb-4 mt-8" style="text-indent:0; color:var(--indigo-primary);">【あらすじ】</h3>`;
            return;
        }
        if (text.includes('【目次】')) {
            inSynopsis = false; inToc = true;
            htmlContent += `<h3 class="font-bold text-lg mb-4 mt-8" style="text-indent:0; color:var(--indigo-primary);">【目次】</h3>`;
            return;
        }

        // 4. 章タイトル（見出し）の自動検出
        // 「第〇話」「第〇章」「Chapter」「タイトル:」などのパターン
        const isChapterHeader = text.length < 50 && (
            text.match(/^第[0-9０-９]+[話章]/) || 
            text.match(/^[Cc]hapter/i) || 
            text.match(/^タイトル[:：]/) ||
            text.match(/^[0-9]+[話章.]/)
        );

        if (isChapterHeader && !text.includes('予定')) {
            inSynopsis = false; inToc = false;
            // 目次からのジャンプ先となるIDを生成
            const linkId = "ch-" + text.replace(/[^\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]+/g, '-');
            htmlContent += `<p id="${linkId}" class="chapter-title animate-fade-in">${text}</p>`;
            return;
        }

        // 5. 本文・目次・あらすじの描画
        if (inToc) {
            // 目次エリア：タップでジャンプできるリンクにする
            const targetId = "ch-" + text.replace(/[^\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]+/g, '-');
            htmlContent += `<p class="mb-2"><a onclick="scrollToChapter('${targetId}')" class="toc-link">${text}</a></p>`;
        } 
        else if (inSynopsis) {
            // あらすじエリア
            htmlContent += `<p class="synopsis-text">${text}</p>`;
        } 
        else {
            // 一般本文：会話文か地の文かでインデントを切り替え
            const isDialogue = text.match(/^[「『（【]/);
            const indentClass = isDialogue ? 'no-indent' : '';
            htmlContent += `<p class="novel-paragraph ${indentClass}">${text}</p>`;
        }
    });
    
    container.innerHTML = htmlContent;
}

/**
 * 縦書きエリア内での特定の章へのスクロール
 * @param {string} id - ジャンプ先の要素ID
 */
function scrollToChapter(id) {
    const target = document.getElementById(id);
    if (target) {
        // 縦書きなので inline: 'start' (右端に合わせる) を指定
        target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
}

/**
 * 画像を全画面でプレビュー表示
 * @param {string} src - 画像のURL (Base64)
 */
function showImagePreview(src) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-modal-img');
    if (modal && img) {
        img.src = src;
        modal.classList.remove('hidden');
    }
}
/**
 * ==============================================================================
 * script.js - PART 11: READER FEATURES (TTS & QUOTE CARDS)
 * ==============================================================================
 */

// --- 1. AI朗読 (Text-to-Speech) の制御 ---
let isReading = false;

async function handleTTS() {
    const audioPlayer = document.getElementById('audio-player');
    const ttsBtn = document.getElementById('btn-reader-tts');
    
    // 再生中の場合は停止
    if (isReading) {
        audioPlayer.pause();
        audioPlayer.src = "";
        isReading = false;
        ttsBtn.classList.remove('text-indigo-600', 'animate-pulse');
        ttsBtn.innerHTML = '<i data-lucide="headphones" class="w-5 h-5"></i><span>朗読</span>';
        if (window.lucide) lucide.createIcons();
        return;
    }

    // 朗読するテキストを取得（選択範囲があればそれを、なければ画面内のテキスト）
    let textToRead = window.getSelection().toString().trim();
    if (!textToRead) {
        // 選択されていない場合は、reader-content-area のテキストを取得（タグを除去）
        textToRead = document.getElementById('reader-content-area').innerText.substring(0, 1000); // 1000文字程度に制限
    }

    if (!textToRead) return;

    showLoading(true);
    try {
        // APIを呼び出してPCMデータを取得（Part 19の関数を使用）
        const pcmData = await generateSpeech(textToRead);
        // WAV形式に変換（Part 18の関数を使用）
        const audioUrl = pcmToWav(pcmData);
        
        audioPlayer.src = audioUrl;
        audioPlayer.play();
        
        isReading = true;
        ttsBtn.classList.add('text-indigo-600', 'animate-pulse');
        ttsBtn.innerHTML = '<i data-lucide="square" class="w-5 h-5"></i><span>停止</span>';
        if (window.lucide) lucide.createIcons();

        audioPlayer.onended = () => {
            isReading = false;
            ttsBtn.classList.remove('text-indigo-600', 'animate-pulse');
            ttsBtn.innerHTML = '<i data-lucide="headphones" class="w-5 h-5"></i><span>朗読</span>';
            if (window.lucide) lucide.createIcons();
        };

    } catch (e) {
        showError("声が出ません: " + e.message);
    } finally {
        showLoading(false);
    }
}

// --- 2. 名文カードの書き出し ---
async function handleExportQuote() {
    // ユーザーが選択しているテキストを取得
    const selection = window.getSelection().toString().trim();
    
    if (!selection) {
        alert("カードにしたい美しい一節を、指でなぞって範囲選択してください。");
        return;
    }

    if (selection.length > 200) {
        alert("少し長すぎるようです。200文字以内くらいが美しく収まります。");
        return;
    }

    showLoading(true);
    try {
        // Canvasを使用して画像を生成（Part 18の関数を使用）
        const cardDataUrl = await createQuoteCard(
            selection, 
            activeBook.title, 
            "AI Author", // 著者名（必要に応じて変更）
            activeBook.cover // 背景に表紙を使用
        );
        
        // 生成された画像をプレビューモーダルで表示
        showImagePreview(cardDataUrl);
        
        // 保存（ダウンロード）を促すメッセージ
        setTimeout(() => {
            alert("名文カードを生成しました。画像を長押し、または右クリックして保存してください。");
        }, 500);

    } catch (e) {
        showError("カードの生成に失敗しました: " + e.message);
    } finally {
        showLoading(false);
    }
}
/**
 * ==============================================================================
 * script.js - PART 12: READER CHAT (INTERACTION WITH AI AUTHOR)
 * ==============================================================================
 */

// --- 1. チャット画面を開く ---
function openReaderChat() {
    const overlay = document.getElementById('reader-chat-overlay');
    if (!overlay || !activeBook) return;

    // チャット履歴があれば表示、なければ挨拶を表示
    renderChatMessages();
    overlay.classList.remove('hidden');
    
    // 入力欄にフォーカス
    setTimeout(() => document.getElementById('input-chat-message').focus(), 300);
}

// --- 2. チャット履歴の描画 ---
function renderChatMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';
    
    // 履歴がない場合は初期メッセージ
    if (activeBook.chatHistory.length === 0) {
        activeBook.chatHistory.push({
            role: 'ai',
            text: `『${activeBook.title}』の世界へようこそ。作者のAIです。作品の感想や、物語の裏側について何か気になることはありますか？`
        });
    }

    activeBook.chatHistory.forEach(msg => {
        const div = document.createElement('div');
        div.className = msg.role === 'user' 
            ? "ml-auto bg-indigo-100 text-indigo-900 max-w-[85%]" 
            : "mr-auto bg-gray-100 text-gray-800 max-w-[85%]";
        div.innerText = msg.text;
        container.appendChild(div);
    });

    // 最下部へスクロール
    container.scrollTop = container.scrollHeight;
}

// --- 3. メッセージの送信処理 ---
async function handleSendChatMessage() {
    const input = document.getElementById('input-chat-message');
    const message = input.value.trim();
    if (!message) return;

    // ユーザーのメッセージをUIに追加
    activeBook.chatHistory.push({ role: 'user', text: message });
    renderChatMessages();
    input.value = "";

    try {
        // コンテキスト（物語の内容と設定）をAIに伝える
        const context = `
あなたは物語『${activeBook.title}』の作者です。
【作品のあらすじ】
${activeBook.synopsis || "未設定"}
【世界観設定】
${activeBook.worldSettings || "未設定"}
【本文の一部】
${activeBook.content.substring(0, 2000)}

読者からメッセージが届きました。作者としての立場、あるいは物語の案内人として、作品の世界観を壊さないように対話してください。`;

        // API呼び出し（履歴も含めて送信するのが理想ですが、ここでは簡略化して直近の文脈を送ります）
        const aiResponse = await generateText(message, context);
        
        // AIの返答を履歴に追加
        activeBook.chatHistory.push({ role: 'ai', text: aiResponse });
        renderChatMessages();
        saveData();

    } catch (e) {
        showError("対話中に声が枯れてしまいました: " + e.message);
    }
}

// --- 4. チャットを閉じる ---
function closeReaderChat() {
    document.getElementById('reader-chat-overlay').classList.add('hidden');
}
/**
 * ==============================================================================
 * script.js - PART 13: EVENT LISTENERS & INITIALIZATION
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. データの読み込みと初期描画
    loadData();
    renderLibrary();
    applyBackground();
    if (window.lucide) lucide.createIcons();

    // --- 2. 画面遷移・全体操作のイベント ---

    // 「新しい物語を紡ぐ」ボタン
    document.getElementById('btn-new-book')?.addEventListener('click', () => {
        createNewBook("新しい物語", "", "ファンタジー");
    });

    // 設定モーダルの開閉
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('hidden');
        document.getElementById('input-api-key').value = apiKey;
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.add('hidden');
    });

    // APIキーの保存
    document.getElementById('input-api-key')?.addEventListener('change', (e) => {
        apiKey = e.target.value.trim();
        localStorage.setItem('kotonoha_api_key', apiKey);
    });

    // 書庫に戻るボタン（共通）
    const backToLibrary = () => {
        saveCurrentBook();
        switchView('library');
        renderLibrary();
    };
    document.getElementById('btn-back-library')?.addEventListener('click', backToLibrary);
    document.getElementById('btn-reader-library')?.addEventListener('click', backToLibrary);

    // --- 3. 執筆画面（エディタ）のイベント ---

    // タブ切り替えボタン
    document.getElementById('tab-btn-write')?.addEventListener('click', () => switchWriterTab('write'));
    document.getElementById('tab-btn-preview')?.addEventListener('click', () => switchWriterTab('preview'));
    document.getElementById('tab-btn-tools')?.addEventListener('click', () => switchWriterTab('tools'));

    // ジャンル選択の連動
    document.getElementById('select-genre-main')?.addEventListener('change', (e) => {
        updateSubGenre(e.target.value);
    });

    // AI執筆ボタン
    document.getElementById('btn-ai-write-new')?.addEventListener('click', () => handleAIWrite('new'));
    document.getElementById('btn-ai-write-continue')?.addEventListener('click', () => handleAIWrite('continue'));

    // 言葉を磨く（推敲）ボタン
    document.getElementById('btn-refine-text')?.addEventListener('click', handleRefineText);

    // --- 4. ツールパネルのイベント ---

    // 人物追加
    document.getElementById('btn-add-character')?.addEventListener('click', () => {
        if (!activeBook) return;
        activeBook.characters.push({ name: "", desc: "" });
        saveData();
        renderCharactersList();
    });

    // 表紙生成
    document.getElementById('btn-gen-cover')?.addEventListener('click', handleGenerateCover);

    // 挿絵入力エリアの開閉
    document.getElementById('btn-show-illus-input')?.addEventListener('click', () => {
        document.getElementById('illus-input-container').classList.remove('hidden');
    });
    document.getElementById('btn-close-illus')?.addEventListener('click', () => {
        document.getElementById('illus-input-container').classList.add('hidden');
    });

    // 挿絵生成実行
    document.getElementById('btn-gen-illus')?.addEventListener('click', handleGenerateIllustration);

    // --- 5. 読書画面のイベント ---

    // 目次モーダルの開閉
    document.getElementById('btn-open-toc')?.addEventListener('click', () => {
        document.getElementById('toc-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-toc')?.addEventListener('click', () => {
        document.getElementById('toc-modal').classList.add('hidden');
    });

    // リーダー機能（朗読・名文・対話）
    document.getElementById('btn-reader-tts')?.addEventListener('click', handleTTS);
    document.getElementById('btn-reader-quote')?.addEventListener('click', handleExportQuote);
    document.getElementById('btn-reader-chat')?.addEventListener('click', openReaderChat);
    
    // チャット操作
    document.getElementById('btn-close-chat')?.addEventListener('click', closeReaderChat);
    document.getElementById('btn-send-chat')?.addEventListener('click', handleSendChatMessage);
    document.getElementById('input-chat-message')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendChatMessage();
    });

    // --- 6. 管理・ユーティリティのイベント ---

    // 本の削除
    document.getElementById('btn-delete-book')?.addEventListener('click', () => {
        if (confirm("この物語を完全に削除しますか？戻すことはできません。")) {
            books = books.filter(b => b.id !== activeBookId);
            saveData();
            switchView('library');
            renderLibrary();
        }
    });

    // 全データリセット
    document.getElementById('btn-reset-app')?.addEventListener('click', () => {
        if (confirm("すべての物語と設定を削除して初期化しますか？")) {
            localStorage.clear();
            location.reload();
        }
    });

    // 画像プレビューを閉じる
    document.getElementById('btn-close-preview')?.addEventListener('click', () => {
        document.getElementById('image-preview-modal').classList.add('hidden');
    });
});
/**
 * ==============================================================================
 * script.js - PART 14: FINAL UI LOGIC & EXPORT
 * ==============================================================================
 */

// --- 1. 読書画面を開く (Reader Activation) ---
function openReader(bookId) {
    activeBookId = bookId;
    activeBook = books.find(b => b.id === bookId);
    if (!activeBook) return;

    // A. 縦書き本文の描画
    const readerArea = document.getElementById('reader-content-area');
    renderVerticalText(readerArea, activeBook.content, activeBook.illustrations);

    // B. モーダル内の情報更新（あらすじ・目次）
    document.getElementById('input-synopsis').value = activeBook.synopsis || "";
    
    // 目次リストの自動生成
    const tocList = document.getElementById('toc-list');
    tocList.innerHTML = '';
    const chapters = activeBook.content.split('\n').filter(line => 
        line.trim().match(/^第[0-9０-９]+[話章]/) || line.trim().match(/^[Cc]hapter/i)
    );
    
    if (chapters.length === 0) {
        tocList.innerHTML = '<p class="text-[10px] text-gray-400">章が検出されませんでした</p>';
    } else {
        chapters.forEach(ch => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left p-3 text-xs border-b border-gray-50 hover:bg-indigo-50 transition-colors truncate";
            btn.innerText = ch.trim();
            btn.onclick = () => {
                const targetId = "ch-" + ch.trim().replace(/[^\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]+/g, '-');
                scrollToChapter(targetId);
                document.getElementById('toc-modal').classList.add('hidden');
            };
            tocList.appendChild(btn);
        });
    }

    // C. 画面切り替えと背景の適用
    switchView('reader');
    applyBackground();
}

// --- 2. ローディングとエラーの表示制御 ---

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        if (show) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }
}

function showError(message) {
    const toast = document.getElementById('error-toast');
    const msgArea = document.getElementById('error-message');
    if (toast && msgArea) {
        msgArea.innerText = message;
        toast.classList.remove('hidden');
        // 5秒後に自動で消す
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
}

// --- 3. テキストファイル (.txt) の書き出し ---

document.getElementById('btn-export-txt')?.addEventListener('click', () => {
    if (!activeBook) return;

    const title = activeBook.title || "無題の物語";
    const content = `タイトル：${title}\n著者：AI ＆ あなた\n\n${activeBook.content}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert("テキストファイルをダウンロードしました。");
});

// ==============================================================================
//  KOTONOHA WRITER'S WORKSHOP - COMPLETED
// ==============================================================================
