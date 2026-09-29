# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 107 files · ~61,687 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 713 nodes · 1678 edges · 27 communities (25 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9ce34c1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- build-similarity-table.ts
- GameScreen.tsx
- types.ts
- dev-debug.ts
- src/similarity.ts
- similarityTable.test.ts
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- LEARNINGS.md
- package.json
- CLAUDE.md project instructions
- scripts
- compilerOptions
- compilerOptions
- graph-update.ts
- SIMILARITY deep-dive
- index.ts
- main.tsx
- HMAC-signed round state
- gameScreen.test.tsx
- CI workflow
- Missing worker/.dev.vars bit twice (2026-09-13)
- eslint.config.js
- dependencies
- vite-env.d.ts
- session-start.sh

## God Nodes (most connected - your core abstractions)
1. `vitest` - 30 edges
2. `CLAUDE.md project instructions` - 29 edges
3. `normalize()` - 23 edges
4. `SIMILARITY deep-dive` - 23 edges
5. `scripts` - 19 edges
6. `Song` - 19 edges
7. `RoundView` - 19 edges
8. `react` - 17 edges
9. `GameScreen()` - 17 edges
10. `tokenize()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Numbers compared by value (numberHint)` --references--> `numberHint()`  [EXTRACTED]
  docs/SIMILARITY.md → worker/src/similarity.ts
- `graphify extraction defects fixed by hand (2026-09-29)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Optimization pass: repeated work, three caches (2026-09-15)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Hidden words addressed by position` --references--> `wordPositions()`  [EXTRACTED]
  docs/SIMILARITY.md → src/game/slots.ts
- `Hidden words addressed by position` --references--> `placeNearGuesses()`  [EXTRACTED]
  docs/SIMILARITY.md → src/game/slots.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gitignored .dev.vars failures leading to config standing rules** — docs_learnings_state_secret_var_secret_conflict, docs_learnings_missing_dev_vars, scripts_ensure_dev_vars, claude_config_standing_rules [EXTRACTED 1.00]
- **Offline similarity pipeline** — readme_frwac2vec, scripts_lib_embeddings, scripts_lib_similaritytable, claude_workers_kv_similarity, worker_src_similarity, src_game_slots [EXTRACTED 1.00]
- **Anti-cheat information boundary** — claude_anti_cheat, claude_hmac_signed_round_state, docs_similarity_only_numbers_cross_wire, docs_similarity_position_addressing, docs_similarity_placement_is_display [INFERRED 0.85]
- **LRCLIB data hygiene pipeline** — docs_learnings_lrclib_search_not_get, docs_learnings_dirty_lrclib_metadata, docs_learnings_lrc_markup_leak, worker_src_lyrics_cleanlyrics, worker_src_lrclib [INFERRED 0.85]
- **Per-isolate and render memoization from the optimization pass** — docs_learnings_optimization_pass, docs_learnings_isolate_memo_reset, docs_learnings_keystroke_rerender, src_game_analyze, claude_performance_rules [INFERRED 0.85]

## Communities (27 total, 2 thin omitted)

### Community 0 - "build-similarity-table.ts"
Cohesion: 0.06
Nodes (61): LRCLIB lyrics source, LRCLIB metadata isn't clean, LRCLIB /api/search instead of /api/get, resolveSong.ts split out for Node tooling, vitest, build(), BuildOptions, catalogEntry() (+53 more)

### Community 1 - "GameScreen.tsx"
Cohesion: 0.05
Nodes (55): Team mode placeholder (#29, #30), react, AppHeader, AppHeaderProps, Dialog, feedbackMessage(), GameScreen(), GroupIcon() (+47 more)

### Community 2 - "types.ts"
Cohesion: 0.06
Nodes (38): French text matching (accents, elisions), tokenize() letter class missed œ (cœur split), @playwright/test, analyze(), AnalyzedLine, AnalyzedSection, analyzeLine(), cache (+30 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.06
Nodes (51): ref_node_fs, ref_node_module, ref_node_net, ref_node_os, ref_node_path, ref_node_url, buildTodaysTable(), claimPort() (+43 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.10
Nodes (43): main(), classifyTargets(), heatStyle(), TriedWords, isFunctionWord(), clampScore(), HOT_SCORE, MAX_MISSED_SCORE (+35 more)

### Community 5 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (38): .vecbin compact embedding format, ref_node_readline, ref_node_util, main(), COMPACT_MAGIC, dotProduct(), EmbeddingModel, float32View() (+30 more)

### Community 6 - "useGame.ts"
Cohesion: 0.13
Nodes (31): ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots(), RoundView (+23 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.12
Nodes (18): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, vite, @vitejs/plugin-react, fixtureScore() (+10 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.16
Nodes (17): Continuous improvement loop, Performance rules (memoize per isolate, no re-render on keystroke), One-time Cloudflare account setup for CI deploy, CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo (+9 more)

### Community 10 - "package.json"
Cohesion: 0.10
Nodes (19): author, description, keywords, license, name, private, type, version (+11 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.12
Nodes (19): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, CLAUDE.md project instructions, Conventional Commits + Gitmoji, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, Lyrix game (+11 more)

### Community 12 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+11 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "graph-update.ts"
Cohesion: 0.15
Nodes (13): graphify extraction defects fixed by hand (2026-09-29), ref_node_child_process, { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink() (+5 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.15
Nodes (16): SIMILARITY deep-dive, Calibrate against the real model, Function words never count, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), Model licensing (CC BY 3.0, never committed), NEAR_SCORE (40), Normalization must stay in step (+8 more)

### Community 17 - "index.ts"
Cohesion: 0.13
Nodes (27): AnalyzedToken, analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys() (+19 more)

### Community 18 - "main.tsx"
Cohesion: 0.20
Nodes (9): Google Fonts @import moved to <link> + preconnect, index.html entry page, Google Fonts preconnect link, react-dom, App(), rootElement, game.css (layout, breakpoints), global.css (keyframes) (+1 more)

### Community 19 - "HMAC-signed round state"
Cohesion: 0.22
Nodes (9): Anti-cheat: Worker-only lyrics, HMAC-signed round state, Testing philosophy (script every check), A placeholder makes a feature look finished, Fetch failures silently swallowed in the UI (2026-09-11), Similarity too strict: rank-based scoring (2026-09-15), songId in /api/round leaks the title, Only numbers cross the wire (+1 more)

### Community 20 - "gameScreen.test.tsx"
Cohesion: 0.28
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Missing worker/.dev.vars bit twice (2026-09-13)"
Cohesion: 0.29
Nodes (7): Config rules: gitignored file never manual; missing config names itself, STATE_SECRET, Workers KV similarity tables, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, Missing worker/.dev.vars bit twice (2026-09-13), STATE_SECRET var/secret binding conflict (2026-09-11), Similarity optional at runtime

### Community 23 - "eslint.config.js"
Cohesion: 0.33
Nodes (5): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, typescript-eslint

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

## Knowledge Gaps
- **195 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+190 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 243 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `build-similarity-table.ts` to `GameScreen.tsx`, `types.ts`, `dev-debug.ts`, `src/similarity.ts`, `similarityTable.test.ts`, `useGame.ts`, `e2e-servers.test.ts`, `LEARNINGS.md`, `package.json`, `graph-update.ts`, `index.ts`, `gameScreen.test.tsx`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `react` connect `GameScreen.tsx` to `package.json`, `main.tsx`, `src/similarity.ts`, `useGame.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `CLAUDE.md project instructions` to `build-similarity-table.ts`, `GameScreen.tsx`, `types.ts`, `LEARNINGS.md`, `SIMILARITY deep-dive`, `main.tsx`, `HMAC-signed round state`, `CI workflow`, `Missing worker/.dev.vars bit twice (2026-09-13)`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _195 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build-similarity-table.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0595679012345679 - nodes in this community are weakly interconnected._
- **Should `GameScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.054203180785459264 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05658381808566896 - nodes in this community are weakly interconnected._