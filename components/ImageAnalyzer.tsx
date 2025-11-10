import React, { useState, useCallback } from 'react';
import { analyzeImage } from '../services/geminiService';
import { fileToBase64 } from '../utils';
import Spinner from './common/Spinner';

const ImageAnalyzer: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>("What is in this image?");
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setAnalysis('');
            setError('');
        }
    };

    const handleAnalyze = useCallback(async () => {
        if (!imageFile || !prompt.trim()) {
            setError('Please upload an image and provide a prompt.');
            return;
        }
        setIsLoading(true);
        setError('');
        setAnalysis('');
        try {
            const base64Image = await fileToBase64(imageFile);
            const result = await analyzeImage(prompt, base64Image, imageFile.type);
            setAnalysis(result);
        } catch (err) {
            setError('Failed to analyze the image. Please try again.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, prompt]);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-bold text-center text-purple-400">Image Understanding</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
                <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-2">Upload an Image</label>
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"/>
                </div>

                {imagePreview && (
                    <div className="mt-4">
                        <img src={imagePreview} alt="Preview" className="max-w-sm mx-auto rounded-lg" />
                    </div>
                )}

                <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Your Question</label>
                    <input
                        id="prompt"
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., Describe this scene, what is the brand of this car?"
                    />
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={isLoading || !imageFile}
                    className="w-full p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : 'Analyze Image'}
                </button>
            </div>

            {error && <p className="text-red-400 text-center">{error}</p>}

            {analysis && (
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold mb-2 text-purple-300">Analysis Result</h3>
                    <p className="text-gray-200 whitespace-pre-wrap">{analysis}</p>
                </div>
            )}
        </div>
    );
};

export default ImageAnalyzer;
