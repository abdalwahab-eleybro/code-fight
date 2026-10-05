/* ═══════════════════════════════════════════════════════════ */
/*  01-state.js — Persistent profile, session, campaign data   */
/*  No dependencies. Load before everything else.              */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.State = (() => {
  const STORAGE_KEY = 'codefighter_profile_v1';
  const SCHEMA_VERSION = 1;

  /* ═══ FIGHTERS ═══ */
  // Content lives in data/fighters.json (edit there to add/change fighters).
  // The inline list below is the fallback used when the JSON can't be fetched
  // (e.g. opened via file://) — keep both in sync or just edit the JSON.
  const FIGHTERS_FALLBACK = [
    { id: 'ninja',   name: 'Ninja',   icon: '🥷', unlockLevel: 1  },
    { id: 'monk',    name: 'Monk',    icon: '🧘', unlockLevel: 3  },
    { id: 'ronin',   name: 'Ronin',   icon: '⚔️', unlockLevel: 5  },
    { id: 'mage',    name: 'Mage',    icon: '🧙', unlockLevel: 8  },
    { id: 'dragon',  name: 'Dragon',  icon: '🐉', unlockLevel: 12 },
    { id: 'phoenix', name: 'Phoenix', icon: '🔥', unlockLevel: 18 },
    { id: 'void',    name: 'Void',    icon: '🌌', unlockLevel: 25 }
  ];
  let FIGHTERS = FIGHTERS_FALLBACK;

  // Async content injection: swap in data/fighters.json if available.
  // CF.Content is defined in 00-content.js, which loads before this module.
  if (window.CF && CF.Content) {
    CF.Content.load('data/fighters.json').then(d => {
      if (d && Array.isArray(d.fighters) && d.fighters.length) {
        FIGHTERS = d.fighters;
      }
    });
  }


  /* ═══ DEFAULT PROFILE ═══ */
  function defaultProfile() {
    return {
      version: SCHEMA_VERSION,
      xp: 0,
      playerLevel: 1,
      coins: 50,
      unlockedFighters: ['ninja'],
      equippedFighter: 'ninja',
      achievements: {},
      campaignLevels: {},          // { levelId: { cleared, stars, bestTime } }
      currentCampaignLevel: 'p1-easy',
      questionHistory: {},         // reserved for spaced repetition (Msg 7)
      patternStats: {},            // reserved for weak-spot recommender (Msg 7)
      streak: { current: 0, best: 0, lastPlayedDate: null, freezesLeft: 1 },
      upgrades: { maxHP: 0, baseDamage: 0, freeHints: 0, comboShield: false, rerolls: 0 },
      settings: { musicVolume: 0.4, sfxVolume: 0.7 }
    };
  }

  /* ═══ LOAD / SAVE / MIGRATE ═══ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== SCHEMA_VERSION) return migrate(parsed);
      return parsed;
    } catch (e) {
      console.warn('Profile load failed:', e);
      return null;
    }
  }

  function migrate(old) {
    // Future schema upgrades land here
    return { ...defaultProfile(), ...old, version: SCHEMA_VERSION };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Profile save failed:', e);
    }
  }

  /* ═══ STATE ═══ */
  const profile = load() || defaultProfile();

  const session = {
    mode: 'campaign',
    campaignLevel: null,
    enemyArchetype: 'bot',
    questionsRemaining: 0,
    combo: 0,
    correct: 0,
    answered: 0,
    hintsUsed: 0,
    perfectAnswers: 0,
    maxCombo: 0,
    playerHP: 100,
    enemyHP: 100,
    enemyMaxHP: 100,
    roundLog: [],
    questionStartTime: 0
  };

  function resetSession(overrides = {}) {
    Object.assign(session, {
      mode: 'campaign',
      campaignLevel: null,
      enemyArchetype: 'bot',
      questionsRemaining: 0,
      combo: 0,
      correct: 0,
      answered: 0,
      hintsUsed: 0,
      perfectAnswers: 0,
      maxCombo: 0,
      playerHP: 100,
      enemyHP: 100,
      enemyMaxHP: 100,
      roundLog: [],
      questionStartTime: 0
    }, overrides);
  }

  function resetProfile() {
    Object.assign(profile, defaultProfile());
    save();
  }

  /* ═══ XP & LEVELS ═══ */
  // Cumulative XP needed to reach a given player level.
  // Lvl 1 = 0, Lvl 2 = 100, Lvl 5 ≈ 700, Lvl 10 ≈ 2500
  function xpForLevel(level) {
    if (level <= 1) return 0;
    return Math.round(100 * Math.pow(level - 1, 1.4));
  }

  function addXP(amount) {
    profile.xp += amount;
    let leveledUp = false;
    while (profile.xp >= xpForLevel(profile.playerLevel + 1)) {
      profile.playerLevel++;
      leveledUp = true;
      // Unlock fighters at level thresholds
      FIGHTERS.forEach(f => {
        if (f.unlockLevel === profile.playerLevel && !profile.unlockedFighters.includes(f.id)) {
          profile.unlockedFighters.push(f.id);
        }
      });
    }
    save();
    return leveledUp;
  }

  function addCoins(amount) {
    profile.coins += amount;
    save();
  }

  /* ═══ FIGHTERS ═══ */
  function getFighter(id) {
    return FIGHTERS.find(f => f.id === id) || FIGHTERS[0];
  }

  function equipFighter(id) {
    if (!profile.unlockedFighters.includes(id)) return false;
    profile.equippedFighter = id;
    save();
    return true;
  }

  /* ═══ CAMPAIGN ═══ */
  // Skill-tree gating: a level unlocks when its PATTERN's lesson prerequisite
  // chain is satisfied — mirroring the lesson picker exactly. Patterns with no
  // prereqs (f1, p1, p4, p6 → Converging/Sliding/Prefix) are open from the
  // start; e.g. "Exactly-K Trick" fights stay locked until BOTH Sliding
  // Window and Prefix Sum lessons are completed. Within a pattern, tiers stay
  // sequential (easy→medium→hard→boss).
  const LESSON_PREREQS_FALLBACK = {
    f1: [], p1: ['f1'], p4: ['p1'], p6: ['f1'],
    p2: ['f1'], p3: ['f1'], guard: ['f1'],
    p5: ['p3'], p7: ['p4'], x1: ['p1'], x2: ['p1', 'p2'],
    x8: ['p6'], x5: ['p4', 'p6']
  };
  function lessonPrereqs(patternId) {
    try {
      if (window.CF && CF.Lessons && typeof CF.Lessons.prereqsFor === 'function') {
        const r = CF.Lessons.prereqsFor(patternId);
        if (Array.isArray(r)) return r;
      }
    } catch (e) { /* fall through to static map */ }
    return LESSON_PREREQS_FALLBACK[patternId] || [];
  }
  function patternLessonDone(pid) {
    try {
      if (window.CF && CF.Lessons && typeof CF.Lessons.isPatternLessonDone === 'function') {
        return !!CF.Lessons.isPatternLessonDone(pid);
      }
    } catch (e) { /* ignore */ }
    const rec = profile.lessons && profile.lessons[pid];
    return !!(rec && rec.completed);
  }
  function prereqChainDone(patternId) {
    const need = lessonPrereqs(patternId);
    if (!need.length) return true;
    return need.every(p => patternLessonDone(p));
  }
  function isLevelUnlocked(levelId) {
    const levels = CF.Campaign.levels;
    const idx = levels.findIndex(l => l.id === levelId);
    if (idx <= 0) return true;   // first level always unlocked
    const lvl = levels[idx];
    if (!prereqChainDone(lvl.pattern)) return false;
    if (lvl.tier === 'easy') return true;  // pattern opened by the skill tree
    const prev = levels[idx - 1];          // tiers within a pattern stay sequential
    return !!(profile.campaignLevels[prev.id]?.cleared);
  }

  function completeCampaignLevel(levelId, stars) {
    const prev = profile.campaignLevels[levelId] || { stars: 0 };
    profile.campaignLevels[levelId] = {
      cleared: true,
      stars: Math.max(prev.stars || 0, stars),
      bestTime: prev.bestTime || 0
    };
    save();
  }

  /* ═══ STREAK ═══ */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function checkAndUpdateStreak() {
    const today = todayISO();
    const last = profile.streak.lastPlayedDate;
    if (last === today) return false;   // already counted today

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === yesterday) {
      profile.streak.current++;
    } else if (profile.streak.freezesLeft > 0 && last) {
      profile.streak.freezesLeft--;
      profile.streak.current++;
    } else {
      profile.streak.current = 1;
    }
    if (profile.streak.current > profile.streak.best) {
      profile.streak.best = profile.streak.current;
    }
    profile.streak.lastPlayedDate = today;
    save();
    return true;
  }

  /* ═══ PUBLIC API ═══ */
  return {
    profile, session, get FIGHTERS() { return FIGHTERS; },
    resetSession, resetProfile, save,
    addXP, addCoins, xpForLevel,
    getFighter, equipFighter,
    isLevelUnlocked, completeCampaignLevel,
    prereqChainDone, lessonPrereqs, patternLessonDone,
    checkAndUpdateStreak
  };
})();

/* ═══════════════════════════════════════════════════════════ */
/*  CAMPAIGN DATA — patterns × tiers = linear level list        */
/*  Content lives in data/campaign.json (edit there to add      */
/*  patterns, tiers, rewards or rename volumes). The inline     */
/*  lists below are the fallback used when the JSON can't be    */
/*  fetched (e.g. opened via file://) — keep both in sync or    */
/*  just edit the JSON.                                         */
/* ═══════════════════════════════════════════════════════════ */
CF.Campaign = (() => {
  const PATTERNS_FALLBACK = [
    { id: 'p1',    name: 'Converging',            volume: 1 },
    { id: 'p2',    name: 'Read-Write',            volume: 1 },
    { id: 'p3',    name: 'Backwards Write',       volume: 1 },
    { id: 'p4',    name: 'Sliding Window',        volume: 1 },
    { id: 'p5',    name: 'Two-Array Merge',       volume: 1 },
    { id: 'p6',    name: 'Prefix Sum',            volume: 1 },
    { id: 'p7',    name: 'Kadane',                volume: 1 },
    { id: 'guard', name: 'Guarded Skipping',      volume: 1 },
    { id: 'x1',    name: 'Three Pointers',        volume: 1 },
    { id: 'x2',    name: 'Outward Expansion',     volume: 1 },
    { id: 'x5',    name: 'Exactly-K Trick',       volume: 1 },
    { id: 'x7',    name: 'Reversals',             volume: 1 },
    { id: 'x8',    name: 'Prefix + Hash',         volume: 1 }
  ];

  const TIERS_FALLBACK = [
    { suffix: 'easy',   diff: 1, enemy: 'bot',   questions: 5, reward: { xp: 50,  coins: 20  } },
    { suffix: 'medium', diff: 2, enemy: 'bot',   questions: 6, reward: { xp: 80,  coins: 30  } },
    { suffix: 'hard',   diff: 3, enemy: 'ghost', questions: 7, reward: { xp: 120, coins: 45  } },
    { suffix: 'boss',   diff: 3, enemy: 'boss',  questions: 8, reward: { xp: 200, coins: 100 } }
  ];

  const VOLUME_NAMES_FALLBACK = {
    1: 'Arrays & Strings',
    2: 'Binary Search & Ranges',
    3: 'Hash, Stack, Heap',
    4: 'Linked Lists, Trees & Tries',
    5: 'Graphs & Grids',
    6: 'Dynamic Programming',
    7: 'Recursion, Greedy, Bits & Math'
  };

  let PATTERNS = PATTERNS_FALLBACK;
  let TIERS = TIERS_FALLBACK;
  let volumeNames = VOLUME_NAMES_FALLBACK;

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // levels is rebuilt whenever the content changes so consumers that hold a
  // reference to CF.Campaign.levels always see the current table.
  const levels = [];
  function rebuildLevels() {
    levels.length = 0;
    PATTERNS.forEach((p, i) => {
      TIERS.forEach((t, j) => {
        levels.push({
          id: `${p.id}-${t.suffix}`,
          pattern: p.id,
          patternName: p.name,
          volume: p.volume,
          name: `${p.name} · ${capitalize(t.suffix)}`,
          tier: t.suffix,
          diff: t.diff,
          enemy: t.enemy,
          questions: t.questions,
          reward: t.reward,
          order: i * TIERS.length + j
        });
      });
    });
  }
  rebuildLevels();

  // Async content injection: swap in data/campaign.json if available.
  if (window.CF && CF.Content) {
    CF.Content.load('data/campaign.json').then(d => {
      if (!d) return;                       // keep fallbacks
      if (Array.isArray(d.patterns) && d.patterns.length) PATTERNS = d.patterns;
      if (Array.isArray(d.tiers) && d.tiers.length)       TIERS = d.tiers;
      if (d.volumeNames)                    volumeNames = d.volumeNames;
      rebuildLevels();
    });
  }

  return {
    levels,
    get patterns() { return PATTERNS; },
    get tiers() { return TIERS; },
    get volumeNames() { return volumeNames; }
  };
})();
