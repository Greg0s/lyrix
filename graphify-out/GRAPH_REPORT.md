# Graph Report - lyrix  (2026-09-29)

## Corpus Check
- 135 files · ~89,965 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1040 nodes · 2567 edges · 44 communities (39 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9ddf427`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Song
- WordToken.tsx
- package.json
- dev-debug.ts
- src/similarity.ts
- lyrics.ts
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
- DisplayToken
- similarityTable.test.ts
- HMAC-signed round state
- TriedWords.tsx
- CI workflow
- src/room.ts
- lrclib.ts
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- catalog.ts
- ci/debugMode.test.ts
- worker/room.test.ts
- debugMode.ts
- GameScreen.tsx
- RoomCard.tsx
- RoomMembers.tsx
- guess.test.ts
- types.ts
- songs.ts
- ref_node_fs
- game/room.ts
- react
- NextSongCountdown.tsx
- tokenize() letter class missed œ (cœur split)
- README

## God Nodes (most connected - your core abstractions)
1. `vitest` - 37 edges
2. `Room` - 31 edges
3. `CLAUDE.md project instructions` - 29 edges
4. `RoundView` - 27 edges
5. `react` - 25 edges
6. `normalize()` - 24 edges
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

## Communities (44 total, 5 thin omitted)

### Community 0 - "Song"
Cohesion: 0.23
Nodes (16): audit(), main(), sleep(), auditSong(), CatalogAudit, duplicateCatalogIds(), failureAdvice(), formatAudit() (+8 more)

### Community 1 - "WordToken.tsx"
Cohesion: 0.18
Nodes (17): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, Blank(), blankLabel() (+9 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.14
Nodes (19): buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree(), PackageManifest, port() (+11 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.05
Nodes (73): Similarity pipeline (model→convert→build→inspect→upload→serve), vitest, main(), analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine() (+65 more)

### Community 5 - "lyrics.ts"
Cohesion: 0.22
Nodes (10): Section, LrclibTrack, cleanLyrics(), isKeptControlChar(), isLyricLine(), LEADING_TIMESTAMPS, plainLyricsFrom(), sanitize() (+2 more)

### Community 6 - "useGame.ts"
Cohesion: 0.10
Nodes (39): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), parseNearSlots(), RoundView (+31 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.08
Nodes (28): similarityTableFixture, similarityWorkerUrl, workerUrl, @playwright/test, vite, @vitejs/plugin-react, fixtureScore(), contexts (+20 more)

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
Nodes (8): Workers KV similarity tables, SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), RANK_VOCABULARY_SIZE (50,000), scoreFromRank, SIMILARITY_TABLE_VERSION (3)

### Community 17 - "DisplayToken"
Cohesion: 0.47
Nodes (3): revealedPercent(), DisplayToken, space

### Community 18 - "similarityTable.test.ts"
Cohesion: 0.07
Nodes (48): .vecbin compact embedding format, build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile() (+40 more)

### Community 20 - "TriedWords.tsx"
Cohesion: 0.39
Nodes (6): heatStyle(), TriedWords, TriedWordsProps, proximityHeat(), rank(), sortByProximity()

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "src/room.ts"
Cohesion: 0.08
Nodes (26): RoomEvent, RoomGuess, RoomGuessResult, RoomRound, sanitizePseudo(), FakeState, attachedMemberId(), deleteAlarm() (+18 more)

### Community 23 - "lrclib.ts"
Cohesion: 0.15
Nodes (9): LRCLIB lyrics source, entry, entry, CatalogEntry, bestMatch(), hasUsableLyrics(), parseLrclibTrack(), searchTrack() (+1 more)

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.05
Nodes (23): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders, camille (+15 more)

### Community 28 - "catalog.ts"
Cohesion: 0.33
Nodes (4): catalog, catalogRotation(), daysSinceEpoch(), pickDailyEntry()

### Community 29 - "ci/debugMode.test.ts"
Cohesion: 0.25
Nodes (4): DEBUG_CONFIG, DEBUG_PERSIST_DIR, SIMILARITY_BINDING, wranglerDevArgs()

### Community 30 - "worker/room.test.ts"
Cohesion: 0.06
Nodes (37): hono, RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeLimiter (+29 more)

### Community 32 - "debugMode.ts"
Cohesion: 0.19
Nodes (13): BUILD_SCRIPT, buildTableArgs(), everySongId(), extensionRank(), findModel(), LoadedTable, MODEL_DIR, MODEL_EXTENSIONS (+5 more)

### Community 33 - "GameScreen.tsx"
Cohesion: 0.14
Nodes (19): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+11 more)

### Community 34 - "RoomCard.tsx"
Cohesion: 0.31
Nodes (8): COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, InRoom(), RoomCard, RoomMembers, playerCountLabel()

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.18
Nodes (17): GroupFoundBanner, GroupFoundBannerProps, InRoomProps, PLAYER_HUES, playerColor(), playerStyle(), RoomCardProps, initial() (+9 more)

### Community 37 - "guess.test.ts"
Cohesion: 0.18
Nodes (10): env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), requestUrl(), similarityKv(), wordsInOrder(), table() (+2 more)

### Community 38 - "types.ts"
Cohesion: 0.15
Nodes (12): IS_WORD, SPLIT_ON_WORDS, tokenize(), DisplayLine, GuessResult, Token, devHintFor(), escapeRegExp() (+4 more)

### Community 39 - "songs.ts"
Cohesion: 0.23
Nodes (12): playedSong(), cacheKey(), getCachedSong(), isSong(), putCachedSong(), FALLBACK_SONG_ID, EMERGENCY_FALLBACK_SONG, getSongById() (+4 more)

### Community 40 - "ref_node_fs"
Cohesion: 0.16
Nodes (7): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult, css, html

### Community 41 - "game/room.ts"
Cohesion: 0.08
Nodes (53): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomFailure (+45 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 56 - "README"
Cohesion: 0.29
Nodes (5): README, Debug mode (npm run dev:debug), frWac2Vec model (CC BY 3.0), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

## Knowledge Gaps
- **233 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 324 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `src/similarity.ts` to `Song`, `package.json`, `lyrics.ts`, `useGame.ts`, `e2e-servers.test.ts`, `LEARNINGS.md`, `theme.test.ts`, `graph-update.ts`, `DisplayToken`, `similarityTable.test.ts`, `lrclib.ts`, `rooms.test.tsx`, `catalog.ts`, `ci/debugMode.test.ts`, `worker/room.test.ts`, `debugMode.ts`, `guess.test.ts`, `types.ts`, `ref_node_fs`, `game/room.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.217) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `RoomCard.tsx`, `RoomMembers.tsx`, `WordToken.tsx`, `useGame.ts`, `game/room.ts`, `CLAUDE.md project instructions`, `theme.test.ts`, `NextSongCountdown.tsx`, `TriedWords.tsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _233 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1422924901185771 - nodes in this community are weakly interconnected._
- **Should `src/similarity.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0547680412371134 - nodes in this community are weakly interconnected._