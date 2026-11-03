import {
  Inbox, GitBranch, Coins, Swords, Plus,
  ShieldAlert, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';
import type { Engine, SimState, Tx } from '../sim/engine';
import { confirmations, fmtBTC, NBITS } from '../sim/engine';

/* ── status pill colours (light) ── */
const TX_STATUS: Record<string, string> = {
  broadcasting: 'bg-blue-50 text-blue-500 border-blue-200',
  mempool:      'bg-amber-50 text-amber-600 border-amber-200',
  confirmed:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  returned:     'bg-sky-50 text-sky-500 border-sky-200',
  rejected:     'bg-rose-50 text-rose-500 border-rose-200',
  void:         'bg-gray-100 text-gray-400 border-gray-200',
};

/* ──────────────────────────────────────────────────────────
   Mempool
────────────────────────────────────────────────────────── */
export function TxRow({ s, t, onOpen }: { s: SimState; t: Tx; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(t.id)}
      className="w-full text-left px-4 py-2.5 hover:bg-white/50 transition-colors"
      style={{ borderTop: '1px solid rgba(243,244,246,0.80)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-gray-700 truncate">
          {t.kind === 'coinbase' && <Coins size={10} className="inline text-amber-500 mr-1" />}
          {t.from} <ArrowRight size={10} className="inline text-gray-300 mx-0.5" /> {t.to}
        </span>
        <span className="text-[12px] font-mono text-gray-700 whitespace-nowrap font-medium">
          {fmtBTC(t.amount)} BTC
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="font-mono text-[10px] text-gray-400 truncate">{t.id.slice(0, 12)}…</span>
        <div className="flex items-center gap-2 shrink-0">
          {t.kind === 'payment' && <span className="text-[10px] text-gray-400">fee {t.fee}</span>}
          <span className="text-[10px] text-gray-400">{t.seenBy.length}/{s.miners.length} nodes</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${TX_STATUS[t.status]}`}>
            {t.status}
          </span>
        </div>
      </div>
    </button>
  );
}

export function MempoolPanel({
  s, onOpenTx, onGenerate,
}: { s: SimState; onOpenTx: (id: string) => void; onGenerate: () => void }) {
  const all = Object.values(s.txs);
  const order: Record<string, number> = { broadcasting: 0, mempool: 1, returned: 2, rejected: 3, confirmed: 4, void: 5 };
  all.sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt);
  const pending = all.filter(
    (t) => ['broadcasting', 'mempool', 'returned'].includes(t.status) && t.kind === 'payment',
  ).length;

  return (
    <section className="card flex flex-col">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-indigo-400" />
          <h2>Mempool &amp; Transactions</h2>
          <span className="text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
            {pending} pending
          </span>
        </div>
        <button onClick={onGenerate} className="btn-mini">
          <Plus size={10} /> Generate
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto thin-scroll grow">
        {all.length === 0 && (
          <p className="px-4 py-5 text-[12px] text-gray-400">No transactions yet.</p>
        )}
        {all.map((t) => <TxRow key={t.id} s={s} t={t} onOpen={onOpenTx} />)}
      </div>
      <p className="px-4 py-2 text-[10px] text-gray-400"
        style={{ borderTop: '1px solid rgba(229,231,235,0.50)' }}>
        Each node keeps its own mempool. Miners pick the highest-fee valid transactions.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Branch comparison
────────────────────────────────────────────────────────── */
export function BranchPanel({ s, engine }: { s: SimState; engine: Engine }) {
  const f = s.fork;
  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-violet-400" />
          <h2>Competing Branches</h2>
        </div>
        <span className="text-[10px] text-gray-400 font-mono">nBits 0x{NBITS.toString(16)}</span>
      </div>

      {!f?.active ? (
        <div className="card-body">
          <p className="text-[12px] text-gray-500">No fork active — all nodes follow one chain.</p>
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            Nodes follow the valid chain with the{' '}
            <b className="text-gray-600">greatest cumulative Proof of Work</b> — not a vote.
          </p>
        </div>
      ) : (
        <div className="card-body space-y-3">
          {(['A', 'B'] as const).map((br) => {
            const tip = s.blocks[br === 'A' ? f.aTip : f.bTip];
            let n = 0; let b = tip;
            while (b && b.id !== f.baseId) { n++; b = s.blocks[b.prevId]; }
            const miners = s.miners.filter((m) => s.blocks[m.tipId]?.branch === br);
            const hash = miners.reduce((a, m) => a + m.hashRate, 0);
            const work = tip.chainwork;
            const max = Math.max(s.blocks[f.aTip].chainwork, s.blocks[f.bTip].chainwork);
            const isWinner = f.resolved && f.winner === br;
            const isLoser  = f.resolved && f.winner !== br;
            const isA = br === 'A';
            return (
              <div key={br} className="rounded-2xl border p-3"
                style={{
                  background: isWinner ? 'rgba(209,250,229,0.40)'
                    : isLoser  ? 'rgba(254,226,226,0.30)'
                    : isA      ? 'rgba(224,242,254,0.40)'
                    :            'rgba(245,243,255,0.40)',
                  borderColor: isWinner ? 'rgba(52,211,153,0.40)'
                    : isLoser  ? 'rgba(248,113,113,0.35)'
                    : isA      ? 'rgba(56,189,248,0.35)'
                    :            'rgba(167,139,250,0.35)',
                  opacity: isLoser ? 0.65 : 1,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-semibold text-[13px] ${
                    isWinner ? 'text-emerald-700'
                    : isLoser  ? 'text-rose-500'
                    : isA      ? 'text-sky-700' : 'text-violet-700'
                  }`}>
                    Branch {br} {isWinner ? '· Winner ✓' : isLoser ? '· Stale' : ''}
                  </span>
                  <button onClick={() => engine.extendBranch(br)} disabled={f.resolved}
                    className="btn-mini disabled:opacity-30">
                    <Plus size={9} /> Extend
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 mb-2">
                  <span>Tip block: <b className="text-gray-700">#{tip.label}</b></span>
                  <span>Extra blocks: <b className="text-gray-700">{n}</b></span>
                  <span>Miners: <b className="text-gray-700">{miners.length}</b></span>
                  <span>Hash power: <b className="text-gray-700">{hash} TH/s</b></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(229,231,235,0.60)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(work / max) * 100}%`,
                        background: isWinner ? '#34d399' : isLoser ? '#f87171'
                          : isA ? '#38bdf8' : '#a78bfa',
                      }} />
                  </div>
                  <span className="font-mono text-[11px] text-gray-600 tabular-nums whitespace-nowrap">Σ {work}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Chainwork = total expected hashes to build this chain. A shorter chain of harder blocks beats a longer easy chain.
          </p>
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Rewards
────────────────────────────────────────────────────────── */
export function RewardPanel({ s }: { s: SimState }) {
  const blocks = Object.values(s.blocks).filter((b) => b.branch !== 'main' && b.height > 0);
  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Coins size={14} className="text-amber-500" />
          <h2>Miner Rewards</h2>
        </div>
        <span className="text-[10px] text-gray-400">subsidy: {s.subsidy} BTC</span>
      </div>
      <div className="card-body space-y-2 max-h-48 overflow-y-auto thin-scroll">
        {blocks.length === 0 && (
          <p className="text-[12px] text-gray-400">
            No competing blocks yet. Rewards appear once a fork scenario runs.
          </p>
        )}
        {blocks.map((b) => {
          const m = s.miners.find((x) => x.id === b.minerId);
          const cb = s.txs[b.txIds[0]];
          const fees = cb ? Math.max(0, cb.amount - s.subsidy) : 0;
          return (
            <div key={b.id} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-[11px]"
              style={{
                background: b.status === 'stale' ? 'rgba(254,226,226,0.35)'
                  : b.status === 'active' ? 'rgba(209,250,229,0.35)'
                  : 'rgba(255,255,255,0.50)',
                borderColor: b.status === 'stale' ? 'rgba(248,113,113,0.30)'
                  : b.status === 'active' ? 'rgba(52,211,153,0.30)'
                  : 'rgba(229,231,235,0.60)',
              }}
            >
              <span className="text-gray-700">
                {m?.flag} {m?.name}
                <span className="text-gray-400 font-mono ml-1">· block {b.label}</span>
              </span>
              <span className="flex items-center gap-2 font-mono">
                {b.status === 'stale' ? (
                  <span className="text-rose-400 line-through">{fmtBTC(cb?.amount ?? 0)} BTC</span>
                ) : (
                  <span className="text-gray-700">
                    {s.subsidy} + {fees.toFixed(5)} = <b className="text-amber-600">{fmtBTC(cb?.amount ?? 0)}</b>
                  </span>
                )}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  b.status === 'stale' ? 'border-rose-200 text-rose-500 bg-rose-50'
                  : b.status === 'active' ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                  : 'border-amber-200 text-amber-600 bg-amber-50'
                }`}>
                  {b.status === 'stale' ? 'VOID' : b.status === 'active' ? 'PAID' : 'PENDING'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="px-4 pb-3 text-[10px] text-gray-400"
        style={{ borderTop: '1px solid rgba(229,231,235,0.50)', paddingTop: '8px' }}>
        The winner keeps subsidy + all fees. The stale miner gets <b className="text-rose-400">nothing</b>.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Double-Spend lab
────────────────────────────────────────────────────────── */
export function DoubleSpendPanel({
  s, engine, onOpenTx,
}: { s: SimState; engine: Engine; onOpenTx: (id: string) => void }) {
  const ds = s.ds;
  const txA = ds.txA ? s.txs[ds.txA] : undefined;
  const txB = ds.txB ? s.txs[ds.txB] : undefined;
  const conf = confirmations(s, ds.blockId);

  const balance = (who: string) => {
    if (ds.phase !== 'resolved' && ds.phase !== 'mining') return who === 'Alice' ? '1.0' : '0.0';
    if (who === 'Alice') return '0.0';
    if (ds.choice === 'A' && who === 'Bob') return '1.0';
    if (ds.choice === 'B' && who === 'Charlie') return '1.0';
    return '0.0';
  };

  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-rose-400" />
          <h2>Double-Spend Lab</h2>
        </div>
        {ds.phase !== 'idle' && (
          <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-0.5 uppercase">
            {ds.phase}
          </span>
        )}
      </div>

      <div className="card-body">
        {ds.phase === 'idle' ? (
          <div className="text-center py-4">
            <ShieldAlert size={30} className="mx-auto text-rose-300 mb-3" />
            <p className="text-[12px] text-gray-500 max-w-sm mx-auto leading-relaxed">
              Alice holds <b className="text-gray-700">1 BTC</b> from Block 100. She'll sign{' '}
              <b className="text-gray-700">two conflicting transactions</b> spending the same coin —
              one to Bob, one to Charlie.
            </p>
            <button onClick={() => engine.startDoubleSpend()} className="btn mt-4"
              style={{ borderColor: 'rgba(248,113,113,0.45)', color: '#991b1b', background: 'rgba(254,226,226,0.35)' }}>
              <Swords size={12} /> Start Scenario
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* balances */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {['Alice', 'Bob', 'Charlie'].map((w) => (
                <div key={w} className="rounded-2xl border py-2.5 px-1"
                  style={{ background: 'rgba(255,255,255,0.60)', borderColor: 'rgba(229,231,235,0.70)' }}>
                  <p className="text-[10px] text-gray-400 mb-0.5">{w}</p>
                  <p className={`font-mono text-[14px] font-bold ${balance(w) === '1.0' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {balance(w)} BTC
                  </p>
                </div>
              ))}
            </div>

            {/* tx cards */}
            <div className="grid sm:grid-cols-2 gap-2">
              {(['A', 'B'] as const).map((side) => {
                const t = side === 'A' ? txA : txB;
                if (!t) return null;
                const rejected    = t.status === 'rejected';
                const confirmedTx = t.status === 'confirmed';
                const isA = side === 'A';
                return (
                  <div key={side} className="rounded-2xl border p-3"
                    style={{
                      background: rejected    ? 'rgba(254,226,226,0.35)'
                        : confirmedTx ? 'rgba(209,250,229,0.35)'
                        : isA ? 'rgba(224,242,254,0.40)' : 'rgba(245,243,255,0.40)',
                      borderColor: rejected    ? 'rgba(248,113,113,0.35)'
                        : confirmedTx ? 'rgba(52,211,153,0.35)'
                        : isA ? 'rgba(56,189,248,0.35)' : 'rgba(167,139,250,0.35)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-[12px] ${isA ? 'text-sky-700' : 'text-violet-700'}`}>
                        TX {side}: Alice → {t.to}
                      </span>
                      {confirmedTx && <CheckCircle2 size={13} className="text-emerald-500" />}
                      {rejected    && <XCircle size={13} className="text-rose-400" />}
                    </div>
                    <p className="font-mono text-[11px] text-gray-600">1.0 BTC · fee {t.fee}</p>
                    <button onClick={() => onOpenTx(t.id)}
                      className="font-mono text-[9px] text-gray-400 hover:text-gray-600 underline decoration-dotted mt-0.5">
                      {t.id.slice(0, 18)}…
                    </button>
                    {rejected    && <p className="text-[10px] text-rose-500 mt-1.5">✗ Invalid — {t.rejectReason}</p>}
                    {confirmedTx && <p className="text-[10px] text-emerald-600 mt-1.5">✓ Confirmed in block {s.blocks[t.blockId ?? '']?.label} · {conf} conf.</p>}
                    {ds.phase === 'choose' && (
                      <button onClick={() => engine.chooseDoubleSpend(side)} className="btn mt-2 w-full justify-center text-[11px]">
                        Include TX {side}
                      </button>
                    )}
                    {ds.phase === 'mining' && ds.choice === side && (
                      <p className="text-[10px] text-amber-600 mt-1.5 led-blink">⛏ Mining…</p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">
              {ds.phase === 'choose'
                ? 'Both transactions spend the same coin. Whichever gets mined first wins; the other is permanently rejected.'
                : ds.phase === 'resolved'
                  ? `${conf} confirmation(s) — each new block makes reversal exponentially harder.`
                  : 'The chosen transaction is being mined into a block…'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
