/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { RoomScan, Tab, User, Permission, AppSettings } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AppContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean | null;
  setAuthentication: (status: boolean) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  addScanToProject: (projectId: string, scan: RoomScan) => Promise<void>;
  isOnline: boolean;
  hasPermission: (permission: Permission) => boolean;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  isCliOpen: boolean;
  setIsCliOpen: (isOpen: boolean) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'English (US)',
  dateFormat: 'Month/Day/Year',
  timeFormat: 'Twelve Hours (AM/PM)',
  units: {
    temperature: 'Fahrenheit',
    dimension: 'LF Inch',
    humidity: 'Grains / Pound',
    volume: 'Pint',
  },
  copyPhotosToGallery: true,
  defaultView: 'Timeline',
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isCliOpen, setIsCliOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as User);
            setIsAuthenticated(true);
          } else {
            // User exists in Auth but not Firestore yet (handled in OAuthHandler)
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setIsAuthenticated(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const addScanToProject = async (projectId: string, scan: RoomScan) => {
    // TODO: Implement real Firestore update
    console.log("Add scan to project", projectId, scan);
  };

  const hasPermission = (permission: Permission): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'SuperAdmin') return true; 
      return currentUser.permissions.includes(permission);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const value = {
    activeTab,
    setActiveTab,
    selectedProjectId,
    setSelectedProjectId,
    currentUser,
    setCurrentUser,
    isAuthenticated,
    setAuthentication: (status: boolean) => setIsAuthenticated(status),
    accessToken,
    setAccessToken,
    addScanToProject,
    isOnline,
    hasPermission,
    settings,
    updateSettings,
    isCliOpen,
    setIsCliOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};