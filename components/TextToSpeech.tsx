import React, { useState, useCallback, useRef } from 'react';
import { generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils';
import { VOICES } from '../constants';
import Spinner from './common/Spinner';

const TextToSpeech: React.FC = () => {
    const [text, setText] = useState<string>('Hello! I am a friendly AI assistant powered by Gemini.');
    const [voice, setVoice] = useState<string>(VOICES[0]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const audioContextRef = useRef<AudioContext | null>(null);

    const handleSpeak = useCallback(async () => {
        if (!text.trim()) {
            setError('Please enter some text to speak.');
            return;
        }
        setIsLoading(true);
        setError('');

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioContext = audioContextRef.current;

        try {
            const base64Audio = await generateSpeech(text, voice);
            if (base64Audio) {
                const audioBytes = decode(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start();
            } else {
                setError('Failed to generate audio.');
            }
        } catch (err) {
            setError('An error occurred while generating speech.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [text, voice]);

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-bold text-center text-purple-400">Text-to-Speech</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
                <div>
                    <label htmlFor="tts-text" className="block text-sm font-medium text-gray-300 mb-2">Text</label>
                    <textarea
                        id="tts-text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-32"
                        placeholder="Enter text to convert to speech..."
                    />
                </div>
                
                <div>
                    <label htmlFor="tts-voice" className="block text-sm font-medium text-gray-300 mb-2">Voice</label>
                    <select
                        id="tts-voice"
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>

                <button
                    onClick={handleSpeak}
                    disabled={isLoading || !text.trim()}
                    className="w-full p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : 'Speak'}
                </button>
            </div>
            {error && <p className="text-red-400 text-center">{error}</p>}
        </div>
    );
};

export default TextToSpeech;
