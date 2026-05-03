
import React, { useState, useEffect } from 'react';
import { 
  Home, DownloadCloud, Bell, Grid, Plus, Terminal as TerminalIcon, Sparkles, Settings
} from 'lucide-react';
import Dashboard from './Dashboard';
import NewProject from './NewProject';
import ProjectDetails from './ProjectDetails';
import TicSheet from './TicSheet';
import SettingsScreen from './Settings';
import Downloads from './Downloads';
import ARScanner from './ARScanner';
import EquipmentManager from './EquipmentManager';
import { useAppContext } from '../context/AppContext';
import { RoomScan, Project } from '../types';
import { getProjectById } from '../services/api';
import GeminiAssistant from './GeminiAssistant';

const MobileApp: React.FC = () => {
    const { activeTab, setActiveTab, selectedProjectId, addScanToProject, isOnline, hasPermission, setIsCliOpen } = useAppContext();
    const [project, setProject] = useState<Project | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isAiOpen, setIsAiOpen] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            if (selectedProjectId) {
                const p = await getProjectById(selectedProjectId);
                setProject(p);
            }
        };
        fetchProject();
    }, [selectedProjectId]);

    const handleScanComplete = async (scanData?: RoomScan) => {
        if (selectedProjectId && scanData) {
            await addScanToProject(selectedProjectId, scanData);
        }
        setActiveTab('loss-detail');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': 
            case 'losses': 
                return <Dashboard />;
            case 'downloads':
                return <Downloads />;
            case 'new-loss':
            case 'new-project':
                return <NewProject />;
            case 'loss-detail':
            case 'project':
                // Pass isMobile=true to enable the vertical Live Feed layout
                return <ProjectDetails isMobile={true} />;
            case 'line-items':
            case 'tic-sheet':
                return project ? <TicSheet project={project} isMobile={true} onBack={() => setActiveTab('loss-detail')} /> : <div className="p-8 text-center text-slate-500"><div className="animate-spin w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full mx-auto" /></div>;
            case 'settings':
                return <SettingsScreen />;
            case 'scanner':
                return <ARScanner onComplete={handleScanComplete} />;
            case 'equipment':
                return project ? <EquipmentManager isMobile={true} project={project} /> : <div className="p-8 text-center text-slate-500">Select a loss first.</div>;
            default:
                return <Dashboard />;
        }
    };

    const hideBottomNav = ['scanner', 'new-loss', 'new-project'].includes(activeTab);

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-950 shadow-2xl relative font-sans overflow-hidden border-x border-white/5">
            {/* Offline Banner */}
            {!isOnline && (
                <div className="absolute top-0 left-0 right-0 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-black text-center py-1 z-[60] uppercase tracking-widest shadow-lg">
                    Offline Mode
                </div>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 overflow-y-auto bg-slate-950 relative z-0`}>
                {/* Ambient Background Glow */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-blue-900/20 rounded-full blur-[100px] pointer-events-none -z-10" />
                {renderContent()}
            </main>

            {/* Floating Tools (AI/CLI) */}
            {!hideBottomNav && (
                <div className="absolute bottom-24 right-4 flex flex-col space-y-3 z-40 pointer-events-auto">
                    {hasPermission('use_ai_tools') && activeTab !== 'scanner' && (
                        <button 
                            onClick={() => setIsAiOpen(true)} 
                            className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-brand-cyan border border-white/20 active:scale-90 transition-transform animate-in zoom-in duration-300"
                        >
                            <Sparkles size={20} />
                        </button>
                    )}
                    {activeTab !== 'scanner' && (
                        <button 
                            onClick={() => setIsCliOpen(true)} 
                            className="w-12 h-12 bg-slate-900/80 backdrop-blur-md rounded-full shadow-lg flex items-center justify-center text-white border border-white/10 active:scale-90 transition-transform animate-in zoom-in duration-300 delay-75"
                        >
                            <TerminalIcon size={18} />
                        </button>
                    )}
                </div>
            )}

            {/* AI Modals */}
            {isOnline && <GeminiAssistant context={activeTab} isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />}

            {/* Bottom Navigation */}
            {!hideBottomNav && (
                <>
                    {/* More Menu Popover */}
                    {showMoreMenu && (
                        <div className="absolute bottom-24 right-4 w-48 bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-2 z-50 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200">
                            <button onClick={() => { setActiveTab('settings'); setShowMoreMenu(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10 rounded-xl flex items-center transition-colors"><Settings size={18} className="mr-3 text-slate-400"/> Settings</button>
                            <button onClick={() => { setActiveTab('equipment'); setShowMoreMenu(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10 rounded-xl flex items-center transition-colors"><TerminalIcon size={18} className="mr-3 text-slate-400"/> Equipment</button>
                        </div>
                    )}
                    {showMoreMenu && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={() => setShowMoreMenu(false)} />}

                    <nav className="absolute bottom-6 left-4 right-4 h-16 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] flex justify-between items-center px-2 shadow-2xl z-50">
                        <NavButton active={activeTab === 'dashboard' || activeTab === 'losses'} onClick={() => setActiveTab('losses')} icon={<Home size={24} strokeWidth={2.5} />} />
                        <NavButton active={activeTab === 'downloads'} onClick={() => setActiveTab('downloads')} icon={<DownloadCloud size={24} strokeWidth={2.5} />} />
                        
                        <div className="relative -top-8 mx-2">
                            <button onClick={() => setActiveTab('new-loss')} className="w-16 h-16 bg-brand-cyan rounded-full flex items-center justify-center text-slate-900 shadow-[0_0_20px_rgba(6,182,212,0.5)] ring-4 ring-slate-950 active:scale-95 transition-transform hover:scale-105">
                                <Plus size={32} strokeWidth={3} />
                            </button>
                        </div>

                        <NavButton active={false} onClick={() => {}} icon={<Bell size={24} strokeWidth={2.5} />} count={2} />
                        <NavButton active={showMoreMenu} onClick={() => setShowMoreMenu(!showMoreMenu)} icon={<Grid size={24} strokeWidth={2.5} />} />
                    </nav>
                </>
            )}
        </div>
    );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; count?: number }> = ({ active, onClick, icon, count }) => (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-300 active:scale-90 ${active ? 'text-brand-cyan bg-brand-cyan/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
        <div className="relative">
            {icon}
            {count && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold border border-slate-900">{count}</div>}
        </div>
    </button>
);

export default MobileApp;
