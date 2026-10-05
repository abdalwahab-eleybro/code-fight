/* ═══════════════════════════════════════════════════════════ */
/*  SHELL — screen router, map render, menu wiring             */
/* ═══════════════════════════════════════════════════════════ */
(function () {
  const S = CF.State;
  const C = CF.Campaign;
  const L = CF.CampaignLogic;
  const E = CF.Engine;

  /* ═══ SCREEN ROUTER ═══ */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'screen-map') { renderProfileBar(); renderMap(); }
  }

  /* ═══ PROFILE BAR ═══ */
  function renderProfileBar() {
    const p = S.profile;
    const nextLevelXP = S.xpForLevel(p.playerLevel + 1);
    const currLevelXP = S.xpForLevel(p.playerLevel);
    const pct = Math.max(0, Math.min(100,
      ((p.xp - currLevelXP) / Math.max(1, nextLevelXP - currLevelXP)) * 100));
    const fighter = S.getFighter(p.equippedFighter);

    document.getElementById('profileBar').innerHTML = `
      <div class="profile-bar">
        <div class="prof-fighter">${fighter.icon}</div>
        <div class="prof-item"><span class="lbl">Lv</span><span class="val">${p.playerLevel}</span></div>
        <div class="prof-item" style="flex-direction:column;align-items:flex-start;gap:3px;">
          <span class="lbl">XP ${p.xp} / ${nextLevelXP}</span>
          <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="prof-spacer"></div>
        <div class="prof-item"><span class="icon">🪙</span><span class="val">${p.coins}</span></div>
        <div class="prof-item"><span class="icon">🔥</span><span class="val">${p.streak.current}</span></div>
      </div>`;
  }

  /* ═══ MAP ═══ */
  function renderMap() {
    const progress = L.getProgressSummary();
    document.getElementById('mapProgress').textContent =
      `${progress.cleared} / ${progress.total} levels · ${progress.totalStars} / ${progress.maxStars} ⭐`;

    // ── Weak spot banner ──
    const wsContainer = document.getElementById('weakSpotBanner');
    const weakSpots = CF.Spaced.findWeakSpots();
    if (weakSpots.length) {
      const top = weakSpots[0];
      wsContainer.innerHTML = `
        <div class="weak-banner">
          <div class="weak-icon">⚠️</div>
          <div class="weak-body">
            <div class="weak-title">Weak Spot Detected</div>
            <div class="weak-desc">
              You've missed <b>${top.patternName}</b> ${top.wrongCount} times recently (${top.accuracy}% accuracy).
            </div>
          </div>
          <button class="weak-drill" id="weakDrill">Drill it</button>
        </div>
      `;
      wsContainer.querySelector('#weakDrill').addEventListener('click', () => {
        // Find a campaign level for this pattern and start it
        const lvl = C.levels.find(l => l.pattern === top.patternId && l.tier === 'medium')
                 || C.levels.find(l => l.pattern === top.patternId);
        if (lvl) startLevel(lvl.id);
      });
    } else {
      wsContainer.innerHTML = '';
    }

    // ── Review node ──
    const rvContainer = document.getElementById('reviewNode');
    const dueCount = CF.Spaced.countDue();
    const stats = CF.Spaced.getStats();
    if (dueCount > 0) {
      rvContainer.innerHTML = `
        <div class="review-node" id="reviewStart">
          <div class="review-icon">🧠</div>
          <div class="review-body">
            <div class="review-name">
              Daily Review
              <span class="review-count">${dueCount} DUE</span>
            </div>
            <div class="review-desc">
              ${stats.mastered} mastered · ${stats.learning} learning · ${stats.struggling} struggling
            </div>
          </div>
        </div>
      `;
      rvContainer.querySelector('#reviewStart').addEventListener('click', () => startReview());
    } else {
      rvContainer.innerHTML = `
        <div class="review-node empty">
          <div class="review-icon">🧠</div>
          <div class="review-body">
            <div class="review-name">Daily Review</div>
            <div class="review-desc">Nothing due — come back tomorrow</div>
          </div>
        </div>
      `;
    }

    const list = document.getElementById('mapList');
    list.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'volume-header';
    header.textContent = `Volume 1 — ${C.volumeNames[1]}`;
    list.appendChild(header);

    let currentPattern = null;

    C.levels.forEach((lvl, i) => {
      if (lvl.pattern !== currentPattern) {
        currentPattern = lvl.pattern;
        const pHeader = document.createElement('div');
        pHeader.className = 'pattern-subheader';
        pHeader.innerHTML = `<span class="pattern-dot"></span>${lvl.patternName}`;
        list.appendChild(pHeader);
      }

      const unlocked = S.isLevelUnlocked(lvl.id);
      const record = S.profile.campaignLevels[lvl.id] || { cleared: false, stars: 0, bestTime: 0 };
      const isBoss = lvl.tier === 'boss';
      const lockedMsg = L.lockedReason(lvl.id);
      const stars = record.cleared ? '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : '';
      const icon = L.tierIcon(lvl.tier, record.cleared, unlocked);

      const card = document.createElement('div');
      card.className = 'level-card' +
        (unlocked ? '' : ' locked') +
        (record.cleared ? ' cleared' : '') +
        (isBoss ? ' boss' : '');

      const enemyIcon = L.tierEnemyIcon(lvl.enemy);
      const bestTime = record.bestTime ? ` · best ${L.formatTime(record.bestTime)}` : '';

      card.innerHTML = `
        <div class="level-icon">${icon}</div>
        <div class="level-body">
          <div class="level-name">${lvl.name}<span class="tier-badge tier-${lvl.tier}">${lvl.tier}</span></div>
          <div class="level-meta">${enemyIcon} ${lvl.enemy} · ${lvl.questions} Q · diff ${lvl.diff}${bestTime}</div>
          ${lockedMsg ? `<div class="level-locked">🔒 ${lockedMsg}</div>` : ''}
        </div>
        <div class="level-stars">${stars}</div>
      `;
      if (unlocked) card.addEventListener('click', () => startLevel(lvl.id));
      list.appendChild(card);

      if (i < C.levels.length - 1) {
        const conn = document.createElement('div');
        conn.className = 'level-connector' + (record.cleared ? ' done' : '');
        list.appendChild(conn);
      }
    });

    const futureHeader = document.createElement('div');
    futureHeader.className = 'volume-header';
    futureHeader.style.marginTop = '20px';
    futureHeader.textContent = 'Coming Soon';
    list.appendChild(futureHeader);

    L.getFutureVolumes().forEach(v => {
      const card = document.createElement('div');
      card.className = 'level-card locked volume-preview';
      card.innerHTML = `
        <div class="level-icon">${v.icon}</div>
        <div class="level-body">
          <div class="level-name">Vol ${v.num} — ${v.name}</div>
          <div class="level-meta">${v.patterns}</div>
        </div>
        <div class="level-stars" style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);">${v.eta}</div>
      `;
      list.appendChild(card);
    });
  }

  /* ═══ START A LEVEL ═══ */
  function startLevel(levelId) {
    const lvl = L.getLevel(levelId);
    if (!lvl) return;

    const config = CF.Modes.configureLevel(lvl);
    const bossMech = config.bossMech;

    document.getElementById('fightEnemyName').textContent =
      `${config.archetype.icon} ${bossMech ? bossMech.name : config.archetype.name}`;

    const banner = document.getElementById('bossBanner');
    if (bossMech) {
      banner.style.display = 'block';
      banner.innerHTML = `${bossMech.icon} <b>${bossMech.name}</b> — ${bossMech.desc}`;
    } else {
      banner.style.display = 'none';
    }

    document.body.classList.remove('mode-blitz');
    showScreen('screen-fight');

    E.start(config, (outcome) => {
      outcome.level = lvl;
      outcome.session.maxPlayerHP = 100 + (S.profile.upgrades.maxHP || 0) * 20;

      const unlockedBadges = CF.Achievements.checkAll(outcome);

      showScreen('screen-recap');
      CF.Screens.renderRecap(document.getElementById('recapContent'), outcome, {
        onMap: () => {
          showScreen('screen-map');
          CF.Music.play('menu');
          if (unlockedBadges.length) {
            setTimeout(() => CF.Screens.showAchievements(unlockedBadges), 400);
          }
        },
        onRetry: () => {
          if (unlockedBadges.length) CF.Screens.showAchievements(unlockedBadges);
          setTimeout(() => startLevel(lvl.id), 100);
        }
      });
    });
  }

  /* ═══ START BLITZ ═══ */
  function startBlitz() {
    const config = CF.Modes.configureBlitz();

    document.getElementById('fightEnemyName').textContent =
      `${config.archetype.icon} Blitz · ${config.archetype.name}`;

    const banner = document.getElementById('bossBanner');
    banner.style.display = 'block';
    banner.innerHTML = `⚡ <b>Blitz Run</b> — 10 questions, 10s each. Stay sharp!`;

    document.body.classList.add('mode-blitz');
    showScreen('screen-fight');

    E.start(config, (outcome) => {
      outcome.level = { name: 'Blitz Run', tier: 'blitz' };
      outcome.session.maxPlayerHP = 100 + (S.profile.upgrades.maxHP || 0) * 20;

      const unlockedBadges = CF.Achievements.checkAll(outcome);

      showScreen('screen-recap');
      CF.Screens.renderRecap(document.getElementById('recapContent'), outcome, {
        onMap: () => {
          document.body.classList.remove('mode-blitz');
          showScreen('screen-menu');
          if (unlockedBadges.length) {
            setTimeout(() => CF.Screens.showAchievements(unlockedBadges), 400);
          }
        },
        onRetry: () => {
          document.body.classList.remove('mode-blitz');
          if (unlockedBadges.length) CF.Screens.showAchievements(unlockedBadges);
          setTimeout(() => startBlitz(), 100);
        }
      });
    });
  }

  /* ═══ SHOP ═══ */
  function openShop() {
    showScreen('screen-shop');
    const container = document.getElementById('shopContent');
    CF.Shop.render(container, (result) => {
      if (result === 'back') {
        showScreen('screen-menu');
        return;
      }
      const purchaseResult = CF.Shop.purchase(result);
      if (purchaseResult.ok) {
        const item = CF.Shop.ITEMS.find(i => i.id === result);
        CF.Shop.showToast(`✓ ${item.name} purchased`);
        renderProfileBar();
        openShop();   // re-render
      } else {
        CF.Shop.showToast(purchaseResult.reason, 'error');
      }
    });
  }

  /* ═══ REVIEW RUN ═══ */
  function startReview() {
    const due = CF.Spaced.pickReviewQuestions(5);
    if (!due.length) {
      alert('Nothing due for review. Play more campaign levels first.');
      return;
    }

    const config = {
      id: 'review',
      name: 'Review Run',
      pattern: null,
      patternName: 'Mixed Review',
      tier: 'review',
      diff: 3,
      enemy: 'bot',
      questions: due.length,
      reward: { xp: 40, coins: 15 },
      archetype: { icon: '🧠', name: 'Recall', hpMult: 1, dmgMult: 1, restrictions: [], flavor: '' },
      bossMech: null,
      enemyHP: 80,
      enemyMaxHP: 80,
      enemyDamage: 12,
      timerPerQuestion: null,
      preSelected: due
    };

    document.getElementById('fightEnemyName').textContent = '🧠 Recall · Review';
    const banner = document.getElementById('bossBanner');
    banner.style.display = 'block';
    banner.innerHTML = `🧠 <b>Review Run</b> — ${due.length} due questions. Strengthen weak spots.`;
    document.body.classList.remove('mode-blitz');

    showScreen('screen-fight');

    E.start(config, (outcome) => {
      outcome.level = { name: 'Review Run', tier: 'review' };
      outcome.session.maxPlayerHP = 100 + (S.profile.upgrades.maxHP || 0) * 20;

      const unlockedBadges = CF.Achievements.checkAll(outcome);

      showScreen('screen-recap');
      CF.Screens.renderRecap(document.getElementById('recapContent'), outcome, {
        onMap: () => {
          showScreen('screen-map');
          CF.Music.play('menu');
          if (unlockedBadges.length) {
            setTimeout(() => CF.Screens.showAchievements(unlockedBadges), 400);
          }
        },
        onRetry: () => {
          if (unlockedBadges.length) CF.Screens.showAchievements(unlockedBadges);
          setTimeout(() => startReview(), 100);
        }
      });
    });
  }

  /* ═══ EVENT WIRING ═══ */
  document.getElementById('btnCampaign').addEventListener('click', () => showScreen('screen-map'));

  /* ═══════ LEARN — interactive lessons ═══════ */
  document.getElementById('btnLearn').addEventListener('click', () => {
    showScreen('screen-learn');
    CF.Lessons.render(document.getElementById('learnContent'), {
      onExit: () => { showScreen('screen-menu'); },
      onFight: (patternId) => {
        // Skill-tree aware: after finishing a lesson, jump straight into the
        // matching fight if its prereq chain opened it; otherwise send the
        // learner back to the picker where the next unlock is visible.
        const lvl = C.levels.find(l => l.pattern === patternId && l.tier === 'easy')
                 || C.levels.find(l => l.pattern === patternId);
        if (lvl && S.isLevelUnlocked(lvl.id)) startLevel(lvl.id);
        else showScreen('screen-map');
      }
    });
  });
  document.getElementById('btnMapBack').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('btnBlitz').addEventListener('click', () => startBlitz());
  document.getElementById('btnShop').addEventListener('click', () => openShop());

  document.getElementById('fightExit').addEventListener('click', () => {
    if (!confirm('Exit this fight? Progress will be lost.')) return;
    E.abort();
    showScreen('screen-map');
  });

  document.getElementById('fightHint').addEventListener('click', () => E.applyHint());
  document.getElementById('fightSkip').addEventListener('click', () => E.applySkip());



  /* ═══ SETTINGS ═══ */
  function openSettings() {
    showScreen('screen-settings');
    CF.Settings.render(document.getElementById('settingsContent'), () => {
      showScreen('screen-menu');
    });
  }
  document.getElementById('btnSettings').addEventListener('click', openSettings);

  /* ═══ BOOT ═══ */
  showScreen('screen-menu');

  // Music starts on first user gesture (iOS requirement)
  const startMusicOnce = () => {
    CF.Music.init();
    CF.Music.updateVolume();
    if (!CF.Music.isPlaying()) CF.Music.play('menu');
    document.removeEventListener('click', startMusicOnce);
    document.removeEventListener('touchstart', startMusicOnce);
    document.removeEventListener('keydown', startMusicOnce);
  };
  document.addEventListener('click', startMusicOnce);
  document.addEventListener('touchstart', startMusicOnce, { passive: true });
  document.addEventListener('keydown', startMusicOnce);
})();
