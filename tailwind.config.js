/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ONYX Theme Colors
        'bg-main': '#050505',
        'bg-panel': '#0a0a0a',
        'bg-surface': '#121212',
        'border-dim': '#1f1f1f',
        'border-bright': '#333333',
        'accent-red': '#ef4444',
        'primary': '#3b82f6',
        'primary-dark': '#1e40af',
        // Status colors
        'status-hostile': '#ef4444',
        'status-friendly': '#3b82f6',
        'status-warning': '#f59e0b',
        'status-success': '#22c55e',
      },
      fontFamily: {
        display: ['JetBrains Mono', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(59, 130, 246, 0.3)',
        'glow-red': '0 0 20px -5px rgba(239, 68, 68, 0.3)',
        'panel-glow': '0 0 30px -10px rgba(0,0,0,0.8)',
      },
      animation: {
        'scan': 'scan 8s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
      },
      keyframes: {
        scan: {
          '0%': { top: '0', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}
