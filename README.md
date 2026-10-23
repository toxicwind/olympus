# olympus — the home of the Greek-coded products

> olympus is the registry that HOLDS the estate's Greek-coded product lineage —
> the pantheon of named components: τ tau, κ kappa, skopos, kilo, muse, keryx,
> hodos, and their kin. Like `estate-brain` holds the persona fleet, olympus
> holds the Greek codename family as one authoritative, categorized whole.

"Where the gods reside."

## The pantheon (the Greek-coded products)

| Codename    | Greek root | Meaning                   | Product                                                               | Status | Where it lives (Greek pen, Olympus products) |
| ----------- | ---------- | ------------------------- | --------------------------------------------------------------------- | ------ | -------------------------------------------- |
| **τ τau**   | τ (tau)    | Greek letter              | the coding agent                                                      | live   | `pens/olympus/products/tau`                  |
| **κ kappa** | κ (kappa)  | Greek letter              | code agent (`kappa-code`) — served by `estate/kappa-acp` :25159       | live   | `pens/olympus/products/kappa`                |
| **skopos**  | σκοπός     | watcher / lookout / scout | persistent browser (headed Chromium + CDP + supervisor; was `keeper`) | live   | `pens/olympus/products/skopos`               |
| **kilo**    | χίλιοι     | "thousand"                | kilo-code / kilo-cli toolchain                                        | live   | `pens/olympus/products/kilo`                 |
| **muse**    | μοῦσα      | the muse (inspiration)    | muse-cli (model/Muse harness)                                         | live   | `pens/olympus/products/muse`                 |
| **keryx**   | κῆρυξ      | herald                    | fleet chat                                                            | live   | `pens/olympus/products/keryx`                |
| **hodos**   | ὁδός       | way / road                | cloud provider router                                                 | live   | `pens/olympus/products/hodos`                |
| **kairos**  | καιρός     | the opportune moment      | 4-second deadline runtime & breach racer (`run-fast`)                 | live   | `pens/olympus/products/kairos`               |
| **kryptos** | κρυπτός    | hidden                    | secretsmith keyring & stealth credentials                             | live   | `pens/olympus/products/kryptos`               |
| **agele**   | ἀγέλη      | herd (of cattle)          | local LLM inference front door (`llama-swap` :25100; was `herd`)      | live   | `pens/olympus/products/agele`                |
| **pinax**   | πίναξ      | tablet / catalog          | provider catalog SSOT (`@toxicwind/pinax`)                            | live   | `pens/olympus/products/pinax`                |
| **agon**    | ἀγών       | contest / race            | code-racer benchmark & racing engine (was `furlong`)                  | live   | `pens/olympus/products/agon`                 |
| **antilogos** | ἀντίλογος | counter-argument / debate | multi-agent debate oracle (was `duel`)                                | live   | `pens/olympus/products/antilogos`            |
| **pylae**   | πύλαι      | gates                     | unified Tailscale/cloudflared/ngrok tunnel scaffolding                | live   | `pens/olympus/products/pylae`                |
| **propylon** | πρόπυλον  | monumental gateway        | front-door gateway & mesh landing                                     | live   | `pens/olympus/products/propylon`             |
| **opsis**   | ὄψις       | sight / appearance        | visual surface & viewer                                               | live   | `pens/olympus/products/opsis`                |
| **didymos** | δίδυμος    | twin                      | twin-state synchronization & mirror                                   | live   | `pens/olympus/products/didymos`              |
| **chronos-forge** | χρόνος | time                     | temporal build & trace forge                                          | live   | `pens/olympus/products/chronos-forge`        |

> **Which is the "Greek pen"?** `pens/olympus/` is the Greek pen — it now HOLDS
> the physical Greek-coded products under `olympus/products/` (tau, kappa, skopos,
> kilo, muse, keryx, hodos, kairos, kryptos). `ranch/<greek>` is a symlink to the
> olympus product so the deploy plane still resolves. This table is the registry;
> olympus/the Greek pen is where the code lives.

## Convention

- A **Greek-coded product** is one whose codename is a Greek letter (τ κ), a Greek
  root word (skopos, hodos, kairos, kryptos, keryx), or a Greek-derived word
  (kilo, muse).
- All Greek-coded products belong in olympus and are listed above (the pantheon).
- The **ranch** (workspace pen) and **barn** (shell structure) are NOT Greek-coded —
  they are the ranch-structure theme and do not belong in the pantheon.
- To add a new Greek-coded product: add its row above, verify the codename is
  free on `toxicwind` and un-collided, then record it. Keep olympus ASCII + LF.

## Why olympus

The Greek lineage is a first-class, self-similar family — like the gods under one
roof. olympus makes that family explicit and categorized (per the ranch-brain
analysis), instead of scattering Greek codenames among the ranch's random
workspaces. It is the "acropolis" that holds the Greeks, named for where the
Greek pantheon actually lives.

## Machine gate

```bash
bun x tggo --noEmit   # (or bun check) — the registry is ASCII/LF + tabular
```

## Cross-links

- Naming taxonomy: `estate-recon/.../kite-fleet-recon/NAMING-THEMES.md`
- Not-themed audit: `estate-recon/.../kite-fleet-recon/NOT-THEMED-AUDIT.md`
- skopos (the browser watcher): `toxicwind/skopos`
