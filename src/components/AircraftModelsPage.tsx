import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Flight3DMapReplay } from './Flight3DMapReplay';
import type { TrackPoint } from '../types';

// ============================================================
// MODEL CONFIGURATION (Synced from Flight3DMapReplay.tsx)
// ============================================================
interface ModelConfig {
  path: string;
  scale: number;
  rotationFix: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  'A20N': {
    path: '/models/A20N.glb',
    scale: 0.01,
    rotationFix: -90,
    offsetY: 5
  },
  'A21N_wizz': {
    path: '/models/A21N_wizz.glb',
    scale: 0.02,
    rotationFix: -90,
    offsetZ: 6.75,
    offsetX: 6
  },
  'A320': {
    path: '/models/A320.glb',
    scale: 0.01,
    rotationFix: 0
  },
  'AT76': {
    path: '/models/AT76.glb',
    scale: 0.001,
    rotationFix: 90,
    offsetX: -3000.7,
    offsetY: 0,
    offsetZ: -215.6,
  },
  'B38M': {
    path: '/models/B38M.glb',
    scale: 0.007,
    rotationFix: 0,
  },
  'B738': {
    path: '/models/B738.glb',
    scale: 0.02,
    rotationFix: 0,
  },
  'boeing_737': {
    path: '/models/boeing_737.glb',
    scale: 0.02,
    rotationFix: 0,
  },
  'M28': {
    path: '/models/M28.glb',
    scale: 0.01,
    rotationFix: -90,
  },
  'SHAHD': {
    path: '/models/SHAHED.glb',
    scale: 0.01,
    rotationFix: 0,
  },
  'Business_jet': {
    path: '/models/Business_jet.glb',
    scale: 0.02,
    rotationFix: 0,
  },
  'small': {
    path: '/models/small.glb',
    scale: 0.02,
    rotationFix: 0,
  },
};

const AIRCRAFT_TYPE_TO_MODEL: Record<string, string> = {
  'A20N': 'A20N',
  'A21N': 'A21N_wizz',
  'A320': 'A320',
  'A321': 'A21N_wizz',
  'A319': 'A320',
  'A318': 'A320',
  'B38M': 'B38M',
  'B738': 'B738',
  'B737': 'boeing_737',
  'B739': 'B738',
  'B37M': 'B38M',
  'AT76': 'AT76',
  'AT72': 'AT76',
  'ATR': 'AT76',
  'DH8D': 'AT76',
  'M28': 'M28',
  'M28T': 'M28',
  'C295': 'M28',
  'CN35': 'M28',
  'G650': 'Business_jet',
  'GL5T': 'Business_jet',
  'C680': 'Business_jet',
  'C56X': 'Business_jet',
  'CL60': 'Business_jet',
  'FA7X': 'Business_jet',
  'GLEX': 'Business_jet',
  'C172': 'small',
  'C152': 'small',
  'PA28': 'small',
  'SR22': 'small',
  'P28A': 'small',
  'C182': 'small',
  'SHAHD': 'SHAHD',
  'C208': 'small',
};

const CATEGORY_TO_MODEL: Record<string, string> = {
  'Passenger': 'A320',
  'Cargo': 'B738',
  'Business_jets': 'Business_jet',
  'Military_and_government': 'M28',
  'General_aviation': 'small',
  'Other_service': 'small',
  'Helicopters': 'small',
};

// Model descriptions for display
const MODEL_DESCRIPTIONS: Record<string, { name: string; category: string; description: string; icaoType: string }> = {
  'A20N': { name: 'Airbus A320neo', category: 'Airbus', description: 'Narrow-body, single-aisle aircraft', icaoType: 'A20N' },
  'A21N_wizz': { name: 'Airbus A321neo (Wizz)', category: 'Airbus', description: 'Larger narrow-body variant', icaoType: 'A21N' },
  'A320': { name: 'Airbus A320', category: 'Airbus', description: 'Standard A320 model', icaoType: 'A320' },
  'AT76': { name: 'ATR 72/76', category: 'Turboprop', description: 'Regional turboprop aircraft', icaoType: 'AT76' },
  'B38M': { name: 'Boeing 737 MAX 8', category: 'Boeing', description: 'Latest 737 variant', icaoType: 'B38M' },
  'B738': { name: 'Boeing 737-800', category: 'Boeing', description: 'Popular narrow-body', icaoType: 'B738' },
  'boeing_737': { name: 'Boeing 737 (Generic)', category: 'Boeing', description: 'Generic 737 model', icaoType: 'B737' },
  'M28': { name: 'PZL M28 Skytruck', category: 'Military', description: 'Military transport aircraft', icaoType: 'M28' },
  'SHAHD': { name: 'Shahed Drone', category: 'Military', description: 'Military drone', icaoType: 'SHAHD' },
  'Business_jet': { name: 'Business Jet', category: 'Private', description: 'Corporate/private jet', icaoType: 'GLEX' },
  'small': { name: 'Small Aircraft', category: 'General Aviation', description: 'Light aircraft / GA', icaoType: 'C172' },
};

// Generate a demo flight track for testing a model
function generateDemoTrack(_modelKey: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const startLat = 32.0;
  const startLon = 34.8;
  const numPoints = 100;
  
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    const lat = startLat + progress * 0.5;
    const lon = startLon + progress * 0.3;
    
    // Create a realistic flight profile: climb, cruise, descent
    let alt: number;
    if (progress < 0.2) {
      alt = 1000 + (progress / 0.2) * 34000; // Climb to 35000
    } else if (progress < 0.8) {
      alt = 35000; // Cruise
    } else {
      alt = 35000 - ((progress - 0.8) / 0.2) * 34000; // Descent
    }
    
    // Add some turns
    const heading = 45 + Math.sin(progress * Math.PI * 4) * 15;
    
    points.push({
      lat,
      lon,
      alt,
      heading,
      gspeed: 450,
      timestamp: Date.now() / 1000 - (numPoints - i) * 60,
    });
  }
  
  return points;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Airbus': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'Boeing': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  'Turboprop': 'bg-green-500/20 text-green-400 border-green-500/40',
  'Military': 'bg-red-500/20 text-red-400 border-red-500/40',
  'Private': 'bg-purple-500/20 text-purple-400 border-purple-500/40',
  'General Aviation': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
};

// Model Card Component
function ModelCard({ modelKey, config, isSelected, onClick, onTest3D }: {
  modelKey: string;
  config: ModelConfig;
  isSelected: boolean;
  onClick: () => void;
  onTest3D: () => void;
}) {
  const description = MODEL_DESCRIPTIONS[modelKey] || { 
    name: modelKey, 
    category: 'Unknown', 
    description: 'No description available',
    icaoType: modelKey 
  };

  const categoryColor = CATEGORY_COLORS[description.category] || 'bg-gray-500/20 text-gray-400 border-gray-500/40';

  // Find which aircraft types use this model
  const mappedTypes = Object.entries(AIRCRAFT_TYPE_TO_MODEL)
    .filter(([_, model]) => model === modelKey)
    .map(([type]) => type);

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(99,209,235,0.3)]' 
          : 'hover:ring-1 hover:ring-cyan-400/50'
      }`}
      style={{
        background: isSelected 
          ? 'linear-gradient(145deg, rgba(99,209,235,0.15) 0%, rgba(14,19,32,0.9) 100%)'
          : 'linear-gradient(145deg, rgba(14,19,32,0.7) 0%, rgba(5,5,10,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Model Preview Area - Static placeholder */}
      <div className="h-32 relative flex items-center justify-center bg-gradient-to-b from-gray-900/50 to-black/50">
        {/* 3D Icon */}
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-cyan-400/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
          </svg>
          <span className="text-xs text-gray-500 font-mono">{config.path.split('/').pop()}</span>
        </div>
        
        {/* Category Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-mono border ${categoryColor}`}>
          {description.category}
        </div>

        {/* Test 3D Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTest3D();
          }}
          className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/40 text-purple-400 transition-all flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Test 3D
        </button>
      </div>

      {/* Info Section */}
      <div className="p-4 border-t border-white/5">
        <h3 className="text-white font-semibold text-sm mb-1">{description.name}</h3>
        <p className="text-gray-400 text-xs mb-3">{description.description}</p>
        
        {/* Config Values */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Scale:</span>
            <span className="text-cyan-400">{config.scale}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Rotation:</span>
            <span className="text-cyan-400">{config.rotationFix}°</span>
          </div>
          {config.offsetX !== undefined && config.offsetX !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Offset X:</span>
              <span className="text-orange-400">{config.offsetX}</span>
            </div>
          )}
          {config.offsetY !== undefined && config.offsetY !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Offset Y:</span>
              <span className="text-orange-400">{config.offsetY}</span>
            </div>
          )}
          {config.offsetZ !== undefined && config.offsetZ !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Offset Z:</span>
              <span className="text-orange-400">{config.offsetZ}</span>
            </div>
          )}
        </div>

        {/* Mapped Types */}
        {mappedTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mappedTypes.slice(0, 4).map(type => (
              <span key={type} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                {type}
              </span>
            ))}
            {mappedTypes.length > 4 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-500/15 text-gray-400">
                +{mappedTypes.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Page Component
export function AircraftModelsPage() {
  const [selectedModel, setSelectedModel] = useState<string>('A320');
  const [test3DModel, setTest3DModel] = useState<string | null>(null);
  const modelKeys = Object.keys(MODEL_CONFIG);

  const selectedConfig = MODEL_CONFIG[selectedModel];
  const selectedDesc = MODEL_DESCRIPTIONS[selectedModel] || { 
    name: selectedModel, 
    category: 'Unknown', 
    description: 'No description available',
    icaoType: selectedModel 
  };

  // Find which aircraft types use selected model
  const mappedTypes = Object.entries(AIRCRAFT_TYPE_TO_MODEL)
    .filter(([_, model]) => model === selectedModel)
    .map(([type]) => type);

  const mappedCategories = Object.entries(CATEGORY_TO_MODEL)
    .filter(([_, model]) => model === selectedModel)
    .map(([cat]) => cat);

  // Memoize demo track to prevent infinite re-renders
  const demoTrack = useMemo(() => {
    if (!test3DModel) return null;
    return generateDemoTrack(test3DModel);
  }, [test3DModel]);

  // Memoize onClose callback to prevent re-renders
  const handleClose3D = useCallback(() => {
    setTest3DModel(null);
  }, []);

  // Memoize test model description
  const testDesc = useMemo(() => {
    if (!test3DModel) return null;
    return MODEL_DESCRIPTIONS[test3DModel] || { icaoType: test3DModel, name: test3DModel };
  }, [test3DModel]);

  // Memoize callsign
  const testCallsign = useMemo(() => {
    if (!test3DModel) return '';
    return `TEST-${test3DModel.toUpperCase()}`;
  }, [test3DModel]);

  // 3D Test View
  if (test3DModel && demoTrack && testDesc) {
    return (
      <Flight3DMapReplay
        flightId={`demo-${test3DModel}`}
        onClose={handleClose3D}
        trackPoints={demoTrack}
        aircraftType={testDesc.icaoType}
        callsign={testCallsign}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 border-b border-white/5"
        style={{
          background: 'linear-gradient(180deg, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.8) 100%)',
          backdropFilter: 'blur(20px)',
        }}>
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Aircraft 3D Models
              </h1>
              <p className="text-gray-500 text-sm">View and test 3D aircraft models</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Models</div>
              <div className="text-lg font-mono text-cyan-400">{modelKeys.length}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Type Mappings</div>
              <div className="text-lg font-mono text-emerald-400">{Object.keys(AIRCRAFT_TYPE_TO_MODEL).length}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Model Grid */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Available Models</h2>
              <span className="text-xs text-gray-600">Click to select • "Test 3D" to preview</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {modelKeys.map(key => (
                <ModelCard
                  key={key}
                  modelKey={key}
                  config={MODEL_CONFIG[key]}
                  isSelected={selectedModel === key}
                  onClick={() => setSelectedModel(key)}
                  onTest3D={() => setTest3DModel(key)}
                />
              ))}
            </div>
          </div>

          {/* Selected Model Details */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider">Selected Model</h2>
                <button
                  onClick={() => setTest3DModel(selectedModel)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/40 text-purple-400 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test in 3D View
                </button>
              </div>

              {/* Model Info Card */}
              <div className="rounded-xl p-5"
                style={{
                  background: 'linear-gradient(145deg, rgba(14,19,32,0.7) 0%, rgba(5,5,10,0.9) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedDesc.name}</h3>
                    <p className="text-gray-400 text-sm">{selectedDesc.description}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-mono border ${CATEGORY_COLORS[selectedDesc.category] || 'bg-gray-500/20 text-gray-400 border-gray-500/40'}`}>
                    {selectedDesc.category}
                  </div>
                </div>

                {/* Configuration */}
                <div className="mb-4">
                  <h4 className="text-cyan-400 font-mono text-xs mb-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    CONFIGURATION
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <ConfigValue label="Model Key" value={selectedModel} />
                    <ConfigValue label="Path" value={selectedConfig.path} />
                    <ConfigValue label="Scale" value={selectedConfig.scale.toString()} highlight />
                    <ConfigValue label="Rotation" value={`${selectedConfig.rotationFix}°`} highlight />
                    <ConfigValue label="Offset X" value={selectedConfig.offsetX?.toString() || '0'} />
                    <ConfigValue label="Offset Y" value={selectedConfig.offsetY?.toString() || '0'} />
                    <ConfigValue label="Offset Z" value={selectedConfig.offsetZ?.toString() || '0'} />
                  </div>
                </div>

                {/* Type Mappings */}
                <div className="mb-4">
                  <h4 className="text-emerald-400 font-mono text-xs mb-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    ICAO TYPE MAPPINGS
                  </h4>
                  {mappedTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {mappedTypes.map(type => (
                        <span key={type} className="px-2 py-1 rounded text-xs font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs">No direct type mappings</p>
                  )}
                </div>

                {/* Category Fallbacks */}
                {mappedCategories.length > 0 && (
                  <div>
                    <h4 className="text-amber-400 font-mono text-xs mb-2">CATEGORY FALLBACKS</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {mappedCategories.map(cat => (
                        <span key={cat} className="px-2 py-1 rounded text-xs font-mono bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* File Location Reference */}
              <div className="mt-4 p-4 rounded-xl"
                style={{
                  background: 'linear-gradient(145deg, rgba(14,19,32,0.5) 0%, rgba(5,5,10,0.7) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                <h4 className="text-amber-400 font-mono text-xs mb-2 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  EDIT CONFIGURATION
                </h4>
                <code className="block p-2 rounded bg-black/50 text-cyan-400 font-mono text-xs border border-white/5 break-all">
                  Flight3DMapReplay.tsx
                </code>
                <p className="text-gray-500 text-[10px] mt-2">
                  Edit <span className="text-cyan-400">MODEL_CONFIG</span> and <span className="text-cyan-400">AIRCRAFT_TYPE_TO_MODEL</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Mapping Table */}
        <div className="mt-8 p-6 rounded-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(14,19,32,0.7) 0%, rgba(5,5,10,0.9) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Complete Aircraft Type → Model Mapping
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-gray-400 font-mono text-xs">ICAO Type</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-mono text-xs">Model Key</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-mono text-xs">Model Name</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-mono text-xs">Scale</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-mono text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(AIRCRAFT_TYPE_TO_MODEL).map(([type, modelKey]) => {
                  const config = MODEL_CONFIG[modelKey];
                  const desc = MODEL_DESCRIPTIONS[modelKey];
                  return (
                    <tr 
                      key={type} 
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedModel(modelKey)}
                    >
                      <td className="py-2 px-3 font-mono text-cyan-400">{type}</td>
                      <td className="py-2 px-3 font-mono text-gray-300">{modelKey}</td>
                      <td className="py-2 px-3 text-gray-400">{desc?.name || modelKey}</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">{config?.scale || '-'}</td>
                      <td className="py-2 px-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTest3DModel(modelKey);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 text-purple-400 transition-all"
                        >
                          Test 3D
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConfigValue({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-2 rounded bg-black/30 border border-white/5">
      <div className="text-gray-500 text-[10px] mb-0.5">{label}</div>
      <div className={`font-mono text-xs truncate ${highlight ? 'text-cyan-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
