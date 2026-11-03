import { Radio, Globe2, Zap } from 'lucide-react';
import type { Engine, SimState, Miner } from '../sim/engine';
import { EXPECTED } from '../sim/engine';

const BRANCH_COLOR: Record<string, string> = {
  main: '#34d399', A: '#38bdf8', B: '#a78bfa', stale: '#f87171',
};

function tipColor(s: SimState, m: Miner): string {
  const tip = s.blocks[m.tipId];
  if (!tip) return '#d1d5db';
  if (tip.status === 'stale') return BRANCH_COLOR.stale;
  if (tip.status === 'active') return BRANCH_COLOR.main;
  return BRANCH_COLOR[tip.branch] ?? BRANCH_COLOR.main;
}

export default function NetworkGraph({
  s, engine, selected, onSelect,
}: { s: SimState; engine: Engine; selected: string; onSelect: (id: string) => void }) {
  const activeEdges = new Set(s.packets.map((p) => `${p.from}-${p.to}`));
  const byId = Object.fromEntries(s.miners.map((m) => [m.id, m]));

  return (
    <section className="card relative overflow-hidden">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Globe2 size={14} className="text-indigo-400" />
          <h2>P2P Network</h2>
          <span className="hidden sm:inline text-[10px] text-gray-400">
            decentralised · no central server · every node validates
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> main</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> A</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> B</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> stale</span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox="0 0 1000 460" className="w-full h-auto block net-bg">
          <defs>
            <pattern id="dotsPat" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="rgba(199,210,254,0.5)" />
            </pattern>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <rect width="1000" height="460" fill="url(#dotsPat)" />

          {/* edges */}
          {s.edges.map(([a, b], i) => {
            const A = s.miners[a]; const B = s.miners[b];
            const hot = activeEdges.has(`${A.id}-${B.id}`) || activeEdges.has(`${B.id}-${A.id}`);
            return (
              <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke={hot ? 'rgba(99,102,241,0.55)' : 'rgba(199,210,254,0.50)'}
                strokeWidth={hot ? 1.8 : 1.2}
                strokeDasharray={hot ? '5 4' : undefined}
                className={hot ? 'edge-flow' : undefined} />
            );
          })}

          {/* packets */}
          {s.packets.map((p) => {
            const A = byId[p.from]; const B = byId[p.to];
            if (!A || !B) return null;
            const t = Math.min(1, Math.max(0, (s.time - p.start) / p.dur));
            const x = A.x + (B.x - A.x) * t;
            const y = A.y + (B.y - A.y) * t;
            const color = p.kind === 'tx' ? '#6366f1' : (BRANCH_COLOR[p.branch] ?? '#a78bfa');
            return p.kind === 'tx' ? (
              <circle key={p.id} cx={x} cy={y} r={3.5} fill={color} opacity={0.85} />
            ) : (
              <g key={p.id} filter="url(#glow)">
                <rect x={x-5} y={y-5} width={10} height={10} rx={2} fill={color} transform={`rotate(45 ${x} ${y})`} />
              </g>
            );
          })}

          {/* nodes */}
          {s.miners.map((m) => {
            const color  = tipColor(s, m);
            const isSel  = selected === m.id;
            const foundAge = s.time - m.lastFound;
            const rxAge    = s.time - m.lastRx;
            const mining   = m.status === 'mining' && s.running && s.mode !== 'idle';
            return (
              <g key={m.id} className="cursor-pointer" onClick={() => onSelect(m.id)}>
                <title>{`${m.name} — ${m.country}\n${m.hashRate} TH/s · tip ${s.blocks[m.tipId]?.label}`}</title>
                {foundAge < 1.8 && (
                  <circle cx={m.x} cy={m.y} r={18 + foundAge * 34} fill="none"
                    stroke={color} strokeWidth={2.5} opacity={Math.max(0, 1 - foundAge / 1.8)} />
                )}
                {rxAge < 0.5 && rxAge >= 0 && (
                  <circle cx={m.x} cy={m.y} r={22 + rxAge * 18} fill="none"
                    stroke="#6366f1" strokeWidth={1.5} opacity={Math.max(0, 0.7 - rxAge * 1.4)} />
                )}
                {mining && (
                  <circle cx={m.x} cy={m.y} r={23} fill="none"
                    stroke={color} strokeWidth={1} className="mining-ring" />
                )}
                {isSel && (
                  <circle cx={m.x} cy={m.y} r={27} fill="none"
                    stroke="#f59e0b" strokeWidth={1.4} strokeDasharray="4 4"
                    className="spin-slow" style={{ transformOrigin: `${m.x}px ${m.y}px` }} />
                )}
                {/* frosted node circle */}
                <circle cx={m.x} cy={m.y} r={17} fill="rgba(255,255,255,0.85)" stroke={color} strokeWidth={2} />
                <text x={m.x} y={m.y + 4.5} textAnchor="middle" fontSize="13">{m.flag}</text>
                <circle cx={m.x+13} cy={m.y-12} r={4}
                  fill={m.status === 'found' ? '#f59e0b' : mining ? '#34d399' : m.status === 'idle' ? '#d1d5db' : '#fbbf24'}
                  className={mining ? 'led-blink' : undefined}
                  stroke="white" strokeWidth={1.5} />
                <text x={m.x} y={m.y+33} textAnchor="middle" fontSize="10.5"
                  fill="#6b7280" fontFamily="IBM Plex Mono, monospace">{m.name}</text>
                <text x={m.x} y={m.y+46} textAnchor="middle" fontSize="9"
                  fill="#9ca3af" fontFamily="IBM Plex Mono, monospace">
                  {m.hashRate} TH · #{s.blocks[m.tipId]?.label}
                </text>
                {m.role !== 'peer' && (
                  <g>
                    <rect x={m.x-26} y={m.y-42} width={52} height={16} rx={8}
                      fill={m.role === 'A' ? 'rgba(224,242,254,0.90)' : 'rgba(245,243,255,0.90)'}
                      stroke={color} strokeWidth={1} />
                    <text x={m.x} y={m.y-30} textAnchor="middle" fontSize="9.5" fontWeight={700}
                      fill={m.role === 'A' ? '#075985' : '#4c1d95'}
                      fontFamily="Chakra Petch, sans-serif">MINER {m.role}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {s.banner && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex items-center gap-4 sm:gap-8 px-4">
              <div className="race-card race-left border-sky-300 bg-sky-50/90 shadow-lg">
                <p className="text-[10px] text-sky-500 font-semibold tracking-widest">MINER A · INDIA 🇮🇳</p>
                <p className="font-display text-xl sm:text-2xl text-sky-700">BLOCK {s.banner.aLabel}!</p>
              </div>
              <div className="race-zap text-amber-400"><Zap size={28} fill="currentColor" /></div>
              <div className="race-card race-right border-violet-300 bg-violet-50/90 shadow-lg">
                <p className="text-[10px] text-violet-500 font-semibold tracking-widest">MINER B · USA 🇺🇸</p>
                <p className="font-display text-xl sm:text-2xl text-violet-700">BLOCK {s.banner.bLabel}!</p>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] text-gray-400">
          <Radio size={11} className={s.running && s.packets.length ? 'text-indigo-400 led-blink' : 'text-gray-300'} />
          {s.packets.length} msg{s.packets.length === 1 ? '' : 's'} in flight · {s.latency.toFixed(1)}s/hop
        </div>
      </div>

      {/* miner table */}
      <div className="max-h-44 overflow-y-auto thin-scroll" style={{ borderTop: '1px solid rgba(229,231,235,0.60)' }}>
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 text-gray-400 text-[9.5px] uppercase tracking-wide"
            style={{ background: 'rgba(249,250,251,0.90)' }}>
            <tr>
              <th className="text-left px-4 py-2">Miner</th>
              <th className="text-right px-2">TH/s</th>
              <th className="text-left px-3">Status</th>
              <th className="text-left px-2">Tip</th>
              <th className="text-right px-3">Hashes</th>
              <th className="text-left px-3 w-[15%]">Progress</th>
            </tr>
          </thead>
          <tbody>
            {s.miners.map((m) => {
              const tip  = s.blocks[m.tipId];
              const prog = m.candidate ? Math.min(1, m.candidate.attempts / EXPECTED) : 0;
              return (
                <tr key={m.id} onClick={() => onSelect(m.id)}
                  className="cursor-pointer hover:bg-white/40 transition-colors"
                  style={{ borderTop: '1px solid rgba(243,244,246,0.70)',
                    background: selected === m.id ? 'rgba(254,243,199,0.25)' : 'transparent' }}>
                  <td className="px-4 py-1.5 text-gray-700 whitespace-nowrap">
                    {m.flag} {m.name}
                    {m.role !== 'peer' && (
                      <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        m.role === 'A' ? 'bg-sky-50 text-sky-600 border border-sky-200'
                                       : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="px-2 text-right text-amber-600">{m.hashRate}</td>
                  <td className="px-3">
                    <span className={m.status === 'found' ? 'text-amber-500' : m.status === 'mining' ? 'text-emerald-500' : 'text-gray-400'}>
                      {m.status === 'mining' && s.mode === 'idle' ? 'ready' : m.status}
                    </span>
                  </td>
                  <td className="px-2" style={{ color: tipColor(s, m) }}>#{tip?.label}</td>
                  <td className="px-3 text-right text-gray-500 tabular-nums">{m.hashes.toLocaleString()}</td>
                  <td className="px-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(229,231,235,0.70)' }}>
                      <div className="h-full rounded-full transition-all duration-200"
                        style={{ width: `${prog * 100}%`, background: tipColor(s, m) }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-1.5 text-[9px] text-gray-400">
          Progress = attempts ÷ expected 4,096. All hashes are real SHA-256d.
          {engine.state.mode === 'scripted' && ' (Guided mode: timing is scripted.)'}
        </p>
      </div>
    </section>
  );
}
