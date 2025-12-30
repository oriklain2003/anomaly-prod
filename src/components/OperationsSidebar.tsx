import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { DataStreamTable, CalculatedStats } from './DataStreamTable';
import { AIResultsTable } from './AIResultsTable';
import { StatsCard } from './StatsCard';
import type { SelectedFlight, StatFilter, AnomalyReport } from '../types';

// AI Results data type (from TacticalChat)
export interface AIResultsData {
  flights: AnomalyReport[];
  query: string;
  timestamp: number;
}

interface OperationsSidebarProps {
  mode: 'live' | 'history' | 'ai';
  onModeChange: (mode: 'live' | 'history' | 'ai') => void;
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  onFlightUpdate?: (flight: SelectedFlight) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAnomaly?: (flightId: string) => void;
  aiResults?: AIResultsData | null;
  onClearAIResults?: () => void;
  aiResultsLoading?: boolean;
}

export function OperationsSidebar({
  mode,
  onModeChange,
  selectedFlight,
  onFlightSelect,
  onFlightUpdate,
  selectedDate,
  onDateChange,
  onNewAnomaly,
  aiResults,
  onClearAIResults,
  aiResultsLoading,
}: OperationsSidebarProps) {
  const [highlightFilter, setHighlightFilter] = useState<StatFilter>(null);
  const [calculatedStats, setCalculatedStats] = useState<CalculatedStats | null>(null);
  const [aiFilterActive, setAiFilterActive] = useState(false);
  
  const handleStatsChange = useCallback((stats: CalculatedStats) => {
    setCalculatedStats(stats);
  }, []);

  // Get flight IDs from AI results for filtering
  const aiResultsFlightIds = aiResults?.flights?.map(f => f.flight_id) || null;

  // Auto-enable AI filter when new AI results come in
  useEffect(() => {
    if (aiResults && aiResults.flights && aiResults.flights.length > 0) {
      setAiFilterActive(true);
    }
  }, [aiResults?.timestamp]);

  // Count AI results for badge
  const aiResultsCount = aiResults?.flights?.length || 0;

  return (
    <>
      {/* Header Section */}
      <div className="p-5 border-b border-white/5 bg-black/30 backdrop-blur-md flex flex-col gap-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white tracking-wider uppercase">Operations Control</span>
          <span className="text-[10px] font-mono text-gray-500">#ONYX-01</span>
        </div>

        {/* Mode Toggle - Glass Style with 3 tabs */}
        <div className="flex bg-black/50 rounded-xl p-1.5 border border-white/10 backdrop-blur-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => onModeChange('history')}
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-300 relative overflow-hidden",
              mode === 'history'
                ? "bg-[#63d1eb]/15 text-[#63d1eb] border border-[#63d1eb]/50 shadow-[0_0_20px_rgba(99,209,235,0.25),inset_0_0_10px_rgba(99,209,235,0.05)] text-shadow-neon"
                : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            {mode === 'history' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#63d1eb]/10 to-transparent animate-pulse pointer-events-none" />
            )}
            <span className="relative z-10">System Reports</span>
          </button>
          <button
            onClick={() => onModeChange('live')}
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-300 relative overflow-hidden",
              mode === 'live'
                ? "bg-[#63d1eb]/15 text-[#63d1eb] border border-[#63d1eb]/50 shadow-[0_0_20px_rgba(99,209,235,0.25),inset_0_0_10px_rgba(99,209,235,0.05)] text-shadow-neon"
                : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            {mode === 'live' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#63d1eb]/10 to-transparent animate-pulse pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#00ffa3] rounded-full shadow-[0_0_10px_rgba(0,255,163,0.8)] animate-pulse" />
              </>
            )}
            <span className="relative z-10">Live Feed</span>
          </button>
          <button
            onClick={() => onModeChange('ai')}
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-[11px] font-semibold transition-all duration-300 relative overflow-hidden",
              mode === 'ai'
                ? "bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/50 shadow-[0_0_20px_rgba(167,139,250,0.25),inset_0_0_10px_rgba(167,139,250,0.05)]"
                : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
            )}
          >
            {mode === 'ai' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#a78bfa]/10 to-transparent animate-pulse pointer-events-none" />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              AI Results
              {aiResultsCount > 0 && (
                <span className="bg-[#a78bfa] text-black text-[9px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px]">
                  {aiResultsCount}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Stats Overview - Only show for non-AI modes */}
      {mode !== 'ai' && (
        <StatsCard 
          mode={mode === 'live' ? 'live' : 'history'} 
          selectedDate={selectedDate} 
          onDateChange={onDateChange}
          selectedFilter={highlightFilter}
          onFilterSelect={setHighlightFilter}
          calculatedStats={calculatedStats}
          totalFlightsCount={calculatedStats?.totalFlights}
        />
      )}

      {/* Data Stream Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-black/20">
        {mode === 'ai' ? (
          /* AI Results Table */
          <AIResultsTable
            results={aiResults?.flights || []}
            selectedFlight={selectedFlight}
            onFlightSelect={onFlightSelect}
            highlightFilter={highlightFilter}
            query={aiResults?.query}
            onClear={onClearAIResults}
            isLoading={aiResultsLoading}
          />
        ) : (
          /* Data Stream Table */
          <DataStreamTable
            mode={mode}
            selectedFlight={selectedFlight}
            onFlightSelect={onFlightSelect}
            onFlightUpdate={onFlightUpdate}
            selectedDate={selectedDate}
            onNewAnomaly={onNewAnomaly}
            highlightFilter={highlightFilter}
            onStatsChange={handleStatsChange}
            aiResultsFilter={aiFilterActive ? aiResultsFlightIds : null}
            onClearAIFilter={() => setAiFilterActive(false)}
          />
        )}
      </div>
    </>
  );
}
