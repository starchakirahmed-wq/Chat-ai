import React, { useState, useCallback } from 'react';
import { searchWeb } from '../services/geminiService';
import { GroundingChunk } from '../types';
import Spinner from './common/Spinner';

const WebSearch: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [result, setResult] = useState<{ text: string; sources: GroundingChunk[] } | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleSearch = useCallback(async () => {
        if (!query.trim()) {
            setError('Please enter a search query.');
            return;
        }
        setIsLoading(true);
        setError('');
        setResult(null);
        try {
            const searchResult = await searchWeb(query);
            setResult(searchResult);
        } catch (err) {
            setError('An error occurred during the web search.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [query]);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-bold text-center text-purple-400">Grounded Web Search</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Ask about recent events or up-to-date info..."
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isLoading || !query.trim()}
                        className="p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition"
                    >
                        {isLoading ? <Spinner /> : 'Search'}
                    </button>
                </div>
            </div>

            {error && <p className="text-red-400 text-center">{error}</p>}

            {result && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold mb-2 text-purple-300">Answer</h3>
                    <p className="text-gray-200 whitespace-pre-wrap mb-4">{result.text}</p>
                    {result.sources.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-purple-300">Sources:</h4>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                {result.sources.map((source, index) => (
                                    source.web && (
                                        <li key={index}>
                                            <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                {source.web.title || source.web.uri}
                                            </a>
                                        </li>
                                    )
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WebSearch;
