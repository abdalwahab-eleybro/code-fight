/* ═══════════════════════════════════════════════════════════ */
/*  07-spaced.js — Spaced repetition + weak spot analyzer      */
/*  Depends on: 01-state.js, 03-questions.js                    */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Spaced = (() => {
  const S = CF.State;
  const Q = CF.Questions;

  /* ═══════════════════════════════════════════════════════ */
  /*  INTERVALS — strength → ms until next review              */
  /* ═══════════════════════════════════════════════════════ */
  const HOUR = 3600 * 1000;
  const DAY  = 24 * HOUR;
  const INTERVALS = [
    4 * HOUR,     // strength 0 — just failed, see again soon
    1 * DAY,      // strength 1
    3 * DAY,      // strength 2
    7 * DAY,      // strength 3
    14 * DAY,     // strength 4
    30 * DAY      // strength 5 — mastered
  ];

  function nextDueAt(strength, fromTime) {
    const interval = INTERVALS[Math.min(strength, INTERVALS.length - 1)];
    return (fromTime || Date.now()) + interval;
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  RECORD ANSWER                                           */
  /* ═══════════════════════════════════════════════════════ */
  function recordAnswer(q, correct, hintUsed) {
    if (!q || !q.id) return;
    const now = Date.now();
    const history = S.profile.questionHistory;
    const entry = history[q.id] || { strength: 0, lastSeen: 0, attempts: 0, correct: 0 };

    entry.lastSeen = now;
    entry.attempts++;

    if (correct && !hintUsed) {
      entry.correct++;
      entry.strength = Math.min(5, (entry.strength || 0) + 1);
    } else if (correct && hintUsed) {
      entry.correct++;
      // Hint means partial credit — no strength gain, no loss
    } else {
      entry.strength = Math.max(0, (entry.strength || 0) - 2);
    }

    entry.dueAt = nextDueAt(entry.strength, now);
    history[q.id] = entry;

    // Update pattern stats (for weak spot recommender)
    const pStats = S.profile.patternStats[q.pattern] || { wrong: [], correct: 0 };
    if (correct) {
      pStats.correct++;
    } else {
      pStats.wrong.push(now);
      // Keep only last 30 days of wrong answers
      const cutoff = now - 30 * DAY;
      pStats.wrong = pStats.wrong.filter(t => t > cutoff);
    }
    S.profile.patternStats[q.pattern] = pStats;

    S.save();
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  GET DUE QUESTIONS                                       */
  /* ═══════════════════════════════════════════════════════ */
  function getDueQuestions(limit) {
    const now = Date.now();
    const history = S.profile.questionHistory;
    const due = [];

    Object.keys(history).forEach(id => {
      const entry = history[id];
      if (!entry.dueAt) return;
      if (entry.dueAt > now) return;
      const q = Q.getById(id);
      if (q) due.push({ q, entry });
    });

    // Sort by weakest first, then oldest due
    due.sort((a, b) => {
      if (a.entry.strength !== b.entry.strength) return a.entry.strength - b.entry.strength;
      return a.entry.dueAt - b.entry.dueAt;
    });

    return due.map(d => d.q).slice(0, limit || 5);
  }

  function countDue() {
    return getDueQuestions(999).length;
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  BLEND QUESTIONS FOR A FIGHT                             */
  /* ═══════════════════════════════════════════════════════ */
  // Campaign levels: 70% pattern-specific + 30% due review (if any due).
  function pickWithReview(config) {
    const total = config.questions || 6;
    const dueCount = Math.min(Math.floor(total * 0.3), countDue());
    const dueQs = dueCount > 0 ? getDueQuestions(dueCount) : [];
    const dueIds = new Set(dueQs.map(q => q.id));

    // Fill remaining slots from the pattern pool, excluding due ones.
    // INTERLEAVING (research: mixed-family practice transfers better than blocked):
    // ~40% of fresh slots come from OTHER patterns already exposed to the learner —
    // forcing classification ("which pattern is this?") before solving.
    const need = total - dueQs.length;
    let ownPool = Q.BANK.filter(q =>
      q.pattern === config.pattern &&
      q.difficulty <= (config.diff || 3) &&
      !dueIds.has(q.id)
    );
    if (ownPool.length < need) {
      ownPool = Q.BANK.filter(q => q.pattern === config.pattern && !dueIds.has(q.id));
    }
    const ownCount = Math.max(2, Math.ceil(need * 0.6));
    const own = Q.shuffle(ownPool).slice(0, ownCount);
    const used = new Set(dueIds);
    own.forEach(q => used.add(q.id));

    // Mixed families: prefer patterns whose LESSON the learner has completed
    // (exposed), fall back to any other pattern at allowed difficulty.
    let doneLessons = {};
    try { doneLessons = S.profile.lessons || {}; } catch (e) {}
    const isExposed = pid => { try { return !!(doneLessons[pid] && doneLessons[pid].completed); } catch (e) { return false; } };
    let mixPool = Q.BANK.filter(q =>
      q.pattern !== config.pattern &&
      q.difficulty <= (config.diff || 3) &&
      !used.has(q.id) && isExposed(q.pattern)
    );
    if (mixPool.length < need - own.length) {
      mixPool = Q.BANK.filter(q => q.pattern !== config.pattern && q.difficulty <= (config.diff || 3) && !used.has(q.id));
    }
    if (!mixPool.length) mixPool = Q.BANK.filter(q => q.pattern !== config.pattern && !used.has(q.id));
    const mixed = Q.shuffle(mixPool).slice(0, Math.max(0, need - own.length));
    return Q.shuffle([...dueQs, ...own, ...mixed]);
  }

  // Review run: pure due questions
  function pickReviewQuestions(limit) {
    return getDueQuestions(limit || 5);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  WEAK SPOT ANALYZER                                      */
  /* ═══════════════════════════════════════════════════════ */
  const WINDOW_MS = 7 * DAY;

  function findWeakSpots() {
    const cutoff = Date.now() - WINDOW_MS;
    const out = [];

    Object.keys(S.profile.patternStats).forEach(pid => {
      const stats = S.profile.patternStats[pid];
      const recentWrong = (stats.wrong || []).filter(t => t > cutoff).length;
      const totalAttempts = recentWrong + (stats.correct || 0);
      if (recentWrong < 3) return;

      const accuracy = totalAttempts > 0 ? stats.correct / totalAttempts : 0;
      if (accuracy >= 0.6) return;

      out.push({
        patternId: pid,
        patternName: getPatternName(pid),
        wrongCount: recentWrong,
        accuracy: Math.round(accuracy * 100)
      });
    });

    return out.sort((a, b) => b.wrongCount - a.wrongCount);
  }

  function getPatternName(pid) {
    const C = CF.Campaign;
    const pattern = C.levels.find(l => l.pattern === pid);
    return pattern ? pattern.patternName : pid;
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  STATS FOR UI                                            */
  /* ═══════════════════════════════════════════════════════ */
  function getStats() {
    const history = S.profile.questionHistory;
    const ids = Object.keys(history);
    let mastered = 0, learning = 0, struggling = 0;
    ids.forEach(id => {
      const s = history[id].strength || 0;
      if (s >= 4) mastered++;
      else if (s >= 2) learning++;
      else struggling++;
    });
    return { total: ids.length, mastered, learning, struggling, due: countDue() };
  }

  function resetAll() {
    S.profile.questionHistory = {};
    S.profile.patternStats = {};
    S.save();
  }

  return {
    recordAnswer,
    getDueQuestions,
    countDue,
    pickWithReview,
    pickReviewQuestions,
    findWeakSpots,
    getStats,
    resetAll,
    nextDueAt
  };
})();
