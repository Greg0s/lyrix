# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 131 files · ~88,012 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1011 nodes · 2505 edges · 57 communities (51 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `09c3fbd0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- catalogAudit.ts
- WordToken.tsx
- package.json
- dev-debug.ts
- src/similarity.ts
- embeddings.ts
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- scripts
- CLAUDE.md project instructions
- favicon.test.ts
- compilerOptions
- compilerOptions
- graph-update.ts
- SIMILARITY deep-dive
- types.ts
- similarityTable.test.ts
- HMAC-signed round state
- game/similarity.ts
- CI workflow
- Room
- resolveSong.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- game/room.ts
- vitest
- worker/room.test.ts
- roomRoutes.ts
- debugMode.ts
- GameScreen.tsx
- MultiplayerModal.tsx
- normalize
- RoomMembers.tsx
- guess.test.ts
- catalog.ts
- songs.ts
- ensure-dev-vars.ts
- useRoom.ts
- react
- state.ts
- mask.ts
- build-similarity-table.ts
- roomStorage.test.ts
- gameScreen.test.tsx
- rooms.spec.ts
- NextSongCountdown.tsx
- round.ts
- main.tsx
- analyze.ts
- slots.test.ts
- tokenize() letter class missed œ (cœur split)
- Modal.tsx
- Similarity pipeline (model→convert→build→inspect→upload→serve)

## God Nodes (most connected - your core abstractions)
1. `vitest` - 36 edges
2. `Room` - 31 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 27 edges
5. `react` - 24 edges
6. `normalize()` - 24 edges
7. `SIMILARITY deep-dive` - 23 edges
8. `GameScreen()` - 22 edges
9. `Song` - 22 edges
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

## Communities (57 total, 6 thin omitted)

### Community 0 - "catalogAudit.ts"
Cohesion: 0.26
Nodes (15): audit(), main(), sleep(), auditSong(), CatalogAudit, duplicateCatalogIds(), failureAdvice(), formatAudit() (+7 more)

### Community 1 - "WordToken.tsx"
Cohesion: 0.18
Nodes (17): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, Blank(), blankLabel() (+9 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.13
Nodes (22): buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree(), PackageManifest, port() (+14 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.15
Nodes (24): main(), clampScore(), fixtureScore(), counted, song, announcedTables, announceSampleMode(), announceTableProblem() (+16 more)

### Community 5 - "embeddings.ts"
Cohesion: 0.14
Nodes (15): .vecbin compact embedding format, main(), COMPACT_MAGIC, float32View(), l2NormalizeRows(), loadEmbeddings(), LoadOptions, parseHeader() (+7 more)

### Community 6 - "useGame.ts"
Cohesion: 0.10
Nodes (39): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots() (+31 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.13
Nodes (17): similarityTableFixture, similarityWorkerUrl, workerUrl, vite, @vitejs/plugin-react, apiProxy(), apiProxyTarget(), DEV_PORTS (+9 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.12
Nodes (14): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, CLAUDE.md project instructions, Conventional Commits + Gitmoji, DEV_REVEAL_LYRICS dev hint, Lyrix game, Lyrix v3 mockup UI, Pedantix (+6 more)

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
Nodes (11): { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES, KnownFalseEdge (+3 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.18
Nodes (8): Workers KV similarity tables, SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), RANK_VOCABULARY_SIZE (50,000), scoreFromRank, SIMILARITY_TABLE_VERSION (3)

### Community 17 - "types.ts"
Cohesion: 0.13
Nodes (13): revealedPercent(), PlacedGuess, IS_WORD, SPLIT_ON_WORDS, DisplayLine, DisplayToken, GuessResult, NearSlot (+5 more)

### Community 18 - "similarityTable.test.ts"
Cohesion: 0.12
Nodes (26): dotProduct(), EmbeddingModel, buildSimilarityScores(), BuildTableOptions, BuildTableResult, classifyTargets(), MAX_NEAR_TARGETS, MIN_NEAR_COSINE (+18 more)

### Community 20 - "game/similarity.ts"
Cohesion: 0.23
Nodes (15): heatStyle(), TriedWords, HOT_SCORE, MAX_MISSED_SCORE, MAX_PROXIMITY_SCORE, NEAR_SCORE, numberProximityScore(), proximityHeat() (+7 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (16): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), newMember() (+8 more)

### Community 23 - "resolveSong.ts"
Cohesion: 0.11
Nodes (20): LRCLIB lyrics source, Section, entry, entry, bestMatch(), hasUsableLyrics(), LrclibTrack, parseLrclibTrack() (+12 more)

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
Cohesion: 0.18
Nodes (5): vitest, everySongId(), css, html, FALLBACK_SONG_ID

### Community 30 - "worker/room.test.ts"
Cohesion: 0.14
Nodes (14): RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket (+6 more)

### Community 31 - "roomRoutes.ts"
Cohesion: 0.12
Nodes (9): hono, FakeLimiter, RateLimiter, REQUIRED_BINDINGS, RoomNamespace, roomRoutes, RoomsContext, RoomsEnv (+1 more)

### Community 32 - "debugMode.ts"
Cohesion: 0.16
Nodes (12): BUILD_SCRIPT, DEBUG_CONFIG, DEBUG_PERSIST_DIR, extensionRank(), findModel(), LoadedTable, MODEL_DIR, MODEL_EXTENSIONS (+4 more)

### Community 33 - "GameScreen.tsx"
Cohesion: 0.22
Nodes (12): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+4 more)

### Community 34 - "MultiplayerModal.tsx"
Cohesion: 0.13
Nodes (22): Team mode placeholder (#29, #30), RoomFailure, COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, failureText(), FormError (+14 more)

### Community 35 - "normalize"
Cohesion: 0.23
Nodes (5): FUNCTION_WORDS, LIGATURES, normalize(), placeNearGuesses(), wordPositions()

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.23
Nodes (14): GroupFoundBanner, GroupFoundBannerProps, PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), PlayerAvatarProps (+6 more)

### Community 37 - "guess.test.ts"
Cohesion: 0.13
Nodes (14): env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), playedSong(), requestUrl(), similarityKv(), parsed() (+6 more)

### Community 38 - "catalog.ts"
Cohesion: 0.13
Nodes (12): @playwright/test, tokenize(), devHintFor(), escapeRegExp(), firstTitleWord(), chipOf(), guess(), wordsInOrder() (+4 more)

### Community 39 - "songs.ts"
Cohesion: 0.32
Nodes (9): cacheKey(), getCachedSong(), isSong(), putCachedSong(), EMERGENCY_FALLBACK_SONG, getSongById(), getTodaysSong(), memoize() (+1 more)

### Community 40 - "ensure-dev-vars.ts"
Cohesion: 0.29
Nodes (5): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult

### Community 41 - "useRoom.ts"
Cohesion: 0.18
Nodes (19): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult (+11 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "state.ts"
Cohesion: 0.27
Nodes (10): decoder, encoder, fromBase64Url(), hmacKey(), isStatePayload(), keyCache, signState(), StatePayload (+2 more)

### Community 44 - "mask.ts"
Cohesion: 0.32
Nodes (12): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+4 more)

### Community 45 - "build-similarity-table.ts"
Cohesion: 0.39
Nodes (8): build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile(), parseSections()

### Community 46 - "roomStorage.test.ts"
Cohesion: 0.24
Nodes (7): parseRoomEntry(), RoomEntry, clearSavedRoom(), loadSavedRoom(), MemoryStorage, NOW, storage()

### Community 47 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 48 - "rooms.spec.ts"
Cohesion: 0.31
Nodes (9): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), openGame(), titleWords (+1 more)

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 50 - "round.ts"
Cohesion: 0.26
Nodes (8): Env, buildRoundView(), devRevealOn(), evaluateGuess(), GuessOutcome, MAX_WORD_LENGTH, parseGuessWord(), RoundEnv

### Community 51 - "main.tsx"
Cohesion: 0.22
Nodes (7): index.html entry page, Google Fonts preconnect link, react-dom, rootElement, game.css (layout, breakpoints), global.css (keyframes), tokens.css (v3 palette)

### Community 52 - "analyze.ts"
Cohesion: 0.29
Nodes (7): analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), cache, SongAnalysis

### Community 53 - "slots.test.ts"
Cohesion: 0.29
Nodes (5): NearGuess, SlotView, allTokens(), song, wordsOf()

### Community 55 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

## Knowledge Gaps
- **227 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 313 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `catalogAudit.ts`, `package.json`, `src/similarity.ts`, `embeddings.ts`, `useGame.ts`, `e2e-servers.test.ts`, `favicon.test.ts`, `graph-update.ts`, `types.ts`, `similarityTable.test.ts`, `game/similarity.ts`, `resolveSong.ts`, `rooms.test.tsx`, `game/room.ts`, `worker/room.test.ts`, `debugMode.ts`, `normalize`, `guess.test.ts`, `catalog.ts`, `useRoom.ts`, `state.ts`, `mask.ts`, `roomStorage.test.ts`, `gameScreen.test.tsx`, `NextSongCountdown.tsx`, `slots.test.ts`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `MultiplayerModal.tsx`, `RoomMembers.tsx`, `WordToken.tsx`, `useGame.ts`, `useRoom.ts`, `NextSongCountdown.tsx`, `main.tsx`, `game/similarity.ts`, `Modal.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `CLAUDE.md project instructions` connect `CLAUDE.md project instructions` to `MultiplayerModal.tsx`, `LEARNINGS.md`, `SIMILARITY deep-dive`, `HMAC-signed round state`, `main.tsx`, `CI workflow`, `tokenize() letter class missed œ (cœur split)`, `resolveSong.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12923076923076923 - nodes in this community are weakly interconnected._
- **Should `embeddings.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14461538461538462 - nodes in this community are weakly interconnected._