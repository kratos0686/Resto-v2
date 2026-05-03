import React, { useState } from 'react';
import { Calculator, Thermometer, Droplets, Gauge, Wind, Zap } from 'lucide-react';
import { calculatePsychrometricsFromDryBulb } from '../utils/psychrometrics';
import { PsychrometricsData } from '../types';

const PsychrometricCalculator: React.FC = () => {
  const [dryBulb, setDryBulb] = useState<string>('75');
  const [rh, setRh] = useState<string>('50');
  const [pressure, setPressure] = useState<string>('29.92');

  const results: PsychrometricsData | null = React.useMemo(() => {
    const t = parseFloat(dryBulb);
    const r = parseFloat(rh);
    const p = parseFloat(pressure);

    if (!isNaN(t) && !isNaN(r) && !isNaN(p)) {
      // Convert pressure from inHg to mb for calculation
      // 1 inHg = 33.8639 mb
      const pressureMb = p * 33.8639;
      const calc = calculatePsychrometricsFromDryBulb(t, r, pressureMb);
      
      return {
        dryBulb: t,
        relativeHumidity: r,
        pressure: p,
        dewPoint: calc.dewPoint,
        gpp: calc.gpp,
        vaporPressure: calc.vaporPressure,
        enthalpy: calc.enthalpy
      };
    } else {
      return null;
    }
  }, [dryBulb, rh, pressure]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-900">Psychrometric Calculator</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Inputs */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-slate-400" />
            Dry Bulb Temp (°F)
          </label>
          <input
            type="number"
            value={dryBulb}
            onChange={(e) => setDryBulb(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-slate-400" />
            Relative Humidity (%)
          </label>
          <input
            type="number"
            value={rh}
            onChange={(e) => setRh(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-slate-400" />
            Pressure (inHg)
          </label>
          <input
            type="number"
            value={pressure}
            onChange={(e) => setPressure(e.target.value)}
            step="0.01"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ResultCard label="Grains Per Pound" value={results.gpp} unit="GPP" icon={Wind} color="text-blue-600" bg="bg-blue-50" />
          <ResultCard label="Dew Point" value={results.dewPoint} unit="°F" icon={Thermometer} color="text-emerald-600" bg="bg-emerald-50" />
          <ResultCard label="Vapor Pressure" value={results.vaporPressure} unit="inHg" icon={Droplets} color="text-purple-600" bg="bg-purple-50" />
          <ResultCard label="Enthalpy" value={results.enthalpy || 0} unit="BTU/lb" icon={Zap} color="text-amber-600" bg="bg-amber-50" />
        </div>
      )}
    </div>
  );
};

interface ResultCardProps {
  label: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ label, value, unit, icon: Icon, color, bg }) => (
  <div className={`p-4 rounded-lg ${bg} border border-transparent`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-xs font-medium ${color} uppercase tracking-wider`}>{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-900">
      {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
    </div>
  </div>
);

export default PsychrometricCalculator;
