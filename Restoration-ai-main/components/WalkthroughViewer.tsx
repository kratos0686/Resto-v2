
import React, { useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Layers, Palette, Download, FileImage, FileCode2 } from 'lucide-react';
import { RoomScan, PlacedPhoto } from '../types';
import { EventBus } from '../services/EventBus';

interface WalkthroughViewerProps {
  scan: RoomScan;
  onClose: () => void;
}

const WalkthroughViewer: React.FC<WalkthroughViewerProps> = ({ scan, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedPhoto, setSelectedPhoto] = useState<PlacedPhoto | null>(null);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setZoom(prev => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.001)));
  }, []);
  
  const resetView = () => {
    setZoom(1);
  };

  const handleExport = (format: 'pdf' | 'jpg' | 'dxf' | 'esx') => {
    setShowExportMenu(false);
    EventBus.publish('com.restorationai.export', { format, roomName: scan.roomName }, undefined, `Exporting ${format.toUpperCase()}...`, 'info');
    
    // Simulate export delay
    setTimeout(() => {
        EventBus.publish('com.restorationai.export.complete', { format, roomName: scan.roomName }, undefined, `${format.toUpperCase()} Export Complete`, 'success');
        alert(`Simulated export of ${scan.roomName} floor plan as ${format.toUpperCase()}`);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-[100] flex flex-col animate-in fade-in duration-300">
      <header className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-md text-white border-b border-white/10 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg"><Layers size={20} className="text-emerald-400"/></div>
          <div><h3 className="font-bold">{scan.roomName} Floorplan</h3><p className="text-[10px] uppercase font-bold text-slate-400">{scan.dimensions.sqft.toFixed(1)} SQ FT • {scan.dimensions.length.toFixed(1)}' x {scan.dimensions.width.toFixed(1)}'</p></div>
        </div>
        
        <div className="flex items-center space-x-2 bg-black/40 rounded-lg p-1 border border-white/10 relative">
             {scan.materials && (
                 <button onClick={() => setShowMaterials(!showMaterials)} className={`p-2 rounded-md transition-all ${showMaterials ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-white'}`} title="View Materials"><Palette size={16} /></button>
             )}
             <button onClick={() => setShowExportMenu(!showExportMenu)} className={`p-2 rounded-md transition-all ${showExportMenu ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500 hover:text-white'}`} title="Export Floorplan"><Download size={16} /></button>
             
             {showExportMenu && (
                 <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
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

        <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors ml-2"><X size={20} /></button>
      </header>

      <main className="flex-1 flex items-center justify-center overflow-hidden relative bg-slate-950" onWheel={handleWheel}>
        {showMaterials && scan.materials && (
            <div className="absolute top-4 left-4 w-64 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 z-40 animate-in slide-in-from-left duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">Material Matrix</h4>
                    <button onClick={() => setShowMaterials(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Flooring</p>
                        <p className="text-sm text-white font-medium">{scan.materials.materials.flooring_system.material_category}</p>
                        <p className="text-[10px] text-slate-400 italic">{scan.materials.materials.flooring_system.grade_estimation}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Walls</p>
                        <p className="text-sm text-white font-medium">{scan.materials.materials.wall_system.substrate_material}</p>
                        <p className="text-[10px] text-slate-400 italic">{scan.materials.materials.wall_system.finish_type}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Trim</p>
                        <p className="text-sm text-white font-medium">{scan.materials.materials.trim_and_millwork.baseboard_material}</p>
                        <p className="text-[10px] text-slate-400 italic">{scan.materials.materials.trim_and_millwork.height_inches}" Height</p>
                    </div>
                </div>
            </div>
        )}
        
        <div className="w-full h-full p-8 flex items-center justify-center">
            <div 
                className="w-full max-w-3xl aspect-square bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center p-8 relative transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
            >
                {scan.floorPlanSvg ? (
                    <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:text-brand-cyan" dangerouslySetInnerHTML={{ __html: scan.floorPlanSvg }} />
                ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                        <Layers size={48} className="mb-4 opacity-50" />
                        <p>No floorplan available</p>
                    </div>
                )}
                
                {/* Overlay photos on the 2D floorplan if possible, or just list them */}
                {scan.placedPhotos && scan.placedPhotos.length > 0 && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        {scan.placedPhotos.map(photo => (
                            <button key={photo.id} onClick={() => setSelectedPhoto(photo)} className="w-12 h-12 bg-slate-800 rounded-lg border border-white/20 overflow-hidden hover:border-brand-cyan transition-colors shadow-lg">
                                <img src={photo.thumbnailUrl || photo.url} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </main>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex justify-center items-center space-x-2 z-20 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-md text-white p-2 rounded-2xl border border-white/10 flex space-x-2 pointer-events-auto shadow-xl">
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-3 hover:bg-white/10 rounded-xl transition-colors"><ZoomOut size={20} /></button>
          <button onClick={resetView} className="p-3 hover:bg-white/10 rounded-xl transition-colors border-l border-r border-white/10"><RotateCcw size={20} /></button>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-3 hover:bg-white/10 rounded-xl transition-colors"><ZoomIn size={20} /></button>
        </div>
      </div>

      {selectedPhoto && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-30 animate-in fade-in duration-200" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-4xl w-full p-4" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedPhoto(null)} className="absolute -top-12 right-4 text-white hover:text-gray-300"><X size={32}/></button>
              <img src={selectedPhoto.url} className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl ring-1 ring-white/20 animate-in zoom-in-95 duration-300" alt={`Site photo ${selectedPhoto.id}`} />
              <div className="mt-4 text-white text-center">
                  <h4 className="font-bold text-lg">{selectedPhoto.notes || `Photo ID: ${selectedPhoto.id}`}</h4>
                  <p className="text-sm text-gray-400">Position: {selectedPhoto.position.wall} wall</p>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkthroughViewer;
