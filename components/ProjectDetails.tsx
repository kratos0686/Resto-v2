
import React, { useState, useEffect, useRef } from 'react';
import { 
    ArrowLeft, Activity, Zap, ArrowRight, FileDown, Loader2, Thermometer, BrainCircuit, ScanLine, FileText, Image as ImageIcon, BookOpen, Pencil, User, Shield, Phone, Mail, Calculator, Map, ListChecks
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getProjectById, updateProject } from '../services/api';
import { Project, RoomScan, WaterCategory, LossClass, ProjectStage } from '../types';
import { EventBus } from '../services/EventBus';
// Import sub-components
import PhotoDocumentation from './PhotoDocumentation';
import DryingLogs from './DryingLogs';
import ComplianceChecklist from './ComplianceChecklist';
import WalkthroughViewer from './WalkthroughViewer';
import SmartDocumentation from './SmartDocumentation';
import PredictiveAnalysis from './PredictiveAnalysis';
import Forms from './Forms';
import ReferenceGuide from './ReferenceGuide';
import TicSheet from './TicSheet';
import TaskManager from './TaskManager';
import EquipmentManager from './EquipmentManager';

import PsychrometricCalculator from './PsychrometricCalculator';
import RoomPsychrometrics from './RoomPsychrometrics';
import ARMapping from './ARMapping';
import WeatherWidget from './WeatherWidget';

import { IntelligenceRouter } from '../services/IntelligenceRouter';

interface ProjectDetailsProps {
    isMobile?: boolean;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ isMobile = false }) => {
    const { selectedProjectId, setActiveTab } = useAppContext();
    const [project, setProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'overview' | 'scope' | 'drying' | 'photos' | 'forms' | 'predictive' | 'reference' | 'calculator' | 'ar_mapping' | 'tasks' | 'equipment' | 'room_readings'>('overview');
    const [showWalkthrough, setShowWalkthrough] = useState<RoomScan | null>(null);
    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Project>>({});
    const summaryRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditingMetadata && summaryRef.current) {
            summaryRef.current.style.height = 'auto';
            summaryRef.current.style.height = `${summaryRef.current.scrollHeight}px`;
        }
    }, [isEditingMetadata, editForm.summary]);

    useEffect(() => {
        const fetchProject = async () => {
            if (selectedProjectId) {
                setIsLoading(true);
                const p = await getProjectById(selectedProjectId);
                setProject(p);
                setIsLoading(false);
            }
        };
        fetchProject();
    }, [selectedProjectId]);

    const handleGenerateReport = async () => {
        if (!project) return;
        setIsGeneratingReport(true);
        
        try {
            const router = new IntelligenceRouter();
            
            // 1. Gather all context
            const arMappingContext = project.arMapping ? {
                scale: project.arMapping.scale,
                markers: project.arMapping.markers.map(m => ({ label: m.label, type: m.type, tags: m.tags })),
                areas: project.arMapping.areas.map(a => {
                    let areaSqFt = 0;
                    if (project.arMapping?.scale && a.points.length > 2) {
                        // Calculate area in square percentage units using shoelace formula
                        let areaPct = 0;
                        for (let i = 0; i < a.points.length; i++) {
                            const j = (i + 1) % a.points.length;
                            areaPct += a.points[i].x * a.points[j].y;
                            areaPct -= a.points[j].x * a.points[i].y;
                        }
                        areaPct = Math.abs(areaPct) / 2;
                        // Convert to square feet: (pct^2) / (pct/ft)^2 = ft^2
                        areaSqFt = areaPct / (project.arMapping.scale * project.arMapping.scale);
                    }
                    return {
                        label: a.label,
                        type: a.type,
                        tags: a.tags,
                        calculatedAreaSqFt: areaSqFt > 0 ? Math.round(areaSqFt * 10) / 10 : undefined
                    };
                })
            } : null;

            const context = {
                client: project.client,
                address: project.address,
                summary: project.summary,
                rooms: project.rooms.map(r => ({
                    name: r.name,
                    dimensions: r.dimensions,
                    readings: r.readings.slice(-3),
                    photosCount: r.photos.length
                })),
                arMapping: arMappingContext,
                equipment: project.equipment,
                dailyNarratives: project.dailyNarratives?.slice(-10)
            };

            const contextStr = JSON.stringify(context);

            // 2. Generate Narrative (IICRC Report)
            const narrativeResponse = await router.generateNarrative({
                currentStage: project.currentStage,
                equipment: project.equipment,
                readings: project.rooms.flatMap(r => r.readings),
                newPhotosCount: project.rooms.reduce((acc, r) => acc + r.photos.length, 0)
            });

            // 3. Generate Scope (Xactimate List)
            const scopeResponse = await router.generateScope(contextStr);
            const scopeResult = JSON.parse(scopeResponse.text || '{}');

            // 4. Update Project
            const updates: Partial<Project> = {
                iicrcReport: narrativeResponse.text,
                xactimateReport: JSON.stringify(scopeResult.lineItems, null, 2),
                lineItems: scopeResult.lineItems.map((item: { code: string; description: string; quantity: number; rate: number }) => ({
                    id: `li-${Date.now()}-${Math.random()}`,
                    code: item.code,
                    description: item.description,
                    quantity: item.quantity,
                    rate: item.rate,
                    total: item.quantity * item.rate,
                    category: 'Mitigation'
                }))
            };

            handleUpdateProject(updates);
            EventBus.publish('com.restorationai.report.generated', { projectId: project.id }, project.id, 'IICRC & Xactimate Report Compiled', 'success');
            
            // Switch to scope tab to show results
            setActiveSubTab('scope');

        } catch (error) {
            console.error("Report Generation Failed", error);
            alert("Failed to generate report. Please check your connection.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleUpdateProject = (updates: Partial<Project>) => {
        if (project) {
             const updated = { ...project, ...updates };
             setProject(updated);
             updateProject(project.id, updates);
        }
    }

    const startEditing = () => {
        setEditForm({
            clientEmail: project.clientEmail,
            clientPhone: project.clientPhone,
            insurance: project.insurance,
            policyNumber: project.policyNumber,
            claimNumber: project.claimNumber,
            adjuster: project.adjuster,
            adjusterEmail: project.adjusterEmail,
            adjusterPhone: project.adjusterPhone,
            summary: project.summary,
            waterCategory: project.waterCategory
        });
        setIsEditingMetadata(true);
    };

    const saveMetadata = () => {
        handleUpdateProject(editForm);
        setIsEditingMetadata(false);
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500 flex flex-col items-center"><Loader2 className="animate-spin mb-2"/> Loading Project...</div>;
    
    if (!project) return (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <Shield size={48} className="text-slate-600 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Project Not Found</h2>
            <p className="mb-4 text-sm">The requested project could not be loaded. It may have been deleted.</p>
            <button onClick={() => setActiveTab('losses')} className="px-6 py-2 bg-brand-cyan text-slate-900 rounded-full font-bold">
                Return to Dashboard
            </button>
        </div>
    );

    // --- MOBILE VIEW ---
    if (isMobile) {
        return (
            <div className="flex flex-col h-full bg-slate-950 text-slate-200">
                {/* Mobile Header */}
                <header className="p-4 bg-slate-900 border-b border-white/5 sticky top-0 z-20">
                    <div className="flex items-center space-x-3 mb-2">
                        <button onClick={() => setActiveTab('losses')}><ArrowLeft size={24} /></button>
                        <div>
                            <h2 className="font-black text-white text-lg leading-none">{project.client}</h2>
                            <p className="text-xs text-slate-400 mt-1">{project.currentStage}</p>
                        </div>
                    </div>
                    {/* Horizontal Scrollable Tabs */}
                    <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
                        {['Overview', 'Tasks', 'Equipment', 'Drying', 'Room Readings', 'Scope', 'Photos', 'Calculator', 'AR Mapping', 'Forms', 'Reference'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveSubTab(tab.toLowerCase().replace(' ', '_') as 'overview' | 'scope' | 'drying' | 'photos' | 'forms' | 'predictive' | 'reference' | 'calculator' | 'ar_mapping' | 'tasks' | 'equipment' | 'room_readings')}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeSubTab === tab.toLowerCase().replace(' ', '_') ? 'bg-brand-cyan text-slate-900' : 'bg-white/5 text-slate-400'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Render Content Based on Mobile Tab */}
                    {activeSubTab === 'overview' && (
                        <>
                             {/* Narrative Feed (Smart Doc) */}
                             <div className="h-[400px]">
                                <SmartDocumentation project={project} onUpdate={handleUpdateProject} />
                             </div>
                             
                             {/* Quick Stats Cards */}
                             <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-900 p-4 rounded-2xl border border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Risk Level</div>
                                    <div className={`text-xl font-black ${project.riskLevel === 'high' ? 'text-red-500' : 'text-green-500'}`}>{project.riskLevel.toUpperCase()}</div>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-2xl border border-white/5">
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">Equipment</div>
                                    <div className="text-xl font-black text-brand-cyan">{project.equipment?.length || 0} Units</div>
                                </div>
                             </div>

                             {/* Weather Info */}
                             <WeatherWidget address={project.address} />

                             {/* Water Damage Details */}
                             <div className="bg-slate-900 p-5 rounded-2xl border border-white/5 space-y-4">
                                 <h3 className="text-sm font-bold text-white flex items-center"><Zap size={16} className="mr-2 text-brand-cyan"/> Water Damage Details</h3>
                                 <div className="grid grid-cols-1 gap-4">
                                     <div className="space-y-1">
                                         <label className="text-[10px] font-bold uppercase text-slate-500 block">Water Category</label>
                                         <select 
                                             value={project.waterCategory}
                                             onChange={(e) => handleUpdateProject({ waterCategory: e.target.value as WaterCategory })}
                                             className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-brand-cyan"
                                         >
                                             {Object.values(WaterCategory).map(cat => (
                                                 <option key={cat} value={cat}>{cat}</option>
                                             ))}
                                         </select>
                                     </div>
                                     <div className="space-y-1">
                                         <label className="text-[10px] font-bold uppercase text-slate-500 block">Loss Class</label>
                                         <select 
                                             value={project.lossClass}
                                             onChange={(e) => handleUpdateProject({ lossClass: e.target.value as LossClass })}
                                             className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-brand-cyan"
                                         >
                                             {Object.values(LossClass).map(cls => (
                                                 <option key={cls} value={cls}>{cls}</option>
                                             ))}
                                         </select>
                                     </div>
                                 </div>
                             </div>

                             {/* Loss Details Section */}
                             <div className="bg-slate-900 p-5 rounded-2xl border border-white/5 space-y-4">
                                 <div className="flex justify-between items-center">
                                     <h3 className="text-sm font-bold text-white flex items-center"><FileText size={16} className="mr-2 text-brand-cyan"/> Loss Summary</h3>
                                     <button onClick={startEditing} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                                         <Pencil size={14} />
                                     </button>
                                 </div>
                                 
                                 {isEditingMetadata ? (
                                     <div className="space-y-3">
                                         <textarea 
                                             className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:border-brand-cyan outline-none"
                                             rows={1}
                                             value={editForm.summary || ''}
                                             onChange={e => {
                                                 setEditForm({...editForm, summary: e.target.value.slice(0, 2000)});
                                                 e.target.style.height = 'auto';
                                                 e.target.style.height = `${e.target.scrollHeight}px`;
                                             }}
                                             ref={summaryRef}
                                             style={{ height: 'auto', overflow: 'hidden', resize: 'none' }}
                                             placeholder="Loss Summary"
                                         />
                                         <div className="flex justify-end mt-1">
                                             <span className={`text-[10px] font-mono ${(editForm.summary?.length || 0) >= 1900 ? 'text-red-400' : 'text-slate-500'}`}>
                                                 {(editForm.summary?.length || 0)} / 2000
                                             </span>
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.clientEmail || ''}
                                                 onChange={e => setEditForm({...editForm, clientEmail: e.target.value})}
                                                 placeholder="Client Email"
                                             />
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.clientPhone || ''}
                                                 onChange={e => setEditForm({...editForm, clientPhone: e.target.value})}
                                                 placeholder="Client Phone"
                                             />
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.insurance || ''}
                                                 onChange={e => setEditForm({...editForm, insurance: e.target.value})}
                                                 placeholder="Insurance"
                                             />
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.claimNumber || ''}
                                                 onChange={e => setEditForm({...editForm, claimNumber: e.target.value})}
                                                 placeholder="Claim #"
                                             />
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.policyNumber || ''}
                                                 onChange={e => setEditForm({...editForm, policyNumber: e.target.value})}
                                                 placeholder="Policy #"
                                             />
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.adjuster || ''}
                                                 onChange={e => setEditForm({...editForm, adjuster: e.target.value})}
                                                 placeholder="Adjuster Name"
                                             />
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.adjusterEmail || ''}
                                                 onChange={e => setEditForm({...editForm, adjusterEmail: e.target.value})}
                                                 placeholder="Adjuster Email"
                                             />
                                             <input 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200"
                                                 value={editForm.adjusterPhone || ''}
                                                 onChange={e => setEditForm({...editForm, adjusterPhone: e.target.value})}
                                                 placeholder="Adjuster Phone"
                                             />
                                         </div>
                                         <div className="grid grid-cols-1 gap-2">
                                             <select 
                                                 className="bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-slate-200 outline-none"
                                                 value={editForm.waterCategory || ''}
                                                 onChange={e => setEditForm({...editForm, waterCategory: e.target.value as WaterCategory})}
                                             >
                                                 <option value="" disabled>Select Water Category</option>
                                                 {Object.values(WaterCategory).map(cat => (
                                                     <option key={cat} value={cat}>{cat}</option>
                                                 ))}
                                             </select>
                                         </div>
                                         <div className="flex space-x-2">
                                             <button onClick={saveMetadata} className="flex-1 py-2 bg-brand-cyan text-slate-900 rounded-xl text-xs font-bold">Save</button>
                                             <button onClick={() => setIsEditingMetadata(false)} className="flex-1 py-2 bg-white/5 text-slate-400 rounded-xl text-xs font-bold">Cancel</button>
                                         </div>
                                     </div>
                                 ) : (
                                     <>
                                         {project.summary ? (
                                             <p className="text-xs text-slate-400 leading-relaxed">{project.summary}</p>
                                         ) : (
                                             <EmptySummaryInput onSave={(summary) => handleUpdateProject({ summary })} />
                                         )}
                                         
                                         <div className="pt-4 border-t border-white/5 space-y-3">
                                             <div className="flex items-center justify-between">
                                                 <div className="flex items-center space-x-2">
                                                     <User size={14} className="text-slate-500" />
                                                     <span className="text-[10px] font-bold uppercase text-slate-500">Client Contact</span>
                                                 </div>
                                             </div>
                                             <div className="grid grid-cols-1 gap-2">
                                                 {project.clientEmail && (
                                                     <div className="flex items-center space-x-2 text-xs text-slate-300">
                                                         <Mail size={12} className="text-brand-cyan" />
                                                         <span>{project.clientEmail}</span>
                                                     </div>
                                                 )}
                                                 {project.clientPhone && (
                                                     <div className="flex items-center space-x-2 text-xs text-slate-300">
                                                         <Phone size={12} className="text-brand-cyan" />
                                                         <span>{project.clientPhone}</span>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         <div className="pt-4 border-t border-white/5 space-y-3">
                                             <div className="flex items-center space-x-2">
                                                 <Shield size={14} className="text-slate-500" />
                                                 <span className="text-[10px] font-bold uppercase text-slate-500">Insurance Info</span>
                                             </div>
                                             <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2">
                                                 <div className="flex justify-between text-[10px]">
                                                     <span className="text-slate-500">Carrier</span>
                                                     <span className="text-slate-200 font-bold">{project.insurance || 'N/A'}</span>
                                                 </div>
                                                 <div className="flex justify-between text-[10px]">
                                                     <span className="text-slate-500">Policy #</span>
                                                     <span className="text-slate-200 font-mono">{project.policyNumber || 'N/A'}</span>
                                                 </div>
                                                 <div className="flex justify-between text-[10px]">
                                                     <span className="text-slate-500">Claim #</span>
                                                     <span className="text-slate-200 font-mono">{project.claimNumber || 'N/A'}</span>
                                                 </div>
                                                 <div className="flex justify-between text-[10px]">
                                                     <span className="text-slate-500">Adjuster</span>
                                                     <span className="text-slate-200">{project.adjuster || 'N/A'}</span>
                                                 </div>
                                                 {project.adjusterEmail && (
                                                     <div className="flex justify-between text-[10px]">
                                                         <span className="text-slate-500">Adj. Email</span>
                                                         <span className="text-slate-200">{project.adjusterEmail}</span>
                                                     </div>
                                                 )}
                                                 {project.adjusterPhone && (
                                                     <div className="flex justify-between text-[10px]">
                                                         <span className="text-slate-500">Adj. Phone</span>
                                                         <span className="text-slate-200">{project.adjusterPhone}</span>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         <div className="pt-6">
                                             <button 
                                                 onClick={() => setActiveTab('scanner')}
                                                 className="w-full py-4 bg-gradient-to-r from-brand-cyan to-blue-500 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-cyan/20 flex items-center justify-center space-x-3 group active:scale-95 transition-all"
                                             >
                                                 <ScanLine size={20} className="group-hover:scale-110 transition-transform" />
                                                 <span>Initiate Room Scan</span>
                                             </button>
                                             <p className="text-[10px] text-slate-500 text-center mt-3 font-medium italic">Capture spatial data and moisture mapping via image scan.</p>
                                         </div>
                                     </>
                                 )}
                             </div>

                             {/* Compliance */}
                             <ComplianceChecklist project={project} onUpdate={handleUpdateProject} />
                        </>
                    )}

                    {activeSubTab === 'tasks' && <TaskManager project={project} onUpdate={handleUpdateProject} />}
                    {activeSubTab === 'drying' && <DryingLogs project={project} onOpenAnalysis={() => {}} onUpdate={handleUpdateProject} />}
                    {activeSubTab === 'room_readings' && <div className="h-[600px]"><RoomPsychrometrics project={project} onUpdate={handleUpdateProject} /></div>}
                    
                    {activeSubTab === 'scope' && <TicSheet project={project} embedded={true} />}
                    
                    {activeSubTab === 'photos' && <PhotoDocumentation project={project} onStartScan={() => setActiveTab('scanner')} onUpdate={handleUpdateProject} />}
                    {activeSubTab === 'calculator' && <div className="p-4"><PsychrometricCalculator /></div>}
                    {activeSubTab === 'ar_mapping' && <div className="h-[600px]"><ARMapping project={project} onUpdate={handleUpdateProject} /></div>}
                    {activeSubTab === 'equipment' && <EquipmentManager project={project} isMobile={true} onUpdate={handleUpdateProject} />}
                    {activeSubTab === 'forms' && <Forms onComplete={() => setActiveSubTab('overview')} />}
                    {activeSubTab === 'reference' && <ReferenceGuide onBack={() => setActiveSubTab('overview')} />}
                </div>
                
                {/* Floating Action Button for Mobile */}
                <div className="absolute bottom-6 right-6 z-30">
                     <button onClick={() => setActiveTab('scanner')} className="w-14 h-14 bg-brand-cyan rounded-full flex items-center justify-center text-slate-900 shadow-lg shadow-brand-cyan/30">
                        <ScanLine size={24} />
                     </button>
                </div>
            </div>
        );
    }

    // --- DESKTOP VIEW ---
    return (
        <div className="flex h-full bg-slate-950">
            {/* Left Context Sidebar (Desktop) */}
            <aside className="w-64 border-r border-white/5 bg-slate-950 flex flex-col p-4 space-y-2">
                <div className="mb-6 px-2">
                    <div className="flex items-center space-x-2 text-slate-500 mb-2 cursor-pointer hover:text-white transition-colors" onClick={() => setActiveTab('losses')}>
                        <ArrowLeft size={16} /> <span className="text-xs font-bold uppercase tracking-wider">Back to List</span>
                    </div>
                    <h1 className="text-xl font-black text-white leading-tight">{project.client}</h1>
                    <p className="text-xs text-slate-400 mt-1">{project.address}</p>
                    <div className="mt-3 flex items-center space-x-2">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${project.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{project.riskLevel} Risk</span>
                         <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/20 text-blue-400">{project.waterCategory}</span>
                    </div>
                </div>

                <div className="mb-4">
                    <WeatherWidget address={project.address} />
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6 mt-2">
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-emerald-500 uppercase mb-2">1. Intake</div>
                        <NavButton label="Loss Overview" icon={<Activity size={18} />} active={activeSubTab === 'overview'} onClick={() => setActiveSubTab('overview')} />
                        <NavButton label="Forms & Auth" icon={<Pencil size={18} />} active={activeSubTab === 'forms'} onClick={() => setActiveSubTab('forms')} />
                    </div>

                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-cyan-500 uppercase mb-2">2. Inspection</div>
                        <NavButton label="AR Mapping" icon={<Map size={18} />} active={activeSubTab === 'ar_mapping'} onClick={() => setActiveSubTab('ar_mapping')} />
                        <NavButton label="Photo Doc & Video" icon={<ImageIcon size={18} />} active={activeSubTab === 'photos'} onClick={() => setActiveSubTab('photos')} />
                        <NavButton label="Reference Guide" icon={<BookOpen size={18} />} active={activeSubTab === 'reference'} onClick={() => setActiveSubTab('reference')} />
                    </div>

                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-amber-500 uppercase mb-2">3. Scope</div>
                        <NavButton label="Estimate Scope" icon={<FileText size={18} />} active={activeSubTab === 'scope'} onClick={() => setActiveSubTab('scope')} />
                        <NavButton label="Psych Calculator" icon={<Calculator size={18} />} active={activeSubTab === 'calculator'} onClick={() => setActiveSubTab('calculator')} />
                    </div>

                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-blue-500 uppercase mb-2">4. Stabilize</div>
                        <NavButton label="Tasks & Setup" icon={<ListChecks size={18} />} active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} />
                        <NavButton label="Equipment Manager" icon={<Zap size={18} />} active={activeSubTab === 'equipment'} onClick={() => setActiveSubTab('equipment')} />
                    </div>

                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-purple-500 uppercase mb-2">5. Monitor</div>
                        <NavButton label="Drying Logs" icon={<Thermometer size={18} />} active={activeSubTab === 'drying'} onClick={() => setActiveSubTab('drying')} />
                        <NavButton label="Room Psychrometrics" icon={<Thermometer size={18} />} active={activeSubTab === 'room_readings'} onClick={() => setActiveSubTab('room_readings')} />
                        <NavButton label="Predictive AI" icon={<BrainCircuit size={18} />} active={activeSubTab === 'predictive'} onClick={() => setActiveSubTab('predictive')} />
                    </div>

                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-black tracking-widest text-pink-500 uppercase mb-2">6. Closeout</div>
                        <NavButton label="Signatures & Closeout" icon={<Pencil size={18} />} active={activeSubTab === 'forms'} onClick={() => setActiveSubTab('forms')} />
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/5">
                    <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-colors">
                        {isGeneratingReport ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                        <span>Generate Report</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8 relative flex flex-col">
                 {/* Project Stage Stepper */}
                 <div className="mb-8 hidden lg:flex items-center justify-between bg-slate-900 border border-white/5 rounded-2xl p-2 shadow-lg shadow-black/20 shrink-0">
                     {['Intake', 'Inspection', 'Scope', 'Stabilize', 'Monitor', 'Closeout'].map((stage, idx, arr) => {
                         const stagesStr = ['Intake', 'Inspection', 'Scope', 'Stabilize', 'Monitor', 'Closeout'];
                         const currentIndex = stagesStr.indexOf(project.currentStage);
                         const isPast = currentIndex >= idx;
                         const isCurrent = project.currentStage === stage;
                         
                         return (
                             <React.Fragment key={stage}>
                                 <div 
                                     onClick={() => handleUpdateProject({ currentStage: stage as ProjectStage })}
                                     className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all ${isCurrent ? 'bg-brand-cyan/10 ring-1 ring-brand-cyan/30' : 'hover:bg-white/5'}`}
                                 >
                                     <div className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-brand-cyan' : isPast ? 'text-slate-300' : 'text-slate-600'}`}>{idx + 1}. {stage}</div>
                                     <div className={`mt-2 w-full h-1.5 rounded-full transition-all ${isPast ? 'bg-brand-cyan shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'bg-slate-800'}`}></div>
                                 </div>
                                 {idx < arr.length - 1 && <ChevronRight size={16} className="text-slate-700 mx-1" />}
                             </React.Fragment>
                         );
                     })}
                 </div>

                 {/* Content Wrapper */}
                 <div className="flex-1 relative">
                 {activeSubTab === 'overview' && (
                     <div className="grid grid-cols-12 gap-6">
                         {/* Left Column: Smart Doc & Compliance */}
                         <div className="col-span-8 space-y-6">
                             <div className="h-[500px] border border-white/5 rounded-[2.5rem] overflow-hidden">
                                 <SmartDocumentation project={project} onUpdate={handleUpdateProject} />
                             </div>
                             <ComplianceChecklist project={project} onUpdate={handleUpdateProject} />
                         </div>

                         {/* Right Column: 3D Scans & Quick Actions */}
                         <div className="col-span-4 space-y-6">
                             {/* Loss & Insurance Details (Desktop) */}
                             <div className="glass-card p-6 rounded-[2rem]">
                                 <div className="flex justify-between items-center mb-4">
                                     <h3 className="font-bold text-white flex items-center"><Shield size={18} className="mr-2 text-brand-cyan"/> Loss & Insurance</h3>
                                     <button onClick={startEditing} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                                         <Pencil size={14} />
                                     </button>
                                 </div>

                                 {isEditingMetadata ? (
                                     <div className="space-y-4">
                                         <div>
                                             <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Loss Summary</label>
                                             <textarea 
                                                 className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:border-brand-cyan outline-none"
                                                 rows={1}
                                                 value={editForm.summary || ''}
                                                 onChange={e => {
                                                     setEditForm({...editForm, summary: e.target.value.slice(0, 2000)});
                                                     e.target.style.height = 'auto';
                                                     e.target.style.height = `${e.target.scrollHeight}px`;
                                                 }}
                                                 ref={summaryRef}
                                                 style={{ height: 'auto', overflow: 'hidden', resize: 'none' }}
                                             />
                                             <div className="flex justify-end mt-1">
                                                 <span className={`text-[10px] font-mono ${(editForm.summary?.length || 0) >= 1900 ? 'text-red-400' : 'text-slate-500'}`}>
                                                     {(editForm.summary?.length || 0)} / 2000
                                                 </span>
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Carrier</label>
                                                 <input 
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.insurance || ''}
                                                     onChange={e => setEditForm({...editForm, insurance: e.target.value})}
                                                 />
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Claim #</label>
                                                 <input 
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.claimNumber || ''}
                                                     onChange={e => setEditForm({...editForm, claimNumber: e.target.value})}
                                                 />
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Policy #</label>
                                                 <input 
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.policyNumber || ''}
                                                     onChange={e => setEditForm({...editForm, policyNumber: e.target.value})}
                                                 />
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Name</label>
                                                 <input 
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.adjuster || ''}
                                                     onChange={e => setEditForm({...editForm, adjuster: e.target.value})}
                                                 />
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Email</label>
                                                 <input 
                                                     type="email"
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.adjusterEmail || ''}
                                                     onChange={e => setEditForm({...editForm, adjusterEmail: e.target.value})}
                                                 />
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Phone</label>
                                                 <input 
                                                     type="tel"
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.adjusterPhone || ''}
                                                     onChange={e => setEditForm({...editForm, adjusterPhone: e.target.value})}
                                                 />
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Client Email</label>
                                                 <input 
                                                     type="email"
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.clientEmail || ''}
                                                     onChange={e => setEditForm({...editForm, clientEmail: e.target.value})}
                                                 />
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Client Phone</label>
                                                 <input 
                                                     type="tel"
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                                                     value={editForm.clientPhone || ''}
                                                     onChange={e => setEditForm({...editForm, clientPhone: e.target.value})}
                                                 />
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-1 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Water Category</label>
                                                 <select 
                                                     className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200 outline-none"
                                                     value={editForm.waterCategory || ''}
                                                     onChange={e => setEditForm({...editForm, waterCategory: e.target.value as WaterCategory})}
                                                 >
                                                     <option value="" disabled>Select Water Category</option>
                                                     {Object.values(WaterCategory).map(cat => (
                                                         <option key={cat} value={cat}>{cat}</option>
                                                     ))}
                                                 </select>
                                             </div>
                                         </div>
                                         <div className="flex space-x-2 pt-2">
                                             <button onClick={saveMetadata} className="flex-1 py-2 bg-brand-cyan text-slate-900 rounded-xl text-xs font-bold">Save Changes</button>
                                             <button onClick={() => setIsEditingMetadata(false)} className="flex-1 py-2 bg-white/5 text-slate-400 rounded-xl text-xs font-bold">Cancel</button>
                                         </div>
                                     </div>
                                 ) : (
                                     <div className="space-y-4">
                                         <div>
                                             <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Loss Summary</label>
                                             {project.summary ? (
                                                 <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-white/5">
                                                     {project.summary}
                                                 </p>
                                             ) : (
                                                 <EmptySummaryInput onSave={(summary) => handleUpdateProject({ summary })} />
                                             )}
                                         </div>

                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Carrier</label>
                                                 <p className="text-xs text-slate-200 font-bold">{project.insurance || 'N/A'}</p>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Claim #</label>
                                                 <p className="text-xs text-slate-200 font-mono">{project.claimNumber || 'N/A'}</p>
                                             </div>
                                         </div>

                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Policy #</label>
                                                 <p className="text-xs text-slate-200 font-mono">{project.policyNumber || 'N/A'}</p>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Name</label>
                                                 <p className="text-xs text-slate-200">{project.adjuster || 'N/A'}</p>
                                             </div>
                                         </div>

                                         <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Email</label>
                                                 <p className="text-xs text-slate-200">{project.adjusterEmail || 'N/A'}</p>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Adjuster Phone</label>
                                                 <p className="text-xs text-slate-200">{project.adjusterPhone || 'N/A'}</p>
                                             </div>
                                         </div>

                                         <div className="pt-4 border-t border-white/5">
                                             <label className="text-[10px] font-bold uppercase text-slate-500 block mb-2">Client Contact</label>
                                             <div className="space-y-2">
                                                 {project.clientEmail && (
                                                     <div className="flex items-center space-x-2 text-xs text-slate-300">
                                                         <Mail size={14} className="text-brand-cyan" />
                                                         <span>{project.clientEmail}</span>
                                                     </div>
                                                 )}
                                                 {project.clientPhone && (
                                                     <div className="flex items-center space-x-2 text-xs text-slate-300">
                                                         <Phone size={14} className="text-brand-cyan" />
                                                         <span>{project.clientPhone}</span>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 )}
                             </div>

                             <div className="glass-card p-6 rounded-[2rem]">
                                 <h3 className="font-bold text-white mb-4">Room Scans</h3>
                                 <div className="space-y-3">
                                     {project.roomScans.length > 0 ? project.roomScans.map(scan => (
                                         <div key={scan.scanId} onClick={() => setShowWalkthrough(scan)} className="group cursor-pointer bg-slate-900 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:border-brand-cyan/50 transition-all">
                                             <div className="flex items-center space-x-3">
                                                 <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-brand-cyan transition-colors"><ScanLine size={20} /></div>
                                                 <div>
                                                     <h4 className="font-bold text-sm text-slate-200">{scan.roomName}</h4>
                                                     <p className="text-[10px] text-slate-500">{scan.dimensions.sqft.toFixed(0)} SQFT</p>
                                                 </div>
                                             </div>
                                             <ArrowRight size={16} className="text-slate-600 group-hover:text-white" />
                                         </div>
                                     )) : (
                                         <div className="text-center py-6 text-slate-500 text-xs">No floorplans yet. Use mobile app to scan.</div>
                                     )}
                                 </div>
                             </div>

                             <div className="bg-gradient-to-br from-indigo-900/50 to-blue-900/50 p-6 rounded-[2rem] border border-indigo-500/20">
                                 <h3 className="font-bold text-white mb-2 flex items-center"><Zap size={18} className="mr-2 text-yellow-400"/> AI Actions</h3>
                                 <div className="space-y-2">
                                     <button onClick={() => setActiveSubTab('scope')} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-left px-3 text-indigo-200 transition-colors">Auto-Generate Scope</button>
                                     <button onClick={() => setActiveSubTab('predictive')} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-left px-3 text-indigo-200 transition-colors">Predict Dryout Date</button>
                                     <button onClick={() => handleGenerateReport()} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-left px-3 text-indigo-200 transition-colors">Compile Final Report</button>
                                 </div>
                             </div>
                         </div>
                     </div>
                 )}

                 {activeSubTab === 'tasks' && <TaskManager project={project} onUpdate={handleUpdateProject} />}
                 {activeSubTab === 'drying' && <DryingLogs project={project} onOpenAnalysis={() => setActiveSubTab('predictive')} onUpdate={handleUpdateProject} />}
                 {activeSubTab === 'room_readings' && <div className="h-[calc(100vh-120px)]"><RoomPsychrometrics project={project} onUpdate={handleUpdateProject} /></div>}
                 {activeSubTab === 'scope' && <TicSheet project={project} />}
                 {activeSubTab === 'photos' && <PhotoDocumentation project={project} onStartScan={() => {}} onUpdate={handleUpdateProject} />}
                 {activeSubTab === 'predictive' && <PredictiveAnalysis onBack={() => setActiveSubTab('overview')} />}
                 {activeSubTab === 'forms' && <Forms onComplete={() => setActiveSubTab('overview')} />}
                 {activeSubTab === 'reference' && <ReferenceGuide onBack={() => setActiveSubTab('overview')} />}
                 {activeSubTab === 'calculator' && <div className="p-8 max-w-4xl mx-auto"><PsychrometricCalculator /></div>}
                 {activeSubTab === 'ar_mapping' && <div className="h-[calc(100vh-120px)]"><ARMapping project={project} onUpdate={handleUpdateProject} /></div>}
                 {activeSubTab === 'equipment' && <EquipmentManager project={project} onUpdate={handleUpdateProject} />}
                 </div>
            </main>

            {/* Modal for Walkthrough */}
            {showWalkthrough && (
                <WalkthroughViewer scan={showWalkthrough} onClose={() => setShowWalkthrough(null)} />
            )}
        </div>
    );
};

const NavButton: React.FC<{ label: string, icon: React.ReactNode, active: boolean, onClick: () => void }> = ({ label, icon, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-brand-cyan text-slate-900 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
        {icon}
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const EmptySummaryInput: React.FC<{ onSave: (summary: string) => void }> = ({ onSave }) => {
    const [text, setText] = useState('');
    return (
        <div className="space-y-2 mt-2">
            <textarea 
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:border-brand-cyan outline-none resize-none"
                rows={3}
                maxLength={2000}
                placeholder="Enter loss summary..."
                value={text}
                onChange={e => setText(e.target.value)}
            />
            <div className="flex justify-between items-center">
                <span className={`text-[10px] font-mono ${text.length >= 1900 ? 'text-red-400' : 'text-slate-500'}`}>
                    {text.length} / 2000
                </span>
                <button 
                    onClick={() => {
                        if (text.trim()) onSave(text.trim());
                    }}
                    disabled={!text.trim()}
                    className="px-3 py-1.5 bg-brand-cyan text-slate-900 rounded-lg text-[10px] font-bold disabled:opacity-50"
                >
                    Save Summary
                </button>
            </div>
        </div>
    );
};

export default ProjectDetails;
