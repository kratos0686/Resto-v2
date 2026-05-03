
import React, { useState, useEffect } from 'react';
import { Search, MoreVertical, MapPin, Filter, Clock, CloudOff, FolderOpen, ChevronRight, Activity, Radio } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getProjects } from '../services/api';
import { LossFile } from '../types';
import { EventBus } from '../services/EventBus';

const Dashboard: React.FC = () => {
  const { setSelectedProjectId, setActiveTab, currentUser } = useAppContext();
  const [losses, setLosses] = useState<LossFile[]>([]);
  const [filter, setFilter] = useState<'Recent' | 'Not Exported' | 'All'>('Recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [events, setEvents] = useState<{id: string, text: string, type: string}[]>([]);

  useEffect(() => {
    const fetchLosses = async () => {
      if (currentUser?.companyId) {
          const data = await getProjects(currentUser.companyId);
          setLosses(data as LossFile[]);
      }
    };
    fetchLosses();

    const handleEvent = (data: { payload?: { message?: string }, type: string }) => {
        if (data.payload && data.payload.message) {
            setEvents(prev => [{ id: Date.now().toString(), text: data.payload.message || '', type: data.type }, ...prev].slice(0, 3));
        }
    };
    const unsub = EventBus.on('*', handleEvent);
    return () => unsub();
  }, [currentUser]);

  const handleSelectLoss = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab('loss-detail');
  };

  const filteredLosses = losses.filter(l => {
      const matchesSearch = l.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.address.toLowerCase().includes(searchTerm.toLowerCase());
      if (filter === 'Recent') return matchesSearch; 
      return matchesSearch;
  });

  const FILTER_TABS = [
      { id: 'Recent', icon: <Clock size={18} />, label: 'Recent' },
      { id: 'Not Exported', icon: <CloudOff size={18} />, label: 'Pending' },
      { id: 'All', icon: <FolderOpen size={18} />, label: 'All' }
  ] as const;

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 pt-12 pb-4 animate-in slide-in-from-top duration-500">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg shadow-blue-500/20">R</div>
                <div>
                    <h1 className="text-lg font-bold text-white leading-tight">Mitigation<span className="text-brand-cyan">AI</span></h1>
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{currentUser?.name || 'Technician'}</p>
                </div>
            </div>
            <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                <MoreVertical size={20} />
            </button>
        </div>
        
        {/* Live Intelligence Feed */}
        {events.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900 border border-brand-cyan/20 relative overflow-hidden group">
                <div className="absolute inset-0 bg-brand-cyan/5 animate-pulse" />
                <div className="flex items-center justify-between mb-2 relative z-10">
                    <span className="text-[10px] font-black text-brand-cyan uppercase tracking-widest flex items-center"><Radio size={12} className="mr-1 animate-ping" /> Live Feed</span>
                </div>
                <div className="space-y-1 relative z-10">
                    {events.map(e => (
                        <div key={e.id} className="text-xs text-slate-300 font-medium truncate animate-in slide-in-from-right duration-300">
                            <span className="text-brand-cyan mr-2">›</span>{e.text}
                        </div>
                    ))}
                </div>
            </div>
        )}
        
        {/* Search Bar */}
        <div className="relative mb-6 group">
            <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-inner focus-within:border-brand-cyan/50 transition-colors">
                <Search className="ml-4 text-slate-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Search projects..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent py-4 px-3 text-sm font-medium text-white placeholder-slate-500 focus:outline-none"
                />
                <button className="mr-4 text-slate-500 hover:text-white transition-colors"><Filter size={16} /></button>
            </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2">
            {FILTER_TABS.map(t => {
                const isActive = filter === t.id;
                return (
                    <button 
                        key={t.id} 
                        onClick={() => setFilter(t.id)}
                        className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${isActive ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/20' : 'bg-transparent text-slate-500 hover:bg-white/5'}`}
                    >
                        {isActive && <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />}
                        <div className={`mb-1 transition-transform ${isActive ? 'scale-110 text-brand-cyan' : ''}`}>{t.icon}</div>
                        <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                    </button>
                )
            })}
        </div>
      </header>

      {/* List Content */}
      <div className="flex-1 p-4 space-y-3 pb-24 overflow-y-auto">
        {filteredLosses.map((loss, index) => (
            <div 
                key={loss.id} 
                onClick={() => handleSelectLoss(loss.id)} 
                className="group relative bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-[1.5rem] p-1 overflow-hidden active:scale-[0.98] transition-all duration-300 animate-in slide-in-from-bottom-4 hover:bg-white/5 hover:border-white/10"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
            >
                <div className="flex items-center h-full p-3">
                    {/* Status Indicator */}
                    <div className="w-1 h-12 bg-slate-800 rounded-full mr-4 overflow-hidden relative">
                         <div className={`absolute bottom-0 w-full rounded-full transition-all duration-500 ${loss.riskLevel === 'high' ? 'h-3/4 bg-red-500' : loss.riskLevel === 'medium' ? 'h-1/2 bg-yellow-500' : 'h-1/3 bg-emerald-500'}`} />
                    </div>

                    <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="text-base font-bold text-white truncate pr-2 group-hover:text-brand-cyan transition-colors">{loss.client}</h3>
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-white/5">{loss.currentStage}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium truncate flex items-center mb-2">
                             <MapPin size={10} className="mr-1 inline" />
                             {loss.address}
                        </p>
                        
                        <div className="flex items-center space-x-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center"><Activity size={10} className="mr-1 text-slate-600"/> {loss.rooms?.length || 0} Rooms</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full" />
                            <span>{loss.insurance || 'Private Pay'}</span>
                        </div>
                    </div>
                    
                    <div className="ml-2 pl-2 border-l border-white/5 flex items-center justify-center">
                        <div className="p-2 rounded-full bg-white/5 text-slate-400 group-hover:bg-brand-cyan group-hover:text-slate-900 transition-all">
                            <ChevronRight size={16} />
                        </div>
                    </div>
                </div>
            </div>
        ))}
        {filteredLosses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 space-y-4">
                <FolderOpen size={48} strokeWidth={1} />
                <p className="text-sm font-medium">No projects found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
