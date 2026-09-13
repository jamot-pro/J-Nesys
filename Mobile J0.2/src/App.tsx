import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DiscoverView } from './components/DiscoverView';
import { ProfileView } from './components/ProfileView';

export const App: React.FC = () => {
  const { activeTab, isDarkMode } = useApp();

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'dark bg-gray-950 text-white' : 'bg-[#eceef1] text-gray-900'
    }`}>
      {/* Top Application Bar */}
      <Header />

      {/* Main View Router */}
      <main className="w-full">
        {activeTab === 'discover' && <DiscoverView />}
        {activeTab === 'profile' && <ProfileView />}

        {/* Fallbacks for notes, missions, agent, wallet */}
        {activeTab === 'notes' && (
          <div className="max-w-md mx-auto p-6 text-center text-gray-500 text-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">Field Notes</h2>
            <p>Save notes, voice memos, and coordinates during field operations.</p>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="max-w-md mx-auto p-6 text-center text-gray-500 text-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">Active Missions</h2>
            <p>2 missions currently in progress with Tidal Grid.</p>
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="max-w-md mx-auto p-6 text-center text-gray-500 text-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">AI Agent Co-Pilot</h2>
            <p>Chat with dispatch agent and coordinate field verification.</p>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="max-w-md mx-auto p-6 text-center text-gray-500 text-sm">
            <h2 className="text-base font-bold text-gray-800 mb-1">Operator Wallet</h2>
            <p>Available balance: €1,842.00 across connected on-chain addresses.</p>
          </div>
        )}
      </main>

      {/* Persistent Bottom Nav Bar */}
      <BottomNav />
    </div>
  );
};

export default App;
