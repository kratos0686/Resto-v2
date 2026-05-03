import React, { useState, useMemo, useCallback } from 'react';
import { Project, AITask } from '../types';
import { ListChecks, Plus, ChevronRight, CheckCircle2, Circle, Calendar, Flag, BrainCircuit, Loader2 } from 'lucide-react';
import TaskDetailView from './TaskDetailView';
import { IntelligenceRouter } from '../services/IntelligenceRouter';
import { useAppContext } from '../context/AppContext';

interface TaskManagerProps {
    project: Project;
    onUpdate: (updates: Partial<Project>) => void;
}

const TaskManager: React.FC<TaskManagerProps> = ({ project, onUpdate }) => {
    const { isOnline } = useAppContext();
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [newTaskText, setNewTaskText] = useState('');
    const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'none'>('none');
    const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

    const tasks = useMemo(() => project.tasks || [], [project.tasks]);

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            if (sortBy === 'dueDate') {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            if (sortBy === 'priority') {
                const priorityMap = { high: 0, medium: 1, low: 2 };
                const aP = a.priority ? priorityMap[a.priority] : 3;
                const bP = b.priority ? priorityMap[b.priority] : 3;
                return aP - bP;
            }
            return 0;
        });
    }, [tasks, sortBy]);

    const handleAddTask = useCallback(() => {
        if (!newTaskText.trim()) return;
        const newTask: AITask = {
            id: `task-${Date.now()}`,
            text: newTaskText,
            isCompleted: false,
            subtasks: []
        };
        onUpdate({ tasks: [...tasks, newTask] });
        setNewTaskText('');
    }, [newTaskText, tasks, onUpdate]);

    const handleGenerateAITasks = async () => {
        if (!isOnline) return;
        setIsGeneratingTasks(true);
        try {
            const router = new IntelligenceRouter();
            
            const today = new Date().toLocaleDateString();
            const dryLogContext = project.dryingMonitor?.map(d => `${d.name} (${d.location}): ${d.status}, Goal: ${d.dryGoal}%`).join('; ') || 'No dry log entered yet';
            const scopesContext = project.lineItems?.map(l => `${l.code || ''} ${l.description} (Qty: ${l.quantity})`).join('; ') || 'No scoping items yet';
            const existingTasksContext = tasks.map(t => t.text).join('; ') || 'No existing tasks';

            const context = `Project: ${project.client}, Summary: ${project.summary || 'None'}. Today's Date: ${today}.
            Dry Log (Tracked Materials): ${dryLogContext}.
            Scopes (Line Items to complete): ${scopesContext}.
            Existing Tasks: ${existingTasksContext}.
            Focus on generating actionable to-do tasks from the dry log (e.g. daily moisture readings for wet items, taking tear out photos) and scopes (line items) that are not completed for that day.`;
            
            const response = await router.generateTasks(context);
            
            const generatedTasks = JSON.parse(response.text || "[]");
            const newTasks: AITask[] = generatedTasks.map((t: {text: string, priority: string}, i: number) => ({
                id: `ai-task-${Date.now()}-${i}`,
                text: t.text,
                isCompleted: false,
                priority: t.priority,
                subtasks: []
            }));

            onUpdate({ tasks: [...tasks, ...newTasks] });
        } catch (error) {
            console.error("Failed to generate tasks:", error);
        } finally {
            setIsGeneratingTasks(false);
        }
    };

    const handleUpdateTask = (updatedTask: AITask) => {
        const updatedTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
        onUpdate({ tasks: updatedTasks });
    };

    const toggleTaskCompletion = (taskId: string) => {
        const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t);
        onUpdate({ tasks: updatedTasks });
    };

    const selectedTask = tasks.find(t => t.id === selectedTaskId);

    if (selectedTaskId && selectedTask) {
        return (
            <TaskDetailView 
                task={selectedTask} 
                onUpdate={handleUpdateTask} 
                onBack={() => setSelectedTaskId(null)} 
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-brand-cyan/10 text-brand-cyan rounded-2xl border border-brand-cyan/20">
                        <ListChecks size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white tracking-tight">Project Tasks</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Manage job-specific action items.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setSortBy(sortBy === 'dueDate' ? 'none' : 'dueDate')}
                        className={`p-2 rounded-xl border transition-all flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest ${sortBy === 'dueDate' ? 'bg-brand-cyan text-slate-900 border-brand-cyan' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                        <Calendar size={14} />
                        <span>Date</span>
                    </button>
                    <button 
                        onClick={() => setSortBy(sortBy === 'priority' ? 'none' : 'priority')}
                        className={`p-2 rounded-xl border transition-all flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest ${sortBy === 'priority' ? 'bg-brand-cyan text-slate-900 border-brand-cyan' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}
                    >
                        <Flag size={14} />
                        <span>Priority</span>
                    </button>
                </div>
            </header>

            <div className="space-y-4">
                <div className="relative group flex space-x-2">
                    <div className="relative flex-1">
                        <input 
                            type="text"
                            placeholder="Create a new task..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-4 pr-12 text-sm font-medium text-white focus:outline-none focus:border-brand-cyan/50 transition-all"
                        />
                        <button 
                            onClick={handleAddTask}
                            disabled={!newTaskText.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-brand-cyan text-slate-900 rounded-xl disabled:opacity-50 transition-all"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    <button 
                        onClick={handleGenerateAITasks}
                        disabled={isGeneratingTasks || !isOnline}
                        className="px-4 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl hover:bg-indigo-600/30 transition-all flex items-center justify-center disabled:opacity-50"
                        title="Auto-Generate Tasks with AI"
                    >
                        {isGeneratingTasks ? <Loader2 size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                    </button>
                </div>

                <div className="space-y-2">
                    {sortedTasks.map(task => (
                        <div 
                            key={task.id}
                            className="group bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer"
                            onClick={() => setSelectedTaskId(task.id)}
                        >
                            <div className="flex items-center space-x-4 flex-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(task.id); }}
                                    className={`p-1 rounded-md transition-colors ${task.isCompleted ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {task.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className={`text-sm font-bold ${task.isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                            {task.text}
                                        </p>
                                        <div className="flex items-center space-x-2">
                                            {task.priority && (
                                                <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border ${
                                                    task.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                    'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }`}>
                                                    <div className={`w-1 h-1 rounded-full ${
                                                        task.priority === 'high' ? 'bg-red-500' :
                                                        task.priority === 'medium' ? 'bg-yellow-500' :
                                                        'bg-blue-500'
                                                    }`} />
                                                    <span className="text-[8px] font-black uppercase tracking-widest">
                                                        {task.priority}
                                                    </span>
                                                </div>
                                            )}
                                            {task.dueDate && (
                                                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-950 border border-white/5 text-slate-500">
                                                    <Calendar size={10} />
                                                    <span className="text-[8px] font-mono">
                                                        {task.dueDate}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                            {task.subtasks.filter(st => st.isCompleted).length} / {task.subtasks.length} Subtasks
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-600 group-hover:text-white transition-colors ml-4" />
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-center py-12 text-slate-600">
                            <ListChecks size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-medium">No tasks created yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskManager;
