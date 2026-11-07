/*
 * Bird Chess rules engine.
 * Plain chess rules underneath; the birds are just costumes.
 *
 * Board: array of 64 squares, index = row * 8 + col, row 0 = rank 8.
 * Piece codes: colour + type, e.g. "wk" (white king), "bp" (black pawn).
 */
(function (root) {
  'use strict';

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const at = (r, c) => r * 8 + c;
  const other = (col) => (col === 'w' ? 'b' : 'w');
  const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));
  const sqIndex = (s) => (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);

  function fromFEN(fen) {
    const [pos, turn, cast = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const board = new Array(64).fill(null);
    let r = 0, c = 0;
    for (const ch of pos) {
      if (ch === '/') { r++; c = 0; }
      else if (/\d/.test(ch)) c += Number(ch);
      else { board[at(r, c)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase(); c++; }
    }
    return {
      board,
      turn,
      castling: { K: cast.includes('K'), Q: cast.includes('Q'), k: cast.includes('k'), q: cast.includes('q') },
      ep: ep === '-' ? -1 : sqIndex(ep),
      half: Number(half),
      full: Number(full),
    };
  }

  function toFEN(s) {
    let out = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = s.board[at(r, c)];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p[0] === 'w' ? p[1].toUpperCase() : p[1];
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    const cr = (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') + (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '');
    return `${out} ${s.turn} ${cr || '-'} ${s.ep < 0 ? '-' : sqName(s.ep)} ${s.half} ${s.full}`;
  }

  // Position key for repetition detection (ignores move counters).
  const positionKey = (s) => toFEN(s).split(' ').slice(0, 4).join(' ');

  function isAttacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7;
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (inB(pr, c + dc) && b[at(pr, c + dc)] === by + 'p') return true;
    for (const [dr, dc] of KNIGHT) if (inB(r + dr, c + dc) && b[at(r + dr, c + dc)] === by + 'n') return true;
    for (const [dr, dc] of KING) if (inB(r + dr, c + dc) && b[at(r + dr, c + dc)] === by + 'k') return true;
    const slide = (dirs, a, q) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inB(rr, cc)) {
          const p = b[at(rr, cc)];
          if (p) { if (p === by + a || p === by + q) return true; break; }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return slide(ORTH, 'r', 'q') || slide(DIAG, 'b', 'q');
  }

  const kingSquare = (b, col) => b.indexOf(col + 'k');
  const inCheck = (s, col = s.turn) => isAttacked(s.board, kingSquare(s.board, col), other(col));

  function pseudoMoves(s) {
    const b = s.board, me = s.turn, them = other(me), moves = [];
    const add = (from, to, extra) => moves.push(Object.assign({ from, to, piece: b[from], captured: b[to] }, extra));

    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || p[0] !== me) continue;
      const r = from >> 3, c = from & 7, t = p[1];

      if (t === 'p') {
        const dir = me === 'w' ? -1 : 1, startRow = me === 'w' ? 6 : 1, lastRow = me === 'w' ? 0 : 7;
        const pushPawn = (to, extra) => {
          if ((to >> 3) === lastRow) for (const promo of ['q', 'r', 'b', 'n']) add(from, to, Object.assign({ promo }, extra));
          else add(from, to, extra);
        };
        const one = at(r + dir, c);
        if (inB(r + dir, c) && !b[one]) {
          pushPawn(one);
          const two = at(r + 2 * dir, c);
          if (r === startRow && !b[two]) add(from, two, { flag: 'double' });
        }
        for (const dc of [-1, 1]) {
          if (!inB(r + dir, c + dc)) continue;
          const to = at(r + dir, c + dc);
          if (b[to] && b[to][0] === them) pushPawn(to);
          else if (to === s.ep) add(from, to, { flag: 'ep', captured: them + 'p' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const [dr, dc] of t === 'n' ? KNIGHT : KING) {
          if (!inB(r + dr, c + dc)) continue;
          const to = at(r + dr, c + dc);
          if (!b[to] || b[to][0] === them) add(from, to);
        }
        if (t === 'k') {
          const home = me === 'w' ? 60 : 4;
          const [kRight, qRight] = me === 'w' ? [s.castling.K, s.castling.Q] : [s.castling.k, s.castling.q];
          if (from === home && !isAttacked(b, home, them)) {
            if (kRight && !b[home + 1] && !b[home + 2] && b[home + 3] === me + 'r' &&
                !isAttacked(b, home + 1, them) && !isAttacked(b, home + 2, them)) add(from, home + 2, { flag: 'castle' });
            if (qRight && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === me + 'r' &&
                !isAttacked(b, home - 1, them) && !isAttacked(b, home - 2, them)) add(from, home - 2, { flag: 'castle' });
          }
        }
      } else {
        const dirs = t === 'r' ? ORTH : t === 'b' ? DIAG : ORTH.concat(DIAG);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (inB(rr, cc)) {
            const to = at(rr, cc);
            if (b[to]) { if (b[to][0] === them) add(from, to); break; }
            add(from, to);
            rr += dr; cc += dc;
          }
        }
      }
    }
    return moves;
  }

  function makeMove(s, m) {
    const b = s.board.slice();
    const me = s.turn;
    b[m.to] = m.promo ? me + m.promo : b[m.from];
    b[m.from] = null;
    if (m.flag === 'ep') b[m.to + (me === 'w' ? 8 : -8)] = null;
    if (m.flag === 'castle') {
      if (m.to > m.from) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
      else { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
    }
    const castling = Object.assign({}, s.castling);
    const touch = (sq) => {
      if (sq === 60) { castling.K = castling.Q = false; }
      if (sq === 4) { castling.k = castling.q = false; }
      if (sq === 63) castling.K = false;
      if (sq === 56) castling.Q = false;
      if (sq === 7) castling.k = false;
      if (sq === 0) castling.q = false;
    };
    touch(m.from); touch(m.to);
    return {
      board: b,
      turn: other(me),
      castling,
      ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
      half: m.piece[1] === 'p' || m.captured ? 0 : s.half + 1,
      full: me === 'b' ? s.full + 1 : s.full,
    };
  }

  function legalMoves(s) {
    return pseudoMoves(s).filter((m) => !inCheck(makeMove(s, m), s.turn));
  }

  function insufficientMaterial(b) {
    const pieces = b.map((p, i) => [p, i]).filter(([p]) => p && p[1] !== 'k');
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && 'bn'.includes(pieces[0][0][1])) return true;
    // Only bishops left, all on the same colour of square.
    if (pieces.every(([p]) => p[1] === 'b')) {
      const shade = new Set(pieces.map(([, i]) => ((i >> 3) + (i & 7)) % 2));
      return shade.size === 1;
    }
    return false;
  }

  // Standard algebraic notation for a legal move in state s.
  function toSAN(s, m, legal = legalMoves(s)) {
    let san;
    const t = m.piece[1];
    if (m.flag === 'castle') san = m.to > m.from ? 'O-O' : 'O-O-O';
    else {
      const capture = !!m.captured;
      if (t === 'p') {
        san = (capture ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      } else {
        const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
        let dis = '';
        if (rivals.length) {
          const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
          const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
          if (!sameFile) dis = FILES[m.from & 7];
          else if (!sameRank) dis = sqName(m.from)[1];
          else dis = sqName(m.from);
        }
        san = t.toUpperCase() + dis + (capture ? 'x' : '') + sqName(m.to);
      }
    }
    const next = makeMove(s, m);
    if (inCheck(next)) san += legalMoves(next).length ? '+' : '#';
    return san;
  }

  // Counts leaf nodes; used to verify move generation against known values.
  function perft(s, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(s);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(makeMove(s, m), depth - 1);
    return n;
  }

  /* ---------------- Computer opponent ---------------- */

  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Small bonus for central squares, scaled per piece type.
  const CENTER = Array.from({ length: 64 }, (_, i) => {
    const r = i >> 3, c = i & 7;
    return 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
  });
  const CENTER_WEIGHT = { p: 8, n: 10, b: 6, r: 2, q: 1, k: -4 };

  function evaluate(s) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.board[i];
      if (!p) continue;
      const t = p[1];
      let v = VALUE[t] + CENTER[i] * CENTER_WEIGHT[t];
      if (t === 'p') { // chicks love to fly forward, best through the middle
        const adv = p[0] === 'w' ? 6 - (i >> 3) : (i >> 3) - 1;
        v += adv * (adv >= 4 ? 12 : 3) - ((i & 7) === 0 || (i & 7) === 7 ? 6 : 0);
      }
      score += p[0] === 'w' ? v : -v;
    }
    return s.turn === 'w' ? score : -score;
  }

  function order(moves) {
    return moves.sort((a, b) =>
      ((b.captured ? VALUE[b.captured[1]] * 10 - VALUE[b.piece[1]] : 0) + (b.promo ? 800 : 0)) -
      ((a.captured ? VALUE[a.captured[1]] * 10 - VALUE[a.piece[1]] : 0) + (a.promo ? 800 : 0)));
  }

  function search(s, depth, alpha, beta, ply) {
    const moves = legalMoves(s);
    if (!moves.length) return inCheck(s) ? -100000 + ply : 0;
    if (depth === 0) return quiesce(s, alpha, beta, 0);
    for (const m of order(moves)) {
      const score = -search(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function quiesce(s, alpha, beta, qdepth) {
    const stand = evaluate(s);
    if (stand >= beta || qdepth > 4) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of order(legalMoves(s).filter((m) => m.captured || m.promo))) {
      const score = -quiesce(makeMove(s, m), -beta, -alpha, qdepth + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function bestMove(s, depth, randomness = 0) {
    const moves = order(legalMoves(s));
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
      // Window leaves room for the noise so a refuted move can't sneak in via a cutoff score.
      const score = -search(makeMove(s, m), depth - 1, -Infinity, -(bestScore - randomness), 1) + Math.random() * randomness;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  const api = {
    START_FEN, fromFEN, toFEN, positionKey, sqName, sqIndex, other,
    legalMoves, makeMove, inCheck, isAttacked, insufficientMaterial, toSAN, perft, bestMove, evaluate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BirdEngine = api;
})(this);
