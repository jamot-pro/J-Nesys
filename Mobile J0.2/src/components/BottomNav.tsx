import React from 'react';
import { Compass, Edit3, MapPin, MessageSquare, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NavTab } from '../types';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      tab: 'discover',
      label: 'DISCOVER',
      icon: <Compass className="w-5 h-5" />,
    },
    {
      tab: 'notes',
      label: 'NOTES',
      icon: <Edit3 className="w-5 h-5" />,
    },
    {
      tab: 'missions',
      label: 'MISSIONS',
      icon: <MapPin className="w-5 h-5" />,
      badge: 2,
    },
    {
      tab: 'agent',
      label: 'AGENT',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      tab: 'wallet',
      label: 'WALLET',
      icon: <CreditCard className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f9fafb]/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 pb-safe select-none">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => setActiveTab(item.tab)}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
                isActive ? 'text-[#ff2b5e]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {/* Icon Container with Badge */}
              <div className="relative">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#ff2b5e] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold mt-1 tracking-wider ${
                isActive ? 'text-gray-900 font-bold' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
