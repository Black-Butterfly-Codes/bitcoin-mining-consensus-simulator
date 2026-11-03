import { useEffect, useState } from 'react';
import { Bitcoin, Network, Link2, Cpu, BookOpen, FlaskConical, Play, Pause, RotateCcw } from 'lucide-react';
import { Engine } from './sim/engine';
import NetworkGraph from './components/NetworkGraph';
import ChainView from './components/ChainView';
import MiningPanel from './components/MiningPanel';
import { MempoolPanel, BranchPanel, RewardPanel, DoubleSpendPanel } from './components/SidePanels';
import { StatsDashboard, EventLog } from './components/StatsLog';
import GlossaryPanel from './components/GlossaryPanel';
import ExplorerModal, { type ExplorerSel } from './components/ExplorerModal';
import { Dock } from './components/Controls';

/* ── tab definition ── */
type Tab = 'network' | 'chain' | 'mining' | 'scenarios' | 'learn';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'network',   icon: <Network  size={16} />, label: 'Network',   desc: 'See all miners and live messages' },
  { id: 'chain',     icon: <Link2    size={16} />, label: 'Blockchain', desc: 'Browse blocks and transactions' },
  { id: 'mining',    icon: <Cpu      size={16} />, label: 'Mining',     desc: 'Watch proof-of-work in real time' },
  { id: 'scenarios', icon: <FlaskConical size={16} />, label: 'Scenarios', desc: 'Forks, double-spend, rewards' },
  { id: 'learn',     icon: <BookOpen size={16} />, label: 'Learn',      desc: 'Glossary and concept guide' },
];

export default function App() {
  const [engine] = useState(() => new Engine());
  const [, setV]  = useState(0);
  const [tab, setTab] = useState<Tab>('network');
  const [selectedMiner, setSelectedMiner] = useState('M0');
  const [explorer, setExplorer] = useState<ExplorerSel | null>(null);

  useEffect(() => {
    const unsub = engine.subscribe(() => setV((v) => v + 1));
    const iv    = setInterval(() => engine.tick(50), 50);
    return () => { unsub(); clearInterval(iv); };
  }, [engine]);

  const s      = engine.state;
  const miner  = s.miners.find((m) => m.id === selectedMiner) ?? s.miners[0];
  const best   = s.blocks[s.bestTipId];
  const openBlock = (id: string) => { setExplorer({ blockId: id }); setTab('chain'); };
  const openTx    = (id: string) => setExplorer((e) => ({ blockId: e?.blockId, txId: id }));

  const mm = String(Math.floor(s.time / 60)).padStart(2, '0');
  const ss = String(Math.floor(s.time % 60)).padStart(2, '0');

  return (
    <div className="min-h-screen font-body flex flex-col" style={{ color: '#374151', position: 'relative' }}>

      {/* ══════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40" style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(32px) saturate(200%) brightness(1.04)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(1.04)',
        borderBottom: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.8), 0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">

          {/* logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg,#f59e0b 0%,#f97316 50%,#ef4444 100%)',
              boxShadow: '0 3px 14px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}>
              <Bitcoin size={16} className="text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-[16px] text-gray-800 tracking-wide">
                Butterfly<span className="text-amber-500">Labs</span>
              </span>
              <p className="text-[9px] text-gray-400 leading-none mt-0.5 tracking-widest uppercase">Bitcoin Simulator</p>
            </div>
          </div>

          {/* spacer */}
          <div className="flex-1" />

          {/* quick stats */}
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-gray-500">
            <span>Block <b className="text-gray-700">{best.height}</b></span>
            <span className="font-mono">{mm}:{ss}</span>
          </div>

          {/* run controls inline */}
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => engine.startMining()}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: 'rgba(167,243,208,0.40)',
                border: '1px solid rgba(52,211,153,0.45)',
                color: '#065f46',
              }}
            >
              <Play size={11} /> Start
            </button>

            {s.running ? (
              <button onClick={() => engine.pause()}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all btn">
                <Pause size={11} /> Pause
              </button>
            ) : (
              <button onClick={() => engine.resume()}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all btn"
                style={{ borderColor: 'rgba(251,191,36,0.45)', color: '#b45309', background: 'rgba(254,243,199,0.35)' }}>
                <Play size={11} /> Resume
              </button>
            )}

            <button onClick={() => engine.reset()}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all btn"
              title="Reset simulation">
              <RotateCcw size={11} />
            </button>
          </div>

          {/* status dot */}
          <span className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full ml-1" style={{
            background: s.running ? 'rgba(167,243,208,0.30)' : 'rgba(229,231,235,0.50)',
            border: `1px solid ${s.running ? 'rgba(52,211,153,0.40)' : 'rgba(209,213,219,0.60)'}`,
            color: s.running ? '#065f46' : '#9ca3af',
          }}>
            <i className="w-1.5 h-1.5 rounded-full shrink-0" style={{
              background: s.running ? '#34d399' : '#d1d5db',
            }} />
            {s.running ? 'Live' : 'Paused'}
          </span>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          TAB BAR
      ══════════════════════════════════════════════ */}
      <div className="sticky top-14 z-30" style={{
        background: 'rgba(248,250,255,0.55)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.85)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{
                  background: tab === t.id
                    ? 'rgba(255,255,255,0.95)'
                    : 'rgba(255,255,255,0.20)',
                  color: tab === t.id ? '#1f2937' : '#9ca3af',
                  border: tab === t.id
                    ? '1px solid rgba(255,255,255,1)'
                    : '1px solid transparent',
                  boxShadow: tab === t.id
                    ? '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)'
                    : 'none',
                  backdropFilter: tab === t.id ? 'blur(8px)' : 'none',
                }}
              >
                <span style={{ color: tab === t.id ? '#f59e0b' : '#d1d5db' }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAB DESCRIPTION BANNER
      ══════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-4">
        <p className="text-[12px] text-gray-400 font-medium">
          {TABS.find((t) => t.id === tab)?.desc}
        </p>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE CONTENT — one tab at a time
      ══════════════════════════════════════════════ */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 pb-28 space-y-4">

        {/* ── NETWORK tab ── */}
        {tab === 'network' && (
          <>
            <NetworkGraph s={s} engine={engine} selected={selectedMiner} onSelect={setSelectedMiner} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatsDashboard s={s} />
              <EventLog s={s} engine={engine} />
            </div>
          </>
        )}

        {/* ── BLOCKCHAIN tab ── */}
        {tab === 'chain' && (
          <>
            <ChainView s={s} onOpen={openBlock} />
            <MempoolPanel s={s} onOpenTx={openTx} onGenerate={() => engine.generateTransactions()} />
          </>
        )}

        {/* ── MINING tab ── */}
        {tab === 'mining' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MiningPanel s={s} miner={miner} />
            <div className="space-y-4">
              {/* miner picker */}
              <section className="card">
                <div className="card-head">
                  <h2>Select a miner to inspect</h2>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {s.miners.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMiner(m.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left"
                        style={{
                          background: selectedMiner === m.id ? 'rgba(254,243,199,0.60)' : 'rgba(255,255,255,0.60)',
                          border: `1px solid ${selectedMiner === m.id ? 'rgba(251,191,36,0.50)' : 'rgba(229,231,235,0.70)'}`,
                          color: selectedMiner === m.id ? '#92400e' : '#374151',
                        }}
                      >
                        <span className="text-base">{m.flag}</span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{m.name}</p>
                          <p className="text-[10px] text-gray-400">{m.hashRate} TH/s</p>
                        </div>
                        <span
                          className="ml-auto w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: m.status === 'mining' ? '#34d399'
                              : m.status === 'found' ? '#f59e0b' : '#d1d5db',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
              <StatsDashboard s={s} />
            </div>
          </div>
        )}

        {/* ── SCENARIOS tab ── */}
        {tab === 'scenarios' && (
          <>
            {/* quick scenario buttons */}
            <section className="card">
              <div className="card-head">
                <h2>Run a scenario</h2>
                <span className="text-[10px] text-gray-400">click to trigger</span>
              </div>
              <div className="card-body grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: 'Add Transactions',
                    desc: 'Broadcast new payments to all nodes',
                    color: 'rgba(224,242,254,0.50)',
                    border: 'rgba(56,189,248,0.40)',
                    text: '#075985',
                    action: () => engine.generateTransactions(),
                    disabled: false,
                  },
                  {
                    label: 'Simultaneous Blocks',
                    desc: 'Two miners find a block at the same time',
                    color: 'rgba(254,243,199,0.50)',
                    border: 'rgba(251,191,36,0.40)',
                    text: '#92400e',
                    action: () => engine.simulateSimultaneous(true),
                    disabled: false,
                  },
                  {
                    label: 'Extend Branch A',
                    desc: 'Add a block to fork branch A',
                    color: 'rgba(224,242,254,0.50)',
                    border: 'rgba(56,189,248,0.40)',
                    text: '#075985',
                    action: () => engine.extendBranch('A'),
                    disabled: !(s.fork?.active && !s.fork.resolved),
                  },
                  {
                    label: 'Extend Branch B',
                    desc: 'Add a block to fork branch B',
                    color: 'rgba(245,243,255,0.50)',
                    border: 'rgba(167,139,250,0.40)',
                    text: '#4c1d95',
                    action: () => engine.extendBranch('B'),
                    disabled: !(s.fork?.active && !s.fork.resolved),
                  },
                  {
                    label: 'Trigger Reorg',
                    desc: 'Resolve the fork — heavier chain wins',
                    color: 'rgba(209,250,229,0.50)',
                    border: 'rgba(52,211,153,0.40)',
                    text: '#065f46',
                    action: () => engine.triggerReorg(),
                    disabled: !s.fork?.active,
                  },
                  {
                    label: 'Double Spend',
                    desc: 'Alice tries to spend the same coin twice',
                    color: 'rgba(254,226,226,0.50)',
                    border: 'rgba(248,113,113,0.40)',
                    text: '#991b1b',
                    action: () => engine.startDoubleSpend(),
                    disabled: s.ds.phase !== 'idle',
                  },
                ].map((sc) => (
                  <button
                    key={sc.label}
                    onClick={sc.action}
                    disabled={sc.disabled}
                    className="flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition-all disabled:opacity-30"
                    style={{
                      background: sc.color,
                      border: `1px solid ${sc.border}`,
                      color: sc.text,
                    }}
                  >
                    <span className="text-[13px] font-semibold">{sc.label}</span>
                    <span className="text-[11px] opacity-70">{sc.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DoubleSpendPanel s={s} engine={engine} onOpenTx={openTx} />
              <div className="space-y-4">
                <BranchPanel s={s} engine={engine} />
                <RewardPanel s={s} />
              </div>
            </div>
          </>
        )}

        {/* ── LEARN tab ── */}
        {tab === 'learn' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlossaryPanel s={s} />
            <EventLog s={s} engine={engine} />
          </div>
        )}

      </main>

      {/* ── bottom settings bar (sliders only, compact) ── */}
      <Dock s={s} engine={engine} />

      {explorer && (
        <ExplorerModal
          s={s}
          sel={explorer}
          onClose={() => setExplorer(null)}
          onOpen={setExplorer}
        />
      )}
    </div>
  );
}
