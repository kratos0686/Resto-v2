/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { RoomScan, Tab, User, Permission, AppSettings } from '../types';
import { auth, db } from '../firebase';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
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
  /** The current Firebase ID token — auto-refreshed by the SDK */
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
  /** Live Firebase ID token — kept up-to-date via onIdTokenChanged */
  const [accessToken, setAccessToken] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isCliOpen, setIsCliOpen] = useState<boolean>(false);

  // ── Online/offline listener ──────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ── Firebase Auth listener — user identity ───────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as User);
            setIsAuthenticated(true);
          } else {
            // User exists in Auth but not Firestore yet (handled in OAuthHandler)
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setIsAuthenticated(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setAccessToken('');
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Firebase token listener — keeps accessToken fresh ───────────────────
  // onIdTokenChanged fires whenever the token is refreshed (~every hour) or
  // when the user signs in/out, so accessToken is always valid for API calls.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setAccessToken(token);
        } catch (err) {
          console.error('Failed to get ID token:', err);
          setAccessToken('');
        }
      } else {
        setAccessToken('');
      }
    });
    return () => unsubscribe();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addScanToProject = async (_projectId: string, _scan: RoomScan) => {
    // TODO: Implement real Firestore update
    console.log('addScanToProject called — implement Firestore write here');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'SuperAdmin') return true;
    return currentUser.permissions.includes(permission);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const value: AppContextType = {
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
