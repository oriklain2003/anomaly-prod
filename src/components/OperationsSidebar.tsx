import clsx from 'clsx';
import { DataStreamTable } from './DataStreamTable';
import { StatsCard } from './StatsCard';
import type { SelectedFlight } from '../types';

interface OperationsSidebarProps {
  mode: 'live' | 'history';
  onModeChange: (mode: 'live' | 'history') => void;
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onNewAnomaly?: (flightId: string) => void;
}

export function OperationsSidebar({
  mode,
  onModeChange,
  selectedFlight,
  onFlightSelect,
  selectedDate,
  onDateChange,
  onNewAnomaly,
}: OperationsSidebarProps) {
  return (
    <>
      {/* Header Section */}
      <div className="p-5 border-b border-white/5 bg-black/30 backdrop-blur-md flex flex-col gap-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white tracking-wider uppercase">Operations Control</span>
          <span className="text-[10px] font-mono text-gray-500">#ONYX-01</span>
        </div>

        {/* Mode Toggle - Glass Style */}
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
        </div>
      </div>

      {/* Stats Overview */}
      <StatsCard 
        mode={mode} 
        selectedDate={selectedDate} 
        onDateChange={onDateChange} 
      />

      {/* Data Stream Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-black/20">
        {/* Section Header */}
        <div className="shrink-0 px-5 py-3 border-b border-white/5 flex justify-between items-center bg-black/30 backdrop-blur-sm">
          <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
            {mode === 'live' ? 'Active Flights' : 'Detection Log'}
          </span>
          <span className={clsx(
            "w-2 h-2 rounded-full shadow-[0_0_10px]",
            mode === 'live' 
              ? "bg-[#00ffa3] shadow-[#00ffa3]/80 animate-pulse" 
              : "bg-[#63d1eb] shadow-[#63d1eb]/80 animate-pulse"
          )} />
        </div>

        {/* Data Stream Table */}
        <DataStreamTable
          mode={mode}
          selectedFlight={selectedFlight}
          onFlightSelect={onFlightSelect}
          selectedDate={selectedDate}
          onNewAnomaly={onNewAnomaly}
        />
      </div>
    </>
  );
}
