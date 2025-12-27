import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Stars, Float } from '@react-three/drei';
import * as THREE from 'three';
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw, Box } from 'lucide-react';
import clsx from 'clsx';

interface TrackPoint {
  lat: number;
  lon: number;
  alt: number;
  timestamp: number;
  gspeed?: number;
  track?: number;
}

// Generate realistic demo flight data (simulating a flight from Tel Aviv to a holding pattern and landing)
function generateDemoFlightData(): TrackPoint[] {
  const points: TrackPoint[] = [];
  const startTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  
  // Starting point near Ben Gurion Airport
  const startLat = 32.0055;
  const startLon = 34.8854;
  
  // Simulate a flight with takeoff, cruise, descent, holding pattern, and landing
  const phases = [
    // Takeoff and climb
    { duration: 120, altStart: 0, altEnd: 15000, latDelta: 0.1, lonDelta: 0.05, speedStart: 50, speedEnd: 280 },
    // Cruise
    { duration: 300, altStart: 15000, altEnd: 35000, latDelta: 0.5, lonDelta: 0.3, speedStart: 280, speedEnd: 450 },
    // Cruise continue
    { duration: 600, altStart: 35000, altEnd: 35000, latDelta: 1.2, lonDelta: 0.8, speedStart: 450, speedEnd: 450 },
    // Start descent
    { duration: 300, altStart: 35000, altEnd: 18000, latDelta: 0.4, lonDelta: 0.2, speedStart: 450, speedEnd: 320 },
    // Holding pattern (circular)
    { duration: 400, altStart: 18000, altEnd: 12000, latDelta: 0, lonDelta: 0, speedStart: 250, speedEnd: 220, isHolding: true },
    // Final approach
    { duration: 200, altStart: 12000, altEnd: 3000, latDelta: -0.2, lonDelta: -0.1, speedStart: 220, speedEnd: 160 },
    // Landing
    { duration: 100, altStart: 3000, altEnd: 0, latDelta: -0.1, lonDelta: -0.05, speedStart: 160, speedEnd: 30 },
  ];
  
  let currentTime = startTime;
  let currentLat = startLat;
  let currentLon = startLon;
  let _currentHeading = 45; // Northeast initially
  
  for (const phase of phases) {
    const steps = Math.floor(phase.duration / 5); // Point every 5 seconds
    
    if ((phase as any).isHolding) {
      // Create holding pattern (figure-8 or racetrack)
      const holdCenterLat = currentLat;
      const holdCenterLon = currentLon;
      const holdRadius = 0.05; // About 5km radius
      
      for (let i = 0; i < steps; i++) {
        const progress = i / steps;
        const angle = progress * Math.PI * 4; // Two full circles
        
        const holdLat = holdCenterLat + Math.sin(angle) * holdRadius;
        const holdLon = holdCenterLon + Math.cos(angle) * holdRadius * 1.5; // Elongated
        const alt = phase.altStart + (phase.altEnd - phase.altStart) * progress;
        const speed = phase.speedStart + (phase.speedEnd - phase.speedStart) * progress;
        const heading = (Math.atan2(
          Math.cos(angle + 0.1) * holdRadius * 1.5 - Math.cos(angle) * holdRadius * 1.5,
          Math.sin(angle + 0.1) * holdRadius - Math.sin(angle) * holdRadius
        ) * 180 / Math.PI + 360) % 360;
        
        points.push({
          lat: holdLat,
          lon: holdLon,
          alt,
          timestamp: currentTime,
          gspeed: Math.round(speed),
          track: Math.round(heading),
        });
        
        currentTime += 5;
      }
      
      currentLat = holdCenterLat;
      currentLon = holdCenterLon;
    } else {
      for (let i = 0; i < steps; i++) {
        const progress = i / steps;
        const lat = currentLat + phase.latDelta * progress;
        const lon = currentLon + phase.lonDelta * progress;
        const alt = phase.altStart + (phase.altEnd - phase.altStart) * progress;
        const speed = phase.speedStart + (phase.speedEnd - phase.speedStart) * progress;
        
        // Calculate heading based on direction
        const nextLat = currentLat + phase.latDelta * ((i + 1) / steps);
        const nextLon = currentLon + phase.lonDelta * ((i + 1) / steps);
        const heading = (Math.atan2(nextLon - lon, nextLat - lat) * 180 / Math.PI + 90 + 360) % 360;
        
        points.push({
          lat,
          lon,
          alt,
          timestamp: currentTime,
          gspeed: Math.round(speed),
          track: Math.round(heading),
        });
        
        currentTime += 5;
      }
      
      currentLat += phase.latDelta;
      currentLon += phase.lonDelta;
      currentHeading = (Math.atan2(phase.lonDelta, phase.latDelta) * 180 / Math.PI + 90 + 360) % 360;
    }
  }
  
  return points;
}

// Convert lat/lon/alt to 3D coordinates
function latLonAltTo3D(lat: number, lon: number, alt: number, center: { lat: number; lon: number }): [number, number, number] {
  const scale = 111.32;
  const x = (lon - center.lon) * scale * Math.cos(center.lat * Math.PI / 180);
  const z = -(lat - center.lat) * scale;
  const y = (alt * 0.3048) / 1000 * 2;
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
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh geometry={tubeGeometry} scale={[1.5, 1.5, 1.5]}>
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.3} />
      </mesh>
      <mesh geometry={tubeGeometry} scale={[2.5, 2.5, 2.5]}>
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.1} />
      </mesh>
    </group>
  );
}

// Ghost path
function GhostPath({ points, color }: { points: [number, number, number][]; color: string }) {
  if (points.length < 2) return null;
  return (
    <Line points={points} color={color} lineWidth={1} opacity={0.15} transparent dashed dashSize={0.5} dashScale={2} />
  );
}

// Aircraft marker with glow
function AircraftMarker({ position, color, heading = 0, isActive = true }: { position: [number, number, number]; color: string; heading?: number; isActive?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && isActive) {
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
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <mesh scale={[3, 3, 3]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <mesh position={[Math.sin(heading * Math.PI / 180) * 0.8, 0, -Math.cos(heading * Math.PI / 180) * 0.8]}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Ground grid
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

// Location marker
function LocationMarker({ position, label, color }: { position: [number, number, number]; label: string; color: string }) {
  return (
    <group position={position}>
      <Line points={[[0, 0, 0], [0, -position[1], 0]]} color={color} lineWidth={1} opacity={0.3} transparent dashed />
      <mesh position={[0, -position[1], 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <Float speed={2} floatIntensity={0.3}>
        <Text position={[0, 1.5, 0]} fontSize={0.8} color={color} anchorX="center" anchorY="bottom" font={undefined}>
          {label}
        </Text>
      </Float>
    </group>
  );
}

// Camera controller
function CameraController({ target, autoFollow, enabled }: { target: [number, number, number] | null; autoFollow: boolean; enabled: boolean }) {
  useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (autoFollow && target && controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
    }
  }, [target, autoFollow]);

  return (
    <OrbitControls ref={controlsRef} enabled={enabled} enableDamping dampingFactor={0.05} minDistance={5} maxDistance={500} maxPolarAngle={Math.PI / 2 - 0.1} />
  );
}

// Main 3D Scene
function Scene({ points, currentTime, minTime, maxTime }: { points: TrackPoint[]; currentTime: number; minTime: number; maxTime: number }) {
  const autoFollow = true;
  
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
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 50, 300]} />
      <Stars radius={300} depth={100} count={3000} factor={4} saturation={0} fade speed={0.5} />
      <ambientLight intensity={0.3} />
      <pointLight position={[50, 100, 50]} intensity={0.5} color="#0ea5e9" />
      <GroundGrid size={300} color="#0ea5e9" />
      <GhostPath points={allPoints3D.map(p => p.pos as [number, number, number])} color={mainColor} />
      {activePoints.length > 1 && (
        <GlowingPath points={activePoints.map(p => p.pos as [number, number, number])} color={mainColor} />
      )}
      {allPoints3D.length > 0 && (
        <LocationMarker position={allPoints3D[0].pos as [number, number, number]} label="TAKEOFF" color="#22c55e" />
      )}
      {progress >= 0.99 && allPoints3D.length > 0 && (
        <LocationMarker position={allPoints3D[allPoints3D.length - 1].pos as [number, number, number]} label="LANDING" color="#ef4444" />
      )}
      {currentPosition && (
        <AircraftMarker position={currentPosition.pos} color={mainColor} heading={currentPosition.heading} isActive={true} />
      )}
      <CameraController target={currentPosition?.pos || null} autoFollow={autoFollow} enabled={true} />
    </>
  );
}

// Telemetry HUD
function TelemetryHUD({ points, currentTime }: { points: TrackPoint[]; currentTime: number }) {
  const currentPoint = useMemo(() => {
    const active = points.filter(p => p.timestamp <= currentTime);
    return active.length > 0 ? active[active.length - 1] : null;
  }, [points, currentTime]);

  if (!currentPoint) return null;

  return (
    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-4 text-xs font-mono z-10">
      <div className="text-cyan-400 font-bold mb-3 text-sm flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        DEMO-FL001
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

// Main Demo Component
export function Flight3DDemo({ onClose }: { onClose: () => void }) {
  const [points] = useState<TrackPoint[]>(() => generateDemoFlightData());
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(20);
  
  const minTime = useMemo(() => points[0]?.timestamp || 0, [points]);
  const maxTime = useMemo(() => points[points.length - 1]?.timestamp || 0, [points]);
  
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef(0);

  useEffect(() => {
    if (points.length > 0) {
      setCurrentTime(minTime);
    }
  }, [points, minTime]);

  useEffect(() => {
    if (!isPlaying) {
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
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, speed, maxTime]);

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString();

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <Canvas camera={{ position: [30, 40, 50], fov: 60, near: 0.1, far: 1000 }} gl={{ antialias: true, alpha: false }}>
        <Scene points={points} currentTime={currentTime} minTime={minTime} maxTime={maxTime} />
      </Canvas>

      <TelemetryHUD points={points} currentTime={currentTime} />

      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
          <Box className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-mono text-sm">3D FLIGHT DEMO</span>
        </div>
        <button onClick={onClose} className="bg-red-600/80 hover:bg-red-500 text-white p-2.5 rounded-full transition-all shadow-lg border border-red-500/50">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-6 z-10">
        <div className="flex items-center gap-4 mb-4 max-w-4xl mx-auto">
          <span className="text-xs font-mono text-cyan-400 min-w-[80px] text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative">
            <input
              type="range" min={minTime} max={maxTime} step={1} value={currentTime}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
                [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.8)] [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="absolute top-0 left-0 h-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 pointer-events-none"
              style={{ width: `${((currentTime - minTime) / (maxTime - minTime)) * 100}%` }} />
          </div>
          <span className="text-xs font-mono text-white/50 min-w-[80px]">{formatTime(maxTime)}</span>
        </div>

        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {[1, 5, 10, 20, 60].map(s => (
              <button key={s} onClick={() => setSpeed(s)}
                className={clsx("px-3 py-1.5 text-xs font-bold rounded transition-all",
                  speed === s ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "text-white/40 hover:text-white hover:bg-white/5")}>
                {s}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => { setCurrentTime(minTime); setIsPlaying(false); }} className="text-white/60 hover:text-cyan-400 transition-colors p-2">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentTime(minTime)} className="text-white/60 hover:text-cyan-400 transition-colors p-2">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={() => setIsPlaying(!isPlaying)}
              className="bg-cyan-500 hover:bg-cyan-400 text-white p-4 rounded-full transition-all shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] active:scale-95">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 pl-0.5" />}
            </button>
            <button onClick={() => setCurrentTime(maxTime)} className="text-white/60 hover:text-cyan-400 transition-colors p-2">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 min-w-[150px] justify-end">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="text-cyan-400 font-mono text-sm">DEMO-FL001</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-32 left-4 text-white/40 text-xs space-y-1 z-10">
        <div>🖱️ Drag to rotate • Scroll to zoom</div>
        <div>✨ Demo flight with holding pattern</div>
      </div>
    </div>
  );
}

