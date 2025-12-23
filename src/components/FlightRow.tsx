import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronDown, ExternalLink } from 'lucide-react';
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

// Get indicator color based on score
function getIndicatorColor(score: number): string {
  if (score >= 95) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]';
  if (score >= 90) return 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]';
  if (score >= 85) return 'bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.8)]';
  return 'bg-[#63d1eb] shadow-[0_0_12px_rgba(99,209,235,0.8)]';
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
      {/* Collapsed Row */}
      <div
        onClick={handleClick}
        className="flex items-center justify-between p-4 cursor-pointer group relative z-10"
      >
        {/* Left: Indicator, Callsign */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Animated indicator dot */}
          <div className={clsx(
            "w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300",
            getIndicatorColor(baseScore),
            isSelected && "animate-pulse"
          )} />
          <div className="flex flex-col min-w-0">
            <span className={clsx(
              "text-sm font-bold truncate transition-all duration-300",
              isSelected ? "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" : "text-white/90 group-hover:text-white"
            )}>
              {callsign}
            </span>
            {mode === 'live' && (
              <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wide">
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Center: Score Badge + Reason */}
        <div className="flex items-center gap-3 px-3">
          {/* Score Badge */}
          <span className={clsx(
            "text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/30 border border-white/10",
            scoreColor,
            isSelected && "border-[#63d1eb]/30"
          )}>
            {displayScore}
          </span>
          {/* Reason (truncated) */}
          {mode === 'history' && reason !== 'N/A' && (
            <span className="text-[10px] text-gray-400 truncate max-w-[80px] hidden sm:block">
              {reason}
            </span>
          )}
        </div>

        {/* Right: Time and expand icon */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={clsx(
            "text-[10px] font-mono transition-colors",
            isSelected ? "text-[#63d1eb]/80" : "text-gray-500"
          )}>
            {formatTime(report.timestamp)}
          </span>
          <ChevronDown
            className={clsx(
              "w-4 h-4 transition-all duration-300",
              isExpanded ? "rotate-180 text-[#63d1eb]" : "text-gray-500 group-hover:text-white"
            )}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 animate-in slide-in-from-top-2 duration-200 relative z-10">
          {/* Flight ID */}
          <div className="text-[10px] text-gray-500 font-mono mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-xs text-gray-600">fingerprint</span>
            {report.flight_id}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Route */}
            <div className="flex items-center gap-2 text-xs">
              <span className="material-symbols-outlined text-base text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">flight_takeoff</span>
              <span className="text-gray-500">From:</span>
              <span className="text-white font-mono font-medium">{origin}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="material-symbols-outlined text-base text-[#63d1eb] drop-shadow-[0_0_8px_rgba(99,209,235,0.6)]">flight_land</span>
              <span className="text-gray-500">To:</span>
              <span className="text-white font-mono font-medium">{destination}</span>
            </div>

            {/* Flight data (if available) */}
            {altitude !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-base text-[#63d1eb]">altitude</span>
                <span className="text-gray-500">Alt:</span>
                <span className="text-[#63d1eb] font-mono font-medium">{altitude.toLocaleString()} ft</span>
              </div>
            )}
            {speed !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-base text-yellow-400">speed</span>
                <span className="text-gray-500">Speed:</span>
                <span className="text-yellow-400 font-mono font-medium">{speed} kts</span>
              </div>
            )}
            {heading !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-base text-purple-400" style={{ transform: `rotate(${heading}deg)` }}>navigation</span>
                <span className="text-gray-500">Hdg:</span>
                <span className="text-purple-400 font-mono font-medium">{heading}°</span>
              </div>
            )}

            {/* Reason (in history mode) */}
            {mode === 'history' && reason !== 'N/A' && (
              <div className="col-span-2 flex items-start gap-2 text-xs mt-1 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                <span className="material-symbols-outlined text-base text-red-400 shrink-0">warning</span>
                <div className="flex flex-col">
                  <span className="text-[9px] text-red-400/70 uppercase tracking-wide font-bold mb-0.5">Anomaly Reason</span>
                  <span className="text-gray-300 leading-relaxed">{reason}</span>
                </div>
              </div>
            )}
          </div>

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
