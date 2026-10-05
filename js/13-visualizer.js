/* ═══════════════════════════════════════════════════════════ */
/*  13-visualizer.js — Step-through visualizer                 */
/*  · CF.Narrator  — speechSynthesis narration (modality)      */
/*  · CF.Sonify    — algorithm sonification (Web Audio)        */
/*  · CF.Visualizer— code+array sync player with predict stops */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

/* ─────────────────────────────────────────────────────────── */
/*  EASINGS — shared motion vocabulary (Manim-style curves).   */
/*  Every choreographed move in the app pulls from this table  */
/*  so pointer glides, value morphs and packet rides all feel  */
/*  like ONE engine instead of ad-hoc CSS defaults.            */
/* ─────────────────────────────────────────────────────────── */
CF.Ease = {
  smooth: t => t * t * (3 - 2 * t),                                   /* smoothstep  */
  outCubic: t => 1 - Math.pow(1 - t, 3),                              /* decelerate  */
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1
};

/* ─────────────────────────────────────────────────────────── */
/*  NARRATOR — narration goes in the AUDIO channel,            */
/*  screen shows only short labels (redundancy principle)     */
/* ─────────────────────────────────────────────────────────── */
CF.Narrator = (() => {
  let enabled = true;
  let rate = 1.0;          // 0.5 … 2, follows player speed
  let voice = null;
  let voicePicked = false;
  let curUtter = null;     // live utterance, so the player can wait for it
  let speakAt = 0;         // when the current utterance was queued
  let startedAt = 0;       // when the engine ACTUALLY began speaking it
  let endedAt = 0;         // when the engine reported onend/onerror

  function supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  function pickVoice() {
    if (!supported() || voicePicked) return voice;
    try {
      const vs = window.speechSynthesis.getVoices();
      if (!vs || !vs.length) return null;   // not loaded yet — retry later
      voicePicked = true;
      voice = vs.find(v => /^en(-|_)/i.test(v.lang) && /google|natural|samantha|daniel/i.test(v.name))
           || vs.find(v => /^en(-|_)/i.test(v.lang))
           || vs[0] || null;
    } catch (e) { voice = null; }
    return voice;
  }
  if (supported()) {
    try { window.speechSynthesis.onvoiceschanged = () => { voicePicked = false; pickVoice(); }; } catch (e) {}
  }

  let keepAliveTimer = null;
  function stopKeepAlive() {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  }
  function startKeepAlive(u) {
    /* Chrome bug: long utterances (>~15 s) silently die mid-sentence —
       speaking stays true, no onend ever fires, and every gate that
       waits for the voice FREEZES. The classic workaround: toggle the
       queue with pause()/resume() every few seconds while we speak. */
    stopKeepAlive();
    keepAliveTimer = setInterval(() => {
      try {
        if (!curUtter || curUtter !== u) { stopKeepAlive(); return; }
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      } catch (e) { stopKeepAlive(); }
    }, 7000);
  }

  function speak(text) {
    if (!enabled || !supported() || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = Math.max(0.6, Math.min(1.6, 0.95 * rate));
      u.pitch = 1;
      u.volume = 1;
      const v = pickVoice();
      if (v) { try { u.voice = v; } catch (e) {} }
      startedAt = 0; endedAt = 0;
      speakAt = Date.now();
      u.onstart = () => { startedAt = Date.now(); };
      u.onend = () => { endedAt = Date.now(); stopKeepAlive(); if (curUtter === u) curUtter = null; };
      u.onerror = () => { endedAt = Date.now(); stopKeepAlive(); if (curUtter === u) curUtter = null; };
      curUtter = u;
      startKeepAlive(u);
      window.speechSynthesis.speak(u);
    } catch (e) { curUtter = null; stopKeepAlive(); /* non-fatal */ }
  }

  /* true ONLY while the voice has verifiably started and not yet finished.
     LAG FIX: the old version trusted `speechSynthesis.speaking`, which stays
     true through Chrome's startup delay and wedges forever in some engines —
     the player then sat idle seconds after every sentence. Now:
       · never started within 700 ms  → treat as silent, don't hold playback
       · onend/onerror fired          → immediately done
       · running longer than a hard cap → wedged, give up waiting          */
  function isSpeaking() {
    if (!enabled || !supported() || !curUtter) return false;
    if (endedAt) return false;
    try {
      if (!startedAt) return (Date.now() - speakAt) < 700;
      if (!(window.speechSynthesis.speaking || window.speechSynthesis.pending)) return false;
      /* HARD CAP: never trust the engine past estimate + slack. Without
         this a wedged speechSynthesis (speaking stays true forever in
         some engines) froze every voice-gated step mid-sentence. */
      const cap = estimateMs(curUtter.text, rate) + 4000;
      if (Date.now() - startedAt > cap) return false;
      return true;
    } catch (e) { return false; }
  }

  /* Absolute deadline by which the CURRENT utterance must be considered
     finished, no matter what the engine claims. Every playback gate uses
     this as its final fallback so nothing can wait on voice forever. */
  function busyUntil() {
    if (!enabled || !supported() || !curUtter || endedAt) return 0;
    return (startedAt || speakAt) + estimateMs(curUtter.text, rate) + 4000;
  }

  /* Rough spoken-duration estimate (~380 ms/word + punctuation pauses).
     Used to pace playback even where speechSynthesis is missing and
     isSpeaking() is always false (then it doubles as reading time). */
  function estimateMs(text, r) {
    const t = String(text || '').trim();
    if (!t) return 0;
    const words = t.split(/\s+/).length;
    const commas = (t.match(/[,;:—–]/g) || []).length;
    const stops = (t.match(/[.!?]/g) || []).length;
    let ms = words * 380 + commas * 140 + stops * 200;
    ms = Math.round(ms / Math.max(0.6, Math.min(2, r || 1)));
    return Math.min(ms, 15000); /* never stall a step beyond 15 s */
  }

  function stop() {
    if (!supported()) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  return {
    speak, stop,
    supported,
    isSpeaking,
    busyUntil,
    estimateMs,
    isEnabled: () => enabled,
    setEnabled: (v) => { enabled = !!v; if (!enabled) stop(); },
    setRate: (r) => { rate = r; },
    getRate: () => rate
  };
})();

/* ─────────────────────────────────────────────────────────── */
/*  SONIFY — algorithm sonification. Experimental aid, always  */
/*  optional & separately mutable from narration.              */
/*  Mapping: array value → pitch · index → stereo pan         */
/* ─────────────────────────────────────────────────────────── */
CF.Sonify = (() => {
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function vol() {
    try { return (CF.State?.profile?.settings?.sfxVolume ?? 0.7); }
    catch (e) { return 0.7; }
  }

  function tone(freq, dur, opts = {}) {
    const c = ac(); if (!c || !freq) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.glideTo) {
      try { o.frequency.exponentialRampToValueAtTime(Math.max(opts.glideTo, 1), t + dur); } catch (e) {}
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(opts.vol ?? 0.12, 0.001), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let node = o;
    if (opts.pan !== undefined && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      o.connect(p); node = p;
    }
    node.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, v, freq, q) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  /* Map an array value to a pitch in a pentatonic-ish band 220–880 Hz */
  function valueFreq(v, lo, hi) {
    if (typeof v !== 'number') return 440;
    const span = (hi - lo) || 1;
    const frac = Math.max(0, Math.min(1, (v - lo) / span));
    return 220 * Math.pow(2, frac * 2);   // two octaves
  }

  /* pan: index 0..n-1 → -0.8..0.8 */
  function idxPan(i, n) {
    if (!n) return 0;
    return -0.8 + (1.6 * i) / Math.max(1, n - 1);
  }

  /**
   * Play a sonification event.
   * ev: { type, arr, indices, value, valueLo, valueHi }
   * types: init compare move swap write found grow shrink build buzz win
   */
  function fx(type, ev = {}) {
    if (!enabled) return;
    const v = vol();
    if (v === 0) return;
    const arr = ev.arr || [];
    const lo = ev.valueLo, hi = ev.valueHi;
    const fOf = (i) => (i >= 0 && i < arr.length)
      ? valueFreq(typeof arr[i] === 'number' ? arr[i] : lo, lo, hi) : 440;

    switch (type) {
      case 'init':
        tone(330, 0.14, { type: 'triangle', vol: 0.10 * v });
        break;
      case 'compare': {
        const [a, b] = ev.indices || [0, 0];
        tone(fOf(a), 0.10, { type: 'sine', vol: 0.12 * v, pan: idxPan(a, arr.length) });
        setTimeout(() => tone(fOf(b), 0.10, { type: 'sine', vol: 0.12 * v, pan: idxPan(b, arr.length) }), 110);
        break;
      }
      case 'move': {
        const i = ev.indices?.[0] ?? 0;
        const f = fOf(i);
        tone(f * 1.5, 0.12, { type: 'triangle', vol: 0.12 * v, glideTo: f, pan: idxPan(i, arr.length) });
        break;
      }
      case 'swap': {
        const [a, b] = ev.indices || [0, 0];
        const fa = fOf(a), fb = fOf(b);
        tone(fa, 0.18, { type: 'triangle', vol: 0.12 * v, glideTo: fb, pan: idxPan(a, arr.length) });
        setTimeout(() => tone(fb, 0.18, { type: 'triangle', vol: 0.12 * v, glideTo: fa, pan: idxPan(b, arr.length) }), 60);
        noise(0.08, 0.10 * v, 2600, 1.2);
        break;
      }
      case 'write':
        tone(520, 0.06, { type: 'square', vol: 0.08 * v, pan: idxPan(ev.indices?.[0] ?? 0, arr.length) });
        noise(0.05, 0.06 * v, 3200, 1.5);
        break;
      case 'grow':
        tone(330, 0.16, { type: 'sine', vol: 0.11 * v, glideTo: 560 });
        break;
      case 'shrink':
        tone(560, 0.16, { type: 'sine', vol: 0.11 * v, glideTo: 300 });
        break;
      case 'build':
        tone(valueFreq(ev.value ?? 1, lo, hi), 0.14, { type: 'triangle', vol: 0.12 * v });
        break;
      case 'found':
        [523, 659, 784].forEach((f, i) =>
          setTimeout(() => tone(f, 0.28, { type: 'triangle', vol: 0.13 * v }), i * 90));
        break;
      case 'win':
        tone(660, 0.2, { type: 'triangle', vol: 0.12 * v });
        tone(990, 0.3, { type: 'sine', vol: 0.08 * v });
        break;
      case 'buzz':
        tone(180, 0.16, { type: 'sawtooth', vol: 0.09 * v, glideTo: 120 });
        break;
      case 'tick':
        /* attention chime — used when a checkpoint card/popup appears so it
           is never missed (two soft rising notes, quieter than 'win') */
        tone(740, 0.10, { type: 'triangle', vol: 0.07 * v });
        setTimeout(() => tone(980, 0.14, { type: 'triangle', vol: 0.07 * v }), 110);
        break;
    }
  }

  return {
    fx,
    unlock: () => { ac(); },
    isEnabled: () => enabled,
    setEnabled: (v) => { enabled = !!v; },
    _ac: () => ctx
  };
})();

/* ─────────────────────────────────────────────────────────── */
/*  FLOW — interactive flowchart/diagram canvas (SVG)          */
/*                                                              */
/*  Declarative node-graph spec (data, not code):               */
/*   { title?, subtitle?,                                       */
/*     nodes: [{ id, kind:'start|process|decision|io|stop',     */
/*              label, x, y, w?, h?, note? }],                  */
/*     edges: [{ from, to, label?, branch?:'yes'|'no',          */
/*              via?:[[fx,fy],…], dashed? }] }                  */
/*  Interaction model: click / Enter a node → it is selected,   */
/*  every inbound edge pulses and a packet flies along it,      */
/*  and opts.onNode(node) runs (lessons use this to narrate).   */
/* ─────────────────────────────────────────────────────────── */
CF.Flow = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const KIND_COL = {
    start: '#22d3ee', process: '#a78bfa', decision: '#fbbf24',
    io: '#34d399', stop: '#f472b6'
  };

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
    return e;
  }
  function wrapText(s, perLine) {
    const words = String(s || '').split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach(w => {
      if ((cur + ' ' + w).trim().length > perLine && cur) { lines.push(cur.trim()); cur = w; }
      else cur = (cur + ' ' + w).trim();
    });
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }

  /**
   * mountFlow(container, spec, opts?)
   * Renders an interactive SVG flow diagram into `container`
   * (element or selector string). Returns { redraw }.
   */
  function mountFlow(container, spec, opts = {}) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root || !spec || !spec.nodes) return { redraw() {} };

    function draw() {
      const W = Math.max(640, ...spec.nodes.map(n => (n.x || 0) + (n.w || 150) + 40));
      const H = Math.max(180, ...spec.nodes.map(n => (n.y || 0) + (n.h || 56) + 40));
      root.innerHTML = '';

      const svg = el('svg', {
        class: 'flow-svg', viewBox: `0 0 ${W} ${H}`,
        preserveAspectRatio: 'xMidYMid meet', role: 'img'
      });
      root.appendChild(svg);

      const defs = el('defs');
      Object.keys(KIND_COL).forEach(kind => {
        const m = el('marker', {
          id: `flow-arw-${kind}`, viewBox: '0 0 10 10', refX: '8', refY: '5',
          markerWidth: '6.5', markerHeight: '6.5', orient: 'auto-start-reverse'
        });
        m.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: KIND_COL[kind] }));
        defs.appendChild(m);
      });
      const mNo = el('marker', {
        id: 'flow-arw-no', viewBox: '0 0 10 10', refX: '8', refY: '5',
        markerWidth: '6.5', markerHeight: '6.5', orient: 'auto-start-reverse'
      });
      mNo.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#fb7185' }));
      defs.appendChild(mNo);
      const mYes = el('marker', {
        id: 'flow-arw-yes', viewBox: '0 0 10 10', refX: '8', refY: '5',
        markerWidth: '6.5', markerHeight: '6.5', orient: 'auto-start-reverse'
      });
      mYes.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#4ade80' }));
      defs.appendChild(mYes);
      svg.appendChild(defs);

      const gEdges = el('g');
      const gNodes = el('g');
      const gPkts = el('g');
      svg.appendChild(gEdges); svg.appendChild(gNodes); svg.appendChild(gPkts);

      const byId = {};
      spec.nodes.forEach(n => { byId[n.id] = n; });
      const sizeOf = (n) => ({ w: n.w || 150, h: n.h || 56 });
      const center = (n) => {
        const s = sizeOf(n);
        return { x: n.x + s.w / 2, y: n.y + s.h / 2 };
      };
      /* where a straight line from center toward (tx,ty) crosses the border */
      const borderPt = (n, tx, ty) => {
        const s = sizeOf(n), c = center(n);
        const dx = tx - c.x, dy = ty - c.y;
        if (!dx && !dy) return c;
        const sx = dx ? (s.w / 2 + 3) / Math.abs(dx) : Infinity;
        const sy = dy ? (s.h / 2 + 3) / Math.abs(dy) : Infinity;
        const sc = Math.min(sx, sy);
        return { x: c.x + dx * sc, y: c.y + dy * sc };
      };
      const edgePoints = (e) => {
        const A = byId[e.from], B = byId[e.to];
        if (!A || !B) return null;
        const ca = center(A), cb = center(B);
        const pts = [[ca.x, ca.y]];
        (e.via || []).forEach(v => pts.push([v[0], v[1]]));
        pts.push([cb.x, cb.y]);
        const next = pts.length > 2 ? { x: pts[1][0], y: pts[1][1] } : cb;
        const prev = pts.length > 2 ? { x: pts[pts.length - 2][0], y: pts[pts.length - 2][1] } : ca;
        const all = [borderPt(A, next.x, next.y),
                     ...pts.slice(1, pts.length - 1),
                     borderPt(B, prev.x, prev.y)];
        return all;
      };

      /* ── edges first (drawn under the nodes) ── */
      (spec.edges || []).forEach((e, ei) => {
        const B = byId[e.to];
        if (!B) return;
        const all = edgePoints(e);
        if (!all) return;
        const kind = B.kind || 'process';
        const col = e.branch === 'no' ? '#fb7185'
                  : e.branch === 'yes' ? '#4ade80'
                  : (KIND_COL[kind] || '#94a3b8');
        const mk = e.branch ? `url(#flow-arw-${e.branch})` : `url(#flow-arw-${kind})`;
        const d = 'M ' + all.map(p => `${p.x} ${p.y}`).join(' L ');
        const path = el('path', {
          d, class: 'flow-edge',
          'stroke-dasharray': e.dashed ? '6 5' : 'none',
          'marker-end': mk, opacity: '.75'
        });
        path.dataset.ei = ei;
        gEdges.appendChild(path);
        if (e.label) {
          const mi = Math.floor(all.length / 2);
          const lx = (all[mi].x + all[mi - 1].x) / 2;
          const ly = (all[mi].y + all[mi - 1].y) / 2;
          const t = el('text', {
            x: lx, y: ly - 7, 'text-anchor': 'middle',
            class: 'flow-edge-label', fill: col
          });
          t.textContent = e.label;
          gEdges.appendChild(t);
        }
      });

      /* ── nodes ── */
      spec.nodes.forEach(n => {
        const s = sizeOf(n);
        const kind = n.kind || 'process';
        const col = KIND_COL[kind] || '#94a3b8';
        const g = el('g', { class: 'flow-node', tabindex: '0', role: 'button' });
        g.dataset.id = n.id;
        let shape;
        if (kind === 'decision') {
          shape = el('polygon', {
            points: `${n.x + s.w / 2},${n.y} ${n.x + s.w},${n.y + s.h / 2} ${n.x + s.w / 2},${n.y + s.h} ${n.x},${n.y + s.h / 2}`,
            class: 'flow-shape'
          });
        } else if (kind === 'start' || kind === 'stop') {
          shape = el('rect', { x: n.x, y: n.y, width: s.w, height: s.h, rx: s.h / 2, class: 'flow-shape' });
        } else if (kind === 'io') {
          const skew = 12;
          shape = el('polygon', {
            points: `${n.x + skew},${n.y} ${n.x + s.w},${n.y} ${n.x + s.w - skew},${n.y + s.h} ${n.x},${n.y + s.h}`,
            class: 'flow-shape'
          });
        } else {
          shape = el('rect', { x: n.x, y: n.y, width: s.w, height: s.h, rx: 10, class: 'flow-shape' });
        }
        shape.style.setProperty('--flow-col', col);
        g.appendChild(shape);

        const lines = wrapText(n.label, Math.max(10, Math.floor(s.w / 7.4)));
        const txt = el('text', { 'text-anchor': 'middle', class: 'flow-label' });
        lines.forEach((ln, li) => {
          const ts = el('tspan', {
            x: n.x + s.w / 2,
            y: n.y + s.h / 2 + (li - (lines.length - 1) / 2) * 13 + 4
          });
          ts.textContent = ln;
          txt.appendChild(ts);
        });
        g.appendChild(txt);

        if (n.note) {
          const nt = el('text', {
            x: n.x + s.w / 2, y: n.y + s.h + 16,
            'text-anchor': 'middle', class: 'flow-note'
          });
          nt.textContent = n.note;
          g.appendChild(nt);
        }

        g.addEventListener('click', () => select(n));
        g.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n); }
        });
        gNodes.appendChild(g);
      });

      function select(n) {
        root.querySelectorAll('.flow-node').forEach(g => {
          g.classList.toggle('sel', g.dataset.id === n.id);
        });
        (spec.edges || []).forEach((e, ei) => {
          if (e.to !== n.id) return;
          const B = byId[e.to];
          const all = edgePoints(e);
          if (!all || !B) return;
          const d = 'M ' + all.map(p => `${p.x} ${p.y}`).join(' L ');
          const ghost = el('path', { d, fill: 'none', stroke: 'none' });
          gPkts.appendChild(ghost);
          const dot = el('circle', { r: '5', class: 'flow-packet', cx: '0', cy: '0' });
          dot.style.setProperty('--flow-col', KIND_COL[B.kind || 'process'] || '#22d3ee');
          gPkts.appendChild(dot);
          const pathEl = gEdges.querySelector(`path[data-ei="${ei}"]`);
          if (pathEl) {
            pathEl.classList.add('pulse');
            setTimeout(() => pathEl.classList.remove('pulse'), 1400);
          }
          try {
            const len = ghost.getTotalLength();
            if (len && dot.animate) {
              const frames = [];
              for (let i = 0; i <= 24; i++) {
                const pt = ghost.getPointAtLength(len * i / 24);
                frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)`, offset: i / 24 });
              }
              dot.animate(frames, { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
            }
          } catch (err) { /* non-animating environments: no-op */ }
          setTimeout(() => { ghost.remove(); dot.remove(); }, 1500);
        });
        if (opts.onNode) opts.onNode(n);
      }

      /* auto-focus the hero node so the story starts somewhere visible */
      const focusId = opts.focus || spec.focus;
      if (focusId && byId[focusId]) select(byId[focusId]);
    }

    draw();
    return { redraw: draw };
  }

  return { mountFlow, KIND_COL };
})();

/* ─────────────────────────────────────────────────────────── */
/*  VISUALIZER — the reusable step-through engine              */
/*                                                              */
/*  trace = {                                                   */
/*    code:  ['line 0', 'line 1', ...],                         */
/*    steps: [                                                  */
/*      { line: 2, caption: 'short label', narration: '…',      */
/*        state: { arr, ptrs:{L:0,R:3}, marks:{},               */
/*                 aux:[{label,value}], row2:{...} },           */
/*        fx: { type:'compare', indices:[0,3] },                */
/*        predict: { q, options:[], correct:0, why:'…' },      */
/*        drive:  { prompt, options:[], correct:0,              */
/*                  why:'…', hint:'…' } }                      */
/*    ]                                                         */
/*  }                                                           */
/* ─────────────────────────────────────────────────────────── */
CF.Visualizer = (() => {
  const PREF_KEY = 'cf_viz_prefs';
  const BASE_STEP_MS = 1500;

  function loadPrefs() {
    const defaults = { narration: true, sonify: true, captions: true, speed: 1 };
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return defaults;
      return Object.assign(defaults, JSON.parse(raw));
    } catch (e) { return defaults; }
  }
  function savePrefs(p) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
  }
  let prefs = loadPrefs();

  const PTR_COLORS = { L: 'var(--player)', R: 'var(--enemy)', i: '#a78bfa', l: '#fbbf24', 'r+1': '#fb923c', out: '#94a3b8' };





  /* ══════════════════════════════════════════════════════════
     SCENE ENGINE (shared by watch / drive / idea / problem)
     Manim-style continuity: DOM objects PERSIST across steps and
     are diffed against the new state — cells morph in place
     (numbers roll, bars grow), pointers GLIDE between indices,
     marks bloom, chips flip. Only a structural change (array
     length differs) triggers a clean re-layout with a soft fade,
     never a hard innerHTML wipe mid-scene.
     ══════════════════════════════════════════════════════════ */

  /* one shared rAF scheduler: cancel stale tweens on fast scrubbing */
  const tweens = new Map();
  let rafId = null;
  function runTweens(now) {
    tweens.forEach((tw, key) => {
      if (tw.dead) { tweens.delete(key); return; }
      const t = Math.min(1, (now - tw.t0) / tw.dur);
      const e = tw.ease(t);
      tw.onUpdate(e, t);
      if (t >= 1) { tweens.delete(key); if (tw.onEnd) tw.onEnd(); }
    });
    rafId = tweens.size ? requestAnimationFrame(runTweens) : null;
  }
  function tween(key, dur, ease, onUpdate, onEnd) {
    tweens.delete(key); /* re-issue cancels the previous animation of this object */
    tweens.set(key, { t0: performance.now(), dur, ease: ease || CF.Ease.inOutCubic, onUpdate, onEnd, dead: false });
    if (!rafId) rafId = requestAnimationFrame(runTweens);
  }
  function killTween(key) { const tw = tweens.get(key); if (tw) tw.dead = true; tweens.delete(key); }

  /* per-element motion memory: prev values / prev pointer x / prev marks */
  function meta(el) {
    if (!el._mt) el._mt = {};
    return el._mt;
  }

  function markOf(state, i) {
    return (state.marks && (state.marks[i] || state.marks[String(i)])) || '';
  }

  /* number roll: old digit morphs into new one (TransformMatchingObjects) */
  function rollNumber(valEl, from, to, durMs) {
    const numFrom = Number(from), numTo = Number(to);
    if (!(isFinite(numFrom) && isFinite(numTo)) || !valEl.animate) {
      valEl.textContent = String(to);
      if (valEl.animate) valEl.animate([{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      return;
    }
    const t0 = performance.now(), dur = durMs || 420;
    const key = 'roll:' + (valEl._rk || (valEl._rk = Math.random().toString(36).slice(2)));
    tween(key, dur, CF.Ease.outCubic, (e) => {
      valEl.textContent = String(Math.round(numFrom + (numTo - numFrom) * e));
    });
  }

  /* build a fresh cell (used on first paint / structural relayout) */
  function makeCell(v, i, frac, small) {
    const cell = document.createElement('div');
    cell.className = 'vz-cell' + (small ? ' small' : '');
    cell.dataset.i = i;
    cell.style.setProperty('--h', Math.round(frac * 100) + '%');
    cell.innerHTML = `<span class="vz-fill" style="height:${Math.round(28 + frac * 54)}px"></span>` +
                     `<span class="vz-val">${esc(v)}</span>`;
    meta(cell).value = v;
    meta(cell).frac = frac;
    return cell;
  }

  /* animate ONE row toward its target state, reusing existing cells */
  function syncRow(row, arr, marks, small, speedK) {
    const nums = arr.filter(x => typeof x === 'number');
    const lo = Math.min.apply(null, nums.length ? nums : [0]);
    const hi = Math.max.apply(null, nums.length ? nums : [1]);
    const dur = (ms) => ms * (speedK || 1);

    /* reuse or create cells positionally */
    const old = Array.from(row.children);
    arr.forEach((v, i) => {
      const frac = typeof v === 'number' ? (hi > lo ? (v - lo) / (hi - lo) : 0.6) : 0.5;
      let cell = old[i];
      if (!cell || cell.classList.contains('vz-exiting')) {
        cell = makeCell(v, i, frac, small);
        if (old[i]) old[i].remove();
        row.insertBefore(cell, old[i + 1] || null);
        cell.classList.add('vz-entering');
        setTimeout(() => cell.classList.remove('vz-entering'), 400);
      } else {
        const m = meta(cell);
        /* VALUE MORPH: only when the number actually changed */
        if (String(m.value) !== String(v)) {
          rollNumber(cell.querySelector('.vz-val'), m.value, v, dur(420));
          m.value = v;
        }
        /* BAR GROW/MORPH via CSS-tweened --h + fill height */
        if (m.frac !== frac) {
          cell.style.setProperty('--h', Math.round(frac * 100) + '%');
          cell.querySelector('.vz-fill').style.height = Math.round(28 + frac * 54) + 'px';
          m.frac = frac;
        }
      }
      /* MARK TRANSFORMS: bloom on enter, settle on leave */
      const mk = marks && (marks[i] || marks[String(i)]) || '';
      const prevMk = meta(cell).mark || '';
      if (prevMk !== mk) {
        ['cmp', 'win', 'out', 'write'].forEach(c => cell.classList.remove(c));
        if (mk) {
          cell.classList.add(mk);
          if (cell.animate) {
            const col = mk === 'win' ? '251,191,36' : mk === 'write' ? '34,197,94' : mk === 'cmp' ? '34,211,238' : '148,163,184';
            cell.animate([
              { boxShadow: `0 0 0 0 rgba(${col},.6)` },
              { boxShadow: `0 0 0 8px rgba(${col},0)` }
            ], { duration: dur(520), easing: 'ease-out' });
          }
        }
        meta(cell).mark = mk;
      }
    });
    /* cells beyond the new length fade out (FadeOut) */
    for (let i = arr.length; i < old.length; i++) {
      const c = old[i];
      if (!c || c.classList.contains('vz-exiting')) continue;
      c.classList.add('vz-exiting');
      if (c.animate) c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px) scale(.8)' }], { duration: dur(260), fill: 'forwards' });
      setTimeout(() => c.remove(), dur(300));
    }
  }

  /* pointers glide: keep the same DOM node, animate left → left */
  function positionPointers(layer, row, ptrs, n, speedK) {
    const cells = row.querySelectorAll('.vz-cell:not(.vz-exiting)');
    const lr = layer.getBoundingClientRect();
    const wantIds = Object.keys(ptrs || {});
    /* retire pointers that vanished */
    layer.querySelectorAll('.vz-ptr').forEach(el => {
      if (!wantIds.includes(el.dataset.ptr)) {
        if (el.animate) el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-50%) translateY(6px)' }], { duration: 220, fill: 'forwards' });
        setTimeout(() => el.remove(), 240);
      }
    });
    wantIds.forEach(id => {
      const i = ptrs[id];
      let el = layer.querySelector(`[data-ptr="${CSS.escape ? CSS.escape(id) : id}"]`) ||
               Array.from(layer.querySelectorAll('.vz-ptr')).find(x => x.dataset.ptr === id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'vz-ptr vz-ptr-new';
        el.dataset.ptr = id;
        el.innerHTML = `<span class="vz-ptr-tag">${esc(id)}</span><span class="vz-ptr-arrow">▲</span>`;
        layer.appendChild(el);
      }
      const idx = Math.max(0, Math.min(i, cells.length - 1));
      const cell = cells[idx];
      if (!cell) return;
      const cr = cell.getBoundingClientRect();
      const targetX = (i > cells.length - 1)
        ? (cr.right - lr.left + 4)                    /* past-the-end pointer hovers beyond the row */
        : (cr.left - lr.left + cr.width / 2);
      const m = meta(el);
      const fromX = (typeof m.x === 'number' && el.style.left) ? m.x : targetX;
      const col = PTR_COLORS[id] || 'var(--player)';
      el.style.color = col;
      el.style.setProperty('--ptr-col', col);
      if (Math.abs(fromX - targetX) > 1) {
        /* GLIDE along an eased path (MotionMatcher-style smooth travel) */
        tween('ptr:' + id + ':' + (layer._uid || (layer._uid = Math.random().toString(36).slice(2))),
          380 * (speedK || 1), CF.Ease.inOutCubic,
          (e) => { const x = fromX + (targetX - fromX) * e; el.style.left = x + 'px'; m.x = x; },
          () => { m.x = targetX; el.style.left = targetX + 'px'; });
      } else {
        el.style.left = targetX + 'px'; m.x = targetX;
      }
    });
  }

  /* aux chips: text-swap animates (Flip-ish pop), added chips slide in */
  function syncAux(stage, auxList) {
    let aux = stage.querySelector(':scope > .vz-aux');
    if (!auxList || !auxList.length) { if (aux) aux.remove(); return; }
    if (!aux) { aux = document.createElement('div'); aux.className = 'vz-aux'; stage.appendChild(aux); }
    const want = auxList.map(a => `${a.label}\u0000${a.value}`);
    /* remove stale / exiting */
    Array.from(aux.children).forEach(ch => {
      if (!want.includes(ch.dataset.k)) {
        if (ch.animate) ch.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.85)' }], { duration: 200, fill: 'forwards' });
        setTimeout(() => ch.remove(), 220);
        ch.dataset.k = '\u0000dead'; /* don't double-process */
      }
    });
    want.forEach((k, i) => {
      let chip = Array.from(aux.children).find(c => c.dataset.k === k);
      if (!chip) {
        const a = auxList[i];
        chip = document.createElement('span');
        chip.className = 'vz-aux-chip';
        chip.dataset.k = k;
        chip.innerHTML = `<b>${esc(a.label)}</b> ${esc(a.value)}`;
        aux.appendChild(chip);
        if (chip.animate) chip.animate(
          [{ opacity: 0, transform: 'translateY(6px) scale(.9)' }, { opacity: 1, transform: 'none' }],
          { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      } else if (chip.dataset.stale) {
        delete chip.dataset.stale;
      }
    });
  }

  /* ── PUBLIC: render/animate a scene toward `state`.
        opts.fx  → sceneFx choreography overlay (rings/dim/arcs/pulse)
        opts.cut → force clean relayout (phase switches)            ── */
  function renderScene(stage, state, opts) {
    if (!state) return;
    opts = opts || {};
    const speedK = 1;

    /* structural check: does the persistent layout still match? */
    const rowSel = opts.smallRow ? '.vz-row.small' : ':scope > .vz-row:not(.small)';
    let main = stage.querySelector(':scope > .vz-row');
    let ptrLayer = stage.querySelector(':scope > .vz-ptrs:first-of-type');
    const arr = state.arr || [];
    const structOk = main && ptrLayer &&
      main.querySelectorAll('.vz-cell:not(.vz-exiting)').length === arr.length &&
      !opts.cut;

    if (!structOk) {
      /* full (re)build — but with a SOFT cut, not a blink */
      stage.querySelectorAll(':scope > .vz-row, :scope > .vz-ptrs, :scope > .vz-aux, :scope > .vz-row2-wrap, :scope > .vz-fx-svg').forEach(n => n.remove());
      main = document.createElement('div');
      main.className = 'vz-row';
      stage.appendChild(main);
      arr.forEach((v, i) => {
        const nums = arr.filter(x => typeof x === 'number');
        const lo = Math.min.apply(null, nums.length ? nums : [0]);
        const hi = Math.max.apply(null, nums.length ? nums : [1]);
        const frac = typeof v === 'number' ? (hi > lo ? (v - lo) / (hi - lo) : 0.6) : 0.5;
        const cell = makeCell(v, i, frac, false);
        /* POLISH A: long rows shrink cells to fit — positions stay
           measurable for arcs, whole array framed at once */
        const availW = (stage.clientWidth || 640) - 8;
        const wide = Math.max(30, Math.min(46, Math.floor(availW / Math.max(1, arr.length)) - 6));
        if (wide < 46) cell.style.width = wide + 'px';
        const mk = markOf(state, i);
        if (mk) { cell.classList.add(mk); meta(cell).mark = mk; }
        main.appendChild(cell);
      });
      ptrLayer = document.createElement('div');
      ptrLayer.className = 'vz-ptrs';
      stage.appendChild(ptrLayer);
      stage.classList.remove('vz-cut'); void stage.offsetWidth; stage.classList.add('vz-cut');
    } else {
      /* in-place morph: cells roll/grow, marks bloom */
      const availW = (stage.clientWidth || 640) - 8;
      const wide = Math.max(30, Math.min(46, Math.floor(availW / Math.max(1, arr.length)) - 6));
      Array.from(main.children).forEach(c => { if (wide < 46) c.style.width = wide + 'px'; });
      syncRow(main, arr, state.marks, false, speedK);
    }

    positionPointers(ptrLayer, main, state.ptrs || {}, arr.length, speedK);
    syncAux(stage, state.aux);

    /* second row (prefix arrays / output rows) */
    if (state.row2) {
      let wrap = stage.querySelector(':scope > .vz-row2-wrap');
      const r2arr = state.row2.arr || [];
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'vz-row2-wrap';
        wrap.innerHTML = `<div class="vz-row2-label"></div><div class="vz-row small"></div>`;
        stage.appendChild(wrap);
      }
      wrap.querySelector('.vz-row2-label').textContent = state.row2.label || '';
      syncRow(wrap.querySelector('.vz-row.small'), r2arr, state.row2.marks, true, speedK);
      let p2 = wrap.querySelector(':scope > .vz-ptrs');
      if (state.row2.ptrs && Object.keys(state.row2.ptrs).length) {
        if (!p2) { p2 = document.createElement('div'); p2.className = 'vz-ptrs'; wrap.appendChild(p2); }
        positionPointers(p2, wrap.querySelector('.vz-row.small'), state.row2.ptrs, r2arr.length, speedK);
      } else if (p2) p2.remove();
    } else {
      const wrap = stage.querySelector(':scope > .vz-row2-wrap');
      if (wrap) wrap.remove();
    }

    /* sceneFx choreography overlay (hand-authored beats + auto-diff) */
    applySceneFx(stage, state, opts.fx);
  }

  /* ── sceneFx: rings, dim focus, self-drawing arcs + packet rides,
        halo pulses. All positioned from live cell rects so they work
        inside the player stage AND the mini stages alike. ── */
  function applySceneFx(stage, state, fx) {
    let svg = stage.querySelector(':scope > .vz-fx-svg');
    if (!fx) {
      stage.querySelectorAll('.vz-cell.vz-ring, .vz-cell.vz-dim').forEach(c => c.classList.remove('vz-ring', 'vz-dim'));
      if (svg) svg.remove();
      return;
    }
    const cells = Array.from(stage.querySelectorAll(':scope > .vz-row > .vz-cell'));
    const sr = stage.getBoundingClientRect();
    const centers = cells.map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2, w: r.width, h: r.height };
    });
    /* dim everything outside the focus set → "this move, and only this" */
    const focus = new Set((fx.cells || []).concat(fx.ring || [], fx.arc ? fx.arc : [], fx.pulse != null ? [fx.pulse] : []));
    cells.forEach((c, i) => {
      c.classList.toggle('vz-dim', !!fx.dim && focus.size > 0 && !focus.has(i));
      c.classList.toggle('vz-ring', !!(fx.ring && fx.ring.includes(i)));
    });
    /* SVG overlay: arcs + packets + halo */
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'vz-fx-svg');
      stage.appendChild(svg);
    }
    svg.innerHTML = '';
    const NS = 'http://www.w3.org/2000/svg';
    const color = fx.color || '#fbbf36';
    if (fx.pulse != null && centers[fx.pulse]) {
      const c = centers[fx.pulse];
      const halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('cx', c.x); halo.setAttribute('cy', c.y); halo.setAttribute('r', c.w * 0.7);
      halo.setAttribute('fill', 'none'); halo.setAttribute('stroke', color); halo.setAttribute('class', 'vz-halo');
      svg.appendChild(halo);
      if (halo.animate) {
        halo.animate([{ opacity: .9, transform: `translate(${c.x}px,${c.y}px) scale(.6)` },
                      { opacity: 0, transform: `translate(${c.x}px,${c.y}px) scale(1.9)` }],
          { duration: 1200, iterations: Infinity, easing: 'ease-out' });
        halo.style.transformOrigin = `${-c.x}px ${-c.y}px`;
        halo.setAttribute('cx', 0); halo.setAttribute('cy', 0);
      }
    }
    if (fx.arc && centers[fx.arc[0]] && centers[fx.arc[1]]) {
      const a = centers[fx.arc[0]], b = centers[fx.arc[1]];
      const lift = Math.min(46, 14 + Math.abs(b.x - a.x) * 0.22);
      const d = `M ${a.x} ${a.y - a.h / 2 - 4} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - a.h / 2 - 4 - lift} ${b.x} ${b.y - b.h / 2 - 4}`;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('class', 'vz-arc');
      path.setAttribute('stroke', color);
      svg.appendChild(path);
      try {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        if (path.animate) {
          path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
            { duration: 500, easing: 'ease-out', fill: 'forwards' });
          if (fx.token) {
            const dot = document.createElementNS(NS, 'circle');
            dot.setAttribute('r', '5'); dot.setAttribute('class', 'vz-token-dot');
            dot.setAttribute('fill', color);
            svg.appendChild(dot);
            const frames = [];
            for (let k = 0; k <= 24; k++) {
              const pt = path.getPointAtLength(len * k / 24);
              frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)`, offset: k / 24 });
            }
            setTimeout(() => {
              if (dot.animate) dot.animate(frames, { duration: 620, delay: 380, easing: 'ease-in-out', fill: 'forwards' });
            }, 0);
          }
        }
      } catch (e) { /* getTotalLength unavailable: static arc still shows */ }
    }
  }



  /* ── PLAYER ── */
  function createPlayer(opts) {
    /* suppressOverlay: the lesson shell can render its own checkpoint UI
       (prediction market) instead of the built-in 🤔 popup — one prompt
       engine at a time, never both. */
    const { container, trace, mode = 'watch', onDone, onProgress, suppressOverlay } = opts;
    const steps = trace.steps || [];
    let idx = 0;
    let playing = mode === 'drive';
    let timer = null;
    const stats = { predicts: { right: 0, total: 0 }, driveMistakes: 0 };
    let destroyed = false;
    let doneFired = false;

    function fireDone() {
      if (doneFired || destroyed) return;
      doneFired = true;
      pause();
      CF.Sonify.fx('win', {});
      if (onDone) onDone({ ...stats });
    }

    /* Build DOM */
    container.innerHTML = `
      <div class="vz">
        <div class="vz-head">
          <span class="vz-phase">${mode === 'drive' ? '🎮 Drive it' : '👀 Watch'}</span>
          <span class="vz-progress" id="vzProg"></span>
          <span class="vz-toggles">
            <button class="vz-toggle" data-t="narration" title="Narration">🔊</button>
            <button class="vz-toggle" data-t="sonify" title="Sonification">🎵</button>
            <button class="vz-toggle" data-t="captions" title="Captions">💬</button>
          </span>
        </div>
        <div class="vz-stage" id="vzStage"></div>
        <div class="vz-caption" id="vzCap"></div>
        <div class="vz-codeline" id="vzCode"></div>
        <div class="vz-transport" id="vzTransport"></div>
        <div class="vz-overlay" id="vzOverlay" style="display:none"></div>
        <div class="vz-drive" id="vzDrive" style="display:none"></div>
      </div>`;

    const el = (id) => container.querySelector('#' + id);
    const stage = el('vzStage'), cap = el('vzCap'), codeEl = el('vzCode');
    const transport = el('vzTransport'), overlay = el('vzOverlay'), driveEl = el('vzDrive');

    /* code panel */
    (trace.code || []).forEach((line, i) => {
      const l = document.createElement('div');
      l.className = 'vz-code-line';
      l.dataset.line = i;
      l.textContent = line;
      codeEl.appendChild(l);
    });

    /* toggles */
    container.querySelectorAll('.vz-toggle').forEach(btn => {
      const t = btn.dataset.t;
      const paint = () => { btn.classList.toggle('off', !prefs[t]); };
      paint();
      btn.addEventListener('click', () => {
        prefs[t] = !prefs[t];
        savePrefs(prefs);
        paint();
        if (t === 'narration' && !prefs.narration) CF.Narrator.stop();
        if (t === 'sonify') CF.Sonify.setEnabled(prefs.sonify);
      });
    });
    CF.Narrator.setEnabled(prefs.narration);
    CF.Sonify.setEnabled(prefs.sonify);

    /* transport */
    function transportBtn(label, fn, title) {
      const b = document.createElement('button');
      b.className = 'vz-btn';
      b.textContent = label;
      b.title = title || '';
      b.addEventListener('click', fn);
      transport.appendChild(b);
      return b;
    }
    let playBtn = null;
    if (mode === 'watch') {
      transportBtn('⏮', () => { goTo(0); }, 'Restart');
      transportBtn('◀', () => { goTo(Math.max(0, idx - 1)); }, 'Back one step');
      playBtn = transportBtn('▶', () => { togglePlay(); }, 'Play / pause');
      transportBtn('▶|', () => { stepForward(); }, 'Forward one step');
      const speedSel = document.createElement('select');
      speedSel.className = 'vz-speed';
      [0.75, 1, 1.5, 2].forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s + '×';
        if (s === prefs.speed) o.selected = true;
        speedSel.appendChild(o);
      });
      speedSel.addEventListener('change', () => { prefs.speed = Number(speedSel.value); savePrefs(prefs); });
      transport.appendChild(speedSel);
    } else {
      transportBtn('⏮', () => { goTo(0); }, 'Restart');
      /* manual step-forward: in drive mode the learner waits on timers
         between prompts — this guarantees forward control even if the
         auto-advance chain ever dies (a step with an open prompt is
         still protected: stepForward refuses to skip it) */
      transportBtn('▶|', () => { clearTimer(); stepForward(); }, 'Forward one step');
    }

    /* ── stepping ── */
    function stepMs() { return BASE_STEP_MS / (prefs.speed || 1); }

    /* Pacing — LAG FIX: the voice itself is the clock. autoAdvance polls
       isSpeaking() every 250 ms and moves the moment a sentence ends, so
       this number is only the floor. The old formula used the raw estimate
       as the WAIT (8–11 s dead air per long sentence). Now it is capped at
       3.5 s; when narration is off it becomes reading time instead. */
    function stepWaitMs() {
      const base = stepMs();
      if (!prefs.narration) {
        const s = steps[idx];
        const text = s ? (s.narration || s.caption || '') : '';
        if (text) return Math.max(base, Math.min(CF.Narrator.estimateMs(text, prefs.speed || 1), 4000));
        return base;
      }
      return base;
    }

    /* Hold a prompt overlay until the sentence that introduced it has
       actually been spoken (or plausibly finished). Without this the 🤔
       question popped up over the narrator's first words — learners read
       faster than the voice talks and thought the narration was skipped.

       MESS FIX: the old version polled isSpeaking() every 250 ms, but many
       engines fire onstart late or not at all — after ~700 ms of grace the
       poll concluded "not speaking" and the prompt cut in mid-sentence.
       Now we also keep holding while the utterance is still queued/running
       inside speechSynthesis, and as a last resort fall back to the spoken
       duration estimate so a long intro is never interrupted. Hard cap 20 s
       so a wedged engine can't hide a prompt forever. */
    function voiceBusy() {
      if (!CF.Narrator.isEnabled() || !CF.Narrator.supported()) return false;
      /* NEVER trust speechSynthesis.speaking alone: it wedges true in
         several engines and froze every gated step. The Narrator's own
         tracked utterance (with a hard estimate cap) is the source of
         truth; `pending` only counts while that utterance is live. */
      if (!CF.Narrator.isSpeaking()) return false;
      try { return window.speechSynthesis.speaking || window.speechSynthesis.pending; }
      catch (e) { return false; }
    }
    function afterNarration(fn) {
      const s = steps[idx];
      const text = s ? (s.narration || s.caption || '') : '';
      let holdMs;
      if (!prefs.narration) {
        /* voice off → the caption is the narration: give reading time */
        holdMs = text ? Math.min(CF.Narrator.estimateMs(text, 2), 4000) : 0;
      } else {
        /* voice on → spoken duration estimate as the floor; the engine's own
           speaking/pending flags extend it when real speech runs longer.
           Cap 15 s to match estimateMs — a wedged engine can never push
           this gate out further (was 20 s, a freeze window). */
        holdMs = Math.min(CF.Narrator.estimateMs(text, prefs.speed || 1), 15000);
      }
      const t0 = Date.now();
      /* ABSOLUTE DEADLINE: a wedged voice engine can never hide a prompt
         forever — after hold + slack the callback fires regardless. */
      const deadline = t0 + holdMs + 4000;
      let settled = false;
      const tick = () => {
        if (destroyed || settled) return;
        if (Date.now() >= deadline) { settled = true; fn(); return; }
        const el = Date.now() - t0;
        if (el < holdMs || voiceBusy()) { timer = setTimeout(tick, 200); return; }
        settled = true;
        fn();
      };
      clearTimer();
      tick();
    }

    /* ── AUTO-CHOREOGRAPHY (auto_diff in Manim terms) ──
       When a step carries no hand-authored sceneFx, derive one from the
       DELTA against the previous painted state: changed cells get rings,
       moved pointers pulse toward their destination, everything outside
       the delta dims. This means EVERY lesson trace animates coherently
       even when its data never mentions animation at all. */
    let lastPainted = null;
    function autoFx(s) {
      if (s.sceneFx) return s.sceneFx;
      const prev = lastPainted;
      const st = s.state || {};
      if (!prev) return null;
      const arr = st.arr || [], parr = prev.arr || [];
      if (arr.length !== parr.length) return null; /* structural cut: no diff fx */
      const changed = [];
      for (let i = 0; i < arr.length; i++) if (String(arr[i]) !== String(parr[i])) changed.push(i);
      const marksOn = [], marksOff = [];
      const pm = prev.marks || {}, cm = st.marks || {};
      Object.keys(cm).forEach(k => { if (cm[k] && cm[k] !== pm[k]) marksOn.push(Number(k)); });
      const ptrMoved = [];
      const pp = prev.ptrs || {}, cp = st.ptrs || {};
      Object.keys(cp).forEach(id => { if (pp[id] != null && pp[id] !== cp[id]) ptrMoved.push({ id, from: pp[id], to: cp[id] }); });
      const ring = [...new Set(changed.concat(marksOn).filter(n => !Number.isNaN(n)))].slice(0, 6);
      if (!ring.length && !ptrMoved.length) return null;
      const fx = { dim: true, ring, cells: ring };
      if (ptrMoved.length) { fx.pulse = Math.max(0, Math.min(ptrMoved[0].to, arr.length - 1)); fx.color = '#22d3ee'; }
      if (changed.length === 1 && s.fx && (s.fx.type === 'write' || s.fx.type === 'swap') && ptrMoved.length) {
        fx.arc = [ptrMoved[0].from, changed[0]]; fx.token = true; /* value rides the pointer → cell */
      }
      return fx;
    }

    function renderStep() {
      const s = steps[idx];
      if (!s) return;
      const fxObj = autoFx(s);
      renderScene(stage, s.state || { arr: [] }, { fx: fxObj });
      lastPainted = s.state;
      container.querySelector('.vz-progress').textContent = `${idx + 1} / ${steps.length}`;
      codeEl.querySelectorAll('.vz-code-line').forEach(l =>
        l.classList.toggle('active', Number(l.dataset.line) === (s.line ?? -1)));
      cap.textContent = s.caption || '';
      cap.className = 'vz-caption' + (prefs.captions && s.narration ? ' full' : '');
      if (prefs.captions && s.narration) cap.textContent = s.narration;
      /* SPEAK THE STEP: the player owns its narration. Without this the
         walkthrough was silent AND every voice gate waited on a stale
         utterance from the previous phase — steps advanced out of sync
         with what the learner could see. Track when we spoke so the
         pacing gates have an honest clock even without speechSynthesis. */
      const spokenText = s.narration || s.caption || '';
      narrationStartedAt = Date.now();
      narrationMs = CF.Narrator.estimateMs(spokenText, prefs.speed || 1);
      if (spokenText) CF.Narrator.speak(spokenText);
      /* caption re-entry pop — text changes deserve a soft arrival too */
      if (cap.animate) cap.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
      if (s.fx && s.fx.type) {
        const arr = s.state?.arr || [];
        const numsA = arr.filter(x => typeof x === 'number');
        CF.Sonify.fx(s.fx.type, {
          ...s.fx,
          arr,
          valueLo: numsA.length ? Math.min.apply(null, numsA) : 0,
          valueHi: numsA.length ? Math.max.apply(null, numsA) : 1
        });
      }
    }

    let narrationStartedAt = 0;
    let narrationMs = 0;
    function narrationIdle() {
      if (destroyed) return true;
      const el = Date.now() - narrationStartedAt;
      /* HARD BACKSTOP: whatever the engine claims, after the estimate +
         slack the voice is declared done. This is what unfreezes the
         lesson when speechSynthesis wedges mid-sentence. */
      const bu = CF.Narrator.busyUntil();
      if (bu && Date.now() > bu) return true;
      if (!prefs.narration) return el >= narrationMs;
      /* hard floor: never let a lying engine release the card while the
         intro sentence could still be mid-word — but only up to the cap */
      if (el < Math.min(narrationMs, 1200)) return false;
      return !voiceBusy();
    }

    function goTo(i) {
      pause();
      if (mode === 'drive') playing = true; /* drive has no manual pause — it only waits at prompts */
      idx = Math.max(0, Math.min(i, steps.length - 1));
      renderStep();
      maybeInteract();
    }

    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }

    /* an open predict/drive prompt must never be skipped by a pending timer */
    function promptOpen() {
      return overlay.style.display !== 'none' || driveEl.style.display !== 'none';
    }

    function stepForward() {
      if (promptOpen()) return;
      if (idx >= steps.length - 1) { finishIfEnd(); return; }
      idx++;
      renderStep();
      maybeInteract();
    }

    function maybeInteract() {
      const s = steps[idx];
      overlay.style.display = 'none';
      driveEl.style.display = 'none';
      /* BUG FIX: prompts used to pop up while the narrator was still
         introducing the step — the question appeared BEFORE the voice
         explained it. Now every prompt waits for that sentence to be
         spoken (or plausibly finished), so context always comes first. */
      if (s.predict && mode === 'watch') {
        pause();
        /* lesson shell owns this checkpoint (market card) — no built-in
           popup, and NO afterNarration timer here either: the old code ran
           a 200 ms poll loop on top of the lesson's own timer, and the two
           raced each other mid-sentence. The player now only exposes
           narrationIdle(); lessons gate their card mount on it. */
        return;
      }
      if (s.drive && mode === 'drive') { pause(); afterNarration(() => showDrive(s)); return; }
      if (playing) { autoAdvance(); } /* keep the playback chain alive in BOTH modes */
    }

    function autoAdvance() {
      clearTimer();
      const s = steps[idx];
      const text = s ? (s.narration || s.caption || '') : '';
      /* hold at least as long as the sentence takes to speak — the voice is
         the clock, but when an engine reports "not speaking" too early we
         still fall back to the estimate so steps never machine-gun past
         half-heard narration. */
      const minHold = prefs.narration
        ? Math.min(CF.Narrator.estimateMs(text, prefs.speed || 1), 15000)
        : stepWaitMs();
      const t0 = Date.now();
      /* ABSOLUTE DEADLINE: even if voiceBusy() never releases (wedged
         engine), playback MUST advance by this time. Without it the
         walkthrough froze forever at the first narrated step. */
      const deadline = t0 + minHold + 4000;
      let settled = false;
      const tick = () => {
        if (destroyed || !playing || settled) return;
        if (Date.now() >= deadline) { settled = true; stepForward(); return; }
        const el = Date.now() - t0;
        if (el < minHold || voiceBusy()) { timer = setTimeout(tick, 200); return; }
        settled = true;
        stepForward();
      };
      timer = setTimeout(tick, Math.min(stepWaitMs(), minHold));
    }

    function togglePlay() {
      if (playing) { pause(); }
      else {
        if (promptOpen()) return; /* don't auto-skip an open prompt */
        playing = true; autoAdvance();
      }
      if (playBtn) playBtn.textContent = playing ? '⏸' : '▶';
    }
    function pause() {
      playing = false;
      clearTimer();
      if (playBtn) playBtn.textContent = '▶';
    }

    function finishIfEnd() {
      if (idx >= steps.length - 1) {
        fireDone();
      }
    }

    /* ── predict overlay (watch mode) ── */
    function showPredict(s) {
      if (suppressOverlay) return; /* lesson shell renders its own checkpoint */
      stats.predicts.total++;
      overlay.style.display = 'flex';
      overlay.innerHTML = `
        <div class="vz-pop">
          <div class="vz-pop-q">🤔 ${esc(s.predict.q)}</div>
          <div class="vz-pop-opts"></div>
          <div class="vz-pop-why" style="display:none"></div>
        </div>`;
      const optsBox = overlay.querySelector('.vz-pop-opts');
      const whyBox = overlay.querySelector('.vz-pop-why');
      let answered = false;
      s.predict.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'vz-opt';
        b.textContent = opt;
        b.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          const right = i === s.predict.correct;
          if (right) { stats.predicts.right++; CF.Sonify.fx('win', {}); }
          else { CF.Sonify.fx('buzz', {}); }
          b.classList.add(right ? 'right' : 'wrong');
          overlay.querySelectorAll('.vz-opt').forEach((o, j) => {
            if (j === s.predict.correct) o.classList.add('right');
            o.disabled = true;
          });
          whyBox.style.display = 'block';
          whyBox.innerHTML = `${right ? '✅' : '❌'} ${esc(s.predict.why)}<br>
            <button class="vz-opt continue">Continue ▶</button>`;
          whyBox.querySelector('.continue').addEventListener('click', () => {
            overlay.style.display = 'none';
            playing = true;
            if (playBtn) playBtn.textContent = '⏸';
            autoAdvance();
          });
        });
        optsBox.appendChild(b);
      });
      /* announce the popup so it is never missed (it can appear off-screen
         on short viewports): chime + gentle scroll into view */
      CF.Sonify.fx('tick', {});
      try { overlay.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    }

    /* ── drive bar (drive mode) ── */
    function showDrive(s) {
      driveEl.style.display = 'block';
      driveEl.innerHTML = `
        <div class="vz-drive-q">${esc(s.drive.prompt)}</div>
        <div class="vz-drive-opts"></div>
        <div class="vz-drive-fb"></div>`;
      const optsBox = driveEl.querySelector('.vz-drive-opts');
      const fb = driveEl.querySelector('.vz-drive-fb');
      let answered = false;
      s.drive.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'vz-opt';
        b.textContent = opt;
        b.addEventListener('click', () => {
          if (answered) return;
          if (i === s.drive.correct) {
            answered = true;
            CF.Sonify.fx('win', {});
            optsBox.querySelectorAll('.vz-opt').forEach(o => o.disabled = true);
            b.classList.add('right');
            fb.textContent = '✅ ' + (s.drive.why || '');
            fb.className = 'vz-drive-fb ok';
            /* Manual Continue: the run can never be stranded — a stalled
               timer, a wedged voice engine, or an impatient learner all
               reach the next step through this button (mirrors the
               predict overlay). The auto-advance fires first, capped at
               5 s so the screen never sits still for long. */
            let advanced = false;
            const advance = () => {
              if (advanced) return;
              advanced = true;
              clearTimer();
              driveEl.style.display = 'none';
              playing = true;
              autoAdvance();
            };
            const cont = document.createElement('button');
            cont.className = 'vz-opt continue';
            cont.textContent = 'Continue ▶';
            cont.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
            fb.appendChild(document.createElement('br'));
            fb.appendChild(cont);
            timer = setTimeout(advance,
              Math.max(1200, Math.min(CF.Narrator.estimateMs(s.drive.why || '', 1) + 300, 5000)));
          } else {
            stats.driveMistakes++;
            CF.Sonify.fx('buzz', {});
            b.classList.add('wrong');
            fb.textContent = '❌ ' + (s.drive.hint || 'Not quite — check the sum and think again.');
            fb.className = 'vz-drive-fb bad';
            setTimeout(() => b.classList.remove('wrong'), 600);
          }
        });
        optsBox.appendChild(b);
      });
    }

    /* finish detection: fire onDone once the last step has been shown —
       using the same voice-locked pacing as normal steps, so the "Next"
       button never appears while the closing sentence is still spoken. */
    const origRender = renderStep;
    renderStep = function () {
      origRender();
      if (idx >= steps.length - 1 && !steps[idx].drive && !steps[idx].predict) {
        clearTimer();
        afterNarration(() => fireDone());
      }
    };

    function destroy() {
      destroyed = true;
      clearTimer();
      pause();
      CF.Narrator.stop();
    }

    /* init */
    renderStep();
    maybeInteract(); /* engage: drive mode starts advancing / opens the first prompt */

    return { destroy, goTo, stepForward, narrationIdle, play: () => { if (!playing) togglePlay(); } };
  }

  return { createPlayer, renderScene };
})();
