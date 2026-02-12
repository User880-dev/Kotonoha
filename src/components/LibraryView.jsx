import React, { useState } from 'react';
import { Library, Settings, Search, RefreshCw, Image as ImageIcon, PenTool, Dice5, X } from 'lucide-react';
import { generateId } from '../utils.js';
import { AozoraModal } from './Modals.jsx';

// 三題噺の単語リスト（定数）
const RANDOM_WORDS = ["雨宿り", "懐中時計", "秘密", "猫", "手紙", "魔法", "嘘", "約束", "桜", "夜行列車", "図書館", "鍵", "ピアノ", "星空", "迷子", "珈琲", "古書店", "鏡", "青", "記憶", "風船", "写真", "月", "金魚", "影", "電話", "屋上", "ソーダ水", "花火", "雪"];

const LibraryView = ({ 
    books, setBooks, setActiveBookId, setView, 
    handleGlobalBackground, loading, setLoading, setError, apiKey, 
    isDeleteMode, openSettings 
}) => {
    const [showAozora, setShowAozora] = useState(false);

    // 新規作成
    const createNewBook = () => {
        const id = generateId();
        const newBook = { 
            id, 
            title: "無題の物語", 
            content: "", 
            genre: "未設定", 
            createdAt: Date.now(), 
            illustrations: [], 
            stamps: [] 
        };
        setBooks([newBook, ...books]);
        setActiveBookId(id);
        setView('write');
    };

    // 三題噺スタート
    const startDiceStory = () => {
        const shuffled = [...RANDOM_WORDS].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        
        if (confirm(`【本日のお題】\n「${selected.join('」「')}」\n\nこのお題で物語を書き始めますか？`)) {
            const id = generateId();
            const newBook = {
                id,
                title: "三題噺の物語",
                content: `お題: ${selected.join('、')}\n\n`,
                genre: "三題噺",
                createdAt: Date.now(),
                illustrations: [],
                stamps: []
            };
            setBooks([newBook, ...books]);
            setActiveBookId(id);
            setView('write');
        }
    };

    // 本の削除
    const deleteBook = (e, id) => {
        e.stopPropagation();
        if (confirm("この物語を完全に削除しますか？\n（復元できません）")) {
            setBooks(books.filter(b => b.id !== id));
        }
    };

    // 青空文庫インポート処理
    const handleImportAozora = async (item) => {
        setLoading(true);
        try {
            // APIを使って冒頭を取得する（api.jsの関数を使うのが理想だが、ここでは簡易的にimportして使う想定）
            const { generateStoryText } = await import('../api.js');
            const prompt = `青空文庫の作品『${item.title}』（著：${item.author}）の冒頭から可能な限り長く（約3000文字程度）正確な本文を出力してください。解説は不要です。`;
            const content = await generateStoryText(apiKey, prompt);
            
            const newBook = {
                id: generateId(),
                title: item.title,
                content: content,
                genre: "純文学",
                createdAt: Date.now(),
                illustrations: [],
                stamps: [],
                author: item.author
            };
            setBooks([newBook, ...books]);
            setActiveBookId(newBook.id);
            setView('read');
            setShowAozora(false);
        } catch (e) {
            setError("インポートに失敗しました: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto min-h-screen pb-24 animate-in">
            {/* ヘッダー */}
            <header className="flex justify-between items-center mb-10 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm sticky top-4 z-10 safe-area-pt">
                <h1 className="text-2xl font-serif font-bold text-gray-800 flex items-center gap-2 select-none">
                    <Library className="text-indigo-600 w-6 h-6" />言の葉書庫
                </h1>
                <div className="flex gap-2">
                    <button onClick={startDiceStory} className="p-2 bg-indigo-50 text-indigo-600 rounded-full active:scale-90 transition-transform shadow-sm" title="三題噺">
                        <Dice5 className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowAozora(true)} className="p-2 bg-gray-50 text-gray-600 rounded-full active:scale-90 transition-transform shadow-sm" title="名作を探す">
                        <Search className="w-5 h-5" />
                    </button>
                    <button onClick={handleGlobalBackground} className="p-2 bg-gray-50 text-gray-600 rounded-full active:scale-90 transition-transform shadow-sm" title="模様替え">
                        {loading ? <RefreshCw className="animate-spin w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={openSettings} className="p-2 bg-gray-100 text-gray-600 rounded-full active:scale-90 transition-transform shadow-sm">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* 本棚グリッド */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {/* 新規作成ボタン */}
                <div 
                    onClick={createNewBook}
                    className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center bg-white/50 text-indigo-600 active:scale-95 transition-all shadow-sm cursor-pointer hover:bg-white hover:border-indigo-300"
                >
                    <PenTool className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-xs font-bold font-serif">新しく紡ぐ</span>
                </div>

                {/* 本のリスト */}
                {books.map(book => (
                    <div 
                        key={book.id} 
                        onClick={() => { setActiveBookId(book.id); setView('read'); }}
                        className="aspect-[2/3] bg-white rounded-2xl shadow-md border-l-8 border-gray-800 p-4 relative overflow-hidden active:scale-95 transition-all cursor-pointer group hover:shadow-xl"
                    >
                        <span className="font-serif text-lg leading-relaxed writing-vertical h-full block select-none pointer-events-none">
                            {book.title}
                        </span>
                        
                        {/* 削除ボタン */}
                        {isDeleteMode && (
                            <button 
                                onClick={(e) => deleteBook(e, book.id)}
                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg z-20 animate-in"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        
                        {/* ジャンルタグ */}
                        <div className="absolute bottom-2 left-2 text-[8px] text-gray-400 bg-gray-100 px-1 rounded">
                            {book.genre?.split('（')[0] || ""}
                        </div>
                    </div>
                ))}
            </div>

            {/* 青空文庫モーダル */}
            {showAozora && (
                <AozoraModal 
                    onClose={() => setShowAozora(false)} 
                    onImport={handleImportAozora} 
                    loading={loading} 
                />
            )}
        </div>
    );
};

export default LibraryView;


