/* ═══════════════════════════════════════════════════════════ */
/*  15b-lesson-content.js — ✏️ EDITABLE LESSON CONTENT          */
/*                                                              */
/*  Lessons from the study sheet "LeetCode Foundations Vol. 1"  */
/*  that were not yet in the app: P2, P3, P5, P7, Guarded       */
/*  Skipping + Extensions X1, X2, X5, X8.                       */
/*                                                              */
/*  Everything here is DATA. To change wording, numbers,        */
/*  checkpoints or flowcharts, edit this file only — the engine */
/*  (15-lessons.js) reads it and renders everything.            */
/*                                                              */
/*  Script step shape (consumed by CF.Lessons._buildTrace):     */
/*   { line, caption, narration?, state:{arr,ptrs,marks,aux?},  */
/*     fx?:{type}, choice?:{q,options,correct,why,hint?} }      */
/*   · watch mode → `choice` becomes a voice-locked 🤔 card     */
/*   · drive mode → `choice` becomes an interactive prompt      */
/*  Depends on: nothing (pure data). Loaded BEFORE 15-lessons.  */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};
CF.NEW_LESSONS = (() => {

  /* ── helper: mark a contiguous window of cells ── */
  const win = (l, r, extra = {}) => {
    const m = {};
    if (r >= l) for (let i = l; i <= r; i++) m[i] = 'win';
    Object.keys(extra).forEach(k => { m[k] = extra[k]; });
    return m;
  };

  const SCRIPTS = {

    /* ═══════════════ P2 · READ & WRITE (Move Zeroes) ═══════════════ */
    p2: {
      icon: '🧹', minutes: 12,
      title: 'Read & Write Pointers',
      hookTitle: 'Two hands, one belt: read ahead, write behind',
      hookText: 'The hand that reads runs ahead through the whole array. The hand that write only ever advances when a value deserves to survive. Junk between them gets buried automatically — no shifting, no second array.',
      hookNarration: 'The reading hand scans ahead. The writing hand only steps forward when a value earns its place. Everything stuck between them is junk waiting to be overwritten.',
      imagine: {
        text: 'Imagine a printing press feeding sheets past two arms. The upper arm READS every sheet and calls out the good ones. The lower arm WRITES down only the good sheets, one after another, onto a fresh strip that grows inside the same belt. When the upper arm finishes, the lower arm simply declares: everything below me is the final print. The trash was never removed — it was outrun.',
        scene: { arr: [0, 1, 0, 3, 12], ptrs: { r: 0, w: 0 }, marks: {}, aux: [{ label: 'job', value: 'push all 0s to the end' }] }
      },
      problem: {
        mode: 'ends',
        setup: 'A row of cargo tiles — some are empty (0):',
        ask: 'Tap the FIRST tile that must MOVE and where it should land, so empties slide to the back.',
        arr: [0, 1, 0, 3, 12],
        narration: 'Cargo row: zero, one, zero, three, twelve. Push every empty slot to the back, in place, one pass. Tap the first tile that must move and where it lands.',
        punch: 'Naively you would shift four tiles left, then three more. Two pointers do it with one rule: read ahead, write behind.'
      },
      brute: {
        trace: () => CF.Lessons._traces.primitivesBruteTrace([0, 1, 0, 3, 12]),
        scale: [
          { n: 'n = 5', brute: 'copy + rebuild: 5 cells', pat: '0 extra cells' },
          { n: 'n = 100,000', brute: '100,000 extra cells', pat: '0 extra cells' },
          { n: 'streaming input', brute: 'cannot even start', pat: 'one pass, done' }
        ],
        punch: 'Renting a second array works — until the array IS the memory budget. Read & Write keeps everything in place.'
      },
      idea: {
        steps: [
          { word: 'INIT', text: 'Both hands start at 0. r will READ every cell; w marks where the next survivor LANDS.', state: { arr: [0, 1, 0, 3, 12], ptrs: { r: 0, w: 0 }, marks: {} }, why: 'w ≤ r is true from the very first step and never breaks — that single inequality is the whole safety proof.', fx: { type: 'init' } },
          { word: 'SKIP', sceneFx: { ring: [0], dim: true }, text: 'r reads 0 — junk. Do NOT write. Only r moves.', state: { arr: [0, 1, 0, 3, 12], ptrs: { r: 1, w: 0 }, marks: { 0: 'out' } }, why: 'Skipping without writing leaves w parked at the first doomed cell.', fx: { type: 'move', indices: [1] } },
          { word: 'WRITE', sceneFx: { ring: [0, 1], arc: [1, 0], token: true }, text: 'r reads 1 — survivor. nums[w] = 1, then w steps.', state: { arr: [1, 1, 0, 3, 12], ptrs: { r: 1, w: 1 }, marks: { 0: 'win' } }, why: 'Writing at w can never destroy unread data because w ≤ r — cell 0 was already read.', fx: { type: 'write' } },
          { word: 'SKIP', text: 'r reads 0 again — skip. The gap between w and r is now one doomed cell wide.', state: { arr: [1, 1, 0, 3, 12], ptrs: { r: 2, w: 1 }, marks: { 1: 'win', 2: 'out' } }, fx: { type: 'move', indices: [2] } },
          { word: 'WRITE', text: 'r reads 3 — survivor. It lands exactly on top of the doomed zero.', state: { arr: [1, 3, 0, 3, 12], ptrs: { r: 2, w: 2 }, marks: { 1: 'win', 2: 'win' } }, why: 'This is the moment the algorithm pays off: the junk at index 2 is buried by a kept value, no shifting involved.', fx: { type: 'write' } },
          { word: 'WRITE', text: 'r reads 12 — last survivor, lands at w = 3.', state: { arr: [1, 3, 12, 3, 12], ptrs: { r: 4, w: 3 }, marks: { 3: 'win' } }, fx: { type: 'write' } },
          { word: 'FOUND', text: 'Pass over. Front is 1, 3, 12 — survivors packed. Tail is garbage the caller ignores via the returned length.', state: { arr: [1, 3, 12, 0, 0], ptrs: { r: 5, w: 3 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'out', 4: 'out' }, aux: [{ label: 'answer', value: 'length 3' }, { label: 'done', value: '✓', done: true }] }, why: 'For Move Zeroes specifically, the tail is FILLED with zeros after the pack — same loop, one extra write per doomed cell.', fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Keep [[0|some]] elements, drop [[1|others]], IN PLACE, one pass — the survivors stay in order.',
        pairs: [
          { move: 'In place → two hands inside ONE array', why: 'No second buffer: r reads, w writes into the same memory.' },
          { move: 'One pass → r never goes backwards', why: 'Each cell is read exactly once — O(n) time guaranteed.' },
          { move: 'Order preserved → writes land left-to-right', why: 'w only moves forward, so survivors keep their relative order.' }
        ]
      },
      codeMap: {
        intro: 'Pack survivors, then pad the tail. Tap the words in execution order.',
        lines: [
          { word: 'INIT', code: 'w = 0', note: 'write cursor starts at the front' },
          { word: 'SCAN', code: 'for r in range(len(nums)):', note: 'read cursor visits every cell' },
          { word: 'KEEP', code: '    if nums[r] != 0:', note: 'the survivor test' },
          { word: 'WRITE', code: '        nums[w] = nums[r]; w += 1', note: 'land it, advance the writer' },
          { word: 'PAD', code: '    while w < len(nums): nums[w] = 0; w += 1', note: 'doomed tail filled with zeros' }
        ]
      },
      recognize: {
        q: 'Scanner check: which job calls for Read & Write?',
        options: [
          { text: 'Dedup a SORTED array in place — each value may appear once, return new length', ok: true, why: 'Survivors in order, junk dropped, in place: textbook P2. The survivor test just becomes nums[r] != nums[w-1].' },
          { text: 'Find whether any two numbers sum to a target', ok: false, why: 'That is P1 converging — a search, not a rebuild.' },
          { text: 'Answer many range sums on a frozen array', ok: false, why: 'That is P6 prefix sums — precompute, not filter.' }
        ]
      },
      invariant: 'Everything strictly LEFT of w is final and in original relative order; everything from r onward is untouched; the band between w and r holds only doomed cells awaiting burial.',
      explain: {
        question: 'In your own words: why can nums[w] = nums[r] NEVER destroy data that still needs to be read?',
        fallback: {
          q: 'What makes the overwrite safe?',
          options: [
            'w ≤ r always holds, so w only points at cells that were ALREADY read',
            'Because zeros are worthless and can be destroyed anytime',
            'Because Python arrays resize automatically',
            'Because we copy nums to temp first'
          ],
          correct: 0,
          why: 'The writer only ever chases the reader, never overtakes it. Invariant w ≤ r is the entire safety argument.'
        }
      },
      fightLabel: 'Read & Write · Easy',
      bugTrap: {
        title: 'Bug trap · the survivor test drifts',
        symptom: 'Write pointer advances on EVERY read — survivors get duplicated instead of filtered.',
        fix: 'Advance w ONLY inside the keep-test. If w moves unconditionally, you rebuilt the same array.'
      },
      flow: { focus: 'keep', nodes: [
        { id: 'start', kind: 'start', label: 'nums', x: 250, y: 16, w: 120, h: 40 },
        { id: 'init', kind: 'process', label: 'w = 0', x: 250, y: 90 },
        { id: 'scan', kind: 'io', label: 'r → next cell', x: 250, y: 170 },
        { id: 'keep', kind: 'decision', label: 'nums[r]\nsurvives?', x: 240, y: 250, w: 150, note: 'the only judgment call' },
        { id: 'wr', kind: 'process', label: 'nums[w]=nums[r]\nw += 1', x: 460, y: 242, w: 150 },
        { id: 'end', kind: 'stop', label: 'pad tail · return w', x: 30, y: 250, w: 150 }
      ], edges: [
        { from: 'start', to: 'init' }, { from: 'init', to: 'scan' }, { from: 'scan', to: 'keep' },
        { from: 'keep', to: 'wr', label: 'yes', branch: 'yes' },
        { from: 'keep', to: 'scan', label: 'no — skip', branch: 'no', dashed: true, via: [[150, 210], [150, 130]] },
        { from: 'wr', to: 'scan', dashed: true, via: [[535, 130], [330, 130]] },
        { from: 'scan', to: 'end', label: 'r exhausted', branch: 'no', via: [[120, 210]] }
      ] }
    },

    /* ═══════════ P3 · BACKWARDS WRITE (Merge Sorted in Place) ═══════════ */
    p3: {
      icon: '⬅️', minutes: 12,
      title: 'Backwards Write',
      hookTitle: 'When the front collides, start from the back',
      hookText: 'nums1 has room at the end but real data at the front. Merging left-to-right overwrites unread values. Merge RIGHT-to-LEFT instead: the empty space is exactly where finished output goes, and nothing is ever destroyed.',
      hookNarration: 'The free space sits AFTER all the data. So fill the output from the far end backwards — writers chase readers, never overwrite them.',
      imagine: {
        text: 'Imagine two queues of people sorted by height, and a long bench that already holds the first queue on its LEFT half, with the right half empty. If you seat the merged line starting from the left, you trample people who have not been measured yet. But start from the RIGHT end of the bench: every person you seat stands in empty wood, and both queues shrink from their tallest members down. No measurement is ever lost.',
        scene: { arr: [1, 3, 5, 0, 0, 0], ptrs: { k: 5 }, marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp' }, row2: { label: 'nums2', arr: [2, 4, 6], marks: {} } }
      },
      problem: {
        mode: 'stretch',
        setup: 'nums1 = [1,3,5,_,_,_] holds 3 real values; nums2 = [2,4,6]:',
        ask: 'Tap the cell where the LARGEST value of all must land.',
        arr: [1, 3, 5, 0, 0, 0],
        narration: 'Array one holds one, three, five, then three empty slots. Array two holds two, four, six. Merge them sorted — inside array one. Which cell receives the largest value overall?',
        punch: 'Six goes in the LAST slot. Once you see that, the whole algorithm falls out of writing backwards.'
      },
      brute: {
        trace: () => ({ code: ['temp = nums1[:m] + nums2   # rent a copy', 'temp.sort()                  # rebuild everything', 'nums1[:] = temp'],
          steps: [
            { line: 0, caption: 'Copy both into a temp', narration: 'The honest lazy plan: rent a brand new array and put everything in it.', state: { arr: [1, 3, 5, 0, 0, 0], row2: { label: 'temp', arr: [1, 3, 5, 2, 4, 6], marks: {} } }, fx: { type: 'init' } },
            { line: 1, caption: 'Sort the temp', narration: 'Then sort it — fine, but you threw away the fact that BOTH inputs were already sorted.', state: { arr: [1, 3, 5, 0, 0, 0], row2: { label: 'temp', arr: [1, 2, 3, 4, 5, 6], marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win' } } }, fx: { type: 'compare', indices: [] } },
            { line: 2, caption: 'Copy back into nums1', narration: 'Six cells rented, six cells copied, sorting work repeated that the inputs already paid for.', state: { arr: [1, 2, 3, 4, 5, 6], marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win' } }, fx: { type: 'found' } }
          ] }),
        scale: [
          { n: 'm+n = 6', brute: 'rent 6 + re-sort', pat: '0 rented, 5 comparisons' },
          { n: 'm+n = 10⁶', brute: 'rent 10⁶ + O(n log n)', pat: 'O(n) walks, no rental' },
          { n: 'memory-limited', brute: 'may not fit', pat: 'in place' }
        ],
        punch: 'Sorting sorted things is paying twice for the same meal.'
      },
      idea: {
        steps: [
          { word: 'INIT', text: 'Three cursors at the ENDS: i = last real value of nums1, j = last of nums2, k = very last slot.', state: { arr: [1, 3, 5, 0, 0, 0], ptrs: { i: 2, j: 2, k: 5 }, marks: {}, row2: { label: 'nums2', arr: [2, 4, 6], marks: {} } }, why: 'k lives in the empty zone — writing there destroys nothing. That is WHY we go backwards.', fx: { type: 'init' } },
          { word: 'PICK', sceneFx: { ring: [5] }, text: 'Compare the two tails: 5 vs 6. Six wins — the biggest thing anywhere goes to slot k = 5.', state: { arr: [1, 3, 5, 0, 0, 6], ptrs: { i: 2, j: 2, k: 5 }, marks: { 5: 'win' }, aux: [{ label: 'max(5,6)', value: '→ slot 5' }] }, why: 'The global maximum MUST occupy the last slot of a sorted merge. Pick-from-tails is the backwards twin of pick-from-heads.', fx: { type: 'write' } },
          { word: 'STEP', text: 'j and k slide left together.', state: { arr: [1, 3, 5, 0, 0, 6], ptrs: { i: 2, j: 1, k: 4 }, marks: { 5: 'win' } }, fx: { type: 'move', indices: [4] } },
          { word: 'PICK', sceneFx: { ring: [4] }, text: '5 vs 4 → five wins, lands at slot 4.', state: { arr: [1, 3, 5, 0, 5, 6], ptrs: { i: 2, j: 1, k: 4 }, marks: { 4: 'win', 5: 'win' } }, fx: { type: 'write' } },
          { word: 'PICK', sceneFx: { ring: [3] }, text: '3 vs 4 → four wins, slot 3. The ghost 5 at index 2 will be overwritten later — it is already placed.', state: { arr: [1, 3, 4, 4, 5, 6], ptrs: { i: 1, j: 0, k: 3 }, marks: { 3: 'win', 4: 'win', 5: 'win' } }, why: 'Watch closely: writing into index 3 is safe because k has already passed everything nums1 still needs to READ (i = 1).', fx: { type: 'write' } },
          { word: 'PICK', text: '3 vs 2 → three, slot 2. Then 1 vs 2 → two, slot 1. Then 1, slot 0. Done.', state: { arr: [1, 2, 3, 4, 5, 6], ptrs: { i: -1, j: -1, k: -1 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win' }, aux: [{ label: 'sorted', value: '✓ in place' }, { label: 'done', value: '✓', done: true }] }, why: 'When i runs out, remaining nums2 items are ALREADY in their final spots. When j runs out, remaining nums1 items never moved. Nothing left to do.', fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Output buffer shares its [[0|front]] with unread input but has [[1|free space at the back]] — fill it [[2|right-to-left]].',
        pairs: [
          { move: 'Shared buffer → forward writes collide', why: 'Left-to-right, the writer overtakes the reader and eats unread data.' },
          { move: 'Free space at the back → write there first', why: 'The tail is guaranteed empty, so backwards writes are always safe.' },
          { move: 'Sorted inputs → compare TAILS', why: 'The largest of all belongs at the end; merge decisions mirror the forward version.' }
        ]
      },
      codeMap: {
        intro: 'Three cursors, one direction. Order the moves.',
        lines: [
          { word: 'INIT', code: 'i, j, k = m-1, n-1, m+n-1', note: 'all three start at the ends' },
          { word: 'PICK', code: 'while i >= 0 and j >= 0:', note: 'both sources alive' },
          { word: 'WRITE', code: '    nums1[k] = max(nums1[i], nums2[j]); k -= 1', note: 'biggest tail → last slot' },
          { word: 'STEP', code: '    i -= 1  if it won else  j -= 1', note: 'the loser stays, winner advances' },
          { word: 'REST', code: 'while i >= 0: nums1[k] = nums1[i]; i,k = i-1,k-1', note: 'leftovers from nums1 only' }
        ]
      },
      recognize: {
        q: 'Which job is a Backwards Write?',
        options: [
          { text: 'Merge nums2 into nums1 in place — nums1 has trailing slack, data at the front', ok: true, why: 'Slack at the back + unread data at the front: write from the slack inward, i.e., backwards. P3.' },
          { text: 'Remove duplicates from sorted array, return length', ok: false, why: 'No collision risk — survivors pack forward. That is P2.' },
          { text: 'Rotate array by k using reversals', ok: false, why: 'Reversal machinery (X7), not a write-collision problem.' }
        ]
      },
      invariant: 'Slots k+1 … end of nums1 hold the FINAL merged tail; cursors i and j never point at anything already overwritten, because k ≥ max(i, j) at all times.',
      explain: {
        question: 'Why does the leftover loop only ever need to copy from nums1 — never from nums2?',
        fallback: {
          q: 'If nums2 still has items when nums1 runs dry, what happens?',
          options: [
            'Nothing to do — those nums2 items already sit in their correct final slots',
            'We must copy them carefully to the front',
            'We sort the remainder',
            'We restart the merge forwards'
          ],
          correct: 0,
          why: 'k chased i and j from the back; if i died first, every remaining nums2 value was written as we went. Remaining NUMS1 values, however, still hide under the front — they must be dragged out.'
        }
      },
      fightLabel: 'Backwards Write · Medium',
      bugTrap: {
        title: 'Bug trap · copying leftovers from nums2 too',
        symptom: 'Adding a "drain j" loop seems harmless — but it can overwrite values at low indices that i still needs… except i is dead. The REAL trap: draining nums2 leftovers FORWARD, clobbering unread nums1 heads.',
        fix: 'Only drain nums1 leftovers, and only backwards. If nums2 remains, it is already in place.'
      },
      flow: { focus: 'pick', nodes: [
        { id: 'start', kind: 'start', label: 'i=m−1 · j=n−1 · k=end', x: 200, y: 16, w: 200, h: 40 },
        { id: 'bound', kind: 'decision', label: 'i≥0 and j≥0?', x: 245, y: 96 },
        { id: 'pick', kind: 'decision', label: 'nums1[i] > nums2[j]?', x: 235, y: 190, w: 175, note: 'compare the TAILS' },
        { id: 'wi', kind: 'process', label: 'nums1[k]=nums1[i]\ni−=1', x: 460, y: 182, w: 150 },
        { id: 'wj', kind: 'process', label: 'nums1[k]=nums2[j]\nj−=1', x: 20, y: 182, w: 150 },
        { id: 'dec', kind: 'process', label: 'k −= 1', x: 250, y: 290 },
        { id: 'rest', kind: 'stop', label: 'drain i only\n(backwards)', x: 235, y: 380, w: 160 }
      ], edges: [
        { from: 'start', to: 'bound' },
        { from: 'bound', to: 'pick', label: 'yes', branch: 'yes' },
        { from: 'bound', to: 'rest', label: 'no', branch: 'no' },
        { from: 'pick', to: 'wi', label: 'yes', branch: 'yes' },
        { from: 'pick', to: 'wj', label: 'no', branch: 'no' },
        { from: 'wi', to: 'dec' }, { from: 'wj', to: 'dec' },
        { from: 'dec', to: 'bound', dashed: true, via: [[560, 60], [330, 60]] }
      ] }
    },

    /* ═══════════ P5 · TWO-ARRAY MERGE (Intersection II) ═══════════ */
    p5: {
      icon: '🔀', minutes: 11,
      title: 'Two-Array Merge',
      hookTitle: 'Two walkers, one shared clock',
      hookText: 'Both inputs are sorted. Put one finger on each. Whoever is smaller is finished forever — advance that finger. Equal fingers record a match and BOTH advance. Every comparison permanently retires at least one cell: linear time, no hash table needed.',
      hookNarration: 'One finger per array. The smaller finger is useless to anyone else — retire it. Equal fingers found a match — advance both. Each look kills a candidate.',
      imagine: {
        text: 'Two conveyor belts carry sorted shipments, left to right, and you stand between them with a clipboard. A box on belt one marked 3 can never match a FUTURE box on belt two marked 8-and-climbing. So whichever belt shows the smaller number, that box is judged once and gone forever. You cross the belts in a single walk — never backtracking on either.',
        scene: { arr: [1, 2, 2, 3], ptrs: { i: 0, j: 0 }, marks: {}, row2: { label: 'B', arr: [2, 2, 4], marks: {} } }
      },
      problem: {
        mode: 'stretch',
        setup: 'Two sorted rows A and B:',
        ask: 'Tap the pair of cells that MATCH first as the two walkers approach.',
        arr: [1, 2, 2, 3],
        narration: 'Row A: one, two, two, three. Row B: two, two, four. Walk both from the left. Which two cells meet as equal first?',
        punch: 'The 1 dies instantly — no cell of B that comes later can equal it. Already you feel the pruning.'
      },
      brute: {
        trace: () => ({ code: ['# for every a in A, scan ALL of B', 'for a in A:', '    for b in B:', '        if a == b: take it'],
          steps: [
            { line: 1, caption: 'a = 1 scans all of B', narration: 'Brute force: take the one from row A and walk the ENTIRE row B looking for it. Four checks, nothing found.', state: { arr: [1, 2, 2, 3], marks: { 0: 'cmp' }, row2: { label: 'B', arr: [2, 2, 4], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp' } } }, fx: { type: 'compare', indices: [0] } },
            { line: 1, caption: 'a = 2 scans all of B again', narration: 'Now the first two. Full scan of B AGAIN. We are paying m times n looks.', state: { arr: [1, 2, 2, 3], marks: { 1: 'cmp' }, row2: { label: 'B', arr: [2, 2, 4], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp' } } }, fx: { type: 'compare', indices: [1] } },
            { line: 2, caption: 'm × n comparisons', narration: 'For arrays of length ten thousand each: one hundred million looks. All of it ignoring the fact that both rows were handed to us SORTED.', state: { arr: [1, 2, 2, 3], marks: {}, aux: [{ label: 'cost', value: 'm × n' }] }, fx: { type: 'none' } }
          ] }),
        scale: [
          { n: '4 × 3', brute: '≤ 12 looks', pat: '≤ 6 looks' },
          { n: '10⁴ × 10⁴', brute: '10⁸ looks', pat: '2×10⁴ looks' },
          { n: 'sorted inputs', brute: 'assumption wasted', pat: 'assumption IS the engine' }
        ],
        punch: 'Sortedness is a gift. Brute force rips it up unread.'
      },
      idea: {
        steps: [
          { word: 'INIT', text: 'Finger i on A[0], finger j on B[0]. Output list empty.', state: { arr: [1, 2, 2, 3], ptrs: { i: 0, j: 0 }, marks: {}, row2: { label: 'B', arr: [2, 2, 4], marks: {} } }, fx: { type: 'init' } },
          { word: 'RETIRE', sceneFx: { ring: [0], dim: true }, text: '1 < 2: the one can never match anything ahead on B. Retire it.', state: { arr: [1, 2, 2, 3], ptrs: { i: 0, j: 0 }, marks: { 0: 'out' }, aux: [{ label: '1 < 2', value: 'retire A-side' }] }, why: 'B only grows from here. A smaller value is dead to every future cell — that is the whole power of sortedness.', fx: { type: 'move', indices: [1] } },
          { word: 'MATCH', sceneFx: { ring: [0, 1], arc: [0, 1], token: true }, text: '2 == 2! Record it, advance BOTH fingers.', state: { arr: [1, 2, 2, 3], ptrs: { i: 1, j: 0 }, marks: { 1: 'win' }, row2: { label: 'B', arr: [2, 2, 4], marks: { 0: 'win' } }, aux: [{ label: 'out', value: '[2]' }] }, fx: { type: 'found' } },
          { word: 'MATCH', text: 'Next: 2 == 2 again. Duplicates count — record, advance both.', state: { arr: [1, 2, 2, 3], ptrs: { i: 2, j: 1 }, marks: { 2: 'win' }, row2: { label: 'B', arr: [2, 2, 4], marks: { 1: 'win' } }, aux: [{ label: 'out', value: '[2, 2]' }] }, fx: { type: 'found' } },
          { word: 'RETIRE', text: '3 < 4: retire the three. i exhausts → done.', state: { arr: [1, 2, 2, 3], ptrs: { i: 3, j: 2 }, marks: { 3: 'out' }, row2: { label: 'B', arr: [2, 2, 4], marks: {} }, aux: [{ label: 'answer', value: '[2, 2]' }, { label: 'done', value: '✓', done: true }] }, why: 'Total looks: at most m + n. Every comparison retired a real cell forever.', fx: { type: 'move', indices: [] } }
        ]
      },
      triggers: {
        text: '[[0|Two sorted]] sequences, one walk: find matches / merge / differences without rescanning.',
        pairs: [
          { move: 'Both sorted → monotone fingers', why: 'Neither finger ever needs to move backwards.' },
          { move: 'One walk → O(m+n)', why: 'Each step retires at least one cell; cells are finite.' },
          { move: 'Duplicates matter? → advance BOTH on equal', why: 'Intersection II counts multiplicity: consume one partner per match.' }
        ]
      },
      codeMap: {
        intro: 'The three-finger dance. Order the moves.',
        lines: [
          { word: 'INIT', code: 'i, j = 0, 0', note: 'one finger per array' },
          { word: 'BOUND', code: 'while i < m and j < n:', note: 'both belts alive' },
          { word: 'MATCH', code: '    if A[i] == B[j]: out.append(A[i]); i+=1; j+=1', note: 'record + consume both' },
          { word: 'RETIRE', code: '    elif A[i] < B[j]: i += 1', note: 'smaller side is dead' },
          { word: 'RETIRE', code: '    else: j += 1', note: 'mirror case' }
        ]
      },
      recognize: {
        q: 'Which job wants the merge walk?',
        options: [
          { text: 'Two sorted lists — common elements WITH multiplicity, linear time, no hash set', ok: true, why: 'Sorted + sorted + one pass = two-finger merge walk. P5.' },
          { text: 'One unsorted list — unique common elements', ok: false, why: 'Unsorted kills the finger trick; that is a Volume-3 hash-map job.' },
          { text: 'One sorted list — pair summing to target', ok: false, why: 'ONE array, opposite ends: that is P1 converging.' }
        ]
      },
      invariant: 'Everything before finger i (and before j) has been judged against everything before the other finger and cannot match anything further along — the walked-past prefix is permanently settled.',
      explain: {
        question: 'Why is it legal to throw away A[i] forever the moment A[i] < B[j]?',
        fallback: {
          q: 'The retirement rule is justified because…',
          options: [
            'B is sorted: every later B cell is ≥ B[j] > A[i], so A[i] can never match',
            'A[i] is small and small numbers rarely match',
            'We already recorded A[i]',
            'The loop would crash otherwise'
          ],
          correct: 0,
          why: 'Monotonicity of the OTHER array is the entire license to discard. No sortedness, no retirement — that is why unsorted intersection needs hashes.'
        }
      },
      fightLabel: 'Two-Array Merge · Easy',
      bugTrap: {
        title: 'Bug trap · advancing both fingers on unequal',
        symptom: 'Advancing i AND j when A[i] < B[j] skips potential matches of the surviving B value.',
        fix: 'On unequal, advance ONLY the smaller side. On equal, advance both.'
      },
      flow: { focus: 'cmp', nodes: [
        { id: 'start', kind: 'start', label: 'sorted A, B', x: 250, y: 16, w: 140, h: 40 },
        { id: 'init', kind: 'process', label: 'i = 0 · j = 0', x: 250, y: 92 },
        { id: 'bound', kind: 'decision', label: 'i<m and j<n?', x: 245, y: 176 },
        { id: 'cmp', kind: 'decision', label: 'A[i] vs B[j]', x: 245, y: 266, w: 150, note: 'the only comparison' },
        { id: 'eq', kind: 'process', label: 'equal → record\ni+=1, j+=1', x: 460, y: 258, w: 150 },
        { id: 'lt', kind: 'process', label: 'A[i]<B[j] → i+=1\nelse j+=1', x: 20, y: 258, w: 150 },
        { id: 'done', kind: 'stop', label: 'return out', x: 250, y: 372 }
      ], edges: [
        { from: 'start', to: 'init' }, { from: 'init', to: 'bound' },
        { from: 'bound', to: 'cmp', label: 'yes', branch: 'yes' },
        { from: 'bound', to: 'done', label: 'no', branch: 'no' },
        { from: 'cmp', to: 'eq', label: '=', branch: 'yes' },
        { from: 'cmp', to: 'lt', label: '≠', branch: 'no' },
        { from: 'eq', to: 'bound', dashed: true, via: [[535, 150], [330, 150]] },
        { from: 'lt', to: 'bound', dashed: true, via: [[95, 150], [215, 150]] }
      ] }
    },

    /* ═══════════ P7 · KADANE (Maximum Subarray) ═══════════ */
    p7: {
      icon: '📈', minutes: 13,
      title: "Kadane's Algorithm",
      hookTitle: 'Would you start over here?',
      hookText: 'Walk the row keeping the best streak ending at YOUR cell. Ask one question at every step: does my running streak help me, or does starting fresh beat carrying dead weight? Track the champion seen so far. One pass.',
      hookNarration: 'At every cell ask: keep the streak, or restart here? Whichever is larger becomes the streak ending here. Remember the best streak ever seen.',
      imagine: {
        text: 'You hike a mountain road where every kilometer marker shows the profit since the last town. Some stretches gain, some hemorrhage. Your wallet carries a running streak — and at every marker you make exactly one decision: add this stretch to my journey, or burn the map and start a NEW journey right here? Somewhere in your pocket, a photograph records the richest journey you ever completed. One walk. N decisions. Total clarity.',
        scene: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], ptrs: {}, marks: {}, aux: [{ label: 'streak', value: 0 }, { label: 'best', value: '−∞' }] }
      },
      problem: {
        mode: 'stretch',
        setup: 'A ledger row of gains and losses:',
        ask: 'Tap the FIRST and LAST cell of the richest consecutive stretch.',
        arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4],
        narration: 'Ledger: minus two, one, minus three, four, minus one, two, one, minus five, four. Highlight the first and last cell of the richest CONSECUTIVE stretch.',
        punch: 'Four, minus one, two, one — total six. Finding THAT in one pass, provably, is Kadane.'
      },
      brute: {
        trace: () => ({ code: ['# try EVERY start, extend to every end', 'for i in range(n):', '    run = 0', '    for j in range(i, n):', '        run += nums[j]; best = max(best, run)'],
          steps: [
            { line: 1, caption: 'start i = 0: extend j = 0…8', narration: 'Brute force commits to every possible starting point. From zero, it walks the whole row, noting nine sums.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp', 5: 'cmp', 6: 'cmp', 7: 'cmp', 8: 'cmp' }, aux: [{ label: 'subarrays tried', value: '9' }] }, fx: { type: 'compare', indices: [0, 8] } },
            { line: 1, caption: 'start i = 1: walk it ALL again', narration: 'Starting at one: nine more… eight sums. Every pair of (start, end) gets its own walk. Quadratic.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp', 5: 'cmp', 6: 'cmp', 7: 'cmp', 8: 'cmp' }, aux: [{ label: 'subarrays tried', value: '≈ n²/2' }] }, fx: { type: 'compare', indices: [1, 8] } },
            { line: 4, caption: '45 subarrays for n = 9', narration: 'Forty-five sums for nine cells. For a million cells: half a trillion. Something is deeply redundant here.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: {}, aux: [{ label: 'total', value: 'n(n+1)/2 = 45' }] }, fx: { type: 'none' } }
          ] }),
        scale: [
          { n: 'n = 9', brute: '45 sums', pat: '9 decisions' },
          { n: 'n = 10⁵', brute: '5 billion sums', pat: '100 thousand decisions' },
          { n: 'n = 10⁶', brute: 'half a trillion', pat: '1M — one pass' }
        ],
        punch: 'Brute force recomputes the same stretches over and over. Kadane asks each cell ONE question.'
      },
      idea: {
        steps: [
          { word: 'INIT', text: 'streak = 0, best = −∞. streak means: the richest stretch ENDING exactly here.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], ptrs: {}, marks: {}, aux: [{ label: 'streak', value: 0 }, { label: 'best', value: '−∞' }] }, why: 'Best starts at minus infinity so ANY first real candidate beats it — including an all-negative array.', fx: { type: 'init' } },
          { word: 'ASK', text: 'Cell −2: streak = max(−2, 0 + −2) = −2. Carrying nothing beats nothing. best = −2.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 0: 'cmp' }, aux: [{ label: 'streak', value: '−2' }, { label: 'best', value: '−2' }] }, why: 'Even a negative streak is worth KEEPING as a candidate — the answer might be the least bad cell.', fx: { type: 'compare', indices: [0] } },
          { word: 'RESTART', text: 'Cell +1: old streak −2 drags me down. max(1, −2+1) = 1 → RESTART here.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 0: 'out', 1: 'win' }, aux: [{ label: 'streak', value: '1 (fresh)' }, { label: 'best', value: '1' }] }, why: 'A negative prefix is dead weight: dropping it is ALWAYS optimal. This is the exact moment brute force and Kadane part ways.', fx: { type: 'write' } },
          { word: 'CARRY', text: 'Cell −3: max(−3, 1−3) = −2. Ugly, but carrying beats restarting at −3.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 1: 'win', 2: 'cmp' }, aux: [{ label: 'streak', value: '−2' }, { label: 'best', value: '1' }] }, fx: { type: 'compare', indices: [2] } },
          { word: 'RESTART', text: 'Cell +4: streak −2 is poison. max(4, −2+4) = 4 → cut, restart. Streak 4, best 4.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 0: 'out', 1: 'out', 2: 'out', 3: 'win' }, aux: [{ label: 'streak', value: '4 (fresh)' }, { label: 'best', value: '4' }] }, why: 'The cut at index 3 is THE decision every brute-force start-at-zero walk made implicitly and expensively.', fx: { type: 'write' } },
          { word: 'CARRY', text: '−1 → 3, +2 → 5, +1 → 6. best climbs to 6: the stretch 4,−1,2,1.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 3: 'win', 4: 'win', 5: 'win', 6: 'win' }, aux: [{ label: 'streak', value: '6' }, { label: 'best', value: '6' }] }, fx: { type: 'compare', indices: [3, 6] } },
          { word: 'CARRY', text: '−5 → streak 1. Still positive — carrying still beats restarting at −5!', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 3: 'win', 4: 'win', 5: 'win', 6: 'win', 7: 'cmp' }, aux: [{ label: 'streak', value: '1' }, { label: 'best', value: '6' }] }, why: 'Counter-intuitive gem: a losing cell does NOT necessarily kill the streak — only a NEGATIVE STREAK does.', fx: { type: 'compare', indices: [7] } },
          { word: 'FOUND', text: '+4 → streak 5. best stays 6. Nine questions, one pass, done.', state: { arr: [-2, 1, -3, 4, -1, 2, 1, -5, 4], marks: { 3: 'win', 4: 'win', 5: 'win', 6: 'win' }, aux: [{ label: 'answer', value: '6 = [4,−1,2,1]' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: '[[0|Consecutive]] stretch with the [[1|best total]] — and negatives make skipping starts non-obvious.',
        pairs: [
          { move: 'Consecutive → "ending here" states', why: 'Every subarray ends somewhere; classify answers by their ending cell.' },
          { move: 'Negatives present → restart decision matters', why: 'Without negatives you would take everything; negatives force the carry-or-cut choice.' },
          { move: 'Best total → champion variable', why: 'streak describes NOW; best remembers the greatest streak EVER.' }
        ]
      },
      codeMap: {
        intro: 'Two variables, one question per cell.',
        lines: [
          { word: 'INIT', code: 'streak = 0; best = -inf', note: 'empty streak, no champion yet' },
          { word: 'ASK', code: 'for x in nums:', note: 'each cell asks its question' },
          { word: 'DECIDE', code: '    streak = max(x, streak + x)', note: 'restart HERE, or carry' },
          { word: 'TRACK', code: '    best = max(best, streak)', note: 'update the champion' },
          { word: 'FOUND', code: 'return best', note: 'greatest ending-somewhere' }
        ]
      },
      recognize: {
        q: 'Which problem is Kadane-shaped?',
        options: [
          { text: 'Largest sum of any CONTIGUOUS subarray, negatives allowed', ok: true, why: 'Contiguous + best sum + negatives = carry-or-restart DP on "ending here". P7.' },
          { text: 'Shortest subarray with sum ≥ target, positives only', ok: false, why: 'Constraint window, not best-sum: P4 sliding window.' },
          { text: 'Count subarrays summing to k, negatives allowed', ok: false, why: 'Counting ranges with negatives: X8 prefix + hash.' }
        ]
      },
      invariant: 'After processing cell t, streak = the maximum sum of any subarray ENDING at t, and best = the maximum over all endings 0..t. Since every subarray ends SOMEWHERE, best at the end is the global answer.',
      explain: {
        question: 'Explain to a friend why max(x, streak + x) is enough — why never consider "skip x but keep the older streak"?',
        fallback: {
          q: 'Why is the streak always a suffix that INCLUDES the current cell?',
          options: [
            'Any stretch excluding x ended earlier — it was already folded into best when we passed it',
            'Skipping cells is forbidden by the problem',
            'Negative numbers cannot be skipped',
            'It keeps the code shorter'
          ],
          correct: 0,
          why: 'Streak is defined as BEST ENDING AT CURRENT. Older endings live on inside best forever. The two variables partition the whole universe of subarrays — nothing falls between them.'
        }
      },
      proof: {
        claim: 'best at the end equals the maximum subarray sum.',
        basis: 'Before any cell: streak undefined-safe at 0, best −∞. True vacuously.',
        step: 'At cell x, ANY subarray ending here either is just [x] or extends the best one ending at the previous cell — extending anything WORSE than the previous best can never become better. So max(x, streak+x) is exactly the best ending-here. best then absorbs it.',
        end: 'Every subarray ends at some cell and was dominated by that cell\'s streak, which best saw. So best ≥ every subarray sum and equals one of them.'
      },
      fightLabel: 'Kadane · Medium',
      bugTrap: {
        title: 'Bug trap · initializing best = 0',
        symptom: 'All-negative input [-3,-1,-7] returns 0 — the empty stretch — which the problem forbids.',
        fix: 'best = float("-inf") (or nums[0]) so a real single-cell answer always beats it.'
      },
      flow: { focus: 'decide', nodes: [
        { id: 'start', kind: 'start', label: 'nums (negatives OK)', x: 240, y: 16, w: 160, h: 40 },
        { id: 'init', kind: 'process', label: 'streak=0 · best=−∞', x: 240, y: 92 },
        { id: 'loop', kind: 'io', label: 'next cell x', x: 245, y: 176 },
        { id: 'decide', kind: 'decision', label: 'streak + x  vs  x', x: 235, y: 262, w: 170, note: 'carry or restart?' },
        { id: 'carry', kind: 'process', label: 'streak += x', x: 460, y: 254, w: 130 },
        { id: 'cut', kind: 'process', label: 'streak = x', x: 30, y: 254, w: 130 },
        { id: 'champ', kind: 'process', label: 'best = max(best,\nstreak)', x: 245, y: 360, w: 160 },
        { id: 'done', kind: 'stop', label: 'return best', x: 470, y: 360, w: 130 }
      ], edges: [
        { from: 'start', to: 'init' }, { from: 'init', to: 'loop' }, { from: 'loop', to: 'decide' },
        { from: 'decide', to: 'carry', label: 'carry wins', branch: 'yes' },
        { from: 'decide', to: 'cut', label: 'restart wins', branch: 'no' },
        { from: 'carry', to: 'champ' }, { from: 'cut', to: 'champ' },
        { from: 'champ', to: 'loop', label: 'more cells', dashed: true, via: [[560, 140], [330, 140]] },
        { from: 'loop', to: 'done', label: 'exhausted', branch: 'no', via: [[420, 210]] }
      ] }
    },

    /* ═══════════ GUARD · Guarded Skipping Technique ═══════════ */
    guard: {
      icon: '🛡️', minutes: 10,
      title: 'Guarded Skipping',
      hookTitle: 'The seatbelt pattern: bounds FIRST, condition SECOND',
      hookText: 'Half of Volume 1 hides inside inner while-loops that skip runs of equal characters or digits. The loops look trivial — and crash the instant the skip reaches the end of the array. The order of the two tests in the condition is the difference between correct and crashed.',
      hookNarration: 'Inner skip loops wear a seatbelt: check the bounds BEFORE touching the array. Swap the order and the crash only appears at the very end of the input — the worst possible bug location.',
      imagine: {
        text: 'Imagine counting identical beads on a wire by sliding your thumb right while the bead LOOKS like its neighbor. Now imagine the wire ENDS. If you check "same bead?" first, your thumb is already asking about air — the question itself touches nothing. Check "is there still wire?" first, and the loop simply stops, politely. Same loop, different word order, opposite fate.',
        scene: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 0 }, marks: {}, aux: [{ label: 'job', value: 'count runs: a2 b3 c1' }] }
      },
      problem: {
        mode: 'ends',
        setup: 'Compress this ribbon of letters by counting each run:',
        ask: 'Tap where the FIRST run ends.',
        arr: ['a', 'a', 'b', 'b', 'b', 'c'],
        narration: 'Ribbon: a, a, b, b, b, c. Count every run. Where does the first run end?',
        punch: 'Run detection is a skip loop. Skip loops die at boundaries. This lesson is about the boundary.'
      },
      brute: {
        trace: () => ({ code: ['# naive skip — condition FIRST', 'while s[j] == s[i]:   # ← touches s[j] blind', '    j += 1           #   …off the end!'],
          steps: [
            { line: 0, caption: 'skipping the aa run…', narration: 'Watch the naive skip jump over the double a. Condition first, bounds never.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 0, j: 1 }, marks: { 0: 'cmp', 1: 'cmp' } }, fx: { type: 'move', indices: [1] } },
            { line: 0, caption: 'now the final c — alone at the end', narration: 'Fast-forward: i sits on the last c, j crawls right checking equality. At the boundary j points past the ribbon.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 5, j: 6 }, marks: { 5: 'cmp' } }, fx: { type: 'compare', indices: [5] } },
            { line: 1, caption: '💥 IndexError: s[6] does not exist', narration: 'The equality test asks about cell six — which was never born. Crash. And it crashes ONLY on inputs whose last run ends the file: the rarest, meanest bug class.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 5, j: 6 }, marks: { 5: 'out' }, aux: [{ label: 'crash', value: 'IndexError' }] }, fx: { type: 'buzz' } }
          ] }),
        scale: [
          { n: 'runs not at end', brute: 'looks fine in testing', pat: 'fine' },
          { n: 'last char is own run', brute: '💥 production', pat: 'safe' },
          { n: 'any input', brute: 'latent crash', pat: 'bounds-first = impossible' }
        ],
        punch: 'Tests passing ≠ code correct. Bounds-first makes the crash structurally impossible.'
      },
      idea: {
        steps: [
          { word: 'GUARD', text: 'The rule in one line: while j < n and s[j] == s[i]. Bounds LEFT, touch RIGHT.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 0, j: 1 }, marks: {}, aux: [{ label: 'rule', value: 'j < n FIRST' }] }, why: 'Python evaluates "and" left to right and SHORT-CIRCUITS: if j < n is false, s[j] is never even looked at.', fx: { type: 'init' } },
          { word: 'SKIP', text: 'aa run: j hops 1→2, sees b ≠ a, stops. Run length = j − i = 2.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 0, j: 2 }, marks: { 0: 'win', 1: 'win' }, aux: [{ label: 'run', value: 'a × 2' }] }, fx: { type: 'move', indices: [2] } },
          { word: 'SKIP', text: 'bbb run: j crawls 3→4→5, stops at c.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 2, j: 5 }, marks: { 2: 'win', 3: 'win', 4: 'win' }, aux: [{ label: 'run', value: 'b × 3' }] }, fx: { type: 'move', indices: [5] } },
          { word: 'GUARD', text: 'Final c: j = 6. The guard fires FIRST — 6 < 6 false — the equality test NEVER runs. No crash.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 5, j: 6 }, marks: { 5: 'win' }, aux: [{ label: 'guard', value: 'j < n → False ✓' }] }, why: 'This exact step is where the naive version exploded. Same position, opposite outcome — purely from the word order.', fx: { type: 'compare', indices: [5] } },
          { word: 'FOUND', text: 'Runs counted: a2 b3 c1. i = j resumes the outer walk. Seatbelt held.', state: { arr: ['a', 'a', 'b', 'b', 'b', 'c'], ptrs: { i: 6, j: 6 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win' }, aux: [{ label: 'answer', value: 'a2 b3 c1' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'An inner loop [[0|skips a run]] while a condition holds — and the run might [[1|reach the array end]] mid-skip.',
        pairs: [
          { move: 'Skip loop → bound it FIRST', why: 'while j < n and cond: short-circuit guarantees cond only sees live cells.' },
          { move: 'Equal-run logic → i = j handover', why: 'Outer loop resumes exactly where the skip stopped — total work still O(n).' },
          { move: 'End-of-array run → the crash case', why: 'The ONLY input that exposes wrong guard order tends to be the last run — tests miss it, users find it.' }
        ]
      },
      codeMap: {
        intro: 'Word order is correctness. Arrange the skip loop.',
        lines: [
          { word: 'GUARD', code: 'while j < n and s[j] == s[i]:', note: 'bounds LEFT — non-negotiable' },
          { word: 'SKIP', code: '    j += 1', note: 'hop over the run' },
          { word: 'COUNT', code: 'count = j - i', note: 'run length for free' },
          { word: 'HANDOVER', code: 'i = j', note: 'outer walk resumes at the seam' }
        ]
      },
      recognize: {
        q: 'Where does guarded skipping earn its keep?',
        options: [
          { text: 'Run-length loops: skip equal chars, skip digits, group-by-equality walks', ok: true, why: 'Every "advance while still equal" loop needs bounds-before-touch. Groups, RLE, duplicate-skips, X1 partitioning.' },
          { text: 'Computing prefix sums', ok: false, why: 'Prefix construction never blind-touches beyond known length — no skip loop.' },
          { text: 'Converging pointer comparisons', ok: false, why: 'P1 compares two LIVE cells inside L<R; there is no runaway inner skip.' }
        ]
      },
      invariant: 'At the top of every skip iteration, j is a LEGAL index OR the loop has exited — never both violated. Consequently s[j] is evaluated only when it exists.',
      explain: {
        question: 'Why does swapping to while s[j] == s[i] and j < n STILL crash in Python, even though both tests are present?',
        fallback: {
          q: 'The tests are both there. Why does order decide?',
          options: [
            '"and" short-circuits left-to-right: the touching test runs first and raises before the guard is consulted',
            'Python reorders conditions randomly',
            'It does not crash — order is style',
            'The second test disables the first'
          ],
          correct: 0,
          why: 'Short-circuit means evaluation ORDER is execution order. Leftmost first: the blind touch happens, IndexError propagates, the guard never gets asked. Word order IS control flow.'
        }
      },
      fightLabel: 'Guarded Skipping · Easy',
      bugTrap: {
        title: 'Bug trap · the inverted seatbelt',
        symptom: 'while s[j] == s[i] and j < n — passes every test except inputs ending in a singleton run.',
        fix: 'while j < n and s[j] == s[i]. Drill the order until it is muscle memory.'
      },
      flow: { focus: 'guard', nodes: [
        { id: 'start', kind: 'start', label: 'outer walk at i', x: 250, y: 16, w: 150, h: 40 },
        { id: 'guard', kind: 'decision', label: 'j < n ?', x: 250, y: 100, w: 120, note: 'SEATBELT — always first' },
        { id: 'eq', kind: 'decision', label: 's[j] == s[i] ?', x: 245, y: 196, w: 140 },
        { id: 'hop', kind: 'process', label: 'j += 1', x: 460, y: 190, w: 110 },
        { id: 'count', kind: 'process', label: 'len = j − i\nemit run', x: 30, y: 190, w: 140 },
        { id: 'hand', kind: 'stop', label: 'i = j · continue', x: 130, y: 330, w: 150 }
      ], edges: [
        { from: 'start', to: 'guard' },
        { from: 'guard', to: 'eq', label: 'live cell', branch: 'yes' },
        { from: 'guard', to: 'count', label: 'hit the wall — stop safely', branch: 'no' },
        { from: 'eq', to: 'hop', label: 'same run', branch: 'yes' },
        { from: 'hop', to: 'guard', dashed: true, via: [[520, 60], [330, 60]] },
        { from: 'eq', to: 'count', label: 'new run', branch: 'no' },
        { from: 'count', to: 'hand' }
      ] }
    },

    /* ═══════════ X1 · Three-Way Partition (Dutch Flag) ═══════════ */
    x1: {
      icon: '🇳🇱', minutes: 12,
      title: 'Extension X1 · Three-Way Partition',
      hookTitle: 'Sort a flag in one pass: lows, unknowns, highs',
      hookText: 'Exactly three kinds of values. Maintain three zones — small, unknown, large — with two boundary pointers. Shrink the unknown zone until it vanishes. Dutch national flag partition: the engine behind quicksort and color-grouping problems.',
      hookNarration: 'Three zones: definitely small, definitely large, and a shrinking island of unknown. Inspect the front of the island; it either joins left, joins right, or settles in the middle.',
      imagine: {
        text: 'A pile of red, white and blue cards face-down in a row, plus two bookmarks. Left of the left bookmark: proven reds. Right of the right bookmark: proven blues. Between them: the unknown island. Flip the island\'s first card: red → swap it to the left edge; blue → swap it to the right edge; white → leave it and walk past. The island shrinks until nothing is unknown.',
        scene: { arr: [2, 0, 2, 1, 1, 2, 0, 1], ptrs: { lo: 0, mid: 0, hi: 7 }, marks: {}, aux: [{ label: 'values', value: '0=red 1=white 2=blue' }] }
      },
      problem: {
        mode: 'ends',
        setup: 'Row of 0s, 1s and 2s (colors red/white/blue):',
        ask: 'Tap the cell that must end up EXACTLY in the middle zone.',
        arr: [2, 0, 2, 1, 1, 2],
        narration: 'Row: two, zero, two, one, one, two. Sort so all zeros lead, then ones, then twos — one pass, swaps only. Which kind of cell defines the middle zone?',
        punch: 'The ones never move far — they ARE the middle zone. Two pointers fence the rest in.'
      },
      brute: {
        trace: () => ({ code: ['# count, then rewrite', 'counts = [0,0,0]', 'for x in nums: counts[x] += 1', '# rewrite the whole row from counts'],
          steps: [
            { line: 1, caption: 'pass 1: count colors', narration: 'Plan one: histogram pass. Works — but assumes colors are tiny integers 0..k.', state: { arr: [2, 0, 2, 1, 1, 2], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp', 5: 'cmp' }, aux: [{ label: 'counts', value: 'z2 w2 b2' }] }, fx: { type: 'compare', indices: [] } },
            { line: 2, caption: 'pass 2: rewrite everything', narration: 'Second full pass overwrites the row from the tally. Two passes, and it breaks the moment the key is a string or object.', state: { arr: [0, 0, 1, 1, 2, 2], marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win' } }, fx: { type: 'write' } }
          ] }),
        scale: [
          { n: 'numeric keys', brute: '2 passes OK', pat: '1 pass' },
          { n: 'arbitrary keys + pivot', brute: 'impossible', pat: 'still 1 pass' },
          { n: 'stability needed', brute: 'rewrites lose it', pat: 'zone logic explicit' }
        ],
        punch: 'Counting is fine for dice. Partitioning generalizes to "compare against ANY pivot".'
      },
      idea: {
        steps: [
          { word: 'ZONES', text: 'lo = 0, mid = 0, hi = n−1. Invariant: [0,lo) reds · [lo,mid) whites · [mid,hi] unknown · (hi,n] blues.', state: { arr: [2, 0, 2, 1, 1, 2, 0, 1], ptrs: { lo: 0, mid: 0, hi: 7 }, marks: {}, aux: [{ label: 'island', value: '0..7 unknown' }] }, fx: { type: 'init' } },
          { word: 'BLUE', sceneFx: { ring: [0, 2], arc: [2, 0], token: true }, text: 'Front of island is 2 → swap to hi\'s right, hi drops. Island shrinks from the right.', state: { arr: [0, 0, 2, 1, 1, 2, 0, 2], ptrs: { lo: 0, mid: 0, hi: 6 }, marks: { 0: 'win', 7: 'out' } }, why: 'The swapped-in value came from the unknown zone — mid must NOT advance; the newcomer needs inspection.', fx: { type: 'write' } },
          { word: 'RED', text: 'Front is 0 → swap into the red zone, lo AND mid both step. Red grew, island shrank.', state: { arr: [0, 0, 2, 1, 1, 2, 0, 2], ptrs: { lo: 1, mid: 1, hi: 6 }, marks: { 0: 'win', 1: 'win' } }, why: 'Swapping a red from mid to lo brings back a WHITE (lo sat at mid\'s left edge) — safe to advance mid.', fx: { type: 'write' } },
          { word: 'WHITE', text: 'Front is 1 → already correct, just mid += 1. It joins the proven-whites band.', state: { arr: [0, 0, 2, 1, 1, 2, 0, 2], ptrs: { lo: 1, mid: 2, hi: 6 }, marks: { 2: 'cmp' } }, fx: { type: 'move', indices: [2] } },
          { word: 'BLUE', text: '2 again → bounce right. hi = 5.', state: { arr: [0, 0, 2, 1, 1, 2, 0, 2], ptrs: { lo: 1, mid: 2, hi: 5 }, marks: { 6: 'out' } }, fx: { type: 'write' } },
          { word: 'RED', sceneFx: { ring: [2, 6], arc: [6, 2], token: true }, text: 'Island front is 1 → white, advance. Then 0 at mid 4… swap left, lo/mid march.', state: { arr: [0, 0, 1, 1, 2, 0, 2, 2], ptrs: { lo: 2, mid: 4, hi: 5 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win' } }, fx: { type: 'move', indices: [4] } },
          { word: 'FOUND', text: 'mid passes hi: island empty. 0,0,0 | 1,1 | 2,2,2. One pass, in place.', state: { arr: [0, 0, 0, 1, 1, 2, 2, 2], ptrs: { lo: 3, mid: 6, hi: 5 }, marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win', 5: 'win', 6: 'win', 7: 'win' }, aux: [{ label: 'zones', value: 'reds·whites·blues' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Partition around a [[0|pivot]] into [[1|less · equal · greater]] — exactly three groups, in place.',
        pairs: [
          { move: 'Three groups → two boundaries + a cursor', why: 'lo fences smalls, hi fences larges, mid inspects the island.' },
          { move: 'Swap with hi → mid stays', why: 'Right-swap imports an UNKNOWN — inspect it before advancing.' },
          { move: 'Swap with lo → mid advances', why: 'Left-swap imports a known WHITE — safe to consume.' }
        ]
      },
      codeMap: {
        intro: 'The island loop. Order the branches.',
        lines: [
          { word: 'INIT', code: 'lo, mid, hi = 0, 0, n-1', note: 'island = [mid..hi]' },
          { word: 'BOUND', code: 'while mid <= hi:', note: 'island alive' },
          { word: 'RED', code: '    if a[mid]==0: swap(lo,mid); lo+=1; mid+=1', note: 'imports a white → advance' },
          { word: 'WHITE', code: '    elif a[mid]==1: mid+=1', note: 'settles in place' },
          { word: 'BLUE', code: '    else: swap(mid,hi); hi-=1', note: 'imports unknown → re-inspect' }
        ]
      },
      recognize: {
        q: 'Which task is a three-way partition?',
        options: [
          { text: 'Wiggle/sort colors 0-1-2 in place, OR quicksort with many duplicates', ok: true, why: 'Dutch-flag partitioning handles equal-keys gracefully — the standard 3-way quicksort core.' },
          { text: 'Find one pair summing to target', ok: false, why: 'P1 converging.' },
          { text: 'Longest substring without repeats', ok: false, why: 'P4 window + hash.' }
        ]
      },
      invariant: 'Zone contract holds at every loop top: everything < pivot left of lo, == pivot in [lo,mid), unknown in [mid,hi], > pivot right of hi.',
      explain: {
        question: 'Why must mid NOT advance after swapping with hi, but SHOULD after swapping with lo?',
        fallback: {
          q: 'The asymmetry comes from…',
          options: [
            'The hi-swap imports an uninspected unknown; the lo-swap imports a cell already proven equal/pivot-side',
            'hi moves slower than lo',
            'Random — either way works',
            'Python swap semantics'
          ],
          correct: 0,
          why: 'Everything left of lo has been inspected and is certified. Everything right of hi likewise. Only the island holds unexamined truth — pull from it, re-examine.'
        }
      },
      fightLabel: 'Extensions · Hard',
      bugTrap: {
        title: 'Bug trap · advancing mid after a hi-swap',
        symptom: 'A 2 smuggled into mid\'s old spot gets skipped — partition misplaces it.',
        fix: 'hi-swap: hi -= 1 only. lo-swap and white: mid += 1.'
      },
      flow: { focus: 'which', nodes: [
        { id: 'start', kind: 'start', label: 'island [mid..hi]', x: 240, y: 16, w: 170, h: 40 },
        { id: 'bound', kind: 'decision', label: 'mid ≤ hi ?', x: 250, y: 96 },
        { id: 'which', kind: 'decision', label: 'a[mid] = ?', x: 250, y: 190, w: 130, note: 'inspect island front' },
        { id: 'red', kind: 'process', label: '0 → swap lo\nlo++, mid++', x: 450, y: 100, w: 150 },
        { id: 'white', kind: 'process', label: '1 → mid++', x: 450, y: 280, w: 150 },
        { id: 'blue', kind: 'process', label: '2 → swap hi\nhi-- (mid waits)', x: 30, y: 280, w: 160 },
        { id: 'done', kind: 'stop', label: 'zones sealed', x: 30, y: 100, w: 130 }
      ], edges: [
        { from: 'start', to: 'bound' },
        { from: 'bound', to: 'which', label: 'yes', branch: 'yes' },
        { from: 'bound', to: 'done', label: 'no', branch: 'no' },
        { from: 'which', to: 'red', label: '0', branch: 'yes' },
        { from: 'which', to: 'white', label: '1', branch: 'no' },
        { from: 'which', to: 'blue', label: '2', branch: 'no' },
        { from: 'red', to: 'bound', dashed: true, via: [[560, 70], [330, 70]] },
        { from: 'white', to: 'bound', dashed: true, via: [[560, 240], [560, 70]] },
        { from: 'blue', to: 'bound', dashed: true, via: [[95, 70], [215, 70]] }
      ] }
    },

    /* ═══════════ X2 · Outward Expansion (Palindromes) ═══════════ */
    x2: {
      icon: '🔄', minutes: 11,
      title: 'Extension X2 · Outward Expansion',
      hookTitle: 'Start small, grow symmetric, stop at the mismatch',
      hookText: 'Instead of scanning windows left-to-right, plant a center and walk BOTH pointers outward while they agree. Odd centers: one cell. Even centers: two. Twenty-n-one candidate centers turn palindrome search from cubic to quadratic — with fifteen lines.',
      hookNarration: 'Plant a center. While the neighbors mirror each other, expand outward. Every expansion costs one comparison; every death is a mismatch, not a rescan.',
      imagine: {
        text: 'Drop a pebble in still water. The ripple ring grows outward symmetrically — and dies the instant it hits a rock that breaks the symmetry. Now imagine the water is a word, and the pebble can land on ANY letter, or BETWEEN any two letters. Cheapest palindrome machine ever built.',
        scene: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: { L: 1, R: 1 }, marks: { 1: 'cmp' }, aux: [{ label: 'center', value: 'odd @ 1' }] }
      },
      problem: {
        mode: 'ends',
        setup: 'Word ribbon: babadb. Plant one center:',
        ask: 'Tap the two cells that must mirror FIRST around center index 1.',
        arr: ['b', 'a', 'b', 'a', 'd', 'b'],
        narration: 'Ribbon b-a-b-a-d-b. Center on the a at index one. Which two cells are the first mirror pair to check?',
        punch: 'Zero and two: b and b. Match — the ripple grows. This is the whole algorithm.'
      },
      brute: {
        trace: () => ({ code: ['# every (i,j) pair, verify palindrome', 'for i in range(n):', '    for j in range(i, n):', '        if s[i:j+1] == reversed: best = j-i+1'],
          steps: [
            { line: 1, caption: 'test every substring', narration: 'Brute force: n squared substrings, each verified in linear time. Cubic.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp', 5: 'cmp' }, aux: [{ label: 'work', value: 'O(n³)' }] }, fx: { type: 'compare', indices: [] } },
            { line: 3, caption: 're-verifying shared middles', narration: 'Substring aba inside abac verifies its INNER parts again and again. Massive redundancy.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], marks: {}, aux: [{ label: 'missed', value: 'symmetry' }] }, fx: { type: 'none' } }
          ] }),
        scale: [
          { n: 'n = 6', brute: '≤ 120 checks', pat: '11 expansions' },
          { n: 'n = 1,000', brute: '10⁹ char reads', pat: '10⁶' },
          { n: 'Manacher (later)', brute: '—', pat: 'O(n) exists' }
        ],
        punch: 'Expansion reuses every matched inner pair for free — that reuse IS the speedup.'
      },
      idea: {
        steps: [
          { word: 'PLANT', sceneFx: { ring: [1], dim: true }, text: 'Odd centers: L = R = c for each c. Even centers: L = c, R = c+1. Try all 2n−1.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: { L: 1, R: 1 }, marks: { 1: 'cmp' }, aux: [{ label: 'centers', value: '2n−1 = 11' }] }, fx: { type: 'init' } },
          { word: 'EXPAND', sceneFx: { ring: [0, 1, 2], pulse: 1, color: '#22d3ee' }, text: 'From center 1: s[0]==s[2]? b==b yes → grow to (0,2)… width 3.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: { L: 0, R: 2 }, marks: { 0: 'win', 1: 'win', 2: 'win' }, aux: [{ label: 'best', value: 'bab (3)' }] }, fx: { type: 'compare', indices: [0, 2] } },
          { word: 'DEATH', text: 'Next ring: L = −1 — bounds stop it. Ripple dies at the wall, not a mismatch.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: { L: 0, R: 2 }, marks: { 0: 'win', 1: 'win', 2: 'win' }, aux: [{ label: 'death', value: 'wall' }] }, why: 'Two death causes: mismatch inside, or a pointer reaching the edge. Both are checked — guarded expansion.', fx: { type: 'move', indices: [] } },
          { word: 'PLANT', text: 'Center pair (3,4)? a vs d — mismatch at birth, width zero. Keep walking centers.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: { L: 3, R: 4 }, marks: { 3: 'cmp', 4: 'cmp' }, aux: [{ label: 'best', value: 'bab (3)' }] }, fx: { type: 'compare', indices: [3, 4] } },
          { word: 'FOUND', text: 'Best ripple: bab at 0..2 (aba at 1..3 ties). Longest palindromic substring = 3.', state: { arr: ['b', 'a', 'b', 'a', 'd', 'b'], ptrs: {}, marks: { 0: 'win', 1: 'win', 2: 'win' }, aux: [{ label: 'answer', value: 'bab · len 3' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Property defined by [[0|symmetry around a center]] — palindromes, mirrors, balanced runs.',
        pairs: [
          { move: 'Symmetric property → plant & grow', why: 'Growth reuses the inner match: cost is one comparison per ring.' },
          { move: 'Odd AND even → two center families', why: 'Centers are cells AND gaps: 2n−1 plants total.' },
          { move: 'Stop at mismatch/wall → guarded', why: 'while L>=0 and R<n and s[L]==s[R] — the seatbelt again.' }
        ]
      },
      codeMap: {
        intro: 'The expand helper, assembled.',
        lines: [
          { word: 'PLANT', code: 'def expand(s, L, R):', note: 'one center (or gap)' },
          { word: 'GUARD', code: '    while L >= 0 and R < n and s[L] == s[R]:', note: 'three guards, ordered' },
          { word: 'EXPAND', code: '        L -= 1; R += 1', note: 'ring grows outward' },
          { word: 'REPORT', code: '    return R - L - 1', note: 'minus the fatal ring' }
        ]
      },
      recognize: {
        q: 'When reach for outward expansion?',
        options: [
          { text: 'Longest palindromic SUBSTRING (also: longest odd mirror run, count palindromes)', ok: true, why: 'Palindrome = symmetry about a center; expansion enumerates centers cheaply. X2.' },
          { text: 'Longest palindromic SUBSEQUENCE', ok: false, why: 'Subsequence breaks contiguity — needs interval DP (Volume 6).' },
          { text: 'Range sums on static array', ok: false, why: 'P6.' }
        ]
      },
      invariant: 'During expansion, the open interval (L, R) is ALWAYS a confirmed palindrome; the loop exits the moment adding a ring would break it, so R−L−1 is the largest palindrome grown from this center.',
      explain: {
        question: 'Why return R − L − 1 instead of R − L when the while-loop ends?',
        fallback: {
          q: 'The off-by-one reason:',
          options: [
            'The last ring FAILED the test — L and R overshot by one each, so subtract both overshoots',
            'Zero-based indexing always subtracts one',
            'Because palindromes exclude the center',
            'It compensates for the swap'
          ],
          correct: 0,
          why: 'Loop body expands AFTER a successful check; exit means the newest expansion was invalid. Undo it: width = (R−1) − (L+1) + 1 = R − L − 1.'
        }
      },
      fightLabel: 'Extensions · Medium',
      bugTrap: {
        title: 'Bug trap · forgetting even centers',
        symptom: 'Only planting on cells misses "abba" entirely.',
        fix: 'Plant at every cell AND every gap: expand(i,i) and expand(i,i+1).'
      },
      flow: { focus: 'ring', nodes: [
        { id: 'start', kind: 'start', label: 'center (L,R)', x: 245, y: 16, w: 150, h: 40 },
        { id: 'ring', kind: 'decision', label: 'in bounds and\ns[L]==s[R]?', x: 235, y: 110, w: 170, note: 'guarded ring test' },
        { id: 'grow', kind: 'process', label: 'L−=1 · R+=1', x: 470, y: 110, w: 140 },
        { id: 'rep', kind: 'stop', label: 'width = R−L−1', x: 30, y: 110, w: 150 },
        { id: 'next', kind: 'io', label: 'next center\ncell & gap', x: 245, y: 240, w: 150 }
      ], edges: [
        { from: 'start', to: 'ring' },
        { from: 'ring', to: 'grow', label: 'mirror holds', branch: 'yes' },
        { from: 'grow', to: 'ring', dashed: true, via: [[540, 70], [330, 70]] },
        { from: 'ring', to: 'rep', label: 'dies', branch: 'no' },
        { from: 'rep', to: 'next' },
        { from: 'next', to: 'start', dashed: true, via: [[120, 300], [120, 40]] }
      ] }
    },

    /* ═══════════ X5 · Exactly-K Window Trick ═══════════ */
    x5: {
      icon: '🎯', minutes: 11,
      title: 'Extension X5 · Exactly-K Windows',
      hookTitle: '"At most k minus at most k−1 = exactly k"',
      hookText: 'Counting windows with EXACTLY k odd numbers directly is fiddly. Reframe: at-most-k is easy to count with a growing/shrinking window — and exactly k is just atMost(k) − atMost(k−1). One subtraction, two simple walks.',
      hookNarration: 'Exactly is hard. At-most is easy. And exactly k equals at-most k MINUS at-most k minus one. The overlap cancels perfectly.',
      imagine: {
        text: 'Photographers lining a fence counting groups of kids. "Exactly 3 red hats" is awkward. But "at most 3 red hats" slides: grow the frame right, and whenever a fourth red hat sneaks in, snap the left edge past the oldest red. Do it once allowing three, once allowing two — subtract. The sets nest like Russian dolls, and the difference is the middle doll.',
        scene: { arr: [1, 1, 2, 1, 1], ptrs: {}, marks: {}, aux: [{ label: 'target', value: 'exactly k = 2 odd' }] }
      },
      problem: {
        mode: 'stretch',
        setup: 'Row of numbers, k = 2 odd:',
        ask: 'Tap a contiguous stretch containing EXACTLY two odd numbers.',
        arr: [1, 1, 2, 1, 1],
        narration: 'Row one, one, two, one, one. Find a stretch with exactly two odd numbers. Tap its ends.',
        punch: 'Several qualify. COUNTING them all without double-counting is the puzzle — solved by subtraction of nested sets.'
      },
      brute: {
        trace: () => ({ code: ['# count every subarray, test odds==k', 'cnt = 0', 'for i in range(n):', '    odds = 0', '    for j in range(i, n):', '        odds += nums[j]%2', '        if odds == k: cnt += 1'],
          steps: [
            { line: 2, caption: 'every start, every extension', narration: 'Quadratic enumeration: each subarray individually tested for odd count.', state: { arr: [1, 1, 2, 1, 1], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp' }, aux: [{ label: 'tested', value: 'n(n+1)/2 = 15' }] }, fx: { type: 'compare', indices: [] } },
            { line: 5, caption: '10⁵ array → 5×10⁹ tests', narration: 'Fine for five cells. A hundred-thousand-cell row: billions of tests.', state: { arr: [1, 1, 2, 1, 1], marks: {}, aux: [{ label: 'scale', value: 'O(n²)' }] }, fx: { type: 'none' } }
          ] }),
        scale: [
          { n: 'n = 5', brute: '15 tests', pat: '2 linear walks' },
          { n: 'n = 10⁵', brute: '5×10⁹', pat: '2×10⁵' },
          { n: 'k varies', brute: 'same', pat: 'same formula' }
        ],
        punch: 'Nested-set subtraction turns a counting monster into two window walks.'
      },
      idea: {
        steps: [
          { word: 'REFRAME', text: 'exactly(k) = atMost(k) − atMost(k−1). Verify with a Venn of nested windows.', state: { arr: [1, 1, 2, 1, 1], ptrs: {}, marks: {}, aux: [{ label: 'identity', value: 'ex(k)=at(k)−at(k−1)' }] }, why: 'Subarrays-with-≤k-odds ⊆ … nesting means the difference isolates exactly-k.', fx: { type: 'init' } },
          { word: 'GROW', sceneFx: { ring: [0, 1], pulse: 0, color: '#22d3ee' }, text: 'atMost(2): slide right, odds counter rises 1,2 — still legal, every window ending here counts.', state: { arr: [1, 1, 2, 1, 1], ptrs: { L: 0, R: 1 }, marks: win(0, 1), aux: [{ label: 'odds', value: '2 ≤ 2 ✓' }, { label: 'add', value: '+2 windows' }] }, why: 'When [L..R] is legal, ALL its suffixes are legal too — add R−L+1 at once. That bulk-add is the counting trick.', fx: { type: 'compare', indices: [0, 1] } },
          { word: 'SHRINK', sceneFx: { ring: [2, 3], dim: true }, text: 'Third odd arrives → evict from the left until odds ≤ 2. Add the surviving count.', state: { arr: [1, 1, 2, 1, 1], ptrs: { L: 1, R: 3 }, marks: win(1, 3), aux: [{ label: 'odds', value: 'shrink → 2' }, { label: 'add', value: '+3 windows' }] }, fx: { type: 'write' } },
          { word: 'SUBTRACT', text: 'atMost(2) = 9, atMost(1) = 6 → exactly(2) = 3. Two walks, one subtraction.', state: { arr: [1, 1, 2, 1, 1], ptrs: {}, marks: {}, aux: [{ label: 'atMost(2)', value: '9' }, { label: 'atMost(1)', value: '6' }, { label: 'answer', value: '3 ✓' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Count subarrays with [[0|EXACTLY k]] of something — direct window overshoots and undercounts.',
        pairs: [
          { move: 'Exactly → convert to at-most', why: 'At-most admits the bulk-add R−L+1; exactly does not.' },
          { move: 'Two at-most walks → subtract', why: 'Nested families cancel; residue is the exact layer.' },
          { move: 'Odd/even/greater-than → binary counters', why: 'Any predicate reduces to counting flags in the window.' }
        ]
      },
      codeMap: {
        intro: 'The atMost engine.',
        lines: [
          { word: 'INIT', code: 'L = 0; odds = 0; ans = 0', note: 'window state' },
          { word: 'GROW', code: 'for R in range(n): odds += nums[R]%2', note: 'absorb right edge' },
          { word: 'SHRINK', code: '    while odds > k: odds -= nums[L]%2; L += 1', note: 'evict until legal' },
          { word: 'ADD', code: '    ans += R - L + 1', note: 'ALL suffixes legal!' },
          { word: 'DIFF', code: 'return atMost(k) - atMost(k-1)', note: 'the identity' }
        ]
      },
      recognize: {
        q: 'X5 territory?',
        options: [
          { text: 'Number of subarrays with exactly k odd numbers / at most k vowels / bounded sum', ok: true, why: 'Counting + exact constraint = atMost difference. X5.' },
          { text: 'Minimum size subarray summing ≥ target', ok: false, why: 'Optimization not counting: plain P4.' },
          { text: 'Pair with target sum in sorted array', ok: false, why: 'P1.' }
        ]
      },
      invariant: 'At every R, [L..R] is the LONGEST legal window ending at R; hence exactly R−L+1 legal subarrays end at R, all distinct across different R — no double counting.',
      explain: {
        question: 'Why does atMost count windows by ADDING R−L+1 rather than checking one window at a time?',
        fallback: {
          q: 'The bulk-add is valid because…',
          options: [
            'Every SUFFIX of a legal at-most window is also legal, and each ending-R suffix is a distinct subarray',
            'Windows overlap so we average them',
            'Because k is small',
            'It is an approximation corrected later'
          ],
          correct: 0,
          why: 'Monotonicity of "at most": shrinking never adds odds. Grouping by ending index partitions all subarrays — sum over R counts each once.'
        }
      },
      fightLabel: 'Extensions · Hard',
      bugTrap: {
        title: 'Bug trap · counting windows instead of subarrays',
        symptom: 'Adding 1 per R counts maximal windows, missing suffixes — totals come out too small.',
        fix: 'Add R − L + 1 (all suffixes), not 1.'
      },
      flow: { focus: 'legal', nodes: [
        { id: 'start', kind: 'start', label: 'atMost(k) walk', x: 245, y: 16, w: 150, h: 40 },
        { id: 'grow', kind: 'process', label: 'absorb nums[R]', x: 250, y: 96 },
        { id: 'legal', kind: 'decision', label: 'flags ≤ k ?', x: 245, y: 186, w: 140 },
        { id: 'evict', kind: 'process', label: 'release nums[L]\nL += 1', x: 465, y: 180, w: 140 },
        { id: 'bulk', kind: 'process', label: 'ans += R−L+1', x: 25, y: 180, w: 140 },
        { id: 'diff', kind: 'stop', label: 'atMost(k)−atMost(k−1)', x: 220, y: 300, w: 190 }
      ], edges: [
        { from: 'start', to: 'grow' }, { from: 'grow', to: 'legal' },
        { from: 'legal', to: 'evict', label: 'no', branch: 'no' },
        { from: 'evict', to: 'legal', dashed: true, via: [[535, 150], [330, 150]] },
        { from: 'legal', to: 'bulk', label: 'yes', branch: 'yes' },
        { from: 'bulk', to: 'grow', dashed: true, via: [[95, 60], [215, 60]] },
        { from: 'bulk', to: 'diff', label: 'R exhausted', branch: 'no', via: [[95, 320]] }
      ] }
    },

    /* ═══════════ X8 · Prefix + Hash ═══════════ */
    x8: {
      icon: '🗝️', minutes: 13,
      title: 'Extension X8 · Prefix Sum + Hash Map',
      hookTitle: 'Turn "sum between i and j" into "two equal keys"',
      hookText: 'With negatives, windows break — shrinking can HELP. Rescue the prefix-sum idea with a hash map: subarray (i..j] sums to k exactly when prefix_j − prefix_i = k, i.e., when you have previously SEEN prefix value (current − k). Count occurrences, not positions.',
      hookNarration: 'Range sum is a difference of prefixes. So a subarray sums to k iff an EARLIER prefix equals current-minus-k. Look it up in a hash map — and store how many times each prefix occurred.',
      imagine: {
        text: 'Hikers stamp a mileage book at every trailpost — cumulative elevation, going UP and DOWN freely. Two posts sharing a clever relation reveal a perfect segment: I want the climb between two stamps to be exactly k meters. Standing at today\'s stamp P, I ask my ledger: how many past stamps read P − k? Each such past post opens a flawless segment. The ledger is a hash map; counting entries, not erasing them, handles repeats.',
        scene: { arr: [1, 2, 3, -3, 1], ptrs: {}, marks: {}, row2: { label: 'prefix', arr: [0, 1, 3, 6, 3, 4], marks: {} }, aux: [{ label: 'k', value: 3 }] }
      },
      problem: {
        mode: 'stretch',
        setup: 'Row with a negative hiding in it, k = 3:',
        ask: 'Tap a stretch summing to 3 that a positives-only window would MISS.',
        arr: [1, 2, 3, -3, 1],
        narration: 'Row one, two, three, minus three, one. Target three. Find a stretch summing to three that a greedy window could never catch.',
        punch: 'Positions one to two: two plus one… wait — three alone works, but so does one, two, three, minus three, plus… negatives make shrinking irreversible. Enter the ledger.'
      },
      brute: {
        trace: () => ({ code: ['# all O(n²) subarrays', 'for i in range(n):', '    run = 0', '    for j in range(i, n):', '        run += nums[j]', '        if run == k: cnt += 1'],
          steps: [
            { line: 1, caption: 'quadratic enumeration again', narration: 'Every start, every end. Correct, slow, and completely ignores structure.', state: { arr: [1, 2, 3, -3, 1], marks: { 0: 'cmp', 1: 'cmp', 2: 'cmp', 3: 'cmp', 4: 'cmp' }, aux: [{ label: 'tests', value: '15' }] }, fx: { type: 'compare', indices: [] } },
            { line: 5, caption: 'n = 10⁵ → 5×10⁹', narration: 'Five billion extensions for a hundred thousand cells.', state: { arr: [1, 2, 3, -3, 1], marks: {}, aux: [{ label: 'scale', value: 'O(n²)' }] }, fx: { type: 'none' } }
          ] }),
        scale: [
          { n: 'n = 5', brute: '15 sums', pat: '5 lookups' },
          { n: 'n = 10⁵', brute: '5×10⁹', pat: '10⁵ dict ops' },
          { n: 'positives only?', brute: 'window suffices', pat: 'hash still linear' }
        ],
        punch: 'Prefix+Hash is the negatives-proof sibling of prefix sums.'
      },
      idea: {
        steps: [
          { word: 'LEDGER', text: 'seen = {0: 1}. The empty prefix occurred once — the leading zero reborn as a dictionary entry.', state: { arr: [1, 2, 3, -3, 1], ptrs: {}, marks: {}, aux: [{ label: 'seen', value: '{0:1}' }, { label: 'cur', value: 0 }] }, why: 'Without seed {0:1}, any subarray STARTING at index 0 is invisible. Same edge case P6 killed with a literal zero.', fx: { type: 'init' } },
          { word: 'WALK', text: 'cur = 1. Need cur−k = −2. Ledger: no −2. Record seen[1] = 1.', state: { arr: [1, 2, 3, -3, 1], marks: { 0: 'cmp' }, aux: [{ label: 'cur', value: 1 }, { label: 'need', value: '−2 ✗' }, { label: 'seen', value: '{0:1, 1:1}' }] }, fx: { type: 'compare', indices: [0] } },
          { word: 'WALK', text: 'cur = 3. Need 0 — YES, seen once → hit! Subarray [0..1] sums to 3. count = 1.', state: { arr: [1, 2, 3, -3, 1], marks: { 0: 'win', 1: 'win' }, aux: [{ label: 'cur', value: 3 }, { label: 'need', value: '0 ✓ ×1' }, { label: 'count', value: 1 }] }, why: 'prefix_j − prefix_i = k ⟺ seen contains cur−k. Difference of odometers = the stretch between.', fx: { type: 'found' } },
          { word: 'WALK', text: 'cur = 6. Need 3 — seen once ([1..2] = 3). count = 2.', state: { arr: [1, 2, 3, -3, 1], marks: { 1: 'win', 2: 'win' }, aux: [{ label: 'cur', value: 6 }, { label: 'need', value: '3 ✓ ×1' }, { label: 'count', value: 2 }] }, fx: { type: 'found' } },
          { word: 'NEG', sceneFx: { ring: [3], dim: true }, text: 'cur = 3 again (after −3). Need 0 ✓ once AND note: 3 now occurs TWICE — ledger counts multiplicities: seen[3] = 2.', state: { arr: [1, 2, 3, -3, 1], marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'out' }, aux: [{ label: 'cur', value: '3 (again)' }, { label: 'need', value: '0 ✓ ×1' }, { label: 'seen', value: '{…, 3:2}' }] }, why: 'Repeat prefixes are the whole point of storing COUNTS: each occurrence opens its own segments later.', fx: { type: 'write' } },
          { word: 'FOUND', sceneFx: { ring: [2, 3, 4] }, text: 'cur = 4: need 1 ✓ once. Final count = 4 subarrays: [1..2],[0..1],[0..3],[3..4]… trust the ledger: 4.', state: { arr: [1, 2, 3, -3, 1], marks: { 0: 'win', 1: 'win', 2: 'win', 3: 'win', 4: 'win' }, aux: [{ label: 'answer', value: '4' }, { label: 'done', value: '✓', done: true }] }, fx: { type: 'found' } }
        ]
      },
      triggers: {
        text: 'Count/find subarrays summing to [[0|k]] with [[1|negatives]] present — window shrink loses monotonicity.',
        pairs: [
          { move: 'Negatives → windows fail', why: 'Shrinking can INCREASE the sum; the "grow-shrink" contract is broken.' },
          { move: 'Sum = prefix difference → lookup', why: 'sub(i..j)==k ⟺ prefix_j − prefix_i == k ⟺ have you seen prefix_j − k?' },
          { move: 'Counting → store OCCURRENCES', why: 'Same prefix value at many indices: each contributes its own segments. Dict of counts.' }
        ]
      },
      codeMap: {
        intro: 'Five lines that replace O(n²).',
        lines: [
          { word: 'LEDGER', code: 'seen = {0: 1}; cur = cnt = 0', note: 'seed the empty prefix' },
          { word: 'WALK', code: 'for x in nums: cur += x', note: 'running odometer' },
          { word: 'LOOKUP', code: '    cnt += seen.get(cur - k, 0)', note: 'past doors that open here' },
          { word: 'RECORD', code: '    seen[cur] = seen.get(cur, 0) + 1', note: 'count, never erase' },
          { word: 'FOUND', code: 'return cnt', note: 'linear, negatives-proof' }
        ]
      },
      recognize: {
        q: 'X8 or plain P6?',
        options: [
          { text: 'COUNT subarrays summing to k, array HAS negatives', ok: true, why: 'Counting + negatives + fixed k: prefix + hash. X8.' },
          { text: 'Answer RANGE SUM queries on a static array', ok: false, why: 'Queries, not counting: plain P6 array of prefixes.' },
          { text: 'Max subarray sum', ok: false, why: 'Optimization: P7 Kadane.' }
        ]
      },
      invariant: 'Before recording cur at index j, seen[v] equals the number of prefixes (including the empty one) among indices ≤ j whose value is v; cnt equals the number of valid subarrays ending at or before j.',
      explain: {
        question: 'Why seed the map with {0: 1} instead of an empty map?',
        fallback: {
          q: 'The seed entry is for…',
          options: [
            'Subarrays starting at index 0 — their prefix_before is the empty prefix, value 0, occurring once',
            'Making the dictionary non-empty so .get works',
            'Counting the zero element of the array',
            'Historical convention'
          ],
          correct: 0,
          why: 'A subarray [0..j] satisfies cur − k = 0. Without seeing a 0 prefix, that door never opens. Same edge case, one level abstracted, as P6\'s leading zero.'
        }
      },
      fightLabel: 'Extensions · Hard',
      bugTrap: {
        title: 'Bug trap · recording BEFORE looking up',
        symptom: 'k = 0 self-matches: current prefix finds itself, inventing empty subarrays.',
        fix: 'Lookup first (past prefixes only), THEN record current. Order = causality.'
      },
      flow: { focus: 'lookup', nodes: [
        { id: 'start', kind: 'start', label: 'seen={0:1}', x: 250, y: 16, w: 140, h: 40 },
        { id: 'walk', kind: 'io', label: 'cur += x', x: 250, y: 100 },
        { id: 'lookup', kind: 'decision', label: 'seen[cur−k]?', x: 240, y: 192, w: 160, note: 'ask the LEDGER' },
        { id: 'add', kind: 'process', label: 'cnt += occ', x: 460, y: 186, w: 130 },
        { id: 'rec', kind: 'process', label: 'seen[cur] += 1', x: 250, y: 292, w: 150, note: 'record AFTER lookup' },
        { id: 'done', kind: 'stop', label: 'return cnt', x: 30, y: 192, w: 120 }
      ], edges: [
        { from: 'start', to: 'walk' }, { from: 'walk', to: 'lookup' },
        { from: 'lookup', to: 'add', label: 'present', branch: 'yes' },
        { from: 'add', to: 'rec' },
        { from: 'lookup', to: 'rec', label: 'absent (+0)', branch: 'no' },
        { from: 'rec', to: 'walk', label: 'next x', dashed: true, via: [[325, 60], [325, 60]] },
        { from: 'walk', to: 'done', label: 'exhausted', branch: 'no', via: [[120, 140]] }
      ] }
    }
  };

  /* Worked-problem flavor notes straight from the sheet, attached to lessons */
  const SHEET_NOTES = {
    p2: 'Sheet worked problems: Remove Element · Remove Duplicates · Move Zeroes. Bug trap: shifting survivors twice — the write cursor already orders them.',
    p3: 'Sheet worked problem: Merge Sorted Array (88). The slack-at-the-back is the signature of backwards writing.',
    p5: 'Sheet worked problems: Intersection of Two Arrays II · minimum-index-sum of two lists.',
    p7: 'Sheet worked problems: Maximum Subarray · Maximum Product Subarray (track min AND max streaks — negatives flip champions).',
    guard: 'Sheet technique page: appears inside Groups, Run-Length, and every "skip the equal run" inner loop.',
    x1: 'Sheet extension X.1: Sort Colors (75) — the quicksort-3-way core.',
    x2: 'Sheet extension X.2: Longest Palindromic Substring (5) — centers on cells AND gaps.',
    x5: 'Sheet extension X.5: Subarrays with K Different Integers · Exactly-K-Odds.',
    x8: 'Sheet extension X.8: Subarray Sum Equals K (560) · Continuous Subarray Multiple of K.'
  };

  return { SCRIPTS, SHEET_NOTES };
})();
