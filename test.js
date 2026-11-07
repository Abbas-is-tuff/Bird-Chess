// Run with: node test.js — checks move generation against known perft counts.
const E = require('./engine.js');
const cases = [
  [E.START_FEN, 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
];
let failed = 0;
for (const [fen, depth, expected] of cases) {
  const got = E.perft(E.fromFEN(fen), depth);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} depth ${depth}: ${got} (expected ${expected})  ${fen}`);
}
process.exit(failed ? 1 : 0);
