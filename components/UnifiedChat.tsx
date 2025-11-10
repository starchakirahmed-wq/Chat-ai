import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateText, analyzeImage, generateImage, editImage, searchWeb, generateSpeech, getLiveChatSession, generateVideo, preprocessInput } from '../services/geminiService';
import { UnifiedMessage } from '../types';
import { fileToBase64, createPcmBlob, decode, decodeAudioData } from '../utils';
import Spinner from './common/Spinner';
import { MicIcon, StopIcon, PaperclipIcon, SendIcon } from './icons/FeatureIcons';

const videoLoadingMessages = [
    "Contacting the video director...",
    "Warming up the digital cameras...",
    "Rendering the first few frames...",
    "This can take a minute or two...",
    "Adding special effects...",
    "Finalizing the video render..."
];

const unethicalKeywords = [
    'nude', 'naked', 'explicit', 'porn', 'sex', 'sexy', 'erotic', 'hentai', 'lust', 'seductive',
    'عريان', 'عاري', 'عارية', 'إباحي', 'جنس', 'مثير', 'فاضح'
];

const rewriteKeywords = [
    'rewrite', 'different style', 'another way', 'change the style', 'rephrase',
    'أعد الكتابة', 'بطريقة مختلفة', 'غير الأسلوب', 'بأسلوب آخر'
];

const UnifiedChat: React.FC = () => {
    const [messages, setMessages] = useState<UnifiedMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Live Chat state
    const [isConversing, setIsConversing] = useState(false);
    const [status, setStatus] = useState('Idle. Press the microphone to start a live conversation.');
    const sessionRef = useRef<any>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // Effect for rotating video loading messages
    useEffect(() => {
        const videoLoadingMessage = messages.find(m => m.isLoading && m.isVideo);
        if (videoLoadingMessage) {
            const intervalId = setInterval(() => {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === videoLoadingMessage.id) {
                        const currentIndex = videoLoadingMessages.indexOf(msg.loadingText || videoLoadingMessages[0]);
                        const nextIndex = (currentIndex + 1) % videoLoadingMessages.length;
                        return { ...msg, loadingText: videoLoadingMessages[nextIndex] };
                    }
                    return msg;
                }));
            }, 5000); // Change text every 5 seconds

            return () => clearInterval(intervalId);
        }
    }, [messages]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeAttachment = () => {
        setAttachedFile(null);
        setPreviewUrl(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const handleSelectKey = async () => {
        await window.aistudio.openSelectKey();
        setMessages(prev => prev.filter(m => !m.needsApiKey));
        setMessages(prev => [...prev, {
            id: `api-key-selected-${Date.now()}`,
            sender: 'model',
            text: 'API Key selected. You can now try your video prompt again.'
        }]);
    };

    const handleSend = async () => {
        const trimmedInput = input.trim();
        if ((!trimmedInput && !attachedFile) || isLoading) return;

        setIsLoading(true);

        const userMessage: UnifiedMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: trimmedInput,
            imageUrl: previewUrl,
        };
        setMessages(prev => [...prev, userMessage]);
        
        setInput('');
        removeAttachment();

        const loadingMessageId = (Date.now() + 1).toString();
        
        // --- Input Pre-processing ---
        let processedInput = trimmedInput;
        let isGibberish = false;
        if (trimmedInput && !attachedFile) { // Only preprocess text-only input
            try {
                const preprocessed = await preprocessInput(trimmedInput);
                if (preprocessed.classification === 'GIBBERISH') {
                    isGibberish = true;
                } else if (preprocessed.classification === 'TYPO' && preprocessed.corrected_text) {
                    processedInput = preprocessed.corrected_text;
                }
            } catch (e) {
                console.error('Input preprocessing failed, continuing with original input.', e);
            }
        }
        
        // --- Feature Detection ---
        const lowercasedInput = processedInput.toLowerCase();
        const genKeywords = ['generate', 'create', 'draw', 'imagine', 'show me', 'ارسم', 'صمم', 'أنشئ صورة', 'تخيل', 'صور لي', 'توليد صورة'];
        const ttsKeywords = ['say', 'speak', 'read this', 'read aloud', 'قل', 'تكلم', 'اقرأ هذا', 'اقرأ بصوت عال'];
        const informationRequestKeywords = ['who', 'what', 'where', 'when', 'why', 'how', 'is', 'are', 'do', 'does', 'can', 'could', 'should', 'would', 'list', 'explain', 'tell me', 'summarize', 'define', 'search for', 'find', 'ما', 'ماذا', 'أين', 'متى', 'لماذا', 'كيف', 'هل', 'اشرح', 'أخبرني', 'لخص', 'عرف', 'ابحث عن'].map(k => k + ' ');
        const editKeywords = ['edit', 'change', 'add', 'remove', 'filter', 'modify', 'عدل', 'غير', 'أضف', 'احذف', 'فلتر', 'تعديل'];
        const videoKeywords = ['generate a video', 'create a video', 'make a video', 'animate', 'فيديو', 'حرك', 'أنشئ فيديو', 'صمم فيديو'];
        
        const isEditRequest = attachedFile && editKeywords.some(kw => lowercasedInput.includes(kw));
        const isVideoRequest = !isEditRequest && (videoKeywords.some(kw => lowercasedInput.includes(kw)) || (attachedFile && lowercasedInput.includes('animate')));
        const isExplicitGenRequest = genKeywords.some(kw => lowercasedInput.includes(kw));
        const isTtsRequest = ttsKeywords.some(kw => lowercasedInput.includes(kw));
        const isInformationRequest = informationRequestKeywords.some(kw => lowercasedInput.startsWith(kw));
        const wordCount = processedInput.split(/\s+/).filter(Boolean).length;
        const isImplicitGenRequest = !attachedFile && !isTtsRequest && !isInformationRequest && wordCount > 0 && wordCount < 15;
        const isImageGenRequest = isExplicitGenRequest || isImplicitGenRequest;
        const isSearchRequest = !isVideoRequest && !attachedFile && !isImageGenRequest && !isTtsRequest;

        // --- Loading Message ---
        setMessages(prev => [...prev, { 
            id: loadingMessageId, 
            sender: 'model', 
            text: '', 
            isLoading: true, 
            isVideo: isVideoRequest,
            loadingText: isVideoRequest ? videoLoadingMessages[0] : 'Thinking...'
        }]);

        // --- Handle Gibberish ---
        if (isGibberish) {
            setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? { ...msg, text: 'عفوا لم افهم قصدك', isLoading: false } : msg));
            setIsLoading(false);
            return;
        }

        // --- Content Moderation ---
        if (isImageGenRequest || isSearchRequest) {
            if (unethicalKeywords.some(kw => lowercasedInput.includes(kw))) {
                setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? { ...msg, text: 'This request violates our safety policy and cannot be processed.', isLoading: false } : msg));
                setIsLoading(false);
                return;
            }
        }
        
        // --- Creative Rewriting ---
        if (rewriteKeywords.some(kw => lowercasedInput.includes(kw))) {
            const lastModelMessage = [...messages].reverse().find(m => m.sender === 'model' && m.text && !m.isLoading && !m.needsApiKey);
            if (lastModelMessage?.text) {
                 const rewritePrompt = `Please perform a comprehensive rewrite of the following text. Your goal is to completely transform its presentation while preserving the core message. Adhere to these strict rules:
1.  **Maintain Length:** The rewritten text must be approximately the same length as the original.
2.  **Reorder Ideas:** Fundamentally change the sequence and flow of the ideas. Do not follow the original structure.
3.  **Unique Phrasing:** Do not copy any expressions or sentence starters from the original text. All phrasing must be new.
4.  **Natural Tone:** Use a natural, blended Arabic vocabulary. Avoid overly formal or exaggerated expressions. The goal is a text that feels authentic and human-written.

Original Text:
"${lastModelMessage.text}"`;
                 const responseText = await generateText(rewritePrompt, 'gemini-2.5-pro', true);
                 setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? { ...msg, text: responseText, isLoading: false } : msg));
                 setIsLoading(false);
                 return;
            }
        }


        try {
            let response: Partial<UnifiedMessage> = {};
            const now = new Date().toLocaleString();
            
            const styleInstruction = "Adopt a creative, deeply insightful, and human-like writing style. Draw upon a wide base of knowledge, as if you have digested countless books in Arabic, French, and English, to provide nuanced and well-structured answers with rich, human expressions.";
            const formattingInstruction = "\n\nIMPORTANT: Format the entire response as clean, well-structured paragraphs. Do not use any markdown formatting, especially asterisks for lists or emphasis. The output should be plain text only.";
            
            if (isVideoRequest) {
                const keySelected = await window.aistudio.hasSelectedApiKey();
                if (!keySelected) {
                    setMessages(prev => prev.map(msg => msg.id === loadingMessageId 
                        ? { ...msg, isLoading: false, text: 'Video generation requires a Google AI Studio API key. Please select one to continue.', needsApiKey: true }
                        : msg
                    ));
                    setIsLoading(false);
                    return;
                }

                const imagePayload = attachedFile ? { base64: await fileToBase64(attachedFile), mimeType: attachedFile.type } : null;
                const result = await generateVideo(processedInput, imagePayload);

                if (result.uri) {
                    const videoResponse = await fetch(`${result.uri}&key=${process.env.API_KEY}`);
                    const blob = await videoResponse.blob();
                    const videoUrl = URL.createObjectURL(blob);
                    response = { videoUrl, text: 'Here is your generated video:' };
                } else {
                    response = { text: result.error || 'Failed to generate video.', needsApiKey: result.errorType === 'ApiKey' };
                }

            } else if (attachedFile) {
                const base64Image = await fileToBase64(attachedFile);
                if (isEditRequest) {
                    const result = await editImage(processedInput, base64Image, attachedFile.type);
                    response = { imageUrl: result ? `data:image/png;base64,${result}` : undefined, text: result ? 'Here is the edited image:' : 'Sorry, I could not edit the image.', isImage: true };
                } else {
                    const analysisPrompt = `${processedInput} ${styleInstruction} ${formattingInstruction}`;
                    const result = await analyzeImage(analysisPrompt, base64Image, attachedFile.type);
                    response = { text: result };
                }
            } else {
                if (isImageGenRequest) {
                    const imagePrompt = `${processedInput}. All people in the image must be wearing modest, full-body clothing.`;
                    const result = await generateImage(imagePrompt, '1:1');
                    response = { imageUrl: result ? `data:image/png;base64,${result}` : undefined, text: result ? `Here's the image you described:` : 'Sorry, I could not generate the image.', isImage: true };
                } else if (isTtsRequest) {
                    const textToSpeak = processedInput.replace(/say|speak|read this out|read aloud|قل|تكلم|اقرأ هذا|اقرأ بصوت عال/i, '').trim();
                    const result = await generateSpeech(textToSpeak || "You didn't provide anything for me to say!", 'Zephyr');
                    response = { audioBase64: result, text: `Here is the audio for: "${textToSpeak}"` };
                } else { // Fallback to web search / general chat
                     const finalPrompt = `Current date and time is ${now}. Please provide an up-to-date answer for the following user query: "${processedInput}". ${styleInstruction} ${formattingInstruction}`;
                    const { text, sources } = await searchWeb(finalPrompt);
                    response = { text, sources };
                }
            }
             setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? { ...msg, ...response, isLoading: false } : msg));

        } catch (error) {
            console.error("Error processing request:", error);
            setMessages(prev => prev.map(msg => msg.id === loadingMessageId ? { ...msg, text: 'Sorry, an error occurred. Please try again.', isLoading: false } : msg));
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- Live Chat Functions ---
    const stopConversation = useCallback(() => {
        if (sessionRef.current) sessionRef.current.close();
        if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        
        sessionRef.current = null;
        mediaStreamRef.current = null;
        scriptProcessorRef.current = null;
        audioContextRef.current = null;
        nextStartTimeRef.current = 0;

        setIsConversing(false);
        setStatus('Idle. Press the microphone to start a live conversation.');
    }, []);

    const startConversation = async () => {
        if (isConversing) return;
        
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'model', text: "Live conversation started. I'm listening..." }]);
        setStatus('Connecting...');
        setIsConversing(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const sessionPromise = getLiveChatSession({
                onopen: () => {
                    setStatus('Connected. Speak now.');
                    const source = audioContextRef.current!.createMediaStreamSource(stream);
                    const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = processor;
                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        sessionPromise.then(session => session.sendRealtimeInput({ media: createPcmBlob(inputData) }));
                    };
                    source.connect(processor);
                    processor.connect(audioContextRef.current!.destination);
                },
                onmessage: async (message: any) => {
                     if (message.serverContent?.turnComplete) {
                        const userInput = message.serverContent.inputTranscription?.text?.trim();
                        const modelOutput = message.serverContent.outputTranscription?.text?.trim();
                        if (userInput) setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: userInput }]);
                        if (modelOutput) setMessages(prev => [...prev, { id: `model-${Date.now()}`, sender: 'model', text: modelOutput }]);
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
                    console.error('Live error:', e);
                    setStatus('Error. Please try again.');
                    stopConversation();
                },
                onclose: () => stopConversation(),
            });
            sessionRef.current = await sessionPromise;
        } catch (error) {
            console.error(error);
            setStatus('Mic permission denied.');
            setIsConversing(false);
        }
    };

    useEffect(() => () => stopConversation(), [stopConversation]);

    return (
        <div className="flex flex-col h-full max-w-5xl mx-auto">
            <header className="p-4 border-b border-gray-700">
                <h1 className="text-xl font-bold text-center text-purple-400">CHAT AI</h1>
                 <p className="text-center text-sm text-gray-400 mt-1">{isConversing ? status : 'Ask me anything, upload an image, generate video, or start a voice chat.'}</p>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-3 rounded-2xl flex flex-col ${msg.sender === 'user' ? 'bg-purple-700 text-white items-end' : 'bg-gray-700 text-gray-200 items-start'}`}>
                           {msg.isLoading ? (
                                <div className="flex items-center space-x-2"> <Spinner /> <span>{msg.loadingText || 'Thinking...'}</span> </div>
                           ) : (
                               <>
                                {msg.imageUrl && <img src={msg.imageUrl} alt="content" className="rounded-lg max-w-xs mb-2" />}
                                {msg.videoUrl && <video src={msg.videoUrl} controls className="rounded-lg max-w-md mb-2" />}
                                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                                {msg.audioBase64 && <audio controls src={`data:audio/webm;base64,${msg.audioBase64}`} className="mt-2" />}
                                {msg.sources && msg.sources.length > 0 && (
                                     <div className="mt-2 border-t border-gray-600 pt-2 w-full">
                                         <h4 className="font-semibold text-xs text-purple-300">Sources:</h4>
                                         <ul className="list-disc list-inside space-y-1 text-sm">
                                             {msg.sources.map((s, i) => s.web && (
                                                 <li key={`${msg.id}-s-${i}`}><a href={s.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{s.web.title || s.web.uri}</a></li>
                                             ))}
                                         </ul>
                                     </div>
                                )}
                                {msg.needsApiKey && (
                                    <div className="mt-2 text-sm bg-gray-800 p-3 rounded-lg">
                                        <button onClick={handleSelectKey} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full">
                                            Select API Key
                                        </button>
                                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-blue-400 hover:underline">
                                            Learn about billing
                                        </a>
                                    </div>
                                )}
                               </>
                           )}
                        </div>
                    </div>
                ))}
                 <div ref={messagesEndRef} />
            </div>

             <div className="p-4 border-t border-gray-700">
                 {previewUrl && (
                    <div className="relative w-24 h-24 mb-2 p-1 border border-gray-600 rounded">
                        <img src={previewUrl} alt="attachment preview" className="w-full h-full object-cover rounded"/>
                        <button onClick={removeAttachment} className="absolute -top-2 -right-2 bg-gray-800 rounded-full text-white w-6 h-6 flex items-center justify-center text-sm">&times;</button>
                    </div>
                 )}
                <div className="flex items-center space-x-2">
                     <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition" aria-label="Attach file">
                         <PaperclipIcon />
                     </button>
                     <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden"/>
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                        className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        placeholder="Type a message or describe an image to animate..."
                        rows={1}
                        disabled={isLoading || isConversing}
                    />
                    <button onClick={handleSend} disabled={isLoading || isConversing || (!input.trim() && !attachedFile)} className="p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition" aria-label="Send message">
                        <SendIcon />
                    </button>
                    <button onClick={isConversing ? stopConversation : startConversation} disabled={isLoading} className={`p-3 rounded-lg text-white font-semibold transition ${isConversing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} disabled:bg-gray-600`} aria-label={isConversing ? 'Stop conversation' : 'Start conversation'}>
                        {isConversing ? <StopIcon /> : <MicIcon />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnifiedChat;
