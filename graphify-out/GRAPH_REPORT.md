# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 131 files · ~87,628 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1010 nodes · 2503 edges · 53 communities (47 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b3700a4`
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
- LEARNINGS.md
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
- index.ts
- debugMode.ts
- GameScreen.tsx
- RoomCard.tsx
- normalize
- RoomMembers.tsx
- guess.test.ts
- catalog.ts
- songs.ts
- ref_node_path
- FakeSocket
- react
- state.ts
- lrclib.ts
- build-similarity-table.ts
- resolveSong.test.ts
- README
- RoomSocket
- NextSongCountdown.tsx
- RoomContext
- RoomNamespace
- FakeLimiter

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

### Community 0 - "catalogAudit.ts"
Cohesion: 0.25
Nodes (15): audit(), main(), sleep(), auditSong(), CatalogAudit, duplicateCatalogIds(), failureAdvice(), formatAudit() (+7 more)

### Community 1 - "WordToken.tsx"
Cohesion: 0.18
Nodes (17): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, Blank(), blankLabel() (+9 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.13
Nodes (25): ref_node_module, ref_node_net, buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree() (+17 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.16
Nodes (26): main(), clampScore(), NEAR_SCORE, wordPositions(), isNumberWord(), counted, song, SAMPLE_SIMILARITY_SCORES (+18 more)

### Community 5 - "embeddings.ts"
Cohesion: 0.16
Nodes (14): .vecbin compact embedding format, ref_node_readline, ref_node_util, main(), COMPACT_MAGIC, float32View(), loadEmbeddings(), LoadOptions (+6 more)

### Community 6 - "useGame.ts"
Cohesion: 0.09
Nodes (43): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots() (+35 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.08
Nodes (30): E2E from a worktree tested the main checkout's servers (2026-09-13), Playwright webServer raced Wrangler cold start (2026-09-11), similarityTableFixture, similarityWorkerUrl, workerUrl, @playwright/test, vite, @vitejs/plugin-react (+22 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 9 - "LEARNINGS.md"
Cohesion: 0.16
Nodes (19): Continuous improvement loop, Performance rules (memoize per isolate, no re-render on keystroke), One-time Cloudflare account setup for CI deploy, CORS preflight without Access-Control-Max-Age, Pages and Worker on different origins: VITE_API_BASE_URL required (2026-09-12), Deploy failing: 'Not logged in', not Node 20 deprecation (2026-09-11), Emergency fallback song (EMERGENCY_FALLBACK_SONG), Float32 round-trips need toBeCloseTo (+11 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.11
Nodes (20): Graphify skill pointer (.claude/CLAUDE.md), Graphify skill, CLAUDE.md project instructions, Conventional Commits + Gitmoji, Daily song rotation (UTC midnight), DEV_REVEAL_LYRICS dev hint, English-only repository policy, Lyrix game (+12 more)

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
Cohesion: 0.13
Nodes (19): Workers KV similarity tables, KV binding shipped commented out; dev uses --var SIMILARITY_SAMPLE, SIMILARITY deep-dive, Calibrate against the real model, Function words never count, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), Model licensing (CC BY 3.0, never committed) (+11 more)

### Community 17 - "types.ts"
Cohesion: 0.08
Nodes (39): analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), analyzeSong(), cache, SongAnalysis (+31 more)

### Community 18 - "similarityTable.test.ts"
Cohesion: 0.12
Nodes (25): dotProduct(), EmbeddingModel, l2NormalizeRows(), buildSimilarityScores(), BuildTableOptions, BuildTableResult, classifyTargets(), MAX_NEAR_TARGETS (+17 more)

### Community 19 - "HMAC-signed round state"
Cohesion: 0.18
Nodes (11): Anti-cheat: Worker-only lyrics, Config rules: gitignored file never manual; missing config names itself, HMAC-signed round state, STATE_SECRET, Missing worker/.dev.vars bit twice (2026-09-13), A placeholder makes a feature look finished, Similarity too strict: rank-based scoring (2026-09-15), songId in /api/round leaks the title (+3 more)

### Community 20 - "game/similarity.ts"
Cohesion: 0.24
Nodes (14): heatStyle(), TriedWords, HOT_SCORE, MAX_MISSED_SCORE, MAX_PROXIMITY_SCORE, numberProximityScore(), proximityHeat(), ProximityScored (+6 more)

### Community 21 - "CI workflow"
Cohesion: 0.27
Nodes (10): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend (+2 more)

### Community 22 - "Room"
Cohesion: 0.13
Nodes (11): attachedMemberId(), deleteAll(), foundKeys(), get(), json(), publicMember(), put(), readBody() (+3 more)

### Community 23 - "resolveSong.ts"
Cohesion: 0.19
Nodes (15): LRCLIB metadata isn't clean, LRC markup leaked into guessable words (2026-09-14), tokenize(), Section, wordsInOrder(), cleanLyrics(), isKeptControlChar(), isLyricLine() (+7 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.05
Nodes (23): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders, camille (+15 more)

### Community 28 - "game/room.ts"
Cohesion: 0.06
Nodes (66): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomFailure (+58 more)

### Community 29 - "vitest"
Cohesion: 0.29
Nodes (4): ref_node_fs, vitest, css, html

### Community 30 - "worker/room.test.ts"
Cohesion: 0.25
Nodes (11): alone(), connect(), createRoom(), entryFrom(), FakeRooms, guessIn(), joinRoom(), post() (+3 more)

### Community 31 - "index.ts"
Cohesion: 0.16
Nodes (9): hono, app, Env, RateLimiter, REQUIRED_BINDINGS, roomRoutes, RoomsContext, RoomsEnv (+1 more)

### Community 32 - "debugMode.ts"
Cohesion: 0.15
Nodes (14): BUILD_SCRIPT, DEBUG_CONFIG, DEBUG_PERSIST_DIR, extensionRank(), findModel(), LoadedTable, MODEL_DIR, MODEL_EXTENSIONS (+6 more)

### Community 33 - "GameScreen.tsx"
Cohesion: 0.16
Nodes (16): App(), Dialog, feedbackMessage(), GameScreen(), GuessFeedback, GuessForm(), GuessFormProps, HowToPlay() (+8 more)

### Community 34 - "RoomCard.tsx"
Cohesion: 0.31
Nodes (8): COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, InRoom(), RoomCard, RoomMembers, playerCountLabel()

### Community 35 - "normalize"
Cohesion: 0.16
Nodes (9): French text matching (accents, elisions), tokenize() letter class missed œ (cœur split), FUNCTION_WORDS, isFunctionWord(), LIGATURES, normalize(), IS_WORD, LETTER_CLASS (+1 more)

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.18
Nodes (17): GroupFoundBanner, GroupFoundBannerProps, InRoomProps, PLAYER_HUES, playerColor(), playerStyle(), RoomCardProps, initial() (+9 more)

### Community 37 - "guess.test.ts"
Cohesion: 0.17
Nodes (11): env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), requestUrl(), similarityKv(), parsed(), table() (+3 more)

### Community 38 - "catalog.ts"
Cohesion: 0.21
Nodes (7): devHintFor(), escapeRegExp(), firstTitleWord(), catalog, catalogRotation(), daysSinceEpoch(), pickDailyEntry()

### Community 39 - "songs.ts"
Cohesion: 0.24
Nodes (12): resolveSong.ts split out for Node tooling, playedSong(), cacheKey(), getCachedSong(), isSong(), putCachedSong(), FALLBACK_SONG_ID, EMERGENCY_FALLBACK_SONG (+4 more)

### Community 40 - "ref_node_path"
Cohesion: 0.22
Nodes (8): ref_node_os, ref_node_path, ref_node_url, ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult

### Community 41 - "FakeSocket"
Cohesion: 0.23
Nodes (3): RoomMessage, RoomRoundMessage, FakeSocket

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "state.ts"
Cohesion: 0.27
Nodes (10): decoder, encoder, fromBase64Url(), hmacKey(), isStatePayload(), keyCache, signState(), StatePayload (+2 more)

### Community 44 - "lrclib.ts"
Cohesion: 0.27
Nodes (7): entry, CatalogEntry, bestMatch(), hasUsableLyrics(), LrclibTrack, parseLrclibTrack(), searchTrack()

### Community 45 - "build-similarity-table.ts"
Cohesion: 0.39
Nodes (8): build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile(), parseSections()

### Community 46 - "resolveSong.test.ts"
Cohesion: 0.25
Nodes (4): LRCLIB lyrics source, LRCLIB /api/search instead of /api/get, entry, MIN_LYRIC_WORDS

### Community 47 - "README"
Cohesion: 0.40
Nodes (5): README, Debug mode (npm run dev:debug), E2E dedicated ports (15173/18787/19229), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

## Knowledge Gaps
- **227 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 313 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `catalogAudit.ts`, `package.json`, `src/similarity.ts`, `embeddings.ts`, `useGame.ts`, `e2e-servers.test.ts`, `favicon.test.ts`, `graph-update.ts`, `types.ts`, `similarityTable.test.ts`, `game/similarity.ts`, `rooms.test.tsx`, `game/room.ts`, `worker/room.test.ts`, `debugMode.ts`, `normalize`, `guess.test.ts`, `catalog.ts`, `ref_node_path`, `state.ts`, `lrclib.ts`, `resolveSong.test.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `RoomCard.tsx`, `RoomMembers.tsx`, `WordToken.tsx`, `useGame.ts`, `CLAUDE.md project instructions`, `NextSongCountdown.tsx`, `game/similarity.ts`, `game/room.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `RoundView` connect `useGame.ts` to `normalize`, `guess.test.ts`, `catalog.ts`, `e2e-servers.test.ts`, `types.ts`, `rooms.test.tsx`, `game/room.ts`, `worker/room.test.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._
- **Should `useGame.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08734693877551021 - nodes in this community are weakly interconnected._