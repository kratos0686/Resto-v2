
import React, { useState, useEffect } from 'react';
import { UserPlus, Building, Users, CheckSquare, Square } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Company, User, Permission, UserRole } from '../types';
import { getCompanyUsers, getAllCompanies, createUser, createCompany, updateUserPermissions } from '../services/api';

const AVAILABLE_PERMISSIONS: { id: Permission; label: string }[] = [
    { id: 'view_projects', label: 'View Projects' },
    { id: 'edit_projects', label: 'Edit Projects (Logs/Photos)' },
    { id: 'view_billing', label: 'View Billing' },
    { id: 'manage_billing', label: 'Create/Send Invoices' },
    { id: 'manage_users', label: 'Manage Users' },
    { id: 'view_admin', label: 'Access Admin Panel' },
    { id: 'use_ai_tools', label: 'Use AI Features' },
];

const AdminPanel: React.FC = () => {
    const { currentUser, hasPermission } = useAppContext();
    const [view, setView] = useState<'users' | 'companies'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    
    // New Entry State
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('Technician');
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyPlan, setNewCompanyPlan] = useState<'Basic'|'Pro'|'Enterprise'>('Pro');

    useEffect(() => {
        const loadData = async () => {
            if (currentUser?.role === 'SuperAdmin') {
                const allCompanies = await getAllCompanies();
                setCompanies(allCompanies);
                // For SuperAdmin, showing users might require selecting a company first, 
                // but for simplicity we'll load users if in user view later.
            }
            if (currentUser?.companyId) {
                const companyUsers = await getCompanyUsers(currentUser.companyId);
                setUsers(companyUsers);
            }
        };
        loadData();
    }, [currentUser, view, isCreating]);

    const handleCreateUser = async () => {
        if (!newUserName || !newUserEmail || !currentUser?.companyId) return;
        setIsCreating(true);
        
        // Default permissions based on role
        let defaultPerms: Permission[] = ['view_projects'];
        if (newUserRole === 'CompanyAdmin') defaultPerms = AVAILABLE_PERMISSIONS.map(p => p.id as Permission);
        if (newUserRole === 'Technician') defaultPerms = ['view_projects', 'edit_projects', 'use_ai_tools'];

        const newUser: User = {
            id: `U-${Date.now()}`,
            name: newUserName,
            email: newUserEmail,
            role: newUserRole,
            companyId: currentUser.companyId,
            permissions: defaultPerms
        };
        
        await createUser(newUser);
        setNewUserName('');
        setNewUserEmail('');
        setIsCreating(false);
    };

    const handleCreateCompany = async () => {
        if (!newCompanyName) return;
        setIsCreating(true);
        await createCompany(newCompanyName, newCompanyPlan);
        setNewCompanyName('');
        setIsCreating(false);
    }

    const togglePermission = async (userId: string, perm: Permission, currentPerms: Permission[]) => {
        const has = currentPerms.includes(perm);
        const newPerms = has ? currentPerms.filter(p => p !== perm) : [...currentPerms, perm];
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, permissions: newPerms } : u));
        await updateUserPermissions(userId, newPerms);
    };

    if (!hasPermission('view_admin')) {
        return <div className="p-8 text-center text-red-400">Access Denied. Contact your administrator.</div>;
    }

    return (
        <div className="p-8 space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white">Administrator Panel</h1>
                    <p className="text-blue-400">Organization: <span className="font-bold text-white">{companies.find(c => c.id === currentUser?.companyId)?.name || 'System Root'}</span></p>
                </div>
                {currentUser?.role === 'SuperAdmin' && (
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setView('users')} className={`px-4 py-2 rounded-md text-sm font-bold ${view === 'users' ? 'bg-brand-cyan text-slate-900' : 'text-slate-400'}`}>Users</button>
                        <button onClick={() => setView('companies')} className={`px-4 py-2 rounded-md text-sm font-bold ${view === 'companies' ? 'bg-brand-cyan text-slate-900' : 'text-slate-400'}`}>Companies</button>
                    </div>
                )}
            </header>

            {view === 'companies' && currentUser?.role === 'SuperAdmin' && (
                <section className="glass-card rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Building size={18} /> Manage Companies</h3>
                    
                    <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                        <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Company Name" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        <select value={newCompanyPlan} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCompanyPlan(e.target.value as Company['subscriptionPlan'])} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                            <option value="Basic">Basic</option>
                            <option value="Pro">Pro</option>
                            <option value="Enterprise">Enterprise</option>
                        </select>
                        <button onClick={handleCreateCompany} className="bg-brand-cyan text-slate-900 font-bold rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2"><UserPlus size={14} /> Create Company</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-blue-400 uppercase bg-white/5">
                                <tr>
                                    <th className="p-3">Company Name</th>
                                    <th className="p-3">Plan</th>
                                    <th className="p-3">Users</th>
                                    <th className="p-3">ID</th>
                                    <th className="p-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {companies.map(comp => (
                                    <tr key={comp.id} className="hover:bg-white/5">
                                        <td className="p-3 font-bold text-white">{comp.name}</td>
                                        <td className="p-3"><span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md text-xs border border-indigo-500/30">{comp.subscriptionPlan}</span></td>
                                        <td className="p-3 text-slate-400">{comp.maxUsers} limit</td>
                                        <td className="p-3 font-mono text-xs text-slate-500">{comp.id}</td>
                                        <td className="p-3 text-right"><span className="text-green-400 text-xs font-bold uppercase">Active</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {view === 'users' && (
                <section className="glass-card rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users size={18} /> User Management</h3>
                    
                    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                        <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full Name" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email Address" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        <select value={newUserRole} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewUserRole(e.target.value as UserRole)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                            <option value="Technician">Technician</option>
                            <option value="CompanyAdmin">Company Admin</option>
                        </select>
                        <button onClick={handleCreateUser} className="bg-brand-cyan text-slate-900 font-bold rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2"><UserPlus size={14} /> Add User</button>
                    </div>

                    <div className="space-y-4">
                        {users.map(user => (
                            <div key={user.id} className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-white">{user.name}</h4>
                                        <p className="text-xs text-blue-400">{user.email} • <span className="text-slate-400">{user.role}</span></p>
                                    </div>
                                    <div className="text-xs font-mono text-slate-600">{user.id}</div>
                                </div>
                                
                                <div className="border-t border-white/10 pt-3">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Access Permissions</p>
                                    <div className="flex flex-wrap gap-2">
                                        {AVAILABLE_PERMISSIONS.map(perm => {
                                            const has = user.permissions.includes(perm.id);
                                            return (
                                                <button 
                                                    key={perm.id} 
                                                    onClick={() => togglePermission(user.id, perm.id, user.permissions)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${has ? 'bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                                >
                                                    {has ? <CheckSquare size={12} /> : <Square size={12} />}
                                                    {perm.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default AdminPanel;
