/* ═══════════════════════════════════════════════════════════ */
/*  03-questions.js — Vol 1 question bank (85 questions)       */
/*  11 types × 13 patterns × 3 difficulty tiers                */
/*  Depends on: 01-state.js                                     */
/* ═══════════════════════════════════════════════════════════ */
window.CF = window.CF || {};

CF.Questions = (() => {
  /* ═══ TYPE METADATA ═══ */
  // Damage multiplier per type. Speed tier multiplier stacks on top.
  const TYPE_META = {
    pattern:    { tier: 'recognition',  weight: 0.7,  baseDamage: 15, label: 'Pattern Recognition' },
    complexity: { tier: 'recognition',  weight: 0.8,  baseDamage: 18, label: 'Complexity' },
    chips:      { tier: 'application',  weight: 1.0,  baseDamage: 20, label: 'Fill the Blank' },
    state:      { tier: 'comprehension',weight: 1.25, baseDamage: 25, label: 'State Tracking' },
    trace:      { tier: 'comprehension',weight: 1.25, baseDamage: 25, label: 'Trace Output' },
    nextline:   { tier: 'application',  weight: 1.35, baseDamage: 27, label: 'Next Line' },
    order:      { tier: 'application',  weight: 1.4,  baseDamage: 28, label: 'Order the Lines' },
    flowchart:  { tier: 'application',  weight: 1.4,  baseDamage: 28, label: 'Flowchart Path' },
    invariant:  { tier: 'analysis',     weight: 1.6,  baseDamage: 32, label: 'Invariant / Why' },
    bug:        { tier: 'analysis',     weight: 1.75, baseDamage: 35, label: 'Spot the Bug' },
    numeric:    { tier: 'comprehension',weight: 1.25, baseDamage: 25, label: 'Numeric Answer' }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /*  THE BANK                                                    */
  /* ═══════════════════════════════════════════════════════════ */
  const BANK = [
    /* ═══════════════════════════════════════════════════════ */
    /*  F1 · FOUNDATIONS (5)                                   */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'f1-q1', pattern: 'f1', difficulty: 1, type: 'state',
      title: 'What does this print?',
      prompt: 'Trace the loop by hand.',
      code: 's = ["c","o","d","e"]\nL, R = 0, 3\nwhile L < R:\n    s[L], s[R] = s[R], s[L]\n    L += 1\n    R -= 1\nprint("".join(s))',
      options: ['edoc', 'code', 'ocde', 'deco'],
      correct: 0,
      explanation: 'Two in-place swaps: c↔e, then o↔d. Strict bound L < R — the loop stops when L = 2, R = 1.'
    },
    {
      id: 'f1-q2', pattern: 'f1', difficulty: 2, type: 'bug',
      title: 'Why does this crash?',
      prompt: 'nums = [2, 0, 0, 0]. The loop crashes with IndexError. Why?',
      code: 'r = 1\nwhile nums[r] == 0 and r < len(nums):\n    r += 1',
      options: [
        'The junk test runs first — once r reaches len(nums), it reads nums[4] on a length-4 array before the bounds check can stop it',
        'The loop needs a write pointer as well',
        'while loops cannot combine two conditions with and',
        'The crash only happens on even-length arrays'
      ],
      correct: 0,
      explanation: 'Primitive 6: bounds FIRST — while r < n and nums[r] == 0. "and" checks left to right, so the junk test must never see an out-of-range r.'
    },
    {
      id: 'f1-q3', pattern: 'f1', difficulty: 2, type: 'invariant',
      title: 'What does write equal?',
      prompt: 'nums = [3, 0, 4, 0, 5]. One in-place pass erases the zeros using read r and write w. After the pass:',
      code: 'if nums[r] != 0:\n    nums[w] = nums[r]\n    w += 1\nr += 1',
      options: ['w = 3 — the clean length; the first 3 cells read [3, 4, 5]', 'w = 2 — one per zero', 'w = 5 — the whole array', 'w = 0 — nothing was written'],
      correct: 0,
      explanation: 'Primitive 4: the final write IS the virtual length. [3, 4, 5, …] with w = 3 — the tail is harmless garbage.'
    },
    {
      id: 'f1-q4', pattern: 'f1', difficulty: 1, type: 'pattern',
      title: 'Which primitive is the hero?',
      prompt: 'Erase all zeros from a huge array — in place, one pass, no second array. Which primitive carries the job?',
      options: ['Read & write pointers (the overwrite rule)', 'Prefix sums', 'In-place swap of two hands', 'Extreme values (−inf / +inf)'],
      correct: 0,
      explanation: 'The overwrite rule: read scans, write keeps the clean boundary — junk is skipped, not copied.'
    },
    {
      id: 'f1-q5', pattern: 'f1', difficulty: 2, type: 'trace',
      title: 'Odd-length reverse',
      prompt: 's = ["t","r","a","c","e"]. After the strict-bound swap loop, which letter never moves?',
      options: ['a — the middle: L and R meet on it and L < R goes false', 't — the first letter', 'c — it gets swapped twice', 'All letters move'],
      correct: 0,
      explanation: 'Strict bound while L < R: for odd n the hands MEET on the middle letter — swapped zero times. Inclusive <= would swap it with itself: wasted work.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P1 · CONVERGING (9)                                    */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p1-q1', pattern: 'p1', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Sorted array of integers. Find whether ANY two elements sum to a target value. Fastest approach?',
      options: [
        'P1 · Two Pointers Converging',
        'P4 · Sliding Window',
        'P6 · Prefix Sum',
        'P7 · Kadane',
        'Hash map lookup',
        'Sort then binary search'
      ],
      correct: 0,
      explanation: 'Sorted input + pair matching → converge from both ends. O(N) time, O(1) space.'
    },
    {
      id: 'p1-q2', pattern: 'p1', difficulty: 1, type: 'state',
      title: 'What is the sum?',
      prompt: 'numbers = [2, 7, 11, 15], target = 9. L = 0, R = 3.',
      code: 'current_sum = numbers[L] + numbers[R]',
      options: ['9', '17', '13', '22'],
      correct: 1,
      explanation: '2 + 15 = 17. Sum exceeds target, so R must move left.'
    },
    {
      id: 'p1-q3', pattern: 'p1', difficulty: 2, type: 'trace',
      title: 'What does this return?',
      prompt: 's = ["h","e","l","l","o"]',
      code: 'left, right = 0, len(s) - 1\nwhile left < right:\n    s[left], s[right] = s[right], s[left]\n    left += 1\n    right -= 1\nreturn s',
      options: ['["o","l","l","e","h"]', '["h","e","l","l","o"]', '["o","h","e","l","l"]', '["l","l","o","h","e"]'],
      correct: 0,
      explanation: 'In-place reversal via converging swap. Only the middle element (index 2) never moves.'
    },
    {
      id: 'p1-q4', pattern: 'p1', difficulty: 1, type: 'chips',
      title: 'Complete the swap',
      prompt: 'Fill the blank in the tuple swap.',
      code: 'while left < right:\n    s[left], s[right] = ____\n    left += 1\n    right -= 1',
      tokens: ['s[right], s[left]', 's[left], s[right]', 'right, left', 's[left - 1], s[right + 1]'],
      correct: 0,
      explanation: 'Python evaluates the entire right side first — no temp variable needed.'
    },
    {
      id: 'p1-q5', pattern: 'p1', difficulty: 2, type: 'invariant',
      title: 'Why move the shorter line?',
      prompt: 'In Container With Most Water, why is moving the SHORTER line inward always safe?',
      options: [
        'The taller line is redundant',
        'Any inward move shrinks the width — the shorter line already caps the height, so no move can beat the current area',
        'We already recorded the maximum, so it does not matter',
        'It is a heuristic — the algorithm can miss the true optimum'
      ],
      correct: 1,
      explanation: 'Width strictly decreases with any inward move. The shorter line is the bottleneck for height. So the taller line can never produce a better area than what we already have.'
    },
    {
      id: 'p1-q6', pattern: 'p1', difficulty: 2, type: 'complexity',
      title: 'Time complexity of 3Sum',
      prompt: 'Sort the array once. Then for each anchor i, converge L and R over the suffix.',
      options: ['O(N)', 'O(N log N)', 'O(N²)', 'O(N² log N)', 'O(N³)', 'O(2^N)'],
      correct: 2,
      explanation: 'Sort is O(N log N). Outer loop N iterations × inner converge O(N) = O(N²). Overall O(N²).'
    },
    {
      id: 'p1-q7', pattern: 'p1', difficulty: 3, type: 'bug',
      title: 'Which input exposes the bug?',
      prompt: 'This 3Sum variant is wrong. What input makes it produce a wrong answer?',
      code: 'res = []\nfor i in range(n - 2):\n    L, R = i + 1, n - 1\n    while L < R:\n        total = nums[i] + nums[L] + nums[R]\n        if total == 0:\n            res.append([nums[i], nums[L], nums[R]])\n            L += 1\n            R -= 1\n        elif total < 0:\n            L += 1\n        else:\n            R -= 1\nreturn res',
      options: ['[-1, 0, 1]', '[-2, 0, 0, 2]', '[0, 0, 0]', '[1, 2, 3]'],
      correct: 1,
      explanation: 'Two different i values produce the same triplet [-2, 0, 2]. The outer anchor never skips duplicates. [-2,0,0,2] triggers this.'
    },
    {
      id: 'p1-q8', pattern: 'p1', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Two Sum II. sum = 13, target = 9. What happens next?',
      code: 'if current_sum == target:\n    return [left + 1, right + 1]\n???',
      options: ['left += 1', 'right -= 1', 'return []', 'right += 1', 'left -= 1'],
      correct: 1,
      explanation: '13 > 9, so the sum is too large. Move R left for a smaller value.'
    },
    {
      id: 'p1-q9', pattern: 'p1', difficulty: 2, type: 'flowchart',
      title: 'Which branch?',
      prompt: 'Reverse String flowchart. L = 2, R = 2. Which path?',
      flowchartSvg: 'reverse-string',
      highlightNode: 'L < R ?',
      options: ['Swap s[L] ↔ s[R]', 'End', 'L++, R--'],
      correct: 1,
      explanation: 'When L == R, the strict bound L < R fails. Loop exits. Only the middle element remains.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P2 · READ-WRITE (9)                                    */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p2-q1', pattern: 'p2', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Remove all occurrences of a value from an array, in place. Return the new length. Fastest approach?',
      options: [
        'P2 · Same-direction Read & Write',
        'P1 · Two Pointers Converging',
        'P4 · Sliding Window',
        'P6 · Prefix Sum',
        'Sort then binary search'
      ],
      correct: 0,
      explanation: 'Both pointers start at 0. Read scans, write builds the valid prefix in place.'
    },
    {
      id: 'p2-q2', pattern: 'p2', difficulty: 1, type: 'state',
      title: 'What is write after 3 iterations?',
      prompt: 'nums = [3, 2, 2, 3], val = 3.',
      code: 'write = 0\nfor read in range(4):\n    if nums[read] != val:\n        nums[write] = nums[read]\n        write += 1',
      options: ['0', '1', '2', '3'],
      correct: 1,
      explanation: 'read=0 (3): skip. read=1 (2): write → nums[0]=2, write=1. read=2 (2): write → nums[1]=2, write=2. read=3 (3): skip. write = 2 at the end.'
    },
    {
      id: 'p2-q3', pattern: 'p2', difficulty: 2, type: 'trace',
      title: 'What does this return?',
      prompt: 'nums = [0, 0, 1, 1, 1, 2]',
      code: 'slow = 0\nfor fast in range(1, len(nums)):\n    if nums[fast] != nums[slow]:\n        slow += 1\n        nums[slow] = nums[fast]\nreturn slow + 1',
      options: ['3', '6', '2', '[0, 1, 2]'],
      correct: 0,
      explanation: 'slow ends at index 2 (the last unique value 2). Return slow + 1 = 3 = the new logical length.'
    },
    {
      id: 'p2-q4', pattern: 'p2', difficulty: 1, type: 'chips',
      title: 'Complete the write',
      prompt: 'Fill the blank.',
      code: 'for read in range(len(nums)):\n    if nums[read] != val:\n        nums[____] = nums[read]\n        write += 1',
      tokens: ['write', 'read', 'read + 1', 'write - 1'],
      correct: 0,
      explanation: 'The write pointer tracks the boundary of the valid output region.'
    },
    {
      id: 'p2-q5', pattern: 'p2', difficulty: 2, type: 'invariant',
      title: 'Why not just move zeros?',
      prompt: 'Move Zeroes: why do we SWAP instead of overwrite nums[write] = nums[read]?',
      code: 'for read in range(len(nums)):\n    if nums[read] != 0:\n        nums[write], nums[read] = nums[read], nums[write]\n        write += 1',
      options: [
        'Swapping is faster',
        'Overwriting would leave a duplicate of the non-zero value',
        'Swapping is required by Python syntax',
        'There is no difference — both work'
      ],
      correct: 1,
      explanation: 'Overwriting loses the value at write (which is a 0 we need to move later). Swap exchanges them.'
    },
    {
      id: 'p2-q6', pattern: 'p2', difficulty: 1, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Remove Duplicates from a sorted array using slow/fast.',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'O(N²)', 'O(2^N)'],
      correct: 2,
      explanation: 'Single pass with one comparison per element. O(N) time, O(1) space.'
    },
    {
      id: 'p2-q7', pattern: 'p2', difficulty: 3, type: 'bug',
      title: 'Which input exposes the bug?',
      prompt: 'This remove-duplicates variant is wrong. What input fails?',
      code: 'if not nums:\n    return 0\nslow = 0\nfor fast in range(1, len(nums)):\n    if nums[fast] != nums[slow]:\n        slow += 1\n        nums[slow] = nums[fast]\nreturn slow',
      options: ['[1, 1, 2]', '[1, 2, 3]', '[1, 1, 1]', '[0]'],
      correct: 1,
      explanation: 'return slow should be return slow + 1. On [1,2,3] all unique, slow reaches 2 but the length is 3.'
    },
    {
      id: 'p2-q8', pattern: 'p2', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Remove Element. nums[read] != val is true.',
      code: 'if nums[read] != val:\n    nums[write] = nums[read]\n    ???',
      options: ['write += 1', 'read += 1', 'write -= 1', 'return write', 'read = write'],
      correct: 0,
      explanation: 'After copying the value, advance the write pointer to the next free slot.'
    },
    {
      id: 'p2-q9', pattern: 'p2', difficulty: 2, type: 'order',
      title: 'Order the algorithm',
      prompt: 'Reconstruct the Read-Write core.',
      lines: [
        'return write',
        'write = 0',
        'for read in range(len(nums)):',
        'write += 1',
        'if nums[read] != val:',
        'nums[write] = nums[read]'
      ],
      correctOrder: [1, 2, 4, 5, 3, 0],
      explanation: 'Init write → loop → check condition → copy → advance → return.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P3 · BACKWARDS WRITE (6)                               */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p3-q1', pattern: 'p3', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Sorted array with negatives. Return an array of squares, also sorted. Fastest approach?',
      options: [
        'P3 · Converging + Backwards Write',
        'Sort after squaring',
        'P7 · Kadane',
        'P1 · Two Pointers Converging only'
      ],
      correct: 0,
      explanation: 'The largest squares are at the extremes. Converge on inputs, write output from the end.'
    },
    {
      id: 'p3-q2', pattern: 'p3', difficulty: 2, type: 'state',
      title: 'What is write after 2 iterations?',
      prompt: 'nums = [-4, -1, 0, 3, 10], write starts at n - 1 = 4.',
      code: 'if abs(nums[left]) > abs(nums[right]):\n    res[write] = nums[left] ** 2\n    left += 1\nelse:\n    res[write] = nums[right] ** 2\n    right -= 1\nwrite -= 1',
      options: ['4', '3', '2', '1'],
      correct: 2,
      explanation: 'Start at 4. Iteration 1 picks 10² = 100, write = 3. Iteration 2 picks 4² = 16, write = 2.'
    },
    {
      id: 'p3-q3', pattern: 'p3', difficulty: 2, type: 'trace',
      title: 'What does this return?',
      prompt: 'nums1 = [1, 2, 3, 0, 0, 0], m = 3 · nums2 = [2, 5, 6], n = 3',
      code: 'i, j, write = m - 1, n - 1, m + n - 1\nwhile i >= 0 and j >= 0:\n    if nums1[i] > nums2[j]:\n        nums1[write] = nums1[i]; i -= 1\n    else:\n        nums1[write] = nums2[j]; j -= 1\n    write -= 1\nwhile j >= 0:\n    nums1[write] = nums2[j]; j -= 1; write -= 1',
      options: ['[1, 2, 2, 3, 5, 6]', '[1, 2, 3, 2, 5, 6]', '[2, 2, 1, 3, 5, 6]', '[1, 2, 3, 5, 6, 6]'],
      correct: 0,
      explanation: 'Merges from the back. Largest elements land first without overwriting remaining nums1 values.'
    },
    {
      id: 'p3-q4', pattern: 'p3', difficulty: 2, type: 'chips',
      title: 'Initialize write',
      prompt: 'Where does the write pointer start in Merge Sorted Array?',
      code: 'i = m - 1\nj = n - 1\nwrite = ____',
      tokens: ['m + n - 1', 'm - 1', 'n - 1', 'len(nums1)', '0'],
      correct: 0,
      explanation: 'nums1 has m + n slots total. Write fills from the last slot.'
    },
    {
      id: 'p3-q5', pattern: 'p3', difficulty: 1, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Squares of a Sorted Array using backwards write.',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'O(N²)', 'O(2^N)'],
      correct: 2,
      explanation: 'Single convergence pass. Each iteration writes one element. O(N) time, O(N) output space.'
    },
    {
      id: 'p3-q6', pattern: 'p3', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Squares algorithm. You just picked nums[right]².',
      code: 'else:\n    res[write] = nums[right] ** 2\n    right -= 1\n???',
      options: ['write -= 1', 'write += 1', 'left += 1', 'return res'],
      correct: 0,
      explanation: 'After every write, the write pointer moves LEFT (toward index 0) because we fill from the end.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P4 · SLIDING WINDOW (9)                                */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p4-q1', pattern: 'p4', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Find the length of the longest contiguous substring with no repeating characters. Fastest approach?',
      options: [
        'P4 · Sliding Window (variable)',
        'P1 · Two Pointers Converging',
        'P2 · Read-Write',
        'P6 · Prefix Sum',
        'P7 · Kadane'
      ],
      correct: 0,
      explanation: 'Contiguous range where adding hurts and removing helps → variable sliding window.'
    },
    {
      id: 'p4-q2', pattern: 'p4', difficulty: 2, type: 'state',
      title: 'What is the window size?',
      prompt: 'nums = [1, 12, -5, -6, 50, 3], k = 4. right = 3, left = 0.',
      code: 'size = right - left + 1',
      options: ['3', '4', '5', '2'],
      correct: 1,
      explanation: '3 − 0 + 1 = 4. The window has 4 elements.'
    },
    {
      id: 'p4-q3', pattern: 'p4', difficulty: 2, type: 'trace',
      title: 'What is the max average?',
      prompt: 'nums = [1, 12, -5, -6, 50, 3], k = 4',
      options: ['12.75', '12', '15.5', '10.25'],
      correct: 0,
      explanation: 'Windows of size 4: [1,12,-5,-6]=2/4, [12,-5,-6,50]=51/4=12.75, [-5,-6,50,3]=42/4=10.5. Max = 12.75.'
    },
    {
      id: 'p4-q4', pattern: 'p4', difficulty: 2, type: 'chips',
      title: 'Complete the fixed-window shrink',
      prompt: 'Fill the blank in the fixed-size window.',
      code: 'if right - left + 1 == k:\n    max_sum = max(max_sum, window_sum)\n    window_sum -= nums[____]\n    left += 1',
      tokens: ['left', 'right', 'left + 1', 'right - 1', '0'],
      correct: 0,
      explanation: 'When the window reaches size k, remove the leftmost element before advancing left.'
    },
    {
      id: 'p4-q5', pattern: 'p4', difficulty: 3, type: 'invariant',
      title: 'Why shrink on the sum being large?',
      prompt: 'Minimum Size Subarray Sum. Why do we shrink while sum >= target?',
      code: 'while window_sum >= target:\n    min_len = min(min_len, right - left + 1)\n    window_sum -= nums[left]\n    left += 1',
      options: [
        'We need the smallest valid window — shrinking is safe because we already recorded the current size',
        'To make the sum smaller so it stops being valid',
        'To avoid integer overflow',
        'Because the target might change'
      ],
      correct: 0,
      explanation: 'Once the window is valid, we record its size, then try to shrink to find an even smaller valid window. The while loop keeps shrinking until invalid.'
    },
    {
      id: 'p4-q6', pattern: 'p4', difficulty: 2, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Longest Substring Without Repeating Characters using a variable window + set.',
      options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'O(N²)', 'O(2^N)'],
      correct: 2,
      explanation: 'Each element enters the set once and leaves the set once. Two pointers move at most N steps total. O(N).'
    },
    {
      id: 'p4-q7', pattern: 'p4', difficulty: 3, type: 'bug',
      title: 'Which input exposes the bug?',
      prompt: 'This sliding window is wrong. What input fails?',
      code: 'left = 0\nseen = set()\nmax_len = 0\nfor right in range(len(s)):\n    while s[right] in seen:\n        left += 1\n    seen.add(s[right])\n    max_len = max(max_len, right - left + 1)\nreturn max_len',
      options: ['"abcabcbb"', '"bbbbb"', '"pwwkew"', '"abc"'],
      correct: 0,
      explanation: 's[left] is never removed from the set. On "abcabcbb", the set grows forever and the window stops advancing correctly.'
    },
    {
      id: 'p4-q8', pattern: 'p4', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Variable sliding window. You just detected a duplicate.',
      code: 'while s[right] in seen:\n    ???\n    left += 1',
      options: ['seen.remove(s[left])', 'seen.clear()', 'seen.add(s[left])', 'right -= 1'],
      correct: 0,
      explanation: 'The element leaving the window is s[left] — remove it from the set before advancing left.'
    },
    {
      id: 'p4-q9', pattern: 'p4', difficulty: 2, type: 'numeric',
      title: 'What is the answer?',
      prompt: 'nums = [2, 3, 1, 2, 4, 3], target = 7. What is the minimum subarray length?',
      code: 'Return the length of the smallest contiguous subarray with sum >= target.',
      answer: 2,
      explanation: '[4, 3] has sum 7 — the smallest valid window.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P5 · TWO-ARRAY MERGE (6)                               */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p5-q1', pattern: 'p5', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Two sorted arrays. Find their intersection (as a multiset). Fastest approach?',
      options: [
        'P5 · Two-Array Merge (one pointer per input)',
        'P1 · Two Pointers Converging',
        'P6 · Prefix Sum',
        'P4 · Sliding Window'
      ],
      correct: 0,
      explanation: 'One pointer per array. Advance whichever is behind. Match advances both.'
    },
    {
      id: 'p5-q2', pattern: 'p5', difficulty: 2, type: 'state',
      title: 'Which pointer advances?',
      prompt: 's = "abc", t = "ahbgdc". i = 1 (b), j = 1 (h).',
      code: 'if s[i] == t[j]:\n    i += 1\nj += 1',
      options: ['i and j both advance', 'Only i advances', 'Only j advances', 'Loop ends'],
      correct: 2,
      explanation: 's[i] = "b" ≠ t[j] = "h". Only j advances to find a match for b.'
    },
    {
      id: 'p5-q3', pattern: 'p5', difficulty: 2, type: 'trace',
      title: 'What is the intersection?',
      prompt: 'nums1 = [1, 2, 2, 1] (sorted → [1,1,2,2]), nums2 = [2, 2]',
      options: ['[2, 2]', '[2]', '[1, 2]', '[2, 2, 1, 1]'],
      correct: 0,
      explanation: 'Both 2s in nums2 match the 2s in nums1. Result is a multiset [2, 2].'
    },
    {
      id: 'p5-q4', pattern: 'p5', difficulty: 1, type: 'chips',
      title: 'Complete the subsequence advance',
      prompt: 'When s[i] matches t[j], what happens?',
      code: 'while i < len(s) and j < len(t):\n    if s[i] == t[j]:\n        ____\n    j += 1',
      tokens: ['i += 1', 'i -= 1', 'j -= 1', 'return True'],
      correct: 0,
      explanation: 'i advances only on a match. j always advances.'
    },
    {
      id: 'p5-q5', pattern: 'p5', difficulty: 2, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Intersection of Two Arrays II using sort + two-array merge.',
      options: ['O(N)', 'O(N log N)', 'O(N + M)', 'O(N log N + M log M)', 'O(N × M)', 'O(N²)'],
      correct: 3,
      explanation: 'Sort both: O(N log N + M log M). Two-array merge: O(N + M). Overall O(N log N + M log M).'
    },
    {
      id: 'p5-q6', pattern: 'p5', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Intersection. nums1[i] = 3, nums2[j] = 7.',
      code: 'if nums1[i] == nums2[j]:\n    res.append(nums1[i]); i += 1; j += 1\nelif nums1[i] < nums2[j]:\n    ???\nelse:\n    j += 1',
      options: ['i += 1', 'j += 1', 'break', 'i -= 1'],
      correct: 0,
      explanation: 'nums1[i] is smaller, so advance i to try to catch up with nums2.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P6 · PREFIX SUM (8)                                    */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p6-q1', pattern: 'p6', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Static array. Answer many range sum queries (left, right) in O(1) each. Fastest approach?',
      options: [
        'P6 · Precompute Prefix Sum',
        'P4 · Sliding Window',
        'P7 · Kadane',
        'P1 · Two Pointers Converging',
        'Binary search per query'
      ],
      correct: 0,
      explanation: 'Build prefix once in O(N). Each query becomes prefix[right+1] − prefix[left], O(1).'
    },
    {
      id: 'p6-q2', pattern: 'p6', difficulty: 2, type: 'state',
      title: 'What is left_sum at i = 3?',
      prompt: 'nums = [1, 7, 3, 6, 5, 6]',
      code: 'left_sum = 0\nfor i in range(len(nums)):\n    if left_sum == total - left_sum - nums[i]:\n        return i\n    left_sum += nums[i]',
      options: ['4', '11', '7', '10'],
      correct: 1,
      explanation: 'i=0: left=0, then left=1. i=1: left=1, then left=8. i=2: left=8, then left=11. At the top of i=3, left_sum = 11.'
    },
    {
      id: 'p6-q3', pattern: 'p6', difficulty: 2, type: 'trace',
      title: 'What is the output?',
      prompt: 'nums = [1, 2, 3, 4]',
      code: 'n = len(nums)\nres = [1] * n\nprefix = 1\nfor i in range(n):\n    res[i] = prefix\n    prefix *= nums[i]\nsuffix = 1\nfor i in range(n - 1, -1, -1):\n    res[i] *= suffix\n    suffix *= nums[i]\nreturn res',
      options: ['[24, 12, 8, 6]', '[1, 2, 3, 4]', '[24, 12, 4, 1]', '[6, 8, 12, 24]'],
      correct: 0,
      explanation: 'Each res[i] = product of everything except nums[i].'
    },
    {
      id: 'p6-q4', pattern: 'p6', difficulty: 2, type: 'chips',
      title: 'Complete the range query',
      prompt: 'O(1) range sum from prefix array.',
      code: 'def sumRange(self, left, right):\n    return self.prefix[____] - self.prefix[left]',
      tokens: ['right + 1', 'right', 'right - 1', 'left + 1'],
      correct: 0,
      explanation: 'prefix has a leading zero. prefix[right+1] covers nums[0..right].'
    },
    {
      id: 'p6-q5', pattern: 'p6', difficulty: 3, type: 'invariant',
      title: 'Why the leading zero?',
      prompt: 'Why does the prefix array start with prefix[0] = 0?',
      options: [
        'It saves memory',
        'It handles the "left == 0" case cleanly — sumRange(0, r) needs a valid left boundary',
        'Python requires it',
        'It speeds up sorting'
      ],
      correct: 1,
      explanation: 'Without the leading zero, you would special-case every query that starts at index 0. The extra slot eliminates this whole bug class.'
    },
    {
      id: 'p6-q6', pattern: 'p6', difficulty: 2, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Range Sum Query — Immutable. Build once, then many sumRange queries.',
      options: [
        'Build O(N), query O(1)',
        'Build O(1), query O(N)',
        'Build O(N log N), query O(log N)',
        'Build O(N²), query O(1)',
        'Build O(1), query O(1)'
      ],
      correct: 0,
      explanation: 'Building prefix is one linear pass. Each query is a single subtraction.'
    },
    {
      id: 'p6-q7', pattern: 'p6', difficulty: 3, type: 'bug',
      title: 'Which input exposes the bug?',
      prompt: 'This prefix-sum range query is wrong. What input fails?',
      code: 'prefix = [0] * n\nfor i in range(n):\n    prefix[i] = prefix[i-1] + nums[i]\ndef sumRange(left, right):\n    return prefix[right] - prefix[left-1]',
      options: ['nums=[1,2,3], sumRange(0,2)', 'nums=[1,2,3], sumRange(1,2)', 'nums=[1], sumRange(0,0)', 'nums=[5,5,5], sumRange(1,1)'],
      correct: 0,
      explanation: 'prefix array is size n (no leading zero), and prefix[left-1] breaks when left = 0.'
    },
    {
      id: 'p6-q8', pattern: 'p6', difficulty: 2, type: 'numeric',
      title: 'What is the sum?',
      prompt: 'nums = [3, 1, 4, 1, 5], prefix = [0, 3, 4, 8, 9, 14].',
      code: 'sumRange(1, 3)',
      answer: 6,
      explanation: 'prefix[4] − prefix[1] = 9 − 3 = 6. That is nums[1] + nums[2] + nums[3] = 1 + 4 + 1 = 6.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  P7 · KADANE (6)                                        */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'p7-q1', pattern: 'p7', difficulty: 1, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Find the contiguous subarray with the largest sum. Return the sum.',
      options: [
        'P7 · Kadane (running extremes)',
        'P1 · Two Pointers Converging',
        'P6 · Prefix Sum',
        'P4 · Sliding Window'
      ],
      correct: 0,
      explanation: 'Track best ending here + best overall. Extend or restart at each step.'
    },
    {
      id: 'p7-q2', pattern: 'p7', difficulty: 2, type: 'state',
      title: 'What is "here" after this step?',
      prompt: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]. here was 4, best was 4. Now at i = 4 (value -1).',
      code: 'here = max(nums[i], here + nums[i])',
      options: ['3', '4', '−1', '−5'],
      correct: 0,
      explanation: 'max(−1, 4 + (−1)) = max(−1, 3) = 3. Extend the run.'
    },
    {
      id: 'p7-q3', pattern: 'p7', difficulty: 2, type: 'trace',
      title: 'What is the answer?',
      prompt: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]',
      options: ['6', '7', '4', '9'],
      correct: 0,
      explanation: 'Subarray [4, -1, 2, 1] sums to 6.'
    },
    {
      id: 'p7-q4', pattern: 'p7', difficulty: 2, type: 'chips',
      title: 'Complete the recurrence',
      prompt: 'Fill the blank.',
      code: 'here = max(____, here + x)\nbest = max(best, here)',
      tokens: ['x', '0', 'nums[0]', 'best', 'here'],
      correct: 0,
      explanation: 'here = max(nums[i], here + nums[i]) — extend or restart at the current element.'
    },
    {
      id: 'p7-q5', pattern: 'p7', difficulty: 3, type: 'invariant',
      title: 'Why track min in the product variant?',
      prompt: 'Maximum Product Subarray tracks BOTH cur_max and cur_min. Why?',
      options: [
        'To make the code slower',
        'Because a very negative cur_min × a negative number can become the new cur_max',
        'Python requires two variables',
        'To save memory'
      ],
      correct: 1,
      explanation: 'Sign flips mean the "worst" value at step i can be the "best" value at step i+1. Track both to catch sign flips.'
    },
    {
      id: 'p7-q6', pattern: 'p7', difficulty: 3, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Maximum Product Subarray. You just computed the candidates.',
      code: 'candidates = (nums[i], cur_max * nums[i], cur_min * nums[i])\n???',
      options: [
        'cur_max = max(candidates); cur_min = min(candidates)',
        'cur_max = max(candidates)',
        'cur_min = min(candidates)',
        'best = max(candidates)'
      ],
      correct: 0,
      explanation: 'Both must be updated together using the SAME candidate set — otherwise they overwrite each other inconsistently.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  GUARDED SKIPPING (6)                                   */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'guard-q1', pattern: 'guard', difficulty: 1, type: 'pattern',
      title: 'Which pattern applies?',
      prompt: 'Check if a string is a palindrome, ignoring non-alphanumeric characters and case.',
      options: [
        'P1 · Converging + Guarded Skipping',
        'P6 · Prefix Sum',
        'P7 · Kadane',
        'P4 · Sliding Window'
      ],
      correct: 0,
      explanation: 'Converge from both ends, but skip invalid characters with inner while loops.'
    },
    {
      id: 'guard-q2', pattern: 'guard', difficulty: 2, type: 'state',
      title: 'Which pointer moves next?',
      prompt: 's = "A man, a plan", left = 1 (space), right = 12 (n).',
      code: 'while left < right and not s[left].isalnum():\n    left += 1',
      options: ['left advances past the space', 'right advances', 'Both advance', 'Return False'],
      correct: 0,
      explanation: 's[1] is a space — not alphanumeric. Inner loop advances left until a valid character.'
    },
    {
      id: 'guard-q3', pattern: 'guard', difficulty: 1, type: 'trace',
      title: 'What does this return?',
      prompt: 's = "A man, a plan, a canal: Panama"',
      code: 'l, r = 0, len(s) - 1\nwhile l < r:\n    while l < r and not s[l].isalnum():\n        l += 1\n    while l < r and not s[r].isalnum():\n        r -= 1\n    if s[l].lower() != s[r].lower():\n        return False\n    l += 1; r -= 1\nreturn True',
      options: ['True', 'False', 'Error', 'None'],
      correct: 0,
      explanation: 'After stripping non-alphanumerics, the string reads the same forwards and backwards.'
    },
    {
      id: 'guard-q4', pattern: 'guard', difficulty: 1, type: 'chips',
      title: 'Complete the guard',
      prompt: 'Fill the blank.',
      code: 'while ____ and not s[left].isalnum():\n    left += 1',
      tokens: ['left < right', 'left <= right', 'left != right', 'True'],
      correct: 0,
      explanation: 'Every inner skip loop must repeat the outer bound test to avoid running past valid indices.'
    },
    {
      id: 'guard-q5', pattern: 'guard', difficulty: 3, type: 'bug',
      title: 'Which input exposes the bug?',
      prompt: 'This palindrome check is wrong. What input fails?',
      code: 'while left < right:\n    while not s[left].isalnum():\n        left += 1\n    while not s[right].isalnum():\n        right -= 1\n    if s[left].lower() != s[right].lower():\n        return False\n    left += 1\n    right -= 1\nreturn True',
      options: ['"abc"', '"A man, a plan, a canal: Panama"', '",,,,"', '"a"'],
      correct: 2,
      explanation: 'The inner guards lack "left < right". On ",,,," both pointers run past valid indices and raise IndexError.'
    },
    {
      id: 'guard-q6', pattern: 'guard', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Valid Palindrome. You just skipped non-alphanumeric chars from both ends.',
      code: 'while left < right and not s[left].isalnum():\n    left += 1\nwhile left < right and not s[right].isalnum():\n    right -= 1\n???',
      options: ['if s[left].lower() != s[right].lower(): return False', 'left += 1; right -= 1', 'return True', 'break'],
      correct: 0,
      explanation: 'After skipping, compare the two characters. Mismatch → immediate False.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  X.1 · THREE POINTERS (5)                               */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'x1-q1', pattern: 'x1', difficulty: 2, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Array contains only 0s, 1s, and 2s. Sort in place, one pass.',
      options: ['Three pointers (Dutch National Flag)', 'P1 · Converging only', 'P2 · Read-Write only', 'P4 · Sliding Window'],
      correct: 0,
      explanation: 'Three regions: 0s, 1s, 2s. low, mid, high pointers partition in place.'
    },
    {
      id: 'x1-q2', pattern: 'x1', difficulty: 2, type: 'state',
      title: 'What happens after the swap?',
      prompt: 'nums = [2, 0, 1], low = 0, mid = 0, high = 2. nums[mid] = 2.',
      code: 'nums[mid], nums[high] = nums[high], nums[mid]\nhigh -= 1',
      options: ['mid stays, high becomes 1', 'mid advances, high stays', 'Both advance', 'Loop ends'],
      correct: 0,
      explanation: 'After swapping with high, the value that came from high is unchecked. Do NOT advance mid. Only high decreases.'
    },
    {
      id: 'x1-q3', pattern: 'x1', difficulty: 2, type: 'trace',
      title: 'What is the output?',
      prompt: 'nums = [2, 0, 2, 1, 1, 0]',
      options: ['[0, 0, 1, 1, 2, 2]', '[0, 1, 2, 0, 1, 2]', '[2, 2, 1, 1, 0, 0]', '[0, 0, 1, 2, 1, 2]'],
      correct: 0,
      explanation: 'Dutch National Flag partitions into three regions in one pass.'
    },
    {
      id: 'x1-q4', pattern: 'x1', difficulty: 3, type: 'invariant',
      title: 'Why not advance mid?',
      prompt: 'After swapping mid with high, why do we NOT advance mid?',
      options: [
        'Because it would be off-by-one',
        'Because the value that just came from high is unchecked — mid must re-examine it',
        'Because mid must always be ≤ high',
        'It is a bug — mid should advance'
      ],
      correct: 1,
      explanation: 'Only if nums[mid] == 0 (swapped from low) is the incoming value guaranteed to be a 1. From high, it could be anything.'
    },
    {
      id: 'x1-q5', pattern: 'x1', difficulty: 2, type: 'order',
      title: 'Order the algorithm',
      prompt: 'Reconstruct Sort Colors.',
      lines: [
        'low, mid, high = 0, 0, len(nums) - 1',
        'while mid <= high:',
        'if nums[mid] == 0:',
        'nums[low], nums[mid] = nums[mid], nums[low]; low += 1; mid += 1',
        'elif nums[mid] == 1:',
        'mid += 1',
        'else:',
        'nums[mid], nums[high] = nums[high], nums[mid]; high -= 1'
      ],
      correctOrder: [0, 1, 2, 3, 4, 5, 6, 7],
      explanation: 'Setup → loop → three branches: 0 swap forward, 1 advance, 2 swap back.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  X.2 · OUTWARD EXPANSION (5)                            */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'x2-q1', pattern: 'x2', difficulty: 2, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Find the longest palindromic substring of a string.',
      options: [
        'Outward expansion (expand around centers)',
        'P1 · Two Pointers Converging',
        'P4 · Sliding Window',
        'P6 · Prefix Sum'
      ],
      correct: 0,
      explanation: 'For each of 2N − 1 centers, expand outward while mirrored characters match.'
    },
    {
      id: 'x2-q2', pattern: 'x2', difficulty: 2, type: 'state',
      title: 'What are the pointers after one expansion?',
      prompt: 's = "babad", i = 2 (character "b" is the center for odd-length).',
      code: 'l, r = i, i\nwhile l >= 0 and r < len(s) and s[l] == s[r]:\n    l -= 1\n    r += 1',
      options: ['l=1, r=3', 'l=2, r=2', 'l=0, r=4', 'l=3, r=1'],
      correct: 0,
      explanation: 'Initial l = r = 2 → check s[2]==s[2] (yes) → l=1, r=3. Then s[1]="a", s[3]="a" (yes) → l=0, r=4...'
    },
    {
      id: 'x2-q3', pattern: 'x2', difficulty: 2, type: 'trace',
      title: 'How many palindromic substrings?',
      prompt: 's = "aaa"',
      options: ['6', '3', '4', '5'],
      correct: 0,
      explanation: 'Single chars: 3. "aa" × 2: 2. "aaa": 1. Total 6.'
    },
    {
      id: 'x2-q4', pattern: 'x2', difficulty: 2, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Longest Palindromic Substring with expand-around-center.',
      options: ['O(N)', 'O(N log N)', 'O(N²)', 'O(N³)', 'O(2^N)', 'O(N!)'],
      correct: 2,
      explanation: '2N − 1 centers, each expansion up to O(N). Worst case O(N²).'
    },
    {
      id: 'x2-q5', pattern: 'x2', difficulty: 2, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Outward expansion. You just found s[l] == s[r] at the current positions.',
      code: 'while l >= 0 and r < len(s) and s[l] == s[r]:\n    ???',
      options: ['l -= 1; r += 1', 'l += 1; r -= 1', 'return s[l:r]', 'break'],
      correct: 0,
      explanation: 'Expand outward: l moves left, r moves right. This is the mirror of Pattern 1.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  X.5 · EXACTLY-K TRICK (5)                              */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'x5-q1', pattern: 'x5', difficulty: 3, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Count subarrays with EXACTLY k distinct integers.',
      options: [
        'atMost(k) − atMost(k − 1)',
        'P4 · Sliding Window directly',
        'P1 · Two Pointers Converging',
        'P7 · Kadane'
      ],
      correct: 0,
      explanation: 'Exactly-k is not window-friendly, but atMost-k is. Subtract.'
    },
    {
      id: 'x5-q2', pattern: 'x5', difficulty: 3, type: 'invariant',
      title: 'Why does the subtraction work?',
      prompt: 'Why is exactly(k) = atMost(k) − atMost(k − 1)?',
      options: [
        'It is an approximation',
        'Any subarray with ≤ k distinct either has ≤ k−1 distinct or exactly k — the sets partition cleanly',
        'Because k and k−1 are adjacent',
        'It only works for arrays with no negatives'
      ],
      correct: 1,
      explanation: 'atMost(k) counts subarrays with ≤ k distinct. Subtracting those with ≤ k−1 leaves only those with exactly k.'
    },
    {
      id: 'x5-q3', pattern: 'x5', difficulty: 3, type: 'state',
      title: 'What is the running total?',
      prompt: 'nums = [1, 2, 1, 2], k = 2. After processing right = 2, left = 0.',
      code: 'total += right - left + 1',
      options: ['3', '2', '4', '6'],
      correct: 0,
      explanation: 'right − left + 1 = 2 − 0 + 1 = 3 subarrays ending at right.'
    },
    {
      id: 'x5-q4', pattern: 'x5', difficulty: 3, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Count subarrays with exactly k distinct integers.',
      options: ['O(N)', 'O(N log N)', 'O(N²)', 'O(N × k)', 'O(k × N)', 'O(N + k)'],
      correct: 0,
      explanation: 'Two atMost passes, each O(N). Total O(N).'
    },
    {
      id: 'x5-q5', pattern: 'x5', difficulty: 3, type: 'nextline',
      title: "What's the next line?",
      prompt: 'Inside atMost(k). Distinct count just exceeded k.',
      code: 'while len(counts) > k:\n    counts[nums[left]] -= 1\n    if counts[nums[left]] == 0:\n        ???\n    left += 1',
      options: ['del counts[nums[left]]', 'counts[nums[left]] = 1', 'pass', 'return total'],
      correct: 0,
      explanation: 'Delete the key so len(counts) reflects the true distinct count.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  X.7 · REVERSALS (5)                                    */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'x7-q1', pattern: 'x7', difficulty: 2, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Rotate an array right by k steps, in place, O(1) extra space.',
      options: ['Three reversals (P1 + P3 combined)', 'P4 · Sliding Window', 'P6 · Prefix Sum', 'P7 · Kadane'],
      correct: 0,
      explanation: 'Reverse whole → reverse first k → reverse the rest. Uses Pattern 1 three times.'
    },
    {
      id: 'x7-q2', pattern: 'x7', difficulty: 2, type: 'state',
      title: 'What is the array after the first reversal?',
      prompt: 'nums = [1,2,3,4,5,6,7], k = 3.',
      code: 'reverse(0, n - 1)',
      options: ['[7,6,5,4,3,2,1]', '[1,2,3,4,5,6,7]', '[5,6,7,1,2,3,4]', '[3,2,1,4,5,6,7]'],
      correct: 0,
      explanation: 'Reverse the entire array: [7,6,5,4,3,2,1].'
    },
    {
      id: 'x7-q3', pattern: 'x7', difficulty: 2, type: 'trace',
      title: 'What is the output?',
      prompt: 'nums = [1,2,3,4,5,6,7], k = 3',
      options: ['[5,6,7,1,2,3,4]', '[7,6,5,4,3,2,1]', '[3,2,1,4,5,6,7]', '[4,5,6,7,1,2,3]'],
      correct: 0,
      explanation: 'After all three reversals, the array is rotated right by 3.'
    },
    {
      id: 'x7-q4', pattern: 'x7', difficulty: 3, type: 'invariant',
      title: 'Why does the three-reversal trick work?',
      prompt: 'Why do three reversals rotate the array?',
      options: [
        'It is a coincidence',
        'Reversing all + reversing each half puts each element in its rotated position',
        'Because reverse is its own inverse',
        'It only works for k = 1'
      ],
      correct: 1,
      explanation: 'Reversing the whole array flips positions. Reversing the two halves flips them back but in rotated order.'
    },
    {
      id: 'x7-q5', pattern: 'x7', difficulty: 2, type: 'order',
      title: 'Order the algorithm',
      prompt: 'Reconstruct Rotate Array.',
      lines: [
        'k %= n',
        'reverse(0, n - 1)',
        'reverse(0, k - 1)',
        'reverse(k, n - 1)'
      ],
      correctOrder: [0, 1, 2, 3],
      explanation: 'Normalize k first. Reverse all, then reverse first k, then reverse the rest.'
    },

    /* ═══════════════════════════════════════════════════════ */
    /*  X.8 · PREFIX + HASH (6)                                */
    /* ═══════════════════════════════════════════════════════ */
    {
      id: 'x8-q1', pattern: 'x8', difficulty: 3, type: 'pattern',
      title: 'Which pattern fits?',
      prompt: 'Count subarrays whose sum equals k. Array may contain negatives.',
      options: [
        'P6 · Prefix Sum + Hash Map',
        'P4 · Sliding Window',
        'P7 · Kadane',
        'P1 · Two Pointers Converging'
      ],
      correct: 0,
      explanation: 'With negatives, sliding window breaks. Prefix sum + hash map handles arbitrary values.'
    },
    {
      id: 'x8-q2', pattern: 'x8', difficulty: 3, type: 'invariant',
      title: 'Why not sliding window?',
      prompt: 'Why does sliding window fail on this problem when negatives are allowed?',
      options: [
        'It is slower',
        'Adding a negative can DECREASE the sum, breaking the monotonic assumption windows rely on',
        'Python does not support it',
        'It works fine — the question is a trick'
      ],
      correct: 1,
      explanation: 'Sliding window needs "adding hurts, removing helps". Negatives break this monotonicity.'
    },
    {
      id: 'x8-q3', pattern: 'x8', difficulty: 3, type: 'state',
      title: 'What is the running sum?',
      prompt: 'nums = [1, 2, 3].',
      code: 'seen = {0: 1}\nrunning = 0\nfor x in nums:\n    running += x\n    count += seen.get(running - k, 0)\n    seen[running] = seen.get(running, 0) + 1',
      options: ['running goes 1 → 3 → 6', 'running goes 0 → 1 → 3', 'running goes 3 → 6 → 10', 'running stays at 0'],
      correct: 0,
      explanation: 'Prefix sums: 1, 1+2=3, 1+2+3=6.'
    },
    {
      id: 'x8-q4', pattern: 'x8', difficulty: 3, type: 'trace',
      title: 'How many subarrays?',
      prompt: 'nums = [1, 2, 3], k = 3',
      options: ['2', '1', '3', '0'],
      correct: 0,
      explanation: '[3] and [1, 2] both sum to 3. Two subarrays.'
    },
    {
      id: 'x8-q5', pattern: 'x8', difficulty: 3, type: 'chips',
      title: 'Complete the hash seed',
      prompt: 'Fill the blank.',
      code: 'seen = {____: 1}\nrunning = 0\ncount = 0',
      tokens: ['0', 'k', '1', '-1', 'None'],
      correct: 0,
      explanation: 'seen[0] = 1 accounts for subarrays starting at index 0.'
    },
    {
      id: 'x8-q6', pattern: 'x8', difficulty: 3, type: 'complexity',
      title: 'Time complexity',
      prompt: 'Subarray Sum Equals K using prefix sum + hash map.',
      options: ['O(N)', 'O(N log N)', 'O(N²)', 'O(N × k)', 'O(k)', 'O(N + k)'],
      correct: 0,
      explanation: 'One pass, O(1) hash operations per element. O(N) time, O(N) space.'
    }
  ];

  /* ═══════════════════════════════════════════════════════════ */
  /*  HELPERS                                                     */
  /* ═══════════════════════════════════════════════════════════ */

  function getById(id) {
    return BANK.find(q => q.id === id);
  }

  function getTypeMeta(type) {
    return TYPE_META[type] || TYPE_META.chips;
  }

  // Total questions per pattern (for stats)
  function countByPattern(pattern) {
    return BANK.filter(q => q.pattern === pattern).length;
  }

  /* ═══ PICK QUESTIONS FOR A LEVEL ═══ */
  // level  = a campaign level object with { pattern, diff, questions }
  // history = optional array of previously seen question ids (spaced rep, Msg 7)
  function pickForLevel(level, history = []) {
    if (!level) return [];

    const seen = new Set(history);
    const count = level.questions || 5;
    const maxDiff = level.diff || 3;

    // Pool 1: fresh questions at or below the level difficulty
    let pool = BANK.filter(q =>
      q.pattern === level.pattern &&
      q.difficulty <= maxDiff &&
      !seen.has(q.id)
    );

    // Pool 2: any question from the pattern (fallback if pool 1 is too small)
    if (pool.length < count) {
      const fallback = BANK.filter(q =>
        q.pattern === level.pattern && !seen.has(q.id)
      );
      pool = [...new Set([...pool, ...fallback])];
    }

    // Pool 3: any question from any pattern (final fallback)
    if (pool.length < count) {
      const lastResort = BANK.filter(q => !seen.has(q.id));
      pool = [...new Set([...pool, ...lastResort])];
    }

    // Shuffle and take `count`
    return shuffle(pool).slice(0, count);
  }

  /* ═══ PICK FOR FREE REVIEW ═══ */
  // Used by spaced repetition (Msg 7) — pulls due questions across patterns.
  function pickByIds(ids) {
    return ids.map(id => BANK.find(q => q.id === id)).filter(Boolean);
  }

  /* ═══ SHUFFLE (Fisher-Yates) ═══ */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ═══ PUBLIC API ═══ */
  return {
    BANK,
    TYPE_META,
    getById,
    getTypeMeta,
    countByPattern,
    pickForLevel,
    pickByIds,
    shuffle
  };
})();
