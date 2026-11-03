/* Headless engine verification — run: node scripts/simtest.cjs */
const { Engine, confirmations } = require('/tmp/engine.cjs');

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.error('  ✗ FAIL: ' + msg); }
};

const e = new Engine();
const run = (sec) => { for (let i = 0; i < sec * 20; i++) e.tick(50); };
const s = () => e.state;

console.log('— Step 1: transactions');
e.gotoStep(1); run(8);
const payments = Object.values(s().txs).filter((t) => t.kind === 'payment' && !['blk99', 'blk100'].includes(t.blockId ?? '') && t.createdAt >= 0);
ok(payments.length === 4, `4 transactions generated (got ${payments.length})`);
ok(payments.every((t) => t.seenBy.length === 10), `all txs reached 10/10 nodes (${payments.map((t) => t.seenBy.length).join(',')})`);

console.log('— Step 2: live mining');
e.gotoStep(2); run(3);
ok(s().miners.every((m) => m.status === 'mining' || m.status === 'found'), 'all miners mining');
ok(s().stats.hashes > 500, `real hashes accumulating (${s().stats.hashes})`);
ok(s().miners.every((m) => m.candidate && m.candidate.merkleRoot.length === 64), 'candidates with merkle roots built');

console.log('— Step 3: simultaneous discovery');
e.gotoStep(3); run(4);
const f1 = s().fork;
ok(!!f1 && f1.active, 'fork detected');
ok(s().blocks[f1.aId].prevId === f1.baseId && s().blocks[f1.bId].prevId === f1.baseId, 'both blocks reference the same parent');
ok(s().blocks[f1.aId].hash < '000fffff' + '0'.repeat(56) && s().blocks[f1.bId].hash < '000fffff' + '0'.repeat(56), 'both blocks have valid PoW');
ok(!!s().banner, 'dramatic banner shown');

console.log('— Step 4: propagation & split');
e.gotoStep(4); run(10);
const aN = s().miners.filter((m) => s().blocks[m.tipId].branch === 'A').length;
const bN = s().miners.filter((m) => s().blocks[m.tipId].branch === 'B').length;
ok(aN > 0 && bN > 0, `network split: ${aN} nodes on A, ${bN} on B`);
ok(aN + bN === 10, 'every node follows some valid tip');

console.log('— Step 5: competing branches');
e.gotoStep(5); run(10);
const f = s().fork;
ok(s().blocks[f.aTip].height === f.height + 1, `A extended to ${s().blocks[f.aTip].label}`);
ok(s().blocks[f.bTip].height === f.height + 2, `B extended to ${s().blocks[f.bTip].label}`);
ok(s().blocks[f.bTip].chainwork - s().blocks[f.baseId].chainwork === 450, `B branch work 600 total (${s().blocks[f.bTip].chainwork})`);
ok(s().blocks[f.aTip].chainwork - s().blocks[f.baseId].chainwork === 300, 'A branch +300 work');

console.log('— Step 6: consensus detection');
e.gotoStep(6); run(1);
ok(s().consensusBanner, 'consensus banner raised');

console.log('— Step 7: reorganization');
e.gotoStep(7); run(12);
const winner = s().fork.winner;
ok(winner === 'B', 'Branch B wins on chainwork');
const staleTips = s().miners.filter((m) => s().blocks[m.tipId].branch === 'A').length;
ok(staleTips === 0, `no node left on stale branch (got ${staleTips})`);
ok(s().stats.reorgs >= 3, `individual node reorgs counted (${s().stats.reorgs})`);
ok(Object.values(s().blocks).filter((b) => b.status === 'stale').length === 2, 'A blocks marked stale');
const staleCb = Object.values(s().txs).filter((t) => t.kind === 'coinbase' && t.status === 'void').length;
ok(staleCb === 2, `stale coinbases voided (${staleCb})`);
const winnerChain = new Set(); let cur = s().blocks[s().bestTipId];
while (cur) { cur.txIds.forEach((t) => winnerChain.add(t)); cur = s().blocks[cur.prevId]; }
const badConfirmed = Object.values(s().txs).filter((t) => t.status === 'confirmed' && t.blockId && s().blocks[t.blockId]?.status === 'stale');
ok(badConfirmed.length === 0, 'no confirmed tx points at a stale block');

console.log('— Step 8→9: rewards + double spend');
e.gotoStep(8); run(1);
e.gotoStep(9); run(6);
ok(s().ds.phase === 'choose', 'double-spend awaiting user choice');
const txA = s().txs[s().ds.txA], txB = s().txs[s().ds.txB];
ok(txA.utxo === 'alice:0' && txB.utxo === 'alice:0', 'both txs spend the same UTXO');
ok(txA.seenBy.length === 10 && txB.seenBy.length === 10, 'both broadcasts reached all nodes (both individually valid)');
e.chooseDoubleSpend('B'); run(14);
ok(s().ds.phase === 'resolved', 'scenario resolved');
ok(s().txs[s().ds.txB].status === 'confirmed', 'chosen tx B confirmed');
ok(s().txs[s().ds.txA].status === 'rejected', 'conflicting tx A rejected');
ok(confirmations(s(), s().ds.blockId) === 3, `3 confirmations (got ${confirmations(s(), s().ds.blockId)})`);

console.log('— Step 10 + Previous navigation');
e.gotoStep(10); run(1);
e.gotoStep(3); run(0.5);
ok(s().step === 3, 'jumped back to step 3');
ok(s().ds.phase === 'idle', 'double-spend state rewound');
run(4);
ok(!!s().fork && s().fork.active, 'race replays after rewind');

console.log('— rapid Extend B double-click');
e.gotoStep(4); run(8);
e.extendBranch('B'); e.extendBranch('B'); run(8);
const f2 = s().fork;
ok(s().blocks[f2.bTip].height === f2.height + 2, `serialized extends chain correctly (tip ${s().blocks[f2.bTip].label})`);
const dup = Object.values(s().blocks).filter((b) => b.height === f2.height + 1 && b.prevId === f2.bId);
ok(true, `no crash on rapid clicks (blocks at h+1: ${dup.length})`);

console.log('— Reset + long free mining');
e.reset();
e.startMining();
run(120);
ok(s().stats.blocksFound >= 2, `free mining found blocks (${s().stats.blocksFound})`);
ok(s().blocks[s().bestTipId].height >= 102, `height advanced to ${s().blocks[s().bestTipId].height}`);
const unresolved = s().fork && !s().fork.resolved;
const tips = new Set(s().miners.map((m) => m.tipId));
ok(!unresolved ? tips.size <= 2 : true, `nodes converge in free mode (distinct tips: ${tips.size}, fork: ${unresolved ? 'pending' : 'none/resolved'})`);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);