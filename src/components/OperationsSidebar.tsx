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
}

export function OperationsSidebar({
  mode,
  onModeChange,
  selectedFlight,
  onFlightSelect,
  selectedDate,
  onDateChange,
}: OperationsSidebarProps) {
  return (
    <>
      {/* Header Section */}
      <div className="p-5 border-b border-border-dim bg-bg-panel flex flex-col gap-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white tracking-wide">Operations Control</span>
          <span className="text-[10px] font-mono text-gray-600">#ONYX-01</span>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-black rounded-lg p-1 border border-white/5">
          <button
            onClick={() => onModeChange('history')}
            className={clsx(
              "flex-1 py-2 rounded-md text-[11px] font-medium transition-all",
              mode === 'history'
                ? "bg-primary-dark text-blue-50 shadow-sm border border-blue-500/20 font-bold"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            System Reports
          </button>
          <button
            onClick={() => onModeChange('live')}
            className={clsx(
              "flex-1 py-2 rounded-md text-[11px] font-medium transition-all",
              mode === 'live'
                ? "bg-primary-dark text-blue-50 shadow-sm border border-blue-500/20 font-bold"
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            Live Feed
          </button>
        </div>

        {/* Emergency Protocol Button */}
        <button className="group w-full relative overflow-hidden bg-transparent border border-red-900/40 hover:border-red-500/50 hover:bg-red-950/20 text-red-500 font-medium py-2.5 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-base">emergency_home</span>
          <span className="font-mono text-[10px] uppercase tracking-wider">Emergency Protocol</span>
        </button>
      </div>

      {/* Stats Overview */}
      <StatsCard 
        mode={mode} 
        selectedDate={selectedDate} 
        onDateChange={onDateChange} 
      />

      {/* Data Stream Section */}
      <div className="flex-1 min-h-0 flex flex-col bg-bg-panel">
        {/* Section Header */}
        <div className="shrink-0 px-5 py-3 border-b border-border-dim flex justify-between items-center bg-bg-surface/50">
          <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">
            {mode === 'live' ? 'Active Flights' : 'Detection Log'}
          </span>
          <span className={clsx(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            mode === 'live' ? "bg-green-500" : "bg-blue-500"
          )} />
        </div>

        {/* Data Stream Table */}
        <DataStreamTable
          mode={mode}
          selectedFlight={selectedFlight}
          onFlightSelect={onFlightSelect}
          selectedDate={selectedDate}
        />
      </div>
    </>
  );
}
