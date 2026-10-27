---
name: thresher-smoke
description: End-to-end smoke suite for the keeper/DP3 browser chain through the Thresher MCP (status, tabs, fill/click/evaluate round-trip, screenshot, close) with a hardened payload parser. Use to verify the browser automation chain is alive, or to parse Thresher/mcpproxy tool output envelopes in any script.
---

# thresher-smoke — keeper/DP3 chain verification

Scripts (bun):

- `scripts/thresher-smoke.ts` — 10-step suite against the LIVE keeper via the
  Thresher connector (read-only tools through `tool-read`, mutating through
  `tool-write`). Exit 0 = chain fully alive.
- `scripts/thresher-json.ts` + `.test.ts` — the payload parser: mcpproxy
  `-o json` envelope → content[0].text → balanced-scan first parseable JSON.
  Handles Go `map[...]` render, «untrusted» spotlight markers (inside payload
  strings too), banner pollution, array-vs-object payloads. 15 tests, 100%
  line coverage.

## Parser contract notes

- **stdout only** — mcpproxy's stderr banner breaks envelope detection; never
  concatenate streams before parsing.
- The Go render wraps payloads as `[map[text:«untrusted:server/tool»\n{JSON} type:text]]`
  — balanced-brace slices of the WRAPPER parse as nothing; scan every `{`/`[`
  position and return the first slice that PARSES (never assume array vs
  object).
- Canonical source: `pens/olympus/products/skopos/src/thresher-json.ts` (the
  smoke lives in both skopos and keeper repos — keep in sync).
