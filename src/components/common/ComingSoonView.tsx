import React from 'react';
import { Compass, BookOpen, Search, Target, Clock, ArrowRight } from 'lucide-react';

interface ComingSoonViewProps {
  title: string;
  phase: string;
  description: string;
  highlights: string[];
  onNavigateHome: () => void;
}

export const ComingSoonView: React.FC<ComingSoonViewProps> = ({
  title,
  phase,
  description,
  highlights,
  onNavigateHome,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center space-y-6 animate-fadeIn">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
        <Clock className="w-3.5 h-3.5" />
        {phase} Roadmap
      </div>

      <h1 className="font-serif font-black text-3xl sm:text-4xl text-stone-100 tracking-tight">
        {title}
      </h1>

      <p className="text-stone-300 text-sm max-w-lg mx-auto leading-relaxed">
        {description}
      </p>

      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 text-left max-w-lg mx-auto space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
          Planned Dojo Architecture:
        </h4>
        <ul className="space-y-2 text-xs text-stone-300">
          {highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-2">
        <button
          onClick={onNavigateHome}
          className="py-2.5 px-6 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-bold transition-all"
        >
          Return to Tatami (Today's Plan)
        </button>
      </div>
    </div>
  );
};
