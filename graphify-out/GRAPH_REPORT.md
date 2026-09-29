# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 131 files · ~87,414 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1011 nodes · 2505 edges · 51 communities (49 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e691d65c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- build-similarity-table.ts
- TitleGuess.tsx
- package.json
- dev-debug.ts
- src/similarity.ts
- embeddings.ts
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
- similarityTable.test.ts
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
- vitest
- worker/room.test.ts
- guess.test.ts
- debugMode.ts
- GameScreen.tsx
- MultiplayerModal.tsx
- types.ts
- RoomMembers.tsx
- sampleSimilarity.ts
- gameScreen.test.tsx
- main.tsx
- ensure-dev-vars.ts
- slots.ts
- react
- state.ts
- rooms.spec.ts
- Missing worker/.dev.vars bit twice (2026-09-13)
- roomStorage.test.ts
- README
- Modal.tsx
- NextSongCountdown.tsx
- loadIntoLocalKv

## God Nodes (most connected - your core abstractions)
1. `vitest` - 36 edges
2. `Room` - 31 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 27 edges
5. `react` - 24 edges
6. `normalize()` - 24 edges
7. `SIMILARITY deep-dive` - 23 edges
8. `Song` - 22 edges
9. `GameScreen()` - 21 edges
10. `scripts` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Numbers compared by value (numberHint)` --references--> `numberHint()`  [EXTRACTED]
  docs/SIMILARITY.md → worker/src/similarity.ts
- `Optimization pass: repeated work, three caches (2026-09-15)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Only numbers cross the wire` --semantically_similar_to--> `Anti-cheat: Worker-only lyrics`  [INFERRED] [semantically similar]
  docs/SIMILARITY.md → CLAUDE.md
- `E2E from a worktree tested the main checkout's servers (2026-09-13)` --rationale_for--> `E2E dedicated ports (15173/18787/19229)`  [INFERRED]
  docs/LEARNINGS.md → README.md
- `graphify extraction defects fixed by hand (2026-09-29)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gitignored .dev.vars failures leading to config standing rules** — docs_learnings_state_secret_var_secret_conflict, docs_learnings_missing_dev_vars, scripts_ensure_dev_vars, claude_config_standing_rules [EXTRACTED 1.00]
- **Offline similarity pipeline** — readme_frwac2vec, scripts_lib_embeddings, scripts_lib_similaritytable, claude_workers_kv_similarity, worker_src_similarity, src_game_slots [EXTRACTED 1.00]
- **Anti-cheat information boundary** — claude_anti_cheat, claude_hmac_signed_round_state, docs_similarity_only_numbers_cross_wire, docs_similarity_position_addressing, docs_similarity_placement_is_display [INFERRED 0.85]
- **LRCLIB data hygiene pipeline** — docs_learnings_lrclib_search_not_get, docs_learnings_dirty_lrclib_metadata, docs_learnings_lrc_markup_leak, worker_src_lyrics_cleanlyrics, worker_src_lrclib [INFERRED 0.85]
- **Per-isolate and render memoization from the optimization pass** — docs_learnings_optimization_pass, docs_learnings_isolate_memo_reset, docs_learnings_keystroke_rerender, src_game_analyze, claude_performance_rules [INFERRED 0.85]

## Communities (51 total, 2 thin omitted)

### Community 0 - "build-similarity-table.ts"
Cohesion: 0.05
Nodes (59): LRCLIB lyrics source, LRCLIB metadata isn't clean, LRC markup leaked into guessable words (2026-09-14), LRCLIB requires a client identifier header, LRCLIB /api/search instead of /api/get, @playwright/test, build(), BuildOptions (+51 more)

### Community 1 - "TitleGuess.tsx"
Cohesion: 0.30
Nodes (10): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, SlotSection, SlotToken (+2 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.12
Nodes (21): ref_node_module, ref_node_net, ref_node_os, ref_node_path, claimPort(), ensureDevVars(), killTree(), main() (+13 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.12
Nodes (28): main(), clampScore(), GuessResult, fixtureScore(), counted, parsed(), song, SAMPLE_SIMILARITY_SCORES (+20 more)

### Community 5 - "embeddings.ts"
Cohesion: 0.14
Nodes (17): .vecbin compact embedding format, ref_node_readline, ref_node_util, main(), COMPACT_MAGIC, float32View(), l2NormalizeRows(), loadEmbeddings() (+9 more)

### Community 6 - "useGame.ts"
Cohesion: 0.10
Nodes (39): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots() (+31 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.13
Nodes (19): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, vite, @vitejs/plugin-react, apiProxy() (+11 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.23
Nodes (14): Performance rules (memoize per isolate, no re-render on keystroke), One-time Cloudflare account setup for CI deploy, CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo, Playwright hasText is a substring match (2026-09-13) (+6 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.14
Nodes (16): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, CLAUDE.md project instructions, Conventional Commits + Gitmoji, Continuous improvement loop, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy (+8 more)

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
Cohesion: 0.17
Nodes (12): ref_node_child_process, { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES (+4 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.19
Nodes (13): Workers KV similarity tables, SIMILARITY deep-dive, Calibrate against the real model, Function words never count, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), Numbers compared by value (numberHint) (+5 more)

### Community 17 - "round.ts"
Cohesion: 0.20
Nodes (18): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+10 more)

### Community 18 - "similarityTable.test.ts"
Cohesion: 0.11
Nodes (29): dotProduct(), EmbeddingModel, buildSimilarityScores(), BuildTableOptions, BuildTableResult, MAX_NEAR_TARGETS, MIN_NEAR_COSINE, pairScore() (+21 more)

### Community 19 - "HMAC-signed round state"
Cohesion: 0.22
Nodes (9): Anti-cheat: Worker-only lyrics, HMAC-signed round state, Testing philosophy (script every check), A placeholder makes a feature look finished, Fetch failures silently swallowed in the UI (2026-09-11), Similarity too strict: rank-based scoring (2026-09-15), songId in /api/round leaks the title, Only numbers cross the wire (+1 more)

### Community 20 - "WordToken.tsx"
Cohesion: 0.24
Nodes (12): heatStyle(), TriedWords, Blank(), blankLabel(), BlankProps, fitGuess(), PEEK_FADE_MS, PEEK_SHOW_MS (+4 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (17): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), newMember() (+9 more)

### Community 23 - "useRoom.ts"
Cohesion: 0.18
Nodes (19): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult (+11 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.07
Nodes (16): camille, entry(), FakeWebSocket, fetchMock, fetchRound, guessResult(), latestSocket(), leo (+8 more)

### Community 28 - "game/room.ts"
Cohesion: 0.14
Nodes (28): generateRoomCode(), isRecord(), isRoomCode(), OWN_FALLBACK_NAME, parseRoomGuess(), parseRoomGuessResult(), parseRoomMember(), parseRoomMessage() (+20 more)

### Community 29 - "vitest"
Cohesion: 0.15
Nodes (7): ref_node_fs, vitest, DEBUG_CONFIG, DEBUG_PERSIST_DIR, SIMILARITY_BINDING, css, html

### Community 30 - "worker/room.test.ts"
Cohesion: 0.14
Nodes (14): RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket (+6 more)

### Community 31 - "guess.test.ts"
Cohesion: 0.06
Nodes (34): resolveSong.ts split out for Node tooling, hono, env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), playedSong(), requestUrl() (+26 more)

### Community 32 - "debugMode.ts"
Cohesion: 0.19
Nodes (15): buildTodaysTable(), mainWorktree(), BUILD_SCRIPT, buildTableArgs(), extensionRank(), findModel(), LoadedTable, MODEL_DIR (+7 more)

### Community 33 - "GameScreen.tsx"
Cohesion: 0.16
Nodes (14): App(), Dialog, feedbackMessage(), GameScreen(), GuessFeedback, GuessForm(), GuessFormProps, plural() (+6 more)

### Community 34 - "MultiplayerModal.tsx"
Cohesion: 0.14
Nodes (21): RoomFailure, COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, failureText(), FormError, InRoom() (+13 more)

### Community 35 - "types.ts"
Cohesion: 0.09
Nodes (23): French text matching (accents, elisions), tokenize() letter class missed œ (cœur split), Normalization must stay in step, indexByKey(), isReferenceCandidate(), LETTERS_ONLY, ReferenceOptions, analyze() (+15 more)

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.23
Nodes (14): GroupFoundBanner, GroupFoundBannerProps, PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), PlayerAvatarProps (+6 more)

### Community 37 - "sampleSimilarity.ts"
Cohesion: 0.39
Nodes (5): classifyTargets(), FUNCTION_WORDS, isFunctionWord(), isNumberWord(), sampleNearTable

### Community 38 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 39 - "main.tsx"
Cohesion: 0.22
Nodes (8): Google Fonts @import moved to <link> + preconnect, index.html entry page, Google Fonts preconnect link, react-dom, rootElement, game.css (layout, breakpoints), global.css (keyframes), tokens.css (v3 palette)

### Community 40 - "ensure-dev-vars.ts"
Cohesion: 0.50
Nodes (3): ref_node_url, example, target

### Community 41 - "slots.ts"
Cohesion: 0.24
Nodes (10): graphify extraction defects fixed by hand (2026-09-29), Similarity pipeline (model→convert→build→inspect→upload→serve), Hidden words addressed by position, NearGuess, PlacedGuess, placeNearGuesses(), SlotView, wordPositions() (+2 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "state.ts"
Cohesion: 0.27
Nodes (10): decoder, encoder, fromBase64Url(), hmacKey(), isStatePayload(), keyCache, signState(), StatePayload (+2 more)

### Community 44 - "rooms.spec.ts"
Cohesion: 0.31
Nodes (9): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), openGame(), titleWords (+1 more)

### Community 45 - "Missing worker/.dev.vars bit twice (2026-09-13)"
Cohesion: 0.40
Nodes (5): Config rules: gitignored file never manual; missing config names itself, STATE_SECRET, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, Missing worker/.dev.vars bit twice (2026-09-13), STATE_SECRET var/secret binding conflict (2026-09-11)

### Community 46 - "roomStorage.test.ts"
Cohesion: 0.24
Nodes (7): parseRoomEntry(), RoomEntry, clearSavedRoom(), loadSavedRoom(), MemoryStorage, NOW, storage()

### Community 47 - "README"
Cohesion: 0.29
Nodes (7): Model licensing (CC BY 3.0, never committed), README, Debug mode (npm run dev:debug), E2E dedicated ports (15173/18787/19229), frWac2Vec model (CC BY 3.0), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

### Community 48 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 50 - "loadIntoLocalKv"
Cohesion: 0.50
Nodes (4): loadIntoLocalKv(), run(), bulkEntries(), kvBulkPutArgs()

## Knowledge Gaps
- **227 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 313 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `build-similarity-table.ts`, `package.json`, `dev-debug.ts`, `src/similarity.ts`, `embeddings.ts`, `useGame.ts`, `e2e-servers.test.ts`, `favicon.test.ts`, `graph-update.ts`, `round.ts`, `similarityTable.test.ts`, `useRoom.ts`, `rooms.test.tsx`, `game/room.ts`, `worker/room.test.ts`, `guess.test.ts`, `debugMode.ts`, `GameScreen.tsx`, `types.ts`, `sampleSimilarity.ts`, `gameScreen.test.tsx`, `state.ts`, `roomStorage.test.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `MultiplayerModal.tsx`, `RoomMembers.tsx`, `TitleGuess.tsx`, `useGame.ts`, `main.tsx`, `Modal.tsx`, `NextSongCountdown.tsx`, `WordToken.tsx`, `useRoom.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build-similarity-table.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05198537095088819 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._