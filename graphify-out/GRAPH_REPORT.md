# Graph Report - lyrix  (2026-09-30)

## Corpus Check
- 139 files · ~94,963 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .example 2, (none) 2, .css 2)

## Summary
- 1069 nodes · 2640 edges · 53 communities (47 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 47 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `20c7f382`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- worker/room.test.ts
- TitleGuess.tsx
- package.json
- dev-debug.ts
- similarityTable.test.ts
- vitest
- useGame.ts
- e2e-servers.test.ts
- devDependencies
- tokenize() letter class missed œ (cœur split)
- scripts
- CLAUDE.md project instructions
- theme.test.ts
- compilerOptions
- compilerOptions
- useRoom.ts
- SIMILARITY deep-dive
- types.ts
- ref_node_fs
- HMAC-signed round state
- graph-update.ts
- CI workflow
- Room
- ref_node_path
- dependencies
- vite-env.d.ts
- session-start.sh
- rooms.test.tsx
- src/similarity.ts
- index.ts
- debugMode.ts
- guess.test.ts
- gameScreen.test.tsx
- GameScreen.tsx
- MultiplayerModal.tsx
- game/room.ts
- RoomMembers.tsx
- Modal.tsx
- @playwright/test
- LEARNINGS.md
- rooms.spec.ts
- parseRoomEntry
- react
- debugMode.spec.ts
- round.ts
- tokenize.ts
- analyze.ts
- slots.ts
- normalize
- NextSongCountdown.tsx
- DisplayToken
- Graphify skill
- README

## God Nodes (most connected - your core abstractions)
1. `vitest` - 38 edges
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

## Communities (53 total, 6 thin omitted)

### Community 0 - "worker/room.test.ts"
Cohesion: 0.14
Nodes (14): RoomMessage, RoomRoundMessage, alone(), connect(), createRoom(), entryFrom(), FakeRooms, FakeSocket (+6 more)

### Community 1 - "TitleGuess.tsx"
Cohesion: 0.30
Nodes (10): LyricsBody, LyricsBodyProps, TitleGuess, TitleGuessProps, TokenRun(), TokenRunProps, SlotSection, SlotToken (+2 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (23): author, description, keywords, license, name, private, type, version (+15 more)

### Community 3 - "dev-debug.ts"
Cohesion: 0.14
Nodes (17): claimPort(), killTree(), loadIntoLocalKv(), main(), PackageManifest, port(), REPO_ROOT, report() (+9 more)

### Community 4 - "similarityTable.test.ts"
Cohesion: 0.05
Nodes (65): .vecbin compact embedding format, build(), BuildOptions, catalogEntry(), main(), readVocabulary(), resolveSongs(), songFromLyricsFile() (+57 more)

### Community 5 - "vitest"
Cohesion: 0.07
Nodes (51): LRCLIB lyrics source, vitest, audit(), main(), sleep(), auditSong(), CatalogAudit, duplicateCatalogIds() (+43 more)

### Community 6 - "useGame.ts"
Cohesion: 0.08
Nodes (45): API_BASE, ErrorBody, fetchRound(), isErrorBody(), parseJsonResponse(), submitGuess(), GroupFoundBannerProps, PlayerAvatarProps (+37 more)

### Community 7 - "e2e-servers.test.ts"
Cohesion: 0.15
Nodes (15): similarityTableFixture, vite, @vitejs/plugin-react, apiProxy(), apiProxyTarget(), DEV_PORTS, forwardedArgs(), forwardedFlag() (+7 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (21): devDependencies, @cloudflare/workers-types, concurrently, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+13 more)

### Community 10 - "scripts"
Cohesion: 0.10
Nodes (20): scripts, build, catalog:check, deploy, deploy:check, deploy:worker, dev, dev:all (+12 more)

### Community 11 - "CLAUDE.md project instructions"
Cohesion: 0.14
Nodes (14): CLAUDE.md project instructions, Conventional Commits + Gitmoji, DEV_REVEAL_LYRICS dev hint, Lyrix game, Lyrix v3 mockup UI, Pedantix, Show-all-lyrics checkbox (revealHint), Team mode placeholder (#29, #30) (+6 more)

### Community 12 - "theme.test.ts"
Cohesion: 0.06
Nodes (46): colors, root, tokens, cssColorToHex(), cssVar(), faviconColors, faviconSvg(), Piece (+38 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, esModuleInterop, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 15 - "useRoom.ts"
Cohesion: 0.14
Nodes (21): apiUrl(), continueAlone(), createRoom(), enter(), failure(), joinRoom(), leaveRoom(), RoomResult (+13 more)

### Community 16 - "SIMILARITY deep-dive"
Cohesion: 0.14
Nodes (10): Workers KV similarity tables, SIMILARITY deep-dive, MAX_NEAR_TARGETS (16), MIN_NEAR_COSINE (0.2), NEAR_SCORE (40), Similarity pipeline (model→convert→build→inspect→upload→serve), RANK_VOCABULARY_SIZE (50,000), scoreFromRank (+2 more)

### Community 17 - "types.ts"
Cohesion: 0.23
Nodes (6): DisplayLine, DisplaySection, GuessResult, RoundView, chipOf(), guess()

### Community 18 - "ref_node_fs"
Cohesion: 0.15
Nodes (6): DEBUG_CONFIG, DEBUG_PERSIST_DIR, SIMILARITY_BINDING, css, html, SIMILARITY_TABLE_VERSION

### Community 20 - "graph-update.ts"
Cohesion: 0.15
Nodes (11): { graph, dropped }, graphPath, root, dropKnownFalseEdges(), GraphLink, isGraphLink(), KNOWN_FALSE_EDGES, KnownFalseEdge (+3 more)

### Community 21 - "CI workflow"
Cohesion: 0.36
Nodes (8): CI workflow, CLOUDFLARE_API_TOKEN / ACCOUNT_ID secrets, npm run deploy:check, CI deploy job, CI test job, VITE_API_BASE_URL build env, Cloudflare Pages hosting, Cloudflare Workers + Hono backend

### Community 22 - "Room"
Cohesion: 0.09
Nodes (16): FakeState, attachedMemberId(), deleteAlarm(), deleteAll(), foundKeys(), get(), json(), newMember() (+8 more)

### Community 23 - "ref_node_path"
Cohesion: 0.22
Nodes (5): ensureDevVars(), example, target, ensureFileFromExample(), EnsureResult

### Community 24 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, hono, react, react-dom

### Community 27 - "rooms.test.tsx"
Cohesion: 0.07
Nodes (16): camille, entry(), FakeWebSocket, fetchMock, fetchRound, guessResult(), latestSocket(), leo (+8 more)

### Community 28 - "src/similarity.ts"
Cohesion: 0.16
Nodes (21): main(), clampScore(), wordPositions(), NearSlot, GuessOutcome, announcedTables, announceSampleMode(), announceTableProblem() (+13 more)

### Community 29 - "index.ts"
Cohesion: 0.07
Nodes (27): hono, FakeLimiter, legacyToken(), toBase64Url(), Env, RateLimiter, REQUIRED_BINDINGS, RoomNamespace (+19 more)

### Community 30 - "debugMode.ts"
Cohesion: 0.17
Nodes (18): buildTodaysTable(), mainWorktree(), BUILD_SCRIPT, buildTableArgs(), everySongId(), extensionRank(), findModel(), LoadedTable (+10 more)

### Community 31 - "guess.test.ts"
Cohesion: 0.13
Nodes (16): env, FIXTURE_LYRICS, KvTable, mockLrclibFetch(), playedSong(), requestUrl(), similarityKv(), songIdOf() (+8 more)

### Community 32 - "gameScreen.test.tsx"
Cohesion: 0.20
Nodes (7): @testing-library/react, fetchRound, round(), submitGuess, tokens(), wonRound(), wordTokenRenders

### Community 33 - "GameScreen.tsx"
Cohesion: 0.23
Nodes (11): App(), Dialog, feedbackMessage(), GameScreen(), isTouchScreen(), GuessFeedback, GuessForm(), GuessFormProps (+3 more)

### Community 34 - "MultiplayerModal.tsx"
Cohesion: 0.14
Nodes (22): RoomFailure, COPIED_MS, CopyCodeButton(), CopyCodeButtonProps, Flash, failureText(), FormError, InRoom() (+14 more)

### Community 35 - "game/room.ts"
Cohesion: 0.15
Nodes (22): generateRoomCode(), isRoomCode(), OWN_FALLBACK_NAME, PSEUDO_MAX_LENGTH, ROOM_CLOSE_EXPIRED, ROOM_CLOSE_LEFT, ROOM_CLOSE_UNKNOWN, ROOM_CODE_ALPHABET (+14 more)

### Community 36 - "RoomMembers.tsx"
Cohesion: 0.40
Nodes (7): GroupFoundBanner, PLAYER_HUES, playerColor(), playerStyle(), initial(), PlayerAvatar(), memberName()

### Community 37 - "Modal.tsx"
Cohesion: 0.38
Nodes (5): HowToPlay(), HowToPlayProps, Modal(), MODAL_CLOSE_MS, ModalProps

### Community 38 - "@playwright/test"
Cohesion: 0.25
Nodes (4): @playwright/test, devHintFor(), escapeRegExp(), firstTitleWord()

### Community 40 - "rooms.spec.ts"
Cohesion: 0.28
Nodes (11): contexts, createRoom(), dialog(), feedback(), guess(), joinRoom(), openGame(), titleWords (+3 more)

### Community 41 - "parseRoomEntry"
Cohesion: 0.40
Nodes (10): isRecord(), isRoundView(), parseRoomEntry(), parseRoomGuess(), parseRoomGuessResult(), parseRoomMember(), parseRoomMessage(), parseRoomRound() (+2 more)

### Community 42 - "react"
Cohesion: 0.33
Nodes (7): react, AppHeader, AppHeaderProps, GroupIcon(), Logo, MultiplayerPromo, MultiplayerPromoProps

### Community 43 - "debugMode.spec.ts"
Cohesion: 0.33
Nodes (4): similarityWorkerUrl, workerUrl, fixtureScore(), SAMPLE_SIMILARITY_SCORES

### Community 44 - "round.ts"
Cohesion: 0.25
Nodes (17): analyzeSong(), buildSectionsView(), buildTitleView(), buildTokens(), isVictory(), maskToken(), songNumberKeys(), songWordKeys() (+9 more)

### Community 45 - "tokenize.ts"
Cohesion: 0.20
Nodes (10): classifyTargets(), FUNCTION_WORDS, isFunctionWord(), IS_WORD, isNumberWord(), SPLIT_ON_WORDS, tokenize(), Token (+2 more)

### Community 46 - "analyze.ts"
Cohesion: 0.18
Nodes (8): analyze(), AnalyzedLine, AnalyzedSection, AnalyzedToken, analyzeLine(), cache, SongAnalysis, tokenizeSpy

### Community 47 - "slots.ts"
Cohesion: 0.26
Nodes (8): closestGuessBySlot(), NearGuess, PlacedGuess, placeNearGuesses(), SlotView, allTokens(), song, wordsOf()

### Community 48 - "normalize"
Cohesion: 0.46
Nodes (5): LIGATURES, normalize(), fromBase64Url(), readable(), titleLeaks()

### Community 49 - "NextSongCountdown.tsx"
Cohesion: 0.73
Nodes (3): NextSongCountdown(), formatCountdown(), msUntilNextSong()

### Community 50 - "DisplayToken"
Cohesion: 0.47
Nodes (3): revealedPercent(), DisplayToken, space

### Community 56 - "README"
Cohesion: 0.40
Nodes (4): README, Debug mode (npm run dev:debug), Similarity one-time setup (convert/build/inspect/upload), worker/wrangler.debug.toml

## Knowledge Gaps
- **237 isolated node(s):** `session-start.sh script`, `name`, `version`, `private`, `type` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 330 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `worker/room.test.ts`, `package.json`, `similarityTable.test.ts`, `useGame.ts`, `e2e-servers.test.ts`, `theme.test.ts`, `useRoom.ts`, `ref_node_fs`, `graph-update.ts`, `ref_node_path`, `rooms.test.tsx`, `index.ts`, `debugMode.ts`, `guess.test.ts`, `gameScreen.test.tsx`, `game/room.ts`, `LEARNINGS.md`, `round.ts`, `tokenize.ts`, `analyze.ts`, `slots.ts`, `normalize`, `NextSongCountdown.tsx`, `DisplayToken`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `GameScreen.tsx`, `package.json`, `MultiplayerModal.tsx`, `similarityTable.test.ts`, `RoomMembers.tsx`, `TitleGuess.tsx`, `Modal.tsx`, `useGame.ts`, `CLAUDE.md project instructions`, `theme.test.ts`, `useRoom.ts`, `NextSongCountdown.tsx`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `version` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `worker/room.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `dev-debug.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._