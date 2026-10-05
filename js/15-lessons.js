/* ═══════════════════════════════════════════════════════════ */
/*  15-lessons.js — Interactive lessons: Hook → Watch →        */
/*  Predict → Drive → Break it → Explain (AI) → Quiz → Reward  */
/*                                                              */
/*  Pedagogy implemented:                                        */
/*   · Dual coding     — code + array view in sync              */
/*   · Modality        — narration in audio, short labels on    */
/*                      screen (no paragraph text walls)         */
/*   · Segmenting      — learner controls every step             */
/*   · Prediction eff. — predict-before-reveal checkpoints       */
/*   · Generation      — Drive mode: you move the pointers       */
/*   · Self-explanation— Explain phase, graded by Gemini        */
/*   · Worked examples — Watch phase is fully worked             */
/*   · Misconceptions  — "Break it" shows a real failing input   */
/*   · Review link     — quiz answers feed CF.Spaced (SM-2-ish)  */
/*  Depends on: 01, 03, 04, 13, 14                               */
/* ═════════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Lessons = (() => {
  const S = CF.State;
  const Q = CF.Questions;
  const R = CF.Renderers;
  const AI = CF.AITutor;

  /* ═══════════════════════════════════════════════════════ */
  /*  TRACE GENERATORS (pure — testable without a DOM)       */
  /* ═══════════════════════════════════════════════════════ */

  /* ── P1 · Converging pointers (Two Sum II) ── */
  function twoSumTrace(nums, target, mode, opts = {}) {
    const n = nums.length;
    const steps = [];
    /* first predict comes AFTER the learner has seen one full narrated move */
  const preOpts = (opts && Array.isArray(opts.watchPredicts)) ? opts.watchPredicts : [1, 2];

    steps.push({
      line: 0,
      caption: 'L = 0, R = n − 1',
      narration: `The array is sorted, so we start L at the left end and R at the right end, index ${n - 1}. We will converge from both sides.`,
      state: { arr: [...nums], ptrs: { L: 0, R: n - 1 }, marks: {}, aux: [{ label: 'target', value: target }] },
      fx: { type: 'init' }
    });

    let L = 0, Rn = n - 1;
    let decisionCount = 0;

    while (L < Rn) {
      const a = nums[L], b = nums[Rn], s = a + b;

      const cmp = {
        line: 2,
        caption: `sum = ${a} + ${b} = ${s}`,
        narration: `The sum of ${a} and ${b} is ${s}.`,
        state: {
          arr: [...nums], ptrs: { L, R: Rn },
          marks: { [L]: 'cmp', [Rn]: 'cmp' },
          aux: [{ label: 'target', value: target }, { label: 'sum', value: s }]
        },
        fx: { type: 'compare', indices: [L, Rn] }
      };

      if (s === target) {
        if (mode === 'watch') {
          cmp.predict = {
            q: `sum = ${s} and target = ${target}. What happens next?`,
            options: ['return [L+1, R+1]', 'L += 1', 'R -= 1'],
            correct: 0,
            why: `Equal — this is the pair. We return indices ${L + 1} and ${Rn + 1}.`
          };
        }
        steps.push(cmp);
        steps.push({
          line: 4,
          caption: `Found: [${L + 1}, ${Rn + 1}] → ${a} + ${b} = ${target}`,
          narration: `Found it. ${a} plus ${b} equals ${target}. We never scanned the whole array — every step discarded an entire candidate.`,
          state: {
            arr: [...nums], ptrs: { L, R: Rn },
            marks: { [L]: 'win', [Rn]: 'win' },
            aux: [{ label: 'target', value: target }, { label: 'sum', value: s }, { label: 'done', value: '✓', done: true }]
          },
          fx: { type: 'found' }
        });
        break;
      }

      const tooSmall = s < target;

      /* watch mode: prediction checkpoints on every decision (restored —
         comprehension checks must punctuate the whole trace, not just its start) */
      if (mode === 'watch') {
        cmp.predict = {
          q: `sum = ${s} ${tooSmall ? '<' : '>'} ${target}. Which pointer moves next?`,
          options: tooSmall ? ['L += 1', 'R -= 1'] : ['R -= 1', 'L += 1'],
          correct: 0,
          why: tooSmall
            ? `${s} is too small. Keeping R here, no later L (values only grow) can help — nums[L] is the bottleneck, so L moves right.`
            : `${s} is too big. Keeping L here, no earlier R (values only shrink) can help — nums[R] is the bottleneck, so R moves left.`
        };
      }
      if (mode !== 'drive') steps.push(cmp);

      /* drive mode: the decision step */
      if (mode === 'drive') {
        steps.push({
          line: tooSmall ? 5 : 7,
          caption: `${s} ${tooSmall ? '<' : '>'} ${target} — your move`,
          narration: '',
          state: cmp.state,
          fx: { type: 'compare', indices: [L, Rn] },
          drive: {
            prompt: `sum = ${s} ${tooSmall ? '<' : '>'} ${target}. Which pointer moves?`,
            options: ['L += 1', 'R -= 1'],
            correct: tooSmall ? 0 : 1,
            why: tooSmall
              ? `${s} is below the target — the left value is the bottleneck, so L moves right.`
              : `${s} is above the target — the right value is the bottleneck, so R moves left.`,
            hint: `The sum is too ${tooSmall ? 'small' : 'big'}. Which side is responsible for that?`
          }
        });
      }

      /* execute the move */
      const oldR = Rn, oldL = L;
      if (tooSmall) { L++; } else { Rn--; }
      const movedIdx = tooSmall ? L : Rn;
      const marks = { [movedIdx]: 'cmp' };
      if (tooSmall) marks[oldL] = 'out'; else marks[oldR] = 'out';

      steps.push({
        line: tooSmall ? 6 : 8,
        caption: tooSmall ? `L moves to ${L}` : `R moves to ${Rn}`,
        narration: tooSmall
          ? `The left value was the bottleneck. L moves right, and index ${oldL} can never be part of the answer.`
          : `The right value was the bottleneck. R moves left, and index ${oldR} can never be part of the answer.`,
        state: {
          arr: [...nums], ptrs: { L, R: Rn }, marks,
          aux: [{ label: 'target', value: target }, { label: 'sum', value: s }]
        },
        fx: { type: 'move', indices: [movedIdx] }
      });

      decisionCount++;
    }

    return {
      code: [
        'L, R = 0, len(nums) - 1',
        'while L < R:',
        '    s = nums[L] + nums[R]',
        '    if s == target:',
        '        return [L + 1, R + 1]',
        '    elif s < target:',
        '        L += 1',
        '    else:',
        '        R -= 1'
      ],
      steps
    };
  }

  /* ── P1 · Misconception: converging on UNSORTED input ── */
  function twoSumBugTrace(nums, target) {
    const n = nums.length;
    const steps = [];
    steps.push({
      line: 1,
      caption: '⚠️ NOT sorted — the algorithm does not know that',
      narration: `Here is the same code on an array that is not sorted. Watch what the rule does when its secret assumption is violated.`,
      state: { arr: [...nums], ptrs: { L: 0, R: n - 1 }, marks: {}, aux: [{ label: 'target', value: target }] },
      fx: { type: 'init' }
    });
    let L = 0, Rn = n - 1;
    while (L < Rn) {
      const a = nums[L], b = nums[Rn], s = a + b;
      const tooSmall = s < target;
      const cmp = {
        line: 3,
        caption: `sum = ${a} + ${b} = ${s}`,
        narration: `Sum is ${s}. The rule says: too ${tooSmall ? 'small, move L' : 'big, discard the right value'}. But is discarding it actually safe here?`,
        state: {
          arr: [...nums], ptrs: { L, R: Rn },
          marks: { [L]: 'cmp', [Rn]: 'cmp' },
          aux: [{ label: 'target', value: target }, { label: 'sum', value: s }]
        },
        fx: { type: 'compare', indices: [L, Rn] }
      };
      if (Rn === 2) {
        cmp.predict = {
          q: `The rule is about to discard nums[R] = ${nums[Rn]}. Safe?`,
          options: ['No — unsorted data means the discard guarantee is gone', 'Yes — the rule is always safe'],
          correct: 0,
          why: `On sorted data discarding the right end is provably safe. Here ${nums[Rn]} pairs with ${nums[1]} (index 1) to make ${nums[Rn] + nums[1]} — the rule is about to throw away half of the real answer.`
        };
      }
      steps.push(cmp);
      const old = tooSmall ? L : Rn;
      if (tooSmall) L++; else Rn--;
      steps.push({
        line: tooSmall ? 5 : 6,
        caption: tooSmall ? `L moves to ${L}` : `R moves to ${Rn} — value ${nums[old]} was discarded`,
        narration: `Index ${old}, value ${nums[old]}, is now marked as ruled out. On unsorted data that mark can be a lie.`,
        state: {
          arr: [...nums], ptrs: { L, R: Rn },
          marks: { [old]: 'out', [tooSmall ? L : Rn]: 'cmp' },
          aux: [{ label: 'target', value: target }, { label: 'sum', value: s }]
        },
        fx: { type: 'move', indices: [tooSmall ? L : Rn] }
      });
    }
    steps.push({
      line: 2,
      caption: `L < R fails — loop ends. No pair found.`,
      narration: `The loop ends with no answer. But look: ${nums.slice(1, 3).join(' + ')} = ${nums[1] + nums[2]}, and that equals ${target}. The pair existed. The algorithm threw it away, because it silently assumed sorted order.`,
      state: {
        arr: [...nums], ptrs: { L, R: Rn },
        marks: { 1: 'win', 2: 'win' },
        aux: [{ label: 'target', value: target }, { label: 'missed', value: `${nums[1]}+${nums[2]}=${nums[1] + nums[2]}`, done: true }]
      },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# same code, unsorted input ⚠️',
        'L, R = 0, len(nums) - 1',
        'while L < R:',
        '    s = nums[L] + nums[R]',
        '    if s == target: return [L + 1, R + 1]',
        '    elif s < target: L += 1',
        '    else: R -= 1',
        '# ends with NO answer…'
      ],
      steps
    };
  }

  /* ── P4 · Sliding window (min size subarray sum ≥ target) ── */
  function minSubarrayTrace(nums, target, mode) {
    const n = nums.length;
    const steps = [];
    const winMarks = (l, r, extra = {}) => {
      const m = {};
      if (r >= l) for (let i = l; i <= r; i++) m[i] = 'win';
      Object.keys(extra).forEach(k => { m[k] = extra[k]; });
      return m;
    };

    steps.push({
      line: 0,
      caption: 'best = ∞ · left = 0 · total = 0',
      narration: `We track the best length found so far, the left edge of the window, and the running total. The window starts empty.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'target', value: target }, { label: 'total', value: 0 }, { label: 'best', value: '∞' }] },
      fx: { type: 'init' }
    });

    let left = 0, total = 0, best = Infinity;

    for (let right = 0; right < n; right++) {
      /* decision: grow */
      if (mode === 'drive') {
        steps.push({
          line: 1,
          caption: `total = ${total} < ${target} — window not valid yet`,
          narration: '',
          state: {
            arr: [...nums], ptrs: right > left ? { L: left, R: right - 1 } : (right > 0 ? { L: left, R: right - 1 } : {}),
            marks: right > 0 ? winMarks(left, right - 1) : {},
            aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best === Infinity ? '∞' : best }]
          },
          fx: { type: 'none' },
          drive: {
            prompt: `total = ${total} is below the target ${target}. Grow right, or record & shrink?`,
            options: ['Grow: total += nums[R]', 'Record best & shrink'],
            correct: 0,
            why: 'The window is not valid yet — only growing can make the total reach the target.',
            hint: 'Is total ≥ target? If not, shrinking only makes it smaller.'
          }
        });
      }

      total += nums[right];
      steps.push({
        line: 2,
        caption: `R = ${right} · total += ${nums[right]} → ${total}`,
        narration: `The window grows to include index ${right}. Total is now ${total}.`,
        state: {
          arr: [...nums], ptrs: { L: left, R: right },
          marks: winMarks(left, right),
          aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best === Infinity ? '∞' : best }]
        },
        fx: { type: 'grow' }
      });

      while (total >= target) {
        const len = right - left + 1;
        /* watch-mode prediction on EVERY valid window (comprehension checks
         should punctuate the whole trace, not just its first moment) */
        if (mode === 'watch') {
          steps.push({
            line: 3,
            caption: `total = ${total} ≥ ${target} — the window is VALID`,
            narration: `The total, ${total}, reached the target. The window is valid now. Pause: what should we do with a valid window?`,
            state: {
              arr: [...nums], ptrs: { L: left, R: right },
              marks: winMarks(left, right, { [left]: 'cmp' }),
              aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best === Infinity ? '∞' : best }]
            },
            fx: { type: 'compare', indices: [left, right] },
            predict: {
              q: `The window [${left}..${right}] is valid (total ${total} ≥ ${target}). What next?`,
              options: ['Record its length, then try shrinking it', 'Keep growing — bigger is better', 'Restart the window'],
              correct: 0,
              why: 'We want the SMALLEST valid window. We already recorded this one, so shrinking can only find something better — never worse.'
            }
          });
        }

        best = Math.min(best, len);
        steps.push({
          line: 4,
          caption: `valid! len ${len} → best = ${best}`,
          narration: `Window length ${len} is valid, so best becomes ${best}. Now shrink from the left to look for something smaller.`,
          state: {
            arr: [...nums], ptrs: { L: left, R: right },
            marks: winMarks(left, right, { [left]: 'cmp' }),
            aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best }]
          },
          fx: { type: 'compare', indices: [left, right] }
        });

        /* decision: shrink */
        if (mode === 'drive') {
          steps.push({
            line: 3,
            caption: `total = ${total} ≥ ${target} — still valid`,
            narration: '',
            state: {
              arr: [...nums], ptrs: { L: left, R: right },
              marks: winMarks(left, right, { [left]: 'cmp' }),
              aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best }]
            },
            fx: { type: 'none' },
            drive: {
              prompt: `total = ${total} still ≥ ${target}. Grow right, or record & shrink?`,
              options: ['Record best & shrink', 'Grow: total += nums[R]'],
              correct: 0,
              why: 'While the window is valid we keep shrinking — the best-so-far is already recorded, so shrinking is free.',
              hint: 'We want the smallest valid window. What does growing do to the size?'
            }
          });
        }

        total -= nums[left];
        steps.push({
          line: 5,
          caption: `total -= ${nums[left]} → ${total} · L moves to ${left + 1}`,
          narration: `We remove ${nums[left]} from the total and slide the left edge right.`,
          state: {
            arr: [...nums], ptrs: { L: Math.min(left + 1, right), R: right },
            marks: winMarks(Math.min(left + 1, right), right, { [left]: 'out' }),
            aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best }]
          },
          fx: { type: 'shrink' }
        });
        left++;
      }
    }

    /* final reveal */
    let bl = -1;
    outer: for (let l = 0; l < n; l++) {
      let t = 0;
      for (let r = l; r < n; r++) {
        t += nums[r];
        if (t >= target && (r - l + 1) === best) { bl = l; break outer; }
      }
    }
    steps.push({
      line: 7,
      caption: `return best = ${best}`,
      narration: `Every element entered the window once and left at most once, so this is linear time. The best valid window had length ${best}.`,
      state: {
        arr: [...nums], ptrs: bl >= 0 ? { L: bl, R: bl + best - 1 } : {},
        marks: bl >= 0 ? winMarks(bl, bl + best - 1) : {},
        aux: [{ label: 'target', value: target }, { label: 'best', value: best, done: true }]
      },
      fx: { type: 'found' }
    });

    return {
      code: [
        'best, left, total = inf, 0, 0',
        'for right in range(len(nums)):',
        '    total += nums[right]',
        '    while total >= target:',
        '        best = min(best, right - left + 1)',
        '        total -= nums[left]',
        '        left += 1',
        'return best'
      ],
      steps
    };
  }

  /* ── P4 · Misconception: window + negatives ── */
  function windowBugTrace(nums, target) {
    /* runs the SAME algorithm on data where monotonicity breaks */
    const n = nums.length;
    const steps = [];
    steps.push({
      line: 0,
      caption: '⚠️ negatives present — watch the assumption break',
      narration: `Same window code, but this array hides a negative number. The window logic assumes growing always helps the total reach the target. Negatives break that.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'target', value: target }, { label: 'total', value: 0 }, { label: 'best', value: '∞' }] },
      fx: { type: 'init' }
    });
    let left = 0, total = 0, best = Infinity;
    for (let right = 0; right < n; right++) {
      total += nums[right];
      steps.push({
        line: 2,
        caption: `R = ${right} · total = ${total}`,
        narration: `Index ${right} enters. Total is now ${total}.${nums[right] < 0 ? ' Notice: growing just SUBTRACTED from the total.' : ''}`,
        state: {
          arr: [...nums], ptrs: { L: left, R: right },
          marks: (() => { const m = {}; for (let i = left; i <= right; i++) m[i] = 'win'; return m; })(),
          aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best === Infinity ? '∞' : best }]
        },
        fx: { type: 'grow' }
      });
      while (total >= target) {
        const len = right - left + 1;
        best = Math.min(best, len);
        steps.push({
          line: 4,
          caption: `valid → best = ${best}`,
          narration: `The window is valid, so best becomes ${best}. Shrink.`,
          state: {
            arr: [...nums], ptrs: { L: left, R: right },
            marks: (() => { const m = {}; for (let i = left; i <= right; i++) m[i] = 'win'; m[left] = 'cmp'; return m; })(),
            aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best }]
          },
          fx: { type: 'compare', indices: [left, right] }
        });
        total -= nums[left];
        steps.push({
          line: 5,
          caption: `total -= ${nums[left]} → ${total} · stop shrinking`,
          narration: `After removing ${nums[left]} the total is ${total}, below the target, so the shrink loop stops. The window algorithm believes it is done with this region.`,
          state: {
            arr: [...nums], ptrs: { L: Math.min(left + 1, right), R: right },
            marks: (() => { const m = {}; m[left] = 'out'; return m; })(),
            aux: [{ label: 'target', value: target }, { label: 'total', value: total }, { label: 'best', value: best }]
          },
          fx: { type: 'shrink' }
        });
        left++;
      }
    }
    steps.push({
      line: 7,
      caption: `return best = ${best} — but the true answer is 1!`,
      narration: `The algorithm reports ${best}. But the single element ${nums[n - 1]} at the end is at least ${target} on its own — the true answer is 1. The shrink loop stopped early because removing values is not always a loss when negatives are inside. Monotonicity was the whole contract.`,
      state: {
        arr: [...nums], ptrs: { L: n - 1, R: n - 1 },
        marks: { [n - 1]: 'win' },
        aux: [{ label: 'target', value: target }, { label: 'algorithm said', value: best, done: true }, { label: 'truth', value: 1 }]
      },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# window code, negatives ⚠️',
        'best, left, total = inf, 0, 0',
        'for right in range(len(nums)):',
        '    total += nums[right]',
        '    while total >= target:',
        '        best = min(best, right - left + 1)',
        '        total -= nums[left]',
        '        left += 1',
        'return best'
      ],
      steps
    };
  }

  /* ── P6 · Prefix sum ── */
  function prefixTrace(nums, queries, mode) {
    const steps = [];
    const prefix = [0];
    nums.forEach(x => prefix.push(prefix[prefix.length - 1] + x));

    steps.push({
      line: 0,
      caption: 'prefix = [0]',
      narration: `The prefix array starts with a single zero. That zero looks harmless — it is actually the trick that removes every special case. Watch.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [], row2: { label: 'prefix', arr: [0] } },
      fx: { type: 'init' }
    });

    nums.forEach((x, i) => {
      steps.push({
        line: 2,
        caption: `prefix[${i + 1}] = ${prefix[i]} + ${x} = ${prefix[i + 1]}`,
        narration: `Prefix index ${i + 1} holds the sum of everything up to and including ${x}: that is ${prefix[i + 1]}.`,
        state: {
          arr: [...nums], ptrs: { i }, marks: { [i]: 'cmp' }, aux: [],
          row2: { label: 'prefix', arr: prefix.slice(0, i + 2), marks: { [i + 1]: 'write' } }
        },
        fx: { type: 'build', value: prefix[i + 1] }
      });
    });

    queries.forEach((q, qi) => {
      const [l, r] = q;
      const diff = `prefix[${r + 1}] − prefix[${l}]`;
      const answer = prefix[r + 1] - prefix[l];

      const qStep = {
        line: 4,
        caption: `sumRange(${l}, ${r}) = ${diff}`,
        narration: `Query: sum of indices ${l} through ${r}. In a static array this is one subtraction: prefix ${r + 1} minus prefix ${l}.`,
        state: {
          arr: [...nums], ptrs: {}, marks: { [l]: 'cmp', [r]: 'cmp' },
          aux: [{ label: `sumRange(${l},${r})`, value: '?' }],
          row2: { label: 'prefix', arr: [...prefix], ptrs: { l, 'r+1': r + 1 }, marks: { [l]: 'cmp', [r + 1]: 'cmp' } }
        },
        fx: { type: 'compare', indices: [l, r + 1] }
      };

      if (mode === 'drive') {
        /* decision: which difference? vary the correct index */
        const formulas = [
          { text: `prefix[${r + 1}] − prefix[${l}]`, ok: true },
          { text: `prefix[${r}] − prefix[${l}]`, ok: false },
          { text: `prefix[${r + 1}] − prefix[${l + 1}]`, ok: false }
        ];
        const rotate = qi % 3;
        const shifted = formulas.slice(rotate).concat(formulas.slice(0, rotate));
        const correctIdx = shifted.findIndex(f => f.ok);
        qStep.drive = {
          prompt: `sumRange(${l}, ${r}) — which subtraction answers it?`,
          options: shifted.map(f => f.text),
          correct: correctIdx,
          why: `prefix[${r + 1}] sums indices 0..${r} and prefix[${l}] sums 0..${l - 1}. The difference is exactly indices ${l}..${r} = ${answer}.`,
          hint: `One end must cover everything up to r — the other must stop just BEFORE l.`
        };
        qStep.caption = `sumRange(${l}, ${r}) — pick the right subtraction`;
        qStep.narration = '';
      } else if (mode === 'watch') {
        /* checkpoint on EVERY query — understanding checks keep firing
           through the whole trace, not only on the first one or two */
        qStep.predict = (l === 0)
          ? {
              q: `This query starts at index 0: sumRange(0, ${r}). Which subtraction works?`,
              options: [`prefix[${r + 1}] − prefix[0]`, `prefix[${r + 1}] − prefix[1]`, 'This case needs a loop'],
              correct: 0,
              why: `prefix[0] is the leading zero — it represents "the sum of nothing". That is exactly what a query starting at index 0 needs to subtract.`
            }
          : {
              q: `sumRange(${l}, ${r}): what does prefix[${r + 1}] − prefix[${l}] equal?`,
              options: [String(answer), String(prefix[r + 1]), String(prefix[l]), String(answer + 1)],
              correct: 0,
              why: `${prefix[r + 1]} − ${prefix[l]} = ${answer}. One subtraction, no loop.`
            };
      }
      steps.push(qStep);

      steps.push({
        line: 4,
        caption: `= ${answer}`,
        narration: `${prefix[r + 1]} minus ${prefix[l]} is ${answer}. The answer arrives in constant time — no matter how long the array is.`,
        state: {
          arr: [...nums], ptrs: {}, marks: { [l]: 'win', [r]: 'win' },
          aux: [{ label: `sumRange(${l},${r})`, value: answer, done: qi === queries.length - 1 }],
          row2: { label: 'prefix', arr: [...prefix], ptrs: { l, 'r+1': r + 1 }, marks: { [l]: 'win', [r + 1]: 'win' } }
        },
        fx: { type: 'found' }
      });
    });

    return {
      code: [
        'prefix = [0]',
        'for x in nums:',
        '    prefix.append(prefix[-1] + x)',
        '',
        'def sumRange(l, r):',
        '    return prefix[r + 1] - prefix[l]'
      ],
      steps
    };
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  BRUTE-FORCE LAB TRACES (phase 2 — feel the cost)      */
  /* ═══════════════════════════════════════════════════════ */

  /* ── P1 · brute two-sum: check every pair ── */
  function twoSumBruteTrace(nums, target) {
    const n = nums.length;
    const totalPairs = n * (n - 1) / 2;
    const steps = [{
      line: 0,
      caption: 'the plain way',
      narration: `The obvious plan: try every pair. Before we run it — for ${n} numbers, how many pairs is that?`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'pairs', value: '?' }] },
      fx: { type: 'init' },
      predict: {
        q: `n = ${n}. How many pairs will the plain plan check?`,
        options: [`${n}`, `${totalPairs}`, `${n * n}`],
        correct: 1,
        why: `Every number pairs with every LATER one: ${n - 1} + ${n - 2} + … + 1 = ${totalPairs}. Roughly half of n squared.`
      }
    }];
    let checks = 0;
    for (let j = 1; j < n; j++) {
      checks++;
      const a = nums[0], b = nums[j], s = a + b;
      const hit = s === target;
      steps.push({
        line: 1,
        caption: `pair (0,${j}): ${a}+${b}=${s}`,
        narration: `${a} plus ${b} is ${s}.${hit ? ` A match — but it took ${checks} checks to get here.` : ' Not the target. Next pair.'}`,
        state: { arr: [...nums], ptrs: { L: 0, R: j }, marks: { 0: 'cmp', [j]: 'cmp' }, aux: [{ label: 'checks', value: checks }] },
        fx: { type: 'compare', indices: [0, j] }
      });
      if (hit) break;
    }
    steps.push({
      line: 1,
      caption: 'now scale it up',
      narration: `${checks} checks for ${n} numbers — and the answer only came that fast because it lived near the start. At a hundred thousand numbers this plan does about five billion checks.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'checks', value: checks }, { label: 'n = 100,000', value: '≈ 5,000,000,000' }] },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# the plain plan: try every pair',
        'for i in range(n):',
        '    for j in range(i + 1, n):',
        '        if nums[i] + nums[j] == target:',
        '            return [i, j]'
      ],
      steps
    };
  }

  /* ── P4 · brute min-subarray: try every stretch ── */
  function minSubarrayBruteTrace(nums, target) {
    const n = nums.length;
    const totalStretches = n * (n + 1) / 2;
    const steps = [{
      line: 0,
      caption: 'the plain way',
      narration: `The obvious plan: try every consecutive stretch. For ${n} cells, how many stretches are there?`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'stretches', value: '?' }] },
      fx: { type: 'init' },
      predict: {
        q: `n = ${n}. How many different consecutive stretches exist?`,
        options: [`${n * 2}`, `${totalStretches}`, `${n * n}`],
        correct: 1,
        why: `Every start extends to every end at or after it: ${n} + ${n - 1} + … + 1 = ${totalStretches}.`
      }
    }];
    let checks = 0;
    let best = Infinity;
    [0, 1].forEach(s => {
      let sum = 0;
      for (let e = s; e < n; e++) {
        checks++;
        sum += nums[e];
        const ok = sum >= target;
        steps.push({
          line: 4,
          caption: `start ${s}: +${nums[e]} → total ${sum}${ok ? ' ✓' : '…'}`,
          narration: `From cell ${s}, the stretch grows — running total ${sum}.${ok ? ` Reached the target with length ${e - s + 1}. Record it, then start all over again one cell later.` : ''}`,
          state: { arr: [...nums], ptrs: { l: s, 'r+1': e + 1 }, marks: (() => { const m = {}; for (let k = s; k <= e; k++) m[k] = 'cmp'; return m; })(), aux: [{ label: 'checks', value: checks }, { label: 'total', value: sum }, { label: 'best', value: best === Infinity ? '—' : best }] },
          fx: { type: 'grow' }
        });
        if (ok) {
          const oldBest = best;
          best = Math.min(best, e - s + 1);
          steps.push({
            line: 6,
            caption: `best = min(${oldBest === Infinity ? '∞' : oldBest}, ${e - s + 1}) = ${best}`,
            narration: `Length ${e - s + 1} is recorded as the best so far. The plain plan now abandons this start and re-walks from scratch one cell later.`,
            state: { arr: [...nums], ptrs: { l: s, 'r+1': e + 1 }, marks: (() => { const m = {}; for (let k = s; k <= e; k++) m[k] = 'win'; return m; })(), aux: [{ label: 'checks', value: checks }, { label: 'best', value: best }] },
            fx: { type: 'found' }
          });
          break;
        }
      }
    });
    steps.push({
      line: 2,
      caption: '…and again, for every start',
      narration: `Each start rescans cells that were already scanned. ${totalStretches} stretches for ${n} cells — and at a hundred thousand cells, about five billion re-reads.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 'stretches', value: totalStretches }, { label: 'n = 100,000', value: '≈ 5,000,000,000 re-reads' }] },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# the plain plan: try every stretch',
        'for start in range(n):',
        '    total = 0',
        '    for end in range(start, n):',
        '        total += nums[end]',
        '        if total >= target:',
        '            best = min(best, end - start + 1)'
      ],
      steps
    };
  }

  /* ── P6 · brute range-sums: rescan for every query ── */
  function prefixBruteTrace(nums, queries) {
    const steps = [{
      line: 0,
      caption: 'the plain way',
      narration: 'The obvious plan: when a question arrives, walk the cells and add them up. Three questions are about to arrive — watch what gets re-read.',
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 're-reads', value: 0 }] },
      fx: { type: 'init' },
      predict: {
        q: '500 questions on a 1,000-cell row, rescanning every time — how many cell-reads is that?',
        options: ['1,500', '50,500', '500,000'],
        correct: 2,
        why: '500 × 1,000 — every single question walks the whole distance again.'
      }
    }];
    let reads = 0;
    queries.forEach(([l, r], qi) => {
      let sum = 0;
      for (let i = l; i <= r; i++) {
        reads++;
        sum += nums[i];
        steps.push({
          line: 1,
          caption: `Q${qi + 1}: read cell ${i} → ${sum}`,
          narration: `Question ${qi + 1} walks cell ${i}. Running total: ${sum}.`,
          state: { arr: [...nums], ptrs: { i }, marks: { [i]: 'cmp' }, aux: [{ label: 're-reads', value: reads }, { label: `Q${qi + 1} sum`, value: sum }] },
          fx: { type: 'write', indices: [i] }
        });
      }
      steps.push({
        line: 1,
        caption: `Q${qi + 1} = ${sum}`,
        narration: `Answer: ${sum}. That was ${r - l + 1} cells re-read — cells earlier questions had already read.`,
        state: { arr: [...nums], ptrs: {}, marks: { [l]: 'win', [r]: 'win' }, aux: [{ label: 're-reads', value: reads }, { label: `Q${qi + 1}`, value: sum, done: qi === queries.length - 1 }] },
        fx: { type: 'found' }
      });
    });
    steps.push({
      line: 1,
      caption: 'same cells, read again and again',
      narration: `${reads} re-reads for three small questions. With five hundred questions on a thousand cells, the plain plan re-reads half a million times.`,
      state: { arr: [...nums], ptrs: {}, marks: {}, aux: [{ label: 're-reads', value: reads }, { label: '500 queries × 1,000 cells', value: '500,000' }] },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# the plain plan: rescan for every question',
        'def sum_range(l, r):',
        '    total = 0',
        '    for i in range(l, r + 1):',
        '        total += nums[i]',
        '    return total'
      ],
      steps
    };
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  LESSON DEFINITIONS                                     */
  /* ═══════════════════════════════════════════════════════ */
  /* ── F1 · Foundations: primitive traces ── */
  function primitivesTrace(letters, mode, opts = {}) {
    const n = letters.length;
    const steps = [];
    const preOpts = (opts && Array.isArray(opts.watchPredicts)) ? opts.watchPredicts : [1, 2];
    const allWin = {};
    for (let k = 0; k < n; k++) allWin[k] = 'win';

    steps.push({
      line: 0,
      caption: 'if len(s) < 2: return',
      narration: `Safety guard first — primitive 1's seatbelt. If the row has fewer than two letters there is nothing to swap, so we return before touching any index. We have ${n}: on we go.`,
      state: { arr: letters.slice(), ptrs: {}, marks: {}, aux: [{ label: 'len(s)', value: n }, { label: 'guard', value: 'safe' }] },
      fx: { type: 'init' }
    });
    steps.push({
      line: 1,
      caption: 'L, R = 0, ' + (n - 1),
      narration: `Primitive 1: two named hands. L starts at index 0, R at index ${n - 1} — opposite ends. Nothing has moved yet.`,
      state: { arr: letters.slice(), ptrs: { L: 0, R: n - 1 }, marks: {}, aux: [{ label: 'L', value: 0 }, { label: 'R', value: n - 1 }] },
      fx: { type: 'init' }
    });

    let L = 0, R = n - 1;
    let decisionCount = 0;
    let work = letters.slice();

    while (L < R) {
      const a = work[L], b = work[R];

      const bound = {
        line: 2,
        caption: `L < R ?  ${L} < ${R} → true`,
        narration: `Primitive 2: the loop bound is strict — while L < R. ${L} is less than ${R}, so the body runs.`,
        state: { arr: work.slice(), ptrs: { L, R }, marks: { [L]: 'cmp', [R]: 'cmp' }, aux: [{ label: 'L < R', value: `${L} < ${R} ✓` }] },
        fx: { type: 'compare', indices: [L, R] }
      };
      if (mode === 'watch') {
        /* checkpoint on EVERY bound decision — the learner must keep
           predicting, not just at the start of the trace */
        bound.predict = {
          q: `L = ${L} and R = ${R} — both hands point at letters. What does the loop body do first?`,
          options: ['swap s[L] ↔ s[R]', 'return immediately', 'R -= 1'],
          correct: 0,
          why: `The strict bound L < R is true, so the body runs — and the swap is the body's whole job.`
        };
        steps.push(bound);
      }

      if (mode === 'drive') {
        steps.push({
          line: 2,
          caption: `L = ${L}, R = ${R} — your move`,
          narration: '',
          state: bound.state,
          fx: { type: 'compare', indices: [L, R] },
          drive: {
            prompt: `L = ${L}, R = ${R}, and L < R. What does the loop do?`,
            options: ['swap s[L] ↔ s[R]', 'stop — the loop is over', 'skip this pair'],
            correct: 0,
            why: `${L} < ${R} so the strict bound holds — the swap runs. Primitive 2.`,
            hint: `Compare the two index numbers: is ${L} less than ${R}?`
          }
        });
      }

      const swapped = work.slice();
      swapped[L] = b; swapped[R] = a;
      work = swapped;
      steps.push({
        line: 3,
        caption: `swap ${a} ↔ ${b}`,
        narration: `Primitive 3: the in-place swap. One line — s[${L}], s[${R}] = s[${R}], s[${L}] — trades ${a} and ${b}. Zero extra memory.`,
        state: { arr: swapped.slice(), ptrs: { L, R }, marks: { [L]: 'win', [R]: 'win' }, aux: [{ label: 'swapped', value: `${a} ↔ ${b}` }] },
        fx: { type: 'write' }
      });

      if (mode === 'drive') {
        steps.push({
          line: 3,
          caption: 'swap done — your move',
          narration: '',
          state: { arr: swapped.slice(), ptrs: { L, R }, marks: { [L]: 'win', [R]: 'win' }, aux: [{ label: 'swapped', value: `${a} ↔ ${b}` }] },
          fx: { type: 'write' },
          drive: {
            prompt: 'The swap is done. What comes next?',
            options: ['L += 1 and R -= 1', 'swap the same pair again', 'stop — the loop is over'],
            correct: 0,
            why: 'Explicit steps: both hands walk inward by exactly one. Retired cells are never revisited.',
            hint: 'The ends are finished — where do the hands go next?'
          }
        });
      }

      const oldL = L, oldR = R;
      L += 1; R -= 1;
      const marks2 = {};
      marks2[oldL] = 'out'; marks2[oldR] = 'out';
      if (L <= R) { marks2[L] = 'cmp'; marks2[R] = 'cmp'; }
      steps.push({
        line: 5,
        caption: `L += 1 → ${L}, R -= 1 → ${R}`,
        narration: `Primitive 2 again: explicit steps. The hands walk inward — cells ${oldL} and ${oldR} are retired forever. L is now ${L}, R is now ${R}.`,
        state: { arr: work.slice(), ptrs: { L, R }, marks: marks2, aux: [{ label: 'L', value: L }, { label: 'R', value: R }] },
        fx: { type: 'move', indices: [L, R] }
      });
      decisionCount++;
    }

    const endState = {
      arr: work.slice(), ptrs: { L, R }, marks: allWin,
      aux: [{ label: 'L < R', value: 'false — stop' }, { label: 'done', value: '✓', done: true }]
    };
    const endStep = {
      line: 2,
      caption: `L < R ?  ${L} < ${R} → false — done`,
      narration: `Strict bound fires: ${L} < ${R} is false, so the loop stops. ${n % 2 === 1 ? 'Odd length: the hands MEET on the middle letter — swapped zero times, exactly as the strict bound promises.' : 'Even length: the hands CROSS — every pair swapped exactly once.'} The reversal is complete, with zero extra memory.`,
      state: endState,
      fx: { type: 'found' }
    };
    if (mode === 'watch') {
      endStep.predict = {
        q: `L = ${L} and R = ${R}. What happens next?`,
        options: ['the loop ends — L < R is false', 'swap s[L] ↔ s[R] one more time', 'L += 1 only'],
        correct: 0,
        why: 'The strict bound is the finish line: once the hands meet or cross, the loop stops. That is why the middle of an odd row is never touched.'
      };
      steps.push(endStep);
    } else if (mode === 'drive') {
      steps.push({
        line: 2,
        caption: `L = ${L}, R = ${R} — your move`,
        narration: '',
        state: endState,
        fx: { type: 'compare', indices: [] },
        drive: {
          prompt: `L = ${L}, R = ${R}. What now?`,
          options: ['stop — L < R is false, the loop is over', 'swap s[L] ↔ s[R]', 'R -= 1'],
          correct: 0,
          why: `${L} < ${R} is false. The strict bound ends the run — the hands have ${L === R ? 'met on the middle letter' : 'crossed'}.`,
          hint: 'Look at the two index numbers: is the left one still less than the right one?'
        }
      });
      steps.push({
        line: 2,
        caption: 'done — zero extra memory',
        narration: 'That is the whole toolkit working together: guard, init, strict bound, swap, explicit steps. One pass, zero rented memory, done.',
        state: endState,
        fx: { type: 'found' }
      });
    } else {
      steps.push(endStep);
    }

    return {
      code: [
        'def reverse(s):',
        '    if len(s) < 2: return      # guard',
        '    L, R = 0, len(s) - 1       # init: opposite ends',
        '    while L < R:               # bound: strict',
        '        s[L], s[R] = s[R], s[L]# swap: in place',
        '        L += 1                # step',
        '        R -= 1                # step'
      ],
      steps
    };
  }

  function primitivesBruteTrace(letters) {
    const n = letters.length;
    const steps = [{
      line: 0,
      caption: 'the copy plan',
      narration: `The plain way to reverse: rent a second array and copy everything backwards into it. Before we run it — for ${n} letters, how many extra cells does the copy rent?`,
      state: { arr: letters.slice(), ptrs: {}, marks: {}, aux: [{ label: 'extra cells', value: '?' }] },
      fx: { type: 'init' },
      predict: {
        q: `n = ${n}. How many extra cells will the copy plan rent?`,
        options: ['0', String(n), String(n * 2)],
        correct: 1,
        why: `The temp array holds all ${n} values — ${n} extra cells, on every single call.`
      }
    }];
    const temp = [];
    for (let i = n - 1; i >= 0; i--) {
      temp.push(letters[i]);
      steps.push({
        line: 2,
        caption: `temp[${temp.length - 1}] = s[${i}] = ${letters[i]}`,
        narration: `Copy ${letters[i]} into cell ${temp.length - 1} of the rented array. Extra memory used so far: ${temp.length}.`,
        state: {
          arr: letters.slice(), ptrs: { R: i }, marks: { [i]: 'cmp' },
          row2: { label: 'temp (rented)', arr: temp.slice() },
          aux: [{ label: 'extra cells', value: temp.length }]
        },
        fx: { type: 'write' }
      });
    }
    for (let i = 0; i < n; i++) {
      steps.push({
        line: 4,
        caption: `s[${i}] = temp[${i}] = ${temp[i]}`,
        narration: `Write ${temp[i]} back over the original — a full second pass, walking both arrays again.`,
        state: {
          arr: temp.slice(), ptrs: { L: i }, marks: { [i]: 'win' },
          row2: { label: 'temp (rented)', arr: temp.slice() },
          aux: [{ label: 'extra cells', value: n }, { label: 'passes', value: 2 }]
        },
        fx: { type: 'write' }
      });
    }
    steps.push({
      line: 5,
      caption: 'done — but the rent never stops',
      narration: `Same result — but the copy plan rented ${n} extra cells and made two full passes. The primitives plan rents zero cells and makes one. At a hundred thousand cells that is a hundred thousand cells of memory, paid on every single call.`,
      state: {
        arr: temp.slice(), ptrs: {}, marks: {},
        row2: { label: 'temp (rented)', arr: temp.slice() },
        aux: [{ label: 'extra cells', value: n }, { label: 'n = 100,000', value: '100,000 cells' }]
      },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# the copy plan: rent a second array',
        'temp = s[::-1]        # n extra cells',
        'for i in range(n):',
        '    s[i] = temp[i]    # second pass',
        '',
        '# vs the primitives:',
        '# L, R = 0, n - 1     # 0 extra cells',
        '# while L < R: swap; L += 1; R -= 1'
      ],
      steps
    };
  }

  function primitivesBugTrace(nums) {
    const n = nums.length;
    const arr = () => nums.slice();
    const steps = [{
      line: 0,
      caption: 'clean the zeros — but look at the guard',
      narration: `New job: erase the zeros in place. The read pointer r scans, the write pointer w waits. But look closely — the skip loop's guard has the junk test FIRST and the bounds check SECOND. Watch what happens when the zeros run all the way to the end.`,
      state: { arr: arr(), ptrs: { r: 0, w: 0 }, marks: {}, aux: [{ label: 'guard', value: 'junk and r < n — flipped!' }] },
      fx: { type: 'init' }
    }];
    steps.push({
      line: 2,
      caption: 'r reads 2 — keep',
      narration: `The overwrite rule fires: nums[w] = nums[r], and both hands step forward. Clean so far — the guard has not mattered yet.`,
      state: { arr: arr(), ptrs: { r: 1, w: 1 }, marks: { 0: 'win' }, aux: [{ label: 'keep?', value: '2 → yes' }] },
      fx: { type: 'write' }
    });
    steps.push({
      line: 4,
      caption: 'r reads 0 — enter the skip loop',
      narration: `Junk. The skip loop takes over: while nums of r equals zero AND r less than n — advance r. The condition order is about to matter.`,
      state: { arr: arr(), ptrs: { r: 1, w: 1 }, marks: { 1: 'out' }, aux: [{ label: 'keep?', value: '0 → skip' }] },
      fx: { type: 'compare', indices: [1] }
    });
    let r = 2;
    while (r <= n) {
      const last = r === n;
      steps.push({
        line: 4,
        caption: last ? `guard asks: nums[${r}] == 0 ?` : `skip → r = ${r}`,
        narration: last
          ? `The zeros reached the end — r is now ${r}, one PAST the last legal index ${n - 1}. With the junk test first, the guard asks for nums[${r}] before asking whether ${r} is even a legal index. Crash.`
          : `Still junk: r skips ahead to ${r}. The bounds check — had it run first — would have stopped here safely.`,
        state: { arr: arr(), ptrs: { r }, marks: { [Math.min(r, n - 1)]: 'cmp' }, aux: [{ label: 'r', value: r }, { label: 'legal?', value: r < n ? 'yes' : 'NO' }] },
        fx: last ? { type: 'buzz' } : { type: 'move', indices: [r] }
      });
      if (last) break;
      r++;
    }
    steps.push({
      line: 4,
      caption: 'IndexError 💥',
      narration: `Index error. The same loop with the guard the right way around — while r less than n and junk — checks the bound FIRST and stops cleanly at r = ${n}. Primitive 6 is one word order: bounds first, always.`,
      state: { arr: arr(), ptrs: { r: n }, marks: {}, aux: [{ label: '💥', value: 'IndexError' }, { label: 'fix', value: 'r < n first' }] },
      fx: { type: 'buzz' }
    });
    return {
      code: [
        '# flipped guard: junk test FIRST 💥',
        'while nums[r] == 0 and r < n:',
        '    r += 1',
        '',
        '# primitive 6: bounds first, always ✓',
        'while r < n and nums[r] == 0:',
        '    r += 1'
      ],
      steps
    };
  }

  const LESSONS = [
    {
      id: 'f1',
      icon: '🧱',
      title: 'Foundations: 6 Primitives',
      minutes: 13,
      hookTitle: 'Six moves build everything',
      hookText: 'Every array algorithm in this course — converging pointers, sliding windows, prefix sums — is assembled from the same six tiny code primitives: named pointers, guarded loop bounds, in-place swaps, read & write pointers, running state, and guarded skipping. Learn the moves once, and every pattern after this is just choreography.',
      hookNarration: 'Every array algorithm in this course is assembled from six tiny primitives: named pointers, guarded bounds, in-place swaps, read and write pointers, running state, and guarded skipping. Learn the moves once — every pattern after this is choreography.',
      objectives: [
        'Initialize pointers the three ways: opposite ends, same direction, anchor & runner',
        'Choose loop bounds deliberately — strict < versus inclusive <=',
        'Drive an in-place reverse yourself: guard, init, bound, swap, step',
        'Watch the skip loop crash when the bounds check comes second — and know the fix'
      ],
      problem: {
        mode: 'ends',
        setup: 'A row of letter tiles spells a word:',
        ask: 'Tap the two tiles that must swap FIRST to start turning the word backwards.',
        arr: ['c', 'o', 'd', 'e'],
        narration: 'A row of letter tiles spells a word: C, O, D, E. Tap the two tiles that must swap first to start turning the word backwards.',
        punch: 'Your eyes picked the two ends instantly — but "the two ends" is not code. Turning that instinct into a rule a machine can run takes exactly six tiny primitives. That is this lesson.'
      },
      brute: {
        trace: () => primitivesBruteTrace(['p', 'y', 't', 'h', 'o', 'n']),
        scale: [
          { n: 'n = 6', brute: '6 extra cells', pat: '0 extra cells' },
          { n: 'n = 1,000', brute: '1,000 extra cells', pat: '0 extra cells' },
          { n: 'n = 100,000', brute: '100,000 extra cells', pat: '0 extra cells' }
        ],
        punch: 'Time is the same — but the copy plan rents n cells of memory on every single call. The primitives pay two index variables. Forever.'
      },
      idea: {
        steps: [
          { word: 'INIT', text: 'Primitive 1 — pointer initialization. Two named hands: L = 0 at the left end, R = n − 1 at the right. Opposite ends, nothing moved yet.', state: { arr: ['p', 'y', 't', 'h', 'o', 'n'], ptrs: { L: 0, R: 5 }, marks: {} }, why: 'A named index is the computer version of pointing a finger — and primitive 1 always pairs with a guard: check len() BEFORE touching index 0, so empty input can never crash.', fx: { type: 'init' } },
          { word: 'BOUND', text: 'Primitive 2 — loop bounds. The strict rule: while L < R. The hands stop exactly when they meet or cross — the middle is never processed twice.', state: { arr: ['p', 'y', 't', 'h', 'o', 'n'], ptrs: { L: 0, R: 5 }, marks: {}, aux: [{ label: 'loop', value: 'while L < R' }] }, why: 'Strict (<) versus inclusive (<=) is not style — it decides whether the middle element is touched once or never. For a swap-reverse, strict is correct: the middle swapping with itself is wasted work.', fx: { type: 'compare', indices: [0, 5] } },
          { word: 'SWAP', text: 'Primitive 3 — the in-place swap. One line trades the two hands: p and n switch places.', state: { arr: ['n', 'y', 't', 'h', 'o', 'p'], ptrs: { L: 0, R: 5 }, marks: { 0: 'win', 5: 'win' }, aux: [{ label: 'swap', value: 'p ↔ n' }] }, why: 's[L], s[R] = s[R], s[L] reorders memory in place — no temp array, no second pass. This single line is why a reverse can run in O(1) extra space.', fx: { type: 'write' } },
          { word: 'STEP', text: 'Primitive 2 again — explicit steps. L += 1, R -= 1: the hands walk inward, one cell each. The ends are retired forever.', state: { arr: ['n', 'y', 't', 'h', 'o', 'p'], ptrs: { L: 1, R: 4 }, marks: { 0: 'out', 5: 'out', 1: 'cmp', 4: 'cmp' } }, why: 'Pointers never teleport — they move by explicit +1 and −1, and each retired cell is never revisited. That discipline is where every O(N) guarantee in this course comes from.', fx: { type: 'move', indices: [1, 4] } },
          { word: 'SWAP', text: 'Swap again — y and o trade places. The finished word is growing in from both ends.', state: { arr: ['n', 'o', 't', 'h', 'y', 'p'], ptrs: { L: 1, R: 4 }, marks: { 1: 'win', 4: 'win' }, aux: [{ label: 'swap', value: 'y ↔ o' }] }, fx: { type: 'write' } },
          { word: 'BOUND', text: 'The bound fires: after the last inward step, L = 3 and R = 2 — L < R is false, the loop stops. The middle t and h were swapped on the way. Primitives 1 + 2 + 3 just reversed six letters with zero extra memory.', state: { arr: ['n', 'o', 'h', 't', 'y', 'p'], ptrs: { L: 3, R: 2 }, marks: { 2: 'win', 3: 'win' }, aux: [{ label: 'L < R', value: 'false — stop' }] }, why: 'Count the work: 3 swaps for 6 letters. The strict bound guarantees the hands never overlap — every pair swapped exactly once, nothing twice.', fx: { type: 'found' } },
          { word: 'INIT', text: 'Primitives 4–6 need a new job: erase the zeros from [3, 0, 4, 0, 5] in place. Same primitive-1 move, two new roles: r reads, w writes. Both start at 0.', state: { arr: [3, 0, 4, 0, 5], ptrs: { r: 0, w: 0 }, marks: {} }, why: 'Initialization shapes the algorithm: opposite ends meant "converge", two same-direction indices mean "scan and build". The roles you assign at init decide what every later move means.', fx: { type: 'init' } },
          { word: 'WRITE', text: 'Primitive 4 — the overwrite rule. r reads 3 — keep it — so nums[w] = nums[r], then w steps forward. The clean zone grows to one cell.', state: { arr: [3, 0, 4, 0, 5], ptrs: { r: 0, w: 0 }, marks: { 0: 'win' }, aux: [{ label: 'keep?', value: '3 → yes' }] }, why: 'Writing at w never loses data: w only ever points at a cell that was already read. That single fact makes one-pass in-place filtering possible.', fx: { type: 'write' } },
          { word: 'STEP', text: 'Both hands step: r += 1, w += 1. Now r reads 0 — junk.', state: { arr: [3, 0, 4, 0, 5], ptrs: { r: 1, w: 1 }, marks: { 1: 'cmp' }, aux: [{ label: 'keep?', value: '0 → ?' }] }, fx: { type: 'move', indices: [1] } },
          { word: 'SKIP', text: 'Primitive 6 — guarded skipping. Junk does NOT fire the overwrite: w holds still while r skips ahead. The zero at index 1 is now doomed to be overwritten later.', state: { arr: [3, 0, 4, 0, 5], ptrs: { r: 2, w: 1 }, marks: { 1: 'out', 2: 'cmp' }, aux: [{ label: 'keep?', value: '0 → no' }] }, why: 'The skip loop always wears its seatbelt: while r < n and junk. Bounds FIRST, condition second — that word order is the difference between skipping and crashing.', fx: { type: 'move', indices: [2] } },
          { word: 'WRITE', text: 'r reads 4 — keep. nums[w] = 4: the doomed zero is overwritten and the clean zone becomes 3, 4.', state: { arr: [3, 4, 4, 0, 5], ptrs: { r: 2, w: 1 }, marks: { 1: 'win' }, aux: [{ label: 'write', value: 'nums[1] = 4' }] }, why: 'Watch the overwrite land: the zero at index 1 is gone — buried by the kept 4. No second array was ever rented.', fx: { type: 'write' } },
          { word: 'TRACK', text: 'Primitive 5 — running state. Alongside the pointers, one variable carries the answer-so-far. Here it is w itself — the clean length. In other jobs it is best = max(best, x), or a running sum.', state: { arr: [3, 4, 4, 0, 5], ptrs: { r: 3, w: 2 }, marks: { 2: 'cmp' }, aux: [{ label: 'state', value: 'w = 2 kept' }] }, why: 'State must be initialized BEFORE the loop — best at −∞, sums at 0 — so the first candidate is always honest. Then every iteration updates it the same way.', fx: { type: 'compare', indices: [2] } },
          { word: 'FOUND', text: 'The pass ends: the row reads 3, 4, 4, 0, 5 with w = 3 — the first three cells are the answer and the tail is garbage. Six primitives, one tiny job: initialize, guard the bounds, swap or overwrite in place, track state, skip the junk.', state: { arr: [3, 4, 4, 0, 5], ptrs: { r: 5, w: 3 }, marks: { 0: 'win', 1: 'win', 2: 'win' }, aux: [{ label: 'answer', value: '[3, 4, 4] · w = 3' }, { label: 'done', value: '✓', done: true }] }, why: 'w is the virtual length: the array is physically 5 cells, logically 3. In-place algorithms often end this way — the extra cells stay behind as harmless garbage.', fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Every array algorithm in this course is assembled from six primitives: [[0|named pointers]], [[1|guarded bounds and explicit steps]], and [[2|in-place writes]] — plus a running state when the answer is a number.',
        pairs: [
          { move: 'Named pointers → one index, one job', why: 'L, R, read, write: a named index is a promise — every move has a meaning you can say out loud.' },
          { move: 'Guarded bounds → never off the array', why: 'while L < R, or while r < n and junk: the bound is checked first, so a pointer can never walk off the edge. Guard order is primitive 6.' },
          { move: 'In-place writes → zero rented memory', why: 'Swap and the overwrite rule reorder inside the original array — O(1) space instead of a rented copy of size n.' }
        ]
      },
      codeMap: {
        intro: 'You have met all six. Tap the action words in the order the code runs — the reverse, with every primitive in its place.',
        lines: [
          { word: 'GUARD', code: 'if len(s) < 2: return', note: 'empty or one: nothing to do' },
          { word: 'INIT', code: 'L, R = 0, len(s) - 1', note: 'two hands, opposite ends' },
          { word: 'BOUND', code: 'while L < R:', note: 'strict: middle untouched' },
          { word: 'SWAP', code: 's[L], s[R] = s[R], s[L]', note: 'one line, zero extra memory' },
          { word: 'STEP', code: 'L += 1; R -= 1', note: 'hands walk inward' }
        ]
      },
      recognize: {
        q: 'A new task arrives on the scanner: erase every zero from a huge array — in place, one pass, no second array. Which primitive carries the job?',
        options: [
          { text: 'Read & write pointers — read scans, write overwrites', ok: true, why: 'The overwrite rule keeps kept values and buries junk — one pass, zero extra memory. Primitive 4 with a skip guard from primitive 6.' },
          { text: 'In-place swap — trade two hands', ok: false, why: 'Swap trades exactly two cells; erasing an unknown number of zeros needs the write boundary, not a trade.' },
          { text: 'Extreme values — track the best so far', ok: false, why: 'Running state carries a number, not the data. It never moves values around.' }
        ]
      },
      watch: () => primitivesTrace(['t', 'r', 'a', 'c', 'e'], 'watch'),
      drive: () => primitivesTrace(['f', 'i', 'g', 'h', 't'], 'drive'),
      bug: () => primitivesBugTrace([2, 0, 0, 0]),
      practice: () => primitivesTrace(['a', 'r', 'r', 'a', 'y'], 'drive'),
      invariant: 'The six primitives share one promise: an index only ever points where it is legal to point. The guard runs before the first touch, the bound runs before every step, and the overwrite rule only fires where w ≤ r — nothing is ever destroyed before it has been read.',
      explain: {
        question: 'In your own words: why must the bounds check come FIRST in every skip loop — while r < n and junk — and not second?',
        fallback: {
          q: 'What is the real reason the bounds check goes first?',
          options: [
            'Once r walks past the end, "junk?" asks about a cell that does not exist — the bounds check is the seatbelt that fires before the crash',
            'It is only a style rule — both orders give the same result',
            'Bounds-first makes the loop O(N) instead of O(N²)',
            'The junk test is faster to compute, so it should run first'
          ],
          correct: 0,
          why: '"and" short-circuits left to right: with the junk test first, the crash happens the moment the zeros reach the end — exactly what the bug run showed.'
        }
      },
      fightLabel: 'Foundations · Easy'
    },
    {
      id: 'p1',
      icon: '↔️',
      title: 'Converging Pointers',
      minutes: 13,
      hookTitle: 'Two friends, one sorted shelf',
      hookText: 'Two friends stand at opposite ends of a sorted shelf of numbered boxes. They want one box each, with a target total. Instead of checking every pair, they look only at THEIR two boxes — and every look lets one of them safely walk away. That is the whole pattern.',
      hookNarration: 'Two friends stand at opposite ends of a sorted shelf. Each look at their own two boxes is enough for one of them to safely walk away. That is the entire pattern.',
      objectives: [
        'See why a too-big sum lets you discard the RIGHT value forever',
        'Predict each move before the animation makes it',
        'Drive the pointers yourself on fresh input',
        'Break the pattern on unsorted data — and see exactly where it lies'
      ],
      problem: {
        mode: 'pair',
        setup: 'A locked gate shows a row of numbered tiles and a target:',
        ask: 'Tap two tiles that add up to exactly 9.',
        arr: [2, 7, 11, 15],
        target: 9,
        narration: 'A locked gate, four numbered tiles, and a target of nine. Tap the two tiles that open it.',
        punch: 'Your eyes did that instantly — but eyes are not a method. A computer needs a rule that works on a row of 100,000 tiles.'
      },
      brute: {
        trace: () => twoSumBruteTrace([1, 3, 5, 7, 9, 11, 13, 15], 16),
        scale: [
          { n: 'n = 8', brute: '28 pairs', pat: '7 moves' },
          { n: 'n = 1,000', brute: '499,500 pairs', pat: '≤ 999 moves' },
          { n: 'n = 100,000', brute: '≈ 5,000,000,000 pairs', pat: '≤ 99,999 moves' }
        ],
        punch: 'Every new number doubles the plain plan\'s damage — and adds exactly one move for the pattern.'
      },
      idea: {
        steps: [
          { word: 'SETUP', text: 'Two hands, one on each end. Nothing has been checked yet.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 3 }, aux: [{ label: 'target', value: 9 }] }, why: 'Why two hands? A single value can only be too big or too small — a hand at each end can answer for both directions at once.', fx: { type: 'init' } },
          { word: 'CHECK', text: 'Read only the two hands: 2 and 15 make 17 — too big.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 3 }, marks: { 0: 'cmp', 3: 'cmp' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 17 }] }, fx: { type: 'compare', indices: [0, 3] } },
          { word: 'DROP R', text: 'Too big means 15 is hopeless — every other partner for it is even larger. Drop 15 forever; the right hand steps left.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 2 }, marks: { 2: 'cmp', 3: 'out' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 17 }] }, why: 'Retiring 15 forever is only legal because the array is sorted — every other partner it could have met is even larger. No sorted order, no verdict.', fx: { type: 'move', indices: [2] } },
          { word: 'CHECK', text: '2 and 11 make 13. Still too big.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 2 }, marks: { 0: 'cmp', 2: 'cmp' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 13 }] }, fx: { type: 'compare', indices: [0, 2] } },
          { word: 'DROP R', text: 'Same verdict for 11 — it can never be part of the answer. Drop it.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 1 }, marks: { 1: 'cmp', 2: 'out' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 13 }] }, fx: { type: 'move', indices: [1] } },
          { word: 'CHECK', text: '2 and 7 make 9 — an exact match.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 1 }, marks: { 0: 'cmp', 1: 'cmp' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 9 }] }, fx: { type: 'compare', indices: [0, 1] } },
          { word: 'FOUND', text: 'Three drops, one match. Every CHECK did not just test a pair — it retired an entire value forever. Sorted order is what makes that verdict safe.', state: { arr: [2, 7, 11, 15], ptrs: { L: 0, R: 1 }, marks: { 0: 'win', 1: 'win' }, aux: [{ label: 'target', value: 9 }, { label: 'sum', value: 9 }, { label: 'done', value: '✓', done: true }] }, why: 'Count it: at most n − 1 moves total. Every CHECK retired an entire value forever — that is where the speed comes from, and why sorting first can still be worth it.', fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Given a [[0|sorted]] array of numbers and a [[1|target]], find the [[2|pair]] of entries that adds up to the target.',
        pairs: [
          { move: 'Sorted → movement has direction', why: 'Sorted order is why one comparison can safely retire a value forever. No sorting, no pattern.' },
          { move: 'Target → one number to compare against', why: 'There is exactly one number to beat, so a single sum tells you which side is guilty.' },
          { move: 'Pair → two hands, two ends', why: 'Exactly two chosen values means two pointers — start at opposite ends and converge.' }
        ]
      },
      codeMap: {
        intro: 'You already know the action words. Tap them in the order the code runs, and watch each one become a line of code.',
        lines: [
          { word: 'SETUP', code: 'L, R = 0, len(nums) - 1', note: 'two hands, two ends' },
          { word: 'REPEAT', code: 'while L < R:', note: 'until the hands meet' },
          { word: 'CHECK', code: 's = nums[L] + nums[R]', note: 'read only the two hands' },
          { word: 'FOUND', code: 'if s == target: return [L+1, R+1]', note: 'exact match' },
          { word: 'DROP R', code: 'elif s > target: R -= 1', note: 'too big — right value retires' },
          { word: 'DROP L', code: 'else: L += 1', note: 'too small — left value retires' }
        ]
      },
      recognize: {
        q: 'A new problem just arrived on the scanner. Which pattern do you call?',
        options: [
          { text: 'A sorted array and a target — find the two entries that add up to it', ok: true, why: 'Sorted + pair + target: direction is guaranteed, so two hands converge from the ends.' },
          { text: 'Find the shortest run of consecutive cells whose sum reaches a limit', ok: false, why: 'A consecutive stretch is a window that grows and shrinks — the sliding window pattern.' },
          { text: 'The same array every time — answer thousands of "sum from here to here" questions', ok: false, why: 'Repeated range sums on a static array: pay once, query forever — prefix sums.' }
        ]
      },
      watch: () => twoSumTrace([2, 7, 11, 15], 9, 'watch', { watchPredicts: [1, 2] }),
      drive: () => twoSumTrace([1, 3, 4, 6, 8, 10, 13], 13, 'drive'),
      bug: () => twoSumBugTrace([10, 2, 3, 8], 5),
      practice: () => twoSumTrace([3, 5, 8, 11, 14, 17], 19, 'drive'),
      invariant: 'Sorted order guarantees: if nums[L]+nums[R] > target, then nums[R] paired with L (or with ANY later, larger L-value) always overshoots — nums[R] can never be in a valid pair, so discarding it loses nothing. Symmetrically for a too-small sum with nums[L].',
      explain: {
        question: 'In your own words: why is it always safe to move R left when the sum is too big?',
        fallback: {
          q: 'Which statement is the real reason R can be discarded when the sum is too big?',
          options: [
            'Every other value L could pair it with is at least as large as nums[L], so every other pair overshoots at least as much',
            'R is always the biggest element, so it is never useful',
            'Moving L would make the sum even bigger, so we have no choice but to try R elsewhere',
            'It is a heuristic — we might miss the answer but usually do not'
          ],
          correct: 0,
          why: 'Discarding is only safe because sorted order makes "any other pair with nums[R]" strictly worse.'
        }
      },
      fightLabel: 'Converging · Easy'
    },
    {
      id: 'p4',
      icon: '🪟',
      title: 'Sliding Window',
      minutes: 14,
      hookTitle: 'A worm, not a scanner',
      hookText: 'A brute-force scan checks every starting point. A window does something smarter: it crawls. New elements enter on the right, old ones fall off on the left, and nothing is ever visited twice. You will see WHY the "wasted work" disappears.',
      hookNarration: 'A brute force scan checks every starting point. A window crawls: elements enter on the right, fall off on the left, and nothing is ever visited twice.',
      objectives: [
        'Watch total and window grow and shrink in sync with the code',
        'Predict what to do with a VALID window (the counter-intuitive part)',
        'Drive grow/shrink decisions yourself',
        'See the window fail on negative numbers — and understand the exact assumption it broke'
      ],
      problem: {
        mode: 'stretch',
        setup: 'A corridor of numbered rooms, each holding charge. You need at least 7 units:',
        ask: 'Tap the first and last room of a stretch that reaches 7 — and try to use as few rooms as possible.',
        arr: [2, 3, 1, 2, 4, 3],
        target: 7,
        winLen: 2,
        narration: 'A corridor of numbered rooms. Tap the first and last room of a stretch that reaches seven units of charge — using as few rooms as you can.',
        punch: 'Whatever stretch you found, a longer one also worked — that is exactly the tension the pattern exploits.'
      },
      brute: {
        trace: () => minSubarrayBruteTrace([2, 3, 1, 2, 4, 3], 7),
        scale: [
          { n: 'n = 6', brute: '21 stretches', pat: 'each cell visited twice' },
          { n: 'n = 1,000', brute: '500,500 stretches', pat: '~2,000 visits' },
          { n: 'n = 100,000', brute: '≈ 5,000,000,000 stretches', pat: '~200,000 visits' }
        ],
        punch: 'The plain plan re-reads cells it has already read. The window never does: each cell enters once and leaves once.'
      },
      idea: {
        steps: [
          { word: 'SETUP', text: 'A rubber band around the start of the row. It holds cell 0 — charge 2. Not enough.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 0, 'r+1': 1 }, aux: [{ label: 'total', value: 2 }, { label: 'need', value: 7 }] }, why: 'The window is a rubber band: only its two edges ever move, and neither edge ever moves left. That one rule is the entire speed guarantee.', fx: { type: 'init' } },
          { word: 'GROW', text: 'Short of the goal — the band stretches right and swallows cell 1. Total: 5.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 0, 'r+1': 2 }, marks: { 1: 'cmp' }, aux: [{ label: 'total', value: 5 }, { label: 'need', value: 7 }] }, fx: { type: 'grow' } },
          { word: 'GROW', text: 'Still short. Swallow cell 2. Total: 6.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 0, 'r+1': 3 }, marks: { 2: 'cmp' }, aux: [{ label: 'total', value: 6 }, { label: 'need', value: 7 }] }, fx: { type: 'grow' } },
          { word: 'GROW', text: 'One more: cell 3. Total: 8 — goal reached!', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 0, 'r+1': 4 }, marks: { 3: 'cmp' }, aux: [{ label: 'total', value: 8 }, { label: 'need', value: 7 }] }, fx: { type: 'grow' } },
          { word: 'RECORD', text: 'A valid stretch of length 4. Save it as the best-so-far — then immediately try to do better.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 0, 'r+1': 4 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win' }, aux: [{ label: 'best', value: 4 }, { label: 'need', value: 7 }] }, why: 'Record-then-shrink is the counter-intuitive heart of the pattern: a valid window is not a finish line — it is the starting point for hunting a shorter one.', fx: { type: 'found' } },
          { word: 'SHRINK', text: 'Drop the oldest cell from the left. The band only ever moves forward — cell 0 is gone for good. Total: 6. Too small now, so…', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 1, 'r+1': 4 }, marks: { 0: 'out' }, aux: [{ label: 'total', value: 6 }, { label: 'best', value: 4 }] }, why: 'Shrinking cannot lose the answer — the length-4 window is already saved in "best". The band risks nothing by trying to do better.', fx: { type: 'shrink' } },
          { word: 'GROW', text: '…grow again: cell 4 joins. Total: 10 — and now the shrinking pays the whole debt.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 1, 'r+1': 5 }, marks: { 4: 'cmp' }, aux: [{ label: 'total', value: 10 }, { label: 'best', value: 4 }] }, fx: { type: 'grow' } },
          { word: 'FOUND', text: 'Shrink, shrink: lengths 4, 3, then 2 — cells 4 and 5 alone carry 7. The band moved only right: every cell entered once and left once. That is why the whole hunt is tiny work.', state: { arr: [2, 3, 1, 2, 4, 3], ptrs: { l: 4, 'r+1': 6 }, marks: { 4: 'win', 5: 'win' }, aux: [{ label: 'best', value: 2 }, { label: 'need', value: 7 }, { label: 'done', value: '✓', done: true }] }, why: 'Count the edge-moves: 6 cells entered once, some left once — about 2n moves total, never n². That is what "each cell visited at most twice" actually buys you.', fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Find the [[0|shortest]] [[1|consecutive]] run of numbers whose [[2|sum reaches at least]] a limit.',
        pairs: [
          { move: 'Shortest → valid is not finished', why: 'A working stretch is not the answer — record its length and keep hunting for shorter.' },
          { move: 'Consecutive → a window, not a pair', why: 'Contiguous cells form a stretch: a band that grows on the right and shrinks on the left.' },
          { move: 'Sum reaches at least → grow, then shrink', why: 'The goal is a threshold, not an exact value: grow until you cross it, then shrink hard.' }
        ]
      },
      codeMap: {
        intro: 'Grow, shrink, record — tap the action words in the order the code runs.',
        lines: [
          { word: 'SETUP', code: 'left, best, total = 0, inf, 0', note: 'empty window, no answer yet' },
          { word: 'GROW', code: 'for right in range(n): total += nums[right]', note: 'stretch right, swallow a cell' },
          { word: 'CHECK', code: 'while total >= target:', note: 'valid — but is it shorter?' },
          { word: 'RECORD', code: 'best = min(best, right - left + 1)', note: 'save the best-so-far' },
          { word: 'SHRINK', code: 'total -= nums[left]; left += 1', note: 'drop the oldest cell' },
          { word: 'ANSWER', code: 'return 0 if best == inf else best', note: 'no valid run → zero' }
        ]
      },
      recognize: {
        q: 'A new problem just arrived on the scanner. Which pattern do you call?',
        options: [
          { text: 'Shortest run of consecutive cells whose sum crosses a limit', ok: true, why: 'Consecutive + threshold + shortest: a window that grows and shrinks, keeping the best.' },
          { text: 'Sorted array, one target, find the two entries that hit it', ok: false, why: 'Sorted + pair: converging pointers from the two ends.' },
          { text: 'Answer thousands of range-sum questions on a frozen array', ok: false, why: 'Static array + many queries: precompute running totals — prefix sums.' }
        ]
      },
      watch: () => minSubarrayTrace([2, 3, 1, 2, 4, 3], 7, 'watch'),
      drive: () => minSubarrayTrace([5, 1, 1, 9, 2], 8, 'drive'),
      bug: () => windowBugTrace([1, -1, 5], 5),
      practice: () => minSubarrayTrace([4, 2, 2, 7, 1, 2], 8, 'drive'),
      invariant: 'left and right each move only forward and at most N steps, so each element enters the window once and leaves at most once — the nested while loop still totals O(N). Shrinking after recording is safe because the best-so-far is already saved.',
      explain: {
        question: 'The while-loop lives INSIDE the for-loop. Explain why the total work is still O(N), not O(N²).',
        fallback: {
          q: 'Why is the nested while loop still O(N) overall?',
          options: [
            'left only moves forward across the whole run — it can cross N elements once, not N times per element',
            'The while loop rarely runs many times',
            'Modern compilers optimize nested loops',
            'Both loops share the same counter'
          ],
          correct: 0,
          why: 'Amortized view: each element is added once by the for-loop and removed at most once by the while-loop.'
        }
      },
      fightLabel: 'Sliding Window · Easy'
    },
    {
      id: 'p6',
      icon: '🧮',
      title: 'Prefix Sum',
      minutes: 13,
      hookTitle: 'Pay once, query forever',
      hookText: 'One pass down the array buys you every range-sum for the price of one subtraction. The entire magic is one extra zero at the front — you will watch exactly what that zero is for, and what breaks without it.',
      hookNarration: 'One pass down the array buys every range sum for the price of one subtraction. The magic is one extra zero at the front.',
      objectives: [
        'Watch the prefix array grow, cell by cell',
        'Answer range queries with a single subtraction',
        'See why queries starting at index 0 need NO special case',
        'Drive: pick the right subtraction yourself'
      ],
      problem: {
        mode: 'stretch',
        setup: 'Control keeps asking range questions about this row:',
        ask: 'Tap the first and last cell of positions 1…3 to total them by hand.',
        arr: [3, 1, 4, 1, 5],
        target: null,
        query: [1, 3],
        narration: 'Control keeps asking range questions about this row. Tap the first and last cell of positions one to three to total them by hand.',
        punch: 'Now imagine the same question arriving a thousand times, each time walking the cells again.'
      },
      brute: {
        trace: () => prefixBruteTrace([3, 1, 4, 1, 5], [[0, 2], [1, 3], [2, 4]]),
        scale: [
          { n: '3 questions', brute: '9 re-reads', pat: 'build 5, then 1 subtraction each' },
          { n: '500 questions × 1,000 cells', brute: '500,000 re-reads', pat: 'build 1,000 + 500 subtractions' },
          { n: '1,000,000 questions', brute: '≈ 1,000,000,000 re-reads', pat: 'still 1,000 + 1M subtractions' }
        ],
        punch: 'The array never changes — so the plain plan pays for it again with every single question.'
      },
      idea: {
        steps: [
          { word: 'ZERO', text: 'Write down a zero — the sum of nothing. This one digit kills every special case.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, row2: { label: 'prefix', arr: [0] } }, why: 'The zero IS the sum of nothing. It looks decorative — it is actually what makes every later subtraction legal, including sums that start at index 0.', fx: { type: 'write' } },
          { word: 'BUILD', text: 'Walk the row once, keeping a running total. Three lands in the next slot.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, row2: { label: 'prefix', arr: [0, 3], marks: { 1: 'cmp' } } }, why: 'Each new prefix is just "previous prefix + one cell" — one addition per cell, no matter how long the array is.', fx: { type: 'build', value: 3 } },
          { word: 'BUILD', text: '3 + 1 = 4. Then 4 + 4 = 8, 8 + 1 = 9, 9 + 5 = 14 — one walk, five additions, the whole table is built.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, row2: { label: 'prefix', arr: [0, 3, 4, 8, 9, 14], marks: { 2: 'cmp', 3: 'cmp', 4: 'cmp', 5: 'cmp' } } }, fx: { type: 'build', value: 14 } },
          { word: 'POINT', text: 'sumRange(1,3) arrives. Point at the slot AFTER the right edge — and the slot AT the left edge.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, row2: { label: 'prefix', arr: [0, 3, 4, 8, 9, 14], ptrs: { l: 1, 'r+1': 4 } } }, why: 'Both slots exist only because of the leading zero: "just past the right edge" and "at the left edge" are always valid positions — no special cases anywhere.', fx: { type: 'compare', indices: [1, 4] } },
          { word: 'SUBTRACT', text: '8 − 3 = 5. One subtraction — no matter how far apart the ends are.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, marks: { 1: 'win', 3: 'win' }, aux: [{ label: 'sumRange(1,3)', value: 5 }], row2: { label: 'prefix', arr: [0, 3, 4, 8, 9, 14], marks: { 1: 'win', 4: 'win' } } }, why: 'One subtraction replaced walking 3 cells — and it would replace walking a million cells just as cheaply. The distance between the ends is irrelevant.', fx: { type: 'found' } },
          { word: 'REPEAT', text: 'Every future question is the same trick: pay for the array once, subtract forever.', state: { arr: [3, 1, 4, 1, 5], ptrs: {}, aux: [{ label: 'queries answered', value: '∞' }], row2: { label: 'prefix', arr: [0, 3, 4, 8, 9, 14], marks: { 1: 'win', 4: 'win' } } }, fx: { type: 'win' } }
        ]
      },
      triggers: {
        text: 'The array is [[0|frozen]]. Answer [[1|thousands of]] "sum from position a to position b" [[2|queries]] — fast.',
        pairs: [
          { move: 'Frozen → precompute is possible', why: 'The array never changes, so work done once stays valid for every future question.' },
          { move: 'Thousands of → pay once, reuse forever', why: 'Many questions over the same data: build the helper once, then answer each in one step.' },
          { move: 'Queries → every answer is a difference', why: 'Any range sum is just "total up to the right edge" minus "total up to the left edge".' }
        ]
      },
      codeMap: {
        intro: 'Zero, build, point, subtract — tap the action words in the order the code runs.',
        lines: [
          { word: 'ZERO', code: 'prefix = [0]', note: 'the sum of nothing' },
          { word: 'BUILD', code: 'for x in nums: prefix.append(prefix[-1] + x)', note: 'one walk, running total' },
          { word: 'POINT', code: 'def sumRange(l, r):', note: 'a question arrives' },
          { word: 'SUBTRACT', code: '    return prefix[r + 1] - prefix[l]', note: 'after the right edge, at the left edge' }
        ]
      },
      recognize: {
        q: 'A new problem just arrived on the scanner. Which pattern do you call?',
        options: [
          { text: 'The array never changes; answer thousands of "sum between positions a and b" questions', ok: true, why: 'Frozen array + many range sums: precompute running totals once — prefix sums.' },
          { text: 'Sorted array, one target, find the pair that hits it', ok: false, why: 'Sorted + pair: converging pointers from the two ends.' },
          { text: 'Shortest consecutive stretch whose sum crosses a limit', ok: false, why: 'Consecutive + shortest: a window that grows and shrinks.' }
        ]
      },
      watch: () => prefixTrace([3, 1, 4, 1, 5], [[1, 3], [0, 2]], 'watch'),
      drive: () => prefixTrace([2, 4, 1, 6, 3], [[0, 3], [2, 4], [1, 1]], 'drive'),
      practice: () => prefixTrace([2, 5, 1, 3, 6], [[0, 4], [2, 3], [1, 1]], 'drive'),
      bug: null,  /* misconception shown as a card (crash, not a trace) */
      misconceptionCard: {
        title: 'The missing zero',
        text: 'Drop the leading zero and the code everyone writes first appears:\n\nprefix = []\nfor x in nums: prefix.append((prefix[-1] if prefix else 0) + x)\nreturn prefix[right] - prefix[left - 1]\n\nNow sumRange(0, r) evaluates prefix[-1] — in Python that silently wraps to the LAST element; in most languages it crashes. One wrong answer per session, all from a missing zero. The leading zero is not decoration: it is the boundary case, precomputed.',
        narration: 'Drop the leading zero, and queries that start at index zero either crash or silently read the wrong end of the array. The leading zero is not decoration. It is the boundary case, precomputed.'
      },
      invariant: 'prefix[i] = sum of the first i elements. sumRange(l, r) = prefix[r+1] − prefix[l]. The leading zero makes prefix[l] exist for l = 0, removing every special case.',
      explain: {
        question: 'Why does the prefix array start with a 0, and why does that make every query — including ones starting at index 0 — a single subtraction?',
        fallback: {
          q: 'What does the leading zero actually do?',
          options: [
            'It represents "the sum of zero elements", so queries with left = 0 subtract a valid boundary instead of a missing one',
            'It shifts every index by one for no reason other than style',
            'It stores the array length for quick access',
            'It protects against integer overflow'
          ],
          correct: 0,
          why: 'prefix[0] = "sum of nothing" — exactly what a query starting at index 0 must subtract.'
        }
      },
      fightLabel: 'Prefix Sum · Easy'
    }
  ];

  /* ═══════════════════════════════════════════════════════ */
  /*  LESSON PLAYER (flow state machine)                    */
  /* ═══════════════════════════════════════════════════════ */
  let handlers = { onExit: () => {}, onFight: () => {} };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function statusOf(id) {
    try {
      const rec = (S.profile.lessons || {})[id];
      return rec?.completed ? 'done' : 'new';
    } catch (e) { return 'new'; }
  }

  /* ── PICKER ── */
  function renderPicker(container) {
    CF.Narrator.stop();
    let doneCount = 0;
    const cards = LESSONS.map(ls => {
      const st = statusOf(ls.id);
      if (st === 'done') doneCount++;
      return `
        <div class="lsn-card ${st === 'done' ? 'done' : ''}" data-lesson="${ls.id}">
          <div class="lsn-icon">${ls.icon}</div>
          <div class="lsn-body">
            <div class="lsn-name">${esc(ls.title)} ${st === 'done' ? '<span class="lsn-badge">✓ done</span>' : '<span class="lsn-badge new">NEW</span>'}</div>
            <div class="lsn-desc">Problem → Idea → Code → Drive → Practice → Spot it · ${ls.minutes} min</div>
          </div>
          <div class="lsn-go">${st === 'done' ? 'Replay' : 'Start ▶'}</div>
        </div>`;
    }).join('');

    const aiStatus = AI.isConfigured()
      ? '<span class="lsn-ai-on">● Gemini connected</span>'
      : '<span class="lsn-ai-off">○ not configured — offline mode</span>';

    container.innerHTML = `
      <div class="shop-header">
        <button class="back-btn" id="lsnBack">← Menu</button>
        <div style="flex:1">
          <div class="map-title">🎓 Learn — Interactive Lessons</div>
          <div class="map-sub">Watch narrated step-throughs · predict · drive the pointers yourself</div>
        </div>
      </div>

      <div class="lsn-progress">${doneCount} / ${LESSONS.length} lessons completed</div>
      ${cards}

      <div class="lsn-section">AI Tutor (optional)</div>
      <div class="lsn-ai-card">
        <p class="lsn-ai-note">The AI grades your explanations Socratically and diagnoses weak spots. Without a key the lessons still work — you get offline self-checks instead. Your key is stored only in this browser and is never included in profile exports.</p>
        <div class="lsn-ai-row">
          <input type="password" id="aiKey" placeholder="Gemini API key (AI Studio)" class="lsn-input" value="">
          <select id="aiModel" class="lsn-select">${AI.MODELS.map(m => `<option value="${m.id}" ${m.id === AI.getModel() ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
        </div>
        <div class="lsn-ai-actions">
          <button class="btn primary" id="aiSave">Save key</button>
          <button class="btn ghost" id="aiTest">Test connection</button>
          <button class="btn ghost" id="aiForget">Forget key</button>
        </div>
        <div class="lsn-ai-status" id="aiStatus">${aiStatus}</div>
      </div>

      <div class="lsn-section">AI Coach</div>
      <div class="lsn-ai-card">
        <p class="lsn-ai-note">Ask Gemini to read your recent misses and name the underlying misconception (needs the key above).</p>
        <button class="btn primary" id="aiCoach">🔍 Diagnose my weak spots</button>
        <div class="lsn-ai-status" id="coachOut" style="white-space:pre-wrap"></div>
      </div>`;

    container.querySelector('#lsnBack').addEventListener('click', () => handlers.onExit());
    container.querySelectorAll('.lsn-card').forEach(card => {
      card.addEventListener('click', () => startLesson(card.dataset.lesson, container));
    });

    const statusEl = container.querySelector('#aiStatus');
    const paintAi = () => {
      statusEl.innerHTML = AI.isConfigured()
        ? '<span class="lsn-ai-on">● Gemini connected</span>'
        : '<span class="lsn-ai-off">○ not configured — offline mode</span>';
    };

    container.querySelector('#aiSave').addEventListener('click', () => {
      const k = container.querySelector('#aiKey').value;
      AI.setKey(k);
      AI.setModel(container.querySelector('#aiModel').value);
      paintAi();
      if (AI.isConfigured()) {
        statusEl.innerHTML = AI.canPersist()
          ? '<span class="lsn-ai-on">● Key saved — AI tutor is ready</span>'
          : '<span class="lsn-ai-on">● Key accepted for this session. (This preview cannot save keys — download the file and open it in your browser to keep it between visits.)</span>';
      } else {
        statusEl.innerHTML = '<span class="lsn-ai-off">○ That looks too short for a Gemini key — keys from Google AI Studio are ~39 characters and start with “AIza”. Paste the whole key and try again.</span>';
      }
    });
    container.querySelector('#aiTest').addEventListener('click', async () => {
      const kIn = container.querySelector('#aiKey').value;
      if (kIn.trim()) AI.setKey(kIn); /* don't wipe a saved key when the box is empty */
      AI.setModel(container.querySelector('#aiModel').value);
      statusEl.textContent = '…testing…';
      try {
        const t = await AI.testConnection();
        statusEl.innerHTML = `<span class="lsn-ai-on">● ${esc(t)}</span>`;
      } catch (e) {
        statusEl.innerHTML = `<span class="lsn-ai-off">✗ ${esc(e.message)}</span>`;
      }
    });
    container.querySelector('#aiForget').addEventListener('click', () => {
      AI.setKey('');
      container.querySelector('#aiKey').value = '';
      paintAi();
    });

    container.querySelector('#aiCoach').addEventListener('click', async () => {
      const out = container.querySelector('#coachOut');
      if (!AI.isConfigured()) { out.textContent = 'Add your Gemini key above first.'; return; }
      const weak = CF.Spaced.findWeakSpots();
      if (!weak.length) { out.textContent = 'No weak spots detected yet — play some fights first.'; return; }
      out.textContent = '…thinking…';
      try {
        const w = weak[0];
        /* gather concrete struggling questions for the AI */
        const struggling = [];
        try {
          Object.keys(S.profile.questionHistory || {}).forEach(qid => {
            const e = S.profile.questionHistory[qid];
            if ((e.strength || 0) <= 1) struggling.push(qid);
          });
        } catch (e) {}
        const titles = struggling
          .map(id => Q.getById(id))
          .filter(q => q && q.pattern === w.patternId)
          .slice(0, 5)
          .map(q => `${q.type}: ${q.title}`);
        const errorSummary = titles.length
          ? `${w.patternName}: ${w.wrongCount} recent wrongs, ${w.accuracy}% accuracy. Struggling questions: ${titles.join('; ')}.`
          : `${w.patternName}: ${w.wrongCount} recent wrongs, ${w.accuracy}% accuracy.`;
        const text = await AI.diagnose({
          patternName: w.patternName,
          errorSummary,
          lessonTitles: LESSONS.map(l => l.title)
        });
        out.textContent = text;
      } catch (e) {
        out.textContent = '✗ ' + e.message;
      }
    });
  }

  /* ── LESSON RUN ── */
  function startLesson(id, container) {
    const lesson = LESSONS.find(l => l.id === id);
    if (!lesson) return;
    try { CF.Music.stop(); } catch (e) {}
    const session = {
      lesson,
      phase: 'intro',
      watchStats: null,
      driveStats: null,
      explainVerdict: null,
      quiz: { right: 0, total: 0 }
    };
    container._player && container._player.destroy();
    renderIntro(container, session);
  }

  function phaseBar(session, upto) {
    const phases = ['Problem', 'Brute', 'Idea', 'Words', 'Code', 'Watch', 'Drive', 'Break', 'Explain', 'Spot', 'Practice', 'Quiz'];
    const idx = phases.indexOf(upto);
    return `<div class="lsn-phases">${phases.map((p, i) =>
      `<span class="lsn-phase ${i < idx ? 'past' : ''} ${i === idx ? 'now' : ''}">${p}</span>`).join('')}
      <span class="lsn-phase-spacer"></span>
      <button class="back-btn" id="lsnQuit">✕</button></div>`;
  }

  function renderIntro(container, session) {
    const ls = session.lesson;
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Problem')}
        <div class="lsn-hero">
          <div class="lsn-hero-icon">${ls.icon}</div>
          <div>
            <div class="lsn-hero-title">${esc(ls.title)}</div>
            <div class="lsn-hero-sub">${esc(ls.hookTitle)} · ${ls.minutes} min</div>
          </div>
        </div>
        <div class="lsn-card plain">
          <p class="lsn-hook">${esc(ls.hookText)}</p>
          <div class="lsn-obj-title">You will be able to:</div>
          <ul class="lsn-obj">${ls.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        </div>
        <div class="lsn-nav">
          <button class="btn ghost" id="lsnQuit2">Quit</button>
          ${statusOf(ls.id) === 'done' ? '<button class="btn ghost" id="lsnJump">Replay from Watch ▶</button>' : ''}
          <button class="btn primary" id="lsnStart">Begin with the problem ▶</button>
        </div>
      </div>`;
    wireQuit(container, session);
    const jump = container.querySelector('#lsnJump');
    if (jump) jump.addEventListener('click', () => renderWatch(container, session));
    container.querySelector('#lsnStart').addEventListener('click', () => {
      CF.Sonify.unlock();
      renderProblem(container, session);
    });
  }

  function wireQuit(container, session) {
    const q = () => {
      container._player && container._player.destroy();
      CF.Narrator.stop();
      try { CF.Music.play('menu'); } catch (e) {}
      renderPicker(container);
    };
    container.querySelector('#lsnQuit')?.addEventListener('click', q);
    container.querySelector('#lsnQuit2')?.addEventListener('click', q);
  }

  /* ── PHASE 1 · THE PROBLEM — concrete, zero jargon ── */
  function renderProblem(container, session) {
    const ls = session.lesson, pb = ls.problem;
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Problem')}
        <div class="lsn-hintline">🎯 <b>The problem first.</b> No jargon, no code — just you versus the task. Try it with your own eyes.</div>
        <div class="lsn-card plain">
          <div class="lsn-prob-setup">${esc(pb.setup)}</div>
          <div class="lsn-prob-ask">${esc(pb.ask)}</div>
          <div class="lsn-stage-mini" id="probStage"></div>
          <div class="lsn-prob-aux" id="probAux">${pb.mode === 'pair' ? 'Tap <b>two</b> cells.' : pb.mode === 'ends' ? 'Tap the <b>two</b> tiles that swap first.' : 'Tap the <b>first</b> and <b>last</b> cell of the stretch.'}</div>
        </div>
        <div class="lsn-nav">
          <button class="btn ghost" id="lsnSkip">Skip ▶</button>
          <button class="btn primary" id="lsnNext" disabled>Continue: feel the cost ▶</button>
        </div>
      </div>`;
    wireQuit(container, session);
    CF.Narrator.speak(pb.narration);
    const stage = container.querySelector('#probStage');
    const aux = container.querySelector('#probAux');
    const nextBtn = container.querySelector('#lsnNext');
    container.querySelector('#lsnSkip').addEventListener('click', () => renderBrute(container, session));
    let sel = [], solved = false;

    function paint(markClass) {
      const marks = {};
      sel.forEach(i => { marks[i] = markClass; });
      CF.Visualizer.renderScene(stage, { arr: pb.arr, ptrs: {}, marks });
      stage.querySelectorAll('.vz-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          if (solved) return;
          const i = Number(cell.dataset.i);
          if (sel.includes(i)) { sel = sel.filter(x => x !== i); }
          else { sel.push(i); if (sel.length > 2) sel.shift(); }
          evaluate();
        });
      });
    }

    function evaluate() {
      if (sel.length < 2) { paint('cmp'); aux.innerHTML = 'One more…'; return; }
      const [x, y] = sel;
      if (pb.mode === 'pair') {
        const s = pb.arr[x] + pb.arr[y];
        if (s === pb.target) {
          solved = true;
          CF.Sonify.fx('win', {});
          paint('win');
          aux.innerHTML = `✓ ${pb.arr[x]} + ${pb.arr[y]} = ${pb.target}. ${esc(pb.punch)}`;
          nextBtn.disabled = false;
        } else {
          CF.Sonify.fx('buzz', {});
          sel = []; /* fresh attempt: clear the wrong pair */
          paint('cmp');
          aux.innerHTML = `${pb.arr[x]} + ${pb.arr[y]} = ${s} — not ${pb.target}. Tap two fresh cells.`;
        }
      } else if (pb.mode === 'ends') {
        if (Math.min(x, y) === 0 && Math.max(x, y) === pb.arr.length - 1) {
          solved = true;
          CF.Sonify.fx('win', {});
          paint('win');
          aux.innerHTML = `✓ The two ends trade places — that is primitive 3, the in-place swap. ${esc(pb.punch)}`;
          nextBtn.disabled = false;
        } else {
          CF.Sonify.fx('buzz', {});
          sel = [];
          paint('cmp');
          aux.innerHTML = 'Not those two — which pair trades places FIRST?';
        }
      } else {
        const l = Math.min(x, y), r = Math.max(x, y);
        const cells = pb.arr.slice(l, r + 1);
        const s = cells.reduce((a, b) => a + b, 0);
        const len = r - l + 1;
        if (pb.query) { /* exact stretch asked for */
          if (l === pb.query[0] && r === pb.query[1]) {
            solved = true;
            CF.Sonify.fx('win', {});
            paint('win');
            aux.innerHTML = `✓ ${s}. But notice — you had to walk ${len} cells, and the NEXT question would walk them all again. ${esc(pb.punch)}`;
            nextBtn.disabled = false;
          } else {
            CF.Sonify.fx('buzz', {});
            sel = [];
            paint('cmp');
            aux.innerHTML = `That is cells ${l}…${r}, not ${pb.query[0]}…${pb.query[1]}. Tap cells ${pb.query[0]} and ${pb.query[1]}.`;
          }
        } else { /* shortest stretch reaching target */
          if (s >= pb.target) {
            if (len === pb.winLen) {
              solved = true;
              CF.Sonify.fx('win', {});
              paint('win');
              aux.innerHTML = `✓ ${s} with only ${len} rooms — nothing shorter exists. ${esc(pb.punch)}`;
              nextBtn.disabled = false;
            } else {
              CF.Sonify.fx('grow', {});
              sel = [];
              paint('cmp');
              aux.innerHTML = `Valid — ${s} ≥ ${pb.target}, but that took ${len} rooms. The best answer is shorter. Tap a fresh pair.`;
            }
          } else {
            CF.Sonify.fx('buzz', {});
            sel = [];
            paint('cmp');
            aux.innerHTML = `${s} < ${pb.target} — not enough yet. Tap a fresh, wider stretch.`;
          }
        }
      }
    }

    paint('cmp');
    nextBtn.addEventListener('click', () => renderBrute(container, session));
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  INTERACTIVE FLOWCHARTS (CF.Flow) + CONTEXT CARDS       */
  /*  · one control-flow diagram per lesson — click a node   */
  /*    to send an animated packet along its edges           */
  /*  · "how we got here" card shown before any code appears, */
  /*    so the learner always knows what the code is FOR      */
  /* ═══════════════════════════════════════════════════════ */
  const LSN_FLOWS = {
    f1: { focus: 'guard', nodes: [
      { id: 'start', kind: 'start', label: 'reverse(s)', x: 250, y: 16, w: 130, h: 40 },
      { id: 'guard', kind: 'decision', label: 'len(s) < 2?', x: 235, y: 96, note: 'the seatbelt' },
      { id: 'init', kind: 'process', label: 'L = 0\nR = n − 1', x: 235, y: 188, note: 'two hands, opposite ends' },
      { id: 'bound', kind: 'decision', label: 'L < R ?', x: 235, y: 276, note: 'strict bound = finish line' },
      { id: 'swap', kind: 'process', label: 'swap s[L] ↔ s[R]', x: 460, y: 276, w: 160, note: 'in place — no extra memory' },
      { id: 'step', kind: 'process', label: 'L += 1\nR -= 1', x: 460, y: 366, w: 160 },
      { id: 'done', kind: 'stop', label: 'done', x: 20, y: 276, w: 110 }
    ], edges: [
      { from: 'start', to: 'guard' },
      { from: 'guard', to: 'done', label: 'yes', branch: 'yes' },
      { from: 'guard', to: 'init', label: 'no', branch: 'no' },
      { from: 'init', to: 'bound' },
      { from: 'bound', to: 'swap', label: 'true', branch: 'yes' },
      { from: 'bound', to: 'done', label: 'false', branch: 'no' },
      { from: 'swap', to: 'step' },
      { from: 'step', to: 'bound', dashed: true, via: [[540, 240], [380, 240]] }
    ] },
    p1: { focus: 'cmp', nodes: [
      { id: 'start', kind: 'start', label: 'sorted nums, target', x: 250, y: 16, w: 150, h: 40 },
      { id: 'init', kind: 'process', label: 'L = 0 · R = n−1', x: 245, y: 92 },
      { id: 'bound', kind: 'decision', label: 'L < R ?', x: 245, y: 176 },
      { id: 'cmp', kind: 'decision', label: 'nums[L]+nums[R]\nvs target', x: 235, y: 266, w: 170, note: 'the only comparison' },
      { id: 'mvL', kind: 'process', label: 'too small →\nL += 1', x: 470, y: 258, w: 140 },
      { id: 'mvR', kind: 'process', label: 'too big →\nR -= 1', x: 20, y: 258, w: 140 },
      { id: 'ret', kind: 'stop', label: 'return [L+1, R+1]', x: 460, y: 176, w: 160 }
    ], edges: [
      { from: 'start', to: 'init' },
      { from: 'init', to: 'bound' },
      { from: 'bound', to: 'cmp', label: 'yes', branch: 'yes' },
      { from: 'cmp', to: 'ret', label: '=', branch: 'yes', via: [[560, 240]] },
      { from: 'cmp', to: 'mvL', label: '< target', branch: 'no' },
      { from: 'cmp', to: 'mvR', label: '> target', branch: 'no' },
      { from: 'mvL', to: 'bound', dashed: true, via: [[540, 150], [400, 150]] },
      { from: 'mvR', to: 'bound', dashed: true, via: [[90, 150], [200, 150]] }
    ] },
    p4: { focus: 'valid', nodes: [
      { id: 'start', kind: 'start', label: 'positive nums, target', x: 250, y: 16, w: 160, h: 40 },
      { id: 'grow', kind: 'process', label: 'total += nums[R]\nwindow grows', x: 245, y: 96, w: 160 },
      { id: 'valid', kind: 'decision', label: 'total ≥ target?', x: 240, y: 190, w: 170, note: 'is the window legal?' },
      { id: 'rec', kind: 'process', label: 'best = min(best,\nR − L + 1)', x: 470, y: 182, w: 160 },
      { id: 'shrink', kind: 'process', label: 'total −= nums[L]\nL += 1', x: 470, y: 276, w: 160, note: 'shrink while still valid' },
      { id: 'next', kind: 'io', label: 'R += 1\nnext element', x: 20, y: 190, w: 140 },
      { id: 'done', kind: 'stop', label: 'return best', x: 245, y: 300, w: 150 }
    ], edges: [
      { from: 'start', to: 'grow' },
      { from: 'grow', to: 'valid' },
      { from: 'valid', to: 'rec', label: 'yes', branch: 'yes' },
      { from: 'valid', to: 'next', label: 'no', branch: 'no' },
      { from: 'rec', to: 'shrink' },
      { from: 'shrink', to: 'valid', label: 'loop', dashed: true, via: [[550, 150], [400, 150]] },
      { from: 'next', to: 'grow', dashed: true, via: [[90, 60], [250, 60]] },
      { from: 'next', to: 'done', dashed: true }
    ] },
    p6: { focus: 'build', nodes: [
      { id: 'start', kind: 'start', label: 'static nums', x: 250, y: 16, w: 130, h: 40 },
      { id: 'zero', kind: 'io', label: 'prefix = [0]', x: 245, y: 92, note: 'the leading zero kills edge cases' },
      { id: 'build', kind: 'process', label: 'append last + x', x: 235, y: 176, w: 160, note: 'one pass, O(n)' },
      { id: 'q', kind: 'decision', label: 'query(l, r)?', x: 245, y: 264 },
      { id: 'ans', kind: 'stop', label: 'prefix[r+1]\n− prefix[l]', x: 470, y: 256, w: 150, note: 'O(1) — no loop, ever' }
    ], edges: [
      { from: 'start', to: 'zero' },
      { from: 'zero', to: 'build' },
      { from: 'build', to: 'build', label: 'next x', dashed: true, via: [[420, 140]] },
      { from: 'build', to: 'q' },
      { from: 'q', to: 'ans', label: 'yes', branch: 'yes' },
      { from: 'q', to: 'q', label: 'more queries', dashed: true, via: [[120, 220]] }
    ] }
  };

  function mountLessonFlow(mountEl, lsId) {
    if (!mountEl || !CF.Flow || !LSN_FLOWS[lsId]) return;
    const box = document.createElement('div');
    box.className = 'flow-box';
    box.innerHTML = '<div class="flow-hint">🗺️ This is the algorithm\u2019s whole shape. <b>Click any box</b> — watch the packet travel along its path.</div>';
    const svgHost = document.createElement('div');
    box.appendChild(svgHost);
    mountEl.appendChild(box);
    CF.Flow.mountFlow(svgHost, LSN_FLOWS[lsId]);
  }

  /* ── PHASE 2 · BRUTE-FORCE LAB — feel the cost ── */
  function renderBrute(container, session) {
    const ls = session.lesson, br = ls.brute;
    try { container._player && container._player.destroy(); } catch (e) {}
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Brute')}
        <div class="lsn-bridge lsn-card">
          <div class="lsn-bridge-row"><b>Where we are:</b> you just solved the task by hand in the previous phase — that instinct IS this code.</div>
          <div class="lsn-bridge-row"><b>What this code does:</b> it replays your plain plan literally — try a pair, check it, try the next. Nothing clever.</div>
          <div class="lsn-bridge-row"><b>Why we show it:</b> to <em>feel</em> the cost. Watch the counter climb as the input grows.</div>
        </div>
        <div class="lsn-hintline">🐢 <b>Feel the cost.</b> This is the plain, obvious plan — watch the counter climb. The 🤔 pause asks you to predict the damage first.</div>
        <div class="lsn-player-mount" id="lsnMount"></div>
        <div class="lsn-nav"><span class="lsn-next-note" id="lsnNote">Watch the plain plan run — then see how it scales.</span></div>
      </div>`;
    wireQuit(container, session);
    const mount = container.querySelector('#lsnMount');
    const player = CF.Visualizer.createPlayer({
      container: mount, trace: br.trace(), mode: 'watch',
      onDone: () => {
        const note = container.querySelector('#lsnNote');
        if (note) {
          note.innerHTML = `
            <table class="lsn-scale">
              <tr><th></th><th>🐢 plain plan</th><th>⚡ ${esc(ls.title)}</th></tr>
              ${br.scale.map(row => `<tr><td>${esc(row.n)}</td><td class="b">${esc(row.brute)}</td><td class="p">${esc(row.pat)}</td></tr>`).join('')}
            </table>
            <p class="lsn-trig-why">${esc(br.punch)}</p>
            <button class="btn primary" id="lsnNext">Next: the idea ▶</button>`;
          container.querySelector('#lsnNext').addEventListener('click', () => renderIdea(container, session));
        }
      }
    });
    container._player = player;
    setTimeout(() => player.play(), 350);
  }

  /* ── PHASE 3 · THE IDEA — pure visual, one action word per step ── */
  function renderIdea(container, session) {
    const ls = session.lesson, idea = ls.idea;
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Idea')}
        <div class="lsn-hintline">💡 <b>The idea — no code yet.</b> Every step is ONE action word. Before each reveal, call the next move yourself — a wrong call costs nothing.</div>
        <div class="lsn-idea-words" id="ideaWords"></div>
        <div class="lsn-stage-mini" id="ideaStage"></div>
        <div class="lsn-idea-guess" id="ideaGuess"></div>
        <div class="lsn-idea-badge" id="ideaBadge"></div>
        <div class="lsn-idea-text" id="ideaText"></div>
        <div class="lsn-nav">
          <button class="btn ghost" id="ideaBack">◀ Back</button>
          <button class="btn ghost" id="lsnSkip">Skip ▶</button>
          <button class="btn primary" id="ideaNext">Next ▶</button>
        </div>
      </div>`;
    wireQuit(container, session);
    const stage = container.querySelector('#ideaStage');
    const chips = container.querySelector('#ideaWords');
    const badge = container.querySelector('#ideaBadge');
    const textEl = container.querySelector('#ideaText');
    const guessEl = container.querySelector('#ideaGuess');
    const backBtn = container.querySelector('#ideaBack');
    const nextBtn = container.querySelector('#ideaNext');
    container.querySelector('#lsnSkip').addEventListener('click', () => renderTriggers(container, session));
    chips.innerHTML = idea.steps.map((s, k) => `<span class="lsn-word-chip" data-k="${k}">${esc(s.word)}</span>`).join('');

    /* the lesson's action-word vocabulary → decoys for the guess */
    const vocab = [...new Set(idea.steps.map(s => s.word))];
    let i = 0;
    let guessRight = 0, guessTotal = 0;

    function show() {
      const st = idea.steps[i];
      guessEl.innerHTML = '';
      CF.Visualizer.renderScene(stage, st.state);
      try { if (st.fx) CF.Sonify.fx(st.fx.type, { ...st.fx, arr: st.state?.arr || [] }); } catch (e) {}
      badge.textContent = st.word;
      textEl.innerHTML = esc(st.text) + (st.why ? `<div class="lsn-idea-why">${esc(st.why)}</div>` : '');
      CF.Narrator.speak(st.text + (st.why ? ' ' + st.why : ''));
      chips.querySelectorAll('.lsn-word-chip').forEach(c => {
        const k = Number(c.dataset.k);
        c.className = 'lsn-word-chip' + (k < i ? ' past' : '') + (k === i ? ' now' : '');
      });
      backBtn.disabled = i === 0;
      nextBtn.textContent = i === idea.steps.length - 1 ? 'Continue: trigger words ▶' : 'Next ▶';
    }

    /* retrieval practice: the stage still shows the previous state —
       given that state, which move comes next? */
    function showGuess() {
      const st = idea.steps[i];
      const wrongs = vocab.filter(w => w !== st.word);
      const decoys = [];
      while (decoys.length < Math.min(2, wrongs.length)) {
        const w = wrongs[Math.floor(Math.random() * wrongs.length)];
        if (!decoys.includes(w)) decoys.push(w);
      }
      const opts = [st.word, ...decoys];
      for (let k = opts.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [opts[k], opts[j]] = [opts[j], opts[k]];
      }
      guessTotal++;
      guessEl.innerHTML = `<div class="lsn-idea-guess-q">🤔 Look at the state — call the next move:</div>` +
        opts.map(w => `<button class="lsn-wordbtn" data-w="${esc(w)}">${esc(w)}</button>`).join('');
      guessEl.querySelectorAll('.lsn-wordbtn').forEach(b => {
        b.addEventListener('click', () => {
          guessEl.querySelectorAll('.lsn-wordbtn').forEach(x => { x.disabled = true; });
          const ok = b.dataset.w === st.word;
          if (ok) {
            guessRight++;
            CF.Sonify.fx('win', {});
            b.classList.add('good');
          } else {
            CF.Sonify.fx('buzz', {});
            b.classList.add('shake');
            const right = guessEl.querySelector(`[data-w="${st.word}"]`);
            if (right) right.classList.add('good');
          }
          setTimeout(() => show(), ok ? 350 : 1100);
        });
      });
      session.ideaGuess = { right: guessRight, total: guessTotal };
    }

    backBtn.addEventListener('click', () => { if (i > 0) { i--; show(); } });
    nextBtn.addEventListener('click', () => {
      if (i < idea.steps.length - 1) {
        i++;
        if (i > 0 && vocab.length >= 2) showGuess(); else show();
      }
      else renderTriggers(container, session);
    });
    show();
  }

  /* ── PHASE 4 · TRIGGER WORDS — the problem announces itself ── */
  function renderTriggers(container, session) {
    const ls = session.lesson, tg = ls.triggers;
    const html = tg.text.replace(/\[\[(\d+)\|(.*?)\]\]/g, (m, k, w) => `<span class="lsn-trigger" data-k="${k}">${esc(w)}</span>`);
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Words')}
        <div class="lsn-hintline">🔑 <b>Spot the triggers.</b> Patterns announce themselves through the problem's own words. Tap each highlighted word to hear what it demands.</div>
        <div class="lsn-card plain">
          <div class="lsn-q">${html}</div>
          <div class="lsn-trig-out" id="trigOut"></div>
        </div>
        <div class="lsn-nav">
          <button class="btn ghost" id="lsnSkip">Skip ▶</button>
          <button class="btn primary" id="lsnNext" disabled>Continue: words → code ▶</button>
        </div>
      </div>`;
    wireQuit(container, session);
    CF.Narrator.speak('This problem announces itself. Tap the highlighted words to hear what each one demands.');
    const out = container.querySelector('#trigOut');
    const nextBtn = container.querySelector('#lsnNext');
    container.querySelector('#lsnSkip').addEventListener('click', () => renderCodeMap(container, session));
    let found = 0;
    container.querySelectorAll('.lsn-trigger').forEach(el => {
      el.addEventListener('click', () => {
        if (el.classList.contains('on')) return;
        el.classList.add('on');
        found++;
        const p = tg.pairs[Number(el.dataset.k)];
        CF.Sonify.fx('write', {});
        CF.Narrator.speak(p.move + '. ' + p.why);
        const card = document.createElement('div');
        card.className = 'lsn-trig-card';
        card.innerHTML = `<div class="lsn-trig-move">→ ${esc(p.move)}</div><div class="lsn-trig-why">${esc(p.why)}</div>`;
        out.appendChild(card);
        if (found >= tg.pairs.length) nextBtn.disabled = false;
      });
    });
    nextBtn.addEventListener('click', () => renderCodeMap(container, session));
  }

  /* ── PHASE 5 · WORDS → CODE — assemble the algorithm ── */
  function renderCodeMap(container, session) {
    const ls = session.lesson, cm = ls.codeMap;
    let shuffled = cm.lines.map((_, i) => i);
    try { shuffled = Q.shuffle(shuffled); } catch (e) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Code')}
        <div class="lsn-hintline">🧩 <b>Words → code.</b> ${esc(cm.intro)}</div>
        <div class="lsn-bridge lsn-card">
          <div class="lsn-bridge-row"><b>The bridge:</b> every line below is one action word from the previous phase — you already know all of them. This phase just gives each word its code shape.</div>
        </div>
        <div class="flow-box" id="cmFlow" style="display:none"></div>
        <div class="lsn-card plain">
          <div>${cm.lines.map((l, i) => `
            <div class="lsn-slot" id="cmSlot${i}"><span class="num">${i + 1}</span><span class="code" id="cmCode${i}">▢▢▢▢</span><span class="note" id="cmNote${i}"></span></div>`).join('')}
          </div>
          <div class="lsn-fb" id="cmFb"></div>
          <div id="cmWords">${shuffled.map(i => `<button class="lsn-wordbtn" data-w="${i}">${esc(cm.lines[i].word)}</button>`).join('')}</div>
        </div>
        <div class="lsn-nav">
          <button class="btn ghost" id="lsnSkip">Skip ▶</button>
          <button class="btn primary" id="lsnNext" disabled>Continue: watch it run ▶</button>
        </div>
      </div>`;
    wireQuit(container, session);
    CF.Narrator.speak(cm.intro);
    const fb = container.querySelector('#cmFb');
    const nextBtn = container.querySelector('#lsnNext');
    container.querySelector('#lsnSkip').addEventListener('click', () => renderWatch(container, session));
    let placed = 0;
    container.querySelectorAll('.lsn-wordbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = Number(btn.dataset.w);
        if (placed >= cm.lines.length || btn.classList.contains('used')) return;
        if (w === placed) {
          const l = cm.lines[w];
          container.querySelector('#cmSlot' + w).classList.add('filled');
          container.querySelector('#cmCode' + w).textContent = l.code;
          container.querySelector('#cmNote' + w).textContent = l.note;
          btn.classList.add('used');
          CF.Sonify.fx('write', {});
          placed++;
          if (placed === cm.lines.length) {
            fb.className = 'lsn-fb ok';
            fb.innerHTML = '✅ That is the whole algorithm. Every action word you learned already had a code shape — this is what "knowing the pattern" means.';
            /* reveal the control-flow map: the code you just assembled, as one picture */
            const flowHost = container.querySelector('#cmFlow');
            if (flowHost && CF.Flow && LSN_FLOWS[ls.id]) {
              flowHost.style.display = '';
              flowHost.innerHTML = '<div class="flow-hint">🗺️ And here is the whole thing as ONE picture — click any box to trace its path.</div>';
              const svgHost = document.createElement('div');
              flowHost.appendChild(svgHost);
              CF.Flow.mountFlow(svgHost, LSN_FLOWS[ls.id]);
            }
            CF.Sonify.fx('win', {});
            CF.Narrator.speak('That is the whole algorithm. Every action word you already knew had a code shape.');
            nextBtn.disabled = false;
          }
        } else {
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 350);
          CF.Sonify.fx('buzz', {});
          fb.className = 'lsn-fb bad';
          fb.textContent = `Not yet — “${cm.lines[w].word}” comes later. What must happen at step ${placed + 1} first?`;
        }
      });
    });
    nextBtn.addEventListener('click', () => renderWatch(container, session));
  }

  /* ── PHASE 10 · SPOT IT — recognize the trigger ── */
  function renderRecognize(container, session) {
    const ls = session.lesson, rc = ls.recognize;
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Spot')}
        <div class="lsn-hintline">🕵️ <b>Spot it.</b> Recognition is the real skill — a new problem arrives; which pattern does it call for?</div>
        <div class="lsn-card plain">
          <div class="lsn-q">${esc(rc.q)}</div>
          <div id="rcOpts">${rc.options.map((o, i) => `<button class="lsn-recognize-opt" data-i="${i}">${esc(o.text)}</button>`).join('')}</div>
          <div class="lsn-fb" id="rcFb"></div>
        </div>
        <div class="lsn-nav"><button class="btn primary" id="lsnNext" style="display:none">Next: practice run ▶</button></div>
      </div>`;
    wireQuit(container, session);
    CF.Narrator.speak(rc.q);
    const fb = container.querySelector('#rcFb');
    const nextBtn = container.querySelector('#lsnNext');
    let answered = false;
    container.querySelectorAll('.lsn-recognize-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const o = rc.options[Number(btn.dataset.i)];
        const right = !!o.ok;
        container.querySelectorAll('.lsn-recognize-opt').forEach(b => {
          const oo = rc.options[Number(b.dataset.i)];
          if (oo.ok) b.classList.add('right');
          else if (b === btn) b.classList.add('wrong');
          else b.classList.add('dim');
        });
        CF.Sonify.fx(right ? 'win' : 'buzz', {});
        fb.className = 'lsn-fb ' + (right ? 'ok' : 'bad');
        fb.innerHTML = `${right ? '✅' : '❌'} ${esc(o.why)}`;
        CF.Narrator.speak(o.why);
        nextBtn.style.display = '';
      });
    });
    nextBtn.addEventListener('click', () => renderPractice(container, session));
  }

  /* ── PHASE 10b · PRACTICE — a fresh run on brand-new input ── */
  function renderPractice(container, session) {
    const ls = session.lesson;
    try { container._player && container._player.destroy(); } catch (e) {}
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Practice')}
        <div class="lsn-hintline">🔁 <b>Practice run.</b> Brand-new input, and this time the narration stays quiet — YOU make every move. If the pattern is yours now, it will feel routine.</div>
        <div class="lsn-player-mount" id="lsnMount"></div>
        <div class="lsn-nav"><span class="lsn-next-note" id="lsnNote">Drive the whole run on your own.</span></div>
      </div>`;
    wireQuit(container, session);
    const mount = container.querySelector('#lsnMount');
    const player = CF.Visualizer.createPlayer({
      container: mount, trace: ls.practice(), mode: 'drive',
      onDone: (stats) => {
        session.practiceStats = stats;
        const note = container.querySelector('#lsnNote');
        if (note) {
          note.innerHTML = `Practice mistakes: ${stats.driveMistakes} — ${stats.driveMistakes === 0 ? 'a perfect run. The pattern is yours.' : 'each miss showed you exactly where the instinct is still forming.'}
            <button class="btn primary" id="lsnNext">Next: quick quiz ▶</button>`;
          container.querySelector('#lsnNext').addEventListener('click', () => renderQuiz(container, session));
        }
      }
    });
    container._player = player;
  }

  function renderWatch(container, session) {
    const ls = session.lesson;
    try { container._player && container._player.destroy(); } catch (e) {}
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Watch')}
        <div class="lsn-hintline">👀 <b>Watch.</b> Narration is spoken; the screen shows only short labels. Pause or step back at any time — you control the pace. Pauses marked 🤔 ask you to <b>predict first</b>.</div>
        <div class="lsn-player-mount" id="lsnMount"></div>
        <div class="lsn-nav"><span class="lsn-next-note" id="lsnNote">Watch the full walkthrough, then continue.</span></div>
      </div>`;
    wireQuit(container, session);
    const mount = container.querySelector('#lsnMount');
    mountLessonFlow(mount, ls.id);
    const trace = ls.watch();
    const player = CF.Visualizer.createPlayer({
      container: mount, trace, mode: 'watch',
      onDone: (stats) => {
        session.watchStats = stats;
        const note = container.querySelector('#lsnNote');
        if (note) {
          note.innerHTML = `Predictions: ${stats.predicts.right}/${stats.predicts.total} correct
            <button class="btn primary" id="lsnNext">Next: Drive it yourself ▶</button>`;
          container.querySelector('#lsnNext').addEventListener('click', () => renderDrive(container, session));
        }
      }
    });
    container._player = player;
    setTimeout(() => player.play(), 350);
  }

  function renderDrive(container, session) {
    const ls = session.lesson;
    try { container._player && container._player.destroy(); } catch (e) {}
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Drive')}
        <div class="lsn-hintline">🎮 <b>Drive.</b> Same algorithm, new input — this time YOU make every move. Wrong picks cost nothing except a hint: try again.</div>
        <div class="lsn-player-mount" id="lsnMount"></div>
        <div class="lsn-nav"><span class="lsn-next-note" id="lsnNote">Make every decision to finish.</span></div>
      </div>`;
    wireQuit(container, session);
    const mount = container.querySelector('#lsnMount');
    const trace = ls.drive();
    mountLessonFlow(mount, ls.id);
    const player = CF.Visualizer.createPlayer({
      container: mount, trace, mode: 'drive',
      onDone: (stats) => {
        session.driveStats = stats;
        const note = container.querySelector('#lsnNote');
        if (note) {
          note.innerHTML = `Mistakes: ${stats.driveMistakes} — every miss taught you something.
            <button class="btn primary" id="lsnNext">Next: Break it ▶</button>`;
          container.querySelector('#lsnNext').addEventListener('click', () => renderBreak(container, session));
        }
      }
    });
    container._player = player;
  }

  function renderBreak(container, session) {
    const ls = session.lesson;
    const hasBug = !!ls.bug;
    try { container._player && container._player.destroy(); } catch (e) {}

    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Break')}
        <div class="lsn-hintline">🧨 <b>Break it.</b> Knowing when a pattern does NOT apply is the skill that separates pattern recognition from memorization. Watch the same code run on input that violates its secret assumption.</div>
        <div class="lsn-player-mount" id="lsnMount"></div>
        <div class="lsn-nav"><span class="lsn-next-note" id="lsnNote">Watch the failure, then continue.</span></div>
      </div>`;
    wireQuit(container, session);
    const mount = container.querySelector('#lsnMount');

    if (hasBug) {
      const trace = ls.bug();
      const player = CF.Visualizer.createPlayer({
        container: mount, trace, mode: 'watch',
        onDone: () => {
          const note = container.querySelector('#lsnNote');
          if (note) {
            note.innerHTML = `<button class="btn primary" id="lsnNext">Next: Explain it back ▶</button>`;
            container.querySelector('#lsnNext').addEventListener('click', () => renderExplain(container, session));
          }
        }
      });
      container._player = player;
      setTimeout(() => player.play(), 350);
    } else {
      /* card-style misconception (p6: the crash, not a trace) */
      const mc = ls.misconceptionCard;
      mount.innerHTML = `
        <div class="lsn-card plain misconception">
          <div class="lsn-mc-title">⚠️ ${esc(mc.title)}</div>
          <pre class="lsn-mc-code">${esc(mc.text.split('\n\n')[1] || '')}</pre>
          <p class="lsn-hook">${esc(mc.text.split('\n\n').slice(-1)[0])}</p>
        </div>`;
      CF.Narrator.speak(mc.narration);
      const note = container.querySelector('#lsnNote');
      note.innerHTML = `<button class="btn primary" id="lsnNext">Next: Explain it back ▶</button>`;
      container.querySelector('#lsnNext').addEventListener('click', () => renderExplain(container, session));
    }
  }

  function renderExplain(container, session) {
    const ls = session.lesson;
    const fb = ls.explain.fallback;
    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Explain')}
        <div class="lsn-hintline">🗣️ <b>Explain it back.</b> Self-explanation is where understanding actually forms. Answer in your own words — the AI grades Socratically and never just hands you the answer.</div>
        <div class="lsn-card plain">
          <div class="lsn-q">${esc(ls.explain.question)}</div>
          <textarea class="lsn-textarea" id="lsnText" rows="4" placeholder="Type your explanation…"></textarea>
          <div class="lsn-ai-actions">
            ${AI.isConfigured()
              ? `<button class="btn primary" id="lsnGrade">Check with Gemini</button>
                 <button class="btn ghost" id="lsnHint">Ask for a Socratic hint</button>`
              : `<button class="btn primary" id="lsnFallback">Self-check instead (no key)</button>`}
          </div>
          <div class="lsn-fb" id="lsnFb"></div>
          <div class="lsn-fb" id="lsnMcBox"></div>
        </div>
      </div>`;
    wireQuit(container, session);
    const fbBox = container.querySelector('#lsnFb');
    const mcBox = container.querySelector('#lsnMcBox');

    function showContinue(verdict) {
      session.explainVerdict = verdict;
      if (!mcBox.querySelector('.lsn-next')) {
        const b = document.createElement('div');
        b.className = 'lsn-next';
        b.innerHTML = `<button class="btn primary" id="lsnNext">Next: Spot it ▶</button>`;
        mcBox.appendChild(b);
        b.querySelector('#lsnNext').addEventListener('click', () => renderRecognize(container, session));
      }
    }

    const gradeBtn = container.querySelector('#lsnGrade');
    if (gradeBtn) {
      gradeBtn.addEventListener('click', async () => {
        const text = container.querySelector('#lsnText').value.trim();
        if (text.length < 10) { fbBox.innerHTML = '<span class="bad">Write at least a sentence — the grader needs your words.</span>'; return; }
        gradeBtn.disabled = true;
        fbBox.innerHTML = '🤖 thinking…';
        try {
          const res = await AI.gradeExplanation({
            title: ls.title,
            invariant: ls.invariant,
            question: ls.explain.question,
            learnerText: text
          });
          const ok = res.verdict === 'PASS';
          fbBox.innerHTML = `<div class="${ok ? 'ok' : 'bad'}"><b>${ok ? '✅ PASS' : '🔁 Try refining'}</b><br>${esc(res.feedback)}</div>`;
          showContinue(res.verdict);
          if (!ok) gradeBtn.disabled = false;
        } catch (e) {
          fbBox.innerHTML = `<span class="bad">✗ ${esc(e.message)}</span>`;
          gradeBtn.disabled = false;
        }
      });
      container.querySelector('#lsnHint')?.addEventListener('click', async () => {
        fbBox.innerHTML = '🤖 thinking…';
        try {
          const t = await AI.socraticHint({ title: ls.title, question: ls.explain.question, learnerQuestion: '' });
          fbBox.innerHTML = `<div class="hintline2">💡 ${esc(t)}</div>`;
        } catch (e) {
          fbBox.innerHTML = `<span class="bad">✗ ${esc(e.message)}</span>`;
        }
      });
    }

    const fallBtn = container.querySelector('#lsnFallback');
    if (fallBtn) {
      fallBtn.addEventListener('click', () => {
        mcBox.innerHTML = `
          <div class="lsn-q small">Self-check: ${esc(fb.q)}</div>
          <div class="lsn-mc-opts">${fb.options.map((o, i) =>
            `<button class="vz-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>
          <div class="lsn-fb" id="lsnMcFb"></div>`;
        const mcFb = mcBox.querySelector('#lsnMcFb');
        mcBox.querySelectorAll('.vz-opt').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = Number(btn.dataset.i);
            const right = i === fb.correct;
            CF.Sonify.fx(right ? 'win' : 'buzz', {});
            mcBox.querySelectorAll('.vz-opt').forEach((b, j) => {
              b.disabled = true;
              if (j === fb.correct) b.classList.add('right');
            });
            if (!right) btn.classList.add('wrong');
            mcFb.innerHTML = `${right ? '✅' : '❌'} ${esc(fb.why)}`;
            showContinue(right ? 'SELF-PASS' : 'SELF-PASS');
          });
        });
      });
    }
  }

  /* ── QUIZ — pulls real bank questions, feeds the review system ── */
  function renderQuiz(container, session) {
    const ls = session.lesson;
    let pool = [];
    try {
      pool = Q.BANK.filter(q => q.pattern === ls.id && q.difficulty <= 2);
      pool = Q.shuffle(pool).slice(0, 3);
    } catch (e) { pool = []; }

    session.quiz = { right: 0, total: pool.length };

    if (!pool.length) { renderDone(container, session); return; }
    let qi = 0;

    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Quiz')}
        <div class="lsn-hintline">⚡ <b>Quick check.</b> Three real fight questions. Every answer is recorded into your review schedule — get one wrong and it will come back at the right time.</div>
        <div class="lsn-card plain">
          <div id="lsnQuizMount"></div>
          <div class="lsn-fb" id="lsnQuizFb"></div>
        </div>
      </div>`;
    wireQuit(container, session);

    const mount = container.querySelector('#lsnQuizMount');
    const fbEl = container.querySelector('#lsnQuizFb');

    function showQ() {
      if (qi >= pool.length) { renderDone(container, session); return; }
      const q = pool[qi];
      mount.innerHTML = '';
      R.mount(q, mount, (submitted) => {
        const correct = R.checkAnswer(q, submitted);
        session.quiz.total = pool.length;
        if (correct) session.quiz.right++;
        try { CF.Spaced.recordAnswer(q, correct, false); } catch (e) {}
        CF.Sonify.fx(correct ? 'win' : 'buzz', {});
        fbEl.className = 'lsn-fb ' + (correct ? 'ok' : 'bad');
        fbEl.innerHTML = `${correct ? '✅' : '❌'} ${esc(q.explanation || '')}`;
        setTimeout(() => { qi++; fbEl.textContent = ''; showQ(); }, 2000);
      });
    }
    showQ();
  }

  /* ── DONE ── */
  function renderDone(container, session) {
    const ls = session.lesson;
    let reward = null;
    try {
      S.profile.lessons = S.profile.lessons || {};
      const first = !S.profile.lessons[ls.id]?.completed;
      const xp = first ? 40 : 10;
      const coins = first ? 20 : 0;
      S.addXP(xp);
      if (coins) S.addCoins(coins);
      S.profile.lessons[ls.id] = {
        completed: true,
        ts: Date.now(),
        watchPredict: session.watchStats ? `${session.watchStats.predicts.right}/${session.watchStats.predicts.total}` : null,
        driveMistakes: session.driveStats ? session.driveStats.driveMistakes : null,
        explain: session.explainVerdict,
        quiz: `${session.quiz.right}/${session.quiz.total}`
      };
      S.save();
      reward = { xp, coins, first };
    } catch (e) { reward = { xp: 0, coins: 0, first: false }; }

    container.innerHTML = `
      <div class="lsn-wrap">
        ${phaseBar(session, 'Quiz')}
        <div class="lsn-done-card">
          <div class="lsn-done-icon">${ls.icon}</div>
          <div class="lsn-done-title">Lesson complete!</div>
          <div class="lsn-done-sub">${esc(ls.title)} · predictions ${session.watchStats ? `${session.watchStats.predicts.right}/${session.watchStats.predicts.total}` : '—'} · drive mistakes ${session.driveStats?.driveMistakes ?? '—'} · quiz ${session.quiz.right}/${session.quiz.total}</div>
          <div class="recap-rewards">
            <div class="recap-reward"><div class="recap-reward-val">+${reward.xp}</div><div class="recap-reward-lbl">XP</div></div>
            ${reward.coins ? `<div class="recap-reward"><div class="recap-reward-val">+${reward.coins}</div><div class="recap-reward-lbl">🪙 Coins</div></div>` : ''}
          </div>
          <div class="lsn-done-note">The pattern is now yours in theory — take it into a fight to make it stick. Fight questions you missed today are already scheduled for review.</div>
          <div class="lsn-nav">
            <button class="btn ghost" id="lsnDoneBack">◀ Back to lessons</button>
            <button class="btn primary" id="lsnFight">⚔️ Fight ${esc(ls.fightLabel)} ▶</button>
          </div>
        </div>
      </div>`;
    CF.Narrator.speak('Lesson complete. Time to take the pattern into a fight.');
    container.querySelector('#lsnDoneBack').addEventListener('click', () => {
      try { CF.Music.play('menu'); } catch (e) {}
      renderPicker(container);
    });
    container.querySelector('#lsnFight').addEventListener('click', () => handlers.onFight(ls.id));
  }

  /* ── PUBLIC ENTRY ── */
  function render(container, h) {
    handlers = { onExit: () => {}, onFight: () => {}, ...(h || {}) };
    container._player && container._player.destroy();
    renderPicker(container);
  }

  return {
    render,
    LESSONS,
    _traces: { twoSumTrace, twoSumBugTrace, minSubarrayTrace, windowBugTrace, prefixTrace }
  };
})();
