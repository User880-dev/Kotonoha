import React from 'react';

const VerticalTextDisplay = ({ title, content, illustrations, stamps, setPreviewImage }) => {
    
    // 本文と挿絵を解析してレンダリングする関数
    const renderContent = () => {
        const text = content || "";
        // [挿絵:ID] で分割
        const parts = text.split(/\[挿絵:(.+?)\]/g);
        
        return parts.map((part, i) => {
            // 偶数番目はテキスト、奇数番目はID
            if (i % 2 === 0) {
                return <span key={i}>{part}</span>;
            } else {
                const imgData = illustrations?.find(img => img.id === part);
                if (imgData) {
                    return (
                        <div 
                            key={i} 
                            className="inline-block mx-4 align-middle my-4 p-2 bg-white shadow-md border cursor-pointer hover:opacity-90 transition-opacity" 
                            style={{ writingMode: 'horizontal-tb' }} 
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(imgData.data);
                            }}
                        >
                            <img src={imgData.data} alt="挿絵" className="max-w-[65vw] max-h-[50vh] object-contain" />
                        </div>
                    );
                }
                return <span key={i} className="text-xs text-gray-400 select-none">[挿絵なし]</span>;
            }
        });
    };

    return (
        <div className="h-full font-serif text-lg leading-loose text-gray-800 py-12 px-8 writing-vertical relative" 
             style={{ columnGap: '2.5rem', height: '100%', minWidth: '100vw' }}>
            
            {/* タイトル */}
            <h1 className="font-bold text-2xl ml-10 mt-10 mb-8 select-none border-t-2 border-gray-800 pt-4 inline-block">
                {title}
            </h1>
            
            {/* 本文 */}
            <div className="whitespace-pre-wrap text-justify h-full ml-4">
                {renderContent()}
            </div>

            {/* スタンプ（絶対配置） */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {stamps && stamps.map((s, i) => (
                    <div 
                        key={i} 
                        className="absolute opacity-80 stamp-anim" 
                        style={{ top: s.y, left: s.x, writingMode: 'horizontal-tb' }}
                    >
                        <div className="bg-red-50 border-2 border-red-600 text-red-600 px-3 py-1 rounded-full font-bold transform -rotate-12 border-dashed text-sm shadow-sm">
                            {s.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VerticalTextDisplay;


