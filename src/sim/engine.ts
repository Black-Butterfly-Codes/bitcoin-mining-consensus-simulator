import {
  DEMO_BITS, DEMO_TARGET_HEX, EXPECTED_HASHES, fakeAddress, merkleRoot,
  patchNonce, reverseHex, serializeHeader, sha256d, solveHeader, toHex, txidOf, utf8,
} from './sha256';

/* ============================= Types ============================= */

export type TxStatus = 'broadcasting' | 'mempool' | 'confirmed' | 'returned' | 'rejected' | 'void';
export interface Tx {
  id: string; from: string; to: string; fromAddr: string; toAddr: string;
  amount: number; fee: number; status: TxStatus; kind: 'payment' | 'coinbase';
  seenBy: string[]; blockId?: string; utxo?: string; rejectReason?: string; createdAt: number;
}

export type Branch = 'main' | 'A' | 'B';
export type BlockStatus = 'active' | 'competing' | 'stale';
export interface Block {
  id: string; label: string; height: number; branch: Branch; status: BlockStatus;
  hash: string; prevId: string; prevHash: string; merkleRoot: string; merkleLevels: string[][];
  version: number; time: number; simTime: number; bits: number; nonce: number; attempts: number;
  minerId: string; txIds: string[]; work: number; chainwork: number; createdAt: number;
}

export interface Candidate {
  tipId: string; txIds: string[]; coinbaseId: string; coinbaseAmount: number; fees: number;
  merkleRoot: string; merkleLevels: string[][]; version: number; time: number; bits: number;
  nonce: number; attempts: number; lastHash: string; header: Uint8Array;
}

export type MinerStatus = 'idle' | 'mining' | 'found' | 'syncing';
export interface Miner {
  id: string; name: string; country: string; flag: string; x: number; y: number;
  hashRate: number; status: MinerStatus; tipId: string; hashes: number; blocksFound: number;
  reorgs: number; seenBlocks: string[]; candidate?: Candidate; lastRx: number; lastFound: number;
  role: 'A' | 'B' | 'peer';
}

export interface Packet {
  id: number; from: string; to: string; kind: 'tx' | 'block'; refId: string;
  branch: Branch; start: number; dur: number;
}
export interface LogEvent { id: number; t: number; kind: 'info' | 'tx' | 'block' | 'fork' | 'consensus' | 'reorg' | 'reward' | 'attack'; msg: string; term?: string; }

interface Prebuilt {
  minerId: string; tipId: string; branch: Branch; txIds: string[]; coinbaseId: string;
  coinbaseAmount: number; fees: number; merkleRoot: string; merkleLevels: string[][];
  version: number; time: number; bits: number; nonce: number; hash: string; attempts: number;
}

export interface ForkState {
  active: boolean; resolved: boolean; baseId: string; height: number;
  aId: string; bId: string; aTip: string; bTip: string; winner?: Branch;
}
export interface DSState {
  phase: 'idle' | 'choose' | 'mining' | 'resolved';
  txA?: string; txB?: string; choice?: 'A' | 'B'; blockId?: string;
}

export interface SimState {
  time: number; running: boolean; speed: number; latency: number; subsidy: number;
  step: number; maxStep: number; mode: 'idle' | 'live' | 'scripted';
  miners: Miner[]; edges: [number, number][];
  blocks: Record<string, Block>; txs: Record<string, Tx>;
  packets: Packet[]; events: LogEvent[];
  fork: ForkState | null; bestTipId: string;
  banner: { height: number; at: number; aLabel: string; bLabel: string } | null;
  consensusBanner: boolean;
  ds: DSState;
  stats: { hashes: number; blocksFound: number; reorgs: number; blockTimes: number[] };
  focusTerm: string; focusAt: number;
  txGenCount: number;
}

/* ============================= Constants ============================= */

const WORK_PER_BLOCK = 150;
const VERSION = 0x20000000;

const MINER_DEFS: Array<{ name: string; country: string; flag: string; x: number; y: number; rate: number; role: 'A' | 'B' | 'peer' }> = [
  { name: 'Ashoka Pool', country: 'India', flag: '🇮🇳', x: 705, y: 268, rate: 150, role: 'A' },
  { name: 'Liberty Hash', country: 'USA', flag: '🇺🇸', x: 158, y: 195, rate: 120, role: 'B' },
  { name: 'Rheinwerk', country: 'Germany', flag: '🇩🇪', x: 468, y: 128, rate: 95, role: 'peer' },
  { name: 'Sakura Mine', country: 'Japan', flag: '🇯🇵', x: 880, y: 158, rate: 85, role: 'peer' },
  { name: 'Selva BTC', country: 'Brazil', flag: '🇧🇷', x: 262, y: 388, rate: 60, role: 'peer' },
  { name: 'Maple Rig', country: 'Canada', flag: '🇨🇦', x: 175, y: 72, rate: 70, role: 'peer' },
  { name: 'Naija Nodes', country: 'Nigeria', flag: '🇳🇬', x: 462, y: 322, rate: 40, role: 'peer' },
  { name: 'Merlion Ops', country: 'Singapore', flag: '🇸🇬', x: 795, y: 398, rate: 110, role: 'peer' },
  { name: 'Geysir Farm', country: 'Iceland', flag: '🇮🇸', x: 385, y: 62, rate: 55, role: 'peer' },
  { name: 'Steppe Silicon', country: 'Kazakhstan', flag: '🇰🇿', x: 618, y: 92, rate: 75, role: 'peer' },
];

const EDGES: [number, number][] = [
  [1, 5], [1, 4], [1, 8], [5, 8], [8, 2], [2, 9], [2, 6], [4, 6],
  [6, 0], [9, 0], [0, 7], [7, 3], [9, 3], [0, 3], [6, 7], [8, 9],
];

const NAMES = ['Ivan', 'Julia', 'Ken', 'Lena', 'Miguel', 'Nadia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sven', 'Tara'];

/* ============================= Engine ============================= */

export class Engine {
  state: SimState;
  private listeners = new Set<() => void>();
  private queue: Array<{ at: number; fn: () => void }> = [];
  private snapshots: Array<SimState | undefined> = [];
  private pid = 0;
  private eid = 0;
  private blockSeq = 0;
  private pendingRace: { a: Prebuilt; b: Prebuilt; propagateNow: boolean } | null = null;
  version = 0;

  constructor() {
    this.state = this.freshState();
  }

  /* ---------- infrastructure ---------- */

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private notify() { this.version++; this.listeners.forEach((f) => f()); }
  private schedule(delay: number, fn: () => void) { this.queue.push({ at: this.state.time + delay, fn }); }

  private log(kind: LogEvent['kind'], msg: string, term?: string) {
    this.state.events.unshift({ id: this.eid++, t: this.state.time, kind, msg, term });
    if (this.state.events.length > 120) this.state.events.pop();
    if (term) { this.state.focusTerm = term; this.state.focusAt = this.state.time; }
  }

  private freshState(): SimState {
    const miners: Miner[] = MINER_DEFS.map((d, i) => ({
      id: `M${i}`, name: d.name, country: d.country, flag: d.flag, x: d.x, y: d.y,
      hashRate: d.rate, status: 'idle', tipId: 'blk100', hashes: 0, blocksFound: 0, reorgs: 0,
      seenBlocks: ['blk99', 'blk100'], lastRx: -99, lastFound: -99, role: d.role,
    }));

    // Genesis context: block 99 (stub) and a real, PoW-valid block 100.
    const prev99 = reverseHex(toHex(sha256d(utf8('nakamoto-lab-block-98'))));
    const cb100 = txidOf('coinbase:block100');
    const t99 = txidOf('historical:99:1');
    const mkHist = (n: number) => txidOf(`historical:100:${n}`);
    const histIds = [cb100, mkHist(1), mkHist(2)];
    const mr100 = merkleRoot(histIds);
    const t100 = Math.floor(Date.now() / 1000) - 540;
    const hdr = serializeHeader(VERSION, prev99, mr100.root, t100, DEMO_BITS, 0);
    const sol = solveHeader(hdr, 1000 + Math.floor(Math.random() * 50000));
    const blk99: Block = {
      id: 'blk99', label: '99', height: 99, branch: 'main', status: 'active',
      hash: prev99, prevId: '', prevHash: reverseHex(toHex(sha256d(utf8('nakamoto-lab-block-97')))),
      merkleRoot: merkleRoot([t99]).root, merkleLevels: [[t99]], version: VERSION,
      time: t100 - 620, simTime: -620, bits: DEMO_BITS, nonce: 0, attempts: 0,
      minerId: 'M2', txIds: [t99], work: WORK_PER_BLOCK, chainwork: WORK_PER_BLOCK, createdAt: -620,
    };
    const blk100: Block = {
      id: 'blk100', label: '100', height: 100, branch: 'main', status: 'active',
      hash: sol.hash, prevId: 'blk99', prevHash: prev99, merkleRoot: mr100.root, merkleLevels: mr100.levels,
      version: VERSION, time: t100, simTime: 0, bits: DEMO_BITS, nonce: sol.nonce, attempts: sol.attempts,
      minerId: 'M7', txIds: histIds, work: WORK_PER_BLOCK, chainwork: WORK_PER_BLOCK * 2, createdAt: 0,
    };

    const txs: Record<string, Tx> = {};
    txs[t99] = {
      id: t99, from: 'Coinbase', to: 'Rheinwerk', fromAddr: 'coinbase', toAddr: fakeAddress('M2'),
      amount: 3.125, fee: 0, status: 'confirmed', kind: 'coinbase', seenBy: miners.map((m) => m.id), blockId: 'blk99', createdAt: -620,
    };
    txs[cb100] = {
      id: cb100, from: 'Coinbase', to: 'Merlion Ops', fromAddr: 'coinbase', toAddr: fakeAddress('M7'),
      amount: 3.125, fee: 0, status: 'confirmed', kind: 'coinbase', seenBy: miners.map((m) => m.id), blockId: 'blk100', createdAt: 0,
    };
    const h1 = mkHist(1); const h2 = mkHist(2);
    txs[h1] = {
      id: h1, from: 'Dan', to: 'Alice', fromAddr: fakeAddress('Dan'), toAddr: fakeAddress('Alice'),
      amount: 1.0, fee: 0.0001, status: 'confirmed', kind: 'payment', seenBy: miners.map((m) => m.id),
      blockId: 'blk100', createdAt: 0,
    };
    txs[h2] = {
      id: h2, from: 'Grace', to: 'Ivan', fromAddr: fakeAddress('Grace'), toAddr: fakeAddress('Ivan'),
      amount: 0.4, fee: 0.00006, status: 'confirmed', kind: 'payment', seenBy: miners.map((m) => m.id), blockId: 'blk100', createdAt: 0,
    };

    return {
      time: 0, running: true, speed: 1, latency: 0.8, subsidy: 3.125,
      step: 0, maxStep: 0, mode: 'idle',
      miners, edges: EDGES, blocks: { blk99: blk99, blk100: blk100 }, txs,
      packets: [], events: [{ id: this.eid++, t: 0, kind: 'info', msg: 'Network initialized: 10 peers, shared tip BLOCK 100. No central server exists.', term: 'blockchain' }],
      fork: null, bestTipId: 'blk100', banner: null, consensusBanner: false,
      ds: { phase: 'idle' },
      stats: { hashes: 0, blocksFound: 0, reorgs: 0, blockTimes: [] },
      focusTerm: 'blockchain', focusAt: 0, txGenCount: 0,
    };
  }

  reset() {
    const { speed, latency, subsidy } = this.state;
    this.queue = []; this.snapshots = []; this.pendingRace = null; this.blockSeq = 0;
    this.state = this.freshState();
    this.state.speed = speed; this.state.latency = latency; this.state.subsidy = subsidy;
    this.notify();
  }

  /* ---------- helpers ---------- */

  miner(id: string): Miner { return this.state.miners.find((m) => m.id === id)!; }
  branchTip(branch: Branch): Block {
    const f = this.state.fork;
    if (f && branch !== 'main') return this.state.blocks[branch === 'A' ? f.aTip : f.bTip];
    let best = this.state.blocks[this.state.bestTipId];
    return best;
  }
  chainContains(blockId: string, txId: string): boolean {
    let b: Block | undefined = this.state.blocks[blockId];
    while (b) { if (b.txIds.includes(txId)) return true; b = this.state.blocks[b.prevId]; }
    return false;
  }
  chainTxIds(blockId: string): Set<string> {
    const set = new Set<string>();
    let b: Block | undefined = this.state.blocks[blockId];
    while (b) { b.txIds.forEach((t) => set.add(t)); b = this.state.blocks[b.prevId]; }
    return set;
  }
  branchMiners(branch: Branch): Miner[] {
    return this.state.miners.filter((m) => this.state.blocks[m.tipId]?.branch === branch);
  }
  private hopDur(a: Miner, b: Miner): number {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return this.state.latency * (0.45 + d / 900);
  }
  private peersOf(idx: number): number[] {
    const out: number[] = [];
    for (const [a, b] of this.state.edges) { if (a === idx) out.push(b); if (b === idx) out.push(a); }
    return out;
  }

  /* ---------- transactions ---------- */

  private makeTx(from: string, to: string, amount: number, fee: number, salt: string, utxo?: string): Tx {
    return {
      id: txidOf(`${from}->${to}:${amount}:${fee}:${salt}`), from, to,
      fromAddr: fakeAddress(from), toAddr: fakeAddress(to), amount, fee,
      status: 'broadcasting', kind: 'payment', seenBy: [], utxo, createdAt: this.state.time,
    };
  }

  generateTransactions() {
    const s = this.state;
    let specs: Array<[string, string, number, number]>;
    if (s.txGenCount === 0) {
      specs = [['Alice', 'Bob', 0.5, 0.00012], ['Charlie', 'David', 1.2, 0.00025], ['Eve', 'Frank', 0.25, 0.00008], ['George', 'Helen', 0.8, 0.00015]];
    } else {
      specs = [];
      for (let i = 0; i < 2; i++) {
        const a = NAMES[Math.floor(Math.random() * NAMES.length)];
        let b = NAMES[Math.floor(Math.random() * NAMES.length)];
        if (b === a) b = NAMES[(NAMES.indexOf(a) + 3) % NAMES.length];
        specs.push([a, b, Math.round((0.05 + Math.random() * 1.4) * 100) / 100, Math.round((0.00005 + Math.random() * 0.00025) * 1e5) / 1e5]);
      }
    }
    s.txGenCount++;
    specs.forEach(([f, t, amt, fee], i) => {
      const tx = this.makeTx(f, t, amt, fee, `gen${s.txGenCount}:${i}`);
      s.txs[tx.id] = tx;
      this.log('tx', `${f} → ${t}: ${amt} BTC (fee ${fee} BTC) signed & broadcast — txid ${tx.id.slice(0, 10)}…`, 'mempool');
      const origin = Math.floor(Math.random() * s.miners.length);
      this.schedule(i * 0.35, () => this.floodTx(tx.id, origin));
    });
  }

  private floodTx(txId: string, originIdx: number) {
    const s = this.state;
    const tx = s.txs[txId];
    if (!tx) return;
    const origin = s.miners[originIdx];
    if (!tx.seenBy.includes(origin.id)) tx.seenBy.push(origin.id);
    tx.status = tx.status === 'broadcasting' ? 'mempool' : tx.status;
    origin.lastRx = s.time;
    for (const p of this.peersOf(originIdx)) {
      s.packets.push({ id: this.pid++, from: origin.id, to: s.miners[p].id, kind: 'tx', refId: txId, branch: 'main', start: s.time, dur: this.hopDur(origin, s.miners[p]) });
    }
  }

  private deliverTx(miner: Miner, txId: string) {
    const tx = this.state.txs[txId];
    if (!tx || tx.seenBy.includes(miner.id)) return;
    // Validation: reject if it spends a UTXO already spent in this node's chain.
    if (tx.utxo && this.utxoSpentIn(miner.tipId, tx.utxo, txId)) {
      if (!tx.seenBy.includes(miner.id)) tx.seenBy.push(miner.id);
      return;
    }
    tx.seenBy.push(miner.id);
    if (tx.status === 'broadcasting') tx.status = 'mempool';
    miner.lastRx = this.state.time;
    const idx = this.state.miners.indexOf(miner);
    for (const p of this.peersOf(idx)) {
      const peer = this.state.miners[p];
      if (!tx.seenBy.includes(peer.id)) {
        this.state.packets.push({ id: this.pid++, from: miner.id, to: peer.id, kind: 'tx', refId: txId, branch: 'main', start: this.state.time, dur: this.hopDur(miner, peer) });
      }
    }
    if (this.state.mode !== 'idle') this.rebuildCandidate(miner);
  }

  private utxoSpentIn(tipId: string, utxo: string, exceptTx: string): boolean {
    for (const id of this.chainTxIds(tipId)) {
      const t = this.state.txs[id];
      if (t && t.utxo === utxo && t.id !== exceptTx && t.kind === 'payment' && t.status === 'confirmed') return true;
    }
    return false;
  }

  /* ---------- candidate blocks & mining ---------- */

  private selectTxs(miner: Miner, tipId: string, priority?: string): { txIds: string[]; fees: number } {
    const chain = this.chainTxIds(tipId);
    const spentUtxos = new Set<string>();
    chain.forEach((id) => { const t = this.state.txs[id]; if (t?.utxo && t.kind === 'payment') spentUtxos.add(t.utxo); });
    const pool = Object.values(this.state.txs).filter((t) =>
      t.kind === 'payment' && (t.status === 'mempool' || t.status === 'returned') &&
      t.seenBy.includes(miner.id) && !chain.has(t.id) &&
      !(t.utxo && spentUtxos.has(t.utxo)),
    );
    pool.sort((a, b) => b.fee - a.fee);
    const chosen: Tx[] = [];
    const usedUtxo = new Set<string>();
    if (priority) { const p = pool.find((t) => t.id === priority); if (p) { chosen.push(p); if (p.utxo) usedUtxo.add(p.utxo); } }
    for (const t of pool) {
      if (chosen.length >= 4) break;
      if (chosen.includes(t)) continue;
      if (t.utxo && usedUtxo.has(t.utxo)) continue;
      chosen.push(t); if (t.utxo) usedUtxo.add(t.utxo);
    }
    return { txIds: chosen.map((t) => t.id), fees: Math.round(chosen.reduce((s2, t) => s2 + t.fee, 0) * 1e8) / 1e8 };
  }

  rebuildCandidate(miner: Miner) {
    const s = this.state;
    if (miner.status === 'idle') return;
    const tipId = miner.tipId;
    const { txIds, fees } = this.selectTxs(miner, tipId);
    const coinbaseId = txidOf(`coinbase:${tipId}:${miner.id}:${fees}:${s.subsidy}`);
    const mr = merkleRoot([coinbaseId, ...txIds]);
    const time = Math.floor(Date.now() / 1000);
    const header = serializeHeader(VERSION, s.blocks[tipId].hash, mr.root, time, DEMO_BITS, 0);
    const nonce = Math.floor(Math.random() * 4e9);
    miner.candidate = {
      tipId, txIds, coinbaseId, coinbaseAmount: s.subsidy + fees, fees,
      merkleRoot: mr.root, merkleLevels: mr.levels, version: VERSION, time, bits: DEMO_BITS,
      nonce, attempts: 0, lastHash: '', header,
    };
  }

  private prebuild(miner: Miner, tipId: string, branch: Branch, priority?: string): Prebuilt {
    const s = this.state;
    const { txIds, fees } = this.selectTxs(miner, tipId, priority);
    const coinbaseId = txidOf(`coinbase:${tipId}:${miner.id}:${fees}:${s.subsidy}`);
    const mr = merkleRoot([coinbaseId, ...txIds]);
    const time = Math.floor(Date.now() / 1000);
    const header = serializeHeader(VERSION, s.blocks[tipId].hash, mr.root, time, DEMO_BITS, 0);
    const sol = solveHeader(header, Math.floor(Math.random() * 4e9));
    s.stats.hashes += sol.attempts;
    miner.hashes += sol.attempts;
    return {
      minerId: miner.id, tipId, branch, txIds, coinbaseId, coinbaseAmount: s.subsidy + fees, fees,
      merkleRoot: mr.root, merkleLevels: mr.levels, version: VERSION, time, bits: DEMO_BITS,
      nonce: sol.nonce, hash: sol.hash, attempts: sol.attempts,
    };
  }

  startMining() {
    const s = this.state;
    s.running = true;
    s.mode = 'live';
    s.miners.forEach((m) => { m.status = 'mining'; this.rebuildCandidate(m); });
    this.log('info', `Free mining started — real SHA-256d, target ${DEMO_TARGET_HEX.slice(0, 8)}… (≈1 in 4096 hashes valid).`, 'pow');
    this.notify();
  }
  pause() { this.state.running = false; this.log('info', 'Simulation paused — hashing and propagation frozen.'); this.notify(); }
  focus(term: string) { this.state.focusTerm = term; this.state.focusAt = this.state.time + Math.random() * 0.001; this.notify(); }
  resume() { this.state.running = true; this.log('info', 'Simulation resumed.'); this.notify(); }
  setSpeed(v: number) { this.state.speed = v; this.notify(); }
  setLatency(v: number) { this.state.latency = v; this.notify(); }
  setSubsidy(v: number) { this.state.subsidy = Math.max(0, v); this.notify(); }
  bumpRate(role: 'A' | 'B', delta: number) {
    const m = this.state.miners.find((x) => x.role === role)!;
    m.hashRate = Math.min(500, Math.max(10, m.hashRate + delta));
    this.log('info', `Miner ${role} (${m.country}) hash rate → ${m.hashRate} TH/s.`, 'hashrate');
    this.notify();
  }

  /* ---------- block finalization & propagation ---------- */

  private finalize(pb: Prebuilt): Block {
    const s = this.state;
    const parent = s.blocks[pb.tipId];
    // Descendants of a fork branch inherit its branch label.
    if (pb.branch === 'main' && parent.branch !== 'main' && s.fork?.active) pb.branch = parent.branch;
    const height = parent.height + 1;
    const label = `${height}${pb.branch === 'main' ? '' : pb.branch}`;
    const id = `blk-${label}-${this.blockSeq++}`;
    const miner = this.miner(pb.minerId);

    // Coinbase transaction materializes with the block.
    s.txs[pb.coinbaseId] = {
      id: pb.coinbaseId, from: 'Coinbase', to: miner.name, fromAddr: 'coinbase (new coins)',
      toAddr: fakeAddress(miner.id + id), amount: pb.coinbaseAmount, fee: 0, status: 'confirmed',
      kind: 'coinbase', seenBy: [miner.id], blockId: id, createdAt: s.time,
    };
    const block: Block = {
      id, label, height, branch: pb.branch, status: 'active', hash: pb.hash, prevId: pb.tipId,
      prevHash: parent.hash, merkleRoot: pb.merkleRoot, merkleLevels: pb.merkleLevels,
      version: pb.version, time: pb.time, simTime: s.time, bits: pb.bits, nonce: pb.nonce,
      attempts: pb.attempts, minerId: pb.minerId, txIds: [pb.coinbaseId, ...pb.txIds],
      work: WORK_PER_BLOCK, chainwork: parent.chainwork + WORK_PER_BLOCK, createdAt: s.time,
    };
    s.blocks[id] = block;
    s.stats.blocksFound++;
    s.stats.blockTimes.push(s.time);
    miner.blocksFound++;
    miner.status = 'found';
    miner.lastFound = s.time;
    miner.tipId = id;
    if (!miner.seenBlocks.includes(id)) miner.seenBlocks.push(id);
    this.schedule(1.4, () => { if (miner.status === 'found') miner.status = s.mode === 'idle' ? 'idle' : 'mining'; });

    // Confirm payment txs on this branch.
    pb.txIds.forEach((tid) => {
      const t = s.txs[tid];
      if (t) { t.status = 'confirmed'; t.blockId = id; }
    });

    // Fork detection: sibling at same height on same parent.
    const sibling = Object.values(s.blocks).find((b) => b.id !== id && b.height === height && b.prevId === pb.tipId && b.status !== 'stale');
    if (sibling && (!s.fork || !s.fork.active || s.fork.height !== height)) {
      const aBlock = sibling.createdAt <= block.createdAt ? sibling : block;
      const bBlock = aBlock === block ? sibling : block;
      aBlock.branch = 'A'; bBlock.branch = 'B';
      aBlock.label = `${height}A`; bBlock.label = `${height}B`;
      aBlock.status = 'competing'; bBlock.status = 'competing';
      s.fork = { active: true, resolved: false, baseId: pb.tipId, height, aId: aBlock.id, bId: bBlock.id, aTip: aBlock.id, bTip: bBlock.id };
      this.log('fork', `⚡ TEMPORARY FORK at height ${height}: ${aBlock.label} and ${bBlock.label} both reference BLOCK ${parent.label}. Both are valid!`, 'fork');
    } else if (s.fork?.active && pb.branch !== 'main') {
      if (pb.branch === 'A') s.fork.aTip = id; else s.fork.bTip = id;
      block.status = s.fork.resolved ? (s.fork.winner === pb.branch ? 'active' : 'stale') : 'competing';
    }

    this.recomputeBest();
    this.log('block', `⛏ BLOCK ${label} FOUND by ${miner.name} (${miner.country}) — nonce ${pb.nonce.toLocaleString()}, hash ${pb.hash.slice(0, 14)}… < target ✓`, pb.branch === 'main' ? 'pow' : 'fork');
    this.rebuildCandidate(miner);
    if (s.mode === 'live') this.checkOrganicResolution();
    return block;
  }

  private recomputeBest() {
    const s = this.state;
    let best = s.blocks[s.bestTipId];
    for (const b of Object.values(s.blocks)) {
      if (b.status === 'stale') continue;
      if (b.chainwork > best.chainwork || (b.chainwork === best.chainwork && b.createdAt < best.createdAt)) best = b;
    }
    s.bestTipId = best.id;
  }

  propagateBlock(blockId: string, sourceId: string, restrict?: Set<string>) {
    const s = this.state;
    const block = s.blocks[blockId];
    const src = this.miner(sourceId);
    const idx = s.miners.indexOf(src);
    for (const p of this.peersOf(idx)) {
      const peer = s.miners[p];
      if (restrict && !restrict.has(peer.id)) continue;
      s.packets.push({ id: this.pid++, from: src.id, to: peer.id, kind: 'block', refId: blockId, branch: block.branch, start: s.time, dur: this.hopDur(src, peer) });
    }
  }

  private deliverBlock(miner: Miner, blockId: string) {
    const s = this.state;
    const block = s.blocks[blockId];
    if (!block || miner.seenBlocks.includes(blockId)) return;
    // Independent validation: real PoW check + known parent.
    if (!(block.hash < DEMO_TARGET_HEX) || !s.blocks[block.prevId]) return;
    miner.seenBlocks.push(blockId);
    miner.lastRx = s.time;
    block.txIds.forEach((tid) => { const s2 = s.txs[tid]; if (s2 && !s2.seenBy.includes(miner.id)) s2.seenBy.push(miner.id); });

    const idx = s.miners.indexOf(miner);
    this.considerTip(miner, block);

    // Relay onward regardless (nodes relay valid blocks even if not adopted).
    // Guided mode: the competing tip hasn't crossed the partition yet — relay only to
    // same-branch or still-undecided nodes, never to nodes already on the other branch.
    const restrict = s.fork?.active && !s.fork.resolved && s.mode === 'scripted' && block.branch !== 'main'
      ? new Set(s.miners.filter((m) => { const tb = s.blocks[m.tipId]?.branch; return tb === block.branch || tb === 'main'; }).map((m) => m.id).concat(miner.id))
      : undefined;
    for (const p of this.peersOf(idx)) {
      const peer = s.miners[p];
      if (restrict && !restrict.has(peer.id)) continue;
      if (!peer.seenBlocks.includes(blockId)) {
        s.packets.push({ id: this.pid++, from: miner.id, to: peer.id, kind: 'block', refId: blockId, branch: block.branch, start: s.time, dur: this.hopDur(miner, peer) });
      }
    }
  }

  /** Independent node decision: adopt heavier valid chain, else keep first-seen tip. */
  private considerTip(miner: Miner, block: Block) {
    const s = this.state;
    const tip = s.blocks[miner.tipId];
    if (block.id === tip.id) return;
    if (block.chainwork > tip.chainwork) {
      const isExtension = block.prevId === tip.id;
      if (!isExtension && tip.branch !== 'main' && block.branch !== tip.branch && s.fork?.active) {
        miner.reorgs++; s.stats.reorgs++;
        this.returnOrphanedTxs(tip.id, block.id);
        this.log('reorg', `↻ ${miner.name} (${miner.country}) REORG: drops ${tip.label} → adopts ${block.label} (chainwork ${block.chainwork} > ${tip.chainwork}).`, 'reorg');
      }
      miner.tipId = block.id;
      if (miner.status !== 'idle') this.rebuildCandidate(miner);
    } else if (block.height === tip.height && block.prevId === tip.prevId) {
      this.log('fork', `${miner.flag} ${miner.name} saw ${tip.label} first — keeps it as tip (valid alternative ${block.label} stored).`, 'fork');
    }
  }

  private returnOrphanedTxs(oldTipId: string, newTipId: string) {
    const s = this.state;
    const newChain = this.chainTxIds(newTipId);
    let b: Block | undefined = s.blocks[oldTipId];
    const base = s.fork?.baseId;
    while (b && b.id !== base && b.branch !== 'main') {
      for (const tid of b.txIds) {
        const t = s.txs[tid];
        if (!t || newChain.has(tid)) continue;
        if (t.kind === 'coinbase') { t.status = 'void'; t.rejectReason = 'Stale block — coinbase no longer exists'; continue; }
        if (t.utxo && this.utxoSpentIn(newTipId, t.utxo, tid)) {
          t.status = 'rejected'; t.rejectReason = 'Conflicts with a transaction confirmed in the winning chain';
        } else {
          t.status = 'returned'; t.blockId = undefined;
        }
      }
      b = s.blocks[b.prevId];
    }
  }

  /* ---------- scenario: simultaneous discovery ---------- */

  simulateSimultaneous(propagateNow: boolean) {
    const s = this.state;
    if (s.fork?.active && !s.fork.resolved) { this.log('info', 'A fork is already in progress — extend branches or trigger reorganization.'); return; }
    s.running = true;
    s.mode = 'scripted';
    const tip = s.blocks[s.bestTipId];
    const mA = this.miner('M0'); const mB = this.miner('M1');
    mA.tipId = tip.id; mB.tipId = tip.id;
    mA.status = 'mining'; mB.status = 'mining';
    s.miners.forEach((m) => { if (m.status === 'idle') { m.status = 'mining'; } this.rebuildCandidate(m); });
    this.log('info', `Race armed: Miner A (India, ${mA.hashRate} TH/s) and Miner B (USA, ${mB.hashRate} TH/s) mine on BLOCK ${tip.label}. Real nonces are being brute-forced…`, 'pow');
    const a = this.prebuild(mA, tip.id, 'A');
    const b = this.prebuild(mB, tip.id, 'B');
    this.pendingRace = { a, b, propagateNow };
    this.schedule(1.1, () => this.revealRace('A'));
    this.schedule(1.5, () => this.revealRace('B'));
    this.notify();
  }

  private revealRace(side: 'A' | 'B') {
    const s = this.state;
    const race = this.pendingRace;
    if (!race) return;
    const pb = side === 'A' ? race.a : race.b;
    const miner = this.miner(pb.minerId);
    miner.candidate && (miner.candidate.attempts = pb.attempts);
    const block = this.finalize(pb);
    this.log('block', `⚡ MINER ${side} → BLOCK ${block.label} FOUND! Valid Proof of Work: ${pb.attempts.toLocaleString()} real SHA-256d attempts.`, 'fork');
    if (side === 'B') {
      s.banner = { height: block.height, at: s.time, aLabel: s.blocks[s.fork!.aId].label, bLabel: s.blocks[s.fork!.bId].label };
      this.schedule(6, () => { if (s.banner && s.time - s.banner.at >= 5.5) s.banner = null; });
      if (race.propagateNow) {
        this.propagateBlock(s.fork!.aId, 'M0');
        this.propagateBlock(s.fork!.bId, 'M1');
      }
      this.pendingRace = null;
    } else if (race.propagateNow) {
      this.propagateBlock(block.id, miner.id);
    }
    this.notify();
  }

  releasePropagation() {
    const s = this.state;
    if (!s.fork?.active) return;
    this.propagateBlock(s.fork.aTip, this.state.blocks[s.fork.aTip].minerId);
    this.propagateBlock(s.fork.bTip, this.state.blocks[s.fork.bTip].minerId);
    this.log('info', 'Both blocks now flood the network hop-by-hop. Distant nodes receive different winners first…', 'propagation');
    this.notify();
  }

  /* ---------- scenario: branch extension ---------- */

  private extendAt: Record<'A' | 'B', number> = { A: 0, B: 0 };

  extendBranch(branch: 'A' | 'B', delay = 0.9) {
    const s = this.state;
    if (!s.fork?.active) { this.log('info', 'No fork to extend — run Simultaneous Mining first.'); this.notify(); return; }
    // Serialize per-branch so rapid clicks chain correctly; resolve the parent at fire time.
    const at = Math.max(s.time + delay, this.extendAt[branch] + 1.3);
    this.extendAt[branch] = at;
    this.schedule(at - s.time, () => {
      const f = s.fork;
      if (!f?.active) return;
      if (f.resolved && f.winner !== branch) { this.log('info', `Branch ${branch} is stale — its blocks are no longer extended. Reset to replay.`); return; }
      const tip = branch === 'A' ? s.blocks[f.aTip] : s.blocks[f.bTip];
      const supporters = this.branchMiners(branch);
      const pool = supporters.length ? supporters : [this.miner(branch === 'A' ? 'M0' : 'M1')];
      const miner = pool[Math.floor(Math.random() * pool.length)];
      const pb = this.prebuild(miner, tip.id, branch);
      const block = this.finalize(pb);
      const guided = s.mode === 'scripted' && !f.resolved;
      const restrict = guided
        ? new Set(s.miners.filter((m) => { const tb = s.blocks[m.tipId]?.branch; return tb === branch || tb === 'main'; }).map((m) => m.id).concat(miner.id))
        : undefined;
      this.propagateBlock(block.id, miner.id, restrict);
      if (!guided) this.checkOrganicResolution();
      this.notify();
    });
    this.log('info', `Branch ${branch}: a supporting miner is extending the ${branch}-chain…`, 'chainwork');
    this.notify();
  }

  private checkOrganicResolution() {
    const s = this.state;
    const f = s.fork;
    if (!f || f.resolved) return;
    const a = s.blocks[f.aTip]; const b = s.blocks[f.bTip];
    if (a.chainwork === b.chainwork) return;
    const winner: Branch = a.chainwork > b.chainwork ? 'A' : 'B';
    this.resolveFork(winner, 'The next block broke the tie — the heavier branch is now flooding the whole network.');
  }

  private resolveFork(winner: 'A' | 'B', why: string) {
    const s = this.state;
    const f = s.fork!;
    f.resolved = true; f.winner = winner;
    const winTip = winner === 'A' ? f.aTip : f.bTip;
    const loseTip = winner === 'A' ? f.bTip : f.aTip;
    const wB = s.blocks[winTip]; const lB = s.blocks[loseTip];
    // Mark branch statuses; re-point shared transactions to the winning chain.
    let b: Block | undefined = wB;
    while (b && b.id !== f.baseId) {
      b.status = 'active';
      b.txIds.forEach((tid) => { const t = s.txs[tid]; if (t && t.status !== 'void') { t.status = 'confirmed'; t.blockId = b!.id; } });
      b = s.blocks[b.prevId];
    }
    b = lB;
    while (b && b.id !== f.baseId) { b.status = 'stale'; b = s.blocks[b.prevId]; }
    s.consensusBanner = true;
    this.recomputeBest();
    this.log('consensus', `GREATEST CUMULATIVE PROOF OF WORK DETECTED → Branch ${winner} (${wB.chainwork} vs ${lB.chainwork} units). ${why}`, 'consensus');
  }

  triggerReorg() {
    const s = this.state;
    const f = s.fork;
    if (!f?.active) { this.log('info', 'Nothing to reorganize — no active fork.'); this.notify(); return; }
    const a = s.blocks[f.aTip]; const b = s.blocks[f.bTip];
    if (a.chainwork === b.chainwork) {
      this.log('consensus', `Chainwork is TIED (${a.chainwork} = ${b.chainwork}). Nodes keep their first-seen tip — extend a branch to break the tie.`, 'consensus');
      this.notify(); return;
    }
    const winner: 'A' | 'B' = a.chainwork > b.chainwork ? 'A' : 'B';
    if (!f.resolved) this.resolveFork(winner, 'Each node will switch independently as the heavier chain reaches it.');
    const winTipId = winner === 'A' ? f.aTip : f.bTip;
    const winTip = s.blocks[winTipId];
    const laggers = s.miners.filter((m) => s.blocks[m.tipId].branch !== winner && s.blocks[m.tipId].branch !== 'main' || (m.tipId !== winTipId && this.state.blocks[m.tipId].chainwork < winTip.chainwork));
    laggers.forEach((m, i) => {
      this.schedule(0.4 + i * Math.max(0.35, s.latency * 0.8), () => {
        // Deliver the winning tip (and any missing ancestors) directly to this node.
        let cursor: Block | undefined = winTip;
        const missing: Block[] = [];
        while (cursor && !m.seenBlocks.includes(cursor.id)) { missing.unshift(cursor); cursor = s.blocks[cursor.prevId]; }
        missing.forEach((blk) => this.deliverBlock(m, blk.id));
        // Force re-evaluation even if every winning block was already stored as an alternative.
        this.considerTip(m, winTip);
        this.notify();
      });
    });
    this.log('reorg', 'Reorganization wave started — nodes switch one by one as they learn of the heavier chain. Never all at once.', 'reorg');
    this.notify();
  }

  /* ---------- scenario: double spend ---------- */

  startDoubleSpend() {
    const s = this.state;
    if (s.ds.phase !== 'idle') { this.log('attack', 'Double-spend scenario already running.'); return; }
    if (s.fork?.active && !s.fork.resolved) this.triggerReorg();
    s.running = true;
    const salt = `ds:${s.time}`;
    const txA = this.makeTx('Alice', 'Bob', 1.0, 0.00012, salt + ':A', 'alice:0');
    const txB = this.makeTx('Alice', 'Charlie', 1.0, 0.00018, salt + ':B', 'alice:0');
    s.txs[txA.id] = txA; s.txs[txB.id] = txB;
    s.ds = { phase: 'choose', txA: txA.id, txB: txB.id };
    this.log('attack', `🚨 DOUBLE-SPEND: Alice signs TWO transactions spending the same UTXO (alice:0, 1 BTC from BLOCK 100): → Bob and → Charlie.`, 'doublespend');
    // Opposite corners of the network hear different stories first.
    this.floodTx(txA.id, 0);
    this.schedule(0.3, () => this.floodTx(txB.id, 1));
    this.notify();
  }

  chooseDoubleSpend(side: 'A' | 'B') {
    const s = this.state;
    if (s.ds.phase !== 'choose') return;
    s.ds.phase = 'mining'; s.ds.choice = side;
    const chosenId = (side === 'A' ? s.ds.txA : s.ds.txB)!;
    const rejectedId = (side === 'A' ? s.ds.txB : s.ds.txA)!;
    const tip = s.blocks[s.bestTipId];
    const miner = this.miner('M1');
    miner.tipId = tip.id;
    if (!miner.seenBlocks.includes(tip.id)) miner.seenBlocks.push(tip.id);
    s.txs[chosenId].seenBy = s.miners.map((m) => m.id);
    s.txs[rejectedId].seenBy = s.miners.map((m) => m.id);
    this.log('attack', `Scenario control: the next block will include Alice → ${side === 'A' ? 'Bob' : 'Charlie'}. Both txs are individually valid — only consensus can pick one.`, 'doublespend');
    this.schedule(0.8, () => {
      const pb = this.prebuild(miner, tip.id, 'main', chosenId);
      const block = this.finalize(pb);
      s.ds.blockId = block.id;
      const rej = s.txs[rejectedId];
      rej.status = 'rejected';
      rej.rejectReason = `UTXO alice:0 already spent by tx ${chosenId.slice(0, 10)}… in BLOCK ${block.label}`;
      this.propagateBlock(block.id, miner.id);
      this.log('attack', `BLOCK ${block.label} confirms Alice → ${side === 'A' ? 'Bob' : 'Charlie'}. The conflict is now INVALID everywhere: its input no longer exists.`, 'doublespend');
      // Two confirmation blocks.
      this.schedule(2.2, () => this.mineQuick('M3'));
      this.schedule(4.6, () => { this.mineQuick('M7'); s.ds.phase = 'resolved'; this.log('consensus', '3 confirmations bury the accepted spend. Reversing it now requires re-mining 3 blocks against the whole network.', 'confirmations'); this.notify(); });
      this.notify();
    });
    this.notify();
  }

  private mineQuick(minerId: string) {
    const s = this.state;
    const tip = s.blocks[s.bestTipId];
    const miner = this.miner(minerId);
    miner.tipId = tip.id;
    const pb = this.prebuild(miner, tip.id, 'main');
    const block = this.finalize(pb);
    this.propagateBlock(block.id, miner.id);
  }

  /* ---------- guided lesson ---------- */

  gotoStep(n: number) {
    const s = this.state;
    const target = Math.max(0, Math.min(10, n));
    if (target === s.step) return;
    if (target < s.step) {
      const snap = this.snapshots[target];
      if (snap) {
        this.queue = []; this.pendingRace = null;
        this.state = structuredClone(snap);
        this.state.packets = [];
      }
      this.state.step = target;
      this.enterStep(target);
    } else {
      this.snapshots[s.step] = structuredClone(s);
      this.state.step = s.step + 1;
      this.state.maxStep = Math.max(this.state.maxStep, this.state.step);
      this.enterStep(this.state.step);
      if (target > this.state.step) { this.gotoStep(target); return; }
    }
    this.notify();
  }
  next() { this.gotoStep(this.state.step + 1); }
  prev() { this.gotoStep(this.state.step - 1); }

  private enterStep(n: number) {
    const s = this.state;
    s.running = true;
    const terms = ['blockchain', 'mempool', 'pow', 'fork', 'propagation', 'chainwork', 'consensus', 'reorg', 'subsidy', 'doublespend', 'confirmations'];
    s.focusTerm = terms[n]; s.focusAt = s.time;
    switch (n) {
      case 0: break;
      case 1: if (s.txGenCount === 0) this.generateTransactions(); break;
      case 2: this.startMining(); break;
      case 3: s.banner = null; this.simulateSimultaneous(false); break;
      case 4: this.releasePropagation(); break;
      case 5:
        if (s.fork?.active) {
          const f = s.fork;
          const aH = s.blocks[f.aTip].height, bH = s.blocks[f.bTip].height;
          if (aH === f.height && bH === f.height) {
            this.extendBranch('A', 0.8);
            this.extendBranch('B', 2.1);
            this.extendBranch('B', 3.6);
          }
        }
        break;
      case 6: {
        if (s.fork?.active) {
          const a = s.blocks[s.fork.aTip]; const b = s.blocks[s.fork.bTip];
          s.consensusBanner = true;
          this.log('consensus', `Node rule check → Branch A chainwork ${a.chainwork} vs Branch B chainwork ${b.chainwork}. ${a.chainwork === b.chainwork ? 'Tied — extend a branch.' : `Branch ${a.chainwork > b.chainwork ? 'A' : 'B'} is heavier; nodes on the lighter branch will switch as they hear about it.`}`, 'consensus');
        }
        break;
      }
      case 7: this.triggerReorg(); break;
      case 8: {
        const paid = Object.values(s.blocks).filter((b) => b.status === 'active' && b.branch !== 'main');
        const stale = Object.values(s.blocks).filter((b) => b.status === 'stale');
        this.log('reward', `Rewards: ${paid.length} winning block(s) keep subsidy (${s.subsidy} BTC) + fees. ${stale.length} stale block(s) earn NOTHING — Bitcoin never splits the reward.`, 'subsidy');
        break;
      }
      case 9: this.startDoubleSpend(); break;
      case 10: this.log('info', 'Lesson complete. Every block and transaction remains clickable in the explorer. Reset to replay, or keep experimenting.', 'confirmations'); break;
    }
  }

  /* ---------- tick ---------- */

  tick(dtMs: number) {
    const s = this.state;
    if (s.running) {
      const dt = (dtMs / 1000) * s.speed;
      s.time += dt;

      // Scheduled scenario events.
      const due = this.queue.filter((q) => q.at <= s.time);
      this.queue = this.queue.filter((q) => q.at > s.time);
      due.sort((a, b) => a.at - b.at).forEach((q) => q.fn());

      // Packets in flight.
      const arrived = s.packets.filter((p) => s.time >= p.start + p.dur);
      s.packets = s.packets.filter((p) => s.time < p.start + p.dur);
      for (const p of arrived) {
        const m = this.miner(p.to);
        if (p.kind === 'tx') this.deliverTx(m, p.refId);
        else this.deliverBlock(m, p.refId);
      }

      // Real hashing.
      if (s.mode !== 'idle') {
        for (const m of s.miners) {
          if (m.status !== 'mining' || !m.candidate || m.candidate.tipId !== m.tipId) {
            if (m.status === 'mining' && (!m.candidate || m.candidate.tipId !== m.tipId)) this.rebuildCandidate(m);
            if (m.status !== 'mining') continue;
          }
          const c = m.candidate!;
          const batch = Math.max(1, Math.min(64, Math.round((m.hashRate / 150) * 2.2 * s.speed * (dtMs / 50))));
          let found = false;
          for (let i = 0; i < batch; i++) {
            patchNonce(c.header, c.nonce);
            const disp = reverseHex(toHex(sha256d(c.header)));
            c.attempts++; m.hashes++; s.stats.hashes++;
            c.lastHash = disp;
            c.nonce = (c.nonce + 1) >>> 0;
            if (s.mode === 'live' && disp < DEMO_TARGET_HEX) {
              const pb: Prebuilt = {
                minerId: m.id, tipId: c.tipId, branch: 'main', txIds: c.txIds, coinbaseId: c.coinbaseId,
                coinbaseAmount: c.coinbaseAmount, fees: c.fees, merkleRoot: c.merkleRoot, merkleLevels: c.merkleLevels,
                version: c.version, time: c.time, bits: c.bits, nonce: (c.nonce - 1) >>> 0, hash: disp, attempts: c.attempts,
              };
              const block = this.finalize(pb);
              this.propagateBlock(block.id, m.id);
              found = true;
              break;
            }
          }
          void found;
        }
      }
    }
    this.notify();
  }
}

/* ---------- derived helpers for UI ---------- */

export function chainPath(blocks: Record<string, Block>, tipId: string): Block[] {
  const out: Block[] = [];
  let b: Block | undefined = blocks[tipId];
  while (b) { out.unshift(b); b = blocks[b.prevId]; }
  return out;
}

export function confirmations(s: SimState, blockId?: string): number {
  if (!blockId) return 0;
  const blk = s.blocks[blockId];
  if (!blk || blk.status === 'stale') return 0;
  return Math.max(0, s.blocks[s.bestTipId].height - blk.height + 1);
}

export function fmtBTC(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export function mempoolFor(s: SimState, minerId?: string): Tx[] {
  return Object.values(s.txs).filter((t) =>
    t.kind === 'payment' && (t.status === 'mempool' || t.status === 'returned' || t.status === 'broadcasting') &&
    (!minerId || t.seenBy.includes(minerId)),
  );
}

export const EXPECTED = EXPECTED_HASHES;
export const TARGET_HEX = DEMO_TARGET_HEX;
export const NBITS = DEMO_BITS;