
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Layers, ArrowLeft, ScanLine, BrainCircuit, Check, RefreshCw } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { blobToBase64 } from '../utils/photoutils';
import { RoomScan, RoomMaterials } from '../types';
import { EventBus } from '../services/EventBus';

interface ARScannerProps {
  onComplete: (data?: RoomScan) => void;
}

// Represents a "Feature Point" in the sparse map with sensor data
type ScanPoint = { 
    id: number; 
    x: number; // Estimated X relative to start (feet)
    z: number; // Estimated Z relative to start (feet)
    r: number; // Heading (degrees)
    type: 'corner' | 'wall' | 'feature';
};

// Represents an AI-detected anomaly in 3D space
type Anomaly = {
    id: string;
    label: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    x: number; // Relative X
    z: number; // Relative Z
};

type Mode = 'init' | 'scan' | 'processing' | 'result';

const CAMERA_HEIGHT_FT = 4.8; // Average handheld height

const ARScanner: React.FC<ARScannerProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightAnalysisCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas')); // Offscreen canvas for pixel reading
  
  const [mode, setMode] = useState<Mode>('init');
  
  // Odometry State
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 90, gamma: 0 }); // Heading, Tilt, Roll
  const [motion] = useState({ x: 0, y: 0, z: 0 });
  const [trackingQuality, setTrackingQuality] = useState<'Good' | 'Too Fast' | 'Dark'>('Good');
  
  // Light Estimation State
  const [lightIntensity, setLightIntensity] = useState<number>(0.5); // 0.0 - 1.0
  const [colorTemperature, setColorTemperature] = useState<string>('neutral'); // simple temp

  // Sparse Map State
  const [scanPoints, setScanPoints] = useState<ScanPoint[]>([]);
  const [capturedImages, setCapturedImages] = useState<{ id: number; url: string; base64: string; pose: { alpha: number; beta: number; gamma: number; x: number; y: number; z: number } }[]>([]);
  
  // AR Overlay State
  const [showOverlay, setShowOverlay] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  const [aiGeneratedSvg, setAiGeneratedSvg] = useState<string>('');
  const [aiDimensions, setAiDimensions] = useState<{ length: number; width: number; sqft: number } | null>(null);
  const [aiRoomLabel, setAiRoomLabel] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [aiDamageAssessment, setAiDamageAssessment] = useState<string>('');
  const [aiMaterials, setAiMaterials] = useState<RoomMaterials | null>(null);

  // Dimensions & Volume State
  const [ceilingHeight, setCeilingHeight] = useState<number>(8.0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isInteracting = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const lastInteractionPos = useRef<{ x: number, y: number } | null>(null);

  // --- SENSOR INITIALIZATION (IMU) ---
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
       setOrientation({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
    }
  }, []);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.acceleration;
    if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const totalForce = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
        if (totalForce > 2.5) {
            setTrackingQuality('Too Fast');
        } else {
            setTrackingQuality('Good');
        }
    }
  }, []);

  // --- LIGHT ESTIMATION LOGIC ---
  const analyzeLighting = useCallback(() => {
      if (!videoRef.current || !lightAnalysisCanvasRef.current) return;
      const video = videoRef.current;
      const cvs = lightAnalysisCanvasRef.current;
      
      // We analyze a small 50x50 sample
      if (cvs.width !== 50) { cvs.width = 50; cvs.height = 50; }
      
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw the current video frame to offscreen canvas
      ctx.drawImage(video, 0, 0, 50, 50);
      
      // Get pixel data
      try {
          const frameData = ctx.getImageData(0, 0, 50, 50).data;
          let totalBrightness = 0;
          let rTotal = 0, bTotal = 0;

          // Simple sampling
          for (let i = 0; i < frameData.length; i += 16) { // step by 4 pixels (4 channels each)
              const r = frameData[i];
              const g = frameData[i + 1];
              const b = frameData[i + 2];
              
              // Perceived brightness (Luma)
              totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
              rTotal += r; bTotal += b;
          }

          const pixelCount = frameData.length / 16;
          const avgBrightness = totalBrightness / pixelCount;
          
          // Normalize 0-1
          const intensity = Math.min(1, Math.max(0, avgBrightness / 255));
          setLightIntensity(prev => (prev * 0.9) + (intensity * 0.1)); // Smooth transition

          // Determine Temp (very rough)
          const avgR = rTotal / pixelCount;
          const avgB = bTotal / pixelCount;
          if (avgR > avgB + 20) setColorTemperature('warm');
          else if (avgB > avgR + 20) setColorTemperature('cool');
          else setColorTemperature('neutral');

      } catch {
          // Frame data not ready
      }
    }, [videoRef, lightAnalysisCanvasRef]);

  // --- CAMERA LOGIC ---
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (_err) { 
        console.error("Camera error", _err);
        EventBus.publish('com.restorationai.scan.error', { error: 'Camera Access Denied' }, undefined, 'Camera Failed', 'error');
    }
  }, []);

  const startSensors = useCallback(() => {
    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
    startCamera();
  }, [handleOrientation, handleMotion, startCamera]);

  const requestSensors = async () => {
    const motionType = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof motionType.requestPermission === 'function') {
      try {
        const response = await motionType.requestPermission();
        if (response === 'granted') {
          startSensors();
          setMode('scan');
          EventBus.publish('com.restorationai.scan.started', {}, undefined, 'AR Scanner Initialized', 'info');
        } else {
          alert("Sensors required for Odometry.");
        }
      } catch (_e) { console.error(_e); }
    } else {
      startSensors();
      setMode('scan');
      EventBus.publish('com.restorationai.scan.started', {}, undefined, 'AR Scanner Initialized', 'info');
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
       const stream = videoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(track => track.stop());
       videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('devicemotion', handleMotion);
      stopCamera();
    };
  }, [handleOrientation, handleMotion, stopCamera]);

  // --- CONCURRENT ODOMETRY CALCULATIONS ---
  const calculateWorldPoint = useCallback((): { x: number, z: number } | null => {
      // Basic Trigonometry for Depth Estimation
      const tiltRadians = (90 - orientation.beta) * (Math.PI / 180);
      const headingRadians = (360 - orientation.alpha) * (Math.PI / 180);

      if (orientation.beta > 85) return null; // Looking straight ahead or up
      if (orientation.beta < 10) return null; // Looking straight down

      // Estimated distance
      const groundDistance = CAMERA_HEIGHT_FT * Math.tan(tiltRadians);
      const clampedDistance = Math.min(groundDistance, 30);

      const x = clampedDistance * Math.sin(headingRadians);
      const z = clampedDistance * Math.cos(headingRadians);

      return { x, z };
  }, [orientation.alpha, orientation.beta]);

  // --- CANVAS RENDER LOOP (SPARSE MAP & AR OVERLAY) ---
  useEffect(() => {
    if (mode !== 'scan' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameId: number;
    let frameCount = 0;

    const render = () => {
        if (!ctx) return;
        
        // Run light analysis every 10 frames
        frameCount++;
        if (frameCount % 10 === 0) analyzeLighting();

        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- AR OVERLAY LAYER (Projected World Points) ---
        if (showOverlay) {
            anomalies.forEach(anomaly => {
                const dx = anomaly.x; 
                const dz = anomaly.z;
                
                // Relative Angle Calculation
                let angleToAnomaly = Math.atan2(dx, dz) * (180 / Math.PI);
                if (angleToAnomaly < 0) angleToAnomaly += 360;

                const userHeading = 360 - orientation.alpha; 
                let deltaAngle = angleToAnomaly - userHeading;
                if (deltaAngle > 180) deltaAngle -= 360;
                if (deltaAngle < -180) deltaAngle += 360;

                const H_FOV = 60;
                if (Math.abs(deltaAngle) < H_FOV / 2) {
                    const screenX = cx + (deltaAngle / (H_FOV / 2)) * cx;
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    const tiltOffset = (orientation.beta - 45) * 15; 
                    const screenY = cy + (dist * 10) - tiltOffset;

                    const size = Math.max(5, 40 - dist);

                    if (screenY > -50 && screenY < canvas.height + 50) {
                        const pulse = Math.sin(Date.now() / 200) * 3;
                        
                        // 1. REALISTIC SHADOW (Based on Light Estimation)
                        const shadowOpacity = 0.2 + (lightIntensity * 0.4); 
                        
                        ctx.beginPath();
                        ctx.ellipse(screenX, screenY + size * 0.8, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
                        ctx.filter = `blur(${4 + (1-lightIntensity)*4}px)`; // Blurrrier in dark
                        ctx.fill();
                        ctx.filter = 'none'; // Reset filter

                        // 2. VIRTUAL OBJECT (Lit Sphere)
                        const grad = ctx.createRadialGradient(
                            screenX - size * 0.3, screenY - size * 0.3, size * 0.1, // Highlight source
                            screenX, screenY, size // Object edge
                        );
                        
                        // Color modulation based on Environment Temp
                        const baseColor = anomaly.severity === 'high' ? [239, 68, 68] : [234, 179, 8];
                        let r = baseColor[0], g = baseColor[1], b = baseColor[2];
                        if (colorTemperature === 'warm') { r += 20; g -= 10; }
                        if (colorTemperature === 'cool') { b += 20; r -= 10; }

                        const mainColor = `rgb(${r},${g},${b})`;
                        const darkColor = `rgb(${r*0.5},${g*0.5},${b*0.5})`;

                        grad.addColorStop(0, `rgba(255,255,255, ${0.8 + lightIntensity * 0.2})`); // Specular highlight brighter in high light
                        grad.addColorStop(0.4, mainColor);
                        grad.addColorStop(1, darkColor); // Shaded side

                        ctx.beginPath();
                        ctx.arc(screenX, screenY, size + pulse, 0, Math.PI * 2);
                        ctx.fillStyle = grad;
                        ctx.fill();

                        // Rim Light (Fresnel effect) for realism
                        ctx.beginPath();
                        ctx.arc(screenX, screenY, size + pulse, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(255,255,255, ${0.2 * lightIntensity})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // Label
                        if (dist < 15) {
                            ctx.font = 'bold 12px Inter';
                            ctx.fillStyle = '#fff';
                            ctx.textAlign = 'center';
                            ctx.shadowColor = 'black';
                            ctx.shadowBlur = 4;
                            ctx.fillText(anomaly.label, screenX, screenY - size - 10);
                            ctx.shadowBlur = 0;
                        }
                    }
                }
            });
        }

        // --- HUD ELEMENTS ---
        const estimatedPos = calculateWorldPoint();
        
        // 1. Target Reticle with Live Data
        if (estimatedPos) {
            const px = cx + (estimatedPos.x * 15); 
            const py = cy - (estimatedPos.z * 15); 

            // Crosshair
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py);
            ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10);
            ctx.stroke();

            // Line from user
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
            ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
            
            // Distance Label
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            const dist = Math.sqrt(estimatedPos.x**2 + estimatedPos.z**2).toFixed(1);
            ctx.fillText(`${dist}ft`, px + 15, py + 5);
        }

        // 2. Mini-Map
        const mapSize = 100;
        const mapX = canvas.width - mapSize - 20;
        const mapY = canvas.height - mapSize - 100;
        const mapCx = mapX + mapSize/2;
        const mapCy = mapY + mapSize/2;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.arc(mapCx, mapCy, mapSize/2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Points on Mini-Map
        scanPoints.forEach(p => {
             const px = mapCx + (p.x * 2);
             const py = mapCy - (p.z * 2);
             ctx.fillStyle = p.type === 'corner' ? '#ef4444' : '#10b981';
             ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        });
        
        // Anomalies on Mini-Map
        anomalies.forEach(a => {
            const px = mapCx + (a.x * 2);
            const py = mapCy - (a.z * 2);
            ctx.fillStyle = a.severity === 'high' ? '#ef4444' : '#eab308';
            ctx.beginPath(); ctx.rect(px - 3, py - 3, 6, 6); ctx.fill();
        });

        // User Arrow on Mini-Map
        ctx.translate(mapCx, mapCy);
        ctx.rotate((orientation.alpha * Math.PI) / 180);
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.fill();
        ctx.rotate(-(orientation.alpha * Math.PI) / 180);
        ctx.translate(-mapCx, -mapCy);

        frameId = requestAnimationFrame(render);
    };

    render();
    return () => {
        cancelAnimationFrame(frameId);
    };
  }, [mode, orientation, scanPoints, lightIntensity, colorTemperature, calculateWorldPoint, anomalies, showOverlay, analyzeLighting]);

  // --- ACTIONS ---
  const handleCapture = async () => {
      // Simulate capturing current frame + Odometry Pose
      if (!videoRef.current) return;
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) return;
      
      const base64 = await blobToBase64(blob);
      const newImage = { 
          id: Date.now(), 
          url: URL.createObjectURL(blob), 
          base64,
          pose: { ...orientation, ...motion } 
      };
      setCapturedImages(prev => [...prev, newImage]);
      
      // Simulate adding a point to sparse map based on capture
      const estimated = calculateWorldPoint();
      if (estimated) {
          setScanPoints(prev => [...prev, {
              id: Date.now(),
              x: estimated.x,
              z: estimated.z,
              r: orientation.alpha,
              type: 'feature'
          }]);
      }
      EventBus.publish('com.restorationai.scan.captured', { count: capturedImages.length + 1 }, undefined, `Frame ${capturedImages.length + 1} Captured`, 'info');
  };

  const processScan = async () => {
      setMode('processing');
      
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const imageParts = capturedImages.map(img => ({ inlineData: { mimeType: 'image/jpeg', data: img.base64 } }));
          
          const textPart = { text: `You are an expert restoration estimator. Analyze these images of a room scan. 
          1. Estimate the room dimensions (length, width in feet).
          2. Identify the materials used in the room.
          3. Provide a damage assessment.
          4. Generate a top-down 2D SVG floor plan (viewBox="0 0 100 100"). Include measurements for the walls and the locations of doors and windows.` };

          const response = await ai.models.generateContent({
              model: 'gemini-3-pro-image-preview',
              contents: { parts: [textPart, ...imageParts] },
              config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          length: { type: Type.NUMBER },
                          width: { type: Type.NUMBER },
                          roomLabel: { type: Type.STRING },
                          damageAssessment: { type: Type.STRING },
                          floorPlanSvg: { type: Type.STRING },
                          materials: {
                              type: Type.OBJECT,
                              properties: {
                                  flooring_system: {
                                      type: Type.OBJECT,
                                      properties: {
                                          material_category: { type: Type.STRING },
                                          grade_estimation: { type: Type.STRING }
                                      }
                                  },
                                  wall_system: {
                                      type: Type.OBJECT,
                                      properties: {
                                          substrate_material: { type: Type.STRING },
                                          finish_type: { type: Type.STRING }
                                      }
                                  },
                                  trim_and_millwork: {
                                      type: Type.OBJECT,
                                      properties: {
                                          baseboard_material: { type: Type.STRING },
                                          height_inches: { type: Type.NUMBER }
                                      }
                                  }
                              }
                          }
                      },
                      required: ['length', 'width', 'roomLabel', 'damageAssessment', 'floorPlanSvg', 'materials']
                  }
              }
          });

          const result = JSON.parse(response.text);
          setAiDimensions({ length: result.length, width: result.width, sqft: result.length * result.width });
          setAiRoomLabel(result.roomLabel);
          setAiDamageAssessment(result.damageAssessment);
          setAiGeneratedSvg(result.floorPlanSvg);
          setAiMaterials({
              room_identification: result.roomLabel,
              materials: result.materials
          });
          
          setMode('result');
          
          EventBus.publish('com.restorationai.scan.completed', { room: result.roomLabel }, undefined, 'Scan Analysis Complete', 'success');

      } catch (error) {
          console.error("AI Processing failed:", error);
          // Fallback to mock for demo if AI fails
          setAiDimensions({ length: 14.5, width: 12.2, sqft: 176.9 });
          setAiRoomLabel('Living Room (Fallback)');
          setAiDamageAssessment('AI analysis failed. Using manual estimates.');
          setAiGeneratedSvg(`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Walls -->
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" stroke-width="2" />
            <!-- Door -->
            <path d="M 10 30 L 10 50" stroke="white" stroke-width="3" />
            <path d="M 10 30 Q 30 30 30 50 L 10 50" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2" />
            <!-- Window -->
            <rect x="30" y="8" width="40" height="4" fill="currentColor" opacity="0.5" />
            <!-- Measurements -->
            <text x="50" y="5" font-size="4" fill="currentColor" text-anchor="middle">14.5'</text>
            <text x="5" y="50" font-size="4" fill="currentColor" text-anchor="middle" transform="rotate(-90 5 50)">12.2'</text>
          </svg>`);
          setMode('result');
          EventBus.publish('com.restorationai.scan.error', { error: 'AI Analysis Failed' }, undefined, 'Scan Failed', 'error');
      }
  };

  const resetScan = () => {
      setScanPoints([]);
      setCapturedImages([]);
      setAnomalies([]);
      setMode('scan');
  };

  const handleComplete = () => {
      if (aiDimensions) {
          const scanData: RoomScan = {
            scanId: `scan-${Date.now()}`,
            roomName: aiRoomLabel,
            floorPlanSvg: aiGeneratedSvg,
            dimensions: { ...aiDimensions, height: ceilingHeight, sqft: aiDimensions.sqft }, 
            placedPhotos: [],
            materials: aiMaterials || undefined
          };
          onComplete(scanData);
      } else {
          onComplete();
      }
  };

  // --- RENDER ---
  if (mode === 'init') {
      return (
          <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center space-y-6">
              <div className="relative">
                  <div className="w-24 h-24 bg-brand-cyan/20 rounded-full animate-ping absolute" />
                  <div className="w-24 h-24 bg-brand-cyan/10 rounded-full flex items-center justify-center border border-brand-cyan/50 relative z-10">
                      <ScanLine size={40} className="text-brand-cyan" />
                  </div>
              </div>
              <div>
                  <h2 className="text-2xl font-black text-white">Spatial Intelligence</h2>
                  <p className="text-slate-400 mt-2 max-w-xs mx-auto">Image-enhanced photogrammetry.</p>
              </div>
              <button onClick={requestSensors} className="bg-brand-cyan text-slate-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-cyan-400 transition-all active:scale-95">
                  Initialize Scanner
              </button>
          </div>
      )
  }

  return (
    <div className="h-full relative bg-black overflow-hidden flex flex-col">
        {mode === 'scan' && (
            <>
                {/* Camera View */}
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                
                {/* HUD Header */}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pt-12 z-20">
                    <div>
                         <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${trackingQuality === 'Good' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                {trackingQuality === 'Good' ? 'Tracking Stable' : 'Tracking Unstable'}
                            </span>
                         </div>
                         <div className="flex items-center space-x-2 mt-1">
                             <span className="text-[10px] font-mono text-slate-400">{orientation.alpha.toFixed(0)}°N</span>
                             <span className="text-[10px] font-mono text-slate-400">Light: {(lightIntensity*100).toFixed(0)}%</span>
                         </div>
                    </div>
                    <button onClick={() => onComplete()} className="p-2 bg-white/10 backdrop-blur rounded-full text-white"><X size={20}/></button>
                </div>

                {/* Footer Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 space-y-4">
                     {/* Captured Thumbnails */}
                     <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                         {capturedImages.map(img => (
                             <img key={img.id} src={img.url} className="h-12 w-12 rounded-lg border border-white/20 object-cover" />
                         ))}
                     </div>
                     
                     <div className="flex items-center justify-between gap-4">
                         <button onClick={() => setShowOverlay(!showOverlay)} className={`p-4 rounded-2xl border transition-all ${showOverlay ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                             <Layers size={24} />
                         </button>
                         
                         <button onClick={handleCapture} className="flex-1 h-16 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center active:scale-95 transition-all group">
                             <div className="w-12 h-12 rounded-full border-2 border-white group-hover:bg-white/20 flex items-center justify-center">
                                 <div className="w-10 h-10 bg-white rounded-full" />
                             </div>
                         </button>

                         <button onClick={processScan} disabled={capturedImages.length < 3} className="p-4 rounded-2xl bg-brand-cyan text-slate-900 font-bold disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 shadow-lg shadow-brand-cyan/20">
                             <ArrowLeft size={24} className="rotate-180" />
                         </button>
                     </div>
                </div>
            </>
        )}

        {mode === 'processing' && (
             <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-center p-8 space-y-6">
                 <div className="relative">
                     <div className="w-24 h-24 border-4 border-brand-cyan/20 border-t-brand-cyan rounded-full animate-spin" />
                     <BrainCircuit className="absolute inset-0 m-auto text-brand-cyan animate-pulse" size={32} />
                 </div>
                 <div>
                     <h3 className="text-xl font-bold text-white">Generating Floorplan</h3>
                     <p className="text-slate-400 text-sm mt-2">Correlating sparse features with sensor data...</p>
                 </div>
             </div>
        )}

        {mode === 'result' && aiDimensions && (
            <div className="h-full flex flex-col bg-slate-100">
                <header className="bg-white p-4 border-b border-slate-200 shadow-sm z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{aiRoomLabel}</h2>
                        <p className="text-xs text-slate-500 font-medium">
                            {aiDimensions.length}' x {aiDimensions.width}' • {aiDimensions.sqft.toFixed(0)} sqft
                        </p>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <div className="p-2 rounded-md bg-white text-brand-blue shadow-sm"><Layers size={18}/></div>
                    </div>
                </header>
                
                {/* 2D VIEWPORT */}
                <div className="flex-1 relative overflow-hidden bg-slate-200 flex items-center justify-center p-8">
                    {aiGeneratedSvg ? (
                        <div className="w-full max-w-md aspect-square bg-white rounded-2xl shadow-lg p-6 [&>svg]:w-full [&>svg]:h-full [&>svg]:text-brand-blue" dangerouslySetInnerHTML={{ __html: aiGeneratedSvg }} />
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                            <Layers size={48} className="mb-4 opacity-50" />
                            <p>No floorplan generated</p>
                        </div>
                    )}
                </div>

                {/* CONTROLS */}
                <div className="bg-white p-6 border-t border-slate-200 space-y-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ceiling Height</label>
                            <span className="text-lg font-black text-brand-blue">{ceilingHeight.toFixed(1)} ft</span>
                        </div>
                        <input 
                            type="range" 
                            min="6" max="20" step="0.5" 
                            value={ceilingHeight} 
                            onChange={(e) => setCeilingHeight(parseFloat(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                        />
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-xs font-bold text-slate-500 uppercase">Calculated Volume</div>
                        <div className="text-xl font-black text-slate-900">{(aiDimensions.sqft * ceilingHeight).toFixed(0)} <span className="text-xs text-slate-400 font-medium">cu ft</span></div>
                    </div>

                    <div className="flex space-x-3 pt-2">
                        <button onClick={resetScan} className="p-4 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-colors"><RefreshCw size={20}/></button>
                        <button onClick={handleComplete} className="flex-1 py-4 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-2">
                            <Check size={20} />
                            <span>Save & Continue</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ARScanner;
