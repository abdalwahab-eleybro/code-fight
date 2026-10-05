/* ═══════════════════════════════════════════════════════════ */
/*  00-content.js — Content loader (data/*.json)               */
/*  No dependencies. Load before everything else.              */
/*                                                             */
/*  WHY THIS EXISTS                                          */
/*  Editable content (fighter roster, campaign table) lives in  */
/*  plain JSON files under data/. This tiny module fetches      */
/*  them once and caches the result, so every other module can  */
/*  request content with a single promise-based call instead    */
/*  of hard-coding it.                                          */
/*                                                             */
/*  If the JSON can't be fetched (e.g. the page was opened     */
/*  directly via file://), loaders resolve to null and each     */
/*  consumer falls back to its built-in defaults — nothing      */
/*  breaks.                                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Content = (() => {
  const cache = {};   // url -> Promise<data|null>

  function load(url) {
    if (!cache[url]) {
      cache[url] = fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          return r.json();
        })
        .catch(err => {
          console.info(`[CF.Content] using built-in defaults (${err.message})`);
          return null;   // consumers treat null as "keep fallback"
        });
    }
    return cache[url];
  }

  return { load };
})();
