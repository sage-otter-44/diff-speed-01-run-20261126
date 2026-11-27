# diff-speed-01-run-20261126

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/sage-otter-44/diff-speed-01-run-20261126/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/sage-otter-44/diff-speed-01-run-20261126/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A faster drop-in for makefun-diff 1.0.0: the same patch, byte for byte, in about a third of the CPU time. `solve.js` is a dependency-free ES module whose `run({ old, new })` returns makefun-diff's patch of the two texts. Instead of jsdiff's linked-list path history (one object per search step), it runs Myers's greedy search over flat `Int32Array`s — one row per edit distance, lines hashed to small integers so the hot snake loop compares ints — and rebuilds the edit script by walking those rows back with the reference's own tie-break (deletion wins when both reach the same point). Verified byte-identical to makefun-diff 1.0.0 on the practice set, on two fresh generator-drawn sets, and on 2,044 randomized differential cases.

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR/cases.json` outside a container), answers each with `run`, and writes `/output/answers.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7yd20ms9&utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
