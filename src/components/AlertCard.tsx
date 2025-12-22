import { AlertTriangle, ArrowRight } from 'lucide-react';

interface AlertCardProps {
  title: string;
  description: string;
  id: string;
  actionLabel: string;
  onAction?: () => void;
}

export function AlertCard({ title, description, id, actionLabel, onAction }: AlertCardProps) {
  return (
    <div className="border border-red-900/30 bg-red-950/10 rounded-xl relative overflow-hidden transition-colors shadow-lg shadow-red-900/5 group hover:border-red-900/50">
      {/* Header */}
      <div className="px-5 py-3 border-b border-red-900/20 flex justify-between items-center bg-red-950/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-red-400 font-display text-[10px] font-bold uppercase tracking-wider">
            High Priority
          </span>
        </div>
        <span className="text-[10px] font-mono text-red-500/50">ID: {id}</span>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-display text-xs font-bold mb-2 text-red-200 tracking-wide">
          {title}
        </h3>
        <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
          {description}
        </p>

        {/* Action Button */}
        <button
          onClick={onAction}
          className="w-full text-left px-4 py-3 text-[10px] font-mono border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 rounded transition-colors text-red-300 hover:text-white flex justify-between items-center group/btn"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover/btn:opacity-100 transition-opacity transform group-hover/btn:translate-x-1 duration-300" />
        </button>
      </div>
    </div>
  );
}
