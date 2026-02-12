import React, { useState, useEffect, useMemo, useRef } from 'react';
import htm from 'htm';
import * as LucideIcons from 'lucide-react';
import { generateId, pcmToWav, compressImage } from './utils.js';
import { generateStoryText, generateIllustration, generateAudioSpeech } from './api.js';

const html = htm.bind(React.createElement);

export default function App() {
  const { 
    Library, Key, PenTool, Settings, Dice5, X, Plus, AlertCircle, 
    ChevronLeft, Check, Wand2, Edit3, Sparkles, Volume2, Mail, Stamp, Image, RefreshCw
  } = LucideIcons;

  // --- Constants ---
  const RANDOM_WORDS = ["雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車", "図書館", "鍵", "ピアノ", "星空", "迷子", "珈琲", "古書店", "鏡", "青", "記憶", "風船", "花火", "雪"];

  // --- State ---
  const [view, setView] = useState('auth'); 
  const [apiKey, setApiKey] = useState("");
  const [books, setBooks] = useState([]);
  const [activeBookId, setActiveBookId] = useState(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioObj, setAudioObj] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [letter, setLetter] = useState(null);

  // --- Effects ---
  useEffect(() => {
    try {
      const savedBooks = localStorage.getItem('kotonoha_books');
      if (savedBooks) setBooks(JSON.parse(savedBooks));
      
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setView('library');
      }
    } catch (e) {
      console.error(e);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem('kotonoha_books', JSON.stringify(books));
  }, [books, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey, ready]);

  // --- Helpers ---
  const activeBook = useMemo(() => books.find(b => b.id === activeBookId), [books, activeBookId]);

  const updateBook = (id, updates) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b));
  };

  const saveData = () => {
    localStorage.setItem('kotonoha_books', JSON.stringify(books));
  };

  const toggleLoading = (show, text = "") => {
    setLoading(show);
    setLoadingText(text);
  };

  // --- Actions ---
  const saveKey = (val) => {
    const k = val.trim();
    if (k) { setApiKey(k); setView('library'); }
  };

  const createNewBook = () => {
    const id = generateId();
    const newBook = { id, title: "無題の物語", content: "", illustrations: [], stamps: [], updatedAt: Date.now() };
    setBooks([newBook, ...books]);
    setActiveBookId(id);
    setView('editor');
  };

  const startDiceStory = () => {
    const selected = [...RANDOM_WORDS].sort(() => 0.5 - Math.random()).slice(0, 3);
    if (confirm(`お題: 「${selected.join('」「')}」\nこのお題で物語を始めますか？`)) {
        const id = generateId();
        const newBook = { id, title: "三題噺の物語", content: `お題: ${selected.join('、')}\n\n`, illustrations: [], stamps: [], updatedAt: Date.now() };
        setBooks([newBook, ...books]);
        setActiveBookId(id);
        setView('editor');
    }
  };

  const deleteBook = (id) => {
    if (window.confirm("この物語を永遠に葬りますか？")) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  const handleAIWrite = async (type, prompt) => {
    toggleLoading(true, "AIが執筆しています...");
    try {
        const userPrompt = type === 'new' ? `指示: ${prompt}` : `以下の続きを書いてください:\n${activeBook.content.slice(-800)}`;
        const text = await generateStoryText(apiKey, userPrompt);
        updateBook(activeBookId, { content: type === 'new' ? text : activeBook.content + "\n\n" + text });
    } catch (e) { alert(e.message); }
    toggleLoading(false);
  };

  const handleAIImage = async () => {
    toggleLoading(true, "挿絵を描いています...");
    try {
        const illId = generateId();
        const b64 = await generateIllustration(apiKey, `${activeBook.content.slice(-300)}の挿絵、水彩画、情緒的`);
        if (b64) {
            updateBook(activeBookId, { 
                illustrations: [...activeBook.illustrations, { id: illId, data: b64 }],
                content: activeBook.content + `\n\n[挿絵:${illId}]\n\n`
            });
        }
    } catch (e) { alert(e.message); }
    toggleLoading(false);
  };

  const handleTTS = async () => {
    if (isPlaying) { audioObj.pause(); setIsPlaying(false); return; }
    toggleLoading(true, "声を生成しています...");
    try {
        const b64 = await generateAudioSpeech(apiKey, activeBook.content.slice(0, 1000));
        if (b64) {
            const url = pcmToWav(b64);
            const audio = new Audio(url);
            setAudioObj(audio);
            audio.play();
            setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
        }
    } catch (e) { alert(e.message); }
    toggleLoading(false);
  };

  const handleFanLetter = async () => {
    toggleLoading(true, "手紙を待っています...");
    try {
        const text = await generateStoryText(apiKey, `この小説への心温まるファンレターを1通書いてください:\n${activeBook.content.slice(0, 500)}`);
        setLetter(text);
    } catch (e) { alert(e.message); }
    toggleLoading(false);
  };

  const addStamp = () => {
    const texts = ["秀逸", "感動", "尊い", "続き希望", "天才"];
    const s = { text: texts[Math.floor(Math.random() * texts.length)], x: (Math.random() * 80 + 10) + '%', y: (Math.random() * 80 + 10) + '%' };
    updateBook(activeBookId, { stamps: [...activeBook.stamps, s] });
  };

  // --- View Components ---

  const AuthView = () => html`
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6 animate-in">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <${Key} size=${32} />
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-800 mb-2">言の葉</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">物語を紡ぐための「鍵（APIキー）」を入力してください。</p>
        <input type="password" placeholder="APIキーを貼り付け" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4 text-center focus:ring-2 focus:ring-indigo-300 outline-none" onBlur=${(e) => saveKey(e.target.value)} />
      </div>
    </div>
  `;

  const LibraryView = () => html`
    <div className="min-h-screen bg-gray-100 pb-24 animate-in overflow-y-auto no-scrollbar">
      <div className="p-6 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm sticky top-4 z-10 safe-area-pt">
          <h1 className="text-2xl font-serif font-bold text-gray-800 flex items-center gap-2"><${Library} className="text-indigo-600" />言の葉書庫</h1>
          <div className="flex gap-2">
            <button onClick=${startDiceStory} className="p-2 bg-indigo-50 text-indigo-600 rounded-full active:scale-90"><${Dice5} size=${20} /></button>
            <button onClick=${() => setShowSettings(true)} className="p-2 bg-gray-100 rounded-full active:scale-90"><${Settings} size=${20} /></button>
          </div>
        </header>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div onClick=${createNewBook} className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-white/50 text-indigo-600 active:scale-95 shadow-sm">
            <${Plus} size=${40} className="mb-2" />
            <span className="text-xs font-bold font-serif">新しく紡ぐ</span>
          </div>
          ${books.map(book => html`
            <div key=${book.id} onClick=${() => { setActiveBookId(book.id); setView('reader'); }} className="aspect-[2/3] bg-white rounded-2xl shadow-md border-l-8 border-gray-800 p-4 relative overflow-hidden active:scale-95">
              <span className="font-serif text-lg leading-relaxed writing-vertical h-full block">${book.title}</span>
              ${isDeleteMode && html`
                <button onClick=${(e) => { e.stopPropagation(); deleteBook(book.id); }} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg z-20"><${X} size=${16} /></button>
              `}
            </div>
          `)}
        </div>
      </div>
    </div>
  `;

  const EditorView = () => {
    const [prompt, setPrompt] = useState("");
    const [tab, setTab] = useState('write');
    return html`
      <div className="flex flex-col h-screen bg-white overflow-hidden animate-in">
        <div className="h-14 border-b flex items-center px-4 justify-between bg-white shrink-0 safe-area-pt">
          <button onClick=${() => setView('library')} className="p-2"><${ChevronLeft} /></button>
          <input value=${activeBook.title} onChange=${(e) => updateBook(activeBookId, { title: e.target.value })} className="flex-1 text-center font-bold font-serif outline-none mx-2 text-lg truncate" />
          <button onClick=${() => setView('library')} className="text-indigo-600 p-2 font-bold"><${Check} /></button>
        </div>
        <div className="flex-1 relative overflow-hidden">
          ${tab === 'write' ? html`
            <textarea value=${activeBook.content} onChange=${(e) => updateBook(activeBookId, { content: e.target.value })} className="w-full h-full p-6 font-serif text-lg leading-loose outline-none pb-24" placeholder="ここに物語を..." />
          ` : html`
            <div className="p-4 space-y-4 h-full bg-gray-50 overflow-y-auto pb-24">
              <div className="bg-white p-5 rounded-2xl shadow-sm border">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-600"><${Sparkles} size=${16} /> AI執筆・挿絵</h3>
                <textarea value=${prompt} onChange=${(e) => setPrompt(e.target.value)} placeholder="「雪の日の出会い」など指示..." className="w-full p-4 bg-gray-50 border rounded-xl h-24 mb-4 text-sm" />
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick=${() => handleAIWrite('new', prompt)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-sm shadow-md">新しく書く</button>
                    <button onClick=${() => handleAIWrite('cont')} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-md">続きを書く</button>
                  </div>
                  <button onClick=${handleAIImage} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"><${Image} size=${16} /> 挿絵を描画</button>
                </div>
              </div>
            </div>
          `}
        </div>
        <div className="h-16 border-t flex items-center justify-around bg-white shrink-0 safe-area-pb">
          <button onClick=${() => setTab('tools')} className=${`flex flex-col items-center gap-1 flex-1 ${tab === 'tools' ? 'text-indigo-600' : 'text-gray-400'}`}><${Wand2} size=${20} /><span className="text-[9px] font-bold">ツール</span></button>
          <button onClick=${() => setTab('write')} className=${`flex flex-col items-center gap-1 flex-1 ${tab === 'write' ? 'text-indigo-600' : 'text-gray-400'}`}><${Edit3} size=${20} /><span className="text-[9px] font-bold">執筆</span></button>
        </div>
      </div>
    `;
  };

  const ReaderView = () => html`
    <div className="h-screen flex flex-col bg-[#fdfbf7] overflow-hidden animate-in">
      <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth relative">
        <div className="writing-vertical font-serif h-full">
          <h1 className="text-3xl font-bold ml-12 mt-12 mb-10">${activeBook.title}</h1>
          ${activeBook.content.split(/\[挿絵:(.+?)\]/g).map((part, i) => {
            if (i % 2 === 0) return html`<div className="whitespace-pre-wrap text-justify h-full leading-loose text-xl ml-4">${part}</div>`;
            const img = activeBook.illustrations.find(ill => ill.id === part);
            return img && html`
              <div className="inline-block mx-4 my-4 p-2 bg-white shadow-lg border" style=${{writingMode:'horizontal-tb'}} onClick=${() => setPreviewImg(img.data)}>
                <img src=${img.data} className="max-w-[65vw] max-h-[50vh] object-contain" />
              </div>
            `;
          })}
        </div>
        <div className="absolute inset-0 pointer-events-none">
          ${activeBook.stamps.map((s, i) => html`
            <div key=${i} className="absolute opacity-80 stamp-anim" style=${{top: s.y, left: s.x, writingMode: 'horizontal-tb'}}>
              <div className="bg-red-50 border-2 border-red-600 text-red-600 px-3 py-1 rounded-full font-bold transform -rotate-12 border-dashed text-xs">${s.text}</div>
            </div>
          `)}
        </div>
      </div>
      <div className="h-16 border-t bg-white/90 backdrop-blur-md flex items-center justify-around shrink-0 safe-area-pb z-40">
        <button onClick=${() => setView('library')} className="text-gray-500 flex flex-col items-center gap-1 flex-1"><${Library} size=${20}/><span className="text-[8px] font-bold">書庫</span></button>
        <button onClick=${handleTTS} className=${`flex flex-col items-center gap-1 flex-1 ${isPlaying ? 'text-indigo-600' : 'text-gray-500'}`}><${Volume2} size=${20}/><span className="text-[8px] font-bold">朗読</span></button>
        <button onClick=${handleFanLetter} className="text-gray-500 flex flex-col items-center gap-1 flex-1"><${Mail} size=${20}/><span className="text-[8px] font-bold">手紙</span></button>
        <button onClick=${addStamp} className="text-gray-500 flex flex-col items-center gap-1 flex-1"><${Stamp} size=${20}/><span className="text-[8px] font-bold">刻印</span></button>
        <button onClick=${() => setView('editor')} className="text-gray-500 flex flex-col items-center gap-1 flex-1"><${Edit3} size=${20}/><span className="text-[8px] font-bold">編集</span></button>
      </div>
    </div>
  `;

  // --- Render ---

  if (!ready) return null;

  return html`
    <div className="min-h-screen text-gray-900">
      ${view === 'auth' && html`<${AuthView} />`}
      ${view === 'library' && html`<${LibraryView} />`}
      ${view === 'editor' && html`<${EditorView} />`}
      ${view === 'reader' && html`<${ReaderView} />`}

      ${showSettings && html`
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick=${() => setShowSettings(false)}>
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl" onClick=${e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><${Settings} className="text-indigo-600" />設定</h3>
            <div className="space-y-4">
              <button onClick=${() => setIsDeleteMode(!isDeleteMode)} className="w-full py-4 px-4 bg-gray-50 rounded-2xl flex justify-between items-center font-bold text-sm">作品削除モード <span className=${isDeleteMode ? 'text-red-500':'text-gray-400'}>${isDeleteMode?'ON':'OFF'}</span></button>
              <button onClick=${() => { localStorage.clear(); location.reload(); }} className="w-full py-3 text-red-600 text-xs font-bold border border-red-100 rounded-xl">リセット</button>
            </div>
            <button onClick=${() => setShowSettings(false)} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">閉じる</button>
          </div>
        </div>
      `}

      ${loading && html`
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-[500] text-white">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
          <span className="font-bold text-sm">${loadingText}</span>
        </div>
      `}

      ${previewImg && html`
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4" onClick=${() => setPreviewImg(null)}>
          <img src=${previewImg} className="max-w-full max-h-full object-contain rounded shadow-2xl" />
        </div>
      `}

      ${letter && html`
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[550] flex items-center justify-center p-6" onClick=${() => setLetter(null)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full font-serif italic text-gray-800 leading-relaxed" onClick=${e => e.stopPropagation()}>
            <div className="mb-4 text-indigo-600"><${Mail} size=${32} /></div>
            <div className="whitespace-pre-wrap">${letter}</div>
            <button onClick=${() => setLetter(null)} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">心に刻む</button>
          </div>
        </div>
      `}
    </div>
  `;
}

