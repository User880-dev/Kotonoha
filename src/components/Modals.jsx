import React from 'react';
import { Settings, X, Stamp, Download, Upload, RotateCcw, Book, Mail, RefreshCw } from 'lucide-react';
import { generateId } from '../utils.js';
import { generateStoryText } from '../api.js';

// 設定モーダル
export const SettingsModal = ({ show, onClose, isDeleteMode, toggleDeleteMode, stamps, handleExport, handleImport, apiKey, setApiKey, setView }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 font-serif">
                        <Settings className="text-indigo-600 w-5 h-5"/>設定
                    </h3>
                    <button onClick={onClose}><X className="text-gray-400"/></button>
                </div>
                
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {/* スタンプカード */}
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <h4 className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1"><Stamp className="w-3 h-3"/> 執筆スタンプ</h4>
                        <div className="grid grid-cols-7 gap-2">
                            {[...Array(28)].map((_, i) => {
                                const d = new Date();
                                d.setDate(d.getDate() - (27 - i));
                                const dateStr = d.toISOString().split('T')[0];
                                const hasStamp = stamps.includes(dateStr);
                                return (
                                    <div key={i} className={`aspect-square rounded-full flex items-center justify-center text-[8px] border ${hasStamp ? 'bg-indigo-500 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-300'}`}>
                                        {hasStamp ? '済' : d.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* データ管理 */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 mb-2">データ管理</h4>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className="flex-1 py-2 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-xs hover:bg-gray-100">
                                <Download className="w-4 h-4 mb-1"/> バックアップ保存
                            </button>
                            <label className="flex-1 py-2 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-xl text-xs hover:bg-gray-100 cursor-pointer">
                                <Upload className="w-4 h-4 mb-1"/> データ復元
                                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                            </label>
                        </div>
                    </div>

                    {/* 削除モード */}
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span className="text-sm font-bold text-gray-700">作品削除モード</span>
                        <button onClick={toggleDeleteMode} className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isDeleteMode ? 'bg-red-500' : 'bg-gray-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-md transition-all duration-300 ${isDeleteMode ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* リセット */}
                    <div className="pt-4 border-t space-y-2">
                        <button onClick={() => { if(confirm("APIキーを消去してログアウトしますか？")) { setApiKey(""); localStorage.removeItem('gemini_api_key'); setView('auth'); onClose(); } }} className="w-full py-2 text-red-600 text-xs font-bold border border-red-100 rounded-lg hover:bg-red-50">
                            APIキーをリセット
                        </button>
                        <button onClick={() => { if(confirm("【警告】すべてのデータを完全に削除します。よろしいですか？")) { localStorage.clear(); location.reload(); } }} className="w-full py-2 text-gray-400 text-[10px] flex items-center justify-center gap-1 hover:text-red-500">
                            <RotateCcw className="w-3 h-3"/> アプリを完全初期化
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 画像プレビューモーダル
export const ImagePreviewModal = ({ image, onClose }) => {
    if (!image) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[600] flex items-center justify-center p-4 animate-in" onClick={onClose}>
            <img src={image} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            <button className="absolute top-6 right-6 text-white bg-white/20 p-3 rounded-full backdrop-blur-md"><X className="w-6 h-6"/></button>
        </div>
    );
};

// ファンレターモーダル
export const FanLetterModal = ({ letter, onClose }) => {
    if (!letter) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[550] flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-[#fffcf5] p-8 rounded-3xl shadow-2xl max-w-sm w-full font-serif text-gray-800 leading-relaxed italic relative animate-in border border-stone-200" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-t-3xl"></div>
                <div className="mb-6 text-indigo-600 flex justify-center"><Mail className="w-10 h-10"/></div>
                <div className="whitespace-pre-wrap max-h-[50vh] overflow-y-auto p-2">{letter}</div>
                <button onClick={onClose} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-transform">心に刻む</button>
            </div>
        </div>
    );
};

// 青空文庫インポートモーダル
export const AozoraModal = ({ onClose, onImport, loading }) => {
    const classics = [
        { title: "吾輩は猫である", author: "夏目漱石" },
        { title: "こころ", author: "夏目漱石" },
        { title: "銀河鉄道の夜", author: "宮沢賢治" },
        { title: "注文の多い料理店", author: "宮沢賢治" },
        { title: "走れメロス", author: "太宰治" },
        { title: "人間失格", author: "太宰治" },
        { title: "舞姫", author: "森鴎外" },
        { title: "羅生門", author: "芥川龍之介" },
        { title: "手袋を買いに", author: "新美南吉" },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2"><Book className="w-5 h-5 text-indigo-600"/> 名作を取り込む</h2>
                <p className="text-xs text-gray-500 mb-4">AIが名作の冒頭を再現してライブラリに追加します。</p>
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    {classics.map((c, i) => (
                        <button 
                            key={i} 
                            onClick={() => onImport(c)} 
                            disabled={loading}
                            className="w-full text-left p-3 hover:bg-indigo-50 border border-gray-100 rounded-lg group transition-all hover:border-indigo-200 disabled:opacity-50"
                        >
                            <div className="font-bold text-base font-serif group-hover:text-indigo-700">{c.title}</div>
                            <div className="text-xs text-gray-500">{c.author}</div>
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="mt-4 w-full p-3 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold">閉じる</button>
            </div>
        </div>
    );
};


