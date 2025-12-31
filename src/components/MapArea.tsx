import { useState, useMemo, useEffect } from 'react';
import { MapComponent } from './MapComponent';
import { MapControls, type MapLayer } from './MapControls';
import { Plus, Minus, X, ChevronRight, Info, AlertTriangle, Loader2 } from 'lucide-react';
import type { SelectedFlight, HighlightState, TrackPoint, FlightMetadata } from '../types';
import { fetchReplayOtherFlight } from '../api';
import clsx from 'clsx';

// Extract proximity flight info from selected flight report
interface ProximityFlightInfo {
  other_flight_id: string;
  other_callsign?: string;
  distance_nm?: number;
  altitude_diff_ft?: number;
  timestamp?: number;
  lat?: number;
  lon?: number;
}

// Full data for the other flight (fetched from API)
interface OtherFlightData {
  flight_id: string;
  callsign: string | null;
  points: TrackPoint[];
  metadata: FlightMetadata | null;
  source: string;
}

interface MapAreaProps {
  selectedFlight: SelectedFlight | null;
  mode?: 'live' | 'history' | 'ai';
  onFlightClick?: (flightId: string, isAnomaly: boolean, callsign?: string, origin?: string, destination?: string) => void;
  highlight?: HighlightState | null;
  onClearHighlight?: () => void;
}

export function MapArea({ selectedFlight, mode = 'history', onFlightClick, highlight, onClearHighlight }: MapAreaProps) {
  const [mouseCoords, setMouseCoords] = useState({ lat: 32.4412, lon: 35.8912, elv: 890 });
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(['track', 'anomalies']);
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [showExpandedInfo, setShowExpandedInfo] = useState(false);
  const [showProximityExpandedInfo, setShowProximityExpandedInfo] = useState(false);
  const [otherFlightData, setOtherFlightData] = useState<OtherFlightData | null>(null);
  const [otherFlightLoading, setOtherFlightLoading] = useState(false);

  // Extract proximity flight info from selected flight's report
  const proximityFlight = useMemo((): ProximityFlightInfo | null => {
    if (!selectedFlight?.report?.full_report) return null;
    
    const fullReport = selectedFlight.report.full_report;
    
    // Check multiple locations for matched rules
    const possibleRuleSources = [
      fullReport.matched_rules,
      fullReport.layer_1_rules?.report?.matched_rules,
      (fullReport as Record<string, unknown>).rules && 
        ((fullReport as Record<string, unknown>).rules as { matched_rules?: unknown[] })?.matched_rules,
    ];
    
    for (const rules of possibleRuleSources) {
      if (!Array.isArray(rules)) continue;
      
      for (const rule of rules) {
        // Proximity rule can be id 4 or name contains "proximity"
        const isProximityRule = rule.id === 4 || rule.name?.toLowerCase().includes('proximity');
        
        if (isProximityRule) {
          console.log('[MapArea] Found proximity rule:', rule);
          
          if (rule.details?.events?.length > 0) {
            // Find the event with the lowest altitude difference (closest vertical separation)
            const events = rule.details.events as Array<{
              other_flight?: string;
              other_flight_id?: string;
              other_callsign?: string;
              distance_nm?: number;
              altitude_diff_ft?: number;
              timestamp?: number;
              lat?: number;
              lon?: number;
            }>;
            
            // Sort by absolute altitude difference and pick the closest one
            const sortedEvents = [...events]
              .filter(ev => {
                const otherId = ev.other_flight || ev.other_flight_id;
                return otherId && otherId !== selectedFlight.flight_id && otherId !== 'UNKNOWN';
              })
              .sort((a, b) => {
                const altDiffA = Math.abs(a.altitude_diff_ft || Infinity);
                const altDiffB = Math.abs(b.altitude_diff_ft || Infinity);
                return altDiffA - altDiffB;
              });
            
            if (sortedEvents.length > 0) {
              const ev = sortedEvents[0]; // Get the event with lowest altitude difference
              const otherId = ev.other_flight || ev.other_flight_id;
              
              console.log('[MapArea] Selected closest proximity event (lowest alt diff):', ev);
              
              return {
                other_flight_id: otherId!,
                other_callsign: ev.other_callsign,
                distance_nm: ev.distance_nm,
                altitude_diff_ft: ev.altitude_diff_ft,
                timestamp: ev.timestamp,
                lat: ev.lat,
                lon: ev.lon,
              };
            }
          }
        }
      }
    }
    
    return null;
  }, [selectedFlight]);

  // Fetch full data for the other flight when proximity is detected
  useEffect(() => {
    if (!proximityFlight?.other_flight_id) {
      setOtherFlightData(null);
      setShowProximityExpandedInfo(false);
      return;
    }

    const fetchOtherFlight = async () => {
      setOtherFlightLoading(true);
      try {
        const data = await fetchReplayOtherFlight(proximityFlight.other_flight_id);
        setOtherFlightData({
          flight_id: data.flight_id,
          callsign: data.callsign,
          points: data.points,
          metadata: data.metadata,
          source: data.source,
        });
      } catch (err) {
        setOtherFlightData(null);
      } finally {
        setOtherFlightLoading(false);
      }
    };

    fetchOtherFlight();
  }, [proximityFlight?.other_flight_id]);

  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  };

  // Close dropdowns when clicking on map
  const handleMapClick = () => {
    setShowLayersDropdown(false);
  };

  return (
    <>
      {/* Map Background */}
      <div className="absolute inset-0 bg-black z-0" onClick={handleMapClick}>
        {/* MapLibre Map */}
        <MapComponent 
          onMouseMove={setMouseCoords} 
          selectedFlight={selectedFlight}
          activeLayers={activeLayers}
          mode={mode}
          onFlightClick={onFlightClick}
          highlight={highlight}
        />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 map-grid opacity-10 pointer-events-none" />
      </div>

      {/* AI Highlight Indicator - Top Center */}
      {(highlight?.segment || highlight?.point) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-md border border-orange-500/50 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <span className="text-orange-400 text-sm font-semibold">
               AI Highlight Active
            </span>
            <button
              onClick={onClearHighlight}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-orange-500/30 hover:bg-orange-500/50 transition text-orange-300 hover:text-white"
              title="Dismiss highlight"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <MapControls 
          activeLayers={activeLayers}
          onLayerToggle={toggleLayer}
          showLayersDropdown={showLayersDropdown}
          setShowLayersDropdown={setShowLayersDropdown}
        />
        
        {/* Separator */}
        <div className="h-2" />
        
        {/* Zoom Controls */}
        <div className="flex flex-col gap-0.5">
          <button className="liquid-glass w-8 h-8 flex items-center justify-center rounded-t-md text-gray-300 hover:text-white transition-colors border-b-0">
            <Plus className="w-4 h-4" />
          </button>
          <button className="liquid-glass w-8 h-8 flex items-center justify-center rounded-b-md text-gray-300 hover:text-white transition-colors">
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Flight Info Card (Top Left) */}
      {selectedFlight && (() => {
        // Get altitude and speed from various sources
        const altFt = selectedFlight.status?.altitude_ft 
          || (selectedFlight.track?.points?.length ? selectedFlight.track.points[selectedFlight.track.points.length - 1]?.alt : null)
          || selectedFlight.report?.full_report?.summary?.altitude;
        const spdKts = selectedFlight.status?.speed_kts 
          || (selectedFlight.track?.points?.length ? selectedFlight.track.points[selectedFlight.track.points.length - 1]?.gspeed : null)
          || selectedFlight.report?.full_report?.summary?.speed;
        const aircraftType = selectedFlight.report?.aircraft_type || selectedFlight.report?.full_report?.summary?.aircraft_type || '---';
        console.log(selectedFlight);
        const statusText = selectedFlight.status?.status || (mode === 'live' ? 'ACTIVE' : 'REPLAY');
        
        return (
          <div className="absolute top-4 left-4 z-20">
            <div className="liquid-glass rounded-lg p-4 w-64 text-xs shadow-[0_0_20px_rgba(99,209,235,0.4),0_0_40px_rgba(99,209,235,0.2)] border border-[#63d1eb]/30">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-[#63d1eb]/10 border border-[#63d1eb]/40 p-2 rounded-md text-[#63d1eb]">
                  <span className="material-symbols-outlined text-lg">flight</span>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white font-mono">
                    {selectedFlight.callsign || selectedFlight.flight_id.slice(0, 7)}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                    <span className={clsx(
                      "px-1.5 py-0.5 rounded border",
                      statusText === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40" :
                      statusText === 'REPLAY' ? "bg-purple-500/10 text-purple-400 border-purple-500/40" :
                      "bg-gray-500/10 text-gray-400 border-gray-500/40"
                    )}>
                      {statusText}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-300">{aircraftType}</span>
                  </div>
                </div>
              </div>
              
              {/* Origin / Destination */}
              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9px] text-[#63d1eb]/70 font-mono uppercase tracking-wider">Origin</p>
                  <p className="text-sm font-bold text-white">{selectedFlight.origin || '---'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-[#63d1eb]/70 font-mono uppercase tracking-wider">Dest</p>
                  <p className="text-sm font-bold text-white">{selectedFlight.destination || '---'}</p>
                </div>
              </div>
              
              {/* Flight stats */}
              <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-gray-300">
                <span>ALT: <span className="text-[#63d1eb]">
                  {altFt != null ? `${altFt.toLocaleString()}ft` : '---'}
                </span></span>
                <span>SPD: <span className="text-yellow-400">
                  {spdKts != null ? `${Math.round(spdKts)}kts` : '---'}
                </span></span>
              </div>

              {/* Expand Info Button */}
              <button
                onClick={() => setShowExpandedInfo(!showExpandedInfo)}
                className="w-full mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold text-[#63d1eb] bg-[#63d1eb]/10 hover:bg-[#63d1eb]/20 border border-[#63d1eb]/30 hover:border-[#63d1eb]/50 rounded transition-all"
              >
                <Info className="w-3 h-3" />
                <span>Expand Info</span>
                <ChevronRight className={clsx("w-3 h-3 transition-transform", showExpandedInfo && "rotate-90")} />
              </button>

              {/* Expanded Flight Info */}
              {showExpandedInfo && (() => {
                const points = selectedFlight.track?.points || [];
                const report = selectedFlight.report;
                const fullReport = report?.full_report;
                const summary = fullReport?.summary;
                
                // Calculate values from track data
                const firstSeen = points.length ? new Date(points[0].timestamp * 1000) : null;
                const lastSeen = points.length ? new Date(points[points.length - 1].timestamp * 1000) : null;
                const durationMs = firstSeen && lastSeen ? lastSeen.getTime() - firstSeen.getTime() : 0;
                const durationMins = Math.round(durationMs / 60000);
                const altitudes = points.map(p => p.alt).filter(a => a != null && a > 0);
                const speeds = points.map(p => p.gspeed).filter((s): s is number => s != null && s > 0);
                const maxAlt = altitudes.length ? Math.max(...altitudes) : null;
                const avgAlt = altitudes.length ? Math.round(altitudes.reduce((a, b) => a + b, 0) / altitudes.length) : null;
                const cruiseAlt = altitudes.length ? Math.round(altitudes.slice(Math.floor(altitudes.length * 0.3), Math.floor(altitudes.length * 0.7)).reduce((a, b, _, arr) => a + b / arr.length, 0) || avgAlt || 0) : null;
                const minSpeed = speeds.length ? Math.min(...speeds) : null;
                const maxSpeed = speeds.length ? Math.max(...speeds) : null;
                
                // Calculate total distance (haversine formula)
                const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                  const R = 3440.065; // Nautical miles
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                };
                let totalDistance = 0;
                for (let i = 1; i < points.length; i++) {
                  totalDistance += calcDistance(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
                }
                
                // Get squawk codes - prefer from report metadata, fallback to track
                const reportSquawks = report?.squawk_codes?.split(',').filter(s => s && s !== '0000') || [];
                const trackSquawks = [...new Set(points.map(p => p.squawk).filter((s): s is string => !!s && s !== '0000'))];
                const squawkCodes = reportSquawks.length > 0 ? reportSquawks : trackSquawks;
                const emergencySquawks = squawkCodes.filter(s => ['7500', '7600', '7700'].includes(s));
                const hasEmergency = report?.emergency_squawk_detected || emergencySquawks.length > 0;
                
                // Get flight number from multiple sources (report top-level > summary > callsign)
                const flightNumber = report?.flight_number || summary?.flight_number || selectedFlight.callsign || '---';
                
                // Get airline from multiple sources (report top-level > summary)
                const airline = report?.airline || summary?.airline || '---';
                
                // Get category from multiple sources (report top-level > summary)
                const category = report?.category || summary?.category || '';
                
                // Get aircraft registration (report top-level > summary)
                const registration = report?.aircraft_registration || summary?.aircraft_registration || '---';
                
                // Get is_military flag (report top-level > summary)
                const isMilitaryFlag = report?.is_military || summary?.is_military || false;
                
                // Determine if this is a military flight for display purposes:
                // - If category exists and contains "military" (case insensitive), it's military
                // - If category is empty/missing AND is_military flag is set, show "Military"
                const categoryLower = category.toLowerCase();
                const isMilitaryCategory = categoryLower.includes('military');
                const showAsMilitary = isMilitaryCategory || (!category && isMilitaryFlag);
                console.log('category', selectedFlight);
                const displayCategory = category || (isMilitaryFlag ? 'Military' : '---');
                
                // Use pre-computed values from metadata (report top-level > summary > calculated)
                const metaMaxAlt = report?.max_altitude_ft || summary?.max_altitude_ft;
                const metaAvgAlt = report?.avg_altitude_ft || summary?.avg_altitude_ft;
                // Note: min_altitude_ft available as report?.min_altitude_ft if needed
                const metaTotalDistance = report?.total_distance_nm || summary?.total_distance_nm;
                const metaAvgSpeed = report?.avg_speed_kts || summary?.avg_speed_kts;
                const metaMaxSpeed = report?.max_speed_kts || summary?.max_speed_kts;
                const metaMinSpeed = report?.min_speed_kts || summary?.min_speed_kts;
                const schedDep = report?.scheduled_departure || summary?.scheduled_departure;
                const schedArr = report?.scheduled_arrival || summary?.scheduled_arrival;
                
                return (
                  <div className="mt-3 pt-3 border-t border-white/10 animate-in slide-in-from-top-2 duration-200 max-h-[500px] overflow-y-auto no-scrollbar">
                    {/* Flight Info Section */}
                    <div className="mb-3">
                      <h4 className="text-[9px] uppercase tracking-widest text-[#63d1eb] font-semibold mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px]">info</span>
                        Flight Info
                      </h4>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Flight #:</span>
                          <span className="text-white font-mono">{flightNumber}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Airline:</span>
                          <span className="text-white font-mono">{airline}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Category:</span>
                          <span className={clsx("font-mono", showAsMilitary ? "text-orange-400" : "text-white")}>
                            {displayCategory}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Registration:</span>
                          <span className="text-white font-mono">{registration}</span>
                        </div>
                      </div>
                    </div>

                    {/* Time Section */}
                    <div className="mb-3 pt-2 border-t border-white/5">
                      <h4 className="text-[9px] uppercase tracking-widest text-yellow-400 font-semibold mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        Time
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <div>
                          <span className="text-gray-500">First Seen:</span>
                          <span className="text-white font-mono ml-1">
                            {firstSeen ? firstSeen.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Seen:</span>
                          <span className="text-white font-mono ml-1">
                            {lastSeen ? lastSeen.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Duration:</span>
                          <span className="text-white font-mono ml-1">{durationMins > 0 ? `${durationMins}min` : '---'}</span>
                        </div>

                      </div>
                      <div className="text-[10px] mt-1">
                      <div>
                          <span className="text-gray-500">Sched Dep:</span>
                          <span className="text-white font-mono ml-1">
                            {schedDep ? new Date(schedDep).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                          </span>
                        </div>
                        <span className="text-gray-500">Sched Arr:</span>
                        <span className="text-white font-mono ml-1">
                          {schedArr ? new Date(schedArr).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                        </span>
                      </div>
                    </div>

                    {/* Performance Section */}
                    <div className="mb-3 pt-2 border-t border-white/5">
                      <h4 className="text-[9px] uppercase tracking-widest text-green-400 font-semibold mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px]">speed</span>
                        Performance
                      </h4>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <div>
                          <span className="text-gray-500">Max Alt:</span>
                          <span className="text-white font-mono ml-1">{(metaMaxAlt || maxAlt) ? `${(metaMaxAlt || maxAlt)!.toLocaleString()}ft` : '---'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Alt:</span>
                          <span className="text-white font-mono ml-1">{(metaAvgAlt || avgAlt) ? `${Math.round(metaAvgAlt || avgAlt!).toLocaleString()}ft` : '---'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Cruise Alt:</span>
                          <span className="text-white font-mono ml-1">{cruiseAlt ? `${cruiseAlt.toLocaleString()}ft` : '---'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Min Speed:</span>
                          <span className="text-white font-mono ml-1">{(metaMinSpeed || minSpeed) ? `${Math.round(metaMinSpeed || minSpeed!)}kts` : '---'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Max Speed:</span>
                          <span className="text-white font-mono ml-1">{(metaMaxSpeed || maxSpeed) ? `${Math.round(metaMaxSpeed || maxSpeed!)}kts` : '---'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg Speed:</span>
                          <span className="text-white font-mono ml-1">{metaAvgSpeed ? `${Math.round(metaAvgSpeed)}kts` : '---'}</span>
                        </div>
                      </div>
                      <div className="text-[10px] mt-1">
                        <span className="text-gray-500">Distance:</span>
                        <span className="text-white font-mono ml-1">{(metaTotalDistance || totalDistance > 0) ? `${Math.round(metaTotalDistance || totalDistance)}nm` : '---'}</span>
                      </div>
                    </div>

                    {/* Track Data Section */}
                    <div className="pt-2 border-t border-white/5">
                      <h4 className="text-[9px] uppercase tracking-widest text-purple-400 font-semibold mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[11px]">route</span>
                        Track Data
                      </h4>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <span className="text-gray-500 block text-[9px]">Squawks</span>
                          <span className="text-white font-mono" title={squawkCodes.join(', ')}>
                            {squawkCodes.length > 0 ? squawkCodes.slice(0, 2).join(', ') : '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[9px]">Emergency</span>
                          <span className={clsx("font-mono", hasEmergency ? "text-red-400" : "text-white")}>
                            {hasEmergency ? (emergencySquawks.length > 0 ? emergencySquawks.join(', ') : 'Yes') : 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[9px]">Total Pts</span>
                          <span className="text-white font-mono">{report?.total_points || points.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Proximity Flight Card - Only shown for proximity rules */}
      {selectedFlight && proximityFlight && (() => {
        // Get data from fetched flight or fallback to proximity event data
        const points = otherFlightData?.points || [];
        const metadata = otherFlightData?.metadata;
        const callsign = otherFlightData?.callsign || proximityFlight.other_callsign || proximityFlight.other_flight_id.slice(0, 7);
        
        // Calculate values from track data
        // const lastPoint = points.length ? points[points.length - 1] : null;
        // const altFt = lastPoint?.alt || metadata?.max_altitude_ft;
        const aircraftType = metadata?.aircraft_type || '---';
        
        return (
          <div className="absolute top-4 left-[280px] z-20">
            <div className="liquid-glass rounded-lg p-3 w-52 text-xs shadow-[0_0_15px_rgba(239,68,68,0.3)] border border-red-500/30">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-500/10 border border-red-500/40 p-1.5 rounded text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-white font-mono truncate">
                      {callsign}
                    </h2>
                    {otherFlightLoading && (
                      <Loader2 className="w-3 h-3 text-red-400 animate-spin shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] mt-0.5">
                    <span className="px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
                      CONFLICT
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-400">{aircraftType}</span>
                  </div>
                </div>
              </div>
              
              {/* Route */}
              <div className="flex items-center justify-between text-[10px] border-t border-white/10 pt-2">
                <span className="font-mono text-white">{metadata?.origin_airport || '---'}</span>
                <span className="text-gray-500 text-[8px]">→</span>
                <span className="font-mono text-white">{metadata?.destination_airport || '---'}</span>
                <span className="text-gray-500 mx-1"></span>
                {/* <span className="text-red-400 font-mono">{altFt != null ? `${(altFt/1000).toFixed(1)}k` : '---'}</span> */}
              </div>

              {/* Proximity Alert - Compact */}
              <div className="mt-2 p-1.5 bg-red-500/10 border border-red-500/30 rounded">
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dist:</span>
                    <span className={clsx(
                      "font-mono font-semibold",
                      proximityFlight.distance_nm && proximityFlight.distance_nm < 3 ? "text-red-400" : "text-yellow-400"
                    )}>
                      {proximityFlight.distance_nm?.toFixed(1) || '---'}nm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Alt Δ:</span>
                    <span className={clsx(
                      "font-mono font-semibold",
                      proximityFlight.altitude_diff_ft && Math.abs(proximityFlight.altitude_diff_ft) < 1000 ? "text-red-400" : "text-yellow-400"
                    )}>
                      {proximityFlight.altitude_diff_ft ? `${Math.abs(proximityFlight.altitude_diff_ft).toLocaleString()}ft` : '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expand Info Button */}
              <button
                onClick={() => setShowProximityExpandedInfo(!showProximityExpandedInfo)}
                className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-all"
              >
                <Info className="w-2.5 h-2.5" />
                <span>More</span>
                <ChevronRight className={clsx("w-2.5 h-2.5 transition-transform", showProximityExpandedInfo && "rotate-90")} />
              </button>

              {/* Expanded Flight Info */}
              {showProximityExpandedInfo && (() => {
                // Calculate values from track data
                const firstSeen = points.length ? new Date(points[0].timestamp * 1000) : null;
                const lastSeen = points.length ? new Date(points[points.length - 1].timestamp * 1000) : null;
                const durationMs = firstSeen && lastSeen ? lastSeen.getTime() - firstSeen.getTime() : 0;
                const durationMins = Math.round(durationMs / 60000);
                const altitudes = points.map(p => p.alt).filter(a => a != null && a > 0);
                const maxAlt = altitudes.length ? Math.max(...altitudes) : null;
                
                // Calculate total distance (haversine formula)
                const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                  const R = 3440.065; // Nautical miles
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLon = (lon2 - lon1) * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                };
                let totalDistance = 0;
                for (let i = 1; i < points.length; i++) {
                  totalDistance += calcDistance(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
                }
                
                // Get squawk codes from track
                const squawkCodes = [...new Set(points.map(p => p.squawk).filter((s): s is string => !!s && s !== '0000'))];
                
                // Use metadata values
                const airline = metadata?.airline || '---';
                const proxCategory = metadata?.category || '';
                const proxIsMilitaryFlag = metadata?.is_military || false;
                
                // Same logic: show category if available, only show "Military" if no category and is_military flag set
                const proxCategoryLower = proxCategory.toLowerCase();
                const proxIsMilitaryCategory = proxCategoryLower.includes('military');
                const proxShowAsMilitary = proxIsMilitaryCategory || (!proxCategory && proxIsMilitaryFlag);
                const proxDisplayCategory = proxCategory || (proxIsMilitaryFlag ? 'Military' : '---');
                
                const metaMaxAlt = metadata?.max_altitude_ft;
                const metaTotalDistance = metadata?.total_distance_nm;
                const metaAvgSpeed = metadata?.avg_speed_kts;
                
                return (
                  <div className="mt-2 pt-2 border-t border-white/10 animate-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto no-scrollbar">
                    {/* Compact Info Grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Airline:</span>
                        <span className="text-white font-mono">{airline}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Category:</span>
                        <span className={clsx("font-mono", proxShowAsMilitary ? "text-orange-400" : "text-white")}>
                          {proxDisplayCategory}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration:</span>
                        <span className="text-white font-mono">{durationMins > 0 ? `${durationMins}min` : '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Distance:</span>
                        <span className="text-white font-mono">{(metaTotalDistance || totalDistance > 0) ? `${Math.round(metaTotalDistance || totalDistance)}nm` : '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max Alt:</span>
                        <span className="text-white font-mono">{(metaMaxAlt || maxAlt) ? `${(metaMaxAlt || maxAlt)!.toLocaleString()}ft` : '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Spd:</span>
                        <span className="text-white font-mono">{metaAvgSpeed ? `${Math.round(metaAvgSpeed)}kts` : '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Squawks:</span>
                        <span className="text-white font-mono">{squawkCodes.length > 0 ? squawkCodes[0] : '---'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Points:</span>
                        <span className="text-white font-mono">{points.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Bottom Info Bar - Coordinates (Left) */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center space-x-4 text-[10px] font-mono text-gray-300">
          <span className="text-white font-bold border-r border-white/20 pr-3 tracking-widest">MAP DATA</span>
          <span className="tabular-nums">LAT: <span className="text-[#63d1eb]">{mouseCoords.lat.toFixed(4)} N</span></span>
          <span className="tabular-nums">LON: <span className="text-[#63d1eb]">{mouseCoords.lon.toFixed(4)} E</span></span>
          <span className="tabular-nums">ELV: <span className="text-[#63d1eb]">{mouseCoords.elv}m</span></span>
        </div>
      </div>

      {/* Bottom Legend - Right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center space-x-4 text-[10px] font-medium text-gray-300">
          {activeLayers.includes('anomalies') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span>Anomaly</span>
            </div>
          )}
          {activeLayers.includes('track') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#63d1eb] shadow-[0_0_6px_rgba(99,209,235,0.8)]" />
              <span>Track</span>
            </div>
          )}
          {activeLayers.includes('paths') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <span>Safe</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
