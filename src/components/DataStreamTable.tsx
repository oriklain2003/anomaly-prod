import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, X, Sparkles } from 'lucide-react';
import type { AnomalyReport, FlightStatus, SelectedFlight, StatFilter } from '../types';
import { FlightRow } from './FlightRow';
import { fetchLiveAnomalies, fetchSystemReports, fetchFlightStatus, fetchUnifiedTrack, fetchSystemReportTrack, fetchLiveAnomaliesSince, fetchLiveResearchTrack } from '../api';
import { getAnomalyReasons } from '../utils/reason';

// Stats calculated from displayed reasons (matches glow logic)
export interface CalculatedStats {
  anomalies: number;
  emergency: number;
  traffic: number;
  military: number;
  safety: number;
  totalFlights: number; // Total count of all flights
}

// Reason categories for stats calculation (must match FlightRow highlighting logic)
const TRAFFIC_REASONS = ['Holding Pattern', 'Go Around', 'Return to Land', 'Unplanned Landing'];
const EMERGENCY_REASONS = ['Emergency Squawks', 'Crash'];
const SAFETY_REASONS = ['Proximity Alert'];
const MILITARY_REASONS = ['Military Flight', 'Operational Military'];
// Known civilian airline callsign prefixes (should NOT be classified as military)
const CIVILIAN_AIRLINE_PREFIXES = ['ELY', 'LY', 'UAE', 'EK', 'THY', 'TK', 'RJA', 'RJ', 'ETH', 'ET', 'SAS', 'SK', 'KLM', 'AF', 'BAW', 'BA', 'DLH', 'LH', 'SWR', 'LX', 'AAL', 'AA', 'UAL', 'UA', 'DAL', 'DL'];

// Calculate stats from reports based on displayed reasons
function calculateStats(reports: AnomalyReport[]): CalculatedStats {
  const stats: CalculatedStats = {
    anomalies: 0,
    emergency: 0,
    traffic: 0,
    military: 0,
    safety: 0,
    totalFlights: reports.length,
  };

  for (const report of reports) {
    // Count anomalies
    if (report.is_anomaly) {
      stats.anomalies++;
    }

    // Get displayed reasons (same logic as FlightRow highlighting)
    const displayedReasons = getAnomalyReasons(report);

    // Check each category
    if (displayedReasons.some(reason => EMERGENCY_REASONS.some(er => reason.includes(er)))) {
      stats.emergency++;
    }
    if (displayedReasons.some(reason => TRAFFIC_REASONS.some(tr => reason.includes(tr)))) {
      stats.traffic++;
    }
    if (displayedReasons.some(reason => SAFETY_REASONS.some(sr => reason.includes(sr)))) {
      stats.safety++;
    }
    // Check for military, but exclude known civilian airlines
    const upperCallsign = report.callsign?.toUpperCase() || '';
    const isCivilianAirline = CIVILIAN_AIRLINE_PREFIXES.some(prefix => upperCallsign.startsWith(prefix));
    if (!isCivilianAirline && (
        displayedReasons.some(reason => MILITARY_REASONS.some(mr => reason.includes(mr))) ||
        upperCallsign.startsWith('RCH') ||
        upperCallsign.startsWith('CNV') ||
        upperCallsign.startsWith('IAF'))) {
      stats.military++;
    }
  }

  return stats;
}

// Orbiting plane loader component
function OrbitingPlaneLoader() {
  return (
    <div className="relative w-24 h-24">
      {/* Orbit path */}
      <div className="absolute inset-0 rounded-full border border-dashed border-[#63d1eb]/30" />
      
      {/* Center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#63d1eb]/40" />
      
      {/* Orbiting plane */}
      <div 
        className="absolute inset-0 animate-[orbit_2s_linear_infinite]"
        style={{ transformOrigin: 'center center' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span 
            className="material-symbols-outlined text-[#63d1eb] text-xl drop-shadow-[0_0_8px_rgba(99,209,235,0.8)]"
            style={{ transform: 'rotate(90deg)' }}
          >
            flight
          </span>
        </div>
      </div>
      
      {/* Trailing glow effect - behind the main plane */}
      <div 
        className="absolute inset-0 animate-[orbit_2s_linear_infinite] opacity-40"
        style={{ transformOrigin: 'center center', animationDelay: '0.12s' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span 
            className="material-symbols-outlined text-[#63d1eb]/40 text-lg blur-[2px]"
            style={{ transform: 'rotate(90deg)' }}
          >
            flight
          </span>
        </div>
      </div>
      
      {/* Second trailing glow - further behind */}
      <div 
        className="absolute inset-0 animate-[orbit_2s_linear_infinite] opacity-20"
        style={{ transformOrigin: 'center center', animationDelay: '0.24s' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span 
            className="material-symbols-outlined text-[#63d1eb]/25 text-base blur-[3px]"
            style={{ transform: 'rotate(90deg)' }}
          >
            flight
          </span>
        </div>
      </div>
      
      {/* Inject keyframes */}
      <style>{`
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Polling disabled - data doesn't get updated in real-time

interface DataStreamTableProps {
  mode: 'live' | 'history';
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  onFlightUpdate?: (flight: SelectedFlight) => void; // Callback to update selected flight data
  selectedDate: Date;
  onNewAnomaly?: (flightId: string) => void; // Callback for new anomaly detection
  highlightFilter?: StatFilter; // Filter to highlight matching flights
  onStatsChange?: (stats: CalculatedStats) => void; // Callback to report calculated stats
  aiResultsFilter?: string[] | null; // Filter to only show flights from AI results (flight IDs)
  onClearAIFilter?: () => void; // Callback to clear the AI filter
}

export function DataStreamTable({ mode, selectedFlight, onFlightSelect, onFlightUpdate: _onFlightUpdate, selectedDate, onNewAnomaly, highlightFilter, onStatsChange, aiResultsFilter, onClearAIFilter }: DataStreamTableProps) {
  const [reports, setReports] = useState<AnomalyReport[]>([]);
  const [flightStatuses, setFlightStatuses] = useState<Record<string, FlightStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callsignFilter, setCallsignFilter] = useState('');
  
  // Track seen anomaly IDs to detect new ones
  const seenAnomalyIds = useRef<Set<string>>(new Set());
  const lastFetchTs = useRef<number>(0);

  // Fetch live anomalies with new anomaly detection
  const fetchLiveData = useCallback(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // First fetch: get all anomalies from last 24 hours
      if (lastFetchTs.current === 0) {
        const dayAgo = now - 24 * 60 * 60;
        const data = await fetchLiveAnomalies(dayAgo, now);
        
        // Initialize seen IDs
        data.forEach(r => seenAnomalyIds.current.add(r.flight_id));
        lastFetchTs.current = now;
        
        return data;
      }
      
      // Subsequent fetches: get new anomalies since last fetch
      const response = await fetchLiveAnomaliesSince(lastFetchTs.current);
      lastFetchTs.current = now;
      
      // Detect new anomalies
      if (response.anomalies.length > 0 && onNewAnomaly) {
        response.anomalies.forEach(a => {
          if (!seenAnomalyIds.current.has(a.flight_id)) {
            seenAnomalyIds.current.add(a.flight_id);
            onNewAnomaly(a.flight_id);
          }
        });
      }
      
      // Merge with existing reports (update existing, add new)
      const dayAgo = now - 24 * 60 * 60;
      const data = await fetchLiveAnomalies(dayAgo, now);
      return data;
    } catch (err) {
      console.warn('Failed to fetch live data:', err);
      throw err;
    }
  }, [onNewAnomaly]);

  // Fetch reports based on mode and date
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadReports = async () => {
      try {
        setLoading(true);
        setError(null);

        let data: AnomalyReport[];
        
        if (mode === 'live') {
          // For live mode, use new fetch function
          data = await fetchLiveData();
        } else {
          // For history mode, use selected date
          const startOfDay = new Date(selectedDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(selectedDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          const startTs = Math.floor(startOfDay.getTime() / 1000);
          const endTs = Math.floor(endOfDay.getTime() / 1000);
          
          data = await fetchSystemReports(startTs, endTs, 200);
        }

        if (mounted) {
          setReports(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.warn('Failed to load reports:', err);
          setReports([]);
          setError('Failed to load flight data');
          setLoading(false);
        }
      }
    };

    // Reset state when mode changes
    if (mode === 'live') {
      seenAnomalyIds.current.clear();
      lastFetchTs.current = 0;
    }

    loadReports();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [mode, selectedDate, fetchLiveData]);

  // Filter reports by AI results and callsign filter
  const filteredReports = useMemo(() => {
    let filtered = reports;
    
    // Apply AI results filter
    if (aiResultsFilter && aiResultsFilter.length > 0) {
      const filterSet = new Set(aiResultsFilter);
      filtered = filtered.filter(r => filterSet.has(r.flight_id));
    }
    
    // Apply callsign filter
    if (callsignFilter.trim()) {
      const search = callsignFilter.trim().toLowerCase();
      filtered = filtered.filter(r => 
        r.callsign?.toLowerCase().includes(search) || 
        r.flight_id.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [reports, aiResultsFilter, callsignFilter]);

  // Calculate and report stats when reports change
  const calculatedStats = useMemo(() => calculateStats(filteredReports), [filteredReports]);
  
  useEffect(() => {
    if (onStatsChange) {
      onStatsChange(calculatedStats);
    }
  }, [calculatedStats, onStatsChange]);

  // Fetch flight statuses for live mode
  useEffect(() => {
    if (mode !== 'live') return;

    const loadStatuses = async () => {
      const statuses: Record<string, FlightStatus> = {};
      
      for (const report of reports.slice(0, 10)) {
        try {
          const status = await fetchFlightStatus(report.flight_id);
          statuses[report.flight_id] = status;
        } catch {
          // Ignore individual failures
        }
      }
      
      setFlightStatuses(statuses);
    };

    if (reports.length > 0) {
      loadStatuses();
    }
  }, [reports, mode]);

  const handleSelect = async (report: AnomalyReport) => {
    const status = flightStatuses[report.flight_id];
    
    // First, update selection with basic info so UI is responsive
    const selectedData: SelectedFlight = {
      flight_id: report.flight_id,
      callsign: report.callsign,
      origin: report.origin_airport,
      destination: report.destination_airport,
      anomalyScore: report.severity_cnn * 100,
      report,
      status,
    };
    
    onFlightSelect(selectedData);
    
    // Then fetch the track data in the background
    try {
      let track;
      
      if (mode === 'live') {
        // For live mode, try live research track first
        try {
          track = await fetchLiveResearchTrack(report.flight_id);
        } catch {
          // Fall back to unified track
          track = await fetchUnifiedTrack(report.flight_id);
        }
      } else {
        // For history mode, try unified track first, then feedback/tagged track
        try {
          track = await fetchUnifiedTrack(report.flight_id);
        } catch {
          track = await fetchSystemReportTrack(report.flight_id);
        }
      }
      
      // Update selection with track data
      if (track && track.points && track.points.length > 0) {
        onFlightSelect({
          ...selectedData,
          track,
        });
      }
    } catch (error) {
      console.warn('Could not load flight track:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <OrbitingPlaneLoader />
          <span className="text-xs text-[#63d1eb]/70 font-mono tracking-wider">
            {mode === 'live' ? 'SCANNING AIRSPACE...' : 'LOADING REPORTS...'}
          </span>
        </div>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <span className="text-xs text-center px-4">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* AI Filter Active Indicator */}
      {aiResultsFilter && aiResultsFilter.length > 0 && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2 bg-[#a78bfa]/10 border border-[#a78bfa]/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" />
            <span className="text-[10px] font-semibold text-[#a78bfa]">
              AI Filter Active — Showing {filteredReports.length} of {reports.length} flights
            </span>
          </div>
          <button
            onClick={onClearAIFilter}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-[#a78bfa]/20 hover:bg-[#a78bfa]/40 transition text-[#a78bfa] hover:text-white"
            title="Clear AI filter"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header - Fixed with glass styling */}
      <div className="shrink-0 bg-black/40 backdrop-blur-sm border-b border-white/5">
        {/* Callsign Filter - only show in history mode (System Reports) */}
        {mode === 'history' && (
          <div className="mx-3 mt-2 mb-1">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">search</span>
              <input
                type="text"
                value={callsignFilter}
                onChange={(e) => setCallsignFilter(e.target.value)}
                placeholder="Filter by callsign..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#63d1eb]/50 focus:bg-white/10 transition-all"
              />
              {callsignFilter && (
                <button
                  onClick={() => setCallsignFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mx-3 my-2 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Callsign</span>
          <div className="flex items-center gap-8">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {mode === 'live' ? 'Score / Status' : 'Score / Reason'}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest w-14 text-right">Time</span>
          </div>
        </div>
      </div>

      {/* Scrollable flight rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {filteredReports.map((report) => {
          const status = flightStatuses[report.flight_id];
          
          return (
            <FlightRow
              key={report.flight_id}
              report={report}
              mode={mode}
              isSelected={selectedFlight?.flight_id === report.flight_id}
              onSelect={handleSelect}
              status={status?.status}
              altitude={status?.altitude_ft}
              speed={status?.speed_kts}
              heading={status?.heading}
              highlightFilter={highlightFilter}
            />
          );
        })}

        {filteredReports.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-xs gap-2">
            <span className="material-symbols-outlined text-2xl text-gray-600">search_off</span>
            <span>
              {aiResultsFilter && aiResultsFilter.length > 0 
                ? 'No matching flights from AI results found' 
                : `No ${mode === 'live' ? 'active flights' : 'system reports'} found`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
