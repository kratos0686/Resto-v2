
import React, { useState, useEffect, useMemo } from 'react';
import { Project } from '../types';
import { Briefcase, DollarSign, Users, TrendingUp, TrendingDown, ChevronRight, Activity, Radio, AlertTriangle, Fan, ShieldAlert, Clock, CheckCircle2, Tag, Edit2, Trash2, X, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { EventBus, CloudEvent } from '../services/EventBus';

interface DesktopDashboardProps {
    projects: Project[];
    onProjectSelect: (id: string) => void;
    onUpdateProject?: (id: string, updates: Partial<Project>) => Promise<void>;
}

const DesktopDashboard: React.FC<DesktopDashboardProps> = ({ projects, onProjectSelect, onUpdateProject }) => {
    const [events, setEvents] = useState<CloudEvent[]>([]);
    
    // Subscribe to the global EventBus to visualize Field Telemetry
    useEffect(() => {
        const handleEvent = (e: CloudEvent) => {
            setEvents(prev => [e, ...prev].slice(0, 15)); // Keep last 15 events
        };
        const unsub = EventBus.on('*', handleEvent);
        return () => unsub();
    }, []);

    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status.toLowerCase().includes('active') || p.status.toLowerCase().includes('drying')).length;
    const totalRevenue = projects.reduce((sum, p) => sum + p.totalCost, 0);
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const budgetVariance = totalRevenue - totalBudget;

    const projectsByStatus = projects.reduce((acc, p) => {
        const status = p.currentStage || 'Intake';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const statusChartData = Object.keys(projectsByStatus).map(key => ({ name: key, projects: projectsByStatus[key] }));

    const revenueChartData = [
        { name: 'Aug', revenue: 120450 },
        { name: 'Sep', revenue: 185600 },
        { name: 'Oct', revenue: 157800 },
        { name: 'Nov', revenue: 215000 },
        { name: 'Dec (Proj.)', revenue: 250000 },
    ];

    // --- Mitigation Specific Metrics ---
    
    // 1. Equipment Utilization
    const totalInventory = {
        'Air Mover': 150,
        'Dehumidifier': 45,
        'HEPA Scrubber': 15,
        'Heater': 10
    };

    const deployedEquipment = projects.reduce((acc, p) => {
        if (p.status.toLowerCase().includes('active') || p.status.toLowerCase().includes('drying')) {
            p.equipment?.forEach(eq => {
                if (eq.status === 'Running') {
                    acc[eq.type] = (acc[eq.type] || 0) + 1;
                }
            });
        }
        return acc;
    }, {} as Record<string, number>);

    const equipmentData = Object.keys(totalInventory).map(type => {
        const deployed = deployedEquipment[type] || 0;
        const total = totalInventory[type as keyof typeof totalInventory];
        const utilization = Math.round((deployed / total) * 100);
        return { type, deployed, total, utilization };
    });

    // 2. SLA & Compliance Exceptions
    const exceptions = projects.flatMap(p => {
        const issues = [];
        if (p.status.toLowerCase().includes('active') || p.status.toLowerCase().includes('drying')) {
            // Check for missing daily logs (mock logic: if no logs in last 24h)
            const hasRecentLog = p.dailyNarratives && p.dailyNarratives.length > 0; // Simplified for demo
            if (!hasRecentLog) {
                issues.push({ id: `${p.id}-log`, projectId: p.id, client: p.client, issue: 'Missing Daily Log (>24h)', severity: 'high' });
            }
            
            // Check for high moisture persisting (mock logic)
            const hasHighMoisture = p.dryingMonitor?.some(m => m.status === 'Wet' && m.readings.length > 3);
            if (hasHighMoisture) {
                issues.push({ id: `${p.id}-moisture`, projectId: p.id, client: p.client, issue: 'Stubborn Moisture (Day 4+)', severity: 'medium' });
            }

            // Check compliance
            if (p.complianceChecks?.asbestos === 'pending') {
                issues.push({ id: `${p.id}-asbestos`, projectId: p.id, client: p.client, issue: 'Asbestos Results Pending', severity: 'medium' });
            }
        }
        return issues;
    });

    // 3. Crew Status (Mock)
    const crews = [
        { id: 'C1', name: 'Alpha Team (Water)', status: 'On Site', project: 'Smith Residence', eta: null },
        { id: 'C2', name: 'Bravo Team (Mold)', status: 'En Route', project: 'Johnson Commercial', eta: '15 min' },
        { id: 'C3', name: 'Charlie Team (Demo)', status: 'Available', project: null, eta: null },
        { id: 'C4', name: 'Delta Team (Water)', status: 'On Site', project: 'Williams Estate', eta: null },
    ];

    // --- Global Tag Management ---
    const [editingTag, setEditingTag] = useState<{ oldName: string, newName: string } | null>(null);

    const allTags = useMemo(() => {
        const tagCounts: Record<string, number> = {};
        projects.forEach(p => {
            p.rooms?.forEach(r => {
                r.photos?.forEach(photo => {
                    photo.tags?.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                });
            });
            p.dailyNarratives?.forEach(log => {
                log.tags?.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });
        });
        return Object.entries(tagCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [projects]);

    const handleRenameTag = async (oldName: string, newName: string) => {
        if (!newName.trim() || oldName === newName || !onUpdateProject) {
            setEditingTag(null);
            return;
        }

        for (const p of projects) {
            let modified = false;
            
            const updatedRooms = p.rooms?.map(r => {
                let roomModified = false;
                const updatedPhotos = r.photos?.map(photo => {
                    if (photo.tags?.includes(oldName)) {
                        roomModified = true;
                        return { ...photo, tags: photo.tags.map(t => t === oldName ? newName.trim() : t) };
                    }
                    return photo;
                });
                if (roomModified) modified = true;
                return roomModified ? { ...r, photos: updatedPhotos } : r;
            });

            const updatedLogs = p.dailyNarratives?.map(log => {
                if (log.tags?.includes(oldName)) {
                    modified = true;
                    return { ...log, tags: log.tags.map(t => t === oldName ? newName.trim() : t) };
                }
                return log;
            });

            if (modified) {
                await onUpdateProject(p.id, { rooms: updatedRooms, dailyNarratives: updatedLogs });
            }
        }
        setEditingTag(null);
    };

    const handleDeleteTag = async (tagName: string) => {
        if (!onUpdateProject || !window.confirm(`Are you sure you want to delete the tag "${tagName}" from all photos and logs?`)) return;

        for (const p of projects) {
            let modified = false;
            
            const updatedRooms = p.rooms?.map(r => {
                let roomModified = false;
                const updatedPhotos = r.photos?.map(photo => {
                    if (photo.tags?.includes(tagName)) {
                        roomModified = true;
                        return { ...photo, tags: photo.tags.filter(t => t !== tagName) };
                    }
                    return photo;
                });
                if (roomModified) modified = true;
                return roomModified ? { ...r, photos: updatedPhotos } : r;
            });

            const updatedLogs = p.dailyNarratives?.map(log => {
                if (log.tags?.includes(tagName)) {
                    modified = true;
                    return { ...log, tags: log.tags.filter(t => t !== tagName) };
                }
                return log;
            });

            if (modified) {
                await onUpdateProject(p.id, { rooms: updatedRooms, dailyNarratives: updatedLogs });
            }
        }
    };

    return (
        <div className="flex h-full">
            {/* Main Dashboard Area */}
            <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                <header>
                    <h1 className="text-3xl font-black text-white tracking-tight">Mission Control</h1>
                    <p className="text-slate-400 font-medium">Field Operations & Financial Intelligence</p>
                </header>

                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KpiCard icon={<Briefcase />} title="Active Jobs" value={activeProjects.toString()} subtitle={`${totalProjects} total files`} />
                    <KpiCard icon={<DollarSign />} title="Revenue (Q4)" value={`$${(totalRevenue / 1000).toFixed(1)}k`} positive={true} />
                    <KpiCard
                        icon={budgetVariance > 0 ? <TrendingUp /> : <TrendingDown />}
                        title="Budget Delta"
                        value={`$${(Math.abs(budgetVariance) / 1000).toFixed(1)}k`}
                        subtitle={budgetVariance > 0 ? 'Under Budget' : 'Over Budget'}
                        positive={budgetVariance >= 0}
                    />
                    <KpiCard icon={<Fan />} title="Equip. Deployed" value={Object.values(deployedEquipment).reduce((a,b)=>a+b,0).toString()} subtitle={`${Object.values(totalInventory).reduce((a,b)=>a+b,0)} total units`} />
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Equipment Utilization */}
                    <div className="glass-card rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2"><Activity size={18} className="text-brand-cyan" /> Equipment Utilization</h3>
                        </div>
                        <div className="space-y-5">
                            {equipmentData.map(eq => (
                                <div key={eq.type}>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-300 font-medium">{eq.type}</span>
                                        <span className="text-slate-500 font-mono">{eq.deployed} / {eq.total}</span>
                                    </div>
                                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className={`h-full rounded-full ${eq.utilization > 85 ? 'bg-red-500' : eq.utilization > 60 ? 'bg-amber-500' : 'bg-brand-cyan'}`} 
                                            style={{ width: `${Math.min(eq.utilization, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SLA & Compliance Exceptions */}
                    <div className="glass-card rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2"><ShieldAlert size={18} className="text-amber-500" /> SLA Exceptions</h3>
                            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">{exceptions.length} Alerts</span>
                        </div>
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {exceptions.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                                    <CheckCircle2 size={32} className="text-emerald-500/50 mb-2" />
                                    <p className="text-xs">All SLAs met. No exceptions.</p>
                                </div>
                            ) : (
                                exceptions.map(exc => (
                                    <div key={exc.id} className="p-3 bg-slate-900/50 rounded-xl border border-white/5 flex items-start justify-between group cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onProjectSelect(exc.projectId)}>
                                        <div>
                                            <p className="text-xs font-bold text-white mb-0.5">{exc.client}</p>
                                            <p className={`text-[10px] font-medium ${exc.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>{exc.issue}</p>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-brand-cyan" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Crew Status */}
                    <div className="glass-card rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-blue-400" /> Crew Dispatch</h3>
                        </div>
                        <div className="space-y-3">
                            {crews.map(crew => (
                                <div key={crew.id} className="p-3 bg-slate-900/50 rounded-xl border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${crew.status === 'Available' ? 'bg-emerald-500' : crew.status === 'En Route' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                        <div>
                                            <p className="text-xs font-bold text-white">{crew.name}</p>
                                            <p className="text-[10px] text-slate-500">{crew.status} {crew.project ? `• ${crew.project}` : ''}</p>
                                        </div>
                                    </div>
                                    {crew.eta && (
                                        <div className="flex items-center gap-1 text-[10px] text-amber-400 font-mono bg-amber-400/10 px-2 py-1 rounded">
                                            <Clock size={10} /> {crew.eta}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/5">
                        <h3 className="font-bold text-white mb-4">Pipeline Status</h3>
                        <div className="h-64">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusChartData} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem', color: '#fff' }} />
                                    <Bar dataKey="projects" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="lg:col-span-3 glass-card rounded-2xl p-6 border border-white/5">
                         <h3 className="font-bold text-white mb-4">Revenue Trajectory</h3>
                         <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '0.5rem', color: '#fff' }} />
                                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6, fill: '#fff'}} />
                                </LineChart>
                            </ResponsiveContainer>
                         </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Global Tag Management */}
                    <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col h-96">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2"><Tag size={18} className="text-purple-400" /> Global Tag Management</h3>
                            <span className="text-xs text-slate-400">{allTags.length} Unique Tags</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {allTags.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <Tag size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">No tags found across any projects.</p>
                                </div>
                            ) : (
                                allTags.map(tag => (
                                    <div key={tag.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5 group hover:bg-white/5 transition-colors">
                                        {editingTag?.oldName === tag.name ? (
                                            <div className="flex items-center gap-2 flex-1 mr-4">
                                                <input 
                                                    type="text" 
                                                    value={editingTag.newName}
                                                    onChange={(e) => setEditingTag({ ...editingTag, newName: e.target.value })}
                                                    className="flex-1 bg-slate-950 border border-brand-cyan/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameTag(editingTag.oldName, editingTag.newName);
                                                        if (e.key === 'Escape') setEditingTag(null);
                                                    }}
                                                />
                                                <button onClick={() => handleRenameTag(editingTag.oldName, editingTag.newName)} className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded">
                                                    <Check size={14} />
                                                </button>
                                                <button onClick={() => setEditingTag(null)} className="p-1 text-slate-400 hover:bg-white/10 rounded">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-slate-200">{tag.name}</span>
                                                <span className="text-[10px] bg-white/10 text-slate-400 px-2 py-0.5 rounded-full">{tag.count} uses</span>
                                            </div>
                                        )}
                                        
                                        {editingTag?.oldName !== tag.name && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => setEditingTag({ oldName: tag.name, newName: tag.name })}
                                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Rename Tag"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteTag(tag.name)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Delete Tag"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Right Sidebar: Live EventArc Feed */}
            <aside className="w-96 border-l border-white/5 bg-slate-950 flex flex-col">
                <div className="p-6 border-b border-white/5 bg-slate-900/50">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Radio size={16} className="text-red-500 animate-pulse" /> Live Telemetry
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">EventArc Stream • {events.length} Events</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {events.length === 0 && (
                        <div className="text-center py-10 opacity-30">
                            <Activity size={32} className="mx-auto mb-2" />
                            <p className="text-xs">Waiting for field signals...</p>
                        </div>
                    )}
                    
                    {events.map((e) => {
                        const isWarning = e.ui?.level === 'warning' || e.ui?.level === 'error';
                        const isSuccess = e.ui?.level === 'success';
                        
                        return (
                            <div key={e.id} className={`p-4 rounded-xl border relative overflow-hidden group animate-in slide-in-from-right duration-300 ${isWarning ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isWarning ? 'bg-red-500/20 text-red-400' : isSuccess ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {e.type.split('.').pop()}
                                    </span>
                                    <span className="text-[9px] text-slate-600 font-mono">{new Date(e.time).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-200 leading-relaxed mb-2">{e.ui?.message || JSON.stringify(e.data)}</p>
                                
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="truncate max-w-[150px]">{e.subject || e.source}</span>
                                    {(e.data as Record<string, unknown>)?.projectId && (
                                        <button onClick={() => onProjectSelect((e.data as Record<string, unknown>).projectId as string)} className="flex items-center text-brand-cyan hover:text-white transition-colors">
                                            View <ChevronRight size={10} />
                                        </button>
                                    )}
                                </div>
                                {isWarning && <div className="absolute top-0 right-0 p-2"><AlertTriangle size={12} className="text-red-500" /></div>}
                            </div>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
};

const KpiCard: React.FC<{ icon: React.ReactNode, title: string, value: string, subtitle?: string, positive?: boolean }> = ({ icon, title, value, subtitle, positive }) => (
    <div className="glass-card rounded-2xl p-5 border border-white/5 bg-gradient-to-b from-white/5 to-transparent">
        <div className="flex items-center space-x-3 mb-3">
            <div className="p-2 bg-slate-900 rounded-lg text-slate-400 border border-white/5">{icon}</div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
        </div>
        <p className="text-3xl font-black text-white tracking-tight">{value}</p>
        {subtitle && <p className={`text-[10px] font-bold mt-1 ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-slate-500'}`}>{subtitle}</p>}
    </div>
);

export default DesktopDashboard;
