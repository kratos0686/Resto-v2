
import React, { useState, useEffect, useRef } from 'react';
import { X, Activity, Command } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { useAppContext } from '../context/AppContext';
import { Tab } from '../types';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigateToTabDeclaration: FunctionDeclaration = {
  name: 'navigateToTab',
  parameters: {
    type: Type.OBJECT,
    description: 'Changes the application view to a different section.',
    properties: {
      tab: { 
        type: Type.STRING, 
        enum: ['dashboard', 'scanner', 'losses', 'equipment', 'photos', 'project', 'reporting', 'billing', 'settings', 'scan'],
        description: 'The target tab to navigate to' 
      }
    },
    required: ['tab'],
  },
};

const CommandCenter: React.FC<CommandCenterProps> = ({ isOpen, onClose }) => {
  const { setActiveTab, isOnline } = useAppContext();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{ cmd: string; result: string; type: 'cmd' | 'res' | 'sys' }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const executeCommand = async () => {
    if (!input.trim()) return;
    const cmd = input;
    setInput('');
    setHistory(prev => [...prev, { cmd, result: '', type: 'cmd' }]);

    if (!isOnline) {
        setHistory(prev => [...prev, { cmd: '', result: "SYS_ERR: COMMAND REQUIRES FIELD_CLOUD UPLINK.", type: 'sys' }]);
        return;
    }

    setIsProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: cmd,
        config: {
          systemInstruction: "You are FIELD_OS Terminal. Interpret user intents to navigate or calculate. If navigating, call navigateToTab. For calculations, provide technical psychrometric answers.",
          tools: [{ functionDeclarations: [navigateToTabDeclaration] }],
        }
      });

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'navigateToTab') {
            let target = fc.args.tab as Tab | 'scan';
            if (target === 'scan') target = 'scanner';
            setHistory(prev => [...prev, { cmd: '', result: `KERNEL: HOOKING MODULE [${target.toUpperCase()}]...`, type: 'sys' }]);
            setTimeout(() => {
              setActiveTab(target as Tab);
              onClose();
            }, 600);
          }
        }
      }

      if (response.text) {
        setHistory(prev => [...prev, { cmd: '', result: response.text || '', type: 'res' }]);
      }
    } catch (err) {
      console.error(err);
      setHistory(prev => [...prev, { cmd: '', result: 'CORE_DUMP: AI_SERVICE_FAULT', type: 'res' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-2xl flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-brand-cyan/20 rounded-lg border border-brand-cyan/30">
            <Activity size={18} className="text-brand-cyan animate-pulse" />
          </div>
          <div>
            <span className="font-black text-white uppercase tracking-widest block text-xs">Field_Kernel_v3.3</span>
            <span className="text-[10px] text-slate-500 font-mono">Uplink: {isOnline ? 'ENCRYPTED_AUTH' : 'LOCAL_ONLY'}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white active:scale-90"><X size={24} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[13px] space-y-5 mb-8 no-scrollbar px-2">
        <div className="text-slate-600 flex items-start space-x-3">
          <span className="opacity-40">#</span>
          <p className="italic">Field OS Terminal ready. Use CMD+K anytime to toggle. Try 'go to scanner' or 'explain Class 3 water'.</p>
        </div>
        {history.map((h, i) => (
          <div key={i} className={`flex space-x-3 ${h.type === 'cmd' ? 'text-brand-cyan' : h.type === 'sys' ? 'text-orange-400' : 'text-slate-200'}`}>
            <span className="opacity-30 shrink-0 font-black">{h.type === 'cmd' ? '>' : '$'}</span>
            <p className="leading-relaxed whitespace-pre-wrap">{h.type === 'cmd' ? h.cmd : h.result}</p>
          </div>
        ))}
        {isProcessing && <div className="text-brand-cyan flex items-center space-x-3"><span className="opacity-30">$</span><div className="w-2 h-2 bg-brand-cyan rounded-full animate-ping" /></div>}
      </div>

      <div className="relative">
          <div className="absolute inset-0 bg-brand-cyan/5 blur-2xl -z-10" />
          <div className="relative group">
              <Command className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand-cyan transition-colors" size={20} />
              <input 
                autoFocus 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && executeCommand()} 
                className="w-full bg-black/60 border border-white/10 rounded-[2rem] py-6 pl-16 pr-8 text-white font-mono focus:outline-none focus:border-brand-cyan/50 shadow-2xl transition-all text-lg" 
                placeholder="Query system kernel..."
              />
          </div>
      </div>
    </div>
  );
};

export default CommandCenter;
