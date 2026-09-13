import React, { createContext, useContext, useState, useEffect } from 'react';
import type { NavTab, Task, UserProfile, ProfileCompletenessItem } from '../types';
import { INITIAL_TASKS, INITIAL_USER_PROFILE, INITIAL_COMPLETENESS_ITEMS } from '../data/mockData';

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isAvailable: boolean;
  setIsAvailable: (val: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  completenessItems: ProfileCompletenessItem[];
  setCompletenessItems: React.Dispatch<React.SetStateAction<ProfileCompletenessItem[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  isTelegram: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [completenessItems, setCompletenessItems] = useState<ProfileCompletenessItem[]>(INITIAL_COMPLETENESS_ITEMS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTelegram, setIsTelegram] = useState<boolean>(false);

  useEffect(() => {
    // Detect Telegram WebApp environment
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp;
      tg.ready();
      tg.expand();
      setIsTelegram(true);

      // Populate user info from Telegram if present
      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        setUserProfile(prev => ({
          ...prev,
          name: u.first_name || prev.name,
          surname: u.last_name || prev.surname,
          handle: u.username || prev.handle,
          publicSlug: u.username ? `jamot.pro/${u.username}` : prev.publicSlug,
          avatarUrl: u.photo_url || prev.avatarUrl,
        }));
      }
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isAvailable,
        setIsAvailable,
        isDarkMode,
        setIsDarkMode,
        userProfile,
        setUserProfile,
        completenessItems,
        setCompletenessItems,
        tasks,
        setTasks,
        selectedTask,
        setSelectedTask,
        isTelegram,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
