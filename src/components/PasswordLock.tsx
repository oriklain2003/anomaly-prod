import { useState, useEffect, KeyboardEvent } from 'react';

const CORRECT_PASSWORD = 'otk';
const AUTH_KEY = 'onyx_authenticated';

interface PasswordLockProps {
  children: React.ReactNode;
}

export function PasswordLock({ children }: PasswordLockProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const auth = sessionStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = () => {
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setShake(true);
      setPassword('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center z-[9999] overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Subtle gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Scan line effect */}
      <div className="scan-line" />
      
      {/* Lock container */}
      <div 
        className={`relative glass-panel rounded-2xl p-10 w-[420px] transition-all duration-300 ${shake ? 'animate-shake' : ''}`}
        style={{
          animation: shake ? 'shake 0.5s ease-in-out' : undefined,
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        
        {/* Logo/Icon area */}
        <div className="flex flex-col items-center mb-8">
          {/* Lock icon with glow */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 flex items-center justify-center">
              <svg 
                className="w-10 h-10 text-cyan-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl border border-cyan-400/30 animate-ping opacity-20" />
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-bold tracking-wider text-white font-mono">
            ONYX
          </h1>
          <p className="text-sm text-gray-500 mt-1 tracking-wide uppercase">
            Secure Access Required
          </p>
        </div>
        
        {/* Password input */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter access code"
              autoFocus
              className={`w-full px-5 py-4 bg-black/40 border rounded-xl text-center text-lg tracking-[0.3em] font-mono transition-all duration-300 focus:outline-none placeholder:tracking-normal placeholder:text-gray-600 ${
                error 
                  ? 'border-red-500/60 text-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' 
                  : 'border-gray-700/50 text-cyan-300 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20'
              }`}
            />
            {/* Input glow effect */}
            <div className={`absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 ${
              password ? 'opacity-100' : 'opacity-0'
            }`} style={{
              boxShadow: error 
                ? '0 0 20px rgba(239, 68, 68, 0.15)' 
                : '0 0 20px rgba(99, 209, 235, 0.15)'
            }} />
          </div>
          
          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm text-center animate-fadeIn">
              Access denied. Invalid code.
            </p>
          )}
          
          {/* Submit button */}
          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-xl font-medium tracking-wide transition-all duration-300 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              AUTHENTICATE
            </span>
          </button>
        </div>
        
        {/* Bottom decorative element */}
        <div className="mt-8 flex justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className="w-1.5 h-1.5 rounded-full bg-cyan-500/30"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
      
      {/* Keyframes for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}

