// Fast drop-in for makefun-diff 1.0.0.
//
// Same answer as makefun-diff on every input, computed with a flat-array
// Myers greedy search instead of jsdiff's linked-list path history:
//  - no object is allocated per search step; the furthest-reached x of
//    every diagonal of every edit distance d is kept in one Int32Array
//    per d, and the edit script is rebuilt by walking those arrays back.
//  - the search itself is the reference's rule, step for step: common
//    prefix then common suffix first; then for d = 1, 2, ... and each
//    diagonal k = -d..d in steps of 2, the furthest point is the
//    deletion's when a deletion and an insertion reach the same point
//    into the old text (the deletion when both reach one point), no
//    move past either text's end, no edge diagonal pruned, and every
//    run of equal lines followed as far as it goes; the first path to
//    reach both ends is the script.
//
// Lines: a text is cut after every "\n" (the only separator), a last
// line with no "\n" is a line too; two lines are equal only when they
// are the same code units, newline or its absence included.

/** A text's lines, each with its "\n" (the last one without, when the text does not end in one). */
function tokenize(text) {
  const parts = text.split('\n');
  const lines = [];
  const last = parts.length - 1;
  for (let i = 0; i < last; i++) lines.push(parts[i] + '\n');
  if (parts[last] !== '') lines.push(parts[last]);
  return lines;
}

/**
 * Each distinct line one small integer, shared by both texts of a case:
 * the line string itself is the key, and it already carries the newline
 * (a kept line ends in "\n", a bare last line does not), so equal ids
 * mean equal lines. The hot snake loop then compares integers.
 */
function lineIds(lines, ids) {
  const out = new Int32Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let id = ids.get(line);
    if (id === undefined) {
      id = ids.size;
      ids.set(line, id);
    }
    out[i] = id;
  }
  return out;
}

/**
 * The forward search over the middle region: for each d, Vs[d] holds the
 * furthest old-lines-consumed x of every diagonal k = -d..d (step 2) at
 * index (k + d) / 2, or -1 where no path reaches that diagonal.
 * Returns the first d that reaches both ends, its k, and all V rows.
 */
function forward(a, b) {
  const n = a.length;
  const m = b.length;
  const Vs = [];
  let x = 0;
  let y = 0;
  while (x < n && y < m && a[x] === b[y]) { x++; y++; }
  const v0 = new Int32Array(1);
  v0[0] = x;
  Vs.push(v0);
  if (x >= n && y >= m) return { d: 0, k: 0, Vs };
  for (let d = 1; ; d++) {
    const V = new Int32Array(d + 1);
    V.fill(-1);
    const Vp = Vs[d - 1];
    for (let k = -d, ki = 0; k <= d; k += 2, ki++) {
      const rm = ki === 0 ? -1 : Vp[ki - 1];
      const ad = ki === d ? -1 : Vp[ki];
      const canRemove = rm >= 0 && rm < n;
      const canAdd = ad >= 0 && ad - 1 - k < m;
      if (!canRemove && !canAdd) continue;
      // The deletion's point when both reach the same point into the old text.
      const byDel = canRemove ? rm : -2;
      const byIns = canAdd ? ad - 1 : -2;
      if (byDel >= byIns) x = rm + 1;
      else x = ad;
      y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      V[ki] = x;
      if (x >= n && y >= m) {
        Vs.push(V);
        return { d, k, Vs };
      }
    }
    Vs.push(V);
  }
}

/**
 * The edit script, rebuilt from the stored V rows: at each d the move
 * is recomputed from row d - 1 by the same rule the forward search
 * used, so the path is the forward search's own. Kinds: 0 keep,
 * 1 delete, 2 insert. Runs are merged, in order.
 */
function backtrack(a, b, D, kFinal, Vs) {
  const n = a.length;
  const m = b.length;
  let x = n;
  let y = m;
  let k = kFinal;
  const ops = [];
  for (let d = D; d >= 1; d--) {
    const Vp = Vs[d - 1];
    const ki = (k + d) >> 1;
    const rm = ki === 0 ? -1 : Vp[ki - 1];
    const ad = ki === d ? -1 : Vp[ki];
    const canRemove = rm >= 0 && rm < n;
    const canAdd = ad >= 0 && ad - 1 - k < m;
    const byDel = canRemove ? rm : -2;
    const byIns = canAdd ? ad - 1 : -2;
    if (byDel >= byIns) {
      // A deletion: from (rm, rm - (k - 1)) one old line past, then the snake.
      const xPre = rm + 1;
      const yPre = xPre - k;
      if (x - xPre > 0) ops.push([0, x - xPre]);
      ops.push([1, 1]);
      x = rm;
      y = yPre;
      k = k - 1;
    } else {
      // An insertion: from (ad, ad - (k + 1)) one new line past, then the snake.
      const xPre = ad;
      const yPre = ad - k;
      if (x - xPre > 0) ops.push([0, x - xPre]);
      ops.push([2, 1]);
      x = ad;
      y = yPre - 1;
      k = k + 1;
    }
  }
  if (x > 0) ops.push([0, x]);
  ops.reverse();
  const runs = [];
  for (const op of ops) {
    if (op[1] === 0) continue;
    const last = runs[runs.length - 1];
    if (last !== undefined && last[0] === op[0]) last[1] += op[1];
    else runs.push([op[0], op[1]]);
  }
  return runs;
}

/** A line as the patch writes it: its op, the line, a newline, and "%" on a line of its own when it had none. */
function written(op, line) {
  return line.endsWith('\n') ? op + line : op + line + '\n%\n';
}

/** make.fun's own patch of input.old into input.new, as makefun-diff 1.0.0 writes it. */
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const a = tokenize(input.old);
  const b = tokenize(input.new);
  const n = a.length;
  const m = b.length;
  // Integer ids for the search: equal lines share one id, in both texts.
  const ids = new Map();
  const aIds = lineIds(a, ids);
  const bIds = lineIds(b, ids);
  // The common prefix, then the common suffix of what is left.
  let prefix = 0;
  while (prefix < n && prefix < m && aIds[prefix] === bIds[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && aIds[n - 1 - suffix] === bIds[m - 1 - suffix]) suffix++;
  const midA = aIds.subarray(prefix, n - suffix);
  const midB = bIds.subarray(prefix, m - suffix);
  const found = forward(midA, midB);
  const midRuns = backtrack(midA, midB, found.d, found.k, found.Vs);

  const runs = [];
  if (prefix > 0) runs.push([0, prefix]);
  for (const r of midRuns) runs.push(r);
  if (suffix > 0) runs.push([0, suffix]);
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last[0] === r[0]) last[1] += r[1];
    else merged.push([r[0], r[1]]);
  }

  // The change runs: each a stretch of deletions and insertions between two kept lines.
  const changes = [];
  let o = 0;
  let p = 0;
  let deleted = 0;
  let inserted = 0;
  for (const r of merged) {
    if (r[0] === 0) {
      o += r[1];
      p += r[1];
      continue;
    }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (r[0] === 1) {
      c.dels += r[1];
      o += r[1];
      deleted += r[1];
    } else {
      c.ins += r[1];
      p += r[1];
      inserted += r[1];
    }
  }

  // The hunks: change runs at most 6 kept lines apart share one.
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 6) h.push(c);
    else hunks.push([c]);
  }
  const out = [`makefun-diff/1 old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - 3);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(3, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(written('=', a[at]));
      for (let i = 0; i < c.dels; i++) out.push(written('-', a[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(written('+', b[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(written('=', a[at]));
  }
  return out.join('');
}
