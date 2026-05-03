import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Map, Camera, Upload, X, MapPin, AlertTriangle, Thermometer, Box, Layers, MousePointer2, Save, Trash2, Palette, Check, ArrowRight, Power, PowerOff, Search, Settings, Eye, EyeOff, ChevronUp, ChevronDown, Tag, Download, FileImage, FileCode2, Crosshair, PenTool, Maximize } from 'lucide-react';
import { Project, ARMarker, ARMappingData, ARArea } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { EventBus } from '../services/EventBus';

interface ARMappingProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
}

const ARMapping: React.FC<ARMappingProps> = ({ project, onUpdate }) => {
  const [viewMode, setViewMode] = useState<'plan' | 'ar'>('plan');
  const [interactionMode, setInteractionMode] = useState<'select' | 'add_marker' | 'draw_area' | 'set_scale'>('select');
  const [selectedMarker, setSelectedMarker] = useState<ARMarker | null>(null);
  const [selectedArea, setSelectedArea] = useState<ARArea | null>(null);
  const [currentAreaPoints, setCurrentAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [scalePoints, setScalePoints] = useState<{ x: number; y: number }[]>([]);
  const [scaleDistance, setScaleDistance] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [visibility, setVisibility] = useState({
    markers: true,
    areas: true,
    boundingBox: false
  });
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const arData: ARMappingData = project.arMapping || { markers: [], areas: [] };
  const markers = arData.markers || [];
  const areas = arData.areas || [];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate({
          arMapping: {
            ...arData,
            sitePlanUrl: reader.result as string
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInteraction = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (interactionMode === 'add_marker') {
      const newMarker: ARMarker = {
        id: `marker-${Date.now()}`,
        x,
        y,
        label: 'New Marker',
        type: 'note',
        timestamp: Date.now()
      };

      onUpdate({
        arMapping: {
          ...arData,
          markers: [...markers, newMarker]
        }
      });
      setInteractionMode('select');
      setSelectedMarker(newMarker);
      setSelectedArea(null);
    } else if (interactionMode === 'draw_area') {
      setCurrentAreaPoints([...currentAreaPoints, { x, y }]);
    } else if (interactionMode === 'set_scale') {
      if (scalePoints.length < 2) {
        setScalePoints([...scalePoints, { x, y }]);
      }
    }
  };

  const saveScale = () => {
    if (scalePoints.length !== 2) return;
    const dx = scalePoints[1].x - scalePoints[0].x;
    const dy = scalePoints[1].y - scalePoints[0].y;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    const scale = pixelDist / scaleDistance; // pixels per foot

    onUpdate({
      arMapping: {
        ...arData,
        scale
      }
    });
    setScalePoints([]);
    setInteractionMode('select');
  };

  const saveArea = () => {
    if (currentAreaPoints.length < 3) {
      alert("An area needs at least 3 points.");
      return;
    }

    const newArea: ARArea = {
      id: `area-${Date.now()}`,
      points: currentAreaPoints,
      label: 'Affected Area',
      type: 'affected',
      color: '#ef4444', // red-500
      timestamp: Date.now()
    };

    onUpdate({
      arMapping: {
        ...arData,
        areas: [...areas, newArea]
      }
    });
    setCurrentAreaPoints([]);
    setInteractionMode('select');
    setSelectedArea(newArea);
    setSelectedMarker(null);
  };

  const updateMarker = (id: string, updates: Partial<ARMarker>) => {
    const updatedMarkers = markers.map(m => 
      m.id === id ? { ...m, ...updates } : m
    );
    onUpdate({
      arMapping: {
        ...arData,
        markers: updatedMarkers
      }
    });
    if (selectedMarker?.id === id) {
      setSelectedMarker({ ...selectedMarker, ...updates } as ARMarker);
    }
  };

  const deleteMarker = (id: string) => {
    const updatedMarkers = markers.filter(m => m.id !== id);
    onUpdate({
      arMapping: {
        ...arData,
        markers: updatedMarkers
      }
    });
    setSelectedMarker(null);
  };

  const updateArea = (id: string, updates: Partial<ARArea>) => {
    const updatedAreas = areas.map(a => 
      a.id === id ? { ...a, ...updates } : a
    );
    onUpdate({
      arMapping: {
        ...arData,
        areas: updatedAreas
      }
    });
    if (selectedArea?.id === id) {
      setSelectedArea({ ...selectedArea, ...updates } as ARArea);
    }
  };

  const deleteArea = (id: string) => {
    const updatedAreas = areas.filter(a => a.id !== id);
    onUpdate({
      arMapping: {
        ...arData,
        areas: updatedAreas
      }
    });
    setSelectedArea(null);
  };

  const suggestTags = async (item: ARMarker | ARArea, isMarker: boolean) => {
    setIsSuggestingTags(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = isMarker 
        ? `Suggest 3-5 relevant tags for an AR marker with label "${item.label}" and type "${(item as ARMarker).type}". Return as JSON array of strings.`
        : `Suggest 3-5 relevant tags for an AR area with label "${item.label}" and type "${(item as ARArea).type}". Return as JSON array of strings.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      
      const suggestedTags = JSON.parse(response.text || '[]');
      if (suggestedTags && Array.isArray(suggestedTags)) {
        const currentTags = item.tags || [];
        const newTags = [...new Set([...currentTags, ...suggestedTags])];
        
        if (isMarker) {
          updateMarker(item.id, { tags: newTags });
          setSelectedMarker({ ...item, tags: newTags } as ARMarker);
        } else {
          updateArea(item.id, { tags: newTags });
          setSelectedArea({ ...item, tags: newTags } as ARArea);
        }
      }
    } catch (error) {
      console.error("Error suggesting tags:", error);
    } finally {
      setIsSuggestingTags(false);
    }
  };

  const movePointUp = (index: number) => {
    if (index === 0 || !selectedArea) return;
    const newPoints = [...selectedArea.points];
    [newPoints[index - 1], newPoints[index]] = [newPoints[index], newPoints[index - 1]];
    updateArea(selectedArea.id, { points: newPoints });
  };

  const movePointDown = (index: number) => {
    if (!selectedArea || index === selectedArea.points.length - 1) return;
    const newPoints = [...selectedArea.points];
    [newPoints[index], newPoints[index + 1]] = [newPoints[index + 1], newPoints[index]];
    updateArea(selectedArea.id, { points: newPoints });
  };

  const removePoint = (index: number) => {
    if (!selectedArea || selectedArea.points.length <= 3) return;
    const newPoints = selectedArea.points.filter((_, i) => i !== index);
    updateArea(selectedArea.id, { points: newPoints });
  };

  const markerIconMap: Record<string, React.ReactNode> = {
    equipment: <Box size={16} />,
    damage: <AlertTriangle size={16} />,
    moisture: <Thermometer size={16} />,
    note: <MapPin size={16} />
  };

  const getMarkerIcon = (type: ARMarker['type']) => {
    return markerIconMap[type] || <MapPin size={16} />;
  };

  const polygonPoints = (points: { x: number; y: number }[]) => {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  const getBoundingBox = () => {
    if (markers.length === 0 && areas.length === 0) return null;
    let minX = 100, minY = 100, maxX = 0, maxY = 0;
    
    markers.forEach(m => {
      if (m.x < minX) minX = m.x;
      if (m.x > maxX) maxX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.y > maxY) maxY = m.y;
    });

    areas.forEach(a => {
      a.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
    });

    // Add some padding
    minX = Math.max(0, minX - 5);
    minY = Math.max(0, minY - 5);
    maxX = Math.min(100, maxX + 5);
    maxY = Math.min(100, maxY + 5);

    return { minX, minY, maxX, maxY };
  };

  const filteredMarkers = markers.filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAreas = areas.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleExport = (format: 'pdf' | 'jpg' | 'dxf' | 'esx') => {
    setShowExportMenu(false);
    EventBus.publish('com.restorationai.export', { format, project: project.id }, project.id, `Exporting Site Plan as ${format.toUpperCase()}...`, 'info');
    
    // Simulate export delay
    setTimeout(() => {
        EventBus.publish('com.restorationai.export.complete', { format, project: project.id }, project.id, `Site Plan ${format.toUpperCase()} Export Complete`, 'success');
        alert(`Simulated export of Site Plan as ${format.toUpperCase()}`);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 mr-4">
            <button 
              onClick={() => setViewMode('plan')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'plan' ? 'bg-brand-cyan text-slate-900 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Map size={18} />
              <span className="text-xs">Site Plan</span>
            </button>
            <button 
              onClick={() => setViewMode('ar')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'ar' ? 'bg-brand-cyan text-slate-900 font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Camera size={18} />
              <span className="text-xs">AR View</span>
            </button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 relative">
            <button 
              onClick={() => { setInteractionMode('select'); setCurrentAreaPoints([]); }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${interactionMode === 'select' ? 'bg-white/10 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
              title="Select Mode"
            >
              <MousePointer2 size={18} />
              {interactionMode === 'select' && <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">Select</span>}
            </button>
            <button 
              onClick={() => { setInteractionMode('add_marker'); setCurrentAreaPoints([]); }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${interactionMode === 'add_marker' ? 'bg-white/10 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
              title="Add Marker"
            >
              <Crosshair size={18} />
              {interactionMode === 'add_marker' && <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">Point</span>}
            </button>
            <button 
              onClick={() => { setInteractionMode('draw_area'); setCurrentAreaPoints([]); setScalePoints([]); }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${interactionMode === 'draw_area' ? 'bg-white/10 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
              title="Draw Area"
            >
              <PenTool size={18} />
              {interactionMode === 'draw_area' && <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">Area</span>}
            </button>
            <button 
              onClick={() => { setInteractionMode('set_scale'); setCurrentAreaPoints([]); setScalePoints([]); }}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${interactionMode === 'set_scale' ? 'bg-white/10 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
              title="Set Scale"
            >
              <Maximize size={18} />
              {interactionMode === 'set_scale' && <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">Scale</span>}
            </button>
            
            <div className="w-px h-6 bg-white/10 mx-1 self-center" />
            
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`p-2 rounded-lg transition-all ${showExportMenu ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500 hover:text-white'}`}
              title="Export Site Plan"
            >
              <Download size={18} />
            </button>

            {showExportMenu && (
                 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                     <div className="p-2 border-b border-white/10">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Visual Image</span>
                         <button onClick={() => handleExport('pdf')} className="w-full text-left px-2 py-2 text-sm text-white hover:bg-white/10 rounded-lg flex items-center mt-1"><FileImage size={14} className="mr-2 text-brand-cyan"/> PDF Document</button>
                         <button onClick={() => handleExport('jpg')} className="w-full text-left px-2 py-2 text-sm text-white hover:bg-white/10 rounded-lg flex items-center"><FileImage size={14} className="mr-2 text-brand-cyan"/> JPG Image</button>
                     </div>
                     <div className="p-2">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Data Export</span>
                         <button onClick={() => handleExport('dxf')} className="w-full text-left px-2 py-2 text-sm text-white hover:bg-white/10 rounded-lg flex items-center mt-1"><FileCode2 size={14} className="mr-2 text-emerald-400"/> AutoCAD (DXF)</button>
                         <button onClick={() => handleExport('esx')} className="w-full text-left px-2 py-2 text-sm text-white hover:bg-white/10 rounded-lg flex items-center"><FileCode2 size={14} className="mr-2 text-emerald-400"/> Xactimate (ESX)</button>
                     </div>
                 </div>
             )}
          </div>
          
          {interactionMode === 'draw_area' && currentAreaPoints.length > 0 && (
            <div className="flex items-center space-x-2 ml-4">
              <button 
                onClick={saveArea}
                className="px-3 py-1.5 bg-green-500 text-slate-900 rounded-lg text-[10px] font-black uppercase flex items-center space-x-1"
              >
                <Save size={12} />
                <span>Save Area</span>
              </button>
              <button 
                onClick={() => setCurrentAreaPoints([])}
                className="px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg text-[10px] font-black uppercase"
              >
                Clear
              </button>
            </div>
          )}

          {interactionMode === 'set_scale' && (
            <div className="flex items-center space-x-2 ml-4">
              {scalePoints.length === 2 ? (
                <>
                  <input 
                    type="number" 
                    value={scaleDistance}
                    onChange={(e) => setScaleDistance(Number(e.target.value))}
                    className="w-16 bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">ft</span>
                  <button 
                    onClick={saveScale}
                    className="px-3 py-1.5 bg-brand-cyan text-slate-900 rounded-lg text-[10px] font-black uppercase flex items-center space-x-1"
                  >
                    <Check size={12} />
                    <span>Confirm Scale</span>
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-brand-cyan font-bold uppercase animate-pulse">
                  {scalePoints.length === 0 ? 'Click first point' : 'Click second point'}
                </span>
              )}
              <button 
                onClick={() => { setScalePoints([]); setInteractionMode('select'); }}
                className="px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg text-[10px] font-black uppercase"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="AR Settings"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Upload Site Plan"
          >
            <Upload size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Left Side: Viewport */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {viewMode === 'plan' ? (
            <div 
              className={`relative max-w-full max-h-full ${interactionMode !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
              onClick={handleInteraction}
            >
              {arData.sitePlanUrl ? (
                <img 
                  src={arData.sitePlanUrl} 
                  alt="Site Plan" 
                  className="max-w-full max-h-full object-contain opacity-80"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500 border-2 border-dashed border-white/10 rounded-2xl">
                  <Map size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No site plan uploaded</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-4 py-2 bg-brand-cyan text-slate-900 rounded-lg font-bold text-xs"
                  >
                    Upload Plan
                  </button>
                </div>
              )}

              {/* SVG Layer for Areas */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {visibility.areas && areas.map(area => (
                  <polygon 
                    key={area.id}
                    points={polygonPoints(area.points)}
                    fill={area.color}
                    fillOpacity={selectedArea?.id === area.id ? 0.6 : 0.2}
                    stroke={selectedArea?.id === area.id ? '#ffffff' : area.color}
                    strokeWidth={selectedArea?.id === area.id ? "1" : "0.5"}
                    className={`cursor-pointer pointer-events-auto transition-all ${selectedArea?.id === area.id ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedArea(area);
                      setSelectedMarker(null);
                    }}
                  />
                ))}
                {interactionMode === 'draw_area' && currentAreaPoints.length > 0 && (
                  <>
                    <polyline 
                      points={polygonPoints(currentAreaPoints)}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="0.5"
                      strokeDasharray="1,1"
                    />
                    {currentAreaPoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="#06b6d4" />
                    ))}
                  </>
                )}
                {visibility.boundingBox && (() => {
                  const bbox = getBoundingBox();
                  if (!bbox) return null;
                  return (
                    <rect 
                      x={bbox.minX} 
                      y={bbox.minY} 
                      width={bbox.maxX - bbox.minX} 
                      height={bbox.maxY - bbox.minY} 
                      fill="none" 
                      stroke="#06b6d4" 
                      strokeWidth="0.5" 
                      strokeDasharray="2,2" 
                    />
                  );
                })()}
                {interactionMode === 'set_scale' && scalePoints.length > 0 && (
                  <>
                    {scalePoints.length === 2 && (
                      <line 
                        x1={scalePoints[0].x} 
                        y1={scalePoints[0].y} 
                        x2={scalePoints[1].x} 
                        y2={scalePoints[1].y} 
                        stroke="#06b6d4" 
                        strokeWidth="0.5" 
                      />
                    )}
                    {scalePoints.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="1" fill="#06b6d4" />
                    ))}
                  </>
                )}
              </svg>

              {/* Markers on Plan */}
              {visibility.markers && markers.map(marker => (
                <div 
                  key={marker.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMarker(marker);
                    setSelectedArea(null);
                  }}
                  className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center cursor-pointer transition-all ${selectedMarker?.id === marker.id ? 'scale-125 shadow-lg z-20' : 'border border-white/20 hover:scale-110 z-10'}`}
                  style={{ 
                    left: `${marker.x}%`, 
                    top: `${marker.y}%`,
                    backgroundColor: selectedMarker?.id === marker.id ? (marker.color || '#06b6d4') : (marker.color ? `${marker.color}cc` : 'rgba(30, 41, 59, 0.8)'),
                    color: selectedMarker?.id === marker.id ? '#0f172a' : '#ffffff',
                    boxShadow: selectedMarker?.id === marker.id ? `0 0 15px ${marker.color || '#06b6d4'}80` : 'none'
                  }}
                >
                  {getMarkerIcon(marker.type)}
                  
                  {/* On-Plan Label & Type Display */}
                  <div className={`absolute top-10 left-1/2 -translate-x-1/2 min-w-max px-2 py-1 flex flex-col items-center justify-center pointer-events-none transition-all ${selectedMarker?.id === marker.id ? 'bg-white text-slate-900 rounded-lg shadow-xl scale-110' : 'bg-slate-900/80 text-white rounded shadow-lg border border-white/10'}`}>
                    <span className="text-[10px] font-bold leading-tight">{marker.label}</span>
                    <span className={`text-[8px] uppercase font-black tracking-widest leading-tight mt-0.5 ${selectedMarker?.id === marker.id ? 'text-slate-500' : 'text-brand-cyan'}`}>
                      {marker.type}
                    </span>
                  </div>
                </div>
              ))}

              {interactionMode !== 'select' && (
                <div className="absolute top-4 left-4 bg-brand-cyan text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase animate-pulse">
                  {interactionMode === 'add_marker' ? 'Click to place marker' : interactionMode === 'set_scale' ? 'Click two points to set scale' : 'Click to add area points'}
                </div>
              )}

              {arData.scale && viewMode === 'plan' && (
                <div className="absolute bottom-4 left-4 pointer-events-none w-[calc(100%-2rem)]">
                  <div className="text-[10px] text-slate-400 font-bold mb-1 bg-slate-900/80 px-2 py-0.5 rounded inline-block shadow-lg border border-white/10">10 ft</div>
                  <div className="h-1.5 bg-brand-cyan rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" style={{ width: `${arData.scale * 10}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full relative" onClick={handleInteraction}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
              />
              
              {/* AR Overlays */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Areas in AR (Simulated perspective) */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {visibility.areas && areas.map(area => (
                    <polygon 
                      key={area.id}
                      points={polygonPoints(area.points)}
                      fill={area.color}
                      fillOpacity={selectedArea?.id === area.id ? 0.4 : 0.15}
                      stroke={selectedArea?.id === area.id ? '#ffffff' : area.color}
                      strokeWidth={selectedArea?.id === area.id ? "0.8" : "0.2"}
                      className={`animate-pulse transition-all ${selectedArea?.id === area.id ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''}`}
                    />
                  ))}
                  {interactionMode === 'draw_area' && currentAreaPoints.length > 0 && (
                    <>
                      <polyline 
                        points={polygonPoints(currentAreaPoints)}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="0.5"
                        strokeDasharray="1,1"
                      />
                      {currentAreaPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="#06b6d4" />
                      ))}
                    </>
                  )}
                  {visibility.boundingBox && (() => {
                    const bbox = getBoundingBox();
                    if (!bbox) return null;
                    return (
                      <rect 
                        x={bbox.minX} 
                        y={bbox.minY} 
                        width={bbox.maxX - bbox.minX} 
                        height={bbox.maxY - bbox.minY} 
                        fill="none" 
                        stroke="#06b6d4" 
                        strokeWidth="0.5" 
                        strokeDasharray="2,2" 
                      />
                    );
                  })()}
                  {interactionMode === 'set_scale' && scalePoints.length > 0 && (
                    <>
                      {scalePoints.length === 2 && (
                        <line 
                          x1={scalePoints[0].x} 
                          y1={scalePoints[0].y} 
                          x2={scalePoints[1].x} 
                          y2={scalePoints[1].y} 
                          stroke="#06b6d4" 
                          strokeWidth="0.5" 
                        />
                      )}
                      {scalePoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="1" fill="#06b6d4" />
                      ))}
                    </>
                  )}
                </svg>

                {/* Markers in AR */}
                {visibility.markers && markers.map(marker => (
                  <div 
                    key={marker.id}
                    className="absolute flex flex-col items-center animate-bounce"
                    style={{ 
                      left: `${marker.x}%`, 
                      top: `${marker.y}%`,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="backdrop-blur-md rounded-2xl p-3 shadow-lg" style={{ backgroundColor: `${marker.color || '#06b6d4'}33`, borderColor: `${marker.color || '#06b6d4'}80`, borderWidth: '1px' }}>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-900" style={{ backgroundColor: marker.color || '#06b6d4' }}>
                          {getMarkerIcon(marker.type)}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase tracking-wider">{marker.label}</p>
                          {marker.type === 'equipment' && marker.equipmentType && (
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-0.5">
                              {marker.equipmentType} {marker.equipmentStatus ? `• ${marker.equipmentStatus}` : ''}
                            </p>
                          )}
                          {marker.value && <p className="text-xs font-bold mt-0.5" style={{ color: marker.color || '#06b6d4' }}>{marker.value}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="w-0.5 h-8 mt-1" style={{ background: `linear-gradient(to bottom, ${marker.color || '#06b6d4'}, transparent)` }} />
                  </div>
                ))}
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase text-slate-400">AR Mapping Active</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[10px] font-bold uppercase text-slate-200">{markers.length + areas.length} Objects Mapped</span>
              </div>

              {interactionMode !== 'select' && (
                <div className="absolute inset-0 border-4 border-brand-cyan/30 pointer-events-none flex items-center justify-center">
                  <div className="bg-brand-cyan text-slate-900 px-4 py-2 rounded-xl font-black uppercase text-xs tracking-widest shadow-2xl">
                    {interactionMode === 'add_marker' ? 'Tap Screen to Place Marker' : 'Tap Screen to Map Area Points'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-white/5 flex flex-col shadow-2xl z-30">
          <div className="p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center">
              <Layers size={14} className="mr-2 text-brand-cyan" />
              Mapping Inventory
            </h3>
            {(selectedMarker || selectedArea) && (
              <button 
                onClick={() => { setSelectedMarker(null); setSelectedArea(null); }}
                className="p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {selectedMarker ? (
              <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-brand-cyan tracking-widest">Marker Properties</span>
                    <button 
                      onClick={() => deleteMarker(selectedMarker.id)} 
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Marker"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{selectedMarker.label}</h2>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Identity Label</label>
                    <input 
                      type="text"
                      value={selectedMarker.label}
                      onChange={(e) => updateMarker(selectedMarker.id, { label: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                      placeholder="e.g. Dehumidifier 01"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Classification</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['equipment', 'damage', 'moisture', 'note'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => updateMarker(selectedMarker.id, { type })}
                          className={`flex flex-col items-start p-3 rounded-xl border transition-all gap-2 ${selectedMarker.type === type ? 'bg-white/5 border-white/20 text-white shadow-lg' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/20'}`}
                        >
                          <div className={`p-1.5 rounded-lg ${selectedMarker.type === type ? 'text-slate-900' : 'bg-slate-900 text-slate-500'}`} style={{ backgroundColor: selectedMarker.type === type ? (selectedMarker.color || '#06b6d4') : undefined }}>
                            {getMarkerIcon(type)}
                          </div>
                          <span className="text-[10px] uppercase font-black tracking-wider">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Custom Visualization</label>
                    <div className="flex items-center p-3 bg-slate-950 rounded-xl border border-white/5 gap-4">
                      <div className="relative group">
                        <input 
                          type="color"
                          value={selectedMarker.color || '#06b6d4'}
                          onChange={(e) => updateMarker(selectedMarker.id, { color: e.target.value })}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                        />
                        <div 
                          className="w-10 h-10 rounded-lg border border-white/20 shadow-lg transition-transform group-hover:scale-110" 
                          style={{ backgroundColor: selectedMarker.color || '#06b6d4' }} 
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black text-slate-500 uppercase mb-0.5">Hex Code</div>
                        <div className="text-sm font-mono text-white uppercase tracking-tighter">{selectedMarker.color || '#06b6d4'}</div>
                      </div>
                      <Palette size={18} className="text-slate-600" />
                    </div>
                  </div>

                  {selectedMarker.type === 'equipment' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Equipment Type</label>
                        <select
                          value={selectedMarker.equipmentType || ''}
                          onChange={(e) => updateMarker(selectedMarker.id, { equipmentType: e.target.value })}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                        >
                          <option value="" disabled>Select Equipment Type...</option>
                          <option value="Dehumidifier">Dehumidifier</option>
                          <option value="Air Mover">Air Mover</option>
                          <option value="Air Scrubber">Air Scrubber</option>
                          <option value="Heater">Heater</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Status</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => updateMarker(selectedMarker.id, { equipmentStatus: 'Running' })}
                            className={`flex items-center justify-center space-x-2 p-3 rounded-xl border transition-all ${selectedMarker.equipmentStatus === 'Running' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/20'}`}
                          >
                            <Power size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Running</span>
                          </button>
                          <button
                            onClick={() => updateMarker(selectedMarker.id, { equipmentStatus: 'Off' })}
                            className={`flex items-center justify-center space-x-2 p-3 rounded-xl border transition-all ${selectedMarker.equipmentStatus === 'Off' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/20'}`}
                          >
                            <PowerOff size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">Off</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">
                      {selectedMarker.type === 'moisture' ? 'Moisture Reading' : 
                       selectedMarker.type === 'damage' ? 'Damage Assessment' : 
                       selectedMarker.type === 'equipment' ? 'Telemetry / Notes' : 'Notes'}
                    </label>
                    <textarea 
                      value={selectedMarker.value || ''}
                      onChange={(e) => updateMarker(selectedMarker.id, { value: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/30 transition-all min-h-[100px] resize-none"
                      placeholder={
                        selectedMarker.type === 'moisture' ? 'e.g. 18.5%' : 
                        selectedMarker.type === 'damage' ? 'Describe the damage...' : 
                        'Enter additional details...'
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Tags</label>
                      <button 
                        onClick={() => suggestTags(selectedMarker, true)}
                        disabled={isSuggestingTags}
                        className="text-[10px] bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 px-2 py-1 rounded font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Tag size={10} />
                        {isSuggestingTags ? 'Suggesting...' : 'AI Suggest Tags'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedMarker.tags?.map(tag => (
                        <span key={tag} className="bg-white/10 text-slate-300 text-[10px] px-2 py-1 rounded flex items-center gap-1">
                          {tag}
                          <button 
                            onClick={() => {
                              const newTags = selectedMarker.tags?.filter(t => t !== tag);
                              updateMarker(selectedMarker.id, { tags: newTags });
                              setSelectedMarker({ ...selectedMarker, tags: newTags });
                            }}
                            className="hover:text-red-400"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {(!selectedMarker.tags || selectedMarker.tags.length === 0) && (
                        <span className="text-[10px] text-slate-600 italic">No tags</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2">
                    <div className="flex flex-col space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Coordinates (%)</span>
                      <div className="flex space-x-2">
                        <div className="flex-1 flex items-center bg-slate-900 border border-white/10 rounded px-2 py-1">
                          <span className="text-xs text-slate-500 mr-2">X</span>
                          <input 
                            type="number" 
                            value={selectedMarker.x.toFixed(1)}
                            onChange={(e) => updateMarker(selectedMarker.id, { x: Number(e.target.value) })}
                            className="w-full bg-transparent text-xs text-white outline-none font-mono"
                          />
                        </div>
                        <div className="flex-1 flex items-center bg-slate-900 border border-white/10 rounded px-2 py-1">
                          <span className="text-xs text-slate-500 mr-2">Y</span>
                          <input 
                            type="number" 
                            value={selectedMarker.y.toFixed(1)}
                            onChange={(e) => updateMarker(selectedMarker.id, { y: Number(e.target.value) })}
                            className="w-full bg-transparent text-xs text-white outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500 uppercase">Timestamp</span>
                      <span className="text-slate-300 font-mono">{new Date(selectedMarker.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedArea ? (
              <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-brand-cyan tracking-widest">Area Configuration</span>
                    <button 
                      onClick={() => deleteArea(selectedArea.id)} 
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Area"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{selectedArea.label}</h2>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Area Label</label>
                    <input 
                      type="text"
                      value={selectedArea.label}
                      onChange={(e) => updateArea(selectedArea.id, { label: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan/30 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Mitigation Status</label>
                    <div className="space-y-2">
                      {(['affected', 'mitigated', 'safe'] as const).map(type => {
                        const colors = { affected: '#ef4444', mitigated: '#eab308', safe: '#10b981' };
                        const isActive = selectedArea.type === type;
                        return (
                          <button
                            key={type}
                            onClick={() => updateArea(selectedArea.id, { type, color: colors[type] })}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? 'bg-white/5 border-white/20 text-white' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'}`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: isActive ? colors[type] : '#1e293b' }} />
                              <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>{type}</span>
                            </div>
                            {isActive && <Check size={14} className="text-brand-cyan" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Custom Visualization</label>
                    <div className="flex items-center p-3 bg-slate-950 rounded-xl border border-white/5 gap-4">
                      <div className="relative group">
                        <input 
                          type="color"
                          value={selectedArea.color}
                          onChange={(e) => updateArea(selectedArea.id, { color: e.target.value })}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                        />
                        <div 
                          className="w-10 h-10 rounded-lg border border-white/20 shadow-lg transition-transform group-hover:scale-110" 
                          style={{ backgroundColor: selectedArea.color }} 
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-black text-slate-500 uppercase mb-0.5">Hex Code</div>
                        <div className="text-sm font-mono text-white uppercase tracking-tighter">{selectedArea.color}</div>
                      </div>
                      <Palette size={18} className="text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Tags</label>
                      <button 
                        onClick={() => suggestTags(selectedArea, false)}
                        disabled={isSuggestingTags}
                        className="text-[10px] bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 px-2 py-1 rounded font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Tag size={10} />
                        {isSuggestingTags ? 'Suggesting...' : 'AI Suggest Tags'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedArea.tags?.map(tag => (
                        <span key={tag} className="bg-white/10 text-slate-300 text-[10px] px-2 py-1 rounded flex items-center gap-1">
                          {tag}
                          <button 
                            onClick={() => {
                              const newTags = selectedArea.tags?.filter(t => t !== tag);
                              updateArea(selectedArea.id, { tags: newTags });
                              setSelectedArea({ ...selectedArea, tags: newTags });
                            }}
                            className="hover:text-red-400"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      {(!selectedArea.tags || selectedArea.tags.length === 0) && (
                        <span className="text-[10px] text-slate-600 italic">No tags</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Dimensions (%)</label>
                    <div className="flex space-x-2">
                       {(() => {
                           let minX = 100, maxX = 0, minY = 100, maxY = 0;
                           selectedArea.points.forEach(p => {
                               if (p.x < minX) minX = p.x;
                               if (p.x > maxX) maxX = p.x;
                               if (p.y < minY) minY = p.y;
                               if (p.y > maxY) maxY = p.y;
                           });
                           const w = maxX > minX ? maxX - minX : 1;
                           const h = maxY > minY ? maxY - minY : 1;
                           const cx = (minX + maxX) / 2;
                           const cy = (minY + maxY) / 2;
                           
                           const updateWidth = (newW: number) => {
                               if(newW <= 0.1 || w <= 0.1) return;
                               const scaleW = newW / w;
                               const newPoints = selectedArea.points.map(p => ({ ...p, x: cx + (p.x - cx) * scaleW }));
                               updateArea(selectedArea.id, { points: newPoints });
                           };
                           const updateHeight = (newH: number) => {
                               if(newH <= 0.1 || h <= 0.1) return;
                               const scaleH = newH / h;
                               const newPoints = selectedArea.points.map(p => ({ ...p, y: cy + (p.y - cy) * scaleH }));
                               updateArea(selectedArea.id, { points: newPoints });
                           };

                           return (
                               <>
                                 <div className="flex-1 flex flex-col space-y-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Width (X-axis)</span>
                                    <input 
                                      type="number" step="0.1"
                                      value={w.toFixed(1)} 
                                      onChange={(e) => updateWidth(Number(e.target.value))}
                                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-brand-cyan font-mono"
                                    />
                                    {arData.scale && <span className="text-[9px] text-emerald-400 font-bold">{(w / arData.scale).toFixed(1)} ft</span>}
                                 </div>
                                 <div className="flex-1 flex flex-col space-y-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Height (Y-axis)</span>
                                    <input 
                                      type="number" step="0.1"
                                      value={h.toFixed(1)} 
                                      onChange={(e) => updateHeight(Number(e.target.value))}
                                      className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-brand-cyan font-mono"
                                    />
                                    {arData.scale && <span className="text-[9px] text-emerald-400 font-bold">{(h / arData.scale).toFixed(1)} ft</span>}
                                 </div>
                               </>
                           );
                       })()}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Area Vertices</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                      {selectedArea.points.map((point, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-white/5">
                          <div className="flex items-center space-x-3">
                            <div className="w-5 h-5 rounded-md bg-white/5 text-[10px] font-bold flex items-center justify-center text-slate-400">
                              {index + 1}
                            </div>
                            <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                              <input 
                                type="number" 
                                value={point.x.toFixed(1)}
                                onChange={(e) => {
                                  const newPoints = [...selectedArea.points];
                                  newPoints[index].x = Number(e.target.value);
                                  updateArea(selectedArea.id, { points: newPoints });
                                }}
                                className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-center outline-none focus:border-brand-cyan"
                              />
                              <span className="text-slate-500">,</span>
                              <input 
                                type="number" 
                                value={point.y.toFixed(1)}
                                onChange={(e) => {
                                  const newPoints = [...selectedArea.points];
                                  newPoints[index].y = Number(e.target.value);
                                  updateArea(selectedArea.id, { points: newPoints });
                                }}
                                className="w-12 bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-center outline-none focus:border-brand-cyan"
                              />
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => movePointUp(index)}
                              disabled={index === 0}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => movePointDown(index)}
                              disabled={index === selectedArea.points.length - 1}
                              className="p-1 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              onClick={() => removePoint(index)}
                              disabled={selectedArea.points.length <= 3}
                              className="p-1 text-slate-500 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors ml-1"
                              title={selectedArea.points.length <= 3 ? "Minimum 3 points required" : "Delete point"}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500 uppercase">Vertices</span>
                      <span className="text-slate-300 font-mono">{selectedArea.points.length} Points</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-500 uppercase">Created</span>
                      <span className="text-slate-300 font-mono">{new Date(selectedArea.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-0 flex flex-col h-full">
                {/* Summary Stats */}
                <div className="p-6 grid grid-cols-2 gap-3 border-b border-white/5">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Markers</div>
                    <div className="text-2xl font-black text-white">{markers.length}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Areas</div>
                    <div className="text-2xl font-black text-white">{areas.length}</div>
                  </div>
                </div>

                {/* Search Input */}
                <div className="p-4 border-b border-white/5">
                  <div className="relative group">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-cyan transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search markers and areas..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/50 rounded-xl pl-9 pr-3 py-2.5 text-sm border border-white/5 focus:ring-1 focus:ring-brand-cyan/50 focus:border-brand-cyan/50 focus:outline-none placeholder-slate-600 text-white transition-all" 
                    />
                  </div>
                </div>

                {/* Inventory List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {filteredAreas.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Mapped Areas</h4>
                      <div className="space-y-2">
                        {filteredAreas.map(area => (
                          <div 
                            key={area.id}
                            onClick={() => { setSelectedArea(area); setSelectedMarker(null); }}
                            className="group flex items-center justify-between p-3 bg-slate-950 hover:bg-white/5 border border-white/5 rounded-xl cursor-pointer transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: area.color }} />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white group-hover:text-brand-cyan transition-colors">{area.label}</span>
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{area.type}</span>
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-700 group-hover:text-brand-cyan group-hover:translate-x-1 transition-all" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredMarkers.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Point Markers</h4>
                      <div className="space-y-2">
                        {filteredMarkers.map(marker => (
                          <div 
                            key={marker.id}
                            onClick={() => { setSelectedMarker(marker); setSelectedArea(null); }}
                            className="group flex items-center justify-between p-3 bg-slate-950 hover:bg-white/5 border border-white/5 rounded-xl cursor-pointer transition-all"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-500 group-hover:bg-brand-cyan group-hover:text-slate-900 transition-all">
                                {getMarkerIcon(marker.type)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white group-hover:text-brand-cyan transition-colors">{marker.label}</span>
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                                  {marker.type}
                                  {marker.type === 'equipment' && marker.equipmentType ? ` • ${marker.equipmentType}` : ''}
                                  {marker.type === 'equipment' && marker.equipmentStatus ? ` (${marker.equipmentStatus})` : ''}
                                </span>
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-slate-700 group-hover:text-brand-cyan group-hover:translate-x-1 transition-all" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredMarkers.length === 0 && filteredAreas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                      <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-white/5 flex items-center justify-center text-slate-700">
                        <MapPin size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400">No objects found</p>
                        <p className="text-[10px] text-slate-600 max-w-[180px]">Try adjusting your search query or add new objects.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-950/50 backdrop-blur-md border-t border-white/5">
            <button className="w-full py-4 bg-brand-cyan hover:bg-cyan-400 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 shadow-xl shadow-brand-cyan/20 transition-all active:scale-95">
              <Camera size={18} />
              <span>Capture AR Snapshot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center">
                <Settings size={16} className="mr-2 text-brand-cyan" />
                AR Visibility Settings
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                <div className="flex items-center space-x-3">
                  <MapPin size={18} className="text-slate-400" />
                  <span className="text-sm font-bold text-white">Point Markers</span>
                </div>
                <button 
                  onClick={() => setVisibility(prev => ({ ...prev, markers: !prev.markers }))}
                  className={`p-2 rounded-lg transition-all ${visibility.markers ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/5 text-slate-500'}`}
                >
                  {visibility.markers ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                <div className="flex items-center space-x-3">
                  <Layers size={18} className="text-slate-400" />
                  <span className="text-sm font-bold text-white">Mapped Areas</span>
                </div>
                <button 
                  onClick={() => setVisibility(prev => ({ ...prev, areas: !prev.areas }))}
                  className={`p-2 rounded-lg transition-all ${visibility.areas ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/5 text-slate-500'}`}
                >
                  {visibility.areas ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-white/5">
                <div className="flex items-center space-x-3">
                  <Box size={18} className="text-slate-400" />
                  <span className="text-sm font-bold text-white">Bounding Box</span>
                </div>
                <button 
                  onClick={() => setVisibility(prev => ({ ...prev, boundingBox: !prev.boundingBox }))}
                  className={`p-2 rounded-lg transition-all ${visibility.boundingBox ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/5 text-slate-500'}`}
                >
                  {visibility.boundingBox ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950 border-t border-white/5">
              <button 
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARMapping;
