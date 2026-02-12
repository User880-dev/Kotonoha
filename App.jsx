import React, { useState, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { generateId } from './utils.js';

/**
 * App Component
 */
export default function App() {
  // --- アイコンの取得 ---
  const { 
    Library, Key, PenTool, Settings, 
    Dice5, X, Plus, AlertCircle 
  } = LucideIcons;

  // --- 状態管理 (State) ---
  const [view, setView] = useState('auth'); 
  const [apiKey, setApiKey] = useState("");
  const [books, setBooks] = useState([]);
  const [activeBookId, setActiveBookId] = useState(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // --- 初期化 (Effect) ---
  useEffect(() => {
    // データの読み込み
    try {
      const savedBooks = localStorage.getItem('kotonoha_books');
      if (savedBooks) {
        setBooks(JSON.parse(savedBooks));
      }
      
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setView('library');
      }
    } catch (e) {
      console.error("Data load error", e);
    }
    setAppReady(true);
  }, []);

  // データ保存
  useEffect(() => {
    if (appReady) {
      localStorage.setItem('kotonoha_books', JSON.stringify(books));
    }
  }, [books, appReady]);

  useEffect(() => {
    if (appReady) {
      localStorage.setItem('gemini_api_key', apiKey);
    }
  }, [apiKey, appReady]);

  // --- アクション ---
  const saveKey = (key) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      setApiKey(trimmedKey);
      setView('library');
    }
  };

  const createNewBook = () => {
    const id = generateId();
    const newBook = {
      id,
      title: "無題の物語",
      content: "",
      illustrations: [],
      stamps: [],
      updatedAt: Date.now()
    };
    setBooks([newBook, ...books]);
    setActiveBookId(id);
    setView('editor');
  };

  const deleteBook = (id) => {
    if (window.confirm("この物語を永遠に葬りますか？")) {
      setBooks(books.filter(b => b.id !== id));
    }
  };

  // --- サブビュー ---

  /** 認証画面 */
  const AuthView = () => (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6 animate-in">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Key size={32} />
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-800 mb-2">言の葉</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          物語を紡ぐための「鍵（APIキー）」を入力してください。
        </p>
        <input 
          type="password" 
          placeholder="APIキーを貼り付け" 
          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4 text-center focus:ring-2 focus:ring-indigo-300 outline-none"
          onBlur={(e) => saveKey(e.target.value)}
        />
        <p className="text-[10px] text-gray-400">※入力後に枠の外をタップして確定してください</p>
      </div>
    </div>
  );

  /** 書庫画面 */
  const LibraryView = () => (
    <div className="min-h-screen bg-gray-100 pb-24 animate-in">
      <div className="p-6 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm sticky top-4 z-10 safe-area-pt">
          <h1 className="text-2xl font-serif font-bold text-gray-800 flex items-center gap-2">
            <Library className="text-indigo-600" />言の葉書庫
          </h1>
          <button 
            onClick={() => setShowSettings(true)} 
            className="p-2 bg-gray-100 rounded-full active:scale-90 transition-transform"
          >
            <Settings className="text-gray-600" />
          </button>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <div 
            onClick={createNewBook}
            className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-white/50 text-indigo-600 active:scale-95 transition-all shadow-sm"
          >
            <Plus size={40} className="mb-2" />
            <span className="text-xs font-bold font-serif">新しく紡ぐ</span>
          </div>

          {books.map(book => (
            <div 
              key={book.id} 
              onClick={() => {
                setActiveBookId(book.id);
                setView('reader');
              }}
              className="aspect-[2/3] bg-white rounded-2xl shadow-md border-l-8 border-gray-800 p-4 relative overflow-hidden active:scale-95 transition-all"
            >
              <span className="font-serif text-lg leading-relaxed writing-vertical h-full block">
                {book.title}
              </span>
              
              {isDeleteMode && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBook(book.id);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg z-20"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {books.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <Dice5 size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-serif">まだ物語がありません</p>
          </div>
        )}
      </div>
    </div>
  );

  // --- メインレンダリング ---
  if (!appReady) return null;

  return (
    <div className="min-h-screen text-gray-900">
      {view === 'auth' && <AuthView />}
      {view === 'library' && <LibraryView />}
      
      {(view === 'editor' || view === 'reader') && (
        <div className="flex flex-col h-screen items-center justify-center bg-white p-10 text-center animate-in">
          <AlertCircle size={48} className="text-indigo-600 mb-4" />
          <h2 className="text-xl font-bold mb-2">画面を準備中...</h2>
          <p className="text-gray-500 mb-6 text-sm">
            土台は成功しました！次はエディタ機能を追加します。
          </p>
          <button 
            onClick={() => setView('library')}
            className="px-6 py-2 bg-gray-100 rounded-full font-bold"
          >
            戻る
          </button>
        </div>
      )}

      {/* 設定モーダル */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
          onClick={() => setShowSettings(false)}
        >
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="text-indigo-600" /> 設定
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                <span className="text-sm font-bold text-gray-700">削除モード</span>
                <button 
                  onClick={() => setIsDeleteMode(!isDeleteMode)}
                  className={`w-14 h-7 rounded-full relative transition-colors duration-300 ${isDeleteMode ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-1 shadow-md transition-all duration-300 ${isDeleteMode ? 'left-8' : 'left-1'}`} />
                </button>
              </div>
              <button 
                onClick={() => {
                  if(window.confirm("APIキーを消去してログアウトしますか？")) {
                    setApiKey("");
                    localStorage.removeItem('gemini_api_key');
                    setView('auth');
                    setShowSettings(false);
                  }
                }}
                className="w-full py-3 text-red-600 text-xs font-bold border border-red-100 rounded-xl"
              >
                APIキーをリセット
              </button>
            </div>
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

