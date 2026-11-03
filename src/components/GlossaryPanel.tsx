import { useEffect, useRef, useState } from 'react';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { GLOSSARY } from '../sim/glossary';
import type { SimState } from '../sim/engine';

export default function GlossaryPanel({ s }: { s: SimState }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState<string>('blockchain');
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastFocus = useRef(-1);

  useEffect(() => {
    if (s.focusAt !== lastFocus.current) {
      lastFocus.current = s.focusAt;
      setOpen(s.focusTerm);
      setQuery('');
      const el = refs.current[s.focusTerm];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [s.focusTerm, s.focusAt]);

  const items = GLOSSARY.filter(
    (g) => !query ||
      g.term.toLowerCase().includes(query.toLowerCase()) ||
      g.detail.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <section className="card flex flex-col">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-amber-500" />
          <h2>Concept Reference</h2>
          <span className="text-[10px] text-gray-400">{GLOSSARY.length} terms</span>
        </div>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="rounded-xl pl-7 pr-3 py-1.5 text-[11px] w-32 focus:w-44 transition-all outline-none text-gray-600 placeholder-gray-400"
            style={{
              background: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(209,213,219,0.70)',
              backdropFilter: 'blur(6px)',
            }}
          />
        </div>
      </div>

      <div className="grow max-h-[420px] overflow-y-auto thin-scroll p-3 space-y-1.5">
        {items.map((g) => {
          const isOpen    = open === g.id;
          const isFocused = s.focusTerm === g.id;
          return (
            <div
              key={g.id}
              ref={(el) => { refs.current[g.id] = el; }}
              className="rounded-2xl border overflow-hidden transition-colors"
              style={{
                background: isFocused ? 'rgba(254,243,199,0.50)' : 'rgba(255,255,255,0.45)',
                borderColor: isFocused ? 'rgba(251,191,36,0.45)' : 'rgba(229,231,235,0.60)',
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? '' : g.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="shrink-0 text-[10px] font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full"
                  style={{
                    background: isFocused ? 'rgba(251,191,36,0.25)' : 'rgba(229,231,235,0.60)',
                    color: isFocused ? '#92400e' : '#9ca3af',
                  }}>
                  {String(GLOSSARY.indexOf(g) + 1)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`text-[13px] font-semibold ${isFocused ? 'text-amber-700' : 'text-gray-700'}`}>
                    {g.term}
                  </span>
                  {isFocused && <Sparkles size={10} className="inline ml-1.5 text-amber-400" />}
                  <span className="block text-[10px] text-gray-400 leading-tight mt-0.5 truncate">{g.short}</span>
                </span>
                <span className={`shrink-0 text-gray-400 text-sm transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>

              {isOpen && (
                <p className="px-4 pb-3 text-[11.5px] leading-relaxed text-gray-500 pt-2 term-reveal"
                  style={{ borderTop: '1px solid rgba(229,231,235,0.50)' }}>
                  {g.detail}
                </p>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="text-[12px] text-gray-400 p-3">No terms match "{query}".</p>
        )}
      </div>
    </section>
  );
}
