import { Gauge, Timer, TrendingUp, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Engine, SimState } from '../sim/engine';
import { STEPS } from '../sim/glossary';

/* ────────────────────────────────────────────────────────────────
   Step progress bar  (kept for guided mode — not shown in new UI)
──────────────────────────────────────────────────────────────── */
export function StepBar({ s, engine }: { s: SimState; engine: Engine }) {
  const step = STEPS[s.step];
  return (
    <section className="card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => engine.prev()}
            disabled={s.step === 0}
            className="btn px-2.5 py-1.5 disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <div className="flex gap-1.5 flex-wrap">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => engine.gotoStep(i)}
                disabled={i > s.maxStep}
                className="w-7 h-7 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: i === s.step
                    ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
                    : i <= s.maxStep ? 'rgba(255,255,255,0.80)' : 'rgba(243,244,246,0.50)',
                  border: i === s.step ? 'none' : '1px solid rgba(209,213,219,0.70)',
                  color: i === s.step ? '#fff' : i <= s.maxStep ? '#374151' : '#d1d5db',
                  boxShadow: i === s.step ? '0 2px 10px rgba(245,158,11,0.35)' : 'none',
                  transform: i === s.step ? 'scale(1.1)' : 'scale(1)',
                  cursor: i > s.maxStep ? 'not-allowed' : 'pointer',
                }}
              >{i + 1}</button>
            ))}
          </div>
          <button
            onClick={() => engine.next()}
            disabled={s.step === STEPS.length - 1}
            className="btn px-2.5 py-1.5 disabled:opacity-30"
            style={{ borderColor: 'rgba(251,191,36,0.50)', color: '#b45309' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="min-w-0 sm:pl-4 sm:border-l sm:border-gray-200">
          <p className="text-[10px] font-semibold text-amber-500 tracking-widest uppercase mb-0.5">
            Step {s.step + 1} of {STEPS.length} — {step.tag}
          </p>
          <p className="font-semibold text-[13px] text-gray-800">{step.title}</p>
          <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{step.narrative}</p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Dock — sliders + hash rate controls only (clean & compact)
──────────────────────────────────────────────────────────────── */
export function Dock({ s, engine }: { s: SimState; engine: Engine }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(32px) saturate(200%) brightness(1.03)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.03)',
        borderTop: '1px solid rgba(255,255,255,0.92)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.95), 0 -4px 20px rgba(0,0,0,0.05)',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">

        {/* speed */}
        <label className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
          <Gauge size={12} className="text-amber-500" />
          <span>Speed</span>
          <input
            type="range" min={0.25} max={6} step={0.25}
            value={s.speed}
            onChange={(e) => engine.setSpeed(parseFloat(e.target.value))}
            className="w-24 accent-amber-500"
          />
          <span className="font-mono text-gray-700 w-7">{s.speed}×</span>
        </label>

        {/* latency */}
        <label className="flex items-center gap-2 text-[11px] text-gray-500 shrink-0">
          <Timer size={12} className="text-indigo-400" />
          <span>Latency</span>
          <input
            type="range" min={0.2} max={3} step={0.1}
            value={s.latency}
            onChange={(e) => engine.setLatency(parseFloat(e.target.value))}
            className="w-24 accent-indigo-400"
          />
          <span className="font-mono text-gray-700 w-12">{s.latency.toFixed(1)}s/hop</span>
        </label>

        {/* hash rates */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <TrendingUp size={12} className="text-gray-400" />
          <span>Hash rate:</span>
          {(['A', 'B'] as const).map((role, idx) => (
            <div key={role} className="flex items-center gap-1">
              <span className={`font-semibold ${role === 'A' ? 'text-sky-600' : 'text-violet-600'}`}>{role}</span>
              <button onClick={() => engine.bumpRate(role, -10)} className="btn-px">−</button>
              <span className="font-mono text-gray-700 w-14 text-center">{s.miners[idx].hashRate} TH/s</span>
              <button onClick={() => engine.bumpRate(role, +10)} className="btn-px">+</button>
            </div>
          ))}
        </div>

        {/* subsidy */}
        <label className="flex items-center gap-2 text-[11px] text-gray-500 ml-auto">
          <Coins size={12} className="text-amber-500" />
          <span>Reward</span>
          <input
            type="number" min={0} step={0.005} value={s.subsidy}
            onChange={(e) => engine.setSubsidy(parseFloat(e.target.value) || 0)}
            className="w-20 rounded-lg px-2 py-1 font-mono text-[11px] text-amber-700 outline-none"
            style={{ background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(209,213,219,0.70)' }}
          />
          <span className="text-gray-400">BTC</span>
        </label>

      </div>
    </div>
  );
}
