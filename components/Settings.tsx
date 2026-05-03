
import React from 'react';
import { ArrowLeft, ChevronDown, ToggleRight, ToggleLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const Settings: React.FC = () => {
  const { setActiveTab, settings, updateSettings } = useAppContext();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center sticky top-0 z-20">
        <button onClick={() => setActiveTab('losses')} className="mr-4 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-black text-white uppercase tracking-wide">System Configuration</h1>
      </header>

      <div className="flex-1 p-4 space-y-8 pb-24 overflow-y-auto">
        {/* Locale Section */}
        <section>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Localization</h2>
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Language</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.language} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
          </div>
        </section>

        {/* Date/Time Section */}
        <section>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Formats</h2>
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Date Format</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.dateFormat} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Time Format</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.timeFormat} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
          </div>
        </section>

        {/* Measurement Units */}
        <section>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Units of Measure</h2>
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Temperature</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                &deg; {settings.units.temperature} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Dimension</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.units.dimension} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Humidity Ratio</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.units.humidity} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Volume</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.units.volume} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 pl-2">Preferences</h2>
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer">
              <span className="font-bold text-sm text-slate-300">Default View</span>
              <div className="flex items-center font-bold text-sm text-brand-cyan">
                {settings.defaultView} <ChevronDown size={16} className="ml-1" />
              </div>
            </div>
            <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer" onClick={() => updateSettings({ copyPhotosToGallery: !settings.copyPhotosToGallery })}>
              <span className="font-bold text-sm text-slate-300">Save photos to gallery</span>
              <button className="text-brand-cyan transition-colors">
                {settings.copyPhotosToGallery ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-600" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
