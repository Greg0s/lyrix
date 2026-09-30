# Graph Report - lyrix  (2026-09-30)

## Corpus Check
- 137 files · ~91,406 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1051 nodes · 2602 edges · 53 communities (47 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7afde048`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- build-similarity-table.ts
- TitleGuess.tsx
- package.json
- dev-debug.ts
- src/similarity.ts
- vitest
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- LEARNINGS.md
- scripts
- CLAUDE.md project instructions
- theme.test.ts
- compilerOptions
- compilerOptions
- graph-update.ts
- SIMILARITY deep-dive
- types.ts
- similarityTable.test.ts
- Missing worker/.dev.vars bit twice (2026-09-13)
- WordToken.tsx
- CI workflow
- Room
- useRoom.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- game/similarity.ts
- debugMode.ts
- worker/room.test.ts
- state.ts
- scripts/debugMode.test.ts
- GameScreen.tsx
- RoomMembers.tsx
- round.ts
- playerColor.ts
- guess.test.ts
- @playwright/test
- index.ts
- ref_node_fs
- game/room.ts
- react
- roomStorage.test.ts
- slots.ts
- gameScreen.test.tsx
- src/room.ts
- rooms.spec.ts
- Modal.tsx
- NextSongCountdown.tsx
- tokenize() letter class missed œ (cœur split)
- README

## God Nodes (most connected - your core abstractions)
1. `vitest` - 37 edges
2. `Room` - 31 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 28 edges
5. `normalize()` - 27 edges
6. `react` - 25 edges
7. `Song` - 23 edges
8. `SIMILARITY deep-dive` - 23 edges
9. `GameScreen()` - 22 edges
10. `scripts` - 20 edges

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

## Communities (53 total, 6 thin omitted)

### Community 0 - "build-similarity-table.ts"
Cohesion: 0.07
Nodes (50): LRCLIB lyrics source, build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile() (+42 more)

### Community 1 - "TitleGuess.tsx"
Cohesion: 0.30
Nodes (10): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, SlotSection, SlotToken (+2 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.13
Nodes (20): buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree(), PackageManifest, port() (+12 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.21
Nodes (16): wordPositions(), isNumberWord(), SAMPLE_SIMILARITY_SCORES, sampleNearTable, announcedTables, announceSampleMode(), announceTableProblem(), loadSimilarityTable() (+8 more)

### Community 5 - "vitest"
Cohesion: 0.11
Nodes (17): vitest, analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), cache, SongAnalysis (+9 more)

### Community 6 - "useGame.ts"
Cohesion: 0.08
Nodes (44): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), GroupFoundBannerProps, TriedWordsProps (+36 more)

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
Cohesion: 0.11
Nodes (16): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, CLAUDE.md project instructions, Conventional Commits + Gitmoji, DEV_REVEAL_LYRICS dev hint, Lyrix game, Lyrix v3 mockup UI, Pedantix (+8 more)

### Community 12 - "theme.test.ts"
Cohesion: 0.08
Nodes (34): colors, root, tokens, cssColorToHex(), cssVar(), faviconColors, faviconSvg(), Piece (+26 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "graph-update.ts"
Cohesion: 0.15
Nodes (11): { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES, KnownFalseEdge (+3 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.15
Nodes (9): SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), Similarity pipeline (model→convert→build→inspect→upload→serve), RANK_VOCABULARY_SIZE (50,000), scoreFromRank, SIMILARITY_TABLE_VERSION (3) (+1 more)

### Community 17 - "types.ts"
Cohesion: 0.26
Nodes (7): revealedPercent(), DisplayLine, DisplaySection, DisplayToken, GuessResult, RoundView, space

### Community 18 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (40): .vecbin compact embedding format, main(), COMPACT_MAGIC, dotProduct(), EmbeddingModel, float32View(), l2NormalizeRows(), loadEmbeddings() (+32 more)

### Community 20 - "WordToken.tsx"
Cohesion: 0.24
Nodes (10): heatStyle(), TriedWords, Blank(), blankLabel(), BlankProps, PEEK_FADE_MS, PEEK_SHOW_MS, WordToken() (+2 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.08
Nodes (18): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), newMember() (+10 more)

### Community 23 - "useRoom.ts"
Cohesion: 0.20
Nodes (17): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomFailure (+9 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.07
Nodes (16): camille, entry(), FakeWebSocket, fetchMock, fetchRound, guessResult(), latestSocket(), leo (+8 more)

### Community 28 - "game/similarity.ts"
Cohesion: 0.23
Nodes (15): main(), clampScore(), HOT_SCORE, MAX_MISSED_SCORE, NEAR_SCORE, numberProximityScore(), ProximityScored, proximityTier (+7 more)

### Community 29 - "debugMode.ts"
Cohesion: 0.18
Nodes (11): DEBUG_CONFIG, DEBUG_PERSIST_DIR, kvBulkPutArgs(), LoadedTable, MODEL_DIR, MODEL_EXTENSIONS, SIMILARITY_BINDING, TABLE_DIR (+3 more)

### Community 30 - "worker/room.test.ts"
Cohesion: 0.14
Nodes (14): RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket (+6 more)

### Community 31 - "state.ts"
Cohesion: 0.20
Nodes (15): legacyToken(), toBase64Url(), aesKey, decoder, encoder, fromBase64Url(), HKDF_INFO, isStatePayload() (+7 more)

### Community 32 - "scripts/debugMode.test.ts"
Cohesion: 0.29
Nodes (6): everySongId(), extensionRank(), findModel(), modelSearchDirs(), modelsIn(), tablePath()

### Community 33 - "GameScreen.tsx"
Cohesion: 0.21
Nodes (13): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+5 more)

### Community 34 - "RoomMembers.tsx"
Cohesion: 0.17
Nodes (16): COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, InRoom(), InRoomProps, MultiplayerModal(), RoomCard (+8 more)

### Community 35 - "round.ts"
Cohesion: 0.30
Nodes (14): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+6 more)

### Community 36 - "playerColor.ts"
Cohesion: 0.53
Nodes (4): GroupFoundBanner, PLAYER_HUES, playerColor(), playerStyle()

### Community 37 - "guess.test.ts"
Cohesion: 0.11
Nodes (19): fixtureScore(), env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), playedSong(), requestUrl(), similarityKv() (+11 more)

### Community 38 - "@playwright/test"
Cohesion: 0.15
Nodes (7): @playwright/test, devHintFor(), escapeRegExp(), firstTitleWord(), chipOf(), guess(), titleWords()

### Community 39 - "index.ts"
Cohesion: 0.08
Nodes (23): hono, FakeLimiter, cacheKey(), getCachedSong(), isSong(), putCachedSong(), FALLBACK_SONG_ID, Env (+15 more)

### Community 40 - "ref_node_fs"
Cohesion: 0.16
Nodes (7): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult, css, html

### Community 41 - "game/room.ts"
Cohesion: 0.15
Nodes (27): failureText(), FormError, MultiplayerModalProps, RoomForms(), RoomFormsProps, Tab, generateRoomCode(), isRecord() (+19 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "roomStorage.test.ts"
Cohesion: 0.23
Nodes (8): parseRoomEntry(), RoomEntry, clearSavedRoom(), loadSavedRoom(), saveRoom(), MemoryStorage, NOW, storage()

### Community 44 - "slots.ts"
Cohesion: 0.23
Nodes (9): NearGuess, PlacedGuess, SlotView, NearSlot, Song, allTokens(), song, wordsOf() (+1 more)

### Community 45 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 46 - "src/room.ts"
Cohesion: 0.20
Nodes (11): ROOM_CLOSE_EXPIRED, ROOM_CLOSE_LEFT, ROOM_CLOSE_UNKNOWN, RoomEvent, RoomGuess, RoomGuessResult, RoomRound, RESERVED_CLOSE_CODES (+3 more)

### Community 47 - "rooms.spec.ts"
Cohesion: 0.31
Nodes (9): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), openGame(), titleWords (+1 more)

### Community 48 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 56 - "README"
Cohesion: 0.40
Nodes (4): README, Debug mode (npm run dev:debug), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

## Knowledge Gaps
- **233 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 323 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `build-similarity-table.ts`, `package.json`, `useGame.ts`, `e2e-servers.test.ts`, `LEARNINGS.md`, `theme.test.ts`, `graph-update.ts`, `types.ts`, `similarityTable.test.ts`, `useRoom.ts`, `rooms.test.tsx`, `game/similarity.ts`, `debugMode.ts`, `worker/room.test.ts`, `state.ts`, `scripts/debugMode.test.ts`, `round.ts`, `guess.test.ts`, `ref_node_fs`, `game/room.ts`, `roomStorage.test.ts`, `slots.ts`, `gameScreen.test.tsx`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `RoomMembers.tsx`, `playerColor.ts`, `TitleGuess.tsx`, `useGame.ts`, `game/room.ts`, `CLAUDE.md project instructions`, `theme.test.ts`, `Modal.tsx`, `NextSongCountdown.tsx`, `WordToken.tsx`, `useRoom.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _233 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `build-similarity-table.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0676056338028169 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._