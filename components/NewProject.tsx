
import React, { useState } from 'react';
import { ArrowLeft, Check, Loader2, Mic, Sparkles, MapPin, Search, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { addProject } from '../services/api';
import { WaterCategory, LossClass } from '../types';
import { Type } from '@google/genai';
import { IntelligenceRouter } from '../services/IntelligenceRouter';
import { EventBus } from '../services/EventBus';

const NewProject: React.FC = () => {
    const { setActiveTab, setSelectedProjectId, currentUser, isOnline } = useAppContext();
    const [isSaving, setIsSaving] = useState(false);
    const [isScribing, setIsScribing] = useState(false);
    const [scribeText, setScribeText] = useState('');
    
    // Address State
    const [isLocating, setIsLocating] = useState(false);
    
    // Address Lookup State (Kept for fallback if needed, but primary GPS button now uses Geolocation)
    const [showMapSearch, setShowMapSearch] = useState(false);
    const [mapQuery, setMapQuery] = useState('');
    const [isMapSearching, setIsMapSearching] = useState(false);

    const [lossInfo, setLossInfo] = useState({
        location: '',
        lossDate: new Date().toISOString().slice(0, 16),
        clientName: '',
        claimNumber: '',
        insurance: '',
        jobType: 'Water'
    });

    const handleScribe = async () => {
        if (!scribeText.trim() || !isOnline) return;
        setIsScribing(true);
        try {
            const router = new IntelligenceRouter();
            const response = await router.execute('FAST_ANALYSIS', 
                `Extract project details from this field note: "${scribeText}". 
                Identify: clientName, location, insurance, claimNumber, waterCategory (CAT_1, CAT_2, or CAT_3), and lossClass (CLASS_1, CLASS_2, CLASS_3, or CLASS_4).`,
                {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            clientName: { type: Type.STRING },
                            location: { type: Type.STRING },
                            insurance: { type: Type.STRING },
                            claimNumber: { type: Type.STRING },
                            waterCategory: { type: Type.STRING },
                            lossClass: { type: Type.STRING }
                        }
                    }
                }
            );
            const data = JSON.parse(response.text || '{}');
            setLossInfo(prev => ({
                ...prev,
                clientName: data.clientName || prev.clientName,
                location: data.location || prev.location,
                insurance: data.insurance || prev.insurance,
                claimNumber: data.claimNumber || prev.claimNumber
            }));
            setScribeText('');
        } catch (err) {
            console.error("Scribe failed", err);
        } finally {
            setIsScribing(false);
        }
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            
            if (!isOnline) {
                // Offline fallback: just set coordinates
                setLossInfo(prev => ({ ...prev, location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
                setIsLocating(false);
                return;
            }

            try {
                const router = new IntelligenceRouter();
                // Use Gemini with Google Maps tool to reverse geocode
                const response = await router.execute('LOCATION_SERVICES', 
                    `What is the exact postal address at latitude ${latitude} and longitude ${longitude}? Return ONLY the full address string.`,
                    { tools: [{ googleSearch: {} }] }
                );
                
                if (response.text) {
                    setLossInfo(prev => ({ ...prev, location: response.text!.trim() }));
                }
            } catch (error) {
                console.error("Reverse geocoding failed", error);
                // Fallback to coords
                setLossInfo(prev => ({ ...prev, location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
            } finally {
                setIsLocating(false);
            }
        }, (error) => {
            console.error("Geolocation error", error);
            setIsLocating(false);
            alert("Unable to retrieve location. Check permissions.");
        });
    };

    const handleAddressLookup = async () => {
        if (!mapQuery.trim() || !isOnline) return;
        setIsMapSearching(true);
        try {
            const router = new IntelligenceRouter();
            const response = await router.execute('LOCATION_SERVICES', 
                `Find the exact postal address for "${mapQuery}". Return ONLY the full address string in the response.`,
                { tools: [{ googleSearch: {} }] }
            );
            
            if (response.text) {
                setLossInfo(prev => ({ ...prev, location: response.text!.trim() }));
                setShowMapSearch(false);
                setMapQuery('');
            }
        } catch (error) {
            console.error("Map lookup failed", error);
        } finally {
            setIsMapSearching(false);
        }
    };

    const handleSubmit = async () => {
        if (!currentUser?.companyId || !lossInfo.clientName || !lossInfo.location) {
            alert("Please fill in required fields (Location, Client Name).");
            return;
        }
        
        setIsSaving(true);
        const newLoss = await addProject({
            companyId: currentUser.companyId,
            client: lossInfo.clientName,
            address: lossInfo.location,
            lossDate: lossInfo.lossDate,
            insurance: lossInfo.insurance,
            claimNumber: lossInfo.claimNumber,
            status: 'New Intake',
            currentStage: 'Intake',
            waterCategory: WaterCategory.CAT_1,
            lossClass: LossClass.CLASS_1,
            progress: 0,
            riskLevel: 'medium',
            rooms: [],
            milestones: [],
            tasks: [],
            lineItems: [],
            totalCost: 0,
            invoiceStatus: 'Draft',
            roomScans: [],
            videos: [],
            equipment: [],
            dailyNarratives: [],
            dryingMonitor: [],
        } as Omit<Project, 'id'>);

        if (!newLoss) {
            alert('Failed to add project. Please check if the server is running or try again.');
            setIsSaving(false);
            return;
        }

        // Publish CloudEvent
        EventBus.publish(
            'com.restorationai.project.created',
            { 
                projectId: newLoss.id, 
                client: newLoss.client, 
                category: newLoss.waterCategory 
            },
            newLoss.id,
            `Project file initialized for ${newLoss.client}`,
            'success'
        );

        setSelectedProjectId(newLoss.id);
        setActiveTab('loss-detail');
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            <header className="bg-slate-900 border-b border-white/10 py-4 px-4 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setActiveTab('losses')} className="text-slate-400 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
                    <h1 className="text-xl font-black tracking-tight text-white">Loss Intake</h1>
                </div>
                <button 
                    onClick={handleSubmit} 
                    disabled={isSaving}
                    className="bg-brand-cyan text-slate-950 px-6 py-2 rounded-full text-sm font-black flex items-center space-x-2 disabled:opacity-70 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]"
                >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    <span>Start Job</span>
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-20">
                {/* AI Scribe Section */}
                <div className="bg-gradient-to-br from-indigo-600/20 to-blue-600/10 p-6 rounded-[2.5rem] border border-indigo-500/20 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-all duration-700" />
                    <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400"><Sparkles size={20} /></div>
                            <h3 className="font-black text-white text-sm uppercase tracking-widest">Intelligent Scribe</h3>
                        </div>
                        <div className="relative">
                            <textarea 
                                value={scribeText}
                                onChange={e => setScribeText(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 outline-none min-h-[100px] placeholder-slate-600 text-white"
                                placeholder="Example: 'At Sarah Johnson's house 124 Maple, State Farm claim 9876, standing water in basement...'"
                            />
                            <button 
                                onClick={handleScribe}
                                disabled={isScribing || !scribeText.trim()}
                                className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all active:scale-90"
                            >
                                {isScribing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 font-bold uppercase text-center tracking-tighter">AI will automatically populate the fields below</p>
                    </div>
                </div>

                {/* Form Information */}
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                    <div className="flex items-center space-x-2 px-1">
                        <div className="w-1 h-4 bg-brand-cyan rounded-full" />
                        <h3 className="text-white font-bold text-lg">Essential Record</h3>
                    </div>
                    <div className="grid gap-4">
                        <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-6 shadow-inner">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest">Risk Address*</label>
                                <div className="relative group">
                                    <input 
                                        value={lossInfo.location}
                                        onChange={e => setLossInfo({...lossInfo, location: e.target.value})}
                                        className="w-full bg-slate-900/50 text-lg font-bold text-white border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" 
                                        placeholder="123 Example St" 
                                    />
                                    <button 
                                        onClick={handleUseMyLocation}
                                        disabled={isLocating}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-brand-cyan hover:bg-white/5 rounded-lg transition-colors active:scale-90"
                                        title="Use My Location"
                                    >
                                        {isLocating ? <Loader2 size={20} className="animate-spin text-brand-cyan" /> : <MapPin size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name*</label>
                                <input 
                                    value={lossInfo.clientName}
                                    onChange={e => setLossInfo({...lossInfo, clientName: e.target.value})}
                                    className="w-full bg-slate-900/50 text-lg font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" 
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Insurance</label>
                                    <input 
                                        value={lossInfo.insurance}
                                        onChange={e => setLossInfo({...lossInfo, insurance: e.target.value})}
                                        className="w-full bg-slate-900/50 text-sm font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" 
                                        placeholder="Carrier"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Claim #</label>
                                    <input 
                                        value={lossInfo.claimNumber}
                                        onChange={e => setLossInfo({...lossInfo, claimNumber: e.target.value})}
                                        className="w-full bg-slate-900/50 text-sm font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all" 
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map Search Modal (Kept as backup if needed, but primary is GPS) */}
            {showMapSearch && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl space-y-6 relative overflow-hidden">
                        {/* Background Glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-[50px] rounded-full pointer-events-none" />
                        
                        <div className="flex justify-between items-center relative z-10">
                            <h3 className="text-white font-black text-lg flex items-center gap-2"><Search size={22} className="text-brand-cyan"/> Address Search</h3>
                            <button onClick={() => setShowMapSearch(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white transition-colors"><X size={20}/></button>
                        </div>
                        
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">Search for a business name, landmark, or partial address. Gemini will locate the exact postal address.</p>
                        
                        <div className="relative">
                            <input 
                                autoFocus
                                value={mapQuery}
                                onChange={e => setMapQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddressLookup()}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-4 pr-12 text-white text-sm font-bold focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 focus:outline-none transition-all placeholder-slate-600"
                                placeholder="e.g. 'Home Depot downtown Seattle'"
                            />
                            <button 
                                onClick={handleAddressLookup}
                                disabled={isMapSearching || !mapQuery.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-cyan text-slate-900 rounded-lg disabled:opacity-50 transition-all hover:bg-cyan-400 active:scale-95"
                            >
                                {isMapSearching ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewProject;
