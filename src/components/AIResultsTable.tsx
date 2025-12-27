import { useState } from 'react';
import { AlertTriangle, Sparkles, X, RefreshCw } from 'lucide-react';
import type { AnomalyReport, SelectedFlight, StatFilter } from '../types';
import { FlightRow } from './FlightRow';
import { fetchUnifiedTrack, fetchSystemReportTrack, fetchLiveResearchTrack } from '../api';

interface AIResultsTableProps {
  results: AnomalyReport[];
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  highlightFilter?: StatFilter;
  query?: string; // The query that generated these results
  onClear?: () => void; // Clear AI results
  isLoading?: boolean;
}

export function AIResultsTable({ 
  results, 
  selectedFlight, 
  onFlightSelect, 
  highlightFilter,
  query,
  onClear,
  isLoading 
}: AIResultsTableProps) {
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);

  const handleSelect = async (report: AnomalyReport) => {
    // First, update selection with basic info so UI is responsive
    const selectedData: SelectedFlight = {
      flight_id: report.flight_id,
      callsign: report.callsign,
      origin: report.origin_airport,
      destination: report.destination_airport,
      anomalyScore: report.severity_cnn * 100,
      report,
    };
    
    onFlightSelect(selectedData);
    setLoadingTrack(report.flight_id);
    
    // Then fetch the track data in the background
    try {
      let track;
      
      // Try multiple sources for track data
      try {
        track = await fetchLiveResearchTrack(report.flight_id);
      } catch {
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
    } finally {
      setLoadingTrack(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-[#a78bfa] animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 bg-[#a78bfa]/20 rounded-full animate-ping" />
          </div>
          <span className="text-xs text-[#a78bfa]/70 font-mono tracking-wider">
            AI IS SEARCHING...
          </span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-[#a78bfa]/10 flex items-center justify-center border border-[#a78bfa]/20">
          <Sparkles className="w-7 h-7 text-[#a78bfa]/50" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-gray-400">No AI Results</p>
          <p className="text-xs text-gray-500 max-w-[250px]">
            Ask ONYX to search for flights in the General chat. Results will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header with query info */}
      <div className="shrink-0 bg-black/40 backdrop-blur-sm border-b border-white/5">
        {/* Query Badge */}
        {query && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-[#a78bfa]/10 border border-[#a78bfa]/20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
              <span className="text-[10px] text-[#a78bfa] truncate font-medium">
                "{query}"
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-gray-500 font-mono">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </span>
              {onClear && (
                <button 
                  onClick={onClear}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Clear results"
                >
                  <X className="w-3 h-3 text-gray-500 hover:text-white" />
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Column Headers */}
        <div className="flex items-center justify-between mx-3 my-2 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Callsign</span>
          <div className="flex items-center gap-8">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Score / Reason</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest w-14 text-right">Time</span>
          </div>
        </div>
      </div>

      {/* Scrollable flight rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {results.map((report) => (
          <div key={report.flight_id} className="relative">
            <FlightRow
              report={report}
              mode="history"
              isSelected={selectedFlight?.flight_id === report.flight_id}
              onSelect={handleSelect}
              highlightFilter={highlightFilter}
            />
            {loadingTrack === report.flight_id && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <RefreshCw className="w-3 h-3 text-[#a78bfa] animate-spin" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

