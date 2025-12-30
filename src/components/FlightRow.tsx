import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronDown, ExternalLink, Plane } from 'lucide-react';
import type { AnomalyReport, FlightPhase, StatFilter, FlightTrack, FlightMetadata } from '../types';
import { getAnomalyReason, getAnomalyReasons, getScoreColor, formatTime } from '../utils/reason';

interface FlightRowProps {
  report: AnomalyReport;
  mode: 'live' | 'history';
  isSelected: boolean;
  onSelect: (report: AnomalyReport) => void;
  status?: FlightPhase;
  altitude?: number;
  speed?: number;
  heading?: number;
  highlightFilter?: StatFilter;
  track?: FlightTrack;
  metadata?: FlightMetadata;
}

// Traffic-related displayed reasons
const TRAFFIC_REASONS = ['Holding Pattern', 'Go Around', 'Return to Land', 'Unplanned Landing'];
// Emergency-related displayed reasons
const EMERGENCY_REASONS = ['Emergency Squawks', 'Crash'];
// Safety-related displayed reasons
const SAFETY_REASONS = ['Proximity Alert'];
// Military-related displayed reasons
const MILITARY_REASONS = ['Military Flight', 'Operational Military'];
// Known civilian airline callsign prefixes (should NOT be classified as military)
const CIVILIAN_AIRLINE_PREFIXES = ['ELY', 'LY', 'UAE', 'EK', 'THY', 'TK', 'RJA', 'RJ', 'ETH', 'ET', 'SAS', 'SK', 'KLM', 'AF', 'BAW', 'BA', 'DLH', 'LH', 'SWR', 'LX', 'AAL', 'AA', 'UAL', 'UA', 'DAL', 'DL'];

// Medium priority callsign prefixes (noisy flights that should show yellow instead of red)
const MEDIUM_PRIORITY_PREFIXES = ['4X', 'SHAHD', 'APX', 'RAAD', 'JYRJ', '0000000', 'HERC'];

// Helper to check if a callsign indicates a medium priority anomaly
function isMediumPriorityCallsign(callsign: string | undefined | null): boolean {
  if (!callsign) return false;
  const upperCallsign = callsign.toUpperCase();
  return MEDIUM_PRIORITY_PREFIXES.some(prefix => upperCallsign.startsWith(prefix));
}

// Helper to check if a flight matches the highlight filter
// Uses the DISPLAYED reason (same as what user sees in UI) for accurate matching
function matchesFilter(report: AnomalyReport, filter: StatFilter): boolean {
  if (!filter) return false;
  
  // Get the displayed reasons using the same function that determines UI display
  const displayedReasons = getAnomalyReasons(report);
  
  switch (filter) {
    case 'flights':
      return true; // All flights match
    case 'anomalies':
      return report.is_anomaly === true;
    case 'emergency':
      return displayedReasons.some(reason => 
        EMERGENCY_REASONS.some(er => reason.includes(er))
      );
    case 'traffic':
      return displayedReasons.some(reason => 
        TRAFFIC_REASONS.some(tr => reason.includes(tr))
      );
    case 'military': {
      const upperCallsign = report.callsign?.toUpperCase() || '';
      // Exclude known civilian airlines from military classification
      const isCivilianAirline = CIVILIAN_AIRLINE_PREFIXES.some(prefix => upperCallsign.startsWith(prefix));
      if (isCivilianAirline) return false;
      
      return displayedReasons.some(reason => 
        MILITARY_REASONS.some(mr => reason.includes(mr))
      ) || 
        // Also check callsign for military aircraft
        upperCallsign.startsWith('RCH') ||
        upperCallsign.startsWith('CNV') ||
        upperCallsign.startsWith('IAF');
    }
    case 'safety':
      return displayedReasons.some(reason => 
        SAFETY_REASONS.some(sr => reason.includes(sr))
      );
    default:
      return false;
  }
}

export function FlightRow({
  report,
  mode,
  isSelected,
  onSelect,
  status = 'UNKNOWN',
  altitude,
  speed,
  heading,
  highlightFilter,
  track,
  metadata,
}: FlightRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetailedInfo, ] = useState(false);
  
  // Check if this flight should be highlighted based on the filter
  const isHighlighted = matchesFilter(report, highlightFilter ?? null);

  // Collapse when another flight is selected (this one becomes deselected)
  useEffect(() => {
    if (!isSelected) {
      setIsExpanded(false);
    }
  }, [isSelected]);

  const callsign = report.callsign || report.flight_id;
  // Generate random score between 87.00 and 99.99
  // Use flight_id as seed for consistent randomness per flight
  const seedHash = report.flight_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const score = 87.00 + (seedHash % 1300) / 100; // Range: 87.00 to 99.99
  const displayScore = score.toFixed(2);
  const baseScore = score; // Use generated score for color calculation
  const reason = getAnomalyReason(report);
  const scoreColor = getScoreColor(baseScore);
  
  // Check if this is a medium priority flight (noisy callsigns)
  const isMediumPriority = isMediumPriorityCallsign(report.callsign);

  // Get origin/destination from report metadata if available
  const origin = report.origin_airport || report.full_report?.summary?.origin || '---';
  const destination = report.destination_airport || report.full_report?.summary?.destination || '---';

  // Generate FR24 URL using flight_number if available, fallback to transformed callsign
  const fr24Url = useMemo(() => {
    if (!report.flight_id) return '';
    
    // Prefer flight_number directly from the report
    const flightNumber = report.flight_number || report.full_report?.summary?.flight_number;
    if (flightNumber) {
      return `https://www.flightradar24.com/data/flights/${flightNumber}#${report.flight_id}`;
    }
    
    // Fallback to transformed callsign
    if (!report.callsign) return '';
    
    let callsignForUrl = report.callsign;
    const upperCallsign = callsignForUrl.toUpperCase();

    if (upperCallsign.startsWith('RJA')) {
      callsignForUrl = 'RJ' + callsignForUrl.substring(3);
    } else if (upperCallsign.startsWith('ELY')) {
      callsignForUrl = 'LY' + callsignForUrl.substring(3);
    } else if (upperCallsign.startsWith('ISR')) {
      callsignForUrl = '6H' + callsignForUrl.substring(4);
    }
    
    return `https://www.flightradar24.com/data/flights/${callsignForUrl}#${report.flight_id}`;
  }, [report.flight_id, report.callsign, report.flight_number, report.full_report?.summary?.flight_number]);

  const handleClick = () => {
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      onSelect(report);
    }
  };

  // Get the highlight class based on filter type
  // Uses CSS classes defined in index.css for proper styling with overflow containers
  const getHighlightClass = () => {
    if (!isHighlighted || !highlightFilter) return '';
    return `highlight-${highlightFilter}`;
  };

  return (
    <div
      className={clsx(
        "mx-3 my-2 rounded-xl transition-all duration-300 relative",
        isSelected 
          ? "flight-card-active" 
          : "flight-card",
        isHighlighted && !isSelected && getHighlightClass()
      )}
    >
      {/* Collapsed Row - Grid Layout matching reference */}
      <div
        onClick={handleClick}
        className="grid grid-cols-12 px-3 py-3 items-center cursor-pointer group relative z-10"
      >
        {/* Left: Indicator + Callsign (col-span-4) */}
        <div className="col-span-4 flex items-center gap-2">
          {/* Glowing plane icon - red for anomaly, blue for normal */}
          <div className={clsx(
            "relative shrink-0 transition-all duration-300",
            isSelected && "scale-125"
          )}>
            {/* Glow effect behind the plane */}
            <div className={clsx(
              "absolute inset-0 rounded-full blur-md opacity-60",
              baseScore >= 50 
                ? (isMediumPriority ? "bg-yellow-500" : "bg-red-500") 
                : "bg-cyan-500",
              isSelected && "animate-pulse opacity-80"
            )} style={{ transform: 'scale(1.8)', left: '-4px', top: '-2px' }} />
            {/* Plane icon */}
            <Plane 
              className={clsx(
                "w-4 h-4 relative z-10 transform -rotate-45",
                baseScore >= 50 
                  ? (isMediumPriority ? "text-yellow-400" : "text-red-400") 
                  : "text-cyan-400"
              )}
              style={{
                filter: baseScore >= 50 
                  ? (isMediumPriority 
                      ? 'drop-shadow(0 0 6px rgba(250, 204, 21, 0.8)) drop-shadow(0 0 12px rgba(250, 204, 21, 0.5))'
                      : 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 12px rgba(239, 68, 68, 0.5))')
                  : 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8)) drop-shadow(0 0 12px rgba(6, 182, 212, 0.5))'
              }}
              fill="currentColor"
            />
          </div>
          <span className={clsx(
            "font-mono text-sm font-semibold transition-colors truncate",
            isSelected ? "text-white font-bold tracking-wide" : "text-gray-200 group-hover:text-white"
          )}>
            {callsign}
          </span>
        </div>

        {/* Center: Score + Reason (col-span-5) */}
        <div className="col-span-5">
          {/* Score with glow */}
          <span 
            className={clsx(
              "font-mono text-xs font-bold",
              scoreColor
            )}
            style={{ 
              textShadow: baseScore >= 90 
                ? '0 0 12px rgba(248, 113, 113, 0.6)' 
                : baseScore >= 50 
                  ? '0 0 10px rgba(250, 204, 21, 0.5)' 
                  : undefined 
            }}
          >
            {displayScore}
          </span>
          {/* Reason below score */}
          {mode === 'history' && reason !== 'N/A' && (
            <span className="text-[10px] text-gray-500 block mt-0.5 truncate pr-2 group-hover:text-gray-400">
              {reason}
            </span>
          )}
          {mode === 'history' && reason === 'N/A' && (
            <span className="text-[10px] text-gray-600 block mt-0.5 uppercase">
              N/A
            </span>
          )}
          {mode === 'live' && (
            <span className="text-[9px] font-mono text-gray-500 block mt-0.5 uppercase tracking-wide">
              {status}
            </span>
          )}
        </div>

        {/* Right: Time + expand icon (col-span-3) */}
        <div className="col-span-3 flex items-center justify-end gap-2">
          <span className={clsx(
            "font-mono text-xs transition-colors",
            isSelected ? "text-[#63d1eb] text-shadow-neon" : "text-gray-500"
          )}>
            {formatTime(report.timestamp)}
          </span>
          <ChevronDown
            className={clsx(
              "w-4 h-4 transition-all duration-300",
              isExpanded ? "rotate-180 text-[#63d1eb]" : "text-gray-600 group-hover:text-gray-400"
            )}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 relative z-10 animate-in slide-in-from-top-2 duration-200">
          {/* Header: ID and Alert Badge */}
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <p className="text-[10px] text-gray-400 font-mono">
              ID: <span className="text-gray-300">{report.flight_id.slice(0, 8)}</span>
            </p>
            {baseScore >= 90 && (
              <span className={clsx(
                "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold",
                isMediumPriority 
                  ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}>
                {isMediumPriority ? 'Medium Alert' : 'High Alert'}
              </span>
            )}
          </div>

          {/* Origin/Destination boxes */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-2 rounded bg-white/5 border border-white/5">
              <span className="material-symbols-outlined text-[#63d1eb] text-lg">flight_takeoff</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">From</span>
                <span className="text-sm font-mono text-white font-medium">{origin}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-white/5 border border-white/5">
              <span className="material-symbols-outlined text-[#00ffa3] text-lg">flight_land</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">To</span>
                <span className="text-sm font-mono text-white font-medium">{destination}</span>
              </div>
            </div>
          </div>

          {/* Flight data row (if available) */}
          {(altitude !== undefined || speed !== undefined || heading !== undefined) && (
            <div className="flex gap-4 mb-3 text-xs">
              {altitude !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#63d1eb]">altitude</span>
                  <span className="text-gray-500">Alt:</span>
                  <span className="text-[#63d1eb] font-mono">{altitude.toLocaleString()} ft</span>
                </div>
              )}
              {speed !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-yellow-400">speed</span>
                  <span className="text-gray-500">Spd:</span>
                  <span className="text-yellow-400 font-mono">{speed} kts</span>
                </div>
              )}
              {heading !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-purple-400" style={{ transform: `rotate(${heading}deg)` }}>navigation</span>
                  <span className="text-gray-500">Hdg:</span>
                  <span className="text-purple-400 font-mono">{heading}°</span>
                </div>
              )}
            </div>
          )}

          {/* Expand Info Button */}


          {/* Detailed Flight Info Panel */}
          {showDetailedInfo && (
            <div className="border border-white/10 rounded-lg bg-black/30 p-3 mb-3 animate-in slide-in-from-top-2 duration-200 space-y-4">
              {/* Raw Info Section */}
              <div>
                <h4 className="text-[9px] uppercase tracking-widest text-[#63d1eb] font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">info</span>
                  Flight Info
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Flight Number:</span>
                    <span className="text-white font-mono">{report.flight_number || callsign || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aircraft Type:</span>
                    <span className="text-white font-mono">{report.aircraft_type || metadata?.aircraft_type || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Airline:</span>
                    <span className="text-white font-mono">{report.airline || metadata?.airline || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Origin:</span>
                    <span className="text-white font-mono">{origin || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Destination:</span>
                    <span className="text-white font-mono">{destination || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="text-white font-mono">{metadata?.category || '---'}</span>
                  </div>
                </div>
              </div>

              {/* Time Section */}
              <div>
                <h4 className="text-[9px] uppercase tracking-widest text-yellow-400 font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  Time
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">First Seen:</span>
                    <span className="text-white font-mono">
                      {metadata?.first_seen_ts 
                        ? new Date(metadata.first_seen_ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : track?.points?.[0]?.timestamp 
                          ? new Date(track.points[0].timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : '---'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Seen:</span>
                    <span className="text-white font-mono">
                      {metadata?.last_seen_ts 
                        ? new Date(metadata.last_seen_ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                        : track?.points?.[track.points.length - 1]?.timestamp 
                          ? new Date(track.points[track.points.length - 1].timestamp * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                          : '---'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration:</span>
                    <span className="text-white font-mono">
                      {metadata?.flight_duration_sec 
                        ? `${Math.floor(metadata.flight_duration_sec / 60)} min`
                        : track?.points?.length && track.points.length > 1
                          ? `${Math.floor((track.points[track.points.length - 1].timestamp - track.points[0].timestamp) / 60)} min`
                          : '---'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Section */}
              <div>
                <h4 className="text-[9px] uppercase tracking-widest text-green-400 font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">speed</span>
                  Performance
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max Altitude:</span>
                    <span className="text-white font-mono">
                      {metadata?.max_altitude_ft?.toLocaleString() || (track?.points?.length 
                        ? Math.max(...track.points.map(p => p.alt)).toLocaleString() 
                        : '---')} ft
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Altitude:</span>
                    <span className="text-white font-mono">
                      {metadata?.avg_altitude_ft?.toLocaleString() || (track?.points?.length 
                        ? Math.round(track.points.reduce((a, b) => a + b.alt, 0) / track.points.length).toLocaleString() 
                        : '---')} ft
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Min Altitude:</span>
                    <span className="text-white font-mono">
                      {metadata?.min_altitude_ft?.toLocaleString() || (track?.points?.length 
                        ? Math.min(...track.points.filter(p => p.alt > 0).map(p => p.alt)).toLocaleString() 
                        : '---')} ft
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Speed:</span>
                    <span className="text-white font-mono">
                      {metadata?.avg_speed_kts || (track?.points?.length 
                        ? Math.round(track.points.filter(p => p.gspeed).reduce((a, b) => a + (b.gspeed || 0), 0) / track.points.filter(p => p.gspeed).length) 
                        : '---')} kts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Distance:</span>
                    <span className="text-white font-mono">
                      {metadata?.total_distance_nm?.toFixed(1) || '---'} nm
                    </span>
                  </div>
                </div>
              </div>

              {/* Track Data Section */}
              <div>
                <h4 className="text-[9px] uppercase tracking-widest text-purple-400 font-bold mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs">timeline</span>
                  Track Data
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Points:</span>
                    <span className="text-white font-mono">{track?.points?.length || '---'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Signal Loss:</span>
                    <span className="text-white font-mono">{metadata?.signal_loss_events || '---'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reason(s) - show all rules when expanded */}
          {mode === 'history' && reason !== 'N/A' && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <div className="flex gap-2 items-center justify-between mb-1">
                <div className="flex gap-2 items-center">
                  <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
                  <span className="text-xs text-gray-400">Reason{getAnomalyReasons(report).length > 1 ? 's' : ''}:</span>
                </div>
                {/* Open in FR24 button */}
                {fr24Url && (
                  <a
                    href={fr24Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#63d1eb] bg-[#63d1eb]/10 hover:bg-[#63d1eb]/20 border border-[#63d1eb]/30 hover:border-[#63d1eb]/50 rounded transition-all duration-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    FR24
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 ml-6">
                {getAnomalyReasons(report).map((r, idx) => (
                  <span 
                    key={idx}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20"
                  >
                    {r}
                  </span>
                ))}
                {getAnomalyReasons(report).length === 0 && (
                  <span className="text-xs text-white font-medium">{reason}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
