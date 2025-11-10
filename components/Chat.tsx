import React, { useState, useRef, useEffect } from 'react';
import { generateText } from '../services/geminiService';
import { Message } from '../types';
import { MODELS } from '../constants';
import Spinner from './common/Spinner';

type ChatMode = 'Fast' | 'Smart' | 'Deep Think';

const modelMapping: Record<ChatMode, string> = {
    'Fast': MODELS['gemini-2.5-flash-lite'],
    'Smart': MODELS['gemini-2.5-flash'],
    'Deep Think': MODELS['gemini-2.5-pro'],
};

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<ChatMode>('Smart');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const model = modelMapping[mode];
        const thinking = mode === 'Deep Think';
        const responseText = await generateText(input, model, thinking);

        const modelMessage: Message = { sender: 'model', text: responseText };
        setMessages((prev) => [...prev, modelMessage]);
        setIsLoading(false);
    };

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <div className="p-4 bg-gray-800 rounded-t-lg">
                <h2 className="text-xl font-bold text-center">Advanced Chat</h2>
                <div className="flex justify-center space-x-2 mt-2">
                    {(['Fast', 'Smart', 'Deep Think'] as ChatMode[]).map((m) => (
                        <button key={m}
                            onClick={() => setMode(m)}
                            className={`px-4 py-2 text-sm font-semibold rounded-full transition ${mode === m ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >{m}</button>
                    ))}
                </div>
                 <p className="text-center text-xs text-gray-400 mt-2">
                    {mode === 'Fast' && 'For quick, low-latency responses.'}
                    {mode === 'Smart' && 'Balanced performance for general tasks.'}
                    {mode === 'Deep Think' && 'Engages thinking mode for complex queries.'}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-800/50 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 text-gray-200 p-3 rounded-2xl flex items-center space-x-2">
                            <Spinner /> <span>Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-gray-800 rounded-b-lg">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Type your message..."
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;
