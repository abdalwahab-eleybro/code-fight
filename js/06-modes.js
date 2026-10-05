/* ═══════════════════════════════════════════════════════════ */
/*  06-modes.js — Archetypes, boss mechanics, mode configs     */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Modes = (() => {

  /* ═══════════════════════════════════════════════════════ */
  /*  ARCHETYPES                                              */
  /* ═══════════════════════════════════════════════════════ */
  // hpMult / dmgMult scale the base fight.
  // restrictions: array of rule tags the engine reads.
  const ARCHETYPES = {
    bot:       { icon: '👾', name: 'Bot',       hpMult: 1.0, dmgMult: 1.0, restrictions: [],
                 flavor: 'Standard opponent' },
    ghost:     { icon: '👻', name: 'Ghost',     hpMult: 1.0, dmgMult: 1.0, restrictions: ['no-mcq'],
                 flavor: 'Absorbs multiple-choice damage' },
    tank:      { icon: '🛡️', name: 'Tank',      hpMult: 1.5, dmgMult: 0.7, restrictions: [],
                 flavor: '+50% HP, −30% damage dealt' },
    berserker: { icon: '🐺', name: 'Berserker', hpMult: 0.7, dmgMult: 1.5, restrictions: [],
                 flavor: '−30% HP, +50% damage dealt' },
    sorcerer:  { icon: '🧙', name: 'Sorcerer',  hpMult: 1.0, dmgMult: 1.0, restrictions: ['curse-one'],
                 flavor: 'Curses one wrong choice per question' },
    boss:      { icon: '🐉', name: 'Boss',      hpMult: 2.0, dmgMult: 1.0, restrictions: [],
                 flavor: 'Pattern-specific mechanics' }
  };

  /* ═══════════════════════════════════════════════════════ */
  /*  BOSS MECHANICS PER PATTERN                              */
  /* ═══════════════════════════════════════════════════════ */
  const BOSS_MECHANICS = {
    p1: {
      name: 'The Drifter',
      icon: '🦂',
      desc: 'Only Pattern Recognition questions damage the shield.',
      rule: 'shield_pattern_only'
    },
    p2: {
      name: 'The Hoarder',
      icon: '🐙',
      desc: 'Wrong answers heal the boss for 8 HP.',
      rule: 'heal_on_wrong',
      heal: 8
    },
    p3: {
      name: 'The Mirror',
      icon: '🪞',
      desc: 'All questions render in reverse order.',
      rule: 'reverse_order'
    },
    p4: {
      name: 'Windwalker',
      icon: '🌪️',
      desc: 'Question timer shrinks 1s each round.',
      rule: 'shrinking_timer',
      startTimer: 15,
      decrement: 1
    },
    p5: {
      name: 'Twin Fangs',
      icon: '🐍',
      desc: 'Boss alternates between two question types.',
      rule: 'alternate_types'
    },
    p6: {
      name: 'The Keeper',
      icon: '🗿',
      desc: 'Boss cannot die before round 6.',
      rule: 'min_rounds',
      minRounds: 6
    },
    p7: {
      name: 'Nullpointer',
      icon: '😈',
      desc: 'Wrong answers deal 3× damage.',
      rule: 'triple_wrong_damage'
    },
    guard: {
      name: 'The Gatekeeper',
      icon: '🛡️',
      desc: 'Must answer two in a row correctly to deal damage.',
      rule: 'streak_2'
    },
    x1: {
      name: 'Trinity',
      icon: '🔺',
      desc: 'Only hard questions (difficulty 3).',
      rule: 'hard_only'
    },
    x2: {
      name: 'The Expander',
      icon: '🌊',
      desc: 'Timer shrinks by 1s every correct answer.',
      rule: 'shrinking_timer',
      startTimer: 18,
      decrement: 1
    },
    x5: {
      name: 'The Counter',
      icon: '🔢',
      desc: 'Boss heals 5 HP every time you use a hint.',
      rule: 'heal_on_hint',
      heal: 5
    },
    x7: {
      name: 'The Rotator',
      icon: '🌀',
      desc: 'Order questions are shuffled after every answer.',
      rule: 'shuffle_order'
    },
    x8: {
      name: 'The Hasher',
      icon: '🔐',
      desc: 'Wrong answers lock one button for the next question.',
      rule: 'lock_button'
    }
  };

  /* ═══════════════════════════════════════════════════════ */
  /*  MODES                                                   */
  /* ═══════════════════════════════════════════════════════ */
  const MODES = {
    campaign: {
      id: 'campaign',
      label: 'Campaign',
      questionCount: 6,           // default, overridden by level
      timerPerQuestion: null,     // elapsed, no timeout
      showStars: true,
      persistsProgress: true
    },
    blitz: {
      id: 'blitz',
      label: 'Blitz',
      questionCount: 10,
      timerPerQuestion: 10000,    // 10 seconds hard timeout
      showStars: false,
      persistsProgress: false
    }
  };

  /* ═══════════════════════════════════════════════════════ */
  /*  HELPERS                                                 */
  /* ═══════════════════════════════════════════════════════ */

  function getArchetype(id) {
    return ARCHETYPES[id] || ARCHETYPES.bot;
  }

  function getBossMechanic(patternId) {
    return BOSS_MECHANICS[patternId] || null;
  }

  /* Take a campaign level and produce a config ready for the engine.
     Applies archetype multipliers and boss mechanics. */
  function configureLevel(level) {
    const archetype = getArchetype(level.enemy);
    const isBoss = level.tier === 'boss';
    const bossMech = isBoss ? getBossMechanic(level.pattern) : null;

    const baseEnemyHP = isBoss ? 200 : 100;
    const baseEnemyDamage = 15 + (level.diff - 1) * 3;

    return {
      ...level,
      archetype,
      bossMech,
      enemyHP: Math.round(baseEnemyHP * archetype.hpMult),
      enemyMaxHP: Math.round(baseEnemyHP * archetype.hpMult),
      enemyDamage: Math.round(baseEnemyDamage * archetype.dmgMult),
      timerPerQuestion: bossMech?.rule === 'shrinking_timer' ? bossMech.startTimer * 1000 : null,
      questionCount: level.questions
    };
  }

  /* Configure a Blitz run. Pulls random questions across all unlocked patterns. */
  function configureBlitz() {
    const S = CF.State;
    const C = CF.Campaign;
    const L = CF.CampaignLogic;

    // Only patterns the player has unlocked at least one level in
    const unlockedPatterns = [...new Set(C.levels
      .filter(l => S.isLevelUnlocked(l.id))
      .map(l => l.pattern))];

    // Total questions solved = rough progression indicator
    const solved = Object.values(S.profile.campaignLevels)
      .reduce((sum, r) => sum + (r.cleared ? 1 : 0), 0);

    // Difficulty scales with progression
    const maxDiff = solved >= 15 ? 3 : solved >= 6 ? 2 : 1;

    return {
      id: 'blitz',
      name: 'Blitz Run',
      pattern: null,                  // mixed
      patternName: 'Random',
      volume: 1,
      tier: 'blitz',
      diff: maxDiff,
      enemy: 'berserker',
      questions: MODES.blitz.questionCount,
      reward: { xp: 60 + solved * 4, coins: 25 + solved * 2 },
      unlockedPatterns,
      timerPerQuestion: MODES.blitz.timerPerQuestion,
      archetype: ARCHETYPES.berserker,
      bossMech: null,
      enemyHP: 100,
      enemyMaxHP: 100,
      enemyDamage: 18
    };
  }

  return {
    ARCHETYPES,
    BOSS_MECHANICS,
    MODES,
    getArchetype,
    getBossMechanic,
    configureLevel,
    configureBlitz
  };
})();
