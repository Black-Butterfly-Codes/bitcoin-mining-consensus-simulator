import { Activity, ScrollText } from 'lucide-react';
import type { Engine, SimState } from '../sim/engine';
import { NBITS } from '../sim/engine';

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b last:border-0"
      style={{ borderColor: 'rgba(229,231,235,0.60)' }}>
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className={`font-mono text-[12px] tabular-nums font-semibold ${accent ?? 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

export function StatsDashboard({ s }: { s: SimState }) {
  const totalRate = s.miners.reduce((a, m) => a + m.hashRate, 0);
  const best = s.blocks[s.bestTipId];
  const times = s.stats.blockTimes;
  const avg = times.length >= 2 ? (times[times.length - 1] - times[0]) / (times.length - 1) : null;
  const stale = Object.values(s.blocks).filter((b) => b.status === 'stale').length;
  const branches = s.fork?.active && !s.fork.resolved ? 2 : 1;
  const rewards = Object.values(s.blocks)
    .filter((b) => b.status === 'active')
    .reduce((a, b) => a + (s.txs[b.txIds[0]]?.amount ?? 0), 0);

  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-500" />
          <h2>Live Stats</h2>
        </div>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: s.running ? '#34d399' : '#d1d5db',
            boxShadow: s.running ? '0 0 6px rgba(52,211,153,0.6)' : 'none' }}
        />
      </div>
      <div className="card-body space-y-0">
        <Stat label="Block height"      value={`${best.height}`}              accent="text-emerald-600" />
        <Stat label="Total hash rate"   value={`${totalRate} TH/s`}           accent="text-amber-600" />
        <Stat label="Avg block time"    value={avg !== null ? `${avg.toFixed(1)}s` : '—'} />
        <Stat label="Blocks found"      value={`${s.stats.blocksFound}`} />
        <Stat label="Hashes computed"   value={s.stats.hashes.toLocaleString()} accent="text-amber-600" />
        <Stat label="Difficulty (demo)" value={`0x${NBITS.toString(16)}`} />
        <Stat label="Competing branches" value={`${branches}`}
          accent={branches > 1 ? 'text-amber-600' : undefined} />
        <Stat label="Stale blocks" value={`${stale}`}
          accent={stale ? 'text-rose-500' : undefined} />
        <Stat label="Node reorgs" value={`${s.stats.reorgs}`}
          accent={s.stats.reorgs ? 'text-sky-600' : undefined} />
        <Stat label="Rewards earned"    value={`${rewards.toFixed(4)} BTC`} accent="text-emerald-600" />
      </div>
    </section>
  );
}

/* event kind → pill style */
const KIND_PILL: Record<string, string> = {
  info:      'bg-gray-100 text-gray-500',
  tx:        'bg-blue-50 text-blue-500',
  block:     'bg-amber-50 text-amber-600',
  fork:      'bg-orange-50 text-orange-500',
  consensus: 'bg-emerald-50 text-emerald-600',
  reorg:     'bg-sky-50 text-sky-600',
  reward:    'bg-yellow-50 text-yellow-600',
  attack:    'bg-rose-50 text-rose-500',
};

function fmtT(t: number) {
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function EventLog({ s, engine }: { s: SimState; engine: Engine }) {
  return (
    <section className="card flex flex-col">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <ScrollText size={14} className="text-indigo-400" />
          <h2>Event Log</h2>
        </div>
        <span className="text-[10px] text-gray-400">click to highlight concept</span>
      </div>

      <div className="grow max-h-72 overflow-y-auto thin-scroll px-3 py-2 space-y-1">
        {s.events.map((e) => (
          <button
            key={e.id}
            onClick={() => e.term && engine.focus(e.term)}
            className={`w-full text-left flex items-start gap-2 rounded-xl px-3 py-2 transition-colors
              ${e.term ? 'cursor-pointer hover:bg-white/60' : 'cursor-default'}`}
          >
            <span className={`shrink-0 text-[9px] font-bold rounded-full px-2 py-0.5 mt-px ${KIND_PILL[e.kind] ?? KIND_PILL.info}`}>
              {e.kind}
            </span>
            <div className="min-w-0">
              <span className="font-mono text-[9px] text-gray-400 mr-1">{fmtT(e.t)}</span>
              <span className="text-[11px] text-gray-600 leading-snug">{e.msg}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
