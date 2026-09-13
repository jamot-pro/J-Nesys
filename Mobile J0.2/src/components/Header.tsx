import React from 'react';
import { Moon, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Header: React.FC = () => {
  const {
    isAvailable,
    setIsAvailable,
    isDarkMode,
    setIsDarkMode,
    userProfile,
    activeTab,
    setActiveTab,
  } = useApp();

  const userInitials = `${userProfile.name[0] || 'M'}${userProfile.surname[0] || 'J'}`.toUpperCase();

  const handleAvatarClick = () => {
    // Toggle between profile and discover
    if (activeTab === 'profile') {
      setActiveTab('discover');
    } else {
      setActiveTab('profile');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#eceef1]/90 backdrop-blur-md px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-gray-200/70">
      {/* Left Monogram Logo */}
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none"
        onClick={() => setActiveTab('discover')}
      >
        <span className="font-serif text-2xl font-black tracking-tight text-gray-950 px-1">
          J
        </span>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Availability Toggle */}
        <div
          onClick={() => setIsAvailable(!isAvailable)}
          className={`flex items-center cursor-pointer transition-colors duration-200 rounded-full px-1.5 py-1 text-xs font-semibold select-none ${
            isAvailable
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-[#f4cfd7] text-[#c02b50]'
          }`}
          title="Change worker status"
        >
          <div
            className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 mr-1.5 ${
              isAvailable ? 'translate-x-3.5' : 'translate-x-0'
            }`}
          />
          <span className="pr-1 tracking-wider uppercase text-[11px] font-bold">
            {isAvailable ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Reputation and Level Badge */}
        <div className="flex items-center gap-1 bg-white/80 border border-gray-200/80 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-2xs">
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
          <span className="text-gray-900 font-bold">{userProfile.reputationStars}</span>
          <span className="text-gray-400 text-[11px]">L{userProfile.tierLevel}</span>
        </div>

        {/* Dark/Light mode toggle */}
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-1.5 text-gray-600 hover:text-gray-950 transition-colors rounded-full hover:bg-gray-200/60"
          title="Toggle theme"
        >
          <Moon className="w-4 h-4" />
        </button>

        {/* Profile Avatar Button */}
        <button
          type="button"
          onClick={handleAvatarClick}
          className={`relative w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs ${
            activeTab === 'profile'
              ? 'ring-2 ring-[#ff2b5e] bg-[#ff2b5e] text-white'
              : 'bg-[#ff2b5e] text-white hover:opacity-90'
          }`}
          title="Worker Profile"
        >
          {userProfile.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span>{userInitials}</span>
          )}
        </button>
      </div>
    </header>
  );
};
