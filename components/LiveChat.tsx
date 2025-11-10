import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getLiveChatSession } from '../services/geminiService';
import { createPcmBlob, decode, decodeAudioData } from '../utils';
import { MicIcon, StopIcon } from './icons/FeatureIcons';

const LiveChat: React.FC = () => {
    const [isConversing, setIsConversing] = useState(false);
    const [transcripts, setTranscripts] = useState<{ speaker: 'user' | 'model', text: string }[]>([]);
    const [status, setStatus] = useState('Idle. Press Start to begin.');
    
    const sessionRef = useRef<any>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const stopConversation = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;

        setIsConversing(false);
        setStatus('Conversation ended.');
    }, []);
    
    const startConversation = async () => {
        if (isConversing) return;
        
        setTranscripts([]);
        setStatus('Connecting to Gemini...');
        setIsConversing(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const sessionPromise = getLiveChatSession({
                onopen: () => {
                    setStatus('Connected. You can start speaking now.');
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: any) => {
                    if (message.serverContent?.outputTranscription) {
                        currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                    }
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscription.current += message.serverContent.inputTranscription.text;
                    }
                    if (message.serverContent?.turnComplete) {
                        if (currentInputTranscription.current.trim()) {
                           setTranscripts(prev => [...prev, { speaker: 'user', text: currentInputTranscription.current.trim() }]);
                        }
                        if (currentOutputTranscription.current.trim()) {
                            setTranscripts(prev => [...prev, { speaker: 'model', text: currentOutputTranscription.current.trim() }]);
                        }
                        currentInputTranscription.current = '';
                        currentOutputTranscription.current = '';
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        const outputCtx = outputAudioContextRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputCtx.destination);
                        source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        audioSourcesRef.current.add(source);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live session error:', e);
                    setStatus('An error occurred. Please try again.');
                    stopConversation();
                },
                onclose: () => {
                    setStatus('Connection closed.');
                    stopConversation();
                },
            });

            sessionRef.current = await sessionPromise;

        } catch (error) {
            console.error('Failed to start conversation:', error);
            setStatus('Could not access microphone. Please check permissions.');
            setIsConversing(false);
        }
    };

    useEffect(() => {
        return () => stopConversation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="max-w-4xl mx-auto p-4 flex flex-col h-full">
            <h2 className="text-2xl font-bold text-center text-purple-400 mb-4">Live Conversation</h2>
            <div className="flex justify-center mb-4">
                <button
                    onClick={isConversing ? stopConversation : startConversation}
                    className={`px-6 py-3 rounded-full text-white font-semibold flex items-center space-x-2 transition ${isConversing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    {isConversing ? <StopIcon /> : <MicIcon />}
                    <span>{isConversing ? 'Stop Conversation' : 'Start Conversation'}</span>
                </button>
            </div>
            <p className="text-center text-gray-400 mb-4">{status}</p>
            
            <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-y-auto space-y-4">
                {transcripts.map((t, i) => (
                    <div key={i} className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-3 rounded-2xl ${t.speaker === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-200'}`}>
                           <span className="font-bold block text-sm capitalize">{t.speaker}</span>
                           <p>{t.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveChat;
