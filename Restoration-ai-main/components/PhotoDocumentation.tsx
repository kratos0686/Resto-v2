
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    Camera, Loader2, Sparkles, BrainCircuit, 
    Video, X, Upload, Play
} from 'lucide-react';
import { Type } from "@google/genai";
import { blobToBase64 } from '../utils/photoutils';
import { useAppContext } from '../context/AppContext';
import { Project, Photo } from '../types';
import { IntelligenceRouter } from '../services/IntelligenceRouter';
import { EventBus } from '../services/EventBus';
import { uploadMedia } from '../services/api';

interface PhotoDocumentationProps {
  onStartScan: () => void;
  isMobile?: boolean;
  project: Project;
  onUpdate?: (updates: Partial<Project>) => void;
}

const SUGGESTED_TAGS = {
  'Water Loss': ['Water Loss', 'Source of Loss', 'Affected Area'],
  'Water Category': ['Category 1', 'Category 2', 'Category 3'],
  'Materials': ['Drywall', 'Carpet', 'Pad', 'Subfloor', 'Hardwood', 'Baseboard', 'Insulation', 'Cabinet'],
  'Equipment': ['Air Mover', 'Air Handler', 'Dehumidifier', 'HEPA Scrubber', 'Heater'],
  'Moisture Meters': ['Pin Meter', 'Pinless Meter', 'Hammer Probe', 'Hygrometer', 'Thermal Camera']
};

type TabType = 'gallery' | 'generate' | 'edit' | 'video';
type PhotoItem = Photo & { type: 'image' | 'video' };

const PhotoDocumentation: React.FC<PhotoDocumentationProps> = ({ project, onUpdate }) => {
  const { isOnline, accessToken } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const [filter, setFilter] = useState('All');
  const [loadingPhotos, setLoadingPhotos] = useState<Set<string>>(new Set());
  const [photoInsights, setPhotoInsights] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [customTag, setCustomTag] = useState('');
  
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const projectPhotos: PhotoItem[] = project.rooms.flatMap(room => 
          room.photos.map(p => ({ ...p, type: 'image' }))
      );
      setPhotos(projectPhotos);
  }, [project]);

  const persistTags = (photoId: string, newTags: string[]) => {
    if (!onUpdate) return;
    
    const updatedRooms = project.rooms.map(room => ({
        ...room,
        photos: room.photos.map(p => p.id === photoId ? { ...p, tags: newTags } : p)
    }));
    
    onUpdate({ rooms: updatedRooms });
  };

  const persistNotes = (photoId: string, newNotes: string) => {
    if (!onUpdate) return;
    
    const updatedRooms = project.rooms.map(room => ({
        ...room,
        photos: room.photos.map(p => p.id === photoId ? { ...p, notes: newNotes } : p)
    }));
    
    onUpdate({ rooms: updatedRooms });
  };

  const updateNotes = (photoId: string, notes: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId) {
        const updated = { ...p, notes };
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(updated);
        }
        persistNotes(photoId, notes);
        return updated;
      }
      return p;
    }));
  };

  const toggleTag = (photoId: string, tag: string) => {
    setPhotos(prev => prev.map(p => {
      if (p.id === photoId) {
        const hasTag = p.tags.includes(tag);
        const newTags = hasTag 
          ? p.tags.filter(t => t !== tag)
          : [...p.tags, tag];
        
        const updated = { ...p, tags: newTags };
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(updated);
        }
        persistTags(photoId, newTags);
        return updated;
      }
      return p;
    }));
  };

  const addCustomTag = (photoId: string) => {
    if (!customTag.trim()) return;
    toggleTag(photoId, customTag.trim());
    setCustomTag('');
  };

  // Filtering Logic
  const filteredPhotos = useMemo(() => {
    return photos.filter(p => {
        const matchesTag = filter === 'All' || p.tags.includes(filter);
        return matchesTag;
    });
  }, [photos, filter]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    photos.forEach(p => p.tags.forEach(t => tags.add(t)));
    return ['All', ...Array.from(tags)];
  }, [photos]);

  const handleAnalyzePhoto = async (photo: PhotoItem) => {
    if (!isOnline || !accessToken) return;
    setLoadingPhotos(prev => new Set(prev).add(photo.id));
    
    try {
      const router = new IntelligenceRouter();
      const imgResponse = await fetch(photo.url);
      const blob = await imgResponse.blob();
      const base64Data = await blobToBase64(blob);

      const response = await router.execute('VISION_ANALYSIS', 
        { parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: "Analyze this restoration site photo. Identify moisture damage, building materials, and IICRC safety concerns. Also extract any moisture meter readings if visible. Return JSON: {tags: string[], insight: string, meterReading?: string, materialLabel?: string}" }
        ]},
        { 
            responseMimeType: "application/json", 
            responseSchema: { 
                type: Type.OBJECT, 
                properties: { 
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    insight: { type: Type.STRING },
                    meterReading: { type: Type.STRING },
                    materialLabel: { type: Type.STRING }
                }
            }
        }
      );

      const result = JSON.parse(response.text || '{}');
      if (result.insight) {
          setPhotoInsights(prev => ({ ...prev, [photo.id]: result.insight }));
          
          // Automatically generate a concise note based on the 'insight' field
          setPhotos(prev => prev.map(p => {
              if (p.id === photo.id) {
                  const updated = { 
                      ...p, 
                      aiInsight: result.insight,
                      notes: `AI Analysis: ${result.insight}${result.meterReading ? ` | Meter: ${result.meterReading}` : ''}${result.materialLabel ? ` | Material: ${result.materialLabel}` : ''}`,
                      tags: [...new Set([...p.tags, ...(result.tags || [])])],
                      meterReading: result.meterReading,
                      materialLabel: result.materialLabel
                  };
                  if (selectedPhoto?.id === photo.id) {
                      setSelectedPhoto(updated);
                  }
                  return updated;
              }
              return p;
          }));

          EventBus.publish('com.restorationai.log.entry', { message: `AI Insight for photo: ${result.insight}`, category: 'AI Vision' }, project.id, 'AI Insight Generated', 'info');
      }
      EventBus.publish('com.restorationai.notification', { title: 'Photo Analyzed', message: 'AI tagging complete' }, project.id, 'AI Tagging Complete', 'success');

    } catch (err) {
      console.error(err);
      EventBus.publish('com.restorationai.notification', { title: 'Analysis Failed', message: 'Could not process photo' }, project.id, 'Photo Analysis Failed', 'error');
    } finally {
      setLoadingPhotos(prev => {
          const next = new Set(prev);
          next.delete(photo.id);
          return next;
      });
    }
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Capture at 1 second
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      const objectUrl = URL.createObjectURL(file); video.src = objectUrl.startsWith('blob:') ? objectUrl : '';
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newItems: PhotoItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      
      let url = URL.createObjectURL(file);
      try {
        const uploadedUrl = await uploadMedia(project.id, file);
        if (uploadedUrl) {
          url = uploadedUrl;
        }
      } catch (err) {
        console.error("Failed to upload media to cloud storage", err);
      }
      
      let thumbnailUrl: string | undefined;

      if (isVideo) {
        thumbnailUrl = await generateVideoThumbnail(file);
      }

      const newItem: PhotoItem = {
        id: `media-${Date.now()}-${i}`,
        url: url,
        thumbnailUrl: thumbnailUrl,
        timestamp: Date.now(),
        tags: ['Uploaded'],
        notes: `Uploaded ${isVideo ? 'video' : 'photo'}`,
        type: isVideo ? 'video' : 'image'
      };
      newItems.push(newItem);
    }

    setPhotos(prev => [...newItems, ...prev]);
    
    if (onUpdate) {
        const updatedRooms = [...project.rooms];
        if (updatedRooms.length === 0) {
            updatedRooms.push({
                id: `room-${Date.now()}`,
                name: 'General',
                dimensions: { length: 0, width: 0, height: 0 },
                readings: [],
                photos: [],
                status: 'wet'
            });
        }
        updatedRooms[0] = {
            ...updatedRooms[0],
            photos: [...newItems, ...updatedRooms[0].photos]
        };
        onUpdate({ rooms: updatedRooms });
    }

    setIsProcessing(false);
    EventBus.publish('com.restorationai.log.entry', { message: `${newItems.length} media items uploaded`, category: 'Documentation' }, project.id, 'Media Uploaded', 'info');
  };

  const handleCapture = () => {
      // Simulation of camera capture
      const newPhoto: PhotoItem = {
          id: `p-${Date.now()}`,
          url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800', // Mock wet wall photo
          timestamp: Date.now(),
          tags: ['Untagged'],
          notes: 'New site photo captured',
          type: 'image'
      };
      setPhotos([newPhoto, ...photos]);
      EventBus.publish('com.restorationai.log.entry', { message: 'New site photo captured', category: 'Documentation' }, project.id, 'New Photo Captured', 'info');
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
        <header className="p-4 bg-slate-900 border-b border-white/5 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('gallery')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'gallery' ? 'bg-brand-cyan text-slate-900' : 'bg-white/5 text-slate-400'}`}>Gallery</button>
                <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'generate' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}><Sparkles size={12}/><span>AI Gen</span></button>
                <button onClick={() => setActiveTab('video')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'video' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-400'}`}><Video size={12}/><span>Veo</span></button>
            </div>
            <div className="flex items-center space-x-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*,video/*" 
                    multiple 
                    className="hidden" 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isProcessing}
                    className="p-2 bg-white/5 text-slate-400 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
                    title="Upload Media"
                >
                    {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20}/>}
                </button>
                <button onClick={handleCapture} className="p-2 bg-brand-cyan text-slate-900 rounded-full shadow-lg active:scale-95 transition-transform"><Camera size={20}/></button>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'gallery' && (
                <>
                    <div className="mb-4 flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                        {allTags.map(tag => (
                            <button key={tag} onClick={() => setFilter(tag)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap border transition-all ${filter === tag ? 'bg-white text-slate-900 border-white' : 'bg-transparent text-slate-500 border-slate-700'}`}>{tag}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {filteredPhotos.map(photo => (
                            <div 
                                key={photo.id} 
                                className="relative group rounded-2xl overflow-hidden aspect-square bg-slate-900 border border-white/10 cursor-pointer"
                                onClick={() => setSelectedPhoto(photo)}
                            >
                                <img 
                                    src={photo.type === 'video' ? (photo.thumbnailUrl || photo.url) : photo.url} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                                    loading="lazy" 
                                />
                                {photo.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white">
                                            <Play size={24} fill="currentColor" />
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <p className="text-xs text-white font-medium truncate">{photo.notes}</p>
                                    <div className="flex space-x-2 mt-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleAnalyzePhoto(photo); }} 
                                            disabled={loadingPhotos.has(photo.id)} 
                                            className="p-2 bg-indigo-600 rounded-lg text-white disabled:opacity-50"
                                        >
                                            {loadingPhotos.has(photo.id) ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14} />}
                                        </button>
                                    </div>
                                </div>
                                {photoInsights[photo.id] && (
                                    <div className="absolute top-2 right-2 p-1.5 bg-indigo-500 rounded-full text-white shadow-lg animate-in zoom-in">
                                        <Sparkles size={12} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Photo/Video Detail Modal */}
                    {selectedPhoto && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="relative w-full max-w-4xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row">
                                <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
                                    {selectedPhoto.type === 'video' ? (
                                        <video 
                                            src={selectedPhoto.url} 
                                            controls 
                                            autoPlay 
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <img 
                                            src={selectedPhoto.url} 
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    )}
                                </div>
                                <div className="w-full md:w-80 p-6 flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Media Details</h3>
                                            <p className="text-xs text-slate-400 mt-1">{new Date(selectedPhoto.timestamp).toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedPhoto(null)}
                                            className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Active Tags</label>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {selectedPhoto.tags.length > 0 ? selectedPhoto.tags.map(tag => (
                                                    <button 
                                                        key={tag} 
                                                        onClick={() => toggleTag(selectedPhoto.id, tag)}
                                                        className="px-2 py-1 bg-brand-cyan/20 border border-brand-cyan/30 rounded-md text-[10px] font-bold text-brand-cyan flex items-center space-x-1 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-colors"
                                                    >
                                                        <span>{tag}</span>
                                                        <X size={10} />
                                                    </button>
                                                )) : (
                                                    <span className="text-[10px] text-slate-600 italic">No tags assigned</span>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex space-x-2">
                                                    <input 
                                                        type="text"
                                                        value={customTag}
                                                        onChange={(e) => setCustomTag(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addCustomTag(selectedPhoto.id)}
                                                        placeholder="Add custom tag..."
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand-cyan transition-colors"
                                                    />
                                                    <button 
                                                        onClick={() => addCustomTag(selectedPhoto.id)}
                                                        className="px-3 py-2 bg-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-colors"
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {Object.entries(SUGGESTED_TAGS).map(([category, tags]) => (
                                                        <div key={category}>
                                                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mb-1 block">{category}</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {tags.map(tag => (
                                                                    <button 
                                                                        key={tag}
                                                                        onClick={() => toggleTag(selectedPhoto.id, tag)}
                                                                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${selectedPhoto.tags.includes(tag) ? 'bg-brand-cyan text-slate-900' : 'bg-white/5 text-slate-500 border border-white/5 hover:border-white/20'}`}
                                                                    >
                                                                        {tag}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Notes & AI Insights</label>
                                            <div className="space-y-4">
                                                <textarea 
                                                    value={selectedPhoto.notes}
                                                    onChange={(e) => updateNotes(selectedPhoto.id, e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed outline-none focus:border-brand-cyan transition-colors min-h-[100px] resize-none"
                                                    placeholder="Add site notes..."
                                                />
                                                {selectedPhoto.aiInsight && (
                                                    <div className="mt-4 pt-4 border-t border-white/5">
                                                        <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                                                            <Sparkles size={14} />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">AI Insight</span>
                                                        </div>
                                                        <p className="text-xs text-indigo-200/80 leading-relaxed">
                                                            {selectedPhoto.aiInsight}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-white/5">
                                        <button 
                                            onClick={() => handleAnalyzePhoto(selectedPhoto)}
                                            disabled={loadingPhotos.has(selectedPhoto.id)}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                                        >
                                            {loadingPhotos.has(selectedPhoto.id) ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin" />
                                                    <span>Analyzing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <BrainCircuit size={18} />
                                                    <span>Re-Analyze with AI</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {(activeTab === 'generate' || activeTab === 'video') && (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">Feature module simulated.</div>
            )}
        </div>
    </div>
  );
};

export default PhotoDocumentation;
