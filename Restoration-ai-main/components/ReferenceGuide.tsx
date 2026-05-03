
import React, { useState } from 'react';
import { ArrowLeft, Wind, Droplets, Search, Globe, Loader2, ChevronRight, WifiOff } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../context/AppContext';

interface ReferenceGuideProps {
  onBack: () => void;
}

const ReferenceGuide: React.FC<ReferenceGuideProps> = ({ onBack }) => {
  const { isOnline } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ text: string; links: { uri: string; title: string }[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !isOnline) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research this IICRC SR-500 topic: ${searchQuery}`,
        config: { tools: [{ googleSearch: {} }] }
      });
      setSearchResults({
        text: response.text,
        links: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: { web?: { uri: string; title: string } }) => c.web).filter((web): web is { uri: string; title: string } => !!web) || []
      });
    } catch (err) { console.error(err); } finally { setIsSearching(false); }
  };

  return (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-300">
      <header className="flex items-center space-x-3">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-900"><ArrowLeft size={24} /></button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">SR-500 Field Guide</h2>
          <p className="text-sm text-gray-500 font-medium">Intelligence Network</p>
        </div>
      </header>

      <section className="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-blue-600"><Globe size={14} /><span>Industry Grounding</span></div>
        <div className="relative">
          <input 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSearch()} 
            placeholder={isOnline ? "Research IICRC standards, local news..." : "Offline - Search unavailable"} 
            disabled={!isOnline}
            className="w-full bg-gray-50 rounded-2xl p-4 pr-12 text-sm font-bold border border-gray-100 disabled:opacity-60 disabled:cursor-not-allowed" 
          />
          <button 
            onClick={handleSearch} 
            disabled={!isOnline}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-xl shadow-lg disabled:bg-gray-400"
          >
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : (isOnline ? <Search size={18} /> : <WifiOff size={18} />)}
          </button>
        </div>
        {searchResults && (
          <div className="animate-in slide-in-from-top mt-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-2xl text-xs leading-relaxed text-gray-700 font-medium border border-gray-100">{searchResults.text}</div>
            <div className="space-y-2">
              <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Sources</span>
              {searchResults.links.map((l, i) => (
                <a key={i} href={l.uri} target="_blank" className="flex items-center justify-between bg-white border border-gray-100 p-3 rounded-xl hover:bg-gray-50">
                  <span className="text-[10px] font-bold text-blue-600 truncate mr-4">{l.title}</span>
                  <ChevronRight size={12} className="text-gray-300" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <GuideSection icon={<Wind />} title="Equipment Sizing" description="IICRC Standard Formulas">
        <div className="bg-gray-50 p-4 rounded-2xl text-[11px] font-bold text-gray-600">Air Mover Base: 1 per room, plus 1 per 50-70 sq.ft of wet flooring.</div>
      </GuideSection>
      
      <GuideSection icon={<Droplets />} title="Water Categories" description="S-500 Classification">
        <div className="bg-gray-50 p-4 rounded-2xl text-[11px] font-bold text-gray-600 space-y-2">
            <p><span className="text-blue-600">CAT 1:</span> Clean water source.</p>
            <p><span className="text-yellow-600">CAT 2:</span> Significant contamination (Gray).</p>
            <p><span className="text-red-600">CAT 3:</span> Grossly unsanitary (Black).</p>
        </div>
      </GuideSection>
    </div>
  );
};

const GuideSection = ({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) => (
  <section className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm"><div className="flex items-start space-x-4 mb-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">{icon}</div><div><h3 className="font-black text-gray-900 tracking-tight">{title}</h3><p className="text-xs text-gray-500 mt-0.5">{description}</p></div></div><div>{children}</div></section>
);

export default ReferenceGuide;
