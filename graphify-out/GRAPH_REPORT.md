# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 130 files · ~84,115 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 998 nodes · 2443 edges · 50 communities (48 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a36f67b3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- catalog.ts
- TitleGuess.tsx
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
- round.ts
- game/similarity.ts
- HMAC-signed round state
- WordToken.tsx
- CI workflow
- Room
- useRoom.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- game/room.ts
- debugMode.ts
- worker/room.test.ts
- index.ts
- scripts/debugMode.test.ts
- GameScreen.tsx
- MultiplayerModal.tsx
- types.ts
- RoomMembers.tsx
- normalize
- guess.test.ts
- Optimization pass: repeated work, three caches (2026-09-15)
- ref_node_fs
- slots.ts
- react
- Graphify skill
- rooms.spec.ts
- isRecord
- roomStorage.test.ts
- README
- Modal.tsx
- NextSongCountdown.tsx

## God Nodes (most connected - your core abstractions)
1. `vitest` - 36 edges
2. `Room` - 30 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 25 edges
5. `normalize()` - 24 edges
6. `react` - 23 edges
7. `SIMILARITY deep-dive` - 23 edges
8. `Song` - 22 edges
9. `scripts` - 20 edges
10. `GameScreen()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Numbers compared by value (numberHint)` --references--> `numberHint()`  [EXTRACTED]
  docs/SIMILARITY.md → worker/src/similarity.ts
- `graphify extraction defects fixed by hand (2026-09-29)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Optimization pass: repeated work, three caches (2026-09-15)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `E2E from a worktree tested the main checkout's servers (2026-09-13)` --rationale_for--> `E2E dedicated ports (15173/18787/19229)`  [INFERRED]
  docs/LEARNINGS.md → README.md
- `Only numbers cross the wire` --semantically_similar_to--> `Anti-cheat: Worker-only lyrics`  [INFERRED] [semantically similar]
  docs/SIMILARITY.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gitignored .dev.vars failures leading to config standing rules** — docs_learnings_state_secret_var_secret_conflict, docs_learnings_missing_dev_vars, scripts_ensure_dev_vars, claude_config_standing_rules [EXTRACTED 1.00]
- **Offline similarity pipeline** — readme_frwac2vec, scripts_lib_embeddings, scripts_lib_similaritytable, claude_workers_kv_similarity, worker_src_similarity, src_game_slots [EXTRACTED 1.00]
- **Anti-cheat information boundary** — claude_anti_cheat, claude_hmac_signed_round_state, docs_similarity_only_numbers_cross_wire, docs_similarity_position_addressing, docs_similarity_placement_is_display [INFERRED 0.85]
- **LRCLIB data hygiene pipeline** — docs_learnings_lrclib_search_not_get, docs_learnings_dirty_lrclib_metadata, docs_learnings_lrc_markup_leak, worker_src_lyrics_cleanlyrics, worker_src_lrclib [INFERRED 0.85]
- **Per-isolate and render memoization from the optimization pass** — docs_learnings_optimization_pass, docs_learnings_isolate_memo_reset, docs_learnings_keystroke_rerender, src_game_analyze, claude_performance_rules [INFERRED 0.85]

## Communities (50 total, 2 thin omitted)

### Community 0 - "catalog.ts"
Cohesion: 0.05
Nodes (61): LRCLIB lyrics source, LRC markup leaked into guessable words (2026-09-14), LRCLIB /api/search instead of /api/get, resolveSong.ts split out for Node tooling, @playwright/test, audit(), main(), sleep() (+53 more)

### Community 1 - "TitleGuess.tsx"
Cohesion: 0.27
Nodes (11): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, WordTokenProps, SlotSection (+3 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.13
Nodes (22): ref_node_module, ref_node_net, buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree() (+14 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.16
Nodes (18): isNumberWord(), fixtureScore(), SAMPLE_SIMILARITY_SCORES, sampleNearTable, announcedTables, announceSampleMode(), announceTableProblem(), isRecord() (+10 more)

### Community 5 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (46): .vecbin compact embedding format, ref_node_readline, ref_node_util, build(), BuildOptions, catalogEntry(), main(), readVocabulary() (+38 more)

### Community 6 - "useGame.ts"
Cohesion: 0.06
Nodes (50): @testing-library/react, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), PlayerAvatarProps, TriedWordsProps (+42 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.13
Nodes (19): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, vite, @vitejs/plugin-react, apiProxy() (+11 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.15
Nodes (18): Continuous improvement loop, French text matching (accents, elisions), Testing philosophy (script every check), One-time Cloudflare account setup for CI deploy, Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), LRCLIB metadata isn't clean, Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo (+10 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.14
Nodes (17): CLAUDE.md project instructions, Conventional Commits + Gitmoji, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, Lyrix game, Lyrix v3 mockup UI, Out of scope: 3D, team mode, accounts, D1 (+9 more)

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
Cohesion: 0.16
Nodes (15): Workers KV similarity tables, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, SIMILARITY deep-dive, Calibrate against the real model, Function words never count, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40) (+7 more)

### Community 17 - "round.ts"
Cohesion: 0.25
Nodes (17): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+9 more)

### Community 18 - "game/similarity.ts"
Cohesion: 0.25
Nodes (13): main(), clampScore(), HOT_SCORE, MAX_MISSED_SCORE, MAX_PROXIMITY_SCORE, NEAR_SCORE, numberProximityScore(), ProximityScored (+5 more)

### Community 19 - "HMAC-signed round state"
Cohesion: 0.22
Nodes (9): Anti-cheat: Worker-only lyrics, Config rules: gitignored file never manual; missing config names itself, HMAC-signed round state, STATE_SECRET, Missing worker/.dev.vars bit twice (2026-09-13), songId in /api/round leaks the title, STATE_SECRET var/secret binding conflict (2026-09-11), Only numbers cross the wire (+1 more)

### Community 20 - "WordToken.tsx"
Cohesion: 0.23
Nodes (13): heatStyle(), TriedWords, Blank(), blankLabel(), BlankProps, fitGuess(), PEEK_FADE_MS, PEEK_SHOW_MS (+5 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (14): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), publicMember() (+6 more)

### Community 23 - "useRoom.ts"
Cohesion: 0.19
Nodes (19): API_BASE, apiUrl(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult (+11 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.08
Nodes (16): camille, entry(), FakeWebSocket, fetchMock, fetchRound, guessResult(), latestSocket(), leo (+8 more)

### Community 28 - "game/room.ts"
Cohesion: 0.13
Nodes (25): generateRoomCode(), isRoomCode(), memberName(), OWN_FALLBACK_NAME, PSEUDO_MAX_LENGTH, ROOM_CLOSE_EXPIRED, ROOM_CLOSE_LEFT, ROOM_CLOSE_UNKNOWN (+17 more)

### Community 29 - "debugMode.ts"
Cohesion: 0.18
Nodes (11): DEBUG_CONFIG, DEBUG_PERSIST_DIR, kvBulkPutArgs(), LoadedTable, MODEL_DIR, MODEL_EXTENSIONS, SIMILARITY_BINDING, TABLE_DIR (+3 more)

### Community 30 - "worker/room.test.ts"
Cohesion: 0.15
Nodes (12): RoomMessage, RoomRoundMessage, connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket, guessIn() (+4 more)

### Community 31 - "index.ts"
Cohesion: 0.08
Nodes (22): hono, FakeLimiter, Env, RateLimiter, REQUIRED_BINDINGS, RoomNamespace, roomRoutes, RoomsContext (+14 more)

### Community 32 - "scripts/debugMode.test.ts"
Cohesion: 0.29
Nodes (6): everySongId(), extensionRank(), findModel(), modelSearchDirs(), modelsIn(), tablePath()

### Community 33 - "GameScreen.tsx"
Cohesion: 0.24
Nodes (10): App(), Dialog, feedbackMessage(), GameScreen(), GuessFeedback, GuessForm(), GuessFormProps, plural() (+2 more)

### Community 34 - "MultiplayerModal.tsx"
Cohesion: 0.14
Nodes (22): RoomFailure, COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, failureText(), FormError, InRoom() (+14 more)

### Community 35 - "types.ts"
Cohesion: 0.14
Nodes (10): vitest, revealedPercent(), IS_WORD, SPLIT_ON_WORDS, DisplayLine, DisplaySection, DisplayToken, Token (+2 more)

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.48
Nodes (5): PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar()

### Community 37 - "normalize"
Cohesion: 0.17
Nodes (12): classifyTargets(), analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), cache, SongAnalysis (+4 more)

### Community 38 - "guess.test.ts"
Cohesion: 0.14
Nodes (14): env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), requestUrl(), similarityKv(), counted, parsed() (+6 more)

### Community 39 - "Optimization pass: repeated work, three caches (2026-09-15)"
Cohesion: 0.22
Nodes (9): Performance rules (memoize per isolate, no re-render on keystroke), CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Google Fonts @import moved to <link> + preconnect, Isolate memos need reset*() in beforeEach, Typing re-rendered every lyrics token, Optimization pass: repeated work, three caches (2026-09-15), index.html entry page (+1 more)

### Community 40 - "ref_node_fs"
Cohesion: 0.16
Nodes (11): ref_node_fs, ref_node_os, ref_node_path, ref_node_url, ensureDevVars(), example, target, ensureFileFromExample() (+3 more)

### Community 41 - "slots.ts"
Cohesion: 0.19
Nodes (13): Similarity pipeline (model→convert→build→inspect→upload→serve), Hidden words addressed by position, closestGuessBySlot(), NearGuess, PlacedGuess, placeNearGuesses(), SlotView, wordPositions() (+5 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "Graphify skill"
Cohesion: 0.67
Nodes (3): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, Windows PowerShell gotchas installing graphify (2026-09-12)

### Community 44 - "rooms.spec.ts"
Cohesion: 0.24
Nodes (5): contexts, createRoom(), dialog(), joinRoom(), titleWords

### Community 45 - "isRecord"
Cohesion: 0.44
Nodes (9): isRecord(), isRoundView(), parseRoomGuess(), parseRoomGuessResult(), parseRoomMember(), parseRoomMessage(), parseRoomRound(), parseRoomRoundMessage() (+1 more)

### Community 46 - "roomStorage.test.ts"
Cohesion: 0.36
Nodes (3): MemoryStorage, NOW, storage()

### Community 47 - "README"
Cohesion: 0.29
Nodes (7): Model licensing (CC BY 3.0, never committed), README, Debug mode (npm run dev:debug), E2E dedicated ports (15173/18787/19229), frWac2Vec model (CC BY 3.0), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

### Community 48 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

## Knowledge Gaps
- **227 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 315 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `types.ts` to `catalog.ts`, `package.json`, `similarityTable.test.ts`, `useGame.ts`, `e2e-servers.test.ts`, `favicon.test.ts`, `graph-update.ts`, `round.ts`, `game/similarity.ts`, `useRoom.ts`, `rooms.test.tsx`, `game/room.ts`, `debugMode.ts`, `worker/room.test.ts`, `index.ts`, `scripts/debugMode.test.ts`, `normalize`, `guess.test.ts`, `Optimization pass: repeated work, three caches (2026-09-15)`, `ref_node_fs`, `slots.ts`, `roomStorage.test.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.208) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `MultiplayerModal.tsx`, `TitleGuess.tsx`, `RoomMembers.tsx`, `useGame.ts`, `CLAUDE.md project instructions`, `Modal.tsx`, `NextSongCountdown.tsx`, `WordToken.tsx`, `useRoom.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `CLAUDE.md project instructions` to `catalog.ts`, `Optimization pass: repeated work, three caches (2026-09-15)`, `LEARNINGS.md`, `Graphify skill`, `README`, `SIMILARITY deep-dive`, `HMAC-signed round state`, `CI workflow`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050817160367722165 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._