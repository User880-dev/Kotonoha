const { useState, useEffect, useRef, useMemo } = React;

// --- アイコンコンポーネント (Lucide Reactの代用) ---
const Icon = ({ name, size = 24, className = "" }) => {
    return <i data-lucide={name} className={className} style={{ fontSize: size, width: size, height: size, display: 'inline-block' }}></i>;
};

// --- 定数データ ---
const GENRE_DEFINITIONS = {
  "ファンタジー": ["王道・ハイファンタジー", "異世界転生・転移", "ダークファンタジー", "現代異能", "魔法少女", "冒険・ダンジョン"],
  "SF": ["スペースオペラ", "サイバーパンク", "タイムトラベル", "近未来・ディストピア", "AI・ロボット"],
  "ミステリー": ["本格推理", "サスペンス", "ハードボイルド", "日常の謎", "ホラーミステリー"],
  "恋愛": ["学園ラブコメ", "大人の恋愛", "悲恋", "BL", "GL"],
  "ホラー": ["心霊・オカルト", "サイコホラー", "都市伝説", "怪談"],
  "純文学": ["私小説", "青春・群像劇", "詩的・幻想", "哲学・思想"],
  "歴史・時代": ["戦国・幕末", "西洋史", "架空戦記"],
  "詩歌・エッセイ": ["現代詩", "短歌・俳句", "日記・随筆", "紀行文"]
};

const RANDOM_WORDS = ["雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車", "図書館", "鍵", "ピアノ", "星空", "迷子", "珈琲", "古書店", "鏡", "青", "記憶", "風船", "写真", "月", "金魚", "影", "電話", "屋上", "ソーダ水", "花火", "雪"];

// --- ツール関数 ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const compressImage = (base64Str) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 400 / img.width;
            canvas.width = 400;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(base64Str);
    });
};

const pcmToWav = (base64) => {
    const bin = window.atob(base64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const view = new DataView(new ArrayBuffer(44));
    const writeString = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 36 + len, true); writeString(8, 'WAVE'); writeString(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(36, 'data');
    view.setUint32(40, len, true);
    return URL.createObjectURL(new Blob([view, bytes], { type: 'audio/wav' }));
};

// --- API通信 ---
const callGemini = async (url, payload, apiKey) => {
    const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "APIエラーが発生しました");
    }
    return res.json();
};

// --- コンポーネント: 縦書き表示 ---
const VerticalTextDisplay = ({ title, content, illustrations, setPreview, stamps }) => {
    const parts = (content || "").split(/\[挿絵:(.+?)\]/g);
    
    return (
        <div className="writing-vertical font-serif h-full text-gray-800 text-lg leading-loose relative">
            <h1 className="text-2xl font-bold ml-12 mt-12 mb-10 select-none border-l-4 border-indigo-600 pl-4 inline-block">{title}</h1>
            <div className="whitespace-pre-wrap text-justify ml-4 h-full">
                {parts.map((part, i) => {
                    if (i % 2 === 0) return <span key={i}>{part}</span>;
                    const img = illustrations?.find(ill => ill.id === part);
                    return img ? (
                        <div key={i} className="inline-block mx-4 my-4 p-2 bg-white shadow-lg border cursor-pointer" style={{writingMode:'horizontal-tb'}} onClick={(e) => { e.stopPropagation(); setPreview(img.data); }}>
                            <img src={img.data} className="max-w-[60vw] max-h-[50vh] object-contain" />
                        </div>
                    ) : <span key={i} className="text-xs text-gray-300">[挿絵なし]</span>;
                })}
            </div>
            
            {/* スタンプ表示 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{writingMode: 'horizontal-tb'}}>
                {stamps?.map((s, i) => (
                    <div key={i} className="absolute stamp-anim opacity-80" style={{top: s.y, left: s.x}}>
                        <div className="bg-red-50 border-2 border-red-600 text-red-600 px-3 py-1 rounded-full font-bold transform -rotate-12 border-dashed text-xs shadow-sm whitespace-nowrap">
                            {s.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- メインアプリ ---
const App = () => {
    // State
    const [view, setView] = useState('auth');
    const [books, setBooks] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [apiKey, setApiKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    
    // Reader State
    const [showFanLetter, setShowFanLetter] = useState(false);
    const [letterContent, setLetterContent] = useState("");

    // 初期化
    useEffect(() => {
        const b = localStorage.getItem('kotonoha_books');
        const k = localStorage.getItem('gemini_api_key');
        if (b) setBooks(JSON.parse(b));
        if (k) { setApiKey(k); setView('library'); }
    }, []);

    // アイコン更新（画面遷移時）
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [view, showSettings, loading, preview, showFanLetter, books]);

    // データ保存
    useEffect(() => { localStorage.setItem('kotonoha_books', JSON.stringify(books)); }, [books]);
    useEffect(() => { if(apiKey) localStorage.setItem('gemini_api_key', apiKey); }, [apiKey]);

    const activeBook = useMemo(() => books.find(b => b.id === activeId), [books, activeId]);
    const updateBook = (updates) => setBooks(prev => prev.map(b => b.id === activeId ? { ...b, ...updates, updatedAt: Date.now() } : b));

    // --- 機能群 ---

    // AI執筆
    const handleAI = async (type, prompt = "", contentAreaValue = "") => {
        setLoadingText(type==='image' ? "挿絵を描いています..." : "AIが執筆中...");
        setLoading(true);
        try {
            if (type === 'image') {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`;
                const data = await callGemini(url, { instances: [{ prompt: `${prompt}, 水彩画風, 日本の小説の挿絵, 高品質` }], parameters: { sampleCount: 1 } }, apiKey);
                const b64 = data.predictions?.[0]?.bytesBase64Encoded;
                if (b64) {
                    const illId = generateId();
                    const compressed = await compressImage(`data:image/png;base64,${b64}`);
                    updateBook({ 
                        illustrations: [...(activeBook.illustrations || []), { id: illId, data: compressed }],
                        content: activeBook.content + `\n\n[挿絵:${illId}]\n\n`
                    });
                }
            } else {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent`;
                const userPrompt = type === 'new' ? `指示: ${prompt}` : `以下の続きを書いて: ${contentAreaValue.slice(-800)}`;
                const sys = "あなたはプロの小説家です。装飾（**など）を使わず、小説の本文テキストのみを出力してください。";
                const data = await callGemini(url, { contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: sys }] } }, apiKey);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                
                if (type === 'new') {
                    // タイトル抽出
                    const titleMatch = text.match(/タイトル[:：]\s*(.+)/);
                    let newTitle = activeBook.title;
                    let newContent = text;
                    if (titleMatch) {
                        newTitle = titleMatch[1].trim();
                        newContent = text.replace(titleMatch[0], '').trim();
                    }
                    updateBook({ title: newTitle, content: newContent });
                } else {
                    updateBook({ content: activeBook.content + "\n\n" + text });
                }
            }
        } catch (e) { setError("エラー: " + e.message); }
        setLoading(false);
    };

    // ファンレター
    const getFanLetter = async () => {
        setLoadingText("手紙を待っています...");
        setLoading(true);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent`;
            const data = await callGemini(url, { contents: [{ parts: [{ text: `この小説を読んだ熱心なファンとして、作者に宛てた心温まる短い手紙を書いてください:\n\n${activeBook.content.slice(0,600)}` }] }] }, apiKey);
            setLetterContent(data.candidates[0].content.parts[0].text);
            setShowFanLetter(true);
        } catch (e) { setError("手紙が届きませんでした"); }
        setLoading(false);
    };

    // --- 画面コンポーネント ---

    // 1. 認証
    if (view === 'auth') {
        return (
            <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6 animate-in">
                <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
                    <div className="mx-auto mb-4 text-indigo-600"><Icon name="key" size={48}/></div>
                    <h1 className="text-2xl font-serif font-bold mb-4 text-gray-800">言の葉</h1>
                    <p className="text-xs text-gray-500 mb-6">Gemini APIキーを入力してください</p>
                    <input type="password" placeholder="API Key" className="w-full p-4 bg-gray-50 rounded-xl mb-4 text-center border focus:border-indigo-500 outline-none transition-all" onBlur={e => { if(e.target.value) { setApiKey(e.target.value); setView('library'); }}} />
                </div>
            </div>
        );
    }

    // 2. 書庫
    if (view === 'library') {
        return (
            <div className="p-6 max-w-6xl mx-auto min-h-screen pb-24 animate-in">
                <header className="flex justify-between items-center mb-8 sticky top-4 z-10 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-sm">
                    <h1 className="text-xl font-serif font-bold flex gap-2 text-gray-800"><Icon name="library" className="text-indigo-600"/> 言の葉書庫</h1>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            const words = [...RANDOM_WORDS].sort(()=>0.5-Math.random()).slice(0,3);
                            if(confirm(`お題: ${words.join('、')}\n\nこのお題で執筆しますか？`)) {
                                const id = generateId();
                                setBooks([{ id, title: "三題噺の物語", content: `お題: ${words.join('、')}\n\n`, illustrations: [], createdAt: Date.now() }, ...books]);
                                setActiveId(id); setView('write');
                            }
                        }} className="p-2 bg-indigo-50 text-indigo-600 rounded-full active:scale-95"><Icon name="dice-5"/></button>
                        <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-100 rounded-full active:scale-95"><Icon name="settings"/></button>
                    </div>
                </header>
                <div className="grid grid-cols-2 gap-4">
                    <div onClick={() => {
                        const id = generateId();
                        setBooks([{ id, title: "無題の物語", content: "", illustrations: [], createdAt: Date.now() }, ...books]);
                        setActiveId(id); setView('write');
                    }} className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-indigo-600 active:scale-95 transition-transform bg-white/50 cursor-pointer">
                        <Icon name="pen-tool" size={32} className="mb-2"/> <span className="text-xs font-bold">新しく紡ぐ</span>
                    </div>
                    {books.map(b => (
                        <div key={b.id} onClick={() => { setActiveId(b.id); setView('read'); }} className="aspect-[2/3] bg-white rounded-2xl shadow-md border-l-8 border-gray-800 p-4 relative overflow-hidden active:scale-95 transition-transform cursor-pointer group">
                            <span className="writing-vertical font-serif text-lg h-full block select-none pointer-events-none">{b.title}</span>
                            {isDeleteMode && <button onClick={(e)=>{e.stopPropagation(); if(confirm("削除しますか？")) setBooks(books.filter(x=>x.id!==b.id))}} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow z-20"><Icon name="x" size={16}/></button>}
                            <div className="absolute bottom-2 left-2 text-[8px] text-gray-400 bg-gray-100 px-1 rounded">{b.genre || "未設定"}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 3. 執筆
    if (view === 'write') {
        const [tab, setTab] = useState('write');
        const [prompt, setPrompt] = useState("");
        const [illusPrompt, setIllusPrompt] = useState("");
        
        return (
            <div className="flex flex-col h-screen bg-white animate-in">
                <div className="h-14 border-b flex items-center px-4 justify-between shrink-0 safe-area-pt z-20 bg-white">
                    <button onClick={() => setView('library')} className="p-2"><Icon name="chevron-left"/></button>
                    <input value={activeBook.title} onChange={e => updateBook({title: e.target.value})} className="flex-1 text-center font-bold font-serif outline-none mx-2 text-lg truncate" />
                    <button onClick={() => setView('library')} className="text-indigo-600 font-bold p-2"><Icon name="check"/></button>
                </div>
                
                <div className="flex-1 overflow-hidden relative">
                    {/* エディタ */}
                    <div className={tab === 'write' ? 'block h-full' : 'hidden'}>
                        <textarea value={activeBook.content} onChange={e => updateBook({content: e.target.value})} className="w-full h-full p-6 font-serif text-lg leading-loose outline-none pb-32 resize-none" placeholder="物語をここに..." />
                    </div>

                    {/* ツール */}
                    <div className={tab === 'tools' ? 'block h-full overflow-y-auto bg-gray-50 p-4 pb-24' : 'hidden'}>
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-700"><Icon name="feather" size={16}/> AI執筆</h3>
                                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full p-3 border rounded-xl text-sm h-24 mb-2 bg-gray-50 outline-none" placeholder="「雨の夜の再会」など指示..." />
                                <div className="flex gap-2">
                                    <button onClick={() => handleAI('new', prompt)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-xs shadow active:scale-95">新規</button>
                                    <button onClick={() => handleAI('cont', "", activeBook.content)} disabled={!activeBook.content} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs shadow active:scale-95 disabled:bg-gray-300">続き</button>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold mb-2 flex items-center gap-2 text-gray-700"><Icon name="image" size={16}/> 挿絵生成</h3>
                                <textarea value={illusPrompt} onChange={e => setIllusPrompt(e.target.value)} className="w-full p-3 border rounded-xl text-sm h-20 mb-2 bg-gray-50 outline-none" placeholder="挿絵の内容..." />
                                <button onClick={() => handleAI('image', illusPrompt, activeBook.content)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-xs shadow active:scale-95">描画する</button>
                                {/* 画像一覧 */}
                                <div className="grid grid-cols-4 gap-2 mt-4">
                                    {activeBook.illustrations?.map((img, i) => (
                                        <div key={i} className="aspect-square relative cursor-pointer border rounded-lg overflow-hidden" onClick={() => setPreview(img.data)}>
                                            <img src={img.data} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* プレビュー */}
                    <div className={tab === 'preview' ? 'block h-full overflow-x-auto bg-[#fdfbf7]' : 'hidden'}>
                        <VerticalTextDisplay title={activeBook.title} content={activeBook.content} illustrations={activeBook.illustrations} setPreview={setPreview} stamps={activeBook.stamps} />
                    </div>
                </div>

                <div className="h-16 border-t flex items-center justify-around shrink-0 safe-area-pb z-30 bg-white">
                    <button onClick={() => setTab('tools')} className={`flex flex-col items-center gap-1 ${tab==='tools'?'text-indigo-600':'text-gray-400'}`}><Icon name="wand-2"/><span className="text-[9px] font-bold">ツール</span></button>
                    <button onClick={() => setTab('write')} className={`flex flex-col items-center gap-1 ${tab==='write'?'text-indigo-600':'text-gray-400'}`}><Icon name="edit-3"/><span className="text-[9px] font-bold">執筆</span></button>
                    <button onClick={() => setTab('preview')} className={`flex flex-col items-center gap-1 ${tab==='preview'?'text-indigo-600':'text-gray-400'}`}><Icon name="eye"/><span className="text-[9px] font-bold">確認</span></button>
                </div>
            </div>
        );
    }

    // 4. 読書
    if (view === 'read') {
        const [isPlaying, setIsPlaying] = useState(false);
        const audioRef = useRef(new Audio());

        const handleTTS = async () => {
            if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); return; }
            setLoadingText("声を生成中..."); setLoading(true);
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent`;
                const cleanText = activeBook.content.replace(/\[挿絵:.+?\]/g, "");
                const data = await callGemini(url, { contents: [{ parts: [{ text: cleanText.slice(0,800) }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } } }, apiKey);
                const wav = pcmToWav(data.candidates[0].content.parts[0].inlineData.data);
                audioRef.current.src = wav;
                audioRef.current.play();
                setIsPlaying(true);
                audioRef.current.onended = () => setIsPlaying(false);
            } catch (e) { setError("朗読エラー"); }
            setLoading(false);
        };

        const addStamp = () => {
            const texts = ["秀逸", "尊い", "感動", "天才", "神"];
            const t = texts[Math.floor(Math.random()*texts.length)];
            const stamp = { text: t, x: Math.random()*80+10+'%', y: Math.random()*80+10+'%' };
            updateBook({ stamps: [...(activeBook.stamps||[]), stamp] });
        };

        return (
            <div className="h-screen flex flex-col bg-[#fdfbf7] animate-in">
                <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth relative">
                    <VerticalTextDisplay title={activeBook.title} content={activeBook.content} illustrations={activeBook.illustrations} setPreview={setPreview} stamps={activeBook.stamps} />
                </div>
                <div className="h-16 border-t bg-white/90 backdrop-blur flex items-center justify-around shrink-0 safe-area-pb z-40">
                    <button onClick={() => setView('library')} className="text-gray-500 flex flex-col items-center gap-1"><Icon name="library"/><span className="text-[8px] font-bold">書庫</span></button>
                    <button onClick={handleTTS} className={`flex flex-col items-center gap-1 ${isPlaying?'text-indigo-600':'text-gray-500'}`}><Icon name="volume-2"/><span className="text-[8px] font-bold">朗読</span></button>
                    <button onClick={getFanLetter} className="text-gray-500 flex flex-col items-center gap-1"><Icon name="mail"/><span className="text-[8px] font-bold">手紙</span></button>
                    <button onClick={addStamp} className="text-gray-500 flex flex-col items-center gap-1"><Icon name="stamp"/><span className="text-[8px] font-bold">刻印</span></button>
                    <button onClick={() => setView('write')} className="text-gray-500 flex flex-col items-center gap-1"><Icon name="edit-3"/><span className="text-[8px] font-bold">編集</span></button>
                </div>
            </div>
        );
    }

    // --- 共通UI ---
    return (
        <>
            {loading && <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center text-white flex-col gap-2 backdrop-blur-sm"><Icon name="refresh-cw" className="animate-spin mb-2" size={32}/><span className="font-bold">{loadingText}</span></div>}
            
            {error && <div className="fixed bottom-20 left-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-lg z-[999] flex justify-between animate-in"><span className="text-sm font-bold">{error}</span> <button onClick={()=>setError(null)}><Icon name="x"/></button></div>}
            
            {preview && <div className="fixed inset-0 bg-black/95 z-[999] flex items-center justify-center p-4 animate-in" onClick={()=>setPreview(null)}><img src={preview} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"/><button className="absolute top-6 right-6 text-white p-2 bg-white/20 rounded-full"><Icon name="x"/></button></div>}

            {showSettings && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                    <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-in" onClick={e=>e.stopPropagation()}>
                        <h3 className="font-bold mb-6 flex gap-2 text-xl"><Icon name="settings" className="text-indigo-600"/> 設定</h3>
                        <div className="space-y-4">
                            <button onClick={() => setIsDeleteMode(!isDeleteMode)} className="w-full p-4 bg-gray-50 rounded-xl flex justify-between font-bold text-sm">削除モード <span>{isDeleteMode?"ON":"OFF"}</span></button>
                            <button onClick={() => { if(confirm("リセットしますか？")){ localStorage.clear(); location.reload(); }}} className="w-full p-3 text-red-500 border border-red-100 rounded-xl text-xs font-bold">データを全消去</button>
                        </div>
                        <button onClick={() => setShowSettings(false)} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95">閉じる</button>
                    </div>
                </div>
            )}

            {showFanLetter && (
                <div className="fixed inset-0 bg-black/60 z-[550] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowFanLetter(false)}>
                    <div className="bg-[#fffcf5] p-8 rounded-3xl shadow-2xl w-full max-w-sm relative animate-in border border-stone-200" onClick={e=>e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-t-3xl"></div>
                        <div className="text-center mb-4 text-indigo-600"><Icon name="mail" size={32}/></div>
                        <h2 className="text-center font-serif font-bold text-gray-800 mb-4">お手紙が届きました</h2>
                        <div className="font-serif text-gray-700 text-sm leading-loose whitespace-pre-wrap max-h-[50vh] overflow-y-auto mb-6">{letterContent}</div>
                        <button onClick={() => setShowFanLetter(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95">大切にする</button>
                    </div>
                </div>
            )}
        </>
    );
};
