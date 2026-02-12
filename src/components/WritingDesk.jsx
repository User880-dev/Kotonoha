import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronLeft, Check, Sparkles, RefreshCw, Wand2, Edit3, Eye, 
    Feather, MoreHorizontal, PenTool, User, Image as ImageIcon, FileText 
} from 'lucide-react';
import { generateStoryText, generateIllustration } from '../api.js';
import { generateId, compressImage } from '../utils.js';
import VerticalTextDisplay from './VerticalTextDisplay.jsx';

// ジャンル定義（AIへの指示出しに使用）
const GENRE_DEFINITIONS = {
  "ファンタジー": ["王道・ハイファンタジー", "異世界転生・転移", "ダークファンタジー", "ローファンタジー（現代異能）", "魔法少女・魔女", "ダンジョン・冒険", "和風ファンタジー", "スチームパンク"],
  "SF": ["スペースオペラ", "サイバーパンク", "タイムリープ・タイムトラベル", "近未来・ディストピア", "AI・ロボット", "VRゲーム", "パニック・災害", "宇宙人・ファーストコンタクト"],
  "ミステリー": ["本格推理", "サスペンス", "ハードボイルド", "日常の謎", "警察・刑事", "ホラーミステリー", "社会派ミステリー", "探偵もの"],
  "恋愛": ["学園ラブコメ", "大人の恋愛", "悲恋・ドラマ", "幼馴染", "オフィスラブ", "BL", "GL", "婚約破棄・ざまぁ"],
  "ホラー": ["心霊・オカルト", "サイコホラー", "パニック・サバイバル", "都市伝説", "怪談", "クトゥルフ神話", "デスゲーム"],
  "純文学": ["私小説", "青春・群像劇", "家族・人間ドラマ", "歴史・時代小説", "詩的・幻想", "哲学・思想"],
  "歴史・時代": ["戦国・幕末", "平安・鎌倉", "三国志・中国史", "西洋史・騎士", "架空戦記", "大河ドラマ風"],
  "児童文学": ["童話・おとぎ話", "冒険・友情", "動物もの", "教訓・寓話", "絵本原作"],
  "詩歌・エッセイ": ["現代詩", "短歌・俳句", "散文詩", "日記・随筆", "紀行文", "評論"],
  "ビジネス・教養": ["経済小説", "お仕事・業界もの", "自己啓発ストーリー", "ドキュメンタリー"]
};

const WritingDesk = ({ activeBook, updateBook, setView, setLoading, setError, apiKey, setPreviewImage }) => {
    if (!activeBook) return null;

    // --- State ---
    const [prompt, setPrompt] = useState("");
    const [generating, setGenerating] = useState(false);
    const textareaRef = useRef(null);
    
    // UI Tabs: 'tools' (設定・AI), 'write' (執筆), 'preview' (確認)
    const [mobileTab, setMobileTab] = useState('write'); 
    // Tools Sub-tab: 'ai', 'settings'
    const [toolTab, setToolTab] = useState('ai'); 
    
    const [illusPrompt, setIllusPrompt] = useState(""); 
    const [showIllusInput, setShowIllusInput] = useState(false);

    // ジャンル管理
    const [mainGenre, setMainGenre] = useState(() => {
        const current = activeBook.genre || "ファンタジー";
        const keys = Object.keys(GENRE_DEFINITIONS);
        const match = keys.find(k => current.includes(k));
        return match || "ファンタジー";
    });
    const [subGenre, setSubGenre] = useState(() => {
        const current = activeBook.genre || "";
        const match = current.match(/（(.+)）/);
        return match ? match[1] : "";
    });

    // 文字数カウント
    const contentLength = activeBook.content?.length || 0;

    // --- Actions ---

    // 戻るボタン
    const handleBack = () => {
        if (confirm("書庫に戻りますか？\n（内容は自動的に保存されています）")) {
            setView('library');
        }
    };

    // 完了ボタン
    const handleFinish = () => {
        if (!activeBook.content || activeBook.content.trim().length === 0) {
            alert("まだ何も書かれていません。");
            return;
        }
        setView('library');
    };

    // ジャンル保存
    useEffect(() => {
        const fullGenre = subGenre ? `${mainGenre}（${subGenre}）` : mainGenre;
        if (activeBook.genre !== fullGenre) {
           updateBook(activeBook.id, { genre: fullGenre });
        }
    }, [mainGenre, subGenre]);

    // AI執筆機能
    const handleGenerateStory = async (type = 'new') => {
        setGenerating(true);
        setLoading(true);
        try {
            let systemPrompt = "あなたはプロの小説家です。美しい日本語で、感情豊かに物語を書いてください。出力はMarkdown形式ではなくプレーンテキストでお願いします。";
            
            // 設定を注入
            if (activeBook.characters?.length > 0) {
                systemPrompt += `\n\n【登場人物設定】\n${JSON.stringify(activeBook.characters)}`;
            }
            if (activeBook.worldSettings) {
                systemPrompt += `\n\n【世界観・設定】\n${activeBook.worldSettings}`;
            }

            let userPrompt = "";
            const genreText = subGenre ? `${mainGenre}（詳細: ${subGenre}）` : mainGenre;

            if (type === 'new') {
                userPrompt = `ジャンル「${genreText}」で、次の要素を含む物語の冒頭を書いてください: ${prompt}。タイトルも提案してください（形式: タイトル: [タイトル]）。`;
            } else {
                systemPrompt += " 既存の物語の続きを書いてください。文体とトーンを維持してください。";
                userPrompt = `これまでのあらすじ（直近）:\n${activeBook.content.slice(-1500)}\n\n指示: 続きを書いてください。ジャンル意識: ${genreText}。展開案: ${prompt}`;
            }

            const text = await generateStoryText(apiKey, userPrompt, systemPrompt);
            
            if (type === 'new') {
                const titleMatch = text.match(/タイトル[:：]\s*(.+)/);
                let newTitle = activeBook.title;
                let newContent = text;
                if (titleMatch) {
                    newTitle = titleMatch[1].trim();
                    newContent = text.replace(titleMatch[0], '').trim();
                }
                updateBook(activeBook.id, { title: newTitle, content: newContent });
            } else {
                updateBook(activeBook.id, { content: activeBook.content + "\n\n" + text });
            }
            // 執筆完了後はエディタに戻る
            setMobileTab('write');
        } catch (e) {
            setError("執筆エラー: " + e.message);
        } finally {
            setGenerating(false);
            setLoading(false);
        }
    };

    // AI編集者レビュー
    const handleAIReview = async () => {
        setLoading(true);
        try {
            const prompt = `あなたは敏腕編集者です。以下の原稿を読み、1. 良かった点、2. 改善点（矛盾、誤字、表現の拙さ）、3. 次の展開のアイデア を優しくも的確にアドバイスしてください。\n\n本文:\n${activeBook.content.slice(-3000)}`;
            const review = await generateStoryText(apiKey, prompt);
            alert(review); 
        } catch(e) { setError(e.message); } 
        finally { setLoading(false); }
    };

    // 言葉の引き出し（類語提案）
    const handleRefineText = async () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (!selectedText || start === end) { 
            alert("✨ 言葉の引き出し\n磨きたい言葉をテキストエリアで選択してから、このボタンを押してください。"); 
            return; 
        }
        
        setLoading(true);
        try {
            const res = await generateStoryText(apiKey, `言葉「${selectedText}」を、小説の中で使えるより情緒的、文学的、あるいはかっこいい表現に言い換えてください。5つほど箇条書きで提案してください。`);
            alert(`【${selectedText}】の類語・表現提案:\n\n${res}`);
        } catch(e) { setError(e.message); } finally { setLoading(false); }
    };

    // 挿絵生成
    const handleGenerateIllustration = async () => {
        if (!illusPrompt) { alert("どんな挿絵か入力してください"); return; }
        setLoading(true);
        try {
            const imgBase64 = await generateIllustration(apiKey, `Anime style illustration, ${illusPrompt}, ${activeBook.genre}`);
            if (imgBase64) {
                const compressed = await compressImage(imgBase64, 400, 0.7);
                const imgId = generateId();
                const newIllustrations = [...(activeBook.illustrations || []), { id: imgId, data: compressed }];
                const insertText = `\n\n[挿絵:${imgId}]\n\n`;
                updateBook(activeBook.id, { 
                    content: activeBook.content + insertText,
                    illustrations: newIllustrations
                });
                setIllusPrompt("");
                setShowIllusInput(false);
                alert("挿絵を追加しました。「プレビュー」タブで確認できます。");
            }
        } catch(e) { setError("挿絵生成エラー: " + e.message); } finally { setLoading(false); }
    };

    // 表紙生成
    const handleCoverGen = async () => {
        setLoading(true);
        try {
            const img = await generateIllustration(apiKey, `Book cover art, ${activeBook.title}, ${activeBook.genre}, elegant, no text`);
            if (img) {
                const compressed = await compressImage(img, 400, 0.7);
                updateBook(activeBook.id, { cover: compressed });
            }
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    };

    // 画像アップロード
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result, 400, 0.7);
                updateBook(activeBook.id, { cover: compressed });
            };
            reader.readAsDataURL(file);
        }
    };

    // テキスト書き出し
    const handleExportText = () => {
        const text = `タイトル：${activeBook.title}\n著者：${activeBook.author || "私"}\n\n${activeBook.content}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeBook.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-screen bg-white overflow-hidden animate-in">
            {/* ヘッダー */}
            <div className="flex-none flex items-center justify-between p-2 border-b bg-white z-20 shadow-sm relative h-14 safe-area-pt">
                <button onClick={handleBack} className="flex items-center justify-center w-12 h-12 text-gray-600 hover:bg-gray-100 rounded-full cursor-pointer z-30">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <input 
                    value={activeBook.title}
                    onChange={(e) => updateBook(activeBook.id, { title: e.target.value })}
                    className="flex-1 text-center font-bold font-serif bg-transparent border-none outline-none truncate mx-2 text-lg"
                    placeholder="タイトル"
                />
                <button onClick={handleFinish} className="flex items-center justify-center w-12 h-12 text-indigo-600 font-bold hover:bg-indigo-50 rounded-full">
                    <Check className="w-6 h-6" />
                </button>
            </div>

            {/* メインエリア */}
            <div className="flex-1 overflow-hidden relative">
                
                {/* 1. 執筆タブ */}
                <div className={`h-full w-full relative ${mobileTab === 'write' ? 'block' : 'hidden'}`}>
                    <textarea 
                        ref={textareaRef}
                        value={activeBook.content}
                        onChange={(e) => updateBook(activeBook.id, { content: e.target.value })}
                        className="h-full w-full p-4 font-serif text-lg leading-loose resize-none focus:outline-none pb-24 bg-white text-gray-800"
                        placeholder="ここに物語を..."
                    />
                    <div className="absolute bottom-6 right-4 z-10">
                        <button onClick={handleRefineText} className="p-3 bg-white text-indigo-600 rounded-full shadow-xl border border-indigo-100 flex items-center justify-center active:scale-90 transition-transform" title="言葉を磨く">
                            <Sparkles className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 2. プレビュータブ */}
                <div className={`h-full w-full overflow-x-auto overflow-y-hidden bg-[#fdfbf7] ${mobileTab === 'preview' ? 'block' : 'hidden'}`}>
                    <VerticalTextDisplay 
                        title={activeBook.title} 
                        content={activeBook.content} 
                        illustrations={activeBook.illustrations}
                        setPreviewImage={setPreviewImage}
                        paddingClass="py-10 px-8"
                    />
                </div>

                {/* 3. ツールタブ */}
                <div className={`h-full w-full overflow-y-auto bg-gray-50 p-4 pb-20 ${mobileTab === 'tools' ? 'block' : 'hidden'}`}>
                    <div className="flex bg-gray-200 rounded-lg p-1 mb-4 sticky top-0 z-10 shadow-sm">
                        <button onClick={() => setToolTab('ai')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${toolTab === 'ai' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>AI執筆・装丁</button>
                        <button onClick={() => setToolTab('settings')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${toolTab === 'settings' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>設定・出力</button>
                    </div>

                    {/* AIツール */}
                    {toolTab === 'ai' && (
                        <div className="space-y-6 pb-10">
                            {/* AI執筆 */}
                            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-700"><Feather className="w-4 h-4"/> AIと一緒に書く</h3>
                                <div className="flex gap-2 mb-3">
                                    <select value={mainGenre} onChange={(e) => { setMainGenre(e.target.value); setSubGenre(""); }} className="flex-1 p-2 border rounded-lg text-xs bg-gray-50">
                                        {Object.keys(GENRE_DEFINITIONS).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <select value={subGenre} onChange={(e) => setSubGenre(e.target.value)} className="flex-1 p-2 border rounded-lg text-xs bg-gray-50">
                                        <option value="">（詳細なし）</option>
                                        {GENRE_DEFINITIONS[mainGenre].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <textarea 
                                    value={prompt} onChange={(e) => setPrompt(e.target.value)}
                                    className="w-full p-3 border rounded-lg text-sm h-24 mb-3 bg-gray-50 focus:ring-2 focus:ring-indigo-100 outline-none resize-none" 
                                    placeholder="次の展開やアイデアを入力..."
                                />
                                <div className="flex gap-2 mb-3">
                                    <button onClick={() => handleGenerateStory('new')} disabled={generating} className="flex-1 bg-green-600 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-700 transition-colors shadow-sm active:scale-95">
                                        {generating ? <RefreshCw className="animate-spin w-3 h-3"/> : <PenTool className="w-3 h-3" />} 新規執筆
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateStory('continue')} 
                                        disabled={generating || !activeBook.content || activeBook.content.length === 0} 
                                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        {generating ? <RefreshCw className="animate-spin w-3 h-3"/> : <MoreHorizontal className="w-3 h-3" />} 続きを書く
                                    </button>
                                </div>
                                <button onClick={handleAIReview} disabled={generating} className="w-full bg-orange-50 text-orange-700 border border-orange-200 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors">
                                    <User className="w-4 h-4" /> AI編集者のレビュー
                                </button>
                            </section>

                            {/* ビジュアル（挿絵・表紙） */}
                            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-700"><ImageIcon className="w-4 h-4"/> ビジュアル</h3>
                                <div className="flex gap-2 mb-3">
                                    <button onClick={handleCoverGen} disabled={generating} className="flex-1 border border-gray-200 bg-gray-50 py-3 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors">
                                        {generating ? "生成中..." : "表紙を生成"}
                                    </button>
                                    <label className="flex-1 border border-gray-200 bg-gray-50 py-3 rounded-lg text-xs font-bold hover:bg-gray-100 flex justify-center items-center cursor-pointer transition-colors">
                                        画像UP
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    </label>
                                </div>
                                
                                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    {showIllusInput ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea 
                                                value={illusPrompt} 
                                                onChange={(e) => setIllusPrompt(e.target.value)} 
                                                placeholder="例: 桜の木の下で本を読む少女" 
                                                className="w-full p-2 border rounded-md text-xs h-16 bg-white"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleGenerateIllustration} disabled={generating} className="flex-1 bg-indigo-600 text-white py-1 rounded text-xs font-bold">
                                                    {generating ? "描画中..." : "描く"}
                                                </button>
                                                <button onClick={() => setShowIllusInput(false)} className="px-4 bg-gray-300 text-gray-700 rounded-md text-xs font-bold">閉じる</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowIllusInput(true)} className="w-full py-2 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1">
                                            <Sparkles className="w-3 h-3"/> 挿絵を追加する
                                        </button>
                                    )}
                                </div>

                                {/* 画像一覧 */}
                                <div className="grid grid-cols-4 gap-2">
                                    {activeBook.cover && (
                                        <div className="aspect-[2/3] relative cursor-pointer group shadow-sm" onClick={() => setPreviewImage(activeBook.cover)}>
                                            <img src={activeBook.cover} className="w-full h-full object-cover rounded-md border" />
                                            <span className="absolute bottom-0 left-0 bg-black/60 text-white text-[8px] p-0.5 w-full text-center rounded-b-md">表紙</span>
                                        </div>
                                    )}
                                    {activeBook.illustrations?.map((img, i) => (
                                        <div key={i} className="aspect-square relative cursor-pointer shadow-sm" onClick={() => setPreviewImage(img.data)}>
                                            <img src={img.data} className="w-full h-full object-cover rounded-md border" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* 設定ツール */}
                    {toolTab === 'settings' && (
                        <div className="space-y-6 pb-10">
                            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold mb-3 text-gray-700">登場人物・世界観</h3>
                                <textarea 
                                    value={activeBook.worldSettings || ""}
                                    onChange={(e) => updateBook(activeBook.id, { worldSettings: e.target.value })}
                                    className="w-full p-3 border rounded-lg text-sm h-24 mb-3 bg-gray-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    placeholder="世界観設定..."
                                />
                                 <button onClick={() => updateBook(activeBook.id, { characters: [...(activeBook.characters||[]), { name: "", desc: "" }] })} className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold mb-3 border border-indigo-100">+ 人物を追加</button>
                                 {(activeBook.characters||[]).map((c, i) => (
                                     <div key={i} className="flex gap-2 mb-2">
                                         <input value={c.name} onChange={(e)=>{const n=[...activeBook.characters];n[i].name=e.target.value;updateBook(activeBook.id,{characters:n})}} className="w-1/3 p-2 border rounded-md text-xs bg-gray-50" placeholder="名前"/>
                                         <input value={c.desc} onChange={(e)=>{const n=[...activeBook.characters];n[i].desc=e.target.value;updateBook(activeBook.id,{characters:n})}} className="flex-1 p-2 border rounded-md text-xs bg-gray-50" placeholder="詳細"/>
                                     </div>
                                 ))}
                            </section>
                            <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <button onClick={handleExportText} className="w-full py-4 flex items-center justify-center gap-2 text-indigo-600 font-bold bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                                    <FileText className="w-5 h-5" /> テキストファイルで書き出し
                                </button>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Tab Bar */}
            <div className="flex-none flex border-t bg-white safe-area-pb z-50 h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button onClick={() => setMobileTab('tools')} className={`flex-1 flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition-colors ${mobileTab === 'tools' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <Wand2 className="w-6 h-6" />
                    <span className="text-[10px] font-bold">ツール</span>
                </button>
                <button onClick={() => setMobileTab('write')} className={`flex-1 flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition-colors ${mobileTab === 'write' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <Edit3 className="w-6 h-6" />
                    <span className="text-[10px] font-bold">書く</span>
                </button>
                <button onClick={() => setMobileTab('preview')} className={`flex-1 flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition-colors ${mobileTab === 'preview' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <Eye className="w-6 h-6" />
                    <span className="text-[10px] font-bold">プレビュー</span>
                </button>
            </div>
        </div>
    );
};

export default WritingDesk;


