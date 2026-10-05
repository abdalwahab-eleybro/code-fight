/* ═══════════════════════════════════════════════════════════ */
/*  12-settings.js — Settings screen, profile export/import    */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Settings = (() => {
  const S = CF.State;

  function render(container, onBack) {
    const p = S.profile;
    const stats = CF.Spaced.getStats();
    const achievements = CF.Achievements.getAllUnlocked().length;
    const totalAchievements = CF.Achievements.BADGES.length;

    container.innerHTML = `
      <div class="shop-header">
        <button class="back-btn" id="settingsBack">← Menu</button>
        <div style="flex:1">
          <div class="map-title">Settings</div>
          <div class="map-sub">Audio, progress, stats</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">🔊 Audio</div>
        <div class="settings-row">
          <label>Music Volume</label>
          <input type="range" id="musicVol" min="0" max="100" value="${Math.round((p.settings.musicVolume ?? 0.4) * 100)}">
          <span class="settings-val" id="musicVolVal">${Math.round((p.settings.musicVolume ?? 0.4) * 100)}%</span>
        </div>
        <div class="settings-row">
          <label>SFX Volume</label>
          <input type="range" id="sfxVol" min="0" max="100" value="${Math.round((p.settings.sfxVolume ?? 0.7) * 100)}">
          <span class="settings-val" id="sfxVolVal">${Math.round((p.settings.sfxVolume ?? 0.7) * 100)}%</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">📊 Your Stats</div>
        <div class="settings-stats">
          <div class="stat-cell"><div class="stat-cell-val">${p.playerLevel}</div><div class="stat-cell-lbl">Level</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${p.xp}</div><div class="stat-cell-lbl">Total XP</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${p.coins}</div><div class="stat-cell-lbl">Coins</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${p.streak.current}</div><div class="stat-cell-lbl">Streak</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${achievements}/${totalAchievements}</div><div class="stat-cell-lbl">Badges</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${stats.total}</div><div class="stat-cell-lbl">Questions Seen</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${stats.mastered}</div><div class="stat-cell-lbl">Mastered</div></div>
          <div class="stat-cell"><div class="stat-cell-val">${stats.due}</div><div class="stat-cell-lbl">Due Review</div></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">💾 Profile</div>
        <button class="settings-action" id="exportProfile">📤 Export Profile (JSON)</button>
        <button class="settings-action" id="importProfile">📥 Import Profile</button>
        <button class="settings-action danger" id="resetAll">⚠️ Reset All Progress</button>
      </div>
    `;

    container.querySelector('#settingsBack').addEventListener('click', onBack);

    // Volume sliders
    const musicVol = container.querySelector('#musicVol');
    const musicVal = container.querySelector('#musicVolVal');
    musicVol.addEventListener('input', () => {
      const v = musicVol.value / 100;
      musicVal.textContent = Math.round(v * 100) + '%';
      S.profile.settings.musicVolume = v;
      CF.Music.setVolume(v);
    });

    const sfxVol = container.querySelector('#sfxVol');
    const sfxVal = container.querySelector('#sfxVolVal');
    sfxVol.addEventListener('input', () => {
      const v = sfxVol.value / 100;
      sfxVal.textContent = Math.round(v * 100) + '%';
      S.profile.settings.sfxVolume = v;
      S.save();
    });

    // Export
    container.querySelector('#exportProfile').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(S.profile, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-fighter-profile-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    container.querySelector('#importProfile').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if (!data || typeof data !== 'object') throw new Error('Invalid format');
            Object.assign(S.profile, data);
            S.save();
            alert('✓ Profile imported. Reloading…');
            location.reload();
          } catch (e) {
            alert('Failed to import: ' + e.message);
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });

    // Reset
    container.querySelector('#resetAll').addEventListener('click', () => {
      if (!confirm('Reset ALL progress? This cannot be undone.')) return;
      if (!confirm('Really sure? Everything will be wiped.')) return;
      S.resetProfile();
      CF.Spaced.resetAll();
      alert('Progress reset.');
      location.reload();
    });
  }

  return { render };
})();
