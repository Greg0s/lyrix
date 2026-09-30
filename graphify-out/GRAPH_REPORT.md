# Graph Report - lyrix  (2026-09-30)

## Corpus Check
- 137 files · ~93,412 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1057 nodes · 2601 edges · 46 communities (39 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de5c8b2a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- src/similarity.ts
- LyricsBody.tsx
- package.json
- dev-debug.ts
- types.ts
- build-similarity-table.ts
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- Optimization pass: repeated work, three caches (2026-09-15)
- scripts
- CLAUDE.md project instructions
- theme.test.ts
- compilerOptions
- compilerOptions
- worker/room.test.ts
- SIMILARITY deep-dive
- graph-update.ts
- vitest
- Missing worker/.dev.vars bit twice (2026-09-13)
- WordToken.tsx
- CI workflow
- Room
- rooms.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- game/room.ts
- guess.test.ts
- debugMode.ts
- MultiplayerModal.tsx
- FakeSocket
- GameScreen.tsx
- RoomCard.tsx
- roomStorage.test.ts
- RoomMembers.tsx
- Modal.tsx
- ref_node_fs
- rooms.spec.ts
- Graphify skill
- src/room.ts
- react
- NextSongCountdown.tsx

## God Nodes (most connected - your core abstractions)
1. `vitest` - 38 edges
2. `Room` - 31 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 27 edges
5. `normalize()` - 26 edges
6. `react` - 25 edges
7. `SIMILARITY deep-dive` - 23 edges
8. `GameScreen()` - 22 edges
9. `Song` - 22 edges
10. `scripts` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Numbers compared by value (numberHint)` --references--> `numberHint()`  [EXTRACTED]
  docs/SIMILARITY.md → worker/src/similarity.ts
- `Only numbers cross the wire` --semantically_similar_to--> `Anti-cheat: Worker-only lyrics`  [INFERRED] [semantically similar]
  docs/SIMILARITY.md → CLAUDE.md
- `graphify extraction defects fixed by hand (2026-09-29)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Optimization pass: repeated work, three caches (2026-09-15)` --references--> `wordPositions()`  [EXTRACTED]
  docs/LEARNINGS.md → src/game/slots.ts
- `Hidden words addressed by position` --references--> `wordPositions()`  [EXTRACTED]
  docs/SIMILARITY.md → src/game/slots.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Gitignored .dev.vars failures leading to config standing rules** — docs_learnings_state_secret_var_secret_conflict, docs_learnings_missing_dev_vars, scripts_ensure_dev_vars, claude_config_standing_rules [EXTRACTED 1.00]
- **Offline similarity pipeline** — readme_frwac2vec, scripts_lib_embeddings, scripts_lib_similaritytable, claude_workers_kv_similarity, worker_src_similarity, src_game_slots [EXTRACTED 1.00]
- **Anti-cheat information boundary** — claude_anti_cheat, claude_hmac_signed_round_state, docs_similarity_only_numbers_cross_wire, docs_similarity_position_addressing, docs_similarity_placement_is_display [INFERRED 0.85]
- **LRCLIB data hygiene pipeline** — docs_learnings_lrclib_search_not_get, docs_learnings_dirty_lrclib_metadata, docs_learnings_lrc_markup_leak, worker_src_lyrics_cleanlyrics, worker_src_lrclib [INFERRED 0.85]
- **Per-isolate and render memoization from the optimization pass** — docs_learnings_optimization_pass, docs_learnings_isolate_memo_reset, docs_learnings_keystroke_rerender, src_game_analyze, claude_performance_rules [INFERRED 0.85]

## Communities (46 total, 7 thin omitted)

### Community 0 - "src/similarity.ts"
Cohesion: 0.13
Nodes (32): main(), classifyTargets(), isFunctionWord(), clampScore(), NEAR_SCORE, wordPositions(), isNumberWord(), fixtureScore() (+24 more)

### Community 1 - "LyricsBody.tsx"
Cohesion: 0.39
Nodes (7): LyricsBody, LyricsBodyProps, TitleGuess, TokenRun(), SlotSection, target(), useRovingBlanks()

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.12
Nodes (22): Debug mode (npm run dev:debug), buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree(), PackageManifest (+14 more)

### Community 4 - "types.ts"
Cohesion: 0.06
Nodes (50): TitleGuessProps, TokenRunProps, analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), analyzeSong() (+42 more)

### Community 5 - "build-similarity-table.ts"
Cohesion: 0.07
Nodes (49): LRCLIB lyrics source, build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile() (+41 more)

### Community 6 - "useGame.ts"
Cohesion: 0.08
Nodes (48): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), PlayerAvatarProps, TriedWordsProps (+40 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.11
Nodes (18): similarityTableFixture, similarityWorkerUrl, workerUrl, @playwright/test, vite, @vitejs/plugin-react, apiProxy(), apiProxyTarget() (+10 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.12
Nodes (16): CLAUDE.md project instructions, Conventional Commits + Gitmoji, DEV_REVEAL_LYRICS dev hint, Lyrix game, Lyrix v3 mockup UI, Pedantix, Show-all-lyrics checkbox (revealHint), Team mode placeholder (#29, #30) (+8 more)

### Community 12 - "theme.test.ts"
Cohesion: 0.06
Nodes (46): colors, root, tokens, cssColorToHex(), cssVar(), faviconColors, faviconSvg(), Piece (+38 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "worker/room.test.ts"
Cohesion: 0.17
Nodes (13): alone(), connect(), createRoom(), entryFrom(), FakeLimiter, FakeRooms, guessIn(), joinRoom() (+5 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.14
Nodes (10): SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), Similarity pipeline (model→convert→build→inspect→upload→serve), RANK_VOCABULARY_SIZE (50,000), scoreFromRank, SIMILARITY_TABLE_VERSION (3) (+2 more)

### Community 17 - "graph-update.ts"
Cohesion: 0.15
Nodes (11): { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES, KnownFalseEdge (+3 more)

### Community 18 - "vitest"
Cohesion: 0.06
Nodes (46): vitest, main(), COMPACT_MAGIC, dotProduct(), EmbeddingModel, float32View(), l2NormalizeRows(), loadEmbeddings() (+38 more)

### Community 20 - "WordToken.tsx"
Cohesion: 0.22
Nodes (13): heatStyle(), TriedWords, Blank(), blankLabel(), BlankProps, PEEK_FADE_MS, PEEK_SHOW_MS, WordToken() (+5 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.10
Nodes (12): FakeState, attachedMemberId(), deleteAll(), foundKeys(), json(), publicMember(), put(), readBody() (+4 more)

### Community 23 - "rooms.ts"
Cohesion: 0.24
Nodes (15): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult (+7 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.05
Nodes (23): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders, camille (+15 more)

### Community 28 - "game/room.ts"
Cohesion: 0.27
Nodes (14): generateRoomCode(), isRecord(), isRoomCode(), OWN_FALLBACK_NAME, parseRoomEntry(), parseRoomGuess(), parseRoomMember(), parseRoomMessage() (+6 more)

### Community 29 - "guess.test.ts"
Cohesion: 0.05
Nodes (41): hono, env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), playedSong(), requestUrl(), similarityKv() (+33 more)

### Community 30 - "debugMode.ts"
Cohesion: 0.13
Nodes (17): BUILD_SCRIPT, DEBUG_CONFIG, DEBUG_PERSIST_DIR, everySongId(), extensionRank(), findModel(), LoadedTable, MODEL_DIR (+9 more)

### Community 31 - "MultiplayerModal.tsx"
Cohesion: 0.19
Nodes (15): RoomFailure, failureText(), FormError, InRoom(), InRoomProps, MultiplayerModal(), MultiplayerModalProps, RoomForms() (+7 more)

### Community 32 - "FakeSocket"
Cohesion: 0.21
Nodes (4): parseRoomRoundMessage(), RoomMessage, RoomRoundMessage, FakeSocket

### Community 33 - "GameScreen.tsx"
Cohesion: 0.17
Nodes (13): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+5 more)

### Community 34 - "RoomCard.tsx"
Cohesion: 0.36
Nodes (6): COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, RoomCard, playerCountLabel()

### Community 35 - "roomStorage.test.ts"
Cohesion: 0.24
Nodes (7): RoomEntry, clearSavedRoom(), loadSavedRoom(), saveRoom(), MemoryStorage, NOW, storage()

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.33
Nodes (9): GroupFoundBanner, GroupFoundBannerProps, PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), RoomMembers (+1 more)

### Community 37 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 38 - "ref_node_fs"
Cohesion: 0.21
Nodes (5): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult

### Community 39 - "rooms.spec.ts"
Cohesion: 0.31
Nodes (9): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), openGame(), titleWords (+1 more)

### Community 41 - "src/room.ts"
Cohesion: 0.12
Nodes (21): ROOM_CLOSE_EXPIRED, ROOM_CLOSE_LEFT, ROOM_CLOSE_UNKNOWN, ROOM_PING, ROOM_PONG, RoomEvent, RoomGuess, RoomGuessResult (+13 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

## Knowledge Gaps
- **237 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 331 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `src/similarity.ts`, `package.json`, `types.ts`, `build-similarity-table.ts`, `useGame.ts`, `e2e-servers.test.ts`, `Optimization pass: repeated work, three caches (2026-09-15)`, `theme.test.ts`, `worker/room.test.ts`, `graph-update.ts`, `rooms.ts`, `rooms.test.tsx`, `game/room.ts`, `guess.test.ts`, `debugMode.ts`, `GameScreen.tsx`, `roomStorage.test.ts`, `ref_node_fs`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `RoomCard.tsx`, `RoomMembers.tsx`, `LyricsBody.tsx`, `Modal.tsx`, `types.ts`, `useGame.ts`, `src/room.ts`, `CLAUDE.md project instructions`, `theme.test.ts`, `NextSongCountdown.tsx`, `WordToken.tsx`, `MultiplayerModal.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `src/similarity.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1168091168091168 - nodes in this community are weakly interconnected._