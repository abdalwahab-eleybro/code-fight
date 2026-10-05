/* ═══════════════════════════════════════════════════════════ */
/*  11-engine.js — Fight loop, combat visuals, sounds          */
/*  Depends on: 01, 02, 03, 04                                 */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Engine = (() => {
  const S = CF.State;
  const L = CF.CampaignLogic;
  const Q = CF.Questions;
  const R = CF.Renderers;
  const M = CF.Modes;
  const Music = CF.Music;

  /* ═══ SPEED TIERS (campaign: longer because code questions) ═══ */
  const TIERS = [
    { key: 'perfect', maxMs: 12000, label: '⚡ PERFECT!', color: '#fbbf24', dmgMult: 2.0, animMs: 1700 },
    { key: 'great',   maxMs: 22000, label: 'GREAT!',      color: '#fb923c', dmgMult: 1.5, animMs: 1100 },
    { key: 'good',    maxMs: 35000, label: 'GOOD',        color: '#22d3ee', dmgMult: 1.0, animMs: 700 },
    { key: 'slow',    maxMs: Infinity, label: 'SLOW…',    color: '#94a3b8', dmgMult: 0.7, animMs: 400 }
  ];
  function classify(ms) { return TIERS.find(t => ms < t.maxMs); }

  /* ═══ COMPACT SOUND ENGINE ═══ */
  let actx = null;
  function ac() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, sweepTo) {
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol, freq, q) {
    const c = ac();
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  function playTier(tier) {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    if (tier === 'perfect') {
      tone(160, 0.32, 'sine', 0.5 * vol, 45);
      tone(180, 0.5, 'sawtooth', 0.2 * vol, 40);
      tone(1750, 0.4, 'square', 0.06 * vol);
      tone(2340, 0.4, 'square', 0.05 * vol);
      noise(0.22, 0.22 * vol, 3200, 1.4);
    } else if (tier === 'great') {
      tone(160, 0.3, 'sine', 0.4 * vol, 45);
      tone(1400, 0.35, 'square', 0.05 * vol);
      noise(0.14, 0.15 * vol, 2400, 1.2);
    } else if (tier === 'good') {
      tone(160, 0.25, 'sine', 0.25 * vol, 45);
      noise(0.09, 0.1 * vol, 1600, 1.1);
    } else {
      tone(160, 0.2, 'sine', 0.14 * vol, 45);
    }
  }
  function playWrong() {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    tone(220, 0.18, 'sawtooth', 0.12 * vol, 110);
    tone(180, 0.2, 'square', 0.08 * vol, 90);
  }
  function playEnemyHit() {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    tone(160, 0.32, 'sine', 0.35 * vol, 45);
    noise(0.1, 0.15 * vol, 1200, 1);
    tone(120, 0.25, 'sawtooth', 0.1 * vol, 60);
  }
  function playWin() {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    [660, 880, 1320, 1760].forEach((f, i) => tone(f, 0.4, 'triangle', 0.14 * vol));
  }
  function playLose() {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    tone(300, 0.3, 'sawtooth', 0.14 * vol);
    tone(180, 0.5, 'sawtooth', 0.14 * vol);
  }
  function playWhoosh() {
    const vol = S.profile.settings.sfxVolume ?? 0.7;
    if (vol === 0) return;
    noise(0.16, 0.12 * vol, 500, 0.8);
  }

  /* ═══ DOM REFS ═══ */
  let arenaEl, playerSprite, enemySprite, playerHealthEl, enemyHealthEl;
  let timerEl, questionWrap, feedbackEl, tierTimerEl, questionCounterEl;

  function cacheDom() {
    arenaEl          = document.getElementById('fightArena');
    playerSprite     = document.getElementById('fightPlayer');
    enemySprite      = document.getElementById('fightEnemy');
    playerHealthEl   = document.getElementById('fightPlayerHealth');
    enemyHealthEl    = document.getElementById('fightEnemyHealth');
    timerEl          = document.getElementById('fightTimer');
    questionWrap     = document.getElementById('questionWrap');
    feedbackEl       = document.getElementById('fightFeedback');
    tierTimerEl      = document.getElementById('tierTimer');
    questionCounterEl= document.getElementById('questionCounter');
  }

  /* ═══ FIGHT STATE ═══ */
  let queue = [];
  let qIndex = 0;
  let qStart = 0;
  let tierTimerInterval = null;
  let sessionTimeID = null;
  let onExit = null;
  let currentQ = null;
  let currentAnswerHandler = null;
  let hintUsedThisQ = false;

  // Mode / archetype runtime
  let config = null;             // full fight config
  let blitzTimerPerQ = null;     // ms per question (null = elapsed)
  let blitzTimeoutID = null;
  let blitzDeadline = 0;
  let bossState = {
    shield: true,                // p1 boss
    consecutiveCorrect: 0,       // guard boss
    round: 0,                    // p6 boss
    currentTimerMs: null,        // shrinking timer bosses
    lockedChoice: null           // x8 boss
  };

  /* ═══════════════════════════════════════════════════════ */
  /*  START A FIGHT                                           */
  /* ═══════════════════════════════════════════════════════ */
  function start(levelOrConfig, exitCallback) {
    onExit = exitCallback;
    cacheDom();

    // Accept either a raw level (from campaign map) or a pre-configured fight.
    // If it has `archetype`, it's already configured.
    if (levelOrConfig.archetype) {
      config = levelOrConfig;
    } else {
      config = M.configureLevel(levelOrConfig);
    }

    // Pick questions
    if (config.preSelected && config.preSelected.length) {
      // Review run — use the pre-selected due questions directly
      queue = [...config.preSelected];
    } else if (config.unlockedPatterns && config.unlockedPatterns.length) {
      // Blitz: mix patterns
      const pool = Q.BANK.filter(q =>
        config.unlockedPatterns.includes(q.pattern) &&
        q.difficulty <= config.diff
      );
      queue = Q.shuffle(pool).slice(0, config.questions);
    } else {
      // Campaign — blend due-for-review with fresh
      queue = CF.Spaced.pickWithReview(config);
    }
    qIndex = 0;

    // Reset session
    const maxHP = 100 + (S.profile.upgrades.maxHP || 0) * 20;
    S.resetSession({
      mode: config.tier === 'blitz' ? 'blitz' : 'campaign',
      campaignLevel: config.tier === 'blitz' ? null : config.id,
      enemyArchetype: config.enemy,
      questionsRemaining: queue.length,
      playerHP: maxHP,
      enemyHP: config.enemyHP,
      enemyMaxHP: config.enemyMaxHP
    });
    S.session.enemyDamageBase = config.enemyDamage;

        // Reset per-fight flags
    S.session.shieldUsed = false;

    // Reset boss state
    bossState = {
      shield: true,
      consecutiveCorrect: 0,
      round: 0,
      currentTimerMs: config.timerPerQuestion,
      lockedChoice: null
    };

    applyArchetype(config.enemy);
    updateHUD();
    timerEl.textContent = config.tier === 'blitz' ? '10.0' : '0:00';
    startSessionTimer();

    // Entry fanfare (short) then loop the battle theme
    playEntryFanfare(config.enemy);
    setTimeout(() => {
      if (config.tier === 'blitz') Music.play('blitz');
      else if (config.tier === 'boss') Music.play('boss');
      else Music.play('combat');
    }, 900);

    nextQuestion();
  }

  function applyArchetype(enemy) {
    const arch = M.getArchetype(enemy);
    enemySprite.textContent = arch.icon;
    enemySprite.dataset.archetype = enemy;
  }

  /* ═══ SESSION TIMER (elapsed, not countdown) ═══ */
  function startSessionTimer() {
    const start = performance.now();
    clearInterval(sessionTimeID);
    sessionTimeID = setInterval(() => {
      const ms = performance.now() - start;
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      timerEl.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
      timerEl.dataset.start = start;
    }, 500);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  NEXT QUESTION                                          */
  /* ═══════════════════════════════════════════════════════ */
  function nextQuestion() {
    if (S.session.playerHP <= 0 || S.session.enemyHP <= 0 || qIndex >= queue.length) {
      endFight();
      return;
    }

    // p6 Boss: cannot end before minRounds
    if (config.bossMech?.rule === 'min_rounds') {
      if (qIndex < config.bossMech.minRounds && S.session.enemyHP <= 0) {
        S.session.enemyHP = 1;   // hold at 1 HP until minimum rounds passed
        updateHUD();
      }
    }

    bossState.round++;
    hintUsedThisQ = false;

    let q = queue[qIndex];
    currentQ = q;
    S.session.questionStartTime = performance.now();
    qStart = performance.now();

    // p4 / x2 Boss: shrink timer
    if (config.bossMech?.rule === 'shrinking_timer') {
      if (bossState.currentTimerMs == null) {
        bossState.currentTimerMs = config.bossMech.startTimer * 1000;
      } else if (bossState.round > 1) {
        bossState.currentTimerMs = Math.max(4000,
          bossState.currentTimerMs - config.bossMech.decrement * 1000);
      }
    } else {
      bossState.currentTimerMs = config.timerPerQuestion;
    }

    questionCounterEl.textContent = `Q${qIndex + 1} / ${queue.length}`;
    feedbackEl.textContent = '';
    feedbackEl.className = 'fight-feedback';

    // Show boss mechanic banner on the first question
    if (config.bossMech && qIndex === 0) {
      feedbackEl.className = 'fight-feedback boss-intro';
      feedbackEl.textContent = `${config.bossMech.icon} ${config.bossMech.name} — ${config.bossMech.desc}`;
    }

    currentAnswerHandler = (submitted) => {
      const elapsed = performance.now() - qStart;
      handleAnswer(q, submitted, elapsed);
    };
    R.mount(q, questionWrap, currentAnswerHandler);

    // Archetype restrictions applied post-mount
    applyArchetypeToQuestion(q);

    startTierTimer();
  }

  function applyArchetypeToQuestion(q) {
    const arch = config.archetype;
    if (!arch) return;

    // Sorcerer: disable one wrong option
    if (arch.restrictions.includes('curse-one') && q.options && q.type !== 'order' && q.type !== 'numeric') {
      const options = questionWrap.querySelectorAll('.mcq-option, .chip');
      const wrongIdxs = [];
      options.forEach((el, i) => { if (i !== q.correct) wrongIdxs.push(i); });
      if (wrongIdxs.length) {
        const cursedIdx = wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)];
        options[cursedIdx].disabled = true;
        options[cursedIdx].style.opacity = '.35';
        options[cursedIdx].style.textDecoration = 'line-through';
      }
    }

    // x8 Boss: locked button carry-over
    if (config.bossMech?.rule === 'lock_button' && bossState.lockedChoice != null) {
      const options = questionWrap.querySelectorAll('.mcq-option, .chip');
      const el = options[bossState.lockedChoice];
      if (el) {
        el.disabled = true;
        el.style.opacity = '.35';
        el.style.textDecoration = 'line-through';
      }
    }
  }

  /* ═══ TIER TIMER — elapsed (campaign) OR countdown (blitz/boss) ═══ */
  function startTierTimer() {
    clearInterval(tierTimerInterval);
    clearTimeout(blitzTimeoutID);

    const timeoutMs = bossState.currentTimerMs;

    if (timeoutMs) {
      // Countdown mode
      blitzDeadline = performance.now() + timeoutMs;
      tierTimerInterval = setInterval(() => {
        const remaining = blitzDeadline - performance.now();
        if (remaining <= 0) {
          clearInterval(tierTimerInterval);
          handleTimeout();
          return;
        }
        tierTimerEl.textContent = (remaining / 1000).toFixed(1) + 's';
        const frac = remaining / timeoutMs;
        if (frac < 0.15) tierTimerEl.dataset.tier = 'slow';
        else if (frac < 0.35) tierTimerEl.dataset.tier = 'good';
        else if (frac < 0.65) tierTimerEl.dataset.tier = 'great';
        else tierTimerEl.dataset.tier = 'perfect';
      }, 80);
    } else {
      // Elapsed mode
      tierTimerInterval = setInterval(() => {
        const ms = performance.now() - qStart;
        tierTimerEl.textContent = (ms / 1000).toFixed(1) + 's';
        tierTimerEl.dataset.tier = classify(ms).key;
      }, 100);
    }
  }

  function stopTierTimer() {
    clearInterval(tierTimerInterval);
    clearTimeout(blitzTimeoutID);
  }

  function handleTimeout() {
    // Countdown hit 0 — treat as wrong answer
    stopTierTimer();
    feedbackEl.className = 'fight-feedback wrong';
    feedbackEl.textContent = '⏰ TIME OUT! The enemy strikes first.';
    playWrong();

    S.session.roundLog.push({
      id: currentQ?.id || 'timeout',
      pattern: currentQ?.pattern,
      type: currentQ?.type,
      title: currentQ?.title || 'Timeout',
      correct: false,
      elapsedMs: bossState.currentTimerMs || 10000,
      timedOut: true
    });
    S.session.answered++;
    S.session.combo = 0;

    setTimeout(() => {
      const dmg = (S.session.enemyDamageBase || 15) * 1.5;   // timeout hurts
      playEnemyHit();
      cinematicEnemyAttack(Math.round(dmg));
      setTimeout(() => { qIndex++; nextQuestion(); }, 1400);
    }, 400);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  HANDLE ANSWER                                          */
  /* ═══════════════════════════════════════════════════════ */
  function handleAnswer(q, submitted, elapsedMs) {
    stopTierTimer();
    const correct = R.checkAnswer(q, submitted);
    S.session.answered++;

    const arch = config.archetype;
    const mech = config.bossMech;

    // Record for spaced repetition
    try { CF.Spaced.recordAnswer(q, correct, hintUsedThisQ); } catch (e) { /* no-op */ }

    // Log for recap
    S.session.roundLog.push({
      id: q.id,
      pattern: q.pattern,
      type: q.type,
      title: q.title,
      correct,
      elapsedMs
    });

    if (correct) {
      S.session.correct++;
      S.session.combo++;
      if (S.session.combo > S.session.maxCombo) S.session.maxCombo = S.session.combo;
      bossState.consecutiveCorrect++;

      const tier = classify(elapsedMs);
      if (tier.key === 'perfect') S.session.perfectAnswers++;

      /* ─── Compute damage ─── */
      const baseDmg = Q.getTypeMeta(q.type).baseDamage
                    + (S.profile.upgrades.baseDamage || 0) * 5;
      let dmg = Math.round(baseDmg * tier.dmgMult);

      let dmgNote = '';

      // Ghost archetype: MCQ-type questions deal 0
      if (arch.restrictions.includes('no-mcq') && isMCQType(q.type)) {
        dmg = 0;
        dmgNote = ' · 👻 Ghost absorbs MCQ damage!';
      }

      // p1 Boss: only pattern questions break the shield
      if (mech?.rule === 'shield_pattern_only' && bossState.shield) {
        if (q.type !== 'pattern') {
          dmg = 0;
          dmgNote = ' · 🦂 Shield absorbs non-recognition hits!';
        } else {
          bossState.shield = false;
          dmgNote = ' · 💥 Shield broken!';
        }
      }

      // Guard boss: needs 2 correct in a row
      if (mech?.rule === 'streak_2') {
        if (bossState.consecutiveCorrect < 2) {
          dmg = 0;
          dmgNote = ` · 🔒 Gate needs ${2 - bossState.consecutiveCorrect} more in a row`;
        } else {
          bossState.consecutiveCorrect = 0;
        }
      }

      // p6 Boss: cannot die before minRounds
      if (mech?.rule === 'min_rounds' && qIndex + 1 < mech.minRounds) {
        if (S.session.enemyHP - dmg <= 0) {
          dmg = Math.max(0, S.session.enemyHP - 1);
          dmgNote = ' · 🗿 Keeper withstands fatal damage!';
        }
      }

      feedbackEl.className = 'fight-feedback correct';
      feedbackEl.textContent = `${tier.label} · ${dmg} damage${dmgNote} · ${q.explanation || ''}`;

      playWhoosh();
      setTimeout(() => playTier(tier.key), 200);
      cinematicHit(tier, dmg);

      setTimeout(() => {
        qIndex++;
        nextQuestion();
      }, tier.animMs + 400);
    } else {
      // Combo shield: absorb the first wrong answer
      if (S.profile.upgrades.comboShield && !S.session.shieldUsed) {
        S.session.shieldUsed = true;
        feedbackEl.className = 'fight-feedback hint';
        feedbackEl.textContent = '🛡️ Shield absorbed — combo preserved.';
        setTimeout(() => {
          qIndex++;
          nextQuestion();
        }, 900);
        return;
      }

      S.session.combo = 0;
      bossState.consecutiveCorrect = 0;
      const correctText = R.formatCorrect(q);

      feedbackEl.className = 'fight-feedback wrong';
      feedbackEl.textContent = `✗ Correct: ${correctText} · ${q.explanation || ''}`;

      playWrong();

      setTimeout(() => {
        let dmg = S.session.enemyDamageBase || 15;

        // p7 Boss: triple damage on wrong
        if (mech?.rule === 'triple_wrong_damage') dmg *= 3;

        // p2 Boss: heal on wrong
        if (mech?.rule === 'heal_on_wrong') {
          S.session.enemyHP = Math.min(S.session.enemyMaxHP, S.session.enemyHP + mech.heal);
          updateHUD();
          feedbackEl.textContent += ` · 🐙 Boss heals ${mech.heal} HP`;
        }

        // x8 Boss: lock one choice for next question
        if (mech?.rule === 'lock_button' && q.options) {
          const idxs = q.options.map((_, i) => i).filter(i => i !== q.correct);
          bossState.lockedChoice = idxs[Math.floor(Math.random() * idxs.length)];
        }

        playEnemyHit();
        cinematicEnemyAttack(Math.round(dmg));
        setTimeout(() => {
          qIndex++;
          nextQuestion();
        }, 1500);
      }, 500);
    }
  }

  function isMCQType(type) {
    return ['pattern', 'complexity', 'state', 'trace', 'invariant', 'bug', 'nextline'].includes(type);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  COMBAT VISUALS                                          */
  /* ═══════════════════════════════════════════════════════ */
  function cinematicHit(tier, damage) {
    const isPerfect = tier.key === 'perfect';

    arenaEl.style.setProperty('--shake-int', isPerfect ? '24px' : tier.key === 'great' ? '14px' : '6px');
    arenaEl.classList.remove('shake'); void arenaEl.offsetWidth;
    arenaEl.classList.add('shake', 'hitstop');

    playerSprite.classList.remove('lunge', 'tier-perfect', 'tier-great', 'tier-good', 'tier-slow');
    void playerSprite.offsetWidth;
    playerSprite.classList.add('lunge', 'tier-' + tier.key);

    setTimeout(() => {
      spawnFlash(tier.key);
      spawnShockwaves(tier.key);
      spawnSparks(isPerfect ? 32 : tier.key === 'great' ? 20 : 10, tier);
      if (isPerfect) spawnLightning();

      enemySprite.classList.add('hit');
      setTimeout(() => enemySprite.classList.remove('hit'), 500);
      spawnTierLabel(tier);
      spawnDamagePopup(enemySprite, damage, tier.key);

      // Combo explosion at high combos on perfect
      if (isPerfect && S.session.combo >= 3) {
        spawnComboExplode(`🔥 ${S.session.combo}× COMBO`);
      }

      S.session.enemyHP = Math.max(0, S.session.enemyHP - damage);
      updateHUD();

      setTimeout(() => {
        arenaEl.classList.remove('hitstop', 'shake');
        playerSprite.classList.remove('tier-' + tier.key);
      }, tier.animMs);
    }, isPerfect ? 300 : 220);
  }

  /* ═══ SHOCKWAVES ═══ */
  function spawnShockwaves(tier) {
    const count = tier === 'perfect' ? 3 : tier === 'great' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'shockwave ' + tier;
      if (i > 0) el.classList.add('delay-' + i);
      arenaEl.appendChild(el);
      setTimeout(() => el.remove(), 1600 + i * 200);
    }
  }

  /* ═══ LIGHTNING BOLTS (perfect only) ═══ */
  function spawnLightning() {
    const w = arenaEl.clientWidth, h = arenaEl.clientHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'lightning');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const cx = w / 2, cy = h / 2;
    for (let b = 0; b < 5; b++) {
      const angle = (Math.PI * 2 * b) / 5 + Math.random() * 0.4;
      let d = `M ${cx} ${cy}`;
      const segments = 6;
      for (let i = 1; i <= segments; i++) {
        const r = (i / segments) * 180;
        const jitter = (Math.random() - 0.5) * 40;
        const x = cx + Math.cos(angle) * r + jitter;
        const y = cy + Math.sin(angle) * r + jitter;
        d += ` L ${x} ${y}`;
      }
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    arenaEl.appendChild(svg);
    setTimeout(() => svg.remove(), 1600);
  }

  /* ═══ COMBO EXPLOSION ═══ */
  function spawnComboExplode(text) {
    const el = document.createElement('div');
    el.className = 'combo-explode';
    el.textContent = text;
    arenaEl.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  function cinematicEnemyAttack(damage) {
    enemySprite.classList.remove('attacking'); void enemySprite.offsetWidth;
    enemySprite.classList.add('attacking');

    arenaEl.classList.remove('shake'); void arenaEl.offsetWidth;
    arenaEl.classList.add('shake');
    arenaEl.style.setProperty('--shake-int', '10px');

    setTimeout(() => {
      spawnFlash('slow');
      spawnSparks(10, { key: 'slow', color: '#f43f5e' });
      playerSprite.classList.add('hit');
      spawnDamagePopup(playerSprite, damage, 'good');
      S.session.playerHP = Math.max(0, S.session.playerHP - damage);
      updateHUD();

      setTimeout(() => {
        playerSprite.classList.remove('hit');
        arenaEl.classList.remove('shake');
      }, 600);
    }, 220);
  }

  function spawnFlash(tier) {
    const el = document.createElement('div');
    el.className = 'flash-overlay ' +
      (tier === 'perfect' ? 'gold' : tier === 'great' ? 'orange' : 'cyan');
    arenaEl.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function spawnSparks(count, tier) {
    const colors = tier.key === 'perfect' ? ['#fbbf24','#fde68a','#fff','#fb923c']
                 : tier.key === 'great'   ? ['#fb923c','#fdba74','#fff']
                 : tier.key === 'slow'    ? ['#64748b','#94a3b8']
                 : ['#22d3ee','#67e8f9','#fff'];
    const rect = arenaEl.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'spark';
      const angle = Math.random() * Math.PI * 2;
      const dist = 200 * (0.5 + Math.random() * 0.8);
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.style.background = color;
      el.style.boxShadow = `0 0 12px ${color}, 0 0 24px ${color}`;
      el.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      el.style.setProperty('--ty', Math.sin(angle) * dist - 30 + 'px');
      el.style.setProperty('--dur', (0.7 + Math.random() * 0.5) + 's');
      arenaEl.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    }
  }

  function spawnTierLabel(tier) {
    const el = document.createElement('div');
    el.className = 'tier-label';
    el.textContent = tier.label;
    el.style.color = tier.color;
    el.style.textShadow = `0 0 30px ${tier.color}, 0 0 60px ${tier.color}, 0 4px 8px rgba(0,0,0,.9)`;
    arenaEl.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  function spawnDamagePopup(target, dmg, tier) {
    const rect = target.getBoundingClientRect();
    const ar = arenaEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'damage-popup tier-' + tier;
    el.textContent = '−' + dmg;
    el.style.left = (rect.left - ar.left + rect.width / 2) + 'px';
    el.style.top  = (rect.top - ar.top + 20) + 'px';
    arenaEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function updateHUD() {
    const playerMax = 100 + (S.profile.upgrades.maxHP || 0) * 20;
    const pPct = Math.max(0, (S.session.playerHP / playerMax) * 100);
    const ePct = Math.max(0, (S.session.enemyHP / S.session.enemyMaxHP) * 100);
    playerHealthEl.style.width = pPct + '%';
    enemyHealthEl.style.width  = ePct + '%';
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  END FIGHT                                               */
  /* ═══════════════════════════════════════════════════════ */
  function endFight() {
    stopTierTimer();
    clearInterval(sessionTimeID);
    Music.stop();

    const won = S.session.enemyHP <= 0 || (S.session.playerHP > 0 && qIndex >= queue.length);
    const elapsed = performance.now() - Number(timerEl.dataset.start || performance.now());

    if (won) playWin(); else playLose();

    // Complete the campaign level (awards XP, coins, stars)
    if (S.session.campaignLevel) {
      const result = L.completeFight(S.session.campaignLevel, won, S.session, elapsed);
      S.checkAndUpdateStreak();
      if (onExit) onExit({ won, result, session: S.session });
    } else {
      if (onExit) onExit({ won, result: null, session: S.session });
    }
  }
  /* ═══════════════════════════════════════════════════════ */
  /*  HINT + SKIP                                             */
  /* ═══════════════════════════════════════════════════════ */
  function applyHint() {
    if (!currentQ || hintUsedThisQ) return false;
    hintUsedThisQ = true;
    S.session.hintsUsed = (S.session.hintsUsed || 0) + 1;

    // Free hint from shop
    if (S.profile.upgrades.freeHints > 0) {
      S.profile.upgrades.freeHints--;
      S.save();
      feedbackEl.className = 'fight-feedback hint';
      feedbackEl.textContent = '💡 (Free hint) ' + (currentQ.hint || currentQ.explanation || '');
      return true;
    }

    S.session.playerHP = Math.max(0, S.session.playerHP - 5);

    // x5 Boss: heals on hint
    if (config?.bossMech?.rule === 'heal_on_hint') {
      S.session.enemyHP = Math.min(S.session.enemyMaxHP,
        S.session.enemyHP + config.bossMech.heal);
    }

    updateHUD();
    feedbackEl.className = 'fight-feedback hint';
    feedbackEl.textContent = '💡 ' + (currentQ.hint || currentQ.explanation || 'No hint available.');
    if (S.session.playerHP <= 0) setTimeout(endFight, 400);
    return true;
  }

  function applySkip() {
    if (!currentQ) return false;
    stopTierTimer();
    S.session.hintsUsed = (S.session.hintsUsed || 0) + 1;
    S.session.playerHP = Math.max(0, S.session.playerHP - 10);
    S.session.combo = 0;
    updateHUD();

    const correctText = R.formatCorrect(currentQ);
    S.session.roundLog.push({
      id: currentQ.id,
      pattern: currentQ.pattern,
      type: currentQ.type,
      title: currentQ.title,
      correct: false,
      elapsedMs: performance.now() - qStart,
      skipped: true
    });
    S.session.answered++;

    feedbackEl.className = 'fight-feedback info';
    feedbackEl.textContent = `⏭ Skipped. Correct: ${correctText}`;

    if (S.session.playerHP <= 0) { setTimeout(endFight, 800); return true; }

    setTimeout(() => { qIndex++; nextQuestion(); }, 1500);
    return true;
  }
  /* ═══ REROLL ═══ */
  function applyReroll() {
    if (!currentQ) return false;
    if ((S.profile.upgrades.rerolls || 0) <= 0) return false;
    S.profile.upgrades.rerolls--;
    S.save();

    // Pick a different question from the same pattern, not already in queue
    const usedIds = new Set(queue.map(q => q.id));
    const pool = Q.BANK.filter(q =>
      q.pattern === currentQ.pattern &&
      !usedIds.has(q.id) &&
      q.difficulty <= (config.diff || 3)
    );
    if (!pool.length) return false;

    const newQ = pool[Math.floor(Math.random() * pool.length)];
    queue[qIndex] = newQ;

    // Re-render
    stopTierTimer();
    nextQuestion();
    return true;
  }

  /* ═══ CLEANUP ═══ */
  function abort() {
    stopTierTimer();
    clearInterval(sessionTimeID);
    Music.stop();
    currentQ = null;
    currentAnswerHandler = null;
  }
    /* ═══ CLEANUP ═══ */
  function abort() {
    stopTierTimer();
    clearInterval(sessionTimeID);
    Music.stop();
    currentQ = null;
    currentAnswerHandler = null;
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  ENTRY FANFARE — short theme when a fight begins        */
  /* ═══════════════════════════════════════════════════════ */
  let actx2 = null;
  function ac2() {
    if (!actx2) actx2 = new (window.AudioContext || window.webkitAudioContext)();
    if (actx2.state === 'suspended') actx2.resume();
    return actx2;
  }

  function fanfareTone(freq, start, dur, type, vol) {
    const c = ac2();
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  }

  function playEntryFanfare(enemy) {
    const vol = (S.profile.settings.sfxVolume ?? 0.7) * 0.6;
    if (vol === 0) return;
    const patterns = {
      bot:       [[523,0,0.12],[659,0.1,0.12],[784,0.2,0.25]],
      ghost:     [[440,0,0.15],[392,0.15,0.15],[330,0.3,0.4]],
      tank:      [[196,0,0.2],[196,0.2,0.2],[147,0.4,0.5]],
      berserker: [[330,0,0.08],[440,0.08,0.08],[660,0.16,0.08],[880,0.24,0.3]],
      sorcerer:  [[659,0,0.1],[784,0.1,0.1],[1047,0.2,0.1],[784,0.3,0.4]],
      boss:      [[110,0,0.4],[139,0.3,0.4],[165,0.6,0.6]]
    };
    const notes = patterns[enemy] || patterns.bot;
    notes.forEach(([f, s, d]) => fanfareTone(f, s, d, 'triangle', vol));
  }

  return { start, abort, applyHint, applySkip, applyReroll };
})();
