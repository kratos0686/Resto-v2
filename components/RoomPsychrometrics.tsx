import React, { useState } from 'react';
import { Plus, Thermometer, Droplets, Wind, History, Save, ChevronRight, Activity } from 'lucide-react';
import { Project, Room, Reading, TrackedMaterial, MaterialReading } from '../types';
import { calculatePsychrometricsFromDryBulb } from '../utils/psychrometrics';

interface Props {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
}

export default function RoomPsychrometrics({ project, onUpdate }: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(project.rooms?.[0]?.id || null);
  
  // Daily log state for the selected room
  const [logForm, setLogForm] = useState<{ temp: string; rh: string; materials: Record<string, string> }>({
    temp: '',
    rh: '',
    materials: {}
  });

  // Add new material state
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: '', goal: '10', initial: '' });

  const handleCreateRoom = () => {
    const name = prompt('Room Name:');
    if (!name) return;
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name,
      dimensions: { length: 0, width: 0, height: 0 },
      readings: [],
      photos: [],
      status: 'wet'
    };
    onUpdate({ rooms: [...(project.rooms || []), newRoom] });
    setSelectedRoomId(newRoom.id);
  };

  const selectedRoom = project.rooms?.find(r => r.id === selectedRoomId);
  const roomMaterials = project.dryingMonitor?.filter(m => m.location === selectedRoom?.name) || [];

  const handleSaveDailyLog = () => {
    if (!selectedRoomId || !selectedRoom) return;

    const t = parseFloat(logForm.temp);
    const rh = parseFloat(logForm.rh);
    const timestamp = Date.now();
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short' });

    let updatedRooms = [...(project.rooms || [])];
    
    // 1. Save Room Atmospherics if provided
    if (!isNaN(t) && !isNaN(rh)) {
      const psychData = calculatePsychrometricsFromDryBulb(t, rh);
      const gpp = psychData ? Math.round(psychData.humidityRatio * 7000) : Math.round((rh / 100) * Math.exp(17.625 * (t - 32) / (243.04 + (t - 32))) * 20); 

      const reading: Reading = { timestamp, temp: t, rh, gpp, mc: 0 };
      updatedRooms = updatedRooms.map(r => {
        if (r.id === selectedRoomId) {
          return { ...r, readings: [...(r.readings || []), reading] };
        }
        return r;
      });
    }

    // 2. Save Material Readings
    let updatedMonitor = [...(project.dryingMonitor || [])];
    
    Object.entries(logForm.materials).forEach(([matId, valStr]) => {
      const val = parseFloat(valStr);
      if (!isNaN(val)) {
        updatedMonitor = updatedMonitor.map(m => {
          if (m.id === matId) {
            const matReading: MaterialReading = { timestamp, value: val, dateStr };
            return {
              ...m,
              readings: [...(m.readings || []), matReading],
              status: val <= m.dryGoal ? 'Dry' : 'Wet'
            };
          }
          return m;
        });
      }
    });

    onUpdate({ rooms: updatedRooms, dryingMonitor: updatedMonitor });
    
    // Reset Form
    setLogForm({ temp: '', rh: '', materials: {} });
  };

  const handleAddMaterial = () => {
    if (!selectedRoom || !newMaterial.name) return;
    const initial = parseFloat(newMaterial.initial);
    const goal = parseFloat(newMaterial.goal);
    
    if (isNaN(initial) || isNaN(goal)) return;

    const newMat: TrackedMaterial = {
      id: `mat-${Date.now()}`,
      name: newMaterial.name,
      location: selectedRoom.name,
      type: newMaterial.name,
      dryGoal: goal,
      initialReading: initial,
      readings: [{ timestamp: Date.now(), value: initial, dateStr: new Date().toLocaleDateString(undefined, { weekday: 'short' }) }],
      status: initial <= goal ? 'Dry' : 'Wet'
    };

    onUpdate({ dryingMonitor: [...(project.dryingMonitor || []), newMat] });
    setNewMaterial({ name: '', goal: '10', initial: '' });
    setShowAddMaterial(false);
  };

  return (
    <div className="flex h-full border border-white/10 rounded-2xl overflow-hidden bg-slate-900/50">
      {/* Sidebar for Rooms */}
      <div className="w-64 bg-slate-950 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-white">Rooms</h3>
          <button onClick={handleCreateRoom} className="p-2 bg-brand-cyan/20 text-brand-cyan rounded-lg hover:bg-brand-cyan/30 transition-colors">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {project.rooms?.map(room => (
            <button
              key={room.id}
              onClick={() => {
                setSelectedRoomId(room.id);
                setLogForm({ temp: '', rh: '', materials: {} });
                setShowAddMaterial(false);
              }}
              className={`w-full text-left p-4 border-b border-white/5 transition-colors ${selectedRoomId === room.id ? 'bg-white/10 border-l-2 border-l-brand-cyan' : 'hover:bg-white/5'}`}
            >
              <div className="font-bold text-white text-sm">{room.name}</div>
              <div className="text-xs text-slate-400 mt-1">{room.readings?.length || 0} readings</div>
            </button>
          ))}
          {(!project.rooms || project.rooms.length === 0) && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No rooms yet. Add a room.
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
        {selectedRoom ? (
          <div className="space-y-8 max-w-4xl mx-auto w-full">
            <header className="border-b border-white/10 pb-4">
              <h2 className="text-2xl font-black text-white">{selectedRoom.name} - Psychrometrics & Materials</h2>
              <p className="text-slate-400 text-sm mt-1">Track atmospheric and material conditions every day.</p>
            </header>

            {/* Daily Log Form */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-white/10 shadow-xl space-y-6">
              <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                <Activity size={18} className="text-brand-cyan" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Today's Reading</h3>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Room Atmospherics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Temp (°F)</label>
                    <div className="relative">
                      <Thermometer size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="number"
                        value={logForm.temp}
                        onChange={e => setLogForm(prev => ({ ...prev, temp: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white font-mono focus:outline-none focus:border-brand-cyan transition-colors"
                        placeholder="--"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">RH (%)</label>
                    <div className="relative">
                      <Wind size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="number"
                        value={logForm.rh}
                        onChange={e => setLogForm(prev => ({ ...prev, rh: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white font-mono focus:outline-none focus:border-brand-cyan transition-colors"
                        placeholder="--"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {roomMaterials.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Material Moisture Content</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {roomMaterials.map(mat => {
                      const current = mat.readings?.length > 0 ? mat.readings[mat.readings.length - 1].value : mat.initialReading;
                      return (
                        <div key={mat.id} className="bg-black/30 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <div className="text-sm font-bold text-slate-200">{mat.name}</div>
                            <div className="text-[10px] text-slate-500">Goal: {mat.dryGoal}% | Last: <span className={current <= mat.dryGoal ? 'text-emerald-400' : 'text-yellow-400'}>{current}%</span></div>
                          </div>
                          <div className="relative w-24">
                            <Droplets size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              type="number"
                              value={logForm.materials[mat.id] || ''}
                              onChange={e => setLogForm(prev => ({ ...prev, materials: { ...prev.materials, [mat.id]: e.target.value } }))}
                              className="w-full bg-slate-950 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-white font-mono text-sm focus:outline-none focus:border-brand-cyan"
                              placeholder="-- %"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSaveDailyLog}
                  disabled={!logForm.temp && !logForm.rh && Object.keys(logForm.materials).length === 0}
                  className="w-full py-3 bg-brand-cyan text-slate-900 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-400 flex justify-center items-center space-x-2 transition-colors"
                >
                  <Save size={18} />
                  <span>Save Room Log</span>
                </button>
              </div>
            </div>

            {/* Manage Materials Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Droplets size={18} className="text-blue-400" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white">Tracked Materials</h3>
                </div>
                {!showAddMaterial && (
                  <button onClick={() => setShowAddMaterial(true)} className="text-xs font-bold text-brand-cyan flex items-center bg-brand-cyan/10 px-3 py-1 rounded-full hover:bg-brand-cyan/20">
                    <Plus size={14} className="mr-1" /> Add Material
                  </button>
                )}
              </div>

              {showAddMaterial && (
                <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Material Name</label>
                      <input type="text" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="e.g. Drywall, Baseboard" className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Initial MC (%)</label>
                      <input type="number" value={newMaterial.initial} onChange={e => setNewMaterial({...newMaterial, initial: e.target.value})} placeholder="99" className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Goal MC (%)</label>
                      <input type="number" value={newMaterial.goal} onChange={e => setNewMaterial({...newMaterial, goal: e.target.value})} placeholder="10" className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setShowAddMaterial(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
                    <button onClick={handleAddMaterial} disabled={!newMaterial.name || !newMaterial.initial} className="px-4 py-2 text-xs font-bold bg-white text-black rounded-lg hover:bg-slate-200 disabled:opacity-50">Save Material</button>
                  </div>
                </div>
              )}

              {roomMaterials.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center border border-white/5 border-dashed rounded-xl bg-black/20">No materials added for this room.</div>
              ) : (
                <div className="space-y-2">
                  {roomMaterials.map(mat => (
                    <div key={mat.id} className="bg-slate-900 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-200">{mat.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Goal: {mat.dryGoal}% • Status: <span className={mat.status === 'Dry' ? 'text-emerald-400' : 'text-yellow-400'}>{mat.status}</span></div>
                      </div>
                      <div className="flex space-x-1">
                        {mat.readings?.slice(-5).map((r, i) => (
                          <div key={i} className="flex flex-col items-center justify-center bg-black/30 rounded w-10 h-10 border border-white/5" title={r.dateStr}>
                            <span className="text-[10px] text-slate-500 leading-none">{r.dateStr.slice(0,2)}</span>
                            <span className={`text-xs font-mono font-bold leading-none mt-1 ${r.value <= mat.dryGoal ? 'text-emerald-400' : 'text-slate-300'}`}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Room Readings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                <History size={18} className="text-yellow-400" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Atmospheric History</h3>
              </div>
              
              {selectedRoom.readings && selectedRoom.readings.length > 0 ? (
                <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 border-b border-white/10">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date/Time</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Temp</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">RH</th>
                        <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">GPP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[...selectedRoom.readings].reverse().map((r, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-sm text-slate-300">
                            {new Date(r.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 text-sm font-mono text-white">{r.temp}°F</td>
                          <td className="p-4 text-sm font-mono text-white">{r.rh}%</td>
                          <td className="p-4 text-sm font-mono text-brand-cyan">{r.gpp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center border border-white/10 border-dashed rounded-2xl bg-slate-900/50">
                  <p className="text-slate-500 text-sm">No atmospheric readings recorded for this room yet.</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select or create a room to manage psychrometrics.
          </div>
        )}
      </div>
    </div>
  );
}
