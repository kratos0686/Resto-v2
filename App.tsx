
import React, { useEffect, useState } from 'react';
import MobileApp from './components/MobileApp';
import DesktopApp from './components/DesktopApp';
import { useAppContext } from './context/AppContext';
import OAuthHandler from './components/OAuthHandler';
import LaunchScreen from './components/LaunchScreen';
import { useWindowSize } from './hooks/useWindowSize';
import CommandCenter from './components/CommandCenter';
import EventToast from './components/EventToast';

// Declare aistudio on window
declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const { isAuthenticated, isOnline, isCliOpen, setIsCliOpen } = useAppContext();
  const { width } = useWindowSize();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (e) {
          console.error("Error checking API key:", e);
          setHasApiKey(false);
        }
      } else {
        // If aistudio is not available, assume we have a key (e.g. local dev)
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsCliOpen(!isCliOpen);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCliOpen, setIsCliOpen]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success to avoid race conditions as per guidelines
      setHasApiKey(true);
    }
  };

  if (hasApiKey === null || isAuthenticated === null) {
    return <LaunchScreen />;
  }

  if (!hasApiKey) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-brand-cyan/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-brand-cyan text-2xl font-black">AI</span>
          </div>
          <h2 className="text-2xl font-black mb-4">Vertex AI Configuration</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            To use Vertex AI and advanced models, you must select an API key from a paid Google Cloud project.
            <br /><br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-brand-cyan hover:underline">
              View Billing Documentation
            </a>
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-brand-cyan hover:bg-cyan-400 text-slate-900 rounded-xl font-black uppercase tracking-widest transition-all"
          >
            Select Google Cloud Project
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <OAuthHandler />;
  }
  
  const isMobile = width !== undefined && width < 768;

  return (
    <>
      {isMobile ? <MobileApp /> : <DesktopApp />}
      <EventToast />
      <CommandCenter isOpen={isCliOpen} onClose={() => setIsCliOpen(false)} />
      {!isOnline && (
          <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-[10px] font-black text-center py-1 z-[9999] tracking-widest uppercase shadow-lg">
              Field Protocol: Offline Mode Active • Data Saved Locally
          </div>
      )}
    </>
  );
};

export default App;
