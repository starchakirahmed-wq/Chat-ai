import React, { useState, useCallback } from 'react';
import { editImage } from '../services/geminiService';
import { fileToBase64 } from '../utils';
import Spinner from './common/Spinner';

const ImageEditor: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setOriginalImage(URL.createObjectURL(file));
            setEditedImage(null);
            setError('');
        }
    };

    const handleEdit = useCallback(async () => {
        if (!imageFile || !prompt.trim()) {
            setError('Please upload an image and provide an editing instruction.');
            return;
        }
        setIsLoading(true);
        setError('');
        setEditedImage(null);
        try {
            const base64Image = await fileToBase64(imageFile);
            const result = await editImage(prompt, base64Image, imageFile.type);
            if (result) {
                setEditedImage(`data:image/png;base64,${result}`);
            } else {
                setError('Failed to edit the image. Please try a different prompt.');
            }
        } catch (err) {
            setError('An error occurred during image editing.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [imageFile, prompt]);

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-6">
            <h2 className="text-2xl font-bold text-center text-purple-400">Image Editing</h2>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
                <div>
                    <label htmlFor="file-upload-edit" className="block text-sm font-medium text-gray-300 mb-2">Upload Image to Edit</label>
                    <input id="file-upload-edit" type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"/>
                </div>

                <div>
                    <label htmlFor="prompt-edit" className="block text-sm font-medium text-gray-300 mb-2">Editing Instruction</label>
                    <input
                        id="prompt-edit"
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., Add a retro filter, remove the person in the background"
                        disabled={!imageFile}
                    />
                </div>

                <button
                    onClick={handleEdit}
                    disabled={isLoading || !imageFile || !prompt}
                    className="w-full p-3 bg-purple-600 rounded-lg text-white font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : 'Apply Edit'}
                </button>
            </div>

            {error && <p className="text-red-400 text-center">{error}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {originalImage && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2 text-center text-purple-300">Original</h3>
                        <img src={originalImage} alt="Original" className="w-full rounded-lg" />
                    </div>
                )}
                {editedImage && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2 text-center text-purple-300">Edited</h3>
                        <img src={editedImage} alt="Edited" className="w-full rounded-lg" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageEditor;
