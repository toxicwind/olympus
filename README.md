# The home of the Greek-coded products — registry of the panthcoon: tau, kappa, skopos, kilo, muse, keryx, rhodochrosite, kairos, kryptos.

One of the estate's five pens (`pens/{estate,geode,barn,ranch,olympus}`).
Every pen has the same shape: `products/` for peer standalone checkouts,
`docs/` for pen-owned documentation, and a `bin/` entrypoint surface that
is symlinked into `~/.local/bin` and pinned by the estate-ops manifest.

## Products

| Product | Port | Language | Role |
| --- | --- | --- | --- |
| agele | 25001,25100,25104 | Go | Run a whole agele of LLM backends behind one OpenAI-compatible API. |
| agon | — | Python | The empirical code contest. Race candidate code strategies against each |
| antilogos | — | JavaScript | Counter-argument to the first answer. An adversarial verification engine: |
| chronos-forge | — | TypeScript | A repo-scoped Mixture-of-Experts agent backplane with an endless, |
| didymos | 25202 | — | First-class Gemini API MCP server for the mesh: a self-healing multi-key pool with round-robin + ... |
| rhodochrosite | 25193 | Rust | — |
| kairos | — | TypeScript | The opportune moment — the 2-second rule, first-class: every command an agent |
| kappa | — | TypeScript | Master project holding the kappa forks on this box (awrawr-pc estate). This |
| keryx | — | — | — |
| kilo | 25000 | TypeScript | npm install -g @kilocode/cli |
| kleio | — | TypeScript | The session historian — one audit, every agent engine. |
| kryptos | 25109 | TypeScript | — |
| muse | — | Python | Talk to your personal muse.ai AI agent from the terminal. |
| opsis | 25130 | — | Headed browser automation for the fleet: one MCP server, one persistent Chromium, zero dead sessi... |
| mimetite | — | TypeScript | Every flock comes home to mimetite — where the birds settle, perch, and |
| pylae | — | Rust | — |
| sigma | — | TypeScript | English | 中文 |
| skopos | 25130,25154 | TypeScript | One persistent headed Chromium for the whole mesh, plus the browserless server |
| tau | 25100,25101,25102,25103,25104,25105,25106,25107,25108,25109,25110,25111,25112,25113,25114,25115,25116,25117,25118,25120,25121,25122,25123,25124,25125,25126,25127,25128,25129,25130,25131,25132,25133,25134,25135,25136,25137,25138,25139,25140,25141,25142,25143,25144,25145,25146,25147,25148,25149,25150,25152,25153,25160,25161,25163,25180,25181,25189,25190,25191,25192,25193,25194,25195,25196,25197,25198,25199,25201,25202,25203,25204,25205,25206,25207,25208,25209,25210,25211,25212,25219 | Rust | A coding agent that runs on your machine, in your processes, on your filesystem. |
| theta | — | TypeScript | CONFIDENTIAL / PRIVATE. This package is the estate's EAP (Gemini Tool |

## Layout
```text
olympus/
  .gitignore    kitchen-sink `*` + whitelist (submoduleless doctrine)
  README.md     this file — role, member table, ports, languages
  LICENSE
  package.json
  mise.toml
  AGENTS.md
  bin/          entrypoint symlink surface -> ~/.local/bin
  products/     peer standalone checkouts (auto-ignored, never tracked)
  docs/         pen-owned documentation
```

## Tooling

- **bin surface**: entrypoints symlinked into `~/.local/bin`, pinned by the
-  estate-ops manifest and verified by `bin-verify.sh`. A broken link is
-  a FAIL, never a WARN.
-  **README**: generated from the pen's own product set by
-  `bin/readme-gen.ts`.

## Conventions

- Submoduleless: peer repos are shallow clones, never git submodules
- Ports SSOT: `config/ports.env` is the single source of truth for :25xxx ports
- Bun runtime: all TS/JS products run on Bun; Go and Rust are compiled binaries

## License

Estate internal — all rights reserved.
