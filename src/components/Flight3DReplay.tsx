import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw, Box, AlertTriangle, MapPin } from 'lucide-react';
import { fetchFeedbackTrack, fetchUnifiedTrack } from '../api';
import type { TrackPoint } from '../types';
import clsx from 'clsx';

export interface ReplayEvent {
  timestamp: number;
  description: string;
  type: 'proximity' | 'deviation' | 'ml_anomaly' | 'holding' | 'go_around' | 'other';
  lat?: number;
  lon?: number;
}

interface Flight3DReplayProps {
  flightId: string;
  events?: ReplayEvent[];
  onClose: () => void;
}

interface FlightData {
  id: string;
  points: TrackPoint[];
}

// Convert lat/lon/alt to 3D coordinates
// Scale: 1 unit = ~1km, altitude scaled for visibility
function latLonAltTo3D(lat: number, lon: number, alt: number, center: { lat: number; lon: number }): [number, number, number] {
  const scale = 111.32; // km per degree at equator (roughly)
  const x = (lon - center.lon) * scale * Math.cos(center.lat * Math.PI / 180);
  const z = -(lat - center.lat) * scale;
  const y = (alt * 0.3048) / 1000 * 2; // Convert ft to km, then scale up for visibility
  return [x, y, z];
}

// Glowing flight path tube
function GlowingPath({ points, color, opacity = 1 }: { points: [number, number, number][]; color: string; opacity?: number }) {
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors);
  }, [points]);

  if (!curve) return null;

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, points.length * 2, 0.15, 8, false);
  }, [curve, points.length]);

  return (
    <group>
      {/* Inner bright core */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Outer glow layer */}
      <mesh geometry={tubeGeometry} scale={[1.5, 1.5, 1.5]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.3}
        />
      </mesh>
      {/* Extra outer glow */}
      <mesh geometry={tubeGeometry} scale={[2.5, 2.5, 2.5]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.1}
        />
      </mesh>
    </group>
  );
}

// Ghost path (full path, dimmed)
function GhostPath({ points, color }: { points: [number, number, number][]; color: string }) {
  if (points.length < 2) return null;
  
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      opacity={0.15}
      transparent
      dashed
      dashSize={0.5}
      dashScale={2}
    />
  );
}

// Aircraft marker with glow effect
function AircraftMarker({ 
  position, 
  color, 
  heading = 0,
  isActive = true 
}: { 
  position: [number, number, number]; 
  color: string; 
  heading?: number;
  isActive?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && isActive) {
      // Subtle pulse effect
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current && isActive) {
      const scale = 2 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      {/* Core sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Inner glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {/* Outer glow */}
      <mesh scale={[3, 3, 3]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      {/* Heading indicator */}
      <mesh 
        position={[Math.sin(heading * Math.PI / 180) * 0.8, 0, -Math.cos(heading * Math.PI / 180) * 0.8]}
      >
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Ground grid with glow
function GroundGrid({ size = 200, color = '#0ea5e9' }: { size?: number; color?: string }) {
  return (
    <group position={[0, -0.1, 0]}>
      <gridHelper args={[size, 40, color, color]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// Start/End markers
function LocationMarker({ 
  position, 
  label, 
  color 
}: { 
  position: [number, number, number]; 
  label: string; 
  color: string;
}) {
  return (
    <group position={position}>
      {/* Vertical line to ground */}
      <Line
        points={[[0, 0, 0], [0, -position[1], 0]]}
        color={color}
        lineWidth={1}
        opacity={0.3}
        transparent
        dashed
      />
      {/* Ground marker */}
      <mesh position={[0, -position[1], 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* Floating label */}
      <Float speed={2} floatIntensity={0.3}>
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.8}
          color={color}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
        >
          {label}
        </Text>
      </Float>
    </group>
  );
}

// Altitude labels along the path
function AltitudeLabels({ points, interval = 20 }: { points: { pos: [number, number, number]; alt: number }[]; interval?: number }) {
  const labels = useMemo(() => {
    return points.filter((_, i) => i % interval === 0).slice(0, 10);
  }, [points, interval]);

  return (
    <>
      {labels.map((p, i) => (
        <Text
          key={i}
          position={[p.pos[0], p.pos[1] + 1, p.pos[2]]}
          fontSize={0.4}
          color="#94a3b8"
          anchorX="center"
          anchorY="bottom"
          font={undefined}
        >
          {Math.round(p.alt)}ft
        </Text>
      ))}
    </>
  );
}

// Camera auto-follow
function CameraController({ 
  target, 
  autoFollow,
  enabled 
}: { 
  target: [number, number, number] | null;
  autoFollow: boolean;
  enabled: boolean;
}) {
  useThree(); // Required for R3F context
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (autoFollow && target && controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
    }
  }, [target, autoFollow]);

  return (
    <OrbitControls 
      ref={controlsRef}
      enabled={enabled}
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={500}
      maxPolarAngle={Math.PI / 2 - 0.1}
    />
  );
}

// Main 3D Scene
function Scene({ 
  flight, 
  currentTime, 
  minTime, 
  maxTime 
}: { 
  flight: FlightData; 
  currentTime: number;
  minTime: number;
  maxTime: number;
}) {
  const autoFollow = true; // Always follow the aircraft
  
  // Calculate center point for coordinate transformation
  const center = useMemo(() => {
    if (flight.points.length === 0) return { lat: 0, lon: 0 };
    const lats = flight.points.map(p => p.lat);
    const lons = flight.points.map(p => p.lon);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    };
  }, [flight.points]);

  // Convert all points to 3D coordinates
  const allPoints3D = useMemo(() => {
    return flight.points.map(p => ({
      pos: latLonAltTo3D(p.lat, p.lon, p.alt, center),
      alt: p.alt,
      timestamp: p.timestamp,
      track: p.track || 0,
    }));
  }, [flight.points, center]);

  // Get active points up to current time
  const activePoints = useMemo(() => {
    return allPoints3D.filter(p => p.timestamp <= currentTime);
  }, [allPoints3D, currentTime]);

  // Current aircraft position
  const currentPosition = useMemo(() => {
    if (activePoints.length === 0) return null;
    const last = activePoints[activePoints.length - 1];
    return {
      pos: last.pos as [number, number, number],
      heading: last.track,
    };
  }, [activePoints]);

  // Progress percentage for color
  const progress = (currentTime - minTime) / (maxTime - minTime);
  const mainColor = '#06b6d4'; // Cyan

  return (
    <>
      {/* Dark starry background */}
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 50, 300]} />
      <Stars radius={300} depth={100} count={3000} factor={4} saturation={0} fade speed={0.5} />
      
      {/* Ambient lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[50, 100, 50]} intensity={0.5} color="#0ea5e9" />
      
      {/* Ground */}
      <GroundGrid size={300} color="#0ea5e9" />
      
      {/* Full path (ghost) */}
      <GhostPath 
        points={allPoints3D.map(p => p.pos as [number, number, number])} 
        color={mainColor} 
      />
      
      {/* Active path (glowing) */}
      {activePoints.length > 1 && (
        <GlowingPath 
          points={activePoints.map(p => p.pos as [number, number, number])} 
          color={mainColor}
        />
      )}
      
      {/* Start marker */}
      {allPoints3D.length > 0 && (
        <LocationMarker 
          position={allPoints3D[0].pos as [number, number, number]} 
          label="START" 
          color="#22c55e" 
        />
      )}
      
      {/* End marker (if reached) */}
      {progress >= 0.99 && allPoints3D.length > 0 && (
        <LocationMarker 
          position={allPoints3D[allPoints3D.length - 1].pos as [number, number, number]} 
          label="END" 
          color="#ef4444" 
        />
      )}
      
      {/* Current aircraft position */}
      {currentPosition && (
        <AircraftMarker 
          position={currentPosition.pos}
          color={mainColor}
          heading={currentPosition.heading}
          isActive={true}
        />
      )}
      
      {/* Altitude labels */}
      <AltitudeLabels points={allPoints3D} interval={Math.max(1, Math.floor(allPoints3D.length / 8))} />
      
      {/* Camera controls */}
      <CameraController 
        target={currentPosition?.pos || null}
        autoFollow={autoFollow}
        enabled={true}
      />
    </>
  );
}

// Telemetry HUD overlay
function TelemetryHUD({ flight, currentTime }: { flight: FlightData; currentTime: number }) {
  const currentPoint = useMemo(() => {
    const active = flight.points.filter(p => p.timestamp <= currentTime);
    return active.length > 0 ? active[active.length - 1] : null;
  }, [flight.points, currentTime]);

  if (!currentPoint) return null;

  return (
    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 text-xs font-mono z-10">
      <div className="text-cyan-400 font-bold mb-3 text-sm flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        {flight.id}
      </div>
      <div className="space-y-2 text-white/80">
        <div className="flex justify-between gap-8">
          <span className="text-white/50">ALT</span>
          <span className="text-cyan-300">{Math.round(currentPoint.alt).toLocaleString()} ft</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-white/50">HDG</span>
          <span className="text-cyan-300">{Math.round(currentPoint.track || 0)}°</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-white/50">SPD</span>
          <span className="text-cyan-300">{Math.round(currentPoint.gspeed || 0)} kts</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-white/50">LAT</span>
          <span className="text-cyan-300">{currentPoint.lat.toFixed(4)}°</span>
        </div>
        <div className="flex justify-between gap-8">
          <span className="text-white/50">LON</span>
          <span className="text-cyan-300">{currentPoint.lon.toFixed(4)}°</span>
        </div>
      </div>
    </div>
  );
}

// Main component
export function Flight3DReplay({ flightId, events = [], onClose }: Flight3DReplayProps) {
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(10);
  const [minTime, setMinTime] = useState(0);
  const [maxTime, setMaxTime] = useState(0);
  
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef(0);

  // Filter to only show proximity events
  const proximityEvents = useMemo(() => 
    events.filter(e => e.type === 'proximity'),
    [events]
  );

  // Handle event click - jump to timestamp
  const handleEventClick = (event: ReplayEvent) => {
    setCurrentTime(event.timestamp);
    setIsPlaying(false);
  };

  // Fetch flight data
  useEffect(() => {
    const loadFlight = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try feedback track first, then unified track
        let track;
        try {
          track = await fetchFeedbackTrack(flightId);
        } catch {
          track = await fetchUnifiedTrack(flightId);
        }
        
        const sortedPoints = track.points.sort((a, b) => a.timestamp - b.timestamp);
        setFlight({
          id: flightId,
          points: sortedPoints,
        });
        
        if (sortedPoints.length > 0) {
          const min = sortedPoints[0].timestamp;
          const max = sortedPoints[sortedPoints.length - 1].timestamp;
          setMinTime(min);
          setMaxTime(max);
          setCurrentTime(min);
        }
      } catch (err) {
        setError('Failed to load flight data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadFlight();
  }, [flightId]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      lastFrameTime.current = 0;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastFrameTime.current === 0) {
        lastFrameTime.current = time;
      }

      const delta = (time - lastFrameTime.current) / 1000;
      lastFrameTime.current = time;

      setCurrentTime(prev => {
        const next = prev + (delta * speed);
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, speed, maxTime]);

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString();
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const handleReset = () => {
    setCurrentTime(minTime);
    setIsPlaying(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <div className="text-cyan-400 font-mono text-sm animate-pulse">LOADING 3D VIEW...</div>
        </div>
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || 'No flight data'}</div>
          <button onClick={onClose} className="text-cyan-400 hover:text-cyan-300">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex">
      {/* Event Log Sidebar - Only show if there are proximity events */}
      {proximityEvents.length > 0 && (
        <div className="w-64 bg-black/90 backdrop-blur-md border-r border-cyan-500/20 flex flex-col z-20 shrink-0">
          <div className="p-4 border-b border-cyan-500/20 bg-cyan-500/5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Proximity Events
              <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                {proximityEvents.length}
              </span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
            {proximityEvents.map((ev, i) => (
              <button 
                key={i}
                onClick={() => handleEventClick(ev)}
                className={clsx(
                  "w-full text-left p-3 rounded-lg transition-all group border",
                  Math.abs(currentTime - ev.timestamp) < 30
                    ? "bg-red-500/20 border-red-500/40"
                    : "bg-black/40 border-white/5 hover:bg-white/5 hover:border-cyan-500/30"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                    PROXIMITY
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    {formatTime(ev.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-white/80 line-clamp-2 mb-2">{ev.description}</p>
                <div className="flex items-center gap-1 text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MapPin className="w-3 h-3" />
                  Jump to event
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main 3D View Area */}
      <div className="flex-1 relative">
        {/* 3D Canvas */}
        <Canvas
          camera={{ position: [30, 40, 50], fov: 60, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: false }}
        >
          <Scene 
            flight={flight} 
            currentTime={currentTime}
            minTime={minTime}
            maxTime={maxTime}
          />
        </Canvas>

        {/* Telemetry HUD */}
        <TelemetryHUD flight={flight} currentTime={currentTime} />

        {/* Header with close button */}
        <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 font-mono text-sm">3D FLIGHT REPLAY</span>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600/80 hover:bg-red-500 text-white p-2.5 rounded-full transition-all shadow-lg border border-red-500/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-6 z-10">
        {/* Time Slider */}
        <div className="flex items-center gap-4 mb-4 max-w-4xl mx-auto">
          <span className="text-xs font-mono text-cyan-400 min-w-[80px] text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative">
            <input
              type="range"
              min={minTime}
              max={maxTime}
              step={1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.8)]
                [&::-webkit-slider-thumb]:cursor-pointer"
            />
            {/* Progress glow */}
            <div 
              className="absolute top-0 left-0 h-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 pointer-events-none"
              style={{ width: `${((currentTime - minTime) / (maxTime - minTime)) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-white/50 min-w-[80px]">
            {formatTime(maxTime)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* Speed controls */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {[1, 5, 10, 20, 60].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-bold rounded transition-all",
                  speed === s 
                    ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="text-white/60 hover:text-cyan-400 transition-colors p-2"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentTime(minTime)}
              className="text-white/60 hover:text-cyan-400 transition-colors p-2"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-cyan-500 hover:bg-cyan-400 text-white p-4 rounded-full transition-all 
                shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)]
                active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 pl-0.5" />}
            </button>
            <button
              onClick={() => setCurrentTime(maxTime)}
              className="text-white/60 hover:text-cyan-400 transition-colors p-2"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Flight info */}
          <div className="flex items-center gap-3 min-w-[150px] justify-end">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <span className="text-cyan-400 font-mono text-sm">{flight.id}</span>
            </div>
          </div>
        </div>
      </div>

        {/* Instructions overlay */}
        <div className="absolute bottom-32 left-4 text-white/40 text-xs space-y-1 z-10">
          <div>🖱️ Drag to rotate • Scroll to zoom</div>
          <div>⌨️ Press Space to play/pause</div>
        </div>
      </div>
    </div>
  );
}

