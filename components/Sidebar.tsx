import React from 'react';
import { Feature } from '../constants';
import { ChatIcon, ImageIcon, SearchIcon, SoundIcon, EditIcon, MicIcon } from './icons/FeatureIcons';

interface SidebarProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
}

const featureIcons: Record<Feature, React.ReactNode> = {
  [Feature.CHAT]: <ChatIcon />,
  [Feature.IMAGE_ANALYSIS]: <ImageIcon />,
  [Feature.IMAGE_GENERATION]: <ImageIcon />,
  [Feature.IMAGE_EDITING]: <EditIcon />,
  [Feature.WEB_SEARCH]: <SearchIcon />,
  [Feature.TTS]: <SoundIcon />,
  [Feature.LIVE_CHAT]: <MicIcon />,
};

const Sidebar: React.FC<SidebarProps> = ({ activeFeature, setActiveFeature }) => {
  return (
    <aside className="w-16 md:w-64 bg-gray-800 p-2 md:p-4 flex flex-col space-y-2">
      <h1 className="text-lg md:text-2xl font-bold text-center md:text-left mb-4 text-purple-400 hidden md:block">AI Suite</h1>
      <div className="md:hidden flex justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V4m0 16v-2M8 8l1.414-1.414M14.586 14.586L16 16m-1.414 1.414L16 16m-5.414-2.586L9 12m-1.414-1.414L9 12m6 0a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </div>
      {(Object.values(Feature)).map((feature) => (
        <button
          key={feature}
          onClick={() => setActiveFeature(feature)}
          className={`w-full flex items-center p-2 md:p-3 rounded-lg transition-colors duration-200 ${
            activeFeature === feature
              ? 'bg-purple-600 text-white'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <div className="w-6 h-6">{featureIcons[feature]}</div>
          <span className="ml-4 hidden md:block">{feature}</span>
        </button>
      ))}
    </aside>
  );
};

export default Sidebar;
