
import React, { useState } from 'react';
import { Play, Camera, Mic, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Save, ArrowLeft, Plus, Minus, Power, PowerOff, MapPin, Thermometer, Wind, Droplets, AlertCircle } from 'lucide-react';
import { calculatePsychrometricsFromDryBulb } from '../utils/psychrometrics';
import { useAppContext } from '../context/AppContext';
import { Project, TrackedMaterial } from '../types';
import { EventBus } from '../services/EventBus';
import { BUILDING_MATERIALS } from '../data/materials';

interface DryingLogsProps {
  project: Project;
  onUpdate?: (updates: Partial<Project>) => void;
}

const DryingLogs: React.FC<DryingLogsProps> = ({ project, onUpdate }) => {
  const { currentUser } = useAppContext();
  const [isLogging, setIsLogging] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [now] = useState(() => new Date().getTime());

  const trackedMaterials = project.dryingMonitor || [];
  const equipment = project.equipment || [];

  // Wizard State
  const [logData, setLogData] = useState({
    visitType: 'Day 1',
    overallStatus: 'Drying',
    atmospherics: {
      outside: { temp: '', rh: '' },
      unaffected: { temp: '', rh: '' },
      affected: { temp: '', rh: '' },
      dehu: { temp: '', rh: '' }
    },
    moisture: {} as Record<string, string>,
    equipment: equipment.reduce((acc, eq) => ({ ...acc, [eq.id]: eq.status }), {} as Record<string, string>),
    consumables: 0,
    notes: '',
    newMaterialsToAdd: [] as { id: string, name: string, location: string, goal: string, reading: string }[]
  });

  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMatForm, setNewMatForm] = useState({ name: BUILDING_MATERIALS[0].items[0].name, location: '', goal: '12', reading: '' });

  const updateAtmospherics = (zone: keyof typeof logData.atmospherics, field: 'temp' | 'rh', value: string) => {
    setLogData(prev => ({
      ...prev,
      atmospherics: {
        ...prev.atmospherics,
        [zone]: { ...prev.atmospherics[zone], [field]: value }
      }
    }));
  };

  const updateMoisture = (matId: string, value: string) => {
    setLogData(prev => ({
      ...prev,
      moisture: { ...prev.moisture, [matId]: value }
    }));
  };

  const toggleEquipment = (eqId: string) => {
    setLogData(prev => {
      const current = prev.equipment[eqId];
      const next = current === 'Running' ? 'Off' : 'Running';
      return { ...prev, equipment: { ...prev.equipment, [eqId]: next } };
    });
  };

  const toggleRoom = (room: string) => {
    setExpandedRooms(prev => ({ ...prev, [room]: !prev[room] }));
  };

  const handleSaveLog = () => {
    const timestamp = new Date().getTime();
    // 1. Build Narrative
    let narrative = `${logData.visitType} - ${logData.overallStatus}. `;
    const aff = logData.atmospherics.affected;
    const deh = logData.atmospherics.dehu;
    if (aff.temp && aff.rh) narrative += `Affected: ${aff.temp}°F/${aff.rh}%. `;
    if (deh.temp && deh.rh) narrative += `Dehu: ${deh.temp}°F/${deh.rh}%. `;
    if (logData.notes) narrative += `Notes: ${logData.notes} `;

    // 2. Update Materials
    const newMaterials = trackedMaterials.map(mat => {
      const readingStr = logData.moisture[mat.id];
      if (readingStr) {
        const readingVal = parseFloat(readingStr);
        return {
          ...mat,
          status: readingVal <= mat.dryGoal ? 'Dry' : 'Wet' as 'Dry' | 'Wet',
          readings: [...mat.readings, { timestamp, value: readingVal, dateStr: new Date().toLocaleDateString(undefined, { weekday: 'short' }) }]
        };
      }
      return mat;
    });

    logData.newMaterialsToAdd.forEach(newMat => {
      const readingVal = parseFloat(newMat.reading);
      const goalVal = parseFloat(newMat.goal);
      if (!isNaN(readingVal) && !isNaN(goalVal)) {
        newMaterials.push({
          id: newMat.id,
          name: newMat.name,
          location: newMat.location,
          type: newMat.name,
          dryGoal: goalVal,
          initialReading: readingVal,
          readings: [{ timestamp, value: readingVal, dateStr: new Date().toLocaleDateString(undefined, { weekday: 'short' }) }],
          status: readingVal <= goalVal ? 'Dry' : 'Wet'
        });
        narrative += `Added ${newMat.name} in ${newMat.location} at ${readingVal}%. `;
      }
    });

    // 3. Update Equipment
    const newEquipment = equipment.map(eq => ({
      ...eq,
      status: logData.equipment[eq.id] as 'Running' | 'Off' | 'Removed'
    }));

    // 4. Publish Event & Update State
    EventBus.publish('com.restorationai.drying.recorded', { projectId: project.id, logData }, project.id, narrative, 'success');

    if (onUpdate) {
      onUpdate({
        dryingMonitor: newMaterials,
        equipment: newEquipment,
        dailyNarratives: [{
          id: `log-${timestamp}`,
          date: new Date().toLocaleDateString(),
          timestamp: timestamp,
          content: narrative,
          author: currentUser?.name || 'Tech',
          tags: ['Psychrometrics', 'Daily Log'],
          generated: false
        }, ...(project.dailyNarratives || [])]
      });
    }

    setIsLogging(false);
    setCurrentStep(1);
  };

  // --- Render Helpers ---

  const renderZoneInput = (zone: keyof typeof logData.atmospherics, label: string, icon: React.ReactNode) => {
    const data = logData.atmospherics[zone];
    const tempNum = parseFloat(data.temp);
    const rhNum = parseFloat(data.rh);
    const hasData = !isNaN(tempNum) && !isNaN(rhNum);
    const psych = hasData ? calculatePsychrometricsFromDryBulb(tempNum, rhNum) : null;

    return (
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center space-x-2 text-slate-300">
          {icon}
          <h4 className="text-sm font-bold uppercase tracking-widest">{label}</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase">Temp (°F)</label>
            <input type="number" value={data.temp} onChange={e => updateAtmospherics(zone, 'temp', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-lg font-bold text-center text-white outline-none focus:border-brand-cyan transition-all" placeholder="--" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold uppercase">RH (%)</label>
            <input type="number" value={data.rh} onChange={e => updateAtmospherics(zone, 'rh', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-lg font-bold text-center text-white outline-none focus:border-brand-cyan transition-all" placeholder="--" />
          </div>
        </div>
        {hasData && psych && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">GPP</div>
              <div className="text-brand-cyan font-mono font-bold">{psych.gpp}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Dew Point</div>
              <div className="text-brand-cyan font-mono font-bold">{psych.dewPoint}°F</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getMoistureColor = (readingStr: string, goal: number) => {
    if (!readingStr) return 'border-white/10 text-white';
    const reading = parseFloat(readingStr);
    if (isNaN(reading)) return 'border-white/10 text-white';
    if (reading <= goal) return 'border-emerald-500 text-emerald-400 bg-emerald-500/10';
    if (reading <= goal * 1.2) return 'border-yellow-500 text-yellow-400 bg-yellow-500/10';
    return 'border-red-500 text-red-400 bg-red-500/10';
  };

  // Group materials by location
  const materialsByLocation = trackedMaterials.reduce((acc, mat) => {
    if (!acc[mat.location]) acc[mat.location] = [];
    acc[mat.location].push(mat);
    return acc;
  }, {} as Record<string, TrackedMaterial[]>);

  // --- Main Render ---

  if (!isLogging) {
    // DASHBOARD VIEW
    return (
      <div className="space-y-6 pb-24">
        {/* Top Card */}
        <div className="bg-gradient-to-br from-brand-blue/20 to-brand-cyan/10 border border-brand-cyan/30 rounded-[2rem] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/20 blur-[50px] rounded-full" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">{project.client}</h2>
                <p className="text-sm text-brand-cyan font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Day {Math.max(1, Math.floor((now - new Date(project.startDate || now).getTime()) / (1000 * 60 * 60 * 24)))}
              </div>
            </div>
            <button onClick={() => setIsLogging(true)} className="w-full py-4 bg-brand-cyan hover:bg-cyan-400 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg shadow-brand-cyan/20 transition-all active:scale-95">
              <Play size={18} fill="currentColor" />
              <span>Start Today's Log</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-all">
            <Camera size={24} className="mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Quick Photo</span>
          </button>
          <button className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-all">
            <Mic size={24} className="mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Voice Note</span>
          </button>
        </div>

        {/* Progress Summary */}
        <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Drying Progress</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-white mb-2">
                <span>Materials at Dry Standard</span>
                <span className="text-brand-cyan">{trackedMaterials.filter(m => m.status === 'Dry').length} / {trackedMaterials.length}</span>
              </div>
              <div className="h-2 bg-black rounded-full overflow-hidden">
                <div className="h-full bg-brand-cyan rounded-full transition-all" style={{ width: `${trackedMaterials.length ? (trackedMaterials.filter(m => m.status === 'Dry').length / trackedMaterials.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // WIZARD VIEW
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 bg-slate-900 border-b border-white/10 flex items-center justify-between shrink-0">
        <button onClick={() => setIsLogging(false)} className="p-2 -ml-2 text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <div className="flex space-x-1">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className={`w-8 h-1.5 rounded-full transition-colors ${step === currentStep ? 'bg-brand-cyan' : step < currentStep ? 'bg-brand-cyan/50' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        
        {/* STEP 1: Atmospherics */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Atmospheric Data</h2>
              <p className="text-sm text-slate-400 mt-1">Record psychrometric conditions.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Visit Type</label>
                <select value={logData.visitType} onChange={e => setLogData({...logData, visitType: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan">
                  <option>Initial Extraction</option>
                  <option>Day 1</option>
                  <option>Day 2</option>
                  <option>Day 3</option>
                  <option>Final Monitoring</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Status</label>
                <select value={logData.overallStatus} onChange={e => setLogData({...logData, overallStatus: e.target.value})} className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan">
                  <option>Drying</option>
                  <option>Stable</option>
                  <option>Ready for Teardown</option>
                  <option>Completed</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {renderZoneInput('affected', 'Affected Area', <Thermometer size={16} className="text-red-400" />)}
              {renderZoneInput('dehu', 'Dehumidifier Output', <Wind size={16} className="text-brand-cyan" />)}
              {renderZoneInput('unaffected', 'Unaffected Area', <CheckCircle2 size={16} className="text-emerald-400" />)}
              {renderZoneInput('outside', 'Outside', <MapPin size={16} className="text-slate-400" />)}
            </div>

            {/* Validation Warning */}
            {logData.atmospherics.affected.temp && logData.atmospherics.dehu.temp && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
                <AlertTriangle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-200/80 leading-relaxed">
                  <span className="font-bold text-yellow-400 block mb-1">Psychrometric Check</span>
                  Ensure Dehu GPP is significantly lower than Affected GPP for optimal evaporation.
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Moisture Mapping */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Moisture Mapping</h2>
              <p className="text-sm text-slate-400 mt-1">Record daily material readings.</p>
            </div>

            {Object.keys(materialsByLocation).length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No materials tracked yet.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(materialsByLocation).map(([location, mats]) => (
                  <div key={location} className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                    <button 
                      onClick={() => toggleRoom(location)}
                      className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Droplets size={18} className="text-brand-cyan" />
                        <span className="font-bold text-white">{location}</span>
                      </div>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${expandedRooms[location] ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {expandedRooms[location] && (
                      <div className="p-4 space-y-4 border-t border-white/5 bg-black/20">
                        {mats.map(mat => (
                          <div key={mat.id} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <div>
                                <div className="text-sm font-bold text-white">{mat.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Goal: {mat.dryGoal}</div>
                              </div>
                              <div className="w-24">
                                <input 
                                  type="number" 
                                  value={logData.moisture[mat.id] || ''}
                                  onChange={e => updateMoisture(mat.id, e.target.value)}
                                  className={`w-full bg-slate-950 border-2 rounded-xl p-2 text-center font-black outline-none transition-colors ${getMoistureColor(logData.moisture[mat.id], mat.dryGoal)}`}
                                  placeholder="--"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New Materials Added in this session */}
            {logData.newMaterialsToAdd.length > 0 && (
              <div className="bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-brand-cyan uppercase tracking-widest">New Materials Added</h3>
                {logData.newMaterialsToAdd.map(mat => (
                  <div key={mat.id} className="flex justify-between items-end bg-black/40 p-3 rounded-xl border border-brand-cyan/10">
                    <div>
                      <div className="text-sm font-bold text-white">{mat.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest">{mat.location} • Goal: {mat.goal}</div>
                    </div>
                    <div className="text-lg font-black text-brand-cyan">{mat.reading}%</div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Material Form */}
            {!showAddMaterial ? (
              <button 
                onClick={() => setShowAddMaterial(true)}
                className="w-full p-4 rounded-2xl border border-dashed border-white/20 flex items-center justify-center space-x-2 text-slate-400 hover:text-white hover:border-white/40 transition-all"
              >
                <Plus size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Add Material</span>
              </button>
            ) : (
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Add New Material</h3>
                  <button onClick={() => setShowAddMaterial(false)} className="text-slate-500 hover:text-white"><Minus size={16} /></button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Material</label>
                    <select 
                      value={newMatForm.name} 
                      onChange={e => setNewMatForm({...newMatForm, name: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan text-ellipsis overflow-hidden"
                    >
                      {BUILDING_MATERIALS.map(category => (
                        <optgroup key={category.id} label={category.name}>
                          {category.items.map(item => (
                            <option key={item.name} value={item.name}>{item.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Location</label>
                    <input 
                      type="text" 
                      value={newMatForm.location} 
                      onChange={e => setNewMatForm({...newMatForm, location: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan"
                      placeholder="e.g. Living Room"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Dry Goal (%)</label>
                    <input 
                      type="number" 
                      value={newMatForm.goal} 
                      onChange={e => setNewMatForm({...newMatForm, goal: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan"
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Reading (%)</label>
                    <input 
                      type="number" 
                      value={newMatForm.reading} 
                      onChange={e => setNewMatForm({...newMatForm, reading: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-brand-cyan"
                      placeholder="--"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (newMatForm.location && newMatForm.reading) {
                      setLogData(prev => ({
                        ...prev,
                        newMaterialsToAdd: [...prev.newMaterialsToAdd, { ...newMatForm, id: `new-mat-${Date.now()}` }]
                      }));
                      setNewMatForm({ name: BUILDING_MATERIALS[0].items[0].name, location: '', goal: '12', reading: '' });
                      setShowAddMaterial(false);
                    }
                  }}
                  disabled={!newMatForm.location || !newMatForm.reading}
                  className="w-full py-3 bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-brand-cyan/20 disabled:hover:text-brand-cyan rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                >
                  Save Material
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Equipment & Materials */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Equipment & Materials</h2>
              <p className="text-sm text-slate-400 mt-1">Verify equipment status and consumables.</p>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Equipment Status</h3>
              {equipment.length === 0 ? (
                <div className="text-slate-500 text-xs py-2">No equipment placed.</div>
              ) : (
                <div className="space-y-3">
                  {equipment.map(eq => {
                    const status = logData.equipment[eq.id] || eq.status;
                    const isRunning = status === 'Running';
                    return (
                      <div key={eq.id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <div>
                          <div className="text-sm font-bold text-white">{eq.type}</div>
                          <div className="text-[10px] text-slate-500">{eq.model} • {eq.room}</div>
                        </div>
                        <button 
                          onClick={() => toggleEquipment(eq.id)}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${isRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-white/10'}`}
                        >
                          {isRunning ? <Power size={14} /> : <PowerOff size={14} />}
                          <span>{isRunning ? 'Running' : 'Off'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Consumables Used</h3>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                <div>
                  <div className="text-sm font-bold text-white">Antimicrobial</div>
                  <div className="text-[10px] text-slate-500">Gallons applied today</div>
                </div>
                <div className="flex items-center space-x-4 bg-slate-950 rounded-lg p-1 border border-white/10">
                  <button onClick={() => setLogData(p => ({...p, consumables: Math.max(0, p.consumables - 1)}))} className="p-2 text-slate-400 hover:text-white"><Minus size={16} /></button>
                  <span className="font-mono font-bold text-white w-4 text-center">{logData.consumables}</span>
                  <button onClick={() => setLogData(p => ({...p, consumables: p.consumables + 1}))} className="p-2 text-slate-400 hover:text-white"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Sign-Off */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Review & Sign-Off</h2>
              <p className="text-sm text-slate-400 mt-1">Verify log details before saving.</p>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Technician Notes</h3>
              <textarea 
                value={logData.notes}
                onChange={e => setLogData({...logData, notes: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-brand-cyan min-h-[120px] resize-none"
                placeholder="General observations, leak source confirmed, etc..."
              />
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Summary Checklist</h3>
              
              <div className="flex items-center space-x-3 text-sm">
                {logData.atmospherics.affected.temp ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-yellow-500" />}
                <span className={logData.atmospherics.affected.temp ? 'text-slate-300' : 'text-yellow-500 font-bold'}>Affected Atmospherics</span>
              </div>
              
              <div className="flex items-center space-x-3 text-sm">
                {Object.keys(logData.moisture).length > 0 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-yellow-500" />}
                <span className={Object.keys(logData.moisture).length > 0 ? 'text-slate-300' : 'text-yellow-500 font-bold'}>Moisture Readings ({Object.keys(logData.moisture).length} logged)</span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Footer Navigation */}
      <div className="p-6 bg-slate-900 border-t border-white/10 shrink-0">
        {currentStep < 4 ? (
          <button 
            onClick={() => setCurrentStep(prev => prev + 1)}
            className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 transition-all"
          >
            <span>Continue</span>
            <ChevronRight size={18} />
          </button>
        ) : (
          <button 
            onClick={handleSaveLog}
            className="w-full py-4 bg-brand-cyan text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg shadow-brand-cyan/20 active:scale-95 transition-all"
          >
            <Save size={18} />
            <span>Save to Job Profile</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DryingLogs;
