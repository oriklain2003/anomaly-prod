import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Maximize2, Play, Pause } from 'lucide-react';
import type { TrackPoint, SelectedFlight } from '../types';
import clsx from 'clsx';

interface Flight3DEmbedProps {
  flight?: SelectedFlight;
  onExpand?: () => void;
  demoMode?: boolean;
}

// Generate demo flight data
function generateDemoPoints(): TrackPoint[] {
  const points: TrackPoint[] = [];
  const startTime = Math.floor(Date.now() / 1000) - 3600;
  const startLat = 32.0055;
  const startLon = 34.8854;

  // Takeoff phase
  for (let i = 0; i < 20; i++) {
    const t = i / 20;
    const alt = Math.min(t * 8000, 8000);
    points.push({
      lat: startLat + t * 0.08,
      lon: startLon + t * 0.05,
      alt,
      timestamp: startTime + i * 30,
      gspeed: 150 + t * 180,
      track: 45
    });
  }

  // Cruise with turns
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI;
    const radius = 0.15;
    points.push({
      lat: startLat + 0.08 + Math.sin(angle) * radius,
      lon: startLon + 0.05 + Math.cos(angle) * radius,
      alt: 25000 + Math.sin(i * 0.2) * 1000,
      timestamp: startTime + 600 + i * 20,
      gspeed: 420 + Math.random() * 30,
      track: 90 + (i * 4.5) % 360
    });
  }

  // Holding pattern
  const holdCenter = { lat: startLat + 0.08, lon: startLon + 0.05 + 0.15 };
  for (let i = 0; i < 25; i++) {
    const angle = (i / 12.5) * Math.PI * 2;
    points.push({
      lat: holdCenter.lat + Math.cos(angle) * 0.03,
      lon: holdCenter.lon + Math.sin(angle) * 0.04,
      alt: 15000 - (i * 200),
      timestamp: startTime + 1400 + i * 25,
      gspeed: 220,
      track: ((angle * 180 / Math.PI) + 90) % 360
    });
  }

  return points;
}

// Convert lat/lon/alt to 3D coordinates
function latLonAltTo3D(lat: number, lon: number, alt: number, center: { lat: number; lon: number }): [number, number, number] {
  const scale = 111.32;
  const x = (lon - center.lon) * scale * Math.cos(center.lat * Math.PI / 180);
  const z = -(lat - center.lat) * scale;
  const y = (alt * 0.3048) / 1000 * 1.5; // Convert ft to km, scale for visibility
  return [x, y, z];
}

// Glowing flight path
function GlowingPath({ points, color, opacity = 1 }: { points: [number, number, number][]; color: string; opacity?: number }) {
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    const vectors = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors);
  }, [points]);

  if (!curve) return null;

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, Math.min(points.length * 2, 200), 0.12, 8, false);
  }, [curve, points.length]);

  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh geometry={tubeGeometry} scale={[1.8, 1.8, 1.8]}>
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.25} />
      </mesh>
      <mesh geometry={tubeGeometry} scale={[3, 3, 3]}>
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.08} />
      </mesh>
    </group>
  );
}

// Ghost path (full route preview)
function GhostPath({ points, color }: { points: [number, number, number][]; color: string }) {
  if (points.length < 2) return null;
  return (
    <Line points={points} color={color} lineWidth={1} opacity={0.12} transparent dashed dashSize={0.3} dashScale={2} />
  );
}

// Aircraft marker
function AircraftMarker({ position, color, heading = 0 }: { position: [number, number, number]; color: string; heading?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const scale = 2 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} />
      </mesh>
      <mesh scale={[3.5, 3.5, 3.5]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      {/* Direction indicator */}
      <mesh position={[Math.sin(heading * Math.PI / 180) * 0.6, 0, -Math.cos(heading * Math.PI / 180) * 0.6]}>
        <coneGeometry args={[0.12, 0.3, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Ground with map-like grid
function Ground({ size = 150, color = '#06b6d4' }: { size?: number; color?: string }) {
  return (
    <group position={[0, -0.05, 0]}>
      <gridHelper args={[size, 30, color, color]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#0a0f1a" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

// Start marker
function StartMarker({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <Line points={[[0, 0, 0], [0, -position[1], 0]]} color={color} lineWidth={1} opacity={0.4} transparent dashed />
      <mesh position={[0, -position[1], 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.4, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.5} color={color} anchorX="center" anchorY="bottom" font={undefined}>
        START
      </Text>
    </group>
  );
}

// Camera controller
function CameraController({ target, autoFollow }: { target: [number, number, number] | null; autoFollow: boolean }) {
  useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (autoFollow && target && controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
    }
  }, [target, autoFollow]);

  return (
    <OrbitControls 
      ref={controlsRef} 
      enableDamping 
      dampingFactor={0.05} 
      minDistance={3} 
      maxDistance={200} 
      maxPolarAngle={Math.PI / 2 - 0.05}
      enablePan={true}
      rotateSpeed={0.5}
    />
  );
}

// Main 3D Scene
function Scene({ points, currentTime, minTime, maxTime }: { points: TrackPoint[]; currentTime: number; minTime: number; maxTime: number }) {
  const center = useMemo(() => {
    if (points.length === 0) return { lat: 0, lon: 0 };
    const lats = points.map(p => p.lat);
    const lons = points.map(p => p.lon);
    return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  }, [points]);

  const allPoints3D = useMemo(() => {
    return points.map(p => ({
      pos: latLonAltTo3D(p.lat, p.lon, p.alt, center),
      alt: p.alt,
      timestamp: p.timestamp,
      track: p.track || 0,
    }));
  }, [points, center]);

  const activePoints = useMemo(() => {
    return allPoints3D.filter(p => p.timestamp <= currentTime);
  }, [allPoints3D, currentTime]);

  const currentPosition = useMemo(() => {
    if (activePoints.length === 0) return null;
    const last = activePoints[activePoints.length - 1];
    return { pos: last.pos as [number, number, number], heading: last.track };
  }, [activePoints]);

  const progress = (currentTime - minTime) / (maxTime - minTime);
  const mainColor = '#06b6d4';

  return (
    <>
      <color attach="background" args={['#050a15']} />
      <fog attach="fog" args={['#050a15', 30, 180]} />
      <Stars radius={200} depth={80} count={1500} factor={3} saturation={0} fade speed={0.3} />
      <ambientLight intensity={0.25} />
      <pointLight position={[30, 60, 30]} intensity={0.4} color="#0ea5e9" />
      
      <Ground size={200} color="#0e7490" />
      
      <GhostPath points={allPoints3D.map(p => p.pos as [number, number, number])} color={mainColor} />
      
      {activePoints.length > 1 && (
        <GlowingPath points={activePoints.map(p => p.pos as [number, number, number])} color={mainColor} />
      )}
      
      {allPoints3D.length > 0 && (
        <StartMarker position={allPoints3D[0].pos as [number, number, number]} color="#22c55e" />
      )}
      
      {progress >= 0.98 && allPoints3D.length > 0 && (
        <StartMarker position={allPoints3D[allPoints3D.length - 1].pos as [number, number, number]} color="#ef4444" />
      )}
      
      {currentPosition && (
        <AircraftMarker position={currentPosition.pos} color={mainColor} heading={currentPosition.heading} />
      )}
      
      <CameraController target={currentPosition?.pos || null} autoFollow={true} />
    </>
  );
}

// Mini Telemetry Display
function MiniTelemetry({ point }: { point: TrackPoint | null }) {
  if (!point) return null;
  
  return (
    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm border border-cyan-500/20 rounded px-2 py-1.5 text-[10px] font-mono z-10">
      <div className="flex items-center gap-3 text-white/80">
        <span className="text-cyan-400">{Math.round(point.alt).toLocaleString()} ft</span>
        <span className="text-white/50">|</span>
        <span className="text-cyan-400">{Math.round(point.gspeed || 0)} kts</span>
        <span className="text-white/50">|</span>
        <span className="text-cyan-400">{Math.round(point.track || 0)}°</span>
      </div>
    </div>
  );
}

// Main Embedded Component
export function Flight3DEmbed({ flight, onExpand, demoMode = false }: Flight3DEmbedProps) {
  const demoPoints = useMemo(() => demoMode ? generateDemoPoints() : [], [demoMode]);
  const points = demoMode ? demoPoints : (flight?.track?.points || []);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed] = useState(15);
  
  const minTime = useMemo(() => points[0]?.timestamp || 0, [points]);
  const maxTime = useMemo(() => points[points.length - 1]?.timestamp || 0, [points]);
  
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef(0);

  // Current point for telemetry
  const currentPoint = useMemo(() => {
    const active = points.filter(p => p.timestamp <= currentTime);
    return active.length > 0 ? active[active.length - 1] : null;
  }, [points, currentTime]);

  useEffect(() => {
    if (points.length > 0) {
      setCurrentTime(minTime);
    }
  }, [points, minTime]);

  useEffect(() => {
    if (!isPlaying || points.length === 0) {
      lastFrameTime.current = 0;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastFrameTime.current === 0) lastFrameTime.current = time;
      const delta = (time - lastFrameTime.current) / 1000;
      lastFrameTime.current = time;

      setCurrentTime(prev => {
        const next = prev + (delta * speed);
        if (next >= maxTime) {
          // Loop back to start
          return minTime;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, speed, maxTime, minTime, points.length]);

  if (points.length === 0) {
    return (
      <div className="h-48 bg-black/40 rounded-lg border border-white/10 flex items-center justify-center">
        <div className="text-center text-gray-500 text-xs">
          <Box className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <span>No track data available</span>
        </div>
      </div>
    );
  }

  const progress = ((currentTime - minTime) / (maxTime - minTime)) * 100;
  const displayName = demoMode ? 'DEMO-01' : (flight?.callsign || flight?.flight_id?.slice(0, 8) || 'Unknown');

  return (
    <div className="relative h-52 bg-black/60 rounded-lg border border-cyan-500/20 overflow-hidden group">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [15, 20, 25], fov: 55, near: 0.1, far: 500 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: '#050a15' }}
      >
        <Scene points={points} currentTime={currentTime} minTime={minTime} maxTime={maxTime} />
      </Canvas>

      {/* Mini Telemetry */}
      <MiniTelemetry point={currentPoint} />

      {/* Header badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-cyan-500/20 rounded px-2 py-1 z-10">
        <Box className="w-3 h-3 text-cyan-400" />
        <span className="text-[9px] font-mono text-cyan-400 uppercase">3D View</span>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 z-10">
        {/* Progress bar */}
        <div className="h-1 bg-white/10 rounded-full mb-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Controls row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-cyan-400 transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          
          <span className="text-[9px] font-mono text-white/50">
            {displayName}
          </span>
          
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/70 hover:text-white transition-colors"
              title="Expand to full view"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Hover hint */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="text-[10px] text-white/40 bg-black/50 px-2 py-1 rounded">
          Drag to rotate • Scroll to zoom
        </span>
      </div>
    </div>
  );
}

