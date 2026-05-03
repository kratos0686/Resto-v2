
import React, { useState, useEffect, Suspense } from 'react';
import { 
    DollarSign, FolderKanban, BarChart3, Settings, 
    Search, WifiOff, FileText, Image, Wind, ListChecks, LogOut, Terminal, Map,
    Zap, ClipboardList, Activity, Plus, Briefcase, Bell, CheckSquare, Shield
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Project } from '../types';
import ProjectDetails from './ProjectDetails';
import DesktopDashboard from './DesktopDashboard';
import PhotoDocumentation from './PhotoDocumentation';
import EquipmentManager from './EquipmentManager';
import TicSheet from './TicSheet';
import TaskManager from './TaskManager';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { updateProject } from '../services/api';

const Billing = React.lazy(() => import('./Billing'));
const Reporting = React.lazy(() => import('./Reporting'));
const AdminPanel = React.lazy(() => import('./AdminPanel'));
const ARMapping = React.lazy(() => import('./ARMapping'));
const DryingLogs = React.lazy(() => import('./DryingLogs'));

const SuspenseFallback = () => (
    <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full" />
    </div>
);

const DesktopApp: React.FC = () => {
    const { activeTab, setActiveTab, selectedProjectId, setSelectedProjectId, isOnline, currentUser, hasPermission, setAuthentication, setIsCliOpen } = useAppContext();
    const [projects, setProjects] = useState<Project[]>([]);
    
    useEffect(() => {
        const loadProjects = async () => {
            if (currentUser?.companyId) {
                try {
                    const q = query(collection(db, 'projects'), where('companyId', '==', currentUser.companyId));
                    const querySnapshot = await getDocs(q);
                    const projectData: Project[] = [];
                    querySnapshot.forEach((doc) => {
                        projectData.push({ id: doc.id, ...doc.data() } as Project);
                    });
                    setProjects(projectData);
                } catch (error) {
                    console.error("Error fetching projects:", error);
                }
            }
        };
        loadProjects();
    }, [currentUser]);
    
    const handleSelectProject = (id: string) => {
        setSelectedProjectId(id);
        setActiveTab('loss-detail');
    }

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    
    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        const updatedProject = { ...projects.find(p => p.id === id)!, ...updates };
        setProjects(projects.map(p => p.id === id ? updatedProject : p));
        await updateProject(id, updates);
    };

    const renderMainContent = () => {
        if (activeTab === 'home' || activeTab === 'dashboard') return <DesktopDashboard projects={projects} onProjectSelect={handleSelectProject} onUpdateProject={handleUpdateProject} />;
        if (activeTab === 'reporting') return hasPermission('view_admin') ? <Reporting /> : <AccessDenied />;
        if (activeTab === 'admin' || activeTab === 'settings') return hasPermission('view_admin') ? <AdminPanel /> : <AccessDenied />;
        if (activeTab === 'billing' && !selectedProjectId) return hasPermission('view_billing') ? <div className="p-8"><Billing /></div> : <AccessDenied />;
        if (activeTab === 'commandCenter') return <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full"><Terminal size={48} className="mb-4 opacity-20" /><h2 className="text-xl">Command Center Active</h2><p className="text-sm mt-2 text-slate-600">CLI terminal launched.</p></div>;
        if (activeTab === 'missionControl') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Mission Control (In Development)</div>;
        if (activeTab === 'predictiveAnalysis') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Predictive Analysis (In Development)</div>;

        // Global state variations (when no project is selected)
        if (!selectedProjectId) {
            if (activeTab === 'equipment') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Global Equipment Manager (In Development)</div>;
            if (activeTab === 'tasks') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Global Task Manager (In Development)</div>;
            if (activeTab === 'dryingLogs') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Global Drying Logs (In Development)</div>;
            if (activeTab === 'ticSheet') return <div className="flex-1 flex items-center justify-center text-slate-500 h-full">Global Tic Sheet (In Development)</div>;
        }

        // If trying to access project specific tabs without a selected project
        if (!selectedProjectId && ['loss-detail', 'photos', 'ar-mapping'].includes(activeTab)) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full">
                    <FolderKanban size={48} className="mb-4 opacity-20" />
                    <h2 className="text-xl font-black text-slate-300">No Project Selected</h2>
                    <p className="text-sm mt-2 text-slate-500">Please select an active project to view this tool.</p>
                </div>
            );
        }

        if (activeTab === 'losses' || (selectedProjectId && ['loss-detail', 'project', 'equipment', 'tic-sheet', 'ticSheet', 'photos', 'ar-mapping', 'tasks', 'dryingLogs'].includes(activeTab))) {
            if (!selectedProjectId) return <DesktopDashboard projects={projects} onProjectSelect={handleSelectProject} onUpdateProject={handleUpdateProject} />;
            if (!selectedProject) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

            return (
                <div className="flex flex-col h-full bg-slate-950">
                    <header className="px-8 py-6 border-b border-white/5 flex-shrink-0 flex justify-between items-start bg-slate-900/50 backdrop-blur-sm">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">{selectedProject.client}</h2>
                            <p className="text-sm font-medium text-blue-400 mt-1">{selectedProject.address}</p>
                        </div>
                        <div className="flex items-center space-x-1 p-1 bg-black/20 rounded-xl border border-white/5">
                            <ProjectTabButton icon={<FileText size={16} />} label="Details" active={activeTab === 'loss-detail'} onClick={()=>setActiveTab('loss-detail')} />
                            <ProjectTabButton icon={<Image size={16} />} label="Photos" active={activeTab === 'photos'} onClick={()=>setActiveTab('photos')} />
                            <ProjectTabButton icon={<Wind size={16} />} label="Equipment" active={activeTab === 'equipment'} onClick={()=>setActiveTab('equipment')} />
                            <ProjectTabButton icon={<ClipboardList size={16} />} label="Scope" active={activeTab === 'ticSheet' || activeTab === 'tic-sheet'} onClick={()=>setActiveTab('ticSheet')} />
                            <ProjectTabButton icon={<ListChecks size={16} />} label="Tasks" active={activeTab === 'tasks'} onClick={()=>setActiveTab('tasks')} />
                            <ProjectTabButton icon={<Activity size={16} />} label="Drying Logs" active={activeTab === 'dryingLogs'} onClick={()=>setActiveTab('dryingLogs')} />
                            <ProjectTabButton icon={<Map size={16} />} label="AR Mapping" active={activeTab === 'ar-mapping'} onClick={()=>setActiveTab('ar-mapping')} />
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'loss-detail' && <ProjectDetails />}
                        {activeTab === 'photos' && <div className="p-8 h-full"><PhotoDocumentation project={selectedProject} onStartScan={()=>{}} /></div>}
                        {activeTab === 'equipment' && <div className="p-8 h-full"><EquipmentManager project={selectedProject} onUpdate={async (updates) => {
                                    const updatedProject = { ...selectedProject, ...updates };
                                    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                                    await updateProject(selectedProject.id, updates);
                                }} /></div>}
                        {(activeTab === 'tic-sheet' || activeTab === 'ticSheet') && <TicSheet project={selectedProject} />}
                        {activeTab === 'tasks' && <div className="h-full"><TaskManager project={selectedProject} onUpdate={async (updates) => {
                                    const updatedProject = { ...selectedProject, ...updates };
                                    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                                    await updateProject(selectedProject.id, updates);
                                }} /></div>}
                        {activeTab === 'dryingLogs' && <div className="p-8 h-full"><Suspense fallback={<SuspenseFallback />}><DryingLogs project={selectedProject} onUpdate={async (updates) => {
                                    const updatedProject = { ...selectedProject, ...updates };
                                    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                                    await updateProject(selectedProject.id, updates);
                                }} /></Suspense></div>}
                        {activeTab === 'ar-mapping' && <div className="p-8 h-full">
                            <Suspense fallback={<SuspenseFallback />}>
                                <ARMapping project={selectedProject} onUpdate={async (updates) => {
                                    const updatedProject = { ...selectedProject, ...updates };
                                    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                                    await updateProject(selectedProject.id, updates);
                                }} />
                            </Suspense>
                        </div>}
                    </div>
                </div>
            );
        }

        return <DesktopDashboard projects={projects} onProjectSelect={handleSelectProject} onUpdateProject={handleUpdateProject} />;
    }

    return (
        <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-sans selection:bg-brand-cyan/30 selection:text-white">
            {!isOnline && (
                <div className="w-full bg-red-600 text-white text-[10px] font-black text-center py-1 z-[100] flex items-center justify-center uppercase tracking-widest shadow-lg">
                    <WifiOff size={12} className="mr-2" /> Offline Mode Active
                </div>
            )}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Navigation Sidebar */}
                <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-white/5 py-6 z-20">
                    <div className="flex items-center gap-3 px-6 mb-6">
                        <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-teal-500/20">R</div>
                        <span className="font-bold text-lg tracking-tight text-white">RestorationAI</span>
                    </div>

                    <div className="px-4 mb-6">
                        <div className="relative group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Search jobs..." 
                                className="w-full bg-slate-950/50 rounded-xl pl-9 pr-3 py-2.5 text-sm border border-white/5 focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 focus:outline-none placeholder-slate-600 text-white transition-all" 
                            />
                        </div>
                    </div>

                    <div className="px-4 mb-4">
                        <button 
                            onClick={() => setActiveTab('new-loss')}
                            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20 group"
                        >
                            <Plus size={18} className="group-hover:scale-110 transition-transform" />
                            <span>Create New Loss</span>
                        </button>
                    </div>

                    <nav className="flex-1 flex flex-col space-y-0.5 w-full px-0 overflow-y-auto no-scrollbar">
                        <DesktopNavButton label="Assigned Jobs" icon={<Briefcase size={18} />} active={activeTab === 'losses' || !!selectedProjectId || activeTab === 'dashboard'} onClick={() => { setSelectedProjectId(null); setActiveTab('losses'); }} />
                        <DesktopNavButton label="Alerts / Notifications" icon={<Bell size={18} />} active={activeTab === 'alerts'} badgeCount={3} onClick={() => { setSelectedProjectId(null); setActiveTab('alerts'); }} />
                        <DesktopNavButton label="My Tasks" icon={<CheckSquare size={18} />} active={activeTab === 'tasks' && !selectedProjectId} onClick={() => { setSelectedProjectId(null); setActiveTab('tasks'); }} />

                        <div className="pt-6 pb-2 px-6">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Field Tools</p>
                        </div>
                        <DesktopNavButton label="Equipment Manager" icon={<Wind size={18} />} active={activeTab === 'equipment' && !selectedProjectId} onClick={() => { setSelectedProjectId(null); setActiveTab('equipment'); }} />
                        <DesktopNavButton label="Drying Logs" icon={<Activity size={18} />} active={activeTab === 'dryingLogs' && !selectedProjectId} onClick={() => { setSelectedProjectId(null); setActiveTab('dryingLogs'); }} />
                        <DesktopNavButton label="Tic Sheet" icon={<ClipboardList size={18} />} active={activeTab === 'ticSheet' && !selectedProjectId} onClick={() => { setSelectedProjectId(null); setActiveTab('ticSheet'); }} />

                        <div className="pt-6 pb-2 px-6 mt-auto">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Management</p>
                        </div>
                        <DesktopNavButton label="Mission Control" icon={<Zap size={18} />} active={activeTab === 'missionControl'} onClick={() => { setSelectedProjectId(null); setActiveTab('missionControl'); }} />
                        <DesktopNavButton label="Crew & Dispatch" icon={<Shield size={18} />} active={activeTab === 'crew'} onClick={() => { setSelectedProjectId(null); setActiveTab('crew'); }} />
                        <DesktopNavButton label="Command Center" icon={<Terminal size={18} />} active={activeTab === 'commandCenter'} onClick={() => { setSelectedProjectId(null); setActiveTab('commandCenter'); setIsCliOpen(true); }} />
                        {hasPermission('view_billing') && <DesktopNavButton label="Billing & Invoices" icon={<DollarSign size={18} />} active={activeTab === 'billing'} onClick={() => { setSelectedProjectId(null); setActiveTab('billing'); }} />}
                        {hasPermission('view_admin') && <DesktopNavButton label="Reports & Analytics" icon={<BarChart3 size={18} />} active={activeTab === 'reporting'} onClick={() => { setSelectedProjectId(null); setActiveTab('reporting'); }} />}
                        {hasPermission('view_admin') && <DesktopNavButton label="Admin Panel" icon={<Settings size={18} />} active={activeTab === 'admin' || activeTab === 'settings'} onClick={() => { setSelectedProjectId(null); setActiveTab('admin'); }} />}
                    </nav>
                    <div className="mt-4 border-t border-white/5 pt-2 px-3">
                        <button onClick={() => setAuthentication(false)} className="w-full flex items-center gap-3 px-4 py-3 xl:px-6 xl:py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl transition-colors group" title="Sign Out">
                            <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* Secondary Sidebar (Project List) */}
                {(activeTab === 'losses' || (!!selectedProjectId && !['dashboard', 'missionControl', 'billing', 'commandCenter', 'reporting', 'admin', 'settings', 'crew'].includes(activeTab))) && (
                    <aside className="w-80 bg-slate-900 border-r border-white/5 flex flex-col z-10 animate-in slide-in-from-left duration-300">
                        <div className="p-5 border-b border-white/5 flex-shrink-0">
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Active Projects</h2>
                            <div className="relative group">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    className="w-full bg-slate-950/50 rounded-xl pl-9 pr-3 py-2.5 text-sm border border-white/5 focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 focus:outline-none placeholder-slate-600 text-white transition-all" 
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {projects.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => handleSelectProject(p.id)} 
                                    className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${selectedProjectId === p.id ? 'bg-teal-600/10 border-teal-500/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                                >
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className={`font-bold text-sm ${selectedProjectId === p.id ? 'text-teal-400' : 'text-slate-200 group-hover:text-white'}`}>{p.client}</h3>
                                            {selectedProjectId === p.id && <div className="w-1.5 h-1.5 bg-teal-400 rounded-full shadow-[0_0_5px_rgba(45,212,191,0.8)]" />}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{p.address}</p>
                                        <div className="mt-2 flex items-center space-x-2">
                                            <span className="text-[9px] font-black uppercase bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">{p.currentStage}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}
                
                <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                    {/* Background Ambience */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
                    
                    <div className="flex-1 overflow-hidden relative z-0">
                        <Suspense fallback={<SuspenseFallback />}>
                            {renderMainContent()}
                        </Suspense>
                    </div>
                </main>
            </div>
        </div>
    );
}

const DesktopNavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; highlight?: boolean; badgeCount?: number }> = ({ active, onClick, icon, label, highlight, badgeCount }) => (
    <button 
        onClick={onClick} 
        className={`w-full flex items-center justify-between gap-3 px-6 py-3 transition-all duration-200 text-sm font-medium ${
            active 
            ? 'bg-teal-600/10 text-teal-400 shadow-[inset_3px_0_0_rgba(45,212,191,1)]' 
            : highlight 
                ? 'bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20 rounded-xl mx-4 my-2 w-[calc(100%-32px)]'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        }`}
    >
      <div className="flex items-center gap-3">
          <span className={`${active || highlight ? (highlight ? 'text-white' : 'text-teal-400') : 'text-gray-500 group-hover:text-gray-300'}`}>
              {icon}
          </span>
          <span className={`${highlight ? 'font-bold' : ''}`}>{label}</span>
      </div>
      {badgeCount !== undefined && badgeCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
              {badgeCount}
          </span>
      )}
    </button>
);

const ProjectTabButton: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick}) => (
    <button 
        onClick={onClick} 
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all text-xs font-bold ${active ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const AccessDenied = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-600">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4"><LogOut /></div>
        <p className="font-bold">Access Restricted</p>
    </div>
);

export default DesktopApp;
