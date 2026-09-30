# Graph Report - lyrix  (2026-09-30)

## Corpus Check
- 137 files · ~92,429 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1054 nodes · 2613 edges · 46 communities (41 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8250e988`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker/room.test.ts
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
- useRoom.ts
- SIMILARITY deep-dive
- RoundView
- embeddings.ts
- HMAC-signed round state
- graph-update.ts
- CI workflow
- Room
- ref_node_fs
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- roomStorage.test.ts
- types.ts
- debugMode.ts
- guess.test.ts
- gameScreen.test.tsx
- GameScreen.tsx
- RoomCard.tsx
- src/room.ts
- RoomMembers.tsx
- Modal.tsx
- @playwright/test
- Optimization pass: repeated work, three caches (2026-09-15)
- rooms.spec.ts
- game/room.ts
- react
- debugMode.spec.ts
- NextSongCountdown.tsx
- README

## God Nodes (most connected - your core abstractions)
1. `vitest` - 37 edges
2. `Room` - 31 edges
3. `normalize()` - 29 edges
4. `CLAUDE.md project instructions` - 29 edges
5. `RoundView` - 28 edges
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

## Communities (46 total, 5 thin omitted)

### Community 0 - "worker/room.test.ts"
Cohesion: 0.14
Nodes (14): RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket (+6 more)

### Community 1 - "TitleGuess.tsx"
Cohesion: 0.18
Nodes (17): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, Blank(), blankLabel() (+9 more)

### Community 2 - "package.json"
Cohesion: 0.10
Nodes (22): author, description, keywords, license, name, private, type, version (+14 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.13
Nodes (22): buildTodaysTable(), claimPort(), killTree(), loadIntoLocalKv(), main(), mainWorktree(), PackageManifest, port() (+14 more)

### Community 4 - "src/similarity.ts"
Cohesion: 0.05
Nodes (72): main(), EmbeddingModel, buildSimilarityScores(), BuildTableOptions, BuildTableResult, classifyTargets(), MAX_NEAR_TARGETS, MIN_NEAR_COSINE (+64 more)

### Community 5 - "vitest"
Cohesion: 0.06
Nodes (58): LRCLIB lyrics source, vitest, build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs() (+50 more)

### Community 6 - "useGame.ts"
Cohesion: 0.10
Nodes (38): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), TriedWordsProps, parseNearSlots() (+30 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.17
Nodes (13): vite, @vitejs/plugin-react, apiProxy(), apiProxyTarget(), DEV_PORTS, forwardedArgs(), forwardedFlag(), loadViteConfig() (+5 more)

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
Cohesion: 0.07
Nodes (36): colors, root, tokens, cssColorToHex(), cssVar(), faviconColors, faviconSvg(), Piece (+28 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "useRoom.ts"
Cohesion: 0.18
Nodes (19): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomFailure (+11 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.15
Nodes (10): Workers KV similarity tables, SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), Similarity pipeline (model→convert→build→inspect→upload→serve), RANK_VOCABULARY_SIZE (50,000), scoreFromRank (+2 more)

### Community 17 - "RoundView"
Cohesion: 0.21
Nodes (8): GuessResult, RoundView, GameState, openGame(), chipOf(), guess(), lyricsOnlyWord(), titleWords()

### Community 18 - "embeddings.ts"
Cohesion: 0.16
Nodes (14): .vecbin compact embedding format, main(), COMPACT_MAGIC, dotProduct(), float32View(), l2NormalizeRows(), loadEmbeddings(), LoadOptions (+6 more)

### Community 20 - "graph-update.ts"
Cohesion: 0.15
Nodes (11): { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES, KnownFalseEdge (+3 more)

### Community 21 - "CI workflow"
Cohesion: 0.27
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (16): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), newMember() (+8 more)

### Community 23 - "ref_node_fs"
Cohesion: 0.16
Nodes (7): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult, css, html

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.07
Nodes (16): camille, entry(), FakeWebSocket, fetchMock, fetchRound, guessResult(), latestSocket(), leo (+8 more)

### Community 28 - "roomStorage.test.ts"
Cohesion: 0.24
Nodes (7): parseRoomEntry(), RoomEntry, clearSavedRoom(), loadSavedRoom(), MemoryStorage, NOW, storage()

### Community 29 - "types.ts"
Cohesion: 0.05
Nodes (51): hono, analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeSong(), cache, SongAnalysis (+43 more)

### Community 30 - "debugMode.ts"
Cohesion: 0.13
Nodes (17): wrangler, BUILD_SCRIPT, DEBUG_CONFIG, DEBUG_PERSIST_DIR, everySongId(), extensionRank(), findModel(), LoadedTable (+9 more)

### Community 31 - "guess.test.ts"
Cohesion: 0.08
Nodes (34): analyzeLine(), LIGATURES, normalize(), tokenize(), env, FIXTURE_LYRICS, KvTable, mockLrclibFetch() (+26 more)

### Community 32 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 33 - "GameScreen.tsx"
Cohesion: 0.20
Nodes (13): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+5 more)

### Community 34 - "RoomCard.tsx"
Cohesion: 0.23
Nodes (10): COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, InRoomProps, RoomCard, RoomCardProps, RoomMembersProps (+2 more)

### Community 35 - "src/room.ts"
Cohesion: 0.20
Nodes (11): ROOM_CLOSE_EXPIRED, ROOM_CLOSE_LEFT, ROOM_PING, RoomEvent, RoomGuess, RoomGuessResult, RoomRound, RESERVED_CLOSE_CODES (+3 more)

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.23
Nodes (14): GroupFoundBanner, GroupFoundBannerProps, PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), PlayerAvatarProps (+6 more)

### Community 37 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 38 - "@playwright/test"
Cohesion: 0.25
Nodes (4): @playwright/test, devHintFor(), escapeRegExp(), firstTitleWord()

### Community 40 - "rooms.spec.ts"
Cohesion: 0.33
Nodes (8): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), titleWords, wonByHost()

### Community 41 - "game/room.ts"
Cohesion: 0.16
Nodes (25): failureText(), FormError, MultiplayerModalProps, RoomForms(), RoomFormsProps, Tab, generateRoomCode(), isRecord() (+17 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "debugMode.spec.ts"
Cohesion: 0.31
Nodes (4): similarityTableFixture, similarityWorkerUrl, workerUrl, loadPlaywrightConfig()

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 56 - "README"
Cohesion: 0.40
Nodes (4): README, Debug mode (npm run dev:debug), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

## Knowledge Gaps
- **233 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 323 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `worker/room.test.ts`, `package.json`, `src/similarity.ts`, `useGame.ts`, `e2e-servers.test.ts`, `theme.test.ts`, `useRoom.ts`, `embeddings.ts`, `graph-update.ts`, `ref_node_fs`, `rooms.test.tsx`, `roomStorage.test.ts`, `types.ts`, `debugMode.ts`, `guess.test.ts`, `gameScreen.test.tsx`, `Optimization pass: repeated work, three caches (2026-09-15)`, `game/room.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `RoomCard.tsx`, `src/similarity.ts`, `RoomMembers.tsx`, `TitleGuess.tsx`, `Modal.tsx`, `useGame.ts`, `game/room.ts`, `CLAUDE.md project instructions`, `theme.test.ts`, `useRoom.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _233 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker/room.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09782608695652174 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12923076923076923 - nodes in this community are weakly interconnected._