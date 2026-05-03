
import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
    LayoutDashboard, DollarSign, FolderOpen, BarChart3, Settings,
    Search, WifiOff, FileText, Image, Wind, ListChecks, LogOut,
    Terminal, Map, Plus, Users, Wrench, ClipboardList
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Project } from '../types';
import ProjectDetails from './ProjectDetails';
import DesktopDashboard from './DesktopDashboard';
import PhotoDocumentation from './PhotoDocumentation';
import EquipmentManager from './EquipmentManager';
import TicSheet from './TicSheet';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { updateProject } from '../services/api';

const Billing = React.lazy(() => import('./Billing'));
const Reporting = React.lazy(() => import('./Reporting'));
const AdminPanel = React.lazy(() => import('./AdminPanel'));
const ARMapping = React.lazy(() => import('./ARMapping'));
const TaskManager = React.lazy(() => import('./TaskManager'));
import CommandCenter from './CommandCenter';

const SuspenseFallback = () => (
    <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-[#00d4aa] border-t-transparent rounded-full" />
    </div>
);

const DesktopApp: React.FC = () => {
    const { activeTab, setActiveTab, selectedProjectId, setSelectedProjectId, isOnline, currentUser, hasPermission, setAuthentication, isCliOpen, setIsCliOpen } = useAppContext();
    const [projects, setProjects] = useState<Project[]>([]);
    const [jobSearch, setJobSearch] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

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
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        const updatedProject = { ...projects.find(p => p.id === id)!, ...updates };
        setProjects(projects.map(p => p.id === id ? updatedProject : p));
        await updateProject(id, updates);
    };

    const filteredProjects = projects.filter(p =>
        jobSearch === '' ||
        p.client?.toLowerCase().includes(jobSearch.toLowerCase()) ||
        p.address?.toLowerCase().includes(jobSearch.toLowerCase())
    );

    const showProjectSidebar = activeTab === 'losses' || !!selectedProjectId;

    const renderMainContent = () => {
        if (activeTab === 'dashboard') return <DesktopDashboard projects={projects} onProjectSelect={handleSelectProject} onUpdateProject={handleUpdateProject} />;
        if (activeTab === 'reporting') return hasPermission('view_admin') ? <Reporting /> : <AccessDenied />;
        if (activeTab === 'admin' || activeTab === 'settings') return hasPermission('view_admin') ? <AdminPanel /> : <AccessDenied />;
        if (activeTab === 'billing' && !selectedProjectId) return hasPermission('view_billing') ? <div className="p-8"><Billing /></div> : <AccessDenied />;

        if (activeTab === 'crew-dispatch') {
            return (
                <PlaceholderView
                    icon={<Users size={40} className="text-[#00d4aa]" />}
                    title="Crew & Dispatch"
                    subtitle="Technician scheduling and field dispatch management is coming soon."
                />
            );
        }

        if (activeTab === 'task-manager') {
            if (!selectedProject) {
                return (
                    <PlaceholderView
                        icon={<ClipboardList size={40} className="text-[#00d4aa]" />}
                        title="Task Manager"
                        subtitle="Select an active job from the job list to view and manage its tasks."
                    />
                );
            }
            return (
                <Suspense fallback={<SuspenseFallback />}>
                    <div className="p-8 h-full overflow-y-auto">
                        <TaskManager
                            project={selectedProject}
                            onUpdate={(updates) => handleUpdateProject(selectedProject.id, updates)}
                        />
                    </div>
                </Suspense>
            );
        }

        if (activeTab === 'losses' || (selectedProjectId && ['loss-detail', 'project', 'equipment', 'tic-sheet', 'photos', 'ar-mapping'].includes(activeTab))) {
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
                            <ProjectTabButton icon={<FileText size={16} />} label="Details" active={activeTab === 'loss-detail'} onClick={() => setActiveTab('loss-detail')} />
                            <ProjectTabButton icon={<Image size={16} />} label="Photos" active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} />
                            <ProjectTabButton icon={<Wind size={16} />} label="Equipment" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} />
                            <ProjectTabButton icon={<ListChecks size={16} />} label="Scope" active={activeTab === 'tic-sheet'} onClick={() => setActiveTab('tic-sheet')} />
                            <ProjectTabButton icon={<Map size={16} />} label="AR Mapping" active={activeTab === 'ar-mapping'} onClick={() => setActiveTab('ar-mapping')} />
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'loss-detail' && <ProjectDetails />}
                        {activeTab === 'photos' && <div className="p-8 h-full"><PhotoDocumentation project={selectedProject} onStartScan={() => {}} /></div>}
                        {activeTab === 'equipment' && <div className="p-8 h-full"><EquipmentManager project={selectedProject} /></div>}
                        {activeTab === 'tic-sheet' && <TicSheet project={selectedProject} />}
                        {activeTab === 'ar-mapping' && (
                            <div className="p-8 h-full">
                                <Suspense fallback={<SuspenseFallback />}>
                                    <ARMapping project={selectedProject} onUpdate={async (updates) => {
                                        const updatedProject = { ...selectedProject, ...updates };
                                        setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                                        await updateProject(selectedProject.id, updates);
                                    }} />
                                </Suspense>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return <DesktopDashboard projects={projects} onProjectSelect={handleSelectProject} onUpdateProject={handleUpdateProject} />;
    };

    return (
        <div className="h-screen w-full bg-slate-950 text-slate-200 flex flex-col overflow-hidden font-sans selection:bg-[#00d4aa]/30 selection:text-white">
            {!isOnline && (
                <div className="w-full bg-red-600 text-white text-[10px] font-black text-center py-1 z-[100] flex items-center justify-center uppercase tracking-widest shadow-lg">
                    <WifiOff size={12} className="mr-2" /> Offline Mode Active
                </div>
            )}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Main Navigation Sidebar ── */}
                <aside className="flex flex-col w-60 bg-[#0b0d14] border-r border-white/5 z-20 flex-shrink-0">

                    {/* Logo / Brand */}
                    <div className="px-5 pt-6 pb-5 border-b border-white/5 flex items-center space-x-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-500/20 flex-shrink-0">R</div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-white tracking-tight leading-none">Restoration</p>
                            <p className="text-[10px] text-[#00d4aa] font-bold uppercase tracking-widest mt-0.5">AI Platform</p>
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="relative group">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00d4aa] transition-colors pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={jobSearch}
                                onChange={e => {
                                    setJobSearch(e.target.value);
                                    if (!showProjectSidebar) {
                                        setSelectedProjectId(null);
                                        setActiveTab('losses');
                                    }
                                }}
                                placeholder="Search jobs..."
                                className="w-full bg-white/5 rounded-lg pl-8 pr-3 py-2 text-xs border border-white/5 focus:ring-1 focus:ring-[#00d4aa]/40 focus:border-[#00d4aa]/40 focus:outline-none placeholder-slate-600 text-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Nav body */}
                    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">

                        {/* JOBS section */}
                        <div>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 px-3">Jobs</p>

                            <SidebarNavItem
                                label="Active Jobs"
                                icon={<FolderOpen size={16} />}
                                active={activeTab === 'losses' && !selectedProjectId}
                                onClick={() => { setSelectedProjectId(null); setActiveTab('losses'); setJobSearch(''); }}
                            />
                            <SidebarNavItem
                                label="Mission Control"
                                icon={<LayoutDashboard size={16} />}
                                active={activeTab === 'dashboard'}
                                onClick={() => setActiveTab('dashboard')}
                            />
                            <SidebarNavItem
                                label="Create New Job"
                                icon={<Plus size={16} />}
                                active={activeTab === 'new-project'}
                                onClick={() => setActiveTab('new-project')}
                                isAction
                            />
                        </div>

                        {/* OPERATIONS section */}
                        <div>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 px-3">Operations</p>

                            {hasPermission('view_billing') && (
                                <SidebarNavItem
                                    label="Billing & Invoices"
                                    icon={<DollarSign size={16} />}
                                    active={activeTab === 'billing'}
                                    onClick={() => { setSelectedProjectId(null); setActiveTab('billing'); }}
                                />
                            )}
                            <SidebarNavItem
                                label="Crew & Dispatch"
                                icon={<Users size={16} />}
                                active={activeTab === 'crew-dispatch'}
                                onClick={() => { setActiveTab('crew-dispatch'); setIsCliOpen(true); }}
                            />
                            <SidebarNavItem
                                label="Equipment Manager"
                                icon={<Wrench size={16} />}
                                active={activeTab === 'equipment'}
                                onClick={() => setActiveTab('equipment')}
                            />
                            <SidebarNavItem
                                label="Task Manager"
                                icon={<ClipboardList size={16} />}
                                active={activeTab === 'task-manager'}
                                onClick={() => setActiveTab('task-manager')}
                            />
                        </div>

                        {/* SYSTEM section */}
                        <div>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 px-3">System</p>

                            {hasPermission('view_admin') && (
                                <SidebarNavItem
                                    label="Reports"
                                    icon={<BarChart3 size={16} />}
                                    active={activeTab === 'reporting'}
                                    onClick={() => setActiveTab('reporting')}
                                />
                            )}
                            {hasPermission('view_admin') && (
                                <SidebarNavItem
                                    label="Admin"
                                    icon={<Settings size={16} />}
                                    active={activeTab === 'admin' || activeTab === 'settings'}
                                    onClick={() => setActiveTab('admin')}
                                />
                            )}
                            <SidebarNavItem
                                label="Terminal"
                                icon={<Terminal size={16} />}
                                active={false}
                                onClick={() => setIsCliOpen(true)}
                            />
                        </div>
                    </nav>

                    {/* Sign out */}
                    <div className="px-4 py-4 border-t border-white/5 flex-shrink-0">
                        <button
                            onClick={() => setAuthentication(false)}
                            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all duration-200 group"
                            title="Sign Out"
                        >
                            <LogOut size={16} className="flex-shrink-0" />
                            <span className="text-sm font-semibold">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ── Secondary Sidebar (Project List) ── */}
                {showProjectSidebar && (
                    <aside className="w-72 bg-slate-900 border-r border-white/5 flex flex-col z-10 animate-in slide-in-from-left duration-300 flex-shrink-0">
                        <div className="p-5 border-b border-white/5 flex-shrink-0">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    {jobSearch ? `Results (${filteredProjects.length})` : 'Active Projects'}
                                </h2>
                                {selectedProjectId && (
                                    <button
                                        onClick={() => setSelectedProjectId(null)}
                                        className="text-[10px] text-slate-500 hover:text-[#00d4aa] font-bold uppercase tracking-wider transition-colors"
                                    >
                                        ← All
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {filteredProjects.length === 0 ? (
                                <div className="text-center py-10 text-slate-600">
                                    <Search size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-semibold">No jobs found</p>
                                </div>
                            ) : (
                                filteredProjects.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProject(p.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${selectedProjectId === p.id ? 'bg-[#00d4aa]/10 border-[#00d4aa]/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}`}
                                    >
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className={`font-bold text-sm ${selectedProjectId === p.id ? 'text-[#00d4aa]' : 'text-slate-200 group-hover:text-white'}`}>{p.client}</h3>
                                                {selectedProjectId === p.id && (
                                                    <div className="w-1.5 h-1.5 bg-[#00d4aa] rounded-full shadow-[0_0_5px_rgba(0,212,170,0.8)] flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 truncate">{p.address}</p>
                                            <div className="mt-2 flex items-center space-x-2">
                                                <span className="text-[9px] font-black uppercase bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">{p.currentStage}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </aside>
                )}

                {/* ── Main Content Area ── */}
                <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden min-w-0">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
                    <div className="flex-1 overflow-hidden relative z-0">
                        <Suspense fallback={<SuspenseFallback />}>
                            {renderMainContent()}
                        </Suspense>
                    </div>
                </main>
            </div>
            {/* Command Center / Terminal Overlay */}
            <CommandCenter isOpen={isCliOpen} onClose={() => setIsCliOpen(false)} />
        </div>
    );
};

/* ── Sidebar Nav Item ── */
const SidebarNavItem: React.FC<{
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    isAction?: boolean;
}> = ({ active, onClick, icon, label, isAction }) => (
    <div className="relative">
        {active && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[#00d4aa] rounded-full" />
        )}
        <button
            onClick={onClick}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-150 group
                ${active
                    ? 'bg-[#00d4aa]/10 text-[#00d4aa]'
                    : isAction
                        ? 'text-[#00d4aa]/70 hover:bg-[#00d4aa]/10 hover:text-[#00d4aa]'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
        >
            <span className="flex-shrink-0">{icon}</span>
            <span className="text-sm font-semibold truncate">{label}</span>
            {isAction && <Plus size={12} className="ml-auto flex-shrink-0 opacity-60" />}
        </button>
    </div>
);

/* ── Project Tab Button (top sub-nav inside a project) ── */
const ProjectTabButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all text-xs font-bold ${active ? 'bg-[#00d4aa] text-slate-900 shadow-lg shadow-[#00d4aa]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

/* ── Placeholder for sections under construction ── */
const PlaceholderView: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
    <div className="h-full flex flex-col items-center justify-center text-center p-12">
        <div className="w-20 h-20 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center mb-5">
            {icon}
        </div>
        <h2 className="text-xl font-black text-white mb-2">{title}</h2>
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed">{subtitle}</p>
    </div>
);

/* ── Access Denied ── */
const AccessDenied = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-600">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4"><LogOut /></div>
        <p className="font-bold">Access Restricted</p>
    </div>
);

export default DesktopApp;
