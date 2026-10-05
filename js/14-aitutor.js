/* ═══════════════════════════════════════════════════════════ */
/*  14-aitutor.js — Gemini-powered AI tutor                    */
/*  · Socratic hints (never reveals the answer)               */
/*  · Explain-back grading with strict rubric                 */
/*  · Misconception diagnosis from weak spots                  */
/*                                                              */
/*  The API key lives ONLY in this browser (localStorage, with an  */
/*  in-memory fallback for sandboxed previews where localStorage   */
/*  is blocked), separate from the game profile so exports never  */
/*  leak it. Latest Gemini models at time of build: 3.x series.   */
/*  Depends on: 01-state.js                                      */
/* ═════════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.AITutor = (() => {
  const KEY_STORAGE = 'cf_gemini_api_key';
  const MODEL_STORAGE = 'cf_gemini_model';

  /* Gemini 3.x series — current model lineup (Oct 2026). */
  const MODELS = [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (latest, recommended)' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (stable)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (strongest)' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (fastest/cheapest)' }
  ];

  /* in-memory fallback — some sandboxes/iframes block localStorage */
  let memKey = '', memModel = '';

  function canPersist() {
    try {
      localStorage.setItem('__cf_probe', '1');
      localStorage.removeItem('__cf_probe');
      return true;
    } catch (e) { return false; }
  }
  function getKey() {
    let v = '';
    try { v = localStorage.getItem(KEY_STORAGE) || ''; } catch (e) {}
    return (v || memKey).trim();
  }
  function setKey(k) {
    memKey = String(k || '').trim();
    try { localStorage.setItem(KEY_STORAGE, memKey); } catch (e) {}
  }
  function getModel() {
    let m = '';
    try { m = localStorage.getItem(MODEL_STORAGE) || ''; } catch (e) {}
    if (!m || !MODELS.some(x => x.id === m)) m = memModel || MODELS[0].id; // unknown/legacy id → default
    return m;
  }
  function setModel(m) {
    memModel = m;
    try { localStorage.setItem(MODEL_STORAGE, m); } catch (e) {}
  }
  function isConfigured() { return getKey().length > 10; }

  const SYSTEM_PROMPT = [
    'You are a Socratic programming tutor inside "Code Fighter", a game that teaches coding-interview patterns.',
    'Rules: be concise (under 120 words), warm and concrete.',
    'When a learner explains an idea back to you, grade strictly but kindly.',
    'NEVER reveal the full invariant/answer you are given — guide with questions and tiny concrete examples instead.',
    'Reply in plain text only. No markdown headers, no bullet lists unless asked.'
  ].join(' ');

  /* ── core call ── */
  async function generate(userPrompt, opts = {}) {
    const key = getKey();
    if (!key) throw new Error('No API key configured. Add your Gemini key in the AI Tutor card.');
    const model = opts.model || getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxTokens ?? 700
      }
    };
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('Network blocked or offline. (If you are inside the sandboxed preview, download the file and open it in a browser.)');
    }
    if (!resp.ok) {
      if (resp.status === 400 || resp.status === 403) throw new Error('Request rejected — check your API key.');
      if (resp.status === 404) throw new Error('Model not found — pick another model.');
      if (resp.status === 429) throw new Error('Rate limit reached — wait a moment and retry.');
      throw new Error('Gemini error ' + resp.status);
    }
    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map(p => p.text || '').join('').trim() : '';
    if (!text) throw new Error('Empty response from the model.');
    return text;
  }

  /* ── feature: test connection ── */
  async function testConnection() {
    const t = await generate('Reply with exactly: TUTOR ONLINE', { maxTokens: 20, temperature: 0 });
    return t;
  }

  /* ── feature: explain-back grading ──
     Returns { verdict: 'PASS'|'RETRY', feedback } */
  async function gradeExplanation({ title, invariant, question, learnerText }) {
    const prompt = [
      `Lesson: "${title}".`,
      `The learner was asked: "${question}"`,
      `The correct core idea (ground truth — for you only, never quote it back): "${invariant}"`,
      `The learner's explanation: "${learnerText}"`,
      '',
      'Grade strictly against the ground truth: does the explanation capture the key idea in their own words?',
      'First line must be exactly "VERDICT: PASS" or "VERDICT: RETRY".',
      'Then: one sentence naming what they got right.',
      'If RETRY: exactly ONE guiding question or one tiny concrete example that leads them there without revealing the answer.'
    ].join('\n');
    const text = await generate(prompt, { temperature: 0.3 });
    const m = text.match(/VERDICT:\s*(PASS|RETRY)/i);
    const verdict = m ? (m[1].toUpperCase() === 'PASS' ? 'PASS' : 'RETRY') : 'RETRY';
    const feedback = text.replace(/VERDICT:\s*(PASS|RETRY)/i, '').trim() || text;
    return { verdict, feedback };
  }

  /* ── feature: Socratic hint ── */
  async function socraticHint({ title, question, learnerQuestion }) {
    const prompt = [
      `Lesson: "${title}".`,
      `The learner is working on: "${question}"`,
      learnerQuestion ? `They ask: "${learnerQuestion}"` : 'They say they are stuck.',
      'Give ONE guiding question, or ONE tiny concrete example (3–4 numbers max).',
      'Never state the answer. Max 50 words.'
    ].join('\n');
    return generate(prompt, { temperature: 0.6, maxTokens: 250 });
  }

  /* ── feature: misconception diagnosis ── */
  async function diagnose({ patternName, errorSummary, lessonTitles }) {
    const prompt = [
      'You are diagnosing a learner in a pattern-recognition training game.',
      `Pattern: ${patternName}.`,
      `Their recent mistakes: ${errorSummary}`,
      `Available lessons: ${lessonTitles.join(', ')}.`,
      'In under 90 words: (1) name the single most likely underlying misconception,',
      '(2) recommend exactly ONE lesson or drill to fix it. Plain text.'
    ].join('\n');
    return generate(prompt, { temperature: 0.4, maxTokens: 400 });
  }

  return {
    MODELS, getKey, setKey, getModel, setModel, isConfigured, canPersist,
    generate, testConnection, gradeExplanation, socraticHint, diagnose
  };
})();
