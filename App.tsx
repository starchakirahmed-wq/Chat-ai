import React from 'react';
import UnifiedChat from './components/UnifiedChat';

const App: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      <main className="flex-1 flex flex-col overflow-hidden">
        <UnifiedChat />
      </main>
    </div>
  );
};

export default App;