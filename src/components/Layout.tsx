import { useState } from 'react';
import { Header } from './Header';
import { OperationsSidebar } from './OperationsSidebar';
import { MapArea } from './MapArea';
import { TacticalChat } from './TacticalChat';
import type { SelectedFlight } from '../types';

export function Layout() {
  const [selectedFlight, setSelectedFlight] = useState<SelectedFlight | null>(null);
  const [mode, setMode] = useState<'live' | 'history'>('history');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const handleFlightSelect = (flight: SelectedFlight) => {
    setSelectedFlight(flight);
  };

  const handleModeChange = (newMode: 'live' | 'history') => {
    setMode(newMode);
    // Clear selection when switching modes
    setSelectedFlight(null);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // Clear selection when changing date
    setSelectedFlight(null);
  };

  return (
    <div className="bg-bg-main text-gray-400 font-body h-screen flex flex-col overflow-hidden antialiased selection:bg-primary/30 selection:text-white">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Operations Control */}
        <aside className="w-80 flex flex-col bg-bg-panel border-r border-border-dim z-20 shrink-0 shadow-panel-glow">
          <OperationsSidebar
            mode={mode}
            onModeChange={handleModeChange}
            selectedFlight={selectedFlight}
            onFlightSelect={handleFlightSelect}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />
        </aside>

        {/* Center - Map Area */}
        <main className="flex-1 relative bg-black overflow-hidden z-10">
          <MapArea selectedFlight={selectedFlight} />
        </main>

        {/* Right Sidebar - Tactical Chat */}
        <aside className="w-[420px] flex flex-col bg-bg-panel border-l border-border-dim z-20 shadow-2xl shrink-0 relative border-l-red-900/20">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
          <TacticalChat selectedFlight={selectedFlight} />
        </aside>
      </div>
    </div>
  );
}
