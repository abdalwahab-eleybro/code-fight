/* ═══════════════════════════════════════════════════════════ */
/*  08-shop.js — Shop items, purchases, UI render              */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Shop = (() => {
  const S = CF.State;

  /* ═══════════════════════════════════════════════════════ */
  /*  ITEM DEFINITIONS                                        */
  /* ═══════════════════════════════════════════════════════ */
  // costFormula(level) → coin cost for the next purchase
  const ITEMS = [
    {
      id: 'maxHP',
      name: '+20 Max HP',
      icon: '❤️',
      desc: 'Permanently increases your starting HP.',
      kind: 'upgrade',
      costBase: 100,
      costGrowth: 1.35,
      ownedLabel: (v) => `Level ${v}`
    },
    {
      id: 'baseDamage',
      name: '+5 Base Damage',
      icon: '⚔️',
      desc: 'Every correct answer hits harder.',
      kind: 'upgrade',
      costBase: 150,
      costGrowth: 1.4,
      ownedLabel: (v) => `Level ${v}`
    },
    {
      id: 'freeHints',
      name: 'Free Hint',
      icon: '💡',
      desc: 'One hint per fight without HP cost. Consumed on use.',
      kind: 'consumable',
      costBase: 40,
      costGrowth: 1.15,
      ownedLabel: (v) => `×${v}`
    },
    {
      id: 'rerolls',
      name: 'Reroll Question',
      icon: '🔄',
      desc: 'Swap the current question for a different one. Consumed on use.',
      kind: 'consumable',
      costBase: 30,
      costGrowth: 1.1,
      ownedLabel: (v) => `×${v}`
    },
    {
      id: 'comboShield',
      name: 'Combo Shield',
      icon: '🛡️',
      desc: 'First wrong answer per fight does not break your combo.',
      kind: 'oneTime',
      costBase: 250,
      costGrowth: 1,
      ownedLabel: () => 'Owned'
    },
    {
      id: 'streakFreeze',
      name: 'Streak Freeze',
      icon: '❄️',
      desc: 'Protects your streak if you miss a day. Consumed automatically.',
      kind: 'consumable',
      costBase: 200,
      costGrowth: 1,
      ownedLabel: (v) => `×${v}`
    }
  ];

  /* ═══════════════════════════════════════════════════════ */
  /*  COST / OWNED HELPERS                                    */
  /* ═══════════════════════════════════════════════════════ */
  function getOwned(id) {
    const u = S.profile.upgrades;
    if (id === 'comboShield') return u.comboShield ? 1 : 0;
    return u[id] || 0;
  }

  function getCost(item) {
    const owned = getOwned(item.id);
    if (item.kind === 'oneTime' && owned > 0) return null;   // already owned
    return Math.round(item.costBase * Math.pow(item.costGrowth, owned));
  }

  function canAfford(item) {
    const cost = getCost(item);
    if (cost === null) return false;
    return S.profile.coins >= cost;
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  PURCHASE                                                */
  /* ═══════════════════════════════════════════════════════ */
  function purchase(id) {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return { ok: false, reason: 'Unknown item' };

    const cost = getCost(item);
    if (cost === null) return { ok: false, reason: 'Already owned' };
    if (S.profile.coins < cost) return { ok: false, reason: 'Not enough coins' };

    S.profile.coins -= cost;

    if (id === 'comboShield') {
      S.profile.upgrades.comboShield = true;
    } else {
      S.profile.upgrades[id] = (S.profile.upgrades[id] || 0) + 1;
    }

    S.save();
    return { ok: true, cost };
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  RENDER                                                  */
  /* ═══════════════════════════════════════════════════════ */
  function render(container, onPurchase) {
    const coins = S.profile.coins;

    let html = `
      <div class="shop-header">
        <button class="back-btn" id="shopBack">← Menu</button>
        <div style="flex:1">
          <div class="map-title">Shop</div>
          <div class="map-sub">Spend coins on permanent upgrades and consumables</div>
        </div>
        <div class="shop-wallet">
          <span>🪙</span><strong>${coins}</strong>
        </div>
      </div>
      <div class="shop-grid">
    `;

    ITEMS.forEach(item => {
      const cost = getCost(item);
      const owned = getOwned(item.id);
      const ownedText = owned > 0 ? item.ownedLabel(owned) : '';
      const ownedItem = cost === null;
      const affordable = canAfford(item);

      html += `
        <div class="shop-card ${ownedItem ? 'owned' : ''} ${!affordable && !ownedItem ? 'unaffordable' : ''}" data-id="${item.id}">
          <div class="shop-icon">${item.icon}</div>
          <div class="shop-body">
            <div class="shop-name">
              ${item.name}
              ${ownedText ? `<span class="shop-owned">${ownedText}</span>` : ''}
            </div>
            <div class="shop-desc">${item.desc}</div>
          </div>
          <div class="shop-action">
            ${ownedItem
              ? `<div class="shop-cost owned-text">✓ Owned</div>`
              : `<button class="shop-buy" data-id="${item.id}" ${!affordable ? 'disabled' : ''}>
                   <span class="cost-icon">🪙</span>${cost}
                 </button>`
            }
          </div>
        </div>
      `;
    });

    html += `</div>
      <div class="shop-footer" id="shopFooter"></div>
    `;

    container.innerHTML = html;

    // Wire up
    container.querySelector('#shopBack')?.addEventListener('click', () => onPurchase('back'));
    container.querySelectorAll('.shop-buy').forEach(btn => {
      btn.addEventListener('click', () => onPurchase(btn.dataset.id));
    });
  }

  function showToast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'shop-toast ' + (kind || '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 2000);
  }

  return { ITEMS, render, purchase, showToast, getCost, getOwned };
})();
