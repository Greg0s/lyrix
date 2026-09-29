# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 129 files · ~78,795 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 955 nodes · 2264 edges · 44 communities (42 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `025fa19b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- catalog.ts
- GameScreen.tsx
- package.json
- dev-debug.ts
- src/similarity.ts
- similarityTable.test.ts
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- LEARNINGS.md
- scripts
- CLAUDE.md project instructions
- favicon.test.ts
- compilerOptions
- compilerOptions
- graph-update.ts
- SIMILARITY deep-dive
- index.ts
- gameScreen.test.tsx
- HMAC-signed round state
- state.ts
- CI workflow
- Room
- useRoom.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- game/room.ts
- vitest
- worker/room.test.ts
- roomRoutes.ts
- debugMode.ts
- tokenize.ts
- MultiplayerModal.tsx
- types.ts
- RoomMembers.tsx
- analyze.ts
- guess.test.ts
- normalize
- ensure-dev-vars.ts
- slots.test.ts
- tokenize() letter class missed œ (cœur split)
- Graphify skill

## God Nodes (most connected - your core abstractions)
1. `vitest` - 36 edges
2. `CLAUDE.md project instructions` - 29 edges
3. `Room` - 25 edges
4. `react` - 23 edges
5. `normalize()` - 23 edges
6. `SIMILARITY deep-dive` - 23 edges
7. `scripts` - 20 edges
8. `RoundView` - 20 edges
9. `GameScreen()` - 19 edges
10. `Song` - 19 edges

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

## Communities (44 total, 2 thin omitted)

### Community 0 - "catalog.ts"
Cohesion: 0.06
Nodes (57): LRCLIB lyrics source, LRCLIB metadata isn't clean, LRC markup leaked into guessable words (2026-09-14), LRCLIB requires a client identifier header, LRCLIB /api/search instead of /api/get, resolveSong.ts split out for Node tooling, audit(), main() (+49 more)

### Community 1 - "GameScreen.tsx"
Cohesion: 0.05
Nodes (59): react, react-dom, App(), AppHeader, AppHeaderProps, COPIED_MS, CopyCodeButton(), CopyCodeButtonProps (+51 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.14
Nodes (19): ref_node_module, ref_node_net, claimPort(), killTree(), loadIntoLocalKv(), main(), PackageManifest, port() (+11 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.08
Nodes (53): Model licensing (CC BY 3.0, never committed), Similarity pipeline (model→convert→build→inspect→upload→serve), frWac2Vec model (CC BY 3.0), main(), heatStyle(), TriedWords, clampScore(), HOT_SCORE (+45 more)

### Community 5 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (48): .vecbin compact embedding format, ref_node_readline, ref_node_util, build(), BuildOptions, catalogEntry(), main(), readVocabulary() (+40 more)

### Community 6 - "useGame.ts"
Cohesion: 0.11
Nodes (33): API_BASE, apiUrl(), ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps (+25 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.08
Nodes (25): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, @playwright/test, vite, @vitejs/plugin-react (+17 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.18
Nodes (17): Performance rules (memoize per isolate, no re-render on keystroke), One-time Cloudflare account setup for CI deploy, CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo, Google Fonts @import moved to <link> + preconnect (+9 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.13
Nodes (18): CLAUDE.md project instructions, Conventional Commits + Gitmoji, Continuous improvement loop, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, Lyrix game, Lyrix v3 mockup UI (+10 more)

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
Cohesion: 0.15
Nodes (16): Workers KV similarity tables, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, SIMILARITY deep-dive, Calibrate against the real model, Function words never count, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40) (+8 more)

### Community 17 - "index.ts"
Cohesion: 0.26
Nodes (15): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+7 more)

### Community 18 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 19 - "HMAC-signed round state"
Cohesion: 0.40
Nodes (5): Anti-cheat: Worker-only lyrics, HMAC-signed round state, songId in /api/round leaks the title, Only numbers cross the wire, Placement is display, not progress

### Community 20 - "state.ts"
Cohesion: 0.19
Nodes (14): Config rules: gitignored file never manual; missing config names itself, STATE_SECRET, Missing worker/.dev.vars bit twice (2026-09-13), STATE_SECRET var/secret binding conflict (2026-09-11), decoder, encoder, fromBase64Url(), hmacKey() (+6 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (15): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), get(), json(), newMember(), publicMember() (+7 more)

### Community 23 - "useRoom.ts"
Cohesion: 0.15
Nodes (18): createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult, roomSocketUrl(), RoomEntry (+10 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.09
Nodes (11): camille, entry(), FakeWebSocket, fetchMock, fetchRound, leo, round(), snapshot() (+3 more)

### Community 28 - "game/room.ts"
Cohesion: 0.16
Nodes (22): generateRoomCode(), isRecord(), OWN_FALLBACK_NAME, parseRoomEntry(), parseRoomMember(), parseRoomMessage(), parseRoomSnapshot(), PSEUDO_MAX_LENGTH (+14 more)

### Community 29 - "vitest"
Cohesion: 0.12
Nodes (9): ref_node_fs, ref_node_os, ref_node_path, vitest, DEBUG_CONFIG, DEBUG_PERSIST_DIR, SIMILARITY_BINDING, css (+1 more)

### Community 30 - "worker/room.test.ts"
Cohesion: 0.19
Nodes (8): RoomMessage, connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket, joinRoom(), post()

### Community 31 - "roomRoutes.ts"
Cohesion: 0.13
Nodes (8): hono, FakeLimiter, RateLimiter, REQUIRED_BINDINGS, RoomNamespace, roomRoutes, RoomsContext, roomStub()

### Community 32 - "debugMode.ts"
Cohesion: 0.19
Nodes (15): buildTodaysTable(), mainWorktree(), BUILD_SCRIPT, buildTableArgs(), everySongId(), extensionRank(), findModel(), LoadedTable (+7 more)

### Community 33 - "tokenize.ts"
Cohesion: 0.17
Nodes (8): IS_WORD, SPLIT_ON_WORDS, tokenize(), Token, devHintFor(), escapeRegExp(), firstTitleWord(), wordsInOrder()

### Community 34 - "MultiplayerModal.tsx"
Cohesion: 0.20
Nodes (14): RoomFailure, failureText(), FormError, InRoomProps, MultiplayerModalProps, RoomForms(), RoomFormsProps, Tab (+6 more)

### Community 35 - "types.ts"
Cohesion: 0.23
Nodes (8): DisplayLine, DisplaySection, DisplayToken, GuessResult, RoundView, chipOf(), guess(), space

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.30
Nodes (10): PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), PlayerAvatarProps, RoomMembers, memberName() (+2 more)

### Community 37 - "analyze.ts"
Cohesion: 0.18
Nodes (8): analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), cache, SongAnalysis, tokenizeSpy

### Community 38 - "guess.test.ts"
Cohesion: 0.22
Nodes (6): env, FIXTURE_LYRICS, mockLrclibFetch(), requestUrl(), app, resetSongMemo()

### Community 39 - "normalize"
Cohesion: 0.31
Nodes (3): FUNCTION_WORDS, LIGATURES, normalize()

### Community 40 - "ensure-dev-vars.ts"
Cohesion: 0.29
Nodes (6): ref_node_url, ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult

### Community 41 - "slots.test.ts"
Cohesion: 0.29
Nodes (5): NearGuess, SlotView, allTokens(), song, wordsOf()

### Community 42 - "tokenize() letter class missed œ (cœur split)"
Cohesion: 0.29
Nodes (7): French text matching (accents, elisions), Testing philosophy (script every check), tokenize() letter class missed œ (cœur split), A placeholder makes a feature look finished, Fetch failures silently swallowed in the UI (2026-09-11), Similarity too strict: rank-based scoring (2026-09-15), LETTER_CLASS

### Community 43 - "Graphify skill"
Cohesion: 0.67
Nodes (3): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, Windows PowerShell gotchas installing graphify (2026-09-12)

## Knowledge Gaps
- **226 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+221 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 311 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `catalog.ts`, `GameScreen.tsx`, `package.json`, `src/similarity.ts`, `similarityTable.test.ts`, `useGame.ts`, `e2e-servers.test.ts`, `favicon.test.ts`, `graph-update.ts`, `index.ts`, `gameScreen.test.tsx`, `state.ts`, `useRoom.ts`, `rooms.test.tsx`, `game/room.ts`, `worker/room.test.ts`, `debugMode.ts`, `tokenize.ts`, `types.ts`, `analyze.ts`, `guess.test.ts`, `normalize`, `slots.test.ts`?**
  _High betweenness centrality (0.243) - this node is a cross-community bridge._
- **Why does `react` connect `GameScreen.tsx` to `package.json`, `MultiplayerModal.tsx`, `src/similarity.ts`, `RoomMembers.tsx`, `useGame.ts`, `useRoom.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `CLAUDE.md project instructions` to `catalog.ts`, `GameScreen.tsx`, `LEARNINGS.md`, `tokenize() letter class missed œ (cœur split)`, `Graphify skill`, `SIMILARITY deep-dive`, `HMAC-signed round state`, `state.ts`, `CI workflow`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _226 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.062342342342342344 - nodes in this community are weakly interconnected._
- **Should `GameScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05221518987341772 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._