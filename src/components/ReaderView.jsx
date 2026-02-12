import React, { useState, useRef } from 'react';
import { Library, Quote, Headphones, MessageCircle, X, ChevronLeft, Play, Pause, RefreshCw, Volume2, Mail, Stamp, Edit3 } from 'lucide-react';
import { generateStoryText, generateAudioSpeech } from '../api.js';
import { pcmToWav, createQuoteCard } from '../utils.js';
import VerticalTextDisplay from './VerticalTextDisplay.jsx';
import { FanLetterModal } from './Modals.jsx';

const ReaderView = ({ 
    activeBook, updateBook, setView, setLoading, setError, apiKey, 
    setPreviewImage, openEditor 
}) => {
    if (!activeBook) return null;

    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState(activeBook.chatHistory || []);
    
    const [showFanLetter, setShowFanLetter] = useState(false);
    const [letterContent, setLetterContent] = useState("");
    
    const audioRef = useRef(null);

    // AI朗読
    const handleTTS = async () => {
        if (isPlaying) { 
            audioRef.current.pause(); 
            setIsPlaying(false); 
            return; 
        }
        if (audioUrl) { 
            audioRef.current.play(); 
            setIsPlaying(true); 
            return; 
        }
        setLoading(true);
        try {
            // 挿絵タグ除去
            const cleanText = activeBook.content.replace(/\[挿絵:.+?\]/g, "");
            const pcm = await generateAudioSpeech(apiKey, cleanText.slice(0, 2000));
            if (pcm) {
                const url = pcmToWav(pcm);
                setAudioUrl(url);
                setTimeout(() => { 
                    if(audioRef.current){ 
                        audioRef.current.src = url; 
                        audioRef.current.play(); 
                        setIsPlaying(true); 
                    }
                }, 100);
            }
        } catch (e) { 
            setError("朗読エラー: " + e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    // AIチャット
    const handleChat = async () => {
        if (!chatInput.trim()) return;
        const newMsg = { role: 'user', text: chatInput };
        const updatedMessages = [...messages, newMsg];
        setMessages(updatedMessages);
        setChatInput("");
        try {
            const res = await generateStoryText(apiKey, `あなたは作品「${activeBook.title}」の作者、または登場人物です。読者に情緒的に答えてください。本文要約: ${activeBook.content.slice(0, 500)}`, chatInput);
            const finalMessages = [...updatedMessages, { role: 'model', text: res }];
            setMessages(finalMessages);
            updateBook(activeBook.id, { chatHistory: finalMessages });
        } catch (e) { 
            setError("対話エラー: " + e.message); 
        }
    };

    // ファンレター受信
    const handleFanLetter = async () => {
        setLoading(true);
        try {
            const res = await generateStoryText(apiKey, `この小説を読んだファンとして、心温まる短いファンレターを1通書いてください:\n\n${activeBook.content.slice(0, 500)}`);
            setLetterContent(res);
            setShowFanLetter(true);
        } catch (e) {
            setError("手紙エラー: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // スタンプを押す
    const addStamp = () => {
        const texts = ["秀逸", "感動", "尊い", "天才", "続き希望"];
        const t = texts[Math.floor(Math.random() * texts.length)];
        const newStamp = { 
            text: t, 
            x: Math.random() * 70 + 10 + '%', 
            y: Math.random() * 70 + 10 + '%' 
        };
        const newStamps = [...(activeBook.stamps || []), newStamp];
        updateBook(activeBook.id, { stamps: newStamps });
    };

    // 名文カード作成
    const handleQuote = async () => {
        const selection = window.getSelection().toString();
        if(!selection) { 
            alert("カードにしたい文章を長押しで選択してから押してください。"); 
            return; 
        }
        setLoading(true);
        try {
            const url = await createQuoteCard(selection, activeBook.title, activeBook.author || "私", activeBook.cover);
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = `quote_${Date.now()}.png`; 
            a.click();
        } catch(e) { 
            setError("カード作成エラー: " + e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[#fdfbf7] overflow-hidden animate-in">
            {/* 本文エリア */}
            <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth relative w-full">
                <VerticalTextDisplay 
                    title={activeBook.title}
                    content={activeBook.content}
                    illustrations={activeBook.illustrations}
                    stamps={activeBook.stamps}
                    setPreviewImage={setPreviewImage}
                />
            </div>

            {/* メニューバー */}
            <div className="h-16 border-t bg-white/90 backdrop-blur-md flex items-center justify-around shrink-0 safe-area-pb z-40">
                <button onClick={() => setView('library')} className="text-gray-500 flex flex-col items-center gap-1 flex-1 active:bg-gray-100 h-full justify-center">
                    <Library className="w-5 h-5"/><span className="text-[9px] font-bold">書庫</span>
                </button>
                <button onClick={handleTTS} className={`flex flex-col items-center gap-1 flex-1 active:bg-gray-100 h-full justify-center ${isPlaying ? 'text-indigo-600' : 'text-gray-500'}`}>
                    <Volume2 className="w-5 h-5"/><span className="text-[9px] font-bold">朗読</span>
                </button>
                <button onClick={handleFanLetter} className="text-gray-500 flex flex-col items-center gap-1 flex-1 active:bg-gray-100 h-full justify-center">
                    <Mail className="w-5 h-5"/><span className="text-[9px] font-bold">手紙</span>
                </button>
                <button onClick={addStamp} className="text-gray-500 flex flex-col items-center gap-1 flex-1 active:bg-gray-100 h-full justify-center">
                    <Stamp className="w-5 h-5"/><span className="text-[9px] font-bold">刻印</span>
                </button>
                <button onClick={() => setView('write')} className="text-gray-500 flex flex-col items-center gap-1 flex-1 active:bg-gray-100 h-full justify-center">
                    <Edit3 className="w-5 h-5"/><span className="text-[9px] font-bold">編集</span>
                </button>
            </div>

            {/* 音声再生用 */}
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} hidden />

            {/* チャット画面 */}
            {showChat && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex justify-end animate-in" onClick={() => setShowChat(false)}>
                    <div className="w-full md:w-80 bg-white h-full shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <span className="font-bold text-gray-700">読者チャット</span>
                            <button onClick={() => setShowChat(false)} className="p-2"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800'}`}>
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t flex gap-2 bg-white safe-area-pb">
                            <input 
                                value={chatInput} 
                                onChange={e => setChatInput(e.target.value)} 
                                onKeyPress={e => e.key === 'Enter' && handleChat()}
                                className="flex-1 border rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" 
                                placeholder="感想や質問..." 
                            />
                            <button onClick={handleChat} className="bg-indigo-600 text-white p-3 rounded-full active:scale-95 transition-transform">
                                <ChevronLeft className="rotate-180 w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* チャットボタン（画面右下に浮遊） */}
            {!showChat && (
                <button 
                    onClick={() => setShowChat(true)}
                    className="fixed bottom-24 right-4 bg-white text-indigo-600 p-4 rounded-full shadow-xl border border-indigo-100 z-30 active:scale-90 transition-transform"
                >
                    <MessageCircle className="w-6 h-6" />
                </button>
            )}

            {/* ファンレターモーダル */}
            <FanLetterModal 
                letter={letterContent} 
                onClose={() => setShowFanLetter(false)} 
            />
        </div>
    );
};

export default ReaderView;


