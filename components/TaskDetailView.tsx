import React, { useState } from 'react';
import { AITask, SubTask } from '../types';
import { CheckCircle2, Circle, Plus, Trash2, ChevronLeft, Calendar, Flag } from 'lucide-react';

interface TaskDetailViewProps {
    task: AITask;
    onUpdate: (updatedTask: AITask) => void;
    onBack: () => void;
}

const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task, onUpdate, onBack }) => {
    const [newSubtaskText, setNewSubtaskText] = useState('');

    const toggleSubtask = (subtaskId: string) => {
        const updatedSubtasks = (task.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
        );
        onUpdate({ ...task, subtasks: updatedSubtasks });
    };

    const addSubtask = () => {
        if (!newSubtaskText.trim()) return;
        const newSubtask: SubTask = {
            id: `st-${Date.now()}`,
            text: newSubtaskText,
            isCompleted: false
        };
        onUpdate({ 
            ...task, 
            subtasks: [...(task.subtasks || []), newSubtask] 
        });
        setNewSubtaskText('');
    };

    const removeSubtask = (subtaskId: string) => {
        const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
        onUpdate({ ...task, subtasks: updatedSubtasks });
    };

    const updateSubtaskText = (subtaskId: string, newText: string) => {
        const updatedSubtasks = (task.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, text: newText } : st
        );
        onUpdate({ ...task, subtasks: updatedSubtasks });
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 animate-in fade-in slide-in-from-right duration-300">
            <header className="p-4 border-b border-white/10 flex items-center space-x-4">
                <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-bold text-white truncate">{task.text}</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                            <Calendar size={12} className="mr-1" /> Due Date
                        </label>
                        <input 
                            type="date"
                            value={task.dueDate || ''}
                            onChange={(e) => onUpdate({ ...task, dueDate: e.target.value })}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-cyan/50"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center">
                            <Flag size={12} className="mr-1" /> Priority Level
                        </label>
                        <div className="flex p-1 bg-slate-900 border border-white/10 rounded-2xl">
                            {(['low', 'medium', 'high'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => onUpdate({ ...task, priority: p })}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        (task.priority || 'medium') === p
                                            ? p === 'high' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' :
                                              p === 'medium' ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-500/20' :
                                              'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Subtasks</h3>
                    <div className="space-y-3">
                        {(task.subtasks || []).map(st => (
                            <div key={st.id} className="flex items-center space-x-3 group">
                                <button 
                                    onClick={() => toggleSubtask(st.id)}
                                    className={`p-1 rounded-md transition-colors ${st.isCompleted ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {st.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                                <input 
                                    type="text"
                                    value={st.text}
                                    onChange={(e) => updateSubtaskText(st.id, e.target.value)}
                                    className={`flex-1 bg-transparent border-none focus:ring-0 text-sm transition-all ${st.isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}
                                />
                                <button 
                                    onClick={() => removeSubtask(st.id)}
                                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}

                        <div className="flex items-center space-x-3 pt-2">
                            <div className="p-1 text-slate-600">
                                <Plus size={20} />
                            </div>
                            <input 
                                type="text"
                                placeholder="Add a subtask..."
                                value={newSubtaskText}
                                onChange={(e) => setNewSubtaskText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-400 placeholder-slate-600"
                            />
                            {newSubtaskText && (
                                <button 
                                    onClick={addSubtask}
                                    className="px-3 py-1 bg-brand-cyan text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                >
                                    Add
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailView;
