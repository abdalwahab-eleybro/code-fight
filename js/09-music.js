/* ═══════════════════════════════════════════════════════════ */
/*  09-music.js — Procedural chiptune engine                   */
/*  No external files. Web Audio API only.                     */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Music = (() => {
  const S = CF.State;

  let actx = null;
  let masterGain = null;
  let currentTrack = null;       // 'menu' | 'combat' | 'boss' | 'blitz' | null
  let schedulerID = null;
  let nextNoteTime = 0;
  let stepIndex = 0;

  /* ═══════════════════════════════════════════════════════ */
  /*  AUDIO CONTEXT                                           */
  /* ═══════════════════════════════════════════════════════ */
  function init() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = actx.createGain();
      masterGain.gain.value = (S.profile.settings.musicVolume ?? 0.4);
      masterGain.connect(actx.destination);
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  function updateVolume() {
    if (masterGain) {
      masterGain.gain.value = (S.profile.settings.musicVolume ?? 0.4);
    }
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  TRACKS                                                  */
  /* ═══════════════════════════════════════════════════════ */
  // Each track is a 16-step loop (16th notes).
  // Pattern format: [note, durationInSteps] or null for rest.
  // Notes: 'C3', 'D3', etc. — will be converted to frequency.

  const TRACKS = {
    menu: {
      bpm: 88,
      steps: 16,
      // Slow arpeggio — mysterious, welcoming
      lead: [
        ['D4',1], ['A4',1], ['F4',1], ['D4',1],
        ['F4',1], ['A4',1], ['C5',1], ['A4',1],
        ['Bb4',1], ['F4',1], ['D4',1], ['F4',1],
        ['A4',1], ['F4',1], ['D4',1], null
      ],
      bass: [
        ['D2',4], ['D2',4], ['Bb1',4], ['A1',4]
      ],
      waveLead: 'triangle',
      waveBass: 'sine'
    },
    combat: {
      bpm: 120,
      steps: 16,
      // Driving bass + aggressive lead
      lead: [
        ['D4',1], null, ['F4',1], ['A4',1],
        ['G4',1], null, ['F4',1], null,
        ['D4',1], null, ['F4',1], ['G4',1],
        ['A4',1], ['G4',1], ['F4',1], null
      ],
      bass: [
        ['D2',2], ['D2',2], ['A2',2], ['A2',2],
        ['Bb2',2], ['Bb2',2], ['C3',2], ['C3',2]
      ],
      drums: ['K','H','S','H','K','H','S','H','K','H','S','H','K','H','S','H'],
      waveLead: 'square',
      waveBass: 'sawtooth'
    },
    boss: {
      bpm: 140,
      steps: 16,
      // Darker, phrygian feel
      lead: [
        ['D4',1], ['Eb4',1], ['D4',1], ['A3',1],
        ['Bb3',1], ['A3',1], ['G3',1], ['F3',1],
        ['D4',1], ['Eb4',1], ['F4',1], ['G4',1],
        ['A4',1], ['G4',1], ['F4',1], ['Eb4',1]
      ],
      bass: [
        ['D2',1], ['D2',1], ['D2',1], ['D2',1],
        ['Bb1',1], ['Bb1',1], ['Bb1',1], ['Bb1',1],
        ['G1',1], ['G1',1], ['G1',1], ['G1',1],
        ['A1',1], ['A1',1], ['A1',1], ['A1',1]
      ],
      drums: ['K','H','S','H','K','K','S','H','K','H','S','H','K','K','S','H'],
      waveLead: 'sawtooth',
      waveBass: 'square'
    },
    blitz: {
      bpm: 160,
      steps: 16,
      // Fast, tense
      lead: [
        ['A4',1], ['C5',1], ['E5',1], ['C5',1],
        ['A4',1], ['E4',1], ['A4',1], ['C5',1],
        ['G4',1], ['B4',1], ['D5',1], ['B4',1],
        ['G4',1], ['D4',1], ['G4',1], ['B4',1]
      ],
      bass: [
        ['A2',1], ['A2',1], ['E2',1], ['E2',1],
        ['F2',1], ['F2',1], ['G2',1], ['G2',1],
        ['A2',1], ['A2',1], ['E2',1], ['E2',1],
        ['F2',1], ['F2',1], ['G2',1], ['G2',1]
      ],
      drums: ['K','H','K','H','S','H','K','H','K','H','K','H','S','H','K','H'],
      waveLead: 'square',
      waveBass: 'sawtooth'
    }
  };

  /* ═══════════════════════════════════════════════════════ */
  /*  NOTE → FREQUENCY                                        */
  /* ═══════════════════════════════════════════════════════ */
  const NOTE_OFFSETS = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5,
                         'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };

  function noteToFreq(note) {
    if (!note) return 0;
    const match = note.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 0;
    const semitone = NOTE_OFFSETS[match[1]];
    const octave = parseInt(match[2], 10);
    // A4 = 440 Hz, MIDI note 69
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  SCHEDULER                                               */
  /* ═══════════════════════════════════════════════════════ */
  let stepDuration = 0;
  let activeTrack = null;
  let activeStep = 0;
  let leadSteps = [];       // flattened timeline of {note, step}
  let bassSteps = [];
  let totalSteps = 0;

  function flattenNotes(notes) {
    // Notes format: array of [note, duration] pairs — total duration = steps
    const out = [];
    let step = 0;
    notes.forEach(pair => {
      if (!pair) { step += 1; return; }
      const [note, dur] = pair;
      out.push({ note, step });
      step += dur || 1;
    });
    return out;
  }

  function flattenBass(notes) {
    // Bass format: array of [note, duration] pairs spanning the loop
    const out = [];
    let step = 0;
    notes.forEach(pair => {
      if (!pair) return;
      const [note, dur] = pair;
      out.push({ note, step });
      step += dur || 1;
    });
    return out;
  }

  function scheduler() {
    if (!actx || !activeTrack) return;
    const now = actx.currentTime;

    // Schedule ahead
    while (nextNoteTime < now + 0.15) {
      scheduleStep(activeStep, nextNoteTime);
      nextNoteTime += stepDuration;
      activeStep = (activeStep + 1) % totalSteps;
    }
  }

  function scheduleStep(step, time) {
    // Lead
    leadSteps.forEach(({ note, step: s }) => {
      if (s === step) {
        playNote(note, time, stepDuration * 2, activeTrack.waveLead, 0.09);
      }
    });

    // Bass
    bassSteps.forEach(({ note, step: s }) => {
      if (s === step) {
        playNote(note, time, stepDuration * 1.8, activeTrack.waveBass, 0.07);
      }
    });

    // Drums
    const drum = activeTrack.drums && activeTrack.drums[step];
    if (drum === 'K') playKick(time);
    else if (drum === 'S') playSnare(time);
    else if (drum === 'H') playHat(time);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  INSTRUMENTS                                             */
  /* ═══════════════════════════════════════════════════════ */
  function playNote(note, startTime, dur, wave, vol) {
    if (!note) return;
    const freq = noteToFreq(note);
    if (!freq) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(vol, startTime + 0.008);
    g.gain.setValueAtTime(vol, startTime + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    o.connect(g).connect(masterGain);
    o.start(startTime);
    o.stop(startTime + dur + 0.05);
  }

  function playKick(time) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(40, time + 0.14);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.16, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    o.connect(g).connect(masterGain);
    o.start(time); o.stop(time + 0.25);
  }

  function playSnare(time) {
    // Noise burst + tone
    const len = Math.floor(actx.sampleRate * 0.12);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1200;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.11, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    src.connect(f).connect(g).connect(masterGain);
    src.start(time);
  }

  function playHat(time) {
    const len = Math.floor(actx.sampleRate * 0.05);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.04, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(f).connect(g).connect(masterGain);
    src.start(time);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  PUBLIC API                                              */
  /* ═══════════════════════════════════════════════════════ */
  function play(trackName) {
    if (currentTrack === trackName) return;
    init();
    if (!actx) return;

    // iOS autoplay unlock
    if (actx.state === 'suspended') {
      actx.resume().catch(() => {});
    }

    stop();

    const track = TRACKS[trackName];
    if (!track) return;

    activeTrack = track;
    currentTrack = trackName;
    stepDuration = 60 / track.bpm / 4;   // 16th note duration

    leadSteps = flattenNotes(track.lead);
    bassSteps = flattenBass(track.bass);

    // totalSteps = longest
    totalSteps = track.steps || 16;

    activeStep = 0;
    nextNoteTime = actx.currentTime + 0.05;

    schedulerID = setInterval(scheduler, 25);
  }

  function stop() {
    if (schedulerID) {
      clearInterval(schedulerID);
      schedulerID = null;
    }
    currentTrack = null;
    activeTrack = null;
  }

  function setVolume(v) {
    S.profile.settings.musicVolume = Math.max(0, Math.min(1, v));
    updateVolume();
    S.save();
  }

  function isPlaying() { return currentTrack !== null; }

  return { play, stop, setVolume, updateVolume, isPlaying, init };
})();
