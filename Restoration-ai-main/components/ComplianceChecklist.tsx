
import React, { useState, useEffect } from 'react';
import { Project, ComplianceCheck } from '../types';
import { Microscope, CheckCircle2, AlertTriangle, Clock, BrainCircuit, Loader2, Sparkles, X, WifiOff } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../context/AppContext';
import { EventBus } from '../services/EventBus';
import { motion, AnimatePresence } from 'motion/react';

interface ComplianceChecklistProps {
    project: Project;
    onUpdate?: (updates: Partial<Project>) => void;
}

const AsbestosStatusBadge: React.FC<{ status: NonNullable<Project['complianceChecks']>['asbestos'] }> = ({ status }) => {
    const statusMap = {
        not_tested: { text: 'Testing Required', icon: <AlertTriangle size={14} />, color: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20', darkColor: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        pending: { text: 'Lab Results Pending', icon: <Clock size={14} />, color: 'bg-blue-500/10 text-blue-300 border-blue-500/20', darkColor: 'bg-blue-100 text-blue-800 border-blue-200' },
        clear: { text: 'No Asbestos Detected', icon: <CheckCircle2 size={14} />, color: 'bg-green-500/10 text-green-300 border-green-500/20', darkColor: 'bg-green-100 text-green-800 border-green-200' },
        abatement_required: { text: 'Abatement Required', icon: <AlertTriangle size={14} />, color: 'bg-red-500/10 text-red-300 border-red-500/20', darkColor: 'bg-red-100 text-red-800 border-red-200' },
    };
    const current = statusMap[status];
    return (
        <div className={`inline-flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold border ${current.color} md:${current.darkColor}`}>
            {current.icon}
            <span>{current.text}</span>
        </div>
    );
};

const ComplianceChecklist: React.FC<ComplianceChecklistProps> = ({ project, onUpdate }) => {
    const { isOnline, accessToken } = useAppContext();
    const [checklist, setChecklist] = useState<ComplianceCheck[]>(project.complianceChecks?.aiChecklist || []);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Record<string, string>>({});

    useEffect(() => {
        setChecklist(project.complianceChecks?.aiChecklist || []);
    }, [project.complianceChecks?.aiChecklist]);
    
    const toggleCheck = (checkId: string) => {
        const updatedList = checklist.map(c => c.id === checkId ? { ...c, isCompleted: !c.isCompleted } : c);
        setChecklist(updatedList);
        
        const toggledItem = updatedList.find(c => c.id === checkId);
        if (toggledItem) {
            // Publish Compliance Event
            EventBus.publish(
                'com.restorationai.compliance.updated',
                { checkId: toggledItem.id, text: toggledItem.text, status: toggledItem.isCompleted },
                project.id,
                `Compliance Item "${toggledItem.text}" marked as ${toggledItem.isCompleted ? 'Complete' : 'Incomplete'}`,
                'info'
            );
        }

        if (onUpdate) {
            onUpdate({
                complianceChecks: {
                    ...(project.complianceChecks || { asbestos: 'not_tested' }),
                    aiChecklist: updatedList
                }
            });
        }
    };

    const handleGetSuggestion = async (e: React.MouseEvent, checkId: string, text: string) => {
        e.stopPropagation();
        if (!isOnline || !accessToken) return;
        setAnalyzingId(checkId);
        try {
            const ai = new GoogleGenAI({ apiKey: accessToken }); // Using OAuth Token
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `For the water mitigation compliance check: "${text}", provide a very brief (1 sentence) suggestion on what evidence or documentation is typically needed to verify this step is complete.`,
            });
            setSuggestions(prev => ({ ...prev, [checkId]: response.text || "No specific suggestion available." }));
        } catch (error) {
            console.error(error);
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
            <section className="glass-card p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem]">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20"><AlertTriangle size={24} /></div>
                    <div>
                        <h3 className="font-black text-white tracking-tight">Compliance & Safety</h3>
                        <p className="text-xs text-slate-400 mt-0.5">AI-generated IICRC S-500 checklist.</p>
                    </div>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-3">
                        <Microscope size={18} className="text-slate-400" />
                        <h4 className="font-bold text-sm text-slate-200">Asbestos Protocol</h4>
                    </div>
                    <AsbestosStatusBadge status={project.complianceChecks?.asbestos || 'not_tested'} />
                </div>
                
                <div className="space-y-3">
                    {checklist.map(item => (
                        <motion.div 
                            key={item.id} 
                            layout
                            initial={false}
                            animate={{ 
                                backgroundColor: item.isCompleted ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                                scale: item.isCompleted ? 0.99 : 1
                            }}
                            className={`flex flex-col p-3 rounded-xl transition-colors ${item.isCompleted ? '' : 'hover:bg-white/10'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 cursor-pointer flex-1" onClick={() => toggleCheck(item.id)}>
                                    <motion.div 
                                        animate={{ 
                                            backgroundColor: item.isCompleted ? '#22c55e' : 'rgba(51, 65, 85, 1)',
                                            borderColor: item.isCompleted ? '#22c55e' : 'rgba(71, 85, 105, 1)',
                                            scale: item.isCompleted ? [1, 1.2, 1] : 1
                                        }}
                                        transition={{ duration: 0.2 }}
                                        className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center border-2 shrink-0 text-white`}
                                    >
                                        {item.isCompleted && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                            >
                                                <CheckCircle2 size={12} />
                                            </motion.div>
                                        )}
                                    </motion.div>
                                    <p className={`text-sm font-medium transition-all duration-300 ${item.isCompleted ? 'text-slate-500 line-through opacity-60' : 'text-slate-200'}`}>{item.text}</p>
                                </div>
                                <button 
                                    onClick={(e) => handleGetSuggestion(e, item.id, item.text)}
                                    className={`p-2 bg-slate-700 border border-slate-600 text-indigo-400 rounded-lg transition-colors ml-3 active:scale-95 ${!isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600'}`}
                                    title="Get AI Suggestion"
                                    disabled={analyzingId === item.id || !isOnline}
                                >
                                    {analyzingId === item.id ? <Loader2 size={14} className="animate-spin" /> : isOnline ? <Sparkles size={14} /> : <WifiOff size={14} />}
                                </button>
                            </div>
                            <AnimatePresence>
                                {suggestions[item.id] && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        className="ml-8 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 flex items-start overflow-hidden"
                                    >
                                        <BrainCircuit size={14} className="mr-2 mt-0.5 shrink-0" />
                                        <span className="leading-relaxed">{suggestions[item.id]}</span>
                                        <button onClick={() => setSuggestions(prev => { const n = {...prev}; delete n[item.id]; return n; })} className="ml-auto pl-2 text-indigo-400 hover:text-indigo-200"><X size={14} /></button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </section>
    );
};

export default ComplianceChecklist;
