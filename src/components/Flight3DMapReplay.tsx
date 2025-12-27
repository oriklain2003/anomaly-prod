import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, Stars, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Play, Pause, SkipBack, SkipForward, RotateCcw, Target, Send, Mic, ChevronRight, MessageSquare, Video, Orbit } from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { fetchFeedbackTrack, fetchUnifiedTrack, fetchReplayOtherFlight } from '../api';
import type { TrackPoint, FlightTrack, HighlightState } from '../types';
import { WORLD_AIRPORTS } from '../data/airports';
import clsx from 'clsx';

// Haversine distance calculation (nautical miles)
function getDistanceNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find nearest airport to a position
function findNearestAirport(lat: number, lon: number): { code: string; name: string; distance: number } | null {
  let nearest: { code: string; name: string; distance: number } | null = null;
  
  for (const airport of WORLD_AIRPORTS) {
    const dist = getDistanceNM(lat, lon, airport.lat, airport.lon);
    if (!nearest || dist < nearest.distance) {
      nearest = { code: airport.code, name: airport.name, distance: dist };
    }
  }
  
  return nearest;
}

// MapTiler API key
const MAPTILER_KEY = 'r7kaQpfNDVZdaVp23F1r';

// Embedded chat props for displaying chat inside 3D view
interface EmbeddedChatProps {
  selectedFlight: any;
  onHighlight?: (highlight: HighlightState | null) => void;
  messages: any[];
  isLoading: boolean;
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  language: 'en' | 'he';
  t: any;
  isRTL: boolean;
}

interface Flight3DMapReplayProps {
  flightId: string;
  onClose: () => void;
  highlight?: HighlightState | null;
  onClearHighlight?: () => void; // Callback to clear AI highlight
  trackPoints?: TrackPoint[]; // Optional pre-loaded track points
  secondaryFlightIds?: string[]; // Other flights for proximity alerts
  aircraftType?: string; // Aircraft type code from parent
  category?: string; // Aircraft category from parent
  callsign?: string; // Flight callsign from parent
  embeddedChatProps?: EmbeddedChatProps; // Props for embedded chat panel
}

interface FlightData {
  id: string;
  points: TrackPoint[];
  color?: string; // Color for this flight's path
  isSecondary?: boolean; // Whether this is a secondary flight
  aircraftType?: string; // Aircraft type code (e.g., A320, B738)
  category?: string; // Aircraft category
  callsign?: string; // Flight callsign (e.g., ELY123)
}

// ============================================================
// 3D VIEW CONFIGURATION
// ============================================================

// Altitude exaggeration factor - makes vertical separation more visible
// 1 = real scale (altitude differences almost invisible)
// 3 = default (altitude differences somewhat visible)
// 10 = exaggerated (clear altitude separation between aircraft)
// 20+ = very exaggerated (dramatic altitude differences)
const ALTITUDE_SCALE = 7;

// Pitch exaggeration factor - makes climb/descent tilt more visible
// With the new formula: 1 = subtle, 5 = moderate, 10 = dramatic
// Maps vertical rate directly to pitch: 500 ft/min = PITCH_SCALE degrees
const PITCH_SCALE = 7;

// ============================================================
// AIRCRAFT MODEL CONFIGURATION
// Edit this config to adjust model sizes and rotations
// ============================================================
interface ModelConfig {
  path: string;           // Path to the .glb model file
  scale: number;          // Size multiplier (1.0 = default, larger = bigger)
  rotationFix: number;    // Rotation correction in degrees (0, 90, 180, 270)
  offsetX?: number;       // Position offset X (left/right)
  offsetY?: number;       // Position offset Y (up/down)
  offsetZ?: number;       // Position offset Z (forward/back)
}

// Configuration for each 3D model file
// Adjust 'scale' to change size, 'rotationFix' to fix model orientation
const MODEL_CONFIG: Record<string, ModelConfig> = {
  // === AIRBUS MODELS ===
  'A20N': {
    path: '/models/A20N.glb',
    scale: 0.01,          // A320neo size
    rotationFix: -90,
    offsetY: 5       // Adjust if model faces wrong direction
  },
  'A21N_wizz': {
    path: '/models/A21N_wizz.glb',
    scale: 0.02,           // A321neo (slightly larger)
    rotationFix: -90,
    offsetZ: 6.75,
    offsetX: 6
    
  },
  'A320': {
    path: '/models/A320.glb',
    scale: 0.01,          // Standard A320
    rotationFix: 0
  },
  'AT76': {
    path: '/models/AT76.glb',
    scale: 0.001,         // ATR turboprop - model is ~30x larger internally
    rotationFix: 90,
    offsetX: -3000.7,      // Compensate for model center offset
    offsetY: 0,
    offsetZ: -215.6,      // Model center is at Z=-3080, so add +3080 to bring to origin
  },
  
  
  // === BOEING MODELS ===
  'B38M': {
    path: '/models/B38M.glb',
    scale: 0.007,          // 737 MAX 8
    rotationFix: 0,
  },
  'B738': {
    path: '/models/B738.glb',
    scale: 0.02,          // 737-800
    rotationFix: 0,
  },
  'boeing_737': {
    path: '/models/boeing_737.glb',
    scale: 0.02,          // Generic 737
    rotationFix: 0,
  },
  
  // === MILITARY AIRCRAFT ===
  'M28': {
    path: '/models/M28.glb',
    scale: 0.01,          // PZL M28 Skytruck - military transport
    rotationFix: -90,
  },
  
  "SHAHD":{
    path: '/models/SHAHED.glb',
    scale: 0.01,          // Shahed drone
    rotationFix: 0,
  },
  // === OTHER AIRCRAFT ===
  'Business_jet': {
    path: '/models/Business_jet.glb',
    scale: 0.02,           // Business jets are smaller
    rotationFix: 0,
  },
  'small': {
    path: '/models/small.glb',
    scale: 0.02,           // General aviation / small aircraft
    rotationFix: 0,
  },
};

// Default model to use when no match is found
const DEFAULT_MODEL = 'A320';

// Map aircraft type codes to model config keys
// Add new aircraft types here to map them to existing models
const AIRCRAFT_TYPE_TO_MODEL: Record<string, string> = {
  // Airbus narrow-body
  'A20N': 'A20N',
  'A21N': 'A21N_wizz',
  'A320': 'A320',
  'A321': 'A21N_wizz',
  'A319': 'A320',
  'A318': 'A320',
  // Boeing narrow-body
  'B38M': 'B38M',
  'B738': 'B738',
  'B737': 'boeing_737',
  'B739': 'B738',
  'B37M': 'B38M',
  // Turboprops
  'AT76': 'AT76',
  'AT72': 'AT76',
  'ATR': 'AT76',
  'DH8D': 'AT76',
  // Military aircraft
  'M28': 'M28',
  'M28T': 'M28',    // M28 variants
  'C295': 'M28',    // Similar military transports
  'CN35': 'M28',
  // Business jets - map to Business_jet model
  'G650': 'Business_jet',
  'GL5T': 'Business_jet',
  'C680': 'Business_jet',
  'C56X': 'Business_jet',
  'CL60': 'Business_jet',
  'FA7X': 'Business_jet',
  'GLEX': 'Business_jet',
  // Small aircraft - map to small model
  'C172': 'small',
  'C152': 'small',
  'PA28': 'small',
  'SR22': 'small',
  'P28A': 'small',
  'C182': 'small',
  'SHAHD': 'SHAHD',
  "C208": 'small',
};

// Category to model mapping (fallback when type is unknown)
const CATEGORY_TO_MODEL: Record<string, string> = {
  'Passenger': 'A320',
  'Cargo': 'B738',
  'Business_jets': 'Business_jet',
  'Military_and_government': 'M28',  // Use M28 military transport for military/government
  'General_aviation': 'small',
  'Other_service': 'small',
  'Helicopters': 'small',
};

// Get model config for an aircraft based on type or category
function getAircraftModelInfo(aircraftType?: string, category?: string): { 
  modelPath: string; 
  scale: number; 
  rotationFix: number;
  modelKey: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
} {
  let modelKey = DEFAULT_MODEL;
  
  // First, try exact aircraft type match
  if (aircraftType) {
    const typeUpper = aircraftType.toUpperCase();
    
    // Check if we have a mapping for this aircraft type
    for (const [type, key] of Object.entries(AIRCRAFT_TYPE_TO_MODEL)) {
      if (typeUpper === type.toUpperCase() || typeUpper.startsWith(type.toUpperCase())) {
        modelKey = key;
        break;
      }
    }
  }
  
  // If still default, try category fallback
  if (modelKey === DEFAULT_MODEL && category) {
    const categoryModel = CATEGORY_TO_MODEL[category];
    if (categoryModel) {
      modelKey = categoryModel;
    }
  }
  
  // Get the model config
  const config = MODEL_CONFIG[modelKey] || MODEL_CONFIG[DEFAULT_MODEL];
  
  return { 
    modelPath: config.path, 
    scale: config.scale,
    rotationFix: config.rotationFix,
    modelKey,
    offsetX: config.offsetX || 0,
    offsetY: config.offsetY || 0,
    offsetZ: config.offsetZ || 0,
  };
}

// Bounding box interface
interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  centerLat: number;
  centerLon: number;
  width: number;  // in degrees
  height: number; // in degrees
}

// ============================================================
// MINIMUM BOUNDING BOX - Levant Region (from core/config.py)
// This ensures the 3D map always shows at least the full research area
// ============================================================
const LEVANT_BBOX = {
  NORTH: 34.597042,
  SOUTH: 28.536275,
  WEST: 32.299805,
  EAST: 37.397461,
};

// Calculate bounding box from track points, ensuring minimum coverage of Levant region
function calculateBoundingBox(points: TrackPoint[], paddingPercent: number = 0.05): BoundingBox {
  // Start with the Levant region as the minimum bbox
  let minLat = LEVANT_BBOX.SOUTH;
  let maxLat = LEVANT_BBOX.NORTH;
  let minLon = LEVANT_BBOX.WEST;
  let maxLon = LEVANT_BBOX.EAST;
  
  // Expand to include all flight points if they go beyond the Levant region
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  
  // Add small padding for visual margin
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;
  const latPadding = latRange * paddingPercent;
  const lonPadding = lonRange * paddingPercent;
  
  minLat -= latPadding;
  maxLat += latPadding;
  minLon -= lonPadding;
  maxLon += lonPadding;
  
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
    width: maxLon - minLon,
    height: maxLat - minLat,
  };
}

// Convert lat/lon/alt to 3D coordinates
// Scale: 1 unit = ~1km, altitude scaled by ALTITUDE_SCALE for visibility
function latLonAltTo3D(lat: number, lon: number, alt: number, center: { lat: number; lon: number }): [number, number, number] {
  const scale = 111.32; // km per degree at equator (roughly)
  const x = (lon - center.lon) * scale * Math.cos(center.lat * Math.PI / 180);
  const z = -(lat - center.lat) * scale;
  // Convert feet to km and apply altitude exaggeration
  // 0.0003048 converts feet to km, then multiply by ALTITUDE_SCALE
  const y = (alt * 0.0003048) * ALTITUDE_SCALE;
  return [x, y, z];
}

// 3D Flat Ground with map texture (no elevation - flat at y=0)
// The map is centered at the origin (0,0,0) - all coordinates should be relative to bbox center
function TerrainGround({ 
  bbox, 
  mapTextureUrl,
}: { 
  bbox: BoundingBox;
  mapTextureUrl: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Load texture from data URL
  const texture = useMemo(() => {
    if (!mapTextureUrl) return null;
    
    console.log('[TerrainGround] Creating texture from data URL, length:', mapTextureUrl.length);
    
    const img = new Image();
    img.src = mapTextureUrl;
    
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    
    img.onload = () => {
      console.log('[TerrainGround] Image loaded, size:', img.width, 'x', img.height);
      tex.needsUpdate = true;
    };
    
    return tex;
  }, [mapTextureUrl]);
  
  // Force update when texture loads
  useFrame(() => {
    if (meshRef.current && texture && texture.image && texture.image.complete) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      if (material.map !== texture) {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  });
  
  // Calculate plane dimensions in 3D space (km)
  // Use bbox center for coordinate conversion (same as map rendering)
  const scale = 111.32; // km per degree
  const widthKm = bbox.width * scale * Math.cos(bbox.centerLat * Math.PI / 180);
  const heightKm = bbox.height * scale;
  
  // console.log('[TerrainGround] Rendering plane at origin:', { widthKm, heightKm, hasTexture: !!texture });
  
  return (
    <group>
      {/* Simple flat plane with map texture at y=0, centered at origin */}
      <mesh 
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]}
      >
        <planeGeometry args={[widthKm, heightKm]} />
        <meshBasicMaterial 
          color={texture ? "#ffffff" : "#4a6a8a"}
          map={texture}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      
      {/* Edge border to show map bounds */}
      <Line
        points={[
          [-widthKm/2, 0.2, -heightKm/2],
          [widthKm/2, 0.2, -heightKm/2],
          [widthKm/2, 0.2, heightKm/2],
          [-widthKm/2, 0.2, heightKm/2],
          [-widthKm/2, 0.2, -heightKm/2],
        ]}
        color="#00ff00"
        lineWidth={2}
        opacity={0.8}
        transparent
      />
    </group>
  );
}

// Fallback grid ground plane (used while loading)
function FallbackGroundPlane({ size = 500 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[size * 2, size * 2]} />
      <meshBasicMaterial color="#0a1520" transparent opacity={0.6} />
    </mesh>
  );
}

// Vertical altitude line from ground to aircraft
function AltitudeLine({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position;
  
  return (
    <group>
      {/* Dashed vertical line */}
      <Line
        points={[[x, 0, z], [x, y, z]]}
        color="#00ffff"
        lineWidth={1}
        opacity={0.4}
        transparent
        dashed
        dashSize={0.5}
        dashScale={2}
      />
      {/* Ground marker */}
      <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
      </mesh>
      {/* Ground dot */}
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// Glowing flight path - single thick line with glow effect
function GlowingPath({ points, color, opacity = 1 }: { points: [number, number, number][]; color: string; opacity?: number }) {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={4}
      opacity={opacity}
      transparent
    />
  );
}

// Ghost path (full path, dimmed) - shows path on ground for reference
function GroundShadowPath({ points, color = '#00ffff' }: { points: [number, number, number][]; color?: string }) {
  if (points.length < 2) return null;
  
  // Project points to ground (y = 0)
  const groundPoints: [number, number, number][] = points.map(([x, _, z]) => [x, 0.05, z]);
  
  return (
    <Line
      points={groundPoints}
      color={color}
      lineWidth={2}
      opacity={0.15}
      transparent
    />
  );
}

// Highlighted segment - AI-specified segment shown in bright orange/yellow
function HighlightedSegmentPath({ points, startIndex, endIndex }: { 
  points: [number, number, number][]; 
  startIndex: number; 
  endIndex: number;
}) {
  const segmentPoints = useMemo(() => {
    const start = Math.max(0, Math.min(startIndex, points.length - 1));
    const end = Math.max(0, Math.min(endIndex, points.length - 1));
    return points.slice(start, end + 1);
  }, [points, startIndex, endIndex]);

  if (segmentPoints.length < 2) return null;

  return (
    <group>
      {/* Highlighted segment as thick orange line */}
      <Line
        points={segmentPoints}
        color="#ff9500"
        lineWidth={6}
        opacity={1}
        transparent
      />
      
      {/* Start marker */}
      {segmentPoints.length > 0 && (
        <mesh position={segmentPoints[0]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.9} />
        </mesh>
      )}
      
      {/* End marker */}
      {segmentPoints.length > 1 && (
        <mesh position={segmentPoints[segmentPoints.length - 1]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color="#ff4444" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

// Highlighted point marker - AI-specified point shown as a pulsing marker
function HighlightedPointMarker({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Pulsing animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const scale = 1.2 + Math.sin(clock.elapsedTime * 4) * 0.3;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={position}>
      <group ref={groupRef}>
        {/* Inner marker */}
        <mesh>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#ff0066" transparent opacity={0.9} />
        </mesh>
        {/* Outer glow */}
        <mesh>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#ff0066" transparent opacity={0.3} />
        </mesh>
        {/* Extra outer glow */}
        <mesh>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#ff0066" transparent opacity={0.1} />
        </mesh>
      </group>
      
      {/* Vertical line to ground */}
      <Line
        points={[[0, 0, 0], [0, -position[1], 0]]}
        color="#ff0066"
        lineWidth={2}
        opacity={0.6}
        transparent
        dashed
        dashSize={0.5}
        dashScale={2}
      />
      
      {/* Ground marker */}
      <mesh position={[0, -position[1] + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 1, 32]} />
        <meshBasicMaterial color="#ff0066" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// Aircraft 3D model component - loads GLTF model based on aircraft type
// Falls back to category-based selection, then to default model
function Aircraft3D({ 
  position, 
  heading = 0,
  pitch = 0,
  color = '#00ffff',
  aircraftType,
  category,
  callsign,
  showLabel = true,
}: { 
  position: [number, number, number]; 
  heading: number;
  pitch: number;
  color?: string;
  aircraftType?: string;
  category?: string;
  callsign?: string;
  showLabel?: boolean;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  
  // Get the model path, scale, rotation fix, and offsets based on aircraft type/category
  const { modelPath, scale, rotationFix, offsetX, offsetY, offsetZ } = useMemo(() => {
    const info = getAircraftModelInfo(aircraftType, category);
    console.log(`[Aircraft3D] type="${aircraftType}" category="${category}" -> key="${info.modelKey}" path="${info.modelPath}"`);
    return info;
  }, [aircraftType, category]);
  
  // Load the GLTF model
  const { scene } = useGLTF(modelPath);
  
  // Debug: check if scene loaded correctly and get bounding box
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      console.log(`[Aircraft3D] Loaded ${modelPath}: size=${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}, center=${center.x.toFixed(1)},${center.y.toFixed(1)},${center.z.toFixed(1)}`);
    } else {
      console.error(`[Aircraft3D] FAILED to load ${modelPath}`);
    }
  }, [scene, modelPath]);
  
  // Clone the scene so each aircraft has its own instance
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    // Apply color tint to the model
    clone.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Clone the material so we don't affect other instances
        child.material = child.material.clone();
        // Add emissive glow based on the color
        if (child.material.emissive) {
          child.material.emissive.setStyle(color);
          child.material.emissiveIntensity = 0.15;
        }
      }
    });
    return clone;
  }, [scene, color]);
  
  // Subtle pulsing animation for glow
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const glowScale = 1 + Math.sin(clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(glowScale);
    }
  });

  // Model scale factor - models are typically ~1 unit, we scale based on aircraft size
  // The scale from getAircraftModelInfo gives relative size (0.2 for small, 1.0 for large)
  // We multiply by a base factor to make them visible in the 3D world
  const modelScale = scale * 1.5; // Adjusted for visibility
  
  // Convert rotation fix from degrees to radians and combine with base rotation
  // rotationFix adjusts for models that face the wrong direction
  const modelRotationY = Math.PI + (rotationFix * Math.PI / 180);
  
  // Build label text: just callsign for cleaner look on aircraft
  const labelText = callsign || '';
  
  // Fixed label size independent of model scale for consistent visibility
  const labelSize = 0.4; // Fixed size for all aircraft labels
  const labelHeight = 1.5; // Fixed height above aircraft

  return (
    <group position={position}>
      {/* Label above aircraft - always faces camera */}
      {showLabel && labelText && (
        <Text
          position={[0, labelHeight, 0]}
          fontSize={labelSize}
          color={color}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {labelText}
        </Text>
      )}
      
      {/* Rotate based on heading (Y-axis) */}
      <group rotation={[0, (-heading + 90) * Math.PI / 180, 0]}>
        {/* Apply pitch around Z-axis (perpendicular to wings after heading rotation) */}
        <group rotation={[0, 0, pitch * Math.PI / 180]}>
          {/* The GLTF model with rotation fix and position offset applied */}
          <primitive 
            object={clonedScene} 
            scale={[modelScale, modelScale, modelScale]}
            rotation={[0, modelRotationY, 0]}
            position={[offsetX * modelScale, offsetY * modelScale, offsetZ * modelScale]}
          />
          
          {/* Glow effect sphere around the aircraft */}
          <mesh ref={glowRef}>
            <sphereGeometry args={[modelScale * 2, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.1} />
          </mesh>
          
          {/* Outer glow */}
          <mesh>
            <sphereGeometry args={[modelScale * 3, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.04} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Preload all available models for faster loading
Object.values(MODEL_CONFIG).forEach(config => {
  useGLTF.preload(config.path);
});

// Camera mode type
type CameraMode = 'orbit' | 'chase';

// Camera controller that smoothly follows aircraft
// In 'orbit' mode: camera target follows the plane, user controls camera position
// In 'chase' mode: camera position AND target follow the plane (behind and above)
function CameraController({ 
  target, 
  heading,
  autoFollow,
  cameraMode,
  controlsRef 
}: { 
  target: [number, number, number];
  heading: number;
  autoFollow: boolean;
  cameraMode: CameraMode;
  controlsRef: React.RefObject<any>;
}) {
  const targetRef = useRef(new THREE.Vector3(...target));
  const cameraPositionRef = useRef(new THREE.Vector3());
  const { camera } = useThree();
  
  // Chase camera settings
  const CHASE_DISTANCE = 15; // Distance behind aircraft (km in 3D units)
  const CHASE_HEIGHT = 8; // Height above aircraft
  const CHASE_LERP_SPEED = 0.06; // Smooth follow speed (lower = smoother)
  const TARGET_LERP_SPEED = 0.1; // Target follow speed
  
  // Calculate chase camera position based on aircraft heading
  const calculateChasePosition = (targetPos: THREE.Vector3, hdg: number): THREE.Vector3 => {
    // Convert heading to radians and calculate position behind the aircraft
    const headingRad = ((-hdg + 90) * Math.PI) / 180;
    
    // Position behind the aircraft (opposite of heading direction)
    const offsetX = -Math.cos(headingRad) * CHASE_DISTANCE;
    const offsetZ = Math.sin(headingRad) * CHASE_DISTANCE;
    
    return new THREE.Vector3(
      targetPos.x + offsetX,
      targetPos.y + CHASE_HEIGHT,
      targetPos.z + offsetZ
    );
  };
  
  // Smoothly interpolate camera position and target
  useFrame(() => {
    if (!autoFollow || !controlsRef.current) return;
    
    const targetVec = new THREE.Vector3(...target);
    
    if (cameraMode === 'chase') {
      // Chase mode: move both camera and target
      const desiredCameraPos = calculateChasePosition(targetVec, heading);
      
      // Smooth lerp for camera position
      cameraPositionRef.current.lerp(desiredCameraPos, CHASE_LERP_SPEED);
      camera.position.copy(cameraPositionRef.current);
      
      // Smooth lerp for target
      targetRef.current.lerp(targetVec, TARGET_LERP_SPEED);
      controlsRef.current.target.copy(targetRef.current);
      
      // Enable rotation in chase mode so user can adjust viewing angle
      controlsRef.current.enableRotate = true;
    } else {
      // Orbit mode: only move target, let user control camera
      targetRef.current.lerp(targetVec, 0.08);
      controlsRef.current.target.copy(targetRef.current);
      controlsRef.current.enableRotate = true;
    }
    
    controlsRef.current.update();
  });
  
  // Handle mode changes and initial setup
  useEffect(() => {
    if (!controlsRef.current) return;
    
    const targetVec = new THREE.Vector3(...target);
    
    if (cameraMode === 'chase' && autoFollow) {
      // Initialize chase camera position
      const chasePos = calculateChasePosition(targetVec, heading);
      cameraPositionRef.current.copy(chasePos);
      camera.position.copy(chasePos);
      targetRef.current.copy(targetVec);
      controlsRef.current.target.copy(targetVec);
      controlsRef.current.enableRotate = true; // Allow angle adjustment in chase mode
    } else if (autoFollow) {
      // Reset to orbit mode
      targetRef.current.copy(targetVec);
      controlsRef.current.target.copy(targetVec);
      controlsRef.current.enableRotate = true;
    }
    
    controlsRef.current.update();
  }, [cameraMode, autoFollow]);

  return null;
}

// Altitude scale markers
function AltitudeScale({ maxAlt }: { maxAlt: number }) {
  const markers = [];
  const step = Math.ceil(maxAlt / 5 / 10000) * 10000; // Round to nearest 10000 ft
  
  for (let alt = 0; alt <= maxAlt; alt += step) {
    const y = (alt * 0.0003048) * ALTITUDE_SCALE; // Same scaling as latLonAltTo3D
    markers.push(
      <group key={alt} position={[-20, y, 0]}>
        <Line
          points={[[-1, 0, 0], [1, 0, 0]]}
          color="#ffffff"
          lineWidth={1}
          opacity={0.3}
          transparent
        />
        <Text
          position={[-3, 0, 0]}
          fontSize={0.8}
          color="#ffffff"
          anchorX="right"
          anchorY="middle"
        >
          {(alt / 1000).toFixed(0)}k ft
        </Text>
      </group>
    );
  }
  
  return <group>{markers}</group>;
}

// Main 3D Scene
function Scene({ 
  flightData, 
  secondaryFlights,
  currentPointIndex, 
  autoFollow,
  cameraMode,
  controlsRef,
  highlight,
  bbox,
  mapTextureUrl,
}: {
  flightData: FlightData;
  secondaryFlights: FlightData[];
  currentPointIndex: number;
  autoFollow: boolean;
  cameraMode: CameraMode;
  controlsRef: React.RefObject<any>;
  highlight?: HighlightState | null;
  bbox: BoundingBox;
  mapTextureUrl: string | null;
}) {
  const points = flightData.points;
  const mainColor = flightData.color || '#00ffff';
  
  // Use bbox center as the coordinate origin - this ensures perfect alignment
  // between the map texture and the 3D flight paths
  const center = useMemo(() => {
    return { lat: bbox.centerLat, lon: bbox.centerLon };
  }, [bbox.centerLat, bbox.centerLon]);

  // Convert all points to 3D
  const points3D = useMemo(() => {
    return points.map(p => latLonAltTo3D(p.lat, p.lon, p.alt || 0, center));
  }, [points, center]);

  // Current path (up to current point)
  const currentPath = useMemo(() => {
    return points3D.slice(0, currentPointIndex + 1);
  }, [points3D, currentPointIndex]);

  // Current position and heading
  const currentPoint = points[currentPointIndex];
  const currentPosition = points3D[currentPointIndex] || [0, 0, 0];
  
  // Calculate pitch from altitude change rate (climb/descent)
  // Looks at multiple points ahead/behind to smooth the pitch calculation
  const pitch = useMemo(() => {
    if (points.length < 2) return 0;
    
    const curr = points[currentPointIndex];
    if (!curr) return 0;
    
    // Use vertical speed (vspeed) if available (in ft/min)
    const vspeed = curr.vspeed || 0;
    if (vspeed !== 0) {
      const pitchFromVspeed = (vspeed / 300) * PITCH_SCALE;
      return Math.max(-30, Math.min(30, pitchFromVspeed));
    }
    
    // Look at points ahead to determine if climbing or descending
    // This gives a smoother, more predictive pitch
    const lookAhead = Math.min(5, points.length - currentPointIndex - 1);
    const lookBehind = Math.min(5, currentPointIndex);
    
    let totalAltChange = 0;
    let totalTime = 0;
    
    // Look at points ahead (what's coming)
    for (let i = 1; i <= lookAhead; i++) {
      const nextPoint = points[currentPointIndex + i];
      if (nextPoint) {
        totalAltChange += (nextPoint.alt || 0) - (curr.alt || 0);
        totalTime += (nextPoint.timestamp - curr.timestamp) || 1;
      }
    }
    
    // Also consider points behind (current trend)
    if (lookBehind > 0) {
      const prevPoint = points[currentPointIndex - lookBehind];
      if (prevPoint) {
        totalAltChange += (curr.alt || 0) - (prevPoint.alt || 0);
        totalTime += (curr.timestamp - prevPoint.timestamp) || 1;
      }
    }
    
    if (totalTime === 0) return 0;
    
    // Calculate vertical rate in ft/min
    const verticalRate = (totalAltChange / totalTime) * 60;
    
    // Simple direct mapping: vertical rate to pitch angle
    // 500 ft/min climb = PITCH_SCALE degrees up
    // -500 ft/min descent = PITCH_SCALE degrees down
    const pitchDeg = (verticalRate / 500) * PITCH_SCALE;
    const finalPitch = Math.max(-30, Math.min(30, pitchDeg));
    
    // Log occasionally (every 10 points)
    if (currentPointIndex % 10 === 0) {
      console.log(`[Pitch] idx=${currentPointIndex}, altChange=${totalAltChange.toFixed(0)}ft, vertRate=${verticalRate.toFixed(0)}ft/min, pitch=${finalPitch.toFixed(1)}°`);
    }
    
    return finalPitch;
  }, [currentPointIndex, points]);

  // Get heading from track field
  const heading = currentPoint?.track || 0;

  // Max altitude for scale
  const maxAlt = useMemo(() => {
    return Math.max(...points.map(p => p.alt || 0), 40000);
  }, [points]);

  // Calculate highlighted point position if lat/lon is specified
  const highlightedPointPosition = useMemo(() => {
    if (!highlight?.point) return null;
    
    // Find closest point in track to get altitude
    let closestAlt = 10000; // Default altitude
    let minDist = Infinity;
    
    for (const p of points) {
      const dist = Math.sqrt(
        Math.pow(p.lat - highlight.point.lat, 2) + 
        Math.pow(p.lon - highlight.point.lon, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        closestAlt = p.alt || 10000;
      }
    }
    
    return latLonAltTo3D(highlight.point.lat, highlight.point.lon, closestAlt, center);
  }, [highlight?.point, points, center]);

  return (
    <>
      {/* Lighting - enhanced for realistic aircraft rendering */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 100, 50]} intensity={1} color="#ffffff" />
      <directionalLight position={[-30, 50, -30]} intensity={0.3} color="#87ceeb" />
      <pointLight position={[100, 100, 100]} intensity={0.5} />
      <hemisphereLight args={['#87ceeb', '#362907', 0.3]} />
      
      {/* Stars background */}
      <Stars radius={500} depth={100} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* 3D Terrain with map texture */}
      {mapTextureUrl ? (
        <TerrainGround 
          bbox={bbox}
          mapTextureUrl={mapTextureUrl}
        />
      ) : (
        <FallbackGroundPlane size={500} />
      )}
      
      {/* Altitude scale */}
      <AltitudeScale maxAlt={maxAlt} />
      
      {/* Ground shadow of main flight path */}
      <GroundShadowPath points={points3D} />
      
      {/* Secondary flight paths (proximity flights) with animated aircraft */}
      {secondaryFlights.map((flight) => {
        const flightPoints3D = flight.points.map(p => 
          latLonAltTo3D(p.lat, p.lon, p.alt || 0, center)
        );
        
        // Find the point closest to the main flight's current timestamp
        const mainTimestamp = currentPoint?.timestamp || 0;
        let closestIdx = 0;
        let minTimeDiff = Infinity;
        
        for (let i = 0; i < flight.points.length; i++) {
          const diff = Math.abs(flight.points[i].timestamp - mainTimestamp);
          if (diff < minTimeDiff) {
            minTimeDiff = diff;
            closestIdx = i;
          }
        }
        
        const secondaryPoint = flight.points[closestIdx];
        const secondaryPosition = flightPoints3D[closestIdx];
        const secondaryHeading = secondaryPoint?.track || 0;
        
        // Calculate pitch for secondary aircraft based on climb/descent
        let secondaryPitch = 0;
        if (closestIdx > 0 && secondaryPoint) {
          // Look at multiple points for smoother pitch
          const lookAhead = Math.min(5, flight.points.length - closestIdx - 1);
          const lookBehind = Math.min(5, closestIdx);
          
          let totalAltChange = 0;
          let totalTime = 0;
          
          // Look ahead
          for (let i = 1; i <= lookAhead; i++) {
            const nextPoint = flight.points[closestIdx + i];
            if (nextPoint) {
              totalAltChange += (nextPoint.alt || 0) - (secondaryPoint.alt || 0);
              totalTime += (nextPoint.timestamp - secondaryPoint.timestamp) || 1;
            }
          }
          
          // Look behind
          if (lookBehind > 0) {
            const prevPoint = flight.points[closestIdx - lookBehind];
            if (prevPoint) {
              totalAltChange += (secondaryPoint.alt || 0) - (prevPoint.alt || 0);
              totalTime += (secondaryPoint.timestamp - prevPoint.timestamp) || 1;
            }
          }
          
          if (totalTime > 0) {
            const verticalRate = (totalAltChange / totalTime) * 60;
            const pitchDeg = (verticalRate / 500) * PITCH_SCALE;
            secondaryPitch = Math.max(-30, Math.min(30, pitchDeg));
          }
        }
        
        // Calculate path up to current time
        const activeSecondaryPath = flightPoints3D.slice(0, closestIdx + 1);
        
        return (
          <group key={flight.id}>
            {/* Ground shadow of secondary flight */}
            <GroundShadowPath points={flightPoints3D} color={flight.color || '#ef4444'} />
            
            {/* Full secondary flight path (dimmed) */}
            <GlowingPath points={flightPoints3D} color={flight.color || '#ef4444'} opacity={0.2} />
            
            {/* Active path up to current time (brighter) */}
            {activeSecondaryPath.length >= 2 && (
              <GlowingPath points={activeSecondaryPath} color={flight.color || '#ef4444'} opacity={0.8} />
            )}
            
            {/* Secondary aircraft marker - size based on aircraft type */}
            {secondaryPosition && minTimeDiff < 60 && (
              <>
                <Aircraft3D
                  position={secondaryPosition as [number, number, number]}
                  heading={secondaryHeading}
                  pitch={secondaryPitch}
                  color={flight.color || '#ef4444'}
                  aircraftType={flight.aircraftType}
                  category={flight.category}
                  callsign={flight.callsign}
                />
                {/* Altitude line for secondary aircraft */}
                <AltitudeLine position={secondaryPosition as [number, number, number]} />
              </>
            )}
          </group>
        );
      })}
      
      {/* Full main flight path (dimmed) */}
      <GlowingPath points={points3D} color={mainColor} opacity={0.15} />
      
      {/* Current main flight path (bright) */}
      {currentPath.length >= 2 && (
        <GlowingPath points={currentPath} color={mainColor} opacity={1} />
      )}
      
      {/* AI-highlighted segment */}
      {highlight?.segment && points3D.length > 0 && (
        <HighlightedSegmentPath 
          points={points3D} 
          startIndex={highlight.segment.startIndex} 
          endIndex={highlight.segment.endIndex} 
        />
      )}
      
      {/* AI-highlighted point */}
      {highlightedPointPosition && (
        <HighlightedPointMarker position={highlightedPointPosition as [number, number, number]} />
      )}
      
      {/* Altitude line from ground to aircraft */}
      {currentPosition && <AltitudeLine position={currentPosition as [number, number, number]} />}
      
      {/* Aircraft */}
      {currentPoint && (
        <Aircraft3D
          position={currentPosition as [number, number, number]}
          heading={heading}
          pitch={pitch}
          aircraftType={flightData.aircraftType}
          category={flightData.category}
          callsign={flightData.callsign}
        />
      )}
      
      {/* Camera controller */}
      <CameraController 
        target={currentPosition as [number, number, number]} 
        heading={heading}
        autoFollow={autoFollow}
        cameraMode={cameraMode}
        controlsRef={controlsRef}
      />
      
      {/* Orbit controls - improved for smoother camera feel */}
      <OrbitControls 
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.05}
        minDistance={0.3}
        maxDistance={2000}
        rotateSpeed={0.5}
        zoomSpeed={1.2}
        panSpeed={0.8}
        maxPolarAngle={Math.PI * 0.85}
        target={currentPosition as THREE.Vector3Tuple}
      />
    </>
  );
}

// Calculate zoom level for a given bounding box
// Minimum zoom of 9 ensures map tiles have enough detail to be visible
function calculateZoomLevel(bbox: BoundingBox): number {
  const maxDim = Math.max(bbox.width, bbox.height);
  // Use higher zoom levels for better map visibility
  if (maxDim > 80) return 5;  // Very large area
  if (maxDim > 50) return 6;
  if (maxDim > 20) return 7;
  if (maxDim > 10) return 8;
  if (maxDim > 5) return 9;
  if (maxDim > 2) return 10;
  if (maxDim > 1) return 11;
  if (maxDim > 0.5) return 12;
  return 13;
}

// Render MapLibre map to canvas texture - uses same style as main app
// The map is rendered to exactly match the bbox bounds with no padding
async function renderMapLibreTexture(bbox: BoundingBox): Promise<string | null> {
  return new Promise((resolve) => {
    // Use 2048 resolution for good quality without timeouts
    const resolution = 2048;
    
    // Calculate aspect ratio to match bbox proportions
    const aspectRatio = bbox.width / bbox.height;
    const width = aspectRatio >= 1 ? resolution : Math.round(resolution * aspectRatio);
    const height = aspectRatio >= 1 ? Math.round(resolution / aspectRatio) : resolution;
    
    // Create a hidden container for MapLibre
    const container = document.createElement('div');
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.visibility = 'hidden';
    document.body.appendChild(container);
    
    console.log(`[3D Map] Creating MapLibre map for texture (${width}x${height})...`);
    
    // Use darkmatter style (same as main map) for consistency
    const map = new maplibregl.Map({
      container,
      style: `https://api.maptiler.com/maps/darkmatter/style.json?key=${MAPTILER_KEY}`,
      center: [bbox.centerLon, bbox.centerLat],
      zoom: calculateZoomLevel(bbox),
      interactive: false,
      attributionControl: false,
      // @ts-expect-error preserveDrawingBuffer is required for canvas export
      preserveDrawingBuffer: true,
    });
    
    // Fit bounds to the exact bbox with NO padding - this ensures perfect alignment
    // with the 3D plane which uses the same bbox dimensions
    map.fitBounds(
      [[bbox.minLon, bbox.minLat], [bbox.maxLon, bbox.maxLat]],
      { padding: 0, duration: 0 }
    );
    
    let resolved = false;
    
    // Capture map when idle (all tiles loaded and rendered)
    map.on('idle', () => {
      if (resolved) return;
      resolved = true;
      
      try {
        const canvas = map.getCanvas();
        const dataUrl = canvas.toDataURL('image/png');
        console.log('[3D Map] MapLibre texture rendered, size:', canvas.width, 'x', canvas.height);
        
        // Cleanup
        map.remove();
        document.body.removeChild(container);
        
        resolve(dataUrl);
      } catch (err) {
        console.error('[3D Map] Failed to render MapLibre texture:', err);
        map.remove();
        document.body.removeChild(container);
        resolve(null);
      }
    });
    
    // Handle errors
    map.on('error', (e) => {
      console.error('[3D Map] MapLibre error:', e);
      if (!resolved) {
        resolved = true;
        map.remove();
        document.body.removeChild(container);
        resolve(null);
      }
    });
    
    // Timeout after 30 seconds for large areas
    setTimeout(() => {
      if (!resolved && container.parentNode) {
        console.warn('[3D Map] MapLibre texture render timeout');
        resolved = true;
        map.remove();
        document.body.removeChild(container);
        resolve(null);
      }
    }, 30000);
  });
}

// Flight colors for multi-flight display
const FLIGHT_COLORS = ['#00ffff', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export function Flight3DMapReplay({ flightId, onClose, highlight, onClearHighlight, trackPoints, secondaryFlightIds = [], aircraftType, category, callsign, embeddedChatProps }: Flight3DMapReplayProps) {
  const [flightData, setFlightData] = useState<FlightData | null>(null);
  const [secondaryFlights, setSecondaryFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [autoFollow, setAutoFollow] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase'); // Default to chase for easier following
  const [highlightApplied, setHighlightApplied] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const controlsRef = useRef<any>(null);
  
  // Map state
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [mapTextureUrl, setMapTextureUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  // Fetch flight data - always fetch fresh complete data for accurate replay
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`[Flight3DMapReplay] Loading track for ${flightId}...`);
        
        // Always fetch fresh track data for complete, accurate replay
        // Try feedback track first (local databases), then unified track (can fetch from FR24)
        let trackData: FlightTrack | null = null;
        let source = '';
        
        try {
          trackData = await fetchFeedbackTrack(flightId);
          source = 'feedback';
          console.log(`[Flight3DMapReplay] Loaded ${flightId} from feedback track with ${trackData?.points?.length || 0} points`);
        } catch (feedbackErr) {
          console.warn(`[Flight3DMapReplay] Feedback track not found for ${flightId}, trying unified track...`);
          try {
            // Unified track can fetch from FR24 if not in local databases
            trackData = await fetchUnifiedTrack(flightId);
            source = 'unified';
            console.log(`[Flight3DMapReplay] Loaded ${flightId} from unified track with ${trackData?.points?.length || 0} points`);
          } catch (unifiedErr) {
            console.warn(`[Flight3DMapReplay] Unified track failed for ${flightId}:`, unifiedErr);
            
            // Last resort: use pre-loaded track points if available
            if (trackPoints && trackPoints.length > 0) {
              console.log(`[Flight3DMapReplay] Using pre-loaded trackPoints (${trackPoints.length} points)`);
              trackData = { points: trackPoints } as FlightTrack;
              source = 'preloaded';
            }
          }
        }
        
        if (trackData && trackData.points && trackData.points.length > 0) {
          // Sort by timestamp
          const sortedPoints = [...trackData.points].sort((a, b) => a.timestamp - b.timestamp);
          
          // Extract callsign from track data if not provided
          const extractedCallsign = callsign || (trackData as any).callsign || sortedPoints[0]?.callsign;
          
          console.log(`[Flight3DMapReplay] Track loaded for ${flightId}: ${sortedPoints.length} points from ${source}`);
          
          setFlightData({
            id: flightId,
            points: sortedPoints,
            color: FLIGHT_COLORS[0],
            aircraftType: aircraftType || (trackData as any).aircraft_type,
            category: category || (trackData as any).category,
            callsign: extractedCallsign,
          });
        } else {
          setError('No track data available');
        }
      } catch (err) {
        console.error('Failed to load flight data:', err);
        setError('Failed to load flight data');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [flightId]); // Only re-fetch when flightId changes

  // Fetch secondary flights for proximity alerts - try multiple sources
  useEffect(() => {
    if (!secondaryFlightIds || secondaryFlightIds.length === 0) {
      setSecondaryFlights([]);
      return;
    }
    
    async function loadSecondaryFlights() {
      const uniqueIds = [...new Set(secondaryFlightIds)].filter(id => id && id !== flightId);
      
      console.log(`[Flight3DMapReplay] Loading ${uniqueIds.length} secondary flights...`);
      
      const results = await Promise.all(
        uniqueIds.map(async (id, index): Promise<FlightData | null> => {
          try {
            // Try fetchReplayOtherFlight first (specialized for finding other flights)
            let data: any = null;
            let source = '';
            
            try {
              data = await fetchReplayOtherFlight(id);
              source = 'replay-other';
            } catch (replayErr) {
              console.warn(`[Flight3DMapReplay] fetchReplayOtherFlight failed for ${id}, trying unified track...`);
              // Fallback to unified track
              try {
                data = await fetchUnifiedTrack(id);
                source = 'unified';
              } catch (unifiedErr) {
                console.warn(`[Flight3DMapReplay] All sources failed for secondary flight ${id}`);
              }
            }
            
            if (data && data.points && data.points.length > 0) {
              console.log(`[Flight3DMapReplay] Loaded secondary flight ${id} from ${source} with ${data.points.length} points`);
              return {
                id,
                points: data.points.sort((a: TrackPoint, b: TrackPoint) => a.timestamp - b.timestamp),
                color: FLIGHT_COLORS[(index + 1) % FLIGHT_COLORS.length],
                isSecondary: true,
                // Include aircraft type, callsign, and category from metadata
                aircraftType: data.metadata?.aircraft_type || data.aircraft_type,
                callsign: data.callsign || data.metadata?.callsign,
                category: data.metadata?.category || data.category,
              };
            }
          } catch (err) {
            console.warn(`Could not load secondary flight ${id}:`, err);
          }
          return null;
        })
      );
      
      const validFlights = results.filter((f): f is FlightData => f !== null);
      console.log(`[Flight3DMapReplay] Successfully loaded ${validFlights.length}/${uniqueIds.length} secondary flights`);
      setSecondaryFlights(validFlights);
    }
    
    loadSecondaryFlights();
  }, [secondaryFlightIds, flightId]);

  // Calculate bounding box and render map when flight data is loaded
  useEffect(() => {
    if (!flightData || flightData.points.length === 0) return;
    
    // Combine all flight points for bounding box calculation
    const allPoints = [...flightData.points, ...secondaryFlights.flatMap(f => f.points)];
    const calculatedBbox = calculateBoundingBox(allPoints);
    setBbox(calculatedBbox);
    
    // Render map using MapLibre
    setMapLoading(true);
    renderMapLibreTexture(calculatedBbox).then(dataUrl => {
      if (dataUrl) {
        setMapTextureUrl(dataUrl);
      }
      setMapLoading(false);
    }).catch(() => {
      setMapLoading(false);
    });
  }, [flightData, secondaryFlights]);

  // Handle highlight changes - jump to the highlighted segment or timestamp
  useEffect(() => {
    if (!flightData || highlightApplied) return;
    
    if (highlight?.segment) {
      // Jump to the start of the highlighted segment
      const startIdx = Math.max(0, Math.min(highlight.segment.startIndex, flightData.points.length - 1));
      setCurrentPointIndex(startIdx);
      setHighlightApplied(true);
    } else if (highlight?.focusTimestamp) {
      // Find the closest point to the specified timestamp
      let closestIdx = 0;
      let minDiff = Infinity;
      
      for (let i = 0; i < flightData.points.length; i++) {
        const diff = Math.abs(flightData.points[i].timestamp - highlight.focusTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      
      setCurrentPointIndex(closestIdx);
      setHighlightApplied(true);
    }
  }, [flightData, highlight, highlightApplied]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying || !flightData) return;

    const interval = setInterval(() => {
      setCurrentPointIndex(prev => {
        if (prev >= flightData.points.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, flightData]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowLeft') {
        setCurrentPointIndex(prev => Math.max(0, prev - 10));
      } else if (e.code === 'ArrowRight' && flightData) {
        setCurrentPointIndex(prev => Math.min(flightData.points.length - 1, prev + 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flightData]);

  // Get current point data for HUD
  const currentPoint = flightData?.points[currentPointIndex];

  // Format time (timestamp can be in seconds or milliseconds)
  const formatTime = (timestamp: number) => {
    // If timestamp is less than 10 trillion, it's in seconds
    const ts = timestamp > 10000000000000 ? timestamp : timestamp * 1000;
    return new Date(ts).toLocaleTimeString();
  };

  if (loading || (flightData && mapLoading)) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-white/70">
            {loading ? 'Loading 3D flight data...' : 'Loading map tiles...'}
          </p>
        </div>
      </div>,
      document.body
    );
  }

  if (error || !flightData) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'No data available'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [50, 30, 50], fov: 60 }}
        style={{ background: 'linear-gradient(to bottom, #000510, #001020)' }}
      >
        <Scene
          flightData={flightData}
          secondaryFlights={secondaryFlights}
          currentPointIndex={currentPointIndex}
          autoFollow={autoFollow}
          cameraMode={cameraMode}
          controlsRef={controlsRef}
          highlight={highlight}
          bbox={bbox || calculateBoundingBox(flightData.points)}
          mapTextureUrl={mapTextureUrl}
        />
      </Canvas>

      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md rounded-xl px-6 py-3 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.2)]">
        <div className="flex items-center gap-3">
          <div className="text-cyan-400">✈</div>
          <span className="text-white font-bold">3D FLIGHT REPLAY</span>
          <span className="text-cyan-400 text-sm">{flightId}</span>
          {/* AI Highlight indicator */}
          {(highlight?.segment || highlight?.point) && (
            <span className="ml-2 px-2.5 py-1 bg-orange-500/20 border border-orange-500/50 rounded-full text-orange-400 text-xs font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
              AI HIGHLIGHT
              <button
                onClick={() => {
                  onClearHighlight?.();
                  embeddedChatProps?.onHighlight?.(null);
                }}
                className="w-4 h-4 flex items-center justify-center rounded-full bg-orange-500/30 hover:bg-orange-500/50 transition text-orange-300 hover:text-white"
                title="Clear highlight"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Telemetry HUD - All Flights */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
        {/* Main Flight Telemetry */}
        {(() => {
          const mainNearestAirport = currentPoint ? findNearestAirport(currentPoint.lat, currentPoint.lon) : null;
          
          // Calculate distances to other flights
          const distancesToOthers = currentPoint ? secondaryFlights.map((flight) => {
            let closestPoint = flight.points[0];
            let minTimeDiff = Infinity;
            
            for (const p of flight.points) {
              const diff = Math.abs(p.timestamp - currentPoint.timestamp);
              if (diff < minTimeDiff) {
                minTimeDiff = diff;
                closestPoint = p;
              }
            }
            
            if (minTimeDiff > 60) return null;
            
            return {
              id: flight.id,
              color: flight.color || '#ef4444',
              distance: getDistanceNM(currentPoint.lat, currentPoint.lon, closestPoint.lat, closestPoint.lon),
              altDiff: Math.abs((currentPoint.alt || 0) - (closestPoint.alt || 0)),
            };
          }).filter(Boolean) : [];
          
          return (
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,255,255,0.15)] w-52">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cyan-500/20">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.8)] animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-bold text-cyan-400 text-xs tracking-wide">{flightData.callsign || flightId.slice(0, 8)}</span>
                  {flightData.aircraftType && (
                    <span className="text-[9px] text-cyan-600">{flightData.aircraftType}</span>
                  )}
                </div>
                <span className="text-[9px] text-cyan-600 ml-auto">(MAIN)</span>
              </div>
              
              {/* Telemetry Data */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">ALT</span>
                  <span className="text-cyan-300">{currentPoint?.alt?.toLocaleString() || 0} ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">HDG</span>
                  <span className="text-cyan-300">{currentPoint?.track?.toFixed(0) || 0}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SPD</span>
                  <span className="text-cyan-300">{currentPoint?.gspeed?.toFixed(0) || 0} kts</span>
                </div>
                
                {/* Distances to other flights */}
                {distancesToOthers.length > 0 && (
                  <div className="pt-1.5 mt-1.5 border-t border-white/10">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Distances</div>
                    {distancesToOthers.map((d: any) => {
                      if (!d) return null;
                      const distColor = d.distance < 3 ? 'text-red-400' : d.distance < 10 ? 'text-yellow-400' : 'text-green-400';
                      return (
                        <div key={d.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span className="text-gray-500 text-[10px]">{d.id.slice(0, 6)}</span>
                          </div>
                          <span className={`font-bold ${distColor}`}>{d.distance.toFixed(1)} NM</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Nearest Airport */}
                {mainNearestAirport && (
                  <div className="pt-1.5 mt-1.5 border-t border-white/10">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Nearest Airport</div>
                    <div className="flex justify-between items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                      <span className="text-green-400 font-bold text-[10px]">{mainNearestAirport.code}</span>
                      <span className="text-green-300">{mainNearestAirport.distance.toFixed(1)} NM</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        
        {/* Secondary Flight Telemetry Panels */}
        {secondaryFlights.map((flight) => {
          // Find closest point in time for this flight
          const mainTimestamp = currentPoint?.timestamp || 0;
          let closestPoint = flight.points[0];
          let minTimeDiff = Infinity;
          
          for (const p of flight.points) {
            const diff = Math.abs(p.timestamp - mainTimestamp);
            if (diff < minTimeDiff) {
              minTimeDiff = diff;
              closestPoint = p;
            }
          }
          
          // Skip if not active at this time
          if (minTimeDiff > 60) {
            return (
              <div key={flight.id} className="bg-black/60 backdrop-blur-md rounded-xl p-3 border border-red-500/20 w-52 opacity-50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: flight.color || '#ef4444' }} />
                  <span className="font-bold text-xs" style={{ color: flight.color || '#ef4444' }}>{flight.id.slice(0, 10)}</span>
                  <span className="text-[9px] text-yellow-500 ml-auto">NOT IN RANGE</span>
                </div>
              </div>
            );
          }
          
          const flightNearestAirport = findNearestAirport(closestPoint.lat, closestPoint.lon);
          const distanceToMain = currentPoint ? getDistanceNM(
            currentPoint.lat, currentPoint.lon, 
            closestPoint.lat, closestPoint.lon
          ) : 0;
          const altDiffToMain = currentPoint ? Math.abs((currentPoint.alt || 0) - (closestPoint.alt || 0)) : 0;
          const distColor = distanceToMain < 3 ? 'text-red-400' : distanceToMain < 10 ? 'text-yellow-400' : 'text-green-400';
          
          return (
            <div 
              key={flight.id} 
              className="bg-black/80 backdrop-blur-md rounded-xl p-3 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)] w-52"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/20">
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" 
                  style={{ backgroundColor: flight.color || '#ef4444' }}
                />
                <div className="flex flex-col">
                  <span className="font-bold text-xs" style={{ color: flight.color || '#ef4444' }}>
                    {flight.callsign || flight.id.slice(0, 8)}
                  </span>
                  {flight.aircraftType && (
                    <span className="text-[9px] text-red-400/60">{flight.aircraftType}</span>
                  )}
                </div>
                <span className="text-[9px] text-red-400/60 ml-auto">(PROXIMITY)</span>
              </div>
              
              {/* Telemetry Data */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">ALT</span>
                  <span className="text-red-300">{closestPoint?.alt?.toLocaleString() || 0} ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">HDG</span>
                  <span className="text-red-300">{closestPoint?.track?.toFixed(0) || 0}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">SPD</span>
                  <span className="text-red-300">{closestPoint?.gspeed?.toFixed(0) || 0} kts</span>
                </div>
                
                {/* Distance to main flight */}
                <div className="pt-1.5 mt-1.5 border-t border-white/10">
                  <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">To Main Flight</div>
                  <div className="flex justify-between items-center bg-white/5 px-1.5 py-0.5 rounded">
                    <span className={`font-bold ${distColor}`}>{distanceToMain.toFixed(1)} NM</span>
                    <span className="text-gray-500 text-[10px]">↕ {altDiffToMain.toFixed(0)} ft</span>
                  </div>
                </div>
                
                {/* Nearest Airport */}
                {flightNearestAirport && (
                  <div className="pt-1.5 mt-1.5 border-t border-white/10">
                    <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Nearest Airport</div>
                    <div className="flex justify-between items-center bg-green-500/10 px-1.5 py-0.5 rounded">
                      <span className="text-green-400 font-bold text-[10px]">{flightNearestAirport.code}</span>
                      <span className="text-green-300">{flightNearestAirport.distance.toFixed(1)} NM</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Camera Controls */}
      <div className="absolute top-4 right-16 flex gap-2">
        {/* Camera Mode Toggle */}
        <div className="flex bg-black/50 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setCameraMode('chase')}
            className={clsx(
              "px-3 py-2 flex items-center gap-1.5 text-xs font-medium transition",
              cameraMode === 'chase'
                ? "bg-cyan-500/30 text-cyan-400"
                : "text-white/50 hover:text-white hover:bg-white/10"
            )}
            title="Chase Camera - Follows behind the aircraft"
          >
            <Video className="w-4 h-4" />
            <span>Chase</span>
          </button>
          <button
            onClick={() => setCameraMode('orbit')}
            className={clsx(
              "px-3 py-2 flex items-center gap-1.5 text-xs font-medium transition",
              cameraMode === 'orbit'
                ? "bg-cyan-500/30 text-cyan-400"
                : "text-white/50 hover:text-white hover:bg-white/10"
            )}
            title="Orbit Camera - Free rotation around target"
          >
            <Orbit className="w-4 h-4" />
            <span>Orbit</span>
          </button>
        </div>
        
        {/* Auto-Follow Toggle */}
        <button
          onClick={() => setAutoFollow(!autoFollow)}
          className={clsx(
            "p-2 rounded-lg backdrop-blur-md border transition",
            autoFollow 
              ? "bg-cyan-500/30 border-cyan-500/50 text-cyan-400" 
              : "bg-black/50 border-white/10 text-white/50 hover:text-white"
          )}
          title="Auto-Follow Aircraft"
        >
          <Target className="w-5 h-5" />
        </button>
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/70 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition border border-white/10 z-30"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Embedded Chat Panel - Right Side */}
      {embeddedChatProps && (
        <div className={clsx(
          "absolute top-16 right-4 bg-black/85 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.15)] flex flex-col overflow-hidden z-20 transition-all duration-300",
          isChatCollapsed ? "w-12 bottom-auto" : "w-[380px] bottom-40"
        )}>
          {/* Chat Header */}
          <div className={clsx(
            "shrink-0 border-b border-cyan-500/20 bg-black/40",
            isChatCollapsed ? "px-2 py-2" : "px-4 py-3"
          )}>
            <div className="flex items-center gap-2">
              {isChatCollapsed ? (
                /* Collapsed state - just show toggle button */
                <button
                  onClick={() => setIsChatCollapsed(false)}
                  className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-lg transition"
                  title="Expand Chat"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              ) : (
                /* Expanded state */
                <>
                  <div className="w-6 h-6 flex items-center justify-center text-black bg-white rounded-md shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" x2="12" y1="22.08" y2="12" />
                    </svg>
                  </div>
                  <span className="font-bold text-sm text-white">ONYX AI</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400 font-semibold">3D VIEW</span>
                  {highlight && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-orange-500/50 bg-orange-500/20 text-orange-400 font-semibold flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-orange-400 rounded-full"></span>
                      HIGHLIGHT
                      <button
                        onClick={() => {
                          onClearHighlight?.();
                          embeddedChatProps?.onHighlight?.(null);
                        }}
                        className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-orange-500/30 hover:bg-orange-500/50 transition text-orange-300 hover:text-white"
                        title="Clear highlight"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => setIsChatCollapsed(true)}
                    className="ml-auto p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
                    title="Collapse Chat"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Chat Messages - Hidden when collapsed */}
          {!isChatCollapsed && (
            <div className={clsx("flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar scroll-smooth", embeddedChatProps.isRTL && "rtl")} dir={embeddedChatProps.isRTL ? 'rtl' : 'ltr'}>
              {embeddedChatProps.messages.map((message: Message) => (
                <ChatMessage key={message.id} message={message} isRTL={embeddedChatProps.isRTL} />
              ))}
              
              {embeddedChatProps.isLoading && (
                <div className={clsx("flex items-center gap-2", embeddedChatProps.isRTL && "flex-row-reverse")}>
                  <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                  <div className="bg-black/60 px-3 py-2 rounded-lg border border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400">{embeddedChatProps.t.analyzing}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Chat Input - Hidden when collapsed */}
          {!isChatCollapsed && (
            <div className="shrink-0 p-3 border-t border-cyan-500/20 bg-black/40">
              <div className="bg-black/60 rounded-xl px-3 py-2 flex items-center gap-2 border border-cyan-500/20 focus-within:border-cyan-500/40 transition">
                <input
                  type="text"
                  value={embeddedChatProps.input}
                  onChange={(e) => embeddedChatProps.setInput(e.target.value)}
                  onKeyPress={embeddedChatProps.handleKeyPress}
                  disabled={embeddedChatProps.isLoading}
                  dir={embeddedChatProps.isRTL ? 'rtl' : 'ltr'}
                  className={clsx(
                    "flex-1 bg-transparent border-none text-sm text-white placeholder-gray-500 focus:outline-none",
                    embeddedChatProps.isRTL && "text-right"
                  )}
                  placeholder={embeddedChatProps.t.askAboutFlight(embeddedChatProps.selectedFlight?.callsign || flightId)}
                />
                <button className="p-1.5 text-gray-500 hover:text-white transition">
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={embeddedChatProps.handleSend}
                  disabled={embeddedChatProps.isLoading || !embeddedChatProps.input.trim()}
                  className="p-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4 -rotate-45" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline and Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md rounded-xl p-4 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.2)] min-w-[600px]">
        {/* Timeline */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-cyan-400 text-sm font-mono w-24">
            {currentPoint ? formatTime(currentPoint.timestamp) : '--:--:--'}
          </span>
          <input
            type="range"
            min={0}
            max={flightData.points.length - 1}
            value={currentPointIndex}
            onChange={(e) => setCurrentPointIndex(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-gray-400 text-sm font-mono w-24 text-right">
            {flightData.points.length > 0 ? formatTime(flightData.points[flightData.points.length - 1].timestamp) : '--:--:--'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Speed buttons */}
          <div className="flex gap-1">
            {[1, 5, 10, 20, 60].map(speed => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={clsx(
                  "px-3 py-1 rounded text-sm font-medium transition",
                  playbackSpeed === speed 
                    ? "bg-cyan-500 text-black" 
                    : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPointIndex(0)}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              title="Reset"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentPointIndex(Math.max(0, currentPointIndex - 60))}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              title="Skip Back 1 min"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 rounded-full bg-cyan-500 text-black hover:bg-cyan-400 transition"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={() => setCurrentPointIndex(Math.min(flightData.points.length - 1, currentPointIndex + 60))}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              title="Skip Forward 1 min"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Point counter */}
          <div className="text-gray-400 text-sm">
            {currentPointIndex + 1} / {flightData.points.length}
          </div>
        </div>

        {/* Help text */}
        <div className="mt-3 pt-3 border-t border-white/10 text-center text-xs text-gray-500">
          <span className="mr-4">🖱️ Drag to rotate • Scroll to zoom • Right-click drag to pan</span>
          <span>⌨️ Space: Play/Pause • ←→: Skip</span>
        </div>
      </div>

      {/* View tips */}
      <div className="absolute bottom-32 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-white/10 text-xs text-gray-400 max-w-[240px]">
        <p className="font-semibold text-white mb-2">💡 Camera Modes:</p>
        <ul className="space-y-1">
          <li className="text-cyan-400">• <strong>Chase</strong>: Camera follows behind plane</li>
          <li className="text-cyan-400">• <strong>Orbit</strong>: Free rotation, drag to move</li>
          <li>• Scroll to zoom in/out</li>
          <li>• Cyan = main flight</li>
          {secondaryFlights.length > 0 && (
            <li className="text-red-400">• Red = proximity aircraft</li>
          )}
          {(highlight?.segment || highlight?.point) && (
            <li className="text-orange-400">• Orange = AI highlight</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
