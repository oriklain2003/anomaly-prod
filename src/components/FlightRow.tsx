import { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { ChevronDown, ExternalLink, Plane } from 'lucide-react';
import type { AnomalyReport, FlightPhase } from '../types';
import { getAnomalyReason, getScoreColor, formatTime } from '../utils/reason';

interface FlightRowProps {
  report: AnomalyReport;
  mode: 'live' | 'history';
  isSelected: boolean;
  onSelect: (report: AnomalyReport) => void;
  status?: FlightPhase;
  altitude?: number;
  speed?: number;
  heading?: number;
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
}: FlightRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div
      className={clsx(
        "mx-3 my-2 rounded-xl transition-all duration-300 relative overflow-hidden",
        isSelected 
          ? "flight-card-active" 
          : "flight-card"
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
              baseScore >= 50 ? "bg-red-500" : "bg-cyan-500",
              isSelected && "animate-pulse opacity-80"
            )} style={{ transform: 'scale(1.8)', left: '-4px', top: '-2px' }} />
            {/* Plane icon */}
            <Plane 
              className={clsx(
                "w-4 h-4 relative z-10 transform -rotate-45",
                baseScore >= 50 ? "text-red-400" : "text-cyan-400"
              )}
              style={{
                filter: baseScore >= 50 
                  ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8)) drop-shadow(0 0 12px rgba(239, 68, 68, 0.5))'
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
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider font-bold">
                High Alert
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

          {/* Reason - simple inline format like reference */}
          {mode === 'history' && reason !== 'N/A' && (
            <div className="mt-2 pt-2 border-t border-white/5 flex gap-2 items-center">
              <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
              <span className="text-xs text-gray-400">Reason:</span>
              <span className="text-xs text-white font-medium">{reason}</span>
            </div>
          )}

          {/* Open in FR24 button */}
          {fr24Url && (
            <a
              href={fr24Url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#63d1eb] bg-[#63d1eb]/10 hover:bg-[#63d1eb]/20 border border-[#63d1eb]/30 hover:border-[#63d1eb]/50 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(99,209,235,0.1)] hover:shadow-[0_0_20px_rgba(99,209,235,0.25)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in FR24
            </a>
          )}
        </div>
      )}
    </div>
  );
}
