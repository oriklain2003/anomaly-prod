import { useEffect, useState } from 'react';
import { fetchStatsOverview, fetchLiveStatsOverview } from '../api';
import { DatePicker } from './DatePicker';
import type { OverviewStats, StatFilter } from '../types';
import type { CalculatedStats } from './DataStreamTable';
import clsx from 'clsx';

interface StatsCardProps {
  mode: 'live' | 'history';
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedFilter: StatFilter;
  onFilterSelect: (filter: StatFilter) => void;
  calculatedStats?: CalculatedStats | null; // Stats calculated from displayed reasons
}

interface StatItem {
  label: string;
  value: number | string;
  icon: string;  // Material icon name
  color: string;
  bgColor: string;
  glowColor: string;
  filterKey: StatFilter;
}

// Mock stats for fallback - use -1 to indicate API failure
const MOCK_STATS: OverviewStats = {
  total_flights: -1,
  total_anomalies: -1,
  safety_events: -1,
  go_arounds: -1,
  emergency_codes: -1,
  near_miss: -1,
  holding_patterns: -1,
  military_flights: -1,
  traffic_count: -1,
  return_to_field: -1,
  unplanned_landing: -1,
};

export function StatsCard({ mode, selectedDate, onDateChange, selectedFilter, onFilterSelect, calculatedStats }: StatsCardProps) {
  const [stats, setStats] = useState<OverviewStats>(MOCK_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        setLoading(true);
        
        let rawData: OverviewStats;
        
        if (mode === 'live') {
          // Live mode: get stats from research_new.db (last 24 hours)
          rawData = await fetchLiveStatsOverview();
        } else {
          // History mode: get stats from feedback_tagged.db for selected date
          const startOfDay = new Date(selectedDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(selectedDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          const startTs = Math.floor(startOfDay.getTime() / 1000);
          const endTs = Math.floor(endOfDay.getTime() / 1000);
          
          rawData = await fetchStatsOverview(startTs, endTs);
        }
        
        const data: OverviewStats = {
          ...rawData,
          military_flights: rawData.military_flights ?? 0,
          return_to_field: rawData.return_to_field ?? 0,
          unplanned_landing: rawData.unplanned_landing ?? 0,
        };

        if (mounted) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Stats API failed, using fallback:', err);
        if (mounted) {
          setStats(MOCK_STATS);
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      mounted = false;
    };
  }, [mode, selectedDate]);

  // Use client-side calculated stats (matches glow logic) when available
  // Only use API stats for total_flights (since we can't count all flights client-side)
  const displayAnomalies = calculatedStats?.anomalies ?? stats.total_anomalies ?? 0;
  const displayEmergency = calculatedStats?.emergency ?? stats.emergency_codes ?? 0;
  const displayTraffic = calculatedStats?.traffic ?? (
    (stats.holding_patterns || 0) + (stats.go_arounds || 0) + 
    (stats.return_to_field || 0) + (stats.unplanned_landing || 0)
  );
  const displayMilitary = calculatedStats?.military ?? stats.military_flights ?? 0;
  const displaySafety = calculatedStats?.safety ?? stats.safety_events ?? 0;

  const statItems: StatItem[] = [
    {
      label: 'Flights',
      value: stats.total_flights, // Keep from API - represents all flights for the day
      icon: 'flight',
      color: 'text-[#63d1eb]',
      bgColor: 'bg-[#63d1eb]/10',
      glowColor: 'shadow-[0_0_15px_rgba(99,209,235,0.3)]',
      filterKey: 'flights',
    },
    {
      label: 'Anomalies',
      value: displayAnomalies,
      icon: 'warning',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(192,132,252,0.3)]',
      filterKey: 'anomalies',
    },
    {
      label: 'Emergency',
      value: displayEmergency,
      icon: 'crisis_alert',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(248,113,113,0.3)]',
      filterKey: 'emergency',
    },
    {
      label: 'Traffic',
      value: displayTraffic,
      icon: 'traffic',
      color: 'text-[#00ffa3]',
      bgColor: 'bg-[#00ffa3]/10',
      glowColor: 'shadow-[0_0_15px_rgba(0,255,163,0.3)]',
      filterKey: 'traffic',
    },
    {
      label: 'Military',
      value: displayMilitary,
      icon: 'military_tech',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]',
      filterKey: 'military',
    },
    {
      label: 'Safety',
      value: displaySafety,
      icon: 'shield',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(251,146,60,0.3)]',
      filterKey: 'safety',
    },
  ];

  return (
    <div className="px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm">
      {/* Date Picker Row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Overview</span>
        <DatePicker selectedDate={selectedDate} onDateChange={onDateChange} />
      </div>
      
      {/* Stats Grid - smaller cards matching reference */}
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((stat) => {
          const isSelected = selectedFilter === stat.filterKey;
          return (
            <div
              key={stat.label}
              onClick={() => onFilterSelect(isSelected ? null : stat.filterKey)}
              className={clsx(
                "overview-card rounded p-3 flex flex-col items-center justify-center h-[72px] group cursor-pointer transition-all duration-300",
                isSelected && "ring-2 ring-offset-1 ring-offset-transparent scale-105",
                isSelected && stat.filterKey === 'flights' && "ring-[#63d1eb] bg-[#63d1eb]/20",
                isSelected && stat.filterKey === 'anomalies' && "ring-purple-400 bg-purple-500/20",
                isSelected && stat.filterKey === 'emergency' && "ring-red-400 bg-red-500/20",
                isSelected && stat.filterKey === 'traffic' && "ring-[#00ffa3] bg-[#00ffa3]/20",
                isSelected && stat.filterKey === 'military' && "ring-yellow-400 bg-yellow-500/20",
                isSelected && stat.filterKey === 'safety' && "ring-orange-400 bg-orange-500/20",
                !isSelected && "hover:bg-white/5"
              )}
            >
              {/* Icon */}
              <span 
                className={`material-symbols-outlined text-lg mb-1 ${stat.color} transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`} 
                style={{ textShadow: isSelected ? `0 0 20px currentColor, 0 0 30px currentColor` : `0 0 15px currentColor` }}
              >
                {stat.icon}
              </span>
              {/* Value */}
              <span 
                className={`text-xl font-mono font-bold ${stat.color}`} 
                style={{ textShadow: isSelected ? `0 0 20px currentColor, 0 0 30px currentColor` : `0 0 15px currentColor` }}
              >
                {loading ? '—' : (stat.value == null ? '—' : stat.value.toLocaleString())}
              </span>
              {/* Label */}
              <span className={clsx(
                "text-[10px] uppercase transition-colors duration-300",
                isSelected ? "text-white font-semibold" : "text-gray-500"
              )}>{stat.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
