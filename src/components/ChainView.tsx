import { useState } from 'react';
import { Boxes, GitFork, AlertTriangle, Trophy, Layers } from 'lucide-react';
import type { SimState, Block } from '../sim/engine';
import { chainPath } from '../sim/engine';

function branchBlocks(s: SimState, tipId: string, baseId: string): Block[] {
  const out: Block[] = [];
  let b: Block | undefined = s.blocks[tipId];
  while (b && b.id !== baseId) { out.unshift(b); b = s.blocks[b.prevId]; }
  return out;
}

function cardBg(s: SimState, b: Block) {
  if (b.status === 'stale') return {
    bg: 'rgba(254,226,226,0.40)', border: 'rgba(248,113,113,0.30)', text: 'text-rose-400',
  };
  if (s.fork?.active && !s.fork.resolved && b.branch !== 'main') return b.branch === 'A'
    ? { bg: 'rgba(224,242,254,0.55)', border: 'rgba(56,189,248,0.40)', text: 'text-sky-700' }
    : { bg: 'rgba(245,243,255,0.55)', border: 'rgba(167,139,250,0.40)', text: 'text-violet-700' };
  return { bg: 'rgba(255,255,255,0.60)', border: 'rgba(209,213,219,0.55)', text: 'text-gray-700' };
}

function BlockCard({ s, b, onOpen }: { s: SimState; b: Block; onOpen: (id: string) => void }) {
  const miner = s.miners.find((m) => m.id === b.minerId);
  const isTip = b.id === s.bestTipId;
  const { bg, border, text } = cardBg(s, b);
  return (
    <button
      onClick={() => onOpen(b.id)}
      className="block-card shrink-0 w-[138px] rounded-2xl text-left transition-transform hover:scale-[1.04] hover:z-10"
      style={{ background: bg, border: `1px solid ${border}`,
        backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '10px 12px' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`font-semibold text-[13px] ${text}`}>#{b.label}</span>
        {b.status === 'stale' ? (
          <span className="text-[8px] font-bold text-rose-400 bg-rose-50 border border-rose-200 rounded-full px-1.5">STALE</span>
        ) : isTip ? (
          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 led-blink">TIP</span>
        ) : b.status === 'competing' ? (
          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5">RACE</span>
        ) : null}
      </div>
      <p className="font-mono text-[9px] text-gray-400 truncate">{b.hash.slice(0, 14)}…</p>
      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{miner?.flag} {miner?.name ?? b.minerId}</p>
      <div className="flex justify-between text-[9px] font-mono text-gray-400 mt-0.5">
        <span>{b.txIds.length} txs</span>
        <span>Σ{b.chainwork}</span>
      </div>
    </button>
  );
}

const Link = ({ dim = false }: { dim?: boolean }) => (
  <div className="shrink-0 w-5 h-px" style={{ background: dim ? 'rgba(248,113,113,0.25)' : 'rgba(209,213,219,0.60)' }} />
);

export default function ChainView({ s, onOpen }: { s: SimState; onOpen: (id: string) => void }) {
  const [view, setView] = useState<'tree' | 'active'>('tree');
  const fork = s.fork;
  const showTree = view === 'tree' && fork?.active;

  const base    = fork ? chainPath(s.blocks, fork.baseId).slice(-3) : [];
  const aBlocks = fork ? branchBlocks(s, fork.aTip, fork.baseId) : [];
  const bBlocks = fork ? branchBlocks(s, fork.bTip, fork.baseId) : [];
  const linear  = chainPath(s.blocks, s.bestTipId).slice(-7);
  const aNodes  = fork ? s.miners.filter((m) => s.blocks[m.tipId]?.branch === 'A' && s.blocks[m.tipId]?.status !== 'stale').length : 0;
  const bNodes  = fork ? s.miners.filter((m) => s.blocks[m.tipId]?.branch === 'B' && s.blocks[m.tipId]?.status !== 'stale').length : 0;
  const aWork   = fork ? s.blocks[fork.aTip].chainwork : 0;
  const bWork   = fork ? s.blocks[fork.bTip].chainwork : 0;

  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Boxes size={14} className="text-emerald-500" />
          <h2>Blockchain State</h2>
          <span className="text-[10px] text-gray-400 hidden sm:inline">click any block to inspect</span>
        </div>
        {fork?.active && (
          <div className="flex rounded-xl overflow-hidden border text-[10px]"
            style={{ borderColor: 'rgba(209,213,219,0.70)' }}>
            <button onClick={() => setView('tree')}
              className="px-3 py-1.5 flex items-center gap-1.5 transition-colors"
              style={{ background: view === 'tree' ? 'rgba(255,255,255,0.80)' : 'transparent',
                color: view === 'tree' ? '#374151' : '#9ca3af' }}>
              <GitFork size={11} /> Fork tree
            </button>
            <button onClick={() => setView('active')}
              className="px-3 py-1.5 flex items-center gap-1.5 transition-colors"
              style={{ background: view === 'active' ? 'rgba(255,255,255,0.80)' : 'transparent',
                color: view === 'active' ? '#374151' : '#9ca3af' }}>
              <Layers size={11} /> Active chain
            </button>
          </div>
        )}
      </div>

      {fork?.active && !fork.resolved && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11.5px] text-amber-700 fork-flash"
          style={{ borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(254,243,199,0.40)' }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
          <span>
            <b>Temporary fork</b> — two valid tips exist at height {fork.height}.
            Nodes follow whichever block they received first.
          </span>
        </div>
      )}
      {fork?.resolved && s.consensusBanner && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11.5px] text-emerald-700"
          style={{ borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(209,250,229,0.40)' }}>
          <Trophy size={13} className="shrink-0 mt-0.5 text-emerald-500" />
          <span>
            <b>Fork resolved</b> — Branch {fork.winner} wins ({Math.max(aWork,bWork)} vs {Math.min(aWork,bWork)} chainwork).
            Nodes converge as the heavier chain propagates.
          </span>
        </div>
      )}

      <div className="overflow-x-auto thin-scroll px-4 py-5">
        {showTree && fork ? (
          <div className="flex items-center min-w-max">
            <span className="text-gray-300 font-mono text-xs mr-1">…</span>
            <Link />
            {base.map((b, i) => (
              <div key={b.id} className="flex items-center">
                {i > 0 && <Link />}
                <BlockCard s={s} b={b} onOpen={onOpen} />
              </div>
            ))}
            <svg width="44" height="176" className="shrink-0 -mx-px">
              <path d="M0 88 H18 M18 88 V44 H44 M18 88 V132 H44" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
              <circle cx="18" cy="88" r="3" fill="#f59e0b" />
            </svg>
            <div className="flex flex-col gap-3">
              {(['A', 'B'] as const).map((br) => {
                const blocks = br === 'A' ? aBlocks : bBlocks;
                const nodes  = br === 'A' ? aNodes  : bNodes;
                const resolved = fork.resolved;
                const won  = resolved && fork.winner === br;
                const lost = resolved && fork.winner !== br;
                return (
                  <div key={br} className="flex items-center">
                    <div className="w-[88px] shrink-0 pr-2">
                      <p className={`text-[10px] font-bold ${won ? 'text-emerald-600' : lost ? 'text-rose-400 line-through' : br === 'A' ? 'text-sky-600' : 'text-violet-600'}`}>
                        {won ? 'Winner' : lost ? 'Stale' : `Branch ${br}`}
                      </p>
                      <p className="text-[9px] font-mono text-gray-400">
                        {blocks.length} blk · {resolved ? (won ? `${nodes} nodes` : 'abandoned') : `${nodes} mining`}
                      </p>
                    </div>
                    {blocks.map((b, i) => (
                      <div key={b.id} className="flex items-center">
                        {i > 0 && <Link dim={b.status === 'stale'} />}
                        <BlockCard s={s} b={b} onOpen={onOpen} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center min-w-max">
            <span className="text-gray-300 font-mono text-xs mr-1">…</span>
            <Link />
            {linear.map((b, i) => (
              <div key={b.id} className="flex items-center">
                {i > 0 && <Link />}
                <BlockCard s={s} b={b} onOpen={onOpen} />
              </div>
            ))}
            <div className="ml-4 text-[11px] text-gray-400 max-w-[140px] leading-relaxed">
              {fork?.resolved
                ? `Active chain after reorg — Branch ${fork.winner} accepted.`
                : `All ${s.miners.length} nodes share this chain. Height ${s.blocks[s.bestTipId].height}.`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
