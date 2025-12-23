import { Settings, Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

type NavTab = 'dashboard' | 'route-check' | 'intelligence' | 'explorer';

const navItems: { id: NavTab; label: string; path: string }[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/' },
  { id: 'route-check', label: 'Route Check', path: '/route-check' },
  { id: 'intelligence', label: 'Intelligence', path: '/' },
  { id: 'explorer', label: 'Explorer', path: '/' },
];

export function Header() {
  const location = useLocation();

  const getActiveTab = (): NavTab => {
    if (location.pathname === '/route-check') return 'route-check';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  return (
    <header className="h-16 border-b border-border-dim bg-bg-main flex items-center justify-between px-6 shrink-0 z-20">
      {/* Left side - Logo and Navigation */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white text-3xl">diamond</span>
          <h1 className="font-display font-bold text-lg tracking-wider text-white">ONYX</h1>
        </Link>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              className={clsx(
                "px-4 py-1.5 rounded-md text-xs font-medium transition-colors border",
                activeTab === item.id
                  ? "bg-white/5 text-gray-300 border-white/5"
                  : "bg-transparent text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right side - Status and Actions */}
      <div className="flex items-center gap-4">
        {/* System Status */}
        <div className="flex text-[10px] font-mono gap-4 text-gray-600 border-r border-white/5 pr-4">
          <span className="flex items-center gap-1.5">BW: 450 MBPS</span>
          <span className="flex items-center gap-1.5">LAT: 12ms</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="text-gray-500 hover:text-white hover:bg-white/10 p-2 rounded-md transition-colors border border-transparent hover:border-white/5">
            <Settings className="h-5 w-5" />
          </button>
          <button className="text-gray-500 hover:text-white hover:bg-white/10 p-2 rounded-md transition-colors border border-transparent hover:border-white/5">
            <Bell className="h-5 w-5" />
          </button>

          {/* User Avatar */}
          <div className="w-9 h-9 bg-white/10 rounded-full ml-2 flex items-center justify-center text-xs font-bold text-white font-mono border border-white/10">
            OP
          </div>
        </div>
      </div>
    </header>
  );
}
