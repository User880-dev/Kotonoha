/**
 * Gemini APIへの汎用リクエスト関数
 */
async function fetchGemini(model, apiKey, payload, isPredict = false) {
    const baseUrl = isPredict 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    return response.json();
}

/**
 * 物語の本文を生成します
 */
export const generateStoryText = async (apiKey, prompt, systemInstruction = "情緒的な日本語を書く小説家として振る舞ってください。") => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
    };
    const data = await fetchGemini('gemini-2.5-flash-preview-09-2025', apiKey, payload);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

/**
 * 挿絵（画像）を生成します
 */
export const generateIllustration = async (apiKey, prompt) => {
    const payload = {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1 }
    };
    const data = await fetchGemini('imagen-4.0-generate-001', apiKey, payload, true);
    const base64 = data.predictions?.[0]?.bytesBase64Encoded;
    return base64 ? `data:image/png;base64,${base64}` : null;
};

/**
 * 音声を生成します (Text-to-Speech)
 */
export const generateAudioSpeech = async (apiKey, text, voiceName = "Kore") => {
    const payload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                }
            }
        }
    };
    const data = await fetchGemini('gemini-2.5-flash-preview-tts', apiKey, payload);
    return data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
};

