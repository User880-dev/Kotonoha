import React, { useState, useEffect, useMemo } from 'react';
import { Key, AlertCircle, RefreshCw, X } from 'lucide-react';
import LibraryView from './components/LibraryView.jsx';
import WritingDesk from './components/WritingDesk.jsx';
import ReaderView from './components/ReaderView.jsx';
import { SettingsModal, ImagePreviewModal } from './components/Modals.jsx';
import { generateId } from './utils.js';
import { generateImage } from './api.js';
import { compressImage } from './utils.js';

export default function App() {
    // --- アプリ全体の状態 (State) ---
    const [view, setView] = useState('auth'); // 画面の状態: auth | library | write | read
    const [apiKey, setApiKey] = useState("");
    const [books, setBooks] = useState([]);
    const [activeBookId, setActiveBookId] = useState(null);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    
    // データ読み込み完了フラグ
    const [isReady, setIsReady] = useState(false);

    // --- 初期化処理 ---
    useEffect(() => {
        try {
            const savedBooks = localStorage.getItem('kotonoha_books');
            const savedKey = localStorage.getItem('gemini_api_key');
            
            if (savedBooks) {
                setBooks(JSON.parse(savedBooks));
            }
            
            if (savedKey) {
                setApiKey(savedKey);
                setView('library'); // キーがあれば書庫へ移動
            }
        } catch (e) {
            console.error("初期化エラー:", e);
            setError("データの読み込みに失敗しました。");
        }
        setIsReady(true);
    }, []);

    // --- データ保存処理 ---
    useEffect(() => {
        if (isReady) {
            localStorage.setItem('kotonoha_books', JSON.stringify(books));
        }
    }, [books, isReady]);

    useEffect(() => {
        if (isReady) {
            localStorage.setItem('gemini_api_key', apiKey);
        }
    }, [apiKey, isReady]);

    // --- 共通ヘルパー ---
    const activeBook = useMemo(() => 
        books.find(b => b.id === activeBookId), 
        [books, activeBookId]
    );

    const updateBook = (id, updates) => {
        setBooks(prev => prev.map(b => 
            b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
        ));
    };

    // 書斎の背景（模様替え）機能
    const handleGlobalBackground = async () => {
        setLoading(true);
        try {
            const prompt = "A cozy, warm, magical library with wooden shelves, soft lighting, lots of books, detailed, fantasy art style, 4k";
            const imgBase64 = await generateImage(apiKey, prompt);
            if (imgBase64) {
                const compressed = await compressImage(imgBase64, 800, 0.6);
                // 背景設定はbodyのスタイルに直接適用（簡易実装）
                document.body.style.backgroundImage = `url(${compressed})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundAttachment = 'fixed';
                // LocalStorageにも保存
                localStorage.setItem('kotonoha_bg', compressed);
            }
        } catch (e) {
            setError("模様替えに失敗しました: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // 背景の読み込み
    useEffect(() => {
        const bg = localStorage.getItem('kotonoha_bg');
        if (bg) {
            document.body.style.backgroundImage = `url(${bg})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
        }
    }, []);

    // データのエクスポート（JSON保存）
    const handleExport = () => {
        const data = { 
            books, 
            version: "3.0", 
            exportedAt: new Date().toISOString() 
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kotonoha_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // データのインポート（復元）
    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.books && Array.isArray(data.books)) {
                    if (confirm("現在のデータを上書きして復元しますか？")) {
                        setBooks(data.books);
                        alert("復元しました。");
                        setShowSettings(false);
                    }
                } else {
                    alert("データ形式が正しくありません。");
                }
            } catch (err) {
                alert("ファイルの読み込みに失敗しました。");
            }
        };
        reader.readAsText(file);
    };

    // --- メインレンダリング ---
    
    // 1. 認証画面（APIキー入力）
    if (view === 'auth') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 animate-in bg-indigo-50/80 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <Key size={32} />
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-gray-800 mb-2">言の葉</h1>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        物語を紡ぐための「鍵（APIキー）」を入力してください。キーは安全に端末内に保存されます。
                    </p>
                    <input 
                        type="password" 
                        placeholder="APIキーをここに貼り付け" 
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4 text-center focus:ring-2 focus:ring-indigo-300 outline-none transition-all"
                        onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val) {
                                setApiKey(val);
                                setView('library');
                            }
                        }}
                    />
                    <p className="text-[10px] text-gray-400">※入力後、枠の外をタップして確定</p>
                </div>
            </div>
        );
    }

    // 2. メインアプリ画面
    return (
        <div className="min-h-screen transition-all duration-500">
            {/* 画面ルーティング */}
            {view === 'library' && (
                <LibraryView 
                    books={books}
                    setBooks={setBooks}
                    setActiveBookId={setActiveBookId}
                    setView={setView}
                    handleGlobalBackground={handleGlobalBackground}
                    loading={loading}
                    setLoading={setLoading}
                    setError={setError}
                    apiKey={apiKey}
                    isDeleteMode={isDeleteMode}
                    openSettings={() => setShowSettings(true)}
                />
            )}

            {view === 'write' && (
                <WritingDesk 
                    activeBook={activeBook}
                    updateBook={updateBook}
                    setView={setView}
                    setLoading={setLoading}
                    setError={setError}
                    apiKey={apiKey}
                    setPreviewImage={setPreviewImage}
                />
            )}

            {view === 'read' && (
                <ReaderView 
                    activeBook={activeBook}
                    updateBook={updateBook}
                    setView={setView}
                    setLoading={setLoading}
                    setError={setError}
                    apiKey={apiKey}
                    setPreviewImage={setPreviewImage}
                    openEditor={() => setView('write')}
                />
            )}

            {/* 共通モーダル: 設定画面 */}
            <SettingsModal 
                show={showSettings}
                onClose={() => setShowSettings(false)}
                isDeleteMode={isDeleteMode}
                toggleDeleteMode={() => setIsDeleteMode(!isDeleteMode)}
                stamps={[]} // スタンプ履歴は簡易実装のため空配列
                handleExport={handleExport}
                handleImport={handleImport}
                apiKey={apiKey}
                setApiKey={setApiKey}
                setView={setView}
            />

            {/* 共通モーダル: 画像プレビュー */}
            <ImagePreviewModal 
                image={previewImage} 
                onClose={() => setPreviewImage(null)} 
            />

            {/* 共通パーツ: エラー通知 */}
            {error && (
                <div className="fixed bottom-24 left-4 right-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl z-[300] flex justify-between items-center animate-in">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-xs font-bold leading-tight">{error}</span>
                    </div>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-red-700 rounded">
                        <X className="w-5 h-5"/>
                    </button>
                </div>
            )}

            {/* 共通パーツ: ローディングオーバーレイ */}
            {loading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[500] flex flex-col items-center justify-center animate-in">
                    <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4"/>
                    <span className="text-indigo-800 font-bold text-sm tracking-widest">処理中...</span>
                </div>
            )}
        </div>
    );
}


