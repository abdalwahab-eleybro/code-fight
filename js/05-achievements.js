/* ═══════════════════════════════════════════════════════════ */
/*  05-achievements.js — Badge definitions + checker           */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Achievements = (() => {
  const S = CF.State;

  /* ═══════════════════════════════════════════════════════ */
  /*  BADGE DEFINITIONS                                       */
  /* ═══════════════════════════════════════════════════════ */
  const BADGES = [
    /* ── First-time achievements ── */
    { id: 'first_blood', name: 'First Blood', icon: '🩸', rarity: 'common',
      description: 'Win your first fight',
      check: (ctx) => ctx.won && Object.keys(S.profile.campaignLevels).length === 1 },

    { id: 'getting_started', name: 'Getting Started', icon: '🌱', rarity: 'common',
      description: 'Clear 5 campaign levels',
      check: () => Object.values(S.profile.campaignLevels).filter(l => l.cleared).length >= 5 },

    { id: 'pattern_pioneer', name: 'Pattern Pioneer', icon: '🧭', rarity: 'silver',
      description: 'Clear the first tier of any pattern',
      check: () => Object.keys(S.profile.campaignLevels).some(id => id.endsWith('-easy') && S.profile.campaignLevels[id].cleared) },

    /* ── Skill achievements ── */
    { id: 'no_hints', name: 'No Hints, No Mercy', icon: '🥇', rarity: 'silver',
      description: 'Win a fight without using hints or skips',
      check: (ctx) => ctx.won && ctx.session.hintsUsed === 0 },

    { id: 'perfect_fight', name: 'Flawless Victory', icon: '👑', rarity: 'gold',
      description: 'Win without taking any damage',
      check: (ctx) => ctx.won && ctx.session.playerHP === ctx.session.maxPlayerHP },

    { id: 'combo_king', name: 'Combo King', icon: '🔥', rarity: 'gold',
      description: 'Hit a 10-answer combo',
      check: (ctx) => ctx.session.maxCombo >= 10 },

    { id: 'speed_demon', name: 'Speed Demon', icon: '💨', rarity: 'silver',
      description: 'Answer 5 questions at PERFECT tier in one fight',
      check: (ctx) => ctx.session.perfectAnswers >= 5 },

    { id: 'off_by_one', name: 'Off-By-One Survivor', icon: '🩸', rarity: 'gold',
      description: 'Win with exactly 1 HP remaining',
      check: (ctx) => ctx.won && ctx.session.playerHP === 1 },

    { id: 'accuracy_king', name: 'Sharpshooter', icon: '🎯', rarity: 'silver',
      description: 'Finish a fight with 100% accuracy (4+ questions)',
      check: (ctx) => ctx.won && ctx.session.answered >= 4 && ctx.session.correct === ctx.session.answered },

    /* ── Progression achievements ── */
    { id: 'boss_slayer', name: 'Boss Slayer', icon: '⚔️', rarity: 'silver',
      description: 'Defeat any boss level',
      check: (ctx) => ctx.won && ctx.level?.tier === 'boss' },

    { id: 'pattern_master', name: 'Pattern Master', icon: '🧱', rarity: 'gold',
      description: 'Clear all four tiers of any pattern',
      check: () => {
        const tiers = ['easy', 'medium', 'hard', 'boss'];
        const patterns = [...new Set(Object.keys(S.profile.campaignLevels)
          .filter(id => S.profile.campaignLevels[id].cleared)
          .map(id => id.split('-')[0]))];
        return patterns.some(p => tiers.every(t => S.profile.campaignLevels[`${p}-${t}`]?.cleared));
      } },

    { id: 'volume_1', name: 'Volume 1 Champion', icon: '🏆', rarity: 'platinum',
      description: 'Clear every level in Volume 1',
      check: () => {
        const C = CF.Campaign;
        return C.levels.filter(l => l.volume === 1)
          .every(l => S.profile.campaignLevels[l.id]?.cleared);
      } },

    { id: 'all_stars', name: 'Perfectionist', icon: '⭐', rarity: 'platinum',
      description: 'Earn 3 stars on 10 different levels',
      check: () => Object.values(S.profile.campaignLevels).filter(l => l.stars === 3).length >= 10 },

    /* ── Streak achievements ── */
    { id: 'streak_3', name: 'Warming Up', icon: '🔥', rarity: 'common',
      description: 'Play 3 days in a row',
      check: () => S.profile.streak.current >= 3 },

    { id: 'streak_7', name: 'Week Warrior', icon: '🗓️', rarity: 'silver',
      description: 'Play 7 days in a row',
      check: () => S.profile.streak.current >= 7 },

    /* ── Level achievements ── */
    { id: 'level_5', name: 'Rising Star', icon: '⭐', rarity: 'common',
      description: 'Reach player level 5',
      check: () => S.profile.playerLevel >= 5 },

    { id: 'level_10', name: 'Veteran', icon: '💫', rarity: 'silver',
      description: 'Reach player level 10',
      check: () => S.profile.playerLevel >= 10 }
  ];

  /* ═══════════════════════════════════════════════════════ */
  /*  CHECK FOR NEW UNLOCKS                                   */
  /* ═══════════════════════════════════════════════════════ */
  // Returns array of newly unlocked badge objects.
  function checkAll(ctx) {
    const unlocked = [];
    BADGES.forEach(badge => {
      if (S.profile.achievements[badge.id]) return;   // already unlocked
      try {
        if (badge.check(ctx)) {
          S.profile.achievements[badge.id] = Date.now();
          unlocked.push(badge);
        }
      } catch (e) {
        console.warn('Achievement check failed:', badge.id, e);
      }
    });
    if (unlocked.length) S.save();
    return unlocked;
  }

  function getAllUnlocked() {
    return BADGES.filter(b => S.profile.achievements[b.id]);
  }

  function getAllLocked() {
    return BADGES.filter(b => !S.profile.achievements[b.id]);
  }

  function getBadge(id) {
    return BADGES.find(b => b.id === id);
  }

  return { BADGES, checkAll, getAllUnlocked, getAllLocked, getBadge };
})();
