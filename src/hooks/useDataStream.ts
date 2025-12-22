import { useState, useEffect, useRef } from 'react';
import type { DataStreamEvent } from '../types';

// Mock data generator for demo purposes
const generateMockEvent = (): DataStreamEvent => {
  const units = ['VL-01', 'VL-02', 'HN-05', 'GND-1', 'SYS', 'NET', 'SYS_AI'];
  const statuses = ['WP_REACHED', 'ALT_HOLD', 'FUEL_chk', 'POS_UPDATE', 'INIT_SEQ', 'CONNECTED', 'TAKEOFF', 'HOSTILE'];
  
  const unit = units[Math.floor(Math.random() * units.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const isHostile = status === 'HOSTILE';
  
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    time,
    unit,
    status,
    isHostile,
    unitType: isHostile ? 'hostile' : (unit.startsWith('VL') || unit.startsWith('HN') ? 'friendly' : 'neutral'),
  };
};

interface UseDataStreamOptions {
  mode: 'live' | 'history';
  pollingInterval?: number;
  maxEvents?: number;
}

export function useDataStream({ mode, pollingInterval = 5000, maxEvents = 50 }: UseDataStreamOptions) {
  const [events, setEvents] = useState<DataStreamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initial load
    setIsLoading(true);
    
    // In production, this would fetch from the API
    // For now, generate initial mock data
    const initialEvents: DataStreamEvent[] = Array.from({ length: 8 }, () => generateMockEvent());
    setEvents(initialEvents);
    setIsLoading(false);

    // Only poll in live mode
    if (mode === 'live') {
      intervalRef.current = setInterval(() => {
        const newEvent = generateMockEvent();
        setEvents(prev => {
          const updated = [newEvent, ...prev];
          return updated.slice(0, maxEvents);
        });
      }, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mode, pollingInterval, maxEvents]);

  return { events, isLoading };
}
