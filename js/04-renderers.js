/* ═══════════════════════════════════════════════════════════ */
/*  04-renderers.js — 11 question type renderers               */
/*  Depends on: 03-questions.js                                */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Renderers = (() => {

  /* ═══ MAIN ENTRY ═══ */
  // mount(question, containerEl, onAnswer)
  // onAnswer(submittedValue) — engine compares against correct answer
  function mount(q, container, onAnswer) {
    container.innerHTML = '';
    container.className = 'question-panel type-' + q.type;

    // Type-specific header
    const badge = document.createElement('div');
    badge.className = 'question-badge';
    badge.textContent = CF.Questions.getTypeMeta(q.type).label;
    container.appendChild(badge);

    // Title + prompt
    const title = document.createElement('h3');
    title.className = 'question-title';
    title.textContent = q.title || '';
    container.appendChild(title);

    if (q.prompt) {
      const p = document.createElement('p');
      p.className = 'question-prompt';
      p.textContent = q.prompt;
      container.appendChild(p);
    }

    if (q.code) {
      const pre = document.createElement('pre');
      pre.className = 'question-code';
      pre.textContent = q.code;
      container.appendChild(pre);
    }

    // Dispatch to type renderer
    const body = document.createElement('div');
    body.className = 'question-body';
    container.appendChild(body);

    const handlers = {
      pattern:    renderMCQ,
      complexity: renderMCQGrid,
      state:      renderMCQ,
      trace:      renderMCQ,
      invariant:  renderMCQ,
      bug:        renderMCQ,
      nextline:   renderMCQ,
      chips:      renderChips,
      order:      renderOrder,
      flowchart:  renderFlowchart,
      numeric:    renderNumeric
    };
    (handlers[q.type] || renderMCQ)(q, body, onAnswer);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  MCQ — 4-6 options, single tap submits                     */
  /* ═══════════════════════════════════════════════════════ */
  function renderMCQ(q, body, onAnswer) {
    const grid = document.createElement('div');
    grid.className = 'mcq-list';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'mcq-option';
      btn.dataset.letter = String.fromCharCode(65 + i);
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        lockAll(grid);
        onAnswer(i);
      });
      grid.appendChild(btn);
    });
    body.appendChild(grid);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  MCQ GRID — 6-8 options for complexity questions           */
  /* ═══════════════════════════════════════════════════════ */
  function renderMCQGrid(q, body, onAnswer) {
    const grid = document.createElement('div');
    grid.className = 'mcq-grid';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'mcq-option grid-option';
      btn.dataset.letter = String.fromCharCode(65 + i);
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        lockAll(grid);
        onAnswer(i);
      });
      grid.appendChild(btn);
    });
    body.appendChild(grid);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  CHIPS — tap the token that fills the blank                */
  /* ═══════════════════════════════════════════════════════ */
  function renderChips(q, body, onAnswer) {
    const row = document.createElement('div');
    row.className = 'chips-row';
    q.tokens.forEach((tok, i) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = tok;
      chip.addEventListener('click', () => {
        lockAll(row);
        onAnswer(i);
      });
      row.appendChild(chip);
    });
    body.appendChild(row);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  ORDER — tap lines in sequence                             */
  /* ═══════════════════════════════════════════════════════ */
  function renderOrder(q, body, onAnswer) {
    const list = document.createElement('div');
    list.className = 'order-list';
    const picked = [];

    const items = q.lines.map((line, i) => ({ line, i }));
    // Shuffle display order so it's not the answer
    const shuffled = CF.Questions.shuffle(items);

    shuffled.forEach(({ line, i }) => {
      const el = document.createElement('button');
      el.className = 'order-item';
      el.dataset.idx = i;
      el.innerHTML = `<span class="order-slot"></span><span class="order-line">${escapeHtml(line)}</span>`;

      el.addEventListener('click', () => {
        const pos = picked.indexOf(i);
        if (pos >= 0) {
          picked.splice(pos, 1);
        } else {
          picked.push(i);
        }
        refreshOrderUI();
        if (picked.length === q.lines.length) {
          submitBtn.disabled = false;
        } else {
          submitBtn.disabled = true;
        }
      });
      list.appendChild(el);
    });

    body.appendChild(list);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'submit-answer';
    submitBtn.textContent = 'Submit Order';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', () => {
      lockAll(list);
      submitBtn.disabled = true;
      onAnswer(picked.slice());
    });
    body.appendChild(submitBtn);

    function refreshOrderUI() {
      list.querySelectorAll('.order-item').forEach(el => {
        const i = Number(el.dataset.idx);
        const pos = picked.indexOf(i);
        const slot = el.querySelector('.order-slot');
        slot.textContent = pos >= 0 ? String(pos + 1) : '';
        el.classList.toggle('picked', pos >= 0);
      });
    }
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  FLOWCHART — highlighted decision node + branch options    */
  /* ═══════════════════════════════════════════════════════ */
  function renderFlowchart(q, body, onAnswer) {
    // Highlighted decision node
    const node = document.createElement('div');
    node.className = 'flowchart-node';
    node.innerHTML = `
      <svg viewBox="0 0 240 70" width="240" height="70">
        <polygon points="120,4 236,35 120,66 4,35"
                 fill="#fff7ed" stroke="#f59e0b" stroke-width="2"/>
        <text x="120" y="40" text-anchor="middle"
              font-family="monospace" font-weight="800" font-size="14"
              fill="#b45309">${escapeHtml(q.highlightNode || '?')}</text>
      </svg>
    `;
    body.appendChild(node);

    const caption = document.createElement('div');
    caption.className = 'flowchart-caption';
    caption.textContent = 'Which branch?';
    body.appendChild(caption);

    const row = document.createElement('div');
    row.className = 'chips-row';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'chip flowchart-chip';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        lockAll(row);
        onAnswer(i);
      });
      row.appendChild(btn);
    });
    body.appendChild(row);
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  NUMERIC — number pad                                      */
  /* ═══════════════════════════════════════════════════════ */
  function renderNumeric(q, body, onAnswer) {
    let value = '';
    let negative = false;

    const display = document.createElement('div');
    display.className = 'numeric-display';
    display.textContent = '0';
    body.appendChild(display);

    const pad = document.createElement('div');
    pad.className = 'numeric-pad';

    const keys = ['7','8','9','4','5','6','1','2','3','±','0','⌫'];
    keys.forEach(k => {
      const b = document.createElement('button');
      b.className = 'numeric-key';
      b.textContent = k;
      if (k === '⌫') b.classList.add('danger');
      if (k === '±') b.classList.add('ghost');
      b.addEventListener('click', () => {
        if (k === '⌫') value = value.slice(0, -1);
        else if (k === '±') negative = !negative;
        else if (value.length < 6) value += k;
        display.textContent = (negative ? '−' : '') + (value || '0');
      });
      pad.appendChild(b);
    });
    body.appendChild(pad);

    const submit = document.createElement('button');
    submit.className = 'submit-answer';
    submit.textContent = 'Submit';
    submit.disabled = true;
    submit.addEventListener('click', () => {
      lockAll(pad);
      submit.disabled = true;
      onAnswer((negative ? -1 : 1) * Number(value || 0));
    });
    body.appendChild(submit);

    // Enable/disable submit as user types
    const observer = new MutationObserver(() => {
      submit.disabled = value === '';
    });
    observer.observe(display, { childList: true });
  }

  /* ═══ HELPERS ═══ */
  function lockAll(parent) {
    parent.querySelectorAll('button').forEach(b => b.disabled = true);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ═══ CHECK ═══ */
  // Returns true if the submitted answer matches the correct answer for this type
  function checkAnswer(q, submitted) {
    switch (q.type) {
      case 'chips':
      case 'nextline':
      case 'flowchart':
      case 'pattern':
      case 'complexity':
      case 'state':
      case 'trace':
      case 'invariant':
      case 'bug':
        return submitted === q.correct;

      case 'numeric':
        return Number(submitted) === Number(q.answer);

      case 'order': {
        const correct = q.correctOrder || [];
        if (!Array.isArray(submitted) || submitted.length !== correct.length) return false;
        for (let i = 0; i < correct.length; i++) {
          if (submitted[i] !== correct[i]) return false;
        }
        return true;
      }

      default:
        return false;
    }
  }

  // Human-readable correct answer for feedback
  function formatCorrect(q) {
    switch (q.type) {
      case 'pattern':
      case 'complexity':
      case 'state':
      case 'trace':
      case 'invariant':
      case 'bug':
      case 'nextline':
      case 'flowchart':
        return q.options[q.correct];
      case 'chips':
        return q.tokens[q.correct];
      case 'numeric':
        return String(q.answer);
      case 'order':
        return q.correctOrder.map(i => q.lines[i]).join(' → ');
      default:
        return '?';
    }
  }

  return { mount, checkAnswer, formatCorrect };
})();
