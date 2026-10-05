/* ═══════════════════════════════════════════════════════════ */
/*  17-rewards.js — Variable-Reward Chests                     */
/*                                                              */
/*  Psychology: unpredictable rewards produce stronger dopamine */
/*  response than predictable ones (Skinner's variable-ratio    */
/*  schedules). Completing a daily module therefore opens a     */
/*  MYSTERY CHEST whose contents are rolled at open-time, with  */
/*  rarity-weighted odds:                                       */
/*    · common      (~62%) — XP boosts (multipliers & flat XP), */
/*                           coins, streak freeze               */
/*    · rare         (~24%) — profile badges                   */
/*    · epic         (~10%) — collectible avatars (equippable)  */
/*    · legendary    (~4%)  — mega XP multiplier + badge        */
/*  The near-miss suspense roll is short (~1.5 s) so the loop   */
/*  stays satisfying, never annoying.                            */
/*                                                              */
/*  State lives in CF.State.profile.rewards = {                 */
/*    chestsClaimed, chestStreak, badges: {}, avatars: [],       */
/*    equippedAvatar, xpMultiplier, xpBoostUntil }              */
/*                                                              */
/*  Depends on: 01-state.js · 13-visualizer.js (CF.Sonify)      */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Rewards = (() => {
  const S = CF.State;

  /* ── normalized state accessor (self-heals old profiles) ── */
  function st() {
    const p = S.profile;
    if (!p.rewards || typeof p.rewards !== 'object') {
      p.rewards = {
        chestsClaimed: 0,
        chestStreak: 0,          // consecutive days a chest was opened
        lastChestDate: null,     // ISO day of last chest
        badges: {},              // id → first-earned ts
        avatars: [],             // collected avatar ids
        equippedAvatar: null,
        xpMultiplier: 1,
        xpBoostUntil: 0          // ms timestamp — timed ×2 window
      };
    }
    const r = p.rewards;
    r.badges = r.badges || {};
    r.avatars = r.avatars || [];
    if (typeof r.chestsClaimed !== 'number') r.chestsClaimed = 0;
    if (typeof r.chestStreak !== 'number') r.chestStreak = 0;
    if (typeof r.xpMultiplier !== 'number' || r.xpMultiplier < 1) r.xpMultiplier = 1;
    return r;
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /* ── XP boost window: active until xpBoostElapsedAt? ── */
  function boostActive() {
    const r = st();
    return r.xpMultiplier > 1 && Date.now() < (r.xpBoostUntil || 0);
  }
  function currentMultiplier() {
    return boostActive() ? st().xpMultiplier : 1;
  }
  /* Apply the chest multiplier to any XP amount (called by the lesson reward). */
  function applyXPBoost(xp) {
    const m = currentMultiplier();
    return Math.round((xp || 0) * m);
  }
  function boostRemainingSec() {
    if (!boostActive()) return 0;
    return Math.max(0, Math.round(((st().xpBoostUntil || 0) - Date.now()) / 1000));
  }

  /* ═════════ REWARD TABLES (data — tune odds here) ═════════ */
  const AVATARS = [
    { id: 'av-cybercat',   name: 'Cyber-Cat',     icon: '🐱‍👤' },
    { id: 'av-alien',      name: 'Byte Alien',    icon: '👽' },
    { id: 'av-robot',      name: 'Rust-Bucket',   icon: '🤖' },
    { id: 'av-jacko',      name: 'Jack-o-Stack',  icon: '🎃' },
    { id: 'av-unicorn',    name: 'Unic0de',       icon: '🦄' },
    { id: 'av-turtle',     name: 'Cache Turtle',  icon: '🐢' },
    { id: 'av-fox',        name: 'Firefox (the original)', icon: '🦊' },
    { id: 'av-dragon',     name: 'Segfault Dragon', icon: '🐲' },
    { id: 'av-ghost',      name: 'Null Pointer',  icon: '👻' },
    { id: 'av-rocket',     name: 'Zero-to-Hero',  icon: '🚀' }
  ];
  const BADGES = [
    { id: 'bd-nightowl',   name: 'Night-Owl Coder', icon: '🦉', desc: 'Opened a chest after dark.' },
    { id: 'bd-streak3',    name: 'Triple Threat',   icon: '⚡', desc: '3-day chest streak.' },
    { id: 'bd-collector',  name: 'Avatar Collector',icon: '🗂️', desc: 'Collected 3+ avatars from chests.' },
    { id: 'bd-lucky',      name: 'Lucky Loop',      icon: '🍀', desc: 'Rolled a legendary chest.' },
    { id: 'bd-brain',      name: 'Spaced Repetitioner', icon: '🧠', desc: 'Completed a review run the same day as a chest.' },
    { id: 'bd-firstchest', name: 'Mystery Starter', icon: '📦', desc: 'Opened your very first chest.' }
  ];

  /* Weighted pool. `dupSafe` items reroll when already owned. */
  const POOL = [
    { rarity: 'common', w: 30, kind: 'xpmult', mult: 1.5, hours: 2,   label: '×1.5 XP for 2 hours' },
    { rarity: 'common', w: 22, kind: 'coins',  min: 15, max: 40,      label: 'Coin pouch' },
    { rarity: 'common', w: 12, kind: 'xpflat', min: 25, max: 60,      label: 'Instant XP' },
    { rarity: 'common', w: 8,  kind: 'freeze', n: 1,                  label: 'Streak Freeze +1' },
    { rarity: 'rare',   w: 14, kind: 'badge',                          dupSafe: true, label: 'Profile badge' },
    { rarity: 'epic',   w: 6,  kind: 'xpmult', mult: 2, hours: 24,    label: '×2 XP for 24 hours' },
    { rarity: 'epic',   w: 5,  kind: 'avatar',                         dupSafe: true, label: 'Collectible avatar' },
    { rarity: 'legendary', w: 3, kind: 'jackpot', mult: 3, minutes: 30, xp: 200, coins: 150, dupSafe: true, label: 'JACKPOT: ×3 XP + 200 XP + 150 🪙' }
  ];
  const TOTAL_W = POOL.reduce((a, x) => a + x.w, 0);

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  /* Roll one prize. Duplicate-safe: if an owned-only item hits and nothing
     else is missing, downgrade gracefully instead of showing "you got… the
     thing you already have" (which kills the dopamine loop). */
  function rollPrize() {
    const r = st();
    let tries = 0;
    while (tries++ < 12) {
      let t = Math.random() * TOTAL_W;
      let pick = null;
      for (const it of POOL) { t -= it.w; if (t <= 0) { pick = it; break; } }
      if (!pick) pick = POOL[0];

      if (pick.kind === 'badge') {
        const missing = BADGES.filter(b => !r.badges[b.id]);
        if (!missing.length) continue;                       // all owned → reroll
        const b = missing[Math.floor(Math.random() * missing.length)];
        return { rarity: 'rare', kind: 'badge', badge: b,
                 title: `${b.icon} ${b.name}`, sub: b.desc };
      }
      if (pick.kind === 'avatar') {
        const missing = AVATARS.filter(a => !r.avatars.includes(a.id));
        if (!missing.length) {                               // collector complete
          return { rarity: 'epic', kind: 'xpflat', amount: 150,
                   title: '💎 150 XP', sub: 'Full avatar collection — converted!' };
        }
        const a = missing[Math.floor(Math.random() * missing.length)];
        return { rarity: 'epic', kind: 'avatar', avatar: a,
                 title: `${a.icon} ${a.name}`, sub: 'New collectible avatar — equip it below!' };
      }
      if (pick.kind === 'jackpot') {
        if (r.badges['bd-lucky']) return { rarity: 'legendary', kind: 'xpmult', mult: 3, hours: 24,
                 title: '🌟 ×3 XP for 24 hours', sub: 'Legendary boost re-rolled (badge already yours).' };
        return { rarity: 'legendary', kind: 'jackpot',
                 title: '🎰 JACKPOT!', sub: `×${pick.mult} XP for ${pick.minutes} min · +${pick.xp} XP · +${pick.coins} 🪙` };
      }
      if (pick.kind === 'xpmult') {
        const hrs = pick.hours || 24;
        return { rarity: pick.rarity, kind: 'xpmult', mult: pick.mult, hours: hrs,
                 title: `✨ ×${pick.mult} XP for ${hrs}h`, sub: 'Every XP gain is boosted while it lasts.' };
      }
      if (pick.kind === 'coins') {
        const n = randInt(pick.min, pick.max);
        return { rarity: 'common', kind: 'coins', amount: n,
                 title: `🪙 ${n} Coins`, sub: 'Spend them in the Shop.' };
      }
      if (pick.kind === 'xpflat') {
        const n = randInt(pick.min, pick.max);
        return { rarity: 'common', kind: 'xpflat', amount: n,
                 title: `⚡ +${n} XP`, sub: 'Applied instantly.' };
      }
      if (pick.kind === 'freeze') {
        return { rarity: 'common', kind: 'freeze', amount: 1,
                 title: '❄️ Streak Freeze +1', sub: 'Insurance for one missed day.' };
      }
    }
    return { rarity: 'common', kind: 'coins', amount: 20, title: '🪙 20 Coins', sub: 'Spend them in the Shop.' };
  }

  /* Grant a rolled prize to the profile. Returns human summary lines. */
  function grant(prize) {
    const r = st();
    const now = Date.now();
    switch (prize.kind) {
      case 'xpmult':
        r.xpMultiplier = prize.mult;
        r.xpBoostUntil = now + (prize.hours || 2) * 3600 * 1000;
        break;
      case 'xpflat':
        S.addXP(prize.amount);
        break;
      case 'coins':
        S.addCoins(prize.amount);
        break;
      case 'freeze':
        if (S.profile.streak) S.profile.streak.freezesLeft = (S.profile.streak.freezesLeft || 0) + prize.amount;
        break;
      case 'badge':
        r.badges[prize.badge.id] = now;
        break;
      case 'avatar':
        if (!r.avatars.includes(prize.avatar.id)) r.avatars.push(prize.avatar.id);
        if (!r.equippedAvatar) r.equippedAvatar = prize.avatar.id;
        if (Object.keys(r.badges).length >= BADGES.filter(b => b.id !== 'bd-collector').length && !r.badges.bd_collector) {
          // handled naturally next chest — keep simple
        }
        if (r.avatars.length >= 3 && !r.badges.bd_collector) r.badges.bd_collector = now;
        break;
      case 'jackpot':
        r.xpMultiplier = prize.mult || 3;
        r.xpBoostUntil = now + (prize.minutes || 30) * 60 * 1000;
        S.addXP(prize.xp || 200);
        S.addCoins(prize.coins || 150);
        r.badges['bd-lucky'] = now;
        break;
    }
    r.chestsClaimed++;
    /* chest streak: consecutive calendar days of opening */
    const today = todayISO();
    if (r.lastChestDate !== today) {
      const yday = new Date(now - 86400000).toISOString().slice(0, 10);
      r.chestStreak = (r.lastChestDate === yday) ? (r.chestStreak || 0) + 1 : 1;
      r.lastChestDate = today;
    }
    if (r.chestStreak >= 3 && !r.badges.bd_streak3) r.badges.bd_streak3 = now;
    if (r.chestsClaimed === 1 && !r.badges.bd_firstchest) r.badges.bd_firstchest = now;
    const h = new Date().getHours();
    if ((h >= 21 || h < 5) && !r.badges.bd_nightowl) r.badges.bd_nightowl = now;
    S.save();
    return prize;
  }

  /* Mark "review completed today" so the next chest can award bd-brain. */
  function noteReviewToday() {
    const r = st();
    r.reviewToday = todayISO();
    S.save();
  }

  function equipAvatar(id) {
    const r = st();
    if (!r.avatars.includes(id)) return false;
    r.equippedAvatar = id;
    S.save();
    return true;
  }
  function getAvatarInfo(id) { return AVATARS.find(a => a.id === id) || null; }

  /* ═════════ THE CHEST UI (overlay) ═════════ */
  const RARITY_META = {
    common:    { color: '#94a3b8', glow: 'rgba(148,163,184,.35)', sound: 'tick', label: 'COMMON' },
    rare:      { color: '#38bdf8', glow: 'rgba(56,189,248,.45)',  sound: 'found', label: 'RARE' },
    epic:      { color: '#a78bfa', glow: 'rgba(167,139,250,.5)',  sound: 'found', label: 'EPIC' },
    legendary: { color: '#fbbf24', glow: 'rgba(251,191,36,.6)',   sound: 'win',   label: 'LEGENDARY' }
  };

  function ensureStyle() {
    if (document.getElementById('cf-chest-style')) return;
    const css = `
    .chest-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;
      background:rgba(4,6,14,.78);backdrop-filter:blur(3px);padding:18px;animation:chestFade .25s ease}
    @keyframes chestFade{from{opacity:0}to{opacity:1}}
    .chest-card{width:min(420px,94vw);border-radius:18px;padding:22px;text-align:center;
      background:linear-gradient(180deg,#141c30 0%,#0d1322 100%);border:1px solid #253050;
      box-shadow:0 24px 80px rgba(0,0,0,.6);animation:chestPop .35s cubic-bezier(.2,1.4,.4,1)}
    @keyframes chestPop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
    .chest-title{font-size:17px;font-weight:900;color:#fff;margin-bottom:4px}
    .chest-sub{font-size:12.5px;color:#64748b;margin-bottom:16px;font-weight:600}
    .chest-box{font-size:74px;line-height:1;user-select:none;filter:drop-shadow(0 6px 18px rgba(251,191,36,.25))}
    .chest-box.shaking{animation:chestShake .9s ease-in-out infinite}
    @keyframes chestShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-6deg) translateY(-4px)}
      40%{transform:rotate(5deg)}60%{transform:rotate(-4deg) translateY(-3px)}80%{transform:rotate(3deg)}}
    .chest-open-btn{margin-top:16px;padding:13px 30px;border-radius:12px;border:none;cursor:pointer;
      font-weight:900;font-size:15px;color:#0a0e1a;background:linear-gradient(135deg,#fbbf24,#f59e0b);
      box-shadow:0 6px 22px rgba(251,191,36,.35);transition:transform .12s}
    .chest-open-btn:hover{transform:translateY(-2px)}
    .chest-prize{display:none;margin-top:6px}
    .chest-prize.show{display:block;animation:prizeIn .5s cubic-bezier(.2,1.3,.4,1)}
    @keyframes prizeIn{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
    .chest-rarity{display:inline-block;font-size:11px;font-weight:900;letter-spacing:2px;padding:4px 12px;
      border-radius:999px;margin-bottom:10px}
    .chest-prize-icon{font-size:56px;line-height:1.1;margin:6px 0}
    .chest-prize-title{font-size:19px;font-weight:900;color:#fff}
    .chest-prize-sub{font-size:13px;color:#94a3b8;margin-top:6px;line-height:1.5}
    .chest-rays{position:absolute;inset:-40%;pointer-events:none;opacity:0;transition:opacity .4s;
      background:conic-gradient(from 0deg,transparent 0 8%,var(--ray,rgba(251,191,36,.25)) 10%,transparent 14%,
      transparent 30%,var(--ray,rgba(251,191,36,.25)) 33%,transparent 38%,transparent 55%,
      var(--ray,rgba(251,191,36,.25)) 58%,transparent 63%,transparent 80%,var(--ray,rgba(251,191,36,.25)) 83%,transparent 88%);
      animation:raysSpin 6s linear infinite}
    @keyframes raysSpin{to{transform:rotate(360deg)}}
    .chest-stage{position:relative;display:inline-block;padding:10px 30px}
    .chest-stage.rays .chest-rays{opacity:1}
    .chest-collect{margin-top:18px;padding:12px 26px;border-radius:12px;border:1px solid #253050;cursor:pointer;
      font-weight:800;font-size:14px;color:#e2e8f0;background:#1a2338}
    .chest-collect:hover{border-color:#3b4a76}
    .chest-confetti{position:fixed;inset:0;pointer-events:none;z-index:1300;overflow:hidden}
    .cf-bit{position:absolute;top:-14px;border-radius:2px;animation:cfFall linear forwards}
    @keyframes cfFall{to{transform:translateY(105vh) rotate(720deg);opacity:.15}}
    .chest-hint{margin-top:12px;font-size:11.5px;color:#64748b}
    /* collection screen */
    .rc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:10px}
    .rc-cell{border:1px solid #253050;border-radius:12px;background:#131a2b;padding:12px 8px;text-align:center;
      font-size:12px;font-weight:700;color:#e2e8f0;position:relative}
    .rc-cell .rc-big{font-size:30px;display:block;margin-bottom:4px}
    .rc-cell.locked{opacity:.38;filter:grayscale(.7)}
    .rc-cell.equipped{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
    .rc-cell button{margin-top:6px;font-size:10.5px;padding:4px 10px;border-radius:8px;border:none;cursor:pointer;
      background:rgba(251,191,36,.15);color:var(--gold);font-weight:800}
    .rc-section{font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin:18px 0 4px}
    `;
    const el = document.createElement('style');
    el.id = 'cf-chest-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function confetti(color) {
    try {
      const wrap = document.createElement('div');
      wrap.className = 'chest-confetti';
      const colors = [color || '#fbbf24', '#22d3ee', '#a78bfa', '#22c55e', '#f43f5e'];
      for (let i = 0; i < 60; i++) {
        const bit = document.createElement('div');
        bit.className = 'cf-bit';
        const size = 5 + Math.random() * 7;
        bit.style.left = (Math.random() * 100) + 'vw';
        bit.style.width = size + 'px';
        bit.style.height = (size * 0.6) + 'px';
        bit.style.background = colors[i % colors.length];
        bit.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
        bit.style.animationDelay = (Math.random() * 0.5) + 's';
        wrap.appendChild(bit);
      }
      document.body.appendChild(wrap);
      setTimeout(() => wrap.remove(), 3400);
    } catch (e) {}
  }

  function sonify(name) {
    try { CF.Sonify.fx(name, {}); } catch (e) {}
  }

  /**
   * Open the mystery chest overlay.
   * opts.context: short line shown under the title (e.g. lesson name).
   * opts.onDone: called after Collect/dismiss.
   */
  function showChest(opts = {}) {
    ensureStyle();
    const prize = rollPrize();           // rolled NOW — suspense before reveal
    const meta = RARITY_META[prize.rarity] || RARITY_META.common;

    const ov = document.createElement('div');
    ov.className = 'chest-overlay';
    ov.innerHTML = `
      <div class="chest-card">
        <div class="chest-title">🎁 Mystery Chest Unlocked!</div>
        <div class="chest-sub">${opts.context ? escHtml(opts.context) : 'Daily module complete — pull the lever.'}</div>
        <div class="chest-stage">
          <div class="chest-rays"></div>
          <div class="chest-box shaking">🧰</div>
        </div>
        <div><button class="chest-open-btn" id="chestOpen">OPEN IT ▶</button></div>
        <div class="chest-prize" id="chestPrize">
          <div class="chest-rarity" style="background:${meta.glow};color:${meta.color}">${meta.label}</div>
          <div class="chest-prize-icon" id="prizeIcon"></div>
          <div class="chest-prize-title" id="prizeTitle"></div>
          <div class="chest-prize-sub" id="prizeSub"></div>
        </div>
        <div class="chest-hint" id="chestHint">Variable rewards hit harder than fixed ones — that's on purpose.</div>
      </div>`;
    document.body.appendChild(ov);

    const stage = ov.querySelector('.chest-stage');
    const box = ov.querySelector('.chest-box');
    const btn = ov.querySelector('#chestOpen');

    function reveal() {
      btn.disabled = true;
      sonify('tick');
      setTimeout(() => {
        box.classList.remove('shaking');
        box.textContent = prize.rarity === 'legendary' ? '🎆' : prize.rarity === 'epic' ? '💜' : '🎉';
        stage.classList.add('rays');
        stage.style.setProperty('--ray', meta.glow);
        const pr = ov.querySelector('#chestPrize');
        ov.querySelector('#prizeIcon').textContent =
          prize.kind === 'badge' ? prize.badge.icon :
          prize.kind === 'avatar' ? prize.avatar.icon :
          prize.kind === 'jackpot' ? '🎰' :
          prize.kind === 'xpmult' ? '✨' :
          prize.kind === 'coins' ? '🪙' :
          prize.kind === 'freeze' ? '❄️' : '⚡';
        ov.querySelector('#prizeTitle').textContent = prize.title;
        ov.querySelector('#prizeSub').textContent = prize.sub;
        pr.classList.add('show');
        grant(prize);
        sonify(meta.sound);
        confetti(meta.color);
        ov.querySelector('#chestHint').textContent =
          `Chests opened: ${st().chestsClaimed} · chest streak: ${st().chestStreak} day${st().chestStreak === 1 ? '' : 's'} 🔥`;
        btn.textContent = 'COLLECT ✓';
        btn.disabled = false;
        btn.onclick = close;
      }, 650);
    }
    function close() {
      ov.style.transition = 'opacity .2s';
      ov.style.opacity = '0';
      setTimeout(() => { ov.remove(); if (opts.onDone) opts.onDone(prize); }, 220);
    }
    btn.addEventListener('click', () => {
      if (btn.textContent.indexOf('COLLECT') !== -1) close(); else reveal();
    });
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═════════ COLLECTION SCREEN (avatars + badges) ═════════ */
  function renderCollection(container, onBack) {
    ensureStyle();
    const r = st();
    container.innerHTML = `
      <div class="shop-header">
        <button class="back-btn" id="rcBack">← Back</button>
        <div style="flex:1">
          <div class="map-title">🎁 Rewards Collection</div>
          <div class="map-sub">${r.chestsClaimed} chests opened · ${r.avatars.length}/${AVATARS.length} avatars · ${Object.keys(r.badges).length}/${BADGES.length} badges</div>
        </div>
      </div>
      <div class="rc-section">Collectible Avatars</div>
      <div class="rc-grid">
        ${AVATARS.map(a => {
          const owned = r.avatars.includes(a.id);
          const eq = r.equippedAvatar === a.id;
          return `<div class="rc-cell ${owned ? '' : 'locked'} ${eq ? 'equipped' : ''}">
            <span class="rc-big">${owned ? a.icon : '❔'}</span>${escHtml(a.name)}
            ${owned && !eq ? `<button data-eq="${a.id}">Equip</button>` : ''}
            ${eq ? '<div style="color:var(--gold);font-size:10px;margin-top:4px">EQUIPPED</div>' : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="rc-section">Profile Badges</div>
      <div class="rc-grid">
        ${BADGES.map(b => {
          const owned = !!r.badges[b.id];
          return `<div class="rc-cell ${owned ? '' : 'locked'}">
            <span class="rc-big">${owned ? b.icon : '🔒'}</span>${escHtml(b.name)}
            <div style="font-size:10px;color:#64748b;margin-top:4px">${escHtml(b.desc)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="rc-section">Active Boost</div>
      <div class="rc-cell" style="text-align:left;padding:14px">
        ${boostActive()
          ? `✨ ×${r.xpMultiplier} XP active — ${Math.ceil(boostRemainingSec() / 60)} min left`
          : 'No XP boost active. Finish a daily module to open a chest.'}
      </div>`;
    container.querySelector('#rcBack').addEventListener('click', () => onBack && onBack());
    container.querySelectorAll('[data-eq]').forEach(b =>
      b.addEventListener('click', () => { equipAvatar(b.dataset.eq); renderCollection(container, onBack); }));
  }

  return {
    st,
    AVATARS, BADGES,
    boostActive, currentMultiplier, applyXPBoost, boostRemainingSec,
    rollPrize, grant,
    noteReviewToday,
    equipAvatar, getAvatarInfo,
    showChest, renderCollection
  };
})();
