
import React from 'react';

const LaunchScreen: React.FC = () => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 max-w-md mx-auto text-white">
      <div className="relative flex flex-col items-center justify-center animate-in fade-in duration-1000">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] flex items-center justify-center text-white font-black text-5xl mb-6 shadow-2xl shadow-blue-500/30 ring-2 ring-white/10">
          R
        </div>
        <h1 className="text-4xl font-black tracking-tighter mb-2">
          Restoration<span className="text-blue-500">AI</span>
        </h1>
      </div>
      <div className="absolute bottom-12 text-center">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-6">Initializing AI Core...</p>
      </div>
    </div>
  );
};

export default LaunchScreen;
