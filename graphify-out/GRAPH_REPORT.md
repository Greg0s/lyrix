# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 110 files · ~63,103 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 734 nodes · 1713 edges · 28 communities (26 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca0879fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- resolveSong.ts
- GameScreen.tsx
- tokenize.ts
- dev-debug.ts
- src/similarity.ts
- similarityTable.test.ts
- types.ts
- e2e-servers.test.ts
- devDependencies
- LEARNINGS.md
- package.json
- CLAUDE.md project instructions
- favicon.test.ts
- compilerOptions
- compilerOptions
- graph-update.ts
- SIMILARITY deep-dive
- vitest
- catalogAudit.ts
- HMAC-signed round state
- songs.ts
- CI workflow
- lyrics.ts
- catalog.ts
- tokenize() letter class missed œ (cœur split)
- vite-env.d.ts
- session-start.sh
- Graphify skill

## God Nodes (most connected - your core abstractions)
1. `vitest` - 31 edges
2. `CLAUDE.md project instructions` - 29 edges
3. `normalize()` - 23 edges
4. `SIMILARITY deep-dive` - 23 edges
5. `scripts` - 20 edges
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

## Communities (28 total, 2 thin omitted)

### Community 0 - "resolveSong.ts"
Cohesion: 0.15
Nodes (15): LRCLIB lyrics source, LRCLIB requires a client identifier header, LRCLIB /api/search instead of /api/get, Section, entry, entry, CatalogEntry, bestMatch() (+7 more)

### Community 1 - "GameScreen.tsx"
Cohesion: 0.07
Nodes (46): Team mode placeholder (#29, #30), react, App(), AppHeader, AppHeaderProps, Dialog, feedbackMessage(), GameScreen() (+38 more)

### Community 2 - "tokenize.ts"
Cohesion: 0.18
Nodes (8): IS_WORD, SPLIT_ON_WORDS, tokenize(), Token, devHintFor(), escapeRegExp(), firstTitleWord(), wordsInOrder()

### Community 3 - "dev-debug.ts"
Cohesion: 0.06
Nodes (50): ref_node_fs, ref_node_module, ref_node_net, ref_node_os, ref_node_path, ref_node_url, wrangler, buildTodaysTable() (+42 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.07
Nodes (57): main(), classifyTargets(), heatStyle(), TriedWords, isFunctionWord(), clampScore(), HOT_SCORE, MAX_MISSED_SCORE (+49 more)

### Community 5 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (45): .vecbin compact embedding format, ref_node_readline, ref_node_util, build(), BuildOptions, catalogEntry(), main(), readVocabulary() (+37 more)

### Community 6 - "types.ts"
Cohesion: 0.07
Nodes (46): @testing-library/react, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, revealedPercent() (+38 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.12
Nodes (19): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, @playwright/test, vite, @vitejs/plugin-react (+11 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.14
Nodes (19): Continuous improvement loop, Performance rules (memoize per isolate, no re-render on keystroke), One-time Cloudflare account setup for CI deploy, CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo (+11 more)

### Community 10 - "package.json"
Cohesion: 0.04
Nodes (47): author, dependencies, hono, react, react-dom, description, keywords, license (+39 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.11
Nodes (21): CLAUDE.md project instructions, Conventional Commits + Gitmoji, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, Lyrix game, Lyrix v3 mockup UI, Out of scope: 3D, team mode, accounts, D1 (+13 more)

### Community 12 - "favicon.test.ts"
Cohesion: 0.15
Nodes (14): colors, root, tokens, cssColorToHex(), cssVar(), faviconColors, faviconSvg(), Piece (+6 more)

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
Cohesion: 0.14
Nodes (18): Workers KV similarity tables, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, SIMILARITY deep-dive, Calibrate against the real model, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), Model licensing (CC BY 3.0, never committed), NEAR_SCORE (40) (+10 more)

### Community 17 - "vitest"
Cohesion: 0.07
Nodes (44): Function words never count, vitest, analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), analyzeSong() (+36 more)

### Community 18 - "catalogAudit.ts"
Cohesion: 0.25
Nodes (15): audit(), main(), sleep(), auditSong(), CatalogAudit, duplicateCatalogIds(), failureAdvice(), formatAudit() (+7 more)

### Community 19 - "HMAC-signed round state"
Cohesion: 0.22
Nodes (9): Anti-cheat: Worker-only lyrics, Config rules: gitignored file never manual; missing config names itself, HMAC-signed round state, STATE_SECRET, Missing worker/.dev.vars bit twice (2026-09-13), songId in /api/round leaks the title, STATE_SECRET var/secret binding conflict (2026-09-11), Only numbers cross the wire (+1 more)

### Community 20 - "songs.ts"
Cohesion: 0.28
Nodes (11): resolveSong.ts split out for Node tooling, playedSong(), cacheKey(), getCachedSong(), isSong(), putCachedSong(), EMERGENCY_FALLBACK_SONG, getSongById() (+3 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "lyrics.ts"
Cohesion: 0.27
Nodes (9): LrclibTrack, cleanLyrics(), isKeptControlChar(), isLyricLine(), LEADING_TIMESTAMPS, plainLyricsFrom(), sanitize(), TIMESTAMP (+1 more)

### Community 23 - "catalog.ts"
Cohesion: 0.39
Nodes (5): LRCLIB metadata isn't clean, catalog, catalogRotation(), daysSinceEpoch(), pickDailyEntry()

### Community 24 - "tokenize() letter class missed œ (cœur split)"
Cohesion: 0.29
Nodes (7): French text matching (accents, elisions), Testing philosophy (script every check), tokenize() letter class missed œ (cœur split), A placeholder makes a feature look finished, Fetch failures silently swallowed in the UI (2026-09-11), Similarity too strict: rank-based scoring (2026-09-15), LETTER_CLASS

### Community 27 - "Graphify skill"
Cohesion: 0.67
Nodes (3): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, Windows PowerShell gotchas installing graphify (2026-09-12)

## Knowledge Gaps
- **204 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+199 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 255 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `resolveSong.ts`, `GameScreen.tsx`, `tokenize.ts`, `dev-debug.ts`, `src/similarity.ts`, `similarityTable.test.ts`, `types.ts`, `e2e-servers.test.ts`, `LEARNINGS.md`, `package.json`, `favicon.test.ts`, `graph-update.ts`, `catalogAudit.ts`, `lyrics.ts`, `catalog.ts`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `react` connect `GameScreen.tsx` to `package.json`, `CLAUDE.md project instructions`, `src/similarity.ts`, `types.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `CLAUDE.md project instructions` to `resolveSong.ts`, `GameScreen.tsx`, `LEARNINGS.md`, `SIMILARITY deep-dive`, `HMAC-signed round state`, `CI workflow`, `tokenize() letter class missed œ (cœur split)`, `Graphify skill`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _204 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `GameScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06778846153846153 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06400409626216078 - nodes in this community are weakly interconnected._
- **Should `src/similarity.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06887366818873668 - nodes in this community are weakly interconnected._