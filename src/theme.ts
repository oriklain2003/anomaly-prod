// ONYX Theme Configuration
export const theme = {
  colors: {
    bgMain: '#050505',
    bgPanel: '#0a0a0a',
    bgSurface: '#121212',
    borderDim: '#1f1f1f',
    borderBright: '#333333',
    accentRed: '#ef4444',
    primary: '#3b82f6',
    primaryDark: '#1e40af',
    // Status colors
    hostile: '#ef4444',
    friendly: '#3b82f6',
    warning: '#f59e0b',
    success: '#22c55e',
  },
  fonts: {
    display: "'JetBrains Mono', monospace",
    body: "'Inter', sans-serif",
  },
} as const;

// Status badge configurations
export const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  HOSTILE: { bg: 'bg-red-950/10', text: 'text-red-400', border: 'border-red-900/50' },
  WP_REACHED: { bg: 'bg-transparent', text: 'text-gray-400', border: 'border-transparent' },
  ALT_HOLD: { bg: 'bg-transparent', text: 'text-gray-400', border: 'border-transparent' },
  FUEL_chk: { bg: 'bg-transparent', text: 'text-gray-400', border: 'border-transparent' },
  POS_UPDATE: { bg: 'bg-transparent', text: 'text-gray-500', border: 'border-transparent' },
  INIT_SEQ: { bg: 'bg-transparent', text: 'text-green-500/80', border: 'border-transparent' },
  CONNECTED: { bg: 'bg-transparent', text: 'text-green-500/80', border: 'border-transparent' },
  TAKEOFF: { bg: 'bg-transparent', text: 'text-gray-400', border: 'border-transparent' },
};

export default theme;
