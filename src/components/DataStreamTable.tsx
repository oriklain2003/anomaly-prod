import { useEffect, useState, useRef, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { AnomalyReport, FlightStatus, SelectedFlight } from '../types';
import { FlightRow } from './FlightRow';
import { fetchLiveAnomalies, fetchSystemReports, fetchFlightStatus, fetchUnifiedTrack, fetchSystemReportTrack, fetchLiveAnomaliesSince, fetchLiveResearchTrack } from '../api';

const LIVE_POLL_INTERVAL = 10000; // 10 seconds

interface DataStreamTableProps {
  mode: 'live' | 'history';
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  selectedDate: Date;
  onNewAnomaly?: (flightId: string) => void; // Callback for new anomaly detection
}

export function DataStreamTable({ mode, selectedFlight, onFlightSelect, selectedDate, onNewAnomaly }: DataStreamTableProps) {
  const [reports, setReports] = useState<AnomalyReport[]>([]);
  const [flightStatuses, setFlightStatuses] = useState<Record<string, FlightStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
        if (!loading) {
          // Only show loading on initial fetch
        } else {
          setLoading(true);
        }
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

    // Polling for live mode only - 10 second interval
    let pollInterval: number | null = null;
    if (mode === 'live') {
      pollInterval = window.setInterval(loadReports, LIVE_POLL_INTERVAL);
    }

    return () => {
      mounted = false;
      controller.abort();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [mode, selectedDate, fetchLiveData]);

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
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs">Loading {mode === 'live' ? 'live data' : 'system reports'}...</span>
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
      {/* Header - Fixed with glass styling */}
      <div className="shrink-0 bg-black/40 backdrop-blur-sm border-b border-white/5">
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
        {reports.map((report) => {
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
            />
          );
        })}

        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-xs gap-2">
            <span className="material-symbols-outlined text-2xl text-gray-600">search_off</span>
            <span>No {mode === 'live' ? 'active flights' : 'system reports'} found</span>
          </div>
        )}
      </div>
    </div>
  );
}
