/* Bird Chess — board UI, sounds and game flow. Rules live in engine.js. */
(function () {
  'use strict';
  const E = window.BirdEngine;

  const BIRDS = {
    k: { emoji: '🦅', name: 'Eagle', role: 'King', how: 'One square any way. Protect it at all costs!' },
    q: { emoji: '🦉', name: 'Owl', role: 'Queen', how: 'Swoops any distance in any direction.' },
    r: { emoji: '🐧', name: 'Penguin', role: 'Rook', how: 'Slides straight across the ice, any distance.' },
    b: { emoji: '🦩', name: 'Flamingo', role: 'Bishop', how: 'Struts diagonally, any distance.' },
    n: { emoji: '🦜', name: 'Parrot', role: 'Knight', how: 'Hops in an L shape, right over other birds.' },
    p: { emoji: '🐤', name: 'Chick', role: 'Pawn', how: 'Waddles forward, pecks diagonally. Grows up on the far side.' },
  };
  const FLOCK = { w: 'Dawn flock', b: 'Dusk flock' };
  const LEVELS = { 1: { depth: 1, noise: 60 }, 2: { depth: 2, noise: 15 }, 3: { depth: 3, noise: 0 } };

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');

  let game;           // { states: [...], moves: [{move, san}], keys: [...] }
  let selected = -1;
  let flipped = false;
  let thinking = false;
  let pendingPromo = null;
  let soundOn = true;
  let justLanded = -1;

  const current = () => game.states[game.states.length - 1];
  const mode = () => $('mode').value;
  const humanSide = () => $('side').value;
  const isHumanTurn = () => mode() === 'pvp' || current().turn === humanSide();

  /* ---------------- Sounds ---------------- */
  let audio;
  function chirp(kind) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const notes = {
        move: [[2400, 3400, 0, 0.07], [2600, 3800, 0.09, 0.07]],
        capture: [[900, 500, 0, 0.12], [1300, 700, 0.1, 0.14]],
        check: [[3000, 4200, 0, 0.06], [3000, 4200, 0.08, 0.06], [3000, 4500, 0.16, 0.08]],
        end: [[1800, 2600, 0, 0.12], [2200, 3000, 0.15, 0.12], [2600, 3800, 0.3, 0.25]],
      }[kind];
      for (const [f0, f1, start, dur] of notes) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = kind === 'capture' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(f0, t + start);
        osc.frequency.exponentialRampToValueAtTime(f1, t + start + dur);
        gain.gain.setValueAtTime(0.0001, t + start);
        gain.gain.exponentialRampToValueAtTime(kind === 'capture' ? 0.05 : 0.12, t + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        osc.connect(gain).connect(audio.destination);
        osc.start(t + start);
        osc.stop(t + start + dur + 0.02);
      }
    } catch (e) { /* audio not available — birds stay silent */ }
  }

  /* ---------------- Rendering ---------------- */
  function pieceEl(code) {
    const el = document.createElement('span');
    const bird = BIRDS[code[1]];
    el.className = 'piece ' + code[0];
    el.textContent = bird.emoji;
    el.title = `${FLOCK[code[0]]} ${bird.name} (${bird.role})`;
    return el;
  }

  function gameResult(s) {
    const legal = E.legalMoves(s);
    if (!legal.length) {
      return E.inCheck(s)
        ? { over: true, text: `Checkmate! The ${FLOCK[E.other(s.turn)]} wins — the ${FLOCK[s.turn]} Eagle is cornered.` }
        : { over: true, text: 'Stalemate — nobody can fly anywhere. It\'s a draw.' };
    }
    if (s.half >= 100) return { over: true, text: 'Draw by the 50-move rule. The birds got bored.' };
    if (E.insufficientMaterial(s.board)) return { over: true, text: 'Draw — not enough birds left to finish the job.' };
    const key = E.positionKey(s);
    if (game.keys.filter((k) => k === key).length >= 3) return { over: true, text: 'Draw by threefold repetition. Same perch, three times.' };
    return { over: false, legal };
  }

  function render() {
    const s = current();
    const result = gameResult(s);
    const legal = result.over ? [] : result.legal;
    const targets = selected >= 0 ? legal.filter((m) => m.from === selected) : [];
    const last = game.moves.length ? game.moves[game.moves.length - 1].move : null;
    const checkSq = E.inCheck(s) ? s.board.indexOf(s.turn + 'k') : -1;

    boardEl.innerHTML = '';
    for (let v = 0; v < 64; v++) {
      const i = flipped ? 63 - v : v;
      const r = i >> 3, c = i & 7;
      const sq = document.createElement('button');
      sq.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      sq.dataset.sq = i;
      sq.setAttribute('aria-label', E.sqName(i) + (s.board[i] ? ' ' + BIRDS[s.board[i][1]].name : ''));
      if (last && (i === last.from || i === last.to)) sq.classList.add('last');
      if (i === selected) sq.classList.add('selected');
      if (i === checkSq) sq.classList.add('check');

      if (v % 8 === 0) sq.appendChild(coord('rank', 8 - r));
      if (v >= 56) sq.appendChild(coord('file', 'abcdefgh'[c]));

      if (s.board[i]) {
        const p = pieceEl(s.board[i]);
        if (i === justLanded) p.classList.add('landed');
        sq.appendChild(p);
      }
      if (targets.some((m) => m.to === i)) {
        const mark = document.createElement('span');
        mark.className = s.board[i] || targets.some((m) => m.to === i && m.flag === 'ep') ? 'ring' : 'dot';
        sq.appendChild(mark);
      }
      boardEl.appendChild(sq);
    }
    justLanded = -1;

    // Player bars
    const top = flipped ? 'w' : 'b', bottom = flipped ? 'b' : 'w';
    const label = (col) => {
      if (mode() === 'pvp') return FLOCK[col];
      return FLOCK[col] + (col === humanSide() ? ' (you)' : ' (computer)');
    };
    $('name-top').textContent = label(top);
    $('name-bottom').textContent = label(bottom);
    $('name-top').classList.toggle('to-move', !result.over && s.turn === top);
    $('name-bottom').classList.toggle('to-move', !result.over && s.turn === bottom);
    // Each bar shows the birds that side has caught.
    $('caught-top').textContent = caughtBy(top);
    $('caught-bottom').textContent = caughtBy(bottom);

    // Status
    let status;
    if (result.over) status = result.text;
    else if (thinking) status = `The ${FLOCK[s.turn]} is thinking… 🪺`;
    else {
      status = `${FLOCK[s.turn]} to move.`;
      if (checkSq >= 0) status = `Check! The ${FLOCK[s.turn]} Eagle is under attack.`;
    }
    $('status').textContent = status;

    renderHistory();
    $('undo').disabled = thinking || game.moves.length === 0;
    $('level-wrap').classList.toggle('hidden', mode() !== 'ai');
    $('side-wrap').classList.toggle('hidden', mode() !== 'ai');
    return result;
  }

  function coord(kind, text) {
    const el = document.createElement('span');
    el.className = 'coord ' + kind;
    el.textContent = text;
    return el;
  }

  function caughtBy(col) {
    const order = 'qrbnp';
    return game.moves
      .filter(({ move }) => move.piece[0] === col && move.captured)
      .map(({ move }) => move.captured[1])
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((t) => BIRDS[t].emoji)
      .join('');
  }

  function birdSAN(san) {
    return san.replace(/^[KQRBN]/, (L) => BIRDS[L.toLowerCase()].emoji)
      .replace(/=([QRBN])/, (_, L) => '=' + BIRDS[L.toLowerCase()].emoji);
  }

  function renderHistory() {
    const ol = $('history');
    ol.innerHTML = '';
    const startBlack = game.states[0].turn === 'b';
    const plies = game.moves.map((m) => birdSAN(m.san));
    if (startBlack) plies.unshift('…');
    for (let i = 0; i < plies.length; i += 2) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="num"></span><span></span><span></span>';
      li.children[0].textContent = i / 2 + 1 + '.';
      li.children[1].textContent = plies[i];
      li.children[2].textContent = plies[i + 1] || '';
      ol.appendChild(li);
    }
    ol.scrollTop = ol.scrollHeight;
  }

  /* ---------------- Game flow ---------------- */
  function newGame() {
    const start = E.fromFEN(E.START_FEN);
    game = { states: [start], moves: [], keys: [E.positionKey(start)] };
    selected = -1;
    thinking = false;
    pendingPromo = null;
    $('promo').classList.add('hidden');
    flipped = mode() === 'ai' && humanSide() === 'b';
    render();
    maybeComputerMove();
  }

  function play(move) {
    const s = current();
    const san = E.toSAN(s, move);
    const next = E.makeMove(s, move);
    game.states.push(next);
    game.moves.push({ move, san });
    game.keys.push(E.positionKey(next));
    selected = -1;
    justLanded = move.to;
    const result = render();
    if (result.over) chirp('end');
    else if (san.endsWith('+')) chirp('check');
    else chirp(move.captured ? 'capture' : 'move');
    if (!result.over) maybeComputerMove();
  }

  function maybeComputerMove() {
    if (mode() !== 'ai' || isHumanTurn() || gameResult(current()).over) return;
    thinking = true;
    render();
    const snapshot = game;
    // Short pause so the board repaints and the move feels deliberate.
    setTimeout(() => {
      if (snapshot !== game || !thinking) return;
      const lvl = LEVELS[$('level').value];
      const move = E.bestMove(current(), lvl.depth, lvl.noise);
      thinking = false;
      if (move) play(move);
      else render();
    }, 350);
  }

  function onSquare(i) {
    if (thinking || pendingPromo || !isHumanTurn()) return;
    const s = current();
    const result = gameResult(s);
    if (result.over) return;
    const piece = s.board[i];

    if (selected >= 0) {
      const options = result.legal.filter((m) => m.from === selected && m.to === i);
      if (options.length) {
        if (options.length > 1) askPromotion(options);
        else play(options[0]);
        return;
      }
    }
    selected = piece && piece[0] === s.turn && i !== selected ? i : -1;
    render();
  }

  function askPromotion(options) {
    pendingPromo = options;
    const box = $('promo-choices');
    box.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('button');
      btn.appendChild(pieceEl(current().turn + t));
      btn.appendChild(document.createTextNode(BIRDS[t].name));
      btn.addEventListener('click', () => {
        const move = pendingPromo.find((m) => m.promo === t);
        pendingPromo = null;
        $('promo').classList.add('hidden');
        play(move);
      });
      box.appendChild(btn);
    }
    $('promo').classList.remove('hidden');
  }

  function undo() {
    if (thinking || !game.moves.length) return;
    let steps = 1;
    // Against the computer, rewind to the last position where it was your turn.
    if (mode() === 'ai') {
      steps = current().turn === humanSide() ? 2 : 1;
      steps = Math.min(steps, game.moves.length);
    }
    for (let k = 0; k < steps; k++) {
      game.states.pop();
      game.moves.pop();
      game.keys.pop();
    }
    selected = -1;
    pendingPromo = null;
    $('promo').classList.add('hidden');
    render();
    maybeComputerMove();
  }

  /* ---------------- Wiring ---------------- */
  boardEl.addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (sq) onSquare(Number(sq.dataset.sq));
  });
  $('new').addEventListener('click', newGame);
  $('undo').addEventListener('click', undo);
  $('flip').addEventListener('click', () => { flipped = !flipped; render(); });
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    $('sound').textContent = 'Chirps: ' + (soundOn ? 'on' : 'off');
    $('sound').setAttribute('aria-pressed', String(soundOn));
  });
  $('mode').addEventListener('change', newGame);
  $('side').addEventListener('change', newGame);
  $('level').addEventListener('change', () => render());

  const legend = $('legend');
  for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
    const li = document.createElement('li');
    li.appendChild(pieceEl('w' + t));
    const text = document.createElement('div');
    text.innerHTML = `<strong></strong><small></small>`;
    text.firstChild.textContent = `${BIRDS[t].name} — the ${BIRDS[t].role}`;
    text.lastChild.textContent = BIRDS[t].how;
    li.appendChild(text);
    legend.appendChild(li);
  }

  newGame();
})();
