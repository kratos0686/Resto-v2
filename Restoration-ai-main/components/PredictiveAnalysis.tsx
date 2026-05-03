
import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Calendar, 
  TrendingDown, 
  AlertTriangle, 
  Share2, 
  ArrowLeft
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import { getProjectById } from '../services/api';
import { GoogleGenAI, Type } from "@google/genai";

interface PredictiveAnalysisProps {
  onBack: () => void;
}

interface PredictionResult {
  estimatedDryDate: string;
  hoursRemaining: number;
  confidence: number;
  chartData: { day: string; actual?: number; predicted: number }[];
  factors: { title: string; description: string; type: 'positive' | 'negative' }[];
}

const PredictiveAnalysis: React.FC<PredictiveAnalysisProps> = ({ onBack }) => {
  const { selectedProjectId, isOnline } = useAppContext();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [predictionData, setPredictionData] = useState<PredictionResult | null>(null);

  useEffect(() => {
    const generatePrediction = async () => {
      if (!selectedProjectId) return;
      
      const project = await getProjectById(selectedProjectId);
      if (!project) return;

      if (!isOnline) {
          // Offline Fallback
          setPredictionData({
              estimatedDryDate: 'Pending Sync',
              hoursRemaining: 0,
              confidence: 0,
              chartData: [],
              factors: []
          });
          setIsAnalyzing(false);
          return;
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Prepare context from project logs
        const logsContext = JSON.stringify(project.rooms.flatMap(r => r.readings));
        const roomContext = JSON.stringify(project.rooms.map(r => ({ name: r.name, material: r.photos.map(p => p.tags).flat() })));

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze these drying logs: ${logsContext} for rooms: ${roomContext}. 
            1. Predict the "dry date" and hours remaining.
            2. Generate a chart dataset (Array of objects with 'day', 'actual' (optional), 'predicted') showing the moisture content trajectory down to 10%.
            3. Identify 2 key positive/negative factors affecting drying.
            Return JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        estimatedDryDate: { type: Type.STRING },
                        hoursRemaining: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER },
                        chartData: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    day: { type: Type.STRING }, 
                                    actual: { type: Type.NUMBER }, 
                                    predicted: { type: Type.NUMBER } 
                                } 
                            } 
                        },
                        factors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['positive', 'negative'] }
                                }
                            }
                        }
                    },
                    required: ['estimatedDryDate', 'hoursRemaining', 'confidence', 'chartData', 'factors']
                }
            }
        });
        
        const result = JSON.parse(response.text || '{}');
        setPredictionData(result);

      } catch (error) {
          console.error("Prediction failed", error);
      } finally {
          setIsAnalyzing(false);
      }
    };

    generatePrediction();
  }, [selectedProjectId, isOnline]);

  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-white">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-100 rounded-full animate-spin border-t-blue-600" />
          <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Calculating Trajectory</h2>
          <p className="text-gray-500 text-sm mt-2">Analyzing historical drying profiles and current atmospheric logs...</p>
        </div>
      </div>
    );
  }

  if (!predictionData) return <div className="p-8">Unable to generate prediction.</div>;

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center space-x-3">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-900">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Drying Insight</h2>
          <p className="text-sm text-gray-500">AI-Powered Predictive Analysis</p>
        </div>
      </header>

      {/* Primary Prediction Card */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <BrainCircuit size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-6">
            <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Estimated Dry-Out</span>
          </div>
          
          <div className="flex items-baseline space-x-2">
            <h3 className="text-4xl font-black">{predictionData.estimatedDryDate}</h3>
          </div>
          <p className="text-blue-100 text-sm mt-1">Approximately {predictionData.hoursRemaining} hours remaining</p>

          <div className="mt-8 flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5 text-blue-100">
                <span>Confidence Score</span>
                <span>{predictionData.confidence}%</span>
              </div>
              <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-full rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${predictionData.confidence}%` }} />
              </div>
            </div>
            <button className="bg-white text-blue-700 p-3 rounded-2xl shadow-lg active:scale-95 transition-transform">
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Trajectory Chart */}
      <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-bold text-gray-800">Drying Trajectory</h4>
          <div className="flex items-center space-x-3 text-[10px] font-bold text-gray-400 uppercase">
            <span className="flex items-center"><div className="w-2 h-2 bg-blue-600 rounded-full mr-1.5" /> Actual</span>
            <span className="flex items-center"><div className="w-2 h-2 bg-gray-200 rounded-full mr-1.5" /> Prediction</span>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={predictionData.chartData}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <ReferenceLine y={10} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Dry Goal', fontSize: 10, fill: '#10b981' }} />
              <Area type="monotone" dataKey="predicted" stroke="#e5e7eb" strokeWidth={2} fill="transparent" strokeDasharray="5 5" dot={false} />
              <Area type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorActual)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Analysis Details */}
      <div className="space-y-3">
        <h4 className="font-bold text-gray-800 px-1">Factor Analysis</h4>
        
        {predictionData.factors.map((factor, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-start space-x-4">
            <div className={`p-3 rounded-xl ${factor.type === 'positive' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                {factor.type === 'positive' ? <TrendingDown size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
                <h5 className="text-sm font-bold text-gray-900">{factor.title}</h5>
                <p className="text-xs text-gray-500 mt-0.5">{factor.description}</p>
            </div>
            </div>
        ))}
      </div>

      <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 shadow-lg active:scale-[0.98] transition-all">
        <Calendar size={20} />
        <span>Update Project Timeline</span>
      </button>
    </div>
  );
};

export default PredictiveAnalysis;
