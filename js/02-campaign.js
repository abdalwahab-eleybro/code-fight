/* ═══════════════════════════════════════════════════════════ */
/*  02-campaign.js — Star calc, progression rules, tooltips    */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.CampaignLogic = (() => {
  const S = CF.State;
  const C = CF.Campaign;

  /* ═══ STAR CALCULATION ═══ */
  // 3 stars = 100% accuracy
  // 2 stars = ≥ 80%
  // 1 star  = win (any accuracy)
  // 0 stars = loss
  function calcStars(won, accuracy) {
    if (!won) return 0;
    if (accuracy >= 1.0) return 3;
    if (accuracy >= 0.8) return 2;
    return 1;
  }

  /* ═══ LEVEL LOOKUP ═══ */
  function getLevel(levelId) {
    return C.levels.find(l => l.id === levelId);
  }

  function getLevelIndex(levelId) {
    return C.levels.findIndex(l => l.id === levelId);
  }

  function getNextLevel(levelId) {
    const idx = getLevelIndex(levelId);
    if (idx < 0 || idx >= C.levels.length - 1) return null;
    return C.levels[idx + 1];
  }

  function getPrevLevel(levelId) {
    const idx = getLevelIndex(levelId);
    if (idx <= 0) return null;
    return C.levels[idx - 1];
  }

  /* ═══ UNLOCK REASONING ═══ */
  // Returns a human-readable reason why a level is locked (or null if unlocked).
  function lockedReason(levelId) {
    if (S.isLevelUnlocked(levelId)) return null;
    const prev = getPrevLevel(levelId);
    if (!prev) return null;
    return `Clear "${prev.name}" first`;
  }

  /* ═══ COMPLETE A LEVEL ═══ */
  // Called from the fight loop when a fight ends.
  // session = { correct, answered, playerHP, enemyHP, ... }
  function completeFight(levelId, won, session, elapsedMs) {
    const lvl = getLevel(levelId);
    if (!lvl) return { stars: 0, xpGained: 0, coinsGained: 0, unlocks: [] };

    const accuracy = session.answered > 0 ? session.correct / session.answered : 0;
    const stars = calcStars(won, accuracy);

    const result = {
      stars,
      xpGained: 0,
      coinsGained: 0,
      unlockedFighters: [],
      newBest: false,
      newBestTime: false
    };

    if (!won) return result;

    // Base rewards
    let xp = lvl.reward.xp;
    let coins = lvl.reward.coins;

    // Accuracy bonus: +2% XP per % above 60%
    if (accuracy > 0.6) xp = Math.round(xp * (1 + (accuracy - 0.6) * 0.05));

    // Perfect answers bonus
    xp += session.perfectAnswers * 5;

    // Star bonus: 3★ = +20% XP, 2★ = +10%
    if (stars === 3) xp = Math.round(xp * 1.2);
    else if (stars === 2) xp = Math.round(xp * 1.1);

    // Boss bonus
    if (lvl.tier === 'boss') xp += 100;

    // Update campaign record
    const prevRecord = S.profile.campaignLevels[levelId] || { stars: 0, bestTime: 0 };
    const prevStars = prevRecord.stars || 0;
    const prevBestTime = prevRecord.bestTime || 0;

    // Only award full XP/coins on first clear OR when beating best stars
    const firstClear = !prevRecord.cleared;
    const improved = stars > prevStars;

    if (firstClear || improved) {
      result.xpGained = xp;
      result.coinsGained = coins;
      const leveledUp = S.addXP(xp);
      S.addCoins(coins);
      if (leveledUp) {
        result.unlockedFighters = S.FIGHTERS.filter(f =>
          f.unlockLevel <= S.profile.playerLevel &&
          S.profile.unlockedFighters.includes(f.id)
        );
      }
    } else {
      // Repeat clear: 25% XP, no coins
      result.xpGained = Math.round(xp * 0.25);
      S.addXP(result.xpGained);
    }

    // Track best time
    if (!prevBestTime || elapsedMs < prevBestTime) {
      result.newBestTime = true;
      result.newBest = true;
    }

    // Persist
    S.profile.campaignLevels[levelId] = {
      cleared: true,
      stars: Math.max(prevStars, stars),
      bestTime: result.newBestTime ? elapsedMs : prevBestTime
    };
    S.save();

    return result;
  }

  /* ═══ VOLUME PREVIEW ═══ */
  // Static descriptions of upcoming volumes, shown as locked preview cards.
  function getFutureVolumes() {
    return [
      { num: 2, name: 'Binary Search & Ranges', icon: '🎯', patterns: 'Binary Search · Rotated Search · Merge Intervals · Matrix Traversal', eta: 'Planned' },
      { num: 3, name: 'Hash, Stack, Heap', icon: '📚', patterns: 'Hash Lookup · Monotonic Stack · Top-K Heap · Two Heaps', eta: 'Planned' },
      { num: 4, name: 'Linked Lists, Trees & Tries', icon: '🌳', patterns: 'Fast/Slow · In-Place Reversal · Tree DFS/BFS · Trie · Segment Tree', eta: 'Planned' },
      { num: 5, name: 'Graphs & Grids', icon: '🕸️', patterns: 'Graph BFS/DFS · Topological Sort · Union-Find · Dijkstra', eta: 'Planned' },
      { num: 6, name: 'Dynamic Programming', icon: '🧮', patterns: '1D/2D DP · Knapsack · LIS · LCS · Interval DP', eta: 'Planned' },
      { num: 7, name: 'Recursion, Greedy, Bits & Math', icon: '🧠', patterns: 'Subsets · Backtracking · Greedy · XOR Tricks · Number Theory', eta: 'Planned' }
    ];
  }

  /* ═══ TIER ICONS ═══ */
  function tierIcon(tier, cleared, unlocked) {
    if (cleared) return '✓';
    if (!unlocked) return '🔒';
    if (tier === 'boss') return '🐉';
    if (tier === 'hard') return '⚔️';
    if (tier === 'medium') return '🎯';
    return '▶';
  }

  function tierEnemyIcon(enemy) {
    return { bot: '👾', ghost: '👻', boss: '🐉' }[enemy] || '👾';
  }

  function formatTime(ms) {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${s}s`;
  }

  /* ═══ PROGRESS STATS ═══ */
  function getProgressSummary() {
    const total = C.levels.length;
    const cleared = Object.values(S.profile.campaignLevels).filter(l => l.cleared).length;
    const totalStars = Object.values(S.profile.campaignLevels).reduce((sum, l) => sum + (l.stars || 0), 0);
    const maxStars = total * 3;
    return { total, cleared, totalStars, maxStars, percent: Math.round((cleared / total) * 100) };
  }

  /* ═══ CURRENT LEVEL ═══ */
  // First unlocked-but-not-cleared level
  function getNextSuggestedLevel() {
    for (const lvl of C.levels) {
      if (!S.profile.campaignLevels[lvl.id]?.cleared && S.isLevelUnlocked(lvl.id)) {
        return lvl;
      }
    }
    return null;
  }

  return {
    calcStars, getLevel, getNextLevel, getPrevLevel,
    lockedReason, completeFight, getFutureVolumes,
    tierIcon, tierEnemyIcon, formatTime,
    getProgressSummary, getNextSuggestedLevel
  };
})();
