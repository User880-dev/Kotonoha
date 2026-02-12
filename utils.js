/**
 * ユニークなIDを生成します（本や挿絵の識別用）
 */
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * AIから届く音声データ(PCM16)を、ブラウザで再生可能なWAV形式に変換します
 */
export const pcmToWav = (base64PCM) => {
    const binaryString = window.atob(base64PCM);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFFヘッダー
    const writeString = (v, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            v.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM形式
    view.setUint16(22, 1, true); // モノラル
    view.setUint32(24, 24000, true); // サンプルレート
    view.setUint32(28, 24000 * 2, true); // バイトレート
    view.setUint16(32, 2, true); // ブロック境界
    view.setUint16(34, 16, true); // ビット深度
    writeString(view, 36, 'data');
    view.setUint32(40, len, true);

    const blob = new Blob([view, bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

/**
 * 画像を圧縮します（ストレージ節約用）
 */
export const compressImage = (base64Str, maxWidth = 400, quality = 0.7) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scaleSize = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str);
    });
};

