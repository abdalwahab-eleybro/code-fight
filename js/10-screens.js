/* ═══════════════════════════════════════════════════════════ */
/*  10-screens.js — Recap screen + achievement popups          */
/*  Depends on: 01, 02, 05                                      */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Screens = (() => {
  const S = CF.State;
  const L = CF.CampaignLogic;
  const A = CF.Achievements;

  /* ═══════════════════════════════════════════════════════ */
  /*  RECAP SCREEN                                            */
  /* ═══════════════════════════════════════════════════════ */
  function renderRecap(container, ctx, actions) {
    const { won, result, session, level, elapsedMs } = ctx;
    const accuracy = session.answered > 0 ? session.correct / session.answered : 0;
    const accuracyPct = Math.round(accuracy * 100);

    // Headline
    const headline = won
      ? (result?.stars === 3 ? 'FLAWLESS VICTORY' : 'VICTORY')
      : 'DEFEAT';

    const starsHtml = won
      ? '★'.repeat(result?.stars || 0) + '☆'.repeat(3 - (result?.stars || 0))
      : '';

    // Per-question log
    const logRows = (session.roundLog || []).map((entry, i) => `
      <div class="recap-row ${entry.correct ? 'ok' : 'fail'}">
        <span class="recap-num">Q${i + 1}</span>
        <span class="recap-mark">${entry.correct ? '✓' : '✗'}</span>
        <span class="recap-title">${escapeHtml(entry.title || entry.type)}</span>
        <span class="recap-type">${escapeHtml(entry.type)}</span>
        <span class="recap-time">${(entry.elapsedMs / 1000).toFixed(1)}s</span>
      </div>
    `).join('');

    // Rewards
    const rewardHtml = result && result.xpGained
      ? `
        <div class="recap-rewards">
          <div class="recap-reward">
            <div class="recap-reward-val">+${result.xpGained}</div>
            <div class="recap-reward-lbl">XP</div>
          </div>
          <div class="recap-reward">
            <div class="recap-reward-val">+${result.coinsGained || 0}</div>
            <div class="recap-reward-lbl">🪙 Coins</div>
          </div>
          ${result.newBestTime ? `<div class="recap-reward new-best">
            <div class="recap-reward-val">${L.formatTime(elapsedMs)}</div>
            <div class="recap-reward-lbl">New Best</div>
          </div>` : ''}
        </div>
      ` : '';

    container.innerHTML = `
      <div class="recap-card">
        <div class="recap-headline ${won ? 'win' : 'loss'}">${headline}</div>
        ${won ? `<div class="recap-stars">${starsHtml}</div>` : ''}
        <div class="recap-subtitle">${escapeHtml(level?.name || '')}</div>

        <div class="recap-stats">
          <div class="recap-stat">
            <div class="recap-stat-val">${session.correct} / ${session.answered}</div>
            <div class="recap-stat-lbl">Correct</div>
          </div>
          <div class="recap-stat">
            <div class="recap-stat-val">${accuracyPct}%</div>
            <div class="recap-stat-lbl">Accuracy</div>
          </div>
          <div class="recap-stat">
            <div class="recap-stat-val">${session.maxCombo}</div>
            <div class="recap-stat-lbl">Max Combo</div>
          </div>
          <div class="recap-stat">
            <div class="recap-stat-val">${L.formatTime(elapsedMs)}</div>
            <div class="recap-stat-lbl">Time</div>
          </div>
        </div>

        ${logRows ? `
          <div class="recap-section-title">Question Log</div>
          <div class="recap-log">${logRows}</div>
        ` : ''}

        ${rewardHtml}

        <div class="recap-actions">
          <button class="btn primary" id="recapMap">Return to Map</button>
          <button class="btn ghost" id="recapRetry">Retry</button>
        </div>
      </div>
    `;

    container.querySelector('#recapMap')?.addEventListener('click', actions.onMap);
    container.querySelector('#recapRetry')?.addEventListener('click', actions.onRetry);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  ACHIEVEMENT POPUP QUEUE                                 */
  /* ═══════════════════════════════════════════════════════ */
  let popupQueue = [];
  let popupActive = false;

  function showAchievements(badges) {
    if (!badges || !badges.length) return;
    popupQueue.push(...badges);
    if (!popupActive) drainQueue();
  }

  function drainQueue() {
    if (!popupQueue.length) { popupActive = false; return; }
    popupActive = true;
    const badge = popupQueue.shift();
    popupActiveFor(badge, () => {
      setTimeout(drainQueue, 300);
    });
  }

  function popupActiveFor(badge, done) {
    const el = document.createElement('div');
    el.className = 'achievement-popup rarity-' + badge.rarity;
    el.innerHTML = `
      <div class="ach-sparkle"></div>
      <div class="ach-icon">${badge.icon}</div>
      <div class="ach-text">
        <div class="ach-kicker">🏆 Achievement Unlocked</div>
        <div class="ach-name">${escapeHtml(badge.name)}</div>
        <div class="ach-desc">${escapeHtml(badge.description)}</div>
      </div>
      <div class="ach-rarity">${badge.rarity}</div>
    `;
    document.body.appendChild(el);

    // Play unlock sound
    playAchievementSound(badge.rarity);

    // Animate in
    requestAnimationFrame(() => el.classList.add('show'));

    // Animate out after delay
    setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => { el.remove(); if (done) done(); }, 500);
    }, 3200);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  SOUND                                                   */
  /* ═══════════════════════════════════════════════════════ */
  let actx = null;
  function ac() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, start, dur, type, vol) {
    const c = ac();
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur);
  }
  function playAchievementSound(rarity) {
    const vol = (S.profile.settings.sfxVolume ?? 0.7);
    if (vol === 0) return;
    if (rarity === 'platinum') {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.14 * vol));
    } else if (rarity === 'gold') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.45, 'triangle', 0.13 * vol));
    } else if (rarity === 'silver') {
      [440, 587, 740].forEach((f, i) => tone(f, i * 0.07, 0.4, 'triangle', 0.12 * vol));
    } else {
      [392, 523].forEach((f, i) => tone(f, i * 0.06, 0.35, 'triangle', 0.1 * vol));
    }
  }

  /* ═══ HELPERS ═══ */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { renderRecap, showAchievements };
})();
