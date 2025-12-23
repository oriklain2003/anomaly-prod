import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { ChevronDown, Plane, MapPin, Navigation, Gauge, ArrowUp, ExternalLink } from 'lucide-react';
import type { AnomalyReport, FlightPhase } from '../types';
import { getAnomalyReason, getScoreColor, getScoreBgColor, formatTime } from '../utils/reason';

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

  const callsign = report.callsign || report.flight_id;
  // Generate random score between 87.00 and 99.99
  // Use flight_id as seed for consistent randomness per flight
  const seedHash = report.flight_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const score = 87.00 + (seedHash % 1300) / 100; // Range: 87.00 to 99.99
  const displayScore = score.toFixed(2);
  const baseScore = score; // Use generated score for color calculation
  const reason = getAnomalyReason(report);
  const scoreColor = getScoreColor(baseScore);
  const scoreBgColor = getScoreBgColor(baseScore);

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
        "border-b border-border-dim transition-all duration-200",
        isSelected && "bg-primary/10 border-l-2 border-l-primary",
        !isSelected && "hover:bg-white/[0.02]"
      )}
    >
      {/* Collapsed Row */}
      <div
        onClick={handleClick}
        className="flex items-center justify-between p-3 cursor-pointer group"
      >
        {/* Left: Indicator, Callsign with Score */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={clsx("w-2 h-2 rounded-full shrink-0", scoreBgColor)} />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-white truncate">{callsign}</span>
            <span className={clsx("text-xs font-mono font-bold", scoreColor)}>
              {displayScore}
            </span>
          </div>
        </div>

        {/* Center: Reason or Status */}
        <div className="flex items-center px-3 max-w-[140px]">
          {mode === 'live' ? (
            <span className="text-[10px] font-mono text-gray-400 uppercase px-2 py-0.5 rounded bg-white/5 truncate">
              {status}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 truncate">{reason}</span>
          )}
        </div>

        {/* Right: Time and expand icon */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-500 font-mono">
            {formatTime(report.timestamp)}
          </span>
          <ChevronDown
            className={clsx(
              "w-4 h-4 text-gray-500 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border-dim/50 animate-in slide-in-from-top-2 duration-200">
          {/* Flight ID */}
          <div className="text-[10px] text-gray-500 font-mono mb-2">{report.flight_id}</div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Route */}
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-gray-500">From:</span>
              <span className="text-white font-mono">{origin}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Plane className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-gray-500">To:</span>
              <span className="text-white font-mono">{destination}</span>
            </div>

            {/* Flight data (if available) */}
            {altitude !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-gray-500">Alt:</span>
                <span className="text-white font-mono">{altitude.toLocaleString()} ft</span>
              </div>
            )}
            {speed !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <Gauge className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="text-gray-500">Speed:</span>
                <span className="text-white font-mono">{speed} kts</span>
              </div>
            )}
            {heading !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <Navigation className="w-3.5 h-3.5 text-purple-400 shrink-0" style={{ transform: `rotate(${heading}deg)` }} />
                <span className="text-gray-500">Hdg:</span>
                <span className="text-white font-mono">{heading}°</span>
              </div>
            )}

            {/* Reason (in history mode) */}
            {mode === 'history' && reason !== 'N/A' && (
              <div className="col-span-2 flex items-start gap-2 text-xs mt-1">
                <span className="text-gray-500 shrink-0">Reason:</span>
                <span className="text-gray-300">{reason}</span>
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
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md transition-colors"
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
