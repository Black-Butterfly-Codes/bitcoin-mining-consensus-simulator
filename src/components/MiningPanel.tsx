import { useEffect, useRef } from 'react';
import { Cpu, Hash, TreeDeciduous } from 'lucide-react';
import type { SimState, Miner } from '../sim/engine';
import { EXPECTED, TARGET_HEX, NBITS } from '../sim/engine';

function MerkleTree({ levels }: { levels: string[][] }) {
  if (!levels.length || !levels[0].length) return null;
  const W = 300; const rowH = 30;
  const H = levels.length * rowH + 6;
  const pos = (li: number, i: number, count: number) => ({
    x: (W / (count + 1)) * (i + 1),
    y: H - 12 - li * rowH,
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {levels.map((lv, li) =>
        li < levels.length - 1 &&
        lv.map((_, i) => {
          const parentCount = levels[li + 1].length;
          const p = pos(li + 1, Math.floor(i / 2), parentCount);
          const c = pos(li, i, lv.length);
          return (
            <line key={`${li}-${i}`} x1={c.x} y1={c.y - 7} x2={p.x} y2={p.y + 7}
              stroke="rgba(209,213,219,0.70)" strokeWidth="1" />
          );
        }),
      )}
      {levels.map((lv, li) =>
        lv.map((h, i) => {
          const p = pos(li, i, lv.length);
          const isRoot = li === levels.length - 1;
          const isCb   = li === 0 && i === 0;
          return (
            <g key={`${li}-${i}-n`}>
              <rect x={p.x - 26} y={p.y - 7} width={52} height={14} rx={5}
                fill={isRoot ? 'rgba(209,250,229,0.60)' : isCb ? 'rgba(254,243,199,0.60)' : 'rgba(255,255,255,0.60)'}
                stroke={isRoot ? 'rgba(52,211,153,0.40)' : isCb ? 'rgba(251,191,36,0.40)' : 'rgba(209,213,219,0.50)'}
                strokeWidth="1" />
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="7.5"
                fontFamily="IBM Plex Mono, monospace"
                fill={isRoot ? '#065f46' : isCb ? '#92400e' : '#9ca3af'}>
                {isCb ? 'coinbase' : h.slice(0, 8)}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}

export default function MiningPanel({ s, miner }: { s: SimState; miner: Miner }) {
  const c = miner.candidate;
  const feedRef = useRef<string[]>([]);

  useEffect(() => {
    if (c?.lastHash && feedRef.current[0] !== c.lastHash) {
      feedRef.current = [c.lastHash, ...feedRef.current].slice(0, 3);
    }
  }, [c?.lastHash]);

  const hash  = c?.lastHash || '';
  let match   = 0;
  while (match < hash.length && hash[match] === '0') match++;
  const valid = hash !== '' && hash < TARGET_HEX;
  const prog  = c ? Math.min(1, c.attempts / EXPECTED) : 0;
  const tip   = s.blocks[miner.tipId];

  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-amber-500" />
          <h2>Proof-of-Work Engine</h2>
        </div>
        <span className="text-[10px] text-gray-400">{miner.flag} {miner.name}</span>
      </div>

      {!c ? (
        <div className="card-body text-center py-8">
          <p className="text-[12px] text-gray-400">Miner idle — no candidate block.</p>
          <p className="text-[11px] text-gray-400 mt-1">Press <b className="text-gray-600">Start</b> or advance to the next step.</p>
        </div>
      ) : (
        <div className="card-body space-y-4">

          {/* header fields */}
          <div>
            <p className="section-label">Block header · building on #{tip?.label}</p>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(249,250,251,0.60)', border: '1px solid rgba(229,231,235,0.60)' }}>
              {[
                ['Version',     `0x${c.version.toString(16).padStart(8, '0')}`],
                ['Prev hash',   s.blocks[c.tipId]?.hash ?? ''],
                ['Merkle root', c.merkleRoot],
                ['Timestamp',   `${c.time}  (${new Date(c.time * 1000).toLocaleTimeString()})`],
                ['nBits',       `0x${NBITS.toString(16)}`],
                ['Nonce',       c.nonce.toLocaleString()],
              ].map(([label, val]) => (
                <div key={label} className="grid grid-cols-[90px_1fr] gap-2 px-3 py-1.5"
                  style={{ borderBottom: '1px solid rgba(229,231,235,0.40)' }}>
                  <span className="text-[10px] text-gray-400 self-center">{label}</span>
                  <span className={`font-mono text-[10px] truncate ${
                    label === 'Nonce' ? 'text-amber-600 font-semibold'
                    : label === 'Merkle root' ? 'text-emerald-600'
                    : 'text-gray-600'}`}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* live hash */}
          <div className="rounded-2xl p-3"
            style={{ background: 'rgba(249,250,251,0.60)', border: '1px solid rgba(229,231,235,0.60)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label mb-0 flex items-center gap-1.5">
                <Hash size={11} /> SHA-256d vs target
              </p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                valid ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                {valid ? '✓ Valid!' : 'Too high'}
              </span>
            </div>
            <p className="font-mono text-[10.5px] leading-5 break-all">
              <span className="text-emerald-500 font-semibold">{hash.slice(0, match)}</span>
              <span className={valid ? 'text-emerald-600' : 'text-gray-600'}>{hash.slice(match, 32) || '— waiting…'}</span>
              <span className="text-gray-300">{hash.slice(32)}</span>
            </p>
            <p className="font-mono text-[9.5px] text-gray-400 break-all mt-1">
              <span className="text-amber-500">target  </span>
              {TARGET_HEX.slice(0, 32)}<span className="text-gray-200">{TARGET_HEX.slice(32)}</span>
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(229,231,235,0.60)' }}>
                <div className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${prog * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
              </div>
              <span className="font-mono text-[10px] text-amber-600 tabular-nums whitespace-nowrap">
                {c.attempts.toLocaleString()} hashes
              </span>
            </div>
            <p className="text-[9.5px] text-gray-400 mt-1.5">~1 in 4,096 wins here. Real Bitcoin: ~1 in 10²³.</p>
            {feedRef.current.slice(1).map((h, i) => (
              <p key={i} className="font-mono text-[9px] text-gray-300 truncate mt-0.5">{h}</p>
            ))}
          </div>

          {/* merkle tree */}
          <div>
            <p className="section-label flex items-center gap-1.5">
              <TreeDeciduous size={11} /> Merkle tree · {c.txIds.length + 1} txs
            </p>
            <MerkleTree levels={c.merkleLevels} />
          </div>

        </div>
      )}
    </section>
  );
}
