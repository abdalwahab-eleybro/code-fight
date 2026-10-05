/* ═══════════════════════════════════════════════════════════ */
/*  13-visualizer.js — Step-through visualizer                 */
/*  · CF.Narrator  — speechSynthesis narration (modality)      */
/*  · CF.Sonify    — algorithm sonification (Web Audio)        */
/*  · CF.Visualizer— code+array sync player with predict stops */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

/* ─────────────────────────────────────────────────────────── */
/*  CF.Motion — hand-authored Manim-style SVG scenes            */
/*                                                              */
/*  Remotion / manim require a build pipeline and produce       */
/*  video files; this app is a zero-build single-page game, so  */
/*  we recreate the SAME visual language natively:             */
/*   · dark canvas + faint grid (the 3b1b backdrop)            */
/*   · shapes that DRAW THEMSELVES on entry (stroke dashoffset) */
/*   · elements that GLIDE with eased transforms, never snap    */
/*   · glowing "dots" travelling along paths (packet flow)      */
/*   · camera labels that fade up like 3b1b annotations        */
/*                                                              */
/*  A scene is declarative data:                                */
/*  { viewBox:'0 0 640 260',                                   */
/*    defs:[{id:'grad-x', kind:'linear'|'radial', stops:[[o,c]]}],*/
/*    items:[                                                   */
/*      { id, kind:'rect'|'circle'|'path'|'text'|'arrow'|'arc', */
/*        x,y,w,h,r,d, text, fill, stroke, sw, opacity, rx,     */
/*        anchor, size, weight,                                */
/*        enter:'fade'|'draw'|'pop', delay(ms),                */
/*        glow:true|color, pulse:true,                         */
/*        motion:{ at:ms, dur:ms, ease:'smooth'|'bounce',      */
/*                 props:{ x, y, w, h, r, scale, opacity,      */
/*                         rotate } }                           */
/*    ] }                                                       */
/*                                                              */
/*  mountScene(el, spec) paints it once (each element keeps a   */
/*  stable DOM node keyed by id, so re-mounts tween from the    */
/*  previous state instead of hard-cutting).                    */
/*  Returns { play(), stop(), setMotion(id, m), el }.           */
/* ─────────────────────────────────────────────────────────── */
CF.Motion = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function mk(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  const EASE = 'cubic-bezier(.4,0,.2,1)';           /* smooth  */
  const EASE_POP = 'cubic-bezier(.34,1.56,.64,1)';  /* bounce  */

  function baseAttrs(it) {
    const a = {};
    if (it.x != null) a.x = it.x;
    if (it.y != null) a.y = it.y;
    if (it.w != null) a.width = it.w;
    if (it.h != null) a.height = it.h;
    if (it.r != null) a.r = it.r;
    if (it.rx != null) a.rx = it.rx;
    if (it.d != null) a.d = it.d;
    if (it.cx != null) a.cx = it.cx;
    if (it.cy != null) a.cy = it.cy;
    if (it.fill != null) a.fill = it.fill;
    if (it.stroke != null) a.stroke = it.stroke;
    if (it.sw != null) a['stroke-width'] = it.sw;
    if (it.opacity != null) a.opacity = it.opacity;
    if (it.anchor) { a['text-anchor'] = it.anchor; }
    if (it.size) a['font-size'] = it.size;
    if (it.weight) a['font-weight'] = it.weight;
    if (it.family) a['font-family'] = it.family;
    return a;
  }

  function makeItem(it, defsHost, svgId) {
    let n;
    switch (it.kind) {
      case 'circle': n = mk('circle', baseAttrs(it)); break;
      case 'path':   n = mk('path', baseAttrs(it)); break;
      case 'arc':    n = mk('path', baseAttrs(it)); break;
      case 'text': {
        n = mk('text', baseAttrs(it));
        n.textContent = it.text != null ? String(it.text) : '';
        break;
      }
      case 'arrow': {
        /* line with an arrowhead marker */
        const mid = 'mk-' + svgId + '-' + (++uid);
        const marker = mk('marker', {
          id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5,
          markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
        });
        marker.appendChild(mk('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: it.stroke || '#94a3b8' }));
        defsHost.appendChild(marker);
        n = mk('line', {
          x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2,
          stroke: it.stroke || '#94a3b8', 'stroke-width': it.sw || 2,
          'marker-end': `url(#${mid})`, opacity: it.opacity
        });
        break;
      }
      default: n = mk('rect', baseAttrs(it));
    }
    if (it.glow) {
      const col = it.glow === true ? (it.stroke || it.fill || '#22d3ee') : it.glow;
      const f = 'glow-' + svgId + '-' + (++uid);
      const filt = mk('filter', { id: f, x: '-60%', y: '-60%', width: '220%', height: '220%' });
      filt.appendChild(mk('feDropShadow', { dx: 0, dy: 0, stdDeviation: 4, 'flood-color': col, 'flood-opacity': .85 }));
      defsHost.appendChild(filt);
      n.setAttribute('filter', `url(#${f})`);
    }
    if (it.pulse) {
      const anim = mk('animate', {
        attributeName: 'opacity', values: `${it.opacity ?? 1};${(it.opacity ?? 1) * .35};${it.opacity ?? 1}`,
        dur: '1.6s', repeatCount: 'indefinite'
      });
      n.appendChild(anim);
    }
    return n;
  }

  /* apply static geometry (used for initial paint + motion targets) */
  function place(n, it) {
    const t = [];
    if (it.rotate) {
      const cx = (it.x || 0) + (it.w || 0) / 2, cy = (it.y || 0) + (it.h || 0) / 2;
      t.push(`rotate(${it.rotate} ${it.cx || cx} ${it.cy || cy})`);
    }
    if (it.scale != null && it.scale !== 1) {
      const ox = it.x != null ? it.x : (it.cx || 0);
      const oy = it.y != null ? it.y : (it.cy || 0);
      t.push(`translate(${ox} ${oy}) scale(${it.scale}) translate(${-ox} ${-oy})`);
    }
    n.style.transformOrigin = 'center';
    if (t.length) n.style.transform = t.join(' ');
  }

  function runMotion(node, m, it) {
    /* animate position/size props via attributes; transform props via WAAPI */
    const to = {};
    const p = m.props || {};
    if (p.x != null) to.x = p.x;
    if (p.y != null) to.y = p.y;
    if (p.w != null) to.width = p.w;
    if (p.h != null) to.height = p.h;
    if (p.r != null) to.r = p.r;
    if (p.opacity != null) to.opacity = p.opacity;
    const dur = m.dur || 900;
    const easing = m.ease === 'bounce' ? EASE_POP : EASE;
    const start = () => {
      if (Object.keys(to).length && node.animate) {
        const frames = [{}];
        const end = {};
        for (const k in to) {
          const cur = parseFloat(node.getAttribute(k)) || 0;
          frames[0][k] = cur; end[k] = to[k];
        }
        try { node.animate([frames[0], end], { duration: dur, easing, fill: 'forwards' }); }
        catch (e) { /* attribute fallback below */ }
        setTimeout(() => { for (const k in to) node.setAttribute(k, to[k]); }, dur + 30);
      }
      if (p.scale != null || p.rotate != null) {
        const nextIt = Object.assign({}, it, p);
        const before = node.style.transform || 'none';
        place(node, nextIt);
        if (node.animate) {
          try { node.animate([{ transform: before }, { transform: node.style.transform }],
            { duration: dur, easing, fill: 'forwards' }); } catch (e) {}
        }
      }
    };
    if (m.at != null) setTimeout(start, m.at); else start();
  }

  function mountScene(el, spec) {
    if (!spec || !spec.items) return null;
    const svgId = 'sc' + (++uid);
    el.innerHTML = '';
    const svg = mk('svg', {
      viewBox: spec.viewBox || '0 0 640 260',
      class: 'mt-svg', preserveAspectRatio: 'xMidYMid meet'
    });
    const defs = mk('defs', {});
    (spec.defs || []).forEach(d => {
      const g = mk(d.kind === 'radial' ? 'radialGradient' : 'linearGradient', { id: d.id });
      (d.stops || []).forEach(s =>
        g.appendChild(mk('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] != null ? s[2] : 1 })));
      defs.appendChild(g);
    });
    /* faint 3b1b grid backdrop */
    const pat = mk('pattern', { id: 'mt-grid-' + svgId, width: 28, height: 28, patternUnits: 'userSpaceOnUse' });
    pat.appendChild(mk('path', { d: 'M 28 0 L 0 0 0 28', fill: 'none', stroke: 'rgba(148,163,184,.08)', 'stroke-width': 1 }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    svg.appendChild(mk('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: `url(#mt-grid-${svgId})` }));

    const nodes = {};
    spec.items.forEach(it => {
      const n = makeItem(it, defs, svgId);
      n.setAttribute('data-mt', it.id || ('i' + (++uid)));
      place(n, it);
      svg.appendChild(n);
      nodes[it.id] = n;

      /* entry choreography */
      const delay = it.delay || 0;
      if (it.enter === 'draw' && (it.kind === 'path' || it.kind === 'arc' || it.kind === 'arrow')) {
        try {
          const len = n.getTotalLength ? n.getTotalLength() : 0;
          if (len) {
            n.style.strokeDasharray = len;
            n.style.strokeDashoffset = len;
            n.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
              { duration: it.dur || 900, delay, easing: EASE, fill: 'forwards' });
          }
        } catch (e) {}
      } else if (it.enter === 'pop') {
        n.style.opacity = 0;
        if (n.animate) n.animate(
          [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 420, delay, easing: EASE_POP, fill: 'both' });
        else n.style.opacity = it.opacity != null ? it.opacity : 1;
      } else if (it.enter === 'fade') {
        n.style.opacity = 0;
        if (n.animate) n.animate([{ opacity: 0 }, { opacity: it.opacity != null ? it.opacity : 1 }],
          { duration: 600, delay, easing: EASE, fill: 'forwards' });
        else n.style.opacity = it.opacity != null ? it.opacity : 1;
      }

      /* scheduled motions */
      (Array.isArray(it.motion) ? it.motion : it.motion ? [it.motion] : [])
        .forEach(m => runMotion(n, m, it));

      /* travelling dot along a path (flow packets) */
      if (it.travel) {
        const tr = it.travel;
        const dot = mk('circle', { r: tr.r || 5, fill: tr.color || '#22d3ee' });
        const flt = mk('filter', { id: 'tg' + svgId + (++uid), x: '-80%', y: '-80%', width: '260%', height: '260%' });
        flt.appendChild(mk('feDropShadow', { dx: 0, dy: 0, stdDeviation: 3.2, 'flood-color': tr.color || '#22d3ee', 'flood-opacity': .9 }));
        defs.appendChild(flt);
        dot.setAttribute('filter', `url(#${flt.id})`);
        svg.appendChild(dot);
        const ghost = mk('path', { d: tr.d, fill: 'none', stroke: 'none' });
        svg.appendChild(ghost);
        const go = () => {
          try {
            const len = ghost.getTotalLength();
            const frames = [];
            for (let i = 0; i <= 30; i++) {
              const pt = ghost.getPointAtLength(len * i / 30);
              frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)` });
            }
            dot.animate(frames, { duration: tr.dur || 1400, easing: EASE, iterations: tr.loop ? Infinity : 1 });
          } catch (e) {}
        };
        setTimeout(go, tr.at || 0);
      }
    });

    el.appendChild(svg);
    return {
      svg,
      node: (id) => nodes[id],
      setMotion: (id, m) => { const it = spec.items.find(i => i.id === id); if (nodes[id] && it) runMotion(nodes[id], m, it); }
    };
  }

  return { mountScene };
})();

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
      u.onend = () => { endedAt = Date.now(); if (curUtter === u) curUtter = null; };
      u.onerror = () => { endedAt = Date.now(); if (curUtter === u) curUtter = null; };
      curUtter = u;
      window.speechSynthesis.speak(u);
    } catch (e) { curUtter = null; /* non-fatal */ }
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
      const cap = Math.min(estimateMs(curUtter.text, rate) + 2500, 12000);
      if (Date.now() - startedAt > cap) return false;
      return true;
    } catch (e) { return false; }
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

  /* ── ANIM SCENE — 3blue1brown-style: elements PERSIST and GLIDE.
     renderScene() below rebuilds the DOM on every step, which made each
     transition a hard cut. animateScene() diffs against the previous
     paint (stored on the stage element) and only touches what changed:
     · cells keep their identity → value/border/height tween in CSS
     · pointers are reused      → they slide from old cell to new cell
     Falls through to renderScene on full re-layouts (length change). */
  function animateScene(stage, state) {
    const prev = stage._vzState;
    const arr = state.arr || [];
    const nums = arr.filter(x => typeof x === 'number');
    const lo = Math.min.apply(null, nums.length ? nums : [0]);
    const hi = Math.max.apply(null, nums.length ? nums : [1]);

    if (!prev || !prev.mainRow || !stage.contains(prev.mainRow) ||
        prev.arr.length !== arr.length) {
      /* structural change (or first paint): build once, then remember it */
      renderScene(stage, state);
      const row = stage.querySelector('.vz-row');
      stage._vzState = {
        arr: arr.slice(), row2Arr: state.row2 ? (state.row2.arr || []).slice() : null,
        mainRow: row,
        ptrLayer: stage.querySelector('.vz-ptrs'),
        auxEl: stage.querySelector('.vz-aux')
      };
      return;
    }

    /* values + marks: mutate in place so CSS transitions carry the change.
       THE 3B1B FIX: cell fill is a child element (.vz-fill) whose height is
       a real px value — animating `height` actually tweens. (The old version
       animated the custom property --h, which CSS cannot interpolate without
       @property support, so every "animation" was an instant snap.) */
    const cells = prev.mainRow.querySelectorAll('.vz-cell');
    arr.forEach((v, i) => {
      const cell = cells[i];
      if (!cell) return;
      const valEl = cell.querySelector('.vz-val');
      /* POLISH #3: the number itself morphs (scale-flip) when it changes —
         Manim's Transform(value) gesture instead of a silent text swap */
      if (valEl && String(valEl.textContent) !== String(v)) {
        valEl.textContent = v;
        try {
          valEl.animate([{ transform: 'scale(.4)', opacity: .25 },
                         { transform: 'scale(1.18)', opacity: 1, offset: .7 },
                         { transform: 'scale(1)', opacity: 1 }],
            { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        } catch (e) {}
      }
      const mk = state.marks?.[i] || state.marks?.[String(i)] || '';
      const want = 'vz-cell' + (mk ? ' ' + mk : '');
      if (cell.className !== want) {
        /* POLISH #4: a mark turning ON pops the cell border/glow in with a
           quick scale bounce instead of appearing instantly */
        const wasDimmed = cell.classList.contains('vz-dim');
        cell.className = want;
        if (!wasDimmed && mk) {
          try {
            cell.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }],
              { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          } catch (e) {}
        }
      }
      let frac = 0.6;
      if (typeof v === 'number') frac = hi > lo ? (v - lo) / (hi - lo) : 0.6;
      const hpx = Math.round(28 + frac * 54);
      const fill = cell.querySelector('.vz-fill');
      if (fill && fill.style.height !== hpx + 'px') fill.style.height = hpx + 'px';
      if (cell.style.getPropertyValue('--h') !== (Math.round(frac * 100)) + '%') {
        cell.style.setProperty('--h', (Math.round(frac * 100)) + '%');
      }
    });

    /* pointers: reuse the layer — positionPointers slides existing tags */
    if (prev.ptrLayer) positionPointers(prev.ptrLayer, prev.mainRow, state.ptrs || {}, arr.length);

    /* aux chips: rebuild only when the numbers actually changed.
       POLISH #5: if the row already exists, update values IN PLACE and pop
       any chip whose value changed — the old full-rebuild made the whole
       chip row blink out-and-back on every single step. */
    const auxKey = JSON.stringify(state.aux || []);
    if (auxKey !== (stage._vzAuxKey || '')) {
      stage._vzAuxKey = auxKey;
      const existing = stage.querySelector('.vz-aux');
      if (existing && state.aux && state.aux.length === existing.children.length) {
        state.aux.forEach((a, i) => {
          const chip = existing.children[i];
          const bEl = chip.querySelector('b');
          const wantTxt = `<b>${esc(a.label)}</b> ${esc(a.value)}`;
          if (chip.innerHTML !== wantTxt) {
            const oldVal = chip.textContent.replace(bEl ? bEl.textContent : '', '').trim();
            chip.innerHTML = wantTxt;
            if (oldVal !== String(a.value).trim()) {
              try {
                chip.animate([{ transform: 'scale(.82)', opacity: .4 },
                              { transform: 'scale(1.07)', offset: .65 },
                              { transform: 'scale(1)', opacity: 1 }],
                  { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
              } catch (e) {}
            }
          }
        });
      } else {
        if (existing) existing.remove();
        if (state.aux && state.aux.length) {
          const aux = document.createElement('div');
          aux.className = 'vz-aux';
          state.aux.forEach(a => {
            const chip = document.createElement('span');
            chip.className = 'vz-aux-chip';
            chip.innerHTML = `<b>${esc(a.label)}</b> ${esc(a.value)}`;
            aux.appendChild(chip);
          });
          const r2w = stage.querySelector('.vz-row2-wrap');
          if (r2w) stage.insertBefore(aux, r2w); else stage.appendChild(aux);
        }
      }
    }

    /* second row (prefix/output): cheap diff — same length mutates, else rebuild */
    const wantLen = state.row2 ? (state.row2.arr || []).length : 0;
    const hadLen = prev.row2Arr ? prev.row2Arr.length : -1;
    if (wantLen !== hadLen) {
      const oldWrap = stage.querySelector('.vz-row2-wrap');
      if (oldWrap) oldWrap.remove();
      stage.querySelectorAll(':scope > .vz-ptrs').forEach(p => { if (p !== prev.ptrLayer) p.remove(); });
      if (state.row2) {
        const r2wrap = document.createElement('div');
        r2wrap.className = 'vz-row2-wrap';
        const lbl = document.createElement('div');
        lbl.className = 'vz-row2-label';
        lbl.textContent = state.row2.label || '';
        r2wrap.appendChild(lbl);
        const row = document.createElement('div');
        row.className = 'vz-row small';
        (state.row2.arr || []).forEach((v, i) => {
          const cell = document.createElement('div');
          const mk = state.row2.marks?.[i] || state.row2.marks?.[String(i)] || '';
          cell.className = 'vz-cell ' + (mk || '');
          cell.dataset.i = i;
          cell.style.setProperty('--h', '36%');
          cell.innerHTML = `<span class="vz-fill" style="height:14px"></span>` +
                           `<span class="vz-val">${esc(v)}</span>`;
          row.appendChild(cell);
        });
        r2wrap.appendChild(row);
        stage.appendChild(r2wrap);
        if (state.row2.ptrs && Object.keys(state.row2.ptrs).length) {
          const p2 = document.createElement('div');
          p2.className = 'vz-ptrs';
          stage.appendChild(p2);
          positionPointers(p2, row, state.row2.ptrs, (state.row2.arr || []).length);
        }
      }
    } else if (state.row2) {
      const wrap = stage.querySelector('.vz-row2-wrap');
      if (wrap) {
        const r2cells = wrap.querySelectorAll('.vz-cell');
        (state.row2.arr || []).forEach((v, i) => {
          const cell = r2cells[i];
          if (!cell) return;
          const valEl = cell.querySelector('.vz-val');
          if (valEl && String(valEl.textContent) !== String(v)) {
            valEl.textContent = v;
            try {
              valEl.animate([{ transform: 'scale(.4)', opacity: .25 },
                             { transform: 'scale(1.18)', opacity: 1, offset: .7 },
                             { transform: 'scale(1)', opacity: 1 }],
                { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
            } catch (e) {}
          }
          const mk = state.row2.marks?.[i] || state.row2.marks?.[String(i)] || '';
          const want = 'vz-cell ' + (mk || '');
          if (cell.className !== want) {
            cell.className = want;
            if (mk) {
              try {
                cell.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }],
                  { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
              } catch (e) {}
            }
          }
        });
        const p2 = stage.querySelector('.vz-row2-wrap + .vz-ptrs') ||
                   [...stage.children].filter(c => c.classList.contains('vz-ptrs')).pop();
        if (state.row2.ptrs && Object.keys(state.row2.ptrs).length) {
          let layer = null;
          stage.querySelectorAll('.vz-ptrs').forEach(l => { if (l !== prev.ptrLayer) layer = l; });
          if (!layer) {
            layer = document.createElement('div');
            layer.className = 'vz-ptrs';
            stage.appendChild(layer);
          }
          positionPointers(layer, wrap.querySelector('.vz-row.small') || wrap, state.row2.ptrs, wantLen);
        }
      }
    }

    stage._vzState = {
      ...stage._vzState,
      arr: arr.slice(), row2Arr: state.row2 ? (state.row2.arr || []).slice() : null
    };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── GLIDE — reuse the existing scene when the shape is unchanged so
     cells tween their heights and pointers slide instead of hard-cutting.
     Falls back to a full rebuild on structural changes. Shared by the
     player AND the mini stages (idea phase, problem phase). ── */
  function glideScene(stage, state) {
    if (!state) return false;
    const arr = state.arr || [];
    const prev = stage._vzState;
    const sameShape = prev && prev.mainRow && stage.contains(prev.mainRow) &&
      prev.arr.length === arr.length &&
      JSON.stringify(prev.row2Arr || []) === JSON.stringify((state.row2 && state.row2.arr) || prev.row2Arr || []);
    if (sameShape) {
      animateScene(stage, state);
      return true; /* tweened — callers must wait for it to land */
    }
    stage.classList.remove('vz-cut');
    void stage.offsetWidth; /* restart the keyframe */
    renderScene(stage, state);
    stage._vzState = {
      arr: arr.slice(),
      row2Arr: state.row2 ? (state.row2.arr || []).slice() : null,
      mainRow: stage.querySelector('.vz-row'),
      ptrLayer: stage.querySelector('.vz-ptrs')
    };
    stage.classList.add('vz-cut');
    return false;
  }

  /* ── SCENE RENDER (shared by watch / drive modes) ── */
  function renderScene(stage, state) {
    if (!state) return;
    stage.innerHTML = '';

    /* main array row */
    const main = document.createElement('div');
    main.className = 'vz-row';
    stage.appendChild(main);

    const arr = state.arr || [];
    const nums = arr.filter(x => typeof x === 'number');
    const lo = Math.min.apply(null, nums.length ? nums : [0]);
    const hi = Math.max.apply(null, nums.length ? nums : [1]);

    /* POLISH A: long rows shrink their cells to fit the stage instead of
       overflowing into a scrollbar — positions stay measurable for arcs and
       the whole array is visible at once (Manim frames every object). */
    const availW = (stage.clientWidth || 640) - 8;
    const wide = Math.max(30, Math.min(46, Math.floor(availW / Math.max(1, arr.length)) - 6));
    arr.forEach((v, i) => {
      const cell = document.createElement('div');
      const mk = state.marks?.[i] || state.marks?.[String(i)] || '';
      cell.className = 'vz-cell' + (mk ? ' ' + mk : '');
      if (wide < 46) cell.style.width = wide + 'px';
      cell.dataset.i = i;
      let frac = 0.6;
      if (typeof v === 'number') frac = hi > lo ? (v - lo) / (hi - lo) : 0.6;
      else frac = 0.5;
      cell.style.setProperty('--h', Math.round(frac * 100) + '%');
      /* .vz-fill: a real px height that CSS can tween — the animated bar
         behind the value (3b1b-style growth/morph of the bars) */
      cell.innerHTML = `<span class="vz-fill" style="height:${Math.round(28 + frac * 54)}px"></span>` +
                       `<span class="vz-val">${esc(v)}</span>`;
      main.appendChild(cell);
    });

    /* pointer layer under main row */
    const ptrLayer = document.createElement('div');
    ptrLayer.className = 'vz-ptrs';
    stage.appendChild(ptrLayer);
    positionPointers(ptrLayer, main, state.ptrs || {}, arr.length);

    /* aux chips (sum, target, best…) */
    if (state.aux && state.aux.length) {
      const aux = document.createElement('div');
      aux.className = 'vz-aux';
      state.aux.forEach(a => {
        const chip = document.createElement('span');
        chip.className = 'vz-aux-chip';
        chip.innerHTML = `<b>${esc(a.label)}</b> ${esc(a.value)}`;
        aux.appendChild(chip);
      });
      stage.appendChild(aux);
    }

    /* second row (prefix arrays / output rows) */
    if (state.row2) {
      const r2wrap = document.createElement('div');
      r2wrap.className = 'vz-row2-wrap';
      const lbl = document.createElement('div');
      lbl.className = 'vz-row2-label';
      lbl.textContent = state.row2.label || '';
      r2wrap.appendChild(lbl);

      const row = document.createElement('div');
      row.className = 'vz-row small';
      (state.row2.arr || []).forEach((v, i) => {
        const cell = document.createElement('div');
        const mk = state.row2.marks?.[i] || state.row2.marks?.[String(i)] || '';
        cell.className = 'vz-cell ' + (mk || '');
        cell.dataset.i = i;
        if (typeof v === 'number') {
          const frac = hi > lo ? (v - lo) / (hi - lo) : 0.5;
          cell.style.setProperty('--h', (24 + Math.round(frac * 40)) + '%');
        } else { cell.style.setProperty('--h', '36%'); }
        cell.innerHTML = `<span class="vz-val">${esc(v)}</span>`;
        row.appendChild(cell);
      });
      r2wrap.appendChild(row);
      stage.appendChild(r2wrap);

      if (state.row2.ptrs && Object.keys(state.row2.ptrs).length) {
        const p2 = document.createElement('div');
        p2.className = 'vz-ptrs';
        stage.appendChild(p2);
        positionPointers(p2, row, state.row2.ptrs, (state.row2.arr || []).length);
      }
    }
  }

  function positionPointers(layer, row, ptrs, n) {
    Object.keys(ptrs).forEach(id => {
      const i = ptrs[id];
      let el = layer.querySelector(`[data-ptr="${id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'vz-ptr';
        el.dataset.ptr = id;
        el.innerHTML = `<span class="vz-ptr-tag">${esc(id)}</span><span class="vz-ptr-arrow">▲</span>`;
        layer.appendChild(el);
      }
      const cells = row.querySelectorAll('.vz-cell');
      const cell = cells[Math.max(0, Math.min(i, cells.length - 1))];
      if (cell) {
        /* rect-based positioning: correct no matter which ancestor is the
           offsetParent (the idea-phase mini stage is not position:relative
           the way the player stage is, so offsetLeft measured from the
           wrong origin and every pointer shifted right) */
        const lr = layer.getBoundingClientRect();
        const cr = cell.getBoundingClientRect();
        if (i > cells.length - 1) {
          /* pointer past the last cell (e.g. 'r+1' at the exclusive right
             edge): hover it just beyond the row instead of clamping it onto
             the last cell, which is a different index */
          el.style.left = (cr.right - lr.left + 4) + 'px';
        } else {
          el.style.left = (cr.left - lr.left + cr.width / 2) + 'px';
        }
      }
      const col = PTR_COLORS[id] || 'var(--player)';
      el.style.color = col;              /* arrow + fallbacks */
      el.style.setProperty('--ptr-col', col); /* name chip background */
    });
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
           speaking/pending flags extend it when real speech runs longer */
        holdMs = Math.min(CF.Narrator.estimateMs(text, prefs.speed || 1), 20000);
      }
      const t0 = Date.now();
      let settled = false;
      const tick = () => {
        if (destroyed || settled) return;
        const el = Date.now() - t0;
        if (el < holdMs || voiceBusy()) { timer = setTimeout(tick, 200); return; }
        settled = true;
        fn();
      };
      clearTimer();
      tick();
    }

    function renderStep() {
      const s = steps[idx];
      if (!s) return;
      /* 3b1b-style motion: the scene GLIDES when only values/marks/pointers
         changed; a structural jump (step-back, loop edge, re-init) hard-cuts
         with a quick fade instead of freezing mid-animation. */
      const glided = glideScene(stage, s.state || { arr: [] });
      stage.querySelectorAll('.vz-fx-svg').forEach(n => n.remove());
      sceneFx(s, glided); /* manim-style focus/rings/arcs, layered on the fresh scene */
      container.querySelector('.vz-progress').textContent = `${idx + 1} / ${steps.length}`;
      codeEl.querySelectorAll('.vz-code-line').forEach(l =>
        l.classList.toggle('active', Number(l.dataset.line) === (s.line ?? -1)));
      cap.textContent = s.caption || '';
      cap.className = 'vz-caption' + (prefs.captions && s.narration ? ' full' : '');
      if (prefs.captions && s.narration) cap.textContent = s.narration;
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
      /* MANIM-STYLE CHOREOGRAPHY per step (data-driven, opt-in via s.sceneFx):
         · dim   — every cell not part of this move fades back (focus shift)
         · ring  — glow rings pulse on the named cells (Transform highlighting)
         · arc   — a curved arrow draws itself between two cells (swap/move)
         · glide — travelling packet rides the arc (the "hand" carrying values)
                   …or an animated value TOKEN flies cell→cell when token set
         · pulse — a soft expanding halo under one cell (window/center growth)
         Without sceneFx the old behaviour is untouched: marks only. */
      function sceneFx(s, glided) {
        const fx = s.sceneFx;
        const cells = Array.from(stage.querySelectorAll('.vz-cell'));
        cells.forEach(c => { c.classList.remove('vz-dim', 'vz-ring'); });
        stage.querySelectorAll('.vz-fx-svg').forEach(n => n.remove());
        if (!fx) return;
        const mainRow = stage.querySelector('.vz-row');
        if (!mainRow) return;
        /* POLISH #1: never measure mid-glide. Cells and pointers are still
           CSS-transitioning to their new spots for ~450 ms after a glide —
           arcs drawn now start/end at stale coordinates and visibly detach
           from the cells they point at. Wait until the tween lands. */
        const DELAY = glided ? 480 : 60;
        if (fx.dim) {
          const keep = new Set([].concat(fx.cells || [], fx.from != null ? [fx.from] : [], fx.to != null ? [fx.to] : []));
          cells.forEach(c => { if (!keep.has(Number(c.dataset.i))) c.classList.add('vz-dim'); });
        }
        if (fx.cells) {
          fx.cells.forEach(i => {
            const c = cells.filter(x => Number(x.dataset.i) === i)[0];
            if (c) c.classList.add('vz-ring');
          });
        }
        const wantArc = fx.arc && fx.from != null && fx.to != null;
        const wantToken = fx.token && fx.from != null && fx.to != null;
        if (!wantArc && !wantToken && !fx.pulse) return;
        setTimeout(() => {
          if (destroyed) return;
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'vz-fx-svg');
          svg.style.left = '0'; svg.style.top = '0';
          svg.width = stage.clientWidth || 640; svg.height = stage.clientHeight || 220;
          const rs = stage.getBoundingClientRect();
          const liveCells = Array.from(stage.querySelectorAll('.vz-row > .vz-cell'));
          const centerOf = (i, bottom) => {
            const c = liveCells.filter(x => Number(x.dataset.i) === i)[0];
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { x: r.left - rs.left + r.width / 2, y: (bottom ? r.bottom : r.top) - rs.top };
          };
          let path = null, len = 0, p1 = null, p2 = null;
          if (wantArc || wantToken) {
            p1 = centerOf(fx.from); p2 = centerOf(fx.to);
            if (p1 && p2) {
              const col = fx.color || '#fbbf24';
              const mx = (p1.x + p2.x) / 2, lift = Math.max(34, Math.min(90, Math.abs(p2.x - p1.x) * .38));
              const d = `M ${p1.x} ${p1.y} Q ${mx} ${Math.min(p1.y, p2.y) - lift} ${p2.x} ${p2.y}`;
              const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
              const mid = 'fxm' + (++fxUid);
              const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
              marker.setAttribute('id', mid); marker.setAttribute('viewBox', '0 0 10 10');
              marker.setAttribute('refX', 8); marker.setAttribute('refY', 5);
              marker.setAttribute('markerWidth', 7); marker.setAttribute('markerHeight', 7);
              marker.setAttribute('orient', 'auto-start-reverse');
              const mp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              mp.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); mp.setAttribute('fill', col);
              marker.appendChild(mp); defs.appendChild(marker); svg.appendChild(defs);
              path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              path.setAttribute('d', d); path.setAttribute('fill', 'none');
              if (wantArc) {
                path.setAttribute('stroke', col); path.setAttribute('stroke-width', 2.5);
                path.setAttribute('opacity', .9); path.setAttribute('marker-end', `url(#${mid})`);
              } else {
                path.setAttribute('stroke', col); path.setAttribute('stroke-width', 1.5);
                path.setAttribute('opacity', .45); path.setAttribute('stroke-dasharray', '3 5');
              }
              svg.appendChild(path);
              try {
                len = path.getTotalLength();
                path.style.strokeDasharray = wantArc ? len : '3 5';
                path.style.strokeDashoffset = wantArc ? len : 0;
                if (wantArc) {
                  path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
                    { duration: 700, delay: 0, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
                }
              } catch (e) {}
            }
          }
          /* value TOKEN: a labelled chip that physically carries the number
             from cell to cell along the arc — Manim's Transform(Mobject) look */
          if (wantToken && path && len) {
            const v = (s.state && Array.isArray(s.state.arr)) ? s.state.arr[fx.from] : '';
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', -13); rect.setAttribute('y', -12);
            rect.setAttribute('width', 26); rect.setAttribute('height', 24);
            rect.setAttribute('rx', 7);
            rect.setAttribute('fill', fx.color || '#fbbf24');
            rect.setAttribute('opacity', '.95');
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dy', 5);
            txt.setAttribute('font-size', '13'); txt.setAttribute('font-weight', '800');
            txt.setAttribute('font-family', 'ui-monospace, Menlo, monospace');
            txt.setAttribute('fill', '#0a0e1a');
            txt.textContent = String(v == null ? '' : v).slice(0, 3);
            g.appendChild(rect); g.appendChild(txt);
            g.style.transform = `translate(${p1.x}px, ${p1.y}px)`;
            svg.appendChild(g);
            const frames = [];
            for (let k = 0; k <= 36; k++) {
              const pt = path.getPointAtLength(len * k / 36);
              frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)` });
            }
            try {
              g.animate(frames, { duration: 1000, delay: 250, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
              rect.animate([{ opacity: .95 }, { opacity: .95 }, { opacity: 0 }],
                { duration: 1250, delay: 250, easing: 'ease-in', fill: 'forwards' });
              txt.animate([{ opacity: .95 }, { opacity: .95 }, { opacity: 0 }],
                { duration: 1250, delay: 250, easing: 'ease-in', fill: 'forwards' });
            } catch (e) {}
          } else if (fx.glide && path && len) {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', 5.5); dot.setAttribute('cx', 0); dot.setAttribute('cy', 0);
            dot.setAttribute('fill', fx.color || '#fbbf24');
            dot.style.transform = `translate(${p1.x}px, ${p1.y}px)`;
            svg.appendChild(dot);
            const frames = [];
            for (let k = 0; k <= 36; k++) {
              const pt = path.getPointAtLength(len * k / 36);
              frames.push({ transform: `translate(${pt.x}px, ${pt.y}px)` });
            }
            try {
              dot.animate(frames, { duration: 1000, delay: 250, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
            } catch (e) {}
          }
          /* pulse: expanding halo under a cell — window growth, palindrome centers */
          if (fx.pulse != null) {
            const pc = centerOf(fx.pulse, true);
            if (pc) {
              const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              halo.setAttribute('cx', pc.x); halo.setAttribute('cy', pc.y - 23);
              halo.setAttribute('r', 16); halo.setAttribute('fill', 'none');
              halo.setAttribute('stroke', fx.color || '#22d3ee');
              halo.setAttribute('stroke-width', 2);
              svg.appendChild(halo);
              try {
                halo.animate([{ r: 14, opacity: .8 }, { r: 46, opacity: 0 }],
                  { duration: 1100, delay: 100, easing: 'cubic-bezier(.2,.6,.3,1)', iterations: 2 });
              } catch (e) {
                halo.animate([{ transform: 'scale(1)', opacity: .8 }, { transform: 'scale(3)', opacity: 0 }],
                  { duration: 1100, delay: 100, easing: 'cubic-bezier(.2,.6,.3,1)', iterations: 2 });
              }
            }
          }
          stage.appendChild(svg);
          /* POLISH #2: arcs are momentary annotations — fade them out so the
             next step never inherits ghost arrows from the previous one */
          setTimeout(() => {
            try {
              svg.animate([{ opacity: 1 }, { opacity: 0 }],
                { duration: 450, delay: 2400, easing: 'ease-out', fill: 'forwards' });
              setTimeout(() => { if (svg.parentNode) svg.remove(); }, 3100);
            } catch (e) { try { svg.remove(); } catch (e2) {} }
          }, 0);
        }, DELAY);
      }
      let fxUid = 0;

      CF.Narrator.setRate(prefs.speed || 1);
      CF.Narrator.speak(s.narration || s.caption || '');
      /* VOICE-LOCKED CHECKPOINTS: the lesson shell (Watch/Brute phases) used
         to mount its 🤔 question card on a fixed wall-clock estimate of this
         sentence. Estimates run long or short → the card either cut in over
         the narrator's last words, or appeared seconds after the voice ended
         — silently, below the fold. Now the player owns the clock: lessons
         poll narrationIdle(), which is true only once the CURRENT step's
         intro has genuinely been spoken (or, if muted, had reading time). */
      narrationStartedAt = Date.now();
      narrationMs = prefs.narration
        ? Math.min(CF.Narrator.estimateMs(s.narration || s.caption || '', prefs.speed || 1), 20000)
        : Math.min(stepWaitMs(), 2500);
      if (onProgress) onProgress(idx, steps.length);
    }

    let narrationStartedAt = 0;
    let narrationMs = 0;
    function narrationIdle() {
      if (destroyed) return true;
      const el = Date.now() - narrationStartedAt;
      if (!prefs.narration) return el >= narrationMs;
      /* hard floor: never let a lying engine release the card while the
         intro sentence could still be mid-word */
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
        ? Math.min(CF.Narrator.estimateMs(text, prefs.speed || 1), 20000)
        : stepWaitMs();
      const t0 = Date.now();
      let settled = false;
      const tick = () => {
        if (destroyed || !playing || settled) return;
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

  return { createPlayer, renderScene, animateScene, glideScene };
})();
