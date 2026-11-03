import { useEffect, useState } from 'react';
import { X, Copy, Check, ArrowLeft, Box, Receipt, ExternalLink } from 'lucide-react';
import type { SimState } from '../sim/engine';
import { confirmations, fmtBTC, NBITS, TARGET_HEX } from '../sim/engine';

export interface ExplorerSel { blockId?: string; txId?: string }

function Field({ label, children, mono = true }: {
  label: string; children: React.ReactNode; mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2 py-2 items-start"
      style={{ borderBottom: '1px solid rgba(243,244,246,0.80)' }}>
      <span className="text-[10px] text-gray-400 uppercase tracking-wide pt-0.5">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} text-[11.5px] text-gray-700 break-all leading-snug`}>
        {children}
      </span>
    </div>
  );
}

function Copyable({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="inline-flex items-start gap-1.5">
      <span className="break-all">{value}</span>
      <button
        onClick={() => { navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); }}
        className="shrink-0 text-gray-400 hover:text-amber-500 mt-0.5" title="Copy"
      >
        {ok ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      </button>
    </span>
  );
}

export default function ExplorerModal({
  s, sel, onClose, onOpen,
}: { s: SimState; sel: ExplorerSel; onClose: () => void; onOpen: (sel: ExplorerSel) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const block = sel.blockId ? s.blocks[sel.blockId] : undefined;
  const tx    = sel.txId   ? s.txs[sel.txId]        : undefined;
  if (!block && !tx) return null;

  const miner = block ? s.miners.find((m) => m.id === block.minerId) : undefined;
  const conf  = block ? confirmations(s, block.id) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(249,250,251,0.70)', backdropFilter: 'blur(12px)' }} />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto thin-scroll rounded-3xl modal-pop"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.90)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95)',
        }}
      >
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 rounded-t-3xl"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(229,231,235,0.60)',
          }}>
          <div className="flex items-center gap-2.5">
            {tx && block && (
              <button onClick={() => onOpen({ blockId: block.id })} className="text-gray-400 hover:text-gray-600 mr-1">
                <ArrowLeft size={15} />
              </button>
            )}
            {tx ? <Receipt size={15} className="text-indigo-400" /> : <Box size={15} className="text-emerald-500" />}
            <h3 className="font-semibold text-[14px] text-gray-800">
              {tx ? 'Transaction' : `Block #${block!.label}`}
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200 text-amber-600 bg-amber-50">
              SIMULATED
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-6">
          {tx ? (
            <div>
              {/* status banner */}
              <div className={`mb-4 rounded-2xl border px-4 py-3 text-[12px] ${
                tx.status === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : tx.status === 'rejected' || tx.status === 'void' ? 'border-rose-200 bg-rose-50 text-rose-600'
                : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                Status: <b className="uppercase">{tx.status}</b>
                {tx.rejectReason && <span className="block mt-0.5 text-[10px] opacity-80">{tx.rejectReason}</span>}
              </div>
              <Field label="Txid"><Copyable value={tx.id} /></Field>
              <Field label="Type" mono={false}>{tx.kind === 'coinbase' ? 'Coinbase — new coins as block reward' : 'Payment'}</Field>
              <Field label="From" mono={false}>
                {tx.from} <span className="block text-gray-400 text-[10px] font-mono mt-0.5">{tx.fromAddr}</span>
              </Field>
              <Field label="To" mono={false}>
                {tx.to} <span className="block text-gray-400 text-[10px] font-mono mt-0.5">{tx.toAddr}</span>
              </Field>
              <Field label="Amount"><span className="text-amber-600 font-semibold">{fmtBTC(tx.amount)} BTC</span></Field>
              <Field label="Fee">{tx.fee} BTC</Field>
              {tx.utxo && <Field label="Spends"><span className="text-rose-500">{tx.utxo}</span></Field>}
              <Field label="Seen by">{tx.seenBy.length} / {s.miners.length} nodes</Field>
              <Field label="In block" mono={false}>
                {tx.blockId && s.blocks[tx.blockId] ? (
                  <button onClick={() => onOpen({ blockId: tx.blockId })}
                    className="text-indigo-500 hover:underline inline-flex items-center gap-1">
                    Block #{s.blocks[tx.blockId].label} <ExternalLink size={11} />
                  </button>
                ) : '— unconfirmed'}
              </Field>
            </div>
          ) : block && (
            <div>
              {/* status banner */}
              <div className={`mb-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-[12px] ${
                block.status === 'stale' ? 'border-rose-200 bg-rose-50 text-rose-600'
                : block.status === 'competing' ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <span>Status: <b className="uppercase">{block.status === 'competing' ? 'Fork / Racing' : block.status}</b></span>
                <span>{block.status === 'stale' ? 'Not in active chain' : `${conf} confirmation${conf === 1 ? '' : 's'}`}</span>
              </div>
              <Field label="Block hash"><Copyable value={block.hash} /></Field>
              <Field label="Prev block">
                {s.blocks[block.prevId] ? (
                  <button onClick={() => onOpen({ blockId: block.prevId })}
                    className="text-indigo-500 hover:underline text-left break-all">{block.prevHash}</button>
                ) : <span className="text-gray-500">{block.prevHash}</span>}
              </Field>
              <Field label="Merkle root"><Copyable value={block.merkleRoot} /></Field>
              <Field label="Height">
                {block.height}
                {block.branch !== 'main' && (
                  <span className={`ml-2 ${block.branch === 'A' ? 'text-sky-600' : 'text-violet-600'}`}>
                    (branch {block.branch})
                  </span>
                )}
              </Field>
              <Field label="Timestamp">{block.time} · {new Date(block.time * 1000).toLocaleString()}</Field>
              <Field label="Version">0x{block.version.toString(16).padStart(8, '0')}</Field>
              <Field label="Nonce">
                {block.nonce.toLocaleString()}
                <span className="text-gray-400 ml-2">({block.attempts.toLocaleString()} attempts)</span>
              </Field>
              <Field label="Difficulty">
                nBits 0x{NBITS.toString(16)} · target{' '}
                <span className="text-amber-600">{TARGET_HEX.slice(0, 8)}…</span>
              </Field>
              <Field label="Miner" mono={false}>
                {miner?.flag} {miner?.name} ({miner?.country})
                {miner?.role !== 'peer' && miner && (
                  <span className={`ml-1.5 text-[10px] font-bold ${miner.role === 'A' ? 'text-sky-600' : 'text-violet-600'}`}>
                    [MINER {miner.role}]
                  </span>
                )}
              </Field>
              <Field label="Chainwork">
                {block.chainwork} units <span className="text-gray-400">(+{block.work} this block)</span>
              </Field>
              <Field label="Transactions">{block.txIds.length}</Field>

              <div className="mt-4">
                <p className="section-label">Transactions — click to inspect</p>
                <div className="space-y-1.5">
                  {block.txIds.map((tid, i) => {
                    const t = s.txs[tid];
                    if (!t) return null;
                    return (
                      <button key={tid}
                        onClick={() => onOpen({ blockId: block.id, txId: tid })}
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 hover:bg-white/70 transition-colors text-left"
                        style={{ background: 'rgba(249,250,251,0.60)', borderColor: 'rgba(229,231,235,0.70)' }}>
                        <span className="font-mono text-[9.5px] text-indigo-400 truncate">
                          {i === 0 ? '⭐ ' : ''}{tid}
                        </span>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap shrink-0">
                          {t.from} → {t.to} · {fmtBTC(t.amount)} BTC
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
