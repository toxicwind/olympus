# hindsight

Kappa-side hindsight command. First-class Kappa recall / retrospective over past
estate + Kappa work — modeled on the kilo hindsight-plugin (same estate sources),
made Kappa-native and durable beyond a single session.

Bin: `~/.local/bin/kappa-hindsight` → `~/.config/kappa/skills/kappa-hindsight/bin/kappa-hindsight`

## Usage

| Command                    | What it shows                                        |
| -------------------------- | ---------------------------------------------------- |
| `kappa-hindsight`          | recent session goals (default)                       |
| `kappa-hindsight changed`  | recent sessions + diff stats (what changed)          |
| `kappa-hindsight blockers` | in-progress/pending todos + oracle slashed           |
| `kappa-hindsight all`      | everything (goals + changed + blockers + directives) |
| `kappa-hindsight --help`   | usage                                                |

## Sources

| Source               | Path                                             | Gives                                   |
| -------------------- | ------------------------------------------------ | --------------------------------------- |
| Kappa session store  | `~/.local/share/kappa/kappa-main.db`             | recent goals, todos (open/blocked work) |
| Squawk oracle ledger | `estate/ranch/squawk/oracle/ledger/ledger.jsonl` | settled/slashed, activity tally         |
| Fleet directives     | `ranch/hatch/kite/agents/ember/directives.md`    | standing directives / INBOX             |

## Notes

- Zero runtime deps; Node >= 22.5 (`node:sqlite`). Degrades gracefully when a
  source is absent.
- This is the Kappa-native replacement for the unavailable `delendai memory` MCP
  slot (catalog_missing): Kappa labels durable context in hindsight.md and recalls
  it here, not through a memory plugin.
