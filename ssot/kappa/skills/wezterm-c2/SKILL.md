---
name: wezterm-c2
description: Command-and-control over tau/kappa agent panes in WezTerm via the Thresher MCP — read pane state, drive /switch model pickers stepwise, dump sessions, and verify progress on-screen. Use when steering remote agent sessions, repointing stuck models, or auditing what an agent pane is doing.
---

# wezterm-c2 — drive agent panes through Thresher

Scripts (run with `bun`):

- `scripts/pane-dump.ts <pane_id> [downs=3]` — opens `/debug`, navigates to
  "Report: dump session", prints the session path. The tau session store is
  `~/.tau/agent/sessions/-tmp/<timestamp>_<uuid>/` — conversation lives in
  `agent.db` (`model_perf`, `model_usage`, `threads`) + per-call `.log` files,
  NOT the `.md` (empty) or the tiny `.jsonl` (metadata only).

## Hard-won protocol (verified 2026-10-26)

1. **`/switch`, not `/model`** — the picker is a two-pane TUI: type to search,
   `↑/↓` models, `Enter` use-for-session, `Esc` close, `@` quick roles.
2. **Verify BEFORE Enter** — read the pane after typing the filter; Enter on a
   wrong highlight selects garbage (262K-ctx laguna on a 471K session = 295%
   overflow).
3. **pty writes don't Backspace** — supported keys: ctrl+c/d/z/l/u/a/e/w,
   escape, tab, enter, up/down/left/right. Use `ctrl+u` to clear a polluted
   search field (repeated `send_text` ACCUMULATES into the filter).
4. **Retry states eat commands** — a pane mid-"Retrying (3/3)" buffers your
   text into the input; send `escape` first.
5. **Send the task after the switch** — a model switch leaves the session
   idle; follow with the kickoff prompt.
6. **Concurrency starvation** — freeinference enforces concurrency=2 GLOBALLY;
   two kappa sessions + a glm role saturate it and a third glm pane stalls
   silently (idle, no spinner). Repoint to non-freeinference lanes.

## Lane speed dataframe (tau agent.db model_perf, 2026-10-26)

| lane                                    | tok/s | ttft   | note                                           |
| --------------------------------------- | ----- | ------ | ---------------------------------------------- |
| openrouter/liquid/lfm-2.5-2.6b:free     | 162   | 163ms  | 66K ctx — small sessions only                  |
| nvidia/nemotron-3-super-120b-a12b (NIM) | 90    | 271ms  | 1M ctx, no :free 429s                          |
| freeinference/qwen3.6-35b               | 73    | 228ms  | no effort support                              |
| freeinference/deepseek-v4-flash         | 80    | 594ms  | honors reasoning_effort (probed 19→88→130 tok) |
| openrouter/nemotron-3.5-lightning:free  | 60    | 452ms  | 1M ctx                                         |
| freeinference/glm-5.3-flash             | 29    | 1607ms | always-thinks, effort barely scales            |
